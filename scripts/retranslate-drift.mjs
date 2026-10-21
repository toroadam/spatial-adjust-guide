// Re-translates only the strings whose prose names a reproduced control by the wrong name.
//
// scripts/validate-locales.mjs fails these as screenLabelDrift, a gate since 2026-10-20 (it was
// advisory while 308, then 136, stood; the 2026-09-12 VWC ruling took the count to 0). This is the
// repair tool for when a new translation trips it. Both scripts take the predicate from
// scripts/lib/screen-labels.mjs, with the same hardcoded labels (scripts/lib/markers.mjs), so the
// queue here is exactly the set of strings the gate fails.
//
// Rather than re-translate 960 strings per locale, this seeds the resume directory that
// translate.mjs already reads: every string that is NOT drifted is written as an existing
// fragment, so translate.mjs computes `todo` as exactly the drifted set. It also writes a
// per-locale terms file naming the labels each string must contain verbatim, which translate.mjs
// turns into a hard per-string constraint and verifies on the way back.
//
// Usage:
//   node scripts/retranslate-drift.mjs --all                    # report, change nothing
//   node scripts/retranslate-drift.mjs --locale de-de --apply   # seed, then run translate.mjs
//
// Nothing is deferred any more. The two families once held back are settled rules
// (docs/writing-guide.md > Label markers):
//   - Target VWC / Avg. VWC / Adjust Target VWC %: name the control with its shipped label, even
//     where that drops the acronym; validate-locales.mjs exempts exactly that from droppedToken.
//   - Settings / Preferences: Preferences is hardcoded English and is not checked; where a locale
//     ships one word for two controls, keep the shipped label and say where the control is.
import { readFile, writeFile, readdir, mkdir, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { hardcodedLabels } from './lib/markers.mjs';
import { namedScreenLabels, driftedScreenLabels } from './lib/screen-labels.mjs';

const dir = 'src/i18n';
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const apply = argv.includes('--apply');
const one = arg('locale');
if (!one && !argv.includes('--all')) throw new Error('usage: retranslate-drift.mjs (--locale <code> | --all) [--apply]');

const sourceCat = JSON.parse(await readFile(`${dir}/en-us.json`, 'utf8'));
const SCREEN = new Set(sourceCat._screenStrings || []);
const glossary = JSON.parse(await readFile(`${dir}/glossary.json`, 'utf8'));
const hardcoded = hardcodedLabels();

const locales = (await readdir(dir))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .map((f) => f.replace('.json', ''))
  .filter((l) => !one || l === one);
if (one && !locales.length) throw new Error(`no catalogue for ${one}`);

let grandTotal = 0;

for (const locale of locales) {
  const cat = JSON.parse(await readFile(`${dir}/${locale}.json`, 'utf8'));
  const t = cat.strings;
  const ctx = { t, screen: SCREEN, glossary: glossary[locale] || {}, hardcoded };

  const terms = {};
  for (const [en, tr] of Object.entries(t)) {
    if (!driftedScreenLabels(en, String(tr), ctx).length) continue;
    // Require every named label, not just the drifted ones: a re-translation must not break a
    // term it currently gets right.
    terms[en] = namedScreenLabels(en, ctx).map((l) => t[l]);
  }

  const todo = Object.keys(terms);
  const count = todo.reduce((a, en) => a + terms[en].length, 0);
  grandTotal += todo.length;
  console.log(`${locale}: ${todo.length} string(s) to re-translate (${count} label constraint(s))`);
  if (!apply || !todo.length) continue;

  const fragmentDir = join('.translate', locale);
  // Existing fragments hold the drifted translations; leaving them in place would make
  // translate.mjs consider these strings already done. Keep a copy before replacing them.
  try {
    await cp(fragmentDir, join('.translate', `.bak-${locale}`), { recursive: true });
    console.log(`  backed up existing fragments to .translate/.bak-${locale}`);
  } catch { /* no fragments for this locale yet */ }
  await rm(fragmentDir, { recursive: true, force: true });
  await mkdir(fragmentDir, { recursive: true });

  // Everything the re-translation must NOT touch, written as an already-done fragment. Sorts
  // after chunk-*.json and shares no key with them, so assemble-locale's duplicate check is
  // satisfied by construction.
  const seed = Object.fromEntries(Object.entries(t).filter(([en]) => !(en in terms)));
  await writeFile(join(fragmentDir, 'seed-existing.json'), JSON.stringify(seed, null, 2) + '\n');
  // Outside fragmentDir on purpose: translate.mjs and assemble-locale.mjs both treat every
  // *.json in there as a fragment of the catalogue.
  await writeFile(join('.translate', `${locale}.terms.json`), JSON.stringify(terms, null, 2) + '\n');
  console.log(`  seeded ${Object.keys(seed).length} untouched string(s); next: npm run translate -- --locale ${locale}`);
}

console.log(`\n${grandTotal} string(s) across ${locales.length} locale(s) queued for re-translation`);
if (!apply) console.log('report only — pass --apply to seed the resume directories');
