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

// ---- FULL RENDERED INVENTORY -------------------------------------------------------------------
// _screenStrings is hand-maintained: an inventory of what someone remembered to list, not of what
// the reproduction shows. A live harvest found 167 rendered labels against 85 listed — half the
// reproduction was unchecked by construction, which is how the map legend went on rendering
// "6-16%" for months after the prose beside it was corrected.
//
// scripts/repro-inventory.mjs harvests the real set. This classifies it against the product.
let repro = null;
try { repro = JSON.parse(await readFile(`${dir}/repro-labels.json`, 'utf8')); } catch { /* optional */ }

// Glyphs and values are not labels. Icon text (⚙ ⟳ ✓ ❯), numeric ranges, percentages and sample
// figures carry no wording to verify, and reporting them buries the findings that matter.
const NOT_A_LABEL = /^(\s*[^\p{L}]+\s*|[\d.,\s%+-]+|[<>]\s*-?\d+\s*%?|-?\d+\s*-\s*-?\d+\s*%?)$/u;

// Product strings are parameterised — "{{num}} stations could not be updated in Lynx." — and the
// reproduction substitutes real values. Comparing literally reports every such string as having
// no product backing, which was 58 of them before this existed.
const paramMatchers = [];
try {
  const flatEn = (o, pre = '', out = {}) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') flatEn(v, `${pre}${k}.`, out); else out[`${pre}${k}`] = String(v);
    }
    return out;
  };
  // Read directly rather than via loadCatalogue: that returns normalised-label -> key, and the
  // placeholders have to survive intact to become a pattern.
  const raw = flatEn(JSON.parse(await readFile(`${ID}/assets/i18n/en-us.json`, 'utf8')));
  for (const [key, value] of Object.entries(raw)) {
    if (!/\{\{\s*\w+\s*\}\}/.test(value)) continue;
    const pattern = value.trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{\\\{\s*\w+\s*\\\}\\\}/g, '.+?');
    paramMatchers.push({ rx: new RegExp(`^${pattern}$`, 'i'), key, template: value });
  }
} catch { /* no checkout: parameterised matching degrades, gate unaffected */ }

// Strings this project writes into the figure itself. Not product UI, so absence from the
// product is expected rather than a finding.
const GUIDE_CHROME = ['In development', 'not in the shipping build', 'Concept'];
// Fictional identifiers, rendered primitives, and the product names PROTECTED already guards.
const SAMPLE_OR_BRAND = /^(riverbend[\w-]*|true|false|null|-?\d+ to -?\d+%|Toro|IntelliDash|Spatial Adjust|Lynx|TurfRad|VWC|ET)$/i;
let manualNorm = new Set();
try {
  const manual = JSON.parse(await readFile(`${dir}/app-manual.json`, 'utf8'));
  manualNorm = new Set(Object.keys(manual).filter((k) => k !== '_meta').map(norm));
} catch { /* optional */ }
const reproReport = { checked: 0, keyed: 0, parameterised: 0, live: 0, notALabel: 0,
  sampleValued: 0, guideChrome: 0, manuallyDecided: 0, sampleOrBrand: 0, unbacked: [] };
if (repro) {
  for (const { text, guides: inGuides } of repro.labels) {
    if (NOT_A_LABEL.test(text)) { reproReport.notALabel++; continue; }
    reproReport.checked++;
    const n = norm(text);
    if (idByNorm.has(n)) { reproReport.keyed++; continue; }
    if (liveByNorm.has(n)) { reproReport.live++; continue; }
    const pm = paramMatchers.find((m) => m.rx.test(text.trim()));
    if (pm) { reproReport.parameterised++; continue; }
    // Sample values substituted into a real label: "% Adjust: 0%" and "Calculation ET: 0.34 in"
    // are the product's labels carrying the reproduction's fictional readings. Collapsing digit
    // runs compares the wording rather than the data, the same trick the product fixture uses.
    const digitless = norm(text).replace(/\d+(?:[.,]\d+)?/g, 'n');
    const anyDigitless = [...idByNorm.keys(), ...liveByNorm]
      .some((k) => k.replace(/\d+(?:[.,]\d+)?/g, 'n') === digitless);
    if (anyDigitless) { reproReport.sampleValued++; continue; }
    // Chrome this project authored — disclaimers and captions wrapped around the figure. It is
    // guide text, not product UI, so the product having no such string is correct.
    if (GUIDE_CHROME.some((g) => norm(text).includes(norm(g)))) { reproReport.guideChrome++; continue; }
    // src/i18n/app-manual.json is the existing register of screen labels that are NOT in
    // IntelliDash's shipped catalogue and were therefore decided by hand. A label listed there is
    // already an acknowledged judgement call, not a new discovery — separating them is what turns
    // this list from "53 unverifiable labels" into the handful nobody has looked at.
    if (manualNorm.has(norm(text))) { reproReport.manuallyDecided++; continue; }
    // Sample data and bare product names. "riverbend-742" is the fictional course id the
    // sanitiser substitutes, "true" is a rendered boolean, "TurfRad" is a trademark that appears
    // as its own label. None is wording to verify against a catalogue, and reporting them makes
    // the list cry wolf about the very placeholders the repo deliberately ships.
    if (SAMPLE_OR_BRAND.test(text.trim())) { reproReport.sampleOrBrand++; continue; }
    reproReport.unbacked.push({ text, guides: inGuides || [] });
  }
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

if (repro) {
  console.log(`\nFULL INVENTORY  every label the reproduction renders, not just the curated list`);
  console.log(`  harvested ${repro.labels.length} label(s) from ${repro.steps} step(s) across ${repro.guides} guide(s)`);
  console.log(`  glyphs / values, not labels   ${reproReport.notALabel}`);
  console.log(`  keyed in IntelliDash i18n     ${reproReport.keyed}`);
  console.log(`  matched a parameterised key   ${reproReport.parameterised}`);
  console.log(`  observed live                 ${reproReport.live}`);
  console.log(`  real label + sample value     ${reproReport.sampleValued}`);
  console.log(`  guide chrome, not product UI  ${reproReport.guideChrome}`);
  console.log(`  hand-decided (app-manual.json) ${reproReport.manuallyDecided}`);
  console.log(`  sample data / product name    ${reproReport.sampleOrBrand}`);
  console.log(`  NO PRODUCT BACKING            ${reproReport.unbacked.length}`);
  if (reproReport.unbacked.length) {
    console.log('\n  --- rendered by the guides, found nowhere in the product ---');
    // Grouped by the guides that render them. A surface's labels share a guide set, so this
    // turns a flat list of 30-odd strings into the handful of actual surfaces behind them —
    // one unharvestable dialog reads very differently from fifteen separate defects.
    const groups = new Map();
    for (const u of reproReport.unbacked) {
      const k = (u.guides || []).join(', ') || '(unknown)';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(u.text);
    }
    for (const [where, texts] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n    ${texts.length} label(s) in: ${where}`);
      for (const t of texts.sort()) console.log(`      ${JSON.stringify(t.slice(0, 90))}`);
    }
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
