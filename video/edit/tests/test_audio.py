"""Tests for the episode mix: video/edit/mix.py with audio/mix_audio.py and audio/build_audio.py.

  python3 video/edit/tests/test_audio.py

MusicRefusalTest (standard library only, runs in any Python) checks the iCentral music rules before any audio is read:
mix.py refuses the iCentral preview track by its path (--check-music and a timeline naming it, exit 1, no mix written),
by its file name, by any PremiumBeat preview download, by any file inside the iCentral folder, and by identical content;
a licensed file from the same library is not refused for its library. Content is simulated, never copied: a stand-in file's SHA-256 is patched into mix.REFUSED_SHA256 in-process, so the stand-in
counts as a renamed copy. When the iCentral preview is on this machine its SHA-256 (a read, never a copy) must be the
recorded one.

MixTest (the pipeline Python: numpy, scipy, soundfile; and ffmpeg) mixes a 14 s timeline built here: two sine-tone VO
lines (220 + 440 Hz at render-brian.py's level), a stationary synthetic bed (filtered noise under a sustained chord, so
its level is flat and the duck is measurable), three SFX cues and a testsrc2 H.264 picture. mix.py --stems must give a
muxed AAC file at -14 +/- 0.5 LUFS integrated and at or below -1 dBTP (ffmpeg ebur128), 48 kHz stereo; music ducked
9 +/- 1.5 dB under the VO, measured on the music stem and in the report; the VO starting where the timeline puts it; and
the picture copied unchanged (the video packets' MD5 is the same before and after the mux).

Media goes under <media root>/_tests/audio (SA_MEDIA_ROOT is pointed there for the test's own calls); nothing is written
to the repository or a temporary directory.
"""
import contextlib
import hashlib
import io
import json
import os
import subprocess
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402  (puts lib/ and video/lib on the path)

sys.path.insert(0, P.EDIT)
import media_root as MR  # noqa: E402
import mix  # noqa: E402  (standard library at import)

MIX = os.path.join(P.EDIT, 'mix.py')
EPISODE = 'audio-test'
D = 14.0
VO_LINES = (('tone-a', 2.0, 2.5), ('tone-b', 8.0, 2.5))     # (name, t, seconds)
SFX = [[1.0, 'hit_soft'], [3.0, 'click'], [9.0, 'click']]
RMS_TARGET_DBFS = -19.3451                                   # video/vo/voice-settings.md rms_target_dbfs


def test_root():
    """<media root>/_tests/audio, without nesting when SA_MEDIA_ROOT already points there (a delegated run)."""
    root = MR.media_root()
    tail = os.path.join('_tests', 'audio')
    return root if root.rstrip(os.sep).endswith(tail) else os.path.join(root, tail)


def run_mix(*args, env=None):
    return subprocess.run([sys.executable, MIX, *args], cwd=P.REPO, capture_output=True, text=True, env=env)


class _TestRoot:
    """Points SA_MEDIA_ROOT at <media root>/_tests/audio for the class and restores it afterwards."""

    @classmethod
    def setUpClass(cls):
        cls.root = test_root()
        os.makedirs(cls.root, exist_ok=True)
        cls._env = mock.patch.dict(os.environ, {'SA_MEDIA_ROOT': cls.root})
        cls._env.start()

    @classmethod
    def tearDownClass(cls):
        cls._env.stop()

    def path(self, *parts):
        p = os.path.join(self.root, *parts)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        return p


def timeline(root, music_track=None, sha256=None):
    """A timeline dict in build.py's shape (the keys mix.py reads), its files under root."""
    ep = os.path.join(root, 'episodes', EPISODE)
    tl = dict(name=EPISODE, mode='draft', duration=D, fps=60,
              video_out=os.path.join(ep, 'renders', f'{EPISODE}-picture.mp4'),
              final_out=os.path.join(ep, 'renders', f'{EPISODE}.mp4'),
              mix_wav=os.path.join(ep, 'edit', '_audio', f'{EPISODE}-mix.wav'),
              vo_dir=os.path.join(ep, 'vo'), vo=[[n, t] for n, t, _ in VO_LINES], sfx=SFX)
    if music_track:
        tl['music'] = dict(track=music_track, sha256=sha256, segments=[[0.0, 0.0]], fade_in=0.4, fade_out=[D - 0.6, D],
                           xfade=0.08, licence=dict(type='original', reference='test fixture'))
    return tl


def write_timeline(root, tl, name='timeline.json'):
    p = os.path.join(root, 'episodes', EPISODE, 'edit', name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        json.dump(tl, f, indent=1)
    return p


class MusicRefusalTest(_TestRoot, unittest.TestCase):
    def assertRefused(self, why):
        self.assertIsNotNone(why)

    def test_check_music_refuses_the_preview_by_path(self):
        r = run_mix('--check-music', mix.ICENTRAL_PREVIEW['path'])
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn(mix.REFUSAL, r.stderr)

    def test_timeline_naming_the_preview_is_refused_before_any_audio(self):
        tl = timeline(self.root, mix.ICENTRAL_PREVIEW['path'], mix.ICENTRAL_PREVIEW['sha256'])
        tl['mix_wav'] = tl['mix_wav'].replace('-mix.wav', '-refused-mix.wav')
        if os.path.exists(tl['mix_wav']): os.remove(tl['mix_wav'])
        r = run_mix('--timeline', write_timeline(self.root, tl, 'timeline-refused.json'), env=dict(os.environ))
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn(mix.REFUSAL, r.stderr)
        self.assertFalse(os.path.exists(tl['mix_wav']))

    def test_refused_by_name_premiumbeat_and_icentral_folder(self):
        # none of these files exists: the path rules refuse without reading anything
        for p in (self.path('music', mix.REFUSED_NAMES[0]), self.path('music', mix.REFUSED_NAMES[1]),
                  self.path('music', '123_full_some-other-track_0042_preview.mp3'),
                  self.path('music', 'PremiumBeat', 'track preview.wav'),
                  os.path.join(mix.ICENTRAL_ROOT, '06-edit', 'music', 'any-other-track.wav')):
            with self.subTest(path=p):
                self.assertRefused(mix.music_refusal(p))
                with self.assertRaises(mix.MusicError) as cm:
                    mix.check_music_file(p)
                self.assertTrue(cm.exception.refused)
                self.assertIn(mix.REFUSAL, str(cm.exception))

    def test_a_licensed_library_file_is_not_refused_for_its_library(self):
        # a track bought with a licence and saved under the media root passes the path rules (music.json then names it)
        self.assertIsNone(mix.music_refusal(self.path('music', 'PremiumBeat', 'inside-the-game-licensed.wav')))

    def test_refused_by_identical_content(self):
        stand_in = self.path('music', 'renamed-bed.wav')
        with open(stand_in, 'wb') as f:
            f.write(hashlib.sha256(b'stand-in for a renamed copy of the iCentral preview').digest() * 64)
        digest = mix.sha256_of(stand_in)
        self.assertIsNone(mix.music_refusal(stand_in))
        with mock.patch.dict(mix.REFUSED_SHA256, {digest: 'the iCentral preview track (simulated copy)'}):
            why = mix.music_refusal(stand_in)
            self.assertRefused(why)
            self.assertIn('SHA-256', why)
            with self.assertRaises(mix.MusicError) as cm:
                mix.check_music_file(stand_in, digest)
            self.assertTrue(cm.exception.refused)
            tl = timeline(self.root, stand_in, digest)
            tl['mix_wav'] = tl['mix_wav'].replace('-mix.wav', '-copy-mix.wav')
            if os.path.exists(tl['mix_wav']): os.remove(tl['mix_wav'])
            err = io.StringIO()
            with contextlib.redirect_stderr(err), self.assertRaises(SystemExit) as ex:
                mix.main(['--timeline', write_timeline(self.root, tl, 'timeline-copy.json')])
            self.assertEqual(ex.exception.code, 1)
            self.assertIn(mix.REFUSAL, err.getvalue())
            self.assertFalse(os.path.exists(tl['mix_wav']))
        self.assertIsNone(mix.music_refusal(stand_in))

    def test_unrefused_file_passes_the_check(self):
        ok = self.path('music', 'original-bed.wav')
        with open(ok, 'wb') as f:
            f.write(b'not an iCentral asset' * 100)
        r = run_mix('--check-music', ok)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_recorded_preview_hash_matches_the_file_when_present(self):
        p = mix.ICENTRAL_PREVIEW['path']
        if not os.path.isfile(p):
            self.skipTest(f'the iCentral preview is not on this machine ({p}); its recorded SHA-256 still refuses copies')
        self.assertEqual(mix.sha256_of(p), mix.ICENTRAL_PREVIEW['sha256'])     # a read of the file, never a copy
        self.assertIn(mix.ICENTRAL_PREVIEW['sha256'], mix.refused_hashes())


if P.IN_PIPELINE:
    import numpy as np
    import soundfile as sf

    class MixTest(_TestRoot, unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            super().setUpClass()
            try:
                import ff
            except Exception as err:
                cls._env.stop()
                raise unittest.SkipTest(f'ffmpeg unavailable: {err}')
            cls.ff = ff
            sr = mix.LOUDNESS['sample_rate']
            root = cls.root
            tl = timeline(root)
            os.makedirs(tl['vo_dir'], exist_ok=True)
            for name, _, secs in VO_LINES:              # sine-tone VO: 220 + 440 Hz, 20 ms fades, at the VO level
                t = np.arange(int(secs * sr)) / sr
                x = 0.7 * np.sin(2 * np.pi * 220 * t) + 0.5 * np.sin(2 * np.pi * 440 * t)
                f = int(0.02 * sr); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
                x *= 10 ** (RMS_TARGET_DBFS / 20) / np.sqrt(np.mean(x ** 2))
                sf.write(os.path.join(tl['vo_dir'], f'{name}.wav'), x, sr, subtype='PCM_24')
            bed = os.path.join(root, 'music', 'audio-test-bed.wav')   # stationary: filtered noise under a held chord
            os.makedirs(os.path.dirname(bed), exist_ok=True)
            from scipy.signal import butter, sosfilt
            rng = np.random.default_rng(1083)
            n = int(30 * sr); t = np.arange(n) / sr
            noise = sosfilt(butter(2, [200, 3000], 'band', fs=sr, output='sos'), rng.standard_normal((n, 2)), axis=0)
            chord = sum(np.sin(2 * np.pi * f0 * t) for f0 in (146.83, 185.0, 220.0, 293.66))[:, None] * [1.0, 0.9]
            y = 0.5 * noise / np.abs(noise).max() + 0.12 * chord
            sf.write(bed, 0.5 * y / np.abs(y).max(), sr, subtype='PCM_24')
            tl = timeline(root, bed, mix.sha256_of(bed))
            os.makedirs(os.path.dirname(tl['video_out']), exist_ok=True)
            subprocess.run([ff.FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                            f'testsrc2=size=1920x1080:rate=60:duration={D}', '-c:v', 'libx264', '-preset', 'ultrafast',
                            '-pix_fmt', 'yuv420p', tl['video_out']], check=True)
            for p in (tl['final_out'], tl['mix_wav']):
                if os.path.exists(p): os.remove(p)
            cls.tl, cls.tl_path = tl, write_timeline(root, tl)
            cls.result = run_mix('--timeline', cls.tl_path, '--stems', env=dict(os.environ))
            report = os.path.join(os.path.dirname(tl['mix_wav']), f'{EPISODE}-mix-report.json')
            cls.report = None
            if os.path.exists(report):
                with open(report) as f:
                    cls.report = json.load(f)

        def setUp(self):
            self.assertEqual(self.result.returncode, 0, self.result.stdout[-2000:] + self.result.stderr[-4000:])

        def test_muxed_aac_meets_the_loudness_spec(self):
            m = mix.measure(self.tl['final_out'])
            self.assertAlmostEqual(m['integrated_lufs'], -14.0, delta=0.5)
            self.assertLessEqual(m['true_peak_dbtp'], -1.0)
            self.assertEqual((m['codec'], m['sample_rate'], m['channels']), ('aac', 48000, 2))
            self.assertEqual(mix.spec_problems(m), [])
            self.assertEqual(self.report['problems'], [])
            self.assertTrue(MR.is_inside(os.path.realpath(self.tl['final_out']), self.root))

        def test_music_ducks_nine_db_under_the_vo(self):
            stem = os.path.join(os.path.dirname(self.tl['mix_wav']), 'stems', f'{EPISODE}-music.wav')
            x, sr = sf.read(stem)
            db = lambda a, b: 10 * np.log10(np.mean(x[int(a * sr):int(b * sr)] ** 2))
            # inside each line, clear of the 80 ms attack; in the gaps, clear of the 350 ms release and the next line's lookahead
            under = np.mean([db(2.6, 4.2), db(8.6, 10.2)])
            clear = np.mean([db(5.2, 7.6), db(11.2, 13.0)])
            self.assertAlmostEqual(under - clear, -9.0, delta=1.5)
            self.assertAlmostEqual(self.report['duck_db'], -9.0, delta=1.5)

        def test_vo_starts_where_the_timeline_puts_it(self):
            stem = os.path.join(os.path.dirname(self.tl['mix_wav']), 'stems', f'{EPISODE}-vo.wav')
            x, sr = sf.read(stem)
            env = np.abs(x).max(1)
            for name, t, secs in VO_LINES:
                with self.subTest(line=name):
                    seg = env[int((t - 0.5) * sr):int((t + 0.5) * sr)]
                    onset = t - 0.5 + np.argmax(seg > 1e-4) / sr
                    self.assertAlmostEqual(onset, t, delta=1 / 60)

        def test_picture_is_copied_unchanged(self):
            def md5(path):
                r = subprocess.run([self.ff.FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', path, '-map', '0:v:0',
                                    '-c', 'copy', '-f', 'md5', '-'], capture_output=True, text=True, check=True)
                return r.stdout.strip()
            self.assertEqual(md5(self.tl['final_out']), md5(self.tl['video_out']))
            info = P.ffprobe_json(self.tl['final_out'], '-show_entries', 'stream=codec_type,codec_name,nb_frames')
            v = [s for s in info['streams'] if s['codec_type'] == 'video']
            self.assertEqual(len(v), 1)
            self.assertEqual(int(v[0]['nb_frames']), int(D * 60))
else:
    class MixTest(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
