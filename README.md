# Spatial Adjust Guides

Interactive guides for the Spatial Adjust feature in IntelliDash, authored in Core Design against the IntelliDash codebase and built here into a self-contained static site.

```bash
npm install
npm start          # build + serve on http://localhost:8124
npm test           # build, then assert it renders with the network cut off
```

## How it works

Two Core Design exports drive everything:

| File | Role |
|---|---|
| `Learn Spatial Adjust.dc.html` | The guide system — 6 categories, **26 guides**, TOC scroll-spy, step player. A `DCLogic` class component. The export holds 24 of the guides; `src/transform-export.mjs` adds the other two (`request-scan-data`, `filter-adjustments`) and, at build time, rewrites every guide's step copy from `src/rewrite/*.mjs` (see *Writing the guides*). |
| `SpatialAdjustApp.dc.html` | A 1920×1080 recreation of the Spatial Adjust UI. Deliberately stateless — every visual state comes from its 26 typed props. |

The guide `<import>`s the app component and drives it through those props, then uses a `camera(target, stageW)` pan-and-zoom to frame whichever region a given step is describing. **The guide puppets a live component rather than embedding screenshots, so figures cannot drift out of sync with the app.** Preserve this when changing either file.

`support.js` is the Core Design runtime (`dc-runtime`), generated and not editable by hand.

## What the build does

The raw export only renders inside Core Design's preview harness: it pulls React from unpkg.com at runtime and resolves the component import with `fetch()`, so it breaks on a blocked network and cannot run from `file://`.

`build.mjs` fixes both **without forking `support.js`**, using two hooks the runtime already supports:

- **`window.__resources`** — a URL→URL map consulted by `cdnScriptFor()` before falling back to unpkg. React and ReactDOM are redirected to `vendor/`. Its presence also stops `boot()` re-fetching `location.href`.
- **`window.__resourceBlobs`** — a URL→Blob map consulted by `bundledBlob()` before `fetch()`. `SpatialAdjustApp` is inlined as a Blob, which is what restores `file://` support.

It also adds `index.html` (the export had no entry point and a space in its filename), vendors the Satoshi font, and drops files that never execute — see `DS_EXCLUDE` in `build.mjs`, chiefly the 10MB `_ds_bundle.js`.

It verifies and ships the video media too (see **Video**). After the transforms, it validates `src/media/manifest.json` against the catalogue's guide keys, holds each video to its size cap, checks every asset staged in `.media/` against its pinned byte count and SHA-256, and copies only the verified ones into `dist/media/`. A mismatch always fails the build; a missing asset fails it only under `SA_MEDIA_REQUIRED=1`, which the deploy sets. It then writes eleven caption tracks per shipped video and inlines the shipped items into `src/media.js`. Last, after every write, it holds the whole of `dist/` to 900,000,000 bytes. The summary line counts the videos and caption tracks it shipped.

Result: **about 2.9MB before any video, zero third-party origins** (measured 2026-10-20; it was 1.3MB before the locale catalogues). 1.7MB of that is the ten locale catalogues, and a reader fetches only the one for their language. Videos and posters come on top, inside the size budget, and a video downloads only when a reader presses play.

### Why Babel isn't involved

`support.js` can load `@babel/standalone`, but only for `<import>`ed `.jsx`/`.tsx` files. Neither `.dc.html` contains JSX — `SpatialAdjustApp` calls `React.createElement` via `h()` 167 times, and the guide uses the runtime's own `{{ }}` template compiler with `new Function()`. Babel is never fetched. Verified: the only external requests the original export makes are React and ReactDOM.

## Re-exporting from Core Design

The Core Design files stay the source of truth. **Never copy an export into the repo by hand** — import it:

```bash
npm run import -- "/path/to/Core Design export folder"
npm test
```

`scripts/import-export.mjs` sanitizes customer data on the way in, so the repo never holds it at any point. Cleaning at build time instead would leave real data sitting in a tracked directory of a public repo, where one `git add -A` publishes it.

It reads `sanitize.local.json` — a gitignored map of real → fictional values — and then enforces generic invariants on the result: no coordinate precise enough to identify a site, no unrecognised site-ID prefix, no site name outside the fictional allowlist. Those rules catch values nobody has seen yet, which matters: the first manual pass searched for known terms and missed an identifier that differed only in letter case. Nothing is written unless every file passes.

If a rule fires, add the value to `sanitize.local.json` and re-run. **Do not paste the real value into a commit message or ticket** — that re-exposes it somewhere else.

### Why the a11y work survives a re-export

It didn't, once. Every accessibility and instrumentation change was hand-edited into the `.dc.html` files and a re-export silently wiped all of it.

Those changes now live in `src/transform-export.mjs` and are applied to the raw export at build time. Each transform asserts its anchor matched exactly once, so an export that changes shape **fails the build** rather than quietly dropping keyboard support. If that happens, update the anchor — don't skip the transform.

Adding a new imported component still means adding its name to `COMPONENTS` in `build.mjs`.

## Writing the guides

Every step follows one standard, written down in [`docs/writing-guide.md`](docs/writing-guide.md): **Do** (one action, naming the control in `[[Exact Label]]` markers), **You should see**, **If not**, and an optional **Why**, with a start state ("Before you start") for each guide, at most eight steps per guide, a cursor target for every step, and a Flesch-Kincaid grade of 8 or below. Read it before changing any guide copy.

Guide copy is not edited in the `.dc.html` export. It lives in `src/rewrite/*.mjs`, one module per catalogue category, and `transformGuide()` applies it to the export at build time. Each edit is anchored on the exact text it replaces, with the match count asserted, so a re-export that moves a sentence fails the build instead of silently dropping the rewrite. Every sentence needs a Verified claim in the ledger under `docs/claims/` (`docs/claims/README.md` explains it).

The standard is enforced, not advisory, and there is no per-guide exemption:

- `npm run build` runs the step-shape check in memory on the transformed page and fails before writing `dist/` if any step lacks Do, You should see or If not.
- `.github/workflows/deploy.yml` runs `test:validate`, `test:prose`, `test:shape` and `test:readability` as blocking steps, then `npm test`, `test:parity` and `test:fidelity`. The first four need no browser, credentials or IntelliDash checkout.

## Guide player

`src/player.js` and `src/player.css` add the iCentral Double Click treatment to the player. Like `a11y.css`, `steps.css` and the other runtime layers, they are injected by `build.mjs` and live outside the Core Design export, so a re-export cannot discard them. Only the data they read is put into the export, by `src/transform-export.mjs`: each step's resolved cursor target and where it came from (`data-sa-target`, `data-sa-target-src`) on the stage and on every article figure.

- **Highlight ring.** A `#3079F0` ring (`--informative-02`, 4.1:1 on white, above the 3:1 a non-text indicator needs) outlines the smallest reproduced element containing the step's cursor target, on the stage and in every article figure. It is a sibling overlay, not a child of the reproduction, which the runtime re-renders on every step. It travels with the camera, using the camera's own duration and easing.
- **Chapter label and chapter strip.** The step title shows as a caps chapter label on the stage, and a strip of real buttons runs under it, one per step, named "Step N of M: title" with `aria-current` on the current one.
- **Step shape and start state.** The Do / You should see / If not / Why rows and the "Before you start" rows are drawn by `src/transform-export.mjs` with `src/steps.css`, and the labels are translated at render time. The first use of each of the eight glossary terms in `src/terms.json` is defined where the reader meets it.
- **Keyboard.** Every chapter segment is reachable with Tab, in step order. Enter or Space on a segment moves the player, the live region announces the step and `aria-current` follows. Space does not start play-all.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` neither the ring nor the camera moves.
- **Screen readers.** The ring and the caps label are `aria-hidden`: the live region already announces the step.
- **Small screens.** Below 768px the ring, the label and the strip are hidden with the stage, and the written steps take the full width.

`npm run test:cursor-target` fails a step whose target fell back to the default coordinate or whose ring contains no element. `npm run test:keyboard` and `npm run test:a11y` cover the strip and the overlay.

## Tests

| Command | What it checks |
|---|---|
| `npm test` | Builds, then boots the bundle in Chromium with all external hosts blocked, twice: as built, and with fixture media injected (see **Video › Placeholder clip**). Both runs assert the catalog's card count is the number of guides `src/release.json` ships in this mode, a guide opens, the imported app component mounts, and there are zero external requests and zero console errors. As built: no video panel anywhere when the build shipped no videos, and every shipped video's panel when it did, as in CI. With fixture media: the showcase on the home page, one panel on `dashboard-overview` — a `<video>` with controls, `preload="none"`, `playsinline` and a poster, never autoplay, muted or loop, and eleven caption tracks with exactly one default — and no panel on `target-profiles`. Ends with `npm run test:media`. |
| `npm run test:media` | Unit tests for the media layer, with no browser (`node --test`): manifest validation against the catalogue's guide keys, byte-count and SHA-256 mismatches, each of the three caps at its limit and one byte over, the WebVTT round trip, a missing caption translation refused, the caption locales matching `CONTENT_LOCALES`, the caption source catalogue being current, and the git guard. |
| `npm run test:media-budget` | Each manifest item's declared size against its cap, and the `dist/` total against 900,000,000 bytes. Exits 1 on anything over. See **Video › Size budget**. |
| `npm run test:media-git` | No tracked video file (`.mp4` `.m4v` `.mov` `.webm` `.mkv` `.avi`, any letter case) and no Git LFS filter in any `.gitattributes`; in a full clone, also that no commit on any ref ever added one. CI's depth-1 checkout sees the tracked tree only, and the first line of output says which mode ran. The deploy runs it before building. |
| `npm run test:guides` | Discovers every guide from the page and walks each one the build ships, stepping through each and fingerprinting the rendered DOM. Used to prove a change is render-neutral — diff against a known-good run. |
| `npm run test:keyboard` | Drives the interface: tab to a card, Enter to open, Space on Next, and asserts the live region changed. Then the chapter strip: Tab reaches every segment in order, Enter and Space on a segment move the player with the live region and `aria-current` following, and Space does not start play-all. Then, on `dashboard-overview` with fixture media, that Tab reaches the video and then the transcript toggle, each with a visible focus ring, and that Enter opens the transcript. |
| `npm run test:shape` | Browser-free, over the guide data after `transformGuide()`. Every step has non-empty `do`, `see` and `ifNot`; `do` names a `[[Exact Label]]` unless the step is a deliberate `region: true`; no step with `do` keeps `body`; at most eight steps a guide; `start` has `page`, `open` and `needs`; `TARGETS[key]` has one point per step; a `<key>-part-N` is first in the previous part's `next`. Also checks `src/terms.json`, the eight glossary terms. Blocking for all 26 guides, and `build.mjs` runs the same check. |
| `npm run test:readability` | Browser-free. Flesch-Kincaid grade per step over `do`, `see`, `ifNot`, `why` and any `body`, markers stripped. Fails on any step above grade 8. `-- --selftest` checks the scorer against hand-counted reference texts. |
| `npm run test:prose` | Browser-free. Mechanical grammar checks over every translated catalogue (Korean particle agreement, French elision, doubled spaces and similar). Blocking. |
| `npm run test:routing` | Deep links, Back/Forward, and an unknown key falling back to the catalog. |
| `npm run test:a11y` | axe-core on the catalog and inside a guide, plus a keyboard-reachability probe. The guide is scanned with the highlight ring, chapter label and chapter strip on screen, normally and with `prefers-reduced-motion: reduce`; it fails on a violation on the overlay, a rule only the reduced-motion scan finds, or anything still animating under reduced motion. Then `dashboard-overview` again with fixture media, the player mounted and the transcript open, and once more scoped to the video panel. A violation the plain guide scan does not have, or any violation inside the panel, is listed as `newViolations` and also fails the run. |
| `npm run test:cursor-target` | Walks every step of every guide by URL. Fails when a step fell back to the default coordinate (`FALLBACK-COORDINATE`), when no highlight ring contains the cursor's end point on the stage or the target in the article figure (`NO-HIGHLIGHT`), or when the cursor is off the stage or over nothing. |
| `npm run test:validate` | Mechanical validation of every catalogue against the English source: numbers, product names, structural characters, empties, and `Step N of M:` agreement with the standalone translation of its own tail. Also the label gates: every `[[label]]` in the guides is a real IntelliDash label recorded in the claims ledger (`labelProvenance`), and every translation names each control with the label the reader's screen shows (`markerDrift`, `screenLabelDrift`). Every finding fails the command; `--all` prints all of them. Browser-free, and it reads only committed fixtures, so it gives the same verdict with and without an IntelliDash checkout. The video caption catalogues follow, under `captions:<locale>`, with two more gates: a cue left untranslated, and a cue that quotes a step heading in words other than the heading's own translation. |
| `npm run test:i18n` | Per shipped locale: that the words on screen actually change, that `<html lang>` agrees with what is served, and that a locale with no catalogue degrades to English rather than to a half-translated page. With fixture media on `dashboard-overview`, every shipped locale must make the caption track in its own language the default and the one showing, and switching from English to French at run time must move the showing captions with it. The transcript is left out of the coverage count: it is caption text, not page text. |
| `npm run test:responsive` | Horizontal overflow at 375, 768, 1024, 1440 and 1920px on the catalog (or a guide, with `-- guide`), report only. `npm run test:responsive -- media` opens `dashboard-overview` with fixture media and the transcript open, and fails if the panel leaves the viewport or the page scrolls sideways at any width; `node scripts/overflow.mjs http://localhost:8124/ media` does the same and also names any element inside the panel that sticks out. |
| `npm run test:instrumentation` | The Feedback panel against a stub endpoint (see **Instrumentation and feedback**), and the video events: `play`, `play`, `ended` on the fixture video must record exactly one `video_played` and one `video_completed`, each with the guide key and a locale, in `__saReport().videos`, with no unknown-event warning. |
| `npm run test:splash` | The boot splash's timing and lifecycle: the markup is in the served document, it holds for its minimum, clears once content has painted and is removed rather than merely hidden. |
| `npm run test:fidelity` | The screen-fidelity gate: every label observed on a harvested product surface appears in the reproduction. Blocking in the deploy workflow. |
| `npm run test:parity` | Asserts the fidelity gate gives the same verdict with and without an IntelliDash checkout. Blocking in the deploy workflow. |
| `npm run test:provenance` | Self-check of the label-provenance classifier (keyed, hardcoded or live-observed). |
| `npm run test:product-locales` | Reports where IntelliDash's own catalogues are missing, untranslated or misspelled for a label the guides use. Always exits 0: the findings are product bugs this repository cannot fix. |
| `npm run test:gate` | Drives the sign-in gate: that it hides the guides from `innerText`, rejects an outside domain and a lookalike (`nottoro.com`), admits a subdomain, persists the unlock across a reload, re-locks when storage is cleared, and is axe-clean. |
| `npm run test:release` | Unit tests for `src/release.mjs` and `src/release.json`, with no browser: the committed release is valid against the guides, each kind of invalid release is rejected, `SA_SHOW_BETA` parses as documented, and the release gate removes, labels and fails as it should on the real export. |
| `npm run test:leak` | The whole-`dist/` beta leak check (see **Beta content and the customer launch**). In a build made with `SA_SHOW_BETA=false`, any beta guide key, title, step or string in any file or locale fails it; with beta shown it reports and passes, and `npm run test:leak -- --expect-shown` also asserts the beta content is there. |
| `npm run test:release-modes` | In the built page, every guide's steps number 1 to n alike in the player, the step rail, the contents and the written steps. With beta shown, the Beta badge, banner and step marker sit on exactly the beta items and render translated in all ten locales; with beta hidden, no Beta markup appears anywhere. |
| `npm run release:status` | Compares `src/release.json` with the claims ledger and lists where they disagree. Advisory: it exits 0 unless given `--strict`. See [`docs/claims/README.md`](docs/claims/README.md#release-status). |

The fingerprint harness verified the original port: output was **identical** between the Core Design export and the built bundle.

`npm test`, `test:routing`, `test:release-modes` and `test:leak` follow `SA_SHOW_BETA` the way the build does: with beta hidden, the smoke test expects only the GA guides' cards and routing expects a beta guide's address to fall back to the catalog. Build and test with the same value. `.github/workflows/release-modes.yml` runs the suite in both modes on every push and pull request; see **Beta content and the customer launch**.

## Accessibility and responsive behaviour

`src/a11y.css` and `src/a11y.js` are injected by the build and live outside the Core Design export so a re-export can't discard them.

- **Keyboard.** The export built its controls from `<div onClick>`, which browsers give no keyboard behaviour — only 3 elements on the whole page were focusable against 26 with click handlers (now 29 focusable). Controls now carry `role="button"` and `tabindex`, and a delegated listener supplies Enter/Space activation. Verified end to end by `npm run test:keyboard`, which tabs to a card, opens it with Enter, and advances a step with Space.
- **Screen readers.** Cards have accessible names including duration and difficulty; the difficulty dots are `aria-hidden` with a text equivalent; step changes are announced through an `aria-live` region, since the camera move that conveys them is purely visual.
- **Contrast.** Guide chrome is at zero axe violations (was 66 on the catalog, 28 in a guide).
- **Highlight, chapter label and chapter strip.** Described under *Guide player* above.
- **Responsive.** Zero horizontal overflow from 375px to 1920px, verified without `overflow:hidden` masking. Below 768px the fixed 1920×1080 stage is replaced with a short explanation and the written steps take the full width — at phone size the stage would need ~23% scale to fit, which is unreadable.

### Deliberately not fixed

Fifteen contrast failures remain inside `.sa-app` in the Dashboard overview guide. That component is a faithful reproduction of the real IntelliDash screen, so correcting its colours would make the guides misrepresent the product. **These are a finding against IntelliDash itself, not against this site.**

## URL routing

Each guide has its own address (`#/minimum-threshold`), so a guide can be linked to directly and the browser Back button returns to the catalog instead of leaving the site. The export kept the open guide purely in component state, which meant neither worked. An unknown key falls back to the catalog rather than rendering blank. Covered by `npm run test:routing`. In a build without beta content, a beta guide's address falls back the same way, because the guide is not in the page at all (see **Beta content and the customer launch**).

## Beta content and the customer launch

The guides describe IntelliDash as it runs in production. Some Spatial Adjust behaviour exists only
on develop and the beta environment, and not yet in production: that is **beta content**. The two
builds are pinned in [`docs/claims/sources.json`](docs/claims/sources.json), and
[`docs/claims/beta-surfaces.md`](docs/claims/beta-surfaces.md) classifies every commit that
separates them and names each beta surface. Beta content is written into the guides so internal
readers and the expert team can see it now, marked Beta, and one build-time setting removes it
from the built site for customers until the feature ships.

**What is beta: `src/release.json`.** One entry per guide key, `"status": "ga"` or `"beta"`, with a
`basis` saying why. A GA guide can also hold beta `sections`: steps addressed by their exact step
title, never by number, because numbers shift whenever a step is added or removed. A beta guide or
section lists under `crossReferences` each sentence in a GA guide that names it
(`{ "guide", "field", "text" }`), so that sentence leaves with it. Every build validates the file
against the guides through `src/release.mjs`: a guide with no entry, a step title that matches no
step or more than one, and a mention of a beta guide that is not registered all fail the build. As
of 2026-10-20 all 26 guides are GA, and `calculation-questions` holds one beta section,
`stale-scans-kept`: the step "A stale course keeps its last scans". The surfaces the reproduction
cannot draw are under **Known gaps** as beta guide candidates.

**The switch: `SA_SHOW_BETA`.** A plain environment variable, read by `build.mjs` at build time.
Nothing in the build or the page depends on which host runs it.

| `SA_SHOW_BETA` | The build |
|---|---|
| `true` or `1`, any letter case | Shows beta content, labelled: a Beta badge on a beta guide's catalogue tile, a banner at the top of a beta guide ("Beta. This feature is in testing and may change before it reaches your IntelliDash."), and an inline Beta marker on a beta step of a GA guide, all translated in the ten locales. |
| unset or empty | The same as `true`. This default is for the internal and expert phase; see **The customer launch** below. |
| `false` or `0`, any letter case | Removes beta content from `dist/`: each beta guide with its tile, cursor targets and the Next cards that point at it; each beta step of a GA guide, with the remaining steps renumbered; each registered cross-reference; and every catalogue string only beta content uses, from every locale. The page carries no Beta markup at all. |
| anything else | Fails the build, so a typo in a pipeline cannot guess. |

Removed, not hidden. CSS or a URL parameter would leave the content in the page source, and the
sign-in gate is client-side (see **Sign-in gate**). The build records the mode in the page, as
`<meta name="sa-release-mode" content="with-beta">` or `content="ga-only"`, and logs what it
resolved:

```
release mode: beta removed (SA_SHOW_BETA="false"), release file src/release.json, 7 beta-only catalogue key(s) left out of the locale catalogues
```

Locally, `SA_SHOW_BETA=false npm start` builds and serves the customer site.

**Where it is set today: GitHub Actions.** `.github/workflows/deploy.yml` passes the repository
variable `SA_SHOW_BETA` (`${{ vars.SA_SHOW_BETA }}`) to the build whose `dist/` it publishes, and to
the leak check that runs before the upload. It is a variable, not a secret: it is a setting, not a
credential, and its value shows in the log. Until the variable exists GitHub passes an empty
string, so the deploy shows beta content and logs `SA_SHOW_BETA=""`. To create or change it, open
the repository's **Settings › Secrets and variables › Actions › Variables**, or run
`gh variable set SA_SHOW_BETA --body false --repo toroadam/spatial-adjust-guide` with a token that
may administer the repository. A new value applies to the next deploy run and needs no commit.

**Where it will be set: Azure.** When the site moves to Azure behind Toro SSO, the pipeline that
builds it sets the same variable and no code changes. Azure Pipelines exports each plain pipeline
variable to scripts as an environment variable of the same name, so `SA_SHOW_BETA` reaches
`build.mjs` as it is. A secret pipeline variable is not exported, so keep this one plain. A sketch,
since no such pipeline exists yet:

```yaml
# azure-pipelines.yml (sketch)
variables:
  SA_SHOW_BETA: 'false'   # or define it in the pipeline's Variables panel, settable at queue time

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'
  - script: npm ci && npx playwright install --with-deps chromium
    displayName: Install
  - script: npm test                  # build.mjs reads SA_SHOW_BETA and logs the release mode
    displayName: Build dist/ and smoke test
  - script: node scripts/beta-leak.mjs
    displayName: Beta leak check      # the same check deploy.yml runs before its upload
  # ...then publish dist/
```

Azure Static Web Apps works the same way: set `SA_SHOW_BETA` in the environment of whichever step
builds `dist/`, either a build step like the one above or the Static Web Apps deploy task when that
task runs the build. The application settings on a Static Web App's portal page are runtime settings
for its API, and a static build never sees them.

**The customer launch.** The pipeline that publishes the customer site, GitHub Actions now or Azure
later, must set `SA_SHOW_BETA` explicitly. The empty default is for the internal and expert phase,
and the published mode should never rest on it. To publish without beta content:

1. Set the variable to `false`.
2. Run the deploy: **Actions › Build and deploy to Pages › Run workflow**, or
   `gh workflow run deploy.yml --ref main`. Start a new run rather than re-running an old one, so the
   run reads the variable as it is now.
3. In the run's log, the `npm test` step prints `release mode: beta removed (SA_SHOW_BETA="false")`
   and the **Beta leak check** step ends `BETA LEAK: PASS (0 beta keys, titles or strings in …)`.
4. On the live site, the page source carries `<meta name="sa-release-mode" content="ga-only">`, no
   tile has a Beta badge, and a beta guide's address opens the catalogue. GitHub Pages can serve
   the previous build for a few minutes after a deploy.

**Bringing beta back**, for example to show the experts a new beta feature: set the variable to
`true` and run the deploy again. The log then says `beta shown`. Deleting the variable has the same
effect today, because empty means shown, but once customers use the site, set the value explicitly.

**Releasing a feature.** When a beta feature reaches production, change its entry in
`src/release.json`: a beta guide's `"status"` becomes `"ga"`, and a beta section's `"status"`
becomes `"ga"`, or the section is removed. Delete its `crossReferences` in the same edit, because
only beta content carries them (the build fails and says so if you forget), and point `basis` at the
production evidence. The prose and its translations do not change: the catalogues are harvested from
both modes, so they already hold every string either build renders, including the step numbers a
released step brings back. The claims ledger does change. Re-check the feature's claims against
production, because `npm run claims:lint` fails on a Verified (beta) claim in GA content and
`npm run release:status` reports GA content that cites develop only, and re-pin
`docs/claims/sources.json` if production has moved (see
[`docs/claims/README.md`](docs/claims/README.md)). Then commit; the next deploy publishes the
feature in both modes. New beta content goes the other way: it is written in
`src/transforms/beta-content.mjs`, recorded in `src/release.json` and in `beta-surfaces.md`, and
translated, in one change.

**The leak check.** `scripts/beta-leak.mjs` (`npm run test:leak`) reads every file in `dist/` the
way anyone who downloads the site could, and the deploy runs it before the upload. With
`SA_SHOW_BETA=false` it fails on any beta guide key, in a file or in a file name; any beta guide's
title, tile title or summary; any beta step title; the Beta badge, banner and their class names;
every beta-only string, and each locale's translation of every catalogue key a build without beta
leaves out; a catalogue whose tile count is not the GA guide count; a sitemap or media manifest that
names a beta guide; a release file in `dist/`; and a `dist/` that was built in the other mode. Each
hit names the file, what was found and its context. Everything it looks for is computed from
`src/release.json` and the export, so there is no list to keep up to date. With beta shown it
reports and passes, and `--expect-shown` asserts that the beta content and the badge are present.

**Tests in both modes.** `.github/workflows/release-modes.yml` runs the suite on every push and pull
request in four jobs: the real release shown and hidden, and a removal fixture shown and hidden.
The fixture, `test/fixtures/release.fixture.json`, marks a whole guide and a middle step of a GA
guide beta, so removal, Next-card cleanup and renumbering are exercised however small the real beta
set is. It builds and tests only; what customers get is decided by the deploy's own build.
`npm test`, `test:routing`, `test:release-modes` and `test:leak` read `SA_SHOW_BETA` as the build
does, so build and test with the same value; `test:release-modes` and `test:leak` fail outright on a
`dist/` built in the other mode. `test:validate`, `test:i18n` and `test:a11y` need no setting and
check whichever build is served:

```bash
SA_SHOW_BETA=false npm test         # build without beta content, then the smoke test
npm run serve &                     # the checks below drive the served dist/
SA_SHOW_BETA=false npm run test:routing
SA_SHOW_BETA=false npm run test:release-modes
SA_SHOW_BETA=false npm run test:leak
```

`SA_RELEASE_FILE` points the build and the tests at another release file, such as the fixture. It
is for tests only: no deploy sets it, and an empty value means `src/release.json`.

**Who can read beta content.** Toro SSO on the Azure site will control who reaches the published
site, and `SA_SHOW_BETA` controls which features a reader who gets in sees. Neither one controls
this repository, whose visibility is a separate GitHub setting. The repository is public, so the
beta prose in `src/transforms/beta-content.mjs` and the beta list in
`docs/claims/beta-surfaces.md` are readable on GitHub whatever `SA_SHOW_BETA` says, like the rest
of the source (see **Sign-in gate** and **Data**). That is accepted for the beta content written so
far. Before writing beta content that must not be public, make the repository private, which is
its own decision. Nothing confidential belongs in this repository, beta or not.

## Video

A guide that has a Double Click episode shows it at the top, above the walkthrough, and the catalogue
home shows the Spatial Adjust showcase between the introduction and the task grid. The player is the
browser's own `<video>`, served from this site's origin. A YouTube or Vimeo embed was never an option:
it reaches a third party, which `npm test` fails by design, and it brings the cookies and tracking this
site avoids.

Episodes go live as they are finished; the site never waits for the full set. A guide whose episode is
not in the manifest yet simply shows no panel. Under the owner direction of 2026-10-19 there is no
approval step before an episode is published: the expert review happens on the live site, and the
calls made without one are listed in [`docs/review-agenda.md`](docs/review-agenda.md).

### How media reaches the site

```
finished render (MP4 with sound) + English WebVTT + poster
      |
      v
npm run media:add             scripts/media-add.mjs: local ffmpeg web encode under the cap,
      |                       staged in .media/, pinned by byte count and SHA-256
      +---------------------------------+
      v                                 v
src/media/manifest.json           GitHub Release asset (media-vN),
(committed)                       uploaded by the owner
      |                                 |
      v                                 v
deploy.yml: npm run media:fetch -> .media/   (actions/cache, keyed on the manifest hash)
      |
      v
build.mjs: byte count + SHA-256 check -> dist/media/   (+ eleven caption tracks per video)
      |
      v
GitHub Pages, on the page's own origin
```

**Videos never enter git.** About 27 videos, 0.7 to 0.9 GB between them, would sit in every clone of
a public repository forever, and Git LFS is no way out: Pages does not serve LFS objects, and LFS
bandwidth on a public repo is metered. So each video and poster is a GitHub Release asset, and
`src/media/manifest.json` pins it by byte count and SHA-256. The manifest is what is committed and
reviewed; the bytes live in the release.

**Stage, verify, then copy** (decided 2026-10-19). The build cannot download straight into
`dist/media/`: it starts by deleting `dist/`, and `npm test` runs the build. So
`npm run media:fetch` (`scripts/fetch-media.mjs`) first stages every pinned asset in `.media/`, which
is gitignored, streaming each into a `.part` file and renaming it only once its size and hash match.
The build then copies each asset into `dist/media/` only after checking it again. Downloads happen in
Node at build time and never in the browser, so the page still loads from its own origin only.

- **A mismatch always fails the build.** A staged file whose byte count or SHA-256 differs from its
  pin stops the build in every mode, naming the file to delete and refetch.
- **A missing asset fails only in CI.** Locally it is dropped with a warning and that guide shows no
  panel, the same way the Feedback button is simply absent without an endpoint, so a clean clone and
  the offline tests keep passing. The deploy sets `SA_MEDIA_REQUIRED=1`, which turns a missing asset
  into a failed deploy rather than a guide quietly shipped without its video.
- **The deploy caches `.media/`** with `actions/cache`, keyed on the manifest's hash, with
  `restore-keys: media-` so a new wave downloads only its new assets. Nothing cached is trusted as-is:
  `media:fetch` re-hashes every file before the build sees it. Re-hashing catches a damaged cache;
  what keeps a cached file valid at all is that bytes under a pinned hash are never replaced in place
  (see below).

To build locally with the published media, run `npm run media:fetch` and then `npm test`. With an
empty manifest it prints `media: manifest has no items` and does nothing.

### Size budget

| | Cap |
|---|---|
| One episode video | 25,000,000 bytes |
| The showcase video | 40,000,000 bytes |
| The whole of `dist/`: page, catalogues, videos and posters | 900,000,000 bytes |

The caps are decimal byte counts, the stricter reading of "25 MB" (25 MiB would be 26,214,400), and
they keep the site well inside GitHub Pages' 1 GB limit on a published site. Posters have no cap of
their own but count toward the site total. The three caps are defined once, in
`scripts/media-budget.mjs`, which `build.mjs` and `scripts/media-add.mjs` both import. Decided
2026-10-19.

The build enforces all three: the per-video caps against the manifest before anything is copied, and
the site total after its last write. `npm run test:media-budget` prints each manifest item against its
cap and the `dist/` total (build first, or it says `dist/` is not built), and exits 1 when anything is
over. It reads the sizes the manifest declares; the build is what proves the staged files match them.
Add `-- --manifest <file>` to check another manifest, such as the placeholder's.

When it fails:

- **A video over its cap: re-encode, never raise the cap.** `npm run media:add` sizes the bitrate from
  the render's duration so the encode lands under the cap, refuses an encode that does not, and prints
  a `--bitrate` to retry with. A render too long to fit at a watchable bitrate is refused with
  "shorten the render".
- **The site over 900,000,000 bytes: the budget is spent.** The 1 GB limit is GitHub's, not ours, so
  the answer is shorter or fewer videos, or the fallback below.

Pages also has a soft bandwidth limit of about 100 GB a month. `preload="none"` (below) means a video
costs nothing until someone presses play, which at 25 MB a play is roughly 4,000 full plays a month.

### Add or replace an episode

`npm run media:add` needs ffmpeg and ffprobe locally (`brew install ffmpeg`) and never runs in CI.
Publishing the release is the owner's step; see *Who can publish*.

1. **Get the finished render, its English captions and a poster** from the video pipeline: an MP4
   with its narration or music (one with no audio stream is refused), plain English WebVTT, and
   optionally a poster image. Without a poster, the frame at 10% of the duration is used.
2. **Copy the captions to `src/media/captions/<key>.en-us.vtt`**, where `<key>` is the guide key from
   the guide's address (`#/dashboard-overview` is `dashboard-overview`), or `showcase`. Plain WebVTT
   only: cue markup and `STYLE` and `REGION` blocks are refused, because markup does not survive
   translation.
3. **Rebuild the caption source catalogue:** `node scripts/media-cues.mjs`. It rewrites
   `src/i18n/captions/en-us.json` from every English track; `--check` exits 1 if the committed file is
   stale, and `npm test` runs that check.
4. **Translate the new cues into the ten locales** (see *Captions and transcripts* for why they have
   their own catalogue):

   ```sh
   node scripts/seed-translate-fragments.mjs --catalogue captions
   node scripts/translate.mjs --locale de-de --catalogue captions
   node scripts/assemble-locale.mjs de-de .translate/captions/de-de --catalogue captions
   npm run test:validate
   ```

   Run the translate and assemble lines for each of the ten locales. Seeding (all ten at once) keeps
   every cue already translated, so only new or changed cues are `todo`.
   `translate.mjs` needs `ANTHROPIC_API_KEY` or an `ant auth login` profile, and `--dry-run` shows the
   work without calling the API. A translation written by hand can skip it: put a JSON file mapping
   each English cue to its translation in `.translate/captions/<locale>/`. `assemble-locale.mjs`
   merges every file there and is the gate either way, refusing a missing or unknown cue. Assembling
   rewrites the catalogue's `_meta`; for a locale that already had a caption catalogue, put its
   committed `_meta` back (`git show HEAD:src/i18n/captions/<locale>.json`) and update only the
   counts, as the page catalogues do.
   **English only, until the cues are translated.** An item whose manifest entry says
   `"captionLocales": ["en-us"]` ships its English track alone: `media-cues.mjs` leaves its cues out of
   the catalogue (so the ten locales are not asked for them), the build writes one track, and the page
   offers it to every reader as the default, labelled English, with an English transcript tagged
   `lang="en-US"`. The 26 Double Click episodes are published this way. To translate one, delete its
   `captionLocales` line and run this step; the build then writes all eleven and fails on any cue left
   untranslated, as before.
5. **Encode and pin:** `npm run media:add -- --key <key> --source <render> [--poster <image>]`. It
   makes a two-pass 1080p H.264 High encode with AAC 128 kb/s 48 kHz stereo and `+faststart`, so
   playback starts before the whole file arrives, with the source metadata stripped. It checks the
   result, moves the video and poster into `.media/`, pins both in `src/media/manifest.json` with the
   captions path, and prints the commands that publish them. It runs none of them.
   `--release media-v2` puts a new wave under its own tag, so earlier assets are never re-uploaded.
6. **The owner runs the printed commands**, which look like this (`create` appears only when the tag
   does not exist yet):

   ```sh
   gh release create media-v1 --repo toroadam/spatial-adjust-guide --title 'Guide media media-v1' --notes 'Web encodes for the guides site; see README > Video'
   gh release upload media-v1 .media/dashboard-overview.mp4 .media/dashboard-overview.jpg --repo toroadam/spatial-adjust-guide
   ```

   Upload before the manifest change reaches `main`: the deploy fails on an item whose asset is not
   in the release yet.
7. **Check it locally:** `npm test` builds with the files staged in `.media/` and smoke-tests every
   shipped video's panel; `npm run test:media-budget` reports the sizes.
8. **Commit the manifest, the English VTT, `src/i18n/captions/en-us.json` and the ten caption
   catalogues in one PR.** The build fails if a shipped video has a cue untranslated in any locale, so
   they belong together. **Never commit the `.mp4`:** `.media/` is gitignored, and
   `npm run test:media-git` fails the deploy on any tracked video file or Git LFS filter.

A caption correction needs no release. The tracks are written at build time from the repository, so
edit the English VTT and repeat steps 3 and 4.

**A replacement gets a new file name or a new release tag, never different bytes under a pinned
hash.** `media:add` refuses to re-pin a key to new bytes unless it is given `--replace` together with
a `--release` tag other than the one the key uses now:

```sh
npm run media:add -- --key <key> --source <render> --replace --release media-v3
```

The upload it prints has no `--clobber`, for the same reason. An asset swapped in place would leave
the manifest pinning bytes the release no longer has, so every deploy would fail, and the cached
copies in CI and in `.media/` could no longer be trusted on their hash.

### Captions and transcripts

**Caption cues have a catalogue of their own,** `src/i18n/captions/`, rather than living in
`src/i18n/en-us.json` (decided 2026-10-19). `scripts/extract-strings.mjs` rebuilds `en-us.json`
wholesale from the rendered page, so cues stored there would vanish on the next harvest, and every
reader would download every cue of every video with the page catalogue, whether they watch or not.
The subdirectory sits outside the locale-file filter `build.mjs`, `validate-locales.mjs` and `i18n.mjs`
apply, so nothing in it ships as a page catalogue by accident. The seed, translate and assemble
scripts take `--catalogue captions` and otherwise behave exactly as they do for the page.

- **Eleven tracks per video, or English alone.** The build writes `dist/media/captions/<key>.<locale>.vtt`, the English
  source and one per translated locale, with ids, timings and cue settings copied from the English
  track so every language lines up with the picture. A cue with no translation in any locale fails
  the build, naming the locale and the cue: no partial track ever ships, the same rule
  `assemble-locale.mjs` applies to the page. An item with `captionLocales: ["en-us"]` writes the
  English track only; the panel then makes it the default for readers in every locale and keeps the
  transcript in English too, rather than claiming a language the words are not in.
- **The default follows the locale.** Each track is labelled with its language's own name, and the
  default is the language the page is actually served in, the one `<html lang>` reports. Switching
  language moves showing captions to the new language, or leaves them off if the reader turned them
  off.
- **Step labels agree.** A cue that quotes a guide step heading must use that heading's own
  translation, taken from the 122 `Step N of M: <label>` keys already in the page catalogue.
  `translate.mjs` passes it to the model as a required term, and `npm run test:validate` checks it
  afterwards (`stepLabelDrift`, under `captions:<locale>`), along with a cue left untranslated
  (`missingCue`) and the usual numbers, product names and structural characters. "Double Click", the
  series name, is a protected token and stays in English.
- **The transcript is the same strings.** The *Transcript* under each video is the caption text,
  fetched from the served language's track when the reader opens it, so it is always in their
  language and costs nothing until opened. Its body is already localized, so `src/i18n-apply.js`
  skips it and the harvester leaves it out of the page catalogue.

### Player behaviour

`src/media.js` and `src/media.css` are injected by the build like the rest of the runtime layer, and
the panel mounts into two empty slots that transforms in `src/transform-export.mjs` add to the export,
so a re-export cannot discard it.

- **Native controls, no autoplay.** The browser's own player: never `autoplay`, `muted` or `loop`.
  `preload="none"` means nothing of the video downloads until the reader presses play, which protects
  the Pages bandwidth budget; the poster still loads. The same `<video>` stays mounted across step
  changes and re-renders, and moving to another guide stops the old download.
- **No manifest entry, no panel.** A guide with no shipped video renders no panel and no gap, like
  the Feedback button without an endpoint: no player is better than a broken one.
- **Same origin only.** The build inlines the shipped items into `src/media.js`, every path relative
  to the page. The panel accepts only plain `media/...` paths (no scheme, host, leading slash or `..`)
  and drops any item that breaks the rule, so neither a bad manifest nor the test override can point
  the page at another origin.
- **The keys belong to the player inside the panel.** With focus on the video or its transcript,
  Space plays and pauses and the arrows seek, where elsewhere Space is Play all and the arrows change
  step.
- **Target Profiles.** The four Target Profiles guides get panels the same way as every other guide,
  when their episodes are in the manifest, and until then show none; `npm test` checks that
  `target-profiles` shows no panel against fixture media. Where `src/release.mjs` (the beta switch) is
  in the tree, the build also asks it which guides ship: a guide marked beta has its episode, caption
  tracks and transcript left out of `dist/` when `SA_SHOW_BETA` is `false` or `0`, absent rather than
  hidden. The showcase is not a guide and always ships.

### Placeholder clip

The player, the hosting and the captions were built and tested before any real episode existed,
against a placeholder:

```sh
npm run media:placeholder
SA_MEDIA_MANIFEST=.media-fixture/manifest.json SA_MEDIA_DIR=.media-fixture \
  SA_MEDIA_CAPTIONS_DIR=scripts/fixtures/media/captions npm run build && npm run serve
```

`npm run media:placeholder` encodes 8 seconds of an ffmpeg test pattern with a 440 Hz tone, using
exactly the settings and checks `npm run media:add` uses, into the gitignored `.media-fixture/`, with
its own manifest pinning it as the `dashboard-overview` episode and the showcase. Without ffmpeg,
`npm run media:placeholder -- --dummy` writes bytes that build and serve but do not play. The
placeholder never enters the committed manifest or the published site.

The three overrides point the build somewhere other than the defaults:

| Variable | Default | Points the build at |
|---|---|---|
| `SA_MEDIA_MANIFEST` | `src/media/manifest.json` | another manifest |
| `SA_MEDIA_DIR` | `.media` | another staging directory |
| `SA_MEDIA_CAPTIONS_DIR` | `src/i18n/captions` | another directory of caption catalogues; the fixture's three cues are translated in `scripts/fixtures/media/captions` |

The browser tests do not decode video (decided 2026-10-19): Playwright's bundled Chromium likely
cannot play H.264 and AAC, and the branded Chrome that can is not installed in CI. Instead they inject
a runtime manifest through `window.__saMediaManifest`, the same pattern as `__saFeedbackEndpoint`,
serve fixture media through `page.route` on the page's own origin so the zero-external-origins check
still means something, and fire synthetic `play` and `ended` events, which `src/media.js` handles
exactly as it handles real ones. Real playback is checked by hand with this clip.

### Who can publish

Creating a release and uploading assets need `contents: write` on the repository. Nothing here assumes
it: `media:add` prints the `gh` commands and runs none of them, and the deploy job keeps
`contents: read`, using the built-in `GITHUB_TOKEN` only to soften rate limits on downloads (public
release assets need no token). Keeping write access out of CI means no build step can rewrite the
media every reader downloads.

The `gh` CLI login these scripts were written under has read access to the repository only; it cannot
set repository secrets, let alone create releases. Publishing is therefore an owner action: run the
printed commands signed in to `gh` as the repository owner (`gh auth switch` when more than one
account is signed in).

### Fallback

If the Pages budget proves too tight, Microsoft Stream on SharePoint is the documented fallback. It is
**not implemented**, and was rejected as the default on 2026-10-19: it is an external origin, which the
smoke test would have to allowlist as it would an analytics endpoint, and it puts a second sign-in in
front of every reader.

## Instrumentation and feedback

See [`docs/test-protocol.md`](docs/test-protocol.md) for the moderated session plan.

**Events** (`src/analytics.js`) — a closed set: `guide_opened`, `step_advanced`, `guide_completed`, `play_all_used`, `stub_clicked`, `search_used`, `feedback_opened`, `feedback_sent`, `returned_home`, `locale_resolved`, `locale_changed`, `locale_applied`, `locale_catalogue_missing`, `locale_catalogue_failed`, `gate_shown`, `gate_opened`, `gate_rejected`, `contact_opened`, `splash_dismissed`, `video_played`, `video_completed`. No PII, no cookies; an anonymous per-tab session id only. An event outside the set is dropped with a console warning.

The two video events carry three properties: `key` (the guide key, or `showcase`), `locale` (the reader's chosen locale) and `kind` (`episode` or `showcase`). `video_played` fires once per playthrough, not per press of play, so a reader who pauses to try a step in IntelliDash and resumes records nothing new; `video_completed` fires when the video ends, and a later play counts as a new playthrough. A start and a finish are separate events for the same reason as the Feedback pair: the drop-off between them is the interesting number. No watch position or timing is recorded beyond the event's own time.

By default the transport is **`local`**: events are buffered in `localStorage` and **nothing leaves the device**, which keeps the zero-external-origins property the smoke test enforces. In the browser console:

| | |
|---|---|
| `__saReport()` | summary — guides opened, stub demand, event counts, and `videos`: plays and completions per video, as `{ <key>: { played, completed } }` |
| `__saExport()` | download the raw events as JSON |
| `__saClear()` | reset before a session |

After a moderated session, `node scripts/session-readout.mjs _sessions/round1` turns the exported files into the per-task table (completion rate, median time on task, stuck steps), and `--compare` sets round 2 against round 1. `_sessions/` is gitignored: raw exports and moderator sheets never enter the repository. `node scripts/session-readout.mjs --selftest` checks the scoring on made-up sessions.

That's sufficient for moderated sessions. **It does not collect from remote users.** For that, set `TRANSPORT = 'beacon'` and `SA_ENDPOINT` at the top of `src/analytics.js`, and add that origin to the allowlist in `scripts/smoke.mjs` — otherwise the smoke test will correctly fail the build for reaching a third party. Choosing that endpoint is an open decision.

**Feedback** (`src/feedback.js`) is a floating **Feedback** button, bottom right, on every page
once the reader is past the sign-in gate. It opens a small non-modal panel showing the page and
step the reader is on; they type a comment and press **Send**. The comment is POSTed, with the
page, step, locale and URL attached, to a **Power Automate flow** in Toro's tenant, which adds it
to a **SharePoint list**. The reader never leaves the site and never sees where it went. The panel
says "sent" only once the flow has answered, and the flow answers only after the SharePoint step,
so "sent" means stored. A failed send says so and keeps the note, in the box and as a draft.

**Until an endpoint is configured the button does not appear at all.** A button that sends
nowhere is worse than no button.

Why a flow (decided 2026-09-23):

- The previous destination was a prefilled GitHub issue opened in a new tab. It sent readers to
  GitHub, needed an account, and made every comment public on a personal repository.
- Filing issues directly from the page would need a GitHub token in the page, and the repository
  is public — anyone could read it and write to the repo.
- An embedded Microsoft Form kept readers on the site, but put Microsoft's form — with the context
  as visible prefilled questions — inside the panel.
- Cloudflare, Google Sheets and Azure are ruled out on Toro's tooling (see Sign-in gate). Power
  Automate runs inside the tenant; its HTTP trigger needs a Premium licence, which the owner has.

The button replaced a "Was this helpful?" row at the foot of each guide. That row sat below the
"Next" cards where few readers scroll, its thumbs-up collected a click and nothing else, and the
catalogue had no way to comment at all. The panel is non-modal so the step being commented on
stays in view. Send is disabled while the comment is empty; comments are capped at 4,000
characters. On phones the button is icon-only and the panel spans the width. Activating any
unwritten card records demand and opens the same panel as a guide request.

**Configuring the endpoint.** The flow trigger's HTTP POST URL is **not in the repository**: its
`sig=` parameter lets anyone holding it post to the list. `build.mjs` substitutes it into
`src/feedback.js` from the `SA_FEEDBACK_ENDPOINT` environment variable, which the deploy workflow
sets from the repository secret of the same name. The built page still carries it — a browser
cannot post without it — but git history does not. Unset, as in local builds and the tests, the
button is not rendered; to try the real thing locally, run
`SA_FEEDBACK_ENDPOINT='<url>' npm run build`. To rotate it, regenerate the URL in Power Automate
and run `gh secret set SA_FEEDBACK_ENDPOINT`, then re-run the deploy.

**The request.** A form-encoded POST (`application/x-www-form-urlencoded`) with six fields:
`kind` (`Feedback` or `Guide request`), `page`, `step`, `comment`, `locale`, `url`. Form-encoded
rather than JSON because it is a CORS *simple request* — no preflight `OPTIONS` call, which the
flow trigger does not answer — and because the flow reads each field directly with
`triggerFormDataValue('comment')`, with no Parse JSON step or schema to keep in sync.

**The flow**, in order:

1. **When an HTTP request is received**, with *Who can trigger the flow?* set to **Anyone** — the
   readers are anonymous browsers.
2. **SharePoint → Create item** on the *Guide feedback* list: Title
   `triggerFormDataValue('page')`, Comment `take(triggerFormDataValue('comment'), 4000)`, and Step,
   Kind, Locale and PageURL from the matching fields.
3. **Response**, status `200`, header `Access-Control-Allow-Origin: https://toroadam.github.io`.
   Without that header the browser hides the response, and the panel reports a failure even
   though the item was stored. It comes last so a SharePoint failure reaches the reader as one.

**The URL is a capability.** Whoever has it can post to the list, and it ships in this public
page. The flow truncates what it stores, and if the URL is ever abused, regenerate it in Power
Automate and update the secret as above.

**Drafts survive.** The note is written to `localStorage` on every keystroke under
`sa.feedback.draft`, restored when the panel reopens on the same page, and cleared only once the
flow confirms the send. Cancelling, Escape and a failed send all keep it.

`scripts/instrumentation.mjs` injects a stub endpoint (`window.__saFeedbackEndpoint`) and answers
it locally, then drives the whole path: Send disabled while empty, a note surviving a cancel,
the posted fields carrying the page and step, "sent" shown only after the answer, a provoked
failure that keeps the note, Escape returning focus — and, on a page with no stub, that the button
is absent.

Note that unwritten cards are **real buttons**, not disabled ones: activating one requests the guide. Marking them `aria-disabled` would contradict the fact that they do something.

## Sign-in gate

`src/gate-boot.js`, `src/gate.js` and `src/gate.css` are injected by
the build, outside the Core Design export, for the same reason the a11y layer is.

**This is a courtesy barrier, not access control, and should not be presented as one.** The rule
ships to the browser, the guide content sits in the same document, and the repository is public —
so `curl`, View Source, or a local rebuild all walk straight past it. It exists to point the pilot
at its intended audience and make entry deliberate. Nothing that would matter if it leaked should
be published behind it.

A real gate needs a server, and the two routes that were on the table both failed on access:
Cloudflare isn't available at Toro, and publishing GitHub Pages privately requires the repo to sit
in a **GitHub Enterprise Cloud organisation** — this one is a personal repo with no org. If the
content ever needs actual protection, that is the decision to revisit, not this file.

**Settled 2026-09-08: this is the answer, not a stopgap.** A third route was raised and closed —
Azure Static Web Apps with Entra ID auth would gate at the platform rather than the repository, so
it needs no GHEC organisation, and its managed Functions would also have served the feedback
endpoint. It was declined as disproportionate for a pilot this size, because obtaining an Azure
subscription and a Toro-owned pipeline means going through an administrator. Note the shape of
that: all three rejected routes failed on **access**, not on technology. That work is closed as
NOT DOING and its three Cloudflare features are cancelled. A real gate wants a fresh Epic Request
against whatever platform is permitted at the time, not those.

**The rule** is domain-based with room for named exceptions, both at the top of `src/gate.js`:

```js
var ALLOW_DOMAINS = ['toro.com'];   // subdomains count; the check is anchored on the dot
var ALLOW_EMAILS = [];              // exact addresses, for anyone off-tenant
```

Adding one person is a line in `ALLOW_EMAILS`. Widening to a whole organisation should be a
conscious edit to `ALLOW_DOMAINS`, not something that happens by accident.

**Why the decision is made in `<head>.`** `src/gate-boot.js` resolves the flag synchronously and
records it on `<html>`; `src/gate.css` keys off that attribute. Deciding in `src/gate.js` alone —
which runs at the end of `<body>` with the other modules — would paint the whole catalogue and
then cover it, showing the reader exactly what they haven't been admitted to. The page behind is
hidden with `visibility`, not `display`, so the runtime measures the geometry it would have
measured anyway; the sticky "On this page" tracker calibrates against a fixed offset and would
otherwise compute against a collapsed page.

**Covered by `npm run test:splash`** (`scripts/splash.mjs`), added 2026-09-08 — it had none, while
the gate, routing, i18n and feedback layers each did. Every interesting property of a splash is a
timing or lifecycle property, and each fails silently: one that never leaves reads as a slow site,
one that leaves too early flashes, and one that is hidden rather than removed stays reachable by
Tab and by a screen reader. The script asserts the markup is in the *served document* (checked
without a browser, since build-time injection is the point), that `aria-busy` is set while it is up
and cleared after, that the hold is honoured, that the node leaves the DOM, and that exactly one
`splash_dismissed` event fires carrying its measured `ms`. It drives both branches of
`contentReady()` — the runtime painting, and the gate covering the page, where the splash must
still leave or a gated reader sits behind two overlays.

**Bypassed on `localhost` and `file://`.** Eleven Playwright scripts drive the built page and
assert against rendered text, and `innerText` skips a `visibility:hidden` subtree — so a gate that
was live locally would turn the whole suite red. Seeding the unlock into eleven browser contexts
puts the same bypass in eleven places and rots as scripts are added. Reaching localhost means
already having the files, so nothing is given away. Append **`?gate=1`** to drop the bypass and get
the deployed behaviour, storage and all; that is how `npm run test:gate` drives it.

### Logging who signs in

Off by default. `SIGNIN_LOG_ENDPOINT` at the top of `src/gate.js` is empty; set it to a URL and every
successful sign-in POSTs `{ email, at, locale }` to it.

The cheapest thing that works, with no infrastructure to run:

1. New Google Sheet → **Extensions › Apps Script**, and paste:

   ```js
   function doPost(e) {
     const d = JSON.parse(e.postData.contents);
     SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
       .appendRow([new Date(d.at), d.email, d.locale]);
     return ContentService.createTextOutput('ok');
   }
   ```

2. **Deploy › New deployment › Web app**, execute as *Me*, access *Anyone*. Copy the `/exec` URL.
3. Put it in `SIGNIN_LOG_ENDPOINT`, and add `script.google.com` to the allowlist in
   `scripts/smoke.mjs` — otherwise the build correctly fails for reaching a third party.

Three things to know before you switch it on, none of which are blockers but all of which are
decisions:

- **It sends real email addresses off the reader's device.** `src/analytics.js` states it collects
  no PII and that has to stay true, so this path is deliberately separate from the analytics queue
  and never enters it.
- **The gate's footer text changes automatically** when the constant is set, from "not sent
  anywhere" to saying Toro records which addresses open the guides. That is wired to the constant
  rather than to somebody remembering, so the gate cannot end up lying to a reader.
- **The Sheet is world-writable in practice.** Access *Anyone* means anyone who learns the URL can
  append rows. For a pilot roster that is usually fine; it is not an audit log.

**Privacy.** With logging off, the address is compared in the browser and written to `localStorage` on that device.
It is never transmitted. The instrumentation records only the domain — `src/analytics.js` states it
collects no PII, and logging the address would quietly make that untrue.

**Not localised.** The prompt is English — as is everything else on the site. See
**Localisation status** below.

## Localisation status

The selector, the negotiation and
the runtime translation layer are complete. **Catalogues exist for some locales and not others,
and the site tells the truth about which** — see the table below.

What is built (`src/i18n.js`, `src/i18n-selector.js`):

- the eleven-locale registry, sourced from IntelliDash's own `addLangs()` call rather than its
  `LanguageCode` enum — see the header of `src/i18n.js` for why those differ;
- BCP-47 negotiation with a primary-subtag fallback, so `de-AT`, `pt-BR` and `zh-TW` land on a
  catalogue instead of dropping to English;
- precedence of `?lang=` over stored choice over `navigator.languages` over `en-us`;
- the selector itself, as an accessible listbox.

### How translation is applied

The content lives inside the Core Design export's own component scope, and the runtime re-renders
on every state change — neither is reachable from our code. So `src/i18n-apply.js` translates the
**DOM**, keyed on the exact English string. Two things make that survivable:

- every node it touches keeps its English original on the node (`__saEn`), so switching locale
  twice does not compound and a runtime-recreated node still matches; and
- re-application rides the same coalesced `MutationObserver` pattern as `src/feedback.js`, so a
  re-render is self-healing — the runtime paints English, the observer fires, it is translated
  again within a frame.

`scripts/extract-strings.mjs` harvests the source catalogue from the **rendered page**, walking all
26 guides and every step. That is deliberate: a key harvested from source is not necessarily what
the runtime paints, and a key that never matches is a silent no-op. Harvesting what is on screen
makes the key set and the match set the same set. Re-run it after any Core Design re-export.

`src/i18n/glossary.json` holds terminology lifted from **IntelliDash's own shipped catalogues**
(`site/src/assets/i18n/*.json`, read-only) via `scripts/build-glossary.mjs`. A guide that says
"open Settings" while the product's German build says "Einstellungen" sends the reader looking for
a control that does not exist under that name.

**The reproduced screen is translated too.** `.sa-app` used to be skipped on the reasoning that it
is a faithful reproduction of the product — but the real IntelliDash is localised, so an English
screen inside German prose was the inaccurate version, and it left guides naming controls ("open
Settings") that the screenshot beside them labelled differently.

`scripts/app-strings.mjs` resolves those labels against **IntelliDash's own shipped catalogues**
first, so about half of them are the product's actual translation rather than a new one — and they
are the half a reader is most likely to go hunting for on their own screen. Station identifiers,
timestamps and the fictional site name pass through untouched by design. The remainder live in
`src/i18n/app-manual.json`. Colours inside `.sa-app` are still left alone — see *Deliberately not
fixed*.

Where a screen label collides with a guide string (currently just "Apply to all"), the product's
wording wins: it is the button the reader actually clicks. Compounds are regenerated from it so the
step list and the step heading cannot disagree.

**A prose correction is a translation job, and the six-string case is the common one.**
Catalogues are keyed on the exact English, so editing a sentence orphans its ten translations
silently — the runtime finds no key and paints English. `scripts/translate.mjs` computes its
`todo` as the source keys with no fragment yet, which for an empty `.translate/<locale>/` is all
1418 strings: the right behaviour for a new locale, and entirely the wrong one after a six-word fix.

`scripts/seed-translate-fragments.mjs` closes that gap. It seeds `.translate/<locale>/` from the
catalogue already in `src/i18n/`, keeping every key the source still asks for and dropping the ones
whose English has moved on, so `todo` resolves to exactly the strings that changed:

```sh
node scripts/seed-translate-fragments.mjs           # all ten; prints the todo for each
node scripts/translate.mjs --locale de-de           # de-de: 1418 strings, 1412 already done, 6 to translate
node scripts/assemble-locale.mjs de-de .translate/de-de
```

Dropping the superseded keys is not an optimisation — carrying them would fail
`assemble-locale.mjs`'s unknown-key check, which is the same guard that stops a partial catalogue
shipping. `scripts/retranslate-drift.mjs` uses the same seeding trick for its own narrower case.

**Video captions are a second catalogue,** `src/i18n/captions/<locale>.json`, kept out of the page
catalogue so the harvester cannot drop them and readers who never press play never download them.
`scripts/media-cues.mjs` writes its source from the English caption tracks, and the same three scripts
handle it with `--catalogue captions`, keeping fragments in `.translate/captions/<locale>/`.
`npm run test:validate` checks it after the page catalogues, under `captions:<locale>`, adding a cue
left untranslated and a cue that quotes a step heading in other words. The build turns it into eleven
caption tracks per video. See **Video › Captions and transcripts**.

**The transcript under a video is already localized** — it is the caption text of the served
language — so `src/i18n-apply.js` skips its body, and `scripts/extract-strings.mjs` leaves it out of
the harvest, which would otherwise pull every cue into the page catalogue. The panel's own strings (its headings, *Transcript*, the fallback and error text) are ordinary page
strings, harvested with the panel open against the test fixture and translated in all ten page
catalogues.

**The harvest.** `scripts/extract-strings.mjs` also drives the contact modal and the feedback panel
before it harvests, the way it opens the language menu, so text that only exists once a dialog is
open reaches the catalogue. Run `scripts/harvest-both-modes.mjs`, which builds and serves each release
mode on a free port, harvests each to a scratch file and reports the union, and with `--write`
**diff-and-adds** it into `src/i18n/en-us.json` rather than overwriting it: `en-us.json` is the harvest **plus**
`scripts/app-strings.mjs`, so the raw harvest drops the screen labels. A clean sweep is a harvest
with no key missing from `en-us.json` and `node scripts/seed-translate-fragments.mjs` reporting
`0 to translate` in all ten locales. After `scripts/assemble-locale.mjs`, restore each catalogue's
`_meta` from `HEAD` (keeping the new string count), then run `npm run test:validate`,
`npm run test:i18n` and `npm run test:prose`.

The guide-request dialog's two strings cannot be harvested: no catalogue card carries
`data-stub="true"` now that all 26 guides are written, so the dialog is unreachable and the harvester
prints a note instead of failing. If an unwritten guide is ever added back, re-run the harvest before
relying on those two strings.

### Coverage

| Locale | Catalogue | Coverage |
|---|---|---|
| `en-us` | source | — |
| `de-de` `es-es` `fr-fr` `it-it` | ✅ 1418 strings | 93.1% / 93.5% / 91.8% / 93.5% |
| `ja-jp` `ko-ko` `nl-nl` `pt-pt` | ✅ 1418 strings | 92.6% / 92.3% / 92.7% / 93.5% |
| `th-th` `zh-cn` | ✅ 1418 strings | 93.5% / 91.8% |

All eleven locales now serve translated content. Coverage is measured by `npm run test:i18n` against a
rendered guide; the residual 6 to 8 per cent are strings that are legitimately identical — URLs, station
identifiers, `N MIN`, the copyright line — plus the `.sa-app` seam described above and the labels IntelliDash itself leaves in English, such as the Settings dialog's left rail (`Minimum Threshold`, `Calculation`), which the guides name in `[[ ]]` markers exactly as the screen shows them.

Regenerate a locale with `npm run translate -- --locale <code>`, then
`node scripts/assemble-locale.mjs <code> .translate/<code>`, then add the code to `CONTENT_LOCALES`.
`scripts/translate.mjs` chunks the catalogue, feeds each chunk the glossary, matches results back by
echoed source rather than by position, and resumes where a failed run stopped. It writes fragments
only — `assemble-locale.mjs` is still the gate, so machine output faces the same completeness check as
anything hand-written.

**No catalogue means English, and the page says so.** `<html lang>` reports the language actually
**served**, not the one chosen; the chosen locale goes on `<html data-sa-locale>`. Emitting
`lang="fr-FR"` over English text makes a screen reader pronounce every word with French phonetics —
worse than not offering the choice, and a WCAG 3.1.1 failure. Adding a code to `CONTENT_LOCALES` at
the top of `src/i18n.js` is what flips a locale on, and the tag corrects itself.

The `locale_resolved` event carries a `translated` flag for the same reason: demand for a language
nobody can read yet is the signal worth having.

### Review status

**These are machine translations and no native-speaker review is planned.** That is a decision, not
an outstanding task — `_meta.nativeReviewPlanned` is `false` in every catalogue so nobody later reads
the gap as work in progress. What they *have* had is `npm run test:validate`
(`scripts/validate-locales.mjs`), which mechanically checks the class of error that survives a
fluent-sounding translation:

- every number in the source survives into the target (a decimal comma is not read as a changed value);
- product names, station identifiers, URLs and `MIN` are still present where the source had them;
- structural characters — `←` `→` `…` `›` `÷` `×` — are not lost, so an instruction or a formula cannot silently break;
- no empty values, and no long string returned identical to English;
- every `Step N of M: X` contains the standalone translation of `X`, so the step list and the step heading cannot disagree;
- prose that names a reproduced control uses that control's own translation (`screenLabelDrift`), and every `[[label]]` marker holds the label the reader's screen shows in that locale (`markerDrift`);
- every `[[label]]` in the English is a key of `src/i18n/labels.en-us.json`, a fixture of IntelliDash's own English labels written by `scripts/build-label-fixture.mjs`, and is named by a Verified claim in `docs/claims/claims.json` (`labelProvenance`).

It deliberately does **not** flag `—` or `%`: Romance languages routinely render an em dash as a
colon, and Chinese spells `% Adj.` out as 调整百分比 rather than using the glyph. Both are correct, and
flagging them would bury the real defects.

The pass found and fixed one genuine defect (Italian compounds using an em dash where their own
standalone translations used a colon) and confirmed two behaviours that look like defects and are
not, now encoded as documented exemptions in the validator: German couples the product name into
compounds with hyphens (`Spatial-Adjust-Konto`, required *Durchkopplung*), and a control whose
shipped label drops the VWC acronym (Thai `ปริมาตรน้ำเป้าหมาย` for Target VWC, Spanish `CVA objetivo`)
is named with that label, while VWC as the measurement itself keeps the acronym in every locale.

`screenLabelDrift` is a **gate**, held at zero findings. Prose that names a control uses the
product's shipped label even where that label has no "VWC" in it (`CVA objetivo`, `Teneur en eau
volumétrique cible`); prose about the measurement keeps "VWC". `droppedToken` exempts a missing VWC
only when every VWC in the English sits inside such a control's name, and `VWC_CONCEPT_KNOWN` in
`scripts/validate-locales.mjs`, the list of concept strings allowed to say CVA or Hv, is empty and
may only shrink. `scripts/retranslate-drift.mjs` shares the gate's predicate
(`scripts/lib/screen-labels.mjs`), so its re-translation queue is exactly what the gate fails. The
rules are written up in `docs/writing-guide.md` under Label markers.

What this does not give you is judgement about whether the prose is good, idiomatic, or says the
right thing to a superintendent. Nothing here substitutes for that.

## Boot splash and skeletons

`src/splash.js` and `src/splash.css`. The markup is written into `<body>` by `build.mjs` rather than
created in JS, because this file runs at the end of `<body>` — creating the splash here would mean
showing it *after* the wait it exists to cover.

The splash clears when `#dc-root` has actually painted content, not when it merely exists: the
runtime mounts an empty root before rendering, so "root exists" is not "content is ready". A 9s hard
ceiling removes it regardless, because a runtime failure must leave the reader looking at whatever
did render rather than at a loading screen implying something is still coming.

**It also holds for a minimum of 650ms**, and that is a deliberate cost. Everything the runtime needs
is inlined by the build — no CDN, no fetch — so on a warm load it paints in about 30ms and the
splash flashed past faster than the eye resolves, which reads as a glitch rather than a load. 650ms
is the shortest hold that still reads as intentional. It is real added latency on fast connections;
lower `MIN_VISIBLE` in `src/splash.js` if that trade stops being worth it.

`<html aria-busy="true">` is set while it is up, so assistive tech announces a wait rather than an
apparently empty page. The skeleton cards and the progress bar share one keyframe family so they
pulse together, and `prefers-reduced-motion` drops the travel while keeping the bar visible.

It sits below the gate in the stacking order — a locked reader sees the gate, not this.

## Contact and footer

`src/contact.js` and `src/contact.css` add a **Contact** button in the header and a matching link
in the footer, both opening one NSN details modal. Injected by the build, outside the Core Design
export, and mounted from the same coalesced `MutationObserver` the rest of the runtime hooks need.

The header now reads **brand … search, Contact, Language** — the two site-wide controls sit hard
right, where neither competes with the brand or the search field for the reader's attention.
`src/i18n-selector.js` pins the language selector to the end of the row and the contact button
inserts itself immediately before it.

Header, page content and the footer all share one container — 1180px with 32px gutters — so
every left edge on the page lines up at the same x. The floating Feedback button sits outside that
grid on purpose, fixed to the bottom-right corner of the viewport.

The footer is a four-column block — **Sections, Support, Product, Legal** — above the copyright
line. The six section links are buttons rather than anchors: the app owns the hash for its own
routing (`#/guide-key`), so a plain `#section` fragment reads as an unknown guide key and bounces
the reader to the catalogue. They navigate home, then scroll the matching heading into view, matched
on the *translated* heading text so they work in every locale.

**Every destination is sourced from IntelliDash, not invented:**

| | |
|---|---|
| `NSNTech@toro.com` | setup-wizard FAQ |
| `1-800-ASK-TORO` | `TORO.HELP_LINE` |
| `my.toronsn.com/Support` | setup-wizard FAQ |
| `intelli360.toro.com` | `intelli360SiteUrl`, environment.toro-prod |
| `lynxcloud.toro.com` | the same environment file |
| the three legal URLs | `TORO.*_LINK` — identical in all eleven locale files, every one pointing at `/en/`, so there is nothing to localise |

IntelliDash ships a per-region support number (`TORO.HELP_LINE` is `00-800-8040-8040` in German,
`900-973-219` in Spanish, `800-791-226` in Italian), so the modal translates the *value* as well as
the row label, and the `tel:` href is built from the translated string so the link dials what the
row displays. `pt-pt` and `zh-cn` have no `HELP_LINE` in IntelliDash's catalogue and keep the US
number. `validate-locales.mjs` compares the numbers in a string with its translation, and a regional
number legitimately shares no digits with `1-800-ASK-TORO`, so that check is skipped when the
translation *is* IntelliDash's own shipped rendering, the same principle as the `_screenStrings`
exemption.

**There is no Lynx Drive URL anywhere in the IntelliDash source.** The Product column links Lynx
Cloud instead, which is the nearest thing that actually exists. If Lynx Drive has an information
page, it needs to be supplied — it cannot be derived.

Everything it shows goes through the same catalogues as the rest of the site, so the control is not
an English-only island in a site that ships eleven languages. Two things this shook out that are
worth knowing:

- `.lsa-contact-label` was doing double duty on the header button and the modal's row labels, so the
  phone-width rule that hides the button text also blanked every label in the modal. The button's
  label is now `.lsa-contact-btn-label`.
- The dc-runtime adopts the footer anchors and repaints them `#3079f0` — 4.1:1 on white, below AA at
  13px. Corrected with the same `!important` pattern `a11y.css` already uses for runtime-applied
  colours. The buttons in the same row are untouched by the runtime and need nothing.

## Known gaps

- **Analytics endpoint undecided**, so telemetry is local-only and collects nothing from remote users. The event layer itself is complete and exercised — flipping `TRANSPORT` to `'beacon'` and setting `SA_ENDPOINT` in `src/analytics.js`, plus adding that origin to the allowlist in `scripts/smoke.mjs`, is the whole change. Until then a gated pilot in ten languages tells you nothing about who read what.
- **No manual screen-reader pass** (VoiceOver/NVDA). Automated checks and keyboard driving aren't a substitute.
- **No translation has been reviewed by a native speaker**, and none is planned. Mechanically validated only — see Review status.
- **The sign-in gate is client-side** and the repository is public, so it restricts the audience, not the content. See the section above for what would have to change.
- **Two of the four uncovered features now have guides.** `request-scan-data` and
  `filter-adjustments` were written after `src/transform-app.mjs` added the two controls the
  reproduction was missing: the Over/Under Options dialog and the scan-data banner. Both ride the
  existing `dialog` prop — `<dc-import>` only forwards attributes matching the component's
  *original* schema, so a transform-added prop arrives `undefined` however correctly it is declared
  and bound, whereas a new **value** on an already-bound enum passes straight through.
- **New-guide candidates.** Three production surfaces need figures the reproduction cannot draw,
  so they wait on extending `SpatialAdjustApp.dc.html` in Core Design instead of being folded into
  a guide. [`docs/claims/changed-surfaces.md`](docs/claims/changed-surfaces.md) gives the
  disposition of every Spatial Adjust change since 2026-08-13 and the production line behind it.
  - **Target Profiles as shipped**, with the applied-profile label beside Calculation
    ET. Production draws the tab as a table of five fixed slots per Lynx course, and the figures
    now draw that table (`src/transform-app.mjs`). No figure draws the applied-profile label or
    the Apply confirmation, so rewriting `target-profiles`, `creating-profiles`,
    `updating-profiles` and `seasonal-profiles` around the shipped tab needs the reproduction
    extended in Core Design.
  - **Multiple Lynx courses**. A task guide needs figures of the course selector and of
    Target Profiles per course. The reproduction has a `multiCourse` prop, but the guide page does
    not forward it, and nothing draws a per-course view. Extending the reproduction in Core Design
    comes first.
  - **An Enabled Stations task guide**. `map-navigation` step 4 gives the production
    default and says the choice is remembered. The map figure now draws Enabled Stations
    selected, with the disabled station's pin hidden (`docs/text-corrections.md` §23), but a task
    guide that walks through switching layers still needs more figures than the reproduction
    draws.

  The toolbar's **Announcements** button is not a candidate. It opens the product-wide
  announcements panel and changes no Spatial Adjust data, so its absence from every toolbar figure
  is a reproduction gap, not a missing guide. The two features this list used to carry now have
  guides: `request-scan-data` step 4 covers the update banner's Dismiss, and the guides that save
  Settings (`calculation-settings`, `calculation-methods`, `minimum-threshold` and `preferences`)
  cover the Discard changes confirmation.
- **Beta guide candidates.** Two beta surfaces, behaviour that develop and the beta environment
  have and production does not, cannot be drawn by the reproduction, so they have no guide text
  and are not published in either release mode. [`docs/claims/beta-surfaces.md`](docs/claims/beta-surfaces.md)
  is the source for both, with the develop citations. The one beta surface the reproduction can
  draw, `stale-scans-kept`, is the beta step "A stale course keeps its last scans" in
  `calculation-questions`.
  - **`suggestion-held-without-new-scan`.** On a day when TurfRad has loaded nothing new, beta
    writes today's suggestion once, at the first processing run, and later runs leave it alone,
    modelled from the older of the station's two most recent days. Production recalculates it on
    every run. No single figure differs from production. A guide would need the reproduction to
    show a value changing over the day, for example two figures of the same row at two times of
    day, and the experts to say whether the "older of the two" input is intended.
  - **`scan-day-from-load-time`.** Beta decides whether a scan is today's from the time TurfRad
    loaded it, while the table still dates and styles the reading by its measurement date. It
    shows only when TurfRad loads a scan on a later day than it was measured. A guide would need
    the reproduction to carry a scan's load time beside its measurement date, and the experts to
    say how often a late load happens.
- **`_incoming/`** is a scratch area for raw exports and is never tracked.

## Two export defaults corrected by transforms

The export ships a shortcut hint of its own (`← → step · space play · esc back`), so the build must not add a second one — it did briefly, and the duplicate was visible right below the original.

The export also sticks the "On this page" tracker at `top: 742px`. That offset suits the walkthrough stage but strands the tracker near the bottom of the window for the rest of the guide, where it is least useful. A transform re-pins it to `top: 89px`, just below the 65px sticky header, and `src/a11y.css` caps its height so a list longer than the window scrolls rather than running off screen.

## Data

The site is published publicly, so it carries no customer data. The course shown in the app is a fictional placeholder (**Riverbend National**); station IDs and moisture readings are representative sample values. Keep it that way — do not paste real site data into either `.dc.html` file.
