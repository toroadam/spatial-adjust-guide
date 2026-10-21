# Double Click #10: Editing station targets

**Episode:** 10 of 26 · **Wave:** 3 (Station Management), first of the wave · **Guide:** `#/editing-station-targets` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Hole rows for area AP"; step 2 "Target VWC on station"; step 3 "Suggested follows the target"; step 4 "The pending icon marks".

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Editing station targets** | — | "Change one station's target, and watch what it does to the suggestion." | `editing-station-targets/tile/1`, `editing-station-targets/tile/2`, `editing-station-targets/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | DRILL DOWN TO THE STATION | — | `editing-station-targets/1/1` (the step title) |
| 0:09 | 0:19 | 4 Step 1 | Push in on the table breadcrumb: the cursor rests on the course, then on **AP** |  | "The table drills from course to areas, then holes, then stations. Breadcrumbs at the top left take you back up a level." | `editing-station-targets/1/2`, `editing-station-targets/1/3` |
| 0:19 | 0:28 | 5 Step 1 result | The cursor goes to a pin on the map, then to a hole row of the table |  | "If you already know where the station is, click its pin on the map: the table drills straight to its hole and scrolls to the row." | `editing-station-targets/1/4` |
| 0:28 | 0:30 | 6 Chapter 2 | Typed chapter card | TYPE THE NEW TARGET | — | `editing-station-targets/2/1` (the step title) |
| 0:30 | 0:38 | 7 Step 2 | The figure swaps to the station rows; the **Target VWC** field of station **9AP1** is highlighted, no value is typed |  | "The Target VWC field takes a whole number between 0 and 50." | `editing-station-targets/2/2` |
| 0:38 | 0:45 | 8 Step 2 result | The cursor returns to the **Target VWC** field of **9AP1**, then to its **Suggested** value, highlighted |  | "Raising it increases the deficit and therefore the suggestion; lowering it does the opposite." | `editing-station-targets/2/3` |
| 0:45 | 0:47 | 9 Chapter 3 | Typed chapter card | READ THE NEW SUGGESTION | — | `editing-station-targets/3/1` (the step title) |
| 0:47 | 0:53 | 10 Step 3 | The **Suggested** column header is highlighted; the cursor moves to the value for **9AP1** |  | "The Suggested column recalculates against the new target." | `editing-station-targets/3/2` |
| 0:53 | 1:05 | 11 Step 3 result | The cursor visits two stations whose **Suggested** value sits at the top, 333% |  | "If it lands on the top value, Daily Max Amount divided by Lynx Reference Amount times 100, the daily maximum is capping it rather than the target deciding it." | `editing-station-targets/3/3` |
| 1:05 | 1:06 | 12 Chapter 4 | Typed chapter card | OVERRIDE THE PERCENTAGE IF YOU NEED TO | — | `editing-station-targets/4/1` (the step title) |
| 1:06 | 1:14 | 13 Step 4 | The **% Adj.** column header is highlighted; the cursor moves to the field for **9AP1** |  | "The % Adj. field is separate from the target and accepts 0 to 900." | `editing-station-targets/4/2` |
| 1:14 | 1:27 | 14 Step 4 result | The **% Adj.** field of **9AP1**, with its pending icon, is highlighted; the cursor moves to **Suggested** beside it |  | "Editing it queues the station for push when the station is enabled and the new value differs from the Current value in Lynx. The Suggested value stays visible beside it for comparison." | `editing-station-targets/4/3` |
| 1:27 | 1:36 | 15 Close | Up next **Next on Double Click: Apply a bulk adjustment**; end card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/editing-station-targets` goes in the published description | — | — | — |

**VO total:** 169 words in 9 lines, about 55 s spoken (measured). **Running time:** about 1:36 (97 s); the series range is 60-180 s. **Measured:** 1:49 (108.7 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Writes declared (all on `/demo`, none performed):** `target-edit` (chapter c2, "18"). Typing is not filmed: the director has no type action, so the field is highlighted and its result is shown from the recreation (the target edit is short-circuited silently in Demo Mode, `video/capture/SAFETY.md:102`).

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/editing-station-targets`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- editing-station-targets` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim.

## Voice-over check

Whisper round-trip on 2026-10-20 (`video/vo/whisper_check.py`, model small.en, with medium.en on any line small.en flagged); reports `vo/whisper-report-<model>.json` under the media root. 7 of 9 lines matched word for word on small.en. The two differences are 'breadcrumbs' heard as 'bread crumbs' (a compound; medium.en matched it) and 'queues' heard as 'cues' (a homophone, both models), judged by the executor as Whisper's, not misreadings; no line was re-rendered. The lines were rendered at the API output format mp3_44100_128, because the account's plan no longer allows mp3_44100_192 (the render report records the format); voice, model and settings are unchanged.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
