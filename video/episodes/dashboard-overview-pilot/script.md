# Pilot script: Dashboard overview, "Read the map"

**Episode:** `dashboard-overview-pilot` · **Guide:** `dashboard-overview` (Learn Spatial Adjust.dc.html, `GUIDES['dashboard-overview']`, step 2 "Read the map") · **Script version:** v1 · **Gate:** G6 in [`../../approvals.md`](../../approvals.md)

The pilot takes one beat of the Dashboard overview guide through every step of the pipeline: script, capture, voice-over, build, render, mix, verify. It is 20 to 30 seconds long: the Spatial Adjust lockup and the title card, one chapter on the station map coloured by moisture band, and the end card.

## Footage source: the guide site's recreation

The pilot is captured from the guide site's own recreation of the Spatial Adjust screen (`"source": "recreation"`), not from IntelliDash `/demo`. A Demo Mode take needs three things only the owner can provide: a Chrome started for capture, a hand sign-in to the demo form with the demo account (the director never types credentials), and the local capture config and name maps (`video/capture/capture.local.json`, `video/capture/overlay.local.json`), none of which exist on this machine yet. Under the owner direction of 2026-10-19 nothing waits for a human, so the pilot runs the whole pipeline on the recreation, and the Demo Mode take is the first thing to do once the owner can sign in (commands in [`README.md`](README.md#demo-mode-take-for-the-owner)).

The recreation is the guide site built from this repository (`dist/`), served on loopback. The episode lifts one figure of the guide page, the step 2 figure captioned "Map with the moisture legend.", out of the page so the app fills the frame unscaled (`"recreationFigure"`), the same framing as the G3 style frame's window shot. No guide prose is in frame. Takes from the recreation are named `take<N>-recreation.mp4`, so they can never pass as Demo Mode footage.

## Structure

Planned times; the build measures the real ones from the take and the VO render.

| # | Part | Length (s) | On screen | VO |
|---|---|---|---|---|
| 1 | Lockup | 2.3 | Spatial Adjust lockup on the hero wall | — |
| 2 | Title card | 5.9 | "Double Click" / "Dashboard overview" | `vo-intro` |
| 3 | Chapter card | about 1.7 | READ THE MAP, typed | — |
| 4 | Window shot: Read the map | about 12.5 | The app, map left: the cursor visits a green, a blue and a red pin; then the highlight box on the moisture legend, and the cursor goes from the red band to a red pin and from the blue band to a blue pin | `vo-pins`, `vo-bands` |
| 5 | End card | 5.0 | Lockup, "Explore the Spatial Adjust Guides", `toroadam.github.io/spatial-adjust-guide` (G4) | — |
| | **Total** | **about 27.4** | | **48 words** |

The brand's card lengths (`video/edit/lib/brand.py`, `DURATIONS`) are longer than the plan's estimate of about 4 s for the lockup and title and 3 s for the end card, so the footage is about 12.5 s rather than 15 to 20 s, and the title card carries the first VO line.

## Voice-over

Every line is backed by a claim in the claims ledger. A line says nothing the cited claims do not say, and nothing the footage does not show.

| VO line id | Text | Claim id | Shown on screen |
|---|---|---|---|
| `vo-intro` | The whole Spatial Adjust feature lives on one screen. Here is how to read its map. | `dashboard-overview/summary/1`, `dashboard-overview/2/1` | Title card "Dashboard overview", then the chapter card READ THE MAP |
| `vo-pins` | Each sprinkler of a station scanned in the past seven days is a pin. | `dashboard-overview/2/2` | The map with its pins; the cursor rests on a green, a blue and a red pin |
| `vo-bands` | A pin scanned today is coloured by the moisture band its reading falls into, as the legend shows. | `dashboard-overview/2/3`, `dashboard-overview/2/6` | The highlight box on the legend (0-5%, 6-19%, 20-30%, > 30%); the cursor goes from the red band to a red pin, then from the blue band to a blue pin |

48 words, 247 characters after the lexicon (no term in these lines is rewritten). The lines are sent with their neighbours as `previous_text` and `next_text`, as set in `episode.json`.

### The claims, as verified

Quoted from the verified claims ledger on `main` at commit e6459ba (`docs/claims/guides/dashboard-overview.json`), where every one of them is `Verified` against IntelliDash production:

| Claim id | Verified text |
|---|---|
| `dashboard-overview/summary/1` | The whole feature lives on one screen. |
| `dashboard-overview/2/1` | Read the map |
| `dashboard-overview/2/2` | Each sprinkler of a station scanned in the past seven days is a pin. |
| `dashboard-overview/2/3` | A pin scanned today is coloured by its measured VWC against the four moisture bands in the legend, and a pin last scanned on an earlier day is drawn clear. |
| `dashboard-overview/2/6` | Map with the moisture legend. |

This branch (`e200-video-pipeline`) was cut from `main` at c37d80e, before the claims audit re-extracted the ledger, so its own `docs/claims/claims.json` still holds the unverified ledger, in which `2/2`, `2/3` and `2/6` name different sentences (`2/2` there is the sentence the audit marked Wrong and corrected). The ids above resolve to the verified text once the branch is merged into `main`. `parseEpisode` passes against both ledgers: the branch's (`node video/lib/episode-schema.mjs`) and `main`'s (the same check with `parseEpisode(file, { ledger })` on `git show main:docs/claims/claims.json`). After the merge, re-run the schema and compare the five texts above with `docs/claims/guides/dashboard-overview.json`; if the audit has renumbered them again, the script needs a new G6 row.

### What the script leaves out, and why

- **"A pin last scanned on an earlier day is drawn clear"** (the rest of `2/3`): every pin in the recreation's map is filled, so the footage cannot show it. Cut rather than recreated.
- **The default band boundaries, 0-5, 6-19, 20-30 and above 30 percent** (`2/7` on `main`): shown on screen by the legend, not spoken. The id has no counterpart in this branch's ledger, and the legend is easier to read than to hear.
- **"VWC"**: the line says "moisture", the word the guide and the legend use for the bands ("the four moisture bands in the legend"); measured VWC is the measured soil moisture. Whether Brian should say "V W C" is already on the review agenda.
- **Dragging the band handles and the variance view** (`2/5`, `2/8`): both need a click or a drag, and the pilot has no clicks (`allowClicks` is empty).

## On-screen actions

Hover, focus and wait only: `allowClicks` and `demoWriteClicks` are empty and the episode has no click action. Every target is scoped to the lifted figure (`[data-sa-frame]`) and carries the accessible name the director checks.

| Beat | Hold (s) | Actions |
|---|---|---|
| `title` | 1.0 | wait 600 ms for the page to settle (spoken over the title card: `vo-intro`) |
| `pins`, label "Read the map" | 4.6 | cue `vo-pins`; hover pin 26 (green), wait 700 ms; hover pin 31 (blue), wait 700 ms; hover pin 4 (red), wait 500 ms |
| `bands` | 6.4 | cue `vo-bands`; focus the legend chips "0-5% 6-19% 20-30% > 30%"; hover "0-5%", wait 600 ms; hover pin 4 (red), wait 700 ms; hover "> 30%", wait 600 ms; hover pin 62 (blue), wait 800 ms |

The label "Read the map" is three words, so its beat must hold at least 2.4 s (1.5 s + 0.3 s per word); it holds 4.6 s. The director's dry run (`npm run video -- capture --episode dashboard-overview-pilot --dry-run`) lists 3 beats, 8 targets and about 14.2 s of take, and "click guard: no clicks".

## Estimate

`python3 video/vo/estimate.py --episode video/episodes/dashboard-overview-pilot/episode.json`, 2026-10-20:

```
Episode dashboard-overview-pilot (video/episodes/dashboard-overview-pilot/episode.json): 3 VO lines, 48 words
Characters are counted after the lexicon is applied; 1 credit per character; retake factor 2.

line        chars   credits  x retakes
vo-intro       82        82        164
vo-pins        68        68        136
vo-bands       97        97        194
total         247       247        494

About 15.3 s of narration at 16.16 characters per second.
```

## Script lock (G6)

Locked as v1 by the executor under the owner direction of 2026-10-19, once `episode.json` passed `parseEpisode` against both ledgers and every VO line cited a verified claim. The decision is recorded in row G6 of [`../../approvals.md`](../../approvals.md), and the questions for the experts are on [`docs/review-agenda.md`](../../../docs/review-agenda.md). A change to any VO line's text is a new script version and needs a new G6 row before a final render.
