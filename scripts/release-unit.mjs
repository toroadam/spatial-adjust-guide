// Unit tests for src/release.mjs and src/release.json. Plain node, no test framework.
//
// Proves that the committed release file is valid against the published guides, that
// validateRelease() rejects each kind of mistake it exists to catch, that SA_SHOW_BETA parses as
// documented, and that the shipping helpers answer correctly for a GA guide, a GA guide with a beta
// section, and a beta guide.
//
// Usage: node scripts/release-unit.mjs   (npm run test:release). Exits 1 on any failure.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractGuides } from './claims-extract.mjs';
import {
  parseShowBeta, showBetaFromEnv, loadRelease, releaseFilePath, validateRelease, findDuplicateKeys,
  isGuideShipped, betaSteps, statusOf, DEFAULT_RELEASE_FILE,
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

check('validateRelease accepts a beta section in a GA guide', () => validateRelease(
  withSections([{ id: 'stale-scans-kept', status: 'beta', basis: 'docs/claims/beta-surfaces.md#stale-scans-kept', steps: [STEP_A], crossReferences: ['station-zero'] }]),
  guides,
));

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
rejects('crossReferences that are not strings', withSections([
  { id: 'beta-step', status: 'beta', steps: [STEP_A], crossReferences: [3] },
]), /"crossReferences" must be an array of non-empty strings/);
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

// ---- report -------------------------------------------------------------------------------------

for (const f of failures) console.error(`FAIL ${f}`);
console.log(`release-unit: ${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
