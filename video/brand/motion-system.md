# Motion system: Spatial Adjust videos

**Gate:** G3, style frame, in [`../approvals.md`](../approvals.md) · **Code:** [`../edit/lib/brand.py`](../edit/lib/brand.py)

The look of every Spatial Adjust video: the lockup, colour, background, type, motion, holds, layout, cursor and highlight, and sound. It replaces the iCentral MarCom motion system for this series. The structure (eased camera on real UI, a window floating on a soft wall, crisp kinetic type, no people) carries over; the identity changes: the Spatial Adjust lockup instead of the iCentral one, a contour wall instead of the satin wave (Toro red on the title, chapter, up-next and end screens, dark neutrals behind the footage), a spotlight on the element being described (the rest of the frame dims; no outline), and golf framing allowed, because Spatial Adjust is a golf product.

`brand.py` is the single code source for these values: `BRAND` mirrors this page value for value, and `theme.py` applies it with `THEME.update(BRAND)`, so the engine, the walls, the cards and the chapter strip all draw from it. The first column of each table below is the `brand.py` key. `video/edit/tests/test_brand.py` fails when this page and `brand.py` disagree, when a colour drifts from the design tokens (`_ds/.../tokens/figma/fig-tokens.css`) or from the app's moisture legend, or when red appears anywhere but the red screens' palette, the lockup tile, the 0-5 % band and the footage wall's glow.

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
| `color_dark_wall` | #FFFFFF wordmark on the Toro red screens; #080D12 on light surfaces |
| `plate` | the tile sits on a #FFFFFF plate: padding 0.25 of the tile's height on every side (the logo's clear space), corner radius 0.22 of the tile's height |

The wordmark's capitals are centred on the tile. The tile is the approved logo file, never recoloured, outlined or cropped, and never set directly on red: on the red screens it sits on its white plate. **Open decision:** the repository holds no reversed (white) Toro logo and no clear-space or minimum-size rule, so the white plate and the 0.25 clear space are interim; swap in the approved reversed asset and the Toro rules when the owner supplies them.

**Corner bug** (`bug`): the same tile on its plate, small, in the top-left corner of the title-safe box through every footage shot; it fades in and out with the shot.

| Key | Value |
|---|---|
| `tile_h` | 40 px tile (the minimum size used anywhere in the video) |
| `margin` | (96, 54): the title-safe box's top-left corner |
| `opacity` | 0.95 |
| `fade` | 0.4 s in and out |

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
| `gray40` | #A2ADB2 | `--40` | contour lines on the footage wall |
| `gray30` | #BCC6CC | `--30` | spare neutral |
| `gray20` | #D9DFE2 | `--20` | hairlines on light surfaces |
| `gray10` | #ECEFF1 | `--10` | light background fallback |
| `gray05` | #F5F7F8 | `--05` | spare neutral |
| `white` | #FFFFFF | `--white` | type on the red screens, the logo plate, chapter strip names and active fill, click ripple |
| `blue` | #3079F0 | `--informative-02` | the URL pill dot; the > 30 % band (the spotlight is a black dim, not a colour) |
| `blue_tint` | #66A1FF | `--informative-01` | blue glow on the wall |
| `blue_shade` | #2165DB | `--informative-03` | deep blue on the wall |
| `green` | #42CE11 | `--positive-02` | the 20-30 % band; green bloom on the wall |
| `yellow` | #F3D43B | (app legend) | the 6-19 % band; yellow bloom on the wall |
| `red` | #E11837 | `--base` | Toro red: the background of the title, chapter, up-next and end screens, the lockup tile, the 0-5 % band, a soft glow on the footage wall |
| `red_shade` | #C91E38 | `--shade` | the red screens' gradient foot and glows |
| `red_tint` | #FA5069 | `--tint` | contour lines on the red screens, at low alpha |

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
| `light` | #FFFFFF | type on the Toro red screens (4.8:1 on #E11837, AA) |
| `secondary` | #646E73 | secondary type on light surfaces |
| `muted` | #080D12 | secondary type on the red screens: near-black, 4.1:1, used for large type only (tags 40 px, legal line 24 px) |
| `highlight` | #3079F0 | design-system blue for the URL pill dot and the > 30 % band; the element being described is spotlit (the rest of the frame dims), never outlined in red or blue |
| `strip_active` | #FFFFFF | the chapter strip fills the active chapter in white |
| `type_cursor` | #FFFFFF | the typewriter block cursor on chapter cards is white (blue or red would vibrate on red) |
| `ripple` | #FFFFFF | click ripple and the title card's double-click pulse |

**Red is a background, never a pointer.** Red is the tile screens' background, the lockup tile, the footage wall's glow and the 0-5 % band when the data shows it. No red rectangle, outline, pill, underline, cursor, arrow or progress fill. When something needs pointing at, the rest of the frame dims and it stays lit (the spotlight); the moisture-band blues in the app stay as the app draws them.

## 3. Background

The **contour wall** (`video/edit/lib/background.py`): an abstract, procedural wall, owned outright, that replaces the iCentral red satin wave. The footage sits on dark Oasis neutrals with a soft red glow; the title, chapter, up-next and end screens are Toro red.

| Key | Value |
|---|---|
| `style` | `sa-contour-2` (part of the wall cache key, so a new version re-renders) |
| `top`, `bottom` | vertical gradient #1B1E21 to #080D12 |
| `lift` | #33393D glow lifting the centre |
| `line` | #A2ADB2 contour lines, alpha 0.07, every 5th (index) line alpha 0.13; lines take the colour of the bloom they cross |
| `blooms` | soft out-of-focus glows: `bloom` red 0.16, gray70 0.20, red_shade 0.08; `hero` red_shade 0.45, red_shade 0.30, red_shade 0.20; `card` red_shade 0.45, red_shade 0.25 |
| `screen` | the red screens (`card`, `hero`): #E11837 at the top to #C91E38 at the foot, #E11837 lift, #FA5069 contour lines at alpha 0.24 (index lines 0.40), vignette 0.22 |

The contour lines read as the slope map of a green: golf framing is allowed (the iCentral ban on golf framing does not apply to Spatial Adjust). Three presets, all drifting slowly (zoom 1.06 to 1.0 and a 40 px pan, `drift` ease):

- `bloom`: behind window shots; dark neutrals with a soft red glow low left and low right, under the window.
- `card`: behind title and chapter cards: Toro red.
- `hero`: behind the lockup, the up-next card and the end card: Toro red with a deeper glow behind the lockup.

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
| `lockup` | 1.8 s | the opening lockup moment |
| `title_card` | 5.4 s | the title card |
| `up_next_card` | 4.6 s | the up-next title card |
| `chapter_card` | 1.7 s | a typed chapter card, at least; longer when its typing plus the label's hold needs it |
| `end_card` | 5.0 s | the end card |
| `strip_fade` | 0.5 s | chapter strip fade in and out |

**Title card** (`title_card`): the series word rises in, the arrow cursor glides in on the `glide` ease and double-clicks it (the word squishes and a white pulse rings out on each click), then the episode name springs down out from under the word's baseline and the pair settles centred. Times in seconds from the card's start:

| Key | Title card | Up next card | What |
|---|---|---|---|
| `t_in` | 0.15 | 0.1 | the series word rises in |
| `t_move` | 0.75 | 1.45 | the cursor starts its glide |
| `click` | 1.74 | 2.42 | first click; the second follows after `double_click_gap` |
| `pop` | 1.98 | 2.68 | the episode name springs out |
| `leave` | 2.6 | 3.2 | the cursor leaves |
| `out` | 0.3 | 0.3 | everything fades this long before the card ends |
| `drop` | 30 px | 30 px | the episode name's drop under the word's baseline |

**End card** (`end_card`): the video's last frame, held with no exit. The `hero` wall dimmed by `dim` 0.12 settles from zoom `z0` 1.08 to 1.0 on the `enter` ease; the lockup comes in at end size as on the opening, then the call to action rises in, the legal line and the URL pill fade in. Each part is readable from its start plus its duration, and the hold rule counts from there to the card's end. Times in seconds from the card's start:

| Key | Starts | Takes | What |
|---|---|---|---|
| `cta` | 0.5 | 0.6 | the call to action rises in |
| `url` | 0.75 | 0.6 | the URL pill fades in |
| `legal` | 0.7 | 0.4 | the legal line fades in |

The URL comes from `video/brand/end-card.json` and needs gate G4 decided in `video/approvals.md`; a draft shows `URL PENDING APPROVAL` in a pill with a grey dot (the options and the decision: [`end-card-options.md`](end-card-options.md)).

**Camera.** Window shots use the tilted window plate with push-ins from the cursor-follow camera plan (the hero look): the window floats on the wall with a slight perspective tilt and the camera pushes in on what the cursor does. The plate is flat (no tilt, no drift) only on the title card and the end card, where there is no window. Between moves the camera keeps drifting, so no UI shot is ever static.

## 6. Holds

**Hold rule** (`hold`): every on-screen label stays readable (every word at least 50 % opacity) for at least **1.5 s + 0.3 s per word**. `min_hold(words)` in `brand.py` and `minimumHold` in `video/lib/episode-schema.mjs` compute the same number; the episode schema refuses a beat that holds a label for less.

## 7. Layout

| Key | Value |
|---|---|
| `title_safe` | 0.90: every word on screen sits inside the title-safe box (96, 54, 1824, 1026) |
| `window_wide` | window shot rest framing: scale 0.77 at (962, 522), so the plate spans y 106 to 938 |
| `strip` | chapter strip box (250, 958, 1670, 1016), corner radius 20, blur 22, pad 22, gap 14 |
| `end_card` | end card centres at 0.31 H (lockup), 0.475 H (call to action) and 0.615 H (URL pill); the legal line sits on title-safe's bottom edge, and every part must fit inside title-safe |

The chapter strip is frosted dark glass (the frame under it blurred, tinted #080D12 at 46 %), with a hairline edge and a soft shadow. Each chapter has its name and a 3 px track that fills while the chapter plays: white, with a glowing head while active and without it once done. The strip sits 20 px under the window's rest framing and inside title-safe, above the bottom 64 px where a web player draws its controls. (The iCentral Double Click strip sat at y 1002 to 1060, outside title-safe.)

## 8. Cursor and highlight

These are drawn in the page during capture (`video/capture/director-runtime.js`) and mirrored here so the title card and any recreation match.

| Key | Value |
|---|---|
| `cursor_spec` | arrow cursor, viewBox 13 x 20, drawn at 15.6 x 24 CSS px, white fill with a #080D12 outline; the title card draws the same arrow at 6.4 px per unit (a 2x asset at half scale) |
| `ripple` | white click ripple: a faint radial white disc that grows and fades over 0.6 s |
| `spotlight` | what the voice is on is spotlit, not boxed: the rest of the frame dims to 50 % black with a 6 % darker at the corners vignette, and the target stays lit through one rounded cutout over the union of the live boxes, grown by 10 % of the longer side, 12 to 44 px, with corners 8 % of the shorter side, 10 to 22 px, and a 10 px feather. The dim fades over 0.4 s, the cutout follows with a 0.18 s time constant when the target changes, and it is released between beats. It is drawn in the page under the cursor, so the cursor is never dimmed |
| `click` | a click presses to 0.86 (the cursor's scale) within the 0.25 s dwell before it lands, and sends a white ripple at 45 %; never blue |

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
| `duck_hold_ms` | 600 ms: pauses in the voice shorter than this are bridged, so the music does not rise between words or sentences |
| `duck_lookahead_ms` | 120 ms |
| `duck_attack_ms` | 200 ms |
| `duck_release_ms` | 1000 ms |
| `sample_rate` | 48000 Hz |

**Music beds.** The polished episodes use `sa-bed-v3-corporate` (96 BPM, G major, I-V-vi-IV, warm pad, felt piano, marimba, light muted kick, tick and shaker, low-passed, soft saturation; record `video/brand/music-v3.json`; 7 dB under the voice and a further 6 dB while it speaks). `sa-bed-v2-calm` (`music-calm.json`) and the series bed `sa-bed-v1` (`music.json`) remain options; the owner decides the series bed.

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
- Keep red as a background; point with the spotlight (a dim, no outline), white for active states and the type cursor.
- Put the Toro tile on its white plate on red, and keep the corner bug through the footage.
- Let accents mean something: a band colour sits with the data it describes.
- Keep every word inside title-safe and on screen for its hold.
- Show the fictional course only (Riverbend National, `video/brand/course.json`) and Demo Mode or restyled map imagery only.
- Let the camera follow the cursor, with the window tilted and floating on the wall.

**Don't**

- Don't draw red boxes, red outlines, red cursors or red progress fills, and don't set the Toro tile straight on red.
- Don't use the iCentral red wave, the iCentral lockup or icentral.toro.com.
- Don't use Golos UI 600 or any face other than Golos UI.
- Don't show a real course, a real person's name, or third-party aerial imagery.
- Don't put more than one cursor in frame, or cover the cursor's target with a label.
- Don't hold a label for less than 1.5 s + 0.3 s per word.
