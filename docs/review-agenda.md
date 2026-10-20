# Review agenda: in-person walkthrough, 2026-10-22

Calls made without a review gate, under the owner's direction of 2026-10-19. Each bullet says
what was decided, where it shows on the live site (https://toroadam.github.io/spatial-adjust-guide/)
or in the video, and the question to put to the experts. Append only: add new bullets at the end
and never rewrite another one.

- **The beta list has three surfaces, and only one is planned as guide text.**
  `docs/claims/beta-surfaces.md` classifies all 24 commits that separate production from
  develop/beta. Only the TurfRad v3 data path counts as beta content, and it has three surfaces.
  (a) `stale-scans-kept`: when TurfRad has loaded nothing new, beta keeps a course's last scans
  and modelled values beyond seven days, while production drops those stations. This is planned
  as a Beta step in Calculation questions. (b) `suggestion-held-without-new-scan`: on a day with
  nothing new from TurfRad, beta writes today's suggestion once, modelled from the older of the
  station's two latest days, and does not recalculate it. (c) `scan-day-from-load-time`: beta
  decides which scan is today's from the time TurfRad loaded it, not the date it was measured.
  (b) and (c) are listed but are not written into any guide, because the reproduction cannot
  show them and they may be defects rather than design. Shows on: nothing on the live site yet,
  because all 26 guides are GA in `src/release.json`. The `stale-scans-kept` step will appear in
  Calculation questions with a Beta badge once it is built. Decided by the executor under owner
  direction 2026-10-19; for review in person 2026-10-22. Question: are (b) and (c) intended
  behaviour of the TurfRad v3 update, or defects to report? How often does TurfRad load a scan on
  a later day than it was measured?
- **The German catalogue fix on develop is not treated as beta content.** A develop-only commit
  adds German wording for six labels on the Spatial Adjust screen: All Stations, Replace, Shift,
  Calculation ET, Lynx Reference Amount and Daily Max Amount. It is classified no-guide-impact
  because it changes only translations, and the beta switch works per guide and per step, not
  per locale label. Production lacks these six German labels, so German users of production see
  them in English. The German guide's reproduction already shows German for all six. Three use
  the same words as develop and three do not. Shows on: the German guide's screen labels for
  those six controls, for example in Map navigation, Bulk adjustments and Calculation settings. Decided by the
  executor under owner direction 2026-10-19; for review in person 2026-10-22. Question: should the
  German reproduction show these six labels in English to match production, keep its own German
  wording, or adopt develop's wording?
- **How beta content is labelled when it is shown.** A beta guide's catalogue tile carries a
  "Beta" text badge above its title, ahead of any New in IntelliDash badge, and a screen reader
  hears "Beta" in the tile's name. The guide opens with a banner: "Beta. This feature is in
  testing and may change before it reaches your IntelliDash." A beta step inside a GA guide shows
  an inline "Beta" marker after its heading, in the written steps and in the walkthrough panel.
  The steps of a wholly beta guide carry no marker, because the banner already covers them. The
  accent is the design system's violet, chosen because it is distinct from the blue of the
  informative note and the New badge, and it meets the 4.5:1 contrast minimum. Shows on: nothing
  on the live site yet, because nothing in `src/release.json` is beta. It will appear on the first
  beta guide or step, for example the planned beta step in Calculation questions. Decided by the
  executor under owner direction 2026-10-19; for review in person 2026-10-22. Question: does
  "Beta" plus that banner sentence say the right thing to a superintendent, or should it name
  what changes, for example "available on the beta environment only"? Is violet acceptable on the
  Spatial Adjust brand?
- **The Beta label and banner are machine-translated, using IntelliDash's own word for Beta.**
  IntelliDash's shipped catalogues label one menu item "(Beta)". The guides follow that rendering
  in each locale: "Beta" stays untranslated in German, Spanish, Italian, Korean and Portuguese. It
  becomes "Bêta" in French, "Bèta" in Dutch, "ベータ版" in Japanese, "เบต้า" in Thai and "测试版" in
  Chinese. The banner sentence is a new machine translation with no native review, like the rest
  of the catalogues. Shows on: the badge and banner under `?lang=` for any locale, once a guide or
  step is beta. Decided by the executor under owner direction 2026-10-19; for review in person
  2026-10-22. Question: do the regional teams want "Beta" left in English where IntelliDash leaves
  it, and does the banner sentence read naturally in each language?
- **The `stale-scans-kept` beta step is written, shown by default and checked against develop.**
  Calculation questions gains a sixth step, "A stale course keeps its last scans", marked Beta. It
  says that when TurfRad has loaded nothing new, Spatial Adjust keeps the course's last scans
  beyond seven days, the stations stay in the table and on the map as clear pins, Option 2 still
  models a value and a suggestion every day, and Request latest scan data looks back only two
  days. Its figure is the existing map, pointing at a clear pin. Four of its five sentences are
  Verified (beta) at develop `bd39f465`; the caption, "A pin last scanned on an earlier day is
  drawn clear.", is true on production too and is plain Verified. The two surfaces the
  reproduction cannot draw are listed in `README.md` under Known gaps as beta guide candidates.
  Shows on: https://toroadam.github.io/spatial-adjust-guide/#/calculation-questions, step 6, in
  English and the ten other languages. Decided by the executor under owner direction 2026-10-19;
  for review in person 2026-10-22. Question: is keeping a stale course's scans and suggestions
  indefinitely the intended TurfRad v3 behaviour for production, and should the step warn that a
  suggestion modelled from scans weeks old needs checking before a push?
- **GA sentences that tie a pin to a scan within seven days stay as they are.** Dashboard overview
  ("Read the map") and Map navigation ("Pins are coloured by measured moisture") say a pin means a
  scan within the past seven days, which is production behaviour. On beta a course that TurfRad
  has stopped updating keeps its pins, clear, beyond seven days. The beta list keeps those
  sentences GA and puts the beta behaviour in one place, the Calculation questions step above.
  Shows on: https://toroadam.github.io/spatial-adjust-guide/#/dashboard-overview and
  https://toroadam.github.io/spatial-adjust-guide/#/map-navigation, unchanged. Decided by the
  executor under owner direction 2026-10-19; for review in person 2026-10-22. Question: should
  those two guides gain a beta step of their own, or is one step in Calculation questions enough
  for beta users?
