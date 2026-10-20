"""render.py refuses output paths outside the media root before it renders anything.

Standard library only: render.py checks its output path before torch is imported, so this runs in any Python 3.10+.
Nothing is written except one small timeline JSON under <media root>/episodes/_test/edit.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402
import media  # noqa: E402  (lib/media.py, on sys.path through _pipeline)

HOME = os.path.expanduser('~')


class RenderPathsTest(unittest.TestCase):
    def run_render(self, video_out, *extra):
        d = media.episode_dir(media.TEST_EPISODE, 'edit')
        tl = os.path.join(d, 'timeline-paths.json')
        with open(tl, 'w') as f:
            json.dump(dict(name='paths', w=64, h=36, fps=60, duration=0.1, layers=[], video_out=video_out), f)
        return subprocess.run([sys.executable, P.RENDER, '--timeline', tl, *extra], capture_output=True, text=True)

    def assertRefused(self, video_out, why, *extra):
        r = self.run_render(video_out, *extra)
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn('refusing', r.stderr)
        self.assertIn(why, r.stderr)
        self.assertFalse(os.path.exists(video_out), video_out)

    def test_temporary_directories(self):
        self.assertRefused('/tmp/sa-render-test/out.mp4', 'temporary directory')
        self.assertRefused('/private/tmp/sa-render-test/out.mp4', 'temporary directory')
        self.assertRefused(os.path.join(tempfile.gettempdir(), 'sa-render-test', 'out.mp4'), 'temporary directory')

    def test_scratchpad(self):
        self.assertRefused(os.path.join(HOME, 'work', 'scratchpad', 'out.mp4'), 'scratchpad')
        self.assertRefused(os.path.join(HOME, 'work', 'claude-agent', 'out.mp4'), 'scratchpad')

    def test_repository(self):
        self.assertRefused(os.path.join(P.REPO, 'video', 'edit', 'out.mp4'), 'repository')

    def test_outside_media_root(self):
        self.assertRefused(os.path.join(HOME, f'sa-render-not-media-{os.getpid()}', 'out.mp4'), 'not under the media root')

    def test_out_and_still_are_checked_too(self):
        ok = os.path.join(media.episode_dir(media.TEST_EPISODE, 'edit', '_video'), 'paths.mp4')
        self.assertRefused('/tmp/sa-render-test/still.png', 'temporary directory', '--still', '0', '--out', '/tmp/sa-render-test/still.png')
        r = self.run_render(ok, '--out', os.path.join(P.REPO, 'out.mp4'))
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn('repository', r.stderr)


if __name__ == '__main__':
    unittest.main()
