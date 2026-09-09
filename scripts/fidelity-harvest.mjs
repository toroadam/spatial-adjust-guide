// Harvests the REAL IntelliDash label set from a running instance into a fixture.
//
// Why a fixture rather than harvesting inside the gate: the gate runs in CI, and CI cannot do
// Toro SSO. So a human runs this against a live instance, commits the result, and CI diffs
// against it. If a service account ever lands, CI can run this step directly instead — the
// output format is the same either way.
//
// READ-ONLY BY CONSTRUCTION. It opens dialogs and tabs and reads text. It never clicks a
// control whose accessible name matches WRITES. Live Spatial Adjust pushes percent adjustments
// to Lynx; a stray click waters a golf course.
//
// Usage:
//   node scripts/fidelity-harvest.mjs --cdp http://localhost:9222 [--out src/i18n/product-labels.json]
//
// Getting a session: launch a headed browser with remote debugging, log in by hand, then run
// this. It attaches to the existing session rather than trying to authenticate itself.
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const cdp = arg('cdp', 'http://localhost:9222');
const out = arg('out', 'src/i18n/product-labels.json');

// Anything matching this is never clicked, whatever else the script asks for.
const WRITES = /save|apply|push|confirm|delete|remove|send|submit|discard|reset|update from/i;

// Surfaces to visit. Each names the labels it is responsible for, so the gate can report which
// screen a divergence came from rather than just "somewhere".
const SURFACES = [
  {
    key: 'toolbar',
    open: null,                                   // present on load
    read: () => {
      // Values are stripped, not captured. This fixture is committed to a PUBLIC repository, and
      // the live toolbar carries a real course name and live moisture readings. Digit runs
      // collapse to N so the LABELS around them ("AVG. VWC", "HIGH", "RH", "ET") still diff,
      // which is all a label gate needs. The site name is dropped entirely — it is nothing but
      // customer data.
      const scrub = (v) => v.replace(/\d+(?:[.,]\d+)?/g, 'N');
      const t = (sel) => scrub((document.querySelector(sel)?.innerText || '').trim().replace(/\s*\n\s*/g, ' '));
      const texts = (sel) => [...document.querySelectorAll(sel)]
        .map((e) => (e.innerText || '').trim()).filter(Boolean);
      return {
        siteNamePresent: !!document.querySelector('#sa-site-name'),
        // The LABEL spans, not the composite readout. Harvesting `#sa-weather-tb-container`
        // wholesale yields 'N° F N % RH N " ET N "', which is a reading rather than a label and
        // matches nothing in a corpus that names each unit separately.
        weatherLabels: texts('#sa-weather-tb-container .sa-wtv-lbl'),
        moistureLabels: texts('#sa-moisture-info span:not(:has(img))').filter((x) => /[a-z]/i.test(x)),
        pushButton: t('#sa-push-adj-body'),
        // Icon identifiers, not user-facing text. Parked under meta so the gate skips them —
        // asserting the guides contain the string "cog" would be nonsense.
        meta: {
          iconButtons: [...document.querySelectorAll('#toro-app-header-toolbar .toro-app-header-toolbar-button')]
            .map((b) => b.querySelector('fa-icon')?.getAttribute('icon') || b.querySelector('svg')?.getAttribute('data-icon')),
        },
      };
    },
  },
  {
    key: 'settings',
    open: '#toro-app-header-toolbar .toro-app-header-toolbar-button:nth-of-type(2)',
    // Idempotent: if an operator left the dialog open, clicking the gear again is blocked by
    // the dialog's own modal mask and the run dies on a timeout.
    isOpen: () => !!document.querySelector('.sa-dlg-mnu-card'),
    read: () => ({
      dialogTitle: (document.querySelector('.ui-dialog-title, .p-dialog-title')?.innerText || '').trim(),
      dialogHeader: (document.querySelector('.sa-dc-header')?.innerText || '').trim(),
      // The left menu. Hardcoded literals in the product, which is the whole point of reading
      // them from the DOM rather than from the i18n catalogue.
      menu: [...document.querySelectorAll('.sa-dlg-mnu-card')].map((c) => ({
        title: (c.querySelector('.sa-dlg-mc-title')?.innerText || '').trim(),
        description: (c.querySelector('.sa-dlg-mc-desc')?.innerText || '').trim(),
      })),
    }),
  },
];

// Tabs inside the settings dialog. Selecting a tab is a read; nothing persists until Save
// Changes, which is never clicked.
const SETTINGS_TABS = ['Calculation', 'Minimum Threshold', 'Target Profiles', 'Preferences'];

const browser = await chromium.connectOverCDP(cdp);
const ctx = browser.contexts()[0];
if (!ctx) throw new Error(`nothing to attach to at ${cdp} — is the browser running with --remote-debugging-port?`);
const page = ctx.pages().find((p) => /spatialadjust/i.test(p.url()));
if (!page) {
  throw new Error('no Spatial Adjust page open. Log in and navigate to /spatialadjust, then re-run.\n'
    + `  open tabs: ${ctx.pages().map((p) => p.url()).join(', ') || '(none)'}`);
}

async function guardedClick(selector, why) {
  const el = page.locator(selector).first();
  if (!(await el.count())) throw new Error(`${why}: selector not found — ${selector}`);
  const name = ((await el.getAttribute('aria-label')) || (await el.innerText().catch(() => '')) || '').trim();
  if (WRITES.test(name)) throw new Error(`refusing to click "${name}" (${why}) — it may write to Lynx`);
  await el.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
}

const product = { harvestedAt: null, source: page.url(), surfaces: {}, tabs: {} };

for (const s of SURFACES) {
  const alreadyOpen = s.isOpen ? await page.evaluate(s.isOpen) : false;
  if (s.open && !alreadyOpen) await guardedClick(s.open, `open ${s.key}`);
  else if (alreadyOpen) process.stderr.write(`  ${s.key}: already open, not re-clicking\n`);
  product.surfaces[s.key] = await page.evaluate(s.read);
  process.stderr.write(`  ${s.key}: read\n`);
}

// Each settings tab's own pane. Selected by visible label, so a renamed tab surfaces as a
// missing tab here rather than silently harvesting the wrong pane.
for (const label of SETTINGS_TABS) {
  const card = page.locator('.sa-dlg-mnu-card').filter({ hasText: label }).first();
  if (!(await card.count())) { product.tabs[label] = { present: false }; continue; }
  await card.click();
  await page.waitForTimeout(900);
  product.tabs[label] = {
    present: true,
    ...(await page.evaluate(() => {
      const right = document.querySelector('.sa-dcb-container.right');
      return {
        header: (right?.querySelector('.content-header')?.innerText || '').trim(),
        // Column headers and control labels only. Row VALUES are deliberately excluded —
        // they are customer data (course names, station counts, scan dates) and this fixture
        // is committed to a public repository.
        columns: [...(right?.querySelectorAll('th') || [])].map((th) => (th.innerText || '').trim()),
        controls: [...(right?.querySelectorAll('label, .sa-dcb-nt, button') || [])]
          .map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 30),
      };
    })),
  };
  process.stderr.write(`  tab "${label}": ${product.tabs[label].present ? 'read' : 'ABSENT'}\n`);
}

await browser.close();   // detaches CDP; the operator's window stays open

// Stamped after the fact so the harvest itself stays deterministic.
product.harvestedAt = new Date().toISOString();
await writeFile(out, JSON.stringify(product, null, 2) + '\n');
console.log(`${out}: ${Object.keys(product.surfaces).length} surface(s), ${Object.keys(product.tabs).length} settings tab(s)`);
