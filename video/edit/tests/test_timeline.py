"""Tests for lib/timeline.py (Gfx, TL), lib/dc_camplan.py and gfx/render_gfx.mjs.

Renders real Golos UI assets with Playwright Chromium into <media root>/episodes/_test/gfx and checks their sizes, the
metrics dict, the 400/700 weights from the _ds font files and the 600 -> 500 mapping; then builds a window shot from a
capture-format track (6-column rows) with both planners. Runs in the pipeline Python (see _pipeline.py).
"""
import inspect
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402

TEST = '_test'


def track_rows():
    """Capture-format rows [t, x, y, a, ripple, focusBox | null] over 3 s, cursor hidden for 0.5 s, a focus box 1-2 s."""
    rows = []
    for i in range(181):
        t = round(i / 60, 4)
        hidden = 0.6 <= t < 1.1
        box = [700, 400, 1200, 700] if 1.0 <= t < 2.0 else None
        rows.append([t, None if hidden else 600 + 300 * t, None if hidden else 400 + 80 * t, 255, 0, box])
    return rows


if P.IN_PIPELINE:
    import numpy as np

    class GfxTest(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            from timeline import Gfx
            cls.Gfx = Gfx

        def setUp(self):
            P.require(self, 'ffmpeg', 'chromium')

        def ink(self, g, aid):
            from ff import read_png
            a = read_png(os.path.join(g.dir, f'{aid}.png'))
            self.assertEqual((a.shape[1], a.shape[0]), (g.m[aid]['w'], g.m[aid]['h']), f'{aid}: PNG size != metrics')
            return a[..., 3].astype(float).sum() / 255.0 / a.shape[0]        # mean inked width per row, px

        def test_typed_label_and_plain_text(self):
            import media_root
            g = self.Gfx('timeline-test', '16x9', episode=TEST)
            lab = g.typed('lab', 'Status at a glance', caps=True)
            g.add('plain', 'Plain text', 'font-weight:400;font-size:48px;color:#ffffff', words=True, pad=2)
            m = g.render()
            root = media_root.media_root()
            self.assertEqual(os.path.realpath(g.dir), os.path.join(root, 'episodes', TEST, 'gfx'))
            self.assertEqual(lab, ['lab_0'])
            for aid in ('lab_0', 'plain'):
                self.assertTrue(os.path.exists(os.path.join(g.dir, f'{aid}.png')))
                self.assertEqual(set(m[aid]), {'w', 'h', 'words', 'chars', 'parts'})
                self.assertGreater(self.ink(g, aid), 1.0, f'{aid} has no ink')
            self.assertEqual([w['text'] for w in m['lab_0']['words']], ['Status', 'at', 'a', 'glance'])
            self.assertEqual(len(m['lab_0']['chars']), len('Statusataglance'))
            self.assertGreater(m['lab_0']['h'], 132)                                # 132 px caps label plus padding
            self.assertEqual([w['text'] for w in m['plain']['words']], ['Plain', 'text'])
            self.assertEqual(m['plain']['chars'], [])
            for w in m['lab_0']['words']:
                self.assertTrue(0 <= w['x'] < m['lab_0']['w'] and w['w'] > 0)

        def test_golos_weights_from_ds(self):
            g = self.Gfx('timeline-weights', '16x9', episode=TEST)
            css = 'font-size:64px;color:#ffffff;font-weight:'
            text = 'Spatial Adjust 0123'
            for w in (400, 500, 600, 700):
                g.add(f'w{w}', text, css + str(w), pad=2)
            g.render()
            ink = {w: self.ink(g, f'w{w}') for w in (400, 500, 600, 700)}
            # Golos UI is uniwidth: the same box at every weight (a fallback face would change it) ...
            self.assertLessEqual(abs(g.m['w400']['w'] - g.m['w700']['w']), 2)
            # ... but 700 carries clearly more ink than 400
            self.assertGreater(ink[700], ink[400] * 1.15, ink)
            # 600 is not shipped: it is drawn at 500, pixel for pixel
            self.assertAlmostEqual(ink[600], ink[500], delta=0.01 * ink[500])

    class TimelineTest(unittest.TestCase):
        def setUp(self):
            P.require(self, 'ffmpeg')

        def test_no_default_music_or_track(self):
            import timeline
            sig = inspect.signature(timeline.TL.json)
            self.assertIs(sig.parameters['music'].default, inspect.Parameter.empty)
            with open(timeline.__file__) as f:
                src = f.read()
            self.assertNotIn('PremiumBeat', src)
            self.assertNotIn('TRACK =', src)
            self.assertNotIn('phase2-build', src)

        def test_window_shot_takes_capture_rows(self):
            from timeline import Gfx, TL, cursor_frames
            from dc_camplan import FLAT, dc_plan, no_drift
            from camplan import plan
            rows = track_rows()
            self.assertTrue(all(len(f) == 5 for f in cursor_frames(rows)))
            self.assertEqual(len(cursor_frames(rows)), len([f for f in rows if f[1] is not None]))
            g = Gfx('timeline-shot', '16x9', episode=TEST)
            T = TL('timeline-shot', '16x9', g)
            P1, sp = T.window_shot('S1', 'test', 'test_take.mp4', 0.0, 2.0, 0.5, 2.5, track=rows)
            self.assertAlmostEqual(sp, 1.0)
            self.assertEqual(len(P1['cam']), 120)
            plate = T.L[-1]
            self.assertEqual(plate['type'], 'plate')
            self.assertTrue(plate['file'].endswith(os.path.join('episodes', TEST, 'capture', 'raw', 'test_take.mp4')))
            self.assertEqual(T.L[-2]['type'], 'wall')
            self.assertTrue(os.path.exists(T.L[-2]['file']))
            # dc_plan reads the focus box (frame[5]): with boxes it zooms well past the box-less framing
            kw = dict(planner=dc_plan, wide_over=dict(s=0.77, **FLAT), macro_over=FLAT, drift=None)
            P2, _ = T.window_shot('S2', 'test', 'test_take.mp4', 2.0, 4.0, 0.5, 2.5, track=rows, **kw)
            P0, _ = T.window_shot('S0', 'test', 'test_take.mp4', 2.0, 4.0, 0.5, 2.5, track=[f[:5] + [None] for f in rows], **kw)
            s_box = max(c[1][2] for c in P2['cam']); s_none = max(c[1][2] for c in P0['cam'])
            self.assertGreater(s_box, s_none * 1.2)
            # the Double Click framing: FLAT plus no drift keeps the window square to the camera
            P3, _ = T.window_shot('S3', 'test', 'test_take.mp4', 4.0, 6.0, 0.5, 2.5, track=rows, planner=no_drift(plan),
                                  wide_over=dict(s=0.77, **FLAT), macro_over=FLAT)
            for k in ('rx', 'ry', 'rz'):
                self.assertTrue(all(abs(v[1]) < 1e-9 for v in P3[k]), k)

        def test_json_paths_under_media_root(self):
            import media_root
            from timeline import Gfx, TL
            g = Gfx('timeline-json', '16x9', episode=TEST)
            d = TL('timeline-json', '16x9', g).json(2.0, None, [])
            root = os.path.join(media_root.media_root(), 'episodes', TEST)
            self.assertEqual(d['video_out'], os.path.join(root, 'edit', '_video', 'timeline-json-video.mp4'))
            self.assertEqual(d['final_out'], os.path.join(root, 'renders', 'timeline-json.mp4'))
            self.assertEqual(d['mix_wav'], os.path.join(root, 'edit', '_audio', 'timeline-json-mix.wav'))
            self.assertIsNone(d['music'])
            self.assertEqual((d['engine'], d['fps'], d['w'], d['h']), (2, 60, 1920, 1080))
else:
    class TimelineTest(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
