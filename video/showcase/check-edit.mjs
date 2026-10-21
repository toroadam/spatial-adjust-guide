#!/usr/bin/env node
// check-edit.mjs: the showcase's edit configuration (the `edit` block of video/showcase/episode.json)
// carries every part of the cut the acceptance rules name. Run from the repository root:
//   node video/showcase/check-edit.mjs [--episode <file>] [--approvals <file>] [--music <file>] [--end-card <file>]
//
// What it checks (one line per problem, exit 1 on any):
//   - the title card: the lockup, series word and title labels exist on beat b0, and the title label
//     reads the episode's title;
//   - a chapter label for every chain beat b1 to b7: edit.chapterLabels names a label of kind chapter on
//     that beat whose text is the beat's label and its chapter's label (the builder draws the typed chapter
//     card and the strip entry from the chapter);
//   - at least one highlight for every beat b2 to b7 (and any other chain beat that lists some): each shot
//     id under edit.highlights exists in the beat's capture block and has a highlight target, and a focus
//     action on it, which is what the compositor draws as a blue box and pushes in on;
//   - the end card: the lockup, call to action, URL and legal labels exist on the end beat, and their text is
//     the copy in the config edit.endCard.config names (video/brand/end-card.json: cta, display, legal), with
//     the SC-CTA gate decided in video/approvals.md;
//   - the music: edit.music names video/brand/music.json, which carries a track (id, library, file, sha256) and
//     a licence (type, reference); the file is a path inside the media root's music folder, never inside the
//     repository; the SC-MUSIC row in video/approvals.md names the track, library, licence type and
//     reference, purchaser and date (a row whose decision is pending or missing fails);
//   - no red: the repository's motion system keeps every highlight blue, so no highlight or label in the
//     edit block names red.
//
// Exit codes: 0 clean, 1 a problem, 2 usage or input error. Node 20 ESM, built-ins only.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const CHAIN = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'];
export const NEEDS_HIGHLIGHT = ['b2', 'b3', 'b4', 'b5', 'b6', 'b7'];
const MUSIC_FIELDS = ['track', 'library', 'licence type', 'licence reference', 'purchaser', 'date'];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const cells = (line) => line.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.trim());

// rows of the showcase gate table: { gate, artifact, version, decision, date, approver, notes }
export function showcaseRows(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (!/^\|\s*SC-[A-Z0-9]+\s*\|/.test(line)) continue;
    const c = cells(line);
    rows.push({ gate: c[0], artifact: c[1], version: c[2], decision: c[3], date: c[4], approver: c[5], notes: c.slice(6).join(' | ') });
  }
  return rows;
}

const DECIDED = /^(decided by executor|approved)$/i;
export const latestDecided = (rows, gate) => [...rows].reverse().find((r) => r.gate === gate && DECIDED.test(r.decision));

export function checkEdit(ep, { approvalsMd = '', endCard = null, music = null, repoRoot = REPO_ROOT } = {}) {
  const problems = [];
  const fail = (m) => problems.push(m);
  const edit = ep.edit;
  if (!edit || typeof edit !== 'object') return ['episode.json has no edit block'];
  const beats = Object.fromEntries((ep.beats ?? []).map((b) => [b.id, b]));
  const label = (beat, id) => (beats[beat]?.labels ?? []).find((l) => l.id === id);

  // title card
  const tc = edit.titleCard ?? {};
  for (const k of ['lockup', 'series', 'title']) {
    if (!tc[k] || !label(tc.beat ?? 'b0', tc[k])) fail(`title card: edit.titleCard.${k} does not name a label on beat ${tc.beat ?? 'b0'}`);
  }
  const t = label(tc.beat ?? 'b0', tc.title);
  if (t && t.text !== ep.title) fail(`title card: the title label reads "${t.text}", the episode title is "${ep.title}"`);

  // chapter labels
  for (const id of CHAIN) {
    const b = beats[id];
    const lid = edit.chapterLabels?.[id];
    if (!b) { fail(`chapter label: beat ${id} is not in the episode`); continue; }
    const l = lid && label(id, lid);
    if (!l) { fail(`chapter label: no label for beat ${id} (edit.chapterLabels.${id})`); continue; }
    if (l.kind !== 'chapter') fail(`chapter label: ${lid} on ${id} is kind "${l.kind}", not chapter`);
    const ch = (ep.chapters ?? []).find((c) => c.id === b.chapter);
    if (!ch) fail(`chapter label: beat ${id} names chapter "${b.chapter}", which is not in chapters`);
    else if (l.text !== ch.label || b.label !== ch.label) fail(`chapter label: beat ${id} shows "${l.text}" but its chapter is "${ch.label}"`);
  }

  // highlights
  const hl = edit.highlights ?? {};
  for (const id of NEEDS_HIGHLIGHT) {
    if (!Array.isArray(hl[id]) || hl[id].length === 0) fail(`highlight: beat ${id} has no highlight (edit.highlights.${id})`);
  }
  for (const [id, shotIds] of Object.entries(hl)) {
    const shots = beats[id]?.capture?.shots;
    if (!shots) { fail(`highlight: beat ${id} has no capture shots`); continue; }
    for (const sid of shotIds) {
      const s = shots.find((x) => x.id === sid);
      if (!s) { fail(`highlight: ${sid} is not a shot of beat ${id}`); continue; }
      if (!(s.highlights ?? []).length) fail(`highlight: shot ${sid} lists no highlight target`);
      if (!(s.actions ?? []).some((a) => a.type === 'focus')) fail(`highlight: shot ${sid} has no focus action, so no box is drawn and no push-in follows`);
    }
  }
  if (/\bred\b/i.test(JSON.stringify({ h: edit.highlights, c: edit.chapterLabels }))) fail('highlight: the edit block names red; highlights are design-system blue');

  // end card
  const ec = edit.endCard ?? {};
  const endBeat = ec.beat ?? 'b8';
  const cfg = endCard ?? {};
  const want = { cta: cfg.cta, url: cfg.display, legal: cfg.legal };
  for (const k of ['lockup', 'cta', 'url', 'legal']) {
    const l = ec[k] && label(endBeat, ec[k]);
    if (!l) { fail(`end card: edit.endCard.${k} does not name a label on beat ${endBeat}`); continue; }
    if (k !== 'lockup' && want[k] !== undefined && l.text !== want[k]) fail(`end card: the ${k} label reads "${l.text}", ${ec.config ?? 'the end-card config'} says "${want[k]}"`);
  }
  if (!cfg.cta || !cfg.display || !cfg.legal) fail(`end card: ${ec.config ?? 'the end-card config'} lacks cta, display or legal`);
  const rows = showcaseRows(approvalsMd);
  if (!latestDecided(rows, ec.approval ?? 'SC-CTA')) fail(`end card: gate ${ec.approval ?? 'SC-CTA'} has no decided row in video/approvals.md`);

  // music
  const m = music ?? {};
  const tr = m.track ?? {};
  const lic = m.licence ?? {};
  if (edit.music?.config !== 'video/brand/music.json') fail('music: edit.music.config is not video/brand/music.json');
  if (!tr.id || !tr.library || !tr.file || !tr.sha256) fail('music: video/brand/music.json track lacks id, library, file or sha256');
  if (!lic.type || !lic.reference) fail('music: video/brand/music.json licence lacks type or reference');
  if (tr.file && (path.isAbsolute(tr.file) || tr.file.split('/').includes('..'))) fail('music: track.file must be a path under the media root');
  if (tr.file && existsSync(path.join(repoRoot, tr.file))) fail(`music: ${tr.file} exists inside the repository; the music file lives only in the media folder`);
  const mr = latestDecided(rows, edit.music?.approval ?? 'SC-MUSIC');
  if (!mr) fail(`music: gate ${edit.music?.approval ?? 'SC-MUSIC'} has no decided row in video/approvals.md`);
  else {
    const hay = `${mr.artifact} ${mr.version} ${mr.notes}`.toLowerCase();
    for (const f of MUSIC_FIELDS) if (!hay.includes(f)) fail(`music: the SC-MUSIC row does not record the ${f}`);
    if (tr.id && !hay.includes(tr.id.toLowerCase())) fail(`music: the SC-MUSIC row does not name the track ${tr.id}`);
    if (tr.sha256 && !hay.includes(tr.sha256.slice(0, 8))) fail('music: the SC-MUSIC row does not carry the track\'s SHA-256');
  }
  return problems;
}

export function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!['--episode', '--approvals', '--music', '--end-card'].includes(k) || i + 1 >= argv.length) {
      process.stderr.write(`check-edit: unknown or incomplete argument ${k}\n`);
      return 2;
    }
    args[k.slice(2)] = argv[++i];
  }
  const p = (v, d) => path.resolve(v ?? path.join(REPO_ROOT, d));
  try {
    const epPath = p(args.episode, 'video/showcase/episode.json');
    const ep = readJson(epPath);
    const endCardPath = p(args['end-card'], (ep.edit?.endCard?.config ?? ep.endCard?.config ?? 'video/brand/end-card.json'));
    const problems = checkEdit(ep, {
      approvalsMd: readFileSync(p(args.approvals, 'video/approvals.md'), 'utf8'),
      endCard: readJson(endCardPath),
      music: readJson(p(args.music, 'video/brand/music.json')),
    });
    for (const m of problems) process.stdout.write(`FAIL ${m}\n`);
    process.stdout.write(`check-edit: ${problems.length ? `${problems.length} problem(s)` : 'ok'}: title card, ${CHAIN.length} chapter labels, highlights on ${NEEDS_HIGHLIGHT.length} beats, end card, music\n`);
    return problems.length ? 1 : 0;
  } catch (err) {
    process.stderr.write(`check-edit: ${err.message}\n`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
