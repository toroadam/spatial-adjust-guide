// Capture safety gates: pure checks the director (video/capture/director.mjs) applies before and
// during a take. Nothing here touches a browser, the network or the file system except
// loadCaptureConfig, which reads one JSON file. See video/capture/SAFETY.md for why each rule
// exists.
//
//   checkEntryUrl(url, cfg, { source })   layer 1: the only address the director may load
//   checkCdpEndpoint(url)                 the owner's Chrome is reached over loopback only
//   checkLaunchAllowed(cfg, { source })   --launch (Playwright's own Chromium) is for fixtures
//                                         and the local recreation only
//   classifyRequest(req, { armed, cfg, state })
//                                         layer 3: allow, or abort (and end the take) per request
//   loadCaptureConfig(file)               video/capture/capture.local.json, validated
//
// Every check returns { ok: true } or { ok: false, reason }, so the director can print why.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const EXIT = Object.freeze({
  OK: 0,
  FAILED: 1, // an unexpected error, or the plan did not finish inside the take
  ENTRY: 2, // entry gate refused, config missing or invalid, source mismatch, no CDP endpoint or
  //            --launch refused, arming timed out, a new document before arming
  WRITE: 3, // a write request (or WebSocket) was aborted
  DOCUMENT: 4, // a new document loaded, or was about to load, after arming; or a new window
  OVERLAY: 5, // overlay or map treatment incomplete, empty denylist, or denylisted text on screen
  REFUSED: 6, // a guarded action was refused, or its target was not found in time
  USAGE: 64, // usage error, or the take already exists
  EPISODE: 65, // the episode file is not a valid episode
});

export const SAFE_METHODS = Object.freeze(['GET', 'HEAD', 'OPTIONS']);
export const DEMO_ENTRY_SUFFIX = '/spatialadjust/demo';
// The local recreation server (video/capture/recreation.mjs) is on port 8124, the port
// `npm run serve` uses. SA_RECREATION_PORT moves it to another loopback port, for tests run while
// something else holds 8124; the host is loopback either way.
export const RECREATION_PORT = recreationPort(process.env.SA_RECREATION_PORT);
export const RECREATION_HOSTS = Object.freeze([`localhost:${RECREATION_PORT}`, `127.0.0.1:${RECREATION_PORT}`]);
export const LOOPBACK_HOSTNAMES = Object.freeze(['127.0.0.1', 'localhost', '[::1]']);
// The demo sign-in form may be retried after a typo; never more often than this, and never after
// arming.
export const MAX_DEMO_LOGINS = 3;

export const DEFAULT_CONFIG_PATH = path.join(import.meta.dirname, 'capture.local.json');
export const CONFIG_DEFAULTS = Object.freeze({
  cdpEndpoint: 'http://127.0.0.1:9222',
  apiHosts: [],
  authHosts: [],
  blockHosts: [],
  demoLoginPath: '/auth/demo',
  armPathSuffix: '/spatialadjust',
  signInTimeoutMs: 300000,
  readySelector: null,
  settleMs: 2000,
  overlayScript: null,
  recreationUrl: null,
});

function recreationPort(value) {
  if (value === undefined || value === '') return 8124;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error('SA_RECREATION_PORT must be a port number from 1024 to 65535');
  return n;
}

const ok = () => ({ ok: true });
const no = (reason) => ({ ok: false, reason });

const parse = (url) => {
  try {
    return new URL(String(url));
  } catch {
    return null;
  }
};

export const isLoopbackHostname = (hostname) => LOOPBACK_HOSTNAMES.includes(String(hostname).toLowerCase());
const hostOf = (entry) => String(entry).trim().toLowerCase();
export const hostIn = (list, host) => (list ?? []).some((h) => hostOf(h) === String(host).toLowerCase());

// Layer 1. source "demo": https (plain http only for a loopback fixture host), a host listed in
// cfg.allowedHosts, a path ending /spatialadjust/demo, and nothing after it: no query and no
// fragment, because IntelliDash decides Demo Mode on whether the whole address ends "/demo".
// source "recreation": the local recreation server only.
export function checkEntryUrl(url, cfg = {}, { source = 'demo' } = {}) {
  const raw = String(url ?? '');
  const u = parse(raw);
  if (!u) return no(`"${raw}" is not a URL`);
  if (u.username || u.password) return no('the entry URL may not carry credentials');
  const host = u.host.toLowerCase();
  if (source === 'recreation') {
    if (u.protocol !== 'http:') return no('the recreation is served over http from the local recreation server');
    if (!RECREATION_HOSTS.includes(host)) return no(`source recreation loads only from ${RECREATION_HOSTS.join(' or ')}, not ${host}`);
    return ok();
  }
  if (source !== 'demo') return no(`unknown source "${source}"`);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLoopbackHostname(u.hostname))) {
    return no('the entry URL must be https (plain http is accepted only for a loopback fixture host)');
  }
  if (!hostIn(cfg.allowedHosts, host)) return no(`host ${host} is not in allowedHosts`);
  if (raw.includes('?') || raw.includes('#')) return no('the entry URL may not have a query string or fragment: Demo Mode boots only when the whole address ends /demo');
  if (!u.pathname.endsWith(DEMO_ENTRY_SUFFIX)) return no(`the entry path must end ${DEMO_ENTRY_SUFFIX} (got ${u.pathname})`);
  return ok();
}

// The owner's Chrome, over the DevTools protocol, on this machine only.
export function checkCdpEndpoint(url) {
  const raw = String(url ?? '');
  const u = parse(raw);
  if (!u) return no(`"${raw}" is not a URL`);
  if (u.protocol !== 'http:') return no('the CDP endpoint must be http://127.0.0.1:<port> or http://localhost:<port>');
  if (!['127.0.0.1', 'localhost'].includes(u.hostname.toLowerCase())) return no(`the CDP endpoint must be on loopback (127.0.0.1 or localhost), not ${u.hostname}`);
  if (!/^\d+$/.test(u.port)) return no('the CDP endpoint needs an explicit port, for example http://127.0.0.1:9222');
  if (u.username || u.password || u.search || u.hash || (u.pathname && u.pathname !== '/')) return no('the CDP endpoint is a bare origin: http://127.0.0.1:<port>');
  return ok();
}

// --launch starts Playwright's own Chromium, which has no Demo Mode session and no SSO; it exists
// for the test fixtures and the local recreation.
export function checkLaunchAllowed(cfg = {}, { source = 'demo' } = {}) {
  if (source === 'recreation') return ok();
  const hosts = cfg.allowedHosts ?? [];
  if (!hosts.length) return no('--launch needs allowedHosts');
  const remote = hosts.filter((h) => {
    const u = parse(`http://${hostOf(h)}`);
    return !u || !isLoopbackHostname(u.hostname);
  });
  if (remote.length) return no('--launch is refused while any allowed host is not loopback; capture from IntelliDash runs in the owner\'s own Chrome over CDP');
  return ok();
}

// Layer 3. req: { method, url, isNavigation, isMainFrame }. state: { demoLogins } (counted by
// the caller when a demo-login POST is allowed). Returns
//   { action: 'allow' | 'abort', kind, end, reason }
// where end is the exit code that ends the take (null: abort quietly and carry on).
//   after arming   only GET, HEAD and OPTIONS, plus POSTs to cfg.authHosts (token refresh);
//                  any main-frame document request is aborted and ends the take (exit 4)
//   before arming  the same, plus the demo sign-in POST (path ending cfg.demoLoginPath, to an
//                  allowed or API host, at most MAX_DEMO_LOGINS times)
//   any time       requests to cfg.blockHosts are aborted quietly; any other write is aborted
//                  and ends the take (exit 3)
export function classifyRequest(req, { armed = false, cfg = {}, state = {} } = {}) {
  const method = String(req?.method ?? 'GET').toUpperCase();
  const u = parse(req?.url);
  if (!u) return { action: 'abort', kind: 'invalid', end: armed ? EXIT.WRITE : null, reason: 'not a URL' };
  if (u.protocol === 'data:' || u.protocol === 'blob:') return { action: 'allow', kind: 'local', end: null };
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { action: 'abort', kind: 'scheme', end: SAFE_METHODS.includes(method) ? null : EXIT.WRITE, reason: `scheme ${u.protocol}` };
  }
  const host = u.host.toLowerCase();
  if (armed && req.isNavigation && req.isMainFrame) {
    return { action: 'abort', kind: 'document', end: EXIT.DOCUMENT, reason: 'a new document after arming would boot IntelliDash live' };
  }
  if (hostIn(cfg.blockHosts, host)) return { action: 'abort', kind: 'blocked', end: null, reason: 'host in blockHosts' };
  if (SAFE_METHODS.includes(method)) return { action: 'allow', kind: 'read', end: null };
  if (method === 'POST' && hostIn(cfg.authHosts, host)) return { action: 'allow', kind: 'auth', end: null };
  if (!armed && method === 'POST' && cfg.demoLoginPath && u.pathname.endsWith(cfg.demoLoginPath)
    && (hostIn(cfg.allowedHosts, host) || hostIn(cfg.apiHosts, host)) && (state.demoLogins ?? 0) < MAX_DEMO_LOGINS) {
    return { action: 'allow', kind: 'demo-login', end: null };
  }
  return { action: 'abort', kind: 'write', end: EXIT.WRITE, reason: `${method} ${armed ? 'after' : 'before'} arming` };
}

export class CaptureConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CaptureConfigError';
  }
}

const HOST = /^[a-z0-9.-]+(?::\d+)?$|^\[[0-9a-f:]+\](?::\d+)?$/i;

// Validates a parsed config and fills in defaults. Throws CaptureConfigError naming the field.
export function validateCaptureConfig(input, { file = 'capture config' } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new CaptureConfigError(`${file}: must be a JSON object`);
  const cfg = { ...CONFIG_DEFAULTS, ...input };
  const hostList = (key, { required = false } = {}) => {
    const v = cfg[key] ?? [];
    if (!Array.isArray(v) || v.some((h) => typeof h !== 'string' || !HOST.test(h.trim()))) {
      throw new CaptureConfigError(`${file}: "${key}" must be an array of host names (host or host:port, no scheme)`);
    }
    if (required && !v.length) throw new CaptureConfigError(`${file}: "${key}" must list at least one host`);
    cfg[key] = v.map(hostOf);
  };
  hostList('allowedHosts', { required: true });
  hostList('apiHosts');
  hostList('authHosts');
  hostList('blockHosts');
  if (typeof cfg.entryUrl !== 'string') throw new CaptureConfigError(`${file}: "entryUrl" must be the https URL ending ${DEMO_ENTRY_SUFFIX}`);
  const entry = checkEntryUrl(cfg.entryUrl, cfg, { source: 'demo' });
  if (!entry.ok) throw new CaptureConfigError(`${file}: "entryUrl" is refused: ${entry.reason}`);
  const cdp = checkCdpEndpoint(cfg.cdpEndpoint);
  if (!cdp.ok) throw new CaptureConfigError(`${file}: "cdpEndpoint" is refused: ${cdp.reason}`);
  for (const key of ['demoLoginPath', 'armPathSuffix']) {
    if (typeof cfg[key] !== 'string' || !cfg[key].startsWith('/')) throw new CaptureConfigError(`${file}: "${key}" must be a path starting with /`);
  }
  for (const key of ['signInTimeoutMs', 'settleMs']) {
    if (!Number.isInteger(cfg[key]) || cfg[key] < 0) throw new CaptureConfigError(`${file}: "${key}" must be a whole number of milliseconds`);
  }
  for (const key of ['readySelector', 'overlayScript', 'recreationUrl']) {
    if (cfg[key] !== null && typeof cfg[key] !== 'string') throw new CaptureConfigError(`${file}: "${key}" must be a string or null`);
  }
  if (cfg.recreationUrl !== null) {
    const rec = checkEntryUrl(cfg.recreationUrl, cfg, { source: 'recreation' });
    if (!rec.ok) throw new CaptureConfigError(`${file}: "recreationUrl" is refused: ${rec.reason}`);
  }
  return Object.freeze(cfg);
}

// Reads and validates the local capture config. The file is gitignored (*.local.json): it names
// the internal dev host, which never goes into this public repository.
export function loadCaptureConfig(file = process.env.SA_CAPTURE_CONFIG || DEFAULT_CONFIG_PATH) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new CaptureConfigError(`${file} not found. Copy video/capture/capture.example.json to video/capture/capture.local.json and fill in the dev host (see video/README.md, "Capture").`);
    }
    throw new CaptureConfigError(`cannot read ${file} (${err.code ?? 'error'})`);
  }
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new CaptureConfigError(`${file} is not valid JSON`);
  }
  return validateCaptureConfig(input, { file });
}
