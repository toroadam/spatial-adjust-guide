# Ported from iCentral MarCom 06-edit/compositor/v5_build.py (557 lines; Gfx and TL, lines 21-207) on 2026-10-19; changes listed in video/edit/NOTES.md
"""Timeline builder: Gfx (text and logo assets rendered by gfx/render_gfx.mjs) and TL (layers for the engine as JSON).

  g = Gfx('ep-16x9', '16x9', episode='<id>')          assets and wallpapers go to <media root>/episodes/<id>/gfx
  g.add(id, html, css, words=True, pad=4)              a text or HTML asset; g.typed(id, text, caps=True) for type cards
  g.common(url=..., lockup=...)                        end-card assets (CTA, URL pill, legal line, optional logo lockup)
  g.render()                                           PNGs + metrics.json; g.m[id] = {w, h, words, chars, parts}
  T = TL('ep-16x9', '16x9', g)
  T.window_shot(...) -> (P, speed); T.card(...); T.card_words(...); T.end_card(t0, t1, url, lockup); T.wallpaper(...)
  T.json(duration, music, vo)                          the timeline dict render.py reads (engine 2)

The music bed and every SVG input come from the episode, never from this module: there is no default track, and logos are
passed in through `lockup`. Colours and type weights come from THEME (theme.py).
"""
import hashlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from camplan import plan  # noqa: E402
from theme import THEME, rgba, font_spec  # noqa: E402
from media import episode_dir, ensure_media_dir  # noqa: E402

RENDER_GFX = os.path.join(os.path.dirname(HERE), 'gfx', 'render_gfx.mjs')
RATIOS = {'16x9': (1920, 1080), '1x1': (1080, 1080), '9x16': (1080, 1920)}
RED, GRAY05, GRAY30, GRAY40 = THEME['red'], THEME['gray05'], THEME['gray30'], THEME['gray40']
HIGHLIGHT, TYPE_CURSOR = THEME['highlight'], THEME['type_cursor']   # design-system blue: no red outside the lockup tile
WALL_SIZE = (2304, 1296)          # wallpapers are rendered once per palette at this size and cover-fitted by the engine


def cursor_frames(frames):
    """Cursor track frames for camplan.plan: [t, x, y, a, ripple] rows with a cursor position (dc_build.py:35).

    Capture tracks (take.mjs, record.mjs) write [t, x, y, a, ripple, focusBox | null] per frame, with x = None while the
    cursor is hidden; camplan.plan needs a numeric array, dc_camplan.dc_plan reads the full rows (focusBox included)."""
    return [f[:5] for f in frames if f[1] is not None]


# --------------------------------------------------------------------------------------------------------------------
# graphics
# --------------------------------------------------------------------------------------------------------------------
TYPE = {'16x9': dict(big=150, lab=132, cta=84, guide=38, url=40, legal=24, logo=150, end_logo=110),
        '1x1': dict(big=108, lab=96, cta=72, guide=32, url=30, legal=20, logo=104, end_logo=92),
        '9x16': dict(big=112, lab=100, cta=80, guide=36, url=30, legal=22, logo=110, end_logo=100)}


def split_lines(text, size, W, caps=False):
    """Balanced 1-2 (or 3) line split by an average Golos SemiBold advance; type cards are hand-checked on the sheets."""
    adv = (0.66 if caps else 0.53) * size
    words = text.split()
    if len(text) * adv <= W * 0.84: return [text]
    best = None
    for k in range(1, len(words)):
        a, b = ' '.join(words[:k]), ' '.join(words[k:])
        sc = max(len(a), len(b))
        if best is None or sc < best[0]: best = (sc, [a, b])
    lines = best[1]
    if max(len(l) for l in lines) * adv > W * 0.86 and len(words) >= 3:
        n = len(words); i, j = n // 3, 2 * n // 3
        lines = [' '.join(words[:i]), ' '.join(words[i:j]), ' '.join(words[j:])]
    return lines


def _wall_key(variant, size):
    """Cache key for a rendered wallpaper: the variant, its size and the THEME palette it was drawn with."""
    blob = json.dumps(dict(v=variant, size=list(size), palette=THEME['wall']), sort_keys=True).encode()
    return hashlib.sha256(blob).hexdigest()[:10]


class Gfx:
    def __init__(self, name, ratio, episode=None, dir=None):
        self.name, self.ratio, self.T = name, ratio, TYPE[ratio]; self.A = {}
        self.episode = episode
        self.dir = dir or (episode_dir(episode, 'gfx') if episode else None)
        self.end = None

    def add(self, aid, html, css, words=False, chars=False, pad=0):
        self.A[aid] = dict(id=aid, html=html, css=css, words=words, chars=chars, pad=pad); return aid

    def typed(self, aid, text, caps=False):
        W = RATIOS[self.ratio][0]
        size = self.T['lab' if caps else 'big']
        lines = split_lines(text, size, W, caps)
        css = (f'font-weight:{THEME["heading_weight"]};letter-spacing:{"0.06em" if caps else "-0.025em"};color:{GRAY05};font-size:{size}px;line-height:1.1'
               + (';text-transform:uppercase' if caps else ''))
        return [self.add(f'{aid}_{i}', ln, css, words=True, chars=True, pad=4) for i, ln in enumerate(lines)]

    def common(self, url, lockup=None, cta='Get started at', guide=None, legal='&copy; 2026 The Toro Company. All rights reserved.'):
        """End-card assets. url: the address in the pill (PI-ICNT-SW-1081-3 supplies it). lockup: None, or
        dict(icon=<svg path>, wordmark=<svg path>, icon_aspect=<icon width / height>, wordmark_cut=<width of the icon part of
        the wordmark SVG / height>, wordmark_aspect=<wordmark SVG width / height>) for the logo assets 'toro2x', 'wordmark'
        and 'wordmark_end'. guide: optional second line under the CTA."""
        T = self.T
        self.end = dict(url=url, lockup=lockup, cta=cta)
        if lockup:
            for nm, h in (('wordmark', T['logo']), ('wordmark_end', T['end_logo'])):
                cut = h * lockup['wordmark_cut'] - 6; w = h * lockup['wordmark_aspect'] - cut - 0.012 * h * lockup['wordmark_aspect'] / 5
                self.add(nm, f'<div style="width:{w:.1f}px;height:{h}px;overflow:hidden"><img src="{_file_url(lockup["wordmark"])}" style="height:{h}px;display:block;margin-left:-{cut:.1f}px"></div>', 'line-height:0')
            self.add('toro2x', f'<img src="{_file_url(lockup["icon"])}" style="height:{2 * T["logo"]}px;display:block">', 'line-height:0')
        self.add('cta', cta, f'font-weight:{THEME["heading_weight"]};letter-spacing:-0.02em;color:{GRAY05};font-size:{T["cta"]}px;line-height:1.1', words=True, pad=4)
        if guide:
            self.add('guide', guide, f'font-weight:400;color:{GRAY30};font-size:{T["guide"]}px;line-height:1.2', words=True, pad=2)
        T = dict(T, url=int(T['url'] * 1.6))
        dot = int(T['url'] * 1.45)
        pill = ('<div style="display:flex;align-items:center;gap:%dpx;padding:%dpx %dpx %dpx %dpx;border-radius:999px;'
                'background:%s;border:1.5px solid %s;box-shadow:0 18px 50px %s">'
                % (int(T['url'] * 0.55), int(T['url'] * 0.55), int(T['url']), int(T['url'] * 0.55), int(T['url'] * 0.6),
                   rgba('gray05', 0.10), rgba('gray05', 0.28), rgba('gray100', 0.45)) +
                f'<span style="width:{dot}px;height:{dot}px;border-radius:50%;background:{HIGHLIGHT};display:flex;align-items:center;justify-content:center;flex:none">'
                f'<svg width="{int(dot * 0.48)}" height="{int(dot * 0.48)}" viewBox="0 0 24 24"><path d="M5 12h12M12 6l6 6-6 6" stroke="{THEME["white"]}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
                f'<span style="font-weight:500;font-size:{T["url"]}px;letter-spacing:0.005em;color:{GRAY05};white-space:nowrap">{url}</span></div>')
        self.add('urlpill', pill, 'line-height:1', pad=40)
        if legal:
            self.add('legal', legal, f'font-weight:400;font-size:{T["legal"]}px;color:{GRAY30};letter-spacing:0.01em', pad=2)

    def wall(self, v, size=WALL_SIZE):
        """Path of the wallpaper variant v ('bloom', 'hero', 'card') in the gfx folder, rendered on first use."""
        if not self.dir: raise ValueError('Gfx has no folder: pass episode= or dir=')
        d = ensure_media_dir(self.dir, 'graphics folder')
        path = os.path.join(d, f'wall-{v}-{size[0]}x{size[1]}-{_wall_key(v, size)}.png')
        if not os.path.exists(path):
            from wallpaper import render as render_wall, to_u8   # torch, only when a wallpaper is actually drawn
            from ff import write_img
            write_img(to_u8(render_wall(size[0], size[1], v)), path)
        return path

    def render(self):
        if not self.dir: raise ValueError('Gfx has no folder: pass episode= or dir=')
        self.dir = ensure_media_dir(self.dir, 'graphics folder')
        sp = os.path.join(self.dir, '_spec.json')
        with open(sp, 'w') as f:
            json.dump({'assets': list(self.A.values()), 'fonts': font_spec()}, f, indent=1)
        subprocess.run(['node', RENDER_GFX, sp, self.dir], check=True, stdout=subprocess.DEVNULL)
        with open(os.path.join(self.dir, 'metrics.json')) as f:
            self.m = json.load(f)
        return self.m


def _file_url(p):
    from pathlib import Path
    return Path(os.path.abspath(p)).as_uri()


# --------------------------------------------------------------------------------------------------------------------
# timeline helpers
# --------------------------------------------------------------------------------------------------------------------
class TL:
    def __init__(self, name, ratio, g, episode=None):
        self.name, self.ratio, self.g = name, ratio, g; self.W, self.H = RATIOS[ratio]
        self.episode = episode or g.episode
        self.L, self.labels, self.edl, self.vo, self.sfx = [], [], [], [], []

    # framings (window floating on the wallpaper) per ratio
    def framing(self):
        W, H = self.W, self.H
        if self.ratio == '16x9': return dict(s=0.80, pos=[964, 556], rx=6.0, ry=-10.0, rz=-1.6), dict(pos=[960, 540], rx=9.0, ry=-15.0, rz=-3.0), 2.6
        if self.ratio == '1x1': return dict(s=0.50, pos=[540, 560], rx=7.0, ry=-12.0, rz=-2.0), dict(pos=[540, 540], rx=9.0, ry=-14.0, rz=-3.0), 3.0
        return dict(s=0.50, pos=[540, 1010], rx=8.0, ry=-9.0, rz=-1.5), dict(pos=[540, 960], rx=9.0, ry=-10.0, rz=-2.0), 3.4

    def wallpaper(self, v, t0, t1, z0=1.06, pan=40, dim=0.0):
        self.L.append(dict(type='wall', file=self.g.wall(v), t0=t0, t1=t1, zoom=[[t0, z0], [t1, 1.0, 'inOutSine']],
                           pan=[[t0, [pan, 0]], [t1, [-pan, 10], 'inOutSine']], dim=dim))

    def card(self, t0, t1, aid_lines, kind, text, cps=50, words_cumulative=None, out_off=0.2):
        """Type moment: dark card wallpaper + typewriter lines (one cursor, line by line)."""
        self.wallpaper('card', t0, t1, z0=1.12, pan=50)
        m = self.g.m; hs = [m[a]['h'] for a in aid_lines]; gap = int(hs[0] * 0.02)
        total = sum(hs) + gap * (len(hs) - 1); y = (self.H - total) / 2
        tin = t0 + 0.06
        for i, a in enumerate(aid_lines):
            w = m[a]['w']; n = len(m[a]['chars']); x = (self.W - w) / 2
            last = i == len(aid_lines) - 1
            lay = dict(type='text', asset=a, t0=t0, t1=t1, pos=[[t0, [x + 12, round(y)]], [t1, [x - 12, round(y)], 'linear']], anim='type', cps=cps,
                       cursor_color=TYPE_CURSOR, dy=10, dur_out=0.22, soft=True, **{'in': tin, 'out': t1 - out_off})
            if not last: lay['cursor_off'] = tin + n / cps + 0.02
            self.L.append(lay)
            tin += n / cps + 0.04; y += hs[i] + gap
        self.labels.append(dict(text=text, tin=tin, tout=t1 - out_off, kind=kind))
        self.sfx.append([round(t0, 3), 'hit_soft']); self.sfx.append([round(t0 + 0.06, 3), f'type:{sum(len(self.g.m[a]["chars"]) for a in aid_lines)}:{cps}'])
        self.edl.append(dict(t0=t0, t1=t1, shot='(type)', take='—', file='(post graphic)', effect=f'typewriter type card ({kind})', label=text))

    def card_words(self, t0, t1, aid, text, word_times):
        """One word per beat, cumulative (rise per word)."""
        self.wallpaper('card', t0, t1, z0=1.12, pan=50)
        m = self.g.m; w, h = m[aid]['w'], m[aid]['h']
        self.L.append(dict(type='text', asset=aid, t0=t0, t1=t1, pos=[round((self.W - w) / 2), round((self.H - h) / 2)], anim='rise', dy=26, dur_in=0.45,
                           word_times=word_times, dur_out=0.12, **{'in': word_times[0], 'out': t1 - 0.06}))
        self.labels.append(dict(text=text, tin=word_times[-1] + 0.2, tout=t1 - 0.06, kind='benefit', per_word=word_times))
        self.edl.append(dict(t0=t0, t1=t1, shot='(type)', take='—', file='(post graphic)', effect='cumulative word card', label=text))

    def raw(self, file):
        """A take: an absolute path as given, else <media root>/episodes/<episode>/capture/raw/<file>."""
        if os.path.isabs(file): return file
        if not self.episode: raise ValueError(f'take {file!r} is relative but the timeline has no episode')
        return os.path.join(episode_dir(self.episode, 'capture', 'raw'), file)

    def window_shot(self, shot, take, file, t0, t1, src_in, src_out, clicks=None, track=None, Z=None, focus=None, lifts=None, z_floor=0.0,
                    entrance=0.04, mblur=True, dof=0.35, wall_v='bloom', lead=0.95, hold=0.5, merge=1.6, macro_over=None, wide_over=None, effect='',
                    up_dur=0.9, down_dur=1.1, dsf=2.0, win=(1920, 1080), z_cap=None, drift=(1.0, 0.5, 7.0), planner=None):
        """track: capture frames [t, x, y, a, ripple(, focusBox)] in source seconds. planner: None for camplan.plan, which gets
        the 5-column cursor_frames; a planner marked full_rows (dc_camplan.dc_plan) gets the rows unchanged. drift=None keeps
        the window still (the Double Click look, dc_build.py:41-42)."""
        wide, macro, Zr = self.framing()
        kw_ = win[0] / 1920.0                         # v3e: larger-CSS takes (2880x1620 @1.333x) keep the same on-screen window size
        if kw_ != 1.0: wide = dict(wide, s=wide['s'] / kw_)
        if wide_over: wide = {**wide, **wide_over}
        if macro_over: macro = {**macro, **macro_over}
        Z = Z or Zr
        if self.ratio == '9x16' and z_floor == 0.0: z_floor = 0.3      # portrait: stay partly zoomed so the UI reads on a phone
        speed = (src_out - src_in) / (t1 - t0)
        trk = track if track is not None else [[0, 960, 540], [60, 960, 540]]
        pl = planner or plan
        if not getattr(pl, 'full_rows', False): trk = cursor_frames(trk)
        P = pl(trk, src_in, src_out, speed, t0, clicks or [], Z, wide, macro, focus_override=focus, lead=lead, hold=hold, merge=merge,
               z_floor=z_floor, omega_f=3.0, omega_z=3.2, entrance=entrance, drift=drift, view=(self.W, self.H), up_dur=up_dur, down_dur=down_dur, post_sigma=0.3, win=win, z_cap=z_cap)
        self.wallpaper(wall_v, t0, t1)
        for c in (clicks or []):
            tc = t0 + (c - src_in) / speed
            if t0 + 0.05 < tc < t1 - 0.05: self.sfx.append([round(tc, 3), 'click' if track is not None else 'tick_soft'])
        lay = dict(type='plate', id=f'w_{shot}_{t0:.2f}', file=self.raw(file), src_in=src_in, speed=speed, t0=t0, t1=t1,
                   cam=P['cam'], pos=P['pos'], rx=P['rx'], ry=P['ry'], rz=P['rz'], radius_src=26 * kw_, shadow=1.0, mblur=mblur, persp=2000.0 * max(1, self.H / 1080),
                   dsf=dsf, shot=shot, take=take, effect=effect or f'window float + cursor-follow zoom (Z {Z}, speed {speed:.2f}x)',
                   dof=[[a, round(dof * z, 3), 'linear'] for a, z in zip(P['t'], P['z'])])
        if lifts: lay['lifts'] = lifts
        self.L.append(lay)
        return P, speed

    def end_card(self, t0, t1, url, lockup=None):
        """End card: optional logo lockup, CTA, URL pill and legal line. url and lockup must match g.common(url, lockup)."""
        end = self.g.end or {}
        if end.get('url') != url or end.get('lockup') != lockup:
            raise ValueError('end_card: call g.common(url=..., lockup=...) with the same url and lockup before g.render()')
        W, H = self.W, self.H; m = self.g.m; T = self.g.T
        self.L.append(dict(type='wall', file=self.g.wall('hero'), t0=t0, t1=t1 + 0.1, zoom=[[t0, 1.10], [t1, 1.0, 'outCubic']], pan=[[t0, [0, 40]], [t1, [0, 0], 'outCubic']], dim=0.18))
        if self.ratio == '9x16': ly, cy, gy, py, lg = 640, 790, 900, 980, 1560
        elif self.ratio == '1x1': ly, cy, gy, py, lg = 300, 430, 530, 610, 960
        else: ly, cy, gy, py, lg = 300, 452, 556, 616, 990
        if lockup:
            th2 = m['toro2x']['h']; eh = T['end_logo']
            wme_w = m['wordmark_end']['w']; badge_w = eh * lockup['icon_aspect']; wm_x = eh * lockup['wordmark_cut'] - 6
            lock_w = wm_x + wme_w; lx = W / 2 - lock_w / 2
            self.L.append(dict(type='logo', asset='toro2x', t0=t0, t1=t1 + 1, pos=[[t0, [lx + badge_w / 2, ly + 18]], [t0 + 0.5, [lx + badge_w / 2, ly], 'outCubic']],
                               scale=eh / th2, opacity=[[t0, 0.0], [t0 + 0.35, 1.0, 'outCubic']], blur=[[t0, 10.0], [t0 + 0.4, 0.0, 'outCubic']]))
            self.L.append(dict(type='image', asset='wordmark_end', t0=t0 + 0.2, t1=t1 + 1, pos=[lx + wm_x + wme_w / 2, ly], wipe=[t0 + 0.25, t0 + 0.75], feather=80,
                               **{'in': t0 + 0.25, 'out': t1 + 5}))
        for aid, y, tin, anim in (('cta', cy, t0 + 0.55, 'rise'), ('urlpill', gy - 10, t0 + 0.8, 'fade'), ('legal', lg, t0 + 1.2, 'fade')):
            if aid not in m: continue
            w = m[aid]['w']
            self.L.append(dict(type='text', asset=aid, t0=t0, t1=t1 + 1, pos=[round((W - w) / 2), y], anim=anim, dy=22 if anim != 'fade' or aid == 'urlpill' else 0,
                               stagger=0.05, dur_in=0.6, **{'in': tin, 'out': t1 + 5}))
        cta = end.get('cta') or ''
        self.labels.append(dict(text=f'{cta} {url}'.strip(), tin=t0 + 0.8 + 0.6, tout=t1, kind='endcard'))
        self.edl.append(dict(t0=t0, t1=t1, shot='(end)', take='—', file='(post graphic)',
                             effect='end card: ' + ('logo lockup, ' if lockup else '') + f'{cta} {url}, legal', label=f'{cta} / {url}'))

    def json(self, duration, music, vo):
        """The timeline. music: the episode's music block (dict with its track path), or None for no music; there is no
        default track. Output paths are the episode's edit/_video, edit/_audio and renders folders under the media root."""
        if not self.episode: raise ValueError('TL.json needs the episode (TL(..., episode=) or Gfx(..., episode=))')
        return dict(name=self.name, engine=2, ratio=self.ratio, w=self.W, h=self.H, fps=60, duration=duration, gfx_dir=self.g.dir,
                    video_out=os.path.join(episode_dir(self.episode, 'edit', '_video'), f'{self.name}-video.mp4'),
                    final_out=os.path.join(episode_dir(self.episode, 'renders'), f'{self.name}.mp4'),
                    mix_wav=os.path.join(episode_dir(self.episode, 'edit', '_audio'), f'{self.name}-mix.wav'),
                    layers=self.L, labels=self.labels, music=music, vo=vo, sfx=sorted(self.sfx))
