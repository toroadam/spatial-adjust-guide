// Verifies the boot splash, which had no coverage at all while the gate, routing, i18n and
// feedback layers each did.
//
// What makes this worth a script rather than a glance: every interesting property of the splash is
// a TIMING or LIFECYCLE property, and all of them fail silently. A splash that never leaves looks
// like a slow site. One that leaves too early flashes and reads as a glitch. One that is hidden
// rather than removed stays reachable by Tab and by a screen reader, so a reader is landed on
// controls inside a thing they cannot see. None of that shows up in a screenshot.
//
// Usage: node scripts/splash.mjs <url>
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) throw new Error('usage: splash.mjs <url>');

// src/splash.js holds the splash for a minimum, deliberately: everything the runtime needs is
// inlined, so a warm load paints in ~30ms and an unheld splash would flicker. Asserted with slack
// below the nominal 650ms — this measures wall clock through a real browser, not a timer.
const MIN_TOLERANCE = 550;   // nominal hold is 650ms in src/splash.js

const HARD_LIMIT = 9000;

const browser = await chromium.launch();

// The markup must be IN the served document, not created by script. src/splash.js runs at the end
// of <body>, so a splash it created itself would appear after the blank page it exists to cover —
// which is the whole bug the build-time injection avoids. Checked without a browser on purpose.
const html = await (await fetch(url)).text();
const inSource = /class="[^"]*lsa-splash/.test(html);

async function run(label, suffix) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

  // Instrumented before any page script runs, so the timeline starts where the reader's does.
  await page.addInitScript(() => {
    window.__probe = { start: Date.now(), ariaBusy: false, removedAt: null, everPresent: false };
    const seen = () => {
      if (!document.documentElement) return;
      if (document.querySelector('.lsa-splash')) window.__probe.everPresent = true;
      if (document.documentElement.getAttribute('aria-busy') === 'true') window.__probe.ariaBusy = true;
      if (window.__probe.everPresent && !document.querySelector('.lsa-splash')
          && window.__probe.removedAt === null) {
        window.__probe.removedAt = Date.now() - window.__probe.start;
      }
    };
    // A 20ms poll, not only a MutationObserver. This script runs before the document exists, so
    // there is no node to observe yet — attaching one here throws and silently loses the whole
    // timeline. The poll also bounds measurement error on the hold, which is the tightest
    // assertion here.
    const tick = setInterval(seen, 20);
    const attach = setInterval(() => {
      if (!document.documentElement) return;
      clearInterval(attach);
      new MutationObserver(seen).observe(document.documentElement,
        { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
    }, 5);
    setTimeout(() => { clearInterval(tick); clearInterval(attach); }, 12000);
  });

  await page.goto(url + suffix, { waitUntil: 'domcontentloaded' });
  // Past the hard limit, so a splash that never leaves is a measured failure rather than a hang.
  await page.waitForTimeout(HARD_LIMIT + 800);

  const probe = await page.evaluate(() => window.__probe);
  const after = await page.evaluate(() => ({
    // Removed, not hidden. A hidden subtree is still tabbable and still announced.
    stillInDom: !!document.querySelector('.lsa-splash'),
    ariaBusyNow: document.documentElement.getAttribute('aria-busy'),
    dismissed: (window.__saReport ? window.__saReport().raw : [])
      .filter((e) => e.name === 'splash_dismissed'),
  }));
  await ctx.close();

  return {
    label,
    appeared: probe.everPresent,
    ariaBusyWhileUp: probe.ariaBusy,
    removedAfterMs: probe.removedAt,
    heldLongEnough: probe.removedAt !== null && probe.removedAt >= MIN_TOLERANCE,
    withinHardLimit: probe.removedAt !== null && probe.removedAt <= HARD_LIMIT + 500,
    removedFromDom: !after.stillInDom,
    ariaBusyCleared: after.ariaBusyNow === null,
    // The event carries the wait it measured, which is the only record of real-world boot time.
    dismissEvents: after.dismissed.length,
    dismissCarriesMs: after.dismissed.length > 0 && typeof after.dismissed[0].props?.ms === 'number',
    errors: [...new Set(errors)],
  };
}

// Two paths, because contentReady() has two branches: the runtime painting, and the gate covering
// the page. With the gate up there is nothing left to wait for, so the splash must still leave —
// otherwise a gated reader sits behind two overlays. ?gate=1 drops the localhost bypass.
const open = await run('ungated', '');
const gated = await run('gated', '?gate=1');

const ok = (r) => r.appeared && r.ariaBusyWhileUp && r.heldLongEnough && r.withinHardLimit
  && r.removedFromDom && r.ariaBusyCleared && r.dismissEvents === 1 && r.dismissCarriesMs
  && r.errors.length === 0;

const pass = inSource && ok(open) && ok(gated);

console.log(JSON.stringify({ inServedSource: inSource, open, gated }, null, 2));
console.log(pass ? '\nSPLASH: PASS' : '\nSPLASH: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
