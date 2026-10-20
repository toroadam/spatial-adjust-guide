// Tests for video/lib/episode-schema.mjs and the shared write guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WRITES } from '../../scripts/lib/writes.mjs';
import {
  CLAIMS_LEDGER, EpisodeError, REPO_ROOT, checkEpisode, minimumHold, parseEpisode, validateEpisode,
} from './episode-schema.mjs';

const FIX = path.join(import.meta.dirname, 'fixtures');
const fixture = (name) => path.join(FIX, name);
const load = (name) => JSON.parse(readFileSync(fixture(name), 'utf8'));

// parseEpisode and the message an EpisodeError carries, or the parsed data.
function rejection(file, options) {
  try {
    parseEpisode(file, options);
  } catch (err) {
    assert.ok(err instanceof EpisodeError, `unexpected ${err.name}: ${err.message}`);
    return err;
  }
  assert.fail(`${path.basename(file)} was accepted`);
}

test('the valid fixture parses, with defaults and unknown fields kept', () => {
  const ep = parseEpisode(fixture('episode.valid.json'));
  assert.equal(ep.id, 'fixture-read-the-map');
  assert.deepEqual(ep.allowClicks, []);
  assert.equal(ep.beats[1].actions.length, 5);
  const extended = validateEpisode({ ...load('episode.valid.json'), futureField: { x: 1 } });
  assert.equal(extended.success, true);
  assert.deepEqual(extended.data.futureField, { x: 1 });
});

test('a declared demo-mode write click is accepted when source is demo', () => {
  const ep = parseEpisode(fixture('episode.demo-write.valid.json'));
  assert.equal(ep.demoWriteClicks.length, 1);
  assert.equal(ep.beats[1].actions[4].type, 'click');
});

const FAILING = [
  ['episode.invalid.click-not-allowed.json', /beat "map" actions\[4\] \(click "Variance view"\): click is not listed in allowClicks/],
  ['episode.invalid.push-click.json', /beat "map" actions\[4\] \(click "Push changes"\): click matches the write guard and is not declared in demoWriteClicks/],
  ['episode.invalid.dangling-vo.json', /beat "map" references vo line "vo-missing", which is not defined in vo/],
  ['episode.invalid.short-hold.json', /beat "counts" holds its label for 2 s; 6 words need at least 3\.3 s/],
  ['episode.invalid.demo-write-recreation.json', /beat "map" actions\[4\] \(click "Push Changes"\): declared demo-mode click, but source is "recreation"/],
];

for (const [name, expected] of FAILING) {
  test(`rejects ${name}, naming the offending beat or action`, () => {
    const err = rejection(fixture(name));
    assert.match(err.message, expected);
  });
}

test('the recreation fixture also flags the declaration itself', () => {
  const err = rejection(fixture('episode.invalid.demo-write-recreation.json'));
  assert.match(err.message, /demoWriteClicks\[0\]: .* only allowed when source is "demo"/);
});

test('a write-like target is refused even when the name is allowed', () => {
  const ep = load('episode.valid.json');
  ep.allowClicks = ['Open legend'];
  ep.beats[1].actions.push({ type: 'click', name: 'Open legend', target: 'button.push-changes' });
  const res = validateEpisode(ep);
  assert.equal(res.success, false);
  assert.match(res.issues.join('\n'), /click matches the write guard/);
});

test('allowClicks may not list a write-like name', () => {
  const ep = load('episode.valid.json');
  ep.allowClicks = ['Save Changes'];
  assert.match(validateEpisode(ep).issues.join('\n'), /allowClicks entry "Save Changes" matches the write guard/);
});

test('an allowed read-only click passes', () => {
  const ep = load('episode.valid.json');
  ep.allowClicks = ['Variance view'];
  ep.beats[1].actions.push({ type: 'click', name: 'Variance view', target: 'role=button[name="Variance view"]' });
  assert.equal(validateEpisode(ep).success, true);
});

test('a dangling chapter reference is rejected', () => {
  const ep = load('episode.valid.json');
  ep.beats[0].chapter = 'nowhere';
  assert.match(validateEpisode(ep).issues.join('\n'), /beat "title" references chapter "nowhere"/);
});

test('script-locked or later needs claims, and a claim for every VO line', () => {
  const noClaims = { ...load('episode.valid.json'), claims: [] };
  noClaims.vo = noClaims.vo.map(({ claims, ...line }) => line);
  const issues = validateEpisode(noClaims).issues.join('\n');
  assert.match(issues, /status "script-locked" requires claims/);
  assert.match(issues, /vo line "vo-map-1" has no claims/);
  assert.equal(validateEpisode({ ...noClaims, status: 'draft' }).success, true);
});

test('a VO line may cite only claims the episode lists', () => {
  const ep = load('episode.valid.json');
  ep.vo[0].claims = ['dashboard-overview/2/3'];
  assert.match(validateEpisode(ep).issues.join('\n'), /cites claim "dashboard-overview\/2\/3", which is not listed/);
});

test('claim IDs must exist in the claims ledger when it is present', () => {
  const ep = load('episode.valid.json');
  ep.claims.push('dashboard-overview/99/1');
  assert.throws(() => checkEpisode(ep), /claim "dashboard-overview\/99\/1" is not in the claims ledger/);
  assert.equal(checkEpisode(ep, { ledger: null }).claims.length, 3);
});

test('shape errors name the beat and action path', () => {
  const ep = load('episode.valid.json');
  ep.beats[1].actions[0] = { type: 'teleport' };
  const res = validateEpisode(ep);
  assert.equal(res.success, false);
  assert.match(res.issues.join('\n'), /beats\["map"\]\.actions\[0\]/);
});

test('durationTarget minimum may not exceed the maximum', () => {
  const ep = { ...load('episode.valid.json'), durationTarget: [30, 20] };
  assert.match(validateEpisode(ep).issues.join('\n'), /durationTarget minimum 30 s is above the maximum 20 s/);
});

test('minimumHold is 1.5 s plus 0.3 s per word', () => {
  assert.equal(minimumHold(''), 0);
  assert.ok(Math.abs(minimumHold('Read the map') - 2.4) < 1e-9);
  const ep = load('episode.valid.json');
  ep.beats[1].hold = 2.4; // exactly the minimum for three words passes despite float rounding
  assert.equal(validateEpisode(ep).success, true);
});

test('the example in video/episodes/README.md is a valid episode', () => {
  const readme = readFileSync(path.join(REPO_ROOT, 'video', 'episodes', 'README.md'), 'utf8');
  const blocks = [...readme.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1, 'README has no json example');
  const example = JSON.parse(blocks[0]);
  assert.equal(checkEpisode(example, { ledger: CLAIMS_LEDGER }).id, example.id);
});

test('the write guard has exactly one definition, in scripts/lib/writes.mjs', () => {
  const res = spawnSync('git', ['grep', '--untracked', '-l', '-F', WRITES.source], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(res.stdout.trim().split('\n'), ['scripts/lib/writes.mjs']);
  // The harvest reaches WRITES through the shared click guard (scripts/lib/guarded-click.mjs), which imports it
  // from writes.mjs.
  const harvest = readFileSync(path.join(REPO_ROOT, 'scripts', 'fidelity-harvest.mjs'), 'utf8');
  assert.match(harvest, /from '\.\/lib\/guarded-click\.mjs';/);
  const guard = readFileSync(path.join(REPO_ROOT, 'scripts', 'lib', 'guarded-click.mjs'), 'utf8');
  assert.match(guard, /import \{ WRITES \} from '\.\/writes\.mjs';/);
});
