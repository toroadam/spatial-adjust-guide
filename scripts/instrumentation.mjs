// Proves the event layer records what the moderated test protocol needs to answer, by driving
// the real UI.
// Usage: node scripts/instrumentation.mjs <url>
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// A stub feedback endpoint, so the panel is exercised without the real flow configured or posted
// to. It records what was sent, answers the way the real flow's Response step does, and can be
// told to fail so the error path runs too.
const STUB = 'https://feedback.invalid/flow';
const posted = [];
await page.addInitScript((u) => {
  window.open = () => null;
  window.__saFeedbackEndpoint = u;
}, STUB);
await page.route(STUB, (r) => {
  if (failNext) return r.abort();
  posted.push(Object.fromEntries(new URLSearchParams(r.request().postData() || '')));
  return r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
});

const errors = [];
let failNext = false;          // set in step 3 to make the stub feedback endpoint fail
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
// The browser logs the deliberately failed feedback send (step 3) as a console error; that one,
// and only while the failure is being provoked, is expected.
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (failNext && /Failed to load resource/.test(m.text())) return;
  errors.push('console: ' + m.text().slice(0, 160));
});

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

// 3. the floating Feedback button: open, type, cancel, reopen, send, and fail once.
const fab = page.locator('.lsa-fb-fab');
const hadFeedbackWidget = (await fab.count()) > 0;
const drafted = () => page.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('sa.feedback.draft') || 'null') || {}).note || null; } catch (e) { return null; }
});
let sendBlockedWhenEmpty = null, draftSurvivedCancel = null, sentWithContext = null;
let confirmedAfterSend = null, failureKeptNote = null, escapeReturnsFocus = null;
if (hadFeedbackWidget) {
  await fab.click();
  await page.waitForTimeout(300);
  const input = page.locator('.lsa-fb-input');
  sendBlockedWhenEmpty = await page.locator('.lsa-fb-send').isDisabled();
  await input.fill('automated test note');
  // Cancel, not submit: a note must survive a cancel, and come back when the panel reopens.
  await page.locator('.lsa-fb-cancel').click();
  await page.waitForTimeout(200);
  const stored = await drafted();
  await fab.click();
  await page.waitForTimeout(300);
  draftSurvivedCancel = stored === 'automated test note'
    && (await page.locator('.lsa-fb-input').inputValue()) === 'automated test note';

  await page.locator('.lsa-fb-send').click();
  await page.waitForTimeout(500);
  // What reached the endpoint must carry the page and step, or the widget's point is lost.
  const p0 = posted[0] || {};
  sentWithContext = posted.length === 1 && p0.comment === 'automated test note' && p0.kind === 'Feedback'
    && p0.page === 'Dashboard overview' && /^Step \d+ of \d+/.test(p0.step || '') && !!p0.url && !!p0.locale;
  // "Sent" only after the endpoint answered, and the draft is gone with it.
  confirmedAfterSend = (await page.locator('.lsa-fb-done').count()) === 1
    && (await page.locator('.lsa-fb-input').count()) === 0
    && (await drafted()) === null;
  await page.locator('.lsa-fb-cancel').click();
  await page.waitForTimeout(200);

  // A failed send must say so and cost the reader nothing they typed.
  failNext = true;
  await fab.click();
  await page.waitForTimeout(300);
  await page.locator('.lsa-fb-input').fill('second note');
  await page.locator('.lsa-fb-send').click();
  await page.waitForTimeout(500);
  failureKeptNote = ((await page.locator('.lsa-fb-error').textContent()) || '').trim().length > 0
    && (await page.locator('.lsa-fb-input').inputValue()) === 'second note'
    && (await drafted()) === 'second note'
    && !(await page.locator('.lsa-fb-send').isDisabled());
  failNext = false;

  await page.locator('.lsa-fb-input').focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  escapeReturnsFocus = (await page.locator('.lsa-fb-dlg').count()) === 0
    && (await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('lsa-fb-fab')));
}

// 4. back to the catalog, then activate a stub card to record demand
await page.locator('.lsa [role="button"]').filter({ hasText: /All tasks/ }).first().click().catch(() => {});
await page.waitForTimeout(1800);
const stub = page.locator('.lsa [data-stub="true"]').first();
const hadStub = (await stub.count()) > 0;
if (hadStub) { await stub.click(); await page.waitForTimeout(400); }

// With no endpoint configured, the button must not appear at all: a button that sends nowhere is
// worse than none.
const bare = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await bare.goto(url, { waitUntil: 'networkidle' });
await bare.waitForTimeout(1500);
const hiddenWithoutEndpoint = (await bare.locator('.lsa-fb-fab').count()) === 0;
await bare.close();

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
  sendBlockedWhenEmpty,
  draftSurvivedCancel,
  sentWithContext,
  confirmedAfterSend,
  failureKeptNote,
  escapeReturnsFocus,
  hiddenWithoutEndpoint,
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
  hadFeedbackWidget &&
  uniq.includes('feedback_opened') &&
  uniq.includes('feedback_sent') &&
  sendBlockedWhenEmpty === true &&
  draftSurvivedCancel === true &&
  sentWithContext === true &&
  confirmedAfterSend === true &&
  failureKeptNote === true &&
  escapeReturnsFocus === true &&
  hiddenWithoutEndpoint === true &&
  rejected.size === 0 &&
  errors.length === 0;

console.log(JSON.stringify(result, null, 2));
console.log(pass ? '\nINSTRUMENTATION: PASS' : '\nINSTRUMENTATION: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
