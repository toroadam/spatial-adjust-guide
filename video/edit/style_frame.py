"""Style frame: one still of every brand element, and a contact sheet, for gate G3 (video/approvals.md).

  python3 video/edit/style_frame.py --version v1 [--plate recreation|smoke]
  npm run video -- style-frame --version v1

Builds one short 16:9 timeline with lib/cards.py (the lockup on the hero wall, the title card for "Dashboard overview",
the typed chapter card READ THE MAP, one window shot with the chapter strip and the blue focus box, the end card) plus a
second of each wall preset, renders a still at the key moment of each with video/edit/render.py --still, and writes:

  <media root>/style-frames/<version>/01-lockup.png ... 08-wall-hero.png   one still per element (FRAMES)
  <media root>/style-frames/<version>/sheet.jpg                            the contact sheet
  <media root>/style-frames/<version>/manifest.json                        what was rendered from what (commit, plate, G4)
  <media root>/style-frames/<version>/_build/                              timeline, graphics and the window shot's plate

The window shot's plate is a still of the guide site's own recreation of Spatial Adjust (gfx/recreation_still.mjs: the
built dist/ on loopback, the "Dashboard overview" guide's app figure at 3840x2160 with the focus box on the moisture
legend), looped into a 4 s clip; --plate smoke uses the compositor's synthetic test clip instead, and the recreation falls
back to it when dist/ or Chromium is missing. No IntelliDash is needed. The end card is drawn in draft mode: with gate G4
decided it shows the decided URL, otherwise URL PENDING APPROVAL. Nothing is written to the repository.
"""
import argparse
import json
import os
import socket
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, 'lib'))
sys.path.insert(0, os.path.join(REPO, 'video', 'lib'))
import media_root as MR  # noqa: E402
from media import MediaRootError, ensure_media_dir  # noqa: E402

RENDER = os.path.join(HERE, 'render.py')
RECREATION_STILL = os.path.join(HERE, 'gfx', 'recreation_still.mjs')
VERSION = __import__('re').compile(r'^v[0-9]+[a-z]?$')

EPISODE_TITLE = 'Dashboard overview'
GUIDE_PATH = '/#/dashboard-overview'
CHAPTER = 'READ THE MAP'
CHAPTERS = ['Start with the toolbar', 'Read the map', 'Use the chart', 'Work in the table', 'Check the counts']
ACTIVE = 1                                   # the window shot sits in chapter 2, "Read the map"
HIGHLIGHT = ['0-5%', '> 30%']                # the moisture legend: the element the window shot describes
SHOT = 6.5                                   # window shot length, s
PLATE = 4.0                                  # plate clip length, s (the shot plays it at speed SHOT/PLATE < 1)

# name, what it shows: the order of the stills and the sheet
FRAMES = (
    ('01-lockup', 'Lockup on the hero wall'),
    ('02-title-card', 'Title card'),
    ('03-chapter-card', 'Chapter card'),
    ('04-window-shot', 'Window shot, chapter strip, focus box'),
    ('05-end-card', 'End card'),
    ('06-wall-bloom', 'Wall: bloom (behind window shots)'),
    ('07-wall-card', 'Wall: card (behind cards)'),
    ('08-wall-hero', 'Wall: hero (lockup, end card)'),
)


def fail(msg, code=2):
    sys.stderr.write(f'style_frame.py: {msg}\n')
    sys.exit(code)


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def git_head():
    r = subprocess.run(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True)
    dirty = subprocess.run(['git', '-C', REPO, 'status', '--porcelain', '--', 'video'], capture_output=True, text=True).stdout.strip()
    return (r.stdout.strip() or 'unknown') + ('+dirty' if dirty else '')


def recreation_plate(build, ff):
    """The recreation still looped into a PLATE-second clip: (clip, track rows, provenance) or None when it cannot be made."""
    from brand import BRAND
    png = os.path.join(build, 'recreation.png')
    spec = dict(out=png, path=GUIDE_PATH, scale=2, highlightText=HIGHLIGHT, pad=6, cursorAt=[0.36, 0.74],
                focusBox=BRAND['focus_box'], cursor=BRAND['cursor_spec'])
    spec_file = os.path.join(build, 'recreation-spec.json')
    with open(spec_file, 'w') as f:
        json.dump(spec, f, indent=1)
    env = dict(os.environ)
    env.setdefault('SA_RECREATION_PORT', str(free_port()))       # never collide with a server another checkout runs
    r = subprocess.run(['node', RECREATION_STILL, spec_file], cwd=REPO, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(f'style_frame.py: recreation still failed, using the smoke clip: {r.stderr.strip()[-600:]}\n')
        return None
    info = json.loads(r.stdout.strip().splitlines()[-1])
    clip = os.path.join(build, 'recreation-plate.mp4')
    subprocess.run([ff.FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '60', '-i', png, '-t', str(PLATE),
                    '-vf', 'format=rgb24,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high',
                    '-preset', 'veryfast', '-crf', '14', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                    '-color_range', 'tv', '-r', '60', '-an', clip], check=True)
    x, y = info['cursor']
    rows = [[round(i / 60, 4), x, y, 255, 0, info['focusBox']] for i in range(int(PLATE * 60) + 1)]
    return clip, rows, dict(kind='recreation', guide=GUIDE_PATH, still=png, focusBox=info['focusBox'], cursor=info['cursor'])


def smoke_plate():
    sys.path.insert(0, os.path.join(HERE, 'tests'))
    import make_test_clip
    clip, trk = make_test_clip.make()
    with open(trk) as f:
        rows = json.load(f)['frames']
    return clip, rows, dict(kind='smoke', clip=clip)


def build_timeline(version, build, plate):
    import cards
    from brand import DURATIONS, TITLE_CARD, LAYOUT
    from timeline import Gfx, TL
    clip, rows, prov = plate
    g = Gfx(f'style-frame-{version}', '16x9', dir=os.path.join(build, 'gfx'))
    T = TL(f'style-frame-{version}', '16x9', g)
    end_cfg = cards.end_card_config(draft=True)
    sub_id = 'title_dashboard_overview'
    cards.lockup_assets(g, 'open'); cards.title_assets(g, sub_id, EPISODE_TITLE)
    ch = g.typed('ch_read_the_map', CHAPTER, caps=True)
    names = cards.strip_names(g, CHAPTERS)
    cards.end_assets(g, end_cfg)
    g.render()                                                      # one graphics pass for every card below

    at = {}
    t = 0.0
    cards.lockup(g, T, t, t + DURATIONS['lockup']); at['01-lockup'] = t + 1.6; t += DURATIONS['lockup']
    tc = DURATIONS['title_card']
    cards.title_card(g, T, t, t + tc, EPISODE_TITLE, sub_id=sub_id)
    at['02-title-card'] = t + TITLE_CARD['leave'] + 0.9; t += tc
    t1 = cards.chapter_card(g, T, t, None, CHAPTER, aid='ch_read_the_map')
    at['03-chapter-card'] = t1 - 0.45; t = t1
    s0 = t
    ww = LAYOUT['window_wide']
    T.window_shot('SF-1', prov['kind'], clip, s0, s0 + SHOT, 0.0, PLATE, clicks=[], track=rows, wall_v='bloom',
                  wide_over=dict(s=ww['s'], pos=list(ww['pos'])), effect=f'style frame window shot ({prov["kind"]} plate)')
    # the strip: chapter 1 done, chapter 2 active through the shot, the rest passing in its last second so the strip has
    # faded out (strip_fade) before the end card
    edges = [0.0, 0.9, SHOT - 1.2, SHOT - 0.95, SHOT - 0.75, SHOT - 0.6]
    cards.chapter_strip(T, [dict(asset=names[i], t_in=s0 + edges[i], t_out=s0 + edges[i + 1]) for i in range(len(CHAPTERS))])
    at['04-window-shot'] = s0 + 3.2; t = s0 + SHOT
    info = cards.end_card(g, T, t, None, draft=True)
    at['05-end-card'] = t + DURATIONS['end_card'] - 0.5; t += DURATIONS['end_card']
    for name, v in (('06-wall-bloom', 'bloom'), ('07-wall-card', 'card'), ('08-wall-hero', 'hero')):
        T.wallpaper(v, t, t + 1.0); at[name] = t + 0.5; t += 1.0
    d = dict(name=f'style-frame-{version}', engine=2, ratio='16x9', w=T.W, h=T.H, fps=60, duration=round(t, 3), gfx_dir=g.dir,
             layers=T.L, labels=T.labels, sfx=sorted(T.sfx), music=None, vo=[])
    path = os.path.join(build, f'timeline-style-frame-{version}.json')
    with open(path, 'w') as f:
        json.dump(d, f)
    with open(os.path.join(build, 'edl.json'), 'w') as f:
        json.dump(T.edl, f, indent=1)
    return path, at, info


def contact_sheet(out, frames):
    """sheet.jpg: the stills in a 3-column grid with their names, on the darkest neutral."""
    from PIL import Image, ImageDraw, ImageFont
    from brand import COLORS, DS
    tw, th, gap, cap, cols = 800, 450, 24, 44, 3
    rows = -(-len(frames) // cols)
    W = cols * tw + (cols + 1) * gap
    head = 84
    H = head + rows * (th + cap) + (rows + 1) * gap
    sheet = Image.new('RGB', (W, H), COLORS['gray100'])
    dr = ImageDraw.Draw(sheet)
    fonts = os.path.join(DS, 'assets', 'fonts')
    f_head = ImageFont.truetype(os.path.join(fonts, 'golos-ui_bold.ttf'), 34)
    f_cap = ImageFont.truetype(os.path.join(fonts, 'golos-ui_medium.ttf'), 22)
    dr.text((gap, 26), f'Spatial Adjust videos: style frame {os.path.basename(out)}', font=f_head, fill=COLORS['gray05'])
    for i, (name, label) in enumerate(frames):
        r, c = divmod(i, cols)
        x = gap + c * (tw + gap); y = head + gap + r * (th + cap + gap)
        im = Image.open(os.path.join(out, f'{name}.png')).convert('RGB').resize((tw, th), Image.LANCZOS)
        sheet.paste(im, (x, y))
        dr.text((x, y + th + 10), f'{name[:2]}  {label}', font=f_cap, fill=COLORS['gray30'])
    path = os.path.join(out, 'sheet.jpg')
    sheet.save(path, quality=90)
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description='Render the style frame stills and contact sheet for gate G3.')
    ap.add_argument('--version', required=True, help='v1, v2, ...: the folder under <media root>/style-frames/')
    ap.add_argument('--plate', choices=('recreation', 'smoke'), default='recreation')
    a = ap.parse_args(argv)
    if not VERSION.match(a.version): fail(f'--version must look like v1, v2 or v2b, got {a.version!r}', 64)
    try:
        out = ensure_media_dir(os.path.join(MR.media_root(), 'style-frames', a.version), 'style frame folder')
        build = ensure_media_dir(os.path.join(out, '_build'), 'style frame build folder')
    except MediaRootError as err:
        fail(str(err))
    try:
        import ff  # noqa: F401  (ffmpeg by the pipeline rules)
        import torch  # noqa: F401
    except (ImportError, RuntimeError) as err:
        fail(f'{err}: run with the pipeline Python ($SA_VIDEO_PYTHON, the venv at the media root; see video/README.md)', 1)
    import approvals
    started = time.time()
    plate = (recreation_plate(build, ff) if a.plate == 'recreation' else None) or smoke_plate()
    tl, at, end = build_timeline(a.version, build, plate)
    for name, _ in FRAMES:
        png = os.path.join(out, f'{name}.png')
        r = subprocess.run([sys.executable, RENDER, '--timeline', tl, '--still', f'{at[name]:.3f}', '--out', png], cwd=REPO,
                           capture_output=True, text=True)
        if r.returncode != 0: fail(f'render.py failed for {name}: {r.stderr.strip()[-1500:]}', 1)
        print(f'  {name}.png  t={at[name]:.2f} s')
    sheet = contact_sheet(out, FRAMES)
    g4 = approvals.latest('G4')
    manifest = dict(version=a.version, commit=git_head(), rendered=time.strftime('%Y-%m-%dT%H:%M:%S%z'), timeline=tl,
                    plate={k: v for k, v in plate[2].items()}, frames=[dict(file=f'{n}.png', shows=s, t=round(at[n], 3)) for n, s in FRAMES],
                    sheet=sheet, end_card=dict(draft=end['draft'], url=end['url'], g4=g4['decision'] if g4 else None))
    with open(os.path.join(out, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print(f'style frame {a.version}: {len(FRAMES)} stills and sheet.jpg in {out} ({time.time() - started:.0f} s; plate: {plate[2]["kind"]}; '
          f'end card: {"URL PENDING APPROVAL" if end["draft"] else end["url"]})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
