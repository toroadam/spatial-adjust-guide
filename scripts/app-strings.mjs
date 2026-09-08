// Adds the reproduced IntelliDash screen (.sa-app) to the translation catalogues.
//
// The guides frame a faithful reproduction of the real Spatial Adjust screen. That reproduction
// shipped in English in every locale, so a German reader got German prose wrapped around an English
// screenshot — and the prose names controls ("open Settings") that the screenshot then labels
// differently. Translating the reproduction makes it MORE faithful, not less: the real IntelliDash
// is localised, so an English screen is the inaccurate one.
//
// Wherever a screen label exists in IntelliDash's own shipped catalogue, this takes the product's
// ACTUAL translation rather than producing a new one. That is roughly half the strings, and it is
// the half a reader is most likely to hunt for on their own screen.
//
// Usage: node scripts/app-strings.mjs <harvested.json> [--write]
import { readFile, writeFile } from 'node:fs/promises';

const ID = '/Users/adammunir/IntelliDash/site/src/assets/i18n';
const LOCALES = ['de-de','es-es','fr-fr','it-it','ja-jp','ko-ko','nl-nl','pt-pt','th-th','zh-cn'];
const harvestPath = process.argv[2];
const write = process.argv.includes('--write');
if (!harvestPath) throw new Error('usage: app-strings.mjs <harvested.json> [--write]');

const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flat(v, `${p}${k}.`, out); else out[`${p}${k}`] = String(v);
  }
  return out;
};

const harvested = JSON.parse(await readFile(harvestPath, 'utf8'));
const enID = flat(JSON.parse(await readFile(`${ID}/en-us.json`, 'utf8')));

// English value -> IntelliDash key. First writer wins: duplicate labels translate the same way.
const keyOf = {};
for (const [k, v] of Object.entries(enID)) if (!(v.trim() in keyOf)) keyOf[v.trim()] = k;
const keyOfCI = {};
for (const [v, k] of Object.entries(keyOf)) if (!(v.toLowerCase() in keyOfCI)) keyOfCI[v.toLowerCase()] = k;

// Left verbatim on purpose: station identifiers a reader reads off their own screen, timestamps,
// numeric ranges, and the fictional site name the sanitizer substitutes in. Translating any of
// these would make the reproduction wrong, not localised.
const VERBATIM = /^(\d+AP\d+(-\d+)?|AP|[\d\s:.-]+(AM|PM)?|-?\d+ to \d+%|Riverbend National)$/;

const perLocale = {};
const unmatched = new Set();
for (const locale of LOCALES) {
  const tr = flat(JSON.parse(await readFile(`${ID}/${locale}.json`, 'utf8')));
  const map = {};
  for (const s of harvested) {
    if (VERBATIM.test(s)) { map[s] = s; continue; }
    const k = keyOf[s] ?? keyOfCI[s.toLowerCase()];
    if (k && tr[k] && tr[k].trim()) map[s] = tr[k].trim();
    else unmatched.add(s);
  }
  perLocale[locale] = map;
}

const covered = harvested.length - unmatched.size;
console.log(`${harvested.length} screen strings — ${covered} resolved from IntelliDash's own catalogues, ${unmatched.size} need translating`);

if (!write) {
  console.log(JSON.stringify([...unmatched], null, 2));
} else {
  const manual = JSON.parse(await readFile('src/i18n/app-manual.json', 'utf8'));
  const missing = [...unmatched].filter((s) => !manual[s]);
  if (missing.length) throw new Error(`src/i18n/app-manual.json is missing ${missing.length} string(s):\n  ${missing.slice(0,6).join('\n  ')}`);

  // en-us first: the source catalogue has to know these keys or assemble/validate reject them.
  const enPath = 'src/i18n/en-us.json';
  const enCat = JSON.parse(await readFile(enPath, 'utf8'));
  let added = 0;
  for (const s of harvested) if (!(s in enCat.strings)) { enCat.strings[s] = s; added++; }
  enCat._meta.strings = Object.keys(enCat.strings).length;
  await writeFile(enPath, JSON.stringify(enCat, null, 2) + '\n');
  console.log(`en-us.json: +${added} screen strings (${enCat._meta.strings} total)`);

  for (const locale of LOCALES) {
    const p = `src/i18n/${locale}.json`;
    const cat = JSON.parse(await readFile(p, 'utf8'));
    for (const s of harvested) {
      cat.strings[s] = perLocale[locale][s] ?? manual[s][locale] ?? s;
    }
    cat._meta.strings = Object.keys(cat.strings).length;
    cat._meta.screenStringsFromProduct = Object.values(perLocale[locale]).length;
    await writeFile(p, JSON.stringify(cat, null, 2) + '\n');
    console.log(`${locale}: ${cat._meta.strings} strings`);
  }
}
