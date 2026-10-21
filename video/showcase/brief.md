# Creative brief: the Spatial Adjust showcase film

**Plan:** the Spatial Adjust showcase film, phase 1 (brief and concept) · **Date:** 2026-10-20
**Owner and approver:** Adam Munir
**Required reading:** the showcase request (its global rules are in [`README.md`](README.md#global-rules)),
[`../brand/motion-system.md`](../brand/motion-system.md), [`../../docs/claims/README.md`](../../docs/claims/README.md)
**Concept and beat sheet:** [`concept.md`](concept.md) · **Episode config:** [`episode.json`](episode.json)
**Gate:** SC-G1 in [`../approvals.md`](../approvals.md#showcase). Decided by the executor under owner direction
2026-10-19; for review in person 2026-10-22. The questions for the review are in
[`docs/review-agenda.md`](../../docs/review-agenda.md).

This brief has the shape of the iCentral launch brief, adapted to a golf product and to the Spatial Adjust brand. The
iCentral documents were read, not copied; nothing from them is committed here:

| Read-only source | Modified |
|---|---|
| `~/Documents/iCentral_MarCom/02-concept-storyboard/creative-brief.md` | 2026-10-01 12:38:15 -0700 |
| `~/Documents/iCentral_MarCom/02-concept-storyboard/hero-concept.md` | 2026-10-02 13:23:51 -0700 |

## Deliverables

| Deliverable | Spec |
|---|---|
| `SpatialAdjust-showcase-16x9.mp4` | 60–120 s, 1920x1080, 60 fps, H.264 video and AAC audio, -14 LUFS integrated (+/- 0.5 LU, as `verify` checks), true peak at or below -1 dBTP |
| Captions | English WebVTT |
| Transcript | Plain text, the narration as spoken |
| Poster | One still from the film, 1920x1080 |
| Social cutdown | 9:16 or 1:1, **optional**: made only if the owner asks |

Every deliverable is media: it lives in `~/Documents/SpatialAdjust_MarCom/showcase/final/` and is never committed. The
live guides site embeds the film from there.

## Audiences

| Audience | What they need from the film |
|---|---|
| Superintendents and assistant superintendents | To see that every adjustment starts from their own soil measurement and their own target, that they can override any of it, and that nothing reaches Lynx until they push. The screens they will use, in the order they will use them. |
| Course owners and GMs | What Spatial Adjust does, in under two minutes, and why it is worth setting up: water placed by measurement, station by station, instead of one number for a whole program. No savings figures the film cannot source. |
| Toro sales, distributors and support | A short, accurate explanation they can play instead of a live demo, which risks showing a real course or a live push. The same chain, in the same order, every time it is shown. |
| The Spatial Adjust expert team | The whole feature at once before they walk the guides page by page on 2026-10-22, with every line traceable to a Verified claim, so they can challenge a fact rather than a phrasing. |

## Key message

**"Every part of the course gets the water its soil actually needs."**

The film earns that line by following the Spatial Adjust chain, and nothing else:

1. TurfRad measures soil moisture (VWC) across the course, station by station.
2. The superintendent sets the target.
3. Spatial Adjust works out a percent adjustment for each station.
4. Lynx runs the water, and nothing changes until you push.

Screens without that chain read as a table of numbers. Every beat in [`concept.md`](concept.md) is one link of it.

## Tone

Confident, plain, no hype. Show, don't tell.

- Say what the product does, in the guides' own words. No adjective the footage cannot back up: nothing is
  "smart", "revolutionary" or "effortless".
- Golf language is welcome: course, holes, areas, stations, superintendent.
- No number on screen or in the voice that the claims ledger does not verify, and no water-savings figure at all.
- Unhurried narration with room between lines; the music sits under the voice, never over it.

## Visual language

Taken from [`../brand/motion-system.md`](../brand/motion-system.md), which is the authority if the two ever differ.

| Element | Treatment |
|---|---|
| Lockup | The Spatial Adjust lockup: the Toro red tile and "Spatial Adjust" in Golos UI Bold. It opens the film on the hero wall and closes it on the end card. |
| Type | Golos UI only, weights 400, 500 and 700. |
| Colour | Oasis neutrals: #080D12, #F5F7F8 and #646E73. The moisture-band colours are the accents, and each appears only with the data it describes: #E11837 for 0-5 %, #F3D43B for 6-19 %, #42CE11 for 20-30 %, #3079F0 above 30 %. |
| Highlight | The design-system blue focus box (#3079F0) on the control being described. **No red boxes**: red is the lockup tile and the 0-5 % band, nothing else. |
| Camera | The app window floats, slightly tilted, on the contour wall, and the camera pushes in on the control being described, following the cursor. No UI shot is ever static. |
| Shot types | Three, as in the iCentral hero: a full-window float, a macro push-in on one control, and a type card. |
| Chapter labels | A typed chapter card for each link of the chain, and the chapter strip naming every chapter along the bottom. |
| Golf framing | Allowed. The contour wall reads as the slope map of a green, and the course is shown as holes, areas and stations. |
| Course | The fictional course only: Riverbend National, as defined in [`../brand/course.json`](../brand/course.json), with the restyled map (gate G2). Never a real course, a real person's name or third-party aerial imagery. |

## Voice

ElevenLabs **Brian**, voice ID `Gubgw9l4dtIoQA9YZHgx`, model `eleven_multilingual_v2`, with the same settings as the
iCentral hero: stability 0.5, similarity boost 0.75, style 0.0, speaker boost on, speed 1.0, levelled to the same RMS
target. The settings are recorded in [`../vo/voice-settings.md`](../vo/voice-settings.md), and the pronunciations of
TurfRad, Lynx, VWC, ET and IntelliDash in [`../vo/lexicon.json`](../vo/lexicon.json). The script runs to about 150-200
words.

## Avoid list

From the showcase request, verbatim:

- real customer courses or names;
- pushing to a real Lynx;
- water-savings numbers without a cited source;
- unshipped UI, unless tagged COMING SOON with owner approval;
- stock footage that is not licensed.

Also:

- webinar-style narrated feature lists;
- a spoken line or on-screen label without a Verified claim in `docs/claims/claims.json` (global rule 4);
- the push window stated as a fact while its claims are Needs expert in the ledger.

## Borrowed from the iCentral hero, and not borrowed

| Borrowed | Not borrowed |
|---|---|
| The edit grammar: the three shot types, a camera that always moves, kinetic chapter labels, music ducked under the voice, every label held long enough to read | The iCentral brand: its lockup, "the new iCentral", its blue gradient and icentral.toro.com |
| The voice: Brian, at the same settings | The red wave |
| | The commercial framing: city parks, campuses and contractors. Spatial Adjust is a golf product, so the iCentral ban on golf framing does not apply |
| | The old-to-new toggle and page peel: Spatial Adjust has no legacy screen to contrast with |
| | The Microsoft Teams template that the iCentral brief followed |
