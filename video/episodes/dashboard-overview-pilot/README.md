# Pilot: Dashboard overview, "Read the map"

The first episode taken through the whole pipeline, end to end, to prove it and to write the runbook in [`../../README.md`](../../README.md#runbook) from. The script and its claims are in [`script.md`](script.md); the episode definition is [`episode.json`](episode.json). Media lives under the media root, `~/Documents/SpatialAdjust_MarCom/episodes/dashboard-overview-pilot/`; paths below are relative to that folder unless they start with `video/`.

| Step | Status | Where |
|---|---|---|
| Script lock (G6) | decided by executor: VO text v1, actions v2 | [`script.md`](script.md), `video/approvals.md` rows G6 |
| Capture | 2 takes from the recreation, both clean; take 2 chosen | `capture/raw/take2-recreation.*` |
| Voice-over | 3 lines rendered once, 247 characters, 109 credits | `vo/` |
| Edit | draft and final rendered from take 2 | `renders/dashboard-overview-pilot-take2.mp4` |

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
