// Writes src/i18n/product-untranslated.json: the IntelliDash labels that the product shows in
// English in a given locale because no catalogue key translates them there.
//
// IntelliDash calls setDefaultLang(en-us) (site/src/app/common/services/app-initializer.service.ts:38),
// so a key missing from a locale's catalogue, or blank in it, renders the English value. At the
// production pin, SPATIAL_ADJUST.SETTINGS_MIN_THRESHOLD "Minimum Threshold (%)" is missing from
// all ten other catalogues, so every reader sees "Minimum Threshold (%)" in English whatever
// language they use. A guide that names that control in bold, [[Minimum Threshold (%)]], has to
// keep it English too, or it sends the reader hunting for a translation their screen never shows.
// scripts/lib/markers.mjs reads this file for that rule; it is committed because CI has no
// IntelliDash checkout.
//
// A label counts as untranslated in a locale only when NO key with that English value has a
// translation there: every one is missing, blank or shipped identical to the English. Where two
// keys share the English and one is translated, which one a screen uses cannot be told from the
// catalogues, so the label is left to the glossary.
//
// Only labels a Spatial Adjust screen can show are kept: values of SPATIAL_ADJUST.* keys, and of
// any other key the spatial-adjust module names in its templates and components. The rest of the
// product's catalogue is outside what these guides describe and stays out of this public repo.
// Values with markup, {{placeholders}} or URLs are dropped too: they are messages, not control
// labels, and a [[label]] marker can never hold one.
//
// IntelliDash is read-only: the catalogues are read with `git cat-file` at the production commit
// pinned in docs/claims/sources.json, and nothing in the checkout is touched.
//
// Usage: node scripts/product-untranslated.mjs [path-to-intellidash]
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const ID = process.argv[2] || '/Users/adammunir/IntelliDash';
const LOCALES = ['de-de', 'es-es', 'fr-fr', 'it-it', 'nl-nl', 'pt-pt', 'ja-jp', 'ko-ko', 'th-th', 'zh-cn'];
const sources = JSON.parse(await readFile('docs/claims/sources.json', 'utf8'));
const pin = sources.intellidash.production.sha;

const catalogue = (locale) => JSON.parse(execFileSync('git', ['-C', ID, 'cat-file', '-p', `${pin}:site/src/assets/i18n/${locale}.json`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flat(v, `${p}${k}.`, out);
    else out[`${p}${k}`] = String(v);
  }
  return out;
};

const en = flat(catalogue('en-us'));

// Every catalogue key the spatial-adjust module names. Keys built at run time are prefixed
// SPATIAL_ADJUST., which is kept whole below, so a literal scan is enough for the rest.
const git = (args) => execFileSync('git', ['-C', ID, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const moduleKeys = new Set();
for (const file of git(['ls-tree', '-r', '--name-only', pin, 'site/src/app/spatial-adjust']).split('\n')) {
  if (!/\.(ts|html)$/.test(file) || file.endsWith('.spec.ts')) continue;
  for (const m of git(['cat-file', '-p', `${pin}:${file}`]).matchAll(/[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+/g)) {
    if (en[m[0]] !== undefined) moduleKeys.add(m[0]);
  }
}
const onScreen = (k) => k.startsWith('SPATIAL_ADJUST.') || moduleKeys.has(k);

const keysOf = new Map();                      // English label -> every key with that value
for (const [k, v] of Object.entries(en)) {
  const label = v.trim();
  if (!label || !/\p{L}/u.test(label) || /[<>]|\{\{|https?:/.test(label)) continue;
  if (!keysOf.has(label)) keysOf.set(label, []);
  keysOf.get(label).push(k);
}

const labels = {};
for (const locale of LOCALES) {
  const tr = flat(catalogue(locale));
  for (const [label, keys] of keysOf) {
    if (!keys.some(onScreen)) continue;
    // Missing, blank or shipped identical to English under every key: English is what renders.
    const translated = keys.some((k) => typeof tr[k] === 'string' && tr[k].trim() && tr[k].trim() !== label);
    if (!translated) (labels[label] ||= []).push(locale);
  }
}

const sorted = Object.fromEntries(Object.keys(labels).sort((a, b) => a.localeCompare(b)).map((l) => [l, labels[l]]));
await writeFile('src/i18n/product-untranslated.json', JSON.stringify({
  _meta: {
    note: 'Spatial Adjust labels with no translation under any key in the listed locales, so '
      + 'IntelliDash renders them in English there (setDefaultLang en-us). Read by scripts/lib/markers.mjs: '
      + 'a [[label]] marker for one of these stays English in those locales. Regenerate with '
      + 'scripts/product-untranslated.mjs when the production pin in docs/claims/sources.json moves.',
    source: 'IntelliDash site/src/assets/i18n/*.json',
    productionSha: pin,
    labels: Object.keys(sorted).length,
  },
  labels: sorted,
}, null, 2) + '\n');

console.log(`src/i18n/product-untranslated.json: ${Object.keys(sorted).length} label(s) at ${pin.slice(0, 8)}`);
