// Smoke test: boot the built bundle in a real browser and assert it renders with no
// external origins. Usage: node scripts/smoke.mjs <url> [--block=<substr>] [--offline] [--media-fixture]
//
// The video panel (src/media.js) is checked in both modes:
//
//   plain            whatever the build shipped. With no media items (a clean clone, or a local build
//                    without npm run media:fetch) no page may show a panel. With items (CI, where
//                    SA_MEDIA_REQUIRED=1 makes the build stage them) every item's page shows exactly
//                    one panel of the right shape, and a guide without an item shows none.
//   --media-fixture  scripts/lib/media-fixture.mjs injects an episode for dashboard-overview and the
//                    showcase, served by page.route on the page's own origin, so the
//                    zero-external-origins check below still means what it says. The home page shows
//                    the showcase, dashboard-overview its episode, and target-profiles nothing.
//
// A panel of the right shape is one <video> with controls, preload="none", playsinline and a poster,
// never autoplay, muted or loop, and eleven caption tracks (one per locale, distinct srclang) of
// which exactly one is the default.
import { chromium } from 'playwright';
import { CAPTION_LOCALES } from '../src/media/captions.mjs';
import { installMediaFixture } from './lib/media-fixture.mjs';
import { parseShowBeta, loadRelease, isGuideShipped } from '../src/release.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const block = args.filter((a) => a.startsWith('--block=')).map((a) => a.slice(8));
const offline = args.includes('--offline');
const mediaFixture = args.includes('--media-fixture');
const base = url.replace(/#.*$/, '').replace(/\/?$/, '/');

// How many guide cards the catalogue should show: every guide when the build shows beta content,
// the GA guides when SA_SHOW_BETA=false removed it. Read the way build.mjs reads it, from the same
// variable and the same release file (SA_RELEASE_FILE, tests only).
const showBeta = parseShowBeta(process.env.SA_SHOW_BETA);
const { release } = loadRelease();
const expectedCards = Object.keys(release.guides).filter((k) => isGuideShipped(release, k, showBeta)).length;

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
// Registered last so it is consulted first: Playwright runs matching routes newest first, and the
// --block route above would otherwise continue() fixture requests to the real server.
const fixture = mediaFixture ? await installMediaFixture(page) : null;

// ---- the video panel ----------------------------------------------------------------------------
const panelShape = () => page.evaluate(() => {
  const panels = [...document.querySelectorAll('.lsa-media')];
  const videos = [...document.querySelectorAll('.lsa-media video')];
  const v = videos[0] || null;
  const tracks = v ? [...v.querySelectorAll('track')] : [];
  const captions = tracks.filter((t) => t.getAttribute('kind') === 'captions');
  return {
    panels: panels.length,
    keys: panels.map((p) => p.getAttribute('data-sa-media-key')),
    videos: videos.length,
    controls: !!v && v.hasAttribute('controls'),
    preload: v ? v.getAttribute('preload') : null,
    playsinline: !!v && v.hasAttribute('playsinline'),
    poster: v ? v.getAttribute('poster') : null,
    autoplay: !!v && (v.hasAttribute('autoplay') || v.autoplay),
    muted: !!v && v.hasAttribute('muted'),
    loop: !!v && (v.hasAttribute('loop') || v.loop),
    captions: captions.length,
    srclangs: captions.map((t) => t.getAttribute('srclang')),
    defaults: tracks.filter((t) => t.hasAttribute('default')).map((t) => t.getAttribute('srclang')),
  };
});

const panelProblems = (shape, key) => {
  const p = [];
  if (shape.panels !== 1) p.push(`${shape.panels} panels, expected 1`);
  if (shape.keys[0] !== key) p.push(`panel key ${shape.keys[0]}, expected ${key}`);
  if (shape.videos !== 1) p.push(`${shape.videos} videos, expected 1`);
  if (!shape.controls) p.push('no controls');
  if (shape.preload !== 'none') p.push(`preload=${shape.preload}, expected none`);
  if (!shape.playsinline) p.push('no playsinline');
  if (!shape.poster) p.push('no poster');
  if (shape.autoplay) p.push('autoplay');
  if (shape.muted) p.push('muted');
  if (shape.loop) p.push('loop');
  if (shape.captions !== CAPTION_LOCALES.length) p.push(`${shape.captions} caption tracks, expected ${CAPTION_LOCALES.length}`);
  if (new Set(shape.srclangs).size !== shape.srclangs.length) p.push('duplicate srclang');
  if (shape.defaults.length !== 1) p.push(`${shape.defaults.length} default tracks, expected 1`);
  return p;
};

// media.js mounts on the next animation frame after the runtime renders the slot; wait for it when a
// panel is expected, and give it the same time when none is, so "no panel" is not a race.
const settle = async (expectPanel) => {
  if (expectPanel) await page.waitForSelector('.lsa-media video', { timeout: 8000 }).catch(() => {});
  else await page.waitForTimeout(600);
};

const openHash = async (key) => {
  await page.goto(`${base}#/${key}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
};

const panelCount = () => page.evaluate(() => document.querySelectorAll('.lsa-media').length);

// ---- catalogue home -----------------------------------------------------------------------------
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

const items = await page.evaluate(() => (window.__saMedia ? window.__saMedia.items() : null));
const media = { mode: mediaFixture ? 'fixture' : 'plain', items, checks: {}, problems: [] };
const expectPanel = (label, shape, key) => {
  media.checks[label] = shape;
  for (const p of panelProblems(shape, key)) media.problems.push(`${label}: ${p}`);
};
const expectNone = (label, count) => {
  media.checks[label] = { panels: count };
  if (count !== 0) media.problems.push(`${label}: ${count} panel(s), expected none`);
};

if (items === null) media.problems.push('window.__saMedia is missing: src/media.js did not run');

const homeHasShowcase = mediaFixture || (items || []).includes('showcase');
await settle(homeHasShowcase);
if (homeHasShowcase) expectPanel('home', await panelShape(), 'showcase');
else expectNone('home', await panelCount());

// ---- first live guide ---------------------------------------------------------------------------
// Open it by clicking, so the imported app component actually mounts the way a reader gets there.
let guide = null;
try {
  await page.getByText('Dashboard overview', { exact: false }).first().click({ timeout: 8000 });
  await page.waitForTimeout(2500);
  guide = await page.evaluate(() => {
    const txt = document.body.innerText || '';
    return {
      hash: location.hash,
      stageMounted: !!document.querySelector('.sa-app'),
      steps: (txt.match(/Step \d+/gi) || []).length,
      chars: txt.length,
    };
  });
} catch { /* reported as guide: null */ }

if (guide) {
  const has = mediaFixture || (items || []).includes('dashboard-overview');
  await settle(has);
  if (has) expectPanel('dashboard-overview', await panelShape(), 'dashboard-overview');
  else expectNone('dashboard-overview', await panelCount());
}

// ---- the other pages that matter ----------------------------------------------------------------
if (mediaFixture) {
  // A guide with no episode: no panel, and the dashboard-overview episode must not linger.
  await openHash('target-profiles');
  await settle(false);
  media.checks.targetProfilesHash = await page.evaluate(() => location.hash);
  if (media.checks.targetProfilesHash !== '#/target-profiles') media.problems.push(`target-profiles: landed on ${media.checks.targetProfilesHash}`);
  expectNone('target-profiles', await panelCount());
  // Served on the page's own origin: the panel loaded its poster and default track from the fixture.
  media.fixtureRequests = fixture.requests.length;
  if (!fixture.requests.length) media.problems.push('the fixture served nothing: the panel loaded no poster or track');
  if (selfOrigin && fixture.requests.some((u) => !u.startsWith(selfOrigin))) media.problems.push('a fixture request left the page origin');
} else if (items && items.length) {
  // Every shipped item, on its own page, plus one catalogue guide that has none.
  for (const key of items) {
    if (key === 'showcase' || key === 'dashboard-overview') continue; // checked above
    await openHash(key);
    await settle(true);
    expectPanel(key, await panelShape(), key);
  }
  if (!items.includes('target-profiles')) {
    await openHash('target-profiles');
    await settle(false);
    expectNone('target-profiles', await panelCount());
  }
}

const result = {
  home, guide, media,
  expectedCards: { count: expectedCards, mode: showBeta ? 'beta shown' : 'beta hidden' },
  externalOrigins: [...external],
  blocked: [...blocked].length,
  failed: [...failed],
  errors: [...errors],
};

const pass =
  home.dcRoot &&
  home.renderedChars > 20000 &&
  home.cards === expectedCards &&
  guide?.stageMounted === true &&
  media.problems.length === 0 &&
  external.size === 0 &&
  errors.size === 0;

console.log(JSON.stringify(result, null, 2));
console.log(pass ? `\nSMOKE${mediaFixture ? ' (media fixture)' : ''}: PASS` : `\nSMOKE${mediaFixture ? ' (media fixture)' : ''}: FAIL`);
await browser.close();
process.exit(pass ? 0 : 1);
