// Harvests the guide strings from both release modes and reports the union against
// src/i18n/en-us.json.
//
// Why both. A build that shows beta content (SA_SHOW_BETA=true) renders the beta guides and steps
// and the Beta badge, banner and step marker. A build that removes it (SA_SHOW_BETA=false) renders a
// few strings the shown build never does: "Step N of M" renumbered around a removed step, and
// sentences shortened by a removed cross-reference. src/i18n-apply.js matches on the exact English
// on screen, so the catalogue must hold every string either mode renders. Harvesting the rendered
// page is deliberate (README "How translation is applied"): a key taken from source may never match.
//
// What it does. For SA_SHOW_BETA false and then true: `npm run build` with that value, serve dist/
// with scripts/serve.mjs on a free port, run scripts/extract-strings.mjs with --out to a file in a
// scratch directory outside the repository, stop the server. SA_RELEASE_FILE, when set, is passed
// through to both builds (it is for tests only; see src/release.mjs).
//
// The Beta chrome. The badge, banner label and banner sentence (BETA_BADGE_LABEL, BETA_BANNER_LABEL
// and BETA_BANNER_TEXT in src/release.mjs) render only when something is beta. While the release
// file has no beta guide or no beta step, neither mode shows them, so a third, shown build is
// harvested with a scratch release, written to the scratch directory and never committed, that
// marks one guide and one step beta. Only those three strings are taken from it. Its other new
// strings are compounds of the guide it happened to mark, such as the tile's accessible name
// "<title> — Beta, 3 MIN, difficulty 2 of 3", and are listed but not added: the shown harvest picks
// up the real ones once a guide is really beta.
//
// The report lists the keys the union has and src/i18n/en-us.json lacks, and the prose keys
// en-us.json has that neither mode renders. The screen labels scripts/app-strings.mjs adds
// (_screenStrings) and the three Beta chrome strings are never reported as unrendered.
//
// With --write it diff-and-adds: the missing keys go into en-us.json (with their harvest contexts),
// the unrendered prose keys come out, and _meta.strings and _meta.words are recounted. Nothing else
// in the file changes, so the screen labels survive. Then translate the new keys through the
// catalogue pipeline (scripts/seed-translate-fragments.mjs and scripts/assemble-locale.mjs).
//
// dist/ is rebuilt at the end with the caller's own environment, so it is what `npm run build`
// would have left.
//
// Usage: node scripts/harvest-both-modes.mjs [--out-dir <dir>] [--reuse] [--write] [--check]
//   --out-dir  where the harvests and the union go. Default: a new directory under the OS temp dir.
//              It must be outside the repository.
//   --reuse    read the harvests a previous run left in --out-dir instead of building and harvesting
//              again (a full run takes several minutes per mode), for example to --write after
//              reading the report.
//   --write    diff-and-add the union into src/i18n/en-us.json.
//   --check    exit 1 when anything is missing or unrendered (and --write was not given).
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { loadRelease, BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT } from '../src/release.mjs';
import { transformGuide } from '../src/transform-export.mjs';
import { evaluateGuideData } from '../src/transforms/release-gate.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOGUE = join(ROOT, 'src', 'i18n', 'en-us.json');
const CHROME = [BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT];
const MODES = { 'ga-only': 'false', 'with-beta': 'true' };

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : undefined; };
const write = flag('--write');
const check = flag('--check');
const reuse = flag('--reuse');
if (reuse && !option('--out-dir')) throw new Error('--reuse needs the --out-dir of the run to reuse');

const outDir = option('--out-dir') ? resolve(option('--out-dir')) : await mkdtemp(join(tmpdir(), 'sa-harvest-'));
const inside = relative(ROOT, outDir);
if (!inside.startsWith('..') && !isAbsolute(inside)) {
  throw new Error(`--out-dir ${outDir} is inside the repository; harvests and scratch releases must stay out of it`);
}
await mkdir(outDir, { recursive: true });

// ---- one harvest --------------------------------------------------------------------------------

const freePort = () => new Promise((done, failed) => {
  const s = createServer();
  s.once('error', failed);
  s.listen(0, () => { const { port } = s.address(); s.close(() => done(port)); });
});

async function waitForServer(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`the server for ${url} did not come up`);
}

function run(command, argv, env) {
  const r = spawnSync(command, argv, { cwd: ROOT, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${command} ${argv.join(' ')} exited ${r.status ?? r.signal}`);
}

/** Build with `env`, serve dist/, harvest it to `<outDir>/<name>.json`, and return the harvest. */
async function harvest(name, env, expectMode) {
  const file = join(outDir, `${name}.json`);
  if (reuse && await access(file).then(() => true, () => false)) {
    process.stderr.write(`== ${name}: reusing ${file}\n`);
    return ofMode(JSON.parse(await readFile(file, 'utf8')));
  }
  process.stderr.write(`\n== ${name}: SA_SHOW_BETA=${env.SA_SHOW_BETA}${env.SA_RELEASE_FILE ? `, SA_RELEASE_FILE=${env.SA_RELEASE_FILE}` : ''}\n`);
  run('npm', ['run', 'build', '--silent'], env);
  const port = await freePort();
  const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist', String(port)], { cwd: ROOT, stdio: 'ignore' });
  try {
    await waitForServer(`http://localhost:${port}/`);
    run(process.execPath, ['scripts/extract-strings.mjs', `http://localhost:${port}/`, '--out', file], process.env);
  } finally {
    server.kill();
  }
  return ofMode(JSON.parse(await readFile(file, 'utf8')));

  function ofMode(result) {
    if (result._meta.mode !== expectMode) throw new Error(`${name}: harvested a ${result._meta.mode} build; expected ${expectMode}`);
    return result;
  }
}

// ---- the scratch release for the Beta chrome ----------------------------------------------------

/**
 * A copy of `release` with at least one beta guide and one beta step of a GA guide: the last tile
 * in catalogue order becomes beta, and the second step of the first GA guide with two or more
 * steps. Shown-mode only; it is never used to build a site anyone reads.
 */
async function chromeRelease(release) {
  const r = JSON.parse(JSON.stringify(release));
  const exported = await readFile(join(ROOT, 'Learn Spatial Adjust.dc.html'), 'utf8');
  const data = evaluateGuideData(transformGuide(exported, { showBeta: true, release }));
  const entries = Object.entries(r.guides);
  if (!entries.some(([, e]) => e.status === 'beta')) {
    const last = data.CATEGORIES.flatMap((c) => c.tasks).at(-1).key;
    r.guides[last] = { status: 'beta', basis: 'Scratch release for harvesting the Beta chrome strings; never committed.' };
  }
  if (!entries.some(([, e]) => e.status === 'ga' && (e.sections || []).some((s) => s.status === 'beta'))) {
    const [key, guide] = Object.entries(data.GUIDES)
      .find(([k, g]) => r.guides[k].status === 'ga' && !(r.guides[k].sections || []).length && g.steps.length >= 2);
    r.guides[key].sections = [{ id: 'harvest-chrome', status: 'beta', basis: 'Scratch release; never committed.', steps: [guide.steps[1].title] }];
  }
  return r;
}

// ---- main ---------------------------------------------------------------------------------------

const { release, file: releaseFile } = loadRelease();
const base = { ...process.env };
const runs = {};
for (const [mode, value] of Object.entries(MODES)) runs[mode] = await harvest(mode, { ...base, SA_SHOW_BETA: value }, mode);

const union = new Map(); // string -> Set of contexts
const addAll = (h) => {
  for (const s of Object.keys(h.strings)) {
    if (!union.has(s)) union.set(s, new Set());
    for (const c of (h._contexts && h._contexts[s]) || []) union.get(s).add(c);
  }
};
for (const h of Object.values(runs)) addAll(h);

const modeUnion = union.size;
const onlyHidden = Object.keys(runs['ga-only'].strings).filter((s) => !(s in runs['with-beta'].strings));
const onlyShown = Object.keys(runs['with-beta'].strings).filter((s) => !(s in runs['ga-only'].strings));

let chromeOnly = [];
const chromeMissing = CHROME.filter((s) => !union.has(s));
if (chromeMissing.length) {
  const scratch = join(outDir, 'release.chrome.json');
  await writeFile(scratch, JSON.stringify(await chromeRelease(release), null, 2) + '\n');
  const chrome = await harvest('beta-chrome', { ...base, SA_SHOW_BETA: 'true', SA_RELEASE_FILE: scratch }, 'with-beta');
  const absent = chromeMissing.filter((s) => !(s in chrome.strings));
  if (absent.length) throw new Error(`the Beta chrome did not render in a build with beta shown: ${absent.join(' | ')}`);
  for (const s of chromeMissing) union.set(s, new Set((chrome._contexts[s] || []).map((c) => `${c} (beta chrome)`)));
  chromeOnly = Object.keys(chrome.strings).filter((s) => !union.has(s));
}

// Leave dist/ as the caller's own build would.
if (!reuse) {
  process.stderr.write('\n== rebuilding dist/ with the caller\'s environment\n');
  run('npm', ['run', 'build', '--silent'], base);
}

const catalogue = JSON.parse(await readFile(CATALOGUE, 'utf8'));
const screen = new Set(catalogue._screenStrings || []);
const missing = [...union.keys()].filter((s) => !(s in catalogue.strings));
const unrendered = Object.keys(catalogue.strings).filter((s) => !union.has(s) && !screen.has(s) && !CHROME.includes(s));

const sorted = [...union.entries()].sort((a, b) => a[0].localeCompare(b[0]));
await writeFile(join(outDir, 'union.json'), JSON.stringify({
  _meta: { releaseFile, modes: Object.keys(MODES), strings: sorted.length, onlyHidden, onlyShown, chromeOnly },
  strings: Object.fromEntries(sorted.map(([s]) => [s, s])),
  _contexts: Object.fromEntries(sorted.map(([s, c]) => [s, [...c].slice(0, 4)])),
}, null, 2) + '\n');

const list = (title, items) => {
  console.log(`\n${title}: ${items.length}`);
  for (const s of items) console.log(`  ${s.length > 110 ? s.slice(0, 107) + '...' : s}`);
};
console.log(`\nrelease file ${relative(ROOT, releaseFile).startsWith('..') ? releaseFile : relative(ROOT, releaseFile)}; harvests in ${outDir}`);
console.log(`union of both modes: ${modeUnion} strings (${onlyShown.length} only with beta shown, ${onlyHidden.length} only with it removed)`
  + (union.size > modeUnion ? `, plus ${union.size - modeUnion} Beta chrome string(s) from the scratch build` : ''));
list('Missing from src/i18n/en-us.json', missing);
list('Prose keys in src/i18n/en-us.json that neither mode renders', unrendered);
if (chromeOnly.length) list('Seen only in the Beta chrome build, specific to the guide it marked, not added', chromeOnly);

if (write && (missing.length || unrendered.length)) {
  const strings = { ...catalogue.strings };
  const contexts = { ...(catalogue._contexts || {}) };
  for (const s of missing) { strings[s] = s; contexts[s] = [...union.get(s)].slice(0, 4); }
  for (const s of unrendered) { delete strings[s]; delete contexts[s]; }
  const byKey = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));
  catalogue.strings = byKey(strings);
  catalogue._contexts = byKey(contexts);
  catalogue._meta.strings = Object.keys(catalogue.strings).length;
  catalogue._meta.words = Object.keys(catalogue.strings).reduce((n, s) => n + s.split(/\s+/).length, 0);
  await writeFile(CATALOGUE, JSON.stringify(catalogue, null, 2) + '\n');
  console.log(`\nsrc/i18n/en-us.json: +${missing.length} -${unrendered.length}, ${catalogue._meta.strings} strings, ${catalogue._meta.words} words`);
  console.log('Next: node scripts/seed-translate-fragments.mjs, translate the todo, assemble each locale, npm run test:validate.');
} else if (check && (missing.length || unrendered.length)) {
  process.exit(1);
}
