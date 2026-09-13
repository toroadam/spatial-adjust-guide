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

**Events** (`src/analytics.js`) — a closed set: `guide_opened`, `step_advanced`, `guide_completed`, `play_all_used`, `stub_clicked`, `guide_requested`, `search_used`, `feedback_submitted`, `feedback_detailed`, `returned_home`. No PII, no cookies; an anonymous per-tab session id only.

By default the transport is **`local`**: events are buffered in `localStorage` and **nothing leaves the device**, which keeps the zero-external-origins property the smoke test enforces. In the browser console:

| | |
|---|---|
| `__saReport()` | summary — guides opened, stub demand, event counts |
| `__saExport()` | download the raw events as JSON |
| `__saClear()` | reset before a session |

That's sufficient for moderated sessions. **It does not collect from remote users.** For that, set `TRANSPORT = 'beacon'` and `SA_ENDPOINT` at the top of `src/analytics.js`, and add that origin to the allowlist in `scripts/smoke.mjs` — otherwise the smoke test will correctly fail the build for reaching a third party. Choosing that endpoint is an open decision.

**Feedback** (`src/feedback.js`) routes to a **Microsoft Form** — no backend, no third-party
script, no Azure administrator, and responses land in an Excel workbook in the form owner's
OneDrive. That is a queryable store inside Toro's own tenant, which is the reason it is Forms and
not Google Sheets or a Cloudflare Function: both of those sit outside the tooling Toro permits,
which is what ruled out the original hosting plan too.

"Was this helpful?" sits at the very bottom of the page and attaches the guide and step reached
automatically. It deliberately does *not* sit beside the step player: that crowded the controls,
and the sticky "On this page" tracker uses an offset calibrated to that panel. Thumbs-up confirms
in place; thumbs-down opens a dialog that collects the detail. Activating any unwritten card
records demand and offers the same dialog.

**Configure it in one place:** the `FORM` object at the top of `src/feedback.js`. Empty by default,
and the feature degrades rather than breaks when it is — the same convention as `NSN.phone` in
`src/contact.js` and `SIGNIN_LOG_ENDPOINT` in `src/gate.js`. With no form configured the dialog
still collects, still keeps the draft and still records the event locally; it simply does not open
a tab, and nothing claims to have been sent that was not.

To fill it in:

1. Create a form at <https://forms.office.com> with six questions, all **text**, in this order:
   **Kind**, **Guide**, **Step**, **What would have helped**, **Locale**, **URL**. Only *Kind* and
   *Guide* need to be required; the reader never sees the prefilled ones as blanks to fill.
2. **Collect responses → Copy link.** The GUID after `id=` is `FORM.id`.
3. Open **Prefill answers**, put a recognisable placeholder in each question, and copy that link.
   Each question appears as `r<number>=placeholder`. Map each number onto the matching key in
   `FORM.fields` — `kind`, `guide`, `step`, `note`, `locale`, `url`.
4. Rebuild. Only fields with a configured id are appended, so a half-filled `FORM.fields`
   degrades to a shorter prefill rather than a broken URL.

Those `r<number>` ids are **positional and opaque**: reordering or deleting a question renumbers
them and silently sends answers into the wrong columns. If the form's questions change, re-read
the prefill link rather than assuming.

**Drafts survive.** The note is written to `localStorage` on every keystroke under
`sa.feedback.draft`, restored when the dialog reopens for the same guide, and cleared on send.
Cancelling, pressing Escape and clicking the backdrop all keep it; only sending discards it. This
is why the dialog replaced `window.prompt()`, along with two other reasons: prompt text never
enters the DOM, so it was invisible to the catalogue harvester and shipped English to all eleven
locales, and its focus behaviour is the browser's rather than ours.

`scripts/instrumentation.mjs` drives the whole path — types a note, cancels, asserts it is in
storage, reopens, asserts it is restored, sends, and asserts the draft is gone. It does this on a
*second* guide, because answering on the first replaces that widget with its confirmation.

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
24 guides and every step. That is deliberate: a key harvested from source is not necessarily what
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

Header, page content, the "Was this helpful?" block and the footer all share one container —
1180px with 32px gutters — so every left edge on the page lines up at the same x. The feedback
widget did not: on a guide it lands inside `<article>` and inherits the content column, but the
catalogue has no article, so it was appended straight to a full-bleed `<main>` and sat flush against
the viewport edge while everything else started 162px in. Scoped to `.lsa main > .lsa-helpful` so
the guide layout is untouched.

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
- **136 places where the guide prose names a control differently from the control**, down from 308.
  `npm run test:validate` reports these as an **advisory** count rather than failing on them.

  The count fell for four reasons, three of them corrections to the check itself, which was
  asserting standards that did not exist:
  - **Provenance** (−36). Findings named a label IntelliDash does not ship: `Calculation` and
    `Soil Factor Editor` have no key with that value in any locale, and
    `CASE_SENSITIVE.ENABLED_STATIONS` is simply absent from `pt-pt`. Their "translations" were
    produced by this pipeline, so prose was being measured against an invented rendering. The
    check now requires the label to be in `src/i18n/glossary.json` for that locale.
  - **Case and whitespace** (−49). These were grammar. Dutch inflects and lowercases an adjective
    mid-sentence — "de voorgestelde percentages" for a label reading `Voorgesteld` — and
    IntelliDash's own `es-es` `AVG_VWC` ships a double space (`"Promedio de  CVA"`) that prose
    could only match by reproducing the typo.
  - **Longest match wins** (−1 finding, but several bogus constraints). `Suggested` is a substring
    of `Suggested Percent Adjust Calculation`, so prose about the *field* was also required to
    name the *column* — two different controls sharing a word.
  - **87 findings actually fixed** across seven locales, which is the real work.

  **The root cause was a contradiction in the translator's own prompt.** `scripts/translate.mjs`
  told the model to keep `VWC` untranslated *and* to follow the glossary, and in `es`/`fr`/`ko`/`th`
  IntelliDash's label drops the acronym. The glossary itself was never wrong: it agrees with the
  reproduced screen labels 89/89 across seven locales.

  **What was fixed**, by swapping the prose's paraphrase for the shipped label — surgical term
  edits rather than whole-sentence rewrites, so the reviewed prose survives:

  | Locale | Fixed | The swap |
  |---|---|---|
  | `de-de` | 23 | „Änderungen übertragen“ → **„Änderungen senden“**; „Sammelanpassung“ → **„Massenanpassung“** |
  | `fr-fr` | 28 | « Envoyer les modifications » → **« Transmettre changements »**; « Toutes les stations » → **« Toutes les voies »** (the product says *voies*, not *stations*) |
  | `zh-cn` | 13 | 建议值 → **“建议的”** |
  | `th-th` | 8 | ตัวเลือกที่ 2 → **ตัวเลือก 2** (the shipped label carries no classifier) |
  | `es-es` | 6 | «Ajuste masivo» → **«Ajuste por lote»** |
  | `it-it` | 4 | «Applica a tutti» → **«Applica a tutte»** |
  | `pt-pt` | 3 | «Guardar alterações» → **«Salvar alterações»** |

  `node scripts/retranslate-drift.mjs --all` now reports an empty queue. The 136 that remain are
  **deferred by design**, not unfixed:

  | | Findings | Why it is not a copy-edit |
  |---|---|---|
  | VWC family | 123 | Matching the label drops the `VWC` token and trips the `droppedToken` **gate**, so it needs an `EXEMPT` entry beside it — `validate-locales.mjs` already carries one for `th-th` for exactly this reason |
  | `Preferences` / `Settings` | 9 | IntelliDash ships both as "Einstellungen" in German, so matching the label makes prose ambiguous where it is currently clear. Case tolerance already absorbed most of this bucket |
  | Mixed sentences | 4 | Name a deferred label *and* a mechanical one, so they are held back rather than rewritten as a side effect |

- **The contact modal was shipping in English to all ten non-English locales** — now fixed.
  `scripts/extract-strings.mjs` drives the contact modal and the feedback dialog before
  harvesting, the way it already opened the language menu, so text that only exists once a dialog
  is open finally reaches the catalogue. That surfaced twelve keys, including the modal's lede and
  its `Email` / `Phone` / `Support portal` row labels, which had never been translated while every
  string around them was. All twelve are now in all ten catalogues; every locale is complete at
  972/972.

  Regenerating rather than merging would have been a mistake: `en-us.json` is harvest **plus**
  `scripts/app-strings.mjs`, so overwriting it with the raw harvest drops the 107 screen labels.
  The safe operation is to diff and add.

- **IntelliDash ships a per-region support number, and the modal was ignoring it.**
  `TORO.HELP_LINE` is `00-800-8040-8040` in German, `900-973-219` in Spanish, `800-791-226` in
  Italian — but `src/contact.js` rendered the raw `1-800-ASK-TORO` because only the row *label*
  went through `t()`, never the value. A German superintendent mid-failed-push was being shown a
  US number. The value is now translated and the `tel:` href is built from the translated string,
  so the link dials what the row displays. `pt-pt` and `zh-cn` have no `HELP_LINE` in IntelliDash's
  catalogue, so they keep the US number by default.

  This needed one exemption: `validate-locales.mjs` compares the numbers in a string against its
  translation, and a regional number legitimately shares no digits with `1-800-ASK-TORO`. The
  number check is now skipped when the translation *is* IntelliDash's own shipped rendering — the
  same principle as the `_screenStrings` exemption.

- **The guide-request dialog's strings cannot be harvested,** so they are absent from the
  catalogue and would render in English. All 26 guides are now written, so no catalogue card
  carries `data-stub="true"` and the dialog is unreachable — the harvester prints a note when it
  finds no stub rather than failing. If an unwritten guide is ever added back, re-run the harvest
  before relying on those two strings.
- **Two features still have no guide:** the update banner's dismiss-without-reload path in context,
  and the discard-changes confirmation.
- **Superseded note.** An audit of
  IntelliDash's 108 user-facing Spatial Adjust strings against the guide corpus found no coverage
  for: the **Over/Under % Adj. filter** (an outlier finder — `> over || < under`, so it surfaces
  both extremes at once, not a band; Over 0–300 default 200, Under 0–100 default 10, stored per
  user), **Request latest scan data / Reload Data**, the **update banner**, and the
  **discard-changes confirmation**. `SpatialAdjustApp.dc.html` renders none of
  those controls — no refresh button, no banner, no filter dialog — so a step-by-step guide would
  have to point its figure at an unrelated panel. Covering them properly means extending the
  reproduction in Core Design first. The cursor targets `refresh`, `filterLink`, `tabOver` and
  `tabAll` already exist and are referenced by nothing, which suggests this was always the plan.
- **`_incoming/`** is a scratch area for raw exports and is never tracked.

## Two export defaults corrected by transforms

The export ships a shortcut hint of its own (`← → step · space play · esc back`), so the build must not add a second one — it did briefly, and the duplicate was visible right below the original.

The export also sticks the "On this page" tracker at `top: 742px`. That offset suits the walkthrough stage but strands the tracker near the bottom of the window for the rest of the guide, where it is least useful. A transform re-pins it to `top: 89px`, just below the 65px sticky header, and `src/a11y.css` caps its height so the 28-step guide's list scrolls rather than running off screen.

## Data

The site is published publicly, so it carries no customer data. The course shown in the app is a fictional placeholder (**Riverbend National**); station IDs and moisture readings are representative sample values. Keep it that way — do not paste real site data into either `.dc.html` file.
