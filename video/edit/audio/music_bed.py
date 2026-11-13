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

Version v2 (--version v2) is the calm bed asked for after the 2026-10-22 review ("music makes reviewers nervous"): 72 BPM in
4/4 (a bar is 3.333 s), D major again, and no rhythm section at all: no kick, clap, hats, shaker or arpeggio. Two bars to a
chord on a soft low-passed pad, a sine bass held for the whole bar, a few sparse soft plucks and a distant bell on the chord
changes, in a long reverb. Same layout as v1 (intro 2 bars, a 16-bar loop, a 2-bar cadence, the final chord ringing 8 s), so
build.py cuts it the same way. The record for it is video/brand/music-calm.json, used with SA_MUSIC_JSON; it asks the mixer
for a lower bed (track.mix: 8 dB under the voice, ducked 6 dB while Brian speaks; v1 is 3 and 9).

Version v3 (--version v3) is the corporate bed asked for after the take-5 review ("the bed is jarring"): modern product-video
music in the keynote manner, upbeat but unhurried. 96 BPM in 4/4 (a bar is 2.5 s), G major, I-V-vi-IV (G D Em C), one chord
a bar, sixteen bars to the loop (four times round, a new marimba pattern each time) ending on C so it returns to G; the outro
opens on that same G, so a loop wrap and the loop-to-outro splice are both crossfades into the same chord. A warm
sine pad with air, felt-piano chords on beats 1 and 3, a soft marimba motif on eighths, a sine bass, and very light
percussion: a muted kick on 1 and 3, a tick on 2 and 4 and a quiet shaker, all low-passed. Two intro bars swell in (filtered air
under a Gadd9 and D) into the first full bar; the outro is G Am D, then G rings out 8 s with a soft bell. Same layout as v1 and
v2, so build.py cuts it the same way. The record is video/brand/music-v3.json (track.mix: 7 dB under the voice, ducked a further
6 dB while it speaks, so 12 dB or more under it; track.xfade 1.5 s so every splice is a slow crossfade).

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


# ----------------------------------------------------------------------------------------------------------------------
# v2: the calm bed
# ----------------------------------------------------------------------------------------------------------------------
CALM_BPM = 72.0
CALM_BEAT = 60.0 / CALM_BPM
CALM_BAR = 4 * CALM_BEAT                      # 3.3333 s
CALM_DURATION = 20 * CALM_BAR + RING
CALM_SECTIONS = dict(intro=[0.0, round(2 * CALM_BAR, 6)], loop=[round(2 * CALM_BAR, 6), round(18 * CALM_BAR, 6)],
                     outro=[round(18 * CALM_BAR, 6), round(CALM_DURATION, 6)], outro_min=round(2 * CALM_BAR + 2.0, 6),
                     final=round(20 * CALM_BAR, 6))
CALM_PROGRESSION = (['Dadd9', 'Gmaj7'] +
                    ['D', 'D', 'Bm', 'Bm', 'G', 'G', 'Asus4', 'A'] * 2 +      # the loop: 8 bars twice, ends on A so it returns to D
                    ['G', 'A'] + ['D'])


def soft_pluck(m, dur=1.6):
    """A felt-piano-like note: a sine with a soft attack and a slow decay, dark."""
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t + 0.4)
    e = np.minimum(1, t / 0.012) * np.exp(-t / 0.55)
    return lp(x * e, 2200)


def soft_bell(m, dur=3.5):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 1.4) + 0.2 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.7)
    return lp(x * np.minimum(1, t / 0.02), 4000)


def long_bass(m, dur):
    n = int((dur + 1.0) * SR); t = np.arange(n) / SR; f = hz(m)
    return np.sin(2 * np.pi * f * t) * adsr(n, 0.5, 0.6, 0.9, 0.8, dur)


def render_calm(seed=SEED, stems=None):
    """The calm bed as a float (n, 2) array at SR."""
    rng = np.random.default_rng(seed)
    N = int(round(CALM_DURATION * SR)) + SR
    pad = np.zeros((N, 2)); pl = np.zeros((N, 2)); bas = np.zeros((N, 2)); top = np.zeros((N, 2))
    for b, name in enumerate(CALM_PROGRESSION):
        t0 = b * CALM_BAR
        notes, root = CHORDS[name]
        final = b == len(CALM_PROGRESSION) - 1
        intro = b < 2
        change = b % 2 == 0 or final
        # the pad is re-struck each bar with a long overlap, so the chord breathes instead of pulsing
        add(pad, pad_chord(notes, RING - 1.5 if final else CALM_BAR + 0.8, bright=0.55, release=2.4 if final else 1.6), t0,
            gain=0.7 if intro else 0.8)
        if not intro and not final:
            add(bas, long_bass(root + 12, CALM_BAR * 0.95), t0, gain=0.3)
        # a few soft plucks, never on a grid a listener could tap along to: beat 0 and an off-beat late in the bar
        if not final:
            pick = notes[1:] + [notes[1] + 12]
            for off, k, vel in ((0.0, 2 + b % 2, 1.0), (2.5 + 0.25 * (b % 3), 1 + b % 3, 0.7)):
                if intro and off: continue
                add(pl, soft_pluck(pick[k % len(pick)] + 12), t0 + off * CALM_BEAT, gain=0.16 * vel * (0.9 + 0.1 * rng.random()),
                    pan=0.3 if k % 2 else -0.3)
        if change and not intro:
            add(top, soft_bell(notes[-1] + 12), t0 + 0.02, gain=0.07, pan=0.2)
        if final:
            add(top, soft_bell(notes[-1] + 12, 6.0), t0, gain=0.09)
    ir_long = reverb_ir(3.4, seed + 1)
    pad = reverb(pad, ir_long, 0.45)
    pl = reverb(pl, ir_long, 0.55)
    top = reverb(top, ir_long, 0.6)
    if stems is not None: stems.update(pad=pad, pluck=pl, bass=bas, top=top)
    mix = pad * 1.0 + pl * 0.8 + bas * 0.3 + top * 1.0
    mix = lp(hp(mix, 40), 6000, 1)
    mix = mix[:int(round(CALM_DURATION * SR))]
    tail = int(1.5 * SR)
    mix[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail))[:, None] ** 2
    return mix / (np.abs(mix).max() + 1e-9) * 10 ** (-3 / 20)



# ----------------------------------------------------------------------------------------------------------------------
# v3: the corporate bed (modern product-video music: warm, bright, unhurried)
# ----------------------------------------------------------------------------------------------------------------------
V3_BPM = 96.0
V3_BEAT = 60.0 / V3_BPM                       # 0.625 s
V3_BAR = 4 * V3_BEAT                          # 2.5 s
V3_DURATION = 21 * V3_BAR + RING              # 60.5 s
V3_SECTIONS = dict(intro=[0.0, round(2 * V3_BAR, 6)], loop=[round(2 * V3_BAR, 6), round(18 * V3_BAR, 6)],
                   outro=[round(18 * V3_BAR, 6), round(V3_DURATION, 6)], outro_min=round(3 * V3_BAR + 2.0, 6),
                   final=round(21 * V3_BAR, 6))
# G major: I V vi IV, one chord a bar. voicing (MIDI), bass root (an octave above the root's low note, so small speakers carry it)
V3_CHORDS = {
    'G':  ([55, 59, 62, 67, 71], 43), 'D':  ([57, 62, 66, 69, 74], 50), 'Em': ([55, 59, 64, 67, 71], 52),
    'C':  ([55, 60, 64, 67, 72], 48), 'Am': ([57, 60, 64, 67, 72], 45), 'Gadd9': ([55, 62, 66, 67, 74], 43),
}
V3_PROGRESSION = (['Gadd9', 'D'] +                                      # intro: the swell
                  ['G', 'D', 'Em', 'C'] * 4 +                           # the loop: four times round, ends on C so it returns to G
                  ['G', 'Am', 'D'] +                                    # the outro: the loop's first chord again (so a loop wrap and the
                                                                        # outro splice both crossfade into the same G), then ii V
                  ['G'])                                                # the resolve, ringing out
# the motif: eighth-note slots of a bar -> index into the chord's top four notes (+12), None = rest. Four variations, one a cycle.
V3_MOTIFS = (
    (3, None, 2, 3, None, 1, None, 2),
    (3, None, 1, 2, None, 3, 2, None),
    (2, 3, None, 1, 3, None, 2, 1),
    (3, None, 2, None, 1, 2, 3, None),
)


def felt(m, dur=2.4, vel=1.0):
    """A felt-piano note: sine partials with their own decays (the upper ones die first), a short soft hammer thump, dark."""
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1) + 0.30 * np.sin(2 * np.pi * 2 * f * t + 0.2) * np.exp(-t / 0.55)
         + 0.10 * np.sin(2 * np.pi * 3 * f * t + 0.9) * np.exp(-t / 0.28) + 0.03 * np.sin(2 * np.pi * 4.01 * f * t) * np.exp(-t / 0.12))
    thump = lp(np.random.default_rng(int(m) * 7).standard_normal(n), 900) * np.exp(-t / 0.012) * 0.05
    e = np.minimum(1, t / 0.007)
    return lp((x + thump) * e * vel, 3000)


def marimba(m, dur=0.9, vel=1.0):
    """A soft wooden mallet note: a sine and its 4th partial (a marimba's), a quick round decay."""
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.32) + 0.22 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05)
    return lp(x * np.minimum(1, t / 0.004) * vel, 3400)


def air_pad(notes, dur, release=1.2, bright=1.0):
    """A warm pad with some air: a few detuned sines per note (no saw: nothing to buzz), a slow chorus, then a gentle low-pass."""
    n = int((dur + release * 4) * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, m in enumerate(notes):
        f = hz(m)
        for c in range(2):
            for j, d in enumerate((-6, 0, 6) if c == 0 else (-4, 0, 7)):
                fd = f * 2 ** (d / 1200)
                lfo = 1 + 0.0009 * np.sin(2 * np.pi * (0.23 + 0.07 * j) * t + k + c)
                out[:, c] += (np.sin(2 * np.pi * fd * lfo * t + 0.4 * j + c) + 0.35 * np.sin(4 * np.pi * fd * t + 0.7 * j) * bright
                              + 0.10 * np.sin(6 * np.pi * fd * t + 1.3 * k) * bright) / 3
    out = lp(out, 2600 + 800 * bright, 2)
    return out * adsr(n, 0.5, 1.0, 0.9, release, dur)[:, None] / len(notes)


def soft_kick():
    n = int(0.34 * SR); t = np.arange(n) / SR
    f = 52 + 70 * np.exp(-t / 0.03)
    return lp(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13), 140) * np.minimum(1, t / 0.004)


def soft_shaker(rng):
    n = int(0.07 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 4500, 8500) * np.minimum(1, t / 0.012) * np.exp(-t / 0.024)


def soft_tick(rng):
    n = int(0.04 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2500, 5200) * np.minimum(1, t / 0.002) * np.exp(-t / 0.011)


def render_v3(seed=SEED, stems=None):
    """The corporate bed as a float (n, 2) array at SR."""
    rng = np.random.default_rng(seed)
    N = int(round(V3_DURATION * SR)) + SR
    pad = np.zeros((N, 2)); keys = np.zeros((N, 2)); mar = np.zeros((N, 2)); bas = np.zeros((N, 2)); prc = np.zeros((N, 2)); top = np.zeros((N, 2))
    for b, name in enumerate(V3_PROGRESSION):
        t0 = b * V3_BAR
        notes, root = V3_CHORDS[name]
        final = b == len(V3_PROGRESSION) - 1
        intro, loop = b < 2, 2 <= b < 19
        cyc = (b - 2) // 4 if loop else 0
        cadence = b in (19, 20)
        add(pad, air_pad(notes, RING - 1.5 if final else V3_BAR + 0.6, release=2.6 if final else 1.3, bright=1.0 + 0.15 * (cyc >= 2)), t0,
            gain=0.65 if intro else 0.75)
        if not intro and not final:
            add(bas, long_bass(root, V3_BAR * 0.96), t0, gain=0.34)
        # felt piano: the chord's top notes on beats 1 and 3 (a soft open chord), the resolve rings
        if not intro and not final:
            for beat, g in ((0, 1.0), (2, 0.7)):
                for k, m in enumerate(notes[1:4]):
                    add(keys, felt(m + 12, 2.0, 0.55 + 0.05 * k), t0 + beat * V3_BEAT + 0.006 * k, gain=0.09 * g, pan=(-0.2, 0.0, 0.2)[k])
        if final:
            for k, m in enumerate(notes[1:5]):
                add(keys, felt(m + 12, 6.0, 0.6), t0 + 0.012 * k, gain=0.1, pan=(-0.25, -0.08, 0.08, 0.25)[k])
            add(top, soft_bell(notes[-1] + 12, 6.5), t0 + 0.02, gain=0.09)
        # marimba motif on eighths: the top four notes of the chord, a different pattern each cycle round the four chords
        if (loop or cadence) and not final:
            pat = V3_MOTIFS[cyc % 4] if loop else V3_MOTIFS[1]
            top4 = [m + 12 for m in notes[1:5]]
            for k, idx in enumerate(pat):
                if idx is None: continue
                if b < 6 and k in (5, 7): continue             # first time round: sparser
                vel = (1.0 if k % 4 == 0 else 0.72) * (0.92 + 0.08 * rng.random())
                add(mar, marimba(top4[idx] + (12 if idx == 3 and k % 2 == 0 else 0), 0.9, vel), t0 + k * V3_BEAT / 2, gain=0.13 * vel,
                    pan=0.35 if k % 2 else -0.35)
        # light, low percussion: a muted kick on 1 and 3, a tick on 2 and 4, a shaker on the eighths; thinning into the cadence
        if loop or cadence:
            for beat in (0, 2):
                add(prc, soft_kick(), t0 + beat * V3_BEAT, gain=0.42 if not cadence else 0.3)
            for beat in (1, 3):
                add(prc, soft_tick(rng), t0 + beat * V3_BEAT, gain=0.07, pan=0.2)
            for k in range(8):
                if cadence and b == 20 and k >= 4: break
                add(prc, soft_shaker(rng), t0 + k * V3_BEAT / 2, gain=(0.05 if k % 2 else 0.032) * (0.85 + 0.3 * rng.random()), pan=-0.3)
    # the intro swell: filtered air rising across the two intro bars, into the first full bar
    n = int(2 * V3_BAR * SR); u = np.linspace(0, 1, n)
    sw = lp(np.random.default_rng(seed + 9).standard_normal((n, 2)), 3800)
    sw = hp(sw, 600) * (u ** 2.2)[:, None] * 0.06
    top[:n] += sw
    ir = reverb_ir(2.6, seed + 1)
    pad = reverb(pad, ir, 0.3)
    keys = reverb(keys, ir, 0.38)
    mar = reverb(mar, reverb_ir(1.2, seed + 3), 0.22)
    top = reverb(top, ir, 0.4)
    if stems is not None: stems.update(pad=pad, keys=keys, marimba=mar, bass=bas, perc=prc, top=top)
    mix = pad * 1.0 + keys * 1.0 + mar * 0.9 + bas * 0.5 + prc * 0.75 + top * 1.0
    mix = hp(mix, 34)
    mix = lp(mix, 7500, 2)
    mix = mix[:int(round(V3_DURATION * SR))]
    tail = int(2.0 * SR)
    mix[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail))[:, None] ** 2
    mix = np.tanh(mix * 1.1) / 1.1                                               # soft saturation, never a hard clip
    return mix / (np.abs(mix).max() + 1e-9) * 10 ** (-3 / 20)


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
    if a.version == 'v3':
        write(out, render_v3())
        print(json.dumps(dict(file=out, sha256=sha256_of(out), duration=round(V3_DURATION, 6), bpm=V3_BPM, bar=round(V3_BAR, 6),
                              sections=V3_SECTIONS, version=a.version, seed=SEED)))
        return 0
    if a.version == 'v2':
        write(out, render_calm())
        print(json.dumps(dict(file=out, sha256=sha256_of(out), duration=round(CALM_DURATION, 6), bpm=CALM_BPM, bar=round(CALM_BAR, 6),
                              sections=CALM_SECTIONS, version=a.version, seed=SEED)))
        return 0
    write(out, render())
    print(json.dumps(dict(file=out, sha256=sha256_of(out), duration=DURATION, bpm=BPM, bar=BAR, sections=SECTIONS, version=a.version, seed=SEED)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
