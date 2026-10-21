#!/usr/bin/env python3
"""Whisper round-trip for the showcase narration: transcribe the VO stem (or a mix), score each scripted line.

The showcase's intelligibility check. It transcribes an audio file on this machine with OpenAI Whisper, cuts the
transcript into the episode's VO lines by their windows, and scores every line against its written text:

  - word error rate (WER), a word-level Levenshtein distance over the scripted words, after both sides are
    normalised (lower case, no punctuation, number words, British and American spellings, spelled-out letters);
  - required terms: every scripted TurfRad, Lynx and IntelliDash must come back. TurfRad is accepted as "TurfRad" or
    "Turf Rad", IntelliDash as "IntelliDash" or "Intelli Dash", and Lynx as "Lynx" or its homophone "links" (the
    report counts the homophones). A missing term, or one Whisper writes as something else ("lunks"), fails.

A line passes when its WER is at most --max-wer (0.2) and every required term in it is heard. The run passes when every
line passes. Words heard outside every window are listed in the report but do not fail it.

Lynx and "links" sound the same, so no recording can make Whisper choose between them by ear (on the 2026-10-20 stem
both small.en and medium.en wrote "links", with the film's vocabulary as the prompt). The renderer sends "Links" for
Lynx, so "links" is the sound that was asked for, and the check accepts it as the homophone and counts them in the
report; whether Brian's "links" is the right word is judged by ear at the voice gate. Whisper is given the film's
vocabulary as its initial prompt (the required terms and every lexicon term the script uses, in their written form),
the way a viewer who knows the product hears the narration; the prompt is recorded in the report. What the check then
proves is that Brian says each term recognisably, in the right place, inside the window it was timed for.

Before anything is transcribed, each line's ttsText in episode.json is compared with the text video/vo/render-brian.py
sends, which is the line's text with video/vo/lexicon.json applied. They must be equal: ttsText is a record of the
renderer's input, and a stale one would describe audio that was never rendered. The renderer is imported, not copied.

Windows are seconds of the finished film (windowIn, windowOut on each vo[] line), shifted by --offset when the audio
does not start at 0:00 of the film. A word belongs to a line when its timestamps overlap windowIn - 0.3 s to
windowOut + 0.5 s; where two lines' margins overlap, the word goes to the line whose window it overlaps most.

Usage (in the media-root venv, which has openai-whisper; see video/showcase/README.md):
  $SA_VIDEO_PYTHON video/showcase/whisper-roundtrip.py \\
      --audio ~/Documents/SpatialAdjust_MarCom/showcase/vo/showcase-vo-full-48k24.wav \\
      --episode video/showcase/episode.json \\
      --out ~/Documents/SpatialAdjust_MarCom/showcase/vo/whisper-report.json [--model small.en] [--offset 0]

The audio never leaves this machine. The only network access is Whisper's one-time model download into
~/.cache/whisper when the model is not there yet. The report goes under the media root: a path in /tmp, an agent
scratchpad or this repository is refused.

Exit codes: 0 every line passes; 1 a line fails; 2 configuration or usage (bad episode, ttsText out of date, Whisper
not installed, audio missing, report path refused).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(REPO_ROOT, "video", "lib"))

import media_root  # noqa: E402  (video/lib/media_root.py: the report path guard)

RENDERER = os.path.join(REPO_ROOT, "video", "vo", "render-brian.py")
DEFAULT_MODEL = "small.en"
MAX_WER = 0.2
LEAD_S = 0.3   # a line's words may start this long before windowIn
TAIL_S = 0.5   # and end this long after windowOut

# Required terms: written form -> the normalised spellings accepted in the transcript.
REQUIRED = {
    "TurfRad": ("turfrad",),
    "Lynx": ("lynx", "links"),  # homophones: see the module docstring. "lynx" first, so it counts as the exact form
    "IntelliDash": ("intellidash",),
}
# Multi-word spellings Whisper may use, joined into one token on both sides before scoring. "links" is never joined
# into "lynx" by the normaliser (so the word error rate still counts it as a miss); the Lynx check accepts it instead,
# as a homophone, and the report says how many were heard that way.
JOIN = {
    ("turf", "rad"): "turfrad",
    ("intelli", "dash"): "intellidash",
    ("intel", "dash"): "intellidash",
    ("intelly", "dash"): "intellidash",
}
# British and American spellings, scored as the same word (Whisper's English models write American spelling).
SPELLING = {
    "colour": "color", "colours": "colors", "coloured": "colored", "colouring": "coloring",
    "synchronise": "synchronize", "synchronised": "synchronized", "synchronisation": "synchronization",
    "metres": "meters", "metre": "meter", "millimetres": "millimeters", "millimetre": "millimeter",
    "programme": "program", "programmes": "programs", "centre": "center", "behaviour": "behavior",
}
NUMBER_WORDS = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
    "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen", "14": "fourteen",
    "15": "fifteen", "16": "sixteen", "17": "seventeen", "18": "eighteen", "19": "nineteen", "20": "twenty",
    "30": "thirty", "40": "forty", "50": "fifty", "60": "sixty", "70": "seventy", "80": "eighty", "90": "ninety",
    "100": "hundred",
}


class ConfigError(Exception):
    """Bad input or configuration. Exit 2."""


# ---------------------------------------------------------------------------------------------------------------------
# Text
# ---------------------------------------------------------------------------------------------------------------------

def normalise(text: str) -> list[str]:
    """Words for scoring: lower case, no punctuation, digits as words, one spelling, spelled-out letters joined."""
    t = text.lower()
    t = t.replace("%", " percent ")
    t = re.sub(r"[‘’']", "", t)          # station's -> stations, you're -> youre
    t = re.sub(r"[^a-z0-9]+", " ", t)                # hyphens, commas, full stops (v.w.c -> v w c), semicolons
    t = re.sub(r"(?<=[0-9])(?=[a-z])|(?<=[a-z])(?=[0-9])", " ", t)  # 10mm -> 10 mm, ap1 -> ap 1
    words = []
    for w in t.split():
        w = NUMBER_WORDS.get(w, w)
        words.append(SPELLING.get(w, w))
    # Join known multi-word spellings, then runs of single letters ("v w c" -> "vwc", "e t" -> "et").
    out: list[str] = []
    i = 0
    while i < len(words):
        pair = tuple(words[i:i + 2])
        if len(pair) == 2 and pair in JOIN:
            out.append(JOIN[pair])
            i += 2
            continue
        if len(words[i]) == 1 and words[i] not in ("a", "i") and i + 1 < len(words) and len(words[i + 1]) == 1:
            j = i
            while j < len(words) and len(words[j]) == 1:
                j += 1
            out.append("".join(words[i:j]))
            i = j
            continue
        out.append(words[i])
        i += 1
    return out


def edit_distance(ref: list[str], hyp: list[str]) -> int:
    """Word-level Levenshtein distance: substitutions, insertions and deletions each cost 1."""
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        cur = [i] + [0] * len(hyp)
        for j, h in enumerate(hyp, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h))
        prev = cur
    return prev[-1]


def wer(ref: list[str], hyp: list[str]) -> float:
    if not ref:
        return 0.0 if not hyp else 1.0
    return edit_distance(ref, hyp) / len(ref)


def required_terms(script: str, heard_words: list[str]) -> dict:
    """For every required term in the written line: how often it is scripted and how often it was heard."""
    out = {}
    for term, accepted in REQUIRED.items():
        scripted = len(re.findall(rf"\b{re.escape(term)}\b", script))
        if not scripted:
            continue
        heard = sum(1 for w in heard_words if w in accepted)
        exact = sum(1 for w in heard_words if w == accepted[0])
        out[term] = {"scripted": scripted, "heard": heard, "homophone": heard - exact, "ok": heard >= scripted}
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Episode and renderer
# ---------------------------------------------------------------------------------------------------------------------

def load_renderer():
    """video/vo/render-brian.py as a module, for its lexicon functions. Importing it reads no key."""
    spec = importlib.util.spec_from_file_location("render_brian", RENDERER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_lines(path: str) -> tuple[dict, list[dict]]:
    try:
        with open(path, encoding="utf-8") as fh:
            ep = json.load(fh)
    except (OSError, ValueError) as err:
        raise ConfigError(f"cannot read episode {path}: {type(err).__name__}") from None
    lines = ep.get("vo") if isinstance(ep, dict) else None
    if not isinstance(lines, list) or not lines:
        raise ConfigError(f"{path}: vo[] is empty")
    for line in lines:
        lid = line.get("id")
        if not isinstance(line.get("text"), str) or not line["text"].strip():
            raise ConfigError(f"{path}: vo line {lid!r} has no text")
        w0, w1 = line.get("windowIn"), line.get("windowOut")
        if not all(isinstance(v, (int, float)) for v in (w0, w1)) or not w0 < w1:
            raise ConfigError(f"{path}: vo line {lid!r} needs numeric windowIn < windowOut")
    return ep, lines


def check_tts(lines: list[dict], renderer=None) -> list[str]:
    """Lines whose ttsText is missing or differs from the renderer's lexicon output."""
    rb = renderer or load_renderer()
    lexicon = rb.load_lexicon()
    stale = []
    for line in lines:
        if line.get("ttsText") != rb.apply_lexicon(line["text"], lexicon):
            stale.append(line["id"])
    return stale


def vocabulary_prompt(lines: list[dict], renderer=None) -> str:
    """The film's vocabulary in written form: the required terms and every lexicon term the script uses."""
    rb = renderer or load_renderer()
    with open(rb.LEXICON_PATH, encoding="utf-8") as fh:
        entries = json.load(fh)
    script = " ".join(line["text"] for line in lines)
    terms = []
    for term in ["Spatial Adjust", *REQUIRED]:
        if term in script and term not in terms:
            terms.append(term)
    for e in entries:
        w = e.get("written", "")
        if not e.get("regex") and re.search(rf"\b{re.escape(w)}\b", script) and w not in terms:
            terms.append(w)
    return ", ".join(terms) + "."


# ---------------------------------------------------------------------------------------------------------------------
# Assigning transcript words to lines
# ---------------------------------------------------------------------------------------------------------------------

def assign(words: list[dict], lines: list[dict], offset: float = 0.0) -> tuple[dict[str, list[dict]], list[dict]]:
    """Each heard word ({word, start, end}, audio seconds) to at most one line.

    A word is a candidate for every line whose window, widened by LEAD_S before and TAIL_S after, it overlaps. It goes
    to the candidate whose own window it overlaps most, then to the one whose widened window it overlaps most. Going by
    overlap rather than by the word's start keeps the first word after a long silence, which Whisper often stamps from
    the start of the silence, with the line it belongs to.
    """
    by_line: dict[str, list[dict]] = {line["id"]: [] for line in lines}
    outside = []
    for w in words:
        a, b = w["start"] - offset, max(w["end"], w["start"]) - offset
        best, best_key = None, None
        for line in lines:
            w0, w1 = line["windowIn"], line["windowOut"]
            wide = min(b, w1 + TAIL_S) - max(a, w0 - LEAD_S)
            if wide < 0 or (wide == 0 and not (w0 - LEAD_S <= a <= w1 + TAIL_S)):
                continue
            key = (max(0.0, min(b, w1) - max(a, w0)), wide)
            if best is None or key > best_key:
                best, best_key = line["id"], key
        (by_line[best] if best else outside).append(w)
    return by_line, outside


def score(lines: list[dict], by_line: dict[str, list[dict]], max_wer: float = MAX_WER) -> list[dict]:
    rows = []
    for line in lines:
        heard_text = " ".join(w["word"].strip() for w in by_line.get(line["id"], [])).strip()
        ref, hyp = normalise(line["text"]), normalise(heard_text)
        terms = required_terms(line["text"], hyp)
        e = wer(ref, hyp)
        rows.append({
            "id": line["id"],
            "line": line.get("line"),
            "windowIn": line["windowIn"],
            "windowOut": line["windowOut"],
            "script": line["text"],
            "heard": heard_text,
            "wer": round(e, 4),
            "requiredTerms": terms,
            "pass": e <= max_wer and all(t["ok"] for t in terms.values()),
        })
    return rows


# ---------------------------------------------------------------------------------------------------------------------
# Whisper
# ---------------------------------------------------------------------------------------------------------------------

def transcribe(audio: str, model_name: str, prompt: str) -> tuple[list[dict], str, str]:
    """Word timestamps from Whisper, on this machine. Returns (words, full text, whisper version)."""
    try:
        import whisper  # openai-whisper, installed in the media-root venv
    except ImportError:
        raise ConfigError(
            "openai-whisper is not installed in this Python. Run the script with the media-root venv "
            "($SA_VIDEO_PYTHON, ~/Documents/SpatialAdjust_MarCom/.venv/bin/python), or install it there with "
            "~/Documents/SpatialAdjust_MarCom/.venv/bin/pip install openai-whisper") from None
    model = whisper.load_model(model_name)
    result = model.transcribe(audio, language="en", word_timestamps=True, initial_prompt=prompt, temperature=0.0,
                              condition_on_previous_text=False, fp16=False, verbose=None)
    words = [{"word": w["word"], "start": float(w["start"]), "end": float(w["end"])}
             for seg in result.get("segments", []) for w in seg.get("words", [])]
    return words, result.get("text", "").strip(), getattr(whisper, "__version__", "unknown")


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _rel(path: str) -> str:
    rel = os.path.relpath(path, REPO_ROOT)
    return path if rel.startswith("..") else rel


def print_summary(rows: list[dict], outside: list[dict]) -> None:
    for r in rows:
        terms = ", ".join(f"{t} {v['heard']}/{v['scripted']}" + (f" ({v['homophone']} as homophone)" if v["homophone"] else "")
                          for t, v in r["requiredTerms"].items())
        mark = "PASS" if r["pass"] else "FAIL"
        print(f"{mark}  {r['line'] or r['id']:<4} {r['id']:<18} WER {r['wer']:.3f}" + (f"  [{terms}]" if terms else ""))
        print(f"        heard: {r['heard'] or '(nothing)'}")
    if outside:
        print(f"note  {len(outside)} word(s) heard outside every window: "
              + " ".join(w["word"].strip() for w in outside))
    passed = sum(r["pass"] for r in rows)
    print(f"whisper-roundtrip: {passed} of {len(rows)} lines pass")


def parse_args(argv):
    ap = argparse.ArgumentParser(prog="whisper-roundtrip.py",
                                 description="Transcribe the showcase VO with Whisper and score every scripted line.")
    ap.add_argument("--audio", required=True, help="the VO stem (WAV) or a mix (MP4 or WAV)")
    ap.add_argument("--episode", required=True, help="video/showcase/episode.json")
    ap.add_argument("--out", required=True, help="the JSON report, under the media root")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"Whisper model (default {DEFAULT_MODEL})")
    ap.add_argument("--offset", type=float, default=0.0,
                    help="seconds of audio before 0:00 of the film (default 0: the stem starts at 0:00)")
    ap.add_argument("--max-wer", type=float, default=MAX_WER, help=f"highest passing WER per line (default {MAX_WER})")
    ap.add_argument("--no-prompt", action="store_true",
                    help="transcribe without the vocabulary prompt (for diagnosis; Lynx then usually comes back as links)")
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        audio = os.path.abspath(os.path.expanduser(args.audio))
        if not os.path.isfile(audio):
            raise ConfigError(f"audio not found: {audio}")
        out = os.path.abspath(os.path.expanduser(args.out))
        reason = media_root.refusal_reason(os.path.dirname(out))
        if reason:
            raise ConfigError(f"refusing report path {out}: {reason}; reports go under the media root")
        ep, lines = load_lines(args.episode)
        rb = load_renderer()
        stale = check_tts(lines, rb)
        if stale:
            raise ConfigError("ttsText differs from what render-brian.py sends (text with video/vo/lexicon.json "
                              f"applied) for {', '.join(stale)}: update ttsText in {args.episode}")
        prompt = None if args.no_prompt else vocabulary_prompt(lines, rb)
        words, full_text, version = transcribe(audio, args.model, prompt)
    except ConfigError as err:
        print(f"whisper-roundtrip: {err}", file=sys.stderr)
        return 2

    by_line, outside = assign(words, lines, args.offset)
    rows = score(lines, by_line, args.max_wer)
    report = {
        "episode": ep.get("id"),
        "episodeFile": _rel(os.path.abspath(args.episode)),
        "audio": audio,
        "audioSha256": _sha256(audio),
        "model": args.model,
        "whisperVersion": version,
        "initialPrompt": prompt,
        "offset": args.offset,
        "maxWer": args.max_wer,
        "margins": {"beforeWindowIn": LEAD_S, "afterWindowOut": TAIL_S},
        "generatedAt": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pass": all(r["pass"] for r in rows),
        "lines": rows,
        "outsideWindows": outside,
        "transcript": full_text,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print_summary(rows, outside)
    print(f"report: {out}")
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
