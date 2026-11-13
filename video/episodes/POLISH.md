# Polishing an episode

The recipe used on `dashboard-overview` after the in-person review (the feedback is in `docs/review-2026-10-22-feedback.md`). It turns an existing `episode.json` into a re-voiced, re-captured, re-rendered episode. Run it from the repository root. Media only ever goes under the media root; never commit media.

## 1. Narration

- One idea per sentence, 5 to 14 words. Two short sentences beat one long one. No sentence needs a second breath.
- Each step says what it is, why it matters, what you should see: "The legend gives four bands. Each station takes its band's color, so you can see which stations are dry."
- Spoken order is on-screen order. Name a thing only when the cursor is on it, and say what it does in the same sentence.
- Plain American English. Contractions are fine ("You can't edit..."). No filler openers ("Next up", "Now let's"), no "simply", no "just".
- Verbs follow the product: **click** a row, a name, an area, a hole, a breadcrumb or a button (never "select" for a click); **tick** only a check box. In the table the row check box is the bulk-change pick, separate from clicking a row, which selects the station and moves the chart header. Say "selected" only for what the app itself labels so (the chart list's "4 holes selected" is a pick list, not a click). Scan: `video/episodes/review-2026-10-22-revoice.json` `selectMisuse`.
- Terms: **station** (never pin, head, sprinkler head), **modeled** (never fallback), **average** (never mean), **Lynx**, **percent adjustment** for "% Adj." Defaults are "only the starting point"; boundaries are "yours to change".
- Numbers as spoken words: "0 to 5 percent", "above 30". Keep demo values in range (targets 0 to 50, round numbers, no suggestions above about 150 percent).
- Only claims that are Verified in `docs/claims/claims.json`; every VO line lists them in `vo[].claims` (two at most). Do not state anything the guide does not (check by reading the guide step, not from memory).
- Length: a line is 2 to 9 s. About 70 to 80 s of speech per episode is the ceiling; the chapter cards, title and up-next cards add about 40 s that the template fixes.
- Pacing is made in the capture, not the voice: every beat ends 0.35 s after its line, and the cursor glides (0.75 s) to the next target before the next line starts, so each idea gets about a second of air.
- Chapter labels must equal the guide's rendered step titles (episode lint b).

Check the text before spending credits: `npm run video -- vo --episode video/episodes/<id>/episode.json --dry-run` (prints characters and how each line is spoken). Only changed lines are re-rendered.

## 2. Cursor and camera

How the camera follows (`video/edit/lib/dc_camplan.py`): the target of a beat is the full bounding box of every element it names, widened to include the cursor. While a box is live the camera fits that box into 90 percent of the view's width and 72 percent of its height (at least 5 percent clear on every side), so a wide target (the whole toolbar) sits near the window's rest scale and a small one zooms up to 2.7x. The view is centered on the box and is not clamped to the window's edge, so the plate may slide off-center rather than crop the target; the tilt is flattened while a box is live. With no box the camera follows the cursor. A gap under 1.4 s keeps the zoom; a box under 0.4 s is ignored. Camera moves are eased (critically damped, about 0.6 to 0.9 s, no overshoot). So:

- Every beat starts with a `frame` (invisible, camera only) on everything it names: the whole toolbar strip for "the toolbar", the table card plus its row for a row. When any `frame` box is live, only the `frame` boxes set the camera and the drawn `focus` boxes just mark the thing the voice is on. Name the container (a card, a strip), not one child of it. A beat needs no `vo`.
- The cursor must sit on the element while it is named. Start the glide at `word start - 0.8 s` (arrives 0.05 s early). Two targets named less than 0.8 s apart cannot both be met; reword.
- A click lands 1.0 s after the click action starts (0.75 s glide, then a 0.25 s dwell on the target before the press). To land at the end of a word, start it at `word end - 1.0 s`. The picture leads: the click lands, then the next line starts. The cursor glide is smootherstep (no jerk at either end) on a slightly curved path; the spotlight fades in and out over 0.4 s (section 9).
- Always `hover` then `focus` (the spotlight) on the thing named. For a control the camera should center on but the cursor is not on (a legend), add `frame` (invisible box, camera only).
- Dwell: the cursor rests on a target for the whole word and at least 0.5 s after it. Keep silent holds under 4 s.
- Variance and toggle controls: the cursor lands on the control itself (use the element, not its label).
- Every named thing must be in the camera's frame; check this with the contact sheet (section 6).

## 3. Capturing drill-downs and drags (recreation)

Source is the guide's recreation (`"source": "recreation"`, one lifted figure for the whole episode, `"recreationFigure"` = start of a figure caption). The app's interactive "live mode" exists only under the director, so the published site is unchanged (`src/transform-app.mjs`, `live()`).

- `recreationState` (episode.json) seeds the starting view (table level, trail, chart title and average).
- Targets are scoped with `[data-sa-frame] >> `, then `[data-sa-row="AP"]`, `[data-sa-station="3AP1"]`, `[data-sa-crumb="AP"]`, `[data-sa-handle="1"]`..`"3"`, `[data-sa-variance]`, or text selectors. Every hover, focus, click and drag `name` must equal the element's accessible name (its `aria-label`, else its text); a mismatch fails the rehearsal and prints the real name ("resolved to ..., expected ..."), so copy it from there. Elements with no text get an `aria-label` in live mode in the transform layer (legend handles, variance toggle, row switch). Never edit the `.dc.html` files.
- `allowClicks` lists the name of every click. Names that look like a write ("push", "save", "apply") are refused; the guard is never weakened.
- Drill-down: one beat per step. Hover and `focus` the row in the beat's start, `cue` the line, then `click` (lands 1.0 s later). The table, trail and chart header re-render at once; click a trail name to go back up.
- Drag: `{"type": "drag", "target": handle, "dx": px, "ms": 1100}` (recreation only). The cursor glides to the handle (0.75 s), presses, moves `dx` CSS px along an eased path over `ms`, holds 0.25 s, releases; the map recolors on release. Total `0.75 + 0.15 + ms/1000 + 0.25` s, release at the end minus 0.1 s. Use `frame` actions in the same beat so the camera stays centered on the legend and a few pins that will change.
- Reset what a beat changes with a silent return click (no `vo`) before the next chapter.
- Demo values come from the recreation; keep targets 0 to 50.

## 4. Music: the corporate bed and the calm bed

`video/edit/audio/music_bed.py --version v3` renders `sa-bed-v3-corporate`, the bed for the polished episodes (record `video/brand/music-v3.json`; `SA_MUSIC_JSON=$PWD/video/brand/music-v3.json`). In plain words: modern product-video music in the keynote manner, upbeat but unhurried. 96 BPM in 4/4, G major, one chord a bar through G, D, Em, C (the loop is those four, four times round, 16 bars); a warm sine pad with air, felt-piano chords on beats 1 and 3, a soft marimba motif on eighths (a new pattern each time round), a sine bass, and very light percussion (a muted kick on 1 and 3, a tick on 2 and 4, a quiet shaker), all low-passed with soft saturation (no saw or square). Two intro bars swell in under the title card; the outro is G, Am, D and then G ringing 8 s with a soft bell on the end card. It opens the outro on the loop's own first chord, so a loop wrap and the loop-to-outro splice are both 1.5 s crossfades (`track.xfade`) into the same G. `track.mix` is 7 dB under the voice and a further 6 dB while it speaks: measured per VO line the bed sits 12.4 to 15.9 dB under the voice (mean 13.1). A standalone 30 s preview of the bed alone is in the episode's renders folder (`sa-bed-v3-preview.wav` and `.mp3`).

```
$SA_VIDEO_PYTHON video/edit/audio/music_bed.py --version v3      # writes <media root>/music/sa-bed-v3.wav; sha256 is in music-v3.json
```

The calm bed (older, kept as an option):

`video/edit/audio/music_bed.py --version v2` renders `sa-bed-v2-calm`: 72 BPM, D major, no kick, clap, hats, shaker or arpeggio; a soft low-passed pad (two bars to a chord), a held sine bass, sparse soft plucks, a distant bell on chord changes, long reverb. The record is `video/brand/music-calm.json` (original synthesis, no third-party licence); `track.mix` asks the mixer for 8 dB under the voice and a further 6 dB duck while it speaks (the series bed is 3 and 9). Use it by setting `SA_MUSIC_JSON=$PWD/video/brand/music-calm.json` for `build`, `mix` and `verify`. `music.json` and `series.json` still name `sa-bed-v1`; which bed the series uses is the owner's decision, so leave `episode.json` `"music": "sa-bed-v1"` (episode lint h) and say in your report which bed you used.

```
$SA_VIDEO_PYTHON video/edit/audio/music_bed.py --version v2      # writes <media root>/music/sa-bed-v2.wav; sha256 is in music-calm.json
```

## 5. Commands, in order

```
export SA_VIDEO_PYTHON=<media root>/.venv/bin/python
node video/lib/episode-schema.mjs video/episodes/<id>/episode.json
npm run video -- vo --episode video/episodes/<id>/episode.json --dry-run
SA_VO_OUTPUT_FORMAT=mp3_44100_128 npm run video -- vo --episode video/episodes/<id>/episode.json   # the variable only if the account refuses mp3_44100_192 (HTTP 403)
$SA_VIDEO_PYTHON video/vo/word_times.py --episode video/episodes/<id>/episode.json --out <scratch>/vo_times.json
# write the beats from vo_times.json (section 2), then:
node video/lib/episode-schema.mjs video/episodes/<id>/episode.json
node video/capture/recreation.mjs --serve        # in the background, on a free port: SA_RECREATION_PORT=<port>; stop it afterwards
SA_RECREATION_PORT=<port> node video/capture/recreation.mjs --episode <id> --take <N> --dry-run
SA_RECREATION_PORT=<port> node video/capture/recreation.mjs --episode <id> --take <N> --no-record        # rehearsal: every target resolves
SA_CAPTURE_DSF=1 SA_CAPTURE_X264_PRESET=veryfast SA_RECREATION_PORT=<port> node video/capture/recreation.mjs --episode <id> --take <N>   # cheap 1080p look, minutes
SA_CAPTURE_X264_PRESET=veryfast SA_RECREATION_PORT=<port> node video/capture/recreation.mjs --episode <id> --take <N+1>                    # the real take, 4K, about 40 min
export SA_MUSIC_JSON=$PWD/video/brand/music-v3.json      # or music-calm.json
npm run video -- build --episode video/episodes/<id>/episode.json --take <N+1> --final --source recreation
npm run video -- render --timeline <media root>/episodes/<id>/edit/timeline.json
npm run video -- mix --timeline <media root>/episodes/<id>/edit/timeline.json
```

A take number is never reused: every real take is a new number. `--final` needs the gates G3, G4, G5 decided in `video/approvals.md`; use `--draft` to look while they are not.

## 6. Checks (all must pass; fix and re-render, do not waive)

```
node scripts/episode-lint.mjs http://localhost:<port>/ <id>                      # claims Verified, labels, highlights
$SA_VIDEO_PYTHON video/vo/whisper_check.py --episode video/episodes/<id>/episode.json   # every line "ok"
npm run video -- verify --render <mp4> --timeline <tl> --episode video/episodes/<id>/episode.json
npm run video -- ocr --render <mp4> --timeline <tl> --episode video/episodes/<id>/episode.json
npm run video -- captions --timeline <tl> --episode video/episodes/<id>/episode.json --report <media root>/episodes/<id>/vo/render-report.json
npm run video -- hygiene
npm run test:video && npm run test:video:py
```

`verify` gives -14 LUFS (plus or minus 0.5) and true peak at or below -1 dBTP, constant 60 fps, no VO overlap, no black or frozen frames.

Cursor and camera alignment by frames. The cursor and focus box of every frame are in `<media root>/episodes/<id>/capture/raw/take<N>-recreation-track.json` (`[t, x, y, a, ripple, focusBox]` per frame) and the cue times in `take<N>-recreation-log.json`. For each narrated word (its time from `word_times.py` plus the line's cue time) the cursor must be inside the named element's box. To see it, extract a frame at each word from the video-only render and tile them into a contact sheet:

```
ffmpeg -ss <t> -i <media root>/episodes/<id>/edit/_video/<name>-video.mp4 -frames:v 1 -vf scale=640:-1 <scratch>/<line>-<word>.png
```

Map take time to render time with the timeline's `plate` layers: `render t = plate.t0 + (take t - plate.src_in)`. Look for: cursor off the element, the element out of frame, a box that has not yet appeared, a map that did not recolor.

## 7. Gotchas

- Port: `SA_RECREATION_PORT` must be free; other workers hold 8124 and others. The director starts and stops its own server unless one already serves the same `dist/`.
- The `build.mjs` output (`dist/`) must be fresh before a take; transforms are in `src/transform-app.mjs`.
- Foreground `sleep` can be blocked; run long jobs in the background and poll the log.
- The ElevenLabs key is read by the scripts at run time from the place `npm run video -- estimate --live` proves; never print it.
- Credits: the account is shared; `npm run video -- estimate --live` before a series of renders.

## 8. Framing check, animation and brand (applies to every episode)

**Framing check (mandatory).** For every narrated beat, extract the frame at the middle of the beat from the video-only render and look at it (the contact sheet script in section 6 does one frame per key word). Reject, fix the `frame` boxes or the take, re-render: any named element cropped; the target more than about 10 percent off the frame's center; the toolbar, legend or any named element touching a frame edge; the cursor or click highlight outside the frame. Also look at the opening lockup, the title card, every chapter card, the up-next card and the end card. Check consecutive 60 fps frames around each camera move for a jump (no linear move, snap or overshoot).

**Animation.** Camera moves, cursor glides and the highlight are eased; cards and footage crossfade (`TL.crossfade`, 0.35 s: the incoming wall or plate ramps opacity 0 to 1 while the outgoing one runs 0.35 s longer underneath). The cursor rests 0.25 s on a target before each press. Capture-side easing is in `video/capture/director-runtime.js` (`smoother`), camera side in `dc_camplan.py`.

**Brand.** The title, chapter, up-next and end screens are Toro red (`WALL.screen` in `brand.py`; walls `card` and `hero`); the footage sits on the dark wall with a soft red glow. Type on red is white (4.8:1 against #E11837, AA); secondary type is near-black (4.1:1, large type only). The app's moisture-band colors in footage are untouched; only decorative blues changed (type cursor and strip fill are white now). Tokens, the plate and the bug are in `video/brand/motion-system.md`.

**Logo.** The Toro tile (`assets/toro-logo.svg`, the same file the guides header uses, never redrawn or recolored) sits on a white plate on the red screens: the lockup, the end card and a small corner bug (40 px tile, top-left of title-safe at (96, 54), fades with each footage shot). A new episode inherits all of it from `brand.py` and `cards.py` (`bug`, `lockup_assets`); nothing per episode. Missing, owner to supply: the approved reversed (white) Toro logo and the Toro clear-space and minimum-size rules. The white plate and its 0.25-of-tile-height padding are an interim stand-in.

**Run length.** Cards sit at the hold rule's floor (1.5 s + 0.3 s per word) so their time is fixed by the template; the lever left is the rule itself (`HOLD` in `brand.py`, `HOLD_BASE_S` and `HOLD_PER_WORD_S` in `episode-schema.mjs`, the doc and the tests move together). This round trimmed the lockup to 1.8 s and the title card to 5.4 s, and the beat gaps to 0.25 s.

**More gotchas.** Use a new `--take` number for every capture and keep the old ones. Stop only your own server by pid (`kill <pid>`); never `pkill -f` a pattern others share. Hover and click `name` must equal the accessible name, so regenerate names (`--no-names`, then read them from the running recreation) whenever the page text changes.

## 9. Audio chain, spotlight and map framing (take 6; applies to every episode)

**Voice quality (the "voice cutting out" report).** The take-5 stems had: a leaked burst of the next sentence's first syllable at the end of several raw TTS files (silence, then a rising burst in the last 50 ms) that the old trim kept and cut mid-sound; stems that ended at -12 to -16 dBFS in their last 10 ms (hard truncation, a click); heads that began mid-phoneme (-5 to -16 dB at the first sample); 10 ms linear fades; pauses of digital silence; levels equalised over the whole file including pauses, so the loudness of a line varied by 3 LU; and a music duck keyed on 10 ms word gaps (80 ms attack, 350 ms release) that made the bed pump between words. The chain now:
- API format `pcm_48000` (lossless, 48 kHz). Probed with the account's key: allowed `pcm_48000`, `pcm_24000`, `pcm_22050`, `pcm_16000`, `opus_48000_192`, `mp3_44100_128`; refused (HTTP 403, tier) `pcm_44100`, `wav_44100`, `mp3_44100_192`. The old `mp3_44100_128` had a 16 kHz low-pass and lossy artefacts. `render-brian.py` env override `SA_VO_OUTPUT_FORMAT` accepts `pcm_#####` or `mp3_#####_##`.
- Conditioning (`render-brian.py` `condition()`, settings in `CONDITION`): cut to the speech, snap to zero crossings, drop a stray head or tail phrase shorter than 0.15 s that sits behind a pause of 0.2 s or more, pad 0.06 s of true silence where a take starts or ends on speech, shorten internal pauses over 0.5 s, 50 ms raised-cosine in and 70 ms out, level so the BS.1770-gated K-weighted speech loudness equals `rms_target_dbfs`, soft-limit peaks to -1 dBFS (tanh knee at 0.6). `--relevel` re-conditions saved takes with no API call. `video/vo/audit.py` checks every line (head, tail, gaps, stray syllables, loudness spread at most 1.0 LU, peak, clipping); take 6: pass, spread 0.00 LU at -17.03 LUFS, all peaks at or below -1.3 dBFS.
- Mixer: the duck follows the voice envelope at 100 Hz with pauses under 600 ms bridged, 120 ms look-ahead, 200 ms attack and 1 s release, 150 ms smoothing (`build_audio.py` `vo_activity`, `brand.py` `LOUDNESS`). The bed no longer rises between sentences; it eases back over about 2.5 s after a line. Master -14 LUFS (verify allows 0.5), limiter ceiling -1.85 dBTP, AAC 256 kbps, 48 kHz.
- Take 6 evidence: VO stems -12.3 LUFS on every line; bed 12.4 to 15.9 dB under the voice per line; no music step over 5.6 dB per 0.5 s between 2 s and 128 s; splices of the bed show no sample step.
- Re-voicing: re-render with `npm run video -- vo`, then `whisper_check.py`, then rebuild `vo_times.json` and the beats (hover arrives by the word, clicks land at the end of the word, section 1).

**Spotlight, not a box.** The blue focus box and any blue click highlight are gone. `director-runtime.js` (`SPOT`, mirrored by `brand.py` `SPOTLIGHT` and checked by `test_brand.py`) dims the rest of the frame to 50 % black (60 % in take 6, 34 % in take 7; at 34 % a white panel read as a white glow rather than a lit cutout, so take 9 dims more and feathers less) with a 6 % darker vignette and leaves one rounded cutout with a 10 px feather over the union of the live, visible boxes, grown by 10 % of the longer side (12 to 44 px). A beat can focus several things (V4d: the clicked row and the chart header) and the one cutout covers their union. It fades over 0.4 s, follows a changing target with a 0.18 s time constant and is released between beats; `frame` boxes are hidden and only drive the camera. It is drawn in the page, under the cursor. A click presses the cursor to 0.86 inside the 0.25 s dwell (the click still lands 1.0 s after the action starts) with a faint white ripple. When the spoken subject is the whole map (V2a), focus the map card instead of one station so the course stays lit.

**Map sharpness and framing.** The capture was never soft (a 4K frame is crisp); the edit softened it: a depth-of-field blur on the plate's edge (now off: `dof=0`), the plate tilted while a box was live (now flat while a box is live; the one-degree drift stays because a frozen picture fails verify), and a 1080p encode at CRF 16 (final now CRF 14, preset slow). A chapter about one card can be cropped: `chapters[].crop` `[x0, y0, x1, y1]` in CSS px. The edit then floats only that card (here the map, `[10, 79, 1056, 1022]`), fits it to 78 % of the view's height, keeps its edges out of the frame while zoomed (the bottom edge stops above the chapter strip) and zooms to the legend at up to 2.7x the rest scale, where the 4K source is at or above 1:1. `tests/test_timeline.py` checks the framing; `renders/dashboard-overview-take6-sharpness.png` shows before and after.

**Wide toolbar beats (take 7).** The toolbar is a 1920 x ~100 px strip; framed with the whole app it was small in a dark frame. A chapter crop of `[0, 0, 1920, 800]` (the toolbar and the top of the app under it) floats only that strip, so the camera fits the strip and zooms to the site, weather and moisture frames (`cam` lists them).

**Hover and focus names are optional (take 7).** A `hover` or `focus` with no `name` skips the accessible-name check (a whole row's name is its cell text, a check box has none); `click` still requires the name.

**Circle placement (take 10).** Circles are not drawn by hand. `video/capture/recreation-map-field.py` classifies the backdrop (green-dominant, bright, smooth turf; tree canopy, path grey, sand and water fall out), keeps the large regions, takes ridges of the distance transform as fairway centrelines, and fills wide turf (greens, approaches) at a tighter spacing, so every centre is inside the mask. It writes `recreationMap.spots` and a debug overlay under the media root. Re-run it when the backdrop or `exclude` changes.

**The product's map look (take 8).** The guide site draws its own aerial (public repo: no real imagery in it). For the videos, an episode can set `recreationMap` and the capture lays the app's own Google satellite imagery under the recreation's map: `video/capture/recreation-map.mjs` reads the mosaic from `<media root>/map-backdrop/<file>` (a z19 mosaic of the tiles the product's map requests, fetched once; never in git) and answers it at `/__sa-backdrop.jpg` on GET only; `recreation-map.js` restyles the app's own pin and legend elements (so every selector and text target still resolves): Leaflet circles (2 px white outline at 0.4, band colour at fill opacity 0.5, percent and station name inside, labels scaled by 2^(zoom - 19) like the product), the compact legend with grey handles, the zoom buttons and the Leaflet / OpenStreetMap / Google Maps attribution, which stays visible. The map shows `total` circles (148, the table header's All Stations): the app's 24 pins plus generated ones, strung programmatically along `chains` (fairway centre lines, percent of the card) at an even spacing of about one circle diameter, with a little jitter, and in rings round `greens`, from a seeded generator so every run is the same. Each app pin snaps to the nearest spot, its `pins` x, y being only a hint. Generated circles keep their value and target in the page, recolour from the legend's live band numbers (so a handle drag or the variance toggle recolours all 148) and carry their label in CSS, so no text target collides with them. Names are fictional. The map card's accessible name changes with it (the attribution text), so the two `focus` actions on the map card carry no `name`.

**Take numbers.** Takes 1, 3, 5, 6, 7, 8 and 9 are kept; trials use 9xx. Take 9 is the 4K capture.
