# Double Click #19: Get fresh scan data

**Episode:** 19 of 26 · **Wave:** 5 (Troubleshooting) · **Guide:** `#/request-scan-data` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Scan dates sit beside the station name in the table"; step 2 "Request latest scan data, between the pushed-today counter and the gear"; step 3 "A queued request confirms immediately; the data arrives later"; step 4 "The banner offers Reload Data or Dismiss"; step 5 "Diagnostics: TurfRad access, scan data, last scan date". Every chapter carries a `sourceReason`; no control is clicked in the recreation, so no retry, push or scan request is made anywhere.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Get fresh scan data** | — | "A course that has fallen behind TurfRad does not have to wait for the next automatic retrieval. Ask for the latest scan data, and reload when it is ready." | `request-scan-data/tile/1`, `request-scan-data/tile/2`, `request-scan-data/summary/1`, `request-scan-data/summary/2` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | READ THE SCAN DATE BEFORE ANYTHING ELSE | — | `request-scan-data/1/1` (the step title) |
| 0:09 | 0:15 | 4 Step 1 | Push in on **the 3AP1 row**, highlighted; the cursor moves to 08-08-25 |  | "Every station row carries the date its reading was captured." | `request-scan-data/1/2` |
| 0:15 | 0:24 | 5 Step 1 result | Hold on the screen; the cursor moves to 08-06-25, then 08-08-25 |  | "One stale row is a station. A column of stale dates is the whole course, and that is a supply problem rather than a settings problem." | `request-scan-data/1/3`, `request-scan-data/1/4` |
| 0:24 | 0:25 | 6 Chapter 2 | Typed chapter card | REQUEST THE LATEST SCAN | — | `request-scan-data/2/1` (the step title) |
| 0:25 | 0:33 | 7 Step 2 | The lifted figure for step 2. Push in on **⟳**, highlighted; the cursor moves to ⟳ |  | "The circular-arrow button in the toolbar's right-hand group is Request latest scan data." | `request-scan-data/2/2` |
| 0:33 | 0:46 | 8 Step 2 result | Hold on the screen |  | "It asks Spatial Adjust to fetch the latest scan data TurfRad already holds. It does not order a new scan, it does not reload the dashboard, and it does not change a single calculation setting." | `request-scan-data/2/3`, `request-scan-data/2/4` |
| 0:46 | 0:47 | 9 Chapter 3 | Typed chapter card | IT QUEUES, IT DOES NOT BLOCK | — | `request-scan-data/3/1` (the step title) |
| 0:47 | 0:57 | 10 Step 3 | The lifted figure for step 3. Push in on **⟳**, highlighted; the cursor moves to ⟳ |  | "The request is queued and you are told so. Retrieval may take several minutes, and you are notified when it is ready." | `request-scan-data/3/2` |
| 0:57 | 1:04 | 11 Step 3 result | Hold on the screen; the cursor moves to Avg. VWC, then 27.6%, then 30.3% |  | "You can carry on reading the table while it runs. Nothing is frozen, and nothing is lost if you navigate away." | `request-scan-data/3/3` |
| 1:04 | 1:06 | 12 Chapter 4 | Typed chapter card | RELOAD WHEN THE BANNER APPEARS | — | `request-scan-data/4/1` (the step title) |
| 1:06 | 1:19 | 13 Step 4 | The lifted figure for step 4. Push in on **Reload Data**, highlighted; the cursor moves to The requested scan data is ready. |  | "When the retrieval finishes, a banner says so, whether or not TurfRad had a newer scan. Reload Data pulls it into the dashboard, and every suggestion recalculates." | `request-scan-data/4/2`, `request-scan-data/4/3` |
| 1:19 | 1:27 | 14 Step 4 result | Push in on **Dismiss**, highlighted; the cursor moves to Dismiss |  | "Dismiss closes the banner and leaves you on the data you already had. The new scan is not thrown away; it is simply not loaded yet." | `request-scan-data/4/4` |
| 1:27 | 1:29 | 15 Chapter 5 | Typed chapter card | IF THE REQUEST WILL NOT QUEUE | — | `request-scan-data/5/1` (the step title) |
| 1:29 | 1:44 | 16 Step 5 | The lifted figure for step 5. Push in on **Spatial Adjust Diagnostics**, highlighted; the cursor moves to Spatial Adjust Diagnostics, then SA has org access:, then Org has scan data: |  | "A failed request says so straight away rather than silently doing nothing. If it keeps failing, the diagnostics dialog reports whether the organisation has TurfRad access and whether it has scan data at all." | `request-scan-data/5/2`, `request-scan-data/5/3`, `request-scan-data/5/4` |
| 1:44 | 1:52 | 17 Step 5 result | Push in on **Last scan date:**, highlighted; the cursor moves to Last scan date: |  | "A course-wide problem is almost always there, rather than in your settings. Check the last scan date." | `request-scan-data/5/3`, `request-scan-data/5/4` |
| 1:52 | 2:01 | 18 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Threshold questions**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/request-scan-data` goes in the published description | — | — | — |

**VO total:** 260 words in 11 lines, about 87 s spoken (measured). **Running time:** about 2:01 (122 s); the series range is 60-180 s. **Measured:** 2:16 (136.7 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/request-scan-data`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- request-scan-data` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). None of this guide's claims is Needs expert or Not shipping.

## Voice-over check

Whisper small.en on all 11 lines, medium.en on V5a. Differences are Whisper's: US for UK spelling ("organisation", "dialog"), "Turf Rad" as one word, "straight away" as "straightaway". V5a ("scan" heard as "scanned" in one pass) is worth a listen. No line was re-rendered.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
