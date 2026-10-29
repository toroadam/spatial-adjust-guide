# In-person review feedback, 2026-10-22: triage

Source: the recording transcript of the walkthrough (kept outside the repo; it names people and a customer). Four reviewers, 52 minutes. They watched the showcase and seven episodes: dashboard overview, understand Spatial Adjust, map navigation (read the pins), understanding VWC, editing station targets, bulk adjustments, target profiles, creating profiles. Reviewers are not named here on purpose.

Status values: `todo`, `done`, `video` (needs a re-capture, re-voice or re-render), `owner` (a decision, or something only the owner can do), `info` (no change).

## Terminology decisions made in the meeting

| # | Decision | Applies to | Status |
|---|---|---|---|
| T1 | Say **station** everywhere. Never "pin" (reads as a flag) or "head". It matches Lynx. Stations are what you adjust; the map plots each station's sprinklers. | guides, narration, captions, app recreation labels | done, needs re-voice |
| T2 | Call the modelled value **modeled**. Never "fallback" or "fall back". | guides, narration | done, needs re-voice |
| T3 | Say **average**, not "mean". The UI says average. | guides, narration | done, needs re-voice |
| T4 | American English throughout (color, centered, behavior). The narration drifted to British spellings. | guides, narration, captions | done, needs re-voice |
| T5 | The "New in IntelliDash" banner should read **New in Spatial Adjust**. | callout label, episode title cards | done (callout label); title cards need a re-render |
| T6 | Say "an entire hole", not "the whole hole". | bulk adjustments | done, needs re-voice |

## Content corrections

| # | Feedback | Where | Status |
|---|---|---|---|
| C1 | "Current and suggested adjustment" were described as editable. They are not. Only Target VWC, the percent adjustment and the enable switch are. | dashboard overview narration and guide | done, needs re-voice |
| C2 | Target VWC accepts 0 to 50, but a demo row showed 69. Demo data must stay in range. | recreation data | done |
| C3 | Average VWC comes from a measured scan. When there is none it is modeled. Say so once, early. | understand Spatial Adjust | done, needs re-voice |
| C4 | Demo suggestions of about 333% frighten people. Use in-range percentages and simple round numbers (30 and 50, not 26.1) in worked examples. | recreation data, narration, bulk adjustments | done, needs re-voice |
| C5 | The odd early line about "black text, today's date" is awkward. Drop it; the later gray-italic explanation is enough. | understanding VWC | done, needs re-voice |
| C6 | The legend slider must show four colors (red, yellow, green, blue) and three draggable handles. The recreation shows one color too few. | recreation legend | done |
| C7 | The showcase mentions the soil factor, which is not released yet and will stay invisible to customers. Remove it from the showcase narration. | showcase | done, needs re-voice |
| C8 | Showcase map and graph do not agree. | showcase footage | video |
| C9 | Add a short "why you would override" to the percent adjustment step (too high, too low). | editing station targets | done, needs re-voice |
| C10 | Stop describing the exact formula in more depth than needed. Keep it high level (what influences the value), because the soil factor and later adjustments will change it. | calculation narration | done, needs re-voice |
| C11 | Remove "Recovery" from the example profile name "Overseed Recovery". Nobody uses the term. Use "Overseed". | profiles | done, needs re-voice |
| C12 | The line "applying and pushing in the same minute leaves no time to sanity check" confuses people. Reword to say a profile applies course-wide, so check the suggested column before you push. | target profiles | done, needs re-voice |
| C13 | Confirmed by an expert: a profile matches stations by station descriptor. Stations added after capture keep their existing target and are untouched. Add a short caution that renamed or renumbered stations will not match when an old profile is applied. | profiles | done |
| C14 | The Bulk adjust steps say ticking an area or hole cascades to the stations below. The footage only ticks stations. | bulk adjustments | video |
| C15 | Two reviewers want a one-line mention that the band colors and boundaries are yours to change, not only the defaults. | map navigation / dashboard overview | done, needs re-voice |
| C16 | At hole level a value shows as a whole number. Reviewer asked for it to match the rest. Needs a look in the recreation. | recreation table | owner |

## Video production

| # | Feedback | Status |
|---|---|---|
| V1 | The cursor is often away from, or the camera not following, what the narration is describing. Mouse landed on the wrong button during bulk adjust. Variance toggle arrow in the wrong place. Camera does not center on the legend bands. | video |
| V2 | Show the band handle being dragged (animation). Step through the drill-down (click down the tree, click a breadcrumb to go back) in the overview. | video |
| V3 | Music makes reviewers nervous. They asked for calm, soothing music. | owner (licence and bed decision) |
| V4 | The showcase is too fast to follow, fine as an overview. Keep, but say it is an overview, not a how-to. | info |
| V5 | Update the guide images to match the real app. | owner (needs real screens) |

## Structure

| # | Feedback | Status |
|---|---|---|
| S1 | The four profile episodes (apply, capture, update, manage) overlap. Reviewers suggest two. | owner |
| S2 | Open product question: renaming or moving stations in a renovation breaks an old profile silently. How should the product warn? Taken to the Wednesday product meeting. | owner |
| S3 | Videos double as a sales tool for distributors. | info |
| S4 | Three more formal review sessions are planned; a polished set is shown next week. | info |
