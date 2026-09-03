// Accessibility and instrumentation transforms applied to the raw Core Design export at
// build time.
//
// These used to be hand-edits in the .dc.html files. A re-export overwrote every one of
// them silently — which is exactly what happened when the remaining 17 guides arrived.
// Applying them here means a re-export costs nothing and cannot regress the work.
//
// Every transform asserts its anchor matched exactly the expected number of times, so a
// future export that changes shape fails the build loudly instead of quietly dropping
// keyboard support.

/** Apply the replacement, asserting the pattern matched `expected` times.
 *
 *  Counting uses a global copy of the pattern on purpose: String.match() with a
 *  non-global regex returns the match *and its capture groups*, so any pattern with a
 *  group would report an inflated count. The replace itself stays non-global so it only
 *  touches the first occurrence, which is what `expected: 1` means. */
function edit(src, { name, pattern, replace, expected = 1 }) {
  const counter = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const found = [...src.matchAll(counter)].length;
  if (found !== expected) {
    throw new Error(
      `Transform "${name}" expected ${expected} match(es) but found ${found}.\n` +
      `  The Core Design export's structure has changed. Update the anchor in\n` +
      `  src/transform-export.mjs — do not skip the transform.`,
    );
  }
  return src.replace(pattern, replace);
}

/** Controls the export builds from <div onClick>, which have no keyboard behaviour. */
const CONTROLS = [
  { handler: 'goHome', attrs: 'role="button" tabindex="0"' },
  { handler: 'chip.onClick', attrs: 'role="button" tabindex="0"' },
  { handler: 'guide.player.prev', attrs: 'role="button" tabindex="0" aria-label="Previous step"' },
  { handler: 'guide.player.next', attrs: 'role="button" tabindex="0" aria-label="Next step"' },
  { handler: 'guide.player.playAll', attrs: 'role="button" tabindex="0" aria-label="{{ guide.player.playLabel }}"' },
  { handler: 'nx.open', attrs: 'role="button" tabindex="0"' },
];

export function transformGuide(src) {
  let s = src;

  // --- class hooks the responsive layer targets -------------------------------
  s = edit(s, {
    name: 'stage frame hook',
    pattern: /<div style="flex:1;min-width:0;display:flex;flex-direction:column;border-right:1px solid var\(--20\)">/,
    replace: '<div class="lsa-stage-frame" style="flex:1;min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--20)">',
  });
  s = edit(s, {
    name: 'step figure hook',
    pattern: /<figure style="margin:28px 0 0">/,
    replace: '<figure class="lsa-step-figure" style="margin:28px 0 0">',
  });

  // --- keyboard semantics on the div-based controls ---------------------------
  // The brand control puts style before onClick, so it needs its own anchor.
  s = edit(s, {
    name: 'brand control semantics',
    pattern: /<div style="(display:flex;align-items:center;gap:14px;cursor:pointer)" onClick="\{\{ goHome \}\}">/,
    replace: '<div style="$1" onClick="{{ goHome }}" role="button" tabindex="0" aria-label="Spatial Adjust Guides — back to all tasks">',
  });
  for (const { handler, attrs } of CONTROLS) {
    s = edit(s, {
      name: `control semantics: ${handler}`,
      pattern: new RegExp(`<div onClick="\\{\\{ ${handler.replace('.', '\\.')} \\}\\}"`),
      replace: `<div onClick="{{ ${handler} }}" ${attrs}`,
    });
  }

  // --- guide cards ------------------------------------------------------------
  // Both written and unwritten guides are actionable (an unwritten one can be requested),
  // so both are real buttons. Marking an actionable card aria-disabled would contradict
  // what activating it does.
  s = edit(s, {
    name: 'card semantics',
    pattern: /<div onClick="\{\{ task\.open \}\}"/,
    replace: '<div onClick="{{ task.open }}" role="{{ task.role }}" tabindex="{{ task.tabIndex }}" '
      + 'data-stub="{{ task.stub }}" data-title="{{ task.title }}" aria-label="{{ task.ariaLabel }}"',
  });

  // Difficulty dots are decorative; expose the value as text instead.
  s = edit(s, {
    name: 'difficulty dots text equivalent',
    pattern: /<span style="font-size:11px;letter-spacing:2px;color:var\(--30\)">\{\{ task\.dots \}\}<\/span>/,
    replace: '<span aria-hidden="true" style="font-size:11px;letter-spacing:2px;color:var(--30)">{{ task.dots }}</span>'
      + '<span class="lsa-sr-only">{{ task.difficultyLabel }}</span>',
  });

  // --- "On this page" tracker sticky offset ------------------------------------
  // The export sticks the section tracker 742px from the top of the viewport. That offset
  // only makes sense while the walkthrough stage is on screen; by the time the tracker's
  // own row is reached the stage has scrolled away, so the tracker ends up stranded near
  // the bottom of the window for the whole length of the guide — which is where it is least
  // useful and looks broken. The site header is sticky at 65px, so park it just below that.
  s = edit(s, {
    name: 'section tracker sticky offset',
    pattern: /<aside style="position:sticky;top:742px;/,
    replace: '<aside class="lsa-toc" style="position:sticky;top:89px;',
  });

  // --- step announcements -----------------------------------------------------
  // The camera move that conveys a step change is invisible to assistive tech.
  s = edit(s, {
    name: 'live region',
    pattern: /<div style="padding:16px 20px;border-top:1px solid var\(--20\)">/,
    replace: '<div style="padding:16px 20px;border-top:1px solid var(--20)">\n'
      + '              <div class="lsa-sr-only" aria-live="polite" aria-atomic="true">{{ guide.player.announcement }}</div>',
  });

  // --- logic: card metadata ---------------------------------------------------
  s = edit(s, {
    name: 'buildCard metadata',
    pattern: /(const live = !!\(t\.key && GUIDES\[t\.key\]\);)/,
    replace: `$1
    const _saRole = 'button';
    const _saLabel = live
      ? t.title + ' — ' + t.minutes + ', difficulty ' + t.difficulty + ' of 3'
      : t.title + ' — not written yet. Activate to request it.';`,
  });
  s = edit(s, {
    name: 'buildCard returned fields',
    pattern: /(\n\s*)(dots: '●'\.repeat\(t\.difficulty\) \+ '○'\.repeat\(3 - t\.difficulty\),)/,
    replace: `$1$2$1difficultyLabel: 'Difficulty ' + t.difficulty + ' of 3',$1stub: live ? 'false' : 'true',$1role: _saRole,$1tabIndex: 0,$1ariaLabel: _saLabel,`,
  });

  // --- logic: announcement string ---------------------------------------------
  s = edit(s, {
    name: 'player announcement',
    pattern: /(counter: 'Step ' \+ \(pi \+ 1\) \+ ' of ' \+ steps\.length)/,
    replace: `$1,
        announcement: 'Step ' + (pi + 1) + ' of ' + steps.length + ': ' + (steps[pi] ? steps[pi].title : '')`,
  });

  // --- logic: instrumentation hooks -------------------------------------------
  // Guarded so a missing analytics layer can never break the guide.
  s = edit(s, {
    name: 'track guide_opened',
    pattern: /(open\(key\) \{\n\s*this\.stopTimer\(\);)/,
    replace: `$1
    if (typeof window !== 'undefined' && window.__saTrack) {
      window.__saTrack('guide_opened', { key: key, steps: GUIDES[key] ? GUIDES[key].steps.length : 0 });
    }`,
  });
  s = edit(s, {
    name: 'track step_advanced',
    pattern: /(setPlayerStep = \(i\) => \{\n\s*this\.stopTimer\(\);)/,
    replace: `$1
    if (typeof window !== 'undefined' && window.__saTrack) {
      const _g = GUIDES[this.state.guideKey];
      const _n = _g ? _g.steps.length : 0;
      window.__saTrack('step_advanced', { key: this.state.guideKey, step: i + 1, total: _n });
      if (_n && i === _n - 1) window.__saTrack('guide_completed', { key: this.state.guideKey, steps: _n });
    }`,
  });
  s = edit(s, {
    name: 'track play_all_used',
    pattern: /(togglePlayAll = \(\) => \{)/,
    replace: `$1
    if (typeof window !== 'undefined' && window.__saTrack && !this.state.playing) {
      const _g = GUIDES[this.state.guideKey];
      if (_g) window.__saTrack('play_all_used', { key: this.state.guideKey, steps: _g.steps.length });
    }`,
  });
  // --- logic: URL routing -----------------------------------------------------
  // The export keeps the open guide purely in component state, so every guide shares one
  // URL. Two consequences for a site whose whole purpose is being shared: you cannot link
  // anyone to a specific guide, and the browser Back button leaves the site instead of
  // returning to the catalog. Hash routing fixes both without touching the runtime.
  s = edit(s, {
    name: 'routing: push hash on open',
    pattern: /(open\(key\) \{)/,
    replace: `$1
    if (typeof location !== 'undefined' && location.hash !== '#/' + key) {
      history.pushState({ saGuide: key }, '', '#/' + key);
    }`,
  });
  s = edit(s, {
    name: 'routing: clear hash on goHome',
    pattern: /(goHome: \(\) => \{ this\.stopTimer\(\); this\.setState\(\{ guideKey: null, playing: false \}\); \})/,
    replace: `goHome: () => {
        this.stopTimer();
        this.setState({ guideKey: null, playing: false });
        if (typeof location !== 'undefined' && location.hash) {
          history.pushState({ saGuide: null }, '', location.pathname + location.search);
        }
      }`,
  });
  s = edit(s, {
    name: 'routing: honour the URL on load and on back/forward',
    pattern: /(window\.addEventListener\('scroll', this\._onScroll, \{ passive: true \}\);)/,
    replace: `$1

    // Drive state from the URL, so deep links work and Back returns to the catalog
    // rather than leaving the site.
    this._applyRoute = () => {
      const key = (location.hash || '').replace(/^#\\//, '');
      if (key && GUIDES[key]) {
        if (this.state.guideKey !== key) {
          this.stopTimer();
          this.setState({ guideKey: key, playerStep: 0, prevStep: 0, playing: false, activeToc: 'walkthrough' });
        }
      } else if (this.state.guideKey) {
        this.stopTimer();
        this.setState({ guideKey: null, playing: false });
      }
    };
    this._applyRoute();
    window.addEventListener('popstate', this._applyRoute);`,
  });
  s = edit(s, {
    name: 'routing: detach listener on unmount',
    pattern: /(if \(this\._onScroll\) window\.removeEventListener\('scroll', this\._onScroll\);)/,
    replace: `$1
    if (this._applyRoute) window.removeEventListener('popstate', this._applyRoute);`,
  });


  return s;
}
