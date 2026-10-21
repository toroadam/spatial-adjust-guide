# Double Click #26: Managing seasonal profiles

**Episode:** 26 of 26 · **Wave:** 6 (Target Profiles) · **Guide:** `#/seasonal-profiles` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "A short list stays readable a year later"; step 2 "Apply, then review the next morning"; step 3 "New targets, new suggestions"; step 4 "A profile switch queues a large push". Target Profiles is GA, so the episode is shown in every build; the figures draw the production five-slot table (Target Profile, Last Updated, Stations, Update from Current, Apply Profile), not the earlier three-card design.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:10 | 2 Title | Title card **Double Click: Managing seasonal profiles** | — | "A small set of profiles, one per condition, is easier to run a season with than a long list of dated snapshots." | `seasonal-profiles/tile/1`, `seasonal-profiles/tile/2`, `seasonal-profiles/summary/1` |
| 0:10 | 0:12 | 3 Chapter 1 | Typed chapter card | PLAN WHAT GOES IN THE FIVE SLOTS | — | `seasonal-profiles/1/1` (the step title) |
| 0:12 | 0:19 | 4 Step 1 | The five-slot table is highlighted; the cursor moves down the slot names |  | "Plan what goes in the five slots. The tab lists five named profile slots for each Lynx course." | `seasonal-profiles/1/1`, `seasonal-profiles/note/1` |
| 0:19 | 0:29 | 5 Step 1 result | A named profile row is highlighted; the cursor goes to **Apply Profile** |  | "A short list stays readable a year later. Applying a profile is a course-wide recalculation, so treat it as a planned change rather than a quick switch." | `seasonal-profiles/1/3`, `seasonal-profiles/before/1` |
| 0:29 | 0:31 | 6 Chapter 2 | Typed chapter card | APPLY THE EVENING BEFORE | — | `seasonal-profiles/2/1` (the step title) |
| 0:31 | 0:43 | 7 Step 2 | **Apply Profile** is highlighted; the cursor goes to the profile's station count |  | "Applying rewrites the target of every station in the profile and recalculates their suggestions; stations not in the profile keep their targets." | `seasonal-profiles/2/2` |
| 0:43 | 0:54 | 8 Step 2 result | The profile row is highlighted: apply the evening before, review in the morning |  | "Doing it the evening before leaves you the next morning to read the new suggestions against a fresh scan. Apply, then review the next morning’s suggestions." | `seasonal-profiles/2/3`, `seasonal-profiles/2/4` |
| 0:54 | 0:56 | 9 Chapter 3 | Typed chapter card | READ THE NEW SUGGESTIONS BEFORE PUSHING | — | `seasonal-profiles/3/1` (the step title) |
| 0:56 | 1:10 | 10 Step 3 | **Suggested** is highlighted; the cursor goes from **Target VWC** down the suggestions |  | "A profile changes targets, and targets change deficits. Scan the Suggested column for stations that jumped to the cap — those are the ones where the new target is a long way from where the station actually is." | `seasonal-profiles/3/2`, `seasonal-profiles/3/3` |
| 1:10 | 1:15 | 11 Step 3 result | A suggestion is highlighted: review the new suggestions before pushing |  | "New targets, new suggestions — review before pushing." | `seasonal-profiles/3/4` |
| 1:15 | 1:17 | 12 Chapter 4 | Typed chapter card | PUSH ONCE YOU AGREE WITH THEM | — | `seasonal-profiles/4/1` (the step title) |
| 1:17 | 1:29 | 13 Step 4 | The push dialog title is highlighted; the cursor goes to the **Changes** list (hover only) |  | "The push dialog is the same as any other day. The difference is the size of the change set: a profile switch usually queues most of the course at once." | `seasonal-profiles/4/2`, `seasonal-profiles/4/3` |
| 1:29 | 1:33 | 14 Step 4 result | The dialog's change list is highlighted: review a profile switch as one large push |  | "A profile switch queues a large push. Review it as one." | `seasonal-profiles/4/4`, `seasonal-profiles/4/5` |
| 1:33 | 1:43 | 15 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; no up-next card, and the series-end line closes the transcript; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/seasonal-profiles` goes in the published description | — | — | — |

**VO total:** 202 words in 9 lines, about 69 s spoken (measured). **Running time:** about 1:43 (103 s) planned; the target is 1:30-2:15, inside the series range of 60-180 s. **Measured:** 1:47 (106.6 s) in the final render, take 1; -14.1 LUFS, -1.5 dBTP.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/seasonal-profiles`. Each VO line is cut from its step's body paragraph and figure caption (or from the guide's Where, Before you start and summary text), there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- seasonal-profiles` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim. Not narrated, because they are not Verified: `seasonal-profiles/1/2`, `seasonal-profiles/2/1`, `seasonal-profiles/4/6`, `seasonal-profiles/4/7`. One on-screen exception: the template puts each step title on its chapter card (episode lint check (b)), so the second chapter card reads APPLY THE EVENING BEFORE, as the live guide's step title does; `seasonal-profiles/2/1` is a Needs expert claim (the experts judge the step title in person on 2026-10-22), and the narration of that chapter cites only the Verified claims `2/2`, `2/3` and `2/4`. If the experts change the step title, the chapter card is rebuilt with it.

## Voice-over check

Whisper round-trip on 2026-10-21 (`video/vo/whisper_check.py`, model small.en, with medium.en on each flagged line); reports `vo/whisper-report-<model>.json` under the media root. 5 of 9 lines matched on small.en; medium.en cleared V1b. The rest are verb forms and homophones that are Whisper's: "jumped" heard as "jump" (V3a) and "queues" heard as "cues" (V4a, V4b). No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
