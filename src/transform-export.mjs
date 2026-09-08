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

  // --- off-stage cursor on calculation-settings step 1 -------------------------
  // Every guide is mapped: seven in the `const TARGETS` literal and the other seventeen in
  // an `Object.assign(TARGETS, {...})` further down. One entry places the cursor outside
  // its own figure. Step 1 targets `P.gear` at x=1836, but the step's crop is `dlgWide`,
  // which frames x 490-1430. camera() only pans vertically to keep a target in view, so the
  // gear resolves to tx=1133 on a 792px stage and the cursor is drawn off the right edge.
  //
  // The figure for this step already shows the dialog open on Calculation, so the gear has
  // been clicked by the time it renders. `P.menuCalc` is the Calculation tab inside that
  // dialog — in frame, and what "on the Calculation tab" actually refers to.
  s = edit(s, {
    name: 'calculation-settings step 1 cursor in frame',
    pattern: /('calculation-settings': \[)P\.gear(, P\.maxAmount, P\.refAmount, P\.cropCoeff, P\.saveChanges\])/,
    replace: '$1P.menuCalc$2',
  });

  // --- factual corrections, verified against the IntelliDash source ------------
  // Text claims that a reader would act on and that the product contradicts. Each was
  // checked against the shipping code, not against the recreation. These belong in Core
  // Design at source; until they are fixed there, they are corrected here so the published
  // site is not wrong, and each anchor fails the build if the sentence changes upstream.
  // See docs/text-corrections.md for the evidence behind every one.

  // 1. Algorithm naming. The guide calls the two methods "Simple" and "the default method",
  //    which are the enum names (SaAlgorithm.Simple / DeltaPlusTodayEt). The dropdown is
  //    built from ALGO_SIMPLE and ALGO_DELTA_PLUS_TODAY_ET, which render as "Option 1" and
  //    "Option 2" in en-us.json and in all ten other locales. A reader hunting the dropdown
  //    for "Simple" finds nothing. The descriptive names are kept as prose, because
  //    "Option 1 multiplies the percent adjust Lynx holds" is unreadable on its own, but
  //    every mention is now tied to the label actually on screen.
  s = edit(s, {
    name: 'algorithm names: before list',
    pattern: /'The algorithm selector is deliberately hidden in production unless the site is already set to Simple\.',\n      'The default is the delta-plus-today\\u2019s-ET method\.'/,
    replace: `'The dropdown labels the two methods Option 1 and Option 2, and describes neither.',\n      'The selector is hidden in production unless the site is already set to Option 1.',\n      'The default is Option 2, the delta-plus-today’s-ET method.'`,
  });

  s = edit(s, {
    name: 'algorithm names: selector step',
    pattern: /the persisted algorithm is already Simple, so most users never see it\./,
    replace: 'the persisted algorithm is already Option 1, so most users never see it. '
      + 'The dropdown offers only Option 1 and Option 2; nothing in the product says what either one does.',
  });

  s = edit(s, {
    name: 'algorithm names: delta step title',
    pattern: /title: 'Delta plus today\\u2019s ET — the default'/,
    replace: `title: 'Option 2 — delta plus today’s ET, the default'`,
  });

  s = edit(s, {
    name: 'algorithm names: simple step title',
    pattern: /title: 'Simple — ratio of target to measured'/,
    replace: `title: 'Option 1 — ratio of target to measured'`,
  });

  s = edit(s, {
    name: 'algorithm names: simple step body',
    pattern: /body: 'Simple multiplies the percent adjust Lynx currently holds/,
    replace: `body: 'Option 1 multiplies the percent adjust Lynx currently holds`,
  });

  s = edit(s, {
    name: 'algorithm names: simple step caption',
    pattern: /caption: 'With Simple selected, the two amount fields are disabled\.'/,
    replace: `caption: 'With Option 1 selected, the two amount fields are disabled.'`,
  });

  s = edit(s, {
    name: 'algorithm names: simple step tip',
    pattern: /tip: 'Because Simple scales the current Lynx value/,
    replace: `tip: 'Because Option 1 scales the current Lynx value`,
  });

  s = edit(s, {
    name: 'algorithm names: cap comparison',
    pattern: /body: 'The default method flattens everything above the daily maximum onto one number\. Simple has no ceiling/,
    replace: `body: 'Option 2 flattens everything above the daily maximum onto one number. Option 1 has no ceiling`,
  });

  s = edit(s, {
    name: 'algorithm names: verify list',
    pattern: /'You know why Max Amount is greyed out under Simple\.'/,
    replace: `'You know why Max Amount is greyed out under Option 1.'`,
  });

  // 2. Unit-of-measure safety claim. The guide reassures the reader that switching units
  //    changes only the displayed number. It does not. sa-settings-dlg converts mm to the
  //    user's unit in setSettingsToUserUnits(), which runs once when settings load. The
  //    Units of Measure dropdown is a plain [(ngModel)] on userPrefs.unitsSystem with no
  //    change handler, so nothing re-converts the amounts already on the Calculation tab.
  //    onSave() then calls setSettingsToSaveUnits() unconditionally, which reads the new
  //    unitsSystem and applies convertInchesToMm to a value still expressed in millimetres.
  //    Metric to imperial therefore multiplies the stored Max Amount and Lynx Reference
  //    Amount by 25.4. This is a reassurance on a setting that feeds irrigation output, so
  //    it is the most consequential wrong sentence in the guides.
  s = edit(s, {
    name: 'unit switch: display conversion timing',
    pattern: /body: 'The stored amounts are millimetres\. Switching to imperial converts them to inches for editing, with two decimal places and a hundredth-of-an-inch step; metric gets one decimal place and a tenth-of-a-millimetre step\.'/,
    replace: `body: 'The stored amounts are millimetres. Switching to imperial shows them in inches, with two decimal places and a hundredth-of-an-inch step; metric gets one decimal place and a tenth-of-a-millimetre step. That conversion runs when the dialog opens, not when you change the setting.'`,
  });

  s = edit(s, {
    name: 'unit switch: safety claim',
    pattern: /tipLabel: 'Worth knowing\.', tip: 'Changing the unit system does not change the underlying values — only the number you see and the increment you nudge it by\.'/,
    replace: `tipLabel: 'Check after switching.', tip: 'Changing Units of Measure and saving in the same visit does not re-convert the amounts already on the Calculation tab — they are saved as though they were already in the new unit, which rescales them by 25.4. After a unit change, save, then reopen Settings and check Max Amount and Lynx Reference Amount before you push anything.'`,
  });

  // 3. Moisture band defaults. The guide gives the middle boundary as 16, which is the
  //    Colliers dataset's saved user preference, not the product default. sa-dash-map
  //    falls back to `value?.range2Boundary || 19` when the user has none, so a fresh
  //    account sees 0-5, 6-19, 20-30, above 30. The boundaries stay user-configurable and
  //    the guide already says so; only the stated default was wrong. The two sentences use
  //    different dash encodings in the export, so they need separate anchors.
  s = edit(s, {
    name: 'moisture band defaults: dashboard caption',
    pattern: /Bands default to 0–5, 6–16, 17–30 and above 30 percent\./,
    replace: 'Bands default to 0–5, 6–19, 20–30 and above 30 percent.',
  });

  s = edit(s, {
    name: 'moisture band defaults: map-navigation body',
    pattern: /Four bands by default: 0\\u20135, 6\\u201316, 17\\u201330, and above 30 percent\./,
    replace: 'Four bands by default: 0–5, 6–19, 20–30, and above 30 percent.',
  });

  // 4. A sentence with words missing. "If the threshold is set to zero the suggestion at
  //    push time" has no subject and no verb where it needs them, and the reader has to guess
  //    which of the two below-threshold options is being described. Its siblings name the
  //    option exactly — "Set to zero when pushed to Lynx converts small adjustments into
  //    zeros" — so the intended meaning is not in doubt, only the grammar. Repaired using the
  //    product's own label so the sentence points at a control the reader can find.
  //
  //    This one matters more than a typo: it is the paragraph explaining why the table and
  //    the push dialog disagree, and it was translated into ten languages, each translator
  //    guessing differently at it.
  s = edit(s, {
    name: 'below-threshold option sentence has no subject',
    pattern: /If the threshold is set to zero the suggestion at push time, a small but genuine adjustment/,
    replace: 'With Set to zero when pushed to Lynx selected, a small but genuine adjustment',
  });

  // 5. Stale scans are not something the reader has to sit and wait for. Both of these told them
  //    the course simply "has no new data to work from", which is only true until they press the
  //    button. sa-main-toolbar has a "Request latest scan data" control that queues a TurfRad
  //    retrieval — it toasts "Retrieval may take several minutes. We'll notify you when it's
  //    ready", raises an update banner when the data lands, and offers Reload Data on it.
  //
  //    This is the one gap in the guides that is not merely missing but misleading: it tells a
  //    superintendent staring at a stale course that nothing can be done, on the morning they most
  //    need a fresh scan. There is no step-by-step guide for the workflow because the reproduced
  //    screen in SpatialAdjustApp.dc.html has no refresh button, no update banner and no filter
  //    dialog to point a figure at — see README > Known gaps.
  s = edit(s, {
    name: 'stale scans: name the refresh control',
    pattern: /If the whole course is stale, TurfRad has not delivered new scans — the feature has no new data to work from\./,
    replace: 'If the whole course is stale, TurfRad has not delivered new scans yet. '
      + 'Use Request latest scan data in the toolbar to queue a retrieval — it takes several '
      + 'minutes and notifies you when it lands, then Reload Data on the banner brings it in.',
  });

  s = edit(s, {
    name: 'stale scans: diagnostics step names the next action',
    pattern: /A course-wide problem is almost always here rather than in your settings\./,
    replace: 'A course-wide problem is almost always here rather than in your settings. '
      + 'If TurfRad access and scan data are both fine and only the date is old, request a fresh '
      + 'scan from the toolbar rather than waiting for one.',
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
