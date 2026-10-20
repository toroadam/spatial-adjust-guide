# Motion system: Spatial Adjust videos

**Feature:** PI-ICNT-SW-1081 · **Gate:** G3, style frame, in [`../approvals.md`](../approvals.md) · **Code:** [`../edit/lib/brand.py`](../edit/lib/brand.py)

The look of every Spatial Adjust video: the lockup, colour, background, type, motion, holds, layout, cursor and highlight, and sound. It replaces the iCentral MarCom motion system for this series. The structure (eased camera on real UI, a window floating on a soft wall, crisp kinetic type, no people) carries over; the identity changes: the Spatial Adjust lockup instead of the iCentral one, Oasis neutrals with the moisture-band colours as accents instead of the red wave, design-system blue where iCentral used red, and golf framing allowed, because Spatial Adjust is a golf product.

`brand.py` is the single code source for these values: `BRAND` mirrors this page value for value, and `theme.py` applies it with `THEME.update(BRAND)`, so the engine, the walls, the cards and the chapter strip all draw from it. The first column of each table below is the `brand.py` key. `video/edit/tests/test_brand.py` fails when this page and `brand.py` disagree, when a colour drifts from the design tokens (`_ds/.../tokens/figma/fig-tokens.css`) or from the app's moisture legend, or when red appears anywhere but the lockup tile and the 0-5 % band.

**Status.** Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22 (gate G3, with the style frame in [`style-frame-notes.md`](style-frame-notes.md)). The questions for the review are in [`docs/review-agenda.md`](../../docs/review-agenda.md).

All sizes are output pixels at 1920x1080, 60 fps.

## 1. Lockup

The Spatial Adjust lockup is the product's own header logo (`assets/sa/sa-header-logo.png`): the Toro tile followed by the words "Spatial Adjust".

| Key | Value |
|---|---|
| `tile` | `assets/toro-logo.svg`: the Toro red tile with the white TORO wordmark, 123 x 82 (aspect 1.5), drawn as vector so it is sharp at any size |
| `wordmark` | "Spatial Adjust" in Golos UI Bold (700), tracking 0 em: the header logo is Golos UI 700 at 40 px on a 63 px tile (measured: cap height 28 px, ink and width match within 1 %) |
| `font_ratio` | 0.635: wordmark font size / tile height |
| `gap_ratio` | 0.35: gap from the tile's right edge to the ink of the S / tile height |
| `tile_open` | 150 px tile on the opening lockup moment |
| `tile_end` | 104 px tile on the end card |
| `color_dark_wall` | #F5F7F8 wordmark on the dark wall; #080D12 on light surfaces |

The wordmark's capitals are centred on the tile. The tile is never recoloured, outlined, cropped or set on red. Red appears in the lockup tile only (and in the 0-5 % moisture band when the data on screen shows it; see Palette).

## 2. Palette

Oasis neutrals carry the frame; the moisture-band colours are the accents; design-system blue marks the element being described. Every value is a token in `fig-tokens.css` except the 6-19 % yellow, which is the app's own legend colour and has no token.

| Key | Hex | Token | Use |
|---|---|---|---|
| `gray100` | #080D12 | `--100` | text on light surfaces; the darkest wall tone |
| `gray90` | #1B1E21 | `--90` | wall, top of the gradient |
| `gray80` | #33393D | `--80` | wall, lifted centre |
| `gray70` | #4C5459 | `--70` | page-peel back face |
| `gray60` | #646E73 | `--60` | secondary text on light surfaces |
| `gray50` | #848E94 | `--50` | spare neutral |
| `gray40` | #A2ADB2 | `--40` | contour lines on the wall |
| `gray30` | #BCC6CC | `--30` | muted text on the dark wall: tags, the legal line |
| `gray20` | #D9DFE2 | `--20` | hairlines on light surfaces |
| `gray10` | #ECEFF1 | `--10` | light background fallback |
| `gray05` | #F5F7F8 | `--05` | text on the dark wall |
| `white` | #FFFFFF | `--white` | episode titles, chapter strip names, click ripple |
| `blue` | #3079F0 | `--informative-02` | the highlight: focus box, chapter strip active fill, URL pill dot, typewriter cursor; the > 30 % band |
| `blue_tint` | #66A1FF | `--informative-01` | blue glow on the wall |
| `blue_shade` | #2165DB | `--informative-03` | deep blue on the wall |
| `green` | #42CE11 | `--positive-02` | the 20-30 % band; green bloom on the wall |
| `yellow` | #F3D43B | (app legend) | the 6-19 % band; yellow bloom on the wall |
| `red` | #E11837 | `--base` | Toro red: the lockup tile and the 0-5 % band, nothing else |
| `red_shade` | #C91E38 | `--shade` | not drawn; kept so the token check covers the Toro red family |
| `red_tint` | #FA5069 | `--tint` | not drawn; kept so the token check covers the Toro red family |

**Moisture bands.** The four bands as the guides show them: the colours of the app legend (`SpatialAdjustApp.dc.html:315`) and the boundaries as the guides correct them (`src/transform-app.mjs`, the product's range-2 boundary of 19; the raw app file still says 6-16 % and 17-30 %).

| Band | Colour |
|---|---|
| 0-5% | #E11837 |
| 6-19% | #F3D43B |
| 20-30% | #42CE11 |
| > 30% | #3079F0 |

Accents are for data emphasis: a band colour appears next to, or on, the data it describes. The variance view's own palette appears in footage only, never as a brand accent.

**Roles.**

| Key | Value | Rule |
|---|---|---|
| `text` | #080D12 | type on light surfaces |
| `light` | #F5F7F8 | type on the dark wall |
| `secondary` | #646E73 | secondary type on light surfaces |
| `muted` | #BCC6CC | secondary type on the dark wall |
| `highlight` | #3079F0 | the element being described is outlined in blue, never in red |
| `strip_active` | #3079F0 | the chapter strip fills the active chapter in blue (iCentral used red) |
| `type_cursor` | #3079F0 | the typewriter block cursor on chapter cards is blue |
| `ripple` | #FFFFFF | click ripple and the title card's double-click pulse |

**No red boxes.** No red rectangle, outline, pill, underline, cursor, arrow or progress fill anywhere. When something needs pointing at, it gets the blue focus box.

## 3. Background

The **contour wall** (`video/edit/lib/background.py`): an abstract, procedural wall in Oasis neutrals, owned outright, that replaces the iCentral red satin wave.

| Key | Value |
|---|---|
| `style` | `sa-contour-1` (part of the wall cache key, so a new version re-renders) |
| `top`, `bottom` | vertical gradient #1B1E21 to #080D12 |
| `lift` | #33393D glow lifting the centre |
| `line` | #A2ADB2 contour lines, alpha 0.07, every 5th (index) line alpha 0.13; lines take the colour of the bloom they cross |
| `blooms` | soft out-of-focus glows in the accents, never red: `bloom` blue 0.30, green 0.12, yellow 0.05; `hero` blue 0.34, green 0.10, yellow 0.05; `card` blue 0.22, green 0.06 |

The contour lines read as the slope map of a green: golf framing is allowed (the iCentral ban on golf framing does not apply to Spatial Adjust). Three presets, all drifting slowly (zoom 1.06 to 1.0 and a 40 px pan, `drift` ease):

- `bloom`: behind window shots; blooms low left and low right, under the window.
- `card`: behind title and chapter cards; darker and quieter, one blue bloom low right.
- `hero`: behind the lockup and the end card; a fuller blue bloom centred behind the lockup.

Owned course or turf photography may replace the abstract wall later. It would live under `<media root>/brand-imagery/` with its provenance in `video/brand/imagery.md`. Never third-party or customer aerials, and never a real customer course.

## 4. Type

Golos UI from the repository's design system (`_ds/.../assets/fonts/`, SIL OFL), weights 400, 500 and 700 only. Golos UI ships no 600: nothing asks for it, and `render_gfx.mjs` maps a stray 600 to 500 with a warning. Type is rasterised by headless Chromium at final output pixels and never scaled after.

| Key | Size | Weight | Tracking | Case | Colour | Use |
|---|---|---|---|---|---|---|
| `title` | 200 px | 700 | -0.035em | sentence | `white` | episode name on the title card |
| `series` | 150 px | 500 | -0.025em | as written | `light` | the series word, "Double Click" |
| `chapter_label` | 40 px | 500 | 0.2em | caps | `muted` | eyebrow tag above the series word (UP NEXT) |
| `chapter_card` | 132 px | 500 | 0.06em | caps | `light` | typed chapter card |
| `statement` | 150 px | 500 | -0.025em | sentence | `light` | typed sentence card |
| `strip` | 19 px | 500 | 0.02em | as written | `white` | chapter strip names |
| `cta` | 84 px | 500 | -0.02em | sentence | `light` | end card call to action |
| `url` | 64 px | 500 | 0.005em | lower | `light` | end card URL pill |
| `legal` | 24 px | 400 | 0.01em | sentence | `muted` | end card legal line |

The series word is `series_word`: "Double Click", the series name the Spatial Adjust episodes share with the iCentral Double Click series. The lockup wordmark is 700 (see Lockup).

## 5. Motion

| Key | Ease | cubic-bezier | Use |
|---|---|---|---|
| `enter` | outCubic | (0.33, 1, 0.68, 1) | entrances, the window float settle |
| `exit` | inCubic | (0.32, 0, 0.67, 0) | exits, type out |
| `glide` | inOutCubic | (0.65, 0, 0.35, 1) | cursor glides, camera push-ins and pulls |
| `type_in` | outQuint | (0.22, 1, 0.36, 1) | type in, per word |
| `drift` | inOutSine | (0.37, 0, 0.63, 1) | slow wall drift |
| `morph` | inOutQuart | (0.76, 0, 0.24, 1) | window morph between shots |

**Title spring** (`spring`): the episode name springs out of the series word as an underdamped step, w = 15, z = 0.42 (overshoot about 23 %).

**Durations** (`durations`, seconds):

| Key | Value | What |
|---|---|---|
| `enter` | 0.55 s | element entrance |
| `exit` | 0.30 s | element exit |
| `type_word` | 0.60 s | one word typing in |
| `type_stagger` | 0.07 s | between words |
| `type_out` | 0.22 s | typed card out |
| `type_cps` | 50 | typewriter characters per second |
| `push_in` | 1.2-2.5 s | camera push-in |
| `window_float` | 0.8-1.2 s | window float settle |
| `click_pulse` | 0.60 s | click pulse |
| `double_click_gap` | 0.16 s | between the two clicks of a double-click |
| `lockup` | 2.3 s | the opening lockup moment |
| `title_card` | 5.9 s | the title card |
| `up_next_card` | 4.6 s | the up-next title card |
| `chapter_card` | 1.7 s | a typed chapter card |
| `end_card` | 5.0 s | the end card |
| `strip_fade` | 0.5 s | chapter strip fade in and out |

**Camera.** Window shots use the tilted window plate with push-ins from the cursor-follow camera plan (the hero look): the window floats on the wall with a slight perspective tilt and the camera pushes in on what the cursor does. The plate is flat (no tilt, no drift) only on the title card and the end card, where there is no window. Between moves the camera keeps drifting, so no UI shot is ever static.

## 6. Holds

**Hold rule** (`hold`): every on-screen label stays readable (every word at least 50 % opacity) for at least **1.5 s + 0.3 s per word**. `min_hold(words)` in `brand.py` and `minimumHold` in `video/lib/episode-schema.mjs` compute the same number; the episode schema refuses a beat that holds a label for less.

## 7. Layout

| Key | Value |
|---|---|
| `title_safe` | 0.90: every word on screen sits inside the title-safe box (96, 54, 1824, 1026) |
| `window_wide` | window shot rest framing: scale 0.77 at (962, 522), so the plate spans y 106 to 938 |
| `strip` | chapter strip box (250, 958, 1670, 1016), corner radius 20, blur 22, pad 22, gap 14 |

The chapter strip is frosted dark glass (the frame under it blurred, tinted #080D12 at 46 %), with a hairline edge and a soft shadow. Each chapter has its name and a 3 px track that fills while the chapter plays: blue while active, with a glowing head, white once done. The strip sits 20 px under the window's rest framing and inside title-safe, above the bottom 64 px where a web player draws its controls. (The iCentral Double Click strip sat at y 1002 to 1060, outside title-safe.)

## 8. Cursor and highlight

These are drawn in the page during capture (`video/capture/director-runtime.js`) and mirrored here so the title card and any recreation match.

| Key | Value |
|---|---|
| `cursor_spec` | arrow cursor, viewBox 13 x 20, drawn at 15.6 x 24 CSS px, white fill with a #080D12 outline; the title card draws the same arrow at 6.4 px per unit (a 2x asset at half scale) |
| `ripple` | white click ripple: a radial white disc that grows and fades over 0.6 s |
| `focus_box` | blue focus box: 2.5 px #3079F0 border, radius 10, a 6 px blue ring at 16 % and a 24 px glow at 25 %, fading in over 0.28 s |

There is never more than one cursor in frame.

## 9. Sound

| Key | Value |
|---|---|
| `integrated_lufs` | -14.0 LUFS integrated (BS.1770), the final mix |
| `tolerance_lu` | +/- 0.5 LU, checked by verify |
| `true_peak_max_dbtp` | -1.0 dBTP: true peak at or below this |
| `limiter_ceiling_dbtp` | -1.85 dBTP: the mixer's 4x-oversampled look-ahead limiter ceiling, for margin through the AAC encode |
| `music_under_vo_db` | -3.0 dB: unducked, the music sits 3 dB under the VO |
| `duck_db` | -9.0 dB: a further duck under every VO line |
| `duck_key_dbfs` | -45.0 dBFS sidechain key from the VO |
| `duck_lookahead_ms` | 50 ms |
| `duck_attack_ms` | 80 ms |
| `duck_release_ms` | 350 ms |
| `sample_rate` | 48000 Hz |

**SFX set** (`sfx_levels`, relative to each clip's design level, synthesised in-house):

| Key | Level | Cue |
|---|---|---|
| `click` | -10.0 dB | a click in the footage or on the title card |
| `hit_soft` | -14.0 dB | a card or title card arrives |
| `tick_soft` | -10.0 dB | the episode name pops; a click without a cursor track |
| `type` | -6.0 dB | one tick per character as a chapter card types (`type:<n>:<cps>`) |

## 10. Do and don't

**Do**

- Open on the lockup on the `hero` wall, then the title card on the `card` wall.
- Keep red in the lockup tile; use blue for every highlight, active state and pointer.
- Let accents mean something: a band colour sits with the data it describes.
- Keep every word inside title-safe and on screen for its hold.
- Show the fictional course only (Riverbend National, `video/brand/course.json`) and Demo Mode or restyled map imagery only.
- Let the camera follow the cursor, with the window tilted and floating on the wall.

**Don't**

- Don't draw red boxes, red outlines, red cursors or red progress fills.
- Don't use the iCentral red wave, the iCentral lockup or icentral.toro.com.
- Don't use Golos UI 600 or any face other than Golos UI.
- Don't show a real course, a real person's name, or third-party aerial imagery.
- Don't put more than one cursor in frame, or cover the cursor's target with a label.
- Don't hold a label for less than 1.5 s + 0.3 s per word.
