# Spatial Adjust Guides — user test protocol

The point is to decide things, not to collect compliments. Four questions:

1. **Which of the 17 unwritten guides should be written next?**
2. **Does the step-player-plus-camera format actually teach?** It's the central bet of the system, built 7 times and validated zero.
3. **Is the content factually correct** against the shipping product?
4. **Where do people give up?** `target-profiles` is 28 steps against a 4–6 norm.

Site: https://toroadam.github.io/spatial-adjust-guide/

---

## Cohort

Recruit 8–10 across three groups. The mix matters more than the count — an all-expert cohort will not reveal what a newcomer can't follow.

| Group | n | Why |
|---|---|---|
| Superintendents already using Spatial Adjust | 3–4 | The only people who can judge factual accuracy |
| Superintendents new to it | 3–4 | Reveal what the guides assume without saying |
| Internal (support, CS, sales engineering) | 2 | Will use these daily; catch gaps others tolerate |

Run on the participant's own hardware where possible. If someone only has a phone, keep them — that tells you whether the phone fallback is adequate.

## Before each session

- Confirm consent to observe and take notes.
- Ask them to open the site and stop. Don't demo it.
- Run `__saClear()` in the browser console so the session's events are clean.

## Tasks

Give the task, then stay quiet. The instinct to help is the thing to resist — where they get stuck *is* the finding.

**Task 1 — Orientation (no guide).** "Without opening anything, tell me what you think this site is for and where you'd start." Tests whether the catalog communicates scope. Note whether they notice 17 are unwritten.

**Task 2 — Guided task.** "Using only the guides, work out how to set a minimum threshold and push the change." Note: which guide they pick, whether they use the step player or skim, whether they scroll past the stage.

**Task 3 — Diagnosis.** "A station is showing 0%. Use the guides to work out why." Tests whether guides are findable by problem rather than by feature name.

**Task 4 — The long one.** "Work through applying a target profile." This is the 28-step guide. Record where attention drops and whether they reach the end.

**Task 5 — Gap probe.** "Is there anything you expected to find that isn't here?" Then let them click any "Coming soon" card and say what they wanted from it. This is the demand signal in their own words.

**Task 6 — Accuracy (experienced only).** Walk each of the 7 written guides against the real product. Check specifically the **Before you start** preconditions and the **How to know it worked** outcomes — those are the claims most likely to be wrong and most costly if they are.

## Observe, don't ask

Record behaviour, not opinions. Useful signals:

- Did they use the step player, or read the text and ignore the stage? **If most ignore the stage, the format's central premise is wrong and the remaining 17 guides should be written differently.**
- Did they scroll back up to re-read, or move on confused?
- Did they try to interact with the app screenshot as if it were live?
- Did they find a guide by searching, by category, or by giving up and scrolling?

## After each session

- Export the events: run `__saExport()` in the console and save the JSON against the participant ID.
- `__saReport()` prints a summary: guides opened, stub demand, event counts.
- Note verbatim quotes for anything surprising. Paraphrase loses the finding.

## Synthesis

Produce a short written readout with:

1. **A ranked list of the 17 stubs** by demand — stub clicks plus what people said they wanted.
2. **A verdict on the format**: keep, adjust, or replace. Say which, and on what evidence.
3. **Completion and drop-off per guide**, with a specific read on `target-profiles`.
4. **Factual corrections**, filed as issues.
5. **What to write next**, in order, with reasoning.

## A note on the data

Events stay in the browser's `localStorage` by default — nothing is transmitted. That's sufficient for moderated sessions, where you have the device.

It is **not** sufficient for passive collection from remote users. If you want stub-demand data from people you're not sitting with, an endpoint has to be configured — see README > Instrumentation. That's a deliberate choice pending, not an oversight.

## Known limitation to test around

Eleven contrast failures inside the app reproduction are intentional: it faithfully mirrors the real IntelliDash screen. If a participant struggles to read the app's own grey-on-white text, that is a finding about **IntelliDash**, not about the guides. Log it separately and route it to that team.
