// Tests for video/brand/course.json, the one place the video pipeline defines the fictional course.
//
// The guides already allow "Riverbend National" as sample data in five scripts. Those scripts keep
// their own copies (they predate the video pipeline and run on their own), so this test is what
// stops the two from drifting: every allowlist site must still accept course.json's name, short
// name or course id prefix. Each check is also run against the source with the value removed, to
// prove the check would fail if a site stopped accepting it.
//
// The test also ties course.json to its gate: the latest decided G1 row in video/approvals.md must
// name the course, and the latest decided G2 row must name the default map policy.
//
// Only committed files are read; the local name maps are never opened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');
const course = JSON.parse(read('video/brand/course.json'));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A top-level `const NAME = /.../flags;` regex literal, compiled from the script's source.
function regexConst(source, name) {
  const m = source.match(new RegExp(`^const ${name} = /(.+)/([a-z]*);\\s*$`, 'm'));
  return m ? new RegExp(m[1], m[2]) : null;
}

// The source between `start` and the first `end` after it, or ''.
function block(source, start, end) {
  const i = source.indexOf(start);
  if (i < 0) return '';
  const j = source.indexOf(end, i + start.length);
  return j < 0 ? '' : source.slice(i, j);
}

// Every allowlist site, as [file, what, check(source) -> boolean, value the check depends on].
const SITES = [
  ['scripts/import-export.mjs', 'site name allowlist (:52)', (src) => {
    const set = src.match(/const allow = new Set\(\[([^\]]*)\]\)/);
    return !!set && [...set[1].matchAll(/'([^']*)'/g)].some((m) => m[1] === course.name);
  }, course.name],
  ['scripts/import-export.mjs', 'TurfRad ID prefix rule (:36)', (src) => {
    const rule = src.match(/\.filter\(\(v\) => !\/(.+?)\/\.test\(v\)\)/);
    return !!rule && new RegExp(rule[1]).test(`'${course.idPrefix}-742'`);
  }, course.idPrefix],
  ['scripts/product-provenance.mjs', 'SAMPLE_DATA_PATTERNS (:46)', (src) => {
    const patterns = block(src, 'const SAMPLE_DATA_PATTERNS = [', '\n];');
    return new RegExp(`^\\s*'${escapeRe(course.name)}',`, 'm').test(patterns);
  }, course.name],
  ['scripts/product-provenance.mjs', 'self-check case (:208)', (src) => {
    const cases = block(src, 'const CASES = [', '\n];');
    return new RegExp(`\\['${escapeRe(course.name)}', true\\]`).test(cases);
  }, course.name],
  ['scripts/fidelity.mjs', 'SAMPLE_OR_BRAND (:271), short name and course id', (src) => {
    const re = regexConst(src, 'SAMPLE_OR_BRAND');
    return !!re && re.test(course.shortName) && re.test(`${course.idPrefix}-742`);
  }, course.idPrefix],
  ['scripts/fidelity.mjs', 'course id named in the sample-data comment (:322)', (src) =>
    new RegExp(`"${escapeRe(course.idPrefix)}-\\d+" is the fictional course id`).test(src), course.idPrefix],
  ['scripts/repro-inventory.mjs', 'VALUE (:28)', (src) => {
    const re = regexConst(src, 'VALUE');
    return !!re && re.test(course.name);
  }, course.name],
  ['scripts/app-strings.mjs', 'VERBATIM (:41)', (src) => {
    const re = regexConst(src, 'VERBATIM');
    return !!re && re.test(course.name);
  }, course.name],
];

test('course.json carries the complete fictional identity decided at G1', () => {
  assert.equal(course.approval, 'G1');
  for (const key of ['name', 'shortName', 'idPrefix', 'superintendent', 'customerNumber', 'holePattern', 'stationPattern']) {
    assert.equal(typeof course[key], 'string', `${key} is a string`);
    assert.ok(course[key].trim().length > 0, `${key} is not empty`);
  }
  assert.ok(course.name.startsWith(course.shortName), 'the short name is the start of the name');
  assert.equal(course.idPrefix, course.shortName.toLowerCase(), 'the course id prefix is the lower-case short name');
  assert.match(course.idPrefix, /^[a-z]+$/, 'the course id prefix fits the TurfRad ID rule');
  assert.equal(typeof course.location?.region, 'string');
  assert.equal(typeof course.location?.country, 'string');
  assert.ok(Number.isInteger(course.holeCount) && course.holeCount > 0);
  assert.equal(course.stationPattern, '<hole>AP<n>', 'stations keep the Lynx <hole>AP<n> pattern');
  // Letters and a hyphen: cannot collide with a digits-only customer number.
  assert.match(course.customerNumber, /^[A-Z]{3}-\d{6}$/);
});

test('people are distinct first names only', () => {
  assert.ok(Array.isArray(course.people) && course.people.length > 0);
  const seen = new Set();
  for (const person of course.people) {
    assert.match(person, /^[A-Z][a-z]+$/, 'one capitalised word: a first name only');
    assert.ok(!seen.has(person), 'no duplicates');
    seen.add(person);
  }
  assert.equal(course.superintendent.split(' ')[0], course.people[0], 'the superintendent is the first person');
});

test('the map block names the G2 policy and a valid palette', () => {
  assert.equal(course.map?.approval, 'G2');
  assert.ok(['blur', 'restyle', 'owned-imagery', 'frame-out'].includes(course.map.defaultPolicy));
  for (const colour of Object.values(course.map.palette)) assert.match(colour, /^#[0-9A-F]{6}$/i);
});

// The latest row for a gate whose decision is recorded (decided by executor or approved).
function latestDecided(gate) {
  const rows = read('video/approvals.md').split('\n')
    .filter((line) => line.startsWith(`| ${gate} |`))
    .map((line) => line.split('|').map((c) => c.trim()))
    .map((c) => ({ decision: c[4], notes: c[7] }))
    .filter((r) => r.decision === 'decided by executor' || r.decision === 'approved');
  return rows.at(-1);
}

test('course.json matches the decision recorded for G1 and G2 in video/approvals.md', () => {
  const g1 = latestDecided('G1');
  assert.ok(g1, 'G1 has a recorded decision');
  assert.ok(g1.notes.includes(course.name), 'the latest G1 decision names course.json name');
  const g2 = latestDecided('G2');
  assert.ok(g2, 'G2 has a recorded decision');
  assert.match(g2.notes, new RegExp(`\\b${escapeRe(course.map.defaultPolicy)}\\b`, 'i'), 'the latest G2 decision names the default map policy');
});

for (const [file, what, check, value] of SITES) {
  test(`${file} ${what} accepts course.json`, () => {
    const src = read(file);
    assert.ok(check(src), `${file}: ${what} no longer accepts "${value}" from video/brand/course.json`);
    // The same check must fail once the value is gone, or it proves nothing.
    const without = src.replace(new RegExp(escapeRe(value), 'gi'), 'zzremovedzz');
    assert.equal(check(without), false, `${file}: ${what} check still passes with "${value}" removed`);
  });
}

test('product-provenance classifies the course name as sample data at run time', async () => {
  const { isPureSampleData } = await import(path.join(REPO, 'scripts', 'product-provenance.mjs'));
  assert.equal(isPureSampleData(course.name), true);
});
