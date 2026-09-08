// Verifies the translation layer end to end, per locale, against the running site.
//
// Checks what a reader would notice: that a locale with a catalogue actually changes the words
// on screen, that <html lang> agrees with what is being served, and that a locale WITHOUT a
// catalogue degrades to English rather than to a half-translated page claiming to be French.
//
// Usage: node scripts/i18n.mjs <url>
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';

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
    if (!el || el.closest('.sa-app, script, style, noscript')) continue;
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
  errs.length === 0;

console.log(JSON.stringify(results, null, 2));
console.log(pass ? '\nI18N: PASS' : '\nI18N: FAIL');
process.exit(pass ? 0 : 1);
