// Tests for video/lib/local-maps.mjs. They always pass explicit fixture paths (and point the
// environment overrides at fixtures too), so the real sanitize.local.json and overlay.local.json
// are never opened. Fixture names are invented; even so, assertions never put a fixture real name
// into a failure message, and one test proves a logged map prints no names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { inspect } from 'node:util';
import { findDenylisted, loadLocalMaps, redact } from './local-maps.mjs';

const FIX = path.join(import.meta.dirname, 'fixtures');
const SANITIZE = path.join(FIX, 'sanitize.fixture.json');
const OVERLAY = path.join(FIX, 'overlay.fixture.json');
const MISSING = path.join(FIX, 'does-not-exist.local.json');
process.env.SA_SANITIZE_PATH = SANITIZE;
process.env.SA_OVERLAY_PATH = OVERLAY;

// The real side of every fixture pair plus the explicit denylist, as the fixtures define them.
const REAL = ['Example Real Club', 'Example Real', 'EXR-1042', 'Sample Person Name', 'Example Real Club Annex', 'Placeholder Superintendent'];
const containsReal = (s) => REAL.some((t) => s.toLowerCase().includes(t.toLowerCase()));

const quiet = () => {};
const load = (opts = {}) => loadLocalMaps({ sanitizePath: SANITIZE, overlayPath: OVERLAY, warn: quiet, ...opts });

test('pairs merge both files and sort longest real name first', () => {
  const { pairs } = load();
  assert.equal(pairs.length, 5);
  assert.deepEqual(pairs.map(([real]) => real.length), [23, 18, 17, 12, 8]);
  assert.ok(pairs.every(([, fictional]) => !containsReal(fictional)), 'fictional side must not be a real name');
});

test('denylist is the unique real names plus the explicit denylist, case-insensitive', () => {
  const { denylist } = load();
  assert.equal(denylist.length, 6, 'the lower-case duplicate in the overlay denylist is dropped');
  assert.deepEqual(new Set(denylist.map((t) => t.toLowerCase())), new Set(REAL.map((t) => t.toLowerCase())));
});

test('redact replaces every fixture name with [denylisted #N], longest match first', () => {
  const maps = load();
  const text = REAL.map((t) => `<${t}>`).join(' ') + ' and lower-case example real club';
  const out = redact(text, maps);
  assert.ok(!containsReal(out), 'redacted text still contains a fixture real name');
  // The longest match wins, so "Example Real Club Annex" is one token, not "#1 Annex".
  assert.equal(out, '<[denylisted #1]> <[denylisted #2]> <[denylisted #3]> <[denylisted #4]> <[denylisted #5]> <[denylisted #6]> and lower-case [denylisted #1]');
});

test('findDenylisted reports indices and offsets, never terms', () => {
  const maps = load();
  const hits = findDenylisted('xx Sample Person Name yy EXR-1042', maps);
  assert.deepEqual(hits, [{ index: 4, offset: 3 }, { index: 3, offset: 25 }]);
  assert.ok(!containsReal(JSON.stringify(hits)));
});

test('JSON.stringify on the maps or either list throws', () => {
  const maps = load();
  assert.throws(() => JSON.stringify(maps), /never be serialised/);
  assert.throws(() => JSON.stringify({ d: maps.denylist }), /never be serialised/);
  assert.throws(() => JSON.stringify(maps.pairs), /never be serialised/);
});

test('inspect and String show counts only', () => {
  const maps = load();
  assert.equal(String(maps), '<LocalMaps n_pairs=5 n_denylist=6>');
  assert.equal(inspect(maps), '<LocalMaps n_pairs=5 n_denylist=6>');
  assert.equal(inspect(maps.denylist), '<denylist n=6>');
  assert.equal(inspect(maps.pairs), '<pairs n=5>');
});

test('a script that logs the maps prints no fixture name', () => {
  const script = `
    import { loadLocalMaps } from ${JSON.stringify(path.join(import.meta.dirname, 'local-maps.mjs'))};
    const m = loadLocalMaps();
    console.log(m); console.log(m.denylist); console.log(m.pairs); console.error(String(m));
    console.log({ maps: m }); console.log(\`\${m.denylist}\`);
    try { JSON.stringify(m); } catch (e) { console.error(e.message); }`;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: process.env });
  assert.equal(res.status, 0);
  assert.ok(!containsReal(res.stdout + res.stderr), 'logged output contains a fixture real name');
});

test('a missing file gives an empty result and a warning naming only the path', () => {
  const warnings = [];
  const maps = loadLocalMaps({ sanitizePath: MISSING, overlayPath: MISSING, warn: (m) => warnings.push(m) });
  assert.equal(maps.pairs.length, 0);
  assert.equal(maps.denylist.length, 0);
  assert.equal(redact('unchanged text', maps), 'unchanged text');
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((w) => w.includes(MISSING)));
});

test('the environment overrides choose the files when no option is given', () => {
  const maps = loadLocalMaps({ warn: quiet });
  assert.equal(String(maps), '<LocalMaps n_pairs=5 n_denylist=6>');
});

test('malformed files fail without quoting their contents', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const os = await import('node:os');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sa-local-maps-'));
  try {
    const bad = path.join(dir, 'bad.local.json');
    writeFileSync(bad, '{"Example Real Club": "Riverbend National",');
    assert.throws(() => load({ sanitizePath: bad }), (err) => /not valid JSON/.test(err.message) && !containsReal(err.message));
    writeFileSync(bad, '{"Example Real Club": 42}');
    assert.throws(() => load({ sanitizePath: bad }), (err) => /entry #1 must map to a string/.test(err.message) && !containsReal(err.message));
    writeFileSync(bad, '{"pairs": {}, "denylist": "Example Real Club"}');
    assert.throws(() => load({ overlayPath: bad }), (err) => /"denylist" must be an array/.test(err.message) && !containsReal(err.message));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
