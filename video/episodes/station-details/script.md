# Double Click #13: Station details

**Episode:** 13 of 26 · **Wave:** 3 (Station Management) · **Guide:** `#/station-details` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "Station 6AP1 has a chevron"; step 2 "Two sprinklers under"; step 3 "Mean of the children"; step 4 "The second sprinkler".

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Station details** | — | "Some stations drive more than one sprinkler. Expand the row to see what each head actually measured." | `station-details/tile/1`, `station-details/tile/2`, `station-details/summary/1`, `station-details/summary/2` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | SPOT THE EXPANDABLE ROWS | — | `station-details/1/1` (the step title) |
| 0:09 | 0:17 | 4 Step 1 | Push in on the chevron beside station **6AP1**, highlighted; the cursor moves to the station name |  | "A chevron beside the station name means the station has more than one sprinkler paired to it." | `station-details/1/2` |
| 0:17 | 0:21 | 5 Step 1 result | Station **5AP1**, which has no chevron, is highlighted: its row is the whole story |  | "Without the chevron, the row is the whole story." | `station-details/1/3` |
| 0:21 | 0:23 | 6 Chapter 2 | Typed chapter card | EXPAND THE STATION | — | `station-details/2/1` (the step title) |
| 0:23 | 0:33 | 7 Step 2 | The figure swaps to the expanded station: child row **6AP1-1** is highlighted, and the cursor visits each child's reading |  | "Each child row is named for its parent and numbered, and carries its own scan date and its own measured moisture." | `station-details/2/2` |
| 0:33 | 0:40 | 8 Step 2 result | The parent row's **Target VWC** field is highlighted; the cursor moves to the second child row, which has no field to edit |  | "Nothing else is editable at sprinkler level. The target and the adjustment belong to the station." | `station-details/2/3` |
| 0:40 | 0:42 | 9 Chapter 3 | Typed chapter card | THE PARENT VALUE IS AN AVERAGE | — | `station-details/3/1` (the step title) |
| 0:42 | 0:49 | 10 Step 3 | The parent average **30.9%** is highlighted; the cursor visits the two children |  | "The station's average VWC is the mean of its sprinklers." | `station-details/3/2`, `station-details/3/3` |
| 0:49 | 1:00 | 11 Step 3 result | The cursor visits **31.4%** and **30.4%**, then returns to the average **30.9%** |  | "Two heads reading 31.4 and 30.4 give a station average of 30.9, and a station that looks fine can still hide one dry head." | `station-details/3/4` |
| 1:00 | 1:02 | 12 Chapter 4 | Typed chapter card | WATCH FOR A MODELLED CHILD | — | `station-details/4/1` (the step title) |
| 1:02 | 1:15 | 13 Step 4 | The second child, last scanned two days ago, is highlighted: its value carries the orange calculator icon |  | "A child whose scan is older than today shows a modelled value marked with an orange calculator icon, and the parent average is then part measurement and part model." | `station-details/4/2` |
| 1:15 | 1:23 | 14 Step 4 result | The parent average **30.9%**, with its grey calculator icon, is highlighted |  | "The parent row carries a grey calculator icon beside its average, so you can tell it includes a modelled reading." | `station-details/4/3` |
| 1:23 | 1:33 | 15 Close | Up next **Next on Double Click: Set a minimum threshold**; end card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/station-details` goes in the published description | — | — | — |

**VO total:** 163 words in 9 lines, about 53 s spoken (measured). **Running time:** about 1:33 (93 s); the series range is 60-180 s. **Measured:** 1:44 (104.6 s) in the final render, take 1, with the template v1 up-next card and the chapter cards' holds.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/station-details`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- station-details` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim. The Needs expert tip of step 3 ("Why it matters") is not narrated.

## Voice-over check

Whisper round-trip on 2026-10-20 (`video/vo/whisper_check.py`, model small.en, with medium.en on any line small.en flagged); reports `vo/whisper-report-<model>.json` under the media root. Every line matched word for word apart from US spellings: 'modelled' heard as 'modeled' and 'grey' as 'gray' (the script keeps the British spelling the guide uses); judged by the executor as Whisper's, not misreadings; no line was re-rendered. The lines were rendered at the API output format mp3_44100_128, because the account's plan no longer allows mp3_44100_192 (the render report records the format); voice, model and settings are unchanged.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
