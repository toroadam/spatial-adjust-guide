// Loads the published guide data without a browser, for checks that read the guides as data:
// scripts/step-shape.mjs, scripts/readability.mjs and the label gates.
//
// Why it evaluates rather than scrapes. docs/audit-verification.md records an extractor that read
// the export with loose regexes and reported seventeen guides as having no cursor targets. TARGETS
// is filled in two places, the object literal near the top of the guide script and an
// Object.assign(TARGETS, ...) about 800 lines later, after GUIDES, and the regexes saw only the
// first. Here the guide script's data block is run in node:vm, so GUIDES, TARGETS and CATEGORIES
// are the objects the page itself builds, however many statements fill them.
//
// Why it runs after transformGuide(). The checks must see what the page publishes: the export
// with every anchored correction and rewrite applied, including the two guides that
// src/transform-export.mjs adds (request-scan-data, filter-adjustments) and any `<key>-part-N`
// guide a rewrite adds.
//
// The data block runs from `const FIGURES` to the `];` that closes `const CATEGORIES = [`. The end
// is found by matching brackets, skipping strings, template literals and comments, because guide
// prose is full of brackets and a greedy regex would stop at the wrong one. Everything the block
// references is declared inside it (fig, COL, rowY, cell, P, camera), so the sandbox starts empty.
// If the export ever references something declared outside the block, add a stub to STUBS.
//
// Usage:
//   import { loadGuides } from './lib/load-guides.mjs';
//   const { GUIDES, TARGETS, CATEGORIES, P, FIGURES, keys } = loadGuides();
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { transformGuide } from '../../src/transform-export.mjs';

export const EXPORT_FILE = 'Learn Spatial Adjust.dc.html';
const START_MARKER = 'const FIGURES';
const END_MARKER = 'const CATEGORIES = [';

/** Names the block references but does not declare. Empty today; see the header. */
const STUBS = {};

/** Thrown when the export no longer has the shape this loader expects. */
export class GuideDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GuideDataError';
  }
}

/** Index just past the string or template literal whose opening quote is at `i`. */
function skipString(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { j++; continue; }
    if (c === q) return j + 1;
    if (q === '`' && c === '$' && src[j + 1] === '{') { j = matchBracket(src, j + 1) - 1; continue; }
  }
  throw new GuideDataError(`unterminated string literal at offset ${i} in the guide data block`);
}

/** Index just past the bracket that closes the one at `open`, skipping strings and comments. */
export function matchBracket(src, open) {
  const closer = { '[': ']', '{': '}', '(': ')' };
  if (!closer[src[open]]) throw new GuideDataError(`expected a bracket at offset ${open}, found ${JSON.stringify(src[open])}`);
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i) - 1; continue; }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 1; continue; }
    if (closer[c]) stack.push(closer[c]);
    else if (c === ']' || c === '}' || c === ')') {
      if (stack.pop() !== c) throw new GuideDataError(`unbalanced "${c}" at offset ${i} in the guide data block`);
      if (!stack.length) return i + 1;
    }
  }
  throw new GuideDataError(`no closing bracket for the "${src[open]}" at offset ${open}`);
}

function exactlyOnce(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) {
    throw new GuideDataError(`marker ${JSON.stringify(marker)} not found in the export. `
      + 'The guide script has changed shape; update scripts/lib/load-guides.mjs.');
  }
  if (html.indexOf(marker, at + 1) >= 0) {
    throw new GuideDataError(`marker ${JSON.stringify(marker)} appears more than once in the export`);
  }
  return at;
}

/** For `<key>-part-N` (N >= 2), the parent key and N. For any other key, null. */
export function partOf(key) {
  const m = /^(.+)-part-(\d+)$/.exec(key);
  return m && Number(m[2]) >= 2 ? { base: m[1], n: Number(m[2]) } : null;
}

/**
 * Every guide key: the catalogue's keys in catalogue order, then any guide that has no card
 * (a `<key>-part-N`), placed straight after the guide it continues.
 */
export function guideKeys({ GUIDES, CATEGORIES }) {
  const cards = CATEGORIES.flatMap((c) => c.tasks.map((t) => t.key));
  const rest = Object.keys(GUIDES).filter((k) => !cards.includes(k));
  const keys = [];
  const place = (k) => {
    keys.push(k);
    for (const r of rest.filter((p) => partOf(p)?.base === k).sort((a, b) => partOf(a).n - partOf(b).n)) keys.push(r);
  };
  for (const k of cards) place(k);
  for (const k of rest) if (!keys.includes(k)) keys.push(k);
  return keys;
}

/**
 * Evaluates the guide data in an already transformed page. Returns plain objects:
 * { GUIDES, TARGETS, CATEGORIES, P, FIGURES, keys }.
 */
export function loadGuidesFromHtml(html) {
  const start = exactlyOnce(html, START_MARKER);
  const catAt = exactlyOnce(html, END_MARKER);
  if (catAt < start) throw new GuideDataError(`${JSON.stringify(END_MARKER)} comes before ${JSON.stringify(START_MARKER)}`);
  let end = matchBracket(html, catAt + END_MARKER.length - 1);
  if (html[end] === ';') end++;
  const block = html.slice(start, end);

  let out;
  try {
    out = vm.runInNewContext(`${block}\n;({ GUIDES, TARGETS, CATEGORIES, P, FIGURES })`, { ...STUBS },
      { filename: `${EXPORT_FILE}#guide-data`, timeout: 5000 });
  } catch (err) {
    const hint = err && err.name === 'ReferenceError'
      ? ' The block references a name it does not declare: add a stub to STUBS in scripts/lib/load-guides.mjs.'
      : '';
    throw new GuideDataError(`evaluating the guide data failed: ${err && err.message}.${hint}`);
  }
  // A JSON round trip leaves plain objects of this realm, with no functions and no prototypes
  // from the sandbox.
  const data = JSON.parse(JSON.stringify(out));
  return { ...data, keys: guideKeys(data) };
}

/**
 * Reads the export from `root`, applies transformGuide() and evaluates the guide data.
 * transformGuide is this repository's src/transform-export.mjs. `showBeta` is whether beta content
 * is published (src/release.mjs); it defaults to true, the text every check reads unless it says
 * otherwise. A check that compares the data with a served page passes the mode the page was built in.
 */
export function loadGuides({ root = process.cwd(), showBeta = true } = {}) {
  const html = readFileSync(join(root, EXPORT_FILE), 'utf8');
  return loadGuidesFromHtml(transformGuide(html, { showBeta }));
}
