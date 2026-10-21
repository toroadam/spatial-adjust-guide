# Double Click #22: Push failures

**Episode:** 22 of 26 · **Wave:** 5 (Troubleshooting) · **Guide:** `#/push-failures` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Two stations could not be updated. The other four are done"; step 2 "The automatic retry pass, before the failure is reported"; step 3 "Diagnostics: Lynx interconnect, ping, installation ID"; step 4 "The failed stations are still queued; the successful ones are not". Every chapter carries a `sourceReason`; no control is clicked in the recreation, so no retry, push or scan request is made anywhere.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Push failures** | — | "Read the failure count, understand what has already been tried, and re-push only what failed." | `push-failures/tile/1`, `push-failures/tile/2`, `push-failures/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | READ THE COUNT, NOT THE COLOUR | — | `push-failures/1/1` (the step title) |
| 0:09 | 0:15 | 4 Step 1 | Push in on **2 stations could not be updated in Lynx.**, highlighted; the cursor moves to Pushing Changes To Lynx |  | "The message names how many stations could not be updated: here, two." | `push-failures/1/2`, `push-failures/1/4` |
| 0:15 | 0:25 | 5 Step 1 result | Hold on the screen; the cursor moves to Unable to Push Changes for 2 Station(s). Chec... |  | "The rest of the push succeeded. A failure is partial, and the stations that verified are already live in Lynx. The other four are done." | `push-failures/1/3`, `push-failures/1/5` |
| 0:25 | 0:27 | 6 Chapter 2 | Typed chapter card | KNOW WHAT HAS ALREADY BEEN TRIED | — | `push-failures/2/1` (the step title) |
| 0:27 | 0:33 | 7 Step 2 | The lifted figure for step 2. Push in on **Push Changes failed for 2 station(s). Retrying**, highlighted; the cursor moves to Pushing Changes To Lynx |  | "Failed stations are re-pushed automatically, up to two further attempts." | `push-failures/2/2` |
| 0:33 | 0:42 | 8 Step 2 result | Hold on the screen; the cursor moves to Pushing Changes To Lynx |  | "This is the automatic retry pass, before the failure is reported. The bar restarts at zero and counts only the stations being retried." | `push-failures/2/4`, `push-failures/2/5` |
| 0:42 | 0:44 | 9 Chapter 3 | Typed chapter card | CHECK THE CONNECTION TO LYNX | — | `push-failures/3/1` (the step title) |
| 0:44 | 0:53 | 10 Step 3 | The lifted figure for step 3. Push in on **Lynx interconnect:**, highlighted; the cursor moves to Lynx interconnect:, then Can ping cloud:, then Installation ID:, then Lynx course ID: |  | "Diagnostics reports the Lynx interconnect, whether the cloud can be pinged, and the installation and course identifiers." | `push-failures/3/2`, `push-failures/3/4` |
| 0:53 | 0:57 | 11 Step 3 result | Push in on **Can ping cloud:**, highlighted; the cursor moves to Can ping cloud: |  | "If the ping is failing, no amount of re-pushing will help." | `push-failures/3/3` |
| 0:57 | 0:59 | 12 Chapter 4 | Typed chapter card | RE-PUSH ONLY THE FAILURES | — | `push-failures/4/1` (the step title) |
| 0:59 | 1:11 | 13 Step 4 | The lifted figure for step 4. Push in on **6 Pushed Today**, highlighted; the cursor moves to Last Push |  | "The stations that failed are still pending, but they count as pushed today, so reopening Push Changes lists them under Pushed Today, unticked." | `push-failures/4/2`, `push-failures/4/5` |
| 1:11 | 1:23 | 14 Step 4 result | Hold on the screen; the cursor moves to 6 Pushed Today, then 6 Available to Push |  | "Tick them to send them again. Stations that went through are not listed again, so the whole set cannot go out twice. Untick anything under Available to Push that you did not mean to send." | `push-failures/4/3`, `push-failures/4/4` |
| 1:23 | 1:33 | 15 Close | Up-next card "Next on Double Click: Apply a target profile", then the end card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/push-failures` is the transcript's last line | — | — | — |

**VO total:** 171 words in 9 lines, about 60 s spoken (measured). **Running time:** about 1:33 (93 s); the series range is 60-180 s. **Measured:** 1:38 (98.3 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/push-failures`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- push-failures` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). 3 claims of this guide are Needs expert and no line states them: `push-failures/2/3`, `push-failures/4/6`, `push-failures/4/7`.

## Voice-over check

Whisper small.en on all 9 lines, medium.en on V4a. Differences are Whisper's: "re-push" heard as "repush", "Links" as "links". V4a ("pushed today" heard as "push today", both models) is worth a listen: the d runs into the t of "today". No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
