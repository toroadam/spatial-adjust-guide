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

  // 6. The "same ET" claim, which is wrong on both algorithms. The guide tells the reader that
  //    the weather strip's ET is "the same ET that drives the calculation", and asks them to
  //    verify a guide by checking Calculation ET against it. Neither holds:
  //
  //      site/src/app/spatial-adjust/services/sa-algorithm.service.ts:41
  //        calculateSuggestedPercentAdjust(..., currentEt: number = null)
  //
  //    `currentEt` is accepted and never read. Neither branch of the switch uses it, and the
  //    only caller — sa-dashboard.component.ts:576 — passes four arguments, so it is always
  //    null. Option 1 (`calculateSimple`) is targetVwc / actualVwc × the percent adjust Lynx
  //    holds: no ET term at all. Option 2 (`calculateDeltaPlusTodayEt`) does not calculate
  //    anything client-side — it looks up a server-computed `suggestedPercentAdjust` by station
  //    name. So on Option 1 no ET enters the number, and on Option 2 the ET that did is the
  //    server's, applied before the page ever loaded.
  //
  //    This matters because the second one is a VERIFY step: it asks the reader to confirm they
  //    succeeded by comparing two figures that are not required to agree. A reader whose numbers
  //    differ concludes they did something wrong and starts undoing correct work.
  s = edit(s, {
    name: 'ET claim: verify step comparing Calculation ET to the weather strip',
    pattern: /Calculation ET under the filter tabs matches the ET shown in the weather strip\./,
    replace: 'Calculation ET under the filter tabs is the figure the calculation used. '
      + 'The weather strip reports current conditions separately, so do not expect the two to agree.',
  });

  s = edit(s, {
    name: 'ET claim: weather strip described as driving the calculation',
    pattern: /today\\u2019s ET and precipitation — the same ET that drives the calculation\./,
    replace: 'today\\u2019s ET and precipitation. It reports conditions; it is not where the '
      + 'suggested percentages come from. Option 1 uses no ET at all, and Option 2\\u2019s figure is '
      + 'calculated before the page loads.',
  });

  // 7. When "Pushed Today" lets go. The guide correctly says a pushed station is held back for
  //    the rest of the day, but never says when the day ends, and the rule is not the one a
  //    reader would assume:
  //
  //      site/src/app/spatial-adjust/utils/spatial-adjust.util.ts:11  isStationPushable()
  //        -> site/src/app/common/utils/date.util.ts:81  isUtcDateAtLeastOneDayAgoLocally()
  //           localDate.startOf('day') < localToday.startOf('day')
  //
  //    Both sides are floored to the start of the day in the COURSE's local offset, so a station
  //    becomes available again at local midnight — not 24 hours after it was pushed. Push at
  //    11:58 PM and it is selectable two minutes later. Worth one sentence because the natural
  //    assumption is a rolling day, and acting on that assumption double-adjusts a head.
  //
  //    Note also SPATIAL_ADJUST.PUSHED_IN_LAST_N ("Pushed in last 24H"), which is present in all
  //    eleven IntelliDash catalogues and referenced by no code. If it is ever wired up it will
  //    state the wrong rule.
  s = edit(s, {
    name: 'pushed-today reset boundary',
    pattern: /is there to stop you adjusting the same head twice in a day\./,
    replace: 'is there to stop you adjusting the same head twice in a day. '
      + 'That hold releases at midnight where the course is, not 24 hours after the push.',
  });

  // --- two guides for features the corpus never covered ------------------------
  // An audit of IntelliDash's 108 user-facing Spatial Adjust strings against the 24 guides found
  // four features with no coverage. Two of them are covered here. Both were previously
  // unwritable because the reproduction had no control to point a figure at — the Over/Under
  // options dialog and the scan-data banner are added by src/transform-app.mjs, which is what
  // makes these guides possible.
  //
  // They live in a transform rather than in the export for the usual reason: a re-export would
  // discard them. They should be authored properly in Core Design at the next content pass, at
  // which point these two edits should be deleted rather than left to collide.

  s = edit(s, {
    name: 'new guide bodies',
    pattern: /(Object\.assign\(GUIDES, \{\n)/,
    replace: `$1  'request-scan-data': {
    category: 'TROUBLESHOOTING', title: 'Get fresh scan data', minutes: '3 minutes', difficulty: 2,
    where: 'Toolbar',
    summary: 'A stale course is not something you have to wait out. Request a new TurfRad scan, and reload when it lands.',
    before: [
      'When a scan is not current the calculation still runs — it runs on a modelled value carried forward from the last scan and the weather since, shown in grey italics.'
    ],
    steps: [
      { title: 'Read the scan date before anything else', fig: 'tableTop', t: [900, 32],
        body: 'Every station row carries the date its reading was captured. One stale row is a station; a column of stale dates is the whole course, and that is a supply problem rather than a settings problem.',
        caption: 'Scan dates sit beside the station name in the table.' },
      { title: 'Request the latest scan', fig: 'toolbarR', t: [1793, 32],
        body: 'The circular-arrow button in the toolbar’s right-hand group is Request latest scan data. It asks TurfRad for a new scan; it does not reload the dashboard, and it does not change a single calculation setting.',
        caption: 'Request latest scan data, between the pushed-today counter and the gear.',
        tipLabel: 'Note.', tip: 'This button and Reload Data are two different things. One asks for new data; the other brings data that has already arrived into the page.' },
      { title: 'It queues, it does not block', fig: 'toolbarR', t: [1793, 32],
        body: 'The request is queued and you are told so: retrieval may take several minutes, and you are notified when it is ready. You can carry on reading the table while it runs — nothing is frozen and nothing is lost if you navigate away.',
        caption: 'A queued request confirms immediately; the data arrives later.' },
      { title: 'Reload when the banner appears', fig: 'full', dialog: 'dataready', t: [960, 120],
        body: 'When the scan lands, a banner says so. Reload Data pulls it into the dashboard and every suggestion recalculates against the new readings. Dismiss closes the banner and leaves you on the data you already had — the new scan is not thrown away, it is simply not loaded yet.',
        caption: 'The banner offers Reload Data or Dismiss.',
        tipLabel: 'Careful.', tip: 'Dismissing is not declining. The next reload picks the new scan up.' },
      { title: 'If the request will not queue', fig: 'dlgDiag', dialog: 'diagnostics', t: [752, 455],
        body: 'A failed request says so straight away rather than silently doing nothing. If it keeps failing, the diagnostics dialog reports whether the organisation has TurfRad access and whether it has scan data at all — a course-wide problem is almost always there rather than in your settings.',
        caption: 'Diagnostics: TurfRad access, scan data, last scan date.' }
    ],
    verify: [
      'You know the toolbar can request a scan, not only display the last one.',
      'You can tell Request latest scan data from Reload Data.',
      'You know Dismiss leaves the dashboard on the data it already had.'
    ]
  },
  'filter-adjustments': {
    category: 'REVIEW & APPLY', title: 'Filter by % Adj.', minutes: '3 minutes', difficulty: 2,
    where: 'Table toolbar',
    summary: 'The Over/Under filter finds the extremes at both ends at once. It is not a range, and reading it as one will mislead you.',
    before: [
      'The filter reads the suggested percentage, and only for stations that are enabled. A disabled station never appears in it however extreme its number.'
    ],
    steps: [
      { title: 'Read the two tabs', fig: 'tableTop', t: [1148, 414],
        body: 'All Stations carries the full count. Beside it, the Over/Under tab carries the count of stations the filter currently catches. Until you set a filter that count is a dash and the tab does nothing — it is not broken, there is simply nothing to show yet.',
        caption: 'Two tabs: All Stations, and the Over/Under count.' },
      { title: 'Open the options', fig: 'tableTop', t: [1330, 464],
        body: 'The link to the right of the table toolbar states the thresholds currently in force — % ADJ. OVER 200%, UNDER 10% — so you can read the filter without opening it. Clicking it opens Over/Under Options.',
        caption: 'The link doubles as a readout of the current thresholds.' },
      { title: 'Set the two ends independently', fig: 'dlgSmall', dialog: 'filter', t: [960, 470],
        body: 'Over accepts 0 to 300 and defaults to 200. Under accepts 0 to 100 and defaults to 10. Each has its own checkbox, so you can run one end without the other — Over alone to find the stations asking for far too much, Under alone to find the ones asking for almost nothing.',
        caption: 'Over/Under Options. Each threshold has its own checkbox.' },
      { title: 'It catches both extremes, not a band', fig: 'table', tableFilter: 'filtered', t: [1297, 414],
        body: 'A station is caught if its suggestion is above the Over value OR below the Under value. With 200 and 10 set you get everything over 200 percent and everything under 10 percent — and nothing in between. It is an outlier finder. Reading it as “between 10 and 200” gives you exactly the stations it is not showing you.',
        caption: 'The filtered tab: the extremes at both ends, not the middle.',
        tipLabel: 'Why it matters.', tip: 'These are the two lists worth a second look before a push: the ones about to get a great deal of water, and the ones about to get almost none.' },
      { title: 'Exclude Zeros belongs to Under', fig: 'dlgSmall', dialog: 'filter', t: [960, 520],
        body: 'Exclude Zeros is greyed out until Under is enabled, because a zero is below any under-threshold and the option means nothing without one. Tick it and genuine zeros drop out of the filter, leaving the stations that asked for a little rather than the ones that asked for nothing. Your thresholds are saved to your own user preferences, not to the site.',
        caption: 'Exclude Zeros is disabled until Under is on.',
        tipLabel: 'Not the same setting.', tip: 'Settings › Minimum Threshold has its own Exclude Zeros. That one changes what gets written to Lynx at push time. This one only changes which rows you are looking at.' }
    ],
    verify: [
      'You can state that the filter is an OR across both ends, not a range.',
      'You know the Over/Under count reads as a dash until a filter is set.',
      'You know which Exclude Zeros changes the push and which only changes the view.'
    ]
  },
`,
  });

  s = edit(s, {
    name: 'new guide cursor targets',
    pattern: /(Object\.assign\(TARGETS, \{\n)/,
    replace: `$1  'request-scan-data': [P.moisture, P.refresh, P.refresh, P.refresh, P.diagBox],
  'filter-adjustments': [P.tabAll, P.filterLink, P.filterLink, P.tabOver, P.filterLink],
`,
  });

  s = edit(s, {
    name: 'catalogue entry: request-scan-data',
    pattern: /(\{ key: 'push-failures', title: 'Push failures', minutes: '3 MIN', difficulty: 3, summary: 'Reading the failure count and retrying safely\.' \})/,
    replace: `$1,
    { key: 'request-scan-data', title: 'Get fresh scan data', minutes: '3 MIN', difficulty: 2, summary: 'Request a new TurfRad scan rather than waiting for one.' }`,
  });

  s = edit(s, {
    name: 'catalogue entry: filter-adjustments',
    pattern: /(\{ key: 'verify-results', title: 'Verify results', minutes: '3 MIN', difficulty: 2, summary: 'Confirming Lynx accepted every adjustment\.' \})/,
    replace: `$1,
    { key: 'filter-adjustments', title: 'Filter by % Adj.', minutes: '3 MIN', difficulty: 2, summary: 'Find the outliers at both ends before you push.' }`,
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


  // 8. Target Profiles is not a "design concept" any more, and the guides should stop saying so.
  //    Documenting ahead of ship is deliberate here — this is a pilot, and the expectation is
  //    that dev features reach production before the guides do. So the disclaimer is NOT there to
  //    warn the reader off; it is there to be accurate, and it currently is not:
  //
  //      "The tab exists in the codebase as a commented-out placeholder"
  //
  //    It is commented out on develop (an internal commit, an internal work item) but implemented on
  //    an unmerged feature branch under an internal work item — model, icons, styling, i18n key,
  //    and client plus server API integration as of an internal commit. Calling that a placeholder
  //    undersells a feature someone is actively building, and it is the kind of claim that ages
  //    into a lie the moment the branch merges.
  //
  //    What the reader gains instead: a heads-up that the shipped tab lists five named slots, so
  //    a screen that does not look like these figures is expected rather than a fault. The
  //    figures themselves still disagree with the implementation — three cards with ACTIVE badges
  //    versus a five-row table with Last Updated, Update from Current and Apply Profile — and no
  //    disclaimer fixes that. It needs the guides reconciling once an internal work item merges (an internal work item).
  //    The ticket numbers stay in this comment and out of the prose; a superintendent does not
  //    care which work item it was.
  s = edit(s, {
    name: 'target profiles disclaimer: commented-out placeholder claim',
    pattern: /Target Profiles is a design concept\. The tab exists in the codebase as a commented-out placeholder and is not reachable in the shipping build\./g,
    replace: 'Target Profiles is still in development and is not in the shipping build yet. '
      + 'The screens here show a proposed design; the tab being built lists five named profile '
      + 'slots, so what you see on your own screen may differ.',
    expected: 3,
  });

  s = edit(s, {
    name: 'target profiles disclaimer: placeholder claim, walkthrough variant',
    pattern: /Target Profiles is a design concept\. The tab exists in the codebase as a placeholder and is not reachable in the shipping build — the screens below show the proposed behaviour\./,
    replace: 'Target Profiles is still in development and is not in the shipping build yet — the '
      + 'screens below show a proposed design, which the tab being built does not yet match.',
  });

  s = edit(s, {
    name: 'target profiles catalogue card subtitle',
    pattern: /Concept — saved sets of station targets\./,
    replace: 'In development — saved sets of station targets.',
  });

  // 9. The diagnostics dialog does not open by clicking the logo. It needs a modifier chord, and
  //    the guide sends a reader to click plainly — in the middle of troubleshooting a failed
  //    push, which is the worst moment to hand someone a gesture that does nothing.
  //
  //      site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts:290
  //        protected onShowDiagnostics(event: MouseEvent) {
  //            if (!this.hasFailedToLoadLynxData && this.lynxProxyService.currentLynxCloudCourseInfo == null) { return; }
  //            if (event.shiftKey && event.altKey) { this.showDiagDlg = true; }
  //        }
  //
  //    Two gates, not one: Shift AND Alt held while clicking, and it returns early unless Lynx
  //    data actually failed to load. The second is worth stating rather than hiding — a reader who
  //    tries the chord on a healthy dashboard gets nothing and concludes the guide is wrong again.
  //
  //    The corpus already documents "Soil Factor Editor, opened with Shift + Alt on the toolbar
  //    gear", so the authors knew this product hides things behind that chord; this one was just
  //    written from the wrong assumption. Found by the full-inventory check: eight diagnostics
  //    labels had no product backing, and trying to harvest them live is what exposed the trigger.
  s = edit(s, {
    name: 'diagnostics dialog trigger',
    pattern: /open the diagnostics dialog by clicking the Spatial Adjust logo\./,
    replace: 'open the diagnostics dialog by holding Shift + Alt and clicking the Spatial Adjust logo. '
      + 'It only opens once Lynx data has failed to load, which is exactly when you would want it — '
      + 'on a healthy dashboard the chord does nothing.',
  });

  return s;
}
