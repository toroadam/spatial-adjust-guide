# Double Click #11: Apply a bulk adjustment

**Episode:** 11 of 26 · **Wave:** 3 (Station Management) · **Guide:** `#/bulk-adjustments` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Five stations selected"; step 2 "Five stations selected"; step 3 "Bulk Adjust dialog"; step 4 "Shift by".

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Apply a bulk adjustment** | — | "Change the Target VWC of many stations at once, either by replacing every value or by shifting them all by the same amount." | `bulk-adjustments/tile/1`, `bulk-adjustments/tile/2`, `bulk-adjustments/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | SELECT THE STATIONS | — | `bulk-adjustments/1/1` (the step title) |
| 0:09 | 0:22 | 4 Step 1 | Push in on the station rows: the cursor visits the ticked checkboxes, the first one highlighted |  | "Tick the checkbox on each station row. Ticking an area or hole row cascades the selection to everything beneath it, so you can take a whole hole in one click." | `bulk-adjustments/1/2`, `bulk-adjustments/1/3` |
| 0:22 | 0:28 | 5 Step 1 result | The **BULK ADJUST** link above the table is highlighted: five stations are selected, so it is active |  | "Five stations selected. The Bulk Adjust link above the table becomes active." | `bulk-adjustments/1/4`, `bulk-adjustments/1/5` |
| 0:28 | 0:30 | 6 Chapter 2 | Typed chapter card | OPEN BULK ADJUST | — | `bulk-adjustments/2/1` (the step title) |
| 0:30 | 0:35 | 7 Step 2 | The **BULK ADJUST** link sits above the table; the cursor moves to the threshold filter beside it |  | "The link sits above the table beside the threshold filter." | `bulk-adjustments/2/2` |
| 0:35 | 0:45 | 8 Step 2 result | The figure swaps to the open dialog; the count **5 Stations selected** at the top is highlighted |  | "The dialog opens with the count of stations you selected at the top. Check it before going further." | `bulk-adjustments/2/3` |
| 0:45 | 0:46 | 9 Chapter 3 | Typed chapter card | CHOOSE REPLACE OR SHIFT | — | `bulk-adjustments/3/1` (the step title) |
| 0:46 | 0:59 | 10 Step 3 | Push in on the dialog: **Replace** is highlighted, then the cursor moves to **Shift** |  | "Replace overwrites every selected station with the value you enter. Shift moves each station up or down by that amount, keeping the differences between them." | `bulk-adjustments/3/2`, `bulk-adjustments/3/3` |
| 0:59 | 1:10 | 11 Step 3 result | The figure swaps to the dialog with **Shift** chosen; the cursor rests on the amount, minus 5 percent |  | "Shift is the safer choice when the stations were individually tuned. Here it shifts by minus 5 percent, preserving the relative targets." | `bulk-adjustments/3/4`, `bulk-adjustments/3/5` |
| 1:10 | 1:12 | 12 Chapter 4 | Typed chapter card | APPLY TO ALL | — | `bulk-adjustments/4/1` (the step title) |
| 1:12 | 1:18 | 13 Step 4 | The **Apply to all** button is highlighted; it is not pressed |  | "Apply to all writes the new targets and closes the dialog." | `bulk-adjustments/4/2` |
| 1:18 | 1:26 | 14 Step 4 result | The figure swaps to the table after the change: the **Suggested** column is highlighted, and the cursor moves across a station's new target and suggestion |  | "The suggested percentages recalculate against the new targets straight away, so the Suggested column will move." | `bulk-adjustments/4/3` |
| 1:26 | 1:36 | 15 Close | Up next **Next on Double Click: Enable and disable stations**; end card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/bulk-adjustments` goes in the published description | — | — | — |

**VO total:** 167 words in 9 lines, about 60 s spoken (measured). **Running time:** about 1:36 (96 s); the series range is 60-180 s. **Measured:** 1:45 (105.7 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Writes declared (all on `/demo`, none performed):** `bulk-apply` (chapter c4, "Apply to all"). The dialog and its result are shown as the guide figures show them, from the recreation; the button is highlighted and never pressed (Bulk Adjust Save is short-circuited in Demo Mode, `video/capture/SAFETY.md:101`).

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/bulk-adjustments`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- bulk-adjustments` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim.

## Voice-over check

Whisper round-trip on 2026-10-20 (`video/vo/whisper_check.py`, model small.en, with medium.en on any line small.en flagged); reports `vo/whisper-report-<model>.json` under the media root. The only differences are homophones and spellings: 'hole' heard as 'whole' (medium.en matched it), 'writes' as 'rights to', 'dialog' as 'dialogue', and 'targets straight away' with different spacing; judged by the executor as Whisper's, not misreadings; no line was re-rendered. The lines were rendered at the API output format mp3_44100_128, because the account's plan no longer allows mp3_44100_192 (the render report records the format); voice, model and settings are unchanged.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
