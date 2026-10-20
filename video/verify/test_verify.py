"""verify.py, the release gate, on synthetic renders made with ffmpeg: no IntelliDash, no network, no real names.

Each clip is ffmpeg testsrc2 (always moving) with a 997 Hz stereo tone at a known level, H.264 High and AAC 48 kHz, written
under <media root>/episodes/_test/verify/ like every other test medium. One clip passes every check; the others fail
loudness, black frames, frozen frames and format, and the same passing clip fails a short label hold, a VO overlap and the
duration target through its timeline and episode. The interval and log parsers are tested without media.

  python3 -m unittest video/verify/test_verify.py
"""
import importlib.util
import json
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
for _p in (os.path.join(VIDEO, 'lib'), os.path.join(VIDEO, 'edit', 'lib')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
from media import TEST_EPISODE, episode_dir  # noqa: E402

SCRIPT = os.path.join(HERE, 'verify.py')


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


V = _load('sa_verify', 'verify.py')

APPROVALS = """# Approvals fixture for test_verify.py (not a decision)

| Gate | Artifact | Version | Decision | Date | Approver | Quote / notes |
|---|---|---|---|---|---|---|
| G5 | Music licence | test | {decision} | 2026-10-20 | test | Test fixture only. |
"""


class ParseTest(unittest.TestCase):
    """The log parsers and interval maths, without ffmpeg."""

    def test_ebur128_summary(self):
        log = ('[Parsed_ebur128_0 @ 0x1] t: 0.4 M: -20 S: -20 I: -30.0 LUFS\n[Parsed_ebur128_0 @ 0x1] Summary:\n\n'
               '  Integrated loudness:\n    I:         -14.2 LUFS\n    Threshold: -24.2 LUFS\n\n'
               '  True peak:\n    Peak:       -1.3 dBFS\n')
        self.assertEqual(V.parse_ebur128(log), (-14.2, -1.3))
        self.assertEqual(V.parse_ebur128('no summary'), (None, None))
        lufs, peak = V.parse_ebur128('Summary:\n I:  -inf LUFS\n Peak: -inf dBFS\n')
        self.assertEqual((lufs, peak), (float('-inf'), float('-inf')))

    def test_black_and_freeze_logs(self):
        log = ('[blackdetect @ 0x1] black_start:1 black_end:1.516667 black_duration:0.516667\n'
               '[freezedetect @ 0x2] lavfi.freezedetect.freeze_start: 0\n'
               '[freezedetect @ 0x2] lavfi.freezedetect.freeze_duration: 2.016667\n'
               '[freezedetect @ 0x2] lavfi.freezedetect.freeze_end: 2.016667\n'
               '[freezedetect @ 0x2] lavfi.freezedetect.freeze_start: 4.5\n')
        self.assertEqual(V.parse_black(log, 6.0), [(1.0, 1.516667)])
        self.assertEqual(V.parse_freeze(log, 6.0), [(0.0, 2.016667), (4.5, 6.0)])
        self.assertEqual(V.parse_black('black_start:5.8', 6.0), [(5.8, 6.0)])

    def test_subtract(self):
        self.assertEqual(V.subtract((0, 10), [(2, 3), (5, 12)]), [(0, 2), (3, 5)])
        self.assertEqual(V.subtract((1, 2), [(0, 5)]), [])
        self.assertEqual(V.subtract((1, 2), []), [(1, 2)])

    def test_black_allowed_at_the_edges_and_on_intentional_layers(self):
        tl = dict(layers=[dict(type='wall', t0=2.0, t1=2.5, intentional=['black'])])
        self.assertEqual(V.check_black('black_start:0 black_end:0.2\nblack_start:2.0 black_end:2.5\n', 3.0, tl)['status'], 'pass')
        self.assertEqual(V.check_black('black_start:0 black_end:0.3\n', 3.0, tl)['status'], 'fail')
        self.assertEqual(V.check_black('black_start:2.85 black_end:3.0\n', 3.0, tl)['status'], 'pass')

    def test_freeze_allowed_inside_label_holds_and_declared_holds(self):
        log = 'lavfi.freezedetect.freeze_start: 1.0\nlavfi.freezedetect.freeze_end: 3.0\n'
        self.assertEqual(V.check_frozen(log, 6.0, {})['status'], 'fail')
        self.assertEqual(V.check_frozen(log, 6.0, dict(labels=[dict(text='Read the map', tin=0.9, tout=3.1)]))['status'], 'pass')
        self.assertEqual(V.check_frozen(log, 6.0, dict(holds=[[1.0, 3.0]]))['status'], 'pass')
        self.assertEqual(V.check_frozen(log, 6.0, dict(layers=[dict(t0=0, t1=4, intentional=True)]))['status'], 'pass')
        # a label covering only part of the freeze leaves 1.5 s or more uncovered: still a failure
        self.assertEqual(V.check_frozen('lavfi.freezedetect.freeze_start: 0\nlavfi.freezedetect.freeze_end: 4\n', 6.0,
                                        dict(labels=[dict(text='Map', tin=0, tout=1)]))['status'], 'fail')

    def test_holds_rule(self):
        ok = V.check_holds(dict(duration=10, labels=[dict(text='Read the map', tin=1.0, tout=3.4)]))
        self.assertEqual(ok['status'], 'pass')                      # 3 words: 1.5 + 0.9 = 2.4 s
        short = V.check_holds(dict(duration=10, labels=[dict(text='Read the map', tin=1.0, tout=3.3)]))
        self.assertEqual(short['status'], 'fail')
        self.assertIn('needs 2.40 s', short['detail'])
        clamped = V.check_holds(dict(duration=3.0, labels=[dict(text='Map', tin=1.5, tout=9.0)]))
        self.assertEqual(clamped['status'], 'fail')                 # tout past the end counts only to the end: 1.5 < 1.8

    def test_vo_overlap_rule(self):
        d = episode_dir(TEST_EPISODE, 'verify')
        rep = os.path.join(d, 'vo-report-unit.json')
        with open(rep, 'w') as f:
            json.dump(dict(lines=[dict(line='a', seconds=1.0), dict(line='b', seconds=1.0)]), f)
        good = V.check_vo(dict(duration=5, vo=[['a', 0.5], ['b', 1.65]]), rep)
        self.assertEqual(good['status'], 'pass', good['detail'])
        close = V.check_vo(dict(duration=5, vo=[['a', 0.5], ['b', 1.6]]), rep)
        self.assertEqual(close['status'], 'fail')
        missing = V.check_vo(dict(duration=5, vo=[['c', 0.5]]), rep)
        self.assertIn('missing from the VO report', missing['detail'])
        past = V.check_vo(dict(duration=2, vo=[['a', 1.5]]), rep)
        self.assertIn('past the end', past['detail'])

    def test_no_temporary_paths_in_the_scripts(self):
        # The gate's own scripts never name a temporary directory; only test refusal checks may.
        for name in ('verify.py', 'ocr_check.py', 'captions.py', 'ocr.swift'):
            path = os.path.join(HERE, name)
            if not os.path.exists(path):
                continue
            with open(path, encoding='utf-8') as f:
                text = f.read()
            for bad in ('/tmp', 'tempfile', 'gettempdir', 'mkdtemp'):
                self.assertNotIn(bad, text, f'{name} mentions {bad}')


class RenderTest(unittest.TestCase):
    """verify.py end to end on ffmpeg-generated clips."""

    @classmethod
    def setUpClass(cls):
        try:
            import ff
        except Exception as err:      # ffmpeg missing, or a temporary build: nothing to render with
            raise unittest.SkipTest(f'ffmpeg unavailable: {err}')
        cls.ff = ff
        cls.dir = episode_dir(TEST_EPISODE, 'verify')
        cls.clips = {
            'pass': cls.clip('pass'),
            'quiet': cls.clip('quiet', db=-20.0),
            'black': cls.clip('black', black=(1.0, 1.5)),
            'frozen': cls.clip('frozen', frozen_head=2.0),
            'small': cls.clip('small', size=(1280, 720), fps=30),
        }
        cls.vo_report = cls.write('vo-report.json', dict(lines=[dict(line='vo-one', text='One.', seconds=1.0),
                                                                dict(line='vo-two', text='Two.', seconds=0.9)]))
        cls.episode = cls.write('episode.json', dict(id=TEST_EPISODE, title='Verify fixture', durationTarget=[2.5, 3.5]))
        cls.approvals_pending = cls.write_text('approvals-g5-pending.md', APPROVALS.format(decision='pending'))
        cls.approvals_decided = cls.write_text('approvals-g5-decided.md', APPROVALS.format(decision='decided by executor'))

    @classmethod
    def clip(cls, name, db=-14.0, black=None, frozen_head=None, size=(1920, 1080), fps=60, seconds=3.0):
        out = os.path.join(cls.dir, f'clip-{name}.mp4')
        amp = 10 ** (db / 20)
        vsrc = f'testsrc2=size={size[0]}x{size[1]}:rate={fps}:duration={seconds - (frozen_head or 0)}'
        vf = []
        if frozen_head:
            vf.append(f'tpad=start_mode=clone:start_duration={frozen_head}')
        if black:
            vf.append(f"drawbox=enable='between(t,{black[0]},{black[1]})':color=black:t=fill")
        vf.append('format=yuv420p')
        tone = f'{amp:.6f}*sin(2*PI*997*t)'
        subprocess.run([cls.ff.FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', vsrc,
                        '-f', 'lavfi', '-i', f'aevalsrc={tone}|{tone}:s=48000:d={seconds}',
                        '-vf', ','.join(vf), '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                        '-preset', 'veryfast', '-crf', '23', '-r', str(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                        '-ac', '2', '-t', str(seconds), '-movflags', '+faststart', out], check=True)
        return out

    @classmethod
    def write(cls, name, obj):
        path = os.path.join(cls.dir, name)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(obj, f)
        return path

    @classmethod
    def write_text(cls, name, text):
        path = os.path.join(cls.dir, name)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        return path

    def timeline(self, case, **over):
        tl = dict(name=f'verify-{case}', w=1920, h=1080, fps=60, duration=3.0,
                  labels=[dict(text='Read the map', tin=0.3, tout=2.8, kind='label')],
                  vo=[['vo-one', 0.2], ['vo-two', 1.5]],
                  music=dict(track='fixture.wav', licenceRef='TEST-LICENCE-1'), layers=[])
        tl.update(over)
        return self.write(f'timeline-{case}.json', tl)

    def verify(self, case, clip='pass', draft=True, approvals=None, episode=None, **tl):
        report = os.path.join(self.dir, f'verify-report-{case}.json')
        if os.path.exists(report):
            os.remove(report)
        args = [sys.executable, SCRIPT, '--render', self.clips[clip], '--timeline', self.timeline(case, **tl),
                '--episode', episode or self.episode, '--vo-report', self.vo_report, '--report', report]
        if draft:
            args.append('--draft')
        if approvals:
            args += ['--approvals', approvals]
        r = subprocess.run(args, capture_output=True, text=True)
        self.assertIn(r.returncode, (0, 1), r.stderr)
        with open(report) as f:
            rep = json.load(f)
        return r, rep, {c['name']: c for c in rep['checks']}

    def assert_only_fails(self, checks, *names):
        failed = sorted(n for n, c in checks.items() if c['status'] == 'fail')
        self.assertEqual(failed, sorted(names), {n: checks[n]['detail'] for n in failed})

    def test_passing_render(self):
        r, rep, checks = self.verify('pass')
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertTrue(rep['pass'])
        self.assertEqual([c['id'] for c in rep['checks']], list('abcdefgh'))
        for c in rep['checks']:
            self.assertEqual(set(c), {'id', 'name', 'status', 'pass', 'detail', 'values'})
        self.assertEqual(checks['music_licence']['status'], 'skipped')
        self.assertIsNone(checks['music_licence']['pass'])
        self.assertAlmostEqual(checks['loudness']['values']['integrated_lufs'], -14.0, delta=0.5)
        self.assertIn('verify: PASS', r.stdout)

    def test_loudness_fails(self):
        r, rep, checks = self.verify('quiet', clip='quiet')
        self.assertEqual(r.returncode, 1)
        self.assertFalse(rep['pass'])
        self.assert_only_fails(checks, 'loudness')
        self.assertIn('LUFS', checks['loudness']['detail'])

    def test_short_label_hold_fails(self):
        r, rep, checks = self.verify('short-hold', labels=[dict(text='Read the map', tin=0.3, tout=1.5, kind='label')])
        self.assertEqual(r.returncode, 1)
        self.assert_only_fails(checks, 'holds')

    def test_black_gap_fails(self):
        r, rep, checks = self.verify('black', clip='black')
        self.assertEqual(r.returncode, 1)
        self.assert_only_fails(checks, 'black_frames')
        self.assertIn('1.00-1.5', checks['black_frames']['detail'])

    def test_black_gap_on_an_intentional_layer_passes(self):
        r, rep, checks = self.verify('black-intentional', clip='black',
                                     layers=[dict(type='wall', t0=0.95, t1=1.6, intentional=['black'])])
        self.assertEqual(r.returncode, 0, checks['black_frames']['detail'])

    def test_frozen_picture_fails_outside_holds_and_passes_inside(self):
        r, rep, checks = self.verify('frozen', clip='frozen', labels=[])
        self.assertEqual(r.returncode, 1)
        self.assert_only_fails(checks, 'frozen_frames')
        r, rep, checks = self.verify('frozen-held', clip='frozen',
                                     labels=[dict(text='Read the map', tin=0.0, tout=2.8, kind='label')])
        self.assertEqual(r.returncode, 0, checks['frozen_frames']['detail'])

    def test_vo_overlap_fails(self):
        r, rep, checks = self.verify('vo-overlap', vo=[['vo-one', 0.2], ['vo-two', 1.3]])
        self.assertEqual(r.returncode, 1)
        self.assert_only_fails(checks, 'vo_overlap')

    def test_format_fails(self):
        r, rep, checks = self.verify('small', clip='small')
        self.assertEqual(r.returncode, 1)
        self.assert_only_fails(checks, 'format')
        self.assertIn('1280x720', checks['format']['detail'])
        self.assertIn('30', checks['format']['detail'])

    def test_duration_outside_target_fails(self):
        episode = self.write('episode-long.json', dict(id=TEST_EPISODE, durationTarget=[20, 30]))
        r, rep, checks = self.verify('duration', episode=episode)
        self.assertEqual(r.returncode, 1)
        self.assert_only_fails(checks, 'duration')

    def test_final_mode_needs_g5_and_a_licence_ref(self):
        r, rep, checks = self.verify('final-pending', draft=False, approvals=self.approvals_pending)
        self.assertEqual(r.returncode, 1)
        self.assertEqual(rep['mode'], 'final')
        self.assert_only_fails(checks, 'music_licence')
        self.assertIn('G5', checks['music_licence']['detail'])
        r, rep, checks = self.verify('final-decided', draft=False, approvals=self.approvals_decided)
        self.assertEqual(r.returncode, 0, checks['music_licence']['detail'])
        r, rep, checks = self.verify('final-no-ref', draft=False, approvals=self.approvals_decided,
                                     music=dict(track='fixture.wav'))
        self.assertEqual(r.returncode, 1)
        self.assertIn('licenceRef', checks['music_licence']['detail'])

    def test_refuses_a_report_or_render_outside_the_media_root(self):
        tl = self.timeline('refuse')
        for flag, path in (('--report', '/tmp/sa-verify-report.json'), ('--render', '/tmp/sa-verify.mp4')):
            args = {'--render': self.clips['pass'], '--report': os.path.join(self.dir, 'verify-report-refuse.json')}
            args[flag] = path
            r = subprocess.run([sys.executable, SCRIPT, '--render', args['--render'], '--timeline', tl, '--episode', self.episode,
                                '--vo-report', self.vo_report, '--report', args['--report'], '--draft'],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
            self.assertIn('temporary directory', r.stderr)
            self.assertFalse(os.path.exists(path))


if __name__ == '__main__':
    unittest.main()
