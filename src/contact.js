// Contact control: a header button and a footer link, both opening the same NSN details modal.
//
// Mounted the same way as src/i18n-selector.js and for the same reason — the Core Design runtime
// re-renders the tree on every state change and detaches node-level listeners, so every handler
// here is delegated from document and the controls are re-mounted from a coalesced
// MutationObserver.
//
// All user-facing text goes through the same translation layer as everything else: the strings are
// in src/i18n/*.json, so this control is not an English-only island in a site that ships eleven
// languages.
(function () {
  'use strict';

  // ---- the details -------------------------------------------------------------
  // Sourced from IntelliDash itself, not invented:
  //   NSNTech@toro.com            — site/src/app/core/dashboard/setup-wizard/step-faq
  //   https://my.toronsn.com/Support — the same FAQ's "widgets not updating" answer
  //
  // PHONE is deliberately empty. There is no support telephone number anywhere in the IntelliDash
  // source, and a plausible-looking number on a support page is worse than no number: somebody
  // rings it during a failed push. Fill it in and the row appears on its own.
  var NSN = {
    email: 'NSNTech@toro.com',
    phone: '1-800-ASK-TORO',                       // TORO.HELP_LINE
    portal: 'https://my.toronsn.com/Support',
  };

  // Product and legal destinations, all lifted from IntelliDash rather than guessed:
  //   intelli360SiteUrl  — site/src/environments/environment.toro-prod.ts
  //   lynxcloud          — the same environment file
  //   the three legal URLs — TORO.*_LINK in site/src/assets/i18n. They are identical in all
  //   eleven locale files (every one points at /en/), so there is nothing to localise here.
  var LINKS = {
    intellidash: 'https://intelli360.toro.com',
    lynx: 'https://lynxcloud.toro.com/#/login',
    terms: 'https://www.toro.com/en/legal/terms-of-use',
    privacy: 'https://www.toro.com/en/legal/privacy-policy',
    copyright: 'https://www.toro.com/en/legal/dmca-copyright-policy',
  };

  // The six catalogue sections, by their English heading. The headings are already in the
  // catalogues, so these links translate for free rather than needing six new strings.
  var SECTIONS = ['Getting Started', 'Calculations', 'Target Profiles',
                  'Station Management', 'Review & Apply', 'Troubleshooting'];

  var ROOT = 'lsa-contact';
  var DLG = 'lsa-contact-dlg';

  function t(s) {
    var api = window.__saI18nApply;
    return (api && api.translate && api.translate(s)) || s;
  }
  function track() { if (window.__saTrack) window.__saTrack.apply(null, arguments); }

  // ---- icon --------------------------------------------------------------------
  // Inline SVG rather than an asset: the build enforces zero external origins, and a headset glyph
  // is small enough that a file would cost a request for no benefit.
  function icon(cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (cls) svg.setAttribute('class', cls);
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M12 3a8 8 0 0 0-8 8v4.5A2.5 2.5 0 0 0 6.5 18H8a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H6v-1a6 6 0 1 1 12 0v1h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1.2a3 3 0 0 1-2.7 1.7H13a1 1 0 1 0 0 2h1.5A5 5 0 0 0 19.4 18h.1A2.5 2.5 0 0 0 20 15.5V11a8 8 0 0 0-8-8Z');
    svg.appendChild(path);
    return svg;
  }

  // ---- modal -------------------------------------------------------------------
  var lastTrigger = null;

  function row(labelKey, value, href) {
    var r = document.createElement('div');
    r.className = 'lsa-contact-row';
    var l = document.createElement('span');
    l.className = 'lsa-contact-label';
    l.textContent = t(labelKey);
    var v = document.createElement(href ? 'a' : 'span');
    v.className = 'lsa-contact-value';
    v.textContent = value;
    if (href) {
      v.href = href;
      // Opening the portal in a new tab keeps the reader's place in the guide they were stuck on.
      if (/^https?:/.test(href)) { v.target = '_blank'; v.rel = 'noopener noreferrer'; }
    }
    r.appendChild(l); r.appendChild(v);
    return r;
  }

  function openDialog(trigger) {
    if (document.querySelector('.' + DLG)) return;
    lastTrigger = trigger || null;

    var wrap = document.createElement('div');
    wrap.className = DLG;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'lsa-contact-title');

    var panel = document.createElement('div');
    panel.className = 'lsa-contact-panel';

    var head = document.createElement('div');
    head.className = 'lsa-contact-head';
    var h = document.createElement('h2');
    h.id = 'lsa-contact-title';
    h.className = 'lsa-contact-title';
    h.textContent = t('Contact NSN');
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'lsa-contact-close';
    close.setAttribute('aria-label', t('Close'));
    close.textContent = '×';
    head.appendChild(h); head.appendChild(close);
    panel.appendChild(head);

    var lede = document.createElement('p');
    lede.className = 'lsa-contact-lede';
    lede.textContent = t('Toro National Support Network. For help with Spatial Adjust, IntelliDash or a failed push to Lynx.');
    panel.appendChild(lede);

    panel.appendChild(row('Email', NSN.email, 'mailto:' + NSN.email));
    // Only rendered when a number actually exists — see the note on NSN.phone.
    // The NUMBER is translated, not merely its label. TORO.HELP_LINE differs by region — Germany
    // dials 00-800-8040-8040, Spain 900-973-219 — and showing a US number to a German
    // superintendent mid-failure is the same class of harm as inventing one. The tel: href is
    // built from the translated value so the link dials what the row displays.
    if (NSN.phone) {
      var localPhone = t(NSN.phone);
      panel.appendChild(row('Phone', localPhone, 'tel:' + localPhone.replace(/[^\d+]/g, '')));
    }
    panel.appendChild(row('Support portal', NSN.portal, NSN.portal));

    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    close.focus();
    track('contact_opened', {});
  }

  function closeDialog() {
    var wrap = document.querySelector('.' + DLG);
    if (!wrap) return;
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    // Focus goes back where it came from, or the reader is dumped at the top of the document.
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  }

  // ---- delegated handlers ------------------------------------------------------
  document.addEventListener('click', function (ev) {
    var trigger = ev.target.closest && ev.target.closest('.' + ROOT + '-btn, .lsa-foot-contact');
    if (trigger) { ev.preventDefault(); openDialog(trigger); return; }
    if (ev.target.closest && ev.target.closest('.lsa-contact-close')) { ev.preventDefault(); closeDialog(); return; }
    // Click on the backdrop, but not inside the panel.
    var dlg = document.querySelector('.' + DLG);
    if (dlg && ev.target === dlg) closeDialog();
  });

  document.addEventListener('keydown', function (ev) {
    if (!document.querySelector('.' + DLG)) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeDialog(); return; }
    if (ev.key !== 'Tab') return;
    // Contain focus: a modal a keyboard user can tab out of is a modal in name only.
    var f = document.querySelectorAll('.' + DLG + ' button, .' + DLG + ' a[href]');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  });

  // ---- mount -------------------------------------------------------------------
  function mountHeader() {
    var hdr = document.querySelector('.lsa-hdr');
    if (!hdr || hdr.querySelector('.' + ROOT + '-btn')) return;
    var lang = hdr.querySelector('.lsa-lang');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = ROOT + '-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.appendChild(icon(ROOT + '-icon'));
    var label = document.createElement('span');
    // NOT lsa-contact-label — that class belongs to the modal's row labels, and sharing it meant
    // the phone-width rule that hides this button's text also blanked every label in the modal.
    label.className = ROOT + '-btn-label';
    label.textContent = t('Contact');
    btn.appendChild(label);
    // Accessible name carries the word in text even when the label is hidden at phone widths.
    btn.setAttribute('aria-label', t('Contact NSN'));

    // Sits immediately before the language selector, which src/i18n-selector.js pins to the end
    // of the row — so the pair reads "contact, language" hard right.
    if (lang) hdr.insertBefore(btn, lang); else hdr.appendChild(btn);
  }

  function extLink(text, href) {
    var a = document.createElement('a');
    a.className = 'lsa-foot-link';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    return a;
  }

  function column(headingKey, nodes) {
    var col = document.createElement('div');
    col.className = 'lsa-foot-col';
    var h = document.createElement('h2');
    h.className = 'lsa-foot-head';
    h.textContent = t(headingKey);
    col.appendChild(h);
    var ul = document.createElement('ul');
    ul.className = 'lsa-foot-list';
    nodes.forEach(function (n) {
      var li = document.createElement('li');
      li.appendChild(n);
      ul.appendChild(li);
    });
    col.appendChild(ul);
    return col;
  }

  function mountFooter() {
    var foot = document.querySelector('.lsa footer');
    if (!foot || foot.querySelector('.lsa-foot')) return;

    var nav = document.createElement('nav');
    nav.className = 'lsa-foot';
    nav.setAttribute('aria-label', t('Footer'));

    // --- sections. Buttons, not anchors: the app owns the hash for its own routing
    // (#/guide-key), so a plain #section fragment would be read as an unknown guide key and
    // bounce the reader to the catalogue. These navigate home and then scroll.
    var sections = SECTIONS.map(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lsa-foot-link lsa-foot-section';
      b.setAttribute('data-section', name);
      b.textContent = t(name);
      return b;
    });

    var contact = document.createElement('button');
    contact.type = 'button';
    contact.className = 'lsa-foot-link lsa-foot-contact';
    contact.setAttribute('aria-haspopup', 'dialog');
    contact.textContent = t('Contact NSN');

    var allTasks = document.createElement('a');
    allTasks.className = 'lsa-foot-link';
    allTasks.href = '#/';
    allTasks.textContent = t('All tasks');

    nav.appendChild(column('Sections', sections));
    nav.appendChild(column('Support', [
      contact,
      extLink(t('NSN support portal'), NSN.portal),
      allTasks,
    ]));
    nav.appendChild(column('Product', [
      extLink('IntelliDash', LINKS.intellidash),
      extLink('Lynx Cloud', LINKS.lynx),
    ]));
    nav.appendChild(column('Legal', [
      extLink(t('Terms of Use'), LINKS.terms),
      extLink(t('Privacy Policy'), LINKS.privacy),
      extLink(t('Copyright Policy'), LINKS.copyright),
    ]));

    // Above the copyright line, which stays the last thing on the page.
    foot.insertBefore(nav, foot.firstChild);
  }

  // Section links: go to the catalogue, then scroll the matching heading into view. Matching on
  // the rendered heading text rather than an id because the headings come from the Core Design
  // export and have none — and adding ids there would be a transform that this does not need.
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('.lsa-foot-section');
    if (!btn) return;
    ev.preventDefault();
    var want = btn.getAttribute('data-section');
    var translated = t(want);
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    // The catalogue has to render before the heading exists to scroll to.
    setTimeout(function () {
      var head = [].slice.call(document.querySelectorAll('.lsa h2'))
        .filter(function (h) {
          var txt = (h.textContent || '').trim();
          return txt === translated || txt === want;
        })[0];
      if (head && head.scrollIntoView) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 260);
  });

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; mountHeader(); mountFooter(); });
  }

  if (window.__saLocale && window.__saLocale.onChange) {
    // Re-mount on a language change so the labels are rebuilt in the new language.
    window.__saLocale.onChange(function () {
      var b = document.querySelector('.' + ROOT + '-btn');
      if (b && b.parentNode) b.parentNode.removeChild(b);
      var n = document.querySelector('.lsa-foot-links');
      if (n && n.parentNode) n.parentNode.removeChild(n);
      schedule();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
