// Proves the interface is operable by keyboard alone: tab to a guide card, activate it
// with Enter, advance a step with the keyboard, and confirm the live region updates.
// Attribute presence is not enough — this drives the real thing.
//
// Then the video panel, on dashboard-overview with fixture media (scripts/lib/media-fixture.mjs):
// Tab must reach the video, which shows a focus ring, and go on to the transcript toggle, which
// shows one too and opens with Enter.
import { chromium } from 'playwright';
import { installMediaFixture } from './lib/media-fixture.mjs';

const url = process.argv[2];
const base = url.replace(/#.*$/, '').replace(/\/?$/, '/');
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

// 5. Focus must be visible.
results.focusVisible = await page.evaluate(() => {
  const e = document.activeElement;
  if (!e) return false;
  const s = getComputedStyle(e);
  return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0);
});

// 6. The video panel. A fresh context, so focus starts from the top of a deep-linked guide.
const mediaPage = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await installMediaFixture(mediaPage);
await mediaPage.goto(`${base}#/dashboard-overview`, { waitUntil: 'networkidle' });
await mediaPage.waitForSelector('.lsa-media video', { timeout: 10000 });
await mediaPage.waitForTimeout(800);

// What has focus, and whether it shows a ring. Focus inside the video's own controls leaves the
// video as document.activeElement (it is their shadow host), so "on the video" covers both.
const mediaFocus = () => mediaPage.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return { on: null, ring: false };
  const s = getComputedStyle(e);
  const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
  if (e.matches('.lsa-media video')) return { on: 'video', ring };
  if (e.matches('.lsa-media-transcript summary')) return { on: 'summary', ring };
  return { on: e.tagName.toLowerCase(), ring };
});

const media = { reachedVideo: false, videoRing: false, reachedTranscript: false, transcriptRing: false, tabs: 0 };
for (let i = 0; i < 80 && !media.reachedTranscript; i++) {
  await mediaPage.keyboard.press('Tab');
  media.tabs = i + 1;
  const f = await mediaFocus();
  if (f.on === 'video' && !media.reachedVideo) { media.reachedVideo = true; media.videoRing = f.ring; media.videoAtTab = i + 1; }
  // The toggle only counts once the video has been passed: the panel's order is video, then transcript.
  if (f.on === 'summary' && media.reachedVideo) { media.reachedTranscript = true; media.transcriptRing = f.ring; }
}
if (media.reachedTranscript) {
  await mediaPage.keyboard.press('Enter');
  await mediaPage.waitForTimeout(600);
}
Object.assign(media, await mediaPage.evaluate(() => {
  const d = document.querySelector('.lsa-media-transcript');
  return { transcriptOpen: !!d && d.open, transcriptCues: document.querySelectorAll('.lsa-media-transcript-body p').length };
}));
results.media = media;

const pass =
  media.reachedVideo &&
  media.videoRing &&
  media.reachedTranscript &&
  media.transcriptRing &&
  media.transcriptOpen &&
  !!results.reachedCardByTab &&
  (results.stubs.count === 0 || results.stubs.allFocusable) &&
  results.stubs.allNamedAsUnwritten &&
  !results.stubs.anyFalselyDisabled &&
  results.openedGuideViaEnter &&
  results.advancedStepByKeyboard.changed &&
  results.focusVisible;

console.log(JSON.stringify(results, null, 2));
console.log(pass ? '\nKEYBOARD: PASS' : '\nKEYBOARD: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
