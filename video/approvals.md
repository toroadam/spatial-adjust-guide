# Approvals: Spatial Adjust video pipeline

**Epic:** PI-ICNT-SW-E200 · **ER:** ER-1618 · **Approver:** Adam Munir (owner)
**Media root:** `~/Documents/SpatialAdjust_MarCom/` (local only, never in git)

## Rules

- Only the owner, Adam Munir, approves a gate. An agent, a script or a reviewer never does, and nobody approves on the owner's behalf.
- **Decision** is one of `pending`, `approved`, `changes requested` or `rejected`. Every gate starts as `pending`.
- **Quote / notes** holds the owner's own words, quoted exactly as given, with where they were given (chat, ticket, review). A row without the owner's words is not approved, whatever its Decision column says.
- **Version** names the exact artifact that was shown (file and commit, or render file name), so a later change to the artifact reopens the gate.
- Never pre-fill a row. Prepare the artifact, present it, stop, and record the decision only after the owner has replied.
- Recording a decision fills in the gate's `pending` row. After that the row is never edited: a changed decision, or a decision on a new version, is a new row for the same gate with its own date.
- Downstream steps check this file: drafts need G3, finals also need G4 and G5, capture needs G1, G2, G3 and G6.

## Gates

| Gate | Artifact | Version | Decision | Date | Approver | Quote / notes |
|---|---|---|---|---|---|---|
| G1 | Fictional course identity: name and identity in `video/brand/course.json` (PI-ICNT-SW-1079-1) | — | pending | — | — | — |
| G2 | Map approach: blur, restyle, owned imagery or frame-out (proposed in PI-ICNT-SW-1079-1; treated still re-shown in PI-ICNT-SW-1079-4) | — | pending | — | — | — |
| G3 | Style frame (PI-ICNT-SW-1081-4) | — | pending | — | — | — |
| G4 | End-card URL (PI-ICNT-SW-1081-3) | — | pending | — | — | — |
| G5 | Music licence: licensed track and licence reference in `video/brand/music.json` (PI-ICNT-SW-1083-3) | — | pending | — | — | — |
| G6 | Pilot script lock: `video/episodes/dashboard-overview-pilot/script.md` and `episode.json` (PI-ICNT-SW-1084-1) | — | pending | — | — | — |
| G7 | Pilot final render (PI-ICNT-SW-1084-5) | — | pending | — | — | — |
