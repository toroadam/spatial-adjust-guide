"""The Spatial Adjust music bed: an original instrumental composed and synthesised by this script, with no samples,
loops or third-party recordings in it, so it needs no licence from anyone (gate G5, video/brand/music.json).

  python3 video/edit/audio/music_bed.py [--version v1] [--out <wav>]     -> <media root>/music/sa-bed-<version>.wav

Prints one JSON line: the file, its SHA-256, duration and the sections video/edit/build.py cuts on. The file is media and
lives under the media root, never in git; music.json records its SHA-256, and mix.py refuses any other file.

The piece: 100 BPM in 4/4 (a bar is 2.4 s), D major, bright and calm, made to sit 3 dB under the voice.
  bars 0-1    intro        pad and arpeggio, no drums (under the lockup)
  bars 2-9    groove A     D A Bm G D A Bm G: kick, clap, hats, bass, pad, arpeggio
  bars 10-17  groove B     G D A Bm G D Asus4 A: adds a bell line and a shaker; ends on A, so it loops back into bar 2
  bars 18-19  cadence      G A, the drums thin out
  bar 20      final chord  D, ringing out for 8 s (under the end card)
Sections (seconds): intro 0-4.8, loop 4.8-43.2 (16 bars, repeatable), outro 43.2-56.0 (needs at least 6.8 s: the
cadence and 2 s of ring), final 48.0 (the last chord, which build.py lands on the end card).

Instruments are drawn from first principles with numpy and scipy: band-limited (polyBLEP) sawtooth pads, a plucked
sine arpeggio with a ping-pong delay, a sine bass, a pitched-sine kick, a noise clap and hats, an additive bell, and a
reverb convolved with a synthetic decaying-noise impulse. A fixed seed makes every run of one version identical on one
machine; the SHA-256 in music.json is the identity of the rendered file, not of the recipe.
"""
import argparse
import hashlib
import json
import os
import sys

import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

SR = 48000
BPM = 100.0
BEAT = 60.0 / BPM            # 0.6 s
BAR = 4 * BEAT               # 2.4 s
BARS = 21                    # bars 0-20; bar 20 is the final chord
RING = 8.0                   # seconds the final chord rings
DURATION = 20 * BAR + RING   # 56.0 s
SECTIONS = dict(intro=[0.0, round(2 * BAR, 6)], loop=[round(2 * BAR, 6), round(18 * BAR, 6)], outro=[round(18 * BAR, 6), DURATION],
                outro_min=round(2 * BAR + 2.0, 6), final=round(20 * BAR, 6))     # final: the outro's last chord
VERSION = 'v1'
SEED = 1083

# chord name -> (pad voicing as MIDI notes, bass root)
CHORDS = {
    'D': ([50, 57, 62, 66, 69], 38), 'Dadd9': ([50, 57, 62, 64, 66], 38), 'A': ([49, 57, 61, 64, 69], 45),
    'Asus4': ([50, 57, 62, 64, 69], 45), 'Bm': ([50, 59, 62, 66, 71], 47), 'G': ([50, 59, 62, 67, 71], 43),
    'Gmaj7': ([50, 59, 62, 66, 67], 43),
}
PROGRESSION = (['Dadd9', 'Gmaj7'] +                                    # intro
               ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G'] +            # groove A
               ['G', 'D', 'A', 'Bm', 'G', 'D', 'Asus4', 'A'] +         # groove B
               ['G', 'A'] +                                            # cadence
               ['D'])                                                  # final chord


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x, axis=0)


def saw(f, n, phase=0.0):
    """Band-limited sawtooth (polyBLEP), -1..1."""
    dt = f / SR
    t = (phase + np.arange(n) * dt) % 1.0
    y = 2 * t - 1
    a = t < dt
    u = t[a] / dt; y[a] -= u + u - u * u - 1
    b = t > 1 - dt
    u = (t[b] - 1) / dt; y[b] -= u * u + u + u + 1
    return y


def adsr(n, a, d, s, r, hold):
    """Envelope of n samples: attack a, decay d to sustain s, held to `hold` seconds, then release r."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t >= hold
    level = np.interp(hold, t, e) if n else 0
    e[rel] = level * np.exp(-(t[rel] - hold) / max(r, 1e-4))
    return e


def add(buf, x, t, gain=1.0, pan=0.0):
    """Mix mono x (or stereo (n, 2)) into buf at t seconds, equal-power pan -1..1."""
    i = int(round(t * SR))
    if i >= len(buf): return
    x = x[:len(buf) - i]
    if x.ndim == 1:
        L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        buf[i:i + len(x), 0] += x * gain * L * 1.414
        buf[i:i + len(x), 1] += x * gain * R * 1.414
    else:
        buf[i:i + len(x)] += x * gain


def reverb_ir(rt60, seed, length=None):
    rng = np.random.default_rng(seed)
    n = int((length or rt60 * 1.2) * SR)
    t = np.arange(n) / SR
    decay = np.exp(-6.91 * t / rt60)
    ir = rng.standard_normal((n, 2)) * decay[:, None]
    ir = lp(ir, 7000)
    pre = int(0.022 * SR)
    ir = np.concatenate([np.zeros((pre, 2)), ir])
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


def reverb(x, ir, wet):
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet * 0.3) + y * wet


# ----------------------------------------------------------------------------------------------------------------------
# instruments
# ----------------------------------------------------------------------------------------------------------------------
def pad_chord(notes, dur, bright=1.0, release=0.9):
    n = int((dur + release * 4) * SR)
    out = np.zeros((n, 2))
    det = ((-7, 0, 5), (-5, 0, 7))                      # cents per channel: L and R detune differently
    for k, m in enumerate(notes):
        for c in range(2):
            v = sum(saw(hz(m) * 2 ** (d / 1200), n, phase=(0.13 * k + 0.37 * j + 0.5 * c) % 1) for j, d in enumerate(det[c])) / 3
            out[:, c] += v * (0.9 if k else 1.0)
    out = lp(out, 900 + 900 * bright, 2)
    out = lp(out, 4500, 1)
    return out * adsr(n, 0.35, 1.2, 0.85, release, dur)[:, None] / len(notes)


def pluck(m, dur=0.6):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(4 * np.pi * f * t + 0.3) + 0.08 * np.sin(6 * np.pi * f * t + 1.1)
    e = np.minimum(1, t / 0.003) * np.exp(-t / 0.22)
    return lp(x * e, 5000)


def bell(m, dur=2.2):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1) + 0.45 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.6)
         + 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t / 0.35) + 0.12 * np.sin(2 * np.pi * f * 4.2 * t) * np.exp(-t / 0.18))
    return x * np.minimum(1, t / 0.002)


def bass_note(m, dur):
    n = int((dur + 0.2) * SR); t = np.arange(n) / SR; f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.25 * saw(f, n, 0.25)
    x = np.tanh(1.6 * lp(x, 420)) / np.tanh(1.6)
    return x * adsr(n, 0.006, 0.18, 0.7, 0.06, dur)


def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 48 + 92 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    return body


def clap(rng):
    n = int(0.35 * SR); t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 900, 5200)
    e = np.zeros(n)
    for k, off in enumerate((0.0, 0.011, 0.022)):
        e += (t >= off) * np.exp(-np.maximum(0, t - off) / 0.006) * (0.8 if k < 2 else 1.0)
    e += (t >= 0.022) * np.exp(-np.maximum(0, t - 0.022) / 0.11) * 0.45
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.25
    return nz * e * 0.6 + body


def hat(rng, open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7500, 2) * np.exp(-t / (0.09 if open_ else 0.022))


def shaker(rng):
    n = int(0.08 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 4000, 11000) * np.minimum(1, t / 0.015) * np.exp(-t / 0.03)


def swell(dur):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    rng = np.random.default_rng(SEED + 7)
    return hp(rng.standard_normal(n), 3000) * u ** 3 * 0.25


# ----------------------------------------------------------------------------------------------------------------------
def render(seed=SEED, stems=None):
    """The bed as a float (n, 2) array at SR. stems: a dict to receive each instrument bus before the sum (for balancing)."""
    rng = np.random.default_rng(seed)
    N = int(round(DURATION * SR)) + SR
    pad = np.zeros((N, 2)); arp = np.zeros((N, 2)); bas = np.zeros((N, 2)); drm = np.zeros((N, 2)); top = np.zeros((N, 2))
    duck = np.ones(N)
    kick_clip = kick()
    for b, name in enumerate(PROGRESSION):
        t0 = b * BAR
        notes, root = CHORDS[name]
        final = b == len(PROGRESSION) - 1
        intro, groove_b, cadence = b < 2, 10 <= b < 18, 18 <= b < 20
        # pad: the final chord holds and rings
        add(pad, pad_chord(notes, RING - 1.5 if final else BAR, bright=1.25 if groove_b or final else 1.0,
                           release=2.2 if final else 0.9), t0, gain=0.55 if intro else 0.7)
        # arpeggio: 8ths over the voicing and the octave, ping-ponged by the delay below
        if not final:
            arp_notes = notes[1:] + [notes[1] + 12, notes[2] + 12]
            pattern = (0, 2, 1, 3, 2, 4, 3, 5) if not groove_b else (5, 3, 4, 2, 3, 1, 2, 0)
            for k, p in enumerate(pattern):
                vel = (0.75 if k % 2 else 1.0) * (0.6 if intro else 1.0) * (0.85 + 0.15 * rng.random())
                add(arp, pluck(arp_notes[p % len(arp_notes)] + 12), t0 + k * BEAT / 2, gain=0.22 * vel, pan=-0.35 if k % 2 else 0.35)
        # bass
        if not intro:
            hits = ((0, 1.4), (1.5, 0.45), (2, 0.9), (3.5, 0.45)) if not final else ((0, RING - 2.0),)
            if cadence and b == 19: hits = ((0, 1.4), (2, 1.9))
            for beat, length in hits:
                add(bas, bass_note(root, length * BEAT if not final else length), t0 + beat * BEAT, gain=0.55)
        # drums
        if not intro:
            kicks = (0, 2) if not final else (0,)
            if groove_b and b % 2: kicks = (0, 2, 2.5)
            if b == 19: kicks = (0, 2)
            for beat in kicks:
                tk = t0 + beat * BEAT
                add(drm, kick_clip, tk, gain=0.9)
                i = int(tk * SR); m = min(N - i, int(0.5 * SR))
                duck[i:i + m] = np.minimum(duck[i:i + m], 1 - 0.38 * np.exp(-np.arange(m) / SR / 0.13))
            if not final:
                for beat in ((1, 3) if b != 19 else (1,)):
                    add(drm, clap(rng), t0 + beat * BEAT, gain=0.32)
                for k in range(8):
                    if b == 19 and k >= 6: break
                    swing = 0.012 if k % 2 else 0.0
                    add(drm, hat(rng, open_=(k == 7 and b % 4 == 3)), t0 + k * BEAT / 2 + swing,
                        gain=(0.09 if k % 2 else 0.05) * (0.8 + 0.4 * rng.random()), pan=0.25)
                if groove_b:
                    for k in range(16):
                        add(drm, shaker(rng), t0 + k * BEAT / 4 + (0.008 if k % 2 else 0), gain=0.05 * (1.2 if k % 4 == 2 else 0.7), pan=-0.3)
        # bell line in groove B and on the final chord
        if groove_b and b % 2 == 0:
            add(top, bell(notes[-1] + 12), t0, gain=0.12, pan=0.2)
            add(top, bell(notes[-2] + 12), t0 + 2 * BEAT, gain=0.09, pan=-0.2)
        if final:
            add(top, bell(notes[-1] + 12, 5.0), t0, gain=0.14)
    add(top, swell(BAR), 1 * BAR, gain=0.12)                                     # lift into the groove

    # ping-pong delay on the arpeggio (dotted 8th), then the reverb sends
    d = int(0.75 * BEAT * SR); fb = 0.32
    wet = np.zeros_like(arp)
    src = arp.copy()
    for k in range(1, 6):
        g = fb ** k
        side = 1 if k % 2 else 0
        wet[k * d:, side] += src[:N - k * d, 1 - side] * g + src[:N - k * d, side] * g * 0.2
    arp = arp + lp(wet, 4000) * 0.5
    pad *= duck[:, None]; bas *= duck[:, None]
    ir_long, ir_short = reverb_ir(2.4, seed + 1), reverb_ir(1.1, seed + 2)
    pad = reverb(pad, ir_long, 0.35)
    arp = reverb(arp, ir_long, 0.3)
    top = reverb(top, ir_long, 0.45)
    drm = drm + reverb(hp(drm, 300), ir_short, 0.18) * 0.5
    if stems is not None: stems.update(pad=pad, arp=arp, bass=bas, drums=drm, top=top)
    # bus balance (K-weighted, over the loop): pad -19, arpeggio -21, bass -21, drums -20, bell -26 LUFS
    mix = pad * 1.0 + arp * 0.8 + bas * 0.25 + drm * 0.42 + top * 1.2
    mix = hp(mix, 28)
    mix = mix[:int(round(DURATION * SR))]
    tail = int(1.5 * SR)
    mix[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail))[:, None] ** 2
    mix = np.tanh(mix * 1.2) / 1.2                                              # gentle glue on the sum
    return mix / (np.abs(mix).max() + 1e-9) * 10 ** (-3 / 20)                  # peak -3 dBFS; the mixer sets the level


def write(path, x):
    import soundfile as sf
    sf.write(path, x, SR, subtype='PCM_24')


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()


def main(argv=None):
    ap = argparse.ArgumentParser(description='Render the original Spatial Adjust music bed to the media root.')
    ap.add_argument('--version', default=VERSION)
    ap.add_argument('--out')
    a = ap.parse_args(argv)
    from media import MediaRootError, ensure_media_dir, require_media_path
    import media_root as MR
    try:
        out = a.out or os.path.join(ensure_media_dir(os.path.join(MR.media_root(), 'music'), 'music folder'), f'sa-bed-{a.version}.wav')
        out = require_media_path(out, 'music')
    except MediaRootError as err:
        sys.stderr.write(f'music_bed.py: {err}\n'); return 2
    os.makedirs(os.path.dirname(out), exist_ok=True)
    write(out, render())
    print(json.dumps(dict(file=out, sha256=sha256_of(out), duration=DURATION, bpm=BPM, bar=BAR, sections=SECTIONS, version=a.version, seed=SEED)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
