# Calculations: how Spatial Adjust produces a suggested percentage

This file traces every number the Calculations guides talk about back to the IntelliDash code
that produces it: the three site settings, the two algorithms, what the station table shows, the
Minimum Threshold, unit conversion, the soil factor and today's ET. The ledger claims in the eight
Calculations shards (`minimum-threshold`, `calculation-settings`, `calculation-methods`,
`preferences`, `suggested-adjustments`, `station-zero`, `threshold-questions`,
`calculation-questions`) cite the section here that explains them, plus the backend `path:line`.

Owner: feature 3. See the shard map in [`README.md`](README.md).

## Ground rules

- Every citation is to the production SHA pinned in [`sources.json`](sources.json),
  `1aa4f28622cc3cc9637f0d61a438bf16bcf01924`, unless it says **develop**
  (`bd39f465cf5a7ae0356a59825250b36044085714`). Production is not yet confirmed by the release
  owner (see [`README.md`](README.md#how-production-was-identified)).
- IntelliDash is private and this repository is public, so the arithmetic is described in prose
  and cited by `path:line`. No code is reproduced. Labels a user sees are quoted from
  `site/src/assets/i18n/en-us.json`.
- The worked numbers below are invented for illustration. None comes from a real course.
- Rounding is half away from zero throughout the backend.

### Files cited

Paths are shortened to the file name after the first mention.

| Short name | Path |
|---|---|
| `SpatialAdjustService.cs` | `api/Services/SpatialAdjustService.cs` |
| `SpatialAdjustLogic.cs` | `api/Services/SpatialAdjustLogic.cs` |
| `SitesService.cs` | `api/Services/SitesService.cs` |
| `SpatialAdjustController.cs` | `api/Controllers/SpatialAdjustController.cs` |
| `ProcessSpatialAdjustDataService.cs` | `api/BackgroundTasks/ProcessSpatialAdjustDataService.cs` |
| `appsettings.json` | `api/appsettings.json` |
| `Site.cs` | `api/Domain/Site.cs` |
| `SpatialAdjust.cs` | `api/Domain/SpatialAdjust.cs` |
| `SiteModel.cs` | `api/Models/SiteModel.cs` |
| `sa-algorithm.service.ts` | `site/src/app/spatial-adjust/services/sa-algorithm.service.ts` |
| `sa-dashboard.component.ts` | `site/src/app/spatial-adjust/components/sa-dashboard/sa-dashboard.component.ts` |
| `sa-main-toolbar.component.ts` / `.html` | `site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.*` |
| `sa-settings-dlg.component.ts` / `.html` | `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.*` |
| `sa-confirm-push-dlg.component.ts` / `.html` | `site/src/app/spatial-adjust/components/sa-confirm-push-dlg/sa-confirm-push-dlg.component.*` |
| `sa-table-card.component.ts` / `.html` / `.less` | `site/src/app/spatial-adjust/components/sa-dashboard/sa-dash-table/sa-table-card/sa-table-card.component.*` |
| `sa-dash-table.component.ts` | `site/src/app/spatial-adjust/components/sa-dashboard/sa-dash-table/sa-dash-table.component.ts` |
| `spatial-adjust-course.model.ts` | `site/src/app/api/spatial-adjust/models/spatial-adjust-course.model.ts` |
| `spatial-adjust.util.ts` | `site/src/app/spatial-adjust/utils/spatial-adjust.util.ts` |
| `decimal-input.component.ts` | `site/src/app/shared/components/decimal-input/decimal-input.component.ts` |
| `dash-user-manager.service.ts` | `site/src/app/api/dash-user/dash-user-manager.service.ts` |
| `sa-soil-factor-dlg.component.html` | `site/src/app/spatial-adjust/components/sa-soil-factor-dlg/sa-soil-factor-dlg.component.html` |
| `sa-weather-tb.component.ts` | `site/src/app/spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-weather-tb/sa-weather-tb.component.ts` |
| `environment.toro-prod.ts` | `site/src/environments/environment.toro-prod.ts` |
| `en-us.json` | `site/src/assets/i18n/en-us.json` |

## 1. The three site settings

Daily Max Amount, Lynx Reference Amount and Crop Coefficient are columns on the site record
(`Site.cs:40-52`). The two amounts are stored in millimetres with three decimals. Every user of the
site shares them: the Calculation tab saves them through the site settings endpoint
(`SitesService.cs:79-107`), not the user's preferences.

**Defaults.** When a site with a TurfRad organisation is created or refreshed from NSN, any unset
value is seeded from configuration (`SitesService.cs:144-151`, `:170-177`): Option 2, 10 mm,
3 mm and 100 percent (`appsettings.json:145-148`). The reads that are meant to cover a site that
was never seeded look up two configuration keys that do not exist (`SitesService.cs:70`, `:72`,
`SpatialAdjustService.cs:2968-2969`). For such a site the settings request and the daily
calculation would fail rather than fall back to 10 mm and 3 mm. Seeding at site sync means this
should be rare. IntelliDash's own documentation records the defect.

**Bounds.** The Calculation tab enforces the bounds, and the server enforces none. The patch
endpoint copies whatever it is sent (`SitesService.cs:79-107`), and the request model carries no
validation (`SiteModel.cs:48-63`).

| Field (label in `en-us.json`) | Dialog bounds | Where |
|---|---|---|
| "Daily Max Amount ({{unitsAbbr}})" (`:422`) | one step (0.01 in or 0.1 mm) to 15, **in the user's units** | `sa-settings-dlg.component.html:82-95` |
| "Lynx Reference Amount ({{unitsAbbr}})" (`:420`) | one step to 10, in the user's units | `sa-settings-dlg.component.html:97-110` |
| "Crop Coefficient (%)" (`:389`) | 0 to 200, whole numbers | `sa-settings-dlg.component.html:112-123` |

The ceilings of 15 and 10 are applied to the number in the box, so they mean 15 in and 10 in for
an imperial user but 15 mm and 10 mm for a metric one. The input refuses a keystroke that would
exceed the maximum and rounds to the field's decimals (`decimal-input.component.ts:126-129`,
`:201-209`). All three fields are disabled while Option 1 is selected
(`sa-settings-dlg.component.html:83-85`, `:98-100`, `:113-115`).

### 1.1 Daily Max Amount is a cap

Under Option 2 the day's amount for a station is cut to the Daily Max Amount before it becomes a
percentage (`SpatialAdjustService.cs:3041`). Every station whose amount reaches the cap gets the
same percentage, which is why runs of identical suggestions appear. Option 1 never reads it.

### 1.2 Lynx Reference Amount is what 100 percent means

The suggested percentage is the capped amount divided by the Lynx Reference Amount, times 100,
rounded to a whole number (`SpatialAdjustService.cs:3043`). A smaller reference makes every
non-zero suggestion larger in the same proportion. Option 1 never reads it.

### 1.3 Crop Coefficient scales today's ET

The coefficient is turned into a fraction rounded to two decimals, and today's ET in millimetres
is multiplied by it and rounded to two decimals (`SpatialAdjustService.cs:2973-2974`). At 100 the
ET is used as it is. Below 100 the course is treated as losing less water than reference ET,
above 100 more. At 0 the ET term disappears and only the moisture deficit is left. Option 1 never
reads it.

### 1.4 The ceiling

Because of the cap, the largest suggestion Option 2 can produce is the Daily Max Amount divided by
the Lynx Reference Amount, times 100. With the seeded 10 mm and 3 mm that is 333 percent. A 12 mm
cap gives 400. The ratio is all that matters, so the ceiling is the same in either unit system. A
value typed in inches is converted to millimetres at three decimals
(`sa-settings-dlg.component.ts:422-427`), so typing 0.39 in and 0.12 in stores 9.906 mm and
3.048 mm, and the ceiling becomes 325 percent.

## 2. Option 2: delta plus today's ET (the default)

"Option 2" (`en-us.json:368`) is the site default (`appsettings.json:145`,
`SpatialAdjust.cs:18-22`) and the dashboard's fallback when no algorithm is loaded
(`sa-algorithm.service.ts:45`). The server computes it. The browser only looks the result up.

### 2.1 When it runs

A background service wakes every 15 seconds (`ProcessSpatialAdjustDataService.cs:46-70`,
`appsettings.json:27`) and processes each organisation whose data is older than 1800 seconds
(`appsettings.json:32`). Processing fetches the last seven days of TurfRad scans
(`SpatialAdjustService.cs:2508-2564`). If any come back, they are stored and the adjustments are
recalculated for every station that has a scan in that window
(`SpatialAdjustService.cs:2103-2133`). If none come back, nothing is calculated, and every scan
stored for the organisation (or the course) is deleted (`SpatialAdjustService.cs:2134-2146`,
`:2817-2836`). The table lists only stations that have stored scans
(`SpatialAdjustService.cs:205-207`), and the diagnostics checks read the same store
(`SpatialAdjustService.cs:147-171`). A fetch error ends the fetch early
(`SpatialAdjustService.cs:2508-2564`), so a failed fetch can look the same as having no scans. "Request latest scan data" (`en-us.json:454`) marks the site's data
as two days old and starts a run (`SpatialAdjustService.cs:978-1002`). It fetches what TurfRad
already holds and cannot make TurfRad scan.

### 2.2 The chain, per station, per day

One adjustment row is kept per station name per course-local day. A station pair shares one row
(`SpatialAdjustService.cs:3024-3028`).

1. **Today's ET.** See [section 8](#8-todays-et-and-the-weather-strip). The value arrives in
   inches and is converted to millimetres at two decimals (`SpatialAdjustService.cs:2931-2932`,
   `:3191-3194`), then multiplied by the crop coefficient (section 1.3).
2. **Measured VWC.** This is the mean of today's scans for every sprinkler that carries the
   station's name, so a pair is averaged. Readings of zero are dropped before anything else
   (`SpatialAdjustService.cs:2947`, `:3004-3015`).
3. **Modelled VWC.** If the station has no scan today, the calculation uses the moisture the
   model predicted earlier (`SpatialAdjustService.cs:3031-3032`). If there is no prediction to
   use, the modelled VWC is 0.
4. **Deficit.** Target VWC minus the measured or modelled VWC, in percentage points. If the
   modelled VWC is 0 the deficit is set to 0 (`SpatialAdjustService.cs:3033`).
5. **Amount of water.** The crop-adjusted ET plus the deficit. A deficit of one VWC point is
   added as one millimetre, with no conversion for soil depth or bulk density. If the sum is
   negative the amount is 0. Otherwise it is multiplied by the station's soil factor percentage
   and rounded to two decimals (`SpatialAdjustService.cs:3036-3039`).
6. **Cap.** The smaller of that amount and the Daily Max Amount (`SpatialAdjustService.cs:3041`).
7. **Percentage.** The capped amount divided by the Lynx Reference Amount, times 100, rounded to a
   whole number (`SpatialAdjustService.cs:3043`). This is the Suggested value.
8. **Prediction for tomorrow.** Today's VWC minus the crop-adjusted ET plus the capped amount
   (`SpatialAdjustService.cs:3042`). This is what step 3 falls back on when a later day has no
   scan.

The row is then created or updated (`SpatialAdjustService.cs:3048-3125`). If the scan is new
since the row was last written, any % Adj. a user saved for the station is cleared
(`SpatialAdjustService.cs:3052-3062`, `:3112-3122`). A station whose Target VWC is still 0 gets
its target set to its measured VWC rounded to a whole number
(`SpatialAdjustService.cs:3128-3133`). The Target VWC box in the table only accepts 0 to 50
(`sa-table-card.component.html:40-47`), but this automatic first target can be higher.

**Worked example.** ET 0.20 in is 5.08 mm, and at a crop coefficient of 100 it stays 5.08 mm.
Target 30, measured 27.6: the deficit is 2.4, the amount is 7.48 mm at a soil factor of 100,
under a 10 mm cap, and 7.48 / 3 × 100 rounds to 249 percent. Measured 34.5 against a target of
16: the deficit is −18.5, so the amount is 0 and the suggestion is 0 percent.

### 2.3 How the browser gets the number

The dashboard fetches the stored suggestions for the course (`SpatialAdjustService.cs:282-307`)
and finds each station's suggestion by name (`sa-algorithm.service.ts:62-65`). If a station has
no row, the lookup returns 0, and that 0 seeds the station's % Adj. on load
(`sa-dashboard.component.ts:597-598`). The table card shows a dash in that case. It reaches the
dash through a path that then fails on the missing row (`sa-table-card.component.ts:430-435`).

### 2.4 Recalculation after a settings change

Saving a change to any of the three amounts asks the server to recalculate
(`sa-settings-dlg.component.ts:452-455`, `:528-539`, `:563-571`;
`SpatialAdjustController.cs:298-301`). The server takes the latest row of each station on the
**selected course only**, of whatever date, and keeps its stored ET and deficit. It applies the
new settings to steps 1 and 5-8 above and rewrites the Suggested value
(`SpatialAdjustService.cs:1848-1921`). Two things follow.

- Only rows where the changed setting takes part move. A new reference rescales every non-zero
  suggestion. A new cap moves only the stations at the old or new cap. A new crop coefficient
  moves every station that is not at zero or at the cap. Stations at zero usually stay at zero.
- The % Adj. a user saved for a station is stored on the station and is not reset by a
  recalculation (`SpatialAdjustService.cs:1019-1038`). Only a new scan clears it (section 2.2).

### 2.5 Editing a target

A new Target VWC is saved for the station and its pair, any applied target profile is cleared,
and today's row is recalculated with the new target if today's row already exists
(`SpatialAdjustService.cs:1153-1233`, `SpatialAdjustLogic.cs:64-91`). Under Option 2 the reply is
that row's stored suggestion (`SpatialAdjustService.cs:1245-1248`). Bulk target changes clamp the
target to 0-50 (`SpatialAdjustService.cs:2291-2292`, `SpatialAdjustLogic.cs:93-105`) and
recalculate the same way (`SpatialAdjustLogic.cs:107-140`).

## 3. Option 1: ratio of target to measured

"Option 1" (`en-us.json:367`) is computed in the browser: the percent adjust Lynx currently holds
for the station, multiplied by Target VWC divided by measured VWC, rounded to a whole number
(`sa-algorithm.service.ts:58-60`). The dashboard feeds it the pair's average moisture
(`sa-dashboard.component.ts:589-597`). The table card repeats the same ratio for the value it
paints (`sa-table-card.component.ts:427-428`), and the server returns it as the reply to a target
edit (`SpatialAdjustService.cs:1241-1244`). The three differ only in when they round their inputs.

- It reads no ET, no Daily Max Amount, no Lynx Reference Amount and no Crop Coefficient, so all
  three fields are disabled while it is selected (section 1).
- It has no ceiling. The % Adj. box accepts up to 900 (`sa-table-card.component.html:53-62`).
- A station that Lynx holds at 0 percent stays at 0 however dry it reads.
- It has no modelled fallback. A station without today's scan shows a dash
  (`sa-table-card.component.ts:417-420`, `spatial-adjust-course.model.ts:184-188`).

On production the algorithm selector, "Suggested Percent Adjust Calculation"
(`en-us.json:482`), is shown only if the site is already on Option 1
(`sa-settings-dlg.component.html:72-80`, `sa-settings-dlg.component.ts:127`). Saving a different
algorithm reloads the dashboard, and every row is worked out again under the new method. No
server recalculation is requested (`sa-settings-dlg.component.ts:552-554`,
`sa-dashboard.component.ts:262-270`).

## 4. What the station table shows

| Column | Station row | Source |
|---|---|---|
| "Avg. VWC" (`en-us.json:377`) | Today's scan, averaged across a pair. Under Option 2 without a scan today, the modelled VWC. Otherwise a dash. | `sa-dash-table.component.ts:215-233`, `sa-table-card.component.ts:372-378` |
| "Target VWC" (`en-us.json:484`) | The station's target, editable 0-50 | `sa-table-card.component.html:40-47` |
| Current | The percent adjust Lynx holds now, or a dash | `sa-table-card.component.ts:415`, `.html:48` |
| Suggested | Section 2 or 3, or a dash | `sa-table-card.component.ts:417-437`, `.html:49` |
| "% Adj." (`en-us.json:437`) | The user's value, seeded from Suggested. 0-900. | `sa-table-card.component.html:53-62`, `.ts:146-164` |

**Measured, modelled or nothing.** A station is current when its latest scan is dated today in the
course's time zone (`spatial-adjust-course.model.ts:173-182`, `spatial-adjust.util.ts:17-19`). It
is *estimated* when it is not current and the site is on Option 2
(`spatial-adjust-course.model.ts:184-188`). An estimated Avg. VWC is painted dark grey and italic
with an orange calculator icon (`sa-table-card.component.html:29-31`,
`sa-table-card.component.less:100-110`), and its Suggested value is the latest stored row's
(`sa-table-card.component.ts:421-425`). Production hides stale values that are not estimated
(`environment.toro-prod.ts:87`), so a dash means one of these:

- Option 1 and no scan today;
- Option 2 and the station has no adjustment row at all;
- Lynx returned nothing for the station (Current only).

A dash is never a zero. A zero is a calculated result (section 9).

**Area and hole rows.** A hole's Avg. VWC is the mean over its current or estimated stations, each
member of a pair counted separately (`spatial-adjust-course.model.ts:73-85`). If a hole has none,
its average is 0. An area's is the plain mean of its holes' averages, so a hole with nothing
valid pulls the area down (`spatial-adjust-course.model.ts:24-26`). Target averages count each
station name once (`spatial-adjust-course.model.ts:89-90`). Low and high use current scans only
(`spatial-adjust-course.model.ts:98-99`).

**Disabled stations** are still calculated and shown. They are left out of the push list, along
with every station under a disabled area or hole (`sa-dashboard.component.ts:615-619`, `:641`),
so Lynx keeps whatever percent adjust it already holds. Disabling never produces a zero.

## 5. Minimum Threshold

"Minimum Threshold (%)" (`en-us.json:469`) is a site setting stored with the others
(`Site.cs:40-52`, `SitesService.cs:89-90`) and edited as a whole number from 0 to 50
(`sa-settings-dlg.component.html:135-143`). The server does not check the range.

**What it acts on.** It is applied in the browser to the push list, to each pending station's
% Adj. (`sa-main-toolbar.component.ts:433-460`). It is never applied to Suggested or to the
% Adj. box in the table. A station is pending when its % Adj. differs from what Lynx holds
(`sa-dashboard.component.ts:659-662`). For each pending station whose % Adj. is below the
threshold:

| Option (label) | Result |
|---|---|
| "Set to zero when pushed to Lynx" (`en-us.json:424`) | A non-zero value is replaced by 0. A zero is left alone. |
| "Set to the minimum threshold value when pushed to Lynx" (`en-us.json:423`) | The value is replaced by the threshold, zeros included. |
| the same, with "Exclude Zeros" (`en-us.json:400`) | A non-zero value is replaced by the threshold. A zero stays 0. |

"Exclude Zeros" can only be ticked under the second option with a threshold above 0
(`sa-settings-dlg.component.html:163-170`). A threshold below 1 is saved as disabled
(`sa-settings-dlg.component.ts:429-443`), and the option group is greyed out at 0
(`sa-settings-dlg.component.html:145-162`).

**Push dialog.** Each rewritten row shows its % Adj. and an arrow to "Adjusted to" the new value,
which is painted pink (`sa-confirm-push-dlg.component.html:83-86`). A banner counts the rewritten
rows, including rows already pushed today. It appears only when the count is above zero
(`sa-confirm-push-dlg.component.ts:28`, `.html:32-42`; `en-us.json:430`, `:434`). Sending
substitutes the rewritten values (`sa-confirm-push-dlg.component.ts:74-82`). Lynx then holds the
rewritten value while the table's % Adj. still holds the raw one, so the station stays pending.

**Saving.** A change to the threshold alone does not reload the dashboard. The push list is
re-evaluated (`sa-settings-dlg.component.ts:555-557`, `sa-main-toolbar.component.ts:232-237`).
"Review Threshold" (`en-us.json:458`) in the push dialog opens Settings on the Minimum Threshold
tab and leaves the gear opening there until the page is reloaded
(`sa-confirm-push-dlg.component.ts:99-102`, `sa-main-toolbar.component.ts:239-244`). Without it
the gear opens on Calculation (`sa-main-toolbar.component.ts:87`,
`sa-settings-dlg.component.ts:59`). The dialog is rebuilt on every opening
(`sa-main-toolbar.component.html:107-112`), so it never remembers the tab clicked last.

## 6. Units of measure

The amounts are stored in millimetres (`Site.cs:40-52`). When the Settings dialog opens it reads
the user's Units of Measure and converts the two amounts for display: inches with two decimals and
a 0.01 step, or millimetres with one decimal and a 0.1 step (`sa-settings-dlg.component.ts:354-365`,
`spatial-adjust.util.ts:113-121`). On save it converts back, multiplying inches by 25.4 and
rounding to three decimals (`sa-settings-dlg.component.ts:422-427`).

The conversion back reads the unit selected **at save time**, and changing Units of Measure does
not re-convert the boxes (`sa-settings-dlg.component.html:242`). Changing the unit and saving in
the same visit therefore stores the old-unit numbers as if they were the new unit:

- imperial to metric: 0.39 in and 0.12 in are saved as 0.39 mm and 0.12 mm (25.4 times smaller);
- metric to imperial: 10 mm and 3 mm are saved as 10 in and 3 in, which is 254 mm and 76.2 mm
  (25.4 times larger).

The amounts have changed, so the save triggers a recalculation (section 2.4). The ceiling ratio
survives, but every suggestion below the cap is rescaled. Imperial to metric pushes nearly every
station to the cap. Metric to imperial shrinks every uncapped suggestion by a factor of 25.4.

Language, temperature scale and the group and decimal separator are user preferences
(`dash-user-manager.service.ts:73-102`) and do not touch any amount. The language takes effect
at once (`:87`, `:90`). The table re-formats its numbers when the separator changes
(`sa-table-card.component.ts:252-256`).

## 7. Soil factor

Each station has a soil factor from 1 to 200 percent, edited in the "Soil Factor Editor"
(`sa-soil-factor-dlg.component.html:15`, `:105-106`). It opens with Shift + Alt on the toolbar
gear (`sa-main-toolbar.component.ts:276-291`). In the chain it multiplies the amount before the
cap (section 2.2 step 5). It stays until someone changes it. A configuration switch can turn it
off for the whole service, and it is on (`appsettings.json:150`,
`SpatialAdjustLogic.cs:142-147`).

## 8. Today's ET and the weather strip

The ET in the calculation is the reference ET for today from the external weather forecast, in
inches, for the site's latitude and longitude (`SpatialAdjustService.cs:2886-2906`). Until the
configured hour, 11:00 course-local (`appsettings.json:149`), each run fetches it again. The first
run at or after that hour fetches it one last time, and the value is then held for the rest of
the day (`SpatialAdjustService.cs:2838-2884`). If the weather service fails, ET is 0
(`SpatialAdjustService.cs:2902`). A failure on the run that freezes the value leaves 0 for the
whole day, and every suggestion then rests on the deficit alone.

The weather strip in the toolbar is display only. Its temperature follows the user's scale
(`sa-weather-tb.component.ts:61-63`, `:142-146`). The dashboard's suggestion function accepts an
ET argument and ignores it (`sa-algorithm.service.ts:43-52`). Nothing on screen shows the ET the
calculation used.

## 9. Where a zero comes from

| Cause | Algorithm | Where |
|---|---|---|
| Measured or modelled VWC is above target by more than today's crop-adjusted ET | 2 | `SpatialAdjustService.cs:3037-3039` |
| The capped amount is under half a percent of the reference | 2 | `SpatialAdjustService.cs:3043` |
| Lynx holds the station at 0 percent, or its target is 0 | 1 | `sa-algorithm.service.ts:58-60` |
| Set to zero when pushed to Lynx (Lynx receives 0; the table keeps the raw value) | either | `sa-main-toolbar.component.ts:436-440` |
| A station with no adjustment row, in the seeded % Adj. (the table shows a dash) | 2 | `sa-algorithm.service.ts:62-65` |

Disabling a station is not on this list (section 4).

## 10. Edge cases

- **Zero reference.** The dialog cannot save one, but the API would accept it. The daily
  calculation and a target edit divide by it unguarded (`SpatialAdjustService.cs:3043`,
  `SpatialAdjustLogic.cs:81`). The bulk-target path returns 0 instead (`SpatialAdjustLogic.cs:125`).
- **No modelled value.** With no scan today and no prediction to fall back on, the deficit is 0
  and the suggestion is today's crop-adjusted ET alone, up to the cap
  (`SpatialAdjustService.cs:3031-3033`).
- **First run of the day.** The fallback prediction is taken from the second-newest row. Before
  today's row exists that row is two days old, so the first run of the day falls back one day too
  far, and the second run corrects it (`SpatialAdjustService.cs:3019-3022`, `:3031`).
- **Target edit before today's row exists.** The target is saved, but the reply carries the older
  row's suggestion, and the new target applies from the next run
  (`SpatialAdjustService.cs:1198-1209`, `:1245-1248`).
- **Several courses.** Recalculation after a settings change covers the selected course only
  (section 2.4). Other courses pick up the new settings at their next processing run.
- **An empty fetch.** When the seven-day fetch returns nothing, whether because TurfRad has no
  recent scans or because the request failed, the stored scans are deleted. The stations then
  drop out of the table and the diagnostics report no scan data until the next successful fetch
  (section 2.1).
- **Settings for a never-seeded site.** See section 1, "Defaults".

## 11. Develop differences

The browser-side files that hold the arithmetic and its display are identical on develop
(`sa-algorithm.service.ts`, the settings, push and table components, and
`spatial-adjust-course.model.ts`). Toolbar line numbers after `sa-main-toolbar.component.html:66`
and around `sa-main-toolbar.component.ts:357` shift by one. On the backend:

- The Option 2 arithmetic is gathered into one routine with the same steps and rounding (develop
  `SpatialAdjustService.cs:3194-3205`, `:3211-3232`).
- When TurfRad reports no new scans, develop still writes today's row for every station with
  history, using the modelled VWC (develop `SpatialAdjustService.cs:2146`, `:3266-3312`).
  Production writes nothing in that case (section 2.1).
- Develop's last-scan-date check returns a date with no time.
- The default-key defect in section 1 is still present (develop `SitesService.cs:70`, `:72`,
  `SpatialAdjustService.cs:3196-3197`).

## 12. Open for experts

The source settles the arithmetic. It cannot settle whether the arithmetic is agronomically
right. The ledger carries each of these as a Needs expert question.

1. **VWC points as millimetres.** The deficit in VWC percentage points is added to ET in
   millimetres one for one (section 2.2, step 5). Is that equivalence acceptable for the soils and
   root zones Spatial Adjust is sold for, or should the deficit be scaled by a depth?
2. **A 10 percent threshold** is offered as a common starting point (`minimum-threshold/3/3`).
3. **Zero is usually right** (`station-zero/summary/1`): whether zeros in the field are mostly
   wet stations rather than settings or stale data.
4. **Soil factor for daily overrides** (`suggested-adjustments/5/2`): whether a permanent soil
   factor is the recommended response to overriding the same station every day.
