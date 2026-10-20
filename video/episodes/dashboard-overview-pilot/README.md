# Pilot: Dashboard overview, "Read the map"

The first episode taken through the whole pipeline, end to end, to prove it and to write the runbook in [`../../README.md`](../../README.md#runbook) from. The script and its claims are in [`script.md`](script.md); the episode definition is [`episode.json`](episode.json). Media lives under the media root, `~/Documents/SpatialAdjust_MarCom/episodes/dashboard-overview-pilot/`; paths below are relative to that folder unless they start with `video/`.

| Step | Status | Where |
|---|---|---|
| Script lock (G6) | decided by executor, script v1 | [`script.md`](script.md), `video/approvals.md` row G6 |
| Capture | take 1 from the recreation, clean | `capture/raw/take1-recreation.*` |

## Capture

**Chosen take: 1** (`capture/raw/take1-recreation.mp4`). **Takes recorded: 1.** **Incidents: none** (every run exited 0).

The take is from the guide site's own recreation, not from IntelliDash `/demo`: see [`script.md`](script.md#footage-source-the-guide-sites-recreation) for why, and [Demo Mode take for the owner](#demo-mode-take-for-the-owner) for the steps that replace it. The episode lifts the step 2 figure, "Map with the moisture legend.", to fill the frame (`recreationFigure`).

Commands, from the repository root, 2026-10-20:

```bash
node video/capture/director.mjs --episode dashboard-overview-pilot --dry-run                                # plan: 3 beats, 8 targets, about 14.2 s; click guard: no clicks
SA_RECREATION_PORT=8139 node video/capture/director.mjs --episode dashboard-overview-pilot --take 1 --no-record   # rehearsal, exit 0
SA_RECREATION_PORT=8139 node video/capture/director.mjs --episode dashboard-overview-pilot --take 1               # the take, exit 0
```

`SA_RECREATION_PORT=8139`: port 8124, the recreation's default, was held by another checkout's guide server, and the director rightly refused to reuse a server that does not serve this checkout's `dist/` (exit 2). Any free loopback port works.

| Take | Exit | Frames | Wall time | Aborted requests | WebSockets | Documents after arming | Popups | Refusals | Denylist scans / hits | Lifted figure box |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 (rehearsal, not recorded) | 0 | — | 16 s | 0 | 0 | 0 | 0 | 0 | 26 / 0 | 0, 0, 1920, 1080 |
| 1 | 0 | 852 (14.2 s at 60 fps, 3840x2160) | 387 s | 0 | 0 | 0 | 0 | 0 | 58 / 0 | 0, 0, 1920, 1080 |

From `capture/raw/take1-recreation-safety.json`. The one document load is the entry page itself, before arming. The cue log (`take1-recreation-log.json`) has `vo-pins` at 1.767 s and `vo-bands` at 6.367 s after the start flash. The contact sheet (`take1-recreation_sheet.jpg`) shows the start flash, the lifted app with the restyled turf map, the cursor on the pins and the highlight box on the legend; no guide prose and no page header are in frame.

The denylist checked during the take is the 7 terms of `sanitize.local.json` (counts only); `video/capture/overlay.local.json` does not exist on this machine, which is fine for the recreation, whose names are already fictional, and would refuse a Demo Mode take with exit 5.

## Demo Mode take for the owner

The pilot becomes a Demo Mode episode by these steps, which need the owner in person (a hand sign-in) and local files no executor can write:

1. Create `video/capture/capture.local.json` from `video/capture/capture.example.json` with the dev host (`entryUrl` ending `/spatialadjust/demo`, `allowedHosts`, `apiHosts`), and `video/capture/overlay.local.json` with the demo data's real-to-fictional name pairs and the denylist (both gitignored; see `video/README.md`, "Capture").
2. Start the capture Chrome with its profile in the media root (the director prints the exact command when none is listening):
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/Documents/SpatialAdjust_MarCom/auth/chrome-profile"`
3. In `episode.json`, set `"source": "demo"`, remove `recreationPath` and `recreationFigure`, and replace the `[data-sa-frame] >> ...` targets with IntelliDash's own (read from the IntelliDash source, cited by path and line only). That changes the episode, so it needs a new G6 row.
4. `npm run video -- capture --episode dashboard-overview-pilot --dry-run`, then `--take 1 --no-record`, then `--take 1`; sign in to the demo form in the tab the director opens. The take is `capture/raw/take1.mp4`, beside the recreation take, never over it.
5. Build, render, mix and verify as below with `--take 1 --source demo`.
