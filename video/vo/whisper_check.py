#!/usr/bin/env python3
"""Whisper round-trip of an episode's voice-over (video/episodes/RUNBOOK.md, EP-5).

    $SA_VIDEO_PYTHON video/vo/whisper_check.py --episode video/episodes/<id>/episode.json [--model small.en] [--lines V1a,V2b]

Transcribes every line WAV under <media root>/episodes/<id>/vo/ with openai-whisper (installed in the media root's
venv, never in this repository) and compares the transcript with the line's spoken text, the written text with
video/vo/lexicon.json applied, word by word. Both sides are normalised first: case, punctuation and hyphens dropped,
number words turned into digits, letter runs such as "V W C" joined into one token, letters and digits split
("3AP1" is "3 ap 1"), and the few spellings Whisper chooses for a lexicon term ("Lynx" for "Links") mapped to one.
A line passes when nothing is left over; any substitution, missing or extra word is listed for a person to judge.

Writes <media root>/episodes/<id>/vo/whisper-report-<model>.json (a --lines run updates those lines in it). Exit 0 every line matches, 1 a line differs (re-render it
with render-brian.py --lines <id> --force, or record why the difference is Whisper's), 2 could not run.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import difflib
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "lib"))

import media_root  # noqa: E402  (video/lib/media_root.py)


def _render_brian():
    spec = importlib.util.spec_from_file_location("render_brian", os.path.join(HERE, "render-brian.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
         "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
# Spellings Whisper picks for a term the lexicon respells, mapped to the lexicon's spoken form (normalised).
ALIASES = {
    "lynx": "links", "lincs": "links", "intellidash": "intelli dash", "turfrad": "turf rad", "okay": "ok",
    "colored": "coloured", "summarize": "summarise", "summarizes": "summarises", "millimeters": "millimetres",
    "centimeters": "centimetres", "percentage": "percent",
}


def _numbers_to_digits(tokens: list[str]) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t in TENS:
            value = TENS[t]
            if i + 1 < len(tokens) and tokens[i + 1] in UNITS[1:10]:
                value += UNITS.index(tokens[i + 1])
                i += 1
            out.append(str(value))
        elif t in UNITS:
            out.append(str(UNITS.index(t)))
        else:
            out.append(t)
        i += 1
    return out


def normalise(text: str) -> list[str]:
    t = text.lower().replace("%", " percent ").replace("&", " and ")
    t = re.sub(r"(?<=\d)\.(?=\d)", " point ", t)
    t = re.sub(r"(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])", " ", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    tokens = t.split()
    tokens = " ".join(ALIASES.get(w, w) for w in tokens).split()
    tokens = _numbers_to_digits(tokens)
    joined: list[str] = []
    run: list[str] = []
    for w in tokens + [""]:
        if len(w) == 1 and w.isalpha() and w != "a":
            run.append(w)
            continue
        if w == "a" and run:
            run.append(w)
            continue
        if run:
            joined.append("".join(run))
            run = []
        if w:
            joined.append(w)
    return joined


def compare(expected: str, heard: str) -> list[dict]:
    a, b = normalise(expected), normalise(heard)
    diffs = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op != "equal":
            diffs.append({"op": op, "expected": " ".join(a[i1:i2]), "heard": " ".join(b[j1:j2])})
    return diffs


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--episode", required=True)
    ap.add_argument("--model", default="small.en")
    ap.add_argument("--lines", default="", help="comma-separated line ids (default: every line)")
    args = ap.parse_args(argv)
    try:
        rb = _render_brian()
        episode = rb.load_episode(args.episode)
        lexicon = rb.load_lexicon()
        vo_dir = media_root.episode_dir(episode["id"], "vo")
    except Exception as err:  # noqa: BLE001
        print(f"whisper-check: could not run: {err}", file=sys.stderr)
        return 2
    try:
        import whisper  # type: ignore
    except ImportError:
        print("whisper-check: openai-whisper is not installed in this Python; run it with the media root's venv "
              "($SA_VIDEO_PYTHON), or install it there: <media root>/.venv/bin/pip install openai-whisper",
              file=sys.stderr)
        return 2
    wanted = {s for s in args.lines.split(",") if s}
    model = whisper.load_model(args.model)
    results, failed = [], 0
    for line in episode["vo"]:
        if wanted and line["id"] not in wanted:
            continue
        wav = os.path.join(vo_dir, f"{line['id']}.wav")
        if not os.path.exists(wav):
            print(f"whisper-check: {line['id']}: no WAV at <media root>/episodes/{episode['id']}/vo/{line['id']}.wav",
                  file=sys.stderr)
            return 2
        spoken = rb.apply_lexicon(line["text"], lexicon)
        heard = model.transcribe(wav, language="en", fp16=False, temperature=0.0)["text"].strip()
        diffs = compare(spoken, heard)
        results.append({"line": line["id"], "spoken": spoken, "heard": heard, "diffs": diffs, "ok": not diffs})
        if diffs:
            failed += 1
            shown = "; ".join(f"{d['op']} '{d['expected']}' -> '{d['heard']}'" for d in diffs)
            print(f"whisper-check: {line['id']}: DIFF {shown}")
        else:
            print(f"whisper-check: {line['id']}: ok")
    name = f"whisper-report-{args.model}.json"
    path = os.path.join(vo_dir, name)
    merged = {r["line"]: r for r in results}
    if wanted and os.path.exists(path):  # a partial run updates its lines in the model's existing report
        with open(path, encoding="utf-8") as fh:
            earlier = {r["line"]: r for r in json.load(fh).get("lines", [])}
        merged = {**earlier, **merged}
    order = [line["id"] for line in episode["vo"]]
    report = {
        "episode": episode["id"], "model": args.model,
        "checkedAt": _dt.datetime.now().isoformat(timespec="seconds"),
        "lines": [merged[i] for i in order if i in merged],
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(f"whisper-check: {len(results) - failed}/{len(results)} line(s) match; report vo/{name}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
