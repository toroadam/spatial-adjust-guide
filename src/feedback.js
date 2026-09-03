// In-product feedback for the Spatial Adjust guides.
//
// The site is static, so there is no server to accept a form post. Feedback is routed to
// a prefilled GitHub issue instead: no backend, no third-party script, and reports land
// in the same repo as the work. The guide and step are attached automatically, so a
// reporter never has to describe where they were.
//
// All handling is delegated from document rather than bound per element: the runtime
// re-renders on every state change, which detaches any node-level listener.
(function () {
  'use strict';

  var REPO = 'toroadam/spatial-adjust-guide';
  function track() { if (window.__saTrack) window.__saTrack.apply(null, arguments); }

  function issueUrl(title, body, labels) {
    return 'https://github.com/' + REPO + '/issues/new'
      + '?title=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(body)
      + '&labels=' + encodeURIComponent(labels);
  }

  // The live region already holds "Step 2 of 5: Read the map" — the most reliable
  // description of where the reader is, kept current by the player.
  function context() {
    var live = document.querySelector('.lsa [aria-live]');
    var h1 = document.querySelector('.lsa h1');
    return {
      guide: h1 ? (h1.textContent || '').trim() : '(catalog)',
      step: live ? (live.textContent || '').trim() : '',
      url: location.href,
      viewport: window.innerWidth + 'x' + window.innerHeight,
    };
  }

  // ---- delegated handling -----------------------------------------------------
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || typeof t.closest !== 'function') return;

    var fb = t.closest('.lsa-helpful-btn');
    if (fb) { ev.preventDefault(); onHelpful(fb); return; }

    var stub = t.closest('.lsa [data-stub="true"]');
    if (stub) { ev.preventDefault(); ev.stopPropagation(); onStubRequest(stub); }
  }, true);

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var t = ev.target;
    if (!t || typeof t.closest !== 'function') return;
    var stub = t.closest('.lsa [data-stub="true"]');
    if (stub) { ev.preventDefault(); ev.stopPropagation(); onStubRequest(stub); }
  }, true);

  function onHelpful(btn) {
    var verdict = btn.getAttribute('data-v');
    var c = context();
    track('feedback_submitted', { verdict: verdict, guide: c.guide, step: c.step });

    var wrap = btn.closest('.lsa-helpful');
    if (verdict === 'yes') {
      if (wrap) { wrap.setAttribute('data-done', '1'); wrap.textContent = 'Thanks — noted.'; }
      return;
    }
    // "No" is the useful case, so collect the detail rather than swallow it.
    var note = window.prompt(
      'What was missing or unclear?\n\nThis opens a prefilled GitHub issue you can review before submitting.', '');
    if (note === null) return;
    var body =
      '**What was missing or unclear**\n' + (note || '(not stated)') + '\n\n' +
      '---\n- Guide: ' + c.guide + '\n- Step reached: ' + (c.step || 'n/a') +
      '\n- Viewport: ' + c.viewport + '\n- URL: ' + c.url + '\n';
    window.open(issueUrl('Guide feedback: ' + c.guide, body, 'guide-feedback'), '_blank', 'noopener');
    if (wrap) { wrap.setAttribute('data-done', '1'); wrap.textContent = 'Thanks — opening a report.'; }
  }

  // Activating an unwritten guide records demand and offers to file the request.
  // Stub clicks are the cheapest, least fakeable signal for what to write next.
  function onStubRequest(card) {
    var title = (card.getAttribute('data-title') || '').trim().slice(0, 80);
    track('stub_clicked', { title: title });

    var note = window.prompt(
      '"' + title + '" has not been written yet.\n\n' +
      'What did you need it to tell you? (optional — this helps decide what gets written next)', '');
    track('guide_requested', { title: title, hasNote: !!note });
    if (note === null) return;
    var c = context();
    var body =
      '**Requested guide:** ' + title + '\n\n' +
      '**What they needed it to answer**\n' + (note || '(not stated)') + '\n\n' +
      '---\n- Viewport: ' + c.viewport + '\n- URL: ' + c.url + '\n';
    window.open(issueUrl('Guide request: ' + title, body, 'guide-request'), '_blank', 'noopener');
  }

  // ---- widget injection -------------------------------------------------------
  // Placed at the very bottom of the page content, not beside the player. It used to sit
  // in the player panel, which crowded the controls and — because the "On this page"
  // sidebar is sticky at an offset calibrated to that panel's height — pushed the section
  // tracker out of alignment.
  function buildHelpful() {
    var host = document.querySelector('.lsa article') || document.querySelector('.lsa main');
    if (!host || host.querySelector('.lsa-helpful')) return;
    var wrap = document.createElement('div');
    wrap.className = 'lsa-helpful';
    wrap.innerHTML =
      '<span class="lsa-helpful-q">Was this helpful?</span>' +
      '<button type="button" class="lsa-helpful-btn" data-v="yes" aria-label="Yes, this was helpful">' +
        '<span aria-hidden="true">&#128077;</span></button>' +
      '<button type="button" class="lsa-helpful-btn" data-v="no" aria-label="No, this was not helpful">' +
        '<span aria-hidden="true">&#128078;</span></button>';
    host.appendChild(wrap);
  }

  // Coalesce observer callbacks: the runtime mutates the tree constantly, and injecting
  // into it would otherwise re-trigger this synchronously on every insertion.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; buildHelpful(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
