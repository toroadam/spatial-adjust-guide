// Checks every guide against the step standard in docs/writing-guide.md, reading the published
// guide data through scripts/lib/load-guides.mjs (no browser).
//
// Per guide, including any `<key>-part-N`:
//   (a) every step has non-empty string `do`, `see` and `ifNot`
//   (b) `do` contains at least one [[Exact Label]] marker, unless the step has `region: true`;
//       region steps are listed as warnings so each one stays a deliberate choice
//   (c) no step that has `do` still has `body`
//   (d) at most 8 steps
//   (e) `start` has non-empty `page`, `open` and `needs`
//   (f) TARGETS[key] exists and holds exactly one point per step. A missing point sends the
//       cursor to the step's own `t` or, failing that, to the [800, 500] default, which points
//       at nothing
//   (g) a `<key>-part-N` guide is the first entry in the `next` of the part before it
// It also rejects a malformed marker ("[[" without "]]", or an empty one) and an empty `why`.
//
// The glossary. src/terms.json holds the eight terms defined at their first use in each guide
// (docs/writing-guide.md > Why lines and the glossary). It is checked on every run, pending guides
// or not, because one file serves all 26 guides: a zod schema for its shape, then exactly the eight
// term ids, each once; match spellings that are unique, carry no [[ ]] marker and are whole words;
// a definition that is one sentence at Flesch-Kincaid grade 8 or below (scripts/readability.mjs);
// and ledger ids that are Verified claims in docs/claims/claims.json. Then firstTermUses(), the
// function the page runs, is checked against made-up guides: a [[label]] is not a use, matches are
// whole words, the acronyms are case-sensitive and a term is defined once. Any problem exits 1.
//
// The ratchet. A guide listed in PENDING (scripts/lib/rewrite-status.mjs) has not been rewritten
// yet: it is reported, never failed. The command exits 1 only when a guide that is not pending
// fails. checkShape() is exported so build.mjs can call it once every guide has landed.
//
// Usage:
//   node scripts/step-shape.mjs             per-guide table; exit 1 if a non-pending guide fails
//   node scripts/step-shape.mjs --verbose   also list the problems in pending guides
//   node scripts/step-shape.mjs --json      print the raw result instead of the table
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { loadGuides, partOf } from './lib/load-guides.mjs';
import { PENDING, isPending } from './lib/rewrite-status.mjs';
import { score, MAX_GRADE } from './readability.mjs';
import { firstTermUses } from '../src/transform-export.mjs';

export const MAX_STEPS = 8;
const SHAPE_FIELDS = ['do', 'see', 'ifNot'];
const START_FIELDS = ['page', 'open', 'needs'];
const MARKER = /\[\[([^[\]]+)\]\]/g;

const filled = (v) => typeof v === 'string' && v.trim() !== '';

/** Problems with the [[ ]] markers in one string. */
function markerProblems(text) {
  if (typeof text !== 'string') return [];
  const out = [];
  const opens = text.split('[[').length - 1;
  const closes = text.split(']]').length - 1;
  if (opens !== closes) out.push(`unbalanced [[ ]] (${opens} open, ${closes} close)`);
  if (/\[\[\s*\]\]/.test(text)) out.push('empty [[ ]] marker');
  return out;
}

/** Checks one guide. Returns { errors, warnings } as strings, each naming its step. */
export function checkGuide(key, guide, data) {
  const errors = [];
  const warnings = [];
  const steps = Array.isArray(guide.steps) ? guide.steps : [];

  if (!steps.length) errors.push('no steps');
  if (steps.length > MAX_STEPS) {
    errors.push(`${steps.length} steps, more than ${MAX_STEPS}: split into ${key}-part-2 (docs/writing-guide.md > Length and parts)`);
  }

  steps.forEach((step, i) => {
    const at = `step ${i + 1}`;
    for (const f of SHAPE_FIELDS) if (!filled(step[f])) errors.push(`${at}: missing ${f}`);
    if (filled(step.do) && step.region !== true && !step.do.match(MARKER)) {
      errors.push(`${at}: do names no [[Exact Label]] (set region: true only if it names a screen region)`);
    }
    if (step.region === true) warnings.push(`${at}: region step, no label marker required`);
    if ('do' in step && 'body' in step) errors.push(`${at}: has do and still has body`);
    if ('why' in step && !filled(step.why)) errors.push(`${at}: why is present but empty`);
    for (const f of [...SHAPE_FIELDS, 'why']) {
      for (const p of markerProblems(step[f])) errors.push(`${at}: ${f} has an ${p}`);
    }
  });

  const start = guide.start;
  if (!start || typeof start !== 'object') errors.push('no start { page, open, needs }');
  else for (const f of START_FIELDS) if (!filled(start[f])) errors.push(`start.${f} is missing or empty`);

  const targets = data.TARGETS[key];
  if (!Array.isArray(targets)) {
    errors.push(`TARGETS['${key}'] is missing: every step falls back to its own t or [800, 500]`);
  } else if (targets.length !== steps.length) {
    let detail;
    if (targets.length > steps.length) {
      detail = `${targets.length - steps.length} point(s) beyond the last step`;
    } else {
      detail = steps.slice(targets.length).map((s, j) => {
        const n = targets.length + j + 1;
        return Array.isArray(s.t) ? `step ${n} uses its own t` : `step ${n} falls back to [800, 500]`;
      }).join(', ');
    }
    errors.push(`TARGETS['${key}'] has ${targets.length} point(s) for ${steps.length} step(s): ${detail}`);
  }

  const part = partOf(key);
  if (part) {
    const prev = part.n === 2 ? part.base : `${part.base}-part-${part.n - 1}`;
    const prevGuide = data.GUIDES[prev];
    if (!prevGuide) errors.push(`continues ${prev}, which does not exist`);
    else if (!Array.isArray(prevGuide.next) || prevGuide.next[0] !== key) {
      errors.push(`is not first in ${prev}.next (found ${JSON.stringify((prevGuide.next || [])[0] ?? null)})`);
    }
  }
  return { errors, warnings };
}

/**
 * Checks every guide in `data` (as returned by loadGuides). A guide in `pending` is reported but
 * cannot fail. Returns { guides: [...], failed: [...keys], counts }.
 */
export function checkShape(data, { pending = new Set() } = {}) {
  const keys = data.keys || Object.keys(data.GUIDES);
  const guides = keys.map((key) => {
    const guide = data.GUIDES[key];
    const { errors, warnings } = checkGuide(key, guide, data);
    const isPend = isPending(key, pending);
    const status = isPend ? 'PENDING' : errors.length ? 'FAIL' : 'OK';
    const steps = Array.isArray(guide.steps) ? guide.steps.length : 0;
    const targets = Array.isArray(data.TARGETS[key]) ? data.TARGETS[key].length : null;
    return { key, status, steps, targets, errors, warnings };
  });
  const unknownPending = [...pending].filter((k) => !data.GUIDES[k]);
  const failed = guides.filter((g) => g.status === 'FAIL').map((g) => g.key);
  const counts = {
    guides: guides.length,
    ok: guides.filter((g) => g.status === 'OK').length,
    fail: failed.length,
    pending: guides.filter((g) => g.status === 'PENDING').length,
    pendingWithProblems: guides.filter((g) => g.status === 'PENDING' && g.errors.length).length,
    targetMismatches: guides.filter((g) => g.targets !== g.steps).length,
    regionSteps: guides.reduce((n, g) => n + g.warnings.filter((w) => w.includes('region step')).length, 0),
  };
  return { guides, failed, unknownPending, counts };
}

// --- the glossary: src/terms.json ------------------------------------------------------------------

export const TERMS_FILE = join('src', 'terms.json');
export const CLAIMS_FILE = join('docs', 'claims', 'claims.json');
/** The eight terms, by id. Adding or dropping one is a change to docs/writing-guide.md too. */
export const TERM_IDS = ['vwc', 'et', 'delta', 'lynx-reference-amount', 'aggregate-row', 'measured', 'modelled', 'target'];

const nonEmpty = z.string().refine((v) => v.trim() !== '' && v === v.trim(), 'must be non-empty with no leading or trailing space');
const TermSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+(-[a-z]+)*$/, 'must be lower-case words joined by hyphens'),
  term: nonEmpty,
  match: z.array(nonEmpty).min(1),
  caseSensitive: z.boolean(),
  definition: nonEmpty,
  ledger: z.array(nonEmpty).min(1),
});
export const TermsFileSchema = z.strictObject({
  _meta: z.strictObject({ note: nonEmpty }),
  terms: z.array(TermSchema),
});

/**
 * Checks the glossary file. `file` is the parsed src/terms.json and `claims` the claims array of
 * docs/claims/claims.json. Returns a list of problems, empty when the file is sound.
 */
export function checkTerms(file, claims) {
  const parsed = TermsFileSchema.safeParse(file);
  if (!parsed.success) return z.prettifyError(parsed.error).split('\n').filter((l) => l.trim());
  const errors = [];
  const { terms } = parsed.data;

  const ids = terms.map((t) => t.id);
  for (const id of TERM_IDS) {
    const n = ids.filter((x) => x === id).length;
    if (n !== 1) errors.push(`term "${id}" appears ${n} times; it must appear exactly once`);
  }
  for (const id of new Set(ids)) if (!TERM_IDS.includes(id)) errors.push(`"${id}" is not one of the eight terms (${TERM_IDS.join(', ')})`);

  const status = new Map((claims || []).map((c) => [c.id, c.status]));
  const spellings = new Map();
  for (const t of terms) {
    const at = `term "${t.id}"`;
    for (const m of t.match) {
      // Whole words only: letters, digits and single spaces, so a match can never run into a
      // [[label]] marker or across punctuation.
      if (!/^[\p{L}\p{N}]+( [\p{L}\p{N}]+)*$/u.test(m)) errors.push(`${at}: match "${m}" is not plain whole words`);
      const k = m.toLowerCase();
      if (spellings.has(k)) errors.push(`${at}: match "${m}" is also a match of "${spellings.get(k)}"`);
      else spellings.set(k, t.id);
    }
    const same = (a, b) => (t.caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase());
    if (!t.match.some((m) => same(m, t.term))) errors.push(`${at}: the term "${t.term}" is not one of its own match spellings`);

    if (/\[\[|\]\]/.test(t.definition) || /\[\[|\]\]/.test(t.term)) {
      errors.push(`${at}: the term and definition are plain text and take no [[ ]] marker`);
    }
    const s = score(t.definition);
    if (s.sentences !== 1 || !/[.!?]$/.test(t.definition)) errors.push(`${at}: the definition must be one sentence ending in a full stop (found ${s.sentences})`);
    if (s.grade !== null && s.grade > MAX_GRADE) {
      errors.push(`${at}: the definition scores grade ${s.grade.toFixed(1)}, above ${MAX_GRADE} (scripts/readability.mjs)`);
    }
    for (const id of t.ledger) {
      if (!status.has(id)) errors.push(`${at}: ledger "${id}" is not a claim in ${CLAIMS_FILE}`);
      else if (status.get(id) !== 'Verified') errors.push(`${at}: ledger "${id}" is ${status.get(id)}, not Verified`);
    }
  }
  return errors;
}

/**
 * Checks firstTermUses() (src/transform-export.mjs, the function the page runs) against small
 * made-up guides: a term inside a [[label]] marker is not a use, a match is a whole word, the
 * acronyms are case-sensitive, a term is defined once, and start and before come first.
 */
export function checkFirstUse(terms) {
  const errors = [];
  const by = (id) => terms.find((t) => t.id === id);
  if (!by('target') || !by('vwc') || !by('et')) return errors; // checkTerms() already reports it
  const names = (l) => l.map((x) => x.term).join(', ');
  const cases = [
    {
      what: 'a label marker is not a use',
      guide: { steps: [{ do: 'Select [[Target VWC]] in the table.' }, { see: 'The target you set shows in the row.' }] },
      start: '', steps: ['', by('target').term],
    },
    {
      what: 'whole words only, and the acronyms are case-sensitive',
      guide: { steps: [{ body: 'Let the targeted ETA settle; the vwc and et columns stay.' }, { body: 'Today’s ET and the VWC.' }] },
      start: '', steps: ['', `${by('et').term}, ${by('vwc').term}`],
    },
    {
      what: 'start and before come first, and a term is defined once',
      guide: { start: { page: 'The dashboard.', open: 'No dialog open.', needs: 'A VWC scan.' }, before: ['Set a target.'], steps: [{ do: 'Check the VWC and the target.' }] },
      start: `${by('vwc').term}, ${by('target').term}`, steps: [''],
    },
  ];
  for (const c of cases) {
    const got = firstTermUses(c.guide, terms);
    const want = { start: c.start, steps: c.steps };
    const have = { start: names(got.start), steps: got.steps.map(names) };
    if (JSON.stringify(have) !== JSON.stringify(want)) {
      errors.push(`first use: ${c.what}: expected ${JSON.stringify(want)}, found ${JSON.stringify(have)}`);
    }
  }
  return errors;
}

/** Reads src/terms.json and the claims ledger from `root` and checks them. */
export function checkTermsFile({ root = process.cwd() } = {}) {
  let file;
  try {
    file = JSON.parse(readFileSync(join(root, TERMS_FILE), 'utf8'));
  } catch (err) {
    return [`${TERMS_FILE} cannot be read as JSON: ${err.message}`];
  }
  const claims = JSON.parse(readFileSync(join(root, CLAIMS_FILE), 'utf8')).claims;
  const errors = checkTerms(file, claims);
  return errors.length ? errors : checkFirstUse(file.terms);
}

function printTable(result, { verbose }) {
  const rows = result.guides.map((g) => [
    g.key,
    String(g.steps),
    g.targets === null ? 'none' : `${g.targets}/${g.steps}${g.targets === g.steps ? '' : ' !'}`,
    g.status,
    String(g.errors.length),
    String(g.warnings.length),
  ]);
  const head = ['Guide', 'Steps', 'Targets', 'Status', 'Problems', 'Warnings'];
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => (i === 0 ? c.padEnd(width[i]) : c.padStart(width[i]))).join('  ');
  console.log(line(head));
  console.log(width.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));

  for (const g of result.guides) {
    const label = g.status === 'PENDING' ? 'pending' : 'FAIL';
    // A rewritten guide shows everything. A pending one shows only a TARGETS mismatch, because
    // that already misplaces the cursor on the live site, unless --verbose asks for the rest.
    const lines = g.status !== 'PENDING' || verbose
      ? [...g.errors.map((e) => `${label}: ${e}`), ...g.warnings.map((w) => `warning: ${w}`)]
      : g.errors.filter((e) => e.startsWith('TARGETS')).map((e) => `${label}: ${e}`);
    if (!lines.length) continue;
    console.log(`\n${g.key} (${g.status})`);
    for (const l of lines) console.log(`  ${l}`);
  }

  const c = result.counts;
  console.log(`\n${c.guides} guides: ${c.ok} OK, ${c.fail} FAIL, ${c.pending} PENDING `
    + `(${c.pendingWithProblems} not yet to the standard). TARGETS length differs from the step count in `
    + `${c.targetMismatches}. Region steps: ${c.regionSteps}.`);
  if (result.unknownPending.length) {
    console.log(`warning: PENDING lists keys that are not guides: ${result.unknownPending.join(', ')}`);
  }
  if (c.fail) {
    console.log(`\nFAIL: ${result.failed.join(', ')} ${c.fail === 1 ? 'is not pending and breaks' : 'are not pending and break'} `
      + 'the step standard (docs/writing-guide.md).');
  }
  else if (c.pending && !verbose) console.log('Pending guides are advisory. Run with --verbose to list their problems.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const result = checkShape(loadGuides(), { pending: PENDING });
  const termErrors = checkTermsFile();
  if (args.includes('--json')) console.log(JSON.stringify({ ...result, terms: termErrors }, null, 2));
  else {
    printTable(result, { verbose: args.includes('--verbose') });
    if (termErrors.length) {
      console.log(`\nFAIL: ${TERMS_FILE} has ${termErrors.length} problem(s):`);
      for (const e of termErrors) console.log(`  ${e}`);
    } else console.log(`\n${TERMS_FILE}: the eight terms are well formed.`);
  }
  process.exitCode = result.failed.length || termErrors.length ? 1 : 0;
}
