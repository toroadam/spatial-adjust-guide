// Self-contained test entry point: serve dist/ on an ephemeral port, run the smoke test
// against it, and tear the server down. No externally-started server required, so this
// works from a clean clone and in CI.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.ttf':'font/ttf', '.woff2':'font/woff2', '.json':'application/json' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join('dist', normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});

await new Promise((r) => server.listen(0, r));
const { port } = server.address();

const child = spawn(
  process.execPath,
  ['scripts/smoke.mjs', `http://localhost:${port}/`, '--offline'],
  { stdio: 'inherit' },
);
const code = await new Promise((r) => child.on('exit', r));
server.close();
process.exit(code ?? 1);
