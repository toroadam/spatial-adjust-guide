// The recreation's map in the product's look (the owner approved the app's own satellite imagery for the videos).
//
//   installRecreationMap(page, config) -> { image, bytes }
//
// For a recreation take whose episode sets "recreationMap", the capture director calls this before the page loads. The
// satellite image is read from <media root>/map-backdrop/<config.file> (never from the repository, never committed) and
// answered, on GET only, at http://localhost:<port>/__sa-backdrop.jpg; the page-side script (recreation-map.js) lays it under
// the guide site's drawn map and restyles the stations and legend like the product's. Nothing is requested from any
// network: the route fulfils from disk. The director's tripwire and its /demo-only refusal are untouched (this runs on the
// recreation source only, and the tripwire is registered after it, so every request still meets the tripwire first).
//
// Config (episode.recreationMap):
//   file       image file name under <media root>/map-backdrop (a z19 mosaic of the product's Google satellite tiles)
//   zoom       the zoom the card's window stands for (labels scale by 2^(zoom - 19))
//   view       { x0, y0, w, h } the window of the image the map card shows, in image pixels
//   diameter   station circle diameter, CSS px at that zoom
//   fullWidth, fullHeight  optional: the pixel size the view's coordinates refer to, when the file is a downscaled copy of the mosaic
//   pins       [{ x, y, name }] in the order the app draws its 24 pins (x, y in percent of the card)

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { mediaRoot, refusalReason } from '../lib/media-root.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const ROUTE = '**/__sa-backdrop.jpg';

export class RecreationMapError extends Error {
  constructor(message) { super(message); this.name = 'RecreationMapError'; }
}

// width and height of a JPEG, from its SOF marker.
export function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new RecreationMapError('not a JPEG the map backdrop can use');
}

export function validateConfig(cfg) {
  const ok = cfg && typeof cfg.file === 'string' && !/[\\/]/.test(cfg.file) && Number.isFinite(cfg.zoom) && Number.isFinite(cfg.diameter)
    && cfg.view && ['x0', 'y0', 'w', 'h'].every((k) => Number.isFinite(cfg.view[k])) && Array.isArray(cfg.pins)
    && cfg.pins.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && typeof p.name === 'string');
  if (!ok) throw new RecreationMapError('episode.recreationMap needs file (a bare name), zoom, diameter, view {x0,y0,w,h} and pins [{x,y,name}]');
}

export async function installRecreationMap(page, cfg) {
  validateConfig(cfg);
  const file = path.join(mediaRoot(), 'map-backdrop', cfg.file);
  const bad = refusalReason(path.dirname(file));
  if (bad) throw new RecreationMapError(`the map backdrop must live in the media root: ${bad}`);
  if (path.resolve(file).startsWith(REPO_ROOT + path.sep)) throw new RecreationMapError('the map backdrop must not be inside the repository');
  const body = readFileSync(file);
  const { width, height } = jpegSize(body);
  await page.route(ROUTE, (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'image/jpeg', body, headers: { 'Cache-Control': 'no-store' } });
  });
  await page.addInitScript((c) => { window.__saRecMap = c; }, { ...cfg, backdrop: '/__sa-backdrop.jpg', imageWidth: cfg.fullWidth ?? width, imageHeight: cfg.fullHeight ?? height });
  await page.addInitScript({ path: path.join(import.meta.dirname, 'recreation-map.js') });
  return { image: cfg.file, bytes: statSync(file).size };
}
