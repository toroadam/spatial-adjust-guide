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
| 5 | Render | `npm run video -- render` | `<media root>/episodes/<id>/renders/` |
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
  music/          licensed music
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

`npm run video -- hygiene` enforces rules 2, 3, 4 and 6 on the repository: it fails when a media file is anywhere in git history, when the key or a denylisted name appears in a tracked file, in any commit's diff or in a commit message, or when a commit message in `origin/main..HEAD` carries Claude attribution. It prints locations only, never the key or a name. Run it before every push; exit 0 is clean, 1 means findings, 2 means the check itself could not run.

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
- **macOS** for the OCR check, which uses the Vision framework. TBD (PI-ICNT-SW-1082)

## Commands

All commands go through one dispatcher, `video/bin/sa-video`. Run `npm run video -- help` for the live list. A subcommand whose script has not landed yet prints the usage and exits 64.

| Command | Script | Purpose | Delivered by |
|---|---|---|---|
| `npm run video -- capture` | `video/capture/director.mjs` | Capture a take from IntelliDash `/demo` under three safety layers | TBD (PI-ICNT-SW-1078) |
| `npm run video -- vo` | `video/vo/render-brian.py` | Render the episode voice-over in the Brian voice; `--dry-run` lists characters and credits without a network call (see [`vo/voice-settings.md`](vo/voice-settings.md)) | PI-ICNT-SW-1080 |
| `npm run video -- estimate` | `video/vo/estimate.py` | Estimate characters and credits before rendering VO: one episode, the whole series, or the account's remaining credits (`--live`, counts only); see [`vo/series-estimate.md`](vo/series-estimate.md) | PI-ICNT-SW-1080 |
| `npm run video -- build` | `video/edit/build.py` | Build the timeline from episode, take and VO report | TBD (PI-ICNT-SW-1083) |
| `npm run video -- render` | `video/edit/render.py` | Render a timeline to H.264 High, yuv420p, 60 fps (`--timeline <json>`, `--from`/`--to`, `--still t --out png`) | PI-ICNT-SW-1077 |
| `npm run video -- style-frame` | `video/edit/style_frame.py` | Render the style frame for gate G3 | TBD (PI-ICNT-SW-1081) |
| `npm run video -- verify` | `video/verify/verify.py` | Format, duration, loudness, holds, black and frozen frames | TBD (PI-ICNT-SW-1082) |
| `npm run video -- ocr` | `video/verify/ocr_check.py` | OCR sampled frames against the denylist | TBD (PI-ICNT-SW-1082) |
| `npm run video -- captions` | `video/verify/captions.py` | WebVTT captions from the timeline | TBD (PI-ICNT-SW-1082) |
| `npm run video -- hygiene` | `video/verify/hygiene.mjs` | Media, key, denylist and attribution check on git | PI-ICNT-SW-1076 |

## Layout

| Path | Contents |
|---|---|
| `bin/sa-video` | The dispatcher |
| `lib/` | Shared code for Node and Python: media root guard, local maps loader, ElevenLabs key resolver, episode schema |
| `capture/` | Fictional course overlay (`course-overlay.js`: `window.__saOverlayInstall(pairs, identity)`, `window.__saOverlay.scan(denylist)`) and map treatment (`map-routes.mjs`: `installMapRoutes(page, mapPolicy)`, GET-only tile substitution; `map-treatment.js`; `node video/capture/map-still.mjs` renders a still of a policy to `<media root>/episodes/_stills/`). Capture director and safety gates TBD (PI-ICNT-SW-1078) |
| `edit/` | Compositor (`lib/`: engine, wallpaper, camera planners, timeline builder, layer registry, `theme.py`), text graphics (`gfx/render_gfx.mjs`) and `render.py`, ported from iCentral MarCom; provenance in [`edit/NOTES.md`](edit/NOTES.md). Builder and audio mix TBD (PI-ICNT-SW-1083) |
| `vo/` | Brian voice renderer, lexicon, voice settings and loudness target, credits log and estimates. Needs only `python3` and ffmpeg (PI-ICNT-SW-1080) |
| `verify/` | Repository hygiene check; render verification, OCR and captions TBD (PI-ICNT-SW-1082) |
| `brand/` | Course identity: `course.json` is the only definition of the fictional course for the pipeline (gate G1; proposal in `course-proposal.md`; `course.test.mjs` checks the guides' allowlists still accept it). Motion system, end card and music records TBD (PI-ICNT-SW-1081, PI-ICNT-SW-1083) |
| `episodes/` | One folder per episode (`episode.json`, `script.md`); see [`episodes/README.md`](episodes/README.md) |
| `approvals.md` | The owner approvals log |
| `requirements.txt` | Python packages for the venv at the media root |

## Tests

```bash
npm run test:video      # node --test over video/**/*.test.mjs
npm run test:video:py   # python3 -m unittest discover over video/**/test_*.py (compositor tests rerun themselves in the media-root venv)
```

Tests use committed fixtures with invented names only. They never open the real `sanitize.local.json`, `overlay.local.json` or `~/.claude.json`.

## Runbook

TBD (PI-ICNT-SW-1084): the end-to-end runbook for one episode, written from the pilot.
