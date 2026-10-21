// Followability rewrites for the Review & Apply category: Understand suggested adjustments, Push
// changes to Lynx, Reviewing changes, Verify results, and Filter by % Adj. (which
// src/transform-export.mjs adds to the category).
//
// Each rewrite turns a step into the Do / You should see / If not shape in docs/writing-guide.md,
// anchored on the step's exact current text (after every correction in src/transforms/), so an
// accuracy fix to a sentence this file replaces fails the build here rather than being overwritten.
//
// Every label in [[ ]] is a key of src/i18n/labels.en-us.json and is named by a Verified claim.
// Every statement is checked against IntelliDash at the production pin in
// docs/claims/sources.json and against the guide's claims ledger shard, docs/claims/guides/<key>.json.
// The ledger IDs below are the ones the ledger held before this rewrite (the claims of a dropped
// body leave the ledger with it; titles, captions and kept tips carry over unchanged). Paths are
// IntelliDash paths at the pin, cited by line, never quoted.
//
// What changed beyond wording, and why:
//   - Tips that were advice rather than a warning are folded into why or ifNot and dropped
//     (docs/writing-guide.md > The step shape). The push-window tip stays on every push step.
//   - Understand suggested adjustments gains a last step, Save in the Soil Factor Editor, which the
//     export never told the reader to press.
//   - Filter by % Adj. gains Save Changes in Over/Under Options, and Exclude Zeros moves up to sit
//     before it, so the dialog is finished before the reader looks at the filtered tab.
//   - Cursor targets follow the control each `do` names, through new named points in P.

import { insertStepAfter, moveStepBefore } from './step-order.mjs';

const DASHBOARD = 'The Spatial Adjust dashboard, at /spatialadjust.';
const PUSH_NEEDS = 'Lynx must be reachable, and Site Adjust and Course Adjust must both be 100% in Lynx.';
const PUSH_WINDOW = 'Push between 11 AM and the synchronisation time set in Lynx, and synchronise Lynx after '
  + 'the push. Outside that window the push does not reach the course, and no error tells you so.';

/** One rewritten step: anchored on its current body, which it drops. */
function step(src, h, { guide, title, body, expect = {}, set, drop = [] }) {
  return h.editStep(src, {
    name: `rewrite: ${guide} step "${title}"`,
    guide,
    title,
    expect: { body, do: null, see: null, ifNot: null, ...expect },
    set,
    drop: ['body', ...drop],
  });
}

/** A guide's start state, which it does not have yet. */
function start(src, h, guide, value) {
  return h.editGuide(src, { name: `rewrite: ${guide} start`, guide, expect: { start: null }, set: { start: value } });
}

/** Named cursor points this category adds to P, measured in the reproduction's 1920 x 1080 space.
 *  filterOver is the Over checkbox label and filterSave the Save Changes button of Over/Under
 *  Options; soilSave is Save in the Soil Factor Editor; pushBox is the tick box of the first row
 *  under Available to Push. The anchor stays intact, so another module
 *  can add its own points the same way. */
function points(src, h) {
  return h.edit(src, {
    name: 'rewrite: Review & Apply cursor points',
    pattern: /const P = \{\n/,
    replace: () => 'const P = {\n  filterOver: [830, 511], filterSave: [1055, 653], soilSave: [1208, 788], pushBox: [1290, 391],\n',
  });
}

// --- Understand suggested adjustments ------------------------------------------------------------

/** start: dashboard-overview/where/1 and /before/1. The table drills from areas to holes to
 *  stations, and Suggested is on station rows only (suggested-adjustments/where/1;
 *  sa-table-card.component.html:39-62). */
function suggestedAdjustments(src, h) {
  const guide = 'suggested-adjustments';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'No dialog open. The table shows the station rows of one hole.',
    needs: 'A Spatial Adjust account on a site with TurfRad scan data.',
  });

  // Current is what Lynx holds, Suggested what was calculated from the scan, and the gap is the
  // change asked for: /1/2, /1/3, /1/4, /1/5 (sa-table-card.component.ts:406-415,
  // sa-table-card.component.html:48-49, sa-dash-table.component.html:17-20). Area and hole rows
  // show averages only: /where/1. Grade 6.3.
  s = step(s, h, {
    guide,
    title: 'Find the two adjustment columns',
    body: 'Current is the percent adjust Lynx holds for the station right now. Suggested is what Spatial '
      + 'Adjust calculated from this morning’s scan. The gap between them is the change you are being asked to make.',
    set: {
      do: 'Find [[Current]] and [[Suggested]] under the [[Adjustment]] heading of the table.',
      see: '[[Current]] is the percent adjust Lynx holds now, and [[Suggested]] is what Spatial Adjust worked out from the latest scan.',
      ifNot: 'If the rows are areas or holes, there are no station values yet. Select a hole row to open its stations.',
      why: 'The gap between the two is the change you are being asked to make.',
    },
  });

  // Under target asks for more, over target for less: /2/3 (SpatialAdjustService.cs:3033,
  // :3037-3039; sa-algorithm.service.ts:58-60). The calculation sentence, /2/2, is Needs expert and
  // is cut. Grey italics mean a modelled value: calculation-questions/4/2, /4/3
  // (sa-table-card.component.html:29-31, spatial-adjust-course.model.ts:184-188).
  s = step(s, h, {
    guide,
    title: 'Read it against Avg. VWC and Target VWC',
    body: 'The calculation starts from the difference between measured moisture and the station target, converts '
      + 'that into an amount of water, adds today’s ET, and expresses the result as a percentage of the Lynx '
      + 'reference amount. A station well under target asks for more water; one over target asks for less.',
    set: {
      do: 'On the same row, compare [[Avg. VWC]] with [[Target VWC]].',
      see: 'A station well under its target asks for more water, and one over its target asks for less.',
      ifNot: 'If [[Avg. VWC]] is grey and italic, the value is modelled from an older scan, so the suggestion rests on an estimate.',
    },
  });

  // The cap makes runs of identical suggestions: /3/2, /3/3, /3/4, and the fix in the dropped tip,
  // /3/6 (SpatialAdjustService.cs:3041-3043; sa-settings-dlg.component.html:82-95; the field is
  // SPATIAL_ADJUST.MAX_AMOUNT_IN_UNITS_X "Daily Max Amount ({{unitsAbbr}})", en-us.json:422, so it
  // is plain text, not a marker). Option 2 only: Option 1 is the browser's ratio with no cap
  // (sa-table-card.component.ts:427-428; docs/claims/calculations.md §1.1, §3).
  s = step(s, h, {
    guide,
    title: 'Notice where suggestions cluster',
    body: 'Several stations show the same suggested value. That is the daily Max Amount cap: once the required '
      + 'amount exceeds the cap, every station above it lands on the same percentage. If most of your course '
      + 'reads identically, the cap is doing the deciding, not the scan.',
    expect: {
      tipLabel: 'What to do.',
      tip: 'Raise Daily Max Amount in Settings › Calculation, or accept that the course is being deliberately limited.',
    },
    set: {
      do: 'Look down the [[Suggested]] column for a run of the same value.',
      see: 'Under [[Option 2]], every station that needs more than the daily cap shows the same, highest value.',
      ifNot: 'If most of the course shows that value, the cap is deciding, not the scan. '
        + 'Raise Daily Max Amount in [[Settings]] › [[Calculation]] if it is too low.',
    },
    drop: ['tipLabel', 'tip'],
  });

  // % Adj. is the reader's, the suggestion stays underneath, and an edit that differs from Lynx is
  // queued: /4/2, /4/3, /4/4, /4/5 (sa-table-card.component.ts:146-164, sa-table-card.component.html:49).
  // The box is disabled when the station has no value to adjust (sa-table-card.component.html:57,
  // sa-table-card.component.ts:417-420; suggested-adjustments/before/2). The push sends % Adj.
  // (sa-confirm-push-dlg.component.html:83). Grade 6.6.
  s = step(s, h, {
    guide,
    title: 'Override where you disagree',
    body: 'The % Adj. column is yours. Type over the suggestion for a station you know behaves differently — a '
      + 'shaded green, a slope that sheds water — and the row is queued for push. The suggested value is left '
      + 'untouched underneath.',
    set: {
      do: 'Type your own value in the [[% Adj.]] box of a station you know behaves differently.',
      see: 'Your value shows in [[% Adj.]], and [[Suggested]] keeps the calculated value.',
      ifNot: 'If the box is greyed out, the station has no value to adjust: there is no current scan and no modelled value.',
      why: 'The push sends [[% Adj.]], so your value replaces the suggestion for that station.',
    },
  });

  // The editor scales a station's calculated amount by 1 to 200 percent until changed, and opens with
  // Shift + Alt on the gear: /5/3, /5/4, /5/5 (sa-soil-factor-dlg.component.html:15, :56-58,
  // :103-111; sa-main-toolbar.component.ts:276-281). Option 2 only (SpatialAdjustService.cs:3036-3039;
  // docs/claims/calculations.md §7). The footer counts pending changes and Save stays disabled
  // until there is one (sa-soil-factor-dlg.component.html:132-145). Filter station is a hardcoded
  // placeholder (:84-90). /5/2, "override every day", is Needs expert and is cut.
  s = step(s, h, {
    guide,
    title: 'Set a soil factor for persistent offsets',
    body: 'If you override the same station every day, the station itself needs adjusting rather than the number. '
      + 'The soil factor editor scales a station’s calculated amount by 1 to 200 percent, permanently. It is '
      + 'opened with Shift + Alt on the gear button.',
    set: {
      do: 'In the Soil Factor Editor, type a value from 1 to 200 under [[Soil Factor (%)]] for the station.',
      see: 'The footer counts 1 pending change, and [[Save]] is no longer greyed out.',
      ifNot: 'If the editor is not open, hold Shift + Alt and select the gear, [[Settings]]. '
        + 'To find the station, type its name under Filter station.',
      why: 'Under [[Option 2]], a soil factor scales the station’s calculated amount until someone changes it.',
    },
  });

  // New last step. Save writes the factors, recalculates the suggestions for the course, shows a
  // success message and closes the editor about five seconds later; it is disabled while nothing
  // has changed or a value is outside 1 to 200 (sa-soil-factor-dlg.component.ts:53-97,
  // sa-soil-factor-dlg.component.html:113-118, :139-145; Save is STRINGS.SAVE).
  s = insertStepAfter(s, h, {
    name: 'rewrite: suggested-adjustments new step "Save the soil factor"',
    after: 'Set a soil factor for persistent offsets',
    literal: "{ title: 'Save the soil factor', fig: 'dlgSoil', dialog: 'soil' }",
  });
  s = h.editStep(s, {
    name: 'rewrite: suggested-adjustments step "Save the soil factor"',
    guide,
    title: 'Save the soil factor',
    expect: { body: null, do: null },
    set: {
      do: 'Select [[Save]] at the foot of the Soil Factor Editor.',
      see: 'A message says the soil factors were saved, and the editor closes a few seconds later with the suggestions updated.',
      ifNot: 'If [[Save]] is greyed out, nothing has changed or a value is outside 1 to 200.',
      caption: 'Soil Factor Editor, with Save and Cancel at the foot.',
    },
  });

  return h.editTargets(s, {
    name: 'rewrite: suggested-adjustments targets',
    guide,
    expect: "[cell('sugg', 1), cell('vwc', 1), cell('sugg', 3), cell('adj', 5), P.soilInput]",
    replace: "[cell('sugg', 1), cell('vwc', 1), cell('sugg', 3), cell('adj', 5), P.soilInput, P.soilSave]",
  });
}

// --- Push changes to Lynx ------------------------------------------------------------------------

/** start: push-to-lynx/before/1 and /before/4 (docs/writing-guide.md, Example 2). */
function pushToLynx(src, h) {
  const guide = 'push-to-lynx';
  let s = start(src, h, guide, { page: DASHBOARD, open: 'No dialog open.', needs: PUSH_NEEDS });

  // docs/writing-guide.md, Example 2, word for word: /1/1 to /1/5 (sa-main-toolbar.component.html:34,
  // :40, :44-47; en-us.json:559). Grade 5.1.
  s = step(s, h, {
    guide,
    title: 'Check the pending count',
    body: 'The button counts the enabled stations whose % Adj. differs from what Lynx holds, whether you edited '
      + 'it or left the suggestion, leaving out any already pushed today. Beside it the green counter shows how '
      + 'many have already gone out today. If Push Changes is greyed out there is nothing queued.',
    set: {
      do: 'Find [[Push Changes]] at the right of the toolbar and read the number on it.',
      see: 'The button shows a count, such as Push 6 Changes, and the green counter beside it shows how many went out today.',
      ifNot: 'If [[Push Changes]] is greyed out, nothing is waiting or a push is still running. Wait for the push to finish, then look again.',
    },
  });

  // Available to Push first, ticked; Pushed Today after, unticked; tick one only to adjust it again
  // today: /2/2, /2/3, /2/4 (sa-confirm-push-dlg.component.html:66-136, sa-confirm-push-dlg.component.ts:23-26;
  // en-us.json:323, :545, :547). The list label is CASE_SENSITIVE.N_AVAIL_TO_PUSH "{{num}} Available
  // to Push", with no uncounted form, so it is plain text. The button is disabled when nothing is
  // waiting: /1/4.
  s = step(s, h, {
    guide,
    title: 'Review the two lists',
    body: 'The dialog puts the current value on the left and the change on the right. Available to Push comes '
      + 'first, with everything ticked; Pushed Today follows, unticked. Tick a pushed station only if you '
      + 'genuinely mean to adjust it a second time today.',
    set: {
      do: 'Select [[Push Changes]].',
      see: 'The [[Push Changes]] dialog lists Available to Push first, all ticked, then [[Pushed Today]], unticked.',
      ifNot: 'If nothing opens, [[Push Changes]] is greyed out because nothing is waiting.',
      why: 'Tick a [[Pushed Today]] row only if you mean to adjust that station a second time today.',
    },
  });

  // The pink banner counts the stations the threshold altered, each such row shows "Adjusted to"
  // and the value sent, and Review Threshold opens Settings on the threshold tab: /3/2, /3/3
  // (sa-confirm-push-dlg.component.html:32-42, :84-86; sa-confirm-push-dlg.component.ts:99-102;
  // sa-main-toolbar.component.ts:239-244). The banner shows only when a station was altered
  // (:32); a threshold of 0 alters none: threshold-questions/5/2. Nothing is sent from the
  // dialog until its footer button: reviewing-changes/before/2.
  s = step(s, h, {
    guide,
    title: 'Look for threshold adjustments',
    body: 'If a minimum threshold is set, a pink banner counts the stations it altered and each affected row shows '
      + 'the original percentage and the value that will actually be sent. Review Threshold opens Settings on '
      + 'the threshold tab if the numbers look wrong.',
    set: {
      do: 'Find the pink banner above the lists, with the [[Review Threshold]] link at its right.',
      see: 'The banner counts the stations the threshold changed, and each row shows Adjusted to and the value that will be sent.',
      ifNot: 'If there is no banner, the threshold changed no station or is set to 0, so there is nothing to check.',
      why: '[[Review Threshold]] closes this dialog and opens [[Settings]] without sending anything.',
    },
  });

  // The footer counts only ticked rows; unticking is not reverting: /4/2, /4/3
  // (sa-confirm-push-dlg.component.html:89-96, :144; sa-confirm-push-dlg.component.ts:84-97). The
  // tri-state box in the Changes heading ticks or unticks every row of both lists
  // (sa-confirm-push-dlg.component.html:53-58, sa-confirm-push-dlg.component.ts:89-97).
  s = step(s, h, {
    guide,
    title: 'Untick anything you are not sure about',
    body: 'The footer button counts only the ticked rows. Unticking is not the same as reverting — the station keeps '
      + 'its edited value in the table and will be offered again next time.',
    set: {
      do: 'In the [[Changes]] column, untick each station you do not want to send.',
      see: 'The count on the footer button drops by 1 for each row you untick.',
      ifNot: 'If [[Pushed Today]] rows became ticked, you used the box beside [[Changes]] in the heading, which ticks both lists. '
        + 'Untick the rows you did not mean.',
      why: 'Unticking is not reverting: the station keeps its value in the table and is offered again next time.',
    },
  });

  // Write, read back, compare, retry; the bar restarts at 0 for a retry and counts only the failed
  // stations: /5/2, /5/3, verify-results/4/4 (sa-push-changes.service.ts:56-115, :126-170, :30,
  // :91-101). The footer is STRINGS.PUSH_N_CHANGES_TO_LYNX "Push {{num}} changes to Lynx", which has
  // no uncounted form, so the button is named by its place. The push-window tip stays.
  s = step(s, h, {
    guide,
    title: 'Send and watch the progress',
    body: 'Spatial Adjust writes station by station first, then reads the adjustments back from Lynx and checks each '
      + 'one against what it sent. Failed stations are retried automatically before the run is declared finished.',
    expect: { tip: PUSH_WINDOW },
    set: {
      do: 'Select the footer button of the [[Push Changes]] dialog, such as Push 6 changes to Lynx.',
      see: 'A progress window counts the stations as they are written to Lynx.',
      ifNot: 'If the bar drops back to 0 near the end, a retry has begun for the stations that failed. Let it run.',
      why: 'Spatial Adjust writes each station, reads Lynx back to check it, and retries any that do not match.',
    },
  });

  // Success line, failure line naming the count, then Close: /6/2, /6/3, /6/4
  // (sa-main-toolbar.component.html:142, :155-164; en-us.json:413, :418).
  s = step(s, h, {
    guide,
    title: 'Confirm the result',
    body: 'A successful run confirms every selected change reached Lynx. A failure names the number of stations that '
      + 'could not be updated. Check the Lynx connection, then reopen Push Changes: the failed stations are listed '
      + 'under Pushed Today, unticked, so tick them to send them again.',
    set: {
      do: 'Read the result line above [[Close]].',
      see: 'It reads [[All selected changes successfully pushed to Lynx.]]',
      ifNot: 'If it names stations that could not be updated, check the connection to Lynx, then follow Push failures.',
    },
  });

  // Step 2 now names the toolbar button and step 4 the tick boxes, so the points move with them.
  return h.editTargets(s, {
    name: 'rewrite: push-to-lynx targets',
    guide,
    expect: '[P.push, P.pushRow, P.pushReview, P.pushFooter, P.progressBar, P.progressClose]',
    replace: '[P.push, P.push, P.pushReview, P.pushBox, P.pushFooter, P.progressClose]',
  });
}

// --- Reviewing changes ---------------------------------------------------------------------------

/** start: push-to-lynx/before/1; a change must be waiting, or the button is disabled
 *  (reviewing-changes/1/3). */
function reviewingChanges(src, h) {
  const guide = 'reviewing-changes';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'No dialog open.',
    needs: 'Lynx must be reachable, and at least one station must have a change waiting.',
  });

  // /1/2, /1/3, push-to-lynx/1/4 (sa-main-toolbar.component.html:34-40, sa-main-toolbar.component.ts:251-253).
  s = step(s, h, {
    guide,
    title: 'Open Push Changes',
    body: 'The button carries the number of enabled stations whose % Adj. differs from what Lynx holds, whether you '
      + 'edited it or left the suggestion, leaving out any already pushed today. It is disabled when nothing is '
      + 'queued, so a greyed-out button means there is nothing to review.',
    set: {
      do: 'Select [[Push Changes]] at the right of the toolbar.',
      see: 'The [[Push Changes]] dialog opens and lists every station waiting to be sent.',
      ifNot: 'If [[Push Changes]] is greyed out, nothing is waiting or a push is still running. Wait for the push to finish, then try again.',
    },
  });

  // /2/2, /2/3 (sa-confirm-push-dlg.component.html:50-53, :74-86). Nothing is written until the
  // footer button, and Cancel closes the dialog: /before/1, /before/2
  // (sa-confirm-push-dlg.component.ts:70-82).
  s = step(s, h, {
    guide,
    title: 'Read Current against Changes',
    body: 'The left column is what Lynx holds now; the right is what will replace it. Both name the station, so you '
      + 'are always comparing the same head across the row.',
    set: {
      do: 'Read each row from [[Current]] on the left to [[Changes]] on the right.',
      see: 'Both sides name the same station: what Lynx holds now, then what will replace it.',
      ifNot: 'If a value looks wrong, select [[Cancel]] and fix it in the table first. Nothing has been sent yet.',
    },
  });

  // /3/2, /3/3, /3/4, /3/5 (sa-confirm-push-dlg.component.html:101-136, sa-confirm-push-dlg.component.ts:23-26;
  // spatial-adjust.util.ts:10-14, date.util.ts:81-93).
  s = step(s, h, {
    guide,
    title: 'Treat the two lists differently',
    body: 'Available to Push comes first, ticked. Pushed Today follows, unticked, and is there to stop you adjusting '
      + 'the same head twice in a day. That hold releases at midnight where the course is, not 24 hours after the '
      + 'push. Tick a pushed station only when you mean to.',
    set: {
      do: 'Find the [[Pushed Today]] list below Available to Push.',
      see: 'Its rows are unticked, so they are not sent unless you tick them.',
      ifNot: 'If you need to change one of those stations again today, tick its row.',
      why: 'The hold stops you adjusting the same head twice, and it ends at midnight where the course is.',
    },
  });

  // /4/2 (sa-confirm-push-dlg.component.html:32-42, :84-86); Review Threshold sends nothing:
  // push-to-lynx/3/3 (sa-confirm-push-dlg.component.ts:99-102).
  s = step(s, h, {
    guide,
    title: 'Check for threshold rewrites',
    body: 'When a minimum threshold is set, the banner counts the stations it will rewrite and the affected rows show '
      + 'both the original and the value that will actually be sent.',
    set: {
      do: 'Find the pink banner above the lists, with the [[Review Threshold]] link.',
      see: 'Each row the threshold changed shows its own value and, after Adjusted to, the value that will be sent.',
      ifNot: 'If there is no banner, the threshold changed no station or is set to 0.',
      why: '[[Review Threshold]] closes this dialog without sending, so you can fix the threshold first.',
    },
  });

  // /5/2, /5/3 (sa-confirm-push-dlg.component.html:144, sa-confirm-push-dlg.component.ts:74-97). The
  // push-window tip stays.
  s = step(s, h, {
    guide,
    title: 'Trust the footer count',
    body: 'The footer button names the number of ticked rows, and that is exactly what will be sent. Unticking a row '
      + 'is not the same as reverting it — the edit stays in the table for next time.',
    expect: { tip: PUSH_WINDOW },
    set: {
      do: 'Read the count on the footer button of the [[Push Changes]] dialog.',
      see: 'It matches the rows you ticked, and that is exactly what will be sent.',
      ifNot: 'If the count is higher than you expect, untick the rows you do not want. Their edits stay in the table for next time.',
    },
  });
  return s;
}

// --- Verify results ------------------------------------------------------------------------------

/** start: push-to-lynx/before/1 and /before/4; the progress window opens from the footer button
 *  (sa-main-toolbar.component.ts:255-270). */
function verifyResults(src, h) {
  const guide = 'verify-results';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'The push progress window, just after you select the footer button of the [[Push Changes]] dialog.',
    needs: PUSH_NEEDS,
  });

  // The line is SPATIAL_ADJUST.LYNX_PUSH_PUSHING "Pushing Percent Adjustments to Lynx ({{index}} of
  // {{count}})", counted, so the step is a region step on the bar. /1/3, /1/4, /1/5
  // (sa-push-changes.service.ts:145-161, sa-main-toolbar.component.ts:269, :418-419; en-us.json:415).
  // The push-window tip stays.
  s = step(s, h, {
    guide,
    title: 'It writes first, station by station',
    body: 'Nothing is read before the push begins. Stations are written in sequence with a short pause between each, '
      + 'and the progress line names which one it is on. On a large course writing takes a while, at least a tenth '
      + 'of a second per station, but its counter runs on a fixed timer and does not wait for Lynx. If a run '
      + 'stalls, it stalls in the next phase, while Spatial Adjust waits for Lynx to answer.',
    expect: { tip: PUSH_WINDOW },
    set: {
      do: 'Watch the line under the progress bar as each station is written.',
      region: true,
      see: 'It reads Pushing Percent Adjustments to Lynx with a count, such as 4 of 6, and the bar fills at a steady pace.',
      ifNot: 'If the bar seems slow on a large course, that is normal: each station takes at least a tenth of a second.',
      why: 'This phase cannot stall, because its count runs on a timer and does not wait for Lynx.',
    },
  });

  // /2/2, /2/3, /1/5 (sa-push-changes.service.ts:162-170, sa-main-toolbar.component.ts:420-421;
  // en-us.json:416). The bar moves on only when Lynx answers (sa-push-changes.service.ts:56-65).
  s = step(s, h, {
    guide,
    title: 'Then it reads Lynx back',
    body: 'With the writing done, Spatial Adjust retrieves the current percent adjustments from Lynx. This is a '
      + 'read-back, not a baseline — it is collecting what Lynx actually holds now so the next phase has '
      + 'something to check the push against.',
    set: {
      do: 'Look for [[Retrieving latest Percent Adjustments from Lynx for comparison]] under the bar.',
      see: 'The bar holds still while Spatial Adjust reads back what Lynx now holds.',
      ifNot: 'If the run stalls here, Spatial Adjust is waiting for Lynx to answer. If it never moves on, check the connection to Lynx.',
    },
  });

  // /3/2, /3/3 (sa-push-changes.service.ts:56-81, sa-main-toolbar.component.ts:422-423; en-us.json:419).
  s = step(s, h, {
    guide,
    title: 'Then it verifies',
    body: 'Spatial Adjust re-reads the station list and compares each value it sent against what Lynx now reports. '
      + 'Anything that does not match is treated as failed rather than assumed good.',
    set: {
      do: 'Look for [[Verifying adjustments sent to Lynx]] under the bar.',
      see: 'The bar moves forward while each value sent is checked against what Lynx now reports.',
      ifNot: 'If a value does not match, the station is treated as failed, and the next phase retries it.',
    },
  });

  // SPATIAL_ADJUST.LYNX_PUSH_RETRYING "Push Changes failed for {{count}} station(s). Retrying" is
  // counted, so this is a region step on the bar. /4/2, /4/3, /4/4 (sa-push-changes.service.ts:30,
  // :91-101; sa-main-toolbar.component.ts:424-425; en-us.json:417).
  s = step(s, h, {
    guide,
    title: 'Failures are retried automatically',
    body: 'Stations that did not take are re-pushed, up to two further attempts after the first. The progress line '
      + 'names how many are being retried, so a retry is information rather than an error. The bar restarts at '
      + 'zero for the retry pass and counts only the failed stations, so a drop from nearly complete back to '
      + 'nothing is the retry beginning, not the push collapsing.',
    set: {
      do: 'Watch for the bar to drop back to 0.',
      region: true,
      see: 'The bar restarts at zero and counts only the stations being retried, and the line says how many.',
      ifNot: 'If the bar drops from nearly full to 0, that is the retry starting, not the push failing.',
      why: 'Each failed station is tried up to 2 more times before the result is shown.',
    },
  });

  // /5/2 (sa-push-changes.service.ts:108-110, sa-main-toolbar.component.html:142, :155-164;
  // en-us.json:413, :418).
  s = step(s, h, {
    guide,
    title: 'Read the outcome',
    body: 'A clean run confirms that every selected change reached Lynx and verified. Back on the dashboard, Push '
      + 'Changes no longer counts the stations you sent, and the pushed-today counter has grown by what you sent.',
    set: {
      do: 'Read the result line above [[Close]].',
      see: 'It reads [[All selected changes successfully pushed to Lynx.]]',
      ifNot: 'If it names stations that could not be updated, select [[Close]] and follow Push failures.',
      why: 'Success means every change was read back from Lynx and matched what was sent.',
    },
  });
  return s;
}

// --- Filter by % Adj. ----------------------------------------------------------------------------

/** start: dashboard-overview/before/1. */
function filterAdjustments(src, h) {
  const guide = 'filter-adjustments';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'No dialog open.',
    needs: 'A Spatial Adjust account on a site with TurfRad scan data.',
  });

  // /1/2, /1/3, /1/4 (sa-table-threshold-filter.component.html:2-16; sa-dashboard.component.ts:749-752).
  s = step(s, h, {
    guide,
    title: 'Read the two tabs',
    body: 'All Stations carries the full count. Beside it, the Over/Under tab carries the count of stations the filter '
      + 'currently catches. Until you set a filter that count is a dash and the tab does nothing — it is not broken, '
      + 'there is simply nothing to show yet.',
    set: {
      do: 'Find the [[All Stations]] and [[Over/Under]] tabs above the table.',
      see: '[[All Stations]] shows the full count, and [[Over/Under]] shows how many stations the filter catches.',
      ifNot: 'If [[Over/Under]] shows a dash, no filter is set yet. It is not broken; the next steps set one.',
    },
  });

  // /2/2, /2/3, /2/4 (sa-table-threshold-filter.component.html:18-36, sa-table-threshold-filter.component.ts:95-103,
  // :120-134). Bulk Adjust does nothing but show its tooltip until stations are ticked
  // (sa-table-threshold-filter.component.html:19-23; SPATIAL_ADJUST.BULK_ADJUST_BTN_TOOLTIP).
  s = step(s, h, {
    guide,
    title: 'Open the options',
    body: 'The link below the two tabs, beside Bulk Adjust, states the thresholds currently in force — % ADJ. OVER '
      + '200%, UNDER 10% — so you can read the filter without opening it. Clicking it opens Over/Under Options.',
    set: {
      do: 'Select the link below the tabs, to the right of [[Bulk Adjust]].',
      see: '[[Over/Under Options]] opens, with an [[Over]] value and an [[Under]] value.',
      ifNot: 'If a tip about selecting stations appears, you chose [[Bulk Adjust]]. Select the link to its right.',
      why: 'Once a filter is set, the link shows the thresholds in force, so you can read it without opening it.',
    },
  });

  // /3/2, /3/3, /3/4 (sa-cfg-threshold-dlg.component.html:21-62; sa-adjust-threshold.model.ts:9-12).
  s = step(s, h, {
    guide,
    title: 'Set the two ends independently',
    body: 'Over accepts 0 to 300 and defaults to 200. Under accepts 0 to 100 and defaults to 10. Each has its own '
      + 'checkbox, so you can run one end without the other — Over alone to find the stations asking for far too '
      + 'much, Under alone to find the ones asking for almost nothing.',
    set: {
      do: 'Tick [[Over]], [[Under]] or both.',
      see: 'Each ticked end takes a value: [[Over]] from 0 to 300, default 200, and [[Under]] from 0 to 100, default 10.',
      ifNot: 'If a value box stays grey, its end is not ticked. Tick it, then type the value.',
      why: 'Use [[Over]] alone to find stations asking for far too much, or [[Under]] alone for almost nothing.',
    },
  });

  // /4/2 to /4/5 and the dropped tip /4/7 (sa-dashboard.component.ts:791). The tab is the
  // SPATIAL_ADJUST.FILTER_OVER_UNDER label (sa-table-threshold-filter.component.html:9-16).
  s = step(s, h, {
    guide,
    title: 'It catches both extremes, not a band',
    body: 'A station is caught if its suggestion is above the Over value OR below the Under value. With 200 and 10 set '
      + 'you get everything over 200 percent and everything under 10 percent — and nothing in between. It is an '
      + 'outlier finder. Reading it as “between 10 and 200” gives you exactly the stations it is not showing you.',
    expect: {
      tipLabel: 'Why it matters.',
      tip: 'These are the two lists worth a second look before a push: the ones about to get a great deal of water, '
        + 'and the ones about to get almost none.',
    },
    set: {
      do: 'Select the [[Over/Under]] tab.',
      see: 'The table lists the stations above [[Over]] or below [[Under]], and none in between.',
      ifNot: 'If you expected a range, read it again: 200 and 10 show everything over 200% and everything under 10%.',
      why: 'These are the stations worth a second look before a push: those about to get a great deal of water, '
        + 'and those about to get almost none.',
    },
    drop: ['tipLabel', 'tip'],
  });

  // /5/2, /5/3 (sa-cfg-threshold-dlg.component.html:65-72; sa-dashboard.component.ts:758, :792). The
  // "Not the same setting." tip is a warning and stays: /5/6, /5/7, /5/8.
  s = step(s, h, {
    guide,
    title: 'Exclude Zeros belongs to Under',
    body: 'Exclude Zeros is greyed out until Under is enabled, because a zero is below any under-threshold and the '
      + 'option means nothing without one. Tick it and genuine zeros drop out of the filter, leaving the stations '
      + 'that asked for a little rather than the ones that asked for nothing. Your thresholds are saved to your own '
      + 'user preferences, not to the site.',
    set: {
      do: 'Tick [[Exclude Zeros]] below [[Under]] if you want to hide true zeros.',
      see: 'Stations suggesting 0 drop out of the filter, and those asking for a little stay.',
      ifNot: 'If [[Exclude Zeros]] is greyed out, tick [[Under]] first.',
    },
  });

  // Exclude Zeros belongs inside the dialog, before it is saved: it moves up above the tab step.
  s = moveStepBefore(s, h, {
    name: 'rewrite: filter-adjustments moves "Exclude Zeros belongs to Under" before the tab',
    title: 'Exclude Zeros belongs to Under',
    before: 'It catches both extremes, not a band',
  });

  // New step. Save Changes saves the thresholds to the user's own preferences, shows a saved message
  // and closes the dialog; Cancel closes it unchanged (sa-cfg-threshold-dlg.component.html:76-79,
  // sa-cfg-threshold-dlg.component.ts:95-117, sa-table-threshold-filter.component.ts:105-114). Saved
  // per user: /5/4 (dash-user-preferences.model.ts:37, :82).
  s = insertStepAfter(s, h, {
    name: 'rewrite: filter-adjustments new step "Save the filter"',
    after: 'Exclude Zeros belongs to Under',
    literal: "{ title: 'Save the filter', fig: 'dlgSmall', dialog: 'filter' }",
  });
  s = h.editStep(s, {
    name: 'rewrite: filter-adjustments step "Save the filter"',
    guide,
    title: 'Save the filter',
    expect: { body: null, do: null },
    set: {
      do: 'Select [[Save Changes]].',
      see: 'A message confirms the thresholds were saved, and the link below the tabs shows them.',
      ifNot: 'If you select [[Cancel]], nothing changes. Open the options again to set them.',
      why: 'Your thresholds are saved for you alone, not for the site.',
      caption: 'Over/Under Options, with Save Changes and Cancel at the foot.',
    },
  });

  return h.editTargets(s, {
    name: 'rewrite: filter-adjustments targets',
    guide,
    expect: '[P.tabAll, P.filterLink, P.filterLink, P.tabOver, P.excludeZeros]',
    replace: '[P.tabAll, P.filterLink, P.filterOver, P.excludeZeros, P.filterSave, P.tabOver]',
  });
}

/** Applies every Review & Apply rewrite, in order. Registered in src/rewrite/index.mjs. */
export function apply(src, h) {
  let s = points(src, h);
  s = suggestedAdjustments(s, h);
  s = pushToLynx(s, h);
  s = reviewingChanges(s, h);
  s = verifyResults(s, h);
  s = filterAdjustments(s, h);
  return s;
}
