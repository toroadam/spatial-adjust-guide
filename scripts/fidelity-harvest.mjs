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
import { writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const cdp = arg('cdp', 'http://localhost:9222');
const out = arg('out', 'src/i18n/product-labels.json');
const id = arg('id', '/Users/adammunir/IntelliDash/site/src');

// Anything matching this is never clicked, whatever else the script asks for.
const WRITES = /save|apply|push|confirm|delete|remove|send|submit|discard|reset|update from/i;

// Where shipped-ness is decided: a settings tab whose menu entry is commented out here is in
// flight on dev but not in the product readers have.
const SETTINGS_DLG = 'app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts';
// The station drill level's table header. The fixture is harvested at the AGGREGATE level, so a
// live capture can never see it, and drilling in would mean clicking rows carrying Enable
// toggles. The product's own template names those columns as translate keys instead.
const DASH_TABLE = 'app/spatial-adjust/components/sa-dashboard/sa-dash-table/sa-dash-table.component.html';
const PRODUCT_CATALOGUE = 'assets/i18n/en-us.json';
const flatten = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flatten(v, `${p}${k}.`, out);
    else out[`${p}${k}`] = v;
  }
  return out;
};

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
    // Selected by ICON, never by position. `:nth-of-type(2)` counts sibling DIVs regardless of
    // class, and the toolbar's first child is a separator — so it resolved to the
    // refresh-scan-data button and this script clicked it on a live instance. Requesting a scan
    // is not a write, but it was not ours to trigger, and the guard could not catch it because
    // that button has no accessible name to match against.
    open: '#toro-app-header-toolbar .toro-app-header-toolbar-button:has(fa-icon[icon="cog"])',
    expectIcon: 'cog',
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

// Surfaces that need NO click at all — they are on screen at load. Free coverage, and no
// interaction risk whatsoever, which is why they come before anything that opens a dialog.
SURFACES.push(
  {
    key: 'table',
    open: null,
    read: () => {
      // The column titles are not in <th> — the table is div-based — so the header row is found
      // by looking for the element that contains all of them. Deterministic and self-describing,
      // where a brittle class selector would silently harvest nothing (and did: an earlier probe
      // for '#sa-dashboard th' returned an empty list and looked like "no columns exist").
      const all = [...document.querySelectorAll('#sa-dashboard *')].filter((e) => {
        const t = e.textContent || '';
        return /Avg\. VWC/.test(t) && /Last Scan/.test(t) && /Enable/.test(t) && e.children.length <= 10;
      });
      const row = all[all.length - 2] || all[all.length - 1];
      const leaves = row ? [...row.querySelectorAll('*')]
        .filter((x) => x.children.length === 0 && (x.innerText || '').trim())
        .map((x) => x.innerText.trim()) : [];
      // WHICH DRILL LEVEL this table is showing. The product swaps its header on
      // `tableDataType == TableDataType.Station`: aggregates get Avg. Target VWC and Last Scan,
      // stations get Target VWC plus Adjustment / Current / Suggested / % Adj. Recording the
      // level is what stops the gate comparing a course-level harvest against a station-level
      // figure and blaming the guides for the difference.
      const cols = [...new Set(leaves)];
      const level = cols.some((c) => /% Adj\.|Suggested|Adjustment/i.test(c)) ? 'station'
        : cols.some((c) => /Last Scan|Avg\. Target VWC/i.test(c)) ? 'aggregate' : 'unknown';
      return {
        // Under meta, which the gate's collector skips. As a plain field it was itself harvested
        // as a product label, and the gate duly reported that the guides never show the word
        // "aggregate" — the same leak the toolbar's icon names caused.
        meta: { level },
        columns: cols,
        breadcrumb: [...document.querySelectorAll('.sa-breadcrumbs .ui-menuitem-text')]
          .map((e) => (e.innerText || '').trim()).filter(Boolean),
        toolbarLinks: [...document.querySelectorAll('.sa-thf-link-text')]
          // Thresholds are per-user settings, so the Over/Under link carries live numbers.
          .map((e) => (e.innerText || '').trim().replace(/\d+(?:[.,]\d+)?/g, 'N')),
      };
    },
  },
  {
    key: 'map',
    open: null,
    read: () => {
      const leaves = [...document.querySelectorAll('#sa-map-overlay-container *')]
        .filter((e) => e.children.length === 0 && (e.innerText || '').trim())
        .map((e) => (e.innerText || '').trim());
      return {
        // Band boundaries are user-configurable, so the digits are data. The bands themselves
        // are what the guides reproduce, and their DEFAULTS were already corrected once
        // (transform 3) after the guide quoted one course's saved preference as the default.
        legend: [...new Set(leaves.filter((t) => /%/.test(t)))].map((t) => t.replace(/\d+/g, 'N')),
        controls: [...new Set(leaves.filter((t) => !/%/.test(t)))],
      };
    },
  },
  {
    key: 'filters',
    open: null,
    read: () => ({
      tabs: [...new Set([...document.querySelectorAll('#sa-dashboard *')]
        .filter((e) => e.children.length === 0 && /All Stations|Over\/Under/i.test(e.innerText || ''))
        .map((e) => (e.innerText || '').trim()))],
    }),
  },
);

// NOT HARVESTED, deliberately, and this is the honest limit of the fixture:
//
//   Push Changes  — the toolbar button's handler is onPushChanges (sa-main-toolbar.component.ts:252),
//                   which calls saPushChangesService.processItemsWithDelay and WRITES TO LYNX.
//                   It is the confirm path, not just an opener. Nothing automated goes near it.
//   Bulk Adjust   — opening is a read and guardedClick would permit it, but its confirm is
//                   "Apply to all", one mis-selected locator away. The last locator that matched
//                   loosely picked CONTINUE EDITING over DISCARD CHANGES.
//   Over/Under    — same shape.
//
// These three want supervised capture: a human opens the dialog, then runs the harvest. Worth
// noting the discard-changes guard fires even when nothing was edited — merely selecting Settings
// tabs marks the form dirty, which is a product bug in its own right.

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

async function guardedClick(selector, why, expectIcon) {
  const el = page.locator(selector).first();
  if (!(await el.count())) throw new Error(`${why}: selector not found — ${selector}`);
  // Identity check before the name check. Icon buttons carry no accessible name, so the WRITES
  // guard cannot see them at all — a selector that drifts onto the wrong icon button sails
  // straight through. Asserting the icon is the only thing that catches it.
  if (expectIcon) {
    const got = await el.locator('fa-icon').first().getAttribute('icon').catch(() => null);
    if (got !== expectIcon) {
      throw new Error(`${why}: resolved to icon "${got}", expected "${expectIcon}" — refusing to click.\n`
        + `  A positional selector here once resolved to refresh-scan-data instead of the gear.`);
    }
  }
  const name = ((await el.getAttribute('aria-label')) || (await el.innerText().catch(() => '')) || '').trim();
  if (WRITES.test(name)) throw new Error(`refusing to click "${name}" (${why}) — it may write to Lynx`);
  await el.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
}

const product = { harvestedAt: null, source: page.url(), surfaces: {}, tabs: {} };

// Whether this run opened the Settings dialog itself. Anything we opened, we close.
let weOpenedSettings = false;

for (const s of SURFACES) {
  const alreadyOpen = s.isOpen ? await page.evaluate(s.isOpen) : false;
  if (s.key === 'settings' && !alreadyOpen) weOpenedSettings = true;
  if (s.open && !alreadyOpen) await guardedClick(s.open, `open ${s.key}`, s.expectIcon);
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

// Put the page back. Leaving the dialog open masks everything beneath it, so the next run finds
// its own gear click intercepted — which is exactly what happened, and it cost an attempt at the
// diagnostics dialog before the cause was obvious. A harvest that mutates the operator's screen
// and walks away is a harvest nobody will run twice.
if (weOpenedSettings) {
  const cancel = page.locator('.ui-dialog button').filter({ hasText: /^Cancel$/ }).first();
  if (await cancel.count()) { await cancel.click().catch(() => {}); await page.waitForTimeout(900); }
  // Selecting tabs marks the form dirty even with nothing edited (a product bug in the an internal work item
  // guard), so the discard confirmation appears. DISCARD CHANGES matched by EXACT text: a loose
  // /continue|discard/ alternation once picked CONTINUE EDITING and did the opposite. Discarding
  // writes nothing — it is "exit without saving". Save Changes is never touched.
  const discard = page.locator('.ui-dialog button').filter({ hasText: /^DISCARD CHANGES$/i }).first();
  if (await discard.count()) { await discard.click().catch(() => {}); await page.waitForTimeout(1200); }
  const left = await page.locator('.ui-dialog-mask').count();
  process.stderr.write(left ? `  WARNING: ${left} dialog mask(s) still open — close manually\n`
                            : '  settings dialog closed, page restored\n');
}

await browser.close();   // detaches CDP; the operator's window stays open

// Stamped after the fact so the harvest itself stays deterministic.
// A surface that read as empty means a selector drifted, and a fixture full of empty surfaces
// makes the gate PASS by having nothing to compare — the worst possible failure for a gate.
// This is exactly what happened when the gear selector hit the wrong button: the settings menu
// came back empty, four tabs reported absent, and the Target Profiles findings silently vanished.
const empty = [
  ...Object.entries(product.surfaces).filter(([, v]) => !Object.values(v).some(
    (x) => (Array.isArray(x) ? x.length : typeof x === 'string' ? x.trim() : x))).map(([k]) => `surface:${k}`),
  ...Object.entries(product.tabs).filter(([, v]) => !v.present).map(([k]) => `tab:${k}`),
];
if (empty.length) {
  throw new Error(`harvest produced empty surface(s): ${empty.join(', ')}\n`
    + `  A selector has drifted. Refusing to write a fixture the gate would pass against.`);
}

// Which settings tabs the dev instance shows but the SHIPPING branch does not. The fixture is
// harvested from dev, and dev can be running an unmerged branch — Target Profiles is, under
// an internal work item. The gate forgives those labels instead of holding the guides to UI no reader can
// reach, and it must reach the same verdict in CI, which has no IntelliDash checkout. So the
// fact is recorded HERE, where a checkout exists, and travels in the fixture.
product.inFlight = { tabs: [], source: SETTINGS_DLG, derivedFrom: null };
product.stationHeader = { columns: [], source: DASH_TABLE, derivedFrom: null };
try {
  const dlg = await readFile(`${id}/${SETTINGS_DLG}`, 'utf8');
  product.inFlight.tabs = [...dlg.matchAll(/^\s*\/\/\s*new SaDlgMenuItem\('([^']+)'/gm)].map((m) => m[1]);
  product.inFlight.derivedFrom = 'commented-out SaDlgMenuItem entries in the shipping branch';

  const tpl = await readFile(`${id}/${DASH_TABLE}`, 'utf8');
  const branch = tpl.slice(tpl.indexOf('tableDataType == TableDataType.Station'));
  const stop = branch.indexOf('id="sa-tc-body"');
  const keys = [...new Set([...(stop > 0 ? branch.slice(0, stop) : branch)
    .matchAll(/'([A-Z0-9_]+(?:\.[A-Z0-9_]+)+)'\s*\|\s*translate/g)].map((m) => m[1]))];
  const raw = flatten(JSON.parse(await readFile(`${id}/${PRODUCT_CATALOGUE}`, 'utf8')));
  product.stationHeader.columns = keys.map((k) => ({ key: k, text: raw[k] })).filter((x) => x.text);
  product.stationHeader.derivedFrom = 'Station branch of the dashboard table template, resolved against the shipped catalogue';
} catch {
  // No checkout here. Carry the previous answer forward rather than silently dropping it and
  // turning six forgiven labels back into build failures.
  try {
    const prev = JSON.parse(await readFile(out, 'utf8'));
    if (prev.inFlight) product.inFlight = prev.inFlight;
    if (prev.stationHeader) product.stationHeader = prev.stationHeader;
    if (prev.inFlight || prev.stationHeader) {
      console.error(`note: no checkout at ${id} — kept the previous inFlight `
        + `(${prev.inFlight?.tabs.join(', ') || 'empty'}) and station header `
        + `(${prev.stationHeader?.columns.length || 0} column(s)).`);
    }
  } catch { /* no previous fixture either: nothing is known to be in flight */ }
}

product.harvestedAt = new Date().toISOString();
await writeFile(out, JSON.stringify(product, null, 2) + '\n');
console.log(`${out}: ${Object.keys(product.surfaces).length} surface(s), ${Object.keys(product.tabs).length} settings tab(s)`);
