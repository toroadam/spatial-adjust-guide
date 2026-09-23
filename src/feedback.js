// In-product feedback for the Spatial Adjust guides.
//
// A floating Feedback button, bottom right, on every page, opens a panel with a MICROSOFT FORM
// embedded in it. The reader types and submits inside the panel and never leaves the site; the
// page, step, locale and URL are prefilled into the form so they never have to describe where
// they were. Responses land in an Excel workbook in the form owner's OneDrive, inside Toro's own
// tenant.
//
// Why a form, and why embedded:
//   - The site is static, so there is no server of its own to accept a post.
//   - Filing GitHub issues directly would need a token in the page, and the repository is public:
//     anyone could read it and write to the repo. A relay to hold the token would be a server,
//     and the hosts for one (Cloudflare, Azure) were ruled out — see README > Sign-in gate.
//   - A prefilled GitHub issue opened in a new tab was the previous destination. It sent readers
//     to GitHub, needed an account, and made every comment public. Replaced on 2026-09-23.
//   - Google Sheets and Cloudflare Functions sit outside the tooling Toro permits.
//
// Configure it in one place: FORM below. While FORM.id is empty the button is not shown at all —
// a button that opens nothing is worse than no button.
//
// All handling is delegated from document rather than bound per element: the runtime re-renders
// on every state change, which detaches any node-level listener.
(function () {
  'use strict';

  // ---- destination -------------------------------------------------------------
  // FORM.id is the GUID after `id=` in the form's share link. FORM.fields maps each prefilled
  // question to its parameter id, which is the number in `r<number>` — README > Feedback has the
  // click-by-click for reading both off the form itself. The comment question itself is not
  // prefilled: the reader answers it.
  //
  // window.__saFeedbackForm overrides this so scripts/instrumentation.mjs can drive the panel
  // against a stubbed form without a real one being configured.
  var FORM = window.__saFeedbackForm || {
    id: '',
    fields: {
      kind: '',       // "Feedback" or "Guide request" — lets one form serve both flows
      guide: '',      // the page: the guide's title, or the catalogue's
      step: '',       // "Step 2 of 5: Read the map", or empty off a guide
      locale: '',
      url: '',
    },
  };

  var DLG = 'lsa-fb-dlg';
  var FAB = 'lsa-fb-fab';

  function t(s) {
    var api = window.__saI18nApply;
    return (api && api.translate && api.translate(s)) || s;
  }
  function track() { if (window.__saTrack) window.__saTrack.apply(null, arguments); }

  // ---- context -----------------------------------------------------------------
  // The live region already holds "Step 2 of 5: Read the map" — the most reliable description of
  // where the reader is, kept current by the player.
  function context() {
    var live = document.querySelector('.lsa [aria-live]');
    var h1 = document.querySelector('.lsa h1');
    return {
      guide: h1 ? (h1.textContent || '').trim() : '(catalog)',
      step: live ? (live.textContent || '').trim() : '',
      url: location.href,
      locale: (window.__saLocale && window.__saLocale.get && window.__saLocale.get()) || 'en-us',
    };
  }

  // ---- Microsoft Forms URL -----------------------------------------------------
  // Only fields with a configured parameter id are appended, so a partially filled FORM.fields
  // degrades to a shorter prefill rather than a broken URL.
  function formUrl(payload, embed) {
    var url = 'https://forms.office.com/Pages/ResponsePage.aspx?id=' + encodeURIComponent(FORM.id);
    for (var key in FORM.fields) {
      if (!Object.prototype.hasOwnProperty.call(FORM.fields, key)) continue;
      var param = FORM.fields[key];
      var value = payload[key];
      if (!param || value === undefined || value === null || value === '') continue;
      url += '&r' + encodeURIComponent(param) + '=' + encodeURIComponent(String(value));
    }
    return embed ? url + '&embed=true' : url;
  }

  // ---- panel -------------------------------------------------------------------
  // It replaced a "Was this helpful?" row at the foot of each guide: that row sat below the "Next"
  // cards where few readers scroll, its thumbs-up collected nothing but a click, and the catalogue
  // had no way to comment at all.
  //
  // The panel is NON-modal on purpose. A reader commenting on a step wants that step in view while
  // they type, so the page stays scrollable behind it and there is no focus trap. The context is
  // captured when it opens and shown back to the reader, so they can see what will be attached.
  var lastTrigger = null;

  function panelEl() { return document.querySelector('.' + DLG); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function syncFab() {
    var fab = document.querySelector('.' + FAB);
    if (fab) fab.setAttribute('aria-expanded', panelEl() ? 'true' : 'false');
  }

  function closePanel() {
    var wrap = panelEl();
    if (!wrap) return;
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    syncFab();
    // Focus goes back where it came from, or the reader is dumped at the top of the document.
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  }

  // kind: 'Feedback' | 'Guide request'. subject is the page or the requested title — rendered as
  // its own element rather than interpolated into a sentence, so the catalogue stays free of
  // format placeholders that a translator has to reassemble correctly.
  function openPanel(opts) {
    var existing = panelEl();
    if (existing) { var b = existing.querySelector('button'); if (b) b.focus(); return; }
    lastTrigger = opts.trigger || null;
    var isRequest = opts.kind === 'Guide request';
    var c = context();
    var payload = { kind: opts.kind, guide: opts.subject, step: opts.step || '', locale: c.locale, url: c.url };

    var wrap = el('div', DLG);
    wrap.id = DLG;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-labelledby', 'lsa-fb-title');

    var head = el('div', 'lsa-fb-head');
    var h = el('h2', 'lsa-fb-title', t(isRequest ? 'This guide has not been written yet' : 'Send feedback'));
    h.id = 'lsa-fb-title';
    var close = el('button', 'lsa-fb-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Close'));
    head.appendChild(h); head.appendChild(close);
    wrap.appendChild(head);

    if (opts.subject) wrap.appendChild(el('p', 'lsa-fb-subject', opts.subject));
    if (opts.step) wrap.appendChild(el('p', 'lsa-fb-step', opts.step));

    // The form renders its own questions, validation and thank-you page inside the frame, so
    // nothing here claims a comment was sent: the confirmation the reader sees is the form's own.
    var frame = el('iframe', 'lsa-fb-frame');
    frame.src = formUrl(payload, true);
    frame.title = t('Feedback form');
    wrap.appendChild(frame);

    // An escape hatch, not the path: a browser blocking third-party frames, or a form restricted
    // to signed-in Toro accounts, can leave the frame blank, and the reader should not be stuck.
    var alt = el('a', 'lsa-fb-alt', t('Form not loading? Open it in a new tab.'));
    alt.href = formUrl(payload, false);
    alt.target = '_blank';
    alt.rel = 'noopener';
    wrap.appendChild(alt);

    document.body.appendChild(wrap);
    syncFab();
    close.focus();
  }

  // ---- delegated handling ------------------------------------------------------
  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || typeof target.closest !== 'function') return;

    if (target.closest('.lsa-fb-close')) { ev.preventDefault(); closePanel(); return; }

    var fab = target.closest('.' + FAB);
    if (fab) {
      ev.preventDefault();
      if (panelEl()) { closePanel(); return; }
      var here = context();
      track('feedback_opened', { guide: here.guide, step: here.step });
      openPanel({ kind: 'Feedback', subject: here.guide, step: here.step, trigger: fab });
      return;
    }

    var stub = target.closest('.lsa [data-stub="true"]');
    if (stub) { ev.preventDefault(); ev.stopPropagation(); onStubRequest(stub); }
  }, true);

  document.addEventListener('keydown', function (ev) {
    var wrap = panelEl();
    // Escape closes only when focus is in the panel or on its button. The panel is non-modal, so
    // an Escape meant for something else on the page — the contact dialog, the step player —
    // must not also close it. Focus inside the form's frame never reaches this document.
    if (wrap && ev.key === 'Escape') {
      var a = document.activeElement;
      if (a && (wrap.contains(a) || (a.closest && a.closest('.' + FAB)))) { ev.preventDefault(); closePanel(); }
      return;
    }
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el2 = ev.target;
    if (!el2 || typeof el2.closest !== 'function') return;
    var stub = el2.closest('.lsa [data-stub="true"]');
    if (stub) { ev.preventDefault(); ev.stopPropagation(); onStubRequest(stub); }
  }, true);

  // Activating an unwritten guide records demand and offers to say what was wanted. Stub clicks
  // are the cheapest, least fakeable signal for what to write next. Recorded even with no form
  // configured, because the demand data is the point.
  function onStubRequest(card) {
    var title = (card.getAttribute('data-title') || '').trim().slice(0, 80);
    track('stub_clicked', { title: title });
    if (FORM.id) openPanel({ kind: 'Guide request', subject: title, trigger: card });
  }

  // ---- button injection --------------------------------------------------------
  // Appended to <body>, outside the runtime's tree, so a re-render cannot detach it — and so the
  // sign-in gate's `body > *:not(.lsa-gate)` rule hides it until the reader is through. The label
  // is written in English on purpose: src/i18n-apply.js translates it like any other page text,
  // which is what keeps it right after a language switch. A t() call here would freeze whichever
  // language was active when the button was built.
  function buildFab() {
    if (!FORM.id || document.querySelector('.' + FAB) || !document.querySelector('.lsa')) return;
    var b = el('button', FAB);
    b.type = 'button';
    b.setAttribute('aria-controls', DLG);
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML =
      '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
    b.appendChild(el('span', 'lsa-fb-fab-label', 'Feedback'));
    document.body.appendChild(b);
  }

  // Coalesce observer callbacks: the runtime mutates the tree constantly, and injecting into it
  // would otherwise re-trigger this synchronously on every insertion.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; buildFab(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
