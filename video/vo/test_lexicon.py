"""Tests for video/vo/lexicon.json and video/vo/voice-settings.md, and how render-brian.py reads them.

Reads only repository files. No key, no network, no media.
"""

import copy
import importlib.util
import json
import os
import re
import shutil
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
LEXICON = os.path.join(HERE, "lexicon.json")
SETTINGS = os.path.join(HERE, "voice-settings.md")
GUIDES = os.path.join(REPO, "Learn Spatial Adjust.dc.html")
APP = os.path.join(REPO, "SpatialAdjustApp.dc.html")
PLACEHOLDER = os.path.join(HERE, "fixtures", "episode.vo-placeholder.json")
CHECK_LINE = os.path.join(HERE, "fixtures", "episode.vo-lexicon-check.json")


def load_renderer():
    spec = importlib.util.spec_from_file_location("render_brian", os.path.join(HERE, "render-brian.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


rb = load_renderer()


def entries():
    with open(LEXICON, encoding="utf-8") as fh:
        return json.load(fh)


class LexiconFile(unittest.TestCase):
    def test_every_entry_has_written_spoken_and_note(self):
        data = entries()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        for n, e in enumerate(data, 1):
            for field in ("written", "spoken", "note"):
                self.assertIsInstance(e.get(field), str, f"entry {n} {field}")
                self.assertTrue(e[field].strip(), f"entry {n} has an empty {field}")
            self.assertLessEqual(set(e), {"written", "spoken", "note", "regex"}, f"entry {n} has unknown fields")
            if e.get("regex"):
                re.compile(e["written"])

    def test_station_ids(self):
        lex = rb.load_lexicon()
        self.assertEqual(rb.apply_lexicon("3AP1", lex), "hole 3, A P 1")
        self.assertEqual(rb.apply_lexicon("Station 11AP2 sits in area AP.", lex),
                         "Station hole 11, A P 2 sits in area A P.")

    def test_the_five_named_terms_are_covered(self):
        written = {e["written"]: e["spoken"] for e in entries() if not e.get("regex")}
        lex = rb.load_lexicon()
        for term in ("TurfRad", "Lynx", "VWC", "ET", "IntelliDash"):
            self.assertIn(term, written)
            self.assertNotEqual(rb.apply_lexicon(term, lex), term, f"{term} has no spoken form")

    def test_whole_word_and_case_sensitive(self):
        lex = rb.load_lexicon()
        self.assertEqual(rb.apply_lexicon("today's ET.", lex), "today's E T.")
        self.assertEqual(rb.apply_lexicon("ETo Et BET", lex), "ETo Et BET")
        self.assertEqual(rb.apply_lexicon("lynx", lex), "lynx")

    def test_units_and_labels(self):
        lex = rb.load_lexicon()
        self.assertEqual(rb.apply_lexicon("Lynx receives 0%", lex), "Links receives 0 percent")
        self.assertEqual(rb.apply_lexicon("27.6% against 54 %", lex), "27.6 percent against 54 percent")
        self.assertEqual(rb.apply_lexicon("a 10 mm cap against a 3 mm reference", lex),
                         "a 10 millimetres cap against a 3 millimetres reference")
        self.assertEqual(rb.apply_lexicon("your own % Adj. value", lex), "your own percent adjustment value")
        self.assertEqual(rb.apply_lexicon("Avg. VWC and Avg / High / Low", lex), "average V W C and average / High / Low")

    def test_every_written_form_is_in_the_guides(self):
        with open(GUIDES, encoding="utf-8") as fh:
            guides = fh.read()
        with open(APP, encoding="utf-8") as fh:
            app = fh.read()
        for e in entries():
            pattern = re.compile(e["written"]) if e.get("regex") else re.compile(
                rf"(?<![A-Za-z0-9]){re.escape(e['written'])}(?![A-Za-z0-9])")
            self.assertTrue(pattern.search(guides) or pattern.search(app),
                            f"{e['written']!r} is not used by the guides; check the spelling")

    def test_the_check_line_exercises_every_entry(self):
        with open(CHECK_LINE, encoding="utf-8") as fh:
            text = json.load(fh)["vo"][0]["text"]
        for e in entries():
            pattern = re.compile(e["written"]) if e.get("regex") else re.compile(
                rf"(?<![A-Za-z0-9]){re.escape(e['written'])}(?![A-Za-z0-9])")
            self.assertTrue(pattern.search(text), f"the lexicon check line does not say {e['written']!r}")

    def test_captions_keep_the_written_text(self):
        episode = rb.load_episode(PLACEHOLDER)
        before = copy.deepcopy(episode)
        plan = rb.plan_lines(episode, rb.load_lexicon())
        self.assertEqual(episode, before, "applying the lexicon changed the episode")
        for line, p in zip(episode["vo"], plan):
            self.assertEqual(p["text"], line["text"])
        table = next(p for p in plan if p["line"] == "vo-table")
        self.assertIn("station 3AP1", table["text"])
        self.assertIn("station hole 3, A P 1", table["spoken"])
        self.assertEqual(table["characters"], len(table["spoken"]))


class VoiceSettings(unittest.TestCase):
    def test_document_matches_the_renderer(self):
        doc = rb.read_fenced_settings(SETTINGS)
        expected = {k: v for k, v in rb.VOICE_CONFIG.items() if k != "voice_settings"}
        expected.update(rb.VOICE_CONFIG["voice_settings"])
        for key, value in expected.items():
            self.assertIn(key, doc, f"voice-settings.md does not record {key}")
            if isinstance(value, bool):
                self.assertEqual(doc[key].lower(), str(value).lower(), key)
            elif isinstance(value, (int, float)):
                self.assertEqual(float(doc[key]), float(value), key)
            else:
                self.assertEqual(doc[key], value, key)
        self.assertEqual(doc["voice_id"], "Gubgw9l4dtIoQA9YZHgx")
        self.assertEqual(doc["model_id"], "eleven_multilingual_v2")

    def test_rms_target_is_recorded_with_date_and_method(self):
        target = rb.read_rms_target(SETTINGS)
        self.assertTrue(-30 < target < -10)
        with open(SETTINGS, encoding="utf-8") as fh:
            text = fh.read()
        self.assertIn(f"{target:.4f}", text.replace("**", ""))
        self.assertIn("measure_rms.py", text)
        self.assertRegex(text, r"Measured \d{4}-\d{2}-\d{2}")

    def test_missing_or_bad_target_fails_clearly(self):
        tmp = tempfile.mkdtemp(prefix="sa-vo-settings-")
        try:
            path = os.path.join(tmp, "voice-settings.md")
            for body, message in (
                ("# Settings\n\n```text\nvoice_id: x\n```\n", "RMS target missing"),
                ("rms_target_dbfs: -19.3\n", "RMS target missing"),  # not in a fenced block
                ("```\nrms_target_dbfs: loud\n```\n", "not a number"),
                ("```\nrms_target_dbfs: 3\n```\n", "between -60 and 0"),
            ):
                with open(path, "w") as fh:
                    fh.write(body)
                with self.assertRaises(rb.ConfigError) as caught:
                    rb.read_rms_target(path)
                self.assertIn(message, str(caught.exception))
            with self.assertRaises(rb.ConfigError) as caught:
                rb.read_rms_target(os.path.join(tmp, "absent.md"))
            self.assertIn("RMS target missing", str(caught.exception))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
