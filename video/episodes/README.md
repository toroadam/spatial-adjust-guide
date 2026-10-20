# Episodes

One folder per episode: `video/episodes/<id>/episode.json`, plus the `script.md` it was locked from. `episode.json` is the one contract that capture, voice-over, build, verify and captions all read. Its schema is `video/lib/episode-schema.mjs` (zod). This page holds the Double Click series' readiness check and tracker, then the field-by-field reference for `episode.json`.

Only the episode definition lives here. Takes, VO, renders and every other media file go under the media root, `~/Documents/SpatialAdjust_MarCom/episodes/<id>/` (see [`../README.md`](../README.md)), never in this folder.

## The Double Click series

Twenty-six Double Click episodes, one per guide, in six waves. Each episode walks the steps of one guide in IntelliDash Demo Mode: one chapter per guide step, labelled with the step title, narrated in the Brian voice with the guide's own Do and You-should-see lines, and closed on the next episode and the guide's address on the site. Every episode follows the same procedure, [`RUNBOOK.md`](RUNBOOK.md), from preflight to commit.

- [`series.json`](series.json) is the machine-readable source for the series: order, waves, status, runtime, loudness, timestamps, credits per wave, the voice constants and the music bed.
- The tracker below is generated from it by `node scripts/episode-lint.mjs <url> --write-tracker`; edit `series.json`, never the table.
- `npm run test:episodes` holds every episode that has left `planned` to the series rules; see RUNBOOK.md, "Formats", for what it checks.

## Readiness

Checked 2026-10-20 on the branch the series is built on. The series depends on three pieces of upstream work that were planned in parallel with it, and this section records what each had delivered when the series started. It only reads their outputs; anything missing goes back to the work that owns it.

### Upstream work

| Upstream work | What the series needs from it | State on 2026-10-20 |
|---|---|---|
| Video pipeline (capture, voice, edit, verify; the Double Click toolchain ported into `video/`) | Every tool an episode is made with | Active, 87% complete. 8 of 9 parts done, the verify gate and the episode builder with the audio mix among them. The 20-30 s Dashboard overview pilot has not been produced yet. |
| Claims ledger (every claim in the 26 guides checked against IntelliDash) | Verified claim IDs for every narrated line and on-screen text | Active, 87% complete. The ledger is in `docs/claims/claims.json`: 871 claims, 843 Verified, 28 Needs expert, 0 Wrong. Publishing the corrected guides and the post-review sign-off are still open. |
| Followability rewrite (every step as Do, You should see and If not, with exact labels) | The Do, You-should-see and If-not lines each chapter narrates, and the bold labels the highlights land on | Active, 12% complete. The writing standard and its checks are done on their own branch; no guide renders the new step shape on this branch yet (0 of 26). |

### Pipeline paths

Each path the series needs from the video pipeline, checked on disk. All are present, so the series is not blocked.

| Path | What it is | Present |
|---|---|---|
| `video/README.md` | Pipeline overview, media root, safety rules, commands | yes |
| `video/capture/director.mjs` | The capture director: one page, one navigation to the `/spatialadjust/demo` entry, no reload | yes |
| `video/capture/gates.mjs` and `scripts/lib/guarded-click.mjs` | The director's gate: the entry URL must end `/spatialadjust/demo` (`checkEntryUrl`), any document load after arming ends the take, and every request other than GET, HEAD or OPTIONS is aborted (`video/capture/SAFETY.md:167-191`); the click guard refuses undeclared write-like clicks | yes |
| `video/capture/course-overlay.js` | The fictional course overlay applied at capture time | yes |
| `video/capture/SAFETY.md` | The Demo Mode audit, with `file:line` citations for every write guard | yes |
| `video/vo/render-brian.py` | The Brian voice renderer | yes |
| `video/edit/` (`lib/engine.py`, `lib/renderer.py`, `render.py`, `build.py`, `mix.py`) | The compositor, the episode builder and the audio mix | yes |
| `video/verify/verify.py` | The release gate (format, loudness, holds, black and frozen frames), with `ocr_check.py` and `captions.py` | yes |
| `video/approvals.md` G1 fictional course, G2 map approach, G3 style frame, G5 music licence | Each gate decided by the executor under the owner's direction of 2026-10-19 (Riverbend National; restyled map tiles; the Spatial Adjust brand; the original music bed `sa-bed-v1`) | yes |
| A passing verify report for the pilot | Proof the whole chain runs end to end | not yet: the pilot has not been produced. Not a path the episodes need on disk; the first episode of wave 1 proves the chain instead. |

### Demo Mode writes

Every write the series films, and what Demo Mode does with it according to the audit in [`../capture/SAFETY.md`](../capture/SAFETY.md). Demo Mode mocks **none** of them: each is short-circuited where it starts, most with the "unsupported in Demo Mode" message (`showUnsupportedMsg`), so nothing is stored and nothing reaches the network. An episode that films one of these clicks films the click in Demo Mode and its result on the guide site's recreation: the chapter's `source` is `mixed` (or `recreation`) and the `demoWriteClicks` entry's `outcome` is `recreation` (RUNBOOK.md, "Demo Mode writes rule"). The first column is the `safetyRef` an episode's `demoWriteClicks` entry names; `scripts/episode-lint.mjs` reads this table.

| safetyRef | Write the series films | Guides | Demo Mode | SAFETY.md |
|---|---|---|---|---|
| `push-open` | Push Changes in the toolbar: opens the confirmation dialog | push-to-lynx, reviewing-changes, verify-results, push-failures | no write | `video/capture/SAFETY.md:85` |
| `push-send` | Push Changes confirmed in the dialog: the push to Lynx | push-to-lynx, verify-results, push-failures | short-circuited | `video/capture/SAFETY.md:87` |
| `settings-save` | Settings dialog Save: calculation settings, calculation method, minimum threshold, units | calculation-settings, calculation-methods, minimum-threshold, preferences | short-circuited | `video/capture/SAFETY.md:98` |
| `preferences-save` | User preferences dialog Save | preferences | short-circuited | `video/capture/SAFETY.md:99` |
| `filter-save` | Over/Under threshold (% Adj. filter) Save | filter-adjustments, threshold-questions | short-circuited | `video/capture/SAFETY.md:100` |
| `bulk-apply` | Bulk Adjust Save | bulk-adjustments | short-circuited | `video/capture/SAFETY.md:101` |
| `target-edit` | Target VWC edit in the table | editing-station-targets, understanding-vwc | short-circuited (silently, no message) | `video/capture/SAFETY.md:102` |
| `adjust-edit` | % Adj. edit in the table (user percent adjust) | suggested-adjustments | short-circuited | `video/capture/SAFETY.md:68` |
| `enable-toggle` | Enable toggle and its cascade to the hole and area rows | enable-disable-stations | short-circuited (silently, no message) | `video/capture/SAFETY.md:103` |
| `recalculate` | Recalculate adjustments | calculation-settings, calculation-questions | short-circuited | `video/capture/SAFETY.md:65` |
| `scan-request` | Request latest scan data | request-scan-data | short-circuited | `video/capture/SAFETY.md:75` |
| `profile-apply-save` | Target Profiles Update from Current or Apply Profile, then Save | target-profiles, creating-profiles, updating-profiles, seasonal-profiles | short-circuited (by the Settings dialog Save guard) | `video/capture/SAFETY.md:98` |

The `Demo Mode` column takes one of three values: `mocked` (Demo Mode performs the write against mock data, so its result may be filmed in Demo Mode), `short-circuited` (the result must come from the recreation) or `no write` (the click only opens something, so its result is filmed in Demo Mode).

### Claims ledger

Claims per guide in `docs/claims/claims.json`, by status (counts only). No guide has a Wrong or Not shipping claim. A Needs-expert claim is never narrated: the episode's lines cite Verified claims only.

| Wave | Guide | Verified | Wrong | Not shipping | Needs expert |
|---|---|---|---|---|---|
| 1 | `dashboard-overview` | 48 | 0 | 0 | 0 |
| 1 | `understand-spatial-adjust` | 31 | 0 | 0 | 1 |
| 1 | `map-navigation` | 32 | 0 | 0 | 0 |
| 1 | `understanding-vwc` | 29 | 0 | 0 | 1 |
| 2 | `suggested-adjustments` | 34 | 0 | 0 | 2 |
| 2 | `filter-adjustments` | 41 | 0 | 0 | 0 |
| 2 | `push-to-lynx` | 43 | 0 | 0 | 5 |
| 2 | `reviewing-changes` | 31 | 0 | 0 | 2 |
| 2 | `verify-results` | 34 | 0 | 0 | 2 |
| 3 | `editing-station-targets` | 29 | 0 | 0 | 0 |
| 3 | `bulk-adjustments` | 31 | 0 | 0 | 0 |
| 3 | `enable-disable-stations` | 28 | 0 | 0 | 1 |
| 3 | `station-details` | 25 | 0 | 0 | 1 |
| 4 | `minimum-threshold` | 39 | 0 | 0 | 3 |
| 4 | `calculation-settings` | 37 | 0 | 0 | 0 |
| 4 | `calculation-methods` | 33 | 0 | 0 | 0 |
| 4 | `preferences` | 30 | 0 | 0 | 0 |
| 5 | `station-zero` | 35 | 0 | 0 | 2 |
| 5 | `request-scan-data` | 37 | 0 | 0 | 0 |
| 5 | `threshold-questions` | 29 | 0 | 0 | 0 |
| 5 | `calculation-questions` | 32 | 0 | 0 | 0 |
| 5 | `push-failures` | 29 | 0 | 0 | 3 |
| 6 | `target-profiles` | 28 | 0 | 0 | 1 |
| 6 | `creating-profiles` | 25 | 0 | 0 | 0 |
| 6 | `updating-profiles` | 28 | 0 | 0 | 0 |
| 6 | `seasonal-profiles` | 25 | 0 | 0 | 4 |
| | **Total** | **843** | **0** | **0** | **28** |

### Step rewrite coverage

Whether each guide renders the new step shape (a Do, a You-should-see and an If-not line on every step), read from the built site at `#/<key>`. No guide does yet on this branch. An episode's preflight (RUNBOOK.md, EP-0) re-checks its own guide, so a wave starts as soon as its guides are rewritten; until then an episode narrates the guide's current text and is flagged for a re-check when the rewrite lands.

| Wave | Guides | Rewritten |
|---|---|---|
| 1 Getting Started | 4 | 0 of 4 |
| 2 Review & Apply | 5 | 0 of 5 |
| 3 Station Management | 4 | 0 of 4 |
| 4 Calculations | 4 | 0 of 4 |
| 5 Troubleshooting | 5 | 0 of 5 |
| 6 Target Profiles | 4 | 0 of 4 |

### Voice-over credits

- **Method.** 26 scripts of 150 to 300 words, about 900 to 1,800 characters each at the Brian voice's measured 16.16 characters per spoken second (iCentral Double Click #1: 1,469 characters in 90.9 s; the pilot has no render report yet), so 55 to 110 s of narration per episode. Plus 30% for re-renders. Billed at 1 credit per character, the upper bound `video/vo/series-estimate.md` keeps; the one real render so far billed 0.44 credits per character (`video/vo/credits-log.md`).
- **Estimate.** 30,420 to 60,840 credits for the series at 1 credit per character (23,400 to 46,800 characters plus 30%); about 13,400 to 26,800 at the observed 0.44.
- **Balance.** 357,546 credits remaining on 2026-10-20, read with `npm run video -- estimate --live` (counts only; the key is resolved in process and never printed).
- **Verdict.** The balance covers the whole series about six times over at the upper bound. Not a constraint.

## Series tracker

<!-- tracker:start -->
<!-- Generated from series.json by node scripts/episode-lint.mjs <url> --write-tracker. Edit series.json, not this block. -->

26 episodes: 4 approved, 18 planned, 4 blocked.

| # | Wave | Key | Title | Status | Runtime | Started | Approved | Expert |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | `dashboard-overview` | Dashboard overview | approved | 2:34 | 2026-10-20 | 2026-10-20 | executor 2026-10-20; experts in person 2026-10-22 |
| 2 | 1 | `understand-spatial-adjust` | Understand Spatial Adjust | approved | 1:56 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 3 | 1 | `map-navigation` | Map navigation | approved | 2:06 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 4 | 1 | `understanding-vwc` | Understanding VWC | approved | 2:12 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 5 | 2 | `suggested-adjustments` | Understand suggested adjustments | planned | — | — | — | — |
| 6 | 2 | `filter-adjustments` | Filter by % Adj. | planned | — | — | — | — |
| 7 | 2 | `push-to-lynx` | Push changes to Lynx | planned | — | — | — | — |
| 8 | 2 | `reviewing-changes` | Reviewing changes | planned | — | — | — | — |
| 9 | 2 | `verify-results` | Verify results | planned | — | — | — | — |
| 10 | 3 | `editing-station-targets` | Editing station targets | planned | — | — | — | — |
| 11 | 3 | `bulk-adjustments` | Apply a bulk adjustment | planned | — | — | — | — |
| 12 | 3 | `enable-disable-stations` | Enable and disable stations | planned | — | — | — | — |
| 13 | 3 | `station-details` | Station details | planned | — | — | — | — |
| 14 | 4 | `minimum-threshold` | Set a minimum threshold | planned | — | — | — | — |
| 15 | 4 | `calculation-settings` | Calculation settings | planned | — | — | — | — |
| 16 | 4 | `calculation-methods` | Calculation methods | planned | — | — | — | — |
| 17 | 4 | `preferences` | Preferences | planned | — | — | — | — |
| 18 | 5 | `station-zero` | Why is this station 0%? | planned | — | — | — | — |
| 19 | 5 | `request-scan-data` | Get fresh scan data | planned | — | — | — | — |
| 20 | 5 | `threshold-questions` | Threshold questions | planned | — | — | — | — |
| 21 | 5 | `calculation-questions` | Calculation questions | planned | — | — | — | — |
| 22 | 5 | `push-failures` | Push failures | planned | — | — | — | — |
| 23 | 6 | `target-profiles` | Apply a target profile | blocked | — | — | — | — |
| 24 | 6 | `creating-profiles` | Capturing profiles | blocked | — | — | — | — |
| 25 | 6 | `updating-profiles` | Updating profiles | blocked | — | — | — | — |
| 26 | 6 | `seasonal-profiles` | Managing seasonal profiles | blocked | — | — | — | — |

Blocked:

- #23 `target-profiles`, #24 `creating-profiles`, #25 `updating-profiles`, #26 `seasonal-profiles` (checked 2026-10-20): Waits for the corrected Target Profiles guides to be published on the live site, which is in progress on 2026-10-20 as the last step of the claims audit. Target Profiles ships in production, so no approval gate applies: produce these four episodes as soon as their guides are live, and re-check the claims for each guide at preflight.

**Credits per wave** (ElevenLabs credits; estimate from series.json, method under Voice-over credits above; before and after from the account, counts only)

| Wave | Name | Episodes | Estimate | Before | After | Used | Expert review |
|---|---|---|---|---|---|---|---|
| 1 | Getting Started | 4 | 4,680 to 9,360 | 357,437 | 355,147 | 2,290 | decided by executor 2026-10-20 (episode 01); experts in person 2026-10-22 |
| 2 | Review & Apply | 5 | 5,850 to 11,700 | — | — | — | — |
| 3 | Station Management | 4 | 4,680 to 9,360 | — | — | — | — |
| 4 | Calculations | 4 | 4,680 to 9,360 | — | — | — | — |
| 5 | Troubleshooting | 5 | 5,850 to 11,700 | — | — | — | — |
| 6 | Target Profiles | 4 | 4,680 to 9,360 | — | — | — | — |
<!-- tracker:end -->

## Episode format

Validate an episode before anything reads it:

```bash
node video/lib/episode-schema.mjs video/episodes/<id>/episode.json
```

It prints `ok` and exits 0, or lists every problem, naming the beat or action at fault, and exits 1. In code, `parseEpisode(path)` returns the parsed episode or throws an `EpisodeError` with the same list.

## Top-level fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string, `^[a-z0-9-]+$` | yes | Episode id. Names the folder here and the folder under the media root. |
| `title` | non-empty string | yes | The title card text. |
| `guide` | guide slug, `^[a-z0-9-]+$` | yes | The guide the episode belongs to, as keyed in `GUIDES` in `Learn Spatial Adjust.dc.html` (for example `dashboard-overview`). |
| `status` | `draft` \| `script-locked` \| `captured` \| `edited` \| `verified` \| `approved` | yes | Where the episode is in the pipeline, in that order. `script-locked` and every later status require claims (see the rules below). |
| `durationTarget` | `[min, max]`, seconds, both positive | yes | Target running time. The minimum may not exceed the maximum. |
| `source` | `demo` \| `recreation` | yes | `demo`: captured from IntelliDash `/demo`. `recreation`: rebuilt from the guide mockups, with no live product involved. |
| `mapPolicy` | `blur` \| `restyle` \| `owned-imagery` \| `frame-out` | yes | How the course map imagery is kept fictional: blurred, restyled, replaced with imagery we own, or kept out of frame. Never a real customer course. |
| `recreationPath` | path, for example `/#/dashboard-overview` | no | For `source: recreation` only: the page of the local guide site the take loads (default `/`). |
| `recreationFigure` | string | no | For `source: recreation` only: the start of one figure caption on that page. The capture director lifts that SpatialAdjustApp figure out of the page to fill the frame unscaled, so no guide prose is in shot, and marks it `data-sa-frame`; scope every target to it (`[data-sa-frame] >> text="0-5%"`), because the page draws the app several times. The director refuses it on a `demo` episode (exit 65). |
| `allowClicks` | string[] | no, default `[]` | Accessible names of the read-only controls a click action may press. Empty unless a specific read-only click has been decided and recorded in [`../approvals.md`](../approvals.md). An entry that matches the write guard is an error. |
| `demoWriteClicks` | `[{ name, target, reason }]` | no, default `[]` | Write-like clicks the episode deliberately shows, each with the reason. Allowed only when `source` is `demo`, where Demo Mode blocks the write. The pilot declares none. |
| `claims` | string[] of claim ids | no, default `[]` | Every claim from the claims ledger (`docs/claims/claims.json`) that the narration relies on. Ids look like `<guide>/<step>/<n>`, for example `dashboard-overview/2/2`. `parseEpisode` checks each id exists in the ledger. |
| `chapters` | `[Chapter]` | no, default `[]` | Chapter markers, in order. |
| `vo` | `[VoLine]` | no, default `[]` | Voice-over lines, in order. |
| `beats` | `[Beat]` | no, default `[]` | What happens on screen, in order. |

Unknown fields are kept, at every level. A later episode can add a field without breaking the ones before it; the schema only rejects what it knows to be wrong.

## Chapter

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | non-empty string | yes | Referenced by `beat.chapter`. Unique within the episode. |
| `label` | non-empty string | yes | The chapter name shown on screen and in the captions file. |

## VoLine

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | non-empty string | yes | Referenced by `beat.vo`, and by convention by the `cue` action that starts the line. Unique within the episode. |
| `text` | non-empty string | yes | Exactly what the Brian voice says. |
| `previous_text` | string | no | Text sent to ElevenLabs as context before the line, so the delivery joins up with what came before. Not spoken. |
| `next_text` | string | no | Text sent as context after the line. Not spoken. |
| `claims` | string[] of claim ids | no; yes once the script is locked | The claims that back this line. Each must also be listed in the episode's `claims`. |

## Beat

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | non-empty string | yes | Names the beat in every error message. Unique within the episode. |
| `chapter` | chapter id | no | The chapter the beat belongs to. Must exist in `chapters`. |
| `label` | non-empty string | no | On-screen label for the beat. Its word count sets the minimum hold. |
| `vo` | VO line id | no | The VO line spoken over the beat. Must exist in `vo`. |
| `hold` | seconds, 0 or more | yes | How long the beat stays on screen. |
| `highlight` | target | no | A target the highlight box is drawn around for the whole beat (the same box a `focus` action draws). |
| `actions` | `[Action]` | no, default `[]` | What the capture director does during the beat, in order. |
| `cutAfter` | seconds | no | Read by the builder, not the schema: the beat's chapter ends this many seconds after the beat's VO line has finished (or after its first cue when it has no VO line), instead of at the next chapter's cut. Use it to leave a page before the take moves on (dc_build.py's per-chapter end override). |

## Action

Every action has a `type`; the other fields depend on it. A `target` is a Playwright selector (for example `role=region[name="Map"]`) that the capture director resolves; `name` is the control's accessible name, which the write guard checks.

| `type` | Fields | What it does |
|---|---|---|
| `wait` | `ms` (integer, 0 or more) | Waits. |
| `cue` | `id` | Marks this moment in the take's cue log; the builder lines up timeline events, such as the start of a VO line, against cue ids. Cue ids are unique within the episode. |
| `hover` | `target`, `name` | Moves the pointer over the target. |
| `scroll` | `target`, `dy` (pixels, negative scrolls up) | Scrolls the target. |
| `focus` | `target`, `name` | Draws the highlight box around the target. Never clicks. |
| `click` | `target`, `name` | Clicks the target. Allowed only for a name listed in `allowClicks`, or for a write-like click declared in `demoWriteClicks` on a `demo` episode. |

## How the builder reads an episode

`npm run video -- build --episode <episode.json> --take <N> --draft` (`video/edit/build.py`) turns the episode, take `N` and the VO render report into the timeline. It relies on these conventions:

- **Every VO line starts at its own cue.** A line spoken over footage needs a `cue` action whose `id` is the line's id, in the beat that speaks it; the builder places the line at that cue's time in the take, so picture and voice stay in sync whatever the take's timing. A line whose beat comes before the first chapter's beats is spoken over the title card; one whose beat comes after the last chapter's beats, over the end card.
- **Every chapter cuts on its first cue.** A chapter's footage runs from 0.55 s before the first cue in its beats to the next chapter's cut (the last chapter: to the take's end flash), so each chapter needs at least one beat with a cue, and chapters must be in take order. `cutAfter` on a beat ends a chapter earlier.
- **Chapters are shown in order,** each as a typed chapter card with its `label`, then its footage, with the chapter strip naming every chapter. Beat labels are not drawn by the builder; they set holds for the capture.
- **The title card shows `title`**, and the title card, chapter cards and end card enforce the hold rule: a card too short for its words fails the build, naming the text.

## Rules the schema enforces

On top of the field types above, an episode is rejected when:

- **A reference dangles.** Every `beat.vo` names a VO line and every `beat.chapter` names a chapter. Beat, VO line, chapter and cue ids are each unique.
- **A click is not allowed.** A click whose name is not in `allowClicks` is rejected.
- **A click looks like a write.** A click whose `name` or `target` matches the write guard `WRITES` (`scripts/lib/writes.mjs`, shared with the fidelity harvest: save, apply, push, confirm, delete, remove, send, submit, discard, reset, update from) is rejected unless the same `name` and `target` are declared in `demoWriteClicks` and `source` is `demo`. `allowClicks` may not list a write-like name at all. On a live course, Push Changes sends adjustments to Lynx; capture happens only in IntelliDash `/demo`, where Demo Mode blocks writes, and this rule stops a write-like click long before a browser is involved.
- **A label is not on screen long enough to read.** A beat with a `label` must hold for at least 1.5 s plus 0.3 s per word of the label (the motion-system hold rule): a three-word label needs 2.4 s.
- **Narration is not backed by claims.** From `script-locked` on, `claims` must be non-empty and every VO line must cite at least one claim. A VO line may cite only claims the episode lists, and `parseEpisode` rejects a claim id that is not in the claims ledger.
- **The duration target is inverted.** The `durationTarget` minimum is above the maximum.

## Example

A complete episode that `parseEpisode` accepts (the schema tests parse this block):

```json
{
  "id": "example-read-the-map",
  "title": "Dashboard overview",
  "guide": "dashboard-overview",
  "status": "script-locked",
  "durationTarget": [20, 30],
  "source": "demo",
  "mapPolicy": "blur",
  "allowClicks": [],
  "demoWriteClicks": [],
  "claims": [
    "dashboard-overview/2/1",
    "dashboard-overview/2/2",
    "dashboard-overview/5/3"
  ],
  "chapters": [
    { "id": "map", "label": "Read the map" },
    { "id": "counts", "label": "Check the counts" }
  ],
  "vo": [
    {
      "id": "vo-map",
      "text": "Every station is a pin, coloured by its latest measured moisture.",
      "next_text": "Push Changes counts the stations you have edited.",
      "claims": ["dashboard-overview/2/1", "dashboard-overview/2/2"]
    },
    {
      "id": "vo-counts",
      "text": "Push Changes counts the stations you have edited.",
      "previous_text": "Every station is a pin, coloured by its latest measured moisture.",
      "claims": ["dashboard-overview/5/3"]
    }
  ],
  "beats": [
    {
      "id": "title",
      "label": "Dashboard overview",
      "hold": 3.5,
      "actions": [{ "type": "wait", "ms": 500 }]
    },
    {
      "id": "map",
      "chapter": "map",
      "label": "Read the map",
      "vo": "vo-map",
      "hold": 7,
      "highlight": "role=region[name=\"Map\"]",
      "actions": [
        { "type": "cue", "id": "vo-map" },
        { "type": "hover", "target": "role=img[name=\"Station 3AP1\"]", "name": "Station 3AP1" },
        { "type": "focus", "target": "role=region[name=\"Moisture legend\"]", "name": "Moisture legend" },
        { "type": "wait", "ms": 1500 }
      ]
    },
    {
      "id": "counts",
      "chapter": "counts",
      "label": "Check the counts",
      "vo": "vo-counts",
      "hold": 6,
      "actions": [
        { "type": "cue", "id": "vo-counts" },
        { "type": "scroll", "target": "role=table", "dy": 240 },
        { "type": "focus", "target": "role=button[name=\"Push Changes\"]", "name": "Push Changes" }
      ]
    }
  ]
}
```

The last beat only draws the highlight box around Push Changes. A `click` on it would be rejected: the name matches the write guard and the episode declares no demo-mode clicks.

## Adding an episode

A Double Click series episode follows [`RUNBOOK.md`](RUNBOOK.md), EP-0 to EP-10, which starts from `node scripts/episode-scaffold.mjs <key>`. The steps below are the pipeline's minimum for any episode.

1. Create `video/episodes/<id>/` with `script.md` and `episode.json`, status `draft`.
2. Back every VO sentence with a claim id from `docs/claims/claims.json`; a sentence without a claim does not go in.
3. Validate with `node video/lib/episode-schema.mjs`, set `status` to `script-locked`, and record the script lock in [`../approvals.md`](../approvals.md).
4. Advance `status` as the episode moves through capture, edit, verify and approval.
