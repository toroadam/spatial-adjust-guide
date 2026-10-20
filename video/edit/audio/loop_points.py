# beat_grid ported from iCentral MarCom 06-edit/compositor/audio/build_audio.py (lines 31-46) on 2026-10-20; changes listed in video/edit/NOTES.md
"""Beat-aligned loop points of a music track: its beat grid by onset flux, its downbeat, and whether the sections a
music record names (intro, loop, outro, final) start on bar lines, so every splice build.py makes lands on a downbeat.

  python3 video/edit/audio/loop_points.py                        the track video/brand/music.json names ($SA_MUSIC_JSON)
  python3 video/edit/audio/loop_points.py --file <f> --bpm 100   any track under the media root: proposes bar lines

Prints JSON: the tempo scores around the nominal BPM, the grid phase (the beat nearest 0 s), the downbeat estimate (0-3,
with its scores), the first downbeat and the bar lines from it, and for a record each section boundary with its distance
from the nearest measured beat and from loop_start in bars. Exit 1 when a boundary is more than --tol seconds (default
0.02) off the beat grid or not a whole number of bars from loop_start; 2 for usage or a refused file. The flux estimate
of the downbeat is reported, not enforced: it cannot tell beat 1 from beat 3 when the kick plays on both. Read only:
it never writes music.json (record the points there by hand, with this output in the commit message).

The file is checked by mix.py's rules (the iCentral preview track and PremiumBeat previews are refused, a recorded file
must match its SHA-256) before it is decoded. Needs numpy and ffmpeg (the pipeline Python).
"""
import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
EDIT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, EDIT)
sys.path.insert(0, os.path.join(EDIT, 'lib'))

SR = 48000
HOP, WIN = 480, 2048          # 10 ms hop, as the source


def onset_flux(mono):
    """Spectral flux of a mono signal at SR / HOP frames per second (log magnitude, positive differences summed)."""
    fr = np.lib.stride_tricks.sliding_window_view(np.pad(mono, (WIN // 2, WIN // 2)), WIN)[::HOP]
    S = np.log1p(100 * np.abs(np.fft.rfft(fr * np.hanning(WIN), axis=1)))
    return np.concatenate([[0], np.maximum(0, np.diff(S, axis=0)).sum(1)])


def beat_grid(m, bpm):
    """The source's beat_grid at a nominal bpm: scores for bpm +/- 0.2, the grid phase (s) at bpm, the downbeat (the beat,
    0-3, of the strongest bar position) and the per-position scores."""
    mono = m.mean(1) if m.ndim == 2 else m
    flux = onset_flux(mono)
    fps = SR / HOP
    res = {}
    for b in (bpm - 0.2, bpm - 0.1, bpm, bpm + 0.1, bpm + 0.2):
        P = 60 / b * fps
        n = np.arange(0, len(flux) / P - 1)
        best = max(((float(flux[(ph + n * P).astype(int)].sum()), ph) for ph in np.arange(0, P, 0.25)))
        res[round(b, 2)] = (best[0], float(best[1] / fps))
    P = 60 / bpm * fps
    ph = res[round(bpm, 2)][1] * fps
    beats = (ph + np.arange(0, len(flux) / P - 1) * P).astype(int)
    db = [float(flux[beats][k::4].sum()) for k in range(4)]
    phase, beat = res[round(bpm, 2)][1], 60.0 / bpm
    shift = 1 if phase >= beat / 2 else 0            # report the beat nearest 0 s (-0.0025 rather than 0.5975) ...
    db = db[-shift:] + db[:-shift] if shift else db  # ... and count the bar positions from it
    return dict(bpm_scores={str(k): round(v[0], 2) for k, v in res.items()}, phase_s=round(phase - shift * beat, 4),
                downbeat_phase=int(np.argmax(db)), downbeat_scores=[round(x, 2) for x in db])


def centred(x, period):
    """x folded into [-period / 2, period / 2)."""
    return float((x + period / 2) % period - period / 2)


def bar_lines(grid, bpm, duration):
    """The first downbeat by the flux estimate, and every bar line from it up to duration."""
    beat = 60.0 / bpm
    first = (grid['phase_s'] + grid['downbeat_phase'] * beat) % (4 * beat)
    if 4 * beat - first < 0.05: first -= 4 * beat                      # a few ms before 0 s is the bar at 0 s
    return round(float(first), 4), [round(float(t), 4) for t in np.arange(first, duration + 1e-9, 4 * beat)]


def check_sections(sec, grid, bpm, tol):
    """Each section boundary of a record: its distance from the nearest beat of the measured grid, and its distance in
    bars from the intro's end (a whole number when the record is on its own bar grid). Returns (boundaries, problems,
    downbeat): downbeat says whether the record's bar lines agree with the flux estimate of the downbeat, which is
    reported only, because flux cannot tell beat 1 from beat 3 when the kick plays on both."""
    beat, bar = 60.0 / bpm, 4 * 60.0 / bpm
    pts = {'intro_end': sec['intro'][1], 'loop_start': sec['loop'][0], 'loop_end': sec['loop'][1],
           'outro_start': sec['outro'][0]}
    if sec.get('final') is not None:
        pts['final'] = sec['final']
    out, bad = {}, []
    ref = pts['loop_start']
    for k, t in pts.items():
        off = round(centred(t - grid['phase_s'], beat), 4)
        bars = (t - ref) / bar
        out[k] = dict(t=t, beat_off=off, bars_from_loop_start=round(bars, 4))
        if abs(off) > tol:
            bad.append(f'{k} at {t} s is {off * 1000:+.0f} ms off the measured beat grid')
        if abs(bars - round(bars)) > tol / bar:
            bad.append(f'{k} at {t} s is not a whole number of bars from loop_start ({bars:.3f} bars)')
    est = (grid['phase_s'] + grid['downbeat_phase'] * beat)
    agrees = abs(centred(ref - est, bar)) <= tol
    sc = sorted(grid['downbeat_scores'], reverse=True)
    return out, bad, dict(agrees=agrees, clear=bool(sc[0] > 1.1 * sc[1]))


def main(argv=None):
    ap = argparse.ArgumentParser(description='Measure the beat grid of a music track and check its loop points.')
    ap.add_argument('--file', help='a music file (default: the track the music record names)')
    ap.add_argument('--bpm', type=float, help='nominal tempo (default: the record\'s track.bpm)')
    ap.add_argument('--music-json', help='the music record (default: video/brand/music.json or $SA_MUSIC_JSON)')
    ap.add_argument('--tol', type=float, default=0.02, help='largest allowed distance from a bar line, seconds')
    a = ap.parse_args(argv)
    import mix as MIX                                                     # noqa: E402  (the music rules)
    import build_audio as B                                               # noqa: E402

    cfg = None
    if not a.file or a.music_json:
        try:
            cfg = MIX.load_music_json(a.music_json)
        except MIX.MusicError as err:
            sys.stderr.write(f'loop_points.py: {err}\n'); return 2
    path = a.file or MIX.track_path(cfg)
    sha = None if a.file else (cfg.get('track') or {}).get('sha256')
    try:
        MIX.check_music_file(path, sha)
    except MIX.MusicError as err:
        sys.stderr.write(f'loop_points.py: {err}\n'); return 2
    bpm = a.bpm or ((cfg or {}).get('track') or {}).get('bpm')
    if not bpm:
        sys.stderr.write('loop_points.py: --bpm is required when the record has no track.bpm\n'); return 2
    m = B.load_track(path)
    dur = len(m) / SR
    grid = beat_grid(m, bpm)
    bar = 4 * 60.0 / bpm
    first, lines = bar_lines(grid, bpm, dur)
    rep = dict(file=path, duration=round(dur, 3), bpm=bpm, bar=round(bar, 6), **grid, first_downbeat=first,
               bar_lines=lines)
    bad = []
    if cfg and (cfg.get('track') or {}).get('sections') and not a.file:
        rep['sections'], bad, rep['downbeat'] = check_sections(cfg['track']['sections'], grid, bpm, a.tol)
    rep['problems'] = bad
    print(json.dumps(rep, indent=1))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
