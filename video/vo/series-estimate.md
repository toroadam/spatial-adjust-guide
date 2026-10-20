# VO credit estimate: pilot and series

Generated 2026-10-20 by `python3 video/vo/estimate.py --write`. Regenerate it the same way whenever the pilot script, the lexicon or the guides change, and after every pilot render with the real pilot numbers (`--episode` for the locked pilot, `--cps-from` its render report, `--takes` and `--render-seconds`).

## Pilot

Source: `video/episodes/dashboard-overview-pilot/episode.json`. Characters are counted after the lexicon is applied, which is what is sent and billed.

| Line | Characters | Credits | With retakes |
|---|---|---|---|
| vo-intro | 82 | 82 | 164 |
| vo-pins | 68 | 68 | 136 |
| vo-bands | 97 | 97 | 194 |
| **Total** | **247** | **247** | **494** |

48 words, about 13.5 s of narration at 18.32 characters per second. Retake factor 2.

## Pilot, as rendered

From the pilot's VO render report (`episodes/dashboard-overview-pilot/vo/render-report.json` under the media root) and the `dashboard-overview-pilot` rows of [`credits-log.md`](credits-log.md); the take count and the final render's wall time are given on the command line.

| | Estimate | Actual |
|---|---|---|
| VO lines rendered | 3, or 6 with retakes | 3 in 1 run |
| Characters sent | 247, or 494 with retakes | 247 |
| Credits | 247, or 494 with retakes | 109 (0.44 per character) |
| Narration | about 15.3 s at 16.16 characters per second | 13.48 s, 18.32 characters per second |
| Takes recorded | — | 2 |
| Final render wall time | — | 46 s |

## Series

Assumptions:

- 26 guides, one episode each, counted from the claims ledger (docs/claims/claims.json), which is built from the GUIDES data in Learn Spatial Adjust.dc.html.
- Narration per episode: 20 s for the guides with the fewest steps (4) up to 30 s for the most (6), linear in between. This is an upper bound: title and end cards carry no narration.
- 18.32 characters per second (dashboard-overview-pilot render report: 247 characters in 13.48 s).
- 1 credit per character (eleven_multilingual_v2, ElevenLabs pricing read 2026-10-19; to be confirmed against the account's plan).
- Retake factor 2: every line rendered 2 times on average.

| Guide | Steps | Narration (s) | Characters | Credits | With retakes |
|---|---|---|---|---|---|
| Apply a bulk adjustment (`bulk-adjustments`) | 4 | 20.0 | 366 | 366 | 732 |
| Calculation methods (`calculation-methods`) | 5 | 25.0 | 458 | 458 | 916 |
| Calculation questions (`calculation-questions`) | 5 | 25.0 | 458 | 458 | 916 |
| Calculation settings (`calculation-settings`) | 5 | 25.0 | 458 | 458 | 916 |
| Creating profiles (`creating-profiles`) | 4 | 20.0 | 366 | 366 | 732 |
| Dashboard overview (`dashboard-overview`), pilot | 5 | 25.0 | 458 | 458 | 916 |
| Editing station targets (`editing-station-targets`) | 4 | 20.0 | 366 | 366 | 732 |
| Enable and disable stations (`enable-disable-stations`) | 5 | 25.0 | 458 | 458 | 916 |
| Filter by % Adj. (`filter-adjustments`) | 5 | 25.0 | 458 | 458 | 916 |
| Map navigation (`map-navigation`) | 5 | 25.0 | 458 | 458 | 916 |
| Set a minimum threshold (`minimum-threshold`) | 5 | 25.0 | 458 | 458 | 916 |
| Preferences (`preferences`) | 4 | 20.0 | 366 | 366 | 732 |
| Push failures (`push-failures`) | 4 | 20.0 | 366 | 366 | 732 |
| Push changes to Lynx (`push-to-lynx`) | 6 | 30.0 | 550 | 550 | 1100 |
| Get fresh scan data (`request-scan-data`) | 5 | 25.0 | 458 | 458 | 916 |
| Reviewing changes (`reviewing-changes`) | 5 | 25.0 | 458 | 458 | 916 |
| Managing seasonal profiles (`seasonal-profiles`) | 4 | 20.0 | 366 | 366 | 732 |
| Station details (`station-details`) | 4 | 20.0 | 366 | 366 | 732 |
| Why is this station 0%? (`station-zero`) | 5 | 25.0 | 458 | 458 | 916 |
| Understand suggested adjustments (`suggested-adjustments`) | 5 | 25.0 | 458 | 458 | 916 |
| Apply a target profile (`target-profiles`) | 4 | 20.0 | 366 | 366 | 732 |
| Threshold questions (`threshold-questions`) | 5 | 25.0 | 458 | 458 | 916 |
| Understand Spatial Adjust (`understand-spatial-adjust`) | 5 | 25.0 | 458 | 458 | 916 |
| Understanding VWC (`understanding-vwc`) | 5 | 25.0 | 458 | 458 | 916 |
| Updating profiles (`updating-profiles`) | 4 | 20.0 | 366 | 366 | 732 |
| Verify results (`verify-results`) | 5 | 25.0 | 458 | 458 | 916 |
| **Total, 26 guides** | | | **11,172** | **11,172** | **22,344** |

If every episode ran 20 s, the series would take 9,516 characters (19,032 credits with retakes); if every episode ran 30 s, 14,300 characters (28,600 credits with retakes).

## Observed billing

From the counts-only rows of [`credits-log.md`](credits-log.md): 2 runs sent 446 characters and the account's remaining count fell by 197 credits, 0.44 credits per character. The estimates above keep 1 credit per character, an upper bound, until the owner confirms the plan's rate. A row's fall can include other use of the same account in the same minutes.

## How to recompute

```bash
python3 video/vo/estimate.py --episode <episode.json>        # one episode, exact
python3 video/vo/estimate.py --series                        # all guides, planning estimate
python3 video/vo/estimate.py --live                          # remaining credits on the account (counts only)
python3 video/vo/estimate.py --write --episode <pilot episode.json> --cps-from <pilot render-report.json> \
    --takes <takes recorded> --render-seconds <final render wall time>
```
