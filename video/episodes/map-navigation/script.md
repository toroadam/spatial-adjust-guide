# Double Click #3: Map navigation

**Episode:** 3 of 26 · **Wave:** 1 (Getting Started) · **Guide:** `#/map-navigation` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "The course, coloured by measured moisture."; step 2 "Dragging a handle changes the boundary"; step 3 "The course, coloured by measured moisture."; step 4 "The course, coloured by measured moisture."; step 5 "One selection, shown in both panels."

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Map navigation** | — | "Read the pins, move the moisture bands, switch to variance, and filter what the map shows." | `map-navigation/tile/1`, `map-navigation/tile/2`, `map-navigation/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | PINS ARE COLOURED BY MEASURED MOISTURE | — | `map-navigation/1/1` (the step title) |
| 0:09 | 0:25 | 4 Step 1 | Push in on the map: the cursor visits a green, a blue and a red pin, then rests on a clear pin |  | "Each sprinkler of a station scanned in the past seven days is a pin at its own coordinates. A pin scanned today is filled with the colour of the moisture band its reading falls into, and a pin last scanned on an earlier day is drawn clear." | `map-navigation/1/2`, `map-navigation/1/3` |
| 0:25 | 0:33 | 5 Step 1 result | The legend is highlighted; the cursor runs along its four bands |  | "Four bands by default: 0 to 5, 6 to 19, 20 to 30, and above 30 percent." | `map-navigation/1/5` |
| 0:33 | 0:35 | 6 Chapter 2 | Typed chapter card | MOVE THE BAND BOUNDARIES | — | `map-navigation/2/1` (the step title) |
| 0:35 | 0:43 | 7 Step 2 | Push in on the legend: the colour bar under it is highlighted, and the cursor rests on the boundaries between its bands (no handle is dragged) |  | "The colour bar under the legend has draggable handles. Move one and the map recolours when you let go." | `map-navigation/2/2`, `map-navigation/2/3` |
| 0:43 | 0:49 | 8 Step 2 result | Hold on the colour bar, highlighted |  | "Dragging a handle changes the boundary and saves it to your preferences." | `map-navigation/2/4` |
| 0:49 | 0:50 | 9 Chapter 3 | Typed chapter card | SWITCH TO VARIANCE | — | `map-navigation/3/1` (the step title) |
| 0:50 | 0:57 | 10 Step 3 | The cursor moves to the button beside the legend; the map switches to variance, and the variance legend is highlighted |  | "The button beside the legend toggles between VWC and variance." | `map-navigation/3/2` |
| 0:57 | 1:07 | 11 Step 3 result | The cursor visits pins in each variance band: below target, near target and above target |  | "Variance colours each pin by how far it sits from its own target instead of by its raw reading: three bands, centred on target." | `map-navigation/3/3`, `map-navigation/3/4` |
| 1:07 | 1:08 | 12 Chapter 4 | Typed chapter card | FILTER WITH LAYERS | — | `map-navigation/4/1` (the step title) |
| 1:08 | 1:17 | 13 Step 4 | The cursor goes to **LAYERS**; its menu opens with **All Stations** and **Enabled Stations**, highlighted |  | "Layers chooses which stations are drawn: all of them, or only the enabled ones." | `map-navigation/4/2` |
| 1:17 | 1:28 | 14 Step 4 result | **Enabled Stations**, the selected option, is highlighted |  | "Disabled stations are not being adjusted, so hiding them leaves only the heads your push will affect. Layers saves your choice to your user preferences." | `map-navigation/4/3`, `map-navigation/4/5` |
| 1:28 | 1:29 | 15 Chapter 5 | Typed chapter card | MAP AND TABLE STAY IN SYNC | — | `map-navigation/5/1` (the step title) |
| 1:29 | 1:37 | 16 Step 5 | The cursor rests on the selected row **6AP1** in the table, then moves to a pin on the map |  | "Selecting a station in the table highlights it on the map, and selecting a pin selects the row." | `map-navigation/5/2` |
| 1:37 | 1:44 | 17 Step 5 result | Push in on the table: the cursor returns to the selected row, highlighted |  | "One selection, shown in both panels. Use whichever is faster to find the head you mean." | `map-navigation/5/4`, `map-navigation/5/3` |
| 1:44 | 1:49 | 18 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Understanding VWC**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/map-navigation` goes in the published description | — | — | — |

**VO total:** 218 words in 11 lines, about 75 s spoken (measured). **Running time:** about 1:49 (109 s); the target is 1:30-2:15, inside the series range of 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/map-navigation`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- map-navigation` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

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
