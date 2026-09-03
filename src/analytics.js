// Event instrumentation for the Spatial Adjust guides.
//
// The site is static and public with no backend, so there is nowhere to POST to by
// default. Rather than pull in a third-party analytics script — which would undo the
// zero-external-origins property the build enforces — this ships a pluggable transport:
//
//   'local'  (default) buffer in localStorage. Nothing leaves the device. Enough for
//            moderated sessions: run `__saReport()` in the console, or use the export
//            button, to read what the participant actually did.
//   'beacon' POST batches to SA_ENDPOINT via sendBeacon. Set the endpoint and the smoke
//            test's origin allowlist together — see README > Instrumentation.
//
// Deliberately collects no PII: no IP handling of our own, no cookies, an anonymous
// per-session id that dies with the tab, and no free-text except what a user types into
// the feedback box.
(function () {
  'use strict';

  var TRANSPORT = 'local';       // 'local' | 'beacon'
  var SA_ENDPOINT = '';          // required when TRANSPORT === 'beacon'
  var KEY = 'sa_events_v1';
  var MAX = 500;                 // ring buffer cap

  function sessionId() {
    try {
      var k = 'sa_sid';
      var v = sessionStorage.getItem(k);
      if (!v) {
        // Not crypto-grade; only needs to group one tab's events together.
        v = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return 'nostorage'; }
  }

  function deviceClass() {
    var w = window.innerWidth;
    return w < 768 ? 'phone' : w < 1024 ? 'tablet' : 'desktop';
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch (e) { /* full or blocked */ }
  }

  var queue = [];
  function flush() {
    if (!queue.length || TRANSPORT !== 'beacon' || !SA_ENDPOINT) return;
    var batch = queue.splice(0, queue.length);
    try {
      navigator.sendBeacon(SA_ENDPOINT, new Blob([JSON.stringify(batch)], { type: 'application/json' }));
    } catch (e) {
      queue = batch.concat(queue);   // keep for the next attempt
    }
  }

  // The defined event set. Keeping it closed makes the data analysable and stops
  // incidental events accumulating meaninglessly.
  var EVENTS = [
    'guide_opened',
    'step_advanced',
    'guide_completed',
    'play_all_used',
    'stub_clicked',          // the demand signal for the 17 unwritten guides
    'guide_requested',
    'search_used',
    'feedback_submitted',
    'returned_home',
  ];

  function track(name, props) {
    if (EVENTS.indexOf(name) === -1) {
      if (window.console) console.warn('[sa] unknown event:', name);
      return;
    }
    var e = {
      t: new Date().toISOString(),
      name: name,
      sid: sessionId(),
      device: deviceClass(),
      w: window.innerWidth,
      props: props || {},
    };
    var list = read(); list.push(e); write(list);
    queue.push(e);
    if (TRANSPORT === 'beacon') flush();
  }

  window.addEventListener('pagehide', flush);
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  // Called from the guide logic; a no-op if this file ever fails to load.
  window.__saTrack = track;

  // --- reporting, for moderated sessions ---------------------------------------
  window.__saReport = function () {
    var list = read();
    var byName = {}, guides = {}, stubs = {};
    list.forEach(function (e) {
      byName[e.name] = (byName[e.name] || 0) + 1;
      if (e.name === 'guide_opened' && e.props.key) guides[e.props.key] = (guides[e.props.key] || 0) + 1;
      if (e.name === 'stub_clicked' && e.props.title) stubs[e.props.title] = (stubs[e.props.title] || 0) + 1;
    });
    var sorted = function (o) {
      return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return k + ': ' + o[k]; });
    };
    var out = {
      events: list.length,
      sessions: list.reduce(function (s, e) { return s.indexOf(e.sid) === -1 ? s.concat(e.sid) : s; }, []).length,
      byEvent: byName,
      guidesOpened: sorted(guides),
      stubDemand: sorted(stubs),
      raw: list,
    };
    if (window.console) console.log(JSON.stringify(out, null, 2));
    return out;
  };

  window.__saExport = function () {
    var blob = new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spatial-adjust-events.json';
    a.click();
  };

  window.__saClear = function () { write([]); };
})();
