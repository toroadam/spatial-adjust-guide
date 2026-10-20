// Proves the interface is operable by keyboard alone: tab to a guide card, activate it
// with Enter, advance a step with the keyboard, and confirm the live region updates.
// Then the chapter strip (src/player.js): Tab reaches every segment, and Enter and Space on a
// segment move the player to that step, with the live region and aria-current following, and
// Space does not start play-all. Attribute presence is not enough — this drives the real thing.
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

// 2. Any unwritten guides are requestable, so they ARE focusable buttons — but their
//    accessible name must say they aren't written, and none may claim to be disabled.
//    The count is not asserted: every guide is now written, so this is legitimately 0.
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

// 6 (below 5 so the focus check still sees the Next control). The chapter strip.
const live = () => page.evaluate(() => document.querySelector('[aria-live]')?.textContent?.trim() || '');
const seg = () => page.evaluate(() => {
  const e = document.activeElement;
  return e && e.classList.contains('lsa-strip-seg') ? Number(e.getAttribute('data-sa-n')) : 0;
});
const current = () => page.evaluate(() =>
  Number(document.querySelector('.lsa-strip-seg[aria-current="step"]')?.getAttribute('data-sa-n') || 0));
async function stripChecks() {
  const out = {};
  out.segments = await page.evaluate(() => document.querySelectorAll('.lsa-strip-seg').length);
  out.group = await page.evaluate(() => {
    const g = document.querySelector('.lsa-strip');
    return g ? { role: g.getAttribute('role'), label: g.getAttribute('aria-label') } : null;
  });
  // The strip sits under the stage, before the step panel, so it is behind the Next control.
  let found = 0;
  for (let i = 0; i < 60 && !found; i++) { await page.keyboard.press('Shift+Tab'); found = await seg(); }
  // Back to the first segment, then forward through every one of them in order.
  while (found > 1) { await page.keyboard.press('Shift+Tab'); found = await seg(); }
  const visited = [];
  for (let n = await seg(); n; n = await seg()) { visited.push(n); await page.keyboard.press('Tab'); }
  out.tabOrder = visited;
  out.tabReachesEvery = out.segments > 1 && visited.length === out.segments
    && visited.every((n, i) => n === i + 1);

  // Enter on the last segment.
  for (let i = 0; i < out.segments + 2 && (await seg()) !== out.segments; i++) await page.keyboard.press('Shift+Tab');
  const beforeEnter = await live();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  out.enter = { before: beforeEnter, after: await live(), current: await current(), focus: await seg() };
  out.enter.ok = out.enter.after !== beforeEnter
    && out.enter.after.startsWith(`Step ${out.segments} of ${out.segments}`)
    && out.enter.current === out.segments && out.enter.focus === out.segments;

  // Space on the first segment. Play-all also starts from step 1, so wait past its 4.2s tick: had
  // Space reached the guide's own shortcut, the player would have moved on to step 2 by then.
  while ((await seg()) > 1) await page.keyboard.press('Shift+Tab');
  const beforeSpace = await live();
  await page.keyboard.press(' ');
  await page.waitForTimeout(900);
  out.space = { before: beforeSpace, after: await live(), current: await current(), focus: await seg() };
  await page.waitForTimeout(4200);
  out.space.afterPlayAllTick = await live();
  out.space.ok = out.space.after !== beforeSpace && out.space.after.startsWith(`Step 1 of ${out.segments}`)
    && out.space.current === 1 && out.space.focus === 1 && out.space.afterPlayAllTick === out.space.after;

  out.focusVisible = await page.evaluate(() => {
    const e = document.activeElement;
    if (!e || !e.classList.contains('lsa-strip-seg')) return false;
    const st = getComputedStyle(e);
    return st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0;
  });
  out.ok = !!out.group && out.group.role === 'group' && !!out.group.label
    && out.tabReachesEvery && out.enter.ok && out.space.ok && out.focusVisible;
  return out;
}

// 5. Focus must be visible.
results.focusVisible = await page.evaluate(() => {
  const e = document.activeElement;
  if (!e) return false;
  const s = getComputedStyle(e);
  return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0);
});

results.chapterStrip = await stripChecks();

const pass =
  !!results.reachedCardByTab &&
  (results.stubs.count === 0 || results.stubs.allFocusable) &&
  results.stubs.allNamedAsUnwritten &&
  !results.stubs.anyFalselyDisabled &&
  results.openedGuideViaEnter &&
  results.advancedStepByKeyboard.changed &&
  results.focusVisible &&
  results.chapterStrip.ok;

console.log(JSON.stringify(results, null, 2));
console.log(pass ? '\nKEYBOARD: PASS' : '\nKEYBOARD: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
