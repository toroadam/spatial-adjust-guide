// The capture safety gates (video/capture/gates.mjs) and the director's static guarantees, with no
// browser: entry URL, CDP endpoint, --launch, request classification, capture config, the plan
// the page receives, and the dry run.
// node --test video/capture/gates.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  CaptureConfigError, EXIT, MAX_DEMO_LOGINS, RECREATION_HOSTS, RECREATION_PORT,
  checkCdpEndpoint, checkEntryUrl, checkLaunchAllowed, classifyRequest, loadCaptureConfig, validateCaptureConfig,
} from './gates.mjs';
import { buildPlan, clickVerdicts } from './director.mjs';
import { parseEpisode } from '../lib/episode-schema.mjs';

const HERE = import.meta.dirname;
const HOST = 'fixture.example.invalid';
const API = 'api.fixture.example.invalid';
const cfg = { allowedHosts: [HOST], apiHosts: [API], authHosts: ['sso.example.invalid'], blockHosts: ['telemetry.example.invalid'], demoLoginPath: '/auth/demo' };
const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');

test('the entry gate accepts only https://<allowed host>[/<prefix>]/spatialadjust/demo, exactly', () => {
  for (const url of [`https://${HOST}/spatialadjust/demo`, `https://${HOST}/x/spatialadjust/demo`]) {
    assert.deepEqual(checkEntryUrl(url, cfg), { ok: true }, url);
  }
  const refused = {
    [`http://${HOST}/spatialadjust/demo`]: /must be https/,
    'https://other.example.invalid/spatialadjust/demo': /not in allowedHosts/,
    'https://intellidash.example.invalid/spatialadjust/demo': /not in allowedHosts/,
    [`https://${HOST}/spatialadjust`]: /must end \/spatialadjust\/demo/,
    [`https://${HOST}/demo`]: /must end \/spatialadjust\/demo/,
    [`https://${HOST}/spatialadjust/demo/`]: /must end \/spatialadjust\/demo/,
    [`https://${HOST}/spatialadjust/demo?x=1`]: /query string/,
    [`https://${HOST}/spatialadjust/demo?`]: /query string/,
    [`https://${HOST}/spatialadjust/demo#top`]: /fragment/,
    [`https://user:pw@${HOST}/spatialadjust/demo`]: /credentials/,
    'not a url': /not a URL/,
  };
  for (const [url, why] of Object.entries(refused)) {
    const r = checkEntryUrl(url, cfg);
    assert.equal(r.ok, false, url);
    assert.match(r.reason, why, url);
  }
});

test('plain http is accepted only for a loopback fixture host that is listed', () => {
  const local = { allowedHosts: ['127.0.0.1:4100'] };
  assert.equal(checkEntryUrl('http://127.0.0.1:4100/spatialadjust/demo', local).ok, true);
  assert.equal(checkEntryUrl('http://127.0.0.1:4101/spatialadjust/demo', local).ok, false);
  assert.equal(checkEntryUrl('http://10.0.0.5:4100/spatialadjust/demo', { allowedHosts: ['10.0.0.5:4100'] }).ok, false);
});

test('the recreation loads only from the local recreation server', () => {
  assert.equal(RECREATION_HOSTS.length, 2);
  if (!process.env.SA_RECREATION_PORT) assert.equal(RECREATION_PORT, 8124);
  for (const url of [`http://localhost:${RECREATION_PORT}/`, `http://127.0.0.1:${RECREATION_PORT}/#/dashboard-overview`]) {
    assert.equal(checkEntryUrl(url, {}, { source: 'recreation' }).ok, true, url);
  }
  for (const url of [`https://localhost:${RECREATION_PORT}/`, 'http://localhost:9/', `http://${HOST}/`, `http://${HOST}:${RECREATION_PORT}/`]) {
    assert.equal(checkEntryUrl(url, cfg, { source: 'recreation' }).ok, false, url);
  }
  assert.equal(checkEntryUrl(`https://${HOST}/spatialadjust/demo`, cfg, { source: 'live' }).ok, false);
});

test('the owner\'s Chrome is reached over loopback only', () => {
  for (const url of ['http://127.0.0.1:9222', 'http://localhost:9222', 'http://127.0.0.1:9222/']) assert.equal(checkCdpEndpoint(url).ok, true, url);
  for (const url of ['http://192.0.2.10:9222', 'ws://127.0.0.1:9222', 'https://127.0.0.1:9222', 'http://127.0.0.1', 'http://127.0.0.1:9222/json', `http://${HOST}:9222`, 'http://u:p@127.0.0.1:9222']) {
    assert.equal(checkCdpEndpoint(url).ok, false, url);
  }
});

test('--launch is refused while any allowed host is not loopback', () => {
  assert.equal(checkLaunchAllowed({ allowedHosts: ['127.0.0.1:4100'] }).ok, true);
  assert.equal(checkLaunchAllowed({ allowedHosts: ['localhost:4100', '127.0.0.1:4100'] }).ok, true);
  assert.match(checkLaunchAllowed({ allowedHosts: [HOST] }).reason, /--launch is refused/);
  assert.match(checkLaunchAllowed({ allowedHosts: ['127.0.0.1:4100', HOST] }).reason, /--launch is refused/);
  assert.equal(checkLaunchAllowed({ allowedHosts: [] }).ok, false);
  assert.equal(checkLaunchAllowed({}, { source: 'recreation' }).ok, true);
});

const req = (method, url, extra = {}) => ({ method, url, isNavigation: false, isMainFrame: false, ...extra });

test('before arming: reads and the demo sign-in pass, any other write ends the take', () => {
  const pre = (r, state = {}) => classifyRequest(r, { armed: false, cfg, state });
  assert.equal(pre(req('POST', `https://${API}/api/auth/demo`)).kind, 'demo-login');
  assert.equal(pre(req('POST', `https://${HOST}/auth/demo`)).kind, 'demo-login');
  assert.equal(pre(req('POST', `https://${API}/api/auth/demo`), { demoLogins: MAX_DEMO_LOGINS }).action, 'abort');
  assert.equal(pre(req('POST', 'https://elsewhere.example.invalid/auth/demo')).end, EXIT.WRITE);
  assert.equal(pre(req('PUT', `https://${API}/api/auth/demo`)).end, EXIT.WRITE);
  assert.equal(pre(req('POST', `https://${API}/api/spatialadjust/push`)).end, EXIT.WRITE);
  assert.equal(pre(req('GET', `https://${HOST}/spatialadjust/demo`, { isNavigation: true, isMainFrame: true })).action, 'allow');
  assert.equal(pre(req('POST', 'https://sso.example.invalid/token')).kind, 'auth');
});

test('after arming: only GET, HEAD and OPTIONS pass; writes end with 3, a new document with 4', () => {
  const post = (r) => classifyRequest(r, { armed: true, cfg, state: {} });
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
    const v = post(req(m, `https://${API}/api/spatialadjust/x`));
    assert.equal(v.action, 'abort', m);
    assert.equal(v.end, EXIT.WRITE, m);
  }
  assert.equal(post(req('POST', `https://${API}/api/auth/demo`)).end, EXIT.WRITE, 'no demo sign-in after arming');
  for (const m of ['GET', 'HEAD', 'OPTIONS']) assert.equal(post(req(m, `https://${API}/api/spatialadjust/x`)).action, 'allow', m);
  assert.equal(post(req('GET', 'https://tiles.example.invalid/1/2/3.png')).action, 'allow');
  const doc = post(req('GET', `https://${HOST}/spatialadjust`, { isNavigation: true, isMainFrame: true }));
  assert.equal(doc.action, 'abort');
  assert.equal(doc.end, EXIT.DOCUMENT);
  assert.equal(post(req('GET', `https://${HOST}/frame.html`, { isNavigation: true, isMainFrame: false })).action, 'allow');
  assert.equal(post(req('POST', 'https://sso.example.invalid/token')).action, 'allow');
  const quiet = post(req('POST', 'https://telemetry.example.invalid/track'));
  assert.equal(quiet.action, 'abort');
  assert.equal(quiet.end, null);
  assert.equal(post(req('GET', 'data:image/png;base64,AAAA')).action, 'allow');
  assert.equal(post(req('POST', 'ftp://example.invalid/x')).end, EXIT.WRITE);
  assert.equal(post(req('GET', 'ftp://example.invalid/x')).end, null);
});

test('the capture config is validated field by field and the example is valid', () => {
  const example = JSON.parse(read('capture.example.json'));
  const valid = validateCaptureConfig(example);
  assert.equal(valid.cdpEndpoint, 'http://127.0.0.1:9222');
  assert.ok(Object.isFrozen(valid));
  for (const h of [...example.allowedHosts, ...example.apiHosts, ...example.blockHosts]) assert.match(h, /\.invalid$/, 'the example names placeholder hosts only');
  const bad = [
    [{ ...example, allowedHosts: [] }, /allowedHosts/],
    [{ ...example, allowedHosts: [`https://${HOST}`] }, /allowedHosts/],
    [{ ...example, entryUrl: undefined }, /entryUrl/],
    [{ ...example, entryUrl: 'https://dev.example.invalid/spatialadjust/demo?x=1' }, /entryUrl/],
    [{ ...example, cdpEndpoint: 'http://192.0.2.10:9222' }, /cdpEndpoint/],
    [{ ...example, signInTimeoutMs: -1 }, /signInTimeoutMs/],
    [{ ...example, demoLoginPath: 'auth/demo' }, /demoLoginPath/],
    [{ ...example, recreationUrl: 'http://dev.example.invalid/' }, /recreationUrl/],
    [[], /JSON object/],
  ];
  for (const [input, why] of bad) assert.throws(() => validateCaptureConfig(input), (err) => err instanceof CaptureConfigError && why.test(err.message));
  assert.throws(() => loadCaptureConfig(path.join(HERE, 'fixtures', 'no-such-config.json')), /not found\. Copy video\/capture\/capture\.example\.json/);
});

test('the director navigates exactly once and never reloads; the runtime never navigates', () => {
  const director = read('director.mjs');
  assert.equal(director.match(/\.goto\(/g)?.length, 1, 'exactly one page.goto');
  assert.doesNotMatch(director, /\.reload\(|goBack\(|goForward\(|location\.(assign|replace|reload)|location\.href\s*=/);
  const runtime = read('director-runtime.js');
  assert.doesNotMatch(runtime, /\.goto\(|\.reload\(|location\.(href|assign|replace|reload)|history\.(back|go|forward|pushState|replaceState)/);
  // The write guard pattern reaches the page from scripts/lib/writes.mjs at run time; it is never copied.
  assert.match(director, /WRITES\.source/);
  assert.doesNotMatch(runtime, /save\|apply\|push/);
});

test('the plan the page receives carries no selector, and click verdicts follow the guard', () => {
  const ep = parseEpisode(path.join(HERE, '..', 'lib', 'fixtures', 'episode.demo-write.valid.json'));
  const { plan, targets, seconds } = buildPlan(ep);
  const json = JSON.stringify(plan);
  for (const t of targets) assert.ok(!json.includes(t.target), `selector ${t.target} leaked into the page plan`);
  assert.ok(seconds >= ep.beats.reduce((s, b) => s + b.hold, 0));
  const [push] = clickVerdicts(ep);
  assert.equal(push.refused, false);
  assert.match(push.verdict, /only when Demo Mode is verified/);
});

test('a dry run exits 0 without a browser and prints no configured host', () => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'director.mjs'), '--episode', path.join(HERE, '..', 'lib', 'fixtures', 'episode.valid.json'), '--dry-run'], {
    encoding: 'utf8',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(HERE, 'fixtures', 'no-browsers-here'), SA_CAPTURE_CONFIG: path.join(HERE, 'capture.example.json') },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dry run: no browser started, nothing written/);
  assert.match(r.stdout, /capture config .*: valid \(1 allowed host/);
  assert.doesNotMatch(r.stdout + r.stderr, /example\.invalid/);
});
