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
| `Learn Spatial Adjust.dc.html` | The guide system — 6 categories, **24 authored guides**, TOC scroll-spy, step player. A `DCLogic` class component. |
| `SpatialAdjustApp.dc.html` | A 1920×1080 recreation of the Spatial Adjust UI. Deliberately stateless — every visual state comes from its 26 typed props. |

The guide `<import>`s the app component and drives it through those props, then uses a `camera(target, stageW)` pan-and-zoom to frame whichever region a given step is describing. **The guide puppets a live component rather than embedding screenshots, so figures cannot drift out of sync with the app.** Preserve this when changing either file.

`support.js` is the Core Design runtime (`dc-runtime`), generated and not editable by hand.

## What the build does

The raw export only renders inside Core Design's preview harness: it pulls React from unpkg.com at runtime and resolves the component import with `fetch()`, so it breaks on a blocked network and cannot run from `file://`.

`build.mjs` fixes both **without forking `support.js`**, using two hooks the runtime already supports:

- **`window.__resources`** — a URL→URL map consulted by `cdnScriptFor()` before falling back to unpkg. React and ReactDOM are redirected to `vendor/`. Its presence also stops `boot()` re-fetching `location.href`.
- **`window.__resourceBlobs`** — a URL→Blob map consulted by `bundledBlob()` before `fetch()`. `SpatialAdjustApp` is inlined as a Blob, which is what restores `file://` support.

It also adds `index.html` (the export had no entry point and a space in its filename), vendors the Satoshi font, and drops files that never execute — see `DS_EXCLUDE` in `build.mjs`, chiefly the 10MB `_ds_bundle.js`.

Result: **1.3MB, zero third-party origins.**

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

## Tests

| Command | What it checks |
|---|---|
| `npm test` | Boots the built bundle in Chromium with all external hosts blocked. Asserts the catalog renders 24 cards, a guide opens, the imported app component mounts, and there are zero external requests and zero console errors. |
| `npm run test:guides` | Discovers every guide from the page and walks all 24, stepping through each and fingerprinting the rendered DOM. Used to prove a change is render-neutral — diff against a known-good run. |
| `npm run test:keyboard` | Drives the interface: tab to a card, Enter to open, Space on Next, and asserts the live region changed. |
| `npm run test:routing` | Deep links, Back/Forward, and an unknown key falling back to the catalog. |
| `npm run test:a11y` | axe-core on the catalog and inside a guide, plus a keyboard-reachability probe. |

The fingerprint harness verified the original port: output was **identical** between the Core Design export and the built bundle.

## Accessibility and responsive behaviour

Delivered under an internal work item. `src/a11y.css` and `src/a11y.js` are injected by the build and live outside the Core Design export so a re-export can't discard them.

- **Keyboard.** The export built its controls from `<div onClick>`, which browsers give no keyboard behaviour — only 3 elements on the whole page were focusable against 26 with click handlers (now 29 focusable). Controls now carry `role="button"` and `tabindex`, and a delegated listener supplies Enter/Space activation. Verified end to end by `npm run test:keyboard`, which tabs to a card, opens it with Enter, and advances a step with Space.
- **Screen readers.** Cards have accessible names including duration and difficulty; the difficulty dots are `aria-hidden` with a text equivalent; step changes are announced through an `aria-live` region, since the camera move that conveys them is purely visual.
- **Contrast.** Guide chrome is at zero axe violations (was 66 on the catalog, 28 in a guide).
- **Responsive.** Zero horizontal overflow from 375px to 1920px, verified without `overflow:hidden` masking. Below 768px the fixed 1920×1080 stage is replaced with a short explanation and the written steps take the full width — at phone size the stage would need ~23% scale to fit, which is unreadable.

### Deliberately not fixed

Fourteen contrast failures remain inside `.sa-app`. That component is a faithful reproduction of the real IntelliDash screen, so correcting its colours would make the guides misrepresent the product. **These are a finding against IntelliDash itself, not against this site.**

## URL routing

Each guide has its own address (`#/minimum-threshold`), so a guide can be linked to directly and the browser Back button returns to the catalog instead of leaving the site. The export kept the open guide purely in component state, which meant neither worked. An unknown key falls back to the catalog rather than rendering blank. Covered by `npm run test:routing`.

## Instrumentation and feedback

Delivered under an internal work item. See [`docs/test-protocol.md`](docs/test-protocol.md) for the moderated session plan.

**Events** (`src/analytics.js`) — a closed set: `guide_opened`, `step_advanced`, `guide_completed`, `play_all_used`, `stub_clicked`, `guide_requested`, `search_used`, `feedback_submitted`, `returned_home`. No PII, no cookies; an anonymous per-tab session id only.

By default the transport is **`local`**: events are buffered in `localStorage` and **nothing leaves the device**, which keeps the zero-external-origins property the smoke test enforces. In the browser console:

| | |
|---|---|
| `__saReport()` | summary — guides opened, stub demand, event counts |
| `__saExport()` | download the raw events as JSON |
| `__saClear()` | reset before a session |

That's sufficient for moderated sessions. **It does not collect from remote users.** For that, set `TRANSPORT = 'beacon'` and `SA_ENDPOINT` at the top of `src/analytics.js`, and add that origin to the allowlist in `scripts/smoke.mjs` — otherwise the smoke test will correctly fail the build for reaching a third party. Choosing that endpoint is an open decision.

**Feedback** (`src/feedback.js`) routes to prefilled GitHub issues — no backend, no third-party script. "Was this helpful?" sits at the very bottom of the page and attaches the guide and step reached automatically. It deliberately does *not* sit beside the step player: that crowded the controls, and the sticky "On this page" tracker uses an offset calibrated to that panel. Activating any unwritten card records demand and offers to file a request in the reader's own words.

Note that unwritten cards are **real buttons**, not disabled ones: activating one requests the guide. Marking them `aria-disabled` would contradict the fact that they do something.

## Known gaps

- **Analytics endpoint undecided**, so telemetry is local-only and collects nothing from remote users.
- **No manual screen-reader pass** (VoiceOver/NVDA). Automated checks and keyboard driving aren't a substitute.
- **`_incoming/`** is a scratch area for raw exports and is never tracked.

## Two export defaults corrected by transforms

The export ships a shortcut hint of its own (`← → step · space play · esc back`), so the build must not add a second one — it did briefly, and the duplicate was visible right below the original.

The export also sticks the "On this page" tracker at `top: 742px`. That offset suits the walkthrough stage but strands the tracker near the bottom of the window for the rest of the guide, where it is least useful. A transform re-pins it to `top: 89px`, just below the 65px sticky header, and `src/a11y.css` caps its height so the 28-step guide's list scrolls rather than running off screen.

## Data

The site is published publicly, so it carries no customer data. The course shown in the app is a fictional placeholder (**Riverbend National**); station IDs and moisture readings are representative sample values. Keep it that way — do not paste real site data into either `.dc.html` file.
