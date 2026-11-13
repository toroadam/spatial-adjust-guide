// The recreation map treatment (video/capture/recreation-map.mjs and recreation-map.js): the config check, the JPEG size
// reader, the media-root rule, and the page-side styling on a small fixture page (Playwright's Chromium, no network).
// node --test video/capture/recreation-map.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { RecreationMapError, installRecreationMap, jpegSize, validateConfig } from './recreation-map.mjs';

const pins = Array.from({ length: 3 }, (_, i) => ({ x: 10 + i * 20, y: 30, name: `${i + 1}AP1` }));
const cfg = { file: 'backdrop.jpg', zoom: 17.2, diameter: 20, view: { x0: 0, y0: 0, w: 200, h: 100 }, pins, total: 40, seed: 3,
  chains: [{ id: 'A', hole: 3, mean: 27, pts: [[5, 10], [50, 40], [95, 90]] }], greens: [{ x: 70, y: 20, n: 6, r: 20 }] };

// A 16 x 8 baseline JPEG header is enough for the size reader.
const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffc0000b08000800100111000ffd9'.replace(/(..)/g, '$1 ').trim().split(' ').map((h) => parseInt(h, 16)));

test('jpegSize reads width and height from the SOF marker', () => {
  assert.deepEqual(jpegSize(jpeg), { width: 16, height: 8 });
  assert.throws(() => jpegSize(Buffer.from('not a jpeg at all, just text')), RecreationMapError);
});

test('validateConfig wants a bare file name, a zoom, a diameter, a view and pins', () => {
  assert.doesNotThrow(() => validateConfig(cfg));
  for (const bad of [{ ...cfg, file: '../x.jpg' }, { ...cfg, file: 'a/b.jpg' }, { ...cfg, zoom: 'x' }, { ...cfg, view: { x0: 0 } }, { ...cfg, pins: [{ x: 1 }] }, null]) {
    assert.throws(() => validateConfig(bad), RecreationMapError);
  }
});

test('a backdrop that is not in the media root is an error, not a silent drawn map', async () => {
  await assert.rejects(() => installRecreationMap({}, { ...cfg, file: 'no-such-backdrop.jpg' }));
});

const spots = Array.from({ length: 60 }, (_, i) => [8 + (i % 30) * 3, 20 + Math.floor(i / 30) * 40, Math.floor(i / 12)]);
for (const [label, config] of [['drawn chains', cfg], ['mask-derived spots', { ...cfg, chains: undefined, greens: undefined, spots }]]) {
test(`the page script lays the ground under the card and turns pins into circles that keep their text (${label})`, async (t) => {
  let browser;
  try { browser = await chromium.launch(); } catch { t.skip('Chromium is not installed here'); return; }
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.addInitScript((c) => { window.__saRecMap = { ...c, backdrop: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', imageWidth: 200, imageHeight: 100 }; }, config);
    await page.addInitScript({ path: path.join(import.meta.dirname, 'recreation-map.js') });
    await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(`<body><div data-sa-frame><div id=card style="position:relative;width:400px;height:300px">
      <div style="position:absolute;inset:0;background:#123"></div><svg style="position:absolute;inset:0" width=10 height=10></svg>
      <div id=pins style="position:absolute;inset:0">${['#E11837', '#42CE11', '#3079F0'].map((c, i) => `<div style="position:absolute;left:${i}%;top:1%;width:30px;height:30px;background:${c};opacity:.9">${[4, 28, 50][i]}</div>`).join('')}</div>
      <div id=ov style="position:absolute;bottom:2rem;left:50%;z-index:450"><div><div><div class=sa-ps style="background:#E11837">0-5%</div><div class=sa-ps style="background:#F3D43B">6-19%</div><div class=sa-ps style="background:#42CE11">20-30%</div><div class=sa-ps style="background:#3079F0">&gt; 30%</div></div><div><div></div></div></div>LAYERS</div></div></div></body>`));
    await page.waitForFunction(() => document.querySelector('.sa-rm-sat'));
    const r = await page.evaluate(() => {
      const pin = document.querySelector('#pins').children[1], cs = getComputedStyle(pin);
      return { text: pin.textContent, name: pin.getAttribute('data-sa-name'), left: pin.style.left, w: pin.style.width, bg: pin.style.backgroundColor, border: cs.borderTopColor,
        hidden: [...document.querySelector('#card').children].filter((c) => c.hasAttribute('data-sa-rm-hide')).length,
        dec: document.querySelectorAll('.sa-rm-dec').length, decText: [...document.querySelectorAll('.sa-rm-dec')].some((d) => d.textContent !== ''),
        names: new Set([...document.querySelectorAll('.sa-rm-dec')].map((d) => d.getAttribute('data-sa-name'))).size,
        attr: document.querySelector('.sa-rm-attr').textContent, zoom: !!document.querySelector('.sa-rm-zoom') };
    });
    assert.equal(r.text, '28', 'the pin keeps its own text, so text="28" targets still resolve');
    assert.equal(r.name, '2AP1');
    assert.equal(r.w, '20px');
    assert.match(r.bg, /rgba\(66, 206, 17, 0\.5\)/, 'band colour at fill opacity 0.5');
    assert.match(r.border, /rgba\(255, 255, 255, 0\.4\)/, 'white outline at 0.4');
    assert.equal(r.dec, 37, 'the field totals cfg.total: the 3 app pins plus the generated circles');
    assert.equal(r.decText, false, 'generated circles carry their label in CSS, so no text target collides');
    assert.equal(r.names, 37, 'generated names are unique');
    assert.equal(r.hidden, 2, 'the drawn aerial layers are hidden');
    assert.match(r.attr, /Leaflet.*OpenStreetMap contributors.*Google Maps/);
    assert.ok(r.zoom);
    // a re-render that writes a new colour is restyled, not left solid
    await page.evaluate(() => { document.querySelector('#pins').children[1].style.background = '#E11837'; });
    await page.waitForFunction(() => /rgba\(225, 24, 55, 0\.5\)/.test(document.querySelector('#pins').children[1].style.backgroundColor));
  } finally {
    await browser.close();
  }
});
}
