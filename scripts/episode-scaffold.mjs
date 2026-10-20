#!/usr/bin/env node
// Drafts a Double Click episode from the guide as the built site renders it and from the claims
// ledger, so every episode starts with its chapters, VO lines, If-not states, candidate claim IDs
// and end card already in place (video/episodes/RUNBOOK.md, EP-1).
//
//   node scripts/episode-scaffold.mjs <key> [--url http://localhost:8124/] [--dry-run] [--force]
//
// Writes video/episodes/<id>/episode.json and video/episodes/<id>/script.md, where <id> is the
// series.json id (the guide key unless series.json says otherwise). Refuses to overwrite either
// file without --force (exit 1, nothing written). --dry-run prints both to stdout and writes
// nothing. It never touches series.json: startedAt is set by the episode procedure, not here.
//
// The draft (status "draft", in the episode.json schema RUNBOOK.md documents):
//   titleCard  "Double Click: <title>", citing the guide's Verified catalogue-tile claims;
//   chapters   one per rendered step: label = step title, highlight.label = the first bold label
//              of the step (selector left for the author), source "demo", onScreen = the If-not
//              line, shown as a state;
//   vo         per step, V<n>a = the Do line and V<n>b = the You-should-see line, each citing every
//              Verified claim of that step (<key>/<n>/*), a superset the author prunes;
//   beats      one per VO line, each starting on a cue named after its line (what the builder
//              needs to cut chapters and place VO);
//   endCard    the next series episode that is not blocked, and the guide's address;
//   music      series.json musicBed; treatment from series.json.
// A guide the step rewrite has not reached yet has no Do or If-not lines: the draft uses its body
// paragraph and figure caption instead and says so in script.md.
//
// Only rendered guide text and claim IDs are written: never IntelliDash source, never real data.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { validateEpisode } from '../video/lib/episode-schema.mjs';
import { openReader, readGuide, GuideNotFound } from './lib/rendered-guide.mjs';
import { nextEntry, parseRunbook, PATHS, TITLE_PREFIX, NEXT_PREFIX, DEFAULT_TARGETS } from './episode-lint.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const COURSE = path.join(REPO_ROOT, 'video', 'brand', 'course.json');
const WORDS_PER_SECOND = 2.3;   // Double Click #1: about 230 words in 1:40
const OPEN_S = 5;               // title card
const CHAPTER_CARD_S = 1.5;     // chapter card before each chapter's footage
const CLICK_ROOM_S = 1.5;       // the picture leads: room for each click around a line
const CLOSE_S = 5;              // end card
const FALLBACK_NEVER = [
  'Real course names, real people\'s names or emails, customer numbers.',
  'Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).',
  'The IntelliDash dev URL, or any browser chrome.',
  'The unsupported-feature message Demo Mode shows for a write.',
  'Any push, save or apply outside a Demo Mode session held by the director\'s gate.',
];

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const spoken = (s) => words(s) / WORDS_PER_SECOND;
const round = (x, step = 0.5) => Math.round(x / step) * step;
const tc = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function parseArgs(argv) {
  const o = { key: null, url: 'http://localhost:8124/', dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
    else if (a.startsWith('--url')) o.url = a.includes('=') ? a.slice(6) : argv[++i];
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else if (!o.key) o.key = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!o.key) throw new Error('a guide key is required');
  return o;
}

// Never-on-camera bullets from RUNBOOK.md, so script.md always carries the current list.
export function neverOnCamera(md) {
  const lines = String(md ?? '').split('\n');
  const i = lines.findIndex((l) => /^##\s+Never on camera\s*$/.test(l));
  if (i < 0) return FALLBACK_NEVER;
  const out = [];
  for (let j = i + 1; j < lines.length && !/^##\s/.test(lines[j]); j++) {
    const m = lines[j].match(/^[-*]\s+(.*)$/);
    if (m) out.push(m[1].trim());
  }
  return out.length ? out : FALLBACK_NEVER;
}

export function draftEpisode({ series, entry, guide, claims, mapPolicy = 'restyle' }) {
  const key = entry.key;
  const verified = (prefix) => [...claims.values()].filter((c) => c.id.startsWith(prefix) && c.status === 'Verified').map((c) => c.id);
  const notVerified = (prefix) => [...claims.values()].filter((c) => c.id.startsWith(prefix) && c.status !== 'Verified').map((c) => c.id);
  const next = nextEntry(series, entry);
  const targets = { ...DEFAULT_TARGETS, ...(series.targets ?? {}) };
  const tile = verified(`${key}/tile/`);
  const used = new Set(tile);
  const chapters = [];
  const vo = [];
  const beats = [];
  const skipped = [];
  for (const s of guide.steps) {
    const cid = `c${s.n}`;
    const cand = verified(`${key}/${s.n}/`);
    skipped.push(...notVerified(`${key}/${s.n}/`));
    cand.forEach((c) => used.add(c));
    chapters.push({
      id: cid, step: s.n, label: s.title,
      highlight: { label: s.boldLabels[0] ?? '', selector: '' },
      source: 'demo',
      onScreen: s.ifNotLine ? [{ text: s.ifNotLine, stateShown: true, claims: [...cand] }] : [],
    });
    const lines = [['a', s.doLine], ['b', s.seeLine]].filter(([, t]) => t);
    lines.forEach(([suffix, text], i) => {
      const id = `V${s.n}${suffix}`;
      const line = { id, chapter: cid, text, claims: [...cand] };
      if (i > 0) line.previous_text = lines[i - 1][1];
      if (i < lines.length - 1) line.next_text = lines[i + 1][1];
      vo.push(line);
      beats.push({ id: `b${s.n}${suffix}`, chapter: cid, vo: id, hold: round(spoken(text) + CLICK_ROOM_S), actions: [{ type: 'cue', id }] });
    });
  }
  const episode = {
    id: entry.id ?? key,
    title: guide.title,
    guide: key,
    status: 'draft',
    durationTarget: targets.runtimeSec,
    source: 'demo',
    mapPolicy,
    allowClicks: [],
    demoWriteClicks: [],
    claims: [...used],
    titleCard: { text: TITLE_PREFIX + guide.title, claims: tile },
    chapters,
    vo,
    beats,
    endCard: next
      ? { next: next.key, text: NEXT_PREFIX + next.title, address: `#/${key}` }
      : { next: null, text: '', address: `#/${key}` },
    music: series.musicBed ?? null,
    treatment: entry.treatment ?? 'standard',
    approvalsRef: entry.approvalsRef ?? null,
  };
  return { episode, skipped: [...new Set(skipped)], next };
}

export function draftScript({ series, entry, guide, episode, skipped, next, never, seriesEnd }) {
  const wave = (series.waves ?? []).find((w) => w.n === entry.wave);
  const v = series.voice ?? {};
  const rows = [];
  let t = 0;
  rows.push([tc(t), tc(t + OPEN_S), '1 Open', `Title card **${cell(episode.titleCard.text)}**, cut to the dashboard in Demo Mode`, '—', '—', episode.titleCard.claims.join(', ') || '—']);
  t += OPEN_S;
  let beat = 2;
  for (const ch of episode.chapters) {
    const lines = episode.vo.filter((l) => l.chapter === ch.id);
    lines.forEach((l, i) => {
      const len = (i === 0 ? CHAPTER_CARD_S : 0) + spoken(l.text) + CLICK_ROOM_S;
      const picture = i === 0
        ? `Chapter card; push in on **${cell(ch.highlight.label) || '(choose the control)'}** with the blue highlight`
        : 'Hold on the result the line describes';
      rows.push([tc(t), tc(t + len), `${beat++} Step ${ch.step}${i ? ' result' : ''}`, picture, i === 0 ? ch.label.toUpperCase() : '', `"${cell(l.text)}"`, l.claims.join(', ') || '—']);
      t += len;
    });
    for (const item of ch.onScreen) {
      rows.push([tc(t), tc(t + 3), `${beat++} Step ${ch.step} if not`, `On screen, the state shown: ${cell(item.text)}`, '', '—', item.claims.join(', ') || '—']);
      t += 3;
    }
  }
  const close = next
    ? `End card **${cell(episode.endCard.text)}** · ${series.siteBase}${episode.endCard.address}`
    : `End card **${cell(seriesEnd ?? 'series-end line: see RUNBOOK.md')}** · ${series.siteBase}${episode.endCard.address}`;
  rows.push([tc(t), tc(t + CLOSE_S), `${beat} Close`, close, '—', '—', '—']);
  t += CLOSE_S;
  const voWords = episode.vo.reduce((n, l) => n + words(l.text), 0);
  const shapeNote = guide.shape
    ? 'The guide renders the step shape: VO lines are its Do and You-should-see lines, and the If-not lines are shown on screen.'
    : 'The guide has not been rewritten into the step shape yet: VO lines are drafted from each step\'s body paragraph (a) and figure caption (b), and there are no If-not lines. Cut each line to what the picture shows, and re-scaffold with --force once the rewrite lands.';
  const out = [
    `# Double Click #${entry.n}: ${guide.title}, script draft`,
    '',
    `**Episode:** ${entry.n} of ${series.episodes.length} · **Wave:** ${entry.wave}${wave ? ` (${wave.name})` : ''}${entry.firstOfWave ? ', first of the wave' : ''} · **Guide:** \`#/${entry.key}\` · **Status:** draft`,
    `**Voice:** ElevenLabs Brian (\`${v.id}\`, ${v.model}) · **Pace:** the picture leads, the VO leaves room for each click`,
    '**Chapter labels:** the step titles exactly, in caps on the typed chapter card (Golos UI 500; the face ships no SemiBold); design-system blue (#3079F0) highlight on the control each step names',
    `**Source:** IntelliDash Demo Mode (\`/demo\`), course overlay on, map ${episode.mapPolicy}; music \`${episode.music}\``,
    '',
    '| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `**VO total:** ${voWords} words, about ${tc(voWords / WORDS_PER_SECOND)} spoken at ${WORDS_PER_SECOND} words per second (Double Click #1: about 230 words in 1:40). Running time about ${tc(t)}; the series target is ${episode.durationTarget[0]}-${episode.durationTarget[1]} s.`,
    '',
    `**Step text:** ${shapeNote}`,
    '',
    '## Claims',
    '',
    'Every line lists every Verified claim of its step: a superset. Keep only the IDs each line actually states, and drop a line no Verified claim backs. `npm run test:episodes -- <key>` checks every remaining ID.',
    '',
    skipped.length
      ? `Not narrated, because they are not Verified: ${skipped.map((id) => `\`${id}\``).join(', ')}.`
      : 'Every claim of these steps is Verified.',
    '',
    '## Never on camera',
    '',
    ...never.map((x) => `- ${x}`),
    '',
  ];
  return out.join('\n');
}

async function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`episode-scaffold: ${err.message}\nusage: node scripts/episode-scaffold.mjs <key> [--url http://localhost:8124/] [--dry-run] [--force]`);
    return 64;
  }
  const series = JSON.parse(readFileSync(PATHS.series, 'utf8'));
  const entry = (series.episodes ?? []).find((e) => e.key === o.key);
  if (!entry) { console.error(`episode-scaffold: ${o.key} is not in video/episodes/series.json`); return 1; }
  const id = entry.id ?? entry.key;
  const dir = path.join(PATHS.episodes, id);
  const files = { episode: path.join(dir, 'episode.json'), script: path.join(dir, 'script.md') };
  const rel = (f) => path.relative(REPO_ROOT, f);
  if (!o.dryRun && !o.force) {
    const existing = Object.values(files).filter((f) => existsSync(f));
    if (existing.length) {
      console.error(`episode-scaffold: ${existing.map(rel).join(' and ')} already exist${existing.length > 1 ? '' : 's'}; nothing written. Use --force to replace ${existing.length > 1 ? 'them' : 'it'}.`);
      return 1;
    }
  }
  if (entry.status === 'blocked') console.error(`episode-scaffold: note: ${o.key} is blocked in series.json (${entry.blockedReason})`);

  const ledger = JSON.parse(readFileSync(PATHS.claims, 'utf8'));
  const claims = new Map((ledger.claims ?? []).map((c) => [c.id, c]));
  const course = existsSync(COURSE) ? JSON.parse(readFileSync(COURSE, 'utf8')) : {};
  const runbook = existsSync(PATHS.runbook) ? readFileSync(PATHS.runbook, 'utf8') : '';

  let reader;
  let guide;
  try {
    reader = await openReader();
    guide = await readGuide(reader.page, o.url, o.key);
  } catch (err) {
    if (err instanceof GuideNotFound) { console.error(`episode-scaffold: ${err.message}`); return 1; }
    console.error(`episode-scaffold: could not read the site at ${o.url} (${err.message.split('\n')[0]}). Build and serve it first: npm run build && npm run serve`);
    return 2;
  } finally {
    await reader?.close();
  }

  const { episode, skipped, next } = draftEpisode({ series, entry, guide, claims, mapPolicy: course?.map?.defaultPolicy ?? 'restyle' });
  const res = validateEpisode(episode);
  if (!res.success) {
    console.error(`episode-scaffold: the draft does not pass the episode schema:\n  - ${res.issues.join('\n  - ')}`);
    return 1;
  }
  const script = draftScript({ series, entry, guide, episode, skipped, next, never: neverOnCamera(runbook), seriesEnd: parseRunbook(runbook).seriesEnd });
  if (!next) episode.endCard.text = parseRunbook(runbook).seriesEnd ?? '';
  const json = `${JSON.stringify(episode, null, 2)}\n`;

  if (o.dryRun) {
    process.stdout.write(`--- ${rel(files.episode)} ---\n${json}--- ${rel(files.script)} ---\n${script}`);
    return 0;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(files.episode, json);
  writeFileSync(files.script, script);
  console.log(`episode-scaffold: wrote ${rel(files.episode)} and ${rel(files.script)} (${episode.chapters.length} chapters, ${episode.vo.length} VO lines${guide.shape ? '' : '; guide not rewritten yet, lines drafted from body and caption'})`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = await main();
}
