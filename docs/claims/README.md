# Claims ledger

## Owner maps

Several features edit this directory and the transform layer at the same time. Each file below
has exactly one owner, so no two of them write the same file. Edit only what your feature owns.

### Shard map: who edits `docs/claims/guides/<key>.json`

| Feature | Shards it owns (guide keys) |
|---|---|
| 2: verify Getting Started, Targets and Station Management (12) | `dashboard-overview`, `understand-spatial-adjust`, `map-navigation`, `understanding-vwc`, `editing-station-targets`, `bulk-adjustments`, `target-profiles`, `creating-profiles`, `updating-profiles`, `seasonal-profiles`, `enable-disable-stations`, `station-details` |
| 3: verify Calculations and the backend arithmetic (8) | `minimum-threshold`, `calculation-settings`, `calculation-methods`, `preferences`, `suggested-adjustments`, `station-zero`, `threshold-questions`, `calculation-questions` |
| 4: verify the push path, scan data and filter (6) | `push-to-lynx`, `reviewing-changes`, `verify-results`, `push-failures`, `filter-adjustments`, `request-scan-data` |

That covers all 26 shards, and each guide appears once. `docs/claims/claims.json` is the
aggregate, and only `scripts/claims-extract.mjs` writes it. The verification features never edit
it by hand. Once shard edits land, rebuild it with
`node scripts/claims-extract.mjs --aggregate-only`. `docs/claims/sources.json` and
`docs/claims/changed-surfaces.md` belong to feature 1 and are read-only for everyone else.

### Module map: who edits `src/transforms/*.mjs`

| Module | Owner | Holds |
|---|---|---|
| `src/transforms/edit.mjs` | feature 1 | The shared anchored `edit()` helper. Do not change what it does. |
| `src/transforms/corrections.mjs` | feature 8 | Corrections for claims the ledger marks Wrong |
| `src/transforms/changed-surfaces.mjs` | feature 6 | IntelliDash changes since 2026-08-13 folded into existing guides |
| `src/transforms/operational-contract.mjs` | feature 5 | The push window and the Lynx prerequisites, in every guide that ends in a push |
| `src/transforms/review-fixes.mjs` | feature 10 | Fixes that come out of the expert review |

`transformGuide()` in `src/transform-export.mjs` calls these modules in this order:
corrections, changed-surfaces, operational-contract, review-fixes. Every `edit()` is anchored on
the exact text it replaces and fails the build if that text has moved. The edits that were already
in `src/transform-export.mjs` stay there, and new edits go into the module their feature owns.

## Purpose

The guides make several hundred factual statements about IntelliDash's Spatial Adjust screen,
including what a label says, where a control is, what a setting does and how a number is
calculated. Readers act on these statements, so each one is listed here as a claim with a
stable ID and checked against the IntelliDash source at a pinned commit. Each claim ends up with
a status, a citation and, if it is wrong, a proposed correction.

The ledger describes the **published** text, which is the export after `transformGuide()` has
run. That includes every correction already in `src/transform-export.mjs` and the two guides
it adds (`request-scan-data`, `filter-adjustments`).

## Pinned sources

Every citation is pinned to one of these commits. The machine-readable copy is
[`sources.json`](sources.json).

| Ref | Role | SHA | Commit date | `site/package.json` version |
|---|---|---|---|---|
| `origin/Deployments/release/261014_phase_3a` | **production** (unconfirmed, see below) | `1aa4f28622cc3cc9637f0d61a438bf16bcf01924` | 2026-10-15T10:47:06-07:00 | 2.5.261015 |
| `origin/develop` | develop | `bd39f465cf5a7ae0356a59825250b36044085714` | 2026-10-15T13:05:13-07:00 | 2.5.261012 |
| local `develop` before the fetch | baseline for the change inventory | `4d8aa61eb6131c5c5ef0f5df5d51079cc2eadedd` | 2026-08-13T19:42:16Z | 2.5.260811 |
| `origin/feature/260812_target_profiles` | Target Profiles branch | `53b5c5cde1128efabad6e1b79b9903d49a2d7c8c` | 2026-08-23T12:38:39-07:00 | n/a |
| `origin/feature/260824_target_profiles_queue` | Target Profiles queue branch | `d86ec595474bb6e535071a4f7dadf1d157c83cc8` | 2026-08-26T14:06:23-07:00 | n/a |

**Fetched:** 2026-10-19T17:41:40Z, by `git -C ~/IntelliDash fetch --all --prune --tags`. The
fetch moved only remote-tracking refs. The checkout's `HEAD` (local `develop` at `4d8aa61e`) and
its clean working tree were the same before and after.

Production and develop have diverged. Production has 6 commits that develop lacks, and develop
has 18 that production lacks. Their merge base is `f954ae1e`. Neither one contains the other, so
a claim can be true on one and false on the other.

### How production was identified

IntelliDash has no tags, so there is no release tag to read. The repository does document its own
convention at the production SHA:

- `CONTRIBUTING.md:26`: `Deployments/release/{YYMMDD}_{slug}` is the snapshot deployed to
  production.
- `CONTRIBUTING.md:44`: production ships from `Deployments/release/*` branches, not from `master`.
- `CONTRIBUTING.md:47-48`: with no tags, a release is identified by its `Deployments/release/*`
  branch name and the version in `site/package.json`.

After the fetch there are 11 `Deployments/release/*` branches. `261014_phase_3a` is the newest of
them by both its `YYMMDD` name and its committer date, and its `site/package.json:3` version
(2.5.261015) is the highest of any ref inspected. Two candidates were rejected:

- `origin/master` (`f2d965833b6da6847438cd07e83d0ed51a7fb1bf`, 2023-02-02).
  `CONTRIBUTING.md:41-45` says master is not the release branch in current practice.
- `origin/release/251001_i360` (`9d0b78c9d472a9eac19500947da88489359426c9`, 2025-10-01). This uses
  the older `release/` shape that `CONTRIBUTING.md:36` lists as a deviation, and it is a year older
  than the newest `Deployments/release/*` branch.

**Not confirmed.** The repository says how a production snapshot is named, but it cannot say which
snapshot is running now. `docs/guides/deployment.md:77` notes that nothing in the repository
describes how production is published. `sources.json` therefore records `confirmed: false`, and
the release owner has been asked to confirm. Verification proceeds against this candidate in the
meantime. If the release owner names a different build, re-pin `sources.json` and re-check every
claim whose evidence cites a file that differs between the two SHAs.

## Rules for verifiers

1. **Guides describe production.** Judge every claim against the production SHA. If develop
   differs, say what changes in `developNote`, but do not let develop decide the status. This
   includes Target Profiles. Its menu entry is live on production
   (`sa-settings-dlg.component.ts:55`, see [`changed-surfaces.md`](changed-surfaces.md)), so its
   claims are judged against production as well. The two feature branches above are history, kept
   for citing where something was first built.
2. **No excerpts.** The guide repository is public and IntelliDash is not. Cite `path:line` and
   describe the behaviour in prose. Never paste IntelliDash code, templates or comments. Product
   copy is the exception: an `en-us.json` key name and its English label are text a user sees, so
   they may be quoted.
3. **Read-only.** Use `git show <sha>:<path>`, `git grep -n <pattern> <sha> -- <path>`,
   `git log` and `git diff` against `~/IntelliDash`. Never check out, switch, pull, reset, stash,
   commit, branch or push there.
4. **No customer data.** Do not record real course names, coordinates or anything from
   `sanitize.local.json`.
5. **The reproduction is a witness, not evidence.** `SpatialAdjustApp.dc.html` has repeated the
   same errors as the prose before (see `docs/text-corrections.md` §6 and §8-10).

## Status vocabulary

Every claim starts as **Unverified**, which means nobody has checked it yet. A verifier then gives
it exactly one of these:

| Status | Meaning | Required alongside it |
|---|---|---|
| Verified | Production does what the claim says | at least one citation |
| Wrong | Production contradicts the claim | a citation, plus `correction`: replacement wording and one sentence on why |
| Not shipping | The claim describes something that is not in the production build | the production citation showing it absent (for example a commented-out menu entry), plus the branch file that implements it |
| Needs expert | The source cannot settle the claim, for example an agronomic judgement or Lynx-side behaviour | `question`: phrased so an agronomist can answer it in one line |

## Claim types

The extractor sets the type with a heuristic, and a verifier may change it.

| Type | What it asserts | Evidence expected |
|---|---|---|
| `label` | The text on a control, column, tab or dialog | The `en-us.json` key in the `SPATIAL_ADJUST` block and the template binding that paints it, or the hardcoded literal |
| `navigation` | Where something is and how to get to it | The template, menu or route that makes the path reachable |
| `behaviour` | What the product does when you act | The component or service logic |
| `calculation` | How a number is produced | The frontend service plus `api/Services/SpatialAdjustService.cs` or `api/BackgroundTasks/ProcessSpatialAdjustDataService.cs` |
| `prerequisite` | What must be true before you start | A section of Toro user guide 373-1135 rev 02. If no section covers it, the claim is Needs expert. |

## Claim IDs

`<guide-key>/<step>/<n>`

- `guide-key` is the key in `GUIDES`, for example `push-to-lynx`.
- `step` is the 1-based step number for anything inside a step. Otherwise it is one of `summary`,
  `where`, `before`, `verify` or `tile`. `tile` is the guide's card in the catalogue, meaning the
  tile title plus the tile summary.
- `n` is the 1-based sentence index within that bucket. Inside a step it counts across the fields
  in this order: title, body, caption, tip. The tip's label and its text count as one callout.

A title, a `where` line and a tile title each form one claim. Prose is split into sentences with
`Intl.Segmenter('en', { granularity: 'sentence' })`.

IDs are positional, so inserting a sentence shifts the IDs after it. To keep a re-extraction from
losing work, the extractor carries status forward by matching guide and text first, and falls
back to matching by ID. A claim whose text has changed goes back to Unverified and keeps its old
wording in `previousText`.

## Claim record

```json
{
  "id": "push-to-lynx/5/2",
  "guide": "push-to-lynx",
  "step": "5",
  "field": "body",
  "text": "…",
  "type": "behaviour",
  "status": "Unverified",
  "evidence": [],
  "note": "",
  "question": "",
  "developNote": "",
  "correction": ""
}
```

## Citation format

Code evidence:

```json
{ "source": "intellidash", "ref": "production", "sha": "<40-char sha>", "path": "site/src/app/…", "line": 123 }
```

`ref` is `production`, `develop` or `branch:<name>`, and `sha` must be the matching SHA from
`sources.json`. `line` may be a range written as a string, for example `"161-168"`.

Document evidence:

```json
{ "source": "doc", "ref": "373-1135 rev 02 §x" }
```
