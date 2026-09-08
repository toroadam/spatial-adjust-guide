// Builds a terminology glossary from IntelliDash's own shipped translation catalogues, so the
// guides call things what the product calls them.
//
// A guide that says "open Settings" while the product's German build says "Einstellungen" is
// worse than untranslated: the reader goes looking for a control that does not exist under
// that name. IntelliDash already ships professionally translated catalogues for all eleven
// locales, so the authoritative rendering of every UI term is a lookup, not a judgement call.
//
// IntelliDash is READ ONLY here. The result is written into this repo so the guides stay
// self-contained and don't acquire a build-time dependency on a sibling checkout.
//
// Usage: node scripts/build-glossary.mjs [path-to-intellidash]
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ID = process.argv[2] || '/Users/adammunir/IntelliDash';
const DIR = join(ID, 'site/src/assets/i18n');
const LOCALES = ['de-de','es-es','fr-fr','it-it','nl-nl','pt-pt','ja-jp','ko-ko','th-th','zh-cn'];

const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flat(v, `${p}${k}.`, out);
    else out[`${p}${k}`] = String(v);
  }
  return out;
};

const en = flat(JSON.parse(await readFile(join(DIR, 'en-us.json'), 'utf8')));

// Short labels only. Long prose from IntelliDash is its own copy, not terminology, and
// including it would bloat the glossary without making any guide sentence more accurate.
const isTerm = (s) => s.length > 1 && s.length <= 40 && s.split(/\s+/).length <= 4 && /\p{L}/u.test(s);

const glossary = {};
for (const loc of LOCALES) {
  const tr = flat(JSON.parse(await readFile(join(DIR, `${loc}.json`), 'utf8')));
  const pairs = {};
  for (const [key, enVal] of Object.entries(en)) {
    const locVal = tr[key];
    if (!locVal || !isTerm(enVal) || locVal === enVal) continue;
    // First writer wins: duplicate English labels across keys almost always translate the
    // same way, and where they don't, an arbitrary pick would be worse than a stable one.
    if (!(enVal in pairs)) pairs[enVal] = locVal;
  }
  glossary[loc] = pairs;
}

const outFile = 'src/i18n/glossary.json';
await writeFile(outFile, JSON.stringify({
  _meta: {
    note: 'Terminology extracted from IntelliDash site/src/assets/i18n/*.json — the product\'s '
        + 'own shipped translations. Regenerate with scripts/build-glossary.mjs. '
        + 'Reference for translators; not loaded at runtime.',
    source: 'IntelliDash site/src/assets/i18n',
    locales: LOCALES.length,
  },
  ...glossary,
}, null, 2) + '\n');

console.log(`${outFile}: ${LOCALES.map((l) => `${l}=${Object.keys(glossary[l]).length}`).join(' ')}`);
