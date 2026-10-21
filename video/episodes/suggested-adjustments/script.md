# Double Click #5: Understand suggested adjustments

**Episode:** 5 of 26 · **Wave:** 2 (Review & Apply), first of the wave · **Guide:** `#/suggested-adjustments` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Current and Suggested sit"; step 2 "Station 3AP1 measured"; step 3 "A run of identical"; step 4 "Editing % Adj. queues"; step 5 "Soil Factor Editor, opened"

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Understand suggested adjustments** | — | "Where the suggested percentage comes from, why it caps out, and when you should override it." | `suggested-adjustments/tile/1`, `suggested-adjustments/tile/2`, `suggested-adjustments/summary/1` |
| 0:08 | 0:10 | 3 Chapter 1 | Typed chapter card | FIND THE TWO ADJUSTMENT COLUMNS | — | `suggested-adjustments/1/1` |
| 0:10 | 0:19 | 4 Step 1 | **Current** is highlighted; the cursor moves to `Current`, then `100%`, then `Suggested` |  | "Current is the percent adjust Lynx holds for the station right now. Suggested is what Spatial Adjust calculated from this morning's scan." | `suggested-adjustments/1/2`, `suggested-adjustments/1/3` |
| 0:19 | 0:27 | 5 Step 1 result | Focus box on `Adjustment`; the cursor settles on `333%`, then `Adjustment`, then `100%` |  | "The gap between them is the change you are being asked to make. Current and Suggested sit side by side under the Adjustment heading." | `suggested-adjustments/1/4`, `suggested-adjustments/1/5` |
| 0:27 | 0:29 | 6 Chapter 2 | Typed chapter card | READ IT AGAINST AVG. VWC AND TARGET VWC | — | `suggested-adjustments/2/1` |
| 0:29 | 0:35 | 7 Step 2 | Lifted figure "Station 3AP1 measured"; **Avg. VWC** is highlighted; the cursor moves to `Avg. VWC`, then `Target VWC` |  | "A station well under target asks for more water; one over target asks for less." | `suggested-adjustments/2/3` |
| 0:35 | 0:46 | 8 Step 2 result | Focus box on `3AP1 08-08-25 27.6% 54 %`; the cursor settles on `27.6%`, then `3AP1 08-08-25 27.6% 54 %`, then `54` |  | "Station 3AP1 measured 27.6 percent against a 54 percent target. That is the largest deficit on the hole." | `suggested-adjustments/2/4` |
| 0:46 | 0:48 | 9 Chapter 3 | Typed chapter card | NOTICE WHERE SUGGESTIONS CLUSTER | — | `suggested-adjustments/3/1` |
| 0:48 | 1:00 | 10 Step 3 | Lifted figure "A run of identical"; **suggested** is highlighted; the cursor moves to `Suggested`, then `333%` |  | "Several stations show the same suggested value. That is the daily Max Amount cap: once the required amount exceeds the cap, every station above it lands on the same percentage." | `suggested-adjustments/3/2`, `suggested-adjustments/3/3` |
| 1:00 | 1:12 | 11 Step 3 result | Focus box on `333%`; the cursor settles on `333%` |  | "If most of your course reads identically, the cap is doing the deciding, not the scan. Raise Daily Max Amount in Settings, Calculation, or accept that the course is being deliberately limited." | `suggested-adjustments/3/4`, `suggested-adjustments/3/6` |
| 1:12 | 1:14 | 12 Chapter 4 | Typed chapter card | OVERRIDE WHERE YOU DISAGREE | — | `suggested-adjustments/4/1` |
| 1:14 | 1:23 | 13 Step 4 | Lifted figure "Editing % Adj. queues"; **% Adj.** is highlighted; the cursor moves to `% Adj.`, then `333 %` |  | "The percent adjustment column is yours. Type over the suggestion for a station you know behaves differently, and the row is queued for push." | `suggested-adjustments/4/2`, `suggested-adjustments/4/3` |
| 1:23 | 1:32 | 14 Step 4 result | Focus box on `333 %`; the cursor settles on `333%`, then `333 %`, then `Push 6 Changes` |  | "The suggested value is left untouched underneath. Editing queues the station when the new value differs from what Lynx holds." | `suggested-adjustments/4/4`, `suggested-adjustments/4/5` |
| 1:32 | 1:33 | 15 Chapter 5 | Typed chapter card | SET A SOIL FACTOR FOR PERSISTENT OFFSETS | — | `suggested-adjustments/5/1` |
| 1:33 | 1:40 | 16 Step 5 | Lifted figure "Soil Factor Editor, opened"; **Shift** is highlighted; the cursor moves to `Soil Factor Editor`, then `Soil Factor (%)` |  | "The soil factor editor scales a station's calculated amount by 1 to 200 percent, permanently." | `suggested-adjustments/5/3` |
| 1:40 | 1:44 | 17 Step 5 result | Focus box on `gear`; the cursor settles on `gear` |  | "It is opened with Shift plus Alt on the gear button in the toolbar." | `suggested-adjustments/5/4`, `suggested-adjustments/5/5` |
| 1:44 | 1:49 | 18 Up next | **Next on Double Click: Filter by % Adj.** | — | — | — |
| 1:49 | 1:54 | 19 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/suggested-adjustments` goes in the published description | — | — | — |

**VO total:** 230 words in 11 lines, about 83 s spoken (measured). **Running time:** about 1:54 (114 s); the series range is 60-180 s. **Measured:** 2:17 (137.0 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/suggested-adjustments`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- suggested-adjustments` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). Not narrated, because they are not Verified: `suggested-adjustments/2/2`, `suggested-adjustments/5/2`.

The calculation sentence of step 2 (`suggested-adjustments/2/2`) and the "override the same station every day" sentence of step 5 (`suggested-adjustments/5/2`) are Needs expert claims, so the draft's lines that carried them are cut; step 2 narrates only the verified under-target and over-target sentence and its caption. `suggested-adjustments/3/6` (raise Daily Max Amount in Settings, Calculation) is Verified and is narrated.

## Voice-over check

Whisper round-trip on 2026-10-20 (`video/vo/whisper_check.py`, model small.en, with medium.en on any line small.en flagged); reports `vo/whisper-report-<model>.json` under the media root. The differences left are spelling (US and UK forms, compounds written as one or two words), homophones and run-together sounds, judged by the executor as Whisper's, not misreadings: "A P" heard as "ap" (V2b) and "queues" heard as "cues" (V4b). No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
