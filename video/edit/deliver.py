#!/usr/bin/env python3
"""Assemble a verified Double Click episode's deliverables (video/episodes/RUNBOOK.md, EP-7).

    $SA_VIDEO_PYTHON video/edit/deliver.py --episode video/episodes/<id>/episode.json [--poster-at 6.3]

Reads <media root>/episodes/<id>/edit/timeline.json (a --final build) and refuses unless renders/verify-report.json and
renders/ocr-report.json both passed on that timeline's render and renders/<id>.en.vtt exists (npm run video -- captions).
Then it writes exactly the four files the publishing step takes, into <media root>/episodes/<id>/deliver/:

  <key>.mp4             the final render, copied byte for byte
  <key>.en.vtt          the English captions, copied
  <key>.poster.jpg      a still of the title card (render.py --still, default 1 s before the card leaves), as JPEG q 3
  <key>.transcript.txt  the title card text, every VO line's written text in order, the end-card text and the guide
                        address on the site

and prints runtimeSec, lufs and truePeak from the verify report for series.json. Exit 0 written, 1 a check had not passed
or a step failed, 2 usage or configuration.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
sys.path.insert(0, os.path.join(HERE, 'lib'))

import media_root as MR  # noqa: E402
from brand import DURATIONS  # noqa: E402

SITE = 'https://toroadam.github.io/spatial-adjust-guide/'


def fail(msg, code=1):
    sys.stderr.write(f'deliver: {msg}\n')
    return code


def measure(report):
    """runtimeSec, lufs and truePeak for series.json, from verify-report.json's duration (b) and loudness (c) checks."""
    vals = {c.get('id'): c.get('values', {}) for c in report.get('checks', []) if isinstance(c, dict)}
    return dict(runtimeSec=round(vals.get('b', {}).get('duration', 0), 1) or None,
                lufs=vals.get('c', {}).get('integrated_lufs'), truePeak=vals.get('c', {}).get('true_peak_dbtp'))


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--episode', required=True)
    ap.add_argument('--poster-at', type=float, help='seconds into the video for the poster still (default: the title card)')
    a = ap.parse_args(argv)
    try:
        with open(a.episode, encoding='utf-8') as fh:
            ep = json.load(fh)
        key = ep['guide']
        edit = MR.episode_dir(ep['id'], 'edit')
        renders = MR.episode_dir(ep['id'], 'renders')
        deliver = MR.episode_dir(ep['id'], 'deliver')
    except (OSError, ValueError, KeyError, MR.MediaRootError) as err:
        return fail(f'cannot read the episode or the media root: {err}', 2)
    tl_path = os.path.join(edit, 'timeline.json')
    try:
        with open(tl_path, encoding='utf-8') as fh:
            tl = json.load(fh)
    except (OSError, ValueError) as err:
        return fail(f'no timeline at {tl_path}: {err}', 2)
    if tl.get('mode') != 'final':
        return fail(f'{tl_path} is a {tl.get("mode")} build; deliver needs build --final')
    render = os.path.join(renders, f'{ep["id"]}-take{tl["take"]}.mp4')
    reports = {}
    for name in ('verify-report.json', 'ocr-report.json'):
        p = os.path.join(renders, name)
        try:
            with open(p, encoding='utf-8') as fh:
                reports[name] = json.load(fh)
        except (OSError, ValueError):
            return fail(f'{name} is missing: run npm run video -- {name.split("-")[0]} on {render}')
        r = reports[name]
        if not r.get('pass') or os.path.realpath(r.get('render', '')) != os.path.realpath(render):
            return fail(f'{name} has not passed on {os.path.basename(render)}')
    if reports['verify-report.json'].get('mode') != 'final':
        return fail('verify-report.json is a --draft verify; run verify in final mode')
    vtt = os.path.join(renders, f'{ep["id"]}.en.vtt')
    if not os.path.exists(vtt):
        return fail(f'no captions at {vtt}: run npm run video -- captions')

    for f in os.listdir(deliver):                                   # deliver/ holds exactly the four files
        os.remove(os.path.join(deliver, f))
    shutil.copyfile(render, os.path.join(deliver, f'{key}.mp4'))
    shutil.copyfile(vtt, os.path.join(deliver, f'{key}.en.vtt'))

    t_poster = a.poster_at
    if t_poster is None:                                            # the title card, its title fully in, before it leaves
        t_poster = round(DURATIONS['lockup'] + DURATIONS['title_card'] - 1.0, 2)
    png = os.path.join(edit, f'{key}.poster.png')
    py = os.environ.get('SA_VIDEO_PYTHON') or sys.executable
    r = subprocess.run([py, os.path.join(HERE, 'render.py'), '--timeline', tl_path, '--still', str(t_poster), '--out', png],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(png):
        return fail(f'poster still failed: {r.stderr.strip()[-400:]}')
    ff = os.environ.get('FFMPEG') or 'ffmpeg'
    r = subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3',
                        os.path.join(deliver, f'{key}.poster.jpg')], capture_output=True, text=True)
    os.remove(png)
    if r.returncode != 0:
        return fail(f'poster JPEG failed: {r.stderr.strip()[-400:]}')

    lines = [ep['titleCard']['text'], '']
    lines += [v['text'] for v in ep['vo']]
    end = ep.get('endCard') or {}
    lines += ['', end.get('text', ''), f'{SITE}{end.get("address", "#/" + key)}']
    with open(os.path.join(deliver, f'{key}.transcript.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines).rstrip('\n') + '\n')

    print(f'deliver: {deliver}: {sorted(os.listdir(deliver))}')
    print('deliver: for series.json: ' + json.dumps(measure(reports['verify-report.json'])))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
