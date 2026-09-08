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
| `npm run test:validate` | Mechanical validation of every catalogue against the English source: numbers, product names, structural characters, empties, and `Step N of M:` agreement with the standalone translation of its own tail. |
| `npm run test:i18n` | Per shipped locale: that the words on screen actually change, that `<html lang>` agrees with what is served, and that a locale with no catalogue degrades to English rather than to a half-translated page. |
| `npm run test:gate` | Drives the sign-in gate: that it hides the guides from `innerText`, rejects an outside domain and a lookalike (`nottoro.com`), admits a subdomain, persists the unlock across a reload, re-locks when storage is cleared, and is axe-clean. |

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

## Sign-in gate

Delivered under an internal work item. `src/gate-boot.js`, `src/gate.js` and `src/gate.css` are injected by
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

**Bypassed on `localhost` and `file://`.** Eleven Playwright scripts drive the built page and
assert against rendered text, and `innerText` skips a `visibility:hidden` subtree — so a gate that
was live locally would turn the whole suite red. Seeding the unlock into eleven browser contexts
puts the same bypass in eleven places and rots as scripts are added. Reaching localhost means
already having the files, so nothing is given away. Append **`?gate=1`** to drop the bypass and get
the deployed behaviour, storage and all; that is how `npm run test:gate` drives it.

**Privacy.** The address is compared in the browser and written to `localStorage` on that device.
It is never transmitted. The instrumentation records only the domain — `src/analytics.js` states it
collects no PII, and logging the address would quietly make that untrue.

**Not localised.** The prompt is English — as is everything else on the site. See
**Localisation status** below.

## Localisation status

Delivered under an internal work item (selection) and an internal work item (content). The selector, the negotiation and
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
24 guides and every step. That is deliberate: a key harvested from source is not necessarily what
the runtime paints, and a key that never matches is a silent no-op. Harvesting what is on screen
makes the key set and the match set the same set. Re-run it after any Core Design re-export.

`src/i18n/glossary.json` holds terminology lifted from **IntelliDash's own shipped catalogues**
(`site/src/assets/i18n/*.json`, read-only) via `scripts/build-glossary.mjs`. A guide that says
"open Settings" while the product's German build says "Einstellungen" sends the reader looking for
a control that does not exist under that name.

`.sa-app` is skipped. That component reproduces the real IntelliDash screen, and the product
renders its own translations there — so the framed screenshot stays in English while the prose
around it does not. That is a known and deliberate seam.

### Coverage

| Locale | Catalogue | Coverage |
|---|---|---|
| `en-us` | source | — |
| `de-de` `es-es` `fr-fr` `it-it` | ✅ 776 strings | 97.8% / 97.9% / 95.7% / 97.9% |
| `ja-jp` `ko-ko` `nl-nl` `pt-pt` | ✅ 776 strings | 97.6% / 97.5% / 97.9% / 97.9% |
| `th-th` `zh-cn` | ✅ 776 strings | 97.8% / 97.5% |

All eleven locales now serve translated content. Coverage is measured by `npm run test:i18n` against a
rendered guide; the residual few per cent are strings that are legitimately identical — URLs, station
identifiers, `N MIN`, the copyright line — plus the `.sa-app` seam described above.

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
- every `Step N of M: X` contains the standalone translation of `X`, so the step list and the step heading cannot disagree.

It deliberately does **not** flag `—` or `%`: Romance languages routinely render an em dash as a
colon, and Chinese spells `% Adj.` out as 调整百分比 rather than using the glyph. Both are correct, and
flagging them would bury the real defects.

The pass found and fixed one genuine defect (Italian compounds using an em dash where their own
standalone translations used a colon) and confirmed two behaviours that look like defects and are
not, now encoded as documented exemptions in the validator: German couples the product name into
compounds with hyphens (`Spatial-Adjust-Konto`, required *Durchkopplung*), and Thai keeps the Latin
acronym where VWC is the subject of a sentence but uses IntelliDash's own shipped Thai for the named
UI fields — matching what a Thai user actually reads on screen.

What this does not give you is judgement about whether the prose is good, idiomatic, or says the
right thing to a superintendent. Nothing here substitutes for that.

## Known gaps

- **Analytics endpoint undecided**, so telemetry is local-only and collects nothing from remote users. The event layer itself is complete and exercised — flipping `TRANSPORT` to `'beacon'` and setting `SA_ENDPOINT` in `src/analytics.js`, plus adding that origin to the allowlist in `scripts/smoke.mjs`, is the whole change. Until then a gated pilot in ten languages tells you nothing about who read what.
- **No manual screen-reader pass** (VoiceOver/NVDA). Automated checks and keyboard driving aren't a substitute.
- **No translation has been reviewed by a native speaker**, and none is planned. Mechanically validated only — see Review status.
- **The sign-in gate is client-side** and the repository is public, so it restricts the audience, not the content. See the section above for what would have to change.
- **`_incoming/`** is a scratch area for raw exports and is never tracked.

## Two export defaults corrected by transforms

The export ships a shortcut hint of its own (`← → step · space play · esc back`), so the build must not add a second one — it did briefly, and the duplicate was visible right below the original.

The export also sticks the "On this page" tracker at `top: 742px`. That offset suits the walkthrough stage but strands the tracker near the bottom of the window for the rest of the guide, where it is least useful. A transform re-pins it to `top: 89px`, just below the 65px sticky header, and `src/a11y.css` caps its height so the 28-step guide's list scrolls rather than running off screen.

## Data

The site is published publicly, so it carries no customer data. The course shown in the app is a fictional placeholder (**Riverbend National**); station IDs and moisture readings are representative sample values. Keep it that way — do not paste real site data into either `.dc.html` file.
