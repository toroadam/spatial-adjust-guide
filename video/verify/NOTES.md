# video/verify port log

The release gate under `video/verify/` is ported from the iCentral MarCom video pipeline. This file is its provenance record, in the same form as [`../edit/NOTES.md`](../edit/NOTES.md): each ported file, where it came from, how long the source was, the source's modification time when it was read, and every deliberate change.

The iCentral folder is a read-only source and its tools were changing on the day of the port. Only code was taken; no media, font or other asset was copied.

## Ported files

| Source (iCentral MarCom path) | Lines | Source modified | Target | Changes |
|---|---|---|---|---|
| `~/Documents/iCentral_MarCom/06-edit/compositor/tools/verify.py` | 173 | 2026-10-04 17:18:06 | `verify.py` | Rewritten as a gate for one render: `--render --timeline --episode [--draft]` instead of every rough cut in the iCentral folder, a report of checks a to h (`{pass, mode, checks: [{id, name, status, pass, detail, values}]}`) at `<media root>/episodes/<id>/renders/verify-report.json`, and exit 1 on any failure (the source only printed). Format, duration and loudness keep the source's measurements (ffprobe, `ebur128=peak=true`) and gain pass/fail limits from `BRAND` (`lib/brand.py`): 1920x1080, constant 60 fps, H.264 High, yuv420p, AAC 48 kHz stereo, -14 LUFS +/- 0.5, true peak at or below -1.0 dBTP, the duration inside `episode.durationTarget`. Holds: the source simulated each word's opacity with the engine's easing (numpy); the port checks each timeline label's `tin` to `tout` against `brand.min_hold`, the rule `cards.py` and the episode schema already enforce, so it needs no numpy. Black frames: the source's mean and standard-deviation test on 192x108 frames is replaced by ffmpeg `blackdetect` (d 0.1, pix_th 0.05), allowed in the first and last 0.2 s and on layers marked `intentional`. New: VO overlap (the `dc_build.py:137-139` rule, 0.15 s), frozen frames (`freezedetect`, n 0.001, d 1.5, allowed inside label holds and declared holds) and the final-mode music licence check (gate G5 via `edit/lib/approvals.py`). Dropped: the review contact sheets (`sheet`, `frame_png`, which wrote `_tmp.png` beside the renders), push-in smoothness and the hero's "new UI by 0:04" check, which were specific to the iCentral hero cut. ffmpeg comes from `edit/lib/ff.py`, so a temporary or scratchpad build is refused; the render and the report must be under the media root. |

## New files

| File | Purpose |
|---|---|
| `test_verify.py` | ffmpeg-generated clips (testsrc2 and a 997 Hz stereo tone at a known level) under `<media root>/episodes/_test/verify/`: one clip passes every check; failing cases for loudness, a short label hold, a black gap, frozen frames, a VO overlap, the format, the duration target and final mode without gate G5 or a `licenceRef`; a report or render under `/tmp` exits 2. Parsers and interval maths are tested without media. |
| `__init__.py` | Package marker so `npm run test:video:py` (`unittest discover -s video`) finds the tests here. |

## Timeline keys the gate reads

The builder (PI-ICNT-SW-1083) writes the timeline; these are the keys `verify.py` relies on, so a builder change that renames one must change the gate too.

| Key | Shape | Used by |
|---|---|---|
| `duration` | seconds | b, d (labels clamp to it), e |
| `labels` | `[{text, tin, tout, kind}]` | d (hold rule), g (each label's `tin` to `tout` is a declared hold) |
| `vo` | `[[line id, t0], ...]` | e, with `lines[].seconds` from the VO render report |
| `music` | `{..., licenceRef}` or `null` | h |
| `holds` (optional) | `[[t0, t1], ...]` | g: other stretches where a still picture is intended |
| `layers[].intentional` (optional) | `true`, or a list naming `"black"` and/or `"freeze"`, with the layer's `t0` and `t1` | f and g |
