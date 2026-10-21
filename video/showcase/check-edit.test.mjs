// Tests for check-edit.mjs. Each test breaks one rule on a copy of the showcase's own configs, with a
// synthetic approvals table, so nothing here depends on what video/approvals.md says today.
// Run: node --test video/showcase/check-edit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, checkEdit, showcaseRows, latestDecided, CHAIN, NEEDS_HIGHLIGHT } from './check-edit.mjs';

const read = (p) => JSON.parse(readFileSync(path.join(REPO_ROOT, p), 'utf8'));
const episode = () => read('video/showcase/episode.json');
const endCard = () => read('video/brand/end-card.json');
const music = () => read('video/brand/music.json');

const ROW = (gate, decision, notes = '') => `| ${gate} | artifact | version | ${decision} | 2026-10-21 | executor | ${notes} |`;
const MUSIC_NOTES = 'track sa-bed-v1; library none (original); licence type original; licence reference in music.json; purchaser none (original work, nothing bought); date 2026-10-21; sha256 7388f588';
const approvals = (extra = []) => [
  '| Showcase gate | Artifact | Version | Decision | Date | Approver | Quote / notes |', '|---|---|---|---|---|---|---|',
  ROW('SC-CTA', 'decided by executor'), ROW('SC-MUSIC', 'decided by executor', MUSIC_NOTES), ...extra,
].join('\n');
const run = (over = {}) => checkEdit(over.episode ?? episode(), { approvalsMd: over.approvalsMd ?? approvals(), endCard: over.endCard ?? endCard(), music: over.music ?? music() });

test('the showcase edit block passes', () => {
  assert.deepEqual(run(), []);
});

test('the block covers b1 to b7 and highlights on b2 to b7', () => {
  const e = episode().edit;
  for (const id of CHAIN) assert.ok(e.chapterLabels[id], id);
  for (const id of NEEDS_HIGHLIGHT) assert.ok(e.highlights[id].length >= 1, id);
});

test('a missing edit block fails', () => {
  const ep = episode(); delete ep.edit;
  assert.deepEqual(run({ episode: ep }), ['episode.json has no edit block']);
});

test('a title card without its title label fails; a changed title fails', () => {
  let ep = episode(); delete ep.edit.titleCard.title;
  assert.match(run({ episode: ep }).join('\n'), /title card: edit\.titleCard\.title/);
  ep = episode(); ep.title = 'Another title';
  assert.match(run({ episode: ep }).join('\n'), /the title label reads "From scan to water"/);
});

test('a chapter without a label, or with a label of the wrong kind or text, fails', () => {
  let ep = episode(); delete ep.edit.chapterLabels.b4;
  assert.match(run({ episode: ep }).join('\n'), /no label for beat b4/);
  ep = episode(); ep.beats.find((b) => b.id === 'b3').labels[0].kind = 'title';
  assert.match(run({ episode: ep }).join('\n'), /b3 is kind "title", not chapter/);
  ep = episode(); ep.beats.find((b) => b.id === 'b2').labels[0].text = 'Measured';
  assert.match(run({ episode: ep }).join('\n'), /beat b2 shows "Measured" but its chapter is "Measure"/);
});

test('a beat from b2 to b7 without a highlight fails', () => {
  const ep = episode(); ep.edit.highlights.b5 = [];
  assert.match(run({ episode: ep }).join('\n'), /beat b5 has no highlight/);
});

test('a highlighted shot needs a target and a focus action', () => {
  let ep = episode(); ep.edit.highlights.b2.push('b2-s9');
  assert.match(run({ episode: ep }).join('\n'), /b2-s9 is not a shot of beat b2/);
  ep = episode(); ep.edit.highlights.b7.push('b7-s2');
  const out = run({ episode: ep }).join('\n');
  assert.match(out, /shot b7-s2 lists no highlight target/);
  assert.match(out, /shot b7-s2 has no focus action/);
});

test('end card copy must match the config, and its gate must be decided', () => {
  let ec = endCard(); ec.cta = 'Visit us';
  assert.match(run({ endCard: ec }).join('\n'), /the cta label reads "Explore the Spatial Adjust Guides", .* says "Visit us"/);
  assert.match(run({ approvalsMd: approvals().replace('| SC-CTA | artifact | version | decided by executor', '| SC-CTA | artifact | version | pending') }).join('\n'), /gate SC-CTA has no decided row/);
  ec = endCard(); delete ec.legal;
  assert.match(run({ endCard: ec }).join('\n'), /lacks cta, display or legal/);
});

test('music needs a licence record, a media-root file and a complete SC-MUSIC row', () => {
  let m = music(); delete m.licence.reference;
  assert.match(run({ music: m }).join('\n'), /licence lacks type or reference/);
  m = music(); m.track.file = '/Users/someone/track.wav';
  assert.match(run({ music: m }).join('\n'), /track\.file must be a path under the media root/);
  m = music(); m.track.file = 'package.json';
  assert.match(run({ music: m }).join('\n'), /exists inside the repository/);
  assert.match(run({ approvalsMd: approvals().replace(/\| SC-MUSIC.*\n?/, '') }).join('\n'), /gate SC-MUSIC has no decided row/);
  const out = run({ approvalsMd: approvals().replace('purchaser none (original work, nothing bought); ', '') }).join('\n');
  assert.match(out, /does not record the purchaser/);
});

test('a later pending row does not hide an earlier decided one, but a missing decision does', () => {
  const rows = showcaseRows(approvals([ROW('SC-MUSIC', 'pending')]));
  assert.equal(latestDecided(rows, 'SC-MUSIC').decision, 'decided by executor');
  assert.equal(latestDecided(showcaseRows(ROW('SC-MUSIC', 'pending')), 'SC-MUSIC'), undefined);
});

test('red in the edit block fails', () => {
  const ep = episode(); ep.edit.chapterLabels.b1 = 'lbl-b1-chapter red';
  assert.match(run({ episode: ep }).join('\n'), /names red/);
});
