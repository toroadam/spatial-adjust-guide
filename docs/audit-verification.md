# Coherence findings — re-verification

Re-check of the figure/step coherence findings before any correction is made, because the
extraction used during the audit was lossy and could have produced artefacts.

It did. **Every coherence finding in the original audit was an artefact.** The corrected
result is that no step repeats the one before it, and every guide has authored cursor
targets. One genuine defect was found, and it is unrelated to the original findings.

## The extraction was wrong in five ways

The original extractor read the guide with loose regexes. Re-parsing by matching brace spans
instead produced a different picture:

| Field | Original extract | Actually present |
|---|---|---|
| `check` | looked for this | **does not exist** — the field is `verify` |
| `verify` | missed entirely | present on all 24 guides |
| `caption` | missed | present on all 112 steps |
| `tip` / `tipLabel` | missed | 19 steps |
| `selectedRows` | missed | 4 steps |
| per-step `t` (cursor) | missed | 5 steps |
| **`TARGETS` coverage** | **read 7 guides** | **all 24 are mapped** |

The last row is the one that mattered. `TARGETS` is populated in two places:

```js
const TARGETS = { ...7 guides... };   // line 322 of the export
// ~700 lines later, after GUIDES:
Object.assign(TARGETS, { ...the other 17... });   // line 1044
```

The extractor only read the object literal, so the seventeen guides filled in by
`Object.assign` looked unmapped. They were never unmapped.

## Consequences

**The "16 indistinguishable steps" finding is withdrawn.** It was defined as *identical
props, identical crop, and no cursor target anywhere in the guide*. The third condition was
false for all sixteen — each has an authored target that moves between steps.

Re-running the check with the merged `TARGETS`, comparing all 21 step props plus the crop
plus the resolved cursor position:

```
steps identical to the one before (props + crop + cursor): 0
```

No step in any of the 24 guides is visually identical to its predecessor. There is nothing
to fix, and the earlier plan to author 17 replacement `TARGETS` entries was based on a
condition that did not exist.

## The one genuine defect

`calculation-settings` step 1 — "Open Settings on the Calculation tab" — targeted `P.gear`
at x=1836, but the step's crop is `dlgWide`, which frames x 490–1430. `camera()` pans only
vertically to keep a target in view, so the gear resolved to `tx=1133` on a 792px stage and
the cursor was drawn off the right-hand edge, invisible.

The figure for that step already shows the dialog open on Calculation, so the gear has been
clicked by the time it renders. Retargeted to `P.menuCalc`, the Calculation tab inside the
dialog — in frame, and what "on the Calculation tab" refers to. Applied as an anchored
transform in `src/transform-export.mjs`, so a re-export that changes the entry fails the
build rather than silently reverting.

## Verification

`scripts/cursor.mjs` deep-links each step, reads the resolved `--tx` / `--ty` off the cursor
element and checks it falls inside the stage:

```
guides: 24 | stepsChecked: 112 | offStage: 0
```

## Method note

The original audit and this correction failed the same way twice: a regex that matched the
first plausible construct and stopped. Both `check:` vs `verify:` and the missed
`Object.assign` are that error. Where a value can be assembled from more than one site,
evaluate it rather than pattern-match it — the check above builds `TARGETS` by evaluating
both sources and merging them, which is why it disagreed with the audit.
