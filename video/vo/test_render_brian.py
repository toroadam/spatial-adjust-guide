"""Tests for video/vo/render-brian.py.

They never open the real ~/.claude.json (SA_ELEVENLABS_CONFIG always points at a fixture config holding a dummy
key), never touch the network (the HTTP layer, render_brian._http, is replaced by a fake), never call ffmpeg (decode is
replaced by a synthetic tone) and never write to the real credits log. The only media they write is a synthetic WAV
under a throwaway test media root in the home directory, removed afterwards, the same pattern test_media_root.py uses.

The dummy keys are invented and are not in the ElevenLabs key format.
"""

import contextlib
import importlib.util
import io
import json
import math
import os
import re
import shutil
import sys
import tempfile
import unittest
import urllib.error
import wave
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "fixtures")
EPISODE = os.path.join(FIXTURES, "episode.vo-placeholder.json")


def load_renderer():
    spec = importlib.util.spec_from_file_location("render_brian", os.path.join(HERE, "render-brian.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


rb = load_renderer()

TOP_KEY = "dummy-elevenlabs-key-TOPLEVEL-not-a-real-key"
PROJECT_KEY = "dummy-elevenlabs-key-PROJECT-not-a-real-key"
DUMMIES = (TOP_KEY, PROJECT_KEY)
TEST_ROOT = os.path.join(os.path.expanduser("~"), "Documents", f"SpatialAdjust_MarCom_test_vo_{os.getpid()}")

TEST_LEXICON = [
    {"written": r"\b(\d{1,2})AP(\d{1,2})\b", "spoken": "hole $1, A P $2", "note": "station ids", "regex": True},
    {"written": "VWC", "spoken": "V W C", "note": "initialism"},
]
TEST_SETTINGS = "# Voice settings (test fixture)\n\n```text\nvoice_id: x\nrms_target_dbfs: -20.0\n```\n"


def entry(key):
    return {"mcpServers": {"elevenlabs": {"command": "npx", "env": {"ELEVENLABS_API_KEY": key}}}}


def tone(seconds=1.0, lead=0.3, tail=0.3, amp=0.3, sr=48000):
    """lead s of silence, a 220 Hz tone, tail s of silence."""
    body = [amp * math.sin(2 * math.pi * 220 * i / sr) for i in range(int(seconds * sr))]
    return [0.0] * int(lead * sr) + body + [0.0] * int(tail * sr)


class FakeElevenLabs:
    """Stands in for _http. Records every call; never sees the network."""

    def __init__(self, fail_speech=None, fail_subscription=None):
        self.calls = []
        self.used = 5000
        self.fail_speech = fail_speech
        self.fail_subscription = fail_subscription

    def __call__(self, url, headers, body=None, timeout=120):
        self.calls.append((url, dict(headers), body))
        if url.endswith("/v1/user/subscription"):
            if self.fail_subscription:
                raise self.fail_subscription
            return json.dumps({"character_count": self.used, "character_limit": 100000, "tier": "x"}).encode()
        if "/v1/text-to-speech/" in url:
            if self.fail_speech:
                raise self.fail_speech
            self.used += len(json.loads(body)["text"])
            return b"ID3 fake mp3 bytes"
        raise AssertionError(f"unexpected URL {url}")

    def speech_calls(self):
        return [c for c in self.calls if "/v1/text-to-speech/" in c[0]]


def run_main(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = rb.main(argv)
    return code, out.getvalue(), err.getvalue()


class _Sandbox(unittest.TestCase):
    """Fixture config, lexicon, voice settings and credits log in a temp dir; media under TEST_ROOT."""

    config = {"projects": {"/somewhere/else": {"mcpServers": {}}, "/fixture/project": entry(PROJECT_KEY)}}

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sa-vo-test-")
        self.config_path = os.path.join(self.tmp, "claude.json")
        with open(self.config_path, "w") as fh:
            json.dump(self.config, fh)
        lexicon = os.path.join(self.tmp, "lexicon.json")
        with open(lexicon, "w") as fh:
            json.dump(TEST_LEXICON, fh)
        self.settings_path = os.path.join(self.tmp, "voice-settings.md")
        with open(self.settings_path, "w") as fh:
            fh.write(TEST_SETTINGS)
        self.log_path = os.path.join(self.tmp, "credits-log.md")
        self.patches = [
            mock.patch.dict(os.environ, {"SA_ELEVENLABS_CONFIG": self.config_path, "SA_MEDIA_ROOT": TEST_ROOT}),
            mock.patch.object(rb, "LEXICON_PATH", lexicon),
            mock.patch.object(rb, "VOICE_SETTINGS_PATH", self.settings_path),
            mock.patch.object(rb, "CREDITS_LOG_PATH", self.log_path),
            mock.patch.object(rb, "decode", lambda path: tone()),
            mock.patch.object(rb, "SETTLE_S", 0.0),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)
        shutil.rmtree(TEST_ROOT, ignore_errors=True)

    def vo_dir(self, episode_id="vo-placeholder"):
        return os.path.join(TEST_ROOT, "episodes", episode_id, "vo")

    def assertNoKeyAnywhere(self, *texts):
        for text in texts:
            for key in DUMMIES:
                self.assertNotIn(key, text)
        if os.path.isdir(TEST_ROOT):
            for folder, _dirs, files in os.walk(TEST_ROOT):
                for name in files:
                    with open(os.path.join(folder, name), "rb") as fh:
                        data = fh.read()
                    for key in DUMMIES:
                        self.assertNotIn(key.encode(), data, f"key bytes found in {name}")
        if os.path.exists(self.log_path):
            with open(self.log_path) as fh:
                log = fh.read()
            for key in DUMMIES:
                self.assertNotIn(key, log)


class KeyResolution(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sa-vo-key-")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write(self, obj_or_text):
        path = os.path.join(self.tmp, "claude.json")
        with open(path, "w") as fh:
            fh.write(obj_or_text if isinstance(obj_or_text, str) else json.dumps(obj_or_text))
        return path

    def key_from(self, path):
        with mock.patch.dict(os.environ, {"SA_ELEVENLABS_CONFIG": path}):
            return rb._key()

    def error_from(self, path):
        with mock.patch.dict(os.environ, {"SA_ELEVENLABS_CONFIG": path}):
            with self.assertRaises(rb.ElevenLabsKeyError) as caught:
                rb._key()
        return str(caught.exception)

    def test_top_level_scope_wins(self):
        path = self.write({**entry(TOP_KEY), "projects": {"/fixture/project": entry(PROJECT_KEY)}})
        self.assertEqual(self.key_from(path), TOP_KEY)

    def test_project_scope_found_in_any_project(self):
        path = self.write({"mcpServers": {"other": {"env": {}}},
                           "projects": {"/no/entry": {"mcpServers": {}}, "/also/none": {},
                                        "/fixture/project": entry(PROJECT_KEY)}})
        self.assertEqual(self.key_from(path), PROJECT_KEY)

    def test_missing_key_message(self):
        path = self.write({"projects": {"/fixture/project": {"mcpServers": {"elevenlabs": {"env": {}}}}}})
        self.assertEqual(self.error_from(path), rb.KEY_NOT_FOUND)

    def test_missing_file_message(self):
        self.assertEqual(self.error_from(os.path.join(self.tmp, "absent.json")), rb.KEY_NOT_FOUND)

    def test_invalid_json_message_never_quotes_the_file(self):
        path = self.write('{"mcpServers": {"elevenlabs": {"env": {"ELEVENLABS_API_KEY": "' + TOP_KEY + '" ,,, }')
        message = self.error_from(path)
        self.assertIn("not valid JSON", message)
        for key in DUMMIES:
            self.assertNotIn(key, message)

    def test_unreadable_path_message(self):
        message = self.error_from(self.tmp)  # a directory, not a file
        self.assertIn("cannot read", message)

    def test_messages_never_include_a_value(self):
        # A malformed entry next to a valid-looking value: whatever goes wrong, no value is echoed.
        path = self.write({"mcpServers": {"elevenlabs": {"env": [TOP_KEY]}},
                           "projects": {"/p": {"mcpServers": {"elevenlabs": {"env": {"OTHER": PROJECT_KEY}}}}}})
        message = self.error_from(path)
        self.assertEqual(message, rb.KEY_NOT_FOUND)

    def test_default_path_is_home_claude_json(self):
        env = {k: v for k, v in os.environ.items() if k != "SA_ELEVENLABS_CONFIG"}
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertEqual(rb._config_path(), os.path.join(os.path.expanduser("~"), ".claude.json"))

    def test_client_repr_hides_key(self):
        client = rb.ElevenLabs(TOP_KEY)
        self.assertNotIn(TOP_KEY, repr(client))
        self.assertNotIn(TOP_KEY, str(client))
        self.assertNotIn(TOP_KEY, f"{client!r} {client}")

    def test_child_env_drops_elevenlabs_variables(self):
        with mock.patch.dict(os.environ, {"ELEVENLABS_API_KEY": TOP_KEY, "SA_X": "1"}):
            env = rb._child_env()
        self.assertNotIn("ELEVENLABS_API_KEY", env)
        self.assertNotIn(TOP_KEY, " ".join(env.values()))
        self.assertEqual(env.get("SA_X"), "1")


class DryRun(_Sandbox):
    def test_dry_run_lists_lines_and_makes_no_call(self):
        def no_network(*_a, **_k):
            raise AssertionError("dry run made a network call")

        def no_key():
            raise AssertionError("dry run read the key")

        with mock.patch.object(rb, "_http", no_network), mock.patch.object(rb, "_key", no_key), \
                mock.patch("urllib.request.urlopen", no_network):
            code, out, err = run_main(["--episode", EPISODE, "--dry-run"])
        self.assertEqual(code, 0, err)
        plan = rb.plan_lines(rb.load_episode(EPISODE), rb.load_lexicon())
        for p in plan:
            row = re.search(rf"^{re.escape(p['line'])}\s+(\d+)\s+(\d+)\s+new$", out, re.M)
            self.assertIsNotNone(row, f"no row for {p['line']}:\n{out}")
            self.assertEqual(int(row.group(1)), p["characters"])
            self.assertEqual(int(row.group(2)), p["characters"])  # 1 credit per character
        total = sum(p["characters"] for p in plan)
        self.assertRegex(out, re.compile(rf"^total\s+{total}\s+{total}\s+4 lines$", re.M))
        self.assertIn("spoken: In the table, station hole 3, A P 1 measured", out)
        self.assertFalse(os.path.exists(TEST_ROOT), "dry run created the media root")
        self.assertFalse(os.path.exists(self.log_path), "dry run wrote the credits log")
        self.assertNoKeyAnywhere(out, err)

    def test_dry_run_with_lines(self):
        code, out, err = run_main(["--episode", EPISODE, "--dry-run", "--lines", "vo-map"])
        self.assertEqual(code, 0, err)
        self.assertIn("vo-map", out)
        self.assertNotIn("vo-intro", out)

    def test_unknown_line_id(self):
        code, _out, err = run_main(["--episode", EPISODE, "--dry-run", "--lines", "vo-nope"])
        self.assertEqual(code, 2)
        self.assertIn("vo-nope", err)


class Render(_Sandbox):
    def render(self, *extra, fake=None):
        fake = fake or FakeElevenLabs()
        with mock.patch.object(rb, "_http", fake):
            code, out, err = run_main(["--episode", EPISODE, *extra])
        return code, out, err, fake

    def report(self):
        with open(os.path.join(self.vo_dir(), "render-report.json")) as fh:
            return json.load(fh)

    def log_rows(self):
        with open(self.log_path) as fh:
            return [line for line in fh.read().splitlines() if re.match(r"^\| \d{4}-", line)]

    def test_render_writes_wavs_report_and_log_without_exposing_the_key(self):
        code, out, err, fake = self.render()
        self.assertEqual(code, 0, err)

        # The key went only into the xi-api-key header, never into a URL or a body.
        self.assertTrue(fake.calls)
        for url, headers, body in fake.calls:
            self.assertEqual(headers["xi-api-key"], PROJECT_KEY)
            self.assertTrue(url.startswith("https://api.elevenlabs.io/"))
            self.assertNotIn(PROJECT_KEY, url)
            if body is not None:
                self.assertNotIn(PROJECT_KEY.encode(), body)

        # Voice, model, settings, lexicon and continuity in each request.
        speech = fake.speech_calls()
        self.assertEqual(len(speech), 4)
        bodies = [json.loads(b) for _u, _h, b in speech]
        self.assertTrue(all(f"/v1/text-to-speech/{rb.VOICE}?output_format=mp3_44100_192" in u for u, _h, _b in speech))
        self.assertTrue(all(b["model_id"] == "eleven_multilingual_v2" and b["voice_settings"] == rb.SETTINGS
                            for b in bodies))
        self.assertNotIn("previous_text", bodies[0])
        self.assertEqual(bodies[1]["previous_text"], bodies[0]["text"])
        self.assertEqual(bodies[0]["next_text"], bodies[1]["text"])
        self.assertNotIn("next_text", bodies[3])
        self.assertIn("hole 3, A P 1", bodies[2]["text"])
        self.assertIn("V W C", bodies[1]["text"])

        # 48 kHz, 24-bit, mono WAVs under <media root>/episodes/<id>/vo.
        for lid in ("vo-intro", "vo-map", "vo-table", "vo-push"):
            with wave.open(os.path.join(self.vo_dir(), f"{lid}.wav")) as w:
                self.assertEqual((w.getframerate(), w.getsampwidth(), w.getnchannels()), (48000, 3, 1))

        # Report: the shape the builder reads (dc_build.py:22), plus characters and text_hash. Written text kept.
        report = self.report()
        seconds = {line["line"]: line["seconds"] for line in report["lines"]}
        self.assertEqual(list(seconds), ["vo-intro", "vo-map", "vo-table", "vo-push"])
        for line in report["lines"]:
            self.assertEqual(set(line), {"line", "text", "seconds", "characters", "text_hash"})
            self.assertAlmostEqual(line["seconds"], 1.12, delta=0.02)
        self.assertIn("station 3AP1", report["lines"][2]["text"])
        self.assertEqual(report["rms_target_dbfs"], -20.0)

        # Credits before and after, printed and logged as counts only.
        self.assertRegex(out, r"credits before: 95000 characters remaining \(limit 100000\)")
        sent = sum(len(b["text"]) for b in bodies)
        self.assertRegex(out, rf"credits after: {95000 - sent} characters remaining \(this run used {sent}\)")
        rows = self.log_rows()
        self.assertEqual(len(rows), 1)
        self.assertRegex(rows[0], rf"^\| \d{{4}}-\d\d-\d\d \d\d:\d\d \| vo-placeholder \| 4 \| {sent} \| "
                                  rf"95000 -> {95000 - sent} \|$")

        self.assertNoKeyAnywhere(out, err, json.dumps(report))

    def test_unchanged_lines_are_skipped_and_force_rerenders(self):
        self.assertEqual(self.render()[0], 0)
        code, out, err, fake = self.render()
        self.assertEqual(code, 0, err)
        self.assertEqual(fake.speech_calls(), [])
        self.assertEqual(len([c for c in fake.calls if c[0].endswith("/subscription")]), 2)
        self.assertIn("vo-map: unchanged, skipped", out)
        code, _out, err, fake = self.render("--force", "--lines", "vo-map")
        self.assertEqual(code, 0, err)
        self.assertEqual(len(fake.speech_calls()), 1)
        rows = self.log_rows()
        self.assertEqual([r.split("|")[3].strip() for r in rows], ["4", "0", "1"])
        self.assertEqual(len(self.report()["lines"]), 4)

    def test_changed_rms_target_relevels_without_an_api_call(self):
        self.assertEqual(self.render()[0], 0)
        with open(self.settings_path, "w") as fh:
            fh.write(TEST_SETTINGS.replace("-20.0", "-23.5"))
        code, out, err, fake = self.render()
        self.assertEqual(code, 0, err)
        self.assertEqual(fake.speech_calls(), [])
        self.assertIn("re-levelled from the saved take", out)
        self.assertEqual(self.report()["rms_target_dbfs"], -23.5)

    def test_api_error_is_scrubbed_and_still_logged(self):
        body = json.dumps({"detail": {"status": "invalid_request", "message": f"echoed {PROJECT_KEY}"}}).encode()
        error = urllib.error.HTTPError("https://api.elevenlabs.io/x", 400, "Bad Request", {}, io.BytesIO(body))
        code, out, err, _fake = self.render(fake=FakeElevenLabs(fail_speech=error))
        self.assertEqual(code, 1)
        self.assertIn("HTTP 400", err)
        self.assertIn("[redacted]", err)
        self.assertEqual(len(self.log_rows()), 1)
        self.assertNoKeyAnywhere(out, err)

    def test_subscription_failure_stops_before_any_speech(self):
        error = urllib.error.URLError(f"cannot reach host {PROJECT_KEY}")
        code, out, err, fake = self.render(fake=FakeElevenLabs(fail_subscription=error))
        self.assertEqual(code, 1)
        self.assertEqual(fake.speech_calls(), [])
        self.assertFalse(os.path.exists(self.log_path))
        self.assertNoKeyAnywhere(out, err)

    def test_after_count_waits_for_the_account_to_catch_up(self):
        class Lagging(FakeElevenLabs):
            """The subscription count catches up only on the third read after the speech call."""

            def __init__(self):
                super().__init__()
                self.reads = 0
                self.shown = self.used

            def __call__(self, url, headers, body=None, timeout=120):
                result = super().__call__(url, headers, body, timeout)
                if url.endswith("/v1/user/subscription"):
                    self.reads += 1
                    if self.reads == 1 or self.reads >= 4:
                        self.shown = self.used
                    return json.dumps({"character_count": self.shown, "character_limit": 100000}).encode()
                return result

        fake = Lagging()
        with mock.patch.object(rb, "SETTLE_S", 30.0), mock.patch.object(rb, "SETTLE_STEP_S", 0.0):
            code, out, err, fake = self.render("--lines", "vo-map", fake=fake)
        self.assertEqual(code, 0, err)
        self.assertEqual(fake.reads, 4)
        sent = len(json.loads(fake.speech_calls()[0][2])["text"])
        self.assertIn(f"(this run used {sent})", out)

    def test_not_enough_credits_sends_nothing(self):
        fake = FakeElevenLabs()
        fake.used = 100000 - 50  # 50 characters left; the episode needs about 400
        code, out, err, fake = self.render(fake=fake)
        self.assertEqual(code, 1)
        self.assertIn("not enough credits", err)
        self.assertEqual(fake.speech_calls(), [])
        self.assertNoKeyAnywhere(out, err)

    def test_missing_rms_target_fails_clearly_before_reading_the_key(self):
        with open(self.settings_path, "w") as fh:
            fh.write("# Voice settings\n\nNo target yet.\n")

        def no_key():
            raise AssertionError("read the key before checking the RMS target")

        with mock.patch.object(rb, "_key", no_key):
            code, _out, err, fake = self.render()
        self.assertEqual(code, 2)
        self.assertIn("RMS target missing", err)
        self.assertIn("rms_target_dbfs", err)
        self.assertEqual(fake.calls, [])

    def test_missing_key_exits_2_with_the_message(self):
        with open(self.config_path, "w") as fh:
            json.dump({"projects": {}}, fh)
        code, _out, err, fake = self.render()
        self.assertEqual(code, 2)
        self.assertIn(rb.KEY_NOT_FOUND, err)
        self.assertEqual(fake.calls, [])


class Episode(_Sandbox):
    def write_episode(self, vo):
        path = os.path.join(self.tmp, "episode.json")
        with open(path, "w") as fh:
            json.dump({"id": "vo-bad", "vo": vo}, fh)
        return path

    def test_line_id_must_be_a_safe_file_name(self):
        path = self.write_episode([{"id": "../escape", "text": "Hello."}])
        code, _out, err = run_main(["--episode", path, "--dry-run"])
        self.assertEqual(code, 2)
        self.assertIn("names a file", err)

    def test_explicit_context_overrides_neighbours(self):
        path = self.write_episode([
            {"id": "a", "text": "One.", "next_text": ""},
            {"id": "b", "text": "Two.", "previous_text": "Earlier, about VWC."},
        ])
        plan = rb.plan_lines(rb.load_episode(path), rb.load_lexicon())
        self.assertIsNone(plan[0]["next_text"])
        self.assertEqual(plan[1]["previous_text"], "Earlier, about V W C.")


class Audio(unittest.TestCase):
    def test_trim_and_level(self):
        y = rb.level(rb.trim(tone()), 10 ** (-20 / 20))
        self.assertAlmostEqual(len(y) / 48000, 1.0 + 2 * 0.06, delta=0.01)
        self.assertAlmostEqual(20 * math.log10(rb.rms(y)), -20.0, delta=0.01)
        self.assertLessEqual(max(abs(v) for v in y), 0.98)
        self.assertEqual(y[0], 0.0)
        self.assertEqual(y[-1], 0.0)

    def test_level_respects_the_peak_ceiling(self):
        y = rb.level(rb.trim(tone()), 0.9)
        self.assertAlmostEqual(max(abs(v) for v in y), 0.98, places=6)

    def test_trim_matches_the_numpy_source(self):
        try:
            import numpy as np
        except ImportError:
            np = None
        if not hasattr(np, "convolve"):
            self.skipTest("numpy not installed; run with the media-root venv ($SA_VIDEO_PYTHON) for the parity check")
        sr = 48000
        x = np.array(tone(seconds=0.8, lead=0.25, tail=0.4, amp=0.2))
        # The iCentral source's trim(), verbatim apart from formatting.
        env = np.convolve(np.abs(x), np.ones(240) / 240, "same")
        on = np.where(env > 10 ** (-45 / 20) * np.abs(x).max())[0]
        i, j = max(0, on[0] - int(0.06 * sr)), min(len(x), on[-1] + int(0.06 * sr))
        ref = x[i:j].copy()
        f = int(0.01 * sr)
        ref[:f] *= np.linspace(0, 1, f)
        ref[-f:] *= np.linspace(1, 0, f)
        ours = rb.trim(list(x))
        self.assertEqual(len(ours), len(ref))
        self.assertLess(max(abs(a - b) for a, b in zip(ours, ref)), 1e-12)

    def test_wav_is_48k_24bit_and_round_trips(self):
        tmp = tempfile.mkdtemp(prefix="sa-vo-wav-")
        try:
            path = os.path.join(tmp, "x.wav")
            src = [0.5, -0.5, 0.25, -1.0, 0.0]
            rb.write_wav24(path, src)
            with wave.open(path) as w:
                self.assertEqual((w.getframerate(), w.getsampwidth(), w.getnchannels(), w.getnframes()),
                                 (48000, 3, 1, 5))
                frames = w.readframes(5)
            back = [int.from_bytes(frames[i:i + 3], "little", signed=True) / 8388608 for i in range(0, 15, 3)]
            for a, b in zip(src, back):
                self.assertAlmostEqual(a, b, places=6)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)



class OutputFormatOverride(unittest.TestCase):
    """SA_VO_OUTPUT_FORMAT: an account below the Creator tier is refused mp3_44100_192, so another MP3 format can be asked for."""

    def load_with(self, value):
        env = {k: v for k, v in os.environ.items() if k != "SA_VO_OUTPUT_FORMAT"}
        if value is not None:
            env["SA_VO_OUTPUT_FORMAT"] = value
        with mock.patch.dict(os.environ, env, clear=True):
            return load_renderer()

    def test_default_is_the_voice_definition(self):
        self.assertEqual(self.load_with(None).OUTPUT_FORMAT, "mp3_44100_192")
        self.assertEqual(self.load_with("").OUTPUT_FORMAT, "mp3_44100_192")

    def test_override_is_used(self):
        self.assertEqual(self.load_with("mp3_44100_128").OUTPUT_FORMAT, "mp3_44100_128")

    def test_anything_else_is_refused(self):
        for bad in ("pcm_44100", "mp3_44100_128&voice=x", "../x"):
            with self.assertRaises(SystemExit):
                self.load_with(bad)

if __name__ == "__main__":
    unittest.main()
