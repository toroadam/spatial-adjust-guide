// In-product feedback for the Spatial Adjust guides.
//
// The site is static, so there is no server to accept a form post. Submissions are routed to a
// Microsoft Form instead: it needs no backend, no third-party script and no Azure administrator,
// and its responses land in an Excel workbook in the owner's OneDrive — a queryable store that
// stays inside Toro's own tenant. That last point is why it is Forms rather than Google Sheets or
// a Cloudflare Function: both of those sit outside the tooling Toro permits, which is what ruled
// out the original an internal work item hosting plan too.
//
// This replaces a prefilled GitHub issue (an internal work item). That path had two problems worth recording:
// it required the reader to hold a GitHub account, and it filed guide feedback as a PUBLIC issue
// on a personal repository — a more exposed destination than anything discussed to replace it.
//
// The collection UI is a real in-page dialog rather than window.prompt(). Three reasons:
//   - prompt() text never enters the DOM, so it was invisible to the catalogue harvester in
//     scripts/extract-strings.mjs and shipped in English to all eleven locales;
//   - prompt() cannot hold a draft, so cancelling discarded everything typed (an internal work item);
//   - prompt() is unstyleable and its focus behaviour is the browser's, not ours.
//
// All handling is delegated from document rather than bound per element: the runtime re-renders
// on every state change, which detaches any node-level listener.
(function () {
  'use strict';

  // ---- destination -------------------------------------------------------------
  // Empty by default. With no form configured, submissions fall back to the prefilled GitHub
  // issue this file used before — see FALLBACK_REPO. The reader always reaches a real
  // destination; the Form is an upgrade, not a prerequisite.
  //
  // FORM.id is the GUID after `id=` in the form's share link. FORM.fields maps each question to
  // its prefill parameter id, which is the number in `r<number>` — README > Feedback has the
  // click-by-click for reading both off the form itself.
  var FORM = {
    id: '',
    fields: {
      kind: '',       // "Feedback" or "Guide request" — lets one form serve both flows
      guide: '',
      step: '',
      note: '',
      locale: '',
      url: '',
    },
  };

  // Fallback destination, used only while FORM.id is empty. A prefilled GitHub issue is what this
  // file did before, and it is worse than a Form — it needs the reader to hold a GitHub account
  // and files guide feedback as a PUBLIC issue. But it WORKS, and shipping the dialog with
  // nowhere to send would silently end feedback collection on a pilot whose whole point is
  // collecting it. Degrading to the old path beats degrading to nothing. Remove once FORM.id is set.
  var FALLBACK_REPO = 'toroadam/spatial-adjust-guide';

  var DRAFT_KEY = 'sa.feedback.draft';
  var DLG = 'lsa-fb-dlg';

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
      viewport: window.innerWidth + 'x' + window.innerHeight,
    };
  }

  // ---- draft -------------------------------------------------------------------
  // Survives a cancel, a reload and a navigation to another guide. There is one draft at a time
  // because there is one dialog at a time; a per-guide map would quietly accumulate abandoned
  // notes the reader has no way to see or clear.
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeDraft(d) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* full or blocked */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* private mode */ }
  }

  // ---- Microsoft Forms URL -----------------------------------------------------
  // Prefill puts the context into the response without asking the reader to retype it, exactly as
  // the GitHub-issue body used to. Only fields with a configured parameter id are appended, so a
  // partially filled FORM.fields degrades to a shorter prefill rather than a broken URL.
  function formUrl(payload) {
    if (!FORM.id) return null;
    var url = 'https://forms.office.com/Pages/ResponsePage.aspx?id=' + encodeURIComponent(FORM.id);
    for (var key in FORM.fields) {
      if (!Object.prototype.hasOwnProperty.call(FORM.fields, key)) continue;
      var param = FORM.fields[key];
      var value = payload[key];
      if (!param || value === undefined || value === null || value === '') continue;
      url += '&r' + encodeURIComponent(param) + '=' + encodeURIComponent(String(value));
    }
    return url;
  }

  // The pre-Forms destination, kept intact as the fallback.
  function issueUrl(payload) {
    var title = (payload.kind === 'Guide request' ? 'Guide request: ' : 'Guide feedback: ') + payload.guide;
    var body =
      (payload.kind === 'Guide request'
        ? '**Requested guide:** ' + payload.guide + '\n\n**What they needed it to answer**\n'
        : '**What was missing or unclear**\n')
      + (payload.note || '(not stated)') + '\n\n'
      + '---\n- Guide: ' + payload.guide + '\n- Step reached: ' + (payload.step || 'n/a')
      + '\n- Locale: ' + payload.locale + '\n- URL: ' + payload.url + '\n';
    return 'https://github.com/' + FALLBACK_REPO + '/issues/new'
      + '?title=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(body)
      + '&labels=' + encodeURIComponent(payload.kind === 'Guide request' ? 'guide-request' : 'guide-feedback');
  }

  function submit(payload) {
    var url = formUrl(payload) || issueUrl(payload);
    // Recorded whether or not a destination exists: demand data is the point of the widget, and
    // src/analytics.js buffers locally by default anyway.
    track(payload.kind === 'Guide request' ? 'guide_requested' : 'feedback_detailed', {
      guide: payload.guide,
      hasNote: !!payload.note,
      locale: payload.locale,
    });
    clearDraft();
    // Always a real destination: the Form when configured, the issue path until then.
    window.open(url, '_blank', 'noopener');
  }

  // ---- dialog ------------------------------------------------------------------
  var lastTrigger = null;

  function closeDialog(keepDraft) {
    var wrap = document.querySelector('.' + DLG);
    if (!wrap) return;
    if (keepDraft) {
      var ta = wrap.querySelector('.lsa-fb-input');
      var meta = JSON.parse(wrap.getAttribute('data-meta') || '{}');
      if (ta && ta.value.trim()) writeDraft({ kind: meta.kind, guide: meta.guide, note: ta.value });
      else clearDraft();
    }
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    // Focus goes back where it came from, or the reader is dumped at the top of the document.
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  }

  // kind: 'Feedback' | 'Guide request'. subject is the guide or the requested title — rendered as
  // its own element rather than interpolated into a sentence, so the catalogue stays free of
  // format placeholders that a translator has to reassemble correctly.
  function openDialog(opts) {
    if (document.querySelector('.' + DLG)) return;
    lastTrigger = opts.trigger || null;
    var isRequest = opts.kind === 'Guide request';

    var wrap = document.createElement('div');
    wrap.className = DLG;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'lsa-fb-title');
    wrap.setAttribute('data-meta', JSON.stringify({ kind: opts.kind, guide: opts.subject }));

    var panel = document.createElement('div');
    panel.className = 'lsa-fb-panel';

    var head = document.createElement('div');
    head.className = 'lsa-fb-head';
    var h = document.createElement('h2');
    h.id = 'lsa-fb-title';
    h.className = 'lsa-fb-title';
    h.textContent = t(isRequest ? 'This guide has not been written yet'
                                : 'What was missing or unclear?');
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'lsa-fb-close';
    close.setAttribute('aria-label', t('Close'));
    close.textContent = '×';
    head.appendChild(h); head.appendChild(close);
    panel.appendChild(head);

    if (opts.subject) {
      var subj = document.createElement('p');
      subj.className = 'lsa-fb-subject';
      subj.textContent = opts.subject;
      panel.appendChild(subj);
    }

    var label = document.createElement('label');
    label.className = 'lsa-fb-label';
    label.setAttribute('for', 'lsa-fb-input');
    label.textContent = t(isRequest ? 'What did you need it to tell you?'
                                    : 'What would have helped?');
    panel.appendChild(label);

    var ta = document.createElement('textarea');
    ta.className = 'lsa-fb-input';
    ta.id = 'lsa-fb-input';
    ta.rows = 5;
    // Restore only a draft from the same flow and subject: showing a note written about another
    // guide would be worse than showing nothing.
    var draft = readDraft();
    if (draft && draft.kind === opts.kind && draft.guide === opts.subject) ta.value = draft.note || '';
    panel.appendChild(ta);

    var hint = document.createElement('p');
    hint.className = 'lsa-fb-hint';
    hint.textContent = t('Optional — this helps decide what gets written next.');
    panel.appendChild(hint);

    var actions = document.createElement('div');
    actions.className = 'lsa-fb-actions';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'lsa-fb-cancel';
    cancel.textContent = t('Cancel');
    var send = document.createElement('button');
    send.type = 'button';
    send.className = 'lsa-fb-send';
    send.textContent = t('Send');
    actions.appendChild(cancel); actions.appendChild(send);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    ta.focus();

    // Keep the draft current as it is typed, not only on close — a reload mid-sentence is the
    // case a save-on-close would still lose.
    ta.addEventListener('input', function () {
      if (ta.value.trim()) writeDraft({ kind: opts.kind, guide: opts.subject, note: ta.value });
      else clearDraft();
    });
  }

  function confirmOn(wrapEl, message) {
    if (!wrapEl) return;
    wrapEl.setAttribute('data-done', '1');
    wrapEl.textContent = t(message);
  }

  // ---- delegated handling ------------------------------------------------------
  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || typeof target.closest !== 'function') return;

    // --- inside the dialog
    if (target.closest('.lsa-fb-close') || target.closest('.lsa-fb-cancel')) {
      ev.preventDefault();
      closeDialog(true);            // cancelling keeps the draft; that is the whole point
      return;
    }
    if (target.closest('.lsa-fb-send')) {
      ev.preventDefault();
      var wrap = document.querySelector('.' + DLG);
      var ta = wrap && wrap.querySelector('.lsa-fb-input');
      var meta = JSON.parse((wrap && wrap.getAttribute('data-meta')) || '{}');
      var c = context();
      submit({
        kind: meta.kind || 'Feedback',
        guide: meta.guide || c.guide,
        step: c.step,
        note: ta ? ta.value : '',
        locale: c.locale,
        url: c.url,
      });
      closeDialog(false);
      confirmOn(document.querySelector('.lsa-helpful'), 'Thanks — noted.');
      return;
    }
    // Backdrop, but not inside the panel. Treated as a cancel, so the draft survives.
    var dlg = document.querySelector('.' + DLG);
    if (dlg && target === dlg) { closeDialog(true); return; }

    // --- triggers
    var fb = target.closest('.lsa-helpful-btn');
    if (fb) { ev.preventDefault(); onHelpful(fb); return; }

    var stub = target.closest('.lsa [data-stub="true"]');
    if (stub) { ev.preventDefault(); ev.stopPropagation(); onStubRequest(stub); }
  }, true);

  document.addEventListener('keydown', function (ev) {
    if (document.querySelector('.' + DLG)) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeDialog(true); return; }
      if (ev.key !== 'Tab') return;
      // Contain focus: a modal a keyboard user can tab out of is a modal in name only. The
      // textarea is in this list where src/contact.js's equivalent needs only buttons and links.
      var f = document.querySelectorAll('.' + DLG + ' button, .' + DLG + ' textarea');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      return;
    }
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el = ev.target;
    if (!el || typeof el.closest !== 'function') return;
    var stub = el.closest('.lsa [data-stub="true"]');
    if (stub) { ev.preventDefault(); ev.stopPropagation(); onStubRequest(stub); }
  }, true);

  function onHelpful(btn) {
    var verdict = btn.getAttribute('data-v');
    var c = context();
    track('feedback_submitted', { verdict: verdict, guide: c.guide, step: c.step });

    var wrap = btn.closest('.lsa-helpful');
    if (verdict === 'yes') { confirmOn(wrap, 'Thanks — noted.'); return; }
    // "No" is the useful case, so collect the detail rather than swallow it.
    openDialog({ kind: 'Feedback', subject: c.guide, trigger: btn });
  }

  // Activating an unwritten guide records demand and offers to say what was wanted. Stub clicks
  // are the cheapest, least fakeable signal for what to write next.
  function onStubRequest(card) {
    var title = (card.getAttribute('data-title') || '').trim().slice(0, 80);
    track('stub_clicked', { title: title });
    openDialog({ kind: 'Guide request', subject: title, trigger: card });
  }

  // ---- widget injection -------------------------------------------------------
  // Placed at the very bottom of the page content, not beside the player. It used to sit in the
  // player panel, which crowded the controls and — because the "On this page" sidebar is sticky at
  // an offset calibrated to that panel's height — pushed the section tracker out of alignment.
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

  // Coalesce observer callbacks: the runtime mutates the tree constantly, and injecting into it
  // would otherwise re-trigger this synchronously on every insertion.
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
