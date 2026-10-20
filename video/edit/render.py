# Ported from iCentral MarCom 06-edit/compositor/render.py (71 lines) and double-clicks/tools/dc_render.py (45 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""Render one timeline's picture to H.264 (video only; the audio mix is muxed later).

  python3 video/edit/render.py --timeline <timeline.json>                        -> the timeline's video_out
  python3 video/edit/render.py --timeline <timeline.json> --from 3.5 --to 5.0    -> partial render (review)
  python3 video/edit/render.py --timeline <timeline.json> --still 4.0 [--out x.png]  -> one PNG (style frames)
  options: --out <path>  --crf 16  --preset slow

Encoding: libx264, profile High, yuv420p, BT.709 tags, 60 fps, CRF 16, +faststart (plays on the guides site's players).
Every output path (video_out, --out, the stills folder) must resolve under the media root: a temporary directory, an agent
scratchpad, this repository or any other git working tree is refused with exit 2 before anything is rendered.

Engines: the timeline's "engine" 2 (the default TL.json writes) renders with renderer.Renderer, engine2 plus the registered
layer types (glass, ...); engine 1 or no engine renders with the v1 engine.Renderer.
"""
import argparse, json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
from media import MediaRootError, require_media_path  # noqa: E402  (stdlib only: checks run before torch loads)

FPS = 60


def fail(msg, code=2):
    sys.stderr.write(f'render.py: {msg}\n')
    sys.exit(code)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Render a timeline JSON to H.264 or a still PNG.')
    ap.add_argument('--timeline', required=True)
    ap.add_argument('--out')
    ap.add_argument('--from', dest='t_from', type=float)
    ap.add_argument('--to', dest='t_to', type=float)
    ap.add_argument('--still', type=float)
    ap.add_argument('--crf', type=int, default=16)
    ap.add_argument('--preset', default='slow')
    a = ap.parse_args(argv)

    try:
        with open(a.timeline) as f:
            tl = json.load(f)
    except (OSError, ValueError) as err:
        fail(f'cannot read timeline {a.timeline}: {err}')
    for k in ('w', 'h', 'duration', 'layers'):
        if k not in tl: fail(f'timeline {a.timeline} has no "{k}"')
    if tl.get('fps', FPS) != FPS: fail(f'timeline fps {tl.get("fps")} is not {FPS}; the engine is frame-stepped at {FPS} fps')
    if tl.get('engine') not in (None, 1, 2): fail(f'timeline engine {tl.get("engine")} is not ported (engines 1 and 2 are)')
    W, H, dur = tl['w'], tl['h'], tl['duration']

    if a.still is not None:
        if a.out: out = a.out
        elif tl.get('video_out'): out = os.path.join(tl['video_out'].rsplit('.', 1)[0] + '_stills', f'{a.still:07.3f}.png')
        else: fail('--still needs --out or a timeline video_out')
    else:
        out = a.out or tl.get('video_out')
        if not out: fail('the timeline has no video_out and no --out was given')
    try:
        out = require_media_path(out, 'output')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        out = require_media_path(out, 'output')
    except MediaRootError as err:
        fail(str(err))

    try:
        import torch  # noqa: E402
    except ImportError:
        fail(f'torch is not installed for {sys.executable}: run with the pipeline Python ($SA_VIDEO_PYTHON, the venv at the '
             'media root; see video/README.md, Prerequisites)', 1)
    try:
        from ff import FFMPEG, write_img  # noqa: E402
    except RuntimeError as err:          # ff.FFmpegError: ffmpeg missing, or a temporary or scratchpad build
        fail(str(err), 1)
    if tl.get('engine') == 2:
        from renderer import Renderer  # noqa: E402
    else:
        from engine import Renderer  # noqa: E402

    def to_u8(img):
        return (img[0].clamp(0, 1) * 255 + 0.5).to(torch.uint8).permute(1, 2, 0).contiguous().cpu().numpy()

    if a.still is not None:
        # stills are rendered by a fresh renderer so sequential decoders seek to src_in and read forward, frame-exact
        R = Renderer(tl, HERE)
        try: write_img(to_u8(R.frame(round(a.still * FPS) / FPS)), out)
        finally: R.close()
        print(f'still {a.still:.3f} s -> {out}')
        return 0

    i0, i1 = 0, int(round(dur * FPS))
    if a.t_from is not None: i0 = int(round(a.t_from * FPS))
    if a.t_to is not None: i1 = int(round(a.t_to * FPS))
    if not 0 <= i0 < i1: fail(f'empty frame range {i0}..{i1}')
    cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-framerate', str(FPS), '-i', '-',
           '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
           '-preset', a.preset, '-crf', str(a.crf),
           '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
           '-color_range', 'tv', '-r', str(FPS), '-movflags', '+faststart', out]
    R = Renderer(tl, HERE)
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    try:
        # sources are sequential; when starting mid-timeline, frames before i0 for already-active layers are skipped by the decoders' get(k)
        for i in range(i0, i1):
            t = i / FPS
            ff.stdin.write(to_u8(R.frame(t)).tobytes())
            R.release(t)
            if (i - i0) % 300 == 0:
                el = time.time() - t0; print(f'  {tl.get("name", "timeline")} frame {i}/{i1}  {el:.0f}s  {(i - i0 + 1) / max(el, 1e-3):.1f} fps', flush=True)
    except BrokenPipeError:
        pass
    finally:
        try: ff.stdin.close()
        except BrokenPipeError: pass
        rc = ff.wait()
        R.close()
    if rc != 0: fail(f'ffmpeg exited {rc} writing {out}', 1)
    print(f'{tl.get("name", "timeline")}: {i1 - i0} frames in {time.time() - t0:.0f}s -> {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
