// Map treatment for captures, Node side: keeps real map imagery out of every frame (gate G2).
//
//   installMapRoutes(page, mapPolicy, options) -> { policy, routed, stats, uninstall() }
//
// The capture director calls this once, with episode.mapPolicy, before its single page.goto, so
// everything is in place before the first tile loads. Per policy:
//
//   restyle        every map tile request is answered locally with a generated tile in the
//                  fictional course's palette (video/brand/course.json map.palette): turf green
//                  with diagonal mowing stripes, continuous across tile edges. The decided default
//                  (G2, video/approvals.md).
//   owned-imagery  every map tile is answered from imagery we own or license, read from
//                  <media root>/map-tiles/<z>/<x>/<y>.png|.jpg (never in git); a tile we do not
//                  have is answered with the restyle tile, never fetched. Needs a licence
//                  reference: options.licence, or a LICENCE.txt in the tiles folder.
//   blur, frame-out  no routes; the tiles load as usual and the in-page treatment does the work.
//
// For every policy it also adds video/capture/map-treatment.js as an init script, applied on
// DOMContentLoaded: blur blurs the tile layer only, restyle hides the third-party attribution
// that no longer applies, and window.__saMap.bounds() tells the director where the map is (for
// frame-out). Pass { inPage: false } to install the routes alone.
//
// Map tiles are the two layers the IntelliDash dashboard map draws: OpenStreetMap street tiles and
// Google satellite tiles on top (IntelliDash site/src/app/spatial-adjust/components/sa-dashboard/
// sa-dash-map/sa-dash-map.component.ts:237 and :248-253, read 2026-10-19). Any Google /vt tile
// is substituted, not only the satellite layer, so a change of layer cannot leak imagery.
//
// WRITE SAFETY. The route answers GET requests only. Any other method, to any URL the route
// matches, is passed on untouched with route.fallback(): never fulfilled, altered or replaced,
// and this module never creates a request of its own. Playwright runs the most recently
// registered matching route first, so the director's request gate must either be registered
// before installMapRoutes or pass allowed requests on with route.fallback(); either way a
// non-GET reaches the gate exactly as the page sent it. Routing turns off the browser's HTTP
// cache, so a cached satellite tile cannot bypass the route. IntelliDash registers no service
// worker (checked 2026-10-19); page.route cannot see requests a service worker makes.
//
// CLI: none. Run node video/capture/map-still.mjs to see a policy applied to the test page.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { mediaRoot } from '../lib/media-root.mjs';

export const MAP_POLICIES = ['blur', 'restyle', 'owned-imagery', 'frame-out'];
export const TILE_SIZE = 256;
// Width of one mowing stripe on the ground. Stripes narrower than MIN_STRIPE_PX on screen
// (zoomed far out) are not drawn: they would only alias into noise.
export const STRIPE_METRES = 7;
export const MIN_STRIPE_PX = 3;
export const TREATMENT_SCRIPT = path.join(import.meta.dirname, 'map-treatment.js');

const COURSE = JSON.parse(readFileSync(path.join(import.meta.dirname, '..', 'brand', 'course.json'), 'utf8'));
export const DEFAULT_PALETTE = COURSE.map.palette;

// ---- which requests are map tiles ---------------------------------------------------------------

const GOOGLE_HOST = /^(mt|khms)[0-3]\.google\.com$/;
const OSM_HOST = /^([a-c]\.)?tile\.openstreetmap\.org$/;
const OSM_PATH = /^\/(\d{1,2})\/(\d{1,8})\/(\d{1,8})\.png$/;
const param = (s, k) => s.match(new RegExp(`[/&?;]${k}=(\\d{1,8})(?=[&;]|$)`))?.[1];

// { source, z, x, y } for a map tile URL, or null for anything else.
export function tileCoords(url) {
  let u;
  try { u = url instanceof URL ? url : new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  let z; let x; let y; let source;
  if (GOOGLE_HOST.test(u.hostname) && u.pathname.startsWith('/vt')) {
    const s = u.pathname + u.search;
    [x, y, z] = [param(s, 'x'), param(s, 'y'), param(s, 'z')];
    source = 'satellite';
  } else if (OSM_HOST.test(u.hostname)) {
    [, z, x, y] = u.pathname.match(OSM_PATH) ?? [];
    source = 'street';
  }
  if (z === undefined || x === undefined || y === undefined) return null;
  [z, x, y] = [Number(z), Number(x), Number(y)];
  if (z > 30 || x >= 2 ** z || y >= 2 ** z) return null;
  return { source, z, x, y };
}

export const isTileUrl = (url) => tileCoords(url) !== null;

// ---- PNG tiles ----------------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// An 8-bit RGB PNG from width * height * 3 bytes of pixels.
export function encodePng(width, height, rgb) {
  if (rgb.length !== width * height * 3) throw new Error('encodePng: pixel buffer does not match the size');
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    raw[row * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit, truecolour, deflate, no filter method, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Ground metres per screen pixel at the centre of tile row y at zoom z (Web Mercator).
export function metresPerPixel(z, y) {
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / 2 ** z)));
  return (156543.03392 * Math.cos(lat)) / 2 ** z;
}

const tileCache = new Map();
const TILE_CACHE_MAX = 512;

// The restyle tile for z/x/y: turf with diagonal mowing stripes, computed from global pixel
// coordinates so stripes run on across tile edges. Deterministic; cached.
export function restyleTile(z, x, y, palette = DEFAULT_PALETTE) {
  const key = `${palette.turf}${palette.stripe}/${z}/${x}/${y}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const turf = hexToRgb(palette.turf);
  const stripe = hexToRgb(palette.stripe);
  const stripePx = STRIPE_METRES / metresPerPixel(z, y);
  const period = stripePx * Math.SQRT2; // stripes at 45 degrees: measured along x + y
  const rgb = Buffer.alloc(TILE_SIZE * TILE_SIZE * 3);
  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const band = stripePx < MIN_STRIPE_PX ? 0 : Math.floor((x * TILE_SIZE + px + y * TILE_SIZE + py) / period) % 2;
      rgb.set(band ? stripe : turf, (py * TILE_SIZE + px) * 3);
    }
  }
  const png = encodePng(TILE_SIZE, TILE_SIZE, rgb);
  if (tileCache.size >= TILE_CACHE_MAX) tileCache.delete(tileCache.keys().next().value);
  tileCache.set(key, png);
  return png;
}

const imageType = (buf) => {
  if (buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  return null;
};

// (z, x, y) -> Buffer | null, reading <dir>/<z>/<x>/<y>.png or .jpg. Coordinates are integers
// parsed from the tile URL, so the path cannot leave dir.
export function fileTileReader(dir) {
  return (z, x, y) => {
    for (const ext of ['png', 'jpg', 'jpeg']) {
      const file = path.join(dir, String(z), String(x), `${y}.${ext}`);
      if (existsSync(file)) return readFileSync(file);
    }
    return null;
  };
}

// ---- install ------------------------------------------------------------------------------------

// The init script: map-treatment.js, then apply the policy once the DOM exists.
function treatmentScript(policy, options) {
  const src = readFileSync(TREATMENT_SCRIPT, 'utf8');
  const apply = `;(() => {
  const go = () => window.__saMapTreatment(${JSON.stringify(policy)}, ${JSON.stringify(options)});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
  else go();
})();`;
  return `${src}\n${apply}\n`;
}

export async function installMapRoutes(page, mapPolicy, options = {}) {
  if (!MAP_POLICIES.includes(mapPolicy)) {
    throw new Error(`installMapRoutes: mapPolicy must be one of ${MAP_POLICIES.join(', ')}`);
  }
  const { inPage = true, palette = DEFAULT_PALETTE, credit } = options;
  const stats = { fulfilled: 0, owned: 0, missingOwned: 0, passedOn: 0 };

  let readOwned = null;
  if (mapPolicy === 'owned-imagery') {
    const tilesDir = options.tilesDir ?? path.join(mediaRoot(), 'map-tiles');
    const licensed = (typeof options.licence === 'string' && options.licence.trim())
      || existsSync(path.join(tilesDir, 'LICENCE.txt'));
    if (!licensed) {
      throw new Error(`installMapRoutes: owned imagery needs a licence reference (options.licence or ${path.join(tilesDir, 'LICENCE.txt')})`);
    }
    readOwned = options.readTile ?? fileTileReader(tilesDir);
  }

  if (inPage) {
    await page.addInitScript({ content: treatmentScript(mapPolicy, { palette, credit }) });
  }
  if (mapPolicy === 'blur' || mapPolicy === 'frame-out') {
    return { policy: mapPolicy, routed: false, stats, uninstall: async () => {} };
  }

  const handler = async (route) => {
    const request = route.request();
    const coords = tileCoords(request.url());
    // Anything but a GET for a tile goes on exactly as the page sent it.
    if (request.method() !== 'GET' || !coords) {
      stats.passedOn++;
      return route.fallback();
    }
    let body = readOwned ? readOwned(coords.z, coords.x, coords.y) : null;
    if (readOwned) {
      if (body && imageType(body)) stats.owned++;
      else { body = null; stats.missingOwned++; }
    }
    body ??= restyleTile(coords.z, coords.x, coords.y, palette);
    stats.fulfilled++;
    return route.fulfill({
      status: 200,
      contentType: imageType(body),
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      body,
    });
  };
  await page.route(isTileUrl, handler);
  return {
    policy: mapPolicy,
    routed: true,
    stats,
    uninstall: () => page.unroute(isTileUrl, handler),
  };
}
