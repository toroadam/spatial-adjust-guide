// The capture director against the local demo app fixture: every safety layer must end the take
// with its own exit code, and no write may reach the server after arming. Uses Playwright's own
// Chromium (--launch), which the director allows only because every allowed host is loopback.
// node --test video/capture/refusal.test.mjs

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mediaRoot } from '../lib/media-root.mjs';
import { resolveFfmpeg, probeFile } from './record.mjs';
import { startFixtureServer } from './fixtures/server.mjs';

const HERE = import.meta.dirname;
const DIRECTOR = path.join(HERE, 'director.mjs');
const EPISODES = path.join(HERE, 'fixtures', 'episodes');
const LIB_FIXTURES = path.join(HERE, '..', 'lib', 'fixtures');
// Overlay and sanitize fixtures: invented names only. The leak variant shows denylist term
// "Placeholder Superintendent", which has no pair, so the overlay cannot hide it.
const OVERLAY_FIXTURE = path.join(LIB_FIXTURES, 'overlay.fixture.json');
const SANITIZE_FIXTURE = path.join(LIB_FIXTURES, 'sanitize.fixture.json');
const LEAKED = 'Placeholder Superintendent';
const REPLACED = 'Sample Person Name';

let server;
let chromiumReason = null;
let root;

before(async () => {
  try {
    const { chromium } = await import('playwright');
    const b = await chromium.launch();
    await b.close();
  } catch (err) {
    chromiumReason = `Chromium not available: ${String(err.message).split('\n')[0]}`;
  }
  root = path.join(mediaRoot(), '_tests', 'capture');
  fs.mkdirSync(root, { recursive: true });
  server = await startFixtureServer({ tileDelayMs: 0 });
});

after(async () => { await server?.close(); });

function writeConfig(name, cfg) {
  const file = path.join(root, `config-${name}.json`);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 1));
  return file;
}

const fixtureConfig = (variant = '', extra = {}) => ({
  entryUrl: `${server.origin}${variant ? `/${variant}` : ''}/spatialadjust/demo`,
  allowedHosts: [server.host],
  apiHosts: [server.host],
  signInTimeoutMs: 20000,
  settleMs: 100,
  ...extra,
});

function director(args, { env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [DIRECTOR, ...args], {
      env: { ...process.env, SA_MEDIA_ROOT: root, SA_OVERLAY_PATH: OVERLAY_FIXTURE, SA_SANITIZE_PATH: SANITIZE_FIXTURE, SA_CAPTURE_CONFIG: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

async function take(episode, { variant = '', cfg = {}, record = false, takeNo = 1 } = {}) {
  const ep = JSON.parse(fs.readFileSync(path.join(EPISODES, episode), 'utf8'));
  const config = writeConfig(ep.id, fixtureConfig(variant, cfg));
  const started = Date.now();
  const res = await director(['--episode', path.join(EPISODES, episode), '--take', String(takeNo), '--launch', ...(record ? [] : ['--no-record']), '--config', config]);
  const raw = path.join(root, 'episodes', ep.id, 'capture', 'raw');
  const safetyFile = path.join(raw, `take${takeNo}-safety.json`);
  const safety = fs.existsSync(safetyFile) && fs.statSync(safetyFile).mtimeMs >= started - 1000 ? JSON.parse(fs.readFileSync(safetyFile, 'utf8')) : null;
  const armedAt = safety?.armedAt ? Date.parse(safety.armedAt) : null;
  return { ...res, safety, raw, armedAt, started };
}

// After arming nothing but reads may reach the server; before it, only the demo sign-in.
function assertNoWrites(r) {
  const writes = server.writesSince(r.started).filter((w) => !(w.path === '/api/auth/demo' && (r.armedAt === null || w.t < r.armedAt)));
  assert.deepEqual(writes.map((w) => `${w.method} ${w.path}`), [], 'a write reached the fixture server');
}

const skip = () => chromiumReason;

test('a read-only tour runs to the end with exit 0 and Demo Mode verified', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('ok.json');
  assert.equal(r.code, 0, r.out);
  assert.equal(r.safety.exit, 0);
  assert.equal(r.safety.demoVerified, true);
  assert.equal(r.safety.demoLogins, 1);
  assert.deepEqual(r.safety.aborted, []);
  assert.ok(r.safety.overlay.replaced >= 1, 'the overlay replaced the invented real name');
  assert.ok(r.safety.scans.count >= 1);
  assert.doesNotMatch(r.out, new RegExp(`${REPLACED}|${LEAKED}`));
  assertNoWrites(r);
});

test('a selector that drifted onto Push changes is refused before the click (exit 6)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('drift.json');
  assert.equal(r.code, 6, r.out);
  assert.equal(r.safety.refusals.length, 1);
  assert.match(r.safety.refusals[0].reason, /expected "Zoom in"/);
  assertNoWrites(r);
});

test('a declared demo-mode push without a verified Demo Mode sign-in is refused (exit 6)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('push.json', { variant: 'nologin' });
  assert.equal(r.code, 6, r.out);
  assert.equal(r.safety.demoVerified, false);
  assert.match(r.safety.refusals[0].reason, /Demo Mode was not verified/);
  assertNoWrites(r);
});

test('a declared demo-mode push in verified Demo Mode is stopped in the page (exit 3)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('push.json');
  assert.equal(r.code, 3, r.out);
  assert.equal(r.safety.demoVerified, true);
  assert.ok(r.safety.trips.some((x) => x.kind === 'write' && x.method === 'POST' && x.path === '/api/push' && x.via === 'fetch'), JSON.stringify(r.safety.trips));
  assertNoWrites(r);
});

test('a form post into a frame is aborted by the request route (exit 3)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('report.json');
  assert.equal(r.code, 3, r.out);
  assert.ok(r.safety.aborted.some((x) => x.method === 'POST' && x.path === '/api/report' && x.kind === 'write'), JSON.stringify(r.safety.aborted));
  assertNoWrites(r);
});

test('a reload after arming is aborted before the new document loads (exit 4)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('reload.json');
  assert.equal(r.code, 4, r.out);
  assert.ok(r.safety.aborted.some((x) => x.kind === 'document' && x.mainFrame), JSON.stringify(r.safety.aborted));
  assertNoWrites(r);
});

test('a new window after arming is refused in the page (exit 4)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('popup.json');
  assert.equal(r.code, 4, r.out);
  assert.ok(r.safety.trips.some((x) => x.kind === 'popup'), JSON.stringify(r.safety.trips));
  assertNoWrites(r);
});

test('a WebSocket after arming ends the take (exit 3)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('socket.json');
  assert.equal(r.code, 3, r.out);
  assert.ok(r.safety.trips.some((x) => x.kind === 'websocket') || r.safety.websockets.some((x) => x.armed), JSON.stringify(r.safety));
  assertNoWrites(r);
});

test('denylisted text the overlay cannot replace ends the take by index only (exit 5)', { timeout: 120000 }, async (t) => {
  if (skip()) return t.skip(skip());
  const r = await take('ok.json', { variant: 'leak' });
  assert.equal(r.code, 5, r.out);
  assert.match(r.out, /\[denylisted #\d+\]/);
  assert.doesNotMatch(r.out, new RegExp(LEAKED, 'i'));
  assert.doesNotMatch(JSON.stringify(r.safety), new RegExp(LEAKED, 'i'));
  assert.equal(r.safety.scans.hits.length, 1);
  assertNoWrites(r);
});

test('a Demo Mode take without a denylist is refused before a browser starts (exit 5)', async () => {
  const ep = path.join(EPISODES, 'ok.json');
  const config = writeConfig('no-denylist', fixtureConfig());
  const missing = path.join(root, 'does-not-exist.json');
  const r = await director(['--episode', ep, '--take', '1', '--launch', '--no-record', '--config', config], { env: { SA_OVERLAY_PATH: missing, SA_SANITIZE_PATH: missing } });
  assert.equal(r.code, 5, r.out);
  assert.match(r.out, /denylist is empty/);
});

test('an entry URL with a query string is refused before a browser starts (exit 2)', async () => {
  const ep = path.join(EPISODES, 'ok.json');
  const config = writeConfig('bad-entry', fixtureConfig('', { entryUrl: `${server.origin}/spatialadjust/demo?x=1` }));
  const r = await director(['--episode', ep, '--take', '1', '--launch', '--no-record', '--config', config]);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /query string/);
});

test('--launch is refused while an allowed host is not loopback (exit 2)', async () => {
  const ep = path.join(EPISODES, 'ok.json');
  const config = writeConfig('remote', { entryUrl: 'https://dev.example.invalid/spatialadjust/demo', allowedHosts: ['dev.example.invalid'] });
  const r = await director(['--episode', ep, '--take', '1', '--launch', '--no-record', '--config', config]);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /--launch is refused/);
  assert.doesNotMatch(r.out, /dev\.example\.invalid/);
});

test('a CDP endpoint off loopback is refused (exit 2)', async () => {
  const ep = path.join(EPISODES, 'ok.json');
  const config = writeConfig('cdp', { entryUrl: 'https://dev.example.invalid/spatialadjust/demo', allowedHosts: ['dev.example.invalid'], cdpEndpoint: 'http://192.0.2.10:9222' });
  const r = await director(['--episode', ep, '--take', '1', '--no-record', '--config', config]);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /loopback/);
});

test('--source must match the episode (exit 2) and an invalid episode exits 65', async () => {
  const r1 = await director(['--episode', path.join(EPISODES, 'ok.json'), '--take', '1', '--source', 'recreation', '--dry-run']);
  assert.equal(r1.code, 2, r1.out);
  const r2 = await director(['--episode', path.join(LIB_FIXTURES, 'episode.invalid.push-click.json'), '--dry-run']);
  assert.equal(r2.code, 65, r2.out);
});

let ffmpeg = null;
try { ffmpeg = resolveFfmpeg(); } catch { /* the recorded take is skipped */ }

test('a recorded take writes the mp4, cue log, cursor track, contact sheet and safety report', {
  skip: !ffmpeg ? 'ffmpeg not found' : process.env.CI ? 'recorded takes are a local check; CI runs the refusals' : false,
  timeout: 600000,
}, async (t) => {
  if (skip()) return t.skip(skip());
  const ep = JSON.parse(fs.readFileSync(path.join(EPISODES, 'ok.json'), 'utf8'));
  const raw = path.join(root, 'episodes', ep.id, 'capture', 'raw');
  for (const f of ['take9.mp4', 'take9-log.json', 'take9-track.json', 'take9_sheet.jpg']) fs.rmSync(path.join(raw, f), { force: true });
  const r = await take('ok.json', { record: true, takeNo: 9 });
  assert.equal(r.code, 0, r.out);
  const info = await probeFile(path.join(raw, 'take9.mp4'));
  assert.equal(info.width, 3840);
  assert.equal(info.height, 2160);
  assert.equal(info.fps, 60);
  const cues = JSON.parse(fs.readFileSync(path.join(raw, 'take9-log.json'), 'utf8'));
  assert.deepEqual(cues.map((c) => c.id), ['open', 'map']);
  const track = JSON.parse(fs.readFileSync(path.join(raw, 'take9-track.json'), 'utf8'));
  assert.equal(track.fps, 60);
  assert.equal(track.frames.length, info.frames);
  assert.equal(track.clicks.length, 1);
  assert.ok(track.frames.some((f) => Array.isArray(f[5])), 'the highlight box appears in the focus track');
  assert.ok(fs.statSync(path.join(raw, 'take9_sheet.jpg')).size > 0);
  assert.equal(r.safety.recorded, true);
  assertNoWrites(r);
  // A take is never overwritten.
  const again = await director(['--episode', path.join(EPISODES, 'ok.json'), '--take', '9', '--launch', '--config', path.join(root, `config-${ep.id}.json`)]);
  assert.equal(again.code, 64, again.out);
});
