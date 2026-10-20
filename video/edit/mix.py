# Ported from iCentral MarCom double-clicks/tools/dc_mix.py (14 lines) and 06-edit/compositor/mux.py (15 lines) on 2026-10-20; changes listed in video/edit/NOTES.md
"""Mix and mux one built timeline: the music bed, the VO, the SFX and the -14 LUFS master (audio/mix_audio.py), then the
rendered picture and the mix into the episode's final file, then a loudness and format check of what was written.

  python3 video/edit/mix.py --timeline <timeline.json>              -> mix_wav, then final_out (picture from video_out)
  python3 video/edit/mix.py --timeline <timeline.json> --no-mux     -> mix_wav only (before the picture is rendered)
  python3 video/edit/mix.py --timeline <timeline.json> --stems      -> also the VO, SFX and music stems in edit/_audio/stems
  python3 video/edit/mix.py --check-music <file>                    -> exit 1 when the file is a refused iCentral asset
  npm run video -- mix --timeline <timeline.json>

Music is checked before any audio is read. Refused with "unlicensed iCentral preview track refused" (exit 1), whatever
the timeline or music.json says:
  - the iCentral preview track (v5_build.py:23 TRACK, a PremiumBeat preview whose licence was never bought), by its path,
    its file name or its SHA-256 (so a copy under another name is refused too), and the earlier iCentral preview by name,
  - any PremiumBeat preview download (named <n>_full_<title>_<n>_preview.<ext>, or a preview in a PremiumBeat folder),
  - any file inside the iCentral MarCom folder (no iCentral audio asset is reused).
A track bought from PremiumBeat with a licence is not refused for its library: save the licensed file (not the preview)
under the media root and record it in video/brand/music.json.
A timeline's music must also be the file its SHA-256 names (the one video/brand/music.json records); a final also needs
the licence reference.

Mux: H.264 picture copied, AAC-LC 256 kb/s, 48 kHz, stereo, cut to the timeline's duration, +faststart. The muxed file
is measured with ffmpeg's ebur128 filter: integrated loudness within -14 +/- 0.5 LUFS and true peak at or below -1 dBTP
(brand.py LOUDNESS), AAC 48 kHz stereo audio. The report goes to edit/_audio/<name>-mix-report.json.

Every output must resolve under the media root. Exit codes: 0 done and in spec; 1 a refused music file, a failed step or
a result out of spec; 2 usage or configuration.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, 'lib'))
sys.path.insert(0, os.path.join(HERE, 'audio'))
from brand import LOUDNESS  # noqa: E402  (standard library only)
from media import MediaRootError, require_media_path  # noqa: E402

MUSIC_JSON = os.path.join(REPO, 'video', 'brand', 'music.json')
MUSIC_GATE = 'G5'

# The iCentral MarCom folder: a read-only source for code, never for audio.
ICENTRAL_ROOT = os.path.join(os.path.expanduser('~'), 'Documents', 'iCentral_MarCom')
# v5_build.py:23 TRACK. iCentral 06-edit/music-licence.md: "PREVIEW ONLY. The licence is NOT yet purchased. Do not
# publish." Its SHA-256 is computed from the file at run time when the file is on this machine (a read, never a copy);
# the value below was read from it on 2026-10-20 (file modified 2026-10-06 13:40:50 local time) and covers machines
# without the iCentral folder.
ICENTRAL_PREVIEW = dict(
    path=os.path.join(ICENTRAL_ROOT, '06-edit', 'music', 'candidates-v3', '458_full_inside-the-game_0148_preview.mp3'),
    sha256='1ff0f4c425d611c0f9d73d2a5e9fd04de828c8afaad88e4be0f3f7511abdd0b9',
)
# File names of the iCentral music previews (the v3 track above, and build_audio.py:20's v1 "Product Launch" preview).
REFUSED_NAMES = ('458_full_inside-the-game_0148_preview.mp3', '240_full_product-launch_0196_preview.mp3')
REFUSED_SHA256 = {ICENTRAL_PREVIEW['sha256']: 'the iCentral preview track (v5_build.py:23 TRACK)'}
REFUSAL = 'unlicensed iCentral preview track refused'
# PremiumBeat's preview downloads: <id>_full_<title-slug>_<id>_preview.<ext>, watermarked and not licensed for publication.
PREVIEW_NAME = re.compile(r'^\d+_full_.+_\d+_preview\.[a-z0-9]+$', re.I)


class MusicError(ValueError):
    """A music file or music record that may not be used. refused: True for the iCentral preview rules (exit 1)."""

    def __init__(self, msg, refused=False):
        super().__init__(msg)
        self.refused = refused


def fail(msg, code=2):
    sys.stderr.write(f'mix.py: {msg}\n')
    sys.exit(code)


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


_runtime = {}


def refused_hashes():
    """REFUSED_SHA256 plus the iCentral TRACK's SHA-256 computed now, when the file is on this machine (read only)."""
    out = dict(REFUSED_SHA256)
    p = ICENTRAL_PREVIEW['path']
    if p not in _runtime:
        _runtime[p] = sha256_of(p) if os.path.isfile(p) else None
    if _runtime[p]:
        out.setdefault(_runtime[p], 'the iCentral preview track (v5_build.py:23 TRACK), hashed at run time')
    return out


def _inside(child, parent):
    c, p = os.path.normcase(child), os.path.normcase(parent)
    if sys.platform == 'darwin': c, p = c.lower(), p.lower()
    return c == p or c.startswith(p.rstrip(os.sep) + os.sep)


def music_refusal(path):
    """Why the file at path is refused as music (the iCentral preview rules), or None. Path checks come first, so a
    refused file is never read; content is then compared by SHA-256, so a copy under another name is refused too."""
    if not path:
        return None
    absolute = os.path.abspath(os.path.expanduser(path))
    real = os.path.realpath(absolute)
    for p in dict.fromkeys((absolute, real)):
        if os.path.normcase(p) == os.path.normcase(ICENTRAL_PREVIEW['path']):
            return 'it is the iCentral preview track (v5_build.py:23 TRACK), a PremiumBeat preview whose licence was never bought'
        name = os.path.basename(p)
        if name in REFUSED_NAMES:
            return f'its file name {name} is an iCentral music preview whose licence was never bought'
        if PREVIEW_NAME.match(name) or ('premiumbeat' in p.lower() and 'preview' in name.lower()):
            return f'{name} is a PremiumBeat preview download, watermarked and not licensed for publication'
        if _inside(p, ICENTRAL_ROOT):
            return 'it is inside the iCentral MarCom folder, and no iCentral audio asset may be reused'
    if os.path.isfile(real):
        digest = sha256_of(real)
        hashes = refused_hashes()
        if digest in hashes:
            return f'its SHA-256 matches {hashes[digest]}'
    return None


def load_music_json(path=None):
    """video/brand/music.json (or $SA_MUSIC_JSON, or path) as a dict; MusicError when it cannot be read."""
    path = path or os.environ.get('SA_MUSIC_JSON') or MUSIC_JSON
    try:
        with open(path, encoding='utf-8') as f:
            cfg = json.load(f)
    except (OSError, ValueError) as err:
        raise MusicError(f'cannot read the music record {path}: {err}')
    cfg['_source'] = path
    return cfg


def track_path(cfg):
    """The music file named by a music record: track.file, relative to the media root unless absolute."""
    import media_root as MR
    f = (cfg.get('track') or {}).get('file')
    if not f:
        raise MusicError(f'{cfg.get("_source", "music record")}: track.file is missing')
    f = os.path.expanduser(f)
    return f if os.path.isabs(f) else os.path.join(MR.media_root(), f)


def licence_problems(cfg):
    """What stops a music record from naming a licensed track: the gate, the file, its SHA-256 and the licence
    reference. An empty list means it names one."""
    src = cfg.get('_source', 'music record')
    out = []
    if cfg.get('approval') != MUSIC_GATE:
        out.append(f'{src}: "approval" must be "{MUSIC_GATE}" (the music licence gate in video/approvals.md)')
    tr = cfg.get('track') or {}
    for k in ('id', 'file', 'sha256'):
        if not isinstance(tr.get(k), str) or not tr[k].strip():
            out.append(f'{src}: track.{k} must be a non-empty string')
    if isinstance(tr.get('sha256'), str) and not re.fullmatch(r'[0-9a-f]{64}', tr['sha256']):
        out.append(f'{src}: track.sha256 must be 64 lower-case hex digits')
    lic = cfg.get('licence') or {}
    for k in ('type', 'reference'):
        if not isinstance(lic.get(k), str) or not lic[k].strip():
            out.append(f'{src}: licence.{k} must be a non-empty string (a track without a licence reference is not licensed)')
    return out


def check_music_file(path, sha256=None):
    """Refuse a music file: MusicError(refused=True) by the iCentral preview rules, MusicError when it is missing or is
    not the file sha256 names."""
    why = music_refusal(path)
    if why:
        raise MusicError(f'{REFUSAL}: {path}: {why}', refused=True)
    real = os.path.realpath(os.path.expanduser(path or ''))
    if not path or not os.path.isfile(real):
        raise MusicError(f'music file {path} does not exist')
    if sha256:
        got = sha256_of(real)
        if got != sha256:
            raise MusicError(f'refusing music {path}: its SHA-256 is {got}, but the music record names {sha256}; '
                             're-record the track in video/brand/music.json (a new version) or restore the recorded file')
    return path


def check_timeline_music(tl, final=None):
    """The checks mix.py runs on a timeline's music block before any audio is read. final: defaults to the timeline's mode."""
    mu = tl.get('music')
    if not mu:
        return None
    final = (tl.get('mode') == 'final') if final is None else final
    if not mu.get('track'):
        raise MusicError('the timeline\'s music block names no track')
    check_music_file(mu['track'], mu.get('sha256'))
    if not mu.get('sha256'):
        raise MusicError('the timeline\'s music block has no sha256: rebuild the timeline with video/edit/build.py')
    ref = mu.get('licenceRef') or (mu.get('licence') or {}).get('reference')    # licenceRef is what verify.py reads
    if final and not (isinstance(ref, str) and ref.strip()):
        raise MusicError('a final needs the music\'s licence reference (video/brand/music.json, gate G5); the timeline\'s '
                         'music block has none')
    return mu


# ----------------------------------------------------------------------------------------------------------------------
# mux and measure
# ----------------------------------------------------------------------------------------------------------------------
def mux(tl, wav, out):
    from ff import FFMPEG
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', tl['video_out'], '-i', wav, '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', str(LOUDNESS['sample_rate']), '-ac', '2',
                    '-t', f'{tl["duration"]:.3f}', '-movflags', '+faststart', out], check=True)
    return out


def measure(path):
    """Integrated loudness, true peak and the first audio stream's format of a file, by ffmpeg ebur128 and ffprobe."""
    from ff import FFMPEG, FFPROBE
    r = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-i', path, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'ebur128 failed on {path}: {r.stderr.strip()[-400:]}')
    summary = r.stderr[r.stderr.rfind('Summary:'):]
    i = re.search(r'Integrated loudness:\s*I:\s*(-?[\d.]+|-inf)\s*LUFS', summary, re.S)
    tp = re.search(r'True peak:\s*Peak:\s*(-?[\d.]+|-inf)\s*dBFS', summary, re.S)
    p = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels,channel_layout',
                        '-show_entries', 'format=duration', '-of', 'json', path], capture_output=True, text=True, check=True)
    info = json.loads(p.stdout)
    st = (info.get('streams') or [{}])[0]
    num = lambda m: float('-inf') if m is None or m.group(1) == '-inf' else float(m.group(1))
    return dict(integrated_lufs=num(i), true_peak_dbtp=num(tp), codec=st.get('codec_name'), sample_rate=int(st.get('sample_rate') or 0),
                channels=int(st.get('channels') or 0), duration=float(info.get('format', {}).get('duration') or 0))


def spec_problems(m, need_video=True):
    """Where a measurement misses the brand's delivery spec; [] when it meets it."""
    out = []
    target, tol = LOUDNESS['integrated_lufs'], LOUDNESS['tolerance_lu']
    if not abs(m['integrated_lufs'] - target) <= tol:
        out.append(f'integrated loudness {m["integrated_lufs"]} LUFS is outside {target} +/- {tol}')
    if not m['true_peak_dbtp'] <= LOUDNESS['true_peak_max_dbtp']:
        out.append(f'true peak {m["true_peak_dbtp"]} dBTP is above {LOUDNESS["true_peak_max_dbtp"]}')
    if need_video:
        if m['codec'] != 'aac': out.append(f'audio codec {m["codec"]} is not aac')
        if m['sample_rate'] != LOUDNESS['sample_rate']: out.append(f'audio sample rate {m["sample_rate"]} is not {LOUDNESS["sample_rate"]}')
        if m['channels'] != 2: out.append(f'audio has {m["channels"]} channels, not 2 (stereo)')
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description='Mix and mux a built timeline to -14 LUFS, AAC 48 kHz stereo.')
    ap.add_argument('--timeline')
    ap.add_argument('--no-mux', action='store_true', help='write the mix WAV only')
    ap.add_argument('--check-music', metavar='FILE', help='only check whether FILE may be used as music')
    ap.add_argument('--stems', action='store_true', help='also write the VO, SFX and music stems to edit/_audio/stems')
    a = ap.parse_args(argv)

    if a.check_music:
        why = music_refusal(a.check_music)
        if why: fail(f'{REFUSAL}: {a.check_music}: {why}', 1)
        print(f'{a.check_music}: not an iCentral asset or a refused preview (its licence is still music.json\'s business)')
        return 0
    if not a.timeline: fail('--timeline is required (or --check-music <file>)')
    try:
        with open(a.timeline) as f:
            tl = json.load(f)
    except (OSError, ValueError) as err:
        fail(f'cannot read timeline {a.timeline}: {err}')
    for k in ('name', 'duration', 'mix_wav', 'final_out', 'video_out'):
        if k not in tl: fail(f'timeline {a.timeline} has no "{k}": build it with video/edit/build.py')
    if tl.get('vo') and not tl.get('vo_dir'): fail(f'timeline {a.timeline} places VO but has no "vo_dir"')
    try:
        check_timeline_music(tl)
    except MusicError as err:
        fail(str(err), 1 if err.refused else 2)
    try:
        wav = require_media_path(tl['mix_wav'], 'mix')
        out = require_media_path(tl['final_out'], 'final')
        os.makedirs(os.path.dirname(wav), exist_ok=True); os.makedirs(os.path.dirname(out), exist_ok=True)
        wav, out = require_media_path(wav, 'mix'), require_media_path(out, 'final')
    except MediaRootError as err:
        fail(str(err))
    if not a.no_mux and not os.path.exists(tl['video_out']):
        fail(f'the picture {tl["video_out"]} is not rendered yet: run video/edit/render.py --timeline {a.timeline} first, '
             'or pass --no-mux for the mix only', 1)

    try:
        import mix_audio  # noqa: E402  (numpy, scipy, soundfile: the pipeline Python)
        import ff  # noqa: F401
    except (ImportError, RuntimeError) as err:
        fail(f'{err}: run with the pipeline Python ($SA_VIDEO_PYTHON, the venv at the media root; see video/README.md)', 1)
    rep = mix_audio.mix(dict(tl, mix_wav=wav), stems_dir=os.path.join(os.path.dirname(wav), 'stems') if a.stems else None)
    rep['mix_wav'] = wav
    print(f'mix: {wav}  {rep["lufs"]} LUFS, {rep["tp"]} dBTP (internal meter), music duck {rep["duck_db"]} dB under the VO')
    problems = []
    if a.no_mux:
        rep['measured'] = measure(wav)
        problems = spec_problems(rep['measured'], need_video=False)
    else:
        try:
            mux(tl, wav, out)
        except subprocess.CalledProcessError as err:
            fail(f'ffmpeg failed muxing {out}: {err}', 1)
        rep['final_out'] = out
        rep['measured'] = measure(out)
        problems = spec_problems(rep['measured'])
        print(f'mux: {out}')
    m = rep['measured']
    print(f'measured: {m["integrated_lufs"]} LUFS integrated, {m["true_peak_dbtp"]} dBTP true peak, {m["codec"]} '
          f'{m["sample_rate"]} Hz, {m["channels"]} ch')
    rep['problems'] = problems
    rep['segments'] = [list(s) for s in rep.get('segments', [])]
    with open(os.path.join(os.path.dirname(wav), f'{tl["name"]}-mix-report.json'), 'w') as f:
        json.dump(rep, f, indent=1)
    if problems:
        fail('out of spec: ' + '; '.join(problems), 1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
