# Ported from iCentral MarCom 06-edit/compositor/lib/wallpaper.py (131 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""Toro bloom wallpaper (style test v2): a Teams/Windows-11-style satin "bloom" built from the brand tokens.

Palette: THEME['wall'] in theme.py (red, shade, tint, g100, g90, g80, g70, g40, g20). The iCentral values are the phase2 design
tokens $toro-red, $toro-red-shade, $toro-red-tint and $gray-100 .. $gray-20; deep folds are the shade and g100 mixed (no
new hue). The Spatial Adjust brand re-skins it by changing THEME only.

  render(W, H, variant) -> float32 HxWx3 in 0..1 (linear blend in sRGB space, dithered on export)
  variants: 'bloom' (feature shots, bloom low behind the window), 'hero' (brand intro / end card, bloom fuller, centred),
            'card' (type cards: dark charcoal with a single red bloom glow, quieter)
"""
import math, os, sys
import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from theme import THEME  # noqa: E402

DEV = torch.device(os.environ.get('SA_VIDEO_DEV') or ('mps' if torch.backends.mps.is_available() else 'cpu'))
P = THEME['wall']


def hx(h):
    h = h.lstrip('#'); return torch.tensor([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], device=DEV).view(3, 1, 1)


RED, SHADE, TINT = hx(P['red']), hx(P['shade']), hx(P['tint'])
G100, G90, G80, G70, G40, G20 = hx(P['g100']), hx(P['g90']), hx(P['g80']), hx(P['g70']), hx(P['g40']), hx(P['g20'])


def smooth(e0, e1, x):
    t = ((x - e0) / (e1 - e0)).clamp(0, 1); return t * t * (3 - 2 * t)


def petal(xs, ys, cx, cy, theta, length, width, twist, r0=0.0):
    """Curved satin petal around pivot (cx, cy). Returns alpha, across-coordinate a in [-1,1], along u in [0,1]."""
    dx, dy = xs - cx, ys - cy
    r = torch.sqrt(dx * dx + dy * dy) + 1e-6
    ang = torch.atan2(dx, -dy)                       # 0 = straight up
    u = ((r - r0) / length).clamp(0, 1.2)
    centre = theta + twist * u * u
    w = width * torch.sin(math.pi * u.clamp(0, 1)).clamp(min=0) ** 0.6 + 1e-4
    a = (ang - centre) / w
    inside = (1 - smooth(0.92, 1.0, a.abs())) * (1 - smooth(0.96, 1.06, u)) * smooth(0.0, 0.06, u)
    return inside, a.clamp(-1, 1), u.clamp(0, 1)


def satin(a, u, body, light, dark, rim):
    """Satin shading across the petal: a bright band near one edge, a dark fold on the other, rim highlight."""
    band = torch.exp(-((a - 0.45) ** 2) / 0.08)
    fold = torch.exp(-((a + 0.75) ** 2) / 0.05)
    edge = torch.exp(-((a - 0.93) ** 2) / 0.0025)
    tipglow = u ** 1.5
    c = body * (1 - 0.55 * fold) + (light - body) * (0.65 * band + 0.25 * tipglow) * (1 - fold)
    c = c * (1 - fold) + dark * fold
    c = c + (rim - c) * (0.85 * edge)
    return c.clamp(0, 1)


def gauss(img, s):
    import torch.nn.functional as F
    r = int(s * 3); k = torch.exp(-(torch.arange(-r, r + 1, device=DEV, dtype=torch.float32) ** 2) / (2 * s * s)); k = k / k.sum()
    C = img.shape[1]
    x = F.conv2d(F.pad(img, (r, r, 0, 0), mode='replicate'), k.view(1, 1, 1, -1).repeat(C, 1, 1, 1), groups=C)
    return F.conv2d(F.pad(x, (0, 0, r, r), mode='replicate'), k.view(1, 1, -1, 1).repeat(C, 1, 1, 1), groups=C)


def render(W, H, variant='bloom'):
    ys, xs = torch.meshgrid(torch.arange(H, device=DEV, dtype=torch.float32) + 0.5, torch.arange(W, device=DEV, dtype=torch.float32) + 0.5, indexing='ij')
    S = H / 1080.0
    # base: charcoal with a lifted centre (gray-80 glow) and a gray-100 vignette
    nx, ny = (xs - W * 0.5) / W, (ys - H * 0.42) / H
    rr = torch.sqrt(nx * nx * 1.2 + ny * ny * 1.6)
    base = G80 * (1 - smooth(0.0, 0.75, rr)) + G100 * smooth(0.0, 0.75, rr)
    base = base * 0.85 + G90 * 0.15
    img = base.clone()
    if variant == 'card':
        g = torch.exp(-(((xs - W * 0.82) / (W * 0.55)) ** 2 + ((ys - H * 1.05) / (H * 0.7)) ** 2))
        img = img * (1 - 0.85 * g) + SHADE * 0.85 * g
        g2 = torch.exp(-(((xs - W * 0.1) / (W * 0.45)) ** 2 + ((ys + H * 0.1) / (H * 0.6)) ** 2))
        img = img * (1 - 0.35 * g2) + G70 * 0.35 * g2
        return img.permute(1, 2, 0).clamp(0, 1).cpu().numpy()
    # satin ribbons sweeping across the frame (back to front): (y0, amp, freq, phase, slope, thickness, thick-var, palette)
    lift = -0.10 if variant == 'hero' else 0.0
    R_ = [(0.66, 0.10, 1.2, 0.4, -0.30, 0.20, 0.35, 'grey'),
          (0.74, 0.09, 1.4, 1.6, -0.36, 0.22, 0.40, 'red2'),
          (0.82, 0.08, 1.1, 2.6, -0.28, 0.18, 0.30, 'grey2'),
          (0.88, 0.10, 1.3, 3.5, -0.40, 0.24, 0.45, 'red'),
          (1.00, 0.07, 1.6, 4.4, -0.30, 0.20, 0.30, 'red3'),
          (1.10, 0.06, 1.2, 5.3, -0.22, 0.20, 0.25, 'grey')]
    pal = {'red': (RED, RED * 0.6 + TINT * 0.4, SHADE * 0.45 + G100 * 0.55, TINT * 0.6 + G20 * 0.4),
           'red2': (SHADE, RED * 0.5 + TINT * 0.5, SHADE * 0.35 + G100 * 0.65, TINT),
           'red3': (RED * 0.85 + SHADE * 0.15, TINT, SHADE * 0.5 + G100 * 0.5, G20),
           'grey': (G80, G70 * 0.5 + G40 * 0.5, G100, G40),
           'grey2': (G70, G40, G100, G20)}
    acc = img[None]
    X = xs / W; Y = ys / H
    for (y0, amp, fr, ph, sl, th, tv, pk) in R_:
        c = (y0 + lift) + amp * torch.sin(2 * math.pi * fr * X + ph) + sl * (X - 0.5)
        T = th * (1 + tv * torch.sin(2 * math.pi * 0.7 * X + ph * 1.7)) * 0.5
        a = (Y - c) / T
        al = (1 - smooth(0.9, 1.0, a.abs()))
        u = X
        body, light, dark, rim = pal[pk]
        col = satin(a.clamp(-1, 1), u, body, light, dark, rim)
        sh = gauss(al[None, None], 30 * S)[0] * 0.6
        acc = acc * (1 - sh)
        acc = acc * (1 - al) + col[None] * al
    img = acc[0]
    g3 = torch.exp(-(((xs - W * 0.86) / (W * 0.42)) ** 2 + ((ys - H * 0.08) / (H * 0.5)) ** 2))
    acc = acc * (1 - 0.30 * g3) + SHADE * 0.30 * g3
    img = acc[0]
    # light bleed: the satin throws red light into the charcoal around it
    bleed = gauss((img - base)[None].clamp(min=0), 70 * S)[0]
    img = (img + bleed * 0.45).clamp(0, 1)
    # soft atmospheric glow and grain-free vignette
    glow = torch.exp(-(((xs - W * 0.5) / (W * 0.6)) ** 2 + ((ys - H * 0.05) / (H * 0.55)) ** 2))
    img = img + (G80 - img) * 0.10 * glow
    vig = smooth(0.35, 1.0, torch.sqrt(((xs - W / 2) / (W * 0.62)) ** 2 + ((ys - H / 2) / (H * 0.62)) ** 2))
    img = img * (1 - 0.45 * vig)
    return img.permute(1, 2, 0).clamp(0, 1).cpu().numpy()


def to_u8(a, seed=0):
    rng = np.random.default_rng(seed)
    return np.clip(a * 255 + rng.uniform(-0.5, 0.5, a.shape), 0, 255).astype(np.uint8)


if __name__ == '__main__':
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from ff import write_img
    from media import ensure_media_dir
    out = ensure_media_dir(sys.argv[1], 'wallpaper folder')     # media root only
    for v in ('bloom', 'hero', 'card'):
        write_img(to_u8(render(2304, 1296, v)), os.path.join(out, f'wall-{v}.png'))
    print('ok')
