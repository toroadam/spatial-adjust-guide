// Verifies the animated cursor lands inside the visible stage for every step of every guide.
// The cursor is positioned by --tx/--ty, derived from each step's TARGETS coordinate, so
// reading those variables checks the real thing rather than guessing at a DOM node.
import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
const guides = await p.evaluate(() =>
  [...document.querySelectorAll('.lsa [data-title]')].map(e => e.getAttribute('data-title')));

const read = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('.lsa-stage-frame *')]
    .find(e => e.style && e.style.getPropertyValue('--tx'));
  if (!el) return { missing: true };
  const stage = document.querySelector('.lsa-stage-frame');
  const r = stage.getBoundingClientRect();
  const tx = parseFloat(el.style.getPropertyValue('--tx'));
  const ty = parseFloat(el.style.getPropertyValue('--ty'));
  return { tx, ty, w: Math.round(r.width), h: Math.round(r.height),
           step: (document.querySelector('.lsa [aria-live]')?.textContent || '').trim() };
});

let checked = 0; const off = [];
for (const g of guides) {
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.getByText(g, { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1400);
  for (let i = 0; i < 40; i++) {
    const r = await read();
    if (r.missing) break;
    checked++;
    const pad = 6;
    if (r.tx < -pad || r.ty < -pad || r.tx > r.w + pad || r.ty > r.h + pad)
      off.push(`${g} :: ${r.step} :: (${Math.round(r.tx)},${Math.round(r.ty)}) stage ${r.w}x${r.h}`);
    const before = r.step;
    const next = p.locator('div', { hasText: /^→$/ }).last();
    if (!(await next.count())) break;
    await next.click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(420);
    const after = (await read()).step;
    if (before === after) break;
  }
}
console.log(JSON.stringify({ guides: guides.length, stepsChecked: checked, offStage: off.length, examples: off.slice(0, 6) }, null, 2));
await b.close();
process.exit(off.length === 0 ? 0 : 1);
