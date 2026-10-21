// Followability rewrites for the Getting Started category: Dashboard overview, Understand Spatial
// Adjust and Map navigation.
//
// Each rewrite turns every step of a guide into the Do / You should see / If not shape in
// docs/writing-guide.md and adds the guide's `start`. Every edit is anchored on the step's exact
// current text (after every correction in src/transforms/), so an accuracy fix to a sentence this
// file replaces fails the build here rather than being overwritten. The step counts and orders do
// not change, so TARGETS keeps its length; the points that move are noted beside each guide.
//
// Sources. Every [[label]] is a key of src/i18n/labels.en-us.json. Every sentence rests on
// Verified claims in docs/claims/guides/<key>.json, or on IntelliDash at the production pin in
// docs/claims/sources.json (1aa4f286), cited below as path:line under
// site/src/app/spatial-adjust/components/ unless another root is given.
//
// These three guides used to carry most of the concept explanations. The glossary now defines the
// eight terms at their first use, and a `why` line carries one sentence of concept only where the
// reader needs it to act, so the steps are shorter than the prose they replace.

import { PAGE_DASHBOARD, NO_DIALOG, NEEDS_ACCOUNT, HOLE_LEVEL_IFNOT, stepOp } from './targets.mjs';

// ---- Dashboard overview ------------------------------------------------------------------------

/** Dashboard overview. Five steps, same count and order. Steps 1 to 4 are region steps: the toolbar's
 *  left end, the map, the chart's list and a table row are named by place, not by a label of their
 *  own. Step 2's point moves from the colour bar to the middle of the map, where the pins are; step
 *  4 shows the hole rows (as Editing station targets does) because its Do selects one.
 *  - 1: site name, course list only with more than one Lynx course, weather strip, AVG. VWC / HIGH /
 *    LOW summary (ledger dashboard-overview/1/2, /1/3, /1/4, /1/6; sa-main-toolbar.component.html:2-32).
 *  - 2: pins for stations scanned in the past seven days, filled when scanned today, clear when
 *    not; with no recent scan the map is empty (ledger /2/2, /2/3, /before/2).
 *  - 3: the chart's list at its top right, hidden at 1400 px and narrower, header follows the table
 *    row (ledger /3/2, /3/3, /3/4; sa-dash-chart.component.less:56-62, sa-dash-chart.component.html:14-24;
 *    sa-dashboard.component.less:91-103).
 *  - 4: hole row drills to its stations, the crumbs lead back up, modelled values are grey italic
 *    with a calculator icon (ledger /4/2, /4/3, /4/4, /4/7).
 *  - 5: the Push Changes count, the green counter, disabled when nothing is pending or a push is
 *    running (ledger /5/2, /5/3, /5/6). */
function dashboardOverview(src, h) {
  const guide = 'dashboard-overview';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: dashboard-overview start', guide,
    expect: { start: null },
    set: { start: { page: PAGE_DASHBOARD, open: NO_DIALOG, needs: NEEDS_ACCOUNT } },
  });
  s = h.editStep(s, {
    name: 'rewrite: dashboard-overview step 1', guide, title: 'Start with the toolbar',
    expect: {
      body: 'The left of the toolbar identifies where you are: site name, and a course selector that only appears when the site has more than one Lynx course. Next to it the weather strip shows current temperature, relative humidity, today’s ET and precipitation. It reports conditions; it is not where the suggested percentages come from. Option 1 uses no ET at all, and Option 2’s figure is calculated before the page loads.',
      tipLabel: 'Note.',
      tip: 'The average, high and low VWC figures summarise the areas of the selected course that were scanned today, whatever the table is showing.',
      do: null,
    },
    set: {
      do: 'Look at the left end of the toolbar, at the top of the screen.',
      see: 'It shows the site name, the weather strip, and the [[AVG. VWC]], [[HIGH]] and [[LOW]] figures.',
      ifNot: 'If there is no course list by the site name, the site has only one Lynx course.',
      why: 'The weather strip reports conditions. The suggestions do not come from it.',
      region: true,
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: dashboard-overview step 2', guide, title: 'Read the map',
    expect: {
      body: 'Each sprinkler of a station scanned in the past seven days is a pin. A pin scanned today is coloured by its measured VWC against the four moisture bands in the legend, and a pin last scanned on an earlier day is drawn clear. Disabled stations stay hidden while Layers is set to Enabled Stations, the default. Drag the handles on the colour bar to move the band boundaries — the map recolours immediately and the change is saved to your user preferences.',
      tipLabel: 'Variance view.',
      tip: 'The button beside the legend switches the pins from absolute moisture to variance — how far each station sits from its target rather than its raw reading.',
      do: null,
    },
    set: {
      do: 'Look at the map on the left of the screen.',
      see: 'Each sprinkler scanned in the past seven days is a pin, and pins scanned today are filled with a band colour.',
      ifNot: 'If you see no pins, the site has no scan from the past seven days. See Get fresh scan data.',
      why: 'A pin that is clear was last scanned on an earlier day.',
      region: true,
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: dashboard-overview step 3', guide, title: 'Use the chart for one area at a time',
    expect: {
      body: 'The chart above the table plots the areas, holes or stations you pick in its multiselect, whichever level the table is showing. On screens 1400 px wide or narrower the chart is hidden. Selecting a row in the table changes the chart header to that area or hole and its average moisture, so the chart and the table always describe the same thing.',
      do: null,
    },
    set: {
      do: 'Open the list at the top right of the chart.',
      see: 'The list holds the areas, holes or stations to plot, and the chart draws the ones you pick.',
      ifNot: 'If there is no chart, the screen is 1400 px wide or narrower, which hides it. Use a wider window.',
      why: 'Selecting a table row changes the chart header to match, so the chart and the table describe the same thing.',
      region: true,
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: dashboard-overview step 4', guide, title: 'Work in the table',
    expect: {
      body: 'The table is a drill-down: course, then areas, then holes, then stations. Breadcrumbs at the top left take you back up. At station level you get the editable columns — Target VWC, the current and suggested adjustment side by side, your own % Adj. value, and the Enable switch.',
      tipLabel: 'Measured or modelled.',
      tip: 'A greyed, italic Avg. VWC with a calculator icon means the value was estimated from the model rather than measured by a scan that day.',
      caption: 'Station-level rows for hole 3 of area AP.',
      do: null,
    },
    set: {
      tableLevel: 'holes',
      do: 'In the table, select a hole row.',
      see: 'The table lists that hole’s stations, with editable columns such as [[Target VWC]] and [[% Adj.]].',
      ifNot: 'If you went too far, select a name in the trail at the top left of the table to go back up.',
      why: 'A grey, italic [[Avg. VWC]] with a calculator icon is modelled, not measured by a scan that day.',
      region: true,
      caption: 'Hole rows for area AP. Selecting one shows its stations.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: dashboard-overview step 5', guide, title: 'Check the counts before you leave',
    expect: {
      body: 'The right of the toolbar is your work queue. Push Changes counts the enabled stations whose % Adj. differs from what Lynx holds, edited or not, leaving out any already pushed today; the green counter beside it counts stations already pushed today. When both are quiet, there is nothing outstanding.',
      do: null,
    },
    set: {
      do: 'At the right of the toolbar, read the number on [[Push Changes]].',
      see: 'The button shows a count, such as Push 6 Changes, and the green counter beside it shows how many went out today.',
      ifNot: 'If [[Push Changes]] is greyed out, nothing is waiting or a push is still running.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: dashboard-overview TARGETS', guide,
    expect: "[P.siteName, P.legendBar, P.chartSelect, cell('adj', 1), P.push]",
    replace: '[P.siteName, P.mapCenter, P.chartSelect, P.holeRow3, P.push]',
  });
  return s;
}

// ---- Understand Spatial Adjust -----------------------------------------------------------------

/** Understand Spatial Adjust. Five steps, same count and order; the points stay where they are.
 *  - 1: the address ends in /spatialadjust, all lowercase; a camelCase address redirects to the
 *    error page; access is checked per user first (ledger understand-spatial-adjust/1/2, /1/3, /1/4;
 *    spatial-adjust-routing.module.ts:12-15, spatial-adjust-guard.service.ts:22-24).
 *  - 2: Avg. VWC is the TurfRad mean for the station, the scan date sits by the station name, and a
 *    day with no scan shows the model's estimate in grey italics (ledger /2/3;
 *    dashboard-overview/4/7; sa-table-card.component.html:22-25).
 *  - 3: Target VWC is a whole number from 0 to 50 that the user sets; the gap to the measured value
 *    is what the calculation works on (ledger /3/2, /3/3, /3/4; sa-table-card.component.html:40-47).
 *  - 4: Suggested is the output of the chain: delta, plus ET, capped at the daily maximum, divided
 *    by the Lynx reference amount (ledger /4/2, /4/3; SpatialAdjustService.cs:3033-3043). The
 *    in-one-line tip is dropped.
 *  - 5: nothing is written to Lynx except by the push (ledger /5/2, /5/4, /5/5). The Needs expert
 *    sentence on how Lynx applies a percent adjust value (ledger /5/3) is dropped. */
function understandSpatialAdjust(src, h) {
  const guide = 'understand-spatial-adjust';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: understand-spatial-adjust start and verify', guide,
    expect: {
      start: null,
      verify: "['You can name the three inputs: measured VWC, target VWC and today\\u2019s ET.', 'You know that nothing reaches Lynx until Push Changes is used.']",
    },
    set: {
      start: {
        page: PAGE_DASHBOARD,
        open: NO_DIALOG,
        needs: 'An IntelliDash sign-in with Spatial Adjust access, on a desktop or tablet.',
      },
      verify: [
        'A station row shows its Avg. VWC, its Target VWC and a Suggested percent.',
        'Nothing reaches Lynx until you select Push Changes.',
      ],
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: understand-spatial-adjust step 1', guide, title: 'It lives inside IntelliDash',
    expect: {
      body: 'The route is /spatialadjust, all lowercase, inside the IntelliDash site. A camelCase URL does not resolve — it redirects to the generic error page. Access is checked per user before the view loads.',
      do: null,
    },
    set: {
      do: 'Look at the address in your browser.',
      see: 'It ends in /spatialadjust, all lowercase, and the Spatial Adjust toolbar shows at the top of the page.',
      ifNot: 'If you see an error page, check the address. A camelCase address such as /spatialAdjust does not work.',
      why: 'IntelliDash checks each user’s access before the page loads.',
      region: true,
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understand-spatial-adjust step 2', guide, title: 'TurfRad supplies the measurement',
    expect: {
      body: 'Each station’s Avg. VWC comes from a TurfRad moisture scan — the mean volumetric water content measured across the station, with the date it was captured beside the station name.',
      do: null,
    },
    set: {
      do: 'In the table, find the [[Avg. VWC]] column.',
      see: 'Each station shows the mean VWC that a TurfRad scan measured, with the scan date beside the station name.',
      ifNot: 'If a value is grey and italic, no scan arrived today. It is modelled instead.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understand-spatial-adjust step 3', guide, title: 'You supply the target',
    expect: {
      body: 'Target VWC is the moisture you want that station to hold. It is yours to set, station by station, between 0 and 50 percent. The gap between measured and target is what the calculation works on.',
      do: null,
    },
    set: {
      do: 'In a station row, find the [[Target VWC]] box.',
      see: 'It holds a whole number from 0 to 50 that you set for that station.',
      ifNot: HOLE_LEVEL_IFNOT,
      why: 'The gap between the measured value and the target is what the calculation works on.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understand-spatial-adjust step 4', guide, title: 'Spatial Adjust does the arithmetic',
    expect: {
      body: 'The difference between target and measured moisture becomes an amount of water, today’s ET is added, the daily maximum caps it, and the result is divided by the Lynx reference amount to give a percentage.',
      tipLabel: 'In one line.',
      tip: 'Suggested % = the applied amount ÷ the Lynx reference amount × 100, rounded.',
      do: null,
    },
    set: {
      do: 'Find the [[Suggested]] column, next to [[Current]].',
      see: 'Each station shows a percent: the result of the calculation.',
      ifNot: 'If [[Suggested]] shows the same top value on many rows, the daily maximum is capping it.',
      why: 'It adds today’s ET to the delta, caps the amount, and divides by the Lynx Reference Amount.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = h.editStep(s, {
    name: 'rewrite: understand-spatial-adjust step 5', guide, title: 'Lynx runs the water',
    expect: {
      body: 'Spatial Adjust never waters anything. It writes a percent adjust value onto each station in Lynx, and Lynx applies that percentage to the station’s programmed run time. Nothing changes until you push.',
      do: null,
    },
    set: {
      do: 'At the right of the toolbar, find [[Push Changes]].',
      see: 'It is the only control that sends your changes to Lynx.',
      ifNot: 'If [[Push Changes]] is greyed out, no change is waiting.',
      why: 'Spatial Adjust never waters anything, and nothing changes in Lynx until you push.',
    },
    drop: ['body'],
  });
  return s;
}

// ---- Map navigation ----------------------------------------------------------------------------

/** Map navigation. Five steps, same count and order; the points stay where they are, except that
 *  step 5 keeps its pin point, because See describes the map's outline.
 *  - 1: pins scanned today are filled with their band colour, the defaults are 0-5, 6-19, 20-30 and
 *    above 30, a pin last scanned earlier is clear, disabled stations are hidden under Enabled
 *    Stations (ledger map-navigation/1/2 to /1/5).
 *  - 2: release a handle on the colour bar and the map recolours; the bands are saved to the user's
 *    preferences, not the site (ledger /2/2 to /2/4, /before/1; sa-map-overlay.component.ts:50-53).
 *  - 3: the button beside the legend is "Toggle VWC or Variance View", variance is measured minus
 *    target in three bands, unscanned pins stay clear (ledger /3/2 to /3/4).
 *  - 4: Layers chooses All Stations or Enabled Stations, the default on production (ledger /4/2,
 *    /4/3, /4/6). The remembered-choice tip is dropped; the first Before you start item says it.
 *  - 5: selecting a row zooms the map to that pin and outlines it, and selecting a pin selects the
 *    row (ledger /5/2; sa-dash-map.component.ts:36-44, :332-335, :475-487). */
function mapNavigation(src, h) {
  const guide = 'map-navigation';
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: map-navigation start', guide,
    expect: { start: null },
    set: {
      start: {
        page: PAGE_DASHBOARD,
        open: NO_DIALOG,
        needs: 'A scan from the past seven days, so that the map shows pins.',
      },
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: map-navigation step 1', guide, title: 'Pins are coloured by measured moisture',
    expect: {
      body: 'Each sprinkler of a station scanned in the past seven days is a pin at its own coordinates. A pin scanned today is filled with the colour of the moisture band its reading falls into, and a pin last scanned on an earlier day is drawn clear. Disabled stations are hidden while Layers is set to Enabled Stations, the default. Four bands by default: 0–5, 6–19, 20–30, and above 30 percent.',
      do: null,
    },
    set: {
      do: 'Look at the pins on the map.',
      see: 'Pins scanned today are filled with a band colour: 0–5, 6–19, 20–30 or above 30 percent.',
      ifNot: 'If a pin is clear, it was last scanned on an earlier day. A disabled station has no pin while [[Layers]] is set to [[Enabled Stations]].',
      region: true,
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: map-navigation step 2', guide, title: 'Move the band boundaries',
    expect: {
      body: 'The colour bar under the legend has draggable handles. Move one and the map recolours when you let go — useful when your course sits mostly inside one band and everything looks the same colour.',
      do: null,
    },
    set: {
      do: 'Drag a handle on the colour bar under the legend.',
      see: 'When you let go, the map recolours to the new band boundary.',
      ifNot: 'If nothing changes, let go of the handle. The map recolours when you release it.',
      why: 'Your boundaries are saved to your own user preferences, not to the site.',
      region: true,
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: map-navigation step 3', guide, title: 'Switch to variance',
    expect: {
      body: 'The button beside the legend toggles between VWC and variance. Variance colours each pin by how far it sits from its own target instead of by its raw reading, which is the view you want when targets differ across the course.',
      do: null,
    },
    set: {
      do: 'Select the variance button, [[Toggle VWC or Variance View]], beside the legend.',
      see: 'The pins now show how far each station is from its target, in three bands.',
      ifNot: 'If a pin stays clear, it was not scanned today, so it has no variance.',
      why: 'Use variance when targets differ across the course.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: map-navigation step 4', guide, title: 'Filter with Layers',
    expect: {
      body: 'Layers chooses which stations are drawn: all of them, or only the enabled ones. Disabled stations are not being adjusted, so hiding them leaves only the heads your push will affect.',
      tipLabel: 'Remembered.',
      tip: 'Layers saves your choice to your user preferences. Until you have made one, the map shows Enabled Stations only, so it can draw fewer pins than the All Stations tab counts.',
      do: null,
    },
    set: {
      title: 'Open Layers',
      do: 'Select [[Layers]], beside the variance button.',
      see: 'A box opens with two choices, [[All Stations]] and [[Enabled Stations]].',
      ifNot: 'If the box does not open, select [[Layers]] again. Selecting anywhere else closes it.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = stepOp(s, h, {
    name: 'rewrite: map-navigation insert step 5 (Choose the stations)', guide, title: 'Open Layers', op: 'after',
    step: {
      title: 'Choose the stations', fig: 'map', layersOpen: true,
      do: 'Select [[Enabled Stations]] or [[All Stations]].',
      see: 'The map draws only the enabled stations, or every station.',
      ifNot: 'If a station you expect has no pin, [[Layers]] may be set to [[Enabled Stations]], the default.',
      why: 'Disabled stations are not being adjusted, so hiding them leaves only the heads your push will affect.',
      caption: 'Layers, with All Stations and Enabled Stations.',
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: map-navigation step 6', guide, title: 'Map and table stay in sync',
    expect: {
      body: 'Selecting a station in the table highlights it on the map, and selecting a pin selects the row. Use whichever is faster to find the head you mean.',
      do: null,
    },
    set: {
      do: 'In the table, select a station row.',
      see: 'The map zooms to that station’s pin and outlines it.',
      ifNot: 'If no pin is outlined, the station may be disabled and hidden. Set [[Layers]] to [[All Stations]].',
      why: 'Selecting a pin selects its row too, so use whichever is faster.',
      region: true,
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: map-navigation TARGETS', guide,
    expect: '[P.mapCenter, P.legendBar, P.varianceBtn, P.layersBtn, P.mapPin]',
    replace: '[P.mapCenter, P.legendBar, P.varianceBtn, P.layersBtn, P.layersOption, P.mapPin]',
  });
  return s;
}

/** The Layers choices, measured in the reproduction with the Layers box open: Enabled Stations is
 *  the second of the two radio labels. */
function layersPoint(src, h) {
  return h.edit(src, {
    name: 'rewrite: layers option point in P',
    pattern: /layersBtn: \[724, 955\],/,
    replace: () => 'layersBtn: [724, 955], layersOption: [669, 888],',
  });
}

/** Applies every Getting Started rewrite, in catalogue order. Registered in src/rewrite/index.mjs. */
export function apply(src, h) {
  let s = src;
  s = layersPoint(s, h);
  s = dashboardOverview(s, h);
  s = understandSpatialAdjust(s, h);
  s = mapNavigation(s, h);
  return s;
}
