#!/usr/bin/env node
// The local recreation as a capture source: the guide site's own Spatial Adjust recreation, for
// shots Demo Mode cannot show (a state the demo data never reaches, a screen Demo Mode hides).
//
// The recreation is the built guide site (dist/, from `node build.mjs`): it embeds
// SpatialAdjustApp.dc.html with the corrections the build applies in its transform layer, which
// the raw .dc.html file does not have. It is served on port 8124, the port `npm run serve` uses
// (SA_RECREATION_PORT moves it, for tests run while something else holds 8124).
//
//   ensureRecreationServer()   reuses a server already on 127.0.0.1:8124 when it serves this
//                              checkout's dist/index.html byte for byte; otherwise builds dist/
//                              when it is missing and serves it on loopback only. Refuses when
//                              the port is taken by anything else.
//
//   node video/capture/recreation.mjs --episode <id|file> --take <N> [director options]
//        runs the director with --source recreation (the episode must declare
//        "source": "recreation"); the take is take<N>-recreation.mp4
//   node video/capture/recreation.mjs --serve
//        serves the recreation until Ctrl-C, to look at it or to pick targets
//
//   liftFigure(page, caption)  lifts one SpatialAdjustApp figure of the guide page to fill the
//                              viewport, for an episode that sets "recreationFigure" (see below);
//                              called again by a beat's figure action, it swaps the lifted figure
//                              for another one of the same page
//
// The director calls ensureRecreationServer itself for --source recreation, so
// `node video/capture/director.mjs --source recreation ...` works the same way. A recreation take
// runs in Playwright's own Chromium: there is no Demo Mode, no sign-in and nothing of the owner's
// to use. The director refuses any host but localhost:8124 and 127.0.0.1:8124 for this source
// (RECREATION_HOSTS in gates.mjs), and the episode schema refuses demo-mode clicks for it.

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RECREATION_PORT } from './gates.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const DIST = path.join(REPO_ROOT, 'dist');
export { RECREATION_PORT };
export const RECREATION_ORIGIN = `http://localhost:${RECREATION_PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.json': 'application/json', '.txt': 'text/plain',
};

export class RecreationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecreationError';
  }
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// What is answering on the port: { up: false } or { up: true, sameDist }.
async function probe(port, distIndex) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) });
    const body = Buffer.from(await res.arrayBuffer());
    return { up: true, sameDist: res.ok && distIndex !== null && sha(body) === sha(distIndex) };
  } catch {
    return { up: false };
  }
}

export function buildDist({ log = () => {} } = {}) {
  log('building dist/ (node build.mjs)');
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'build.mjs')], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (r.status !== 0 || !existsSync(path.join(DIST, 'index.html'))) throw new RecreationError('node build.mjs failed; the recreation cannot be served');
}

// Static files from dist/ only: GET and HEAD, no directory listing, no path outside dist/.
function handler(root) {
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://recreation.invalid').pathname); } catch { res.writeHead(400); res.end(); return; }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.resolve(root, `.${p}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  };
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => { server.off('listening', onListening); reject(err); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

// Returns { origin, started, close() }. close() stops only a server this call started.
export async function ensureRecreationServer({ port = RECREATION_PORT, build = true, log = () => {} } = {}) {
  const indexFile = path.join(DIST, 'index.html');
  if (!existsSync(indexFile)) {
    if (!build) throw new RecreationError('dist/ is missing; run node build.mjs');
    buildDist({ log });
  }
  const distIndex = readFileSync(indexFile);
  const seen = await probe(port, distIndex);
  if (seen.up) {
    if (!seen.sameDist) {
      throw new RecreationError(`port ${port} is serving something other than this checkout's dist/; stop that server or rebuild, then try again`);
    }
    log(`reusing the recreation server already on port ${port}`);
    return { origin: `http://localhost:${port}`, started: false, close: async () => {} };
  }
  // Loopback only, on both address families, so http://localhost resolves either way.
  const servers = [];
  for (const host of ['127.0.0.1', '::1']) {
    const s = createServer(handler(DIST));
    try {
      await listen(s, host, port);
      servers.push(s);
    } catch (err) {
      if (host === '127.0.0.1') throw new RecreationError(`cannot listen on 127.0.0.1:${port} (${err.code ?? err.message})`);
    }
  }
  log(`serving dist/ on http://localhost:${port} (loopback only)`);
  return {
    origin: `http://localhost:${port}`,
    started: true,
    close: () => Promise.all(servers.map((s) => new Promise((r) => { s.closeAllConnections?.(); s.close(() => r()); }))),
  };
}

// The figure lift: the guide page draws SpatialAdjustApp several times, each figure scaled into the
// page's column, with the guide's own prose around it. An episode that sets "recreationFigure" to
// the start of a figure's caption gets that one figure lifted out of the page to fill the
// 1920x1080 viewport, unscaled, the same framing as the style frame's window shot
// (video/edit/gfx/recreation_still.mjs). Only a stylesheet and two attributes are added: nothing
// is navigated, clicked or sent. The lifted app carries data-sa-frame, so the episode's targets
// can be scoped to it ([data-sa-frame] >> ...); without the scope a target resolves to the first
// match on the page, which is another, hidden copy of the app.
export const FRAME_ATTR = 'data-sa-frame';

// Lifts the figure whose caption starts with `caption`. Resolves to { box: [x0, y0, x1, y1] } in
// CSS px, or { error } when no figure, or more than one, matches, or the lifted app does not fill
// the viewport exactly. The page must already hold the guide (waits up to `timeout` for it).
export async function liftFigure(page, caption, { timeout = 30000 } = {}) {
  if (typeof caption !== 'string' || !caption.trim()) return { error: 'recreationFigure must be the start of a figure caption' };
  try {
    await page.waitForSelector('figure .sa-app', { state: 'attached', timeout });
  } catch {
    return { error: `no SpatialAdjustApp figure appeared within ${Math.round(timeout / 1000)} s` };
  }
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  return page.evaluate(({ caption: want, attr }) => {
    const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    const figs = [...document.querySelectorAll('figure')].filter((f) => {
      const cap = f.querySelector('figcaption');
      return cap && norm(cap.textContent).startsWith(norm(want)) && f.querySelector('.sa-app');
    });
    if (figs.length !== 1) return { error: `${figs.length} figures have a caption starting "${norm(want)}"; exactly one must` };
    const app = figs[0].querySelector('.sa-app');
    const wrap = app.parentElement?.parentElement;
    if (!wrap) return { error: 'the figure\'s app has no scaling wrapper' };
    if (!document.getElementById('sa-frame-style')) {
      const style = document.createElement('style');
      style.id = 'sa-frame-style';
      style.textContent = `[${attr}-wrap]{position:fixed!important;left:0!important;top:0!important;transform:none!important;`
        + 'margin:0!important;width:1920px!important;height:1080px!important;z-index:2147483000!important}';
      document.head.appendChild(style);
    }
    // A second lift (the episode's figure action) puts the figure lifted before back in the page,
    // so exactly one app ever carries the frame attribute and [data-sa-frame] targets resolve in it.
    for (const el of document.querySelectorAll(`[${attr}-wrap]`)) if (el !== wrap) el.removeAttribute(`${attr}-wrap`);
    for (const el of document.querySelectorAll(`[${attr}]`)) if (el !== app) el.removeAttribute(attr);
    wrap.setAttribute(`${attr}-wrap`, '');
    app.setAttribute(attr, '');
    window.scrollTo(0, 0);
    const b = app.getBoundingClientRect();
    const box = [b.left, b.top, b.right, b.bottom].map((v) => Math.round(v * 100) / 100);
    if (Math.abs(b.left) > 0.5 || Math.abs(b.top) > 0.5 || Math.abs(b.width - 1920) > 0.5 || Math.abs(b.height - 1080) > 0.5) {
      return { error: `the lifted app is at ${box.join(', ')}, not 0, 0, 1920, 1080`, box };
    }
    return { box };
  }, { caption, attr: FRAME_ATTR });
}

async function cli(argv) {
  if (argv.includes('--serve')) {
    const srv = await ensureRecreationServer({ log: (m) => process.stdout.write(`recreation: ${m}\n`) });
    if (!srv.started) return 0;
    process.stdout.write('recreation: Ctrl-C to stop\n');
    await new Promise((resolve) => process.once('SIGINT', resolve));
    await srv.close();
    return 0;
  }
  if (argv.includes('--source')) {
    process.stderr.write('recreation: --source is always recreation here\n');
    return 64;
  }
  const { main } = await import('./director.mjs');
  return main([...argv, '--source', 'recreation']);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  cli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => { process.stderr.write(`recreation: ${err.message}\n`); process.exit(err instanceof RecreationError ? 2 : 1); },
  );
}
