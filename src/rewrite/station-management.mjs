// Followability rewrites for the Station Management category: Enable and disable stations, and
// Station details.
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
// The chevron and the calculator icons are drawn without a label, so the steps that point at them
// are region steps (region: true): their Do line names the icon in words, and the reader finds it
// by sight.

import { insertSteps } from './insert-steps.mjs';

const START_PAGE = 'The Spatial Adjust dashboard, at /spatialadjust, with the table showing the stations of one hole.';
const NO_DIALOG = 'No dialog open.';
const SCAN_DATA = 'A Spatial Adjust account on a site with TurfRad scan data.';

/** Adds the named cursor points these guides need to P, after the last entry of the figure's table
 *  of points. Each was measured on the rendered figure (1920x1080 space):
 *  - layersEnabled: the Enabled Stations choice in the open Layers list.
 *  - kidCalc2: the orange calculator icon on the second sprinkler row of 6AP1.
 *  - parentCalc: the grey calculator icon beside the station's Avg. VWC. */
function addPoints(src, h) {
  return h.edit(src, {
    name: 'rewrite: station management cursor points',
    pattern: /diagLynx: \[1053, 424\]/,
    replace: () => 'diagLynx: [1053, 424], layersEnabled: [669, 888], '
      + 'kidCalc2: [1487, 836], parentCalc: [1490, 751]',
  });
}

// --- Enable and disable stations ------------------------------------------------------------------

/** Enable and disable stations, 5 steps to 6: switch one station, Shift-click a hole, Continue,
 *  tick the box that silences the prompt, open Layers, show Enabled Stations.
 *
 *  - Each row at every level carries a switch under the Enable column header, STRINGS.ENABLE
 *    (sa-dash-table.component.html:26; sa-table-card.component.html:67-69). A click changes that
 *    row alone; only a Shift-click on an area or hole switch cascades, and a station row never does
 *    (sa-table-card.component.ts:336). Selecting an area or hole name goes down a level
 *    (sa-table-card.component.ts:290-304, sa-dash-table.component.ts:108-118).
 *  - The push list leaves out a disabled station, however dry it reads
 *    (sa-dashboard.component.ts:615-641); its switch is a grey track when off.
 *  - The Shift-click opens the Cascade box, which names the hole or area and every station beneath
 *    it (sa-confirm-cascade-dlg.component.html:14-19, .ts:35-42). Continue applies it and the
 *    footer reports the cascade complete; Cancel flips the switch back with no server call
 *    (sa-table-card.component.ts:350-360, :532-534).
 *  - The opt-out box is saved only when Continue is selected (sa-confirm-cascade-dlg.component.ts:
 *    52-61); no screen turns it back on (dash-user-preferences.model.ts:87).
 *  - The map's Layers list offers All Stations and Enabled Stations (sa-map-overlay.component.html:
 *    34-62); Enabled Stations is the default on production (environment.toro-prod.ts:88). A station
 *    stays on the map while any one of its sprinkler records is enabled
 *    (sa-dash-map.component.ts:351-374).
 *  The "Careful." callout on the suppressed prompt stays: it is a warning the reader must see at
 *  that step. The sentence "That is usually what you want when a hole is out of play." was
 *  Needs expert and is cut. */
function enableDisableStations(src, h) {
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: enable-disable-stations start',
    guide: 'enable-disable-stations',
    expect: { start: null },
    set: {
      start: {
        page: START_PAGE,
        open: NO_DIALOG,
        needs: SCAN_DATA,
      },
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: enable-disable-stations step 1 (Toggle a single station)',
    guide: 'enable-disable-stations',
    title: 'Toggle a single station',
    expect: {
      body: 'The switch in the Enable column takes effect on that station alone. Station 5AP1 is off here, which is '
        + 'why it has no pending adjustment however dry it reads.',
      caption: 'A disabled station: the switch on its row is grey.',
    },
    set: {
      caption: 'A disabled station: the switch on its row is gray.',
      do: 'In the [[Enable]] column, select the switch on a station’s row.',
      see: 'The switch turns gray, and the station is switched off.',
      ifNot: 'If the rows are areas or holes, you are not at station level. Select a row name to go down until stations show.',
      why: 'A station that is switched off is left out of the push, however dry it reads.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: enable-disable-stations step 2 (Shift-click a parent)',
    guide: 'enable-disable-stations',
    title: 'Shift-click a parent to cascade',
    expect: {
      body: 'Hole and area rows carry the same switch. Turning one off takes everything beneath it out of the push and '
        + 'off the Enabled Stations map, but leaves their own switches as they were; hold Shift as you click to '
        + 'switch everything beneath it off too. That is usually what you want when a hole is out of play.',
      caption: 'Hole rows carry their own Enable switch.',
    },
    set: {
      do: 'Hold Shift and select the switch in the [[Enable]] column on a hole row.',
      see: 'A box opens that names the hole and every station beneath it.',
      ifNot: 'If no box opens and the stations beneath did not change, Shift was not held. '
        + 'Without Shift, the switch changes only its own row.',
      why: 'Without Shift, a hole that is off leaves the stations beneath it out of the push, but their own switches stay as they were.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: enable-disable-stations step 3 (Confirm the cascade)',
    guide: 'enable-disable-stations',
    title: 'Confirm the cascade',
    expect: {
      body: 'Because a cascade can affect dozens of heads, Spatial Adjust asks first and names the scope: this hole and '
        + 'every station beneath it. Continue applies it; Cancel leaves everything as it was.',
      caption: 'The cascade confirmation names exactly what will change.',
    },
    set: {
      do: 'Select [[Continue]] to switch off the hole and every station beneath it.',
      see: 'The box closes, and the footer says the cascade is complete.',
      ifNot: 'If this is not the change you want, select [[Cancel]]. The switch goes back to how it was, and nothing is saved.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: enable-disable-stations step 4 (Silence the prompt)',
    guide: 'enable-disable-stations',
    title: 'Silence the prompt once you trust it',
    expect: {
      body: 'The checkbox suppresses the confirmation for future cascades. It is stored in your own preferences, so it '
        + 'hides the prompt for you and not for your colleagues.',
      caption: 'The same dialog for an area-level enable.',
      tipLabel: 'Careful.',
      tip: 'With the prompt suppressed, a Shift-click on an area switch changes every hole and station under it at once, '
        + 'with only a footer message to show for it.',
    },
    set: {
      do: 'Tick [[Don’t ask to confirm cascading enable/disable changes again]] before you select [[Continue]].',
      see: 'The box is ticked, and after [[Continue]] a Shift-click no longer asks you first.',
      ifNot: 'If you select [[Cancel]] with the box ticked, nothing is saved, and the prompt keeps coming.',
      why: 'The choice is saved for you only, and no screen on the dashboard turns the prompt back on.',
    },
    drop: ['body'],
  });
  s = insertSteps(s, h, {
    name: 'rewrite: enable-disable-stations step 5 (Open Layers)',
    before: 'Check the result on the map',
    steps: [
      { title: 'Open Layers on the map', fig: 'map',
        do: 'Select [[Layers]] at the bottom of the map.',
        see: 'A list opens with [[All Stations]] and [[Enabled Stations]].',
        ifNot: 'If the list does not open, select [[Layers]] again.',
        caption: 'Layers, at the bottom of the map.' },
    ],
  });
  s = h.editStep(s, {
    name: 'rewrite: enable-disable-stations step 6 (Show Enabled Stations)',
    guide: 'enable-disable-stations',
    title: 'Check the result on the map',
    expect: {
      body: 'Switch Layers to Enabled Stations to see only the heads still in adjustment. Anything that disappeared is '
        + 'out — deliberately or otherwise.',
      caption: 'Layers filtered to enabled stations only.',
    },
    set: {
      do: 'Select [[Enabled Stations]] in the list.',
      see: 'The map shows only the stations that are still switched on.',
      ifNot: 'If a station you switched off is still on the map, another sprinkler of that station may still be on.',
      why: 'A station that has gone from the map will not be pushed.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: enable-disable-stations targets',
    guide: 'enable-disable-stations',
    expect: "[cell('en', 4), P.holeEnable, P.cascadeContinue, P.cascadeCheckbox, P.layersBtn]",
    replace: "[cell('en', 4), P.holeEnable, P.cascadeContinue, P.cascadeCheckbox, P.layersBtn, P.layersEnabled]",
  });
  return s;
}

// --- Station details ------------------------------------------------------------------------------

/** Station details, 4 steps to 5: spot the chevron, expand the station, read the station's
 *  average, spot a modelled sprinkler, spot the parent's icon.
 *
 *  - A chevron sits between the row checkbox and the station name only when the station has more
 *    than one sprinkler record, and turns to point down when the row is expanded
 *    (sa-table-card.component.html:16-21, sa-table-card.component.less:33-35). Selecting the chevron
 *    toggles the row; selecting the name only selects the station (sa-table-card.component.ts:290-309).
 *  - A child row reads <station>-1, <station>-2, with its own scan date and VWC, and nothing there
 *    is editable (sa-table-card.component.html:76-97).
 *  - The station's Avg. VWC is the plain mean of its sprinklers scanned today or, under Option 2,
 *    modelled; under Option 1 a sprinkler not scanned today is left out and shows "--"
 *    (sa-dash-table.component.ts:369-383, sa-table-card.component.html:88-91).
 *  - A modelled child carries an orange calculator icon, and the parent carries a grey one beside
 *    its average (sa-table-card.component.html:29-31, :88; sa-table-card.component.less:121-130).
 *  The "Why it matters." callout was Needs expert (whether a wide spread between heads is a
 *  coverage fault) and is cut; its verified half, that one dry head can hide in an average, is
 *  the why line of step 3. */
function stationDetails(src, h) {
  let s = src;
  s = h.editGuide(s, {
    name: 'rewrite: station-details start',
    guide: 'station-details',
    expect: { start: null },
    set: {
      start: {
        page: START_PAGE,
        open: NO_DIALOG,
        needs: SCAN_DATA + ' Only a station with more than one sprinkler paired to it can be expanded.',
      },
    },
  });
  s = h.editStep(s, {
    name: 'rewrite: station-details step 1 (Spot the expandable rows)',
    guide: 'station-details',
    title: 'Spot the expandable rows',
    expect: {
      body: 'A chevron beside the station name means the station has more than one sprinkler paired to it. Without the '
        + 'chevron, the row is the whole story.',
      caption: 'Station 6AP1 has a chevron: more than one sprinkler.',
    },
    set: {
      region: true,
      do: 'Look down the station names in the table for a chevron beside one.',
      see: 'A chevron sits between the row’s checkbox and the station name.',
      ifNot: 'If no station has a chevron, none of them has more than one sprinkler. There is nothing to expand here.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: station-details step 2 (Expand the station)',
    guide: 'station-details',
    title: 'Expand the station',
    expect: {
      body: 'Each child row is named for its parent and numbered, and carries its own scan date and its own measured '
        + 'moisture. Nothing else is editable at sprinkler level — the target and the adjustment belong to the station.',
      caption: 'Two sprinklers under 6AP1, each with its own reading.',
    },
    set: {
      region: true,
      do: 'Select the chevron beside the station name.',
      see: 'Each sprinkler shows on its own row, named for the station and numbered, with its own scan date and moisture.',
      ifNot: 'If the row did not open, you selected the station name, which only selects the station. Select the chevron.',
      why: 'Nothing else is editable at sprinkler level, because the target and the adjustment belong to the station.',
    },
    drop: ['body'],
  });
  s = h.editStep(s, {
    name: 'rewrite: station-details step 3 (The parent value is an average)',
    guide: 'station-details',
    title: 'The parent value is an average',
    expect: {
      body: 'The station’s Avg. VWC is the mean of its sprinklers. Two heads reading 31.4 and 30.4 give a station '
        + 'average of 30.9 — and a station that looks fine can still hide one dry head.',
      caption: 'Mean of the children, shown on the parent row.',
      tipLabel: 'Why it matters.',
      tip: 'A station at target with a wide spread between heads is a coverage problem, not an irrigation-amount problem.',
    },
    set: {
      caption: 'Average of the children, shown on the parent row.',
      do: 'Compare the station’s [[Avg. VWC]] with the readings on its sprinkler rows.',
      see: 'The station shows the average of its sprinklers, so 31.4 and 30.4 give 30.9.',
      ifNot: 'If the average does not match the rows below it, a sprinkler was left out. '
        + 'Only sprinklers scanned today, or modeled under [[Option 2]], count.',
      why: 'A station that looks fine can still hide one dry sprinkler.',
    },
    drop: ['body', 'tipLabel', 'tip'],
  });
  s = insertSteps(s, h, {
    name: 'rewrite: station-details step 4 (Spot a modelled sprinkler)',
    before: 'Watch for a modelled child',
    steps: [
      { title: 'Spot a modeled sprinkler', fig: 'table', expandStation: '6AP1', region: true,
        do: 'Look at the sprinkler rows for an orange calculator icon beside a reading.',
        see: 'That sprinkler’s value is modeled, because its last scan is older than today.',
        ifNot: 'If no sprinkler has the icon, each was scanned today, or the site uses [[Option 1]]. '
          + 'Under [[Option 1]], a sprinkler not scanned today shows --.',
        caption: 'The second sprinkler was last scanned two days ago.' },
    ],
  });
  s = h.editStep(s, {
    name: 'rewrite: station-details step 5 (Check the parent row)',
    guide: 'station-details',
    title: 'Watch for a modelled child',
    expect: {
      body: 'A child whose scan is older than today shows a modelled value marked with an orange calculator icon, and '
        + 'the parent average is then part measurement and part model. The parent row carries a grey calculator icon '
        + 'beside its average, so you can tell it includes a modelled reading.',
      caption: 'The second sprinkler was last scanned two days ago.',
    },
    set: {
      title: 'Check the parent row',
      region: true,
      do: 'Look for a gray calculator icon beside the station’s [[Avg. VWC]].',
      see: 'The icon shows that the average includes a modeled reading.',
      ifNot: 'If the row has no icon, no sprinkler under it is modeled.',
      caption: 'The gray icon on the parent row marks an average that includes a modeled reading.',
    },
    drop: ['body'],
  });
  s = h.editTargets(s, {
    name: 'rewrite: station-details targets',
    guide: 'station-details',
    expect: "[P.chevron5, P.kid1, cell('vwc', 5), P.kid2]",
    replace: "[P.chevron5, P.chevron5, cell('vwc', 5), P.kidCalc2, P.parentCalc]",
  });
  return s;
}

/** Applies every Station Management rewrite, in order. Registered in src/rewrite/index.mjs. */
export function apply(src, h) {
  let s = src;
  s = addPoints(s, h);
  s = enableDisableStations(s, h);
  s = stationDetails(s, h);
  return s;
}
