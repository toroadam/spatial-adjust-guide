// Proves the event layer records what an internal work item needs to answer, by driving the real UI.
// Usage: node scripts/instrumentation.mjs <url>
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Stub prompt/open so the feedback flows run unattended.
await page.addInitScript(() => {
  window.prompt = () => 'automated test note';
  window.open = () => null;
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });

// src/analytics.js keeps a closed event list and rejects anything not on it with a console
// WARNING, not an error — so a caller emitting an event nobody added to EVENTS records nothing
// and no test notices. That is exactly how the entire gate and locale instrumentation came to be
// silently discarded. Warnings are cheap to watch; this one is not optional.
const rejected = new Set();
page.on('console', (m) => {
  if (m.type() === 'warning' && /unknown event/.test(m.text())) rejected.add(m.text().slice(0, 120));
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const events = () => page.evaluate(() => (window.__saReport ? window.__saReport().raw : []).map((e) => e.name));

// 1. open a live guide
await page.getByText('Dashboard overview', { exact: false }).first().click();
await page.waitForTimeout(2000);

// 2. advance a few steps, then jump to the last to trigger completion
for (let i = 0; i < 2; i++) {
  await page.locator('div', { hasText: /^→$/ }).last().click().catch(() => {});
  await page.waitForTimeout(350);
}
const rail = page.locator('[role="button"]').filter({ hasText: /Check the counts|Confirm|Verify|Read the map/i });
if (await rail.count()) await rail.last().click().catch(() => {});
await page.waitForTimeout(500);

// 3. "Was this helpful?" at the bottom of the page — the Yes path stays in-page
const fbYes = page.locator('.lsa-helpful-btn[data-v="yes"]');
const hadFeedbackWidget = (await fbYes.count()) > 0;
if (hadFeedbackWidget) { await fbYes.first().click(); await page.waitForTimeout(300); }

// 3b. the "No" path opens the collection dialog. Driven in full because the draft is the whole
// point of the feedback rework: a note must survive a cancel, which window.prompt could not do.
// On a SECOND guide: answering Yes above replaces the widget with its confirmation, so the
// thumbs-down no longer exists on that page. Reached by clicking through the catalogue rather
// than by setting location.hash — a same-document hash change does not reliably drive the
// runtime's router from Playwright, and silently left this whole block unexercised.
await page.locator('.lsa [role="button"]').filter({ hasText: /All tasks/ }).first().click().catch(() => {});
await page.waitForTimeout(1800);
await page.getByText('Map navigation', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(2000);
const fbNo = page.locator('.lsa-helpful-btn[data-v="no"]');
let draftSurvivedCancel = null;
let detailSubmitted = null;
if (await fbNo.count()) {
  await fbNo.first().click();
  await page.waitForTimeout(300);
  const input = page.locator('.lsa-fb-input');
  const dialogOpened = (await input.count()) > 0;
  if (dialogOpened) {
    await input.fill('automated test note');
    await page.waitForTimeout(150);
    // Cancel, not submit: this is the case that used to lose everything typed.
    await page.locator('.lsa-fb-cancel').click();
    await page.waitForTimeout(200);
    const stored = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('sa.feedback.draft') || 'null'); } catch (e) { return null; }
    });
    // Reopening must show the note back, not an empty box.
    await fbNo.first().click();
    await page.waitForTimeout(300);
    const restored = await page.locator('.lsa-fb-input').inputValue().catch(() => '');
    draftSurvivedCancel = !!(stored && stored.note === 'automated test note') && restored === 'automated test note';

    await page.locator('.lsa-fb-send').click();
    await page.waitForTimeout(300);
    detailSubmitted = (await events()).includes('feedback_detailed');
    // Submitting clears the draft — a sent note left in storage would come back next time.
    const afterSend = await page.evaluate(() => localStorage.getItem('sa.feedback.draft'));
    if (afterSend !== null) detailSubmitted = false;
  }
}

// 4. back to the catalog, then activate a stub card to record demand
await page.locator('.lsa [role="button"]').filter({ hasText: /All tasks/ }).first().click().catch(() => {});
await page.waitForTimeout(1800);
const stub = page.locator('.lsa [data-stub="true"]').first();
const hadStub = (await stub.count()) > 0;
if (hadStub) { await stub.click(); await page.waitForTimeout(400); }

const report = await page.evaluate(() => window.__saReport());
const names = report.raw.map((e) => e.name);
const uniq = [...new Set(names)];

// The site must still make no external requests: events stay in localStorage by default.
const externalSeen = await page.evaluate(() => window.__saExternalSeen || false);

const result = {
  totalEvents: report.events,
  distinctEvents: uniq,
  guidesOpened: report.guidesOpened,
  stubDemand: report.stubDemand,
  hadFeedbackWidget,
  draftSurvivedCancel,
  detailSubmitted,
  hadStub,
  externalSeen,
  rejectedEvents: [...rejected],
  errors: [...new Set(errors)],
};

const required = ['guide_opened', 'step_advanced'];
const pass =
  required.every((n) => uniq.includes(n)) &&
  report.guidesOpened.length > 0 &&
  (!hadStub || uniq.includes('stub_clicked')) &&
  (!hadFeedbackWidget || uniq.includes('feedback_submitted')) &&
  // null means the path was not reachable in this run; false means it was and it broke.
  draftSurvivedCancel !== false &&
  detailSubmitted !== false &&
  rejected.size === 0 &&
  errors.length === 0;

console.log(JSON.stringify(result, null, 2));
console.log(pass ? '\nINSTRUMENTATION: PASS' : '\nINSTRUMENTATION: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
