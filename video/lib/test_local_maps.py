"""Tests for video/lib/local_maps.py (the Node twin is local-maps.test.mjs).

They always pass explicit fixture paths (and point the environment overrides at fixtures too), so
the real sanitize.local.json and overlay.local.json are never opened. Fixture names are invented;
even so, assertions never put a fixture real name into a failure message, and one test proves a
printed map shows no names.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import local_maps as lm  # noqa: E402

FIX = os.path.join(HERE, "fixtures")
SANITIZE = os.path.join(FIX, "sanitize.fixture.json")
OVERLAY = os.path.join(FIX, "overlay.fixture.json")
MISSING = os.path.join(FIX, "does-not-exist.local.json")
os.environ["SA_SANITIZE_PATH"] = SANITIZE
os.environ["SA_OVERLAY_PATH"] = OVERLAY

REAL = ["Example Real Club", "Example Real", "EXR-1042", "Sample Person Name",
        "Example Real Club Annex", "Placeholder Superintendent"]


def contains_real(s: str) -> bool:
    low = s.lower()
    return any(t.lower() in low for t in REAL)


def quiet(_msg):
    pass


def load(**kw):
    args = {"sanitize_path": SANITIZE, "overlay_path": OVERLAY, "warn": quiet}
    args.update(kw)
    return lm.load_local_maps(**args)


class LocalMapsTests(unittest.TestCase):
    def test_pairs_sorted_longest_first(self):
        maps = load()
        self.assertEqual(len(maps.pairs), 5)
        self.assertEqual([len(real) for real, _ in maps.pairs], [23, 18, 17, 12, 8])
        self.assertFalse(any(contains_real(f) for _, f in maps.pairs), "fictional side must not be a real name")

    def test_denylist_unique_case_insensitive(self):
        maps = load()
        self.assertEqual(len(maps.denylist), 6, "the lower-case duplicate is dropped")
        self.assertTrue({t.lower() for t in maps.denylist} == {t.lower() for t in REAL}, "denylist set differs")

    def test_redact(self):
        maps = load()
        text = " ".join(f"<{t}>" for t in REAL) + " and lower-case example real club"
        out = lm.redact(text, maps)
        self.assertFalse(contains_real(out), "redacted text still contains a fixture real name")
        self.assertEqual(
            out,
            "<[denylisted #1]> <[denylisted #2]> <[denylisted #3]> <[denylisted #4]> "
            "<[denylisted #5]> <[denylisted #6]> and lower-case [denylisted #1]",
        )

    def test_find_denylisted(self):
        maps = load()
        self.assertEqual(lm.find_denylisted("xx Sample Person Name yy EXR-1042", maps), [(4, 3), (3, 25)])

    def test_repr_shows_counts_only(self):
        maps = load()
        self.assertEqual(repr(maps), "<LocalMaps n_pairs=5 n_denylist=6>")
        self.assertEqual(str(maps), "<LocalMaps n_pairs=5 n_denylist=6>")
        self.assertEqual(repr(maps.denylist), "<denylist n=6>")
        self.assertEqual(str(maps.pairs), "<pairs n=5>")

    def test_json_dumps_of_maps_fails(self):
        with self.assertRaises(TypeError):
            json.dumps(load())

    def test_printing_the_maps_prints_no_name(self):
        script = (
            "import sys; sys.path.insert(0, %r)\n"
            "import local_maps as lm\n"
            "m = lm.load_local_maps()\n"
            "print(m); print(m.denylist); print(m.pairs); print(repr(m), file=sys.stderr)\n"
            "print(f'{m.denylist} {m!r}')\n" % HERE
        )
        res = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, env=os.environ.copy())
        self.assertEqual(res.returncode, 0)
        self.assertFalse(contains_real(res.stdout + res.stderr), "printed output contains a fixture real name")

    def test_missing_files(self):
        warnings = []
        maps = lm.load_local_maps(sanitize_path=MISSING, overlay_path=MISSING, warn=warnings.append)
        self.assertEqual((len(maps.pairs), len(maps.denylist)), (0, 0))
        self.assertEqual(lm.redact("unchanged text", maps), "unchanged text")
        self.assertEqual(len(warnings), 2)
        self.assertTrue(all(MISSING in w for w in warnings))

    def test_environment_overrides(self):
        self.assertEqual(repr(lm.load_local_maps(warn=quiet)), "<LocalMaps n_pairs=5 n_denylist=6>")

    def test_malformed_files_do_not_quote_contents(self):
        d = tempfile.mkdtemp(prefix="sa-local-maps-")
        try:
            bad = os.path.join(d, "bad.local.json")
            cases = [
                ('{"Example Real Club": "Riverbend National",', "sanitize_path", "not valid JSON"),
                ('{"Example Real Club": 42}', "sanitize_path", "entry #1 must map to a string"),
                ('{"pairs": {}, "denylist": "Example Real Club"}', "overlay_path", '"denylist" must be an array'),
            ]
            for body, arg, expected in cases:
                with self.subTest(expected=expected):
                    with open(bad, "w", encoding="utf-8") as fh:
                        fh.write(body)
                    with self.assertRaises(lm.LocalMapsError) as ctx:
                        load(**{arg: bad})
                    self.assertIn(expected, str(ctx.exception))
                    self.assertFalse(contains_real(str(ctx.exception)), "error message quotes a real name")
        finally:
            shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
