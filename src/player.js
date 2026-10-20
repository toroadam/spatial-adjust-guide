// The Double Click treatment in the guide player: a design-system blue ring around the control a
// step names. Injected by build.mjs, outside the Core Design export, so a re-export keeps it.
//
// Where the ring goes. src/transform-export.mjs puts each step's resolved cursor target on the
// player stage and on every article figure as data-sa-target="x,y", in the reproduction's own
// 1920x1080 design space (the space TARGETS is written in). This file finds the smallest reproduced
// element containing that point and outlines it. Nothing here reads component state: the point
// comes from the attribute and everything else is measured from the rendered page.
//
// Why geometry rather than elementsFromPoint. The reproduction is pointer-events: none, so the
// hit-testing APIs see straight through it; scripts/cursor-target.mjs records the same finding.
// Every element's rect is converted to app coordinates instead: its offset from the .sa-app rect,
// divided by the rendered scale (app width / 1920). That holds for the stage, which the camera
// scales and pans, for the figures, which are fixed crops, and in the middle of a camera move,
// because the whole app is under one uniform scale-and-translate.
//
// Why the ring is placed from the FINAL camera transform. The camera pans over .85s. Placing the
// ring from the rendered rects would put it where the control was when the step changed and leave
// it there for most of a second. The app wrapper's inline transform already holds where the camera
// is going, so the ring is placed there and given the camera's own duration and easing: it travels
// with the picture. Under reduced motion neither moves. transitionend re-measures anyway, so a
// transform this file cannot parse still ends up right.
//
// Where the ring lives. It is a sibling overlay in the container (the stage, or the figure), not a
// child of anything inside the app: the runtime re-renders the app on every step, and a node of
// ours inside it could be dropped or duplicated. aria-hidden: the ring repeats what the step text
// says, and the live region already announces the step.
(function () {
  'use strict';

  var APP_W = 1920;
  var APP_H = 1080;
  var OUTSET = 4;          // px between the control's edge and the ring, in rendered pixels
  var MIN_SIDE = 8;        // app px; anything smaller is an icon stroke or a spacer, not a control
  // Of the app's area; anything larger is the app's frame rather than something a step names. Half,
  // not less, because the map panel is 47% of the app and is what a map-navigation step points at.
  var MAX_SHARE = 0.5;
  var TRANSFORM = /scale\(\s*([-\d.e]+)\s*\)\s*translate\(\s*([-\d.e]+)px\s*,\s*([-\d.e]+)px\s*\)/;

  /** Every element that carries a target: the player stage and each article figure. */
  function containers() {
    return document.querySelectorAll('[data-sa-target]');
  }

  function own(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest && el.closest('.lsa-hl'));
  }

  function targetOf(c) {
    var v = (c.getAttribute('data-sa-target') || '').split(',');
    var x = parseFloat(v[0]), y = parseFloat(v[1]);
    return isFinite(x) && isFinite(y) ? { x: x, y: y } : null;
  }

  /** The element that clips the app inside this container: the stage itself, or a figure's crop. */
  function frameOf(c, app) {
    for (var e = app.parentElement; e && e !== c; e = e.parentElement) {
      if (getComputedStyle(e).overflow !== 'visible') return e;
    }
    return c;
  }

  /** The direct child of `frame` that holds the app and carries the camera or crop transform. */
  function wrapperOf(frame, app) {
    var e = app;
    while (e && e.parentElement !== frame) e = e.parentElement;
    return e;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * The element under the point: the smallest one whose app-space rect contains it, within the size
   * bounds, taken from the topmost layer that has one.
   *
   * Layers, because containment alone ignores painting order. A dialog sits on a full-screen
   * backdrop (position absolute, z-index 900) over the map, and the map's own pins are smaller than
   * the dialog's panels, so the smallest containing element was a pin behind the backdrop. Layers
   * are the positioned elements with a z-index that contain the point, tried from the top; the
   * first whose subtree has an eligible element supplies it. A layer with nothing eligible under the
   * point is passed over: that is a translucent backdrop, and a step that points past a dialog at
   * the dimmed filter link behind it means the link.
   *
   * Shapes inside an <svg> are not eligible, only the <svg> itself: a path's rect is its bounding
   * box, and a map blob's box contains points the blob does not cover.
   */
  function pick(app, pt) {
    var ar = app.getBoundingClientRect();
    var k = ar.width / APP_W;
    if (!k) return null;
    var limit = MAX_SHARE * APP_W * APP_H;
    var hits = [], layers = [];
    var all = app.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.namespaceURI === SVG_NS && e.tagName.toLowerCase() !== 'svg') continue;
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var l = (r.left - ar.left) / k, t = (r.top - ar.top) / k;
      var w = r.width / k, h = r.height / k;
      if (pt.x < l || pt.x > l + w || pt.y < t || pt.y > t + h) continue;
      var cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (cs.position !== 'static' && cs.zIndex !== 'auto') layers.push({ e: e, z: +cs.zIndex, n: i });
      if (w >= MIN_SIDE && h >= MIN_SIDE && w * h <= limit) hits.push({ e: e, area: w * h });
    }
    // Highest z-index first; for equal z-index the later one in document order paints on top.
    layers.sort(function (a, b) { return b.z - a.z || b.n - a.n; });
    layers.push({ e: app });
    for (var j = 0; j < layers.length; j++) {
      var best = null, bestArea = Infinity;
      for (var m = 0; m < hits.length; m++) {
        if (hits[m].area < bestArea && layers[j].e.contains(hits[m].e)) { best = hits[m].e; bestArea = hits[m].area; }
      }
      if (best) return best;
    }
    return null;
  }

  /** The picked element's box in app coordinates, measured now. */
  function appBox(app, el) {
    var ar = app.getBoundingClientRect();
    var k = ar.width / APP_W;
    var r = el.getBoundingClientRect();
    if (!k || !r.width || !r.height) return null;
    return { l: (r.left - ar.left) / k, t: (r.top - ar.top) / k, w: r.width / k, h: r.height / k };
  }

  /** The ring's box in the container's coordinates, under the transform the camera is heading to. */
  function ringBox(c, app, box) {
    var frame = frameOf(c, app);
    var wrapper = wrapperOf(frame, app);
    var cr = c.getBoundingClientRect();
    var fr = frame.getBoundingClientRect();
    var l, t, w, h;
    var m = wrapper && TRANSFORM.exec(wrapper.style.transform || '');
    if (m) {
      var s = parseFloat(m[1]), tx = parseFloat(m[2]), ty = parseFloat(m[3]);
      // Where the app sits inside the wrapper, in untransformed pixels. Both rects are under the
      // same transform, so the ratio to the current scale undoes it whatever the camera is doing.
      var wr = wrapper.getBoundingClientRect();
      var ar = app.getBoundingClientRect();
      var k = ar.width / APP_W;
      var ox = (ar.left - wr.left) / k, oy = (ar.top - wr.top) / k;
      var wl = wrapper.offsetParent === frame ? wrapper.offsetLeft : 0;
      var wt = wrapper.offsetParent === frame ? wrapper.offsetTop : 0;
      // transform: scale(s) translate(tx, ty) with origin 0 0 maps p to s * (p + t).
      l = wl + s * (ox + box.l + tx);
      t = wt + s * (oy + box.t + ty);
      w = s * box.w;
      h = s * box.h;
    } else {
      var k2 = app.getBoundingClientRect().width / APP_W;
      var a2 = app.getBoundingClientRect();
      l = a2.left - fr.left + box.l * k2;
      t = a2.top - fr.top + box.t * k2;
      w = box.w * k2;
      h = box.h * k2;
    }
    // In frame coordinates now. Outset, then keep the whole ring inside the visible crop so all
    // four sides show; a control that is not in the crop at all gets no ring rather than a sliver.
    var fw = frame.clientWidth, fh = frame.clientHeight;
    if (l + w <= 0 || t + h <= 0 || l >= fw || t >= fh) return null;
    var L = Math.max(1, l - OUTSET), T = Math.max(1, t - OUTSET);
    var R = Math.min(fw - 1, l + w + OUTSET), B = Math.min(fh - 1, t + h + OUTSET);
    if (R - L < 6 || B - T < 6) return null;
    var dx = fr.left - cr.left - c.clientLeft, dy = fr.top - cr.top - c.clientTop;
    return { l: L + dx, t: T + dy, w: R - L, h: B - T };
  }

  function ringFor(c) {
    var hl = c.__lsaHl;
    if (hl && hl.parentNode === c) return hl;
    hl = document.createElement('div');
    hl.className = 'lsa-hl';
    hl.setAttribute('aria-hidden', 'true');
    hl.setAttribute('data-sa-hl', 'off');
    c.appendChild(hl);
    c.__lsaHl = hl;
    return hl;
  }

  function hide(hl) {
    if (hl.getAttribute('data-sa-hl') !== 'off') hl.setAttribute('data-sa-hl', 'off');
  }

  // 'off' is display: none in src/player.css, so a ring that is being shown takes its position in
  // the same style change and appears in place: nothing transitions out of display: none.
  function place(hl, b) {
    var css = 'left:' + b.l.toFixed(1) + 'px;top:' + b.t.toFixed(1) + 'px;width:'
      + b.w.toFixed(1) + 'px;height:' + b.h.toFixed(1) + 'px';
    if (hl.__lsaCss !== css) { hl.style.cssText = css; hl.__lsaCss = css; }
    if (hl.getAttribute('data-sa-hl') !== 'on') hl.setAttribute('data-sa-hl', 'on');
  }

  function update(c) {
    // An unparsable target is the raw template ("{{ guide.player.step.targetAttr }}"), which the
    // runtime compiles from the document after this script has started. Nothing may be added to
    // it: a node appended there becomes part of the template, and the runtime then renders a copy
    // of it on every step that this file does not own.
    var pt = targetOf(c);
    if (!pt) return;
    var hl = ringFor(c);
    var app = c.querySelector('.sa-app');
    // Not rendered (the phone breakpoint hides the stage and figures) or not ready yet.
    if (!app || !c.offsetParent) { hide(hl); c.__lsaPick = null; return; }
    var key = pt.x + ',' + pt.y + '|' + c.getAttribute('data-sa-step');
    var p = c.__lsaPick;
    if (c.__lsaDirty || !p || p.key !== key || p.app !== app || !p.el || !p.el.isConnected || !app.contains(p.el)) {
      p = c.__lsaPick = { key: key, app: app, el: pick(app, pt) };
    }
    c.__lsaDirty = false;
    var box = p.el && appBox(app, p.el);
    var b = box && ringBox(c, app, box);
    if (!b) { hide(hl); hl.removeAttribute('data-sa-for'); return; }
    hl.setAttribute('data-sa-for', key);
    place(hl, b);
  }

  function run() {
    var cs = containers();
    for (var i = 0; i < cs.length; i++) {
      try { update(cs[i]); } catch (e) { /* one bad container must not take the others down */ }
    }
  }

  // ---- scheduling -------------------------------------------------------------
  // Coalesced with rAF as in src/a11y.js: placing a ring is itself a mutation, and the observer
  // would otherwise re-enter on every write.
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; run(); });
  }

  function dirty(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    var c = el && el.closest && el.closest('[data-sa-target]');
    if (c) c.__lsaDirty = true;
    return c;
  }

  function dirtyAll() {
    var cs = containers();
    for (var i = 0; i < cs.length; i++) cs[i].__lsaDirty = true;
  }

  new MutationObserver(function (records) {
    var relevant = false;
    for (var i = 0; i < records.length; i++) {
      if (own(records[i].target)) continue;
      relevant = true;
      dirty(records[i].target);
    }
    if (relevant) schedule();
  }).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['data-sa-target', 'data-sa-step', 'style'],
  });

  // The camera pan, a dialog sliding in, the cursor arriving: re-measure once things settle.
  function settled(e) {
    if (own(e.target)) return;
    if (dirty(e.target)) schedule();
  }
  document.addEventListener('transitionend', settled, true);
  document.addEventListener('animationend', settled, true);

  window.addEventListener('resize', schedule);
  // A locale switch re-lays out the reproduction's labels; webfonts arriving do the same.
  window.addEventListener('sa:locale-applied', function () { dirtyAll(); schedule(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dirtyAll(); schedule(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
})();
