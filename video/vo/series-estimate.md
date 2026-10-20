# VO credit estimate: pilot and series

Generated 2026-10-19 by `python3 video/vo/estimate.py --write`. Regenerate it the same way whenever the pilot script, the lexicon or the guides change; PI-ICNT-SW-1084-4 refreshes it with the real pilot numbers (`--episode` for the locked pilot and `--cps-from` its render report).

## Pilot

Source: the 70-word placeholder script, `video/vo/fixtures/episode.vo-placeholder.json` (the pilot episode.json does not exist yet). Characters are counted after the lexicon is applied, which is what is sent and billed.

| Line | Characters | Credits | With retakes |
|---|---|---|---|
| vo-intro | 96 | 96 | 192 |
| vo-map | 86 | 86 | 172 |
| vo-table | 119 | 119 | 238 |
| vo-push | 143 | 143 | 286 |
| **Total** | **444** | **444** | **888** |

70 words, about 27.5 s of narration at 16.16 characters per second. Retake factor 2.

## Series

Assumptions:

- 26 guides, one episode each, counted from the claims ledger (docs/claims/claims.json), which is built from the GUIDES data in Learn Spatial Adjust.dc.html.
- Narration per episode: 20 s for the guides with the fewest steps (4) up to 30 s for the most (6), linear in between. This is an upper bound: title and end cards carry no narration.
- 16.16 characters per second (iCentral Double Click #1 (Home) render report: 1469 characters in 90.90 s).
- 1 credit per character (eleven_multilingual_v2, ElevenLabs pricing read 2026-10-19; to be confirmed against the account's plan).
- Retake factor 2: every line rendered 2 times on average.

| Guide | Steps | Narration (s) | Characters | Credits | With retakes |
|---|---|---|---|---|---|
| Apply a bulk adjustment (`bulk-adjustments`) | 4 | 20.0 | 323 | 323 | 646 |
| Calculation methods (`calculation-methods`) | 5 | 25.0 | 404 | 404 | 808 |
| Calculation questions (`calculation-questions`) | 5 | 25.0 | 404 | 404 | 808 |
| Calculation settings (`calculation-settings`) | 5 | 25.0 | 404 | 404 | 808 |
| Creating profiles (`creating-profiles`) | 4 | 20.0 | 323 | 323 | 646 |
| Dashboard overview (`dashboard-overview`), pilot | 5 | 25.0 | 404 | 404 | 808 |
| Editing station targets (`editing-station-targets`) | 4 | 20.0 | 323 | 323 | 646 |
| Enable and disable stations (`enable-disable-stations`) | 5 | 25.0 | 404 | 404 | 808 |
| Filter by % Adj. (`filter-adjustments`) | 5 | 25.0 | 404 | 404 | 808 |
| Map navigation (`map-navigation`) | 5 | 25.0 | 404 | 404 | 808 |
| Set a minimum threshold (`minimum-threshold`) | 5 | 25.0 | 404 | 404 | 808 |
| Preferences (`preferences`) | 4 | 20.0 | 323 | 323 | 646 |
| Push failures (`push-failures`) | 4 | 20.0 | 323 | 323 | 646 |
| Push changes to Lynx (`push-to-lynx`) | 6 | 30.0 | 485 | 485 | 970 |
| Get fresh scan data (`request-scan-data`) | 5 | 25.0 | 404 | 404 | 808 |
| Reviewing changes (`reviewing-changes`) | 5 | 25.0 | 404 | 404 | 808 |
| Managing seasonal profiles (`seasonal-profiles`) | 4 | 20.0 | 323 | 323 | 646 |
| Station details (`station-details`) | 4 | 20.0 | 323 | 323 | 646 |
| Why is this station 0%? (`station-zero`) | 5 | 25.0 | 404 | 404 | 808 |
| Understand suggested adjustments (`suggested-adjustments`) | 5 | 25.0 | 404 | 404 | 808 |
| Apply a target profile (`target-profiles`) | 4 | 20.0 | 323 | 323 | 646 |
| Threshold questions (`threshold-questions`) | 5 | 25.0 | 404 | 404 | 808 |
| Understand Spatial Adjust (`understand-spatial-adjust`) | 5 | 25.0 | 404 | 404 | 808 |
| Understanding VWC (`understanding-vwc`) | 5 | 25.0 | 404 | 404 | 808 |
| Updating profiles (`updating-profiles`) | 4 | 20.0 | 323 | 323 | 646 |
| Verify results (`verify-results`) | 5 | 25.0 | 404 | 404 | 808 |
| **Total, 26 guides** | | | **9,856** | **9,856** | **19,712** |

If every episode ran 20 s, the series would take 8,398 characters (16,796 credits with retakes); if every episode ran 30 s, 12,610 characters (25,220 credits with retakes).

## Observed billing

From the counts-only rows of [`credits-log.md`](credits-log.md): 1 run sent 199 characters and the account's remaining count fell by 88 credits, 0.44 credits per character. The estimates above keep 1 credit per character, an upper bound, until the owner confirms the plan's rate. A row's fall can include other use of the same account in the same minutes.

## How to recompute

```bash
python3 video/vo/estimate.py --episode <episode.json>        # one episode, exact
python3 video/vo/estimate.py --series                        # all guides, planning estimate
python3 video/vo/estimate.py --live                          # remaining credits on the account (counts only)
python3 video/vo/estimate.py --write --episode <pilot episode.json> --cps-from <pilot render-report.json>
```
