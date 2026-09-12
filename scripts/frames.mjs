// Captures the camera frame of every step: where the figure is cropped, and how big the view is.
//
// Exists to A/B a change to camera(). Framing is shared by all 122 steps, so a fix for three
// off-stage cursors can silently re-crop every other figure and hide the very control its prose
// is describing. Comparing frames before and after is the only way to know it did not.
//
// Usage: node scripts/frames.mjs <url> [--out frames.json]
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = (process.argv[2] || 'http://localhost:8124/').replace(/\/$/, '');
const oi = process.argv.indexOf('--out');
const out = oi > -1 ? process.argv[oi + 1] : '/tmp/frames.json';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1400 } })).newPage();
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const guides = await page.evaluate(() =>
  [...document.querySelectorAll('.lsa [data-title]')].map((e) => e.getAttribute('data-title')));

// The app is painted with `scale(s) translate(-x,-y)`, so the matrix carries the crop origin.
const frame = () => page.evaluate(() => {
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return w * h;
  };
  // The PLAYER's app, not the static figure's. Only the player is painted through camera(); a
  // `.sa-app` inside a plain figure uses fig() and never moves, so measuring it reported zero
  // frames changed by a fix that demonstrably moved three cursors on-stage. The player's element
  // is the 1920x1080 one carrying a non-identity transform.
  const app = [...document.querySelectorAll('.lsa-stage-frame *')]
    .filter((e) => {
      const cs = getComputedStyle(e);
      return cs.width === '1920px' && cs.height === '1080px' && cs.transform !== 'none';
    })
    .map((e) => ({ e, a: visible(e) })).filter((c) => c.a > 0).sort((a, b) => b.a - a.a)[0]?.e;
  if (!app) return { none: true };
  const m = new DOMMatrix(getComputedStyle(app).transform);
  const host = app.closest('.lsa-stage-frame');
  if (!host) return { none: true };
  const hr = host.getBoundingClientRect();
  return {
    step: (document.querySelector('.lsa [aria-live]')?.textContent || '').trim(),
    // scale and crop origin, rounded: sub-pixel jitter is not a reframing.
    s: Math.round(m.a * 1000) / 1000,
    x: Math.round(-m.e / (m.a || 1)),
    y: Math.round(-m.f / (m.a || 1)),
    viewW: Math.round(hr.width / (m.a || 1)),
    viewH: Math.round(hr.height / (m.a || 1)),
  };
});

const rows = [];
for (const g of guides) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.getByText(g, { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1400);
  for (let i = 0; i < 40; i++) {
    const f = await frame();
    if (f.none) break;
    rows.push({ guide: g, ...f });
    const before = f.step;
    const next = page.locator('div', { hasText: /^→$/ }).last();
    if (!(await next.count())) break;
    await next.click({ timeout: 3000 }).catch(() => {});
    let changed = false;
    for (let w = 0; w < 24; w++) {
      await page.waitForTimeout(120);
      const now = await page.evaluate(() =>
        (document.querySelector('.lsa [aria-live]')?.textContent || '').trim());
      if (now && now !== before) { changed = true; break; }
    }
    if (!changed) break;
    await page.waitForTimeout(400);
  }
}
await browser.close();
await writeFile(out, JSON.stringify(rows, null, 2) + '\n');
console.log(`${out}: ${rows.length} step frame(s) across ${guides.length} guide(s)`);
