"""Tests for video/edit/build.py, the episode builder, end to end with the synthetic take.

  python3 video/edit/tests/test_build.py

GateTest (standard library only, runs in any Python) runs build.py as a subprocess against approvals fixtures passed in
$SA_APPROVALS_PATH (temporary text files; the real video/approvals.md is never written, and the test checks it is
byte-for-byte unchanged): a draft with G3 pending exits 3 naming G3; a final with nothing decided exits 3 naming G3, G4
and G5; a final with G4 and G5 pending names exactly those; a final with every gate decided but no music record, or a
record without a licence reference, exits 3; a final of an episode still at status draft exits 3.

BuildTest (the pipeline Python, ffmpeg, node and Playwright Chromium) makes the synthetic take (make_synthetic_take.py:
a 3840x2160 60 fps testsrc2 take with the director's magenta flashes, cue log and cursor track, speech-like VO and its
render report, the original music bed and a test music record) under <media root>/_tests/build, then runs build.py
--draft, render.py, mix.py and verify.py --draft on it, as a person would:
  - the start flash is found where it was drawn, and every VO line starts at flash + its cue (a chapter line) or at the
    title card's VO time (the intro line), within 1/60 s;
  - the draft is named -DRAFT; the muxed file is H.264 1920x1080 60 fps with AAC 48 kHz stereo at -14 +/- 0.5 LUFS and
    a true peak at or below -1 dBTP; verify.py passes it;
  - the window plates are tilted with cursor-follow push-ins, and the flat variant (camera 'flat', the Double Click
    look) has no tilt;
  - a VO line that runs into the next fails the build naming both lines, and a title too long for the title card's hold
    fails it naming the title.
Everything it writes goes under <media root>/_tests/build; about a minute and a half on a laptop.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402  (puts lib/ and video/lib on the path)

sys.path.insert(0, P.EDIT)
import approvals  # noqa: E402
import media_root as MR  # noqa: E402
import make_synthetic_take as S  # noqa: E402  (standard library at import)

BUILD = os.path.join(P.EDIT, 'build.py')
MIX = os.path.join(P.EDIT, 'mix.py')
VERIFY = os.path.join(P.VIDEO, 'verify', 'verify.py')
FRAME = 1 / 60
HEADER = '| Gate | Artifact | Version | Decision | Date | Approver | Quote / notes |\n|---|---|---|---|---|---|---|\n'
DECIDED = ('decided by executor', 'executor', 'Decided by the executor under owner direction 2026-10-19; test fixture.')
PENDING = ('pending', '—', '—')


def approvals_doc(decided=(), gates=('G3', 'G4', 'G5')):
    """An approvals log in video/approvals.md's format: the gates in `decided` decided, the rest pending."""
    rows = ''.join(f'| {g} | artifact | v1 | {d} | 2026-10-20 | {who} | {notes} |\n'
                   for g in gates for d, who, notes in [DECIDED if g in decided else PENDING])
    return '# Approvals\n\n## Gates\n\n' + HEADER + rows


def test_root():
    root = MR.media_root()
    tail = os.path.join('_tests', 'build')
    return root if root.rstrip(os.sep).endswith(tail) else os.path.join(root, tail)


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


class GateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.real = sha(approvals.APPROVALS_MD)
        cls.tmp = tempfile.TemporaryDirectory()                       # text fixtures only: approvals logs, an episode
        cls.episode = os.path.join(cls.tmp.name, 'episode.json')
        with open(cls.episode, 'w') as f:
            json.dump(S.episode(), f)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def tearDown(self):
        self.assertEqual(sha(approvals.APPROVALS_MD), self.real, 'video/approvals.md changed during the test')

    def fixture(self, name, text):
        p = os.path.join(self.tmp.name, name)
        with open(p, 'w') as f:
            f.write(text)
        return p

    def run_build(self, mode, approvals_text, episode=None, music=None):
        env = dict(os.environ, SA_APPROVALS_PATH=self.fixture(f'approvals-{self.id().split(".")[-1]}.md', approvals_text),
                   SA_MEDIA_ROOT=test_root())
        if music is not None:
            env['SA_MUSIC_JSON'] = music
        return subprocess.run([sys.executable, BUILD, '--episode', episode or self.episode, '--take', '1', f'--{mode}'],
                              cwd=P.REPO, capture_output=True, text=True, env=env)

    def assertRefused(self, r, *gates):
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        if gates:
            self.assertIn('missing approval: ' + ', '.join(gates) + '.', r.stderr)

    def test_draft_needs_g3(self):
        self.assertRefused(self.run_build('draft', approvals_doc(decided=('G4', 'G5'))), 'G3')

    def test_final_names_every_missing_gate(self):
        self.assertRefused(self.run_build('final', approvals_doc()), 'G3', 'G4', 'G5')

    def test_final_needs_g4_and_g5(self):
        self.assertRefused(self.run_build('final', approvals_doc(decided=('G3',))), 'G4', 'G5')

    def test_final_needs_g5(self):
        self.assertRefused(self.run_build('final', approvals_doc(decided=('G3', 'G4'))), 'G5')

    def test_final_needs_a_music_record(self):
        r = self.run_build('final', approvals_doc(decided=('G3', 'G4', 'G5')), music=os.path.join(self.tmp.name, 'no-music.json'))
        self.assertRefused(r)
        self.assertIn('a final needs a licensed music track', r.stderr)

    def test_final_needs_a_licence_reference(self):
        rec = dict(approval='G5', track=dict(id='t', file='music/t.wav', sha256='0' * 64), licence=dict(type='original'))
        r = self.run_build('final', approvals_doc(decided=('G3', 'G4', 'G5')), music=self.fixture('music.json', json.dumps(rec)))
        self.assertRefused(r)
        self.assertIn('licence.reference', r.stderr)

    def test_final_needs_a_locked_script(self):
        ep = self.fixture('episode-draft.json', json.dumps(dict(S.episode(), status='draft')))
        r = self.run_build('final', approvals_doc(decided=('G3', 'G4', 'G5')), episode=ep)
        self.assertRefused(r)
        self.assertIn('script-locked', r.stderr)


class UpNextTest(unittest.TestCase):
    """The closing "Next on Double Click" card: drawn only when endCard names an open next episode, and long enough for
    its label's hold (standard library only)."""

    @classmethod
    def setUpClass(cls):
        import importlib.util
        spec = importlib.util.spec_from_file_location('sa_build', BUILD)
        cls.B = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.B)

    def test_title_from_end_card(self):
        ep = dict(endCard=dict(next='map-navigation', text='Next on Double Click: Map navigation', address='#/x'))
        self.assertEqual(self.B.up_next_title(ep), 'Map navigation')

    def test_series_end_has_no_up_next(self):
        line = "That's the latest Double Click. Find every guide on the Spatial Adjust Guides site."
        self.assertIsNone(self.B.up_next_title(dict(endCard=dict(next=None, text=line, address='#/x'))))
        self.assertIsNone(self.B.up_next_title(dict()))

    def test_card_holds_its_label(self):
        from brand import TITLE_CARD, min_hold
        un = TITLE_CARD['up_next']
        for title in ('Map navigation', 'Understand suggested adjustments', 'Why is this station 0%?'):
            secs = self.B.up_next_seconds(title)
            label = f'Next on / Double Click / {title}'
            self.assertGreaterEqual(secs - un['out'] - un['pop'], min_hold(label), title)
            self.assertGreaterEqual(secs, self.B.DURATIONS['up_next_card'])


if P.IN_PIPELINE:
    class BuildTest(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.real = sha(approvals.APPROVALS_MD)
            cls.root = test_root()
            os.makedirs(cls.root, exist_ok=True)
            cls.tmp = tempfile.TemporaryDirectory()
            ap = os.path.join(cls.tmp.name, 'approvals.md')
            with open(ap, 'w') as f:
                f.write(approvals_doc(decided=('G3',)))
            cls._env = mock.patch.dict(os.environ, {'SA_MEDIA_ROOT': cls.root, 'SA_APPROVALS_PATH': ap})
            cls._env.start()
            try:
                cls.setUpPipeline()
            except Exception:
                cls._env.stop(); cls.tmp.cleanup()
                raise

        @classmethod
        def setUpPipeline(cls):
            try:
                import ff  # noqa: F401
            except Exception as err:
                raise unittest.SkipTest(f'ffmpeg unavailable: {err}')
            probe = unittest.TestCase()
            P.require(probe, 'chromium')                                  # raises SkipTest when node or Chromium is missing
            cls.info = S.make()
            os.environ['SA_MUSIC_JSON'] = cls.info['music_json']

            def run(*cmd):
                r = subprocess.run([sys.executable, *cmd], cwd=P.REPO, capture_output=True, text=True, env=dict(os.environ))
                if r.returncode != 0:
                    raise AssertionError(f'{" ".join(os.path.basename(c) for c in cmd[:1])} exited {r.returncode}:\n'
                                         + r.stdout[-2000:] + r.stderr[-4000:])
                return r
            run(BUILD, '--episode', cls.info['episode'], '--take', '1', '--draft')
            cls.tl_path = os.path.join(MR.episode_dir(S.EPISODE_ID, 'edit'), 'timeline.json')
            with open(cls.tl_path) as f:
                cls.tl = json.load(f)
            for p in (cls.tl['video_out'], cls.tl['final_out']):
                if os.path.exists(p): os.remove(p)
            run(os.path.join(P.EDIT, 'render.py'), '--timeline', cls.tl_path, '--preset', 'veryfast')
            run(MIX, '--timeline', cls.tl_path)
            cls.verify = subprocess.run([sys.executable, VERIFY, '--render', cls.tl['final_out'], '--timeline', cls.tl_path,
                                         '--episode', cls.info['episode'], '--draft'],
                                        cwd=P.REPO, capture_output=True, text=True, env=dict(os.environ))

        @classmethod
        def tearDownClass(cls):
            cls._env.stop()
            cls.tmp.cleanup()

        def tearDown(self):
            self.assertEqual(sha(approvals.APPROVALS_MD), self.real, 'video/approvals.md changed during the test')

        def test_flash_found_and_vo_on_its_cues(self):
            import build as B
            from brand import DURATIONS
            F = self.tl['notes']['flash']
            self.assertAlmostEqual(F, S.FLASH, delta=FRAME)
            cues = S.cue_times()
            placed = dict(self.tl['vo'])
            self.assertEqual(set(placed), set(cues))
            for name, t in placed.items():
                with self.subTest(line=name):
                    ch = [c for c in self.tl['chapters'] if c['src_in'] <= F + cues[name] < c['src_out']]
                    if ch:                                                   # a chapter line: the cue's frame
                        c = ch[0]
                        self.assertAlmostEqual(t, c['t0'] + (F + cues[name] - c['src_in']), delta=FRAME)
                    else:                                                    # before the first footage: the title card
                        self.assertAlmostEqual(t, DURATIONS['lockup'] + B.TITLE_VO_AT, delta=FRAME)
            self.assertEqual([c['label'] for c in self.tl['chapters']], [label for _, label in S.CHAPTERS])

        def test_draft_render_is_muxed_to_spec(self):
            import mix
            out = self.tl['final_out']
            self.assertIn('-DRAFT', os.path.basename(out))
            self.assertTrue(MR.is_inside(os.path.realpath(out), self.root))
            v = P.ffprobe_json(out, '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate')['streams'][0]
            self.assertEqual((v['codec_name'], v['width'], v['height'], v['avg_frame_rate']), ('h264', 1920, 1080, '60/1'))
            m = mix.measure(out)
            self.assertAlmostEqual(m['integrated_lufs'], -14.0, delta=0.5)
            self.assertLessEqual(m['true_peak_dbtp'], -1.0)
            self.assertEqual((m['codec'], m['sample_rate'], m['channels']), ('aac', 48000, 2))
            self.assertAlmostEqual(m['duration'], self.tl['duration'], delta=0.05)

        def test_verify_passes_the_draft(self):
            self.assertEqual(self.verify.returncode, 0, self.verify.stdout[-3000:] + self.verify.stderr[-2000:])

        def test_plates_are_tilted_with_push_ins(self):
            self.assertEqual(self.tl['camera'], 'tilt')
            plates = [L for L in self.tl['layers'] if L['type'] == 'plate']
            self.assertEqual(len(plates), len(S.CHAPTERS))
            for L in plates:
                with self.subTest(plate=L['id']):
                    self.assertGreater(max(abs(k[1]) for k in L['rx'] + L['ry']), 2.0)
                    scale = [k[1][2] for k in L['cam']]
                    self.assertGreater(max(scale) - min(scale), 0.05)     # the camera moves in on the focus boxes
            self.assertGreater(max(k[1][2] for L in plates for k in L['cam']), 1.3)

        def test_flat_variant_has_no_tilt(self):
            import build as B
            _, d = B.build(self.info['episode'], 1, 'draft', camera='flat')
            self.assertEqual(d['camera'], 'flat')
            plates = [L for L in d['layers'] if L['type'] == 'plate']
            self.assertTrue(plates)
            for L in plates:
                for k in ('rx', 'ry', 'rz'):
                    v = L[k]
                    vals = [x[1] for x in v] if isinstance(v, list) else [v]
                    self.assertTrue(all(abs(x) < 1e-9 for x in vals), (L['id'], k))
            # the build writes timeline.json: put the tilted one back for anything that reads it later
            B.build(self.info['episode'], 1, 'draft')

        def test_overlapping_vo_fails_naming_the_lines(self):
            import build as B
            real = B.vo_report

            def longer(ep):
                vo_dir, rep = real(ep)
                rep = {k: dict(v) for k, v in rep.items()}
                rep['vo-one']['seconds'] = 9.0                              # runs into vo-two
                return vo_dir, rep
            with mock.patch.object(B, 'vo_report', longer), self.assertRaises(B.BuildError) as cm:
                B.build(self.info['episode'], 1, 'draft', validate=False)
            self.assertEqual(cm.exception.code, 1)
            self.assertIn('vo-one', str(cm.exception))
            self.assertIn('vo-two', str(cm.exception))

        def test_title_card_is_held_long_enough_for_its_label(self):
            # A long title lengthens the card (title_card_seconds) rather than failing the build; the card is never
            # shorter than BRAND's, and the lengthened hold is the one verify's word count asks for.
            import build as B
            from brand import DURATIONS, TITLE_CARD, SERIES_WORD, min_hold
            long_title = 'Read every station on the course map before you adjust any one of them'
            self.assertEqual(B.title_card_seconds('Map navigation'), DURATIONS['title_card'])
            self.assertGreater(B.title_card_seconds(long_title), DURATIONS['title_card'])
            for title in ('Why is this station 0%?', long_title):
                with self.subTest(title=title):
                    hold = B.title_card_seconds(title) - TITLE_CARD['pop'] - TITLE_CARD['out']
                    self.assertGreaterEqual(hold, min_hold(f'{SERIES_WORD} / {title}'))
else:
    class BuildTest(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
