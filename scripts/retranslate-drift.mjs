// Re-translates only the strings whose prose names a reproduced control by the wrong name.
//
// scripts/validate-locales.mjs reports these as advisory screenLabelDrift. They are not sloppy
// translations: the system prompt in scripts/translate.mjs told the model both "keep VWC
// untranslated" and "use the glossary", and for four locales IntelliDash's own label translates
// VWC away. Faced with the contradiction the model kept the English acronym, which is why the two
// VWC labels alone account for 123 of the findings. The rest are ordinary glossary misses.
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
//   node scripts/retranslate-drift.mjs --all --apply --include-deferred
//
// Deferred by default are the labels whose correction is a judgement call rather than a
// glossary lookup, because a blind fix would make the prose worse:
//   - Target VWC / Avg. VWC / Adjust Target VWC %: es/fr/ko/th ship a label with no "VWC" in it,
//     so matching the label trips the droppedToken GATE. That needs an EXEMPT entry alongside it
//     (validate-locales.mjs already carries one for th-th) — a decision, not a lookup.
//   - Preferences / Settings: IntelliDash ships both as "Einstellungen" in German, so matching
//     the label makes the German prose ambiguous where it is currently clear.
// A string that names a deferred label AND a mechanical one is held back too: re-translating it
// would rewrite the deferred term as a side effect.
import { readFile, writeFile, readdir, mkdir, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';

const dir = 'src/i18n';
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const apply = argv.includes('--apply');
const includeDeferred = argv.includes('--include-deferred');
const one = arg('locale');
if (!one && !argv.includes('--all')) throw new Error('usage: retranslate-drift.mjs (--locale <code> | --all) [--apply] [--include-deferred]');

// A named control is "present" if it appears allowing for case and whitespace. Both differences
// are things the reader's eye passes over and correct prose legitimately introduces: Dutch
// lowercases and inflects an adjective mid-sentence ("de voorgestelde percentages" for a label
// reading "Voorgesteld"), and IntelliDash's own es-es AVG_VWC ships a double space
// ("Promedio de  CVA") that prose can only match by reproducing the typo. Demanding a verbatim
// match reported 49 findings whose "fix" would have been to write worse prose.
// Spaces adjacent to CJK characters are dropped before comparing. Chinese, Japanese and Thai do
// not use the space as a word separator, so "平均 VWC" and "平均VWC" are the same label to a
// reader — and the product ships one form while the prose uses the other. Treating them as
// different reported seven Chinese findings that no reader could perceive.
const stripCjkSpaces = (s) => s.replace(/(?<=[\u3000-\u9fff\uff00-\uffef\u0e00-\u0e7f])\s+|\s+(?=[\u3000-\u9fff\uff00-\uffef\u0e00-\u0e7f])/g, '');
const present = (haystack, needle) => {
  const flat = (s) => stripCjkSpaces(s.toLowerCase().replace(/[\s\u00a0]+/g, ' '));
  return flat(haystack).includes(flat(needle));
};

// Longest match wins. "Suggested" is a substring of "Suggested Percent Adjust Calculation", so
// prose naming the FIELD was also being required to name the COLUMN — two different controls that
// merely share a word. Requiring both forces a sentence to quote a label it is not about, which is
// how a findability check starts producing worse prose than it found.
const shadowed = (label, named) => named.some((other) => other !== label && other.includes(label));

const DEFERRED = new Set(['Target VWC', 'Avg. VWC', 'Adjust Target VWC %', 'Preferences', 'Settings']);

const sourceCat = JSON.parse(await readFile(`${dir}/en-us.json`, 'utf8'));
const SCREEN = [...new Set(sourceCat._screenStrings || [])].filter((s) => s.length >= 8);
const glossary = JSON.parse(await readFile(`${dir}/glossary.json`, 'utf8'));

const locales = (await readdir(dir))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .map((f) => f.replace('.json', ''))
  .filter((l) => !one || l === one);
if (one && !locales.length) throw new Error(`no catalogue for ${one}`);

let grandTotal = 0, grandHeld = 0;

for (const locale of locales) {
  const cat = JSON.parse(await readFile(`${dir}/${locale}.json`, 'utf8'));
  const t = cat.strings;
  const gl = glossary[locale] || {};

  // Same predicate as validate-locales.mjs, including the provenance gate: a label absent from
  // IntelliDash's shipped catalogue has no product rendering to be faithful to, so prose that
  // names it cannot be "wrong" against anything.
  const terms = {};
  let held = 0;
  for (const [en, tr] of Object.entries(t)) {
    if (SCREEN.includes(en)) continue;
    const namedAll = SCREEN.filter((l) => en.includes(l) && l in gl);
    const named = namedAll.filter((l) => !shadowed(l, namedAll));
    const drifted = named.filter((l) => !present(tr, t[l]));
    const mechanical = drifted.filter((l) => !DEFERRED.has(l));
    if (!drifted.length) continue;

    if (!includeDeferred) {
      if (!mechanical.length) { held += drifted.length; continue; }
      // Names a deferred label as well — rewriting the sentence would move that term too.
      if (named.some((l) => DEFERRED.has(l))) { held += drifted.length; continue; }
    }
    // Require every named label with product provenance, not just the drifted ones: a
    // re-translation must not break a term it currently gets right.
    terms[en] = named.map((l) => t[l]);
  }

  const todo = Object.keys(terms);
  const count = todo.reduce((a, en) => a + terms[en].length, 0);
  grandTotal += todo.length;
  grandHeld += held;
  console.log(`${locale}: ${todo.length} string(s) to re-translate (${count} label constraint(s))${held ? `, ${held} finding(s) held back` : ''}`);
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

console.log(`\n${grandTotal} string(s) across ${locales.length} locale(s) queued for re-translation${grandHeld ? `, ${grandHeld} finding(s) deferred` : ''}`);
if (!apply) console.log('report only — pass --apply to seed the resume directories');
