#!/usr/bin/env python3
# Ported from iCentral MarCom 06-edit/compositor/tools/verify.py (173 lines) on 2026-10-20; changes listed in video/verify/NOTES.md
"""Release gate for a render: technical checks against its timeline and episode, a JSON report, exit 0 only when all pass.

  python3 video/verify/verify.py --render <mp4> --timeline <timeline.json> --episode <episode.json> [--draft]
      [--vo-report <render-report.json>] [--report <verify-report.json>] [--size 1920x1080] [--approvals <approvals.md>]

Checks, one row each in the report:
  a format         ffprobe: H.264 High, yuv420p, the output size (--size, default BRAND frame 1920x1080), a constant
                   60 fps, AAC 48 kHz stereo
  b duration       the picture's duration within episode.durationTarget (0.05 s grace for container rounding) and within
                   0.1 s of the timeline's duration
  c loudness       ffmpeg ebur128=peak=true: integrated -14 LUFS +/- 0.5 and true peak at or below -1.0 dBTP, both read
                   from BRAND['loudness'] (video/edit/lib/brand.py), the values the mixer levels to
  d holds          every timeline label (text, tin, tout) holds for at least 1.5 s + 0.3 s per word (brand.min_hold);
                   a label's tout is clamped to the timeline's duration
  e vo_overlap     VO placements (timeline vo: [[line id, t0], ...]) with the VO render report's seconds: every placed
                   line is in the report, consecutive lines are at least 0.15 s apart (dc_build.py:137-139), and no
                   line runs past the end
  f black_frames   ffmpeg blackdetect (d=0.1, pix_th=0.05) outside the first and last 0.2 s and outside layers marked
                   intentional; any black frame left over fails
  g frozen_frames  ffmpeg freezedetect (n=0.001, d=1.5) outside declared holds: label holds (tin to tout), the
                   timeline's holds list and layers marked intentional; a frozen stretch of 1.5 s or more left over fails
  h music_licence  final mode only: the timeline's music has a licenceRef and gate G5 in video/approvals.md is decided
                   (video/edit/lib/approvals.py); --draft reports it as skipped. A timeline without music passes.

Timeline keys read: duration, labels [{text, tin, tout}], vo [[line id, t0]], music ({..., licenceRef} or null), and the
optional declarations holds [[t0, t1], ...] and layers[].intentional (true, or a list naming "black" and/or "freeze"),
which exempt the layer's t0 to t1.

Report: <media root>/episodes/<episode id>/renders/verify-report.json, or --report (which must resolve under the media root):
  {pass, mode, render, timeline, episode, checks: [{id, name, status, pass, detail, values}]}
status is pass, fail or skipped; pass is true, false or null (skipped). The overall pass ignores skipped checks. The VO
report defaults to <media root>/episodes/<episode id>/vo/render-report.json. The render itself must be under the media root:
media never lives in a temporary directory, an agent scratchpad or a git working tree.

Exit codes: 0 every check passed, 1 at least one check failed, 2 the gate could not run (unreadable input, ffmpeg missing or
a temporary build, a path outside the media root).

Standard library only, plus ff.py for its ffmpeg resolver (which refuses temporary and scratchpad builds), so it runs in
any python3.
"""
import argparse
import datetime
import json
import math
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
for _p in (os.path.join(VIDEO, 'lib'), os.path.join(VIDEO, 'edit', 'lib')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import approvals  # noqa: E402
from brand import FRAME, LOUDNESS, min_hold  # noqa: E402
from media import MediaRootError, episode_dir, require_media_path  # noqa: E402

FPS = FRAME['fps']
BLACK = dict(d=0.1, pix_th=0.05, edge=0.2)        # blackdetect settings; black within `edge` s of either end is allowed
FREEZE = dict(n=0.001, d=1.5)                     # freezedetect settings
VO_GAP = 0.15                                     # minimum silence between consecutive VO lines, s
DURATION_GRACE = 0.05                             # container rounding allowed on the durationTarget bounds, s
DURATION_MATCH = 0.1                              # render against timeline duration, s
FRAME_S = 1.0 / FPS
CHECKS = (('a', 'format'), ('b', 'duration'), ('c', 'loudness'), ('d', 'holds'), ('e', 'vo_overlap'),
          ('f', 'black_frames'), ('g', 'frozen_frames'), ('h', 'music_licence'))
REPORT_NAME = 'verify-report.json'


class VerifyError(Exception):
    """The gate cannot run: exit 2."""


# ---------------------------------------------------------------------------------------------------------------------
# Results and intervals
# ---------------------------------------------------------------------------------------------------------------------

def result(cid, ok, detail, values=None, skipped=False):
    name = dict(CHECKS)[cid]
    status = 'skipped' if skipped else ('pass' if ok else 'fail')
    return dict(id=cid, name=name, status=status, pass_=None if skipped else bool(ok), detail=detail, values=values or {})


def _public(row):
    row = dict(row)
    row['pass'] = row.pop('pass_')
    return {k: row[k] for k in ('id', 'name', 'status', 'pass', 'detail', 'values')}


def subtract(interval, spans):
    """interval minus the union of spans, as a sorted list of (start, end) pieces."""
    pieces = [tuple(interval)]
    for s0, s1 in spans:
        nxt = []
        for a, b in pieces:
            if s1 <= a or s0 >= b:
                nxt.append((a, b))
                continue
            if s0 > a:
                nxt.append((a, s0))
            if s1 < b:
                nxt.append((s1, b))
        pieces = nxt
    return [(a, b) for a, b in pieces if b > a]


def _n(count, noun):
    return f'{count} {noun}' + ('' if count == 1 else 's')


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def _span(x):
    if isinstance(x, dict):
        x = [x.get('t0'), x.get('t1')]
    if isinstance(x, (list, tuple)) and len(x) >= 2 and _num(x[0]) and _num(x[1]) and x[1] >= x[0]:
        return (float(x[0]), float(x[1]))
    return None


def intentional_spans(timeline, kind):
    """[t0, t1] of every layer marked intentional for kind ('black' or 'freeze')."""
    out = []
    for L in timeline.get('layers') or []:
        if not isinstance(L, dict):
            continue
        mark = L.get('intentional')
        if mark is True or (isinstance(mark, (list, tuple)) and kind in mark) or mark == kind:
            s = _span([L.get('t0'), L.get('t1')])
            if s:
                out.append(s)
    return out


def hold_spans(timeline):
    """Declared holds: every label's tin to tout, the timeline's holds list, and layers marked intentional for 'freeze'."""
    out = []
    for L in timeline.get('labels') or []:
        if isinstance(L, dict):
            s = _span([L.get('tin'), L.get('tout')])
            if s:
                out.append(s)
    for h in timeline.get('holds') or []:
        s = _span(h)
        if s:
            out.append(s)
    return out + intentional_spans(timeline, 'freeze')


# ---------------------------------------------------------------------------------------------------------------------
# ffmpeg
# ---------------------------------------------------------------------------------------------------------------------

def load_ff():
    try:
        import ff  # noqa: E402  (resolves ffmpeg and ffprobe on import; refuses temporary and scratchpad builds)
    except RuntimeError as err:
        raise VerifyError(str(err)) from None
    return ff


def ffprobe(ff, path):
    r = subprocess.run([ff.FFPROBE, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise VerifyError(f'ffprobe cannot read {path}: {r.stderr.strip()[-300:]}')
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise VerifyError(f'ffprobe gave no JSON for {path}') from None


def ffmpeg_log(ff, args):
    r = subprocess.run([ff.FFMPEG, '-hide_banner', '-nostats', *args, '-f', 'null', '-'], capture_output=True, text=True)
    if r.returncode != 0:
        raise VerifyError(f'ffmpeg failed ({" ".join(args[-4:])}): {r.stderr.strip()[-300:]}')
    return r.stderr


_LEVEL = r'(-?(?:\d+(?:\.\d+)?|inf))'


def parse_ebur128(text):
    """(integrated LUFS, true peak dBTP) from the summary ffmpeg's ebur128 filter prints last; None where absent."""
    i = text.rfind('Summary:')
    if i < 0:
        return None, None
    s = text[i:]
    m_i = re.search(r'\bI:\s+' + _LEVEL + r'\s+LUFS', s)
    m_p = re.search(r'\bPeak:\s+' + _LEVEL + r'\s+dBFS', s)
    return (float(m_i.group(1)) if m_i else None, float(m_p.group(1)) if m_p else None)


def parse_black(text, duration):
    """[(start, end)] from blackdetect; a run still open at the end ends at duration."""
    out = []
    for m in re.finditer(r'black_start:\s*([\d.]+)(?:\s+black_end:\s*([\d.]+))?', text):
        out.append((float(m.group(1)), float(m.group(2)) if m.group(2) else float(duration)))
    return out


def parse_freeze(text, duration):
    """[(start, end)] from freezedetect; a freeze still open at the end ends at duration."""
    events = re.findall(r'lavfi\.freezedetect\.freeze_(start|end):\s*([\d.]+)', text)
    out, start = [], None
    for kind, value in events:
        if kind == 'start':
            if start is not None:
                out.append((start, float(value)))
            start = float(value)
        elif start is not None:
            out.append((start, float(value)))
            start = None
    if start is not None:
        out.append((start, float(duration)))
    return out


def _rate(s):
    try:
        n, d = str(s).split('/')
        return float(n) / float(d) if float(d) else None
    except (ValueError, AttributeError):
        return None


def _streams(info, kind):
    return [s for s in info.get('streams', []) if s.get('codec_type') == kind]


def picture_duration(info):
    v = _streams(info, 'video')
    for cand in ((v[0].get('duration') if v else None), info.get('format', {}).get('duration')):
        try:
            return float(cand)
        except (TypeError, ValueError):
            continue
    return None


# ---------------------------------------------------------------------------------------------------------------------
# Checks a to h
# ---------------------------------------------------------------------------------------------------------------------

def check_format(info, size):
    W, H = size
    problems, values = [], {}
    v, a = _streams(info, 'video'), _streams(info, 'audio')
    if not v:
        problems.append('no video stream')
    else:
        v = v[0]
        r, avg = _rate(v.get('r_frame_rate')), _rate(v.get('avg_frame_rate'))
        values.update(video_codec=v.get('codec_name'), profile=v.get('profile'), pix_fmt=v.get('pix_fmt'),
                      width=v.get('width'), height=v.get('height'), r_frame_rate=v.get('r_frame_rate'),
                      avg_frame_rate=v.get('avg_frame_rate'))
        if v.get('codec_name') != 'h264':
            problems.append(f'video codec {v.get("codec_name")}, not h264')
        if v.get('profile') != 'High':
            problems.append(f'H.264 profile {v.get("profile")}, not High')
        if v.get('pix_fmt') != 'yuv420p':
            problems.append(f'pixel format {v.get("pix_fmt")}, not yuv420p')
        if (v.get('width'), v.get('height')) != (W, H):
            problems.append(f'size {v.get("width")}x{v.get("height")}, not {W}x{H}')
        if r is None or avg is None or abs(r - FPS) > 0.01 or abs(avg - FPS) > 0.01:
            problems.append(f'frame rate {v.get("r_frame_rate")} (average {v.get("avg_frame_rate")}), not a constant {FPS} fps')
    if not a:
        problems.append('no audio stream')
    else:
        a = a[0]
        values.update(audio_codec=a.get('codec_name'), sample_rate=a.get('sample_rate'), channels=a.get('channels'))
        if a.get('codec_name') != 'aac':
            problems.append(f'audio codec {a.get("codec_name")}, not aac')
        if str(a.get('sample_rate')) != str(LOUDNESS['sample_rate']):
            problems.append(f'audio sample rate {a.get("sample_rate")} Hz, not {LOUDNESS["sample_rate"]}')
        if a.get('channels') != 2:
            problems.append(f'{a.get("channels")} audio channels, not stereo')
    ok = not problems
    detail = '; '.join(problems) if problems else \
        f'H.264 High, yuv420p, {W}x{H}, constant {FPS} fps; AAC {LOUDNESS["sample_rate"] // 1000} kHz stereo'
    return result('a', ok, detail, values)


def check_duration(info, episode, timeline):
    dur = picture_duration(info)
    target = episode.get('durationTarget')
    tl_dur = timeline.get('duration')
    values = dict(duration=dur and round(dur, 3), durationTarget=target, timeline_duration=tl_dur)
    if dur is None:
        return result('b', False, 'the render has no readable duration', values)
    if not (isinstance(target, list) and len(target) == 2 and all(_num(x) for x in target) and target[0] <= target[1]):
        return result('b', False, f'episode durationTarget {target!r} is not [min, max] in seconds', values)
    problems = []
    lo, hi = target
    if not lo - DURATION_GRACE <= dur <= hi + DURATION_GRACE:
        problems.append(f'{dur:.2f} s is outside the target {lo:g}-{hi:g} s')
    if not _num(tl_dur):
        problems.append('the timeline has no duration')
    elif abs(dur - tl_dur) > DURATION_MATCH:
        problems.append(f'{dur:.2f} s differs from the timeline duration {tl_dur:.2f} s by more than {DURATION_MATCH} s')
    return result('b', not problems, '; '.join(problems) or f'{dur:.2f} s, within {lo:g}-{hi:g} s and the timeline', values)


def check_loudness(ff, render, info):
    target, tol, tp_max = LOUDNESS['integrated_lufs'], LOUDNESS['tolerance_lu'], LOUDNESS['true_peak_max_dbtp']
    values = dict(target_lufs=target, tolerance_lu=tol, true_peak_max_dbtp=tp_max)
    if not _streams(info, 'audio'):
        return result('c', False, 'no audio stream to measure', values)
    log = ffmpeg_log(ff, ['-i', render, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=verbose'])
    lufs, tp = parse_ebur128(log)
    values.update(integrated_lufs=lufs, true_peak_dbtp=tp)
    if lufs is None or tp is None:
        return result('c', False, 'ebur128 printed no integrated loudness or true peak', values)
    problems = []
    if not (math.isfinite(lufs) and abs(lufs - target) <= tol + 1e-9):
        problems.append(f'integrated {lufs:.1f} LUFS, outside {target:g} +/- {tol:g}')
    if not tp <= tp_max + 1e-9:
        problems.append(f'true peak {tp:.1f} dBTP, above {tp_max:g}')
    return result('c', not problems, '; '.join(problems) or f'integrated {lufs:.1f} LUFS, true peak {tp:.1f} dBTP', values)


def check_holds(timeline):
    labels = timeline.get('labels') or []
    dur = timeline.get('duration')
    rows, problems = [], []
    for n, L in enumerate(labels, start=1):
        text = L.get('text') if isinstance(L, dict) else None
        tin = L.get('tin') if isinstance(L, dict) else None
        tout = L.get('tout') if isinstance(L, dict) else None
        if not (isinstance(text, str) and text.strip() and _num(tin) and _num(tout)):
            problems.append(f'label {n} has no text, tin or tout')
            continue
        end = min(tout, dur) if _num(dur) else tout
        hold, need = end - tin, min_hold(text)
        ok = hold >= need - 1e-6
        rows.append(dict(label=n, text=text, kind=L.get('kind'), tin=round(tin, 3), tout=round(tout, 3),
                         words=len(text.split()), hold=round(hold, 3), need=round(need, 2), ok=ok))
        if not ok:
            problems.append(f'label {n} "{text}" holds {hold:.2f} s, needs {need:.2f} s for {len(text.split())} words')
    if not labels:
        return result('d', True, 'no labels in the timeline', dict(labels=[]))
    return result('d', not problems, '; '.join(problems) or f'{_n(len(rows), "label")}, each at least its minimum hold',
                  dict(labels=rows))


def load_vo_seconds(path):
    with open(path, encoding='utf-8') as f:
        rep = json.load(f)
    lines = rep.get('lines') if isinstance(rep, dict) else None
    if not isinstance(lines, list):
        raise ValueError('no "lines" list')
    return {e['line']: float(e['seconds']) for e in lines
            if isinstance(e, dict) and isinstance(e.get('line'), str) and _num(e.get('seconds'))}


def check_vo(timeline, vo_report_path):
    placements = timeline.get('vo') or []
    dur = timeline.get('duration')
    values = dict(vo_report=vo_report_path, min_gap=VO_GAP)
    if not placements:
        return result('e', True, 'no VO placements in the timeline', values)
    try:
        seconds = load_vo_seconds(vo_report_path)
    except FileNotFoundError:
        return result('e', False, f'VO report not found: {vo_report_path}', values)
    except (OSError, ValueError, KeyError, TypeError) as err:
        return result('e', False, f'VO report {vo_report_path} is unreadable ({type(err).__name__}: {err})', values)
    problems, spans = [], []
    for p in placements:
        if not (isinstance(p, (list, tuple)) and len(p) >= 2 and isinstance(p[0], str) and _num(p[1])):
            problems.append(f'VO placement {p!r} is not [line id, t0]')
            continue
        line, t0 = p[0], float(p[1])
        if line not in seconds:
            problems.append(f'VO line {line} is placed at {t0:.2f} s but missing from the VO report')
            continue
        spans.append((t0, t0 + seconds[line], line))
    spans.sort()
    for a, b in zip(spans, spans[1:]):
        if a[1] > b[0] - VO_GAP + 1e-9:
            problems.append(f'VO {a[2]} ends at {a[1]:.2f} s, {b[0] - a[1]:.2f} s before {b[2]} starts at {b[0]:.2f} s '
                            f'(needs {VO_GAP} s)')
    for t0, t1, line in spans:
        if t0 < 0:
            problems.append(f'VO {line} starts before 0 s')
        if _num(dur) and t1 > dur + 1e-6:
            problems.append(f'VO {line} runs to {t1:.2f} s, past the end at {dur:.2f} s')
    values['lines'] = [dict(line=l, t0=round(a, 3), t1=round(b, 3)) for a, b, l in spans]
    return result('e', not problems, '; '.join(problems) or f'{_n(len(spans), "VO line")}, none overlapping', values)


def detect_frames(ff, render):
    return ffmpeg_log(ff, ['-i', render, '-map', '0:v:0', '-vf',
                           f'blackdetect=d={BLACK["d"]}:pix_th={BLACK["pix_th"]},freezedetect=n={FREEZE["n"]}:d={FREEZE["d"]}'])


def check_black(log, duration, timeline):
    runs = parse_black(log, duration)
    exempt = [(0.0, BLACK['edge']), (duration - BLACK['edge'], duration)] + intentional_spans(timeline, 'black')
    bad = []
    for run in runs:
        for a, b in subtract(run, exempt):
            if b - a >= FRAME_S - 1e-3:
                bad.append((round(a, 3), round(b, 3)))
    values = dict(detected=[[round(a, 3), round(b, 3)] for a, b in runs], outside_allowed=[list(x) for x in bad],
                  settings=dict(d=BLACK['d'], pix_th=BLACK['pix_th'], edge_s=BLACK['edge']))
    if bad:
        return result('f', False, 'black frames at ' + ', '.join(f'{a:.2f}-{b:.2f} s' for a, b in bad), values)
    return result('f', True, 'no black frames' + (' outside the allowed edges and intentional layers' if runs else ''), values)


def check_frozen(log, duration, timeline):
    runs = parse_freeze(log, duration)
    holds = hold_spans(timeline)
    bad = []
    for run in runs:
        for a, b in subtract(run, holds):
            if b - a >= FREEZE['d'] - FRAME_S:
                bad.append((round(a, 3), round(b, 3)))
    values = dict(detected=[[round(a, 3), round(b, 3)] for a, b in runs], outside_holds=[list(x) for x in bad],
                  settings=dict(n=FREEZE['n'], d=FREEZE['d']))
    if bad:
        return result('g', False, 'frozen picture outside declared holds at ' +
                      ', '.join(f'{a:.2f}-{b:.2f} s' for a, b in bad), values)
    return result('g', True, 'no frozen picture' + (' outside declared holds' if runs else ''), values)


def check_music(timeline, draft, approvals_path):
    if draft:
        return result('h', None, 'draft mode: the music licence is checked on final renders only', skipped=True)
    music = timeline.get('music')
    if not music:
        return result('h', True, 'the timeline has no music, so no licence is needed', dict(music=None))
    problems, values = [], {}
    ref = music.get('licenceRef') if isinstance(music, dict) else None
    values['licenceRef'] = ref
    if not (isinstance(ref, str) and ref.strip()):
        problems.append('the timeline music has no licenceRef')
    try:
        row = approvals.latest('G5', approvals_path)
        decided = approvals.is_approved('G5', approvals_path)
    except (OSError, ValueError) as err:
        row, decided = None, False
        problems.append(f'cannot read the approvals log: {err}')
    else:
        values['G5'] = row and dict(decision=row['decision'], date=row['date'], version=row['version'])
        if not decided:
            problems.append(f'gate G5 (music licence) is not decided in video/approvals.md: '
                            f'{row["decision"] if row else "no row"}')
    return result('h', not problems, '; '.join(problems) or f'licence {ref}; gate G5 {row["decision"]}', values)


# ---------------------------------------------------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------------------------------------------------

def _size(s):
    m = re.fullmatch(r'(\d+)x(\d+)', s or '')
    if not m:
        raise argparse.ArgumentTypeError('size must be WIDTHxHEIGHT, for example 1920x1080')
    return int(m.group(1)), int(m.group(2))


def _load_json(path, what):
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        raise VerifyError(f'cannot read {what} {path}: {err}') from None
    if not isinstance(data, dict):
        raise VerifyError(f'{what} {path} is not a JSON object')
    return data


def run(a):
    """All checks; returns (report, report path). Raises VerifyError or MediaRootError when the gate cannot run."""
    render = require_media_path(a.render, 'render')
    if not os.path.isfile(render):
        raise VerifyError(f'render not found: {a.render}')
    timeline = _load_json(a.timeline, 'timeline')
    episode = _load_json(a.episode, 'episode')
    eid = episode.get('id')
    if not isinstance(eid, str):
        raise VerifyError(f'episode {a.episode} has no id')
    report_path = require_media_path(a.report, 'report') if a.report else os.path.join(episode_dir(eid, 'renders'), REPORT_NAME)
    vo_report = a.vo_report or os.path.join(episode_dir(eid, 'vo'), 'render-report.json')

    ff = load_ff()
    info = ffprobe(ff, render)
    duration = picture_duration(info) or float(timeline.get('duration') or 0)
    rows = [check_format(info, a.size), check_duration(info, episode, timeline), check_loudness(ff, render, info),
            check_holds(timeline), check_vo(timeline, vo_report)]
    log = detect_frames(ff, render)
    rows += [check_black(log, duration, timeline), check_frozen(log, duration, timeline),
             check_music(timeline, a.draft, a.approvals)]
    ok = all(r['pass_'] for r in rows if r['status'] != 'skipped')
    report = dict(**{'pass': ok}, mode='draft' if a.draft else 'final', episode=eid, render=render,
                  timeline=os.path.abspath(a.timeline), generated=datetime.datetime.now().isoformat(timespec='seconds'),
                  checks=[_public(r) for r in rows])
    return report, report_path


def main(argv=None):
    ap = argparse.ArgumentParser(description='Verify a render against its timeline and episode (exit 0 only when every check passes).')
    ap.add_argument('--render', required=True, help='the muxed MP4 under the media root')
    ap.add_argument('--timeline', required=True, help='the timeline JSON the render was made from')
    ap.add_argument('--episode', required=True, help='video/episodes/<id>/episode.json')
    ap.add_argument('--draft', action='store_true', help='skip the music licence check (h)')
    ap.add_argument('--vo-report', help='VO render-report.json (default <media root>/episodes/<id>/vo/render-report.json)')
    ap.add_argument('--report', help='where to write verify-report.json (default the episode renders folder)')
    ap.add_argument('--size', type=_size, default=(FRAME['w'], FRAME['h']), help='expected WIDTHxHEIGHT (default 1920x1080)')
    ap.add_argument('--approvals', help=argparse.SUPPRESS)       # tests: an approvals log other than video/approvals.md
    a = ap.parse_args(argv)
    try:
        report, path = run(a)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=1)
            f.write('\n')
    except (VerifyError, MediaRootError) as err:
        sys.stderr.write(f'verify.py: {err}\n')
        return 2
    for c in report['checks']:
        print(f'{c["id"]} {c["name"]:<14} {c["status"]:<7} {c["detail"]}')
    print(f'verify: {"PASS" if report["pass"] else "FAIL"} ({report["mode"]}) -> {path}')
    return 0 if report['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
