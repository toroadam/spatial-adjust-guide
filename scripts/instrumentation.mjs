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
  hadStub,
  externalSeen,
  errors: [...new Set(errors)],
};

const required = ['guide_opened', 'step_advanced'];
const pass =
  required.every((n) => uniq.includes(n)) &&
  report.guidesOpened.length > 0 &&
  (!hadStub || uniq.includes('stub_clicked')) &&
  (!hadFeedbackWidget || uniq.includes('feedback_submitted')) &&
  errors.length === 0;

console.log(JSON.stringify(result, null, 2));
console.log(pass ? '\nINSTRUMENTATION: PASS' : '\nINSTRUMENTATION: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
