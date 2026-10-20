# video/verify port log

The release gate under `video/verify/` is ported from the iCentral MarCom video pipeline. This file is its provenance record, in the same form as [`../edit/NOTES.md`](../edit/NOTES.md): each ported file, where it came from, how long the source was, the source's modification time when it was read, and every deliberate change.

The iCentral folder is a read-only source and its tools were changing on the day of the port. Only code was taken; no media, font or other asset was copied.

## Ported files

| Source (iCentral MarCom path) | Lines | Source modified | Target | Changes |
|---|---|---|---|---|
| `~/Documents/iCentral_MarCom/06-edit/compositor/tools/verify.py` | 173 | 2026-10-04 17:18:06 | `verify.py` | Rewritten as a gate for one render: `--render --timeline --episode [--draft]` instead of every rough cut in the iCentral folder, a report of checks a to h (`{pass, mode, checks: [{id, name, status, pass, detail, values}]}`) at `<media root>/episodes/<id>/renders/verify-report.json`, and exit 1 on any failure (the source only printed). Format, duration and loudness keep the source's measurements (ffprobe, `ebur128=peak=true`) and gain pass/fail limits from `BRAND` (`lib/brand.py`): 1920x1080, constant 60 fps, H.264 High, yuv420p, AAC 48 kHz stereo, -14 LUFS +/- 0.5, true peak at or below -1.0 dBTP, the duration inside `episode.durationTarget`. Holds: the source simulated each word's opacity with the engine's easing (numpy); the port checks each timeline label's `tin` to `tout` against `brand.min_hold`, the rule `cards.py` and the episode schema already enforce, so it needs no numpy. Black frames: the source's mean and standard-deviation test on 192x108 frames is replaced by ffmpeg `blackdetect` (d 0.1, pix_th 0.05), allowed in the first and last 0.2 s and on layers marked `intentional`. New: VO overlap (the `dc_build.py:137-139` rule, 0.15 s), frozen frames (`freezedetect`, n 0.001, d 1.5, allowed inside label holds and declared holds) and the final-mode music licence check (gate G5 via `edit/lib/approvals.py`). Dropped: the review contact sheets (`sheet`, `frame_png`, which wrote `_tmp.png` beside the renders), push-in smoothness and the hero's "new UI by 0:04" check, which were specific to the iCentral hero cut. ffmpeg comes from `edit/lib/ff.py`, so a temporary or scratchpad build is refused; the render and the report must be under the media root. |
| `~/Documents/iCentral_MarCom/06-edit/compositor/tools/ocr/ocr.swift` | 10 | 2026-10-05 14:25:42 | `ocr.swift` | Provenance and usage header. Prints one JSON object per image (`{file, lines, alternates}`, or `{file, error}`) instead of tab-separated `file<TAB>line` rows, so a line holding a tab or a newline cannot break parsing; a failed image is reported and sets exit 1 instead of a silent `ERROR` row and exit 0. Recognition stays `VNRecognizeTextRequest` at the accurate level without language correction, and adds `recognitionLanguages = ["en-US"]`. Each image is read once per `--min-text-height` (default `0.03125,0.008`: Vision's default and about 9 px at 1080) and the readings are merged, with each observation's second and third candidates as `alternates`: on Golos UI test cards at 1920x1080, 11 to 14 px text was misread differently in each setting, so reading twice catches names one reading garbles. Compiled by `ocr_check.py` to `<media root>/bin/sa-ocr` (the source kept its binary beside the script, in the iCentral tools folder). |
| `~/Documents/iCentral_MarCom/06-edit/compositor/tools/d28_ocr.py` | 33 | 2026-10-06 13:35:18 | `ocr_check.py` | Rewritten as a gate for one render. Frames go to `<media root>/episodes/<id>/frames/ocr/` and are deleted after a pass (unless `--keep-frames`) and kept after a failure; the source extracted them into a fresh system temporary folder (`tempfile.mkdtemp`), which this port must never do. Sampling: every `--every` seconds (default 0.5) plus 0.5 s after each timeline label's `tin`, extracted by one ffmpeg `select` pass as PNG (the source used `fps=1/step` JPEGs). The source's hard-coded `BAD` regex of iCentral demo terms and its `GOOD` collector are replaced by `load_local_maps().denylist` (`video/lib/local_maps.py`), matched after NFKC, casefold and whitespace collapsing: terms of 6 or more characters as a substring and within edit distance 1 (Sellers' algorithm, with a pigeonhole prefilter), shorter terms as exact whole words. Reports `{t, index}` per hit and prints `[denylisted #N] at <t> s`; the source printed and stored the matching OCR lines, which here could be real names. Exit 0 pass, 1 hit, 2 cannot run (including an empty denylist, which would pass vacuously), 3 OCR unavailable (not macOS, or no binary and no swiftc). |

## New files

| File | Purpose |
|---|---|
| `test_verify.py` | ffmpeg-generated clips (testsrc2 and a 997 Hz stereo tone at a known level) under `<media root>/episodes/_test/verify/`: one clip passes every check; failing cases for loudness, a short label hold, a black gap, frozen frames, a VO overlap, the format, the duration target and final mode without gate G5 or a `licenceRef`; a report or render under `/tmp` exits 2. Parsers and interval maths are tested without media. |
| `test_ocr_check.py` | The matcher (exact, edit distance 1 against a brute-force check, whole-word short terms), frame sampling, exit 3 when not on macOS or without swiftc and a binary, and two 2 s clips under `<media root>/episodes/_test/renders/` made from text cards: the one showing a fixture name from `video/lib/fixtures` fails with `[denylisted #N] at 1.xx s` and keeps its frames; the clean one passes and deletes them; the name never appears in stdout, stderr or the report; an empty denylist and a render under `/tmp` exit 2. |
| `fixtures/text_card.swift` | Test helper: draws one line of text in a font file (Golos UI from `_ds`) on a light card and writes a PNG. The pipeline's ffmpeg has no `drawtext` filter (no libfreetype), so the OCR test draws its fixture text with AppKit instead. Compiled by the test into `<media root>/episodes/_test/bin/`. |
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
