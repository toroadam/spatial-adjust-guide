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

import { edit } from './transforms/edit.mjs';
import { apply as applyCorrections } from './transforms/corrections.mjs';
import { apply as applyChangedSurfaces } from './transforms/changed-surfaces.mjs';
import { apply as applyOperationalContract } from './transforms/operational-contract.mjs';
import { apply as applyReviewFixes } from './transforms/review-fixes.mjs';

/** Controls the export builds from <div onClick>, which have no keyboard behaviour. */
const CONTROLS = [
  { handler: 'goHome', attrs: 'role="button" tabindex="0"' },
  { handler: 'chip.onClick', attrs: 'role="button" tabindex="0"' },
  { handler: 'guide.player.prev', attrs: 'role="button" tabindex="0" aria-label="Previous step"' },
  { handler: 'guide.player.next', attrs: 'role="button" tabindex="0" aria-label="Next step"' },
  { handler: 'guide.player.playAll', attrs: 'role="button" tabindex="0" aria-label="{{ guide.player.playLabel }}"' },
  { handler: 'nx.open', attrs: 'role="button" tabindex="0"' },
];

/** The label on the Target Profiles note callout and the badge on their catalogue tiles (§8 below).
 *  The note text follows the label, so neither note repeats it. */
const NEW_LABEL = 'New in IntelliDash';

/** The Target Profiles note, in the three guides that carry the short form (see §8 below). */
const TP_NOTE = 'The Target Profiles tab lists five named profile slots for each Lynx course. If your '
  + 'settings dialog has no Target Profiles entry, your IntelliDash has not yet been updated to the '
  + 'release that includes it.';

/** The Target Profiles note in the "Target profiles" walkthrough, which also names the columns. */
const TP_NOTE_WALKTHROUGH = 'The Target Profiles tab lists five profile slots for each Lynx course, '
  + 'named Spring, Summer, Fall, Winter and Tournament until you rename them, with Last Updated, '
  + 'Stations, Update from Current and Apply Profile columns. If your settings dialog has no Target '
  + 'Profiles entry, your IntelliDash has not yet been updated to the release that includes it.';

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
  //
  // IntelliDash is cited by path and line only, never quoted: this repository is public. Unless
  // a comment says otherwise, line numbers are at the production pin recorded in
  // docs/claims/sources.json (1aa4f28622cc3cc9637f0d61a438bf16bcf01924), with paths under
  // site/src/app/spatial-adjust/ unless given in full.

  // 1. Algorithm naming. The guide calls the two methods "Simple" and "the default method",
  //    which are the enum names (SaAlgorithm.Simple / DeltaPlusTodayEt). The dropdown is
  //    built from the ALGO_SIMPLE and ALGO_DELTA_PLUS_TODAY_ET labels
  //    (site/src/app/api/dash-user/dash-user-manager.service.ts:217-226), which render as
  //    "Option 1" and "Option 2" in en-us.json (site/src/assets/i18n/en-us.json:367-368) and in
  //    all ten other locales. A reader hunting the dropdown
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
  //    changes only the displayed number. It does not. The settings dialog converts the stored
  //    millimetres to the user's unit once, when its data loads (sa-settings-dlg.component.ts:322,
  //    :354-365). The Units of Measure dropdown is a plain two-way binding with no change handler
  //    (sa-settings-dlg.component.html:242), so nothing re-converts the amounts already on the
  //    Calculation tab. Saving then converts back unconditionally (ts:186-192, :416-427), reading
  //    the new unit and treating a value still expressed in millimetres as inches.
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

  // 3. Moisture band defaults. The guide gives the middle boundary as 16, which is the saved
  //    user preference in one of IntelliDash's demo datasets, not the product default. The map
  //    falls back to 5, 19 and 30 when the user has saved no boundaries
  //    (sa-dash-map.component.ts:48-50), so a fresh account sees 0-5, 6-19, 20-30, above 30. The boundaries stay user-configurable and
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
      + 'If TurfRad access and scan data are both fine and only the date is old, use Request latest '
      + 'scan data in the toolbar to fetch any scans TurfRad already holds rather than waiting for the '
      + 'next automatic fetch. It cannot make TurfRad scan, so if TurfRad has nothing newer the date '
      + 'will not change.',
  });

  // 6. The "same ET" claim, which is wrong on both algorithms. The guide tells the reader that
  //    the weather strip's ET is "the same ET that drives the calculation", and asks them to
  //    verify a guide by checking Calculation ET against it. Neither holds.
  //
  //    The function that picks the suggested percentage accepts a current-ET argument and never
  //    reads it: neither branch of its algorithm switch uses it (services/sa-algorithm.service.ts:43,
  //    :45-50), and its only caller passes four arguments, so it is always empty
  //    (sa-dashboard.component.ts:597). Option 1 is target VWC divided by measured VWC, times the
  //    percent adjust Lynx holds: no ET term at all (sa-algorithm.service.ts:58-60). Option 2 does
  //    not calculate anything client-side; it looks up a server-computed suggestion by station
  //    name (:62-65). So on Option 1 no ET enters the number, and on Option 2 the ET that did is the
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
  //    reader would assume. A station is pushable again once its last push falls on an earlier
  //    local calendar day than today (utils/spatial-adjust.util.ts:11-13, which calls
  //    site/src/app/common/utils/date.util.ts:81-93).
  //
  //    Both sides are floored to the start of the day in the COURSE's local offset, so a station
  //    becomes available again at local midnight — not 24 hours after it was pushed. Push at
  //    11:58 PM and it is selectable two minutes later. Worth one sentence because the natural
  //    assumption is a rolling day, and acting on that assumption double-adjusts a head.
  //
  //    Note also SPATIAL_ADJUST.PUSHED_IN_LAST_N ("Pushed in last 24H", site/src/assets/i18n/
  //    en-us.json:449), which is present in all eleven IntelliDash catalogues and referenced by no
  //    code. If it is ever wired up it will
  //    state the wrong rule.
  s = edit(s, {
    name: 'pushed-today reset boundary',
    pattern: /is there to stop you adjusting the same head twice in a day\./,
    replace: 'is there to stop you adjusting the same head twice in a day. '
      + 'That hold releases at midnight where the course is, not 24 hours after the push.',
  });

  // 12. "Verify results" teaches the four push phases in the wrong order, and opens on the one
  //     that is wrong. Its first step is titled "It reads Lynx first" and its body begins
  //     "Before writing anything". The product writes first. The push button hands the pending
  //     changes straight to the write loop with no read of any kind before it
  //     (components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts:255-269). The first
  //     progress state is the pushing step (services/sa-push-changes.service.ts:136-137), and the
  //     read of Lynx is requested only when the write loop completes, after every station has
  //     been written (:162-170).
  //
  //     So retrieving is phase two, and it is a read-BACK, not a baseline read. The guide's
  //     account is not merely misordered, it misstates the purpose of the phase: there is nothing
  //     to "compare against afterwards" because the comparison happens moments later, against the
  //     values just written. The first two steps swap places and their phase numbers with them;
  //     three, four and five keep the numbers they had, so the sequence now reads
  //     write -> read back -> compare -> retry.
  //
  //     The reproduction encoded the same error as a number: it drew the retrieving phase at 12%,
  //     which is what a phase-one read would show. It is 88%. Corrected in src/transform-app.mjs
  //     under "push progress: invented phase percentages become the computed ones", in the same
  //     pass, because a corrected caption beside an uncorrected figure is the failure this whole
  //     exercise exists to prevent.
  //
  //     The write-phase body originally kept the export's "slowest phase … a stalled counter here
  //     means the connection" sentence. The claims ledger marked it Wrong (verify-results/1/4):
  //     each write is sent without waiting for Lynx and the counter advances on a fixed
  //     per-station delay (services/sa-push-changes.service.ts:145-150, :206-211), so it cannot stall; a
  //     slow or silent Lynx shows in the read-back that follows. Corrected here rather than in
  //     src/transforms/corrections.mjs so the wrong sentence is never produced.
  s = edit(s, {
    name: 'verify-results push phase order',
    pattern: /\{ title: 'It reads Lynx first', fig: 'dlgMid', dialog: 'progress', pushState: 'fetching',\n(\s*)body: 'Before writing anything, Spatial Adjust retrieves the current percent adjustments from Lynx so it has something to compare against afterwards\. On a large course this is the slowest phase\.',\n\s*caption: 'Phase one: retrieving current values for comparison\.' \},\n\s*\{ title: 'Then it writes, station by station', fig: 'dlgMid', dialog: 'progress', pushState: 'running',\n\s*body: 'Stations are written in sequence with a short pause between each, and the progress line names which one it is on\. A stalled counter here means the connection, not the calculation\.',\n\s*caption: 'Phase two: writing, four of six\.' \},/,
    replace: (_m, i) =>
      `{ title: 'It writes first, station by station', fig: 'dlgMid', dialog: 'progress', pushState: 'running',\n`
      + `${i}body: 'Nothing is read before the push begins. Stations are written in sequence with a short pause between each, and the progress line names which one it is on. On a large course writing takes a while, at least a tenth of a second per station, but its counter runs on a fixed timer and does not wait for Lynx. If a run stalls, it stalls in the next phase, while Spatial Adjust waits for Lynx to answer.',\n`
      + `${i}caption: 'Phase one: writing, four of six.' },\n`
      + `${i.slice(0, -2)}{ title: 'Then it reads Lynx back', fig: 'dlgMid', dialog: 'progress', pushState: 'fetching',\n`
      + `${i}body: 'With the writing done, Spatial Adjust retrieves the current percent adjustments from Lynx. This is a read-back, not a baseline — it is collecting what Lynx actually holds now so the next phase has something to check the push against.',\n`
      + `${i}caption: 'Phase two: reading back what Lynx now holds.' },`,
  });

  //     The remaining two captions carry phase numbers that the swap above does not touch, so
  //     they are correct already — three is still comparing, four is still retrying. What is
  //     missing from four is the progress bar's behaviour, which is the most alarming thing in
  //     the whole sequence and is nowhere in the corpus. On a retry the step count goes back to
  //     zero and the total is recomputed for the failed stations alone before the retrying step
  //     is reported (services/sa-push-changes.service.ts:93-97).
  //
  //     The bar does not resume from 99% — it resets to 0% and the total is recomputed for the
  //     failed stations alone. A reader who has just watched a push reach 99% sees it collapse to
  //     zero, and the guide's own reassurance that a retry "is information rather than an error"
  //     is precisely what that reader will stop believing. Saying so is the difference between
  //     the reassurance landing and reading as false.
  s = edit(s, {
    name: 'retry resets the progress bar',
    pattern: /so a retry is information rather than an error\./,
    replace: 'so a retry is information rather than an error. '
      + 'The bar restarts at zero for the retry pass and counts only the failed stations, '
      + 'so a drop from nearly complete back to nothing is the retry beginning, not the push collapsing.',
  });

  //     "Push failures" shows the same retry figure one step after telling the reader that four
  //     of six stations are already live, so it hits the zero bar with even less warning. It gets
  //     the fact in its caption rather than a second copy of the explanation, because its own
  //     `next` list sends the reader to "Verify results" for the phase-by-phase account.
  s = edit(s, {
    name: 'push-failures retry caption states the reset',
    pattern: /caption: 'The automatic retry pass, before the failure is reported\.' \},/,
    replace: "caption: 'The automatic retry pass, before the failure is reported. "
      + "The bar restarts at zero and counts only the stations being retried.' },",
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
    summary: 'A course that has fallen behind TurfRad does not have to wait for the next automatic retrieval. Ask for the latest scan data TurfRad holds, and reload when it is ready.',
    before: [
      'When a scan is not current, what you see depends on the calculation option. Under Option 2 the calculation still runs, on a value modelled forward from the last scan and the weather since, and the reading is shown in grey italics with a calculator icon. Under Option 1 the station shows a dash in % Adj. and is left out of the push until a current scan arrives.'
    ],
    steps: [
      { title: 'Read the scan date before anything else', fig: 'tableTop', t: [900, 32],
        body: 'Every station row carries the date its reading was captured. One stale row is a station; a column of stale dates is the whole course, and that is a supply problem rather than a settings problem.',
        caption: 'Scan dates sit beside the station name in the table.' },
      { title: 'Request the latest scan', fig: 'toolbarR', t: [1793, 32],
        body: 'The circular-arrow button in the toolbar’s right-hand group is Request latest scan data. It asks Spatial Adjust to fetch the latest scan data TurfRad already holds, ahead of the next automatic retrieval. It does not order a new scan, it does not reload the dashboard, and it does not change a single calculation setting.',
        caption: 'Request latest scan data, between the pushed-today counter and the gear.',
        tipLabel: 'Note.', tip: 'This button and Reload Data are two different things. One asks for new data; the other brings data that has already arrived into the page.' },
      { title: 'It queues, it does not block', fig: 'toolbarR', t: [1793, 32],
        body: 'The request is queued and you are told so: retrieval may take several minutes, and you are notified when it is ready. You can carry on reading the table while it runs — nothing is frozen and nothing is lost if you navigate away.',
        caption: 'A queued request confirms immediately; the data arrives later.' },
      { title: 'Reload when the banner appears', fig: 'full', dialog: 'dataready', t: [960, 120],
        body: 'When the retrieval finishes, a banner says so, whether or not TurfRad had a newer scan. Reload Data pulls it into the dashboard and every suggestion recalculates against the new readings. Dismiss closes the banner and leaves you on the data you already had — the new scan is not thrown away, it is simply not loaded yet.',
        caption: 'The banner offers Reload Data or Dismiss.',
        tipLabel: 'Careful.', tip: 'Dismissing is not declining. The next reload picks the new scan up.' },
      { title: 'If the request will not queue', fig: 'dlgDiag', dialog: 'diagnostics', t: [752, 455],
        body: 'A failed request says so straight away rather than silently doing nothing. If it keeps failing, the diagnostics dialog reports whether the organisation has TurfRad access and whether it has scan data at all — a course-wide problem is almost always there rather than in your settings.',
        caption: 'Diagnostics: TurfRad access, scan data, last scan date.' }
    ],
    verify: [
      'You know the toolbar can fetch the latest scan data from TurfRad, not only display what was last retrieved.',
      'You can tell Request latest scan data from Reload Data.',
      'You know Dismiss leaves the dashboard on the data it already had.'
    ]
  },
  'filter-adjustments': {
    category: 'REVIEW & APPLY', title: 'Filter by % Adj.', minutes: '3 minutes', difficulty: 2,
    where: 'Table toolbar',
    summary: 'The Over/Under filter finds the extremes at both ends at once. It is not a range, and reading it as one will mislead you.',
    before: [
      'The filter reads the suggested percentage, and only for stations that are enabled. A disabled station is never caught by its own number, however extreme; it appears only as part of a paired row whose enabled partner is caught.'
    ],
    steps: [
      { title: 'Read the two tabs', fig: 'tableTop', t: [1148, 414],
        body: 'All Stations carries the full count. Beside it, the Over/Under tab carries the count of stations the filter currently catches. Until you set a filter that count is a dash and the tab does nothing — it is not broken, there is simply nothing to show yet.',
        caption: 'Two tabs: All Stations, and the Over/Under count.' },
      { title: 'Open the options', fig: 'tableTop', t: [1330, 464],
        body: 'The link below the two tabs, beside Bulk Adjust, states the thresholds currently in force — % ADJ. OVER 200%, UNDER 10% — so you can read the filter without opening it. Clicking it opens Over/Under Options.',
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

  // The last step of "Filter by % Adj." is "Exclude Zeros belongs to Under", and its cursor sat on
  // P.filterLink — the link that OPENS the filter dialog — rather than on the checkbox inside it,
  // pointing at a different control while the dialog it names was open on screen.
  //
  // The step already carried `t: [960, 520]`, the author's intent, but TARGETS wins over a step's
  // own `t` (see the target lookup in the player), so the inline value never applied. Fixed in
  // TARGETS, where the lookup actually reads from.
  //
  // Worth recording how this was landed, because measuring it directly does not work. A dialog is
  // laid out relative to the visible frame, and camera() derives that frame FROM the target — so
  // moving the target moves the dialog, and a coordinate measured under one framing is wrong under
  // the next. Three measured values in a row each missed by less than the one before, converging
  // rather than landing.
  //
  // What they converged ON is P.excludeZeros [840, 600]. The two Exclude Zeros controls are
  // different settings — this step's own tip is at pains to separate the filter's from Settings >
  // Minimum Threshold's — but both dialogs render centred in the same region, so the coordinate
  // serves both. Semantically distinct, geometrically the same spot.
  s = edit(s, {
    name: 'new guide cursor targets',
    pattern: /(Object\.assign\(TARGETS, \{\n)/,
    replace: `$1  'request-scan-data': [P.moisture, P.refresh, P.refresh, P.refresh, P.diagBox],
  'filter-adjustments': [P.tabAll, P.filterLink, P.filterLink, P.tabOver, P.excludeZeros],
`,
  });

  s = edit(s, {
    name: 'catalogue entry: request-scan-data',
    pattern: /(\{ key: 'push-failures', title: 'Push failures', minutes: '3 MIN', difficulty: 3, summary: 'Reading the failure count and retrying safely\.' \})/,
    replace: `$1,
    { key: 'request-scan-data', title: 'Get fresh scan data', minutes: '3 MIN', difficulty: 2, summary: 'Fetch the latest TurfRad scan data now rather than waiting for the next automatic retrieval.' }`,
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
      ? t.title + ' — ' + (t.newInIntelliDash ? '${NEW_LABEL}, ' : '') + t.minutes + ', difficulty ' + t.difficulty + ' of 3'
      : t.title + ' — not written yet. Activate to request it.';`,
  });
  s = edit(s, {
    name: 'buildCard returned fields',
    pattern: /(\n\s*)(dots: '●'\.repeat\(t\.difficulty\) \+ '○'\.repeat\(3 - t\.difficulty\),)/,
    replace: `$1$2$1difficultyLabel: 'Difficulty ' + t.difficulty + ' of 3',$1stub: live ? 'false' : 'true',$1role: _saRole,$1tabIndex: 0,$1ariaLabel: _saLabel,$1isNew: !!t.newInIntelliDash,`,
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


  // 8. The Target Profiles notes. The export calls the feature "a design concept" whose tab is a
  //    "placeholder … not reachable in the shipping build". An earlier pass replaced that with
  //    "still in development and is not in the shipping build yet", which the claims ledger then
  //    marked Wrong (creating-profiles, seasonal-profiles, updating-profiles and target-profiles,
  //    note/1 and note/2): at the IntelliDash production pin the settings dialog lists Target
  //    Profiles unconditionally (sa-settings-dlg.component.ts:55) and its pane renders
  //    (sa-settings-dlg.component.html:177-226). The entry is absent from every earlier release
  //    branch, so the feature is new rather than long-standing.
  //
  //    The callout now carries the label "New in IntelliDash." (see the 'note callout' edits
  //    below), and the notes say what the shipped tab holds, so a reader can match the screen to
  //    the guide. The last sentence covers a reader whose IntelliDash predates the release, and it
  //    stays true whichever release they are on. docs/text-corrections.md §11 gives the
  //    evidence; docs/claims/sources.json records the production pin and its confirmation. When
  //    the feature stops being new, or if the pin is ever re-pointed at a build without it,
  //    NEW_LABEL, TP_NOTE and TP_NOTE_WALKTHROUGH at the top of this file are the strings to change.
  //
  //    Tracker IDs are deliberately absent: this repository is public.
  s = edit(s, {
    name: 'target profiles disclaimer: commented-out placeholder claim',
    pattern: /Target Profiles is a design concept\. The tab exists in the codebase as a commented-out placeholder and is not reachable in the shipping build\./g,
    replace: TP_NOTE,
    expected: 3,
  });

  s = edit(s, {
    name: 'target profiles disclaimer: placeholder claim, walkthrough variant',
    pattern: /Target Profiles is a design concept\. The tab exists in the codebase as a placeholder and is not reachable in the shipping build — the screens below show the proposed behaviour\./,
    replace: TP_NOTE_WALKTHROUGH,
  });

  s = edit(s, {
    name: 'target profiles catalogue card subtitle',
    pattern: /Concept — saved sets of station targets\./,
    replace: 'New in IntelliDash — saved sets of station targets.',
    // The catalogue section is now authored as "Targets", so this legacy subtitle may be absent.
    expected: 0,
  });

  //    The note callout is labelled "Concept." in the export, a word that now contradicts every
  //    note it introduces. A guide carrying the newInIntelliDash flag (set on the four Target
  //    Profiles guides by src/transforms/corrections.mjs) gets the label "New in IntelliDash." and
  //    any other note gets "Note.", which the locale catalogues already translate. The callout is a
  //    role="note" landmark with an accent rule, so it reads as a banner ahead of step 1 rather
  //    than as part of the header. The note text says what the shipped tab holds and what a reader
  //    whose IntelliDash predates the release will see, so it follows the label without repeating it.
  s = edit(s, {
    name: 'note callout: banner label and role',
    pattern: /<div style="margin-top:24px;padding:16px 20px;border-radius:8px;background:var\(--05\);box-shadow:inset 0 0 0 1px var\(--20\);(font-size:14px;line-height:1\.6;color:var\(--60\))"><span style="font-weight:700;color:var\(--informative-03\)">Concept\.<\/span> \{\{ guide\.note \}\}<\/div>/,
    replace: '<div role="note" style="margin-top:24px;padding:16px 20px;border-radius:8px;background:var(--05);'
      + 'box-shadow:inset 0 0 0 1px var(--20),inset 4px 0 0 var(--informative-03);$1">'
      + '<span style="font-weight:700;color:var(--informative-03)">{{ guide.noteLabel }}</span> {{ guide.note }}</div>',
  });
  s = edit(s, {
    name: 'note callout: label in the guide view-model',
    pattern: /hasNote: !!g\.note, note: g\.note \|\| '',/,
    replace: `hasNote: !!g.note, note: g.note || '', noteLabel: g.newInIntelliDash ? '${NEW_LABEL}.' : 'Note.',`,
  });

  //    The catalogue tile carries the same label as a text badge above the title, so it does not
  //    rely on colour, and the card's accessible name includes it ('buildCard metadata' above):
  //    the card's aria-label replaces its content for a screen reader, so a badge outside the
  //    label would never be heard.
  s = edit(s, {
    name: 'catalogue tile: new in IntelliDash badge',
    pattern: /(\n(\s*))(<div style="font-size:17px;font-weight:700;line-height:1\.25;letter-spacing:-0\.2px;margin-bottom:8px;text-wrap:pretty">\{\{ task\.title \}\}<\/div>)/,
    replace: `$1<sc-if value="{{ task.isNew }}" hint-placeholder-val="{{ false }}">`
      + `<span style="display:inline-block;align-self:flex-start;margin-bottom:8px;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.5px;line-height:1.5;color:var(--informative-03);box-shadow:inset 0 0 0 1px var(--informative-03)">${NEW_LABEL}</span>`
      + `</sc-if>$1$3`,
  });

  // 9. The diagnostics dialog does not open by clicking the logo. It needs a modifier chord, and
  //    the guide sends a reader to click plainly — in the middle of troubleshooting a failed
  //    push, which is the worst moment to hand someone a gesture that does nothing.
  //
  //    The logo's click handler opens the dialog only while Shift and Alt are both held
  //    (components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts:293-299). It also
  //    does nothing until Spatial Adjust has either loaded the Lynx course or failed to load
  //    Lynx data (:294), so on a healthy dashboard the chord works a second or so after the page
  //    loads. An earlier version of this comment read that second gate backwards, as working only
  //    after a failure; the claims ledger caught it (docs/text-corrections.md §27).
  //
  //    The corpus already documents "Soil Factor Editor, opened with Shift + Alt on the toolbar
  //    gear", so the authors knew this product hides things behind that chord; this one was just
  //    written from the wrong assumption. Found by the full-inventory check: eight diagnostics
  //    labels had no product backing, and trying to harvest them live is what exposed the trigger.
  s = edit(s, {
    name: 'diagnostics dialog trigger',
    pattern: /open the diagnostics dialog by clicking the Spatial Adjust logo\./,
    replace: 'open the diagnostics dialog by holding Shift + Alt and clicking the Spatial Adjust logo. '
      + 'It opens on a healthy dashboard once Spatial Adjust has contacted Lynx, which happens a second '
      + 'or so after the page loads, and it also opens when Lynx data has failed to load.',
  });

  // 10. Two cursor targets in bulk-adjustments point at the wrong control.
  //
  //       'bulk-adjustments': [cell('cb', 1), P.bulkApply, P.bulkShift, cell('target', 1)]
  //
  //     Step 2 is titled "Open Bulk Adjust" and targeted P.bulkApply — the Apply button INSIDE
  //     the dialog, not the link that opens it. The animated cursor landed 327px below the
  //     BULK ADJUST link, on a station row, while the step told the reader to click the link.
  //     Step 4, "Apply to all", targeted a table cell rather than that Apply button.
  //
  //     Step 3 (P.bulkShift) is correct, so this is not an off-by-one across the array — two
  //     entries are individually wrong, which is why it survived review. Found by
  //     scripts/cursor-target.mjs: x matched the link exactly and y was out by 327, which is the
  //     signature of a wrong target rather than a scaling fault.
  s = edit(s, {
    name: 'bulk-adjustments cursor targets',
    pattern: /'bulk-adjustments': \[cell\('cb', 1\), P\.bulkApply, P\.bulkShift, cell\('target', 1\)\]/,
    // Step 4 is left as cell('target', 1) DELIBERATELY. Pointing it at P.bulkApply, which is
    // where the Apply button lives, rendered the cursor at x = -16 — off the left of a 792-wide
    // stage. P.bulkApply is presumably authored against a different figure crop from the one
    // step 4 uses, so the coordinate does not survive here. Off-stage is strictly worse than
    // on-stage-but-imprecise, so the change is reverted rather than kept for tidiness.
    replace: "'bulk-adjustments': [cell('cb', 1), P.bulkLink, P.bulkShift, cell('target', 1)]",
  });

  // 11. camera() frames the target vertically and not horizontally. It pans y to keep the target
  //     in view (the two `pad` tests) but fixes x at the figure's crop origin:
  //
  //       let x = Math.max(0, Math.min(fr.x, APP_W - frameW));
  //       let y = fr.y + (frameH - viewH) / 2;
  //       if (target[1] < y + pad) y = target[1] - pad;
  //       if (target[1] > y + viewH - pad) y = target[1] - viewH + pad;
  //
  //     So any step whose target sits outside its figure's horizontal crop renders the cursor off
  //     the stage entirely. Three steps did: "Set the two ends independently" and "Exclude Zeros
  //     belongs to Under" put it at x = 935 on a 792-wide stage, and "Read the scan date before
  //     anything else" at x = -162. The reader is told to look at a control and the pointer is
  //     not on screen.
  //
  //     Fixed by making x symmetric with y — same pad, same clamp. This is one structural bug
  //     rather than three bad coordinates, so it also prevents the next one: any future target
  //     outside its crop now pans into view instead of vanishing.
  //
  //     Found by scripts/cursor-target.mjs. The retired cursor.mjs reported these three too, but
  //     it modelled the coordinates wrongly, so its finding could not be trusted until the
  //     corrected check reproduced it.
  s = edit(s, {
    name: 'camera frames the target horizontally',
    pattern: /let x = Math\.max\(0, Math\.min\(fr\.x, APP_W - frameW\)\);/,
    // MINIMAL pan, with a much smaller margin than y uses. Reusing pad=60 horizontally re-cropped
    // 42 frames that were never broken, merely to give on-screen targets clearance — and on
    // "Filter by % Adj." that pushed the Over/Under dialog the step is describing out of view
    // entirely, trading an invisible cursor for the wrong screen. A frame is only adjusted when
    // the target genuinely falls outside it, and then only far enough to bring it in.
    replace: 'const xPad = 8;\n'
      + '  let x = Math.max(0, Math.min(fr.x, APP_W - frameW));\n'
      + '  if (target[0] < x + xPad) x = target[0] - xPad;\n'
      + '  if (target[0] > x + frameW - xPad) x = target[0] - frameW + xPad;\n'
      + '  x = frameW >= APP_W ? 0 : Math.max(0, Math.min(x, APP_W - frameW));',
  });

  // "Read Current against Changes" parked its cursor at P.pushRow [960, 358] — x inside the
  // Changes column but y in the gap between rows, so it landed on a station id and named neither
  // column. The step is about the two COLUMNS, so the cursor belongs on the Changes header at
  // [958, 229] (measured, not guessed): same column, top of the run of values the reader is being
  // asked to compare against Current.
  //
  // P.pushRow itself is left alone. "Push changes to Lynx" step 2 is "Review the two lists",
  // which is a region rather than a named control, and a row is the right thing to point at
  // there. Only this step is overridden.
  s = edit(s, {
    name: 'reviewing-changes step 2 points at the Changes column, not a row gap',
    pattern: /'reviewing-changes': \[P\.push, P\.pushRow, P\.pushOldRow/,
    replace: "'reviewing-changes': [P.push, [958, 229], P.pushOldRow",
  });

  // The settings rail now lists Target Profiles on every tab, as the product does (see "settings
  // rail always lists Target Profiles" in src/transform-app.mjs), so Preferences is the fourth
  // entry rather than the third. Its cursor target moves down one 58 px rail row with it; left at
  // [666, 508] it would land on Target Profiles. docs/text-corrections.md section 30.
  s = edit(s, {
    name: 'settings rail: Preferences cursor below Target Profiles',
    pattern: /menuPrefs: \[666, 508\]/,
    replace: 'menuPrefs: [666, 566]',
  });

  // --- click marker ------------------------------------------------------------
  // The click ring was a hard red. Red is Toro's brand colour (--base, rgb(225,24,55)), but in
  // THIS product it also carries meaning: the map paints a station's pin red when its reading
  // falls in the highest moisture band, and "Why is this station 0%?" is an entire guide about
  // red pins. A red ring pulsing over a map of red and green pins reads as product state rather
  // than as "the cursor clicked here", which is the one thing it exists to say.
  //
  // Blue carries no state in Spatial Adjust, and the design system already reserves
  // --informative-02 for informative rather than alarming — it is the focus-ring colour, so it
  // reads as interface chrome. Lighter too: a soft fill, a thinner stroke, and the peak opacity
  // dropped from 0.95 to 0.5 so the pulse sits over the control it points at instead of hiding it.
  s = edit(s, {
    name: 'click ring: red brand colour becomes a light blue pulse',
    pattern: /border:3px solid var\(--base\);/,
    replace: 'border:2px solid var(--informative-02); background:rgba(48,121,240,.14);',
  });

  s = edit(s, {
    name: 'click ring: softer peak opacity',
    pattern: /(scale\(0\.85\); opacity: )0\.95(; \})/,
    replace: '$10.5$2',
  });

  // Reduced motion renders the ring statically, so it holds its peak indefinitely rather than for
  // a few frames. At .9 that was a solid disc parked on the control.
  s = edit(s, {
    name: 'click ring: softer static opacity under reduced motion',
    pattern: /(\.lsa \.sa-ring \{ animation: none; transform: translate\(var\(--tx\), var\(--ty\)\); opacity: )\.9(; \})/,
    replace: '$1.5$2',
  });

  // --- per-concern modules ------------------------------------------------------
  // Each module under src/transforms/ is owned by one feature (see the module map in
  // docs/claims/README.md), so features can work in parallel without editing this file.
  // They run last, after every edit above, and in this order on purpose. corrections replaces
  // whole sentences first. changed-surfaces, operational-contract and review-fixes are additive,
  // and they anchor only on step titles and existing list items, never on body sentences, so
  // they compose with any body correction made before them.
  s = applyCorrections(s);
  s = applyChangedSurfaces(s);
  s = applyOperationalContract(s);
  s = applyReviewFixes(s);

  return s;
}
