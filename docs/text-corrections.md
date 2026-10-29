# Text corrections — evidence

Claims in the guides that a reader would act on and that the shipping product contradicts.
Each was checked against the IntelliDash source, not against the Core Design recreation of
it, because the recreation can carry the same mistake as the prose.

These are corrected in `src/transform-export.mjs` rather than in the `.dc.html`, because a
Core Design re-export overwrites that file wholesale. Every correction is anchored on the
exact sentence it replaces, so if the wording changes upstream the build fails instead of
silently dropping the fix.

**They still need fixing at source in Core Design.** The transform is a guard, not a
resolution — it keeps the published site correct in the meantime.

## How IntelliDash is cited

IntelliDash is cited by file and line only, and never quoted: this repository is public. Product
copy, meaning label text from IntelliDash's language catalogues, is quoted where a reader would
see it on screen. Every line number in this document is at the IntelliDash production pin,
`1aa4f28622cc3cc9637f0d61a438bf16bcf01924` (version 2.5.261015); `docs/claims/sources.json`
records how that pin was chosen and confirmed as production. Sections 1 to 10 were
first written against an earlier commit and quoted the code; their citations were re-checked
and re-pinned to the production SHA when the quotations were removed, and every conclusion
still holds there.

Citations use the file name alone. The full paths, relative to the IntelliDash repository root:

| File | Path |
|---|---|
| `SpatialAdjustService.cs`, `SpatialAdjustLogic.cs` | `api/Services/` |
| `appsettings.json` | `api/` |
| `environment.toro-prod.ts` | `site/src/environments/` |
| `en-us.json` | `site/src/assets/i18n/` |
| `cloud-service-base.ts`, `lynx-cloud.service.ts` | `site/src/app/api/lynx-cloud/` |
| `lynx-drive.service.ts` | `site/src/app/api/lynx-drive/` |
| `lynx-proxy.service.ts` | `site/src/app/api/lynx-proxy/` |
| `spatial-adjust-course.model.ts`, `sa-push-changes-station.model.ts` | `site/src/app/api/spatial-adjust/models/` |
| `color-range.component.ts` | `site/src/app/shared/components/color-range/` |
| `dash-user-manager.service.ts` | `site/src/app/api/dash-user/` |
| `toro.enums.ts` | `site/src/app/common/enumerations/` |
| `date.util.ts` | `site/src/app/common/utils/` |
| `sa-algorithm.service.ts`, `sa-push-changes.service.ts` | `site/src/app/spatial-adjust/services/` |
| `spatial-adjust.util.ts` | `site/src/app/spatial-adjust/utils/` |
| `spatial-adjust-main.component.ts` | `site/src/app/spatial-adjust/components/spatial-adjust-main/` |
| `sa-settings-dlg.component.*` | `site/src/app/spatial-adjust/components/sa-settings-dlg/` |
| `sa-confirm-push-dlg.component.*` | `site/src/app/spatial-adjust/components/sa-confirm-push-dlg/` |
| `sa-dashboard.component.*` | `site/src/app/spatial-adjust/components/sa-dashboard/` |
| `sa-main-toolbar.component.*` | `…/sa-dashboard/sa-main-toolbar/` |
| `sa-dash-map.component.ts` | `…/sa-dashboard/sa-dash-map/` |
| `sa-map-overlay.component.ts` | `…/sa-dashboard/sa-dash-map/sa-map-overlay/` |
| `sa-dash-chart.component.*` | `…/sa-dashboard/sa-dash-chart/` |
| `sa-dash-table.component.ts` | `…/sa-dashboard/sa-dash-table/` |
| `sa-table-item.model.ts` | `…/sa-dashboard/sa-dash-table/models/` |
| `sa-table-card.component.*` | `…/sa-dashboard/sa-dash-table/sa-table-card/` |
| `sa-bulk-adjust-dlg.component.ts` | `…/sa-dashboard/sa-dash-table/sa-bulk-adjust-dlg/` |
| `sa-table-threshold-filter.component.*` | `…/sa-dashboard/sa-dash-table/sa-table-threshold-filter/` |

`…/sa-dashboard/` is `site/src/app/spatial-adjust/components/sa-dashboard/`.

---

## 1. Algorithm names did not exist in the UI

**Claimed:** the two calculation methods are "Simple" and "the default method".

**Actual:** those are enum names. The dropdown is built from two translation keys,
`SPATIAL_ADJUST.ALGO_SIMPLE` and `SPATIAL_ADJUST.ALGO_DELTA_PLUS_TODAY_ET`
(`dash-user-manager.service.ts:217-226`), and the English catalogue labels them "Option 1" and
"Option 2" (`en-us.json:367-368`).

Both render as **"Option 1"** and **"Option 2"** — and identically in all ten other locales
(`Opción 1`, `Option 1`, `Opzione 1`, `オプション 1`, …). The word "Simple" appears nowhere
on screen, so a reader following the guide into that dropdown had nothing to match on.

**Correction:** every mention now leads with the label actually on screen. The descriptive
names are kept as prose — "Option 1 multiplies the percent adjust Lynx holds" is unreadable
on its own — but the mapping is stated in the `before` list and again at the selector step.
The guide now also says plainly that the product describes neither option, which is the real
reason the step is confusing.

## 2. The unit-switch reassurance was false

**Claimed:** *"Changing the unit system does not change the underlying values — only the
number you see and the increment you nudge it by."*

**Actual:** it rescales the stored values by 25.4.

Conversion into user units happens once, when the dialog's data loads: the load handler calls
the conversion (`sa-settings-dlg.component.ts:322`), which reads the unit system at that moment
and converts Max Amount and Lynx Reference Amount out of millimetres (`:354-365`).

The Units of Measure control is a plain two-way binding with **no change handler**
(`sa-settings-dlg.component.html:242`). So nothing re-converts the amounts already sitting on the
Calculation tab. Save then converts back unconditionally: it prepares the settings for saving
(`sa-settings-dlg.component.ts:186-192`), and that converts both amounts to millimetres, treating
them as inches whenever the unit system is now imperial (`:416-427`).

The unit system read at save time is the *new* setting, but the amount on screen is still the
millimetre value. A 10 mm cap is saved as 10 inches, **254 mm**. Both Max Amount and Lynx
Reference Amount are affected, and Cancel runs the same conversion (`:217-218`).

This was the most consequential wrong sentence in the guides: a safety reassurance on a
setting that feeds irrigation output.

**Correction:** the tip now states what actually happens and tells the reader to reopen
Settings and check both amounts after a unit change. The body was also tightened — the
conversion runs when the dialog opens, not when the setting changes.

## 3. Moisture band default was one course's preference

**Claimed:** bands default to `0–5, 6–16, 17–30, above 30`.

**Actual:** the middle boundary defaults to **19**, not 16. With no saved preference the map falls
back to 5, 19 and 30 (`sa-dash-map.component.ts:48-50`).

16 is the saved moisture-range preference in one of IntelliDash's Spatial Adjust demo datasets
(under `site/src/app/demo/spatial-adjust/`), which is what the guides were authored against. A
fresh account with no saved preference sees `0–5, 6–19, 20–30, above 30`.

**Correction:** boundaries updated in both places that state them. The boundaries remain
user-configurable and saved to user preferences, which the guide already said correctly;
only the stated default was wrong.

---

## 4. The weather strip is not what drives the calculation

**Claimed:** the strip shows "today's ET and precipitation — the same ET that drives the
calculation", and a verify step tells the reader to confirm that "Calculation ET under the filter
tabs matches the ET shown in the weather strip".

**Actual:** the ET on screen reaches the suggested percentages on neither algorithm. The function
that produces the suggestion declares a current-ET parameter (`sa-algorithm.service.ts:43`) and
**never reads it**: it switches on the algorithm, and neither branch passes the parameter on
(`:45-50`). Its only caller passes four arguments, so the parameter is always empty
(`sa-dashboard.component.ts:597`).

**Option 1** is target VWC ÷ measured VWC × the percent adjust Lynx holds, rounded
(`sa-algorithm.service.ts:58-60`). No ET term at all. **Option 2** performs no calculation
client-side — it looks up a server-computed suggestion by station name (`:62-65`). So whatever ET
informed Option 2 was applied server-side before the page loaded, and cannot be checked against
the strip.

**Why this one mattered more than a wrong sentence.** The second claim is a *verify* step — the
instruction a reader follows to confirm they succeeded. It asks them to compare two figures that
are not required to agree. A reader whose numbers differ concludes they made a mistake and starts
undoing correct work. Corrected in `src/transform-export.mjs` as transform 6.

## 5. "Pushed Today" releases at local midnight, not 24 hours after the push

**Claimed:** nothing incorrect — the guides say a pushed station is held back so you do not adjust
the same head "twice in a day", which is accurate. The omission is *when the day ends*, and the
rule is not the one a reader would assume.

**Actual:** a station becomes pushable again once its last push falls on an earlier local
calendar day than today (`spatial-adjust.util.ts:11-13`). The date test shifts both the push time
and the current time into the course's UTC offset before comparing their days
(`date.util.ts:81-93`).

Both sides are floored to the start of the day in the **course's** offset, so the hold releases at
local midnight. A station pushed at 11:58 PM is selectable again two minutes later. The natural
reading of "twice in a day" is a rolling 24 hours, and acting on that assumption double-adjusts a
head. One sentence added in `src/transform-export.mjs` as transform 7.

Worth flagging separately: `SPATIAL_ADJUST.PUSHED_IN_LAST_N` — **"Pushed in last 24H"**
(`en-us.json:449`) — is present in all eleven IntelliDash catalogues and referenced by no code. If
it is ever wired up it will state the wrong rule.

## 6. The four push phases were taught in the wrong order

**Claimed:** *"It reads Lynx first ... Before writing anything, Spatial Adjust retrieves the
current percent adjustments from Lynx so it has something to compare against afterwards."* —
`verify-results`, step 1 of 5, captioned "Phase one: retrieving current values for comparison."

**Actual:** it writes first. Nothing is read before the push begins. The push button's handler,
after its guards, hands the pending changes straight to the write loop with a 100 ms pause
between stations (`sa-main-toolbar.component.ts:255-269`). The first progress state the dialog
receives is the pushing step at 0% (`sa-push-changes.service.ts:136-138`). The read of Lynx is
requested only from the write loop's completion handler, after every station has been written,
and that is also where the Fetching step is first reported (`:162-170`).

The real order is **write → read back → compare → retry**. The guide also misstated the
*purpose* of the retrieve: there is nothing to "compare against afterwards", because the
comparison happens seconds later against the values just written. It is a read-back, not a
baseline.

**Correction:** the first two steps are swapped and renumbered in `src/transform-export.mjs` as
transform 12. This pass first moved the "slowest phase" remark onto the write phase; the
claim-by-claim audit then found that sentence wrong there too, and section 19 corrects it.

**The reproduction carried the same error as a number.** `SpatialAdjustApp.dc.html:507` drew the
retrieving phase at **12%** — which is what a phase-one read would show. IntelliDash computes it:
the percentage is the steps done over the total, rounded, and held at 99 until the push ends
(`sa-push-changes.service.ts:197-201`); the total is the station count plus verification steps
(5% of the stations, at least one) plus retry steps (2%, at least one) (`:213-222`).

The reproduction's scenario is six stations, so the total is 8 steps and every phase follows:

| Phase | Steps counted | Real | Reproduction drew |
|---|---|---|---|
| Pushing, 4 of 6 | 4 / 8 | **50%** | 64% |
| Retrieving | 6 + round(1/2) = 7 / 8 | **88%** | 12% |
| Verifying | 8 / 8, clamped (`:199-201`) | **99%** | 82% |
| Retrying | reset to 0 | **0%** | 46% |

Corrected in `src/transform-app.mjs` in the same pass. Fixing the caption without the figure
would have left a step whose picture contradicts its own words.

## 7. The progress bar resets to zero on a retry, and no guide said so

**Claimed:** nothing — this is an omission, not a wrong sentence. `verify-results` step 4 says a
retry "is information rather than an error", and stops there.

**Actual:** the bar does not resume from 99%. It restarts at zero and recomputes its total for the
failed stations alone (`sa-push-changes.service.ts:93-97`).

A superintendent who has watched a push climb to 99% sees it collapse to 0%. That is the moment
the guide's reassurance is tested, and an unexplained collapse is exactly what makes a reader stop
believing it. One sentence added as transform 12's second edit.

## 8. The push dialog drew twelve ticked rows beside a banner saying six were not

**Claimed:** the figure. Every row in Push Changes rendered ticked, in both sections.

**Contradicted by the same figure.** Three lines above the table, in the dialog's own info banner:

> Stations pushed today appear unselected in a separate list to prevent double adjustments.
> To adjust one again, simply select it.

**Actual:** the product clears them on load, and the tick is conditional. When the dialog opens it
unticks every Pushed Today row (`sa-confirm-push-dlg.component.ts:24`), and each row draws its
tick only while the row is selected (`sa-confirm-push-dlg.component.html:95` for Available to
Push, `:132` for Pushed Today).

The split into two sections exists to stop a head being adjusted twice in a day — the same guard
section 5 above is about. A reader shown twelve ticked rows has been taught that pushing again
sends all twelve. It also makes nonsense of `push-failures`, which tells them to "untick anything
that already went out": busywork beside a figure where everything is ticked, and the point beside
a correct one.

**Correction:** `row()` takes the ticked state from its call site in `src/transform-app.mjs`, so
the Available to Push rows stay ticked and the Pushed Today rows render empty. No prose changed,
so no catalogue key moved.

## 9. The estimated-value marker was half-drawn, and the audit described it backwards

**Claimed** by the audit finding, not by the guides: *"calculator icons replace the mock's grey
italics."*

**Actual:** nothing is replaced. The product applies **both**, to the same cell: the estimated
class colours the reading dark grey and italicises it (`sa-table-card.component.less:107-110`),
and the same cell draws the calculator icon whenever the row, one of its children or a paired
sprinkler is modelled (`sa-table-card.component.html:29-31`).

So the reproduction's grey italics were right all along and the icon was simply missing, in all
three places the table draws one. That matters because **the icon is the only marker carried into
the push dialog** (`sa-confirm-push-dlg.component.html:81` and `:117`), where there is no dimming
at all — a reader who has only ever been shown italics has not been shown the thing they have to
recognise at the one moment it decides whether they push a modelled value to the course.

**Parent rows differ from station rows, and the reproduction had them identical.** The two classes
are applied on different conditions, and `sa-parent` styles only the icon, never the number
(`sa-table-card.component.less:112-116`). An Area or Hole row is an aggregate — its own reading
cannot be estimated, only its children's — so it renders a **plain number beside a grey icon**. `areaAgg()` hardcodes
`est: true` and `holeAgg()` sets it when any child station is estimated, so the reproduction was
dimming and italicising a figure the product prints plainly.

**Correction:** `calcIcon(dim)` added in `src/transform-app.mjs` and called from all three cells,
with `dim` distinguishing the aggregate case. Verified in the built site: on
`enable-disable-stations` step 2 the hole-7 row renders `38.5%` at `font-style: normal` in
`rgb(8,13,18)` beside an icon at `rgb(169,169,169)`; on the station table only `7AP1` carried one.
The glyph is drawn rather than borrowed — Font Awesome is not bundled, the build asserts zero
external origins, and a Font Awesome Free path carries a CC BY attribution requirement this
repository has nowhere sensible to honour.

Section 30 takes this further: the product's icon is orange, sits at the left of the cell, and
also marks 6AP1, its modelled sprinkler and hole 6.

## 10. The push icon was drawn on disabled stations

**Claimed:** the figure. Every station row drew a push or pushed icon.

**Actual:** the product draws it only on an enabled station, and also hides it when the
show-current-only flag is on and the station's scan is neither current nor modelled
(`sa-table-card.component.html:51`).

The reproduction's `on` is that enabled state — it is what the row's toggle renders — and `5AP1`
ships disabled. So exactly one row was telling the reader a disabled station had an adjustment
waiting to go to Lynx, which is the precise claim `enable-disable-stations` exists to correct.

**Correction:** the icon follows `s.on` in `src/transform-app.mjs`. Verified: of eighteen station
rows, `5AP1` is now the only one without an icon, and no row carries two.

**Only the `isEnabled` clause is reproduced.** The third clause turns on
`environment.saShowCurrentOnly` and swaps the whole adjust input for a `--` placeholder. When
this section was written nothing in this repository established that flag's production value.
It is true on production (`environment.toro-prod.ts:87` at
`1aa4f28622cc3cc9637f0d61a438bf16bcf01924`), but no reproduced figure reaches that branch; see
section 30.

## Corrections from the claim-by-claim audit (sections 11 to 30)

Sections 11 onwards correct every sentence that the claims ledger (`docs/claims/guides/*.json`)
marked **Wrong**. Each sentence was checked against IntelliDash production, the
`Deployments/release/261014_phase_3a` branch at `1aa4f28622cc3cc9637f0d61a438bf16bcf01924`
(version 2.5.261015). `docs/claims/sources.json` records how that pin was chosen and that it
was confirmed as production by the guides owner on 2026-10-19. Every line number below is at
that SHA.

The corrections live in `src/transforms/corrections.mjs`, one anchored edit per sentence, named
by the claim IDs it fixes. Where the wrong sentence was written by an earlier edit in
`src/transform-export.mjs` rather than by the export, that edit is corrected instead, so the
wrong text is never produced: sections 11, 19, 22, 25 and 27 say which.

Citations use the file name alone; the table under "How IntelliDash is cited" at the top of
this document gives the full paths.

## 11. Target Profiles is in the shipping build, and new

**Claimed:** the four Target Profiles guides opened with a note saying the feature "is still in
development and is not in the shipping build yet", that the screens "show a proposed design",
and that "the tab being built" lists five slots. Two captions called the tab "Proposed".

**Actual:** the settings dialog lists Target Profiles unconditionally
(`sa-settings-dlg.component.ts:55`), and its pane renders (`sa-settings-dlg.component.html:35`,
`:177-226`). The entry is in none of the ten earlier `Deployments/release/*` branches; the one
before production, at `99e0a4ef486c5e27fa69aa42668cfc592cc22408` (2.5.260730), has no Target
Profiles anywhere in the Spatial Adjust client. So the feature is new in the current release,
not long-standing. It is the same on develop (`sa-settings-dlg.component.ts:55` at
`bd39f465cf5a7ae0356a59825250b36044085714`).

**Correction:** the two note edits in `src/transform-export.mjs` (§8, `TP_NOTE` and
`TP_NOTE_WALKTHROUGH`) now describe the five slots and tell a reader whose settings dialog has no
Target Profiles entry that their IntelliDash predates the release. That last sentence stays true
whichever release a reader is on, which matters because not every site updates on the day a
release ships.
The captions read "The Target Profiles tab." and "The Target Profiles tab in the settings dialog."

The note callout itself was labelled "Concept.", a word every Target Profiles note now
contradicts. The four guides carry a `newInIntelliDash` flag (`src/transforms/corrections.mjs`),
and for a flagged guide the callout is labelled "New in Spatial Adjust." and is a `role="note"`
banner with an accent rule, ahead of step 1; any other note would be labelled "Note.". The
same four catalogue tiles carry a "New in Spatial Adjust" text badge above the title, and the card's
accessible name includes it ("Apply a target profile — New in Spatial Adjust, 2 MIN, difficulty 1
of 3"), because the card's `aria-label` replaces its content for a screen reader. The notes no
longer open with "Target Profiles is new in IntelliDash", which the label now says. When the
feature stops being new, or if the production pin is ever re-pointed at a build without it,
`NEW_LABEL`, `TP_NOTE` and `TP_NOTE_WALKTHROUGH` at the top of `src/transform-export.mjs` are the
only text to change.

The review plan proposed a banner reading "Not yet in IntelliDash. This feature is on a
development branch and is not in the version you are using." That sentence is the claim this
section corrects, so it was not used; the banner says "New in Spatial Adjust." instead. Whether to
hide these guides is for the expert review; they stay visible and reachable by deep link.

**Claims:** creating-profiles/note/1, creating-profiles/note/2, seasonal-profiles/note/1,
seasonal-profiles/note/2, updating-profiles/note/1, updating-profiles/note/2,
target-profiles/note/1, creating-profiles/2/3, target-profiles/1/3.

## 12. Profiles are five fixed slots, not a list you add to

**Claimed:** the guides taught creating profiles: a guide titled "Creating profiles", steps titled
"Save your current targets as a new profile", "Keep the list short" and "Update rather than
create", the advice to "create a new profile instead" for a one-off event, and figures captioned
"Three profiles, one active" and "Three profiles: one active, one seasonal, one never applied".

**Actual:** the tab always holds five slots per Lynx course. Missing slots are filled in with the
default names Spring, Summer, Fall, Winter and Tournament (`sa-settings-dlg.component.ts:103-109`,
`:383-392`), and the server rejects any index outside 0 to 4 (`SpatialAdjustLogic.cs:28-31`).
The columns are the editable name, Last Updated, Stations, Update from Current and Apply Profile
(`sa-settings-dlg.component.html:195-219`); an empty slot shows `--` for Last Updated and
Stations (`:205-206`). Current targets go into an existing slot with Update from Current, which
replaces what the slot held (`:208-211`; `SpatialAdjustService.cs:636-678`). There is nothing to
open: each profile is a row with its actions in the row (`sa-settings-dlg.component.html:203-219`).

**Correction:** the guide and its tile are retitled "Capturing profiles". The titles become "Save
your current targets into a profile slot", "Plan what goes in the five slots", "Find the
profile’s row" and "Update this slot or capture into another". The one-off-event advice becomes
capturing into a different slot, with the warning that this overwrites what that slot held. The
captions describe five slots.

**Claims:** creating-profiles/tile/1, creating-profiles/3/4, target-profiles/2/4,
target-profiles/4/1, seasonal-profiles/1/1, updating-profiles/2/1, updating-profiles/2/4,
updating-profiles/3/1, updating-profiles/3/3, updating-profiles/3/6.

## 13. No profile is marked active in the list

**Claimed:** "The active profile is the one whose targets are currently loaded", each profile
"shows when it was last applied", and three verify items asked the reader to see the applied
profile "marked active in the list".

**Actual:** the list has no active marker (`sa-settings-dlg.component.html:195-219`). Applying
flags that profile and clears the flag on the course's other slots
(`SpatialAdjustService.cs:698-707`), and the dashboard shows "{{name}} Target Profile" in the bar
above the table (`sa-dashboard.component.html:30-32`; `en-us.json:432`). Any later Target VWC
edit, single or bulk, clears the flag and the label (`SpatialAdjustService.cs:1231`, `:2402`,
`:2432-2447`; `sa-dashboard.component.ts:326-332`). Last Updated is stamped only when the slot is
renamed or refreshed with Update from Current (`SpatialAdjustService.cs:625`); applying does not
change it.

**Correction:** the sentences and verify items point the reader at the label above the dashboard
table, give "Summer Target Profile" as the example, and say a later target edit removes it.

**Claims:** target-profiles/2/2, target-profiles/2/3, target-profiles/verify/1,
seasonal-profiles/verify/1, updating-profiles/2/2.

## 14. Applying a profile changes only the stations it holds

**Claimed:** applying "changes targets on every station, which recalculates every suggestion",
"rewrites every target", and a profile captured while the course was partly disabled "covers
fewer stations than the course has".

**Actual:** applying writes the stored Target VWC to each station whose name is in the profile
(`SpatialAdjustService.cs:861-936`) and recalculates that station's suggestion where today's
adjustment exists (`:921-924`). Other stations keep their targets, and the confirmation says so
when the counts differ (`sa-settings-dlg.component.html:282-288`; `en-us.json:447`). Capture reads
every station of the course with no enabled filter (`SpatialAdjustService.cs:566-580`,
`:653-671`), so enable state plays no part.

**Correction:** the sentences say the profile holds every station the course had when it was
captured, and applying it leaves stations outside it untouched.

**Claims:** target-profiles/before/3, seasonal-profiles/2/2, creating-profiles/4/3.

## 15. The Push Changes count is what differs from Lynx, not what you edited

**Claimed:** the button counts "stations with an unpushed edit"; the count "matches the number of
rows you changed"; a station appears in it "only if you edited % Adj."; editing % Adj. "queues
the station"; every edited station shows the pending push icon.

**Actual:** a station is pending when its area, hole and station are enabled and its % Adj.
differs from what Lynx holds (`sa-dashboard.component.ts:613-619`, `:659-662`). % Adj. starts as
the suggestion (`:597-598`), so unedited stations count, and a target change resets % Adj. to
the new suggestion (`sa-table-card.component.ts:465-475`). The number in the label leaves out
stations already pushed today (`sa-main-toolbar.component.ts:153-160`). Typing back the value
Lynx already holds takes a station off the list. Suggested sits beside the input, not underneath
it (`sa-table-card.component.html:48-62`).

**Correction:** every sentence that describes the count now says enabled stations whose % Adj.
differs from what Lynx holds, edited or not, leaving out any already pushed today.

**Claims:** dashboard-overview/5/3, push-to-lynx/1/2, reviewing-changes/1/2,
suggested-adjustments/verify/1, suggested-adjustments/verify/2, editing-station-targets/4/3,
editing-station-targets/verify/3.

## 16. After a good push the count is not zero

**Claimed:** after a push "the pending count is zero" and the button is disabled.

**Actual:** no zero is ever shown. When no pending station is left outside Pushed Today, the
label drops its number and reads "Push Changes" (`sa-main-toolbar.component.html:40`). The
button is disabled only when nothing at all is pending (`:34`). A clean run can leave stations
pending: rows the reader unticked, Pushed Today rows left unticked, and any station the minimum
threshold rewrote, because the threshold value is substituted only on the dialog's copy
(`sa-confirm-push-dlg.component.ts:20`, `:74-79`).

**Correction:** the verify items say Push Changes no longer counts the stations you sent, and is
greyed out only if nothing else is waiting.

**Claims:** push-to-lynx/verify/1, verify-results/5/3, verify-results/verify/2.

## 17. The push icon does not mark a pending edit

**Claimed:** "the icon beside the field marks it as pending", and after a push "pushed rows in
the table now show the pushed icon rather than the pending one".

**Actual:** the icon is drawn only for a station with a recorded previous push whose % Adj.
differs from Lynx (`sa-table-card.component.ts:545-556`); a station never pushed shows none
however it is edited. A station that is no longer pending has its icon cleared (`:258-273`), so
a row that pushed and verified shows no icon at all. The pushed-today icon remains only on a
station that was pushed today and still differs from Lynx: a failure, or one the minimum
threshold rewrote.

**Correction:** the caption says the icon appears only on a station pushed before. The verify item
says rows pushed successfully show no icon, and a pushed-today icon means Lynx does not hold the
value in the table.

**Claims:** suggested-adjustments/4/5, push-to-lynx/verify/3.

## 18. Failed stations come back under Pushed Today, unticked

**Claimed:** "reopening Push Changes offers exactly" the failed stations; "untick anything that
already went out"; "push those again rather than the whole set".

**Actual:** every station sent, failures included, is stamped as pushed today before the
comparison runs (`sa-push-changes.service.ts:174-179`; `sa-dashboard.component.ts:214-231`).
Reopening the dialog lists the failures under Pushed Today, unticked
(`sa-confirm-push-dlg.component.ts:23-26`). Stations that verified are no longer pending, so they
are not listed at all (`sa-dashboard.component.ts:659-662`). Any other pending station is under
Available to Push, ticked (`sa-push-changes-station.model.ts:16`). Read literally, the old
instruction left the failures unsent and sent whatever else was ticked.

**Correction:** both guides tell the reader to tick the failed stations under Pushed Today, and
to untick anything under Available to Push they did not mean to send.

**Claims:** push-failures/4/2, push-failures/4/3, push-to-lynx/6/3.

## 19. The push writes first, and the write counter cannot stall

**Claimed:** "Spatial Adjust first re-reads the current adjustments from Lynx for comparison, then
writes"; of the write phase, "on a large course this is the slowest phase, and a stalled counter
here means the connection"; knowing the phases "tells you whether a slow run is working or
stuck".

**Actual:** the push handler starts the write loop directly (`sa-main-toolbar.component.ts:269`),
and the read from Lynx is issued only when that loop completes
(`sa-push-changes.service.ts:162-170`). Each write is sent without waiting for an answer
(`:206-211`; `lynx-cloud.service.ts:80-95`; `lynx-drive.service.ts:67-87`), and the counter
advances on a fixed per-station delay (`sa-push-changes.service.ts:145-150`), so it cannot stall.
A slow or silent Lynx shows in the read-back, where each of three requests is allowed three
60-second attempts (`cloud-service-base.ts:43-45`, `:372-463`).

**Correction:** "Push changes to Lynx" step 5 now gives the order write, read back, compare. The
write-phase sentence is corrected inside the `verify-results push phase order` edit in
`src/transform-export.mjs` (section 6 placed it there): writing takes at least a tenth of a
second per station on a fixed timer, and a stall happens in the next phase. The summary says the
phases tell you what a slow run is waiting for.

**Claims:** push-to-lynx/5/2, verify-results/1/4, verify-results/summary/2.

## 20. The minimum threshold is never applied to the table

**Claimed:** the table still shows 6 "because nothing has been pushed", implying it changes after
a push.

**Actual:** the threshold rewrites only the push list and the values sent
(`sa-main-toolbar.component.ts:433-460`; `sa-confirm-push-dlg.component.ts:74-82`;
`sa-push-changes.service.ts:207`). After a push, Current shows 10 while Suggested and % Adj.
still show 6, and the station stays pending (`sa-dashboard.component.ts:659-662`).

**Correction:** the table shows 6 and always will.

**Claims:** threshold-questions/1/3.

## 21. A bulk adjust error normally means nothing was written

**Claimed:** "A bulk adjust error means some values may already have been written. Check the
column before retrying."

**Actual:** the server writes every target, today's recalculated adjustments and the cleared
Target Profile inside one transaction that is rolled back on any exception
(`SpatialAdjustService.cs:2363-2421`); the early failures return before anything is written
(`:2298-2314`). An error can follow a successful write only if the request fails after the
server committed, and then every value was written. The table is reloaded only after a success
(`sa-bulk-adjust-dlg.component.ts:142-156`; `sa-dashboard.component.ts:288-294`), so after an
error the column still shows the old targets and checking it proves nothing. The product's own
message, "Some values may have been updated" (`en-us.json:398`), says the same wrong thing and
is worth fixing at source.

**Correction:** the tip says nothing was written, despite the message, explains the one case
where everything was, and tells the reader to reload before checking the column.

**Claims:** bulk-adjustments/4/5, bulk-adjustments/4/6.

## 22. Request latest scan data fetches what TurfRad holds; it does not order a scan

**Claimed:** the button "asks TurfRad for a new scan"; "request a fresh scan from the toolbar";
the banner appears "when the scan lands"; a stale course is "not something you have to wait out".

**Actual:** the request resets the site's last-update time and starts the background retrieval at
once (`SpatialAdjustService.cs:978-1002`). That retrieval downloads the scan statistics TurfRad
already holds (`:2527`), and it runs by itself whenever the update interval has passed
(`:1949-1958`), 1800 seconds by the shipped default (`appsettings.json:32`). The completion
signal is sent after every course is processed, whether or not anything new arrived
(`:2054`, `:2060-2072`), and the toolbar shows the banner for any completion while a request is
outstanding (`sa-main-toolbar.component.ts:207-213`).

**Correction:** the "Get fresh scan data" guide and its tile, written by the `new guide bodies` and
`catalogue entry: request-scan-data` edits in `src/transform-export.mjs`, now say the button
fetches the latest data TurfRad holds, ahead of the next automatic retrieval, that it does not
order a scan, and that the banner appears whether or not TurfRad had anything newer. The
diagnostics step in "Calculation questions", written by the `stale scans: diagnostics step names
the next action` edit, says the same and adds that the date will not change if TurfRad has
nothing newer.

**Claims:** calculation-questions/5/4, request-scan-data/tile/2, request-scan-data/summary/1,
request-scan-data/summary/2, request-scan-data/2/3, request-scan-data/4/2,
request-scan-data/verify/1.

## 23. The map draws one pin per sprinkler, clears old scans and hides disabled stations

**Claimed:** "Every station is a pin" coloured by "its latest measured VWC"; the All Stations count
"matches the number of pins on the map"; the map "recolours as you drag".

**Actual:** pins are drawn per sprinkler record at that sprinkler's coordinates
(`sa-dashboard.component.ts:517-519`; `sa-dash-map.component.ts:307`). A pin whose latest scan is
not from today is drawn clear (`:315`; `saShowCurrentOnly` is true at
`environment.toro-prod.ts:87`). The Layers default on production is Enabled Stations
(`environment.toro-prod.ts:88`), so disabled stations are not drawn until the reader picks All
Stations (`sa-dash-map.component.ts:312`). The All Stations count is the number of unique station
names (`sa-dashboard.component.ts:521-528`). While a handle moves only the legend's labels update
(`color-range.component.ts:89-139`); the map redraws when it is released (`:79-87`;
`sa-map-overlay.component.ts:120-132`; `sa-dash-map.component.ts:138-143`).

**Correction:** both map descriptions say one pin per sprinkler of a station scanned in the past
seven days, coloured when scanned today and clear otherwise, with disabled stations hidden by
default. The verify item no longer asks the count to match the pins. The map recolours "when you
let go".

**Claims:** dashboard-overview/2/2, map-navigation/1/2, dashboard-overview/verify/4,
map-navigation/2/3.

## 24. The summary figures, the chart and the course name

**Claimed:** the Avg / High / Low figures "are computed across every station in the selected
course"; "the chart above the table plots the holes you pick"; "the map, chart and table all name
the same course".

**Actual:** the summary is built from the selected course's areas, ignoring the table's drill-down
and filter (`sa-dashboard.component.ts:531`). With `saShowCurrentOnly` true on production, only
areas scanned today count (`spatial-adjust-main.component.ts:67-89`); the average is of those
areas' averages, and HIGH and LOW are the extremes of today's scans
(`spatial-adjust-course.model.ts:98-99`). The chart's multiselect lists whatever level the table
shows, areas, holes or stations (`sa-dash-chart.component.ts:83-93`, `:108-150`), and the chart is
hidden on screens 1400 px wide or narrower (`sa-dashboard.component.less:91-103`). None of the
three panels prints the course name; the table's first crumb reads "Course"
(`sa-dash-table.component.ts:422-429`), and the name appears only in the toolbar's course dropdown
(`sa-main-toolbar.component.html:9-18`). All three do draw the selected course's data
(`sa-dashboard.component.ts:440-540`).

**Correction:** the tip says the figures summarise the areas scanned today whatever the table
shows; the chart sentence names the three levels and the narrow-screen behaviour; the verify item
says all three show the course selected in the toolbar.

**Claims:** dashboard-overview/1/7, dashboard-overview/3/2, dashboard-overview/verify/1.

## 25. Modelled values are marked with icons, not only italics

**Claimed:** a modelled child is shown "in grey italics" and "the parent row is marked the same
way"; "an italic average means at least one child is modelled"; a stale station's reading is
"shown in grey italics" and the calculation "still runs".

**Actual:** a modelled sprinkler row shows its value in the normal style with an orange
calculator icon (`sa-table-card.component.html:86-92`; `sa-table-card.component.less:121-130`).
A parent row gets a calculator icon beside its average when any sprinkler beneath it is modelled,
grey because of its parent class (`sa-table-card.component.html:29-31`;
`sa-table-card.component.ts:398-400`; `sa-table-card.component.less:112-116`). A row turns grey
and italic only when its own newest scan is not from today (`sa-table-item.model.ts:59-70`), that
is, when nothing beneath it was scanned today. A stale station is modelled only under Option 2
(`spatial-adjust-course.model.ts:184-188`); under Option 1 its % Adj. shows a dash and it is left
out of the pending list (`sa-table-card.component.html:51-62`;
`sa-dashboard.component.ts:621-624`).

**Correction:** the sentences name the orange icon on a modelled child and the grey icon on its
parent, keep grey italics for rows with nothing scanned today, and split the stale-scan
prerequisite of "Get fresh scan data" (written by the `new guide bodies` edit) by option.

**Claims:** station-details/4/2, station-details/4/3, understanding-vwc/5/3,
request-scan-data/before/1.

## 26. Switching off a parent does not switch off its children

**Claimed:** "Toggling a parent cascades"; turning a hole or area off "turns off everything
beneath it"; with the prompt suppressed "an area-level toggle silently changes every hole and
station under it"; disabled stations "show a grey switch"; a disabled station "is excluded from
adjustment entirely".

**Actual:** a plain click sets only that row's flag (`sa-table-card.component.ts:336-338`;
`SpatialAdjustService.cs:1262-1288`). The stations beneath it leave the push and the Enabled
Stations map because their parent is off (`sa-dashboard.component.ts:615-619`;
`sa-dash-map.component.ts:355-365`), but their own switches stay on. Only a Shift-click cascades
(`sa-table-card.component.ts:507-531`; `SpatialAdjustService.cs:1322-1383`), and it reports
"Cascade Disable for '<area>' complete" in the footer (`sa-table-card.component.ts:532-534`;
`en-us.json:384`). No label, tooltip or string mentions Shift. A disabled station still gets a
calculated suggestion; only the push list checks the switch (`sa-dashboard.component.ts:615-641`;
`SpatialAdjustService.cs:2976-3043`), so Lynx keeps what it already holds.

**Correction:** the step is retitled "Shift-click a parent to cascade" and says a plain click
takes the children out of the push without moving their switches. The tip names the Shift-click
and the footer message. The verify item accepts a grey parent switch. The "Why is this station
0%?" sentence says a disabled station is left out of every push, still has a suggestion, and so
does not by itself explain a zero.

**Claims:** enable-disable-stations/2/1, enable-disable-stations/2/2, enable-disable-stations/4/5,
enable-disable-stations/verify/1, station-zero/3/2.

## 27. The diagnostics chord works on a healthy dashboard

**Claimed:** the diagnostics dialog "only opens once Lynx data has failed to load … on a healthy
dashboard the chord does nothing".

**Actual:** the handler ignores the chord only while Lynx has neither failed nor been contacted
(`sa-main-toolbar.component.ts:293-299`). The dashboard contacts Lynx about a second after a
course is selected (`sa-dashboard.component.ts:731-733`), and the course information is stored
whatever the result (`lynx-proxy.service.ts:109-116`). A failed Lynx load also enables it
(`sa-main-toolbar.component.ts:221-223`).

**Correction:** the sentence, written by the `diagnostics dialog trigger` edit in
`src/transform-export.mjs`, now says the chord works a second or so after the page loads, and
also when Lynx data has failed to load.

**Claims:** station-zero/5/3.

## 28. Settings: the opening tab, Preferences and what a save recalculates

**Claimed:** the settings dialog "opens on whichever tab you last arrived at"; nothing in
Preferences "changes a single suggested percentage"; after saving calculation settings, "expect
the Suggested column to move on every row".

**Actual:** the dialog is created afresh on every opening and takes its tab from the toolbar
(`sa-main-toolbar.component.html:107-112`), which starts at Calculation
(`sa-main-toolbar.component.ts:87`) and changes only when Review Threshold in the Push Changes
dialog is used (`:239-244`; `sa-confirm-push-dlg.component.ts:99-102`). Units of Measure,
changed and saved in the same visit, rescales the Calculation amounts by 25.4 because they are
converted back with the unit selected at save time (`sa-settings-dlg.component.ts:422-427`), and
the changed amounts trigger a recalculation (`:452-455`). The recalculation reuses each station's
stored ET and deficit and re-applies the three settings (`SpatialAdjustService.cs:1884-1894`): a
new reference rescales every non-zero value, a new cap moves only stations at the old or new cap,
and a station at zero stays there. A saved % Adj. is not cleared (`:1019-1038`).

**Correction:** the three sentences say the dialog opens on Calculation unless Review Threshold
was used, that Units of Measure is the Preferences setting that can change suggestions, and which
rows a save moves.

**Claims:** minimum-threshold/1/3, preferences/1/3, calculation-settings/5/3.

## 29. Smaller corrections

**Finding a known station** (editing-station-targets/1/4). *Claimed:* "The flat All Stations tab
is faster when you already know the station name." *Actual:* All Stations is the drill-down
table (`sa-dashboard.component.html:37-43`); the flat list belongs to the Over/Under tab and holds
only outliers (`sa-dash-table.component.ts:161-266`). Clicking a station's map pin drills the
table to its hole and scrolls to the row (`sa-dash-map.component.ts:332-335`;
`sa-dash-table.component.ts:444-469`). *Correction:* the sentence teaches the pin.

**Reading the cap** (editing-station-targets/3/3). *Claimed:* a suggestion that "lands on the same
number as its neighbours" is capped. *Actual:* every capped station gets Daily Max Amount ÷ Lynx
Reference Amount × 100 (`SpatialAdjustService.cs:3041-3043`), but neighbours also share 0 and
round to the same whole percent for other reasons (`:3037-3039`). *Correction:* the sentence gives
the cap value.

**The Over/Under link** (filter-adjustments/2/2, filter-adjustments/before/2). *Claimed:* the link
is "to the right of the table toolbar", and a disabled station "never appears" in the filter.
*Actual:* the link sits below the two tabs, after BULK ADJUST
(`sa-table-threshold-filter.component.html:18-37`; `sa-table-threshold-filter.component.less:8-11`).
A disabled station is never caught by its own number (`sa-dashboard.component.ts:790`), but it
appears when an enabled station of the same name in its hole is caught, as part of that paired row
(`:785-795`; `sa-dash-table.component.ts:186-253`). *Correction:* both sentences, written by the
`new guide bodies` edit, say so.

**What the feature does** (understand-spatial-adjust/summary/1). *Claimed:* it turns "yesterday’s
moisture scan" into today's adjustment and writes it to Lynx. *Actual:* today's suggestion uses
today's scans (`SpatialAdjustService.cs:3001-3012`) and falls back to the model carried forward
only when there are none (`:3031-3032`); the write happens only when the user pushes
(`sa-push-changes.service.ts:208`). *Correction:* "the latest moisture scan", written to Lynx
"when you push".

## 30. Figures aligned with production, and the earlier figure fixes re-checked

The corrections in sections 11 to 29 changed captions and prose. This section covers the
reproduction (`SpatialAdjustApp.dc.html`) beside them, corrected in `src/transform-app.mjs` so
no figure contradicts its corrected caption, and re-checks the earlier figure fixes (sections 3,
6, 7, 8, 9 and 10) against production. Line numbers are at
`1aa4f28622cc3cc9637f0d61a438bf16bcf01924`.
Every "Observed" value was read from the built site with Playwright: open the guide, then query
the step's figure in the DOM.

**Earlier figure fixes, re-confirmed.** All five still match production.

| Item | Production | Observed in the built site |
|---|---|---|
| Map legend bands | Defaults 5, 19 and 30 when a user has saved none (`sa-dash-map.component.ts:48-50`) | Dashboard overview step 2: chips "0-5%", "6-19%", "20-30%", "> 30%" |
| Push dialog ticks | Pushed Today rows are unticked on load (`sa-confirm-push-dlg.component.ts:24`), and the tick is drawn only when the row is selected (`sa-confirm-push-dlg.component.html:95`, `:132`) | Push changes to Lynx step 2: six Available to Push rows ticked, six Pushed Today rows unticked |
| Push icon | Drawn only on an enabled station (`sa-table-card.component.html:51`) | Understanding VWC step 1: 17 of 18 station rows carry an icon; 5AP1, the disabled one, has none |
| Progress percentages | Percentage of a total of stations plus verify and retry steps, 99 at most before the end (`sa-push-changes.service.ts:197-201`, `:214-222`); read-back and verify each add half the verify steps (`:164-165`, `:62-65`); a retry restarts at zero (`:95-97`) | Verify results steps 1 to 4: 50%, 88%, 99%, 0% |
| Calculator marker | See below | See below |

The push-icon row in section 10 said the third clause of that condition rested on a flag whose
production value was unknown. It is known now: `saShowCurrentOnly` is true on production
(`environment.toro-prod.ts:87`). The clause hides the icon and replaces the % Adj. input with
`--` for a station whose scan is not current and is not modelled, which happens only under
Option 1. Every reproduced figure uses Option 2, where the one stale station, 7AP1, is modelled,
so no figure reaches that branch and it is still not reproduced.

**The calculator marker was right in kind but wrong in colour and placement.** The product draws
the icon orange (`sa-table-card.component.less:97-104`, `:121-128`) at the left of the cell, and
grey only on a row whose estimate is in a child (`:112-116`), which is a hole or area with a
modelled station beneath it, or a paired station with a modelled sprinkler
(`sa-table-card.component.html:29-31`; `sa-table-card.component.ts:398-400`;
`spatial-adjust-course.model.ts:102`). Only a row whose own newest scan is not from today is
greyed and italicised (`sa-table-card.component.less:107-110`), and a modelled sprinkler's
reading keeps the normal style (`sa-table-card.component.html:86-92`). The reproduction drew the
station icon in the row's grey, greyed and italicised the modelled sprinkler, and gave no icon to
6AP1 or hole 6.

Observed after the correction:

| Row | Figure | Icon | Reading |
|---|---|---|---|
| 7AP1 (scan two days old) | Understanding VWC step 2 | orange, rgb(255, 165, 0), left of the number | 50.0%, grey rgb(169, 169, 169), italic |
| 6AP1 (second sprinkler modelled) | Station details step 1 | grey, rgb(169, 169, 169) | 30.9%, normal |
| 6AP1-2 (the modelled sprinkler) | Station details step 2 | orange, rgb(255, 165, 0) | 30.4%, normal |
| Holes 6 and 7 | Enable and disable stations step 2 | grey, rgb(169, 169, 169) | normal |

**Target Profiles pane.** The pane drew three rows, and a footnote, first "Concept — this tab is
not in the shipping build." and then "In development — not in the shipping build yet." The
product has five slots per course (`sa-settings-dlg.component.ts:103-109`, `:383-392`), shows
`--` for Last Updated and Stations on an empty slot and disables its Apply action
(`sa-settings-dlg.component.html:205-214`), and has no footnote (`:177-226`). Observed in Apply a
target profile step 2: rows Spring `--` `--`, Summer Baseline 14 Jun 2026 148, Fall `--` `--`,
Winter `--` `--`, Tournament Week 02 May 2026 148; the Apply box is at opacity 0.45 on the three
empty slots and 1 on the two filled ones; no footnote text in the figure. The captions in
sections 12 and 13 describe this figure.

**Settings rail.** The rail listed Target Profiles only on its own tab. The product lists it
always, third of four (`sa-settings-dlg.component.ts:52-57`). Observed on the Calculation
settings, Preferences and Target Profiles figures: Calculation, Minimum Threshold, Target
Profiles, Preferences. Preferences moved down a row, so its cursor target moved with it, from
[666, 508] to [666, 566] (`settings rail: Preferences cursor below Target Profiles` in
`src/transform-export.mjs`). `scripts/cursor-target.mjs` now reports Preferences step 1
ON-TARGET, with "Preferences" under the cursor.

**Crop Coefficient under Option 1.** Option 1 disables it along with the two amounts
(`sa-settings-dlg.component.html:113-122`). Observed in Calculation methods: the Crop Coefficient
control is at opacity 0.45 in step 3, where Option 1 is selected, and 1 in step 1, where Option 2
is.

**Map.** The map drew every pin filled, including disabled 5AP1 and 7AP1, last scanned two days
ago, and its Layers panel showed All Stations selected. On production the Layers default is
Enabled Stations (`environment.toro-prod.ts:88`; `sa-dashboard.component.ts:504`), which skips
disabled stations (`sa-dash-map.component.ts:312`); a pin not scanned today is filled
transparent with a white outline (`:315`, `:322-329`); and pins are per sprinkler
(`sa-dashboard.component.ts:517-519`). Observed in Dashboard overview step 2: 24 pins, none for
5AP1; 7AP1's pin (50) and a second pin for 6AP1 (30, its two-day-old sprinkler) are transparent
with a 2px rgba(255, 255, 255, 0.4) outline; 6AP1's other sprinkler reads 31 rather than the
station average. Observed in Map navigation step 4: Enabled Stations selected, All Stations
clear. That matches the Layers tip added by `src/transforms/changed-surfaces.mjs` and the
caption of Enable and disable stations step 5, "Layers filtered to enabled stations only."

**Checks run:** `npm test`, `npm run test:guides` (26 guides render), `npm run test:fidelity`
(PASS, no label without product backing) and `npm run test:parity` (PASS).

## 31. In-person review, 2026-10-22: terminology, a caution and a softer calculation

**Source:** the walkthrough with the product experts. The triage is `docs/review-2026-10-22-feedback.md`.

**Terminology (T1 to T6).** The guides say *station*, never *pin* or *head*: the map plots each
station's sprinklers, and a station is what a reader adjusts. The estimated value is *modeled*, not
"fallback"; the statistical figure is the *average*, not the "mean" (a verb such as "means" is
untouched); spelling is American English; and the Target Profiles notice reads "New in Spatial
Adjust". Bulk adjustments say "an entire hole". CSS classes, ids and code identifiers keep their
names.

**Content.** Only Target VWC, % Adj. and the Enable switch are editable at station level; Current and
Suggested are not (`sa-table-card.component.html:40-68`). Average VWC comes from a measured scan and
is modeled when there is none, said once in Understand Spatial Adjust. The early "black text,
today's date" caption in Understanding VWC is dropped. The percent adjustment step says why to
override (a suggestion that looks too high or too low). The example profile name is "Overseed", not
"Overseed Recovery". Applying a profile is course-wide, so the guide says to check the Suggested
column before pushing.

**Profile matching (confirmed by an expert, and read at the production pin).** A profile stores
station names with their targets. Applying it matches those names against the stations on the
course and sets the target only on a match; a name with no station is skipped, and a station added
later is not touched (`SpatialAdjustService.cs:426-460` for the matching count, `:742-745`,
`:801-818` for the name lookups, `:868-930` for the apply loop). A renamed or renumbered station
therefore does not match an old profile. The Apply a target profile and Managing seasonal
profiles guides carry a one-line caution on the choose step.

**Calculation prose.** The guides describe what influences the suggestion (the gap to the target,
today's ET and the daily maximum) and no longer spell out the arithmetic, because the soil factor
and later adjustments will change it. The claims behind the removed detail stay in the ledger and
in `docs/claims/calculations.md`.

**Band colors.** The map legend's boundaries are the reader's to change and are saved to the
reader's preferences (`sa-map-overlay.component.ts:120-132`). The three boundaries are the only
thing the product lets a reader move; the band colors come from a fixed set
(`toro.enums.ts`, `SaRangeColor`), so the guides say *boundaries* and not *colors*.

**Where it lives.** Terminology and wording edits to export text are in
`src/transforms/review-fixes.mjs`; the rest are in `src/rewrite/` and the transforms that wrote the
text. The catalogues are re-keyed to the new English in all ten locales.

## Checked and found correct — no change made

**Push recovery.** The guides say Spatial Adjust re-reads the station list, compares each
value against what Lynx reports, treats mismatches as failed, and retries automatically "up
to two further attempts after the first", making a manual re-push "a fourth attempt". All of
that is accurate: the retry limit is two attempts after the first
(`sa-push-changes.service.ts:30`), and after the read-back a station counts as failed when the
percent adjust Lynx reports differs from the one sent (`:75-81`).

An earlier audit finding claimed the guides advised re-pushing in a way the product does not
support, and that push "reports success it cannot know". Both were wrong — reconcile-and-retry
exists and the guide describes it correctly. Recorded here so the finding is not raised again.
