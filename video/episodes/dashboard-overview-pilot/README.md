# Pilot: Dashboard overview, "Read the map"

The first episode taken through the whole pipeline, end to end, to prove it and to write the runbook in [`../../README.md`](../../README.md#runbook) from. The script and its claims are in [`script.md`](script.md); the episode definition is [`episode.json`](episode.json). Media lives under the media root, `~/Documents/SpatialAdjust_MarCom/episodes/dashboard-overview-pilot/`; paths below are relative to that folder unless they start with `video/`.

| Step | Status | Where |
|---|---|---|
| Script lock (G6) | decided by executor: VO text v1, actions v2 | [`script.md`](script.md), `video/approvals.md` rows G6 |
| Capture | 2 takes from the recreation, both clean; take 2 chosen | `capture/raw/take2-recreation.*` |
| Voice-over | 3 lines rendered once, 247 characters, 109 credits | `vo/` |
| Edit | draft and final rendered from take 2 | `renders/dashboard-overview-pilot-take2.mp4` |
| Verification | verify, OCR, captions and hygiene pass on the final | `renders/verify-report.json`, `renders/ocr-report.json`, `renders/dashboard-overview-pilot.en.vtt` |
| Pilot final (G7) | decided by executor; status `verified`, not `approved` | `video/approvals.md` row G7, [Decision](#decision-g7) |

## Capture

**Chosen take: 2** (`capture/raw/take2-recreation.mp4`). **Takes recorded: 2.** **Incidents: none** (every director run exited 0). Take 1 was clean too; it was replaced because its edit pushed in on the legend too early (see [Edit](#edit)), a change to the episode's actions, not a capture fault.

The take is from the guide site's own recreation, not from IntelliDash `/demo`: see [`script.md`](script.md#footage-source-the-guide-sites-recreation) for why, and [Demo Mode take for the owner](#demo-mode-take-for-the-owner) for the steps that replace it. The episode lifts the step 2 figure, "Map with the moisture legend.", to fill the frame (`recreationFigure`).

Commands, from the repository root, 2026-10-20:

```bash
node video/capture/director.mjs --episode dashboard-overview-pilot --dry-run                                # actions v1: 3 beats, 8 targets; v2: 4 beats, 9 targets; about 14.2 s; click guard: no clicks
SA_RECREATION_PORT=8139 node video/capture/director.mjs --episode dashboard-overview-pilot --take 1 --no-record   # rehearsal, exit 0
SA_RECREATION_PORT=8139 node video/capture/director.mjs --episode dashboard-overview-pilot --take 1               # take 1, exit 0
# actions v2 (script.md), then:
SA_RECREATION_PORT=8139 node video/capture/director.mjs --episode dashboard-overview-pilot --take 2 --no-record   # rehearsal, exit 0
SA_RECREATION_PORT=8139 node video/capture/director.mjs --episode dashboard-overview-pilot --take 2               # take 2, exit 0
```

`SA_RECREATION_PORT=8139`: port 8124, the recreation's default, was held by another checkout's guide server, and the director rightly refused to reuse a server that does not serve this checkout's `dist/` (exit 2). Any free loopback port works.

| Take | Exit | Frames | Wall time | Aborted requests | WebSockets | Documents after arming | Popups | Refusals | Denylist scans / hits | Lifted figure box |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 (rehearsal, not recorded) | 0 | — | 16 s | 0 | 0 | 0 | 0 | 0 | 26 / 0 | 0, 0, 1920, 1080 |
| 1 | 0 | 852 (14.2 s at 60 fps, 3840x2160) | 387 s | 0 | 0 | 0 | 0 | 0 | 58 / 0 | 0, 0, 1920, 1080 |
| 2 (rehearsal, not recorded) | 0 | — | — | — | — | — | — | — | — | — |
| 2 | 0 | 852 (14.2 s at 60 fps, 3840x2160) | 372 s | 0 | 0 | 0 | 0 | 0 | 58 / 0 | 0, 0, 1920, 1080 |

From `capture/raw/take<N>-recreation-safety.json`; a recorded take writes over its rehearsal's report, which is why take 2's rehearsal shows its exit code only. In both takes the one document load is the entry page itself, before arming. Both cue logs have `vo-pins` at 1.767 s and `vo-bands` at 6.367 s after the start flash. The contact sheets (`take<N>-recreation_sheet.jpg`) show the start flash, the lifted app with the restyled turf map, the cursor on the pins and the highlight box on the legend; no guide prose and no page header are in frame.

The denylist checked during the take is the 7 terms of `sanitize.local.json` (counts only); `video/capture/overlay.local.json` does not exist on this machine, which is fine for the recreation, whose names are already fictional, and would refuse a Demo Mode take with exit 5.

## Demo Mode take for the owner

The pilot becomes a Demo Mode episode by these steps, which need the owner in person (a hand sign-in) and local files no executor can write:

1. Create `video/capture/capture.local.json` from `video/capture/capture.example.json` with the dev host (`entryUrl` ending `/spatialadjust/demo`, `allowedHosts`, `apiHosts`), and `video/capture/overlay.local.json` with the demo data's real-to-fictional name pairs and the denylist (both gitignored; see `video/README.md`, "Capture").
2. Start the capture Chrome with its profile in the media root (the director prints the exact command when none is listening):
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/Documents/SpatialAdjust_MarCom/auth/chrome-profile"`
3. In `episode.json`, set `"source": "demo"`, remove `recreationPath` and `recreationFigure`, and replace the `[data-sa-frame] >> ...` targets with IntelliDash's own (read from the IntelliDash source, cited by path and line only). That changes the episode, so it needs a new G6 row.
4. `npm run video -- capture --episode dashboard-overview-pilot --dry-run`, then `--take 1 --no-record`, then `--take 1`; sign in to the demo form in the tab the director opens. The take is `capture/raw/take1.mp4`, beside the recreation take, never over it.
5. Build, render, mix and verify as below with `--take 1 --source demo`.

## Voice-over

```bash
npm run video -- vo --episode video/episodes/dashboard-overview-pilot/episode.json --dry-run   # 3 lines, 247 characters, about 247 credits
npm run video -- vo --episode video/episodes/dashboard-overview-pilot/episode.json             # 32.5 s wall
```

| Line | Characters | Seconds | Rendered |
|---|---|---|---|
| `vo-intro` | 82 | 3.86 | once |
| `vo-pins` | 68 | 4.41 | once |
| `vo-bands` | 97 | 5.21 | once |
| **Total** | **247** | **13.48** | **1 run, no retakes** |

The character count matches the G6 estimate exactly (247). The account's remaining credits went from 357,546 to 357,437: **109 credits for 247 characters, 0.44 credits per character**, the same rate as the lexicon check (`video/vo/credits-log.md`). No term in these lines is rewritten by the lexicon, so nothing needed a pronunciation fix. The WAVs have been checked by duration and level only; no person has listened to them yet (play `vo/vo-*.wav` at the review).

## Edit

Every step is one command; `SA_VIDEO_PYTHON` points at the venv at the media root (`export SA_VIDEO_PYTHON=~/Documents/SpatialAdjust_MarCom/.venv/bin/python`). `<tl>` is `edit/timeline.json`.

```bash
npm run video -- build --episode video/episodes/dashboard-overview-pilot/episode.json --take 2 --draft
npm run video -- render --timeline <tl>
npm run video -- mix --timeline <tl>
npm run video -- build --episode video/episodes/dashboard-overview-pilot/episode.json --take 2 --final
npm run video -- render --timeline <tl>
npm run video -- mix --timeline <tl>
```

| Run | Build | Render | Mix | Duration | Loudness, true peak (mix) | Output |
|---|---|---|---|---|---|---|
| Draft, take 1 | 6.5 s | 48 s (1,669 frames) | 4 s | 27.816 s | -14.0 LUFS, -1.7 dBTP | `renders/dashboard-overview-pilot-take1-DRAFT.mp4` |
| Draft, take 2 | 6 s | 56 s (1,672 frames) | 4 s | 27.866 s | -14.0 LUFS, -1.7 dBTP | `renders/dashboard-overview-pilot-take2-DRAFT.mp4` |
| **Final, take 2** | 2.8 s | 46 s (1,672 frames) | 3.7 s | **27.866 s** | -14.0 LUFS, -1.7 dBTP | **`renders/dashboard-overview-pilot-take2.mp4`** |

The final's gates: G3, G4 and G5 decided, the episode at `script-locked` or later, and `video/brand/music.json` naming the original bed `sa-bed-v1` with its licence reference. The build reported no VO overlap and no hold failure. The builder names renders `<id>-take<N>[-DRAFT].mp4`, so the final is `dashboard-overview-pilot-take2.mp4`, not `dashboard-overview-pilot.mp4` as the plan wrote. The draft and the final of take 2 are the same file byte for byte: a draft differs from a final only while G4 is undecided (its end card then reads URL PENDING APPROVAL), and G4 is decided.

Timeline (final): lockup 0-2.3 s; title card 2.3-8.2 s with `vo-intro` at 2.75 s; chapter card READ THE MAP 8.2-11.1 s; window shot 11.1-22.866 s (take 1.217-12.983 s) with `vo-pins` at 11.65 s and `vo-bands` at 16.25 s; end card 22.866-27.866 s.

The first draft (take 1) pushed in on the legend as soon as `vo-bands` started, because its focus box was drawn at the start of the beat, and the pins the cursor then visited were out of shot. The camera planner fits a focus box to about 60 % of the view, so a box on a 318 x 32 px legend means the maximum push-in for as long as the box is up. Actions v2 moved the focus into a last beat of its own; take 2 shows the pins wide and the legend close.

`render` prints `Error submitting a packet to the muxer: Broken pipe` once per window shot: that is the take's decoder being closed when the shot has read the frames it needs. The render itself exits 0 and has every frame.

## Verification

On the final render, `renders/dashboard-overview-pilot-take2.mp4`, 2026-10-20. `<r>` is that file and `<tl>` is `edit/timeline.json`:

```bash
npm run video -- verify --render <r> --timeline <tl> --episode video/episodes/dashboard-overview-pilot/episode.json   # final mode, exit 0, 2 s
npm run video -- ocr --render <r> --timeline <tl> --episode video/episodes/dashboard-overview-pilot/episode.json      # exit 0, 12 s
npm run video -- captions --timeline <tl> --episode video/episodes/dashboard-overview-pilot/episode.json --report vo/render-report.json   # exit 0
npm run video -- hygiene                                                                                              # exit 0
```

| Check | Result | Numbers |
|---|---|---|
| (a) format | pass | H.264 High, yuv420p, 1920x1080, constant 60 fps; AAC 48 kHz stereo |
| (b) duration | pass | 27.87 s, inside 20-30 s and equal to the timeline |
| (c) loudness | pass | integrated -14.0 LUFS, true peak -1.7 dBTP |
| (d) holds | pass | 5 labels, each held at least its minimum |
| (e) VO overlap | pass | 3 VO lines, none overlapping |
| (f) black frames | pass | none |
| (g) frozen frames | pass | none |
| (h) music licence | pass | `sa-bed-v1`, an original work, G5 decided by the executor |
| OCR | pass | 59 frames read (every 0.5 s plus the label frames), 7 denylist terms, 0 hits; frames deleted after the pass |
| Captions | written | 4 cues for 3 VO lines, `renders/dashboard-overview-pilot.en.vtt`, timed from the timeline's VO placements |
| Hygiene | pass | no media, key, denylisted name or Claude attribution in tracked files, history or commit messages |

Reports: `renders/verify-report.json` (mode `final`) and `renders/ocr-report.json`; the OCR report holds counts and times only. The verify and OCR runs load `overlay.local.json` if present; it is not on this machine, so the denylist is the 7 terms of `sanitize.local.json`. The recreation's names are fictional already, so the OCR pass shows the overlay-free path is clean, not that a Demo Mode take would be.

The VO credit estimate, refreshed with these numbers (`python3 video/vo/estimate.py --write --episode video/episodes/dashboard-overview-pilot/episode.json --cps-from <media root>/episodes/dashboard-overview-pilot/vo/render-report.json --takes 2 --render-seconds 46`), is in [`video/vo/series-estimate.md`](../../vo/series-estimate.md#pilot-as-rendered): the pilot narrates at 18.32 characters per second, faster than the iCentral rate of 16.16 the plan assumed, which raises the 26-guide planning estimate from 9,856 to 11,172 characters (22,344 credits with retakes, at 1 credit per character; the account has charged 0.44).

## Decision (G7)

Under the owner direction of 2026-10-19 the executor accepted the final render once verify, OCR and hygiene passed (the G7 default), and recorded it in `video/approvals.md` as `decided by executor`, with the render's SHA-256 and a bullet on `docs/review-agenda.md`. The episode stays at `verified`: it becomes `approved` only when the owner approves it in their own words, as a new G7 row.

For the review on 2026-10-22, open locally (never upload): `renders/dashboard-overview-pilot-take2.mp4` (27.9 s, 13.8 MB), its captions `renders/dashboard-overview-pilot.en.vtt`, the [Verification](#verification) numbers above and [`video/vo/series-estimate.md`](../../vo/series-estimate.md). Two things are not yet proven: the footage is the recreation, not Demo Mode, and no person has listened to the three VO lines.

## Lessons from the pilot

1. **The cards leave about 12 s of footage.** Lockup 2.3 s, title card 5.9 s, one chapter card 2.9 s and end card 5.0 s are 16.1 s of a 27.9 s episode. A 20-30 s episode holds one chapter, perhaps two short ones, and the title card has to carry the first VO line. Plan scripts around 10-15 s of footage, not 15-20 s.
2. **Brian is faster than planned.** 18.32 characters per second, against the 16.16 measured on iCentral: 247 characters filled 13.5 s, not 15.3 s. The account charged 0.44 credits per character (109 for 247); the estimate keeps 1 credit per character as the upper bound.
3. **A focus box is a full push-in for the whole beat.** The camera fits the box to about 60 % of the view and holds it until the beat ends. Give each focus a beat of its own after the hovers that need the wide shot; never focus a small element at the start of a beat that also visits other targets.
4. **Watch the draft before the final.** The take 1 draft passed every check and still showed the wrong thing (the pins out of shot). The checks prove format, loudness, holds and names; only a person watching proves the shot matches the line.
5. **The recreation is a full source for shots the guides reproduce.** `recreationFigure` lifts one figure to fill the frame, the targets scope to it, and the take cannot pass as Demo Mode (`take<N>-recreation.mp4`). A Demo Mode take needs the owner in person: a capture Chrome, a hand sign-in, `capture.local.json` and `overlay.local.json`.
6. **Machine time per episode is about 10 minutes.** Rehearsal 16 s; a 14 s take about 6.5 minutes (recorded at 3840x2160 on a virtual clock); VO 33 s; build, render and mix about 1 minute per pass (draft, then final); verify and OCR 14 s. The human time is in the script, the draft review and the listening.
7. **Isolate parallel runs.** Two checkouts on one machine collide on the recreation's port (`SA_RECREATION_PORT`) and on the shared test media folder (`SA_MEDIA_ROOT` per run).
8. **The claims ids move.** This branch's ledger predates the claims audit, and three of the pilot's ids name different sentences there. After the merge into `main`, re-run the schema and compare the cited texts before any further episode is locked.
9. **This branch's video docs still carry internal work-item ids** (in `video/README.md`, `video/approvals.md`, `docs/review-agenda.md` and the dispatcher), which `main` has since removed from its public docs. Sweep them before the merge.

## Hand-off

**For the Double Click series** (one episode per guide):

- The runbook in [`video/README.md`](../../README.md#runbook) is the procedure; this folder is the worked example. Copy `episode.json` as the template: a `title` beat carrying the first line over the title card, one `cue` per VO line, hovers, then focus in a beat of its own.
- G1 to G5 are decided once for the whole series (course, map, style, end-card URL, music). G6 and G7 are written for the pilot only; decide how each episode's script lock and final are recorded (a row per episode in `approvals.md`, or one series row) before the first episode is locked.
- Budget: `video/vo/series-estimate.md`, regenerated at the pilot's rate: 11,172 characters for 26 guides, 22,344 credits with retakes at 1 credit per character (about 9,800 at the rate charged so far), against about 357,400 left on the account.
- Capture the first series episode from Demo Mode with the owner present, to prove the overlay and map restyle on real footage; the pilot did not.

**For the site delivery:**

- The deliverable is `renders/<id>-take<N>.mp4` under the media root, H.264 High 1920x1080 60 fps with AAC 48 kHz stereo at -14 LUFS (the pilot: 27.9 s, 13.8 MB), and English WebVTT captions `renders/<id>.en.vtt` beside it. `render --still <t> --out <png>` makes a poster frame from the same timeline.
- `video/` is never deployed (`build.mjs` copies only `assets`, `_ds` and `vendor` into `dist/`), and the renders are not in git. Where the files are hosted, and any upload, is an owner decision of its own.
- The end-card URL is data (`video/brand/end-card.json`): when the site moves to Azure behind SSO, change it, record the G4 change and re-render; nothing else changes.
