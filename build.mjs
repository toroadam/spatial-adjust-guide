// Build the Spatial Adjust guide system into a self-contained static bundle.
//
// The Core Design export depends on unpkg.com at runtime and resolves component
// imports with fetch(). Both are removed here without forking support.js, by using
// two hooks the dc-runtime already supports:
//
//   window.__resources      URL -> replacement URL. cdnScriptFor() consults this before
//                           falling back to the unpkg URL, so React/ReactDOM load locally.
//                           Its mere presence also stops boot() re-fetching location.href.
//   window.__resourceBlobs  URL -> Blob. bundledBlob() consults this before fetch(), so the
//                           imported SpatialAdjustApp component is inlined rather than
//                           requested. This is what restores file:// support.
//
// Keeping support.js untouched preserves the Core Design -> web round-trip: re-exporting
// from Core Design means dropping the new .dc.html files in and rebuilding.

import { readFile, writeFile, mkdir, rm, cp, copyFile, readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { transformGuide } from './src/transform-export.mjs';
import { transformApp } from './src/transform-app.mjs';
import { parseShowBeta, loadRelease, isGuideShipped } from './src/release.mjs';
import { evaluateGuideData, catalogueOmissions } from './src/transforms/release-gate.mjs';
import {
  DEFAULT_MANIFEST, DEFAULT_MEDIA_DIR, SHOWCASE_KEY,
  guideKeysFrom, loadManifest, validateManifest, verifyItem,
} from './src/media/manifest.mjs';
import { checkItems, checkSite } from './scripts/media-budget.mjs';
import { DEFAULT_CAPTIONS_DIR, writeCaptionTracks } from './src/media/captions.mjs';
import { loadGuidesFromHtml } from './scripts/lib/load-guides.mjs';
import { checkShape } from './scripts/step-shape.mjs';

const ROOT = import.meta.dirname;
const DIST = join(ROOT, 'dist');

const ENTRY = 'Learn Spatial Adjust.dc.html';
const COMPONENTS = ['SpatialAdjustApp'];

// Copied verbatim into dist. Everything else (screenshots/, uploads/, .thumbnail,
// node_modules/, scripts/) is Core Design tooling or build-time only and must not ship.
const STATIC_DIRS = ['assets', '_ds', 'vendor'];

// Design-system files that never execute or render at runtime.
//
// _ds_bundle.js is a 10MB React component library (Fluent icons + Oasis components). Neither
// .dc.html file references the ToroOasisDesignSystem namespace or any component from it — the
// guides style themselves purely with the CSS custom properties in tokens/. Verified by
// scripts/compare-guides.mjs: fingerprints across all 7 guides are identical with it blocked.
// The others are lint config, build metadata, and docs, referenced by nothing.
const DS_EXCLUDE = ['_ds_bundle.js', '_ds_manifest.json', '_adherence.oxlintrc.json', 'readme.md'];

// Accessibility markup that must survive a Core Design re-export. Each entry is a literal
// the built page is required to contain; the build fails if one goes missing.
const A11Y_GUARDS = [
  ['role="button"', 'keyboard-operable controls'],
  ['aria-live="polite"', 'step-change announcements for screen readers'],
  ['class="lsa-stage-frame"', 'stage hook used by the small-screen fallback'],
  ['{{ task.ariaLabel }}', 'accessible names on guide cards'],
  ['data-sa-media-slot="guide"', 'media panel slot (guide)'],
  ['data-sa-media-slot="home"', 'media panel slot (catalogue home)'],
];

const CDN_MAP = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'vendor/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'vendor/react-dom.production.min.js',
};

// The app component pulls Satoshi from fontshare at runtime; point it at the vendored copy.
const FONT_CDN = 'https://api.fontshare.com/v2/css?f[]=satoshi@1&display=swap';
const FONT_LOCAL = 'vendor/fonts/satoshi.css';

// JSON-encode for embedding inside an inline <script>. The component sources contain their
// own </script> tags, which would otherwise terminate the bootstrap tag early; the HTML parser
// only looks for the literal characters, so escaping the slash is sufficient and JSON-safe.
const enc = (s) =>
  JSON.stringify(s).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

// The glossary: src/terms.json, defined at each term's first use in a guide by the renderer that
// src/transform-export.mjs installs (glossary at point of use). Only the fields the page reads ship;
// the ledger ids are for npm run test:shape, which checks the whole file.
const TERM_FIELDS = ['id', 'term', 'match', 'caseSensitive', 'definition'];

async function loadTerms() {
  const { terms } = JSON.parse(await readFile(join(ROOT, 'src', 'terms.json'), 'utf8'));
  if (!Array.isArray(terms) || !terms.length) throw new Error('src/terms.json has no terms; run npm run test:shape');
  const out = terms.map((t, i) => {
    if (typeof t.term !== 'string' || typeof t.definition !== 'string' || !Array.isArray(t.match)) {
      throw new Error(`src/terms.json term ${i + 1} is malformed; run npm run test:shape`);
    }
    return Object.fromEntries(TERM_FIELDS.map((f) => [f, t[f]]));
  });
  // The bootstrap is spliced in with a replacement string, which would expand a `$&`-style sequence.
  if (JSON.stringify(out).includes('$')) throw new Error('src/terms.json contains "$", which the bootstrap splice would corrupt');
  return out;
}

/** Bootstrap that must execute before support.js reads the two hooks, and before the guide's
 *  first render reads window.__saTerms. */
function bootstrap(componentSources, terms) {
  const blobEntries = Object.entries(componentSources)
    .map(([url, src]) => `  ${enc(url)}: new Blob([${enc(src)}], { type: 'text/html' }),`)
    .join('\n');

  return `<script>
// Generated by build.mjs — redirects the dc-runtime's external lookups to local resources.
window.__resources = {
${Object.entries(CDN_MAP).map(([k, v]) => `  ${enc(k)}: ${enc(v)},`).join('\n')}
};
window.__resourceBlobs = {
${blobEntries}
};
// The glossary terms (src/terms.json), read by the guide's renderVals.
window.__saTerms = ${enc(terms)};
</script>`;
}

// ---- media --------------------------------------------------------------------------------------
//
// Videos are GitHub Release assets, never git objects. src/media/manifest.json pins each one by byte
// count and SHA-256. They cannot be downloaded straight into dist/media/, because main() starts by
// deleting dist/, so `npm run media:fetch` stages them in .media/ (gitignored) and the build copies
// each one in only after it matches its pin. dist/media/ is still what the Pages artifact ships, on
// the site's own origin.
//
//   SA_MEDIA_MANIFEST  another manifest file, for tests (default src/media/manifest.json)
//   SA_MEDIA_DIR       another staging directory, for tests (default .media)
//   SA_MEDIA_CAPTIONS_DIR  another directory of caption catalogues, for tests
//                      (default src/i18n/captions; the fixture is scripts/fixtures/media/captions)
//   SA_MEDIA_REQUIRED  1: a missing staged asset fails the build, which is what CI sets.
//                      Unset, empty or 0: the item is dropped with a warning and its guide shows no
//                      video, the same way the Feedback button is simply absent without an endpoint.
//                      That keeps local builds and clean clones passing with nothing staged.
// A staged file whose size or hash differs from its pin fails the build in every mode.

/** Parse SA_MEDIA_REQUIRED. A value other than unset, empty, 0 or 1 is a typo, so it fails the build. */
function mediaRequired(value) {
  const text = (value ?? '').trim();
  if (text === '1') return true;
  if (text === '' || text === '0') return false;
  throw new Error(`SA_MEDIA_REQUIRED must be unset, empty, 0 or 1; received ${JSON.stringify(value)}`);
}

/**
 * Which guides ship in this build, and so which episodes may: the release rule in src/release.mjs
 * (src/release.json plus SA_SHOW_BETA, read only through that module). main() parses the switch and
 * loads the release once and passes both here, so the media step and the guide transforms can never
 * disagree. When SA_SHOW_BETA is false a beta guide's episode, captions and transcript must be absent
 * from dist/, not hidden. The showcase is not a guide and always ships.
 */
function releaseGate({ showBeta, release }) {
  return {
    // Every guide the release file knows, so a beta guide's item still validates when the release
    // transforms have already removed that guide from the catalogue.
    knownKeys: Object.keys((release && release.guides) || {}),
    isShipped: (key) => key === SHOWCASE_KEY || isGuideShipped(release, key, showBeta),
  };
}

/**
 * Validate the media manifest against the catalogue in the transformed export, check the size caps,
 * verify every staged asset of every shipped item and copy the verified ones into dist/media/.
 * Returns the shipped items, keyed by guide key or "showcase". Everything later that publishes
 * media (caption tracks, transcripts, the page's media list) must be derived from this object and
 * never from the raw manifest, so an item that is left out leaves nothing behind in dist/.
 */
async function stageMedia(html, { showBeta, release }) {
  const required = mediaRequired(process.env.SA_MEDIA_REQUIRED);
  const manifestPath = resolve(ROOT, process.env.SA_MEDIA_MANIFEST || DEFAULT_MANIFEST);
  const mediaDir = resolve(ROOT, process.env.SA_MEDIA_DIR || DEFAULT_MEDIA_DIR);
  const gate = releaseGate({ showBeta, release });
  const guideKeys = new Set([...guideKeysFrom(html), ...gate.knownKeys]);

  const manifest = validateManifest(await loadManifest(manifestPath), { guideKeys });
  const overCap = checkItems(manifest);
  if (overCap.length) throw new Error(`media budget exceeded:\n- ${overCap.join('\n- ')}`);

  const where = (name) => {
    const path = join(mediaDir, name);
    const rel = relative(ROOT, path);
    return rel.startsWith('..') || isAbsolute(rel) ? path : rel;
  };
  const mediaItems = {};
  const fatal = [];
  for (const [key, item] of Object.entries(manifest.items)) {
    if (!gate.isShipped(key)) {
      console.log(`media: ${key} left out - its guide is beta and SA_SHOW_BETA is false`);
      continue;
    }
    const { ok, missing, mismatched } = await verifyItem(item, mediaDir);
    for (const m of mismatched) {
      fatal.push(`media: ${key} ${m.name} ${m.field === 'bytes' ? 'byte count' : 'SHA-256'} mismatch - `
        + `manifest pins ${m.expected}, staged file has ${m.actual}; delete ${where(m.name)} and run npm run media:fetch`);
    }
    if (missing.length) {
      const line = `media: ${key} missing ${missing.join(', ')} - run npm run media:fetch`;
      if (required) fatal.push(line);
      else console.warn(`warning: ${line}. Building without this video (set SA_MEDIA_REQUIRED=1 to fail instead).`);
    }
    if (ok) mediaItems[key] = item;
  }
  if (fatal.length) throw new Error(fatal.join('\n'));

  if (Object.keys(mediaItems).length) await mkdir(join(DIST, 'media'), { recursive: true });
  for (const item of Object.values(mediaItems)) {
    for (const name of [item.file, item.poster]) await copyFile(join(mediaDir, name), join(DIST, 'media', name));
  }
  return mediaItems;
}

async function main() {
  // The release switch. SA_SHOW_BETA is the whole contract with whatever host runs the build: GitHub
  // Actions sets it from a repository variable, an Azure pipeline from a pipeline variable, a laptop
  // inline. Unset means beta content is shown; false removes it from dist/ altogether (see
  // src/release.mjs). Parsed before anything is deleted, so a typo fails the build and leaves the
  // previous dist/ alone.
  const rawShowBeta = process.env.SA_SHOW_BETA;
  const showBeta = parseShowBeta(rawShowBeta);
  const { release, file: releaseFile } = loadRelease();

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // Inline each imported component under the exact URL the runtime will ask for:
  // COMPONENT_DIR + "/" + encodeURIComponent(name) + ".dc.html", with COMPONENT_DIR ".".
  const componentSources = {};
  for (const name of COMPONENTS) {
    const src = await readFile(join(ROOT, `${name}.dc.html`), 'utf8');
    // The reproduction gets its own transform pass, for the same reason the guide document does:
    // hand-edits to a Core Design export do not survive a re-export.
    const transformed = name === 'SpatialAdjustApp' ? transformApp(src) : src;
    componentSources[`./${encodeURIComponent(name)}.dc.html`] = transformed.replace(FONT_CDN, FONT_LOCAL);
  }

  let html = await readFile(join(ROOT, ENTRY), 'utf8');
  html = html.replace(FONT_CDN, FONT_LOCAL);

  // Drop the tag for the excluded design-system bundle so it doesn't 404 at runtime.
  const dsBundleTag = /<script src="[^"]*_ds_bundle\.js"><\/script>\s*/g;
  if (!dsBundleTag.test(html)) throw new Error('_ds_bundle.js script tag not found — check the export');
  html = html.replace(dsBundleTag, '');

  // Apply the accessibility and instrumentation transforms to the raw export. These were
  // once hand-edits in the .dc.html files, which a re-export silently wiped; doing it here
  // makes re-exports free. Each transform asserts its own anchor, so a shape change fails
  // the build rather than quietly dropping keyboard support.
  const exported = html;
  html = transformGuide(exported, { showBeta, release });

  // With beta content removed, the strings only it used must not ship either: a catalogue is
  // fetched by every reader and would publish the beta prose in English. transformGuide() is pure,
  // so running it again with beta shown gives everything a build with beta would publish, and the
  // difference between the two is computed here from src/release.json rather than kept as a list.
  let omitted = null;
  if (!showBeta) {
    const catalogue = JSON.parse(await readFile(join(ROOT, 'src', 'i18n', 'en-us.json'), 'utf8'));
    omitted = catalogueOmissions({
      allData: evaluateGuideData(transformGuide(exported, { showBeta: true, release })),
      shippedData: evaluateGuideData(html),
      release,
      catalogue,
    }).omit;
  }

  // Run after the transforms, so the catalogue keys include the guides they add.
  const mediaItems = await stageMedia(html, { showBeta, release });

  // Eleven caption tracks per shipped video, dist/media/captions/<key>.<locale>.vtt: the English
  // source and one per translated locale, from the caption catalogues (see src/media/captions.mjs).
  // Built from the verified items only, so a video that is left out leaves no tracks behind. A cue
  // with no translation in any locale fails the build, naming the locale and the cue: no partial
  // track ever ships.
  const captionTracks = await writeCaptionTracks({
    items: mediaItems,
    captionsDir: process.env.SA_MEDIA_CAPTIONS_DIR || DEFAULT_CAPTIONS_DIR,
    distDir: DIST,
    root: ROOT,
  });
  const tracks = Object.values(captionTracks).reduce((n, byLocale) => n + Object.keys(byLocale).length, 0);
  // What the page's media panel is told about each shipped video, keyed like mediaItems. Every path
  // is relative to dist/, so the browser loads it from the site's own origin.
  const runtimeItems = Object.fromEntries(Object.entries(mediaItems).map(([key, item]) => [key, {
    kind: item.kind,
    src: `media/${item.file}`,
    type: 'video/mp4',
    poster: `media/${item.poster}`,
    duration: item.duration,
    captions: captionTracks[key],
  }]));

  // Enforce the step standard (docs/writing-guide.md) on the transformed page, in memory: every
  // step has Do, You should see and If not, a Do names an exact [[label]] unless it is a region
  // step, at most eight steps a guide, and a cursor target for each step. This is the same check
  // as `npm run test:shape`, so a guide that breaks the standard cannot reach dist.
  {
    const data = loadGuidesFromHtml(html);
    const shape = checkShape(data);
    if (shape.failed.length) {
      const lines = shape.guides.filter((g) => g.errors.length)
        .flatMap((g) => g.errors.map((e) => `  ${g.key}: ${e}`));
      throw new Error(`Step shape check failed for ${shape.failed.join(', ')}:\n${lines.join('\n')}\n`
        + '  See docs/writing-guide.md, then run `npm run test:shape` for the full table.');
    }
    // The hero link states the catalogue's guide count in plain text. Keep it honest.
    const cards = data.CATEGORIES.reduce((n, c) => n + c.tasks.length, 0);
    if (!html.includes(`or browse all ${cards} tasks ↓`)) {
      throw new Error(`The catalogue has ${cards} guides but the hero link does not say "or browse all ${cards} tasks ↓".\n`
        + '  Update the count in src/transform-export.mjs and the translated key in every src/i18n catalogue.');
    }
  }

  // Belt and braces: confirm the transforms actually produced what the runtime needs.
  for (const [marker, what] of A11Y_GUARDS) {
    if (!html.includes(marker)) {
      throw new Error(
        `Accessibility markup missing after transforms: ${what}\n` +
        `  expected to find: ${marker}\n` +
        `  Check src/transform-export.mjs against the current export.`,
      );
    }
  }

  // Splash markup, injected into the document rather than created by src/splash.js, so it is on
  // screen at first paint instead of after the body scripts run — which is the wait it exists to
  // cover. aria-hidden because it is decorative; splash.js sets aria-busy on <html>, and that is
  // what actually announces the state.
  //
  // This has to happen BEFORE anything is injected into <head>. src/gate-boot.js mentions "<body>"
  // in a comment and ships as an inline script, so a match run after that injection lands inside
  // the script and corrupts it — which is precisely what happened, and what the inline-script
  // parse check below caught. Asserting a single match keeps it honest if the export changes.
  const bodyTags = html.match(/<body[^>]*>/g) || [];
  if (bodyTags.length !== 1) {
    throw new Error(`expected exactly one <body> in the raw export, found ${bodyTags.length}`);
  }
  html = html.replace(bodyTags[0], bodyTags[0] + `
<div class="lsa-splash" aria-hidden="true">
  <img class="lsa-splash-mark" src="assets/toro-logo.svg" alt="">
  <p class="lsa-splash-title">Spatial Adjust Guides</p>
  <div class="lsa-splash-bar"><i></i></div>
  <div class="lsa-skel-grid">
    <div class="lsa-skel-card"></div><div class="lsa-skel-card"></div>
    <div class="lsa-skel-card"></div><div class="lsa-skel-card"></div>
  </div>
</div>`);

  // <html> had no lang, so screen readers guess the pronunciation language.
  html = html.replace(/<html(?![^>]*\blang=)/i, '<html lang="en"');

  // Give the page a real title and description; the export had neither. This must happen
  // BEFORE the bootstrap is inserted: the inlined component source contains its own </head>,
  // and a string-pattern replace would otherwise match that one and corrupt the JS literal.
  const a11yCss = await readFile(join(ROOT, 'src', 'a11y.css'), 'utf8');
  // The Do / You should see / If not rows and start state rendered by src/transform-export.mjs.
  const stepsCss = await readFile(join(ROOT, 'src', 'steps.css'), 'utf8');
  const gateCss = await readFile(join(ROOT, 'src', 'gate.css'), 'utf8');
  const contactCss = await readFile(join(ROOT, 'src', 'contact.css'), 'utf8');
  const feedbackCss = await readFile(join(ROOT, 'src', 'feedback.css'), 'utf8');
  const mediaCss = await readFile(join(ROOT, 'src', 'media.css'), 'utf8');
  const splashCss = await readFile(join(ROOT, 'src', 'splash.css'), 'utf8');
  // The Beta badge, banner and step marker styles ship only with the markup they style: a build with
  // beta content removed carries none of their class names (src/transforms/release-gate.mjs).
  const releaseCss = showBeta ? await readFile(join(ROOT, 'src', 'release.css'), 'utf8') : '';
  // The Double Click treatment in the player: highlight ring, chapter label and chapter strip.
  const playerCss = await readFile(join(ROOT, 'src', 'player.css'), 'utf8');
  // Resolved in <head>, synchronously, so the gate decision is made before the first paint
  // rather than after — see the header of src/gate-boot.js.
  const gateBoot = await readFile(join(ROOT, 'src', 'gate-boot.js'), 'utf8');
  // Order matters: analytics defines window.__saTrack, which gate, feedback, i18n and the
  // guide logic all call. gate follows it so the gate's own events are recorded, and comes
  // before the rest so the prompt is up before anything else starts wiring itself to a page
  // the reader cannot see. i18n defines window.__saLocale and must precede both i18n-apply,
  // which reads the resolved locale, and i18n-selector, which renders from it. media follows
  // i18n for the same reason: its caption tracks and transcript follow the locale. player after
  // i18n-apply, so on a step change the translated labels are in place before the highlight is
  // measured in the same frame. a11y last so it observes a fully wired tree.
  const injectedJs = [];
  // The feedback endpoint is the Power Automate trigger URL, whose sig= parameter lets anyone
  // holding it post to the list. The built page has to carry it — a browser cannot post without
  // it — but the repository does not: it comes from the SA_FEEDBACK_ENDPOINT environment variable,
  // set from a GitHub Actions secret on deploy. Unset, it is empty and the Feedback button is not
  // rendered, which is what local builds and the tests see.
  const feedbackEndpoint = (process.env.SA_FEEDBACK_ENDPOINT || '').trim();
  // The injected scripts are later spliced into the page with String.replace and a replacement
  // string, which expands `$&`-style sequences — a `$` here would be silently rewritten. Trigger
  // URLs contain none, so refuse one rather than ship a corrupted endpoint.
  if (feedbackEndpoint.includes('$')) throw new Error('SA_FEEDBACK_ENDPOINT contains "$", which the page splice would corrupt');
  // The media panel's manifest: the shipped items only, as a JS object literal. Inline rather than
  // fetched, so file:// keeps working and the page makes no extra request; it is a few hundred bytes
  // per video. "<" is escaped so no value can close the inline <script>, and a "$" is refused for the
  // same splice reason as the feedback endpoint. Every value is a validated key, kind, number or a
  // media/ path, so neither should ever occur; the checks keep it that way.
  const mediaManifest = JSON.stringify({ items: runtimeItems }).replace(/</g, '\\u003c');
  if (mediaManifest.includes('$')) throw new Error('the media manifest contains "$", which the page splice would corrupt');
  for (const name of ['analytics.js', 'splash.js', 'gate.js', 'i18n.js', 'i18n-apply.js', 'i18n-selector.js', 'contact.js', 'feedback.js', 'media.js', 'player.js', 'a11y.js']) {
    let src = await readFile(join(ROOT, 'src', name), 'utf8');
    if (name === 'feedback.js') {
      if (!src.includes('__SA_FEEDBACK_ENDPOINT__')) throw new Error('src/feedback.js lost its __SA_FEEDBACK_ENDPOINT__ placeholder');
      // A function, not a string: a replacement string would expand any `$` in the URL.
      const safe = JSON.stringify(feedbackEndpoint).slice(1, -1).replace(/'/g, "\\'");
      src = src.replace('__SA_FEEDBACK_ENDPOINT__', () => safe);
    }
    if (name === 'media.js') {
      // Exactly once: String.replace touches only the first occurrence, so a second copy (in a
      // comment, say) would leave the real one unreplaced and the page would throw on load.
      const count = src.split('__SA_MEDIA_MANIFEST__').length - 1;
      if (count !== 1) throw new Error(`src/media.js must contain the __SA_MEDIA_MANIFEST__ placeholder exactly once; found ${count}`);
      // A function, not a string, for the same `$` reason as above.
      src = src.replace('__SA_MEDIA_MANIFEST__', () => mediaManifest);
    }
    injectedJs.push(`/* --- src/${name} --- */\n` + src);
  }
  const a11yJs = injectedJs.join('\n');
  html = html.replace('</head>', `<title>Spatial Adjust Guides</title>
<meta name="description" content="Interactive guides for the Spatial Adjust feature in IntelliDash.">
<meta name="robots" content="noindex, nofollow">
<meta name="sa-release-mode" content="${showBeta ? 'with-beta' : 'ga-only'}">
<style>\n${a11yCss}\n${stepsCss}\n${releaseCss}\n${gateCss}\n${contactCss}\n${feedbackCss}\n${mediaCss}\n${splashCss}\n${playerCss}\n</style>
<script>\n${gateBoot}\n</script>
</head>`);

  // The bootstrap has to land before the support.js tag, not merely before </head>.
  // Runs after the runtime so it can observe the rendered tree. Injected BEFORE the
  // bootstrap for the same reason as the <head> block: the inlined component source
  // contains its own </body>, and a string replace would match that one instead.
  html = html.replace('</body>', `<script>\n${a11yJs}\n</script>\n</body>`);

  const supportTag = '<script src="./support.js"></script>';
  if (!html.includes(supportTag)) throw new Error('support.js script tag not found in entry document');
  html = html.replace(supportTag, `${bootstrap(componentSources, await loadTerms())}\n${supportTag}`);

  // Every inline <script> must parse. Injecting into this document is error-prone because
  // the bootstrap embeds a whole HTML file as a JS string literal — a naive replace on
  // </head> or </body> matches *inside* that literal and produces a broken page that still
  // looks fine on disk. new Function() checks syntax without executing, and has caught this
  // exact mistake twice.
  for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!body.trim()) continue;
    try {
      new Function(body);
    } catch (err) {
      throw new Error(
        `Generated an inline <script> that does not parse: ${err.message}\n` +
        `  This usually means an injection matched inside the inlined component string.\n` +
        `  Inject before the bootstrap is inserted.`,
      );
    }
  }

  await writeFile(join(DIST, 'index.html'), html);
  await cp(join(ROOT, 'support.js'), join(DIST, 'support.js'));
  for (const dir of STATIC_DIRS) {
    await cp(join(ROOT, dir), join(DIST, dir), {
      recursive: true,
      filter: (src) => !DS_EXCLUDE.some((name) => src.endsWith(`/${name}`)),
    });
  }
  // Translation catalogues, one file per locale, fetched on demand by src/i18n-apply.js.
  // Only the string map ships: the harvested contexts and metadata are there for whoever is
  // translating, and would otherwise be bandwidth every reader pays for and nobody reads.
  // glossary.json is a translator's reference too, and is deliberately not shipped.
  // Matched by locale-code shape rather than by excluding known names: src/i18n/ also holds the
  // glossary and the manual screen-label table, and a name-based blocklist silently ships the next
  // helper file somebody drops in there as if it were a language.
  const localeFiles = (await readdir(join(ROOT, 'src', 'i18n')))
    .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json');
  if (localeFiles.length) await mkdir(join(DIST, 'i18n'), { recursive: true });
  let shipped = 0;
  const leftOut = new Set();
  for (const file of localeFiles) {
    const data = JSON.parse(await readFile(join(ROOT, 'src', 'i18n', file), 'utf8'));
    if (!data.strings) throw new Error(`${file} has no "strings" map — regenerate it`);
    let strings = data.strings;
    if (omitted) {
      strings = Object.fromEntries(Object.entries(strings).filter(([key]) => {
        if (!omitted.has(key)) return true;
        leftOut.add(key);
        return false;
      }));
    }
    await writeFile(join(DIST, 'i18n', file), JSON.stringify({ strings }));
    shipped++;
  }

  await writeFile(join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

  // The release status is build input. It names every beta guide, so it must never be published,
  // whichever way the switch is set.
  const releaseFiles = (await readdir(DIST, { recursive: true }))
    .filter((f) => /(^|[\\/])release\.(json|mjs)$/.test(f));
  if (releaseFiles.length) throw new Error(`dist/ must not contain the release status: ${releaseFiles.join(', ')}`);

  // Last, after every write: the whole site, videos and posters included, against the Pages budget.
  const site = await checkSite(DIST);
  if (site.problems.length) throw new Error(`media budget exceeded:\n- ${site.problems.join('\n- ')}`);

  console.log(`built dist/ — entry index.html, ${COMPONENTS.length} component(s) inlined, `
    + `${shipped} locale catalogue(s), 0 external origins, ${Object.keys(mediaItems).length} video(s), `
    + `${tracks} caption track(s)`);
  console.log(`release mode: ${showBeta ? 'beta shown' : 'beta removed'} `
    + `(SA_SHOW_BETA=${rawShowBeta === undefined ? 'unset' : JSON.stringify(rawShowBeta)}), `
    + `release file ${releaseFile.startsWith(ROOT + sep) ? relative(ROOT, releaseFile) : releaseFile}`
    + (omitted ? `, ${leftOut.size} beta-only catalogue key(s) left out of the locale catalogues` : ''));
}

await main();
