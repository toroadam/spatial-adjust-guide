# Style frame notes (gate G3)

**Gate:** G3, style frame, in [`../approvals.md`](../approvals.md) · **Spec:** [`motion-system.md`](motion-system.md) · **Generator:** [`../edit/style_frame.py`](../edit/style_frame.py)

The style frame is one still of every brand element the videos draw, rendered by the compositor itself from `brand.py`, so what is reviewed is what the pipeline will render. Version v1 is the set for gate G3.

```bash
~/Documents/SpatialAdjust_MarCom/.venv/bin/python video/edit/style_frame.py --version v1   # or: npm run video -- style-frame --version v1
```

It writes, under the media root (never into git):

- `style-frames/v1/01-lockup.png` to `08-wall-hero.png`: one 1920x1080 still per element, each rendered with `video/edit/render.py --still` at the time listed below.
- `style-frames/v1/sheet.jpg`: the eight stills on one contact sheet.
- `style-frames/v1/manifest.json`: the commit, the plate, the still times and the end card's G4 state.
- `style-frames/v1/_build/`: the timeline, the graphics and the window shot's plate.

The timeline is 25.6 s: the lockup (0 to 2.3 s), the title card (2.3 to 8.2 s), the chapter card (8.2 to 11.1 s), the window shot (11.1 to 17.6 s), the end card (17.6 to 22.6 s), then one second of each wall.

## The frames

| Still | Time | What it demonstrates | Motion system rules it shows |
|---|---|---|---|
| `01-lockup.png` | 1.6 s | The opening lockup on the `hero` wall: the Toro tile and "Spatial Adjust", centred | Lockup: tile 150 px (`tile_open`), wordmark Golos UI 700 at 0.635 of the tile, 0.35 tile gap to the S, capitals centred on the tile, wordmark #F5F7F8. Palette: red in the tile only. The tile has risen and sharpened and the wordmark has wiped in by 0.75 s; the moment lasts 2.3 s (`lockup`) |
| `02-title-card.png` | 5.8 s | The title card after the double-click: "Double Click" with "Dashboard overview" sprung out under it, the cursor gone | Type: `series` 150 px 500 #F5F7F8 over `title` 200 px 700 white, -0.035 em, the name 30 px under the word's baseline (`drop`). Motion: the name pops at 1.98 s on the title spring (w = 15, z = 0.42). Holds: the four words need 2.7 s and stay readable for 3.62 s. `card` wall |
| `03-chapter-card.png` | 10.65 s | The typed chapter card READ THE MAP, fully typed, the blue block cursor blinking | Type: `chapter_card` 132 px 500 caps, tracking 0.06 em, #F5F7F8. Palette: the typewriter cursor is blue (`type_cursor` #3079F0), never red. Motion: 50 characters per second. Holds: the card is as long as typing plus the hold needs (2.9 s here: three words need 2.4 s). `card` wall |
| `04-window-shot.png` | 14.3 s | A window shot in chapter 2: the Spatial Adjust screen floating tilted on the `bloom` wall, the camera pushed in, the blue focus box on the moisture legend, the arrow cursor beside the 6-19 % band, and the chapter strip | Layout: window rest framing scale 0.77 at (962, 522) with the cursor-follow push-in and tilt (`camera`). Highlight: `focus_box` 2.5 px #3079F0, radius 10, 6 px ring at 16 %, 24 px glow at 25 %; no red box anywhere. Accents: the four band colours appear only on the data they describe. Chapter strip: box (250, 958, 1670, 1016), radius 20, blur 22, pad 22, gap 14, names 19 px 500 white; "Start with the toolbar" done (white track), "Read the map" active (blue track with a glowing head), the rest at 55 % white; inside title-safe and above the bottom 64 px a web player covers. One cursor in frame |
| `05-end-card.png` | 22.1 s | The end card, the video's last frame: the lockup, "Explore the Spatial Adjust Guides", the URL pill and the legal line | Lockup at end size (tile 104 px). Type: `cta` 84 px 500, `url` 64 px 500 in a frosted pill with the blue arrow dot, `legal` 24 px 400 #BCC6CC on title-safe's bottom edge. Layout: `end_card` centres at 0.31, 0.475 and 0.615 of the height. Holds: the call to action (5 words, needs 3.0 s) is readable for 3.9 s, the URL (4 words, 2.7 s) for 3.65 s, the legal line (7 words, 3.6 s) for 3.9 s. The URL is the G4 decision in `end-card.json` |
| `06-wall-bloom.png` | 23.1 s | The `bloom` wall alone, as it sits behind window shots | Background: the contour wall `sa-contour-1`, gradient #1B1E21 to #080D12 with a #33393D lift, contour lines #A2ADB2 at 0.07 (index lines 0.13), blooms blue 0.30, green 0.12, yellow 0.05 low left and low right. No red |
| `07-wall-card.png` | 24.1 s | The `card` wall alone, as it sits behind title and chapter cards | Background: darker and quieter, blue 0.22 low right and green 0.06 top left. No red |
| `08-wall-hero.png` | 25.1 s | The `hero` wall alone, as it sits behind the lockup and the end card | Background: a fuller blue bloom (0.34) centred behind the lockup, green 0.10, yellow 0.05. No red |

## The window shot's plate

The window shot shows the guide site's own recreation of Spatial Adjust, not IntelliDash: `video/edit/gfx/recreation_still.mjs` serves the built site (`dist/`) on loopback, opens the "Dashboard overview" guide in Playwright's headless Chromium, lifts the guide's first full-size app figure to fill a 1920x1080 page, draws the focus box and the cursor over it with the values in `brand.py`, and screenshots it at 3840x2160 (the size a capture records). The still is looped into a 4 s clip. The fictional course (Riverbend National) and the stylised map are the guides' own; no real course, person or map imagery appears. Real Demo Mode footage is first seen at gate G7. When `dist/` or Chromium is missing, `--plate smoke` (the compositor's synthetic test clip) is used instead, and `manifest.json` says which plate a version used.

## What a still cannot show

Eases, durations, the title spring in motion, the wall drift and the sound targets (-14 LUFS integrated, -1 dBTP true peak, music 3 dB under the voice with a 9 dB duck) are specified in `motion-system.md` but only visible in a moving render; the pilot draft is where they are first seen together.

## Decision

Recorded in [`../approvals.md`](../approvals.md), row G3: v1 decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22. The questions for the review are in [`docs/review-agenda.md`](../../docs/review-agenda.md). If the review asks for changes, the change goes into `brand.py` (and `motion-system.md`, which `test_brand.py` keeps in step), `style_frame.py --version v2` renders the next set, and v2 gets a new G3 row.
