"""Tests for lib/cards.py and lib/layers/dctitle.py: the lockup, title card, chapter card and chapter strip.

  python3 video/edit/tests/test_cards.py

Builds a 7 s 16:9 timeline (lockup on the hero wall, a title card, a typed chapter card, a two-chapter glass strip), renders
stills at four times with video/edit/render.py --still and checks them: each still is not uniform, the episode name is absent
just before t_pop and present after it, and the lockup matches the reference geometry of assets/sa/sa-header-logo.png. Unit
tests pin the ported spring and squish maths to values computed from the iCentral source, check the dctitle layer registers
through the registry, that no weight 600 is asked for, that every SFX cue is in the motion system's set, and that a card too
short for its words is refused. Stills land under <media root>/episodes/_test/; nothing is written to the repository.

Runs in the pipeline Python (see _pipeline.py); skips, naming what is missing, without ffmpeg, node or Playwright Chromium.
"""
import json
import os
import re
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402

NAME = 'cards-16x9'
STILLS = dict(lockup=0.9, before_pop=2.15, after_pop=2.9, chapter=6.6)
POP = 2.2

# _spring(dt) and _squish(t, [1.74, 1.90]) from iCentral MarCom double-clicks/tools/dctitle.py (snapshot 2026-10-19 10:24:46)
SPRING = {0.0: 0.0, 0.05: 0.2202910342910709, 0.1: 0.6481387568940878, 0.2: 1.2057034803891806, 0.3: 1.1453779434199751,
          0.5: 0.9529715392574606, 1.0: 0.9983450437206083}
SQUISH = {0.0: 1.0, 1.74: 1.0, 1.78: 0.9834173568652423, 1.85: 1.0104909908091741, 1.9: 1.0047839951266457,
          2.0: 1.0083461359861492, 2.2: 0.9993786749302412}


class SourceTest(unittest.TestCase):
    """Standard library only: runs in any Python."""

    def test_no_weight_600(self):
        for f in (os.path.join(P.LIB, 'cards.py'), os.path.join(P.LIB, 'layers', 'dctitle.py')):
            with open(f) as fh:
                self.assertNotIn('600', fh.read(), f)

    def test_renderer_code_does_not_name_dctitle(self):
        """dctitle registers itself from lib/layers; renderer.py's code (its docstring aside) never names it."""
        import ast
        with open(os.path.join(P.LIB, 'renderer.py')) as fh:
            tree = ast.parse(fh.read())
        doc = ast.get_docstring(tree, clean=False)
        names = [n.value for n in ast.walk(tree) if isinstance(n, ast.Constant) and isinstance(n.value, str) and n.value != doc]
        names += [n.id for n in ast.walk(tree) if isinstance(n, ast.Name)] + [n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)]
        self.assertFalse([x for x in names if 'dctitle' in x])


if P.IN_PIPELINE:
    class MathTest(unittest.TestCase):
        def test_spring_and_squish_match_the_source(self):
            from layers.dctitle import _spring, _squish, _bez2
            for dt, v in SPRING.items(): self.assertAlmostEqual(_spring(dt), v, places=12)
            for t, v in SQUISH.items(): self.assertAlmostEqual(_squish(t, [1.74, 1.90]), v, places=12)
            self.assertEqual(_bez2([0, 0], [10, 20], [30, 0], 0.25), [5.625, 7.5])

        def test_dctitle_registered_through_the_registry(self):
            from renderer import Renderer
            from layers import dctitle
            self.assertIs(Renderer.LAYERS['dctitle'], dctitle.dctitle)
            self.assertIn('glass', Renderer.LAYERS)

    class CardsTest(unittest.TestCase):
        timeline = None

        def setUp(self):
            P.require(self, 'ffmpeg', 'chromium')

        @classmethod
        def build(cls):
            if cls.timeline: return cls.timeline
            import cards
            from media import TEST_EPISODE, episode_dir
            from timeline import Gfx, TL
            g = Gfx(NAME, '16x9', episode=TEST_EPISODE)
            cards.lockup_assets(g, 'open'); cards.title_assets(g, 'title_test', 'Test')
            gl = cards.strip_names(g, ['Title', 'Map'])
            g.typed('ch_map', 'MAP', caps=True)
            g.render()
            T = TL(NAME, '16x9', g)
            cards.lockup(g, T, 0.0, 1.2)
            cards.title_card(g, T, 1.2, 4.6, 'Test', sub_id='title_test', t_in=0.1, t_move=0.3, click=0.8, pop=1.0, leave=1.4, out=0.3)
            cards.chapter_card(g, T, 4.6, 7.0, 'MAP', aid='ch_map')
            cards.chapter_strip(T, [dict(asset=gl[0], t_in=1.2, t_out=4.6), dict(asset=gl[1], t_in=4.6, t_out=7.0)])
            d = T.json(7.0, None, [])
            path = os.path.join(episode_dir(TEST_EPISODE, 'edit'), f'timeline-{NAME}.json')
            with open(path, 'w') as f:
                json.dump(d, f)
            cls.timeline = (path, d, g)
            return cls.timeline

        def still(self, key):
            from media import TEST_EPISODE, episode_dir
            from ff import read_png
            path, _, _ = self.build()
            out = os.path.join(episode_dir(TEST_EPISODE, 'renders'), f'{NAME}-{key}.png')
            if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(path):
                r = subprocess.run([sys.executable, P.RENDER, '--timeline', path, '--still', str(STILLS[key]), '--out', out],
                                   cwd=P.REPO, capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-4000:])
            import media_root
            self.assertTrue(media_root.is_inside(os.path.realpath(out), os.path.join(media_root.media_root(), 'episodes', '_test')))
            return read_png(out)[..., :3].astype(float)

        def test_timeline_layers_and_cues(self):
            from brand import BRAND
            _, d, _ = self.build()
            types = [L['type'] for L in d['layers']]
            for t in ('wall', 'logo', 'image', 'dctitle', 'text', 'glass'):
                self.assertIn(t, types)
            glass = next(L for L in d['layers'] if L['type'] == 'glass')
            self.assertEqual(glass['box'], list(BRAND['layout']['strip']['box']))
            title = next(L for L in d['layers'] if L['type'] == 'dctitle')
            self.assertAlmostEqual(title['t_pop'], POP)
            self.assertEqual(title['drop'], BRAND['title_card']['drop'])
            for _, cue in d['sfx']:
                self.assertIn(cue.split(':')[0], BRAND['sfx_levels'], cue)
            typed = [L for L in d['layers'] if L['type'] == 'text' and L.get('anim') == 'type']
            self.assertTrue(typed and all(L['cursor_color'] == BRAND['type_cursor'] for L in typed))

        def test_four_stills_are_not_uniform(self):
            for key in STILLS:
                a = self.still(key)
                self.assertEqual(a.shape[:2], (1080, 1920))
                self.assertGreater(a.std(), 8.0, key)

        def test_sub_appears_after_t_pop(self):
            import numpy as np
            before, after = self.still('before_pop'), self.still('after_pop')
            # the episode name settles under the word, in the lower middle of the frame; white text is far brighter than the wall
            zone = (slice(610, 700), slice(780, 1100))
            ink = lambda a: float((a[zone].min(axis=2) > 200).mean())
            self.assertLess(ink(before), 0.002)
            self.assertGreater(ink(after), 0.02)
            self.assertTrue(np.isfinite(after).all())

        def test_lockup_matches_the_reference_geometry(self):
            import numpy as np
            from brand import LOCKUP
            a = self.still('lockup')
            red = (a[..., 0] > 180) & (a[..., 1] < 80) & (a[..., 2] < 100)
            ys, xs = np.nonzero(red)
            tx0, tx1, ty0, ty1 = xs.min(), xs.max(), ys.min(), ys.max()
            H = ty1 - ty0 + 1
            self.assertAlmostEqual(H, LOCKUP['tile_open'], delta=3)
            light = a.min(axis=2) > 200
            light[:, :tx1 + 4] = False
            cols = np.nonzero(light[ty0:ty1].any(0))[0]
            s0 = cols.min()                                     # the S's first ink column
            run = cols[cols < s0 + 0.4 * H]                      # the S itself
            srows = np.nonzero(light[ty0 - 20:ty1 + 20, run.min():run.max() + 1].any(1))[0] + ty0 - 20
            self.assertAlmostEqual((s0 - tx1 - 1) / H, LOCKUP['gap_ratio'], delta=0.02)
            self.assertAlmostEqual((srows.max() - srows.min() + 1) / H, 28 / 63, delta=0.03)       # cap height, header logo
            self.assertAlmostEqual((srows.max() + srows.min()) / 2, (ty0 + ty1) / 2, delta=3)     # caps centred on the tile
            ink_x = np.nonzero((red | (a.min(axis=2) > 200))[ty0:ty1].any(0))[0]
            self.assertAlmostEqual((ink_x.min() + ink_x.max()) / 2, 960, delta=4)                  # the lockup is centred

    class HoldTest(unittest.TestCase):
        def setUp(self):
            P.require(self, 'ffmpeg', 'chromium')

        def test_short_cards_are_refused(self):
            import cards
            path, d, g = CardsTest.build()
            from timeline import TL
            T = TL('hold-test', '16x9', g)
            with self.assertRaisesRegex(ValueError, 'too short'):
                cards.chapter_card(g, T, 0.0, 1.0, 'MAP', aid='ch_map')
            with self.assertRaisesRegex(ValueError, 'readable for'):
                cards.title_card(g, T, 0.0, 2.6, 'Test', sub_id='title_test', t_in=0.1, t_move=0.3, click=0.8, pop=1.0, leave=1.4, out=0.3)
            self.assertEqual(T.L, [])
            t1 = cards.chapter_card(g, T, 0.0, None, 'MAP', aid='ch_map')
            self.assertGreaterEqual(t1, 1.7)
            self.assertEqual(cards.card_hold_problems([('Read the map', 0.0, 2.4)]), [])
            self.assertEqual(len(cards.card_hold_problems([('Read the map', 0.0, 2.3)])), 1)
else:
    class CardsInPipeline(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
