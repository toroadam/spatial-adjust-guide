# Double Click: Update and manage seasonal profiles

**Guide:** `#/seasonal-profiles` (merges the profile episodes; the retired keys redirect here) · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v2
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` in `episode.json`; the calm bed (`video/brand/music-calm.json`) is used for the render · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), lifted figures only, no guide prose in shot. Review decisions applied: C11 (the example name is Overseed), C12 (a profile applies course-wide, so check the Suggested column before you push), C13 (a profile matches stations by name; renamed or renumbered stations will not match an old profile; stations added after capture keep their target).

## Script

Planned times: the builder measures the real ones from the take and the VO render.

| Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|
| Open | Lockup, then the title card **Double Click: Update and manage seasonal profiles** | — | — | `seasonal-profiles/tile/1`, `seasonal-profiles/tile/2` |
| V0 | Title card | | "A small set of profiles, one per condition, is easier to run a season with." | `seasonal-profiles/summary/1` |
| Chapter | Typed chapter card | PLAN WHAT GOES IN THE FIVE SLOTS | — | — |
| V1a | **Target Profile** column lit | | "Name each of the five slots for a condition, not a date." | `seasonal-profiles/1/6` |
| V1b | The five-slot table lit | | "A short list stays readable a year later." | `seasonal-profiles/1/7` |
| V1c | **Last Updated** lit | | "Edits to your targets leave a saved profile out of date." | `updating-profiles/1/6` |
| V1d | **Update from Current** lit | | "To refresh a profile, mark its slot under Update from Current." | `updating-profiles/5/2`, `updating-profiles/5/7` |
| V1e | **Stations** lit | | "That overwrites its stored targets, but changes no station until you apply it." | `updating-profiles/5/7`, `updating-profiles/before/2` |
| V1f | The **Spring** row lit | | "For a one-off event, capture into a spare slot instead." | `updating-profiles/5/6` |
| Chapter | Typed chapter card | CONFIRM THE PROFILE | — | — |
| V2a | **Apply Profile** lit | | "Applying a profile recalculates the whole course, so treat it as a planned change." | `seasonal-profiles/before/1` |
| V2b | The **Summer Baseline** row lit | | "Apply it the evening before. Next morning, read the new suggestions against a fresh scan." | `seasonal-profiles/2/6`, `seasonal-profiles/2/7` |
| V2c | **Target Profile** column lit | | "A profile matches stations by name. A renamed or renumbered station won't match an old profile." | `seasonal-profiles/2/8` |
| V2d | **Stations** lit | | "Stations added after capture keep their target." | `seasonal-profiles/2/9` |
| Chapter | Typed chapter card | READ THE NEW SUGGESTIONS BEFORE PUSHING | — | — |
| V3a | **Target VWC** lit | | "A profile changes targets, and targets change deficits." | `seasonal-profiles/5/5` |
| V3b | **Suggested** lit | | "New targets, new suggestions. Review them before pushing." | `seasonal-profiles/5/6` |
| Chapter | Typed chapter card | PUSH ONCE YOU AGREE WITH THEM | — | — |
| V4 | **Changes** column of the push dialog lit | | "A profile switch queues a large push. Review it as one." | `seasonal-profiles/7/6`, `seasonal-profiles/7/7` |
| Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; no up-next card, and the series-end line closes the transcript | — | — | — |

**VO total:** 159 words in 14 lines, 903 characters (dry run). Running time target 60 to 180 s; the measured time is in the verify report.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e) reports no claim findings). No line rests on a Needs expert or Not shipping claim. Chapter 2 is labeled with the guide's step title Confirm the profile; the step before it, Apply the evening before, is a Needs expert title, so it is not put on a card.

## Voice-over check

Whisper round-trip on 2026-11-13 (small.en, with medium.en on each flagged line); 11 of 14 lines matched on small.en and medium.en cleared V1b. The rest are Whisper's: V2a hears "planned change" as "plan change" (the d runs into the ch) and V4 hears "queues" as "cues"; the same two words were flagged and accepted on the earlier takes. No line was re-rendered. Spend: 684 characters.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
