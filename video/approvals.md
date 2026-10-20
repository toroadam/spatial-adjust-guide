# Approvals: Spatial Adjust video pipeline

**Epic:** PI-ICNT-SW-E200 · **ER:** ER-1618 · **Approver:** Adam Munir (owner)
**Media root:** `~/Documents/SpatialAdjust_MarCom/` (local only, never in git)

## Owner direction, 2026-10-19: no pre-publication gates

On 2026-10-19 the owner removed every pre-publication review and approval gate: "There's no gates to review them right now." Everything planned is built and made ready to deploy, and the owner and the experts review it in person on Thursday 2026-10-22, walking the live guides site (https://toroadam.github.io/spatial-adjust-guide/) page by page. Until then:

- Nothing waits for a human. The executor of the feature that reaches a gate makes the call with the defaults below, records it in that gate's row, and carries on.
- An executor's call is recorded with **Decision** `decided by executor`, **Approver** `executor`, and **Quote / notes** starting "Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22", followed by what was decided. It is never recorded as `approved`.
- Every such call is also appended to [`docs/review-agenda.md`](../docs/review-agenda.md): what was decided, where it shows, and the question for the experts.
- What the owner decides in person on 2026-10-22 is recorded as a new row for the same gate, in the owner's words.

Defaults for the calls (a list, not a table, so the only `| G<n> |` rows in this file are the gate rows below):

- G1: a neutral fictional course name and identity that does not appear anywhere in the iCentral MarCom material.
- G2: fictional or Demo Mode map imagery only, never a real customer course.
- G3: the Spatial Adjust brand, as the plan describes.
- G4: the live guides site URL, https://toroadam.github.io/spatial-adjust-guide/.
- G5: the music bed the iCentral MarCom Double Click series uses, with its source path recorded; the licence question goes on the review agenda.
- G6: locked by the executor once the script passes the episode schema and every VO line cites a claim from the claims ledger.
- G7: accepted by the executor once verify, OCR and hygiene pass.

Beta content is shown (`SA_SHOW_BETA` unset means show).

## Rules

- Only the owner, Adam Munir, approves a gate. Until the in-person review, an executor decides under the owner direction above and records `decided by executor`; nobody records `approved` on the owner's behalf.
- **Decision** is one of `pending`, `decided by executor`, `approved`, `changes requested` or `rejected`. Every gate starts as `pending`, which means the feature that owns the gate has not reached it yet.
- **Quote / notes** holds the owner's own words, quoted exactly as given, with where they were given (chat, ticket, review), or for an executor's call the sentence above and what was decided.
- **Version** names the exact artifact the decision covers (file and commit, or render file name), so a later change to the artifact reopens the gate.
- Never pre-fill a row. Record a decision only when the feature that owns the gate makes it.
- Recording a decision fills in the gate's `pending` row. After that the row is never edited: a changed decision, or a decision on a new version, is a new row for the same gate with its own date.
- Downstream steps check this file for a recorded decision (`decided by executor` or `approved`): drafts need G3, finals also need G4 and G5, capture needs G1, G2, G3 and G6. A `pending` gate is decided by the step that needs it, not waited on.

## Gates

| Gate | Artifact | Version | Decision | Date | Approver | Quote / notes |
|---|---|---|---|---|---|---|
| G1 | Fictional course identity: name and identity in `video/brand/course.json` (PI-ICNT-SW-1079-1) | `video/brand/course-proposal.md` v1 (commit 7e82f92) | decided by executor | 2026-10-19 | executor | Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22. Riverbend National, the fictional course the guides already show, with the identity in the proposal: short name Riverbend, course id prefix `riverbend`, location Marrowby Valley, United States (invented), 18 holes by number, stations `<hole>AP<n>`, superintendent Morgan Ellery, first names Morgan, Harper, Reese, Emery, Jules, Hollis, Sloane and Kendall, customer number `RVB-000742`. Checked 2026-10-19: no real course of that full name (Bing, OpenStreetMap), not in the iCentral MarCom material, no match in the local name maps. Owner's direction (chat, 2026-10-19): "There's no gates to review them right now." |
| G2 | Map approach: blur, restyle, owned imagery or frame-out (proposed in PI-ICNT-SW-1079-1; treated still re-shown in PI-ICNT-SW-1079-4) | `video/brand/course-proposal.md` v1 (commit 7e82f92), section "G2: map approach" | decided by executor | 2026-10-19 | executor | Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22. Restyle: every satellite and street tile is replaced, for GET requests only, by a generated tile in the guides' map palette, so no Google or OpenStreetMap imagery and no real place appears in any frame; restyle is the default `mapPolicy`, and blur and frame-out stay available per episode. Owner's direction (chat, 2026-10-19): "There's no gates to review them right now." |
| G2 | Map treatment still: `map-treatment-v1.png` (media root, `episodes/_stills/`), rendered by `video/capture/map-still.mjs` from the test page `video/capture/fixtures/map-page.html` (PI-ICNT-SW-1079-4) | v1, commit 748e1b8, sha256 `fd67751c1475374eb8671c4c5f41bae9bb1f0420da2a0d62fc6ecdda505bda6c` | decided by executor | 2026-10-19 | executor | Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22. The restyle treatment as rendered: every map tile replaced by a turf-green tile with diagonal mowing stripes (96 of 96 tiles answered by the route, none passed on), the OpenStreetMap and Google attribution hidden, station circles in the moisture band colours and labels sharp. Comparison stills `map-treatment-blur-v1.png` and `map-treatment-frame-out-v1.png` sit beside it. The treatment is seen again on real Demo Mode footage at G6 and G7. Owner's direction (chat, 2026-10-19): "There's no gates to review them right now." |
| G3 | Style frame (PI-ICNT-SW-1081-4) | — | pending | — | — | — |
| G4 | End-card URL (PI-ICNT-SW-1081-3) | `video/brand/end-card-options.md` v1 (commit 0f76bc8), carried by `video/brand/end-card.json` | decided by executor | 2026-10-19 | executor | Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22. Option (a), the guides site, https://toroadam.github.io/spatial-adjust-guide/, shown on the end card as `toroadam.github.io/spatial-adjust-guide` in the URL pill under the call to action "Explore the Spatial Adjust Guides". Options (b), a toro.com product page (no address confirmed), and (c), no URL with the lockup only, are set out in the options file with audience, stability and visibility. The address changes when the site moves to Azure behind Toro SSO; the URL is data in `end-card.json`, so episodes re-render with the new one. Owner's direction (chat, 2026-10-19): "There's no gates to review them right now." |
| G5 | Music licence: licensed track and licence reference in `video/brand/music.json` (PI-ICNT-SW-1083-3) | — | pending | — | — | — |
| G6 | Pilot script lock: `video/episodes/dashboard-overview-pilot/script.md` and `episode.json` (PI-ICNT-SW-1084-1) | — | pending | — | — | — |
| G7 | Pilot final render (PI-ICNT-SW-1084-5) | — | pending | — | — | — |
