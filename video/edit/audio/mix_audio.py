# Ported from iCentral MarCom 06-edit/compositor/audio/v2_audio.py (92 lines) on 2026-10-20; changes listed in video/edit/NOTES.md
"""The episode mix for one timeline: the stems from build_audio.stems (VO, SFX, the re-cut music bed), the music set
3 dB under the VO and ducked a further 9 dB while the VO speaks, summed and mastered to the brand loudness (-14 LUFS
integrated, limiter ceiling -1.85 dBTP; brand.py LOUDNESS, video/brand/motion-system.md section 9).

  from mix_audio import mix
  report = mix(timeline_dict)                 writes timeline['mix_wav'] (48 kHz, 24-bit, stereo) and returns the report
  report = mix(timeline_dict, stems_dir=d)    also writes the three stems (after levelling and ducking) into d

Call it through video/edit/mix.py, which checks the music file (path, SHA-256, licence) before any audio is read.
"""
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
import build_audio as B  # noqa: E402
from brand import LOUDNESS  # noqa: E402

SR = B.SR


def duck_depth(gain, vo):
    """Measured duck: the music gain's median over speech minus its median over silence, in dB (negative = ducked)."""
    act = B.vo_activity(vo)
    on, off = act > 0.99, act < 0.01
    if not on.any() or not off.any():
        return None
    g = 20 * np.log10(np.maximum(gain, 1e-9))
    return round(float(np.median(g[on]) - np.median(g[off])), 2)


def mix(tl, stems_dir=None):
    """Mix the timeline dict tl to tl['mix_wav']; returns dict(name, lufs, tp, duck_db, segments, vo_lines, sfx_cues)."""
    st = B.stems(tl)
    vo, s, bed = st['vo'], st['sfx'], st['music']
    has_vo, has_music = np.abs(vo).max() > 0, np.abs(bed).max() > 0
    duck = None
    if has_vo:
        vo2 = np.stack([vo, vo], 1)
        if has_music:
            bed = bed * 10 ** ((B.lufs(vo2) + LOUDNESS['music_under_vo_db'] - B.lufs(bed)) / 20)     # 3 dB under the VO
            gain = 10 ** (LOUDNESS['duck_db'] * B.vo_activity(vo) / 20)                              # 9 dB more while it speaks
            bed = bed * gain[:, None]
            duck = duck_depth(gain, vo)
        out = vo2 + bed + s
    else:
        out = bed + s * 0.8
    pre = B.lufs(out)
    out = B.master(out)
    out[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))[:, None]
    os.makedirs(os.path.dirname(tl['mix_wav']), exist_ok=True)
    sf.write(tl['mix_wav'], out, SR, subtype='PCM_24')
    if stems_dir:
        os.makedirs(stems_dir, exist_ok=True)
        g = 10 ** ((B.lufs(out) - pre) / 20)                       # the master's overall gain, so the stems sum to the mix
        for k, x in (('vo', np.stack([vo, vo], 1) if has_vo else None), ('sfx', s), ('music', bed)):
            if x is not None:
                sf.write(os.path.join(stems_dir, f'{tl["name"]}-{k}.wav'), x * g, SR, subtype='PCM_24')
    return dict(name=tl['name'], lufs=round(B.lufs(out), 2), tp=round(B.true_peak_db(out), 2), duck_db=duck,
                segments=[list(x) for x in st['segments']], vo_lines=len(tl.get('vo', [])), sfx_cues=len(tl.get('sfx', [])))
