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
