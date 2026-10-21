// Turns every published guide sentence and catalogue tile into a claim with a stable ID, and keeps
// the claims ledger in docs/claims/ up to date without losing verification work.
//
// Why the guide data is evaluated rather than scraped. docs/audit-verification.md records an
// earlier extractor that read the export with loose regexes. It missed the verify, caption and tip
// fields, and it missed the seventeen guides added later by Object.assign(GUIDES, ...), so it
// reported things about the guides that were not true. Here the data block of the export is run
// in node:vm, and GUIDES, TARGETS and CATEGORIES are read as the objects the page itself builds.
//
// Why it runs after transformGuide(). The ledger describes the published text, which is the
// export with every anchored correction applied, including the two guides that
// src/transform-export.mjs adds. A claim about a sentence the reader never sees is worth nothing.
//
// Why shown mode. extractGuides() asks transformGuide() for the text with beta content shown
// (showBeta: true), whatever SA_SHOW_BETA says. That text is a superset of a build with
// SA_SHOW_BETA=false, so every sentence any build can publish has a claim, and step numbers are
// the shown-mode ones. Beta content is judged against develop and may carry the status
// Verified (beta); see "Verified (beta)" in docs/claims/README.md and releaseContext() below.
//
// Outputs:
//   docs/claims/guides/<guide-key>.json  one shard per guide. Verification features edit these,
//                                        one feature per shard (see docs/claims/README.md).
//   docs/claims/claims.json              the canonical aggregate, rebuilt from the shards.
//
// Re-running is merge-preserving. For every claim whose text is unchanged, the status, type,
// evidence and notes carry over, matched by guide and text first and by ID second, because IDs are
// positional and move when a sentence is inserted above them. A claim whose text changed goes back
// to Unverified and keeps its old wording in previousText. The ID fallback is positional, so if a
// step gains a sentence and has another reworded in the same edit, previousText can land on the
// neighbouring claim. The status still resets correctly, which is what matters. Output uses stable
// key order and 2-space JSON, so two runs in a row are byte-identical.
//
// Usage:
//   node scripts/claims-extract.mjs                    extract, merge into the shards, write the aggregate
//   node scripts/claims-extract.mjs --aggregate-only   rebuild claims.json from the shards only
//   node scripts/claims-extract.mjs --lint [key ...]   validate shards (all by default); writes nothing
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { transformGuide } from '../src/transform-export.mjs';
import { loadRelease, statusOf } from '../src/release.mjs';

const ROOT = join(import.meta.dirname, '..');
const EXPORT = join(ROOT, 'Learn Spatial Adjust.dc.html');
const CLAIMS_DIR = join(ROOT, 'docs', 'claims');
const SHARD_DIR = join(CLAIMS_DIR, 'guides');
const AGGREGATE = join(CLAIMS_DIR, 'claims.json');
const SOURCES = join(CLAIMS_DIR, 'sources.json');

// Verified (beta) means develop and the beta environment do what the claim says. It is valid only
// on content src/release.json marks beta, and it needs a develop citation at the pinned SHA. Any
// check that treats Verified as passing must treat Verified (beta) as passing too.
export const VERIFIED_BETA = 'Verified (beta)';
export const STATUSES = ['Unverified', 'Verified', VERIFIED_BETA, 'Wrong', 'Not shipping', 'Needs expert'];
export const TYPES = ['label', 'navigation', 'behaviour', 'calculation', 'prerequisite'];

// Named buckets, in reading order. Steps sit between `before` and `verify`. `note` is the guide's
// note callout ("New in IntelliDash." on the four Target Profiles guides, "Note." elsewhere). It
// is published prose that makes claims (the Target Profiles shipping notice),
// so it is extracted like any other field. The ID scheme in docs/claims/README.md lists it.
// `start` is a rewritten guide's start state ({ page, open, needs }), which the page shows first
// under Before you start, above the `before` list (docs/writing-guide.md > Start state).
const LEADING = ['tile', 'summary', 'where', 'note', 'start', 'before'];
const TRAILING = ['verify'];
const FIELDS_BY_BUCKET = {
  tile: ['title', 'summary'],
  summary: ['summary'],
  where: ['where'],
  note: ['note'],
  start: ['page', 'open', 'needs'],
  before: ['before'],
  verify: ['verify'],
  // A rewritten step's do / see / ifNot / why replace its body, and read in this order.
  step: ['title', 'do', 'see', 'ifNot', 'why', 'body', 'caption', 'tip'],
};
const CLAIM_KEYS = ['id', 'guide', 'step', 'field', 'text', 'type', 'status', 'evidence',
  'note', 'question', 'developNote', 'correction', 'previousText'];
const REQUIRED_KEYS = CLAIM_KEYS.filter((k) => k !== 'previousText');
const CARRIED = ['type', 'status', 'evidence', 'note', 'question', 'developNote', 'correction', 'previousText'];
const EVIDENCE_KEYS = ['source', 'ref', 'sha', 'path', 'line'];

// ---- evaluating the export ----------------------------------------------------------------------

/** Index just past the bracket that closes the one at `open`, skipping strings and comments. */
function matchBracket(src, open) {
  const pairs = { '[': ']', '{': '}', '(': ')' };
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ']' || c === '}' || c === ')') {
      if (stack.pop() !== c) throw new Error(`unbalanced ${c} at offset ${i}`);
      if (!stack.length) return i + 1;
    }
  }
  throw new Error('unterminated bracket in the guide data block');
}

const once = (hay, needle, what) => {
  const at = hay.indexOf(needle);
  if (at < 0 || hay.indexOf(needle, at + 1) >= 0) {
    throw new Error(`expected exactly one ${what} (${JSON.stringify(needle)}) in the export's guide script`);
  }
  return at;
};

/**
 * Evaluate the published guide data. Returns plain JSON-safe copies of GUIDES, TARGETS and
 * CATEGORIES, plus `keys` (every guide key, in catalogue order) and `tiles` (key -> tile).
 * Always the shown-mode text: beta content is included whatever SA_SHOW_BETA says.
 */
export function extractGuides({ html } = {}) {
  const page = transformGuide(html ?? readFileSync(EXPORT, 'utf8'), { showBeta: true });
  const scripts = [...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]).filter((body) => body.includes('const GUIDES = {'));
  if (scripts.length !== 1) throw new Error(`expected one inline script holding GUIDES, found ${scripts.length}`);
  const script = scripts[0];

  const start = once(script, 'const P = {', 'P declaration');
  const catAt = once(script, 'const CATEGORIES = [', 'CATEGORIES declaration');
  let end = matchBracket(script, catAt + 'const CATEGORIES = '.length);
  if (script[end] === ';') end++;
  const block = script.slice(start, end);

  // The block references a few helpers declared above `const P`. Stub only those it uses.
  // cell() builds cursor coordinates for TARGETS, which the ledger does not read.
  const sandbox = { cell: (column, row) => ['cell', column, row] };
  const out = vm.runInNewContext(`${block}\n;({ GUIDES, TARGETS, CATEGORIES })`, sandbox,
    { filename: 'Learn Spatial Adjust.dc.html#guide-data', timeout: 5000 });
  const data = JSON.parse(JSON.stringify(out));

  const tiles = {};
  const keys = [];
  for (const category of data.CATEGORIES) {
    for (const task of category.tasks) {
      if (tiles[task.key]) throw new Error(`catalogue lists ${task.key} twice`);
      tiles[task.key] = task;
      keys.push(task.key);
    }
  }
  const missingTile = Object.keys(data.GUIDES).filter((k) => !tiles[k]);
  const missingGuide = keys.filter((k) => !data.GUIDES[k]);
  if (missingTile.length || missingGuide.length) {
    throw new Error(`guides without a tile: ${missingTile.join(', ') || 'none'}; `
      + `tiles without a guide: ${missingGuide.join(', ') || 'none'}`);
  }
  return { guides: data.GUIDES, targets: data.TARGETS, categories: data.CATEGORIES, tiles, keys };
}

// ---- claims -------------------------------------------------------------------------------------

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// The segmenter breaks after an abbreviation that a capital follows, so the Lynx label
// "Pct. Adjust" (push-to-lynx, Before you start) would become two claims. A segment ending in one
// of these is joined to the next. "Avg." is not listed, though dashboard-overview/4/6 splits on it:
// adding it would renumber claims that are already verified.
const JOIN_AFTER = /(?:^|\s)Pct\.$/;
// A [[Label]] marker is one control name, so a stop inside it ("[[Avg. VWC]]", "[[Use Target
// Profile?]]") never ends a sentence. Only rewritten step fields carry markers, so no claim that
// is already verified is renumbered.
const OPEN_MARKER = /\[\[(?:(?!\]\]).)*$/s;
export const sentences = (text) => {
  const out = [];
  for (const { segment } of segmenter.segment(clean(text))) {
    const s = segment.trim();
    if (!s) continue;
    const last = out[out.length - 1];
    // The segmenter also stops after a marker that ends in "?" or "." ("[[Use Target Profile?]]"),
    // and a sentence never starts with a lower-case letter.
    if (last && (JOIN_AFTER.test(last) || OPEN_MARKER.test(last) || (/\]\]$/.test(last) && /^\p{Ll}/u.test(s)))) out[out.length - 1] += ` ${s}`;
    else out.push(s);
  }
  return out;
};

/** Heuristic first guess at a claim's type. The first rule that matches wins; verifiers may change it. */
// Product and brand names are Title Case but are not control labels.
const PRODUCT_NAMES = /\b(?:Spatial Adjust|IntelliDash|TurfRad|Lynx(?: Cloud)?|Toro|Core Design)\b/g;

export function classify(text, bucket) {
  if (/\b(open|opens|opening|click|clicks|clicking|select|selects|selecting|choose|chooses)\b|›/i.test(text)) return 'navigation';
  const named = text.replace(PRODUCT_NAMES, 'product');
  if (/[“"‘][^”"’]{2,}[”"’]/.test(named) || /\s[A-Z][\w%.]*(?:\s+(?:of|to|by|from|in|per|and|&)?\s*[A-Z][\w%.]*)+/.test(named)) return 'label';
  if (/%|×|÷|\bamounts?\b|coefficient|\baverage/i.test(text)) return 'calculation';
  if (bucket === 'before' || /\b(must|needs?)\b/i.test(text)) return 'prerequisite';
  return 'behaviour';
}

const blank = () => ({ evidence: [], note: '', question: '', developNote: '', correction: '' });

/** Every claim for one guide, in reading order, before any merge with an existing shard. */
export function claimsForGuide(key, guide, tile) {
  const claims = [];
  const bucketOf = (step) => (/^\d+$/.test(step) ? 'step' : step);
  const add = (step, field, texts) => {
    for (const text of texts) {
      const n = claims.filter((c) => c.step === step).length + 1;
      claims.push({ id: `${key}/${step}/${n}`, guide: key, step, field, text,
        type: classify(text, bucketOf(step)), status: 'Unverified', ...blank() });
    }
  };
  const whole = (t) => (clean(t) ? [clean(t)] : []);
  const list = (items) => (items || []).flatMap(sentences);

  add('tile', 'title', whole(tile.title));
  add('tile', 'summary', sentences(tile.summary));
  add('summary', 'summary', sentences(guide.summary));
  add('where', 'where', whole(guide.where));
  add('note', 'note', sentences(guide.note));
  for (const f of FIELDS_BY_BUCKET.start) add('start', f, sentences(guide.start?.[f]));
  add('before', 'before', list(guide.before));
  (guide.steps || []).forEach((st, i) => {
    const step = String(i + 1);
    add(step, 'title', whole(st.title));
    // The step shape (docs/writing-guide.md). The [[ ]] label markers are kept: the claim is the
    // text as the guide data holds it, and the label gate matches labels inside it.
    for (const f of ['do', 'see', 'ifNot', 'why']) add(step, f, sentences(st[f]));
    add(step, 'body', sentences(st.body));
    add(step, 'caption', sentences(st.caption));
    // The tip and its label render as one callout. The label never stands alone as a claim; it
    // leads the callout's first sentence.
    const tip = sentences(st.tip);
    const label = clean(st.tipLabel);
    if (label && tip.length) tip[0] = `${label} ${tip[0]}`;
    else if (label) tip.push(label);
    add(step, 'tip', tip);
  });
  add('verify', 'verify', list(guide.verify));
  return claims;
}

/** Collation for claim IDs: reading order of buckets, then numeric step, then numeric n. */
function rank(step) {
  if (LEADING.includes(step)) return [LEADING.indexOf(step), 0];
  if (/^\d+$/.test(step)) return [LEADING.length, Number(step)];
  const t = TRAILING.indexOf(step);
  return [t < 0 ? 99 : LEADING.length + 1 + t, 0];
}
export function compareIds(a, b) {
  const [, sa, na] = a.split('/');
  const [, sb, nb] = b.split('/');
  const [ra, xa] = rank(sa);
  const [rb, xb] = rank(sb);
  return ra - rb || xa - xb || Number(na) - Number(nb);
}

/** Fold verification work from an existing shard into freshly extracted claims. */
export function mergeClaims(fresh, previous = []) {
  const byText = new Map();
  for (const old of previous) {
    const k = `${old.guide}\u0000${old.text}`;
    if (!byText.has(k)) byText.set(k, []);
    byText.get(k).push(old);
  }
  const byId = new Map(previous.map((c) => [c.id, c]));
  const used = new Set();
  const stats = { carried: 0, reset: 0, dropped: [] };

  // Two passes, so an ID match can never take an old claim that some other fresh claim matches by
  // text. Inserting a sentence shifts every ID after it; matching by text first is what lets the
  // shifted sentences keep their status.
  const merged = fresh.map((claim) => {
    const sameText = (byText.get(`${claim.guide}\u0000${claim.text}`) || []).find((c) => !used.has(c));
    if (!sameText) return null;
    used.add(sameText);
    stats.carried++;
    const out = { ...claim };
    for (const f of CARRIED) if (sameText[f] !== undefined) out[f] = sameText[f];
    return out;
  });
  fresh.forEach((claim, i) => {
    if (merged[i]) return;
    const sameId = byId.get(claim.id);
    if (sameId && !used.has(sameId)) {
      used.add(sameId);
      stats.reset++;
      merged[i] = { ...claim, previousText: sameId.text };
    } else {
      merged[i] = claim;
    }
  });
  for (const old of previous) {
    if (!used.has(old) && old.status !== 'Unverified') stats.dropped.push(`${old.id} (${old.status})`);
  }
  return { claims: merged.sort((a, b) => compareIds(a.id, b.id)), stats };
}

// ---- writing ------------------------------------------------------------------------------------

const normEvidence = (e) => {
  const out = {};
  for (const k of EVIDENCE_KEYS) if (e[k] !== undefined) out[k] = e[k];
  for (const k of Object.keys(e).sort()) if (!(k in out)) out[k] = e[k];
  return out;
};
const normClaim = (c) => {
  const out = {};
  for (const k of CLAIM_KEYS) {
    if (k === 'previousText' && c.previousText === undefined) continue;
    out[k] = k === 'evidence' ? (c.evidence || []).map(normEvidence) : c[k];
  }
  for (const k of Object.keys(c).sort()) if (!(k in out)) out[k] = c[k];
  return out;
};
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
const writeIfChanged = (file, text) => {
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return false;
  writeFileSync(file, text);
  return true;
};
const shardPath = (key) => join(SHARD_DIR, `${key}.json`);
const readShard = (key) => JSON.parse(readFileSync(shardPath(key), 'utf8'));
const shardKeys = () => (existsSync(SHARD_DIR)
  ? readdirSync(SHARD_DIR).filter((f) => f.endsWith('.json')).map((f) => basename(f, '.json')).sort()
  : []);
const readSources = () => JSON.parse(readFileSync(SOURCES, 'utf8'));

/** Rebuild docs/claims/claims.json from the shards on disk. Shards are read in key order. */
export function aggregate() {
  const keys = shardKeys();
  const claims = keys.flatMap((k) => readShard(k).claims.map(normClaim));
  const count = (field, values) => {
    const out = Object.fromEntries(values.map((v) => [v, 0]));
    for (const c of claims) out[c[field]] = (out[c[field]] ?? 0) + 1;
    return out;
  };
  const { intellidash, fetchedAt } = readSources();
  const meta = {
    description: 'Canonical claims ledger, aggregated from docs/claims/guides/*.json by scripts/claims-extract.mjs. Edit the shards, not this file.',
    intellidash: {
      develop: { ref: intellidash.develop.ref, sha: intellidash.develop.sha, date: intellidash.develop.date },
      production: { ref: intellidash.production.ref, sha: intellidash.production.sha,
        date: intellidash.production.date, confirmed: intellidash.production.confirmed },
      fetchedAt,
    },
    guides: keys.length,
    claims: claims.length,
    byStatus: count('status', STATUSES),
    byType: count('type', TYPES),
  };
  const changed = writeIfChanged(AGGREGATE, json({ _meta: meta, claims }));
  return { meta, changed };
}

/** Extract every guide, merge into its shard, write the shards and the aggregate. */
export function extractAll() {
  const { guides, tiles, keys } = extractGuides();
  mkdirSync(SHARD_DIR, { recursive: true });
  const report = [];
  for (const key of keys) {
    if (guides[key].title !== tiles[key].title) {
      console.warn(`warning: ${key} guide title "${guides[key].title}" differs from its tile title; only the tile title is extracted`);
    }
    const previous = existsSync(shardPath(key)) ? readShard(key).claims : [];
    const { claims, stats } = mergeClaims(claimsForGuide(key, guides[key], tiles[key]), previous);
    const shard = { guide: key, title: tiles[key].title, claims: claims.map(normClaim) };
    const changed = writeIfChanged(shardPath(key), json(shard));
    report.push({ key, claims: claims.length, steps: (guides[key].steps || []).length, changed, ...stats });
  }
  const stale = shardKeys().filter((k) => !keys.includes(k));
  if (stale.length) throw new Error(`shards with no matching guide: ${stale.join(', ')}. Remove them deliberately.`);
  return { report, aggregate: aggregate() };
}

// ---- lint ---------------------------------------------------------------------------------------

const SHA = /^[0-9a-f]{40}$/;
const STEP = /^(?:tile|summary|where|note|start|before|verify|[1-9]\d*)$/;

/**
 * Where beta content is, for the Verified (beta) rule. `release` defaults to src/release.json, read
 * through src/release.mjs so SA_RELEASE_FILE applies. `guides` defaults to the shown-mode GUIDES
 * from extractGuides(), which is what the claims' step numbers count. Both load on first use, and
 * the guides only when a numbered step of a GA guide that has beta sections needs its title, so a
 * ledger with no Verified (beta) claim costs nothing extra to lint.
 *
 * releaseOf(key, step) returns { status: 'ga' | 'beta', title? } for the content a claim sits in:
 * a beta guide is beta throughout; in a GA guide, tile, summary, where, note, before and verify
 * are GA, and a numbered step takes the status of the section whose steps name its shown-mode
 * title. It returns { error } when the claim cannot be placed.
 */
export function releaseContext({ release, guides } = {}) {
  let rel = release;
  let gs = guides;
  const getRelease = () => (rel ??= loadRelease().release);
  const getGuides = () => (gs ??= extractGuides().guides);
  return {
    releaseOf(key, step) {
      const entry = getRelease()?.guides?.[key];
      if (!entry || typeof entry !== 'object') return { error: `guide "${key}" has no entry in the release file` };
      if (entry.status === 'beta') return { status: 'beta' };
      if (!/^\d+$/.test(step ?? '')) return { status: entry.status };
      if (!(entry.sections || []).some((s) => s && s.status === 'beta')) return { status: entry.status };
      const title = getGuides()[key]?.steps?.[Number(step) - 1]?.title;
      if (typeof title !== 'string') return { error: `step ${step} is not a step of the published guide "${key}"` };
      return { status: statusOf(rel, key, title), title };
    },
  };
}

/**
 * Validate one shard object. Returns a list of error strings; empty means valid. `context` is a
 * releaseContext(); pass one to share the loaded release file and guides across shards.
 */
export function lintShard(key, shard, sources = readSources(), context = releaseContext()) {
  const errors = [];
  const err = (where, msg) => errors.push(`${key}${where ? ` ${where}` : ''}: ${msg}`);
  if (!shard || typeof shard !== 'object' || Array.isArray(shard)) return [`${key}: shard is not an object`];
  for (const k of Object.keys(shard)) if (!['guide', 'title', 'claims'].includes(k)) err('', `unknown top-level key "${k}"`);
  if (shard.guide !== key) err('', `guide is "${shard.guide}", expected "${key}" (the file name)`);
  if (typeof shard.title !== 'string' || !shard.title) err('', 'title must be a non-empty string');
  if (!Array.isArray(shard.claims) || !shard.claims.length) return [...errors, `${key}: claims must be a non-empty array`];

  const pins = { production: sources.intellidash.production.sha, develop: sources.intellidash.develop.sha };
  const seen = new Set();
  shard.claims.forEach((c, i) => {
    const at = `claim[${i}]${c && c.id ? ` ${c.id}` : ''}`;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return err(at, 'not an object');
    for (const k of Object.keys(c)) if (!CLAIM_KEYS.includes(k)) err(at, `unknown key "${k}"`);
    for (const k of REQUIRED_KEYS) if (!(k in c)) err(at, `missing "${k}"`);
    for (const k of ['id', 'guide', 'step', 'field', 'text', 'type', 'status', 'note', 'question', 'developNote', 'correction']) {
      if (k in c && typeof c[k] !== 'string') err(at, `"${k}" must be a string`);
    }
    if ('previousText' in c && typeof c.previousText !== 'string') err(at, '"previousText" must be a string');
    if (c.guide !== key) err(at, `guide is "${c.guide}", expected "${key}"`);
    if (!STEP.test(c.step ?? '')) err(at, `step "${c.step}" is not a step number or one of tile, summary, where, note, start, before, verify`);
    const m = /^([^/]+)\/([^/]+)\/([1-9]\d*)$/.exec(c.id ?? '');
    if (!m || m[1] !== key || m[2] !== c.step) err(at, `id must be "${key}/${c.step}/<n>"`);
    if (seen.has(c.id)) err(at, 'duplicate id');
    seen.add(c.id);
    const allowed = FIELDS_BY_BUCKET[/^\d+$/.test(c.step) ? 'step' : c.step] || [];
    if (!allowed.includes(c.field)) err(at, `field "${c.field}" is not valid for step "${c.step}"`);
    if (typeof c.text === 'string' && !c.text.trim()) err(at, 'text is empty');
    if (!STATUSES.includes(c.status)) err(at, `status "${c.status}" is not one of ${STATUSES.join(', ')}`);
    if (!TYPES.includes(c.type)) err(at, `type "${c.type}" is not one of ${TYPES.join(', ')}`);
    if (!Array.isArray(c.evidence)) err(at, 'evidence must be an array');
    else {
      c.evidence.forEach((e, j) => {
        const ew = `${at} evidence[${j}]`;
        if (!e || typeof e !== 'object' || Array.isArray(e)) return err(ew, 'not an object');
        for (const k of Object.keys(e)) if (!EVIDENCE_KEYS.includes(k)) err(ew, `unknown key "${k}"`);
        if (e.source === 'intellidash') {
          if (!(e.ref === 'production' || e.ref === 'develop' || /^branch:\S+$/.test(e.ref ?? ''))) {
            err(ew, 'ref must be production, develop or branch:<name>');
          }
          if (!SHA.test(e.sha ?? '')) err(ew, 'sha must be a full 40-character SHA');
          else if (pins[e.ref] && e.sha !== pins[e.ref]) err(ew, `sha does not match the ${e.ref} SHA in docs/claims/sources.json`);
          if (typeof e.path !== 'string' || !e.path || e.path.startsWith('/')) err(ew, 'path must be a repository-relative path');
          if (!(Number.isInteger(e.line) && e.line > 0) && !/^[1-9]\d*(?:-[1-9]\d*)?$/.test(String(e.line ?? ''))) {
            err(ew, 'line must be a positive integer or a "start-end" range');
          }
        } else if (e.source === 'doc') {
          if (typeof e.ref !== 'string' || !e.ref.trim()) err(ew, 'doc evidence needs a ref such as "373-1135 rev 02 §x"');
          for (const k of ['sha', 'path', 'line']) if (k in e) err(ew, `doc evidence does not take "${k}"`);
        } else {
          err(ew, 'source must be "intellidash" or "doc"');
        }
      });
    }
    const evidence = Array.isArray(c.evidence) ? c.evidence.length : 0;
    if (['Verified', VERIFIED_BETA, 'Wrong', 'Not shipping'].includes(c.status) && !evidence) err(at, `${c.status} needs at least one citation`);
    if (c.status === 'Wrong' && !String(c.correction ?? '').trim()) err(at, 'Wrong needs a proposed correction');
    if (c.status === 'Needs expert' && !String(c.question ?? '').trim()) err(at, 'Needs expert needs a question');
    if (c.status === VERIFIED_BETA) {
      const atDevelop = (Array.isArray(c.evidence) ? c.evidence : []).some((e) => e && e.source === 'intellidash'
        && e.ref === 'develop' && e.sha === pins.develop);
      if (!atDevelop) err(at, `${VERIFIED_BETA} needs a develop citation at the pinned develop SHA ${pins.develop}`);
      let placed;
      try { placed = context.releaseOf(key, c.step); } catch (e) { placed = { error: e.message }; }
      if (placed.error) err(at, `${VERIFIED_BETA} cannot be checked against the release file: ${placed.error}`);
      else if (placed.status !== 'beta') {
        const what = /^\d+$/.test(c.step)
          ? `step ${c.step}${placed.title ? ` ("${placed.title}")` : ''} of GA guide "${key}" is not in a beta section`
          : `the ${c.step} of guide "${key}" is GA`;
        err(at, `${VERIFIED_BETA} is only valid on content src/release.json marks beta, but ${what}. `
          + 'Cite production and mark it Verified, or record the content as beta in src/release.json');
      }
    }
  });
  for (let i = 1; i < shard.claims.length; i++) {
    const a = shard.claims[i - 1]?.id;
    const b = shard.claims[i]?.id;
    if (typeof a === 'string' && typeof b === 'string' && compareIds(a, b) > 0) {
      err('', `claims are not sorted by id (${a} comes before ${b})`);
      break;
    }
  }
  return errors;
}

/** Lint the named shards, or all shards. Returns the error list. */
export function lint(keys = []) {
  const targets = keys.length ? keys : shardKeys();
  if (!targets.length) return ['no shards found in docs/claims/guides/'];
  const sources = readSources();
  const context = releaseContext();
  const errors = [];
  for (const key of targets) {
    if (!existsSync(shardPath(key))) { errors.push(`${key}: no shard at docs/claims/guides/${key}.json`); continue; }
    let shard;
    try { shard = readShard(key); } catch (e) { errors.push(`${key}: does not parse as JSON (${e.message})`); continue; }
    errors.push(...lintShard(key, shard, sources, context));
  }
  return errors;
}

// ---- CLI ----------------------------------------------------------------------------------------

function main(argv) {
  if (argv.includes('--lint')) {
    const keys = argv.filter((a) => !a.startsWith('--'));
    const errors = lint(keys);
    for (const e of errors) console.error(e);
    const n = keys.length || shardKeys().length;
    console.log(errors.length ? `lint: ${errors.length} error(s)` : `lint: ${n} shard(s) OK`);
    return errors.length ? 1 : 0;
  }
  if (argv.includes('--aggregate-only')) {
    const errors = lint();
    if (errors.length) { for (const e of errors) console.error(e); console.error('aggregate not written: fix the shards first'); return 1; }
    const { meta, changed } = aggregate();
    console.log(`claims.json ${changed ? 'written' : 'unchanged'}: ${meta.guides} guides, ${meta.claims} claims`);
    return 0;
  }
  const unknown = argv.filter((a) => a.startsWith('--'));
  if (unknown.length) { console.error(`unknown option(s): ${unknown.join(' ')}`); return 2; }

  const { report, aggregate: agg } = extractAll();
  const width = Math.max(...report.map((r) => r.key.length));
  for (const r of report) {
    const notes = [r.changed ? 'written' : 'unchanged'];
    if (r.reset) notes.push(`${r.reset} reset to Unverified (text changed)`);
    if (r.dropped.length) notes.push(`dropped with status: ${r.dropped.join(', ')}`);
    console.log(`${r.key.padEnd(width)}  ${String(r.claims).padStart(3)} claims  ${String(r.steps).padStart(2)} steps  ${notes.join('; ')}`);
  }
  const { meta } = agg;
  console.log(`\n${meta.guides} guides, ${meta.claims} claims; claims.json ${agg.changed ? 'written' : 'unchanged'}`);
  console.log(`byStatus ${JSON.stringify(meta.byStatus)}`);
  console.log(`byType   ${JSON.stringify(meta.byType)}`);
  const errors = lint();
  if (errors.length) { for (const e of errors) console.error(e); return 1; }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
