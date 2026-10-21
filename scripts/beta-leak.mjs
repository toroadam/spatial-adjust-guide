// Whole-dist leak check: proves a build with SA_SHOW_BETA=false publishes no beta content anywhere.
//
// Why a separate check. src/transforms/release-gate.mjs proves the guide data in index.html is clean,
// and build.mjs drops the beta-only keys from the shipped catalogues. Neither looks at the rest of
// dist/: a copied asset named after a beta guide, a translation that slipped through, a manifest or
// sitemap added later. This walks every file under dist/ and reads it the way a reader's browser, or
// anyone who downloads the site, could.
//
// What it looks for. Everything is computed from the release file and the export, not kept as a list:
//   - each beta guide key, as a whole word (so 'key', "key", #/key and a file name are all caught, but
//     not a longer GA key that contains it),
//   - each beta guide's title, tile title and summaries, and each beta step title of a GA guide,
//   - every beta-only string (betaOnlyStrings() in src/transforms/release-gate.mjs), which includes
//     the Beta badge and banner strings and the registered cross-reference sentences,
//   - each locale's translation, from src/i18n/<locale>.json, of every catalogue key a build without
//     beta leaves out (catalogueOmissions()), so a beta sentence cannot ship in German either,
//   - the class names lsa-beta-badge and lsa-beta-banner, and the banner sentence.
// Text files (html, js, css, json, txt, svg, xml, vtt, map and the like) are read as UTF-8 with runs
// of whitespace collapsed. Every file name is checked for a beta key. A hit names the file, the
// needle, what kind of needle it is and 60 characters of context, so a false positive is easy to judge.
//
// Also, when beta content is hidden: the catalogue in dist/index.html has exactly one tile per GA
// guide, robots.txt exists, no sitemap*.xml or media manifest names a beta key, and dist/ holds no
// release file.
//
// The mode. SA_SHOW_BETA is read once, through parseShowBeta() in src/release.mjs, exactly as the
// build reads it, and the release file through loadRelease(), which honours SA_RELEASE_FILE (tests
// only). The check fails when dist/index.html says it was built in the other mode
// (<meta name="sa-release-mode">), so a stale dist/ cannot pass for the wrong reason. When beta
// content is shown the check reports and exits 0; with --expect-shown it also asserts that every
// beta guide key, every beta step title and the badge class are in dist/index.html.
//
// Usage: node scripts/beta-leak.mjs [--dist <dir>] [--expect-shown]
//   SA_SHOW_BETA=false SA_RELEASE_FILE=test/fixtures/release.fixture.json npm run build
//   SA_SHOW_BETA=false SA_RELEASE_FILE=test/fixtures/release.fixture.json npm run test:leak
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import {
  parseShowBeta, loadRelease, betaSteps, BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT,
} from '../src/release.mjs';
import { transformGuide } from '../src/transform-export.mjs';
import {
  evaluateGuideData, betaOnlyStrings, catalogueOmissions,
} from '../src/transforms/release-gate.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const EXPORT = 'Learn Spatial Adjust.dc.html';
const CONTEXT = 60; // characters of context around each hit, split either side of the needle
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.txt', '.svg',
  '.xml', '.vtt', '.srt', '.map', '.md', '.csv', '.webmanifest', '']);
const CLASSES = ['lsa-beta-badge', 'lsa-beta-banner'];

// ---- arguments and mode ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i >= 0) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
};
const DIST = resolve(ROOT, option('--dist') || 'dist');
const expectShown = args.includes('--expect-shown');
const showBeta = parseShowBeta(process.env.SA_SHOW_BETA);
const { release, file: releaseFile } = loadRelease();
const shownPath = (p) => (p.startsWith(ROOT + sep) ? relative(ROOT, p) : p);

const failures = [];
const notes = [];
const fail = (message) => failures.push(message);

// ---- matching -------------------------------------------------------------------------------------

const WORD = /[\p{L}\p{N}_]/u;
const KEY_CHAR = /[A-Za-z0-9_-]/;

/** The ways a string can be written in a shipped file: as is, JSON- or JS-escaped, HTML-escaped. */
function spellings(text) {
  const out = new Set([text]);
  const uEscape = (t, upper) => t.replace(/[^\x00-\x7f]/g, (c) => {
    const hex = c.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${upper ? hex.toUpperCase() : hex}`;
  });
  for (const t of [text, uEscape(text, false), uEscape(text, true)]) {
    out.add(t);
    out.add(t.replace(/'/g, "\\'"));
    out.add(t.replace(/"/g, '\\"'));
  }
  const html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  out.add(html);
  out.add(html.replace(/"/g, '&quot;'));
  out.add(html.replace(/'/g, '&#39;'));
  out.add(html.replace(/'/g, '&#x27;'));
  return [...out];
}

/** Offsets of `needle` in `hay`, keeping only whole words where the needle starts or ends with one. */
function hits(hay, needle, isWordChar = (c) => WORD.test(c)) {
  const out = [];
  const startsWord = isWordChar(needle[0]);
  const endsWord = isWordChar(needle[needle.length - 1]);
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    if (startsWord && at > 0 && isWordChar(hay[at - 1])) continue;
    const after = hay[at + needle.length];
    if (endsWord && after !== undefined && isWordChar(after)) continue;
    out.push(at);
  }
  return out;
}

const context = (hay, at, length) => {
  const half = CONTEXT / 2;
  return JSON.stringify(hay.slice(Math.max(0, at - half), at + length + half));
};

/** How a key hit is written: a link, a quoted key, or the key as a word (a file name, a class). */
function keyKind(hay, at, key) {
  if (hay.slice(Math.max(0, at - 2), at) === '#/') return `link #/${key}`;
  const before = hay[at - 1];
  const after = hay[at + key.length];
  if ((before === "'" || before === '"') && after === before) return `quoted key ${before}${key}${before}`;
  return 'key as a whole word';
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

// ---- what is beta, computed the way the build computes it -------------------------------------------

const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
const exported = readFileSync(join(ROOT, EXPORT), 'utf8');
const allData = evaluateGuideData(transformGuide(exported, { showBeta: true, release }));
const shippedData = evaluateGuideData(transformGuide(exported, { showBeta: false, release }));
const catalogue = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'en-us.json'), 'utf8'));
const tilesOf = (data) => data.CATEGORIES.flatMap((c) => c.tasks);

const guideKeys = Object.keys(allData.GUIDES);
const betaGuides = guideKeys.filter((k) => release.guides[k].status === 'beta');
const gaGuides = guideKeys.filter((k) => release.guides[k].status === 'ga');
const betaStepTitles = gaGuides.flatMap((k) => betaSteps(release, k).map((title) => ({ key: k, title })));

const { omit } = catalogueOmissions({ allData, shippedData, release, catalogue });
const betaOnly = betaOnlyStrings({
  allData, shippedData, release,
  catalogueKeys: Object.keys(catalogue.strings || {}),
  keep: Object.values(catalogue._screenStrings || {}),
});

// Needles: text -> { kind, strict }. The first kind recorded for a text wins, so the most specific
// label is kept. A strict needle is always checked. A loose one (a beta-only string or its
// translation) is dropped when the content that ships in the same language also contains it as a
// whole word, because then finding it proves nothing: the Korean for "Example." is part of the
// Korean for "Worked example.", which a GA guide uses. Dropped needles are counted and listed.
const needles = new Map();
const ambiguous = [];
const addNeedle = (text, kind, { strict = false, corpus = null } = {}) => {
  if (typeof text !== 'string') return;
  const t = norm(text);
  if (!t || needles.has(t)) return;
  if (!strict && corpus && hits(corpus, t).length) { ambiguous.push(`${t} (${kind})`); return; }
  needles.set(t, kind);
};

/** Every string value in a JSON-like object, normalised. */
const stringsIn = (v, out = []) => {
  if (typeof v === 'string') out.push(norm(v));
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => stringsIn(x, out));
  return out;
};
// What ships in English: the guide data a build without beta keeps, and every catalogue key it keeps.
const englishCorpus = [
  ...stringsIn(shippedData),
  ...Object.keys(catalogue.strings || {}).filter((k) => !omit.has(k)),
  ...stringsIn(catalogue._screenStrings || {}),
].join('\u0000');

for (const key of betaGuides) {
  const g = allData.GUIDES[key];
  const tile = tilesOf(allData).find((t) => t.key === key) || {};
  addNeedle(g.title, `title of beta guide "${key}"`, { strict: true });
  addNeedle(tile.title, `tile title of beta guide "${key}"`, { strict: true });
  addNeedle(g.summary, `summary of beta guide "${key}"`, { strict: true });
  addNeedle(tile.summary, `tile summary of beta guide "${key}"`, { strict: true });
}
for (const { key, title } of betaStepTitles) addNeedle(title, `beta step of GA guide "${key}"`, { strict: true });
addNeedle(BETA_BANNER_TEXT, 'the Beta banner sentence', { strict: true });
addNeedle(BETA_BANNER_LABEL, 'the Beta banner label', { strict: true });
addNeedle(BETA_BADGE_LABEL, 'the Beta badge label', { strict: true });
for (const s of betaOnly) addNeedle(s, 'beta-only string', { corpus: englishCorpus });
for (const k of omit) addNeedle(k, 'beta-only catalogue key', { corpus: englishCorpus });

// Translations of the keys a build without beta leaves out, checked against what ships in the same
// locale.
const localeFiles = readdirSync(join(ROOT, 'src', 'i18n'))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .sort();
for (const file of localeFiles) {
  const locale = file.replace(/\.json$/, '');
  const strings = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', file), 'utf8')).strings || {};
  const corpus = Object.entries(strings).filter(([k]) => !omit.has(k)).map(([, v]) => norm(v)).join('\u0000');
  for (const key of omit) {
    const value = strings[key];
    if (typeof value !== 'string' || !norm(value)) continue;
    const strict = [BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT].includes(key);
    addNeedle(value, `${locale} translation of beta-only key ${JSON.stringify(key.length > 50 ? `${key.slice(0, 50)}…` : key)}`,
      { strict, corpus });
  }
}

// ---- the scan -------------------------------------------------------------------------------------

let files;
try {
  files = walk(DIST).sort();
} catch (err) {
  console.error(`beta-leak: cannot read ${shownPath(DIST)}: ${err.message}. Run npm run build first.`);
  process.exit(1);
}
const rel = (p) => relative(DIST, p).split(sep).join('/');
const indexPath = join(DIST, 'index.html');
const indexHtml = files.includes(indexPath) ? readFileSync(indexPath, 'utf8') : '';
if (!indexHtml) fail(`${shownPath(indexPath)} is missing`);

// The build records its mode in the page. Comparing it with SA_SHOW_BETA here means the check and
// the build read the same variable, and a dist/ built the other way fails instead of passing.
const builtMode = (/<meta name="sa-release-mode" content="([^"]*)">/.exec(indexHtml) || [])[1];
const wantMode = showBeta ? 'with-beta' : 'ga-only';
if (indexHtml && builtMode !== wantMode) {
  fail(`dist/index.html was built as ${builtMode === undefined ? 'an unknown mode' : `"${builtMode}"`}, but SA_SHOW_BETA=`
    + `${process.env.SA_SHOW_BETA === undefined ? 'unset' : JSON.stringify(process.env.SA_SHOW_BETA)} means "${wantMode}". `
    + 'Build and check with the same SA_SHOW_BETA.');
}

const found = [];
let textFiles = 0;
let otherFiles = 0;
for (const path of files) {
  const name = rel(path);
  for (const key of betaGuides) {
    for (const at of hits(name, key, (c) => KEY_CHAR.test(c))) {
      found.push({ file: name, needle: key, kind: 'beta guide key in a file name', context: context(name, at, key.length) });
    }
  }
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) { otherFiles++; continue; }
  textFiles++;
  const text = norm(readFileSync(path, 'utf8'));
  for (const key of betaGuides) {
    for (const at of hits(text, key, (c) => KEY_CHAR.test(c))) {
      found.push({ file: name, needle: key, kind: keyKind(text, at, key), context: context(text, at, key.length) });
    }
  }
  for (const cls of CLASSES) {
    for (const at of hits(text, cls, (c) => KEY_CHAR.test(c))) {
      found.push({ file: name, needle: cls, kind: 'beta class name', context: context(text, at, cls.length) });
    }
  }
  for (const [needle, kind] of needles) {
    for (const spelling of spellings(needle)) {
      for (const at of hits(text, spelling)) {
        found.push({ file: name, needle, kind, context: context(text, at, spelling.length) });
      }
    }
  }
}
// One report per file, needle and place: several spellings can match the same text.
const seen = new Set();
const leaks = found.filter((f) => {
  const id = `${f.file}\u0000${f.needle}\u0000${f.context}`;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
});

// ---- mode-specific assertions ---------------------------------------------------------------------

let tileCount = null;
if (indexHtml) {
  try {
    tileCount = tilesOf(evaluateGuideData(indexHtml)).length;
  } catch (err) {
    fail(`cannot read the catalogue tiles in dist/index.html: ${err.message}`);
  }
}

if (!showBeta) {
  for (const l of leaks) fail(`leak in ${l.file}: ${JSON.stringify(l.needle)} (${l.kind}) in ${l.context}`);
  if (tileCount !== null && tileCount !== gaGuides.length) {
    fail(`dist/index.html has ${tileCount} catalogue tiles; the release has ${gaGuides.length} GA guides`);
  }
  if (!files.includes(join(DIST, 'robots.txt'))) fail('dist/robots.txt is missing');
  const manifests = files.map(rel).filter((f) => /(^|\/)sitemap[^/]*\.xml$/i.test(f)
    || /(^|\/)[^/]*(manifest|media)[^/]*\.json$/i.test(f));
  for (const f of manifests) {
    const text = readFileSync(join(DIST, f), 'utf8');
    for (const key of betaGuides) {
      if (hits(text, key, (c) => KEY_CHAR.test(c)).length) fail(`${f} names beta guide "${key}"`);
    }
  }
  notes.push(`${manifests.length} sitemap or media manifest file(s) checked for beta keys`);
  const releaseFiles = files.map(rel).filter((f) => /(^|\/)release(\.[^/]*)?\.(json|mjs)$/i.test(f));
  for (const f of releaseFiles) fail(`dist/ holds the release status file ${f}`);
} else if (expectShown) {
  if (!betaGuides.length && !betaStepTitles.length) {
    fail(`--expect-shown needs a release with beta content, but ${shownPath(releaseFile)} marks nothing beta`);
  }
  const html = norm(indexHtml);
  for (const key of betaGuides) {
    if (!spellings(key).some((s) => hits(html, s, (c) => KEY_CHAR.test(c)).length)) {
      fail(`beta guide key "${key}" is not in dist/index.html, though beta content is shown`);
    }
  }
  for (const { key, title } of betaStepTitles) {
    if (!spellings(norm(title)).some((s) => html.includes(s))) {
      fail(`beta step ${JSON.stringify(title)} of guide "${key}" is not in dist/index.html, though beta content is shown`);
    }
  }
  if (!html.includes('lsa-beta-badge')) fail('the class lsa-beta-badge is not in dist/index.html, though beta content is shown');
  if (tileCount !== null && tileCount !== guideKeys.length) {
    fail(`dist/index.html has ${tileCount} catalogue tiles; with beta shown it should have all ${guideKeys.length}`);
  }
}

// ---- report ---------------------------------------------------------------------------------------

const summary = {
  mode: showBeta ? 'beta shown' : 'beta hidden',
  SA_SHOW_BETA: process.env.SA_SHOW_BETA === undefined ? 'unset' : process.env.SA_SHOW_BETA,
  releaseFile: shownPath(releaseFile),
  dist: shownPath(DIST),
  builtMode,
  betaGuides,
  betaSteps: betaStepTitles.map(({ key, title }) => `${key}: ${title}`),
  gaGuides: gaGuides.length,
  tiles: tileCount,
  needles: needles.size + betaGuides.length + CLASSES.length,
  ambiguousNeedlesNotChecked: ambiguous.length,
  filesScanned: textFiles,
  filesCheckedByNameOnly: otherFiles,
  hits: leaks.length,
};
console.log(JSON.stringify(summary, null, 2));
for (const n of notes) console.log(`- ${n}`);
if (ambiguous.length) {
  console.log(`- ${ambiguous.length} beta-only string(s) not checked, because shipped content in the same language contains them:`);
  for (const a of ambiguous) console.log(`    ${a}`);
}
if (showBeta && leaks.length) {
  console.log(`\nBeta content is shown, so the ${leaks.length} hit(s) counted above are expected and not failures.`);
}
if (failures.length) {
  const MAX = 100;
  const listed = failures.slice(0, MAX);
  const more = failures.length > MAX ? `\n- …and ${failures.length - MAX} more` : '';
  console.log(`\nBETA LEAK: FAIL (${failures.length})\n- ${listed.join('\n- ')}${more}`);
  process.exit(1);
}
console.log(showBeta
  ? `\nBETA LEAK: PASS (beta shown${expectShown ? '; every beta key, beta step and the badge class are present' : ''})`
  : `\nBETA LEAK: PASS (0 beta keys, titles or strings in ${textFiles} files; ${tileCount} tiles = ${gaGuides.length} GA guides)`);
