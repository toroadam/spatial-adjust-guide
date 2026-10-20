// Caption tracks: one English WebVTT per video in, eleven localized WebVTT files out.
//
// How it fits together. Each shipped video names its English track in the media manifest
// (item.captions, a repo-relative src/media/captions/<key>.en-us.vtt). scripts/media-cues.mjs turns
// the cue text of every English track into an identity-keyed catalogue, src/i18n/captions/en-us.json,
// and the usual seed, translate and assemble scripts (with --catalogue captions) produce one
// src/i18n/captions/<locale>.json per language, keyed on the exact English cue text. At build time
// writeCaptionTracks() swaps each cue's text for its translation and writes
// dist/media/captions/<key>.<locale>.vtt. Ids, timings and cue settings are copied unchanged, so
// every language's track lines up with the picture exactly as the English one does.
//
// No partial track ever ships. A cue with no translation in any locale throws, naming the locale and
// the cue, which is the same rule scripts/assemble-locale.mjs applies to the page catalogues.
//
// Pure ESM with no DOM and no build imports, so build.mjs, scripts/ and tests can all use it.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseVtt, serializeVtt } from './vtt.mjs';

export const SOURCE_LOCALE = 'en-us';

/**
 * Every locale a caption track is written for: English plus the ten translated ones. Same list, in the
 * same order, as CONTENT_LOCALES in src/i18n.js; the media tests assert the two agree, so a locale
 * added to the site cannot quietly ship without captions.
 */
export const CAPTION_LOCALES = ['en-us', 'de-de', 'es-es', 'fr-fr', 'it-it', 'ja-jp', 'ko-ko', 'nl-nl', 'pt-pt', 'th-th', 'zh-cn'];

/** The locales whose cue text comes from a translation catalogue. */
export const TRANSLATED_LOCALES = CAPTION_LOCALES.filter((l) => l !== SOURCE_LOCALE);

/** The committed caption catalogues: src/i18n/captions/<locale>.json. */
export const DEFAULT_CAPTIONS_DIR = 'src/i18n/captions';

/** Where a track lands, relative to dist/ (and so to the page). */
export const trackPath = (key, locale) => `media/captions/${key}.${locale}.vtt`;

/** The distinct cue texts of a track, in first-seen order. These are the catalogue keys. */
export function cueStrings(cues) {
  return [...new Set(cues.map((cue) => cue.text))];
}

const clip = (text, n = 60) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

/**
 * The cues with their text translated through `strings` (English cue text -> translation). Ids,
 * timings and settings are unchanged. Throws `captions <locale>: N cue(s) untranslated` when any cue
 * has no non-empty translation, listing up to five of them by start time and text.
 */
export function localizeCues(cues, strings, locale) {
  const table = strings || {};
  const has = (text) => Object.hasOwn(table, text) && typeof table[text] === 'string' && table[text].trim() !== '';
  const untranslated = cues.filter((cue) => !has(cue.text));
  if (untranslated.length) {
    const samples = untranslated.slice(0, 5).map((cue) => `${cue.start} ${JSON.stringify(clip(cue.text))}`);
    const more = untranslated.length > 5 ? `\n  ... and ${untranslated.length - 5} more` : '';
    throw new Error(`captions ${locale}: ${untranslated.length} cue(s) untranslated:\n  ${samples.join('\n  ')}${more}`);
  }
  return cues.map((cue) => ({ ...cue, text: table[cue.text] }));
}

/**
 * The string map of every translated locale's caption catalogue in `captionsDir`, as
 * { <locale>: { <English cue>: <translation> } }. A catalogue file holds { strings } (plus _meta for
 * the committed ones). A missing file is an empty map, so the cues it should have held are reported
 * as untranslated, by locale, rather than as a file error; its absence is noted in `missing`.
 */
export async function loadCaptionCatalogues(captionsDir = DEFAULT_CAPTIONS_DIR) {
  const catalogues = {};
  const missing = [];
  for (const locale of TRANSLATED_LOCALES) {
    const path = join(captionsDir, `${locale}.json`);
    let text;
    try {
      text = await readFile(path, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      catalogues[locale] = {};
      missing.push(locale);
      continue;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(`caption catalogue ${path} is not valid JSON: ${err.message}`);
    }
    if (!data || typeof data.strings !== 'object' || data.strings === null || Array.isArray(data.strings)) {
      throw new Error(`caption catalogue ${path} has no "strings" map`);
    }
    catalogues[locale] = data.strings;
  }
  return { catalogues, missing };
}

/**
 * The WebVTT text of every locale's track for one English source, as { <locale>: <vtt text> }.
 * `catalogues` is the map loadCaptionCatalogues() returns. Throws one Error listing every locale with
 * untranslated cues (each line names the locale and the cues); `error.problems` holds the lines.
 */
export function captionTracks(sourceText, catalogues) {
  const { cues } = parseVtt(sourceText);
  if (!cues.length) throw new Error('the English track has no cues');
  const tracks = { [SOURCE_LOCALE]: serializeVtt(cues) };
  const problems = [];
  for (const locale of TRANSLATED_LOCALES) {
    try {
      tracks[locale] = serializeVtt(localizeCues(cues, (catalogues || {})[locale], locale));
    } catch (err) {
      problems.push(err.message);
    }
  }
  if (problems.length) {
    const err = new Error(problems.join('\n'));
    err.problems = problems;
    throw err;
  }
  return tracks;
}

/**
 * Write the eleven caption tracks of every item to <distDir>/media/captions/<key>.<locale>.vtt.
 * `items` is { <key>: manifest item }, and each item's `captions` is a path to its English track,
 * relative to `root`. Every track of every item is built before anything is written, so a failure
 * leaves no partial set behind. Throws one Error listing every problem, each prefixed with
 * "media: <key>:"; `error.problems` holds the lines.
 *
 * Returns { <key>: { <locale>: 'media/captions/<key>.<locale>.vtt' } }, paths relative to dist/.
 */
export async function writeCaptionTracks({ items, captionsDir = DEFAULT_CAPTIONS_DIR, distDir, root = process.cwd() }) {
  if (!distDir) throw new Error('writeCaptionTracks needs { distDir }');
  const entries = Object.entries(items || {});
  if (!entries.length) return {};

  const { catalogues, missing } = await loadCaptionCatalogues(resolve(root, captionsDir));
  const built = [];
  const problems = [];
  for (const [key, item] of entries) {
    if (!item || typeof item.captions !== 'string') {
      problems.push(`media: ${key}: no captions path`);
      continue;
    }
    let sourceText;
    try {
      sourceText = await readFile(resolve(root, item.captions), 'utf8');
    } catch (err) {
      problems.push(`media: ${key}: cannot read ${item.captions}: ${err.code === 'ENOENT' ? 'no such file' : err.message}`);
      continue;
    }
    try {
      built.push([key, captionTracks(sourceText, catalogues)]);
    } catch (err) {
      for (const line of err.problems || [err.message]) problems.push(`media: ${key}: ${item.captions}: ${line}`);
    }
  }
  if (problems.length) {
    const hint = missing.length ? `\n(no caption catalogue in ${captionsDir} for ${missing.join(', ')})` : '';
    const err = new Error(`caption tracks cannot be written:\n${problems.join('\n')}${hint}`);
    err.problems = problems;
    throw err;
  }

  const outDir = join(distDir, 'media', 'captions');
  await mkdir(outDir, { recursive: true });
  const map = {};
  for (const [key, tracks] of built) {
    map[key] = {};
    for (const locale of CAPTION_LOCALES) {
      await writeFile(join(distDir, trackPath(key, locale)), tracks[locale]);
      map[key][locale] = trackPath(key, locale);
    }
  }
  return map;
}
