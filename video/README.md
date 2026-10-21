# Spatial Adjust videos

Short "Double Click" style videos for the Spatial Adjust guides: one episode per guide, each a few dozen seconds of real IntelliDash footage captured in Demo Mode, framed by the Spatial Adjust motion system and narrated in the Brian voice. The toolchain is ported from the iCentral MarCom video pipeline and lives entirely under `video/`.

Nothing here ships with the site. `build.mjs` copies only `STATIC_DIRS = ['assets', '_ds', 'vendor']` into `dist/`, so `video/` is never deployed. Keep it that way.

## Pipeline

Every episode goes through the same steps, in this order. Each step is one command.

| # | Step | Command | Output |
|---|---|---|---|
| 1 | Script lock: `episode.json` and `script.md`, every VO sentence backed by a claim; lock recorded in `approvals.md` | edit `video/episodes/<id>/`, validate with `node video/lib/episode-schema.mjs` | repo |
| 2 | Capture from IntelliDash `/demo` | `npm run video -- capture` | `<media root>/episodes/<id>/capture/raw/` |
| 3 | Voice-over | `npm run video -- vo` | `<media root>/episodes/<id>/vo/` |
| 4 | Build the timeline | `npm run video -- build` | `<media root>/episodes/<id>/edit/` |
| 5 | Render the picture, then mix and mux the audio | `npm run video -- render`, then `npm run video -- mix` | `<media root>/episodes/<id>/renders/` |
| 6 | Verify: format, loudness, holds, OCR, captions, repository hygiene | `npm run video -- verify`, `ocr`, `captions`, `hygiene` | `<media root>/episodes/<id>/renders/` |
| 7 | Decision and review | recorded in [`approvals.md`](approvals.md); reviewed in person (see rule 7) | repo |

The episode file format is documented in [`episodes/README.md`](episodes/README.md).

## Where media lives

Media (raw takes, VO, music, graphics, frames, renders) lives under the **media root**, never in git, `/tmp` or an agent scratchpad:

```
~/Documents/SpatialAdjust_MarCom/
  .venv/          Python venv for the pipeline
  auth/           local browser profile and session material (mode 0700)
  bin/            compiled helpers (for example the OCR tool)
  music/          the music bed (music.json names the file), licences/ for receipts
  logs/
  episodes/<id>/
    capture/raw/  raw takes
    vo/           voice-over WAVs and render report
    gfx/          generated graphics
    edit/         timelines; edit/_video and edit/_audio intermediates
    frames/       sampled frames for OCR (deleted after a passing run)
    renders/      final renders and verify reports
```

Set `SA_MEDIA_ROOT` to move it. Every script finds the root through `video/lib/media-root.mjs` (Node) or `video/lib/media_root.py` (Python), which refuse a root under `/tmp`, `/private/tmp`, `/var/folders`, `/private/var/folders` or the system temp directory, any path containing `/scratchpad` or `/claude-`, and any path inside this repository. The refusal is deliberate, not advice: the iCentral pipeline lost its v4 inputs to `/tmp` on 2026-10-06.

```bash
node video/lib/media-root.mjs --check     # prints the resolved root, or why it is refused
python3 video/lib/media_root.py --check   # same rules
```

The `.gitignore` also keeps media files, `raw/`, `_video/`, `_audio/`, `state.json` and every `*.local.json` under `video/` out of git, as a second line of defence.

## Safety rules

These apply to every person and every agent working on the videos.

1. **Code changes only in this repository.** IntelliDash (`~/IntelliDash`) and the iCentral MarCom folder (`~/Documents/iCentral_MarCom`) are read-only sources: read and copy from them, never edit them.
2. **The ElevenLabs API key is read at run time** from the `elevenlabs` MCP entry in `~/.claude.json`, in process. It is never printed, logged, written to a file, passed on a command line or committed. This repository is public: a leaked key is a revocation event.
3. **Local name maps stay local.** `sanitize.local.json` (real to fictional names for the guides) and `video/capture/overlay.local.json` (real to fictional names for the demo data) are gitignored and read only by scripts, through `video/lib/local-maps.mjs` or `video/lib/local_maps.py`. Their contents are never printed; reports name a term only as `[denylisted #N]`.
4. **Media goes to the media root**, `~/Documents/SpatialAdjust_MarCom/`, never into git, `/tmp` or an agent scratchpad.
5. **Capture only from IntelliDash `/demo`.** On a live course, Push Changes sends adjustments to Lynx and waters a golf course. Demo Mode blocks writes with an "unsupported" message; it does not mock them. Never click push, save or apply on a non-demo course.
6. **No Claude attribution in commits.** Commit messages carry no `Co-Authored-By` line for Claude, no session trailer, no session link and no "Generated with" line.
7. **Owner decisions are recorded, not waited on.** The fictional course, the map approach, the style frame, the end-card URL, the music licence, the pilot script and the pilot final are gates G1 to G7 in [`approvals.md`](approvals.md). Under the owner's direction of 2026-10-19 there are no pre-publication gates: whoever reaches a gate makes the call with the defaults listed in `approvals.md`, records it there as decided by the executor, adds the question to [`docs/review-agenda.md`](../docs/review-agenda.md), and carries on. The owner and the experts review everything in person on 2026-10-22. Nobody records `approved` on the owner's behalf; the owner's own decision is a new row in their words.
8. **No internal tracker IDs.** The repository is public, so work is described in words (the video pipeline, the claims ledger, the pilot's final render), never by a work-item, feature or epic number from the private trackers.

`npm run video -- hygiene` enforces rules 2, 3, 4, 6 and 8 on the repository: it fails when a media file is anywhere in git history, when the key or a denylisted name appears in a tracked file, in any commit's diff or in a commit message, when a tracked text file holds an internal tracker ID, or when a commit message in `origin/main..HEAD` carries Claude attribution. It prints locations only (a tracker ID as `<file>:<line>`), never the key, a name or the line's text. Run it before every push; exit 0 is clean, 1 means findings, 2 means the check itself could not run.

Denylisted names are matched case-insensitively by length: a term of six characters or more anywhere, four or five characters as a whole word only, and a term under four characters (a short code, say) not at all, because it matches line numbers and font data everywhere. The report lists any skipped terms by index, so a short term never passes silently.

## Prerequisites

- **Node 22 or later** with the repository's dev dependencies: `npm ci`. Capture uses Playwright (already a dev dependency) to drive the owner's own signed-in Chrome.
- **ffmpeg with libx264.** Homebrew's build has it; check with `ffmpeg -hide_banner -encoders | grep libx264`. Renders are H.264 High, yuv420p.
- **Python 3.12 venv at the media root** (not in the repo):

  ```bash
  python3.12 -m venv ~/Documents/SpatialAdjust_MarCom/.venv
  ~/Documents/SpatialAdjust_MarCom/.venv/bin/pip install -r video/requirements.txt
  export SA_VIDEO_PYTHON=~/Documents/SpatialAdjust_MarCom/.venv/bin/python
  ```

  `requirements.txt` pins torch, numpy, scipy, soundfile and Pillow to the versions in the iCentral compositor environment. The dispatcher runs Python subcommands with `$SA_VIDEO_PYTHON`, or `python3` when it is unset.
- **macOS with swiftc** (the Xcode command line tools, `xcode-select --install`) for the OCR check, which uses the Vision framework. `ocr_check.py` builds `video/verify/ocr.swift` into `<media root>/bin/sa-ocr` on first use; on any other platform, or without swiftc and the binary, it exits 3 with "OCR unavailable" instead of passing.

## Commands

All commands go through one dispatcher, `video/bin/sa-video`. Run `npm run video -- help` for the live list. A subcommand whose script has not landed yet prints the usage and exits 64.

| Command | Script | Purpose |
|---|---|---|
| `npm run video -- capture` | `video/capture/director.mjs` | Capture a take from IntelliDash `/demo` under three safety layers (`--dry-run` prints the plan and the click guard's verdicts without a browser); see [Capture](#capture) |
| `npm run video -- vo` | `video/vo/render-brian.py` | Render the episode voice-over in the Brian voice; `--dry-run` lists characters and credits without a network call (see [`vo/voice-settings.md`](vo/voice-settings.md)) |
| `npm run video -- estimate` | `video/vo/estimate.py` | Estimate characters and credits before rendering VO: one episode, the whole series, or the account's remaining credits (`--live`, counts only); see [`vo/series-estimate.md`](vo/series-estimate.md) |
| `npm run video -- build` | `video/edit/build.py` | Build the timeline from episode, take and VO report (`--episode <episode.json> --take N [--draft \| --final] [--source demo\|recreation]`): chapters cut on the take's cues, VO on its cues, the title, chapter and end cards, the music re-cut on its bar grid; gates checked first (exit 3 `missing approval: G..`). Writes `edit/timeline.json` and `edit/edl.json`; see [`episodes/README.md`](episodes/README.md#how-the-builder-reads-an-episode) |
| `npm run video -- render` | `video/edit/render.py` | Render a timeline to H.264 High, yuv420p, 60 fps (`--timeline <json>`, `--from`/`--to`, `--still t --out png`) |
| `npm run video -- mix` | `video/edit/mix.py` | Mix VO, SFX and the music bed to -14 LUFS (music 3 dB under the VO, ducked 9 dB while it speaks; true peak at or below -1 dBTP) and mux it with the rendered picture as AAC 48 kHz stereo (`--timeline <json> [--no-mux] [--stems]`; `--check-music <file>`). Refuses the unlicensed iCentral preview track before any audio is read; SFX sources in [`brand/sfx.md`](brand/sfx.md) |
| `npm run video -- style-frame` | `video/edit/style_frame.py` | Render the style frame for gate G3 (`--version v1`): eight stills, `sheet.jpg` and `manifest.json` under `<media root>/style-frames/<version>/`, the window shot on a still of the guide site's recreation (see [`brand/style-frame-notes.md`](brand/style-frame-notes.md)) |
| `npm run video -- verify` | `video/verify/verify.py` | Format, duration, loudness and true peak, label holds, VO overlap, black and frozen frames, and in final mode the music licence (`--render --timeline --episode [--draft]`); see [Verify](#verify) |
| `npm run video -- ocr` | `video/verify/ocr_check.py` | OCR sampled frames against the denylist, on macOS (`--render --timeline [--every 0.5] [--keep-frames]`) |
| `npm run video -- captions` | `video/verify/captions.py` | English WebVTT captions from the timeline's VO placements and the written VO text (`--timeline --episode --report [--out]`) |
| `npm run video -- hygiene` | `video/verify/hygiene.mjs` | Media, key, denylist, tracker ID and attribution check on git |

## Layout

| Path | Contents |
|---|---|
| `bin/sa-video` | The dispatcher |
| `lib/` | Shared code for Node and Python: media root guard, local maps loader, ElevenLabs key resolver, episode schema |
| `capture/` | Fictional course overlay (`course-overlay.js`: `window.__saOverlayInstall(pairs, identity)`, `window.__saOverlay.scan(denylist)`) and map treatment (`map-routes.mjs`: `installMapRoutes(page, mapPolicy)`, GET-only tile substitution; `map-treatment.js`; `node video/capture/map-still.mjs` renders a still of a policy to `<media root>/episodes/_stills/`). Capture director (`director.mjs`), its in-page runtime (`director-runtime.js`), safety gates (`gates.mjs`), recorder (`record.mjs`), the recreation runner (`recreation.mjs`) and the Demo Mode audit ([`SAFETY.md`](capture/SAFETY.md)) |
| `edit/` | Compositor (`lib/`: engine, wallpaper, camera planners, timeline builder, layer registry, `theme.py`), text graphics (`gfx/render_gfx.mjs`) and `render.py`, ported from iCentral MarCom; provenance in [`edit/NOTES.md`](edit/NOTES.md). The builder `build.py` and the audio (`mix.py`; `audio/`: the mixer, the original music bed `music_bed.py` and `loop_points.py`) |
| `vo/` | Brian voice renderer, lexicon, voice settings and loudness target, credits log and estimates. Needs only `python3` and ffmpeg |
| `verify/` | The release gate: `verify.py`, the OCR check (`ocr.swift`, built to `<media root>/bin/sa-ocr`, and `ocr_check.py`), `captions.py` (provenance in [`verify/NOTES.md`](verify/NOTES.md)), and the repository hygiene check (`hygiene.mjs`) |
| `brand/` | Course identity: `course.json` is the only definition of the fictional course for the pipeline (gate G1; proposal in `course-proposal.md`; `course.test.mjs` checks the guides' allowlists still accept it). Motion system: [`motion-system.md`](brand/motion-system.md), mirrored by `edit/lib/brand.py`. End card: `end-card.json` (URL decided at gate G4; options in `end-card-options.md`). Style frame notes for gate G3: `style-frame-notes.md`. Music: `music.json`, the bed every video uses, with its SHA-256, bar grid and licence (gate G5; options in `music-shortlist.md`); SFX sources and levels: `sfx.md` |
| `episodes/` | One folder per episode (`episode.json`, `script.md`); see [`episodes/README.md`](episodes/README.md) |
| `approvals.md` | The owner approvals log |
| `requirements.txt` | Python packages for the venv at the media root |

## Capture

A take is recorded from IntelliDash Demo Mode in the owner's own Chrome, which the director drives over the DevTools protocol on loopback. The rules, and the IntelliDash audit behind them, are in [`capture/SAFETY.md`](capture/SAFETY.md). In short: one page, one navigation (to the `/spatialadjust/demo` entry), the owner signs in to the demo form by hand, the director arms on the in-app hop to `/spatialadjust`, and from then on any write, WebSocket, new document, new window, refused click or denylisted name on screen ends the take with its own exit code.

1. **Config, once.** Copy `video/capture/capture.example.json` to `video/capture/capture.local.json` (gitignored) and replace the `example.invalid` hosts with the dev host (`entryUrl`, `allowedHosts`) and its API host (`apiHosts`). Hosts that must never be contacted, such as analytics, go in `blockHosts`; their requests are aborted quietly. The dev app posts to Azure Application Insights (`/v2/track`) while the demo form is still open; that POST ends a take with exit 3 unless its host is in `blockHosts`. `readySelector` (optional) is an element to wait for after the hop, `settleMs` a pause after it. The real host names never go into git.
2. **Name maps, once.** `video/capture/overlay.local.json` must exist (see [Safety rules](#safety-rules), rule 3): a Demo Mode take is refused with exit 5 while the denylist is empty.
3. **Chrome.** Start a separate Chrome for capture, listening on loopback, with its profile in the media root (the director prints this command when no Chrome is listening):

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/Documents/SpatialAdjust_MarCom/auth/chrome-profile"
   ```

   Use that profile for capture only: no extensions, and never signed in to a live IntelliDash course.
4. **Rehearse, then record.**

   ```bash
   npm run video -- capture --episode <id> --dry-run              # plan and click verdicts, no browser
   npm run video -- capture --episode <id> --take 1 --no-record   # real time, nothing recorded
   npm run video -- capture --episode <id> --take 1               # the take
   ```

   Sign in to the demo form in the tab the director opens. The take is written to `<media root>/episodes/<id>/capture/raw/take<N>.mp4` (3840x2160, 60 fps) with `take<N>-log.json` (cue times), `take<N>-track.json` (cursor and focus track for the edit), `take<N>_sheet.jpg` and `take<N>-safety.json`. Takes are never overwritten.
5. **Recreation.** An episode with `"source": "recreation"` (and an optional `recreationPath`, for example `/#/dashboard-overview`) is captured from the local guide site instead, for shots Demo Mode cannot show: `node video/capture/recreation.mjs --episode <id> --take <N>` (or the capture command above, which does the same for such an episode) builds `dist/` when it is missing, serves it on `localhost:8124` (or `$SA_RECREATION_PORT`) unless a server there already serves the same `dist/`, and records `take<N>-recreation.mp4` in Playwright's own Chromium. A server on that port that serves anything else is refused with exit 2; pick another free port with `SA_RECREATION_PORT`. Any other host is refused for this source, and demo-mode clicks are never allowed there. An optional `recreationFigure`, the start of one figure caption on the guide page, lifts that figure out of the page to fill the frame, so no guide prose is in shot; the episode's targets are then scoped with `[data-sa-frame] >> ...` ([`episodes/README.md`](episodes/README.md), [`capture/SAFETY.md`](capture/SAFETY.md)). `node video/capture/recreation.mjs --serve` just serves it, to pick targets.

Exit codes: 0 recorded, 1 failed, 2 entry refused, 3 write or WebSocket aborted, 4 new document or window, 5 overlay or denylist, 6 click refused, 64 usage, 65 invalid episode ([table](capture/SAFETY.md#exit-codes)).

## Verify

No render leaves the pipeline until all three checks pass on it. Each prints one line per finding and writes its report next to the render, under `<media root>/episodes/<id>/renders/`.

```bash
npm run video -- verify --render <mp4> --timeline <timeline.json> --episode video/episodes/<id>/episode.json [--draft]
npm run video -- ocr --render <mp4> --timeline <timeline.json>
npm run video -- captions --timeline <timeline.json> --episode video/episodes/<id>/episode.json --report <media root>/episodes/<id>/vo/render-report.json
```

- **verify** (`verify-report.json`): H.264 High, yuv420p, 1920x1080, constant 60 fps, AAC 48 kHz stereo; the duration inside `durationTarget`; -14 LUFS integrated +/- 0.5 and true peak at or below -1.0 dBTP (from `BRAND`, the mixer's targets); every label held for 1.5 s + 0.3 s per word; VO lines at least 0.15 s apart; no black frames outside the first and last 0.2 s; no frozen picture of 1.5 s or more outside label holds; and in final mode a `licenceRef` on the music with gate G5 decided (`--draft` skips that one). Exit 0 pass, 1 fail, 2 could not run.
- **ocr** (`ocr-report.json`): frames every 0.5 s and after each label comes in, read on the Mac by Apple Vision and matched against the local name maps (six characters or more: also one OCR misread away; shorter: whole words). It is the only check that sees canvas text such as map tiles. A hit prints `[denylisted #N] at <t> s`, never the name, and keeps the frames in `frames/ocr/` for review; a pass deletes them. Exit 0 pass, 1 hit, 2 could not run (an empty denylist included), 3 OCR unavailable.
- **captions** (`<id>.en.vtt`): cues of at most two lines of 42 characters, split at phrase ends, timed from the VO placements and the VO report's line lengths, with the written text from `episode.json` (never the lexicon's spoken form). Exit 0 written, 1 a rule broken or a denylisted name (nothing is written), 2 could not run.

The timeline keys the checks read, including the optional `holds` and `layers[].intentional` declarations, are listed in [`verify/NOTES.md`](verify/NOTES.md#timeline-keys-the-gate-reads).

## Tests

```bash
npm run test:video      # node --test over video/**/*.test.mjs
npm run test:video:py   # python3 -m unittest discover over video/**/test_*.py (compositor tests rerun themselves in the media-root venv)
```

Tests use committed fixtures with invented names only. They never open the real `sanitize.local.json`, `overlay.local.json` or `~/.claude.json`.

## Runbook

One episode from script to verified render, written from the pilot, which ran every step on 2026-10-20: [`episodes/dashboard-overview-pilot/README.md`](episodes/dashboard-overview-pilot/README.md) has its commands, wall times and numbers. Run everything from the repository root. `<id>` is the episode id, `<ep>` its file `video/episodes/<id>/episode.json`, `<media>` the media root and `<N>` the take number.

### Setup, once per machine

1. **Node and Playwright.** Node 22 or later, then `npm ci` and `npx playwright install chromium` (the graphics and the recreation run in Playwright's Chromium).
2. **ffmpeg with libx264** on `PATH` (or `$FFMPEG` and `$FFPROBE`), and **swiftc** for the OCR check (see [Prerequisites](#prerequisites)).
3. **The media root and its venv.** `node video/lib/media-root.mjs --check` must print `~/Documents/SpatialAdjust_MarCom` (or your `$SA_MEDIA_ROOT`). Create the venv there, install `video/requirements.txt` into it and `export SA_VIDEO_PYTHON=<media>/.venv/bin/python` in every shell that runs the pipeline. Without it the Python subcommands run on the system `python3`, which has no torch, and `render` exits 2.
4. **The ElevenLabs key** sits in the `elevenlabs` MCP entry of `~/.claude.json`. `npm run video -- estimate --live` proves the pipeline can read it: it prints the remaining credits, never the key.
5. **The local name maps,** gitignored and never printed, copied or committed:
   - `sanitize.local.json` at the repository root, `{"real": "fictional"}`, the same file the guide build uses. In a second git worktree, symlink it from the main checkout rather than copying it.
   - `video/capture/overlay.local.json`, `{"pairs": {"real": "fictional"}, "denylist": ["real", ...]}`, with the Demo Mode data's real course and people names. A Demo Mode take is refused with exit 5 without it; the recreation, whose names are fictional already, runs without it.
6. **The capture config,** for Demo Mode only: copy `video/capture/capture.example.json` to `video/capture/capture.local.json` (gitignored) and fill in the dev host as in [Capture](#capture), step 1.
7. **The music bed.** `video/brand/music.json` names `music/sa-bed-v1.wav` under the media root, with its SHA-256; `mix` and `verify` check the file against it. If the file is missing, regenerate it with `$SA_VIDEO_PYTHON video/edit/audio/music_bed.py --version v1` and compare the SHA-256 it prints with `music.json`; a mismatch is refused by `mix`.
8. **Check the tools:** `npm run test:video` and `npm run test:video:py`.

### One episode

| # | Step | Command | Output | Done when |
|---|---|---|---|---|
| 1 | Write the script: `<ep>` and `video/episodes/<id>/script.md`, every VO line citing claims in `docs/claims/claims.json` | `node video/lib/episode-schema.mjs <ep>` and `npm run video -- estimate --episode <ep>` | repo | the schema prints `ok`; the estimate gives the characters to budget |
| 2 | Lock the script: set `"status": "script-locked"` and record the lock in [`approvals.md`](approvals.md) (G6 for the pilot), plus a bullet in [`docs/review-agenda.md`](../docs/review-agenda.md) | `node video/lib/episode-schema.mjs <ep>` | repo, committed | the row is recorded and the commit named in it |
| 3 | Plan the take | `npm run video -- capture --episode <id> --dry-run` | stdout | every target resolves and the click guard has nothing to refuse |
| 4 | Rehearse | `npm run video -- capture --episode <id> --take <N> --no-record` | `<media>/episodes/<id>/capture/raw/take<N>[-recreation]-safety.json` | exit 0 |
| 5 | Record | `npm run video -- capture --episode <id> --take <N>`; set `"status": "captured"` | `take<N>[-recreation].mp4`, `-log.json`, `-track.json`, `_sheet.jpg`, `-safety.json` | exit 0, and the contact sheet shows the shot you meant |
| 6 | Voice-over | `npm run video -- vo --episode <ep> --dry-run`, then without `--dry-run` | `<media>/episodes/<id>/vo/vo-*.wav`, `render-report.json`; a row in `video/vo/credits-log.md` (commit it) | exit 0; listen to every line |
| 7 | Draft | `npm run video -- build --episode <ep> --take <N> --draft`, `npm run video -- render --timeline <media>/episodes/<id>/edit/timeline.json`, `npm run video -- mix --timeline <same>` | `renders/<id>-take<N>-DRAFT.mp4` | watch it: framing, pace, the cursor on every target the VO names |
| 8 | Final | the same three commands with `--final`; set `"status": "edited"` | `renders/<id>-take<N>.mp4` | exit 0 from all three |
| 9 | Verify | `npm run video -- verify --render <mp4> --timeline <tl> --episode <ep>`, `npm run video -- ocr --render <mp4> --timeline <tl> --episode <ep>`, `npm run video -- captions --timeline <tl> --episode <ep> --report <media>/episodes/<id>/vo/render-report.json`; set `"status": "verified"` | `renders/verify-report.json`, `ocr-report.json`, `<id>.en.vtt` | exit 0 from all three |
| 10 | Hygiene and commit | `npm run video -- hygiene`, then commit the episode files with a plain message | repo | exit 0 |
| 11 | Decision | record the call in [`approvals.md`](approvals.md) (G7 for the pilot) and [`docs/review-agenda.md`](../docs/review-agenda.md); `"status": "approved"` only on the owner's own words | repo | the row is recorded |

Every step writes under the media root except the repository files named in the table. A take, a VO render and a timeline are inputs to the next step, so do not move or rename them: the timeline records the take and VO paths it was built from, and `verify` and `ocr` read the timeline.

The episode's `status` follows the steps: `draft`, `script-locked` (a final build needs at least this), `captured`, `edited`, `verified` and `approved`. A change to a VO line's text, or to the actions after a take, is a new script version: a new lock row before the next final, then a new take.

### Gates

The gates live in [`approvals.md`](approvals.md). Until the in-person review of 2026-10-22, whoever reaches a gate decides it under the owner's direction of 2026-10-19, records it as `decided by executor` and adds a bullet to [`docs/review-agenda.md`](../docs/review-agenda.md). Only the owner, Adam Munir, records `approved`, in their own words, as a new row.

| Gate | What it decides | Default under the owner's direction | Checked by |
|---|---|---|---|
| G1 | The fictional course identity, `video/brand/course.json` | a neutral fictional course not in the iCentral material | before capture, by the rule in `approvals.md` (the director does not read it) |
| G2 | The map approach and the treatment still | fictional or Demo Mode imagery only; restyle is the default `mapPolicy` | before capture, by the same rule |
| G3 | The style frame | the Spatial Adjust brand as the plan describes | `build` (draft and final) |
| G4 | The end-card URL, `video/brand/end-card.json` | the guides site URL | `build --final`; while undecided a draft's end card reads URL PENDING APPROVAL |
| G5 | The music licence, `video/brand/music.json` | an original or licensed bed with its licence reference | `build --final`, `mix`, `verify` in final mode |
| G6 | The pilot's script lock | locked once the schema passes and every VO line cites a claim | `build --final` (status `script-locked` or later); before capture, by the same rule |
| G7 | The pilot's final render | accepted once verify, OCR and hygiene pass | the decision row; the episode reaches `approved` only on the owner's words |

`build` stops with exit 3 `missing approval: G..` when a gate it needs has no decision; `$SA_APPROVALS_PATH` points it at another file, for tests only.

### Exit codes

| Command | Exit codes |
|---|---|
| `sa-video` (the dispatcher) | the subcommand's own code; 64 no, unknown or not yet implemented subcommand; 128 + the signal number when the child is killed |
| `capture` | 0 recorded (or dry run printed); 1 unexpected error or the plan failed in the page; 2 entry refused, config missing or invalid, `--source` mismatch, no CDP endpoint, a port held by another server, or no arming in time; 3 a write or WebSocket aborted; 4 a new document or window; 5 overlay, map treatment or denylist; 6 a guarded action refused or its target not found; 64 usage, or the take exists; 65 invalid episode ([`capture/SAFETY.md`](capture/SAFETY.md#exit-codes)) |
| `vo` | 0 done; 1 a render step failed (API, ffmpeg, file); 2 configuration or usage (bad episode, key not found, RMS target missing, media root refused) |
| `estimate` | 0 done; 1 the live credit call failed; 2 configuration or usage |
| `build` | 0 written; 1 the build failed (missing media, a hold or VO overlap, a tool); 2 usage or configuration; 3 a gate is missing |
| `render` | 0 rendered; 1 ffmpeg missing or failed; 2 usage or configuration (bad timeline, media root refused, torch missing) |
| `mix` | 0 done and in spec; 1 a refused music file, a failed step or a result out of spec; 2 usage or configuration |
| `style-frame` | 0 rendered; 2 usage or configuration; 64 a malformed `--version`; 1 an unexpected error |
| `verify` | 0 pass; 1 fail; 2 could not run |
| `ocr` | 0 pass; 1 a denylisted name read; 2 could not run (an empty denylist included); 3 OCR unavailable |
| `captions` | 0 written; 1 a rule broken or a denylisted name (nothing written); 2 could not run |
| `hygiene` | 0 clean; 1 findings; 2 the check could not run; 64 usage |

### Troubleshooting

From the pilot's runs:

- **`capture` exits 2: a server on 8124 does not serve this checkout's `dist/`.** Another checkout's guide server (or `npm run serve`) holds the recreation's port. Run the capture with `SA_RECREATION_PORT=<free port>`; the pilot used 8139.
- **Tests fail with `moov atom not found` or a contact sheet exit 254.** Two test runs shared `<media>/_tests/capture` and deleted each other's takes. Give each run its own root: `SA_MEDIA_ROOT=<media>/_tests/<name> npm run test:video`.
- **`render` prints `Error submitting a packet to the muxer: Broken pipe`.** Once per window shot, when the take's decoder is closed after the shot has read its frames. The render exits 0 with every frame; it is not an error.
- **The camera pushes in too early.** A `focus` box is fitted to about 60 % of the view and held until the beat ends, so a box on a small element (the pilot's 318 x 32 px legend) is the maximum push-in for the whole beat. Put the focus in a beat of its own, after the hovers that need the wide shot.
- **`render` exits 2: torch is not installed.** `$SA_VIDEO_PYTHON` is unset in this shell; export it.
- **A Demo Mode take ends with exit 5 before anything happens.** `video/capture/overlay.local.json` is missing or its denylist is empty.
- **The final render is `<id>-take<N>.mp4`,** not `<id>.mp4`: the builder names renders by take, so a new take never overwrites the render of an earlier one.
- **`render-brian.py` fails with HTTP 403 `output_format_not_allowed`.** The account's tier does not offer the 192 kbps MP3 the renderer asks for (Creator and above). Set `SA_ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128` for the run; the audio is converted to the same 48 kHz 24-bit master, and the format is part of each line's hash, so a changed format re-renders the lines.
- **A take needs hours when the machine is busy.** The recorder encodes every 3840x2160 frame with x264 `slow`, CRF 12. `SA_CAPTURE_X264_PRESET=veryfast` keeps the CRF and the frame geometry and makes the encode several times cheaper; the master is an intermediate that `render` re-encodes. The default is unchanged.

