# Edit notes: the showcase cut

Phase 4b of the showcase film. The cut is made by the pipeline's compositor as delivered
(`video/edit/build.py`, `render.py`, `mix.py`, checked by `video/verify/verify.py`), pointed at
[`episode.json`](episode.json). Nothing in `video/edit/` or `video/verify/` was changed or copied. Renders and
intermediates are in `~/Documents/SpatialAdjust_MarCom/showcase/` (`edit/`, `renders/`) and are never committed.

Gate decisions are in [`../approvals.md`](../approvals.md) (SC-MUSIC, SC-G5) and the questions for the in-person review
of 2026-10-22 in [`../../docs/review-agenda.md`](../../docs/review-agenda.md). No cut was reviewed by a person before
this note was written: under the owner's direction of 2026-10-19 the executor decides each cut, and the experts and
the owner review the film on the live site.

## Edit grammar

The grammar is the iCentral hero's and the motion system's ([`../brand/motion-system.md`](../brand/motion-system.md)),
drawn by the builder:

| Part | How the cut gets it |
|---|---|
| Title card | The Spatial Adjust lockup (2.3 s), then the series word "Double Click" and the title "From scan to water" (5.9 s), music and effects only |
| Chapter labels | A typed chapter card for each of B1 to B7 (STATION BY STATION, MEASURE, SEE, SET THE TARGET, CALCULATE, REVIEW, PUSH TO LYNX), then a chapter strip along the bottom of the window with the active chapter lit |
| Window | The tilted window plate on the Spatial Adjust wallpaper, with a slow drift |
| Highlights | The capture director's focus box on the element being described, drawn in the design-system blue (#3079F0); there are no red boxes. 24 of the 26 shots carry one (the two Push dialog shots, b7-s2 and b7-s3, are overview shots) |
| Push-ins | The camera pushes in on each focus box and follows the cursor into the target (`dc_plan`) |
| Music | The original bed `sa-bed-v1` (gate SC-MUSIC), re-cut on its bar grid, 3 dB under Brian and ducked a further 9 dB while he speaks |
| End card | The Toro and Spatial Adjust lockup, "Explore the Spatial Adjust Guides", the URL pill `toroadam.github.io/spatial-adjust-guide` and the legal line, from `video/brand/end-card.json` (gate SC-CTA) |
| Master | -14 LUFS integrated, true peak at or below -1 dBTP, H.264 High 1920x1080 at 60 fps, AAC 48 kHz stereo |

[`episode.json`](episode.json) carries all of this in its `edit` block, and `node video/showcase/check-edit.mjs`
checks it (the title card, one chapter label for each of B1 to B7, a highlight on every beat, the end card's copy
against `end-card.json`, and the SC-MUSIC and SC-CTA rows).

## How the shots became one take

The builder cuts one take, and the capture phase recorded 26, one per shot. `assemble-take.py` joins them in film
order into take 1001 (`<media root>/showcase/capture/raw/take1001-recreation.mp4`, with its cue log, cursor track and
`-assembly.json` shot map): a 0.3 s magenta start flash, then each shot from 0.55 s before its cue for its planned
length, then a short tail. Picture and cursor track shift together; nothing is scaled, retimed or re-framed. The cut
points inside a chapter are hard cuts between shots. Re-run it with the next take number for each new cut.

```bash
export SA_VIDEO_PYTHON=~/Documents/SpatialAdjust_MarCom/.venv/bin/python
$SA_VIDEO_PYTHON video/showcase/assemble-take.py --take 1001
$SA_VIDEO_PYTHON video/edit/build.py --episode video/showcase/episode.json --take 1001 --draft    # or --final
$SA_VIDEO_PYTHON video/edit/render.py --timeline ~/Documents/SpatialAdjust_MarCom/showcase/edit/timeline.json
$SA_VIDEO_PYTHON video/edit/mix.py --timeline ~/Documents/SpatialAdjust_MarCom/showcase/edit/timeline.json
python3 video/verify/verify.py --render <mp4> --timeline <timeline.json> --episode video/showcase/episode.json [--draft]
```

## Cut v1, rough cut (draft mode)

Built 2026-10-21 from take 1001. File: `showcase/renders/showcase-take1001-DRAFT.mp4`, kept with its timeline and
verify report in `showcase/edit/rough-cuts/v1/`.

| Number | Value |
|---|---|
| Length | 114.76 s (target 60 to 120 s; planned 115.2 s) |
| Loudness | -14.1 LUFS integrated, -1.5 dBTP true peak |
| Format | H.264 High, yuv420p, 1920x1080, constant 60 fps, AAC 48 kHz stereo |
| Render time | 20 min 15 s for 6,886 frames, while three other renders ran on the machine |
| verify.py (draft) | PASS: format, duration, loudness, label holds (11 labels), VO overlap (10 lines), black frames, frozen frames; the music licence check runs only on a final |

Where the builder put things (seconds of the film):

| Chapter | Footage in | out | VO line starts | ends |
|---|---|---|---|---|
| Station by station | 11.22 | 18.82 | 11.77 | 18.46 |
| Measure | 21.06 | 31.06 | 21.61 | 28.37 |
| See | 33.22 | 44.02 | 33.77 | 43.68 |
| Set the target | 46.96 | 54.96 | 47.51 | 54.30 |
| Calculate | 57.24 | 73.74 | 57.79 and 67.54 | 67.22 and 72.59 |
| Review | 75.96 | 87.56 | 76.51 | 87.25 |
| Push to Lynx | 90.46 | 109.76 | 91.01 and 103.76 | 103.22 and 108.82 |
| End card | 109.76 | 114.76 | 110.06 | 113.58 |

Notes from watching v1 (stills at every 4.8 s, and six full-size frames):

- The VO lines start 0.08 s (the first) to 0.44 s (the last) before the `windowIn` times in `episode.json`. Those
  windows were worked out from the concept's card lengths (3.1 s, 2.3 s, ...); the builder's own cards are a little
  shorter, so the film is 114.76 s, not 115.2 s. Every line ends well inside its `windowOut`, none overlaps another,
  and each starts on its own cue, so picture and voice stay in sync. The windows are not a pipeline check.
- Every chapter card, strip entry, title and end-card line reads as `episode.json` and `end-card.json` say.
- The highlight boxes are blue; no red appears outside the lockup tile and the app's own 0-5 % band and pin colours.
- The camera pushes in hard on the narrow targets (the Minimum Threshold field, the Push Changes counter). The text
  stays sharp because the take is 4K.
- The Push dialog shots (b7-s2, b7-s3) are wide, so the dialog's text is small on a phone. They are overview shots.
- The Soil Factor Editor, in B4, shows the app's own Save button on screen. The shot is the guides' recreation and no
  click fires; the VO says nothing is saved.
- The seams between shots inside a chapter are hard cuts with the cursor jumping to the next target.

## Picture lock

See the SC-G5 rows in [`../approvals.md`](../approvals.md): v1 is the rough cut; the picture is then locked
unchanged and rendered in final mode, which also checks the music licence record, as the master.
