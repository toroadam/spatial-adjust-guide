# Concept and beat sheet: the Spatial Adjust showcase film

**Plan:** the Spatial Adjust showcase film, phase 1 (brief and concept) · **Date:** 2026-10-20
**Brief:** [`brief.md`](brief.md) · **Episode config:** [`episode.json`](episode.json), seeded from the beat sheet below
**Gates:** SC-G1 (this concept), SC-TP (Target Profiles) and SC-CTA (end card) in
[`../approvals.md`](../approvals.md#showcase). Decided by the executor under owner direction 2026-10-19; for review in
person 2026-10-22.

## Logline

On a golf course the soil is never one moisture level, yet a whole Lynx program is adjusted by one percentage. In under
two minutes the film follows Spatial Adjust from a TurfRad scan, through the superintendent's target, to a percent
adjustment for every station and the push that hands it to Lynx.

## Premise: the chain

**TurfRad measures VWC → the superintendent sets a target → Spatial Adjust computes a percent adjust per station →
Lynx runs the water.**

Every beat is one link of that chain, in that order, so the film never becomes a tour of screens. The course is the
fictional Riverbend National ([`../brand/course.json`](../brand/course.json)) on the restyled map. Footage is captured
from IntelliDash Demo Mode where Demo Mode can show it; the guides' own recreation of the app covers what Demo Mode
cannot, chiefly the result of anything that writes. Cards are made in post by the pipeline.

## How the pipeline shapes the film

The film is cut by the video pipeline as delivered (`npm run video -- build`), which gives every episode the same
grammar. The beat sheet is timed to it, so its times are reachable without forking a tool:

- **Open (B0), 8.2 s:** the Spatial Adjust lockup (2.3 s), then the title card (5.9 s), whose series word the builder
  draws above the title. The plan's estimate of 3 s for the title is shorter than the builder's open.
- **Each link of the chain (B1-B7):** a typed chapter card, as long as the label needs (2.2-3.1 s here: typing at 50
  characters a second, then 1.5 s + 0.3 s per word), then the window shot cut from the take at the beat's cues. The
  camera floats the window and pushes in on the control being described; the chapter strip names all seven chapters.
- **Close (B8), 5.0 s:** the end card, held as the last frame. Its VO line has to finish 0.3 s after the card starts plus
  its length, inside 5.0 s.
- **Footage lengths** are sized from the pipeline's VO estimate (16.16 characters a second, after the lexicon), plus
  0.55 s of lead before each chapter's first cue and room for the action. Phase 3 replaces them with rendered VO
  lengths, and phase 4a with take timing.

## Beat sheet

Times are minutes:seconds of the finished film; **Dur** is seconds. Shot types: *type card*, *full-window float*,
*macro push-in*. Sources: *demo* (IntelliDash `/demo`), *recreation* (the guides' app recreation, captured from the
built guide site), *post* (made by the pipeline). Claim IDs come from the claims check in phase 2: VO and label claims here, and every item with its status and citation in [`claims-check.md`](claims-check.md).

| # | Chapter label | TC in | TC out | Dur | On-screen action | Shot type | Source | Guide keys | VO draft | Claim IDs |
|---|---|---|---|---|---|---|---|---|---|---|
| B0 | (title) | 0:00.0 | 0:08.2 | 8.2 | The Spatial Adjust lockup on the hero wall, then the title card: the series word double-clicked and the title "From scan to water" springing out. Music and sound effects only. | type card | post | understand-spatial-adjust | — | title: `understand-spatial-adjust/summary/1`, `understand-spatial-adjust/5/1`; brand items: no claim |
| B1 | Station by station | 0:08.2 | 0:18.9 | 10.7 | Card STATION BY STATION. The dashboard floats in, map left and table right; push-in on one hole where pins sit side by side in different moisture bands. | type card, full-window float, macro push-in | demo | understand-spatial-adjust, map-navigation, calculation-methods | "In IntelliDash, Spatial Adjust turns the latest moisture scan into a percent adjustment, station by station." | VO: `understand-spatial-adjust/before/1`, `understand-spatial-adjust/summary/1`, `calculation-methods/2/2`; label: `understand-spatial-adjust/3/3`, `calculation-methods/2/2` |
| B2 | Measure | 0:18.9 | 0:31.2 | 12.3 | Card MEASURE. Push-in on the table: course to areas, holes and stations; the highlight on Avg. VWC and on the scan date beside each station; a multi-sprinkler station expanded to each head's reading; the highlight on Request latest scan data (shown, not pressed). | type card, macro push-in | demo | understanding-vwc, request-scan-data, station-details, dashboard-overview, understand-spatial-adjust | "Each station's average VWC comes from a TurfRad moisture scan, dated beside the station name." | VO: `understand-spatial-adjust/2/2`, `understand-spatial-adjust/2/3`, `request-scan-data/1/4`; label: `understand-spatial-adjust/2/1` |
| B3 | See | 0:31.2 | 0:44.2 | 13.0 | Card SEE. The map, pins coloured by measured moisture; push-in on the legend's band handles; the variance view; Layers (All Stations, Enabled Stations); a station selected in the table lights up its pin. | type card, full-window float, macro push-in | demo, recreation | map-navigation, dashboard-overview | "The map colours pins by measured moisture. Move the bands, or switch to variance to see each station against its target. Map and table stay in sync." | VO: `map-navigation/1/1`, `map-navigation/2/1`, `map-navigation/3/1`, `map-navigation/3/3`, `map-navigation/5/1`, `map-navigation/5/2`; label: `dashboard-overview/2/1`, `map-navigation/1/1` |
| B4 | Set the target | 0:44.2 | 0:55.2 | 11.0 | Card SET THE TARGET. Push-in on a station row: Target VWC beside Avg. VWC; the new target, and Suggested following it; a brief look at the Soil Factor Editor. | type card, macro push-in | demo, recreation | editing-station-targets, understanding-vwc, suggested-adjustments, understand-spatial-adjust | "You set the target: the moisture you want each station to hold. A soil factor handles persistent offsets." | VO: `understand-spatial-adjust/3/1`, `understand-spatial-adjust/3/2`, `suggested-adjustments/5/1`, `suggested-adjustments/5/3`; label: `understand-spatial-adjust/3/1`, `editing-station-targets/2/1` |
| B5 | Calculate | 0:55.2 | 1:14.0 | 18.8 | Card CALCULATE. Current and Suggested side by side; a run of identical suggestions where Daily Max Amount caps them. The window morphs to Settings: the Calculation tab (Daily Max Amount, Lynx Reference Amount, Crop Coefficient; Option 1 or Option 2 only if shown), then Minimum Threshold. Nothing is saved. | type card, macro push-in, full-window float | demo, recreation | suggested-adjustments, calculation-methods, calculation-settings, minimum-threshold, understand-spatial-adjust | "The gap between target and measured becomes water, today's ET is added, Daily Max Amount caps it, and the result becomes a suggested percent adjust." / "Below a minimum threshold, a suggestion is zeroed or lifted to the threshold when you push." | VO: `understand-spatial-adjust/4/2`, `understand-spatial-adjust/4/3`, `calculation-methods/2/2`, `calculation-settings/2/1`, `minimum-threshold/summary/2`, `minimum-threshold/before/3`; label: `understand-spatial-adjust/4/1` |
| B6 | Review | 1:14.0 | 1:27.9 | 13.9 | Card REVIEW. An override in % Adj. with Suggested beside it; Bulk Adjust with Shift, targets moving together; the Over/Under tab catching both extremes; a hole's Enable switch turned off. | type card, macro push-in | demo, recreation | bulk-adjustments, filter-adjustments, enable-disable-stations, editing-station-targets | "Before you push, override any suggestion, replace or shift targets in bulk, find the outliers at both ends, or take a station or hole out of adjustment." | VO: `filter-adjustments/tile/2`, `editing-station-targets/4/1`, `bulk-adjustments/tile/2`, `bulk-adjustments/3/1`, `filter-adjustments/4/2`, `enable-disable-stations/summary/1`; label: `filter-adjustments/tile/2`, `editing-station-targets/4/1` |
| B7 | Push to Lynx | 1:27.9 | 1:50.2 | 22.3 | Card PUSH TO LYNX. Push Changes and its pending count beside the pushed-today counter; the Push dialog, Available to Push ticked and Pushed Today unticked; one row unticked, the footer count drops; send, progress station by station, confirmation. | type card, macro push-in, full-window float | demo, recreation | push-to-lynx, reviewing-changes, verify-results, push-failures, understand-spatial-adjust | "Nothing changes until you push. Review the two lists, untick anything you're unsure of, and send. Spatial Adjust writes each station, then reads Lynx back and checks each one." / "Lynx itself must be set up to match Spatial Adjust; the push guide lists the settings." | VO: `understand-spatial-adjust/5/4`, `push-to-lynx/2/1`, `push-to-lynx/2/3`, `push-to-lynx/4/1`, `push-to-lynx/5/1`, `push-to-lynx/5/2`, `reviewing-changes/before/3`, `reviewing-changes/before/4`; label: `push-to-lynx/tile/1` |
| B8 | (end card) | 1:50.2 | 1:55.2 | 5.0 | The end card: the Toro and Spatial Adjust lockup, "Explore the Spatial Adjust Guides", the URL pill `toroadam.github.io/spatial-adjust-guide` and the legal line. | type card | post | understanding-vwc | "Target minus measured, station by station. That is the whole idea." | VO: `understanding-vwc/4/4`; brand items: no claim |

**Total runtime: 1:55.2 (115.2 s)**, inside the 60-120 s window. The claims check in phase 2 cut the push-window line and
put a Verified Lynx set-up line of about the same length in its place, renamed the B1 chapter (its card grows 0.4 s) and
gave B6 0.6 s more footage for its checked line (see the change log in [`claims-check.md`](claims-check.md#change-log)).

**Phase 3 retime (render fit, 2026-10-20).** Three lines rendered longer than their windows (L1 by 0.24 s, L7 by 0.69 s, L8
by 1.46 s), so their beats' footage grew rather than the wording: B1 by 0.6 s, B6 by 1.0 s and B7 by 1.8 s, 3.4 s in all,
and every later time moved with them (111.8 s to 115.2 s). No word changed, so no claim and no gate row changed; the
numbers above are the film's times now.

**Narration: 10 lines, 200 words, 1,179 characters after the lexicon**, inside the 150-200 words the plan asks for (phase 3 added "In IntelliDash," to the B1 line; the timed script is [`vo-script.md`](vo-script.md)):
about 73 s of narration at the pipeline's estimate (`npm run video -- estimate`), or about 67 s at the 3.0 words a
second Brian averaged in the iCentral hero render report. Every line fits inside its beat's footage at the slower
rate, and the close fits the end card (66 characters, about 4.1 s against 4.7 s).

## Optional slot: Target Profiles (COMING SOON)

**Not used. SC-TP: omit**, the default (see [`../approvals.md`](../approvals.md#showcase)).

If the review on 2026-10-22 asks for it, the slot is a 3-4 s insert in B4, after the target line and before the soil
factor: the Settings dialog's Target Profiles tab from the recreation, with one VO clause on saving a full set of
station targets under a name and switching the whole course in one action. B4 would grow to about 15 s and the film to
about 1:55, still inside 120 s. In `episode.json` the insert would carry `approval: "SC-TP"`.

One fact changes how the slot would be labelled. The plan offered COMING SOON because Target Profiles was thought to be
unshipped, but the claims ledger now records it on production: 111 claims across its four guides, 106 Verified, none
Not shipping. A COMING SOON tag would misstate a shipped feature, so if the slot is used it is shown as shipping, with
Verified claims like any other line, and without the tag.

## Source tags

| Tag | Meaning | Where |
|---|---|---|
| demo | Captured from IntelliDash `/demo` through the capture director, with the fictional course overlay and the restyled map | Every read: the map, the table, the counts, dialogs opened and closed without saving |
| recreation | Captured from the guides' recreation of the app (the built guide site, served locally) | Every result of a write, which Demo Mode blocks with an "unsupported" message instead of carrying out: the new target and its suggestion (B4), the overrides, bulk adjust, filter settings and Enable switch (B6), send, progress and confirmation (B7). Also what the director cannot do: drag a band handle (B3) and press Shift + Alt for the Soil Factor Editor (B4) |
| post | Made by the pipeline, no product footage | The lockup, title card, chapter cards and end card |

The write tags are provisional. The capture phase (4a) confirms each by trial and retags a beat where Demo Mode shows
more than expected. Preference saves (band boundaries, the variance view, Layers, the Over/Under thresholds) are
writes too; they are demo only if the trial shows Demo Mode allows them.

## Notes for the later phases

**Claims check (phase 2).** Each VO draft was written from the guides' own sentences, but four lines will need a
decision rather than a lookup:

- **B1, the hook.** "Waters some areas too much, and others too little" states the problem the plan describes; the
  ledger verifies how Spatial Adjust works, not the problem it solves. Rewrite it to what is Verified, or treat it as
  not claimable.
- **B7, the push window.** All 12 push-window claims are Needs expert, by design, until the experts answer
  `docs/claims/operational-contract.md`. The line stays only once one is Verified; otherwise it is cut, or replaced
  with a Verified Lynx set-up line (Site Adjust and Course Adjust at 100 %).
- **B8, the key message.** It is the brief's key message, not a sentence from the guides.
- **B4, the soil factor.** The claims are Verified, but the editor opens only with Shift + Alt on the gear. The experts
  may prefer the film not to feature a hidden control.

The chapter labels, the title "From scan to water" and the end-card line are also on-screen text for the check.

*Done in phase 2:* the hook, its chapter label and the closing line were rewritten to Verified claims, the push-window
line was cut and replaced with a Verified Lynx set-up line, and the soil-factor line was kept, Verified. The beat table
above carries the checked copy; every change and its reason is in the change log of [`claims-check.md`](claims-check.md#change-log).

**Capture (phase 4a).** The director has six actions: wait, cue, hover, scroll, focus and click. It cannot drag, type or
hold a modifier key, and it clicks only names listed in `allowClicks` or declared in `demoWriteClicks`. Opening a view
without writing (the variance toggle, Layers, the gear, Push Changes) needs those entries recorded first. Every beat in
`episode.json` has empty `actions`: phase 4a writes them, with a `cue` for every VO line.

**Edit (phase 4b).** The builder cuts every chapter from one take of one source per build, and B3-B7 mix demo and
recreation footage. Phase 4a and 4b decide how the two sources meet in one cut.

## Rules checked

- **Chain order.** B1 Hook, B2 Measure, B3 See, B4 Set the target, B5 Calculate, B6 Review, B7 Push to Lynx, B8 Close,
  after the B0 title: the request's order.
- **Avoid list.**
  - Real customer courses or names: the fictional course only, with the overlay and the restyled map.
  - Pushing to a real Lynx: no beat pushes anything; B7's send and its results come from the recreation.
  - Water-savings numbers: none, in the voice or on screen.
  - Unshipped UI: none. Target Profiles, which ships, is omitted (SC-TP). The Option selector ships but production hides
    it for most sites, so it appears only if the demo site shows it.
  - Unlicensed stock footage: none. Every frame is product footage, the recreation or a pipeline card.
  - Webinar-style narrated feature lists: one line per link of the chain, each said over the control it names.
- **Source tags.** Every beat declares at least one: B0 and B8 post; B1 and B2 demo; B3-B7 demo and recreation.
- **Guide keys.** Every beat B1-B7 lists at least one of the 26 guide keys, and every key listed is one of them.
- **Runtime.** 115.2 s, inside 60-120 s; narration 200 words, inside 150-200.
- **Target Profiles.** Appears only in the optional slot above.
