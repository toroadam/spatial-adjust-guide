// Accessibility audit: runs axe-core against the catalog and inside a guide, and
// separately probes keyboard operability, which axe cannot detect on its own.
// Usage: node scripts/a11y.mjs <url>
//
// The catalog and guide scans are report-only, as they always were. The video panel is held to a
// stricter rule: a last scan opens dashboard-overview with fixture media (scripts/lib/media-fixture.mjs),
// the player mounted and its transcript open. Any violation id there that the plain guide scan does
// not have, and any violation at all inside the panel itself, is a regression the panel introduced.
// Those are listed as newViolations and are the only thing that makes this script exit 1.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { installMediaFixture } from './lib/media-fixture.mjs';

const url = process.argv[2];
const base = url.replace(/#.*$/, '').replace(/\/?$/, '/');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const scan = async (label, on = page, include = null) => {
  let builder = new AxeBuilder({ page: on }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  const r = await builder.analyze();
  const bySeverity = {};
  for (const v of r.violations) (bySeverity[v.impact] ||= []).push(`${v.id} (${v.nodes.length})`);
  return { label, total: r.violations.length, bySeverity, ids: r.violations.map((v) => v.id), passed: r.passes.length };
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

// The video panel: a fresh context, so nothing from the scans above carries over, with the fixture
// injected before the first navigation. The transcript is opened and given time to load, so axe sees
// the player, its tracks and the transcript text together.
const mediaPage = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const fixture = await installMediaFixture(mediaPage);
await mediaPage.goto(`${base}#/dashboard-overview`, { waitUntil: 'networkidle' });
await mediaPage.waitForSelector('.lsa-media video', { timeout: 10000 });
await mediaPage.click('.lsa-media-transcript summary');
await mediaPage.waitForFunction(
  () => document.querySelectorAll('.lsa-media-transcript-body p').length > 0 || !!document.querySelector('.lsa-media-transcript-error'),
  null,
  { timeout: 10000 },
).catch(() => {});
await mediaPage.waitForTimeout(500);
const media = await mediaPage.evaluate(() => ({
  panels: document.querySelectorAll('.lsa-media').length,
  transcriptOpen: !!document.querySelector('.lsa-media-transcript')?.open,
  transcriptCues: document.querySelectorAll('.lsa-media-transcript-body p').length,
  transcriptError: !!document.querySelector('.lsa-media-transcript-error'),
}));
const playerScan = await scan('player', mediaPage);
// The panel on its own as well: the guide already has color-contrast findings in the reproduced app,
// so an id-only comparison would hide a contrast failure inside the panel. Anything axe finds inside
// .lsa-media is new by definition, because the plain guide has no panel.
const panelScan = await scan('panel', mediaPage, '.lsa-media');
const guideIds = new Set(guide.ids);
const newViolations = [...new Set([
  ...playerScan.ids.filter((id) => !guideIds.has(id)),
  ...panelScan.ids.map((id) => `${id} (in the panel)`),
])];
// The scan only means something if it saw the panel with the transcript loaded.
const scanned = media.panels === 1 && media.transcriptOpen && media.transcriptCues > 0 && !media.transcriptError
  && fixture.requests.length > 0 && panelScan.passed > 0;

console.log(JSON.stringify({ catalog, guide, keyboard: kb, player, media: { ...media, scan: playerScan, panelScan }, newViolations }, null, 2));
await browser.close();

if (!scanned) console.log('\nA11Y: FAIL - the player scan did not see the panel with its transcript loaded');
else if (newViolations.length) console.log(`\nA11Y: FAIL - the open player adds ${newViolations.length} violation(s) the guide does not have: ${newViolations.join(', ')}`);
else console.log('\nA11Y: player adds no new violations');
process.exit(scanned && newViolations.length === 0 ? 0 : 1);
