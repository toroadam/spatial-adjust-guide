# Showcase film

The Spatial Adjust showcase: one film of 60 to 120 seconds that follows the chain from a soil
moisture measurement to the water Lynx puts down, captured from IntelliDash Demo Mode, framed by the
Spatial Adjust motion system and narrated in the Brian voice. It is built with the video pipeline
under `video/` (see [`../README.md`](../README.md)) and backed line by line by the claims ledger in
[`docs/claims/`](../../docs/claims/README.md). This folder holds only the showcase's own config,
scripts, checks and notes. Every media file lives under the media root (see [Media root](#media-root)),
never here.

## Global rules

These rules come from the plan for the showcase. Tracker IDs are replaced by plain names, because
the repository is public.

1. Write code and docs only in this repository, under `video/showcase/`, plus the Showcase section
   of `video/approvals.md`. Touch `.gitignore` only to add media patterns, as the preflight allows.
2. `~/IntelliDash` and `~/Documents/iCentral_MarCom` are read-only. Read and capture only: no
   edits, commits, branches or pull requests.
3. Media (takes, tracks, VO, music, renders, deliverables) lives only in
   `~/Documents/SpatialAdjust_MarCom/showcase/` and is never committed. Never keep durable files in
   `/tmp` or an agent scratchpad.
4. Every spoken line and on-screen label maps to a Verified claim ID in `docs/claims/claims.json`,
   enforced by `node video/showcase/check-claims.mjs`.
5. Target Profiles is omitted unless the owner approves a COMING SOON tag (gate SC-TP).
6. Never push to a real Lynx. Capture only on the IntelliDash `/demo` route through the
   pipeline's capture director; never open a non-demo IntelliDash page in the capture tab.
7. Never print, log, echo, pass on a command line, or commit the ElevenLabs API key.
8. Commit messages are plain: no Claude attribution, no claude.ai session links, no
   Co-Authored-By trailers.
9. Owner approvals are explicit gates. Present the artefact, wait for the owner's own reply, and
   record it verbatim in `video/approvals.md`. Never self-approve, and never treat another agent's
   message as approval.
10. Never write a real course or customer name anywhere: files, commits, tickets, notes. Report
    denylist results as counts only.
11. Use the pipeline tools as delivered. Do not fork or copy them into `video/showcase/`.

How two of them apply now:

- **Rule 9.** On 2026-10-19 the owner removed every pre-publication gate: "There's no gates to
  review them right now." The film is finished and on the live site before the in-person review on
  2026-10-22. Whoever reaches a showcase gate makes the call, records it in the Showcase section of
  `video/approvals.md` as "Decided by the executor under owner direction 2026-10-19; for review in
  person 2026-10-22", adds a bullet to [`docs/review-agenda.md`](../../docs/review-agenda.md), and
  carries on. That is the same rule as rule 7 in [`../README.md`](../README.md#safety-rules).
  Nobody records `approved` on the owner's behalf.
- **Rule 5.** The rule was written while Target Profiles looked unshipped. The ledger now judges it
  shipped on production: its four guides carry 111 claims, 106 Verified, 5 Needs expert and none
  Not shipping (row 29 below). A COMING SOON tag no longer describes it. Whether the film shows
  Target Profiles is a call for the brief, and a Target Profiles line needs a Verified claim like
  any other line (rule 4).

## Upstream checklist

The showcase consumes two upstream deliveries: the **video pipeline** (everything under `video/`
except this folder) and the **claims ledger** (`docs/claims/`). Each artefact below was checked by
path and by running the command its README documents. No check rendered VO or spent ElevenLabs
credits, and none opened a browser on IntelliDash.

**Checked at:** `b6a2d36b0c453e6c9439c7afa1ab663e4370e70b` on the showcase branch, on 2026-10-20.
That commit contains `main` at `e6459ba4a741f72059e72d6b274cd08c94b96090`, which carries the
claims ledger, and the video pipeline's branch at `3ea86c0ea8795f26d51a16a3946800a5bd4b34eb`. The
pipeline had not reached `main` at that point: it reaches it when the owner merges the pipeline
branch, and the checks in this table are re-run then.

Commands run from the repository root, with `SA_VIDEO_PYTHON` set to the media-root venv
(`~/Documents/SpatialAdjust_MarCom/.venv/bin/python`).

| # | Artefact | Path | Owner | Check command | Result | Checked at SHA |
|---|---|---|---|---|---|---|
| 1 | Pipeline README and dispatcher | `video/README.md`, `video/bin/sa-video` | video pipeline | `npm run video -- help` | present; exit 0, every subcommand listed as implemented | `b6a2d36` |
| 2 | Brian VO renderer | `video/vo/render-brian.py`, `video/vo/voice-settings.md`, `video/vo/lexicon.json` | video pipeline | `npm run video -- vo --help`; `python3 video/vo/render-brian.py --episode video/lib/fixtures/episode.valid.json --dry-run` (no network call, key not read, nothing written); header and `VOICE_CONFIG` read for voice and model | present; both exit 0. Voice `Gubgw9l4dtIoQA9YZHgx` (Brian), model `eleven_multilingual_v2`, 1 credit per character | `b6a2d36` |
| 3 | VO estimate | `video/vo/estimate.py` | video pipeline | `npm run video -- estimate --help` | present; exit 0 | `b6a2d36` |
| 4 | Compositor: timeline builder | `video/edit/build.py` | video pipeline | `npm run video -- build --help` | present; exit 0. Takes `--episode <path>` | `b6a2d36` |
| 5 | Compositor: renderer | `video/edit/render.py`, `video/edit/lib/` | video pipeline | `npm run video -- render --help` | present; exit 0. Takes `--timeline <json>` | `b6a2d36` |
| 6 | Compositor: audio mix and mux | `video/edit/mix.py`, `video/edit/audio/` | video pipeline | `npm run video -- mix --help` | present; exit 0. Takes `--timeline <json>` | `b6a2d36` |
| 7 | Verify gate | `video/verify/verify.py` | video pipeline | `npm run video -- verify --help` | present; exit 0. Takes `--episode <path>` | `b6a2d36` |
| 8 | OCR denylist check | `video/verify/ocr_check.py`, `video/verify/ocr.swift` (built to `<media root>/bin/sa-ocr`, present) | video pipeline | `npm run video -- ocr --help` | present; exit 0 | `b6a2d36` |
| 9 | WebVTT captions | `video/verify/captions.py` | video pipeline | `npm run video -- captions --help` | present; exit 0. Takes `--episode <path>` | `b6a2d36` |
| 10 | Capture director and its non-`/demo` refusal | `video/capture/director.mjs`, `gates.mjs`, `record.mjs`, `recreation.mjs`, `refusal.test.mjs`, `gates.test.mjs` | video pipeline | `node video/capture/director.mjs --help`; `node --test video/capture/refusal.test.mjs`; the entry-gate test in `gates.test.mjs` ("accepts only https://\<allowed host\>[/\<prefix\>]/spatialadjust/demo, exactly") runs in `npm run test:video` | present; `--help` exit 0, refusal self-test exit 0 (15 of 15 pass), entry-gate test passes. Takes `--episode <id\|file>` | `b6a2d36` |
| 11 | Fictional course overlay | `video/capture/course-overlay.js` | video pipeline | `node --test video/capture/course-overlay.test.mjs` (in `npm run test:video`) | present; pass | `b6a2d36` |
| 12 | Demo Mode safety audit | `video/capture/SAFETY.md` | video pipeline | `test -f video/capture/SAFETY.md` | present; exit 0 | `b6a2d36` |
| 13 | Motion system | `video/brand/motion-system.md`, mirrored by `video/edit/lib/brand.py` | video pipeline | `test -f`; `test_brand.py` in `npm run test:video:py` | present; pass | `b6a2d36` |
| 14 | Title, chapter and end-card generators | `video/edit/lib/cards.py` (`title_card`, `chapter_card`, `end_card`), `video/edit/gfx/render_gfx.mjs`, `video/brand/end-card.json` | video pipeline | `test_cards.py` and `test_end_card.py` in `npm run test:video:py` | present; pass | `b6a2d36` |
| 15 | Fictional course identity | `video/brand/course.json` | video pipeline | `course.test.mjs` in `npm run test:video` | present; pass | `b6a2d36` |
| 16 | Music bed | `video/brand/music.json`; the bed `<media root>/music/sa-bed-v1.wav` | video pipeline | `npm run video -- mix --check-music ~/Documents/SpatialAdjust_MarCom/music/sa-bed-v1.wav` | present; exit 0 (an original work, not an iCentral asset or the refused preview) | `b6a2d36` |
| 17 | Episode format | `video/episodes/README.md`, `video/lib/episode-schema.mjs` | video pipeline | `node video/lib/episode-schema.mjs video/lib/fixtures/episode.valid.json` | present; exit 0, prints `ok` | `b6a2d36` |
| 18 | Pilot episode | `video/episodes/dashboard-overview-pilot/` | video pipeline | `ls video/episodes/` | **not landed**: the pilot is the pipeline's last step and had not started. The showcase does not consume it: the field names come from row 17 | `b6a2d36` |
| 19 | Approvals log | `video/approvals.md` | video pipeline | `grep -E '^\| G[1-7] \|' video/approvals.md` | present; G1 course identity, G2 map approach and map still, G3 style frame, G4 end-card URL and G5 music are each `decided by executor` under the owner's direction; G6 and G7 belong to the pilot and are `pending` | `b6a2d36` |
| 20 | Media root guard | `video/lib/media-root.mjs`, `video/lib/media_root.py` | video pipeline | `node video/lib/media-root.mjs --check`; `python3 video/lib/media_root.py --check` | present; both exit 0, root `~/Documents/SpatialAdjust_MarCom` | `b6a2d36` |
| 21 | Repository hygiene | `video/verify/hygiene.mjs` | video pipeline | `npm run video -- hygiene` | present; exit 0, clean (media, key, denylist, attribution) | `b6a2d36` |
| 22 | Pipeline test suites | `video/**/*.test.mjs`, `video/**/test_*.py` | video pipeline | `npm run test:video`; `npm run test:video:py` | both exit 0. Node: 147 of 147 pass. Python: 176 run, OK, 1 skipped (the numpy parity check under the system `python3`; it passes in the media-root venv, 28 of 28 in `test_render_brian.py`) | `b6a2d36` |
| 23 | Claims ledger | `docs/claims/claims.json` | claims ledger | `node -e "JSON.parse(require('fs').readFileSync('docs/claims/claims.json','utf8'))"` | present; exit 0. 871 claims in 26 guides: 843 Verified, 28 Needs expert, 0 Wrong, 0 Not shipping, 0 Unverified | `b6a2d36` |
| 24 | Pinned sources and claim schema | `docs/claims/README.md`, `docs/claims/sources.json` | claims ledger | read | present. Production `1aa4f28622cc3cc9637f0d61a438bf16bcf01924` (confirmed 2026-10-19), develop and beta `bd39f465cf5a7ae0356a59825250b36044085714`. Schema in [Claim record](#claim-record) | `b6a2d36` |
| 25 | Ledger lint | `scripts/claims-extract.mjs` | claims ledger | `npm run claims:lint` | present; exit 0, 26 shards OK. The plan named `npm run test:claims`, which the ledger never defined (exit 1, "Missing script"); `claims:lint` is the check the ledger documents | `b6a2d36` |
| 26 | Ledger matches the published text | `scripts/review-pack.mjs` | claims ledger | `npm run review-pack -- --no-pdf --out <a folder outside the repository>` (refuses a stale ledger) | present; exit 0, not stale | `b6a2d36` |
| 27 | Push window claims | `docs/claims/claims.json` | claims ledger | count of claims whose text is the "Push window." or "Outside that window" sentence | present; 12 claims in 6 guides, **0 Verified**: all 12 are Needs expert, by design, until the experts answer Q1 to Q4 in [`operational-contract.md`](../../docs/claims/operational-contract.md) | `b6a2d36` |
| 28 | Lynx prerequisite claims | `docs/claims/claims.json` | claims ledger | count of `prerequisite` claims naming Lynx, by status | present; 10 Verified: `push-to-lynx/before/4`, `/6`, `/8`, `calculation-settings/before/3`, `minimum-threshold/before/5`, `push-failures/before/2`, `reviewing-changes/before/3`, `seasonal-profiles/before/2`, `suggested-adjustments/before/3`, `verify-results/before/3` | `b6a2d36` |
| 29 | Target Profiles claims | `docs/claims/claims.json` | claims ledger | count of claims in `target-profiles`, `creating-profiles`, `updating-profiles`, `seasonal-profiles`, by status | present; 111 claims: 106 Verified, 5 Needs expert, **0 Not shipping**. The plan expected Not shipping; Target Profiles is on production | `b6a2d36` |
| 30 | Operational contract | `docs/claims/operational-contract.md` | claims ledger | `test -f` | present; the push window and Lynx rules with questions Q1 to Q7 | `b6a2d36` |

### What the checklist means for the later phases

- **Everything the showcase runs is present and passes.** The builder, renderer, mixer, verify,
  OCR and captions tools all landed. Only the pipeline's pilot episode (row 18) had not, and
  nothing here waits for it.
- **The ledger check is `npm run claims:lint`,** not `npm run test:claims` (row 25).
- **The push window cannot be spoken or labelled as a fact.** Rule 4 needs a Verified claim, and
  every push window claim is Needs expert (row 27). A line about when to push needs the experts'
  answer first. The Lynx set-up has Verified claims to cite (row 28).
- **Target Profiles is shipping** (row 29, and rule 5 above).
- **Capture needs two local files the owner keeps out of git:** `video/capture/capture.local.json`
  (the dev host) and `video/capture/overlay.local.json` (the name maps). Neither existed in the
  owner's checkout on 2026-10-20, and the director refuses a Demo Mode take without the denylist
  (exit 5). Gitignored files reach a worktree as symlinks, never copies.

## Claim record

The plan described a claim as id, type, status and citation. The ledger's actual record, which
`check-claims.mjs` reads:

| Field | Meaning |
|---|---|
| `id` | `<guide-key>/<step>/<n>`, for example `push-to-lynx/before/4`. Positional: a re-extraction that inserts a sentence shifts the IDs after it, so compare `text` as well as `id` |
| `guide`, `step`, `field` | Where the sentence sits in the guide |
| `text` | The published sentence |
| `type` | `label`, `navigation`, `behaviour`, `calculation` or `prerequisite` |
| `status` | `Verified`, `Wrong`, `Not shipping`, `Needs expert` or `Unverified` |
| `evidence` | The citations (the plan's "citation"): IntelliDash `path:line` at a pinned SHA, or a section of the Toro user guide 373-1135 rev 02 |
| `note`, `question`, `developNote`, `correction` | Verifier's note, the expert question (Needs expert), what differs on develop, and the proposed wording (Wrong) |
| `previousText` | Optional: the wording before the sentence last changed |

`claims.json` is `{ "_meta": {...}, "claims": [...] }`; `_meta` carries the pinned SHAs and the
counts by status and type. Only `scripts/claims-extract.mjs` writes it.

## Episode config

The showcase has one config, `video/showcase/episode.json`, in the format of
[`../episodes/README.md`](../episodes/README.md). It is validated the same way:

```bash
node video/lib/episode-schema.mjs video/showcase/episode.json
```

Every pipeline tool that reads an episode takes its path explicitly, so the tools run as delivered
and nothing is forked:

| Tool | Argument |
|---|---|
| `npm run video -- vo` | `--episode video/showcase/episode.json` |
| `npm run video -- estimate` | `--episode video/showcase/episode.json` |
| `npm run video -- capture` | `--episode video/showcase/episode.json` (it accepts an id or a file) |
| `npm run video -- build` | `--episode video/showcase/episode.json --take <N>` |
| `npm run video -- verify` | `--episode video/showcase/episode.json` |
| `npm run video -- captions` | `--episode video/showcase/episode.json` |
| `npm run video -- ocr` | `--episode video/showcase/episode.json` (optional; it reads the id from the render path otherwise) |
| `npm run video -- render`, `npm run video -- mix` | `--timeline ~/Documents/SpatialAdjust_MarCom/showcase/edit/timeline.json`, the timeline `build` writes |

The tools write an episode's media to `<media root>/episodes/<id>/`, where `<id>` is the `id` in
`episode.json`. **The showcase's id is `showcase`,** and `~/Documents/SpatialAdjust_MarCom/episodes/showcase`
is a link to `../showcase`, so everything the tools write for the showcase lands in
`~/Documents/SpatialAdjust_MarCom/showcase/` (see [Media root](#media-root)).

Fields the schema enforces that matter here: `guide` must be a guide slug, every id in `claims` must
exist in the ledger, and from `script-locked` on every VO line cites at least one claim. `build
--final` also needs gates G3, G4 and G5 recorded in `video/approvals.md` (they are), a licensed
music track and the episode at status `script-locked` or later.

## Media root

The showcase's media lives in `~/Documents/SpatialAdjust_MarCom/showcase/`, inside the pipeline's
media root and never in git, `/tmp` or an agent scratchpad. The iCentral pipeline lost its v4
inputs to `/tmp` on 2026-10-06. The deliverables (captions, transcript, poster) are media too.

`~/Documents/SpatialAdjust_MarCom/episodes/showcase` is a link to `../showcase`. The pipeline writes
an episode's media to `<media root>/episodes/<id>/`, and the link makes that the same folder for the
episode id `showcase`. Both media-root guards resolve through it and accept it
(`episode_dir('showcase', 'vo')` gives `.../SpatialAdjust_MarCom/showcase/vo`). The shared folders
stay at the media root: `.venv/`, `bin/` (the OCR tool), `music/` (the bed), `auth/` and `logs/`.

The preflight created the nine planned folders on 2026-10-20. The pipeline tools create the rest
on first use.

| Subfolder | Contents | Written by |
|---|---|---|
| `capture/raw/` | Takes from Demo Mode: `take<N>.mp4` (3840x2160, 60 fps) with `take<N>-log.json` (cues), `take<N>-track.json` (cursor and focus), `take<N>_sheet.jpg` and `take<N>-safety.json`; recreation takes as `take<N>-recreation.mp4`. Never overwritten | Phase 4a, capture: `npm run video -- capture` |
| `capture/tracks/` | The cue logs and cursor and focus tracks of the takes chosen for the cut, copied from `capture/raw/` when a take is picked | Phase 4a, capture |
| `capture/review/` | Contact sheets and stills pulled from the takes for the capture decision | Phase 4a, capture |
| `vo/` | `<line>.wav` (48 kHz, 24-bit, mono, trimmed and levelled) and `render-report.json` | Phase 3, voice: `npm run video -- vo` |
| `vo/raw/` | `<line>.mp3` as ElevenLabs returned it, so a re-level spends no credits | Phase 3, voice: `npm run video -- vo` |
| `vo/masters-48k24/` | The locked VO masters (48 kHz, 24-bit), copied from `vo/` once the script and its check pass, so a later re-render cannot change the cut | Phase 3, voice |
| `edit/` | `timeline.json` and `edl.json` | Phase 4b, edit: `npm run video -- build` |
| `edit/music/` | The cut of the music bed the film uses, with the source path and SHA-256 of the bed it came from (`<media root>/music/sa-bed-v1.wav`, see `video/brand/music.json`) | Phase 4b, edit |
| `edit/_build/` | The edit phase's working files between builds, such as test stills of single cards | Phase 4b, edit |
| `edit/_video/`, `edit/_audio/` | Renderer and mixer intermediates (created by the tools) | Phase 4b, edit: `render` and `mix` |
| `edit/rough-cuts/` | Draft renders for the cut decision, one file per version | Phase 4b, edit |
| `gfx/` | Generated text graphics: title, chapter and end cards (created by the tools) | Phase 4b, edit |
| `frames/` | Frames sampled for OCR; deleted after a passing run (created by the tool) | Phase 5, delivery: `npm run video -- ocr` |
| `renders/` | Renders, `verify-report.json`, `ocr-report.json` and `showcase.en.vtt` (created by the tools) | Phase 4b (`render`, `mix`) and phase 5 (`verify`, `ocr`, `captions`) |
| `final/` | The deliverables: the 16x9 master MP4, the WebVTT captions, the transcript and the poster. The site embed publishes from here | Phase 5, delivery |

Git ignores showcase media as well. The rules in `.gitignore` that already cover `video/**`
(`*.mp4`, `*.mov`, `*.wav`, `*.mp3`, `*.m4a`, `*.aac`, `*.flac`, `*.webm`, `raw/`, `_video/`,
`_audio/`, `state.json`, `*.local.json`) apply here, so the preflight added none. Checked on
2026-10-20 by creating `video/showcase/_probe.{mp4,wav,mp3,mov,m4a,aac,webm}`, running
`git check-ignore -v` on each (every one matched a `video/**/*.<ext>` rule, exit 0) and deleting
them.

## Commands per phase

Placeholder: each phase fills in its own row when it runs, and replaces the planned command if it
differs.

| Phase | Step | Command | Status |
|---|---|---|---|
| Preflight | Upstream checklist and media root | the commands in the table above | done, 2026-10-20 |
| 1 | Brief and concept | `node video/lib/episode-schema.mjs video/showcase/episode.json`; `npm run video -- capture --episode video/showcase/episode.json --take 1 --dry-run`; `npm run video -- vo --episode video/showcase/episode.json --dry-run`; `npm run video -- estimate --episode video/showcase/episode.json` | done, 2026-10-20: all four exit 0 (see [Phase 1](#phase-1-brief-and-concept)) |
| 2 | Claims check | `node video/showcase/check-claims.mjs` (exit 1 on any failure or a stale `claims-check.md`; add `--strict` to fail on numbers too); `node video/showcase/check-claims.mjs --write` (regenerates the tables in `claims-check.md`); `node --test video/showcase/check-claims.test.mjs` (also in `npm run test:video`) | done, 2026-10-20: `--strict`, `--write` and a plain run exit 0 (24 items, 42 claim IDs, all Verified; 2 held); 28 tests pass (see [Phase 2](#phase-2-claims-check)) |
| 3 | Script, VO estimate and Brian voice | `npm run video -- estimate --episode video/showcase/episode.json`; `npm run video -- vo --episode video/showcase/episode.json --dry-run`, then without `--dry-run`; `python3 video/showcase/vo-stem.py --episode video/showcase/episode.json [--lock]`; `$SA_VIDEO_PYTHON video/showcase/whisper-roundtrip.py --audio ~/Documents/SpatialAdjust_MarCom/showcase/vo/showcase-vo-full-48k24.wav --episode video/showcase/episode.json --out ~/Documents/SpatialAdjust_MarCom/showcase/vo/whisper-report.json`; `python3 -m unittest video.showcase.test_vo_tools` (also in `npm run test:video:py`) | script locked 2026-10-20 (SC-G2); voice rendered, fitted and Whisper-checked 2026-10-20 (SC-G3), see [Phase 3](#phase-3-script-and-brian-voice) |
| 4a | Capture | `node video/showcase/capture-shots.mjs check`, `plans`, `run all`, then `python3 -I video/showcase/scan-takes.py`, `node video/showcase/capture-shots.mjs log` and `reel` | done, 2026-10-21: [Phase 4a](#phase-4a-capture) |
| 4b | Edit | `$SA_VIDEO_PYTHON video/showcase/assemble-take.py --take 1001`, then `build --episode video/showcase/episode.json --take 1001 [--draft \| --final]`, `render` and `mix` on the timeline it writes, `verify`; `node video/showcase/check-edit.mjs` | rough cut v1 and the picture lock rendered 2026-10-21: [Phase 4b](#phase-4b-edit) |
| 5 | Review and delivery | planned: `verify`, `ocr`, `captions` and `hygiene` | to be filled in by phase 5 |

## Phase 1: brief and concept

[`brief.md`](brief.md) is the creative brief, [`concept.md`](concept.md) the logline and the beat sheet, and
[`episode.json`](episode.json) the config seeded from the beat sheet: B0 title, the seven links of the chain as
chapters B1 to B7, B8 end card, 110.8 s planned, 10 VO draft lines of 196 words. The beat sheet is timed to the
builder as delivered (an 8.2 s open, a typed chapter card per chapter, a 5.0 s end card); `concept.md` says how.

**Extension fields.** `episode.json` follows the field names of the pilot episode and `../episodes/README.md`. What the
showcase adds is additive and read by no pipeline tool: at the top, `kind`, `plannedRuntime`, `approval`,
`targetProfiles` and `endCard`; on each beat, `kind`, `tcIn`, `tcOut`, `card`, `footage`, `shot`, `sources`,
`guideKeys`, `voLines`, `labels`, `claims` and `onScreen`; on one VO line, `pendingClaim`. The schema keeps unknown
fields (`z.looseObject` at every level), and a search of `video/` and `scripts/` finds no tool that reads any of these
names from an episode. The schema's own `label` on B1 to B7 is the chapter label, and `vo` names each beat's first VO
line; `voLines` lists all of them.

**Dry runs, 2026-10-20, at the commit that adds the beat sheet.** None started a browser, read the ElevenLabs key, sent
a request or wrote a file.

| Command | Result |
|---|---|
| `node video/lib/episode-schema.mjs video/showcase/episode.json` | exit 0: `ok video/showcase/episode.json (showcase, 9 beats, status draft)` |
| `npm run video -- capture --episode video/showcase/episode.json --take 1 --dry-run` | exit 0: valid, source demo, map policy restyle, 9 beats, 0 targets, about 80.5 s of take, "click guard: no clicks". The capture config was not found (needed for a real take, not for the dry run) |
| `npm run video -- vo --episode video/showcase/episode.json --dry-run` | exit 0: 10 lines, 1,165 characters, about 1,165 credits; the lexicon turns TurfRad, VWC, ET and Lynx into "Turf Rad", "V W C", "E T" and "Links" |
| `npm run video -- estimate --episode video/showcase/episode.json` | exit 0: 10 lines, 196 words, 1,165 characters, 2,330 credits with the retake factor of 2, about 72.1 s of narration |

The beat table and `episode.json` were compared line by line (ids, chapter labels, times, durations, guide keys and
sources, every guide key one of the 26, each card at least as long as its label needs, runtime between 60 and 120 s):
no difference.

**Gates.** SC-G1 (the brief and the concept, as written), SC-TP (Target Profiles: omitted; a COMING SOON tag would
misstate a shipped feature) and SC-CTA (the end card decided at G4: "Explore the Spatial Adjust Guides" and the guides
site) are recorded in the Showcase section of [`../approvals.md`](../approvals.md#showcase) as decided by the executor
under the owner's direction, and each call, with its question for the review, is on
[`docs/review-agenda.md`](../../docs/review-agenda.md). That settles rule 5's open question for now: the film omits
Target Profiles.

## Phase 2: claims check

[`check-claims.mjs`](check-claims.mjs) is the check behind global rule 4, and [`claims-check.md`](claims-check.md) the
evidence it generates: every VO line and on-screen label with its claim IDs, ledger status and citations, the lines
held for expert review, the not-claimable sweep and the change log from the concept's draft.

**Fields the check reads.** On top of the phase 1 extension fields:

| Field | Where | Meaning |
|---|---|---|
| `labels[]` | each beat | Every text the builder draws in the beat: `id`, `text`, `kind` (`title`, `chapter` or `brand`) and `claims[]`. A `brand` item may hold only a product or brand name, the series word, or the end-card copy decided at `endCard.approval`, and needs no claim |
| `comingSoon`, `approval` | a VO line or label | Accept a Not shipping claim: the text must say COMING SOON and `approval` must name a gate row whose Decision reads Approved. The film has none |
| `held[]` | top level | Draft copy held out of the film until its claims are Verified: `id`, `beat`, `text`, `claims[]` and `note` (the decision and the question for the review). Never narrated or shown; listed under Held for expert review. It replaces phase 1's `pendingClaim` |
| `targetProfiles`, `endCard` | top level | `targetProfiles.decision` `omit` makes any Target Profiles claim ID anywhere in the config a failure; `endCard.config` names the end-card copy brand items may carry |

The top-level `claims[]` must list exactly the IDs the items cite, so the episode schema's own check of VO claims sees
the same set.

**Gaps resolved (task 3).** The push window is held: all 12 push-window claims in the ledger are Needs expert, so B7
says the Verified Lynx set-up line instead, and the film ships without the window line, a call recorded for the script
gate SC-G2 and the review (see [Held for expert review](claims-check.md#held-for-expert-review)). The brief's key
message is held too, and B8 closes on `understanding-vwc/4/4`. `--strict` finds no number in any line or label outside
the end card's legal line. The ledger and the guide prose are not edited here: they belong to the claims ledger's
owner, and what the film needs from it is raised as a note on the phase 2 feature.

**Runs, 2026-10-20**, against `docs/claims/claims.json` at commit `d264376`:

| Command | Result |
|---|---|
| `node video/showcase/check-claims.mjs --strict --write` | exit 0: 24 items (10 VO lines, 14 labels), 2 held, 0 failures, 0 warnings; doc rewritten between its markers |
| `node video/showcase/check-claims.mjs` | exit 0: `claims-check.md` is up to date |
| `node --test video/showcase/check-claims.test.mjs` | 28 tests pass |
| `node video/lib/episode-schema.mjs video/showcase/episode.json` | exit 0: `ok video/showcase/episode.json (showcase, 9 beats, status draft)` |

## Phase 3: script and Brian voice

[`vo-script.md`](vo-script.md) is the timed narration: ten lines, 200 words, each with a window in film time, the
pronunciation lexicon for TurfRad, Lynx, VWC, ET and IntelliDash, and the fit, credits and Whisper results. The lines
themselves live in `episode.json`, which phase 3 extends:

| Field | Where | Meaning |
|---|---|---|
| `line` | each `vo[]` line | `L1` to `L10`, the numbering of `vo-script.md`. The ids (`vo-b1-hook` and so on) are unchanged, because the beats, the held lines and the claims check name them |
| `windowIn`, `windowOut` | each `vo[]` line | Seconds of the finished film the line must start and finish inside: from its chapter's footage plus the builder's 0.55 s lead (0.30 s on the end card) to the end of the beat's footage. The capture phase puts each line's cue inside its window |
| `ttsText` | each `vo[]` line | What `render-brian.py` sends to ElevenLabs: `text` with `video/vo/lexicon.json` applied. A record, not an input: the renderer never reads it, and `whisper-roundtrip.py` and `test_vo_tools.py` fail if it drifts from the lexicon. Pronunciation is changed in the lexicon, which belongs to the video pipeline |

**Tools.** Both read `episode.json`, write only under the media root and use the pipeline as delivered: the renderer
is run, and imported for its lexicon, never copied.

- [`vo-stem.py`](vo-stem.py) checks every rendered line (`vo/render-report.json`) against its window. With `--lock`,
  once every line fits, it copies the WAVs into `vo/masters-48k24/` with a `manifest.json` (SHA-256, seconds, text
  hash, voice, model, settings and commit), then places every master at its `windowIn` on silence the length of the
  film, with ffmpeg and no level change: `vo/showcase-vo-full-48k24.wav` (48 kHz, 24-bit, mono) and
  `vo/showcase-vo-REVIEW.mp3` (192 kbit/s). Exit 0 done, 1 a line missing or over its window, 2 configuration.
- [`whisper-roundtrip.py`](whisper-roundtrip.py) transcribes the stem (or, in phase 5, the final mix with `--offset`)
  with OpenAI Whisper on this machine, with word timestamps, cuts the words into lines by window (0.3 s before, 0.5 s
  after), and scores each line by word error rate against the written text after normalising both sides. A line
  passes at WER 0.2 or less with every scripted TurfRad, Lynx and IntelliDash heard (Lynx as "Lynx" or its homophone
  "links", which the report counts: Whisper writes "links" for Brian's Lynx at any model size). Whisper is
  given the film's vocabulary as its initial prompt; `--no-prompt` runs without it for comparison. Exit 0 every line passes, 1 a line fails, 2 configuration (including a stale `ttsText`).
- [`test_vo_tools.py`](test_vo_tools.py): 33 tests of both scripts' logic and of `episode.json` itself (ttsText
  against the lexicon, window gaps, the prompt), with no model, ffmpeg, key or media.

**Whisper install.** `openai-whisper` 20250625 was already in the media-root venv
(`~/Documents/SpatialAdjust_MarCom/.venv`, installed 2026-10-20 09:52 local time for another episode), and the
`small.en` model was already in `~/.cache/whisper/small.en.pt` (downloaded 2026-10-20 09:58), so this phase installed
nothing and downloaded nothing. On a new machine: `~/Documents/SpatialAdjust_MarCom/.venv/bin/pip install
openai-whisper`; the first run downloads the model (about 460 MB), the only network access the script makes. No
audio leaves the machine.

**Tool check, 2026-10-20,** on real Brian audio and not on the showcase: the pilot's three VO lines and the lexicon
check line (which says IntelliDash, TurfRad and Lynx), copied into a test media root
(`~/Documents/SpatialAdjust_MarCom/_tests/showcase-vo/`) and given windows. `vo-stem.py --lock` placed every master
sample-exactly at its `windowIn` (maximum difference 0.0, silence before each); `whisper-roundtrip.py` passed all four
lines (WER 0.000, 0.000, 0.000 and 0.103) and heard each of the three terms; `--no-prompt` also heard all three in
that line.

**Runs, 2026-10-20:**

| Command | Result |
|---|---|
| `node video/showcase/check-claims.mjs --strict --write`, then `node video/showcase/check-claims.mjs` | exit 0 both: 24 items, 10 VO lines (200 words) and 14 labels, 43 claim IDs all Verified, 2 held |
| `node video/lib/episode-schema.mjs video/showcase/episode.json` | exit 0: `ok video/showcase/episode.json (showcase, 9 beats, status script-locked)` |
| `npm run video -- estimate --episode video/showcase/episode.json` | exit 0: 10 lines, 200 words, 1,179 characters, about 73.0 s |
| `npm run video -- vo --episode video/showcase/episode.json --dry-run` | exit 0: 10 lines, 1,179 characters, about 1,179 credits |
| `npm run video -- vo --episode video/showcase/episode.json` (13:47 local time, after SC-G2) | **exit 1**: HTTP 403 `output_format_not_allowed`, "Output format 'mp3_44100_192' is only available on the Creator tier and above." The account the key now resolves to reports 30,000 characters remaining of a 30,000 limit; the renders at 09:29 to 09:53 the same day ran on an account with about 357,500. Nothing was rendered and no credits were spent; the renderer logged the run in `video/vo/credits-log.md` |
| `SA_VO_OUTPUT_FORMAT=mp3_44100_128 npm run video -- vo --episode video/showcase/episode.json` (19:43 and 19:44 local time) | exit 0: 10 lines rendered, 1,179 characters, 471 credits by the account's counter (30,000 to 29,529) |
| `python3 video/showcase/vo-stem.py --episode video/showcase/episode.json`, then `--lock` | first run: 7 of 10 fit (L1, L7 and L8 over their windows); after the retime 10 of 10 fit, 76.16 s of narration; masters, stem and review MP3 written |
| `~/Documents/SpatialAdjust_MarCom/.venv/bin/python video/showcase/whisper-roundtrip.py ...` | exit 0: 10 of 10 lines pass, WER 0 to 0.062, IntelliDash, TurfRad and Lynx heard (Lynx as "links") |
| `python3 -m unittest video.showcase.test_vo_tools` | 33 tests pass |

**The ElevenLabs account, and the format override.** The first render (13:47) was refused: `video/vo/render-brian.py`
asks for `mp3_44100_192`, the iCentral format, and the account behind the one ElevenLabs key in `~/.claude.json` is
below the Creator tier. Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22: the
renderer gained one default-off line, `SA_VO_OUTPUT_FORMAT`, and the showcase VO was rendered with
`SA_VO_OUTPUT_FORMAT=mp3_44100_128`. Voice, model, settings and lexicon are untouched, and the master is the same
48 kHz, 24-bit mono WAV. If the owner restores a Creator-tier key, re-rendering with `--force` and no override gives
the 192 kbit/s source; the timing may shift by a few hundredths of a second, so run `vo-stem.py` again.

**Retime.** The render ran long on L1 (0.24 s), L7 (0.69 s) and L8 (1.46 s), so B1, B6 and B7 got 0.6, 1.0 and 1.8 s more
footage (the film is 115.2 s, from 111.8 s) and every later time and the capture plan's `seconds` moved with them
(the last shot before the longer line holds longer). No wording changed.

## Phase 4a: capture

One accepted take per shot for every chain beat, B1 to B7: 26 shots, recorded through the pipeline's capture director
(`video/capture/director.mjs`, as delivered). The capture plan is the `capture` block of each beat in
[`episode.json`](episode.json): `source`, `why`, `route`, `takeSeconds`, `declaredClicks` and the beat's `shots`. A shot
is one guide page and one figure, so one director take; its `actions` are hovers, waits and focus boxes only, and the
VO cues are added from the beat.

**Source: every beat is `recreation`.** Decided by the executor under owner direction 2026-10-19; for review in person
2026-10-22. A Demo Mode take needs the owner to start the capture Chrome, sign in to the demo form by hand, and provide
the local capture config and name maps; an executor can do none of these, and no credential is asked for or stored. So
every beat is captured from the guide site's own recreation (the same call as the pilot), and each `why` says what Demo
Mode could replace. `declaredClicks` is empty on every beat, so no click fires in any take. Each take still runs with the
course overlay and the restyled map installed. Nothing in IntelliDash was opened.

**Safety preflight (2026-10-20).** `git fetch` on IntelliDash found `origin/develop` still at `bd39f465`, the commit
[`SAFETY.md`](../capture/SAFETY.md) audits, so its rules stand (recorded there). The director's 48 refusal, guarded-click,
overlay and gate tests pass (`node --test video/capture/refusal.test.mjs ...`). All 26 shots were rehearsed with
`--no-record` first: exit 0, no refusal, no aborted request.

**Commands.**

| Command | What it does |
|---|---|
| `node video/showcase/capture-shots.mjs check` | checks every capture block against the beat's footage, VO windows and the declared clicks; exit 0 clean |
| `... plans` | writes one director episode per shot under `<media root>/showcase/capture/plans/`, each schema-validated |
| `... run <shot\|beat\|all> [--attempt N] [--no-record]` | runs the director per shot; a take is `take<beat><shot><attempt>-recreation.mp4` and is never overwritten |
| `python3 -I video/showcase/scan-takes.py` | runs the pipeline's OCR gate (`video/verify/ocr_check.py`) on every take; counts only |
| `... capture-shots.mjs log` | writes [`capture-log.csv`](capture-log.csv): a row per take, with the director's safety counts and the OCR counts, and `accepted` on the last take of a shot that passes every check |
| `... capture-shots.mjs reel` | builds the review reel from the accepted takes, `<media root>/showcase/capture/review/showcase-capture-reel.mp4` (185 s, 1280x720) and `reel-index.csv` |

Run `plans` and `run` one shot per take number: b3 shot 2, attempt 1 is take 321.

**Results, 2026-10-21.** 26 takes, one per shot, all accepted at attempt 1: director exit 0, 0 refusals, 0 aborted
requests, 0 WebSockets, 0 documents after arming, 0 popups, the director's own DOM denylist scans 0 hits, and the OCR
gate (every 0.5 s, 383 frames across the 26 takes, the local denylist's seven terms) 0 hits. Each take is 3840x2160 at
60 fps and starts and ends on the director's magenta sync flash, which the builder finds and trims. A take of a
Demo Mode shot would also need `demoVerified` true in its safety report to be accepted; `capture-shots.mjs log` enforces it.

**Where the files are.** Raw takes, cue logs, cursor tracks, contact sheets and safety reports are in
`<media root>/showcase/capture/raw/`, the OCR reports and the reel in `capture/review/`. None is committed. The takes
run 128 s for 83.8 s of cut footage (pre-roll and handles included).

## Phase 4b: edit

The cut is made by the pipeline's compositor as delivered, pointed at [`episode.json`](episode.json); the numbers,
the edit grammar and every cut's notes are in [`edit-notes.md`](edit-notes.md). Three things are new in this folder:

| File | What it is |
|---|---|
| `assemble-take.py` | Joins the 26 accepted shot takes into one take for the builder, which cuts exactly one take: each shot from 0.55 s before its cue for its planned length, behind a magenta start flash, with a merged cue log and cursor track (`capture/raw/take1001-recreation.*` in the media root, a new take number for each cut). Take assembly only: no picture is scaled or re-timed, and the builder, renderer and mixer run unchanged. `--dry-run` prints the plan |
| `check-edit.mjs`, `check-edit.test.mjs` | Checks the `edit` block of `episode.json`: the title card, a chapter label for each of B1 to B7, a highlight on every beat from B2 to B7, the end card's copy against `video/brand/end-card.json` (gate SC-CTA), the music record and its SC-MUSIC row, and no red |
| `edit-notes.md` | What each cut is made of, what was seen in it, and the picture lock |

**Music.** Gate SC-MUSIC in [`../approvals.md`](../approvals.md) records the track (the original bed `sa-bed-v1`), library
(none, generated in code), licence type (original), licence reference, purchaser (none) and date. The file is only in
`~/Documents/SpatialAdjust_MarCom/music/`. The iCentral preview track is never used; `mix.py` refuses it.

**Renders.** `renders/showcase-take1001-DRAFT.mp4` (rough cut v1, also kept in `edit/rough-cuts/v1/`) and
`renders/showcase-take1001.mp4` (the locked picture, built with `--final`), both under
`~/Documents/SpatialAdjust_MarCom/showcase/`. Each has a verify report; the cut decisions are the SC-G5 rows.

A change to any on-screen text means `node video/showcase/check-claims.mjs --write`; a change to VO wording goes back
to phase 3 (script gate SC-G2, then a re-render of the voice).
