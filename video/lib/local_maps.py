"""Loads the local real-to-fictional name maps without ever exposing them.

Two gitignored files hold real names by definition:
  sanitize.local.json                flat {"real": "fictional"} used to sanitize Core Design
                                     imports (scripts/import-export.mjs)
  video/capture/overlay.local.json   {"pairs": {"real": "fictional"}, "denylist": ["real", ...]}
                                     for the IntelliDash demo data shown in captures
Paths can be overridden with SA_SANITIZE_PATH and SA_OVERLAY_PATH (or the keyword arguments).
This module implements the same contract as video/lib/local-maps.mjs; change both together.

load_local_maps() returns a LocalMaps with:
  pairs     [(real, fictional), ...] from both files, longest real first, for replacement
  denylist  every real name from both files plus the overlay's explicit denylist, unique
            (case-insensitive), in file order. Term N (1-based) is reported as [denylisted #N].

THE CONTENTS ARE SECRET. Nothing in this module prints a term. repr() and str() of the maps and
of both lists show only counts, and error messages name files and entry positions, never values.
Paths may be printed.
"""

from __future__ import annotations

import json
import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DEFAULT_SANITIZE_PATH = os.path.join(REPO_ROOT, "sanitize.local.json")
DEFAULT_OVERLAY_PATH = os.path.join(REPO_ROOT, "video", "capture", "overlay.local.json")


class LocalMapsError(Exception):
    """A local map file that cannot be used. The message never contains a term."""


class _SealedList(list):
    """A list that prints only its length."""

    def __init__(self, items, label):
        super().__init__(items)
        self._label = label

    def __repr__(self):
        return f"<{self._label} n={len(self)}>"

    __str__ = __repr__


class LocalMaps:
    __slots__ = ("pairs", "denylist", "_matcher")

    def __init__(self, pairs, denylist):
        self.pairs = _SealedList(pairs, "pairs")
        self.denylist = _SealedList(denylist, "denylist")
        self._matcher = None

    def __repr__(self):
        return f"<LocalMaps n_pairs={len(self.pairs)} n_denylist={len(self.denylist)}>"

    __str__ = __repr__


def _default_warn(msg: str) -> None:
    sys.stderr.write(f"local-maps: {msg}\n")


def _read_json(path: str, warn):
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except FileNotFoundError:
        warn(f"{path} not found; continuing without it")
        return None
    except OSError as err:
        raise LocalMapsError(f"cannot read {path} ({type(err).__name__})") from None
    try:
        return json.loads(text)
    except ValueError:
        raise LocalMapsError(f"{path} is not valid JSON") from None


def _string_pairs(obj, path: str, where: str):
    if not isinstance(obj, dict):
        raise LocalMapsError(f'{path}: {where} must be an object of "real": "fictional" strings')
    out = []
    for i, (real, fictional) in enumerate(obj.items(), start=1):
        if not isinstance(fictional, str):
            raise LocalMapsError(f"{path}: {where} entry #{i} must map to a string")
        if real.strip() == "":
            raise LocalMapsError(f"{path}: {where} entry #{i} has an empty name")
        out.append((real, fictional))
    return out


def _lower(s: str) -> str:
    # Matches JavaScript's toLowerCase() closely enough for the dedupe and lookup below.
    return s.lower()


def load_local_maps(sanitize_path: str | None = None, overlay_path: str | None = None, warn=None) -> LocalMaps:
    warn = warn or _default_warn
    s_file = sanitize_path or os.environ.get("SA_SANITIZE_PATH") or DEFAULT_SANITIZE_PATH
    o_file = overlay_path or os.environ.get("SA_OVERLAY_PATH") or DEFAULT_OVERLAY_PATH

    sanitize = _read_json(s_file, warn)
    overlay = _read_json(o_file, warn)

    sanitize_pairs = [] if sanitize is None else _string_pairs(sanitize, s_file, "the file")
    overlay_pairs = []
    explicit = []
    if overlay is not None:
        if not isinstance(overlay, dict):
            raise LocalMapsError(f'{o_file}: must be an object with "pairs" and "denylist"')
        if "pairs" in overlay:
            overlay_pairs = _string_pairs(overlay["pairs"], o_file, '"pairs"')
        if "denylist" in overlay:
            if not isinstance(overlay["denylist"], list):
                raise LocalMapsError(f'{o_file}: "denylist" must be an array of strings')
            for i, term in enumerate(overlay["denylist"], start=1):
                if not isinstance(term, str) or term.strip() == "":
                    raise LocalMapsError(f'{o_file}: "denylist" entry #{i} must be a non-empty string')
            explicit = list(overlay["denylist"])

    # Pairs: first mapping of a real name wins; longest real first so "X Club" is replaced before "X".
    seen = set()
    pairs = []
    for real, fictional in sanitize_pairs + overlay_pairs:
        if real in seen:
            continue
        seen.add(real)
        pairs.append((real, fictional))
    pairs.sort(key=lambda p: -len(p[0]))  # stable: ties keep file order

    seen_terms = set()
    denylist = []
    for term in [r for r, _ in sanitize_pairs] + [r for r, _ in overlay_pairs] + explicit:
        key = _lower(term)
        if key in seen_terms:
            continue
        seen_terms.add(key)
        denylist.append(term)

    return LocalMaps(pairs, denylist)


def _matcher(maps: LocalMaps):
    # One case-insensitive alternation, longest term first, so overlapping terms resolve to the
    # longest match and a replacement is never re-scanned.
    if maps._matcher is None:
        order = sorted(((t, i) for i, t in enumerate(maps.denylist, start=1)), key=lambda p: -len(p[0]))
        index = {_lower(t): n for t, n in order}
        pattern = re.compile("|".join(re.escape(t) for t, _ in order), re.IGNORECASE) if order else None

        def lookup(hit: str) -> int:
            n = index.get(_lower(hit))
            if n is not None:
                return n
            for t, n in order:
                if re.fullmatch(re.escape(t), hit, re.IGNORECASE):
                    return n
            return 0

        maps._matcher = (pattern, lookup)
    return maps._matcher


def find_denylisted(text: str, maps: LocalMaps):
    """Every denylisted occurrence in text as (index, offset); index is 1-based. Never the term."""
    pattern, lookup = _matcher(maps)
    if pattern is None or not text:
        return []
    return [(lookup(m.group(0)), m.start()) for m in pattern.finditer(text)]


def redact(text: str, maps: LocalMaps) -> str:
    """text with each denylisted term replaced by [denylisted #N]."""
    pattern, lookup = _matcher(maps)
    if pattern is None or not text:
        return text
    return pattern.sub(lambda m: f"[denylisted #{lookup(m.group(0))}]", text)


if __name__ == "__main__":
    # python3 video/lib/local_maps.py --summary   prints counts only, to check local setup.
    if "--summary" in sys.argv[1:]:
        print(load_local_maps())
    else:
        sys.stderr.write("Usage: python3 video/lib/local_maps.py --summary\n")
        sys.exit(64)
