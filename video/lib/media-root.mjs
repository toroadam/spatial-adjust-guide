// The one way every Node script in the video pipeline finds where media lives.
//
// Media (raw takes, VO, music, graphics, frames, renders) must never land in git, in a temporary
// directory or in an agent scratchpad. The iCentral pipeline lost its v4 inputs to /tmp on
// 2026-10-06, so a temporary root is refused outright rather than discouraged. video/lib/media_root.py
// applies exactly the same rules for Python; change both together.
//
// Root: $SA_MEDIA_ROOT, or ~/Documents/SpatialAdjust_MarCom when it is unset. Refused when the
// path, before or after resolving symlinks, is:
//   - under /tmp, /private/tmp, /var/folders, /private/var/folders or os.tmpdir()
//   - contains /scratchpad or /claude- (agent scratchpads and working directories)
//   - inside this repository, or inside any other git working tree
// Symlinks are resolved on the nearest existing ancestor, so a link cannot smuggle media into /tmp,
// and directories are re-checked after they are created.
//
// CLI: node video/lib/media-root.mjs --check   prints the root (exit 0) or why it is refused (exit 1).
//
// Paths are not secrets and may be printed.

import { existsSync, lstatSync, mkdirSync, realpathSync, chmodSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const DEFAULT_MEDIA_ROOT = path.join(os.homedir(), 'Documents', 'SpatialAdjust_MarCom');
export const TEMP_ROOTS = ['/tmp', '/private/tmp', '/var/folders', '/private/var/folders'];
export const AGENT_MARKERS = ['/scratchpad', '/claude-'];
export const SUBDIRS = ['auth', 'bin', 'music', 'logs'];
export const EPISODE_ID = /^[a-z0-9-]+$/;
// Standard per-episode folders, relative to <root>/episodes/<id>/.
export const EPISODE_LAYOUT = ['capture/raw', 'vo', 'gfx', 'edit/_video', 'edit/_audio', 'frames', 'renders'];

export class MediaRootError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MediaRootError';
  }
}

// macOS and Windows volumes are case-insensitive by default; compare paths the same way.
const FOLD_CASE = process.platform === 'darwin' || process.platform === 'win32';
const fold = (p) => (FOLD_CASE ? p.toLowerCase() : p);

function expandHome(p) {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function isInside(child, parent) {
  const c = fold(path.resolve(child));
  const p = fold(path.resolve(parent));
  if (c === p) return true;
  return c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
}

// Absolute path with symlinks resolved on the nearest existing ancestor; the missing tail is
// appended unchanged. Works for paths that do not exist yet.
export function resolveReal(p) {
  const abs = path.resolve(expandHome(p));
  const tail = [];
  let cur = abs;
  for (;;) {
    try {
      return path.join(realpathSync.native(cur), ...tail);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
    }
    const parent = path.dirname(cur);
    if (parent === cur) return abs;
    tail.unshift(path.basename(cur));
    cur = parent;
  }
}

// The git working tree containing p, if any: the nearest existing ancestor with a .git entry.
function gitWorkTree(p) {
  let cur = p;
  for (;;) {
    if (lstatSync(path.join(cur, '.git'), { throwIfNoEntry: false })) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

// Why p may not hold media, or null when it may. Options exist for tests.
export function refusalReason(p, { repoRoot = REPO_ROOT, tmpdir = os.tmpdir() } = {}) {
  const raw = path.resolve(expandHome(p));
  const real = resolveReal(raw);
  const candidates = [...new Set([raw, real])];

  const temps = [...TEMP_ROOTS];
  if (tmpdir) {
    // Ignore a TMPDIR that would swallow the home directory (or "/"); the fixed roots still apply.
    for (const t of new Set([path.resolve(tmpdir), resolveReal(tmpdir)])) {
      if (!isInside(os.homedir(), t)) temps.push(t);
    }
  }

  for (const c of candidates) {
    for (const t of temps) {
      if (isInside(c, t)) return `it is under the temporary directory ${t}`;
    }
    const lower = c.toLowerCase();
    for (const marker of AGENT_MARKERS) {
      if (lower.includes(marker)) return `it is inside an agent scratchpad or working directory (path contains ${marker})`;
    }
  }

  for (const r of new Set([path.resolve(repoRoot), resolveReal(repoRoot)])) {
    for (const c of candidates) {
      if (isInside(c, r)) return `it is inside the repository ${r}`;
    }
  }

  const tree = gitWorkTree(real);
  if (tree) return `it is inside the git working tree ${tree}`;
  return null;
}

function refuse(requested, source, reason) {
  return new MediaRootError(
    `refusing media root ${requested} (from ${source}): ${reason}. ` +
      `Media belongs under ${DEFAULT_MEDIA_ROOT} or another permanent folder outside git; see video/README.md.`,
  );
}

// The media root as an absolute, symlink-resolved path. Does not create it.
export function mediaRoot({ env = process.env, repoRoot, tmpdir } = {}) {
  const fromEnv = env.SA_MEDIA_ROOT;
  const source = fromEnv ? 'SA_MEDIA_ROOT' : 'default';
  const requested = fromEnv || DEFAULT_MEDIA_ROOT;
  const expanded = expandHome(requested);
  if (!path.isAbsolute(expanded)) throw refuse(requested, source, 'it is not an absolute path');
  const reason = refusalReason(expanded, { repoRoot, tmpdir });
  if (reason) throw refuse(requested, source, reason);
  return resolveReal(expanded);
}

// mkdir -p with the refusal rules applied before (through existing symlinks) and after creation.
function ensureDir(dir, mode) {
  const before = refusalReason(dir);
  if (before) throw refuse(dir, 'media root', before);
  mkdirSync(dir, { recursive: true, mode });
  if (mode !== undefined) chmodSync(dir, mode);
  const real = realpathSync.native(dir);
  const after = refusalReason(real);
  if (after) throw refuse(real, 'media root', after);
  return real;
}

// <root>/episodes/<id>/<...parts>, created if missing. parts must stay inside the episode folder.
export function episodeDir(id, ...parts) {
  if (typeof id !== 'string' || !EPISODE_ID.test(id)) {
    throw new MediaRootError(`episode id must match ${EPISODE_ID}`);
  }
  const base = path.join(mediaRoot(), 'episodes', id);
  for (const part of parts) {
    if (typeof part !== 'string' || part === '' || path.isAbsolute(part)) {
      throw new MediaRootError('episode path parts must be non-empty relative paths');
    }
  }
  const dir = path.join(base, ...parts);
  const rel = path.relative(base, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new MediaRootError('episode path parts must stay inside the episode folder');
  }
  return ensureDir(dir);
}

// <root>/<name> for the shared folders (auth, bin, music, logs), created if missing.
// auth holds browser session material, so it is private to the user.
export function subdir(name) {
  if (!SUBDIRS.includes(name)) throw new MediaRootError(`subdir must be one of ${SUBDIRS.join(', ')}`);
  return ensureDir(path.join(mediaRoot(), name), name === 'auth' ? 0o700 : undefined);
}

function main(argv) {
  if (!argv.includes('--check')) {
    process.stderr.write('Usage: node video/lib/media-root.mjs --check\n');
    return 64;
  }
  try {
    const root = mediaRoot();
    process.stdout.write(root + '\n');
    if (!existsSync(root)) process.stderr.write('(does not exist yet; created on first use)\n');
    return 0;
  } catch (err) {
    if (!(err instanceof MediaRootError)) throw err;
    process.stderr.write(`${err.name}: ${err.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolveReal(process.argv[1]) === resolveReal(import.meta.filename)) {
  process.exitCode = main(process.argv.slice(2));
}
