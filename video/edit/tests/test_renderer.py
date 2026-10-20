"""Tests for lib/renderer.py: the layer registry and its draw order. Runs in the pipeline Python (see _pipeline.py)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402

if P.IN_PIPELINE:
    class RegistryTest(unittest.TestCase):
        def setUp(self):
            P.require(self, 'ffmpeg')
            import renderer
            import dummy_layer  # noqa: F401  (registers 'test_tint' from outside lib/)
            self.R = renderer

        def tl(self, layers):
            return dict(w=64, h=36, fps=60, duration=1.0, layers=layers)

        def px(self, img):
            return [round(float(v), 3) for v in img[0, :, 18, 32].cpu()]

        def test_registered_from_outside_without_editing_renderer(self):
            self.assertIn('test_tint', self.R.Renderer.LAYERS)
            with open(self.R.__file__) as f:
                self.assertNotIn('test_tint', f.read())
            r = self.R.Renderer(self.tl([dict(type='test_tint', t0=0.0, t1=1.0, rgb=[1.0, 0.0, 0.0])]), P.EDIT)
            self.assertEqual(self.px(r.frame(0.5)), [1.0, 0.0, 0.0])

        def test_registered_layers_draw_above_base_layers(self):
            layers = [dict(type='test_tint', t0=0.0, t1=1.0, rgb=[0.0, 0.0, 1.0], opacity=0.5),
                      dict(type='solid', t0=0.0, t1=1.0, color='#ffffff')]
            r = self.R.Renderer(self.tl(layers), P.EDIT)
            self.assertEqual(self.px(r.frame(0.5)), [0.5, 0.5, 1.0])         # white base, then half blue on top
            self.assertEqual(r.tl['layers'], layers)                          # timeline restored after the frame

        def test_inactive_layer_is_skipped(self):
            layers = [dict(type='solid', t0=0.0, t1=1.0, color='#000000'), dict(type='test_tint', t0=0.6, t1=1.0, rgb=[1.0, 1.0, 1.0])]
            r = self.R.Renderer(self.tl(layers), P.EDIT)
            self.assertEqual(self.px(r.frame(0.5)), [0.0, 0.0, 0.0])
            self.assertEqual(self.px(r.frame(0.7)), [1.0, 1.0, 1.0])

        def test_glass_is_registered_and_base_names_are_refused(self):
            self.assertIn('glass', self.R.Renderer.LAYERS)
            with self.assertRaises(ValueError):
                self.R.register_layer('plate', lambda r, L, t, out: out)
            with self.assertRaises(TypeError):
                self.R.register_layer('not_callable', 3)
else:
    class RegistryTest(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
