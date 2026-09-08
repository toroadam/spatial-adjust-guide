// Gate flag, resolved synchronously in <head> before anything paints.
//
// This is deliberately a separate file from src/gate.js, which is injected at the end of
// <body> along with the other runtime modules. By the time those run the page has already
// painted, so a gate built there alone would flash the full guide catalogue and then cover
// it — showing the reader exactly the content they have not been let in to yet.
//
// So the decision is made here, in <head>, and recorded on <html> as a data attribute that
// src/gate.css keys off. The first paint is already gated.
(function () {
  'use strict';

  var STORAGE_KEY = 'sa-guides-gate';

  // Bypassed on localhost and file://.
  //
  // Eleven Playwright scripts in scripts/ drive the built page and assert against rendered
  // text, and innerText returns nothing for a visibility:hidden subtree — so a gate that is
  // live locally turns the whole verification suite red. The alternative was seeding the
  // unlock into all eleven contexts, which puts the same bypass in eleven places instead of
  // one and quietly rots as scripts get added.
  //
  // Nothing is given away by this: reaching localhost means already having the files. Pass
  // ?gate=1 to drop the bypass locally — that is how scripts/gate.mjs verifies the gate.
  function isLocal() {
    if (location.protocol === 'file:') return true;
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  }

  function forced() {
    try { return new URLSearchParams(location.search).get('gate') === '1'; } catch (e) { return false; }
  }

  function unlocked() {
    // ?gate=1 doesn't force the prompt up, it drops the localhost bypass — so a local run
    // behaves exactly like the deployed site, storage and all. Forcing the prompt instead
    // would make "does the unlock persist across a reload?" untestable, which is the one
    // behaviour most likely to break without anyone noticing.
    if (!forced() && isLocal()) return true;
    // Private mode throws on access rather than returning null. Failing closed here would
    // lock out a reader whose browser simply refuses storage, for a gate that is a courtesy
    // barrier in the first place — so a storage failure leaves them at the prompt, which is
    // recoverable, rather than in a loop they cannot clear.
    try { return localStorage.getItem(STORAGE_KEY) === 'open'; } catch (e) { return false; }
  }

  document.documentElement.setAttribute('data-sa-gate', unlocked() ? 'open' : 'locked');
})();
