// Assembles a locale catalogue from translated fragments and refuses to emit a partial one.
//
// Translation is done in chunks, so the failure mode this guards against is a catalogue that
// looks finished but silently leaves a third of the page in English — which on a rendered page
// reads as a bug in the site rather than as missing work. A missing or unknown key is a hard
// error here instead.
//
// --catalogue captions assembles a video caption catalogue the same way, with the same refusals:
// source src/i18n/captions/en-us.json, output src/i18n/captions/<locale>.json. Without the option
// (or with --catalogue main) it is the page catalogue, exactly as before.
//
// Usage: node scripts/assemble-locale.mjs <locale> <fragment-dir> [--catalogue main|captions]
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const at = argv.indexOf('--catalogue');
const catalogue = at === -1 ? 'main' : argv[at + 1];
if (catalogue !== 'main' && catalogue !== 'captions') throw new Error('--catalogue must be main or captions');
if (at !== -1) argv.splice(at, 2);
const captions = catalogue === 'captions';

const [locale, dir] = argv;
if (!locale || !dir) throw new Error('usage: assemble-locale.mjs <locale> <fragment-dir> [--catalogue main|captions]');
if (captions) {
  // A locale code, not a path: the output file name is built from it.
  if (!/^[a-z]{2}-[a-z]{2}$/.test(locale)) throw new Error(`${locale} is not a locale code like de-de`);
  if (locale === 'en-us') throw new Error('en-us is the caption source; regenerate it with scripts/media-cues.mjs');
}

const catalogueDir = captions ? 'src/i18n/captions' : 'src/i18n';
const source = JSON.parse(await readFile(join(catalogueDir, 'en-us.json'), 'utf8')).strings;

const merged = {};
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
  const part = JSON.parse(await readFile(join(dir, file), 'utf8'));
  for (const [k, v] of Object.entries(part)) {
    if (merged[k] !== undefined && merged[k] !== v) {
      throw new Error(`${locale}: "${k.slice(0, 60)}" translated twice, differently`);
    }
    merged[k] = v;
  }
}

const unknown = Object.keys(merged).filter((k) => !(k in source));
const missing = Object.keys(source).filter((k) => !(k in merged));
// An untranslated value is worse than a missing one: it claims coverage the reader does not
// get, and it hides in a diff. Only strings that are legitimately identical across languages
// (product names, route paths) should ever match, and those are few enough to eyeball.
const identical = Object.entries(merged).filter(([k, v]) => k === v).map(([k]) => k);

if (unknown.length) throw new Error(`${locale}: ${unknown.length} key(s) not in the source catalogue:\n  ${unknown.slice(0, 5).map((k) => k.slice(0, 60)).join('\n  ')}`);
if (missing.length) throw new Error(`${locale}: ${missing.length} string(s) still untranslated:\n  ${missing.slice(0, 5).map((k) => k.slice(0, 60)).join('\n  ')}`);

const ordered = Object.fromEntries(Object.keys(source).map((k) => [k, merged[k]]));
const out = `${catalogueDir}/${locale}.json`;
await writeFile(out, JSON.stringify({
  _meta: captions ? {
    note: 'Machine translation of the video caption cues in src/i18n/captions/en-us.json. Terminology '
        + 'follows IntelliDash\'s own shipped catalogues via src/i18n/glossary.json, and a cue that names a '
        + 'guide step uses that step heading\'s translation from the page catalogue. Mechanically validated '
        + 'by scripts/validate-locales.mjs — numbers, product names, structural characters and step-label '
        + 'agreement. NOT reviewed by a native speaker. Regenerate keys with scripts/media-cues.mjs after '
        + 'any change to an English caption track.',
    locale,
    strings: Object.keys(ordered).length,
    identicalToEnglish: identical.length,
    machineValidated: false,       // set by scripts/validate-locales.mjs once it passes
    nativeSpeakerReviewed: false,
    nativeReviewPlanned: false,
  } : {
    note: 'Machine translation. Terminology follows IntelliDash\'s own shipped catalogues via '
        + 'src/i18n/glossary.json. Mechanically validated by scripts/validate-locales.mjs — numbers, '
        + 'product names, structural characters and compound/standalone agreement. NOT reviewed by a '
        + 'native speaker: no native review is planned for this project, so treat this as the final '
        + 'state rather than a pending step. Regenerate keys with scripts/extract-strings.mjs after '
        + 'any Core Design re-export.',
    locale,
    strings: Object.keys(ordered).length,
    identicalToEnglish: identical.length,
    machineValidated: false,       // set by scripts/validate-locales.mjs once it passes
    nativeSpeakerReviewed: false,
    nativeReviewPlanned: false,
  },
  strings: ordered,
}, null, 2) + '\n');

console.log(`${out}: ${Object.keys(ordered).length} strings, ${identical.length} identical to English`);
