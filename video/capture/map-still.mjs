#!/usr/bin/env node
// Renders a still of the map treatment on the test page, for the G2 record and the review.
//
//   node video/capture/map-still.mjs [--policy restyle|blur|owned-imagery|frame-out] [--version v1]
//
// Opens video/capture/fixtures/map-page.html in Playwright's own Chromium at 1920x1080, applies
// installMapRoutes (video/capture/map-routes.mjs) with the policy, checks the result and saves
//   <media root>/episodes/_stills/map-treatment-<version>.png            the decided policy
//   <media root>/episodes/_stills/map-treatment-<policy>-<version>.png   any other policy
// The decided policy is course.json map.defaultPolicy (gate G2). Standalone: no capture director,
// no IntelliDash, no network. Every tile request is answered locally (by the route under test, or
// by the harness with a grey placeholder) and every other request is aborted.
//
// Checks before saving (exit 1 and no file when one fails):
//   all policies  every station circle is filled with a moisture band colour
//   restyle, owned-imagery  every tile was answered by the route; none reached the harness
//   blur          the tile pane is blurred; the station panes are not
//
// openMapPage() is exported for video/capture/map-routes.test.mjs.

import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { mediaRoot, refusalReason } from '../lib/media-root.mjs';
import { MAP_POLICIES, TILE_SIZE, encodePng, installMapRoutes, isTileUrl } from './map-routes.mjs';

export const FIXTURE_URL = pathToFileURL(path.join(import.meta.dirname, 'fixtures', 'map-page.html')).href;
export const VIEWPORT = { width: 1920, height: 1080 };
const COURSE = JSON.parse(readFileSync(path.join(import.meta.dirname, '..', 'brand', 'course.json'), 'utf8'));
export const BAND_COLOURS = ['#E11837', '#F3D43B', '#42CE11', '#3079F0'];

let placeholder = null;
// A grey checkerboard: what the test page shows where no route substitutes a tile.
export function placeholderTile() {
  if (placeholder) return placeholder;
  const rgb = Buffer.alloc(TILE_SIZE * TILE_SIZE * 3);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      rgb.fill(((x >> 5) + (y >> 5)) % 2 ? 0x9d : 0x8a, (y * TILE_SIZE + x) * 3, (y * TILE_SIZE + x) * 3 + 3);
    }
  }
  placeholder = encodePng(TILE_SIZE, TILE_SIZE, rgb);
  return placeholder;
}

// The test page with the policy applied. harness counts the tile requests the map routes passed
// on (answered with the placeholder) and records every other request it aborted.
export async function openMapPage(browser, policy, { routeOptions = {}, viewport = VIEWPORT } = {}) {
  const page = await browser.newPage({ viewport });
  const harness = { tileRequests: 0, aborted: [] };
  // Registered before installMapRoutes, so Playwright runs it after the map routes: it only sees
  // what they pass on, like the capture director's request gate.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
    if (request.method() === 'GET' && isTileUrl(url)) {
      harness.tileRequests++;
      return route.fulfill({ status: 200, contentType: 'image/png', body: placeholderTile() });
    }
    harness.aborted.push({ method: request.method(), url, postData: request.postData() });
    return route.abort();
  });
  const map = await installMapRoutes(page, policy, routeOptions);
  await page.goto(FIXTURE_URL);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1'
    && [...document.images].every((img) => img.complete) && window.__saMap !== undefined);
  return { page, map, harness };
}

// Problems with the treated page, as messages; [] when it is right.
export async function checkTreatment({ page, map, harness }) {
  const problems = [];
  const state = await page.evaluate(() => ({
    colours: window.__saMap.markerColours(),
    tiles: document.querySelectorAll('img.leaflet-tile').length,
    broken: [...document.querySelectorAll('img.leaflet-tile')].filter((i) => i.naturalWidth !== 256).length,
    filters: Object.fromEntries(['tile', 'overlay', 'marker'].map((p) => [p, getComputedStyle(document.querySelector(`.leaflet-${p}-pane`)).filter])),
  }));
  if (!state.colours.length) problems.push('no station circles found');
  const off = state.colours.filter((c) => !BAND_COLOURS.includes(c));
  if (off.length) problems.push(`${off.length} station circle(s) not in a moisture band colour`);
  if (state.broken) problems.push(`${state.broken} tile(s) did not load`);
  if (map.routed) {
    if (map.stats.fulfilled !== state.tiles) problems.push(`the route answered ${map.stats.fulfilled} of ${state.tiles} tiles`);
    if (harness.tileRequests) problems.push(`${harness.tileRequests} tile request(s) got past the route`);
  }
  if (map.policy === 'blur' && !/blur/.test(state.filters.tile)) problems.push('the tile pane is not blurred');
  if (state.filters.overlay !== 'none' || state.filters.marker !== 'none') problems.push('a station pane is filtered');
  return problems;
}

// <media root>/episodes/_stills, created with the media-root refusal rules applied.
export function stillsDir() {
  const dir = path.join(mediaRoot(), 'episodes', '_stills');
  const before = refusalReason(dir);
  if (before) throw new Error(`refusing ${dir}: ${before}`);
  mkdirSync(dir, { recursive: true });
  const after = refusalReason(realpathSync.native(dir));
  if (after) throw new Error(`refusing ${dir}: ${after}`);
  return dir;
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { policy: { type: 'string', default: COURSE.map.defaultPolicy }, version: { type: 'string', default: 'v1' } },
  });
  const { policy, version } = values;
  if (!MAP_POLICIES.includes(policy) || !/^v\d+$/.test(version)) {
    process.stderr.write(`Usage: node video/capture/map-still.mjs [--policy ${MAP_POLICIES.join('|')}] [--version v1]\n`);
    return 64;
  }
  const name = policy === COURSE.map.defaultPolicy ? `map-treatment-${version}.png` : `map-treatment-${policy}-${version}.png`;
  const out = path.join(stillsDir(), name);

  const browser = await chromium.launch();
  try {
    const treated = await openMapPage(browser, policy, {
      routeOptions: policy === 'owned-imagery' ? { licence: 'test page only: no owned tiles, restyle fallback', readTile: () => null } : {},
    });
    const problems = await checkTreatment(treated);
    if (problems.length) {
      for (const p of problems) process.stderr.write(`map-still: ${p}\n`);
      return 1;
    }
    if (policy === 'frame-out') {
      // Show the area the director keeps out of frame.
      await treated.page.evaluate(() => {
        const b = window.__saMap.bounds();
        const box = document.createElement('div');
        box.style.cssText = `position:fixed;left:${b.x + 8}px;top:${b.y + 8}px;width:${b.width - 16}px;height:${b.height - 16}px;`
          + 'border:4px dashed #fff;z-index:9999;display:flex;align-items:flex-start;justify-content:center;'
          + 'font:600 28px system-ui;color:#fff;text-shadow:0 1px 3px #000;padding-top:24px;box-sizing:border-box';
        box.textContent = 'Kept out of frame (frame-out)';
        document.body.append(box);
      });
    }
    await treated.page.screenshot({ path: out });
    const { stats } = treated.map;
    process.stdout.write(`map-still: ${policy} -> ${out}\n`);
    process.stdout.write(`  tiles answered by the route: ${stats.fulfilled}; passed on: ${treated.harness.tileRequests}; station colours in bands: yes\n`);
    return 0;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = await main(process.argv.slice(2));
}
