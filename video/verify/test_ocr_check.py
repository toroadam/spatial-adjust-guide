"""ocr_check.py, the OCR release gate, on synthetic renders: no IntelliDash, no network, no real names.

The denylist is the committed fixture maps in video/lib/fixtures (invented names), passed through SA_SANITIZE_PATH and
SA_OVERLAY_PATH; the real sanitize.local.json and overlay.local.json are never opened. A fixture name is drawn in Golos UI
(from _ds) by fixtures/text_card.swift, because the pipeline's ffmpeg has no drawtext filter, and made into two 2 s clips
under <media root>/episodes/_test/renders/: one that shows the name from 1.0 s, one that never does. The first must fail
with "[denylisted #N] at <t> s" and keep its frames; the second must pass and delete them. The name must never appear in
what the gate prints or writes. The matcher, the frame sampling and the 'OCR unavailable' exit run without media.

  python3 -m unittest video/verify/test_ocr_check.py
"""
import contextlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
REPO = os.path.dirname(VIDEO)
for _p in (os.path.join(VIDEO, 'lib'), os.path.join(VIDEO, 'edit', 'lib')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import media_root as MR  # noqa: E402
from local_maps import load_local_maps  # noqa: E402
from media import TEST_EPISODE, episode_dir  # noqa: E402

SCRIPT = os.path.join(HERE, 'ocr_check.py')
FIXTURES = os.path.join(VIDEO, 'lib', 'fixtures')
SANITIZE = os.path.join(FIXTURES, 'sanitize.fixture.json')
OVERLAY = os.path.join(FIXTURES, 'overlay.fixture.json')
TEXT_CARD = os.path.join(HERE, 'fixtures', 'text_card.swift')
FONT = os.path.join(REPO, '_ds', 'toro-oasis-design-system-53d56d79-256b-40ad-b179-70e176d485a8', 'assets', 'fonts',
                    'golos-ui_medium.ttf')


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


OC = _load('sa_ocr_check', 'ocr_check.py')


def fixture_term():
    """The fixture name drawn in the clip and its 1-based denylist index, from the committed fixture maps."""
    with open(OVERLAY, encoding='utf-8') as f:
        term = json.load(f)['denylist'][0]
    terms = list(load_local_maps(SANITIZE, OVERLAY, warn=lambda m: None).denylist)
    return term, 1 + [t.lower() for t in terms].index(term.lower())


class MatcherTest(unittest.TestCase):
    def test_exact_fuzzy_and_whole_word(self):
        m = OC.Matcher(['Harbor Vale Links', 'Quillon', 'Ab Co'])
        self.assertEqual(m.find('Welcome to HARBOR  vale links'), [1])
        self.assertEqual(m.find('Harbor Vale Linkz'), [1])            # one substitution: an OCR misread
        self.assertEqual(m.find('HarborVale Links'), [1])             # one deletion
        self.assertEqual(m.find('Harbr Vale Linkz'), [])              # two edits: not a match
        self.assertEqual(m.find('see Quil1on'), [2])
        self.assertEqual(m.find('ab co'), [3])                         # short terms: exact whole words only
        self.assertEqual(m.find('lab cove'), [])
        self.assertEqual(m.find('Ab Cq'), [])
        self.assertNotIn('Quillon', repr(m))

    def test_within_one_agrees_with_brute_force(self):
        def dist(a, b):
            prev = list(range(len(b) + 1))
            for i, ca in enumerate(a, 1):
                cur = [i]
                for j, cb in enumerate(b, 1):
                    cur.append(min(prev[j - 1] + (ca != cb), prev[j] + 1, cur[j - 1] + 1))
                prev = cur
            return prev[-1]

        term = 'riverstone'
        texts = ['riverstone', 'xx rivrstone yy', 'riverstones', 'rivetstone', 'river stone', 'rivr stone', 'stone river',
                 'iverstone', 'riverston', 'abc', 'riverrstone', 'rlverstome']
        for t in texts:
            brute = any(dist(term, t[i:j]) <= 1 for i in range(len(t) + 1) for j in range(i, len(t) + 1))
            self.assertEqual(OC.within_one(term, t), brute, t)

    def test_sampling(self):
        frames = OC.sample_frames(2.0, 60, 120, 0.5, [dict(tin=0.2), dict(tin=1.8), dict(text='no tin')])
        self.assertEqual(frames, [0, 30, 42, 60, 90])                  # 0, 0.5, 0.7 (label), 1.0, 1.5; 2.3 is past the end


    def test_select_expression_stays_shallow_for_a_long_render(self):
        frames = list(range(0, 7000, 30))                               # a 115 s render sampled every 0.5 s
        expr = OC.select_expr(frames)
        self.assertEqual(expr.count('eq(n,'), len(frames))
        self.assertTrue(all(group.count('eq(n,') <= 20 for group in expr.split('+(')))
        self.assertEqual(OC.select_expr([0, 30]), '(eq(n,0)+eq(n,30))')


class UnavailableTest(unittest.TestCase):
    def run_main(self, argv):
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            code = OC.main(argv)
        return code, err.getvalue()

    def test_not_macos_exits_3(self):
        with mock.patch.object(OC, 'current_platform', return_value='linux'):
            code, err = self.run_main(['--render', 'x.mp4', '--timeline', 'x.json'])
        self.assertEqual(code, 3)
        self.assertIn('OCR unavailable', err)

    def test_no_swiftc_and_no_binary_exits_3(self):
        missing = os.path.join(episode_dir(TEST_EPISODE, 'bin'), 'sa-ocr-never-built')
        with mock.patch.object(OC, 'current_platform', return_value='darwin'), \
                mock.patch.object(OC, 'find_swiftc', return_value=None), \
                mock.patch.object(OC, 'binary_path', return_value=missing):
            code, err = self.run_main(['--render', 'x.mp4', '--timeline', 'x.json'])
        self.assertEqual(code, 3)
        self.assertIn('OCR unavailable: swiftc not found', err)
        self.assertFalse(os.path.exists(missing))

    def test_no_temporary_paths(self):
        for name in ('ocr_check.py', 'ocr.swift'):
            with open(os.path.join(HERE, name), encoding='utf-8') as f:
                text = f.read()
            for bad in ('/tmp', 'tempfile', 'gettempdir', 'mkdtemp'):
                self.assertNotIn(bad, text, f'{name} mentions {bad}')


@unittest.skipUnless(sys.platform == 'darwin', 'the OCR gate uses the macOS Vision framework')
class RenderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (os.environ.get('SWIFTC') or shutil.which('swiftc')):
            raise unittest.SkipTest('swiftc missing: install the Xcode command line tools')
        try:
            import ff
        except Exception as err:
            raise unittest.SkipTest(f'ffmpeg unavailable: {err}')
        cls.term, cls.index = fixture_term()
        cls.renders = episode_dir(TEST_EPISODE, 'renders')
        cls.work = episode_dir(TEST_EPISODE, 'verify', 'ocr')
        card = cls.text_card_binary()
        cards = {}
        for name, px, text in (('clean', 72, 'Read the moisture map'), ('hit', 56, f'Course lead {cls.term}')):
            cards[name] = os.path.join(cls.work, f'card-{name}.png')
            subprocess.run([card, FONT, cards[name], '1920', '1080', str(px), text], check=True)
        cls.clean = cls.clip(ff, 'ocr-clean.mp4', cards['clean'], cards['clean'])
        cls.hit = cls.clip(ff, 'ocr-hit.mp4', cards['clean'], cards['hit'])
        for p in cards.values():
            os.remove(p)                                   # the hit card shows the fixture name; keep only the clips
        cls.timeline = os.path.join(cls.work, 'timeline-ocr.json')
        with open(cls.timeline, 'w') as f:
            json.dump(dict(duration=2.0, labels=[dict(text='Read the moisture map', tin=0.2, tout=1.9)]), f)
        cls.frames_dir = os.path.join(MR.media_root(), 'episodes', TEST_EPISODE, 'frames', 'ocr')

    @classmethod
    def text_card_binary(cls):
        out = os.path.join(episode_dir(TEST_EPISODE, 'bin'), 'text-card')
        if not (os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(TEXT_CARD)):
            swiftc = os.environ.get('SWIFTC') or shutil.which('swiftc')
            subprocess.run([swiftc, '-O', TEXT_CARD, '-o', out], check=True, capture_output=True)
        return out

    @classmethod
    def clip(cls, ff, name, first, second):
        out = os.path.join(cls.renders, name)
        subprocess.run([ff.FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-t', '1', '-i', first,
                        '-loop', '1', '-t', '1', '-i', second, '-filter_complex',
                        '[0:v][1:v]concat=n=2:v=1:a=0,fps=60,format=yuv420p[v]', '-map', '[v]', '-c:v', 'libx264',
                        '-profile:v', 'high', '-preset', 'veryfast', '-crf', '18', '-r', '60', out], check=True)
        return out

    def ocr(self, render, report_name, *extra, sanitize=SANITIZE, overlay=OVERLAY):
        report = os.path.join(self.renders, report_name)
        if os.path.exists(report):
            os.remove(report)
        env = dict(os.environ, SA_SANITIZE_PATH=sanitize, SA_OVERLAY_PATH=overlay)
        r = subprocess.run([sys.executable, SCRIPT, '--render', render, '--timeline', self.timeline, '--report', report,
                            *extra], capture_output=True, text=True, env=env)
        text = ''
        if os.path.exists(report):
            with open(report, encoding='utf-8') as f:
                text = f.read()
        return r, text

    def frames(self):
        return sorted(n for n in os.listdir(self.frames_dir) if n.endswith('.png')) if os.path.isdir(self.frames_dir) else []

    def assert_term_never_shown(self, *texts):
        for t in texts:
            self.assertNotIn(self.term.casefold(), t.casefold())
            for word in self.term.split():
                self.assertNotIn(word.casefold(), t.casefold())

    def test_fixture_name_fails_with_index_and_time(self):
        r, text = self.ocr(self.hit, 'ocr-report-hit.json')
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertRegex(r.stdout, rf'\[denylisted #{self.index}\] at 1\.\d\d s')
        self.assertNotRegex(r.stdout, r'\] at 0\.')                  # the name only shows from 1.0 s
        rep = json.loads(text)
        self.assertFalse(rep['pass'])
        self.assertEqual(rep['frames'], 5)                              # 0, 0.5, 0.7 (label tin + 0.5), 1.0, 1.5
        self.assertTrue(rep['hits'])
        for h in rep['hits']:
            self.assertEqual(set(h), {'t', 'index'})
            self.assertEqual(h['index'], self.index)
            self.assertGreaterEqual(h['t'], 1.0)
        self.assert_term_never_shown(r.stdout, r.stderr, text)
        self.assertTrue(rep['frames_kept'])
        self.assertEqual(len(self.frames()), 5)                         # kept for review after a failure
        self.assertTrue(MR.is_inside(rep['frames_dir'], MR.media_root()))
        self.assertTrue(rep['frames_dir'].endswith(os.path.join('episodes', TEST_EPISODE, 'frames', 'ocr')))

    def test_clean_clip_passes_and_deletes_frames(self):
        r, text = self.ocr(self.clean, 'ocr-report-clean.json')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        rep = json.loads(text)
        self.assertTrue(rep['pass'])
        self.assertEqual(rep['hits'], [])
        self.assertFalse(rep['frames_kept'])
        self.assertEqual(self.frames(), [])
        r, text = self.ocr(self.clean, 'ocr-report-keep.json', '--keep-frames')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(len(self.frames()), 5)
        OC.remove_frames(self.frames_dir)
        binary = os.path.join(MR.media_root(), 'bin', 'sa-ocr')
        self.assertEqual(json.loads(text)['binary'], binary)
        self.assertTrue(os.access(binary, os.X_OK))

    def test_empty_denylist_cannot_pass(self):
        missing = os.path.join(self.work, 'no-such-map.json')
        r, text = self.ocr(self.clean, 'ocr-report-empty.json', sanitize=missing, overlay=missing)
        self.assertEqual(r.returncode, 2)
        self.assertIn('denylist is empty', r.stderr)
        self.assertEqual(text, '')

    def test_refuses_a_render_outside_the_media_root(self):
        r, _ = self.ocr('/tmp/sa-ocr-test.mp4', 'ocr-report-refuse.json')
        self.assertEqual(r.returncode, 2)
        self.assertIn('temporary directory', r.stderr)


if __name__ == '__main__':
    unittest.main()
