# Beta surfaces: what develop and beta show that production does not

This is the authoritative list of Spatial Adjust beta content. Beta content is behaviour on
develop and the beta environment that is not on production. Every commit that separates the two
pinned SHAs is classified below. The list at the end gives each beta surface a stable id, and
`src/release.json` uses those ids as the basis for any beta section of a guide. The build reads
`SA_SHOW_BETA` (see `src/release.mjs`) to decide whether beta content is published.

The starting point was [`changed-surfaces.md`](changed-surfaces.md), which is read-only here. That
file lists commits that touch the searched Spatial Adjust paths since the 2026-08-13 baseline, so
its counts (24 and 33) measure something else. This file counts the divergence between
production and develop, which is 6 and 18 commits.

Every command was read-only (`git log`, `git show`, `git diff`, `git grep`, `git merge-base`).
Behaviour is described in prose and no IntelliDash code is reproduced. `en-us.json` key names and
English labels are product copy and are quoted. Line numbers are on the develop SHA unless a
citation says "production".

## Pins

| Name | Ref | SHA | Commit date | `site/package.json` version |
|---|---|---|---|---|
| production | `origin/Deployments/release/261014_phase_3a` (newest `Deployments/release/*` on 2026-10-19) | `1aa4f28622cc3cc9637f0d61a438bf16bcf01924` | 2026-10-15 | 2.5.261015 |
| beta and develop | `origin/Deployments/beta/261015_tr_v3_api_sprt` and `origin/develop`, the same SHA | `bd39f465cf5a7ae0356a59825250b36044085714` | 2026-10-15 | 2.5.261012 |
| merge base | `git merge-base` of the two | `f954ae1e45e8f94f78de56efdb13419f876ecd43` | 2026-09-21 | n/a |

These match [`sources.json`](sources.json). On 2026-10-19, after a fetch, no newer release branch
existed and develop had not moved.

## Method

- **Develop-only commits** come from the range `1aa4f286..bd39f465`. It holds 18 commits and none
  of them is a merge.
- **Production-only commits** come from the range `bd39f465..1aa4f286`. It holds 6 commits.
- Each commit's file list was read with `git show --stat`. The Spatial Adjust paths were then
  compared with `git diff 1aa4f286 bd39f465`. Those paths are `site/src/app/spatial-adjust`,
  `site/src/app/api/spatial-adjust`, the `SPATIAL_ADJUST` block of `site/src/assets/i18n/*.json`,
  `api/Services/SpatialAdjustService.cs`, `api/Services/SpatialAdjustLogic.cs`,
  `api/BackgroundTasks/ProcessSpatialAdjustDataService.cs`,
  `api/Controllers/SpatialAdjustController.cs`, `api/Services/TerraRadService.cs`,
  `api/Models/TerraRadModel.cs`, `api/Domain/SpatialAdjust.cs` and `api/Migrations/`. Commits
  outside those paths were read too, to confirm that nothing in them reaches the Spatial Adjust
  screen.
- Each commit gets exactly one classification:
  - **beta** means a Spatial Adjust behaviour, label or screen that a user can see on beta and
    not on production.
  - **on-both** means production has an equivalent change.
  - **no-guide-impact** covers logging, refactors, tests, version numbers, the demo site and
    anything that is not Spatial Adjust.
- A beta row names what a user sees, the guides it affects, a proposed treatment and develop
  citations. There are three treatments. A **beta step in a GA guide** adds one step to a guide
  that is otherwise GA. A **new beta guide** is a whole guide that only beta users can follow. A
  **beta guide candidate** is used when the reproduction cannot draw the surface, and it is
  listed here without adding guide text.

## Develop-only commits (18)

Oldest first. Under Citations, paths are relative to `site/src/app/` or `api/`. "SAS" stands for
`api/Services/SpatialAdjustService.cs` and "TRS" stands for `api/Services/TerraRadService.cs`.

| SHA | Date | What changed | Spatial Adjust paths | Classification | Guides | Treatment | Citations (develop) |
|---|---|---|---|---|---|---|---|
| `3ba15c48` | 2026-09-21 | In Demo Mode, the dashboard no longer starts the Lynx Cloud retrieval timeout when it loads data. | `spatial-adjust/components/sa-dashboard/sa-dashboard.component.ts` | no-guide-impact | none | none | `sa-dashboard.component.ts:492`. This affects only the demo site, and no guide teaches Demo Mode. |
| `14228cd6` | 2026-09-22 | The German catalogue gains six labels that the Spatial Adjust screen uses. They are the Layers and filter-tab "All Stations" (`CASE_SENSITIVE.ALL_STATIONS`), Bulk Adjust's "Replace" and "Shift" (`STRINGS.REPLACE`, `STRINGS.SHIFT`), "Calculation ET" (`SPATIAL_ADJUST.CALCULATION_ET`), and the Settings labels "Lynx Reference Amount ({{unitsAbbr}})" and "Daily Max Amount ({{unitsAbbr}})" (`SPATIAL_ADJUST.LYNX_REFERENCE_IN_UNITS_X`, `SPATIAL_ADJUST.MAX_AMOUNT_IN_UNITS_X`). The commit subject is a bug-tracker case number. | `site/src/assets/i18n/de-de.json` | no-guide-impact | preferences (step "Language applies immediately"); the German reproduction labels in map-navigation, bulk-adjustments and calculation-settings | none | `site/src/assets/i18n/de-de.json:396`, `:810`, `:874`, `:983`, `:999-1000`. The screen uses these keys at `sa-map-overlay.component.html:50`, `sa-table-threshold-filter.component.html:6`, `sa-bulk-adjust-dlg.component.html:33` and `:41`, `sa-dashboard.component.html:33`, and `sa-settings-dlg.component.ts:358-359`. See the reasoning below the table. |
| `a2121e34` | 2026-10-02 | Starts the move to the TurfRad v3 API. Each stored scan now keeps its date as the course-local date of TurfRad's measurement time, plus the UTC time TurfRad loaded the scan. Moisture is stored as a decimal, and the two per-scan alert flags are dropped, which nothing on the screen reads. A migration reshapes the scans table. The adjustment pass now decides whether a scan is today's from the load time. | `api/Domain/SpatialAdjust.cs`, `api/Migrations/20261002234822_UpdateSpatialAdjustScansForTrV3Api.cs`, `api/Models/TerraRadModel.cs`, `SAS`, `TRS` | **beta** (`scan-day-from-load-time`) | understanding-vwc, station-details, suggested-adjustments | beta guide candidate | `api/Domain/SpatialAdjust.cs:151-157`; `SAS:2789-2798` (the stored dates); `SAS:3018-3045` (the today's-scan test uses the load time); `SAS:3068` (a new scan clears a manual % Adj.). Production uses TurfRad's recorded date for both purposes (production `SAS:2984-3007`, `:3045`). |
| `8f9ca024` | 2026-10-03 | Before each fetch, the server asks TurfRad whether anything was loaded since a given time. When nothing was, the server skips the seven-day re-read and also skips the clean-up that deletes stored scans. It runs a new pass that writes today's adjustment for each station with recent history, but only if none exists yet for today. | `SAS`, `TRS`, `api/Models/TerraRadModel.cs` | **beta** (`stale-scans-kept`, `suggestion-held-without-new-scan`) | dashboard-overview, map-navigation, calculation-questions, station-zero, suggested-adjustments, understanding-vwc | beta step in a GA guide (`stale-scans-kept`); beta guide candidate (`suggestion-held-without-new-scan`) | `SAS:2140-2152` (the new branch); `SAS:2575` (stop when TurfRad reports nothing new); `SAS:3266-3326` (the pass); `TRS:104-134` (the "anything new?" query); `api/Models/TerraRadModel.cs:34`. |
| `3886ebcd` | 2026-10-03 | Moves the adjustment arithmetic into one function that both passes share. The formula does not change for the normal pass. The new no-new-data pass now models from the older of the station's two most recent days, where it previously used the newest. | `SAS` | **beta** (`suggestion-held-without-new-scan`) | understanding-vwc, suggested-adjustments | beta guide candidate | `SAS:3211-3232`; `SAS:3217` (the prior day's prediction is taken from the second of the two most recent rows); `SAS:3304-3312`. |
| `278335e0` | 2026-10-03 | The "anything new?" question now uses the time the last processing run finished, less five minutes. The TurfRad proxy endpoint passes the site through. | `SAS`, `TRS`, `api/Controllers/TerraRadController.cs` | **beta** (makes `stale-scans-kept` and `suggestion-held-without-new-scan` live) | as for `8f9ca024` | as for `8f9ca024` | `TRS:114-117`, `:206-210`; `SAS:2169` (every run, empty or not, moves the time forward); `api/Controllers/TerraRadController.cs:24`. |
| `8dcc21cf` | 2026-10-03 | Adds tests for the no-new-data pass and makes the methods visible to them. | `SAS`, `TRS` | no-guide-impact | none | none | `api/Tests/IntelliDashApi.Tests/SpatialAdjustNoNewScansTests.cs` (new); no behaviour change. |
| `62b8d917` | 2026-10-03 | Adds tests, lets tests replace the HTTP layer, and moves the formatting of the five-minute overlap time into a helper. | `TRS` | no-guide-impact | none | none | `TRS:206-210`; `api/Tests/IntelliDashApi.Tests/TerraRadServiceTests.cs`, `SpatialAdjustScanMappingTests.cs` (new). |
| `70333697` | 2026-10-05 | Adds the v3 response model. When the site has no configured TurfRad course, it looks up the organisation's single course, because v3 needs one. It keeps the newest scan per sprinkler by measurement date. | `SAS`, `TRS`, `api/Models/TerraRadModel.cs` | no-guide-impact | none | none | `TRS:87-91`, `:175-200`; `SAS:2590-2591`. This supports the beta path, but nothing on the screen differs because of it alone. Keeping the newest scan by measurement date matches production. |
| `48354a91` | 2026-10-11 | Removes one blank line. | `SAS` | no-guide-impact | none | none | none. |
| `e4a9c63d` | 2026-10-12 | When TurfRad reports more than one course for an organisation, the server queries without a course, as production does, instead of failing. | `TRS` | no-guide-impact | none | none | `TRS:187-199`. |
| `10d2e231` | 2026-10-12 | Logs when TurfRad has nothing new. | `TRS` | no-guide-impact | none | none | `TRS:131`. |
| `44c1efc6` | 2026-10-12 | Raises the API version for the dev deployment. | none (`api/appsettings.Development.json`) | no-guide-impact | none | none | none. |
| `ab9c7e34` | 2026-10-12 | Raises the site version to 2.5.261012. | none (`site/package.json`) | no-guide-impact | none | none | none. |
| `526c1bd8` | 2026-10-14 | Raises the level of one log message about creating scans. | `SAS` | no-guide-impact | none | none | `SAS:2820`. |
| `9b4329e8` | 2026-10-15 | Sends browser log output to telemetry instead of the console. | none (`site/src/app/common/services/logger.service.ts`, `site/src/environments/*`) | on-both | none | none | Production commit `1aa4f286` makes the same change. The two differ only in the production log level, which `45fb0ef2` sets. |
| `d9003fec` | 2026-10-15 | Adds installation and course identifiers to the log lines written while Lynx Cloud data loads. | none (`site/src/app/api/lynx-cloud/cloud-service-base.ts`) | no-guide-impact | none | none | Logging only. Nothing on the screen changes. |
| `bd39f465` | 2026-10-15 | Adds the Announcements button (bullhorn, `STRINGS.ANNOUNCEMENTS`) to the Spatial Adjust toolbar beside the Settings gear. | `spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.html`, `.ts` | on-both | dashboard-overview | none | `sa-main-toolbar.component.html:61-65`, `sa-main-toolbar.component.ts:354-358`. Production commit `ae2b1705` adds the same button. The files at the two SHAs differ only by one blank line. |

### Why the German catalogue commit is not beta content

The six keys that `14228cd6` adds are missing from production's German catalogue, so a German
production user sees those six labels in English (`app-initializer.service.ts:38` falls back to
English). The German guide does not follow production for these labels. Its screen strings come
from IntelliDash's catalogues where the product has a translation, and from the guides' own
translation where it does not (`scripts/app-strings.mjs`). So the German guide already shows
German for all six labels. Three of them use the same words as develop, and three use different
words. The commit adds no behaviour, no English label and no screen. The beta switch works per
guide and per step, not per locale label, so it has no way to show "German wording that only
beta has", and a step that did would teach nothing new. The commit is therefore classified
no-guide-impact. The German labels that the guide shows but production does not are a question
of reproduction fidelity, not of release status. That question is on the review agenda.

## Production-only commits (6)

| SHA | Date | What changed | Spatial Adjust paths | Classification | Guides | Citations (production) |
|---|---|---|---|---|---|---|
| `ae2b1705` | 2026-10-14 | Adds the Announcements button to the Spatial Adjust toolbar. | `sa-main-toolbar.component.html`, `.ts` | on-both | dashboard-overview | `sa-main-toolbar.component.html:61-65`, `sa-main-toolbar.component.ts:354-358`. Develop commit `bd39f465` is equivalent. |
| `19ebfd39` | 2026-10-14 | Raises the site version. | none (`site/package.json`) | no-guide-impact | none | none. |
| `14b7c20a` | 2026-10-14 | Fixes the test project's build for deployment. | none (`api/IntelliDashApi.csproj`) | no-guide-impact | none | none. |
| `2503d032` | 2026-10-14 | Removes three IntelliDash dashboard widgets from the add-widget menu and the setup wizard: Decision Tree, DTN Weather and Weather Averages. | none (`site/src/app/api/widgets/widget-manager.service.ts`, `site/src/app/core/dashboard/setup-wizard/step-enabling/step-enabling.component.ts`) | no-guide-impact | none | Not Spatial Adjust. Beta still offers those widgets, but no guide covers them. |
| `45fb0ef2` | 2026-10-15 | Changes the telemetry log level and raises the version. | none (`site/src/environments/environment.toro-prod.ts`, `site/package.json`) | no-guide-impact | none | Logging only. |
| `1aa4f286` | 2026-10-15 | Sends browser log output to telemetry instead of the console. | none (`site/src/app/common/services/logger.service.ts`, `site/src/environments/*`) | on-both | none | Develop commit `9b4329e8` is equivalent. |

## Candidates re-checked

The candidates that `changed-surfaces.md` names were each checked again against the code rather
than taken as given.

- **TurfRad v3: today's adjustment is written when no new scan arrived.** Confirmed, with a
  narrower effect than the ledger's develop notes suggest. Those notes say the display is
  unchanged. Production also writes today's adjustment on a day with no new scan. It re-reads
  the last seven days on every processing run and recalculates today's row from that history
  (production `SAS:2103-2133`, `:2510`, `:3031-3032`). The develop pass differs in three ways:
  - It runs only when TurfRad has loaded nothing since the previous run.
  - It writes today's row once and leaves it alone afterwards.
  - It never deletes stored scans.

  Within a single day, inside the seven-day window, the screen looks the same on both builds,
  which is where the develop notes are right. The differences are in `stale-scans-kept` and
  `suggestion-held-without-new-scan` below.
- **TurfRad v3: the last scan date has no time.** Confirmed in the API. The last-scan-date call
  now returns a date only (`SAS:156`). The only screen that shows it is the diagnostics dialog,
  and that dialog already drops the time portion before display
  (`sa-diagnostics-dlg.component.ts:76`), so nothing on the screen changes. This is not a beta
  surface.
- **`14228cd6` (German catalogue).** This is a product translation and is classified
  no-guide-impact. The reasoning is in the section above.
- **`3ba15c48` (demo site).** This affects only Demo Mode and is classified no-guide-impact.
- **`526c1bd8`, `9b4329e8`, `d9003fec` (logging).** These are logging only and nothing on the
  screen changes. `9b4329e8` has a production equivalent and is classified on-both. The other two
  are no-guide-impact.

## Target Profiles

**Target Profiles is GA, not beta.** The settings dialog's Target Profiles menu entry is live at
`site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts:55` at
production `1aa4f286`, and no environment check gates it. The Target Profiles work reached develop
in merge `68a7e37b` (2026-09-14), which is an ancestor of the merge base `f954ae1e`, so both
builds have it. None of the 24 divergence commits touches it. `src/release.json` records the four
Target Profiles guides (target-profiles, creating-profiles, updating-profiles, seasonal-profiles)
as ga on this evidence. The guides' figures still draw a three-card design, while production
shows a table of five fixed slots per course (see `changed-surfaces.md`). That is a gap in the
reproduction, not a release status.

## Beta surfaces

This is the authoritative beta list. Each heading is the surface's stable id. In
`src/release.json`, a beta section cites its surface as `docs/claims/beta-surfaces.md#<id>`.
Today no guide contains beta content, so every guide is ga and has no sections. When a beta step
is added to a guide, its section in `src/release.json` names the id here.

### stale-scans-kept

- **What a beta user sees.** Suppose TurfRad loads nothing new for a course for more than seven
  days. Beta keeps the last stored scans, so:
  - The stations stay in the table with their last scan date.
  - They stay on the map as clear (not current) pins.
  - Under Option 2 they get a modelled value and a modelled suggestion every day.

  Pressing Request latest scan data does not change this unless TurfRad loaded something in the
  last two days.
- **What production does instead.** Every processing run re-reads the last seven days of scans.
  Once that window is empty, it deletes the stored scans and writes no new adjustment. The
  stations drop out of the map and the table rather than going stale (production
  `SAS:2134-2146`, `:2510`, `:2817-2836`).
- **Guides affected.** dashboard-overview ("Read the map") and map-navigation ("Pins are coloured
  by measured moisture") both say a pin means a scan within the past seven days. calculation-questions
  ("A dash instead of a number", "If the whole course is stale, check the source") and
  station-zero ("Check the scan date") explain stale and missing values. Those sentences describe
  production and stay GA.
- **Proposed treatment.** A beta step in a GA guide. Add one step to calculation-questions after
  "If the whole course is stale, check the source". It says that on the beta build a course that
  TurfRad has not updated keeps showing its last scans and modelled values beyond seven days.
- **Can the reproduction show it?** Yes. The existing stale-scan figures already draw what the
  reader sees: clear pins, grey italic modelled values and an older scan date. No new state is
  needed.
- **Commits.** `8f9ca024`, `278335e0`.
- **Citations (develop).** `SAS:2140-2152`, `:2169`, `:2575`, `:3266-3326`; `TRS:104-134`;
  `SAS:978-992` (Request latest scan data moves the "since" time back two days).

### suggestion-held-without-new-scan

- **What a beta user sees.** On a day when TurfRad has loaded nothing new, beta writes today's
  suggestion once, at the first processing run of the day, and later runs that day leave it
  alone. On production every processing run, about every 30 minutes, recalculates today's
  suggestion, so it can move during the morning as today's ET settles (production `SAS:2838-2884`).
  The value beta writes is modelled from the older of the station's two most recent days (`SAS:3217`,
  `:3304-3312`). Production's later runs settle on the previous day's prediction. So on such a
  day, beta's modelled VWC and suggestion can differ from production's for the same station.
  Edits that ask the server to recalculate behave the same on both builds: a Target VWC edit, a
  Bulk Adjust, a settings save and applying a Target Profile.
- **Guides affected.** suggested-adjustments ("Find the two adjustment columns"),
  understanding-vwc ("Modelled: the fallback"), calculation-questions ("Grey italics mean
  modelled"). None of their sentences becomes false. The difference is in how the value changes
  over the day.
- **Proposed treatment.** A beta guide candidate. Nothing in a single figure differs from
  production, and the reproduction has no way to show a value changing over the day. It is
  listed for the expert review because the "older of the two most recent days" input may be a
  defect rather than a design choice.
- **Can the reproduction show it?** No.
- **Commits.** `8f9ca024`, `3886ebcd`, `278335e0`.
- **Citations (develop).** `SAS:2140-2152`, `:3211-3232`, `:3266-3326`.

### scan-day-from-load-time

- **What a beta user sees.** On beta the server decides whether a scan is today's from the time
  TurfRad loaded it (UTC), while the table's scan date and current-scan styling still use the
  scan's own course-local measurement date (`spatial-adjust-course.model.ts:173-182`).
  Production uses TurfRad's recorded date for both. The difference shows when TurfRad loads a
  scan on a later day than it was measured. On beta, today's suggestion is then calculated from
  that reading as if it were measured, and a manual % Adj. override is cleared as it is for a new
  scan (`SAS:3068`). Meanwhile the table still dates the reading to the earlier day and styles it
  as modelled.
- **Guides affected.** understanding-vwc ("Measured: the scan mean"), station-details ("Watch for
  a modelled child"), suggested-adjustments ("Override where you disagree").
- **Proposed treatment.** A beta guide candidate. It needs the experts to say how often TurfRad
  loads a scan on a later day than it was measured before any guide text is written.
- **Can the reproduction show it?** No. The reproduction has no load time.
- **Commits.** `a2121e34`.
- **Citations (develop).** `api/Domain/SpatialAdjust.cs:151-157`; `api/Models/TerraRadModel.cs:48-58`;
  `SAS:2789-2798`, `:3018-3045`, `:3068`.

### Not beta

Every other commit in the two ranges is on-both or no-guide-impact, as the tables show. That
includes the Announcements button, which is on both builds, and Target Profiles, which is GA.
