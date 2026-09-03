// Accessibility enhancements that can't be expressed as template attributes.
// Injected by build.mjs; runs once, uses event delegation so it survives React re-renders.
(function () {
  'use strict';

  // 1. Keyboard activation for role="button" elements.
  //    The export builds its controls from <div onClick>, which the browser gives no
  //    keyboard behaviour. The template now marks them role="button"; this supplies the
  //    Enter/Space activation those roles are required to have.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = e.target;
    if (!el || typeof el.closest !== 'function') return;
    var btn = el.closest('[role="button"]');
    if (!btn) return;
    if (btn.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    // Let real controls handle their own keys.
    if (/^(button|a|input|select|textarea)$/i.test(btn.tagName)) return;

    e.preventDefault();               // stop Space scrolling the page

    // The guide registers its own shortcuts on window — notably Space for play-all, which
    // resets the player to step 0. When focus is on a control, the control must win, or
    // activating "Next step" with Space advances and is immediately reset.
    // This listener is on document, which precedes window in the bubble path, so stopping
    // propagation here suppresses the global shortcut for this keypress only. With focus
    // anywhere else the early return above leaves the global shortcuts working normally.
    e.stopPropagation();

    btn.click();
  });

  // 2. Skip link, so keyboard users can bypass the header and card grid.
  function addSkipLink() {
    var root = document.querySelector('.lsa');
    if (!root || document.querySelector('.lsa-skip')) return;
    var main = document.querySelector('main, [role="main"]') || root;
    if (!main.id) main.id = 'lsa-main';
    var a = document.createElement('a');
    a.className = 'lsa-skip';
    a.href = '#' + main.id;
    a.textContent = 'Skip to main content';
    root.insertBefore(a, root.firstChild);
  }

  // 3. Small-screen explanation, shown by CSS only below the tablet breakpoint.
  //    Placed next to the stage so it appears where the visual walkthrough would be.
  function addSmallScreenNote() {
    var anchors = document.querySelectorAll('.lsa-stage-frame, .lsa-step-figure');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      // The stage sits in a flex row beside the step panel. With the stage hidden the row
      // still lays its remaining children out side by side, which squeezes and clips them,
      // so tag the row for the phone breakpoint to stack it.
      if (a.parentElement) a.parentElement.classList.add('lsa-stage-row');
      if (a.previousElementSibling && a.previousElementSibling.classList.contains('lsa-small-screen-note')) continue;
      var note = document.createElement('div');
      note.className = 'lsa-small-screen-note';
      note.innerHTML =
        '<strong>The interactive walkthrough needs a wider screen.</strong> ' +
        'Spatial Adjust itself is desktop and tablet only, so the screen it shows you is too. ' +
        'The written steps below cover the same ground — open this on a laptop or tablet to follow along visually.';
      a.parentNode.insertBefore(note, a);
    }
  }

  // 4. The guide body sits in a flex row next to the "On this page" sidebar. At phone
  //    widths the sidebar keeps its share and squeezes the article to a few dozen pixels,
  //    which forces horizontal scrolling. Tag the row so the breakpoint can stack it.
  function tagContentRow() {
    var articles = document.querySelectorAll('.lsa article');
    for (var i = 0; i < articles.length; i++) {
      var row = articles[i].parentElement;
      if (row && getComputedStyle(row).display === 'flex') row.classList.add('lsa-content-row');
    }
  }

  // 5. The export registers genuinely useful shortcuts on window — left/right to step,
  //    Space to play all, Escape to close, "/" to jump to search — but nothing tells
  //    anyone they exist. Surface them next to the player controls they operate.
  function addShortcutHint() {
    var live = document.querySelector('.lsa [aria-live]');
    if (!live || !live.parentElement) return;
    var host = live.parentElement;
    if (host.querySelector('.lsa-keys')) return;
    var hint = document.createElement('div');
    hint.className = 'lsa-keys';
    // aria-hidden: the shortcuts are announced to screen-reader users by the controls
    // themselves, and repeating them here would just add noise to every step change.
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML =
      '<kbd>←</kbd><kbd>→</kbd> step &nbsp;·&nbsp; <kbd>space</kbd> play &nbsp;·&nbsp; <kbd>esc</kbd> close';
    host.appendChild(hint);
  }

  // 6. Record search use. The event was defined but never fired, so "did anyone search?"
  //    was unanswerable. Debounced so a query counts once, not once per keystroke.
  var searchTimer = null;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT' || !el.closest('.lsa')) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var v = (el.value || '').trim();
      if (v.length >= 2 && window.__saTrack) window.__saTrack('search_used', { length: v.length });
    }, 800);
  });

  function enhance() { addSkipLink(); addSmallScreenNote(); tagContentRow(); addShortcutHint(); }

  // The runtime renders asynchronously and re-renders on navigation, so re-apply.
  // Coalesced with rAF: these functions insert into the tree they're observing, which
  // would otherwise re-enter the callback synchronously on every insertion.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; enhance(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
