#!/usr/bin/env python3
# Ported from iCentral MarCom 06-edit/compositor/tools/d28_ocr.py (33 lines) on 2026-10-20; changes listed in video/verify/NOTES.md
"""OCR release gate: sampled frames of a render, read on-device by Apple Vision, must show no denylisted name.

  python3 video/verify/ocr_check.py --render <mp4> --timeline <timeline.json> [--episode <episode.json>] [--every 0.5]
      [--keep-frames] [--report <ocr-report.json>]

Canvas text, such as names drawn into map tiles, reaches a render without passing through any DOM the capture overlay can
rewrite, so this is the only check that sees it. It is a release gate, not an option:
  1. sa-ocr: video/verify/ocr.swift is compiled with swiftc -O to <media root>/bin/sa-ocr when the binary is missing or
     older than the source.
  2. Frames: one every --every seconds from 0, plus one 0.5 s after each timeline label's tin, extracted by ffmpeg as PNG
     into <media root>/episodes/<id>/frames/ocr/ (its old frames are removed first).
  3. sa-ocr reads the frames in batches; each frame's readings are joined and normalised (NFKC, casefold, whitespace
     collapsed). The readings stay in memory.
  4. Each term of load_local_maps().denylist (sanitize.local.json and video/capture/overlay.local.json, through
     video/lib/local_maps.py) is matched, normalised the same way: a term of 6 or more characters anywhere in the text,
     and also within edit distance 1 of any stretch of it (an OCR misread of a real name); a shorter term only as a whole
     word, exactly, because a short term inside ordinary words would fail every render.
  5. Report: <media root>/episodes/<id>/renders/ocr-report.json {pass, frames, hits: [{t, index}], ...}, and one line
     "[denylisted #N] at <t> s" per hit. Index N is the term's 1-based position in the denylist. The term, and the OCR
     text around it, are never printed and never stored.
  6. After a pass the frames are deleted, unless --keep-frames; after a failure they are kept for review.

Episode id: from --episode, else from a render under <media root>/episodes/<id>/, else from the timeline's final_out. The
render, the frames and the report are all under the media root; anything else is refused.

Exit codes: 0 no hit, 1 at least one hit, 2 the check could not run (bad input, an empty denylist, ffmpeg missing, a frame
sa-ocr could not read, a path outside the media root), 3 OCR unavailable (not macOS, or no sa-ocr and no swiftc to build
it). Only 0 is a pass.
"""
import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
for _p in (os.path.join(VIDEO, 'lib'), os.path.join(VIDEO, 'edit', 'lib')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import media_root as MR  # noqa: E402
from local_maps import LocalMapsError, load_local_maps  # noqa: E402
from media import MediaRootError, episode_dir, require_media_path  # noqa: E402

SWIFT_SRC = os.path.join(HERE, 'ocr.swift')
BINARY = 'sa-ocr'
FUZZY_MIN = 6               # terms this long or longer: substring anywhere, and edit distance 1
LABEL_OFFSET = 0.5          # seconds after a label's tin, when it has typed or faded in
BATCH = 40                  # frames per sa-ocr run
REPORT_NAME = 'ocr-report.json'
FRAME_GLOB = re.compile(r'^f_\d{5}\.png$')


class OcrUnavailable(Exception):
    """The OCR engine cannot run here: exit 3. The message starts with 'OCR unavailable'."""


class OcrError(Exception):
    """The check cannot run: exit 2. Messages name paths and counts, never a term or OCR text."""


# ---------------------------------------------------------------------------------------------------------------------
# sa-ocr
# ---------------------------------------------------------------------------------------------------------------------

def current_platform():
    return sys.platform


def find_swiftc():
    return os.environ.get('SWIFTC') or shutil.which('swiftc')


def binary_path():
    return os.path.join(MR.subdir('bin'), BINARY)


def ensure_binary():
    """Path of an up-to-date sa-ocr, built from ocr.swift when missing or older than the source."""
    if current_platform() != 'darwin':
        raise OcrUnavailable(f'OCR unavailable: the OCR check uses the macOS Vision framework and runs only on macOS '
                             f'(this is {current_platform()}). Run it on a Mac before release; nothing has been checked.')
    target = binary_path()
    if os.path.isfile(target) and os.access(target, os.X_OK) and os.path.getmtime(target) >= os.path.getmtime(SWIFT_SRC):
        return target
    swiftc = find_swiftc()
    if not swiftc:
        raise OcrUnavailable(f'OCR unavailable: swiftc not found, so {target} cannot be built from video/verify/ocr.swift. '
                             'Install the Xcode command line tools (xcode-select --install); nothing has been checked.')
    building = target + '.building'
    r = subprocess.run([swiftc, '-O', SWIFT_SRC, '-o', building], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.isfile(building):
        if os.path.exists(building):
            os.remove(building)
        raise OcrUnavailable(f'OCR unavailable: swiftc could not build {target}: {r.stderr.strip()[-400:]}')
    os.replace(building, target)
    return target


def run_ocr(binary, paths):
    """{path: [text, ...]} for every frame. Raises OcrError when a frame cannot be read; never prints the text."""
    out = {}
    for i in range(0, len(paths), BATCH):
        batch = paths[i:i + BATCH]
        r = subprocess.run([binary, *batch], capture_output=True, text=True)
        if r.returncode not in (0, 1):
            raise OcrError(f'sa-ocr exited {r.returncode} on {len(batch)} frames')
        for n, line in enumerate(r.stdout.splitlines(), start=1):
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                raise OcrError(f'sa-ocr printed a line that is not JSON (output line {n})') from None
            if rec.get('error'):
                raise OcrError(f'sa-ocr could not read {rec.get("file")}: {rec["error"]}')
            out[rec.get('file')] = list(rec.get('lines') or []) + list(rec.get('alternates') or [])
        missing = [p for p in batch if p not in out]
        if missing:
            raise OcrError(f'sa-ocr returned nothing for {len(missing)} frames, first {missing[0]}')
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------------------------------------------------

def normalise(text):
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def within_one(term, text):
    """True when some stretch of text is within edit distance 1 of term (Sellers' approximate substring match)."""
    m = len(term)
    half = m // 2
    if term[:half] not in text and term[half:] not in text:
        return False                    # one edit leaves one half intact, so a match needs one half verbatim
    col = list(range(m + 1))
    for ch in text:
        new = [0]
        for i in range(1, m + 1):
            new.append(min(col[i - 1] + (term[i - 1] != ch), col[i] + 1, new[i - 1] + 1))
        if new[m] <= 1:
            return True
        col = new
    return False


class Matcher:
    """Denylist matcher. Holds the terms in memory only; its repr shows counts."""

    def __init__(self, terms):
        self._long, self._short = [], []
        for n, term in enumerate(terms, start=1):
            t = normalise(term)
            if not t:
                continue
            if len(t) >= FUZZY_MIN:
                self._long.append((n, t))
            else:
                self._short.append((n, re.compile(r'(?<!\w)' + re.escape(t) + r'(?!\w)')))
        self.size = len(self._long) + len(self._short)

    def __repr__(self):
        return f'<Matcher n_long={len(self._long)} n_short={len(self._short)}>'

    __str__ = __repr__

    def find(self, text):
        """Sorted 1-based denylist indices found in text."""
        t = normalise(text)
        hits = {n for n, term in self._long if term in t or within_one(term, t)}
        hits |= {n for n, rx in self._short if rx.search(t)}
        return sorted(hits)


# ---------------------------------------------------------------------------------------------------------------------
# Frames
# ---------------------------------------------------------------------------------------------------------------------

def load_ff():
    try:
        import ff  # noqa: E402  (refuses temporary and scratchpad ffmpeg builds)
    except RuntimeError as err:
        raise OcrError(str(err)) from None
    return ff


def video_info(ff, render):
    r = subprocess.run([ff.FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=r_frame_rate,nb_frames,duration:format=duration', '-of', 'json', render],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise OcrError(f'ffprobe cannot read {render}')
    info = json.loads(r.stdout)
    s = (info.get('streams') or [{}])[0]
    try:
        num, den = s.get('r_frame_rate', '0/1').split('/')
        fps = float(num) / float(den)
    except (ValueError, ZeroDivisionError):
        fps = 0.0
    duration = None
    for cand in (s.get('duration'), info.get('format', {}).get('duration')):
        try:
            duration = float(cand)
            break
        except (TypeError, ValueError):
            continue
    if not fps or not duration:
        raise OcrError(f'{render} has no video frame rate or duration')
    try:
        nb = int(s.get('nb_frames'))
    except (TypeError, ValueError):
        nb = int(duration * fps)
    return fps, duration, nb


def sample_frames(duration, fps, nb_frames, every, labels):
    """Frame numbers to read: one every `every` s from 0, and one LABEL_OFFSET s after each label's tin."""
    times = []
    k = 0
    while k * every < duration - 1e-9:
        times.append(k * every)
        k += 1
    for L in labels or []:
        tin = L.get('tin') if isinstance(L, dict) else None
        if isinstance(tin, (int, float)) and 0 <= tin + LABEL_OFFSET < duration:
            times.append(tin + LABEL_OFFSET)
    last = max(0, nb_frames - 1)
    return sorted({min(last, int(round(t * fps))) for t in times})


def extract_frames(ff, render, frames, out_dir):
    """Write the frames as f_00001.png ... into out_dir (under the media root); [(frame number, path)]."""
    for name in os.listdir(out_dir):
        if FRAME_GLOB.match(name):
            os.remove(os.path.join(out_dir, name))
    expr = '+'.join(f'eq(n,{n})' for n in frames)
    pattern = os.path.join(out_dir, 'f_%05d.png')
    r = subprocess.run([ff.FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', render, '-map', '0:v:0',
                        '-vf', f"select='{expr}'", '-fps_mode', 'passthrough', pattern], capture_output=True, text=True)
    if r.returncode != 0:
        raise OcrError(f'ffmpeg could not extract frames from {render}: {r.stderr.strip()[-300:]}')
    files = sorted(n for n in os.listdir(out_dir) if FRAME_GLOB.match(n))
    if len(files) != len(frames):
        raise OcrError(f'ffmpeg wrote {len(files)} frames, expected {len(frames)}')
    return [(n, os.path.join(out_dir, f)) for n, f in zip(frames, files)]


def remove_frames(out_dir):
    for name in os.listdir(out_dir):
        if FRAME_GLOB.match(name):
            os.remove(os.path.join(out_dir, name))


# ---------------------------------------------------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------------------------------------------------

def _load_json(path, what):
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        raise OcrError(f'cannot read {what} {path}: {err}') from None
    if not isinstance(data, dict):
        raise OcrError(f'{what} {path} is not a JSON object')
    return data


def episode_id(episode_path, render, timeline):
    if episode_path:
        eid = _load_json(episode_path, 'episode').get('id')
        if not isinstance(eid, str):
            raise OcrError(f'episode {episode_path} has no id')
        return eid
    episodes = os.path.join(MR.media_root(), 'episodes')
    for p in (render, timeline.get('final_out')):
        if not isinstance(p, str) or not p:
            continue
        real = MR.resolve_real(p)
        if MR.is_inside(real, episodes):
            parts = os.path.relpath(real, episodes).split(os.sep)
            if len(parts) >= 2:
                return parts[0]
    raise OcrError('cannot tell which episode this is: pass --episode <episode.json>')


def main(argv=None):
    ap = argparse.ArgumentParser(description='OCR sampled frames of a render against the local denylist (exit 0 only when '
                                             'no denylisted name is read).')
    ap.add_argument('--render', required=True, help='the render, under the media root')
    ap.add_argument('--timeline', required=True, help='the timeline JSON (labels add sample frames)')
    ap.add_argument('--episode', help='episode.json, for the episode id (default: from the render path)')
    ap.add_argument('--every', type=float, default=0.5, help='seconds between sampled frames (default 0.5)')
    ap.add_argument('--keep-frames', action='store_true', help='keep the frames after a pass')
    ap.add_argument('--report', help='where to write ocr-report.json (default the episode renders folder)')
    a = ap.parse_args(argv)
    if not a.every > 0:
        ap.error('--every must be more than 0')

    try:
        binary = ensure_binary()
    except OcrUnavailable as err:
        sys.stderr.write(f'ocr_check.py: {err}\n')
        return 3
    except MediaRootError as err:
        sys.stderr.write(f'ocr_check.py: {err}\n')
        return 2

    try:
        render = require_media_path(a.render, 'render')
        if not os.path.isfile(render):
            raise OcrError(f'render not found: {a.render}')
        timeline = _load_json(a.timeline, 'timeline')
        eid = episode_id(a.episode, render, timeline)
        frames_dir = episode_dir(eid, 'frames', 'ocr')
        report_path = require_media_path(a.report, 'report') if a.report else os.path.join(episode_dir(eid, 'renders'), REPORT_NAME)
        try:
            matcher = Matcher(load_local_maps().denylist)
        except LocalMapsError as err:
            raise OcrError(str(err)) from None
        if not matcher.size:
            raise OcrError('the denylist is empty (no sanitize.local.json or video/capture/overlay.local.json terms), so '
                           'a scan would pass without checking anything; set up the local name maps first')
        ff = load_ff()
        fps, duration, nb = video_info(ff, render)
        wanted = sample_frames(duration, fps, nb, a.every, timeline.get('labels'))
        extracted = extract_frames(ff, render, wanted, frames_dir)
        texts = run_ocr(binary, [p for _, p in extracted])
        hits = []
        for n, path in extracted:
            text = '\n'.join(texts.get(path) or [])
            for index in matcher.find(text):
                hits.append(dict(t=round(n / fps, 3), index=index))
            texts.pop(path, None)
        del texts
        ok = not hits
        keep = a.keep_frames or not ok
        if not keep:
            remove_frames(frames_dir)
        report = {'pass': ok, 'episode': eid, 'render': render, 'every': a.every, 'frames': len(extracted),
                  'hits': hits, 'denylist_terms': matcher.size,
                  'match': f'whole word for terms under {FUZZY_MIN} characters; substring and edit distance 1 from '
                           f'{FUZZY_MIN} characters; NFKC, casefold, whitespace collapsed',
                  'frames_dir': frames_dir, 'frames_kept': keep, 'binary': binary,
                  'generated': datetime.datetime.now().isoformat(timespec='seconds')}
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=1)
            f.write('\n')
    except (OcrError, MediaRootError) as err:
        sys.stderr.write(f'ocr_check.py: {err}\n')
        return 2

    for h in hits:
        print(f'[denylisted #{h["index"]}] at {h["t"]:.2f} s')
    kept = f'; frames kept in {frames_dir}' if keep else ''
    print(f'ocr: {"PASS" if ok else "FAIL"}, {len(extracted)} frames, {len(hits)} hits{kept} -> {report_path}')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
