// The shared click guard (scripts/lib/guarded-click.mjs), without a browser.
// node --test video/capture/guarded-click.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GuardRefusal, guardedClick, refuseReason } from '../../scripts/lib/guarded-click.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const MODULE = path.join(REPO, 'scripts', 'lib', 'guarded-click.mjs');

test('refuses write-like names', () => {
  for (const name of ['Push changes', 'Push Changes', 'Save', 'Save Changes', 'Apply', 'Apply to all', 'Delete station',
    'Update from TurfRad', 'DISCARD CHANGES', 'Confirm', 'Send feedback', 'Submit', 'Reset']) {
    assert.match(refuseReason({ name }) ?? '', /write guard/, name);
  }
});

test('refuses an icon mismatch, and a missing icon when one is expected', () => {
  assert.match(refuseReason({ name: '', iconId: 'rotate', expectedIconId: 'cog' }), /icon "rotate", expected "cog"/);
  assert.match(refuseReason({ name: '', iconId: null, expectedIconId: 'cog' }), /icon "none", expected "cog"/);
  assert.equal(refuseReason({ name: '', iconId: 'cog', expectedIconId: 'cog' }), null);
});

test('refuses a write-like name even when it is in the allowlist', () => {
  assert.match(refuseReason({ name: 'Save', allow: ['Save'] }), /write guard/);
  assert.match(refuseReason({ name: 'Push Changes', allow: ['Push Changes', 'Zoom in'] }), /write guard/);
});

test('accepts read-only names', () => {
  for (const name of ['Zoom in', 'Next page', 'Dashboard']) {
    assert.equal(refuseReason({ name }), null, name);
    assert.equal(refuseReason({ name, allow: ['Zoom in', 'Next page', 'Dashboard'] }), null, name);
  }
});

test('the allowlist, when given, is required and exact', () => {
  assert.match(refuseReason({ name: 'Zoom out', allow: ['Zoom in'] }), /not in the allowlist/);
  assert.match(refuseReason({ name: '', allow: ['Zoom in'] }), /no accessible name/);
  assert.equal(refuseReason({ name: '  zoom   IN ', allow: ['Zoom in'] }), null);
});

test('refuses a name that does not match the expected name', () => {
  assert.match(refuseReason({ name: 'Push Changes', expectedName: 'Zoom in', allow: ['Zoom in'] }), /resolved to "Push Changes", expected "Zoom in"/);
  assert.equal(refuseReason({ name: 'Zoom in', expectedName: 'Zoom in', allow: ['Zoom in'] }), null);
});

test('a declared demo-mode click needs demoVerified', () => {
  const allowWrites = [{ name: 'Push Changes', target: 'role=button[name="Push Changes"]', reason: 'shows the unsupported message' }];
  assert.match(refuseReason({ name: 'Push Changes', allowWrites, demoVerified: false }), /Demo Mode was not verified/);
  assert.match(refuseReason({ name: 'Push Changes', allowWrites }), /Demo Mode was not verified/);
  assert.equal(refuseReason({ name: 'Push Changes', allowWrites, demoVerified: true }), null);
  assert.equal(refuseReason({ name: 'Push Changes', allowWrites: ['Push Changes'], demoVerified: true, allow: [] }), null);
  // Declaring one write does not allow another.
  assert.match(refuseReason({ name: 'Save', allowWrites, demoVerified: true }), /not a declared demo-mode click/);
  // demoVerified must be exactly true.
  assert.match(refuseReason({ name: 'Push Changes', allowWrites, demoVerified: 'yes' }), /not verified/);
});

// A minimal stand-in for a Playwright page: locator(sel).first() returns an element stub whose
// evaluate() answers describeElement and whose click() records the call.
function fakePage(elements) {
  const clicks = [];
  const waits = [];
  const page = {
    clicks,
    waits,
    locator: (sel) => ({
      first: () => {
        const el = elements[sel];
        return {
          count: async () => (el ? 1 : 0),
          evaluate: async () => ({ name: el.name, iconId: el.iconId ?? null }),
          click: async (opts) => { clicks.push({ sel, opts }); },
        };
      },
    }),
    waitForTimeout: async (ms) => { waits.push(ms); },
  };
  return page;
}

test('guardedClick clicks an allowed element and settles', async () => {
  const page = fakePage({ '#zoom': { name: 'Zoom in' } });
  const info = await guardedClick(page, '#zoom', { why: 'zoom', allow: ['Zoom in'], settleMs: 1200 });
  assert.deepEqual(info, { name: 'Zoom in', iconId: null });
  assert.equal(page.clicks.length, 1);
  assert.equal(page.clicks[0].opts.timeout, 8000);
  assert.deepEqual(page.waits, [1200]);
});

test('guardedClick refuses a write-like element before clicking', async () => {
  const page = fakePage({ '#push': { name: 'Push changes' } });
  await assert.rejects(guardedClick(page, '#push', { why: 'push' }), (err) => {
    assert.ok(err instanceof GuardRefusal);
    assert.match(err.message, /refusing to click \(push\): "Push changes" matches the write guard/);
    return true;
  });
  assert.equal(page.clicks.length, 0);
});

test('guardedClick refuses an icon mismatch before clicking (the harvest gear case)', async () => {
  const page = fakePage({ '.gear': { name: '', iconId: 'rotate' } });
  await assert.rejects(guardedClick(page, '.gear', { why: 'open settings', expectedIconId: 'cog' }), GuardRefusal);
  assert.equal(page.clicks.length, 0);
  const ok = fakePage({ '.gear': { name: '', iconId: 'cog' } });
  await guardedClick(ok, '.gear', { why: 'open settings', expectedIconId: 'cog' });
  assert.equal(ok.clicks.length, 1);
});

test('guardedClick refuses a missing element', async () => {
  const page = fakePage({});
  await assert.rejects(guardedClick(page, '#nothing', { why: 'nothing' }), /selector not found/);
});

test('guardedClick hands the click to dispatch when given, and never clicks itself', async () => {
  const page = fakePage({ '#push': { name: 'Push Changes' } });
  const dispatched = [];
  await guardedClick(page, '#push', {
    allowWrites: ['Push Changes'], demoVerified: true, name: 'Push Changes',
    dispatch: async (el, info) => { dispatched.push(info.name); },
  });
  assert.deepEqual(dispatched, ['Push Changes']);
  assert.equal(page.clicks.length, 0);
  await assert.rejects(guardedClick(page, '#push', {
    allowWrites: ['Push Changes'], demoVerified: false, dispatch: async () => dispatched.push('second'),
  }), GuardRefusal);
  assert.deepEqual(dispatched, ['Push Changes']);
});

test('importing the module opens no connection and launches nothing', () => {
  const source = readFileSync(MODULE, 'utf8');
  assert.doesNotMatch(source, /from ['"]playwright/);
  assert.doesNotMatch(source, /connectOverCDP|\.launch\(|node:net|node:http/);
  // Import it in a fresh process with no browser available: it must load and exit at once.
  const res = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const m = await import(${JSON.stringify(MODULE)}); if (typeof m.guardedClick !== 'function') process.exit(3);`], {
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(REPO, 'no-browsers-here') },
    timeout: 20000,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
});

test('the fidelity harvest uses the shared guard', () => {
  const harvest = readFileSync(path.join(REPO, 'scripts', 'fidelity-harvest.mjs'), 'utf8');
  assert.match(harvest, /from '\.\/lib\/guarded-click\.mjs'/);
  assert.doesNotMatch(harvest, /WRITES\.test\(/, 'the harvest must not keep its own copy of the name check');
  assert.doesNotMatch(harvest, /allowWrites\s*:/, 'the harvest never passes allowWrites');
  const check = spawnSync(process.execPath, ['--check', path.join(REPO, 'scripts', 'fidelity-harvest.mjs')], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
});
