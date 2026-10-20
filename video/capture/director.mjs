#!/usr/bin/env node
// The capture director: records one take of an episode from IntelliDash Demo Mode (or from the
// local recreation) under three independent safety layers. Why each rule exists, with the
// IntelliDash audit behind it: video/capture/SAFETY.md. Setup: video/README.md, "Capture".
//
//   npm run video -- capture --episode <id | path/to/episode.json> --take <N> [options]
//
//   --episode <id|file>   video/episodes/<id>/episode.json, or a path to an episode file
//   --take <N>            take number; the take is take<N>.mp4 (take<N>-recreation.mp4 for the
//                         recreation) under <media root>/episodes/<id>/capture/raw/. An existing
//                         take is never overwritten.
//   --source demo|recreation
//                         must match the episode's source (the default)
//   --dry-run             validate the episode, print the plan and the click guard's verdicts;
//                         starts no browser, reads no capture config hosts, writes nothing
//   --no-record           run the plan in real time without recording (rehearsal); the safety
//                         report is still written
//   --launch              use Playwright's own Chromium instead of the owner's Chrome; refused
//                         unless every allowed host is loopback (test fixtures) or the source is
//                         the recreation
//   --headed              with --launch, show the browser window
//   --config <file>       capture config (default video/capture/capture.local.json, or
//                         $SA_CAPTURE_CONFIG)
//
// What a run does, in order:
//   1. Validates the episode (exit 65) and the capture config and entry URL (exit 2).
//   2. Connects to the owner's Chrome over CDP on loopback only, or launches Chromium for the
//      fixtures, and opens ONE new page. Everything below is installed on that page only: device
//      metrics 1920x1080 at scale 2, service workers bypassed, the recorder's virtual clock, the
//      in-page runtime (director-runtime.js), the course overlay, the map treatment, the request
//      tripwire and the WebSocket block.
//   3. Loads the entry URL. This is the only navigation in this file, and it happens once; the
//      director never reloads.
//   4. Waits for the owner to sign in to the demo form (the director never types credentials)
//      and for the in-app hop to /spatialadjust, then arms: from here any write, WebSocket, new
//      document or popup ends the take.
//   5. Installs the overlay, scans the page against the denylist, records the take while the
//      runtime plays the episode's beats, and writes the take, its cue log, cursor track,
//      contact sheet and safety report beside it.
//
// Exit codes: see EXIT in video/capture/gates.mjs and the table in SAFETY.md.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import {
  CONFIG_DEFAULTS, CaptureConfigError, DEFAULT_CONFIG_PATH, EXIT, RECREATION_HOSTS,
  checkCdpEndpoint, checkEntryUrl, checkLaunchAllowed, classifyRequest, loadCaptureConfig,
} from './gates.mjs';
import { EpisodeError, REPO_ROOT, parseEpisode } from '../lib/episode-schema.mjs';
import { MediaRootError, episodeDir, mediaRoot, subdir } from '../lib/media-root.mjs';
import { LocalMapsError, loadLocalMaps } from '../lib/local-maps.mjs';
import { FPS, Recorder, RecorderError, VIEWPORT, DEVICE_SCALE_FACTOR, assertRawPath, contactSheet, resolveFfmpeg } from './record.mjs';
import { GuardRefusal, describeElement, guardedClick, normaliseName, refuseReason } from '../../scripts/lib/guarded-click.mjs';
import { WRITES } from '../../scripts/lib/writes.mjs';

const HERE = import.meta.dirname;
export const RUNTIME_SCRIPT = path.join(HERE, 'director-runtime.js');
export const OVERLAY_SCRIPT = path.join(HERE, 'course-overlay.js');
export const MAP_ROUTES = path.join(HERE, 'map-routes.mjs');
export const COURSE_IDENTITY = path.join(REPO_ROOT, 'video', 'brand', 'course.json');
export const RECREATION_ORIGIN = 'http://localhost:8124';

// Timing of the in-page plan (seconds). The start flash is 0.25 s; beats start at LEAD.
export const LEAD_S = 0.75;
const TAIL_S = 0.2 + 0.25 + 1.0; // unhover pause, end flash, then a second of still frames
const STEP_S = { hover: 0.75, click: 0.75 + 0.12, scroll: 0.9, focus: 0, cue: 0 };
// The denylist is re-scanned every SCAN_EVERY frames while recording.
export const SCAN_EVERY = 15;
const SIGN_IN_POLL_MS = 250;

const log = (msg) => process.stdout.write(`capture: ${msg}\n`);
const warn = (msg) => process.stderr.write(`capture: ${msg}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USAGE = `Usage: npm run video -- capture --episode <id|file> --take <N> [--source demo|recreation]
                                 [--dry-run] [--no-record] [--launch [--headed]] [--config <file>]
See video/README.md ("Capture") and video/capture/SAFETY.md.
`;

class UsageError extends Error {}

// Ctrl-C ends the take through the same path as a safety stop, so the page is closed and the
// safety report written.
let interrupt = null;

// ---- CLI ---------------------------------------------------------------------------------------

export function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      episode: { type: 'string' },
      take: { type: 'string' },
      source: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'no-record': { type: 'boolean', default: false },
      launch: { type: 'boolean', default: false },
      headed: { type: 'boolean', default: false },
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) return { help: true };
  if (!values.episode) throw new UsageError('--episode is required');
  if (values.source !== undefined && !['demo', 'recreation'].includes(values.source)) throw new UsageError('--source must be demo or recreation');
  let take = null;
  if (values.take !== undefined) {
    if (!/^[1-9]\d{0,3}$/.test(values.take)) throw new UsageError('--take must be a whole number from 1');
    take = Number(values.take);
  } else if (!values['dry-run']) {
    throw new UsageError('--take is required');
  }
  if (values.headed && !values.launch) throw new UsageError('--headed applies to --launch only (the owner\'s Chrome is always visible)');
  return {
    episode: values.episode, take: take ?? 1, source: values.source ?? null, dryRun: values['dry-run'],
    noRecord: values['no-record'], launch: values.launch, headed: values.headed, config: values.config ?? null,
  };
}

export function episodeFile(arg) {
  if (/^[a-z0-9-]+$/.test(arg)) return path.join(REPO_ROOT, 'video', 'episodes', arg, 'episode.json');
  return path.resolve(arg);
}

// ---- the plan ----------------------------------------------------------------------------------

// The in-page plan carries no selector: targets stay in Node and the runtime asks for them by
// index (window.__saAct), so the page can only act on an element the director checked.
export function buildPlan(episode) {
  const targets = [];
  const ref = (target, name, kind) => { targets.push({ target, name: name ?? null, kind }); return targets.length - 1; };
  let seconds = LEAD_S;
  const beats = episode.beats.map((b) => {
    let busy = 0;
    const highlight = b.highlight ? ref(b.highlight, null, 'highlight') : null;
    const actions = b.actions.map((a) => {
      busy += a.type === 'wait' ? a.ms / 1000 : STEP_S[a.type] ?? 0;
      switch (a.type) {
        case 'wait': return { type: 'wait', ms: a.ms };
        case 'cue': return { type: 'cue', id: a.id };
        case 'scroll': return { type: 'scroll', i: ref(a.target, null, 'scroll'), dy: a.dy };
        default: return { type: a.type, i: ref(a.target, a.name, a.type), name: a.name };
      }
    });
    seconds += Math.max(b.hold, busy + 0.05);
    return { id: b.id, hold: b.hold, highlight, actions };
  });
  seconds += TAIL_S;
  return { plan: { lead: LEAD_S, beats }, targets, seconds: Math.ceil(seconds * FPS) / FPS };
}

// The click guard's verdict for every click in the episode, as if each target resolved to the
// element the episode names. The real check runs on the resolved element during the take.
export function clickVerdicts(episode) {
  const out = [];
  for (const beat of episode.beats) {
    for (const a of beat.actions) {
      if (a.type !== 'click') continue;
      const base = { name: a.name, expectedName: a.name, allow: episode.allowClicks, allowWrites: episode.demoWriteClicks };
      const live = refuseReason({ ...base, demoVerified: false });
      const demo = refuseReason({ ...base, demoVerified: true });
      let verdict;
      if (!live) verdict = 'allowed (read-only, in allowClicks)';
      else if (!demo) verdict = 'allowed only when Demo Mode is verified at arming (declared demo-mode click)';
      else verdict = `refused: ${demo}`;
      out.push({ beat: beat.id, name: a.name, target: a.target, verdict, refused: Boolean(demo) });
    }
  }
  return out;
}

const takeStem = (take, source) => `take${take}${source === 'recreation' ? '-recreation' : ''}`;

// ---- config ------------------------------------------------------------------------------------

function recreationConfig(file) {
  // The recreation needs no capture config; a local one may still name an overlay script or a
  // recreation URL. Only the local recreation server is ever allowed.
  let local = null;
  try { local = loadCaptureConfig(file ?? undefined); } catch (err) { if (!(err instanceof CaptureConfigError)) throw err; }
  const pick = (k) => (local && local[k] !== undefined ? local[k] : CONFIG_DEFAULTS[k]);
  return Object.freeze({
    ...CONFIG_DEFAULTS,
    allowedHosts: [...RECREATION_HOSTS],
    blockHosts: local ? [...local.blockHosts] : [],
    overlayScript: pick('overlayScript'),
    recreationUrl: pick('recreationUrl'),
    settleMs: pick('settleMs'),
    readySelector: null,
  });
}

// Configured hosts never reach the terminal: they name the internal dev host.
function redactHosts(message, cfg) {
  let out = String(message);
  const hosts = [...(cfg?.allowedHosts ?? []), ...(cfg?.apiHosts ?? []), ...(cfg?.authHosts ?? []), ...(cfg?.blockHosts ?? [])]
    .filter((h) => !RECREATION_HOSTS.includes(h) && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h))
    .sort((a, b) => b.length - a.length);
  for (const h of hosts) out = out.split(h).join('<configured host>');
  return out;
}

// ---- dry run -----------------------------------------------------------------------------------

function dryRun({ args, file, episode, source }) {
  const { plan, targets, seconds } = buildPlan(episode);
  const stem = takeStem(args.take, source);
  let where;
  try { where = path.join(mediaRoot(), 'episodes', episode.id, 'capture', 'raw', `${stem}.mp4`); } catch (err) { where = `(media root refused: ${err.message.split('\n')[0]})`; }
  log(`episode ${episode.id} (${path.relative(REPO_ROOT, file) || file}): valid, status ${episode.status}`);
  log(`source ${source}, map policy ${episode.mapPolicy}, take ${args.take} -> ${where}`);
  log(`plan: ${plan.beats.length} beats, ${targets.length} targets, about ${seconds.toFixed(2)} s at ${FPS} fps`);
  for (const b of plan.beats) {
    log(`  beat ${b.id}: hold ${b.hold} s${b.highlight !== null ? `, highlight #${b.highlight} ${targets[b.highlight].target}` : ''}`);
    for (const a of b.actions) {
      if (a.type === 'wait') log(`    wait ${a.ms} ms`);
      else if (a.type === 'cue') log(`    cue ${a.id}`);
      else log(`    #${a.i} ${a.type}${a.name ? ` "${a.name}"` : ''} ${targets[a.i].target}${a.type === 'scroll' ? ` by ${a.dy} px` : ''}`);
    }
  }
  const verdicts = clickVerdicts(episode);
  log(verdicts.length ? 'click guard (checked again on the resolved element during the take):' : 'click guard: no clicks');
  for (const v of verdicts) log(`  "${v.name}" in beat ${v.beat}: ${v.verdict}`);
  if (source === 'demo') {
    const cfgFile = args.config ?? process.env.SA_CAPTURE_CONFIG ?? DEFAULT_CONFIG_PATH;
    let status;
    try { const cfg = loadCaptureConfig(cfgFile); status = `valid (${cfg.allowedHosts.length} allowed host(s), ${cfg.apiHosts.length} API host(s); names not shown)`; } catch (err) {
      status = err instanceof CaptureConfigError && /not found/.test(err.message) ? 'not found (needed for a capture)' : 'invalid (run without --dry-run to see why)';
    }
    log(`capture config ${path.relative(REPO_ROOT, cfgFile) || cfgFile}: ${status}`);
  }
  try {
    const maps = loadLocalMaps({ warn: () => {} });
    log(`local name maps: ${maps.pairs.length} pair(s), ${maps.denylist.length} denylist term(s) (counts only)`);
  } catch (err) {
    log(`local name maps: unreadable (${err instanceof LocalMapsError ? err.message : 'error'})`);
  }
  log(`overlay script: ${fs.existsSync(OVERLAY_SCRIPT) ? 'present' : 'missing'}; map treatment: ${fs.existsSync(MAP_ROUTES) ? 'present' : 'missing'}`);
  log('dry run: no browser started, nothing written');
  return verdicts.some((v) => v.refused) ? EXIT.REFUSED : EXIT.OK;
}

// ---- the take ----------------------------------------------------------------------------------

function chromeInstructions() {
  let profile;
  try { profile = path.join(subdir('auth'), 'chrome-profile'); } catch { profile = '<media root>/auth/chrome-profile'; }
  return [
    'Start Chrome for capture (it must listen on loopback only), sign nothing in, then run this command again:',
    `  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="${profile}"`,
    'Use that profile for capture only: no extensions, and never signed in to a live IntelliDash course.',
  ].join('\n');
}

async function capture(ctx) {
  const { args, episode, source, cfg, entryUrl, plan, targets, seconds, rawDir, stem, maps, identity, overlayFile } = ctx;
  const token = randomUUID();
  const t0 = Date.now();
  const state = { armed: false, demoLogins: 0, demoLoginOk: false, end: null, entrySet: false };
  const safety = {
    episode: episode.id, take: args.take, source, browser: args.launch ? 'launch' : 'cdp', recorded: !args.noRecord,
    startedAt: new Date(t0).toISOString(), armedAt: null, demoVerified: false, demoLogins: 0, demoLoginOk: false,
    aborted: [], websockets: [], documents: [], popups: [], dialogs: [], refusals: [], trips: [],
    scans: { count: 0, hits: [] }, overlay: null, map: null, exit: null, reason: null, endedAt: null,
  };
  const since = () => +((Date.now() - t0) / 1000).toFixed(3);
  const split = (url) => { try { const u = new URL(url); return { host: u.host, path: u.pathname }; } catch { return { host: '', path: '' }; } };
  let page = null;
  const end = (code, reason) => {
    if (state.end) return;
    state.end = { code, reason };
    warn(`ending the take (exit ${code}): ${redactHosts(reason, cfg)}`);
    page?.evaluate(() => { if (window.__sa) window.__sa.stop = true; }).catch(() => {});
  };
  interrupt = () => end(EXIT.FAILED, 'interrupted');

  const { chromium } = await import('playwright');
  let browser = null;
  let rec = null;
  try {
    if (args.launch) {
      browser = await chromium.launch({ headless: !args.headed });
      const context = await browser.newContext({ viewport: { ...VIEWPORT }, deviceScaleFactor: DEVICE_SCALE_FACTOR, serviceWorkers: 'block' });
      page = await context.newPage();
    } else {
      try {
        browser = await chromium.connectOverCDP(cfg.cdpEndpoint, { timeout: 10000 });
      } catch {
        warn(`no Chrome is listening at ${cfg.cdpEndpoint}.\n${chromeInstructions()}`);
        return EXIT.ENTRY;
      }
      const context = browser.contexts()[0];
      if (!context) { warn('the browser has no default context'); return EXIT.ENTRY; }
      page = await context.newPage();
    }

    // Geometry and service workers, on this page only.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: DEVICE_SCALE_FACTOR, mobile: false });
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    await page.bringToFront();

    // Init scripts, in order: virtual clock (recording only), guard config, runtime, overlay.
    if (!args.noRecord) {
      rec = new Recorder(page, { log: (m) => log(m.trim()), cdp });
      await rec.install({ startMs: t0 });
    }
    await page.addInitScript(({ writes, flags }) => {
      Object.defineProperty(window, '__saGuardConfig', { value: Object.freeze({ writes, flags }), writable: false, configurable: false });
    }, { writes: WRITES.source, flags: WRITES.flags });
    await page.addInitScript({ path: RUNTIME_SCRIPT });
    if (overlayFile) await page.addInitScript({ path: overlayFile });

    // Bindings: target resolution and trip reports from the runtime.
    const declared = (name) => (episode.demoWriteClicks ?? []).some((d) => normaliseName(d.name).toLowerCase() === normaliseName(name).toLowerCase());
    await page.exposeBinding('__saAct', async (source_, req) => {
      if (source_.frame !== page.mainFrame()) return { fatal: true, reason: 'request from a frame other than the page' };
      if (!state.armed || state.end) return { fatal: true, reason: state.end ? 'the take has ended' : 'not armed' };
      const t = targets[req?.i];
      if (!t || t.kind !== req.kind) return { fatal: true, reason: 'unknown target' };
      const loc = page.locator(t.target);
      const n = await loc.count();
      if (n === 0) return { ok: false };
      const refuse = (reason) => {
        safety.refusals.push({ t: since(), step: req.i, kind: t.kind, name: t.name, reason });
        end(EXIT.REFUSED, `${t.kind} #${req.i} refused: ${reason}`);
        return { refused: true, reason };
      };
      if (t.kind === 'click' && n > 1) return refuse(`the target matches ${n} elements; a click needs exactly one`);
      const el = loc.first();
      if (!(await el.isVisible())) return { ok: false };
      const approveToken = randomUUID();
      const approve = (info, allowWrite) => el.evaluate((node, a) => window.__sa._approve(node, a), {
        token: approveToken, name: info.name, iconId: info.iconId, allowWrite,
      });
      if (t.kind === 'click') {
        try {
          await guardedClick(page, el, {
            why: `episode click #${req.i}`, name: t.name, allow: episode.allowClicks, allowWrites: episode.demoWriteClicks,
            demoVerified: safety.demoVerified,
            dispatch: (_l, info) => approve(info, declared(info.name) && safety.demoVerified),
          });
        } catch (err) {
          if (err instanceof GuardRefusal) return refuse(err.reason ?? err.message);
          throw err;
        }
      } else {
        const info = await describeElement(el);
        if (t.name && normaliseName(info.name).toLowerCase() !== normaliseName(t.name).toLowerCase()) {
          return refuse(`resolved to "${normaliseName(info.name)}", expected "${normaliseName(t.name)}"`);
        }
        await approve(info, false);
      }
      return { ok: true, token: approveToken };
    });
    await page.exposeBinding('__saTrip', (_source, rec_) => {
      const r = { t: since(), kind: String(rec_?.kind ?? ''), method: String(rec_?.method ?? ''), host: String(rec_?.host ?? ''), path: String(rec_?.path ?? ''), via: rec_?.via ?? null, step: rec_?.step ?? null };
      if (rec_?.reason) r.reason = String(rec_.reason);
      safety.trips.push(r);
      if (r.kind === 'write' || r.kind === 'websocket') end(EXIT.WRITE, `the page tried ${r.method} ${r.path} (${r.via}); blocked in the page`);
      else if (r.kind === 'popup') end(EXIT.DOCUMENT, 'the page tried to open a new window; blocked in the page');
      else if (r.kind === 'refusal') end(EXIT.REFUSED, `click refused in the page: ${r.reason ?? ''}`);
      else if (r.kind === 'missing') end(EXIT.REFUSED, `target #${r.step} was not found in time`);
    });

    // Map treatment first, then the tripwire: Playwright runs the most recently registered route
    // first, so every request meets the tripwire before anything else and allowed ones are
    // passed on with route.fallback().
    if (fs.existsSync(MAP_ROUTES)) {
      const { installMapRoutes } = await import('./map-routes.mjs');
      try {
        const m = await installMapRoutes(page, episode.mapPolicy);
        safety.map = { policy: m.policy, routed: m.routed };
      } catch (err) {
        end(EXIT.OVERLAY, `map treatment "${episode.mapPolicy}" could not be installed: ${err.message}`);
        return state.end.code;
      }
    } else if (source === 'demo') {
      end(EXIT.OVERLAY, 'the map treatment (video/capture/map-routes.mjs) is missing');
      return state.end.code;
    }

    const demoLoginRequests = new WeakSet();
    await page.route('**/*', async (route, request) => {
      let isMainFrame = false;
      try { isMainFrame = request.frame() === page.mainFrame(); } catch { /* a request without a frame */ }
      const method = request.method();
      const verdict = classifyRequest({ method, url: request.url(), isNavigation: request.isNavigationRequest(), isMainFrame }, { armed: state.armed, cfg, state });
      if (verdict.action === 'allow') {
        if (verdict.kind === 'demo-login') { state.demoLogins++; safety.demoLogins = state.demoLogins; demoLoginRequests.add(request); }
        return route.fallback();
      }
      const { host, path: p } = split(request.url());
      safety.aborted.push({ t: since(), method, host, path: p, kind: verdict.kind, armed: state.armed, mainFrame: isMainFrame, navigation: request.isNavigationRequest() });
      await route.abort('blockedbyclient').catch(() => {});
      if (verdict.end !== null) end(verdict.end, `${verdict.kind}: ${method} ${p} aborted (${verdict.reason})`);
      return undefined;
    });
    page.on('response', (response) => {
      if (!state.armed && demoLoginRequests.has(response.request()) && response.ok()) { state.demoLoginOk = true; safety.demoLoginOk = true; }
    });
    await page.routeWebSocket(/.*/, (ws) => {
      const { host, path: p } = split(ws.url());
      safety.websockets.push({ t: since(), host, path: p, armed: state.armed });
      ws.close({ code: 1008, reason: 'blocked by the capture director' }).catch(() => {});
      if (state.armed) end(EXIT.WRITE, `a WebSocket to ${p} was opened after arming`);
    });
    page.on('domcontentloaded', async () => {
      safety.documents.push({ t: since(), armed: state.armed });
      if (!state.entrySet) return;
      const same = await page.evaluate((tk) => window.__saEntry === tk, token).catch(() => false);
      if (!same) end(state.armed ? EXIT.DOCUMENT : EXIT.ENTRY, 'a new document loaded in the capture page');
    });
    page.on('popup', async (popup) => {
      safety.popups.push({ t: since(), armed: state.armed });
      await popup.close({ runBeforeUnload: false }).catch(() => {});
      end(state.armed ? EXIT.DOCUMENT : EXIT.ENTRY, 'the page opened a new window');
    });
    page.on('dialog', async (dialog) => {
      // Dismissing is the safe answer to a confirm: it is the Cancel button.
      safety.dialogs.push({ t: since(), type: dialog.type() });
      await dialog.dismiss().catch(() => {});
    });

    // Layer 1: the one navigation.
    log(source === 'demo' ? 'loading the Demo Mode entry page' : 'loading the recreation');
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (state.end) return state.end.code;
    await page.evaluate((tk) => { window.__saEntry = tk; }, token);
    state.entrySet = true;

    // Wait for the in-app hop (demo) or arm at once (recreation).
    if (source === 'demo') {
      log('sign in to the demo form in the capture tab; the director waits for the hop to /spatialadjust');
      const deadline = Date.now() + cfg.signInTimeoutMs;
      for (;;) {
        if (state.end) return state.end.code;
        const s = await page.evaluate(([tk, hop, boot]) => {
          const trim = (p) => p.replace(/\/+$/, '');
          const nav = performance.getEntriesByType('navigation')[0];
          let booted = false;
          try { const u = new URL(nav.name); booted = trim(u.pathname).endsWith(boot) && !u.search && !u.hash; } catch { /* no entry */ }
          return { entry: window.__saEntry === tk, hop: trim(location.pathname).endsWith(hop), booted };
        }, [token, cfg.armPathSuffix, '/spatialadjust/demo']).catch(() => null);
        if (s && !s.entry) { end(EXIT.ENTRY, 'the entry document was replaced before Demo Mode was verified'); return state.end.code; }
        if (s && s.entry && s.hop && s.booted) break;
        if (Date.now() > deadline) { end(EXIT.ENTRY, `no hop to ${cfg.armPathSuffix} within ${Math.round(cfg.signInTimeoutMs / 1000)} s`); return state.end.code; }
        await sleep(SIGN_IN_POLL_MS);
      }
    }

    // Arm: Node first, then the page.
    state.armed = true;
    safety.armedAt = new Date().toISOString();
    safety.demoVerified = source === 'demo' && state.demoLoginOk;
    const armedInPage = await page.evaluate(({ tk, demoVerified, writeHosts }) => window.__sa && window.__sa.arm({ token: tk, demoVerified, writeHosts }),
      { tk: token, demoVerified: safety.demoVerified, writeHosts: [...cfg.authHosts] });
    if (!armedInPage) { end(EXIT.ENTRY, 'the in-page runtime is missing; refusing to run unguarded'); return state.end.code; }
    log(`armed${source === 'demo' ? (safety.demoVerified ? ' (Demo Mode verified)' : ' (read-only: no successful demo sign-in was seen)') : ''}`);

    // Overlay, readiness, first scan.
    const pairs = maps.pairs.map(([r, f]) => [r, f]);
    const deny = Array.from(maps.denylist);
    const installed = await page.evaluate(([p, id]) => (typeof window.__saOverlayInstall === 'function' ? window.__saOverlayInstall(p, id) : null), [pairs, identity])
      .catch((err) => ({ error: String(err.message).split('\n')[0] }));
    safety.overlay = installed && !installed.error
      ? { pairs: installed.pairs, variants: installed.variants, replaced: installed.replaced, warnings: installed.warnings.length }
      : { installed: false, error: installed?.error ?? 'window.__saOverlayInstall is not defined' };
    if (source === 'demo' && (!installed || installed.error)) { end(EXIT.OVERLAY, `the course overlay did not install: ${safety.overlay.error}`); return state.end.code; }
    if (cfg.readySelector) {
      try { await page.locator(cfg.readySelector).first().waitFor({ state: 'visible', timeout: 60000 }); } catch {
        end(EXIT.FAILED, 'readySelector did not appear within 60 s'); return state.end.code;
      }
    }
    if (cfg.settleMs) await page.waitForTimeout(cfg.settleMs);
    const scan = async () => {
      const hits = await page.evaluate((d) => {
        const a = window.__sa ? window.__sa.scan(d) : [];
        const b = window.__saOverlay ? window.__saOverlay.scan(d) : [];
        return [...new Set([...a, ...b])].sort((x, y) => x - y);
      }, deny);
      safety.scans.count++;
      if (hits.length) {
        safety.scans.hits.push({ t: since(), indices: hits });
        end(EXIT.OVERLAY, `denylisted text on screen: ${hits.map((n) => `[denylisted #${n}]`).join(' ')}`);
      }
      return hits;
    };
    if (deny.length) await scan();
    if (state.end) return state.end.code;

    // The take.
    if (args.noRecord) {
      log(`rehearsing ${plan.beats.length} beats in real time (not recorded)`);
      await page.evaluate((pl) => { window.__sa.run(pl).catch(() => {}); }, plan);
      const deadline = Date.now() + seconds * 1500 + 15000;
      let lastScan = Date.now();
      for (;;) {
        if (state.end) break;
        const s = await page.evaluate((tk) => ({ ...window.__sa.state(), entry: window.__saEntry === tk, armed: window.__saArmed === tk }), token)
          .catch(() => ({ entry: false, armed: false }));
        if (!s.entry || !s.armed) { end(EXIT.DOCUMENT, 'the capture page lost its arming sentinel (a new document)'); break; }
        if (s.done || s.err) break;
        if (deny.length && Date.now() - lastScan > 500) { lastScan = Date.now(); await scan(); }
        if (Date.now() > deadline) { end(EXIT.FAILED, 'the plan did not finish in time'); break; }
        await sleep(100);
      }
    } else {
      const file = path.join(rawDir, `${stem}.mp4`);
      log(`recording ${stem}.mp4: ${seconds.toFixed(2)} s, ${Math.round(seconds * FPS)} frames`);
      const stop = new Error('the take was ended by a safety layer');
      let res;
      try {
        res = await rec.take({
          file, seconds,
          build: (tl) => { tl.at(0, (r) => r.page.evaluate((pl) => { window.__sa.run(pl).catch(() => {}); }, plan)); },
          probe: async (r, i) => {
            if (state.end) throw stop;
            const p = await page.evaluate(([tk, d]) => {
              const out = window.__sa ? window.__sa.probe() : null;
              if (!out) return null;
              out.entry = window.__saEntry === tk;
              if (d) {
                const a = window.__sa.scan(d);
                const b = window.__saOverlay ? window.__saOverlay.scan(d) : [];
                out.hits = [...new Set([...a, ...b])].sort((x, y) => x - y);
              }
              return out;
            }, [token, deny.length && i % SCAN_EVERY === 0 ? deny : null]);
            if (!p || !p.entry || p.armed !== token) { end(EXIT.DOCUMENT, 'the capture page lost its arming sentinel (a new document)'); throw stop; }
            if (p.hits) {
              safety.scans.count++;
              if (p.hits.length) {
                safety.scans.hits.push({ t: since(), frame: i, indices: p.hits });
                end(EXIT.OVERLAY, `denylisted text on screen at frame ${i}: ${p.hits.map((n) => `[denylisted #${n}]`).join(' ')}`);
                throw stop;
              }
            }
            if (p.err && !state.end) { end(EXIT.FAILED, 'the in-page plan failed'); throw stop; }
            if (state.end) throw stop;
            return [+(i / FPS).toFixed(4), +p.x.toFixed(2), +p.y.toFixed(2), 1, p.rip ? 1 : 0, p.fb];
          },
        });
      } catch (err) {
        if (state.end) return state.end.code;
        throw err;
      }
      const final = await page.evaluate(() => ({ log: window.__sa.log, clicks: window.__sa.clicks, done: window.__sa.done, err: window.__sa.err }));
      if (!final.done) {
        fs.rmSync(file, { force: true });
        end(EXIT.FAILED, final.err ? `the in-page plan failed: ${final.err.split('\n')[0]}` : 'the plan did not finish inside the take');
        return state.end.code;
      }
      const write = (name, data) => fs.writeFileSync(assertRawPath(path.join(rawDir, name), { exts: ['.json'] }), JSON.stringify(data, null, 1) + '\n');
      write(`${stem}-log.json`, final.log);
      write(`${stem}-track.json`, {
        file: path.basename(file), fps: FPS,
        units: 'CSS px (1920x1080); frame = [t, x, y, a, ripple, focusBox [x0, y0, x1, y1] | null]',
        frames: res.probe, clicks: final.clicks,
      });
      const sheet = await contactSheet(file, path.join(rawDir, `${stem}_sheet.jpg`), res.frames);
      log(`wrote ${file}`);
      log(`      ${path.join(rawDir, `${stem}-log.json`)}, ${stem}-track.json, ${path.basename(sheet)}`);
      log(`${res.frames} frames ${res.width}x${res.height}, ${res.wallSeconds.toFixed(0)} s wall, longest settle ${res.settleMaxMs} ms`);
    }
    if (state.end) return state.end.code;
    const s = await page.evaluate(() => window.__sa.state()).catch(() => null);
    if (!s || !s.done) { end(EXIT.FAILED, s?.err ? 'the in-page plan failed' : 'the plan did not finish'); return state.end.code; }
    return EXIT.OK;
  } catch (err) {
    if (state.end) return state.end.code;
    if (err instanceof RecorderError || err instanceof MediaRootError) { end(EXIT.FAILED, err.message); return EXIT.FAILED; }
    end(EXIT.FAILED, `unexpected error: ${String(err?.message ?? err).split('\n')[0]}`);
    return EXIT.FAILED;
  } finally {
    safety.exit = state.end ? state.end.code : EXIT.OK;
    safety.reason = state.end ? redactHosts(state.end.reason, cfg) : null;
    safety.endedAt = new Date().toISOString();
    try {
      fs.writeFileSync(assertRawPath(path.join(rawDir, `${stem}-safety.json`), { exts: ['.json'] }), JSON.stringify(safety, null, 1) + '\n');
      log(`safety report: ${path.join(rawDir, `${stem}-safety.json`)}`);
    } catch (err) {
      warn(`could not write the safety report: ${err.message}`);
    }
    // Close only the page this run opened. A launched browser is ours to close; the owner's
    // Chrome is not: the connection is dropped when this process exits.
    if (page) await page.close({ runBeforeUnload: false }).catch(() => {});
    if (args.launch && browser) await browser.close().catch(() => {});
  }
}

// ---- main --------------------------------------------------------------------------------------

export async function main(argv) {
  let args;
  try {
    args = parseCli(argv);
  } catch (err) {
    process.stderr.write(`capture: ${err.message}\n${USAGE}`);
    return EXIT.USAGE;
  }
  if (args.help) { process.stdout.write(USAGE); return EXIT.OK; }

  const file = episodeFile(args.episode);
  let episode;
  try {
    episode = parseEpisode(file);
  } catch (err) {
    if (err instanceof EpisodeError) { process.stderr.write(`capture: ${err.message}\n`); return EXIT.EPISODE; }
    throw err;
  }
  const source = args.source ?? episode.source;
  if (source !== episode.source) {
    warn(`--source ${source} does not match the episode's source "${episode.source}"; a take is always captured from the source the episode declares`);
    return EXIT.ENTRY;
  }
  if (args.dryRun) return dryRun({ args, file, episode, source });

  // Config and the entry URL (layer 1).
  let cfg;
  try {
    cfg = source === 'demo' ? loadCaptureConfig(args.config ?? undefined) : recreationConfig(args.config);
  } catch (err) {
    if (err instanceof CaptureConfigError) { warn(redactHosts(err.message, null).replace(/host \S+ is not/, 'the host is not')); return EXIT.ENTRY; }
    throw err;
  }
  let entryUrl;
  if (source === 'demo') entryUrl = cfg.entryUrl;
  else {
    try { entryUrl = new URL(episode.recreationPath ?? '/', cfg.recreationUrl ?? RECREATION_ORIGIN).href; } catch { warn('the episode\'s recreationPath is not a path'); return EXIT.ENTRY; }
  }
  const entry = checkEntryUrl(entryUrl, cfg, { source });
  if (!entry.ok) { warn(`entry refused: ${redactHosts(entry.reason, cfg)}`); return EXIT.ENTRY; }
  const browserGate = args.launch ? checkLaunchAllowed(cfg, { source }) : checkCdpEndpoint(cfg.cdpEndpoint);
  if (!browserGate.ok) { warn(`browser refused: ${browserGate.reason}`); return EXIT.ENTRY; }

  // Output, overlay and the local name maps.
  const stem = takeStem(args.take, source);
  let rawDir;
  try {
    rawDir = episodeDir(episode.id, 'capture', 'raw');
    assertRawPath(path.join(rawDir, `${stem}.mp4`));
  } catch (err) {
    warn(err.message);
    return EXIT.FAILED;
  }
  if (!args.noRecord) {
    if (fs.existsSync(path.join(rawDir, `${stem}.mp4`))) {
      warn(`${path.join(rawDir, `${stem}.mp4`)} already exists; takes are never overwritten, use the next --take`);
      return EXIT.USAGE;
    }
    try { resolveFfmpeg(); } catch (err) { warn(err.message); return EXIT.FAILED; }
  }
  let maps;
  try { maps = loadLocalMaps(); } catch (err) { warn(err instanceof LocalMapsError ? err.message : 'the local name maps could not be read'); return EXIT.OVERLAY; }
  const overlayFile = cfg.overlayScript ? path.resolve(REPO_ROOT, cfg.overlayScript) : OVERLAY_SCRIPT;
  if (source === 'demo') {
    if (!fs.existsSync(overlayFile)) { warn(`the course overlay script is missing (${overlayFile})`); return EXIT.OVERLAY; }
    if (!maps.denylist.length) { warn('the denylist is empty: a Demo Mode take needs video/capture/overlay.local.json (see video/README.md)'); return EXIT.OVERLAY; }
  }
  const identity = JSON.parse(fs.readFileSync(COURSE_IDENTITY, 'utf8'));
  const { plan, targets, seconds } = buildPlan(episode);

  return capture({
    args, episode, source, cfg, entryUrl, plan, targets, seconds, rawDir, stem, maps, identity,
    overlayFile: fs.existsSync(overlayFile) ? overlayFile : null,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  let closing = false;
  process.on('SIGINT', () => {
    if (closing || !interrupt) process.exit(130);
    closing = true;
    warn('interrupted; closing the capture page');
    interrupt();
    setTimeout(() => process.exit(130), 10000).unref();
  });
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => { warn(`unexpected error: ${String(err?.stack ?? err)}`); process.exit(EXIT.FAILED); },
  );
}
