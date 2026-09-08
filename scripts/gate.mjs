// Verifies the sign-in gate: that it hides the guides, that it admits and rejects the right
// addresses, that the unlock persists, and that the prompt itself is accessible.
//
// ?gate=1 drops the localhost bypass so this runs against the deployed behaviour — see the
// header of src/gate-boot.js. Usage: node scripts/gate.mjs <url>
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const base = (process.argv[2] || '').replace(/\/$/, '');
const gated = `${base}/?gate=1`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));

const state = () => page.evaluate(() => ({
  flag: document.documentElement.getAttribute('data-sa-gate'),
  gateUp: !!document.querySelector('.lsa-gate'),
  // innerText skips visibility:hidden subtrees, so this is a genuine readability check and
  // not merely an assertion about a CSS property being set.
  visibleText: (document.body.innerText || '').trim().length,
  mentionsGuides: /Dashboard overview/i.test(document.body.innerText || ''),
  error: (document.querySelector('.lsa-gate-error')?.textContent || '').trim(),
}));

// Enter an address and submit. Returns the resulting state.
const submit = async (email) => {
  await page.fill('.lsa-gate-input', email);
  await page.click('.lsa-gate-submit');
  await page.waitForTimeout(400);
  return state();
};

const r = {};

await page.goto(gated, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
r.locked = await state();

// The prompt is the only thing a locked-out reader ever sees, so it gets its own axe pass
// rather than riding on the catalogue scan in scripts/a11y.mjs — which never sees it.
const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
r.axeViolations = axe.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`);

r.focusStartsOnInput = await page.evaluate(() => document.activeElement?.id === 'lsa-gate-email');

r.rejectsOutside = await submit('someone@example.com');
// The anchored-dot check in isAllowed() exists for exactly this: a domain that ends with
// the allowed one but isn't it.
r.rejectsLookalike = await submit('someone@nottoro.com');
r.rejectsEmpty = await submit('');
r.acceptsSubdomain = await submit('someone@eu.toro.com');

// Persistence: same gated URL, fresh load, no re-prompt.
await page.goto(gated, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
r.afterReload = await state();

// And clearing the device re-locks, so the unlock is storage and nothing else.
await page.evaluate(() => localStorage.removeItem('sa-guides-gate'));
await page.goto(gated, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
r.afterClear = await state();

// The bypass itself: no ?gate=1, no prompt, guides readable.
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
r.localBypass = await state();

r.errors = [...new Set(errs)];

const pass =
  r.locked.flag === 'locked' && r.locked.gateUp && !r.locked.mentionsGuides &&
  r.axeViolations.length === 0 &&
  r.focusStartsOnInput &&
  r.rejectsOutside.gateUp && r.rejectsOutside.error.length > 0 &&
  r.rejectsLookalike.gateUp &&
  r.rejectsEmpty.gateUp &&
  !r.acceptsSubdomain.gateUp && r.acceptsSubdomain.flag === 'open' &&
  r.afterReload.flag === 'open' && !r.afterReload.gateUp && r.afterReload.mentionsGuides &&
  r.afterClear.flag === 'locked' && r.afterClear.gateUp &&
  r.localBypass.flag === 'open' && !r.localBypass.gateUp && r.localBypass.mentionsGuides &&
  errs.length === 0;

console.log(JSON.stringify(r, null, 2));
console.log(pass ? '\nGATE: PASS' : '\nGATE: FAIL');
await b.close();
process.exit(pass ? 0 : 1);
