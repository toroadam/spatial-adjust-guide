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
| `Learn Spatial Adjust.dc.html` | The guide system — 6 categories, 24 task cards, 7 authored guides, TOC scroll-spy, step player. A `DCLogic` class component. |
| `SpatialAdjustApp.dc.html` | A 1600×1000 recreation of the Spatial Adjust UI. Deliberately stateless — every visual state comes from its 15 typed props. |

The guide `<import>`s the app component and drives it through those props, then uses a `camera(target, stageW)` pan-and-zoom to frame whichever region a given step is describing. **The guide puppets a live component rather than embedding screenshots, so figures cannot drift out of sync with the app.** Preserve this when changing either file.

`support.js` is the Core Design runtime (`dc-runtime`), generated and not editable by hand.

## What the build does

The raw export only renders inside Core Design's preview harness: it pulls React from unpkg.com at runtime and resolves the component import with `fetch()`, so it breaks on a blocked network and cannot run from `file://`.

`build.mjs` fixes both **without forking `support.js`**, using two hooks the runtime already supports:

- **`window.__resources`** — a URL→URL map consulted by `cdnScriptFor()` before falling back to unpkg. React and ReactDOM are redirected to `vendor/`. Its presence also stops `boot()` re-fetching `location.href`.
- **`window.__resourceBlobs`** — a URL→Blob map consulted by `bundledBlob()` before `fetch()`. `SpatialAdjustApp` is inlined as a Blob, which is what restores `file://` support.

It also adds `index.html` (the export had no entry point and a space in its filename), vendors the Satoshi font, and drops files that never execute — see `DS_EXCLUDE` in `build.mjs`, chiefly the 10MB `_ds_bundle.js`.

Result: **1.2MB, zero third-party origins.**

### Why Babel isn't involved

`support.js` can load `@babel/standalone`, but only for `<import>`ed `.jsx`/`.tsx` files. Neither `.dc.html` contains JSX — `SpatialAdjustApp` calls `React.createElement` via `h()` 167 times, and the guide uses the runtime's own `{{ }}` template compiler with `new Function()`. Babel is never fetched. Verified: the only external requests the original export makes are React and ReactDOM.

## Re-exporting from Core Design

The Core Design files stay the source of truth. To pick up new authoring:

1. Export the updated `.dc.html` file(s) into the repo root, keeping their names.
2. If you add a new imported component, add its name to `COMPONENTS` in `build.mjs`.
3. `npm test`.

`build.mjs` throws if the export's shape changes in a way it depends on (a missing `support.js` tag or `_ds_bundle.js` tag), so a silently broken build isn't possible.

## Tests

| Command | What it checks |
|---|---|
| `npm test` | Boots the built bundle in Chromium with all external hosts blocked. Asserts the catalog renders 24 cards, a guide opens, the imported app component mounts, and there are zero external requests and zero console errors. |
| `npm run test:guides` | Walks all 7 live guides, stepping through each, and fingerprints the rendered DOM. Used to prove a change is render-neutral — diff the output against a known-good run. |

Both were used to verify the port: fingerprints across all 7 guides are **identical** between the original export and the built bundle.

## Accessibility and responsive behaviour

Delivered under an internal work item. `src/a11y.css` and `src/a11y.js` are injected by the build and live outside the Core Design export so a re-export can't discard them.

- **Keyboard.** The export built its controls from `<div onClick>`, which browsers give no keyboard behaviour — only 3 elements on the whole page were focusable against 26 with click handlers. Controls now carry `role="button"` and `tabindex`, and a delegated listener supplies Enter/Space activation. Verified end to end by `npm run test:keyboard`, which tabs to a card, opens it with Enter, and advances a step with Space.
- **Screen readers.** Cards have accessible names including duration and difficulty; the difficulty dots are `aria-hidden` with a text equivalent; step changes are announced through an `aria-live` region, since the camera move that conveys them is purely visual.
- **Stub cards** are `role="group"`, `aria-disabled`, and out of the tab order.
- **Contrast.** Guide chrome is at zero axe violations (was 66 on the catalog, 28 in a guide).
- **Responsive.** Zero horizontal overflow from 375px to 1920px, verified without `overflow:hidden` masking. Below 768px the fixed 1600×1000 stage is replaced with a short explanation and the written steps take the full width — at phone size the stage would need ~23% scale to fit, which is unreadable.

### Deliberately not fixed

Eleven contrast failures remain inside `.sa-app`. That component is a faithful reproduction of the real IntelliDash screen, so correcting its colours would make the guides misrepresent the product. **These are a finding against IntelliDash itself, not against this site.**

## Known gaps

- **17 of 24 guides are unwritten.** The cards render a "Coming soon" state; which to write next is the question an internal work item exists to answer.
- **No instrumentation** (an internal work item), so there's no data on which guides get used or completed.

## Data

The site is published publicly, so it carries no customer data. The course shown in the app is a fictional placeholder (**Riverbend National**); station IDs and moisture readings are representative sample values. Keep it that way — do not paste real site data into either `.dc.html` file.
