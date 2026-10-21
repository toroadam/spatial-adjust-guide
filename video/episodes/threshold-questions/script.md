# Double Click #20: Threshold questions

**Episode:** 20 of 26 · **Wave:** 5 (Troubleshooting) · **Guide:** `#/threshold-questions` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "The raw suggested value, untouched by the threshold"; step 2 "Original and rewritten values, shown together"; step 3 "Two options, opposite outcomes"; step 4 "Exclude Zeros is enabled only for the second option"; step 5 "A threshold of 0 disables the feature". Every chapter carries a `sourceReason`; no control is clicked in the recreation, so no retry, push or scan request is made anywhere.

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Threshold questions** | — | "Why the table and the push dialog disagree, and what the second option really does." | `threshold-questions/tile/1`, `threshold-questions/tile/2`, `threshold-questions/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | THE TABLE SHOWS THE RAW SUGGESTION | — | `threshold-questions/1/1` (the step title) |
| 0:09 | 0:21 | 4 Step 1 | Push in on **the 11AP2 row**, highlighted; the cursor moves to 11AP2, then 6% |  | "Station 11AP2 suggests 6 percent. With a 10 percent threshold set, the table still shows 6, and it always will." | `threshold-questions/1/2`, `threshold-questions/1/3` |
| 0:21 | 0:28 | 5 Step 1 result | Hold on the screen; the cursor moves to 6%, then Push 6 Changes |  | "The threshold is applied only in the Push Changes dialog, and to what is sent to Lynx. Never to the table." | `threshold-questions/1/3`, `threshold-questions/1/4` |
| 0:28 | 0:30 | 6 Chapter 2 | Typed chapter card | THE PUSH DIALOG SHOWS WHAT WILL BE SENT | — | `threshold-questions/2/1` (the step title) |
| 0:30 | 0:41 | 7 Step 2 | The lifted figure for step 2. Push in on **→ Adjusted to 10%**, highlighted; the cursor moves to Push Changes, then → Adjusted to 10%, then 2 stations will be adjusted according to the ... |  | "Open Push Changes and the same station shows its original value and the rewritten one side by side, with the banner counting how many rows were affected." | `threshold-questions/2/2`, `threshold-questions/2/4` |
| 0:41 | 0:46 | 8 Step 2 result | Hold on the screen; the cursor moves to Changes |  | "This is the disagreement, and it is intentional." | `threshold-questions/2/3` |
| 0:46 | 0:48 | 9 Chapter 3 | Typed chapter card | CHOOSE WHAT BELOW-THRESHOLD MEANS | — | `threshold-questions/3/1` (the step title) |
| 0:48 | 1:02 | 10 Step 3 | The lifted figure for step 3. Push in on **Set to zero when pushed to Lynx**, highlighted; the cursor moves to Set to zero when pushed to Lynx, then Set to the minimum threshold value when pushe... |  | "Set to zero skips the station: Lynx receives 0 percent. Set to the minimum threshold value lifts the suggestion up to the threshold, so the station still gets a short run." | `threshold-questions/3/2`, `threshold-questions/3/3` |
| 1:02 | 1:05 | 11 Step 3 result | Hold on the screen; the cursor moves to Set to the minimum threshold value when pushe... |  | "They are opposite behaviours from the same number." | `threshold-questions/3/4`, `threshold-questions/3/5` |
| 1:05 | 1:07 | 12 Chapter 4 | Typed chapter card | EXCLUDE ZEROS PROTECTS GENUINE ZEROS | — | `threshold-questions/4/1` (the step title) |
| 1:07 | 1:19 | 13 Step 4 | The lifted figure for step 4. Push in on **Exclude Zeros**, highlighted; the cursor moves to Exclude Zeros |  | "Exclude Zeros is available only under the second option. A station whose suggestion is a true zero stays at zero, instead of being lifted to the threshold." | `threshold-questions/4/2`, `threshold-questions/4/4` |
| 1:19 | 1:24 | 14 Step 4 result | Hold on the screen; the cursor moves to Set to the minimum threshold value when pushe... |  | "Without it, a station that needs no water gets a small run anyway." | `threshold-questions/4/3` |
| 1:24 | 1:26 | 15 Chapter 5 | Typed chapter card | ZERO DISABLES THE FEATURE | — | `threshold-questions/5/1` (the step title) |
| 1:26 | 1:33 | 16 Step 5 | The lifted figure for step 5. Push in on **Minimum Threshold (%)**, highlighted; the cursor moves to Minimum Threshold (%) |  | "A threshold of zero turns the whole thing off, and the option group is disabled with it." | `threshold-questions/5/2`, `threshold-questions/5/4` |
| 1:33 | 1:41 | 17 Step 5 result | Hold on the screen; the cursor moves to Set to zero when pushed to Lynx |  | "If the push dialog shows no banner, check this first. The setting is site-level, and someone else may have cleared it." | `threshold-questions/5/3` |
| 1:41 | 1:50 | 18 Close | End card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; up next **Next on Double Click: Calculation questions**; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/threshold-questions` goes in the published description | — | — | — |

**VO total:** 208 words in 11 lines, about 72 s spoken (measured). **Running time:** about 1:50 (111 s); the series range is 60-180 s.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/threshold-questions`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- threshold-questions` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e)). None of this guide's claims is Needs expert or Not shipping.

## Voice-over check

To be recorded after the Whisper round-trip (video/vo/whisper_check.py).

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
