// Sign-in gate for the Spatial Adjust guides.
//
// WHAT THIS IS NOT
// ----------------
// This is a client-side check on a static site published from a public repository. It is a
// courtesy barrier, not access control, and it must not be described as one:
//
//   - the rule below ships to every browser that loads the page, so anyone can read it;
//   - the guide content is in the same document, so `curl` and View Source walk straight
//     past this; and
//   - the repository is public, so the whole site can be rebuilt from source regardless.
//
// It exists to keep the pilot pointed at its intended audience and to make entry a
// deliberate act, which is a real and reasonable thing to want. It is not a confidentiality
// measure, and nothing that would matter if it leaked should be published behind it. If that
// changes, the gate has to move server-side — see README > Known gaps.
//
// The gate flag is resolved in <head> by src/gate-boot.js so the catalogue never paints
// before this runs; this file only renders the prompt and validates what is typed.
(function () {
  'use strict';

  // ---- the rule ---------------------------------------------------------------
  // Domain-based, with room for named exceptions. Adding a contractor or a colleague on a
  // different tenant is then a one-line change to ALLOW_EMAILS rather than a widening of
  // the domain rule to a whole organisation nobody meant to admit.
  var ALLOW_DOMAINS = ['toro.com'];
  var ALLOW_EMAILS = [];          // exact addresses, lowercase, e.g. 'someone@example.com'

  var STORAGE_KEY = 'sa-guides-gate';
  var ROOT_CLASS = 'lsa-gate';

  // ---- sign-in log (OFF by default) -------------------------------------------
  // Set this to a URL and every successful sign-in POSTs { email, at, locale } to it, so you can
  // see who opened the guides and when. A Google Apps Script web app bound to a Sheet is the
  // cheapest thing that works — setup is in README > Sign-in gate > Logging who signs in.
  //
  // Deliberately empty, because switching it on is a decision and not a config tweak:
  //   - it sends real email addresses off the reader's device, which is PII. src/analytics.js
  //     states it collects none, and that claim has to stay true — so this path is separate from
  //     the analytics queue and never enters it.
  //   - the footer text below tells the reader their address is not sent anywhere. That sentence
  //     changes automatically when this is set, so the gate cannot end up lying to them.
  //   - scripts/smoke.mjs fails the build on any external origin. Add this host to its allowlist
  //     in the same commit, or CI will catch you.
  var SIGNIN_LOG_ENDPOINT = '';

  function track() { if (window.__saTrack) window.__saTrack.apply(null, arguments); }

  // ---- validation -------------------------------------------------------------
  // Deliberately loose on shape and strict on domain. A shape check cannot tell a real
  // address from a well-formed fake one, so tightening it buys nothing here and only turns
  // away people with legitimately unusual addresses; the domain is the whole test.
  function normalise(value) {
    return String(value || '').trim().toLowerCase();
  }

  function domainOf(email) {
    var at = email.lastIndexOf('@');
    return at === -1 ? '' : email.slice(at + 1);
  }

  function isAllowed(email) {
    if (!email || email.indexOf('@') < 1) return false;
    if (ALLOW_EMAILS.indexOf(email) !== -1) return true;
    var domain = domainOf(email);
    if (!domain) return false;
    // Subdomains count: someone@eu.toro.com is as much a Toro address as someone@toro.com,
    // and the endsWith check is anchored on the dot so 'nottoro.com' cannot match.
    for (var i = 0; i < ALLOW_DOMAINS.length; i++) {
      var d = ALLOW_DOMAINS[i];
      if (domain === d || domain.slice(-(d.length + 1)) === '.' + d) return true;
    }
    return false;
  }

  // ---- markup -----------------------------------------------------------------
  function build() {
    var wrap = document.createElement('div');
    wrap.className = ROOT_CLASS;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'lsa-gate-title');
    wrap.setAttribute('aria-describedby', 'lsa-gate-lede');

    var panel = document.createElement('div');
    panel.className = 'lsa-gate-panel';

    var mark = document.createElement('img');
    mark.className = 'lsa-gate-mark';
    mark.src = 'assets/toro-logo.svg';
    mark.alt = '';                      // decorative: the heading below carries the name
    mark.setAttribute('aria-hidden', 'true');
    panel.appendChild(mark);

    var title = document.createElement('h1');
    title.className = 'lsa-gate-title';
    title.id = 'lsa-gate-title';
    title.textContent = 'Spatial Adjust Guides';
    panel.appendChild(title);

    var lede = document.createElement('p');
    lede.className = 'lsa-gate-lede';
    lede.id = 'lsa-gate-lede';
    lede.textContent = 'These guides are in pilot with Toro staff. Enter your Toro email address to continue.';
    panel.appendChild(lede);

    // A real <form>, so Enter submits and the browser's own autofill works, rather than
    // hand-rolling key handling on a bare input.
    var form = document.createElement('form');
    form.className = 'lsa-gate-form';
    form.noValidate = true;             // the message below is ours, not the browser's

    var label = document.createElement('label');
    label.className = 'lsa-gate-label';
    label.htmlFor = 'lsa-gate-email';
    label.textContent = 'Work email address';
    form.appendChild(label);

    var input = document.createElement('input');
    input.className = 'lsa-gate-input';
    input.id = 'lsa-gate-email';
    input.type = 'email';
    input.name = 'email';
    input.autocomplete = 'email';
    input.setAttribute('inputmode', 'email');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    input.setAttribute('aria-describedby', 'lsa-gate-error');
    form.appendChild(input);

    var submit = document.createElement('button');
    submit.className = 'lsa-gate-submit';
    submit.type = 'submit';
    submit.textContent = 'Continue';
    form.appendChild(submit);

    // role="alert" rather than aria-live on a pre-existing node: the message is an
    // interruption the reader needs on submit, and alert is announced without them having
    // to move focus to find out why nothing happened.
    var error = document.createElement('p');
    error.className = 'lsa-gate-error';
    error.id = 'lsa-gate-error';
    error.setAttribute('role', 'alert');
    form.appendChild(error);

    panel.appendChild(form);

    var foot = document.createElement('p');
    foot.className = 'lsa-gate-foot';
    // Two different true statements. Which one shows is driven by the constant, not by a human
    // remembering to update the copy when they wire up the endpoint.
    foot.textContent = SIGNIN_LOG_ENDPOINT
      ? 'Your address is checked in your browser. Toro records which addresses open these pilot '
        + 'guides, and when.'
      : 'Your address is checked in your browser and stored on this device only. '
        + 'It is not sent anywhere.';
    panel.appendChild(foot);

    wrap.appendChild(panel);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = normalise(input.value);

      if (!isAllowed(email)) {
        input.setAttribute('aria-invalid', 'true');
        error.textContent = email
          ? 'That address isn’t on the pilot list. Use your Toro email address, or ask Adam Munir to add you.'
          : 'Enter your Toro email address.';
        // Domain only, never the address: src/analytics.js states it collects no PII, and
        // logging the full address here would quietly make that false.
        track('gate_rejected', { domain: domainOf(email) || 'none' });
        input.focus();
        return;
      }

      try { localStorage.setItem(STORAGE_KEY, 'open'); } catch (e) { /* private mode */ }
      track('gate_opened', { domain: domainOf(email) });
      logSignIn(email);
      open();
    });

    return wrap;
  }

  // Kept out of the analytics queue on purpose: that queue is documented as PII-free and is read
  // back by __saReport() in moderated sessions. A sign-in log is a different thing with a different
  // consent story, so it travels on its own and fails silently — a reader must never be blocked
  // from the guides because a logging endpoint is down.
  function logSignIn(email) {
    if (!SIGNIN_LOG_ENDPOINT) return;
    var body = JSON.stringify({
      email: email,
      at: new Date().toISOString(),
      locale: (window.__saLocale && window.__saLocale.get()) || 'en-us',
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(SIGNIN_LOG_ENDPOINT, new Blob([body], { type: 'text/plain' }));
      } else {
        // text/plain avoids a CORS preflight, which an Apps Script web app will not answer.
        fetch(SIGNIN_LOG_ENDPOINT, { method: 'POST', body: body, mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
      }
    } catch (e) { /* never block sign-in on a logging failure */ }
  }

  // ---- focus containment ------------------------------------------------------
  // Only two focusable elements, so a full focus trap would be more machinery than the
  // problem needs; wrapping between the input and the button is the whole behaviour.
  // Escape is deliberately not wired: dismissing the gate is the one thing it must not do.
  function contain(wrap) {
    wrap.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;
      var focusable = wrap.querySelectorAll('input, button');
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }

  // The page behind is hidden visually by src/gate.css, but visibility:hidden is the only
  // part of that a screen reader honours reliably across the tree the runtime builds — so
  // the siblings are marked inert as well, which removes them from the accessibility tree
  // and from tab order in one step.
  function setBackground(hidden) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.classList.contains(ROOT_CLASS)) continue;
      if (hidden) {
        el.setAttribute('aria-hidden', 'true');
        el.inert = true;
      } else {
        el.removeAttribute('aria-hidden');
        el.inert = false;
      }
    }
  }

  function open() {
    var wrap = document.querySelector('.' + ROOT_CLASS);
    setBackground(false);
    document.documentElement.setAttribute('data-sa-gate', 'open');
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    // Focus lands on the top of the document rather than nowhere: removing the element the
    // user was focused on otherwise resets focus to <body>, and the next Tab starts from
    // the browser chrome instead of the page they just unlocked.
    var target = document.querySelector('h1, [role="main"], main') || document.body;
    if (target !== document.body) {
      target.setAttribute('tabindex', '-1');
      target.focus();
    }
  }

  function mount() {
    if (document.documentElement.getAttribute('data-sa-gate') !== 'locked') return;
    if (document.querySelector('.' + ROOT_CLASS)) return;

    var wrap = build();
    document.body.appendChild(wrap);
    setBackground(true);
    contain(wrap);
    wrap.querySelector('.lsa-gate-input').focus();
    track('gate_shown', {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
