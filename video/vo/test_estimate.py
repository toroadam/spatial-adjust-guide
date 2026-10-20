"""Tests for video/vo/estimate.py.

The episode and series estimates read only repository files. The --live test uses a fixture config with a dummy key
and a fake HTTP layer, the same way test_render_brian.py does; nothing here touches the network or ~/.claude.json.
"""

import contextlib
import importlib.util
import io
import json
import os
import re
import shutil
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
EPISODE = os.path.join(HERE, "fixtures", "episode.vo-placeholder.json")
DUMMY_KEY = "dummy-elevenlabs-key-ESTIMATE-not-a-real-key"


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


est = load("estimate", "estimate.py")


def run(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = est.main(argv)
    return code, out.getvalue(), err.getvalue()


class EpisodeEstimate(unittest.TestCase):
    def test_counts_lexicon_applied_characters(self):
        e = est.episode_estimate(EPISODE)
        plan = est.rb.plan_lines(est.rb.load_episode(EPISODE), est.rb.load_lexicon())
        self.assertEqual([line["characters"] for line in e["lines"]], [p["characters"] for p in plan])
        self.assertEqual([line["characters"] for line in e["lines"]], [len(p["spoken"]) for p in plan])
        self.assertEqual(e["characters"], sum(len(p["spoken"]) for p in plan))
        self.assertGreater(e["characters"], sum(len(p["text"]) for p in plan))  # 3AP1 -> hole 3, A P 1 is longer
        self.assertEqual(e["words"], 70)
        self.assertEqual(e["credits"], e["characters"] * est.CREDITS_PER_CHARACTER)
        self.assertEqual(e["with_retakes"], e["credits"] * 2.0)

    def test_cli_prints_lines_totals_and_retakes(self):
        code, out, err = run(["--episode", EPISODE, "--retakes", "3"])
        self.assertEqual(code, 0, err)
        e = est.episode_estimate(EPISODE, 3.0)
        for line in e["lines"]:
            self.assertRegex(out, re.compile(rf"^{line['line']}\s+{line['characters']}\s+{line['characters']}\s+"
                                             rf"{line['characters'] * 3}$", re.M))
        self.assertRegex(out, re.compile(rf"^total\s+{e['characters']}\s+{e['characters']}\s+{e['characters'] * 3}$",
                                         re.M))
        self.assertIn("retake factor 3", out)

    def test_credit_constant_is_shared_with_the_renderer(self):
        self.assertEqual(est.CREDITS_PER_CHARACTER, est.rb.CREDITS_PER_CHARACTER)
        self.assertEqual(est.CREDITS_PER_CHARACTER, 1.0)


class SeriesEstimate(unittest.TestCase):
    def test_counts_26_guides_with_steps(self):
        guides = est.guides_from_ledger()
        self.assertEqual(len(guides), 26)
        self.assertIn("dashboard-overview", [g["guide"] for g in guides])
        self.assertTrue(all(g["steps"] > 0 for g in guides))
        self.assertTrue(all(g["title"] != g["guide"] for g in guides), "every guide should have a tile title")

    def test_formula(self):
        guides = [{"guide": "a", "title": "A", "steps": 4}, {"guide": "b", "title": "B", "steps": 5},
                  {"guide": "c", "title": "C", "steps": 6}]
        s = est.series_estimate(guides, cps=10.0, seconds=(20, 30), retakes=2.0)
        self.assertEqual([r["seconds"] for r in s["rows"]], [20, 25, 30])
        self.assertEqual([r["characters"] for r in s["rows"]], [200, 250, 300])
        self.assertEqual(s["characters"], 750)
        self.assertEqual(s["with_retakes"], 1500)
        self.assertEqual((s["low_characters"], s["high_characters"]), (600, 900))
        same = est.series_estimate([{"guide": "a", "title": "A", "steps": 5}], cps=10.0, seconds=(20, 30))
        self.assertEqual(same["rows"][0]["seconds"], 25)

    def test_cli_states_its_assumptions(self):
        code, out, err = run(["--series"])
        self.assertEqual(code, 0, err)
        self.assertIn("Series estimate: 26 guides", out)
        for phrase in ("claims ledger", "20 s", "30 s", "characters per second", "credit per character",
                       "Retake factor 2", "(pilot)"):
            self.assertIn(phrase, out)
        self.assertEqual(len(re.findall(r"^[a-z0-9-]+\s+\d+\s+\d+\.\d\s+\d+", out, re.M)), 26)

    def test_cps_from_reports(self):
        tmp = tempfile.mkdtemp(prefix="sa-vo-est-")
        try:
            ours = os.path.join(tmp, "ours.json")
            with open(ours, "w") as fh:
                json.dump({"lines": [{"line": "a", "seconds": 5.0, "characters": 80},
                                     {"line": "b", "seconds": 5.0, "characters": 70}]}, fh)
            icentral = os.path.join(tmp, "icentral.json")
            with open(icentral, "w") as fh:
                json.dump({"lines": [{"line": "D1", "text": "x" * 64, "seconds": 4.0}]}, fh)
            self.assertEqual(est.cps_from_report(ours)[0], 15.0)
            self.assertEqual(est.cps_from_report(icentral)[0], 16.0)
            code, out, err = run(["--series", "--cps-from", ours])
            self.assertEqual(code, 0, err)
            self.assertIn("15 characters per second", out)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_write_markdown(self):
        tmp = tempfile.mkdtemp(prefix="sa-vo-est-")
        try:
            path = os.path.join(tmp, "series-estimate.md")
            with mock.patch.object(est, "SERIES_ESTIMATE_PATH", path):
                code, out, err = run(["--write"])
            self.assertEqual(code, 0, err)
            with open(path) as fh:
                text = fh.read()
            pilot = est.episode_estimate(est.PLACEHOLDER)
            self.assertIn("70-word placeholder", text)
            self.assertIn(f"**{pilot['characters']}**", text)
            self.assertIn("Retake factor 2", text)
            self.assertRegex(text, r"Generated \d{4}-\d{2}-\d{2}")
            self.assertIn("Total, 26 guides", text)
            self.assertNotIn("Pilot, as rendered", text)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_write_markdown_with_the_pilot_as_rendered(self):
        tmp = tempfile.mkdtemp(prefix="sa-vo-est-")
        try:
            path = os.path.join(tmp, "series-estimate.md")
            report = os.path.join(tmp, "render-report.json")
            with open(report, "w") as fh:
                json.dump({"episode": "vo-placeholder",
                           "lines": [{"line": "vo-intro", "seconds": 6.0, "characters": 96},
                                     {"line": "vo-map", "seconds": 5.0, "characters": 86}]}, fh)
            log = os.path.join(tmp, "credits-log.md")
            with open(log, "w") as fh:
                fh.write("| Date | Episode | Lines sent | Characters sent | Credits remaining before -> after |\n"
                         "|---|---|---|---|---|\n"
                         "| 2026-10-19 19:59 | other | 1 | 200 | 1000 -> 900 |\n"
                         "| 2026-10-20 09:29 | vo-placeholder | 2 | 182 | 900 -> 820 |\n")
            with mock.patch.object(est, "SERIES_ESTIMATE_PATH", path), \
                    mock.patch.object(est.rb, "CREDITS_LOG_PATH", log):
                code, out, err = run(["--write", "--episode", EPISODE, "--cps-from", report,
                                      "--takes", "2", "--render-seconds", "46"])
            self.assertEqual(code, 0, err)
            with open(path) as fh:
                text = fh.read()
            self.assertIn("## Pilot, as rendered", text)
            self.assertIn("| VO lines rendered | 4, or 8 with retakes | 2 in 1 run |", text)
            self.assertIn("| Characters sent | 444, or 888 with retakes | 182 |", text)
            self.assertIn("| Credits | 444, or 888 with retakes | 80 (0.44 per character) |", text)
            self.assertIn("11.00 s, 16.55 characters per second", text)
            self.assertIn("| Takes recorded | — | 2 |", text)
            self.assertIn("| Final render wall time | — | 46 s |", text)
            # The series' observed billing still counts every logged run.
            self.assertIn("2 runs sent 382 characters", text)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_takes_and_render_time_need_the_pilots_report(self):
        tmp = tempfile.mkdtemp(prefix="sa-vo-est-")
        try:
            path = os.path.join(tmp, "series-estimate.md")
            report = os.path.join(tmp, "render-report.json")
            with open(report, "w") as fh:
                json.dump({"episode": "another-episode", "lines": [{"line": "a", "seconds": 5.0, "characters": 80}]}, fh)
            with mock.patch.object(est, "SERIES_ESTIMATE_PATH", path):
                code, _, err = run(["--write", "--episode", EPISODE, "--cps-from", report, "--takes", "2"])
                self.assertEqual(code, 2)
                self.assertIn("is not the render report of vo-placeholder", err)
                self.assertFalse(os.path.exists(path))
                # Without --takes, another episode's report only sets the rate.
                code, _, err = run(["--write", "--episode", EPISODE, "--cps-from", report])
                self.assertEqual(code, 0, err)
            with open(path) as fh:
                self.assertNotIn("Pilot, as rendered", fh.read())
            with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
                est.parse_args(["--series", "--takes", "2"])
            with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
                est.parse_args(["--write", "--cps-from", report, "--render-seconds", "0"])
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


class Observed(unittest.TestCase):
    def test_observed_billing_from_the_log(self):
        tmp = tempfile.mkdtemp(prefix="sa-vo-est-log-")
        try:
            path = os.path.join(tmp, "credits-log.md")
            with open(path, "w") as fh:
                fh.write("# log\n\n| Date | Episode | Lines sent | Characters sent | Credits remaining before -> after |\n"
                         "|---|---|---|---|---|\n"
                         "| 2026-10-19 19:59 | a | 1 | 200 | 1000 -> 900 |\n"
                         "| 2026-10-19 20:10 | a | 0 | 0 | 900 -> 900 |\n"
                         "| 2026-10-19 20:20 | b | 2 | 300 | 900 -> 600 |\n"
                         "| 2026-10-19 20:30 | b | 1 | 50 | 600 -> unknown |\n")
            seen = est.observed_billing(path)
            self.assertEqual((seen["runs"], seen["characters"], seen["credits"]), (2, 500, 400))
            self.assertAlmostEqual(seen["per_character"], 0.8)
            self.assertEqual(est.observed_billing(os.path.join(tmp, "absent.md"))["runs"], 0)
            only_b = est.observed_billing(path, episode="b")
            self.assertEqual((only_b["runs"], only_b["characters"], only_b["credits"]), (1, 300, 300))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


class Live(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sa-vo-est-live-")
        self.config = os.path.join(self.tmp, "claude.json")
        with open(self.config, "w") as fh:
            json.dump({"projects": {"/p": {"mcpServers": {"elevenlabs": {"env": {"ELEVENLABS_API_KEY": DUMMY_KEY}}}}}},
                      fh)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_live_prints_counts_only(self):
        calls = []

        def fake(url, headers, body=None, timeout=120):
            calls.append((url, headers, body))
            return json.dumps({"character_count": 1234, "character_limit": 100000,
                               "next_invoice": {"note": "not printed"}}).encode()

        with mock.patch.dict(os.environ, {"SA_ELEVENLABS_CONFIG": self.config}), \
                mock.patch.object(est.rb, "_http", fake):
            code, out, err = run(["--live"])
        self.assertEqual(code, 0, err)
        self.assertEqual(out.strip(), "credits remaining: 98766 characters (limit 100000)")
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0][0].endswith("/v1/user/subscription"))
        self.assertEqual(calls[0][1]["xi-api-key"], DUMMY_KEY)
        self.assertNotIn(DUMMY_KEY, out + err)

    def test_live_without_a_key(self):
        with open(self.config, "w") as fh:
            json.dump({}, fh)
        with mock.patch.dict(os.environ, {"SA_ELEVENLABS_CONFIG": self.config}):
            code, out, err = run(["--live"])
        self.assertEqual(code, 2)
        self.assertIn(est.rb.KEY_NOT_FOUND, err)


if __name__ == "__main__":
    unittest.main()
