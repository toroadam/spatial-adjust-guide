"""Tests for video/showcase/whisper-roundtrip.py and video/showcase/vo-stem.py.

Pure functions only: no Whisper model, no ffmpeg, no network, no key and no media. One test reads the real
video/showcase/episode.json, so a VO line whose ttsText no longer matches video/vo/lexicon.json fails the suite.
"""

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO

HERE = os.path.dirname(os.path.abspath(__file__))
EPISODE = os.path.join(HERE, "episode.json")


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), os.path.join(HERE, f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


wr = load("whisper-roundtrip")
stem = load("vo-stem")


def line(lid, text, w0, w1, **extra):
    return {"id": lid, "text": text, "windowIn": w0, "windowOut": w1, **extra}


class Normalise(unittest.TestCase):
    def test_punctuation_case_and_apostrophes(self):
        self.assertEqual(wr.normalise("Each station's average, dated; Map and table."),
                         ["each", "stations", "average", "dated", "map", "and", "table"])

    def test_spelled_out_letters_join(self):
        self.assertEqual(wr.normalise("average VWC"), wr.normalise("average V W C"))
        self.assertEqual(wr.normalise("today's ET"), wr.normalise("today's E.T."))
        self.assertEqual(wr.normalise("a V-W-C"), ["a", "vwc"])

    def test_product_terms_join(self):
        self.assertEqual(wr.normalise("Turf Rad"), ["turfrad"])
        self.assertEqual(wr.normalise("Intelli-Dash"), ["intellidash"])
        self.assertEqual(wr.normalise("IntelliDash"), ["intellidash"])

    def test_links_never_becomes_lynx(self):
        self.assertEqual(wr.normalise("reads links back"), ["reads", "links", "back"])

    def test_numbers_spelling_and_units(self):
        self.assertEqual(wr.normalise("the 2 lists"), ["the", "two", "lists"])
        self.assertEqual(wr.normalise("colours"), wr.normalise("colors"))
        self.assertEqual(wr.normalise("a 10mm cap"), wr.normalise("a 10 mm cap"))
        self.assertEqual(wr.normalise("17%"), ["seventeen", "percent"])


class Wer(unittest.TestCase):
    def test_identical(self):
        self.assertEqual(wr.wer(["a", "b", "c"], ["a", "b", "c"]), 0.0)

    def test_one_substitution_in_five(self):
        self.assertAlmostEqual(wr.wer(list("abcde"), list("abXde")), 0.2)

    def test_insertions_and_deletions(self):
        self.assertEqual(wr.edit_distance(["a", "b"], ["a", "x", "b", "y"]), 2)
        self.assertEqual(wr.edit_distance(["a", "b", "c"], ["c"]), 2)

    def test_empty(self):
        self.assertEqual(wr.wer([], []), 0.0)
        self.assertEqual(wr.wer(["a"], []), 1.0)


class RequiredTerms(unittest.TestCase):
    def test_lynx_heard_as_links_fails(self):
        terms = wr.required_terms("then reads Lynx back", wr.normalise("then reads links back"))
        self.assertEqual(terms, {"Lynx": {"scripted": 1, "heard": 0, "ok": False}})

    def test_lynx_heard_as_lynx_passes(self):
        self.assertTrue(wr.required_terms("reads Lynx back", wr.normalise("reads Lynx back"))["Lynx"]["ok"])

    def test_two_word_spellings_pass(self):
        terms = wr.required_terms("In IntelliDash, a TurfRad scan", wr.normalise("In Intelli Dash, a Turf Rad scan"))
        self.assertTrue(terms["IntelliDash"]["ok"])
        self.assertTrue(terms["TurfRad"]["ok"])

    def test_every_occurrence_counts(self):
        terms = wr.required_terms("Lynx and Lynx", wr.normalise("Lynx and links"))
        self.assertEqual(terms["Lynx"], {"scripted": 2, "heard": 1, "ok": False})

    def test_lines_without_terms_have_none(self):
        self.assertEqual(wr.required_terms("Map and table stay in sync.", ["map"]), {})


class Assign(unittest.TestCase):
    LINES = [line("one", "first line", 2.0, 4.0), line("two", "second line", 4.2, 6.0)]

    def words(self, *spans):
        return [{"word": f" w{i}", "start": a, "end": b} for i, (a, b) in enumerate(spans)]

    def test_words_in_windows(self):
        by_line, outside = wr.assign(self.words((2.1, 2.5), (4.5, 4.8)), self.LINES)
        self.assertEqual([w["word"] for w in by_line["one"]], [" w0"])
        self.assertEqual([w["word"] for w in by_line["two"]], [" w1"])
        self.assertEqual(outside, [])

    def test_margins(self):
        by_line, outside = wr.assign(self.words((1.75, 1.9), (6.3, 6.45), (0.5, 1.0), (7.0, 7.5)), self.LINES)
        self.assertEqual(len(by_line["one"]), 1)   # starts 0.25 s before windowIn
        self.assertEqual(len(by_line["two"]), 1)   # ends 0.45 s after windowOut
        self.assertEqual(len(outside), 2)

    def test_overlapping_margins_go_to_the_window_overlapped_most(self):
        by_line, _ = wr.assign(self.words((3.9, 4.15), (4.1, 4.4)), self.LINES)
        self.assertEqual(len(by_line["one"]), 1)
        self.assertEqual(len(by_line["two"]), 1)

    def test_first_word_after_silence(self):
        # Whisper often stamps the first word after a long silence from the start of the silence.
        by_line, outside = wr.assign(self.words((0.0, 2.4)), self.LINES)
        self.assertEqual(len(by_line["one"]), 1)
        self.assertEqual(outside, [])

    def test_offset(self):
        by_line, _ = wr.assign(self.words((12.1, 12.5)), self.LINES, offset=10.0)
        self.assertEqual(len(by_line["one"]), 1)


class Score(unittest.TestCase):
    def test_pass_and_fail(self):
        lines = [line("a", "Then reads Lynx back.", 0, 2), line("b", "Then reads Lynx back.", 3, 5)]
        by_line = {"a": [{"word": w} for w in [" Then", " reads", " Lynx", " back."]],
                   "b": [{"word": w} for w in [" Then", " reads", " links", " back."]]}
        rows = wr.score(lines, by_line)
        self.assertTrue(rows[0]["pass"])
        self.assertFalse(rows[1]["pass"])
        self.assertAlmostEqual(rows[1]["wer"], 0.25)

    def test_wer_threshold(self):
        lines = [line("a", "one two three four five", 0, 2)]
        rows = wr.score(lines, {"a": [{"word": w} for w in [" one", " two", " tree", " four", " five"]]})
        self.assertTrue(rows[0]["pass"])
        rows = wr.score(lines, {"a": [{"word": w} for w in [" one", " too", " tree", " four", " five"]]})
        self.assertFalse(rows[0]["pass"])


class ShowcaseEpisode(unittest.TestCase):
    """The real video/showcase/episode.json."""

    @classmethod
    def setUpClass(cls):
        cls.ep, cls.lines = wr.load_lines(EPISODE)

    def test_tts_text_matches_the_lexicon(self):
        self.assertEqual(wr.check_tts(self.lines), [])

    def test_windows_do_not_overlap_and_leave_the_builder_gap(self):
        ordered = sorted(self.lines, key=lambda l: l["windowIn"])
        for a, b in zip(ordered, ordered[1:]):
            self.assertGreaterEqual(round(b["windowIn"] - a["windowOut"], 3), 0.15, (a["id"], b["id"]))

    def test_prompt_names_the_required_terms(self):
        prompt = wr.vocabulary_prompt(self.lines)
        for term in ("TurfRad", "Lynx", "IntelliDash", "VWC", "ET", "Spatial Adjust"):
            self.assertIn(term, prompt)

    def test_every_required_term_is_scripted(self):
        script = " ".join(l["text"] for l in self.lines)
        for term in wr.REQUIRED:
            self.assertIn(term, script)


class Cli(unittest.TestCase):
    def test_report_in_tmp_is_refused(self):
        with redirect_stderr(StringIO()) as err:
            code = wr.main(["--audio", __file__, "--episode", EPISODE, "--out", "/tmp/whisper-report.json"])
        self.assertEqual(code, 2)
        self.assertIn("refusing report path", err.getvalue())

    def test_missing_audio(self):
        with redirect_stderr(StringIO()):
            self.assertEqual(wr.main(["--audio", "/nonexistent.wav", "--episode", EPISODE, "--out", "x.json"]), 2)

    def test_stale_tts_text_is_refused(self):
        with open(EPISODE, encoding="utf-8") as fh:
            ep = json.load(fh)
        ep["vo"][1]["ttsText"] = ep["vo"][1]["text"]   # "VWC" and "TurfRad" unrespelled
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "episode.json")
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(ep, fh)
            _, lines = wr.load_lines(path)
            self.assertEqual(wr.check_tts(lines), [ep["vo"][1]["id"]])


class StemFit(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.vo = self.dir.name
        for lid in ("a", "b"):
            open(os.path.join(self.vo, f"{lid}.wav"), "wb").close()
        self.ep = {"id": "t", "plannedRuntime": 10, "vo": [line("a", "Alpha.", 1.0, 3.0, line="L1"),
                                                           line("b", "Beta.", 3.5, 5.0, line="L2")]}

    def tearDown(self):
        self.dir.cleanup()

    def report(self, *entries):
        return {"lines": [{"line": lid, "text": text, "seconds": s} for lid, text, s in entries]}

    def test_fits(self):
        rows = stem.fit_rows(self.ep, self.report(("a", "Alpha.", 1.9), ("b", "Beta.", 1.5)), self.vo)
        self.assertTrue(all(r["fits"] for r in rows))
        self.assertEqual(rows[0]["spare"], 0.1)

    def test_overrun(self):
        rows = stem.fit_rows(self.ep, self.report(("a", "Alpha.", 2.2), ("b", "Beta.", 1.0)), self.vo)
        self.assertFalse(rows[0]["fits"])
        self.assertIn("overruns its window by 0.20 s", rows[0]["problem"])

    def test_not_rendered_and_stale_text(self):
        rows = stem.fit_rows(self.ep, self.report(("a", "Alpha, changed.", 1.0)), self.vo)
        self.assertIn("text differs", rows[0]["problem"])
        self.assertEqual(rows[1]["problem"], "not rendered")

    def test_episode_needs_windows_and_runtime(self):
        bad = dict(self.ep, vo=[{"id": "a", "text": "Alpha."}])
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump(bad, fh)
        try:
            with self.assertRaises(stem.ConfigError):
                stem.load_episode(fh.name)
        finally:
            os.unlink(fh.name)


if __name__ == "__main__":
    unittest.main()
