"""Where the compositor reads and writes media: the media root rules of video/lib/media_root.py, applied to the edit step.

  episode_dir(episode, *parts)     <media root>/episodes/<episode>/<parts>, created if missing
  require_media_path(path, what)   the resolved path, or MediaRootError when it is not under the media root, or is in a
                                   temporary directory, an agent scratchpad, this repository or any other git working tree

TEST_EPISODE ('_test') is reserved for the compositor's own tests. Real episode ids match [a-z0-9-]+ (media_root.EPISODE_ID),
so the leading underscore can never collide with one; it lives at <media root>/episodes/_test like any other episode.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'lib')))
import media_root as MR  # noqa: E402

MediaRootError = MR.MediaRootError
TEST_EPISODE = '_test'


def episode_dir(episode, *parts):
    if episode != TEST_EPISODE:
        return MR.episode_dir(episode, *parts)
    base = os.path.join(MR.media_root(), 'episodes', TEST_EPISODE)
    for part in parts:
        if not isinstance(part, str) or part == '' or os.path.isabs(part):
            raise MediaRootError('episode path parts must be non-empty relative paths')
    d = os.path.normpath(os.path.join(base, *parts))
    if not MR.is_inside(d, base):
        raise MediaRootError('episode path parts must stay inside the episode folder')
    return MR._ensure_dir(d)


def require_media_path(path, what='output'):
    """Resolve path (symlinks on the nearest existing ancestor) and refuse it unless it is under the media root."""
    if not path:
        raise MediaRootError(f'{what}: no path given')
    root = MR.media_root()
    absolute = os.path.abspath(os.path.expanduser(path))
    reason = MR.refusal_reason(absolute)
    if reason:
        raise MediaRootError(f'refusing {what} {path}: {reason}. Media belongs under the media root {root}.')
    real = MR.resolve_real(absolute)
    if not MR.is_inside(real, root):
        raise MediaRootError(f'refusing {what} {path}: it is not under the media root {root}.')
    return real


def ensure_media_dir(d, what='folder'):
    """require_media_path for a folder, created if missing and re-checked after creation."""
    real = require_media_path(d, what)
    os.makedirs(real, exist_ok=True)
    return require_media_path(os.path.realpath(real), what)
