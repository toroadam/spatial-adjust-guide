// The recorder (video/capture/record.mjs): path and ffmpeg rules without a browser, and one real
// 2 s take of a Leaflet page on local tiles when ffmpeg and Chromium are available.
// node --test video/capture/record.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mediaRoot } from '../lib/media-root.mjs';
import { FRAME, Recorder, RecorderError, assertRawPath, contactSheet, ffmpegRefusal, probeFile, resolveFfmpeg } from './record.mjs';
import { startFixtureServer } from './fixtures/server.mjs';

const SOURCE = fs.readFileSync(path.join(import.meta.dirname, 'record.mjs'), 'utf8');

let ffmpeg = null;
try { ffmpeg = resolveFfmpeg(); } catch { /* the take test is skipped below */ }

test('takes resolve only to <media root>/episodes/<id>/capture/raw/', () => {
  const root = mediaRoot();
  const ok = path.join(root, 'episodes', 'dashboard-overview-pilot', 'capture', 'raw', 'take1.mp4');
  assert.equal(assertRawPath(ok), ok);
  assert.ok(assertRawPath(path.join(root, 'episodes', '_test', 'capture', 'raw', 'x.mp4')));
  for (const bad of [
    path.join(os.tmpdir(), 'take1.mp4'),
    path.join(import.meta.dirname, 'take1.mp4'),
    path.join(root, 'take1.mp4'),
    path.join(root, 'episodes', 'x', 'renders', 'take1.mp4'),
    path.join(root, 'episodes', 'x', 'capture', 'raw', 'take1.mov'),
    path.join(root, 'episodes', 'x', 'capture', 'raw', '..', '..', '..', '..', '..', 'take1.mp4'),
  ]) {
    assert.throws(() => assertRawPath(bad), RecorderError, bad);
  }
  assert.ok(assertRawPath(path.join(root, 'episodes', 'x', 'capture', 'raw', 'take1_sheet.jpg'), { exts: ['.jpg'] }));
});

test('ffmpeg comes from FFMPEG or PATH, never from a temporary or agent folder', () => {
  assert.match(ffmpegRefusal(path.join(os.tmpdir(), 'bin', 'ffmpeg')) ?? '', /temporary directory/);
  assert.match(ffmpegRefusal('/private/tmp/x/ffmpeg') ?? '', /temporary directory/);
  assert.match(ffmpegRefusal(path.join(os.homedir(), 'work', 'scratchpad', 'bin', 'ffmpeg')) ?? '', /agent working directory/);
  assert.equal(ffmpegRefusal('/opt/homebrew/bin/ffmpeg'), null);
  assert.throws(() => resolveFfmpeg({ env: { FFMPEG: 'ffmpeg' } }), /absolute path/);
  assert.throws(() => resolveFfmpeg({ env: { FFMPEG: path.join(os.tmpdir(), 'ffmpeg') } }), /refusing FFMPEG/);
  assert.throws(() => resolveFfmpeg({ env: { PATH: '' } }), /ffmpeg not found/);
});

test('record.mjs never navigates and names no temporary path outside its refusal check', () => {
  assert.doesNotMatch(SOURCE, /\.goto\(|\.reload\(|goBack\(|goForward\(|location\.(href|assign|replace|reload)/);
  const lines = SOURCE.split('\n');
  for (const word of ['scratchpad', '/tmp']) {
    const hits = lines.map((l, i) => [l, i + 1]).filter(([l]) => l.includes(word));
    for (const [line, n] of hits) assert.match(line, /^\s*\/\/.*(refus|scratchpad)/, `record.mjs:${n} mentions ${word} outside the refusal check`);
  }
});

test('a take outside the media root is refused before anything starts', async () => {
  const fakePage = { evaluate: async () => {}, on: () => {}, context: () => ({}) };
  const rec = new Recorder(fakePage);
  await assert.rejects(rec.take({ file: path.join(os.tmpdir(), 'take1.mp4'), seconds: 1 }), RecorderError);
});

test('records 2 s of a Leaflet map at 3840x2160, 60 fps, 120 frames under the media root', {
  skip: ffmpeg ? false : 'ffmpeg not found',
  timeout: 300000,
}, async (t) => {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { t.skip('playwright not installed'); return; }
  const server = await startFixtureServer({ tileDelayMs: 40 });
  let browser;
  try {
    try { browser = await chromium.launch(); } catch (err) { t.skip(`Chromium not available: ${err.message.split('\n')[0]}`); return; }
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const rec = new Recorder(page);
    await rec.install({ startMs: Date.UTC(2026, 9, 22, 15, 0, 0) });
    await rec.setGeometry();
    await page.goto(`${server.origin}/leaflet-page.html`); // the test owns this navigation, not the recorder
    await page.waitForFunction(() => window.__captureLeaflet?.state().tiles > 0 && window.__captureLeaflet.state().loading === 0, null, { timeout: 30000 });

    const dir = path.join(mediaRoot(), 'episodes', '_test', 'capture', 'raw');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'leaflet-take.mp4');
    const res = await rec.take({
      file, seconds: 2,
      build: (tl) => { tl.at(0, (r) => r.page.evaluate(() => window.startFixtureMotion())); },
      probe: async (r, i) => (i % 30 ? null : await r.page.evaluate(() => window.__captureLeaflet.state())),
    });
    assert.equal(res.frames, 120);
    assert.equal(res.width, FRAME.width);
    assert.equal(res.height, FRAME.height);
    assert.ok(res.settleMaxMs >= 0, `a frame never settled (settleMaxMs ${res.settleMaxMs})`);
    assert.ok(res.probe.filter(Boolean).every((s) => s.maps === 1), 'the Leaflet map was found on every probed frame');

    const info = await probeFile(file);
    assert.equal(info.codec, 'h264');
    assert.equal(info.width, 3840);
    assert.equal(info.height, 2160);
    assert.equal(info.fps, 60);
    assert.equal(info.frames, 120);
    assert.equal(info.pixFmt, 'yuv420p');

    const sheet = await contactSheet(file, path.join(dir, 'leaflet-take_sheet.jpg'), res.frames);
    assert.ok(fs.statSync(sheet).size > 0);
    await context.close();
  } finally {
    await browser?.close();
    await server.close();
  }
});
