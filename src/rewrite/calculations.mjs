// Followability rewrites for the Calculations category: Set a minimum threshold, Calculation
// settings, Calculation methods and Preferences.
//
// Each rewrite turns a step into the Do / You should see / If not shape in docs/writing-guide.md,
// anchored on the step's exact current text (after every correction in src/transforms/), so an
// accuracy fix to a sentence this file replaces fails the build here rather than being overwritten.
//
// Every label in [[ ]] and every claim is checked against IntelliDash's English catalogue at the
// production pin in docs/claims/sources.json and against the claims ledger shard for the guide,
// docs/claims/guides/<key>.json. The sources are listed beside each rewrite.
//
// Today this holds only the pilot: step 2 of Set a minimum threshold, which proves the renderer,
// the harvest, the marker-aware translation and the markerDrift gate end to end in all ten
// locales. The rest of the category, its `start` and the removal of 'minimum-threshold' from
// PENDING in scripts/lib/rewrite-status.mjs land with the Calculations rewrite.

/** Set a minimum threshold, step 2. The rail entries are hardcoded English in the product, and
 *  "Minimum Threshold (%)" has no translation in any of the ten other product catalogues, so all
 *  three stay English in every locale; [[Settings]] is the product's translated STRINGS.SETTINGS.
 *
 *  - do: the rail lists the settings groups, Minimum Threshold second, under Calculation
 *    (ledger minimum-threshold/2/2, /2/3; sa-settings-dlg.component.ts:52-57, hardcoded titles).
 *  - see: the tab shows the SPATIAL_ADJUST.SETTINGS_MIN_THRESHOLD "Minimum Threshold (%)" field
 *    with the two below-threshold options under it, MIN_THRESHOLD_OPT_TO_ZERO and
 *    MIN_THRESHOLD_OPT_TO_MIN (ledger /2/4, /4/1, /4/2, /4/3; sa-settings-dlg.component.html:129-170,
 *    en-us.json:469, :423-425).
 *  - ifNot: Settings opens on Calculation unless Review Threshold was used since the page loaded,
 *    in which case it opens on Minimum Threshold and the box is already there (ledger /1/3,
 *    corrected in docs/text-corrections.md §28); the gear at the right of the toolbar is labelled
 *    STRINGS.SETTINGS "Settings" (ledger /1/1, /1/2).
 *  Readability: grade 8.0 over do, see and ifNot. No why: choosing a tab is not a choice the
 *  reader can get wrong for lack of a concept. Same step count, so TARGETS is unchanged. */
function minimumThresholdTab(src, h) {
  return h.editStep(src, {
    name: 'rewrite: minimum-threshold step 2 (Choose the Minimum Threshold tab)',
    guide: 'minimum-threshold',
    title: 'Choose the Minimum Threshold tab',
    expect: {
      body: 'The left rail lists the settings groups. Minimum Threshold sits second, under Calculation.',
      caption: 'Settings dialog, Minimum Threshold tab.',
      do: null,
      see: null,
      ifNot: null,
    },
    set: {
      do: 'In the left rail, select [[Minimum Threshold]], just under [[Calculation]].',
      see: 'The right side shows the [[Minimum Threshold (%)]] box, with two choices below it for small values.',
      ifNot: 'If you see another tab, select [[Minimum Threshold]] again; Settings opens on [[Calculation]]. '
        + 'If there is no left rail, select the gear button, [[Settings]], at the right of the toolbar.',
    },
    drop: ['body'],
  });
}

/** Applies every Calculations rewrite, in order. Registered in src/rewrite/index.mjs. */
export function apply(src, h) {
  let s = src;
  s = minimumThresholdTab(s, h);
  return s;
}
