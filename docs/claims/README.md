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
| `origin/Deployments/release/261014_phase_3a` | **production** (confirmed 2026-10-19, see below) | `1aa4f28622cc3cc9637f0d61a438bf16bcf01924` | 2026-10-15T10:47:06-07:00 | 2.5.261015 |
| `origin/develop` | develop, and the beta environment (`origin/Deployments/beta/261015_tr_v3_api_sprt` is the same SHA) | `bd39f465cf5a7ae0356a59825250b36044085714` | 2026-10-15T13:05:13-07:00 | 2.5.261012 |
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

**Confirmed on 2026-10-19.** The repository says how a production snapshot is named, but it
cannot say which snapshot is running now: `docs/guides/deployment.md:77` notes that nothing in the
repository describes how production is published. The guides owner delegated the call, and it was
made on two further facts. `261014_phase_3a` contains `2503d032` "Hide non production widgets:
Decision Tree, DTN Weather, Weather Averages", a commit develop does not have and one that only
makes sense on a snapshot bound for production. And the newest `Deployments/beta/*` branch,
`261015_tr_v3_api_sprt`, sits on exactly the develop SHA, so develop is what the beta environment
runs. `sources.json` records `confirmed: true` and a `beta` entry. Content that is on develop but
not on production is beta content, which the beta-content switch handles. If a newer `Deployments/release/*`
branch appears, re-pin `sources.json` and re-check every claim whose evidence cites a file that
differs between the two SHAs.

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
- `step` is the 1-based step number for anything inside a step. Otherwise it is one of `tile`,
  `summary`, `where`, `note`, `before` or `verify`. `tile` is the guide's card in the catalogue,
  meaning the tile title plus the tile summary. `note` is the guide's note callout before step 1.
  The four Target Profiles guides use it for their shipping notice, labelled "New in IntelliDash."
  (any other guide's note is labelled "Note."). It was labelled "Concept." before
  `docs/text-corrections.md` §11.
- `n` is the 1-based sentence index within that bucket. Inside a step it counts across the fields
  in this order: title, body, caption, tip. The tip's label and its text count as one callout.

A title, a `where` line and a tile title each form one claim. Prose is split into sentences with
`Intl.Segmenter('en', { granularity: 'sentence' })`.

Within a shard, claims are sorted in reading order: `tile`, `summary`, `where`, `note`,
`before`, the numbered steps, then `verify`, and by `n` inside each.

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

## Files and tooling

| File | What it is | Who writes it |
|---|---|---|
| `docs/claims/guides/<guide-key>.json` | One shard per guide: `{ "guide", "title", "claims": [...] }` | The extractor creates it. One verification feature per shard (see the shard map) fills in status and evidence. |
| `docs/claims/claims.json` | The canonical aggregate: `_meta` (pinned SHAs, counts by status and type) plus every claim, guides in alphabetical order | Only the extractor. Never edit it by hand. |
| `docs/claims/sources.json` | The pinned IntelliDash SHAs | Feature 1. The lint checks every citation against it. |

`scripts/claims-extract.mjs` builds the ledger from the published text, which means the export
after `transformGuide()` has applied every correction. It evaluates the guide data block in
`node:vm` rather than scraping it, so it sees all 26 guides and every field: tile, summary, where,
note, before, step title, body, caption, tip and verify.

| Command | What it does |
|---|---|
| `npm run claims:extract` | Re-extracts every guide, merges into the existing shards, rebuilds `claims.json`, then lints. Run it after any change to the export or the transform layer. |
| `npm run claims:aggregate` | Rebuilds `claims.json` from the shards alone. It lints first and refuses to write if any shard is invalid. Run it after editing a shard. |
| `npm run claims:lint` | Validates every shard and writes nothing. `node scripts/claims-extract.mjs --lint <guide-key> ...` checks only the shards named. Exits 1 on any error. |

What the lint enforces:

- Shards and claims carry only the documented keys, and every claim has all of them except
  `previousText`, which is optional.
- `status` is one of the five statuses and `type` is one of the five types.
- `id` is `<guide-key>/<step>/<n>`, matches the claim's `guide` and `step`, and is unique. `field`
  is valid for its bucket, and claims are in reading order.
- Verified, Wrong and Not shipping each have at least one citation. Wrong has a `correction`, and
  Needs expert has a `question`.
- Every IntelliDash citation has a full 40-character SHA, a repository-relative path and a line
  or line range. A `production` or `develop` citation must use the SHA pinned in `sources.json`.

How a re-extraction merges:

1. **Same text.** A fresh claim whose guide and text match an existing claim keeps that claim's
   `type`, `status`, `evidence`, `note`, `question`, `developNote`, `correction` and
   `previousText`, even if its ID has moved.
2. **Same ID, new text.** Otherwise, a fresh claim takes the existing claim at the same ID, if no
   text match already took it. It goes back to Unverified, its evidence is cleared, and the old
   wording is kept in `previousText`. Because this fallback is positional, a step that gains a
   sentence and has another reworded in the same edit can put `previousText` on the neighbouring
   claim. The status reset is still correct.
3. **Gone.** An existing claim that matches nothing is dropped. If it had a status other than
   Unverified, the extractor names it in its output so the lost verification is visible.

The output uses a stable key order and 2-space JSON and is only written when it changes, so two
runs in a row leave `git diff` clean.

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

## Review pack

The review pack is what the experts read. `scripts/review-pack.mjs` turns the ledger into one
HTML page per guide, a combined `index.html`, and a PDF of the combined file.

```sh
npm run review-pack
```

Run it once the shards are final and `claims.json` has been rebuilt. It reads
`docs/claims/claims.json`, `docs/claims/sources.json`, the published guide text from
`extractGuides()`, and the push-window and Lynx questions from `operational-contract.md` and
`src/transforms/operational-contract.mjs`, and nothing else. It never writes to `docs/claims/`.

It refuses to write anything when:

- the ledger fails the lint, for example a Needs expert claim with no question;
- the ledger no longer matches the published text, meaning a claim ID or its wording differs from
  a fresh extraction, or `sources.json` now pins a different production SHA. Run
  `npm run claims:extract` and try again. `--allow-stale` renders the pack anyway with a banner on
  every page. Never send a pack that carries that banner;
- the output directory is inside `dist/` or `docs/claims/`, contains the repository, or holds
  files the generator did not write.

| Option | What it does |
|---|---|
| `--ledger <file>` | Reads another ledger, such as a test fixture, instead of `docs/claims/claims.json` |
| `--out <dir>` | Writes somewhere other than `review-pack/` |
| `--no-pdf` | Skips the PDF and the browser check, which is quicker while working on the layout |
| `--allow-stale` | Renders a stale ledger, marked as stale |

### What it writes

| File | What it is |
|---|---|
| `review-pack/index.html` | The badge legend, totals by status and by type, and a table of every guide with its claim, Wrong, Needs expert, Not shipping and Unverified counts. Then the questions page, then all 26 guides, in catalogue order. |
| `review-pack/push-window-questions.html` | "Questions for the experts: push window and Lynx prerequisites". The seven questions Q1-Q7 from `operational-contract.md`, each with the wording that rests on it and the live page and step where it appears, then the rules, then every other Needs expert claim with its guide, step, question and live page. It says whether the operational wording is published or held back. It is the agenda for a review that walks the live site. |
| `review-pack/<guide-key>.html` | One guide on its own, 26 files. Use these to send a single guide to the expert who owns it. |
| `review-pack/spatial-adjust-guides-review.pdf` | `index.html` printed to A4. Each guide starts on a new page, and every page is numbered. |

Each guide has, in order:

1. A header with the category, the catalogue card, the pinned production and develop SHAs, the
   time the pack was generated, and a link to the guide on the live site.
2. For the four Target Profiles guides, the "New in IntelliDash" notice that readers see before
   step 1, with the status of its claims.
3. The guide as written, section by section: the catalogue card, the summary, where to find it,
   the banner before step 1, before you start, each step (title, body, caption and tip), and how
   to know it worked. Every claim in a section is listed under the published text.
4. **Questions for the experts**: every Needs expert claim in the guide, with its claim ID, its
   question, the sentence it is about and room for an answer.
5. A sign-off box: Approved, Approved with changes or Rejected, plus the reviewer's role and the
   date. It asks for the role, not a name. Feature 10 transcribes these verdicts into
   `docs/claims/signoff.md`.

The pages are self-contained. They have inline CSS, system fonts, no scripts, no images and a
`default-src 'none'` Content-Security-Policy. Before printing the PDF, the generator opens every
page in Chromium and fails if any page requests anything. The PDF uses the Chromium that the test
suite already installs with `npx playwright install chromium`, so no new dependency is needed.

### Where it goes

`review-pack/` is gitignored, and nothing in it is ever committed. Share the PDF, or the folder
zipped, through Toro SharePoint or Teams. It is never published on GitHub Pages. The deploy
workflow uploads `dist/` alone, and `build.mjs` copies only `STATIC_DIRS` (assets, `_ds` and
`vendor`, `build.mjs:30`) plus the files it generates. Do not add `review-pack` to `STATIC_DIRS`,
and do not copy pack files into the repository.

The pack follows the same no-excerpts rule as the ledger. Citations are `path:line` and all prose
is the ledger's own, so the pack can be forwarded freely inside Toro. It is still internal: the
verifier notes and open questions are not written for customers.

### Reading the badges

| Badge | Meaning | What the reviewer does |
|---|---|---|
| Verified | Production does what the claim says. The citation shows where. | Nothing, unless field experience says otherwise. |
| Wrong | Production contradicts the claim. The proposed correction is shown beside it. | Check the proposed correction. |
| Not shipping | The claim describes something that is not in the production build. | Say whether the guide should describe it at all. |
| Needs expert | The source code cannot settle the claim. Its question is listed under Questions for the experts. | Answer in a line or two, quoting the claim ID. |
| Unverified | Nobody has checked it yet. | Read it as unchecked. |

Each claim card also shows its ID, type and field, and its citations. A citation is either an
IntelliDash `path:line` with the ref and the short SHA it was read at, or a section of Toro user
guide 373-1135. Where present, the card adds the correction, the question, what differs on develop
("On develop"), the verifier's note, and the earlier wording if the sentence changed after it was
checked.

### How experts give feedback

Experts comment on the live site, not in the repository. Every page of the pack links to its
guide there. The floating **Feedback** button, bottom right, posts the comment to a Power
Automate flow in Toro's tenant, together with the page, the step, the locale and the URL. The flow
adds it to the *Guide feedback* SharePoint list as an item with Title (the page), Comment, Step,
Kind, Locale and PageURL. The button and the flow are described in the top-level README (`README.md:112-165`).

- The button is only on the deployed site, where `SA_FEEDBACK_ENDPOINT` is set at build time.
  Local builds and the test suite do not render it, so experts must use the live site, after the
  sign-in gate.
- To comment on a step, open the guide, go to that step and press **Feedback**. The panel shows
  the page and step it will attach. Put the claim ID in the comment when it is about one claim.
- Answers to the questions and the sign-off verdict can be written into the pack's answer and
  sign-off boxes and returned through the same SharePoint or Teams channel, or sent through the
  Feedback button on that guide with the claim ID quoted.

Never paste the flow's trigger URL into the pack, this README, a Teams message or an issue. Its
`sig=` parameter is a capability: anyone holding the URL can post to the list
(`README.md:141-148`, `:167-169`).

### After the review

Export the *Guide feedback* list from SharePoint and triage it. That is feature 10. Keep the
export and any annotated PDFs in SharePoint.

Raw comments and commenter names are never committed, including any name typed into a comment.
The repository is public. Only the outcome of the review lands in it: a claim's new status,
question or correction in its shard, a fix in `src/transforms/review-fixes.mjs`, and each guide's
verdict with the reviewer's role and the date in `docs/claims/signoff.md`.

## Handover

### 2026-10-19: published, and handed over for the in-person review on 2026-10-22

- **Published.** The live site, https://toroadam.github.io/spatial-adjust-guide/, carries every
  correction, the changed-surfaces callouts, the "New in IntelliDash" banner and tile badges on the
  four Target Profiles guides, and the push window and Lynx prerequisites in all eleven languages.
  The guide content was last changed by `d264376`, and `bebdde6` was deployed by the
  "Build and deploy to Pages" run 39363468912, which passed, as did "Screen fidelity" on the same
  commit.
- **Pinned sources.** Production `1aa4f28622cc3cc9637f0d61a438bf16bcf01924`
  (`origin/Deployments/release/261014_phase_3a`, 2.5.261015, confirmed 2026-10-19). Develop and
  beta `bd39f465cf5a7ae0356a59825250b36044085714`.
- **Ledger.** 871 claims across 26 guides: 843 Verified, 28 Needs expert, 0 Wrong, 0 Not shipping
  and 0 Unverified.
- **Expert questions.** 20 in all. Seven are the push-window and Lynx questions Q1-Q7 in
  [`operational-contract.md`](operational-contract.md). The wording that rests on them was
  published before they were answered, by the guides owner's decision, so 15 of the Needs expert
  claims are that wording and are settled by Q1-Q7. The other 13 Needs expert claims are questions
  about the guides themselves.
- **No sign-off gate.** Nothing was held back for Needs expert or for sign-off. The experts
  review the live site in person on 2026-10-22, page by page.
- **The pack.** `npm run review-pack` wrote it to `review-pack/` in the local checkout: 26 guide
  pages, `push-window-questions.html` ("Questions for the experts: push window and Lynx
  prerequisites", the agenda: Q1-Q7 and the 13 other questions, each with its live page and
  step), `index.html` and `spatial-adjust-guides-review.pdf`. `review-pack/BRIEF.md` is the
  owner's covering note. All of it is gitignored. The owner shares it with the expert team through
  Toro SharePoint or Teams, never through GitHub.
- **What the experts are asked to do.** Walk the live site with the agenda, answer Q1-Q7 and the
  13 other questions, check that each guide matches what they see in IntelliDash and Lynx, and give
  each guide a verdict in its sign-off box. Comments go through the site's Feedback button, which
  adds them to the *Guide feedback* SharePoint list, or into the pack's answer boxes. Feature 10
  records the answers in `operational-contract.md` and the shards, and the verdicts in
  `signoff.md`.
