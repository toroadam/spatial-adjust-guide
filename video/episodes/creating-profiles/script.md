# Double Click #24: Capturing profiles

**Episode:** 24 of 26 · **Wave:** 6 (Target Profiles) · **Guide:** `#/creating-profiles` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "The Target VWC column is what a profile would capture"; step 2 "The Target Profiles tab"; step 3 "The Target Profiles tab with its five slots"; step 4 "Coverage is part of what a profile is". Target Profiles is GA, so the episode is shown in every build; the figures draw the production five-slot table (Target Profile, Last Updated, Stations, Update from Current, Apply Profile), not the earlier three-card design.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Capturing profiles** | — | "Capture the station targets you have tuned, under a name you will recognise next season." | `creating-profiles/tile/1`, `creating-profiles/tile/2`, `creating-profiles/summary/1` |
| 0:08 | 0:10 | 3 Chapter 1 | Typed chapter card | TUNE THE TARGETS FIRST | — | `creating-profiles/1/1` (the step title) |
| 0:10 | 0:21 | 4 Step 1 | Push in on the **Target VWC** column, highlighted; the cursor moves down the station targets |  | "A profile is a snapshot, so the work happens in the table before you save anything. Get the course reading the way you want it, hole by hole, and only then capture it." | `creating-profiles/1/2`, `creating-profiles/1/3` |
| 0:21 | 0:33 | 5 Step 1 result | A station target is highlighted; the cursor passes the **% Adj.** and **Enable** columns a profile does not store |  | "The Target VWC column is what a profile would capture. A profile stores one Target VWC per station and nothing else, no percent adjustments, no enable states." | `creating-profiles/1/4`, `creating-profiles/before/1` |
| 0:33 | 0:35 | 6 Chapter 2 | Typed chapter card | OPEN THE TARGET PROFILES TAB | — | `creating-profiles/2/1` (the step title) |
| 0:35 | 0:40 | 7 Step 2 | Push in on the **Target Profiles** entry of the settings dialog, highlighted |  | "Open the Target Profiles tab in Settings." | `creating-profiles/where/1`, `creating-profiles/2/1` |
| 0:40 | 0:50 | 8 Step 2 result | The settings menu list is highlighted; the cursor goes from **Calculation** to the profile table |  | "Profiles sit with the calculation settings rather than in the table, because a target set is a calculation input rather than a station edit." | `creating-profiles/2/2` |
| 0:50 | 0:52 | 9 Chapter 3 | Typed chapter card | NAME IT FOR THE CONDITION | — | `creating-profiles/3/1` (the step title) |
| 0:52 | 1:01 | 10 Step 3 | A profile name, **Summer Baseline**, is highlighted; the cursor moves to **Tournament Week** |  | "Name a profile for the reason the targets are what they are: Summer Baseline, Tournament Week, Overseed Recovery." | `creating-profiles/3/2` |
| 1:01 | 1:07 | 11 Step 3 result | The five-slot table is highlighted; the cursor returns to the condition-based name |  | "A date tells you when; a condition tells you why, which is what you will be searching for." | `creating-profiles/3/3` |
| 1:07 | 1:09 | 12 Chapter 4 | Typed chapter card | CHECK THE STATION COUNT | — | `creating-profiles/4/1` (the step title) |
| 1:09 | 1:21 | 13 Step 4 | Push in on the **Stations** column, highlighted; the cursor goes to a filled profile's count |  | "The count beside each profile says how many stations it covers. A profile holds every station the course had when it was captured, enabled or not." | `creating-profiles/4/2`, `creating-profiles/4/3` |
| 1:21 | 1:30 | 14 Step 4 result | A second profile's station count is highlighted; coverage is part of what a profile is |  | "Stations added to the course later are not in it, and applying the profile leaves them untouched. Coverage is part of what a profile is." | `creating-profiles/4/4`, `creating-profiles/4/5` |
| 1:30 | 1:39 | 15 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Updating profiles**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/creating-profiles` goes in the published description | — | — | — |

**VO total:** 193 words in 9 lines, about 65 s spoken (measured). **Running time:** about 1:39 (99 s) planned; the target is 1:30-2:15, inside the series range of 60-180 s. **Measured:** 1:50 (109.6 s) in the final render, take 1; -14.1 LUFS, -1.7 dBTP.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/creating-profiles`. Each VO line is cut from its step's body paragraph and figure caption (or from the guide's Where, Before you start and summary text), there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- creating-profiles` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim.

## Voice-over check

Whisper round-trip on 2026-10-21 (`video/vo/whisper_check.py`, model small.en, with medium.en on each flagged line); reports `vo/whisper-report-<model>.json` under the media root. 8 of 9 lines matched word for word; V0 differs only in spelling (recognise, recognize), which is Whisper's US spelling. No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
