# Sound effects: source and licence

**Code:** [`../edit/audio/build_audio.py`](../edit/audio/build_audio.py) · **Levels:** `sfx_levels` in [`motion-system.md`](motion-system.md), section 9

Every sound effect in the Spatial Adjust videos is synthesised by code in this repository, from white noise (a NumPy generator with the fixed seed 871, reset for every mix) and sine partials, at 48 kHz. No recording, sample or library file is used, so there is nothing to license and nothing to credit. The recipes are ported unchanged from the iCentral MarCom mixer (`~/Documents/iCentral_MarCom/06-edit/compositor/audio/build_audio.py`, lines 73-163, modified 2026-10-04 17:25:32), which synthesised them the same way and says so ("SFX (synthesized here; fully owned, no licence)"). The iCentral folder holds no SFX audio files; checked on 2026-10-20 by searching it for files named `*sfx*`.

## The set the timelines use

These are the cues `video/edit/build.py` and `lib/cards.py` write into a timeline's `sfx` list. Level is the gain the mixer applies on top of the clip's design level (`brand.py SFX`); pan is -1 (left) to 1 (right).

| Cue | When | Function | Recipe | Level | Pan |
|---|---|---|---|---|---|
| `click` | a click in the footage (the take's clicks), and the title card's double-click | `sfx_click(0.8)` | 45 ms: a 2400 Hz sine tick (attack 0.8 ms, decay 6 ms) at 0.6, a 900 Hz sine body (1 ms, 12 ms) at 0.5, and noise band-passed 2.5-9 kHz (0.5 ms, 4 ms) at 0.35; sum x 0.25 x strength | -10 dB | 0.15 |
| `tick_soft` | the episode name pops on the title card; a click without a cursor track | `sfx_tick()` | 30 ms of noise band-passed 1.8-7 kHz, attack 0.5 ms, decay 5 ms, x 0.12 | -10 dB | 0 |
| `hit_soft` | a card arrives: the title card, each chapter card, the end card | `sfx_hit()` | 0.9 s: a sine thump sweeping from 100 Hz down to 55 Hz (time constant 30 ms; attack 2 ms, decay 160 ms) at 0.55, and noise high-passed at 5 kHz (1 ms, 250 ms) at 0.18; sum x 0.5 | -14 dB | 0 |
| `type:<n>:<cps>` | a chapter card types its label: one tick per character at `cps` characters per second | `sfx_tick()` x n | as `tick_soft` | -6 dB | 0 |

## Also available

Ported with the set so later episodes can use them; no timeline writes these cues today.

| Cue | Function | Recipe | Level |
|---|---|---|---|
| `click_toggle` | `sfx_click(1.3)` | the click above, 1.3 x strength | -3 dB, pan 0.2 |
| `pop` | `sfx_pop()` | 120 ms sine sweeping from 1040 Hz to 520 Hz (time constant 18 ms), attack 2 ms, decay 35 ms, x 0.22 | -6 dB |
| `whoosh` | `sfx_whoosh(1.0)` | 1 s of noise through a low-pass swept from 300 Hz up to 4.5 kHz and back (512-sample blocks), then low-passed at 6 kHz, under a sine-squared envelope, x 0.10 | -5 dB |
| `riser:<s>` | `sfx_riser(s)` | a sine gliding up 2.2 octaves from 180 Hz plus noise high-passed at 2 kHz, under a u^2.4 swell, x 0.16 | -9 dB |
| `hit` | `sfx_hit()` | as `hit_soft`, louder | -7 dB |

`sfx_swish` (band-passed noise under a sine arch) is in the code but has no cue. The iCentral `sfx_thunder` (a Rain Shutdown effect) was not ported.

## Changing a sound

Change the recipe in `build_audio.py` and this table together, or the level in `brand.py` and `motion-system.md` together (`test_brand.py` checks the levels). A sound from a library or a recording may be used only with its source, licence and licence reference recorded in this file first, and its file kept under the media root, never in git.
