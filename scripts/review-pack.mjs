// Builds the expert review pack from the claims ledger: one HTML page per guide, a combined
// index.html with every guide in catalogue order, and a PDF of index.html.
//
// Who it is for. Agronomists and product experts who sign off the guides. They read the guide as
// it is published, see every claim in it with its status and citation, answer the questions the
// source code could not settle, and record a verdict per guide. The pack is shared through Toro
// SharePoint/Teams. It is never published: review-pack/ is gitignored, and build.mjs copies only
// STATIC_DIRS plus generated files into dist/, so it cannot reach GitHub Pages.
//
// What it reads, and nothing else:
//   docs/claims/claims.json     the canonical ledger (statuses, evidence, questions, corrections)
//   docs/claims/sources.json    the pinned IntelliDash SHAs shown in every page header
//   extractGuides()             the published guide text, from scripts/claims-extract.mjs
// It never writes to docs/claims/. The prose comes from extractGuides() rather than from a fresh
// parse of the export, so the pack shows exactly the text the ledger describes (see
// docs/audit-verification.md for what a lossy re-parse once got wrong).
//
// Before rendering it checks that the ledger still matches the published text: same claim IDs,
// same wording, same production SHA. A stale ledger would put one sentence on the page and a
// verdict about a different one beside it, so it refuses unless --allow-stale is given, and then
// every page says it is stale. It also runs the ledger lint, so for example every Needs expert
// claim is guaranteed to carry a question.
//
// The output is self-contained: inline CSS, system fonts, no scripts, no images, and a
// Content-Security-Policy of default-src 'none'. After writing, every page is opened in Chromium
// and the run fails if any page makes a single sub-resource request.
//
// Like the ledger, the pack never contains IntelliDash code. Citations are path:line, and the
// prose in it is the ledger's own, so the pack can be forwarded freely inside Toro.
//
// Usage:
//   npm run review-pack
//   node scripts/review-pack.mjs [--ledger <claims.json>] [--out <dir>] [--no-pdf] [--allow-stale]
//
//   --ledger <file>  read this ledger instead of docs/claims/claims.json (for fixtures)
//   --out <dir>      write here instead of review-pack/. Refused inside dist/ or docs/claims/.
//   --no-pdf         skip the PDF and the browser checks (faster while iterating on the layout)
//   --allow-stale    render even if the ledger no longer matches the published text
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractGuides, claimsForGuide, lintShard, STATUSES, TYPES } from './claims-extract.mjs';

const ROOT = join(import.meta.dirname, '..');
const LEDGER = join(ROOT, 'docs', 'claims', 'claims.json');
const SOURCES = join(ROOT, 'docs', 'claims', 'sources.json');
const DEFAULT_OUT = join(ROOT, 'review-pack');
const DIST = join(ROOT, 'dist');
const CLAIMS_DIR = join(ROOT, 'docs', 'claims');
export const PDF_NAME = 'spatial-adjust-guides-review.pdf';
// Present in every output directory this script owns. Only a directory that has it (or is empty)
// is cleared before a run, so a mistyped --out can never delete someone else's files.
const MARKER = '.review-pack';
const SITE = 'https://toroadam.github.io/spatial-adjust-guide/';

// The four Target Profiles guides. Each opens with a notice about whether the feature ships,
// which the pack lifts to the top of the page so the expert judges it first.
const TARGET_PROFILE_GUIDES = ['target-profiles', 'creating-profiles', 'updating-profiles', 'seasonal-profiles'];

// Display order and meaning of each status. Mirrors the status vocabulary in docs/claims/README.md.
const STATUS_INFO = [
  ['Verified', 'verified', 'Production does what the claim says.'],
  ['Wrong', 'wrong', 'Production contradicts the claim. A correction is proposed beside it.'],
  ['Not shipping', 'not-shipping', 'The claim describes something that is not in the production build.'],
  ['Needs expert', 'needs-expert', 'The source cannot settle it. The question for you is listed under Questions for the experts.'],
  ['Unverified', 'unverified', 'Nobody has checked it against the source yet.'],
];
const STATUS_CLASS = Object.fromEntries(STATUS_INFO.map(([s, c]) => [s, c]));
const TYPE_INFO = [
  ['label', 'The text on a control, column, tab or dialog'],
  ['navigation', 'Where something is and how to get to it'],
  ['behaviour', 'What the product does when you act'],
  ['calculation', 'How a number is produced'],
  ['prerequisite', 'What must be true before you start'],
];
{
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  if (!same(STATUS_INFO.map(([s]) => s), STATUSES) || !same(TYPE_INFO.map(([t]) => t), TYPES)) {
    throw new Error('review-pack.mjs is out of step with the statuses or types in claims-extract.mjs');
  }
}

const VERDICTS = ['Approved', 'Approved with changes', 'Rejected'];

// ---- helpers ------------------------------------------------------------------------------------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** HTML-escape anything. Every string from the ledger or the guides goes through this. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const anchor = (claimId) => `claim-${claimId.replaceAll('/', '_')}`;
const guideAnchor = (key) => `guide-${key}`;
const short = (sha) => String(sha ?? '').slice(0, 8);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const count = (claims, field, values) => {
  const out = Object.fromEntries(values.map((v) => [v, 0]));
  for (const c of claims) out[c[field]] = (out[c[field]] ?? 0) + 1;
  return out;
};
const badge = (status) => `<span class="badge b-${STATUS_CLASS[status] ?? 'unverified'}">${esc(status)}</span>`;
const fmtDate = (d) => `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const isInside = (child, parent) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};
/** Resolve symlinks on the longest existing prefix, so a link into dist/ is caught too. */
const realish = (p) => {
  const abs = resolve(p);
  let probe = abs;
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe);
  return join(realpathSync(probe), relative(probe, abs));
};

// ---- loading and checking -----------------------------------------------------------------------

/**
 * Read the ledger and the published guides, and check that they agree. Returns everything the
 * renderer needs, plus `stale` (human-readable mismatches) and `lintErrors`.
 */
export function load({ ledgerPath = LEDGER, sourcesPath = SOURCES } = {}) {
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
  const { guides, categories, tiles, keys } = extractGuides();

  const byGuide = new Map(keys.map((k) => [k, []]));
  const stale = [];
  for (const c of ledger.claims) {
    if (!byGuide.has(c.guide)) { stale.push(`ledger has claims for "${c.guide}", which is not in the catalogue`); continue; }
    byGuide.get(c.guide).push(c);
  }

  const pinned = sources.intellidash.production.sha;
  const ledgerSha = ledger._meta?.intellidash?.production?.sha;
  if (ledgerSha !== pinned) {
    stale.push(`ledger was built against production ${short(ledgerSha)}, but sources.json now pins ${short(pinned)}`);
  }

  const lintErrors = [];
  const staleByGuide = {};
  for (const key of keys) {
    const mine = byGuide.get(key);
    if (!mine.length) { stale.push(`${key}: no claims in the ledger`); staleByGuide[key] = 1; continue; }
    lintErrors.push(...lintShard(key, { guide: key, title: tiles[key].title, claims: mine }, sources));
    const fresh = new Map(claimsForGuide(key, guides[key], tiles[key]).map((c) => [c.id, c.text]));
    const held = new Map(mine.map((c) => [c.id, c.text]));
    let differ = 0;
    for (const [id, text] of fresh) if (held.get(id) !== text) differ++;
    for (const id of held.keys()) if (!fresh.has(id)) differ++;
    if (differ) {
      staleByGuide[key] = differ;
      stale.push(`${key}: the ledger and the published text differ on ${plural(differ, 'claim')}`);
    }
  }
  return { ledger, sources, guides, categories, tiles, keys, byGuide, stale, staleByGuide, lintErrors };
}

// ---- rendering ----------------------------------------------------------------------------------

const CSS = `
:root { --ink: #1d1d1f; --muted: #5f6368; --rule: #d9dadc; --soft: #f5f6f7; --accent: #b3261e;
  --verified: #1e6b34; --verified-bg: #e3f3e7; --wrong: #a3161a; --wrong-bg: #fde7e7;
  --not-shipping: #5b2a86; --not-shipping-bg: #efe6f8; --needs-expert: #7a4a00; --needs-expert-bg: #fff1d6;
  --unverified: #4a4f55; --unverified-bg: #eceef0; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; color: var(--ink); background: #fff;
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
main { max-width: 60rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 .5rem; }
h2 { font-size: 1.45rem; line-height: 1.25; margin: 2rem 0 .5rem; }
h3 { font-size: 1.1rem; margin: 1.75rem 0 .5rem; padding-bottom: .25rem; border-bottom: 1px solid var(--rule); }
h4 { font-size: 1rem; margin: 1.25rem 0 .35rem; }
p { margin: .35rem 0; }
code, .cid { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .85em; }
a { color: #0b57d0; }
table { border-collapse: collapse; width: 100%; margin: .5rem 0 1rem; font-size: .9rem; }
th, td { text-align: left; vertical-align: top; padding: .3rem .5rem; border-bottom: 1px solid var(--rule); }
th { background: var(--soft); font-weight: 600; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
tr.cat td { background: var(--soft); font-weight: 600; }
.muted { color: var(--muted); }
.small { font-size: .85rem; }
.internal { display: inline-block; font-size: .75rem; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--accent); border: 1px solid var(--accent); border-radius: 3px; padding: 0 .4rem; }
.meta { display: grid; grid-template-columns: max-content 1fr; gap: .15rem 1rem; margin: .75rem 0; font-size: .9rem; }
.meta dt { color: var(--muted); }
.meta dd { margin: 0; }
.badge { display: inline-block; font-size: .75rem; font-weight: 700; line-height: 1.5; padding: 0 .45rem;
  border-radius: 999px; border: 1px solid currentColor; white-space: nowrap; }
.b-verified { color: var(--verified); background: var(--verified-bg); }
.b-wrong { color: var(--wrong); background: var(--wrong-bg); }
.b-not-shipping { color: var(--not-shipping); background: var(--not-shipping-bg); }
.b-needs-expert { color: var(--needs-expert); background: var(--needs-expert-bg); }
.b-unverified { color: var(--unverified); background: var(--unverified-bg); }
.tally { display: flex; flex-wrap: wrap; gap: .35rem .75rem; margin: .5rem 0; font-size: .9rem; }
.banner { border: 2px solid var(--accent); background: #fff4f2; padding: .6rem .8rem; margin: 1rem 0; border-radius: 4px; }
.notice { border-left: 4px solid var(--not-shipping); background: var(--not-shipping-bg); padding: .6rem .8rem; margin: 1rem 0; }
.notice h3 { border: 0; margin: 0 0 .25rem; padding: 0; }
.as-written { background: var(--soft); border-left: 3px solid var(--rule); padding: .5rem .75rem; margin: .4rem 0 .6rem; }
.as-written ul { margin: .25rem 0; padding-left: 1.25rem; }
.as-written .caption { font-style: italic; color: var(--muted); }
.as-written .tip { border-left: 3px solid var(--needs-expert); padding-left: .5rem; }
.label { font-size: .7rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.claim { border: 1px solid var(--rule); border-left-width: 4px; border-radius: 3px; padding: .45rem .65rem; margin: .4rem 0; }
.claim.s-verified { border-left-color: var(--verified); }
.claim.s-wrong { border-left-color: var(--wrong); }
.claim.s-not-shipping { border-left-color: var(--not-shipping); }
.claim.s-needs-expert { border-left-color: var(--needs-expert); }
.claim.s-unverified { border-left-color: var(--unverified); }
.claim-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .25rem .6rem; font-size: .85rem; }
.claim-head .ctype { color: var(--muted); }
.ctext { margin: .25rem 0; }
.cmeta { display: grid; grid-template-columns: max-content 1fr; gap: .1rem .75rem; margin: .25rem 0 0; font-size: .85rem; }
.cmeta dt { color: var(--muted); font-weight: 600; }
.cmeta dd { margin: 0; }
.cmeta ul { margin: 0; padding-left: 1.1rem; }
.none { color: var(--muted); font-style: italic; }
.questions ol { padding-left: 1.4rem; }
.questions li { margin: .6rem 0; }
.answer { border: 1px dashed var(--rule); min-height: 2.6rem; padding: .3rem .5rem; margin-top: .25rem; color: var(--muted); font-size: .85rem; }
.signoff { border: 2px solid var(--ink); border-radius: 4px; padding: .5rem .9rem .9rem; margin: 2rem 0 0; }
.signoff h3 { border: 0; margin-top: .5rem; }
.verdicts { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: .5rem 1.75rem; margin: .5rem 0 .75rem; }
.box { display: inline-block; width: 1em; height: 1em; border: 1.5px solid var(--ink); vertical-align: -.15em; margin-right: .4rem; }
.field { display: grid; grid-template-columns: 9rem 1fr; gap: .5rem; margin: .4rem 0; align-items: end; }
.line { border-bottom: 1px solid var(--ink); min-height: 1.6rem; }
.line.tall { min-height: 4.5rem; }
nav.pager { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; font-size: .9rem; padding: .5rem 0; border-bottom: 1px solid var(--rule); }
.guide + .guide, .pack-end { margin-top: 3rem; }
@page { size: A4; margin: 14mm 14mm 16mm; }
@media print {
  body { font-size: 10.5pt; }
  main { max-width: none; padding: 0; }
  a { color: inherit; text-decoration: none; }
  .screen-only { display: none !important; }
  .guide { break-before: page; }
  .guide + .guide { margin-top: 0; }
  .claim, .questions li, .signoff, tr, .as-written, .notice { break-inside: avoid; }
  h2, h3, h4 { break-after: avoid; }
}
`;

const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

function documentShell({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="data:,">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

function citations(evidence) {
  if (!evidence?.length) return '<span class="none">No citation yet</span>';
  const items = evidence.map((e) => {
    if (e.source === 'intellidash') {
      return `<li><code>${esc(e.path)}:${esc(e.line)}</code> <span class="muted">(IntelliDash ${esc(e.ref)} ${esc(short(e.sha))})</span></li>`;
    }
    if (e.source === 'doc') return `<li>${esc(e.ref)} <span class="muted">(Toro document)</span></li>`;
    return `<li>${esc(JSON.stringify(e))}</li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

function renderClaim(c) {
  const rows = [['Citation', citations(c.evidence)]];
  if (c.correction) rows.push(['Correction', esc(c.correction)]);
  if (c.question) rows.push(['Question', esc(c.question)]);
  if (c.developNote) rows.push(['On develop', esc(c.developNote)]);
  if (c.note) rows.push(['Verifier note', esc(c.note)]);
  if (c.previousText) rows.push(['Earlier wording', esc(c.previousText)]);
  return `<div class="claim s-${STATUS_CLASS[c.status] ?? 'unverified'}" id="${anchor(c.id)}">
<div class="claim-head"><span class="cid">${esc(c.id)}</span> ${badge(c.status)} <span class="ctype">${esc(c.type)} · ${esc(c.field)}</span></div>
<p class="ctext">${esc(c.text)}</p>
<dl class="cmeta">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
</div>`;
}

function tallyLine(claims) {
  const by = count(claims, 'status', STATUSES);
  const parts = STATUS_INFO.filter(([s]) => by[s]).map(([s]) => `<span>${badge(s)} ${by[s]}</span>`);
  return `<div class="tally"><span><strong>${plural(claims.length, 'claim')}</strong></span>${parts.join('')}</div>`;
}

/** The sections of a guide in reading order, each with its prose as published and its ledger bucket. */
function sections(guide, tile) {
  const out = [];
  const para = (t) => (t ? `<p>${esc(t)}</p>` : '');
  const list = (items) => (items?.length ? `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
  out.push({ step: 'tile', heading: 'Catalogue card',
    prose: `<p><strong>${esc(tile.title)}</strong></p>${para(tile.summary)}` });
  out.push({ step: 'summary', heading: 'Summary', prose: para(guide.summary) });
  out.push({ step: 'where', heading: 'Where', prose: para(guide.where) });
  out.push({ step: 'note', heading: 'Concept note', prose: guide.note ? `<p><strong>Concept.</strong> ${esc(guide.note)}</p>` : '' });
  out.push({ step: 'before', heading: 'Before you start', prose: list(guide.before) });
  // Each step's fields are labelled, because each claim names the field it came from.
  const field = (label, html, cls = '') => (html ? `<p${cls ? ` class="${cls}"` : ''}><span class="label">${label}</span> ${html}</p>` : '');
  (guide.steps || []).forEach((st, i) => {
    const tip = st.tip || st.tipLabel ? `${st.tipLabel ? `<strong>${esc(st.tipLabel)}</strong> ` : ''}${esc(st.tip)}` : '';
    out.push({ step: String(i + 1), heading: st.title ? `Step ${i + 1}: ${st.title}` : `Step ${i + 1}`, prose: field('Title', esc(st.title))
      + field('Body', esc(st.body)) + field('Caption', esc(st.caption), 'caption') + field('Tip', tip, 'tip') });
  });
  out.push({ step: 'verify', heading: 'How to know it worked', prose: list(guide.verify) });
  return out;
}

/** One guide as an <article>. Returns the markup and the IDs of every claim it rendered. */
function renderGuide(ctx, key) {
  const { guides, tiles, byGuide, categories, sources, generatedAt, staleByGuide } = ctx;
  const guide = guides[key];
  const tile = tiles[key];
  const claims = byGuide.get(key) ?? [];
  const category = categories.find((c) => c.tasks.some((t) => t.key === key));
  const { production: prod, develop: dev } = sources.intellidash;
  const rendered = new Set();
  const buckets = new Map();
  for (const c of claims) {
    if (!buckets.has(c.step)) buckets.set(c.step, []);
    buckets.get(c.step).push(c);
  }

  const parts = [];
  parts.push(`<article class="guide" id="${guideAnchor(key)}">
<header>
<p><span class="internal">Internal review</span> <span class="muted small">${esc(category?.title ?? guide.category)}</span></p>
<h2>${esc(tile.title)}</h2>
<p>${esc(tile.summary)}</p>
<dl class="meta">
<dt>Guide key</dt><dd><code>${esc(key)}</code></dd>
${guide.title && guide.title !== tile.title ? `<dt>Page title</dt><dd>${esc(guide.title)}</dd>` : ''}
<dt>Category</dt><dd>${esc(category?.title ?? guide.category)}</dd>
<dt>Card</dt><dd>${esc(tile.minutes)} · difficulty ${esc(tile.difficulty)} of 3</dd>
<dt>Live page</dt><dd><a href="${esc(`${SITE}#/${key}`)}">${esc(`${SITE}#/${key}`)}</a></dd>
<dt>Production</dt><dd><code>${esc(short(prod.sha))}</code> ${esc(prod.ref)}, ${esc(prod.date)}${prod.confirmed ? '' : ' <span class="muted">(not yet confirmed as the deployed build)</span>'}</dd>
<dt>Develop</dt><dd><code>${esc(short(dev.sha))}</code> ${esc(dev.ref)}, ${esc(dev.date)}</dd>
<dt>Generated</dt><dd>${esc(fmtDate(generatedAt))}</dd>
</dl>
${tallyLine(claims)}
</header>`);

  if (staleByGuide[key]) {
    parts.push(`<div class="banner"><strong>Stale ledger.</strong> The ledger and the published text of this guide differ on ${esc(plural(staleByGuide[key], 'claim'))}. Run <code>npm run claims:extract</code> and regenerate the pack before sending it.</div>`);
  }

  if (TARGET_PROFILE_GUIDES.includes(key)) {
    const noteClaims = buckets.get('note') ?? [];
    parts.push(`<section class="notice">
<h3>Target Profiles: shipping notice</h3>
${guide.note
    ? `<p>Readers see this notice before step 1:</p><p><strong>Concept.</strong> ${esc(guide.note)}</p>
<p class="small">${noteClaims.map((c) => `<a href="#${anchor(c.id)}"><span class="cid">${esc(c.id)}</span></a> ${badge(c.status)}`).join(' · ')}</p>
<p class="small">Please say whether this still describes what customers have.</p>`
    : '<p>This guide covers Target Profiles but carries no shipping notice. Please say whether it needs one.</p>'}
</section>`);
  }

  parts.push('<h3>The guide as written</h3>');
  for (const s of sections(guide, tile)) {
    const mine = buckets.get(s.step) ?? [];
    buckets.delete(s.step);
    if (!s.prose && !mine.length) continue;
    parts.push(`<section class="bucket"><h4>${esc(s.heading)}</h4>`);
    if (s.prose) parts.push(`<div class="as-written">${s.prose}</div>`);
    for (const c of mine) { parts.push(renderClaim(c)); rendered.add(c.id); }
    if (!mine.length) parts.push('<p class="none">No claims recorded for this section.</p>');
    parts.push('</section>');
  }
  // Ledger buckets the published guide no longer has (only possible with --allow-stale).
  for (const [step, mine] of buckets) {
    parts.push(`<section class="bucket"><h4>${esc(`In the ledger only: ${step}`)}</h4>`);
    for (const c of mine) { parts.push(renderClaim(c)); rendered.add(c.id); }
    parts.push('</section>');
  }

  const questions = claims.filter((c) => c.status === 'Needs expert');
  parts.push(`<section class="questions"><h3>Questions for the experts</h3>
${questions.length ? `<p class="small muted">Please answer each in a line or two, quoting the claim ID.</p><ol>${questions.map((c) => `<li>
<p><a href="#${anchor(c.id)}"><span class="cid">${esc(c.id)}</span></a></p>
<p><strong>${esc(c.question)}</strong></p>
<p class="small muted">The guide says: ${esc(c.text)}</p>
<div class="answer">Answer:</div>
</li>`).join('')}</ol>` : '<p class="none">No open questions for this guide.</p>'}
</section>`);

  parts.push(`<section class="signoff"><h3>Sign-off: ${esc(tile.title)}</h3>
<p class="small">Tick one verdict for this guide. Record the reviewer's role, not their name.</p>
<ul class="verdicts">${VERDICTS.map((v) => `<li><span class="box"></span>${esc(v)}</li>`).join('')}</ul>
<div class="field"><span>Reviewer role</span><span class="line"></span></div>
<div class="field"><span>Date</span><span class="line"></span></div>
<div class="field"><span>Changes required</span><span class="line tall"></span></div>
</section>
</article>`);

  return { html: parts.join('\n'), rendered };
}

function legend() {
  return `<section class="legend"><h3>How to read the badges</h3>
<table><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody>
${STATUS_INFO.map(([s, , m]) => `<tr><td>${badge(s)}</td><td>${esc(m)}</td></tr>`).join('\n')}
</tbody></table>
<table><thead><tr><th>Type</th><th>What the claim asserts</th></tr></thead><tbody>
${TYPE_INFO.map(([t, m]) => `<tr><td><code>${esc(t)}</code></td><td>${esc(m)}</td></tr>`).join('\n')}
</tbody></table>
<p class="small muted">Each claim ID is <code>guide/section/n</code>: the guide key, then the step number or one of tile, summary, where, note, before or verify, then the sentence number. A citation <code>path:line</code> points into the IntelliDash source at the pinned commit.</p>
</section>`;
}

function renderIndex(ctx, articles) {
  const { sources, categories, byGuide, keys, generatedAt, stale } = ctx;
  const all = keys.flatMap((k) => byGuide.get(k));
  const byStatus = count(all, 'status', STATUSES);
  const byType = count(all, 'type', TYPES);
  const { production: prod, develop: dev } = sources.intellidash;
  const questions = all.filter((c) => c.status === 'Needs expert').length;

  const rows = [];
  for (const cat of categories) {
    rows.push(`<tr class="cat"><td colspan="6">${esc(cat.title)}</td></tr>`);
    for (const { key } of cat.tasks) {
      const mine = byGuide.get(key);
      const by = count(mine, 'status', STATUSES);
      rows.push(`<tr><td><a href="#${guideAnchor(key)}">${esc(ctx.tiles[key].title)}</a> <a class="screen-only small" href="${esc(key)}.html">(page)</a></td>`
        + `<td class="n">${mine.length}</td><td class="n">${by.Wrong}</td><td class="n">${by['Needs expert']}</td>`
        + `<td class="n">${by['Not shipping']}</td><td class="n">${by.Unverified}</td></tr>`);
    }
  }

  const body = `<header>
<p><span class="internal">Internal review · do not publish</span></p>
<h1>Spatial Adjust guides: expert review pack</h1>
<p>Every statement the ${keys.length} published guides make about the Spatial Adjust screen, as a claim with its status and the IntelliDash source it was checked against. Please read each guide, answer its questions, and record a verdict at the end of it.</p>
<dl class="meta">
<dt>Production</dt><dd><code>${esc(short(prod.sha))}</code> ${esc(prod.ref)}, version ${esc(prod.version)}, ${esc(prod.date)}${prod.confirmed ? '' : ' <span class="muted">(not yet confirmed as the deployed build)</span>'}</dd>
<dt>Develop</dt><dd><code>${esc(short(dev.sha))}</code> ${esc(dev.ref)}, version ${esc(dev.version)}, ${esc(dev.date)}</dd>
<dt>Source fetched</dt><dd>${esc(sources.fetchedAt)}</dd>
<dt>Generated</dt><dd>${esc(fmtDate(generatedAt))}</dd>
<dt>Live site</dt><dd><a href="${esc(SITE)}">${esc(SITE)}</a></dd>
</dl>
</header>
${stale.length ? `<div class="banner"><strong>Stale ledger.</strong> This pack was generated with --allow-stale and must not be sent for review:<ul>${stale.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
<section><h3>How to review</h3>
<ol>
<li>Read each guide as written, then the claims under it. The badge says whether the claim has been checked, and the citation says against what.</li>
<li>Where a claim is <strong>Wrong</strong>, check the proposed correction. Where it is <strong>Not shipping</strong>, say whether the guide should describe it at all.</li>
<li>Answer every item under <strong>Questions for the experts</strong>, quoting the claim ID.</li>
<li>Comment on anything else from the live site: the <strong>Feedback</strong> button, bottom right of every page, records the guide and step you are on.</li>
<li>Tick a verdict in the sign-off box at the end of each guide.</li>
</ol>
</section>
${legend()}
<section class="totals"><h3>Totals</h3>
${tallyLine(all)}
<p class="small">${plural(keys.length, 'guide')}, ${plural(questions, 'question')} for the experts.</p>
<table><thead><tr><th>Status</th><th class="n">Claims</th></tr></thead><tbody>
${STATUS_INFO.map(([s]) => `<tr><td>${badge(s)}</td><td class="n">${byStatus[s]}</td></tr>`).join('\n')}
<tr><th>Total</th><th class="n">${all.length}</th></tr>
</tbody></table>
<table><thead><tr><th>Type</th><th class="n">Claims</th></tr></thead><tbody>
${TYPE_INFO.map(([t]) => `<tr><td><code>${esc(t)}</code></td><td class="n">${byType[t]}</td></tr>`).join('\n')}
<tr><th>Total</th><th class="n">${all.length}</th></tr>
</tbody></table>
</section>
<section class="contents"><h3>Guides</h3>
<table><thead><tr><th>Guide</th><th class="n">Claims</th><th class="n">Wrong</th><th class="n">Needs expert</th><th class="n">Not shipping</th><th class="n">Unverified</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table>
</section>
${articles.join('\n')}
<p class="pack-end muted small">End of the review pack. ${plural(keys.length, 'guide')}, ${plural(all.length, 'claim')}.</p>`;
  return documentShell({ title: 'Spatial Adjust guides: expert review pack', body });
}

function renderStandalone(ctx, key, article, i) {
  const { keys, tiles } = ctx;
  const prev = keys[i - 1];
  const next = keys[i + 1];
  const nav = `<nav class="pager screen-only"><a href="index.html">All guides</a>`
    + `${prev ? `<a href="${esc(prev)}.html">Previous: ${esc(tiles[prev].title)}</a>` : ''}`
    + `${next ? `<a href="${esc(next)}.html">Next: ${esc(tiles[next].title)}</a>` : ''}</nav>`;
  // The pack-wide stale banner matters on a page forwarded on its own as well.
  const staleNote = ctx.stale.length && !ctx.staleByGuide[key]
    ? '<div class="banner"><strong>Stale ledger.</strong> This pack was generated with --allow-stale and must not be sent for review.</div>' : '';
  return documentShell({ title: `Review: ${tiles[key].title}`, body: `${nav}\n${staleNote}\n${article}\n${legend()}` });
}

/** Render every file of the pack. Returns [[fileName, html], ...] in write order. */
export function render(ctx) {
  const files = [];
  const articles = [];
  const missing = [];
  ctx.keys.forEach((key, i) => {
    const { html, rendered } = renderGuide(ctx, key);
    for (const c of ctx.byGuide.get(key)) if (!rendered.has(c.id)) missing.push(c.id);
    articles.push(html);
    files.push([`${key}.html`, renderStandalone(ctx, key, html, i)]);
  });
  if (missing.length) throw new Error(`claims left off their guide page: ${missing.join(', ')}`);
  files.push(['index.html', renderIndex(ctx, articles)]);
  return files;
}

// ---- output -------------------------------------------------------------------------------------

/** Refuse destinations that are published or that the ledger owns, then clear our own last run. */
function prepareOut(outArg) {
  const out = realish(outArg);
  if (isInside(out, realish(DIST))) throw new Error(`refusing to write the review pack inside dist/ (${out}): dist/ is what GitHub Pages publishes`);
  if (isInside(out, realish(CLAIMS_DIR))) throw new Error(`refusing to write the review pack inside docs/claims/ (${out})`);
  if (isInside(realish(ROOT), out)) throw new Error(`refusing to use ${out} as the output directory: it contains the repository`);
  if (existsSync(out)) {
    const entries = readdirSync(out);
    if (entries.length && !entries.includes(MARKER)) {
      throw new Error(`${out} already holds files that the review pack did not write. Choose an empty directory.`);
    }
    for (const f of entries) if (/\.(?:html|pdf)$/i.test(f)) rmSync(join(out, f));
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, MARKER), 'Written by scripts/review-pack.mjs. Internal: share through Toro SharePoint/Teams, never publish.\n');
  return out;
}

/**
 * Static guard: no tag or style rule that a browser would fetch. Every string from the ledger is
 * escaped, so `<` only ever opens real markup and text can never trip this check.
 */
function assertSelfContained(name, html) {
  const problems = [];
  for (const [tag] of html.matchAll(/<[^>]+>/g)) {
    if (/^<(?:script|img|picture|iframe|frame|object|embed|video|audio|source|track|input|form|base)\b/i.test(tag)) problems.push(tag);
    else if (/^<link\b/i.test(tag) && tag !== '<link rel="icon" href="data:,">') problems.push(tag);
    else if (/\s(?:src|srcset|poster|data|background|action|formaction|ping)\s*=/i.test(tag)) problems.push(tag);
  }
  for (const [, css] of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) if (/url\(|@import/i.test(css)) problems.push('<style> with url() or @import');
  if (problems.length) throw new Error(`${name} would load an external resource: ${problems.slice(0, 3).join(' ')}`);
}

/**
 * Open every page in Chromium and fail on any sub-resource request, then print index.html to the
 * PDF. The print CSS starts each guide on a new page. The footer is Chromium's own template, which
 * is rendered by the browser and loads nothing.
 */
async function browserPass(out, names, generatedAt) {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch {
    throw new Error('playwright is not installed. Run npm install, or pass --no-pdf.');
  }
  let browser;
  try { browser = await chromium.launch(); } catch (e) {
    throw new Error(`Chromium did not start (${e.message.split('\n')[0]}). Run npx playwright install chromium, or pass --no-pdf.`);
  }
  try {
    const page = await (await browser.newContext({ offline: true })).newPage();
    let requests = [];
    page.on('request', (r) => requests.push(r.url()));
    const fetched = [];
    for (const name of names) {
      const url = pathToFileURL(join(out, name)).href;
      requests = [];
      await page.goto(url, { waitUntil: 'load' });
      for (const u of requests) if (u !== url) fetched.push(`${name}: ${u}`);
    }
    if (fetched.length) throw new Error(`the pack must load nothing, but it requested:\n${fetched.join('\n')}`);

    // index.html is the last page opened.
    const pdf = join(out, PDF_NAME);
    await page.pdf({
      path: pdf, format: 'A4', printBackground: true, displayHeaderFooter: true,
      margin: { top: '14mm', right: '14mm', bottom: '18mm', left: '14mm' },
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font: 8px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #5f6368; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between;">`
        + `<span>Spatial Adjust guides: expert review pack. Internal, do not publish. Generated ${esc(fmtDate(generatedAt))}.</span>`
        + '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

function parseArgs(argv) {
  const opts = { ledger: LEDGER, out: DEFAULT_OUT, pdf: true, allowStale: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ledger') opts.ledger = resolve(argv[++i] ?? '');
    else if (a === '--out') opts.out = resolve(argv[++i] ?? '');
    else if (a === '--no-pdf') opts.pdf = false;
    else if (a === '--allow-stale') opts.allowStale = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const ctx = load({ ledgerPath: opts.ledger });
  if (ctx.lintErrors.length) {
    for (const e of ctx.lintErrors) console.error(e);
    console.error(`review pack not written: the ledger has ${plural(ctx.lintErrors.length, 'lint error')}`);
    return 1;
  }
  if (ctx.stale.length) {
    for (const s of ctx.stale) console.error(`stale: ${s}`);
    if (!opts.allowStale) {
      console.error('review pack not written: the ledger does not match the published guides. Run npm run claims:extract first, or pass --allow-stale to render it marked as stale.');
      return 1;
    }
  }
  ctx.generatedAt = new Date();

  const files = render(ctx);
  for (const [name, html] of files) assertSelfContained(name, html);
  const out = prepareOut(opts.out);
  for (const [name, html] of files) writeFileSync(join(out, name), html);

  const all = ctx.keys.flatMap((k) => ctx.byGuide.get(k));
  const by = count(all, 'status', STATUSES);
  const shown = isInside(out, process.cwd()) ? relative(process.cwd(), out) || '.' : out;
  if (opts.pdf) {
    // Guide pages first, so index.html is still open when the PDF is printed.
    await browserPass(out, [...ctx.keys.map((k) => `${k}.html`), 'index.html'], ctx.generatedAt);
  }
  console.log(`review pack: ${ctx.keys.length} guide pages and index.html${opts.pdf ? ` and ${PDF_NAME}` : ''} in ${shown}/`);
  if (opts.pdf) console.log(`  all ${files.length} pages opened in Chromium with zero requests`);
  console.log(`  ${all.length} claims: ${STATUS_INFO.map(([s]) => `${s} ${by[s]}`).join(', ')}`);
  if (ctx.stale.length) console.log('  marked STALE: do not send this pack for review');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
