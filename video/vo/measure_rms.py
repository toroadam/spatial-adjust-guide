#!/usr/bin/env python3
"""Measure the Brian voice loudness target: the mean RMS of the iCentral Brian masters, in dBFS.

The iCentral renderer (double-clicks/01-home/vo/render-brian.py) levels every line to

    target = mean(rms(master) for master in ~/Documents/iCentral_MarCom/04-vo/brian/masters-48k24/*.wav)

where rms runs over every sample of a file read as floats in [-1, 1) (soundfile's scaling, int / 2**(bits - 1)).
This script computes the same number with the standard library only and prints it as the fenced line that
video/vo/voice-settings.md records and video/vo/render-brian.py reads:

    rms_target_dbfs: <20 * log10(target)>

It is run once, by hand, when the target is (re)measured. The masters are opened read only and nothing is copied or
written anywhere.

Usage: python3 video/vo/measure_rms.py [--dir <folder of WAVs>] [--per-file]
"""

from __future__ import annotations

import argparse
import datetime as _dt
import glob
import math
import os
import sys
import wave
from array import array

DEFAULT_DIR = os.path.join(os.path.expanduser("~"), "Documents", "iCentral_MarCom", "04-vo", "brian", "masters-48k24")


def _ints(frames: bytes, width: int) -> tuple[array, int]:
    """PCM frames as signed ints, and the full-scale value they are divided by."""
    if width == 1:  # 8-bit WAV is unsigned
        return array("i", (b - 128 for b in frames)), 128
    if width == 2:
        out = array("h")
        out.frombytes(frames)
        scale = 1 << 15
    elif width == 3:  # widen each little-endian 24-bit sample to 32 bits: the value lands shifted left by 8
        n = len(frames) // 3
        wide = bytearray(4 * n)
        wide[1::4] = frames[0::3]
        wide[2::4] = frames[1::3]
        wide[3::4] = frames[2::3]
        out = array("i")
        out.frombytes(bytes(wide))
        scale = 1 << 31
    elif width == 4:
        out = array("i")
        out.frombytes(frames)
        scale = 1 << 31
    else:
        raise ValueError(f"unsupported sample width {width} bytes")
    if sys.byteorder == "big":
        out.byteswap()
    return out, scale


def file_rms(path: str) -> float:
    """RMS of every sample in a PCM WAV, all channels together, as floats in [-1, 1)."""
    with wave.open(path, "rb") as w:
        frames = w.readframes(w.getnframes())
        width = w.getsampwidth()
    samples, scale = _ints(frames, width)
    if not samples:
        raise ValueError(f"{path} has no samples")
    mean_square = sum(v * v for v in samples) / len(samples)
    return math.sqrt(mean_square) / scale


def measure(folder: str) -> tuple[list[tuple[str, float]], float]:
    paths = sorted(glob.glob(os.path.join(folder, "*.wav")))
    if not paths:
        raise FileNotFoundError(f"no .wav files in {folder}")
    per_file = [(os.path.basename(p), file_rms(p)) for p in paths]
    return per_file, sum(r for _n, r in per_file) / len(per_file)


def _mtime(path: str) -> str:
    return _dt.datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d %H:%M:%S")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Mean RMS of the iCentral Brian masters, in dBFS (read only).")
    ap.add_argument("--dir", default=DEFAULT_DIR, help="folder of master WAVs (default: the iCentral Brian masters)")
    ap.add_argument("--per-file", action="store_true", help="also print each file's RMS")
    args = ap.parse_args(argv)
    try:
        per_file, mean = measure(args.dir)
    except (OSError, ValueError, EOFError, wave.Error) as err:
        print(f"measure_rms: {err}", file=sys.stderr)
        return 1
    newest = max(_mtime(os.path.join(args.dir, n)) for n, _r in per_file)
    print(f"folder: {args.dir} (modified {_mtime(args.dir)}; newest file {newest})")
    print(f"files: {len(per_file)}")
    if args.per_file:
        for name, r in per_file:
            print(f"  {name}: {r:.6f} ({20 * math.log10(r):.2f} dBFS)")
    print(f"mean rms (linear): {mean:.6f}")
    print(f"measured: {_dt.date.today().isoformat()}")
    print(f"rms_target_dbfs: {20 * math.log10(mean):.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
