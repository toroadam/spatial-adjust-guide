#!/usr/bin/env node
// Holds every Double Click episode to the series rules (video/episodes/RUNBOOK.md, "Formats").
//
//   node scripts/episode-lint.mjs <url> [key ...] [--series] [--write-tracker] [--fixtures]
//                                 [--series-file <file>] [--media-root <dir>]
//   npm run test:episodes [-- key ... | --series | --write-tracker | --fixtures]
//
// <url> is the built site (npm run build && npm run serve, http://localhost:8124/), where the
// sign-in gate and the splash are bypassed. Chapter labels and highlights are checked against the
// guide as it RENDERS at #/<key>, because the step text is the export after src/transform-export.mjs.
//
// Always: video/episodes/series.json is checked for shape (unique keys, wave order, statuses,
// blocked entries with a reason and a date, first-of-wave flags). Every episode whose series status
// is neither planned nor blocked (or each named key) then has video/episodes/<id>/episode.json
// checked:
//   schema  it passes video/lib/episode-schema.mjs (the pipeline's own contract);
//   (a)     guide and id match series.json and the folder;
//   (b)     chapters, in order, are labelled exactly with the rendered step titles, one per step;
//   (c)     title is the rendered guide title and titleCard.text is "Double Click: <title>";
//   (d)     endCard.next is the next series episode that is not blocked, endCard.text is
//           "Next on Double Click: <its title>" (or the RUNBOOK's series-end line when there is
//           none) and endCard.address is "#/<key>";
//   (e)     every vo line and on-screen text cites claim IDs that are Verified in
//           docs/claims/claims.json; template chrome listed in RUNBOOK.md needs none. A
//           "coming-soon" treatment may also cite "Not shipping" claims, only with an approvalsRef
//           that appears in video/approvals.md;
//   (f)     every chapter's highlight.label is a bold label of its step, and its selector is set;
//   (g)     every chapter's source is demo, recreation or mixed (the last two with a sourceReason);
//           every demoWriteClicks entry has route "/demo", a safetyRef in the Demo Mode writes table
//           of video/episodes/README.md and an outcome; a short-circuited write must be filmed with
//           outcome "recreation" in a mixed or recreation chapter;
//   (h)     edited and approved episodes: runtime in range, -14 LUFS +/- 0.5, true peak at or
//           below -1.0 dBTP, music is series.json musicBed.
//
// --series        across approved episodes: loudness spread at most 1.0 LU, runtimes in range, and
//                 each VO render report (<media root>/<media>/vo/render-report.json) used the
//                 series voice id, model and settings. Prints a summary table.
// --write-tracker regenerates only the text between <!-- tracker:start --> and <!-- tracker:end -->
//                 in video/episodes/README.md from series.json.
// --fixtures      self-test on scripts/fixtures/episode-lint/: the good fixture must pass, and the
//                 bad-label and unverified-claim fixtures must each fail with exactly one finding,
//                 and the series-mode fixture with exactly two. Needs no browser and no server.
//
// One finding per line, for example:
//   dashboard-overview chapter 3: label 'X' != step title 'Y'
// Exit 0 clean, 1 findings (or a fixture that did not behave), 2 could not run.
//
// Deliberately not wired into .github/workflows/deploy.yml: it needs a served build and checks
// episodes, not the site.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkEpisode, EpisodeError } from '../video/lib/episode-schema.mjs';
import { openReader, readGuide, GuideNotFound } from './lib/rendered-guide.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');
export const PATHS = {
  series: path.join(REPO_ROOT, 'video', 'episodes', 'series.json'),
  readme: path.join(REPO_ROOT, 'video', 'episodes', 'README.md'),
  runbook: path.join(REPO_ROOT, 'video', 'episodes', 'RUNBOOK.md'),
  episodes: path.join(REPO_ROOT, 'video', 'episodes'),
  claims: path.join(REPO_ROOT, 'docs', 'claims', 'claims.json'),
  approvals: path.join(REPO_ROOT, 'video', 'approvals.md'),
  safety: path.join(REPO_ROOT, 'video', 'capture', 'SAFETY.md'),
  fixtures: path.join(REPO_ROOT, 'scripts', 'fixtures', 'episode-lint'),
};

export const SERIES_STATUSES = ['planned', 'scripted', 'captured', 'voiced', 'edited', 'approved', 'blocked'];
export const NOT_CHECKED = new Set(['planned', 'blocked']);
export const CHAPTER_SOURCES = ['demo', 'recreation', 'mixed'];
export const OUTCOMES = ['demo', 'recreation'];
export const TREATMENTS = ['standard', 'coming-soon'];
export const DEMO_ROUTE = '/demo';
export const TITLE_PREFIX = 'Double Click: ';
export const NEXT_PREFIX = 'Next on Double Click: ';
export const DEFAULT_CHROME = ['Double Click', 'Next on Double Click'];
export const DEFAULT_TARGETS = { runtimeSec: [60, 180], lufs: -14, lufsTolerance: 0.5, truePeakMax: -1.0, lufsSpreadMax: 1.0 };
export const TRACKER_START = '<!-- tracker:start -->';
export const TRACKER_END = '<!-- tracker:end -->';

const q = (s) => `'${s ?? ''}'`;
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

// ---------------------------------------------------------------------------------------------
// Inputs

export function expandHome(p) {
  if (!p) return p;
  return p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

// The Demo Mode writes table in video/episodes/README.md (Readiness): safetyRef -> { mode, cite }.
// mode is 'short-circuited', 'mocked', 'no write' or 'unknown'; cite is 'video/capture/SAFETY.md:N'.
export function parseWritesTable(md) {
  const out = new Map();
  const lines = String(md ?? '').split('\n');
  const start = lines.findIndex((l) => /^#{2,4}\s+Demo Mode writes\s*$/.test(l));
  if (start < 0) return out;
  for (let i = start + 1; i < lines.length && !/^#{1,4}\s/.test(lines[i]); i++) {
    const line = lines[i];
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const key = cells[0].replace(/`/g, '');
    const modeText = (cells[3] ?? '').toLowerCase();
    const mode = modeText.startsWith('short-circuited') ? 'short-circuited'
      : modeText.startsWith('mocked') ? 'mocked'
        : modeText.startsWith('no write') ? 'no write' : 'unknown';
    out.set(key, { mode, cite: (cells[4] ?? '').replace(/`/g, ''), write: cells[1] ?? '' });
  }
  return out;
}

// RUNBOOK.md carries the series-end line and the template chrome that needs no claim.
export function parseRunbook(md) {
  const text = String(md ?? '');
  const end = text.match(/\*\*Series-end line:\*\*\s*"([^"]*)"/);
  const seriesEnd = end && end[1].trim() && !/^TBD\b/i.test(end[1].trim()) ? end[1].trim() : null;
  const chromeLine = text.match(/\*\*Template chrome[^*]*:\*\*\s*(.+)$/m);
  const chrome = chromeLine ? [...chromeLine[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  return { seriesEnd, chrome: chrome.length ? chrome : DEFAULT_CHROME };
}

const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

export function loadContext({
  seriesFile = PATHS.series, claimsFile = PATHS.claims, readmeFile = PATHS.readme, runbookFile = PATHS.runbook,
  approvalsFile = PATHS.approvals, safetyFile = PATHS.safety, episodesDir = PATHS.episodes, mediaRoot,
  guides = null,
} = {}) {
  const series = JSON.parse(readFileSync(seriesFile, 'utf8'));
  const ledger = JSON.parse(readFileSync(claimsFile, 'utf8'));
  const claims = new Map((ledger.claims ?? []).map((c) => [c.id, c]));
  const safetyText = readText(safetyFile);
  return {
    series, seriesFile, claims, claimsFile, episodesDir,
    targets: { ...DEFAULT_TARGETS, ...(series.targets ?? {}) },
    writes: parseWritesTable(readText(readmeFile)),
    runbook: parseRunbook(readText(runbookFile)),
    approvalsText: readText(approvalsFile),
    safetyLineCount: safetyText ? safetyText.split('\n').length : 0,
    safetyFile,
    mediaRoot: path.resolve(path.dirname(seriesFile), expandHome(mediaRoot ?? process.env.SA_MEDIA_ROOT ?? series.mediaRoot ?? '~/Documents/SpatialAdjust_MarCom')),
    guides,
  };
}

// ---------------------------------------------------------------------------------------------
// series.json shape

export function checkSeries(series) {
  const f = [];
  const add = (m) => f.push(`series.json: ${m}`);
  const eps = Array.isArray(series?.episodes) ? series.episodes : [];
  const waves = new Map((series?.waves ?? []).map((w) => [w.n, w]));
  if (!eps.length) add('no episodes');
  if (!nonEmpty(series?.voice?.id) || !nonEmpty(series?.voice?.model) || typeof series?.voice?.settings !== 'object') {
    add('voice needs id, model and settings');
  }
  const keys = new Set();
  let lastWave = 0;
  eps.forEach((e, i) => {
    const who = `episode ${e?.n ?? i + 1} ${e?.key ?? '(no key)'}`;
    if (!nonEmpty(e?.key) || !/^[a-z0-9-]+$/.test(e.key)) add(`${who}: key must be a guide slug`);
    if (keys.has(e?.key)) add(`${who}: duplicate key`);
    keys.add(e?.key);
    if (e?.n !== i + 1) add(`${who}: n is ${e?.n}, expected ${i + 1} (episodes are listed in series order)`);
    if (!waves.has(e?.wave)) add(`${who}: wave ${e?.wave} is not in waves`);
    if (e?.wave < lastWave) add(`${who}: wave ${e.wave} comes after wave ${lastWave}`);
    const first = e?.wave !== lastWave;
    if (Boolean(e?.firstOfWave) !== first) add(`${who}: firstOfWave should be ${first}`);
    lastWave = e?.wave ?? lastWave;
    if (!nonEmpty(e?.title)) add(`${who}: no title`);
    if (!SERIES_STATUSES.includes(e?.status)) add(`${who}: status ${q(e?.status)} is not one of ${SERIES_STATUSES.join(', ')}`);
    if (e?.status === 'blocked') {
      if (!nonEmpty(e.blockedReason)) add(`${who}: blocked without a blockedReason`);
      if (!isDate(e.checkedAt)) add(`${who}: blocked without a checkedAt date`);
    }
    if (!nonEmpty(e?.media)) add(`${who}: no media folder`);
    if (e?.treatment !== undefined && !TREATMENTS.includes(e.treatment)) add(`${who}: treatment ${q(e.treatment)} is not one of ${TREATMENTS.join(', ')}`);
    if (e?.status === 'approved' && !isDate(e.approvedAt)) add(`${who}: approved without approvedAt`);
  });
  return f;
}

// The next episode in series order that is not blocked, or null.
export function nextEntry(series, entry) {
  const eps = series.episodes ?? [];
  const i = eps.findIndex((e) => e.key === entry.key);
  return eps.slice(i + 1).find((e) => e.status !== 'blocked') ?? null;
}

// ---------------------------------------------------------------------------------------------
// One episode

function claimFindings(where, ids, ctx, ep) {
  const f = [];
  if (!Array.isArray(ids) || !ids.length) return [`${where}: no claim IDs`];
  const comingSoonOk = ep.treatment === 'coming-soon' && nonEmpty(ep.approvalsRef) && ctx.approvalsText.includes(ep.approvalsRef);
  for (const id of ids) {
    const c = ctx.claims.get(id);
    if (!c) f.push(`${where}: claim ${id} is not in the claims ledger`);
    else if (c.status === 'Verified') continue;
    else if (c.status === 'Not shipping' && comingSoonOk) continue;
    else f.push(`${where}: claim ${id} is ${c.status}, not Verified`);
  }
  return f;
}

// Chapters that hold a click on (name, target), through the beats that perform it.
function chaptersOfClick(ep, d) {
  const out = new Set();
  if (nonEmpty(d.chapter)) out.add(d.chapter);
  for (const b of ep.beats ?? []) {
    for (const a of b.actions ?? []) {
      if (a.type === 'click' && a.name === d.name && a.target === d.target && b.chapter) out.add(b.chapter);
    }
  }
  return [...out];
}

// guide: readGuide() output for entry.key; nextTitle: the rendered title of the next episode's
// guide (or null when not read); folder: the folder episode.json was read from (or null).
export function lintEpisode(ep, { ctx, entry, guide, nextTitle = null, folder = null }) {
  const key = entry.key;
  const f = [];
  const add = (m) => f.push(`${key}${m.startsWith(' ') ? '' : ': '}${m}`);

  // schema: the pipeline's own contract, with claim IDs checked against the same ledger.
  try {
    checkEpisode(ep, { ledger: ctx.claimsFile, label: `${key} episode.json` });
  } catch (err) {
    if (!(err instanceof EpisodeError)) throw err;
    for (const issue of err.issues.length ? err.issues : [err.message]) add(`schema: ${issue}`);
  }

  // (a) identity
  const id = entry.id ?? entry.key;
  if (ep.guide !== key) add(`guide ${q(ep.guide)} != series key ${q(key)}`);
  if (ep.id !== id) add(`id ${q(ep.id)} != series id ${q(id)}`);
  if (folder && folder !== ep.id) add(`folder ${q(folder)} != id ${q(ep.id)}`);

  // (b) chapters = rendered steps
  const chapters = Array.isArray(ep.chapters) ? ep.chapters : [];
  const steps = guide.steps;
  if (chapters.length !== steps.length) add(`${chapters.length} chapters != ${steps.length} rendered steps`);
  chapters.forEach((c, i) => {
    const s = steps[i];
    if (!s) return;
    if (c.label !== s.title) add(` chapter ${i + 1}: label ${q(c.label)} != step title ${q(s.title)}`);
    if (c.step !== undefined && c.step !== s.n) add(` chapter ${i + 1}: step ${c.step} != rendered step ${s.n}`);
  });

  // (c) title card
  if (ep.title !== guide.title) add(`title ${q(ep.title)} != rendered title ${q(guide.title)}`);
  const wantTitle = TITLE_PREFIX + guide.title;
  if (ep.titleCard?.text !== wantTitle) add(`titleCard.text ${q(ep.titleCard?.text)} != ${q(wantTitle)}`);
  if (entry.title !== guide.title) add(`series.json title ${q(entry.title)} != rendered title ${q(guide.title)}`);

  // (d) end card
  const next = nextEntry(ctx.series, entry);
  const end = ep.endCard ?? {};
  if (next) {
    if (end.next !== next.key) add(`endCard.next ${q(end.next)} != next episode ${q(next.key)}`);
    const want = NEXT_PREFIX + next.title;
    if (end.text !== want) add(`endCard.text ${q(end.text)} != ${q(want)}`);
    if (nextTitle !== null && nextTitle !== next.title) add(`series.json title of ${next.key} ${q(next.title)} != rendered title ${q(nextTitle)}`);
  } else {
    if (end.next != null) add(`endCard.next ${q(end.next)}, but no later episode is unblocked`);
    if (!ctx.runbook.seriesEnd) add('the series-end line is not set in RUNBOOK.md, and this episode has no next episode');
    else if (end.text !== ctx.runbook.seriesEnd) add(`endCard.text ${q(end.text)} != series-end line ${q(ctx.runbook.seriesEnd)}`);
  }
  if (end.address !== `#/${key}`) add(`endCard.address ${q(end.address)} != ${q(`#/${key}`)}`);

  // (e) claims behind every spoken line and on-screen text
  if (ep.treatment === 'coming-soon' && !(nonEmpty(ep.approvalsRef) && ctx.approvalsText.includes(ep.approvalsRef))) {
    add(`treatment coming-soon needs an approvalsRef recorded in video/approvals.md (got ${q(ep.approvalsRef)})`);
  }
  for (const line of ep.vo ?? []) f.push(...claimFindings(`${key} vo ${line.id}`, line.claims, ctx, ep));
  chapters.forEach((c, i) => {
    (c.onScreen ?? []).forEach((item, j) => {
      if (ctx.runbook.chrome.includes(String(item?.text ?? '').trim())) return;
      f.push(...claimFindings(`${key} chapter ${i + 1} onScreen ${j + 1}`, item?.claims, ctx, ep));
    });
  });
  if (Array.isArray(ep.titleCard?.claims) && ep.titleCard.claims.length) {
    f.push(...claimFindings(`${key} titleCard`, ep.titleCard.claims, ctx, ep));
  }

  // (f) highlights. A step the rewrite has not reached and that names no bold label (boldLabels
  // empty) cannot offer one, so there the label must be words the step's title, body or caption
  // uses, as written (template v1, RUNBOOK.md changelog).
  chapters.forEach((c, i) => {
    const s = steps[i];
    const h = c.highlight ?? {};
    if (!nonEmpty(h.label)) add(` chapter ${i + 1}: no highlight.label`);
    else if (s && !s.boldLabels.length && !s.shape) {
      const said = [s.title, s.body, s.caption].map((x) => String(x ?? '').toLowerCase()).join('\n');
      if (!said.includes(h.label.trim().toLowerCase())) add(` chapter ${i + 1}: highlight.label ${q(h.label)} is not in the text of step ${s.n}, which has no bold labels yet`);
    } else if (s && !s.boldLabels.includes(h.label)) {
      add(` chapter ${i + 1}: highlight.label ${q(h.label)} is not a bold label of step ${s.n} (${s.boldLabels.map(q).join(', ') || 'none'})`);
    }
    if (!nonEmpty(h.selector)) add(` chapter ${i + 1}: no highlight.selector`);
  });

  // (g) sources and Demo Mode writes
  const byId = new Map(chapters.map((c, i) => [c.id, { c, i }]));
  chapters.forEach((c, i) => {
    if (!CHAPTER_SOURCES.includes(c.source)) add(` chapter ${i + 1}: source ${q(c.source)} is not one of ${CHAPTER_SOURCES.join(', ')}`);
    else if (c.source !== 'demo' && !nonEmpty(c.sourceReason)) add(` chapter ${i + 1}: source ${c.source} needs a sourceReason`);
  });
  (ep.demoWriteClicks ?? []).forEach((d, j) => {
    const who = ` demoWriteClicks ${j + 1} (${q(d.name)})`;
    if (d.route !== DEMO_ROUTE) add(`${who}: route ${q(d.route)} != ${q(DEMO_ROUTE)}`);
    if (!OUTCOMES.includes(d.outcome)) add(`${who}: outcome ${q(d.outcome)} is not one of ${OUTCOMES.join(', ')}`);
    const row = ctx.writes.get(d.safetyRef);
    if (!nonEmpty(d.safetyRef)) { add(`${who}: no safetyRef`); return; }
    if (!row) { add(`${who}: safetyRef ${q(d.safetyRef)} is not in the Demo Mode writes table (video/episodes/README.md)`); return; }
    const line = Number(String(row.cite).split(':')[1]);
    if (!(line > 0 && line <= ctx.safetyLineCount)) add(`${who}: the writes table cites ${q(row.cite)}, which is not a line of video/capture/SAFETY.md`);
    const chs = chaptersOfClick(ep, d);
    if (!chs.length) add(`${who}: no chapter holds this click`);
    if (row.mode === 'short-circuited') {
      if (d.outcome !== 'recreation') add(`${who}: ${d.safetyRef} is short-circuited in Demo Mode, so outcome must be 'recreation'`);
      for (const ch of chs) {
        const hit = byId.get(ch);
        if (hit && !['mixed', 'recreation'].includes(hit.c.source)) {
          add(` chapter ${hit.i + 1}: films ${d.safetyRef}, which Demo Mode short-circuits, so source must be mixed or recreation`);
        }
      }
    }
  });

  // (h) finished episodes: runtime, loudness, music
  if (['edited', 'approved'].includes(entry.status)) {
    const [lo, hi] = entry.runtimeRange ?? ctx.targets.runtimeSec;
    if (typeof entry.runtimeSec !== 'number' || entry.runtimeSec < lo || entry.runtimeSec > hi) add(`runtimeSec ${entry.runtimeSec} is outside ${lo}-${hi}`);
    if (typeof entry.lufs !== 'number' || Math.abs(entry.lufs - ctx.targets.lufs) > ctx.targets.lufsTolerance + 1e-9) {
      add(`lufs ${entry.lufs} is outside ${ctx.targets.lufs} +/- ${ctx.targets.lufsTolerance}`);
    }
    if (typeof entry.truePeak !== 'number' || entry.truePeak > ctx.targets.truePeakMax) add(`truePeak ${entry.truePeak} is above ${ctx.targets.truePeakMax} dBTP`);
    if (ep.music !== ctx.series.musicBed) add(`music ${q(ep.music)} != series musicBed ${q(ctx.series.musicBed)}`);
  }
  return f;
}

// ---------------------------------------------------------------------------------------------
// --series

export function seriesMode(ctx) {
  const f = [];
  const rows = [];
  const approved = (ctx.series.episodes ?? []).filter((e) => e.status === 'approved');
  const voice = ctx.series.voice ?? {};
  for (const e of approved) {
    const [lo, hi] = e.runtimeRange ?? ctx.targets.runtimeSec;
    if (typeof e.runtimeSec !== 'number' || e.runtimeSec < lo || e.runtimeSec > hi) f.push(`${e.key}: runtimeSec ${e.runtimeSec} is outside ${lo}-${hi}`);
    const report = path.join(ctx.mediaRoot, e.media ?? `episodes/${e.id ?? e.key}`, 'vo', 'render-report.json');
    let voiceOk = 'missing';
    if (!existsSync(report)) f.push(`${e.key}: no VO render report at <media root>/${e.media}/vo/render-report.json`);
    else {
      const r = JSON.parse(readFileSync(report, 'utf8'));
      const diffs = [];
      if (r.voice !== voice.id) diffs.push(`voice id ${q(r.voice)} != ${q(voice.id)}`);
      if (r.model !== voice.model) diffs.push(`model ${q(r.model)} != ${q(voice.model)}`);
      for (const [k, v] of Object.entries(voice.settings ?? {})) {
        if (r.settings?.[k] !== v) diffs.push(`settings.${k} ${r.settings?.[k]} != ${v}`);
      }
      voiceOk = diffs.length ? 'differs' : 'ok';
      for (const d of diffs) f.push(`${e.key}: VO render report ${d}`);
    }
    rows.push({ n: e.n, key: e.key, runtime: e.runtimeSec, lufs: e.lufs, truePeak: e.truePeak, voice: voiceOk });
  }
  const lufs = approved.map((e) => e.lufs).filter((x) => typeof x === 'number');
  const spread = lufs.length ? Math.max(...lufs) - Math.min(...lufs) : 0;
  if (spread > ctx.targets.lufsSpreadMax + 1e-9) {
    f.push(`series: loudness spread ${spread.toFixed(2)} LU across approved episodes is above ${ctx.targets.lufsSpreadMax} LU`);
  }
  const table = ['| # | Key | Runtime (s) | LUFS | True peak | Voice |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.n} | ${r.key} | ${r.runtime ?? '—'} | ${r.lufs ?? '—'} | ${r.truePeak ?? '—'} | ${r.voice} |`),
    '', `${approved.length} approved episode(s); loudness spread ${spread.toFixed(2)} LU (max ${ctx.targets.lufsSpreadMax}).`];
  return { findings: f, table: table.join('\n') };
}

// ---------------------------------------------------------------------------------------------
// --write-tracker

const DASH = '—';
const fmtNum = (x) => (x == null ? DASH : Number(x).toLocaleString('en-US'));
const fmtTime = (t) => (t == null ? DASH : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`);

export function renderTracker(series) {
  const eps = series.episodes ?? [];
  const out = ['<!-- Generated from series.json by node scripts/episode-lint.mjs <url> --write-tracker. Edit series.json, not this block. -->', ''];
  const counts = {};
  for (const e of eps) counts[e.status] = (counts[e.status] ?? 0) + 1;
  out.push(`${eps.length} episodes: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`, '');
  out.push('| # | Wave | Key | Title | Status | Runtime | Started | Approved | Expert |', '|---|---|---|---|---|---|---|---|---|');
  for (const e of eps) {
    out.push(`| ${e.n} | ${e.wave} | \`${e.key}\` | ${e.title} | ${e.status} | ${fmtTime(e.runtimeSec)} | ${e.startedAt ?? DASH} | ${e.approvedAt ?? DASH} | ${e.expertReview ?? DASH} |`);
  }
  const blocked = eps.filter((e) => e.status === 'blocked');
  if (blocked.length) {
    out.push('', 'Blocked:', '');
    const groups = new Map();
    for (const e of blocked) {
      const k = `${e.checkedAt ?? ''}\u0000${e.blockedReason ?? ''}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    for (const [k, group] of groups) {
      const [checked, reason] = k.split('\u0000');
      out.push(`- ${group.map((e) => `#${e.n} \`${e.key}\``).join(', ')} (checked ${checked || DASH}): ${reason || DASH}`);
    }
  }
  out.push('', '**Credits per wave** (ElevenLabs credits; estimate from series.json, method under Voice-over credits above; before and after from the account, counts only)', '');
  out.push('| Wave | Name | Episodes | Estimate | Before | After | Used | Expert review |', '|---|---|---|---|---|---|---|---|');
  for (const w of series.waves ?? []) {
    const n = eps.filter((e) => e.wave === w.n).length;
    const used = w.creditsBefore != null && w.creditsAfter != null ? fmtNum(w.creditsBefore - w.creditsAfter) : DASH;
    const est = Array.isArray(w.creditsEstimate) ? `${fmtNum(w.creditsEstimate[0])} to ${fmtNum(w.creditsEstimate[1])}` : DASH;
    out.push(`| ${w.n} | ${w.name} | ${n} | ${est} | ${fmtNum(w.creditsBefore)} | ${fmtNum(w.creditsAfter)} | ${used} | ${w.expertSignoff ?? DASH} |`);
  }
  return `${out.join('\n')}\n`;
}

// Replaces only the text between the markers; everything else in the file is kept byte for byte.
export function replaceTracker(md, block) {
  const a = md.indexOf(TRACKER_START);
  const b = md.indexOf(TRACKER_END);
  if (a < 0 || b < 0 || b < a) throw new Error(`video/episodes/README.md has no ${TRACKER_START} ... ${TRACKER_END} block`);
  if (md.indexOf(TRACKER_START, a + 1) >= 0 || md.indexOf(TRACKER_END, b + 1) >= 0) throw new Error('more than one tracker block');
  return `${md.slice(0, a + TRACKER_START.length)}\n${block}${md.slice(b)}`;
}

// ---------------------------------------------------------------------------------------------
// --fixtures

export const FIXTURE_CASES = [
  { name: 'good', expect: 0 },
  { name: 'bad-label', expect: 1, match: /label .* != step title/ },
  { name: 'unverified-claim', expect: 1, match: /not Verified/ },
];

export function runFixtures({ dir = PATHS.fixtures, log = console.log } = {}) {
  const guides = JSON.parse(readFileSync(path.join(dir, 'guides.json'), 'utf8'));
  const ctx = loadContext({ seriesFile: path.join(dir, 'series.json'), claimsFile: path.join(dir, 'claims.json'), guides });
  let ok = true;
  for (const c of FIXTURE_CASES) {
    const ep = JSON.parse(readFileSync(path.join(dir, c.name, 'episode.json'), 'utf8'));
    const entry = ctx.series.episodes.find((e) => e.key === ep.guide);
    const next = nextEntry(ctx.series, entry);
    const findings = lintEpisode(ep, { ctx, entry, guide: guides[entry.key], nextTitle: next ? guides[next.key]?.title ?? null : null });
    const pass = findings.length === c.expect && (!c.match || findings.every((x) => c.match.test(x)));
    ok &&= pass;
    log(`fixture ${c.name}: ${findings.length ? `fails with ${findings.length} finding(s)` : 'passes'}, expected ${c.expect ? `${c.expect} finding(s)` : 'a pass'}: ${pass ? 'ok' : 'NOT OK'}`);
    for (const x of findings) log(`  ${x}`);
  }
  // --series on a two-episode fixture: 1.2 LU apart, and one report rendered with another voice.
  const sdir = path.join(dir, 'series-mode');
  const sctx = loadContext({ seriesFile: path.join(sdir, 'series.json'), claimsFile: path.join(dir, 'claims.json'), mediaRoot: path.join(sdir, 'media') });
  const { findings } = seriesMode(sctx);
  const want = [/loudness spread 1\.20 LU/, /voice id 'XXXXXXXXXXXXXXXXXXXX' != 'Gubgw9l4dtIoQA9YZHgx'/];
  const pass = findings.length === want.length && want.every((re) => findings.some((x) => re.test(x)));
  ok &&= pass;
  log(`fixture series-mode: fails with ${findings.length} finding(s), expected the loudness spread and the voice id: ${pass ? 'ok' : 'NOT OK'}`);
  for (const x of findings) log(`  ${x}`);
  return ok;
}

// ---------------------------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const opts = { keys: [], url: null, series: false, writeTracker: false, fixtures: false, seriesFile: undefined, mediaRoot: undefined, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = (name) => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i]);
    if (a === '--series') opts.series = true;
    else if (a === '--write-tracker') opts.writeTracker = true;
    else if (a === '--fixtures') opts.fixtures = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--series-file')) opts.seriesFile = val();
    else if (a.startsWith('--media-root')) opts.mediaRoot = val();
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else if (/^https?:\/\//.test(a)) opts.url = a;
    else opts.keys.push(a);
  }
  return opts;
}

const USAGE = 'usage: node scripts/episode-lint.mjs <url> [key ...] [--series] [--write-tracker] [--fixtures] [--series-file <file>] [--media-root <dir>]';

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`episode-lint: ${err.message}\n${USAGE}`);
    return 2;
  }
  if (opts.help) { console.log(USAGE); return 0; }

  if (opts.fixtures) {
    const ok = runFixtures();
    console.log(ok ? 'episode-lint fixtures: ok' : 'episode-lint fixtures: FAILED');
    return ok ? 0 : 1;
  }

  const ctx = loadContext({ seriesFile: opts.seriesFile, mediaRoot: opts.mediaRoot });
  const findings = [...checkSeries(ctx.series)];
  const eps = ctx.series.episodes ?? [];
  for (const k of opts.keys) if (!eps.some((e) => e.key === k)) findings.push(`${k}: not in series.json`);
  const chosen = opts.keys.length ? eps.filter((e) => opts.keys.includes(e.key)) : eps;
  const toCheck = chosen.filter((e) => !NOT_CHECKED.has(e.status));
  for (const e of chosen) if (opts.keys.includes(e.key) && NOT_CHECKED.has(e.status)) console.log(`${e.key}: ${e.status}, nothing to check yet`);

  if (toCheck.length) {
    if (!opts.url) { console.error(`episode-lint: a site URL is needed to check ${toCheck.length} episode(s)\n${USAGE}`); return 2; }
    let reader;
    try {
      reader = await openReader();
      const cache = new Map();
      const guideFor = async (key) => {
        if (!cache.has(key)) {
          try {
            cache.set(key, await readGuide(reader.page, opts.url, key));
          } catch (err) {
            if (err instanceof GuideNotFound) cache.set(key, err);
            else throw err;
          }
        }
        return cache.get(key);
      };
      for (const entry of toCheck) {
        const id = entry.id ?? entry.key;
        const file = path.join(ctx.episodesDir, id, 'episode.json');
        if (!existsSync(file)) { findings.push(`${entry.key}: status ${entry.status} but video/episodes/${id}/episode.json does not exist`); continue; }
        let ep;
        try {
          ep = JSON.parse(readFileSync(file, 'utf8'));
        } catch (err) {
          findings.push(`${entry.key}: episode.json is not valid JSON (${err.message})`);
          continue;
        }
        const guide = await guideFor(entry.key);
        if (guide instanceof Error) { findings.push(`${entry.key}: ${guide.message}`); continue; }
        const next = nextEntry(ctx.series, entry);
        const nextGuide = next ? await guideFor(next.key) : null;
        const nextTitle = nextGuide && !(nextGuide instanceof Error) ? nextGuide.title : null;
        findings.push(...lintEpisode(ep, { ctx, entry, guide, nextTitle, folder: id }));
      }
    } catch (err) {
      console.error(`episode-lint: could not read the site at ${opts.url} (${err.message.split('\n')[0]}). Build and serve it first: npm run build && npm run serve`);
      return 2;
    } finally {
      await reader?.close();
    }
  }

  if (opts.series) {
    const { findings: sf, table } = seriesMode(ctx);
    console.log(table);
    findings.push(...sf);
  }

  if (opts.writeTracker) {
    const md = readFileSync(PATHS.readme, 'utf8');
    const next = replaceTracker(md, renderTracker(ctx.series));
    if (next !== md) writeFileSync(PATHS.readme, next);
    console.log(`tracker ${next === md ? 'already current' : 'written'}: video/episodes/README.md`);
  }

  for (const x of findings) console.log(x);
  const counts = {};
  for (const e of eps) counts[e.status] = (counts[e.status] ?? 0) + 1;
  console.log(`episode-lint: ${toCheck.length} episode(s) checked (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}); ${findings.length} finding(s)`);
  return findings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = await main();
}
