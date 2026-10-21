# Double Click #16: Calculation methods

**Episode:** 16 of 26 · **Wave:** 4 (Calculations) · **Guide:** `#/calculation-methods` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), lifted figures per chapter: step 1 "(the figure already lifted)"; step 2 "Every suggestion in this column"; step 3 "With Option 1 selected"; step 4 "Runs of identical values"; step 5 "Compare the column before"

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report (estimated until the voice-over is rendered).

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Calculation methods** | — | "Two algorithms can produce the suggested percentage. They use different inputs and behave differently." | `calculation-methods/tile/1`, `calculation-methods/tile/2`, `calculation-methods/summary/1`, `calculation-methods/summary/2` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | FIND THE SELECTOR | — | `calculation-methods/1/1` (the step title) |
| 0:09 | 0:23 | 4 Step 1 | Push in on the field **Suggested Percent Adjust Calculation**, highlighted, above the three amounts |  | "Suggested Percent Adjust Calculation is the first field on the Calculation tab. On a production site it only appears when the saved algorithm is already Option 1, so most users never see it." | `calculation-methods/1/2`, `calculation-methods/1/3` |
| 0:23 | 0:31 | 5 Step 1 result | The dropdown, highlighted |  | "The dropdown offers only Option 1 and Option 2. Nothing in the product says what either one does." | `calculation-methods/1/4`, `calculation-methods/before/1` |
| 0:31 | 0:33 | 6 Chapter 2 | Typed chapter card | OPTION 2 — DELTA PLUS TODAY’S ET, THE DEFAULT | — | `calculation-methods/2/1` (the step title) |
| 0:33 | 0:45 | 7 Step 2 | The dropdown reads **Option 2**, highlighted |  | "The default is Option 2: delta plus today's ET. The server computes it per station. Target minus working VWC gives a deficit, and the deficit becomes an amount of water." | `calculation-methods/before/3`, `calculation-methods/2/2` |
| 0:45 | 0:59 | 8 Step 2 result | Cut to the dashboard: the cursor goes to **Calculation ET**, then the **Suggested** column, highlighted |  | "Today's ET, adjusted by the crop coefficient, is added, the daily maximum caps the total, and the result is divided by the Lynx reference amount. Every suggestion in this column came from that chain." | `calculation-methods/2/2`, `calculation-methods/2/3` |
| 0:59 | 1:01 | 9 Chapter 3 | Typed chapter card | OPTION 1 — RATIO OF TARGET TO MEASURED | — | `calculation-methods/3/1` (the step title) |
| 1:01 | 1:15 | 10 Step 3 | Back in the dialog: the dropdown reads **Option 1**, highlighted |  | "Option 1 multiplies the percent adjust Lynx currently holds by target divided by measured moisture, and rounds. A station at 0 percent adjust stays at 0 no matter how dry it is." | `calculation-methods/3/2`, `calculation-methods/3/5` |
| 1:15 | 1:25 | 11 Step 3 result | The cursor goes to the two amount fields, which are disabled |  | "It uses no ET, no reference amount and no cap, so Max Amount and Lynx Reference Amount are disabled while it is selected." | `calculation-methods/3/3`, `calculation-methods/3/4` |
| 1:25 | 1:26 | 12 Chapter 4 | Typed chapter card | THE CAP IS WHAT MAKES THEM LOOK DIFFERENT | — | `calculation-methods/4/1` (the step title) |
| 1:26 | 1:37 | 13 Step 4 | The dashboard: the **Suggested** column, with its run of identical values |  | "Option 2 flattens everything above the daily maximum onto one number. Runs of identical values are a signature of the capped method." | `calculation-methods/4/2`, `calculation-methods/4/4` |
| 1:37 | 1:47 | 14 Step 4 result | The cursor moves down the column, over values that differ |  | "Option 1 has no ceiling, so its suggestions spread out, and can go far higher than you intend on a station that reads very dry." | `calculation-methods/4/3` |
| 1:47 | 1:49 | 15 Chapter 5 | Typed chapter card | SWITCHING IS A COURSE-WIDE CHANGE | — | `calculation-methods/5/1` (the step title) |
| 1:49 | 2:03 | 16 Step 5 | The dashboard: the course name in the toolbar, highlighted |  | "The algorithm is stored on the site, so a switch applies to every course on the site, not just the one on screen. Saving a different algorithm recalculates every station and reloads the dashboard." | `calculation-methods/5/1`, `calculation-methods/5/2` |
| 2:03 | 2:12 | 17 Step 5 result | The **Suggested** column, highlighted |  | "Review the whole Suggested column before pushing anything after a switch. Compare the column before and after switching, not one row." | `calculation-methods/5/3`, `calculation-methods/5/4` |
| 2:12 | 2:17 | 18 Up next | **Next on Double Click: Preferences** | — | — | — |
| 2:17 | 2:22 | 19 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/calculation-methods` goes in the published description | — | — | — |

**VO total:** 286 words in 11 lines, about 104 s spoken (estimated). **Running time:** about 2:22 (143 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/calculation-methods`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- calculation-methods` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Demo Mode writes

This episode shows settings being saved, but **no Save is clicked, in any session**. The cursor rests on the control and the line describes what saving does; the saved state comes from the guide site's recreation (the chapters whose `sourceReason` says so). `demoWriteClicks` is empty because the schema allows those clicks only on a `demo` episode and no Demo Mode take is made. SAFETY.md coverage was checked before any capture: the Settings dialog Save is short-circuited at `sa-settings-dlg.component.ts:186-190` (`video/capture/SAFETY.md:98`, safetyRef `settings-save`; it also covers the Spatial Adjust settings save, the user preferences save and the Target Profiles upsert), and the recalculation it triggers is guarded in the manager (`video/capture/SAFETY.md:65`, safetyRef `recalculate`). If a Demo Mode take is made later, each Save is declared in `demoWriteClicks` with route `/demo`, outcome `recreation` and its safetyRef, and the chapter becomes `mixed`.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). No line rests on a Needs expert or Not shipping claim. The series' corrected wording is used: the two algorithms are Option 1 and Option 2, never "Simple" or "the default method".

## Voice-over check

Not yet run.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
