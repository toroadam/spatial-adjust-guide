import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyKnownDrift, parseDriftLedger, recordableKey, renderDriftLedger } from './guide-drift.mjs';

const COUNT = "station-details: 4 chapters != 5 rendered steps";
const LABEL = "station-details chapter 4: label 'Watch for a modelled child' != step title 'Spot a modelled sprinkler'";
const HIGHLIGHT = "station-details chapter 1: highlight.label 'Station' is not a bold label of step 1 (none)";
const CLAIM = 'station-details vo V1a: claim station-details/9/9 is not in the claims ledger';

const ledgerOf = (findings) => parseDriftLedger(JSON.parse(renderDriftLedger(findings, { reason: 'because' })));

test('only the three step-structure findings are recordable', () => {
  assert.equal(recordableKey(COUNT), 'station-details');
  assert.equal(recordableKey(LABEL), 'station-details');
  assert.equal(recordableKey(HIGHLIGHT), 'station-details');
  assert.equal(recordableKey(CLAIM), null);
  assert.equal(recordableKey("station-details: schema: chapters: Required"), null);
  assert.equal(recordableKey("station-details: title 'A' != rendered title 'B'"), null);
  assert.equal(recordableKey("series: loudness spread 1.20 LU across approved episodes is above 1 LU"), null);
});

test('a recorded finding is known drift; an unrecorded one stays open', () => {
  const { ledger, problems } = ledgerOf([COUNT, LABEL]);
  assert.deepEqual(problems, []);
  const r = applyKnownDrift([COUNT, LABEL, HIGHLIGHT, CLAIM], ledger);
  assert.deepEqual(r.known, [COUNT, LABEL]);
  assert.deepEqual(r.open, [HIGHLIGHT, CLAIM]);
  assert.deepEqual(r.stale, []);
});

test('a recorded finding that no longer occurs is stale, and only for the episodes linted', () => {
  const { ledger } = ledgerOf([COUNT, LABEL]);
  const r = applyKnownDrift([COUNT], ledger);
  assert.equal(r.stale.length, 1);
  assert.match(r.stale[0], /no longer occurs; remove it/);
  assert.deepEqual(applyKnownDrift([], ledger, { keys: ['other-key'] }).stale, []);
});

test('the ledger refuses to record anything else, or another episode\'s finding', () => {
  const bad = parseDriftLedger({ episodes: { 'station-details': { reason: 'x', findings: [CLAIM, COUNT, 'other: 3 chapters != 4 rendered steps'] } } });
  assert.equal(bad.problems.length, 2);
  assert.match(bad.problems[0], /not a finding the ledger may record/);
  assert.match(bad.problems[1], /belongs to other/);
  assert.match(parseDriftLedger({ episodes: { a: { findings: ['a: 1 chapters != 2 rendered steps'] } } }).problems[0], /needs a reason/);
  assert.match(parseDriftLedger({ episodes: { a: { reason: 'r', findings: [] } } }).problems[0], /non-empty findings/);
  assert.deepEqual(parseDriftLedger(null).problems, []);
});

test('a finding that differs in any word from a recorded one is not recorded', () => {
  const { ledger } = ledgerOf([LABEL]);
  const changed = LABEL.replace('modelled child', 'modelled children');
  assert.deepEqual(applyKnownDrift([changed], ledger).open, [changed]);
});

test('the committed ledger parses without a problem and every reason is stated', () => {
  const file = join(import.meta.dirname, '..', 'episodes', 'guide-drift.json');
  const { ledger, problems } = parseDriftLedger(JSON.parse(readFileSync(file, 'utf8')));
  assert.deepEqual(problems, []);
  assert.ok(ledger.size > 0);
  for (const [key, entry] of ledger) assert.ok(entry.reason.length > 40, key);
});
