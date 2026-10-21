// The media size budget, defined once. build.mjs imports these caps and checks; this file is also
// the command that reports against them.
//
// The caps are decimal byte counts, the stricter reading of "25 MB": an episode video may declare at
// most 25,000,000 bytes, the showcase video 40,000,000, and the whole of dist/ (page, catalogues,
// videos and posters together) 900,000,000, which keeps the site strictly inside the 1 GB GitHub
// Pages limit with room to spare. Posters have no cap of their own but count toward the site total.
//
//   node scripts/media-budget.mjs [--manifest src/media/manifest.json] [--dist dist]
//
// prints one row per manifest item and the dist/ total (when dist/ exists), and exits 1 when
// anything is over its cap. It checks declared sizes only; build.mjs proves the staged files match.
import { lstat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_MANIFEST, SHOWCASE_KEY, loadManifest } from '../src/media/manifest.mjs';

export const EPISODE_MAX_BYTES = 25_000_000;
export const SHOWCASE_MAX_BYTES = 40_000_000;
export const SITE_MAX_BYTES = 900_000_000;

const ROOT = join(import.meta.dirname, '..');
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n));

/** The cap for one item. The larger showcase cap applies only when key and kind both say showcase. */
export function capFor(key, item) {
  return key === SHOWCASE_KEY && item && item.kind === 'showcase' ? SHOWCASE_MAX_BYTES : EPISODE_MAX_BYTES;
}

/** Each item's declared video bytes against its cap. Returns problems, one string per item over. */
export function checkItems(manifest) {
  const problems = [];
  for (const [key, item] of Object.entries((manifest && manifest.items) || {})) {
    const cap = capFor(key, item);
    const bytes = item && item.bytes;
    if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
      problems.push(`${key}: declares no byte count, so it cannot be checked against its ${fmt(cap)}-byte cap`);
    } else if (bytes > cap) {
      problems.push(`${key}: ${item.file || 'video'} declares ${fmt(bytes)} bytes, over the ${fmt(cap)}-byte ${key === SHOWCASE_KEY ? 'showcase' : 'episode'} cap by ${fmt(bytes - cap)}`);
    }
  }
  return problems;
}

/** Total size in bytes of every file under `dir`, recursively. Symbolic links count as themselves. */
export async function dirBytes(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += await dirBytes(path);
    else total += (await lstat(path)).size;
  }
  return total;
}

/** The size of the built site against SITE_MAX_BYTES. Returns { bytes, problems }. */
export async function checkSite(distDir) {
  const bytes = await dirBytes(distDir);
  const problems = bytes > SITE_MAX_BYTES
    ? [`${distDir} totals ${fmt(bytes)} bytes, over the ${fmt(SITE_MAX_BYTES)}-byte site cap by ${fmt(bytes - SITE_MAX_BYTES)}`]
    : [];
  return { bytes, problems };
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { manifest: { type: 'string', default: DEFAULT_MANIFEST }, dist: { type: 'string', default: 'dist' } },
  });
  const manifestPath = resolve(ROOT, values.manifest);
  const distDir = resolve(ROOT, values.dist);
  const manifest = await loadManifest(manifestPath);
  const items = Object.entries((manifest && manifest.items) || {});

  const problems = checkItems(manifest);
  if (items.length) {
    const rows = [['key', 'kind', 'bytes', 'cap', ''], ...items.map(([key, item]) => {
      const cap = capFor(key, item);
      const verdict = typeof item?.bytes !== 'number' ? 'NO SIZE' : item.bytes > cap ? 'OVER' : 'ok';
      return [key, String(item?.kind ?? '?'), fmt(item?.bytes ?? '-'), fmt(cap), verdict];
    })];
    const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
    for (const r of rows) {
      console.log(r.map((cell, i) => (i === 2 || i === 3 ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join('  ').trimEnd());
    }
  } else {
    console.log(`media budget: ${values.manifest} has no items`);
  }

  let distExists = true;
  try {
    distExists = (await lstat(distDir)).isDirectory();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    distExists = false;
  }
  if (distExists) {
    const site = await checkSite(distDir);
    problems.push(...site.problems);
    const pct = ((site.bytes / SITE_MAX_BYTES) * 100).toFixed(1);
    console.log(`${values.dist}/ total: ${fmt(site.bytes)} of ${fmt(SITE_MAX_BYTES)} bytes (${pct}%)`);
  } else {
    console.log(`${values.dist}/ not built; run npm run build to check the site total`);
  }

  if (problems.length) {
    console.error(`media budget exceeded (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n- ${problems.join('\n- ')}`);
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(`media budget: ${err.message}`);
    process.exitCode = 1;
  }
}
