# Double Click: Capture and apply a profile

**Guide:** `#/target-profiles` (merges the profile episodes; the retired keys redirect here) · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v2
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` in `episode.json`; the calm bed (`video/brand/music-calm.json`) is used for the render · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), lifted figures only, no guide prose in shot. Review decisions applied: C11 (the example name is Overseed), C12 (a profile applies course-wide, so check the Suggested column before you push), C13 (a profile matches stations by name; renamed or renumbered stations will not match an old profile; stations added after capture keep their target).

## Script

Planned times: the builder measures the real ones from the take and the VO render.

| Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|
| Open | Lockup, then the title card **Double Click: Capture and apply a profile** | — | — | `target-profiles/tile/1`, `target-profiles/tile/2` |
| V0 | Title card | | "Save your station targets under a name. Then switch the whole course to them in one action." | `target-profiles/summary/1` |
| Chapter | Typed chapter card | OPEN SETTINGS | — | — |
| V1a | Dialog title **Settings** lit | | "Click the gear in the toolbar. The Settings dialog opens." | `target-profiles/1/2`, `target-profiles/1/3` |
| Chapter | Typed chapter card | OPEN THE TARGET PROFILES TAB | — | — |
| V1b | **Target Profiles** in the left rail lit | | "Then click Target Profiles in the left rail." | `target-profiles/2/2` |
| Chapter | Typed chapter card | READ THE PROFILE LIST | — | — |
| V2a | The five-slot table lit | | "The tab lists five profile slots for each Lynx course." | `target-profiles/note/1`, `target-profiles/2/3` |
| V2b | **Stations** column lit | | "A profile stores one Target VWC per station, and nothing else." | `target-profiles/before/1`, `target-profiles/before/2` |
| V2c | **Target Profile** column lit | | "Name a profile for the condition, such as Overseed." | `creating-profiles/4/1`, `creating-profiles/4/6` |
| V2d | **Update from Current**, then **Save Changes** | | "To capture your targets, mark the slot under Update from Current. Nothing is captured until you save." | `creating-profiles/5/7`, `creating-profiles/6/6` |
| Chapter | Typed chapter card | CHOOSE THE PROFILE | — | — |
| V3a | **Last Updated**, then **Apply Profile** | | "To apply a profile, choose it under Apply Profile, then confirm." | `target-profiles/4/2`, `target-profiles/5/2` |
| V3b | **Target Profile** column lit | | "A profile matches stations by name. A renamed or renumbered station won't match an old profile." | `target-profiles/4/8` |
| V3c | **Stations** column lit | | "Stations added after capture keep their target." | `target-profiles/4/9` |
| V4a | Figure swaps to the table; **Target VWC**, then a station target | | "Read Target VWC on a few stations. They match the profile." | `target-profiles/7/2`, `target-profiles/7/3` |
| V4b | **Suggested** lit | | "A profile applies course-wide, so check the Suggested column before you push." | `target-profiles/4/6`, `target-profiles/7/7` |
| Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Update and manage seasonal profiles** | — | — | — |

**VO total:** 139 words in 12 lines, 801 characters (dry run). Running time target 60 to 180 s; the measured time is in the verify report.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e) reports no claim findings). No line rests on a Needs expert or Not shipping claim.

## Voice-over check

Whisper round-trip on 2026-11-13 (`video/vo/whisper_check.py`, model small.en); 12 of 12 lines matched word for word. Spend: 747 characters.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
