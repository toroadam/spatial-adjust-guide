// Seeds .translate/<locale>/ from the catalogue already in src/i18n/, so a translate run picks
// up only the strings whose English actually changed.
//
// scripts/translate.mjs computes `todo` as the source keys with no fragment yet. With an empty
// fragment directory that is all 972 strings, which is the right behaviour for a new locale and
// entirely the wrong one after a six-string prose correction — it would pay to re-translate, and
// re-review, 966 strings that nobody touched.
//
// scripts/retranslate-drift.mjs already solved this for its own case by seeding the fragments it
// does NOT want re-translated. This is the same trick without the drift-specific selection: seed
// every key the catalogue already has AND the source still asks for. Keys the catalogue holds
// under superseded English are dropped rather than carried, which is what makes them `todo` —
// and carrying them would fail assemble-locale.mjs's unknown-key check anyway.
//
// Usage: node scripts/seed-translate-fragments.mjs [locale ...]     (default: all ten)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const LOCALES = ['de-de', 'es-es', 'fr-fr', 'it-it', 'nl-nl', 'pt-pt', 'ja-jp', 'ko-ko', 'th-th', 'zh-cn'];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : LOCALES;

const source = JSON.parse(await readFile('src/i18n/en-us.json', 'utf8')).strings;

for (const locale of targets) {
  const existing = JSON.parse(await readFile(join('src/i18n', `${locale}.json`), 'utf8')).strings;
  const seed = {};
  for (const [k, v] of Object.entries(existing)) if (k in source) seed[k] = v;

  const dir = join('.translate', locale);
  await mkdir(dir, { recursive: true });
  // chunk-000 sorts ahead of anything translate.mjs writes, and assemble-locale.mjs only
  // complains when two fragments disagree — which they cannot, since todo excludes these keys.
  await writeFile(join(dir, 'chunk-000-seed.json'), JSON.stringify(seed, null, 2) + '\n');

  const todo = Object.keys(source).filter((k) => !(k in seed));
  console.log(`${locale}: seeded ${Object.keys(seed).length}, ${todo.length} to translate`);
  if (todo.length) for (const k of todo) console.log(`    ${k.slice(0, 88)}`);
}
