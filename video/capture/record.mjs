// Deterministic, frame-stepped 60 fps recorder for the capture director (PI-ICNT-SW-1078-3).
//
// Ported from the iCentral capture harness recorder (~/Documents/iCentral_MarCom/05-capture/harness/
// record.mjs, modified 2026-10-02T17:06:54-0700) with the same API: Recorder, contactSheet,
// probeFile. What changed, and why:
//   * It works on a page it did not create. The director connects to the owner's own signed-in
//     Chrome and opens one page there, so the recorder takes the page (not a harness object),
//     drives it through its own CDP session, and never assumes Playwright set the viewport.
//   * Geometry is fixed: viewport 1920x1080 at device scale factor 2, so every frame is a
//     3840x2160 screenshot of the page viewport only (Emulation.setDeviceMetricsOverride plus
//     Page.captureScreenshot; no browser chrome).
//   * It waits for Leaflet, not MapLibre. IntelliDash bundles Leaflet, so there is no global to
//     wrap: the init script watches .leaflet-container elements (window.__captureMaps) and a frame
//     is settled when no tile image in a live map is still loading. The longest settle is
//     reported as settleMaxMs.
//   * ffmpeg comes from $FFMPEG or PATH. There is no default build path; see resolveFfmpeg.
//   * Output is refused unless it resolves to <media root>/episodes/<id>/capture/raw/.
//   * No navigation. The recorder never loads, reloads or navigates a page: the director owns
//     the single navigation of a take. Its init scripts are added by the director before that
//     navigation (install()).
//   * The cursor is off by default: the director's in-page runtime draws its own.
//   * The Timeline has no click, press, type or wheel. The recorder cannot touch the page: every
//     action goes through the director and its click guard.
//   * Simulated backend replies (the iCentral harness state) are gone; capture talks to Demo Mode.
//
// How a frame is made
//   * A virtual clock is injected before any app script (VT_INIT): performance.now, Date,
//     setTimeout/setInterval, requestAnimationFrame and requestIdleCallback all read and queue
//     against it. During setup it follows real time ("real" mode). While a take is recorded it is
//     frozen ("step" mode) and advanced exactly 1000/60 ms per frame.
//   * CSS animations and transitions: the document timeline is frozen with CDP
//     Animation.setPlaybackRate(0) and every running Web Animation is advanced by the same step.
//   * After each step the recorder waits until no request is in flight, every Leaflet map has its
//     tiles, and the page reports nothing pending (window.__captureBusy, which the director's
//     runtime sets while Node is checking an action), then re-runs pending animation frames at the
//     same instant, so each frame is complete.
//   * Frames are CDP screenshots (PNG) piped straight into ffmpeg: libx264, preset slow, CRF 12,
//     yuv420p, 60 fps, BT.709, +faststart (the archival master). No PNG is written to disk.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AGENT_MARKERS, TEMP_ROOTS, isInside, mediaRoot, resolveReal } from '../lib/media-root.mjs';

export const FPS = 60;
export const VIEWPORT = Object.freeze({ width: 1920, height: 1080 });
export const DEVICE_SCALE_FACTOR = 2;
export const FRAME = Object.freeze({ width: VIEWPORT.width * DEVICE_SCALE_FACTOR, height: VIEWPORT.height * DEVICE_SCALE_FACTOR });
// Requests in flight longer than this are treated as long-lived (polling, streaming) and no
// longer hold a frame.
export const STALE_REQUEST_MS = 15000;

export class RecorderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecorderError';
  }
}

// ------------------------------------------------------------------------------------------------
// ffmpeg
// ------------------------------------------------------------------------------------------------

// Why an ffmpeg binary may not be used, or null. A binary inside a temporary directory or an
// agent scratchpad is refused: those folders vanish, and the iCentral pipeline's default pointed
// into one.
export function ffmpegRefusal(bin) {
  const candidates = [...new Set([path.resolve(bin), resolveReal(bin)])];
  const temps = [...TEMP_ROOTS, os.tmpdir(), resolveReal(os.tmpdir())].filter((t) => !isInside(os.homedir(), t));
  for (const c of candidates) {
    for (const t of temps) if (isInside(c, t)) return `it is under the temporary directory ${t}`;
    for (const marker of AGENT_MARKERS) if (c.toLowerCase().includes(marker)) return `it is inside an agent working directory (path contains ${marker})`;
  }
  return null;
}

const isExecutable = (p) => {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

// ffmpeg from $FFMPEG (an absolute path), else the first executable ffmpeg on PATH that is not
// refused. There is no built-in default.
export function resolveFfmpeg({ env = process.env } = {}) {
  if (env.FFMPEG) {
    const bin = env.FFMPEG;
    if (!path.isAbsolute(bin)) throw new RecorderError(`FFMPEG must be an absolute path (got ${bin})`);
    const why = ffmpegRefusal(bin);
    if (why) throw new RecorderError(`refusing FFMPEG=${bin}: ${why}`);
    if (!isExecutable(bin)) throw new RecorderError(`FFMPEG=${bin} is not an executable file`);
    return bin;
  }
  const names = process.platform === 'win32' ? ['ffmpeg.exe'] : ['ffmpeg'];
  for (const dir of String(env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const bin = path.join(dir, name);
      if (isExecutable(bin) && !ffmpegRefusal(bin)) return bin;
    }
  }
  throw new RecorderError('ffmpeg not found: install it (Homebrew: brew install ffmpeg) or set FFMPEG to its absolute path');
}

// ------------------------------------------------------------------------------------------------
// Where takes may be written
// ------------------------------------------------------------------------------------------------

const RAW_ID = /^[a-z0-9_-]+$/;

// The absolute path of file, when it resolves to <media root>/episodes/<id>/capture/raw/<name>
// with one of the given extensions; throws otherwise. <id> may be an episode id or a test folder
// such as _test.
export function assertRawPath(file, { exts = ['.mp4'], root } = {}) {
  const base = root ?? mediaRoot();
  const real = resolveReal(path.resolve(file));
  if (!isInside(real, base)) throw new RecorderError(`refusing to write ${file}: it is outside the media root ${base}`);
  const parts = path.relative(base, real).split(path.sep);
  const ok = parts.length === 5 && parts[0] === 'episodes' && RAW_ID.test(parts[1])
    && parts[2] === 'capture' && parts[3] === 'raw' && exts.includes(path.extname(parts[4]).toLowerCase());
  if (!ok) {
    throw new RecorderError(`refusing to write ${file}: takes go to <media root>/episodes/<id>/capture/raw/ as ${exts.join(' or ')}`);
  }
  return real;
}

// ------------------------------------------------------------------------------------------------
// Init scripts (run in the page before the app)
// ------------------------------------------------------------------------------------------------

// Virtual clock. opts.startMs fixes the virtual wall clock (default: real now).
export const VT_INIT = (opts = {}) => {
  if (window.__vt) return;
  const N = {
    now: performance.now.bind(performance), dateNow: Date.now, Date,
    setTimeout: window.setTimeout.bind(window), setInterval: window.setInterval.bind(window),
    rAF: window.requestAnimationFrame.bind(window),
  };
  // epoch: wall-clock ms at virtual time 0.
  const vt = { mode: 'real', base: 0, realOffset: 0, epoch: ((opts && opts.startMs) ?? N.dateNow()) - N.now(), timers: new Map(), seq: 1, raf: new Map(), rafSeq: 1, frames: 0 };
  window.__vt = vt;
  const cur = () => (vt.mode === 'real' ? N.now() - vt.realOffset : vt.base);
  const runTimers = (until) => {
    for (let guard = 0; guard < 20000; guard++) {
      let best = null;
      for (const t of vt.timers.values()) if (t.due <= until && (!best || t.due < best.due || (t.due === best.due && t.id < best.id))) best = t;
      if (!best) break;
      if (vt.mode !== 'real' && best.due > vt.base) vt.base = best.due;
      if (best.interval != null) best.due += best.interval; else vt.timers.delete(best.id);
      try { best.fn(...best.args); } catch (e) { console.error(e); }
    }
    if (vt.mode !== 'real') vt.base = Math.max(vt.base, until);
  };
  const runRaf = () => {
    const cbs = [...vt.raf.values()]; vt.raf.clear(); const ts = cur();
    for (const cb of cbs) { try { cb(ts); } catch (e) { console.error(e); } }
  };
  vt.cur = cur;
  vt.step = (dt) => { runTimers(vt.base + dt); runRaf(); vt.frames++; };
  vt.flush = () => { runTimers(vt.base); const n = vt.raf.size; runRaf(); return n; };
  vt.toStep = () => { if (vt.mode === 'step') return; vt.base = cur(); vt.mode = 'step'; };
  vt.toReal = () => { if (vt.mode === 'real') return; vt.realOffset = N.now() - vt.base; vt.mode = 'real'; };
  // Real-mode driver: native timers and frames pump the virtual queues at real speed.
  N.setInterval(() => { if (vt.mode === 'real') runTimers(cur()); }, 4);
  const loop = () => { if (vt.mode === 'real') { runTimers(cur()); runRaf(); } N.rAF(loop); };
  N.rAF(loop);

  const add = (fn, ms, args, interval) => {
    if (typeof fn !== 'function') { const src = String(fn); fn = () => (0, eval)(src); }
    const id = vt.seq++; const d = Math.max(0, +ms || 0);
    vt.timers.set(id, { id, fn, args, due: cur() + d, interval: interval ? Math.max(1, d) : null });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = (id) => { vt.timers.delete(id); };
  window.requestAnimationFrame = (cb) => { const id = vt.rafSeq++; vt.raf.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { vt.raf.delete(id); };
  window.requestIdleCallback = (cb) => add(() => cb({ didTimeout: false, timeRemaining: () => 40 }), 1, [], false);
  window.cancelIdleCallback = (id) => vt.timers.delete(id);
  Object.defineProperty(performance, 'now', { value: () => cur(), configurable: true, writable: true });
  class VDate extends N.Date {
    constructor(...a) { if (a.length === 0) super(vt.epoch + cur()); else super(...a); }
    static now() { return Math.floor(vt.epoch + cur()); }
  }
  window.Date = VDate;
};

// Leaflet maps. IntelliDash bundles Leaflet, so there is no window.L to wrap; the live maps are
// the connected .leaflet-container elements. A tile is still loading while its image is not
// complete (a failed tile is complete too, so a missing tile cannot hang a take).
export const LEAFLET_INIT = () => {
  if (window.__captureLeaflet) return;
  const maps = () => [...document.querySelectorAll('.leaflet-container')].filter((m) => m.isConnected);
  try { Object.defineProperty(window, '__captureMaps', { get: maps, configurable: true }); } catch { /* ignore */ }
  window.__captureLeaflet = {
    state() {
      const live = maps();
      let tiles = 0;
      let loading = 0;
      for (const m of live) {
        for (const img of m.querySelectorAll('img.leaflet-tile')) {
          tiles++;
          if (!img.complete) loading++;
        }
      }
      return { maps: live.length, tiles, loading };
    },
  };
};

// ------------------------------------------------------------------------------------------------
// Easing / cursor maths
// ------------------------------------------------------------------------------------------------

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const CURSOR_SVG = '<svg id="capture-cursor" viewBox="0 0 13 20" xmlns="http://www.w3.org/2000/svg" style="position:fixed;left:0;top:0;width:14.3px;height:22px;pointer-events:none;z-index:2147483647;transform-origin:1.1px 1.1px;display:none;will-change:transform"><path d="M1 1 L1 16 L4.6 12.6 L7.2 18.6 L9.6 17.6 L7 11.8 L12 11.8 Z" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>';

// ------------------------------------------------------------------------------------------------
// Timeline: events and cursor glides at times in the take (seconds)
// ------------------------------------------------------------------------------------------------

export class Timeline {
  constructor(start = { x: 960, y: 540 }) { this.segments = []; this.events = []; this.presses = []; this.start = start; this.visibility = []; this.arcSign = 1; }
  /** Glide the cursor to target ({x,y} | async () => {x,y}) starting at t0 for dur seconds. */
  glide(t0, dur, target, { arc = true } = {}) { this.segments.push({ t0, dur, target, arc: arc ? (this.arcSign *= -1) : 0 }); return this; }
  /** Run fn(recorder) at t. The director starts its in-page plan this way. */
  at(t, fn) { this.events.push({ t, fn }); return this; }
  show(t, v) { this.visibility.push({ t, v }); return this; }
}

// ------------------------------------------------------------------------------------------------
// Recorder
// ------------------------------------------------------------------------------------------------

export class Recorder {
  // target: a Playwright page (or an object with .page, as the iCentral harness passed).
  // options: log, dsf (default 2), viewport (default 1920x1080), cdp (reuse a CDP session the
  // caller already opened on the page), settleMaxMs (per frame, default 6000).
  constructor(target, { log = () => {}, dsf = DEVICE_SCALE_FACTOR, viewport = VIEWPORT, cdp = null, settleMaxMs = 6000 } = {}) {
    const page = target && typeof target.evaluate === 'function' ? target : target?.page;
    if (!page) throw new RecorderError('Recorder needs a Playwright page');
    this.page = page; this.log = log; this.dsf = dsf; this.viewport = { ...viewport }; this._cdp = cdp; this.settleMaxMs = settleMaxMs;
    this.inflight = new Map(); this.settleTimeouts = 0; this.stepping = false;
    page.on('request', (r) => this.inflight.set(r, Date.now()));
    page.on('requestfinished', (r) => this.inflight.delete(r));
    page.on('requestfailed', (r) => this.inflight.delete(r));
  }

  /** Init scripts, as [fn, arg] pairs for page.addInitScript. startMs fixes the virtual wall clock. */
  static initScripts({ startMs } = {}) { return [[VT_INIT, { startMs }], [LEAFLET_INIT, null]]; }

  /** Add the init scripts to this page only (page-scoped). Call before the page's navigation. */
  async install({ startMs } = {}) {
    for (const [fn, arg] of Recorder.initScripts({ startMs })) await this.page.addInitScript(fn, arg);
  }

  async cdp() {
    if (!this._cdp) this._cdp = await this.page.context().newCDPSession(this.page);
    if (!this._animation) { await this._cdp.send('Animation.enable'); this._animation = true; }
    return this._cdp;
  }

  /** 1920x1080 CSS px at the device scale factor: 3840x2160 frames of the viewport only. */
  async setGeometry() {
    const cdp = await this.cdp();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: this.viewport.width, height: this.viewport.height, deviceScaleFactor: this.dsf, mobile: false });
    return { width: Math.round(this.viewport.width * this.dsf), height: Math.round(this.viewport.height * this.dsf) };
  }

  async installCursor(pos) {
    await this.page.evaluate(([svg, p]) => {
      let c = document.getElementById('capture-cursor');
      if (!c) { document.body.insertAdjacentHTML('beforeend', svg); c = document.getElementById('capture-cursor'); }
      c.style.display = 'block'; c.style.transform = `translate(${p.x - 1.1}px,${p.y - 1.1}px)`;
    }, [CURSOR_SVG, pos]);
    this.cursor = { ...pos };
  }

  async hideCursor() { await this.page.evaluate(() => { const c = document.getElementById('capture-cursor'); if (c) c.style.display = 'none'; }); }

  async toStep() {
    const cdp = await this.cdp();
    await this.page.evaluate(() => window.__vt.toStep());
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
    this.stepping = true;
  }

  async toReal() {
    const cdp = await this.cdp();
    await this.page.evaluate(() => window.__vt && window.__vt.toReal());
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
    this.stepping = false;
  }

  /** Requests still in flight, not counting long-lived ones. */
  pending() {
    const now = Date.now();
    let n = 0;
    for (const started of this.inflight.values()) if (now - started < STALE_REQUEST_MS) n++;
    return n;
  }

  async pageQuiet() {
    return this.page.evaluate(() => {
      const busy = typeof window.__captureBusy === 'function' && window.__captureBusy();
      const maps = window.__captureLeaflet ? window.__captureLeaflet.state() : { loading: 0 };
      return !busy && maps.loading === 0;
    });
  }

  /** Wait until nothing is loading; then render pending frames at the same instant. Returns ms, or -1 on timeout. */
  async settle(maxMs = this.settleMaxMs) {
    const t0 = Date.now(); let rounds = 0;
    for (;;) {
      if (this.pending() === 0 && await this.pageQuiet()) {
        const pending = await this.page.evaluate(() => window.__vt.flush());
        if (!pending || ++rounds >= 3) {
          if (this.pending() === 0 && await this.pageQuiet()) return Date.now() - t0;
        }
      }
      if (Date.now() - t0 > maxMs) { this.settleTimeouts++; this.log(`settle timeout (${this.pending()} in flight)`); return -1; }
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  /**
   * Record one take.
   *   file: output .mp4 under <media root>/episodes/<id>/capture/raw/
   *   seconds: total length    build(tl, recorder): fills the Timeline
   *   probe(recorder, i): optional per-frame callback; its return values are collected into
   *     result.probe, and a throw aborts the take (the partial file is deleted)
   *   cursor: draw the recorder's own cursor (default false: the director draws its own)
   */
  async take({ file, seconds, build = () => {}, probe, cursor = false, startCursor, crf = 12, preset = 'slow' }) {
    const out = assertRawPath(file);
    const ffmpeg = resolveFfmpeg();
    if (!(seconds > 0)) throw new RecorderError('take needs a positive length in seconds');
    const page = this.page;
    const { width: W, height: H } = await this.setGeometry();
    await page.waitForTimeout(300);
    const vp = this.viewport;
    const tl = new Timeline(startCursor ?? this.cursor ?? { x: vp.width * 0.62, y: vp.height * 0.58 });
    await build(tl, this);
    tl.events.sort((a, b) => a.t - b.t);
    if (cursor) await this.installCursor(tl.start); else await this.hideCursor();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-r', String(FPS), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res, rej) => {
      ff.on('error', rej);
      ff.on('close', (c) => (c === 0 ? res() : rej(new RecorderError(`ffmpeg exit ${c}`))));
    });
    ff.stdin.on('error', () => {});
    const cdp = await this.cdp();
    await this.toStep();
    const n = Math.round(seconds * FPS); const dt = 1000 / FPS; const probes = []; const t0 = Date.now(); let settleMax = 0; let ev = 0;
    let seg = null; let segFrom = null; let segTo = null; let pos = { ...tl.start }; const segs = [...tl.segments].sort((a, b) => a.t0 - b.t0);
    try {
      for (let i = 0; i < n; i++) {
        const t = i / FPS;
        while (ev < tl.events.length && tl.events[ev].t <= t + 1e-9) { await tl.events[ev].fn(this); ev++; }
        while (segs.length && segs[0].t0 <= t + 1e-9) { seg = segs.shift(); segFrom = { ...pos }; segTo = typeof seg.target === 'function' ? await seg.target(this) : seg.target; }
        if (seg) {
          const u = clamp01((t - seg.t0) / seg.dur); const e = easeInOut(u);
          const dx = segTo.x - segFrom.x, dy = segTo.y - segFrom.y, dist = Math.hypot(dx, dy) || 1;
          const bow = seg.arc * Math.min(36, dist * 0.08) * Math.sin(Math.PI * e);
          pos = { x: segFrom.x + dx * e + (-dy / dist) * bow, y: segFrom.y + dy * e + (dx / dist) * bow };
          if (u >= 1) seg = null;
        }
        let visible = cursor; for (const vv of tl.visibility) if (t >= vv.t) visible = vv.v;
        // Advance one frame of virtual time: JS clock, CSS and Web animations, the cursor overlay.
        await page.evaluate(([d, c, vis]) => {
          window.__vt.step(d);
          for (const a of document.getAnimations()) { try { if (a.playState === 'running') a.currentTime = (a.currentTime ?? 0) + d * (a.playbackRate || 1); } catch { /* ignore */ } }
          const el = document.getElementById('capture-cursor');
          if (el) { el.style.display = vis ? 'block' : 'none'; el.style.transform = `translate(${c.x - 1.1}px,${c.y - 1.1}px)`; }
        }, [dt, pos, visible]);
        const s = await this.settle(); settleMax = Math.max(settleMax, s);
        if (probe) probes.push(await probe(this, i));
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false, fromSurface: true });
        const buf = Buffer.from(shot.data, 'base64');
        if (i === 0) {
          const w = buf.readUInt32BE(16); const h = buf.readUInt32BE(20);
          if (w !== W || h !== H) throw new RecorderError(`frame is ${w}x${h}, expected ${W}x${H}: the device metrics override did not apply`);
        }
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        if (i % 60 === 0) this.log(`  frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    } catch (e) {
      ffDone.catch(() => {}); ff.kill('SIGKILL');
      await this.toReal().catch(() => {});
      fs.rmSync(out, { force: true });
      throw e;
    }
    ff.stdin.end(); await ffDone;
    await this.toReal();
    return { file: out, frames: n, fps: FPS, width: W, height: H, dprAfter: await page.evaluate(() => devicePixelRatio), wallSeconds: (Date.now() - t0) / 1000, settleMaxMs: settleMax, settleTimeouts: this.settleTimeouts, probe: probes };
  }
}

/** 6-frame contact sheet (3x2) for review, written beside the take under the media root. */
export async function contactSheet(file, out, frames) {
  const target = assertRawPath(out, { exts: ['.jpg'] });
  const ffmpeg = resolveFfmpeg();
  const step = Math.max(1, Math.floor(frames / 6));
  await new Promise((res, rej) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `select='not(mod(n\\,${step}))',scale=960:-2,tile=3x2:padding=6:color=white`, '-frames:v', '1', '-q:v', '3', target], { stdio: 'inherit' });
    p.on('error', rej);
    p.on('close', (c) => (c === 0 ? res() : rej(new RecorderError(`contact sheet: ffmpeg exit ${c}`))));
  });
  return target;
}

/** Codec, size, fps, duration, frame count and bytes, read with ffmpeg alone. */
export async function probeFile(file) {
  const ffmpeg = resolveFfmpeg();
  const head = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr ?? '';
  const count = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
  const m = /Stream.*Video: (\w+).*?, (\d{3,5})x(\d{3,5}).*?, ([\d.]+) fps/.exec(head);
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(head);
  const f = [...count.matchAll(/frame=\s*(\d+)/g)].at(-1);
  return {
    codec: m?.[1], width: +m?.[2], height: +m?.[3], fps: +m?.[4],
    duration: d ? (+d[1] * 3600 + +d[2] * 60 + +d[3]) : null,
    frames: f ? +f[1] : null,
    pixFmt: /yuv\w+/.exec(head)?.[0] ?? null,
    bytes: fs.statSync(file).size,
  };
}
