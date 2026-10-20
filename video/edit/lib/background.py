"""Spatial Adjust walls: the contour wall, the background behind every card and window shot (motion-system.md, Background).

An abstract, procedural wall in Oasis neutrals that replaces the iCentral red satin wave: a dark vertical gradient with a
lifted centre, faint topographic contour lines like the slope map of a green (every 5th an index line), and soft out-of-focus
blooms in the moisture-band accents, never red. Contour lines crossing a bloom take its colour. Built on the ported
wallpaper.py's helpers (device, smoothstep, separable Gaussian, dithered export); the palette is THEME['wall'] (brand.py).

  render(W, H, variant) -> float32 HxWx3 in 0..1 (same contract as wallpaper.render; Gfx.wall caches it per palette)
  variants: 'bloom'  behind window shots: blooms low left and low right, under the window
            'card'   behind title and chapter cards: darker and quieter, one blue bloom low right
            'hero'   behind the lockup and the end card: a fuller blue bloom centred behind the lockup

TL.wallpaper(kind, t0, t1, z0, pan) keeps working unchanged: it asks Gfx.wall(kind) for the PNG, which now comes from here.
Gfx.wall caches each PNG under a key of THEME['wall'] (which carries the style name, 'sa-contour-1') and this file's source,
so editing PLACES, HILLS, LEVELS or the drawing below redraws cached walls; bump the style in brand.py when the look changes
enough to need a new name in the review.

  python3 video/edit/lib/background.py <folder under the media root>      writes wall-<variant>.png for all three variants
"""
import math
import os
import sys

import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from theme import THEME  # noqa: E402
from wallpaper import DEV, smooth, gauss, to_u8  # noqa: E402,F401  (the ported wallpaper's helpers)

P = THEME['wall']
VARIANTS = ('bloom', 'card', 'hero')

# Where each preset's blooms sit, in the order of THEME['wall']['blooms'][variant]: centre (fx, fy) and radii (rx, ry) as
# fractions of the frame. Colours and strengths come from the brand; only the placement lives here.
PLACES = dict(
    bloom=((0.84, 1.02, 0.52, 0.62), (0.10, 0.98, 0.40, 0.50), (0.46, 1.20, 0.26, 0.30)),
    hero=((0.50, 0.60, 0.50, 0.55), (0.06, 0.95, 0.36, 0.45), (0.94, 0.08, 0.30, 0.34)),
    card=((0.82, 1.05, 0.55, 0.70), (0.08, -0.08, 0.45, 0.55)),
)
# The green's undulations: (cx, cy, sx, sy, amplitude) in frame fractions; fixed, so the wall is identical on every render
HILLS = ((0.22, 0.30, 0.30, 0.22, 0.55), (0.70, 0.22, 0.26, 0.20, -0.35), (0.58, 0.72, 0.34, 0.26, 0.60),
         (0.12, 0.80, 0.22, 0.20, -0.30), (0.90, 0.62, 0.20, 0.28, 0.32), (0.42, 0.48, 0.16, 0.12, -0.18))
LEVELS = 22                         # contour interval: lines about 40-70 px apart at 1920x1080
LINE_PX = 1.15                      # contour line width at 1080 lines (scaled with the frame)


def hx(h):
    h = h.lstrip('#'); return torch.tensor([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], device=DEV).view(3, 1, 1)


def height(X, Y):
    """The wall's height field over normalised coordinates: a gentle tilt, broad hills and hollows, a slow ripple."""
    h = 0.35 * X + 0.18 * Y + 0.04 * torch.sin(2 * math.pi * (1.3 * X + 0.7 * Y) + 0.8)
    for cx, cy, sx, sy, a in HILLS:
        h = h + a * torch.exp(-(((X - cx) / sx) ** 2 + ((Y - cy) / sy) ** 2))
    return h


def contours(h, S):
    """Anti-aliased contour line alpha (0..1) and index-line mask for the height field h (HxW), line width LINE_PX * S."""
    f = h * LEVELS
    gy, gx = torch.gradient(f)
    slope = torch.sqrt(gx * gx + gy * gy) + 1e-6                     # level units per px
    near = torch.round(f)
    dist_px = (f - near).abs() / slope
    line = (1 - smooth(LINE_PX * S * 0.5, LINE_PX * S * 0.5 + 1.0, dist_px))
    index = ((near.remainder(P['index_every'])) == 0).float()
    return line, index


def render(W, H, variant='bloom'):
    if variant not in VARIANTS:
        raise ValueError(f'wall variant {variant!r}: one of {", ".join(VARIANTS)}')
    ys, xs = torch.meshgrid(torch.arange(H, device=DEV, dtype=torch.float32) + 0.5,
                            torch.arange(W, device=DEV, dtype=torch.float32) + 0.5, indexing='ij')
    S = H / 1080.0
    X, Y = xs / W, ys / H
    # base: vertical gradient, top to bottom, with a lifted centre
    top, bottom, lift = hx(P['top']), hx(P['bottom']), hx(P['lift'])
    v = smooth(0.0, 1.0, Y)
    img = top * (1 - v) + bottom * v
    lift_amt = {'hero': 0.55, 'bloom': 0.40, 'card': 0.30}[variant]
    g = torch.exp(-(((X - 0.5) / 0.55) ** 2 + ((Y - 0.42) / 0.50) ** 2)) * lift_amt
    img = img * (1 - g) + lift * g
    # blooms: soft glows in the accents; their summed colour and strength also tint the contour lines
    acc = torch.zeros_like(img); strength = torch.zeros_like(X)
    for (col, amt), (fx, fy, rx, ry) in zip(P['blooms'][variant], PLACES[variant]):
        m = torch.exp(-(((X - fx) / rx) ** 2 + ((Y - fy) / ry) ** 2)) * amt
        acc = acc + hx(col) * m; strength = strength + m
    img = img * (1 - strength.clamp(0, 1)) + acc
    tint = acc / strength.clamp(min=1e-4)                          # the local bloom colour
    # contour lines over the gradient, brighter and coloured inside a bloom
    line, index = contours(height(X, Y), S)
    k = {'card': 0.7, 'bloom': 1.0, 'hero': 0.9}[variant]
    a = line * (P['line_alpha'] + (P['index_alpha'] - P['line_alpha']) * index) * k
    near_bloom = (strength / 0.25).clamp(0, 1)
    a = a * (1 + 1.6 * near_bloom)
    lc = hx(P['line']) * (1 - near_bloom) + tint * near_bloom
    img = img * (1 - a) + lc * a
    # a quiet vignette, as the satin wall had
    vig = smooth(0.35, 1.0, torch.sqrt(((xs - W / 2) / (W * 0.62)) ** 2 + ((ys - H / 2) / (H * 0.62)) ** 2))
    img = img * (1 - 0.35 * vig)
    return img.permute(1, 2, 0).clamp(0, 1).cpu().numpy()


if __name__ == '__main__':
    from ff import write_img
    from media import ensure_media_dir
    if len(sys.argv) != 2:
        sys.exit('usage: python3 video/edit/lib/background.py <folder under the media root>')
    out = ensure_media_dir(sys.argv[1], 'wall folder')            # media root only
    for v in VARIANTS:
        write_img(to_u8(render(2304, 1296, v)), os.path.join(out, f'wall-{v}.png'))
    print(f'contour walls -> {out}')
