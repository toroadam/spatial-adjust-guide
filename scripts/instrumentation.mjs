// Proves the event layer records what the moderated test protocol needs to answer, by driving
// the real UI.
// Usage: node scripts/instrumentation.mjs <url>
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// A stub feedback form, so the panel is exercised without a real one configured.
await page.addInitScript(() => {
  window.open = () => null;
  window.__saFeedbackForm = { id: 'test-form', fields: { kind: '1', guide: '2', step: '3', locale: '4', url: '5' } };
});
await page.route('https://forms.office.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>stub form</p>' }));

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

// 3. the floating Feedback button opens the panel with the Microsoft Form embedded. No form is
// configured in the build, so a stub one is injected (window.__saFeedbackForm) and every request
// to forms.office.com is answered locally — the test must not depend on, or post to, a real form.
const fab = page.locator('.lsa-fb-fab');
const hadFeedbackWidget = (await fab.count()) > 0;
let formPrefilled = null;
let escapeReturnsFocus = null;
if (hadFeedbackWidget) {
  await fab.click();
  await page.waitForTimeout(300);
  const src = await page.locator('.lsa-fb-frame').getAttribute('src').catch(() => null);
  const q = src ? new URL(src).searchParams : new URLSearchParams();
  // The whole point of embedding: the reader stays here, and never retypes where they were.
  formPrefilled = !!src && q.get('embed') === 'true' && q.get('id') === 'test-form'
    && q.get('r2') === 'Dashboard overview' && /^Step \d+ of \d+/.test(q.get('r3') || '')
    && q.get('r1') === 'Feedback' && !!q.get('r5');
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

// With no form configured — the shipped default — the button must not appear at all: a button
// that opens nothing is worse than none.
const bare = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await bare.goto(url, { waitUntil: 'networkidle' });
await bare.waitForTimeout(1500);
const hiddenWithoutForm = (await bare.locator('.lsa-fb-fab').count()) === 0;
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
  formPrefilled,
  escapeReturnsFocus,
  hiddenWithoutForm,
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
  formPrefilled === true &&
  escapeReturnsFocus === true &&
  hiddenWithoutForm === true &&
  rejected.size === 0 &&
  errors.length === 0;

console.log(JSON.stringify(result, null, 2));
console.log(pass ? '\nINSTRUMENTATION: PASS' : '\nINSTRUMENTATION: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
