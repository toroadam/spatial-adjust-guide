# ElevenLabs credits log

One row per run of `video/vo/render-brian.py` that talks to the API (every run except `--dry-run`), appended by the
script. Counts only: the date, the episode id, how many lines and characters were sent to the API in that run, and
the account's remaining character credits before and after it, read from `GET /v1/user/subscription`. Nothing else
from the account, and never the key, is ever written here.

| Date | Episode | Lines sent | Characters sent | Credits remaining before -> after |
|---|---|---|---|---|
| 2026-10-19 19:59 | vo-lexicon-check | 1 | 199 | 357634 -> 357546 |
| 2026-10-20 09:53 | understand-spatial-adjust | 11 | 1118 | 357437 -> 355147 |
| 2026-10-20 09:53 | map-navigation | 11 | 1178 | 357437 -> 355147 |
| 2026-10-20 09:53 | understanding-vwc | 11 | 1228 | 357437 -> 355147 |
| 2026-10-20 09:53 | dashboard-overview | 11 | 1675 | 357437 -> 355147 |
