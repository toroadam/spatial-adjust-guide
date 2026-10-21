// Proposes a release status for every guide and section from the claims ledger, compares it with
// src/release.json, and reports where the two disagree. Advisory: it exits 0 unless --strict is
// given.
//
// Why. src/release.json records which guides and steps are GA and which are beta. The claims
// ledger records what each sentence was checked against. The two should tell the same story:
// content whose claims are Verified (beta), that is checked against develop, is beta, and content
// whose claims are checked against production is GA. This script reads both and says where they
// do not. It never writes anything.
//
// What it reads:
//   src/release.json         through src/release.mjs, so SA_RELEASE_FILE points it at a fixture
//   docs/claims/claims.json  the aggregated ledger (--ledger <file> reads another)
//   extractGuides()          the shown-mode guide text, for the step titles that place each
//                            numbered claim in a section (claim step numbers count beta steps)
//
// Units. One row per guide, in catalogue order, and one per section that src/release.json records
// for a GA guide. A beta guide's unit holds every claim in it. A GA guide's unit holds its tile,
// summary, where, note, before and verify claims and every step outside its recorded sections. A
// section's unit holds the claims of the steps it names.
//
// Proposal. A guide is proposed beta when one of its tile claims is Verified (beta). A beta guide
// also stays proposed beta while any of its claims is Verified (beta). A section is proposed beta
// when any claim in its steps is Verified (beta). Otherwise the proposal is ga, except that a beta
// unit with no verified claim at all is pending: nothing proposes either way yet.
//
// Disagreements:
//   (a) a ga unit holding any Verified (beta) claim: "GA content cites develop only"
//   (b) a beta unit with no Verified (beta) claim and at least one claim Verified with production
//       evidence: "marked beta but the evidence is production"
// A beta unit with neither a Verified (beta) claim nor a production-Verified one is pending, not a
// disagreement.
//
// Usage:
//   npm run release:status
//   node scripts/release-status.mjs [--ledger <claims.json>] [--strict] [--json]
//   node scripts/release-status.mjs --self-test
//
//   --strict      exit 1 when there is any disagreement
//   --json        print machine-readable output instead of the table
//   --ledger      read this ledger instead of docs/claims/claims.json
//   --self-test   run the rules on a crafted in-memory ledger and check both disagreement kinds
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractGuides, VERIFIED_BETA } from './claims-extract.mjs';
import { loadRelease, validateRelease } from '../src/release.mjs';

const ROOT = join(import.meta.dirname, '..');
const LEDGER = join(ROOT, 'docs', 'claims', 'claims.json');
const LIST_MAX = 5;

const isStep = (step) => /^\d+$/.test(step ?? '');
const isVerifiedBeta = (c) => c.status === VERIFIED_BETA;
const hasProductionEvidence = (c) => (c.evidence || []).some((e) => e && e.source === 'intellidash' && e.ref === 'production');
const isProductionVerified = (c) => c.status === 'Verified' && hasProductionEvidence(c);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "a/1/2, a/3/1 (step 3 "Title")", at most LIST_MAX IDs, then "and N more". */
function idList(claims, titleOf) {
  const shown = claims.slice(0, LIST_MAX).map((c) => {
    const title = isStep(c.step) ? titleOf(c.guide, c.step) : undefined;
    return title ? `${c.id} (step ${c.step} "${title}")` : c.id;
  });
  const more = claims.length - shown.length;
  return `${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

/**
 * Judge one unit. `tile` holds the tile claims for a guide unit and is undefined for a section.
 * Returns { proposed, verdict: 'agree' | 'disagree' | 'pending', kind?: 'a' | 'b', reason }.
 */
function judge({ recorded, claims, tile }, titleOf) {
  const vb = claims.filter(isVerifiedBeta);
  const prod = claims.filter(isProductionVerified);
  if (recorded === 'beta') {
    if (vb.length) {
      return { proposed: 'beta', verdict: 'agree', reason: `${vb.length} of ${plural(claims.length, 'claim')} Verified (beta)` };
    }
    if (prod.length) {
      return { proposed: 'ga', verdict: 'disagree', kind: 'b',
        reason: `marked beta but the evidence is production: ${idList(prod, titleOf)}` };
    }
    return { proposed: 'pending', verdict: 'pending',
      reason: `pending: none of its ${plural(claims.length, 'claim')} is Verified (beta) or Verified at production yet` };
  }
  const proposed = (tile ? tile.some(isVerifiedBeta) : vb.length > 0) ? 'beta' : 'ga';
  if (vb.length) {
    return { proposed, verdict: 'disagree', kind: 'a', reason: `GA content cites develop only: ${idList(vb, titleOf)}` };
  }
  return { proposed, verdict: 'agree', reason: `${plural(claims.length, 'claim')}, none Verified (beta)` };
}

/**
 * Propose a status for every unit and compare it with the release file. Pure: pass the parsed
 * release, the shown-mode GUIDES (key -> { steps: [{ title }] }), the catalogue order and the
 * ledger's claims. Returns { units, disagreements, pending, unplaced }.
 */
export function releaseStatus({ release, guides, keys = Object.keys(guides), claims }) {
  const byGuide = new Map(keys.map((k) => [k, []]));
  const unplaced = [];
  for (const c of claims) {
    if (byGuide.has(c.guide)) byGuide.get(c.guide).push(c);
    else unplaced.push(`${c.id}: guide "${c.guide}" is not in the catalogue`);
  }
  const titleOf = (key, step) => guides[key]?.steps?.[Number(step) - 1]?.title;

  const units = [];
  for (const key of keys) {
    const entry = release.guides?.[key];
    if (!entry) throw new Error(`the release file has no entry for guide "${key}"`);
    const mine = byGuide.get(key);
    const tile = mine.filter((c) => c.step === 'tile');
    if (entry.status === 'beta') {
      units.push({ unit: key, kind: 'guide', guide: key, section: null, recorded: 'beta', claims: mine, tile });
      continue;
    }
    // A GA guide: place each numbered claim in the recorded section that names its shown-mode title.
    const sections = (entry.sections || []).map((s) => ({ ...s, claims: [] }));
    const own = [];
    for (const c of mine) {
      if (!isStep(c.step)) { own.push(c); continue; }
      const title = titleOf(key, c.step);
      if (title === undefined) { unplaced.push(`${c.id}: step ${c.step} is not a step of the published guide`); own.push(c); continue; }
      const section = sections.find((s) => (s.steps || []).includes(title));
      (section ? section.claims : own).push(c);
    }
    units.push({ unit: key, kind: 'guide', guide: key, section: null, recorded: entry.status, claims: own, tile });
    for (const s of sections) {
      units.push({ unit: `${key} › ${s.id}`, kind: 'section', guide: key, section: s.id, recorded: s.status, claims: s.claims });
    }
  }

  const judged = units.map((u) => {
    const j = judge(u, titleOf);
    return {
      unit: u.unit, kind: u.kind, guide: u.guide, section: u.section, recorded: u.recorded, proposed: j.proposed,
      verdict: j.verdict, ...(j.kind ? { disagreement: j.kind } : {}), reason: j.reason,
      claims: u.claims.length,
      verifiedBeta: u.claims.filter(isVerifiedBeta).map((c) => c.id),
      productionVerified: u.claims.filter(isProductionVerified).length,
    };
  });
  return {
    units: judged,
    disagreements: judged.filter((u) => u.verdict === 'disagree').length,
    pending: judged.filter((u) => u.verdict === 'pending').length,
    unplaced,
  };
}

/** The exit code for a result: 0, or 1 under --strict when anything disagrees. */
export const exitCode = (result, { strict = false } = {}) => (strict && result.disagreements ? 1 : 0);

export const summaryLine = (result) => `release-status: ${plural(result.disagreements, 'disagreement')}, ${result.pending} pending`;

function table(result) {
  const head = ['unit', 'recorded', 'proposed', 'reason'];
  const rows = result.units.map((u) => [`${u.verdict === 'disagree' ? '! ' : '  '}${u.unit}`, u.recorded, u.proposed, u.reason]);
  const width = head.slice(0, 3).map((h, i) => Math.max(h.length + (i === 0 ? 2 : 0), ...rows.map((r) => r[i].length)));
  const line = (r) => r.slice(0, 3).map((v, i) => v.padEnd(width[i])).concat(r[3]).join('  ');
  return [line([`  ${head[0]}`, ...head.slice(1)]), line(width.map((w) => '-'.repeat(w)).concat('------')), ...rows.map(line)].join('\n');
}

// ---- self-test ----------------------------------------------------------------------------------

/** Run the rules on a crafted ledger and check every verdict. Returns a list of failures. */
export function selfTest() {
  const dev = { source: 'intellidash', ref: 'develop', sha: 'd'.repeat(40), path: 'site/x.ts', line: 1 };
  const prod = { source: 'intellidash', ref: 'production', sha: 'p'.repeat(40), path: 'site/x.ts', line: 1 };
  const doc = { source: 'doc', ref: '373-1135 rev 02 §1' };
  const steps = (...titles) => ({ steps: titles.map((title) => ({ title })) });
  const guides = {
    alpha: steps('A1', 'A2', 'A3'), bravo: steps('B1'), charlie: steps('C1'), delta: steps('D1'),
    echo: steps('E1'), foxtrot: steps('F1'), golf: steps('G1', 'G2'), hotel: steps('H1', 'H2'),
  };
  const release = { guides: {
    alpha: { status: 'ga', basis: 'test', sections: [
      { id: 'a2-beta', status: 'beta', basis: 'test', steps: ['A2'] },
      { id: 'a3-ga', status: 'ga', basis: 'test', steps: ['A3'] },
    ] },
    bravo: { status: 'beta', basis: 'test' },
    charlie: { status: 'beta', basis: 'test' },
    delta: { status: 'ga', basis: 'test' },
    echo: { status: 'beta', basis: 'test' },
    foxtrot: { status: 'ga', basis: 'test' },
    golf: { status: 'ga', basis: 'test', sections: [{ id: 'g2-beta', status: 'beta', basis: 'test', steps: ['G2'] }] },
    hotel: { status: 'beta', basis: 'test' },
  } };
  validateRelease(release, guides);
  const claim = (id, status, evidence = []) => {
    const [guide, step] = id.split('/');
    return { id, guide, step, status, evidence };
  };
  const claims = [
    // alpha: GA guide whose own step 1 cites develop only (a); its beta section agrees; its GA
    // section cites develop only (a).
    claim('alpha/tile/1', 'Verified', [prod]), claim('alpha/1/1', VERIFIED_BETA, [dev]),
    claim('alpha/2/1', VERIFIED_BETA, [dev]), claim('alpha/2/2', 'Verified', [prod]),
    claim('alpha/3/1', VERIFIED_BETA, [dev]),
    // bravo: beta guide whose evidence is all production (b).
    claim('bravo/tile/1', 'Verified', [prod]), claim('bravo/1/1', 'Verified', [prod, dev]),
    // charlie: beta guide, nothing checked yet: pending.
    claim('charlie/tile/1', 'Unverified'), claim('charlie/1/1', 'Unverified'),
    // delta: GA guide checked against production: agrees.
    claim('delta/tile/1', 'Verified', [prod]), claim('delta/1/1', 'Needs expert'),
    // echo: beta guide checked against develop: agrees.
    claim('echo/tile/1', VERIFIED_BETA, [dev]), claim('echo/1/1', 'Verified', [prod]),
    // foxtrot: GA guide whose tile cites develop only: proposed beta (a).
    claim('foxtrot/tile/1', VERIFIED_BETA, [dev]), claim('foxtrot/1/1', 'Verified', [prod]),
    // golf: GA guide checked against production; its beta section is not checked yet: pending.
    claim('golf/tile/1', 'Verified', [prod]), claim('golf/1/1', 'Verified', [doc]), claim('golf/2/1', 'Unverified'),
    // hotel: beta guide verified only from a document: no production evidence, so pending.
    claim('hotel/tile/1', 'Verified', [doc]), claim('hotel/1/1', 'Needs expert'),
  ];
  const result = releaseStatus({ release, guides, claims });
  const expected = {
    alpha: ['ga', 'ga', 'disagree', 'a'],
    'alpha › a2-beta': ['beta', 'beta', 'agree'],
    'alpha › a3-ga': ['ga', 'beta', 'disagree', 'a'],
    bravo: ['beta', 'ga', 'disagree', 'b'],
    charlie: ['beta', 'pending', 'pending'],
    delta: ['ga', 'ga', 'agree'],
    echo: ['beta', 'beta', 'agree'],
    foxtrot: ['ga', 'beta', 'disagree', 'a'],
    golf: ['ga', 'ga', 'agree'],
    'golf › g2-beta': ['beta', 'pending', 'pending'],
    hotel: ['beta', 'pending', 'pending'],
  };
  const failures = [];
  const units = new Map(result.units.map((u) => [u.unit, u]));
  for (const [unit, [recorded, proposed, verdict, kind]] of Object.entries(expected)) {
    const u = units.get(unit);
    if (!u) { failures.push(`${unit}: no row`); continue; }
    const got = [u.recorded, u.proposed, u.verdict, u.disagreement];
    const want = [recorded, proposed, verdict, kind];
    if (got.some((v, i) => v !== want[i])) failures.push(`${unit}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)} (${u.reason})`);
  }
  if (result.units.length !== Object.keys(expected).length) {
    failures.push(`expected ${Object.keys(expected).length} rows, got ${result.units.length}`);
  }
  const checks = [
    [result.disagreements === 4, `expected 4 disagreements, got ${result.disagreements}`],
    [result.pending === 3, `expected 3 pending, got ${result.pending}`],
    [units.get('alpha')?.reason.includes('alpha/1/1 (step 1 "A1")'), 'the alpha reason should name alpha/1/1 and its step title'],
    [!units.get('alpha')?.verifiedBeta.includes('alpha/2/1'), 'a claim in a recorded section must not count against its guide'],
    [units.get('bravo')?.reason.startsWith('marked beta but the evidence is production'), 'bravo should read "marked beta but the evidence is production"'],
    [units.get('alpha › a3-ga')?.reason.startsWith('GA content cites develop only'), 'a3-ga should read "GA content cites develop only"'],
    [exitCode(result) === 0, 'the default exit code must be 0'],
    [exitCode(result, { strict: true }) === 1, '--strict must exit 1 on a disagreement'],
    [exitCode({ disagreements: 0 }, { strict: true }) === 0, '--strict must exit 0 with no disagreement'],
    [summaryLine(result) === 'release-status: 4 disagreements, 3 pending', `summary line was "${summaryLine(result)}"`],
  ];
  for (const [ok, message] of checks) if (!ok) failures.push(message);
  return failures;
}

// ---- CLI ----------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { ledger: LEDGER, strict: false, json: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') opts.strict = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--self-test') opts.selfTest = true;
    else if (a === '--ledger') {
      if (!argv[i + 1]) throw new Error('--ledger needs a file');
      opts.ledger = resolve(argv[++i]);
    } else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  if (opts.selfTest) {
    const failures = selfTest();
    for (const f of failures) console.error(`FAIL ${f}`);
    console.log(failures.length ? `release-status self-test: ${plural(failures.length, 'failure')}` : 'release-status self-test: passed');
    return failures.length ? 1 : 0;
  }

  let result;
  let releaseFile;
  try {
    const { release, file } = loadRelease();
    releaseFile = file;
    const { guides, keys } = extractGuides();
    validateRelease(release, guides);
    const ledger = JSON.parse(readFileSync(opts.ledger, 'utf8'));
    result = releaseStatus({ release, guides, keys, claims: ledger.claims });
  } catch (e) {
    console.error(`release-status could not run: ${e.message}`);
    return 2;
  }
  const shown = (p) => relative(ROOT, p) || p;
  if (opts.json) {
    console.log(JSON.stringify({ release: shown(releaseFile), ledger: shown(opts.ledger), ...result }, null, 2));
  } else {
    console.log(`release file ${shown(releaseFile)}, ledger ${shown(opts.ledger)}`);
    console.log(table(result));
    for (const u of result.unplaced) console.warn(`warning: ${u}`);
    console.log(summaryLine(result));
    if (result.disagreements && !opts.strict) console.log('advisory: pass --strict to exit 1 on a disagreement');
  }
  return exitCode(result, opts);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
