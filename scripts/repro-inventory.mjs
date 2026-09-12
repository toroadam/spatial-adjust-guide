// Harvests EVERY string the reproduced app renders, across every guide and every step.
//
// Why this exists. scripts/fidelity.mjs checks the 111 labels listed in _screenStrings, and that
// list is hand-maintained — it is an inventory of what someone remembered to write down, not of
// what the reproduction shows. The map legend chips were never in it, so nothing checked them,
// and the figure went on rendering "6-16%" for months after the prose beside it was corrected to
// 6-19%. Every label outside that list is unchecked by construction.
//
// This walks the real thing instead: open each guide, step through it, and collect the text of
// every leaf node inside .sa-app. Dialogs and tabs change what is mounted, so stepping matters —
// a single snapshot per guide misses most of the corpus, the same reason
// scripts/extract-strings.mjs steps rather than snapshots.
//
// Output feeds scripts/fidelity.mjs, which can then diff the FULL rendered inventory against the
// product rather than a curated subset.
//
// Usage: node scripts/repro-inventory.mjs <url> [--out src/i18n/repro-labels.json]
import { writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = (process.argv[2] || 'http://localhost:8124/').replace(/\/$/, '');
const oi = process.argv.indexOf('--out');
const out = oi > -1 ? process.argv[oi + 1] : 'src/i18n/repro-labels.json';

// Values, not labels. The reproduction is seeded with sample data — station ids, readings,
// timestamps, the fictional site name — and none of it is a label to verify against the product.
// Digit-only and identifier-shaped strings are dropped; everything else is kept and normalised.
const VALUE = /^(\d+(?:[.,]\d+)?%?|\d+AP\d+(-\d+)?|AP|[\d\s:.-]+(AM|PM)?|[+-]|[▼▲←→›×÷]|Riverbend National)$/;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1400 } })).newPage();
// Nothing external, so a blocked CDN cannot masquerade as a missing label.
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const guides = await page.evaluate(() =>
  [...document.querySelectorAll('.lsa [data-title]')].map((e) => e.getAttribute('data-title')));

// Text of every leaf inside the visible reproduction. Leaves only: an ancestor's innerText is the
// concatenation of its children and would enter the inventory as one meaningless run-on string.
const snapshot = () => page.evaluate(() => {
  const onScreen = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };
  const app = [...document.querySelectorAll('.sa-app')].find(onScreen);
  if (!app) return { none: true };
  const seen = [];
  for (const e of app.querySelectorAll('*')) {
    if (e.children.length) continue;
    const t = (e.innerText || '').trim();
    if (t) seen.push(t);
  }
  // Placeholders and accessible names are rendered UI too, and are exactly the kind of text that
  // never makes it into a hand-kept list.
  for (const e of app.querySelectorAll('[placeholder],[aria-label],[title]')) {
    for (const a of ['placeholder', 'aria-label', 'title']) {
      const v = (e.getAttribute(a) || '').trim();
      if (v) seen.push(v);
    }
  }
  return { seen, step: (document.querySelector('.lsa [aria-live]')?.textContent || '').trim() };
});

const inventory = new Map();   // normalised -> { text, guides:Set }
const add = (t, g) => {
  const clean = t.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 160 || VALUE.test(clean)) return;
  const key = clean.toLowerCase();
  if (!inventory.has(key)) inventory.set(key, { text: clean, guides: new Set() });
  inventory.get(key).guides.add(g);
};

let steps = 0;
for (const g of guides) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.getByText(g, { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 40; i++) {
    const s = await snapshot();
    if (s.none) break;
    steps++;
    for (const t of s.seen) add(t, g);
    const before = s.step;
    const next = page.locator('div', { hasText: /^→$/ }).last();
    if (!(await next.count())) break;
    await next.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(420);
    if ((await snapshot()).step === before) break;
  }
  process.stderr.write(`  ${g}: ${inventory.size} unique so far\n`);
}
await browser.close();

// How much of this the curated list actually covered — the number that says whether the old
// gate was checking the reproduction or a fraction of it.
const cat = JSON.parse(await readFile('src/i18n/en-us.json', 'utf8'));
const curated = new Set((cat._screenStrings || []).map((s) => s.toLowerCase().replace(/\s+/g, ' ').trim()));
const rendered = [...inventory.values()].sort((a, b) => a.text.localeCompare(b.text));
const uncovered = rendered.filter((r) => !curated.has(r.text.toLowerCase()));

await writeFile(out, JSON.stringify({
  harvestedAt: new Date().toISOString(),
  source: url,
  guides: guides.length,
  steps,
  labels: rendered.map((r) => ({ text: r.text, guides: [...r.guides].sort() })),
}, null, 2) + '\n');

console.log(`${out}: ${rendered.length} distinct rendered label(s) from ${steps} step(s) across ${guides.length} guide(s)`);
console.log(`  listed in _screenStrings:     ${rendered.length - uncovered.length}`);
console.log(`  NOT listed, so never checked: ${uncovered.length}`);
