// Boot splash: shown from the first paint, removed when the runtime has actually rendered.
//
// The markup is written into <body> by build.mjs rather than created here, for the same reason the
// gate resolves its flag in <head>: this file runs at the end of <body>, by which point the blank
// page has already been on screen. Creating the splash here would mean showing it *after* the wait
// it exists to cover.
//
// This file only decides when to take it away.
(function () {
  'use strict';

  var EL = '.lsa-splash';
  // Ceiling on how long the splash may stay. If the runtime fails outright, a reader must end up
  // looking at whatever did render — or at nothing — rather than at a permanent loading screen
  // that implies something is still coming.
  var HARD_LIMIT = 9000;
  // Minimum time on screen. Everything the runtime needs is inlined by build.mjs — no CDN, no
  // fetch — so on a warm load it paints in about 30ms and the splash flashed past faster than the
  // eye resolves, which reads as a glitch rather than a load. Holding it briefly makes it a
  // deliberate splash and gives the skeleton cards time to be seen.
  //
  // This is real added latency on fast connections. 650ms is the shortest hold that still reads as
  // intentional; anything under ~400ms looks like a flicker and anything over ~1s is just a tax.
  var MIN_VISIBLE = 650;
  // The runtime mounts an empty #dc-root before it paints content, so "root exists" is not
  // "content is ready". This is roughly one card's worth of markup.
  var READY_CHARS = 4000;

  var done = false;

  function contentReady() {
    var root = document.querySelector('#dc-root');
    if (root && root.innerHTML.length > READY_CHARS) return true;
    // The gate covers the page itself, so when it is up there is nothing left to wait for.
    return !!document.querySelector('.lsa-gate');
  }

  function remove() {
    if (done) return;
    done = true;
    var el = document.querySelector(EL);
    if (!el) return;
    el.className += ' is-going';
    // Matches the CSS transition; the node is removed rather than left hidden so it cannot be
    // reached by a screen reader or by Tab.
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    if (window.__saTrack) window.__saTrack('splash_dismissed', { ms: Date.now() - start });
  }

  var start = Date.now();
  if (!document.querySelector(EL)) return;

  // aria-busy on the document while the splash is up, so assistive tech announces the wait rather
  // than a page that appears to be empty.
  document.documentElement.setAttribute('aria-busy', 'true');
  function finish() {
    document.documentElement.removeAttribute('aria-busy');
    remove();
  }

  function finishWhenDue() {
    var waited = Date.now() - start;
    if (waited >= MIN_VISIBLE) finish();
    else setTimeout(finish, MIN_VISIBLE - waited);
  }

  var poll = setInterval(function () {
    if (contentReady()) { clearInterval(poll); finishWhenDue(); }
  }, 120);

  setTimeout(function () { clearInterval(poll); finish(); }, HARD_LIMIT);

  // Belt and braces: if the runtime paints between polls, the observer catches it sooner.
  var obs = new MutationObserver(function () {
    if (contentReady()) { obs.disconnect(); clearInterval(poll); finishWhenDue(); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
