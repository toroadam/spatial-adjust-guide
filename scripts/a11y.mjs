// Accessibility audit: runs axe-core against the catalog and inside a guide, and
// separately probes keyboard operability, which axe cannot detect on its own.
//
// The guide is scanned twice, with the Double Click overlay from src/player.js on screen (the
// highlight ring, the chapter label and the chapter strip): once as most readers see it, and once
// in a context with prefers-reduced-motion: reduce. The run fails when the overlay is missing, when
// any violation lands on the overlay itself, when the reduced-motion scan finds a rule the normal
// one does not, or when anything is still animating under reduced motion. Violations inside the
// reproduction (.sa-app) are reported and do not fail: that component is a faithful copy of the
// IntelliDash screen, and its colours are a finding against IntelliDash (see src/a11y.css).
//
// Usage: node scripts/a11y.mjs <url>
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const url = process.argv[2];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const OVERLAY = '.lsa-hl, .lsa-chapter, .lsa-strip';

const scan = async (p, label) => {
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bySeverity = {};
  for (const v of r.violations) (bySeverity[v.impact] ||= []).push(`${v.id} (${v.nodes.length})`);
  // Nodes on the overlay. axe reports a CSS selector path per node; resolve it in the page.
  const selectors = r.violations.flatMap((v) => v.nodes.map((n) => ({ id: v.id, sel: n.target[n.target.length - 1] })));
  const onOverlay = await p.evaluate(({ selectors, overlay }) => selectors.filter(({ sel }) => {
    try { const e = document.querySelector(sel); return !!(e && e.closest(overlay)); } catch { return false; }
  }).map(({ id, sel }) => `${id}: ${sel}`), { selectors, overlay: OVERLAY });
  return { label, total: r.violations.length, rules: r.violations.map((v) => v.id), bySeverity, onOverlay };
};

/** The overlay is on screen: a placed ring on the stage, a labelled chapter, a strip of buttons. */
const overlayState = (p) => p.evaluate(() => {
  const stage = document.querySelector('.lsa-stage[data-sa-target]');
  const hl = stage && stage.querySelector(':scope > .lsa-hl');
  const label = stage && stage.querySelector(':scope > .lsa-chapter');
  const strip = document.querySelector('.lsa-strip');
  const segs = strip ? strip.querySelectorAll('button.lsa-strip-seg') : [];
  return {
    ring: !!(hl && hl.getAttribute('data-sa-hl') === 'on' && hl.getBoundingClientRect().width > 0),
    ringTransition: hl ? getComputedStyle(hl).transitionDuration : null,
    chapterLabel: label ? label.textContent.trim() : '',
    strip: strip ? { role: strip.getAttribute('role'), label: strip.getAttribute('aria-label'), segments: segs.length,
      current: strip.querySelectorAll('[aria-current="step"]').length } : null,
  };
});

const overlayOk = (o) => o.ring && !!o.chapterLabel && !!o.strip && o.strip.role === 'group'
  && !!o.strip.label && o.strip.segments > 1 && o.strip.current === 1;

const openGuide = async (p) => {
  await p.getByText('Dashboard overview', { exact: false }).first().click();
  await p.waitForTimeout(2000);
};

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const catalog = await scan(page, 'catalog');

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

await openGuide(page);
const guide = await scan(page, 'guide');
const overlay = await overlayState(page);

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

// The same guide with prefers-reduced-motion: reduce.
const rmPage = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
await rmPage.goto(url, { waitUntil: 'networkidle' });
await rmPage.waitForTimeout(1200);
await openGuide(rmPage);
const guideReduced = await scan(rmPage, 'guide, reduced motion');
const overlayReduced = await overlayState(rmPage);
// Step the player, which pans the camera and moves the ring, then list whatever is still animating
// inside the guide. src/a11y.css shortens every duration to .001ms under reduced motion, so a
// running animation longer than a millisecond is motion that escaped it.
await rmPage.locator('[aria-label="Next step"]').first().click();
await rmPage.waitForTimeout(150);
const animatingReduced = await rmPage.evaluate(() => document.getAnimations()
  .filter((a) => a.playState === 'running')
  .filter((a) => { const d = a.effect && a.effect.getTiming().duration; return typeof d === 'number' && d > 1; })
  .filter((a) => { const t = a.effect && a.effect.target; return t && t.closest && t.closest('.lsa'); })
  .map((a) => `${a.animationName || a.transitionProperty || 'animation'} on ${(a.effect.target.className || a.effect.target.tagName || '').toString().slice(0, 40)}`));

const newInReduced = guideReduced.rules.filter((id) => !guide.rules.includes(id));
const pass = overlayOk(overlay) && overlayOk(overlayReduced)
  && guide.onOverlay.length === 0 && guideReduced.onOverlay.length === 0
  && newInReduced.length === 0 && animatingReduced.length === 0
  && overlayReduced.ringTransition === '0s';

console.log(JSON.stringify({ catalog, guide, guideReduced, keyboard: kb, player,
  overlay, overlayReduced, newInReduced, animatingReduced }, null, 2));
console.log(pass ? '\nA11Y: PASS' : '\nA11Y: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
