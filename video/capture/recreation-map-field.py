#!/usr/bin/env python3
"""Where the recreation map's station circles go: a fairway and green mask built from the satellite backdrop itself.

  python3 video/capture/recreation-map-field.py --episode video/episodes/dashboard-overview/episode.json [--debug-dir DIR]

Reads the backdrop named by the episode's recreationMap (from <media root>/map-backdrop, never from the repository), cuts the
window the map card shows (recreationMap.view), and classifies mowed turf by colour and texture: a green-dominant index
(g / mean(r, b)), low local luminance variance and enough brightness. Dark tree canopy (rough, mottled), cart-path grey, sand and
water fail one of those tests. Morphology removes specks and closes mowing stripes, small regions go, and the episode's
`exclude` ellipses remove turf that is not a fairway (the open meadow in the middle of the course, which the product's own map
has no stations on).

Circle centres come from the mask, not from hand-drawn lines: the distance transform of the mask is largest on a fairway's
centre line, so centres are taken greedily from the ridge of that transform (its local maxima across the fairway), strongest first, at least one
spacing apart; a second tier then fills wide turf (greens and their approaches) the same way until `total` is reached.
Every centre therefore lands inside the mask, at least `min_edge` card px from its edge. Chains are ordered along each fairway
region so a station's neighbours are its neighbours on the ground.

Writes recreationMap.spots = [[x %, y %, region], ...] (percent of the card) into the episode, and with --debug-dir the mask
overlay and the circle-centre overlay as PNGs (in the media root, never in the repository). Prints the fraction of centres inside
the strict mask (before the morphology) and inside the cleaned one.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'edit', 'lib'))


def media_root():
    return os.environ.get('SA_MEDIA_ROOT') or os.path.expanduser('~/Documents/SpatialAdjust_MarCom')


def window(im, view, card, scale):
    w, h = int(card[0] * scale), int(card[1] * scale)
    return im.crop((view['x0'], view['y0'], view['x0'] + view['w'], view['y0'] + view['h'])).convert('RGB').resize((w, h), Image.LANCZOS)


def classify(rgb, gmin=1.24, tmax=0.065, vmin=0.30, smin=0.15, scale=2.0, clean=True, min_area=3000):
    """Boolean mask of mowed turf from an RGB float array (0 to 1)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / (mx + 1e-6)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    m1 = ndi.uniform_filter(lum, 9); m2 = ndi.uniform_filter(lum * lum, 9)
    tex = np.sqrt(np.maximum(m2 - m1 * m1, 0))
    gi = g / (0.5 * (r + b) + 1e-3)
    t = (gi > gmin) & (tex < tmax) & (mx > vmin) & (sat > smin)
    if not clean:
        return t
    t = ndi.binary_opening(t, structure=np.ones((5, 5)))
    t = ndi.binary_closing(t, structure=np.ones((11, 11)))
    lab, n = ndi.label(t)
    sizes = ndi.sum(t, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > min_area * (scale / 2.0) ** 2])


def exclude_ellipses(mask, ellipses, card, scale):
    yy, xx = np.mgrid[0:mask.shape[0], 0:mask.shape[1]]
    for cx, cy, rx, ry in ellipses:             # percent of the card
        e = ((xx / scale - cx * card[0] / 100) / (rx * card[0] / 100)) ** 2 + ((yy / scale - cy * card[1] / 100) / (ry * card[1] / 100)) ** 2 <= 1
        mask = mask & ~e
    return mask


def greedy(cands, dt, min_dist, limit, taken):
    """Strongest first, at least min_dist from every taken point."""
    order = np.argsort(-dt[cands[:, 0], cands[:, 1]])
    out = []
    pts = list(taken)
    for k in order:
        p = cands[k]
        if len(out) >= limit: break
        if pts and np.min(np.hypot(*(np.array(pts) - p).T)) < min_dist: continue
        out.append(p); pts.append(p)
    return out


def place(mask, scale, diameter, total, min_edge=8.0, seed=1):
    dt = ndi.distance_transform_edt(mask) / scale                    # card px to the nearest non-turf
    d = ndi.gaussian_filter(dt, 1.5)
    ax = (d >= np.roll(d, 1, 1)) & (d >= np.roll(d, -1, 1)) & ((d > np.roll(d, 1, 1)) | (d > np.roll(d, -1, 1)))     # a ridge across x
    ay = (d >= np.roll(d, 1, 0)) & (d >= np.roll(d, -1, 0)) & ((d > np.roll(d, 1, 0)) | (d > np.roll(d, -1, 0)))     # or across y
    ridge = (ax | ay) & (dt >= min_edge)
    rc = np.argwhere(ridge)
    # tier 1: the centre lines, a little under one diameter apart so neighbours just overlap
    t1 = greedy(rc, dt, 0.85 * diameter * scale, total, [])
    spacing = 0.85 * diameter
    # tier 2: wide turf (greens, approaches, the second row on broad fairways), strongest first, never nearer than 0.72 diameter, at least 5 px inside
    wide = np.argwhere((dt >= 5) & mask)
    t2 = greedy(wide, dt, 0.66 * diameter * scale, total - len(t1), t1) if len(t1) < total else []
    return [tuple(p) for p in t1] + [tuple(p) for p in t2], dt, spacing


def order_regions(points, mask):
    """Region label per point and each region's points ordered along it (nearest neighbour from an end)."""
    lab, _ = ndi.label(mask)
    regions = {}
    for p in points: regions.setdefault(int(lab[p]), []).append(np.array(p, float))
    out = []
    for rid, pts in sorted(regions.items(), key=lambda kv: -len(kv[1])):
        P = np.array(pts); c = P - P.mean(0)
        axis = np.linalg.svd(c, full_matrices=False)[2][0] if len(P) > 1 else np.array([1., 0.])
        todo = list(np.argsort(c @ axis)); cur = todo.pop(0); seq = [cur]
        while todo:
            nxt = min(todo, key=lambda k: np.hypot(*(P[k] - P[cur]))); todo.remove(nxt); seq.append(nxt); cur = nxt
        out.append([tuple(P[k]) for k in seq])
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--episode', required=True)
    ap.add_argument('--debug-dir')
    ap.add_argument('--scale', type=float, default=2.0)
    ap.add_argument('--dry', action='store_true', help='do not write the episode')
    a = ap.parse_args(argv)
    ep = json.load(open(a.episode)); cfg = ep['recreationMap']
    card = cfg.get('card', [1046, 943])
    src = os.path.join(media_root(), 'map-backdrop', cfg['full'] if 'full' in cfg else cfg['file'])
    view = window(Image.open(src), cfg['view'], card, a.scale)
    rgb = np.asarray(view).astype(np.float32) / 255
    mask = exclude_ellipses(classify(rgb, scale=a.scale), cfg.get('exclude', []), card, a.scale)
    strict = exclude_ellipses(classify(rgb, clean=False, scale=a.scale), cfg.get('exclude', []), card, a.scale)
    pts, dt, spacing = place(mask, a.scale, cfg['diameter'], cfg['total'], seed=cfg.get('seed', 1))
    chains = order_regions(pts, mask)
    spots = []
    for ri, ch in enumerate(chains):
        for (y, x) in ch: spots.append([round(x / a.scale / card[0] * 100, 2), round(y / a.scale / card[1] * 100, 2), ri])
    inside = float(np.mean([mask[p] for p in pts])); inside_strict = float(np.mean([strict[p] for p in pts]))
    print(f'{len(pts)} centres in {len(chains)} regions, tier-1 spacing {spacing:.1f} px; inside the mask {inside:.1%}, inside the strict (uncleaned) mask {inside_strict:.1%}')
    if a.debug_dir:
        os.makedirs(a.debug_dir, exist_ok=True)
        base = np.asarray(view).copy()
        ov = base.copy(); ov[mask] = (0.55 * ov[mask] + 0.45 * np.array([255, 0, 255])).astype(np.uint8)
        Image.fromarray(ov).save(os.path.join(a.debug_dir, 'field-mask.png'))
        im = Image.fromarray(base); d = ImageDraw.Draw(im); R = cfg['diameter'] / 2 * a.scale
        for (y, x) in pts:
            d.ellipse([x - R, y - R, x + R, y + R], outline=(255, 255, 255), width=2); d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 0, 0))
        im.save(os.path.join(a.debug_dir, 'field-centres.png'))
    if not a.dry:
        cfg['spots'] = spots
        for k in ('chains', 'greens'): cfg.pop(k, None)
        json.dump(ep, open(a.episode, 'w'), indent=2, ensure_ascii=False); open(a.episode, 'a').write('\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
