// Turns moderated-session files into the per-task table in docs/test-protocol.md: completion rate,
// median time on task and stuck steps. Reads exports of the local analytics transport
// (`__saExport()`, see src/analytics.js) and the moderator's sheet, applies the definitions in
// docs/test-protocol.md > Definitions, and prints Markdown that can be pasted into
// docs/followability-readout.md. Needs no browser and no network.
//
// Input. A round directory under _sessions/ (gitignored: raw exports never enter the repository) with,
// per participant code such as R1P01:
//   R1P01.events.json      the file `__saExport()` downloads (the array of events), required
//   R1P01.moderator.json   the moderator's sheet, optional; format in docs/test-protocol.md
// Codes must look like R1P01. A code that does not is refused, so a participant's name in a file name
// can never reach a table.
//
// What it prints. Counts, step numbers, medians and participant codes. It never prints event
// properties or the moderator's free text.
//
// Definitions applied (the protocol is the source of truth; this is the implementation):
//   completed unaided  moderator outcome `unaided`, no hint recorded, a guide_completed in the events
//                      (or usedPlayer: false), and at most 8 minutes
//   time on task       first guide_opened to first guide_completed, in seconds; the moderator's
//                      stopwatch when the player was not used (marked *); median over unaided attempts
//   stuck point        a participant, task and step with a dwell over 60 s, a back-step (the step
//                      returned to), an exit without completing, or a moderator hint, wrong-action or
//                      confusion; once per participant per step
//   stuck step         stuck for two or more participants, or a hint, or an exit by someone who failed
//
// Gaps in the analytics layer that this works around (docs/test-protocol.md > Definitions):
//   - step 1 has no step_advanced; guide_opened is arrival at step 1
//   - opening a guide from a #/<key> link records no guide_opened, so the first step_advanced stands in
//   - guide_completed fires on any arrival at the last step, including a jump, and repeats
//   - returned_home is declared and never emitted, so exits are inferred from the sequence
//   - below 768 px the step player is hidden and no step events are recorded
//
// Usage:
//   node scripts/session-readout.mjs _sessions/round1              per-task table for one round
//   node scripts/session-readout.mjs --compare _sessions/round1 _sessions/round2
//                                                                  round 2 against round 1 and the targets
//   node scripts/session-readout.mjs <dir> --json                  the raw result instead of Markdown
//   node scripts/session-readout.mjs --selftest                    check the scoring on made-up sessions
//
// Exit codes: 0 ok, 1 --compare found a target missed or --selftest failed, 2 unreadable input.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TASKS = [
  { id: 'T1', guide: 'minimum-threshold', steps: 8 },
  { id: 'T2', guide: 'target-profiles', steps: 7 },
  { id: 'T3', guide: 'station-zero', steps: 5 },
  { id: 'T4', guide: 'push-to-lynx', steps: 6 },
  { id: 'T5', guide: 'enable-disable-stations', steps: 6 },
  { id: 'T6', guide: 'request-scan-data', steps: 5 },
];
export const DWELL_STUCK_SECONDS = 60;
export const TASK_CAP_SECONDS = 480;
export const TARGET_RATE = 0.8;
export const BUFFER_CAP = 500;                 // src/analytics.js MAX: a ring buffer that drops the oldest
const CODE = /^R\d+P\d{2,3}$/;
const NAV = new Set(['guide_opened', 'step_advanced', 'guide_completed', 'returned_home']);
const STUCK_NOTES = new Set(['hint', 'wrong-action', 'confusion']);
const OUTCOMES = new Set(['unaided', 'aided', 'failed']);

export class InputError extends Error {}

const ts = (e) => Date.parse(e.t);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---- one attempt ------------------------------------------------------------------------------

/**
 * Scores one participant's attempt at one task.
 * @param task    an entry of TASKS
 * @param nav     the participant's navigation events (NAV), sorted by time
 * @param mod     the moderator's entry for this task, or undefined
 * @param haveMod true when the participant has a moderator file at all
 */
export function analyseAttempt(task, nav, mod, haveMod) {
  const mine = nav.filter((e) => e.props && e.props.key === task.guide);
  if (!mine.length && !mod) return null;

  const total = mine.map((e) => Number(e.props.total || e.props.steps)).find((n) => n > 0) || task.steps;
  const notes = (mod && Array.isArray(mod.notes)) ? mod.notes : [];
  const arrivals = [];                           // { step, e, visit }
  let openedAt = null, completedAt = null, visit = 0, reopened = 0, deepLink = false;
  for (const e of mine) {
    if (e.name === 'guide_opened') {
      if (openedAt !== null) reopened++; else openedAt = ts(e);
      arrivals.push({ step: 1, e, visit: ++visit });
    } else if (e.name === 'step_advanced') {
      if (visit === 0) { deepLink = true; openedAt = ts(e); visit = 1; }
      arrivals.push({ step: Number(e.props.step), e, visit });
    } else if (e.name === 'guide_completed' && completedAt === null) {
      completedAt = ts(e);
    }
  }

  // stuck: step -> Set of triggers
  const stuck = new Map();
  const add = (step, trigger) => {
    if (!(step >= 1)) return;
    if (!stuck.has(step)) stuck.set(step, new Set());
    stuck.get(step).add(trigger);
  };
  const offTask = new Set(notes.filter((n) => n.kind === 'off-task').map((n) => Number(n.step)));

  // back-steps: the step returned to
  arrivals.forEach((a, i) => {
    if (i > 0 && arrivals[i - 1].visit === a.visit && a.step < arrivals[i - 1].step) add(a.step, 'back-step');
  });
  // dwell: arrival to the next navigation event of any guide; the last step has none
  arrivals.forEach((a) => {
    if (a.step >= total) return;
    const next = nav[nav.indexOf(a.e) + 1];
    if (!next) return;
    const dwell = (ts(next) - ts(a.e)) / 1000;
    if (dwell > DWELL_STUCK_SECONDS && !offTask.has(a.step)) add(a.step, 'dwell');
  });
  // exit: left without completing, and not unaided
  const outcome = mod && OUTCOMES.has(mod.outcome) ? mod.outcome : (haveMod ? 'unknown' : 'events-only');
  let exitStep = null;
  if (completedAt === null && arrivals.length && outcome !== 'unaided') {
    exitStep = arrivals[arrivals.length - 1].step;
    add(exitStep, 'exit');
  }
  // the moderator's own observations
  const hintSteps = [];
  for (const n of notes) {
    if (!STUCK_NOTES.has(n.kind)) continue;
    add(Number(n.step), n.kind);
    if (n.kind === 'hint') hintSteps.push(Number(n.step));
  }

  const visited = new Set(arrivals.map((a) => a.step));
  const skipped = completedAt === null ? [] : Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 2).filter((s) => !visited.has(s));

  const usedPlayer = mod && typeof mod.usedPlayer === 'boolean' ? mod.usedPlayer : null;
  const seconds = completedAt !== null && openedAt !== null
    ? Math.round((completedAt - openedAt) / 1000)
    : (mod && Number.isFinite(mod.seconds) ? mod.seconds : null);
  const secondsFromModerator = completedAt === null && seconds !== null;
  const corroborated = completedAt !== null || usedPlayer === false;
  const warnings = [];
  let unaided = outcome === 'unaided' && corroborated && hintSteps.length === 0
    && (seconds === null || seconds <= TASK_CAP_SECONDS);
  if (outcome === 'unaided' && !corroborated) warnings.push(`${task.id}: moderator says unaided but no guide_completed and usedPlayer is not false; not counted`);
  if (outcome === 'unaided' && hintSteps.length) warnings.push(`${task.id}: moderator says unaided but recorded a hint; not counted`);
  if (outcome === 'unaided' && seconds !== null && seconds > TASK_CAP_SECONDS) warnings.push(`${task.id}: over the ${TASK_CAP_SECONDS / 60} minute cap; not counted`);
  if (unaided && seconds === null) warnings.push(`${task.id}: unaided with no time (no guide_completed and no stopwatch seconds)`);
  if (deepLink) warnings.push(`${task.id}: no guide_opened (opened from a link?); time starts at the first step_advanced`);
  if (skipped.length) warnings.push(`${task.id}: completed with ${skipped.length} step(s) never visited (${skipped.join(', ')}): a jump to the last step`);
  if (!mine.length) warnings.push(`${task.id}: moderator entry with no events (phone, or events lost)`);

  return {
    task: task.id, guide: task.guide, total, outcome, unaided,
    completedEvents: completedAt !== null, usedPlayer, seconds, secondsFromModerator,
    skipped, reopened, deepLink, exitStep,
    failedExit: exitStep !== null && outcome === 'failed',
    stuck: [...stuck.entries()].map(([step, t]) => ({ step, triggers: [...t].sort() })).sort((a, b) => a.step - b.step),
    hintSteps, warnings,
  };
}

// ---- one participant, one round ---------------------------------------------------------------

/** Validates and sorts the events of one export. Returns { nav, other counts, warnings }. */
export function readEvents(raw, label) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.raw) ? raw.raw : null);
  if (!list) throw new InputError(`${label}: not an __saExport() array`);
  const good = [], warnings = [];
  let bad = 0;
  for (const e of list) {
    if (e && typeof e.name === 'string' && typeof e.t === 'string' && Number.isFinite(Date.parse(e.t))) {
      good.push({ ...e, props: e.props && typeof e.props === 'object' ? e.props : {} });
    } else bad++;
  }
  if (bad) warnings.push(`${label}: ${bad} malformed event(s) skipped`);
  good.sort((a, b) => ts(a) - ts(b));
  if (list.length >= BUFFER_CAP) warnings.push(`${label}: ${list.length} events, the ${BUFFER_CAP} ring buffer is full, so the oldest were dropped`);
  const sids = new Set(good.map((e) => e.sid));
  if (sids.size > 1) warnings.push(`${label}: ${sids.size} tab sessions in one file`);
  const widths = good.filter((e) => e.device).map((e) => e.device);
  if (widths.includes('phone')) warnings.push(`${label}: phone-width events; no step events are recorded below 768 px`);
  return { good, warnings };
}

export function buildParticipant(code, rawEvents, moderator) {
  if (!CODE.test(code)) throw new InputError(`participant code "${code}" does not look like R1P01; refusing it so a name cannot reach a table`);
  const warnings = [];
  let nav = [];
  if (rawEvents !== undefined) {
    const r = readEvents(rawEvents, code);
    nav = r.good.filter((e) => NAV.has(e.name));
    warnings.push(...r.warnings);
  } else warnings.push(`${code}: no events file`);
  if (moderator) {
    if (moderator.participant !== undefined && moderator.participant !== code) throw new InputError(`${code}: moderator file names participant "${moderator.participant}"`);
    if (!Array.isArray(moderator.tasks)) throw new InputError(`${code}: moderator file has no tasks array`);
  } else warnings.push(`${code}: no moderator file; completion cannot be counted as unaided`);
  const byTask = new Map(((moderator && moderator.tasks) || []).map((t) => [t.guide, t]));
  const attempts = [];
  for (const task of TASKS) {
    const a = analyseAttempt(task, nav, byTask.get(task.guide), Boolean(moderator));
    if (a) { attempts.push(a); warnings.push(...a.warnings.map((w) => `${code} ${w}`)); }
  }
  const otherGuides = new Set(nav.filter((e) => e.name === 'guide_opened' && e.props.key && !TASKS.some((t) => t.guide === e.props.key)).map((e) => e.props.key));
  return {
    code,
    group: (moderator && moderator.group) || 'unknown',
    experience: (moderator && moderator.experience) || 'unknown',
    device: (moderator && moderator.device) || 'unknown',
    haveMod: Boolean(moderator), attempts, otherGuidesOpened: otherGuides.size, warnings,
  };
}

// ---- one round --------------------------------------------------------------------------------

export function summariseRound(participants) {
  const anyMod = participants.some((p) => p.haveMod);
  const tasks = TASKS.map((task) => {
    const attempts = participants.flatMap((p) => p.attempts.filter((a) => a.task === task.id).map((a) => ({ p: p.code, ...a })));
    const n = attempts.length;
    const unaided = attempts.filter((a) => a.unaided).length;
    // Time: unaided attempts when moderator files exist, else every attempt that reached the end.
    const timed = attempts.filter((a) => a.seconds !== null && (anyMod ? a.unaided : a.completedEvents));
    const steps = new Map();                      // step -> { people, hint, failedExit, triggers }
    let stuckPoints = 0;
    for (const a of attempts) {
      for (const s of a.stuck) {
        stuckPoints++;
        if (!steps.has(s.step)) steps.set(s.step, { step: s.step, people: new Set(), hint: false, failedExit: false, triggers: new Set() });
        const rec = steps.get(s.step);
        rec.people.add(a.p);
        s.triggers.forEach((t) => rec.triggers.add(t));
        if (a.hintSteps.includes(s.step)) rec.hint = true;
        if (a.failedExit && a.exitStep === s.step) rec.failedExit = true;
      }
    }
    const stuckSteps = [...steps.values()]
      .filter((r) => r.people.size >= 2 || r.hint || r.failedExit)
      .sort((a, b) => a.step - b.step)
      .map((r) => ({ step: r.step, people: r.people.size, hint: r.hint, failedExit: r.failedExit, triggers: [...r.triggers].sort() }));
    return {
      task: task.id, guide: task.guide, attempts: n, unaided,
      rate: n ? unaided / n : null,
      timeMedian: median(timed.map((a) => a.seconds)),
      timeN: timed.length,
      timeFromModerator: timed.some((a) => a.secondsFromModerator),
      stuckPoints, stuckSteps,
      skippedAttempts: attempts.filter((a) => a.skipped.length).length,
    };
  });
  const tested = tasks.filter((t) => t.attempts > 0);
  const stuckTotal = tasks.reduce((s, t) => s + t.stuckPoints, 0);
  const count = (key) => participants.reduce((m, p) => (m[p[key]] = (m[p[key]] || 0) + 1, m), {});
  return {
    participants: participants.map((p) => p.code),
    n: participants.length,
    groups: count('group'), experience: count('experience'), devices: count('device'),
    eventsOnly: !anyMod,
    otherGuidesOpened: participants.reduce((s, p) => s + p.otherGuidesOpened, 0),
    tasks, tested: tested.length,
    stuckPoints: stuckTotal,
    stuckPerParticipant: participants.length ? stuckTotal / participants.length : null,
    warnings: participants.flatMap((p) => p.warnings),
  };
}

// ---- comparing two rounds ---------------------------------------------------------------------

export function compareRounds(r1, r2) {
  const rows = TASKS.map((task, i) => {
    const a = r1.tasks[i], b = r2.tasks[i];
    return {
      task: task.id, guide: task.guide,
      rate1: a.rate, rate2: b.rate, tested2: b.attempts > 0,
      pass: b.attempts > 0 ? b.rate >= TARGET_RATE : null,
      stuck1: a.stuckPoints, stuck2: b.stuckPoints,
      stuckWorse: b.attempts > 0 && a.attempts > 0 && b.stuckPoints > a.stuckPoints,
    };
  });
  const tested = rows.filter((r) => r.tested2);
  const failing = tested.filter((r) => !r.pass).map((r) => r.task);
  const worse = tested.filter((r) => r.stuckWorse).map((r) => r.task);
  const fewer = r1.stuckPerParticipant !== null && r2.stuckPerParticipant !== null && r2.stuckPerParticipant < r1.stuckPerParticipant;
  const enough = r1.n >= 5 && r2.n >= 5;
  return {
    rows, failing, worse, fewerStuck: fewer, enoughParticipants: enough,
    passes: enough && tested.length > 0 && failing.length === 0 && worse.length === 0 && fewer,
  };
}

// ---- output -----------------------------------------------------------------------------------

const pct = (x) => (x === null ? '-' : `${Math.round(x * 100)}%`);
const fmtTime = (s) => (s === null ? '-' : `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`);
const per = (x) => (x === null ? '-' : x.toFixed(1));

export function renderRound(r, title) {
  const out = [];
  out.push(`### ${title}`, '');
  const kv = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
  out.push(`Participants: ${r.n} (${r.participants.join(', ') || 'none'}). Groups: ${kv(r.groups)}. Experience: ${kv(r.experience)}. Devices: ${kv(r.devices)}.`);
  if (r.eventsOnly) out.push('', '*No moderator files: completion is counted from events only and nothing is counted as unaided.*');
  out.push('', '| Task | Guide | Attempts | Unaided | Completion | Median time on task | Stuck points | Stuck steps |', '|---|---|---|---|---|---|---|---|');
  for (const t of r.tasks) {
    if (!t.attempts) { out.push(`| ${t.task} | \`${t.guide}\` | 0 | - | not tested | - | - | - |`); continue; }
    const time = t.timeN ? `${fmtTime(t.timeMedian)}${t.timeFromModerator ? '*' : ''} (n=${t.timeN})` : '-';
    const steps = t.stuckSteps.length
      ? t.stuckSteps.map((s) => `${s.step} (${s.people} ${s.people === 1 ? 'person' : 'people'}${s.hint ? ', hint' : ''}${s.failedExit ? ', failed exit' : ''})`).join('; ')
      : 'none';
    out.push(`| ${t.task} | \`${t.guide}\` | ${t.attempts} | ${t.unaided} | ${t.unaided}/${t.attempts} (${pct(t.rate)})${t.rate >= TARGET_RATE ? '' : ' below 80%'} | ${time} | ${t.stuckPoints} | ${steps} |`);
  }
  out.push('', `Stuck points: ${r.stuckPoints} in total, ${per(r.stuckPerParticipant)} per participant. Other guides opened while looking: ${r.otherGuidesOpened}.`);
  if (r.tasks.some((t) => t.timeFromModerator)) out.push('', '\\* includes a stopwatch time from the moderator because the participant never used the step player.');
  if (r.tasks.some((t) => t.skippedAttempts)) out.push('', 'Some attempts reached the last step by a jump; see the warnings.');
  if (r.warnings.length) out.push('', 'Warnings:', ...r.warnings.map((w) => `- ${w}`));
  return out.join('\n');
}

export function renderCompare(c, r1, r2) {
  const out = ['### Round 2 against round 1', '',
    '| Task | Guide | Round 1 completion | Round 2 completion | 80% target | Stuck points r1 | Stuck points r2 |', '|---|---|---|---|---|---|---|'];
  for (const r of c.rows) {
    out.push(`| ${r.task} | \`${r.guide}\` | ${pct(r.rate1)} | ${pct(r.rate2)} | ${r.pass === null ? 'not tested' : r.pass ? 'met' : 'MISSED'} | ${r.stuck1} | ${r.stuck2}${r.stuckWorse ? ' (more)' : ''} |`);
  }
  out.push('', `Stuck points per participant: ${per(r1.stuckPerParticipant)} in round 1, ${per(r2.stuckPerParticipant)} in round 2 (${c.fewerStuck ? 'fewer' : 'NOT fewer'}).`);
  out.push(`Participants: ${r1.n} in round 1, ${r2.n} in round 2 (${c.enoughParticipants ? 'at least five each' : 'FEWER THAN FIVE IN A ROUND'}).`);
  if (c.failing.length) out.push(`Tasks below 80% in round 2: ${c.failing.join(', ')}.`);
  if (c.worse.length) out.push(`Tasks with more stuck points in round 2: ${c.worse.join(', ')}.`);
  out.push('', `**Verdict: ${c.passes ? 'targets met' : 'shortfall, record it and the next fix'}.**`);
  return out.join('\n');
}

// ---- reading a round directory ---------------------------------------------------------------

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { throw new InputError(`${path}: not readable JSON (${e.name})`); }   // never echo the content
}

export function loadRound(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new InputError(`${dir}: not a directory`);
  const names = readdirSync(dir);
  const codes = [...new Set(names.map((n) => (n.match(/^(.+)\.(events|moderator)\.json$/) || [])[1]).filter(Boolean))].sort();
  if (!codes.length) throw new InputError(`${dir}: no <code>.events.json or <code>.moderator.json files`);
  return codes.map((code) => {
    const ev = join(dir, `${code}.events.json`), mo = join(dir, `${code}.moderator.json`);
    return buildParticipant(code, existsSync(ev) ? readJson(ev) : undefined, existsSync(mo) ? readJson(mo) : undefined);
  });
}

// ---- self-test --------------------------------------------------------------------------------

function selftest() {
  const T0 = Date.parse('2026-01-01T09:00:00.000Z');
  const ev = (sec, name, props, sid = 'a') => ({ t: new Date(T0 + sec * 1000).toISOString(), name, sid, device: 'desktop', w: 1440, props });
  const path = (key, total, steps) => {                       // steps: [[sec, step], ...] after opening at 0
    const e = [ev(0, 'guide_opened', { key, steps: total })];
    for (const [sec, step] of steps) {
      e.push(ev(sec, 'step_advanced', { key, step, total }));
      if (step === total) e.push(ev(sec, 'guide_completed', { key, steps: total }));
    }
    return e;
  };
  let failures = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) { failures++; console.error(`FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
  };
  const mod = (code, tasks) => ({ participant: code, round: 1, group: 'superintendent', experience: 'new', device: 'desktop', tasks });

  // R9P01: clean, unaided T2 in 140 s.
  const p1 = buildParticipant('R9P01',
    path('target-profiles', 7, [[20, 2], [40, 3], [60, 4], [80, 5], [100, 6], [140, 7]]),
    mod('R9P01', [{ task: 'T2', guide: 'target-profiles', outcome: 'unaided', usedPlayer: true, notes: [] }]));
  // R9P02: dwell 110 s on step 3, a back-step to 4, a hint at 6; aided.
  const p2 = buildParticipant('R9P02',
    path('target-profiles', 7, [[10, 2], [20, 3], [130, 4], [140, 5], [150, 4], [160, 5], [170, 6], [180, 7]]),
    mod('R9P02', [{ task: 'T2', guide: 'target-profiles', outcome: 'aided', usedPlayer: true, notes: [{ step: 6, kind: 'hint', text: 'x' }] }]));
  // R9P03: gives up on step 4; failed.
  const p3 = buildParticipant('R9P03',
    path('target-profiles', 7, [[15, 2], [30, 3], [45, 4]]),
    mod('R9P03', [{ task: 'T2', guide: 'target-profiles', outcome: 'failed', usedPlayer: true, notes: [] }]));
  // R9P04: jumps from step 1 to the last of T1; the moderator says unaided. No step is skipped for T3.
  const p4 = buildParticipant('R9P04',
    [...path('minimum-threshold', 8, [[30, 8]]), ...path('station-zero', 5, [[10, 2], [20, 3], [30, 4], [40, 5]]).map((e) => ({ ...e, t: new Date(Date.parse(e.t) + 600000).toISOString() }))],
    mod('R9P04', [
      { task: 'T1', guide: 'minimum-threshold', outcome: 'unaided', usedPlayer: true, notes: [] },
      { task: 'T3', guide: 'station-zero', outcome: 'unaided', usedPlayer: true, notes: [{ step: 2, kind: 'off-task', text: 'x' }] },
    ]));
  // R9P05: read the article, never moved the player; stopwatch 200 s; unaided.
  const p5 = buildParticipant('R9P05',
    [ev(0, 'guide_opened', { key: 'request-scan-data', steps: 5 })],
    mod('R9P05', [{ task: 'T6', guide: 'request-scan-data', outcome: 'unaided', usedPlayer: false, seconds: 200, notes: [] }]));

  const a2 = p2.attempts[0];
  check('p1 unaided', p1.attempts[0].unaided, true);
  check('p1 time', p1.attempts[0].seconds, 140);
  check('p1 no stuck', p1.attempts[0].stuck, []);
  check('p2 stuck steps', a2.stuck.map((s) => [s.step, ...s.triggers]), [[3, 'dwell'], [4, 'back-step'], [6, 'hint']]);
  check('p2 not unaided', a2.unaided, false);
  check('p3 exit at 4', [p3.attempts[0].exitStep, p3.attempts[0].failedExit], [4, true]);
  check('p3 stuck', p3.attempts[0].stuck.map((s) => [s.step, ...s.triggers]), [[4, 'exit']]);
  check('p4 jump flagged', p4.attempts.find((a) => a.task === 'T1').skipped, [2, 3, 4, 5, 6, 7]);
  check('p4 off-task suppresses nothing without a long dwell', p4.attempts.find((a) => a.task === 'T3').stuck, []);
  check('p5 stopwatch', [p5.attempts[0].unaided, p5.attempts[0].seconds, p5.attempts[0].secondsFromModerator], [true, 200, true]);

  const round = summariseRound([p1, p2, p3, p4, p5]);
  const t2 = round.tasks.find((t) => t.task === 'T2');
  check('T2 rate', [t2.attempts, t2.unaided], [3, 1]);
  check('T2 median time (unaided only)', t2.timeMedian, 140);
  check('T2 stuck points', t2.stuckPoints, 4);
  check('T2 stuck steps', t2.stuckSteps.map((s) => [s.step, s.people, s.hint, s.failedExit]), [[4, 2, false, true], [6, 1, true, false]]);
  check('T6 stopwatch median', round.tasks.find((t) => t.task === 'T6').timeMedian, 200);
  check('untested task', round.tasks.find((t) => t.task === 'T5').attempts, 0);

  // Round 2 comparison: both rounds reuse the participants above as stand-ins.
  const good = ['R9P11', 'R9P12', 'R9P13', 'R9P14', 'R9P15'].map((c) =>
    buildParticipant(c, path('target-profiles', 7, [[10, 2], [20, 3], [30, 4], [40, 5], [50, 6], [60, 7]]),
      mod(c, [{ task: 'T2', guide: 'target-profiles', outcome: 'unaided', usedPlayer: true, notes: [] }])));
  const r2 = summariseRound(good);
  const cmp = compareRounds({ ...round, n: 5 }, r2);
  check('compare passes', cmp.passes, true);
  check('compare shortfall', compareRounds({ ...round, n: 5 }, summariseRound(good.slice(0, 3).concat([p3, p3]).map((p, i) => ({ ...p, code: p.code + i })))).passes, false);

  // Names must not get in.
  let refused = false;
  try { buildParticipant('Jane', [], undefined); } catch (e) { refused = e instanceof InputError; }
  check('name refused', refused, true);
  let mismatch = false;
  try { buildParticipant('R9P21', [], { participant: 'R9P22', tasks: [] }); } catch (e) { mismatch = e instanceof InputError; }
  check('mismatched moderator file refused', mismatch, true);

  // Deep link: no guide_opened, the first step_advanced starts the clock.
  const dl = analyseAttempt(TASKS[2], [ev(5, 'step_advanced', { key: 'station-zero', step: 2, total: 5 })], undefined, false);
  check('deep link flagged', dl.deepLink, true);
  // Events with no moderator file are never unaided.
  const none = buildParticipant('R9P31', path('station-zero', 5, [[10, 2], [20, 3], [30, 4], [40, 5]]), undefined);
  check('events-only is not unaided', [none.attempts[0].unaided, none.attempts[0].completedEvents], [false, true]);

  if (failures) { console.error(`${failures} self-test check(s) failed`); return 1; }
  console.log('session-readout self-test passed');
  return 0;
}

// ---- main -------------------------------------------------------------------------------------

function main(argv) {
  const args = argv.slice(2);
  const json = args.includes('--json');
  if (args.includes('--selftest')) return selftest();
  try {
    if (args.includes('--compare')) {
      const dirs = args.filter((a) => !a.startsWith('--'));
      if (dirs.length !== 2) throw new InputError('--compare needs two round directories: round 1 then round 2');
      const r1 = summariseRound(loadRound(dirs[0])), r2 = summariseRound(loadRound(dirs[1]));
      const c = compareRounds(r1, r2);
      if (json) console.log(JSON.stringify({ round1: r1, round2: r2, comparison: c }, null, 2));
      else console.log([renderRound(r1, 'Round 1'), renderRound(r2, 'Round 2'), renderCompare(c, r1, r2)].join('\n\n'));
      return c.passes ? 0 : 1;
    }
    const dirs = args.filter((a) => !a.startsWith('--'));
    if (dirs.length !== 1) throw new InputError('usage: node scripts/session-readout.mjs <round directory> [--json] | --compare <round1> <round2> | --selftest');
    const r = summariseRound(loadRound(dirs[0]));
    console.log(json ? JSON.stringify(r, null, 2) : renderRound(r, dirs[0]));
    return 0;
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    console.error(e.message);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv));
