// Loads the local real-to-fictional name maps without ever exposing them.
//
// Two gitignored files hold real names by definition:
//   sanitize.local.json                flat {"real": "fictional"} used to sanitize Core Design
//                                      imports (scripts/import-export.mjs)
//   video/capture/overlay.local.json   {"pairs": {"real": "fictional"}, "denylist": ["real", ...]}
//                                      for the IntelliDash demo data shown in captures
// Paths can be overridden with SA_SANITIZE_PATH and SA_OVERLAY_PATH (or the options below).
// video/lib/local_maps.py implements the same contract for Python; change both together.
//
// loadLocalMaps() returns { pairs, denylist }:
//   pairs     [[real, fictional], ...] from both files, longest real first, for replacement
//   denylist  every real name from both files plus the overlay's explicit denylist, unique
//             (case-insensitive), in file order. Term N (1-based) is reported as [denylisted #N].
//
// THE CONTENTS ARE SECRET. Nothing in this module prints a term. The returned object and both
// arrays throw on JSON.stringify and print only counts under console.log / util.inspect, so an
// accidental log or report fails loudly or says nothing. Error messages name files and entry
// positions, never values. Paths may be printed.

import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const DEFAULT_SANITIZE_PATH = path.join(REPO_ROOT, 'sanitize.local.json');
export const DEFAULT_OVERLAY_PATH = path.join(REPO_ROOT, 'video', 'capture', 'overlay.local.json');

export class LocalMapsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LocalMapsError';
  }
}

function refuseSerialise() {
  throw new LocalMapsError('local name maps hold real names and must never be serialised; report [denylisted #N] indices instead');
}

// Make an array or object refuse JSON.stringify and print only a summary.
function seal(target, summary) {
  Object.defineProperty(target, 'toJSON', { value: refuseSerialise });
  Object.defineProperty(target, inspect.custom, { value: () => summary });
  Object.defineProperty(target, 'toString', { value: () => summary });
  return target;
}

const defaultWarn = (msg) => process.stderr.write(`local-maps: ${msg}\n`);

// Parsed JSON, or null when the file does not exist. The JSON.parse message is dropped: V8 quotes
// a snippet of the input in it, which would leak real names.
function readJson(file, warn) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      warn(`${file} not found; continuing without it`);
      return null;
    }
    throw new LocalMapsError(`cannot read ${file} (${err.code ?? 'error'})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new LocalMapsError(`${file} is not valid JSON`);
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function stringPairs(obj, file, where) {
  if (!isPlainObject(obj)) throw new LocalMapsError(`${file}: ${where} must be an object of "real": "fictional" strings`);
  const out = [];
  Object.entries(obj).forEach(([real, fictional], i) => {
    if (typeof fictional !== 'string') throw new LocalMapsError(`${file}: ${where} entry #${i + 1} must map to a string`);
    if (real.trim() === '') throw new LocalMapsError(`${file}: ${where} entry #${i + 1} has an empty name`);
    out.push([real, fictional]);
  });
  return out;
}

export function loadLocalMaps({ sanitizePath, overlayPath, warn = defaultWarn } = {}) {
  const sFile = sanitizePath || process.env.SA_SANITIZE_PATH || DEFAULT_SANITIZE_PATH;
  const oFile = overlayPath || process.env.SA_OVERLAY_PATH || DEFAULT_OVERLAY_PATH;

  const sanitize = readJson(sFile, warn);
  const overlay = readJson(oFile, warn);

  const sanitizePairs = sanitize === null ? [] : stringPairs(sanitize, sFile, 'the file');
  let overlayPairs = [];
  let explicit = [];
  if (overlay !== null) {
    if (!isPlainObject(overlay)) throw new LocalMapsError(`${oFile}: must be an object with "pairs" and "denylist"`);
    if (overlay.pairs !== undefined) overlayPairs = stringPairs(overlay.pairs, oFile, '"pairs"');
    if (overlay.denylist !== undefined) {
      if (!Array.isArray(overlay.denylist)) throw new LocalMapsError(`${oFile}: "denylist" must be an array of strings`);
      overlay.denylist.forEach((term, i) => {
        if (typeof term !== 'string' || term.trim() === '') {
          throw new LocalMapsError(`${oFile}: "denylist" entry #${i + 1} must be a non-empty string`);
        }
      });
      explicit = overlay.denylist;
    }
  }

  // Pairs: first mapping of a real name wins; longest real first so "X Club" is replaced before "X".
  const seenPairs = new Set();
  const pairs = [];
  for (const [real, fictional] of [...sanitizePairs, ...overlayPairs]) {
    if (seenPairs.has(real)) continue;
    seenPairs.add(real);
    pairs.push([real, fictional]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length); // stable: ties keep file order

  const seenTerms = new Set();
  const denylist = [];
  for (const term of [...sanitizePairs.map(([r]) => r), ...overlayPairs.map(([r]) => r), ...explicit]) {
    const key = term.toLowerCase();
    if (seenTerms.has(key)) continue;
    seenTerms.add(key);
    denylist.push(term);
  }

  const summary = `<LocalMaps n_pairs=${pairs.length} n_denylist=${denylist.length}>`;
  seal(pairs, `<pairs n=${pairs.length}>`);
  seal(denylist, `<denylist n=${denylist.length}>`);
  const maps = { pairs, denylist };
  return seal(maps, summary);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = new WeakMap();

// One case-insensitive alternation, longest term first, so overlapping terms resolve to the
// longest match and a replacement is never re-scanned.
function matcher(maps) {
  let m = compiled.get(maps);
  if (!m) {
    const order = maps.denylist.map((term, i) => [term, i + 1]).sort((a, b) => b[0].length - a[0].length);
    const index = new Map(order.map(([term, n]) => [term.toLowerCase(), n]));
    const re = order.length ? new RegExp(order.map(([t]) => escapeRe(t)).join('|'), 'giu') : null;
    const lookup = (hit) => index.get(hit.toLowerCase())
      ?? order.find(([t]) => new RegExp(`^${escapeRe(t)}$`, 'iu').test(hit))?.[1] ?? 0;
    m = { re, lookup };
    compiled.set(maps, m);
  }
  return m;
}

// Every denylisted occurrence in text as { index, offset } (index is 1-based). Never the term.
export function findDenylisted(text, maps) {
  const { re, lookup } = matcher(maps);
  if (!re || !text) return [];
  const hits = [];
  for (const m of String(text).matchAll(re)) hits.push({ index: lookup(m[0]), offset: m.index });
  return hits;
}

// text with each denylisted term replaced by [denylisted #N].
export function redact(text, maps) {
  const { re, lookup } = matcher(maps);
  if (!re || !text) return text;
  return String(text).replace(re, (hit) => `[denylisted #${lookup(hit)}]`);
}

// node video/lib/local-maps.mjs --summary   prints counts only, to check local setup.
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  if (process.argv.includes('--summary')) {
    console.log(String(loadLocalMaps()));
  } else {
    process.stderr.write('Usage: node video/lib/local-maps.mjs --summary\n');
    process.exitCode = 64;
  }
}
