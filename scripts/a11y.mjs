// Accessibility audit: runs axe-core against the catalog and inside a guide, and
// separately probes keyboard operability, which axe cannot detect on its own.
// Usage: node scripts/a11y.mjs <url>
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const url = process.argv[2];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const scan = async (label) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bySeverity = {};
  for (const v of r.violations) (bySeverity[v.impact] ||= []).push(`${v.id} (${v.nodes.length})`);
  return { label, total: r.violations.length, bySeverity };
};

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const catalog = await scan('catalog');

// Keyboard probe: how far can Tab actually get, and what does it reach?
const kb = await page.evaluate(() => {
  const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const focusable = [...document.querySelectorAll(sel)];
  const cards = [...document.querySelectorAll('*')].filter(
    (e) => /^(Start|Coming soon)/.test((e.textContent || '').trim()) && e.children.length === 0,
  );
  return {
    focusableCount: focusable.length,
    focusableTags: [...new Set(focusable.map((e) => e.tagName.toLowerCase()))],
    clickHandlersOnDivs: [...document.querySelectorAll('div,span')].filter((e) => e.onclick).length,
    cardCtaCount: cards.length,
  };
});

await page.getByText('Dashboard overview', { exact: false }).first().click();
await page.waitForTimeout(2000);
const guide = await scan('guide');

const player = await page.evaluate(() => {
  const arrows = [...document.querySelectorAll('div')].filter((e) => /^[←→]$/.test((e.textContent || '').trim()));
  return {
    arrowControls: arrows.length,
    arrowsAreButtons: arrows.every((e) => e.tagName === 'BUTTON'),
    arrowsFocusable: arrows.filter((e) => e.tabIndex >= 0).length,
    arrowsHaveLabel: arrows.filter((e) => e.getAttribute('aria-label') || e.getAttribute('title')).length,
    liveRegions: document.querySelectorAll('[aria-live]').length,
    landmarks: document.querySelectorAll('main,nav,header,footer,[role="main"],[role="navigation"]').length,
    h1Count: document.querySelectorAll('h1').length,
  };
});

console.log(JSON.stringify({ catalog, guide, keyboard: kb, player }, null, 2));
await browser.close();
