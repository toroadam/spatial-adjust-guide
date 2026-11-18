// The recreation component after src/transform-app.mjs, exercised without a browser: the script of
// the transformed SpatialAdjustApp export is evaluated with a stub renderer, and its methods are
// called directly.
//   - review item C14: a tick on an area or hole row ticks every station beneath it and unticks them
//   - review item C8: the chart's bars and average come from the pins the map draws, in range
// node --test video/capture/recreation-app.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { transformApp } from '../../src/transform-app.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');

// Evaluate the component. `live` puts a window.__sa in scope, which is what turns live mode on.
function load({ live = true, props = {}, lvState = {} } = {}) {
  const html = transformApp(fs.readFileSync(path.join(ROOT, 'SpatialAdjustApp.dc.html'), 'utf8'));
  const code = /<script type="text\/x-dc" data-dc-script[^>]*>\n([\s\S]*?)<\/script>/.exec(html)[1];
  const h = (type, p, ...kids) => ({ type, props: p || {}, kids: kids.flat(Infinity) });
  class DCLogic { constructor() { this.props = {}; this.state = {}; } setState(patch) { this.state = Object.assign({}, this.state, patch); } }
  const win = live ? { __sa: {}, __saLiveInit: {} } : {};
  const make = new Function('React', 'DCLogic', 'window', `${code}\nreturn { Component, STATIONS, MARKERS };`);
  const { Component, STATIONS, MARKERS } = make({ createElement: h }, DCLogic, win);
  const c = new Component();
  c.base = props;
  c.props = props;
  c.state = { lv: lvState };
  return { c, STATIONS, MARKERS, h };
}

const find = (node, pred, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  (node.kids || []).forEach((k) => find(k, pred, out));
  return out;
};
// The host re-renders with the live patch over the props (renderVals does this in the real component).
const rows = (c) => { c.props = Object.assign({}, c.base, c.lv()); return c.renderRows(); };
const ticks = (c) => find({ kids: rows(c) }, (n) => n.props && n.props['data-sa-tick'] !== undefined);

test('live mode: a tick on the area row ticks every station, and a second click unticks them', () => {
  const { c, STATIONS } = load({ props: { tableLevel: 'areas' } });
  const [row] = ticks(c);
  assert.equal(row.props['data-sa-tick'], 'AP');
  assert.equal(row.props.role, 'checkbox');
  assert.equal(row.props['aria-label'], 'Select area AP');
  assert.equal(row.props['aria-checked'], 'false');
  row.props.onClick();
  assert.deepEqual(c.ep().selectedRows, STATIONS.map((s) => s.name));
  assert.equal(ticks(c)[0].props['aria-checked'], 'true');
  ticks(c)[0].props.onClick();
  assert.deepEqual(c.ep().selectedRows, []);
  assert.equal(ticks(c)[0].props['aria-checked'], 'false');
});

test('live mode: a tick on a hole row ticks only that hole\'s stations, shows the dash for a partial hole, and unticks', () => {
  const { c } = load({ props: { tableLevel: 'holes' } });
  const hole = (n) => ticks(c).find((t) => t.props['data-sa-tick'] === n);
  assert.equal(hole('3').props['aria-label'], 'Select hole 3');
  hole('3').props.onClick();
  assert.deepEqual(c.ep().selectedRows, ['3AP1', '3AP2']);
  assert.equal(hole('3').props['aria-checked'], 'true');
  assert.equal(hole('4').props['aria-checked'], 'false');
  hole('6').props.onClick();
  assert.deepEqual(c.ep().selectedRows, ['3AP1', '3AP2', '6AP1', '6AP2']);
  // One station of hole 6 unticked by hand leaves the hole row partial, and a click then completes it.
  c.setLv({ selectedRows: ['3AP1', '3AP2', '6AP1'] });
  assert.equal(hole('6').props['aria-checked'], 'mixed');
  hole('6').props.onClick();
  assert.deepEqual(c.ep().selectedRows, ['3AP1', '3AP2', '6AP1', '6AP2']);
  hole('3').props.onClick();
  assert.deepEqual(c.ep().selectedRows, ['6AP1', '6AP2']);
});

test('the cascade reaches the station level and the Bulk Adjust link', () => {
  const { c } = load({ props: { tableLevel: 'holes' } });
  ticks(c).find((t) => t.props['data-sa-tick'] === '3').props.onClick();
  c.props = c.base;
  const vals = c.renderVals();
  assert.match(vals.bulkLinkStyle, /^((?!opacity:0\.6).)*$/);
  c.setLv({ tableLevel: 'station', hole: '3' });
  const boxes = find({ kids: rows(c) }, (n) => n.kids && n.kids.includes('✓'));
  assert.equal(boxes.length, 2);
});

test('outside live mode the area and hole rows draw the empty box and have no tick handler', () => {
  const { c } = load({ live: false, props: { tableLevel: 'holes', selectedRows: ['3AP1'] } });
  assert.equal(ticks(c).length, 0);
});

test('chart (C8): bars are the map\'s pins in the selected holes, the header average is their mean, and every bar has a pin', () => {
  const { c, MARKERS } = load({ live: false });
  const bars = c.chartReadings();
  assert.ok(bars.length >= 8);
  const mean = bars.reduce((a, b) => a + b, 0) / bars.length;
  assert.equal(c.chartAvgText(), mean.toFixed(2));
  assert.equal(c.renderVals().chartAvg, mean.toFixed(2));
  assert.notEqual(c.renderVals().chartAvg, '33.70');
  // Every bar is the reading of a pin the map draws (enabled stations only).
  const drawn = MARKERS.filter((m) => m[3] !== 'off').map((m) => m[2]);
  for (const b of bars) assert.ok(drawn.includes(b), `bar ${b} has a pin`);
  // The selection takes in the map's low and middle bands as well as green and blue.
  const colors = new Set(bars.map((b) => (b <= 5 ? 'red' : b <= 19 ? 'yellow' : b <= 30 ? 'green' : 'blue')));
  assert.deepEqual([...colors].sort(), ['blue', 'green', 'red', 'yellow']);
  // Chart bars colored by the same function the pins use.
  const chart = c.renderChart();
  const fills = find(chart, (n) => n.props && n.props.style && n.props.style.background).map((n) => n.props.style.background);
  assert.equal(fills.length, bars.length);
  assert.ok(fills.includes('#E11837') && fills.includes('#F3D43B'));
});

test('chart (C8): an explicit chartAvg still wins, and the live course level shows the computed average', () => {
  const { c } = load({ live: false, props: { chartAvg: '12.34' } });
  assert.equal(c.renderVals().chartAvg, '12.34');
  const live = load({ props: { tableLevel: 'holes' } });
  live.c.up(0);
  assert.equal(live.c.state.lv.chartAvg, live.c.chartAvgText());
});

test('demo numbers stay in range: targets 0 to 50, suggestions at most 125 percent', () => {
  const { STATIONS } = load({ live: false });
  for (const s of STATIONS) {
    assert.ok(s.target >= 0 && s.target <= 50, `${s.name} target ${s.target}`);
    assert.ok(s.suggested <= 125 && s.adj <= 125, `${s.name} suggestion ${s.suggested}`);
  }
});

test('live mode: the lone course crumb of a station-level figure goes up to the holes; a trail of three still goes up one level', () => {
  const { c } = load({ props: { tableLevel: 'station', crumb: 'Riverbend National' } });
  c.crumbProps('Riverbend National', 0, ['Riverbend National']).onClick();
  assert.equal(c.state.lv.tableLevel, 'holes');
  const d = load({ props: { tableLevel: 'station' } });
  d.c.crumbProps('AP', 1, ['Riverbend National', 'AP', '6']).onClick();
  assert.equal(d.c.state.lv.tableLevel, 'holes');
});
