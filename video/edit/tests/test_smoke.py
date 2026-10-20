"""End-to-end smoke test of the ported compositor: synthetic take -> timeline -> render.py -> H.264.

  python3 video/edit/tests/test_smoke.py

Builds a 2 s 16:9 timeline with TL (the bloom wallpaper, one window shot of the testsrc2 take from make_test_clip.py with
its capture-format cursor track, a glass chapter strip with two segments, and one typed label), renders it with
video/edit/render.py and checks it with ffprobe: 2.0 +/- 0.05 s, 1920x1080, h264 High, yuv420p, 60 fps. Then renders a
--still at t = 1.0 and checks it is not uniform. No IntelliDash, VO or music. Everything lands under
<media root>/episodes/_test; nothing is written to the repository or a temporary directory.

Skips, naming what is missing, without torch (and no pipeline Python to delegate to), ffmpeg, node or Playwright Chromium.
"""
import json
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402

NAME = 'smoke-16x9'

if P.IN_PIPELINE:
    class SmokeTest(unittest.TestCase):
        @classmethod
        def setUpClass(cls):
            cls.timeline = None

        def setUp(self):
            P.require(self, 'ffmpeg', 'chromium')

        def build(self):
            if SmokeTest.timeline: return SmokeTest.timeline
            import make_test_clip
            from media import TEST_EPISODE, episode_dir
            from theme import THEME
            from timeline import Gfx, TL
            from dc_camplan import FLAT
            clip, trk = make_test_clip.make()
            with open(trk) as f:
                take = json.load(f)
            g = Gfx(NAME, '16x9', episode=TEST_EPISODE)
            lab = g.typed('smoke_lab', 'Smoke test', caps=True)
            gl = f'font-weight:500;font-size:19px;letter-spacing:0.02em;color:{THEME["white"]};line-height:1.2'
            g.add('gl0', 'Status tiles', gl, pad=2)
            g.add('gl1', 'Map', gl, pad=2)
            g.render()
            T = TL(NAME, '16x9', g)
            T.window_shot('SMOKE-1', 'test', os.path.basename(clip), 0.0, 2.0, 0.5, 2.5, clicks=take['clicks'], track=take['frames'],
                          Z=1.7, wide_over=dict(s=0.77, pos=[962, 522], **FLAT), macro_over=FLAT, drift=None, effect='smoke: window shot')
            T.L.append(dict(type='glass', t0=0.0, t1=2.0, box=[250, 1002, 1670, 1060], r=20, blur=22,
                            segs=[dict(asset='gl0', t_in=0.0, t_out=1.0), dict(asset='gl1', t_in=1.0, t_out=2.0)],
                            opacity=[[0.0, 0.0], [0.3, 1.0, 'outCubic']]))
            w = g.m[lab[0]]['w']
            T.L.append(dict(type='text', asset=lab[0], t0=0.0, t1=2.0, pos=[round((T.W - w) / 2), 90], anim='rise', dy=26, dur_in=0.45,
                            stagger=0.07, dur_out=0.2, **{'in': 0.1, 'out': 1.8}))
            T.labels.append(dict(text='Smoke test', tin=0.1, tout=1.8, kind='label'))
            d = T.json(2.0, None, [])
            path = os.path.join(episode_dir(TEST_EPISODE, 'edit'), f'timeline-{NAME}.json')
            with open(path, 'w') as f:
                json.dump(d, f)
            SmokeTest.timeline = (path, d)
            return SmokeTest.timeline

        def render(self, *args):
            path, _ = self.build()
            r = subprocess.run([sys.executable, P.RENDER, '--timeline', path, *args], cwd=P.REPO, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-4000:])
            return r

        def test_render_h264_high_60fps(self):
            import media_root
            _, d = self.build()
            out = d['video_out']
            if os.path.exists(out): os.remove(out)
            self.render('--preset', 'veryfast')
            self.assertTrue(media_root.is_inside(os.path.realpath(out), os.path.join(media_root.media_root(), 'episodes', '_test')))
            info = P.ffprobe_json(out, '-select_streams', 'v:0', '-show_entries',
                                  'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,avg_frame_rate:format=duration')
            s = info['streams'][0]
            self.assertEqual(s['codec_name'], 'h264')
            self.assertEqual(s['profile'], 'High')
            self.assertEqual(s['pix_fmt'], 'yuv420p')
            self.assertEqual((s['width'], s['height']), (1920, 1080))
            self.assertEqual(s['r_frame_rate'], '60/1')
            self.assertEqual(s['avg_frame_rate'], '60/1')
            self.assertAlmostEqual(float(info['format']['duration']), 2.0, delta=0.05)

        def test_still_is_not_uniform(self):
            import media_root
            from media import TEST_EPISODE, episode_dir
            from ff import read_png
            out = os.path.join(episode_dir(TEST_EPISODE, 'renders'), f'{NAME}-still-1.000.png')
            if os.path.exists(out): os.remove(out)
            self.render('--still', '1.0', '--out', out)
            self.assertTrue(media_root.is_inside(os.path.realpath(out), os.path.join(media_root.media_root(), 'episodes', '_test')))
            a = read_png(out)
            self.assertEqual(a.shape[:2], (1080, 1920))
            self.assertGreater(float(a[..., :3].std()), 10.0)
            # the glass strip is drawn at 1.0 s: the first chapter is done, so its 3 px track (y 1002 + 58 * 0.74) is a white
            # bar, far brighter than the frosted glass around it, whatever the wall's palette
            track = a[1043:1047, 300:900, :3].astype(float).max(axis=0).mean(); glass = a[1020:1036, 300:900, :3].astype(float).mean()
            self.assertGreater(track, 150.0)
            self.assertGreater(track - glass, 60.0)
else:
    class SmokeTest(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
