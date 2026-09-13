// Where a reproduced label comes from in the real product.
//
// The fidelity report has to answer one question per label: can this be traced to IntelliDash?
// There are three ways it can be, and until this module existed only two were checked —
// so a label that IntelliDash hardcodes in a template landed in "unverified" alongside labels
// nobody had ever looked for. That is how "Soil Factor Editor" sat unclassified while shipping
// as `<p-header>{{ 'Soil Factor Editor' }}</p-header>` in the product.
//
//   1. KEYED    — a value in IntelliDash's shipped i18n catalogue. Localised; a reader on a
//                 German screen sees German.
//   2. LITERAL  — a hardcoded string in an IntelliDash template, with no i18n key and no
//                 translate pipe. English on every reader's screen, in all eleven locales.
//                 Finding these is a product bug report, not just a guide check.
//   3. LIVE     — observed in the harvest fixture but resolvable to neither of the above.
//
// Anything left is genuinely unverified: no key, no literal, never observed.
//
// A fourth category is not provenance at all. The reproduction substitutes sample values into
// the product's own labels — station identifiers, timestamps, percentages, the sanitizer's
// fictional course name. Those can never have product provenance because they are DATA, and
// counting them as unverified inflated the advisory total by roughly two thirds while putting
// a course name into a report that ships in a public repository.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_ID_SRC = '/Users/adammunir/IntelliDash/site/src';

// Same normalisation as scripts/validate-locales.mjs and scripts/fidelity.mjs, for the same
// reasons: case and whitespace vary in ways correct prose introduces and the product itself
// ships (es-es AVG_VWC carries a double space), and digit runs collapse because the
// reproduction substitutes sample values into real labels — "Push 6 Changes" and
// "Push 169 Changes" are one label.
export const norm = (s) =>
  s.toLowerCase().replace(/\d+(?:[.,]\d+)?/g, 'n').replace(/[\s ]+/g, ' ').trim();

// Sample data, not product labels. Carried over verbatim from scripts/app-strings.mjs, which
// already had to draw this line to avoid translating station identifiers into German.
//
// Kept deliberately narrow. A pattern loose enough to catch every value would also swallow real
// labels — "6 Available to Push" is a label with a number in it, and it stays classified.
const SAMPLE_DATA_PATTERNS = [
  '\\d+AP\\d+(?:-\\d+)?',            // station identifiers: 6AP1, 6AP1-2
  'AP',                                // the bare area prefix
  '[\\d\\s:.\\-\\/]+(?:AM|PM)?',      // timestamps and bare numeric runs
  '-?\\d+ to \\d+%',                   // numeric ranges: -5 to 5%
  'Riverbend National',                // the sanitizer's fictional course name
  // Seeded Target Profile names. A superintendent names their own profiles, so these are user
  // data in the same sense the course name is — the product ships no such strings, and
  // translating them would be wrong. Listed by name rather than by pattern because a pattern for
  // "looks like a profile name" would swallow real labels.
  'Summer Baseline|Tournament Week|Overseed Recovery',
  // Dates as the Last Updated column renders them: 14 Jun 2026. The numeric-run alternative above
  // cannot match these because of the month name.
  '\\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{4}',
  '% Adjust: \\d+%',                    // per-station sample values
  '\\u2192 Adjusted to \\d+%',
  '% ADJ\\. OVER \\d+%, UNDER \\d+%',
];

/**
 * Sample data, not a product label.
 *
 * 🔴 ANCHORED, and that matters. An unanchored alternation matched a PREFIX: "-5 to 5%" hit the
 * bare-numeric-run alternative at "-5 " and, being shorter than the whole string, was reported
 * as a label rather than as data. Every alternative must consume the entire string.
 *
 * Kept deliberately narrow. A pattern loose enough to catch every value would also swallow real
 * labels — "6 Available to Push" and "Pushing Percent Adjustments to Lynx (4 of 6)" are labels
 * with numbers in them, and they stay classified.
 */
export const SAMPLE_DATA = new RegExp(`^(?:${SAMPLE_DATA_PATTERNS.join('|')})$`);

/** True when the string is entirely sample data rather than a label containing a value. */
export const isPureSampleData = (s) => SAMPLE_DATA.test(s.trim());

const flatten = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flatten(v, `${p}${k}.`, out);
    else out[`${p}${k}`] = String(v);
  }
  return out;
};

/**
 * IntelliDash's shipped English catalogue, as normalised-label -> key.
 *
 * First writer wins, matching scripts/app-strings.mjs: two keys carrying the same English text
 * are the same label as far as a reader is concerned.
 */
export async function loadCatalogue(idSrc = DEFAULT_ID_SRC) {
  const en = flatten(JSON.parse(await readFile(join(idSrc, 'assets/i18n/en-us.json'), 'utf8')));
  const byNorm = new Map();
  for (const [key, value] of Object.entries(en)) {
    const n = norm(value);
    if (n && !byNorm.has(n)) byNorm.set(n, key);
  }
  return byNorm;
}

// A translate pipe means the string IS keyed, so its presence disqualifies a literal.
const TRANSLATED = /\|\s*translate/;
// i18n keys are SCREAMING_SNAKE with dots. A literal contains lowercase or spaces.
const KEY_SHAPED = /^[A-Z0-9_]+(?:\.[A-Z0-9_]+)*$/;

// Attributes that carry user-visible text. Deliberately a list rather than "any attribute":
// `class`, `id`, `formControlName` and `styleClass` are full of capitalised words that are not
// labels, and including them buried the real findings.
const TEXT_ATTRS = ['placeholder', 'header', 'label', 'title', 'ariaLabel', 'aria-label', 'tooltip', 'emptyMessage'];

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** A literal found hardcoded in a template. */
export function extractLiterals(source, file) {
  const found = [];
  const push = (text, kind, line) => {
    const t = text.trim();
    // Must read like prose: at least one letter, and not an i18n key.
    if (t.length < 2 || t.length > 80) return;
    if (!/[a-zA-Z]/.test(t)) return;
    if (KEY_SHAPED.test(t)) return;
    // Technical strings that are not user-visible text: data URIs, MIME types,
    // paths and CSS. They pass the "reads like prose" test and are not labels.
    if (/^(data:|https?:|\/|\.\/|#[0-9a-f]{3,8}$)/i.test(t)) return;
    if (/[{}<>$]|;\s*base64|\bpx\b/.test(t)) return;
    found.push({ label: t, kind, file, line });
  };

  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const lineNo = i + 1;

    // `{{ 'Some Text' }}`. Without a translate pipe it is hardcoded. WITH one, the literal is
    // being used as an i18n KEY — which is fine only if the catalogue defines it. When it does
    // not, ngx-translate emits the key verbatim, so the string renders in English in every
    // locale while looking perfectly translated in the template. Captured as its own kind so
    // the caller can tell those two cases apart.
    for (const m of line.matchAll(/\{\{\s*'([^']+)'\s*([^}]*)\}\}/g)) {
      push(m[1], TRANSLATED.test(m[2] ?? '') ? 'translate-key' : 'interpolated', lineNo);
    }

    // Plain text attributes. A binding (`[attr]=`) is excluded by requiring the bare name.
    for (const attr of TEXT_ATTRS) {
      const re = new RegExp(`(?<![\\[\\w-])${attr}="([^"{]+)"`, 'g');
      for (const m of line.matchAll(re)) push(m[1], `attr:${attr}`, lineNo);
    }
  });

  return found;
}

/**
 * Scan an IntelliDash checkout for hardcoded UI literals.
 *
 * Returns normalised-label -> first occurrence. Templates only: a literal in a .ts file is
 * usually a log line, an enum or an object key, and including them produced far more noise than
 * findings. Stated rather than silently assumed — if a real label is ever set from TypeScript,
 * this will not see it.
 */
export async function scanHardcodedLiterals(idSrc = DEFAULT_ID_SRC) {
  const templates = await walk(idSrc);
  const byNorm = new Map();        // hardcoded: no translate pipe at all
  const keyedByNorm = new Map();   // used as a translate key; may or may not exist in the catalogue
  for (const file of templates) {
    let source;
    try {
      source = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const lit of extractLiterals(source, file.replace(`${idSrc}/`, ''))) {
      const n = norm(lit.label);
      if (!n) continue;
      const target = lit.kind === 'translate-key' ? keyedByNorm : byNorm;
      if (!target.has(n)) target.set(n, lit);
    }
  }
  return { byNorm, keyedByNorm, templateCount: templates.length };
}

// ---- self-check ---------------------------------------------------------------------------------
// Run directly: node scripts/product-provenance.mjs
//
// The classifier decides whether a string is a label at all, and it got that wrong once in a way
// nothing would have caught: an unanchored alternation matched "-5 " inside "-5 to 5%", so a
// numeric range was reported as an unverified product label. These cases pin both directions —
// data that must be recognised, and labels-containing-numbers that must NOT be.
const CASES = [
  // data, not labels
  ['-5 to 5%', true],
  ['6AP1', true],
  ['6AP1-2', true],
  ['AP', true],
  ['08-07-25 5:42 AM', true],
  ['Riverbend National', true],
  // seeded Target Profile names and the dates the Last Updated column renders
  ['Summer Baseline', true],
  ['Tournament Week', true],
  ['Overseed Recovery', true],
  ['14 Jun 2026', true],
  ['02 May 2026', true],
  ['% Adjust: 121%', true],
  ['→ Adjusted to 10%', true],
  ['% ADJ. OVER 200%, UNDER 10%', true],
  // labels that merely contain a number
  ['6 Available to Push', false],
  ['6 Pushed Today', false],
  ['Push 6 Changes', false],
  ['Pushing Percent Adjustments to Lynx (4 of 6)', false],
  ['Calculation ET: 0.34 in', false],
  ['4 holes selected', false],
  ['Last Updated', false],
  ['Update from Current', false],
];

const NORM_CASES = [
  // digit collapsing makes one label out of every sample value
  ['Push 6 Changes', 'Push 169 Changes'],
  ['Push 6 Changes', 'push  6   changes'],
  // the product's own es-es AVG_VWC ships a double space
  ['Avg  VWC', 'Avg VWC'],
];

// [markup, hardcoded count, translate-key count]. Asserting the KIND, not just the total,
// because the two mean opposite things to a reader: a hardcoded literal is a product string with
// no key at all, while a translate-key is keyed and only renders English if the catalogue happens
// to be missing it. Counting them together would let one silently become the other.
const LITERAL_CASES = [
  // key-shaped and piped: an ordinary, correctly translated string. Neither kind.
  [`<p>{{ 'STRINGS.CLOSE' | translate }}</p>`, 0, 0],
  // Prose piped through translate is the literal being USED as a key. Real: the diagnostics
  // dialog title and the push progress header both do this, and neither key exists in any of
  // IntelliDash's eleven catalogues, so both render English everywhere.
  [`<p-header>{{ 'Spatial Adjust Diagnostics' | translate }}</p-header>`, 0, 1],
  [`<p-header>{{ 'Pushing Changes To Lynx' | translate | titlecase }}</p-header>`, 0, 1],
  // No pipe at all: hardcoded, unreachable by translation.
  [`<p-header>{{ 'Soil Factor Editor' }}</p-header>`, 1, 0],
  [`<td class="sa-ddt-label">{{ 'Can ping cloud:' }}</td>`, 1, 0],
  [`<input placeholder="Filter area">`, 1, 0],
  // a binding is not a plain attribute
  [`<input [placeholder]="something">`, 0, 0],
  // key-shaped strings are keys someone forgot to pipe, not labels
  [`<p>{{ 'SPATIAL_ADJUST.AVG_VWC' }}</p>`, 0, 0],
  // technical strings are not user-visible text
  [`<img src="x" title="data:image/jpg;base64,">`, 0, 0],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  let failures = 0;
  const check = (ok, what) => {
    if (!ok) { failures++; console.error(`  FAIL  ${what}`); }
  };

  for (const [input, want] of CASES) {
    check(isPureSampleData(input) === want, `isPureSampleData(${JSON.stringify(input)}) should be ${want}`);
  }
  for (const [a, b] of NORM_CASES) {
    check(norm(a) === norm(b), `norm(${JSON.stringify(a)}) should equal norm(${JSON.stringify(b)})`);
  }
  for (const [markup, wantHard, wantKey] of LITERAL_CASES) {
    const found = extractLiterals(markup, 'test.html');
    const hard = found.filter((f) => f.kind !== 'translate-key').length;
    const keyed = found.filter((f) => f.kind === 'translate-key').length;
    check(hard === wantHard && keyed === wantKey,
      `extractLiterals(${JSON.stringify(markup)}) should find ${wantHard} hardcoded / ${wantKey} `
      + `translate-key, found ${hard} / ${keyed}`);
  }

  const total = CASES.length + NORM_CASES.length + LITERAL_CASES.length;
  if (failures) {
    console.error(`\nprovenance self-check: ${failures} of ${total} FAILED`);
    process.exit(1);
  }
  console.log(`provenance self-check: ${total} case(s) OK`);
}
