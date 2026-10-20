"""A synthetic episode and take for the builder tests: everything build.py, render.py and mix.py read, made without
IntelliDash, ElevenLabs or the network.

  python3 video/edit/tests/make_synthetic_take.py [--force]     (with SA_MEDIA_ROOT set, as the tests set it)

Under the media root ($SA_MEDIA_ROOT; the tests point it at <media root>/_tests/build) it writes:

  episodes/synthetic-take/episode.json              an episode the schema accepts at status script-locked: an intro beat
                                                    with a VO line before the first chapter, then two chapters, each
                                                    beat starting with a cue for its VO line and drawing a focus box
  episodes/synthetic-take/capture/raw/take1.mp4     3840x2160, 60 fps, 13.5 s: ffmpeg testsrc2 as the "app", the blue
                                                    focus boxes drawn in, a magenta sync flash at 0.10 s and an end
                                                    flash at 12.25 s, as the capture director records them
  .../take1-log.json, take1-track.json              the cue log ([{id, t}], seconds from the start flash) and the
                                                    cursor track (rows [t, x, y, a, ripple, focusBox] in take seconds,
                                                    clicks in cue-log seconds), in the director's formats
  episodes/synthetic-take/vo/<line>.wav             speech-like VO (a pulse train through moving formants, in syllables
  .../vo/render-report.json                         and words) at render-brian.py's level, 48 kHz 24-bit mono, and
                                                    the report in its format
  music/sa-bed-test.wav, music/music.synthetic.json the original music bed (audio/music_bed.py) and a music record for
                                                    it, with its SHA-256 and a test licence reference

make() returns the paths and the expected numbers (flash, cue times, VO lengths). Files are reused while they match;
--force (or make(force=True)) writes them again.
"""
import hashlib
import json
import math
import os
import subprocess
import sys

TESTS = os.path.dirname(os.path.abspath(__file__))
EDIT = os.path.dirname(TESTS)
sys.path.insert(0, os.path.join(EDIT, 'lib'))
sys.path.insert(0, os.path.join(EDIT, 'audio'))
sys.path.insert(0, os.path.join(os.path.dirname(EDIT), 'lib'))
import media_root as MR  # noqa: E402

EPISODE_ID = 'synthetic-take'
TAKE = 1
FPS, W, H = 60, 3840, 2160
FLASH = 0.10                 # start flash, take seconds (frame 6)
FLASH_LEN = 0.25
LEAD = 0.75                  # the director's LEAD_S: beats start this long after the start flash
UNHOVER, TAIL = 0.2, 1.0     # the director's tail: unhover pause, end flash, a second of still frames

# beats: (id, chapter, label, vo line, hold, focus box CSS px or None, cursor target CSS px)
BEATS = (
    ('intro', None, 'Synthetic take', 'vo-intro', 2.6, None, (1300, 700)),
    ('map', 'one', 'Read the map', 'vo-one', 4.2, (480, 360, 840, 520), (640, 440)),
    ('counts', 'two', 'Check the counts', 'vo-two', 4.4, (1160, 680, 1560, 860), (1340, 760)),
)
VO = (
    ('vo-intro', 'A synthetic take, made for the builder tests.', 2.2, 'dashboard-overview/1/1'),
    ('vo-one', 'The first chapter starts on its own cue.', 3.0, 'dashboard-overview/1/2'),
    ('vo-two', 'The second chapter ends before the end flash.', 3.2, 'dashboard-overview/1/3'),
)
CHAPTERS = (('one', 'Read the map'), ('two', 'Check the counts'))
RMS_TARGET_DBFS = -19.3451   # video/vo/voice-settings.md rms_target_dbfs (render-brian.py's level)


def cue_times():
    """{cue id: seconds from the start flash}: every beat starts with the cue for its VO line."""
    t, out = LEAD, {}
    for bid, _, _, vo, hold, _, _ in BEATS:
        out[vo] = round(t, 3); t += hold
    return out


def end_flash():
    return round(FLASH + LEAD + sum(b[4] for b in BEATS) + UNHOVER, 3)


def duration():
    return round(end_flash() + FLASH_LEN + TAIL, 3)


def episode():
    return dict(
        id=EPISODE_ID, title='Synthetic take', guide='dashboard-overview', status='script-locked', durationTarget=[20, 40],
        source='demo', mapPolicy='restyle', allowClicks=[], demoWriteClicks=[], claims=[v[3] for v in VO],
        chapters=[dict(id=c, label=l) for c, l in CHAPTERS],
        vo=[dict(id=i, text=txt, claims=[cl]) for i, txt, _, cl in VO],
        beats=[dict(id=bid, **({'chapter': ch} if ch else {}), label=label, vo=vo, hold=hold,
                    actions=[dict(type='cue', id=vo)] + ([dict(type='focus', target=f'role=region[name="{label}"]', name=label)] if box else [])
                    + [dict(type='wait', ms=500)])
               for bid, ch, label, vo, hold, box, _ in BEATS],
    )


def track():
    """Cursor rows for every frame: the cursor glides to each beat's target over 0.75 s after its cue; a beat's focus
    box shows from 0.8 s after its cue to the end of the beat."""
    cues = cue_times()
    spans, t = [], LEAD
    for bid, _, _, vo, hold, box, target in BEATS:
        spans.append((FLASH + t, FLASH + t + hold, box, target)); t += hold
    frames, x, y = [], 1500.0, 800.0
    n = int(round(duration() * FPS))
    for i in range(n):
        tt = i / FPS
        box, tx, ty, since = None, x, y, None
        for a, b, bx, tgt in spans:
            if a <= tt < b:
                tx, ty = tgt; since = tt - a
                if bx and tt >= a + 0.8: box = list(bx)
        if since is not None:
            u = min(1.0, since / 0.75); e = u * u * (3 - 2 * u)
            x, y = x + (tx - x) * e * 0.2, y + (ty - y) * e * 0.2
        frames.append([round(tt, 4), round(x, 2), round(y, 2), 1, 0, box])
    return dict(file=f'take{TAKE}.mp4', fps=FPS, units='CSS px (1920x1080); frame = [t, x, y, a, ripple, focusBox [x0, y0, x1, y1] | null]',
                frames=frames, clicks=[]), cues


def _video(path):
    from ff import FFMPEG
    ef = end_flash()
    boxes = []
    t = LEAD
    for bid, _, _, vo, hold, box, _ in BEATS:
        if box:
            x0, y0, x1, y1 = (v * 2 for v in box)
            boxes.append(f"drawbox=x={x0}:y={y0}:w={x1 - x0}:h={y1 - y0}:color=0x3079F0@1:t=10:enable='between(t,{FLASH + t + 0.8:.3f},{FLASH + t + hold:.3f})'")
        t += hold
    flash = (f"drawbox=x=0:y=0:w=iw:h=ih:color=0xFF00FF@1:t=fill:"
             f"enable='between(t,{FLASH:.3f},{FLASH + FLASH_LEN - 0.001:.3f})+between(t,{ef:.3f},{ef + FLASH_LEN - 0.001:.3f})'")
    vf = ','.join(boxes + [flash, 'format=rgb24', 'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p'])
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'testsrc2=size={W}x{H}:rate={FPS}:duration={duration()}',
                    '-vf', vf, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast', '-crf', '23', '-colorspace', 'bt709',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', path], check=True)


def speech(seconds, seed):
    """Speech-like mono audio: syllables of a jittered pulse train through three moving formants, with word gaps and
    the odd fricative, levelled to RMS_TARGET_DBFS over its voiced part."""
    import numpy as np
    from scipy import signal
    sr = 48000
    rng = np.random.default_rng(seed)
    n = int(round(seconds * sr)); t = np.arange(n) / sr
    f0 = 112 * (1 + 0.06 * np.sin(2 * np.pi * 0.7 * t + seed) - 0.08 * t / seconds) * (1 + 0.004 * rng.standard_normal(n).cumsum() / np.sqrt(n))
    ph = np.cumsum(f0) / sr
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    src = signal.lfilter([1], [1, -0.97], pulses)                       # glottal tilt
    vowels = ((730, 1090, 2440), (270, 2290, 3010), (530, 1840, 2480), (570, 840, 2410), (440, 1020, 2240), (660, 1720, 2410))
    env = np.zeros(n); voiced = np.zeros(n)
    k, pos = 0, 0.08
    while pos < seconds - 0.12:
        syl = rng.uniform(0.14, 0.24)
        a, b = int(pos * sr), int(min(seconds - 0.05, pos + syl) * sr)
        e = np.sin(np.linspace(0, np.pi, b - a)) ** 0.7
        env[a:b] = np.maximum(env[a:b], e)
        F1, F2, F3 = vowels[k % len(vowels)]
        seg = sum(signal.lfilter(*signal.iirpeak(f / (sr / 2), 8), src[a:b]) * g for f, g in ((F1, 1.0), (F2, 0.5), (F3, 0.25)))
        voiced[a:b] += seg * e
        if rng.random() < 0.25:                                         # a fricative at the syllable's end
            m = int(0.06 * sr); c = min(b, n - m)
            voiced[c:c + m] += signal.lfilter(*signal.butter(2, [3500 / (sr / 2), 7500 / (sr / 2)], 'band'), rng.standard_normal(m)) * 0.15 * np.hanning(m)
        k += 1; pos += syl + (rng.uniform(0.08, 0.16) if rng.random() < 0.3 else 0.02)
    act = env > 0.1
    rms = np.sqrt((voiced[act] ** 2).mean()) if act.any() else 1.0
    y = voiced / rms * 10 ** (RMS_TARGET_DBFS / 20)
    fade = int(0.01 * sr); y[:fade] *= np.linspace(0, 1, fade); y[-fade:] *= np.linspace(1, 0, fade)
    return np.clip(y, -0.98, 0.98)


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()


def _write_json(path, data, force):
    cur = None
    if os.path.exists(path) and not force:
        try:
            with open(path) as f: cur = json.load(f)
        except ValueError:
            cur = None
    if cur != data:
        with open(path, 'w') as f: json.dump(data, f, indent=1)


def make(force=False):
    import soundfile as sf
    root = MR.media_root()
    ep_dir = MR.episode_dir(EPISODE_ID)
    raw = MR.episode_dir(EPISODE_ID, 'capture', 'raw')
    vo_dir = MR.episode_dir(EPISODE_ID, 'vo')
    music_dir = MR.subdir('music')
    ep_path = os.path.join(ep_dir, 'episode.json')
    _write_json(ep_path, episode(), force)
    mp4 = os.path.join(raw, f'take{TAKE}.mp4')
    stamp = os.path.join(raw, f'take{TAKE}.recipe.json')
    recipe = dict(beats=[list(map(lambda v: list(v) if isinstance(v, tuple) else v, b)) for b in BEATS], flash=FLASH, w=W, h=H, duration=duration())
    old = None
    if os.path.exists(stamp):
        with open(stamp) as f: old = json.load(f)
    if force or not os.path.exists(mp4) or old != recipe:
        _video(mp4)
        with open(stamp, 'w') as f: json.dump(recipe, f)
    trk, cues = track()
    _write_json(os.path.join(raw, f'take{TAKE}-track.json'), trk, force)
    _write_json(os.path.join(raw, f'take{TAKE}-log.json'), [dict(id=k, t=v) for k, v in cues.items()], force)
    lines = []
    for i, (lid, text, secs, _) in enumerate(VO):
        wav = os.path.join(vo_dir, f'{lid}.wav')
        if force or not os.path.exists(wav) or abs(sf.info(wav).duration - secs) > 1e-3:
            sf.write(wav, speech(secs, 100 + i), 48000, subtype='PCM_24')
        lines.append(dict(line=lid, text=text, seconds=secs, characters=len(text), text_hash=hashlib.sha256(text.encode()).hexdigest()[:16]))
    _write_json(os.path.join(vo_dir, 'render-report.json'), dict(episode=EPISODE_ID, lines=lines), force)
    bed = os.path.join(music_dir, 'sa-bed-test.wav')
    if force or not os.path.exists(bed):
        import music_bed
        music_bed.write(bed, music_bed.render())
    import music_bed as MB
    record = dict(approval='G5', track=dict(id='sa-bed-test', title='Spatial Adjust bed (test render)', file='music/sa-bed-test.wav',
                                            sha256=sha256_of(bed), duration=MB.DURATION, bpm=MB.BPM, bar=MB.BAR, sections=MB.SECTIONS),
                  licence=dict(type='original', reference='test fixture: rendered by video/edit/audio/music_bed.py for the builder tests'))
    music_json = os.path.join(music_dir, 'music.synthetic.json')
    _write_json(music_json, record, force)
    return dict(root=root, episode=ep_path, mp4=mp4, raw=raw, vo_dir=vo_dir, music=bed, music_json=music_json, flash=FLASH, cues=cues,
                end_flash=end_flash(), vo={v[0]: v[2] for v in VO}, duration=duration())


if __name__ == '__main__':
    print(json.dumps(make('--force' in sys.argv[1:]), indent=1))
