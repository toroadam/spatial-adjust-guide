// Release modes in the browser: step numbering in every guide, and the Beta badge, banner and step
// marker in every locale when beta content is shown, or nowhere when it is hidden.
//
// Why. A build with SA_SHOW_BETA=false removes beta steps from GA guides, so the player counter, the
// step rail, the "On this page" contents and the written steps must all renumber together, and a
// reader must never see "Step 4 of 5" in a guide that has four steps. A build that shows beta content
// labels it, and the label has to reach readers in every language the site ships. Neither is visible
// in the guide data alone, so this drives the built page.
//
// What it checks, against the running site:
//   - every guide reachable from the catalogue: the tiles are exactly the guides this build ships;
//     the player reads "Step 1 of n" where n is the length of the step rail; the rail, the numbered
//     contents entries and the written steps run 1..n without gaps and name the same steps; stepping
//     to the last step reads "Step n of n" and announces it;
//   - when beta content is shown: every beta tile has the Beta badge and "Beta" in its accessible
//     name, and no GA tile has either; every beta guide opens with the banner and no GA guide does;
//     every beta step of a GA guide carries the marker in its written heading and in the player,
//     and no other step does; then, in each of the ten locales (?lang=<locale>), the badge, banner
//     and marker render the locale's catalogue translation, and the banner sentence is not English;
//   - when beta content is hidden: no element with an lsa-beta- class exists on the catalogue, in
//     any guide, or on the catalogue in any locale, and no tile's accessible name says Beta.
//
// The mode comes from SA_SHOW_BETA through parseShowBeta() in src/release.mjs, and the release file
// through loadRelease(), which honours SA_RELEASE_FILE (tests only): the same values the build read.
// The script fails when the page says it was built in the other mode. The sign-in gate is bypassed
// on localhost (README "Sign-in gate"), so the page shows its content directly.
//
// Usage: node scripts/release-modes.mjs <url>     (npm run test:release-modes)
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import {
  parseShowBeta, loadRelease, betaSteps, isGuideShipped,
  BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT,
} from '../src/release.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const url = (process.argv[2] || 'http://localhost:8124/').replace(/\/$/, '');
const showBeta = parseShowBeta(process.env.SA_SHOW_BETA);
const { release, file: releaseFile } = loadRelease();

const keys = Object.keys(release.guides);
const shippedKeys = keys.filter((k) => isGuideShipped(release, k, showBeta));
const betaGuideKeys = keys.filter((k) => release.guides[k].status === 'beta');
const betaStepsOf = Object.fromEntries(keys.map((k) => [k, betaSteps(release, k)]));
const hasBetaContent = betaGuideKeys.length > 0 || keys.some((k) => betaStepsOf[k].length > 0);

const locales = (await readdir(join(ROOT, 'src', 'i18n')))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const problems = [];
const problem = (m) => problems.push(m);
const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
// The player counter: the innermost div whose text is "Step N of M" (the runtime wraps each
// interpolation in a span.sc-interp), not the screen-reader announcement.
await context.addInitScript(() => {
  window.__rmCounter = (pattern = /^Step \d+ of \d+$/) => [...document.querySelectorAll('.lsa div')]
    .find((e) => !e.querySelector('div') && !e.classList.contains('lsa-sr-only') && pattern.test(e.textContent.replace(/\s+/g, ' ').trim()));
});
const page = await context.newPage();
const errors = new Set();
page.on('pageerror', (e) => errors.add(String(e).slice(0, 160)));

// ---- reading the page -----------------------------------------------------------------------------

/** The catalogue tiles: title, accessible name and whether the Beta badge is inside. */
const readTiles = () => page.evaluate(() => [...document.querySelectorAll('.lsa [data-title]')].map((t) => ({
  title: t.getAttribute('data-title'),
  ariaLabel: t.getAttribute('aria-label') || '',
  badge: t.querySelector('.lsa-beta-badge-tile')?.textContent.trim() ?? null,
})));

/** Everything that numbers the steps of the open guide, plus the Beta labels on it. */
const readGuide = () => page.evaluate(() => {
  const text = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const counter = window.__rmCounter();
  // The counter heads the player panel: its next sibling is the step heading, and the panel's
  // second block is the step rail, one chip per step with its number and title.
  const chips = counter ? [...counter.parentElement.parentElement.children[1].children] : [];
  const rail = chips.map((c) => {
    const spans = c.querySelectorAll(':scope > span');
    return { n: text(spans[0]), label: text(spans[1]) };
  });
  const toc = [...document.querySelectorAll('aside.lsa-toc a')].map((a) => {
    const spans = [...a.querySelectorAll(':scope > span')];
    return spans.length > 1 && /^\d+$/.test(text(spans[0])) ? { n: text(spans[0]), label: text(spans[1]) } : null;
  }).filter(Boolean);
  const sections = [...document.querySelectorAll('.lsa section[id^="step-"]')].map((s) => {
    const h2 = s.querySelector('h2');
    const marker = h2?.querySelector('.lsa-beta-badge-step');
    return {
      id: s.id,
      n: text(s.querySelector('span')),
      title: h2 ? String(h2.firstChild?.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
      marker: marker ? text(marker) : null,
    };
  });
  const playerHeading = counter?.nextElementSibling;
  const banner = document.querySelector('.lsa-beta-banner');
  return {
    hash: location.hash,
    h1: text(document.querySelector('.lsa h1')),
    counter: text(counter),
    playerMarker: text(playerHeading?.querySelector('.lsa-beta-badge-step')),
    announcement: text(document.querySelector('.lsa-sr-only[aria-live]')),
    rail, toc, sections,
    banner: banner ? {
      label: text(banner.querySelector('.lsa-beta-banner-label')),
      sentence: [...banner.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ').replace(/\s+/g, ' ').trim(),
    } : null,
    betaElements: document.querySelectorAll('[class*="lsa-beta-"]').length,
  };
});

const betaElementCount = () => page.evaluate(() => document.querySelectorAll('[class*="lsa-beta-"]').length);

const waitForCatalogue = () => page.waitForFunction(() => document.querySelectorAll('.lsa [data-title]').length > 0, null, { timeout: 20000 });
const waitForCounter = (re) => page.waitForFunction((src) => !!window.__rmCounter(new RegExp(src)), re.source, { timeout: 20000 });

/** Click rail chip `i` (0-based) of the open guide and wait for the counter to follow. */
async function stepTo(i, n) {
  await page.evaluate((index) => {
    const counter = window.__rmCounter();
    counter.parentElement.parentElement.children[1].children[index].click();
  }, i);
  await waitForCounter(new RegExp(`^Step ${i + 1} of ${n}$`));
  await page.waitForTimeout(150);
}

// ---- the catalogue and every guide ----------------------------------------------------------------

await page.goto(url + '/', { waitUntil: 'networkidle' });
await waitForCatalogue();
await page.waitForTimeout(800);

const builtMode = await page.evaluate(() => document.querySelector('meta[name="sa-release-mode"]')?.content ?? null);
const wantMode = showBeta ? 'with-beta' : 'ga-only';
if (builtMode !== wantMode) {
  // Every check below would compare the page with the wrong expectations, so stop here.
  console.log(`\nRELEASE MODES: FAIL\n- the page was built as ${JSON.stringify(builtMode)}, but SA_SHOW_BETA=`
    + `${process.env.SA_SHOW_BETA === undefined ? 'unset' : JSON.stringify(process.env.SA_SHOW_BETA)} means "${wantMode}". `
    + 'Build and test with the same SA_SHOW_BETA.');
  await browser.close();
  process.exit(1);
}

const tiles = await readTiles();
if (tiles.length !== shippedKeys.length) {
  problem(`the catalogue has ${tiles.length} tiles; this build should ship ${shippedKeys.length} guides`);
}
if (!showBeta) {
  const n = await betaElementCount();
  if (n) problem(`the catalogue has ${n} element(s) with an lsa-beta- class, though beta content is hidden`);
}

const guides = {};
for (let i = 0; i < tiles.length; i++) {
  if (i > 0) {
    await page.goBack();
    await waitForCatalogue();
    await page.waitForTimeout(200);
  }
  const tile = tiles[i];
  await page.locator('.lsa [data-title]').nth(i).click();
  await waitForCounter(/^Step 1 of \d+$/);
  await page.waitForTimeout(250);
  const g = await readGuide();
  const key = g.hash.replace(/^#\//, '');
  const where = `guide "${key}" (tile ${JSON.stringify(tile.title)})`;
  const report = { tile: tile.title, counter: g.counter, steps: g.rail.length };
  guides[key] = report;

  if (!Object.hasOwn(release.guides, key)) { problem(`tile ${JSON.stringify(tile.title)} opened ${g.hash}, which is not a guide`); continue; }
  if (!shippedKeys.includes(key)) problem(`${where} is in the catalogue, but this build should not ship it`);

  // Numbering: the counter, the rail, the contents and the written steps agree.
  const n = g.rail.length;
  const oneToN = Array.from({ length: n }, (_, j) => String(j + 1));
  if (n < 1) problem(`${where} has no step rail`);
  if (g.counter !== `Step 1 of ${n}`) problem(`${where} counter reads ${JSON.stringify(g.counter)}; the rail has ${n} steps`);
  if (JSON.stringify(g.rail.map((r) => r.n)) !== JSON.stringify(oneToN)) problem(`${where} rail is numbered ${JSON.stringify(g.rail.map((r) => r.n))}`);
  if (JSON.stringify(g.toc.map((t) => t.n)) !== JSON.stringify(oneToN)) problem(`${where} contents are numbered ${JSON.stringify(g.toc.map((t) => t.n))}; expected 1..${n}`);
  if (JSON.stringify(g.toc.map((t) => t.label)) !== JSON.stringify(g.rail.map((r) => r.label))) problem(`${where} contents and rail name different steps`);
  if (JSON.stringify(g.sections.map((s) => s.n)) !== JSON.stringify(oneToN)) problem(`${where} written steps are numbered ${JSON.stringify(g.sections.map((s) => s.n))}`);
  if (JSON.stringify(g.sections.map((s) => s.id)) !== JSON.stringify(oneToN.map((x) => `step-${x}`))) problem(`${where} written step ids are ${JSON.stringify(g.sections.map((s) => s.id))}`);
  if (JSON.stringify(g.sections.map((s) => s.title)) !== JSON.stringify(g.rail.map((r) => r.label))) problem(`${where} written steps and rail name different steps`);

  // Beta labels on the tile and the guide.
  const isBeta = release.guides[key].status === 'beta';
  const stepTitles = betaStepsOf[key];
  const markedSteps = g.sections.filter((s) => s.marker !== null).map((s) => s.title);
  if (showBeta) {
    if (isBeta !== (tile.badge !== null)) problem(`${where} tile ${isBeta ? 'lacks' : 'has'} the Beta badge`);
    if (isBeta !== tile.ariaLabel.includes(BETA_BADGE_LABEL)) problem(`${where} tile accessible name ${JSON.stringify(tile.ariaLabel)} ${isBeta ? 'lacks' : 'has'} "${BETA_BADGE_LABEL}"`);
    if (isBeta !== (g.banner !== null)) problem(`${where} ${isBeta ? 'has no' : 'has a'} Beta banner`);
    if (g.banner && (g.banner.label !== BETA_BANNER_LABEL || g.banner.sentence !== BETA_BANNER_TEXT)) {
      problem(`${where} banner reads ${JSON.stringify(g.banner)}`);
    }
    if (JSON.stringify(markedSteps) !== JSON.stringify(stepTitles)) {
      problem(`${where} marks steps ${JSON.stringify(markedSteps)} as Beta; expected ${JSON.stringify(stepTitles)}`);
    }
    // The player heading carries the marker only on a beta step.
    const firstIsBeta = stepTitles.includes(g.rail[0]?.label);
    if (firstIsBeta !== (g.playerMarker !== null)) problem(`${where} player heading of step 1 ${firstIsBeta ? 'lacks' : 'has'} the Beta marker`);
    for (const title of stepTitles) {
      const at = g.rail.findIndex((r) => r.label === title);
      if (at < 0) { problem(`${where} has no step ${JSON.stringify(title)}`); continue; }
      await stepTo(at, n);
      const now = await readGuide();
      if (now.playerMarker === null) problem(`${where} player heading of beta step ${at + 1} has no Beta marker`);
    }
    report.beta = isBeta ? 'guide' : stepTitles.length ? `steps ${stepTitles.map((t) => g.rail.findIndex((r) => r.label === t) + 1).join(', ')}` : undefined;
  } else {
    if (g.betaElements) problem(`${where} has ${g.betaElements} element(s) with an lsa-beta- class, though beta content is hidden`);
    if (tile.badge !== null || /\bBeta, /.test(tile.ariaLabel)) problem(`${where} tile is labelled Beta, though beta content is hidden`);
    if (isBeta) problem(`${where} is a beta guide in a build that hides beta content`);
    for (const title of stepTitles) if (g.rail.some((r) => r.label === title)) problem(`${where} still has beta step ${JSON.stringify(title)}`);
  }

  // Step to the last step: the counter and the announcement follow.
  if (n > 1) {
    await stepTo(n - 1, n);
    const last = await readGuide();
    if (last.counter !== `Step ${n} of ${n}`) problem(`${where} last step reads ${JSON.stringify(last.counter)}`);
    const want = `Step ${n} of ${n}: ${g.rail[n - 1].label}`;
    if (last.announcement !== want) problem(`${where} announces ${JSON.stringify(last.announcement)} on the last step; expected ${JSON.stringify(want)}`);
    report.last = last.counter;
  }
}
const reached = Object.keys(guides);
for (const k of shippedKeys) if (!reached.includes(k)) problem(`guide "${k}" ships but no catalogue tile opens it`);

// ---- every locale ---------------------------------------------------------------------------------

const localeResults = {};
const catalogueFor = async (locale) => JSON.parse(await readFile(join(ROOT, 'src', 'i18n', `${locale}.json`), 'utf8')).strings || {};
const waitForLocale = (locale) => page.waitForFunction((l) => window.__saI18nApply?.activeLocale?.() === l, locale, { timeout: 15000 })
  .then(() => true, () => false);
/** Wait until `read()` returns `want` (the i18n layer re-applies after each render), then return it. */
async function settle(read, want) {
  let value = await read();
  for (let i = 0; i < 30 && value !== want; i++) { await page.waitForTimeout(200); value = await read(); }
  return value;
}

const firstBetaGuide = betaGuideKeys.find((k) => shippedKeys.includes(k));
const firstBetaStepGuide = keys.find((k) => release.guides[k].status === 'ga' && betaStepsOf[k].length);

if (showBeta && hasBetaContent) {
  for (const locale of locales) {
    const strings = await catalogueFor(locale);
    const want = {
      badge: norm(strings[BETA_BADGE_LABEL]),
      label: norm(strings[BETA_BANNER_LABEL]),
      sentence: norm(strings[BETA_BANNER_TEXT]),
    };
    const r = { applied: null };
    for (const [what, text] of Object.entries(want)) {
      if (!text) problem(`${locale}: src/i18n/${locale}.json has no translation of ${JSON.stringify({ badge: BETA_BADGE_LABEL, label: BETA_BANNER_LABEL, sentence: BETA_BANNER_TEXT }[what])}`);
    }
    if (want.sentence === BETA_BANNER_TEXT) problem(`${locale}: the banner sentence is not translated in src/i18n/${locale}.json`);

    if (firstBetaGuide) {
      await page.goto(`${url}/?lang=${locale}`, { waitUntil: 'networkidle' });
      await waitForCatalogue();
      r.applied = (await waitForLocale(locale)) ? locale : null;
      r.badge = await settle(() => page.evaluate(() => document.querySelector('.lsa-beta-badge-tile')?.textContent.trim() ?? null), want.badge);
      await page.goto(`${url}/?lang=${locale}#/${firstBetaGuide}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!document.querySelector('.lsa-beta-banner'), null, { timeout: 20000 }).catch(() => {});
      await waitForLocale(locale);
      const readBanner = () => page.evaluate(() => {
        const b = document.querySelector('.lsa-beta-banner');
        if (!b) return null;
        return {
          label: b.querySelector('.lsa-beta-banner-label')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
          sentence: [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ').replace(/\s+/g, ' ').trim(),
        };
      });
      const banner = await settle(async () => JSON.stringify(await readBanner()), JSON.stringify({ label: want.label, sentence: want.sentence }));
      r.banner = JSON.parse(banner);
      if (r.badge !== want.badge) problem(`${locale}: the tile badge reads ${JSON.stringify(r.badge)}; the catalogue says ${JSON.stringify(want.badge)}`);
      if (!r.banner) problem(`${locale}: guide "${firstBetaGuide}" has no Beta banner`);
      else {
        if (r.banner.label !== want.label) problem(`${locale}: the banner label reads ${JSON.stringify(r.banner.label)}; the catalogue says ${JSON.stringify(want.label)}`);
        if (r.banner.sentence !== want.sentence) problem(`${locale}: the banner sentence reads ${JSON.stringify(r.banner.sentence)}; the catalogue says ${JSON.stringify(want.sentence)}`);
        if (r.banner.sentence === BETA_BANNER_TEXT) problem(`${locale}: the banner sentence is still English`);
      }
    }
    if (firstBetaStepGuide) {
      await page.goto(`${url}/?lang=${locale}#/${firstBetaStepGuide}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!document.querySelector('.lsa section[id^="step-"]'), null, { timeout: 20000 });
      const applied = await waitForLocale(locale);
      r.applied = r.applied ?? (applied ? locale : null);
      r.marker = await settle(() => page.evaluate(() => document.querySelector('.lsa section .lsa-beta-badge-step')?.textContent.trim() ?? null), want.badge);
      if (r.marker !== want.badge) problem(`${locale}: the step marker reads ${JSON.stringify(r.marker)}; the catalogue says ${JSON.stringify(want.badge)}`);
    }
    if (r.applied !== locale) problem(`${locale}: the translation layer did not apply the locale (active: ${JSON.stringify(r.applied)})`);
    // Where the catalogue keeps IntelliDash's own untranslated "Beta", the text matches English by
    // design; the active locale above is what shows the catalogue was applied.
    r.badgeKeptAsEnglish = want.badge === BETA_BADGE_LABEL;
    localeResults[locale] = r;
  }
} else if (!showBeta) {
  for (const locale of locales) {
    await page.goto(`${url}/?lang=${locale}`, { waitUntil: 'networkidle' });
    await waitForCatalogue();
    const applied = await waitForLocale(locale);
    const n = await betaElementCount();
    localeResults[locale] = { applied: applied ? locale : null, betaElements: n };
    if (!applied) problem(`${locale}: the translation layer did not apply the locale`);
    if (n) problem(`${locale}: the catalogue has ${n} element(s) with an lsa-beta- class, though beta content is hidden`);
  }
}

await browser.close();
if (errors.size) problem(`page errors: ${[...errors].join(' | ')}`);

const result = {
  mode: showBeta ? 'beta shown' : 'beta hidden',
  SA_SHOW_BETA: process.env.SA_SHOW_BETA === undefined ? 'unset' : process.env.SA_SHOW_BETA,
  releaseFile: releaseFile.startsWith(ROOT) ? releaseFile.slice(ROOT.length + 1) : releaseFile,
  builtMode,
  tiles: tiles.length,
  shippedGuides: shippedKeys.length,
  betaGuides: betaGuideKeys,
  betaSteps: Object.fromEntries(keys.filter((k) => betaStepsOf[k].length).map((k) => [k, betaStepsOf[k]])),
  guides,
  locales: localeResults,
  note: showBeta && !hasBetaContent
    ? 'The release marks nothing beta, so there is no badge, banner or marker to check; run with SA_RELEASE_FILE=test/fixtures/release.fixture.json to exercise them.'
    : undefined,
};
console.log(JSON.stringify(result, null, 2));
if (problems.length) {
  console.log(`\nRELEASE MODES: FAIL (${problems.length})\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nRELEASE MODES: PASS (${reached.length} guides numbered consistently; ${showBeta
  ? (hasBetaContent ? `Beta labels checked in English and ${Object.keys(localeResults).length} locales` : 'nothing beta to label')
  : `no lsa-beta- element in any guide or in ${Object.keys(localeResults).length} locales`})`);
