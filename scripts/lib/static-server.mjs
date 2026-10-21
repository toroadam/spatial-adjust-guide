// The static file handler behind both local servers: scripts/serve.mjs (npm run serve) and
// scripts/test.mjs (npm test). One copy, so the two cannot drift apart.
//
// It answers HTTP Range requests because video needs them. Safari will not play an MP4 from a server
// that ignores Range, and every browser seeks by asking for a byte range; GitHub Pages answers them,
// so the local servers must too or a local check proves nothing about the deployed site.
//
//   Range: bytes=a-b   206, Content-Range: bytes a-min(b, size-1)/size
//   Range: bytes=a-    206, from a to the end
//   Range: bytes=-n    206, the last n bytes
//   unsatisfiable      416, Content-Range: bytes */size
//   several ranges     200 with the whole file, which RFC 9110 allows
//
// Every response carries Accept-Ranges: bytes. HEAD gets the headers without the body.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

export const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
};

/**
 * The byte range a Range header asks for, as { start, end } (inclusive) within a file of `size`
 * bytes; null when the header is absent, malformed or names several ranges (serve the whole file);
 * 'unsatisfiable' when it is well formed but lies outside the file.
 */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return null;
  const [, a, b] = m;
  if (a === '' && b === '') return null;
  let start;
  let end;
  if (a === '') {
    const suffix = Number(b);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === '' ? size - 1 : Math.min(Number(b), size - 1);
    if (b !== '' && Number(b) < start) return null;   // invalid: ignore the header, per RFC 9110
  }
  if (start >= size || size === 0) return 'unsatisfiable';
  return { start, end };
}

/** A request handler serving the files under `root`, for node:http createServer. */
export function staticHandler(root) {
  return async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      let file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      let info = await stat(file);
      if (info.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file);
      }
      const size = info.size;
      const headers = {
        'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      };
      const range = parseRange(req.headers.range, size);
      if (range === 'unsatisfiable') {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}`, 'Content-Length': 0 });
        res.end();
        return;
      }
      const { start, end } = range || { start: 0, end: size - 1 };
      const status = range ? 206 : 200;
      if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      headers['Content-Length'] = size === 0 ? 0 : end - start + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || size === 0) { res.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      // A browser abandons a video request as soon as it has what it needs; stop reading then.
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end('not found');
    }
  };
}
