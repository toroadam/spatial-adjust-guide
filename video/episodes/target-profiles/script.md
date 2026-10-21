# Double Click #23: Apply a target profile

**Episode:** 23 of 26 · **Wave:** 6 (Target Profiles), first of the wave · **Guide:** `#/target-profiles` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "The Target Profiles tab in the settings dialog"; step 2 "Five profile slots; an empty slot shows"; step 3 "Applying a profile is a course-wide change"; step 4 "The station targets currently in the table". Target Profiles is GA, so the episode is shown in every build; the figures draw the production five-slot table (Target Profile, Last Updated, Stations, Update from Current, Apply Profile), not the earlier three-card design.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:10 | 2 Title | Title card **Double Click: Apply a target profile** | — | "Save a full set of station targets under a name, then switch the whole course between seasonal and event strategies in one action." | `target-profiles/tile/1`, `target-profiles/tile/2`, `target-profiles/summary/1` |
| 0:10 | 0:12 | 3 Chapter 1 | Typed chapter card | OPEN THE TARGET PROFILES TAB | — | `target-profiles/1/1` (the step title) |
| 0:12 | 0:16 | 4 Step 1 | Push in on the **Target Profiles** entry of the settings dialog, highlighted |  | "Open Settings, then the Target Profiles tab." | `target-profiles/where/1`, `target-profiles/1/1` |
| 0:16 | 0:25 | 5 Step 1 result | The settings menu list is highlighted; the cursor passes **Calculation** and **Minimum Threshold** |  | "Profiles sit alongside Calculation and Minimum Threshold in the settings dialog, because a profile is a calculation input rather than a station edit." | `target-profiles/1/2` |
| 0:25 | 0:27 | 6 Chapter 2 | Typed chapter card | READ THE PROFILE LIST | — | `target-profiles/2/1` (the step title) |
| 0:27 | 0:39 | 7 Step 2 | The five-slot table is highlighted; the cursor passes its four columns |  | "The tab lists five profile slots for each Lynx course, with Last Updated, Stations, Update from Current and Apply Profile columns." | `target-profiles/note/1` |
| 0:39 | 0:52 | 8 Step 2 result | A filled row is highlighted (last updated, station count); the cursor goes to an empty slot |  | "Each profile shows when it was last updated, by renaming it or with Update from Current, and how many stations it holds. An empty slot shows two dashes for Last Updated and Stations." | `target-profiles/2/2`, `target-profiles/2/4` |
| 0:52 | 0:54 | 9 Chapter 3 | Typed chapter card | APPLY AND CONFIRM | — | `target-profiles/3/1` (the step title) |
| 0:54 | 1:09 | 10 Step 3 | **Apply Profile** is highlighted; the cursor goes to **Target VWC**, then **Suggested** behind the dialog |  | "Applying overwrites the Target VWC of every station the profile covers. Because that is a recalculation input, the dashboard reloads and the Suggested column changes across the course." | `target-profiles/3/2`, `target-profiles/3/3` |
| 1:09 | 1:17 | 11 Step 3 result | **Suggested** is highlighted; the cursor returns to **Apply Profile** |  | "Applying a profile is a course-wide change. Applying and pushing in the same minute leaves no time to sanity-check." | `target-profiles/3/4`, `target-profiles/3/6` |
| 1:17 | 1:18 | 12 Chapter 4 | Typed chapter card | SAVE YOUR CURRENT TARGETS INTO A PROFILE SLOT | — | `target-profiles/4/1` (the step title) |
| 1:18 | 1:34 | 13 Step 4 | The dashboard: the **Target VWC** column is highlighted |  | "Once the course is tuned the way you want it, save the state as a profile so you can return to it. Name it for the condition rather than the date, the reason you set those targets is what you will be looking for later." | `target-profiles/4/2`, `target-profiles/4/3` |
| 1:34 | 1:39 | 14 Step 4 result | A station target is highlighted: the targets in the table are what a new profile captures |  | "The station targets currently in the table are what a new profile would capture." | `target-profiles/4/4` |
| 1:39 | 1:48 | 15 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Capturing profiles**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/target-profiles` goes in the published description | — | — | — |

**VO total:** 213 words in 9 lines, about 74 s spoken (measured). **Running time:** about 1:48 (108 s) planned; the target is 1:30-2:15, inside the series range of 60-180 s. **Measured:** 2:00 (117.8 s) in the final render, take 1; -14.1 LUFS, -1.7 dBTP.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/target-profiles`. Each VO line is cut from its step's body paragraph and figure caption (or from the guide's Where, Before you start and summary text), there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- target-profiles` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim. Not narrated, because they are not Verified: `target-profiles/3/5`.

## Voice-over check

Whisper round-trip on 2026-10-21 (`video/vo/whisper_check.py`, model small.en, with medium.en on each flagged line); reports `vo/whisper-report-<model>.json` under the media root. 8 of 9 lines matched word for word; V2b differs by one word (Whisper hears "and how many stations" as "in how many stations", on both models), which the executor judged to be Whisper's run-together reading, not a misreading. No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
