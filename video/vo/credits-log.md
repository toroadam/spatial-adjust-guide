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
