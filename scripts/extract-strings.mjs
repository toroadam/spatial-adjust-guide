// Harvests the source string catalogue for translation, by rendering the built site and
// reading the DOM rather than by parsing the export.
//
// Reading the rendered DOM is the point. src/i18n-apply.js swaps text at runtime keyed on the
// exact English string, so a catalogue harvested any other way can contain keys that never
// match — a source literal is not necessarily what the runtime paints (whitespace collapses,
// entities resolve, values interpolate). Harvesting what is actually on screen makes the key
// set and the match set the same set by construction.
//
// Which guides. The guide list is not written down here. It is read from the served catalogue:
// each written card is opened, and the #/<key> its click routes to is the guide's key. A build with
// SA_SHOW_BETA=false has no tile for a beta guide, so the harvest never visits one, and a guide
// added by a transform or released from beta is harvested without editing this file.
//
// Both release modes. A build that shows beta content and one that removes it render different
// strings: the shown build adds the Beta badge, banner and step marker and the beta guides and
// steps; the hidden build renumbers "Step N of M" around a removed step and shortens the sentences
// that named removed content. The catalogue must hold the union, so do not point this at one build
// and write src/i18n/en-us.json with the result. Run scripts/harvest-both-modes.mjs instead: it
// builds and serves each mode, runs this script on each with --out to a scratch file, and reports
// (and with --write, diff-and-adds) the union against src/i18n/en-us.json. en-us.json is this
// harvest PLUS the screen labels scripts/app-strings.mjs adds, so overwriting it drops them. The
// mode of the build harvested is recorded in the output's _meta.mode, read from the page's
// <meta name="sa-release-mode">.
//
// Usage: node scripts/extract-strings.mjs <url> [--out src/i18n/en-us.json]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const url = (process.argv[2] || 'http://localhost:8124/').replace(/\/$/, '');
const outIdx = process.argv.indexOf('--out');
const out = outIdx > -1 ? process.argv[outIdx + 1] : 'src/i18n/en-us.json';

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
const mode = await page.evaluate(() => document.querySelector('meta[name="sa-release-mode"]')?.content || 'unknown');

// The guides this build publishes, in catalogue order: open each written card and read the route
// its click pushes. A stub card (data-stub="true") is an unwritten guide with no route, and its
// dialog is harvested separately below.
const GUIDES = [];
const cardCount = await page.locator('.lsa [data-title][data-stub="false"]').count();
for (let i = 0; i < cardCount; i++) {
  const card = page.locator('.lsa [data-title][data-stub="false"]').nth(i);
  const title = await card.getAttribute('data-title');
  await card.click();
  await page.waitForFunction(() => /^#\/./.test(location.hash), null, { timeout: 5000 })
    .catch(() => { throw new Error(`the card "${title}" did not route to a guide`); });
  const key = decodeURIComponent(await page.evaluate(() => location.hash.slice(2)));
  if (!GUIDES.includes(key)) GUIDES.push(key);
  await page.goBack();
  await page.waitForFunction(() => !location.hash && document.querySelector('.lsa [data-title]'), null, { timeout: 5000 });
}
if (!GUIDES.length) throw new Error('no written guide cards on the catalogue; is the build served at ' + url + '?');
process.stderr.write(`  ${mode} build: ${GUIDES.length} guides from the catalogue\n`);

// Open the language menu too — its options are only in the DOM while it is expanded, and the
// menu's own chrome still needs translating even though the language names do not.
await page.click('.lsa-lang-btn').catch(() => {});
await page.waitForTimeout(300);
await harvest('catalog');
await page.keyboard.press('Escape').catch(() => {});

// Same reason as the language menu, for the two dialogs that only exist once opened. Without
// these the contact modal's lede and row labels, and the whole feedback dialog, never reach the
// catalogue — so they shipped in English to all eleven locales while every other string around
// them was translated. Driving the UI keeps the key set and the runtime match set the same set,
// which is the property this harvester exists to preserve; a hand-maintained side list would not.
await page.click('.lsa-contact-btn').catch(() => {});
await page.waitForTimeout(300);
await harvest('chrome');
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(200);

// The unwritten-guide request dialog, reachable from a stub card on the catalogue.
// Dormant as of 2026-09: all 26 guides are written, so no card carries data-stub="true" and
// this dialog cannot be reached. Its two strings are therefore absent from the catalogue and
// would render in English if a stub ever returns. Warned about rather than hand-listed, because
// a side list of strings the harvester cannot see is exactly the drift this file exists to avoid.
const stubCard = await page.$('.lsa [data-stub="true"]');
if (stubCard) {
  await stubCard.click().catch(() => {});
  await page.waitForTimeout(300);
  await harvest('chrome');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
} else {
  process.stderr.write('  note: no stub cards on the catalogue — the guide-request dialog\'s strings are not harvestable\n');
}

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

// The Feedback button only exists when an endpoint is configured, and its panel's states only
// enter the DOM when driven — so a stub endpoint is injected and the panel is opened, sent
// (delayed, to catch "Sending…"), confirmed, and failed once, here rather than found by the walk
// above. Every request to the stub is answered locally; nothing is posted anywhere.
const STUB = 'https://feedback.invalid/harvest';
let failNext = false;
await page.addInitScript((u) => { window.__saFeedbackEndpoint = u; }, STUB);
await page.route(STUB, async (r) => {
  if (failNext) return r.abort();
  await new Promise((res) => setTimeout(res, 600));
  return r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
});
// The walk above leaves the page on this same document, so going to another #/ route would be a
// same-document navigation that never re-runs the init script. Leave the document first, so the
// next load is a fresh one and sees the stub endpoint.
await page.goto('about:blank');
await page.goto(`${url}/#/${GUIDES[0]}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
const fab = await page.$('.lsa-fb-fab');
if (fab) {
  await harvest('chrome');
  const openPanel = async () => { await page.click('.lsa-fb-fab').catch(() => {}); await page.waitForTimeout(300); };
  await openPanel();
  await harvest('chrome');
  await page.fill('.lsa-fb-input', 'harvest').catch(() => {});
  await page.click('.lsa-fb-send').catch(() => {});
  await page.waitForTimeout(150);
  await harvest('chrome');                     // "Sending…"
  await page.waitForTimeout(800);
  await harvest('chrome');                     // the sent confirmation
  await page.click('.lsa-fb-cancel').catch(() => {});
  failNext = true;
  await openPanel();
  await page.fill('.lsa-fb-input', 'harvest').catch(() => {});
  await page.click('.lsa-fb-send').catch(() => {});
  await page.waitForTimeout(400);
  await harvest('chrome');                     // the send-failed message
  await page.click('.lsa-fb-cancel').catch(() => {});
} else {
  process.stderr.write('  WARNING: feedback button not found — its strings will be absent\n');
}

await browser.close();

const sorted = [...strings.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const catalogue = {
  _meta: {
    note: 'Source strings harvested from the rendered site by scripts/extract-strings.mjs. '
        + 'Keys are the exact English rendering; src/i18n-apply.js matches on them verbatim. '
        + 'Regenerate after any Core Design re-export.',
    locale: 'en-us',
    mode,
    guides: GUIDES,
    strings: sorted.length,
    words: sorted.reduce((n, [s]) => n + s.split(/\s+/).length, 0),
  },
  strings: Object.fromEntries(sorted.map(([s]) => [s, s])),
  _contexts: Object.fromEntries(sorted.map(([s, c]) => [s, [...c].slice(0, 4)])),
};

await writeFile(out, JSON.stringify(catalogue, null, 2) + '\n');
console.log(`${out}: ${catalogue._meta.strings} strings, ${catalogue._meta.words} words`);
