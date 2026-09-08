// Harvests the source string catalogue for translation, by rendering the built site and
// reading the DOM rather than by parsing the export.
//
// Reading the rendered DOM is the point. src/i18n-apply.js swaps text at runtime keyed on the
// exact English string, so a catalogue harvested any other way can contain keys that never
// match — a source literal is not necessarily what the runtime paints (whitespace collapses,
// entities resolve, values interpolate). Harvesting what is actually on screen makes the key
// set and the match set the same set by construction.
//
// Usage: node scripts/extract-strings.mjs <url> [--out src/i18n/en-us.json]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const url = (process.argv[2] || 'http://localhost:8124/').replace(/\/$/, '');
const outIdx = process.argv.indexOf('--out');
const out = outIdx > -1 ? process.argv[outIdx + 1] : 'src/i18n/en-us.json';

const GUIDES = [
  'dashboard-overview', 'understand-spatial-adjust', 'map-navigation', 'understanding-vwc',
  'minimum-threshold', 'calculation-settings', 'calculation-methods', 'preferences',
  'target-profiles', 'creating-profiles', 'updating-profiles', 'seasonal-profiles',
  'bulk-adjustments', 'editing-station-targets', 'enable-disable-stations', 'station-details',
  'suggested-adjustments', 'push-to-lynx', 'reviewing-changes', 'verify-results',
  'station-zero', 'threshold-questions', 'calculation-questions', 'push-failures',
];

// Never translated, and each for a different reason:
//   - the language names are endonyms; "Deutsch" is Deutsch in every locale, which is the
//     whole point of listing them that way;
//   - the brand and product names are trademarks and appear untranslated in IntelliDash too.
const NEVER = new Set([
  'English', 'Deutsch', 'Español', 'Français', 'Italiano', 'Nederlands', 'Português',
  '日本語', '한국어', 'ไทย', '简体中文',
  'TORO', 'Toro', 'Lynx', 'IntelliDash', 'Spatial Adjust', 'TurfRad', 'VWC', 'ET',
]);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const strings = new Map();   // string -> Set of contexts, for the translator's benefit
const add = (value, context) => {
  const v = (value || '').replace(/\s+/g, ' ').trim();
  if (v.length < 2) return;
  if (!/\p{L}/u.test(v)) return;              // pure numbers and punctuation carry no language
  if (NEVER.has(v)) return;
  if (!strings.has(v)) strings.set(v, new Set());
  strings.get(v).add(context);
};

// Text nodes and the handful of attributes that reach a user. .sa-app is excluded: it is a
// faithful reproduction of the real IntelliDash screen, and the product renders its own
// translations there — see README > Localisation status.
const harvest = (context) => page.evaluate(() => {
    // .sa-app is harvested separately by scripts/app-strings.mjs, which resolves most of its
    // labels from IntelliDash's own catalogues rather than translating them afresh. Excluding it
    // here keeps this catalogue to the guides' own prose.
  const skip = (el) => !el || !!el.closest('.sa-app, script, style, noscript');
  const found = { text: [], attrs: [] };

  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (skip(n.parentElement)) continue;
    const t = (n.nodeValue || '').trim();
    if (t) found.text.push(t);
  }
  for (const el of document.querySelectorAll('[aria-label], [placeholder], [title], img[alt]')) {
    if (skip(el)) continue;
    for (const a of ['aria-label', 'placeholder', 'title', 'alt']) {
      const v = el.getAttribute(a);
      if (v && v.trim()) found.attrs.push(v.trim());
    }
  }
  return found;
}).then((found) => {
  found.text.forEach((t) => add(t, context));
  found.attrs.forEach((t) => add(t, context + ':attr'));
});

// The catalogue.
await page.goto(`${url}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await harvest('catalog');

// Open the language menu too — its options are only in the DOM while it is expanded, and the
// menu's own chrome still needs translating even though the language names do not.
await page.click('.lsa-lang-btn').catch(() => {});
await page.waitForTimeout(300);
await harvest('catalog');
await page.keyboard.press('Escape').catch(() => {});

// Every guide, every step. Stepping matters: each step's body, caption and tip only enter the
// DOM when that step is current, so a single snapshot per guide would miss most of the corpus.
for (const key of GUIDES) {
  await page.goto(`${url}/#/${key}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await harvest(key);

  for (let i = 0; i < 15; i++) {
    const next = await page.$('[aria-label="Next step"]');
    if (!next) break;
    const disabled = await next.evaluate((e) => e.getAttribute('aria-disabled') === 'true' || e.disabled === true);
    if (disabled) break;
    await next.click().catch(() => {});
    await page.waitForTimeout(650);
    await harvest(key);
  }
  process.stderr.write(`  ${key}: ${strings.size} unique so far\n`);
}

await browser.close();

const sorted = [...strings.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const catalogue = {
  _meta: {
    note: 'Source strings harvested from the rendered site by scripts/extract-strings.mjs. '
        + 'Keys are the exact English rendering; src/i18n-apply.js matches on them verbatim. '
        + 'Regenerate after any Core Design re-export.',
    locale: 'en-us',
    strings: sorted.length,
    words: sorted.reduce((n, [s]) => n + s.split(/\s+/).length, 0),
  },
  strings: Object.fromEntries(sorted.map(([s]) => [s, s])),
  _contexts: Object.fromEntries(sorted.map(([s, c]) => [s, [...c].slice(0, 4)])),
};

await writeFile(out, JSON.stringify(catalogue, null, 2) + '\n');
console.log(`${out}: ${catalogue._meta.strings} strings, ${catalogue._meta.words} words`);
