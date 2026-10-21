# Double Click #9: Verify results

**Episode:** 9 of 26 · **Wave:** 2 (Review & Apply) · **Guide:** `#/verify-results` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Phase one"; step 2 "Phase two"; step 3 "Phase three"; step 4 "Phase four"; step 5 "All selected changes pushed and verified"

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:09 | 2 Title | Title card **Double Click: Verify results** | — | "A push is four phases, not one. Knowing them tells you what a slow run is waiting for." | `verify-results/tile/1`, `verify-results/tile/2`, `verify-results/summary/1`, `verify-results/summary/2` |
| 0:09 | 0:11 | 3 Chapter 1 | Typed chapter card | IT WRITES FIRST, STATION BY STATION | — | `verify-results/1/1` |
| 0:11 | 0:22 | 4 Step 1 | **progress line** is highlighted; the cursor moves to `Pushing Percent Adjustments to Lynx (4 of 6)`, then `Pushing Changes To Lynx` |  | "Nothing is read before the push begins. Stations are written in sequence with a short pause between each, and the progress line names which one it is on." | `verify-results/1/2`, `verify-results/1/3` |
| 0:22 | 0:35 | 5 Step 1 result | Focus box on `Pushing Percent Adjustments to Lynx (4 of 6)`; the cursor settles on `Pushing Percent Adjustments to Lynx (4 of 6)` |  | "The writing counter runs on a fixed timer and does not wait for Lynx. If a run stalls, it stalls in the next phase, while Spatial Adjust waits for Lynx to answer." | `verify-results/1/4`, `verify-results/1/5` |
| 0:35 | 0:36 | 6 Chapter 2 | Typed chapter card | THEN IT READS LYNX BACK | — | `verify-results/2/1` |
| 0:36 | 0:42 | 7 Step 2 | Lifted figure "Phase two"; **Lynx** is highlighted; the cursor moves to `Retrieving latest Percent Adjustments from Lynx for comparison`, then `Pushing Changes To Lynx` |  | "With the writing done, Spatial Adjust retrieves the current percent adjustments from Lynx." | `verify-results/2/2` |
| 0:42 | 0:52 | 8 Step 2 result | Focus box on `Retrieving latest Percent Adjustments from Lynx for comparison`; the cursor settles on `Retrieving latest Percent Adjustments from Lynx for comparison` |  | "This is a read-back, not a baseline. It is collecting what Lynx actually holds now, so the next phase has something to check the push against." | `verify-results/2/3` |
| 0:52 | 0:54 | 9 Chapter 3 | Typed chapter card | THEN IT VERIFIES | — | `verify-results/3/1` |
| 0:54 | 1:01 | 10 Step 3 | Lifted figure "Phase three"; **verifies** is highlighted; the cursor moves to `Verifying adjustments sent to Lynx`, then `Pushing Changes To Lynx` |  | "Spatial Adjust re-reads the station list and compares each value it sent against what Lynx now reports." | `verify-results/3/2` |
| 1:01 | 1:07 | 11 Step 3 result | Focus box on `Verifying adjustments sent to Lynx`; the cursor settles on `Verifying adjustments sent to Lynx` |  | "Anything that does not match is treated as failed rather than assumed good." | `verify-results/3/3` |
| 1:07 | 1:08 | 12 Chapter 4 | Typed chapter card | FAILURES ARE RETRIED AUTOMATICALLY | — | `verify-results/4/1` |
| 1:08 | 1:21 | 13 Step 4 | Lifted figure "Phase four"; **progress line** is highlighted; the cursor moves to `Push Changes failed for 2 station(s). Retrying`, then `Pushing Changes To Lynx` |  | "Stations that did not take are re-pushed, up to two further attempts after the first. The progress line names how many are being retried, so a retry is information rather than an error." | `verify-results/4/2`, `verify-results/4/3` |
| 1:21 | 1:33 | 14 Step 4 result | Focus box on `Push Changes failed for 2 station(s). Retrying`; the cursor settles on `Push Changes failed for 2 station(s). Retrying` |  | "The bar restarts at zero for the retry pass and counts only the failed stations. A drop from nearly complete back to nothing is the retry beginning, not the push collapsing." | `verify-results/4/4` |
| 1:33 | 1:35 | 15 Chapter 5 | Typed chapter card | READ THE OUTCOME | — | `verify-results/5/1` |
| 1:35 | 1:40 | 16 Step 5 | Lifted figure "All selected changes pushed and verified"; **Push Changes** is highlighted; the cursor moves to `All selected changes successfully pushed to Lynx.`, then `Pushing Changes To Lynx` |  | "A clean run confirms that every selected change reached Lynx and verified." | `verify-results/5/2` |
| 1:40 | 1:44 | 17 Step 5 result | Focus box on `All selected changes successfully pushed to Lynx.`; the cursor settles on `All selected changes successfully pushed to Lynx.` |  | "The dialog reports success rather than a failure count." | `verify-results/verify/1` |
| 1:44 | 1:49 | 18 Up next | **Next on Double Click: Editing station targets** | — | — | — |
| 1:49 | 1:54 | 19 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/verify-results` goes in the published description | — | — | — |

**VO total:** 232 words in 11 lines, about 83 s spoken (estimated at 2.8 words a second). **Running time:** about 1:54 (114 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/verify-results`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- verify-results` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). Not narrated, because they are not Verified: `verify-results/1/7`, `verify-results/1/8`.

The push window (`verify-results/1/7`, `1/8`) is a Needs expert claim, so it is not narrated. Step 5's Verified sentence about the dashboard counters afterwards (`verify-results/5/3`) is also left out, because the recreation's figure 5 still shows the toolbar's Push 6 Changes behind the result dialog and the picture would contradict the line; the closing line cites `verify-results/verify/1` instead. The four phases and the result are the guide site's recreation; the push's send is short-circuited in Demo Mode (`push-send`), and here nothing is clicked or sent, so `demoWriteClicks` is empty.

## Voice-over check

Whisper round-trip pending (EP-5).

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
