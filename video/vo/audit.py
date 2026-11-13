#!/usr/bin/env python3
"""Audit an episode's voice lines the way a listener would: each line's edges, gaps, loudness and clipping, and the spread of
loudness across lines. Needs numpy, scipy and soundfile (the media-root venv, $SA_VIDEO_PYTHON).

  $SA_VIDEO_PYTHON video/vo/audit.py --episode video/episodes/<id>/episode.json [--json out.json]

Per line (from <media root>/episodes/<id>/vo/<line>.wav):
  head/tail   level of the first and last 10 ms in dBFS: a line that starts or ends louder than -60 dBFS was cut mid-sound
              (a click); with the 50 ms / 70 ms raised-cosine fades from render-brian.py both read below -60
  gaps        silences longer than 0.6 s inside the line (a dropout, or a pause too long to sound natural)
  stray       sound after a pause of 0.25 s or more at the end of the line, shorter than 0.2 s (a leaked syllable)
  lufs        BS.1770 integrated loudness of the line; spread = max - min across lines must be within 1.0 LU
  peak, clip  sample peak in dBFS, and the count of samples at or above 0.999
Exit 1 when any line fails.
"""
import argparse
import json
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'edit', 'audio'))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
sys.path.insert(0, os.path.join(HERE, '..', 'edit', 'lib'))
import build_audio as B  # noqa: E402
import media_root  # noqa: E402


def db(v):
    return 20 * np.log10(abs(v) + 1e-9)


def frames_db(x, sr, hop_s=0.01):
    h = int(hop_s * sr)
    n = len(x) // h
    return 10 * np.log10((x[:n * h].reshape(n, h) ** 2).mean(1) + 1e-14)


def audit_line(x, sr):
    f = frames_db(x, sr)
    on = f > f.max() - 45
    idx = np.nonzero(on)[0]
    gaps, k = [], idx[0]
    for a, b in zip(idx, idx[1:]):
        if (b - a) * 0.01 > 0.6:
            gaps.append(round((b - a) * 0.01, 2))
    runs, start = [], idx[0]
    for a, b in zip(idx, idx[1:]):
        if (b - a) * 0.01 >= 0.25:
            runs.append((start, a)); start = b
    runs.append((start, idx[-1]))
    stray = len(runs) > 1 and (runs[-1][1] - runs[-1][0] + 1) * 0.01 < 0.2
    h10 = int(0.01 * sr)
    return dict(seconds=round(len(x) / sr, 2), head_db=round(float(db(np.abs(x[:h10]).max())), 1), tail_db=round(float(db(np.abs(x[-h10:]).max())), 1),
                gaps_over_0_6s=gaps, stray_tail=bool(stray), lufs=round(B.lufs(np.stack([x, x], 1)), 2),
                peak_db=round(float(db(np.abs(x).max())), 1), clipped=int((np.abs(x) >= 0.999).sum()))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--episode', required=True)
    ap.add_argument('--json')
    a = ap.parse_args(argv)
    ep = json.load(open(a.episode))
    vo_dir = media_root.episode_dir(ep['id'], 'vo')
    rows, bad = {}, []
    for line in ep['vo']:
        x, sr = sf.read(os.path.join(vo_dir, line['id'] + '.wav'))
        x = x if x.ndim == 1 else x.mean(1)
        r = audit_line(x, sr)
        rows[line['id']] = r
        why = []
        if r['head_db'] > -60: why.append('head not faded')
        if r['tail_db'] > -60: why.append('tail cut mid-sound')
        if r['gaps_over_0_6s']: why.append('gap over 0.6 s')
        if r['stray_tail']: why.append('stray sound after the last word')
        if r['clipped']: why.append('clipped')
        if r['peak_db'] > -1.0: why.append('peak above -1 dBFS')
        if why: bad.append((line['id'], why))
        print(f"{line['id']:5s} {r['seconds']:5.2f} s  head {r['head_db']:6.1f}  tail {r['tail_db']:6.1f}  {r['lufs']:6.2f} LUFS  peak {r['peak_db']:5.1f}  gaps {r['gaps_over_0_6s']}  {'; '.join(why)}")
    l = [r['lufs'] for r in rows.values()]
    spread = max(l) - min(l)
    print(f'loudness spread {spread:.2f} LU (max {max(l):.2f}, min {min(l):.2f})')
    if spread > 1.0: bad.append(('(all)', [f'loudness spread {spread:.2f} LU > 1.0']))
    if a.json:
        json.dump(dict(lines=rows, spread_lu=round(spread, 2)), open(a.json, 'w'), indent=1)
    print('audit:', 'FAIL ' + str(bad) if bad else 'PASS')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
