// Fixture media for browser tests of the media panel (src/media.js), on a normal build.
//
//   import { installMediaFixture } from './lib/media-fixture.mjs';
//   const fixture = await installMediaFixture(page, { keys: ['dashboard-overview', 'showcase'] });
//   await page.goto(url + '#/dashboard-overview');
//
// Call it before the first navigation. It does two things:
//
//   1. An init script sets window.__saMediaManifest, which src/media.js prefers to the manifest
//      build.mjs injected, to a runtime-shaped manifest (the shape build.mjs writes) whose every path
//      is under media/__fixture__/. The same pattern as window.__saFeedbackEndpoint: no special build.
//   2. page.route('**/media/__fixture__/**') answers those paths: the video (the real ffmpeg
//      placeholder from npm run media:placeholder when it exists, deterministic dummy bytes otherwise,
//      as video/mp4, honouring Range), a 1x1 PNG poster, and per-locale WebVTT tracks generated with
//      src/media/captions.mjs from scripts/fixtures/media/placeholder.en-us.vtt and the fixture
//      catalogues in scripts/fixtures/media/captions/. Anything else under the prefix is a 404.
//
// The page asks for the paths relative to itself, so every fixture request goes to the page's own
// origin and the zero-external-origins checks stay meaningful. `requests` lists every URL served.
//
// Playwright's bundled Chromium cannot decode H.264/AAC, so tests drive the player with synthetic
// play and ended events, which media.js's capture-phase listeners handle exactly like real ones.
// Dummy bytes are enough for that: they are never decoded.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CAPTION_LOCALES, captionTracks, loadCaptionCatalogues } from '../../src/media/captions.mjs';
import { parseRange } from './static-server.mjs';

const ROOT = join(import.meta.dirname, '..', '..');

export const FIXTURE_PREFIX = 'media/__fixture__/';
export const FIXTURE_DURATION = 8;
export const DEFAULT_FIXTURE_KEYS = ['dashboard-overview', 'showcase'];
export const PLACEHOLDER_VIDEO = join(ROOT, '.media-fixture', 'placeholder.mp4');
export const PLACEHOLDER_CAPTIONS = 'scripts/fixtures/media/placeholder.en-us.vtt';
export const FIXTURE_CATALOGUES = 'scripts/fixtures/media/captions';

const KEY = /^[a-z0-9-]+$/;

// A 1x1 PNG. Enough for a poster the browser loads and paints.
const POSTER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Deterministic bytes that look like an MP4 to a content sniffer (a leading ftyp box) and decode as
 * nothing. Used when ffmpeg has not produced the real placeholder, and by
 * npm run media:placeholder -- --dummy.
 */
export function dummyVideoBytes(size = 65536) {
  const buf = Buffer.alloc(size);
  buf.writeUInt32BE(24, 0);
  buf.write('ftypisom', 4, 'latin1');
  buf.writeUInt32BE(512, 12);
  buf.write('isomavc1', 16, 'latin1');
  let x = 0x2545f491;
  for (let i = 24; i < size; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    buf[i] = x >>> 24;
  }
  return buf;
}

/** The runtime manifest the page is given: the shape build.mjs injects, every path under the prefix. */
export function fixtureManifest(keys = DEFAULT_FIXTURE_KEYS) {
  const items = {};
  for (const key of keys) {
    if (!KEY.test(key)) throw new Error(`media fixture key "${key}" must be lowercase letters, digits and "-"`);
    items[key] = {
      kind: key === 'showcase' ? 'showcase' : 'episode',
      src: `${FIXTURE_PREFIX}${key}.mp4`,
      type: 'video/mp4',
      poster: `${FIXTURE_PREFIX}${key}.png`,
      duration: FIXTURE_DURATION,
      captions: Object.fromEntries(CAPTION_LOCALES.map((locale) => [locale, `${FIXTURE_PREFIX}captions/${key}.${locale}.vtt`])),
    };
  }
  return { items };
}

let tracksOnce = null;
/** The eleven fixture caption tracks, { <locale>: <WebVTT text> }, the same for every key. */
export function fixtureTracks() {
  tracksOnce ??= (async () => {
    const source = await readFile(join(ROOT, PLACEHOLDER_CAPTIONS), 'utf8');
    const { catalogues } = await loadCaptionCatalogues(join(ROOT, FIXTURE_CATALOGUES));
    return captionTracks(source, catalogues);
  })();
  return tracksOnce;
}

function fulfillVideo(route, bytes) {
  const range = parseRange(route.request().headers().range, bytes.length);
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' };
  if (range === 'unsatisfiable') {
    return route.fulfill({ status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` }, body: '' });
  }
  if (!range) return route.fulfill({ status: 200, headers, body: bytes });
  return route.fulfill({
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}` },
    body: bytes.subarray(range.start, range.end + 1),
  });
}

/**
 * Inject the fixture manifest into `page` and serve its media. `keys` are guide keys or "showcase".
 * Returns { manifest, tracks, requests, realVideo }: the manifest the page sees, the WebVTT text per
 * locale, every URL served so far (a live array), and whether the real placeholder clip is in use.
 */
export async function installMediaFixture(page, { keys = DEFAULT_FIXTURE_KEYS } = {}) {
  const manifest = fixtureManifest(keys);
  const tracks = await fixtureTracks();
  const realVideo = existsSync(PLACEHOLDER_VIDEO);
  const video = realVideo ? await readFile(PLACEHOLDER_VIDEO) : dummyVideoBytes();
  const requests = [];

  await page.addInitScript((m) => { window.__saMediaManifest = m; }, manifest);
  await page.route(`**/${FIXTURE_PREFIX}**`, (route) => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    const at = url.pathname.indexOf(`/${FIXTURE_PREFIX}`);
    const rest = at === -1 ? '' : url.pathname.slice(at + FIXTURE_PREFIX.length + 1);
    let m;
    if ((m = /^captions\/([a-z0-9-]+)\.([a-z]{2}-[a-z]{2})\.vtt$/.exec(rest)) && keys.includes(m[1]) && tracks[m[2]]) {
      return route.fulfill({ status: 200, contentType: 'text/vtt; charset=utf-8', body: tracks[m[2]] });
    }
    if ((m = /^([a-z0-9-]+)\.png$/.exec(rest)) && keys.includes(m[1])) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: POSTER_PNG });
    }
    if ((m = /^([a-z0-9-]+)\.mp4$/.exec(rest)) && keys.includes(m[1])) return fulfillVideo(route, video);
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  });
  return { manifest, tracks, requests, realVideo };
}
