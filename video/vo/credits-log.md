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
