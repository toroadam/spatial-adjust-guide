// Followability rewrites for the Targets category: Understanding VWC, Editing station targets,
// Apply a bulk adjustment, and the four Target Profiles guides (Apply a target profile, Capturing
// profiles, Updating profiles, Managing seasonal profiles).
//
// Each rewrite turns every step of a guide into the Do / You should see / If not shape in
// docs/writing-guide.md, adds the guide's `start`, and re-authors its TARGETS entry when steps are
// added or removed. Every edit is anchored on the step's exact current text (after every
// correction in src/transforms/), so an accuracy fix to a sentence this file replaces fails the
// build here rather than being overwritten.
//
// Sources. Every [[label]] is a key of src/i18n/labels.en-us.json. Every sentence rests on
// Verified claims in docs/claims/guides/<key>.json, or on IntelliDash at the production pin in
// docs/claims/sources.json (1aa4f286), cited below as path:line under
// site/src/app/spatial-adjust/components/ unless another root is given. The re-extracted shards
// carry the same citations on each new claim.
//
// Target Profiles ships on production (sa-settings-dlg.component.ts:55; docs/text-corrections.md
// §11), so these guides describe it as shipped. The Settings-dialog steps they share are written
// once, below, so the same instruction reads the same way in every guide and is one catalogue
// string to translate.
//
// The step-list helpers at the top (insert before or after a step, remove a step) are also used
// by src/rewrite/getting-started.mjs. They work through h.editStep and h.edit, so every insertion
// and removal is anchored on the exact title of the step it sits beside.

/** Serialises a value as source, the way src/transform-export.mjs literal() does: single-quoted
 *  strings, arrays and plain objects. The guide data sits inside an inline <script>. */
export function lit(v) {
  if (typeof v === 'string') {
    if (/<\/script|<!--/i.test(v)) throw new Error('a rewrite string may not contain "</script" or "<!--"');
    return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + "'";
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean' || v === null) return String(v);
  if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
  if (v && typeof v === 'object') {
    const body = Object.entries(v).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : lit(k)}: ${lit(x)}`);
    return body.length ? `{ ${body.join(', ')} }` : '{}';
  }
  throw new Error(`cannot serialise a value of type ${typeof v}`);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Inserts `step` before or after the step titled `title` in `guide`, or removes that step.
 *  `title` is written as the source writes it (see h.editStep). The step is first marked through
 *  h.editStep, which proves it exists exactly once in that guide; the marker is then replaced by
 *  an h.edit that must match exactly once. A step is never inserted at an index: TARGETS is
 *  positional, so every caller re-authors the guide's TARGETS entry in the same rewrite. */
export function stepOp(src, h, { name, guide, title, op, step }) {
  const marked = h.editStep(src, { name: `${name} (mark)`, guide, title, set: { __rewriteMark: true } });
  const body = `\\{ title: '${escapeRe(title)}'((?:(?!\\{ title: )[\\s\\S])*?),\\s*__rewriteMark: true \\}`;
  if (op === 'remove') {
    return h.edit(marked, { name, pattern: new RegExp(`,\\s*${body}`), replace: () => '' });
  }
  if (op !== 'before' && op !== 'after') throw new Error(`${name}: unknown step operation "${op}"`);
  return h.edit(marked, {
    name,
    pattern: new RegExp(body),
    replace: (m, rest) => {
      const current = `{ title: '${title}'${rest} }`;
      return op === 'before' ? `${lit(step)},\n      ${current}` : `${current},\n      ${lit(step)}`;
    },
  });
}

// ---- strings shared by several guides ---------------------------------------------------------

export const PAGE_DASHBOARD = 'The Spatial Adjust dashboard, at /spatialadjust.';
export const NO_DIALOG = 'No dialog open.';
export const NEEDS_ACCOUNT = 'A Spatial Adjust account on a site with TurfRad scan data, on a desktop or tablet.';

/** Hole and area rows show Avg. Target VWC and Last Scan instead of the station columns
 *  (sa-dash-table/sa-dash-table.component.html:9-26), and selecting a hole row drills to its
 *  stations (ledger editing-station-targets/1/6; understanding-vwc/5/2). */
export const HOLE_LEVEL_IFNOT = 'If the row shows [[Avg. Target VWC]], it is a hole or area row. '
  + 'Select a hole row to see its stations.';

/** The station row's Target VWC input (sa-dash-table/sa-table-card/sa-table-card.component.html:40-47;
 *  ledger understand-spatial-adjust/3/5, understanding-vwc/3/2). */
export const FIND_TARGET_BOX = 'Find the [[Target VWC]] box on the same row.';

// The Settings dialog, opened from the gear in the toolbar's right-hand group
// (sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.html:33, :58-72, tooltip and text
// STRINGS.SETTINGS "Settings"; the Announcements button sits just left of it). The dialog is modal
// (sa-settings-dlg/sa-settings-dlg.component.html:1-13), and its rail lists Calculation, Minimum
// Threshold, Target Profiles and Preferences, hardcoded (sa-settings-dlg.component.ts:52-57;
// ledger target-profiles/where/1, /1/2).
const OPEN_SETTINGS = {
  title: 'Open Settings',
  fig: 'toolbarR',
  do: 'At the right of the toolbar, select the gear button, [[Settings]].',
  see: 'The Settings dialog opens, with a rail of tabs down its left side.',
  ifNot: 'If another dialog is open, close it first. The gear is just right of [[Announcements]].',
  caption: 'The gear button sits in the toolbar’s right-hand group.',
};

/** The Target Profiles tab: five slots per course with the hardcoded column headers Target
 *  Profile, Last Updated, Stations, Update from Current and Apply Profile
 *  (sa-settings-dlg.component.html:191-221; ledger target-profiles/note/1). With no rail entry the
 *  IntelliDash predates Target Profiles (ledger target-profiles/note/2), and targets are then
 *  changed in the table (ledger editing-station-targets/2/2). */
const TP_TAB = {
  do: 'In the left rail, select [[Target Profiles]], below [[Minimum Threshold]].',
  see: 'The right side lists 5 profile slots, with [[Update from Current]] and [[Apply Profile]] columns.',
  ifNot: 'If the rail has no [[Target Profiles]], your IntelliDash predates it. Change targets in the table instead.',
};

/** A slot's name is an editable box in the Target Profile column; Last Updated and Stations read
 *  -- for an empty slot (sa-settings-dlg.component.html:203-206; ledger target-profiles/2/2, /2/4). */
const FIND_PROFILE = {
  do: 'Find the profile in the [[Target Profile]] column.',
  see: 'Its row shows when it was last updated and how many stations it holds.',
};

/** The Apply Profile icon ignores an empty slot, clears a choice already made on that slot, and
 *  otherwise opens SPATIAL_ADJUST.USE_TARGET_PROFILE "Use Target Profile?" with a summary that
 *  includes SPATIAL_ADJUST.MATCHING_STATIONS (sa-settings-dlg.component.ts:253-266;
 *  sa-settings-dlg.component.html:213-218, :262-313; ledger target-profiles/3/1). */
const APPLY_ICON = {
  do: 'On the profile’s row, select the icon under [[Apply Profile]].',
  see: 'The [[Use Target Profile?]] dialog opens, with a count of [[Matching Stations]].',
  ifNot: 'If nothing opens, you may have cleared an earlier choice on that row. Select the icon again.',
};

/** Update from Current toggles a mark on the slot, an exclamation icon with the tooltip "Will
 *  update on save", and the capture runs on Save Changes (sa-settings-dlg.component.ts:249-251;
 *  sa-settings-dlg.component.html:207-212; ledger target-profiles/4/2). */
const UPDATE_ICON = {
  do: 'On the profile’s row, select the icon under [[Update from Current]].',
  see: 'An exclamation mark appears on the icon: the slot will take the current targets when you save.',
  ifNot: 'If the mark goes away, you selected the icon twice. Select it once more.',
};

/** Confirm marks only that profile to apply, shown by an exclamation icon with the tooltip "Will
 *  be applied on save"; Cancel closes without marking it (sa-settings-dlg.component.ts:268-285;
 *  sa-settings-dlg.component.html:213-218, :262-270). Stations in the profile that are not being
 *  scanned are reported under PROFILE_UNMATCHED_STATIONS_* and ignored
 *  (sa-settings-dlg.component.html:272-280; en-us.json:446-447; ledger target-profiles/3/2). The
 *  reproduction has no figure of the confirmation, so the figure stays on the tab. */
const CONFIRM_PROFILE = {
  title: 'Confirm the profile',
  fig: 'dlgWide', dialog: 'settings', settingsTab: 'profiles',
  do: 'In the [[Use Target Profile?]] dialog, select [[Confirm]].',
  see: 'The dialog closes, and an exclamation mark on the icon shows the profile will be applied on save.',
  ifNot: 'If there is no exclamation mark, the choice was cancelled. Select the icon under [[Apply Profile]] again.',
  why: 'Stations in the profile that are no longer scanned are skipped, which is why [[Matching Stations]] can be lower.',
  caption: 'A chosen profile waits for Save Changes.',
};

/** Save Changes shows the busy indicator while the queued profile operation runs, then closes the
 *  dialog; an applied profile also reloads the dashboard. On an error the dialog stays open and
 *  ERR_MSG.GENERIC_SAVE_ERROR_SUMMARY "Unable to save data" is shown
 *  (sa-settings-dlg.component.ts:186-212, :486-529, :531-546; sa-settings-dlg.component.html:44,
 *  :48-60; sa-main-toolbar.component.html:107-112; site/src/app/common/services/dash-message.service.ts:30-32;
 *  ledger target-profiles/3/3, creating-profiles/1/2). */
const saveStep = (applies) => ({
  title: 'Save the change',
  fig: 'dlgWide', dialog: 'settings', settingsTab: 'profiles',
  do: 'Select [[Save Changes]] at the bottom of the dialog.',
  see: applies
    ? 'A busy sign shows while the profile is applied, then the dialog closes and the dashboard reloads.'
    : 'A busy sign shows while the profile is saved, then the dialog closes.',
  ifNot: 'If the dialog stays open with [[Unable to save data]], the save did not finish. '
    + 'Reload the page and check the profile list before you try again.',
  caption: applies ? 'Nothing is applied until Save Changes.' : 'Nothing is captured until Save Changes.',
});

// ---- Understanding VWC -------------------------------------------------------------------------

/** Understanding VWC. Five steps, same count, so TARGETS keeps its length; step 4's point moves to
 *  the Target VWC cell its `do` names.
 *  - 1: today's scan mean in plain text (ledger understanding-vwc/1/3, /1/4, /1/5); grey italic
 *    means not scanned today (dashboard-overview/4/7); no scan anywhere -> Get fresh scan data.
 *  - 2: modelled, grey italic with a calculator icon (ledger /2/2, /2/3); Option 1 models nothing
 *    (ledger /2/2 note; site/src/app/api/spatial-adjust/models/spatial-adjust-course.model.ts:184-188).
 *  - 3: whole number 0-50, the only VWC input (ledger /3/2, /3/3, /3/4).
 *  - 4: delta, ET and the daily cap (ledger /4/2, /4/3; editing-station-targets/3/3).
 *  - 5: hole rows average their children, Last Scan is the newest scan, the grey calculator icon
 *    (ledger /5/2, /5/3); the area crumb returns to the holes (editing-station-targets/1/3). */
function understandingVwc(src, h) {
  const guide = 'understanding-vwc';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: understanding-vwc start', guide,
    expect: { start: null },
    set: { start: { page: 'The Spatial Adjust dashboard, with a hole’s stations in the table.', open: NO_DIALOG, needs: NEEDS_ACCOUNT } },
  });
  s = h.editStep(s, {
    name: 'rewrite: understanding-vwc step 1', guide, title: 'Measured: the scan mean',
    expect: { body: 'When the scan date is today, Avg. VWC is the mean moisture TurfRad measured across that station. It is a measurement, and it is the number the calculation prefers.', do: null },
    set: {
      do: 'In the [[Avg. VWC]] column, find a station scanned today.',
      see: 'Its value is in plain black text: the mean VWC that TurfRad measured across the station.',
      ifNot: 'If every value is grey and italic, nothing was scanned today. See Get fresh scan data.',
      why: 'The calculation uses a measured value whenever there is one.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understanding-vwc step 2', guide, title: 'Modelled: the fallback',
    expect: { body: 'When the scan is not current, Spatial Adjust falls back to a modelled value carried forward from the last scan and the weather since. It is shown in grey italics so you can tell it apart at a glance.', do: null },
    set: {
      do: 'Find a station whose [[Avg. VWC]] is grey and italic, with a calculator icon.',
      see: 'That value is modelled: carried forward from the last scan and the weather since.',
      ifNot: 'If no value is grey, every station was scanned today, or [[Option 1]] is set in Settings, which models nothing.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understanding-vwc step 3', guide, title: 'Target: your input',
    expect: { body: 'Target VWC is a whole number from 0 to 50 that you set per station. Higher targets ask for more water. It is the only VWC on the row you can type into.', do: null },
    set: {
      do: FIND_TARGET_BOX,
      see: 'It holds a whole number from 0 to 50 that you set, the only VWC on the row you can type into.',
      ifNot: HOLE_LEVEL_IFNOT,
      why: 'Higher targets ask for more water.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understanding-vwc step 4', guide, title: 'The delta is what drives the suggestion',
    expect: { body: 'Subtract the working VWC from the target and you have the deficit the calculation must close. Add today’s ET, cap it at the daily maximum, and express it against the Lynx reference amount.', do: null },
    set: {
      do: 'Compare a station’s [[Target VWC]] with its [[Avg. VWC]].',
      see: 'The bigger the delta, the higher the [[Suggested]] percent, up to the daily maximum.',
      ifNot: 'If [[Suggested]] sits at the same top value on many rows, the daily maximum is capping it. See Calculation settings.',
      why: 'Today’s ET is added to the delta, so a hot, dry day raises the suggestions.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understanding-vwc step 5', guide, title: 'Aggregate rows average their children',
    expect: { body: 'At hole and area level the same two columns show averages rather than readings, and the scan date column shows the most recent scan beneath that row. A grey calculator icon on a hole or area row means at least one station beneath it is modelled; the average turns grey and italic only when nothing beneath it was scanned today.', do: null },
    set: {
      do: 'Find a hole row, with [[Avg. Target VWC]] and [[Last Scan]] columns.',
      see: 'Each value averages the stations under the row, and [[Last Scan]] is the newest scan beneath it.',
      ifNot: 'If you see [[Target VWC]] boxes, you are at station level. Select the area’s name at the top left to go up.',
      why: 'A grey calculator icon means at least one station beneath the row is modelled.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: understanding-vwc TARGETS', guide,
    expect: "[cell('vwc', 1), cell('vwc', 6), cell('target', 7), cell('sugg', 2), cell('target', 2)]",
    replace: "[cell('vwc', 1), cell('vwc', 6), cell('target', 7), cell('target', 2), cell('target', 2)]",
  });
  return s;
}

// ---- Editing station targets -------------------------------------------------------------------

/** Editing station targets. Four steps, unchanged count and TARGETS.
 *  - 1: drill from hole rows to stations; a map pin drills straight to the row (ledger
 *    editing-station-targets/1/2, /1/4, /1/6).
 *  - 2: whole number 0-50 (ledger /2/2, /2/3). A keypress that would pass the maximum is refused
 *    with no message (site/src/app/shared/components/numeric-input/numeric-input.component.ts:96-101,
 *    :117-121; sa-table-card.component.html:40-47).
 *  - 3: Suggested recalculates and % Adj. follows it (ledger /summary/1, /3/2, /3/3, /before/2).
 *  - 4: % Adj. 0-900, queues the station when enabled and different from Lynx, -- with no scan
 *    and no estimate (ledger /4/2, /4/3, /4/5, /4/6). The which-to-change tip becomes the why. */
function editingStationTargets(src, h) {
  const guide = 'editing-station-targets';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: editing-station-targets start', guide,
    expect: { start: null },
    set: { start: { page: PAGE_DASHBOARD, open: NO_DIALOG, needs: NEEDS_ACCOUNT } },
  });
  s = h.editStep(s, {
    name: 'rewrite: editing-station-targets step 1', guide, title: 'Drill down to the station',
    expect: { body: 'The table drills from course to areas, then holes, then stations. Breadcrumbs at the top left take you back up a level. If you already know where the station is, click its pin on the map: the table drills straight to its hole and scrolls to the row.', do: null },
    set: {
      do: 'In the table, select the hole row that holds the station.',
      see: 'The table lists that hole’s stations, each with a [[Target VWC]] box.',
      ifNot: 'If the table lists areas, select the area row first. If you know where the station is, select its pin on the map instead.',
      region: true,
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: editing-station-targets step 2', guide, title: 'Type the new target',
    expect: { body: 'The Target VWC field takes a whole number between 0 and 50. Raising it increases the deficit and therefore the suggestion; lowering it does the opposite.', do: null },
    set: {
      do: 'In the station’s [[Target VWC]] box, type a whole number from 0 to 50.',
      see: 'The box shows the number you typed.',
      ifNot: 'If a digit does not appear, it would take the number above 50, which the box refuses.',
      why: 'A higher target asks for more water, so the suggestion rises; a lower one does the opposite.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: editing-station-targets step 3', guide, title: 'Read the new suggestion',
    expect: { body: 'The Suggested column recalculates against the new target. If it lands on the top value, Daily Max Amount ÷ Lynx Reference Amount × 100, the daily maximum is capping it rather than the target deciding it.', do: null },
    set: {
      do: 'Read [[Suggested]] on the same row.',
      see: 'It has recalculated for the new target, and [[% Adj.]] has changed to match it.',
      ifNot: 'If [[Suggested]] stays at the same top value, the daily maximum is capping it rather than the target.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: editing-station-targets step 4', guide, title: 'Override the percentage if you need to',
    expect: {
      body: 'The % Adj. field is separate from the target and accepts 0 to 900. Editing it queues the station for push when the station is enabled and the new value differs from Lynx’s Current; the Suggested value stays visible beside it for comparison.',
      tipLabel: 'Which to change.',
      tip: 'Edit the target when the station should always be wetter or drier. Edit % Adj. when today is unusual.',
      do: null,
    },
    set: {
      do: 'To override today’s percent, type a number from 0 to 900 in [[% Adj.]].',
      see: 'The station joins the [[Push Changes]] count if it is enabled and the value differs from Lynx.',
      ifNot: 'If the box shows --, the station has no scan today and no modelled value, so there is nothing to override.',
      why: 'Change the target when a station should always be wetter or drier; change [[% Adj.]] when today is unusual.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  return s;
}

// ---- Apply a bulk adjustment -------------------------------------------------------------------

/** Apply a bulk adjustment. Four steps become five: choosing Replace or Shift and typing the
 *  amount are two actions (docs/writing-guide.md > One action per step), so "Type the amount" is
 *  inserted after step 3, pointing at the amount box.
 *  - 1: row and hole checkboxes, the link activates (ledger bulk-adjustments/1/2, /1/3, /1/5,
 *    /before/2).
 *  - 2: the dialog and its "{{num}} Stations selected" count, Cancel in the footer (ledger /2/3;
 *    sa-dash-table/sa-bulk-adjust-dlg/sa-bulk-adjust-dlg.component.html:14-20, :74-84).
 *  - 3: Replace 0 to 50, Shift -40 to 40 (sa-bulk-adjust-dlg.component.ts:68-69, :163-188; ledger
 *    /3/2, /3/3, /3/4).
 *  - 4 (new): the amount box remembers the last value used for each choice, saved to the user's
 *    preferences on Apply to all (sa-bulk-adjust-dlg.component.ts:47-57, :163-205, :121); results
 *    clamp to 0-50 (ledger /3/3 note).
 *  - 5: Apply to all closes and reloads; on Bulk Adjust Error nothing is normally written and the
 *    table is not refreshed (ledger /4/2, /4/3, /4/5, /4/7). The failure tip becomes the If not. */
function bulkAdjustments(src, h) {
  const guide = 'bulk-adjustments';
  const rows = ['3AP1', '3AP2', '4AP1', '6AP1', '6AP2'];
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: bulk-adjustments start', guide,
    expect: { start: null },
    set: { start: { page: PAGE_DASHBOARD, open: NO_DIALOG, needs: NEEDS_ACCOUNT } },
  });
  s = h.editStep(s, {
    name: 'rewrite: bulk-adjustments step 1', guide, title: 'Select the stations',
    expect: { body: 'Tick the checkbox on each station row. Ticking an area or hole row cascades the selection to everything beneath it, so you can take a whole hole in one click.', do: null },
    set: {
      do: 'Tick the checkbox on each station row you want to change.',
      see: 'The [[Bulk Adjust]] link above the table becomes active.',
      ifNot: 'If [[Bulk Adjust]] stays grey, no row is ticked. Tick a station row, or a hole row to take all its stations.',
      region: true,
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: bulk-adjustments step 2', guide, title: 'Open Bulk Adjust',
    expect: { body: 'The link sits above the table beside the threshold filter. The dialog opens with the count of stations you selected at the top — check it before going further.', do: null },
    set: {
      do: 'Select [[Bulk Adjust]], above the table.',
      see: 'The [[Bulk Adjust]] dialog opens with the number of stations you ticked at the top, as in 5 Stations selected.',
      ifNot: 'If the count is not what you expect, select [[Cancel]] and fix the ticks first.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: bulk-adjustments step 3', guide, title: 'Choose replace or shift',
    expect: { body: 'Replace overwrites every selected station with the value you enter. Shift moves each station up or down by that amount, keeping the differences between them. Shift is the safer choice when the stations were individually tuned.', do: null },
    set: {
      do: 'Select [[Shift]] to move each target by the same amount, or [[Replace]] to set them all to one value.',
      see: 'The box below takes −40 to 40 for [[Shift]], or 0 to 50 for [[Replace]].',
      ifNot: 'If the box shows a number you did not expect, check which choice is marked.',
      why: '[[Shift]] keeps the differences between stations you tuned one by one.',
    },
    drop: ['body'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: bulk-adjustments insert step 4 (Type the amount)', guide, title: 'Choose replace or shift', op: 'after',
    step: {
      title: 'Type the amount', fig: 'dlgSmall', dialog: 'bulk', bulkMode: 'shift', bulkValue: -5, selectedRows: rows,
      do: 'Type the amount in the box under [[Shift]] and [[Replace]].',
      see: 'The box shows your amount with a % sign.',
      ifNot: 'If the box already holds a number, it is your last amount for that choice, or the default. Type over it.',
      why: 'Targets stop at 0 and 50, so a shift past either end lands there.',
      caption: 'Shift accepts −40 to 40; Replace accepts 0 to 50.',
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: bulk-adjustments step 5', guide, title: 'Apply to all',
    expect: {
      body: 'Apply to all writes the new targets and closes the dialog. The suggested percentages recalculate against the new targets straight away, so the Suggested column will move.',
      tipLabel: 'On failure.',
      do: null,
    },
    set: {
      do: 'Select [[Apply to all]].',
      see: 'The dialog closes. The ticked stations show new targets, and [[Suggested]] changes.',
      ifNot: 'If [[Bulk Adjust Error]] appears, reload the page and check [[Target VWC]] before you try again.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: bulk-adjustments TARGETS', guide,
    expect: "[cell('cb', 1), P.bulkLink, P.bulkShift, cell('target', 1)]",
    replace: "[cell('cb', 1), P.bulkLink, P.bulkShift, P.bulkValue, cell('target', 1)]",
  });
  return s;
}

// ---- Target Profiles ---------------------------------------------------------------------------

/** The five slots' controls, measured in the reproduction's Target Profiles tab: the second row's
 *  name box and its two icons, and the first row's name box and Update from Current icon. */
function profilePoints(src, h) {
  return h.edit(src, {
    name: 'rewrite: target profile points in P',
    pattern: /\n {2}profileRow: \[1099, 462\], profileApply: \[1348, 521\],\n/,
    replace: () => '\n  profileRow: [1099, 462], profileApply: [1348, 521],\n'
      + '  tpSpringName: [918, 491], tpSpringUpdate: [1172, 491], tpSummerName: [918, 541], tpSummerUpdate: [1172, 541], tpSummerApply: [1290, 541],\n',
  });
}

/** Apply a target profile. Four steps become seven: Open Settings is inserted first; choosing the
 *  profile, confirming it and saving are three actions, so Confirm and Save are inserted after
 *  step 3; and the old step 4, which captured targets (Capturing profiles covers that), becomes
 *  the check that the targets changed. The before-a-tournament tip (ledger target-profiles/3/5,
 *  Needs expert) is dropped.
 *  - Read the list: dates and counts, an empty slot cannot be applied (ledger /2/2, /2/4;
 *    sa-settings-dlg.component.ts:253-255).
 *  - Choose: applying overwrites the covered stations' targets and recalculates (ledger /3/2, /3/3).
 *  - Check: the dashboard names the applied profile with SPATIAL_ADJUST.N_TARGET_PROFILE until a
 *    target is edited, targets match, Suggested recalculated (ledger /2/3, /verify/1-3). */
function targetProfiles(src, h) {
  const guide = 'target-profiles';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: target-profiles start and next', guide,
    expect: { start: null },
    set: {
      start: { page: PAGE_DASHBOARD, open: NO_DIALOG, needs: 'A saved profile: a slot that shows a station count, not --.' },
      next: ['creating-profiles', 'push-to-lynx'],
    },
  });
  s = stepOp(s, h, {
    name: 'rewrite: target-profiles insert step 1 (Open Settings)', guide, title: 'Open the Target Profiles tab', op: 'before',
    step: OPEN_SETTINGS,
  });
  s = h.editStep(s, {
    name: 'rewrite: target-profiles step 2', guide, title: 'Open the Target Profiles tab',
    expect: { body: 'Profiles sit alongside Calculation and Minimum Threshold in the settings dialog, because a profile is a calculation input rather than a station edit.', do: null },
    set: { ...TP_TAB },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: target-profiles step 3', guide, title: 'Read the profile list',
    expect: { body: 'Each profile shows when it was last updated, by renaming it or with Update from Current, and how many stations it holds. The profile you applied is named above the dashboard table, as “Summer Target Profile” for a profile named Summer; changing any station target afterwards leaves the stored profile intact but removes that label.', do: null },
    set: {
      ...FIND_PROFILE,
      ifNot: 'If both read --, the slot is empty and cannot be applied. Fill it first: see Capturing profiles.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: target-profiles step 4', guide, title: 'Apply and confirm',
    expect: {
      body: 'Applying overwrites the Target VWC of every station the profile covers. Because that is a recalculation input, the dashboard reloads and the Suggested column changes across the course.',
      tipLabel: 'Before a tournament.',
      do: null,
    },
    set: {
      title: 'Choose the profile',
      ...APPLY_ICON,
      why: 'Applying changes [[Target VWC]] on every station in the profile, so suggestions change.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: target-profiles insert step 5 (Confirm the profile)', guide, title: 'Choose the profile', op: 'after',
    step: CONFIRM_PROFILE,
  });
  s = stepOp(s, h, {
    name: 'rewrite: target-profiles insert step 6 (Save the change)', guide, title: 'Confirm the profile', op: 'after',
    step: saveStep(true),
  });
  s = h.editStep(s, {
    name: 'rewrite: target-profiles step 7', guide, title: 'Save your current targets into a profile slot',
    expect: {
      body: 'Once the course is tuned the way you want it, save the state as a profile so you can return to it. Name it for the condition rather than the date — the reason you set those targets is what you will be looking for later.',
      caption: 'The station targets currently in the table are what a new profile would capture.',
      do: null,
    },
    set: {
      title: 'Check the new targets',
      do: 'In the table, read [[Target VWC]] on a few stations.',
      see: 'They match the profile. The name above the table reads, for example, Summer Target Profile.',
      ifNot: 'If the name is missing, a target was edited after you applied the profile. The stored profile is unchanged.',
      why: '[[Suggested]] has recalculated too, so read it before you push.',
      caption: 'Targets and suggestions after the profile is applied.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: target-profiles TARGETS', guide,
    expect: "[P.menuProfiles, P.profileRow, P.profileApply, cell('target', 1)]",
    replace: "[P.gear, P.menuProfiles, P.tpSummerName, P.tpSummerApply, P.tpSummerApply, P.saveChanges, cell('target', 1)]",
  });
  return s;
}

/** Capturing profiles. Four steps become six: Open Settings after step 1, Update from Current and
 *  Save after the naming step, and the station-count check is removed, because the dialog closes
 *  on save; the count is in Verify, and what a capture holds moves to the why.
 *  - 1: a profile is a snapshot of every station's stored target, shown or not (ledger
 *    creating-profiles/1/2, /1/4).
 *  - Name: an editable box, the date has its own column, a slot holding a profile is replaced
 *    (ledger /3/2, /3/3; updating-profiles/3/3).
 *  - Mark: the capture holds every station on the course at that moment, enabled or not (ledger
 *    /4/3). */
function creatingProfiles(src, h) {
  const guide = 'creating-profiles';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: creating-profiles start and next', guide,
    expect: { start: null },
    set: {
      start: { page: PAGE_DASHBOARD, open: NO_DIALOG, needs: 'Station targets set the way you want to keep them, and a slot you can spare.' },
      next: ['updating-profiles', 'target-profiles'],
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: creating-profiles step 1', guide, title: 'Tune the targets first',
    expect: { body: 'A profile is a snapshot, so the work happens in the table before you save anything. Get the course reading the way you want it, hole by hole, and only then capture it.', do: null },
    set: {
      do: 'Set [[Target VWC]] on each station the way you want to keep it.',
      see: 'The [[Target VWC]] column shows the targets the profile will capture.',
      ifNot: 'If a station is not in the table, it has no recent scan. The profile still captures its stored target.',
      why: 'A profile is a snapshot of the targets at the moment you save it.',
    },
    drop: ['body'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: creating-profiles insert step 2 (Open Settings)', guide, title: 'Tune the targets first', op: 'after',
    step: OPEN_SETTINGS,
  });
  s = h.editStep(s, {
    name: 'rewrite: creating-profiles step 3', guide, title: 'Open the Target Profiles tab',
    expect: { body: 'Profiles sit with the calculation settings rather than in the table, because a target set is a calculation input rather than a station edit.', do: null },
    set: { ...TP_TAB },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: creating-profiles step 4', guide, title: 'Name it for the condition',
    expect: { body: 'Name a profile for the reason the targets are what they are — Summer Baseline, Tournament Week, Overseed Recovery. A date tells you when; a condition tells you why, which is what you will be searching for.', do: null },
    set: {
      do: 'In the [[Target Profile]] column, type a new name over a slot you can spare.',
      see: 'The box shows the new name, such as Tournament Week.',
      ifNot: 'If the slot shows a station count, it already holds a profile, and capturing into it replaces what it holds. Use a slot that shows -- if you have one.',
      why: 'A name like Overseed Recovery says why you set the targets; the date has its own column.',
    },
    drop: ['body'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: creating-profiles insert step 5 (Mark it for capture)', guide, title: 'Name it for the condition', op: 'after',
    step: {
      title: 'Mark it for capture', fig: 'dlgWide', dialog: 'settings', settingsTab: 'profiles',
      ...UPDATE_ICON,
      why: 'The profile will hold every station on the course at that moment, enabled or not.',
      caption: 'The Update from Current icon marks a slot to capture on save.',
    },
  });
  s = stepOp(s, h, {
    name: 'rewrite: creating-profiles insert step 6 (Save the change)', guide, title: 'Mark it for capture', op: 'after',
    step: saveStep(false),
  });
  s = h.editStep(s, {
    name: 'rewrite: creating-profiles check step, before removal', guide, title: 'Check the station count',
    expect: { body: 'The count beside each profile says how many stations it covers. A profile holds every station the course had when it was captured, enabled or not. Stations added to the course later are not in it, and applying the profile leaves them untouched.' },
  });
  s = stepOp(s, h, {
    name: 'rewrite: creating-profiles remove the station-count step', guide, title: 'Check the station count', op: 'remove',
  });
  s = h.editTargets(s, {
    name: 'rewrite: creating-profiles TARGETS', guide,
    expect: "[cell('target', 2), P.menuProfiles, P.profileRow, P.profileRow]",
    replace: "[cell('target', 2), P.gear, P.menuProfiles, P.tpSpringName, P.tpSpringUpdate, P.saveChanges]",
  });
  return s;
}

/** Updating profiles. Four steps become seven: Open Settings and the tab after step 1, and Save
 *  after the update. The rule-of-thumb tip becomes the why of the update step.
 *  - 1: the "<name> Target Profile" label disappears at the first target edit; the stored profile
 *    is untouched (ledger updating-profiles/1/1, /1/2, /1/3, /2/3).
 *  - Find: the list does not mark the applied profile; a rename stamps Last Updated (ledger /2/2;
 *    target-profiles/2/2).
 *  - Update: Update from Current, a one-off goes in another slot (ledger /3/2, /3/3, /3/6).
 *  - Check: an update-only save changes no target or suggestion; something else in the same save
 *    can (ledger /4/2, /4/3, /verify/2). */
function updatingProfiles(src, h) {
  const guide = 'updating-profiles';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: updating-profiles start', guide,
    expect: { start: null },
    set: { start: { page: PAGE_DASHBOARD, open: NO_DIALOG, needs: 'A saved profile whose targets you have since changed in the table.' } },
  });
  s = h.editStep(s, {
    name: 'rewrite: updating-profiles step 1', guide, title: 'Notice the drift',
    expect: { body: 'After a fortnight of individual target edits, the course no longer matches the profile you applied. The profile is still valid, it is simply out of date.', do: null },
    set: {
      do: 'Look above the table for the name of the profile you applied.',
      see: 'After any station target edit, the name is gone, because the course no longer matches the profile.',
      ifNot: 'If the name is still there, no target has changed since you applied it. There is nothing to update.',
      why: 'The stored profile is not changed by those edits; it is simply out of date.',
      region: true,
    },
    drop: ['body'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: updating-profiles insert step 2 (Open Settings)', guide, title: 'Notice the drift', op: 'after',
    step: OPEN_SETTINGS,
  });
  s = stepOp(s, h, {
    name: 'rewrite: updating-profiles insert step 3 (Open the Target Profiles tab)', guide, title: 'Open Settings', op: 'after',
    step: {
      title: 'Open the Target Profiles tab', fig: 'dlgWide', dialog: 'settings', settingsTab: 'profiles',
      ...TP_TAB,
      caption: 'The Target Profiles tab in the settings dialog.',
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: updating-profiles step 4', guide, title: 'Find the profile’s row',
    expect: { body: 'The profile last applied is named above the dashboard table until a station target is edited; the profile list does not mark it. Editing a station target after applying leaves the profile intact but no longer exactly matched.', do: null },
    set: {
      ...FIND_PROFILE,
      ifNot: 'If no name looks right, a slot may have been renamed. A rename also changes its date, which can help.',
      why: 'The list does not mark which profile was applied, so go by its name.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: updating-profiles step 5', guide, title: 'Update this slot or capture into another',
    expect: {
      body: 'Overwrite the stored targets with the current ones when the drift is an improvement. Capture into a different slot instead when the change is for one event, and rename it to suit; with five slots per course that overwrites whatever the other slot held, so pick one you no longer need.',
      tipLabel: 'Rule of thumb.',
      tip: 'Update when the course has genuinely moved on. Use another slot when the change is temporary.',
      do: null,
    },
    set: {
      ...UPDATE_ICON,
      why: 'For a one-off event, capture into a spare slot instead, so this profile stays as it is.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: updating-profiles insert step 6 (Save the change)', guide, title: 'Update this slot or capture into another', op: 'after',
    step: saveStep(false),
  });
  s = h.editStep(s, {
    name: 'rewrite: updating-profiles step 7', guide, title: 'Confirm nothing moved',
    expect: { body: 'Updating a profile writes to the profile, not to the stations. The Suggested column should be exactly as it was — if it moved, something applied rather than updated.', do: null },
    set: {
      do: 'In the table, read [[Target VWC]] and [[Suggested]].',
      see: 'They are as they were. The update changed only the stored profile.',
      ifNot: 'If they changed, the save did more, such as applying a profile or changing a calculation setting.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: updating-profiles TARGETS', guide,
    expect: "[cell('target', 4), P.profileRow, P.profileApply, cell('sugg', 4)]",
    replace: "[cell('target', 4), P.gear, P.menuProfiles, P.tpSummerName, P.tpSummerUpdate, P.saveChanges, cell('sugg', 4)]",
  });
  return s;
}

/** Managing seasonal profiles. Four steps become seven: Confirm and Save are inserted after the
 *  apply step, and Open Push Changes before the push step. The push-window tip on the last step is a warning the reader must see there, so it
 *  stays (docs/writing-guide.md > The step shape).
 *  - 1: five renameable slots per course (ledger seasonal-profiles/summary/1, /1/3); Cancel with
 *    changes offers to discard them (sa-settings-dlg.component.ts:220-231). The Needs expert
 *    sentence on which profiles most courses need (ledger /1/2) is dropped.
 *  - Apply: the evening-before reason keeps its Verified wording (ledger /2/3).
 *  - Read: suggestions rise toward the cap or fall toward 0% (ledger /3/2, /3/3).
 *  - Push: the footer button counts the changes and opens the push progress dialog (ledger
 *    /4/3; push-to-lynx/4/4, /5/1). */
function seasonalProfiles(src, h) {
  const guide = 'seasonal-profiles';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: seasonal-profiles start', guide,
    expect: { start: null },
    set: { start: { page: PAGE_DASHBOARD, open: 'The Target Profiles tab of the Settings dialog.', needs: 'Profiles captured for the conditions you plan for. Capturing profiles shows how.' } },
  });
  s = h.editStep(s, {
    name: 'rewrite: seasonal-profiles step 1', guide, title: 'Plan what goes in the five slots',
    expect: { body: 'Three or four profiles covers most courses: a summer baseline, a shoulder-season set, a tournament set, and a recovery set for after aeration or overseed.', do: null },
    set: {
      do: 'In the [[Target Profile]] column, name each slot for a condition you plan for.',
      see: 'Each box shows its new name, such as Summer Baseline or Tournament Week.',
      ifNot: 'If a new name is lost, the dialog was cancelled. Rename the slot again and select [[Save Changes]].',
      why: 'With only 5 slots per course, name each one for a condition, not a date.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: seasonal-profiles step 2', guide, title: 'Apply the evening before',
    expect: { body: 'Applying rewrites the target of every station in the profile and recalculates their suggestions; stations not in the profile keep their targets. Doing it the evening before leaves you the next morning to read the new suggestions against a fresh scan.', do: null },
    set: {
      ...APPLY_ICON,
      why: 'Doing it the evening before leaves you the next morning to read the new suggestions against a fresh scan.',
    },
    drop: ['body'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: seasonal-profiles insert step 3 (Confirm the profile)', guide, title: 'Apply the evening before', op: 'after',
    step: CONFIRM_PROFILE,
  });
  s = stepOp(s, h, {
    name: 'rewrite: seasonal-profiles insert step 4 (Save the change)', guide, title: 'Confirm the profile', op: 'after',
    step: saveStep(true),
  });
  s = h.editStep(s, {
    name: 'rewrite: seasonal-profiles step 5', guide, title: 'Read the new suggestions before pushing',
    expect: { body: 'A profile changes targets, and targets change deficits. Scan the Suggested column for stations that jumped to the cap — those are the ones where the new target is a long way from where the station actually is.', do: null },
    set: {
      do: 'Read the [[Suggested]] column the next morning.',
      see: 'Stations far below their new target rise toward the cap; stations far above it fall toward 0%.',
      ifNot: 'If the profile’s name is not above the table, it was not applied, or a target has been edited since.',
      why: 'A profile changes targets, and targets change deficits.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: seasonal-profiles step 6', guide, title: 'Push once you agree with them',
    expect: { body: 'The push dialog is the same as any other day. The difference is the size of the change set: a profile switch usually queues most of the course at once.', tipLabel: 'Push window.', do: null },
    set: {
      do: 'Select the footer button of the [[Push Changes]] dialog, such as Push 148 changes to Lynx.',
      see: 'A progress dialog opens and counts the stations as they are sent to Lynx.',
      ifNot: 'If the [[Push Changes]] dialog is not open, select [[Push Changes]] at the right of the toolbar first.',
      why: 'After a profile, the count on that button is often most of the course.',
    },
    drop: ['body'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: seasonal-profiles insert step 6 (Open Push Changes)', guide, title: 'Push once you agree with them', op: 'before',
    step: {
      title: 'Open Push Changes', fig: 'toolbarR',
      do: 'At the right of the toolbar, select [[Push Changes]].',
      see: 'The [[Push Changes]] dialog opens, with the changes it will send.',
      ifNot: 'If [[Push Changes]] is greyed out, nothing is waiting. Check that the profile was applied.',
      caption: 'Push Changes sits at the left of the toolbar’s right-hand group.',
    },
  });
  s = h.editTargets(s, {
    name: 'rewrite: seasonal-profiles TARGETS', guide,
    expect: "[P.profileRow, P.profileApply, cell('sugg', 1), P.pushFooter]",
    replace: "[P.tpSpringName, P.tpSummerApply, P.tpSummerApply, P.saveChanges, cell('sugg', 1), P.push, P.pushFooter]",
  });
  return s;
}

/** Applies every Targets rewrite, in catalogue order. Registered in src/rewrite/index.mjs. */
export function apply(src, h) {
  let s = src;
  s = profilePoints(s, h);
  s = understandingVwc(s, h);
  s = editingStationTargets(s, h);
  s = bulkAdjustments(s, h);
  s = targetProfiles(s, h);
  s = creatingProfiles(s, h);
  s = updatingProfiles(s, h);
  s = seasonalProfiles(s, h);
  return s;
}
