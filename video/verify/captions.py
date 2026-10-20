#!/usr/bin/env python3
"""English WebVTT captions for a render, from its timeline's VO placements and the episode's written VO text.

  python3 video/verify/captions.py --timeline <timeline.json> --episode <episode.json> --report <render-report.json>
      [--out <path.vtt>]

For each VO placement [line id, t0] in the timeline:
  text      episode.vo[id].text, the written form. Never the lexicon's spoken form (Intelli-Dash, "hole 3, A P 1"):
            render-brian.py applies the lexicon only to what it sends to the voice.
  duration  lines[].seconds from the VO render report (<media root>/episodes/<id>/vo/render-report.json).
  cues      the text split, at phrase boundaries where it can be, into the fewest cues of at most 2 lines of at most
            42 characters; the lines of a cue are balanced. The line's time is shared out in proportion to each cue's
            characters, cues 0.1 s apart and each at least 1.0 s; the first cue starts at t0, and a line too short for its
            cues runs on, up to 0.1 s before the next line (or the end of the render).
  ids       <line id>-<n>, n from 1.

Checks, each fatal (exit 1, and no file is written): every episode VO line is placed and found in the report and produces
a cue; every cue starts and ends within the render (the timeline's duration), lasts at least 1.0 s, has at most 2 lines of
at most 42 characters and does not overlap the next; the first cue of a line starts within 0.1 s of its placement; no
caption holds a denylisted name (video/lib/local_maps.py; reported as [denylisted #N] with the line id, never the name).
An empty denylist is reported on stderr and does not stop the captions: their text comes from episode.json, which the
repository hygiene check already scans.

Output: <media root>/episodes/<episode id>/renders/<episode id>.en.vtt, or --out (which must resolve under the media root).
Captions stay with the render they describe until the guides site decides where published captions live (ER-1621, which
also translates them).

Exit codes: 0 written, 1 a check failed, 2 the input cannot be read or the output path is refused. Standard library only.
"""
import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
for _p in (os.path.join(VIDEO, 'lib'), os.path.join(VIDEO, 'edit', 'lib')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from local_maps import LocalMapsError, find_denylisted, load_local_maps  # noqa: E402
from media import MediaRootError, episode_dir, require_media_path  # noqa: E402

MAX_CHARS = 42              # per caption line
MAX_LINES = 2               # per cue
MIN_CUE_MS = 1000
GAP_MS = 100
START_TOLERANCE_MS = 100    # first cue of a line against its placement
PHRASE_END = re.compile(r'[,;:.!?)–—]["”’\']?$')
CUE_COST, BREAK_COST = 1000, 30


class CaptionError(Exception):
    """A caption check failed: exit 1."""


class InputError(Exception):
    """The input cannot be read: exit 2."""


# ---------------------------------------------------------------------------------------------------------------------
# Splitting
# ---------------------------------------------------------------------------------------------------------------------

def words_of(text):
    """The words of text; a word longer than a caption line is cut into line-sized pieces."""
    out = []
    for w in text.split():
        while len(w) > MAX_CHARS:
            out.append(w[:MAX_CHARS])
            w = w[MAX_CHARS:]
        if w:
            out.append(w)
    return out


def wrap(words):
    """words as at most MAX_LINES lines of at most MAX_CHARS characters, the two lines as even as possible and broken
    after punctuation when that costs little; None when they do not fit."""
    one = ' '.join(words)
    if len(one) <= MAX_CHARS:
        return [one]
    best = None
    for k in range(1, len(words)):
        a, b = ' '.join(words[:k]), ' '.join(words[k:])
        if len(a) > MAX_CHARS or len(b) > MAX_CHARS:
            continue
        score = abs(len(a) - len(b)) - (6 if PHRASE_END.search(words[k - 1]) else 0)
        if best is None or score < best[0]:
            best = (score, [a, b])
    return best[1] if best else None


def split_cues(text):
    """The text as a list of cues, each a list of 1 or 2 lines: the fewest cues, then breaks at phrase ends, then even
    cue lengths (dynamic programming over the words)."""
    words = words_of(text)
    n = len(words)
    if not n:
        return []
    best = [None] * (n + 1)          # best[j] = (cost, cue boundaries) for words[:j]
    best[0] = (0.0, [])
    for j in range(1, n + 1):
        for i in range(j - 1, -1, -1):
            if best[i] is None:
                continue
            seg = words[i:j]
            if len(' '.join(seg)) > MAX_CHARS * MAX_LINES + MAX_LINES - 1:
                break
            if wrap(seg) is None:
                continue
            brk = 0 if j == n or PHRASE_END.search(words[j - 1]) else BREAK_COST
            cost = best[i][0] + CUE_COST + brk + len(' '.join(seg)) ** 2 / 100.0
            if best[j] is None or cost < best[j][0]:
                best[j] = (cost, best[i][1] + [(i, j)])
    return [wrap(words[i:j]) for i, j in best[n][1]]


# ---------------------------------------------------------------------------------------------------------------------
# Timing (integer milliseconds, so gaps and minimums survive rounding)
# ---------------------------------------------------------------------------------------------------------------------

def water_fill(sizes, total, floor):
    """total ms shared in proportion to sizes, none below floor (when total allows); integers summing to total."""
    n = len(sizes)
    if total <= n * floor:
        base = [total // n] * n
        base[-1] += total - sum(base)
        return base
    fixed = set()
    while True:
        free = [i for i in range(n) if i not in fixed]
        rest = total - floor * len(fixed)
        weight = sum(max(1, sizes[i]) for i in free)
        shares = {i: rest * max(1, sizes[i]) / weight for i in free}
        low = {i for i in free if shares[i] < floor}
        if not low:
            break
        fixed |= low
    out = [floor if i in fixed else int(math.floor(shares[i])) for i in range(n)]
    out[-1] += total - sum(out)
    return out


def time_line(t0, seconds, sizes, limit):
    """[(start, end)] ms for the cues of one VO line spoken from t0 for `seconds` ms; nothing ends after `limit`."""
    n = len(sizes)
    span = max(seconds, n * MIN_CUE_MS + (n - 1) * GAP_MS)
    span = max(0, min(span, limit - t0))
    durs = water_fill(sizes, max(0, span - (n - 1) * GAP_MS), MIN_CUE_MS)
    out, t = [], t0
    for d in durs:
        out.append((t, t + d))
        t += d + GAP_MS
    return out


def stamp(ms):
    h, rest = divmod(int(ms), 3600000)
    m, rest = divmod(rest, 60000)
    s, ms = divmod(rest, 1000)
    return f'{h:02d}:{m:02d}:{s:02d}.{ms:03d}'


def escape(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


# ---------------------------------------------------------------------------------------------------------------------
# Build and check
# ---------------------------------------------------------------------------------------------------------------------

def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def build(timeline, episode, report):
    """[{id, line, start, end, lines}] in time order. Raises CaptionError when a check fails."""
    texts = {}
    for v in episode.get('vo') or []:
        if isinstance(v, dict) and isinstance(v.get('id'), str) and isinstance(v.get('text'), str):
            texts[v['id']] = v['text']
    seconds = {}
    for e in (report.get('lines') or []) if isinstance(report, dict) else []:
        if isinstance(e, dict) and isinstance(e.get('line'), str) and _num(e.get('seconds')):
            seconds[e['line']] = e['seconds']
    duration = timeline.get('duration')
    if not _num(duration) or duration <= 0:
        raise CaptionError('the timeline has no duration')
    end_ms = int(round(duration * 1000))

    problems, placed, placed_ids = [], [], set()
    for p in timeline.get('vo') or []:
        if not (isinstance(p, (list, tuple)) and len(p) >= 2 and isinstance(p[0], str) and _num(p[1])):
            problems.append(f'VO placement {p!r} is not [line id, t0]')
            continue
        lid = p[0]
        placed_ids.add(lid)
        if lid not in texts:
            problems.append(f'VO line {lid} is placed in the timeline but has no text in the episode')
        elif lid not in seconds:
            problems.append(f'VO line {lid} is missing from the VO render report')
        else:
            placed.append((int(round(p[1] * 1000)), lid))
    for lid in texts:
        if lid not in placed_ids:
            problems.append(f'VO line {lid} is in the episode but not placed in the timeline')
    if problems:
        raise CaptionError('; '.join(problems))

    placed.sort()
    cues = []
    for k, (t0, lid) in enumerate(placed):
        limit = (placed[k + 1][0] - GAP_MS) if k + 1 < len(placed) else end_ms
        parts = split_cues(texts[lid])
        if not parts:
            problems.append(f'VO line {lid} produced no cue')
            continue
        times = time_line(t0, int(round(seconds[lid] * 1000)), [len(' '.join(c)) for c in parts], limit)
        for n, (lines, (s, e)) in enumerate(zip(parts, times), start=1):
            cues.append(dict(id=f'{lid}-{n}', line=lid, placed=t0, start=s, end=e, lines=lines))
    check(cues, placed, end_ms, problems)
    return cues


def check(cues, placed, end_ms, problems=None):
    """Raise CaptionError listing every broken rule."""
    problems = list(problems or [])
    first = {}
    for c in cues:
        first.setdefault(c['line'], c)
        if not 0 <= c['start'] < c['end'] <= end_ms:
            problems.append(f'cue {c["id"]} ({stamp(c["start"])} to {stamp(c["end"])}) is outside the render (0 to {stamp(end_ms)})')
        if c['end'] - c['start'] < MIN_CUE_MS:
            problems.append(f'cue {c["id"]} lasts {(c["end"] - c["start"]) / 1000:.2f} s, under {MIN_CUE_MS / 1000:.1f} s')
        if not 1 <= len(c['lines']) <= MAX_LINES or any(len(x) > MAX_CHARS for x in c['lines']):
            problems.append(f'cue {c["id"]} breaks the {MAX_LINES} lines of {MAX_CHARS} characters rule')
    for a, b in zip(cues, cues[1:]):
        if b['start'] - a['end'] < GAP_MS:
            problems.append(f'cue {a["id"]} ends {(b["start"] - a["end"]) / 1000:.2f} s before {b["id"]} starts '
                            f'(needs {GAP_MS / 1000:.1f} s)')
    for t0, lid in placed:
        if lid not in first:
            problems.append(f'VO line {lid} produced no cue')
        elif abs(first[lid]['start'] - t0) > START_TOLERANCE_MS:
            problems.append(f'VO line {lid} starts at {t0 / 1000:.2f} s but its first cue at {first[lid]["start"] / 1000:.2f} s')
    if problems:
        raise CaptionError('; '.join(problems))


def denylisted(cues, maps):
    """[(index, line id)] for every denylisted name in the captions, each pair once. Each VO line's cues are read
    together, so a name split across two cues is still found."""
    text = {}
    for c in cues:
        text.setdefault(c['line'], []).extend(c['lines'])
    found = []
    for lid, lines in text.items():
        for index, _ in find_denylisted(' '.join(lines), maps):
            if (index, lid) not in found:
                found.append((index, lid))
    return found


def webvtt(cues, episode_id):
    out = ['WEBVTT', '', f'NOTE {episode_id}: written VO text from episode.json, timed from the timeline VO placements', '']
    for c in cues:
        out += [c['id'], f'{stamp(c["start"])} --> {stamp(c["end"])}', *[escape(x) for x in c['lines']], '']
    return '\n'.join(out)


# ---------------------------------------------------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------------------------------------------------

def _load_json(path, what):
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        raise InputError(f'cannot read {what} {path}: {err}') from None
    if not isinstance(data, dict):
        raise InputError(f'{what} {path} is not a JSON object')
    return data


def main(argv=None):
    ap = argparse.ArgumentParser(description='Write English WebVTT captions from the timeline VO placements.')
    ap.add_argument('--timeline', required=True, help='the timeline JSON (vo placements, duration)')
    ap.add_argument('--episode', required=True, help='video/episodes/<id>/episode.json (written VO text)')
    ap.add_argument('--report', required=True, help='the VO render-report.json (line seconds)')
    ap.add_argument('--out', help='output .vtt (default <media root>/episodes/<id>/renders/<id>.en.vtt)')
    a = ap.parse_args(argv)
    try:
        timeline = _load_json(a.timeline, 'timeline')
        episode = _load_json(a.episode, 'episode')
        report = _load_json(a.report, 'VO report')
        eid = episode.get('id')
        if not isinstance(eid, str):
            raise InputError(f'episode {a.episode} has no id')
        out = require_media_path(a.out, 'captions') if a.out else os.path.join(episode_dir(eid, 'renders'), f'{eid}.en.vtt')
        try:
            maps = load_local_maps()
        except LocalMapsError as err:
            raise InputError(str(err)) from None
    except (InputError, MediaRootError) as err:
        sys.stderr.write(f'captions.py: {err}\n')
        return 2

    try:
        cues = build(timeline, episode, report)
    except CaptionError as err:
        sys.stderr.write(f'captions.py: {err}\n')
        return 1
    if not maps.denylist:
        sys.stderr.write('captions.py: the denylist is empty (no local name maps), so the captions were not checked for '
                         'names\n')
    hits = denylisted(cues, maps)
    if hits:
        for index, lid in hits:
            sys.stderr.write(f'captions.py: [denylisted #{index}] in VO line {lid}\n')
        sys.stderr.write('captions.py: no captions written\n')
        return 1

    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + '.writing'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(webvtt(cues, eid))
    os.replace(tmp, out)
    lines = len({c['line'] for c in cues})
    print(f'captions: {len(cues)} cues for {lines} VO lines -> {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
