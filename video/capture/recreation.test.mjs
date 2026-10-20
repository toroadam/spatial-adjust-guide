// The local recreation source (video/capture/recreation.mjs): the server it reuses or starts, the
// hosts the director accepts for it, a rehearsal and (locally, with ffmpeg) a recorded
// take<N>-recreation.mp4 under the media root.
// node --test video/capture/recreation.test.mjs

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { mediaRoot } from '../lib/media-root.mjs';
import { probeFile, resolveFfmpeg } from './record.mjs';
import { FRAME_ATTR, RecreationError, ensureRecreationServer, liftFigure } from './recreation.mjs';

const HERE = import.meta.dirname;
const EPISODES = path.join(HERE, 'fixtures', 'episodes');
const LIB_FIXTURES = path.join(HERE, '..', 'lib', 'fixtures');

let root;
let chromiumReason = null;
// The recreation's own port, 8124, unless something else already answers there (a developer's
// `npm run serve`, say); then a free loopback port through SA_RECREATION_PORT.
let portEnv = {};

const freePort = () => new Promise((resolve, reject) => {
  const s = createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

before(async () => {
  root = path.join(mediaRoot(), '_tests', 'capture');
  fs.mkdirSync(root, { recursive: true });
  try {
    const { chromium } = await import('playwright');
    await (await chromium.launch()).close();
  } catch (err) {
    chromiumReason = `Chromium not available: ${String(err.message).split('\n')[0]}`;
  }
  let busy = false;
  try { await fetch('http://127.0.0.1:8124/', { signal: AbortSignal.timeout(1500) }); busy = true; } catch { /* free */ }
  if (busy || process.env.SA_RECREATION_PORT) portEnv = { SA_RECREATION_PORT: process.env.SA_RECREATION_PORT || String(await freePort()) };
});

function run(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(HERE, script), ...args], {
      env: { ...process.env, SA_MEDIA_ROOT: root, SA_OVERLAY_PATH: path.join(LIB_FIXTURES, 'overlay.fixture.json'), SA_SANITIZE_PATH: path.join(LIB_FIXTURES, 'sanitize.fixture.json'), SA_CAPTURE_CONFIG: '', ...portEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

test('a recreation path that points at another host is refused before a server or browser starts (exit 2)', async () => {
  const r = await run('director.mjs', ['--episode', path.join(EPISODES, 'recreation-offhost.json'), '--take', '1', '--no-record']);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /entry refused/);
  assert.doesNotMatch(r.out, /serving dist/);
});

test('recreation.mjs always captures with --source recreation', async () => {
  const r = await run('recreation.mjs', ['--episode', path.join(EPISODES, 'ok.json'), '--take', '1', '--no-record']);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /does not match the episode's source "demo"/);
  const r2 = await run('recreation.mjs', ['--episode', path.join(EPISODES, 'ok.json'), '--source', 'demo']);
  assert.equal(r2.code, 64, r2.out);
});

test('the server reuses only a server that serves this checkout\'s dist/, and refuses anything else on the port', { timeout: 180000 }, async () => {
  const port = await freePort();
  const first = await ensureRecreationServer({ port });
  try {
    assert.equal(first.started, true);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/../package.json`)).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' })).status, 405);
    const again = await ensureRecreationServer({ port });
    assert.equal(again.started, false);
  } finally {
    await first.close();
  }
  const other = createServer((req, res) => res.end('something else'));
  const otherPort = await new Promise((resolve) => other.listen(0, '127.0.0.1', () => resolve(other.address().port)));
  try {
    await assert.rejects(ensureRecreationServer({ port: otherPort }), RecreationError);
  } finally {
    await new Promise((r) => other.close(r));
  }
});

test('a recreation rehearsal runs the episode in Playwright\'s Chromium (exit 0)', { timeout: 180000 }, async (t) => {
  if (chromiumReason) return t.skip(chromiumReason);
  const r = await run('director.mjs', ['--episode', path.join(EPISODES, 'recreation.json'), '--take', '1', '--no-record']);
  assert.equal(r.code, 0, r.out);
  const safety = JSON.parse(fs.readFileSync(path.join(root, 'episodes', 'capture-fixture-recreation', 'capture', 'raw', 'take1-recreation-safety.json'), 'utf8'));
  assert.equal(safety.source, 'recreation');
  assert.equal(safety.browser, 'launch');
  assert.equal(safety.demoVerified, false);
  assert.deepEqual(safety.aborted, []);
});

test('only a recreation episode may lift a figure: recreationFigure on a Demo Mode episode exits 65', async () => {
  const r = await run('director.mjs', ['--episode', path.join(EPISODES, 'figure-on-demo.json'), '--dry-run']);
  assert.equal(r.code, 65, r.out);
  assert.match(r.out, /only a recreation episode may set it/);
});

test('liftFigure lifts exactly one captioned figure to fill the viewport, and refuses a caption no figure has', { timeout: 180000 }, async (t) => {
  if (chromiumReason) return t.skip(chromiumReason);
  const port = await freePort();
  const srv = await ensureRecreationServer({ port });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${srv.origin}/#/dashboard-overview`, { waitUntil: 'domcontentloaded' });
    assert.match((await liftFigure(page, 'No such caption')).error, /0 figures/);
    assert.match((await liftFigure(page, ' ')).error, /start of a figure caption/);
    const lifted = await liftFigure(page, 'Map with the moisture legend.');
    assert.deepEqual(lifted, { box: [0, 0, 1920, 1080] });
    assert.equal(await page.locator(`[${FRAME_ATTR}]`).count(), 1);
    // The scoped targets the pilot uses resolve inside the lifted figure.
    const legend = page.locator(`[${FRAME_ATTR}] >> text="0-5%" >> xpath=..`).first();
    assert.ok(await legend.isVisible());
    const box = await legend.boundingBox();
    assert.ok(box.y > 540 && box.y + box.height <= 1080, `the legend sits in the lower half of the frame (${JSON.stringify(box)})`);
    // A second lift (a beat's figure action) swaps the figure: still exactly one lifted app,
    // and it is the new figure's.
    const swapped = await liftFigure(page, 'Station-level rows for hole 3');
    assert.deepEqual(swapped, { box: [0, 0, 1920, 1080] });
    assert.equal(await page.locator(`[${FRAME_ATTR}]`).count(), 1);
    assert.equal(await page.locator(`[${FRAME_ATTR}-wrap]`).count(), 1);
    const caption = await page.locator(`[${FRAME_ATTR}]`).evaluate((el) => el.closest('figure').querySelector('figcaption').textContent);
    assert.match(caption, /^\s*Station-level rows for hole 3/);
  } finally {
    await browser.close();
    await srv.close();
  }
});

test('a figure action is allowed on a recreation episode only', async () => {
  const { validateEpisode } = await import('../lib/episode-schema.mjs');
  const base = {
    id: 'figure-swap', title: 'Dashboard overview', guide: 'dashboard-overview', status: 'draft', durationTarget: [60, 180],
    source: 'recreation', mapPolicy: 'restyle',
    beats: [{ id: 'b1', hold: 1, actions: [{ type: 'figure', caption: 'Station-level rows' }, { type: 'wait', ms: 100 }] }],
  };
  assert.ok(validateEpisode(base).success);
  const demo = validateEpisode({ ...base, source: 'demo' });
  assert.ok(!demo.success);
  assert.match(demo.issues.join('\n'), /figure action .* only allowed when source is "recreation"/);
  assert.ok(!validateEpisode({ ...base, beats: [{ id: 'b1', hold: 1, actions: [{ type: 'figure' }] }] }).success);
});

test('a recreation rehearsal with a lifted figure records the lift in the safety report (exit 0)', { timeout: 180000 }, async (t) => {
  if (chromiumReason) return t.skip(chromiumReason);
  const r = await run('director.mjs', ['--episode', path.join(EPISODES, 'recreation-figure.json'), '--take', '1', '--no-record']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /lifted the figure "Map with the moisture legend\."/);
  const safety = JSON.parse(fs.readFileSync(path.join(root, 'episodes', 'capture-fixture-recreation-figure', 'capture', 'raw', 'take1-recreation-safety.json'), 'utf8'));
  assert.deepEqual(safety.frame, { figure: 'Map with the moisture legend.', box: [0, 0, 1920, 1080] });
  assert.deepEqual(safety.aborted, []);
  assert.deepEqual(safety.refusals, []);
});

let ffmpeg = null;
try { ffmpeg = resolveFfmpeg(); } catch { /* skipped below */ }

test('a recorded recreation take is take1-recreation.mp4 under the media root', {
  skip: !ffmpeg ? 'ffmpeg not found' : process.env.CI ? 'recorded takes are a local check; CI runs the refusals' : false,
  timeout: 600000,
}, async (t) => {
  if (chromiumReason) return t.skip(chromiumReason);
  const raw = path.join(root, 'episodes', 'capture-fixture-recreation', 'capture', 'raw');
  for (const f of ['take1-recreation.mp4', 'take1-recreation-log.json', 'take1-recreation-track.json', 'take1-recreation_sheet.jpg']) fs.rmSync(path.join(raw, f), { force: true });
  const r = await run('director.mjs', ['--episode', path.join(EPISODES, 'recreation.json'), '--take', '1']);
  assert.equal(r.code, 0, r.out);
  const info = await probeFile(path.join(raw, 'take1-recreation.mp4'));
  assert.equal(info.width, 3840);
  assert.equal(info.height, 2160);
  assert.equal(info.fps, 60);
  assert.ok(!fs.existsSync(path.join(raw, 'take1.mp4')), 'a recreation take never takes the Demo Mode name');
  const cues = JSON.parse(fs.readFileSync(path.join(raw, 'take1-recreation-log.json'), 'utf8'));
  assert.deepEqual(cues.map((c) => c.id), ['title', 'step']);
});
