#!/usr/bin/env python3
"""Render an episode's voice-over in the Brian voice (ElevenLabs), from its episode.json.

Ported from the iCentral Double Click renderer, ~/Documents/iCentral_MarCom/double-clicks/01-home/vo/
render-brian.py (read only; that file was modified 2026-10-16 11:42:09 local time when it was ported). Same voice,
model and settings, the same silence trim and the same loudness match to the iCentral Brian masters, so a Spatial
Adjust episode sits at the same level as the iCentral series. What changed in the port:

  - Lines come from the episode's `vo` list instead of a table in the script. Each line is sent with the text of its
    neighbours as previous_text / next_text (or the line's own previous_text / next_text when the episode sets them),
    so the delivery joins up across lines.
  - video/vo/lexicon.json rewrites product terms, station ids and units in the text sent to the API only. The
    written text stays as it is in episode.json, the report and the captions.
  - The API key is resolved in process from the elevenlabs MCP entry in ~/.claude.json at any scope; the source
    hard-coded a single project path. See "The key" below.
  - Everything is written under the media root, never in the repository:
        <media root>/episodes/<id>/vo/<line>.wav          48 kHz, 24-bit, mono, trimmed and levelled
        <media root>/episodes/<id>/vo/raw/<line>.mp3      what the API returned, kept so a re-level costs nothing
        <media root>/episodes/<id>/vo/render-report.json  {lines: [{line, text, seconds, characters, text_hash}]}
    The report keeps the shape the iCentral builder reads (dc_build.py line 22 reads lines[].line and
    lines[].seconds), so the episode builder can place VO against the take's cue log.
  - A line is sent to the API again only when its text_hash changes (or with --force). The hash covers everything
    that changes the audio: the spoken text, its previous_text / next_text, voice, model, settings and format.
  - Every run that talks to the API prints the account's remaining character credits before and after, and appends
    one counts-only row to video/vo/credits-log.md.
  - The audio maths uses only the standard library and ffmpeg, so the script and its tests run on any python3.

The voice settings live in VOICE_CONFIG below, and video/vo/voice-settings.md documents them (a test fails if the two
drift apart). The loudness target is read from voice-settings.md, from the fenced line `rms_target_dbfs: <n>`, which
video/vo/measure_rms.py measured from the iCentral Brian masters.

Usage:
  python3 video/vo/render-brian.py --episode video/episodes/<id>/episode.json [--lines id,id] [--dry-run] [--force]
  npm run video -- vo --episode video/episodes/<id>/episode.json ...

  --dry-run   list each line with its characters and estimated credits; no network call, the key is not read,
              nothing is written.
  --lines     render only these VO line ids (comma-separated); context still comes from the whole episode.
  --force     send the selected lines to the API even when their text_hash is unchanged.

The key. THIS REPOSITORY IS PUBLIC, so a leaked key is a revocation event. _key() reads ~/.claude.json in process
(SA_ELEVENLABS_CONFIG points it at a fixture for tests) and the key goes only into the xi-api-key header of a request
to api.elevenlabs.io. It is never printed, logged, put in an exception message, a URL, a request body, a file, argv
or a child process's environment. The client object that holds it has a repr that hides it, and every error the
client raises is scrubbed of it. Never run this script under a debugger or tracer that dumps locals.

Exit codes: 0 done; 1 a render step failed (API, ffmpeg, file); 2 configuration or usage (bad episode, key not found,
RMS target missing, media root refused).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from array import array

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HERE, "..", "lib"))

import media_root  # noqa: E402  (video/lib/media_root.py)

API_ROOT = "https://api.elevenlabs.io"

# The one voice definition, unchanged from the iCentral renderer. video/vo/voice-settings.md documents every value
# here; test_render_brian.py fails when the two disagree.
VOICE_CONFIG = {
    "voice_id": "Gubgw9l4dtIoQA9YZHgx",  # Brian
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
        "stability": 0.5,
        "similarity_boost": 0.75,
        "style": 0.0,
        "use_speaker_boost": True,
        "speed": 1.0,
    },
    "output_format": "mp3_44100_192",  # what the API returns; converted to the master format below
    "sample_rate_hz": 48000,
    "bit_depth": 24,
    "channels": 1,
    "trim_threshold_db": -45.0,  # relative to the line's peak, on a 240-sample moving average of |x|
    "trim_pad_s": 0.06,
    "fade_s": 0.01,
    "peak_ceiling": 0.98,
}
VOICE = VOICE_CONFIG["voice_id"]
MODEL = VOICE_CONFIG["model_id"]
SETTINGS = VOICE_CONFIG["voice_settings"]
# An account below the Creator tier is refused mp3_44100_192 (HTTP 403 output_format_not_allowed). SA_VO_OUTPUT_FORMAT
# asks for another MP3 format instead (for example mp3_44100_128); unset, the voice definition above is used unchanged.
_FORMAT_OVERRIDE = os.environ.get("SA_VO_OUTPUT_FORMAT", "").strip()
if _FORMAT_OVERRIDE and not re.fullmatch(r"mp3_\d{5}_\d{2,3}", _FORMAT_OVERRIDE):
    raise SystemExit("render-brian: SA_VO_OUTPUT_FORMAT must look like mp3_44100_128")
OUTPUT_FORMAT = _FORMAT_OVERRIDE or VOICE_CONFIG["output_format"]
SR = VOICE_CONFIG["sample_rate_hz"]
TRIM_WINDOW = 240  # samples, as in the source

# ElevenLabs bills eleven_multilingual_v2 at 1 credit per character of `text` (previous_text and next_text are
# context and are not billed). Read from the ElevenLabs pricing documentation on 2026-10-19; the owner should
# confirm it against the account's plan. estimate.py uses the same constant.
CREDITS_PER_CHARACTER = 1.0
# The subscription endpoint can lag a render by a few seconds. After a run that sent text, the after-count is polled
# every SETTLE_STEP_S seconds, for up to SETTLE_S seconds, until the account has counted it.
SETTLE_S = 30.0
SETTLE_STEP_S = 2.0

LEXICON_PATH = os.path.join(HERE, "lexicon.json")
VOICE_SETTINGS_PATH = os.path.join(HERE, "voice-settings.md")
CREDITS_LOG_PATH = os.path.join(HERE, "credits-log.md")
REPORT_NAME = "render-report.json"

CONFIG_ENV = "SA_ELEVENLABS_CONFIG"
KEY_NOT_FOUND = "ElevenLabs key not found in ~/.claude.json elevenlabs MCP entry"
LINE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
RMS_TARGET_KEY = "rms_target_dbfs"

CREDITS_LOG_HEADER = """# ElevenLabs credits log

One row per run of `video/vo/render-brian.py` that talks to the API (every run except `--dry-run`), appended by the
script. Counts only: the date, the episode id, how many lines and characters were sent to the API in that run, and
the account's remaining character credits before and after it, read from `GET /v1/user/subscription`. Nothing else
from the account, and never the key, is ever written here.

| Date | Episode | Lines sent | Characters sent | Credits remaining before -> after |
|---|---|---|---|---|
"""


class ConfigError(Exception):
    """Bad input or configuration. Exit 2."""


class RenderError(Exception):
    """A render step failed. Exit 1."""


class ElevenLabsKeyError(ConfigError):
    """The key could not be resolved. The message names the file only, never a value from it."""


def _rel(path: str) -> str:
    """A repository path relative to the repository root, for messages."""
    try:
        rel = os.path.relpath(path, REPO_ROOT)
    except ValueError:
        return path
    return path if rel.startswith("..") else rel


# ---------------------------------------------------------------------------------------------------------------------
# The key
# ---------------------------------------------------------------------------------------------------------------------

def _config_path() -> str:
    return os.environ.get(CONFIG_ENV) or os.path.join(os.path.expanduser("~"), ".claude.json")


def _key_in(scope) -> str | None:
    node = scope
    for name in ("mcpServers", "elevenlabs", "env", "ELEVENLABS_API_KEY"):
        if not isinstance(node, dict):
            return None
        node = node.get(name)
    if isinstance(node, str) and node.strip():
        return node.strip()
    return None


def _key() -> str:
    """The ElevenLabs API key from the elevenlabs MCP entry in ~/.claude.json (or $SA_ELEVENLABS_CONFIG).

    Looks at mcpServers.elevenlabs.env.ELEVENLABS_API_KEY at the top level (a user-scoped entry) first, then in every
    projects[<path>] (project-scoped entries) in file order, and returns the first one found. Raises
    ElevenLabsKeyError, whose message never contains anything read from the file.
    """
    path = _config_path()
    try:
        with open(path, encoding="utf-8") as fh:
            config = json.load(fh)
    except FileNotFoundError:
        raise ElevenLabsKeyError(KEY_NOT_FOUND) from None
    except ValueError:
        # A JSON error message can quote part of the input, which could be the key. Drop it.
        raise ElevenLabsKeyError(f"{path} is not valid JSON") from None
    except OSError as err:
        raise ElevenLabsKeyError(f"cannot read {path} ({type(err).__name__})") from None
    scopes = [config]
    projects = config.get("projects") if isinstance(config, dict) else None
    if isinstance(projects, dict):
        scopes.extend(projects.values())
    for scope in scopes:
        found = _key_in(scope)
        if found:
            return found
    raise ElevenLabsKeyError(KEY_NOT_FOUND)


# ---------------------------------------------------------------------------------------------------------------------
# The API
# ---------------------------------------------------------------------------------------------------------------------

def _http(url: str, headers: dict, body: bytes | None = None, timeout: float = 120) -> bytes:
    """The only network call the VO step makes. Tests replace this function."""
    req = urllib.request.Request(url, data=body, headers=headers, method="GET" if body is None else "POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _error_detail(err: urllib.error.HTTPError) -> str:
    try:
        raw = err.read(2000)
    except Exception:  # noqa: BLE001 - the detail is a courtesy; the status code is what matters
        return ""
    try:
        detail = json.loads(raw).get("detail")
    except (ValueError, AttributeError):
        return raw.decode("utf-8", "replace").strip()[:300]
    if isinstance(detail, dict):
        return " ".join(str(detail.get(k, "")) for k in ("status", "message")).strip()[:300]
    return str(detail)[:300] if detail else ""


class ElevenLabs:
    """Holds the key for one run. Its repr hides the key, and every error it raises has the key scrubbed out."""

    __slots__ = ("_secret",)

    def __init__(self, secret: str):
        self._secret = secret

    def __repr__(self) -> str:
        return "ElevenLabs(key=<hidden>)"

    __str__ = __repr__

    def scrub(self, text: str) -> str:
        return text.replace(self._secret, "[redacted]") if self._secret else text

    def _call(self, path: str, body: dict | None = None) -> bytes:
        endpoint = path.split("?", 1)[0]
        headers = {"xi-api-key": self._secret}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        try:
            return _http(API_ROOT + path, headers, data)
        except urllib.error.HTTPError as err:
            detail = _error_detail(err)
            msg = f"ElevenLabs {endpoint} failed: HTTP {err.code}" + (f" ({detail})" if detail else "")
        except (urllib.error.URLError, OSError) as err:
            reason = getattr(err, "reason", None) or type(err).__name__
            msg = f"ElevenLabs {endpoint} failed: {reason}"
        raise RenderError(self.scrub(msg))

    def remaining(self) -> tuple[int, int]:
        """(characters remaining, character limit) for the account: counts only."""
        try:
            data = json.loads(self._call("/v1/user/subscription"))
            used, limit = int(data["character_count"]), int(data["character_limit"])
        except (ValueError, KeyError, TypeError):
            raise RenderError("ElevenLabs /v1/user/subscription returned no character counts") from None
        return limit - used, limit

    def speech(self, text: str, previous_text: str | None, next_text: str | None) -> bytes:
        body = {"text": text, "model_id": MODEL, "voice_settings": SETTINGS}
        if previous_text:
            body["previous_text"] = previous_text
        if next_text:
            body["next_text"] = next_text
        audio = self._call(f"/v1/text-to-speech/{VOICE}?output_format={OUTPUT_FORMAT}", body)
        if not audio:
            raise RenderError("ElevenLabs returned no audio")
        return audio


# ---------------------------------------------------------------------------------------------------------------------
# Lexicon
# ---------------------------------------------------------------------------------------------------------------------

_WORD = "A-Za-z0-9"


def load_lexicon(path: str | None = None) -> list[tuple[re.Pattern, object]]:
    """video/vo/lexicon.json as compiled (pattern, replacement) pairs, in file order.

    The file is a JSON list of {written, spoken, note} entries. A plain entry matches `written` as a whole word,
    case-sensitive. An entry with "regex": true treats `written` as a Python regular expression and `spoken` as a
    template in which $1 to $9 are the capture groups.
    """
    path = path or LEXICON_PATH
    try:
        with open(path, encoding="utf-8") as fh:
            entries = json.load(fh)
    except FileNotFoundError:
        raise ConfigError(f"lexicon not found: {_rel(path)}") from None
    except ValueError as err:
        raise ConfigError(f"{_rel(path)} is not valid JSON ({err})") from None
    if not isinstance(entries, list):
        raise ConfigError(f"{_rel(path)} must be a JSON list of {{written, spoken, note}} entries")
    compiled = []
    for n, entry in enumerate(entries, 1):
        if not isinstance(entry, dict) or not all(isinstance(entry.get(k), str) for k in ("written", "spoken", "note")):
            raise ConfigError(f"{_rel(path)} entry {n} needs string fields written, spoken and note")
        if not entry["written"]:
            raise ConfigError(f"{_rel(path)} entry {n} has an empty written form")
        spoken = entry["spoken"]
        if entry.get("regex"):
            try:
                pattern = re.compile(entry["written"])
            except re.error as err:
                raise ConfigError(f"{_rel(path)} entry {n} is not a valid regular expression ({err})") from None

            def repl(m, template=spoken):
                return re.sub(r"\$(\d)", lambda g: m.group(int(g.group(1))) or "", template)
        else:
            pattern = re.compile(rf"(?<![{_WORD}]){re.escape(entry['written'])}(?![{_WORD}])")

            def repl(_m, template=spoken):
                return template
        compiled.append((pattern, repl))
    return compiled


def apply_lexicon(text: str, lexicon) -> str:
    """The text to send to the API. The caller's text is not changed."""
    for pattern, repl in lexicon:
        text = pattern.sub(repl, text)
    return text


# ---------------------------------------------------------------------------------------------------------------------
# Voice settings and the loudness target
# ---------------------------------------------------------------------------------------------------------------------

def read_fenced_settings(path: str | None = None) -> dict[str, str]:
    """`key: value` lines inside fenced code blocks of voice-settings.md, as strings."""
    path = path or VOICE_SETTINGS_PATH
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    values: dict[str, str] = {}
    fenced = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            fenced = not fenced
            continue
        if fenced:
            m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$", line)
            if m:
                values.setdefault(m.group(1), m.group(2))
    return values


def read_rms_target(path: str | None = None) -> float:
    """The loudness target in dBFS, from the fenced `rms_target_dbfs: <n>` line in video/vo/voice-settings.md."""
    path = path or VOICE_SETTINGS_PATH
    how = (f"{_rel(path)} needs a fenced line '{RMS_TARGET_KEY}: <n>'; measure it with "
           "python3 video/vo/measure_rms.py and record it there")
    try:
        raw = read_fenced_settings(path).get(RMS_TARGET_KEY)
    except FileNotFoundError:
        raise ConfigError(f"RMS target missing: {_rel(path)} not found; {how}") from None
    if raw is None:
        raise ConfigError(f"RMS target missing: {how}")
    try:
        value = float(raw)
    except ValueError:
        raise ConfigError(f"RMS target in {_rel(path)} is not a number: {raw!r}") from None
    if not math.isfinite(value) or not -60.0 < value < 0.0:
        raise ConfigError(f"RMS target in {_rel(path)} must be a dBFS value between -60 and 0, got {raw}")
    return value


# ---------------------------------------------------------------------------------------------------------------------
# Episode
# ---------------------------------------------------------------------------------------------------------------------

def load_episode(path: str) -> dict:
    """The parts of episode.json this script needs, checked. The full schema check is
    node video/lib/episode-schema.mjs <episode.json>."""
    try:
        with open(path, encoding="utf-8") as fh:
            episode = json.load(fh)
    except FileNotFoundError:
        raise ConfigError(f"episode not found: {path}") from None
    except ValueError as err:
        raise ConfigError(f"{path} is not valid JSON ({err})") from None
    if not isinstance(episode, dict):
        raise ConfigError(f"{path}: an episode is a JSON object")
    eid = episode.get("id")
    if not isinstance(eid, str) or not media_root.EPISODE_ID.match(eid):
        raise ConfigError(f"{path}: id must match {media_root.EPISODE_ID.pattern}")
    vo = episode.get("vo")
    if not isinstance(vo, list) or not vo:
        raise ConfigError(f"{path}: the episode has no vo lines")
    seen = set()
    for n, line in enumerate(vo, 1):
        if not isinstance(line, dict):
            raise ConfigError(f"{path}: vo line {n} is not an object")
        lid = line.get("id")
        if not isinstance(lid, str) or not LINE_ID.match(lid):
            raise ConfigError(f"{path}: vo line {n} id must match {LINE_ID.pattern} (it names a file)")
        if lid in seen:
            raise ConfigError(f"{path}: vo line id {lid} is used twice")
        seen.add(lid)
        if not isinstance(line.get("text"), str) or not line["text"].strip():
            raise ConfigError(f"{path}: vo line {lid} has no text")
        for k in ("previous_text", "next_text"):
            if k in line and not isinstance(line[k], str):
                raise ConfigError(f"{path}: vo line {lid} {k} must be a string")
    return episode


def text_hash(spoken: str, previous_text: str | None, next_text: str | None) -> str:
    """Changes whenever anything that changes the rendered audio changes."""
    payload = json.dumps(
        {"text": spoken, "previous_text": previous_text, "next_text": next_text, "voice_id": VOICE,
         "model_id": MODEL, "voice_settings": SETTINGS, "output_format": OUTPUT_FORMAT},
        sort_keys=True, ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def plan_lines(episode: dict, lexicon) -> list[dict]:
    """One entry per VO line, in episode order: written text, spoken text, context, characters, hash."""
    vo = episode["vo"]
    plan = []
    for i, line in enumerate(vo):
        prev = line["previous_text"] if "previous_text" in line else (vo[i - 1]["text"] if i else None)
        nxt = line["next_text"] if "next_text" in line else (vo[i + 1]["text"] if i + 1 < len(vo) else None)
        spoken = apply_lexicon(line["text"], lexicon)
        prev_spoken = apply_lexicon(prev, lexicon) if prev else None
        next_spoken = apply_lexicon(nxt, lexicon) if nxt else None
        plan.append({
            "line": line["id"],
            "text": line["text"],
            "spoken": spoken,
            "previous_text": prev_spoken,
            "next_text": next_spoken,
            "characters": len(spoken),
            "text_hash": text_hash(spoken, prev_spoken, next_spoken),
        })
    return plan


def select(plan: list[dict], lines_arg: str | None) -> list[dict]:
    if not lines_arg:
        return plan
    wanted = [s.strip() for s in lines_arg.split(",") if s.strip()]
    known = {p["line"] for p in plan}
    unknown = [w for w in wanted if w not in known]
    if unknown:
        raise ConfigError(f"--lines names ids that are not in the episode: {', '.join(unknown)}")
    return [p for p in plan if p["line"] in wanted]


def _lines(n: int) -> str:
    return f"{n} line" if n == 1 else f"{n} lines"


def credits_for(characters: int) -> float:
    return characters * CREDITS_PER_CHARACTER


# ---------------------------------------------------------------------------------------------------------------------
# Audio: decode, trim, level, write. Standard library only, plus ffmpeg for the MP3 decode.
# ---------------------------------------------------------------------------------------------------------------------

def _child_env() -> dict:
    """Environment for child processes, without any ElevenLabs variable a shell may have exported."""
    return {k: v for k, v in os.environ.items() if "ELEVENLABS" not in k.upper() and "XI_API" not in k.upper()}


def decode(path: str) -> list[float]:
    """Decode an audio file to 48 kHz mono floats with ffmpeg, as the source does."""
    try:
        res = subprocess.run(
            ["ffmpeg", "-v", "error", "-nostdin", "-i", path, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"],
            capture_output=True, env=_child_env(), check=False,
        )
    except FileNotFoundError:
        raise RenderError("ffmpeg not found on PATH (brew install ffmpeg)") from None
    if res.returncode != 0:
        tail = res.stderr.decode("utf-8", "replace").strip().splitlines()[-1:] or ["no detail"]
        raise RenderError(f"ffmpeg could not decode {path}: {tail[0]}")
    buf = res.stdout[: len(res.stdout) - len(res.stdout) % 4]
    samples = array("f")
    samples.frombytes(buf)
    if sys.byteorder == "big":
        samples.byteswap()
    return samples.tolist()


def rms(x: list[float]) -> float:
    return math.sqrt(math.fsum(v * v for v in x) / len(x)) if x else 0.0


def trim(x: list[float], thr_db: float = VOICE_CONFIG["trim_threshold_db"], pad_s: float = VOICE_CONFIG["trim_pad_s"],
         fade_s: float = VOICE_CONFIG["fade_s"], sr: int = SR) -> list[float]:
    """Cut leading and trailing silence, as the source's trim(): a 240-sample moving average of |x| (centred, like
    numpy.convolve mode 'same') against thr_db below the peak, padded by pad_s, with fade_s linear fades."""
    n = len(x)
    if n == 0:
        raise RenderError("the decoded audio is empty")
    ax = [abs(v) for v in x]
    peak = max(ax)
    if peak <= 0.0:
        raise RenderError("the decoded audio is silent")
    prefix = [0.0] * (n + 1)
    total = 0.0
    for i, v in enumerate(ax):
        total += v
        prefix[i + 1] = total
    half = TRIM_WINDOW // 2
    threshold = 10 ** (thr_db / 20) * peak * TRIM_WINDOW  # compare window sums, not means

    def loud(i: int) -> bool:
        return prefix[min(n, i + half)] - prefix[max(0, i - half)] > threshold

    first = next((i for i in range(n) if loud(i)), None)
    if first is None:
        raise RenderError(f"no sound above the {thr_db:g} dB trim threshold")
    last = next(i for i in range(n - 1, -1, -1) if loud(i))
    pad = int(pad_s * sr)
    y = x[max(0, first - pad): min(n, last + pad)]
    f = int(fade_s * sr)
    if f > 1 and len(y) >= 2 * f:
        for k in range(f):
            ramp = k / (f - 1)
            y[k] *= ramp
            y[len(y) - f + k] *= 1.0 - ramp
    return y


def level(y: list[float], target_rms: float, ceiling: float = VOICE_CONFIG["peak_ceiling"]) -> list[float]:
    """Scale to the target RMS, then pull the peak down to the ceiling if it went over (as the source does)."""
    current = rms(y)
    if current <= 0.0:
        raise RenderError("cannot level silent audio")
    gain = target_rms / current
    y = [v * gain for v in y]
    peak = max(abs(v) for v in y)
    if peak > ceiling:
        y = [v * (ceiling / peak) for v in y]
    return y


def write_wav24(path: str, y: list[float], sr: int = SR) -> None:
    """Write mono 24-bit PCM WAV, atomically (a .part file beside the target, then a rename)."""
    ints = array("i", (max(-8388608, min(8388607, int(round(v * 8388608.0)))) for v in y))
    if ints.itemsize != 4:
        raise RenderError("unexpected C int size; cannot pack 24-bit samples")
    if sys.byteorder == "big":
        ints.byteswap()
    b = ints.tobytes()
    out = bytearray(len(ints) * 3)
    out[0::3] = b[0::4]
    out[1::3] = b[1::4]
    out[2::3] = b[2::4]
    tmp = path + ".part"
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(3)
        w.setframerate(sr)
        w.writeframes(bytes(out))
    os.replace(tmp, path)


def _write_bytes(path: str, data: bytes) -> None:
    tmp = path + ".part"
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, path)


def _write_json(path: str, obj) -> None:
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, path)


# ---------------------------------------------------------------------------------------------------------------------
# Output locations, report and credits log
# ---------------------------------------------------------------------------------------------------------------------

def episode_vo_dir(episode_id: str, *parts: str) -> str:
    """<media root>/episodes/<id>/vo[/parts], created; refused under /tmp, a scratchpad or a git tree
    (video/lib/media_root.py)."""
    return media_root.episode_dir(episode_id, "vo", *parts)


def _existing_report(vo_dir: str) -> dict:
    try:
        with open(os.path.join(vo_dir, REPORT_NAME), encoding="utf-8") as fh:
            report = json.load(fh)
        return report if isinstance(report, dict) else {}
    except (FileNotFoundError, ValueError):
        return {}


def _report_entries(report: dict) -> dict[str, dict]:
    lines = report.get("lines") if isinstance(report.get("lines"), list) else []
    return {e["line"]: e for e in lines if isinstance(e, dict) and isinstance(e.get("line"), str)}


def build_report(episode_id: str, plan: list[dict], entries: dict[str, dict], rms_target: float) -> dict:
    return {
        "episode": episode_id,
        "voice": VOICE,
        "model": MODEL,
        "settings": SETTINGS,
        "output_format": OUTPUT_FORMAT,
        "sample_rate": SR,
        "bit_depth": VOICE_CONFIG["bit_depth"],
        "trim_threshold_db": VOICE_CONFIG["trim_threshold_db"],
        RMS_TARGET_KEY: rms_target,
        "lines": [entries[p["line"]] for p in plan if p["line"] in entries],
    }


def append_credits_log(episode_id: str, lines_sent: int, characters_sent: int, before, after) -> str:
    """Append one counts-only row to video/vo/credits-log.md (created with its header if missing)."""
    path = CREDITS_LOG_PATH
    when = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    row = f"| {when} | {episode_id} | {int(lines_sent)} | {int(characters_sent)} | {_count(before)} -> {_count(after)} |\n"
    existing = ""
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            existing = fh.read()
    with open(path, "a", encoding="utf-8") as fh:
        if not existing.strip():
            fh.write(CREDITS_LOG_HEADER)
        elif not existing.endswith("\n"):
            fh.write("\n")
        fh.write(row)
    return path


def _count(value) -> str:
    return str(int(value)) if isinstance(value, (int, float)) else "unknown"


# ---------------------------------------------------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------------------------------------------------

def dry_run(episode: dict, plan: list[dict], chosen: list[dict]) -> int:
    eid = episode["id"]
    entries: dict[str, dict] = {}
    where = None
    try:
        where = os.path.join(media_root.media_root(), "episodes", eid, "vo")
        entries = _report_entries(_existing_report(where))
    except media_root.MediaRootError as err:
        where = f"(media root refused: {err})"
    print(f"Episode {eid}: {_lines(len(plan))} of VO; voice Brian ({VOICE}), model {MODEL}")
    print(f"Output: {where}")
    print(f"Dry run: no API call, the key is not read, nothing is written. {CREDITS_PER_CHARACTER:g} credit per character.")
    print()
    width = max(len("line"), *(len(p["line"]) for p in chosen))
    print(f"{'line'.ljust(width)}  {'chars':>6}  {'credits':>8}  status")
    to_render = []
    for p in chosen:
        old = entries.get(p["line"])
        if old is None:
            status = "new"
        elif old.get("text_hash") == p["text_hash"]:
            status = "unchanged (skipped without --force)"
        else:
            status = "changed"
        if not status.startswith("unchanged"):
            to_render.append(p)
        print(f"{p['line'].ljust(width)}  {p['characters']:>6}  {credits_for(p['characters']):>8g}  {status}")
        if p["spoken"] != p["text"]:
            print(f"{''.ljust(width)}  spoken: {p['spoken']}")
    chars_all = sum(p["characters"] for p in chosen)
    chars_new = sum(p["characters"] for p in to_render)
    print()
    print(f"{'total'.ljust(width)}  {chars_all:>6}  {credits_for(chars_all):>8g}  {_lines(len(chosen))}")
    print(f"Would send {_lines(len(to_render))}, {chars_new} characters, about {credits_for(chars_new):g} credits "
          f"(with --force: {_lines(len(chosen))}, {credits_for(chars_all):g} credits).")
    return 0


def _credits_after(api: ElevenLabs, before: int, sent_chars: int):
    """Remaining credits after the run, waiting up to SETTLE_S for the account to count what was sent."""
    deadline = time.monotonic() + (SETTLE_S if sent_chars else 0.0)
    while True:
        try:
            after, _limit = api.remaining()
        except RenderError as err:
            print(f"render-brian: could not read credits after the run: {err}", file=sys.stderr)
            return None
        if after != before or time.monotonic() >= deadline:
            return after
        time.sleep(SETTLE_STEP_S)


def render(episode: dict, plan: list[dict], chosen: list[dict], force: bool, ctx: dict) -> int:
    eid = episode["id"]
    rms_target_dbfs = read_rms_target()
    target = 10 ** (rms_target_dbfs / 20)
    api = ElevenLabs(_key())
    ctx["api"] = api
    vo_dir = episode_vo_dir(eid)
    raw_dir = episode_vo_dir(eid, "raw")
    old_report = _existing_report(vo_dir)
    entries = _report_entries(old_report)
    same_level = old_report.get(RMS_TARGET_KEY) == rms_target_dbfs

    # Decide every line first, so the credit check below covers the whole run before anything is sent.
    jobs = []
    for p in chosen:
        lid = p["line"]
        wav_path = os.path.join(vo_dir, f"{lid}.wav")
        raw_path = os.path.join(raw_dir, f"{lid}.mp3")
        old = entries.get(lid)
        unchanged = bool(old) and old.get("text_hash") == p["text_hash"] and os.path.exists(raw_path)
        if unchanged and not force and os.path.exists(wav_path) and same_level:
            action = "skip"
        elif unchanged and not force:
            action = "relevel"
        else:
            action = "render"
        jobs.append((p, action, wav_path, raw_path))
    needed = credits_for(sum(p["characters"] for p, action, _w, _r in jobs if action == "render"))

    before, limit = api.remaining()
    print(f"credits before: {before} characters remaining (limit {limit})")
    if needed > before:
        raise RenderError(f"not enough credits: this run needs about {needed:g} and {before} remain; nothing was sent")

    sent_lines = sent_chars = 0
    failure: BaseException | None = None
    try:
        for p, action, wav_path, raw_path in jobs:
            lid = p["line"]
            if action == "skip":
                print(f"{lid}: unchanged, skipped ({entries[lid].get('seconds')} s)")
                continue
            if action == "relevel":
                action = "re-levelled from the saved take"
            else:
                _write_bytes(raw_path, api.speech(p["spoken"], p["previous_text"], p["next_text"]))
                sent_lines += 1
                sent_chars += p["characters"]
                action = "rendered"
            y = level(trim(decode(raw_path)), target)
            write_wav24(wav_path, y)
            seconds = round(len(y) / SR, 2)
            entries[lid] = {"line": lid, "text": p["text"], "seconds": seconds, "characters": p["characters"],
                            "text_hash": p["text_hash"]}
            print(f"{lid}: {action}, {seconds} s, {p['characters']} characters")
    except BaseException as err:  # noqa: BLE001 - finish the report and the credits row, then re-raise
        failure = err
    finally:
        report_path = os.path.join(vo_dir, REPORT_NAME)
        _write_json(report_path, build_report(eid, plan, entries, rms_target_dbfs))
        after = _credits_after(api, before, sent_chars)
        if after is None:
            used = ""
        elif sent_chars and after == before:
            used = " (the account had not counted this run yet; check again with estimate.py --live)"
        else:
            used = f" (this run used {before - after})"
        print(f"credits after: {_count(after)} characters remaining{used}")
        log = append_credits_log(eid, sent_lines, sent_chars, before, after)
        print(f"report: {report_path}")
        print(f"credits log: {_rel(log)}")
    if failure is not None:
        raise failure
    return 0


def parse_args(argv):
    ap = argparse.ArgumentParser(prog="render-brian.py",
                                 description="Render an episode's VO in the Brian voice (ElevenLabs).")
    ap.add_argument("--episode", required=True, help="path to the episode.json")
    ap.add_argument("--lines", help="comma-separated VO line ids to render (default: all)")
    ap.add_argument("--dry-run", action="store_true", help="list lines, characters and credits; no network call")
    ap.add_argument("--force", action="store_true", help="re-render lines even when their text_hash is unchanged")
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    ctx: dict = {}

    def scrubbed(err: BaseException) -> str:
        text = str(err)
        api = ctx.get("api")
        return api.scrub(text) if api else text

    try:
        episode = load_episode(args.episode)
        lexicon = load_lexicon()
        plan = plan_lines(episode, lexicon)
        chosen = select(plan, args.lines)
        if args.dry_run:
            return dry_run(episode, plan, chosen)
        return render(episode, plan, chosen, args.force, ctx)
    except (ConfigError, media_root.MediaRootError) as err:
        print(f"render-brian: {scrubbed(err)}", file=sys.stderr)
        return 2
    except RenderError as err:
        print(f"render-brian: {scrubbed(err)}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("render-brian: interrupted", file=sys.stderr)
        return 130
    except Exception as err:  # noqa: BLE001 - never let a traceback print anything unscrubbed
        print(f"render-brian: unexpected {type(err).__name__}: {scrubbed(err)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
