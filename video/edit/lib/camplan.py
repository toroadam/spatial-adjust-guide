# Ported from iCentral MarCom 06-edit/compositor/lib/camplan.py (101 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""Screen Studio-style cursor-follow camera planner (v2).

Input per shot: the tracked cursor (tracks/<take>.json, CSS px per source frame), the click times from the shot script,
optional per-frame focus overrides (e.g. the dialog centre while the harness cursor is hidden under the CDK overlay), the
source range and speed, and two framings (wide float / zoomed macro). Output: per-timeline-frame keyframe tracks for the
engine (cam [cx, cy, s], pos, rx, ry, rz), sampled every frame and interpolated linearly by the engine.

Camera law
  focus(t)   = cursor position (or override), smoothed with a ZERO-PHASE critically damped 2nd-order filter (forward and
               backward pass, omega_f): no lag behind the cursor and no overshoot or jitter.
  z(t)       = zoom envelope: ramps to 1 starting `lead` s before the first click of each click cluster, holds through
               the cluster, releases `hold` s after the last click; clusters closer than `merge` s are joined. The
               envelope is smoothed with the same filter (omega_z) so it eases like a spring.
  s(t)       = s_wide * Z ** z(t)            (log-space zoom, constant perceived speed)
  centre(t)  = lerp(window centre, clamp(focus, view inside the window), z)
  pos/tilt   = lerp(wide framing, macro framing, z) + slow drift, plus an entrance settle after a cut.
"""
import json, math, os
import numpy as np

FPS = 60


def cd_filter(x, omega, fps=FPS):
    """Critically damped 2nd-order low-pass (semi-implicit Euler), one direction."""
    x = np.asarray(x, float); y = np.empty_like(x); p = x[0].copy() if x.ndim > 1 else x[0]; v = np.zeros_like(p)
    dt = 1 / fps
    for i in range(len(x)):
        a = omega * omega * (x[i] - p) - 2 * omega * v
        v = v + a * dt; p = p + v * dt; y[i] = p
    return y


def zero_phase(x, omega):
    f = cd_filter(x, omega); return cd_filter(f[::-1], omega)[::-1]


def ease(u):
    u = np.clip(u, 0, 1); return np.where(u < 0.5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)


def ease_sine(u):
    u = np.clip(u, 0, 1); return 0.5 - 0.5 * np.cos(np.pi * u)


def plan(track, src_in, src_out, speed, t0, clicks, Z, wide, macro, focus_override=None, lead=0.45, hold=0.45, merge=1.1,
         z_floor=0.0, z_start=None, omega_f=7.0, omega_z=6.0, entrance=0.08, win=(1920, 1080), view=(1920, 1080), drift=None,
         up_dur=None, down_dur=0.5, post_sigma=0.0, z_cap=None):
    """track: list [t, x, y, ...] at 60 fps in source time; returns dict of tracks keyed for the engine."""
    n = int(round((src_out - src_in) / speed * FPS))
    ts_src = src_in + np.arange(n) * speed / FPS
    tr = np.array(track, float)
    fx = np.interp(ts_src, tr[:, 0], tr[:, 1]); fy = np.interp(ts_src, tr[:, 0], tr[:, 2])
    if focus_override is not None:
        for (a, b, fn) in focus_override:
            m = (ts_src >= a) & (ts_src < b)
            if m.any():
                pts = np.array([fn(t) for t in ts_src[m]]); fx[m], fy[m] = pts[:, 0], pts[:, 1]
    # zoom envelope from click clusters
    cl = sorted(clicks); clusters = []
    for c in cl:
        if clusters and c - clusters[-1][1] <= merge: clusters[-1][1] = c
        else: clusters.append([c, c])
    z = np.full(n, z_floor)
    for a, b in clusters:
        ud = up_dur if up_dur is not None else lead * 0.8
        up = ease((ts_src - (a - lead)) / ud); dn = 1 - ease((ts_src - (b + hold)) / down_dur)
        z = np.maximum(z, np.minimum(up, dn))
    for (a, b, cap) in (z_cap or []):   # v5 (ER-1581): pull the zoom back over a source window (eased by the zero-phase pass below)
        m = (ts_src >= a) & (ts_src < b); z[m] = np.minimum(z[m], cap)
    if z_start is not None: z[:int(0.05 * FPS)] = np.maximum(z[:int(0.05 * FPS)], z_start)
    z = np.clip(zero_phase(z, omega_z), 0, 1)
    F = zero_phase(np.stack([fx, fy], 1), omega_f)
    s_w, s_m = wide['s'], wide['s'] * Z
    s = s_w * (Z ** z)
    # clamp the view inside the window (CSS px)
    hw, hh = view[0] / 2 / s, view[1] / 2 / s
    cxm = np.clip(F[:, 0], np.minimum(hw, win[0] / 2), np.maximum(win[0] - hw, win[0] / 2))
    cym = np.clip(F[:, 1], np.minimum(hh, win[1] / 2), np.maximum(win[1] - hh, win[1] / 2))
    cx = win[0] / 2 + (cxm - win[0] / 2) * z; cy = win[1] / 2 + (cym - win[1] / 2) * z
    lerp = lambda a, b: a + (b - a) * z
    px = lerp(wide['pos'][0], macro['pos'][0]); py = lerp(wide['pos'][1], macro['pos'][1])
    rx = lerp(wide['rx'], macro['rx']); ry = lerp(wide['ry'], macro['ry']); rz = lerp(wide['rz'], macro['rz'])
    tt = t0 + np.arange(n) / FPS
    if post_sigma > 0:   # v3: final zero-phase Gaussian pass on every camera channel (removes residual jerk)
        from scipy.ndimage import gaussian_filter1d
        sg = post_sigma * FPS
        cx, cy = gaussian_filter1d(cx, sg, mode='nearest'), gaussian_filter1d(cy, sg, mode='nearest')
        s = np.exp(gaussian_filter1d(np.log(s), sg, mode='nearest'))
        px, py = gaussian_filter1d(px, sg, mode='nearest'), gaussian_filter1d(py, sg, mode='nearest')
        rx, ry, rz = (gaussian_filter1d(np.asarray(v, float), sg, mode='nearest') for v in (rx, ry, rz))
    if drift:   # slow drift so the camera never stops: (ry amplitude, rx amplitude, period)
        ph = (tt - t0) / drift[2] * 2 * math.pi
        ry = ry + drift[0] * np.sin(ph); rx = rx + drift[1] * np.sin(ph * 0.7 + 1)
    if entrance:  # cut-in settle: start slightly larger, settle in 0.35 s (adds punch on the beat)
        e = 1 - ease(np.arange(n) / FPS / 0.35)
        s = s * (1 + entrance * e)
    k = lambda arr: [[round(float(a), 4), round(float(b), 4), 'linear'] for a, b in zip(tt, arr)]
    cam = [[round(float(a), 4), [round(float(x), 3), round(float(y), 3), round(float(q), 5)], 'linear'] for a, x, y, q in zip(tt, cx, cy, s)]
    pos = [[round(float(a), 4), [round(float(x), 2), round(float(y), 2)], 'linear'] for a, x, y in zip(tt, px, py)]
    return dict(cam=cam, pos=pos, rx=k(rx), ry=k(ry), rz=k(rz), z=z.tolist(), focus=F.tolist(), ts_src=ts_src.tolist(), t=tt.tolist())
