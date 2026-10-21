// Read a guide the way the built site renders it, for the Double Click episode tools
// (scripts/episode-lint.mjs, scripts/episode-scaffold.mjs).
//
// Why the rendered page and not the export's data: the site's step text is the Core Design export
// after every transform in src/transform-export.mjs (corrections, the step rewrites, the added
// guides). An episode narrates what a reader sees on #/<key>, so the tools read exactly that.
//
//   readGuide(page, baseUrl, key) -> {
//     key, title, summary, url, shape,
//     steps: [{ n, title, doLine, seeLine, ifNotLine, whyLine, boldLabels, shape, body, caption }]
//   }
//
// Step shape. A rewritten step renders a Do, a You-should-see and an If-not line, each a span
// carrying its English source in data-sa-src, with every control written [[Exact Label]] (the
// followability standard, docs/writing-guide.md). For those steps the lines come from data-sa-src
// with the markers removed, boldLabels are the [[...]] labels (Do line first), and shape is true.
// A step that has not been rewritten yet has none of those spans: doLine is its body paragraph,
// seeLine its figure caption, ifNotLine null, shape false, and boldLabels are the bold text in the
// body plus the reproduction's own screen labels (src/i18n/en-us.json _screenStrings) that the
// step's title, body or caption quotes. That keeps highlights and the lint meaningful until the
// rewrite lands, and the lint reports any drift once it does.
//
// Discovery follows scripts/compare-guides.mjs (catalogue cards are '.lsa [data-title]'); external
// hosts are aborted as scripts/cursor-target.mjs does, so a CDN cannot change what is read. A key
// that falls back to the catalogue throws GuideNotFound rather than returning the catalogue.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const CATALOGUE = path.join(REPO_ROOT, 'src', 'i18n', 'en-us.json');

export class GuideNotFound extends Error {
  constructor(key, why) {
    super(`#/${key} does not open a guide (${why})`);
    this.name = 'GuideNotFound';
    this.key = key;
  }
}

// The reproduction's control labels, filtered to ones that can name a control in prose: at least
// four characters, letters, no digits (station ids, readings and counts are not labels).
export function loadScreenLabels(file = CATALOGUE) {
  if (!existsSync(file)) return [];
  const cat = JSON.parse(readFileSync(file, 'utf8'));
  return [...new Set((cat._screenStrings || []).map((s) => String(s).trim()))]
    .filter((s) => s.length >= 4 && /[A-Za-z]{2,}/.test(s) && !/\d/.test(s))
    .sort((a, b) => b.length - a.length);
}

// One shared browser page that never reaches an external host.
export async function openReader({ chromium } = {}) {
  const pw = chromium ?? (await import('playwright')).chromium;
  const browser = await pw.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: 'en-US' });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  return { browser, page, close: () => browser.close() };
}

export function guideUrl(baseUrl, key) {
  const base = String(baseUrl).replace(/#.*$/, '');
  return `${base}#/${key}`;
}

// Strip [[label]] markers to the label itself; collapse whitespace.
export const plain = (s) => String(s ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\s+/g, ' ').trim();
export const markerLabels = (s) => [...String(s ?? '').matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());

// Runs in the page. Returns raw step data; classification of shape lines happens here because it
// needs the DOM (attributes, label text beside a span).
function scrape() {
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const cards = document.querySelectorAll('.lsa [data-title]').length;
  const sections = [...document.querySelectorAll('section[id^="step-"]')];
  const h1 = document.querySelector('h1');
  const kindOf = (el) => {
    const attr = ['data-sa-line', 'data-line', 'data-kind', 'data-sa-kind']
      .map((a) => el.getAttribute(a) || '').join(' ').toLowerCase();
    const cls = `${typeof el.className === 'string' ? el.className : ''} ${typeof el.parentElement?.className === 'string' ? el.parentElement.className : ''}`.toLowerCase();
    const hay = `${attr} ${cls}`;
    if (/if-?not|ifnot/.test(hay)) return 'ifNot';
    if (/(^|[^a-z])see([^a-z]|$)/.test(hay)) return 'see';
    if (/(^|[^a-z])why([^a-z]|$)/.test(hay)) return 'why';
    if (/(^|[^a-z])do([^a-z]|$)/.test(hay)) return 'do';
    const box = el.parentElement;
    const label = box ? norm(box.textContent.replace(el.textContent, '')) : '';
    if (/^if not\b/i.test(label)) return 'ifNot';
    if (/^you should see\b/i.test(label)) return 'see';
    if (/^why\b/i.test(label)) return 'why';
    if (/^do\b/i.test(label)) return 'do';
    return null;
  };
  const steps = sections.map((sec) => {
    const n = Number(sec.id.replace(/^step-/, ''));
    const title = norm(sec.querySelector('h2')?.textContent);
    const lines = [];
    for (const el of sec.querySelectorAll('[data-sa-src]')) {
      if (el.closest('figure')) continue;
      if (el.parentElement?.closest('[data-sa-src]')) continue;
      lines.push({ kind: kindOf(el), src: el.getAttribute('data-sa-src') || '', text: norm(el.textContent),
        bold: [...el.querySelectorAll('b, strong')].map((b) => norm(b.textContent)) });
    }
    const bodyEl = [...sec.children].find((c) => c.tagName === 'P');
    const body = norm(bodyEl?.textContent);
    const bodyBold = bodyEl ? [...bodyEl.querySelectorAll('b, strong')].map((b) => norm(b.textContent)) : [];
    const caption = norm(sec.querySelector('figcaption')?.textContent);
    const beta = Boolean(sec.querySelector('.lsa-beta-badge'));
    return { n, title, lines, body, bodyBold, caption, beta };
  });
  const summary = norm(h1?.parentElement?.querySelector('h1 + p')?.textContent);
  return { cards, title: norm(h1?.textContent), summary, steps, hash: location.hash };
}

// Turns scraped lines into { doLine, seeLine, ifNotLine, whyLine, boldLabels, shape }.
export function shapeStep(raw, screenLabels = []) {
  const byKind = {};
  const unclassified = [];
  for (const line of raw.lines ?? []) {
    if (line.kind && !byKind[line.kind]) byKind[line.kind] = line;
    else if (!line.kind) unclassified.push(line);
  }
  for (const kind of ['do', 'see', 'ifNot']) {
    if (!byKind[kind] && unclassified.length) byKind[kind] = unclassified.shift();
  }
  const text = (l) => (l ? plain(l.src || l.text) : null);
  const shape = Boolean(byKind.do && byKind.see && byKind.ifNot);
  if (byKind.do || byKind.see || byKind.ifNot) {
    const labels = [];
    for (const kind of ['do', 'see', 'ifNot', 'why']) {
      const l = byKind[kind];
      if (!l) continue;
      for (const lab of [...markerLabels(l.src), ...(l.src ? [] : l.bold)]) if (!labels.includes(lab)) labels.push(lab);
    }
    return {
      doLine: text(byKind.do), seeLine: text(byKind.see), ifNotLine: text(byKind.ifNot), whyLine: text(byKind.why),
      boldLabels: labels, shape,
    };
  }
  // Not rewritten yet: body and caption stand in, labels come from bold text and quoted screen labels.
  const hay = `${raw.title} ${raw.body} ${raw.caption}`;
  const quoted = screenLabels
    .filter((lab) => new RegExp(`(^|[^A-Za-z0-9])${lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`).test(hay))
    .sort((a, b) => hay.indexOf(a) - hay.indexOf(b));
  const labels = [];
  for (const lab of [...(raw.bodyBold ?? []), ...quoted]) if (lab && !labels.includes(lab)) labels.push(lab);
  // "Changes" inside "Push Changes" is the same control, not a second one.
  const distinct = labels.filter((lab) => !quoted.some((other) => other !== lab && other.includes(lab)));
  labels.length = 0;
  labels.push(...distinct);
  return {
    doLine: raw.body || null, seeLine: raw.caption || null, ifNotLine: null, whyLine: null,
    boldLabels: labels, shape: false,
  };
}

// Opens #/<key> on the built site and returns the guide as rendered.
export async function readGuide(page, baseUrl, key, { screenLabels = loadScreenLabels(), settleMs = 500 } = {}) {
  const url = guideUrl(baseUrl, key);
  // A fresh document per guide: a hash change alone can leave the previous guide's DOM in place.
  await page.goto('about:blank');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(() => document.querySelector('section[id^="step-"]') || document.querySelector('.lsa [data-title]'),
    null, { timeout: 15000 }).catch(() => {});
  if (settleMs) await page.waitForTimeout(settleMs);
  const raw = await page.evaluate(scrape);
  if (raw.cards > 0) throw new GuideNotFound(key, 'the catalogue rendered instead');
  if (!raw.steps.length) throw new GuideNotFound(key, 'no steps rendered');
  if (raw.hash !== `#/${key}`) throw new GuideNotFound(key, `the address became ${raw.hash || '(none)'}`);
  const steps = raw.steps.map((s) => ({
    n: s.n, title: s.title, beta: s.beta, ...shapeStep(s, screenLabels), body: s.body || null, caption: s.caption || null,
  }));
  return { key, title: raw.title, summary: raw.summary || null, url, shape: steps.every((s) => s.shape), steps };
}
