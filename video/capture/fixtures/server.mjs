// Local fixture server for the capture tests. Listens on 127.0.0.1 on a random port and never
// proxies anything: every response is a file from this folder, a file from node_modules/leaflet,
// or a canned JSON answer.
//
//   /leaflet-page.html                   Leaflet recorder fixture (record.test.mjs)
//   /leaflet/<file>                      node_modules/leaflet/dist/<file>
//   /tiles/<z>/<x>/<y>.png               one of fixtures/tiles/tile-<n>.png, after a short delay
//   /[<variant>/]spatialadjust[/demo]    the demo app fixture (demo-app/index.html), any variant
//   /api/auth/demo                       the fake demo sign-in: POST answers 200 true
//   /api/*                               any other API path: GET answers {}, a write answers 200
//
// Every request is logged in server.log as { t, method, path, bodyBytes } so a test can prove
// that no write reached the server after a given moment. Query strings are dropped.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const HERE = import.meta.dirname;
const LEAFLET = path.resolve(HERE, '..', '..', '..', 'node_modules', 'leaflet', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

const send = (res, status, body, type = 'text/plain') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

async function sendFile(res, file) {
  try {
    send(res, 200, await readFile(file), MIME[path.extname(file)] ?? 'application/octet-stream');
  } catch {
    send(res, 404, 'not found');
  }
}

// Paths under a fixed root only: no "..", no absolute paths.
function inside(root, rel) {
  const file = path.resolve(root, rel.replace(/^\/+/, ''));
  return file.startsWith(root + path.sep) ? file : null;
}

export async function startFixtureServer({ tileDelayMs = 40 } = {}) {
  const log = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const url = new URL(req.url, 'http://fixture.invalid');
      const p = decodeURIComponent(url.pathname);
      log.push({ t: Date.now(), method: req.method, path: p, bodyBytes: Buffer.concat(chunks).length });
      if (p === '/' || p === '/leaflet-page.html') return sendFile(res, path.join(HERE, 'leaflet-page.html'));
      if (p.startsWith('/leaflet/')) {
        const file = inside(LEAFLET, p.slice('/leaflet/'.length));
        return file ? sendFile(res, file) : send(res, 404, 'not found');
      }
      const tile = /^\/tiles\/(\d+)\/(-?\d+)\/(-?\d+)\.png$/.exec(p);
      if (tile) {
        const [z, x, y] = tile.slice(1).map(Number);
        const n = (((x + y + z) % 4) + 4) % 4;
        const delay = tileDelayMs ? tileDelayMs + ((x * 7 + y * 13) % 5) * 10 : 0;
        if (delay) await new Promise((r) => setTimeout(r, delay));
        return sendFile(res, path.join(HERE, 'tiles', `tile-${n}.png`));
      }
      if (p.startsWith('/api/')) {
        if (p === '/api/auth/demo' && req.method === 'POST') return send(res, 200, 'true', 'application/json');
        if (req.method === 'GET' || req.method === 'HEAD') return send(res, 200, '{}', 'application/json');
        return send(res, 200, '{"written":true}', 'application/json');
      }
      if (/^\/(?:[a-z0-9-]+\/)?spatialadjust(?:\/demo)?\/?$/.test(p)) return sendFile(res, path.join(HERE, 'demo-app', 'index.html'));
      if (p === '/favicon.ico') return send(res, 204, '');
      return send(res, 404, 'not found');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    port,
    host: `127.0.0.1:${port}`,
    origin: `http://127.0.0.1:${port}`,
    log,
    // Requests other than GET, HEAD and OPTIONS received at or after time t (ms since epoch).
    writesSince: (t) => log.filter((r) => r.t >= t && !['GET', 'HEAD', 'OPTIONS'].includes(r.method)),
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}
