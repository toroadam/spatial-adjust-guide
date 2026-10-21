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

- **Spanish and French concept prose that says CVA or Hv where it should say VWC.** Narrowing the
  VWC exemption in `npm run test:validate`, so that only a control's own name may drop the acronym,
  found four strings the old per-locale exemption had hidden: in Spanish and in French, the map
  legend text ("a pin scanned today is coloured by its measured VWC") and the map summary text
  ("the average, high and low VWC figures") use the product's local acronym, CVA or Hv, for the
  measurement itself. Under the 2026-09-12 ruling the measurement keeps VWC. The check now lists the
  four by name as known defects that may only shrink, rather than fixing them, because this change
  left the translation catalogues to the next translation pass. Shows on: `#/dashboard-overview`, in
  Spanish and French. Decided by the executor under owner direction 2026-10-19; for review in person
  2026-10-22. Question: would a Spanish or French superintendent rather read VWC, as the ruling
  says, or the CVA and Hv their own screen uses for the averages?

- **The label gates run on every commit, but do not block a deploy.** `npm run test:validate` now
  fails on any `[[label]]` that is not a real IntelliDash label in the claims ledger, and on any
  translation that names a control differently from the reader's screen. It runs in the screen
  fidelity workflow on every push and pull request, not in the deploy job, so a red label check is
  visible without holding the live site back before the walkthrough. Shows on: nothing on the live
  site; the GitHub Actions run for each commit. Decided by the executor under owner direction
  2026-10-19; for review in person 2026-10-22. Question: once the walkthrough is done, should the
  label gates block deploys the way the fidelity gate does?

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

- **The glossary and chapter-strip strings were translated by the executor, not by the translation
  script.** Merging the followability work added 15 English strings: the eight glossary terms'
  names and definitions, and "Chapters", the chapter strip's name for screen readers. No
  translation API credentials were available, so the executor translated them into all ten
  languages, using the product's own renderings (Lynx Reference Amount, volumetric water content,
  evapotranspiration) and the words each locale's guide prose already uses for target, measured,
  modelled and delta, so a definition names a term the way the step above it does. Concept prose
  keeps VWC in every locale. The locale validation passes with no findings. "Chapters" no longer
  reads in English in other languages. Shows on: any guide that uses a term, in any language but
  English, for example `#/understanding-vwc`, and the chapter strip under every player. Decided by
  the executor under owner direction 2026-10-19; for review in person 2026-10-22. Question: can a
  native speaker read the German and Japanese definitions, and does each term's name match what
  that language's superintendents call it?

- **Three sentences the ledger could not confirm were dropped from the Getting Started and Targets
  guides, not reworded.** In Understand Spatial Adjust, step 5 no longer says how Lynx applies the
  percent adjust value to a station's programme; it says only that Push Changes is the one control
  that sends changes to Lynx. In Seasonal profiles, the advice that three or four profiles cover
  most courses is gone, and so is the Target profiles tip about applying a profile the evening
  before a tournament. Shows on: `#/understand-spatial-adjust`, `#/seasonal-profiles` and
  `#/target-profiles`. Decided by the executor under owner direction 2026-10-19; for review in
  person 2026-10-22. Question: does Lynx apply the percentage on top of each station's programme
  run time, and is there a number of profiles or a lead time before an event that the experts
  would put back?

- **Three unconfirmed statements still ship in Seasonal profiles and Understanding VWC.** The
  Seasonal profiles step titled "Apply the evening before" and its tip about the push window
  (push between 11 AM and the synchronisation time set in Lynx, and synchronise Lynx afterwards,
  because a push outside that window does not reach the course and shows no error) stay marked
  Needs expert. So does the Understanding VWC prerequisite "VWC is volumetric water content,
  expressed as a percentage of soil volume". Nothing in the product code settles them. Shows on:
  `#/seasonal-profiles` and `#/understanding-vwc`. Decided by the executor under owner direction
  2026-10-19; for review in person 2026-10-22. Question: are the evening-before timing and the 11
  AM push window right for current Lynx, and does a push outside the window really fail silently?

- **Eleven steps point at a region of the screen rather than a control.** Dashboard overview
  steps 1 to 4 (toolbar, map, chart, table), Understand Spatial Adjust step 1 (the address and
  toolbar), Map navigation steps 1, 2 and 6, Editing station targets step 1, Bulk adjustments
  step 1 and Updating profiles step 1 ask the reader to look at an area, so their cursor ring
  outlines that area, and the step checker lists them as region steps and does not require a
  button label in them. Shows on: the guides named, for example `#/dashboard-overview`. Decided by
  the executor under owner direction 2026-10-19; for review in person 2026-10-22. Question: is
  an outlined region a clear enough point to follow, or should each of these name one control to
  select?

- **Map navigation has six steps: opening Layers is its own step.** The old guide chose between All
  Stations and Enabled Stations in one step. On production the choices sit inside a box that opens
  from the Layers button beside the variance button and closes when you select anywhere else, so
  the guide now has "Open Layers" and then "Choose the stations", and the cursor points at the
  button first and at the choices second. Shows on: `#/map-navigation`, steps 4 and 5. Decided by
  the executor under owner direction 2026-10-19; for review in person 2026-10-22. Question: does
  the Layers box open the same way on a customer's screen, and is the extra step worth it?

- **Four Target Profiles column headings are not translated by the product.** "Target Profile",
  "Update from Current", "Apply Profile" and "Stations" are typed into the Settings dialog as plain
  English and passed to the translation pipe without a catalogue entry, so a customer using
  another language sees them in English. The guides name them in double brackets as screen labels,
  and the label fixture now lists them as hardcoded so the ten translations keep them in English
  to match the screen. Shows on: `#/target-profiles`, `#/creating-profiles`, `#/updating-profiles`
  and `#/seasonal-profiles`, in every language but English. Decided by the executor under owner
  direction 2026-10-19; for review in person 2026-10-22. Question: do customers outside English
  see these four headings in English today, and will a later IntelliDash release translate them?

- **Applying a profile and capturing into a slot both wait for a background job, and the guides
  say what to do when it fails.** Save Changes sends the profile work to a queue and waits up to
  ten minutes for it to finish. If the save fails the dialog stays open with "Unable to save
  data"; if it times out the message says to refresh before trying again. The guides tell the
  reader to reload the page and check the profile list before retrying, which follows that
  message but is the executor's advice, not support's. Shows on: step 6 of
  `#/target-profiles`, step 6 of `#/creating-profiles` and the profile steps of
  `#/seasonal-profiles`. Decided by the executor under owner direction 2026-10-19; for review in
  person 2026-10-22. Question: is "reload and check the list" what support tells a customer who
  sees Unable to save data on this dialog?

- **The six Calculations and Station Management guides are rewritten to the step shape, with the
  unit warning kept.** Set a minimum threshold (now 8 steps), Calculation settings (7), Calculation
  methods (5), Preferences (7), Enable and disable stations (6) and Station details (5) each carry
  a start state and Do / You should see / If not rows, one action per step. The warning that
  amounts rescale by 25.4 when Units of Measure is changed and saved in the same visit is kept in
  three places: as the If not of the Preferences units step, as the callout under that step, and as
  the If not of the Calculation settings save step. All say to reopen Settings and check Daily Max
  Amount and Lynx Reference Amount before pushing. The algorithm dropdown is named only by what it
  shows, Option 1 and Option 2. Shows on: `#/minimum-threshold`, `#/calculation-settings`,
  `#/calculation-methods`, `#/preferences`, `#/enable-disable-stations`, `#/station-details`.
  Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22.
  Question: does a superintendent who changes units and saves in one visit see the warning
  before they push, and are Option 1 and Option 2 enough for an operator to tell which method
  their site uses?

- **Two Needs expert sentences were dropped rather than carried into the rewritten steps.** "That
  is usually what you want when a hole is out of play" (Enable and disable stations, step 2) and
  the Station details callout "A station at target with a wide spread between heads is a coverage
  problem, not an irrigation-amount problem" are agronomic judgements the source cannot settle.
  The verified half of the second one, that a station that looks fine can still hide one dry head,
  stays as the Why line of step 3. "Ten percent is a common start" stays, as the Why line of Set a
  minimum threshold, step 3, because it is still the common advice. Shows on:
  `#/enable-disable-stations` step 2, `#/station-details` step 3 and `#/minimum-threshold` step 3.
  Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22.
  Question: is 10 percent a sensible starting threshold, and should the hole-out-of-play advice be
  put back?

- **Some steps in Station details point at an icon with no label.** The chevron on a station row
  and the grey and orange calculator icons have no text on screen, so four of the five steps are
  marked as region steps: the Do line names the icon in words ("a chevron beside the station
  name", "an orange calculator icon") and the cursor sits on the icon. Shows on:
  `#/station-details` steps 1, 2, 4 and 5. Decided by the executor under owner direction
  2026-10-19; for review in person 2026-10-22. Question: do operators know these as a chevron and
  a calculator icon, or do they use other words for them?

- **Product behaviour seen while verifying that the guides now leave unsaid or soften.** A station
  with more than one sprinkler is switched off by its Enable switch on its first sprinkler only,
  so after a Shift-click cascade has enabled every sprinkler the station can stay in the push and
  on the Enabled Stations map. Enable and disable stations step 6 says "another sprinkler of that
  station may still be on" and nothing more. The map's Layers list is Enabled Stations by default
  on production, but the reproduction in the figure shows All Stations selected. The refresh
  scan data button in the toolbar is coded with the same text as the gear button, Settings, which may or
  may not be drawn. Shows on:
  `#/enable-disable-stations` steps 1, 5 and 6, and every step that says "the gear button,
  Settings". Decided by the executor under owner direction 2026-10-19; for review in person
  2026-10-22. Question: should these be raised with the product team, and should the guide say
  more about the multi-sprinkler case?
