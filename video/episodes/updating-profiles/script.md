# Double Click #25: Updating profiles

**Episode:** 25 of 26 · **Wave:** 6 (Target Profiles) · **Guide:** `#/updating-profiles` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Individually edited targets drift away from the profile"; step 2 "The profile’s row, with Update from Current"; step 3 "Updating overwrites the stored targets in place"; step 4 "Suggestions unchanged: the update touched only the stored profile". Target Profiles is GA, so the episode is shown in every build; the figures draw the production five-slot table (Target Profile, Last Updated, Stations, Update from Current, Apply Profile), not the earlier three-card design.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Updating profiles** | — | "Fold this week's adjustments back into a saved profile without applying it to the course." | `updating-profiles/tile/1`, `updating-profiles/tile/2`, `updating-profiles/summary/1` |
| 0:08 | 0:10 | 3 Chapter 1 | Typed chapter card | NOTICE THE DRIFT | — | `updating-profiles/1/1` (the step title) |
| 0:10 | 0:17 | 4 Step 1 | Push in on the **Target VWC** column, highlighted; the cursor moves down the edited targets |  | "After a fortnight of individual target edits, the course no longer matches the profile you applied." | `updating-profiles/1/2` |
| 0:17 | 0:25 | 5 Step 1 result | An edited station target is highlighted: the course has drifted from the stored profile |  | "The profile is still valid, it is simply out of date. Individually edited targets drift away from the profile." | `updating-profiles/1/3`, `updating-profiles/1/4` |
| 0:25 | 0:27 | 6 Chapter 2 | Typed chapter card | FIND THE PROFILE’S ROW | — | `updating-profiles/2/1` (the step title) |
| 0:27 | 0:33 | 7 Step 2 | The **Summer Baseline** row is highlighted; the cursor goes to **Update from Current** |  | "Find the profile’s row, with Update from Current." | `updating-profiles/2/1`, `updating-profiles/2/4` |
| 0:33 | 0:43 | 8 Step 2 result | **Last Updated** is highlighted; the list holds no marker for the applied profile |  | "The profile list does not mark the profile you applied. Editing a station target after applying leaves the profile intact but no longer exactly matched." | `updating-profiles/2/2`, `updating-profiles/2/3` |
| 0:43 | 0:45 | 9 Chapter 3 | Typed chapter card | UPDATE THIS SLOT OR CAPTURE INTO ANOTHER | — | `updating-profiles/3/1` (the step title) |
| 0:45 | 0:55 | 10 Step 3 | **Update from Current** is highlighted; the cursor goes to the profile's update control (hover only) |  | "Overwrite the stored targets with the current ones when the drift is an improvement. Rule of thumb. Update when the course has genuinely moved on." | `updating-profiles/3/2`, `updating-profiles/3/5` |
| 0:55 | 1:08 | 11 Step 3 result | The five-slot table is highlighted; the cursor moves over the other slots |  | "Capture into a different slot instead when the change is for one event, and rename it to suit; with five slots per course that overwrites whatever the other slot held, so pick one you no longer need." | `updating-profiles/3/3` |
| 1:08 | 1:09 | 12 Chapter 4 | Typed chapter card | CONFIRM NOTHING MOVED | — | `updating-profiles/4/1` (the step title) |
| 1:09 | 1:16 | 13 Step 4 | Back on the dashboard: the **Target VWC** column is highlighted |  | "Updating a profile writes to the profile, not to the stations." | `updating-profiles/4/2` |
| 1:16 | 1:28 | 14 Step 4 result | **Suggested** is highlighted; the cursor goes down the column, unchanged |  | "The Suggested column should be exactly as it was — if it moved, something applied rather than updated. Suggestions unchanged: the update touched only the stored profile." | `updating-profiles/4/3`, `updating-profiles/4/4` |
| 1:28 | 1:37 | 15 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Managing seasonal profiles**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/updating-profiles` goes in the published description | — | — | — |

**VO total:** 183 words in 9 lines, about 63 s spoken (measured). **Running time:** about 1:37 (97 s) planned; the target is 1:30-2:15, inside the series range of 60-180 s. **Measured:** 1:48 (107.9 s) in the final render, take 1; -14.1 LUFS, -1.6 dBTP.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/updating-profiles`. Each VO line is cut from its step's body paragraph and figure caption (or from the guide's Where, Before you start and summary text), there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- updating-profiles` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim.

## Voice-over check

Whisper round-trip on 2026-10-21 (`video/vo/whisper_check.py`, model small.en, with medium.en on each flagged line); reports `vo/whisper-report-<model>.json` under the media root. 8 of 9 lines matched word for word; V2a differs only in the possessive ("profile’s row" heard as "profiles row"), which is Whisper's. No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
