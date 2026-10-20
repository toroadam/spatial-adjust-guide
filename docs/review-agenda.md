# Review agenda: in-person walkthrough, 2026-10-22

Calls made without a review gate, under the owner's direction of 2026-10-19. Each bullet says
what was decided, where it shows on the live site (https://toroadam.github.io/spatial-adjust-guide/)
or in the video, and the question to put to the experts. Append only: add new bullets at the end
and never rewrite another one.

- **The followability rewrite starts before the accuracy audit's post-review step.** The
  claim-by-claim audit is complete (871 claims in `docs/claims/claims.json`: 843 Verified, 28 Needs
  expert, none Wrong or Unverified) and is on main. Its last step, triaging your feedback from this
  walkthrough, can only happen after it, so the step-by-step rewrite was not held for it. Every
  rewritten step is written against the ledger's wording and its Needs expert questions stay open.
  Shows on: every guide page, as steps move to the Do / You should see / If not shape. Decided by
  the executor under owner direction 2026-10-19; for review in person 2026-10-22. Question: where
  a Needs expert answer changes a sentence, is it acceptable that the rewritten step changes again
  after this review?

- **Rewritten steps show Do / You should see / If not rows instead of a paragraph.** In the player
  panel and in the article, a rewritten step replaces its paragraph with up to four labelled rows,
  DO, YOU SHOULD SEE, IF NOT and WHY, in the guide's existing small-caps label style. Every
  on-screen label a row names is bold, and the bold word is the exact word on the reader's screen.
  If not is set off by a thin neutral grey rule on its left, never red, because in this product red
  is a moisture reading. Before you start gains Start on, Have open and You need rows above its
  list once a guide's start state is written. Shows on: Set a minimum threshold, step 2
  (`#/minimum-threshold`), the only rewritten step so far. Decided by the executor under owner
  direction 2026-10-19; for review in person 2026-10-22. Question: are DO, YOU SHOULD SEE and
  IF NOT the words an operator would use, and does the grey rule set If not apart enough?

- **The pilot step's If not says Settings opens on Calculation, not on the last tab used.** Step 2
  of Set a minimum threshold now reads: Do "In the left rail, select Minimum Threshold, just under
  Calculation."; You should see "The right side shows the Minimum Threshold (%) box, with two
  choices below it for small values."; If not "If you see another tab, select Minimum Threshold
  again; Settings opens on Calculation. If there is no left rail, select the gear button, Settings,
  at the right of the toolbar." The rewrite plan's draft said Settings reopens on the last tab
  used. The claims ledger says otherwise (minimum-threshold/1/3, corrected in
  `docs/text-corrections.md` §28): it opens on Calculation, unless Review Threshold has been used
  since the page loaded, when it opens on Minimum Threshold with the box already showing. The step
  follows the ledger and leaves that exception out, because a reader in that case already sees the
  box. There is no Why row: choosing a tab needs no concept. Shows on: `#/minimum-threshold`,
  step 2. Decided by the executor under owner direction 2026-10-19; for review in person
  2026-10-22. Question: does Settings open on Calculation in your day-to-day use, and should the
  Review Threshold exception be spelled out in the step?

- **Bold labels match the real product screen, even where the reproduced figure disagrees.** In
  German, Japanese and the other eight languages, the translated step keeps Minimum Threshold,
  Calculation and Minimum Threshold (%) in English, because that is what IntelliDash shows there:
  the Settings rail labels are hardcoded English in the product, and Minimum Threshold (%) has no
  translation in any of the product's ten other catalogues, so it falls back to English. Settings
  is translated (Einstellungen, 設定) because the product translates it. The reproduced Settings
  figure beside the step translates all of them (German shows Mindestschwellenwert and Berechnung),
  so in every language but English the figure and the step name the same tab differently. The
  labels the product leaves English are generated from IntelliDash's catalogues at the production
  pin into `src/i18n/product-untranslated.json`, and both the translation script and the locale
  gate read that list. Shows on: `#/minimum-threshold`, step 2, with the language selector on any
  language but English. Decided by the executor under owner direction 2026-10-19; for review in
  person 2026-10-22. Question: should the reproduced figure show those labels in English too, so it
  matches both the product and the step?

- **The ten translations of the pilot step were written by the executor, not by the translation
  script.** No translation API credentials were available, so the six new strings (the three row
  labels and the three pilot lines) were translated by the executor into all ten languages,
  following the script's own rules (the bold-label rule in the bullet above, the glossary for
  translated product labels), and checked by the same gate that checks the script's output: the
  locale validation passes with no bold-label drift. They live in `src/i18n/<locale>.json` like
  every other string. Shows on: `#/minimum-threshold`, step 2, in any language but English.
  Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22.
  Question: can a native speaker read the German and Japanese rows before the rest of the rewrite
  is translated the same way?

- **Fixed: the player panel froze on step 1 in every language but English.** While building the
  rows, the executor found that in any language other than English the player panel's counter,
  title and text stayed on step 1 as the player advanced, and the play control's label, read by
  screen readers, never changed to Pause. The translation layer kept the first English it saw on a
  text node the page reuses, and kept translating new text back to it. `src/i18n-apply.js` now
  notices when the page writes new English into a node and translates that instead. Shows on: any
  guide, in any language but English, stepping through the player. Decided by the executor under
  owner direction 2026-10-19; for review in person 2026-10-22. Question: has anyone in the field
  seen a translated guide that looked stuck, and if so, was it anywhere other than the player?

- **Eight terms are defined where each is first used in a guide, in wording the executor chose.**
  VWC, ET, delta, Lynx Reference Amount, aggregate row, measured, modelled and target each get one
  plain sentence (`src/terms.json`), shown once per guide under the step that first uses the term,
  in the article and in the player panel, or under Before you start when the start or before list
  uses it first. The term is bold, set off by a thin blue rule, 13px. A label in bold such as
  Target VWC does not count as a use of "target", and a word in a step title or tip does. Each
  sentence is grade 8 or below and backed by Verified claims in `docs/claims/claims.json`. Delta
  reads "The target minus the station’s moisture: the gap the suggestion tries to close."; Lynx
  Reference Amount reads "The amount of water a station applies at 100 percent."; modelled reads
  "From the model when there was no scan that day, shown in grey italics with a calculator icon."
  Shows on: every guide that uses a term, for example `#/understanding-vwc` (all eight) and
  `#/dashboard-overview`. Decided by the executor under owner direction 2026-10-19; for review in
  person 2026-10-22. Question: is each definition how you would explain the term to a new
  superintendent, and is a definition in the narrow player panel helpful or clutter?
