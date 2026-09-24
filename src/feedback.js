// In-product feedback for the Spatial Adjust guides.
//
// A floating Feedback button, bottom right, on every page, opens a panel. The reader types a
// comment and presses Send; the comment is POSTed, with the page, step, locale and URL attached,
// to a Power Automate flow, which adds it to a SharePoint list. The reader never leaves the site
// and never sees where it went — they see "sent", and only once the flow has confirmed it.
//
// Why a Power Automate flow:
//   - The site is static, so it has no server of its own to accept a post.
//   - Filing GitHub issues directly would need a token in the page, and the repository is public:
//     anyone could read it and write to the repo. A prefilled issue in a new tab — the previous
//     destination — sent readers to GitHub, needed an account and made every comment public.
//   - An embedded Microsoft Form kept readers on the site but put Microsoft's form, and the
//     context as visible prefilled questions, inside the panel.
//   - Cloudflare, Google Sheets and Azure were ruled out on Toro's tooling (README > Sign-in gate).
//     Power Automate runs inside Toro's own tenant.
//
// The flow URL is a capability: whoever has it can post to the list, and it ships in this public
// page. The flow truncates what it stores (README > Feedback), and the URL can be regenerated in
// Power Automate if it is ever abused.
//
// Configure it in one place: ENDPOINT below. While it is empty the button is not shown at all —
// a button that sends nowhere is worse than no button.
//
// All handling is delegated from document rather than bound per element: the runtime re-renders
// on every state change, which detaches any node-level listener.
(function () {
  'use strict';

  // ---- destination -------------------------------------------------------------
  // The HTTP POST URL of the flow's "When an HTTP request is received" trigger.
  // window.__saFeedbackEndpoint overrides it so scripts/instrumentation.mjs can drive the panel
  // against a stubbed endpoint without the real one being configured or posted to.
  var ENDPOINT = window.__saFeedbackEndpoint || '';

  var DRAFT_KEY = 'sa.feedback.draft';
  var DLG = 'lsa-fb-dlg';
  var FAB = 'lsa-fb-fab';
  var MAX = 4000;           // the flow truncates to the same length; this keeps the reader honest about it

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

  // ---- draft -------------------------------------------------------------------
  // Survives a cancel, a reload and a failed send. One draft at a time because there is one panel
  // at a time; a per-page map would quietly accumulate abandoned notes the reader cannot see.
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeDraft(d) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* full or blocked */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* private mode */ }
  }

  // ---- send --------------------------------------------------------------------
  // Form-encoded rather than JSON, for two reasons. It is a CORS "simple request", so the browser
  // sends it without a preflight OPTIONS call, which the flow trigger does not answer. And Power
  // Automate reads form fields directly with triggerFormDataValue('comment'), so the flow needs
  // no Parse JSON step and no schema to keep in step with this file.
  //
  // Resolves only on a 2xx the page can read. The flow's final Response step adds the
  // Access-Control-Allow-Origin header that makes it readable, and sits after the SharePoint
  // step — so "sent" means stored, not merely received.
  function post(payload) {
    var body = new URLSearchParams();
    for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) body.append(k, payload[k] || '');
    return fetch(ENDPOINT, { method: 'POST', body: body, mode: 'cors', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
  }

  // ---- panel -------------------------------------------------------------------
  // It replaced a "Was this helpful?" row at the foot of each guide: that row sat below the "Next"
  // cards where few readers scroll, its thumbs-up collected nothing but a click, and the catalogue
  // had no way to comment at all.
  //
  // The panel is NON-modal on purpose. A reader commenting on a step wants that step in view while
  // they type, so the page stays scrollable behind it and there is no focus trap. The context is
  // captured when the panel opens, shown back to the reader, and is exactly what gets sent.
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

  function closePanel(keepDraft) {
    var wrap = panelEl();
    if (!wrap) return;
    var ta = wrap.querySelector('.lsa-fb-input');
    // No textarea means the panel is showing its sent confirmation and the draft is already gone.
    if (keepDraft && ta) {
      var meta = JSON.parse(wrap.getAttribute('data-meta') || '{}');
      if (ta.value.trim()) writeDraft({ kind: meta.kind, guide: meta.guide, note: ta.value });
      else clearDraft();
    }
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
    if (existing) {
      var f = existing.querySelector('.lsa-fb-input') || existing.querySelector('button');
      if (f) f.focus();
      return;
    }
    lastTrigger = opts.trigger || null;
    var isRequest = opts.kind === 'Guide request';

    var wrap = el('div', DLG);
    wrap.id = DLG;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-labelledby', 'lsa-fb-title');
    wrap.setAttribute('data-meta', JSON.stringify({ kind: opts.kind, guide: opts.subject, step: opts.step || '' }));

    var head = el('div', 'lsa-fb-head');
    var h = el('h2', 'lsa-fb-title', t(isRequest ? 'This guide has not been written yet' : 'Send feedback'));
    h.id = 'lsa-fb-title';
    var close = el('button', 'lsa-fb-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Close'));
    head.appendChild(h); head.appendChild(close);
    wrap.appendChild(head);

    var body = el('div', 'lsa-fb-body');
    if (opts.subject) body.appendChild(el('p', 'lsa-fb-subject', opts.subject));
    if (opts.step) body.appendChild(el('p', 'lsa-fb-step', opts.step));

    var label = el('label', 'lsa-fb-label', t(isRequest ? 'What did you need it to tell you?' : 'Your comments'));
    label.setAttribute('for', 'lsa-fb-input');
    body.appendChild(label);

    var ta = el('textarea', 'lsa-fb-input');
    ta.id = 'lsa-fb-input';
    ta.rows = 5;
    ta.maxLength = MAX;
    // Restore only a draft from the same flow and subject: showing a note written about another
    // page would be worse than showing nothing.
    var draft = readDraft();
    if (draft && draft.kind === opts.kind && draft.guide === opts.subject) ta.value = draft.note || '';
    body.appendChild(ta);

    // Announced when it appears, so a screen-reader user learns the send failed without hunting.
    var err = el('p', 'lsa-fb-error');
    err.setAttribute('role', 'alert');
    body.appendChild(err);

    var actions = el('div', 'lsa-fb-actions');
    var cancel = el('button', 'lsa-fb-cancel', t('Cancel'));
    cancel.type = 'button';
    var send = el('button', 'lsa-fb-send', t('Send'));
    send.type = 'button';
    // A comment is the whole point of the Feedback flow, so an empty one cannot be sent. A guide
    // request carries its signal in the title alone, so its note stays optional.
    var gate = function () { if (!isRequest) send.disabled = !ta.value.trim(); };
    gate();
    actions.appendChild(cancel); actions.appendChild(send);
    body.appendChild(actions);

    wrap.appendChild(body);
    document.body.appendChild(wrap);
    syncFab();
    ta.focus();

    // Keep the draft current as it is typed, not only on close — a reload mid-sentence is the
    // case a save-on-close would still lose.
    ta.addEventListener('input', function () {
      gate();
      if (ta.value.trim()) writeDraft({ kind: opts.kind, guide: opts.subject, note: ta.value });
      else clearDraft();
    });
  }

  function onSend(wrap) {
    var ta = wrap.querySelector('.lsa-fb-input');
    var send = wrap.querySelector('.lsa-fb-send');
    var err = wrap.querySelector('.lsa-fb-error');
    if (!ta || !send || send.disabled) return;
    var meta = JSON.parse(wrap.getAttribute('data-meta') || '{}');
    var c = context();
    var payload = {
      kind: meta.kind || 'Feedback',
      page: meta.guide || c.guide,
      step: meta.step || '',
      comment: ta.value.trim().slice(0, MAX),
      locale: c.locale,
      url: c.url,
    };
    send.disabled = true;
    send.textContent = t('Sending…');
    err.textContent = '';
    post(payload).then(function () {
      track('feedback_sent', { guide: payload.page, kind: payload.kind, locale: payload.locale });
      clearDraft();
      if (!document.contains(wrap)) return;       // closed while sending; nothing left to update
      var body = wrap.querySelector('.lsa-fb-body');
      body.textContent = '';
      body.appendChild(el('p', 'lsa-fb-done', t('Thanks — your feedback has been sent.')));
      var actions = el('div', 'lsa-fb-actions');
      var ok = el('button', 'lsa-fb-cancel', t('Close'));
      ok.type = 'button';
      actions.appendChild(ok);
      body.appendChild(actions);
      ok.focus();
    }, function () {
      // The note stays in the box and in the draft: a failed send must never cost the reader
      // what they typed.
      if (!document.contains(wrap)) return;
      send.textContent = t('Send');
      send.disabled = false;
      err.textContent = t('Could not send. Check your connection and try again.');
    });
  }

  // ---- delegated handling ------------------------------------------------------
  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || typeof target.closest !== 'function') return;

    // --- inside the panel
    if (target.closest('.lsa-fb-close') || target.closest('.lsa-fb-cancel')) {
      ev.preventDefault();
      closePanel(true);             // cancelling keeps the draft; that is the whole point
      return;
    }
    if (target.closest('.lsa-fb-send')) {
      ev.preventDefault();
      var wrap = panelEl();
      if (wrap) onSend(wrap);
      return;
    }

    // --- triggers
    var fab = target.closest('.' + FAB);
    if (fab) {
      ev.preventDefault();
      if (panelEl()) { closePanel(true); return; }
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
    // must not also close a half-written note.
    if (wrap && ev.key === 'Escape') {
      var a = document.activeElement;
      if (a && (wrap.contains(a) || (a.closest && a.closest('.' + FAB)))) { ev.preventDefault(); closePanel(true); }
      return;
    }
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el2 = ev.target;
    if (!el2 || typeof el2.closest !== 'function') return;
    var stub = el2.closest('.lsa [data-stub="true"]');
    if (stub) { ev.preventDefault(); ev.stopPropagation(); onStubRequest(stub); }
  }, true);

  // Activating an unwritten guide records demand and offers to say what was wanted. Stub clicks
  // are the cheapest, least fakeable signal for what to write next. Recorded even with no
  // endpoint configured, because the demand data is the point.
  function onStubRequest(card) {
    var title = (card.getAttribute('data-title') || '').trim().slice(0, 80);
    track('stub_clicked', { title: title });
    if (ENDPOINT) openPanel({ kind: 'Guide request', subject: title, trigger: card });
  }

  // ---- button injection --------------------------------------------------------
  // Appended to <body>, outside the runtime's tree, so a re-render cannot detach it — and so the
  // sign-in gate's `body > *:not(.lsa-gate)` rule hides it until the reader is through. The label
  // is written in English on purpose: src/i18n-apply.js translates it like any other page text,
  // which is what keeps it right after a language switch. A t() call here would freeze whichever
  // language was active when the button was built.
  function buildFab() {
    if (!ENDPOINT || document.querySelector('.' + FAB) || !document.querySelector('.lsa')) return;
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
