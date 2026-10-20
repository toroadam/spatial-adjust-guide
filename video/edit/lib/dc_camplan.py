# Ported from iCentral MarCom double-clicks/tools/dc_camplan.py (84 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""Double Clicks camera planner: zoom on the UI the voice is talking about, not on every click.

Same output as the hero's camplan.plan (cam [cx, cy, s], pos, rx, ry, rz per timeline frame), different law:
  focus    the director's live highlight / focus box (take track frame[5], CSS px) when there is one, else the cursor.
  zoom     with a box: fit it to ~60% of the view (s_base .. s_max); without: a gentle s_base that follows the cursor.
           Gaps between boxes shorter than `bridge` s hold the zoom (no out-and-back), boxes shorter than 0.4 s are
           ignored, and log-zoom is smoothed slowly (zero-phase, omega_z) so every move is a calm ease.
  tilt     per-chapter angle that sweeps slowly from a0 to a1 across the shot (`angle`), flattened ~40% when zoomed in
           so the text stays readable, plus the hero's slow drift.
"""
import math, os, sys
import numpy as np
from scipy.ndimage import gaussian_filter1d

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from camplan import zero_phase, ease, ease_sine  # noqa: E402

FPS = 60

# The Double Click look (dc_build.py:39-42): the window faces the camera dead on, with no tilt and no drift. Pass FLAT as
# wide_over/macro_over (or angle) and plan through no_drift(...) (or TL.window_shot(drift=None)) for the same framing.
FLAT = dict(rx=0.0, ry=0.0, rz=0.0)


def no_drift(planner):
    """planner with drift forced off, exactly the override dc_build.py:41-42 applies to camplan.plan."""
    f = lambda *a, **k: planner(*a, **{**k, 'drift': None})
    f.full_rows = getattr(planner, 'full_rows', False)
    return f


def dc_plan(track, src_in, src_out, speed, t0, clicks, Z, wide, macro, angle=None, s_base_k=1.35, s_max_k=2.7, fit=(0.62, 0.58),
            bridge=1.4, omega_f=2.6, omega_z=2.2, entrance=0.04, drift=(0.8, 0.4, 7.0), view=(1920, 1080), win=(1920, 1080), boxes_from=None, **_):
    n = int(round((src_out - src_in) / speed * FPS))
    ts = src_in + np.arange(n) * speed / FPS
    tr = [f for f in track if f[1] is not None]
    tt_ = np.array([f[0] for f in tr], float)
    fx = np.interp(ts, tt_, [f[1] for f in tr]); fy = np.interp(ts, tt_, [f[2] for f in tr])
    idx = np.clip(np.searchsorted(tt_, ts), 0, len(tr) - 1)
    box = np.full((n, 4), np.nan)
    for i, j in enumerate(idx):
        b = tr[j][5] if len(tr[j]) > 5 else None
        if b and (boxes_from is None or ts[i] >= boxes_from): box[i] = b     # a chapter ignores the previous line's boxes
    has = ~np.isnan(box[:, 0])

    # runs of boxes: drop blips, bridge short gaps
    def runs(m):
        out, i = [], 0
        while i < n:
            if m[i]:
                j = i
                while j < n and m[j]: j += 1
                out.append([i, j]); i = j
            else: i += 1
        return out
    for a, b in runs(has):
        if (b - a) / FPS < 0.4: has[a:b] = False; box[a:b] = np.nan
    s_w = wide['s']; s_base, s_max = s_w * s_base_k, s_w * s_max_k
    bw = np.maximum(box[:, 2] - box[:, 0], 1); bh = np.maximum(box[:, 3] - box[:, 1], 1)
    s_box = np.clip(np.minimum(fit[0] * view[0] / bw, fit[1] * view[1] / bh), s_base, s_max)
    ls = np.where(has, np.log(s_box), np.log(s_base))
    foc = np.stack([np.where(has, (box[:, 0] + box[:, 2]) / 2, fx), np.where(has, (box[:, 1] + box[:, 3]) / 2, fy)], 1)
    R = runs(has)
    for (a0, a1), (b0, b1) in zip(R, R[1:]):
        if (b0 - a1) / FPS <= bridge:
            w = np.linspace(0, 1, b0 - a1 + 2)[1:-1]
            ls[a1:b0] = ls[a1 - 1] + (ls[b0] - ls[a1 - 1]) * w
            foc[a1:b0] = foc[a1 - 1] + (foc[b0] - foc[a1 - 1]) * w[:, None]

    ls = gaussian_filter1d(zero_phase(ls, omega_z), 0.25 * FPS, mode='nearest')
    F = gaussian_filter1d(zero_phase(foc, omega_f), 0.2 * FPS, axis=0, mode='nearest')
    s = np.exp(ls)
    z = np.clip(np.log(s / s_w) / math.log(s_max_k), 0, 1)
    zc = np.clip(z * 2.0, 0, 1)                                   # how far the view follows the focus (vs window centre)
    hw, hh = view[0] / 2 / s, view[1] / 2 / s
    cxm = np.clip(F[:, 0], np.minimum(hw, win[0] / 2), np.maximum(win[0] - hw, win[0] / 2))
    cym = np.clip(F[:, 1], np.minimum(hh, win[1] / 2), np.maximum(win[1] - hh, win[1] / 2))
    cx = win[0] / 2 + (cxm - win[0] / 2) * zc; cy = win[1] / 2 + (cym - win[1] / 2) * zc

    tt = t0 + np.arange(n) / FPS
    u = ease_sine(np.arange(n) / max(1, n - 1))
    A = angle or dict(rx=(wide['rx'], wide['rx']), ry=(wide['ry'], wide['ry']), rz=(wide['rz'], wide['rz']))
    flat = 1 - 0.4 * z
    rx = (A['rx'][0] + (A['rx'][1] - A['rx'][0]) * u) * flat
    ry = (A['ry'][0] + (A['ry'][1] - A['ry'][0]) * u) * flat
    rz = (A['rz'][0] + (A['rz'][1] - A['rz'][0]) * u) * flat
    if drift:
        ph = (tt - t0) / drift[2] * 2 * math.pi
        ry = ry + drift[0] * np.sin(ph); rx = rx + drift[1] * np.sin(ph * 0.7 + 1)
    px = wide['pos'][0] + (macro['pos'][0] - wide['pos'][0]) * z; py = wide['pos'][1] + (macro['pos'][1] - wide['pos'][1]) * z
    if entrance: s = s * (1 + entrance * (1 - ease(np.arange(n) / FPS / 0.35)))
    k = lambda arr: [[round(float(a), 4), round(float(b), 4), 'linear'] for a, b in zip(tt, arr)]
    cam = [[round(float(a), 4), [round(float(x), 3), round(float(y), 3), round(float(q), 5)], 'linear'] for a, x, y, q in zip(tt, cx, cy, s)]
    pos = [[round(float(a), 4), [round(float(x), 2), round(float(y), 2)], 'linear'] for a, x, y in zip(tt, px, py)]
    return dict(cam=cam, pos=pos, rx=k(rx), ry=k(ry), rz=k(rz), z=z.tolist(), focus=F.tolist(), ts_src=ts.tolist(), t=tt.tolist())


dc_plan.full_rows = True     # reads frame[5] focus boxes: TL.window_shot passes it whole capture rows, not cursor_frames
