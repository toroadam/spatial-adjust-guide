// Corrections for guide claims that the claims ledger marks Wrong.
//
// Owner: feature 8 (correct every Wrong claim, align the reproduction, label Target Profiles
// honestly). No other feature edits this file. See the module map in docs/claims/README.md.
//
// Runs first of the four modules called from transformGuide(). Corrections replace whole
// sentences, and the additive modules that run after this one anchor only on step titles and
// existing list items, so they still find their anchors once a body sentence has been rewritten.
// No step title that changed-surfaces or operational-contract anchors on is changed here.
//
// Every edit() is anchored on the exact text it replaces and asserts how many times that text
// occurs. A Core Design re-export that moves the sentence then fails the build rather than
// silently dropping the correction. The guide catalogues are keyed on exact English, so changing
// any sentence orphans that string's translation in all ten locales.
//
// WHAT IS HERE. One entry per Wrong sentence that the Core Design export itself contains, named
// by the claim IDs in docs/claims/guides/<guide>.json. Each is a numbered section in
// docs/text-corrections.md, which gives the claimed and the actual behaviour and the production
// path:line behind it. Wrong sentences that an earlier edit in src/transform-export.mjs wrote are
// corrected in that edit instead, so the wrong text is never produced at all:
//   calculation-questions/5/4          'stale scans: diagnostics step names the next action'
//   */note/*  (four Target Profiles notes)  'target profiles disclaimer: …' (two edits)
//   station-zero/5/3                   'diagnostics dialog trigger'
//   verify-results/1/4                 'verify-results push phase order'
//   request-scan-data/*, filter-adjustments/before/2, filter-adjustments/2/2
//                                      'new guide bodies', 'catalogue entry: request-scan-data'
//
// `from` and `to` are written in the export's source form: the text sits inside single-quoted
// JavaScript strings, so `to` must not contain a straight single quote (fix() checks), and an
// escape such as ’ in the export is written \\u2019 here.
import { edit } from './edit.mjs';

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Where a correction sits in its step. A title or a caption is matched with the key that
// precedes it, so a sentence that happens to occur elsewhere in the export cannot be hit instead.
const WRAP = {
  sentence: (t) => t,
  title: (t) => `{ title: '${t}',`,
  caption: (t) => `caption: '${t}'`,
  quoted: (t) => `'${t}'`,
};

function fix(s, { ids, from, to, at = 'sentence', expected = 1 }) {
  if (to.includes("'")) {
    throw new Error(`Correction ${ids}: the replacement contains a straight single quote, which would `
      + 'end the JavaScript string it lands in. Use \u2019 or rephrase.');
  }
  const wrap = WRAP[at];
  return edit(s, {
    name: `correction ${ids}`,
    pattern: new RegExp(escapeRe(wrap(from)), expected > 1 ? 'g' : ''),
    replace: () => wrap(to),
    expected,
  });
}

export const CORRECTIONS = [
  // ---- Dashboard overview ----------------------------------------------------------------------
  { ids: 'dashboard-overview/1/7',
    from: 'Avg / High / Low moisture are computed across every station in the selected course, not just the ones visible in the table.',
    to: 'The average, high and low VWC figures summarise the areas of the selected course that were scanned today, whatever the table is showing.' },
  { ids: 'dashboard-overview/2/2',
    from: 'Every station is a pin coloured by its latest measured VWC against the four moisture bands in the legend.',
    to: 'Each sprinkler of a station scanned in the past seven days is a pin. '
      + 'A pin scanned today is coloured by its measured VWC against the four moisture bands in the legend, and a pin last scanned on an earlier day is drawn clear. '
      + 'Disabled stations stay hidden while Layers is set to Enabled Stations, the default.' },
  { ids: 'dashboard-overview/3/2',
    from: 'The chart above the table plots the holes you pick in the multiselect.',
    to: 'The chart above the table plots the areas, holes or stations you pick in its multiselect, whichever level the table is showing. '
      + 'On screens 1400 px wide or narrower the chart is hidden.' },
  { ids: 'dashboard-overview/5/3',
    from: 'Push Changes counts stations with an unpushed edit, and the green counter beside it counts stations already pushed today.',
    to: 'Push Changes counts the enabled stations whose % Adj. differs from what Lynx holds, edited or not, leaving out any already pushed today; '
      + 'the green counter beside it counts stations already pushed today.' },
  { ids: 'dashboard-overview/verify/1',
    from: 'The map, chart and table all name the same course.',
    to: 'The map, chart and table all show the course selected in the toolbar.' },
  { ids: 'dashboard-overview/verify/4',
    from: 'The station count on the All Stations tab matches the number of pins on the map.',
    to: 'The station count on the All Stations tab is the number of stations in the course. '
      + 'The map need not match it, because it draws each sprinkler of a station and by default hides disabled stations.' },

  // ---- Map navigation --------------------------------------------------------------------------
  { ids: 'map-navigation/1/2',
    from: 'Every station is a pin placed at its real coordinates and filled with the colour of the moisture band its latest reading falls into.',
    to: 'Each sprinkler of a station scanned in the past seven days is a pin at its own coordinates. '
      + 'A pin scanned today is filled with the colour of the moisture band its reading falls into, and a pin last scanned on an earlier day is drawn clear. '
      + 'Disabled stations are hidden while Layers is set to Enabled Stations, the default.' },
  { ids: 'map-navigation/2/3',
    from: 'Move one and the map recolours as you drag',
    to: 'Move one and the map recolours when you let go' },

  // ---- Understanding VWC, Station details ------------------------------------------------------
  { ids: 'understanding-vwc/5/3',
    from: 'An italic average means at least one child is modelled.',
    to: 'A grey calculator icon on a hole or area row means at least one station beneath it is modelled; '
      + 'the average turns grey and italic only when nothing beneath it was scanned today.' },
  { ids: 'station-details/4/2, station-details/4/3',
    from: 'A child whose scan is older shows a modelled value in grey italics, and the parent average is then part measurement and part model. '
      + 'The parent row is marked the same way so you are not misled.',
    to: 'A child whose scan is older than today shows a modelled value marked with an orange calculator icon, and the parent average is then part measurement and part model. '
      + 'The parent row carries a grey calculator icon beside its average, so you can tell it includes a modelled reading.' },

  // ---- Understand Spatial Adjust ---------------------------------------------------------------
  { ids: 'understand-spatial-adjust/summary/1',
    from: 'turn yesterday\\u2019s moisture scan into today\\u2019s percent adjustment, and write it to Lynx.',
    to: 'turn the latest moisture scan into today\\u2019s percent adjustment, and write it to Lynx when you push.' },

  // ---- Editing station targets, Suggested adjustments ------------------------------------------
  { ids: 'editing-station-targets/1/4',
    from: 'The flat All Stations tab is faster when you already know the station name.',
    to: 'If you already know where the station is, click its pin on the map: the table drills straight to its hole and scrolls to the row.' },
  { ids: 'editing-station-targets/3/3',
    from: 'If it lands on the same number as its neighbours, the daily maximum is capping it rather than the target deciding it.',
    to: 'If it lands on the top value, Daily Max Amount ÷ Lynx Reference Amount × 100, the daily maximum is capping it rather than the target deciding it.' },
  { ids: 'editing-station-targets/4/3',
    from: 'Editing it queues the station for push and leaves the suggestion visible underneath for comparison.',
    to: 'Editing it queues the station for push when the station is enabled and the new value differs from Lynx’s Current; '
      + 'the Suggested value stays visible beside it for comparison.' },
  { ids: 'editing-station-targets/verify/3',
    from: 'The station appears in the Push Changes count only if you edited % Adj.',
    to: 'The station appears in the Push Changes count if it is enabled and its % Adj. differs from Lynx’s Current, whether from your edit or from the new suggestion.' },
  { ids: 'suggested-adjustments/4/5',
    from: 'Editing % Adj. queues the station; the icon beside the field marks it as pending.',
    to: 'Editing % Adj. queues the station when the new value differs from what Lynx holds; '
      + 'a push icon appears beside the field only on a station that has been pushed before.' },
  { ids: 'suggested-adjustments/verify/1',
    from: 'Every station you edited shows the pending push icon beside the % Adj. field.',
    to: 'Every station you edited to a value different from what Lynx holds is in the Push Changes list.' },
  { ids: 'suggested-adjustments/verify/2',
    from: 'The Push Changes count in the toolbar matches the number of rows you changed.',
    to: 'The Push Changes count in the toolbar is the number of enabled stations whose % Adj. differs from what Lynx holds, edited or not, leaving out any already pushed today.' },

  // ---- Bulk adjustments ------------------------------------------------------------------------
  { ids: 'bulk-adjustments/4/5, bulk-adjustments/4/6',
    from: 'A bulk adjust error means some values may already have been written. Check the column before retrying rather than applying twice.',
    to: 'A bulk adjust error normally means nothing was written, despite what the message says: the change is applied in one go and rolled back on failure. '
      + 'If the connection dropped after the server finished, everything was written. '
      + 'The table is not refreshed after an error, so reload the page and check the column before retrying rather than applying twice.' },

  // ---- Calculation settings, Minimum threshold, Preferences -----------------------------------
  { ids: 'calculation-settings/5/3',
    from: 'Expect the Suggested column to move on every row.',
    to: 'Expect the Suggested column to move wherever the setting you changed takes part: a new Lynx Reference Amount rescales every suggestion above zero, '
      + 'a new Daily Max Amount moves only the stations at the old or new cap, and stations at zero usually stay there. '
      + 'A % Adj. you typed earlier keeps its value.' },
  { ids: 'minimum-threshold/1/3',
    from: 'It opens on whichever tab you last arrived at, so it may not open on Calculation.',
    to: 'It opens on Calculation, unless you have used Review Threshold in the Push Changes dialog since the page loaded, in which case it opens on Minimum Threshold.' },
  { ids: 'threshold-questions/1/3',
    from: 'the table still shows 6 — the threshold has not been applied yet, because nothing has been pushed.',
    to: 'the table still shows 6, and it always will: the threshold is applied only in the Push Changes dialog and to what is sent to Lynx, never to the table.' },
  { ids: 'preferences/1/3',
    from: 'Nothing here changes a single suggested percentage — it changes how numbers are presented to you.',
    to: 'Language, Temperature Scale and the separator setting change only how things are presented. '
      + 'Units of Measure can change suggestions: change it and save in the same visit, and the amounts on the Calculation tab are saved rescaled by 25.4 and every suggestion is recalculated, as step 2 explains.' },

  // ---- Enable / disable stations, Why is this station 0% ---------------------------------------
  { ids: 'enable-disable-stations/2/1',
    at: 'title',
    from: 'Toggling a parent cascades',
    to: 'Shift-click a parent to cascade' },
  { ids: 'enable-disable-stations/2/2',
    from: 'Hole and area rows carry the same switch, and turning one off turns off everything beneath it.',
    to: 'Hole and area rows carry the same switch. '
      + 'Turning one off takes everything beneath it out of the push and off the Enabled Stations map, but leaves their own switches as they were; '
      + 'hold Shift as you click to switch everything beneath it off too.' },
  { ids: 'enable-disable-stations/4/5',
    from: 'With the prompt suppressed, an area-level toggle silently changes every hole and station under it.',
    to: 'With the prompt suppressed, a Shift-click on an area switch changes every hole and station under it at once, with only a footer message to show for it.' },
  { ids: 'enable-disable-stations/verify/1',
    from: 'The stations you meant to disable show a grey switch.',
    to: 'The stations you meant to disable show a gray switch, or sit under a hole or area whose switch is gray.' },
  { ids: 'station-zero/3/2',
    from: 'A station with the Enable switch off is excluded from adjustment entirely.',
    to: 'A station with the Enable switch off is left out of every push, so Lynx keeps whatever percent adjust it already holds. '
      + 'Its suggestion is still calculated and shown, so being disabled does not by itself explain a zero.' },

  // ---- Push changes to Lynx, Reviewing changes, Push failures, Verify results ------------------
  { ids: 'push-to-lynx/1/2',
    from: 'The button reads the number of stations with an unpushed edit.',
    to: 'The button counts the enabled stations whose % Adj. differs from what Lynx holds, whether you edited it or left the suggestion, leaving out any already pushed today.' },
  { ids: 'push-to-lynx/5/2',
    from: 'Spatial Adjust first re-reads the current adjustments from Lynx for comparison, then writes station by station, then verifies.',
    to: 'Spatial Adjust writes station by station first, then reads the adjustments back from Lynx and checks each one against what it sent.' },
  { ids: 'push-to-lynx/6/3',
    from: 'A failure names the number of stations that could not be updated — check the Lynx connection and push those again rather than the whole set.',
    to: 'A failure names the number of stations that could not be updated. '
      + 'Check the Lynx connection, then reopen Push Changes: the failed stations are listed under Pushed Today, unticked, so tick them to send them again.' },
  { ids: 'push-to-lynx/verify/1',
    from: 'The Push Changes button is disabled and the pending count is zero.',
    to: 'Push Changes no longer counts the stations you sent. It is grayed out only if nothing else is waiting.' },
  { ids: 'push-to-lynx/verify/3',
    from: 'Pushed rows in the table now show the pushed icon rather than the pending one.',
    to: 'Rows you pushed successfully no longer show a push icon. '
      + 'A row that still shows the pushed-today icon was sent, but Lynx does not hold the value shown in the table.' },
  { ids: 'reviewing-changes/1/2',
    from: 'The button carries the number of stations with an unpushed edit.',
    to: 'The button carries the number of enabled stations whose % Adj. differs from what Lynx holds, whether you edited it or left the suggestion, leaving out any already pushed today.' },
  { ids: 'push-failures/4/2, push-failures/4/3',
    from: 'The stations that failed are still pending, so reopening Push Changes offers exactly them. '
      + 'Untick anything that already went out rather than sending the whole set a second time.',
    to: 'The stations that failed are still pending, but they count as pushed today, so reopening Push Changes lists them under Pushed Today, unticked. '
      + 'Tick them to send them again. '
      + 'The stations that went through are not listed again, so the whole set cannot go out twice; untick anything under Available to Push that you did not mean to send.' },
  { ids: 'verify-results/summary/2',
    from: 'Knowing them tells you whether a slow run is working or stuck.',
    to: 'Knowing them tells you what a slow run is waiting for.' },
  { ids: 'verify-results/5/3',
    from: 'Back on the dashboard the pending count is zero and the pushed-today counter has grown by what you sent.',
    to: 'Back on the dashboard, Push Changes no longer counts the stations you sent, and the pushed-today counter has grown by what you sent.' },
  { ids: 'verify-results/verify/2',
    from: 'The pending count is zero and the pushed-today counter increased.',
    to: 'Push Changes no longer counts the stations you sent, and the pushed-today counter increased.' },

  // ---- Target Profiles: Target profiles --------------------------------------------------------
  { ids: 'target-profiles/before/3',
    from: 'Applying a profile changes targets on every station, which recalculates every suggestion.',
    to: 'Applying a profile changes the target of every station it holds a value for, which recalculates their suggestions; stations not in the profile keep their targets.' },
  { ids: 'target-profiles/1/3',
    at: 'caption',
    from: 'Proposed Target Profiles tab in the settings dialog.',
    to: 'The Target Profiles tab in the settings dialog.' },
  { ids: 'target-profiles/2/2, target-profiles/2/3',
    from: 'Each profile shows when it was last applied and how many stations it covers. '
      + 'The active profile is the one whose targets are currently loaded; changing an individual station target after applying leaves the profile intact but no longer exactly matched.',
    to: 'Each profile shows when it was last updated, by renaming it or with Update from Current, and how many stations it holds. '
      + 'The profile you applied is named above the dashboard table, as “Summer Target Profile” for a profile named Summer; '
      + 'changing any station target afterwards leaves the stored profile intact but removes that label.' },
  { ids: 'target-profiles/2/4',
    at: 'caption',
    from: 'Three profiles: one active, one seasonal, one never applied.',
    to: 'Five profile slots; an empty slot shows -- for Last Updated and Stations.' },
  { ids: 'target-profiles/4/1',
    at: 'title',
    from: 'Save your current targets as a new profile',
    to: 'Save your current targets into a profile slot' },
  { ids: 'target-profiles/verify/1',
    from: 'The applied profile is marked active in the list.',
    to: 'The dashboard names the applied profile above the table.' },

  // ---- Target Profiles: Creating profiles ------------------------------------------------------
  // The guide title and its catalogue tile. Profiles cannot be created: the tab always holds five
  // slots per course, and the guide is about capturing the current targets into one of them.
  { ids: 'creating-profiles/tile/1',
    at: 'quoted',
    from: 'Creating profiles',
    to: 'Capturing profiles',
    expected: 2 },
  { ids: 'creating-profiles/2/3',
    at: 'caption',
    from: 'Proposed Target Profiles tab.',
    to: 'The Target Profiles tab.' },
  { ids: 'creating-profiles/3/4',
    at: 'caption',
    from: 'Three profiles, one active.',
    to: 'The Target Profiles tab with its five slots.' },
  { ids: 'creating-profiles/4/3',
    from: 'A profile captured while the course was partly disabled covers fewer stations than the course has, and applying it later leaves the rest untouched.',
    to: 'A profile holds every station the course had when it was captured, enabled or not. '
      + 'Stations added to the course later are not in it, and applying the profile leaves them untouched.' },

  // ---- Target Profiles: Updating profiles ------------------------------------------------------
  { ids: 'updating-profiles/2/1',
    at: 'title',
    from: 'Open the profile',
    to: 'Find the profile’s row' },
  { ids: 'updating-profiles/2/2',
    from: 'The active profile is the one whose targets were last loaded.',
    to: 'The profile last applied is named above the dashboard table until a station target is edited; the profile list does not mark it.' },
  { ids: 'updating-profiles/2/4',
    at: 'caption',
    from: 'The active profile, ready to be updated.',
    to: 'The profile’s row, with Update from Current.' },
  { ids: 'updating-profiles/3/1',
    at: 'title',
    from: 'Update rather than create',
    to: 'Update this slot or capture into another' },
  { ids: 'updating-profiles/3/3',
    from: 'Create a new profile instead when the change is for one event — a new name is cheaper than losing a good baseline.',
    to: 'Capture into a different slot instead when the change is for one event, and rename it to suit; '
      + 'with five slots per course that overwrites whatever the other slot held, so pick one you no longer need.' },
  { ids: 'updating-profiles/3/6',
    from: 'Create when the change is temporary.',
    to: 'Use another slot when the change is temporary.' },

  // ---- Target Profiles: Managing seasonal profiles ---------------------------------------------
  { ids: 'seasonal-profiles/1/1',
    at: 'title',
    from: 'Keep the list short',
    to: 'Plan what goes in the five slots' },
  { ids: 'seasonal-profiles/2/2',
    from: 'Applying rewrites every target and recalculates every suggestion.',
    to: 'Applying rewrites the target of every station in the profile and recalculates their suggestions; stations not in the profile keep their targets.' },
  { ids: 'seasonal-profiles/verify/1',
    from: 'The intended profile is marked active.',
    to: 'The dashboard names the intended profile above the table, for example “Summer Target Profile”.' },
];

// The four Target Profiles guides, flagged so the guide page and the catalogue can say the
// feature is new. The flag is data only; src/transform-export.mjs renders it as the label on the
// guide's note callout and as a text badge on the catalogue tile, and adds the badge to the tile's
// accessible name. It says "new", not "not shipping": at the IntelliDash production pin the
// settings dialog lists Target Profiles unconditionally, and the entry is absent from every
// earlier release branch. docs/text-corrections.md §11 gives the evidence.
export const NEW_IN_INTELLIDASH = ['target-profiles', 'creating-profiles', 'updating-profiles', 'seasonal-profiles'];

function flagNewInIntelliDash(s) {
  const keys = NEW_IN_INTELLIDASH.join('|');
  // GUIDES entries. Each opens on its key and then its category, which is what tells an entry
  // apart from the cursor-target arrays keyed on the same names.
  s = edit(s, {
    name: 'new in IntelliDash: guide flags',
    pattern: new RegExp(`(\\n  '(?:${keys})': \\{\\n    )(category: 'TARGET PROFILES',)`, 'g'),
    replace: '$1newInIntelliDash: true,\n    $2',
    expected: NEW_IN_INTELLIDASH.length,
  });
  // CATEGORIES tiles.
  return edit(s, {
    name: 'new in IntelliDash: tile flags',
    pattern: new RegExp(`(\\{ key: '(?:${keys})', )`, 'g'),
    replace: '$1newInIntelliDash: true, ',
    expected: NEW_IN_INTELLIDASH.length,
  });
}

export function apply(s) {
  for (const c of CORRECTIONS) s = fix(s, c);
  return flagNewInIntelliDash(s);
}
