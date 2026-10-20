// Tests for video/lib/media-root.mjs, plus a parity check against video/lib/media_root.py.
// Nothing here writes media. The only directories created are an empty test root under the
// user's home (removed afterwards) and, for the symlink test, an empty temp directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_MEDIA_ROOT, MediaRootError, REPO_ROOT, episodeDir, mediaRoot, refusalReason, resolveReal, subdir,
} from './media-root.mjs';

const CLI = path.join(import.meta.dirname, 'media-root.mjs');
const PY_CLI = path.join(import.meta.dirname, 'media_root.py');
const HOME = os.homedir();

// SA_MEDIA_ROOT values that must be refused, with the rule each one exercises.
const REFUSED = [
  ['/tmp/a', 'temporary'],
  ['/private/tmp/a', 'temporary'],
  ['/var/folders/x/a', 'temporary'],
  ['/private/var/folders/x/a', 'temporary'],
  [path.join(os.tmpdir(), 'sa-media'), 'temporary'],
  [path.join(HOME, 'work', 'scratchpad', 'a'), 'scratchpad'],
  [path.join(HOME, 'work', 'claude-agent', 'a'), 'scratchpad'],
  [path.join(REPO_ROOT, 'video', 'out'), 'repository'],
  [REPO_ROOT, 'repository'],
];

// A temp-free path under the user's home that does not need to exist.
const ACCEPTED = path.join(HOME, 'Documents', `SpatialAdjust_MarCom_test_${process.pid}`);

function cli(file, env, runtime = process.execPath) {
  const clean = { ...process.env };
  delete clean.SA_MEDIA_ROOT;
  const res = spawnSync(runtime, [file, '--check'], { env: { ...clean, ...env }, encoding: 'utf8' });
  return { code: res.status, out: res.stdout.trim(), err: res.stderr };
}

const hasPython = spawnSync('python3', ['--version']).status === 0;

for (const [p, rule] of REFUSED) {
  test(`refuses ${p} (${rule})`, () => {
    const reason = refusalReason(p);
    assert.ok(reason, `expected a refusal for ${p}`);
    assert.match(reason, rule === 'temporary' ? /temporary directory/ : rule === 'scratchpad' ? /scratchpad/ : /repository/);
    assert.throws(() => mediaRoot({ env: { SA_MEDIA_ROOT: p } }), MediaRootError);
  });
}

test('refuses a relative SA_MEDIA_ROOT', () => {
  assert.throws(() => mediaRoot({ env: { SA_MEDIA_ROOT: 'media' } }), /not an absolute path/);
});

test('refuses a path inside another git working tree', () => {
  const tree = path.join(HOME, `.sa-media-root-gittest-${process.pid}`);
  try {
    mkdirSync(path.join(tree, '.git'), { recursive: true });
    assert.match(refusalReason(path.join(tree, 'media')), /git working tree/);
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
});

test('defaults to ~/Documents/SpatialAdjust_MarCom', () => {
  assert.equal(DEFAULT_MEDIA_ROOT, path.join(HOME, 'Documents', 'SpatialAdjust_MarCom'));
  assert.equal(mediaRoot({ env: {} }), resolveReal(DEFAULT_MEDIA_ROOT));
});

test('accepts a temp-free SA_MEDIA_ROOT under the home directory without creating it', () => {
  assert.equal(refusalReason(ACCEPTED), null);
  assert.equal(mediaRoot({ env: { SA_MEDIA_ROOT: ACCEPTED } }), resolveReal(ACCEPTED));
  assert.throws(() => statSync(ACCEPTED), { code: 'ENOENT' });
});

test('expands a leading ~ in SA_MEDIA_ROOT', () => {
  assert.equal(mediaRoot({ env: { SA_MEDIA_ROOT: '~/Documents/x-sa-test' } }), resolveReal(path.join(HOME, 'Documents', 'x-sa-test')));
});

test('a TMPDIR that contains the home directory is ignored; any other TMPDIR is refused', () => {
  assert.equal(refusalReason(ACCEPTED, { tmpdir: HOME }), null);
  assert.equal(refusalReason(ACCEPTED, { tmpdir: '/' }), null);
  assert.match(refusalReason('/opt/scratch-tmp/a', { tmpdir: '/opt/scratch-tmp' }), /temporary directory/);
});

test('CLI --check prints the default root and exits 0', () => {
  const r = cli(CLI, {});
  assert.equal(r.code, 0);
  assert.equal(r.out, resolveReal(DEFAULT_MEDIA_ROOT));
});

test('CLI --check exits 1 for every refused root', () => {
  for (const [p] of REFUSED) {
    const r = cli(CLI, { SA_MEDIA_ROOT: p });
    assert.equal(r.code, 1, p);
    assert.equal(r.out, '', p);
    assert.match(r.err, /refusing media root/, p);
  }
});

test('Python media_root.py --check behaves identically', { skip: !hasPython && 'python3 not found' }, () => {
  for (const env of [{}, { SA_MEDIA_ROOT: ACCEPTED }, { SA_MEDIA_ROOT: 'relative/x' }, ...REFUSED.map(([p]) => ({ SA_MEDIA_ROOT: p }))]) {
    const node = cli(CLI, env);
    const py = cli(PY_CLI, env, 'python3');
    assert.equal(py.code, node.code, JSON.stringify(env));
    assert.equal(py.out, node.out, JSON.stringify(env));
    assert.equal(py.err.trim(), node.err.trim(), JSON.stringify(env));
  }
});

test('episodeDir and subdir create folders under the root and refuse escapes', () => {
  const root = path.join(HOME, `.sa-media-root-test-${process.pid}`);
  const saved = process.env.SA_MEDIA_ROOT;
  process.env.SA_MEDIA_ROOT = root;
  try {
    const raw = episodeDir('pilot-1', 'capture', 'raw');
    assert.equal(raw, path.join(resolveReal(root), 'episodes', 'pilot-1', 'capture', 'raw'));
    assert.ok(statSync(raw).isDirectory());
    const auth = subdir('auth');
    assert.equal(statSync(auth).mode & 0o777, 0o700);
    assert.throws(() => subdir('renders'), MediaRootError);
    assert.throws(() => episodeDir('../escape'), MediaRootError);
    assert.throws(() => episodeDir('Bad_Id'), MediaRootError);
    assert.throws(() => episodeDir('pilot-1', '..', '..', 'x'), MediaRootError);
    assert.throws(() => episodeDir('pilot-1', '/abs'), MediaRootError);
  } finally {
    if (saved === undefined) delete process.env.SA_MEDIA_ROOT; else process.env.SA_MEDIA_ROOT = saved;
    rmSync(root, { recursive: true, force: true });
  }
});

test('a symlink cannot smuggle an episode folder into a temporary directory', () => {
  const root = path.join(HOME, `.sa-media-root-link-${process.pid}`);
  const target = mkdtempSync(path.join(os.tmpdir(), 'sa-media-link-')); // stays empty
  const saved = process.env.SA_MEDIA_ROOT;
  process.env.SA_MEDIA_ROOT = root;
  try {
    mkdirSync(root, { recursive: true });
    symlinkSync(target, path.join(root, 'episodes'));
    assert.throws(() => episodeDir('pilot-1', 'vo'), /temporary directory/);
    assert.deepEqual(readdirSync(target), [], 'nothing may be created through the link');
  } finally {
    if (saved === undefined) delete process.env.SA_MEDIA_ROOT; else process.env.SA_MEDIA_ROOT = saved;
    rmSync(root, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  }
});
