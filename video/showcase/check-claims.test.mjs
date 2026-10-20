// Tests for check-claims.mjs. Fixtures are fictional (video/showcase/fixtures/); each test breaks
// one rule on a copy of the passing fixture episode, written to a temporary folder that is removed
// afterwards. Run: node --test video/showcase/check-claims.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT, SERIES_WORD, MARKERS, parseApprovals, brandLeftover, loadClaims, isApproved, collectItems,
} from './check-claims.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'check-claims.mjs');
const FIX = path.join(HERE, 'fixtures');
const CLAIMS = path.join(FIX, 'claims.fixture.json');
const APPROVALS = path.join(FIX, 'approvals.fixture.md');

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const fixtureEpisode = () => JSON.parse(readFileSync(path.join(FIX, 'episode.fixture.json'), 'utf8'));
const DOC = [
  '# Sample claims check',
  '',
  'Hand-written text above the block.',
  '',
  MARKERS.claims[0],
  MARKERS.claims[1],
  '',
  '## Held for expert review',
  '',
  MARKERS.held[0],
  MARKERS.held[1],
  '',
  'Hand-written text below the blocks.',
  '',
].join('\n');

// A temporary folder holding the episode (after mutate) and a doc with empty blocks.
function workspace(mutate) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-claims-'));
  dirs.push(dir);
  const ep = fixtureEpisode();
  if (mutate) mutate(ep);
  const episode = path.join(dir, 'episode.json');
  const doc = path.join(dir, 'claims-check.md');
  writeFileSync(episode, JSON.stringify(ep, null, 2));
  writeFileSync(doc, DOC);
  return { dir, episode, doc };
}

function run(ws, ...extra) {
  const args = [SCRIPT, '--episode', ws.episode, '--claims', ws.claims ?? CLAIMS, '--approvals', ws.approvals ?? APPROVALS, '--doc', ws.doc, ...extra];
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

// Writes the doc, then checks: the rules alone decide the exit code.
function check(ws, ...extra) {
  run(ws, '--write');
  return run(ws, ...extra);
}

const voLine = (ep, id) => ep.vo.find((l) => l.id === id);
const label = (ep, id) => ep.beats.flatMap((b) => b.labels ?? []).find((l) => l.id === id);
// Point vo-b1 at a claim and keep the top-level claims list in step.
const citeOnVo = (ep, ...ids) => {
  voLine(ep, 'vo-b1').claims = ids;
  ep.claims = [...new Set(collectItems(ep).flatMap((i) => i.claims))];
};

test('passes a fixture whose every item is Verified or brand-only', () => {
  const ws = workspace();
  const r = check(ws);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /0 failures, 0 warnings/);
  assert.match(r.out, /is up to date/);
});

test('fails an unknown claim ID and prints the beat, item, text, claim ID and reason', () => {
  const ws = workspace((ep) => citeOnVo(ep, 'sample-map/9/9'));
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL B1 vo-b1 "Sample pins show sample moisture\." sample-map\/9\/9: claim ID is not in the claims ledger/);
});

test('fails a Wrong claim', () => {
  const ws = workspace((ep) => citeOnVo(ep, 'sample-map/1/2'));
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /sample-map\/1\/2: status is Wrong; only Verified is accepted/);
});

test('fails a Needs expert claim and quotes its expert question', () => {
  const ws = workspace((ep) => citeOnVo(ep, 'sample-map/1/3'));
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /sample-map\/1\/3: status is Needs expert; only Verified is accepted \(expert question: Does sample soil prefer a sample target\?\)/);
});

test('fails an Unverified claim', () => {
  const ws = workspace((ep) => citeOnVo(ep, 'sample-map/1/4'));
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /sample-map\/1\/4: status is Unverified/);
});

test('fails Not shipping on an item without comingSoon and an approval gate', () => {
  const ws = workspace((ep) => citeOnVo(ep, 'sample-push/1/2'));
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /sample-push\/1\/2: status is Not shipping: allowed only on a comingSoon: true item with an Approved gate/);
});

test('fails Not shipping when the gate is pending, decided without approval, not approved or missing', () => {
  for (const [gate, reason] of [
    ['SC-WAIT', /gate SC-WAIT reads "pending", not Approved/],
    ['SC-EXEC', /gate SC-EXEC reads "decided by executor", not Approved/],
    ['SC-NOPE', /gate SC-NOPE reads "not approved", not Approved/],
    ['SC-NONE', /approval gate SC-NONE has no row in the approvals log/],
  ]) {
    const ws = workspace((ep) => {
      citeOnVo(ep, 'sample-push/1/2');
      Object.assign(voLine(ep, 'vo-b1'), { text: 'Sample scheduling: COMING SOON.', comingSoon: true, approval: gate });
    });
    const r = check(ws);
    assert.equal(r.code, 1, `${gate}: ${r.out}`);
    assert.match(r.out, reason);
  }
});

test('accepts Not shipping on a COMING SOON item whose gate reads Approved', () => {
  const ws = workspace((ep) => {
    citeOnVo(ep, 'sample-push/1/2');
    Object.assign(voLine(ep, 'vo-b1'), { text: 'Sample scheduling: COMING SOON.', comingSoon: true, approval: 'SC-SOON' });
  });
  const r = check(ws);
  assert.equal(r.code, 0, r.out);
});

test('fails a comingSoon item whose text does not say COMING SOON', () => {
  const ws = workspace((ep) => {
    citeOnVo(ep, 'sample-push/1/2');
    Object.assign(voLine(ep, 'vo-b1'), { comingSoon: true, approval: 'SC-SOON' });
  });
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /comingSoon item must say COMING SOON/);
});

test('brand exemption: brand names, the series word and the decided end-card copy need no claim', () => {
  const ws = workspace((ep) => {
    ep.beats[3].labels.push({ id: 'lbl-b3-names', text: 'Lynx · TurfRad · IntelliDash', kind: 'brand', claims: [] });
  });
  const r = check(ws);
  assert.equal(r.code, 0, r.out);
  const doc = readFileSync(ws.doc, 'utf8');
  assert.match(doc, /"Explore the Sample Guides" \| B3 \| brand \| — \| brand, no claim needed \| end-card copy decided at SC-CTA/);
});

test('fails a brand item that also makes a capability claim', () => {
  const ws = workspace((ep) => {
    label(ep, 'lbl-b3-cta').text = 'Spatial Adjust saves water on every hole';
  });
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL B3 lbl-b3-cta "Spatial Adjust saves water on every hole" -: brand item holds more than a brand name or the decided end-card copy: "saves water on every hole" needs a claim/);
});

test('fails a label that is neither brand nor backed by a claim', () => {
  const ws = workspace((ep) => {
    ep.beats[1].labels.push({ id: 'lbl-b1-extra', text: 'Sample overlay', kind: 'label', claims: [] });
  });
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /lbl-b1-extra "Sample overlay" -: no claim ID/);
});

test('fails the end-card copy while its gate has no recorded decision', () => {
  const ws = workspace((ep) => {
    ep.endCard.approval = 'SC-WAIT';
  });
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /end-card gate SC-WAIT has no recorded decision/);
  assert.match(r.out, /lbl-b3-cta "Explore the Sample Guides" -: brand item holds more than a brand name/);
});

test('warns on a number without a calculation or prerequisite claim, and fails with --strict', () => {
  const ws = workspace((ep) => {
    voLine(ep, 'vo-b1').text = 'Sample pins show sample moisture 3 times a day.';
  });
  const plain = check(ws);
  assert.equal(plain.code, 0, plain.out);
  assert.match(plain.out, /WARN B1 vo-b1 "Sample pins show sample moisture 3 times a day\." -: digit or % in the text/);
  const strict = run(ws, '--strict');
  assert.equal(strict.code, 1, strict.out);
  assert.match(strict.out, /FAIL B1 vo-b1 .*digit or % in the text.*\(--strict\)/);
});

test('accepts a number backed by a prerequisite claim under --strict', () => {
  const ws = workspace((ep) => {
    citeOnVo(ep, 'sample-push/before/1');
    voLine(ep, 'vo-b1').text = 'The sample controller must be set to 100%.';
  });
  const r = check(ws, '--strict');
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /WARN/);
});

test('fails a chapter label or episode title drawn on screen but missing from labels[]', () => {
  const ws = workspace((ep) => {
    ep.beats[1].labels = [];
    ep.beats[0].labels = ep.beats[0].labels.filter((l) => l.kind !== 'title');
    ep.claims = [...new Set(collectItems(ep).flatMap((i) => i.claims))];
  });
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(chapter label\) "See the sample" -: the beat's chapter label has no labels\[\] item/);
  assert.match(r.out, /\(chapter see\) "See the sample" -: chapter label is drawn on screen/);
  assert.match(r.out, /\(title\) "From sample to spray" -: the episode title is drawn on the title card/);
});

test('fails when the top-level claims list drifts from what the items cite', () => {
  const ws = workspace((ep) => {
    ep.claims = ['sample-map/tile/1', 'sample-map/1/1', 'sample-calc/1/2'];
  });
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /sample-push\/1\/1, sample-calc\/1\/1: cited by an item but missing/);
  assert.match(r.out, /sample-calc\/1\/2: listed in the episode's top-level claims\[\] but cited by no item/);
});

test('fails a Target Profiles claim, even a Verified one, while the decision is omit', () => {
  const ws = workspace((ep) => citeOnVo(ep, 'target-profiles/1/1'));
  const r = check(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /target-profiles\/1\/1: Target Profiles claim, but targetProfiles.decision is "omit" \(gate SC-TP\)/);
});

test('held items: a Needs expert held line passes and is listed; a held id that is also live fails', () => {
  const ws = workspace();
  assert.equal(check(ws).code, 0);
  const doc = readFileSync(ws.doc, 'utf8');
  assert.match(doc, /\| `held-b1` \| "Sample soil always prefers a sample target\." \| B1 \| `sample-map\/1\/3` \| Needs expert \| Does sample soil prefer a sample target\? \| Held until the sample expert answers\. \|/);

  const clash = workspace((ep) => {
    ep.held[0].id = 'vo-b1';
  });
  const r = check(clash);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /held item id "vo-b1" is also a live line or label/);
});

test('a stale doc fails without --write', () => {
  const ws = workspace();
  assert.equal(check(ws).code, 0);
  const ep = JSON.parse(readFileSync(ws.episode, 'utf8'));
  voLine(ep, 'vo-b1').text = 'Sample pins show the sample moisture.';
  writeFileSync(ws.episode, JSON.stringify(ep, null, 2));
  const r = run(ws);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /claims-check\.md is stale/);
});

test('--write rewrites only the marked blocks, and a second run without --write exits 0', () => {
  const ws = workspace();
  const before = readFileSync(ws.doc, 'utf8');
  const w = run(ws, '--write');
  assert.equal(w.code, 0, w.out);
  assert.match(w.out, /rewritten between its markers/);
  const after = readFileSync(ws.doc, 'utf8');
  const outside = (s) => [s.slice(0, s.indexOf(MARKERS.claims[0])), s.slice(s.indexOf(MARKERS.claims[1]), s.indexOf(MARKERS.held[0])), s.slice(s.indexOf(MARKERS.held[1]))];
  assert.deepEqual(outside(after), outside(before));
  assert.match(after, /\| # \| Text \(exact copy\) \| Beat \| Kind \| Claim IDs \| Status \| Citation \|/);
  assert.match(after, /"Divide the sample deficit by 5 and send the sample changes\." \| B2 \| vo \| `sample-calc\/1\/1`<br>`sample-push\/1\/1` \| Verified<br>Verified \| SampleService\.cs:42<br>sample-push\.component\.html:5 \|/);
  assert.match(after, /\*\*Ledger:\*\* 11 claims; production `1111111111111111111111111111111111111111`/);
  const again = run(ws);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /is up to date/);
});

test('fails a doc without markers', () => {
  const ws = workspace();
  writeFileSync(ws.doc, '# No markers here\n');
  const r = run(ws, '--write');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /has no <!-- claims:begin --> \.\.\. <!-- claims:end --> block/);
});

test('--claims accepts a directory of per-guide shards, and an object keyed by id', () => {
  const ledger = JSON.parse(readFileSync(CLAIMS, 'utf8'));
  const ws = workspace();
  const shards = path.join(ws.dir, 'ledger', 'guides');
  mkdirSync(shards, { recursive: true });
  const byGuide = Map.groupBy ? Map.groupBy(ledger.claims, (c) => c.guide) : ledger.claims.reduce((m, c) => m.set(c.guide, [...(m.get(c.guide) ?? []), c]), new Map());
  for (const [guide, claims] of byGuide) writeFileSync(path.join(shards, `${guide}.json`), JSON.stringify({ guide, title: guide, claims }));
  const fromDir = check({ ...ws, claims: path.join(ws.dir, 'ledger') });
  assert.equal(fromDir.code, 0, fromDir.out);
  assert.equal(loadClaims(path.join(ws.dir, 'ledger')).claims.size, ledger.claims.length);

  const keyed = path.join(ws.dir, 'keyed.json');
  writeFileSync(keyed, JSON.stringify(Object.fromEntries(ledger.claims.map(({ id, ...rest }) => [id, rest]))));
  const { claims } = loadClaims(keyed);
  assert.equal(claims.get('sample-calc/1/1').type, 'calculation');
  assert.deepEqual(claims.get('sample-calc/1/2').citation, ['sample-refresh.service.ts:7 (develop @2222222)']);
  const fromKeyed = check({ ...ws, claims: keyed });
  assert.equal(fromKeyed.code, 0, fromKeyed.out);
});

test('parseApprovals reads only the Gate and Decision columns, and a later row wins', () => {
  const gates = parseApprovals(readFileSync(APPROVALS, 'utf8') + '\n| Showcase gate | Decision |\n|---|---|\n| SC-WAIT | Approved with changes |\n');
  assert.equal(gates.get('G1'), 'approved');
  assert.equal(gates.get('SC-CTA'), 'decided by executor');
  assert.equal(gates.get('SC-WAIT'), 'Approved with changes');
  assert.ok(isApproved('Approved') && isApproved('approved with changes'));
  assert.ok(!isApproved('not approved') && !isApproved('decided by executor') && !isApproved('pending'));
});

test('brandLeftover keeps only what is not a brand name or allowed copy', () => {
  const allowed = ['Spatial Adjust', 'Toro', 'Lynx'];
  assert.equal(brandLeftover('Toro · Spatial Adjust', allowed), '');
  assert.equal(brandLeftover('SPATIAL ADJUST', allowed), '');
  assert.equal(brandLeftover('Spatial Adjust waters smarter', allowed), 'waters smarter');
});

test('SERIES_WORD matches the series word the builder draws', () => {
  const brand = path.join(REPO_ROOT, 'video', 'edit', 'lib', 'brand.py');
  if (!existsSync(brand)) return;
  const m = readFileSync(brand, 'utf8').match(/^SERIES_WORD\s*=\s*['"]([^'"]+)['"]/m);
  assert.ok(m, 'SERIES_WORD not found in video/edit/lib/brand.py');
  assert.equal(SERIES_WORD, m[1]);
});

test('a missing ledger is an input error (exit 2), not a pass', () => {
  const ws = workspace();
  const r = run({ ...ws, claims: path.join(ws.dir, 'nope.json') });
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /claims ledger not found/);
});
