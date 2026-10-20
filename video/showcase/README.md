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
| 1 | Brief and concept | | to be filled in by phase 1 |
| 2 | Claims check | planned: `node video/showcase/check-claims.mjs` | to be filled in by phase 2 |
| 3 | Script, VO estimate and Brian voice | planned: `npm run video -- estimate --episode video/showcase/episode.json`, then `npm run video -- vo --episode video/showcase/episode.json --dry-run`, then without `--dry-run` | to be filled in by phase 3 |
| 4a | Capture | planned: `npm run video -- capture --episode video/showcase/episode.json --take <N>` | to be filled in by phase 4a |
| 4b | Edit | planned: `build`, `render` and `mix`, as in [Episode config](#episode-config) | to be filled in by phase 4b |
| 5 | Review and delivery | planned: `verify`, `ocr`, `captions` and `hygiene` | to be filled in by phase 5 |
