# Double Click #4: Understanding VWC

**Episode:** 4 of 26 · **Wave:** 1 (Getting Started) · **Guide:** `#/understanding-vwc` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "A current scan: black text, today"; step 2 "Station 7AP1 has no current scan"; step 3 "Target VWC accepts 0 to 50"; step 4 "Target minus measured, per station"; step 5 "Hole rows: average measured"

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Understanding VWC** | — | "Three different numbers wear the label VWC. Knowing which one you are reading explains most surprises." | `understanding-vwc/tile/1`, `understanding-vwc/tile/2`, `understanding-vwc/summary/1`, `understanding-vwc/summary/2` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | MEASURED: THE SCAN MEAN | — | `understanding-vwc/1/1` (the step title) |
| 0:09 | 0:18 | 4 Step 1 | Push in on the table: **Avg. VWC** is highlighted; the cursor moves to the first station's scan date, then its reading |  | "When the scan date is today, Avg. VWC is the mean moisture TurfRad measured across that station." | `understanding-vwc/1/2`, `understanding-vwc/1/3` |
| 0:18 | 0:26 | 5 Step 1 result | The current reading **27.6%** is highlighted, in black text |  | "It is a measurement, and it is the number the calculation prefers. A current scan: black text, today's date." | `understanding-vwc/1/4`, `understanding-vwc/1/5` |
| 0:26 | 0:28 | 6 Chapter 2 | Typed chapter card | MODELLED: THE FALLBACK | — | `understanding-vwc/2/1` (the step title) |
| 0:28 | 0:38 | 7 Step 2 | The row for station **7AP1** is highlighted; the cursor goes to its older scan date |  | "When the scan is not current, Spatial Adjust falls back to a modelled value carried forward from the last scan and the weather since." | `understanding-vwc/2/2` |
| 0:38 | 0:49 | 8 Step 2 result | The modelled value **50.0%**, grey and italic with its calculator icon, is highlighted |  | "It is shown in grey italics so you can tell it apart at a glance. Station 7AP1 has no current scan; the value shown is modelled." | `understanding-vwc/2/3`, `understanding-vwc/2/4` |
| 0:49 | 0:50 | 9 Chapter 3 | Typed chapter card | TARGET: YOUR INPUT | — | `understanding-vwc/3/1` (the step title) |
| 0:50 | 1:02 | 10 Step 3 | Push in on **Target VWC**, highlighted; the cursor moves to the first target input |  | "Target VWC is a whole number from 0 to 50 that you set per station. Higher targets ask for more water." | `understanding-vwc/3/2`, `understanding-vwc/3/3` |
| 1:02 | 1:07 | 11 Step 3 result | The target input is highlighted beside the read-only Avg. VWC |  | "It is the only VWC on the row you can type into." | `understanding-vwc/3/4` |
| 1:07 | 1:08 | 12 Chapter 4 | Typed chapter card | THE DELTA IS WHAT DRIVES THE SUGGESTION | — | `understanding-vwc/4/1` (the step title) |
| 1:08 | 1:17 | 13 Step 4 | The cursor moves from a station's Avg. VWC to its Target VWC, each highlighted |  | "Subtract the working VWC from the target and you have the deficit the calculation must close." | `understanding-vwc/4/2` |
| 1:17 | 1:28 | 14 Step 4 result | The cursor goes to today's ET in the toolbar, then back to the station's suggested percentage, highlighted |  | "Add today's ET, cap it at the daily maximum, and express it against the Lynx reference amount. Target minus measured, per station, is the whole idea." | `understanding-vwc/4/3`, `understanding-vwc/4/4` |
| 1:28 | 1:30 | 15 Chapter 5 | Typed chapter card | AGGREGATE ROWS AVERAGE THEIR CHILDREN | — | `understanding-vwc/5/1` (the step title) |
| 1:30 | 1:41 | 16 Step 5 | Push in on the table at hole level: the breadcrumb reads Riverbend National / AP; the cursor moves along a hole row's averages and its latest scan date |  | "At hole and area level the same two columns show averages rather than readings, and the scan date column shows the most recent scan beneath that row." | `understanding-vwc/5/2` |
| 1:41 | 1:48 | 17 Step 5 result | Hole 6's average **29.7%**, with the grey calculator icon, is highlighted |  | "A grey calculator icon on a hole or area row means at least one station beneath it is modelled." | `understanding-vwc/5/3` |
| 1:48 | 1:53 | 18 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Understand suggested adjustments**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/understanding-vwc` goes in the published description | — | — | — |

**VO total:** 223 words in 11 lines, about 81 s spoken (measured). **Running time:** about 1:53 (114 s); the target is 1:30-2:15, inside the series range of 60-180 s. **Measured:** 2:12 (131.5 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/understanding-vwc`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- understanding-vwc` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

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
