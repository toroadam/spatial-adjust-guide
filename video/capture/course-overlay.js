// Fictional course overlay: the in-page script that keeps real names off screen during a capture.
//
// The capture director (video/capture/director.mjs) adds this file with page.addInitScript, so it
// runs at document start in every new document, before the app has rendered anything. Loading it
// only defines window.__saOverlayInstall; nothing is rewritten until the director calls it after
// the in-app hop and before it arms the take:
//
//   window.__saOverlayInstall(pairs, identity)  -> { pairs, variants, replaced, warnings }
//     pairs     [[real, fictional], ...], longest real first: maps.pairs from loadLocalMaps()
//               (video/lib/local-maps.mjs), passed straight to page.evaluate. Playwright copies
//               arrays item by item; JSON.stringify, which the loader's arrays refuse on purpose,
//               is never involved. The names are never embedded in this file.
//     identity  video/brand/course.json, the one definition of the fictional course. A fictional
//               value may name it instead of spelling it out, so a change of course is one edit:
//                 {name} {shortName} {idPrefix} {superintendent} {customerNumber}
//                 {person:N}  identity.people[N]
//                 {person}    the next unused person, in pair order (deterministic for one file)
//   window.__saOverlay.scan(denylist)  -> [N, ...]
//     The denylist terms still present in document.body.innerText, in the title, aria-label,
//     placeholder, alt and value attributes, or in a form control's current value. N is 1-based,
//     the same numbering as "[denylisted #N]" in video/lib/local-maps.mjs. Never returns a term.
//   window.__saOverlay.count       replacements made since install
//   window.__saOverlay.refresh()   rewrite the whole page again (returns the new count)
//   window.__saOverlay.disconnect()
//
// What it rewrites: every text node under <body> (except script, style, noscript and template),
// the document title, the five attributes above, and the current value of inputs and text areas.
// Each real name is matched in its exact form and its upper-case and title-case forms and replaced
// by the fictional name in the same form. Terms shorter than six characters match
// only as whole words, so a short real name never rewrites part of an ordinary word; longer terms
// match anywhere. scan() applies the same rule but case-insensitively, so a casing the
// replacement does not produce is still caught.
//
// Nodes the page adds or changes later are rewritten too: a MutationObserver collects them and one
// queued microtask rewrites the batch. Microtasks are untouched by the recorder's virtual clock;
// timers and animation frames are not, so neither is used. The observer drops the records of its
// own writes, and a node already holding what the overlay last wrote is skipped, so a fictional
// name that contains a real one is never rewritten twice.
//
// Out of reach: text drawn into a canvas or baked into an image, such as map tiles. The map is
// covered by the map treatment (video/capture/map-routes.mjs and map-treatment.js, gate G2) and
// every render is checked by OCR (video/verify/ocr_check.py).
//
// Error messages name pair positions only, never a name.
//
// Mechanism ported (text-node walker, attribute rewrite, MutationObserver re-application) from
// ~/Documents/iCentral_MarCom/double-clicks/harbor-vale-overlay.js, lines 1-6 and 46-102 only,
// as modified 2026-10-16T13:41:16-0700. Its name map (lines 7-45) and its replacement values were
// not read or copied; no code or name from that file is in this one.
(() => {
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'value'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  // Shorter terms are matched as whole words only (same threshold as the hygiene check's
  // substring rule in video/verify/hygiene.mjs).
  const WORD_ONLY_BELOW = 6;
  const IDENTITY_FIELDS = ['name', 'shortName', 'idPrefix', 'superintendent', 'customerNumber'];

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bounded = (term) => (term.length < WORD_ONLY_BELOW
    ? `(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`
    : escapeRe(term));
  const titleCase = (s) => s.replace(/[\p{L}\p{N}]+/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

  function resolveTokens(fictional, identity, i, nextPerson) {
    return fictional.replace(/\{(\w+)(?::(\d+))?\}/g, (whole, field, n) => {
      if (!identity || typeof identity !== 'object') {
        throw new Error(`course-overlay: pair #${i + 1} uses an identity token but no identity was passed`);
      }
      if (field === 'person') {
        const people = Array.isArray(identity.people) ? identity.people : [];
        const k = n === undefined ? nextPerson() : Number(n);
        if (typeof people[k] !== 'string') throw new Error(`course-overlay: pair #${i + 1} names person ${k}, which identity.people does not have`);
        return people[k];
      }
      if (n !== undefined || !IDENTITY_FIELDS.includes(field) || typeof identity[field] !== 'string') {
        throw new Error(`course-overlay: pair #${i + 1} uses an unknown identity token`);
      }
      return identity[field];
    });
  }

  function buildReplacer(pairs, identity) {
    if (!Array.isArray(pairs)) throw new Error('course-overlay: pairs must be an array of [real, fictional]');
    let person = 0;
    const nextPerson = () => person++;
    const resolved = pairs.map((pair, i) => {
      if (!Array.isArray(pair) || typeof pair[0] !== 'string' || typeof pair[1] !== 'string' || !pair[0].trim()) {
        throw new Error(`course-overlay: pair #${i + 1} must be [real, fictional] strings`);
      }
      return [pair[0], resolveTokens(pair[1], identity, i, nextPerson)];
    });
    // Variant -> replacement. Exact forms first, so an exact pair beats another pair's case variant.
    // No lower-case variant: a lower-cased name is too often an ordinary word ("field", "park").
    // scan() still catches any casing left on screen.
    const table = new Map();
    for (const form of [(s) => s, (s) => s.toUpperCase(), titleCase]) {
      for (const [real, fictional] of resolved) {
        const from = form(real);
        if (!table.has(from)) table.set(from, form === titleCase ? titleCase(fictional) : form(fictional));
      }
    }
    const keys = [...table.keys()].sort((a, b) => b.length - a.length);
    const re = keys.length ? new RegExp(keys.map(bounded).join('|'), 'gu') : null;
    // A fictional value containing a real term would be rewritten again on a later pass; the
    // last-written check below prevents that, and install reports how many pairs need it.
    const overlap = resolved.filter(([, f]) => resolved.some(([r]) => f.toLowerCase().includes(r.toLowerCase()))).length;
    return { re, table, variants: keys.length, pairs: resolved.length, overlap };
  }

  function install(pairs, identity) {
    if (!document.body) throw new Error('course-overlay: install after the page has a <body>');
    // Validate everything before replacing a running overlay, so a bad call leaves the old one on.
    const { re, table, variants, pairs: nPairs, overlap } = buildReplacer(pairs, identity);
    if (window.__saOverlay) window.__saOverlay.disconnect();

    let count = 0;
    const rewrite = (s) => {
      if (!re || !s) return s;
      return s.replace(re, (hit) => {
        const to = table.get(hit);
        if (to === undefined) return hit;
        count++;
        return to;
      });
    };

    // What the overlay last wrote, per text node and per element attribute.
    const wroteText = new WeakMap();
    const wroteAttr = new WeakMap();

    const fixText = (node) => {
      const parent = node.parentNode;
      if (parent && SKIP.has(parent.nodeName)) return;
      const v = node.data;
      if (wroteText.get(node) === v) return;
      const r = rewrite(v);
      if (r !== v) { node.data = r; wroteText.set(node, r); }
    };
    const fixAttrs = (el) => {
      let mine = wroteAttr.get(el);
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v || (mine && mine[a] === v)) continue;
        const r = rewrite(v);
        if (r !== v) {
          el.setAttribute(a, r);
          if (!mine) { mine = {}; wroteAttr.set(el, mine); }
          mine[a] = r;
        }
      }
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && typeof el.value === 'string' && el.value) {
        const r = rewrite(el.value);
        if (r !== el.value) el.value = r;
      }
    };
    const fixTree = (root) => {
      if (root.nodeType === Node.TEXT_NODE) { fixText(root); return; }
      if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
      if (root.nodeType === Node.ELEMENT_NODE) {
        if (SKIP.has(root.nodeName)) return;
        fixAttrs(root);
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && SKIP.has(n.nodeName)
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeType === Node.TEXT_NODE) fixText(n); else fixAttrs(n);
      }
    };
    const fixTitle = () => {
      const r = rewrite(document.title);
      if (r !== document.title) document.title = r;
    };

    // Batch observed changes into one microtask. Added nodes and changed text are rewritten with
    // their subtree; an attribute change rewrites that element's attributes only.
    const pendingTrees = new Set();
    const pendingAttrs = new Set();
    let queued = false;
    let obs = null;
    const collect = (records) => {
      for (const m of records) {
        if (m.type === 'childList') m.addedNodes.forEach((n) => pendingTrees.add(n));
        else if (m.type === 'attributes') pendingAttrs.add(m.target);
        else pendingTrees.add(m.target);
      }
    };
    const flush = () => {
      queued = false;
      // Page changes made since the observer last delivered are still queued: take them first,
      // so that dropping the records of our own writes below cannot drop one of the page's.
      collect(obs.takeRecords());
      const trees = [...pendingTrees];
      const attrs = [...pendingAttrs];
      pendingTrees.clear();
      pendingAttrs.clear();
      for (const node of trees) if (node.isConnected) fixTree(node);
      for (const el of attrs) if (el.isConnected) fixAttrs(el);
      obs.takeRecords(); // only our own writes: nothing else runs during this synchronous pass
    };
    obs = new MutationObserver((records) => {
      collect(records);
      if ((pendingTrees.size || pendingAttrs.size) && !queued) { queued = true; queueMicrotask(flush); }
    });

    fixTitle();
    fixTree(document.body);
    obs.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
    });

    function scan(denylist) {
      if (!Array.isArray(denylist)) throw new Error('course-overlay: scan(denylist) needs an array of terms');
      const surfaces = [document.body.innerText];
      const sel = ATTRS.map((a) => `[${a}]`).join(',');
      document.body.querySelectorAll(sel).forEach((el) => {
        for (const a of ATTRS) { const v = el.getAttribute(a); if (v) surfaces.push(v); }
      });
      document.body.querySelectorAll('input, textarea').forEach((el) => { if (el.value) surfaces.push(el.value); });
      const text = surfaces.join('\n');
      const hits = [];
      denylist.forEach((term, i) => {
        if (typeof term !== 'string' || !term.trim()) return;
        if (new RegExp(bounded(term), 'iu').test(text)) hits.push(i + 1);
      });
      return hits;
    }

    window.__saOverlay = {
      scan,
      get count() { return count; },
      refresh() { obs.takeRecords(); fixTitle(); fixTree(document.body); obs.takeRecords(); return count; },
      disconnect() { obs.disconnect(); pendingTrees.clear(); pendingAttrs.clear(); },
    };
    const warnings = overlap ? [`${overlap} pair(s) have a fictional value containing a real term; each node is rewritten once`] : [];
    return { pairs: nPairs, variants, replaced: count, warnings };
  }

  Object.defineProperty(window, '__saOverlayInstall', { value: install, configurable: true, writable: false });
})();
