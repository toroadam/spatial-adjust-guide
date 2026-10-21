# Double Click #8: Reviewing changes

**Episode:** 8 of 26 · **Wave:** 2 (Review & Apply) · **Guide:** `#/reviewing-changes` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Six changes pending."; step 2 "Current on the left"; step 3 "Pushed Today arrives"; step 4 "Two stations will"; step 5 "The footer count is"

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:09 | 2 Title | Title card **Double Click: Reviewing changes** | — | "Read the push dialog properly before you send: two lists, two columns, and one count that matters." | `reviewing-changes/tile/1`, `reviewing-changes/tile/2`, `reviewing-changes/summary/1` |
| 0:09 | 0:11 | 3 Chapter 1 | Typed chapter card | OPEN PUSH CHANGES | — | `reviewing-changes/1/1` |
| 0:11 | 0:20 | 4 Step 1 | **Push Changes** is highlighted; the cursor moves to `Push 6 Changes`, then `6` |  | "The button carries the number of enabled stations whose percent adjustment differs from what Lynx holds, leaving out any already pushed today." | `reviewing-changes/1/2` |
| 0:20 | 0:27 | 5 Step 1 result | Focus box on `Push 6 Changes`; the cursor settles on `Push 6 Changes` |  | "It is disabled when nothing is queued, so a greyed-out button means there is nothing to review." | `reviewing-changes/1/3` |
| 0:27 | 0:29 | 6 Chapter 2 | Typed chapter card | READ CURRENT AGAINST CHANGES | — | `reviewing-changes/2/1` |
| 0:29 | 0:35 | 7 Step 2 | Lifted figure "Current on the left"; **Current** is highlighted; the cursor moves to `Current`, then `Changes` |  | "The left column is what Lynx holds now; the right is what will replace it." | `reviewing-changes/2/2` |
| 0:35 | 0:41 | 8 Step 2 result | Focus box on `3AP1`; the cursor settles on `3AP1` |  | "Both name the station, so you are always comparing the same head across the row." | `reviewing-changes/2/3` |
| 0:41 | 0:43 | 9 Chapter 3 | Typed chapter card | TREAT THE TWO LISTS DIFFERENTLY | — | `reviewing-changes/3/1` |
| 0:43 | 0:53 | 10 Step 3 | Lifted figure "Pushed Today arrives"; **Available to Push** is highlighted; the cursor moves to `6 Available to Push`, then `6 Pushed Today` |  | "Available to Push comes first, ticked. Pushed Today follows, unticked, and is there to stop you adjusting the same head twice in a day." | `reviewing-changes/3/2`, `reviewing-changes/3/3` |
| 0:53 | 1:02 | 11 Step 3 result | Focus box on `6 Pushed Today`; the cursor settles on `6 Pushed Today`, then `3AP2` |  | "That hold releases at midnight where the course is, not 24 hours after the push. Tick a pushed station only when you mean to." | `reviewing-changes/3/4`, `reviewing-changes/3/5` |
| 1:02 | 1:04 | 12 Chapter 4 | Typed chapter card | CHECK FOR THRESHOLD REWRITES | — | `reviewing-changes/4/1` |
| 1:04 | 1:10 | 13 Step 4 | Lifted figure "Two stations will"; **banner** is highlighted; the cursor moves to `2 stations will be adjusted`, then `REVIEW THRESHOLD` |  | "When a minimum threshold is set, the banner counts the stations it will rewrite." | `reviewing-changes/4/2` |
| 1:10 | 1:16 | 14 Step 4 result | Focus box on `Adjusted to 10%`; the cursor settles on `Adjusted to 10%` |  | "The affected rows show both the original and the value that will actually be sent." | `reviewing-changes/4/2` |
| 1:16 | 1:18 | 15 Chapter 5 | Typed chapter card | TRUST THE FOOTER COUNT | — | `reviewing-changes/5/1` |
| 1:18 | 1:25 | 16 Step 5 | Lifted figure "The footer count is"; **footer** is highlighted; the cursor moves to `Push 6 changes to Lynx`, then `3AP1` |  | "The footer button names the number of ticked rows, and that is exactly what will be sent." | `reviewing-changes/5/2` |
| 1:25 | 1:33 | 17 Step 5 result | Focus box on `Push 6 changes to Lynx`; the cursor settles on `4AP1`, then `Push 6 changes to Lynx` |  | "Unticking a row is not the same as reverting it. The edit stays in the table for next time." | `reviewing-changes/5/3` |
| 1:33 | 1:38 | 18 Up next | **Next on Double Click: Verify results** | — | — | — |
| 1:38 | 1:43 | 19 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/reviewing-changes` goes in the published description | — | — | — |

**VO total:** 199 words in 11 lines, about 71 s spoken (estimated at 2.8 words a second). **Running time:** about 1:43 (103 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/reviewing-changes`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- reviewing-changes` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). Not narrated, because they are not Verified: `reviewing-changes/5/5`, `reviewing-changes/5/6`.

The push window (`reviewing-changes/5/5`, `5/6`) is a Needs expert claim, so it is not narrated. The Push Changes dialog is shown on the guide site's recreation; nothing is clicked and nothing is sent, so `demoWriteClicks` is empty.

## Voice-over check

Whisper round-trip pending (EP-5).

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
