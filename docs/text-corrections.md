# Text corrections — evidence

Claims in the guides that a reader would act on and that the shipping product contradicts.
Each was checked against the IntelliDash source, not against the Core Design recreation of
it, because the recreation can carry the same mistake as the prose.

These are corrected in `src/transform-export.mjs` rather than in the `.dc.html`, because a
Core Design re-export overwrites that file wholesale. Every correction is anchored on the
exact sentence it replaces, so if the wording changes upstream the build fails instead of
silently dropping the fix.

**They still need fixing at source in Core Design.** The transform is a guard, not a
resolution — it keeps the published site correct in the meantime.

---

## 1. Algorithm names did not exist in the UI

**Claimed:** the two calculation methods are "Simple" and "the default method".

**Actual:** those are enum names. The dropdown is built from translation keys:

```ts
// site/src/app/api/dash-user/dash-user-manager.service.ts:217
get saAlgorithmsSelectItems(): SelectItem[] {
    this._saAlgorithmSelectItems = [
        { label: this.translateService.instant('SPATIAL_ADJUST.ALGO_SIMPLE'), value: ToroEnums.SaAlgorithm.Simple },
        { label: this.translateService.instant('SPATIAL_ADJUST.ALGO_DELTA_PLUS_TODAY_ET'), value: ToroEnums.SaAlgorithm.DeltaPlusTodayEt },
    ];
}
```

```jsonc
// site/src/assets/i18n/en-us.json:367
"ALGO_SIMPLE": "Option 1",
"ALGO_DELTA_PLUS_TODAY_ET": "Option 2",
```

Both render as **"Option 1"** and **"Option 2"** — and identically in all ten other locales
(`Opción 1`, `Option 1`, `Opzione 1`, `オプション 1`, …). The word "Simple" appears nowhere
on screen, so a reader following the guide into that dropdown had nothing to match on.

**Correction:** every mention now leads with the label actually on screen. The descriptive
names are kept as prose — "Option 1 multiplies the percent adjust Lynx holds" is unreadable
on its own — but the mapping is stated in the `before` list and again at the selector step.
The guide now also says plainly that the product describes neither option, which is the real
reason the step is confusing.

## 2. The unit-switch reassurance was false

**Claimed:** *"Changing the unit system does not change the underlying values — only the
number you see and the increment you nudge it by."*

**Actual:** it rescales the stored values by 25.4.

Conversion into user units happens once, when settings load:

```ts
// sa-settings-dlg.component.ts:205 — called from the settings fetch
this.setSettingsToUserUnits();
```

```ts
// :235 — reads unitsSystem at load time
this.userMaxAmt = isImperial ? SpatialAdjustUtil.convertMmToInches(this.saSettings.saMaxAmountMm) : this.saSettings.saMaxAmountMm;
```

The Units of Measure control is a plain two-way binding with **no change handler**:

```html
<!-- sa-settings-dlg.component.html:195 -->
<p-dropdown [options]="unitsSystemsList" [(ngModel)]="userPrefs && userPrefs.unitsSystem" appendTo="body"></p-dropdown>
```

So nothing re-converts the amounts already sitting on the Calculation tab. Save then runs
unconditionally:

```ts
// :121  onSave() → :127
this.prepareSettingsForSave();          // → setSettingsToSaveUnits()

// :254
this.saSettings.saMaxAmountMm = isImperial ? SpatialAdjustUtil.convertInchesToMm(this.userMaxAmt, 3) : this.userMaxAmt;
```

`isImperial` is now the *new* setting, but `userMaxAmt` is still the millimetre value. A
10 mm cap is saved as `convertInchesToMm(10)` = **254 mm**. Both Max Amount and Lynx
Reference Amount are affected, and `onCancel()` calls `prepareSettingsForSave()` too.

This was the most consequential wrong sentence in the guides: a safety reassurance on a
setting that feeds irrigation output.

**Correction:** the tip now states what actually happens and tells the reader to reopen
Settings and check both amounts after a unit change. The body was also tightened — the
conversion runs when the dialog opens, not when the setting changes.

## 3. Moisture band default was one course's preference

**Claimed:** bands default to `0–5, 6–16, 17–30, above 30`.

**Actual:** the middle boundary defaults to **19**, not 16:

```ts
// sa-dash-map.component.ts:48
const r1Boundary = value?.range1Boundary || 5;
const r2Boundary = value?.range2Boundary || 19;
const r3Boundary = value?.range3Boundary || 30;
```

16 is the value in `spatial-adjust-demo-data-colliers.ts` — that course's saved
`saMoistureRanges` preference, which is what the guides were authored against. A fresh
account with no saved preference sees `0–5, 6–19, 20–30, above 30`.

**Correction:** boundaries updated in both places that state them. The boundaries remain
user-configurable and saved to user preferences, which the guide already said correctly;
only the stated default was wrong.

---

## 4. The weather strip is not what drives the calculation

**Claimed:** the strip shows "today's ET and precipitation — the same ET that drives the
calculation", and a verify step tells the reader to confirm that "Calculation ET under the filter
tabs matches the ET shown in the weather strip".

**Actual:** the ET on screen reaches the suggested percentages on neither algorithm.

```ts
// site/src/app/spatial-adjust/services/sa-algorithm.service.ts:41
calculateSuggestedPercentAdjust(suggestedPctAdjustments, station, actualVwc,
                                lynxCurrentPercentAdjust = null, currentEt: number = null) {
    switch (this.saSettings?.saAlgorithm ?? SaAlgorithm.DeltaPlusTodayEt) {
        case SaAlgorithm.Simple:
            return this.calculateSimple(station.targetVwcPercent, actualVwc, lynxCurrentPercentAdjust);
        case SaAlgorithm.DeltaPlusTodayEt:
            return this.calculateDeltaPlusTodayEt(station.name, suggestedPctAdjustments);
    }
}
```

`currentEt` is declared and **never read** — neither branch touches it. The only caller passes
four arguments, so it is always `null`:

```ts
// site/src/app/spatial-adjust/components/sa-dashboard/sa-dashboard.component.ts:576
station.suggestedAdjAmtPercent = this.saAlgorithmService.calculateSuggestedPercentAdjust(
    this.suggestedPctAdjustments, station, averageMoisture, adjustment.percentAdjustPercent);
```

**Option 1** (`calculateSimple`) is `targetVwc / actualVwc × the percent adjust Lynx holds`. No ET
term at all. **Option 2** (`calculateDeltaPlusTodayEt`) performs no calculation client-side — it
looks up a server-computed `suggestedPercentAdjust` by station name. So whatever ET informed
Option 2 was applied server-side before the page loaded, and cannot be checked against the strip.

**Why this one mattered more than a wrong sentence.** The second claim is a *verify* step — the
instruction a reader follows to confirm they succeeded. It asks them to compare two figures that
are not required to agree. A reader whose numbers differ concludes they made a mistake and starts
undoing correct work. Corrected in `src/transform-export.mjs` as transform 6.

## 5. "Pushed Today" releases at local midnight, not 24 hours after the push

**Claimed:** nothing incorrect — the guides say a pushed station is held back so you do not adjust
the same head "twice in a day", which is accurate. The omission is *when the day ends*, and the
rule is not the one a reader would assume.

**Actual:**

```ts
// site/src/app/spatial-adjust/utils/spatial-adjust.util.ts:11
static isStationPushable(utcDate, utcOffsetInSeconds) {
    return DateUtils.isUtcDateAtLeastOneDayAgoLocally(dateObj, utcOffsetInSeconds);
}

// site/src/app/common/utils/date.util.ts:81
const localDate  = DateTime.fromJSDate(utcDate, { zone: 'utc' }).plus({ seconds: offsetSeconds }).startOf('day');
const localToday = DateTime.utc().plus({ seconds: offsetSeconds }).startOf('day');
return localDate < localToday;
```

Both sides are floored to the start of the day in the **course's** offset, so the hold releases at
local midnight. A station pushed at 11:58 PM is selectable again two minutes later. The natural
reading of "twice in a day" is a rolling 24 hours, and acting on that assumption double-adjusts a
head. One sentence added in `src/transform-export.mjs` as transform 7.

Worth flagging separately: `SPATIAL_ADJUST.PUSHED_IN_LAST_N` — **"Pushed in last 24H"** — is
present in all eleven IntelliDash catalogues and referenced by no code. If it is ever wired up it
will state the wrong rule.

## Checked and found correct — no change made

**Push recovery.** The guides say Spatial Adjust re-reads the station list, compares each
value against what Lynx reports, treats mismatches as failed, and retries automatically "up
to two further attempts after the first", making a manual re-push "a fourth attempt". All of
that is accurate:

```ts
// sa-push-changes.service.ts:29
private readonly MAX_RETRY_COUNT = 2;   // in addition to the initial push attempt. So total attempts = MAX_RETRY_COUNT + 1.

// :73 — compare what was sent against what Lynx now holds
const unchangedStations = this.pendingStationChanges.filter(pending => {
    const match = stationDataMap.get(pending.stationAdjustId);
    if (!match) return false;
    return pending.userPercentAdjust !== match.percentAdjustPercent;
});
```

An earlier audit finding claimed the guides advised re-pushing in a way the product does not
support, and that push "reports success it cannot know". Both were wrong — reconcile-and-retry
exists and the guide describes it correctly. Recorded here so the finding is not raised again.
