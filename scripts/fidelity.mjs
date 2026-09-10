// Screen-fidelity gate: does the reproduction show what the product shows?
//
// The reproduction is the point of this site — a guide that names a control the reader cannot
// find is the exact failure the guides exist to prevent. Until this existed the only detection
// mechanism was a human noticing, which is how the Target Profiles pane came to depict a
// three-card list with ACTIVE badges and "Applied <date>" when the product ships a five-slot
// table with a Last Updated column and two per-row actions.
//
// TWO CHECKS, RUNNING IN OPPOSITE DIRECTIONS. Getting this wrong was the first attempt:
//
//   GATE (fails the build) — product -> reproduction.
//     Every label observed on a harvested product surface must appear in the reproduction.
//     Precise by construction: the fixture holds only labels actually seen live, so a miss
//     means the product shows something the guides do not. This is the check that names
//     "Last Updated" and "Update from Current" as absent from the entire guide corpus.
//
//   REPORT (advisory) — reproduction -> product.
//     Classifies every reproduced label by provenance. NOT a gate, because the fixture covers
//     only the surfaces harvested so far; "not in the fixture" means unverified, not wrong.
//     Reporting it as a failure was the bug in the first version — it flagged 27 labels as
//     diverged on nothing more than a shared four-letter word.
//
// Usage:
//   node scripts/fidelity.mjs                  # gate + summary; non-zero exit on a miss
//   node scripts/fidelity.mjs --report         # adds the full provenance classification
//   node scripts/fidelity.mjs --id <path>      # override the IntelliDash checkout
//
// PROVENANCE HAS FOUR OUTCOMES, not three. The first version had three and put a third of the
// corpus in the wrong one. Sample data — station identifiers, timestamps, the sanitizer's
// fictional course name — can never have product provenance because it is not a label, and
// counting it as unverified inflated the advisory total from 16 to 55 while putting a course
// name into a report that ships in a public repository.
import { readFile } from 'node:fs/promises';
import { loadCatalogue, scanHardcodedLiterals, isPureSampleData } from './product-provenance.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const reportOnly = argv.includes('--report');
const ID = arg('id', '/Users/adammunir/IntelliDash/site/src');
const dir = 'src/i18n';

// Same normalisation as scripts/validate-locales.mjs, for the same reasons: case and whitespace
// differences are things correct prose legitimately introduces and things the product itself
// ships (es-es AVG_VWC carries a double space). Digit runs collapse to N because the
// reproduction substitutes sample values into the product's own labels — "Push 6 Changes" is
// "Push 169 Changes" is "Push N Changes", and treating those as different labels is noise.
// The placeholder is lowercase deliberately. The harvest already substitutes a literal 'N'
// for scrubbed values, and lowercasing happens first, so an uppercase placeholder here made
// "Push 6 Changes" and the fixture's "Push N Changes" compare unequal — a false miss on the
// one label most obviously shared.
const norm = (s) => s.toLowerCase().replace(/\d+(?:[.,]\d+)?/g, 'n').replace(/[\s\u00a0]+/g, ' ').trim();

const flatten = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flatten(v, `${p}${k}.`, out); else out[`${p}${k}`] = String(v);
  }
  return out;
};

// ---- the reproduction --------------------------------------------------------------------------
const sourceCat = JSON.parse(await readFile(`${dir}/en-us.json`, 'utf8'));
const SCREEN = [...new Set(sourceCat._screenStrings || [])];
// Prose counts as "the corpus mentions it" for the structural checks: a concept named in guide
// text is documented even if it is not a reproduced label.
const CORPUS = Object.keys(sourceCat.strings);
const screenNorm = new Set(SCREEN.map(norm));
const corpusNorm = new Set(CORPUS.map(norm));

// ---- the product -------------------------------------------------------------------------------
// Optional on purpose. The GATE needs only the fixture, so it runs in CI where no IntelliDash
// checkout exists. Only the advisory provenance report needs the product's i18n, and it
// degrades to "unverified" rather than failing the build over a missing sibling repository.
let idByNorm = new Map();
let literals = new Map();
let templateCount = 0;
try {
  idByNorm = await loadCatalogue(ID);
  const scan = await scanHardcodedLiterals(ID);
  literals = scan.byNorm;
  templateCount = scan.templateCount;
} catch {
  console.error(`note: no IntelliDash checkout at ${ID} — provenance report degraded, gate unaffected.`);
}

let live = null;
try {
  live = JSON.parse(await readFile(`${dir}/product-labels.json`, 'utf8'));
} catch {
  console.error('WARNING: src/i18n/product-labels.json missing — the gate cannot run.');
  console.error('  Refresh it against a live instance: node scripts/fidelity-harvest.mjs');
  console.error('  Hardcoded product labels have no i18n key, so without the fixture they are invisible.');
}

// Labels observed live, with the surface they came from so a miss is actionable. Values that are
// pure data ("N", "-", "+") are dropped: they carry no label information.
const NOISE = /^(N|N%|-|\+|"|N°|)$/;
const liveLabels = [];
const collect = (v, where) => {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t && !NOISE.test(t)) liveLabels.push({ label: t, where });
    return;
  }
  if (Array.isArray(v)) { v.forEach((x) => collect(x, where)); return; }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'meta') continue;          // icon ids and other non-label bookkeeping
      collect(x, `${where}.${k}`);
    }
  }
};
if (live) {
  for (const [k, v] of Object.entries(live.surfaces || {})) collect(v, k);
  for (const [k, v] of Object.entries(live.tabs || {})) collect(v, `tab:${k}`);
}

// ---- GATE: product -> reproduction -------------------------------------------------------------
const missing = [];
const seen = new Set();
for (const { label, where } of liveLabels) {
  const n = norm(label);
  if (seen.has(n)) continue;
  seen.add(n);
  if (screenNorm.has(n) || corpusNorm.has(n)) continue;
  missing.push({ label, where });
}

// ---- REPORT: reproduction -> product -----------------------------------------------------------
const liveByNorm = new Set(liveLabels.map((l) => norm(l.label)));
const provenance = { data: [], keyed: [], literal: [], liveOnly: [], unverified: [] };
for (const label of SCREEN) {
  const n = norm(label);
  // Data first: a station id is not a label, so asking where it came from is the wrong question.
  if (isPureSampleData(label)) { provenance.data.push({ label }); continue; }
  if (idByNorm.has(n)) { provenance.keyed.push({ label, key: idByNorm.get(n) }); continue; }
  // Hardcoded in a template: English on every reader's screen. A product bug, not a guide one.
  if (literals.has(n)) { provenance.literal.push({ label, at: literals.get(n) }); continue; }
  if (liveByNorm.has(n)) { provenance.liveOnly.push({ label }); continue; }
  provenance.unverified.push({ label });
}

// ---- structural assertions ---------------------------------------------------------------------
// A label diff alone would not name these. Each is a concept the product exposes as a column or
// an action; the question is whether the corpus documents it at all.
const structural = [];
const tp = live?.tabs?.['Target Profiles'];
if (tp?.present) {
  for (const col of tp.columns || []) {
    structural.push({ concept: col, surface: 'Target Profiles column',
      documented: CORPUS.some((g) => norm(g).includes(norm(col))) });
  }
}

// ---- output ------------------------------------------------------------------------------------
console.log(`FIDELITY  reproduction: ${SCREEN.length} screen label(s) · product fixture: ${seen.size} distinct label(s)`);
if (live) console.log(`          fixture harvested ${live.harvestedAt}\n          from ${live.source}`);

console.log(`\nGATE  product -> reproduction`);
if (!live) {
  console.log('  SKIPPED — no fixture');
} else if (!missing.length) {
  console.log(`  every observed product label appears in the corpus`);
} else {
  console.log(`  ${missing.length} product label(s) the guides never show:`);
  for (const m of missing) console.log(`    ${JSON.stringify(m.label)}\n        seen on: ${m.where}`);
}

if (structural.length) {
  console.log(`\nSTRUCTURAL  Target Profiles columns the product renders`);
  for (const s of structural) {
    console.log(`  ${s.documented ? 'documented    ' : 'NOT DOCUMENTED'}  ${JSON.stringify(s.concept)}`);
  }
}

console.log(`\nPROVENANCE  reproduction -> product   (advisory, never gates)`);
if (templateCount) console.log(`          ${idByNorm.size} catalogue entries · ${literals.size} hardcoded literal(s) across ${templateCount} template(s)`);
console.log(`  sample data (not a label)     ${provenance.data.length}`);
console.log(`  keyed in IntelliDash i18n     ${provenance.keyed.length}`);
console.log(`  hardcoded in a template       ${provenance.literal.length}   <- English in all 11 locales`);
console.log(`  observed live, unkeyed        ${provenance.liveOnly.length}`);
console.log(`  unverified (surface unharvested) ${provenance.unverified.length}`);
if (reportOnly) {
  if (provenance.literal.length) {
    console.log('\n  --- hardcoded in IntelliDash source: a product bug ---');
    for (const p of provenance.literal) {
      console.log(`    ${JSON.stringify(p.label)}\n        ${p.at.file}:${p.at.line}  (${p.at.kind})`);
    }
  }
  if (provenance.liveOnly.length) {
    console.log('\n  --- observed live but unkeyed: hardcoded on an unscanned surface ---');
    for (const p of provenance.liveOnly) console.log(`    ${JSON.stringify(p.label)}`);
  }
  if (provenance.unverified.length) {
    console.log('\n  --- unverified: no key, no literal, never observed ---');
    for (const p of provenance.unverified) console.log(`    ${JSON.stringify(p.label)}`);
  }
}

const undocumented = structural.filter((s) => !s.documented);
const pass = live ? missing.length === 0 && undocumented.length === 0 : true;
console.log(`\nFIDELITY: ${pass ? 'PASS' : 'FAIL'}`);
if (!pass && !reportOnly) process.exit(1);
