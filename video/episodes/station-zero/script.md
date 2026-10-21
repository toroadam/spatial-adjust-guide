# Double Click #18: Why is this station 0%?

**Episode:** 18 of 26 · **Wave:** 5 (Troubleshooting) · **Guide:** `#/station-zero` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Measured 34.5 percent against a 16 percent target"; step 2 "Set to zero when pushed to Lynx converts small adjustments into zeros"; step 3 "Station 5AP1 is disabled; the switch on its row is grey"; step 4 "A modelled value: grey, italic, and dated two days ago"; step 5 "Diagnostics dialog, opened from the toolbar logo". Every chapter carries a `sourceReason`; no control is clicked in the recreation, so no retry, push or scan request is made anywhere.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Why is this station 0%?** | — | "Zero means the calculation asked for no water. Four checks, in order, tell you whether that is right." | `station-zero/tile/1`, `station-zero/tile/2`, `station-zero/before/1`, `station-zero/summary/2` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | CHECK WHETHER THE STATION IS ALREADY WET | — | `station-zero/1/1` (the step title) |
| 0:09 | 0:19 | 4 Step 1 | Push in on **the 10AP1 row**, highlighted; the cursor moves to 10AP1, then 34.5% |  | "When measured VWC is comfortably above the station target, the required amount is zero, and so is the suggestion." | `station-zero/1/3` |
| 0:19 | 0:30 | 5 Step 1 result | Hold on the screen; the cursor moves to 34.5%, then 16, then 0% |  | "Station 10AP1 read 34.5 percent against a target of 16. It does not need water today, so zero is the right answer." | `station-zero/1/4`, `station-zero/1/5`, `station-zero/1/6` |
| 0:30 | 0:32 | 6 Chapter 2 | Typed chapter card | CHECK THE MINIMUM THRESHOLD | — | `station-zero/2/1` (the step title) |
| 0:32 | 0:40 | 7 Step 2 | The lifted figure for step 2. Push in on **Set to zero when pushed to Lynx**, highlighted; the cursor moves to Suggested Percent Adjust values below the min..., then Set to zero when pushed to Lynx |  | "With Set to zero when pushed to Lynx selected, a small but genuine adjustment is written to Lynx as 0 percent." | `station-zero/2/2`, `station-zero/2/5` |
| 0:40 | 0:50 | 8 Step 2 result | Push in on **Set to the minimum threshold value when pushe...**, highlighted; the cursor moves to Set to the minimum threshold value when pushe... |  | "The table still shows the raw value, so the two disagree. Switch to the minimum threshold value option if you want those stations to keep running." | `station-zero/2/3`, `station-zero/2/4` |
| 0:50 | 0:51 | 9 Chapter 3 | Typed chapter card | CHECK WHETHER THE STATION IS DISABLED | — | `station-zero/3/1` (the step title) |
| 0:51 | 1:01 | 10 Step 3 | The lifted figure for step 3. Push in on **Enable**, highlighted; the cursor moves to Enable |  | "A station with the Enable switch off is left out of every push, so Lynx keeps whatever percent adjust it already holds." | `station-zero/3/2` |
| 1:01 | 1:15 | 11 Step 3 result | Push in on **the 5AP1 row**, highlighted; the cursor moves to 333%, then the 5AP1 row |  | "Its suggestion is still calculated and shown, so being disabled does not by itself explain a zero. Station 5AP1 is disabled; the switch on its row is grey." | `station-zero/3/3`, `station-zero/3/5` |
| 1:15 | 1:16 | 12 Chapter 4 | Typed chapter card | CHECK THE SCAN DATE | — | `station-zero/4/1` (the step title) |
| 1:16 | 1:29 | 13 Step 4 | The lifted figure for step 4. Push in on **50.0%**, highlighted; the cursor moves to 08-06-25 |  | "A scan date older than today means the reading is stale. Spatial Adjust falls back to the modelled value, in grey italics with a calculator icon." | `station-zero/4/2`, `station-zero/4/3` |
| 1:29 | 1:40 | 14 Step 4 result | Hold on the screen; the cursor moves to the 7AP1 row, then 08-06-25 |  | "Station 7AP1 shows a modelled value, grey and italic, dated two days ago. If the whole course is stale, TurfRad has not delivered new scans yet." | `station-zero/4/6`, `station-zero/4/4` |
| 1:40 | 1:42 | 15 Chapter 5 | Typed chapter card | CONFIRM THE DATA PATH | — | `station-zero/5/1` (the step title) |
| 1:42 | 1:51 | 16 Step 5 | The lifted figure for step 5. Push in on **Spatial Adjust Diagnostics**, highlighted; the cursor moves to Spatial Adjust Diagnostics |  | "If nothing above explains it, open the diagnostics dialog by holding Shift and Alt and clicking the Spatial Adjust logo." | `station-zero/5/2`, `station-zero/5/5` |
| 1:51 | 2:01 | 17 Step 5 result | Hold on the screen; the cursor moves to SA has org access:, then Org has scan data:, then Last scan date:, then Can ping cloud: |  | "It reports whether the org has TurfRad access, whether it has scan data at all, the last scan date, and whether Lynx is reachable." | `station-zero/5/4` |
| 2:01 | 2:10 | 18 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Get fresh scan data**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/station-zero` goes in the published description | — | — | — |

**VO total:** 252 words in 11 lines, about 92 s spoken (measured). **Running time:** about 2:10 (131 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/station-zero`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- station-zero` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). 2 claims of this guide are Needs expert and no line states them: `station-zero/summary/1`, `station-zero/1/2`.

## Voice-over check

To be recorded after the Whisper round-trip (video/vo/whisper_check.py).

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
