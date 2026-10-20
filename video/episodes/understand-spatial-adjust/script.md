# Double Click #2: Understand Spatial Adjust

**Episode:** 2 of 26 · **Wave:** 1 (Getting Started) · **Guide:** `#/understand-spatial-adjust` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "The Spatial Adjust header, inside IntelliDash."; step 2 "Measured moisture and its scan date, per station."; step 3 "Target VWC is an editable input, not a reading."; step 4 "The Suggested column is the output of that chain."; step 5 "Push Changes is the only thing that writes to the controller."

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Understand Spatial Adjust** | — | "What the feature actually does: turn the latest moisture scan into today's percent adjustment, and write it to Lynx when you push." | `understand-spatial-adjust/tile/1`, `understand-spatial-adjust/tile/2`, `understand-spatial-adjust/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | IT LIVES INSIDE INTELLIDASH | — | `understand-spatial-adjust/1/1` (the step title) |
| 0:09 | 0:15 | 4 Step 1 | Push in on the header: the Spatial Adjust lockup is highlighted, then the cursor rests on the site name |  | "It lives inside IntelliDash. Access is checked per user before the view loads." | `understand-spatial-adjust/1/1`, `understand-spatial-adjust/1/4` |
| 0:15 | 0:19 | 5 Step 1 result | Hold on the Spatial Adjust header, highlighted |  | "The Spatial Adjust header, inside IntelliDash." | `understand-spatial-adjust/1/5` |
| 0:19 | 0:21 | 6 Chapter 2 | Typed chapter card | TURFRAD SUPPLIES THE MEASUREMENT | — | `understand-spatial-adjust/2/1` (the step title) |
| 0:21 | 0:35 | 7 Step 2 | Push in on the table: **Avg. VWC** is highlighted, the cursor moves to the first station's reading, then to its scan date beside the station name |  | "Each station's Avg. VWC comes from a TurfRad moisture scan: the mean volumetric water content measured across the station, with the date it was captured beside the station name." | `understand-spatial-adjust/2/2`, `understand-spatial-adjust/2/3` |
| 0:35 | 0:39 | 8 Step 2 result | The cursor runs down the Avg. VWC column, highlighted |  | "Measured moisture and its scan date, per station." | `understand-spatial-adjust/2/4` |
| 0:39 | 0:41 | 9 Chapter 3 | Typed chapter card | YOU SUPPLY THE TARGET | — | `understand-spatial-adjust/3/1` (the step title) |
| 0:41 | 0:52 | 10 Step 3 | Push in on **Target VWC**, highlighted; the cursor moves down the target inputs |  | "Target VWC is the moisture you want that station to hold. It is yours to set, station by station, between 0 and 50 percent." | `understand-spatial-adjust/3/2`, `understand-spatial-adjust/3/3` |
| 0:52 | 1:01 | 11 Step 3 result | The cursor moves from a station's measured Avg. VWC to its target input, both highlighted |  | "The gap between measured and target is what the calculation works on. Target VWC is an editable input, not a reading." | `understand-spatial-adjust/3/4`, `understand-spatial-adjust/3/5` |
| 1:01 | 1:03 | 12 Chapter 4 | Typed chapter card | SPATIAL ADJUST DOES THE ARITHMETIC | — | `understand-spatial-adjust/4/1` (the step title) |
| 1:03 | 1:17 | 13 Step 4 | The cursor follows the chain across the screen: a station's target and measured moisture, today's ET in the toolbar, then the **Suggested** column |  | "The difference between target and measured moisture becomes an amount of water, today's ET is added, the daily maximum caps it, and the result is divided by the Lynx reference amount to give a percentage." | `understand-spatial-adjust/4/2` |
| 1:17 | 1:21 | 14 Step 4 result | **Suggested** is highlighted, with the first station's suggested percentage |  | "The Suggested column is the output of that chain." | `understand-spatial-adjust/4/3` |
| 1:21 | 1:23 | 15 Chapter 5 | Typed chapter card | LYNX RUNS THE WATER | — | `understand-spatial-adjust/5/1` (the step title) |
| 1:23 | 1:29 | 16 Step 5 | Push in on the right of the toolbar; the cursor comes to rest on **Push 6 Changes** |  | "Spatial Adjust never waters anything. Nothing changes until you push." | `understand-spatial-adjust/5/2`, `understand-spatial-adjust/5/4` |
| 1:29 | 1:33 | 17 Step 5 result | **Push 6 Changes** highlighted, never clicked |  | "Push Changes is the only thing that writes to the controller." | `understand-spatial-adjust/5/5` |
| 1:33 | 1:38 | 18 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Map navigation**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/understand-spatial-adjust` goes in the published description | — | — | — |

**VO total:** 188 words in 11 lines, about 68 s spoken (measured). **Running time:** about 1:38 (99 s); the target is 1:30-2:15, inside the series range of 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/understand-spatial-adjust`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- understand-spatial-adjust` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim, and none of this guide's steps has a claim that is not Verified.

## Voice-over check

Whisper round-trip on 2026-10-20 (`video/vo/whisper_check.py`, model small.en, with medium.en on any line small.en flagged); reports `vo/whisper-report-<model>.json` under the media root. The remaining differences are spelling (US and UK forms, compounds written as one or two words), homophones and run-together sounds, judged by the executor as Whisper's, not misreadings; no line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
