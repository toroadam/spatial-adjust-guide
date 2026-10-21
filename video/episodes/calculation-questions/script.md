# Double Click #21: Calculation questions

**Episode:** 21 of 26 · **Wave:** 5 (Troubleshooting) · **Guide:** `#/calculation-questions` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "A run of identical values is the cap, not a fault"; step 2 "Max Amount over Lynx Reference Amount sets the ceiling"; step 3 "Where a value is absent the column shows a dash, not a zero"; step 4 "A modelled value: grey and italic"; step 5 "Diagnostics: TurfRad access, scan data, last scan date". Every chapter carries a `sourceReason`; no control is clicked in the recreation, so no retry, push or scan request is made anywhere.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Calculation questions** | — | "Identical suggestions, missing values and stale scans: three things that look like bugs, and are not." | `calculation-questions/tile/1`, `calculation-questions/tile/2`, `calculation-questions/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | IDENTICAL SUGGESTIONS ACROSS MANY STATIONS | — | `calculation-questions/1/1` (the step title) |
| 0:09 | 0:17 | 4 Step 1 | Push in on **333%**, highlighted; the cursor moves to 333% |  | "When the required amount exceeds the daily maximum, every station above the cap lands on the same percentage." | `calculation-questions/1/2` |
| 0:17 | 0:22 | 5 Step 1 result | Hold on the screen; the cursor moves to 333% |  | "A run of identical numbers means the cap is deciding, not the scan." | `calculation-questions/1/3`, `calculation-questions/1/4` |
| 0:22 | 0:23 | 6 Chapter 2 | Typed chapter card | WORK OUT YOUR OWN CEILING | — | `calculation-questions/2/1` (the step title) |
| 0:23 | 0:31 | 7 Step 2 | The lifted figure for step 2. Push in on **Daily Max Amount (in)**, highlighted; the cursor moves to Suggested Percent Adjust Calculation, then Daily Max Amount (in), then Lynx Reference Amount (in) |  | "The maximum possible suggestion is the daily maximum divided by the Lynx reference amount." | `calculation-questions/2/2`, `calculation-questions/2/4` |
| 0:31 | 0:38 | 8 Step 2 result | Hold on the screen; the cursor moves to Lynx Reference Amount (in), then Daily Max Amount (in) |  | "Change either number and the ceiling moves, which is the honest fix if the ceiling is too low for your course." | `calculation-questions/2/3` |
| 0:38 | 0:40 | 9 Chapter 3 | Typed chapter card | A DASH INSTEAD OF A NUMBER | — | `calculation-questions/3/1` (the step title) |
| 0:40 | 0:48 | 10 Step 3 | The lifted figure for step 3. Push in on **0%**, highlighted; the cursor moves to 0% |  | "A dash means there is nothing to show: no current scan, and no modelled value either." | `calculation-questions/3/2` |
| 0:48 | 0:56 | 11 Step 3 result | Hold on the screen; the cursor moves to 0% |  | "It is not zero, and it is not an error in the calculation. The station has no data to calculate from." | `calculation-questions/3/3`, `calculation-questions/3/4` |
| 0:56 | 0:57 | 12 Chapter 4 | Typed chapter card | GREY ITALICS MEAN MODELLED | — | `calculation-questions/4/1` (the step title) |
| 0:57 | 1:05 | 13 Step 4 | The lifted figure for step 4. Push in on **50.0%**, highlighted; the cursor moves to 08-06-25 |  | "A greyed, italic average means the value came from the model, rather than a scan taken that day." | `calculation-questions/4/2`, `calculation-questions/4/4` |
| 1:05 | 1:10 | 14 Step 4 result | Hold on the screen; the cursor moves to the 7AP1 row |  | "The calculation still runs, but it is running on an estimate." | `calculation-questions/4/3` |
| 1:10 | 1:12 | 15 Chapter 5 | Typed chapter card | IF THE WHOLE COURSE IS STALE, CHECK THE SOURCE | — | `calculation-questions/5/1` (the step title) |
| 1:12 | 1:22 | 16 Step 5 | The lifted figure for step 5. Push in on **Spatial Adjust Diagnostics**, highlighted; the cursor moves to Spatial Adjust Diagnostics, then SA has org access:, then Org has scan data:, then Last scan date: |  | "The diagnostics dialog reports whether the organisation has TurfRad access, whether it has scan data at all, and the last scan date." | `calculation-questions/5/2`, `calculation-questions/5/6` |
| 1:22 | 1:35 | 17 Step 5 result | Hold on the screen; the cursor moves to Last scan date:, then ⟳ |  | "If access and scan data are both fine and only the date is old, use Request latest scan data in the toolbar. It cannot make TurfRad scan, so if TurfRad has nothing newer, the date will not change." | `calculation-questions/5/4`, `calculation-questions/5/5` |
| 1:35 | 1:45 | 18 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Push failures**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/calculation-questions` goes in the published description | — | — | — |

**VO total:** 208 words in 11 lines, about 68 s spoken (measured). **Running time:** about 1:45 (106 s); the series range is 60-180 s. **Measured:** 2:01 (121 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/calculation-questions`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- calculation-questions` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). None of this guide's claims is Needs expert or Not shipping.

## Voice-over check

Whisper small.en on all 11 lines, medium.en on the 3 flagged. Differences are Whisper's: "modelled", "greyed" (heard as "great" by small.en and "grayed" by medium.en), "organisation", "dialog", and "Turf Rad" heard as "turf rat". No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
