#!/usr/bin/env python3
"""OCR denylist scan of every showcase take, one report per take, counts only.

Runs the pipeline's own OCR gate (video/verify/ocr_check.py, as delivered) on each take file named
on the command line or, with no arguments, on every take under
<media root>/showcase/capture/raw/ that has a safety report. The gate samples a frame every 0.5 s,
reads it on the Mac with Apple Vision and matches it against the local name maps. A take is a
bare recording with no labels, so the gate gets an empty timeline.

  python3 video/showcase/scan-takes.py [take.mp4 ...] [--every 0.5]

Reports go to <media root>/showcase/capture/review/ocr/<take>.json. This script prints the take
name, the frame count and the hit count only, never a name and never the denylist. Exit codes:
0 every scanned take has 0 hits; 1 a take has a hit; 2 the check could not run on a take.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
for _p in (os.path.join(VIDEO, 'verify'), os.path.join(VIDEO, 'lib'), os.path.join(VIDEO, 'edit', 'lib')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import ocr_check  # noqa: E402  (the pipeline's OCR gate, used as delivered)
import media_root as MR  # noqa: E402

EPISODE = os.path.join(VIDEO, 'showcase', 'episode.json')


def capture_dir():
    with open(EPISODE, encoding='utf-8') as f:
        eid = json.load(f)['id']
    return os.path.join(MR.episode_dir(eid), 'capture')


def main(argv):
    every = '0.5'
    args = list(argv)
    if '--every' in args:
        i = args.index('--every')
        every = args[i + 1]
        del args[i:i + 2]
    cap = capture_dir()
    raw = os.path.join(cap, 'raw')
    takes = [os.path.abspath(a) for a in args]
    if not takes:
        takes = sorted(os.path.join(raw, n) for n in os.listdir(raw)
                       if n.endswith('.mp4') and os.path.exists(os.path.join(raw, n[:-4] + '-safety.json')))
    if not takes:
        sys.stderr.write('scan-takes: no takes to scan\n')
        return 2
    out = os.path.join(cap, 'review', 'ocr')
    os.makedirs(out, exist_ok=True)
    timeline = os.path.join(cap, 'review', 'empty-timeline.json')
    with open(timeline, 'w', encoding='utf-8') as f:
        f.write('{}\n')
    worst = 0
    for t in takes:
        stem = os.path.basename(t)[:-4]
        report = os.path.join(out, stem + '.json')
        code = ocr_check.main(['--render', t, '--timeline', timeline, '--episode', EPISODE, '--every', every,
                               '--report', report])
        worst = max(worst, 2 if code >= 2 else code)
        if code == 0:
            with open(report, encoding='utf-8') as f:
                r = json.load(f)
            print(f'scan-takes: {stem}: {r["frames"]} frames, {len(r["hits"])} hits')
        else:
            print(f'scan-takes: {stem}: exit {code}')
    return worst


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
