# Ported from iCentral MarCom double-clicks/tools/dctitle.py (118 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""dctitle layer: the series title card (registered as 'dctitle'). The series word ("Double Click", BRAND['series_word'])
rises in, a cursor glides in and double-clicks it (the word squishes, a soft pulse per click), then the episode name
springs out of it downward, out from under the word's baseline, and the pair settles centred. Optional small tag line above
the word (e.g. UP NEXT).

  word, sub, tag?, cursor   asset ids (text PNGs from cards.title_card; cursor = arrow PNG drawn at 2x, cur_scale 0.5)
  hot                       cursor tip inside the cursor PNG, px
  target                    cursor tip at the click, as fractions of the word box [fx, fy] (at its pre-pop place)
  enter, exit               cursor tip off-screen start / end, output px
  baseline, cap_top, drop   the word's baseline and the sub's cap top as fractions of their PNG heights (measured from the
                            PNG alpha by cards.title_card), and the sub's drop under the baseline in px (BRAND title_card)
  t_in                      word rise-in;  t_move cursor leaves `enter`;  clicks [c1, c2];  t_pop sub starts;  t_exit cursor
                            leaves;  t_out everything fades
Colours are in the assets (BRAND type roles) and the pulse is THEME['ripple']; the spring is BRAND['spring'].
"""
import math, os, sys
import torch
import torch.nn.functional as F

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine import DEV, DT, clamp01, EASE, hexrgb  # noqa: E402
from theme import THEME  # noqa: E402
from renderer import register_layer  # noqa: E402

PULSE = torch.tensor(hexrgb(THEME['ripple']), device=DEV, dtype=DT).view(1, 3, 1, 1)
SPRING_W, SPRING_Z = THEME['spring']['w'], THEME['spring']['z']


def _spring(dt, w=SPRING_W, z=SPRING_Z):
    """Underdamped step response 0 -> 1 (overshoots ~23%)."""
    if dt <= 0: return 0.0
    wd = w * math.sqrt(1 - z * z)
    return 1 - math.exp(-z * w * dt) * (math.cos(wd * dt) + z * w / wd * math.sin(wd * dt))


def _squish(t, clicks):
    s = 1.0
    for c in clicks:
        dt = t - c
        if dt > 0: s -= 0.05 * math.exp(-dt * 13) * math.cos(dt * 24) * (1 - math.exp(-dt * 90))
    return s


def _bez2(p0, c, p1, u):
    return [(1 - u) ** 2 * p0[i] + 2 * (1 - u) * u * c[i] + u * u * p1[i] for i in (0, 1)]


def _pulse(self, out, cx, cy, d):
    """Soft click pulse (the take's ripple): radial gradient, scale .35 -> 1.5 over 0.6 s, fading out."""
    k = 1 - (1 - min(1.0, d / 0.6)) ** 3
    r = 30 * (0.35 + 1.15 * k) * 2.6                               # the take's 60 px disc, scaled with the title's 2.7x cursor
    a = 1 - 0.1 * d / 0.21 if d < 0.21 else 0.9 * (1 - (d - 0.21) / 0.39)   # opacity keyframes 1 -> .9 (35%) -> 0
    R = int(r + 4); X0, X1, Y0, Y1 = max(0, int(cx - R)), min(self.W, int(cx + R)), max(0, int(cy - R)), min(self.H, int(cy + R))
    if X1 <= X0 or Y1 <= Y0 or a <= 0: return out
    ys = torch.arange(Y1 - Y0, device=DEV, dtype=DT).view(-1, 1) + Y0 + 0.5
    xs = torch.arange(X1 - X0, device=DEV, dtype=DT).view(1, -1) + X0 + 0.5
    u = (torch.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / r).clamp(0, 1.5)
    stops = torch.tensor([0, 0.22, 0.48, 0.70], device=DEV, dtype=DT); vals = [1.0, 0.85, 0.35, 0.0]
    g = torch.zeros_like(u)
    for i in range(3):
        m = (u >= stops[i]) & (u < stops[i + 1]); w = (u - stops[i]) / (stops[i + 1] - stops[i])
        g = torch.where(m, vals[i] + (vals[i + 1] - vals[i]) * w, g)
    g = (g * a)[None, None]
    reg = out[:, :, Y0:Y1, X0:X1]
    out[:, :, Y0:Y1, X0:X1] = reg * (1 - g) + PULSE * g
    return out


def dctitle(self, L, t, out):
    W, H = self.W, self.H
    word, sub = self.asset(L['word']), self.asset(L['sub'])
    hw, ww = word.shape[-2:]; hs, ws = sub.shape[-2:]
    tag = self.asset(L['tag']) if L.get('tag') else None
    ht = tag.shape[-2] if tag is not None else 0; gt = 6 if tag is not None else 0
    clip_rel = hw * L.get('baseline', 0.80)                  # the word's baseline: the sub comes out from under it
    rel1 = clip_rel + L.get('drop', 6) - hs * L.get('cap_top', 0.20)   # sub box top under the word, at rest
    g0 = ht + gt + hw; g1 = ht + gt + rel1 + hs
    wy0 = (H - g0) / 2 + ht + gt + L.get('dy0', 0); wy1 = (H - g1) / 2 + ht + gt + L.get('dy1', 0)

    o_all = 1.0; y_all = 0.0
    if t >= L['t_out']:
        e = EASE['inCubic'](clamp01((t - L['t_out']) / L.get('dur_out', 0.3))); o_all = 1 - e; y_all = -12 * e
    if o_all <= 0.002: return out
    e_in = EASE['outCubic'](clamp01((t - L['t_in']) / 0.55))
    e_mv = EASE['outCubic'](clamp01((t - L['t_pop']) / 0.65))
    wy = wy0 + (wy1 - wy0) * e_mv + 18 * (1 - e_in) + y_all

    # sub: springs down out from under the word's baseline (drawn first, so the word sits on top)
    dt = t - L['t_pop']
    if dt > 0:
        s = _spring(dt); sc = max(0.05, 0.80 + 0.20 * s)
        rel0 = clip_rel - hs * 0.95
        rel = rel0 + (rel1 - rel0) * s
        img = sub if abs(sc - 1) < 1e-3 else F.interpolate(sub, size=(max(1, round(hs * sc)), max(1, round(ws * sc))), mode='bilinear', align_corners=False, antialias=True)
        h2, w2 = img.shape[-2:]
        y_top = wy + rel + (hs - h2) * 0.15
        rows = torch.arange(h2, device=DEV, dtype=DT).view(1, 1, -1, 1) + y_top
        m = ((rows - (wy + clip_rel)) / 5.0 + 0.5).clamp(0, 1)
        img = torch.cat([img[:, :3], img[:, 3:4] * m], 1)
        out = self.blit(out, img, W / 2 - w2 / 2, y_top, o_all * clamp01(dt / 0.08))

    # tag + word (the word squishes on each click)
    if tag is not None:
        e_t = EASE['outCubic'](clamp01((t - L['t_in'] - 0.12) / 0.55))
        out = self.blit(out, tag, W / 2 - tag.shape[-1] / 2, wy - gt - ht + 10 * (1 - e_t), o_all * e_t * 0.9)
    sq = _squish(t, L['clicks'])
    out = self.blit(out, word, W / 2 - ww * sq / 2, wy + hw / 2 - hw * sq / 2, o_all * e_in, scale=sq)

    # cursor tip path: enter -> target (curved glide), clicks, then away
    tx, ty = W / 2 - ww / 2 + ww * L['target'][0], wy0 + hw * L['target'][1]
    ex, ey = L['enter']; xx, xy = L['exit']
    arrive = L['clicks'][0] - 0.16
    if t < L['t_move']: tip, ca = [ex, ey], 0.0
    elif t < arrive:
        u = EASE['inOutCubic'](clamp01((t - L['t_move']) / (arrive - L['t_move'])))
        tip, ca = _bez2([ex, ey], [tx + 260, ey - 40], [tx, ty], u), 1.0
    elif t < L['t_exit']: tip, ca = [tx, ty], 1.0
    else:
        u = EASE['inCubic'](clamp01((t - L['t_exit']) / 0.7))
        tip, ca = _bez2([tx, ty], [tx + 120, ty + 40], [xx, xy], u), 1.0 - clamp01((u - 0.5) / 0.5)

    for c in L['clicks']:
        d = t - c
        if 0 <= d < 0.6: out = _pulse(self, out, tx, ty, d)

    if ca > 0.002:
        cur = self.asset(L['cursor']); hx, hy = L['hot']
        sc = L.get('cur_scale', 0.5)
        out = self.blit(out, cur, tip[0] - hx * sc, tip[1] - hy * sc, ca * o_all, scale=sc)
    return out


register_layer('dctitle', dctitle)
