"""Tests for the end card (lib/cards.py end_card, video/brand/end-card.json) and the contour wall (lib/background.py).

  python3 video/edit/tests/test_end_card.py

Config and gate tests run in any Python: end-card.json is complete and names gate G4, its URL matches the latest decided G4
row in video/approvals.md, and end_card_config refuses a final while G4 is undecided (pending, changes requested) but gives
a draft with URL PENDING APPROVAL. Render tests (pipeline Python) build a final and a draft end card against fixture
approvals tables, render a still of each and of the three walls with video/edit/render.py --still, and check that the
URL pill differs between the two, that every part sits inside title-safe, and that red appears in the lockup tile only.
Stills land under <media root>/episodes/_test/; nothing is written to the repository.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402

HEADER = '| Gate | Artifact | Version | Decision | Date | Approver | Quote / notes |\n|---|---|---|---|---|---|---|\n'


def table(*rows):
    return '# Approvals\n\n## Gates\n\n' + HEADER + ''.join(f'| {g} | a | v1 | {d} | 2026-10-19 | x | {n} |\n' for g, d, n in rows)


class Fixture:
    """A fixture approvals.md in a temporary folder (text, not media)."""

    def __init__(self, text):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, 'approvals.md')
        with open(self.path, 'w') as f:
            f.write(text)

    def __enter__(self):
        return self.path

    def __exit__(self, *a):
        self.dir.cleanup()


class ConfigTest(unittest.TestCase):
    """Standard library only."""

    def test_end_card_json_is_complete(self):
        import cards
        cfg = cards.load_end_card()
        self.assertEqual(cfg['approval'], 'G4')
        self.assertTrue(cfg['url'].startswith('https://'))
        self.assertEqual(cfg['display'], cfg['url'][len('https://'):].rstrip('/'))

    def test_bad_configs_are_refused(self):
        import cards
        good = cards.load_end_card()
        for bad, msg in ((dict(good, approval=None), 'approval'), (dict(good, approval='G3'), 'approval'),
                         (dict(good, url='http://example.invalid/'), 'https'), (dict(good, display='example.invalid'), 'display'),
                         (dict(good, cta=''), 'cta'), ({k: v for k, v in good.items() if k != 'legal'}, 'legal')):
            with self.assertRaisesRegex(cards.EndCardError, msg):
                cards.check_end_card(bad)

    def test_gate_decides_final_or_draft(self):
        import cards
        cfg = cards.load_end_card()
        cases = (('pending', None), ('changes requested', None), ('rejected', None),
                 ('decided by executor', cfg['display']), ('approved', cfg['display']))
        for decision, shown in cases:
            with self.subTest(decision=decision), Fixture(table(('G3', 'pending', '—'), ('G4', decision, 'n'))) as path:
                if shown is None:
                    with self.assertRaisesRegex(cards.EndCardError, 'G4'):
                        cards.end_card_config(cfg, approvals_path=path)
                    self.assertEqual(cards.end_card_config(cfg, draft=True, approvals_path=path)['display'], cards.PENDING_URL)
                else:
                    for draft in (False, True):
                        got = cards.end_card_config(cfg, draft=draft, approvals_path=path)
                        self.assertEqual((got['display'], got['pending']), (shown, False))

    def test_latest_g4_row_wins(self):
        import cards
        cfg = cards.load_end_card()
        with Fixture(table(('G4', 'decided by executor', 'n'), ('G4', 'changes requested', 'n'))) as path:
            with self.assertRaises(cards.EndCardError):
                cards.end_card_config(cfg, approvals_path=path)
        with Fixture(table(('G4', 'changes requested', 'n'), ('G4', 'approved', 'n'))) as path:
            self.assertFalse(cards.end_card_config(cfg, approvals_path=path)['pending'])

    def test_end_card_json_matches_the_g4_decision(self):
        """The latest decided G4 row in video/approvals.md names the address end-card.json carries."""
        import approvals
        import cards
        cfg = cards.load_end_card()
        row = approvals.latest('G4')
        self.assertIsNotNone(row, 'video/approvals.md has a G4 row')
        if row['decision'] not in approvals.DECIDED:
            self.skipTest(f'G4 is {row["decision"]}: nothing to match yet')
        self.assertIn(cfg['url'], row['notes'], 'the latest G4 decision names end-card.json url')


if P.IN_PIPELINE:
    class RenderTest(unittest.TestCase):
        NAME = 'endcard-16x9'
        built = None

        def setUp(self):
            P.require(self, 'ffmpeg', 'chromium')

        @classmethod
        def build(cls):
            """A 10 s timeline: the final end card (G4 decided in a fixture) at 0-5 s, the draft (G4 pending) at 5-10 s."""
            if cls.built: return cls.built
            import cards
            from media import TEST_EPISODE, episode_dir
            from timeline import Gfx, TL
            g = Gfx(cls.NAME, '16x9', episode=TEST_EPISODE)
            T = TL(cls.NAME, '16x9', g)
            with Fixture(table(('G4', 'decided by executor', 'n'))) as path:
                final = cards.end_card(g, T, 0.0, 5.0, approvals_path=path)
            with Fixture(table(('G4', 'pending', '—'))) as path:
                draft = cards.end_card(g, T, 5.0, None, draft=True, approvals_path=path)
            d = T.json(10.0, None, [])
            tl = os.path.join(episode_dir(TEST_EPISODE, 'edit'), f'timeline-{cls.NAME}.json')
            with open(tl, 'w') as f:
                json.dump(d, f)
            cls.built = (tl, d, g, final, draft, T)
            return cls.built

        def still(self, t, key):
            from media import TEST_EPISODE, episode_dir
            from ff import read_png
            tl = self.build()[0]
            out = os.path.join(episode_dir(TEST_EPISODE, 'renders'), f'{self.NAME}-{key}.png')
            if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(tl):
                r = subprocess.run([sys.executable, P.RENDER, '--timeline', tl, '--still', str(t), '--out', out],
                                   cwd=P.REPO, capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-4000:])
            return read_png(out)[..., :3].astype(float)

        def test_timeline(self):
            from brand import BRAND
            _, d, g, final, draft, T = self.build()
            self.assertFalse(final['draft']); self.assertTrue(draft['draft'])
            self.assertTrue(final['url'].startswith('https://')); self.assertIsNone(draft['url'])
            self.assertIn('end_url', g.m); self.assertIn('end_url_pending', g.m)
            texts = [lab['text'] for lab in d['labels']]
            self.assertIn('URL PENDING APPROVAL', texts)
            for lab in d['labels']:
                self.assertGreaterEqual(lab['tout'] - lab['tin'] + 1e-6, __import__('brand').min_hold(lab['text']) - 0.31, lab)
            self.assertTrue(any('DRAFT' in e['effect'] for e in T.edl))
            walls = [L['file'] for L in d['layers'] if L['type'] == 'wall']
            self.assertTrue(walls and all(os.path.basename(f).startswith('wall-hero-') for f in walls))
            for _, cue in d['sfx']:
                self.assertIn(cue.split(':')[0], BRAND['sfx_levels'])

        def test_stills(self):
            import numpy as np
            from brand import LAYOUT, LOCKUP
            final, draft = self.still(4.5, 'final'), self.still(9.5, 'draft')
            x0, y0, x1, y1 = LAYOUT['title_safe_box']
            for key, a in (('final', final), ('draft', draft)):
                self.assertEqual(a.shape[:2], (1080, 1920)); self.assertGreater(a.std(), 8.0, key)
                red = (a[..., 0] > 180) & (a[..., 1] < 80) & (a[..., 2] < 100)
                ys, xs = np.nonzero(red)
                self.assertAlmostEqual(ys.max() - ys.min() + 1, LOCKUP['tile_end'], delta=3, msg=f'{key}: red outside the tile')
                ink = a.min(axis=2) > 170                                   # light type and the pill's text
                ys, xs = np.nonzero(ink)
                self.assertGreaterEqual(xs.min(), x0, key); self.assertLessEqual(xs.max(), x1, key)
                self.assertGreaterEqual(ys.min(), y0, key); self.assertLessEqual(ys.max(), y1, key)
            pill = (slice(610, 720), slice(200, 1720))
            self.assertGreater(np.abs(final[pill] - draft[pill]).mean(), 2.0, 'the pending pill looks like the final one')
            blue = lambda a: ((a[..., 2] > 200) & (a[..., 0] < 90) & (a[..., 1] > 90))[pill].sum()
            self.assertGreater(blue(final), 500, 'the final pill has the blue dot')
            self.assertLess(blue(draft), 50, 'the pending pill has no blue dot')

        def test_walls_have_no_red(self):
            import numpy as np
            from background import render
            for v in ('bloom', 'card', 'hero'):
                a = render(480, 270, v) * 255
                self.assertGreater(a.std(), 2.0, v)
                self.assertFalse(((a[..., 0] > a[..., 2] + 25) & (a[..., 0] > a[..., 1] + 25)).any(), f'{v} wall has red')
            with self.assertRaises(ValueError):
                render(64, 36, 'wave')
else:
    class EndCardInPipeline(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
