# Voice settings: the Brian voice

Every Spatial Adjust episode is narrated by the same ElevenLabs voice, with the same model and settings as the iCentral MarCom Double Click series, and levelled to the same loudness, so the two series sound alike and could be cut together. This page is the record of those settings and of how the loudness target was measured. `video/vo/render-brian.py` holds the same values in its `VOICE_CONFIG` dict; `video/vo/test_lexicon.py` fails if this page and that dict disagree.

## Settings

The renderer reads only `rms_target_dbfs` from the block below. Every other line documents a value in `VOICE_CONFIG`, and the test checks each one.

```text
voice_name: Brian
voice_id: Gubgw9l4dtIoQA9YZHgx
model_id: eleven_multilingual_v2
stability: 0.5
similarity_boost: 0.75
style: 0.0
use_speaker_boost: true
speed: 1.0
output_format: mp3_44100_192
sample_rate_hz: 48000
bit_depth: 24
channels: 1
trim_threshold_db: -45.0
trim_pad_s: 0.06
fade_s: 0.01
peak_ceiling: 0.98
rms_target_dbfs: -19.3451
```

| Setting | Value | Meaning |
|---|---|---|
| Voice | Brian, `Gubgw9l4dtIoQA9YZHgx` | The ElevenLabs voice the iCentral hero and Double Click series use. |
| Model | `eleven_multilingual_v2` | Same model as iCentral. Billed at 1 credit per character of the spoken text (see [`series-estimate.md`](series-estimate.md)). |
| Stability | 0.5 | |
| Similarity boost | 0.75 | |
| Style | 0.0 | |
| Speaker boost | on | |
| Speed | 1.0 | |
| API format | `mp3_44100_192` | What the API is asked for, as in the iCentral renderer. The MP3 is kept under `vo/raw/` so a re-level costs no credits. An account below the Creator tier is refused this format (HTTP 403); `SA_VO_OUTPUT_FORMAT=mp3_44100_128` asks for another MP3 format instead, and is recorded in the masters' manifest. Unset, nothing changes. |
| Master format | 48 kHz, 24-bit PCM WAV, mono | ffmpeg decodes the MP3 to 48 kHz mono floats; the script trims, levels and writes the WAV. |
| Trim | -45 dB below the line's peak | On a 240-sample moving average of the absolute signal, padded by 0.06 s each side, with 10 ms linear fades. Identical to the iCentral `trim()`; `test_render_brian.py` checks the port against a NumPy copy of the original. |
| Loudness | RMS -19.3451 dBFS | Each line is scaled to this RMS, then pulled down if its peak would pass 0.98. |
| Continuity | `previous_text` / `next_text` | Each line is sent with its neighbours' text (or its own `previous_text` / `next_text` from `episode.json`), lexicon applied, so the delivery joins up across lines. |

## How the RMS target was measured

- **Method.** `python3 video/vo/measure_rms.py` reads every `*.wav` in `~/Documents/iCentral_MarCom/04-vo/brian/masters-48k24/` read only, takes each file's RMS over all its samples as floats in [-1, 1), and averages the 24 per-file values. That is exactly the target the iCentral renderer computes (`target = mean(rms(sf.read(p)[0]))`), measured once here and stored as a number, so the Spatial Adjust pipeline never reads or copies the iCentral masters at render time.
- **Result.** 24 files; mean RMS 0.107831 linear, **-19.3451 dBFS**. A cross-check with soundfile and NumPy in the media-root venv gave the same 0.107831 (-19.3451 dBFS).
- **Date.** Measured 2026-10-19. The masters folder was last modified 2026-10-13 13:09:51 local time, and no file in it is newer.
- **No WAV was copied.** The masters stay in the iCentral MarCom folder; only the number above is recorded.

To re-measure (for example if the iCentral masters are re-cut), run the script, paste its last line into the fenced block above, and re-render: a changed target re-levels every line from its saved MP3 without sending anything to the API.

```bash
python3 video/vo/measure_rms.py --per-file
```

If the `rms_target_dbfs` line is missing or not a number between -60 and 0, `render-brian.py` stops before reading the key or sending anything, and says where the line belongs.

## Lexicon

[`lexicon.json`](lexicon.json) rewrites product terms, station ids and units into the words Brian should say. It changes only the text sent to the API; `episode.json`, the render report, the captions and every on-screen label keep the written form.

- It is an ordered JSON list of `{written, spoken, note}` entries, applied top to bottom, each to the output of the one before.
- A plain entry matches its `written` form as a whole word, case-sensitive: `ET` matches "today's ET" but not "ETo" or "Et".
- An entry with `"regex": true` treats `written` as a Python regular expression and `spoken` as a template, with `$1` to `$9` for the capture groups. The station rule turns `3AP1` into "hole 3, A P 1".
- Every written form was checked against the guides' own wording in `Learn Spatial Adjust.dc.html` and the station table in `SpatialAdjustApp.dc.html:169-186`. `dS/m` is not in the lexicon because no guide uses it, and neither is a singular `1 mm`; `test_lexicon.py` fails if an entry's written form appears nowhere in the guides.

| Written | Spoken |
|---|---|
| `3AP1` (any `<hole>AP<n>`) | hole 3, A P 1 |
| `AP` | A P |
| `IntelliDash` | Intelli-Dash |
| `TurfRad` | Turf Rad |
| `Lynx` | Links |
| `Spatial Adjust` | Spatial Adjust |
| `Avg.`, `Avg` | average |
| `% Adj.` | percent adjustment |
| `VWC` | V W C |
| `ET` | E T |
| `17%`, `27.6%` | 17 percent, 27.6 percent |
| `10 mm` | 10 millimetres |

`python3 video/vo/render-brian.py --episode <episode.json> --dry-run` prints the spoken form of every line the lexicon changes, so a new term can be checked before any credits are spent.

### Lexicon check

One line that says every term once is in [`fixtures/episode.vo-lexicon-check.json`](fixtures/episode.vo-lexicon-check.json). Render it, and listen, whenever the lexicon changes:

```bash
python3 video/vo/render-brian.py --episode video/vo/fixtures/episode.vo-lexicon-check.json
```

The WAV lands in `~/Documents/SpatialAdjust_MarCom/episodes/vo-lexicon-check/vo/lexicon.wav`.

| Date | Lexicon | Render | Listening |
|---|---|---|---|
| 2026-10-19 | the 12 entries above | 199 characters, 16.81 s, 48 kHz 24-bit mono; RMS -19.55 dBFS (the 0.98 peak ceiling took 0.2 dB off the target), peak -0.18 dBFS | Not yet heard by a person. Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22: the spoken forms stand as rendered, and the owner plays this WAV at the review (see `docs/review-agenda.md`). |
