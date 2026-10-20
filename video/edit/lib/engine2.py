# Ported from iCentral MarCom 06-edit/compositor/lib/engine2.py (561 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""Compositor engine v2 (style test, Toro identity).  Extends engine.py (v1 stays reproducible, untouched).

New in v2
  wall     wallpaper layer: a pre-rendered Toro bloom (lib/wallpaper.py) with slow drift (zoom/pan tracks) and opacity.
  plate    window as a physical object: rounded corners in SOURCE units (corners scale with the window, like Teams),
           big two-layer shadow, perspective tilt, per-frame camera tracks from the cursor-follow planner, plus:
             lift  - a UI element lifts off the window plane (own scale about an anchor, own shadow). Matte = rounded rect
                     ('rect') or the element's own light pixels closed morphologically ('luma': dialogs + dropdown panels).
             dof   - depth-of-field fall-off around the focus point when zoomed (amount track).
             mblur - camera motion blur: the plate is re-sampled at up to 8 sub-frame camera positions across a 180-degree
                     shutter when the on-screen motion exceeds ~1.5 px/frame, and averaged (premultiplied).
             comp  - the source is a nested timeline rendered every frame (used for the in-window page peel).
  image    wipe reveal (soft-edged left-to-right mask) for the logo lockup.
"""
import math, os, sys
import numpy as np
import torch
import torch.nn.functional as F

sys.path.insert(0, os.path.dirname(__file__))
import engine as E  # noqa: E402
from engine import (DEV, DT, FPS, EASE, kf, clamp01, hexrgb, Source, plate_homography, rrect_sdf, sample, gauss_blur, luma,
                    grade, soft_shadow)  # noqa: E402
from ff import read_png  # noqa: E402
from theme import THEME  # noqa: E402


def smoothstep(e0, e1, x):
    t = ((x - e0) / (e1 - e0)).clamp(0, 1); return t * t * (3 - 2 * t)


class Renderer2(E.Renderer):
    def __init__(self, tl, root):
        super().__init__(tl, root)
        self.walls = {}; self.subs = {}; self._matte_cache = {}

    def background(self, t):
        return torch.zeros(1, 3, self.H, self.W, device=DEV, dtype=DT)

    # ---- wallpaper
    def wall(self, L, t, out):
        f = L['file']
        if f not in self.walls:
            a = read_png(f)[..., :3]
            self.walls[f] = torch.from_numpy(a.copy()).to(DEV).permute(2, 0, 1)[None].to(DT) / 255
        img = self.walls[f]; h, w = img.shape[-2:]
        z = kf(L.get('zoom', 1.0), t); px, py = kf(L.get('pan', [0.0, 0.0]), t)
        # cover the frame, centred, zoomed by z, panned by (px, py) in output px
        cover = max(self.W / w, self.H / h) * z
        sx = (self.cv.xs - self.W / 2 - px) / cover + w / 2
        sy = (self.cv.ys - self.H / 2 - py) / cover + h / 2
        g = torch.stack([sx / w * 2 - 1, sy / h * 2 - 1], -1)[None]
        rgb = F.grid_sample(img, g, mode='bilinear', padding_mode='border', align_corners=False)
        o = kf(L.get('opacity', 1.0), t)
        bl = kf(L.get('blur', 0.0), t)
        if bl > 0.3: rgb = gauss_blur(rgb, bl)
        dim = kf(L.get('dim', 0.0), t)
        if dim: rgb = rgb * (1 - dim)
        return out * (1 - o) + rgb * o

    # ---- comp source (nested timeline)
    def comp_levels(self, L, t):
        key = L['id']
        if key not in self.subs:
            c = L['comp']; sub = dict(c); sub.setdefault('gfx_dir', self.tl.get('gfx_dir'))
            self.subs[key] = Renderer2(sub, self.root)
        img = self.subs[key].frame(t)
        lv = [img]
        while lv[-1].shape[-1] > 600 and len(lv) < 4: lv.append(F.avg_pool2d(lv[-1], 2))
        return lv, img.shape[-1], img.shape[-2]

    def kframe(self, L, t):
        k = int(math.floor((t - L['t0']) * L.get('speed', 1.0) * FPS + 1e-6)) + L.get('frame_offset', 0)
        if L.get('freeze_after') is not None: k = min(k, L['freeze_after'])
        return k

    # ---- luma matte for 'luma' lifts (dialog + its dropdown panels), cached per source frame
    def luma_matte(self, L, levels, k, spec, dsf):
        key = (L['id'], k)
        if key in self._matte_cache: return self._matte_cache[key]
        lv = levels[min(1, len(levels) - 1)] if dsf >= 2 else levels[0]
        ls = dsf / (2 if (dsf >= 2 and len(levels) > 1) else 1)            # level px per CSS px
        y = luma(lv[:, :3])
        m = (y > spec.get('thr', 0.93)).to(DT)
        x0, y0, x1, y1 = [int(v * ls) for v in spec['region']]
        reg = torch.zeros_like(m); reg[..., y0:y1, x0:x1] = 1; m = m * reg
        c = int(spec.get('close', 21) * ls) | 1
        m = F.max_pool2d(m, c, 1, c // 2); m = -F.max_pool2d(-m, c, 1, c // 2)                      # closing
        o = int(spec.get('open', 7) * ls) | 1
        m = -F.max_pool2d(-m, o, 1, o // 2); m = F.max_pool2d(m, o, 1, o // 2)                      # opening (drop specks)
        m = gauss_blur(m, 0.8 * ls)
        sh = gauss_blur(m, spec.get('shadow_blur', 16) * ls)
        self._matte_cache = {key: (m, sh, ls)}
        return m, sh, ls

    # ---- plate at one (sub-)time
    def _plate_at(self, L, t, tk, frame_levels, sw, sh_, dsf):
        cam = kf(L['cam'], t); cx, cy, s = cam[0], cam[1], cam[2]
        ox, oy = kf(L.get('pos', [self.W / 2, self.H / 2]), t)
        rx, ry, rz = kf(L.get('rx', 0), t), kf(L.get('ry', 0), t), kf(L.get('rz', 0), t)
        Hm = plate_homography(s, ox, oy, rx, ry, rz, L.get('persp', 2200.0))
        u, v = self.cv.unproject(np.linalg.inv(Hm))
        X, Y = cx + u, cy + v                                     # source CSS coords per output pixel
        rgb = sample(frame_levels, X * dsf, Y * dsf, s / dsf)
        a_src = None
        if rgb.shape[1] == 4: a_src = rgb[:, 3:4]; rgb = rgb[:, :3]
        cw, ch = sw / dsf, sh_ / dsf
        crop = kf(L.get('crop', [0, 0, cw, ch]), t)
        rs = kf(L.get('radius_src', 0.0), t)
        # anti-aliased edge: distance in source units scaled to output px by the local scale (approx s)
        sdf = rrect_sdf(X, Y, crop[0], crop[1], crop[2], crop[3], rs) * s
        alpha = (0.5 - sdf).clamp(0, 1)[None, None]
        if a_src is not None: alpha = alpha * a_src
        g = L.get('grade', {})
        sat = kf(g.get('sat', 1.0), t); expo = kf(g.get('expo', 0.0), t); con = kf(g.get('contrast', 1.0), t)
        if sat != 1.0 or expo or con != 1.0: rgb = grade(rgb, sat, expo, con)
        # lifts
        for sp in L.get('lifts', []):
            op = kf(sp.get('op', 1.0), t)
            if op <= 0.002: continue
            k = 1 + (sp.get('k', 1.05) - 1) * op
            ax, ay = sp['anchor']
            LX, LY = ax + (X - ax) / k, ay + (Y - ay) / k
            lrgb = sample(frame_levels, LX * dsf, LY * dsf, s * k / dsf)[:, :3]
            if sat != 1.0 or expo or con != 1.0: lrgb = grade(lrgb, sat, expo, con)
            off = sp.get('shadow_off', 18) * op
            if sp['mode'] == 'rect':
                r = sp['region']; rr = sp.get('radius', 10)
                m = (0.5 - rrect_sdf(LX, LY, r[0], r[1], r[2], r[3], rr) * s * k).clamp(0, 1)[None, None]
                shd = soft_shadow(rrect_sdf(LX, LY - off / k, r[0], r[1], r[2], r[3], rr) * s * k, 26, 0.55)[None, None]
            else:
                mt, mts, ls = self.luma_matte(L, frame_levels, tk, sp, dsf)
                hh, ww = mt.shape[-2:]
                gx = (LX * ls) / ww * 2 - 1; gy = (LY * ls) / hh * 2 - 1
                m = F.grid_sample(mt, torch.stack([gx, gy], -1)[None], mode='bilinear', padding_mode='zeros', align_corners=False)
                gy2 = ((LY - off / k) * ls) / hh * 2 - 1
                shd = F.grid_sample(mts, torch.stack([gx, gy2], -1)[None], mode='bilinear', padding_mode='zeros', align_corners=False) * 0.6
            if sp.get('levels'):          # highlight grade on the lifted element only (black/white points, eased in with op)
                lb, lw = sp['levels']; lv = ((lrgb - lb) / (lw - lb)).clamp(0, 1)
                lrgb = lrgb + (lv - lrgb) * op
            rgb = rgb * (1 - shd * op)
            rgb = rgb * (1 - m) + lrgb * m
        # window shadow (output-space offsets via source-space shift)
        shadow = None; shs = kf(L.get('shadow', 0.0), t)
        if shs > 0.001:
            o1, o2 = 36.0 / s, 8.0 / s
            sa = rrect_sdf(X, Y - o1, crop[0], crop[1], crop[2], crop[3], rs) * s
            sc = rrect_sdf(X, Y - o2, crop[0], crop[1], crop[2], crop[3], rs) * s
            shadow = (soft_shadow(sa, 70, 0.55) + soft_shadow(sc, 14, 0.30)).clamp(0, 0.85)[None, None] * shs
        return rgb, alpha, shadow, (ox, oy)

    def plate(self, L, t, frame_k):
        if L.get('comp'):
            levels, sw, sh_ = self.comp_levels(L, t); dsf = L.get('dsf', 2.0)
        else:
            src = self.source(L); levels = src.get(frame_k); sw, sh_ = src.w, src.h; dsf = L.get('dsf', 2.0)
        op = kf(L.get('opacity', 1.0), t)
        rgb, a, shadow, focus = self._plate_at(L, t, frame_k, levels, sw, sh_, dsf)
        if L.get('mblur'):
            # on-screen motion of the camera across a 180-degree shutter: project the source frame corners at t +/- 1/240
            def corners(tt):
                cam = kf(L['cam'], tt); ox, oy = kf(L.get('pos', [self.W / 2, self.H / 2]), tt)
                Hm = plate_homography(cam[2], ox, oy, kf(L.get('rx', 0), tt), kf(L.get('ry', 0), tt), kf(L.get('rz', 0), tt), L.get('persp', 2200.0))
                P = np.array([[-400, -300, 1], [400, -300, 1], [-400, 300, 1], [400, 300, 1], [0, 0, 1]], float).T
                q = Hm @ P; return (q[:2] / q[2]).T
            d = np.abs(corners(t + 1 / 240) - corners(t - 1 / 240)).max()
            n = int(min(8, math.ceil(d / 1.5)))
            if n >= 2:
                acc = rgb * a; acc_a = a.clone()
                for i in range(n):
                    if i == (n - 1) // 2 and n % 2: continue
                    tt = t + ((i + 0.5) / n - 0.5) / 120
                    r2, a2, _, _ = self._plate_at(L, tt, frame_k, levels, sw, sh_, dsf)
                    acc = acc + r2 * a2; acc_a = acc_a + a2
                cnt = n + (0 if n % 2 else 1)
                a = acc_a / cnt; rgb = acc / cnt / a.clamp(min=1e-4)
        dof = kf(L.get('dof', 0.0), t)
        if dof > 0.02:
            fx, fy = focus
            r = torch.sqrt((self.cv.xs - fx) ** 2 + ((self.cv.ys - fy) * 1.25) ** 2)
            msk = smoothstep(self.H * 0.45, self.H * 1.05, r)[None, None] * dof
            rgb = rgb * (1 - msk) + gauss_blur(rgb, 3.5) * msk
        return rgb, a * op, (shadow * op if shadow is not None else None)

    # ---- image with wipe
    def image(self, L, t, out):
        if not L.get('wipe'): return super().image(L, t, out)
        img = self.asset(L['asset']).clone(); h, w = img.shape[-2:]
        w0, w1 = L['wipe']; e = EASE[L.get('wipe_ease', 'inOutCubic')](clamp01((t - w0) / (w1 - w0)))
        fe = L.get('feather', 60)
        xs = torch.arange(w, device=DEV, dtype=DT)
        edge = -fe + (w + fe) * e
        m = (1 - smoothstep(edge, edge + fe, xs)).view(1, 1, 1, w)
        img[:, 3:4] = img[:, 3:4] * m
        o = 1.0
        if t >= L['out']: o = 1 - EASE['inCubic'](clamp01((t - L['out']) / L.get('dur_out', 0.35)))
        sc = kf(L.get('scale', 1.0), t); x, y = kf(L['pos'], t)
        return self.blit(out, img, x - w * sc / 2, y - h * sc / 2, o * kf(L.get('opacity', 1.0), t), scale=sc)

    # ---- simple keyframed image (logo) without the v1 entrance preset
    def logo(self, L, t, out):
        img = self.asset(L['asset']); h, w = img.shape[-2:]
        sc = kf(L.get('scale', 1.0), t); x, y = kf(L['pos'], t); o = kf(L.get('opacity', 1.0), t)
        if o <= 0.002: return out
        bl = kf(L.get('blur', 0.0), t)
        if bl > 0.3: img = gauss_blur(img, bl)
        return self.blit(out, img, x - w * sc / 2, y - h * sc / 2, o, scale=sc)

    def frame(self, t):
        out = self.background(t)
        for L in self.tl['layers']:
            if not (L['t0'] - 1e-9 <= t < L['t1'] - 1e-9): continue
            typ = L['type']
            if typ == 'wall': out = self.wall(L, t, out)
            elif typ == 'plate':
                rgb, a, sh = self.plate(L, t, self.kframe(L, t))
                if sh is not None: out = out * (1 - sh)
                out = out * (1 - a) + rgb * a
                for ovk in ('overlay',):
                    if L.get(ovk):
                        ov = L[ovk]; ro, ao, _ = self.plate(ov, t, self.kframe(ov, t)); out = out * (1 - ao) + ro * ao
            elif typ == 'peel': out = self.peel(L, t, out)
            elif typ == 'peel3d': out = self.peel3d(L, t, out)
            elif typ == 'peel_strip': out = self.peel_strip(L, t, out)
            elif typ == 'text': out = self.text(L, t, out)
            elif typ == 'image': out = self.image(L, t, out)
            elif typ == 'logo': out = self.logo(L, t, out)
            elif typ == 'card': out = self.card(L, t, out)
            elif typ == 'solid':
                c = torch.tensor(hexrgb(L['color']), device=DEV, dtype=DT).view(1, 3, 1, 1); o = kf(L.get('opacity', 1.0), t)
                out = out * (1 - o) + c * o
            elif typ == 'flash':
                o = kf(L.get('opacity', 0.0), t)
                if o > 0: out = out + (1 - out) * o
        return out.clamp(0, 1)


# ----------------------------------------------------------------------------------------------------------------------
# v2 peel (Teams 0:09.5-0:11 model): a tight curl that LIFTS the page into a standing flap instead of folding it flat.
# Measured on Teams at 12 fps: the strip curls from the left end of the header and travels across in ~1.45 s
# (0:09.63 -> 0:11.08), curl radius ~1/3 of the header height, the peeled part stands up at ~110-125 deg and leans back over
# the still-attached part, the camera pushes in slightly and drifts with the curl.
# Rendered top-down in the window's own plane (comp space) with the flap foreshortened by |cos(theta_max)| and seen from
# underneath (paper back), shaded by angle; the flap casts a soft shadow on the page under it.
# ----------------------------------------------------------------------------------------------------------------------
def _peel3d(self, L, t, out):
    W, H = self.W, self.H
    p = clamp01((t - L['t0']) / (L['t1'] - L['t0']))
    e = EASE[L.get('ease', 'inOutSine')](p)
    corner = L.get('corner', [0, 0])
    n = np.array(L.get('dir', [1.0, 0.25]), dtype=float); n = n / np.linalg.norm(n); nperp = np.array([-n[1], n[0]])
    R = L.get('r0', 40) + L.get('r1', 80) * e
    th_m = L.get('theta_max', 2.1); cm, sm = math.cos(th_m), math.sin(th_m)
    Lf = L.get('flap_len', 900)
    umax = max(float((np.array(c, dtype=float) - corner) @ n) for c in [(0, 0), (W, 0), (0, H), (W, H)])
    f_end = umax + R * sm + Lf * abs(cm) + R + 60
    f = -R * 2 + (f_end + R * 2) * e
    xs, ys = self.cv.xs, self.cv.ys
    U = (xs - corner[0]) * float(n[0]) + (ys - corner[1]) * float(n[1])
    V = (xs - corner[0]) * float(nperp[0]) + (ys - corner[1]) * float(nperp[1])
    def to_xy(uo): return corner[0] + uo * float(n[0]) + V * float(nperp[0]), corner[1] + uo * float(n[1]) + V * float(nperp[1])
    def inside(px, py): return (px >= 0) & (px <= W) & (py >= 0) & (py <= H)
    def samp(img, px, py):
        g = torch.stack([px / W * 2 - 1, py / H * 2 - 1], -1)[None]
        return F.grid_sample(img, g, mode='bilinear', padding_mode='border', align_corners=False)
    # beneath: the new UI, colour flooding behind the curl
    tb = L['below']; rgbB, aB, _ = self.plate(tb, t, self.kframe(tb, t))
    reveal_d = (f - R) - U
    base = L.get('flood_base', 0.25); spread = L.get('flood_spread', 900)
    amt = smoothstep(0, 1, (reveal_d / spread).clamp(0, 1))[None, None]
    g_amt = torch.maximum(base + (1 - base) * amt, torch.tensor(p ** 1.6, device=DEV, dtype=DT))
    Lb = luma(rgbB); rgbB = (Lb + (rgbB - Lb) * g_amt).clamp(0, 1)
    res = out * (1 - aB) + rgbB * aB
    # top page (old UI + its overlay)
    tt = L['top']; rgbT, aT, _ = self.plate(tt, t, self.kframe(tt, t))
    if tt.get('overlay'):
        ov = tt['overlay']; ro, ao, _ = self.plate(ov, t, self.kframe(ov, t)); rgbT = rgbT * (1 - ao) + ro * ao
    top = torch.cat([rgbT, aT], 1)
    paper = torch.tensor([0.95, 0.955, 0.965], device=DEV, dtype=DT).view(1, 3, 1, 1)
    # contact shadow of the curl on the revealed UI
    csh = (0.40 * torch.exp(-reveal_d.clamp(min=0) / (14 + R * 0.5)) * (reveal_d > 0).to(DT))[None, None] * min(1.0, p * 10)
    res = res * (1 - csh)
    # (a) flat, still attached
    flat = (U >= f)
    # flap footprint (screen U range) for its shadow on the flat page
    u_f0 = f - R * sm
    s_fl = th_m * R + (U - u_f0) / max(1e-6, -cm)
    flap_ok = (U >= u_f0) & (s_fl <= th_m * R + Lf)
    uo_fl = f - s_fl; pxl, pyl = to_xy(uo_fl)
    flap_ok = flap_ok & (uo_fl >= 0) & inside(pxl, pyl)
    fsh = (0.32 * flap_ok.to(DT))[None, None]
    fsh = gauss_blur(fsh, 10)
    fa = flat.to(DT)[None, None] * top[:, 3:4]
    res = res * (1 - fa) + (top[:, :3] * (1 - fsh)) * fa
    # (b) cylinder front (theta in [0, pi/2])
    d = ((f - U) / R).clamp(-1, 1)
    cyl = (U < f) & (U >= f - R)
    th_f = torch.asin(d); uo_f = f - R * th_f; pxf, pyf = to_xy(uo_f)
    front_ok = cyl & (uo_f >= 0) & inside(pxf, pyf)
    A_front = samp(top, pxf, pyf)
    m = front_ok.to(DT)[None, None] * A_front[:, 3:4]
    res = res * (1 - m) + (A_front[:, :3] * (0.62 + 0.38 * torch.cos(th_f))[None, None]) * m
    # (c) cylinder back (theta in [pi/2, theta_max])
    th_b = math.pi - torch.asin(d); uo_b = f - R * th_b; pxb, pyb = to_xy(uo_b)
    back_ok = cyl & (th_b <= th_m) & (U <= f - R * sm + 1e-3) & (uo_b >= 0) & inside(pxb, pyb)
    A_back = samp(top, pxb, pyb)
    def backside(A, shade): return (paper * 0.82 + luma(A[:, :3]) * 0.18) * shade
    m = back_ok.to(DT)[None, None] * A_back[:, 3:4]
    res = res * (1 - m) + backside(A_back, (0.70 + 0.25 * torch.sin(th_b))[None, None]) * m
    # (d) standing flap (seen from underneath, foreshortened), fading out at its far end (it leaves the frame upward)
    A_flap = samp(top, pxl, pyl)
    fade = (1 - smoothstep(th_m * R + Lf * 0.75, th_m * R + Lf, s_fl))[None, None]
    shade = 0.80 + 0.12 * (1 - ((s_fl - th_m * R) / Lf).clamp(0, 1))[None, None]
    m = flap_ok.to(DT)[None, None] * A_flap[:, 3:4] * fade
    res = res * (1 - m) + backside(A_flap, shade) * m
    # rim light on the curl crest
    crest = (torch.exp(-((U - (f - R * 0.15)) ** 2) / (2 * (R * 0.18 + 2) ** 2)) * cyl.to(DT))[None, None] * 0.25
    res = res + (1 - res) * crest
    return res


Renderer2.peel3d = _peel3d


# ----------------------------------------------------------------------------------------------------------------------
# v3 peel: a real 3D strip curl, ray-traced per pixel through the window camera (no 2D warp).
#   Geometry (page-local CSS units, frame (A, B, Hh): A along the peel direction n, B along the fold line, Hh = height
#   toward the camera): strip material at A < f wraps a cylinder of radius R tangent to the page at the fold line A = f,
#   then continues as a flat flap at angle theta_m. Every output pixel's camera ray is intersected analytically with the
#   page plane, the cylinder and the flap plane; the nearest valid hit wins.
#   Shading: normal-based. Front faces show the old page texture (Lambert-modulated). The back face is opaque: the greyed old
#   header colour, Lambert + Blinn-Phong specular (lit like satin plastic), with a lighter cut edge (page thickness) along
#   the strip border. Shadow rays (4 jittered light directions, soft) test the cylinder and the flap for the revealed UI, the
#   page and the wallpaper. Ambient occlusion where the curl meets the page. 2x2 supersampling; temporal motion blur
#   (3 sub-frame samples across a 180-degree shutter) while the fold or camera moves fast.
# ----------------------------------------------------------------------------------------------------------------------
def _peel_strip_frame(self, L, t, W2, H2):
    dev, dt_ = DEV, DT
    ys, xs = torch.meshgrid(torch.arange(H2, device=dev, dtype=dt_) + 0.5, torch.arange(W2, device=dev, dtype=dt_) + 0.5, indexing='ij')
    sc = W2 / self.W
    xs = xs / sc; ys = ys / sc
    cam = kf(L['cam'], t); cx, cy, s = cam
    ox, oy = kf(L['pos'], t); rx, ry, rz = kf(L.get('rx', 0), t), kf(L.get('ry', 0), t), kf(L.get('rz', 0), t)
    D = L.get('persp', 2000.0)
    Rm = torch.tensor(E.rot3(rx, ry, rz).T, device=dev, dtype=dt_)          # P -> local (rotation part; scale 1/s)
    # ray in P space: eye (0,0,-D), dir (x-ox, y-oy, D); local = R^T P / s ; page X = cx + u, Y = cy + v, Hh = -w
    ex = Rm @ torch.tensor([0.0, 0.0, -D], device=dev, dtype=dt_) / s
    dx = xs - ox; dy = ys - oy; dz = torch.full_like(xs, D)
    du = (Rm[0, 0] * dx + Rm[0, 1] * dy + Rm[0, 2] * dz) / s
    dv = (Rm[1, 0] * dx + Rm[1, 1] * dy + Rm[1, 2] * dz) / s
    dw = (Rm[2, 0] * dx + Rm[2, 1] * dy + Rm[2, 2] * dz) / s
    ou, ov, ow = float(ex[0]), float(ex[1]), float(ex[2])
    nx_, ny_ = kf(L['dir'], t); nn = math.hypot(nx_, ny_); nx_, ny_ = nx_ / nn, ny_ / nn; mx_, my_ = -ny_, nx_
    c0x, c0y = L.get('corner', [0, 0])
    # ray in (A, B, Hh)
    A0 = (cx + ou - c0x) * nx_ + (cy + ov - c0y) * ny_; B0 = (cx + ou - c0x) * mx_ + (cy + ov - c0y) * my_; H0 = -ow
    dA = du * nx_ + dv * ny_; dB = du * mx_ + dv * my_; dH = -dw
    p = clamp01((t - L['p0']) / (L['p1'] - L['p0'])) if t >= L['p0'] else -1.0
    Wp, Hp = L['page']; Hs = L['strip_h']; rs = L.get('radius_src', 26)
    # fold position: from before the strip's start to past its end
    Aext = [(x - c0x) * nx_ + (y - c0y) * ny_ for x, y in ((0, 0), (Wp, 0), (0, Hs), (Wp, Hs))]
    amin, amax = min(Aext), max(Aext)
    R = kf(L['r_track'], t) if L.get('r_track') else L['r0'] + L['r1'] * max(p, 0)
    thm = kf(L['theta_max'], t); cm, sm = math.cos(thm), math.sin(thm)
    if p < 0: f = amin - 4 * R
    else:
        e = EASE[L.get('ease', 'inOutSine')](p)
        f_end = L.get('f_end', amax + R * math.pi + L.get('overrun', 900))
        f0 = amin + L.get('f_start_r', -2.0) * R
        f = f0 + (f_end - f0) * e
    def mat_xy(a0, b):
        return c0x + a0 * nx_ + b * mx_, c0y + a0 * ny_ + b * my_
    def in_strip(X, Y):
        return (X >= 0) & (X <= Wp) & (Y >= 0) & (Y <= Hs)
    th1 = min(L.get('theta1', thm), thm); R2 = L.get('r2', R)
    P1A, P1H = f - R * math.sin(th1), R - R * math.cos(th1)
    C2A, C2H = P1A + R2 * math.sin(th1), P1H + R2 * math.cos(th1)
    a_th1 = f - R * th1
    flap_len = L.get('flap_len', 1e9)
    twist = kf(L.get('twist', 0.0), t)
    b_mid = (Hs / 2 - c0y - f * ny_) / my_ if abs(my_) > 1e-6 else 0.0
    def end_angle(Bv):            # v3b: the ribbon twists across its width (sticker-like): end angle varies with B
        if not twist: return torch.full_like(Bv, thm)
        return (thm + twist * (Bv - b_mid)).clamp(th1 + 0.05, 3.0)
    def lifted_hit(oA, oB, oH, vA, vB, vH, tmin=1e-3, iters=2):
        """Nearest hit of rays (o + t v) with the lifted strip: arc 1 (radius R about the fold), arc 2 (radius R2), flap.
        With twist, the end angle depends on B; solved by fixed-point iteration on B."""
        Bguess = oB + vB * (-oH / torch.where(vH.abs() < 1e-9, torch.full_like(vH, 1e-9), vH))
        for it in range(iters if twist else 1):
            thE = end_angle(Bguess)
            bt = torch.full_like(vA, 1e9); bk = torch.zeros_like(vA); bth = torch.zeros_like(vA); ba = torch.zeros_like(vA); bb = torch.zeros_like(vA); bq = torch.zeros_like(vA)
            def circle(cA, cH, rad, th_lo, th_hi, a_of, kid):
                nonlocal bt, bk, bth, ba, bb
                a1 = oA - cA; h1 = oH - cH
                qa = vA * vA + vH * vH; qb = 2 * (a1 * vA + h1 * vH); qc = a1 * a1 + h1 * h1 - rad * rad
                disc = qb * qb - 4 * qa * qc; sq = torch.sqrt(disc.clamp(min=0))
                for sign in (-1.0, 1.0):
                    tc = (-qb + sign * sq) / (2 * qa)
                    Ac = oA + tc * vA; Hc = oH + tc * vH; Bc = oB + tc * vB
                    th = torch.atan2(cA - Ac, cH - Hc); th = torch.where(th < -0.5, th + 2 * math.pi, th)
                    a0 = a_of(th); X, Y = mat_xy(a0, Bc)
                    ok = (disc >= 0) & (tc > tmin) & (th >= th_lo) & (th <= th_hi) & in_strip(X, Y) & (tc < bt)
                    bt = torch.where(ok, tc, bt); bk = torch.where(ok, torch.full_like(bk, kid), bk); bth = torch.where(ok, th, bth)
                    ba = torch.where(ok, a0, ba); bb = torch.where(ok, Bc, bb)
            circle(f, R, R, 0.0, th1, lambda th: f - R * th, 2)
            circle(C2A, C2H, R2, th1, thE, lambda th: a_th1 - R2 * (th - th1), 2)
            sm_, cm_ = torch.sin(thE), torch.cos(thE)
            PEA = C2A - R2 * sm_; PEH = C2H - R2 * cm_; a_end = a_th1 - R2 * (thE - th1)
            den = vA * sm_ + vH * cm_
            tf = ((PEA - oA) * sm_ + (PEH - oH) * cm_) / torch.where(den.abs() < 1e-9, torch.full_like(den, 1e-9), den)
            Af = oA + tf * vA; Hf = oH + tf * vH; Bf = oB + tf * vB
            q = (Af - PEA) * (-cm_) + (Hf - PEH) * sm_
            a0 = a_end - q; X, Y = mat_xy(a0, Bf)
            ok = (tf > tmin) & (q >= 0) & (q <= flap_len) & in_strip(X, Y) & (tf < bt)
            bt = torch.where(ok, tf, bt); bk = torch.where(ok, torch.full_like(bk, 3), bk); bth = torch.where(ok, thE, bth)
            ba = torch.where(ok, a0, ba); bb = torch.where(ok, Bf, bb); bq = torch.where(ok, q, bq)
            Bguess = torch.where(bk > 0, bb, Bguess)
        return bt, bk, bth, ba, bb, bq
    INF = torch.full_like(xs, 1e9)
    best_t = INF.clone(); kind = torch.zeros_like(xs); q_hit = torch.zeros_like(xs)       # 1 plane, 2 cylinder, 3 flap
    th_hit = torch.zeros_like(xs); a0_hit = torch.zeros_like(xs); b_hit = torch.zeros_like(xs)
    # page plane
    tp = -H0 / dH
    Ap = A0 + tp * dA; Bp = B0 + tp * dB
    ok = tp > 0
    best_t = torch.where(ok, tp, best_t); kind = torch.where(ok, torch.ones_like(kind), kind); a0_hit = torch.where(ok, Ap, a0_hit); b_hit = torch.where(ok, Bp, b_hit)
    if p >= 0:
        lt, lk, lth, la0, lb, lq = lifted_hit(A0, B0, H0, dA, dB, dH)
        okl = lt < best_t
        best_t = torch.where(okl, lt, best_t); kind = torch.where(okl, lk, kind); th_hit = torch.where(okl, lth, th_hit)
        a0_hit = torch.where(okl, la0, a0_hit); b_hit = torch.where(okl, lb, b_hit); q_hit = torch.where(okl, lq, torch.zeros_like(lq))
    # plane hits: page material where (not strip) or (strip and A >= f); else revealed ground (new UI)
    Xh, Yh = mat_xy(a0_hit, b_hit)
    plane = kind == 1
    lifted_here = plane & in_strip(Xh, Yh) & (a0_hit < f)
    ground = lifted_here
    page_flat = plane & ~lifted_here
    curl = (kind == 2) | (kind == 3)
    # page bounds (rounded window)
    sd = E.rrect_sdf(Xh, Yh, 0, 0, Wp, Hp, rs)
    inside = (0.5 - sd * s).clamp(0, 1)
    # textures
    k_new = self.kframe(L['new'], t); lv_new = self.source(L['new']).get(k_new)
    lv_old = self._old_levels(L, t)
    dsf = 2.0
    def tex(levels, X, Y):
        return E.sample(levels, X * dsf, Y * dsf, s / dsf)
    rgb_old = tex(lv_old, Xh, Yh)[:, :3]
    rgb_new = tex(lv_new, Xh, Yh)[:, :3]
    # normals in (A, B, Hh) for lighting
    thv = torch.where(curl, th_hit, torch.zeros_like(th_hit))
    NA = torch.sin(thv); NH = torch.cos(thv)
    vlen = torch.sqrt(dA * dA + dB * dB + dH * dH)
    VA, VB, VH = -dA / vlen, -dB / vlen, -dH / vlen
    front = (NA * VA + NH * VH) >= 0
    sgn = torch.where(front, torch.ones_like(NA), -torch.ones_like(NA))
    nA, nH = NA * sgn, NH * sgn
    lu, lv_, lh = L.get('light', [-0.35, -0.55, 0.76])
    ln = math.sqrt(lu * lu + lv_ * lv_ + lh * lh); lu, lv_, lh = lu / ln, lv_ / ln, lh / ln
    LA = lu * nx_ + lv_ * ny_; LB = lu * mx_ + lv_ * my_; LH = lh
    ndl = (nA * LA + nH * LH).clamp(min=0)
    flat_ndl = max(LH, 1e-3)
    hA, hB, hH = LA + VA, LB + VB, LH + VH; hl = torch.sqrt(hA * hA + hB * hB + hH * hH)
    ndh = ((nA * hA + nH * hH) / hl).clamp(min=0)
    spec = ndh ** L.get('shininess', 36) * L.get('spec', 0.55)
    # front of the curl: page texture, lit
    front_col = (rgb_old * L.get('front_gain', 1.0)).clamp(0, 1) * (0.55 + 0.45 * (ndl / flat_ndl)).clamp(0, 1.25)[None, None] + spec[None, None] * 0.35
    back = torch.tensor(hexrgb(L.get('back_color', THEME['peel_back'])), device=dev, dtype=dt_).view(1, 3, 1, 1)
    ndv = (nA * VA + nH * VH).abs()
    sheen = (1 - ndv).clamp(0, 1) ** 3 * L.get('sheen', 0.45)                  # grazing-angle sheen along the curl
    fill = 0.30 * ndv                                                         # soft fill from the camera side
    amb = L.get('back_ambient', 0.30)
    back_col = back * (amb + (1 - amb) * 0.8 * ndl + fill * (1 - amb))[None, None] + (spec + sheen)[None, None]
    # cut edge (thickness): material within ~1.6 CSS px of the strip border, on the curl
    edge_d = torch.minimum(torch.minimum(Xh, Wp - Xh), torch.minimum(Yh, Hs - Yh))
    edge = ((1.6 - edge_d) / 1.2).clamp(0, 1) * curl.to(dt_)
    edge_col = torch.tensor([0.93, 0.93, 0.95], device=dev, dtype=dt_).view(1, 3, 1, 1) * (0.6 + 0.4 * ndl)[None, None]
    curl_col = torch.where(front[None, None], front_col, back_col)
    curl_col = curl_col * (1 - edge[None, None]) + edge_col * edge[None, None]
    # shadows from the curl (cylinder + flap) onto plane points (page, ground, wallpaper)
    shadow = torch.zeros_like(xs)
    if p >= 0:
        PA = A0 + tp * dA; PB = B0 + tp * dB      # plane point (A, B, 0)
        jit = [(0.0, 0.0), (0.12, 0.05), (-0.1, 0.09), (0.06, -0.12), (-0.07, -0.06), (0.1, -0.02)]
        for jA, jB in jit:
            sA, sB, sH = LA + jA, LB + jB, LH
            st_, sk_, _, _, _, _ = lifted_hit(PA, PB, torch.zeros_like(PA), torch.full_like(PA, sA), torch.full_like(PA, sB), torch.full_like(PA, sH), tmin=0.5)
            hit = (sk_ > 0) & (st_ < 5e8)
            shadow = shadow + hit.to(dt_) / len(jit)
        Xs_, Ys_ = mat_xy(PA, PB)
        shadow = shadow * L.get('shadow_amt', 0.42) * torch.exp(-((PA - f).abs()) / L.get('shadow_reach', 160.0)) * torch.exp(-(Ys_ - Hs).clamp(min=0) / 50.0)
        # ambient occlusion along the fold on the revealed ground
        dfold = (f - PA).clamp(min=0)
        ao = 0.38 * torch.exp(-dfold / (0.55 * R + 6)) * ((PA < f) & in_strip(*mat_xy(PA, PB))).to(dt_)
        shadow = (shadow + ao).clamp(0, 0.85)
    # ground colour flood (revealed new UI fades from greyed to full colour behind the fold)
    if L.get('flood', True) and p >= 0:
        amt = ((f - a0_hit) / L.get('flood_spread', 500)).clamp(0, 1); amt = amt * amt * (3 - 2 * amt)
        g = 0.3 + 0.7 * amt
        Lg = luma(rgb_new); rgb_new = (Lg + (rgb_new - Lg) * g[None, None]).clamp(0, 1)
    # plane (page / revealed ground) seen at every pixel, also behind the faded flap end
    Xp, Yp = mat_xy(Ap, Bp)
    gp = in_strip(Xp, Yp) & (Ap < f) if p >= 0 else torch.zeros_like(xs, dtype=torch.bool)
    rgb_new_p = tex(lv_new, Xp, Yp)[:, :3]
    if L.get('flood', True) and p >= 0:
        amt = ((f - Ap) / L.get('flood_spread', 500)).clamp(0, 1); amt = amt * amt * (3 - 2 * amt)
        gg = 0.3 + 0.7 * amt; Lg = luma(rgb_new_p); rgb_new_p = (Lg + (rgb_new_p - Lg) * gg[None, None]).clamp(0, 1)
    plane_col = torch.where(gp[None, None], rgb_new_p, tex(lv_old, Xp, Yp)[:, :3]) * (1 - shadow[None, None])
    inside_p = (0.5 - E.rrect_sdf(Xp, Yp, 0, 0, Wp, Hp, rs) * s).clamp(0, 1)
    fl = L.get('flap_len', 1e9)
    fade = torch.ones_like(xs)
    if p >= 0 and fl < 1e8: fade = torch.where(kind == 3, (1 - ((q_hit - (fl - 120)) / 120).clamp(0, 1)) ** 1.5, fade)
    cw = curl.to(dt_) * fade
    col = curl_col * cw[None, None] + plane_col * (1 - cw[None, None])
    alpha = cw + inside_p * (1 - cw)
    Xh, Yh = Xp, Yp
    # window drop shadow + curl shadow onto the wallpaper (outside the page)
    wsd_a = E.rrect_sdf(Xh, Yh - 36.0 / s, 0, 0, Wp, Hp, rs) * s
    wsd_c = E.rrect_sdf(Xh, Yh - 8.0 / s, 0, 0, Wp, Hp, rs) * s
    wsh = (soft_shadow(wsd_a, 70, 0.55) + soft_shadow(wsd_c, 14, 0.30)).clamp(0, 0.85) * float(kf(L.get('shadow', 1.0), t))
    bg_shadow = torch.maximum(wsh, shadow) * (1 - alpha)
    return col, alpha, bg_shadow


def _old_levels(self, L, t):
    key = ('old', round(t, 5))
    if getattr(self, '_old_key', None) == key: return self._old_lv
    if not hasattr(self, '_old_base'):
        a = read_png(L['old_still'])
        img = torch.from_numpy(a.copy()).to(DEV).permute(2, 0, 1)[None].to(DT) / 255
        g = L.get('old_grade', dict(sat=0.0, contrast=1.05, expo=-0.05))
        self._old_base = grade(img[:, :3], g.get('sat', 0.0), g.get('expo', 0.0), g.get('contrast', 1.0))
    ov = L['old_overlay']; lv = self.source(ov).get(self.kframe(ov, t))
    o = lv[0]; rgb = self._old_base * (1 - o[:, 3:4]) + o[:, :3] * o[:, 3:4]
    lvs = [rgb]
    while lvs[-1].shape[-1] > 600 and len(lvs) < 4: lvs.append(F.avg_pool2d(lvs[-1], 2))
    self._old_key, self._old_lv = key, lvs
    return lvs


def _peel_strip(self, L, t, out):
    ss = L.get('ss', 2)
    W2, H2 = self.W * ss, self.H * ss
    # temporal motion blur: 3 samples across a 180-degree shutter while moving
    times = [t]
    if L.get('mblur', True) and L['p0'] - 0.1 <= t <= L['p1'] + 0.05: times = [t + (i / 7 - 0.5) / 120 for i in range(8)]
    acc_c = 0; acc_a = 0; acc_s = 0
    for tt in times:
        c, a, sh = self.peel_strip_frame(L, tt, W2, H2)
        acc_c = acc_c + c * a[None, None]; acc_a = acc_a + a; acc_s = acc_s + sh
    n = len(times)
    c = acc_c / n; a = (acc_a / n)[None, None]; sh = (acc_s / n)[None, None]
    if ss > 1:
        c = F.avg_pool2d(c, ss); a = F.avg_pool2d(a, ss); sh = F.avg_pool2d(sh, ss)
    op = kf(L.get('opacity', 1.0), t)
    out = out * (1 - sh * op)
    return out * (1 - a * op) + c * op


Renderer2.peel_strip_frame = _peel_strip_frame
Renderer2._old_levels = _old_levels
Renderer2.peel_strip = _peel_strip
