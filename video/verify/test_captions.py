"""captions.py: English WebVTT captions from the timeline's VO placements, on committed fixture data.

The fixtures (video/verify/fixtures/captions/) are an invented four-line episode, its timeline and VO render report. The
denylist is the committed fixture maps in video/lib/fixtures, passed through SA_SANITIZE_PATH and SA_OVERLAY_PATH; the real
local maps are never opened. Output goes to <media root>/episodes/_test/renders/. Standard library only, no media.

  python3 -m unittest video/verify/test_captions.py
"""
import importlib.util
import json
import os
import re
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
for _p in (os.path.join(VIDEO, 'lib'), os.path.join(VIDEO, 'edit', 'lib')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
from media import TEST_EPISODE, episode_dir  # noqa: E402

SCRIPT = os.path.join(HERE, 'captions.py')
FIX = os.path.join(HERE, 'fixtures', 'captions')
EPISODE, TIMELINE, REPORT = (os.path.join(FIX, n) for n in ('episode.json', 'timeline.json', 'render-report.json'))
MAPS = os.path.join(VIDEO, 'lib', 'fixtures')
ENV = dict(os.environ, SA_SANITIZE_PATH=os.path.join(MAPS, 'sanitize.fixture.json'),
           SA_OVERLAY_PATH=os.path.join(MAPS, 'overlay.fixture.json'))
TIMING = re.compile(r'^(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})$')


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


C = _load('sa_captions', 'captions.py')


def seconds(h, m, s, ms):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_vtt(text):
    """[{id, start, end, lines}]; asserts the WebVTT shape on the way."""
    blocks = text.strip('\n').split('\n\n')
    assert blocks[0] == 'WEBVTT', blocks[0]
    cues = []
    for b in blocks[1:]:
        rows = b.split('\n')
        if rows[0].startswith('NOTE'):
            continue
        m = TIMING.match(rows[1])
        assert m, rows[1]
        g = m.groups()
        cues.append(dict(id=rows[0], start=seconds(*g[:4]), end=seconds(*g[4:]), lines=rows[2:]))
    return cues


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


class SplitTest(unittest.TestCase):
    def test_short_text_is_one_line(self):
        self.assertEqual(C.split_cues('Done.'), [['Done.']])

    def test_long_text_splits_at_phrase_ends_within_limits(self):
        text = load(EPISODE)['vo'][1]['text']
        cues = C.split_cues(text)
        self.assertGreaterEqual(len(cues), 2)
        for lines in cues:
            self.assertLessEqual(len(lines), 2)
            for line in lines:
                self.assertLessEqual(len(line), 42)
        self.assertEqual(' '.join(' '.join(c) for c in cues), text)
        self.assertTrue(cues[0][-1].endswith(','), cues)           # the first cue ends at a phrase boundary

    def test_balanced_lines(self):
        lines = C.wrap('Spatial Adjust is a feature of IntelliDash.'.split())
        self.assertEqual(len(lines), 2)
        self.assertLessEqual(abs(len(lines[0]) - len(lines[1])), 12)

    def test_overlong_word_is_cut(self):
        cues = C.split_cues('x' * 100)
        self.assertTrue(all(len(line) <= 42 for c in cues for line in c))

    def test_water_fill(self):
        self.assertEqual(C.water_fill([10, 10], 5000, 1000), [2500, 2500])
        self.assertEqual(C.water_fill([1, 99], 3000, 1000), [1000, 2000])
        self.assertEqual(sum(C.water_fill([3, 7, 11], 4321, 1000)), 4321)


class CaptionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = episode_dir(TEST_EPISODE, 'renders')

    def run_captions(self, name, episode=EPISODE, timeline=TIMELINE, report=REPORT):
        out = os.path.join(self.dir, name)
        if os.path.exists(out):
            os.remove(out)
        r = subprocess.run([sys.executable, SCRIPT, '--timeline', timeline, '--episode', episode, '--report', report,
                            '--out', out], capture_output=True, text=True, env=ENV)
        return r, out

    def write(self, name, obj):
        path = os.path.join(episode_dir(TEST_EPISODE, 'verify'), name)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(obj, f)
        return path

    def test_fixture_captions(self):
        r, out = self.run_captions('captions-fixture.en.vtt')
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(out, encoding='utf-8') as f:
            text = f.read()
        self.assertTrue(text.startswith('WEBVTT\n'))
        cues = parse_vtt(text)
        episode, timeline = load(EPISODE), load(TIMELINE)
        texts = {v['id']: v['text'] for v in episode['vo']}
        placed = dict(timeline['vo'])
        by_line = {}
        for c in cues:
            line, n = c['id'].rsplit('-', 1)
            self.assertTrue(n.isdigit(), c['id'])
            by_line.setdefault(line, []).append(c)
            self.assertLessEqual(len(c['lines']), 2, c)
            for row in c['lines']:
                self.assertLessEqual(len(row), 42, c)
            self.assertGreaterEqual(round(c['end'] - c['start'], 3), 1.0, c)
            self.assertTrue(0 <= c['start'] < c['end'] <= timeline['duration'], c)
        self.assertEqual(set(by_line), set(texts))                       # one or more cues per VO line
        self.assertGreaterEqual(len(by_line['vo-map']), 2)
        for line, cs in by_line.items():
            self.assertLessEqual(abs(cs[0]['start'] - placed[line]), 0.1, line)
            self.assertEqual([c['id'] for c in cs], [f'{line}-{i}' for i in range(1, len(cs) + 1)])
            written = ' '.join(row for c in cs for row in c['lines'])
            self.assertEqual(written.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>'), texts[line])
        for a, b in zip(cues, cues[1:]):
            self.assertGreaterEqual(round(b['start'] - a['end'], 3), 0.1, (a['id'], b['id']))
        short = by_line['vo-short'][0]                                    # 0.6 s of VO runs on to the 1.0 s minimum
        self.assertAlmostEqual(short['end'] - short['start'], 1.0, places=3)
        # the written text, not the lexicon's spoken form (video/vo/lexicon.json)
        self.assertIn('IntelliDash', text)
        self.assertIn('3AP1', text)
        self.assertNotIn('Intelli-Dash', text)
        self.assertNotIn('A P 1', text)
        self.assertIn('17% &amp; needs &lt;more&gt; water.', text.replace('\n', ' '))

    def test_denylisted_name_fails_with_index_only(self):
        with open(os.path.join(MAPS, 'sanitize.fixture.json'), encoding='utf-8') as f:
            term = next(iter(json.load(f)))                              # an invented fixture name, index 1
        episode = load(EPISODE)
        episode['vo'][0]['text'] = f'Welcome to {term}.'
        r, out = self.run_captions('captions-denylisted.en.vtt', episode=self.write('episode-denylisted.json', episode))
        self.assertEqual(r.returncode, 1)
        self.assertIn('[denylisted #1] in VO line vo-intro', r.stderr)
        for word in term.split():
            self.assertNotIn(word.lower(), (r.stdout + r.stderr).lower())
        self.assertFalse(os.path.exists(out))

    def test_missing_report_line_fails(self):
        report = load(REPORT)
        report['lines'] = report['lines'][:-1]
        r, out = self.run_captions('captions-missing.en.vtt', report=self.write('report-missing.json', report))
        self.assertEqual(r.returncode, 1)
        self.assertIn('vo-short is missing from the VO render report', r.stderr)
        self.assertFalse(os.path.exists(out))

    def test_unplaced_episode_line_fails(self):
        timeline = load(TIMELINE)
        timeline['vo'] = timeline['vo'][:-1]
        r, _ = self.run_captions('captions-unplaced.en.vtt', timeline=self.write('timeline-unplaced.json', timeline))
        self.assertEqual(r.returncode, 1)
        self.assertIn('vo-short is in the episode but not placed', r.stderr)

    def test_no_room_for_a_cue_fails(self):
        timeline = load(TIMELINE)
        timeline['duration'] = 16.3                                     # vo-short at 15.8 s cannot hold 1.0 s
        r, _ = self.run_captions('captions-short.en.vtt', timeline=self.write('timeline-short.json', timeline))
        self.assertEqual(r.returncode, 1)
        self.assertIn('vo-short-1 lasts 0.50 s', r.stderr)

    def test_refuses_output_outside_the_media_root(self):
        r = subprocess.run([sys.executable, SCRIPT, '--timeline', TIMELINE, '--episode', EPISODE, '--report', REPORT,
                            '--out', '/tmp/sa-captions.en.vtt'], capture_output=True, text=True, env=ENV)
        self.assertEqual(r.returncode, 2)
        self.assertIn('temporary directory', r.stderr)
        self.assertFalse(os.path.exists('/tmp/sa-captions.en.vtt'))


if __name__ == '__main__':
    unittest.main()
