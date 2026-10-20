# VO script: the Spatial Adjust showcase film, "From scan to water"

**Plan:** the Spatial Adjust showcase film, phase 3 (script and Brian voice) · **Date:** 2026-10-20
**Locked to:** [`concept.md`](concept.md) at blob `a3145d3` (the beat sheet, with the phase 3 B1 line) and the claims
check [`claims-check.md`](claims-check.md) at blob `74c9045`, both from [`episode.json`](episode.json) at blob `7df191a`
**Gate:** SC-G2 (this script and the claims check) and SC-G3 (the voice-over) in
[`../approvals.md`](../approvals.md#showcase)
**Voice:** ElevenLabs Brian, `Gubgw9l4dtIoQA9YZHgx`, `eleven_multilingual_v2`, the iCentral hero settings, rendered by
[`../vo/render-brian.py`](../vo/render-brian.py) as delivered (settings in [`../vo/voice-settings.md`](../vo/voice-settings.md))
**Budget:** 2.75 words a second (see [Speaking rate](#speaking-rate))

**Format:** the shape of the iCentral hero's VO script, `~/Documents/iCentral_MarCom/04-vo/vo-script.md` (modified
2026-10-01 12:44:47 -0700), read and not copied.

`episode.json` is the source of the lines: every line's `text` below is its `text` there, verbatim, and its `windowIn`,
`windowOut` and `ttsText` are there too. The renderer, the captions and the claims check read `episode.json`, never
this file.

## Speaking rate

| Source | Words | Seconds | Words a second |
|---|---|---|---|
| The pipeline's pilot, `episodes/dashboard-overview-pilot/vo/render-report.json` (media root), the report the plan names | 48 | 13.48 | 3.56 |
| The four guide episodes rendered in the same voice and settings on 2026-10-20 (`dashboard-overview`, `map-navigation`, `understand-spatial-adjust`, `understanding-vwc`), pooled | 927 | 325.39 | 2.85 |
| The slowest of those four, `understand-spatial-adjust`, the closest to this script's vocabulary | 188 | 68.21 | 2.76 |

The pilot is three short lines, and Brian reads short lines quickly; the guide episodes are 11 lines each in the same
product vocabulary as this film. **The budget is 2.75 words a second,** just under the slowest full episode, so a line
that fits here has room to spare at the pooled rate. The pipeline's own estimate, by characters after the lexicon
(16.16 a second), is in [Credits](#credits); where it is longer than a window the line is marked *tight* below.

## Pronunciation lexicon

The pipeline's lexicon, [`../vo/lexicon.json`](../vo/lexicon.json), already carries every term the film says, so the
showcase adds none and duplicates none: `render-brian.py` applies the lexicon to each line's `text` and sends the
result. That result is each line's **TTS input**, recorded in `episode.json` as `ttsText` (a record, not an input: the
renderer does not read it, and [`whisper-roundtrip.py`](whisper-roundtrip.py) fails if the two ever disagree).
`eleven_multilingual_v2` has no reliable phoneme tags, so pronunciation is set by respelling only. Captions and the
transcript show the display text, never the TTS input.

| Term | Say | TTS input (`ttsText`) | Note |
|---|---|---|---|
| TurfRad | **TURF-rad** | `Turf Rad` | Lexicon entry `TurfRad`. Two words, stress on "turf". Said once, in L2. Whisper must write it back as "TurfRad" or "Turf Rad". |
| Lynx | **links** | `Links` | Lexicon entry `Lynx`. Said like "links", spelled that way so the model never spells it out or says "lunks". Said twice, in L8 and L9. "Lynx" and "links" sound the same, so the Whisper check gives the model the film's vocabulary and requires it to write "Lynx"; "links" fails. |
| VWC | **V-W-C** | `V W C` | Lexicon entry `VWC`. Letters, the way the Avg. VWC column on screen reads, and the way every guide episode says it. Said once, in L2. "Volumetric water content" on first mention was the alternative; it is decided at SC-G2 (letters). |
| ET | **E-T** | `E T` | Lexicon entry `ET`. Letters, not "et"; "evapotranspiration" was not used, because no guide says it in full where the film shows ET. Said once, in L5. |
| IntelliDash | **IN-tel-ee-dash** | `Intelli-Dash` | Lexicon entry `IntelliDash`. The hyphen makes the model stress both halves. Said once, in L1. Whisper must write it back as "IntelliDash" or "Intelli Dash". |
| Spatial Adjust | **SPAY-shul uh-JUST** | `Spatial Adjust` | Lexicon entry `Spatial Adjust`, pinned as written. Said three times, in L1, L8 and L9. |
| Toro | **TOR-oh** | *(not spoken)* | Only on screen: the lockup and the end card's legal line. Not in the lexicon, because no line says it. |

### TTS input by line

The lines the lexicon changes, as `python3 video/vo/render-brian.py --episode video/showcase/episode.json --dry-run`
prints them. Every other line is sent exactly as written.

| Line | TTS input (`ttsText`) |
|---|---|
| L1 | In Intelli-Dash, Spatial Adjust turns the latest moisture scan into a percent adjustment, station by station. |
| L2 | Each station's average V W C comes from a Turf Rad moisture scan, dated beside the station name. |
| L5 | The gap between target and measured becomes water, today's E T is added, Daily Max Amount caps it, and the result becomes a suggested percent adjust. |
| L8 | Nothing changes until you push. Review the two lists, untick anything you're unsure of, and send. Spatial Adjust writes each station, then reads Links back and checks each one. |
| L9 | Links itself must be set up to match Spatial Adjust; the push guide lists the settings. |

## Lines

Windows are in film time (minutes:seconds of the finished film), from the beat sheet in [`concept.md`](concept.md) and
the builder's own rules (`video/edit/build.py`): a chapter's footage starts when its typed card ends, and its first VO
line can start no earlier than 0.55 s into the footage (the builder's `LEAD`); a line on the end card starts 0.30 s
after the card (`END_VO_AT`). A window ends where its beat's footage ends, so no line runs into the next chapter card.
Where a beat has two lines, the first window closes 0.20 s before the second opens, more than the builder's 0.15 s
minimum gap between lines. The capture phase places each line's cue inside its window.

| Line | Id | Window in | Window out | Window | Beat | Line (display text) | Words | Budget @2.75 w/s | Fits | Claim IDs |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | `vo-b1-hook` | 0:11.85 | 0:18.30 | 6.45 s | B1 Station by station | In IntelliDash, Spatial Adjust turns the latest moisture scan into a percent adjustment, station by station. | 16 | 5.82 s | yes, 0.63 s spare (*tight* by characters: 6.75 s) | `understand-spatial-adjust/before/1`, `understand-spatial-adjust/summary/1`, `calculation-methods/2/2` |
| L2 | `vo-b2-measure` | 0:21.15 | 0:30.60 | 9.45 s | B2 Measure | Each station's average VWC comes from a TurfRad moisture scan, dated beside the station name. | 15 | 5.45 s | yes, 4.00 s spare | `understand-spatial-adjust/2/2`, `understand-spatial-adjust/2/3`, `request-scan-data/1/4` |
| L3 | `vo-b3-see` | 0:33.35 | 0:43.60 | 10.25 s | B3 See | The map colours pins by measured moisture. Move the bands, or switch to variance to see each station against its target. Map and table stay in sync. | 27 | 9.82 s | yes, 0.43 s spare | `map-navigation/1/1`, `map-navigation/2/1`, `map-navigation/3/1`, `map-navigation/3/3`, `map-navigation/5/1`, `map-navigation/5/2` |
| L4 | `vo-b4-target` | 0:47.15 | 0:54.60 | 7.45 s | B4 Set the target | You set the target: the moisture you want each station to hold. A soil factor handles persistent offsets. | 18 | 6.55 s | yes, 0.90 s spare | `understand-spatial-adjust/3/1`, `understand-spatial-adjust/3/2`, `suggested-adjustments/5/1`, `suggested-adjustments/5/3` |
| L5 | `vo-b5-calculate` | 0:57.45 | 1:07.00 | 9.55 s | B5 Calculate | The gap between target and measured becomes water, today's ET is added, Daily Max Amount caps it, and the result becomes a suggested percent adjust. | 25 | 9.09 s | yes, 0.46 s spare | `understand-spatial-adjust/4/2`, `understand-spatial-adjust/4/3`, `calculation-methods/2/2`, `calculation-settings/2/1` |
| L6 | `vo-b5-threshold` | 1:07.20 | 1:13.40 | 6.20 s | B5 Calculate | Below a minimum threshold, a suggestion is zeroed or lifted to the threshold when you push. | 16 | 5.82 s | yes, 0.38 s spare | `minimum-threshold/summary/2`, `minimum-threshold/before/3` |
| L7 | `vo-b6-review` | 1:16.25 | 1:26.30 | 10.05 s | B6 Review | Before you push, override any suggestion, replace or shift targets in bulk, find the outliers at both ends, or take a station or hole out of adjustment. | 27 | 9.82 s | yes, 0.23 s spare | `filter-adjustments/tile/2`, `editing-station-targets/4/1`, `bulk-adjustments/tile/2`, `bulk-adjustments/3/1`, `filter-adjustments/4/2`, `enable-disable-stations/summary/1` |
| L8 | `vo-b7-push` | 1:29.85 | 1:40.60 | 10.75 s | B7 Push to Lynx | Nothing changes until you push. Review the two lists, untick anything you're unsure of, and send. Spatial Adjust writes each station, then reads Lynx back and checks each one. | 29 | 10.55 s | yes, 0.20 s spare (*tight* by characters: 10.89 s) | `understand-spatial-adjust/5/4`, `push-to-lynx/2/1`, `push-to-lynx/2/3`, `push-to-lynx/4/1`, `push-to-lynx/5/1`, `push-to-lynx/5/2` |
| L9 | `vo-b7-lynx` | 1:40.80 | 1:46.80 | 6.00 s | B7 Push to Lynx | Lynx itself must be set up to match Spatial Adjust; the push guide lists the settings. | 16 | 5.82 s | yes, 0.18 s spare | `reviewing-changes/before/3`, `reviewing-changes/before/4` |
| L10 | `vo-b8-close` | 1:47.10 | 1:51.80 | 4.70 s | B8 end card | Target minus measured, station by station. That is the whole idea. | 11 | 4.00 s | yes, 0.70 s spare | `understanding-vwc/4/4` |
| **Total** | | | | | | | **200** | **72.73 s** | **10 of 10** | 43 claim IDs, all Verified |

**Totals:** 200 words (the top of the 150-200 range), counted from `episode.json` by

```bash
node -e "const ep=JSON.parse(require('fs').readFileSync('video/showcase/episode.json','utf8')); console.log(ep.vo.reduce((n,l)=>n+l.text.trim().split(/\s+/).filter(Boolean).length,0))"
```

which prints `200`; about 72.7 s of narration at 2.75 words a second inside a 111.8 s film, the rest being the open,
the chapter cards and the music. The rendered lengths replace the budget in [Fit check](#fit-check).

**Changes since the claims check:** one. L1 gains "In IntelliDash," (`understand-spatial-adjust/before/1`, Verified),
so the film says where Spatial Adjust lives and Brian says IntelliDash once; the script grows from 198 to 200 words.
The change log is in [`claims-check.md`](claims-check.md#phase-3-the-script-lock). The push-window line stays held
(see [Held for expert review](claims-check.md#held-for-expert-review)); restored, it would replace L9 at 14 words
against 16, so the total stays inside 200.

**Re-check:** `node video/showcase/check-claims.mjs --strict --write`, then `node video/showcase/check-claims.mjs`:
both exit 0 on 2026-10-20 (24 items, 10 VO lines and 14 labels, 43 Verified claim IDs, 2 held, 0 failures, 0
warnings).

## Delivery notes

Brian's delivery comes from the voice settings and each line's neighbours, which `render-brian.py` sends as
`previous_text` and `next_text`; the model takes no stage directions. These notes are what to listen for at SC-G3.

- **Tone:** confident and plain, never salesy (the brief). Unhurried, with air between lines.
- **L1:** the thesis. "Station by station" lands, and comes back in L10.
- **L2:** "V W C" as three clear letters; "Turf Rad" as two words, stress on "turf".
- **L3 and L7:** lists. Each item distinct, no rush at the end of the line.
- **L5:** the arithmetic, one clause at a time; "E T" as two letters.
- **L8:** "Nothing changes until you push." is said as reassurance, then a short pause.
- **L9:** "Lynx" sounds like "links"; the sentence is a pointer, not a warning.
- **L10:** the close, slower, over the end card.

## Credits

`python3 video/vo/estimate.py --episode video/showcase/episode.json`, 2026-10-20: 10 lines, 200 words, **1,179
characters** after the lexicon, so about **1,179 credits** for one render at 1 credit a character (2,358 with the
pipeline's retake factor of 2), and about 73.0 s of narration at 16.16 characters a second.

## Render

Command, from the repository root, after SC-G2 (the key is read by the renderer in process; nothing else touches it):

```bash
python3 video/vo/render-brian.py --episode video/showcase/episode.json
```

| Run | Lines sent | Characters sent | Credits before | Credits after | Used | Result |
|---|---|---|---|---|---|---|
| 2026-10-20 13:47 local time | 0 | 0 | 30,000 (limit 30,000) | 30,000 | 0 | **Blocked.** HTTP 403 `output_format_not_allowed`: "Output format 'mp3_44100_192' is only available on the Creator tier and above." The renderer asks for the iCentral format, and the account the ElevenLabs key now resolves to is below the Creator tier (the renders of 09:29 to 09:53 that day ran on an account with about 357,500 credits). Logged in `video/vo/credits-log.md`. Waiting on a Creator-tier key or plan, or on the video pipeline allowing another output format; see [`README.md`](README.md#phase-3-script-and-brian-voice). |

## Fit check

*Filled in by the render (phase 3, task 3).*

## Whisper round-trip

*Filled in by the intelligibility check (phase 3, task 4).*
