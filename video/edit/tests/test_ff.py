"""ff.py resolves ffmpeg/ffprobe from $FFMPEG/$FFPROBE or PATH and refuses temporary or scratchpad builds.

Each case imports ff in a fresh interpreter (resolution happens on import). Nothing is written. Runs in the pipeline Python.
"""
import os
import shutil
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pipeline as P  # noqa: E402

HOME = os.path.expanduser('~')


def import_ff(**env):
    e = {k: v for k, v in os.environ.items() if k not in ('FFMPEG', 'FFPROBE')}
    e.update(env)
    code = 'import sys; sys.path.insert(0, sys.argv[1]); import ff; print(ff.FFMPEG); print(ff.FFPROBE)'
    return subprocess.run([sys.executable, '-c', code, P.LIB], env=e, capture_output=True, text=True)


if P.IN_PIPELINE:
    class ResolveTest(unittest.TestCase):
        def test_path_and_env(self):
            if not shutil.which('ffmpeg'): self.skipTest('ffmpeg not on PATH')
            r = import_ff()
            self.assertEqual(r.returncode, 0, r.stderr)
            ffmpeg, ffprobe = r.stdout.split()
            self.assertEqual(ffmpeg, os.path.abspath(shutil.which('ffmpeg')))
            self.assertTrue(os.path.basename(ffprobe).startswith('ffprobe'))
            r = import_ff(FFMPEG=ffmpeg)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(r.stdout.split()[0], ffmpeg)

        def test_refuses_temporary_and_scratchpad_builds(self):
            for path, why in (('/tmp/bin/ffmpeg', 'temporary directory'), ('/private/tmp/bin/ffmpeg', 'temporary directory'),
                              ('/var/folders/xy/bin/ffmpeg', 'temporary directory'),
                              (os.path.join(HOME, 'work', 'scratchpad', 'bin', 'ffmpeg'), 'scratchpad'),
                              (os.path.join(HOME, 'work', 'claude-agent', 'bin', 'ffmpeg'), 'scratchpad')):
                r = import_ff(FFMPEG=path)
                self.assertNotEqual(r.returncode, 0, path)
                self.assertIn('FFmpegError: refusing ffmpeg', r.stderr, path)
                self.assertIn(why, r.stderr, path)
            r = import_ff(FFPROBE='/tmp/bin/ffprobe')
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('refusing ffprobe', r.stderr)

        def test_refuses_a_symlink_into_tmp(self):
            import media
            link = os.path.join(media.episode_dir(media.TEST_EPISODE, 'bin'), 'ffmpeg-link')
            if os.path.lexists(link): os.remove(link)
            os.symlink('/private/tmp/sa-video-test-missing/ffmpeg', link)   # dangling: nothing is created in /tmp
            try:
                r = import_ff(FFMPEG=link)
            finally:
                os.remove(link)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('temporary directory', r.stderr)

        def test_missing(self):
            r = import_ff(FFMPEG='', PATH='/nonexistent')
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('ffmpeg not found', r.stderr)
else:
    class ResolveTest(unittest.TestCase):
        def test_in_pipeline_python(self):
            P.delegate(self, os.path.abspath(__file__))


if __name__ == '__main__':
    unittest.main()
