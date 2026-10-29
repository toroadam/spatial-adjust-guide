// Followability rewrites for the Calculations category: Set a minimum threshold, Calculation
// settings, Calculation methods and Preferences.
//
// Each rewrite turns a step into the Do / You should see / If not shape in docs/writing-guide.md,
// anchored on the step's exact current text (after every correction in src/transforms/), so an
// accuracy fix to a sentence this file replaces fails the build here rather than being overwritten.
//
// Every label in [[ ]] and every claim is checked against IntelliDash's English catalogue at the
// production pin in docs/claims/sources.json and against the claims ledger shard for the guide,
// docs/claims/guides/<key>.json, where each rewritten sentence is a claim with its citations. The
// sources are summarised beside each rewrite; the shard is the record.
//
// Two amount fields are named in plain text, never as markers: Daily Max Amount and Lynx Reference
// Amount. Their product labels carry a units placeholder (SETTINGS_DAILY_MAX_AMOUNT and
// SETTINGS_LYNX_REF_AMOUNT, en-us.json:422 and :420), so scripts/build-label-fixture.mjs leaves
// them out of src/i18n/labels.en-us.json and a marker could not be validated. A step that names
// them carries a real marker for the tab they sit on, [[Calculation]]. "Lynx Reference Amount" is
// also a glossary term, which a marker would hide from the first-use finder.

import { insertSteps } from './insert-steps.mjs';

const START_PAGE = 'The Spatial Adjust dashboard, at /spatialadjust.';
const NO_DIALOG = 'No dialog open.';
const SCAN_DATA = 'A Spatial Adjust account on a site with TurfRad scan data.';
const SETTINGS_OPEN = 'The Settings dialog. The gear button at the right of the toolbar opens it.';

// Shared sentences. The same English is the same catalogue key, so each is translated once.

/** Opening Settings from the toolbar (ledger minimum-threshold/1/x: the gear is STRINGS.SETTINGS
 *  at the right of the toolbar, sa-main-toolbar.component.html:69-72; the dialog's left rail,
 *  sa-settings-dlg.component.html:21-30; it opens on Minimum Threshold only after Review
 *  Threshold, sa-main-toolbar.component.ts:239-244 and sa-confirm-push-dlg.component.ts:99-102). */
const OPEN_SETTINGS = {
  do: 'Select the gear button, [[Settings]], at the right of the toolbar.',
  see: 'The Settings dialog opens, with a list of tabs down its left side.',
  ifNot: 'If it opens on [[Minimum Threshold]], you used [[Review Threshold]] since the page loaded. '
    + 'The next step picks the tab you need.',
};
const GEAR_CAPTION = 'The gear button in the toolbar’s right-hand button group.';

/** Save Changes at the foot of Settings (sa-settings-dlg.component.html:48-55). A failed save shows
 *  the generic save-error message (ERR_MSG.GENERIC_SAVE_ERROR_SUMMARY "Unable to save data",
 *  en-us.json:166) and leaves the dialog open (sa-settings-dlg.component.ts:208-214). */
const SAVE_DO = 'Select [[Save Changes]] at the bottom of the dialog.';
const SAVE_IF_FAILED = 'If a message says Unable to save data, the save failed and the dialog is still open. '
  + 'Select [[Save Changes]] again.';
const SAVE_WHY = 'One save keeps the edits on every tab of Settings.';
const SAVE_CAPTION = 'Save Changes, at the bottom of the Settings dialog.';

/** The "One save for every tab." callout the rewritten steps drop; its point is SAVE_WHY. */
const ONE_SAVE_TIP = 'Save Changes saves the edits on every tab of Settings together. With unsaved edits, Cancel '
  + 'asks whether you want to exit without saving: Continue Editing takes you back, and Discard Changes closes '
  + 'the dialog and drops every edit.';
const CONSEQUENCE_TIP = 'Because Option 1 scales the current Lynx value, a station sitting at 0 percent adjust '
  + 'stays at 0 no matter how dry it is.';

/** The no-rail way back, as in docs/writing-guide.md > The step shape. */
const NO_RAIL = 'If there is no left rail, Settings is not open. '
  + 'Select the gear button, [[Settings]], at the right of the toolbar.';

// --- helpers ---------------------------------------------------------------------------------------

/** Adds the named cursor points this category needs to P, after an entry no other module edits.
 *  Each was measured on the rendered figure (1920x1080 space):
 *  - threshOptMin: the label of "Set to the minimum threshold value when pushed to Lynx".
 *  - settingsCancel: Cancel at the foot of Settings.
 *  - prefTemp, prefSeparator: the Temperature Scale and Group and Decimal Separator dropdowns. */
function addPoints(src, h) {
  return h.edit(src, {
    name: 'rewrite: calculations cursor points',
    pattern: /excludeZeros: \[840, 600\]/,
    replace: () => 'excludeZeros: [840, 600], threshOptMin: [1030, 570], settingsCancel: [737, 796], '
      + 'prefTemp: [1220, 465], prefSeparator: [1220, 538]',
  });
}

// --- Set a minimum threshold ----------------------------------------------------------------------

/** Set a minimum threshold, 5 steps to 8: open Settings, choose the tab (the pilot), type the
 *  percentage, choose the option, Exclude Zeros, Save Changes, open Push Changes, read the banner.
 *
 *  - Threshold box: 0 to 50, whole numbers (sa-settings-dlg.component.html:136-143); a keystroke
 *    that would pass the maximum is refused (decimal-input.component.ts:126-129). The two options
 *    and Exclude Zeros are disabled while the threshold is 0 (html:145-162), and Exclude Zeros
 *    unless the second option is selected (html:167). Ledger minimum-threshold/4/x and the
 *    worked behaviour in sa-main-toolbar.component.ts:448-453.
 *  - "Ten percent is a common start" stays Needs expert, with its question carried over.
 *  - A threshold-only save does not reload the dashboard (sa-settings-dlg.component.ts:555-557),
 *    and the threshold is applied at push time, so the table keeps the raw suggestion.
 *  - The pink banner shows only when the count is above 0, with Review Threshold beside it
 *    (sa-confirm-push-dlg.component.html:32-41). Push Changes is greyed out with nothing waiting
 *    or a push running (sa-main-toolbar.component.html:34-42).
 *  The "No server-side check." callout is dropped (not a warning the reader acts on), and "One
 *  save for every tab." becomes the Save step's why. The push window callout stays. */
function minimumThreshold(src, h) {
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: minimum-threshold start',
    guide: 'minimum-threshold',
    expect: { start: null },
    set: {
      start: {
        page: START_PAGE,
        open: NO_DIALOG,
        needs: SCAN_DATA + ' The threshold is a site setting, so it applies to every user on the site.',
      },
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: minimum-threshold step 1 (Open Settings)',
    guide: 'minimum-threshold',
    title: 'Open Settings',
    expect: {
      body: 'The gear button at the right of the toolbar opens the settings dialog. It opens on Calculation, '
        + 'unless you have used Review Threshold in the Push Changes dialog since the page loaded, in which '
        + 'case it opens on Minimum Threshold.',
      caption: GEAR_CAPTION,
    },
    set: { ...OPEN_SETTINGS },
    drop: ['body'],
  });
  s = minimumThresholdTab(s, h);
  s = h.editStep(s, {
    name: 'rewrite: minimum-threshold step 3 (Enter the percentage)',
    guide: 'minimum-threshold',
    title: 'Enter the percentage',
    expect: {
      body: 'Type the cutoff as a whole number between 0 and 50. Ten percent is a common starting point: it '
        + 'removes the noise from stations that are already close to target while leaving genuine corrections intact.',
      caption: 'Threshold set to 10 percent.',
      tipLabel: 'No server-side check.',
      tip: 'The 0–50 bound is enforced by the dialog only. Values sent by other means are not validated on the server.',
    },
    set: {
      do: 'Type a whole number from 0 to 50 in [[Minimum Threshold (%)]].',
      see: 'The box shows your number. With 0, the threshold is off, and the two choices below stay grayed out.',
      ifNot: 'If a digit does not appear, it would take the number above 50, so the dialog refuses it. '
        + 'Only the dialog enforces that limit.',
      why: 'Ten percent is a common start: it drops small changes near target but keeps real fixes.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: minimum-threshold step 4 (Decide what happens below the line)',
    guide: 'minimum-threshold',
    title: 'Decide what happens below the line',
    expect: {
      tipLabel: 'One save for every tab.',
      tip: ONE_SAVE_TIP,
      body: 'Set to zero skips the station entirely — Lynx receives 0%. Set to the minimum threshold value '
        + 'raises the suggestion up to the threshold instead, so the station still gets a small run. Exclude '
        + 'Zeros, available only on the second option, leaves genuine zeros at zero rather than lifting them.',
      caption: 'Below-threshold behaviour, with the second option selected.',
    },
    set: {
      caption: 'Below-threshold behavior, with the second option selected.',
      do: 'Select [[Set to zero when pushed to Lynx]] or [[Set to the minimum threshold value when pushed to Lynx]].',
      see: 'Your choice is marked. With the second one, [[Exclude Zeros]] below it can be ticked.',
      ifNot: 'If both choices are grayed out, the box above holds 0. Type a number above 0 first.',
      why: 'Zero sends 0% for the station; the second choice raises it to the threshold, so it still gets a small run.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = insertSteps(s, h, {
    name: 'rewrite: minimum-threshold steps 5 to 7 (Exclude Zeros, Save Changes, Push Changes)',
    before: 'Save and confirm at push time',
    steps: [
      { title: 'Keep zeros at zero', fig: 'dlgWide', dialog: 'settings', settingsTab: 'threshold',
        thresholdValue: 10, thresholdOption: 'min',
        do: 'Tick [[Exclude Zeros]] if a station at 0% should stay at 0%.',
        see: 'The box is ticked. At push time, 0% stays 0%, and only small values above 0 are raised.',
        ifNot: 'If [[Exclude Zeros]] is grayed out, the box above holds 0 or the first choice is selected. '
        + 'Select the second choice first.',
        caption: 'Exclude Zeros, available with the second option.' },
      { title: 'Save the threshold', fig: 'dlgWide', dialog: 'settings', settingsTab: 'threshold',
        thresholdValue: 10, thresholdOption: 'min',
        do: SAVE_DO,
        see: 'The dialog closes, and the table keeps showing the same suggestions.',
        ifNot: SAVE_IF_FAILED,
        why: SAVE_WHY,
        caption: SAVE_CAPTION },
      { title: 'Open Push Changes', fig: 'toolbarR',
        do: 'Select [[Push Changes]] at the right of the toolbar.',
        see: 'A dialog opens with the list of stations waiting to go to Lynx.',
        ifNot: 'If [[Push Changes]] is grayed out, nothing is waiting or a push is still running. '
          + 'Wait for the push to finish, then look again.',
        caption: 'Push Changes, at the right of the toolbar.' },
    ],
  });
  s = h.editStep(s, {
    name: 'rewrite: minimum-threshold step 8 (Check the threshold in the push list)',
    guide: 'minimum-threshold',
    title: 'Save and confirm at push time',
    expect: {
      tipLabel: 'Push window.',
      body: 'Saving a threshold-only change does not reload the dashboard — the pending push list is simply '
        + 'recalculated. Open Push Changes and the pink banner tells you how many stations the threshold touched, '
        + 'with each affected row showing its original value and the adjusted one.',
    },
    set: {
      title: 'Check the threshold in the push list',
      do: 'Read the pink banner at the top of the list, next to [[Review Threshold]].',
      see: 'It says how many stations the threshold will adjust, and each of those rows shows its old and new value.',
      ifNot: 'If there is no pink banner, no waiting station is below the threshold. Nothing is changed by it this time.',
      why: 'The threshold is applied at push time, so the table still shows the raw suggestion.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: minimum-threshold targets',
    guide: 'minimum-threshold',
    expect: '[P.gear, P.menuThresh, P.threshInput, P.radioMin, P.pushReview]',
    replace: '[P.gear, P.menuThresh, P.threshInput, P.threshOptMin, P.excludeZeros, P.saveChanges, P.push, P.pushReview]',
  });
  return s;
}

/** Set a minimum threshold, step 2. The rail entries are hardcoded English in the product, and
 *  "Minimum Threshold (%)" has no translation in any of the ten other product catalogues, so all
 *  three stay English in every locale; [[Settings]] is the product's translated STRINGS.SETTINGS.
 *
 *  - do: the rail lists the settings groups, Minimum Threshold second, under Calculation
 *    (sa-settings-dlg.component.ts:52-57, hardcoded titles).
 *  - see: the tab shows the SPATIAL_ADJUST.SETTINGS_MIN_THRESHOLD "Minimum Threshold (%)" field
 *    with the two below-threshold options under it, MIN_THRESHOLD_OPT_TO_ZERO and
 *    MIN_THRESHOLD_OPT_TO_MIN (sa-settings-dlg.component.html:129-170, en-us.json:469, :423-425).
 *  - ifNot: Settings opens on Calculation unless Review Threshold was used since the page loaded,
 *    in which case it opens on Minimum Threshold and the box is already there (corrected in
 *    docs/text-corrections.md §28); the gear at the right of the toolbar is labelled
 *    STRINGS.SETTINGS "Settings".
 *  No why: choosing a tab is not a choice the reader can get wrong for lack of a concept. */
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

// --- Calculation settings -------------------------------------------------------------------------

/** Calculation settings, 5 steps to 7: open Settings, choose the tab, the three amounts one per
 *  step, Save Changes, then the Suggested column.
 *
 *  - Daily Max Amount up to 15 and Lynx Reference Amount up to 10, in the units from the user's
 *    preferences (sa-settings-dlg.component.html:82-110, sa-settings-dlg.component.ts:354-365);
 *    Crop Coefficient 0 to 200, whole numbers (html:112-123). All three are disabled under
 *    Option 1 (html:83-85, :98-100, :113-115).
 *  - The cap makes runs of equal suggestions, and the suggestion is the day's amount divided by
 *    the reference (SpatialAdjustService.cs:3041-3043, docs/claims/calculations.md).
 *  - Saving an amount recalculates and reloads (sa-settings-dlg.component.ts:452-455, :528-539);
 *    a typed % Adj. keeps its value (SpatialAdjustService.cs:1884-1894).
 *  - The Save step's ifNot carries the Units of Measure hazard from Preferences: a unit change
 *    saved in the same visit saves these amounts rescaled by 25.4 (sa-settings-dlg.component.ts:
 *    422-427), so the reader reopens Settings and checks both amounts before pushing.
 *  The "Stored in millimetres.", "Worked example.", "Greyed out under Option 1." and "One save
 *  for every tab." callouts are folded into the steps or cut. */
function calculationSettings(src, h) {
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: calculation-settings start and verify',
    guide: 'calculation-settings',
    expect: {
      start: null,
      verify: "['You can state what 100 percent adjust means on your site in inches or millimetres.', "
        + "'You know which setting produces a run of identical suggestions.']",
    },
    set: {
      verify: [
        'Reopening Settings shows the amounts you saved, in your units.',
        'The Suggested column has moved where your new setting takes part.',
      ],
      start: {
        page: START_PAGE,
        open: NO_DIALOG,
        needs: SCAN_DATA + ' These are site settings, so they apply to every user on the site.',
      },
    },
  });
  s = insertSteps(s, h, {
    name: 'rewrite: calculation-settings step 1 (Open Settings)',
    before: 'Open Settings on the Calculation tab',
    steps: [
      { title: 'Open Settings', fig: 'toolbarR', ...OPEN_SETTINGS, caption: GEAR_CAPTION },
    ],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-settings step 2 (Choose the Calculation tab)',
    guide: 'calculation-settings',
    title: 'Open Settings on the Calculation tab',
    expect: {
      body: 'The gear button opens the dialog on Calculation by default. If you last arrived through Review '
        + 'Threshold it opens on Minimum Threshold instead — the tab is sticky for the rest of the session.',
      caption: 'Settings dialog, Calculation tab.',
    },
    set: {
      title: 'Choose the Calculation tab',
      do: 'In the left rail, select [[Calculation]], the first entry.',
      see: 'The right side shows Daily Max Amount, Lynx Reference Amount and [[Crop Coefficient (%)]].',
      ifNot: 'If all three boxes are grayed out, the site uses [[Option 1]], which uses none of them. '
        + 'Calculation methods explains the two methods.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-settings step 3 (Set the daily maximum)',
    guide: 'calculation-settings',
    title: 'Daily Max Amount caps the water',
    expect: {
      body: 'The most water Spatial Adjust will ask for in one day, in your own units, up to a hard ceiling of 15. '
        + 'Every station whose deficit exceeds this lands on the same suggested percentage, which is why '
        + 'identical numbers appear in runs.',
      caption: 'Daily Max Amount, edited in the units your preferences specify.',
      tipLabel: 'Stored in millimetres.',
      tip: 'The backend keeps these amounts in millimetres and the dialog converts on the way in and out \u2014 '
        + 'two decimals imperial, one metric.',
    },
    set: {
      title: 'Set the daily maximum',
      do: 'On the [[Calculation]] tab, type the most water for one day in Daily Max Amount.',
      see: 'The box shows your number in your own units. It goes up to 15.',
      ifNot: 'If a digit does not appear, it would take the number above 15. The box refuses it.',
      why: 'Every station that needs more than this gets the same suggestion, so a run of equal numbers means the cap.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-settings step 4 (Set the Lynx Reference Amount)',
    guide: 'calculation-settings',
    title: 'Lynx Reference Amount is what 100% means',
    expect: {
      body: 'This is the amount of water a station applies at 100 percent adjust. The suggested percentage is the '
        + 'applied amount divided by this reference. Set it too low and every suggestion looks enormous.',
      caption: 'Lynx Reference Amount, ceiling of 10.',
      tipLabel: 'Worked example.',
      tip: 'A 10 mm cap against a 3 mm reference gives a maximum suggestion of 333 percent \u2014 the ceiling you '
        + 'see repeated across a dry course.',
    },
    set: {
      title: 'Set the Lynx Reference Amount',
      do: 'On the [[Calculation]] tab, type your Lynx Reference Amount, up to 10.',
      see: 'The box shows your number, in the same units as Daily Max Amount.',
      ifNot: 'If suggestions later look far too high, this number is too low. It should match what a station applies at 100%.',
      why: 'Each suggestion is a percentage of this number.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-settings step 5 (Set the crop coefficient)',
    guide: 'calculation-settings',
    title: 'Crop Coefficient scales today\\u2019s ET',
    expect: {
      tipLabel: 'Greyed out under Option 1.',
      tip: 'Option 1 uses no ET, so the dialog disables Crop Coefficient while it is selected, along with Daily Max '
        + 'Amount and Lynx Reference Amount.',
      body: 'A whole-number percentage from 0 to 200 applied to the day’s ET before it enters the calculation. '
        + 'Below 100 the course is treated as using less water than reference ET suggests; above 100, more.',
      caption: 'Crop Coefficient: 0 to 200, integers.',
    },
    set: {
      title: 'Set the crop coefficient',
      do: 'Type a whole number from 0 to 200 in [[Crop Coefficient (%)]].',
      see: 'The box shows the percentage that today’s ET is scaled by.',
      ifNot: 'If the box is grayed out, the site uses [[Option 1]], which uses no ET. The two amounts above it are grayed out too.',
      why: 'Below 100, the course is treated as using less water than ET suggests; above 100, more.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = insertSteps(s, h, {
    name: 'rewrite: calculation-settings step 6 (Save the settings)',
    before: 'Saving recalculates the whole course',
    steps: [
      { title: 'Save the settings', fig: 'dlgWide', dialog: 'settings', settingsTab: 'calculation',
        do: SAVE_DO,
        see: 'The dialog closes, and the dashboard reloads with new suggestions.',
        ifNot: 'If you also changed Units of Measure in this visit, the amounts were saved rescaled by 25.4. '
          + 'Reopen [[Settings]] and check Daily Max Amount and Lynx Reference Amount before you push.',
        caption: SAVE_CAPTION },
    ],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-settings step 7 (Check the Suggested column)',
    guide: 'calculation-settings',
    title: 'Saving recalculates the whole course',
    expect: {
      tipLabel: 'One save for every tab.',
      tip: ONE_SAVE_TIP,
      body: 'Save Changes sends the settings, asks the server to recalculate adjustments, and reloads the dashboard '
        + 'so that area and hole averages are rebuilt. Expect the Suggested column to move wherever the setting you '
        + 'changed takes part: a new Lynx Reference Amount rescales every suggestion above zero, a new Daily Max '
        + 'Amount moves only the stations at the old or new cap, and stations at zero usually stay there. A % Adj. '
        + 'you typed earlier keeps its value.',
      caption: 'After a recalculation the dashboard reloads with new suggestions.',
    },
    set: {
      title: 'Check the Suggested column',
      do: 'Look down the [[Suggested]] column in the table.',
      see: 'Suggestions change wherever your new setting takes part, while most stations at 0 stay at 0.',
      ifNot: 'If [[% Adj.]] did not follow the new suggestion, you typed that value earlier. A typed value is kept.',
      why: 'A new Lynx Reference Amount rescales every suggestion above 0; a new Daily Max Amount moves only stations at the cap.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: calculation-settings targets',
    guide: 'calculation-settings',
    expect: '[P.menuCalc, P.maxAmount, P.refAmount, P.cropCoeff, P.saveChanges]',
    replace: "[P.gear, P.menuCalc, P.maxAmount, P.refAmount, P.cropCoeff, P.saveChanges, cell('sugg', 3)]",
  });
  return s;
}

// --- Calculation methods --------------------------------------------------------------------------

/** Calculation methods, 5 steps, reordered so the dialog steps come first: find the selector,
 *  see what Option 1 turns off, close Settings, read the Suggested column, review after a switch.
 *  Each slot keeps its position and is re-pointed at its new figure.
 *
 *  - The selector, SPATIAL_ADJUST.SUGGESTED_PCT_ADJ_CALC, shows outside production, or on
 *    production only while the site's method is Option 1 (sa-settings-dlg.component.html:72,
 *    sa-settings-dlg.component.ts:127). So on production, saving Option 2 hides the selector and
 *    the switch cannot be undone from Settings: the new why on the last step.
 *  - Option 1 disables the three amount boxes (html:83-85, :98-100, :113-115) and scales the
 *    percent adjust Lynx holds by target over measured (sa-algorithm.service.ts:58-60).
 *  - Option 2's chain and cap: SpatialAdjustService.cs:2931-3043.
 *  - Saving a new method recalculates and reloads (sa-settings-dlg.component.ts:552-554,
 *    sa-dashboard.component.ts:262-270).
 *  The methods are named only by their product labels, [[Option 1]] and [[Option 2]]. */
function calculationMethods(src, h) {
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: calculation-methods start and verify',
    guide: 'calculation-methods',
    expect: {
      start: null,
      verify: "['You can say which algorithm your site uses.', 'You know why Max Amount is greyed out under Option 1.']",
    },
    set: {
      verify: ['You can say which algorithm your site uses.', 'You know why Daily Max Amount is grayed out under Option 1.'],
      start: {
        page: START_PAGE,
        open: 'The Settings dialog, on the Calculation tab. The gear button at the right of the toolbar opens it.',
        needs: SCAN_DATA,
      },
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-methods step 1 (Find the selector)',
    guide: 'calculation-methods',
    title: 'Find the selector',
    expect: {
      body: 'Suggested Percent Adjust Calculation is the first field on the Calculation tab. On a production site '
        + 'it only appears when the persisted algorithm is already Option 1, so most users never see it. The '
        + 'dropdown offers only Option 1 and Option 2; nothing in the product says what either one does.',
      caption: 'The algorithm dropdown, above the three amounts.',
    },
    set: {
      do: 'Find [[Suggested Percent Adjust Calculation]], the first box on the [[Calculation]] tab.',
      see: 'It shows [[Option 1]] or [[Option 2]], the method your site uses.',
      ifNot: 'If the box is not there, the site uses [[Option 2]]. On a production site it shows only while the site uses [[Option 1]].',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-methods step 2 (See what Option 1 turns off)',
    guide: 'calculation-methods',
    title: 'Option 2 — delta plus today’s ET, the default',
    expect: {
      fig: 'table',
      body: 'The server computes it per station: target minus working VWC gives a deficit, the deficit becomes an '
        + 'amount of water, today\u2019s ET adjusted by the crop coefficient is added, the daily maximum caps the '
        + 'total, and the result is divided by the Lynx reference amount.',
      caption: 'Every suggestion in this column came from that chain.',
    },
    set: {
      title: 'See what Option 1 turns off',
      fig: 'dlgWide',
      dialog: 'settings',
      settingsTab: 'calculation',
      algorithm: 'simple',
      do: 'Look at the three boxes below [[Suggested Percent Adjust Calculation]].',
      see: 'Under [[Option 1]] they are grayed out; under [[Option 2]] you can type in them.',
      ifNot: 'If you can type in them, the site uses [[Option 2]], the method these three boxes feed.',
      why: '[[Option 1]] scales the percentage Lynx holds now, so it needs no ET, reference amount or cap.',
      caption: 'With Option 1 selected, the three boxes below it are grayed out.',
      tipLabel: 'Consequence.',
      tip: CONSEQUENCE_TIP,
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-methods step 3 (Cancel without saving)',
    guide: 'calculation-methods',
    title: 'Option 1 — ratio of target to measured',
    expect: {
      algorithm: 'simple',
      body: 'Option 1 multiplies the percent adjust Lynx currently holds by target divided by measured moisture, '
        + 'and rounds. It uses no ET, no reference amount and no cap, so Max Amount and Lynx Reference Amount '
        + 'are disabled while it is selected.',
      caption: 'With Option 1 selected, the two amount fields are disabled.',
      tipLabel: 'Consequence.',
      tip: CONSEQUENCE_TIP,
    },
    set: {
      title: 'Cancel without saving',
      do: 'Select [[Cancel]] to close Settings without saving.',
      see: 'The dialog closes, and the table is in view again.',
      ifNot: 'If you are asked whether to leave without saving, you changed something. Select [[Discard changes]] to drop it.',
      caption: 'Cancel, at the bottom of the Settings dialog.',
    },
    drop: ['algorithm', 'body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-methods step 4 (Read the Suggested column)',
    guide: 'calculation-methods',
    title: 'The cap is what makes them look different',
    expect: {
      body: 'Option 2 flattens everything above the daily maximum onto one number. Option 1 has no ceiling, so its '
        + 'suggestions spread out — and can go far higher than you intend on a station that reads very dry.',
      caption: 'Runs of identical values are a signature of the capped method.',
    },
    set: {
      title: 'Read the Suggested column',
      do: 'In the table, look down the [[Suggested]] column.',
      see: 'Under [[Option 2]], stations that need more than Daily Max Amount share one value, often in runs.',
      ifNot: 'If the values spread out with no repeats, the site may use [[Option 1]], which has no cap. '
        + 'Its values can go far higher than you intend on a very dry station.',
      why: '[[Option 2]] starts from the gap to your target and today’s ET, and Daily Max Amount caps the result.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: calculation-methods step 5 (Review the column after a switch)',
    guide: 'calculation-methods',
    title: 'Switching is a course-wide change',
    expect: {
      tipLabel: 'One save for every tab.',
      tip: ONE_SAVE_TIP,
      body: 'Saving a different algorithm recalculates every station and reloads the dashboard. Review the whole '
        + 'Suggested column before pushing anything after a switch.',
      caption: 'Compare the column before and after switching, not one row.',
    },
    set: {
      title: 'Review the column after a switch',
      do: 'After a new method is saved, look down the whole [[Suggested]] column before you push.',
      see: 'The dashboard has reloaded, and every station shows a value from the new method.',
      ifNot: 'If the values look the same as before, the method did not change. '
        + 'Reopen [[Settings]] and check [[Suggested Percent Adjust Calculation]].',
      why: 'On a production site, a switch to [[Option 2]] cannot be undone here, because the selector then disappears.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: calculation-methods targets',
    guide: 'calculation-methods',
    expect: "[P.algoSelect, cell('sugg', 3), P.algoSelect, cell('sugg', 5), P.saveChanges]",
    replace: "[P.algoSelect, P.maxAmount, P.settingsCancel, cell('sugg', 5), cell('sugg', 3)]",
  });
  return s;
}

// --- Preferences ----------------------------------------------------------------------------------

/** Preferences, 4 steps to 7: the tab, units, language, temperature scale, number format, Save
 *  Changes, the weather strip.
 *
 *  - The tab is the last rail entry (sa-settings-dlg.component.ts:52-57); its four dropdowns are
 *    Language and Units of Measure on the left, Temperature Scale and Group and Decimal Separator
 *    on the right (sa-settings-dlg.component.html:236-254). Preferences belong to the user
 *    (sa-settings-dlg.component.ts:486, :490).
 *  - Unit conversion runs when the dialog opens (sa-settings-dlg.component.ts:354-365), so the
 *    amount boxes change units only after a save and a reopen. The "Check after switching."
 *    callout on the 25.4 hazard stays, unchanged.
 *  - Untranslated text falls back to English, and the rail names are hardcoded English
 *    (app-initializer.service.ts:38, sa-settings-dlg.component.ts:52-57).
 *  - The separator offers 1,000.00 and 1.000,00 (dash-user-manager.service.ts:209-210).
 *  The "Partly translated." and "One save for every tab." callouts are folded into the steps. */
function preferences(src, h) {
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: preferences start',
    guide: 'preferences',
    expect: { start: null },
    set: {
      start: {
        page: START_PAGE,
        open: SETTINGS_OPEN,
        needs: 'A Spatial Adjust account. Preferences belong to your account, not to the site.',
      },
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: preferences step 1 (Open the Preferences tab)',
    guide: 'preferences',
    title: 'Open the Preferences tab',
    expect: {
      tipLabel: 'One save for every tab.',
      tip: ONE_SAVE_TIP,
      body: 'Preferences is the last entry in the settings rail. Language, Temperature Scale and the separator '
        + 'setting change only how things are presented. Units of Measure can change suggestions: change it and save '
        + 'in the same visit, and the amounts on the Calculation tab are saved rescaled by 25.4 and every suggestion '
        + 'is recalculated, as step 2 explains.',
      caption: 'Settings dialog, Preferences tab.',
    },
    set: {
      do: 'In the left rail, select [[Preferences]], the last entry.',
      see: 'The right side shows [[Language]], [[Units of Measure]], [[Temperature Scale]] and [[Group and Decimal Separator]].',
      ifNot: NO_RAIL,
      why: 'These choices belong to you, not to the site.',
    },
    drop: ['tipLabel', 'tip', 'body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: preferences step 2 (Choose your units)',
    guide: 'preferences',
    title: 'Units of Measure changes what you type',
    expect: {
      body: 'The stored amounts are millimetres. Switching to imperial shows them in inches, with two decimal places '
        + 'and a hundredth-of-an-inch step; metric gets one decimal place and a tenth-of-a-millimetre step. That '
        + 'conversion runs when the dialog opens, not when you change the setting.',
      caption: 'Units of Measure drives the labels and precision on the Calculation tab.',
      tipLabel: 'Check after switching.',
    },
    set: {
      title: 'Choose your units',
      do: 'Choose your units in [[Units of Measure]].',
      see: 'The box shows the units you chose. The amounts on the [[Calculation]] tab change after you save and reopen Settings.',
      ifNot: 'If you change Units of Measure and save in the same visit, the saved amounts are rescaled by 25.4. '
        + 'Reopen [[Settings]] and check Daily Max Amount and Lynx Reference Amount before you push.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: preferences step 3 (Choose your language)',
    guide: 'preferences',
    title: 'Language applies immediately',
    expect: {
      tipLabel: 'Partly translated.',
      tip: 'Anything Spatial Adjust has no translation for stays in English, and every language other than English '
        + 'has gaps. The tab names in the settings rail, the Discard changes confirmation and the scan-data banner '
        + 'are in English whatever you choose.',
      body: 'Saving a new language re-applies translations across the site without a reload, and refetches your '
        + 'user record so the choice sticks on your next visit.',
      caption: 'Language, units, temperature scale and separator.',
    },
    set: {
      title: 'Choose your language',
      do: 'Choose your language in [[Language]].',
      see: 'The box shows your choice, and the screen switches to it when you save.',
      ifNot: 'If some text stays in English after you save, the product has no translation for it. '
        + 'The tab names in the left rail are always English.',
    },
    drop: ['tipLabel', 'tip', 'body'],
  });
  s = insertSteps(s, h, {
    name: 'rewrite: preferences steps 4 to 6 (temperature, number format, Save Changes)',
    before: 'Temperature and separator affect the toolbar',
    steps: [
      { title: 'Choose the temperature scale', fig: 'dlgWide', dialog: 'settings', settingsTab: 'preferences',
        do: 'Choose a scale in [[Temperature Scale]].',
        see: 'The box shows the scale the weather strip will use.',
        ifNot: 'If the weather strip still shows the old scale later, the change was not saved. '
          + 'Choose it again and select [[Save Changes]].',
        caption: 'Temperature Scale, at the top right of the Preferences tab.' },
      { title: 'Choose the number format', fig: 'dlgWide', dialog: 'settings', settingsTab: 'preferences',
        do: 'Choose a format in [[Group and Decimal Separator]].',
        see: 'The box shows how numbers will be written, either 1,000.00 or 1.000,00.',
        ifNot: 'If numbers still look the same after you save, check that the box shows the format you want.',
        why: 'The format changes how every number on the screen is written, which matters most in the table.',
        caption: 'Group and Decimal Separator, under Temperature Scale.' },
      { title: 'Save your preferences', fig: 'dlgWide', dialog: 'settings', settingsTab: 'preferences',
        do: SAVE_DO,
        see: 'The dialog closes, and the screen uses your new choices.',
        ifNot: SAVE_IF_FAILED,
        why: SAVE_WHY,
        caption: SAVE_CAPTION },
    ],
  });
  s = h.editStep(s, {
    name: 'rewrite: preferences step 7 (Check the weather strip)',
    guide: 'preferences',
    title: 'Temperature and separator affect the toolbar',
    expect: {
      body: 'Temperature scale changes the weather strip; the group and decimal separator changes how every number on '
        + 'the screen is punctuated, which matters most in the dense table columns.',
      caption: 'The weather strip follows your temperature scale.',
    },
    set: {
      title: 'Check the weather strip',
      region: true,
      do: 'Look at the weather strip at the left of the toolbar.',
      see: 'Temperatures show in the scale you chose.',
      ifNot: 'If they show the old scale, open Settings again and check [[Temperature Scale]] on the [[Preferences]] tab.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: preferences targets',
    guide: 'preferences',
    expect: '[P.menuPrefs, P.prefUnits, P.prefLanguage, P.weather]',
    replace: '[P.menuPrefs, P.prefUnits, P.prefLanguage, P.prefTemp, P.prefSeparator, P.saveChanges, P.weather]',
  });
  return s;
}

/** Applies every Calculations rewrite, in order. Registered in src/rewrite/index.mjs. */
export function apply(src, h) {
  let s = src;
  s = addPoints(s, h);
  s = minimumThreshold(s, h);
  s = calculationSettings(s, h);
  s = calculationMethods(s, h);
  s = preferences(s, h);
  return s;
}
