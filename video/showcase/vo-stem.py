#!/usr/bin/env python3
"""Fit-check the showcase narration, lock its masters and build the timed VO stem.

The voice is rendered by the pipeline's renderer, video/vo/render-brian.py, into <media root>/episodes/<id>/vo/
(for the showcase that is ~/Documents/SpatialAdjust_MarCom/showcase/vo/, through the episodes/showcase link). This
script reads what the renderer wrote and does three things the renderer does not:

  1. Fit check (always): every VO line in episode.json has a WAV and a length in vo/render-report.json, and that
     length fits the line's window (windowOut - windowIn, seconds of the finished film). Prints one row per line.
  2. Lock (--lock, only when the fit check passes): copies each <line>.wav into vo/masters-48k24/ and writes
     vo/masters-48k24/manifest.json (SHA-256, seconds and text hash of every master, the voice, model and settings
     from the render report, and the repository commit). A later re-render changes vo/<line>.wav, never a master,
     until --lock is run again; re-locking reports which masters changed.
  3. Stem (--lock): places every master at its windowIn on silence as long as the film (plannedRuntime), with
     ffmpeg (adelay and amix, without normalisation, so each line keeps the renderer's level), and writes
        vo/<id>-vo-full-48k24.wav   48 kHz, 24-bit, mono: the stem the Whisper round-trip transcribes
        vo/<id>-vo-REVIEW.mp3       the same at 192 kbit/s, for listening

Nothing is sent to ElevenLabs and no key is read. Everything is written under the media root.

Usage:
  python3 video/showcase/vo-stem.py --episode video/showcase/episode.json            # fit check only
  python3 video/showcase/vo-stem.py --episode video/showcase/episode.json --lock     # fit check, lock, stem

Exit codes: 0 done; 1 a line is missing or does not fit, or ffmpeg failed; 2 configuration or usage.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(REPO_ROOT, "video", "lib"))

import media_root  # noqa: E402  (video/lib/media_root.py)

MASTERS = "masters-48k24"
SAMPLE_RATE = 48000
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


class ConfigError(Exception):
    """Bad input or configuration. Exit 2."""


def load_episode(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as fh:
            ep = json.load(fh)
    except (OSError, ValueError) as err:
        raise ConfigError(f"cannot read episode {path}: {type(err).__name__}") from None
    if not isinstance(ep.get("vo"), list) or not ep["vo"]:
        raise ConfigError(f"{path}: vo[] is empty")
    for line in ep["vo"]:
        w0, w1 = line.get("windowIn"), line.get("windowOut")
        if not all(isinstance(v, (int, float)) for v in (w0, w1)) or not w0 < w1:
            raise ConfigError(f"{path}: vo line {line.get('id')!r} needs numeric windowIn < windowOut")
    if not isinstance(ep.get("plannedRuntime"), (int, float)):
        raise ConfigError(f"{path}: plannedRuntime (the film's length in seconds) is missing")
    return ep


def fit_rows(ep: dict, report: dict, vo_dir: str) -> list[dict]:
    """One row per VO line: rendered seconds against the window."""
    entries = {e.get("line"): e for e in report.get("lines", []) if isinstance(e, dict)}
    rows = []
    for line in ep["vo"]:
        lid = line["id"]
        window = round(line["windowOut"] - line["windowIn"], 3)
        entry = entries.get(lid)
        wav = os.path.join(vo_dir, f"{lid}.wav")
        problem = None
        seconds = None
        if entry is None or not os.path.isfile(wav):
            problem = "not rendered"
        elif entry.get("text") != line["text"]:
            problem = "rendered text differs from episode.json; render it again"
        else:
            seconds = float(entry["seconds"])
            if seconds > window:
                problem = f"overruns its window by {seconds - window:.2f} s"
        rows.append({"id": lid, "line": line.get("line"), "windowIn": line["windowIn"], "windowOut": line["windowOut"],
                     "window": window, "seconds": seconds, "spare": None if seconds is None else round(window - seconds, 2),
                     "fits": problem is None, "problem": problem})
    return rows


def print_fit(rows: list[dict]) -> None:
    print(f"{'line':<5} {'id':<18} {'window':>8} {'rendered':>9} {'spare':>7}  fit")
    for r in rows:
        sec = "-" if r["seconds"] is None else f"{r['seconds']:.2f}"
        spare = "-" if r["spare"] is None else f"{r['spare']:.2f}"
        print(f"{r['line'] or '':<5} {r['id']:<18} {r['window']:>8.2f} {sec:>9} {spare:>7}  "
              + ("yes" if r["fits"] else f"NO: {r['problem']}"))


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _git(*args: str) -> str:
    try:
        return subprocess.run(["git", "-C", REPO_ROOT, *args], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def lock(ep: dict, report: dict, vo_dir: str, episode_path: str) -> str:
    """Copy every line's WAV into masters-48k24/ and write its manifest. Returns the masters folder."""
    masters = media_root.episode_dir(ep["id"], "vo", MASTERS)
    entries = {e.get("line"): e for e in report.get("lines", [])}
    old = {}
    manifest_path = os.path.join(masters, "manifest.json")
    if os.path.isfile(manifest_path):
        with open(manifest_path, encoding="utf-8") as fh:
            old = {m["id"]: m for m in json.load(fh).get("masters", [])}
    out = []
    for line in ep["vo"]:
        lid = line["id"]
        src = os.path.join(vo_dir, f"{lid}.wav")
        dst = os.path.join(masters, f"{lid}.wav")
        sha = _sha256(src)
        if old.get(lid, {}).get("sha256") != sha or not os.path.isfile(dst):
            shutil.copy2(src, dst)
            print(f"lock  {lid}: {'new master' if lid not in old else 'master replaced'}")
        out.append({"id": lid, "line": line.get("line"), "file": f"{lid}.wav", "sha256": sha,
                    "seconds": entries[lid]["seconds"], "characters": entries[lid].get("characters"),
                    "text_hash": entries[lid].get("text_hash"), "windowIn": line["windowIn"],
                    "windowOut": line["windowOut"], "text": line["text"]})
    dirty = _git("status", "--porcelain", "--", os.path.relpath(os.path.abspath(episode_path), REPO_ROOT))
    manifest = {
        "episode": ep["id"],
        "lockedAt": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "commit": _git("rev-parse", "HEAD"),
        "episodeFileClean": dirty == "",
        "voice": report.get("voice"), "model": report.get("model"), "settings": report.get("settings"),
        "output_format": report.get("output_format"), "sample_rate": report.get("sample_rate"),
        "bit_depth": report.get("bit_depth"), "rms_target_dbfs": report.get("rms_target_dbfs"),
        "masters": out,
    }
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    return masters


def build_stem(ep: dict, masters: str, vo_dir: str) -> tuple[str, str]:
    """Every master at its windowIn on silence as long as the film: a 48 kHz 24-bit mono WAV and a review MP3."""
    stem = os.path.join(vo_dir, f"{ep['id']}-vo-full-48k24.wav")
    review = os.path.join(vo_dir, f"{ep['id']}-vo-REVIEW.mp3")
    duration = float(ep["plannedRuntime"])
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y"]
    chains = []
    for i, line in enumerate(ep["vo"]):
        cmd += ["-i", os.path.join(masters, f"{line['id']}.wav")]
        ms = int(round(line["windowIn"] * 1000))
        chains.append(f"[{i}:a]aresample={SAMPLE_RATE},adelay={ms}:all=1[a{i}]")
    n = len(ep["vo"])
    mix = "".join(f"[a{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0:duration=longest,apad,atrim=0:{duration}[out]"
    cmd += ["-filter_complex", ";".join(chains + [mix]), "-map", "[out]", "-ac", "1", "-ar", str(SAMPLE_RATE),
            "-c:a", "pcm_s24le", stem]
    try:
        subprocess.run(cmd, check=True)
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", stem, "-c:a", "libmp3lame",
                        "-b:a", "192k", review], check=True)
    except (OSError, subprocess.CalledProcessError) as err:
        raise RuntimeError(f"ffmpeg failed: {err}") from None
    return stem, review


def parse_args(argv):
    ap = argparse.ArgumentParser(prog="vo-stem.py", description="Fit-check the showcase VO, lock its masters and "
                                 "build the timed VO stem.")
    ap.add_argument("--episode", required=True, help="video/showcase/episode.json")
    ap.add_argument("--lock", action="store_true", help="when every line fits: copy the masters and build the stem")
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        ep = load_episode(args.episode)
        vo_dir = media_root.episode_dir(ep["id"], "vo")
        report_path = os.path.join(vo_dir, "render-report.json")
        if not os.path.isfile(report_path):
            raise ConfigError(f"no render report at {report_path}: render the VO first (npm run video -- vo)")
        with open(report_path, encoding="utf-8") as fh:
            report = json.load(fh)
    except (ConfigError, media_root.MediaRootError, ValueError) as err:
        print(f"vo-stem: {err}", file=sys.stderr)
        return 2
    rows = fit_rows(ep, report, vo_dir)
    print(f"Episode {ep['id']}: {len(rows)} VO lines; voice {report.get('voice')}, model {report.get('model')}")
    print_fit(rows)
    fits = all(r["fits"] for r in rows)
    total = sum(r["seconds"] or 0 for r in rows)
    print(f"fit: {sum(r['fits'] for r in rows)} of {len(rows)} lines fit; {total:.2f} s of narration")
    if not fits:
        return 1
    if not args.lock:
        return 0
    try:
        masters = lock(ep, report, vo_dir, args.episode)
        stem, review = build_stem(ep, masters, vo_dir)
    except (media_root.MediaRootError, OSError, RuntimeError) as err:
        print(f"vo-stem: {err}", file=sys.stderr)
        return 1
    print(f"masters: {masters}")
    print(f"stem: {stem}")
    print(f"review: {review}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
