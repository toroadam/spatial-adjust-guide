// Builds the caption source catalogue, src/i18n/captions/en-us.json, from the English caption tracks.
//
// Every shipped video has an English WebVTT in src/media/captions/<key>.en-us.vtt (the manifest's
// item.captions). Its cue text is what gets translated, so it goes through the same catalogue
// pipeline as the page strings: this script writes an identity-keyed catalogue in the shape
// scripts/extract-strings.mjs writes for src/i18n/en-us.json, and seed-translate-fragments.mjs,
// translate.mjs and assemble-locale.mjs take it from there with --catalogue captions.
//
// Why a catalogue of its own. extract-strings.mjs rebuilds src/i18n/en-us.json wholesale from the
// rendered page, so cue strings stored there would vanish on the next harvest, and every reader would
// download them with the page catalogue whether they watch or not. src/i18n/captions/ is a
// subdirectory, outside the locale-file filter build.mjs, validate-locales.mjs and i18n.mjs apply to
// src/i18n/, so nothing in it ships as a page catalogue by accident.
//
// _contexts records where each cue is spoken, as "<key>@<start>", so a translator can find it in the
// video. A sentence spoken in two places is one string with two contexts.
//
// English-only items. A manifest item whose captionLocales names no translated locale ships its English
// track alone (the episodes, until their cues are translated), so its cues are not harvested here:
// they would otherwise show up as ten locales of untranslated strings. List the locales in the item to
// bring it into this catalogue.
//
// Usage:
//   node scripts/media-cues.mjs            write src/i18n/captions/en-us.json
//   node scripts/media-cues.mjs --check    exit 1 when the committed file is not what this would write
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseVtt } from '../src/media/vtt.mjs';
import { DEFAULT_MANIFEST, loadManifest } from '../src/media/manifest.mjs';
import { TRANSLATED_LOCALES } from '../src/media/captions.mjs';

const ROOT = join(import.meta.dirname, '..');
const SOURCE_DIR = 'src/media/captions';
const OUT = 'src/i18n/captions/en-us.json';
const SUFFIX = '.en-us.vtt';
const KEY = /^[a-z0-9-]+$/;

const check = process.argv.includes('--check');
const unknownArgs = process.argv.slice(2).filter((a) => a !== '--check');
if (unknownArgs.length) throw new Error(`usage: media-cues.mjs [--check]; unexpected ${unknownArgs.join(' ')}`);

let files = [];
try {
  files = (await readdir(join(ROOT, SOURCE_DIR))).filter((f) => f.endsWith('.vtt')).sort();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const manifest = await loadManifest(join(ROOT, DEFAULT_MANIFEST)).catch(() => ({ items: {} }));
const englishOnly = (key) => {
  const locales = manifest.items && manifest.items[key] && manifest.items[key].captionLocales;
  return Array.isArray(locales) && !locales.some((l) => TRANSLATED_LOCALES.includes(l));
};

const contexts = new Map(); // cue text -> ['<key>@<start>', ...]
for (const file of files) {
  // English sources only. A translated track is a build output, written into dist/ from the
  // catalogues; one committed here would bypass them.
  if (!file.endsWith(SUFFIX)) throw new Error(`${SOURCE_DIR}/${file}: only English sources (<key>${SUFFIX}) belong in ${SOURCE_DIR}`);
  const key = file.slice(0, -SUFFIX.length);
  if (!KEY.test(key)) throw new Error(`${SOURCE_DIR}/${file}: the key "${key}" must be lowercase letters, digits and "-", like a manifest key`);
  let cues;
  try {
    ({ cues } = parseVtt(await readFile(join(ROOT, SOURCE_DIR, file), 'utf8')));
  } catch (err) {
    throw new Error(`${SOURCE_DIR}/${file}: ${err.message}`);
  }
  if (!cues.length) throw new Error(`${SOURCE_DIR}/${file}: has no cues`);
  if (englishOnly(key)) continue;
  for (const cue of cues) {
    if (!contexts.has(cue.text)) contexts.set(cue.text, []);
    contexts.get(cue.text).push(`${key}@${cue.start}`);
  }
}

const sorted = [...contexts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const catalogue = {
  _meta: {
    note: 'Caption source strings harvested from src/media/captions/*.en-us.vtt by scripts/media-cues.mjs. '
        + 'Keys are the exact English cue text, with a multi-line cue joined by single spaces; '
        + 'src/media/captions.mjs matches on them verbatim when it writes the localized tracks. '
        + 'Regenerate after any change to an English caption track.',
    locale: 'en-us',
    strings: sorted.length,
    words: sorted.reduce((n, [s]) => n + s.split(/\s+/).length, 0),
  },
  strings: Object.fromEntries(sorted.map(([s]) => [s, s])),
  _contexts: Object.fromEntries(sorted),
};
const text = JSON.stringify(catalogue, null, 2) + '\n';

if (check) {
  let committed = null;
  try {
    committed = await readFile(join(ROOT, OUT), 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (committed !== text) {
    console.error(`${OUT} is ${committed === null ? 'missing' : 'stale'}: it does not match ${files.length} English track(s) in ${SOURCE_DIR}. Run: node scripts/media-cues.mjs`);
    process.exit(1);
  }
  console.log(`${OUT}: up to date - ${catalogue._meta.strings} strings from ${files.length} track(s)`);
} else {
  await mkdir(join(ROOT, 'src/i18n/captions'), { recursive: true });
  await writeFile(join(ROOT, OUT), text);
  console.log(`${OUT}: ${catalogue._meta.strings} strings, ${catalogue._meta.words} words from ${files.length} track(s)`);
}
