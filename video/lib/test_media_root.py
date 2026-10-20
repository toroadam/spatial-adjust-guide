"""Tests for video/lib/media_root.py (the Node twin is media-root.test.mjs).

Nothing here writes media. The only directories created are an empty test root under the user's
home (removed afterwards) and, for the symlink test, an empty temp directory.
"""

import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import media_root as mr  # noqa: E402

HOME = os.path.expanduser("~")
CLI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media_root.py")

REFUSED = [
    ("/tmp/a", "temporary directory"),
    ("/private/tmp/a", "temporary directory"),
    ("/var/folders/x/a", "temporary directory"),
    ("/private/var/folders/x/a", "temporary directory"),
    (os.path.join(mr.system_tmpdir(), "sa-media"), "temporary directory"),
    (os.path.join(HOME, "work", "scratchpad", "a"), "scratchpad"),
    (os.path.join(HOME, "work", "claude-agent", "a"), "scratchpad"),
    (os.path.join(mr.REPO_ROOT, "video", "out"), "repository"),
    (mr.REPO_ROOT, "repository"),
]

ACCEPTED = os.path.join(HOME, "Documents", f"SpatialAdjust_MarCom_test_{os.getpid()}")


def run_cli(env_extra):
    env = {k: v for k, v in os.environ.items() if k != "SA_MEDIA_ROOT"}
    env.update(env_extra)
    res = subprocess.run([sys.executable, CLI, "--check"], env=env, capture_output=True, text=True)
    return res.returncode, res.stdout.strip(), res.stderr


class _EnvRoot:
    """Temporarily point SA_MEDIA_ROOT at a test root under the home directory."""

    def __init__(self, root):
        self.root = root

    def __enter__(self):
        self.saved = os.environ.get("SA_MEDIA_ROOT")
        os.environ["SA_MEDIA_ROOT"] = self.root
        return self.root

    def __exit__(self, *exc):
        if self.saved is None:
            os.environ.pop("SA_MEDIA_ROOT", None)
        else:
            os.environ["SA_MEDIA_ROOT"] = self.saved
        shutil.rmtree(self.root, ignore_errors=True)


class RefusalTests(unittest.TestCase):
    def test_refused_paths(self):
        for path, why in REFUSED:
            with self.subTest(path=path):
                reason = mr.refusal_reason(path)
                self.assertIsNotNone(reason)
                self.assertIn(why, reason)
                with self.assertRaises(mr.MediaRootError):
                    mr.media_root(env={"SA_MEDIA_ROOT": path})

    def test_relative_root_refused(self):
        with self.assertRaisesRegex(mr.MediaRootError, "not an absolute path"):
            mr.media_root(env={"SA_MEDIA_ROOT": "media"})

    def test_other_git_work_tree_refused(self):
        tree = os.path.join(HOME, f".sa-media-root-gittest-py-{os.getpid()}")
        try:
            os.makedirs(os.path.join(tree, ".git"))
            self.assertIn("git working tree", mr.refusal_reason(os.path.join(tree, "media")))
        finally:
            shutil.rmtree(tree, ignore_errors=True)

    def test_tmpdir_containing_home_is_ignored(self):
        self.assertIsNone(mr.refusal_reason(ACCEPTED, tmpdir=HOME))
        self.assertIsNone(mr.refusal_reason(ACCEPTED, tmpdir="/"))
        self.assertIn("temporary directory", mr.refusal_reason("/opt/scratch-tmp/a", tmpdir="/opt/scratch-tmp"))


class RootTests(unittest.TestCase):
    def test_default(self):
        self.assertEqual(mr.DEFAULT_MEDIA_ROOT, os.path.join(HOME, "Documents", "SpatialAdjust_MarCom"))
        self.assertEqual(mr.media_root(env={}), mr.resolve_real(mr.DEFAULT_MEDIA_ROOT))

    def test_accepts_temp_free_home_path_without_creating_it(self):
        self.assertIsNone(mr.refusal_reason(ACCEPTED))
        self.assertEqual(mr.media_root(env={"SA_MEDIA_ROOT": ACCEPTED}), mr.resolve_real(ACCEPTED))
        self.assertFalse(os.path.exists(ACCEPTED))

    def test_expands_tilde(self):
        self.assertEqual(
            mr.media_root(env={"SA_MEDIA_ROOT": "~/Documents/x-sa-test"}),
            mr.resolve_real(os.path.join(HOME, "Documents", "x-sa-test")),
        )


class CliTests(unittest.TestCase):
    def test_check_default(self):
        code, out, _ = run_cli({})
        self.assertEqual(code, 0)
        self.assertEqual(out, mr.resolve_real(mr.DEFAULT_MEDIA_ROOT))

    def test_check_refused(self):
        for path, _ in REFUSED:
            with self.subTest(path=path):
                code, out, err = run_cli({"SA_MEDIA_ROOT": path})
                self.assertEqual(code, 1)
                self.assertEqual(out, "")
                self.assertIn("refusing media root", err)


class DirTests(unittest.TestCase):
    def test_episode_dir_and_subdir(self):
        with _EnvRoot(os.path.join(HOME, f".sa-media-root-test-py-{os.getpid()}")) as root:
            raw = mr.episode_dir("pilot-1", "capture", "raw")
            self.assertEqual(raw, os.path.join(mr.resolve_real(root), "episodes", "pilot-1", "capture", "raw"))
            self.assertTrue(os.path.isdir(raw))
            auth = mr.subdir("auth")
            self.assertEqual(stat.S_IMODE(os.stat(auth).st_mode), 0o700)
            for bad in (lambda: mr.subdir("renders"),
                        lambda: mr.episode_dir("../escape"),
                        lambda: mr.episode_dir("Bad_Id"),
                        lambda: mr.episode_dir("pilot-1", "..", "..", "x"),
                        lambda: mr.episode_dir("pilot-1", "/abs")):
                with self.assertRaises(mr.MediaRootError):
                    bad()

    def test_symlink_cannot_smuggle_into_tmp(self):
        target = tempfile.mkdtemp(prefix="sa-media-link-", dir=mr.system_tmpdir())  # stays empty
        try:
            with _EnvRoot(os.path.join(HOME, f".sa-media-root-link-py-{os.getpid()}")) as root:
                os.makedirs(root)
                os.symlink(target, os.path.join(root, "episodes"))
                with self.assertRaisesRegex(mr.MediaRootError, "temporary directory"):
                    mr.episode_dir("pilot-1", "vo")
                self.assertEqual(os.listdir(target), [])
        finally:
            shutil.rmtree(target, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
