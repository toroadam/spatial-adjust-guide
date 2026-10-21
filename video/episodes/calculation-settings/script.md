# Double Click #15: Calculation settings

**Episode:** 15 of 26 · **Wave:** 4 (Calculations) · **Guide:** `#/calculation-settings` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), lifted figures per chapter: step 1 "(the figure already lifted)"; step 2 "Daily Max Amount, edited"; step 3 "Lynx Reference Amount, ceiling"; step 4 "Crop Coefficient: 0 to 200"; step 5 "After a recalculation"

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Calculation settings** | — | "Three numbers decide every suggestion on the course: the daily maximum, the Lynx reference amount, and the crop coefficient." | `calculation-settings/tile/1`, `calculation-settings/tile/2`, `calculation-settings/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | OPEN SETTINGS ON THE CALCULATION TAB | — | `calculation-settings/1/1` (the step title) |
| 0:09 | 0:22 | 4 Step 1 | The gear button is highlighted; the cursor then touches **Minimum Threshold** in the rail |  | "The gear button opens the dialog on Calculation by default. If you last arrived through Review Threshold, it opens on Minimum Threshold instead, and the tab is sticky for the rest of the session." | `calculation-settings/1/2`, `calculation-settings/1/3` |
| 0:22 | 0:30 | 5 Step 1 result | The **Calculation** rail entry, highlighted |  | "This is the Calculation tab. These are site-level settings, so they apply to every user on the site." | `calculation-settings/1/4`, `calculation-settings/before/1` |
| 0:30 | 0:31 | 6 Chapter 2 | Typed chapter card | DAILY MAX AMOUNT CAPS THE WATER | — | `calculation-settings/2/1` (the step title) |
| 0:31 | 0:41 | 7 Step 2 | Push in on the **Daily Max Amount** field, highlighted |  | "Daily Max Amount is the most water Spatial Adjust will ask for in one day, in your own units, up to a hard ceiling of 15." | `calculation-settings/2/2` |
| 0:41 | 0:51 | 8 Step 2 result | The field stays highlighted |  | "Every station whose deficit exceeds this lands on the same suggested percentage, which is why identical numbers appear in runs." | `calculation-settings/2/3` |
| 0:51 | 0:52 | 9 Chapter 3 | Typed chapter card | LYNX REFERENCE AMOUNT IS WHAT 100% MEANS | — | `calculation-settings/3/1` (the step title) |
| 0:52 | 1:04 | 10 Step 3 | Push in on the **Lynx Reference Amount** field, highlighted |  | "Lynx Reference Amount is the amount of water a station applies at 100 percent adjust. The suggested percentage is the applied amount divided by this reference." | `calculation-settings/3/2`, `calculation-settings/3/3` |
| 1:04 | 1:21 | 11 Step 3 result | The field stays highlighted |  | "Set it too low and every suggestion looks enormous: a 10 mm cap against a 3 mm reference gives a maximum suggestion of 333 percent. In Lynx, Next Amount must equal this reference, in the same units." | `calculation-settings/3/4`, `calculation-settings/3/6`, `push-to-lynx/before/8` |
| 1:21 | 1:23 | 12 Chapter 4 | Typed chapter card | CROP COEFFICIENT SCALES TODAY’S ET | — | `calculation-settings/4/1` (the step title) |
| 1:23 | 1:33 | 13 Step 4 | Push in on the **Crop Coefficient** field, highlighted |  | "Crop Coefficient is a whole-number percentage from 0 to 200, applied to the day's ET before it enters the calculation." | `calculation-settings/4/2` |
| 1:33 | 1:49 | 14 Step 4 result | The field stays highlighted |  | "Below 100, the course is treated as using less water than reference ET suggests; above 100, more. Under Option 1 the dialog greys it out, along with Daily Max Amount and Lynx Reference Amount." | `calculation-settings/4/3`, `calculation-settings/4/5` |
| 1:49 | 1:50 | 15 Chapter 5 | Typed chapter card | SAVING RECALCULATES THE WHOLE COURSE | — | `calculation-settings/5/1` (the step title) |
| 1:50 | 2:00 | 16 Step 5 | The cursor rests on **Save Changes**, highlighted; nothing is clicked |  | "Save Changes sends the settings, asks the server to recalculate adjustments, and reloads the dashboard so that area and hole averages are rebuilt." | `calculation-settings/5/2` |
| 2:00 | 2:16 | 17 Step 5 result | Cut to the dashboard: the **Suggested** column is highlighted, then the cursor goes to **% Adj.** |  | "A new Lynx Reference Amount rescales every suggestion above zero. A new Daily Max Amount moves only the stations at the old or new cap, and stations at zero usually stay there. A % Adj. you typed earlier keeps its value." | `calculation-settings/5/3`, `calculation-settings/5/4` |
| 2:16 | 2:21 | 18 Up next | **Next on Double Click: Calculation methods** | — | — | — |
| 2:21 | 2:26 | 19 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/calculation-settings` goes in the published description | — | — | — |

**VO total:** 298 words in 11 lines, about 109 s spoken (measured). **Running time:** about 2:26 (147 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/calculation-settings`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- calculation-settings` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Demo Mode writes

This episode shows settings being saved, but **no Save is clicked, in any session**. The cursor rests on the control and the line describes what saving does; the saved state comes from the guide site's recreation (the chapters whose `sourceReason` says so). `demoWriteClicks` is empty because the schema allows those clicks only on a `demo` episode and no Demo Mode take is made. SAFETY.md coverage was checked before any capture: the Settings dialog Save is short-circuited at `sa-settings-dlg.component.ts:186-190` (`video/capture/SAFETY.md:98`, safetyRef `settings-save`; it also covers the Spatial Adjust settings save, the user preferences save and the Target Profiles upsert), and the recalculation it triggers is guarded in the manager (`video/capture/SAFETY.md:65`, safetyRef `recalculate`). If a Demo Mode take is made later, each Save is declared in `demoWriteClicks` with route `/demo`, outcome `recreation` and its safetyRef, and the chapter becomes `mixed`.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). No line rests on a Needs expert or Not shipping claim. The series' corrected wording is used: the two algorithms are Option 1 and Option 2, never "Simple" or "the default method".

## Voice-over check

Whisper round-trip on 2026-10-20 (`video/vo/whisper_check.py`, model small.en, with medium.en on the lines small.en flagged); reports `vo/whisper-report-<model>.json` under the media root. After two lines were re-rendered, the remaining differences are spelling, homophones and run-together sounds: "will" as "we'll" (V2a), "Lynx" as "link s" (V3a), "greys" as "grays" (V4b), "hole" as "whole" (V5a, a homophone; medium.en matched it) and today's ET run together (V4a). Two lines were re-rendered (`--lines V3b,V4a --force`): V3b, where both models heard the Lynx field label "Next Amt" as "Next Amp", so the line now says "Next Amount" (a spoken expansion of the label the Verified claim names); and V4a, where both models heard "applied" as "apply", which the re-render fixed.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
