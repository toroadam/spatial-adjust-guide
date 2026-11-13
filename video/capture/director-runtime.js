// In-page runtime for the capture director (video/capture/director.mjs).
//
// The director adds this file with page.addInitScript on its own page only, so it runs at the
// start of every document in that page, before the app. It defines window.__sa and does nothing
// visible until the director calls window.__sa.run(plan):
//
//   window.__sa.arm({ token, demoVerified, writeHosts })  called once, by the director, after the
//                                    Demo Mode entry is verified; sets window.__saArmed
//   window.__sa.run(plan)            plays the episode's beats: cursor glides, hovers, the spotlight,
//                                    scrolls and guarded clicks; a magenta full-frame sync
//                                    flash at the start and the end (the edit's builder finds the
//                                    take's start and end by it)
//   window.__sa.log                  cue log: [{ id, t }], t in seconds from the start flash
//   window.__sa.clicks               the time of every click, in the same seconds
//   window.__sa.done, .err           run finished / failed (string)
//   window.__sa.focusBox()           union of the live highlight boxes, CSS px [x0, y0, x1, y1] or null
//   window.__sa.probe()              per-frame cursor, ripple, focus box, spotlight opacity and arming sentinel
//   window.__sa.scan(denylist)       1-based indices of denylisted terms on screen; never a term
//
// Safety, in the page:
//   * Targets are resolved by the director in Node, never here: for each step the runtime asks
//     window.__saAct({ i, kind }) and the director answers with a token for the exact element it
//     checked (for a click, after guardedClick in scripts/lib/guarded-click.mjs passed it).
//   * Right before a click is dispatched the runtime checks the element again: the same name and
//     icon the director approved, the action's name, and the write guard. The write guard pattern
//     is passed in by the director from scripts/lib/writes.mjs (window.__saGuardConfig); without
//     it every click is refused.
//   * Once armed, fetch, XMLHttpRequest, sendBeacon and WebSocket refuse anything but GET, HEAD and
//     OPTIONS (except the director's writeHosts) and report it with window.__saTrip, which ends
//     the take. The director's request route aborts the same requests again outside the page.
//     window.open, and a form that would post into a new window, are refused too: a new window is
//     outside the route's reach.
//   * window.__captureBusy() is true while the director is checking a step, so the recorder does
//     not advance a frame until the answer is in.
//
// What marks the thing the voice is on is a spotlight, not a box: the rest of the frame dims and the target stays lit (see
// SPOT; mirrored in video/edit/lib/brand.py SPOTLIGHT, and checked against it by test_brand.py). It is drawn in the page, under
// the cursor, so the cursor is never dimmed. Primitives (cursor, glide, hover events, ripple, highlight boxes, focus box, scroll, cue log,
// sync flash) are ported from the iCentral Double Click director
// (~/Documents/iCentral_MarCom/double-clicks/01-home/capture/director.js lines 1-125, modified
// 2026-10-19T10:24:07-0700). Its take body (lines 127-271) and its overlay were not copied.
(() => {
  if (window.__sa) return;

  const cfg = window.__saGuardConfig || {};
  // Fail closed: with no pattern from the director, every name counts as write-like.
  const WRITES = typeof cfg.writes === 'string' ? new RegExp(cfg.writes, String(cfg.flags || '').replace(/[gy]/g, '')) : /(?:)/;
  const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
  // The spotlight: dim the frame (black, `dim`, a little darker toward the corners by `vignette`) except one rounded cutout, the
  // union of the live, visible highlight boxes grown by pad = clamp(padFrac x its longer side, padMin, padMax) CSS px. The cutout's
  // corners are radiusFrac of its shorter side (radiusMin..radiusMax), its edge is feathered by `feather` CSS px, it eases to a new
  // element with time constant `follow` s, and the dim fades in and out over `fade` s. A click presses the cursor to pressScale and
  // sends a white ripple at rippleAlpha. Never blue, never a rectangle outline.
  const SPOT = { dim: 0.5, vignette: 0.06, feather: 10, padFrac: 0.1, padMin: 12, padMax: 44, radiusFrac: 0.08, radiusMin: 10, radiusMax: 22, fade: 0.4, follow: 0.18, pressScale: 0.86, rippleAlpha: 0.45 };
  const FLASH = '#ff00ff';

  const sa = (window.__sa = {
    log: [], clicks: [], done: false, err: null, stop: false, awaiting: 0, trips: [],
    armed: null, demoVerified: false, writeHosts: [], t0: 0,
  });
  window.__captureBusy = () => sa.awaiting > 0;

  // ---- arming and the in-page write guard ----------------------------------------------------
  const isArmed = () => typeof window.__saArmed === 'string' && window.__saArmed === sa.armed;
  sa.arm = ({ token, demoVerified = false, writeHosts = [] } = {}) => {
    if (sa.armed) return false;
    sa.armed = String(token);
    sa.demoVerified = demoVerified === true;
    sa.writeHosts = writeHosts.map((h) => String(h).toLowerCase());
    window.__saArmed = sa.armed;
    return true;
  };

  const where = (url) => {
    try { const u = new URL(String(url), document.baseURI); return { host: u.host, path: u.pathname }; } catch { return { host: '', path: String(url).split(/[?#]/)[0] }; }
  };
  const trip = (kind, method, url, extra = {}) => {
    const w = url === undefined ? { host: '', path: '' } : where(url);
    const rec = { kind, method, host: w.host, path: w.path, ...extra };
    sa.trips.push(rec);
    try { if (typeof window.__saTrip === 'function') window.__saTrip(rec); } catch { /* reported by the route too */ }
    return rec;
  };
  const blockedWrite = (method, url) => isArmed() && !SAFE.has(String(method || 'GET').toUpperCase()) && !sa.writeHosts.includes(where(url).host.toLowerCase());

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function fetch(input, init) {
      const method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (blockedWrite(method, url)) {
        trip('write', String(method).toUpperCase(), url, { via: 'fetch' });
        return Promise.reject(new TypeError('blocked by the capture director'));
      }
      return nativeFetch.apply(this, arguments);
    };
  }
  const xopen = XMLHttpRequest.prototype.open;
  const xsend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function open(method, url) {
    this.__saReq = { method: String(method || 'GET').toUpperCase(), url: String(url) };
    return xopen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function send() {
    const r = this.__saReq;
    if (r && blockedWrite(r.method, r.url)) {
      trip('write', r.method, r.url, { via: 'xhr' });
      throw new DOMException('blocked by the capture director', 'NetworkError');
    }
    return xsend.apply(this, arguments);
  };
  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (blockedWrite('POST', url)) { trip('write', 'POST', url, { via: 'beacon' }); return false; }
      return beacon(url, data);
    };
  }
  const NativeWebSocket = window.WebSocket;
  if (NativeWebSocket) {
    const Guarded = function WebSocket(url, protocols) {
      if (isArmed()) {
        trip('websocket', 'GET', url, { via: 'websocket' });
        throw new DOMException('blocked by the capture director', 'SecurityError');
      }
      return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    };
    Guarded.prototype = NativeWebSocket.prototype;
    for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) Guarded[k] = NativeWebSocket[k];
    window.WebSocket = Guarded;
  }
  // A page route cannot see a new window, so after arming the page may not open one: window.open
  // is refused, and so is a form that would submit into a new window with anything but GET. A
  // form that submits into this page or one of its frames is left to the route.
  const nativeOpen = window.open;
  window.open = function open(url) {
    if (isArmed()) { trip('popup', 'GET', url === undefined ? '' : url, { via: 'window.open' }); return null; }
    return nativeOpen.apply(this, arguments);
  };
  const newWindowTarget = (form, submitter) => {
    const t = String((submitter && submitter.getAttribute && submitter.getAttribute('formtarget')) || form.getAttribute('target') || '').trim();
    if (!t || /^_(self|parent|top)$/i.test(t)) return false;
    return !SA('iframe,frame').some((f) => f.name === t);
  };
  const formMethod = (form, submitter) => String((submitter && submitter.getAttribute && submitter.getAttribute('formmethod')) || form.getAttribute('method') || 'GET').toUpperCase();
  const formBlocked = (form, submitter) => isArmed() && newWindowTarget(form, submitter) && !SAFE.has(formMethod(form, submitter));
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form instanceof HTMLFormElement && formBlocked(form, e.submitter)) {
      e.preventDefault(); e.stopImmediatePropagation();
      trip('write', formMethod(form, e.submitter), form.action, { via: 'form' });
    }
  }, true);
  const nativeSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function submit() {
    if (formBlocked(this, null)) { trip('write', formMethod(this, null), this.action, { via: 'form' }); return undefined; }
    return nativeSubmit.apply(this, arguments);
  };

  // ---- layer ---------------------------------------------------------------------------------
  const S = (s, root = document) => root.querySelector(s);
  const SA = (s, root = document) => [...root.querySelectorAll(s)];
  const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);        // the cursor's glide: no jerk at either end
  const rect = (el) => el.getBoundingClientRect();
  const now = () => (performance.now() - sa.t0) / 1000;

  let layer = null;
  let spotGen = 0;                                                     // one spotlight loop per layer
  let cursor = null;
  const cur = { x: innerWidth * 0.62, y: innerHeight * 0.55 };
  let pressed = 1;                                                    // the cursor's press scale: 1 at rest, SPOT.pressScale held down
  const place = () => { if (cursor) cursor.style.transform = `translate(${cur.x - 1.1}px,${cur.y - 1.1}px) scale(${pressed})`; };
  const ensureLayer = () => {
    if (layer && layer.isConnected) return layer;
    SA('.sa-layer').forEach((e) => e.remove());
    layer = document.createElement('div');
    layer.className = 'sa-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
    layer.innerHTML = `
      <style>
        .sa-rip{position:fixed;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;pointer-events:none;
          background:radial-gradient(circle,rgba(255,255,255,1) 0%,rgba(255,255,255,.85) 22%,rgba(255,255,255,.35) 48%,rgba(255,255,255,0) 70%);
          filter:drop-shadow(0 1px 6px rgba(10,16,24,.30));animation:sarip .6s cubic-bezier(.2,.7,.3,1) forwards}
        @keyframes sarip{from{transform:scale(.35);opacity:${SPOT.rippleAlpha}}35%{opacity:${+(SPOT.rippleAlpha * 0.9).toFixed(3)}}to{transform:scale(1.4);opacity:0}}
      </style>
      <svg id="sa-spot" width="${innerWidth}" height="${innerHeight}" style="position:fixed;left:0;top:0;opacity:0;pointer-events:none">
        <defs>
          <radialGradient id="sa-vg" gradientUnits="userSpaceOnUse" cx="${innerWidth / 2}" cy="${innerHeight / 2}" r="${Math.hypot(innerWidth, innerHeight) / 2}">
            <stop offset="0.35" stop-color="#000" stop-opacity="${SPOT.dim}"/><stop offset="1" stop-color="#000" stop-opacity="${Math.min(0.9, SPOT.dim + SPOT.vignette)}"/>
          </radialGradient>
          <filter id="sa-feather" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="${SPOT.feather / 2}"/></filter>
          <mask id="sa-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${innerWidth}" height="${innerHeight}">
            <rect x="0" y="0" width="${innerWidth}" height="${innerHeight}" fill="#fff"/>
            <rect id="sa-cut" x="0" y="0" width="0" height="0" fill="#000" filter="url(#sa-feather)"/>
          </mask>
        </defs>
        <rect x="0" y="0" width="${innerWidth}" height="${innerHeight}" fill="url(#sa-vg)" mask="url(#sa-mask)"/>
      </svg>
      <svg id="sa-cursor" viewBox="0 0 13 20" style="position:fixed;left:0;top:0;width:15.6px;height:24px;transform-origin:1.1px 1.1px;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))"><path d="M1 1 L1 16 L4.6 12.6 L7.2 18.6 L9.6 17.6 L7 11.8 L12 11.8 Z" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>
      <div id="sa-flash" style="position:fixed;inset:0;background:${FLASH};display:none"></div>`;
    document.body.appendChild(layer);
    cursor = S('#sa-cursor', layer);
    place();
    spotGen++; spotTick(true, spotGen);
    return layer;
  };

  // ---- primitives ------------------------------------------------------------------------------
  const center = (el, dx = 0.5, dy = 0.5) => { const b = rect(el); return { x: b.x + b.width * dx, y: b.y + b.height * dy }; };
  const glide = (el, dur = 0.75, dx, dy) => new Promise((res) => {
    const p0 = { ...cur }, t0 = performance.now();
    const step = () => {
      const p1 = typeof el === 'function' ? el() : el.x !== undefined ? el : center(el, dx, dy);
      const t = Math.min(1, (performance.now() - t0) / (dur * 1000)), k = smoother(t);
      const vx = p1.x - p0.x, vy = p1.y - p0.y, arc = Math.sin(Math.PI * k) * Math.min(60, Math.hypot(vx, vy) * 0.08);
      const n = Math.hypot(vx, vy) || 1;
      cur.x = p0.x + vx * k + (-vy / n) * arc; cur.y = p0.y + vy * k + (vx / n) * arc; place();
      t < 1 ? requestAnimationFrame(step) : res();
    };
    step();
  });
  const fire = (el, types) => {
    const b = rect(el), x = b.x + b.width / 2, y = b.y + b.height / 2;
    types.forEach((t) => el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { bubbles: !/enter|leave/.test(t), clientX: x, clientY: y })));
  };
  let hovered = null;
  const unhover = () => { if (hovered && hovered.isConnected) fire(hovered, ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']); hovered = null; };
  const hover = (el) => { unhover(); hovered = el; fire(el, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']); };
  const ripple = () => {
    const r = document.createElement('div'); r.className = 'sa-rip'; r.style.left = cur.x + 'px'; r.style.top = cur.y + 'px';
    ensureLayer().appendChild(r); setTimeout(() => r.remove(), 700);
  };

  // The cursor's press: scale to `to` over `dur` s (the eased dip of a click, and the release after it).
  const pressTo = (to, dur) => new Promise((res) => {
    const a = pressed, t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
      pressed = a + (to - a) * ease(t); place();
      t < 1 ? requestAnimationFrame(step) : res();
    };
    step();
  });

  // Highlight boxes: not drawn. A box is a live record of an element the voice is on; the spotlight lights the union of the
  // visible ones, and sa.focusBox() hands the camera the union of the rest (a `frame` box is hidden: camera only).
  const hls = new Set();
  const hl = (getEl, pad = 6, hidden = false) => {
    const h = { on: true, getEl, pad, hidden };
    h.off = () => { h.on = false; hls.delete(h); };
    hls.add(h); return h;
  };
  const hlOffAll = () => [...hls].forEach((h) => h.off());
  // Camera focus for the edit: union of the live highlight boxes, CSS px [x0, y0, x1, y1] or null.
  sa.focusBox = () => {
    let u = null;
    // A camera-only box (the frame action) names what the camera must show; while one is live it alone sets the
    // camera, and the drawn focus boxes only mark the thing the voice is on.
    const anyHidden = [...hls].some((h) => h.hidden);
    for (const h of hls) {
      if (anyHidden && !h.hidden) continue;
      const el = typeof h.getEl === 'function' ? h.getEl() : h.getEl; if (!el || !el.isConnected) continue;
      const b = rect(el); if (!b.width || !b.height) continue;
      const r = [b.left - h.pad, b.top - h.pad, b.right + h.pad, b.bottom + h.pad];
      u = u ? [Math.min(u[0], r[0]), Math.min(u[1], r[1]), Math.max(u[2], r[2]), Math.max(u[3], r[3])] : r;
    }
    return u && u.map((v) => Math.round(v));
  };

  // ---- the spotlight ---------------------------------------------------------------------------
  const spot = { on: false, p: 0, rect: null, last: 0 };            // p: fade progress 0..1; rect: the eased cutout [x0, y0, x1, y1]
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const spotTarget = () => {
    let u = null;
    for (const h of hls) {
      if (h.hidden) continue;
      const el = typeof h.getEl === 'function' ? h.getEl() : h.getEl; if (!el || !el.isConnected) continue;
      const b = rect(el); if (!b.width || !b.height) continue;
      const r = [b.left, b.top, b.right, b.bottom];
      u = u ? [Math.min(u[0], r[0]), Math.min(u[1], r[1]), Math.max(u[2], r[2]), Math.max(u[3], r[3])] : r;
    }
    if (!u) return null;
    const pad = clamp(SPOT.padFrac * Math.max(u[2] - u[0], u[3] - u[1]), SPOT.padMin, SPOT.padMax);
    return [u[0] - pad, u[1] - pad, u[2] + pad, u[3] + pad];
  };
  const spotTick = (first, gen) => {
    if (!layer || !layer.isConnected || gen !== spotGen) return;
    const t = performance.now(), dt = first === true ? 0 : Math.min(0.25, (t - spot.last) / 1000);
    spot.last = t;
    const tg = spotTarget();
    if (tg) {
      if (!spot.rect || spot.p <= 0.001) spot.rect = tg.slice();     // appearing: arrive in place, no slide from the last element
      else { const k = 1 - Math.exp(-dt / SPOT.follow); spot.rect = spot.rect.map((v, i) => v + (tg[i] - v) * k); }
    }
    spot.on = !!tg;
    spot.p = clamp(spot.p + (spot.on ? dt : -dt) / SPOT.fade, 0, 1);
    const svg = S('#sa-spot', layer), cut = S('#sa-cut', layer);
    if (svg && cut) {
      svg.style.opacity = String(smoother(spot.p));
      if (spot.rect) {
        const [x0, y0, x1, y1] = spot.rect, w = x1 - x0, h = y1 - y0;
        const rad = clamp(SPOT.radiusFrac * Math.min(w, h), SPOT.radiusMin, SPOT.radiusMax);
        cut.setAttribute('x', x0); cut.setAttribute('y', y0); cut.setAttribute('width', Math.max(0, w)); cut.setAttribute('height', Math.max(0, h));
        cut.setAttribute('rx', rad); cut.setAttribute('ry', rad);
      }
    }
    requestAnimationFrame(() => spotTick(false, gen));
  };

  // The nearest scrollable box at or above el (the page itself when there is none).
  const scroller = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return n;
    }
    return document.scrollingElement || document.documentElement;
  };
  const scrollBy = (el, dy, dur = 0.9) => new Promise((res) => {
    const sc = scroller(el), a = sc.scrollTop, t0 = performance.now();
    const step = () => { const t = Math.min(1, (performance.now() - t0) / (dur * 1000)); sc.scrollTop = a + dy * ease(t); t < 1 ? requestAnimationFrame(step) : res(); };
    step();
  });

  const cue = (id) => { sa.log.push({ id, t: +now().toFixed(3) }); };
  const flash = async () => { const f = S('#sa-flash', ensureLayer()); f.style.display = 'block'; await sleep(0.25); f.style.display = 'none'; };

  // ---- the element check (same rules as describeElement in scripts/lib/guarded-click.mjs) --------
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const same = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();
  const describe = (node) => {
    const byIds = (ids) => norm(String(ids || '').split(/\s+/).filter(Boolean).map((id) => (document.getElementById(id) || {}).innerText || '').join(' '));
    const buttonValue = node.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(node.type) ? node.value : '';
    const imgAlt = node.querySelector('img[alt]');
    const name = norm(node.getAttribute('aria-label')) || byIds(node.getAttribute('aria-labelledby'))
      || norm(node.innerText) || norm(node.getAttribute('title')) || norm(buttonValue) || norm(imgAlt && imgAlt.getAttribute('alt'));
    const pick = (sel) => (node.matches(sel) ? node : node.querySelector(sel));
    const fa = pick('fa-icon[icon]'); const svg = pick('svg[data-icon]'); const img = pick('img[src]');
    const src = img && img.getAttribute('src');
    const imgId = src ? src.split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '') : null;
    return { name, iconId: (fa && fa.getAttribute('icon')) || (svg && svg.getAttribute('data-icon')) || imgId || null };
  };

  // ---- targets, resolved by the director -------------------------------------------------------
  const approved = new Map();
  sa._approve = (node, a) => { approved.set(String(a.token), { node, ...a }); return true; };
  const refusal = (message) => { const e = new Error(message); e.name = 'GuardRefusal'; return e; };
  const ask = async (i, kind) => {
    if (typeof window.__saAct !== 'function') throw refusal('the director is not connected (window.__saAct is missing)');
    sa.awaiting++;
    try { return await window.__saAct({ i, kind }); } finally { sa.awaiting--; }
  };
  const target = async (i, kind, timeout = 8) => {
    const t = now();
    for (;;) {
      if (sa.stop) throw new Error('stopped by the director');
      const r = await ask(i, kind);
      if (r && r.ok) {
        const a = approved.get(String(r.token)); approved.delete(String(r.token));
        if (a && a.node && a.node.isConnected) return a;
      } else if (r && r.refused) {
        throw refusal(`step ${i} refused: ${r.reason}`);
      } else if (r && r.fatal) {
        throw new Error(`step ${i}: ${r.reason}`);
      }
      if (now() - t > timeout) { trip('missing', '', undefined, { step: i }); throw refusal(`step ${i}: target not found within ${timeout} s`); }
      await sleep(0.1);
    }
  };

  // The second check, in the page, right before the click is dispatched.
  const recheck = (a, step) => {
    const d = describe(a.node);
    if (!same(d.name, a.name)) return `the element's name changed to "${d.name}" after the director checked it`;
    if ((d.iconId || null) !== (a.iconId || null)) return 'the element\'s icon changed after the director checked it';
    if (!same(d.name, step.name)) return `"${d.name}" is not the action's "${step.name}"`;
    if (WRITES.test(d.name) && !(a.allowWrite === true && sa.demoVerified === true && isArmed())) return `"${d.name}" matches the write guard`;
    return null;
  };

  const click = async (step) => {
    const a = await target(step.i, 'click');
    await glide(a.node, 0.75); hover(a.node); await sleep(0.13);          // the 0.25 s dwell: 0.13 s, then the 0.12 s press
    const why = recheck(a, step);
    if (why) { trip('refusal', '', undefined, { step: step.i, reason: why }); throw refusal(`click refused in the page: ${why}`); }
    await pressTo(SPOT.pressScale, 0.12);
    ripple(); unhover();
    sa.clicks.push(+now().toFixed(3));
    a.node.click();
    pressTo(1, 0.2);
  };

  // A drag, for a slider handle of the guide site's own figure: glide to the handle, press, move it dx
  // CSS px sideways along the cursor's own glide (pointermove at every frame), then let go. Only the
  // approved element receives events, and only pointer events; the page decides what they mean.
  const drag = async (step) => {
    const a = await target(step.i, 'drag');
    await glide(a.node, 0.75); hover(a.node); await sleep(0.05); await pressTo(SPOT.pressScale, 0.1);
    const b = rect(a.node), x0 = b.x + b.width / 2, y0 = b.y + b.height / 2;
    const ev = (type, x, y) => a.node.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    ripple(); unhover(); sa.clicks.push(+now().toFixed(3)); ev('pointerdown', x0, y0);
    const dur = (step.ms || 1200) / 1000;
    await new Promise((res) => {
      const t0 = performance.now();
      const run = () => {
        const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
        cur.x = x0 + step.dx * smoother(t); cur.y = y0; place(); ev('pointermove', cur.x, cur.y);
        t < 1 ? requestAnimationFrame(run) : res();
      };
      run();
    });
    await sleep(0.25);
    ev('pointerup', cur.x, cur.y);
    pressTo(1, 0.2);
  };

  const act = async (step, beatBoxes) => {
    switch (step.type) {
      case 'wait': await sleep((step.ms || 0) / 1000); return;
      case 'cue': cue(step.id); return;
      case 'hover': { const a = await target(step.i, 'hover'); await glide(a.node, 0.75); hover(a.node); return; }
      case 'focus': { const a = await target(step.i, 'focus'); beatBoxes.push(hl(a.node, 8)); return; }
      case 'frame': { const a = await target(step.i, 'frame'); beatBoxes.push(hl(a.node, 8, true)); return; }
      case 'drag': await drag(step); return;
      case 'scroll': { const a = await target(step.i, 'scroll'); await scrollBy(a.node, step.dy || 0); return; }
      case 'click': await click(step); return;
      case 'figure': {
        // The director swaps the lifted recreation figure in Node while the recorder waits.
        const r = await ask(step.i, 'figure');
        if (!r || !r.ok) throw new Error(`step ${step.i}: figure not lifted${r && r.reason ? ` (${r.reason})` : ''}`);
        return;
      }
      default: throw new Error(`unknown action type "${step.type}"`);
    }
  };

  // plan: { lead, beats: [{ id, hold, highlight: i | null, actions: [{ i, type, ... }] }] }
  sa.run = async (plan) => {
    ensureLayer();
    sa.t0 = performance.now(); sa.done = false; sa.err = null; sa.log = []; sa.clicks = [];
    try {
      await flash();
      await sleep(Math.max(0, (plan.lead || 0) - now()));
      let at = plan.lead || 0;
      for (const beat of plan.beats || []) {
        if (sa.stop) throw new Error('stopped by the director');
        const end = at + (beat.hold || 0);
        const boxes = [];
        if (beat.highlight !== null && beat.highlight !== undefined) { const a = await target(beat.highlight, 'highlight'); boxes.push(hl(a.node, 6)); }
        for (const step of beat.actions || []) await act(step, boxes);
        await sleep(Math.max(0, end - now()));
        boxes.forEach((b) => b.off());
        at = Math.max(end, now());
      }
      unhover(); hlOffAll();
      await sleep(0.2);
      await flash();
      sa.done = true;
    } catch (e) {
      sa.err = String((e && (e.stack || e.message)) || e);
      throw e;
    }
  };

  sa.state = () => ({ done: sa.done, err: sa.err, trips: sa.trips.length });
  sa.probe = () => ({
    x: cur.x, y: cur.y, rip: SA('.sa-rip').length, fb: sa.focusBox(), sp: +spot.p.toFixed(3),
    armed: typeof window.__saArmed === 'string' ? window.__saArmed : null, path: location.pathname,
    done: sa.done, err: sa.err !== null,
  });

  // Denylisted text on screen, as 1-based indices. Terms of six characters or more match anywhere;
  // shorter terms match as whole words only.
  sa.scan = (denylist) => {
    const parts = [document.title, document.body ? document.body.innerText : ''];
    for (const el of SA('[title],[aria-label],[placeholder],[alt]')) {
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v) parts.push(v); }
    }
    for (const el of SA('input,textarea')) if (el.value) parts.push(el.value);
    const text = parts.join('\n');
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hits = [];
    (denylist || []).forEach((term, k) => {
      const t = String(term || '').trim(); if (!t) return;
      const re = t.length >= 6 ? new RegExp(esc(t), 'iu') : new RegExp(`(?<![\\p{L}\\p{N}])${esc(t)}(?![\\p{L}\\p{N}])`, 'iu');
      if (re.test(text)) hits.push(k + 1);
    });
    return hits;
  };
})();
