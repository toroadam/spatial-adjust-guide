# Spatial Adjust surfaces changed in IntelliDash since 2026-08-13

This lists every Spatial Adjust frontend, API and label change between the checkout the guides were
written against and the two SHAs pinned in [`sources.json`](sources.json). Feature 6 folds each row
into a guide or logs it as a new-guide candidate, and the verification features use it to tell
where production has moved under a claim.

| Name | SHA | Date |
|---|---|---|
| baseline (local develop the guides were checked against) | `4d8aa61eb6131c5c5ef0f5df5d51079cc2eadedd` | 2026-08-13 |
| production, `origin/Deployments/release/261014_phase_3a` (unconfirmed) | `1aa4f28622cc3cc9637f0d61a438bf16bcf01924` | 2026-10-15 |
| develop, `origin/develop` | `bd39f465cf5a7ae0356a59825250b36044085714` | 2026-10-15 |

Paths searched: `site/src/app/spatial-adjust`, `site/src/app/api/spatial-adjust`,
`site/src/assets/i18n/en-us.json`, `api/Services/SpatialAdjustService.cs`,
`api/BackgroundTasks/ProcessSpatialAdjustDataService.cs`, `api/Controllers/SpatialAdjustController.cs`,
`site/docs` and `api/docs`. The full file lists of both ranges were also scanned for Spatial
Adjust work outside those paths, such as background jobs, migrations, the shared broadcast service
and the other ten catalogues. Neither range changes anything under `site/docs` or `api/docs`.

Line numbers are on the production SHA unless a row says otherwise. Behaviour is described in
prose, and no IntelliDash code is reproduced. Label text and `en-us.json` key names are product
copy and are quoted.

## The headline

**Target Profiles ships in production.** The settings dialog's Target Profiles menu entry, which
was commented out at the baseline, is live at
`site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts:55` on both
production and develop, and no environment check gates it. The guides' four disclaimers ("still in
development and is not in the shipping build yet") are therefore false on production. The shipped
tab is a per-course table of five fixed slots, not the three-card design in the figures. This
overturns a premise of the verification plan: the Target Profiles guides must be checked against
production, not against the feature branches. "Not shipping" is no longer the expected status for
them.

## Commit ranges

Commits touching the searched paths. Each count includes one merge commit, `68a7e37b`, which brings
the Target Profiles work into develop.

| Range | Commits | Files | Diff |
|---|---|---|---|
| baseline..production | 24 | 32 | +1647 −210 |
| baseline..develop | 33 | 32 | +1891 −312 |

Production and develop share everything up to their merge base, `f954ae1e` (2026-09-21). After
that, production adds six commits: the Announcements button (`ae2b1705`), a version roll, a test
fix, the hiding of non-production dashboard widgets and two logging changes. Develop adds 18,
including the TurfRad v3 work, its own copy of the Announcements button and a German catalogue fix.
Neither contains the other.

## Surfaces

"In production?" uses three values. **yes** means the change is at the production SHA. **develop
only** means it is at the develop SHA and not at production. **branch only** means neither.

### US-21207: the new Settings dialog (before the baseline, in production)

| Surface | Commits | In production? | Files | Guides affected | Proposed disposition | Reason |
|---|---|---|---|---|---|---|
| Settings dialog with a left rail of tabs | `7b7e1636` 2026-08-05 … `f784c87e` 2026-08-07 (WIP), `56b836af` and `94fa14ae` 2026-08-11, `08936e0d` 2026-08-11 | yes | `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts`, `sa-settings-dlg.component.html`, `sa-settings-dlg.component.less`, `sa-settings-dlg/models/sa-dlg.models.ts` | calculation-settings, calculation-methods, minimum-threshold, preferences, threshold-questions, suggested-adjustments, target-profiles, creating-profiles, updating-profiles, seasonal-profiles | no guide impact | The guides already use the "Settings › <tab>" paths. On production the rail lists Calculation, Minimum Threshold, Target Profiles and Preferences in that order (`sa-settings-dlg.component.ts:52-57`), so every navigation claim needs re-checking against that order. The Preferences entry's subtitle repeats Calculation's, "Configure calculation preferences" (`:56`). Any guide that quotes it should be checked. |
| Minimum Threshold rebuilt on the Settings dialog | `5d3c4c9d` 2026-08-07 | yes | `sa-settings-dlg.component.html:130-175` (pane), `sa-settings-dlg.component.ts` | minimum-threshold, threshold-questions, push-to-lynx, reviewing-changes, filter-adjustments | no guide impact | The guides were written against this layout. Feature 3 verifies the pane: the 0-50 bound, the two below-threshold options and Exclude Zeros. |
| SA User Preferences moved into Settings › Preferences | `05b16b64` 2026-08-10 | yes | `sa-settings-dlg.component.html:229-259` (pane, units at `:237-242`), `site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.html:75` (old toolbar entry, commented out), `site/src/app/spatial-adjust/components/sa-dashboard/sa-user-preferences-dlg/sa-user-preferences-dlg.component.ts` | preferences | no guide impact | The preferences guide already says "Settings › Preferences". The old standalone dialog is still in the tree, and it gained logging in the range, but the toolbar no longer offers it. |
| Discard Changes confirmation | `bc3c704a` 2026-08-11; touched again by `018f5743` 2026-08-20 | yes | `sa-settings-dlg.component.html:261-270`, `sa-settings-dlg.component.ts:217-242`, `site/src/app/spatial-adjust/components/sa-confirm-cancel-dlg/sa-confirm-cancel-dlg.component.html`, `sa-confirm-cancel-dlg.component.ts` | calculation-settings, preferences, minimum-threshold | fold into calculation-settings | No guide mentions it. Closing Settings with unsaved edits stops on a confirmation that reads "Are you sure you want to exit without saving changes?" (`SETTINGS_CONFIRM_DISCARD_CHANGES_PRIMARY`). Its buttons are CONTINUE EDITING (`CONTINUE_EDITING`) and DISCARD CHANGES (`DISCARD_CHANGES`). Closing with no edits skips it. README › Known gaps still lists this as having no guide, which is true. |

### PERS-348 Phase 2 (before the baseline, in production)

| Surface | Commits | In production? | Files | Guides affected | Proposed disposition | Reason |
|---|---|---|---|---|---|---|
| Multiple Lynx courses | `59f9200f` 2026-03-13 (first course-selector commit) | yes | `sa-main-toolbar.component.html:9-15` (course selector), `sa-settings-dlg.component.html:181-189` and `:224` (per-course Target Profiles) | dashboard-overview, target-profiles, creating-profiles, updating-profiles, seasonal-profiles | no guide impact | dashboard-overview step 1 already says the selector appears only when the site has more than one Lynx course, and the selector still renders only then (`:9`). Target Profiles is per course on production. That is covered by the Target Profiles row below. |
| Enabled Stations map filter | `86fd52f2` 2026-01-20, `c31d7d10` 2026-01-30 | yes | `site/src/app/spatial-adjust/components/sa-dashboard/sa-dash-map/sa-map-overlay/sa-map-overlay.component.html:41-59`, `sa-dash-map/sa-dash-map.component.ts:312` | map-navigation, enable-disable-stations | no guide impact | Both guides describe the All Stations and Enabled Stations choice. `c31d7d10` made Enabled Stations the default layer and saved the choice per user. No guide states a default, so feature 2 should confirm the default before any guide asserts one. |
| Crop Coefficient up to 200% | `6b453e93` 2026-02-11 | yes | `sa-settings-dlg.component.html:113-122` | calculation-settings, calculation-methods | no guide impact | calculation-settings step 4 already gives 0 to 200 as whole numbers. The field is disabled while Option 1 is selected (`:113-115`), and feature 3 should check that any claim about that matches. |
| Localisation | `fb3d7307` 2026-01-19 (missing strings, and pt-pt and zh-cn catalogues added); `486d759e` 2026-09-18 (one Japanese string); `14228cd6` 2026-09-22 (three German strings) | yes, except `14228cd6` (develop only) | `site/src/assets/i18n/*.json` (eleven catalogues), `site/src/app/common/services/app-initializer.service.ts:38` (English fallback) | preferences | fold into preferences | preferences step 3 says a new language re-applies translations across the site. On production the ten non-English catalogues carry only 50 to 54 of the 126 `SPATIAL_ADJUST` keys. Missing keys fall back to English (`app-initializer.service.ts:38`), so much of the Spatial Adjust screen stays in English after a language change. That includes the Settings dialog header (`SETTINGS_DLG_HEADER`), the scan-data banner and all 18 Target Profiles keys. The Target Profiles table headers are English literals with no catalogue key at all (`sa-settings-dlg.component.html:195-199`, `:224`). |
| Imperial units | `b3042a4b` 2026-01-19 (units and switching); `38a40673` 2026-08-06 (moved onto the Settings dialog) | yes | `sa-settings-dlg.component.html:237-242` (Units of Measure), `sa-settings-dlg.component.ts:322` (conversion to the user's unit when settings load), `:417` (conversion back on save) | preferences, calculation-settings | no guide impact | Already corrected by `docs/text-corrections.md` §2, the 25.4 rescale on switch and save. The two conversion sites moved from `:205` and `:249` at the baseline to `:322` and `:417`, so feature 3 must re-confirm the rescale at the new lines instead of relying on the old citation. |
| Update banner: dismiss without reload | `110aa125` 2026-07-29 | yes | `sa-main-toolbar.component.html:181-205` (banner), `sa-main-toolbar.component.ts:345` (Reload Data), `:350` (Dismiss) | request-scan-data | no guide impact | Covered by request-scan-data step 4 and verify 3. The banner reads "The requested scan data is ready." with Reload Data and Dismiss buttons. Dismiss only hides the banner. README › Known gaps, which says this has no guide, is stale. |

### Further findings in the commit ranges

| Surface | Commits | In production? | Files | Guides affected | Proposed disposition | Reason |
|---|---|---|---|---|---|---|
| **Target Profiles tab** (US-21136) | `a1a938d8` 2026-08-13, `5cff212c` 2026-08-13, `6bbf2f6c` and `82bacb26` 2026-08-17, `cf96fe2f`, `2c721f27` and `c7f170a1` 2026-08-19, `018f5743` 2026-08-20, `53b5c5cd` 2026-08-23, `7f20eaa4` 2026-08-25, `d8114fda`, `394f6c6f`, `b2c01311` and `9276cee1` 2026-08-26; merged into develop by `68a7e37b` 2026-09-14 | **yes** | `sa-settings-dlg.component.ts:55` (menu entry), `:103-108` (slot names), `:139-170` (background progress), `:249-253` (staged actions); `sa-settings-dlg.component.html:35`, `:177-226` (pane), `:272-324` (apply confirmation); `sa-settings-dlg.component.less`; `sa-settings-dlg/models/sa-dlg.models.ts`; `site/src/app/api/spatial-adjust/models/sa-target-profile.model.ts`; `site/src/app/api/spatial-adjust/models/sa-background-operation.model.ts`; `site/src/app/api/spatial-adjust/spatial-adjust-api.service.ts`; `site/src/app/api/spatial-adjust/spatial-adjust-manager.service.ts`; `site/src/app/spatial-adjust/assets/images/target-profile-apply-ico.png`, `target-profile-update-ico.png`, `unmatched-warning-ico.png`; `site/src/app/common/services/broadcast.service.ts`; `api/Controllers/SpatialAdjustController.cs:169-210`; `api/Services/SpatialAdjustService.cs`; `api/Services/SpatialAdjustLogic.cs:12`; `api/BackgroundTasks/TargetProfiles/*`; `api/Migrations/20260813230703_AddTargetProfilesTables.cs`; `api/Migrations/20260821173818_AddIsAppliedToSpatialAdjustTargetProfileStation.cs`; `site/src/assets/i18n/en-us.json` (18 keys) | target-profiles, creating-profiles, updating-profiles, seasonal-profiles | fold into target-profiles, creating-profiles, updating-profiles, seasonal-profiles | The tab is reachable on production, so each guide's disclaimer note is now wrong (feature 8). Feature 2 should judge the guides' bodies against what shipped. The shipped tab is a table per Lynx course with five fixed slots: Spring, Summer, Fall, Winter and Tournament (`ts:103-108`). Its columns are Target Profile, Last Updated, Stations, Update from Current and Apply Profile (`html:195-199`). Both actions are staged and run on Save (tooltips "Will update on save" and "Will be applied on save"), and Apply is unavailable on an empty slot (`html:214`). Applying asks "Use Target Profile?" with a summary and, when stations differ, an unmatched-stations warning (`html:272-324`). The apply itself runs as a background job and reports progress in the dialog footer (`ts:139-170`). The figures' three cards with ACTIVE badges, and the advice to name a profile for its reason, describe a different design. |
| Applied-profile indicator on the dashboard | `53b5c5cd` 2026-08-23, `9276cee1` 2026-08-26 | yes | `site/src/app/spatial-adjust/components/sa-dashboard/sa-dashboard.component.html:30-32`, `sa-dashboard.component.ts:326-332`, `:403-424` | target-profiles, updating-profiles, seasonal-profiles, dashboard-overview | fold into target-profiles | When a profile is applied to the selected course, the dashboard header shows "<name> Target Profile" (`N_TARGET_PROFILE`). The label disappears as soon as any station's Target VWC is edited. That is the shipped equivalent of the guides' "marked active in the list", which the shipped table has no column for. |
| Announcements button in the Spatial Adjust toolbar | production `ae2b1705` 2026-10-14; develop `bd39f465` 2026-10-15 (a separate commit with the same effect) | yes | `sa-main-toolbar.component.html:61-67`, `sa-main-toolbar.component.ts:35`, `:354-358` | dashboard-overview, request-scan-data, minimum-threshold | fold into dashboard-overview | A bullhorn button labelled "Announcements" (`STRINGS.ANNOUNCEMENTS`) now sits between Request latest scan data and the Settings gear, and opens the product's announcements panel. Captions that place the gear and the refresh button by their neighbours stay true. dashboard-overview step 5 describes the right of the toolbar and should mention the button. The reproduction does not draw it. |
| Backend calculation helpers moved into a new file | `53e7413c` 2026-09-15, `ed2aafc2` 2026-09-15 | yes | `api/Services/SpatialAdjustLogic.cs:64`, `:93`, `:107`, `:142`, `:149`; `api/Services/SpatialAdjustService.cs`; `api/Tests/IntelliDashApi.Tests/SpatialAdjustServiceTests.cs`, `SpatialAdjustServiceIntegrationTests.cs` | suggested-adjustments, calculation-settings, calculation-methods, calculation-questions, station-zero, understanding-vwc | no guide impact | The commits describe this as a refactor for testability. The per-station target, today's adjustment, soil factor and course-day range now live in `SpatialAdjustLogic.cs`. Feature 3 should cite those lines and confirm the behaviour did not change. Do not reuse pre-baseline `SpatialAdjustService.cs` line numbers. |
| Error-logging pass across the frontend | `27428cc9` 2026-09-15, `a6fd544a` 2026-09-16; production only: `45fb0ef2`, `1aa4f286` 2026-10-15; develop only: `526c1bd8` 2026-10-14, `9b4329e8` and `d9003fec` 2026-10-15 | yes | `sa-dash-chart.component.ts`, `sa-cfg-threshold-dlg.component.ts`, `sa-dash-table.component.ts`, `sa-table-card.component.ts`, `sa-dashboard.component.ts`, `sa-main-toolbar.component.ts`, `sa-weather-tb.component.ts`, `sa-user-preferences-dlg.component.ts`, `sa-diagnostics-dlg.component.ts`, `sa-soil-factor-dlg.component.ts`, `sa-algorithm.service.ts`, `sa-push-changes.service.ts`, `site/src/environments/environment.toro-prod.ts` | none | no guide impact | Console output is replaced with logger calls, and nothing a user sees changes. It does move the lines that existing citations point at (see Line drift below). |
| Suggested % Adj. after breadcrumb navigation | `ec82055e` 2026-08-26 | yes | `site/src/app/spatial-adjust/components/sa-dashboard/sa-dash-table/sa-table-card/sa-table-card.component.ts:458` | editing-station-targets, station-details, dashboard-overview | no guide impact | Fixes a stale suggested value after moving between a station and its parent with the breadcrumb. The guides already describe the correct value. |
| Map null guard | `5fcaf55a` 2026-09-16 | yes | `sa-dash-map.component.ts:39` | none | no guide impact | Defensive fix with no behaviour a reader would notice. |
| TurfRad processing parallelism | `09f0b4ed` 2026-08-20 | yes | `api/Services/SpatialAdjustService.cs` | none | no guide impact | Keeps the UI responsive while background processing runs, with no change to what is calculated. |
| Demo-site fixes | `89feca2a` 2026-09-21 (both); `3ba15c48` 2026-09-21 (develop only) | yes | `site/src/app/api/spatial-adjust/spatial-adjust-manager.service.ts`, `sa-main-toolbar.component.ts:333`, `sa-dashboard.component.ts` | none | no guide impact | Only affects the demo site, where Request latest scan data now does nothing. |
| TurfRad v3 API and today's adjustments without new scans | `a2121e34` 2026-10-02, `8f9ca024`, `3886ebcd`, `278335e0`, `8dcc21cf` and `62b8d917` 2026-10-03, `70333697` 2026-10-05, `48354a91` 2026-10-11, `e4a9c63d` and `10d2e231` 2026-10-12 | develop only (also on `Deployments/beta/261015_tr_v3_api_sprt`, which points at the develop SHA) | `api/Services/SpatialAdjustService.cs` (develop `:156`, `:3194`, `:3211`, `:3266-3312`), `api/Services/TerraRadService.cs`, `api/Models/TerraRadModel.cs`, `api/Domain/SpatialAdjust.cs`, `api/Controllers/TerraRadController.cs`, `api/Migrations/20261002234822_UpdateSpatialAdjustScansForTrV3Api.cs` | station-zero, calculation-questions, request-scan-data, understanding-vwc, suggested-adjustments | no guide impact (record in `developNote`) | On develop, the backend asks TurfRad only for scans newer than the last processing run (`278335e0`). When none have arrived, it still writes today's adjustment for each station from that station's history and today's ET (develop `:3266-3312`). The calculation is consolidated into one path (develop `:3194`, `:3211`), and the last scan date becomes a date with no time (develop `:156`). None of this is on production, so guides keep describing production. Verifiers should note it on stale-scan and modelled-value claims. |

## `en-us.json` `SPATIAL_ADJUST` key diff

The baseline holds 108 `SPATIAL_ADJUST` keys. No key outside the block changed in either range.

### baseline to production

18 added, 0 removed, 0 relabelled. All 18 belong to Target Profiles.

| Key | Label |
|---|---|
| `MATCHING_STATIONS` | Matching Stations |
| `N_TARGET_PROFILE` | {{name}} Target Profile |
| `PROFILE` | Profile |
| `PROFILE_FALL` | Fall |
| `PROFILE_SPRING` | Spring |
| `PROFILE_SUMMER` | Summer |
| `PROFILE_TOURNAMENT` | Tournament |
| `PROFILE_UNMATCHED_STATIONS_PREAMBLE` | Spatial Adjust found differences between the stations saved in this profile and those actively being scanned. |
| `PROFILE_UNMATCHED_STATIONS_WARNING` | Matching stations will be updated, while unmatched stations will be ignored. |
| `PROFILE_WINTER` | Winter |
| `SETTINGS_TARGET_PROFILES_HEADER` | Save, manage, and apply target profiles for seasonal and event-based irrigation strategies. |
| `STATIONS_IN_PROFILE` | Stations in Profile |
| `SUMMARY` | Summary |
| `TARGET_PROFILES_APPLYING` | Applying target values to matching stations |
| `TARGET_PROFILES_APPLYING_COMPLETE` | Target values applied to matching stations |
| `TARGET_PROFILES_APPLYING_FAILED` | Failed to apply target values to matching stations |
| `USE_TARGET_PROFILE` | Use Target Profile? |
| `USE_TARGET_PROFILE_INFO` | When you save, the current target values for matching stations will be replaced with the values stored in this profile. Your current target values will not be saved automatically. |

### baseline to develop

The same 18 keys as production are added, with 0 removed and 0 relabelled. Develop and
production `en-us.json` are identical. The block has 126 keys on both.

### Other catalogues

None of the 18 keys exists in any of the ten non-English catalogues at either SHA, so every
locale shows the Target Profiles tab in English. The only other `SPATIAL_ADJUST` change in those
files is on production, where `ja-jp` retranslates `FILTER_CFG_INSTRUCTIONS` ("Filter % Adj. by
setting an Over and/or Under threshold.") in `486d759e`. Develop's `de-de` also adds
`CALCULATION_ET`, `LYNX_REFERENCE_IN_UNITS_X` and `MAX_AMOUNT_IN_UNITS_X` in `14228cd6`.

## Line drift for existing citations

`docs/text-corrections.md` and the comments in `src/transform-export.mjs` cite IntelliDash lines on
the baseline. Many of those lines have moved, so re-cite against production. Each row below is the
first line that matches the anchor at each SHA.

| File | Anchor | Baseline | Production | Develop |
|---|---|---|---|---|
| `site/src/app/spatial-adjust/services/sa-algorithm.service.ts` | the frontend suggested-percent entry point | 41 | 43 | 43 |
| `site/src/app/spatial-adjust/components/sa-dashboard/sa-dashboard.component.ts` | the only caller of that entry point | 576 | 597 | 597 |
| `site/src/app/spatial-adjust/services/sa-push-changes.service.ts` | the retry pass resets its step count | 93 | 95 | 95 |
| `site/src/app/spatial-adjust/services/sa-push-changes.service.ts` | progress starts at the pushing step | 135 | 137 | 137 |
| `site/src/app/spatial-adjust/services/sa-push-changes.service.ts` | the read-back step begins after the push loop | 164 | 166 | 166 |
| `site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts` | the Push Changes handler | 252 | 255 | 255 |
| `site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts` | the diagnostics handler and its Shift + Alt gate | 290 | 293 | 293 |
| `site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts` | the banner's Dismiss handler | 344 | 350 | 350 |
| `site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.html` | the scan-data-ready banner | 174 | 181 | 180 |
| `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts` | the Target Profiles menu entry (commented out at the baseline, live after) | 50 | 55 | 55 |
| `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts` | conversion to the user's unit on load | 205 | 322 | 322 |
| `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts` | conversion back to millimetres on save | 249 | 417 | 417 |
| `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.html` | the Discard Changes confirmation | 216 | 264 | 264 |
| `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.html` | the Preferences pane header | 184 | 231 | 231 |
| `site/src/app/spatial-adjust/components/sa-dashboard/sa-dash-map/sa-dash-map.component.ts` | the moisture band fallback of 19 | 49 | 49 | 49 |
| `site/src/app/spatial-adjust/utils/spatial-adjust.util.ts` | the pushable-station check | 11 | 11 | 11 |
| `site/src/app/common/utils/date.util.ts` | the course-local day comparison | 81 | 81 | 81 |
