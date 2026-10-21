// Stage every media asset the manifest pins into .media/, so the build can verify and ship it.
//
// Videos and posters are GitHub Release assets, never git objects (see src/media/manifest.mjs). The
// build cannot download them itself: it starts by deleting dist/ and must stay offline-capable. This
// command runs first, in Node at build time and never in the browser, so the page keeps its
// zero-external-origins property:
//
//   node scripts/fetch-media.mjs [--manifest src/media/manifest.json] [--dir .media]
//
// For each item, the video then the poster:
//   - a staged file whose byte count and SHA-256 match its pin is reported as cached and not fetched;
//   - anything else is downloaded from the item's release, streamed into <dir>/<name>.part, checked
//     for byte count and SHA-256, and only then renamed into place, so a crash or a bad download can
//     never leave a file that looks valid. A stale file of the same name is replaced.
// Each asset gets 3 attempts with backoff. After the last one the .part file is deleted, the key is
// named and the command exits 1 once every other asset has been tried.
//
// Release downloads redirect from github.com to a signed githubusercontent.com URL; fetch follows the
// redirect and, being cross-origin, drops the Authorization header on the way. Public assets need no
// token. GITHUB_TOKEN, when set (CI sets it), is sent to github.com only to soften rate limits.
//
// The cache is trustworthy because bytes under a pinned hash are never swapped in place: a replaced
// asset gets a new file name or release tag. CI restores .media/ from actions/cache, so a new wave
// downloads only its new assets and every cached one is re-hashed here before the build sees it.
//
// Environment, for tests: SA_MEDIA_FETCH_BACKOFF_MS sets the first retry delay (default 1000; it
// doubles for each later attempt).
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  DEFAULT_MANIFEST, DEFAULT_MEDIA_DIR, assetUrl, assetsOf, loadManifest, sha256File, validateManifest,
} from '../src/media/manifest.mjs';

export const ATTEMPTS = 3;
const ROOT = join(import.meta.dirname, '..');

/** True when `path` is a regular file whose size and SHA-256 match the asset's pin. Size first: it is free. */
export async function isStaged(path, asset) {
  let info;
  try {
    info = await stat(path);
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
  return info.isFile() && info.size === asset.bytes && (await sha256File(path)) === asset.sha256;
}

/**
 * Download one asset to `path`. Streams into `path`.part while hashing, stops as soon as the body
 * runs past the pinned size, and renames into place only when the byte count and SHA-256 both match.
 * Throws with the reason on any failure; the caller retries and cleans up.
 */
export async function download(url, path, asset, { fetchImpl = fetch, token = process.env.GITHUB_TOKEN } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetchImpl(url, { redirect: 'follow', headers });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  }
  if (!res.body) throw new Error('response has no body');

  const part = `${path}.part`;
  const hash = createHash('sha256');
  let bytes = 0;
  await pipeline(
    Readable.fromWeb(res.body),
    async function* count(source) {
      for await (const chunk of source) {
        bytes += chunk.length;
        if (bytes > asset.bytes) throw new Error(`body is longer than the pinned ${asset.bytes} bytes`);
        hash.update(chunk);
        yield chunk;
      }
    },
    createWriteStream(part),
  );
  if (bytes !== asset.bytes) throw new Error(`received ${bytes} bytes, manifest pins ${asset.bytes}`);
  const actual = hash.digest('hex');
  if (actual !== asset.sha256) throw new Error(`SHA-256 is ${actual}, manifest pins ${asset.sha256}`);
  await rename(part, path);
}

/**
 * Stage every asset of every item in `manifest` into `dir`. `urlFor(item, name)` gives the download
 * URL (assetUrl against the manifest by default). Returns { fetched, cached, failed }, where failed
 * lists { key, name, reason } for every asset that still failed after ATTEMPTS tries.
 */
export async function stageAll(manifest, dir, {
  urlFor = (item, name) => assetUrl(manifest, item, name),
  fetchImpl = fetch,
  token = process.env.GITHUB_TOKEN,
  backoffMs = 1000,
  log = console.log,
} = {}) {
  await mkdir(dir, { recursive: true });
  const shown = (path) => {
    const rel = relative(process.cwd(), path);
    return rel && !rel.startsWith('..') ? rel : path;
  };
  const result = { fetched: 0, cached: 0, failed: [] };

  for (const [key, item] of Object.entries(manifest.items)) {
    for (const asset of assetsOf(item)) {
      const path = join(dir, asset.name);
      if (await isStaged(path, asset)) {
        log(`media: ${key} ${asset.name} cached`);
        result.cached += 1;
        continue;
      }
      const url = urlFor(item, asset.name);
      let reason;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
        try {
          await download(url, path, asset, { fetchImpl, token });
          reason = undefined;
          break;
        } catch (err) {
          reason = err.message;
          await rm(`${path}.part`, { force: true });
          if (attempt < ATTEMPTS) {
            const wait = backoffMs * 2 ** (attempt - 1);
            log(`media: ${key} ${asset.name} attempt ${attempt} of ${ATTEMPTS} failed (${reason}); retrying in ${wait} ms`);
            await sleep(wait);
          }
        }
      }
      if (reason === undefined) {
        log(`media: ${key} ${asset.name} fetched (${asset.bytes.toLocaleString('en-US')} bytes) into ${shown(path)}`);
        result.fetched += 1;
      } else {
        result.failed.push({ key, name: asset.name, reason: `${reason} (${url})` });
      }
    }
  }
  return result;
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      manifest: { type: 'string', default: DEFAULT_MANIFEST },
      dir: { type: 'string', default: DEFAULT_MEDIA_DIR },
    },
  });
  const manifest = await loadManifest(resolve(ROOT, values.manifest));
  const keys = Object.keys((manifest && manifest.items) || {});
  // The catalogue check needs the built export, so build.mjs makes it. Here every item's own fields
  // and the asset names are checked, which also guarantees each name is a plain file name in --dir.
  validateManifest(manifest, { guideKeys: keys });
  if (!keys.length) {
    console.log('media: manifest has no items');
    return 0;
  }

  const backoff = Number(process.env.SA_MEDIA_FETCH_BACKOFF_MS ?? 1000);
  if (!Number.isFinite(backoff) || backoff < 0) {
    throw new Error(`SA_MEDIA_FETCH_BACKOFF_MS must be a number of milliseconds; received ${JSON.stringify(process.env.SA_MEDIA_FETCH_BACKOFF_MS)}`);
  }
  const { fetched, cached, failed } = await stageAll(manifest, resolve(ROOT, values.dir), { backoffMs: backoff });
  console.log(`media: ${fetched} fetched, ${cached} cached, ${failed.length} failed`);
  if (failed.length) {
    console.error(failed.map((f) => `media: ${f.key} ${f.name} failed after ${ATTEMPTS} attempts: ${f.reason}`).join('\n'));
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(`media: ${err.message}`);
    process.exitCode = 1;
  }
}
