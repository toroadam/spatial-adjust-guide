// Smoke test: boot the built bundle in a real browser and assert it renders with no
// external origins. Usage: node scripts/smoke.mjs <url> [--block=<substr>] [--offline]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const block = args.filter((a) => a.startsWith('--block=')).map((a) => a.slice(8));
const offline = args.includes('--offline');

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const external = new Set(), errors = new Set(), failed = new Set(), blocked = new Set();
// "External" means a different origin than the page itself — so this works unchanged
// against localhost, file://, and the deployed site.
const selfOrigin = url.startsWith('file:') ? null : new URL(url).origin;
page.on('request', (r) => {
  const u = r.url();
  if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('file://')) return;
  if (selfOrigin && u.startsWith(selfOrigin)) return;
  external.add(u);
});
page.on('requestfailed', (r) => failed.add(`${r.url()} :: ${r.failure()?.errorText}`));
page.on('pageerror', (e) => errors.add(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.add(`console: ${m.text().slice(0, 200)}`); });

if (block.length) {
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (block.some((b) => u.includes(b))) { blocked.add(u); return route.abort(); }
    return route.continue();
  });
}
// Simulate the CDN being unreachable rather than merely unused.
if (offline) await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());

await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(1500);

// Capture the catalog before navigating away from it.
const home = await page.evaluate(() => {
  const root = document.querySelector('#dc-root');
  const txt = document.body.innerText || '';
  return {
    dcRoot: !!root,
    renderedChars: root ? root.innerHTML.length : 0,
    headings: [...document.querySelectorAll('h1,h2')].slice(0, 4).map((e) => e.innerText.trim()).filter(Boolean),
    cards: (txt.match(/\bMIN\b/g) || []).length,
  };
});

// Open the first live guide so the imported app component actually mounts.
let guide = null;
try {
  await page.getByText('Dashboard overview', { exact: false }).first().click({ timeout: 8000 });
  await page.waitForTimeout(2500);
  guide = await page.evaluate(() => {
    const txt = document.body.innerText || '';
    return {
      stageMounted: !!document.querySelector('.sa-app'),
      steps: (txt.match(/Step \d+/gi) || []).length,
      chars: txt.length,
    };
  });
} catch { /* reported as guide: null */ }

const result = {
  home, guide,
  externalOrigins: [...external],
  blocked: [...blocked].length,
  failed: [...failed],
  errors: [...errors],
};

const pass =
  home.dcRoot &&
  home.renderedChars > 20000 &&
  home.cards === 26 &&
  guide?.stageMounted === true &&
  external.size === 0 &&
  errors.size === 0;

console.log(JSON.stringify(result, null, 2));
console.log(pass ? '\nSMOKE: PASS' : '\nSMOKE: FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
