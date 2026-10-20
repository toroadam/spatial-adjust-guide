"""Synthetic take for the compositor tests: no IntelliDash, no network.

  python3 video/edit/tests/make_test_clip.py [--force]

Writes <media root>/episodes/_test/capture/raw/test_take.mp4 (ffmpeg testsrc2, 3840x2160, 60 fps, 3 s, H.264 BT.709, the
size a 1920x1080 CSS-px capture at device scale 2 records) and test_take-track.json beside it, in the capture track format
of take.mjs:65: { file, fps: 60, units, frames: [[t, x, y, a, ripple, focusBox | null], ...], clicks: [] }. The cursor
circles the window centre; a focus box is set from 1.0 s to 2.0 s. Both files are reused while they match.
"""
import json
import math
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib'))
from media import TEST_EPISODE, episode_dir  # noqa: E402

W, H, FPS, SECONDS = 3840, 2160, 60, 3.0
UNITS = 'CSS px (1920x1080); frame = [t, x, y, a, ripple, focusBox [x0, y0, x1, y1] | null]'


def track():
    frames = []
    for i in range(int(SECONDS * FPS) + 1):
        t = round(i / FPS, 4)
        ph = 2 * math.pi * t / SECONDS
        box = [760, 420, 1160, 660] if 1.0 <= t < 2.0 else None
        frames.append([t, round(960 + 520 * math.cos(ph), 2), round(540 + 260 * math.sin(ph), 2), 255, 0, box])
    return dict(file='test_take.mp4', fps=FPS, units=UNITS, frames=frames, clicks=[])


def _ok(ff, clip):
    if not os.path.exists(clip): return False
    p = ff.probe(clip)
    return (p['w'], p['h']) == (W, H) and abs((p['fps'] or 0) - FPS) < 0.01 and abs((p['duration'] or 0) - SECONDS) < 0.05


def make(force=False):
    import ff                                   # resolves ffmpeg by the pipeline rules (FFMPEG or PATH, never a temp build)
    raw = episode_dir(TEST_EPISODE, 'capture', 'raw')
    clip = os.path.join(raw, 'test_take.mp4'); trk = os.path.join(raw, 'test_take-track.json')
    if force or not _ok(ff, clip):
        subprocess.run([ff.FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'testsrc2=size={W}x{H}:rate={FPS}:duration={SECONDS}',
                        '-vf', 'format=rgb24,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high',
                        '-preset', 'veryfast', '-crf', '20', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                        '-color_range', 'tv', '-movflags', '+faststart', '-an', clip], check=True)
    data = track()
    current = None
    if os.path.exists(trk):
        with open(trk) as f:
            try: current = json.load(f)
            except ValueError: current = None
    if force or current != data:
        with open(trk, 'w') as f:
            json.dump(data, f)
    return clip, trk


if __name__ == '__main__':
    c, k = make('--force' in sys.argv[1:])
    print(c); print(k)
