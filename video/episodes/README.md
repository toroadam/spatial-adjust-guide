# Episodes

One folder per episode: `video/episodes/<id>/episode.json`, plus the `script.md` it was locked from. `episode.json` is the one contract that capture, voice-over, build, verify and captions all read. Its schema is `video/lib/episode-schema.mjs` (zod). This page holds the Double Click series' readiness check and tracker, then the field-by-field reference for `episode.json`.

Only the episode definition lives here. Takes, VO, renders and every other media file go under the media root, `~/Documents/SpatialAdjust_MarCom/episodes/<id>/` (see [`../README.md`](../README.md)), never in this folder.

## The Double Click series

Twenty-six Double Click episodes, one per guide, in six waves. Each episode walks the steps of one guide in IntelliDash Demo Mode: one chapter per guide step, labelled with the step title, narrated in the Brian voice with the guide's own Do and You-should-see lines, and closed on the next episode and the guide's address on the site. Every episode follows the same procedure, [`RUNBOOK.md`](RUNBOOK.md), from preflight to commit.

- [`series.json`](series.json) is the machine-readable source for the series: order, waves, status, runtime, loudness, timestamps, credits per wave, the voice constants and the music bed.
- The tracker below is generated from it by `node scripts/episode-lint.mjs <url> --write-tracker`; edit `series.json`, never the table.
- `npm run test:episodes` holds every episode that has left `planned` to the series rules; see RUNBOOK.md, "Formats", for what it checks.

## Readiness

Checked 2026-10-20 on the branch the series is built on. The series depends on three pieces of upstream work that were planned in parallel with it, and this section records what each had delivered when the series started. It only reads their outputs; anything missing goes back to the work that owns it.

### Upstream work

| Upstream work | What the series needs from it | State on 2026-10-20 |
|---|---|---|
| Video pipeline (capture, voice, edit, verify; the Double Click toolchain ported into `video/`) | Every tool an episode is made with | Active, 87% complete. 8 of 9 parts done, the verify gate and the episode builder with the audio mix among them. The 20-30 s Dashboard overview pilot has not been produced yet. |
| Claims ledger (every claim in the 26 guides checked against IntelliDash) | Verified claim IDs for every narrated line and on-screen text | Active, 87% complete. The ledger is in `docs/claims/claims.json`: 871 claims, 843 Verified, 28 Needs expert, 0 Wrong. Publishing the corrected guides and the post-review sign-off are still open. |
| Followability rewrite (every step as Do, You should see and If not, with exact labels) | The Do, You-should-see and If-not lines each chapter narrates, and the bold labels the highlights land on | Active, 12% complete. The writing standard and its checks are done on their own branch; no guide renders the new step shape on this branch yet (0 of 26). |

### Pipeline paths

Each path the series needs from the video pipeline, checked on disk. All are present, so the series is not blocked.

| Path | What it is | Present |
|---|---|---|
| `video/README.md` | Pipeline overview, media root, safety rules, commands | yes |
| `video/capture/director.mjs` | The capture director: one page, one navigation to the `/spatialadjust/demo` entry, no reload | yes |
| `video/capture/gates.mjs` and `scripts/lib/guarded-click.mjs` | The director's gate: the entry URL must end `/spatialadjust/demo` (`checkEntryUrl`), any document load after arming ends the take, and every request other than GET, HEAD or OPTIONS is aborted (`video/capture/SAFETY.md:167-191`); the click guard refuses undeclared write-like clicks | yes |
| `video/capture/course-overlay.js` | The fictional course overlay applied at capture time | yes |
| `video/capture/SAFETY.md` | The Demo Mode audit, with `file:line` citations for every write guard | yes |
| `video/vo/render-brian.py` | The Brian voice renderer | yes |
| `video/edit/` (`lib/engine.py`, `lib/renderer.py`, `render.py`, `build.py`, `mix.py`) | The compositor, the episode builder and the audio mix | yes |
| `video/verify/verify.py` | The release gate (format, loudness, holds, black and frozen frames), with `ocr_check.py` and `captions.py` | yes |
| `video/approvals.md` G1 fictional course, G2 map approach, G3 style frame, G5 music licence | Each gate decided by the executor under the owner's direction of 2026-10-19 (Riverbend National; restyled map tiles; the Spatial Adjust brand; the original music bed `sa-bed-v1`) | yes |
| A passing verify report for the pilot | Proof the whole chain runs end to end | not yet: the pilot has not been produced. Not a path the episodes need on disk; the first episode of wave 1 proves the chain instead. |

### Demo Mode writes

Every write the series films, and what Demo Mode does with it according to the audit in [`../capture/SAFETY.md`](../capture/SAFETY.md). Demo Mode mocks **none** of them: each is short-circuited where it starts, most with the "unsupported in Demo Mode" message (`showUnsupportedMsg`), so nothing is stored and nothing reaches the network. An episode that films one of these clicks films the click in Demo Mode and its result on the guide site's recreation: the chapter's `source` is `mixed` (or `recreation`) and the `demoWriteClicks` entry's `outcome` is `recreation` (RUNBOOK.md, "Demo Mode writes rule"). The first column is the `safetyRef` an episode's `demoWriteClicks` entry names; `scripts/episode-lint.mjs` reads this table.

| safetyRef | Write the series films | Guides | Demo Mode | SAFETY.md |
|---|---|---|---|---|
| `push-open` | Push Changes in the toolbar: opens the confirmation dialog | push-to-lynx, reviewing-changes, verify-results, push-failures | no write | `video/capture/SAFETY.md:85` |
| `push-send` | Push Changes confirmed in the dialog: the push to Lynx | push-to-lynx, verify-results, push-failures | short-circuited | `video/capture/SAFETY.md:87` |
| `settings-save` | Settings dialog Save: calculation settings, calculation method, minimum threshold, units | calculation-settings, calculation-methods, minimum-threshold, preferences | short-circuited | `video/capture/SAFETY.md:98` |
| `preferences-save` | User preferences dialog Save | preferences | short-circuited | `video/capture/SAFETY.md:99` |
| `filter-save` | Over/Under threshold (% Adj. filter) Save | filter-adjustments, threshold-questions | short-circuited | `video/capture/SAFETY.md:100` |
| `bulk-apply` | Bulk Adjust Save | bulk-adjustments | short-circuited | `video/capture/SAFETY.md:101` |
| `target-edit` | Target VWC edit in the table | editing-station-targets, understanding-vwc | short-circuited (silently, no message) | `video/capture/SAFETY.md:102` |
| `adjust-edit` | % Adj. edit in the table (user percent adjust) | suggested-adjustments | short-circuited | `video/capture/SAFETY.md:68` |
| `enable-toggle` | Enable toggle and its cascade to the hole and area rows | enable-disable-stations | short-circuited (silently, no message) | `video/capture/SAFETY.md:103` |
| `recalculate` | Recalculate adjustments | calculation-settings, calculation-questions | short-circuited | `video/capture/SAFETY.md:65` |
| `scan-request` | Request latest scan data | request-scan-data | short-circuited | `video/capture/SAFETY.md:75` |
| `profile-apply-save` | Target Profiles Update from Current or Apply Profile, then Save | target-profiles, creating-profiles, updating-profiles, seasonal-profiles | short-circuited (by the Settings dialog Save guard) | `video/capture/SAFETY.md:98` |

The `Demo Mode` column takes one of three values: `mocked` (Demo Mode performs the write against mock data, so its result may be filmed in Demo Mode), `short-circuited` (the result must come from the recreation) or `no write` (the click only opens something, so its result is filmed in Demo Mode).

### Cascade Continue and the write guard

Checked 2026-10-20 for the Enable and disable stations episode. The cascade confirmation's Continue button commits the cascade to every station beneath a hole or area, but its name does not match the write guard (the `WRITES` pattern in `scripts/lib/writes.mjs`). `refuseReason` in `scripts/lib/guarded-click.mjs` (lines 53-69) and the director's in-page recheck (`video/capture/director-runtime.js`, lines 300-307) therefore judge a Continue click only against `allowClicks` and never ask whether Demo Mode was verified: a Continue declared in `demoWriteClicks` alone is always refused, and a Continue listed in `allowClicks` would be allowed even on a session that is not Demo Mode, leaving the director's block on non-GET requests as the only layer. **Not covered.** It was reported to the video pipeline work, which owns the guard (suggested fix: treat any name in `demoWriteClicks` as write-like, so it needs a verified Demo Mode session, and refuse a `demoWriteClicks` name that is also in `allowClicks`). Until that lands, no Demo Mode take presses a cascade Continue: the episode films the dialog from the recreation, declares both Continue buttons (`enable-toggle`, outcome `recreation`) and never clicks them.

### Claims ledger

Claims per guide in `docs/claims/claims.json`, by status (counts only). No guide has a Wrong or Not shipping claim. A Needs-expert claim is never narrated: the episode's lines cite Verified claims only.

| Wave | Guide | Verified | Wrong | Not shipping | Needs expert |
|---|---|---|---|---|---|
| 1 | `dashboard-overview` | 48 | 0 | 0 | 0 |
| 1 | `understand-spatial-adjust` | 31 | 0 | 0 | 1 |
| 1 | `map-navigation` | 32 | 0 | 0 | 0 |
| 1 | `understanding-vwc` | 29 | 0 | 0 | 1 |
| 2 | `suggested-adjustments` | 34 | 0 | 0 | 2 |
| 2 | `filter-adjustments` | 41 | 0 | 0 | 0 |
| 2 | `push-to-lynx` | 43 | 0 | 0 | 5 |
| 2 | `reviewing-changes` | 31 | 0 | 0 | 2 |
| 2 | `verify-results` | 34 | 0 | 0 | 2 |
| 3 | `editing-station-targets` | 29 | 0 | 0 | 0 |
| 3 | `bulk-adjustments` | 31 | 0 | 0 | 0 |
| 3 | `enable-disable-stations` | 28 | 0 | 0 | 1 |
| 3 | `station-details` | 25 | 0 | 0 | 1 |
| 4 | `minimum-threshold` | 39 | 0 | 0 | 3 |
| 4 | `calculation-settings` | 37 | 0 | 0 | 0 |
| 4 | `calculation-methods` | 33 | 0 | 0 | 0 |
| 4 | `preferences` | 30 | 0 | 0 | 0 |
| 5 | `station-zero` | 35 | 0 | 0 | 2 |
| 5 | `request-scan-data` | 37 | 0 | 0 | 0 |
| 5 | `threshold-questions` | 29 | 0 | 0 | 0 |
| 5 | `calculation-questions` | 32 | 0 | 0 | 0 |
| 5 | `push-failures` | 29 | 0 | 0 | 3 |
| 6 | `target-profiles` | 28 | 0 | 0 | 1 |
| 6 | `creating-profiles` | 25 | 0 | 0 | 0 |
| 6 | `updating-profiles` | 28 | 0 | 0 | 0 |
| 6 | `seasonal-profiles` | 25 | 0 | 0 | 4 |
| | **Total** | **843** | **0** | **0** | **28** |

### Wave 6 gate

**Wave 6 gate: open (A), 2026-10-20.** Checked on branch `e196-wave6` before any wave 6 script was written. Target Profiles ships in production, so the gate is condition A (shipped, Verified, reachable in `/demo`). Route B, a COMING SOON treatment, is retired: no wave 6 episode carries `treatment: coming-soon`, and none cites a Not shipping claim (there are none).

Claims for the four Target Profiles guides in `docs/claims/guides/`, by status, after the claims audit corrected and re-verified them:

| Guide | Verified | Needs expert | Wrong | Not shipping | Unverified | Verified claims citing production `1aa4f286` |
|---|---|---|---|---|---|---|
| `target-profiles` | 28 | 1 | 0 | 0 | 0 | 28 |
| `creating-profiles` | 25 | 0 | 0 | 0 | 0 | 25 |
| `updating-profiles` | 28 | 0 | 0 | 0 | 0 | 28 |
| `seasonal-profiles` | 25 | 4 | 0 | 0 | 0 | 23; `before/2` and `before/3` cite the Lynx manual 373-1135 rev 02 instead |
| **Total** | **106** | **5** | **0** | **0** | **0** | **104** |

| Check | Evidence | Result |
|---|---|---|
| Claims | The table above: 0 Wrong, 0 Not shipping, 0 Unverified. The 5 Needs expert claims are operational judgements put to the experts for the in-person review (`target-profiles/3/5`, the tournament routine; `seasonal-profiles/1/2`, which set of profiles covers most courses; `seasonal-profiles/2/1`, the step title "Apply the evening before"; `seasonal-profiles/4/6` and `4/7`, the push window). None is Wrong | open, with the call below |
| Production | `docs/claims/sources.json` pins production to `origin/Deployments/release/261014_phase_3a` at `1aa4f28622cc3cc9637f0d61a438bf16bcf01924`, `confirmed: true`. After `git fetch` on 2026-10-20 it is still the newest `Deployments/release/*` branch (the next is `260921_*`), and at that SHA `site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts:55` still lists Target Profiles in the settings menu | holds |
| `/demo` menu | Checked in the IntelliDash source at the production SHA, read-only: the settings dialog's menu list (`sa-settings-dlg.component.ts:53-58`) is a fixed list with no Demo Mode condition, Target Profiles third of four (`:55`); the dialog's only Demo Mode guard is on Save (`:186-190`, the unsupported-feature message). In Demo Mode the profile and applied-profile loads return empty lists (`site/src/app/api/spatial-adjust/spatial-adjust-manager.service.ts:247-259`), so the tab opens on the five default slots, empty. Not opened in a live `/demo` session: that needs the owner's hand sign-in to the demo form and the local capture config, which this machine does not have (as for wave 1) | holds, by the source |
| Release status | `src/release.json` on `main` (commit 06196c6, updated 2026-10-20) records `target-profiles`, `creating-profiles`, `updating-profiles` and `seasonal-profiles` as `ga`, basis the menu entry at `sa-settings-dlg.component.ts:55` on production `1aa4f286` | GA: every build shows them, whatever `SA_SHOW_BETA` says |
| Live guides | The corrected guides are published: the live site carries the corrected Target Profiles text ("Five profile slots; an empty slot shows -- for Last Updated and Stations.") | live |
| Figures | The guide site's recreation draws the production table, five slots per Lynx course with the Target Profile, Last Updated, Stations, Update from Current and Apply Profile columns (`src/transform-app.mjs`, edit "target profiles: card list becomes the real five-column table"), not the earlier three-card design | matches production |

**The call.** The gate as planned asks for every claim of the four guides to be Verified; 5 are Needs expert. Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22: those 5 are questions for the experts, not a gate, so the wave opens. No wave 6 line narrates them and none is on screen as a label, with one exception: the template puts each step title on its chapter card (episode lint (b)), so episode 26's second chapter card reads APPLY THE EVENING BEFORE, as the live guide's step title does; its narration cites only Verified claims. If the experts change that step title, the chapter card is rebuilt with it.

**Footage.** Like wave 1, wave 6 is captured from the guide site's recreation, one lifted figure per chapter, because no Demo Mode session is available on this machine; no footage comes from a Target Profiles feature-branch build, and no Target Profiles write is clicked (hover and focus only).

**Episode 22's end card.** Push failures (episode 22) is produced in parallel by wave 5 on its own branch, where episodes 23-26 are still blocked, so its end card may carry the series-end line. Once the branches are merged, `npm run test:episodes -- push-failures` asks for "Next on Double Click: Apply a target profile" (check (d)), and the end card is rebuilt, re-verified and re-delivered as "When a blocked episode opens" in [`RUNBOOK.md`](RUNBOOK.md#procedure) says.

### Step rewrite coverage

Whether each guide renders the new step shape (a Do, a You-should-see and an If-not line on every step), read from the built site at `#/<key>`. No guide does yet on this branch. An episode's preflight (RUNBOOK.md, EP-0) re-checks its own guide, so a wave starts as soon as its guides are rewritten; until then an episode narrates the guide's current text and is flagged for a re-check when the rewrite lands.

| Wave | Guides | Rewritten |
|---|---|---|
| 1 Getting Started | 4 | 0 of 4 |
| 2 Review & Apply | 5 | 0 of 5 |
| 3 Station Management | 4 | 0 of 4 |
| 4 Calculations | 4 | 0 of 4 |
| 5 Troubleshooting | 5 | 0 of 5 |
| 6 Target Profiles | 4 | 0 of 4 |

### Voice-over credits

- **Method.** 26 scripts of 150 to 300 words, about 900 to 1,800 characters each at the Brian voice's measured 16.16 characters per spoken second (iCentral Double Click #1: 1,469 characters in 90.9 s; the pilot has no render report yet), so 55 to 110 s of narration per episode. Plus 30% for re-renders. Billed at 1 credit per character, the upper bound `video/vo/series-estimate.md` keeps; the one real render so far billed 0.44 credits per character (`video/vo/credits-log.md`).
- **Estimate.** 30,420 to 60,840 credits for the series at 1 credit per character (23,400 to 46,800 characters plus 30%); about 13,400 to 26,800 at the observed 0.44.
- **Balance.** 357,546 credits remaining on 2026-10-20, read with `npm run video -- estimate --live` (counts only; the key is resolved in process and never printed).
- **Verdict.** The balance covers the whole series about six times over at the upper bound. Not a constraint.

- **Wave 2 actual.** The five wave 2 renders billed 11,812 credits (29,529 before, 17,717 after, on an account other waves were drawing on at the same time), at the top of the 5,850 to 11,700 estimate. The balance quoted under Balance above was for a different reading of the account and is out of date: read it again with `npm run video -- estimate --live` before starting a wave.

### Time per episode

`series.json` records `startedAt` and `approvedAt` per episode. Any episode that takes more than half a day from start to approval gets a note here with its cause.

- **Wave 1 (episodes 01 to 04).** Started and approved on 2026-10-20.
- **Wave 2 (episodes 05 to 09).** Started 2026-10-20, approved 2026-10-21: about 7.8 hours of wall time for all five, which crossed midnight. The machine was saturated by other waves recording in parallel (load average 160 to 270), so each take ran at about 0.3 frames per second and took about 3.9 hours, against about 45 minutes idle; the 4K frame-stepped recorder costs about 1.5 CPU-seconds per frame, so the cost is in the capture, not the edit. Run waves one at a time, or set `SA_CAPTURE_X264_PRESET` to a faster x264 preset, when the machine is shared.

### Director refusal test

`node --test video/capture/refusal.test.mjs` is run before any capture. Wave 2: 15 of 15 passed before the first take (refuses entry without `/spatialadjust/demo` with exit 2, a reload after arming with exit 4, a declared push without a verified Demo Mode sign-in with exit 6, and stops a push in verified Demo Mode with exit 3). All five wave 2 episodes are `source: recreation` with empty `allowClicks` and `demoWriteClicks`, so no Push Changes send exists to declare on /demo.

## Series tracker

<!-- tracker:start -->
<!-- Generated from series.json by node scripts/episode-lint.mjs <url> --write-tracker. Edit series.json, not this block. -->

26 episodes: 26 approved.

| # | Wave | Key | Title | Status | Runtime | Started | Approved | Expert |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | `dashboard-overview` | Dashboard overview | approved | 2:34 | 2026-10-20 | 2026-10-20 | executor 2026-10-20; experts in person 2026-10-22 |
| 2 | 1 | `understand-spatial-adjust` | Understand Spatial Adjust | approved | 1:56 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 3 | 1 | `map-navigation` | Map navigation | approved | 2:06 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 4 | 1 | `understanding-vwc` | Understanding VWC | approved | 2:12 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 5 | 2 | `suggested-adjustments` | Understand suggested adjustments | approved | 2:17 | 2026-10-20 | 2026-10-21 | decided by executor 2026-10-21; experts in person 2026-10-22 |
| 6 | 2 | `filter-adjustments` | Filter by % Adj. | approved | 2:23 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 7 | 2 | `push-to-lynx` | Push changes to Lynx | approved | 2:34 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 8 | 2 | `reviewing-changes` | Reviewing changes | approved | 1:52 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 9 | 2 | `verify-results` | Verify results | approved | 2:09 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 10 | 3 | `editing-station-targets` | Editing station targets | approved | 1:49 | 2026-10-20 | 2026-10-20 | executor 2026-10-20; experts in person 2026-10-22 |
| 11 | 3 | `bulk-adjustments` | Apply a bulk adjustment | approved | 1:46 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 12 | 3 | `enable-disable-stations` | Enable and disable stations | approved | 2:07 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 13 | 3 | `station-details` | Station details | approved | 1:45 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 14 | 4 | `minimum-threshold` | Set a minimum threshold | approved | 2:14 | 2026-10-20 | 2026-10-20 | first of wave 4: decided by executor 2026-10-20; experts in person 2026-10-22 |
| 15 | 4 | `calculation-settings` | Calculation settings | approved | 2:43 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 16 | 4 | `calculation-methods` | Calculation methods | approved | 2:37 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 17 | 4 | `preferences` | Preferences | approved | 2:20 | 2026-10-20 | 2026-10-20 | spot-check in person 2026-10-22 |
| 18 | 5 | `station-zero` | Why is this station 0%? | approved | 2:26 | 2026-10-20 | 2026-10-21 | executor 2026-10-21; experts in person 2026-10-22 |
| 19 | 5 | `request-scan-data` | Get fresh scan data | approved | 2:17 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 20 | 5 | `threshold-questions` | Threshold questions | approved | 2:06 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 21 | 5 | `calculation-questions` | Calculation questions | approved | 2:01 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 22 | 5 | `push-failures` | Push failures | approved | 1:46 | 2026-10-20 | 2026-10-21 | spot-check in person 2026-10-22 |
| 23 | 6 | `target-profiles` | Apply a target profile | approved | 1:58 | 2026-10-20 | 2026-10-21 | executor 2026-10-21; experts in person 2026-10-22 |
| 24 | 6 | `creating-profiles` | Capturing profiles | approved | 1:50 | 2026-10-20 | 2026-10-21 | — |
| 25 | 6 | `updating-profiles` | Updating profiles | approved | 1:48 | 2026-10-20 | 2026-10-21 | — |
| 26 | 6 | `seasonal-profiles` | Managing seasonal profiles | approved | 1:47 | 2026-10-20 | 2026-10-21 | — |

**Credits per wave** (ElevenLabs credits; estimate from series.json, method under Voice-over credits above; before and after from the account, counts only)

| Wave | Name | Episodes | Estimate | Before | After | Used | Expert review |
|---|---|---|---|---|---|---|---|
| 1 | Getting Started | 4 | 4,680 to 9,360 | 357,437 | 355,147 | 2,290 | decided by executor 2026-10-20 (episode 01); experts in person 2026-10-22 |
| 2 | Review & Apply | 5 | 5,850 to 11,700 | 29,529 | 17,717 | 11,812 | decided by executor 2026-10-21 (episode 05); experts in person 2026-10-22 |
| 3 | Station Management | 4 | 4,680 to 9,360 | 29,529 | 17,717 | 11,812 | decided by executor 2026-10-20 (episode 10); experts in person 2026-10-22 |
| 4 | Calculations | 4 | 4,680 to 9,360 | 29,148 | 17,717 | 11,431 | decided by executor 2026-10-20 (episode 14); experts in person 2026-10-22 |
| 5 | Troubleshooting | 5 | 5,850 to 11,700 | 29,529 | 17,717 | 11,812 | decided by executor 2026-10-21 (episode 18); experts in person 2026-10-22 |
| 6 | Target Profiles | 4 | 4,680 to 9,360 | 29,529 | 17,717 | 11,812 | decided by executor 2026-10-21 (episode 23); experts in person 2026-10-22 |
<!-- tracker:end -->

## Series results

Close-out audit, run 2026-10-21 on the branch the series is built on, after wave 6. It reads the finished series; it changes no episode. Each success metric of the series request is listed with the value measured and where the measurement came from. Counts only: the key scan and the attribution scan print numbers, never matches.

**Outcome: 26 of 26 episodes approved and delivered. Six of the seven metrics are met as written (the time metric on wall-clock, with the caveat given); the seventh, expert sign-off, is recorded as an executor decision with the in-person review on 2026-10-22.**

| Metric | Measured | Source |
|---|---|---|
| Delivered and approved: waves 1 to 5 (22 episodes), and the four Target Profiles episodes delivered or recorded as blocked with the reason | **26 of 26 approved** (waves 1 to 5: 22 of 22; wave 6: 4 of 4). Wave 6 opened on 2026-10-20 and is delivered; the gate re-check below holds | `series.json`, tracker above |
| Every narrated and on-screen claim maps to a Verified claim | **966 claim citations across the 26 episodes (496 distinct claims), 0 not Verified**; episode lint check (e) 0 findings. The ledger holds 843 Verified and 28 Needs expert claims; no episode cites a Needs expert claim | `docs/claims/claims.json`; `npm run test:episodes -- --series` |
| Every episode passes `video/verify/verify.py`: format, -14 LUFS plus or minus 0.5, true peak at or below -1 dBTP, 0 denylist OCR hits; loudness spread at most 1 LU | **26 of 26 final verify reports pass; 26 OCR reports, 0 denylist hits. Integrated loudness -14.1 LUFS in every episode (spread 0.00 LU); true peak -1.1 to -1.8 dBTP.** Re-measured on the delivered MP4s with `ffmpeg -af ebur128=peak=true`: -14.1 LUFS each, the same peaks as `series.json` | `<media root>/episodes/<key>/renders/verify-report.json`, `ocr-report.json`; series lint |
| Every episode runs 1 to 3 minutes and has English captions, a transcript and a poster | **Runtimes 1:45 to 2:43 (104.6 to 162.5 s), all inside 60 to 180 s** (ffprobe on the delivered MP4s agrees with `series.json` to the frame). **26 of 26 `deliver/` folders hold exactly four files: MP4, English VTT, transcript and poster** | count-only check of each `deliver/` folder |
| Chapter labels match the guide's step titles exactly | **0 findings across 26 episodes** (episode lint check (b), read against the guide as it renders). The lint's own fixtures also pass: the good fixture passes, the bad-label and unverified-claim fixtures each fail once, the series fixture fails twice | `npm run test:episodes -- --series`, `-- --fixtures` |
| From wave 2 on, each episode takes 0.5 day or less from script to approved cut | **Met on wall-clock: 5.4 to 8.3 h from first voice-over render to the passing final verify, against 12 h** (table below). Not met as effort: waves 2 to 6 ran side by side on one saturated machine, so each figure is elapsed time, not working time. See the note under Per-episode times | `<media root>` file times, verify reports |
| The expert team signs off the first episode of each wave | **Not met as written; recorded as a decision.** The six first-of-wave episodes (01, 05, 10, 14, 18, 23) each carry an `expert sign-off` row in `video/approvals.md`, "decided by executor" under the owner direction of 2026-10-19; the experts review all 26 in person on 2026-10-22 | `video/approvals.md`, `series.json` `waves[].expertSignoff` |

### Series audit checks

All run in this worktree on 2026-10-21 against a fresh `node build.mjs` served on its own port.

| Check | Result |
|---|---|
| `npm run test:episodes -- --series` (the script against a build of this branch; the npm script's own URL, `http://localhost:8124/`, may be serving a different checkout) | 26 approved episodes checked, **0 findings**; loudness spread **0.00 LU** (limit 1); runtimes 104.6 to 162.5 s (limit 60 to 180); every VO render report used the series voice id, model and settings |
| `node scripts/episode-lint.mjs <url> --fixtures` | ok |
| `node --test video/capture/refusal.test.mjs` | 15 of 15 pass |
| Deliverables | 26 of 26 episodes have an MP4, a VTT, a transcript and a poster; 0 episodes missing a file |
| Media files tracked in git, now or in history | **0** (`npm run video -- hygiene`, media check; `git ls-files` count 0; 0 media or poster files added by this epic's commits) |
| ElevenLabs key pattern | **0 matches** in tracked files, in history and in commit messages (`npm run video -- hygiene`, key check; 0 matches of an `sk_` token pattern in the 43 commits' diffs) |
| Claude attribution lines in this epic's commits | **0** across the 43 commits on this branch that are not on `e200-video-pipeline` or `origin/main` |
| Internal tracker IDs in tracked text files | 0 |
| Denylist (a real name the hygiene check keeps out of the public repository) | **Not clean, and not from this epic.** 26 findings, all one denylist entry (#12), in two files (`src/transform-export.mjs`, `docs/text-corrections.md`), all from two commits already on `origin/main` (3b82d24, 2026-09-07, and 99e060a, 2026-10-19) and from the merge commits that carry them. This epic's own commits add 0. The tracked files carry no hit now. Left for the owner: the entry is in public history, so removing it means a history rewrite, which is outside this epic |

### Wave 6 gate re-check

**2026-10-21: open (A), unchanged since 2026-10-20, and wave 6 is delivered.** Condition A (Target Profiles ships in production, its claims are Verified, and it is reachable in `/demo`) still holds:

- Claims for the four guides: 106 Verified, 5 Needs expert, 0 Wrong, 0 Not shipping, 0 Unverified (`docs/claims/guides/`). The 5 are the operational judgements already on the review agenda; no episode cites them.
- Production pin: `docs/claims/sources.json` still names `origin/Deployments/release/261014_phase_3a` at `1aa4f286`. After `git fetch` on 2026-10-21 it is still the newest `Deployments/release/*` branch, and at that commit the settings dialog's menu list still includes Target Profiles (`sa-settings-dlg.component.ts:55`, read-only).
- Release status on `origin/main`: `target-profiles`, `creating-profiles`, `updating-profiles` and `seasonal-profiles` are all `ga`.

Condition B (a coming-soon treatment) is retired: 0 episodes carry `treatment: coming-soon` and 0 Not shipping claims exist. The four episodes (23 to 26) are approved.

### Credits per wave

The tracker above holds the per-wave readings. Two things to know when reading them:

- The account changed plan between wave 1 and wave 2 (357,437 credits before wave 1; 29,529 before wave 2), so the balances do not run on from one wave to the next.
- Waves 2 to 6 rendered at the same time on one shared account, so their readings overlap: waves 2, 3, 5 and 6 each read 29,529 before and 17,717 after, and wave 4 read 29,148 before. The combined spend of waves 2 to 6 is therefore about 11,812 credits (29,529 to 17,717), not that figure per wave.

**Series total: about 14,100 credits** (2,290 for wave 1 plus about 11,812 for waves 2 to 6). That is inside the 13,400 to 26,800 credits the observed 0.44 credits per character predicts, and under the 30,420 to 60,840 upper-bound estimate at 1 credit per character. 17,717 credits remained after wave 6.

### Per-episode times

Elapsed time from the first voice-over render file to the passing final verify report, read from the media root's file times and the verify reports' `generated` stamps. Wave 1 (episodes 01 to 04) ran 2026-10-20 in about 5.1 h each; the tracker's `startedAt` and `approvedAt` hold dates only. Waves 2 to 6:

| Wave | Episodes | Shortest | Longest |
|---|---|---|---|
| 2 | 5 | 7.4 h | 7.5 h |
| 3 | 4 | 5.5 h | 7.1 h |
| 4 | 4 | 7.2 h | 8.2 h |
| 5 | 5 | 7.3 h | 8.3 h |
| 6 | 4 | 7.4 h | 7.7 h |

Overall for waves 2 to 6: 5.5 to 8.3 h. Every episode is under half a day, but the figures overlap: five waves captured and rendered in parallel on one machine whose load average ran at 160 to 270, and the 4K frame-stepped recorder costs about 1.5 CPU-seconds per frame, so most of each episode's elapsed time is waiting on a shared machine. Run alone, an episode took about 45 minutes of capture (see Time per episode above). No wave 2 to 6 episode took more than half a day, so none needs a cause note beyond this one.

| # | Wave | Key | First VO render | Final verify | Elapsed |
|---|---|---|---|---|---|
| 5 | 2 | `suggested-adjustments` | 10-20 19:53 | 10-21 03:22 | 7.5 h |
| 6 | 2 | `filter-adjustments` | 10-20 19:55 | 10-21 03:22 | 7.5 h |
| 7 | 2 | `push-to-lynx` | 10-20 19:55 | 10-21 03:22 | 7.4 h |
| 8 | 2 | `reviewing-changes` | 10-20 19:56 | 10-21 03:21 | 7.4 h |
| 9 | 2 | `verify-results` | 10-20 19:57 | 10-21 03:21 | 7.4 h |
| 10 | 3 | `editing-station-targets` | 10-20 19:50 | 10-21 01:21 | 5.5 h |
| 11 | 3 | `bulk-adjustments` | 10-20 20:06 | 10-21 03:04 | 7.0 h |
| 12 | 3 | `enable-disable-stations` | 10-20 20:06 | 10-21 03:11 | 7.1 h |
| 13 | 3 | `station-details` | 10-20 20:07 | 10-21 02:53 | 6.8 h |
| 14 | 4 | `minimum-threshold` | 10-20 19:53 | 10-21 03:07 | 7.2 h |
| 15 | 4 | `calculation-settings` | 10-20 19:54 | 10-21 03:35 | 7.7 h |
| 16 | 4 | `calculation-methods` | 10-20 19:54 | 10-21 03:59 | 8.1 h |
| 17 | 4 | `preferences` | 10-20 19:55 | 10-21 04:08 | 8.2 h |
| 18 | 5 | `station-zero` | 10-20 19:52 | 10-21 03:45 | 7.9 h |
| 19 | 5 | `request-scan-data` | 10-20 19:53 | 10-21 03:12 | 7.3 h |
| 20 | 5 | `threshold-questions` | 10-20 19:54 | 10-21 03:16 | 7.4 h |
| 21 | 5 | `calculation-questions` | 10-20 19:52 | 10-21 03:21 | 7.5 h |
| 22 | 5 | `push-failures` | 10-20 20:00 | 10-21 04:19 | 8.3 h |
| 23 | 6 | `target-profiles` | 10-20 19:51 | 10-21 03:18 | 7.4 h |
| 24 | 6 | `creating-profiles` | 10-20 19:52 | 10-21 03:36 | 7.7 h |
| 25 | 6 | `updating-profiles` | 10-20 19:54 | 10-21 03:37 | 7.7 h |
| 26 | 6 | `seasonal-profiles` | 10-20 19:56 | 10-21 03:39 | 7.7 h |

### Expert sign-offs

No sign-off waited on a human. Under the owner direction of 2026-10-19 each first-of-wave sign-off is a recorded executor decision, listed on `docs/review-agenda.md` with the question to put to the experts, and every episode in the other positions is a spot-check in person on 2026-10-22:

| Wave | First episode | Recorded |
|---|---|---|
| 1 Getting Started | 01 `dashboard-overview` | decided by executor 2026-10-20 |
| 2 Review & Apply | 05 `suggested-adjustments` | decided by executor 2026-10-21 |
| 3 Station Management | 10 `editing-station-targets` | decided by executor 2026-10-20 |
| 4 Calculations | 14 `minimum-threshold` | decided by executor 2026-10-20 |
| 5 Troubleshooting | 18 `station-zero` | decided by executor 2026-10-21 |
| 6 Target Profiles | 23 `target-profiles` | decided by executor 2026-10-21 |

### Handoff: embedding the episodes on the site

Everything the site embed work needs, by path. This series lists where each deliverable lives; it does not publish, copy or commit any media. Paths are relative to the media root (`~/Documents/SpatialAdjust_MarCom`, or `SA_MEDIA_ROOT`). Every episode's four deliverables follow one naming rule, `episodes/<key>/deliver/<key>.mp4`, `<key>.en.vtt`, `<key>.transcript.txt` and `<key>.poster.jpg`.

- **Where each episode goes.** One episode per guide: the guide at `#/<key>` on the site embeds the episode with the same key (`series.json` `siteBase`, then the route). `series.json` is the source for order, title and runtime.
- **Captions.** English only, WebVTT, cue timing from the final render. The localised captions are the site work's to produce. The English VTT and the transcript are the source text; the 11 site locales are not translated yet for this series.
- **Poster.** A JPEG frame per episode, 1920 by 1080. **Video:** H.264 High, 1920 by 1080, 60 fps, AAC 48 kHz stereo, -14.1 LUFS.
- **Not for the site.** Everything else under `episodes/<key>/` (`capture/`, `vo/`, `renders/`, `edit/`, `gfx/`, `frames/`) is working material; only `deliver/` is handed over. `dashboard-overview-pilot/` is the 20 to 30 s template pilot: it has no `deliver/` folder, is not one of the 26 episodes and is not for the site. Embed episode 01, `dashboard-overview`.
- **Open items for the embed work.** Each episode's narration follows its guide as it was on 2026-10-20; if an expert changes a step title at the in-person review, the chapter card is rebuilt and a new `final` row added in `video/approvals.md`, so re-read `approvals.md` for the latest SHA-256 per episode before publishing. The music licence question is on the review agenda.

| # | Key | Guide route | Deliverables folder | Runtime |
|---|---|---|---|---|
| 1 | `dashboard-overview` | `#/dashboard-overview` | `episodes/dashboard-overview/deliver/` | 2:34 |
| 2 | `understand-spatial-adjust` | `#/understand-spatial-adjust` | `episodes/understand-spatial-adjust/deliver/` | 1:56 |
| 3 | `map-navigation` | `#/map-navigation` | `episodes/map-navigation/deliver/` | 2:06 |
| 4 | `understanding-vwc` | `#/understanding-vwc` | `episodes/understanding-vwc/deliver/` | 2:12 |
| 5 | `suggested-adjustments` | `#/suggested-adjustments` | `episodes/suggested-adjustments/deliver/` | 2:17 |
| 6 | `filter-adjustments` | `#/filter-adjustments` | `episodes/filter-adjustments/deliver/` | 2:23 |
| 7 | `push-to-lynx` | `#/push-to-lynx` | `episodes/push-to-lynx/deliver/` | 2:34 |
| 8 | `reviewing-changes` | `#/reviewing-changes` | `episodes/reviewing-changes/deliver/` | 1:52 |
| 9 | `verify-results` | `#/verify-results` | `episodes/verify-results/deliver/` | 2:09 |
| 10 | `editing-station-targets` | `#/editing-station-targets` | `episodes/editing-station-targets/deliver/` | 1:49 |
| 11 | `bulk-adjustments` | `#/bulk-adjustments` | `episodes/bulk-adjustments/deliver/` | 1:46 |
| 12 | `enable-disable-stations` | `#/enable-disable-stations` | `episodes/enable-disable-stations/deliver/` | 2:07 |
| 13 | `station-details` | `#/station-details` | `episodes/station-details/deliver/` | 1:45 |
| 14 | `minimum-threshold` | `#/minimum-threshold` | `episodes/minimum-threshold/deliver/` | 2:14 |
| 15 | `calculation-settings` | `#/calculation-settings` | `episodes/calculation-settings/deliver/` | 2:42 |
| 16 | `calculation-methods` | `#/calculation-methods` | `episodes/calculation-methods/deliver/` | 2:37 |
| 17 | `preferences` | `#/preferences` | `episodes/preferences/deliver/` | 2:20 |
| 18 | `station-zero` | `#/station-zero` | `episodes/station-zero/deliver/` | 2:26 |
| 19 | `request-scan-data` | `#/request-scan-data` | `episodes/request-scan-data/deliver/` | 2:17 |
| 20 | `threshold-questions` | `#/threshold-questions` | `episodes/threshold-questions/deliver/` | 2:06 |
| 21 | `calculation-questions` | `#/calculation-questions` | `episodes/calculation-questions/deliver/` | 2:01 |
| 22 | `push-failures` | `#/push-failures` | `episodes/push-failures/deliver/` | 1:46 |
| 23 | `target-profiles` | `#/target-profiles` | `episodes/target-profiles/deliver/` | 1:58 |
| 24 | `creating-profiles` | `#/creating-profiles` | `episodes/creating-profiles/deliver/` | 1:50 |
| 25 | `updating-profiles` | `#/updating-profiles` | `episodes/updating-profiles/deliver/` | 1:48 |
| 26 | `seasonal-profiles` | `#/seasonal-profiles` | `episodes/seasonal-profiles/deliver/` | 1:47 |

## Episode format

Validate an episode before anything reads it:

```bash
node video/lib/episode-schema.mjs video/episodes/<id>/episode.json
```

It prints `ok` and exits 0, or lists every problem, naming the beat or action at fault, and exits 1. In code, `parseEpisode(path)` returns the parsed episode or throws an `EpisodeError` with the same list.

## Top-level fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string, `^[a-z0-9-]+$` | yes | Episode id. Names the folder here and the folder under the media root. |
| `title` | non-empty string | yes | The title card text. |
| `guide` | guide slug, `^[a-z0-9-]+$` | yes | The guide the episode belongs to, as keyed in `GUIDES` in `Learn Spatial Adjust.dc.html` (for example `dashboard-overview`). |
| `status` | `draft` \| `script-locked` \| `captured` \| `edited` \| `verified` \| `approved` | yes | Where the episode is in the pipeline, in that order. `script-locked` and every later status require claims (see the rules below). |
| `durationTarget` | `[min, max]`, seconds, both positive | yes | Target running time. The minimum may not exceed the maximum. |
| `source` | `demo` \| `recreation` | yes | `demo`: captured from IntelliDash `/demo`. `recreation`: rebuilt from the guide mockups, with no live product involved. |
| `mapPolicy` | `blur` \| `restyle` \| `owned-imagery` \| `frame-out` | yes | How the course map imagery is kept fictional: blurred, restyled, replaced with imagery we own, or kept out of frame. Never a real customer course. |
| `recreationPath` | path, for example `/#/dashboard-overview` | no | For `source: recreation` only: the page of the local guide site the take loads (default `/`). |
| `recreationFigure` | string | no | For `source: recreation` only: the start of one figure caption on that page. The capture director lifts that SpatialAdjustApp figure out of the page to fill the frame unscaled, so no guide prose is in shot, and marks it `data-sa-frame`; scope every target to it (`[data-sa-frame] >> text="0-5%"`), because the page draws the app several times. The director refuses it on a `demo` episode (exit 65). |
| `allowClicks` | string[] | no, default `[]` | Accessible names of the read-only controls a click action may press. Empty unless a specific read-only click has been decided and recorded in [`../approvals.md`](../approvals.md). An entry that matches the write guard is an error. |
| `demoWriteClicks` | `[{ name, target, reason }]` | no, default `[]` | Write-like clicks the episode deliberately shows, each with the reason. Clicked only when `source` is `demo`, where Demo Mode blocks the write. A `recreation` episode may also declare a write it shows without performing it, when the entry's `outcome` is `recreation`; no `click` action may press it. The pilot declares none. |
| `claims` | string[] of claim ids | no, default `[]` | Every claim from the claims ledger (`docs/claims/claims.json`) that the narration relies on. Ids look like `<guide>/<step>/<n>`, for example `dashboard-overview/2/2`. `parseEpisode` checks each id exists in the ledger. |
| `chapters` | `[Chapter]` | no, default `[]` | Chapter markers, in order. |
| `vo` | `[VoLine]` | no, default `[]` | Voice-over lines, in order. |
| `beats` | `[Beat]` | no, default `[]` | What happens on screen, in order. |

Unknown fields are kept, at every level. A later episode can add a field without breaking the ones before it; the schema only rejects what it knows to be wrong.

## Chapter

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | non-empty string | yes | Referenced by `beat.chapter`. Unique within the episode. |
| `label` | non-empty string | yes | The chapter name shown on screen and in the captions file. |

## VoLine

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | non-empty string | yes | Referenced by `beat.vo`, and by convention by the `cue` action that starts the line. Unique within the episode. |
| `text` | non-empty string | yes | Exactly what the Brian voice says. |
| `previous_text` | string | no | Text sent to ElevenLabs as context before the line, so the delivery joins up with what came before. Not spoken. |
| `next_text` | string | no | Text sent as context after the line. Not spoken. |
| `claims` | string[] of claim ids | no; yes once the script is locked | The claims that back this line. Each must also be listed in the episode's `claims`. |

## Beat

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | non-empty string | yes | Names the beat in every error message. Unique within the episode. |
| `chapter` | chapter id | no | The chapter the beat belongs to. Must exist in `chapters`. |
| `label` | non-empty string | no | On-screen label for the beat. Its word count sets the minimum hold. |
| `vo` | VO line id | no | The VO line spoken over the beat. Must exist in `vo`. |
| `hold` | seconds, 0 or more | yes | How long the beat stays on screen. |
| `highlight` | target | no | A target the highlight box is drawn around for the whole beat (the same box a `focus` action draws). |
| `actions` | `[Action]` | no, default `[]` | What the capture director does during the beat, in order. |
| `cutAfter` | seconds | no | Read by the builder, not the schema: the beat's chapter ends this many seconds after the beat's VO line has finished (or after its first cue when it has no VO line), instead of at the next chapter's cut. Use it to leave a page before the take moves on (dc_build.py's per-chapter end override). |

## Action

Every action has a `type`; the other fields depend on it. A `target` is a Playwright selector (for example `role=region[name="Map"]`) that the capture director resolves; `name` is the control's accessible name, which the write guard checks.

| `type` | Fields | What it does |
|---|---|---|
| `wait` | `ms` (integer, 0 or more) | Waits. |
| `cue` | `id` | Marks this moment in the take's cue log; the builder lines up timeline events, such as the start of a VO line, against cue ids. Cue ids are unique within the episode. |
| `hover` | `target`, `name` | Moves the pointer over the target. |
| `scroll` | `target`, `dy` (pixels, negative scrolls up) | Scrolls the target. |
| `focus` | `target`, `name` | Draws the highlight box around the target. Never clicks. |
| `click` | `target`, `name` | Clicks the target. Allowed only for a name listed in `allowClicks`, or for a write-like click declared in `demoWriteClicks` on a `demo` episode. |

## How the builder reads an episode

`npm run video -- build --episode <episode.json> --take <N> --draft` (`video/edit/build.py`) turns the episode, take `N` and the VO render report into the timeline. It relies on these conventions:

- **Every VO line starts at its own cue.** A line spoken over footage needs a `cue` action whose `id` is the line's id, in the beat that speaks it; the builder places the line at that cue's time in the take, so picture and voice stay in sync whatever the take's timing. A line whose beat comes before the first chapter's beats is spoken over the title card; one whose beat comes after the last chapter's beats, over the end card.
- **Every chapter cuts on its first cue.** A chapter's footage runs from 0.55 s before the first cue in its beats to the next chapter's cut (the last chapter: to the take's end flash), so each chapter needs at least one beat with a cue, and chapters must be in take order. `cutAfter` on a beat ends a chapter earlier.
- **Chapters are shown in order,** each as a typed chapter card with its `label`, then its footage, with the chapter strip naming every chapter. Beat labels are not drawn by the builder; they set holds for the capture.
- **The title card shows `title`**, and the title card, chapter cards and end card enforce the hold rule: a card too short for its words fails the build, naming the text.

## Rules the schema enforces

On top of the field types above, an episode is rejected when:

- **A reference dangles.** Every `beat.vo` names a VO line and every `beat.chapter` names a chapter. Beat, VO line, chapter and cue ids are each unique.
- **A click is not allowed.** A click whose name is not in `allowClicks` is rejected.
- **A click looks like a write.** A click whose `name` or `target` matches the write guard `WRITES` (`scripts/lib/writes.mjs`, shared with the fidelity harvest: save, apply, push, confirm, delete, remove, send, submit, discard, reset, update from) is rejected unless the same `name` and `target` are declared in `demoWriteClicks` and `source` is `demo`. `allowClicks` may not list a write-like name at all. On a live course, Push Changes sends adjustments to Lynx; capture happens only in IntelliDash `/demo`, where Demo Mode blocks writes, and this rule stops a write-like click long before a browser is involved.
- **A label is not on screen long enough to read.** A beat with a `label` must hold for at least 1.5 s plus 0.3 s per word of the label (the motion-system hold rule): a three-word label needs 2.4 s.
- **Narration is not backed by claims.** From `script-locked` on, `claims` must be non-empty and every VO line must cite at least one claim. A VO line may cite only claims the episode lists, and `parseEpisode` rejects a claim id that is not in the claims ledger.
- **The duration target is inverted.** The `durationTarget` minimum is above the maximum.

## Example

A complete episode that `parseEpisode` accepts (the schema tests parse this block):

```json
{
  "id": "example-read-the-map",
  "title": "Dashboard overview",
  "guide": "dashboard-overview",
  "status": "script-locked",
  "durationTarget": [20, 30],
  "source": "demo",
  "mapPolicy": "blur",
  "allowClicks": [],
  "demoWriteClicks": [],
  "claims": [
    "dashboard-overview/2/1",
    "dashboard-overview/2/2",
    "dashboard-overview/5/3"
  ],
  "chapters": [
    { "id": "map", "label": "Read the map" },
    { "id": "counts", "label": "Check the counts" }
  ],
  "vo": [
    {
      "id": "vo-map",
      "text": "Every station is a pin, coloured by its latest measured moisture.",
      "next_text": "Push Changes counts the stations you have edited.",
      "claims": ["dashboard-overview/2/1", "dashboard-overview/2/2"]
    },
    {
      "id": "vo-counts",
      "text": "Push Changes counts the stations you have edited.",
      "previous_text": "Every station is a pin, coloured by its latest measured moisture.",
      "claims": ["dashboard-overview/5/3"]
    }
  ],
  "beats": [
    {
      "id": "title",
      "label": "Dashboard overview",
      "hold": 3.5,
      "actions": [{ "type": "wait", "ms": 500 }]
    },
    {
      "id": "map",
      "chapter": "map",
      "label": "Read the map",
      "vo": "vo-map",
      "hold": 7,
      "highlight": "role=region[name=\"Map\"]",
      "actions": [
        { "type": "cue", "id": "vo-map" },
        { "type": "hover", "target": "role=img[name=\"Station 3AP1\"]", "name": "Station 3AP1" },
        { "type": "focus", "target": "role=region[name=\"Moisture legend\"]", "name": "Moisture legend" },
        { "type": "wait", "ms": 1500 }
      ]
    },
    {
      "id": "counts",
      "chapter": "counts",
      "label": "Check the counts",
      "vo": "vo-counts",
      "hold": 6,
      "actions": [
        { "type": "cue", "id": "vo-counts" },
        { "type": "scroll", "target": "role=table", "dy": 240 },
        { "type": "focus", "target": "role=button[name=\"Push Changes\"]", "name": "Push Changes" }
      ]
    }
  ]
}
```

The last beat only draws the highlight box around Push Changes. A `click` on it would be rejected: the name matches the write guard and the episode declares no demo-mode clicks.

## Adding an episode

A Double Click series episode follows [`RUNBOOK.md`](RUNBOOK.md), EP-0 to EP-10, which starts from `node scripts/episode-scaffold.mjs <key>`. The steps below are the pipeline's minimum for any episode.

1. Create `video/episodes/<id>/` with `script.md` and `episode.json`, status `draft`.
2. Back every VO sentence with a claim id from `docs/claims/claims.json`; a sentence without a claim does not go in.
3. Validate with `node video/lib/episode-schema.mjs`, set `status` to `script-locked`, and record the script lock in [`../approvals.md`](../approvals.md).
4. Advance `status` as the episode moves through capture, edit, verify and approval.
