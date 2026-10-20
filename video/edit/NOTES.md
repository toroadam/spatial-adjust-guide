# video/edit port log

The compositor under `video/edit/` is ported from the iCentral MarCom video pipeline. This file is its provenance record: each ported file, where it came from, how long the source was, and every deliberate change. Algorithms are kept as they were; the changes are imports, colours and fonts (moved to `lib/theme.py`), paths (moved to the media root) and how ffmpeg is found.

The iCentral folder is a read-only source. Its tools were changing on the day of the port, so the sources were copied as a snapshot first; the modification time of each source file at snapshot time is listed below.

## Ported files

| Source (iCentral MarCom path) | Lines | Source modified | Target | Changes |
|---|---|---|---|---|
| `~/Documents/iCentral_MarCom/06-edit/compositor/lib/engine.py` | 587 | 2026-10-08 13:03:32 | `lib/engine.py` | Provenance header. Docstring title no longer carries the iCentral epic number. Device override env var `E171_DEV` renamed `SA_VIDEO_DEV`; MPS-or-CPU selection unchanged, so CI without MPS runs on CPU. Five colour literals moved to THEME: background `bg_tint`, blooms `bloom_a` and `bloom_b`, typewriter cursor default `cursor`, frosted card tint default `card_tint`. `from theme import THEME` added. Maths unchanged. |
| `~/Documents/iCentral_MarCom/06-edit/compositor/lib/engine2.py` | 561 | 2026-10-05 10:56:30 | `lib/engine2.py` | Provenance header; docstring title no longer carries the epic number. Strip-peel back face default `#4a4f57` moved to THEME `peel_back`. `from theme import THEME` added. Maths unchanged. |
| `~/Documents/iCentral_MarCom/06-edit/compositor/lib/wallpaper.py` | 131 | 2026-10-04 20:39:46 | `lib/wallpaper.py` | Provenance header. The nine palette literals (and the docstring that listed them) moved to THEME `wall` (`red`, `shade`, `tint`, `g100`, `g90`, `g80`, `g70`, `g40`, `g20`). Device selection honours `SA_VIDEO_DEV` like the engine. The `__main__` writer refuses an output folder outside the media root. Maths unchanged. |
| `~/Documents/iCentral_MarCom/06-edit/compositor/lib/camplan.py` | 101 | 2026-10-07 17:01:05 | `lib/camplan.py` | Provenance header only. |
| `~/Documents/iCentral_MarCom/06-edit/compositor/lib/ff.py` | 86 | 2026-10-06 13:35:18 | `lib/ff.py` | Provenance header and docstring. The hard-coded ffmpeg in the iCentral `.pipeline/bin` folder (overridable by `E171_FFMPEG`) is gone: `FFMPEG` resolves from `$FFMPEG` or PATH, `FFPROBE` from `$FFPROBE`, next to ffmpeg, or PATH. A missing tool, or one whose path or symlink target is under `/tmp`, `/private/tmp`, `/var/folders`, the system temp directory, or contains `/scratchpad` or `/claude-`, raises `FFmpegError` on import (rules shared with `video/lib/media_root.py`). The iCentral `MARCOM` and `RAW` path constants are removed; capture paths come from the episode under the media root. `write_img` refuses a path outside the media root. `probe`, `Reader`, `grab`, `read_png`, `grid`, `shrink` unchanged. |

## New files

| File | Purpose |
|---|---|
| `lib/theme.py` | `THEME`: every colour and font the compositor draws with. Starts with the iCentral values; PI-ICNT-SW-1081-1 sets the Spatial Adjust values. Fonts are the repository's `_ds` Golos UI files (400, 500, 700). |
| `lib/media.py` | Episode folders under the media root (`episode_dir`, with the reserved test episode `_test`) and the output guard `require_media_path`, both on top of `video/lib/media_root.py`. |
