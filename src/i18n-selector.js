// Language selector for the Spatial Adjust guides.
//
// Mounted beside the brand control in the top-left of the header. The Core Design runtime
// re-renders on every state change and detaches node-level listeners, so — exactly as
// src/feedback.js and src/a11y.js do — every handler here is delegated from document and the
// control is re-mounted from a coalesced MutationObserver.
//
// The mount point is found by the brand control's aria-label rather than by a class hook.
// That label is guaranteed by the 'brand control semantics' transform in
// src/transform-export.mjs, which asserts its anchor and fails the build if the export
// changes shape. Anchoring here avoids adding a second transform for the same element.
//
// Accessibility notes that are easy to get wrong and are deliberate:
//   - The trigger is a real <button>, so Enter and Space activation come from the platform
//     rather than from hand-rolled key handling.
//   - The accessible name always contains the language in text ("Language: Deutsch"). A flag
//     denotes a country, not a language — Spanish is not Spain, English is not the USA — so a
//     flag can never be the accessible name. Flags are decorative and aria-hidden.
//   - Options use roving tabindex inside a listbox rather than being tab stops of their own.
(function () {
  'use strict';

  var ROOT_CLASS = 'lsa-lang';
  var BRAND_SEL = '.lsa [aria-label^="Spatial Adjust Guides"]';

  function track() { if (window.__saTrack) window.__saTrack.apply(null, arguments); }
  function api() { return window.__saLocale; }

  // ---- markup -----------------------------------------------------------------
  function build() {
    var loc = api();
    if (!loc) return;                                     // i18n.js failed to load
    var brand = document.querySelector(BRAND_SEL);
    if (!brand || !brand.parentNode) return;
    if (brand.parentNode.querySelector('.' + ROOT_CLASS)) return;   // already mounted

    // Tag the header row and the brand so a11y.css can reach them at phone widths. The
    // export styles both inline with desktop values (padding 0 32px, gap 24px) and gives
    // the brand no min-width, so its content overflows its own flex box on a narrow screen
    // — 169px of content in a 118px box, with "Guide" spilling ~50px to the right. That was
    // invisible while nothing occupied the spill zone; adding a control here made it a
    // collision. Tagging in JS rather than with :has() keeps this off a modern-CSS
    // dependency, and rather than in transform-export.mjs because these are runtime
    // layout concerns, not export-shape ones.
    brand.parentNode.classList.add('lsa-hdr');
    brand.classList.add('lsa-brand');

    var current = loc.meta();
    var wrap = document.createElement('div');
    wrap.className = ROOT_CLASS;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lsa-lang-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.appendChild(flagSpan(current.flag));
    var name = document.createElement('span');
    name.className = 'lsa-lang-name';
    name.textContent = current.nativeName;
    btn.appendChild(name);
    btn.appendChild(caret());

    var menu = document.createElement('ul');
    menu.className = 'lsa-lang-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    loc.locales.forEach(function (l) {
      var li = document.createElement('li');
      li.className = 'lsa-lang-opt';
      li.setAttribute('role', 'option');
      li.setAttribute('data-code', l.code);
      li.setAttribute('tabindex', '-1');
      li.setAttribute('aria-selected', l.code === current.code ? 'true' : 'false');
      li.appendChild(flagSpan(l.flag));
      var t = document.createElement('span');
      t.textContent = l.nativeName;
      li.appendChild(t);
      menu.appendChild(li);
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    // After the brand, so the reading and tab order is: home, then language.
    brand.parentNode.insertBefore(wrap, brand.nextSibling);
    syncLabels();
  }

  function flagSpan(glyph) {
    var s = document.createElement('span');
    s.className = 'lsa-lang-flag';
    s.setAttribute('aria-hidden', 'true');     // decorative: a flag is a country, not a language
    s.textContent = glyph;
    return s;
  }

  function caret() {
    var s = document.createElement('span');
    s.className = 'lsa-lang-caret';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = '▾';
    return s;
  }

  // Keeps the visible name, the accessible name and aria-selected in step with the
  // resolved locale. Called on mount and on every change.
  function syncLabels() {
    var loc = api();
    if (!loc) return;
    var cur = loc.meta();
    document.querySelectorAll('.' + ROOT_CLASS).forEach(function (wrap) {
      var btn = wrap.querySelector('.lsa-lang-btn');
      var name = wrap.querySelector('.lsa-lang-name');
      if (name) name.textContent = cur.nativeName;
      // The language is in the name as text, never carried by the flag alone.
      if (btn) btn.setAttribute('aria-label', 'Language: ' + cur.nativeName);
      wrap.querySelectorAll('.lsa-lang-opt').forEach(function (o) {
        o.setAttribute('aria-selected', o.getAttribute('data-code') === cur.code ? 'true' : 'false');
      });
    });
  }

  // ---- open / close -----------------------------------------------------------
  function isOpen(wrap) {
    var btn = wrap.querySelector('.lsa-lang-btn');
    return !!btn && btn.getAttribute('aria-expanded') === 'true';
  }

  function open(wrap) {
    var btn = wrap.querySelector('.lsa-lang-btn');
    var menu = wrap.querySelector('.lsa-lang-menu');
    if (!btn || !menu) return;
    closeAll();
    btn.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    var sel = menu.querySelector('[aria-selected="true"]') || menu.querySelector('.lsa-lang-opt');
    if (sel) sel.focus();
  }

  function close(wrap, returnFocus) {
    var btn = wrap.querySelector('.lsa-lang-btn');
    var menu = wrap.querySelector('.lsa-lang-menu');
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    if (returnFocus && btn.focus) btn.focus();
  }

  function closeAll(returnFocus) {
    document.querySelectorAll('.' + ROOT_CLASS).forEach(function (w) {
      if (isOpen(w)) close(w, returnFocus);
    });
  }

  function choose(opt) {
    var loc = api();
    var wrap = opt.closest('.' + ROOT_CLASS);
    var code = opt.getAttribute('data-code');
    if (!loc || !wrap || !code) return;
    var prev = loc.get();
    // An explicit choice persists — this is the only path that writes to storage.
    loc.set(code);
    track('locale_changed', { from: prev, to: code });
    syncLabels();
    close(wrap, true);
  }

  // ---- delegated handling -----------------------------------------------------
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || typeof t.closest !== 'function') return;

    var btn = t.closest('.lsa-lang-btn');
    if (btn) {
      ev.preventDefault();
      var wrap = btn.closest('.' + ROOT_CLASS);
      if (wrap) { isOpen(wrap) ? close(wrap, true) : open(wrap); }
      return;
    }

    var opt = t.closest('.lsa-lang-opt');
    if (opt) { ev.preventDefault(); choose(opt); return; }

    // A click anywhere else dismisses an open menu.
    if (!t.closest('.' + ROOT_CLASS)) closeAll();
  }, true);

  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (!t || typeof t.closest !== 'function') return;
    var wrap = t.closest('.' + ROOT_CLASS);

    // Escape closes from anywhere within the control and returns focus to the trigger.
    if (ev.key === 'Escape') {
      if (wrap && isOpen(wrap)) { ev.preventDefault(); close(wrap, true); }
      return;
    }
    if (!wrap) return;

    var opt = t.closest('.lsa-lang-opt');

    // ArrowDown on a closed trigger opens it — the expected listbox affordance.
    if (!opt && t.closest('.lsa-lang-btn') && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      open(wrap);
      return;
    }
    if (!opt) return;

    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(opt); return; }

    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Home' || ev.key === 'End') {
      ev.preventDefault();
      var opts = Array.prototype.slice.call(wrap.querySelectorAll('.lsa-lang-opt'));
      var i = opts.indexOf(opt);
      var next = ev.key === 'Home' ? 0
        : ev.key === 'End' ? opts.length - 1
        : ev.key === 'ArrowDown' ? i + 1
        : i - 1;
      // Wrap around: a listbox that dead-ends at either end feels broken under keyboard.
      if (next < 0) next = opts.length - 1;
      if (next >= opts.length) next = 0;
      if (opts[next]) opts[next].focus();
    }
  }, true);

  // ---- mount ------------------------------------------------------------------
  // Coalesced exactly as src/feedback.js does: the runtime mutates the tree constantly, and
  // inserting into it would otherwise re-enter this synchronously on every insertion.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; build(); });
  }

  if (window.__saLocale && window.__saLocale.onChange) window.__saLocale.onChange(syncLabels);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
