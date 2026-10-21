# ElevenLabs credits log

One row per run of `video/vo/render-brian.py` that talks to the API (every run except `--dry-run`), appended by the
script. Counts only: the date, the episode id, how many lines and characters were sent to the API in that run, and
the account's remaining character credits before and after it, read from `GET /v1/user/subscription`. Nothing else
from the account, and never the key, is ever written here.

| Date | Episode | Lines sent | Characters sent | Credits remaining before -> after |
|---|---|---|---|---|
| 2026-10-19 19:59 | vo-lexicon-check | 1 | 199 | 357634 -> 357546 |
| 2026-10-20 09:29 | dashboard-overview-pilot | 3 | 247 | 357546 -> 357437 |
| 2026-10-20 09:53 | understand-spatial-adjust | 11 | 1118 | 357437 -> 355147 |
| 2026-10-20 09:53 | map-navigation | 11 | 1178 | 357437 -> 355147 |
| 2026-10-20 09:53 | understanding-vwc | 11 | 1228 | 357437 -> 355147 |
| 2026-10-20 09:53 | dashboard-overview | 11 | 1675 | 357437 -> 355147 |
| 2026-10-20 19:52 | suggested-adjustments | 0 | 0 | 28416 -> 28416 |
| 2026-10-20 19:52 | filter-adjustments | 0 | 0 | 28416 -> unknown |
| 2026-10-20 19:52 | reviewing-changes | 0 | 0 | 28416 -> unknown |
| 2026-10-20 19:54 | suggested-adjustments | 11 | 1348 | 27269 -> 25131 |
| 2026-10-20 19:55 | filter-adjustments | 11 | 1461 | 25131 -> 22998 |
| 2026-10-20 19:56 | push-to-lynx | 13 | 1609 | 22998 -> 21407 |
| 2026-10-20 19:57 | reviewing-changes | 11 | 1093 | 21407 -> unknown |
| 2026-10-20 19:58 | verify-results | 11 | 1304 | 20520 -> 19864 |
| 2026-10-20 20:27 | push-to-lynx | 2 | 382 | 18244 -> 18091 |
| 2026-10-20 21:25 | reviewing-changes | 2 | 260 | 18091 -> 18091 |
| 2026-10-21 02:13 | reviewing-changes | 1 | 135 | 17987 -> 17933 |
| 2026-10-21 02:14 | reviewing-changes | 1 | 135 | 17933 -> 17933 |
| 2026-10-21 02:14 | reviewing-changes | 1 | 135 | 17933 -> 17825 |
| 2026-10-21 02:14 | reviewing-changes | 1 | 135 | 17825 -> unknown |
| 2026-10-21 02:21 | reviewing-changes | 1 | 135 | 17771 -> 17771 |
| 2026-10-20 19:50 | editing-station-targets | 0 | 0 | 29529 -> 29529 |
| 2026-10-20 19:51 | editing-station-targets | 9 | 951 | 29529 -> unknown |
| 2026-10-20 20:06 | bulk-adjustments | 9 | 978 | 19460 -> 19347 |
| 2026-10-20 20:07 | enable-disable-stations | 11 | 1156 | 19347 -> 18661 |
| 2026-10-20 20:08 | station-details | 9 | 908 | 18661 -> 18244 |
| 2026-10-20 19:53 | minimum-threshold | 0 | 0 | 28416 -> unknown |
| 2026-10-20 19:53 | minimum-threshold | 11 | 1370 | 27269 -> unknown |
| 2026-10-20 19:54 | calculation-settings | 11 | 1734 | 27269 -> 25131 |
| 2026-10-20 19:55 | calculation-methods | 11 | 1651 | 25131 -> unknown |
| 2026-10-20 19:55 | preferences | 9 | 1593 | 22998 -> unknown |
| 2026-10-20 19:58 | calculation-settings | 2 | 336 | 20520 -> unknown |
| 2026-10-20 19:51 | station-zero | 0 | 0 | 29148 -> 29148 |
| 2026-10-20 19:52 | station-zero | 11 | 1432 | 29148 -> unknown |
| 2026-10-20 19:53 | calculation-questions | 11 | 1152 | 28416 -> 27269 |
| 2026-10-20 19:54 | request-scan-data | 11 | 1460 | 27269 -> unknown |
| 2026-10-20 19:54 | request-scan-data | 0 | 0 | 25131 -> 25131 |
| 2026-10-20 19:55 | threshold-questions | 11 | 1160 | 25131 -> unknown |
| 2026-10-20 19:56 | threshold-questions | 0 | 0 | 22998 -> unknown |
| 2026-10-20 19:57 | threshold-questions | 0 | 0 | 21407 -> unknown |
| 2026-10-20 19:58 | threshold-questions | 0 | 0 | 19864 -> unknown |
| 2026-10-20 20:00 | threshold-questions | 0 | 0 | 19864 -> 19864 |
| 2026-10-20 20:00 | push-failures | 9 | 1011 | 19864 -> 19460 |
