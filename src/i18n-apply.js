// Applies a translation catalogue to the rendered page.
//
// The guides are a Core Design export: the content lives inside the export's own component
// scope, the runtime re-renders the tree on every state change, and neither can be reached
// from here. So translation is applied to the DOM rather than to the data — keyed on the exact
// English string, which is why scripts/extract-strings.mjs harvests its keys from the rendered
// page instead of from the source.
//
// Two things make that survivable rather than fragile:
//
//   1. Every node this touches keeps its English original on the node itself (__saEn). Lookups
//      prefer that over the current text, so switching locale twice doesn't compound, and a
//      node the runtime re-created — carrying English again — still matches. Switching from
//      German to Japanese needs no German-to-English reverse map, because the English never
//      actually went anywhere. A node the runtime REUSED, writing new English into it, is
//      recognised because it holds neither the recorded English nor the translation written
//      over it (see stale() below), and its new text becomes the original.
//   2. Re-application is driven by the same coalesced MutationObserver pattern src/feedback.js
//      and src/i18n-selector.js use, so a re-render is self-healing: the runtime paints
//      English, the observer fires, the text is translated again within a frame.
//
// .sa-app is deliberately skipped. That component is a faithful reproduction of the real
// IntelliDash screen, and the product renders its own translations there — see
// README > Localisation status.
(function () {
  'use strict';

  // .sa-app — the reproduced IntelliDash screen — is deliberately INCLUDED. It used to be skipped
  // on the reasoning that the component is a faithful reproduction of the product. But the real
  // IntelliDash is localised, so an English screen inside German prose is the inaccurate version,
  // and it left every guide naming controls ("open Settings") that the screenshot beside it then
  // labelled differently. Roughly half those labels are taken verbatim from IntelliDash's own
  // shipped catalogues by scripts/app-strings.mjs, so the reproduction shows the words the product
  // actually shows. Colours inside .sa-app are still left alone — see README > Deliberately not fixed.
  // [data-sa-src] marks a step-shape line (Do, You should see, If not, Why, the start rows). Those
  // are translated whole at render time through window.__saT below, because a sentence with a bold
  // label in it is several text nodes and translating them one by one cannot reorder the words.
  // Walking into one here would translate it a second time, fragment by fragment.
  var SKIP = 'script, style, noscript, [data-sa-src]';
  var ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];

  var catalogues = {};       // locale -> { string: translation }
  var pending = {};          // locale -> true while in flight
  var active = null;         // locale currently applied

  function track() { if (window.__saTrack) window.__saTrack.apply(null, arguments); }

  // Tells the guide component a different catalogue is now active, so it re-renders and the
  // step-shape lines it translates through __saT follow. Fired on every change of the applied
  // locale, including back to en-us, and never on a mere re-application of the same one, so the
  // re-render it causes cannot loop back into another event.
  function notify() {
    try {
      window.dispatchEvent(new CustomEvent('sa:locale-applied', { detail: { locale: active || 'en-us' } }));
    } catch (e) { /* a reader without CustomEvent keeps English shape lines, as before load */ }
  }

  // ---- loading ----------------------------------------------------------------
  // Catalogues are separate files rather than inlined: ten of them is roughly half a megabyte,
  // which every reader would pay for on first paint to use one. The cost is that fetch() is
  // unavailable under file://, where the page falls back to English — acceptable, because
  // file:// is the offline-inspection path, not how anyone reads these.
  function load(locale, done) {
    if (catalogues[locale]) return done(catalogues[locale]);
    if (pending[locale]) return;
    pending[locale] = true;
    fetch('i18n/' + locale + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        pending[locale] = false;
        if (!data || !data.strings) { track('locale_catalogue_missing', { locale: locale }); return; }
        catalogues[locale] = data.strings;
        done(data.strings);
      })
      .catch(function () {
        pending[locale] = false;
        // A missing catalogue leaves English on screen, which is the honest failure mode.
        track('locale_catalogue_failed', { locale: locale });
      });
  }

  // ---- application ------------------------------------------------------------
  // The runtime REUSES nodes as well as re-creating them. Stepping the player keeps the panel's
  // counter, title and body text nodes and rewrites their text in place, and the play control's
  // aria-label goes from "Play all steps" to "Pause" the same way. A recorded original is only
  // still the source while the node holds that original or the translation written over it
  // (__saTr); anything else is new English from the runtime, and the stale original has to go.
  // Without this, every locale but English froze the panel on step 1: the new title was
  // "translated" from the old one's recorded English straight back to the old title.
  function stale(current, en, tr) {
    return en !== undefined && current !== en && current !== tr;
  }

  function translateNode(node, map) {
    var raw = node.nodeValue || '';
    var current = raw.trim();
    if (stale(current, node.__saEn, node.__saTr)) node.__saEn = node.__saTr = undefined;
    var original = node.__saEn;
    if (original === undefined) {
      original = current;
      if (!original) return;
    }
    var hit = map[original];
    if (hit === undefined) return;

    // Preserve the node's own leading/trailing whitespace: the runtime relies on it for
    // spacing between inline elements, and collapsing it here shifts the layout.
    var lead = raw.match(/^\s*/)[0];
    var tail = raw.match(/\s*$/)[0];
    var next = lead + hit + tail;
    if (raw === next) return;

    node.__saEn = original;
    node.__saTr = hit;
    node.nodeValue = next;
  }

  function translateAttrs(el, map) {
    var store = el.__saEnAttrs;
    var written = el.__saTrAttrs;
    for (var i = 0; i < ATTRS.length; i++) {
      var name = ATTRS[i];
      if (!el.hasAttribute(name)) continue;
      var current = el.getAttribute(name).trim();
      if (store && stale(current, store[name], written && written[name])) {
        store[name] = undefined;
        if (written) written[name] = undefined;
      }
      var original = store && store[name] !== undefined ? store[name] : current;
      var hit = map[original];
      if (hit === undefined || hit === el.getAttribute(name)) continue;
      if (!store) store = el.__saEnAttrs = {};
      if (!written) written = el.__saTrAttrs = {};
      store[name] = original;
      written[name] = hit;
      el.setAttribute(name, hit);
    }
  }

  function apply(map) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) continue;
      translateNode(node, map);
    }
    var els = document.querySelectorAll('[aria-label], [placeholder], [title], img[alt]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].closest(SKIP)) continue;
      translateAttrs(els[i], map);
    }
  }

  // Restore English from what each node recorded. Used when returning to en-us, where there
  // is no catalogue to apply — the originals are the translation.
  function revert() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.__saEn === undefined) continue;
      var raw = node.nodeValue || '';
      // Rewritten by the runtime since it was translated: it already holds current English.
      if (stale(raw.trim(), node.__saEn, node.__saTr)) { node.__saEn = node.__saTr = undefined; continue; }
      node.nodeValue = raw.match(/^\s*/)[0] + node.__saEn + raw.match(/\s*$/)[0];
    }
    var els = document.querySelectorAll('[aria-label], [placeholder], [title], img[alt]');
    for (var i = 0; i < els.length; i++) {
      var store = els[i].__saEnAttrs;
      if (!store) continue;
      var written = els[i].__saTrAttrs || {};
      for (var name in store) {
        if (store[name] === undefined) continue;
        var current = (els[i].getAttribute(name) || '').trim();
        if (stale(current, store[name], written[name])) { store[name] = written[name] = undefined; continue; }
        els[i].setAttribute(name, store[name]);
      }
    }
  }

  // ---- scheduling -------------------------------------------------------------
  // Coalesced exactly as src/i18n-selector.js does: the runtime mutates the tree constantly,
  // and writing to it from an observer would otherwise re-enter this synchronously on every
  // write. The observer is also what makes re-renders self-healing.
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      run();
    });
  }

  function run() {
    var loc = window.__saLocale;
    var locale = loc ? loc.get() : 'en-us';

    if (locale === 'en-us') {
      if (active !== null) { revert(); active = null; notify(); }
      return;
    }
    load(locale, function (map) {
      if (active !== null && active !== locale) revert();
      apply(map);
      if (active !== locale) {
        active = locale;
        track('locale_applied', { locale: locale, strings: Object.keys(map).length });
        notify();
      }
    });
  }

  if (window.__saLocale && window.__saLocale.onChange) {
    window.__saLocale.onChange(function () { schedule(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // Render-time translation for the step-shape lines (saLine() in the guide component, added by
  // src/transform-export.mjs). Answers from the catalogue that is actually applied, not the one
  // being fetched, so a line and the DOM around it always agree; before any catalogue lands, and
  // for en-us, it returns the English it was given.
  window.__saT = function (en) {
    var map = active && catalogues[active];
    var hit = map && map[en];
    return typeof hit === 'string' && hit ? hit : en;
  };

  // Exposed for scripts/i18n.mjs, which needs to know when a locale has actually landed
  // rather than guessing from a timeout.
  window.__saI18nApply = {
    activeLocale: function () { return active; },
    // For controls this file injects rather than translates in place — src/contact.js builds its
    // own labels, so it needs to ask for a string rather than wait to be walked. Falls back to the
    // English it was given, which is the same failure mode as a missing catalogue entry.
    translate: function (s) {
      var loc = window.__saLocale && window.__saLocale.get();
      var map = loc && catalogues[loc];
      return (map && map[s]) || s;
    },
    loaded: function (locale) { return !!catalogues[locale]; },
    apply: function () { schedule(); },
  };
})();
