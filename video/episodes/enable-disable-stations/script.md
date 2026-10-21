# Double Click #12: Enable and disable stations

**Episode:** 12 of 26 · **Wave:** 3 (Station Management) · **Guide:** `#/enable-disable-stations` · **Template:** v1 ([`../RUNBOOK.md`](../RUNBOOK.md)) · **Script version:** v1
**Voice:** ElevenLabs Brian (`Gubgw9l4dtIoQA9YZHgx`, eleven_multilingual_v2) · **Music:** `sa-bed-v1` · **Map:** restyle (gate G2)
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure per chapter: step 1 "A disabled station"; step 2 "Hole rows carry"; step 3 "The cascade confirmation"; step 4 "The same dialog for an area"; step 5 "Layers filtered".

## Script

Planned times: the builder measures the real ones from the take and the VO render. Holds are from the VO render report.

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:02 | 1 Open | The Spatial Adjust lockup on the contour wall | — | — | — |
| 0:02 | 0:08 | 2 Title | Title card **Double Click: Enable and disable stations** | — | "Take a station, hole or area out of adjustment, and understand what cascading does before you confirm it." | `enable-disable-stations/tile/1`, `enable-disable-stations/tile/2`, `enable-disable-stations/summary/1` |
| 0:08 | 0:09 | 3 Chapter 1 | Typed chapter card | TOGGLE A SINGLE STATION | — | `enable-disable-stations/1/1` (the step title) |
| 0:09 | 0:15 | 4 Step 1 | Push in on the **Enable** column header; the cursor moves to the station rows |  | "The switch in the Enable column takes effect on that station alone." | `enable-disable-stations/1/2` |
| 0:15 | 0:24 | 5 Step 1 result | Station **5AP1**, whose switch is grey, is highlighted: its % Adj. field carries no pending icon |  | "Station 5AP1 is off here, which is why it has no pending adjustment however dry it reads." | `enable-disable-stations/1/3` |
| 0:24 | 0:25 | 6 Chapter 2 | Typed chapter card | SHIFT-CLICK A PARENT TO CASCADE | — | `enable-disable-stations/2/1` (the step title) |
| 0:25 | 0:39 | 7 Step 2 | The figure swaps to the hole rows; the **Enable** header is highlighted and the cursor visits two hole rows |  | "Hole and area rows carry the same switch. Turning one off takes everything beneath it out of the push and off the Enabled Stations map, but leaves their own switches as they were." | `enable-disable-stations/2/2`, `enable-disable-stations/2/3` |
| 0:39 | 0:44 | 8 Step 2 result | The right of hole row **3**, where its switch sits, is highlighted |  | "Hold Shift as you click to switch everything beneath it off too." | `enable-disable-stations/2/3` |
| 0:44 | 0:46 | 9 Chapter 3 | Typed chapter card | CONFIRM THE CASCADE | — | `enable-disable-stations/3/1` (the step title) |
| 0:46 | 0:57 | 10 Step 3 | The figure swaps to the confirmation dialog; the question **Disable this hole and all child stations?** is highlighted |  | "Because a cascade can affect dozens of heads, Spatial Adjust asks first and names the scope: this hole and every station beneath it." | `enable-disable-stations/3/2` |
| 0:57 | 1:03 | 11 Step 3 result | **CONTINUE** is highlighted, then the cursor moves to **Cancel**; neither is pressed |  | "Continue applies it; Cancel leaves everything as it was." | `enable-disable-stations/3/3` |
| 1:03 | 1:04 | 12 Chapter 4 | Typed chapter card | SILENCE THE PROMPT ONCE YOU TRUST IT | — | `enable-disable-stations/4/1` (the step title) |
| 1:04 | 1:17 | 13 Step 4 | The figure swaps to the area-level dialog; its checkbox, **Don’t ask to confirm cascading enable/disable changes again**, is highlighted |  | "The checkbox suppresses the confirmation for future cascades. It is stored in your own preferences, so it hides the prompt for you and not for your colleagues." | `enable-disable-stations/4/2`, `enable-disable-stations/4/3` |
| 1:17 | 1:30 | 14 Step 4 result | The question **Enable this area and all child holes and stations?** is highlighted; the cursor rests on **CONTINUE**, which is not pressed |  | "Careful: with the prompt suppressed, a Shift-click on an area switch changes every hole and station under it at once, with only a footer message to show for it." | `enable-disable-stations/4/5` |
| 1:30 | 1:31 | 15 Chapter 5 | Typed chapter card | CHECK THE RESULT ON THE MAP | — | `enable-disable-stations/5/1` (the step title) |
| 1:31 | 1:38 | 16 Step 5 | The figure swaps to the map with the **LAYERS** menu open; **LAYERS** is highlighted and the cursor moves to **Enabled Stations** |  | "Switch Layers to Enabled Stations to see only the heads still in adjustment." | `enable-disable-stations/5/2` |
| 1:38 | 1:44 | 17 Step 5 result | **Enabled Stations**, the selected option, is highlighted |  | "Anything that disappeared is out, deliberately or otherwise." | `enable-disable-stations/5/3` |
| 1:44 | 1:53 | 18 Close | Up next **Next on Double Click: Station details**; end card: the lockup, "Explore the Spatial Adjust Guides", the URL pill; the guide address `https://toroadam.github.io/spatial-adjust-guide/#/enable-disable-stations` goes in the published description | — | — | — |

**VO total:** 201 words in 11 lines, about 67 s spoken (measured). **Running time:** about 1:53 (114 s); the series range is 60-180 s.

**Writes declared (all on `/demo`, none performed):** `enable-toggle` (chapter c1, "Enable switch (station row)"), `enable-toggle` (chapter c2, "Enable switch (hole row)"), `enable-toggle` (chapter c3, "CONTINUE"), `enable-toggle` (chapter c4, "CONTINUE"). No Enable switch has an accessible name, so the picture highlights the Enable column and the row beside the switch rather than the switch itself. The cascade Continue button is not matched by the write guard (`scripts/lib/writes.mjs`), so before any Demo Mode capture it must be covered: see the guard check in `video/episodes/README.md`.

**Step text:** The guide has not been rewritten into the step shape yet: on 2026-10-20 no Do, You-should-see or If-not lines render at `#/enable-disable-stations`. Each VO line is cut from its step's body paragraph and figure caption, there is no If-not state to show (`onScreen` is empty), and the episode is re-checked with `npm run test:episodes -- enable-disable-stations` when the rewrite reaches the guide; any changed step title, highlight label or claim is then re-scripted as a new version.

## Claims

Every claim the episode cites is Verified in `docs/claims/claims.json` (episode lint check (e), clean on 2026-10-20). No line rests on a Needs expert or Not shipping claim.

## Voice-over check

Not yet run.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.
