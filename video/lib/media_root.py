"""The one way every Python script in the video pipeline finds where media lives.

Media (raw takes, VO, music, graphics, frames, renders) must never land in git, in a temporary
directory or in an agent scratchpad. The iCentral pipeline lost its v4 inputs to /tmp on
2026-10-06, so a temporary root is refused outright rather than discouraged. This module applies
exactly the same rules as video/lib/media-root.mjs; change both together.

Root: $SA_MEDIA_ROOT, or ~/Documents/SpatialAdjust_MarCom when it is unset. Refused when the path,
before or after resolving symlinks, is:
  - under /tmp, /private/tmp, /var/folders, /private/var/folders or the system temp directory
    ($TMPDIR, $TMP, $TEMP or /tmp, the same lookup as Node's os.tmpdir())
  - contains /scratchpad or /claude- (agent scratchpads and working directories)
  - inside this repository, or inside any other git working tree
Symlinks are resolved on the nearest existing ancestor, so a link cannot smuggle media into /tmp,
and directories are re-checked after they are created.

CLI: python3 video/lib/media_root.py --check   prints the root (exit 0) or why it is refused (exit 1).

Paths are not secrets and may be printed.
"""

from __future__ import annotations

import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DEFAULT_MEDIA_ROOT = os.path.join(os.path.expanduser("~"), "Documents", "SpatialAdjust_MarCom")
TEMP_ROOTS = ("/tmp", "/private/tmp", "/var/folders", "/private/var/folders")
AGENT_MARKERS = ("/scratchpad", "/claude-")
SUBDIRS = ("auth", "bin", "music", "logs")
EPISODE_ID = re.compile(r"^[a-z0-9-]+$")
# Standard per-episode folders, relative to <root>/episodes/<id>/.
EPISODE_LAYOUT = ("capture/raw", "vo", "gfx", "edit/_video", "edit/_audio", "frames", "renders")

_FOLD_CASE = sys.platform in ("darwin", "win32")


class MediaRootError(Exception):
    """A media root, or a folder under it, that may not hold media."""


def _fold(p: str) -> str:
    return p.lower() if _FOLD_CASE else p


def _expand_home(p: str) -> str:
    if p == "~":
        return os.path.expanduser("~")
    if p.startswith("~/"):
        return os.path.join(os.path.expanduser("~"), p[2:])
    return p


def _home() -> str:
    return os.path.expanduser("~")


def system_tmpdir() -> str:
    """Node's os.tmpdir() on POSIX: $TMPDIR, $TMP, $TEMP or /tmp, without a trailing slash."""
    for name in ("TMPDIR", "TMP", "TEMP"):
        value = os.environ.get(name)
        if value:
            break
    else:
        value = "/tmp"
    if len(value) > 1 and value.endswith("/"):
        value = value[:-1]
    return value


def is_inside(child: str, parent: str) -> bool:
    c = _fold(os.path.abspath(child))
    p = _fold(os.path.abspath(parent))
    if c == p:
        return True
    return c.startswith(p if p.endswith(os.sep) else p + os.sep)


def resolve_real(p: str) -> str:
    """Absolute path with symlinks resolved on the nearest existing ancestor; the missing tail is
    appended unchanged. Works for paths that do not exist yet."""
    absolute = os.path.abspath(_expand_home(p))
    tail: list[str] = []
    cur = absolute
    while True:
        try:
            return os.path.join(os.path.realpath(cur, strict=True), *tail)
        except (FileNotFoundError, NotADirectoryError):
            pass
        parent = os.path.dirname(cur)
        if parent == cur:
            return absolute
        tail.insert(0, os.path.basename(cur))
        cur = parent


def _git_work_tree(p: str) -> str | None:
    cur = p
    while True:
        if os.path.lexists(os.path.join(cur, ".git")):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            return None
        cur = parent


def _unique(items):
    seen = []
    for item in items:
        if item not in seen:
            seen.append(item)
    return seen


def refusal_reason(p: str, repo_root: str | None = None, tmpdir: str | None = None) -> str | None:
    """Why p may not hold media, or None when it may. Keyword arguments exist for tests."""
    repo_root = REPO_ROOT if repo_root is None else repo_root
    tmpdir = system_tmpdir() if tmpdir is None else tmpdir
    raw = os.path.abspath(_expand_home(p))
    real = resolve_real(raw)
    candidates = _unique([raw, real])

    temps = list(TEMP_ROOTS)
    if tmpdir:
        # Ignore a TMPDIR that would swallow the home directory (or "/"); the fixed roots still apply.
        for t in _unique([os.path.abspath(tmpdir), resolve_real(tmpdir)]):
            if not is_inside(_home(), t):
                temps.append(t)

    for c in candidates:
        for t in temps:
            if is_inside(c, t):
                return f"it is under the temporary directory {t}"
        lower = c.lower()
        for marker in AGENT_MARKERS:
            if marker in lower:
                return f"it is inside an agent scratchpad or working directory (path contains {marker})"

    for r in _unique([os.path.abspath(repo_root), resolve_real(repo_root)]):
        for c in candidates:
            if is_inside(c, r):
                return f"it is inside the repository {r}"

    tree = _git_work_tree(real)
    if tree:
        return f"it is inside the git working tree {tree}"
    return None


def _refuse(requested: str, source: str, reason: str) -> MediaRootError:
    return MediaRootError(
        f"refusing media root {requested} (from {source}): {reason}. "
        f"Media belongs under {DEFAULT_MEDIA_ROOT} or another permanent folder outside git; see video/README.md."
    )


def media_root(env=None, repo_root: str | None = None, tmpdir: str | None = None) -> str:
    """The media root as an absolute, symlink-resolved path. Does not create it."""
    env = os.environ if env is None else env
    from_env = env.get("SA_MEDIA_ROOT")
    source = "SA_MEDIA_ROOT" if from_env else "default"
    requested = from_env or DEFAULT_MEDIA_ROOT
    expanded = _expand_home(requested)
    if not os.path.isabs(expanded):
        raise _refuse(requested, source, "it is not an absolute path")
    reason = refusal_reason(expanded, repo_root=repo_root, tmpdir=tmpdir)
    if reason:
        raise _refuse(requested, source, reason)
    return resolve_real(expanded)


def _ensure_dir(d: str, mode: int | None = None) -> str:
    before = refusal_reason(d)
    if before:
        raise _refuse(d, "media root", before)
    os.makedirs(d, exist_ok=True)
    if mode is not None:
        os.chmod(d, mode)
    real = os.path.realpath(d, strict=True)
    after = refusal_reason(real)
    if after:
        raise _refuse(real, "media root", after)
    return real


def episode_dir(episode_id: str, *parts: str) -> str:
    """<root>/episodes/<id>/<...parts>, created if missing. parts must stay inside the episode folder."""
    if not isinstance(episode_id, str) or not EPISODE_ID.match(episode_id):
        raise MediaRootError(f"episode id must match {EPISODE_ID.pattern}")
    base = os.path.join(media_root(), "episodes", episode_id)
    for part in parts:
        if not isinstance(part, str) or part == "" or os.path.isabs(part):
            raise MediaRootError("episode path parts must be non-empty relative paths")
    d = os.path.normpath(os.path.join(base, *parts))
    rel = os.path.relpath(d, base)
    if rel.startswith("..") or os.path.isabs(rel):
        raise MediaRootError("episode path parts must stay inside the episode folder")
    return _ensure_dir(d)


def subdir(name: str) -> str:
    """<root>/<name> for the shared folders (auth, bin, music, logs), created if missing.
    auth holds browser session material, so it is private to the user."""
    if name not in SUBDIRS:
        raise MediaRootError(f"subdir must be one of {', '.join(SUBDIRS)}")
    return _ensure_dir(os.path.join(media_root(), name), 0o700 if name == "auth" else None)


def main(argv: list[str]) -> int:
    if "--check" not in argv:
        sys.stderr.write("Usage: python3 video/lib/media_root.py --check\n")
        return 64
    try:
        root = media_root()
    except MediaRootError as err:
        sys.stderr.write(f"MediaRootError: {err}\n")
        return 1
    sys.stdout.write(root + "\n")
    sys.stdout.flush()
    if not os.path.exists(root):
        sys.stderr.write("(does not exist yet; created on first use)\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
