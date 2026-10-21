# Delivery: the showcase film

Phase 5 of the showcase film. The deliverables are in `~/Documents/SpatialAdjust_MarCom/showcase/final/` (the media root,
never committed); this file is their manifest and the record of the checks run on them. Nothing in `video/edit/` or
`video/verify/` was changed or copied; the checks are the pipeline's, run as delivered, with its thresholds.

The gate decisions are in [`../approvals.md`](../approvals.md) (SC-EXPERT, SC-G6, SC-SOCIAL) and the questions for the
in-person review of 2026-10-22 in [`../../docs/review-agenda.md`](../../docs/review-agenda.md).

## Spec

| Item | Value |
|---|---|
| Picture | H.264 High, yuv420p, 1920x1080, constant 60 fps |
| Audio | AAC-LC, 48 kHz, stereo |
| Loudness | -14 LUFS integrated +/- 0.5, true peak at or below -1 dBTP (from `video/verify/verify.py`, not overridden) |
| Length | 60 to 120 s (`durationTarget` in `episode.json`) |

## Manifest

| File (in `showcase/final/`) | What it is | Size (bytes) | SHA-256 |
|---|---|---|---|
| `SpatialAdjust-showcase-16x9.mp4` | The master: the picture-locked cut (SC-G5 v2), 114.77 s | 73,041,969 | `43739ca9a15dec0b066f81480ce650d1d91e35c9227ab5158fd04e45ceb99573` |
| `SpatialAdjust-showcase-16x9.en.vtt` | English WebVTT captions: 20 cues for the 10 narration lines | 2,191 | `bd950df777a57cea398a543577bca6214ae23aa5b437e1c3c23a8fda0137d5c4` |
| `SpatialAdjust-showcase-transcript.txt` | Plain-text transcript of the narration, in film order | 1,310 | `7ed48016817d2380e2b4b97c7f8d21745ab037e7d33c3780c03f9d2f3a70971c` |
| `SpatialAdjust-showcase-poster.png` | Poster still, 1920x1080: the title card, "Double Click" over "From scan to water" (film time 7.5 s) | 1,412,312 | `40af109d819dbbd735e99fd1051deef19cbe41da7064f62d1d1e824c1cd481c4` |

## How each file was made

- **Master.** The picture-lock render of take 1001 in final mode (`render.py`, then `mix.py`, built by
  `build.py --final`; see [`edit-notes.md`](edit-notes.md)), copied byte for byte from
  `showcase/edit/picture-lock/showcase-take1001.mp4`. The picture was locked at SC-G5 with no change, so there is no
  second render: the master and the picture-lock file are the same bytes (the same SHA-256), and the timeline in
  `showcase/edit/timeline.json` is the one the picture-lock was built from.
- **Captions.** `python3 video/verify/captions.py --timeline <media>/showcase/edit/timeline.json --episode
  video/showcase/episode.json --report <media>/showcase/vo/render-report.json --out <final>/SpatialAdjust-showcase-16x9.en.vtt`,
  exit 0. The cues carry the written text of `episode.json` (never the lexicon's spoken form), at most two lines of 42
  characters, timed from the VO placements in the timeline.
- **Transcript.** The `text` of the ten `vo[]` lines of `episode.json`, in the order the timeline places them, under the
  title.
- **Poster.** `python3 video/edit/render.py --timeline <media>/showcase/edit/timeline.json --still 7.5 --out ...` with
  the pipeline's venv python; film time 7.5 s is the title card with its lines fully in and no cursor over them. A frame
  of the footage was the alternative (a frame at 36 s shows the map and table); the title card shows no data, so it
  cannot mislead as a still.

## Verification

Run 2026-10-21 on the master in `final/`, from the repository root, in final mode. The reports are in
`~/Documents/SpatialAdjust_MarCom/showcase/edit/final-checks/` (media root, not committed; kept out of `final/` so that
folder holds only the four deliverables).

| Check | Command | Result |
|---|---|---|
| Release gate | `python3 video/verify/verify.py --render <final>/SpatialAdjust-showcase-16x9.mp4 --timeline <media>/showcase/edit/timeline.json --episode video/showcase/episode.json` | exit 0, PASS (final): H.264 High, yuv420p, 1920x1080, constant 60 fps, AAC 48 kHz stereo; 114.77 s; -14.1 LUFS integrated, -1.5 dBTP true peak; 11 label holds met; 10 VO lines, none overlapping; no black frames; no frozen picture; music licence record present (original bed, gate G5 decided) |
| OCR denylist | `python3 video/verify/ocr_check.py --render ... --timeline ... --episode ...` | exit 0, 240 frames read (every 0.5 s plus after each label), 19 denylist terms, **0 hits** |
| Whisper round-trip, final mix | `$SA_VIDEO_PYTHON video/showcase/whisper-roundtrip.py --audio <final-mix 16 kHz mono wav from the master> --episode video/showcase/episode.json --timeline <media>/showcase/edit/timeline.json --model medium.en` | exit 0, **10 of 10 lines pass** (WER 0 to 0.062; IntelliDash, TurfRad and Lynx all heard, Lynx as "links", the homophone the check accepts) |
| Runtime | `ffprobe` and verify check b | 114.77 s, inside 60 to 120 s |
| Claims | `node video/showcase/check-claims.mjs --strict` | exit 0: 24 items (10 VO lines, 14 labels), 2 held, 0 failures, 0 warnings; `claims-check.md` up to date |

Three things the final checks needed, all in this repository's own tools, none a change to the picture or the voice:

- **Whisper on the mix, with each line at its placed time.** The ten line windows in `episode.json` were worked out for the
  stem; in the film the builder places each line on its cue, up to 0.44 s before its `windowIn`, so the first run of
  `whisper-roundtrip.py` on the mix (windows as written) put the first word of "Lynx itself must be set up ..." into the
  previous line's window. `whisper-roundtrip.py` gained `--timeline`, which moves each window to the line's placed time
  (same length); with it the stem and the mix are scored by the same rule.
- **`small.en` against `medium.en`.** With the vocabulary prompt on the music mix, `small.en` drops one clause of the "See"
  line ("station against its target. Map and table stay in sync"), scoring 9 of 10 (L3 fails at WER 0.48). The clause is in
  the audio: `small.en` without the prompt, and `medium.en` with it, both hear the whole line. The stem passes with
  `small.en` (10 of 10 on 2026-10-20). The round-trip's pass for the final mix is therefore `medium.en`; the `small.en`
  report is kept beside it (`whisper-report-small.json`) and the question for the experts is whether the line is clear to
  a listener with the music under it.
- **The OCR gate on a long film.** `ocr_check.py` as delivered builds one flat `select='eq(n,A)+eq(n,B)+...'` expression
  and ffmpeg's parser refuses one of about 100 terms or more, so it exited 2 ("Error while parsing expression") on the 115 s
  master (240 frames). The expression is now built in groups of 20 terms (`select_expr`), which parses at any length; the
  frames, the matching and the report are unchanged, and `test_ocr_check.py` has a test for it. This is a fix to the gate's
  frame extraction only; the pilot (28 s) was below the limit, so it never showed.

SHA-256 of the reports: `verify-report.json` `455c7aaf4627dd80d0631bb75c6d72d9ddeb3579f491d15518e290385e759192`,
`ocr-report.json` `edc6eeb34c48ba2f9526312007df7236869708452873512295f0efd31bea13aa`, `whisper-report-medium.json`
`c78a4a7c534b765b111af0a30db763ce30d46a010249ba78760a8b8d33c443b0`.

## Repository audit

Run 2026-10-21 on branch `e195-showcase` (worktree of the guides repository), after the commits above.

| Check | How | Result |
|---|---|---|
| Media in git | `npm run video -- hygiene` (media), plus `git ls-files` for media extensions | pass: no media file tracked now or anywhere in history; 0 tracked media files |
| ElevenLabs key | hygiene (key): tracked files, every commit's diff and message | pass |
| Tracker IDs | hygiene (tracker): tracked text files | pass |
| Claude attribution in the commits of this work | hygiene (attribution), `origin/main..HEAD` (23 commits) | pass |
| Claude attribution in all history | the same four patterns over every commit on every ref (281 commits) | **51 commits carry a `Claude-Session:` trailer. All 51 are in `origin/main`, on 10 days between 2026-09-04 and 2026-09-23, long before the showcase; none is from this work.** The hygiene check scans only `origin/main..HEAD`, so it never saw them |
| Real names | hygiene (denylist): tracked files, every diff, every message | **26 findings, all one denylisted name (reported by index only, #12), in `docs/text-corrections.md` and `src/transform-export.mjs`, in 13 commits: two on `main` (2026-09-07 and 2026-10-19) and eleven merge commits of 2026-10-20. The name is in neither file at `HEAD` (0 occurrences) and no commit of the showcase work has a finding.** The same 26 were reported before this phase |
| Site tests | `npm test` (build, then the full site suite) | pass: SMOKE PASS, 0 failed, 0 errors |
| Video tests | `npm run test:video`, `npm run test:video:py` (own `SA_MEDIA_ROOT`) | pass: 192 Node tests, 218 Python tests (9 skipped) |

Two findings are in history that was already on `origin/main`, so this phase did not rewrite it and cannot: removing
them means rewriting public history (commit messages for the 51 trailers, the two files' diffs for the name) and a force
push of `main`, which every other worktree and branch would then need rebased. That is the owner's call, and it is on the
review agenda. The acceptance line "no Claude attribution in git history" is met for everything this work added and not
met for the 51 older commits until the owner decides.

The `final/` folder stays on the owner's machine. Sharing outside the owner goes through Toro SharePoint or Teams, done
by the owner, never a public URL made from this folder. The guides site's embed is published by the site epic (E197),
which reads the master, captions, transcript and poster from here.

## Published

The master is too large for the site's showcase cap (73,041,969 bytes against 40,000,000), so the site ships a web
encode of it, made by `npm run media:add -- --key showcase` (two-pass 1080p H.264 High, AAC 128 kb/s, `+faststart`):
`showcase.mp4`, 37,388,518 bytes, SHA-256 `7b16fa8c651017e9d3ccb6e5c31ed64a80f52abfd520fdbd302d6bca5c12def2`, with a JPEG
poster made from the title-card still (`showcase.jpg`, 109,221 bytes). Both are assets of the GitHub Release `media-v2`
and are pinned in `src/media/manifest.json`; the English captions are `src/media/captions/showcase.en-us.vtt`, with the
ten translated cue catalogues in `src/i18n/captions/`. The master in `final/` is unchanged and stays on the owner's
machine; the release gate in this file was run on it, not on the web encode.
