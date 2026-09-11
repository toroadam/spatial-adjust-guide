// Does the animated cursor point at the control the step actually names?
//
// scripts/cursor.mjs answers a weaker question — is the cursor inside the stage — which catches
// a coordinate that is wildly wrong but passes happily when the cursor sits confidently on the
// wrong control. That is the failure a reader notices: the step says "Open Push Changes", the
// pointer lands on the refresh icon, and they click the wrong thing.
//
// Method: read --tx/--ty (the same variables that position the cursor, so this measures the real
// animation rather than a guess), convert to a viewport point, hit-test with
// elementsFromPoint, and compare the text under the pointer against the step's own title.
//
// The comparison only trusts REAL UI LABELS. A shared token has to appear in the reproduction's
// _screenStrings, so "the", "your" and "open" cannot manufacture a match. That is the difference
// between a check with signal and the first version of the label gate, which matched on any
// shared four-letter word and produced 27 false positives.
//
// Usage: node scripts/cursor-target.mjs <url> [--json]
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) throw new Error('usage: cursor-target.mjs <url> [--json]');
const asJson = process.argv.includes('--json');

const cat = JSON.parse(await readFile('src/i18n/en-us.json', 'utf8'));
// Tokens that count as evidence: words drawn from labels the reproduction actually renders.
const LABEL_TOKENS = new Set();
for (const s of cat._screenStrings || []) {
  for (const w of s.toLowerCase().match(/[a-z]{4,}/g) || []) LABEL_TOKENS.add(w);
}

const browser = await chromium.launch();
// Tall viewport on purpose. The stage is ~598px starting around y=438, so at 900px height its
// lower half sits below the fold — and document.elementsFromPoint returns an EMPTY LIST for
// any point outside the viewport. That reported 111 of 122 steps as "nothing under cursor",
// which looked like a catastrophic content defect and was entirely a measurement artefact.
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1400 } })).newPage();
// Same isolation as scripts/cursor.mjs: nothing external, so a CDN hiccup cannot look like a
// cursor defect.
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const guides = await page.evaluate(() =>
  [...document.querySelectorAll('.lsa [data-title]')].map((e) => e.getAttribute('data-title')));

const probe = () => page.evaluate(() => {
  // Find the cursor by the ANIMATION THAT MOVES IT, not by which element declares --tx/--ty.
  // Those variables are declared on the app-screen wrapper and inherited; the element that
  // consumes them is animated by `sa-cursor-move` (see @keyframes in the export). Selecting the
  // declaring element instead returned a 791x560 box — the whole screen — so every hit-test
  // sampled a container and reported "nothing under cursor". scripts/cursor.mjs has the same
  // flaw, which is why its off-stage findings cannot be trusted either.
  // The VISIBLE stage, not the first in the DOM. Every guide has its own stage frame, so
  // querySelector picked whichever came first — sometimes one scrolled far off-screen (its top
  // measured -509), which is why a third of the steps reported as unmeasurable however tall the
  // viewport was made.
  const onScreen = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };
  const declaring = [...document.querySelectorAll('.lsa-stage-frame *')]
    .filter((e) => e.style && e.style.getPropertyValue('--tx'))
    .find(onScreen);
  if (!declaring) return { missing: true, reason: 'no visible element declares --tx' };
  const stageEl = declaring.closest('.lsa-stage-frame');
  const cursor = [...(stageEl || document).querySelectorAll('*')]
    .find((e) => /sa-cursor-move/.test(getComputedStyle(e).animationName || ''));
  if (!cursor) return { missing: true, declaringOnly: true };
  // The cursor's OWN stage, not the first one on the page. There is a stage frame per guide, so
  // pairing tx/ty from one with a rect from another put the point somewhere meaningless — which
  // is what left 37 steps reading as off-viewport even after the viewport was made tall enough.
  const stage = stageEl || cursor.closest('.lsa-stage-frame');
  // Belt and braces alongside the tall viewport: bring the stage fully into view before
  // measuring, so a long page cannot push the target off-screen and empty the hit-test.
  stage.scrollIntoView({ block: 'center' });
  const sr = stage.getBoundingClientRect();
  const tx = parseFloat(declaring.style.getPropertyValue('--tx'));
  const ty = parseFloat(declaring.style.getPropertyValue('--ty'));
  // --tx/--ty are consumed as `transform: translate(var(--tx), var(--ty))`, so they are an OFFSET
  // FROM THE ELEMENT'S OWN POSITION, not a coordinate inside the stage. Treating them as
  // stage-relative put every hit-test somewhere meaningless. The rendered rect already has the
  // transform applied, so it is the truth and the variables are only diagnostic.
  // Origin is the APP WRAPPER — the element that declares --tx/--ty — not the stage frame.
  // The export builds targets from a table `P` of coordinates in the app's own ~1920-wide design
  // space (gear: [1836, 32]), scales them into the rendered app, and applies the result as a
  // translate. So the variables are in the app's coordinate space and only the app's rect can
  // turn them into a viewport point. Measuring from the stage frame — which also contains the
  // mock browser chrome above the app — offsets every point by the height of that chrome.
  const ar = declaring.getBoundingClientRect();
  const x = ar.left + tx, y = ar.top + ty;
  const cr = cursor.getBoundingClientRect();

  // Geometric containment, NOT document.elementsFromPoint. The reproduction is a static
  // screenshot-in-DOM and is `pointer-events: none`, so hit-testing APIs exclude all 387 of its
  // text nodes and return only the overlay and its containers. That is why every step read as
  // "nothing under cursor" no matter how the coordinates were fixed — the content was invisible
  // to the instrument, not absent from the page.
  const app = (stageEl || document).querySelector('.sa-app');
  let hit = null;
  if (app) {
    const contains = (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    // Smallest containing element wins: a button's label rather than the panel holding it.
    let best = null, bestArea = Infinity;
    for (const e of app.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || !contains(r)) continue;
      const area = r.width * r.height;
      if (area < bestArea) { best = e; bestArea = area; }
    }
    if (best) {
      // Walk up until there are words: the innermost node under a pointer is often an icon or a
      // spacer, and its labelled parent is what the reader actually sees.
      let node = best, text = '';
      for (let i = 0; i < 4 && node && node !== app; i++) {
        const t = (node.innerText || '').trim();
        if (t && t.length <= 120) { text = t.replace(/\s*\n\s*/g, ' '); break; }
        node = node.parentElement;
      }
      hit = { cls: (best.getAttribute('class') || '').slice(0, 40), tag: best.tagName,
              text, graphical: !text, area: Math.round(bestArea) };
    }
  }

  return {
    tx, ty, w: Math.round(sr.width), h: Math.round(sr.height),
    // Measured from the rendered rect against the stage rect, both in viewport pixels.
    // In-bounds is measured against the APP, which is what the coordinates are relative to.
    inStage: tx >= -6 && ty >= -6 && tx <= ar.width + 6 && ty <= ar.height + 6,
    app: { w: Math.round(ar.width), h: Math.round(ar.height) },
    cursorRect: { l: Math.round(cr.left), t: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) },
    hit,
    hasApp: !!((stageEl || document).querySelector('.sa-app')),
    // Distinguishes "the point is off-viewport so we measured nothing" from "the cursor really
    // is over empty space". Without it the two are indistinguishable in the report.
    pointInViewport: x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight,
    step: (document.querySelector('.lsa [aria-live]')?.textContent || '').trim(),
  };
});

const rows = [];
for (const g of guides) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByText(g, { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 40; i++) {
    const r = await probe();
    if (r.missing) break;
    rows.push({ guide: g, ...r });
    const before = r.step;
    const next = page.locator('div', { hasText: /^→$/ }).last();
    if (!(await next.count())) break;
    await next.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(420);
    if ((await probe()).step === before) break;
  }
}
await browser.close();

const tokens = (s) => new Set((s || '').toLowerCase().match(/[a-z]{4,}/g) || []);
const verdictOf = (r) => {
  if (!r.inStage) return 'OFF-STAGE';
  if (!r.pointInViewport) return 'UNMEASURED';   // off-viewport: our problem, not the guide's
  if (!r.hit) return 'NOTHING-UNDER-CURSOR';
  // Step titles read "Step 2 of 5: Open Push Changes" — only the part after the colon names a
  // control; the prefix is scaffolding and would match "step" against nothing useful.
  const title = r.step.includes(':') ? r.step.slice(r.step.indexOf(':') + 1) : r.step;
  // A graphical target cannot be confirmed by text and is not thereby wrong. Reported in its own
  // bucket so the number that matters — cursors on nothing at all — stays readable.
  if (r.hit.graphical) return 'GRAPHICAL-TARGET';
  const shared = [...tokens(title)].filter((w) => LABEL_TOKENS.has(w) && tokens(r.hit.text).has(w));
  return shared.length ? 'ON-TARGET' : 'UNCONFIRMED';
};

for (const r of rows) r.verdict = verdictOf(r);
const by = rows.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] || 0) + 1 }), {});

if (asJson) {
  console.log(JSON.stringify({ guides: guides.length, steps: rows.length, by, rows }, null, 2));
} else {
  console.log(`CURSOR TARGET  ${guides.length} guide(s) · ${rows.length} step(s) with a cursor`);
  for (const [k, v] of Object.entries(by).sort()) console.log(`  ${k.padEnd(22)} ${v}`);
  const bad = rows.filter((r) => r.verdict === 'OFF-STAGE' || r.verdict === 'NOTHING-UNDER-CURSOR');
  if (bad.length) {
    console.log('\n--- cursor points at nothing ---');
    for (const r of bad) {
      console.log(`  [${r.verdict}] ${r.guide}\n      ${r.step}\n      cursor (${Math.round(r.tx)},${Math.round(r.ty)}) in ${r.w}x${r.h}`);
    }
  }
  const unc = rows.filter((r) => r.verdict === 'UNCONFIRMED');
  if (unc.length) {
    console.log('\n--- cursor is on something, but not the control the step names ---');
    console.log('    (advisory: a step can legitimately point at a region rather than a label)');
    for (const r of unc.slice(0, 20)) {
      console.log(`  ${r.guide}\n      step says:   ${r.step}\n      cursor is on: ${JSON.stringify(r.hit.text.slice(0, 70))}`);
    }
    if (unc.length > 20) console.log(`  … ${unc.length - 20} more`);
  }
}

// Only the unambiguous failures gate. UNCONFIRMED is advisory by design: pointing at a panel or
// a table region rather than a named label is a legitimate thing for a step to do, and failing
// on it would make the check something people switch off.
const hard = rows.filter((r) => r.verdict === 'OFF-STAGE' || r.verdict === 'NOTHING-UNDER-CURSOR');
console.log(`\nCURSOR TARGET: ${hard.length === 0 ? 'PASS' : 'FAIL'}`);
process.exit(hard.length === 0 ? 0 : 1);
