# Ported from iCentral MarCom 06-edit/compositor/audio/build_audio.py (311 lines) on 2026-10-20; changes listed in video/edit/NOTES.md
"""Audio building blocks for the Spatial Adjust mix: the three stems of a timeline (VO, SFX, music), bar-aligned music
edits, synthesised SFX, BS.1770 loudness, a true-peak limiter and the VO sidechain key.

  stems(tl)                           dict(vo=(n,), sfx=(n, 2), music=(n, 2), segments=[...]) at 48 kHz for a timeline:
                                      VO lines from tl['vo_dir'] at their t, SFX at tl['sfx'] cues, the music block re-cut
  edit(m, segments, dur, xf, pre)     re-cut a music array on its bar grid (equal-power crossfade at every splice)
  sfx_click(), sfx_tick(), ...        SFX synthesised here from noise and sine partials: owned outright, no licence
  place(buf, clip, t, gain_db, pan)   add a mono clip into a stereo buffer
  lufs(x), true_peak_db(x)            BS.1770-4 integrated loudness and 4x-oversampled true peak
  limiter(x, ceiling_db)              look-ahead peak limiter on the true-peak envelope
  master(x, target, ceiling)          loudness to target with the limiter in the loop
  vo_activity(vo)                     0..1 ducking key from the VO

Every level and time constant comes from brand.py LOUDNESS (video/brand/motion-system.md, section 9) unless a caller
passes its own. Deterministic: the SFX noise uses a fixed RNG seed, reset for every timeline. The SFX recipes are
documented in video/brand/sfx.md. Files are read (VO, music) but never written here; mix_audio.py writes the mix.

The music file is read only after mix.py has checked it (path, SHA-256, licence): build stems through mix.py, which refuses
the iCentral preview track before any audio is read.
"""
import os
import subprocess
import sys

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
from brand import LOUDNESS, SFX  # noqa: E402

SR = LOUDNESS['sample_rate']


def eqp_fade(n):
    x = np.linspace(0, 1, n)
    return np.sin(x * np.pi / 2), np.cos(x * np.pi / 2)


def edit(m, segments, dur, xf=0.03, pre=0.02):
    """segments: [(T0, S0, S1)] contiguous on the timeline, each splice on a source downbeat. A splice at T is an
    equal-power crossfade of xf seconds over [T - pre, T - pre + xf]: the incoming bar starts `pre` early so its downbeat
    transient is intact. Source past the end of m reads as silence."""
    N = int(round(dur * SR))
    out = np.zeros((N + SR, 2))
    m = np.concatenate([m, np.zeros((SR * 2, 2))])
    for i, (T0, S0, S1) in enumerate(segments):
        T1 = segments[i + 1][0] if i + 1 < len(segments) else dur
        if abs((S1 - S0) - (T1 - T0)) > 1e-6:
            raise ValueError(f'music segment {i}: source {S0}-{S1} is not as long as timeline {T0}-{T1}')
        pin = min(pre, S0, T0) if i else 0.0
        last = i + 1 == len(segments)
        a = int(round((S0 - pin) * SR)); n = int(round(((T1 if last else T1 - pre + xf) - (T0 - pin)) * SR))
        seg = m[a:a + n].copy(); nx = int(round(xf * SR))
        if len(seg) < n:
            seg = np.concatenate([seg, np.zeros((n - len(seg), 2))])
        fi, fo = eqp_fade(nx)
        if i: seg[:nx] *= fi[:, None]
        if not last: seg[-nx:] *= fo[:, None]
        t = int(round((T0 - pin) * SR)); out[t:t + len(seg)] += seg[:max(0, len(out) - t)]
    return out[:N]


# ----------------------------------------------------------------------------------------------------------------------
# SFX (synthesised here; fully owned, no licence)
# ----------------------------------------------------------------------------------------------------------------------
rng = np.random.default_rng(871)


def reset_rng(seed=871):
    """Restart the SFX noise generator, so a mix renders the same SFX every time it is run."""
    global rng
    rng = np.random.default_rng(seed)


def env(n, a, d, sr=SR):
    t = np.arange(n) / sr
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4))


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, f, btype='low', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, btype='high', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def sfx_click(strength=1.0):
    n = int(0.045 * SR); t = np.arange(n) / SR
    tick = np.sin(2 * np.pi * 2400 * t) * env(n, 0.0008, 0.006)
    body = np.sin(2 * np.pi * 900 * t) * env(n, 0.001, 0.012) * 0.5
    nz = bp(rng.standard_normal(n), 2500, 9000) * env(n, 0.0005, 0.004) * 0.35
    return (tick * 0.6 + body + nz) * 0.25 * strength


def sfx_tick():                                          # typing / soft key
    n = int(0.03 * SR); return bp(rng.standard_normal(n), 1800, 7000) * env(n, 0.0005, 0.005) * 0.12


def sfx_pop(pitch=1.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = (520 + 520 * np.exp(-t / 0.018)) * pitch
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.002, 0.035) * 0.22


def sfx_swish(dur):
    n = int(dur * SR); x = rng.standard_normal(n)
    x = bp(x, 1200, 6500)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return x * e * 0.035


def sfx_whoosh(dur=0.9):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); blk = 512
    for i in range(0, n, blk):
        u = i / n; f = 300 + 4200 * np.sin(np.pi * u) ** 2
        out[i:i + blk] = lp(x[i:i + blk], f)                 # block-wise sweep (state reset is masked by the envelope)
    out = lp(out, 6000)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return out * e * 0.10


def sfx_riser(dur=1.15):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    f = 180 * (2 ** (u * 2.2))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    nz = hp(rng.standard_normal(n), 2000) * 0.5
    e = u ** 2.4
    return (tone + nz * 0.35) * e * 0.16


def sfx_hit():
    n = int(0.9 * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (55 + 45 * np.exp(-t / 0.03)) * t) * env(n, 0.002, 0.16)
    shimmer = hp(rng.standard_normal(n), 5000) * env(n, 0.001, 0.25) * 0.18
    return (thump * 0.55 + shimmer) * 0.5


def place(buf, clip, t, gain_db=0.0, pan=0.0):
    i = int(round(t * SR)); g = 10 ** (gain_db / 20)
    L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    j = min(len(buf), i + len(clip))
    if j > i >= 0: buf[i:j, 0] += clip[:j - i] * g * L * 1.414; buf[i:j, 1] += clip[:j - i] * g * R * 1.414


# ----------------------------------------------------------------------------------------------------------------------
# loudness (BS.1770-4) + true-peak limiter
# ----------------------------------------------------------------------------------------------------------------------
def kweight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    """BS.1770-4 integrated loudness of a (n, 2) array at SR (the K-weighting coefficients are the 48 kHz ones)."""
    y = kweight(x); blk = int(0.4 * SR); hop = int(0.1 * SR)
    if len(y) <= blk: return -99.0
    p = np.sum(y ** 2, axis=1)
    c = np.concatenate([[0.0], np.cumsum(p)])
    starts = np.arange(0, len(y) - blk, hop)
    ms = (c[starts + blk] - c[starts]) / blk
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[l > -70]
    if not len(g): return -99.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return float(-0.691 + 10 * np.log10(g2.mean()))


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return float(20 * np.log10(np.abs(up).max() + 1e-12))


def limiter(x, ceiling_db=None, look=0.005, release=0.12):
    """Look-ahead peak limiter driven by the 4x-oversampled (true-peak) envelope: min-filter over +/- look-ahead, moving
    average over the look-ahead (smooth attack that is always <= the needed gain at the peak), then program release."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    ceiling_db = LOUDNESS['limiter_ceiling_dbtp'] if ceiling_db is None else ceiling_db
    c = 10 ** (ceiling_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(1)
    pk = np.pad(up, (0, (-len(up)) % 4)).reshape(-1, 4).max(1)[:len(x)]
    need = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    la = int(look * SR)
    g = uniform_filter1d(minimum_filter1d(need, size=2 * la + 1), size=la + 1)
    rc = 1 - np.exp(-1 / (release * SR))
    # one-pole release, instant attack: cur = min(v, cur + (v - cur) * rc), run as a loop over runs of the gain curve
    out = np.empty_like(g); cur = 1.0
    for i, v in enumerate(g):
        cur = v if v < cur else cur + (v - cur) * rc
        out[i] = cur
    return x * out[:, None]


def master(x, target=None, ceiling=None):
    """Gain to the target integrated loudness, then the limiter at the ceiling, four times (the limiter lowers the
    loudness a little each pass). Defaults: LOUDNESS integrated_lufs -14 and limiter_ceiling_dbtp -1.85."""
    target = LOUDNESS['integrated_lufs'] if target is None else target
    ceiling = LOUDNESS['limiter_ceiling_dbtp'] if ceiling is None else ceiling
    for _ in range(4):
        g = target - lufs(x); x = x * 10 ** (g / 20)
        x = limiter(x, ceiling)
    return x


def vo_activity(vo):
    """Sidechain key from the VO: 10 ms RMS above duck_key_dbfs, duck_lookahead_ms look-ahead, duck_attack_ms attack,
    duck_release_ms release -> 0..1."""
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(vo ** 2, np.ones(hop * 2) / (hop * 2), mode='same'))
    act = (20 * np.log10(rms + 1e-9) > LOUDNESS['duck_key_dbfs']).astype(float)
    la = int(LOUDNESS['duck_lookahead_ms'] / 1000 * SR)
    act = np.concatenate([act[la:], np.zeros(la)])                                  # look-ahead
    out = np.empty_like(act); cur = 0.0
    a, r = np.exp(-1 / (LOUDNESS['duck_attack_ms'] / 1000 * SR)), np.exp(-1 / (LOUDNESS['duck_release_ms'] / 1000 * SR))
    for i, v in enumerate(act):
        cur = v + (cur - v) * (a if v > cur else r); out[i] = cur
    return out


# ----------------------------------------------------------------------------------------------------------------------
# stems of a timeline
# ----------------------------------------------------------------------------------------------------------------------
_cache = {}


def load_track(path):
    """A music file as a float64 (n, 2) array at SR, decoded by ffmpeg (ff.py rules: never a temporary build)."""
    if path not in _cache:
        from ff import FFMPEG
        p = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', path, '-ar', str(SR), '-ac', '2', '-f', 'f32le', '-'],
                           capture_output=True, check=True)
        _cache[path] = np.frombuffer(p.stdout, np.float32).reshape(-1, 2).astype(np.float64)
    return _cache[path]


def vo_line(vo_dir, name):
    """One VO line, <vo_dir>/<name>.wav (render-brian.py: 48 kHz, 24-bit, mono), as a mono float64 array at SR."""
    import soundfile as sf
    f = os.path.join(vo_dir, f'{name}.wav')
    if not os.path.exists(f):
        raise FileNotFoundError(f'VO line {name}: {f} is missing; render it with npm run video -- vo')
    x, sr = sf.read(f)
    x = x if x.ndim == 1 else x.mean(1)
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    return x


def segments_of(mu, D):
    """The music block's [[t0, s0], ...] as contiguous (T0, S0, S1) splices ending at D."""
    segs = []
    for i, seg in enumerate(mu['segments']):
        t0, s0 = seg[0], seg[1]
        t1 = mu['segments'][i + 1][0] if i + 1 < len(mu['segments']) else D
        segs.append((t0, s0, s0 + (t1 - t0)))
    return segs


def music_bed(mu, D):
    """The music block re-cut to D seconds, with its fade in and its fade out to silence."""
    m = load_track(mu['track'])
    segs = segments_of(mu, D)
    xf = mu.get('xfade', 0.03)
    bed = edit(m, segs, D, xf=xf, pre=min(0.6 * xf, 0.05))
    fi = int(mu.get('fade_in', 0.3) * SR); bed[:fi] *= np.linspace(0, 1, fi)[:, None] ** 2
    a, b = mu.get('fade_out', [D - 1, D]); i0, i1 = int(a * SR), int(b * SR)
    bed[i0:i1] *= np.cos(np.linspace(0, np.pi / 2, i1 - i0))[:, None] ** 1.5; bed[i1:] = 0
    return bed, segs


def sfx_track(cues, N):
    """SFX from the timeline's cues; the motion system's set (click, hit_soft, tick_soft, type) at brand.py SFX levels."""
    reset_rng()
    s = np.zeros((N, 2)); P = place
    for t, kind in cues:
        if kind == 'click': P(s, sfx_click(0.8), t, SFX['click'], 0.15)
        elif kind == 'tick_soft': P(s, sfx_tick(), t, SFX['tick_soft'], 0.0)
        elif kind == 'hit_soft': P(s, sfx_hit(), t, SFX['hit_soft'])
        elif kind.startswith('type:'):
            _, n, cps = kind.split(':')
            for k in range(int(n)): P(s, sfx_tick(), t + k / float(cps), SFX['type'], 0.0)
        elif kind == 'click_toggle': P(s, sfx_click(1.3), t, -3, 0.2)
        elif kind == 'whoosh': P(s, sfx_whoosh(1.0), t, -5, 0.0)
        elif kind == 'hit': P(s, sfx_hit(), t, -7)
        elif kind == 'pop': P(s, sfx_pop(), t, -6)
        elif kind.startswith('riser:'): P(s, sfx_riser(float(kind.split(':')[1])), t, -9)
        else: raise ValueError(f'unknown SFX cue {kind!r} at {t} s')
    return s


def stems(tl):
    """The timeline's three stems at SR, each as long as the timeline: vo (mono), sfx and music (stereo), and the music
    splices used."""
    D = tl['duration']; N = int(round(D * SR))
    if tl.get('music'):
        music, segs = music_bed(tl['music'], D)
    else:
        music, segs = np.zeros((N, 2)), []
    vo = np.zeros(N)
    for name, t in tl.get('vo', []):
        x = vo_line(tl['vo_dir'], name); i = int(round(t * SR)); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
    return dict(vo=vo, sfx=sfx_track(tl.get('sfx', []), N), music=music[:N], segments=segs)
