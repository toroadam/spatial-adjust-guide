# Ported from iCentral MarCom double-clicks/tools/engine_dc.py (111 lines; glass, _bar, _glow, lines 43-108) on 2026-10-19; changes listed in video/edit/NOTES.md
"""glass layer: the on-screen chapter timeline (registered as 'glass').

  box       [x0, y0, x1, y1] output px; r corner radius
  segs      [{asset, t_in, t_out}]  one per chapter (equal widths); asset = chapter name PNG (white, from render_gfx)
  opacity   keyframe track
  blur, pad, gap   optional (22, 22, 14)
Look: frosted dark glass (the frame under it blurred sigma 22, tinted THEME['glass_tint']), 1.25 px hairline edge, soft
shadow. Per chapter: the name (55% white, 100% when active), and a 3 px track under it that fills while the chapter plays
(THEME['strip_active'], design-system blue, while active; white once done), with a glowing head on the active fill.
"""
import os, sys
import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine import DEV, DT, kf, clamp01, hexrgb, rrect_sdf, gauss_blur, soft_shadow  # noqa: E402
from theme import THEME  # noqa: E402
from renderer import register_layer  # noqa: E402

ACTIVE = torch.tensor(hexrgb(THEME['strip_active']), device=DEV, dtype=DT).view(1, 3, 1, 1)
WHITE = torch.ones(1, 3, 1, 1, device=DEV, dtype=DT)
_r, _g, _b, TINT_AMT = THEME['glass_tint']
TINT = torch.tensor([_r / 255, _g / 255, _b / 255], device=DEV, dtype=DT).view(1, 3, 1, 1)


def glass(self, L, t, out):
    o = kf(L.get('opacity', 1.0), t)
    if o <= 0.002: return out
    x0, y0, x1, y1 = L['box']; r = L.get('r', 22); m = 60
    X0, Y0, X1, Y1 = max(0, int(x0 - m)), max(0, int(y0 - m)), min(self.W, int(x1 + m)), min(self.H, int(y1 + m))
    crop = out[:, :, Y0:Y1, X0:X1]
    hh, ww = crop.shape[-2:]
    ys = torch.arange(hh, device=DEV, dtype=DT).view(hh, 1) + Y0 + 0.5
    xs = torch.arange(ww, device=DEV, dtype=DT).view(1, ww) + X0 + 0.5
    d = rrect_sdf(xs, ys, x0, y0, x1, y1, r)
    inside = (0.5 - d).clamp(0, 1)[None, None]
    # shadow under the glass
    sh = soft_shadow(rrect_sdf(xs, ys - 10, x0 + 6, y0, x1 - 6, y1, r) , 22, 0.42)[None, None] * (1 - inside)
    res = crop * (1 - sh * o)
    # frosted fill
    fro = gauss_blur(crop, L.get('blur', 22)) * (1 - TINT_AMT) + TINT * TINT_AMT
    # top sheen
    sheen = (0.07 * (1 - ((ys - y0) / (y1 - y0)).clamp(0, 1)))[None, None]
    fro = fro + (1 - fro) * sheen
    res = res * (1 - inside * o) + fro * inside * o
    # hairline edge
    edge = ((1.25 - (d + 0.6).abs()).clamp(0, 1))[None, None]
    res = res * (1 - edge * 0.30 * o) + WHITE * edge * 0.30 * o
    out = out.clone(); out[:, :, Y0:Y1, X0:X1] = res
    # chapters
    segs = L['segs']; n = len(segs); pad = L.get('pad', 22); gap = L.get('gap', 14)
    sw = (x1 - x0 - 2 * pad - gap * (n - 1)) / n
    ty = y0 + (y1 - y0) * 0.40; by = y0 + (y1 - y0) * 0.74
    for i, s in enumerate(segs):
        sx = x0 + pad + i * (sw + gap)
        p = clamp01((t - s['t_in']) / max(1e-6, s['t_out'] - s['t_in']))
        active = s['t_in'] <= t < s['t_out']; done = t >= s['t_out']
        # name
        img = self.asset(s['asset']); ih, iw = img.shape[-2:]
        k = min(1.0, (sw - 8) / iw)
        a_txt = 1.0 if active else (0.78 if done else 0.50)
        out = self.blit(out, img, sx + sw / 2 - iw * k / 2, ty - ih * k / 2, o * a_txt, scale=k)
        # track
        out = _bar(self, out, sx, by, sx + sw, 1.0, WHITE, 0.20 * o)
        if p > 0:
            col = ACTIVE if active else WHITE
            out = _bar(self, out, sx, by, sx + sw * p, 1.0, col, (1.0 if active else 0.85) * o)
            if active: out = _glow(self, out, sx + sw * p, by, o)
    return out


def _bar(self, out, xa, yc, xb, _, col, a):
    if xb - xa < 0.5: return out
    hgt = 3.0; X0, X1 = max(0, int(xa - 2)), min(self.W, int(xb + 3)); Y0, Y1 = int(yc - 4), int(yc + 5)
    ys = torch.arange(Y1 - Y0, device=DEV, dtype=DT).view(-1, 1) + Y0 + 0.5
    xs = torch.arange(X1 - X0, device=DEV, dtype=DT).view(1, -1) + X0 + 0.5
    m = (0.5 - rrect_sdf(xs, ys, xa, yc - hgt / 2, xb, yc + hgt / 2, hgt / 2)).clamp(0, 1)[None, None] * a
    out[:, :, Y0:Y1, X0:X1] = out[:, :, Y0:Y1, X0:X1] * (1 - m) + col * m
    return out


def _glow(self, out, x, y, o):
    R = 14; X0, X1, Y0, Y1 = max(0, int(x - R)), min(self.W, int(x + R)), int(y - R), int(y + R)
    ys = torch.arange(Y1 - Y0, device=DEV, dtype=DT).view(-1, 1) + Y0 + 0.5
    xs = torch.arange(X1 - X0, device=DEV, dtype=DT).view(1, -1) + X0 + 0.5
    dd = torch.sqrt((xs - x) ** 2 + (ys - y) ** 2)
    halo = (torch.exp(-(dd / 6.0) ** 2) * 0.55 * o)[None, None]
    dot = ((3.6 - dd).clamp(0, 1) * o)[None, None]
    reg = out[:, :, Y0:Y1, X0:X1]
    reg = reg * (1 - halo) + ACTIVE * halo
    reg = reg * (1 - dot) + WHITE * dot
    out[:, :, Y0:Y1, X0:X1] = reg
    return out


register_layer('glass', glass)
