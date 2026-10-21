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
| 2026-10-20 19:50 | target-profiles | 0 | 0 | 29529 -> 29529 |
| 2026-10-20 19:50 | creating-profiles | 0 | 0 | 29529 -> 29529 |
| 2026-10-20 19:50 | updating-profiles | 0 | 0 | 29529 -> 29529 |
| 2026-10-20 19:50 | seasonal-profiles | 0 | 0 | 29529 -> 29529 |
| 2026-10-20 19:52 | target-profiles | 9 | 1235 | 29148 -> 28416 |
| 2026-10-20 19:52 | creating-profiles | 9 | 1083 | 28416 -> unknown |
| 2026-10-20 19:53 | creating-profiles | 0 | 0 | 27269 -> 27269 |
| 2026-10-20 19:55 | updating-profiles | 9 | 1075 | 25131 -> unknown |
| 2026-10-20 19:55 | updating-profiles | 0 | 0 | 22998 -> unknown |
| 2026-10-20 19:56 | updating-profiles | 0 | 0 | 21407 -> 21407 |
| 2026-10-20 19:57 | seasonal-profiles | 9 | 1126 | 21407 -> unknown |
| 2026-10-20 19:57 | seasonal-profiles | 0 | 0 | 20520 -> 20520 |
