// Writes src/i18n/labels.en-us.json: every English label a Spatial Adjust screen can show, with
// where it comes from. The labelProvenance gate in scripts/validate-locales.mjs reads it, so that
// every [[Exact Label]] marker in the guides is a label the reader's screen really shows
// (docs/writing-guide.md > Label markers). It is committed because CI has no IntelliDash checkout,
// and the gate must reach the same verdict with and without one, as product-labels.json does for
// the fidelity gate.
//
// What counts as a label, in this order of preference for the provenance recorded:
//   1. The hardcoded entries of the Settings dialog's left rail, taken from the committed fixture
//      src/i18n/product-labels.json (surfaces.settings.menu) and cross-checked against the
//      dialog's source at the production pin. IntelliDash paints them without the translate pipe,
//      so they have no catalogue key; the provenance is the source line that holds the literal.
//   2. Every SPATIAL_ADJUST.* value of IntelliDash's en-us.json.
//   3. Every other key the spatial-adjust module names in its templates and components (generic
//      labels it borrows, such as STRINGS.SETTINGS "Settings").
//   4. Every key whose value is a label the reproduction draws (src/i18n/en-us.json
//      _screenStrings), compared ignoring case and spacing because the product draws some labels
//      in capitals with CSS ("REVIEW THRESHOLD" on screen, "Review Threshold" in the catalogue).
//   5. The hardcoded column headers of the Target Profiles tab. The settings dialog's template writes
//      them as translate-pipe literals ({{ 'Update from Current' | translate }}) that are not keys of
//      any catalogue, so every locale of the product shows them in English. The provenance is the
//      template line that holds the literal.
// Where several keys share a value, a SPATIAL_ADJUST key is recorded first, then a key the module
// names, then the alphabetically first. Values with markup, placeholders ({{ num }}, {0}) or URLs
// are dropped, as scripts/product-untranslated.mjs drops them: they are messages, and a marker never
// holds one.
// The rest of the product's catalogue is outside what the guides describe and stays out of this
// public repository.
//
// IntelliDash is read-only: everything is read with `git cat-file` at the production commit pinned
// in docs/claims/sources.json. Nothing in the checkout is touched, and the fixture holds catalogue
// key names, product copy and path:line citations only, never source code.
//
// build.mjs ships only files named like a locale code (/^[a-z]{2}-[a-z]{2}\.json$/), so this file
// stays out of dist/.
//
// Usage:
//   node scripts/build-label-fixture.mjs [path-to-intellidash]           write the fixture
//   node scripts/build-label-fixture.mjs [path-to-intellidash] --check   exit 1 if the committed
//                                                                        fixture is out of date
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const OUT = 'src/i18n/labels.en-us.json';
const argv = process.argv.slice(2);
const check = argv.includes('--check');
const ID = argv.find((a) => !a.startsWith('--')) || '/Users/adammunir/IntelliDash';
const DIALOG = 'site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts';
const DIALOG_HTML = 'site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.html';

const sources = JSON.parse(await readFile('docs/claims/sources.json', 'utf8'));
const { sha: pin, ref } = sources.intellidash.production;
const git = (args) => execFileSync('git', ['-C', ID, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flat(v, `${p}${k}.`, out);
    else out[`${p}${k}`] = String(v);
  }
  return out;
};

const en = flat(JSON.parse(git(['cat-file', '-p', `${pin}:site/src/assets/i18n/en-us.json`])));

// Every catalogue key the spatial-adjust module names. Keys built at run time are prefixed
// SPATIAL_ADJUST., which is kept whole, so a literal scan is enough for the rest.
const moduleKeys = new Set();
for (const file of git(['ls-tree', '-r', '--name-only', pin, 'site/src/app/spatial-adjust']).split('\n')) {
  if (!/\.(ts|html)$/.test(file) || file.endsWith('.spec.ts')) continue;
  for (const m of git(['cat-file', '-p', `${pin}:${file}`]).matchAll(/[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+/g)) {
    if (en[m[0]] !== undefined) moduleKeys.add(m[0]);
  }
}

const norm = (s) => s.toLowerCase().replace(/[\s ]+/g, ' ').trim();
const sourceCat = JSON.parse(await readFile('src/i18n/en-us.json', 'utf8'));
const screen = new Set((sourceCat._screenStrings || []).map(norm));

const rank = (k) => (k.startsWith('SPATIAL_ADJUST.') ? 0 : moduleKeys.has(k) ? 1 : 2);
const catalogueLabels = new Map();            // label -> the keys that hold it, best first
for (const [k, v] of Object.entries(en)) {
  const label = v.trim();
  if (!label || !/\p{L}/u.test(label) || /[<>]|\{\{|\{\d+\}|https?:/.test(label)) continue;
  if (!(rank(k) < 2 || screen.has(norm(label)))) continue;
  if (!catalogueLabels.has(label)) catalogueLabels.set(label, []);
  catalogueLabels.get(label).push(k);
}

// The hardcoded rail. The fixture is the authority, as it is for scripts/lib/markers.mjs; the
// source at the pin supplies the line to cite and catches a fixture that has drifted from it.
const productLabels = JSON.parse(await readFile('src/i18n/product-labels.json', 'utf8'));
const menu = productLabels?.surfaces?.settings?.menu;
if (!Array.isArray(menu) || !menu.length) throw new Error('src/i18n/product-labels.json has no surfaces.settings.menu');
const lineOf = new Map();
git(['cat-file', '-p', `${pin}:${DIALOG}`]).split('\n').forEach((line, i) => {
  const m = line.match(/new SaDlgMenuItem\('([^']+)',\s*'([^']+)'/);
  // First occurrence wins: Calculation and Preferences share their description.
  if (m) for (const label of [m[1], m[2]]) if (!lineOf.has(label)) lineOf.set(label, i + 1);
});
const hardcoded = new Map();
for (const item of menu) {
  for (const label of [item.title, item.description].filter(Boolean)) {
    if (!lineOf.has(label)) {
      throw new Error(`product-labels.json lists the hardcoded label "${label}", but ${DIALOG} at ${pin.slice(0, 8)} `
        + 'does not: re-harvest product-labels.json (npm run fidelity:harvest) before rebuilding this fixture');
    }
    hardcoded.set(label, `hardcoded: ${DIALOG}:${lineOf.get(label)}`);
  }
}

// The Target Profiles column headers: a <th> whose translate-pipe literal is not a catalogue key.
// A literal that IS a key of en-us.json is translated by the product, and a value that is already
// a catalogue label above keeps that provenance, so both are left out here.
const headerLiterals = new Map();
git(['cat-file', '-p', `${pin}:${DIALOG_HTML}`]).split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/<th[^>]*>\s*\{\{\s*'([^']+)'\s*\|\s*translate\s*\}\}/g)) {
    if (en[m[1]] === undefined && !catalogueLabels.has(m[1]) && !headerLiterals.has(m[1])) headerLiterals.set(m[1], `hardcoded: ${DIALOG_HTML}:${i + 1}`);
  }
});
for (const [label, where] of headerLiterals) hardcoded.set(label, where);

const labels = {};
for (const [label, keys] of catalogueLabels) labels[label] = keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
for (const [label, where] of hardcoded) labels[label] = where;
const sorted = Object.fromEntries(Object.keys(labels).sort((a, b) => a.localeCompare(b)).map((l) => [l, labels[l]]));

const meta = {
  note: 'Every English label a Spatial Adjust screen can show, mapped to its IntelliDash catalogue key, '
    + 'or to the source line of a hardcoded literal. Read by the labelProvenance gate in '
    + 'scripts/validate-locales.mjs: each [[label]] marker in the guides must be a key here. Not shipped '
    + '(build.mjs copies only xx-xx.json). Regenerate with node scripts/build-label-fixture.mjs when the '
    + 'production pin in docs/claims/sources.json moves; never edit by hand.',
  source: `IntelliDash ${ref} site/src/assets/i18n/en-us.json and ${DIALOG}`,
  productionSha: pin,
  harvestedAt: new Date().toISOString(),
  rules: 'SPATIAL_ADJUST.* values; values of other keys the spatial-adjust module names; values matching a '
    + 'reproduced screen label (src/i18n/en-us.json _screenStrings), ignoring case and spacing; the hardcoded '
    + 'Settings rail titles and descriptions (src/i18n/product-labels.json surfaces.settings.menu); the hardcoded '
    + 'Target Profiles column headers (translate-pipe literals that no catalogue holds). Values '
    + 'with markup, placeholders or URLs are dropped.',
  labels: Object.keys(sorted).length,
};

if (check) {
  let committed;
  try { committed = JSON.parse(await readFile(OUT, 'utf8')); } catch { committed = null; }
  const same = committed && committed._meta?.productionSha === pin
    && JSON.stringify(committed.labels) === JSON.stringify(sorted);
  console.log(same ? `${OUT}: up to date at ${pin.slice(0, 8)} (${meta.labels} labels)`
    : `${OUT}: OUT OF DATE against ${pin.slice(0, 8)}; run node scripts/build-label-fixture.mjs`);
  process.exit(same ? 0 : 1);
}

await writeFile(OUT, JSON.stringify({ _meta: meta, labels: sorted }, null, 2) + '\n');
console.log(`${OUT}: ${meta.labels} label(s) at ${pin.slice(0, 8)} `
  + `(${hardcoded.size} hardcoded, ${moduleKeys.size} module key(s) scanned)`);
