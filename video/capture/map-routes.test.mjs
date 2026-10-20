// Tests for video/capture/map-routes.mjs and map-treatment.js on video/capture/fixtures/map-page.html.
//
// The page is opened through openMapPage (map-still.mjs), which registers a harness route before
// installMapRoutes. Playwright runs the most recently registered route first, so the harness sees
// exactly what the map routes pass on, as the capture director's request gate will. The harness
// answers tiles with a grey placeholder and aborts everything else; nothing reaches the network.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';
import {
  DEFAULT_PALETTE, MAP_POLICIES, TILE_SIZE, hexToRgb, installMapRoutes, isTileUrl, restyleTile, tileCoords,
} from './map-routes.mjs';
import { BAND_COLOURS, checkTreatment, openMapPage } from './map-still.mjs';

const SATELLITE = 'https://mt1.google.com/vt/lyrs=s&x=262143&y=262144&z=19';
const STREET = 'https://b.tile.openstreetmap.org/19/262143/262144.png';

// Decode an 8-bit RGB PNG written by encodePng (filter type 0 on every row) to its pixels.
function decodeRgb(png) {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let at = 8;
  let width; let height; const idat = [];
  while (at < png.length) {
    const len = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); assert.deepEqual([...data.subarray(8, 10)], [8, 2]); }
    if (type === 'IDAT') idat.push(data);
    at += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = (x, y) => { const o = y * (width * 3 + 1) + 1 + x * 3; return [raw[o], raw[o + 1], raw[o + 2]]; };
  return { width, height, px };
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('tileCoords recognises the two IntelliDash tile layers and nothing else', () => {
  assert.deepEqual(tileCoords(SATELLITE), { source: 'satellite', z: 19, x: 262143, y: 262144 });
  assert.deepEqual(tileCoords(STREET), { source: 'street', z: 19, x: 262143, y: 262144 });
  assert.deepEqual(tileCoords('https://mt0.google.com/vt?lyrs=y&x=1&y=2&z=3'), { source: 'satellite', z: 3, x: 1, y: 2 });
  for (const url of [
    'https://maps.google.com/maps/api/js?x=1&y=2&z=3',
    'https://mt0.google.com/maps/vt/other',
    'https://tile.openstreetmap.org/19/1/2.jpg',
    'https://example.org/19/262143/262144.png',
    'https://mt0.google.com/vt/lyrs=s&x=9&y=2&z=3', // x out of range for z 3
    'file:///tmp/19/1/2.png',
    'not a url',
  ]) assert.equal(tileCoords(url), null, url);
  assert.equal(isTileUrl(new URL(STREET)), true);
});

test('restyle tiles are deterministic PNGs in the course palette, striped when zoomed in', () => {
  const colours = new Set(Object.values(DEFAULT_PALETTE).map((h) => hexToRgb(h).join()));
  const near = restyleTile(19, 262143, 262144);
  assert.ok(near.equals(restyleTile(19, 262143, 262144)), 'same tile, same bytes');
  const img = decodeRgb(near);
  assert.deepEqual([img.width, img.height], [TILE_SIZE, TILE_SIZE]);
  const seen = new Set();
  for (let y = 0; y < TILE_SIZE; y += 7) for (let x = 0; x < TILE_SIZE; x += 7) seen.add(img.px(x, y).join());
  assert.deepEqual([...seen].filter((c) => !colours.has(c)), [], 'only palette colours');
  assert.equal(seen.size, 2, 'both turf and stripe at zoom 19');

  // Stripes run on across a tile edge: the pixel left of the seam and the pixel right of it lie
  // one step apart on the diagonal, so they agree except exactly on a stripe boundary.
  const right = decodeRgb(restyleTile(19, 262144, 262144));
  let agree = 0;
  for (let y = 0; y < TILE_SIZE; y++) if (img.px(TILE_SIZE - 1, y).join() === right.px(0, y).join()) agree++;
  assert.ok(agree >= TILE_SIZE - 12, `stripes continue across the seam (${agree} of ${TILE_SIZE} rows agree)`);

  const far = decodeRgb(restyleTile(8, 128, 128));
  const farSeen = new Set();
  for (let y = 0; y < TILE_SIZE; y += 5) for (let x = 0; x < TILE_SIZE; x += 5) farSeen.add(far.px(x, y).join());
  assert.deepEqual([...farSeen], [hexToRgb(DEFAULT_PALETTE.turf).join()], 'plain turf when stripes would alias');
});

test('restyle: every GET tile is substituted by the route; none reaches the network', async () => {
  const treated = await openMapPage(browser, 'restyle');
  const { page, map, harness } = treated;
  const tiles = await page.evaluate(() => document.querySelectorAll('img.leaflet-tile').length);
  assert.ok(tiles > 0);
  assert.equal(map.routed, true);
  assert.equal(map.stats.fulfilled, tiles);
  assert.equal(harness.tileRequests, 0);
  assert.deepEqual(await checkTreatment(treated), []);
  // The attribution for imagery no longer shown is hidden.
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.leaflet-control-attribution')).display), 'none');
  await page.close();
});

test('a non-GET request to a tile URL is passed on untouched, never fulfilled by the route', async () => {
  const { page, map, harness } = await openMapPage(browser, 'restyle');
  const before = map.stats.fulfilled;
  const results = await page.evaluate(async ([sat, street]) => {
    const out = [];
    for (const [url, method] of [[sat, 'POST'], [street, 'PUT'], [sat, 'DELETE']]) {
      try {
        const res = await fetch(url, { method, body: method === 'DELETE' ? undefined : 'payload-1' });
        out.push(`answered ${res.status}`);
      } catch {
        out.push('failed');
      }
    }
    return out;
  }, [SATELLITE, STREET]);
  assert.deepEqual(results, ['failed', 'failed', 'failed'], 'no write was answered');
  assert.equal(map.stats.fulfilled, before, 'the route fulfilled none of them');
  assert.equal(map.stats.passedOn, 3);
  assert.deepEqual(harness.aborted.map(({ method, url, postData }) => [method, url, postData]), [
    ['POST', SATELLITE, 'payload-1'],
    ['PUT', STREET, 'payload-1'],
    ['DELETE', SATELLITE, null],
  ], 'each reached the next handler exactly as sent');
  await page.close();
});

test('blur: no route, tiles load as usual, only the tile pane is blurred', async () => {
  const treated = await openMapPage(browser, 'blur');
  const { page, map, harness } = treated;
  assert.equal(map.routed, false);
  assert.equal(map.stats.fulfilled, 0);
  const tiles = await page.evaluate(() => document.querySelectorAll('img.leaflet-tile').length);
  assert.equal(harness.tileRequests, tiles, 'every tile passed through to the next handler');
  const filters = await page.evaluate(() => ['tile', 'overlay', 'marker']
    .map((p) => getComputedStyle(document.querySelector(`.leaflet-${p}-pane`)).filter));
  assert.match(filters[0], /blur\(\d+px\)/);
  assert.deepEqual(filters.slice(1), ['none', 'none']);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.leaflet-control-attribution')).display), 'none',
    'provider imagery is still shown, so its attribution stays');
  assert.deepEqual(await checkTreatment(treated), []);
  await page.close();
});

test('frame-out: no route, nothing changes on screen, bounds() locates the map', async () => {
  const { page, map } = await openMapPage(browser, 'frame-out');
  assert.equal(map.routed, false);
  const got = await page.evaluate(() => ({
    bounds: window.__saMap.bounds(),
    filter: getComputedStyle(document.querySelector('.leaflet-tile-pane')).filter,
    policy: window.__saMap.policy,
  }));
  assert.deepEqual(got, { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, filter: 'none', policy: 'frame-out' });
  await page.close();
});

test('owned imagery: needs a licence reference, serves owned tiles, falls back to restyle, never to the network', async () => {
  const probe = await browser.newPage();
  await assert.rejects(installMapRoutes(probe, 'owned-imagery', { tilesDir: path.join(import.meta.dirname, 'fixtures', 'no-tiles-here') }), /licence reference/);
  await probe.close();

  const owned = restyleTile(19, 1, 1, { turf: '#123456', stripe: '#123456' });
  const readTile = (z, x, y) => (x === 262143 && y === 262144 ? owned : null);
  const { page, map, harness } = await openMapPage(browser, 'owned-imagery', { routeOptions: { licence: 'test', readTile } });
  const tiles = await page.evaluate(() => document.querySelectorAll('img.leaflet-tile').length);
  assert.equal(map.stats.fulfilled, tiles);
  assert.equal(map.stats.owned, 2, 'the owned tile, once per layer');
  assert.equal(map.stats.missingOwned, tiles - 2);
  assert.equal(harness.tileRequests, 0);
  await page.close();
});

test('an unknown policy is refused', async () => {
  const page = await browser.newPage();
  await assert.rejects(installMapRoutes(page, 'satellite'), /mapPolicy must be one of/);
  assert.deepEqual(MAP_POLICIES, ['blur', 'restyle', 'owned-imagery', 'frame-out']);
  await page.close();
});

test('station colours stay in the moisture bands of SpatialAdjustApp.dc.html:315', () => {
  const app = readFileSync(path.join(import.meta.dirname, '..', '..', 'SpatialAdjustApp.dc.html'), 'utf8').split('\n')[314];
  for (const colour of BAND_COLOURS) assert.ok(app.includes(colour), `${colour} is a band colour in the app`);
  const treatment = readFileSync(path.join(import.meta.dirname, 'map-treatment.js'), 'utf8');
  for (const colour of BAND_COLOURS) assert.ok(treatment.includes(colour), `${colour} is listed in map-treatment.js`);
});
