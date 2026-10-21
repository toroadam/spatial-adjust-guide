# Double Click #14: Set a minimum threshold

**Episode:** 14 of 26 · **Wave:** 4 (Calculations), first of the wave · **Guide:** `#/minimum-threshold` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), lifted figures per chapter: step 1 "(the figure already lifted)"; step 2 "Settings dialog, Minimum Threshold tab."; step 3 "Threshold set to 10 percent."; step 4 "Below-threshold behaviour"; step 5 "Push dialog."

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Set a minimum threshold** | — | "Stop trivial adjustments reaching Lynx. Set the percentage below which a suggestion is either zeroed or lifted to the threshold value." | `minimum-threshold/tile/1`, `minimum-threshold/tile/2`, `minimum-threshold/summary/1`, `minimum-threshold/summary/2` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | OPEN SETTINGS | — | `minimum-threshold/1/1` (the step title) |
| 0:09 | 0:17 | 4 Step 1 | Push in on the gear button (**Settings**), highlighted, at the right of the toolbar |  | "The gear button at the right of the toolbar, in its right-hand button group, opens the settings dialog." | `minimum-threshold/1/2`, `minimum-threshold/1/4` |
| 0:17 | 0:27 | 5 Step 1 result | The cursor goes to **Push Changes** while the gear stays highlighted |  | "It opens on Calculation, unless you have used Review Threshold in the Push Changes dialog since the page loaded, in which case it opens on Minimum Threshold." | `minimum-threshold/1/3` |
| 0:27 | 0:29 | 6 Chapter 2 | Typed chapter card | CHOOSE THE MINIMUM THRESHOLD TAB | — | `minimum-threshold/2/1` (the step title) |
| 0:29 | 0:37 | 7 Step 2 | The Settings dialog: the rail entry **Minimum Threshold** is highlighted; the cursor touches **Calculation** above it |  | "The left rail lists the settings groups. Minimum Threshold sits second, under Calculation." | `minimum-threshold/2/2`, `minimum-threshold/2/3` |
| 0:37 | 0:41 | 8 Step 2 result | The tab's field group, highlighted |  | "The Settings dialog is now on the Minimum Threshold tab." | `minimum-threshold/2/4` |
| 0:41 | 0:43 | 9 Chapter 3 | Typed chapter card | ENTER THE PERCENTAGE | — | `minimum-threshold/3/1` (the step title) |
| 0:43 | 0:53 | 10 Step 3 | Push in on the percentage field, highlighted |  | "Type the cutoff as a whole number between 0 and 50. Setting the percentage to 0 disables the feature entirely." | `minimum-threshold/3/2`, `minimum-threshold/before/4` |
| 0:53 | 1:02 | 11 Step 3 result | The field reads **10**, highlighted |  | "Here the threshold is set to 10 percent. The 0 to 50 bound is enforced by the dialog only. There is no server-side check." | `minimum-threshold/3/4`, `minimum-threshold/3/5` |
| 1:02 | 1:04 | 12 Chapter 4 | Typed chapter card | DECIDE WHAT HAPPENS BELOW THE LINE | — | `minimum-threshold/4/1` (the step title) |
| 1:04 | 1:18 | 13 Step 4 | The option group is highlighted; the cursor goes from **Set to zero** to **Set to the minimum threshold value** |  | "Set to zero means Lynx receives 0 percent. Set to the minimum threshold value raises the suggestion up to the threshold instead, so the station still gets a small run." | `minimum-threshold/4/2`, `minimum-threshold/4/3` |
| 1:18 | 1:27 | 14 Step 4 result | **Exclude Zeros** is highlighted |  | "Exclude Zeros, available only on the second option, leaves genuine zeros at zero rather than lifting them." | `minimum-threshold/4/4` |
| 1:27 | 1:29 | 15 Chapter 5 | Typed chapter card | SAVE AND CONFIRM AT PUSH TIME | — | `minimum-threshold/5/1` (the step title) |
| 1:29 | 1:41 | 16 Step 5 | The cursor rests on **Save Changes**, highlighted; nothing is clicked |  | "Save Changes saves the edits on every tab of Settings together. A threshold-only change does not reload the dashboard; the pending push list is simply recalculated." | `minimum-threshold/4/6`, `minimum-threshold/5/2` |
| 1:41 | 1:51 | 17 Step 5 result | Cut to the Push Changes dialog: the pink banner, highlighted, then a row's **Adjusted to 10%** |  | "Open Push Changes and the pink banner tells you how many stations the threshold touched, with each affected row showing its original value and the adjusted one." | `minimum-threshold/5/3` |
| 1:51 | 1:56 | 18 Up next | **Next on Double Click: Calculation settings** | — | — | — |
| 1:56 | 2:01 | 19 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/minimum-threshold` goes in the published description | — | — | — |

**VO total:** 233 words in 11 lines, about 86 s spoken (measured). **Running time:** about 2:01 (121 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/minimum-threshold`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- minimum-threshold` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Demo Mode writes

This episode shows settings being saved, but **no Save is clicked, in any session**. The cursor rests on the control and the line describes what saving does; the saved state comes from the guide site's recreation (the chapters whose `sourceReason` says so). `demoWriteClicks` is empty because the schema allows those clicks only on a `demo` episode and no Demo Mode take is made. SAFETY.md coverage was checked before any capture: the Settings dialog Save is short-circuited at `sa-settings-dlg.component.ts:186-190` (`video/capture/SAFETY.md:98`, safetyRef `settings-save`; it also covers the Spatial Adjust settings save, the user preferences save and the Target Profiles upsert), and the recalculation it triggers is guarded in the manager (`video/capture/SAFETY.md:65`, safetyRef `recalculate`). If a Demo Mode take is made later, each Save is declared in `demoWriteClicks` with route `/demo`, outcome `recreation` and its safetyRef, and the chapter becomes `mixed`.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). No line rests on a Needs expert or Not shipping claim; three claims of this guide that are not Verified are not narrated: `minimum-threshold/3/3` (a starting percentage), `minimum-threshold/5/6` and `minimum-threshold/5/7` (the push window). The series' corrected wording is used: the two algorithms are Option 1 and Option 2, never "Simple" or "the default method".

## Voice-over check

Whisper round-trip on 2026-10-20 (`video/vo/whisper_check.py`, model small.en, with medium.en on the lines small.en flagged); reports `vo/whisper-report-<model>.json` under the media root. 8 of 11 lines matched word for word with small.en. The differences are "dialog" written "dialogue" (V1b, V3b), and in V5b "and the" heard as "in the" twice (small.en and medium.en agree); the executor judged them spelling and a run-together sound, Whisper's and not misreadings. No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
