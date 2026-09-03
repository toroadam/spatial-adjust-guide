// Proves the interface is operable by keyboard alone: tab to a guide card, activate it
// with Enter, advance a step with the keyboard, and confirm the live region updates.
// Attribute presence is not enough — this drives the real thing.
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const active = () => page.evaluate(() => {
  const e = document.activeElement;
  return e ? { tag: e.tagName, role: e.getAttribute('role'), label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 45) } : null;
});

const results = {};

// 1. Tab until a guide card takes focus.
let card = null;
for (let i = 0; i < 25 && !card; i++) {
  await page.keyboard.press('Tab');
  const a = await active();
  if (a?.role === 'button' && /minutes|difficulty/i.test(a.label)) card = a;
}
results.reachedCardByTab = card;

// 2. Unwritten guides are requestable, so they ARE focusable buttons — but their
//    accessible name must say they aren't written, and none may claim to be disabled.
results.stubs = await page.evaluate(() => {
  const stubs = [...document.querySelectorAll('.lsa [data-stub="true"]')];
  return {
    count: stubs.length,
    allFocusable: stubs.length > 0 && stubs.every((e) => e.tabIndex >= 0),
    allNamedAsUnwritten: stubs.every((e) => /not written yet/i.test(e.getAttribute('aria-label') || '')),
    anyFalselyDisabled: stubs.some((e) => e.getAttribute('aria-disabled') === 'true'),
  };
});

// 3. Activate with Enter.
if (card) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);
}
results.openedGuideViaEnter = await page.evaluate(() =>
  /Step 1 of/i.test(document.body.innerText || ''));

// 4. Tab to "Next step" and activate with Space; confirm the live region changed.
const before = await page.evaluate(() => document.querySelector('[aria-live]')?.textContent?.trim() || '');
let hitNext = false;
for (let i = 0; i < 40 && !hitNext; i++) {
  await page.keyboard.press('Tab');
  const a = await active();
  if (a?.label === 'Next step') { await page.keyboard.press(' '); hitNext = true; }
}
await page.waitForTimeout(900);
const after = await page.evaluate(() => document.querySelector('[aria-live]')?.textContent?.trim() || '');
results.advancedStepByKeyboard = { hitNext, before, after, changed: !!before && before !== after };

// 5. Focus must be visible.
results.focusVisible = await page.evaluate(() => {
  const e = document.activeElement;
  if (!e) return false;
  const s = getComputedStyle(e);
  return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0);
});

const pass =
  !!results.reachedCardByTab &&
  results.stubs.count === 17 &&
  results.stubs.allFocusable &&
  results.stubs.allNamedAsUnwritten &&
  !results.stubs.anyFalselyDisabled &&
  results.openedGuideViaEnter &&
  results.advancedStepByKeyboard.changed &&
  results.focusVisible;

console.log(JSON.stringify(results, null, 2));
console.log(pass ? '\nKEYBOARD: PASS' : '\nKEYBOARD: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
