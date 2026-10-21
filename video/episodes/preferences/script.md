# Double Click #17: Preferences

**Episode:** 17 of 26 · **Wave:** 4 (Calculations) · **Guide:** `#/preferences` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), lifted figures per chapter: step 1 "(the figure already lifted)"; step 2 "Units of Measure drives"; step 3 "Language, units, temperature scale"; step 4 "The weather strip"

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report (estimated until the voice-over is rendered).

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Preferences** | — | "Language, units, temperature and number formatting. These belong to you, not to the site." | `preferences/tile/1`, `preferences/tile/2`, `preferences/summary/1`, `preferences/summary/2` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | OPEN THE PREFERENCES TAB | — | `preferences/1/1` (the step title) |
| 0:09 | 0:21 | 4 Step 1 | The **Preferences** rail entry is highlighted; the cursor touches **Calculation**, the first entry |  | "Preferences is the last entry in the settings rail. Preferences are stored against your user account; the calculation settings on the other tabs are stored against the site." | `preferences/1/2`, `preferences/before/1` |
| 0:21 | 0:31 | 5 Step 1 result | The cursor visits the four fields, ending on **Units of Measure**, highlighted |  | "Language, Temperature Scale and the separator setting change only how things are presented. Units of Measure can change suggestions, as the next step explains." | `preferences/1/3`, `preferences/1/4` |
| 0:31 | 0:33 | 6 Chapter 2 | Typed chapter card | UNITS OF MEASURE CHANGES WHAT YOU TYPE | — | `preferences/2/1` (the step title) |
| 0:33 | 0:43 | 7 Step 2 | Push in on the **Units of Measure** field, highlighted |  | "The stored amounts are millimetres. Switching to imperial shows them in inches, with two decimal places; metric gets one decimal place." | `preferences/2/2`, `preferences/2/3` |
| 0:43 | 1:06 | 8 Step 2 result | The cursor goes to the **Calculation** tab, then back to **Units of Measure** |  | "Check after switching. Changing Units of Measure and saving in the same visit does not re-convert the amounts already on the Calculation tab. They are saved as though they were already in the new unit, which rescales them by 25.4. After a unit change, save, then reopen Settings and check Max Amount and Lynx Reference Amount before you push anything." | `preferences/2/6`, `preferences/2/7` |
| 1:06 | 1:07 | 9 Chapter 3 | Typed chapter card | LANGUAGE APPLIES IMMEDIATELY | — | `preferences/3/1` (the step title) |
| 1:07 | 1:19 | 10 Step 3 | Push in on the **Language** field, highlighted |  | "Saving a new language re-applies translations across the site without a reload, and refetches your user record so the choice sticks on your next visit." | `preferences/3/2` |
| 1:19 | 1:34 | 11 Step 3 result | The cursor goes to the settings rail, whose tab names stay in English |  | "Anything Spatial Adjust has no translation for stays in English, and every language other than English has gaps. The tab names in the settings rail, the Discard changes confirmation and the scan-data banner are in English whatever you choose." | `preferences/3/4`, `preferences/3/5` |
| 1:34 | 1:36 | 12 Chapter 4 | Typed chapter card | TEMPERATURE AND SEPARATOR AFFECT THE TOOLBAR | — | `preferences/4/1` (the step title) |
| 1:36 | 1:48 | 13 Step 4 | Cut to the dashboard: the weather strip is highlighted; the cursor then goes to the table's numbers |  | "Temperature scale changes the weather strip. The group and decimal separator changes how every number on the screen is punctuated, which matters most in the dense table columns." | `preferences/4/2` |
| 1:48 | 1:57 | 14 Step 4 result | The weather strip, highlighted |  | "The weather strip follows your temperature scale, and amount fields on the Calculation tab show the unit you chose." | `preferences/4/3`, `preferences/verify/1` |
| 1:57 | 2:01 | 15 Up next | **Next on Double Click: Why is this station 0%?** | — | — | — |
| 2:01 | 2:06 | 16 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/preferences` goes in the published description | — | — | — |

**VO total:** 258 words in 9 lines, about 93 s spoken (estimated). **Running time:** about 2:06 (127 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/preferences`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- preferences` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Demo Mode writes

This episode shows settings being saved, but **no Save is clicked, in any session**. The cursor rests on the control and the line describes what saving does; the saved state comes from the guide site's recreation (the chapters whose `sourceReason` says so). `demoWriteClicks` is empty because the schema allows those clicks only on a `demo` episode and no Demo Mode take is made. SAFETY.md coverage was checked before any capture: the Settings dialog Save is short-circuited at `sa-settings-dlg.component.ts:186-190` (`video/capture/SAFETY.md:98`, safetyRef `settings-save`; it also covers the Spatial Adjust settings save, the user preferences save and the Target Profiles upsert), and the recalculation it triggers is guarded in the manager (`video/capture/SAFETY.md:65`, safetyRef `recalculate`). If a Demo Mode take is made later, each Save is declared in `demoWriteClicks` with route `/demo`, outcome `recreation` and its safetyRef, and the chapter becomes `mixed`.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). No line rests on a Needs expert or Not shipping claim. The series' corrected wording is used: the two algorithms are Option 1 and Option 2, never "Simple" or "the default method"; the units line narrates the Verified rescale by 25.4.

## Voice-over check

Not yet run.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
