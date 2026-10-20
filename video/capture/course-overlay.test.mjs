// Tests for video/capture/course-overlay.js on video/capture/fixtures/overlay-page.html.
//
// The "real" names are the invented placeholders in video/lib/fixtures/*.fixture.json; the real
// local maps are never opened. Even so, the test never prints one: text read back from the page is
// passed through redact() before any assertion, so a failure shows "[denylisted #N]", and scans
// are compared as index lists.
//
// The script is installed the way the capture director installs it: page.addInitScript before the
// page loads, then window.__saOverlayInstall(pairs, identity) once the page has rendered.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { loadLocalMaps, redact, findDenylisted } from '../lib/local-maps.mjs';

const HERE = import.meta.dirname;
const OVERLAY = path.join(HERE, 'course-overlay.js');
const PAGE = pathToFileURL(path.join(HERE, 'fixtures', 'overlay-page.html')).href;
const FIXTURES = path.join(HERE, '..', 'lib', 'fixtures');
const course = JSON.parse(readFileSync(path.join(HERE, '..', 'brand', 'course.json'), 'utf8'));

const maps = loadLocalMaps({
  sanitizePath: path.join(FIXTURES, 'sanitize.fixture.json'),
  overlayPath: path.join(FIXTURES, 'overlay.fixture.json'),
  warn: () => {},
});
// The loader's sealed arrays go to page.evaluate as they are, as the director passes them.
const PAIRS = maps.pairs;
const DENYLIST = [...maps.denylist];
// The fixture's denylist-only term (no fictional pair), resolved through the identity instead.
const SUPER_INDEX = DENYLIST.indexOf('Placeholder Superintendent') + 1;
const WITH_IDENTITY = [...PAIRS, ['Placeholder Superintendent', '{superintendent}']]
  .sort((a, b) => b[0].length - a[0].length);

const safe = (value) => (typeof value === 'string' ? redact(value, maps) : value);

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function openFixture() {
  const page = await browser.newPage();
  await page.addInitScript({ path: OVERLAY });
  await page.goto(PAGE);
  return page;
}

// Text and attribute values from the page, redacted before they reach an assertion.
async function read(page, fn, arg) {
  const out = await page.evaluate(fn, arg);
  if (Array.isArray(out)) return out.map(safe);
  if (out && typeof out === 'object') return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, safe(v)]));
  return safe(out);
}

const settle = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));

test('loading the script defines only the installer and rewrites nothing', async () => {
  const page = await openFixture();
  const state = await page.evaluate(() => ({
    install: typeof window.__saOverlayInstall,
    arity: window.__saOverlayInstall.length,
    overlay: typeof window.__saOverlay,
  }));
  assert.deepEqual(state, { install: 'function', arity: 2, overlay: 'undefined' });
  const untouched = await page.evaluate(() => document.body.innerText);
  assert.ok(findDenylisted(untouched, maps).length > 0, 'the fixture still shows its placeholder names before install');
  await page.close();
});

test('install rewrites text nodes, the five attributes, form values and the title; scan returns []', async () => {
  const page = await openFixture();
  const scriptBefore = await read(page, () => document.getElementById('data').textContent);
  const result = await page.evaluate(([p, id]) => window.__saOverlayInstall(p, id), [WITH_IDENTITY, course]);
  assert.equal(result.pairs, WITH_IDENTITY.length);
  assert.ok(result.replaced > 0);
  assert.deepEqual(result.warnings, []);

  assert.deepEqual(await page.evaluate((d) => window.__saOverlay.scan(d), DENYLIST), []);
  assert.equal(await page.evaluate(() => window.__saOverlay.scan.length), 1);

  const got = await read(page, () => {
    const $ = (s) => document.querySelector(s);
    return {
      course: $('#course').textContent.trim(),
      crumb: $('#crumbs span').textContent,
      accountText: $('#account').textContent,
      accountTitle: $('#account').title,
      accountLabel: $('#account').getAttribute('aria-label'),
      placeholder: $('#search').placeholder,
      valueAttr: $('#search').getAttribute('value'),
      valueProp: $('#search').value,
      notes: $('#notes').value,
      alt: $('#logo').alt,
      row1: $('#stations tr:nth-child(1) td:nth-child(2)').textContent,
      row2: $('#stations tr:nth-child(2) td:nth-child(2)').textContent,
      row3: $('#stations tr:nth-child(3) td:nth-child(2)').textContent,
      station: $('#stations tr:nth-child(1) td:nth-child(1)').textContent,
      super: $('#super').textContent,
      ordinary: $('#ordinary').textContent,
      dialogLabel: $('#dialog').getAttribute('aria-label'),
      dialogText: $('#dialog p').textContent,
      title: document.title,
    };
  });
  assert.deepEqual(got, {
    course: `◉ ${course.name}`,
    crumb: course.name,
    accountText: 'JORDAN FIELD',
    accountTitle: 'Jordan Field',
    accountLabel: 'Account menu for Jordan Field',
    placeholder: `Search ${course.name} stations`,
    valueAttr: 'riverbend-1042',
    valueProp: 'riverbend-1042',
    notes: 'Notes for Riverbend Annex',
    alt: 'Riverbend Annex logo',
    row1: 'Riverbend Annex',
    row2: 'RIVERBEND ANNEX',
    row3: 'Riverbend',
    station: '3AP1',
    super: `Superintendent: ${course.superintendent}`,
    ordinary: 'Field moisture readings for the whole course',
    dialogLabel: `Push changes to ${course.name}`,
    dialogText: `Send 6 Percent Adjustments to Lynx for ${course.name}?`,
    title: `${course.name} | Spatial Adjust`,
  });
  // Scripts are code, not screen text: left alone.
  assert.equal(await read(page, () => document.getElementById('data').textContent), scriptBefore);
  await page.close();
});

test('a node added 50 ms later is rewritten, text and attributes alike', async () => {
  const page = await openFixture();
  await page.evaluate(([p, id]) => window.__saOverlayInstall(p, id), [WITH_IDENTITY, course]);
  await page.evaluate(() => {
    setTimeout(() => {
      const li = document.createElement('li');
      li.id = 'late';
      li.textContent = 'Pushed by Sample Person Name';
      li.setAttribute('title', 'Example Real Club Annex');
      const input = document.createElement('input');
      input.id = 'late-input';
      input.setAttribute('placeholder', 'Example Real Club');
      document.querySelector('main').append(li, input);
    }, 50);
  });
  await page.waitForFunction(() => document.getElementById('late') !== null);
  await settle(page);
  const got = await read(page, () => ({
    text: document.getElementById('late').textContent,
    title: document.getElementById('late').title,
    placeholder: document.getElementById('late-input').placeholder,
  }));
  assert.deepEqual(got, { text: 'Pushed by Jordan Field', title: 'Riverbend Annex', placeholder: course.name });
  assert.deepEqual(await page.evaluate((d) => window.__saOverlay.scan(d), DENYLIST), []);
  await page.close();
});

test('text and attributes the page changes later are rewritten again', async () => {
  const page = await openFixture();
  await page.evaluate(([p, id]) => window.__saOverlayInstall(p, id), [WITH_IDENTITY, course]);
  const got = await read(page, async () => {
    const crumb = document.querySelector('#crumbs span');
    crumb.firstChild.data = 'Example Real Club Annex';              // characterData
    document.getElementById('account').setAttribute('aria-label', 'Sample Person Name'); // attribute
    document.getElementById('search').setAttribute('value', 'EXR-1042');
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      crumb: crumb.textContent,
      label: document.getElementById('account').getAttribute('aria-label'),
      value: document.getElementById('search').getAttribute('value'),
    };
  });
  assert.deepEqual(got, { crumb: 'Riverbend Annex', label: 'Jordan Field', value: 'riverbend-1042' });
  assert.deepEqual(await page.evaluate((d) => window.__saOverlay.scan(d), DENYLIST), []);
  await page.close();
});

test('scan reports what is left by 1-based index only, including a name split across elements', async () => {
  const page = await openFixture();
  // Without the identity pair the denylist-only superintendent placeholder has no replacement.
  await page.evaluate((p) => window.__saOverlayInstall(p), PAIRS);
  assert.deepEqual(await page.evaluate((d) => window.__saOverlay.scan(d), DENYLIST), [SUPER_INDEX]);
  // A name split across elements is not rewritten, but innerText joins it and scan catches it.
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.innerHTML = 'Sample <b>Person Name</b>';
    document.querySelector('main').append(p);
  });
  await settle(page);
  const hits = await page.evaluate((d) => window.__saOverlay.scan(d), DENYLIST);
  assert.deepEqual(hits, [DENYLIST.indexOf('Sample Person Name') + 1, SUPER_INDEX].sort((a, b) => a - b));
  assert.ok(hits.every((n) => Number.isInteger(n)), 'indices, never terms');
  await page.close();
});

test('short terms match whole words only; a fictional name containing its real one is rewritten once', async () => {
  const page = await openFixture();
  const got = await page.evaluate(async () => {
    const p = document.createElement('p');
    p.id = 'words';
    p.textContent = 'Brook, Brookside and BROOK';
    const q = document.createElement('p');
    q.id = 'grow';
    q.textContent = 'Ridge';
    document.querySelector('main').append(p, q);
    const res = window.__saOverlayInstall([['Brook', 'Glen'], ['Ridge', 'Ridge Hollow']]);
    window.__saOverlay.refresh();
    q.firstChild.data = 'Ridge';
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.__saOverlay.refresh();
    return { words: p.textContent, grow: q.textContent, warnings: res.warnings.length };
  });
  assert.deepEqual(got, { words: 'Glen, Brookside and GLEN', grow: 'Ridge Hollow', warnings: 1 });
  await page.close();
});

test('identity tokens resolve from course.json, and errors name positions, not names', async () => {
  const page = await openFixture();
  const got = await page.evaluate(([id]) => {
    for (const [i, text] of ['First Person', 'Second Person', 'Third Person', 'Course Code'].entries()) {
      const p = document.createElement('p');
      p.id = `t${i}`;
      p.textContent = text;
      document.body.append(p);
    }
    window.__saOverlayInstall([
      ['First Person', '{person}'], ['Second Person', '{person}'], ['Third Person', '{person:5}'], ['Course Code', '{customerNumber}'],
    ], id);
    return [0, 1, 2, 3].map((i) => document.getElementById(`t${i}`).textContent);
  }, [course]);
  assert.deepEqual(got, [course.people[0], course.people[1], course.people[5], course.customerNumber]);

  for (const bad of [[['Example Real Club', '{nickname}']], [['Example Real Club', '{person:99}']], [['Example Real Club', '{name}']]]) {
    const withIdentity = bad[0][1] !== '{name}';
    const message = await page.evaluate(([p, id]) => {
      try { window.__saOverlayInstall(p, id); return 'no error'; } catch (err) { return err.message; }
    }, [bad, withIdentity ? course : undefined]);
    assert.match(message, /^course-overlay: pair #1 /);
    assert.equal(findDenylisted(message, maps).length, 0, 'the error message names no denylisted term');
  }
  await page.close();
});

test('course-overlay.js holds no names: none from the fixture maps, none from course.json', () => {
  const src = readFileSync(OVERLAY, 'utf8');
  assert.equal(findDenylisted(src, maps).length, 0);
  const own = [course.name, course.shortName, course.superintendent, course.customerNumber, ...course.people];
  assert.deepEqual(own.filter((name) => src.includes(name)), []);
});
