# Writing guide: the step standard

## Purpose

The 26 guides are read by superintendents, assistants and irrigation technicians, usually alone at
the shop computer and short of time. A step works for them only if they can do it with the
product open: they know where to start, which control to use (named the way the screen names it),
what they should see afterwards, and how to recover when they do not see it.

This guide is the one standard every rewritten step meets. The field names below are a contract
shared by the transform layer that applies the rewrites, the renderer that draws them and the
checks that enforce them, so do not rename a field or invent a new one.

Three checks enforce it today: `npm run test:shape` (the step shape, the 8-step limit, the start
state and the cursor targets), `npm run test:readability` (Flesch-Kincaid grade 8 or below) and
`npm run test:validate` (every label marker is a real label, in English and in every locale).
See [Checks](#checks).

## Sources of truth

Every label and every claim in a rewritten step comes from one of these, in this order:

1. **The labels IntelliDash renders.** IntelliDash's English catalogue,
   `site/src/assets/i18n/en-us.json`, at the production commit pinned in
   [`docs/claims/sources.json`](claims/sources.json). The repository reads it through a committed
   fixture, `src/i18n/labels.en-us.json`, so that CI needs no IntelliDash checkout. The fixture
   maps each label to its catalogue key, or to the source line of a hardcoded literal, and
   `node scripts/build-label-fixture.mjs` regenerates it when the production pin moves (`--check`
   reports whether it is out of date). Never edit it by hand. IntelliDash is read-only: read it
   with `git show <sha>:<path>`, and never change it.
2. **The claims ledger**, [`docs/claims/claims.json`](claims/claims.json), with one shard per guide
   in [`docs/claims/guides/<key>.json`](claims/guides/). Every sentence the guides publish is a
   claim there with an ID of the form `<guide-key>/<step>/<n>`, a status and a citation.
   [`docs/claims/README.md`](claims/README.md) describes the format. A rewritten sentence must
   rest on claims whose status is Verified, or Needs expert where the guides owner has chosen to
   publish the wording anyway. A label is recorded there as a claim of type `label`, citing its
   `en-us.json` key or the hardcoded text in the template.
3. **[`docs/text-corrections.md`](text-corrections.md)**, which records every sentence that was
   wrong, what replaced it and why. A rewrite must not reintroduce a corrected error.

When a sentence cannot be traced to one of these, leave it out or ask the question in the ledger.
Never fill the gap from memory, from the reproduction (`SpatialAdjustApp.dc.html` is a witness,
not evidence) or from another product.

`scripts/claims-extract.mjs` reads a step's `title`, `do`, `see`, `ifNot`, `why`, `body`, `caption`
and `tip`, so a re-extraction keeps the claims of a rewritten step. A new sentence in any of those
fields needs a Verified claim before it ships.

## The step shape

A rewritten step is an object in `GUIDES[key].steps` with these fields. Rewrites never touch the
export: they go through the transform layer (see [Stable keys and URLs](#stable-keys-and-urls)).

| Field | Required | What it holds |
|---|---|---|
| `do` | yes | One imperative sentence: the one action to take. Every control it names is written as `[[Exact Label]]`. |
| `see` | yes | One sentence: what is on screen after the action. |
| `ifNot` | yes | The most likely reason the reader does not see that, and the way back. At most two sentences. |
| `why` | no | One sentence of concept, when the reader needs it to make the right choice. |
| `region` | no | `true` only when `do` names a screen region (the map, the table) rather than a labelled control. |

- **`do`** is an instruction, not an explanation. Start with the verb: Select, Type, Tick, Untick,
  Drag, Find. Use Select for buttons, tabs and menu entries, because the guides are used on
  tablets as well as with a mouse. Use Type for a text box.
  `do: 'In the left rail, select [[Minimum Threshold]].'`
- **`see`** describes something the reader can check with their eyes: a pane that opened, a value
  that changed, a count on a button. It does not describe what happens inside Lynx or on the
  server.
  `see: 'The right side shows the [[Minimum Threshold (%)]] box.'`
- **`ifNot`** starts with the symptom ("If the rail is not there", "If Push Changes is greyed
  out"), names the most likely cause and gives the way back. If the way back is another guide,
  name that guide by its title.
  `ifNot: 'If there is no left rail, Settings is not open. Select the gear button, [[Settings]], at the right of the toolbar.'`
- **`why`** is optional. Add it only when the reader would otherwise make the wrong choice, and do
  not use it to define a glossary term (see [Why lines and the glossary](#why-lines-and-the-glossary)).
  `why: 'The threshold stops very small changes from reaching Lynx.'`
- **`region: true`** marks a step whose `do` points at an area of the screen with no label, such
  as the map. It is the only case where `do` may have no `[[label]]`, and the shape check lists
  every region step so that each one is a deliberate choice.
  `{ do: 'Look at the map on the left of the screen.', region: true, … }`

What stays and what goes:

- A rewritten step **drops `body`**. Everything `body` said either becomes `do`, `see`, `ifNot` or
  `why`, or is cut.
- `title` stays. It is the step's chapter label in the player, so keep it short and imperative,
  for example "Choose the Minimum Threshold tab".
- `fig`, `dialog`, every figure prop (`settingsTab`, `thresholdValue`, `pushState`,
  `showThresholdBanner`, `selectedRows` and the rest) and `caption` stay, unchanged unless the
  figure itself is wrong.
- `tip` and `tipLabel` are not part of the shape. Keep a callout only for a warning the reader must
  see at that step, such as the push window.

Write in the second person and the present tense. Spelling follows the existing guides (colour,
modelled, synchronise), except inside a label, which is spelled exactly as the product spells it.

## Label markers

`[[Exact Label]]` marks a control's label. The renderer draws it in bold, and the translation
tooling uses it to substitute the product's own translated label. The rules:

- **Exact.** The text between the brackets is the label exactly as IntelliDash's `en-us.json`
  renders it, with the same case, spacing and punctuation: `[[Minimum Threshold (%)]]`,
  `[[Save Changes]]`, `[[% Adj.]]`. Copy the catalogue value even when the product draws the label
  in capitals with CSS. Never paraphrase ("the save button"), shorten ("Threshold") or pluralise a
  label.
- **Plain text only.** No HTML, no Markdown, no quotes and no nested brackets inside a marker.
  Bold comes from the marker, so never add `<b>` or `**` to a step.
- **A label with a number in it.** Where the product puts a count into a label, as in
  `PUSH_N_CHANGES` "Push {{ num }} Changes", mark the form without the number, `[[Push Changes]]`
  (`PUSH_CHANGES`, which the product also renders), and give the counted form in `see`.
- **Hardcoded English.** Some labels have no catalogue key because IntelliDash writes them into
  its code, so every locale of the product shows them in English. The entries in the Settings
  dialog's left rail (Calculation, Minimum Threshold, Target Profiles, Preferences) are like this.
  They are still marked, and they stay English in every locale of the guides, because that is what
  the reader's screen shows.
- **Untranslated in the product.** Some labels have a catalogue key but no translation in a
  locale, so the product falls back to English there. "Minimum Threshold (%)" is untranslated in
  all ten. A marker for one stays English in those locales, for the same reason.
  `src/i18n/product-untranslated.json` lists them per locale; regenerate it with
  `node scripts/product-untranslated.mjs` when the production pin moves.
- **The same words in every locale.** A translation names a control with that locale's shipped
  label, inside a marker (`markerDrift`) and in plain prose that names a reproduced control
  without one (`screenLabelDrift`). Both are gates in `npm run test:validate`. Case and spacing may
  differ, because grammar inflects a label mid-sentence; the words may not. A label IntelliDash
  hardcodes in English is matched in English.
- **One word, two controls: say where.** Some locales ship one word for two controls. German
  renders both `STRINGS.SETTINGS` and `STRINGS.PREFERENCES` as "Einstellungen", so the shipped
  label alone does not say which one is meant. Use the shipped label verbatim anyway, and name the
  control's place in the same sentence, so the label is on the page and the sentence is still
  unambiguous. Never swap in a clearer word that the screen does not show. The pilot step does
  this in German: "wählen Sie die Zahnradschaltfläche [[Einstellungen]] rechts in der
  Symbolleiste" (the gear button, at the right of the toolbar), while the rail tab stays
  `[[Preferences]]`, which the product hardcodes in English.
- **VWC in a control's name.** Some locales ship `Target VWC` or `Avg. VWC` without the acronym
  ("CVA objetivo", "Teneur en eau volumétrique cible"). Prose that names the control uses that
  label; prose about the measurement itself keeps "VWC" in every locale (ruled 2026-09-12).
  `droppedToken` exempts a translation only when every VWC in the English sits inside such a
  control's name and the translation uses the shipped label.
- **Every marker is checked.** Each `[[label]]` must be a key of the label fixture,
  `src/i18n/labels.en-us.json`, exactly, and a Verified claim in the claims ledger must name it in
  its text or note. `npm run test:validate` fails otherwise (`labelProvenance`), naming the guide,
  the step, the field and the label. A marker that is not a real label is a bug, not a style
  choice. If the product really shows a label the fixture lacks, extend the rules in
  `scripts/build-label-fixture.mjs` and regenerate; do not add it by hand.
- **Not a label, not a marker.** Product names (Spatial Adjust, IntelliDash, Lynx, TurfRad),
  glossary terms and screen regions are plain text.

## Start state

Every rewritten guide carries a `start` object, which the page renders first under "Before you
start":

```js
start: {
  page: 'The Spatial Adjust dashboard, at /spatialadjust.',
  open: 'No dialog open.',
  needs: 'A Spatial Adjust account on a site with TurfRad scan data.',
}
```

| Field | What it holds |
|---|---|
| `page` | The page the reader starts on. |
| `open` | Which dialog or tab is open, or "No dialog open." |
| `needs` | The permission, data or Lynx setup the guide depends on. |

All three are required and none may be empty. The existing `before` list stays for anything else
the reader should know first. A guide's later part gives the state at the end of the part before
it (see [Length and parts](#length-and-parts)).

## One action per step

A step asks for one action. "Open Settings and select Minimum Threshold" is two steps. Two clicks
in one place that the reader always does together, such as ticking a checkbox and then confirming
the same dialog, are still two steps: the reader needs to see the result of the first one before
the second.

The only exception is the way back in `ifNot`, which may chain two short actions because the
reader is recovering, not learning.

## Length and parts

A guide has **at most 8 steps**. If a rewrite needs more, split it:

- Part 1 keeps the guide's key and URL, for example `seasonal-profiles` and `#/seasonal-profiles`.
- Part 2 is a new guide with the key `<key>-part-2` (`seasonal-profiles-part-2`). Part 3, if one
  is ever needed, is `<key>-part-3`, and so on.
- Each part is listed **first** in the `next` list of the part before it, so the reader is offered
  it at the end.
- A part is **not a catalogue card**. The catalogue stays at 26 cards (`scripts/smoke.mjs` checks
  `home.cards === 26`).
- Each part has its own `start`, its own `TARGETS` entry and its own steps, numbered from 1.
- Add each part's key to `GUIDES` in `scripts/extract-strings.mjs`, or its strings are never
  harvested and never translated.

Split at a natural pause, such as after Save Changes, never in the middle of a dialog.

## Why lines and the glossary

Eight terms are defined automatically at their first use in each guide, from `src/terms.json`:

VWC, ET, delta, Lynx Reference Amount, aggregate row, measured, modelled, target.

Do not explain these in a `why` line or anywhere else in a step: the definition appears beside the
step that first uses the term, in every locale. Use each term with exactly that spelling, so that
the first use is found. A `why` line is for the concept behind a choice ("The threshold stops very
small changes from reaching Lynx"), not for vocabulary.

How the first use is found. The guide is read in page order: `start` and `before`, whose terms are
defined under Before you start, then each step's `title`, `do`, `see`, `ifNot`, `why`, `body`,
`caption` and `tip`. The definition shows under that step's text, in the article and in the player
panel, and nowhere later in the guide. A match is a whole word, case-insensitive except for VWC
and ET, and text inside a `[[label]]` marker never counts, so `[[Target VWC]]` does not define
"target". Each definition is one sentence at grade 8 or below, backed by Verified claims in
`docs/claims/claims.json`; `npm run test:shape` checks the file. Changing a definition orphans its
translation in ten locales, like any other prose.

## Readability

Each step scores **Flesch-Kincaid grade 8 or below**, measured over `do`, `see`, `ifNot` and `why`
together, with the `[[` and `]]` stripped. `npm run test:readability` measures it (see
[Checks](#checks) for how the score is computed). Only the English is scored.

What keeps the grade down:

- Short sentences, about 15 words or fewer, with one idea each.
- Common words: "use" not "utilise", "about" not "approximately", "before" not "prior to".
- The verb first in `do`, and no stacked nouns ("threshold adjustment banner count").
- Numbers as digits.

A long product label raises the score. That is acceptable, because the label is what the reader
must find. Shorten the sentence around it instead.

## Cursor targets

The player moves a cursor, and later a highlight, to one point per step:

- `TARGETS[key]` is **positional**: its first point belongs to step 1, its second to step 2, and
  so on. It must hold **exactly one point per step**.
- `TARGETS` wins over a step's own `t`. A step's `t` is used only when `TARGETS[key]` has no point
  at that position.
- If neither has a point, the player falls back to `[800, 500]`, the middle of the screen, which
  points at nothing. No step may reach that fallback.
- Points are `[x, y]` in the reproduction's 1920×1080 space. Use a named point from `P`
  (`P.gear`, `P.pushFooter`) or `cell(column, row)` for a table cell, and add a new named point to
  `P` rather than repeating raw numbers.
- **Whenever a change adds, removes or reorders steps, re-author `TARGETS[key]` in the same
  change**, through the transform layer. `TARGETS` is filled in two places in the export: the
  object literal and the `Object.assign(TARGETS, …)` after `GUIDES`. Read both
  ([`docs/audit-verification.md`](audit-verification.md) records what went wrong when one was
  missed).
- The point is on the control that `do` names. For a `region` step it is on the part of the
  region that `see` describes, or the region's centre.

`npm run test:shape` reports every guide whose `TARGETS` length differs from its step count, and
`npm run test:cursor-target` checks the rendered positions.

## Translation

Catalogues are keyed on the exact English, so changing a sentence silently orphans its translation
in all ten locales (`de-de`, `es-es`, `fr-fr`, `it-it`, `nl-nl`, `pt-pt`, `ja-jp`, `ko-ko`,
`th-th`, `zh-cn`). Every prose change ends with this sequence, in this order:

1. **Rebuild and serve** the site on port 8124, and leave the server running in its own terminal:

   ```sh
   npm run build
   npm run serve                     # node scripts/serve.mjs dist 8124
   ```

2. **Harvest** the rendered strings to a scratch file outside the repository:

   ```sh
   node scripts/extract-strings.mjs http://localhost:8124/ --out /tmp/en-us.harvest.json
   ```

3. **Diff and add** into `src/i18n/en-us.json`: add the new strings and remove the ones that no
   longer render. Never overwrite the file with the harvest, because `en-us.json` is the harvest
   *plus* the screen labels from `scripts/app-strings.mjs`, and overwriting drops them.
4. **Seed** each locale's fragments from its existing catalogue, so only the changed strings are
   left to translate:

   ```sh
   node scripts/seed-translate-fragments.mjs        # all ten; prints each locale's todo
   ```

5. **Translate** the todo, once per locale. The API key comes from the environment (or an
   `ant auth login` profile) and is never written to a file or committed:

   ```sh
   for c in de-de es-es fr-fr it-it nl-nl pt-pt ja-jp ko-ko th-th zh-cn; do
     node scripts/translate.mjs --locale "$c"
   done
   ```

6. **Assemble** all ten catalogues. The assembler refuses a missing or unknown key:

   ```sh
   for c in de-de es-es fr-fr it-it nl-nl pt-pt ja-jp ko-ko th-th zh-cn; do
     node scripts/assemble-locale.mjs "$c" ".translate/$c"
   done
   ```

7. **Restore `_meta` from HEAD.** The assembler rewrites each catalogue's `_meta` and resets
   `machineValidated` and `screenStringsFromProduct`. Put back the committed `_meta`, updating only
   the string count and the identical-to-English count:

   ```sh
   for c in de-de es-es fr-fr it-it nl-nl pt-pt ja-jp ko-ko th-th zh-cn; do
     node -e '
       const fs = require("fs");
       const { execFileSync } = require("child_process");
       const f = `src/i18n/${process.argv[1]}.json`;
       const head = JSON.parse(execFileSync("git", ["show", `HEAD:${f}`], { encoding: "utf8" }))._meta;
       const cat = JSON.parse(fs.readFileSync(f, "utf8"));
       cat._meta = { ...head, strings: Object.keys(cat.strings).length,
         identicalToEnglish: cat._meta.identicalToEnglish };
       fs.writeFileSync(f, JSON.stringify(cat, null, 2) + "\n");
     ' "$c"
   done
   ```

8. **Validate**, with the server from step 1 still running:

   ```sh
   npm run test:validate
   npm run test:i18n
   npm run test:prose
   ```

`scripts/translate.mjs` keeps every `[[label]]` marker and puts the product's own translated label
inside it. A hardcoded-English label stays English. The translations are machine translations,
mechanically validated, and no native-speaker review is planned.

## Stable keys and URLs

- Every guide key and every `#/<key>` URL stays as it is. Support staff link customers to them.
  The only new keys are parts, `<key>-part-N`.
- Never hand-edit `Learn Spatial Adjust.dc.html` or `SpatialAdjustApp.dc.html`. A re-export from
  Core Design would destroy the edit. Copy changes go through `src/transform-export.mjs`, anchored
  on the exact text they replace, with the match count asserted, so the build fails if the anchor
  moves. Player additions are injected by `build.mjs`, outside the export.
- Rewrites anchor on the corrected text. If an accuracy correction later changes a sentence that a
  rewrite anchors on, the build fails on purpose: re-check the claim, and never loosen the anchor.

## Public-repo rules

This repository is public.

- No customer data: no real course or site names, no coordinates, nothing from
  `sanitize.local.json`. Figures use the fictional site only.
- No secrets. The translation API key stays in the environment.
- No IntelliDash code. Cite `path:line` and describe the behaviour in your own words. Product copy
  (an `en-us.json` key and its English label) is text a user sees, so it may be quoted.
- No internal work-item or request IDs in files or commit messages. Describe the change instead.
- Commit messages describe the change in plain words, with no generated-by attribution.

## Checks

| Command | What it checks |
|---|---|
| `npm run test:shape` | Every step has non-empty `do`, `see` and `ifNot`; `do` has a `[[label]]` unless `region: true` (region steps are listed); no step that has `do` keeps `body`; at most 8 steps; `start` has `page`, `open` and `needs`; `TARGETS[key]` has one point per step; a part is first in the previous part's `next`. `--json` prints the raw result. |
| `npm run test:readability` | Flesch-Kincaid grade per step, over `do`, `see`, `ifNot`, `why` and any remaining `body`, with markers stripped. Lists the 10 hardest steps. `--selftest` checks the scorer against reference sentences. |
| `npm run test:validate` | The `en-us` entry is `labelProvenance`: every `[[label]]` in any guide is a key of `src/i18n/labels.en-us.json` and is named by a Verified ledger claim. The locale entries check every translation, including `markerDrift` (each marker holds the label the reader's screen shows in that locale) and `screenLabelDrift` (see [Label markers](#label-markers)). `--all` prints every finding rather than four of each kind. |

The three above read the guides through `scripts/lib/load-guides.mjs`, which applies `transformGuide()`
to the export and evaluates the guide data in `node:vm`, so they need no browser and see exactly
what the page publishes.

**All three block, for every guide.** There is no pending list and no exemption by guide: the
rewrite ratchet was deleted when the last of the 26 guides landed. A guide, or a `<key>-part-N`,
that breaks the standard fails the command. `build.mjs` also runs the shape check on the
transformed page in memory, so `npm run build` fails before anything is written to `dist/` if a
step lacks `do`, `see` or `ifNot`. `.github/workflows/deploy.yml` runs `test:validate`,
`test:prose`, `test:shape` and `test:readability` as blocking steps ahead of the browser tests, so
a failing guide cannot reach the live site. None of the four needs a browser or an IntelliDash
checkout.

The grade formula is `0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59`. Sentences
end at `.`, `!` or `?` followed by a space or the end of the text. Syllables are counted by vowel
groups, less a silent final "e", with at least one per word. An all-capitals abbreviation of 2 to
5 letters counts one syllable per letter (W counts 3), so "VWC" is 5. A number or percentage is
one word of one syllable.

## Worked examples

These two rewrites show the standard applied to a step. The "Before the rewrite" block is the export's
copy before the rewrite, kept here so the change is visible; the "Rewritten" block is the step as
first written under this standard. The guides now publish the rewritten form, and their copy lives
in `src/rewrite/*.mjs`, which is the source if the two ever differ in a small way.

### Example 1: Set a minimum threshold, step 2

Before the rewrite:

```js
{ title: 'Choose the Minimum Threshold tab', fig: 'dlgWide', dialog: 'settings', settingsTab: 'threshold',
  t: [520, 380],
  body: 'The left rail lists the settings groups. Minimum Threshold sits second, under Calculation.',
  caption: 'Settings dialog, Minimum Threshold tab.' }
```

Rewritten:

```js
{ title: 'Choose the Minimum Threshold tab', fig: 'dlgWide', dialog: 'settings', settingsTab: 'threshold',
  t: [520, 380],
  do: 'In the left rail, select [[Minimum Threshold]], just under [[Calculation]].',
  see: 'The right side shows the [[Minimum Threshold (%)]] box.',
  ifNot: 'If there is no left rail, Settings is not open. Select the gear button, [[Settings]], at the right of the toolbar.',
  why: 'The threshold stops very small changes from reaching Lynx.',
  caption: 'Settings dialog, Minimum Threshold tab.' }
```

The guide's start state:

```js
start: {
  page: 'The Spatial Adjust dashboard, at /spatialadjust.',
  open: 'No dialog open.',
  needs: 'A Spatial Adjust account on a site with TurfRad scan data. The threshold is a site setting, so it applies to every user on the site.',
}
```

Checked against:

| Text | Source |
|---|---|
| `[[Minimum Threshold]]`, `[[Calculation]]` | Hardcoded English in the Settings rail, so they stay English in every locale. Ledger `minimum-threshold/2/2` and `minimum-threshold/2/3`, Verified. |
| `[[Minimum Threshold (%)]]` | `SETTINGS_MIN_THRESHOLD` "Minimum Threshold (%)". Ledger `minimum-threshold/2/4`, Verified. |
| `[[Settings]]`, the gear at the right of the toolbar | `SETTINGS` "Settings". Ledger `minimum-threshold/1/1` and `minimum-threshold/1/2`, Verified. |
| `why` | Ledger `minimum-threshold/summary/1`, Verified. |
| `start` | Ledger `dashboard-overview/where/1`, `dashboard-overview/before/1`, `minimum-threshold/before/1` and `minimum-threshold/before/2`, Verified. |

The cursor target is unchanged: `TARGETS['minimum-threshold'][1]` is `P.menuThresh`, the rail
entry that `do` names. The step count is unchanged, so `TARGETS` needs no edit.
Readability: grade 5.1.

### Example 2: Push changes to Lynx, step 1

Before the rewrite:

```js
{ title: 'Check the pending count', fig: 'toolbarR',
  body: 'The button counts the enabled stations whose % Adj. differs from what Lynx holds, whether you '
    + 'edited it or left the suggestion, leaving out any already pushed today. Beside it the green '
    + 'counter shows how many have already gone out today. If Push Changes is greyed out there is '
    + 'nothing queued.',
  caption: 'Six changes pending, six already pushed today.' }
```

Rewritten:

```js
{ title: 'Check the pending count', fig: 'toolbarR',
  do: 'Find [[Push Changes]] at the right of the toolbar and read the number on it.',
  see: 'The button shows a count, such as Push 6 Changes, and the green counter beside it shows how many went out today.',
  ifNot: 'If [[Push Changes]] is greyed out, nothing is waiting or a push is still running. Wait for the push to finish, then look again.',
  caption: 'Six changes pending, six already pushed today.' }
```

The guide's start state:

```js
start: {
  page: 'The Spatial Adjust dashboard, at /spatialadjust.',
  open: 'No dialog open.',
  needs: 'Lynx must be reachable, and Site Adjust and Course Adjust must both be 100% in Lynx.',
}
```

Checked against:

| Text | Source |
|---|---|
| `[[Push Changes]]` and "Push 6 Changes" | `PUSH_CHANGES` "Push Changes" and `PUSH_N_CHANGES` "Push {{ num }} Changes". Ledger `push-to-lynx/1/1` and `push-to-lynx/1/4`, Verified. |
| The count and the green counter | Ledger `push-to-lynx/1/2` and `push-to-lynx/1/3`, Verified. |
| Greyed out when nothing is waiting or a push is running | Ledger `push-to-lynx/1/4`, Verified (its note records the running-push case). |
| `start.needs` | Ledger `push-to-lynx/before/1` and `push-to-lynx/before/4`, Verified. |

No `why`: the count needs no concept to act on. The sentence about stations already pushed today
moves to step 2, where the Pushed Today list is on screen. The cursor target is
`TARGETS['push-to-lynx'][0]`, `P.push`, the button that `do` names. Readability: grade 5.1.

### A region step

From Dashboard overview, step 2, where the reader looks at the map rather than a control:

```js
{ title: 'Read the map', fig: 'map', region: true,
  do: 'Look at the map on the left of the screen.',
  see: 'Each sprinkler scanned in the past seven days is a pin, and pins scanned today are filled with a band colour.',
  ifNot: 'If you see no pins, the site has no scan from the past seven days. Follow Get fresh scan data.',
  caption: 'Map with the moisture legend.' }
```

The pins and colours rest on ledger `dashboard-overview/2/2` and `dashboard-overview/2/3`. The way
back points at the guide that fetches new scan data rather than explaining it again. Readability:
grade 3.5.
