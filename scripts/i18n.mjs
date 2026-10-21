// Verifies the translation layer end to end, per locale, against the running site.
//
// Checks what a reader would notice: that a locale with a catalogue actually changes the words
// on screen, that <html lang> agrees with what is being served, and that a locale WITHOUT a
// catalogue degrades to English rather than to a half-translated page claiming to be French.
//
// The video panel's captions are held to the same rule: with fixture media
// (scripts/lib/media-fixture.mjs) on dashboard-overview, every shipped locale's page must make the
// caption track in its own language the default and the one showing, and a language switch at run
// time must move the showing captions with it. srclang carries the corrected tag (ko-KR, never ko-ko),
// so it is compared with <html lang>, not with the catalogue code.
//
// Usage: node scripts/i18n.mjs <url>
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { TRANSLATED_LOCALES } from '../src/media/captions.mjs';
import { installMediaFixture } from './lib/media-fixture.mjs';

const url = (process.argv[2] || 'http://localhost:8124/').replace(/\/$/, '');
const shipped = (await readdir('src/i18n'))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .map((f) => f.replace('.json', ''));

const source = JSON.parse(await readFile('src/i18n/en-us.json', 'utf8')).strings;
const englishStrings = new Set(Object.keys(source));

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));

// How much of the visible page is still English. Counted on the guide view rather than the
// catalogue because the guide carries the prose — the catalogue is mostly headings, and a
// regression that dropped every step body would still score well there.
const measure = () => page.evaluate((english) => {
  const set = new Set(english);
  let translated = 0, untranslated = 0;
  const seen = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement;
    // The transcript is cue text from the caption catalogues, not page text; it is checked below.
    if (!el || el.closest('.sa-app, .lsa-media-transcript, script, style, noscript')) continue;
    const t = (n.nodeValue || '').trim();
    if (t.length < 4 || !/\p{L}/u.test(t)) continue;
    if (set.has(t)) { untranslated++; if (seen.length < 5) seen.push(t.slice(0, 50)); }
    else translated++;
  }
  return { translated, untranslated, sample: seen };
}, [...englishStrings]);

const results = {};
for (const locale of shipped) {
  await page.goto(`${url}/?lang=${locale}#/minimum-threshold`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  const m = await measure();
  results[locale] = {
    ...m,
    lang: await page.evaluate(() => document.documentElement.getAttribute('lang')),
    applied: await page.evaluate(() => window.__saI18nApply?.activeLocale?.() ?? null),
    coverage: `${((m.translated / (m.translated + m.untranslated)) * 100).toFixed(1)}%`,
  };
}

// A locale with no catalogue must degrade to English, not to a partial page.
await page.goto(`${url}/?lang=xx-xx#/minimum-threshold`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
results.unknownLocale = {
  lang: await page.evaluate(() => document.documentElement.getAttribute('lang')),
  applied: await page.evaluate(() => window.__saI18nApply?.activeLocale?.() ?? null),
};

// The default caption track follows the locale. A fresh context with the fixture injected.
const mediaPage = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
mediaPage.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
await installMediaFixture(mediaPage);
const captionState = () => mediaPage.evaluate(() => {
  const v = document.querySelector('.lsa-media video');
  if (!v) return { lang: document.documentElement.getAttribute('lang'), video: false };
  const defaults = [...v.querySelectorAll('track[default]')].map((t) => t.getAttribute('srclang'));
  const showing = [...v.textTracks].filter((t) => t.mode === 'showing').map((t) => t.language);
  return { lang: document.documentElement.getAttribute('lang'), video: true, tracks: v.textTracks.length, defaults, showing };
});
// The browser picks the default track to show on its own schedule after the tracks are added.
const waitShowing = (lang) => mediaPage.waitForFunction((l) => {
  const v = document.querySelector('.lsa-media video');
  return !!v && [...v.textTracks].some((t) => t.mode === 'showing' && (!l || t.language === l));
}, lang, { timeout: 5000 }).catch(() => {});

const captionOk = (c) => c.video && c.tracks === 11 && c.defaults.length === 1 && c.defaults[0] === c.lang
  && c.showing.length === 1 && c.showing[0] === c.lang;

results.captions = {};
for (const locale of shipped) {
  await mediaPage.goto(`${url}/?lang=${locale}#/dashboard-overview`, { waitUntil: 'networkidle' });
  await mediaPage.waitForSelector('.lsa-media video', { timeout: 10000 }).catch(() => {});
  await waitShowing(null);
  const c = await captionState();
  results.captions[locale] = { ...c, ok: captionOk(c) && c.lang !== 'en-US' };
}

// A switch at run time, the way the language selector makes one: from English to French, with the
// English captions showing. They must move to French, not stay English or turn off.
await mediaPage.goto(`${url}/?lang=en-us#/dashboard-overview`, { waitUntil: 'networkidle' });
await mediaPage.waitForSelector('.lsa-media video', { timeout: 10000 }).catch(() => {});
await waitShowing('en-US');
const beforeSwitch = await captionState();
const switched = await mediaPage.evaluate(() => !!(window.__saLocale && window.__saLocale.set('fr-fr', { persist: false })));
await waitShowing('fr-FR');
const afterSwitch = await captionState();
results.captionSwitch = {
  switched,
  before: { lang: beforeSwitch.lang, showing: beforeSwitch.showing },
  after: { lang: afterSwitch.lang, showing: afterSwitch.showing },
  ok: switched && beforeSwitch.lang === 'en-US' && (beforeSwitch.showing || []).join() === 'en-US'
    && afterSwitch.lang === 'fr-FR' && (afterSwitch.showing || []).join() === 'fr-FR',
};

results.errors = [...new Set(errs)];
await b.close();

const pass =
  shipped.every((l) => {
    const r = results[l];
    // 90%, not 100%: station IDs, percentages and product names legitimately stay as they are.
    return r.applied === l && r.translated > r.untranslated * 9 && r.lang !== 'en-US';
  }) &&
  results.unknownLocale.lang === 'en-US' &&
  results.unknownLocale.applied === null &&
  // Every shipped catalogue has captions, and every caption locale a catalogue: ten of each today.
  [...shipped].sort().join() === [...TRANSLATED_LOCALES].sort().join() &&
  shipped.every((l) => results.captions[l].ok) &&
  results.captionSwitch.ok &&
  errs.length === 0;

console.log(JSON.stringify(results, null, 2));
console.log(pass ? '\nI18N: PASS' : '\nI18N: FAIL');
process.exit(pass ? 0 : 1);
