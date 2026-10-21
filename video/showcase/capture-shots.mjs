#!/usr/bin/env node
// The showcase's capture plan, shot by shot: reads the capture block of each chain beat (B1 to B7)
// in video/showcase/episode.json, checks it, and runs the pipeline's capture director once per
// shot. Nothing here forks the director: each shot becomes a small episode file that the director
// reads through its documented --episode <file> argument, written under the media root.
//
//   node video/showcase/capture-shots.mjs check
//        check every capture block; exit 0 clean, 1 with the problems listed
//   node video/showcase/capture-shots.mjs plans
//        write one director episode per shot to <media root>/showcase/capture/plans/<shot>.json,
//        each validated by the episode schema, and list shot, take number and file
//   node video/showcase/capture-shots.mjs run <shot|beat|all> [--attempt N] [--dry-run|--no-record]
//        run the director for each shot, in order: --dry-run prints the plan, --no-record
//        rehearses in real time, neither records; without them each shot is recorded as
//        take<T>-recreation.mp4 (T = shot take number + attempt). Stops at the first non-zero exit
//   node video/showcase/capture-shots.mjs status
//        for every shot, the takes on disk and their safety reports (exit, refusals, aborted
//        requests, documents after arming, denylist scans and hits by count), as CSV-ready rows
//
// Why shots: one director take loads one guide page and lifts one recreation figure, and a beat
// of the film shows several states (the map, then the variance view, then a selection). A shot is
// one figure, one take. Each shot records PRE_S of pre-roll (so a chapter's first cue has the
// builder's 0.55 s lead in front of it), its cut length, and HANDLE_S of handle after it.
// The take number encodes the shot: beat number, shot number, attempt (b3 shot 2, attempt 1 is
// take 321), so every take of the showcase has its own file under capture/raw/.
//
// Exit codes: 0 done; 1 a check failed or a director run exited non-zero (its code is printed);
// 2 usage or configuration.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkEpisode, REPO_ROOT, EpisodeError } from '../lib/episode-schema.mjs';
import { episodeDir } from '../lib/media-root.mjs';
import { buildPlan } from '../capture/director.mjs';

export const EPISODE = path.join(REPO_ROOT, 'video', 'showcase', 'episode.json');
export const DIRECTOR = path.join(REPO_ROOT, 'video', 'capture', 'director.mjs');
export const PRE_S = 0.7;          // pre-roll before a shot's actions start
export const HANDLE_S = 1.0;       // still frames after a shot's cut length
export const CUE_LEAD_S = 0.55;    // the builder's LEAD: a chapter's footage starts this long before its first cue
export const SOURCES = ['demo', 'recreation'];
const TOL = 0.011;

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

export const chainBeats = (ep) => (ep.beats ?? []).filter((b) => b.chapter);
export const shotCue = (shot) => `shot-${shot.id}`;

// b<beat>-s<shot> -> beat*100 + shot*10 + attempt
export function takeNumber(shotId, attempt = 1) {
  const m = /^b([1-9])-s([1-9])$/.exec(shotId);
  if (!m) throw new Error(`shot id "${shotId}" must look like b3-s2`);
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 9) throw new Error('attempt must be 1 to 9');
  return Number(m[1]) * 100 + Number(m[2]) * 10 + attempt;
}

// The seconds a shot's own actions take: the director's step times (STEP_S in director.mjs: a
// hover glides for 0.75 s, a click for 0.87 s, a scroll for 0.9 s; focus and cue take none).
export function busyOf(actions) {
  const STEP = { hover: 0.75, click: 0.87, scroll: 0.9, focus: 0, cue: 0 };
  return actions.reduce((s, a) => s + (a.type === 'wait' ? a.ms / 1000 : STEP[a.type] ?? 0), 0);
}

// The length of a shot's take by the director's own plan (lead, beat, tail), in seconds.
export function takeLength(ep, beat, shot) {
  return buildPlan(shotEpisode(ep, beat, shot)).seconds;
}

// Which VO lines a shot starts: the beat's first shot starts beat.vo; any shot may start one more
// with "vo". Returns [{ shot, vo, at }], at = seconds into the chapter's footage the cue lands on.
export function voStarts(beat) {
  const out = [];
  let t = 0;
  (beat.capture?.shots ?? []).forEach((s, i) => {
    const vo = i === 0 ? beat.vo : s.vo;
    if (vo) out.push({ shot: s.id, vo, at: round(t + CUE_LEAD_S) });
    t += s.seconds;
  });
  return out;
}

export function beatActions(beat) {
  return (beat.voLines ?? (beat.vo ? [beat.vo] : [])).map((id) => ({ type: 'cue', id }));
}

export function checkCapture(ep) {
  const problems = [];
  const p = (m) => problems.push(m);
  const vo = new Map((ep.vo ?? []).map((l) => [l.id, l]));
  const ids = new Set();
  const beats = chainBeats(ep);
  if (beats.map((b) => b.id).join() !== 'b1,b2,b3,b4,b5,b6,b7') p(`the chain beats must be b1 to b7, in order (found ${beats.map((b) => b.id).join(', ')})`);
  for (const b of beats) {
    const c = b.capture;
    const at = `beat ${b.id}`;
    if (!c || typeof c !== 'object') { p(`${at}: no capture block`); continue; }
    if (!SOURCES.includes(c.source)) p(`${at}: capture.source must be demo or recreation`);
    if (!Array.isArray(c.declaredClicks)) p(`${at}: capture.declaredClicks must be a list (empty when no demo-mode click is declared)`);
    else if (c.declaredClicks.length && c.source !== 'demo') p(`${at}: declared demo-mode clicks are allowed only on a demo source`);
    for (const d of c.declaredClicks ?? []) if (!d.selector || !d.why || !d.safety) p(`${at}: a declared click needs selector, why and its SAFETY.md citation (safety)`);
    if (!Array.isArray(c.shots) || !c.shots.length) { p(`${at}: capture.shots must list at least one shot`); continue; }
    if (c.route !== c.shots[0].route) p(`${at}: capture.route must be the first shot's route`);
    let cut = 0;
    c.shots.forEach((s, i) => {
      const sat = `${at} shot ${s.id ?? i + 1}`;
      if (s.id !== `${b.id}-s${i + 1}`) p(`${sat}: the id must be ${b.id}-s${i + 1}`);
      if (ids.has(s.id)) p(`${sat}: duplicate shot id`);
      ids.add(s.id);
      if (typeof s.route !== 'string' || !/^\/#\/[a-z0-9-]+$/.test(s.route)) p(`${sat}: route must be a guide page, /#/<guide-key>`);
      if (c.source === 'recreation' && !(typeof s.figure === 'string' && s.figure.trim())) p(`${sat}: a recreation shot names the figure caption it lifts`);
      if (!(s.seconds > 0)) p(`${sat}: seconds (its cut length) must be positive`);
      if (!Array.isArray(s.actions)) { p(`${sat}: actions must be a list`); return; }
      for (const a of s.actions) {
        if (!['wait', 'hover', 'focus', 'scroll', 'click'].includes(a.type)) p(`${sat}: action type "${a.type}" is not allowed in a shot (cues are added from the beat)`);
        if (a.type === 'click' && !(c.declaredClicks ?? []).some((d) => d.selector === a.target)) p(`${sat}: a click must be a declared click`);
      }
      const focus = s.actions.filter((a) => a.type === 'focus').map((a) => a.target);
      if (JSON.stringify(s.highlights ?? []) !== JSON.stringify(focus)) p(`${sat}: highlights must list the shot's focus targets, in order`);
      const busy = busyOf(s.actions);
      if (busy > s.seconds + TOL) p(`${sat}: its actions take ${round(busy, 2)} s, more than its ${s.seconds} s`);
      if (s.vo !== undefined && (i === 0 || !vo.has(s.vo))) p(`${sat}: "vo" names a VO line a later shot starts`);
      if (s.take !== takeNumber(s.id)) p(`${sat}: take must be ${takeNumber(s.id)} (attempt 1)`);
      cut += s.seconds;
    });
    if (Math.abs(cut - b.footage) > TOL) p(`${at}: the shots cut to ${round(cut, 2)} s; the beat's footage is ${b.footage} s`);
    const take = round(c.shots.reduce((s, x) => s + PRE_S + x.seconds + HANDLE_S, 0), 2);
    if (Math.abs((c.takeSeconds ?? 0) - take) > TOL) p(`${at}: takeSeconds must be ${take} (each shot: ${PRE_S} s pre-roll + cut + ${HANDLE_S} s handle)`);
    if (!(c.takeSeconds >= b.footage + 1)) p(`${at}: takeSeconds must be at least the footage plus 1 s`);
    const starts = voStarts(b);
    const lines = b.voLines ?? [];
    if (starts.map((x) => x.vo).join() !== lines.join()) p(`${at}: the shots start ${starts.map((x) => x.vo).join(', ') || 'no VO line'}; the beat speaks ${lines.join(', ')}`);
    const footIn = round(b.tcIn + (b.card ?? 0));
    for (const s of starts) {
      const line = vo.get(s.vo);
      if (line?.windowIn !== undefined && Math.abs(footIn + s.at - line.windowIn) > 0.051) {
        p(`${at}: ${s.vo} would start at ${round(footIn + s.at, 2)} s of the film, not its windowIn ${line.windowIn} s`);
      }
    }
    if (JSON.stringify(b.actions ?? []) !== JSON.stringify(beatActions(b))) p(`${at}: actions must be the cues of its VO lines, ${JSON.stringify(beatActions(b))}, for the builder`);
  }
  return problems;
}

// One director episode for one shot: the showcase episode with a single beat, its source the
// shot's, the guide page and figure from the shot, and no clicks.
export function shotEpisode(ep, beat, shot) {
  const keep = ['id', 'title', 'guide', 'status', 'durationTarget', 'mapPolicy', 'claims', 'chapters', 'vo'];
  const out = Object.fromEntries(keep.filter((k) => ep[k] !== undefined).map((k) => [k, ep[k]]));
  const starts = voStarts(beat).filter((x) => x.shot === shot.id).map((x) => ({ type: 'cue', id: x.vo }));
  out.$comment = `Generated by video/showcase/capture-shots.mjs from video/showcase/episode.json, beat ${beat.id}, shot ${shot.id}. Do not edit: edit the capture block and run "plans" again.`;
  out.source = beat.capture.source;
  if (out.source === 'recreation') { out.recreationPath = shot.route; out.recreationFigure = shot.figure; }
  out.allowClicks = [];
  out.demoWriteClicks = [];
  out.beats = [{
    id: shot.id,
    chapter: beat.chapter,
    hold: round(PRE_S + shot.seconds + HANDLE_S),
    actions: [{ type: 'wait', ms: Math.round(PRE_S * 1000) }, { type: 'cue', id: shotCue(shot) }, ...starts, ...shot.actions],
  }];
  return out;
}

export function allShots(ep) {
  return chainBeats(ep).flatMap((b) => (b.capture?.shots ?? []).map((s) => ({ beat: b, shot: s })));
}

function loadEpisode(file = EPISODE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writePlans(ep) {
  const dir = episodeDir(ep.id, 'capture', 'plans');
  const out = [];
  for (const { beat, shot } of allShots(ep)) {
    const e = shotEpisode(ep, beat, shot);
    checkEpisode(e, { label: `${shot.id} plan` });
    const file = path.join(dir, `${shot.id}.json`);
    fs.writeFileSync(file, JSON.stringify(e, null, 1) + '\n');
    out.push({ shot: shot.id, take: shot.take, file, seconds: buildPlan(e).seconds });
  }
  return out;
}

function safetySummary(ep, take, source) {
  const stem = `take${take}${source === 'recreation' ? '-recreation' : ''}`;
  const raw = episodeDir(ep.id, 'capture', 'raw');
  const f = path.join(raw, `${stem}-safety.json`);
  if (!fs.existsSync(f)) return null;
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  return {
    take, stem, mp4: fs.existsSync(path.join(raw, `${stem}.mp4`)), recorded: s.recorded, exit: s.exit,
    refusals: s.refusals.length, aborted: s.aborted.length, websockets: s.websockets.length,
    documentsAfterArming: s.documents.filter((d) => d.armed).length, popups: s.popups.length,
    scans: s.scans.count, hits: s.scans.hits.length, overlay: s.overlay ? 'installed' : 'none',
    frame: s.frame?.box?.join(' ') ?? '', source: s.source,
  };
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  let ep;
  try { ep = loadEpisode(); } catch (err) { process.stderr.write(`capture-shots: ${err.message}\n`); return 2; }
  if (cmd === 'check') {
    const problems = checkCapture(ep);
    for (const m of problems) process.stdout.write(`capture-shots: ${m}\n`);
    const shots = allShots(ep);
    process.stdout.write(`capture-shots: ${problems.length ? `${problems.length} problem(s)` : 'ok'}: ${chainBeats(ep).length} beats, ${shots.length} shots, `
      + `${round(shots.reduce((s, x) => s + x.shot.seconds, 0), 2)} s cut, ${round(chainBeats(ep).reduce((s, b) => s + (b.capture?.takeSeconds ?? 0), 0), 2)} s of take\n`);
    return problems.length ? 1 : 0;
  }
  if (cmd === 'plans' || cmd === 'run') {
    const problems = checkCapture(ep);
    if (problems.length) { for (const m of problems) process.stderr.write(`capture-shots: ${m}\n`); return 1; }
    let plans;
    try { plans = writePlans(ep); } catch (err) {
      process.stderr.write(`capture-shots: ${err instanceof EpisodeError ? err.message : err.message}\n`); return 2;
    }
    if (cmd === 'plans') {
      for (const x of plans) process.stdout.write(`${x.shot}\ttake ${x.take}\t${x.seconds.toFixed(2)} s\t${x.file}\n`);
      return 0;
    }
    const which = rest.find((a) => !a.startsWith('--'));
    const flags = rest.filter((a) => a.startsWith('--'));
    const ai = rest.indexOf('--attempt');
    const attempt = ai >= 0 ? Number(rest[ai + 1]) : 1;
    if (!which) { process.stderr.write('capture-shots: run <shot|beat|all> [--attempt N] [--dry-run|--no-record]\n'); return 2; }
    const pass = flags.filter((f) => f === '--dry-run' || f === '--no-record');
    const chosen = allShots(ep).filter(({ beat, shot }) => which === 'all' || which === beat.id || which === shot.id);
    if (!chosen.length) { process.stderr.write(`capture-shots: no shot or beat "${which}"\n`); return 2; }
    for (const { shot } of chosen) {
      const take = takeNumber(shot.id, attempt);
      const file = plans.find((x) => x.shot === shot.id).file;
      process.stdout.write(`capture-shots: ${shot.id} take ${take}${pass.length ? ` (${pass.join(' ')})` : ''}\n`);
      const r = spawnSync(process.execPath, [DIRECTOR, '--episode', file, '--take', String(take), ...pass], { stdio: 'inherit', cwd: REPO_ROOT });
      if (r.status !== 0) { process.stdout.write(`capture-shots: ${shot.id} take ${take}: director exit ${r.status}\n`); return 1; }
    }
    return 0;
  }
  if (cmd === 'status') {
    process.stdout.write('shot,take,source,exit,recorded,mp4,refusals,aborted,websockets,documentsAfterArming,popups,scans,hits,frame\n');
    for (const { beat, shot } of allShots(ep)) {
      for (let a = 1; a <= 9; a++) {
        const s = safetySummary(ep, takeNumber(shot.id, a), beat.capture.source);
        if (!s) continue;
        process.stdout.write([shot.id, s.take, s.source, s.exit, s.recorded, s.mp4, s.refusals, s.aborted, s.websockets, s.documentsAfterArming, s.popups, s.scans, s.hits, s.frame].join(',') + '\n');
      }
    }
    return 0;
  }
  process.stderr.write('Usage: node video/showcase/capture-shots.mjs check | plans | run <shot|beat|all> [--attempt N] [--dry-run|--no-record] | status\n');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { process.stderr.write(`capture-shots: ${err?.stack ?? err}\n`); process.exit(2); });
}
