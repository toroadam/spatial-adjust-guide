# Ported from iCentral MarCom 06-edit/compositor/lib/engine.py (587 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""Compositor engine v1 (ported from the iCentral MarCom compositor; colours from THEME in theme.py).

Deterministic, frame-stepped 60 fps compositor. A timeline JSON (see build_timelines.py) is evaluated at t = i/60 for every
output frame; nothing depends on wall-clock time. GPU maths runs on Apple MPS through PyTorch; sources are decoded by ffmpeg
(yuv420p, BT.709 or BT.601 by tag) and converted on the GPU; frames are piped into ffmpeg/libx264.

Layer types
  plate    a source video (or still) placed as a 3D card: camera point (cx, cy) in source CSS px maps to output (ox, oy) at
           scale s (output px per source CSS px), optional rx/ry tilt with perspective, crop rect, rounded corners + soft
           shadow (window treatment), grade (sat, exposure), opacity. Mip-mapped sampling keeps 4K push-ins sharp and
           un-aliased at every scale.
  peel     page-corner curl: renders its 'top' plate, then curls it away from a corner (cylinder model, back face, shading,
           cast shadows) over whatever is beneath. The plate beneath gets a colour flood that follows the curl.
  text     a pre-rendered Golos UI asset (render_gfx.mjs) with an animation preset: rise (per word), type (typewriter with
           block cursor), fade; optional frosted card behind it.
  image    a pre-rendered RGBA asset (logo, lockup) with fade/scale keyframes.
  card     frosted-glass card (blurs what is beneath) with keyframed rect.
"""
import json, math, os, subprocess, sys, time
import numpy as np
import torch
import torch.nn.functional as F

sys.path.insert(0, os.path.dirname(__file__))
from ff import FFMPEG, probe, read_png  # noqa: E402
from theme import THEME  # noqa: E402

DEV = torch.device(os.environ.get('SA_VIDEO_DEV') or ('mps' if torch.backends.mps.is_available() else 'cpu'))   # SA_VIDEO_DEV=cpu when GPU memory is starved; CPU when MPS is absent (CI)
DT = torch.float32
FPS = 60


# --------------------------------------------------------------------------------------------------------------------
# easing + keyframes
# --------------------------------------------------------------------------------------------------------------------
def _bez(p1x, p1y, p2x, p2y):
    def f(t):
        if t <= 0: return 0.0
        if t >= 1: return 1.0
        lo, hi = 0.0, 1.0
        for _ in range(40):
            m = (lo + hi) / 2
            x = 3 * (1 - m) ** 2 * m * p1x + 3 * (1 - m) * m * m * p2x + m ** 3
            if x < t: lo = m
            else: hi = m
        m = (lo + hi) / 2
        return 3 * (1 - m) ** 2 * m * p1y + 3 * (1 - m) * m * m * p2y + m ** 3
    return f


EASE = {
    'linear': lambda t: t,
    'inOutCubic': _bez(0.65, 0, 0.35, 1),      # camera
    'outQuint': _bez(0.22, 1, 0.36, 1),        # type in
    'outCubic': _bez(0.33, 1, 0.68, 1),        # window float settle
    'inCubic': _bez(0.32, 0, 0.67, 0),         # type out
    'inOutSine': _bez(0.37, 0, 0.63, 1),       # slow drifts
    'outSine': _bez(0.61, 1, 0.88, 1),
    'inSine': _bez(0.12, 0, 0.39, 0),
    'inOutQuart': _bez(0.76, 0, 0.24, 1),      # morph
    'outExpo': _bez(0.16, 1, 0.3, 1),
}


def kf(track, t):
    """track: scalar | [[t, value, ease_into_this_key], ...]. Values may be scalars or lists."""
    if not isinstance(track, list) or not track or not isinstance(track[0], list):
        return track
    if t <= track[0][0]: return track[0][1]
    if t >= track[-1][0]: return track[-1][1]
    for a, b in zip(track, track[1:]):
        if a[0] <= t <= b[0]:
            u = (t - a[0]) / max(1e-9, b[0] - a[0])
            e = EASE[b[2] if len(b) > 2 else 'inOutCubic'](u)
            va, vb = a[1], b[1]
            if isinstance(va, list): return [x + (y - x) * e for x, y in zip(va, vb)]
            return va + (vb - va) * e
    return track[-1][1]


def clamp01(x): return max(0.0, min(1.0, x))


def hexrgb(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


# --------------------------------------------------------------------------------------------------------------------
# sources
# --------------------------------------------------------------------------------------------------------------------
class Source:
    """Sequential decoder for one plate. get(k) returns source frame k (60 fps grid from src_in) as a mip chain on DEV."""
    def __init__(self, path, src_in, still=False, rgba=False):
        self.path, self.src_in, self.still, self.rgba = path, src_in, still, rgba
        self.k = -1; self.cur = None; self.proc = None; self.eof = False
        p = probe(path); self.w, self.h = p['w'], p['h']
        raw = p['raw']
        self.matrix = 'bt709' if 'bt709' in raw.split('Video:')[1].split('\n')[0] else 'bt601'
        self.fps = p['fps']

    def _open(self):
        if self.still or self.path.endswith('.png'):
            a = read_png(self.path)
            self.cur = self._mips(torch.from_numpy(a.copy()).to(DEV).permute(2, 0, 1)[None].to(DT) / 255)
            self.still = True
            return
        if self.rgba:
            cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-ss', f'{self.src_in:.4f}', '-i', self.path, '-vf', f'fps={FPS}',
                   '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']
            self.fsize = self.w * self.h * 4
        else:
            vf = f'fps={FPS}' if abs(self.fps - FPS) > 0.01 else 'null'
            cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-ss', f'{self.src_in:.4f}', '-i', self.path, '-vf', vf,
                   '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-']
            self.fsize = self.w * self.h * 3 // 2
        self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=self.fsize * 2)

    def _yuv2rgb(self, buf):
        w, h = self.w, self.h
        a = torch.frombuffer(bytearray(buf), dtype=torch.uint8).to(DEV)
        y = a[:w * h].view(1, 1, h, w).to(DT)
        u = a[w * h:w * h + w * h // 4].view(1, 1, h // 2, w // 2).to(DT)
        v = a[w * h + w * h // 4:].view(1, 1, h // 2, w // 2).to(DT)
        u = F.interpolate(u, size=(h, w), mode='bilinear', align_corners=False)
        v = F.interpolate(v, size=(h, w), mode='bilinear', align_corners=False)
        y = (y - 16) / 219; u = (u - 128) / 224; v = (v - 128) / 224
        if self.matrix == 'bt709': kr, kb = 0.2126, 0.0722
        else: kr, kb = 0.299, 0.114
        kg = 1 - kr - kb
        r = y + 2 * (1 - kr) * v
        b = y + 2 * (1 - kb) * u
        g = (y - kr * r - kb * b) / kg
        return torch.cat([r, g, b], 1).clamp(0, 1)

    def _mips(self, img):
        levels = [img]
        while levels[-1].shape[-1] > 600 and len(levels) < 4:
            levels.append(F.avg_pool2d(levels[-1], 2))
        return levels

    def get(self, k):
        if self.cur is None and self.proc is None: self._open()
        if self.still: return self.cur
        k = max(0, k)
        last = None
        while self.k < k and not self.eof:
            buf = self.proc.stdout.read(self.fsize)
            if len(buf) < self.fsize:
                self.eof = True; break
            last = buf; self.k += 1
        if last is not None:            # decode only the frame that is shown (earlier ones are skipped as bytes)
            if self.rgba:
                img = torch.frombuffer(bytearray(last), dtype=torch.uint8).to(DEV).view(self.h, self.w, 4).permute(2, 0, 1)[None].to(DT) / 255
            else:
                img = self._yuv2rgb(last)
            self.cur = self._mips(img)
        return self.cur

    def close(self):
        if self.proc:
            try: self.proc.stdout.close(); self.proc.kill(); self.proc.wait()
            except Exception: pass
            self.proc = None


# --------------------------------------------------------------------------------------------------------------------
# geometry helpers
# --------------------------------------------------------------------------------------------------------------------
def rot3(rx, ry, rz):
    rx, ry, rz = [math.radians(a) for a in (rx, ry, rz)]
    Rx = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Ry = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Rz = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    return Ry @ Rx @ Rz


def plate_homography(s, ox, oy, rx, ry, rz, persp):
    """3x3 H mapping plate-local (u, v, 1) [CSS px relative to the camera point] -> output (x*w, y*w, w)."""
    R = rot3(rx, ry, rz); D = persp
    H = np.array([
        [D * s * R[0, 0] + ox * s * R[2, 0], D * s * R[0, 1] + ox * s * R[2, 1], ox * D],
        [D * s * R[1, 0] + oy * s * R[2, 0], D * s * R[1, 1] + oy * s * R[2, 1], oy * D],
        [s * R[2, 0], s * R[2, 1], D]])
    return H


class Canvas:
    def __init__(self, W, H):
        self.W, self.H = W, H
        ys, xs = torch.meshgrid(torch.arange(H, device=DEV, dtype=DT) + 0.5, torch.arange(W, device=DEV, dtype=DT) + 0.5, indexing='ij')
        self.xs, self.ys = xs, ys
        self.ones = torch.ones_like(xs)

    def unproject(self, Hinv):
        Hi = torch.tensor(Hinv, device=DEV, dtype=DT)
        X = Hi[0, 0] * self.xs + Hi[0, 1] * self.ys + Hi[0, 2]
        Y = Hi[1, 0] * self.xs + Hi[1, 1] * self.ys + Hi[1, 2]
        Wt = Hi[2, 0] * self.xs + Hi[2, 1] * self.ys + Hi[2, 2]
        return X / Wt, Y / Wt


def rrect_sdf(u, v, x0, y0, x1, y1, r):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx = (u - cx).abs() - hx; qy = (v - cy).abs() - hy
    out = torch.sqrt(qx.clamp(min=0) ** 2 + qy.clamp(min=0) ** 2)
    ins = torch.maximum(qx, qy).clamp(max=0)
    return out + ins - r


def sample(levels, sx, sy, scale_ratio):
    """Sample a mip chain at source pixel coords (level-0 units). scale_ratio = output px per level-0 source px."""
    lev = clamp01(0) if scale_ratio >= 1 else min(len(levels) - 1.0, math.log2(1 / scale_ratio))
    l0 = int(math.floor(lev)); l1 = min(l0 + 1, len(levels) - 1); fr = lev - l0
    def at(l):
        img = levels[l]; h, w = img.shape[-2:]; k = 2 ** l
        gx = (sx / k) / w * 2 - 1; gy = (sy / k) / h * 2 - 1
        g = torch.stack([gx, gy], -1)[None]
        return F.grid_sample(img, g, mode='bilinear', padding_mode='border', align_corners=False)
    a = at(l0)
    if fr > 1e-3 and l1 != l0:
        a = a * (1 - fr) + at(l1) * fr
    return a


def gauss_blur(img, sigma):
    if sigma < 0.5: return img
    # downsample for big blurs (cheap and smooth), then separable gaussian
    f = 1
    while sigma / f > 6 and img.shape[-1] / (f * 2) > 32: f *= 2
    x = F.avg_pool2d(img, f) if f > 1 else img
    s = sigma / f; r = int(math.ceil(s * 3))
    k = torch.exp(-(torch.arange(-r, r + 1, device=DEV, dtype=DT) ** 2) / (2 * s * s)); k = k / k.sum()
    C = x.shape[1]
    x = F.conv2d(F.pad(x, (r, r, 0, 0), mode='replicate'), k.view(1, 1, 1, -1).repeat(C, 1, 1, 1), groups=C)
    x = F.conv2d(F.pad(x, (0, 0, r, r), mode='replicate'), k.view(1, 1, -1, 1).repeat(C, 1, 1, 1), groups=C)
    if f > 1: x = F.interpolate(x, size=img.shape[-2:], mode='bilinear', align_corners=False)
    return x


def luma(rgb):
    return 0.2126 * rgb[:, 0:1] + 0.7152 * rgb[:, 1:2] + 0.0722 * rgb[:, 2:3]


def grade(rgb, sat=1.0, expo=0.0, contrast=1.0, tint=None, tint_amt=0.0):
    if sat != 1.0:
        L = luma(rgb); rgb = L + (rgb - L) * sat
    if contrast != 1.0: rgb = (rgb - 0.5) * contrast + 0.5
    if expo: rgb = rgb * (2 ** expo)
    if tint is not None and tint_amt:
        t = torch.tensor(tint, device=DEV, dtype=DT).view(1, 3, 1, 1); rgb = rgb * (1 - tint_amt) + luma(rgb) * t * tint_amt / max(1e-6, float(luma(t.view(1, 3, 1, 1)).item()))
    return rgb.clamp(0, 1)


def soft_shadow(sdf_px, blur, opacity):
    # smooth, gaussian-ish falloff from a signed distance (px)
    return opacity * 0.5 * torch.erfc(sdf_px / (blur * 0.7071) + 0.0)


# --------------------------------------------------------------------------------------------------------------------
# renderer
# --------------------------------------------------------------------------------------------------------------------
class Renderer:
    def __init__(self, tl, root):
        self.tl, self.root = tl, root
        self.W, self.H = tl['w'], tl['h']
        self.cv = Canvas(self.W, self.H)
        self.sources = {}
        self.assets = {}
        self.metrics = {}
        gdir = tl.get('gfx_dir')
        if gdir:
            mp = os.path.join(gdir, 'metrics.json')
            if os.path.exists(mp): self.metrics = json.load(open(mp))
        self._bg = None

    # ---- assets
    def asset(self, aid):
        if aid not in self.assets:
            a = read_png(os.path.join(self.tl['gfx_dir'], f'{aid}.png'))
            self.assets[aid] = torch.from_numpy(a.copy()).to(DEV).permute(2, 0, 1)[None].to(DT) / 255
        return self.assets[aid]

    def source(self, layer):
        key = layer['id']
        if key not in self.sources:
            self.sources[key] = Source(layer['file'], layer.get('src_in', 0.0), still=layer.get('still', False), rgba=layer.get('rgba', False))
        return self.sources[key]

    def release(self, t):
        for L in self.tl['layers']:
            if t > L['t1'] + 0.05:
                for sub in [L, L.get('top'), L.get('below'), L.get('overlay'), (L.get('top') or {}).get('overlay')]:
                    if sub and sub.get('id') in self.sources: self.sources.pop(sub['id']).close()

    # ---- background: blue-50 -> white gradient with two slow soft blooms
    def background(self, t):
        if self._bg is None:
            x = self.cv.xs / self.W; y = self.cv.ys / self.H
            g = clamp01  # noqa
            d = ((x * 0.55 + y * 0.45)).clamp(0, 1)
            c0 = torch.tensor(hexrgb(THEME['bg_tint']), device=DEV).view(1, 3, 1, 1); c1 = torch.tensor([1.0, 1.0, 1.0], device=DEV).view(1, 3, 1, 1)
            e = d * d * (3 - 2 * d)
            self._bg = (c0 * (1 - e) + c1 * e).to(DT)
        bg = self._bg
        bl = self.tl.get('bloom', 1.0)
        if bl:
            out = bg.clone()
            for (cx, cy, rad, col, amt, ph) in [(0.18, 0.22, 0.55, THEME['bloom_a'], 0.10, 0.0), (0.86, 0.80, 0.50, THEME['bloom_b'], 0.12, 2.1)]:
                px = (cx + 0.035 * math.sin(t * 0.21 + ph)) * self.W; py = (cy + 0.03 * math.cos(t * 0.17 + ph)) * self.H
                r = rad * max(self.W, self.H)
                m = torch.exp(-(((self.cv.xs - px) ** 2 + (self.cv.ys - py) ** 2) / (r * r)) * 2.2)[None, None] * amt * bl
                cc = torch.tensor(hexrgb(col), device=DEV, dtype=DT).view(1, 3, 1, 1)
                out = out * (1 - m) + cc * m
            return out
        return bg

    # ---- plate
    def plate(self, L, t, frame_k):
        src = self.source(L)
        levels = src.get(frame_k)
        dsf = L.get('dsf', 2.0)
        cw, ch = src.w / dsf, src.h / dsf
        cam = kf(L['cam'], t)                    # [cx, cy, s]
        cx, cy, s = cam[0], cam[1], cam[2]
        ox, oy = kf(L.get('pos', [self.W / 2, self.H / 2]), t)
        rx, ry, rz = kf(L.get('rx', 0), t), kf(L.get('ry', 0), t), kf(L.get('rz', 0), t)
        H = plate_homography(s, ox, oy, rx, ry, rz, L.get('persp', 2400.0))
        u, v = self.cv.unproject(np.linalg.inv(H))
        sxp = (cx + u) * dsf; syp = (cy + v) * dsf
        rgb = sample(levels, sxp, syp, s / dsf)
        a_src = None
        if rgb.shape[1] == 4: a_src = rgb[:, 3:4]; rgb = rgb[:, :3]
        crop = kf(L.get('crop', [0, 0, cw, ch]), t)
        radius = kf(L.get('radius', 0.0), t)            # output px
        sdf = rrect_sdf(cx + u, cy + v, crop[0], crop[1], crop[2], crop[3], radius / s) * s
        alpha = (0.5 - sdf).clamp(0, 1)[None, None]
        if a_src is not None: alpha = alpha * a_src
        clip = kf(L.get('clip'), t) if L.get('clip') is not None else None
        if clip is not None:
            # output-space window: fixed rounded rect, content moves/zooms inside it
            csdf = rrect_sdf(self.cv.xs, self.cv.ys, clip[0], clip[1], clip[2], clip[3], kf(L.get('clip_radius', 18.0), t))
            alpha = alpha * (0.5 - csdf).clamp(0, 1)[None, None]
        g = L.get('grade', {})
        sat = kf(g.get('sat', 1.0), t); expo = kf(g.get('expo', 0.0), t); con = kf(g.get('contrast', 1.0), t)
        if sat != 1.0 or expo or con != 1.0:
            rgb = grade(rgb, sat, expo, con, tint=g.get('tint'), tint_amt=kf(g.get('tint_amt', 0.0), t))
        blur = kf(L.get('blur', 0.0), t)
        if blur > 0.3: rgb = gauss_blur(rgb, blur)
        op = kf(L.get('opacity', 1.0), t)
        shadow = None
        sh = kf(L.get('shadow', 0.0), t)
        if sh > 0.001 and clip is not None:
            cr = kf(L.get('clip_radius', 18.0), t)
            sa = rrect_sdf(self.cv.xs, self.cv.ys - 28, clip[0], clip[1], clip[2], clip[3], cr)
            sc_ = rrect_sdf(self.cv.xs, self.cv.ys - 6, clip[0], clip[1], clip[2], clip[3], cr)
            shadow = (soft_shadow(sa, 46, 0.20) + soft_shadow(sc_, 10, 0.10))[None, None] * sh * op
        elif sh > 0.001:
            # two-layer soft shadow (ambient + contact) of the same rounded rect, offset down in output px
            base = sdf[None, None]
            sdf_a = rrect_sdf(cx + u, cy + v - 28 / s, crop[0], crop[1], crop[2], crop[3], radius / s) * s
            sdf_c = rrect_sdf(cx + u, cy + v - 6 / s, crop[0], crop[1], crop[2], crop[3], radius / s) * s
            shadow = (soft_shadow(sdf_a, 46, 0.20) + soft_shadow(sdf_c, 10, 0.10))[None, None] * sh * op
        return rgb, alpha * op, shadow

    # ---- text
    def text(self, L, t, out):
        img = self.asset(L['asset']); m = self.metrics.get(L['asset'], {})
        x0, y0 = kf(L['pos'], t)                                   # top-left of the asset box, output px
        anim = L.get('anim', 'rise'); tin, tout = L['in'], L['out']
        dur_in = L.get('dur_in', 0.6); dur_out = L.get('dur_out', 0.35); dy = L.get('dy', 26)
        h, w = img.shape[-2:]
        layers = []                                                # (x, y, crop box(x0,x1), alpha)
        if anim == 'type':
            chars = m.get('chars', []); cps = L.get('cps', 22)
            nvis = int(clamp01((t - tin) * cps / max(1, len(chars))) * len(chars) + 1e-6) if t >= tin else 0
            nvis = min(len(chars), int((t - tin) * cps) + 1) if t >= tin else 0
            o = 1.0 - EASE['inCubic'](clamp01((t - tout) / dur_out)) if t >= tout else 1.0
            yoff = -dy * 0.5 * EASE['inCubic'](clamp01((t - tout) / dur_out)) if t >= tout else 0.0
            xr = (chars[nvis - 1]['x'] + chars[nvis - 1]['w']) if nvis > 0 else (chars[0]['x'] if chars else 0)
            soft = L.get('soft', False)
            if soft and nvis > 0:
                # v3: each new glyph fades in over ~1/cps s instead of popping
                fr_ = clamp01((t - tin) * cps - (nvis - 1))
                xa_ = chars[nvis - 1]['x']; xp_ = int(math.floor(xa_))
                if nvis > 1: layers.append((x0, y0 + yoff, 0, xp_, o))
                layers.append((x0, y0 + yoff, xp_, int(math.ceil(xr)) + 1, o * (0.25 + 0.75 * fr_)))
            elif nvis > 0: layers.append((x0, y0 + yoff, 0, int(math.ceil(xr)) + 1, o))
            # block cursor: solid while typing, blinks (530 ms) after, gone on the way out
            if L.get('cursor', True) and t >= tin - 0.25 and t < min(tout, L.get('cursor_off', 1e9)):
                done = nvis >= len(chars)
                tb = t - (tin + len(chars) / cps)
                on = (not done) or (int(max(0, tb) / 0.53) % 2 == 0)
                cur_o = 1.0
                if soft:   # smooth blink (eased sine) and a soft fade out with the text
                    on = True; cur_o = 1.0 if not done else 0.5 + 0.5 * math.cos(2 * math.pi * max(0.0, tb) / 1.06)
                    cur_o = cur_o * cur_o * (3 - 2 * cur_o)
                if on and chars and cur_o > 0.01:
                    ch0 = chars[min(nvis, len(chars) - 1)]
                    cx = x0 + (xr + 4 if nvis > 0 else chars[0]['x'])
                    cur_h = ch0['h'] * 0.78; cur_w = max(3, ch0['h'] * 0.42)
                    cy = y0 + ch0['y'] + (ch0['h'] - cur_h) / 2
                    col = torch.tensor(hexrgb(L.get('cursor_color', THEME['cursor'])), device=DEV, dtype=DT).view(1, 3, 1, 1)
                    msk = ((self.cv.xs >= cx) & (self.cv.xs < cx + cur_w) & (self.cv.ys >= cy) & (self.cv.ys < cy + cur_h)).to(DT)[None, None] * cur_o
                    out = out * (1 - msk) + col * msk
        elif anim == 'rise':
            words = m.get('words') or [{'x': 0, 'y': 0, 'w': w, 'h': h}]
            stag = L.get('stagger', 0.07); wt = L.get('word_times')
            for i, wd in enumerate(words):
                ti = wt[i] if wt else tin + i * stag
                if t < ti: continue
                e = EASE['outQuint'](clamp01((t - ti) / dur_in))
                o = e
                yo = dy * (1 - e)
                if t >= tout:
                    eo = EASE['inCubic'](clamp01((t - tout - i * stag * 0.4) / dur_out)); o *= 1 - eo; yo -= dy * 0.6 * eo
                x_a = int(math.floor(wd['x'])) - 2; x_b = int(math.ceil(wd['x'] + wd['w'])) + 2
                layers.append((x0, y0 + yo, max(0, x_a), min(w, x_b), o))
        else:  # fade
            e = EASE['outQuint'](clamp01((t - tin) / dur_in)); o = e
            if t >= tout: o *= 1 - EASE['inCubic'](clamp01((t - tout) / dur_out))
            yo = dy * (1 - e)
            layers.append((x0, y0 + yo, 0, w, o))
        op = kf(L.get('opacity', 1.0), t)
        for (lx, ly, xa, xb, o) in layers:
            if o <= 0.002 or xb <= xa: continue
            out = self.blit(out, img[..., xa:xb], lx + xa, ly, o * op)
        return out

    def blit(self, out, img, x, y, opacity=1.0, scale=1.0):
        """Alpha-blend an RGBA tensor at output (x, y). Integer positions copy exactly; fractional ones resample."""
        h, w = img.shape[-2:]
        if scale != 1.0:
            nh, nw = max(1, int(round(h * scale))), max(1, int(round(w * scale)))
            img = F.interpolate(img, size=(nh, nw), mode='bilinear', align_corners=False, antialias=True); h, w = nh, nw
        fx, fy = x - math.floor(x), y - math.floor(y)
        if abs(fx) > 1e-3 or abs(fy) > 1e-3:
            img = F.pad(img, (1, 1, 1, 1))
            th = torch.tensor([[1, 0, -fx * 2 / (w + 2)], [0, 1, -fy * 2 / (h + 2)]], device=DEV, dtype=DT)[None]
            g = F.affine_grid(th, img.shape, align_corners=False)
            img = F.grid_sample(img, g, mode='bilinear', padding_mode='zeros', align_corners=False)
            x, y = math.floor(x) - 1, math.floor(y) - 1; h, w = h + 2, w + 2
        else:
            x, y = int(round(x)), int(round(y))
        X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(self.W, x + w), min(self.H, y + h)
        if X1 <= X0 or Y1 <= Y0: return out
        src = img[..., Y0 - y:Y1 - y, X0 - x:X1 - x]
        a = src[:, 3:4] * opacity
        out[..., Y0:Y1, X0:X1] = out[..., Y0:Y1, X0:X1] * (1 - a) + src[:, :3] * a
        return out

    # ---- frosted card
    def card(self, L, t, out):
        x, y, w, h = kf(L['rect'], t)
        op = kf(L.get('opacity', 1.0), t)
        if op <= 0.002 or w < 2 or h < 2: return out
        r = L.get('radius', 16)
        sdf = rrect_sdf(self.cv.xs, self.cv.ys, x, y, x + w, y + h, r)
        m = (0.5 - sdf).clamp(0, 1)[None, None] * op
        sdf_s = rrect_sdf(self.cv.xs, self.cv.ys - 14, x, y, x + w, y + h, r)
        sh = soft_shadow(sdf_s, 30, 0.16)[None, None] * op
        out = out * (1 - sh)
        pad = 60
        X0, Y0 = int(max(0, x - pad)), int(max(0, y - pad)); X1, Y1 = int(min(self.W, x + w + pad)), int(min(self.H, y + h + pad))
        region = out[..., Y0:Y1, X0:X1]
        blurred = gauss_blur(region, L.get('blur', 22))
        tint = torch.tensor(hexrgb(L.get('tint', THEME['card_tint'])), device=DEV, dtype=DT).view(1, 3, 1, 1)
        frost = blurred * (1 - L.get('tint_amt', 0.80)) + tint * L.get('tint_amt', 0.80)
        mm = m[..., Y0:Y1, X0:X1]
        out[..., Y0:Y1, X0:X1] = region * (1 - mm) + frost * mm
        # hairline edge
        edge = ((0.5 - (sdf + 0.75).abs()).clamp(0, 1) * 0.35)[None, None] * op
        out = out * (1 - edge) + torch.ones_like(out) * edge
        return out

    # ---- image
    def image(self, L, t, out):
        img = self.asset(L['asset'])
        tin, tout = L['in'], L['out']
        e = EASE[L.get('ease_in', 'outQuint')](clamp01((t - tin) / L.get('dur_in', 0.7)))
        o = e
        if t >= tout: o *= 1 - EASE['inCubic'](clamp01((t - tout) / L.get('dur_out', 0.35)))
        sc = kf(L.get('scale', 1.0), t)
        sc0 = L.get('scale_from', 1.0)
        s = sc * (sc0 + (1 - sc0) * e)
        x, y = kf(L['pos'], t)       # centre
        h, w = img.shape[-2:]
        dy = L.get('dy', 0) * (1 - e)
        return self.blit(out, img, x - w * s / 2, y - h * s / 2 + dy, o * kf(L.get('opacity', 1.0), t), scale=s)

    # ---- peel
    def peel(self, L, t, out):
        """Curl plate L['top'] away from a corner, revealing plate L['below'] (with a colour flood that follows the curl)."""
        W, H = self.W, self.H
        p = clamp01((t - L['t0']) / (L['t1'] - L['t0']))
        e = EASE[L.get('ease', 'inOutCubic')](p)
        corner = L.get('corner', [W, H])
        n = np.array(L.get('dir', [-1.0, -0.62]), dtype=float); n = n / np.linalg.norm(n); nperp = np.array([-n[1], n[0]])
        R = L.get('r0', 50) + L.get('r1', 150) * e
        umax = max(float((np.array(c, dtype=float) - corner) @ n) for c in [(0, 0), (W, 0), (0, H), (W, H)])
        f = -R + (umax + math.pi * R + 2 * R + 40) * e
        xs, ys = self.cv.xs, self.cv.ys
        U = (xs - corner[0]) * float(n[0]) + (ys - corner[1]) * float(n[1])
        V = (xs - corner[0]) * float(nperp[0]) + (ys - corner[1]) * float(nperp[1])
        def to_xy(uo): return corner[0] + uo * float(n[0]) + V * float(nperp[0]), corner[1] + uo * float(n[1]) + V * float(nperp[1])
        def inside(px, py): return (px >= 0) & (px <= W) & (py >= 0) & (py <= H)
        def samp(img, px, py):
            g = torch.stack([px / W * 2 - 1, py / H * 2 - 1], -1)[None]
            return F.grid_sample(img, g, mode='bilinear', padding_mode='border', align_corners=False)
        # beneath: the new plate, flooded with colour by how long each pixel has been uncovered
        tb = L['below']
        rgbB, aB, shB = self.plate(tb, t, self.kframe(tb, t))
        reveal_d = (f - R) - U
        base = L.get('flood_base', 0.2); spread = L.get('flood_spread', 560)
        amt = (reveal_d / spread).clamp(0, 1); amt = (amt * amt * (3 - 2 * amt))[None, None]
        g_amt = base + (1 - base) * amt
        g_amt = torch.maximum(g_amt, torch.tensor(EASE['inOutSine'](clamp01((t - L['t1']) / 0.4)), device=DEV, dtype=DT))
        if L.get('flood_global'): g_amt = torch.maximum(g_amt, torch.tensor(p ** 1.6, device=DEV, dtype=DT))   # v2: fully coloured by the end of the curl
        Lb = luma(rgbB); rgbB = (Lb + (rgbB - Lb) * g_amt).clamp(0, 1)
        below = out * (1 - aB) + rgbB * aB
        # top page
        tt = L['top']
        rgbT, aT, _ = self.plate(tt, t, self.kframe(tt, t))
        if tt.get('overlay'):
            ov = tt['overlay']; ro, ao, _ = self.plate(ov, t, self.kframe(ov, t))
            rgbT = rgbT * (1 - ao) + ro * ao
        top = torch.cat([rgbT, aT], 1)
        d = f - U
        flat = (U >= f)
        cyl = (U < f) & (U >= f - R)
        dd = (d / R).clamp(-1, 1)
        th_b = math.pi - torch.asin(dd); uo_b = f - R * th_b; pxb, pyb = to_xy(uo_b)
        back_ok = cyl & (uo_b >= 0) & inside(pxb, pyb)
        th_f = torch.asin(dd); uo_f = f - R * th_f; pxf, pyf = to_xy(uo_f)
        front_ok = cyl & ~back_ok & (uo_f >= 0) & inside(pxf, pyf)
        uo_fl = 2 * f - U - math.pi * R; pxl, pyl = to_xy(uo_fl)
        flap_ok = flat & (uo_fl >= 0) & inside(pxl, pyl)
        A_back = samp(top, pxb, pyb); A_front = samp(top, pxf, pyf); A_flap = samp(top, pxl, pyl)
        paper = torch.tensor([0.95, 0.955, 0.965], device=DEV, dtype=DT).view(1, 3, 1, 1)
        def backside(A, shade): return (paper * 0.84 + luma(A[:, :3]) * 0.16) * shade
        shade_b = (0.78 + 0.22 * torch.sin(th_b))[None, None]
        shade_f = (0.60 + 0.40 * torch.cos(th_f))[None, None]
        res = below
        csh = (0.45 * torch.exp(-reveal_d.clamp(min=0) / (16 + R * 0.35)) * (reveal_d > 0).to(DT))[None, None] * min(1.0, p * 10)
        res = res * (1 - csh)
        flat_only = (flat & ~flap_ok).to(DT)[None, None]
        fsh = (0.30 * torch.exp(uo_fl.clamp(max=0) / 22.0) * (uo_fl < 0).to(DT))[None, None] * flat_only
        fa = flat_only * top[:, 3:4]
        res = res * (1 - fa) + (top[:, :3] * (1 - fsh)) * fa
        m = front_ok.to(DT)[None, None] * A_front[:, 3:4]
        res = res * (1 - m) + (A_front[:, :3] * shade_f) * m
        m = back_ok.to(DT)[None, None] * A_back[:, 3:4]
        res = res * (1 - m) + backside(A_back, shade_b) * m
        flap_shade = (0.90 + 0.10 * (uo_fl / (f + 1)).clamp(0, 1))[None, None]
        m = flap_ok.to(DT)[None, None] * A_flap[:, 3:4]
        res = res * (1 - m) + backside(A_flap, flap_shade) * m
        return res

    def kframe(self, L, t):
        if L.get('hold_frame') is not None: return L['hold_frame']
        k = int(math.floor((t - L['t0']) * L.get('speed', 1.0) * FPS + 1e-6)) + L.get('frame_offset', 0)
        if L.get('freeze_after') is not None: k = min(k, L['freeze_after'])
        return k

    # ---- frame
    def frame(self, t):
        out = self.background(t)
        for L in self.tl['layers']:
            if not (L['t0'] - 1e-9 <= t < L['t1'] - 1e-9): continue
            typ = L['type']
            if typ == 'plate':
                rgb, a, sh = self.plate(L, t, self.kframe(L, t))
                if sh is not None: out = out * (1 - sh)
                out = out * (1 - a) + rgb * a
                if L.get('overlay'):
                    ov = L['overlay']; ro, ao, _ = self.plate(ov, t, self.kframe(ov, t))
                    out = out * (1 - ao) + ro * ao
            elif typ == 'peel': out = self.peel(L, t, out)
            elif typ == 'text': out = self.text(L, t, out)
            elif typ == 'image': out = self.image(L, t, out)
            elif typ == 'card': out = self.card(L, t, out)
            elif typ == 'solid':
                c = torch.tensor(hexrgb(L['color']), device=DEV, dtype=DT).view(1, 3, 1, 1); o = kf(L.get('opacity', 1.0), t)
                out = out * (1 - o) + c * o
        return out

    def close(self):
        for s in self.sources.values(): s.close()
