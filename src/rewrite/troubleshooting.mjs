// Followability rewrites for the Troubleshooting category: Why is this station 0%?, Threshold
// questions, Calculation questions, Push failures, and Get fresh scan data (which
// src/transform-export.mjs adds to the category).
//
// A troubleshooting step is a check, so the three fields mean:
//   do      the check to make
//   see     the healthy result, the thing that means this is not the cause
//   ifNot   the cause when the result is not healthy, and the fix or the next check
//
// Each rewrite is anchored on the step's exact current text (after every correction in
// src/transforms/), so an accuracy fix to a sentence this file replaces fails the build here
// rather than being overwritten. The corrections that this category carries stay intact:
// the pushed-today hold and the failed stations that return unticked (docs/text-corrections.md
// sections 5 and 18), the push phase order and the retry bar that restarts at zero (6, 7), the
// diagnostics chord that works on a healthy dashboard (27), the threshold that never touches the
// table (20), and Request latest scan data fetching what TurfRad holds (22).
//
// Every label in [[ ]] is a key of src/i18n/labels.en-us.json and is named by a Verified claim.
// Every statement is checked against IntelliDash at the production pin in docs/claims/sources.json
// and against the guide's claims ledger shard, docs/claims/guides/<key>.json. The ledger IDs below
// are the ones the ledger held before this rewrite. Paths are IntelliDash paths at the pin, cited
// by line, never quoted.
//
// The diagnostics dialog. Its label text is hardcoded English and not in the label fixture, so it
// is plain text. The way to open it is the same in every guide that uses it: hold Shift + Alt and
// click the Spatial Adjust logo (sa-main-toolbar.component.ts:293-299). The handler ignores the
// chord only while Lynx has neither failed nor been contacted, and the dashboard contacts Lynx a
// second or so after the page loads, so the dialog also opens on a healthy dashboard
// (station-zero/5/3; docs/text-corrections.md section 27). The logo is not a labelled control, so
// each of these steps is a region step.

const DASHBOARD = 'The Spatial Adjust dashboard, at /spatialadjust.';
const TURFRAD_NEEDS = 'A Spatial Adjust account on a site with TurfRad scan data.';
const PUSH_WINDOW = 'Push between 11 AM and the synchronization time set in Lynx, and synchronize Lynx after '
  + 'the push. Outside that window the push does not reach the course, and no error tells you so.';
const DIAGNOSTICS_OPENS = 'The dialog opens a second or so after the page loads, and also when Lynx data has failed to load.';

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
 *  reloadData is the Reload Data button of the scan-data banner. scanDate is the scan date on the
 *  first station's row, and scanDateStale the date on the sixth, which is the stale one. pushOldBox
 *  is the tick box of the first row under Pushed Today. Another
 *  module can add its own points the same way, because the anchor stays intact. */
function points(src, h) {
  return h.edit(src, {
    name: 'rewrite: Troubleshooting cursor points',
    pattern: /const P = \{\n/,
    replace: () => 'const P = {\n  reloadData: [1013, 108], scanDate: [1414, 556], scanDateStale: [1414, 806],\n  pushOldBox: [1290, 715],\n',
  });
}

// --- Why is this station 0%? -----------------------------------------------------------------------

function stationZero(src, h) {
  const guide = 'station-zero';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'No dialog open. The table shows the station rows of the hole that has the zero.',
    needs: `${TURFRAD_NEEDS} A station whose suggestion is 0.`,
  });

  // Check 1. Under Option 2 a station wetter than its target by more than today's crop-adjusted ET
  // needs no water, so Suggested is 0: station-zero/1/3, /1/4 (SpatialAdjustService.cs:3037-3039).
  // How common this cause is stays out: /1/2 is Needs expert.
  s = step(s, h, {
    guide,
    title: 'Check whether the station is already wet',
    body: 'This is the common answer. When measured VWC is comfortably above the station target, the required '
      + 'amount is zero and so is the suggestion. Station 10AP1 read 34.5 percent against a target of 16 — it '
      + 'does not need water today.',
    set: {
      do: 'On the station’s row, compare [[Avg. VWC]] with [[Target VWC]].',
      see: '[[Avg. VWC]] is well above [[Target VWC]], so the station needs no water today and 0 is correct.',
      ifNot: 'If [[Avg. VWC]] is near or below [[Target VWC]], the zero has another cause. Go on to the next check.',
      why: 'Under [[Option 2]], a station wetter than its target by more than today’s ET asks for no water.',
    },
  });

  // Check 2. The threshold rewrites a small pending % Adj. to 0 only in the push dialog and in what
  // is sent, and the table keeps the raw value: /2/2, /2/3, /2/4 (sa-push-changes.service.ts:207;
  // minimum-threshold/before/4: at 0 the feature is off). Changing it needs Save Changes, which
  // saves every tab together (minimum-threshold/5/*).
  s = step(s, h, {
    guide,
    title: 'Check the minimum threshold',
    body: 'With Set to zero when pushed to Lynx selected, a small but genuine adjustment is written to Lynx as 0%. '
      + 'The table still shows the raw value, so the two disagree. Switch the option to set to the minimum '
      + 'threshold value if you want those stations to keep running.',
    set: {
      do: 'In [[Settings]], on the [[Minimum Threshold]] tab, read the [[Minimum Threshold (%)]] box and the option below it.',
      see: 'The box reads 0, or reads less than the station’s [[% Adj.]], so the threshold is not the cause.',
      ifNot: 'If [[Set to zero when pushed to Lynx]] is selected, small changes go to Lynx as 0. '
        + 'To keep those stations running, select [[Set to the minimum threshold value when pushed to Lynx]], then select [[Save Changes]].',
    },
  });

  // Check 3. A disabled station is left out of every push, so Lynx keeps what it holds; its
  // suggestion is still calculated, so being off does not by itself explain a zero. An area or
  // hole switch above it can be off too: /3/2, /3/3, /3/4 (sa-dashboard.component.ts:615-619).
  // The column is "Enable": enable-disable-stations/where/1.
  s = step(s, h, {
    guide,
    title: 'Check whether the station is disabled',
    body: 'A station with the Enable switch off is left out of every push, so Lynx keeps whatever percent adjust it '
      + 'already holds. Its suggestion is still calculated and shown, so being disabled does not by itself explain '
      + 'a zero. Disabling an area or hole cascades down, so a station can be off because something above it was '
      + 'turned off.',
    set: {
      do: 'Look at the [[Enable]] switch on the station’s row.',
      see: 'The switch is on, so the station is part of every push.',
      ifNot: 'If the switch is off, Lynx keeps the value it holds, but the suggestion is still calculated. '
        + 'Check the area and hole switches above the station too.',
    },
  });

  // Check 4. The date sits under the station name, today's date means a current scan, and an older
  // one means a modelled value in grey italics with a calculator icon: /4/2, /4/3. A stale whole
  // course means TurfRad has not delivered yet, and Request latest scan data fetches what TurfRad
  // holds, then Reload Data brings it in: /4/4, /4/5 (en-us.json:454, :457;
  // sa-main-toolbar.component.ts:211; sa-table-card.component.html:24, :29-31).
  s = step(s, h, {
    guide,
    title: 'Check the scan date',
    body: 'A scan date older than today means the reading is stale. Spatial Adjust falls back to the modelled value, '
      + 'shown in grey italics with a calculator icon. If the whole course is stale, TurfRad has not delivered new '
      + 'scans yet. Use Request latest scan data in the toolbar to queue a retrieval — it takes several minutes and '
      + 'notifies you when it lands, then Reload Data on the banner brings it in.',
    set: {
      do: 'Read the scan date under the station’s name.',
      region: true,
      see: 'The date is today, so [[Avg. VWC]] comes from a current scan.',
      ifNot: 'If the date is older, [[Option 2]] shows a modeled [[Avg. VWC]], in gray italics. '
        + 'If every station is old, select [[Request latest scan data]] in the toolbar, then [[Reload Data]] on the banner.',
    },
  });

  // Check 5. The chord and what the dialog reports: /5/2, /5/3, /5/4 (sa-diagnostics-dlg.component.html:30,
  // :34, :38, :52; SpatialAdjustService.cs:141-171). verify/2: the date is today, or you know why not.
  // The open rule is in the ifNot: it also opens on a healthy dashboard.
  s = step(s, h, {
    guide,
    title: 'Confirm the data path',
    body: 'If nothing above explains it, open the diagnostics dialog by holding Shift + Alt and clicking the Spatial '
      + 'Adjust logo. It opens on a healthy dashboard once Spatial Adjust has contacted Lynx, which happens a second '
      + 'or so after the page loads, and it also opens when Lynx data has failed to load. It reports whether the org '
      + 'has TurfRad access, whether it has scan data at all, the last scan date, and whether Lynx is reachable.',
    set: {
      do: 'Hold Shift + Alt and click the Spatial Adjust logo.',
      region: true,
      see: 'The diagnostics dialog opens and reports TurfRad access, scan data and the last scan date, which is today.',
      ifNot: 'If the last scan date is not today, no scan from today has reached Spatial Adjust yet. '
        + 'If nothing opens, wait a second or so after the page loads and click again.',
      why: DIAGNOSTICS_OPENS,
    },
  });

  // Step 1 now points at the two VWC columns of station 10AP1, the example, and step 4 at the scan
  // date of the stale station.
  return h.editTargets(s, {
    name: 'rewrite: station-zero targets',
    guide,
    expect: "[cell('sugg', 6), P.threshInput, cell('en', 4), cell('vwc', 5), P.diagBox]",
    replace: "[cell('vwc', 8), P.threshInput, cell('en', 4), P.scanDateStale, P.diagBox]",
  });
}

// --- Threshold questions -----------------------------------------------------------------------------

function thresholdQuestions(src, h) {
  const guide = 'threshold-questions';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'No dialog open.',
    needs: `${TURFRAD_NEEDS} The threshold is a site setting, so it applies to every user on the site.`,
  });

  // The table never shows the threshold: /1/3 (sa-main-toolbar.component.ts:433-460;
  // docs/text-corrections.md section 20).
  s = step(s, h, {
    guide,
    title: 'The table shows the raw suggestion',
    body: 'Station 11AP2 suggests 6 percent. With a 10 percent threshold set, the table still shows 6, and it always '
      + 'will: the threshold is applied only in the Push Changes dialog and to what is sent to Lynx, never to the '
      + 'table.',
    set: {
      do: 'Read [[Suggested]] for the station in the table.',
      see: 'With a threshold of 10, a station that suggests 6 still shows 6 here.',
      ifNot: 'If you expected the threshold here, it is applied only in the [[Push Changes]] dialog and to what is sent to Lynx.',
    },
  });

  // The push dialog shows the original, an arrow and Adjusted to the new value, and the banner
  // counts the rows affected, including rewritten rows already pushed today: /2/2, /2/3
  // (sa-confirm-push-dlg.component.html:32-42, :84-86; sa-confirm-push-dlg.component.ts:28). The
  // difference is on purpose (en-us.json:471). No banner means no threshold or no row below it: /5/3.
  s = step(s, h, {
    guide,
    title: 'The push dialog shows what will be sent',
    body: 'Open Push Changes and the same station shows its original value and the rewritten one side by side, with '
      + 'the banner counting how many rows were affected. This is the disagreement, and it is intentional.',
    set: {
      do: 'In the [[Push Changes]] dialog, find the station’s row.',
      see: 'The row shows the original value, then Adjusted to and the value that will be sent, and a pink banner counts the rows changed.',
      ifNot: 'If the dialog is not open, select [[Push Changes]] at the right of the toolbar. If there is no banner, see the last step.',
      why: 'The table and this dialog differ on purpose: the threshold applies only to what is sent.',
    },
  });

  // The two options are opposite: /3/2, /3/3, /3/4 (SpatialAdjustService is not involved; the rules
  // run in the browser, sa-main-toolbar.component.ts:442-453). Set to zero sends the station with 0,
  // it does not leave it out of the push (/3/2 note). The options are greyed out at 0: /5/2.
  s = step(s, h, {
    guide,
    title: 'Choose what below-threshold means',
    body: 'Set to zero skips the station: Lynx receives 0 percent. Set to the minimum threshold value lifts the '
      + 'suggestion up to the threshold so the station still gets a short run. They are opposite behaviours from '
      + 'the same number.',
    set: {
      do: 'Find the two options under [[Minimum Threshold (%)]] on the [[Minimum Threshold]] tab of [[Settings]].',
      see: '[[Set to zero when pushed to Lynx]] sends 0 to Lynx, and [[Set to the minimum threshold value when pushed to Lynx]] sends the threshold.',
      ifNot: 'If both options are grayed out, the threshold is 0, which turns the feature off.',
    },
  });

  // Exclude Zeros only with the second option; a true zero stays at zero: /4/2, /4/3, /4/4.
  s = step(s, h, {
    guide,
    title: 'Exclude Zeros protects genuine zeros',
    body: 'Available only under the second option: a station whose suggestion is a true zero stays at zero instead '
      + 'of being lifted to the threshold. Without it, a station that needs no water gets a small run anyway.',
    set: {
      do: 'Find [[Exclude Zeros]] below the two options.',
      see: 'Tick it, and a station at a true zero stays at 0 instead of being lifted to the threshold.',
      ifNot: 'If [[Exclude Zeros]] is grayed out, select [[Set to the minimum threshold value when pushed to Lynx]] first.',
      why: 'Without it, a station that needs no water still gets a small run.',
    },
  });

  // Zero turns the feature off and greys the options: /5/2, /5/3. It is a site setting, so someone
  // else may have cleared it. The sticky tab: /5/5, until the page reloads (minimum-threshold/1/3,
  // docs/text-corrections.md section 28). It is advice rather than a warning, so it is a why line.
  s = step(s, h, {
    guide,
    title: 'Zero disables the feature',
    body: 'A threshold of zero turns the whole thing off and the option group is disabled with it. If the push '
      + 'dialog shows no banner, check this first — the setting is site-level and someone else may have cleared it.',
    expect: {
      tipLabel: 'Sticky tab.',
      tip: 'Once you have opened Settings via Review Threshold, the gear button keeps opening on the Minimum '
        + 'Threshold tab for the rest of the session.',
    },
    set: {
      do: 'Read the [[Minimum Threshold (%)]] box.',
      see: 'It holds a number above 0, so the threshold is on and the banner can show.',
      ifNot: 'If it reads 0, the threshold is off and the options are grayed out. '
        + 'The setting is site-wide, so someone else may have cleared it.',
      why: 'After you use [[Review Threshold]], the gear button opens on this tab until the page is reloaded.',
    },
    drop: ['tipLabel', 'tip'],
  });

  return s;
}

// --- Calculation questions ----------------------------------------------------------------------------

function calculationQuestions(src, h) {
  const guide = 'calculation-questions';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'No dialog open. The table shows station rows.',
    needs: TURFRAD_NEEDS,
  });

  // The cap makes a run of equal suggestions, Option 2 only: /1/2, /1/3
  // (SpatialAdjustService.cs:3041-3043; sa-settings-dlg.component.html:82-95).
  s = step(s, h, {
    guide,
    title: 'Identical suggestions across many stations',
    body: 'When the required amount exceeds the daily maximum, every station above the cap lands on the same '
      + 'percentage. A run of identical numbers means the cap is deciding, not the scan.',
    set: {
      do: 'Look down the [[Suggested]] column for a run of the same value.',
      see: 'Many stations show the same value, which means the daily cap is deciding, not the scan.',
      ifNot: 'If the values all differ, the cap is not involved. Check whether each value is measured, modeled or a dash.',
      why: 'Under [[Option 2]], every station that needs more than the daily cap lands on the same percentage.',
    },
  });

  // The ceiling is Daily Max Amount over Lynx Reference Amount, times 100, rounded; Option 2 only;
  // 10 / 3 gives 333 and 12 / 3 gives 400: /2/2, /2/3, /2/5, /2/6 (calculation-settings/*, the
  // field is SPATIAL_ADJUST.MAX_AMOUNT_IN_UNITS_X "Daily Max Amount ({{unitsAbbr}})", a counted
  // label, so plain text). Raising the cap moves only the ceiling: /2/3 note.
  s = step(s, h, {
    guide,
    title: 'Work out your own ceiling',
    body: 'The maximum possible suggestion is the daily maximum divided by the Lynx reference amount. Change either '
      + 'number and the ceiling moves — which is the honest fix if the ceiling is too low for your course.',
    expect: {
      tipLabel: 'Example.',
      tip: 'A 10 mm cap against a 3 mm reference gives 333 percent. Raising the cap to 12 mm gives 400.',
    },
    set: {
      do: 'On the [[Calculation]] tab of [[Settings]], divide Daily Max Amount by Lynx Reference Amount.',
      see: 'The result times 100 is the highest suggestion any station can show, such as 333 for 10 mm and 3 mm.',
      ifNot: 'If the ceiling is too low for your course, raise Daily Max Amount, then select [[Save Changes]]. '
        + 'Lowering Lynx Reference Amount raises every uncapped suggestion as well.',
      why: 'Only [[Option 2]] has a ceiling.',
    },
    drop: ['tipLabel', 'tip'],
  });

  // A dash means no current scan and no modelled value, not zero and not an error: /3/2, /3/3.
  // A zero means the calculation asked for no water: station-zero/before/1.
  s = step(s, h, {
    guide,
    title: 'A dash instead of a number',
    body: 'A dash means there is nothing to show: no current scan and no modelled value either. It is not zero, and '
      + 'it is not an error in the calculation — the station has no data to calculate from.',
    set: {
      do: 'Look for a dash in place of a number on a station’s row.',
      region: true,
      see: 'A dash means the station has no current scan and no modeled value, so there is nothing to calculate from.',
      ifNot: 'If the row shows 0 and not a dash, the calculation ran and asked for no water. Follow Why is this station 0%?',
      why: 'A dash is not zero, and it is not an error in the calculation.',
    },
  });

  // Grey italics are a value modelled from an older scan, Option 2 only; under Option 1 a station
  // without a scan today shows a dash: /4/2, /4/3, /4/4 (sa-table-card.component.html:29-31,
  // sa-table-card.component.less:100-110; SpatialAdjustService.cs:3031-3032; before/1).
  s = step(s, h, {
    guide,
    title: 'Grey italics mean modelled',
    body: 'A greyed, italic average means the value came from the model rather than a scan taken that day. The '
      + 'calculation still runs, but it is running on an estimate.',
    set: {
      title: 'Gray italics mean modeled',
      do: 'Look for an [[Avg. VWC]] value in gray italics.',
      see: 'The value is modeled, not taken from a scan that day, so the suggestion rests on an estimate.',
      ifNot: 'If the value is not gray and italic, it is a measurement from a scan taken today.',
      why: 'Only [[Option 2]] models a value; under [[Option 1]], a station with no scan today shows a dash.',
    },
  });

  // The whole course stale is a data-path matter: /5/2 to /5/5 (sa-diagnostics-dlg.component.html;
  // SpatialAdjustService.cs:141-171; docs/text-corrections.md sections 22 and 27). Request latest
  // scan data fetches only what TurfRad already holds, so the date stays old if there is nothing newer.
  s = step(s, h, {
    guide,
    title: 'If the whole course is stale, check the source',
    body: 'The diagnostics dialog reports whether the organisation has TurfRad access, whether it has scan data at '
      + 'all, and the last scan date. A course-wide problem is almost always here rather than in your settings. If '
      + 'TurfRad access and scan data are both fine and only the date is old, use Request latest scan data in the '
      + 'toolbar to fetch any scans TurfRad already holds rather than waiting for the next automatic fetch. It '
      + 'cannot make TurfRad scan, so if TurfRad has nothing newer the date will not change.',
    set: {
      do: 'Hold Shift + Alt and click the Spatial Adjust logo.',
      region: true,
      see: 'The diagnostics dialog reports TurfRad access, scan data and the last scan date, which is today.',
      ifNot: 'If the date is old but TurfRad access and scan data are fine, select [[Request latest scan data]] in the toolbar. '
        + 'It cannot make TurfRad scan, so the date stays old if TurfRad has nothing newer.',
      why: DIAGNOSTICS_OPENS,
    },
  });

  return s;
}

// --- Push failures ----------------------------------------------------------------------------------

function pushFailures(src, h) {
  const guide = 'push-failures';
  let s = start(src, h, guide, {
    page: DASHBOARD,
    open: 'The push progress window, after a push that ended with a failure.',
    needs: 'Lynx must be set up as Push changes to Lynx describes, with Site Adjust and Course Adjust both at 100% in Lynx.',
  });

  // The result line pairs a red icon with a count; it is SPATIAL_ADJUST.LYNX_PUSH_ERROR with a
  // count, so plain text: /1/2, /1/3, verify/1 (sa-main-toolbar.component.html:162,
  // sa-main-toolbar.component.ts:426-427; en-us.json:413-414). Only stations whose read-back still
  // differs are counted. If the read-back from Lynx fails, the window closes with no result:
  // /3/3 note (sa-main-toolbar.component.ts:174-178).
  s = step(s, h, {
    guide,
    title: 'Read the count, not the colour',
    body: 'The message names how many stations could not be updated. The rest of the push succeeded — a failure is '
      + 'partial, and the stations that verified are already live in Lynx.',
    set: {
      title: 'Read the count, not the color',
      do: 'Read the number in the result line above [[Close]].',
      see: 'The line names how many stations could not be updated, such as 2.',
      ifNot: 'If the window closed with no result, Spatial Adjust could not read Lynx back. Check the connection to Lynx.',
      why: 'A failure is partial: the stations that verified already match Lynx.',
    },
  });

  // Two further attempts, each re-sending only the stations that did not verify; the bar restarts
  // at 0 and counts only those: /2/2, /2/5 (sa-push-changes.service.ts:30, :91-101;
  // docs/text-corrections.md section 7). A hand push is a fourth attempt over the same route: /2/3,
  // the first half only; "rarely behaves differently" is Needs expert and is cut.
  s = step(s, h, {
    guide,
    title: 'Know what has already been tried',
    body: 'Failed stations are re-pushed automatically, up to two further attempts. Pushing again by hand '
      + 'immediately afterwards is a fourth attempt at the same connection, which rarely behaves differently.',
    set: {
      do: 'Look at the line under the progress bar while the failed stations are retried.',
      region: true,
      see: 'The line says the failed stations are being retried, and the bar restarts at zero and counts only those stations.',
      ifNot: 'If you push again by hand straight after a failure, that is a fourth attempt over the same connection. Check the connection first.',
      why: 'Each failed station is tried up to 2 more times before the failure is shown.',
    },
  });

  // Diagnostics lists the Lynx interconnect, Can ping cloud, Installation ID and Lynx course ID:
  // /3/2; a failing ping means a re-push cannot verify: /3/3 (cloud-service-base.ts:256, :372-463);
  // the amber banner above the toolbar: /3/5 (CONNECTION_LOST_MSG).
  s = step(s, h, {
    guide,
    title: 'Check the connection to Lynx',
    body: 'Diagnostics reports the Lynx interconnect, whether the cloud can be pinged, and the installation and '
      + 'course identifiers. If the ping is failing, no amount of re-pushing will help.',
    expect: {
      tipLabel: 'Also worth checking.',
      tip: 'When the connection drops, a banner appears above the toolbar and percent adjust values can be neither '
        + 'read nor written.',
    },
    set: {
      do: 'Hold Shift + Alt and click the Spatial Adjust logo.',
      region: true,
      see: 'The diagnostics dialog opens, and under Lynx, Can ping cloud shows true.',
      ifNot: 'If Can ping cloud shows false, or a banner above the toolbar says the connection to Lynx is lost, '
        + 're-pushing will not help. Check the connection to Lynx first.',
      why: DIAGNOSTICS_OPENS,
    },
    drop: ['tipLabel', 'tip'],
  });

  // Failed stations still count as pushed today, so they return under Pushed Today, unticked; the
  // ones that went through are not listed again: /4/2, /4/3, /4/4 (docs/text-corrections.md
  // section 18). The footer counts only ticked rows: push-to-lynx/4/2. The push-window tip stays.
  s = step(s, h, {
    guide,
    title: 'Re-push only the failures',
    body: 'The stations that failed are still pending, but they count as pushed today, so reopening Push Changes '
      + 'lists them under Pushed Today, unticked. Tick them to send them again. The stations that went through are '
      + 'not listed again, so the whole set cannot go out twice; untick anything under Available to Push that you '
      + 'did not mean to send.',
    expect: { tip: PUSH_WINDOW },
    set: {
      do: 'Under [[Pushed Today]], tick each station that failed.',
      see: 'The count on the footer button rises by 1 for each row you tick.',
      ifNot: 'If the dialog is closed, select [[Push Changes]] at the right of the toolbar. '
        + 'If rows under Available to Push are ticked that you did not mean to send, untick them.',
      why: 'The failed stations count as pushed today, so they come back unticked.',
    },
  });

  // Step 4 now names the Pushed Today rows, so its point moves to a tick box under Pushed Today.
  return h.editTargets(s, {
    name: 'rewrite: push-failures targets',
    guide,
    expect: '[P.progressBar, P.progressBar, P.diagLynx, P.pushFooter]',
    replace: '[P.progressBar, P.progressBar, P.diagLynx, P.pushOldBox]',
  });
}

// --- Get fresh scan data ----------------------------------------------------------------------------

function requestScanData(src, h) {
  const guide = 'request-scan-data';
  let s = start(src, h, guide, { page: DASHBOARD, open: 'No dialog open.', needs: TURFRAD_NEEDS });

  // The date is on every station row, and a column of old dates is a supply problem that no setting
  // changes: /1/2, /1/3 (sa-dash-table.component.ts:391-396; SpatialAdjustService.cs:2999).
  s = step(s, h, {
    guide,
    title: 'Read the scan date before anything else',
    body: 'Every station row carries the date its reading was captured. One stale row is a station; a column of '
      + 'stale dates is the whole course, and that is a supply problem rather than a settings problem.',
    set: {
      do: 'Look at the scan dates beside the station names in the table.',
      region: true,
      see: 'Each row shows the date its reading was captured, and the dates are today.',
      ifNot: 'If one date is old, that is one station. If every date is old, no setting will fix it, so go on to request the data.',
    },
  });

  // The button is a circular arrow, tooltip "Request latest scan data", that fetches what TurfRad
  // already holds; it does not order a scan or reload the page: /2/2, /2/3, /2/4 (en-us.json:454;
  // sa-main-toolbar.component.html:49-59). While a request is outstanding the button dims and its
  // icon spins: /3/3 note. The Note callout against Reload Data is a warning against a likely
  // mix-up and stays: /2/6, /2/7.
  s = step(s, h, {
    guide,
    title: 'Request the latest scan',
    body: 'The circular-arrow button in the toolbar’s right-hand group is Request latest scan data. It asks Spatial '
      + 'Adjust to fetch the latest scan data TurfRad already holds, ahead of the next automatic retrieval. It does '
      + 'not order a new scan, it does not reload the dashboard, and it does not change a single calculation setting.',
    expect: {
      tipLabel: 'Note.',
      tip: 'This button and Reload Data are two different things. One asks for new data; the other brings data '
        + 'that has already arrived into the page.',
    },
    set: {
      do: 'Select [[Request latest scan data]], the circular-arrow button in the toolbar.',
      see: 'The button dims and its icon spins while the request runs.',
      ifNot: 'If you cannot find it, look between the pushed-today counter and the gear.',
      why: 'It fetches only what TurfRad already holds, and it does not order a new scan.',
    },
  });

  // The toast reads Request Queued, then says retrieval may take several minutes and that you will
  // be notified; a failed request shows Request Failed at once: /3/2, /5/2 (en-us.json:452, :457,
  // :487; sa-main-toolbar.component.ts:338-341). The retrieval runs on the server and finishes
  // whether or not the page is open: /3/3 note.
  s = step(s, h, {
    guide,
    title: 'It queues, it does not block',
    body: 'The request is queued and you are told so: retrieval may take several minutes, and you are notified when '
      + 'it is ready. You can carry on reading the table while it runs — nothing is frozen and nothing is lost if '
      + 'you navigate away.',
    set: {
      do: 'Look for the [[Request Queued]] message.',
      see: 'It says retrieval may take several minutes and that you will be notified when it is ready.',
      ifNot: 'If [[Request Failed]] shows instead, the request did not queue. Select the button again.',
      why: 'You can keep reading the table while it runs, and the retrieval finishes even if you leave the page.',
    },
  });

  // The banner reads The requested scan data is ready, and offers Reload Data and Dismiss. Reload
  // Data loads what arrived and every suggestion recalculates; Dismiss only hides the banner and
  // the data stays stored: /4/2, /4/3, /4/4 (sa-main-toolbar.component.ts:207-213;
  // sa-dashboard.component.ts:280-286). The Careful callout is a warning and stays: /4/6, /4/7.
  s = step(s, h, {
    guide,
    title: 'Reload when the banner appears',
    body: 'When the retrieval finishes, a banner says so, whether or not TurfRad had a newer scan. Reload Data pulls '
      + 'it into the dashboard and every suggestion recalculates against the new readings. Dismiss closes the '
      + 'banner and leaves you on the data you already had — the new scan is not thrown away, it is simply not '
      + 'loaded yet.',
    expect: {
      tipLabel: 'Careful.',
      tip: 'Dismissing is not declining. The next reload picks the new scan up.',
    },
    set: {
      do: 'On the banner, select [[Reload Data]].',
      see: 'The dashboard loads the new readings, and every suggestion recalculates against them.',
      ifNot: 'If the banner has gone, [[Dismiss]] only hides it. The next time the dashboard loads its data, it picks the new scan up.',
      why: 'The banner appears whether or not TurfRad had a newer scan, so the numbers can come back unchanged.',
    },
  });

  // Diagnostics reports TurfRad access, scan data and the last scan date: /5/3 (the panel's checks
  // explain a course whose scans never arrive; sa-diagnostics-dlg.component.html:17-41,
  // sa-diagnostics-dlg.component.ts:61-89).
  s = step(s, h, {
    guide,
    title: 'If the request will not queue',
    body: 'A failed request says so straight away rather than silently doing nothing. If it keeps failing, the '
      + 'diagnostics dialog reports whether the organisation has TurfRad access and whether it has scan data at all '
      + '— a course-wide problem is almost always there rather than in your settings.',
    set: {
      title: 'If scans still do not arrive',
      do: 'Hold Shift + Alt and click the Spatial Adjust logo.',
      region: true,
      see: 'The diagnostics dialog reports TurfRad access, scan data and the last scan date.',
      ifNot: 'If access or scan data is missing, that explains scans that never arrive, and the cause is not in your settings.',
      why: DIAGNOSTICS_OPENS,
    },
  });

  // Step 1 points at the scan date under a station name, and step 4 at the banner's Reload Data.
  return h.editTargets(s, {
    name: 'rewrite: request-scan-data targets',
    guide,
    expect: '[P.moisture, P.refresh, P.refresh, P.refresh, P.diagBox]',
    replace: '[P.scanDate, P.refresh, P.refresh, P.reloadData, P.diagBox]',
  });
}

/** Applies every Troubleshooting rewrite, in order. Registered in src/rewrite/index.mjs. */
export function apply(src, h) {
  let s = points(src, h);
  s = stationZero(s, h);
  s = thresholdQuestions(s, h);
  s = calculationQuestions(s, h);
  s = pushFailures(s, h);
  s = requestScanData(s, h);
  return s;
}
