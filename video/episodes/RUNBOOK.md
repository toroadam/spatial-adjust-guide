# Double Click runbook

How one episode of the Spatial Adjust Double Click series is made, from preflight to the tracker update. One episode per guide, 26 in six waves; the list, the order and each episode's state are in [`series.json`](series.json), and the tracker in [`README.md`](README.md#series-tracker) is generated from it.

The pipeline the procedure drives is described in [`../README.md`](../README.md) (commands, media root, capture, verify) and the episode file in [`README.md`](README.md#episode-format). This file adds what is the same for every episode of the series: the template, the formats the episode lint holds each episode to, and the procedure EP-0 to EP-10.

## Template

**Version:** v0 - draft, 2026-10-20. It locks as v1 when the first episode of wave 1 is approved (EP-9); after that every change is a new version in the changelog below, and episodes already approved are re-checked against it.

| Part | What the viewer sees | Comes from | Drawn by |
|---|---|---|---|
| Open | The Spatial Adjust lockup, then the title card: the series word "Double Click" is double-clicked and the guide's title springs out of it, so the card reads **Double Click: \<guide title\>**, in the Spatial Adjust brand (contour wall, Golos UI, no red boxes) | `titleCard.text`; the guide title as the site renders it | `video/edit/lib/cards.py` `lockup`, `title_card` |
| Chapters | One chapter per step of the guide, in order. Each opens on a typed chapter card whose label is the step title exactly, in caps | `chapters[].label` = the rendered step title | `cards.chapter_card` (style `chapter_card`: Golos UI 500, 132 px, 0.06em, caps) |
| Highlight | A design-system blue (#3079F0) focus box on the control the step names, never a red box | `chapters[].highlight.label` (a bold label of the step) and `.selector` | the director's in-page runtime during capture (`video/capture/director-runtime.js`, `focus_box`) |
| Camera | The window tilted and floating on the contour wall, with push-ins that follow the cursor | the take's cursor and focus track | `build.py` window shots (`dc_camplan`) |
| Voice | For each step, the Do line, then the You-should-see line, in Brian's voice. The picture leads: the click lands, then the line | `vo[]`: `V<n>a` (Do), `V<n>b` (You should see) | `video/vo/render-brian.py`, placed on the take's cues by `build.py` |
| If not | The step's If-not state is shown on screen, as the screen looks in that state, with the If-not line as a held label. It is not narrated | `chapters[].onScreen[]` with `stateShown: true` | the footage (Demo Mode, or the recreation when Demo Mode cannot produce the state) |
| Progress | The chapter strip: every chapter name in a frosted bar under the window, the active chapter filling blue | `chapters[].label` | `cards.chapter_strip` |
| Close | **Next on Double Click: \<next guide title\>**, then the end card: the lockup, "Explore the Spatial Adjust Guides", the URL pill and the legal line, with the episode's own guide address, https://toroadam.github.io/spatial-adjust-guide/#/\<key\> | `endCard.next`, `endCard.text`, `endCard.address`; `video/brand/end-card.json` (gate G4) | `cards.end_card` |
| Length | 1 to 3 minutes | `series.json` `targets.runtimeSec` [60, 180], or the entry's `runtimeRange` | checked by `verify.py` and the lint |
| Sound | One music bed for the whole series, `sa-bed-v1`, 3 dB under the voice and ducked a further 9 dB while Brian speaks; -14 LUFS integrated, true peak at or below -1.0 dBTP | `episode.music` = `series.json` `musicBed`; `video/brand/music.json` (gate G5) | `video/edit/mix.py` |

The close points to the next episode in `series.json` that is not blocked. When no later episode is open, the episode ends on the series-end line instead:

**Series-end line:** "That's the latest Double Click. Find every guide on the Spatial Adjust Guides site."

**Template chrome (needs no claim):** "Double Click", "Next on Double Click"

Everything else on screen, and every spoken word, cites Verified claims. The episode lint reads both bold lines above from this file, so keep their wording and quote marks as they are.

**Where the builder is behind the template (v0).** `build.py` draws the lockup, the title card, the chapter cards, the window shots, the chapter strip and the end card. It does not yet draw the "Next on Double Click" card (the closing up-next card exists in `video/edit/lib/brand.py`, `TITLE_CARD['up_next']`, and `cards.title_card` draws it when given a tag), the If-not labels from `onScreen`, or the guide address on the end card, whose pill shows the site address from `end-card.json`. Until it does, `episode.json` carries `endCard` and `onScreen` so nothing is lost, and the published description carries the guide address.

### Changelog

| Version | Date | Change | Decided by |
|---|---|---|---|
| v0 - draft | 2026-10-20 | First template, from the iCentral Double Click #1 (Home) and the Spatial Adjust motion system (`video/brand/motion-system.md`). The plan's "SemiBold caps" chapter labels are Golos UI 500 caps, because Golos UI ships no 600 (motion-system.md, Type). The series-end line above. The If-not state is shown, not narrated, to keep episodes inside 3 minutes. | Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22 |

## Formats

### episode.json

`video/episodes/<id>/episode.json` is the pipeline's episode file ([`README.md`](README.md#episode-format) documents the schema `video/lib/episode-schema.mjs` enforces). A Double Click episode adds the fields below; the schema allows them, and the episode lint checks them.

| Field | Shape | Rule |
|---|---|---|
| `id`, `guide` | string | `guide` is the series key; `id` is the series id (the key unless `series.json` says otherwise) and the folder name |
| `title` | string | the guide title as the site renders it at `#/<key>` |
| `status` | `draft`, `script-locked`, `captured`, `edited`, `verified`, `approved` | the episode's own state, moved on by the procedure |
| `durationTarget` | [min, max] seconds | the series range, [60, 180], unless the series entry has a `runtimeRange` |
| `source` | `demo` or `recreation` | where the take is captured; `recreationPath` optional for a recreation |
| `mapPolicy` | `restyle` (default), `blur`, `frame-out` | gate G2 |
| `allowClicks` | read-only clicks | empty unless a read-only click is decided and recorded |
| `demoWriteClicks[]` | `{name, target, reason, route, safetyRef, outcome, chapter}` | `route` is `"/demo"`; `safetyRef` is a key of the Demo Mode writes table in [`README.md`](README.md#demo-mode-writes); `outcome` is `demo` or `recreation` (`recreation` for a short-circuited write); `chapter` is the chapter that films it |
| `claims` | claim IDs | every claim the episode cites |
| `titleCard` | `{text, claims}` | `text` is `"Double Click: <title>"`; `claims` are the guide's catalogue-tile claims |
| `chapters[]` | `{id, step, label, highlight: {label, selector}, source, sourceReason, onScreen: [{text, stateShown, claims}]}` | one per rendered step, in order; `label` is the step title exactly; `highlight.label` is a bold label of the step and `selector` finds it on screen; `source` is `demo`, `recreation` or `mixed`, and the last two need a `sourceReason` |
| `vo[]` | `{id, chapter, text, previous_text, next_text, claims}` | `V<n>a` the Do line, `V<n>b` the You-should-see line; every line cites Verified claims |
| `beats[]` | as in the pipeline | one per VO line at least, each starting on a cue named after its line |
| `endCard` | `{next, text, address}` | `next` is the next series episode that is not blocked and `text` is `"Next on Double Click: <its title>"`, or `next` null and `text` the series-end line; `address` is `"#/<key>"` |
| `music` | string | `series.json` `musicBed` |
| `treatment` | `standard` or `coming-soon` | `coming-soon` may cite Not shipping claims, only with an `approvalsRef` that appears in `video/approvals.md` |
| `approvalsRef` | string or null | the approvals row that allows a non-standard treatment |

`node scripts/episode-scaffold.mjs <key>` writes a draft in exactly this shape.

### series.json

One entry per episode, in wave order: `n`, `key`, `id`, `wave`, `title`, `status` (`planned`, `scripted`, `captured`, `voiced`, `edited`, `approved`, `blocked`), `blockedReason` and `checkedAt` (both required while blocked), `firstOfWave`, `runtimeSec`, `lufs`, `truePeak`, `startedAt`, `approvedAt`, `expertReview`, `media` (`episodes/<key>` under the media root), `treatment`, `approvalsRef`, and optionally `runtimeRange` to override the series range for one episode. Each wave has `n`, `name`, `creditsEstimate` [low, high], `creditsBefore`, `creditsAfter` and `expertSignoff`.

The series status moves with the episode file: `scripted` when the script is locked, `captured`, `voiced` once the VO is rendered, `edited` once the render passes verify, `approved` at EP-9. Edit `series.json`, never the tracker: `npm run test:episodes -- --write-tracker` regenerates it.

### script.md

`video/episodes/<id>/script.md` opens with the episode, wave, guide, voice and source, then one table row per beat:

| TC in | TC out | Beat | Picture | Chapter label | VO | Claim IDs |
|---|---|---|---|---|---|---|
| 0:00 | 0:05 | 1 Open | Title card **Double Click: \<title\>** | — | — | the tile claims |
| 0:05 | 0:20 | 2 Step 1 | Chapter card; push in on **\<control\>** with the blue highlight | STEP TITLE IN CAPS | "the Do line" | `<key>/1/<n>`, ... |
| 0:20 | 0:27 | 3 Step 1 result | Hold on the result; the If-not state on screen | | "the You-should-see line" | `<key>/1/<n>`, ... |
| ... | | | | | | |
| 2:40 | 2:45 | n Close | **Next on Double Click: \<next title\>**, end card | — | — | — |

Then the VO word count and estimated runtime, a "Step text" note when the guide has not been rewritten yet, a "Claims" section listing any claim that is not Verified, and the "Never on camera" list from this file.

### The episode lint

`npm run test:episodes -- <key>` (built site served on `localhost:8124`) checks every started episode, or the ones named:

- **schema:** the episode passes `video/lib/episode-schema.mjs`;
- **(a)** `guide` and `id` match `series.json` and the folder;
- **(b)** one chapter per rendered step, labelled with the step title exactly;
- **(c)** `title` is the rendered guide title and `titleCard.text` is "Double Click: \<title\>";
- **(d)** `endCard` names the next open episode (or carries the series-end line) and the guide address;
- **(e)** every VO line and every on-screen text cites claims that are Verified in `docs/claims/claims.json`; template chrome needs none;
- **(f)** every highlight label is a bold label of its step, and has a selector;
- **(g)** chapter sources are valid with reasons, and every Demo Mode write click is on `/demo`, in the writes table, with an outcome a short-circuited write allows;
- **(h)** edited and approved episodes: runtime in range, -14 LUFS +/- 0.5, true peak at or below -1.0 dBTP, the series music bed.

`--series` checks loudness spread and runtimes across approved episodes and that every VO render used the series voice; `--fixtures` runs the lint's own self-test. Exit 0 clean, 1 findings, 2 could not run.

## /demo, Demo Mode writes and recreation

**/demo.** Every episode is captured from a Demo Mode session of IntelliDash: the app booted from the `/spatialadjust/demo` entry on the dev host, in the capture Chrome, signed in by hand to the demo form, and held from then on by the director's gate. Demo Mode is fixed when the app boots, and a reload or any new document boots the app live, so the gate checks the entry address, blocks reloads and new documents, and aborts every request that is not a GET outside the declared clicks. A take that reloads is discarded, never cut around. The dev host lives only in the gitignored `video/capture/capture.local.json`; it never goes in the repository. The full rules are [`../capture/SAFETY.md`](../capture/SAFETY.md).

**Demo Mode writes.** A push, save or apply is filmed only when the episode declares it in `demoWriteClicks` and the director's gate lets it through. Demo Mode short-circuits most writes with an unsupported-feature message; it does not mock them. For a short-circuited write ([the table](README.md#demo-mode-writes) says which), film the click in Demo Mode, show its result from the recreation, set the chapter's `source` to `mixed` with a `sourceReason`, and set the click's `outcome` to `recreation`. Never show the unsupported-feature message.

**Recreation.** A shot Demo Mode cannot produce comes from the guide site's own recreation (`source: "recreation"`, captured by `video/capture/recreation.mjs` from the built site): the result of a short-circuited write, push failures, a station at 0 %, stale or missing scans, modelled VWC, and stations with several heads. Its chapter carries `source` `recreation` (or `mixed`) and a `sourceReason` that says which of these it is.

## Procedure

Each step names what it records. Commands run from the repository root; `<key>` is the series key and `<id>` its series id.

**EP-0 Preflight.**

1. Update the repository, `npm ci`, then `npm run build` and `npm run serve` (the lint and the scaffold read the site as it renders on `localhost:8124`).
2. Check the entry in `series.json`. A `blocked` entry is re-checked against its reason; if the reason no longer holds, set `status` to `planned` and `checkedAt` to today, otherwise set `checkedAt` to today and stop.
3. Rewrite state: `node scripts/episode-scaffold.mjs <key> --dry-run` says in its "Step text" note whether the guide renders Do, You-should-see and If-not lines. If it does not yet, proceed on the guide's current text; the draft uses each step's body and caption, and the episode is flagged for a re-check when the rewrite reaches the guide (`npm run test:episodes -- <key>` then reports any label or highlight drift, and the VO is checked against the new lines). Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22.
4. Claims: the guide's claims in `docs/claims/claims.json` (counts in [`README.md`](README.md#claims-ledger)). A line backed only by Needs expert claims does not go in.
5. Credits, first episode of a wave only: `python3 video/vo/estimate.py --live` (counts only) and record the number as the wave's `creditsBefore` in `series.json`.

**EP-1 Start and scaffold.** Set `startedAt` (today, `YYYY-MM-DD`) on the entry in `series.json`, then `node scripts/episode-scaffold.mjs <key>`. It writes `video/episodes/<id>/episode.json` and `script.md` (it refuses to overwrite either without `--force`).

**EP-2 Script.** In `script.md` and `episode.json`, together:

- cut each VO line to what the picture shows, at about 2.3 words a second, inside 1 to 3 minutes;
- keep only the claim IDs each line actually states;
- choose each chapter's highlight (`label` from the step's bold labels, `selector` from the screen it is filmed on);
- declare clicks: `allowClicks` for read-only clicks, `demoWriteClicks` for writes, and set each chapter's `source`;
- add the If-not state to `onScreen`, with its claims;
- run `node video/lib/episode-schema.mjs video/episodes/<id>/episode.json` and `npm run test:episodes -- <key>` until both are clean (the highlight selectors are the last thing to fill in).

**EP-3 Script lock.** Set `status` to `script-locked` in `episode.json` and `scripted` in `series.json`, and record the lock in `video/approvals.md` (see [Approvals](#approvals)). Under the owner direction of 2026-10-19 the executor locks the script once the lint is clean, recorded as `decided by executor`.

**EP-4 Capture.** In Demo Mode, overlay on, through the director's gate (`../README.md`, Capture): `npm run video -- capture --episode <id> --dry-run`, then a `--no-record` rehearsal, then the take. Recreation shots: `node video/capture/recreation.mjs --episode <id> --take <N>`. Look through `take<N>_sheet.jpg` and `take<N>-safety.json`; discard any take that reloaded, refused a click or ended on a safety exit. Set `status` to `captured` in both files.

**EP-5 Voice-over.** `python3 video/vo/estimate.py --episode video/episodes/<id>/episode.json`, then `python3 video/vo/render-brian.py --episode video/episodes/<id>/episode.json --dry-run`, then the render without `--dry-run`. The script appends the credits before and after to `video/vo/credits-log.md`. Then a Whisper round-trip: transcribe every line WAV and compare it with the line's text, word for word, and re-render a line Brian misread (`--lines V3a --force`). No Whisper is installed on the production Mac as of 2026-10-20; install it into the media root's venv (`.venv/bin/pip install openai-whisper`), never into the repository, or listen to every line until it is. Set the series `status` to `voiced`.

**EP-6 Edit.** `npm run video -- build --episode video/episodes/<id>/episode.json --take <N> --final`, then `npm run video -- render --timeline <media root>/episodes/<id>/edit/timeline.json` and `npm run video -- mix --timeline <media root>/episodes/<id>/edit/timeline.json`. Open the render and watch it through.

**EP-7 Verify and deliverables.** On the render in `renders/`:

```bash
npm run video -- verify   --render <mp4> --timeline <timeline.json> --episode video/episodes/<id>/episode.json
npm run video -- ocr      --render <mp4> --timeline <timeline.json>
npm run video -- captions --timeline <timeline.json> --episode video/episodes/<id>/episode.json --report <media root>/episodes/<id>/vo/render-report.json --out <media root>/episodes/<id>/deliver/<key>.en.vtt
npm run video -- render   --timeline <timeline.json> --still <seconds> --out <media root>/episodes/<id>/deliver/<key>.poster.png
```

All three checks must pass. Copy the render to `deliver/<key>.mp4`, convert the poster still to `deliver/<key>.poster.jpg` (`ffmpeg -i <key>.poster.png -q:v 3 <key>.poster.jpg`), and write `deliver/<key>.transcript.txt`: the title card text, then every VO line's written text in order, then the end-card text. Record `runtimeSec`, `lufs` and `truePeak` from `verify-report.json` in `series.json`, set `status` to `verified` in `episode.json` and `edited` in `series.json`.

**EP-8 Lint.** `npm run test:episodes -- <key>` must be clean, (h) included.

**EP-9 Review.** Watch the delivered video against the guide at `#/<key>`. Under the owner direction of 2026-10-19 the executor accepts it once EP-7 and EP-8 pass, records it in `video/approvals.md` as `decided by executor`, sets `status` to `approved` in both files and `approvedAt` to today. The first episode of each wave also goes on [`docs/review-agenda.md`](../../docs/review-agenda.md) for the experts' sign-off; their verdict is recorded by role, with the date, in `docs/claims/signoff.md`, then in the wave's `expertSignoff` and the episode's `expertReview`.

**EP-10 Record.** Last episode of a wave: `python3 video/vo/estimate.py --live` again and record the wave's `creditsAfter`. Then `npm run test:episodes -- --write-tracker`, `npm test`, `npm run test:episodes`, `npm run video -- hygiene`, and commit `video/episodes/<id>/`, `series.json`, the tracker and the approvals row. Media is never committed.

**When a blocked episode opens.** The episode before it may have been made while it was blocked, ending on the series-end line. Run `npm run test:episodes` on every approved episode after a blocked one opens; an end card that now fails (d) is rebuilt with the new `endCard`, re-verified and re-delivered.

## Media layout

Under the media root (`~/Documents/SpatialAdjust_MarCom/`, or `SA_MEDIA_ROOT`), never in git, `/tmp` or a scratchpad:

```
episodes/<key>/
  capture/raw/   takes, cue logs, cursor tracks, contact sheets, safety reports
  vo/            line WAVs, raw API audio, render-report.json
  gfx/           generated card and label graphics
  edit/          timeline.json, edl.json; _video and _audio intermediates
  frames/        OCR frames (deleted after a passing run)
  renders/       renders and the verify, OCR and captions reports
  deliver/       <key>.mp4, <key>.en.vtt, <key>.transcript.txt, <key>.poster.jpg
```

`deliver/` holds exactly the four files the publishing step puts on the guides site; nothing else goes there.

## Recording

- **`series.json`:** `startedAt` at EP-1; `status` at EP-3, EP-4, EP-5, EP-7 and EP-9; `runtimeSec`, `lufs` and `truePeak` at EP-7; `approvedAt` at EP-9; `expertReview` and the wave's `expertSignoff` when the experts' verdict comes back; the wave's `creditsBefore` at EP-0 of its first episode and `creditsAfter` at EP-10 of its last; `checkedAt` whenever a blocked entry is re-checked.
- **Credits:** counts only, never anything else from the account and never the key. `video/vo/credits-log.md` gets one row per render run automatically.
- **Decisions:** every call made in place of a person goes in `video/approvals.md` and as one bullet on `docs/review-agenda.md` (append only): what was decided, where it shows, and the question for the experts.

## Approvals

Episode decisions go in `video/approvals.md`, in a table under `## Episodes` (the first episode to record one adds it, with this header), one row per decision, never edited afterwards:

| Episode | Decision point | Version | Decision | Date | Approver | Quote / notes |
|---|---|---|---|---|---|---|

- **Decision point:** `script` (EP-3) or `final` (EP-9).
- **Version:** the artifact and commit for a script, the render file name and its SHA-256 for a final.
- **Decision:** `decided by executor`, `approved`, `changes requested` or `rejected`.
- **Approver:** `executor`, the owner, or an expert by role (as `docs/claims/signoff.md` records them), never a name the public repository should not carry.
- **Quote / notes:** the owner's or the expert team's own words, quoted exactly, with where they were given. An executor's call starts "Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22" and says what was decided. Nobody records `approved` on someone else's behalf.

## Safety rules

1. **Changes only in this repository.** IntelliDash and `~/Documents/iCentral_MarCom` are read-only: read and copy from them, never edit them. IntelliDash is captured only through a `/demo` session.
2. **Media only under the media root**, never in git, `/tmp` or an agent scratchpad.
3. **Push, save and apply clicks only on `/demo`**, through the director's gate, and only the clicks declared in `episode.json`.
4. **Never print, log or commit** the ElevenLabs key or the values in `sanitize.local.json` and the other local name maps.
5. **Every narrated line and every on-screen text cites Verified claim IDs**; template chrome is the only exception.
6. **No Claude attribution** in commit messages: no `Co-Authored-By` line for Claude, no session trailer, no session link, no "Generated with" line.
7. **Approvals in `video/approvals.md` are recorded only in the owner's or the expert team's own words**; an executor's call under the owner direction of 2026-10-19 is recorded as `decided by executor`, in the format above.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- Aerial or satellite detail outside the map approach decided at gate G2 (restyled tiles).
- The IntelliDash dev URL, or any browser chrome.
- The unsupported-feature message Demo Mode shows for a write.
- Any push, save or apply outside a Demo Mode session held by the director's gate.

## Read first

Before the first episode, read these. The iCentral files are read-only; anything copied from them records its source path and modification time.

| File | Modified | What to take from it |
|---|---|---|
| `~/Documents/iCentral_MarCom/double-clicks/01-home/plan.md` | 2026-10-16 11:11 | The Double Click format: beats, one continuous walkthrough with chapter labels, Brian, blue highlights, dev-site safety rules |
| `~/Documents/iCentral_MarCom/double-clicks/01-home/script.md` | 2026-10-16 11:11 | The script table: timecodes, picture, chapter label, VO, about 230 words in 1:40 |
| `~/Documents/iCentral_MarCom/double-clicks/01-home/vo/render-brian.py` | 2026-10-16 11:42 | The Brian render the series' `video/vo/render-brian.py` was built from |
| `~/Documents/iCentral_MarCom/double-clicks/01-home/edit/gfx/_spec.json` | 2026-10-19 10:43 | The iCentral card graphics: series word, episode name, "Up next" eyebrow, end card |
| [`../README.md`](../README.md) | in the repository | The pipeline, the media root, the commands |
| [`../capture/SAFETY.md`](../capture/SAFETY.md) | in the repository | Demo Mode, its write guards and the director's rules |
| [`../brand/motion-system.md`](../brand/motion-system.md) | in the repository | Type, colour, motion, holds, layout and sound for every card |
