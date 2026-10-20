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

- **A blue ring outlines the control each step names, in the player and in every article
  picture.** The ring is the design system's informative blue (#3079F0), the same blue as the click
  pulse and the iCentral Double Click highlights, never red, because in this product red is a
  moisture reading. It outlines the smallest on-screen element under the step's cursor point, and
  in the player it travels with the camera to the next step's control. Where the only thing under
  the point is the map (Map navigation, step 1), the ring outlines the whole map. Shows on: every
  step of every guide, in the player and in each step's picture. Decided by the executor under
  owner direction 2026-10-19; for review in person 2026-10-22. Question: does the ring land on the
  control you would point a new operator at, and is it strong enough to see without hiding the
  control?

- **The step title shows as a caps chapter label, and a chapter strip runs under the player.** The
  label sits on the player's top-left corner, and moves to the first other corner when that would
  cover the outlined control. The strip has one segment per step, each a button that jumps to that
  step; the current one is a filled blue chip in the darker shade of the same blue, because white
  text on #3079F0 does not reach the 4.5:1 contrast small text needs. The strip sits under the
  picture rather than over it, so it never covers a control near the bottom edge. Its name for
  screen readers, "Chapters", reads in English in other languages until the next translation pass.
  Shows on: every guide's player, from tablet width up. Decided by the executor under owner
  direction 2026-10-19; for review in person 2026-10-22. Question: are chapter label and strip a
  help or clutter next to the step list on the right, which already lists the same steps?

- **Twenty-three step pictures were re-framed to show the control their caption names.** A
  picture's crop was fixed per picture type, so twelve left out the very thing the step is about:
  in Understanding VWC, step 2 (`#/understanding-vwc`), the caption names station 7AP1 but the crop
  ended above its row. Eleven more had the point at or just past an edge: in Push changes to Lynx,
  step 4 (`#/push-to-lynx`), the crop sliced the footer button in half. A crop now moves, only as far as
  needed, to bring the step's cursor point at least half a table row inside it, the rule the
  player's camera already follows; most moved by less than a row. Shows on: those pictures, most
  in Filter by % Adj., Editing station targets, Station zero, Threshold questions and Calculation
  questions. Decided by the executor under owner direction 2026-10-19; for review in person
  2026-10-22. Question: does any re-framed picture now lose context a reader needed, such as a
  table header?

- **The ring shows three cursor points that sit beside what their step is about.** In Set a minimum
  threshold, step 4, and Threshold questions, step 3, the point is just left of the radio button,
  so the ring outlines the whole Minimum Threshold panel. In Reviewing changes, step 2 ("Read
  Current against Changes"), it lands on the blue information banner above the table rather than
  the Changes column. In Get fresh scan data, step 1 ("Read the scan date before anything else"),
  it points at the moisture summary in the toolbar, so the player and the picture show the toolbar
  while the text is about scan dates in the table. The points were not moved: they are left for
  the step rewrites, which own them. Shows on: `#/minimum-threshold`, `#/threshold-questions`,
  `#/reviewing-changes` and `#/request-scan-data`. Decided by the executor under owner direction
  2026-10-19; for review in person 2026-10-22. Question: should those cursors point at the radio,
  the Changes column and a scan date before Thursday?
