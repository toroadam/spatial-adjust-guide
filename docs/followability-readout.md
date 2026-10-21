# Followability readout

Result of the two moderated rounds in `docs/test-protocol.md`. Participants are identified by code only.
Raw files (`__saExport()` events and moderator sheets) stay in the gitignored `_sessions/` directory and
are never pasted here.

## Status

| | Round 1 | Round 2 |
|---|---|---|
| Sessions run | **No. 0 of at least 5.** | **No. 0 of at least 5.** |
| Why | Sessions need real participants, a moderator and consent. The owner replaced the pre-publication moderated sessions with the in-person expert walkthrough of the live site on 2026-10-22 (`docs/review-agenda.md`). No participant has used these guides under the protocol yet. | Round 2 follows the stuck-point fixes, which follow round 1. |

Nothing below this line holds a result, because there is none. Every number in this document is filled
in from `scripts/session-readout.mjs`, never written by hand, and never estimated. The tables are empty on
purpose. An empty table is the honest state; a table of invented percentages would be worse than none.

## What is ready

- `docs/test-protocol.md`: the cohort, the session script, six scored tasks tied to guide keys, the
  moderator rules, the observation sheet and the exact definitions of completed unaided, time on task and
  stuck point.
- `scripts/session-readout.mjs`: turns a round directory into the table below, and `--compare` sets round 2
  against round 1 and the targets. `--selftest` checks its scoring on made-up sessions.
- `_sessions/` is gitignored.

## How to fill this in

1. Run a session as the protocol says. Save `<code>.events.json` and `<code>.moderator.json` in
   `_sessions/round1/`.
2. After the fifth session: `node scripts/session-readout.mjs _sessions/round1`. Paste the table under
   *Round 1*.
3. Write the stuck steps in words, choose a fix for each (`src/rewrite/*.mjs`, with the checks and the
   translation procedure from the protocol), and record the fix under *Stuck points and fixes*.
4. After the fixes are on the site, run round 2 into `_sessions/round2/` with different people, then
   `node scripts/session-readout.mjs --compare _sessions/round1 _sessions/round2`.
5. Fill in *Comparison*. If a task is under 80%, or stuck points per participant did not fall, say so under
   *Shortfall* and log a decision naming the gap and the next fix.

## Round 1

Cohort: *(codes, group, experience, device; filled from the readout)*

*(table from `scripts/session-readout.mjs`)*

## Stuck points and fixes

| Guide key | Step | What people did | Fix | Check results |
|---|---|---|---|---|
| | | | | |

## Round 2

Cohort: *(codes, group, experience, device; different people from round 1)*

*(table from `scripts/session-readout.mjs`)*

## Comparison

Targets: at least 80% unaided completion on every tested task; fewer stuck points per participant than
round 1, and no task with more.

*(output of `--compare`)*

## Shortfall

*(none recorded: no sessions have been run. If a target is missed, name the task, the gap and the next
fix here, and log a decision.)*

## Findings for the post-review triage

Each finding is written as a *Guide feedback* row, the format the triage reads: page (the guide's title),
step, kind, locale, page URL (`https://toroadam.github.io/spatial-adjust-guide/#/<key>`) and comment.

| Page | Step | Kind | Locale | Page URL | Comment |
|---|---|---|---|---|---|
| | | | | | |

## Product findings (IntelliDash, not the guides)

*(none recorded)*
