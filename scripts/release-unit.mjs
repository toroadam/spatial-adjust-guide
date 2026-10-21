// Unit tests for src/release.mjs and src/release.json. Plain node, no test framework.
//
// Proves that the committed release file is valid against the published guides, that
// validateRelease() rejects each kind of mistake it exists to catch, that SA_SHOW_BETA parses as
// documented, and that the shipping helpers answer correctly for a GA guide, a GA guide with a beta
// section, and a beta guide. The release gate (src/transforms/release-gate.mjs) is exercised on the
// real export with in-memory release objects: what a build with SA_SHOW_BETA=false removes, what
// a build that shows beta content labels, and what makes either fail.
//
// Usage: node scripts/release-unit.mjs   (npm run test:release). Exits 1 on any failure.
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractGuides } from './claims-extract.mjs';
import { transformGuide } from '../src/transform-export.mjs';
import {
  apply as applyReleaseGate, evaluateGuideData, cutSentence, betaOnlyStrings, catalogueOmissions,
} from '../src/transforms/release-gate.mjs';
import {
  parseShowBeta, showBetaFromEnv, loadRelease, releaseFilePath, validateRelease, findDuplicateKeys,
  isGuideShipped, betaSteps, statusOf, crossReferencesOf, DEFAULT_RELEASE_FILE,
  BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT,
} from '../src/release.mjs';

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}
function equal(actual, expected, what = 'value') {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function throws(fn, pattern, what) {
  let err;
  try { fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected an error, none was thrown`);
  if (pattern && !pattern.test(err.message)) throw new Error(`${what}: error did not match ${pattern}: ${err.message}`);
  return err;
}
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---- SA_SHOW_BETA -------------------------------------------------------------------------------

check('parseShowBeta: unset means show', () => equal(parseShowBeta(undefined), true));
check('parseShowBeta: empty means show', () => equal(parseShowBeta(''), true));
check('parseShowBeta: whitespace means show', () => equal(parseShowBeta('  '), true));
check('parseShowBeta: "true"', () => equal(parseShowBeta('true'), true));
check('parseShowBeta: "TRUE"', () => equal(parseShowBeta('TRUE'), true));
check('parseShowBeta: "1"', () => equal(parseShowBeta('1'), true));
check('parseShowBeta: "false"', () => equal(parseShowBeta('false'), false));
check('parseShowBeta: "False"', () => equal(parseShowBeta('False'), false));
check('parseShowBeta: "0"', () => equal(parseShowBeta('0'), false));
check('parseShowBeta: "yes" throws and names the value', () => throws(() => parseShowBeta('yes'), /true, 1, false or 0.*"yes"/, 'yes'));
check('parseShowBeta: "2" throws', () => throws(() => parseShowBeta('2'), /received "2"/, '2'));
check('showBetaFromEnv reads SA_SHOW_BETA only', () => {
  equal(showBetaFromEnv({}), true, 'unset');
  equal(showBetaFromEnv({ SA_SHOW_BETA: 'false' }), false, 'false');
  equal(showBetaFromEnv({ SHOW_BETA: 'false' }), true, 'other variable ignored');
});

// ---- loading ------------------------------------------------------------------------------------

check('loadRelease: empty SA_RELEASE_FILE counts as unset', () => {
  const saved = process.env.SA_RELEASE_FILE;
  try {
    process.env.SA_RELEASE_FILE = '   ';
    const { file } = loadRelease();
    equal(file, releaseFilePath({ file: DEFAULT_RELEASE_FILE }), 'file');
  } finally {
    if (saved === undefined) delete process.env.SA_RELEASE_FILE; else process.env.SA_RELEASE_FILE = saved;
  }
});

const tmp = mkdtempSync(join(tmpdir(), 'release-unit-'));
try {
  check('loadRelease: SA_RELEASE_FILE points at a fixture', () => {
    const fixture = join(tmp, 'fixture.json');
    writeFileSync(fixture, JSON.stringify({ guides: { a: { status: 'beta', basis: 'test' } } }));
    const saved = process.env.SA_RELEASE_FILE;
    try {
      process.env.SA_RELEASE_FILE = fixture;
      const { release, file } = loadRelease();
      equal(file, fixture, 'file');
      equal(release.guides.a.status, 'beta', 'status');
    } finally {
      if (saved === undefined) delete process.env.SA_RELEASE_FILE; else process.env.SA_RELEASE_FILE = saved;
    }
  });
  check('loadRelease: a guide key named twice is rejected', () => {
    const dup = join(tmp, 'dup.json');
    writeFileSync(dup, '{ "guides": { "a": { "status": "ga", "basis": "x" }, "a": { "status": "beta", "basis": "y" } } }');
    throws(() => loadRelease({ file: dup }), /more than once: guides\.a/, 'duplicate key');
  });
  check('loadRelease: malformed JSON is rejected', () => {
    const bad = join(tmp, 'bad.json');
    writeFileSync(bad, '{ "guides": ');
    throws(() => loadRelease({ file: bad }), /not valid JSON/, 'malformed');
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
check('findDuplicateKeys: same key in different objects is fine', () => {
  equal(findDuplicateKeys('{"a":{"status":"ga"},"b":{"status":"ga"},"c":["status","status"]}').length, 0, 'duplicates');
});

// ---- the committed release file -----------------------------------------------------------------

const { guides, keys } = extractGuides();
const { release } = loadRelease({ file: DEFAULT_RELEASE_FILE });
const TARGET_PROFILES = ['target-profiles', 'creating-profiles', 'updating-profiles', 'seasonal-profiles'];

check('src/release.json validates against the published GUIDES', () => validateRelease(release, guides));
check('src/release.json has one entry per guide, in catalogue order', () => {
  equal(Object.keys(release.guides).join(' '), keys.join(' '), 'keys');
  equal(keys.length, 26, 'guide count');
});
check('Target Profiles guides are ga with the production citation', () => {
  for (const key of TARGET_PROFILES) {
    equal(release.guides[key].status, 'ga', `${key} status`);
    if (!/sa-settings-dlg\.component\.ts:55 at production 1aa4f286/.test(release.guides[key].basis)) {
      throw new Error(`${key} basis does not cite sa-settings-dlg.component.ts:55 at production 1aa4f286`);
    }
  }
});
check('_meta pins production and beta', () => {
  equal(release._meta.production.sha, '1aa4f28622cc3cc9637f0d61a438bf16bcf01924', 'production sha');
  equal(release._meta.beta.sha, 'bd39f465cf5a7ae0356a59825250b36044085714', 'beta sha');
  equal(release._meta.derivedFrom, 'docs/claims/beta-surfaces.md', 'derivedFrom');
});

// ---- what validateRelease rejects ---------------------------------------------------------------

// A real guide and two of its real step titles, so the variants differ from a valid file by one thing.
const KEY = 'calculation-questions';
const [STEP_A, STEP_B] = guides[KEY].steps.map((s) => s.title);
const withSections = (sections) => {
  const r = clone(release);
  r.guides[KEY].sections = sections;
  return r;
};
const rejects = (name, variant, pattern) => check(`validateRelease rejects ${name}`, () => {
  const err = throws(() => validateRelease(variant, guides), pattern, name);
  if (!Array.isArray(err.problems) || err.problems.length === 0) throw new Error(`${name}: error.problems is empty`);
});

// A sentence that occurs once in the before list of each of seven GA guides.
const PUSH_SENTENCE = 'Push changes to Lynx lists the settings under Before you start.';
const XREF = { guide: 'seasonal-profiles', field: 'before', text: PUSH_SENTENCE };

check('validateRelease accepts a beta section in a GA guide', () => validateRelease(
  withSections([{ id: 'stale-scans-kept', status: 'beta', basis: 'docs/claims/beta-surfaces.md#stale-scans-kept', steps: [STEP_A], crossReferences: [XREF] }]),
  guides,
));
check('validateRelease accepts cross-references on a beta guide', () => {
  const r = clone(release);
  r.guides['push-to-lynx'] = { status: 'beta', basis: 'test', crossReferences: [XREF, { ...XREF, guide: 'push-failures' }] };
  validateRelease(r, guides);
});

{
  const r = clone(release);
  delete r.guides['push-to-lynx'];
  rejects('a missing key', r, /guide "push-to-lynx" has no entry/);
}
{
  const r = clone(release);
  r.guides['not-a-guide'] = { status: 'ga', basis: 'x' };
  rejects('an unknown key', r, /guide "not-a-guide" is not a guide in GUIDES/);
}
{
  const r = clone(release);
  r.guides.preferences.status = 'alpha';
  rejects('status "alpha"', r, /guide "preferences" has status "alpha"/);
}
{
  const r = clone(release);
  r.guides.preferences.basis = '  ';
  rejects('an empty basis', r, /guide "preferences" needs a non-empty "basis"/);
}
rejects('a duplicate section id', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A] },
  { id: 'beta-step', status: 'beta', steps: [STEP_B] },
]), /uses section id "beta-step" more than once/);
rejects('an unresolved step title', withSections([
  { id: 'beta-step', status: 'beta', steps: ['A step title no guide has'] },
]), /"A step title no guide has" matches 0 step titles/);
rejects('a section status "alpha"', withSections([
  { id: 'beta-step', status: 'alpha', steps: [STEP_A] },
]), /section "beta-step" has status "alpha"/);
rejects('a non-kebab section id', withSections([
  { id: 'Beta Step', status: 'beta', steps: [STEP_A] },
]), /needs a kebab-case "id"/);
rejects('an empty steps array', withSections([
  { id: 'beta-step', status: 'beta', steps: [] },
]), /needs a non-empty "steps" array/);
rejects('a step in two sections', withSections([
  { id: 'one', status: 'beta', steps: [STEP_A] },
  { id: 'two', status: 'beta', steps: [STEP_A] },
]), /already in section "one"/);
rejects('a cross-reference that is a bare string', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: ['station-zero'] },
]), /cross-reference #1 must be an object with guide, field and text/);
rejects('an empty crossReferences array', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: [] },
]), /"crossReferences" must be a non-empty array/);
rejects('crossReferences on a ga section', withSections([
  { id: 'still-ga', status: 'ga', steps: [STEP_A], crossReferences: [XREF] },
]), /section "still-ga" has crossReferences but is not beta/);
{
  const r = clone(release);
  r.guides.preferences.crossReferences = [XREF];
  rejects('crossReferences on a ga guide', r, /guide "preferences" has crossReferences but is not beta/);
}
{
  const r = clone(release);
  r.guides['push-to-lynx'] = { status: 'beta', basis: 'test', crossReferences: [{ ...XREF, guide: 'push-to-lynx', field: 'title', text: 'Push changes to Lynx' }] };
  rejects('a cross-reference into a beta guide', r, /names guide "push-to-lynx", which is not ga/);
}
rejects('a cross-reference to a guide that does not exist', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: [{ ...XREF, guide: 'not-a-guide' }] },
]), /names guide "not-a-guide", which is not a guide in GUIDES/);
rejects('a cross-reference with an unknown field', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: [{ ...XREF, field: 'tipLabel' }] },
]), /has field "tipLabel"; expected one of title, summary/);
rejects('a cross-reference with an unknown key', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: [{ ...XREF, why: 'x' }] },
]), /cross-reference #1 has an unknown field "why"/);
rejects('a cross-reference whose text is not in the field', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: [{ ...XREF, field: 'verify' }] },
]), /occurs 0 times in the verify of guide "seasonal-profiles"; expected exactly once/);
rejects('a cross-reference whose text occurs twice', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: [{ guide: 'push-to-lynx', field: 'body', text: 'Lynx' }] },
]), /occurs \d+ times in the body of guide "push-to-lynx"; expected exactly once/);
{
  const r = withSections([{ id: 'still-ga', status: 'ga', steps: [STEP_A] }]);
  r.guides[KEY].status = 'beta';
  rejects('a ga section inside a beta guide', r, /a beta guide holds no ga section/);
}
{
  const r = clone(release);
  r.guides.preferences.state = 'ga';
  rejects('an unknown entry field', r, /guide "preferences" has an unknown field "state"/);
}
check('validateRelease lists every problem in one error', () => {
  const r = clone(release);
  delete r.guides['push-to-lynx'];
  r.guides['not-a-guide'] = { status: 'ga', basis: 'x' };
  r.guides.preferences.status = 'alpha';
  const err = throws(() => validateRelease(r, guides), /3 problems/, 'combined');
  equal(err.problems.length, 3, 'problem count');
});

// ---- shipping helpers ---------------------------------------------------------------------------

check('shipping helpers on a GA guide, a GA guide with a beta section, and a beta guide', () => {
  const r = withSections([{ id: 'beta-step', status: 'beta', steps: [STEP_B] }]);
  r.guides['request-scan-data'].status = 'beta';
  validateRelease(r, guides);

  equal(isGuideShipped(r, 'preferences', false), true, 'GA guide, beta hidden');
  equal(isGuideShipped(r, 'request-scan-data', true), true, 'beta guide, beta shown');
  equal(isGuideShipped(r, 'request-scan-data', false), false, 'beta guide, beta hidden');
  equal(isGuideShipped(r, KEY, false), true, 'GA guide with beta section, beta hidden');

  equal(betaSteps(r, KEY).join('|'), STEP_B, 'beta steps of a GA guide');
  equal(betaSteps(r, 'preferences').length, 0, 'GA guide without sections');
  equal(betaSteps(r, 'request-scan-data').length, 0, 'beta guide');

  equal(statusOf(r, KEY), 'ga', 'guide status');
  equal(statusOf(r, KEY, STEP_B), 'beta', 'beta step');
  equal(statusOf(r, KEY, STEP_A), 'ga', 'unsectioned step');
  equal(statusOf(r, 'request-scan-data', guides['request-scan-data'].steps[0].title), 'beta', 'step in a beta guide');

  throws(() => isGuideShipped(r, 'not-a-guide', true), /no entry for guide "not-a-guide"/, 'unknown key');
  throws(() => isGuideShipped(r, 'preferences', 'false'), /showBeta as a boolean/, 'string showBeta');
});

check('Beta strings', () => {
  equal(BETA_BADGE_LABEL, 'Beta', 'badge');
  equal(BETA_BANNER_LABEL, 'Beta.', 'banner label');
  equal(BETA_BANNER_TEXT, 'This feature is in testing and may change before it reaches your IntelliDash.', 'banner text');
});

// ---- the release gate ---------------------------------------------------------------------------

// The export with every transform applied, built both ways with the committed release file. The
// shown build (SHOWN) carries the beta content src/transforms/beta-content.mjs adds, labelled. The
// hidden build (PLAIN) is the export with every other transform applied and that beta content
// removed, so nothing in it is beta; the release gate tests below start from it, with GA_ONLY, the
// committed release file less the beta guides and beta sections PLAIN no longer holds, as the base
// each test marks its own beta content on.
const EXPORT_HTML = readFileSync(join(import.meta.dirname, '..', 'Learn Spatial Adjust.dc.html'), 'utf8');
const SHOWN = transformGuide(EXPORT_HTML, { showBeta: true, release });
const PLAIN = transformGuide(EXPORT_HTML, { showBeta: false, release });
// The rewritten start state of push-failures names the guide "Push changes to Lynx" in its needs
// line. A beta guide is removed by title, and the gate fails on a mention left behind, so the tests
// that make push-to-lynx beta start from a build whose needs line points at it without the title.
const PUSH_NEEDS = 'Lynx must be set up as Push changes to Lynx describes,';
if (PLAIN.split(PUSH_NEEDS).length !== 2) throw new Error('the push-failures needs line anchor was not found once');
const PLAIN_PUSH = PLAIN.replace(PUSH_NEEDS, 'Lynx must be set up as the Lynx guide describes,');
const GA_ONLY = clone(release);
for (const [key, entry] of Object.entries(GA_ONLY.guides)) {
  if (entry.status === 'beta') { delete GA_ONLY.guides[key]; continue; }
  if (entry.sections) entry.sections = entry.sections.filter((section) => section.status !== 'beta');
  if (entry.sections && entry.sections.length === 0) delete entry.sections;
}
const hide = (html, r) => applyReleaseGate(html, { showBeta: false, release: r });
const show = (html, r) => applyReleaseGate(html, { showBeta: true, release: r });
const tileKeys = (data) => data.CATEGORIES.flatMap((c) => c.tasks.map((t) => t.key));
const PRESENTATION = ['lsa-beta-badge', 'lsa-beta-banner', BETA_BANNER_TEXT, 'isBeta'];

check('release gate: the committed release file removes exactly its beta guides and steps', () => {
  const shown = evaluateGuideData(SHOWN);
  const plain = evaluateGuideData(PLAIN);
  for (const [key, guide] of Object.entries(shown.GUIDES)) {
    if (!isGuideShipped(release, key, false)) {
      equal(Object.hasOwn(plain.GUIDES, key), false, `beta guide ${key} in the hidden build`);
      equal(tileKeys(plain).includes(key), false, `beta tile ${key} in the hidden build`);
      continue;
    }
    const beta = betaSteps(release, key);
    const kept = guide.steps.map((st, i) => i).filter((i) => !beta.includes(guide.steps[i].title));
    equal(JSON.stringify(plain.GUIDES[key].steps.map((st) => st.title)),
      JSON.stringify(kept.map((i) => guide.steps[i].title)), `${key} steps in the hidden build`);
    equal(JSON.stringify(plain.TARGETS[key]), JSON.stringify(kept.map((i) => shown.TARGETS[key][i])), `${key} cursor targets in the hidden build`);
    guide.steps.forEach((st, i) => equal(st.beta, beta.includes(st.title) ? true : undefined, `${key} step ${i + 1} beta in the shown build`));
  }
  equal(JSON.stringify(evaluateGuideData(show(PLAIN, GA_ONLY))) === JSON.stringify(plain), true,
    'a shown build of the hidden export, with nothing beta, changes no guide data');
  equal(transformGuide(EXPORT_HTML) === SHOWN, true, 'default options show beta');
});
check('release gate: only a build that shows beta content carries the presentation markup', () => {
  for (const needle of PRESENTATION) {
    equal(PLAIN.includes(needle), false, `hidden build has ${needle}`);
    equal(SHOWN.includes(needle), true, `shown build has ${needle}`);
  }
});
check('release gate: needs a boolean showBeta and a release', () => {
  throws(() => applyReleaseGate(PLAIN, { showBeta: 'false', release }), /showBeta must be a boolean/, 'string showBeta');
  throws(() => applyReleaseGate(PLAIN, { showBeta: false }), /no release status/, 'no release');
});

{
  // One beta guide that another guide lists under Next, a category whose two guides are both beta,
  // and a beta step in the middle of a third guide.
  const PUSH_STEP = guides['push-to-lynx'].steps[2].title;
  const r = clone(GA_ONLY);
  r.guides['calculation-questions'] = { status: 'beta', basis: 'test' };
  r.guides['enable-disable-stations'] = { status: 'beta', basis: 'test' };
  r.guides['station-details'] = { status: 'beta', basis: 'test' };
  r.guides['push-to-lynx'].sections = [{ id: 'one-step', status: 'beta', basis: 'test', steps: [PUSH_STEP] }];
  const before = evaluateGuideData(PLAIN);
  let hidden = null;
  check('release gate: hides beta guides, tiles, rows, steps and Next references', () => {
    hidden = hide(PLAIN, r);
    const after = evaluateGuideData(hidden);
    for (const k of ['calculation-questions', 'enable-disable-stations', 'station-details']) {
      equal(Object.hasOwn(after.GUIDES, k), false, `GUIDES has ${k}`);
      equal(Object.hasOwn(after.TARGETS, k), false, `TARGETS has ${k}`);
      equal(tileKeys(after).includes(k), false, `tile ${k}`);
    }
    equal(Object.keys(after.GUIDES).length, 23, 'GA guide count');
    equal(tileKeys(after).length, 23, 'tile count');
    equal(after.CATEGORIES.some((c) => c.title === 'Station Management'), false, 'emptied category dropped');
    equal(after.CATEGORIES.length, before.CATEGORIES.length - 1, 'category count');
    equal(after.GUIDES['push-to-lynx'].steps.length, 5, 'push-to-lynx steps');
    equal(after.GUIDES['push-to-lynx'].steps.some((st) => st.title === PUSH_STEP), false, 'beta step gone');
    equal(JSON.stringify(after.TARGETS['push-to-lynx']),
      JSON.stringify(before.TARGETS['push-to-lynx'].filter((_, i) => i !== 2)), 'cursor target left with its step');
    equal(JSON.stringify(after.GUIDES['calculation-methods'].next), JSON.stringify(['calculation-settings']), 'Next reference removed');
    for (const [k, g] of Object.entries(after.GUIDES)) {
      equal(after.TARGETS[k].length, g.steps.length, `TARGETS["${k}"] length`);
      for (const n of g.next || []) equal(Object.hasOwn(after.GUIDES, n), true, `${k} next ${n}`);
    }
  });
  check('release gate: the hidden export carries no beta key or title', () => {
    for (const needle of ["'calculation-questions'", "'station-details'", 'Calculation questions', PUSH_STEP]) {
      equal(hidden.includes(needle), false, needle);
    }
  });
  check('release gate: a build with beta shown flags exactly the beta guides, tiles and steps', () => {
    const shown = show(PLAIN, r);
    const data = evaluateGuideData(shown);
    const betaKeys = ['calculation-questions', 'enable-disable-stations', 'station-details'];
    for (const [k, g] of Object.entries(data.GUIDES)) {
      equal(g.beta, betaKeys.includes(k) ? true : undefined, `guide ${k} beta`);
      g.steps.forEach((st, i) => equal(st.beta, k === 'push-to-lynx' && i === 2 ? true : undefined, `${k} step ${i + 1} beta`));
    }
    for (const t of data.CATEGORIES.flatMap((c) => c.tasks)) equal(t.beta, betaKeys.includes(t.key) ? true : undefined, `tile ${t.key} beta`);
    equal(Object.keys(data.GUIDES).length, Object.keys(before.GUIDES).length, 'nothing removed');
    equal(data.GUIDES['push-to-lynx'].steps[2].title, PUSH_STEP, 'step title unchanged');
    equal(shown.split('class="lsa-beta-banner"').length - 1, 1, 'one banner element in the template');
  });
  check('release gate: a build with beta shown labels with the src/release.mjs strings', () => {
    const shown = show(PLAIN, r);
    equal(shown.includes(`<span class="lsa-beta-banner-label">${BETA_BANNER_LABEL}</span> ${BETA_BANNER_TEXT}</div>`), true, 'banner');
    equal(shown.includes(`<span class="lsa-beta-badge lsa-beta-badge-tile">${BETA_BADGE_LABEL}</span>`), true, 'tile badge');
    equal(shown.split(`<span class="lsa-beta-badge lsa-beta-badge-step">${BETA_BADGE_LABEL}</span>`).length - 1, 2, 'step markers');
    equal(shown.includes(`(t.beta ? '${BETA_BADGE_LABEL}, ' : '')`), true, 'accessible name');
  });
  check('release gate: beta status written into the guide data fails a shown build', () => {
    const flagged = PLAIN.replace("{ key: 'push-failures', ", "{ key: 'push-failures', beta: true, ");
    if (flagged === PLAIN) throw new Error('push-failures tile anchor not found');
    throws(() => show(flagged, GA_ONLY), /tile "push-failures" has beta true; expected no beta member/, 'flag in the data');
  });
  check('release gate: a TARGETS row out of step with its steps fails when a step is beta', () => {
    const row = /'push-to-lynx': \[[^\]]*\]/.exec(PLAIN)[0];
    if (PLAIN.split(row).length !== 2) throw new Error('push-to-lynx TARGETS row anchor not found once');
    const cells = row.slice(row.indexOf('[') + 1, -1).split(', ');
    const short = PLAIN.replace(row, `'push-to-lynx': [${cells.slice(0, -1).join(', ')}]`);
    const one = clone(GA_ONLY);
    one.guides['push-to-lynx'].sections = [{ id: 'one-step', status: 'beta', basis: 'test', steps: [PUSH_STEP] }];
    throws(() => hide(short, one), /TARGETS\["push-to-lynx"\] has 5 cells but GUIDES\["push-to-lynx"\]\.steps has 6 steps/, 'row mismatch');
  });
}
check('release gate: a beta key left in the logic fails the build with its offset', () => {
  const r = clone(GA_ONLY);
  r.guides['target-profiles'].status = 'beta';
  throws(() => hide(PLAIN, r), /guide key 'target-profiles' at offset \d+: .*showProfilesTab/, 'showProfilesTab leftover');
});
check('release gate: a GA guide with every step beta fails', () => {
  const r = clone(GA_ONLY);
  r.guides.preferences.sections = [{ id: 'all', status: 'beta', basis: 'test', steps: guides.preferences.steps.map((st) => st.title) }];
  throws(() => hide(PLAIN, r), /every step of GA guide "preferences" is beta/, 'all steps beta');
});
check('release gate: an invalid release file fails in either mode', () => {
  const r = clone(GA_ONLY);
  delete r.guides.preferences;
  throws(() => applyReleaseGate(PLAIN, { showBeta: true, release: r }), /guide "preferences" has no entry/, 'shown');
  throws(() => hide(PLAIN, r), /guide "preferences" has no entry/, 'hidden');
});

// ---- cross-references and step numbers ----------------------------------------------------------

check('cutSentence takes the joining space with the sentence', () => {
  equal(cutSentence('A one. B two. C three.', 'B two.'), 'A one. C three.', 'middle');
  equal(cutSentence('A one. B two.', 'B two.'), 'A one.', 'last');
  equal(cutSentence('B two. A one.', 'B two.'), 'A one.', 'first');
  equal(cutSentence('B two.', 'B two.'), '', 'whole');
});

{
  // Push changes to Lynx made beta. Seven GA guides name it in one sentence of their before list.
  const named = Object.keys(guides).filter((k) => (guides[k].before || []).some((b) => b.includes(PUSH_SENTENCE)));
  const pushBeta = (refs) => {
    const r = clone(GA_ONLY);
    r.guides['push-to-lynx'] = { status: 'beta', basis: 'test', crossReferences: refs };
    return r;
  };
  check('release gate: registered cross-references are removed from GA guides', () => {
    equal(named.length, 7, 'guides naming Push changes to Lynx');
    const r = pushBeta(named.map((guide) => ({ guide, field: 'before', text: PUSH_SENTENCE })));
    equal(crossReferencesOf(r).length, 7, 'registered');
    const hidden = hide(PLAIN_PUSH, r);
    const after = evaluateGuideData(hidden);
    for (const k of named) {
      const before = after.GUIDES[k].before;
      equal(before.some((b) => b.includes(PUSH_SENTENCE)), false, `${k} still names the beta guide`);
      equal(before.includes('Lynx itself must be set up to match Spatial Adjust.'), true, `${k} keeps the sentence before it`);
      equal(before.length, guides[k].before.length, `${k} before count`);
    }
    equal(hidden.includes('Push changes to Lynx'), false, 'title anywhere in the export');
    equal(Object.hasOwn(after.GUIDES, 'push-to-lynx'), false, 'beta guide');
  });
  check('release gate: an unregistered mention of a beta guide fails, naming guide, field and sentence', () => {
    const r = pushBeta(named.filter((k) => k !== 'push-failures').map((guide) => ({ guide, field: 'before', text: PUSH_SENTENCE })));
    throws(() => hide(PLAIN_PUSH, r),
      /guide "push-failures" before\[\d+\]: "Push changes to Lynx lists the settings under Before you start\." names the title of beta guide "push-to-lynx"\. Register it in src\/release\.json under guides\."push-to-lynx"\.crossReferences/,
      'unregistered');
  });
  check('release gate: a #/key link to a beta guide fails', () => {
    const r = clone(GA_ONLY);
    r.guides['station-details'].status = 'beta';
    const caption = guides['minimum-threshold'].steps[1].caption;
    const linked = PLAIN.replace(caption, `${caption} See #/station-details.`);
    throws(() => hide(linked, r), /guide "minimum-threshold" steps\[1\]\.caption: "See #\/station-details\." names a link to beta guide "station-details"/, 'link');
  });
  check('release gate: a registered sentence that is a whole before item takes the item with it', () => {
    const r = clone(GA_ONLY);
    r.guides['station-details'] = { status: 'beta', basis: 'test', crossReferences: [
      { guide: 'dashboard-overview', field: 'before', text: guides['dashboard-overview'].before[2] },
    ] };
    const after = evaluateGuideData(hide(PLAIN, r));
    equal(JSON.stringify(after.GUIDES['dashboard-overview'].before), JSON.stringify(guides['dashboard-overview'].before.slice(0, 2)), 'before');
  });
  check('release gate: a registered sentence that is a whole caption fails rather than leave it empty', () => {
    const r = clone(GA_ONLY);
    r.guides['station-details'] = { status: 'beta', basis: 'test', crossReferences: [
      { guide: 'minimum-threshold', field: 'caption', text: guides['minimum-threshold'].steps[1].caption },
    ] };
    throws(() => hide(PLAIN, r), /is all of steps\[1\]\.caption; removing it would leave it empty/, 'empty caption');
  });
}

{
  // push-to-lynx has six steps. Step 3 made beta leaves five, so step numbers from 4 up move.
  const PUSH_STEP = guides['push-to-lynx'].steps[2].title;
  const summary = guides['push-to-lynx'].summary;
  const withSentence = (sentence) => {
    if (PLAIN.split(summary).length !== 2) throw new Error('push-to-lynx summary anchor not found once');
    return PLAIN.replace(summary, `${summary} ${sentence}`);
  };
  const stepBeta = (refs) => {
    const r = clone(GA_ONLY);
    r.guides['push-to-lynx'].sections = [{ id: 'one-step', status: 'beta', basis: 'test', steps: [PUSH_STEP], ...(refs ? { crossReferences: refs } : {}) }];
    return r;
  };
  check('release gate: "step 6" in a guide reduced to five steps fails', () => {
    throws(() => hide(withSentence('Step 6 confirms the result.'), stepBeta()),
      /guide "push-to-lynx" summary: "Step 6 confirms the result\." cites step 6, but the guide has 5 steps without beta content/, 'step 6');
  });
  check('release gate: a reference to the removed step fails', () => {
    throws(() => hide(withSentence('Step 3 shows the threshold.'), stepBeta()), /cites step 3, which a build without beta content removes/, 'step 3');
  });
  check('release gate: a reference to a step that moved fails', () => {
    throws(() => hide(withSentence('Step 4 lets you untick rows.'), stepBeta()), /cites step 4, which becomes step 3 once beta step 3 is removed/, 'step 4');
  });
  check('release gate: a reference to a step before the removed one passes', () => {
    const after = evaluateGuideData(hide(withSentence('Step 2 reviews the lists.'), stepBeta()));
    equal(after.GUIDES['push-to-lynx'].summary, `${summary} Step 2 reviews the lists.`, 'summary');
  });
  check('release gate: a step reference registered on the beta section is removed', () => {
    const r = stepBeta([{ guide: 'push-to-lynx', field: 'summary', text: 'Step 6 confirms the result.' }]);
    const after = evaluateGuideData(hide(withSentence('Step 6 confirms the result.'), r));
    equal(after.GUIDES['push-to-lynx'].summary, summary, 'summary');
  });
  check('release gate: the counter must still number steps from steps.length', () => {
    const anchor = "counter: 'Step ' + (pi + 1) + ' of ' + steps.length";
    throws(() => hide(PLAIN.replace(anchor, "counter: 'Step ' + (pi + 1) + ' of ' + 6"), stepBeta()), /the player counter, Step N of M must number steps from steps\.length/, 'counter');
    const announce = "announcement: 'Step ' + (pi + 1) + ' of ' + steps.length";
    throws(() => hide(PLAIN.replace(announce, "announcement: 'Step ' + (pi + 1) + ' of ' + 6"), stepBeta()), /live-region announcement/, 'announcement');
  });
}

// ---- catalogues ---------------------------------------------------------------------------------

{
  const CATALOGUE = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'i18n', 'en-us.json'), 'utf8'));
  const PUSH_STEP = guides['push-to-lynx'].steps[2].title;
  const r = clone(GA_ONLY);
  r.guides['calculation-questions'] = { status: 'beta', basis: 'test' };
  r.guides['enable-disable-stations'] = { status: 'beta', basis: 'test' };
  r.guides['station-details'] = { status: 'beta', basis: 'test' };
  r.guides['push-to-lynx'].sections = [{ id: 'one-step', status: 'beta', basis: 'test', steps: [PUSH_STEP] }];
  const allData = evaluateGuideData(PLAIN);
  const shippedData = evaluateGuideData(hide(PLAIN, r));
  check('catalogues: beta-only strings and harvested compounds are left out', () => {
    const { omit } = catalogueOmissions({ allData, shippedData, release: r, catalogue: CATALOGUE });
    for (const key of ['Calculation questions', 'Calculation questions — 4 MIN, difficulty 3 of 3', PUSH_STEP,
      `Step 3 of 6: ${PUSH_STEP}`, 'Managing station state and detail rows.', guides['station-details'].steps[0].title]) {
      equal(Object.hasOwn(CATALOGUE.strings, key), true, `catalogue has ${key}`);
      equal(omit.has(key), true, `omits ${key}`);
    }
    for (const key of ['Calculation methods', 'Push changes to Lynx', 'Station Management', '4 minutes', 'Note.',
      `Step 1 of 6: ${guides['push-to-lynx'].steps[0].title}`]) {
      equal(omit.has(key), false, `keeps ${key}`);
    }
    for (const key of omit) equal(Object.hasOwn(CATALOGUE.strings, key), true, `omitted key ${key} is a catalogue key`);
  });
  check('catalogues: the badge and banner strings are beta-only', () => {
    const set = betaOnlyStrings({ allData, shippedData, release: r });
    for (const label of [BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT]) equal(set.has(label), true, label);
  });
  check('catalogues: strings in keep and strings shipped content uses stay', () => {
    equal(betaOnlyStrings({ allData, shippedData, release: r, keep: ['Calculation questions'] }).has('Calculation questions'), false, 'keep');
    const set = betaOnlyStrings({ allData, shippedData, release: r });
    for (const t of [guides['calculation-methods'].title, guides['push-to-lynx'].steps[0].title]) equal(set.has(t), false, t);
  });
  check('catalogues: a registered cross-reference and the text it was cut from are left out', () => {
    const named = Object.keys(guides).filter((k) => (guides[k].before || []).some((b) => b.includes(PUSH_SENTENCE)));
    const pr = clone(GA_ONLY);
    pr.guides['push-to-lynx'] = { status: 'beta', basis: 'test', crossReferences: named.map((guide) => ({ guide, field: 'before', text: PUSH_SENTENCE })) };
    const shipped = evaluateGuideData(hide(PLAIN_PUSH, pr));
    const set = betaOnlyStrings({ allData, shippedData: shipped, release: pr });
    const original = guides['push-failures'].before.find((b) => b.includes(PUSH_SENTENCE));
    equal(set.has(PUSH_SENTENCE), true, 'sentence');
    equal(set.has(original), true, 'original text');
    equal(set.has('Lynx itself must be set up to match Spatial Adjust.'), false, 'shortened text');
  });
  check('catalogues: only the badge and banner strings are left out when nothing is beta', () => {
    const { omit } = catalogueOmissions({ allData, shippedData: allData, release, catalogue: CATALOGUE });
    const labels = [BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT];
    for (const key of omit) equal(labels.includes(key), true, `omitted ${key}`);
  });
}

// ---- report -------------------------------------------------------------------------------------

for (const f of failures) console.error(`FAIL ${f}`);
console.log(`release-unit: ${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
