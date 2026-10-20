#!/usr/bin/env node
// check-claims.mjs: every spoken line and on-screen label of the showcase film maps to a Verified
// claim in the claims ledger (global rule 4 in video/showcase/README.md). It also writes the
// evidence table in video/showcase/claims-check.md, so the document cannot drift from the config.
//
// Usage (from the repository root):
//   node video/showcase/check-claims.mjs [--episode <file>] [--claims <file|dir>]
//        [--approvals <file>] [--doc <file>] [--write] [--strict]
//
// Defaults: video/showcase/episode.json, docs/claims/claims.json, video/approvals.md and
// video/showcase/claims-check.md. Relative paths resolve against the working directory.
//
// What it reads from the episode (the extension fields are described in video/showcase/README.md):
//   vo[]              every spoken line: id, text, claims[]
//   beats[].labels[]  every on-screen text: chapter labels, the title card, type cards, end-card
//                     copy, caption overlays. Each item: id, text, kind, claims[], and optionally
//                     comingSoon and approval.
//   held[]            lines taken out of the film until their claims are Verified; listed in the
//                     doc's held block, never narrated or shown.
//
// Rules (a failure is one line: FAIL <beat> <item> "<text>" <claim>: <reason>):
//   a. Every item cites at least one claim ID, unless kind is "brand". A brand item may hold only a
//      product or brand name (BRAND_NAMES, plus the series word the builder draws) or the end-card
//      copy and URL from the config named by endCard.config, accepted while its gate (endCard.approval)
//      has a recorded decision in the approvals log.
//   b. Every claim ID exists in the ledger.
//   c. Its status is Verified. Not shipping is accepted only on an item with comingSoon: true whose
//      text says "coming soon" and whose approval names a gate row in the approvals log with a
//      Decision cell that reads Approved.
//   d. Wrong, Needs expert, Unverified and any other status always fail.
//   e. A digit or % in an item's text is a warning unless one of its claims has type calculation or
//      prerequisite. --strict turns warnings into failures. Brand items are exempt: their whole
//      text is a brand name or the decided end-card copy.
//   Coverage: every chapter label and the episode title appear as label items; every voLines id
//   exists; the episode's top-level claims[] lists exactly the IDs its items cite (the episode
//   schema checks VO claims against that list); while targetProfiles.decision is "omit", no Target
//   Profiles claim ID appears anywhere in the episode config, held lines and notes included; held
//   items cite claims that exist and are not also live.
//
// The doc: the table between <!-- claims:begin --> and <!-- claims:end -->, and the held table
// between <!-- held:begin --> and <!-- held:end --> when those markers are present. --write
// rewrites only those blocks. Without --write, a block that differs from the generated one is a
// failure (the doc is stale).
//
// Exit codes: 0 clean, 1 any failure (or a stale doc), 2 usage or input error.
// Node 20 ESM, built-ins only.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');

export const DEFAULTS = {
  episode: 'video/showcase/episode.json',
  claims: 'docs/claims/claims.json',
  approvals: 'video/approvals.md',
  doc: 'video/showcase/claims-check.md',
};

// Product and brand names a brand item may carry without a claim.
export const BRAND_NAMES = ['Spatial Adjust', 'IntelliDash', 'TurfRad', 'Lynx', 'Toro'];
// The series word the pipeline's builder draws above every episode title (SERIES_WORD in
// video/edit/lib/brand.py; check-claims.test.mjs fails if the two drift apart).
export const SERIES_WORD = 'Double Click';
export const NUMERIC_TYPES = new Set(['calculation', 'prerequisite']);
export const TARGET_PROFILE_GUIDES = ['target-profiles', 'creating-profiles', 'updating-profiles', 'seasonal-profiles'];
export const MARKERS = {
  claims: ['<!-- claims:begin -->', '<!-- claims:end -->'],
  held: ['<!-- held:begin -->', '<!-- held:end -->'],
};
const END_CARD_FIELDS = ['cta', 'display', 'url', 'legal'];

export class InputError extends Error {}

const readJson = (file, what) => {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    throw new InputError(`${what} not found: ${file}${err.code === 'ENOENT' ? '' : ` (${err.code})`}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new InputError(`${what} is not valid JSON: ${file} (${err.message})`);
  }
};

// --- claims ledger ---------------------------------------------------------------------------

function ledgerRecords(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.claims)) return data.claims;
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && !Array.isArray(v))
      .map(([id, v]) => ({ id, ...v }));
  }
  return [];
}

// One citation as short text: a doc section, or an IntelliDash file:line (the ref and short SHA
// are added unless it is the pinned production SHA named in the doc's header).
export function formatCitation(e) {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  if (e.source === 'doc') return String(e.ref ?? '');
  const file = e.path ? path.posix.basename(String(e.path)) : '';
  const where = file ? `${file}${e.line != null ? `:${e.line}` : ''}` : String(e.ref ?? '');
  return e.ref && e.ref !== 'production' ? `${where} (${e.ref}${e.sha ? ` @${String(e.sha).slice(0, 7)}` : ''})` : where;
}

function normaliseClaim(r) {
  const cites = r.evidence ?? r.citation ?? r.citations ?? [];
  const list = Array.isArray(cites) ? cites : [cites];
  return {
    id: String(r.id),
    status: typeof r.status === 'string' ? r.status : '',
    type: typeof r.type === 'string' ? r.type : '',
    text: typeof r.text === 'string' ? r.text : '',
    question: typeof r.question === 'string' ? r.question : '',
    citation: list.map(formatCitation).filter(Boolean),
  };
}

// The ledger as a Map of id -> { status, type, text, question, citation[] }. Accepts the assembled
// claims.json ({ _meta, claims: [...] }), a bare array, an object keyed by id, or a directory: its
// claims.json when one is published, otherwise every shard in guides/ (or the directory itself).
export function loadClaims(target) {
  let st;
  try {
    st = statSync(target);
  } catch {
    throw new InputError(`claims ledger not found: ${target}`);
  }
  let records = [];
  let meta = null;
  if (st.isDirectory()) {
    const assembled = path.join(target, 'claims.json');
    if (existsSync(assembled)) return loadClaims(assembled);
    const shardDir = existsSync(path.join(target, 'guides')) ? path.join(target, 'guides') : target;
    const shards = readdirSync(shardDir).filter((f) => f.endsWith('.json')).sort();
    if (!shards.length) throw new InputError(`claims ledger directory has no claims.json and no shards: ${target}`);
    for (const f of shards) records.push(...ledgerRecords(readJson(path.join(shardDir, f), 'claims shard')));
  } else {
    const data = readJson(target, 'claims ledger');
    records = ledgerRecords(data);
    meta = data && !Array.isArray(data) && data._meta ? data._meta : null;
  }
  const claims = new Map();
  for (const r of records) if (r && r.id != null) claims.set(String(r.id), normaliseClaim(r));
  return { claims, meta };
}

// --- approvals log ---------------------------------------------------------------------------

const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
const isRow = (line) => typeof line === 'string' && /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (line) => isRow(line) && tableCells(line).every((c) => /^:?-{3,}:?$/.test(c));
const cleanCell = (c) => String(c ?? '').replace(/[`*]/g, '').trim();

// Gate id -> Decision cell, from every markdown table whose header has a Gate column and a
// Decision column. Only those two columns are read. A gate listed twice keeps its last row: a
// changed decision is a new row.
export function parseApprovals(md) {
  const gates = new Map();
  const lines = String(md).split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    if (!isRow(lines[i]) || !isSeparator(lines[i + 1])) continue;
    const header = tableCells(lines[i]).map((h) => cleanCell(h).toLowerCase());
    const gi = header.findIndex((h) => /\bgate\b/.test(h));
    const di = header.findIndex((h) => /\bdecision\b/.test(h));
    let j = i + 2;
    for (; j < lines.length && isRow(lines[j]); j++) {
      if (gi < 0 || di < 0) continue;
      const cells = tableCells(lines[j]);
      const gate = cleanCell(cells[gi]);
      if (gate) gates.set(gate, cleanCell(cells[di]));
    }
    i = j - 1;
  }
  return gates;
}

export const isApproved = (decision) =>
  /\bapproved\b/i.test(decision ?? '') && !/\b(not|un|pending|rejected)[\s-]*approved\b/i.test(decision ?? '');
export const isRecorded = (decision) => Boolean(decision) && !/\b(pending|rejected)\b/i.test(decision);

// --- episode items ---------------------------------------------------------------------------

const asItem = (src, beat, source) => ({
  beat,
  source,
  id: typeof src?.id === 'string' ? src.id : '',
  text: typeof src?.text === 'string' ? src.text : '',
  kind: typeof src?.kind === 'string' ? src.kind : source === 'vo' ? 'vo' : 'label',
  claims: Array.isArray(src?.claims) ? src.claims : [],
  claimsValid: src?.claims === undefined || (Array.isArray(src.claims) && src.claims.every((c) => typeof c === 'string')),
  comingSoon: src?.comingSoon === true,
  approval: typeof src?.approval === 'string' ? src.approval : null,
});

// Every spoken line and on-screen label, in film order: each beat's labels, then its VO lines.
// A VO line no beat lists comes last, with no beat.
export function collectItems(ep) {
  const items = [];
  const vo = Array.isArray(ep?.vo) ? ep.vo : [];
  const voById = new Map(vo.filter((l) => l && typeof l.id === 'string').map((l) => [l.id, l]));
  const placed = new Set();
  for (const beat of Array.isArray(ep?.beats) ? ep.beats : []) {
    for (const label of Array.isArray(beat?.labels) ? beat.labels : []) items.push(asItem(label, beat.id, 'label'));
    const ids = Array.isArray(beat?.voLines) ? beat.voLines : beat?.vo ? [beat.vo] : [];
    for (const id of ids) {
      const line = voById.get(id);
      if (line && !placed.has(id)) {
        placed.add(id);
        items.push(asItem(line, beat.id, 'vo'));
      }
    }
  }
  for (const line of vo) if (line && !placed.has(line.id)) items.push(asItem(line, null, 'vo'));
  return items;
}

export const collectHeld = (ep) =>
  (Array.isArray(ep?.held) ? ep.held : []).map((h) => ({ ...asItem(h, h?.beat ?? null, 'held'), note: typeof h?.note === 'string' ? h.note : '' }));

// End-card copy accepted on brand items: the strings of the config named by endCard.config
// (resolved against the repository root), while endCard.approval has a recorded decision.
export function endCardCopy(ep, gates, root = REPO_ROOT) {
  const card = ep?.endCard;
  if (!card || !card.config) return { copy: [], problem: null };
  const file = path.resolve(root, card.config);
  if (!existsSync(file)) return { copy: [], problem: `end-card config not found: ${card.config}` };
  const cfg = readJson(file, 'end-card config');
  if (card.approval && !isRecorded(gates.get(card.approval))) {
    return { copy: [], problem: `end-card gate ${card.approval} has no recorded decision in the approvals log` };
  }
  return { copy: END_CARD_FIELDS.map((k) => cfg[k]).filter((v) => typeof v === 'string' && v.trim()), problem: null };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What is left of a brand item's text once every allowed name and end-card string is removed,
// ignoring punctuation, symbols and spaces. Empty means the item is brand-only.
export function brandLeftover(text, allowed) {
  let rest = String(text);
  for (const s of [...allowed].sort((a, b) => b.length - a.length)) rest = rest.replace(new RegExp(escapeRe(s), 'gi'), ' ');
  return rest.replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
}

const guideOf = (id) => String(id).split('/')[0];

// --- the check -------------------------------------------------------------------------------

export function check(ep, ledger, gates, { strict = false, root = REPO_ROOT } = {}) {
  const items = collectItems(ep);
  const held = collectHeld(ep);
  const failures = [];
  const warnings = [];
  const notes = [];
  const fail = (item, claim, reason) => failures.push({ beat: item?.beat ?? null, id: item?.id ?? '', text: item?.text ?? '', claim: claim ?? null, reason });
  const warn = (item, claim, reason) => warnings.push({ beat: item?.beat ?? null, id: item?.id ?? '', text: item?.text ?? '', claim: claim ?? null, reason });

  const { copy, problem } = endCardCopy(ep, gates, root);
  if (problem) fail(null, null, problem);
  const brandAllowed = [...BRAND_NAMES, SERIES_WORD, ...copy];

  const tpOmitted = ep?.targetProfiles?.decision === 'omit';
  const tpComingSoon = /coming/i.test(String(ep?.targetProfiles?.decision ?? ''));
  const tpGate = ep?.targetProfiles?.approval ?? 'SC-TP';

  const seen = new Set();
  for (const item of items) {
    if (!item.id) fail(item, null, 'item has no id');
    else if (seen.has(item.id)) fail(item, null, `duplicate item id "${item.id}"`);
    seen.add(item.id);
    if (!item.text.trim()) fail(item, null, 'item has no text');
    if (!item.claimsValid) {
      fail(item, null, 'claims must be an array of claim ID strings');
      continue;
    }

    // a. a claim, or brand-only text
    if (item.kind === 'brand') {
      const rest = brandLeftover(item.text, brandAllowed);
      if (rest) fail(item, null, `brand item holds more than a brand name or the decided end-card copy: "${rest}" needs a claim`);
    } else if (!item.claims.length) {
      fail(item, null, 'no claim ID: every spoken line and on-screen label needs a Verified claim (or kind "brand")');
    }

    // b-d. every ID exists and is Verified (Not shipping only as an approved COMING SOON item)
    for (const id of item.claims) {
      const c = ledger.get(id);
      if (!c) {
        fail(item, id, 'claim ID is not in the claims ledger');
        continue;
      }
      if (c.status === 'Verified') continue;
      if (c.status === 'Not shipping') {
        if (!item.comingSoon) fail(item, id, 'status is Not shipping: allowed only on a comingSoon: true item with an Approved gate');
        else if (!item.approval) fail(item, id, 'status is Not shipping: the comingSoon item names no approval gate');
        else if (!gates.has(item.approval)) fail(item, id, `status is Not shipping: approval gate ${item.approval} has no row in the approvals log`);
        else if (!isApproved(gates.get(item.approval))) fail(item, id, `status is Not shipping: gate ${item.approval} reads "${gates.get(item.approval)}", not Approved`);
        continue;
      }
      fail(item, id, `status is ${c.status || '(none)'}; only Verified is accepted${c.question ? ` (expert question: ${c.question})` : ''}`);
    }
    if (item.comingSoon && !/coming soon/i.test(item.text)) fail(item, null, 'comingSoon item must say COMING SOON in its text');

    // e. numbers need a calculation or prerequisite claim
    if (item.kind !== 'brand' && /[0-9%]/.test(item.text)) {
      const numeric = item.claims.some((id) => NUMERIC_TYPES.has(ledger.get(id)?.type));
      if (!numeric) warn(item, null, 'digit or % in the text, but no mapped claim has type calculation or prerequisite');
    }

    // Target Profiles
    for (const id of item.claims) {
      if (!TARGET_PROFILE_GUIDES.includes(guideOf(id))) continue;
      if (tpOmitted) fail(item, id, `Target Profiles claim, but targetProfiles.decision is "omit" (gate ${tpGate})`);
      else if (tpComingSoon && !(item.comingSoon && item.approval === tpGate)) {
        fail(item, id, `Target Profiles item must carry comingSoon: true and approval "${tpGate}"`);
      }
    }
  }

  // Target Profiles while omitted (gate SC-TP): no Target Profiles claim ID anywhere in the config,
  // so a held line, a note or the top-level list cannot carry one either. IDs a live item cites
  // have already failed above.
  if (tpOmitted) {
    const tpId = new RegExp(`\\b(?:${TARGET_PROFILE_GUIDES.map(escapeRe).join('|')})/[A-Za-z0-9-]+/\\d+\\b`, 'g');
    const live = new Set(items.flatMap((i) => i.claims));
    const found = new Set(JSON.stringify(ep ?? {}).match(tpId) ?? []);
    for (const id of found) {
      if (!live.has(id)) fail({ beat: null, id: '(episode config)', text: '' }, id, `Target Profiles claim ID in the episode config, but targetProfiles.decision is "omit" (gate ${tpGate})`);
    }
  }

  // Coverage: on-screen text the builder draws must be an item, so it cannot escape the check.
  const labelTexts = (kind) => new Set(items.filter((i) => i.source === 'label' && i.kind === kind).map((i) => i.text));
  const chapterLabels = labelTexts('chapter');
  const beats = Array.isArray(ep?.beats) ? ep.beats : [];
  for (const beat of beats) {
    if (typeof beat?.label === 'string' && !(beat.labels ?? []).some((l) => l?.kind === 'chapter' && l.text === beat.label)) {
      fail({ beat: beat.id, id: '(chapter label)', text: beat.label }, null, 'the beat\'s chapter label has no labels[] item of kind "chapter" with the same text');
    }
  }
  for (const ch of Array.isArray(ep?.chapters) ? ep.chapters : []) {
    if (typeof ch?.label === 'string' && !chapterLabels.has(ch.label)) {
      fail({ beat: null, id: `(chapter ${ch.id})`, text: ch.label }, null, 'chapter label is drawn on screen but is not a labels[] item of kind "chapter"');
    }
  }
  if (typeof ep?.title === 'string' && !labelTexts('title').has(ep.title)) {
    fail({ beat: null, id: '(title)', text: ep.title }, null, 'the episode title is drawn on the title card but is not a labels[] item of kind "title"');
  }
  const voIds = new Set((Array.isArray(ep?.vo) ? ep.vo : []).map((l) => l?.id));
  for (const beat of beats) {
    for (const id of Array.isArray(beat?.voLines) ? beat.voLines : []) {
      if (!voIds.has(id)) fail({ beat: beat.id, id, text: '' }, null, 'voLines names a VO line that vo[] does not define');
    }
  }

  // The episode's claims[] is exactly what its items cite.
  const cited = new Set(items.flatMap((i) => i.claims));
  const listed = new Set(Array.isArray(ep?.claims) ? ep.claims : []);
  const missing = [...cited].filter((c) => !listed.has(c));
  const extra = [...listed].filter((c) => !cited.has(c));
  if (missing.length) fail({ beat: null, id: '(episode claims)', text: '' }, missing.join(', '), 'cited by an item but missing from the episode\'s top-level claims[]');
  if (extra.length) fail({ beat: null, id: '(episode claims)', text: '' }, extra.join(', '), 'listed in the episode\'s top-level claims[] but cited by no item');

  // Held lines: real claims, and not also in the film.
  for (const h of held) {
    if (!h.id) fail(h, null, 'held item has no id');
    else if (seen.has(h.id)) fail(h, null, `held item id "${h.id}" is also a live line or label`);
    if (!h.claims.length) fail(h, null, 'held item cites no claim: name the claim it waits for');
    for (const id of h.claims) if (!ledger.has(id)) fail(h, id, 'held item cites a claim ID that is not in the claims ledger');
    if (h.claims.length && h.claims.every((id) => ledger.get(id)?.status === 'Verified')) {
      notes.push(`held item ${h.id}: every claim it waits for is now Verified; it can return to the film`);
    }
  }

  if (strict) for (const w of warnings.splice(0)) failures.push({ ...w, reason: `${w.reason} (--strict)` });
  return { items, held, failures, warnings, notes, ledger };
}

// --- the doc ---------------------------------------------------------------------------------

const cell = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const beatName = (b) => (b ? String(b).toUpperCase() : '—');

export function renderTable(items, ledger, meta, { cardGate = null } = {}) {
  const brandNames = [...BRAND_NAMES, SERIES_WORD];
  const rows = [
    '| # | Text (exact copy) | Beat | Kind | Claim IDs | Status | Citation |',
    '|---|---|---|---|---|---|---|',
  ];
  items.forEach((item, i) => {
    let ids, status, cites;
    if (!item.claims.length) {
      ids = '—';
      status = item.kind === 'brand' ? 'brand, no claim needed' : 'NO CLAIM';
      cites = item.kind !== 'brand' ? '—'
        : brandLeftover(item.text, brandNames) ? `end-card copy${cardGate ? ` decided at ${cell(cardGate)}` : ''}` : 'brand name';
    } else {
      ids = item.claims.map((c) => `\`${c}\``).join('<br>');
      status = item.claims.map((c) => ledger.get(c)?.status || 'NOT IN LEDGER').join('<br>');
      cites = item.claims.map((c) => cell((ledger.get(c)?.citation ?? []).join(', ') || '—')).join('<br>');
    }
    rows.push(`| ${i + 1} | "${cell(item.text)}" | ${beatName(item.beat)} | ${cell(item.kind)} | ${ids} | ${status} | ${cites} |`);
  });
  const vo = items.filter((i) => i.source === 'vo').length;
  const ids = [...new Set(items.flatMap((i) => i.claims))];
  const byStatus = {};
  for (const id of ids) {
    const s = ledger.get(id)?.status || 'not in ledger';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  const counts = Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(', ') || 'none';
  const words = items.filter((i) => i.source === 'vo').reduce((n, i) => n + i.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const lines = [
    '<!-- Generated by node video/showcase/check-claims.mjs --write. Do not edit by hand: change video/showcase/episode.json and re-run. -->',
    '',
    ...rows,
    '',
    `**${items.length} items:** ${vo} VO lines (${words} words) and ${items.length - vo} on-screen labels, citing ${ids.length} distinct claim IDs (${counts}).`,
  ];
  if (meta?.intellidash?.production?.sha) {
    const prod = meta.intellidash.production;
    const dev = meta.intellidash.develop;
    lines.push(
      '',
      `**Ledger:** ${meta.claims ?? ledger.size} claims; production \`${prod.sha}\`${dev?.sha ? `, develop \`${dev.sha}\`` : ''}${meta.intellidash.fetchedAt ? `, fetched ${meta.intellidash.fetchedAt}` : ''}.`,
    );
  }
  return lines.join('\n');
}

export function renderHeld(held, ledger) {
  if (!held.length) return 'none';
  const rows = [
    '| Held item | Draft text | Beat | Claim IDs | Ledger status | Expert question | Decision |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const h of held) {
    const ids = h.claims.map((c) => `\`${c}\``).join('<br>') || '—';
    const status = h.claims.map((c) => ledger.get(c)?.status || 'NOT IN LEDGER').join('<br>') || '—';
    const qs = [...new Set(h.claims.map((c) => ledger.get(c)?.question).filter(Boolean))].map(cell).join('<br>') || '—';
    rows.push(`| \`${cell(h.id)}\` | "${cell(h.text)}" | ${beatName(h.beat)} | ${ids} | ${status} | ${qs} | ${cell(h.note) || '—'} |`);
  }
  return ['<!-- Generated from held[] in video/showcase/episode.json by node video/showcase/check-claims.mjs --write. -->', '', ...rows].join('\n');
}

// The doc with the block between the markers replaced, or null when the markers are missing.
export function replaceBlock(doc, [begin, end], body) {
  const i = doc.indexOf(begin);
  const j = doc.indexOf(end, i < 0 ? 0 : i + begin.length);
  if (i < 0 || j < 0) return null;
  return `${doc.slice(0, i + begin.length)}\n${body}\n${doc.slice(j)}`;
}

// --- CLI -------------------------------------------------------------------------------------

const quote = (s) => `"${String(s ?? '')}"`;
const formatProblem = (tag, f) => `${tag} ${beatName(f.beat)} ${f.id || '-'} ${quote(f.text)} ${f.claim ?? '-'}: ${f.reason}`;

export function main(argv = process.argv.slice(2), { cwd = process.cwd(), out = console.log, err = console.error } = {}) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        episode: { type: 'string', default: DEFAULTS.episode },
        claims: { type: 'string', default: DEFAULTS.claims },
        approvals: { type: 'string', default: DEFAULTS.approvals },
        doc: { type: 'string', default: DEFAULTS.doc },
        write: { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    }));
  } catch (e) {
    err(`check-claims: ${e.message}`);
    return 2;
  }
  if (args.help) {
    out('Usage: node video/showcase/check-claims.mjs [--episode <file>] [--claims <file|dir>] [--approvals <file>] [--doc <file>] [--write] [--strict]');
    return 0;
  }
  // Defaults are repository paths; anything given on the command line resolves against cwd.
  const resolve = (key) => path.resolve(args[key] === DEFAULTS[key] ? REPO_ROOT : cwd, args[key]);

  try {
    const episodePath = resolve('episode');
    const ep = readJson(episodePath, 'episode');
    const { claims: ledger, meta } = loadClaims(resolve('claims'));
    const approvalsPath = resolve('approvals');
    const gates = existsSync(approvalsPath) ? parseApprovals(readFileSync(approvalsPath, 'utf8')) : new Map();
    if (!existsSync(approvalsPath)) err(`check-claims: approvals log not found (${args.approvals}); no gate counts as decided`);

    const result = check(ep, ledger, gates, { strict: args.strict });
    for (const f of result.failures) out(formatProblem('FAIL', f));
    for (const w of result.warnings) out(formatProblem('WARN', w));
    for (const n of result.notes) out(`NOTE ${n}`);

    // The doc
    const docPath = resolve('doc');
    let docFailed = false;
    if (!existsSync(docPath)) {
      out(`FAIL doc not found: ${args.doc} (create it with the ${MARKERS.claims[0]} and ${MARKERS.claims[1]} markers)`);
      docFailed = true;
    } else {
      const doc = readFileSync(docPath, 'utf8');
      let next = replaceBlock(doc, MARKERS.claims, renderTable(result.items, ledger, meta, { cardGate: ep?.endCard?.approval ?? null }));
      if (next === null) {
        out(`FAIL ${args.doc} has no ${MARKERS.claims[0]} ... ${MARKERS.claims[1]} block`);
        docFailed = true;
      } else {
        if (next.includes(MARKERS.held[0])) {
          const withHeld = replaceBlock(next, MARKERS.held, renderHeld(result.held, ledger));
          if (withHeld === null) {
            out(`FAIL ${args.doc} has ${MARKERS.held[0]} but no ${MARKERS.held[1]}`);
            docFailed = true;
          } else next = withHeld;
        } else if (result.held.length) {
          out(`FAIL ${args.doc} has no ${MARKERS.held[0]} ... ${MARKERS.held[1]} block for the ${result.held.length} held items`);
          docFailed = true;
        }
        if (!docFailed) {
          if (next === doc) out(`doc: ${args.doc} is up to date`);
          else if (args.write) {
            writeFileSync(docPath, next);
            out(`doc: ${args.doc} rewritten between its markers`);
          } else {
            out(`FAIL ${args.doc} is stale: its generated blocks differ from the episode and ledger; run with --write`);
            docFailed = true;
          }
        }
      }
    }

    const failed = result.failures.length + (docFailed ? 1 : 0);
    out(
      `check-claims: ${result.items.length} items (${result.items.filter((i) => i.source === 'vo').length} VO lines, ` +
        `${result.items.filter((i) => i.source === 'label').length} labels), ${result.held.length} held, ` +
        `${result.failures.length} failures, ${result.warnings.length} warnings${args.strict ? ' (strict)' : ''}` +
        `${docFailed ? ', doc failed' : ''}`,
    );
    return failed ? 1 : 0;
  } catch (e) {
    if (e instanceof InputError) {
      err(`check-claims: ${e.message}`);
      return 2;
    }
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
