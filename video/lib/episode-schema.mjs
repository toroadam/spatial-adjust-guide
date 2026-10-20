// episode.json: the one contract that capture, VO, build, verify and captions all read.
// Field-by-field reference and a complete example: video/episodes/README.md.
//
// Validation happens in two layers:
//   Episode (zod)      shape, plus cross-field rules: references resolve, clicks are allowed,
//                      nothing write-like is clicked, holds are long enough to read.
//   parseEpisode()     reads the file, applies Episode, then checks every claim ID exists in
//                      the claims ledger (docs/claims/claims.json) when the ledger is present.
//
// The write guard is WRITES from scripts/lib/writes.mjs, the same pattern the fidelity harvest
// trusts. A click whose name or target matches it is valid only when the episode declares it in
// demoWriteClicks with a reason AND the episode's source is "demo". Everything else that matches
// is rejected here, long before a browser is involved.
//
// Objects are loose: unknown fields are kept, so later episodes can extend the format without
// breaking earlier ones.
//
// CLI: node video/lib/episode-schema.mjs <episode.json>...   exit 0 when all are valid, 1 otherwise.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { WRITES } from '../../scripts/lib/writes.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const CLAIMS_LEDGER = path.join(REPO_ROOT, 'docs', 'claims', 'claims.json');

export const STATUSES = ['draft', 'script-locked', 'captured', 'edited', 'verified', 'approved'];
export const SLUG = /^[a-z0-9-]+$/;
// Claim IDs in the ledger are <guide>/<step>/<n>, for example dashboard-overview/2/1.
export const CLAIM_ID = /^[a-z0-9-]+\/[a-z0-9-]+\/\d+$/;
// Motion-system hold rule: an on-screen label stays up 1.5 s plus 0.3 s per word.
export const HOLD_BASE_S = 1.5;
export const HOLD_PER_WORD_S = 0.3;

export const minimumHold = (label) => {
  const words = String(label ?? '').trim().split(/\s+/).filter(Boolean).length;
  return words ? HOLD_BASE_S + HOLD_PER_WORD_S * words : 0;
};

const text = z.string().trim().min(1);
const seconds = z.number().finite().nonnegative();

const Wait = z.looseObject({ type: z.literal('wait'), ms: z.number().int().nonnegative() });
const Cue = z.looseObject({ type: z.literal('cue'), id: text });
const Hover = z.looseObject({ type: z.literal('hover'), target: text, name: text });
const Scroll = z.looseObject({ type: z.literal('scroll'), target: text, dy: z.number().finite() });
// focus draws the highlight box around the target only; it never clicks.
const Focus = z.looseObject({ type: z.literal('focus'), target: text, name: text });
const Click = z.looseObject({ type: z.literal('click'), target: text, name: text });
// figure swaps the lifted recreation figure for another figure of the same guide page (the start of
// its caption), so a chapter can show the state its step's figure shows. Recreation episodes only.
const Figure = z.looseObject({ type: z.literal('figure'), caption: text });

export const Action = z.discriminatedUnion('type', [Wait, Cue, Hover, Scroll, Focus, Click, Figure]);

export const Chapter = z.looseObject({ id: text, label: text });

export const VoLine = z.looseObject({
  id: text,
  text,
  previous_text: z.string().optional(),
  next_text: z.string().optional(),
  // Claim IDs backing this line. Required for every line once the script is locked.
  claims: z.array(z.string().regex(CLAIM_ID, 'claim IDs look like <guide>/<step>/<n>')).optional(),
});

export const Beat = z.looseObject({
  id: text,
  chapter: text.optional(),
  label: text.optional(),
  vo: text.optional(),
  hold: seconds,
  // Target the highlight box is drawn around for the whole beat (the same box a focus action draws).
  highlight: text.optional(),
  actions: z.array(Action).default([]),
});

export const DemoWriteClick = z.looseObject({ name: text, target: text, reason: text });

const EpisodeShape = z.looseObject({
  id: z.string().regex(SLUG, 'id must be lower-case letters, digits and hyphens'),
  title: text,
  guide: z.string().regex(SLUG, 'guide must be a guide slug such as dashboard-overview'),
  status: z.enum(STATUSES),
  durationTarget: z.tuple([z.number().positive(), z.number().positive()]),
  source: z.enum(['demo', 'recreation']),
  mapPolicy: z.enum(['blur', 'restyle', 'owned-imagery', 'frame-out']),
  allowClicks: z.array(text).default([]),
  demoWriteClicks: z.array(DemoWriteClick).default([]),
  claims: z.array(z.string().regex(CLAIM_ID, 'claim IDs look like <guide>/<step>/<n>')).default([]),
  chapters: z.array(Chapter).default([]),
  vo: z.array(VoLine).default([]),
  beats: z.array(Beat).default([]),
});

const where = (beat, j, action) =>
  `beat "${beat.id}" actions[${j}] (${action.type}${action.name ? ` "${action.name}"` : ''})`;

function duplicates(list, label, pathKey, ctx) {
  const seen = new Set();
  list.forEach((item, i) => {
    if (!item || typeof item.id !== 'string') return;
    if (seen.has(item.id)) ctx.addIssue({ code: 'custom', path: [pathKey, i, 'id'], message: `duplicate ${label} id "${item.id}"` });
    seen.add(item.id);
  });
}

function crossFieldRules(ep, ctx) {
  const add = (pathParts, message) => ctx.addIssue({ code: 'custom', path: pathParts, message });
  const beats = Array.isArray(ep.beats) ? ep.beats : [];
  const vo = Array.isArray(ep.vo) ? ep.vo : [];
  const chapters = Array.isArray(ep.chapters) ? ep.chapters : [];
  const allow = new Set(ep.allowClicks ?? []);
  const declared = ep.demoWriteClicks ?? [];
  const claims = new Set(ep.claims ?? []);

  duplicates(beats, 'beat', 'beats', ctx);
  duplicates(vo, 'vo line', 'vo', ctx);
  duplicates(chapters, 'chapter', 'chapters', ctx);

  if (Array.isArray(ep.durationTarget) && ep.durationTarget[0] > ep.durationTarget[1]) {
    add(['durationTarget'], `durationTarget minimum ${ep.durationTarget[0]} s is above the maximum ${ep.durationTarget[1]} s`);
  }

  (ep.allowClicks ?? []).forEach((name, i) => {
    if (WRITES.test(name)) {
      add(['allowClicks', i], `allowClicks entry "${name}" matches the write guard; allowClicks is for read-only clicks (declare demo-mode writes in demoWriteClicks)`);
    }
  });
  if (ep.source !== 'demo') {
    declared.forEach((d, i) => add(['demoWriteClicks', i],
      `demoWriteClicks entry "${d.name}" is only allowed when source is "demo" (source is "${ep.source}")`));
  }

  const voIds = new Set(vo.map((l) => l.id));
  const chapterIds = new Set(chapters.map((c) => c.id));
  const cueIds = new Map();

  beats.forEach((beat, i) => {
    if (!beat) return;
    if (beat.vo !== undefined && !voIds.has(beat.vo)) {
      add(['beats', i, 'vo'], `beat "${beat.id}" references vo line "${beat.vo}", which is not defined in vo`);
    }
    if (beat.chapter !== undefined && !chapterIds.has(beat.chapter)) {
      add(['beats', i, 'chapter'], `beat "${beat.id}" references chapter "${beat.chapter}", which is not defined in chapters`);
    }
    if (beat.label !== undefined && typeof beat.hold === 'number') {
      const min = minimumHold(beat.label);
      if (beat.hold + 1e-9 < min) {
        add(['beats', i, 'hold'],
          `beat "${beat.id}" holds its label for ${beat.hold} s; ${beat.label.trim().split(/\s+/).length} words need at least ${Math.round(min * 100) / 100} s (1.5 s + 0.3 s per word)`);
      }
    }
    (beat.actions ?? []).forEach((action, j) => {
      if (!action) return;
      if (action.type === 'cue') {
        if (cueIds.has(action.id)) add(['beats', i, 'actions', j, 'id'], `${where(beat, j, action)}: duplicate cue id "${action.id}" (first used in beat "${cueIds.get(action.id)}")`);
        else cueIds.set(action.id, beat.id);
      }
      if (action.type === 'figure' && ep.source !== 'recreation') {
        add(['beats', i, 'actions', j], `${where(beat, j, action)}: a figure action swaps the lifted recreation figure, so it is only allowed when source is "recreation" (source is "${ep.source}")`);
      }
      if (action.type !== 'click') return;
      const writeLike = WRITES.test(action.name) || WRITES.test(action.target);
      if (writeLike) {
        const decl = declared.find((d) => d.name === action.name && d.target === action.target);
        if (!decl) {
          add(['beats', i, 'actions', j], `${where(beat, j, action)}: click matches the write guard and is not declared in demoWriteClicks`);
        } else if (ep.source !== 'demo') {
          add(['beats', i, 'actions', j], `${where(beat, j, action)}: declared demo-mode click, but source is "${ep.source}"; write-like clicks are only allowed in Demo Mode`);
        }
      } else if (!allow.has(action.name)) {
        add(['beats', i, 'actions', j, 'name'], `${where(beat, j, action)}: click is not listed in allowClicks`);
      }
    });
  });

  const locked = STATUSES.indexOf(ep.status) >= STATUSES.indexOf('script-locked');
  if (locked && claims.size === 0) {
    add(['claims'], `status "${ep.status}" requires claims: every VO sentence must be backed by a claim from the claims ledger`);
  }
  vo.forEach((line, i) => {
    if (!line) return;
    for (const c of line.claims ?? []) {
      if (!claims.has(c)) add(['vo', i, 'claims'], `vo line "${line.id}" cites claim "${c}", which is not listed in the episode's claims`);
    }
    if (locked && !(line.claims?.length)) {
      add(['vo', i, 'claims'], `vo line "${line.id}" has no claims; status "${ep.status}" requires a backing claim for every VO line`);
    }
  });
}

export const Episode = EpisodeShape.superRefine(crossFieldRules);

export class EpisodeError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'EpisodeError';
    this.issues = issues;
  }
}

// Human-readable issues; beats are named by id rather than array index where possible.
export function formatIssues(issues, input) {
  return issues.map((issue) => {
    const parts = [...issue.path];
    let label = '';
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (typeof p === 'number') {
        const holder = parts.slice(0, k).reduce((o, key) => (o == null ? o : o[key]), input);
        const id = holder?.[p]?.id;
        label += id ? `[${JSON.stringify(id)}]` : `[${p}]`;
      } else {
        label += label ? `.${String(p)}` : String(p);
      }
    }
    return `${label || '(episode)'}: ${issue.message}`;
  });
}

// { success, data, issues } without throwing.
export function validateEpisode(input) {
  const res = Episode.safeParse(input);
  if (res.success) return { success: true, data: res.data, issues: [] };
  return { success: false, data: null, issues: formatIssues(res.error.issues, input) };
}

function loadLedgerIds(ledgerPath) {
  if (!ledgerPath || !existsSync(ledgerPath)) return null;
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  return new Set((ledger.claims ?? []).map((c) => c.id));
}

// Validates an already-parsed episode, including the claims ledger check; throws EpisodeError
// listing every issue. ledger: path to the claims ledger, or null to skip the existence check.
export function checkEpisode(input, { ledger = CLAIMS_LEDGER, label = 'episode' } = {}) {
  const res = validateEpisode(input);
  const issues = [...res.issues];
  if (res.success) {
    const known = loadLedgerIds(ledger);
    if (known) {
      res.data.claims.forEach((c, i) => {
        if (!known.has(c)) issues.push(`claims[${i}]: claim "${c}" is not in the claims ledger ${path.relative(REPO_ROOT, ledger)}`);
      });
    }
  }
  if (issues.length) throw new EpisodeError(`${label} is not a valid episode:\n  - ${issues.join('\n  - ')}`, issues);
  return res.data;
}

// Reads and validates an episode file; throws EpisodeError listing every issue.
export function parseEpisode(file, options = {}) {
  let input;
  try {
    input = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new EpisodeError(`${file}: ${err.code === 'ENOENT' ? 'file not found' : `not valid JSON (${err.message})`}`);
  }
  return checkEpisode(input, { ...options, label: file });
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const files = process.argv.slice(2);
  if (!files.length) {
    process.stderr.write('Usage: node video/lib/episode-schema.mjs <episode.json>...\n');
    process.exitCode = 64;
  } else {
    for (const f of files) {
      try {
        const ep = parseEpisode(f);
        console.log(`ok ${f} (${ep.id}, ${ep.beats.length} beats, status ${ep.status})`);
      } catch (err) {
        if (!(err instanceof EpisodeError)) throw err;
        console.error(err.message);
        process.exitCode = 1;
      }
    }
  }
}
