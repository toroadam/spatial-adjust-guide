# Spatial Adjust Guides: followability test protocol

The point is to decide things, not to collect compliments. The site now holds 26 written guides in six
categories, and every step in them is written to one shape (Do, You should see, If not, and sometimes
Why; see `docs/writing-guide.md`). The question for these sessions is narrow:

**Can a person who has not seen the guide before follow it, step by step, to the end of a real task,
without anyone helping, and where do they get stuck?**

Four things this protocol decides:

1. **Per task, how many people finish unaided.** The target is at least 80% (4 of 5).
2. **Where people get stuck**, to the step, so each fix goes to one step of one guide.
3. **Whether the fixes worked.** Round 2 repeats the tasks after the fixes and must show fewer stuck
   points than round 1.
4. **Where the written text and the step player disagree.** Whether people use the player or only
   read the article is a finding in itself.

Site: https://toroadam.github.io/spatial-adjust-guide/

What this protocol does not test: whether the guides are factually correct (that is the claims ledger in
`docs/claims/` and the expert walkthrough in `docs/review-agenda.md`), and which guide to write next
(all 26 are written; there are no "Coming soon" cards left to click).

---

## Two rounds

| | Round 1 | Round 2 |
|---|---|---|
| Purpose | Find the stuck points | Prove the fixes worked |
| Participants | At least 5 | At least 5 |
| Guides | The live site as it stands | The site after the round 1 stuck-point fixes |
| Between rounds | Read out with `scripts/session-readout.mjs`, write `docs/followability-readout.md`, fix through `src/rewrite/*.mjs` | Read out and compare with round 1 |

Round 2 should use different people. Someone who has already followed a guide once is faster the second
time for reasons the text did not cause. If a person repeats, they repeat only tasks they did not
attempt in round 1, and the readout says so.

Codes, not names. Round 1 participants are `R1P01`, `R1P02` and so on; round 2 are `R2P01`... A roster that
maps a code to a person stays with the moderator, outside the repository.

## Cohort

At least five per round. The mix matters more than the count: an all-expert cohort hides what a newcomer
cannot follow.

| Group | Per round | Why |
|---|---|---|
| Superintendents or assistants who have not used Spatial Adjust | at least 3 | They are who the guides are for. They show what the text assumes without saying so. |
| Superintendents or assistants who use Spatial Adjust | at least 1 | They notice when a step contradicts what they do every day. |
| Toro support or customer success | at most 2 | They will use the guides daily and tolerate gaps others will not, so they never make up the majority. |

Run on the participant's own hardware where possible, on a screen at least 768 px wide. Below 768 px the
step player's stage is hidden and the written steps take the whole width, so no step events are recorded.
A participant on a phone can still be observed, but their events are not usable: the moderator's sheet is
then the only source for that session, and the readout counts them separately.

## Safety

Sessions run only against IntelliDash `/demo`. Demo Mode blocks writes. Nobody saves or pushes on a real
course in a session: on a live course, Push Changes sends adjustments to Lynx. If a participant's screen
ever shows a real course, stop, close it, and do not record that session. Tasks that end in a save or a push
are completed in `/demo` only.

## Before each session

- Consent to observe, take notes and keep the anonymised numbers. The participant may stop at any time and
  ask for their session to be deleted.
- Open the site in a fresh private window, so `localStorage` is empty. Open the browser console and run
  `__saClear()` anyway, and run `__saReport().events` to confirm it prints 0 or only the locale and splash
  events.
- Open IntelliDash `/demo` in a second window on the Spatial Adjust page. Check that the tabs and the table
  are on the default view.
- Start the site from the home page. Do not start from a link to a guide: opening a guide from a `#/<key>`
  link records no `guide_opened` event.
- Read the **session script** below, word for word.

## Session script

Allow 45 minutes. Say the quoted parts as written, so every participant hears the same thing.

1. **Welcome (2 min).** "We are testing the guides, not you. If something is confusing, that is the guides'
   fault and it is exactly what we need to find. I will not be able to help while you work, because I want
   to see what happens when nobody is there. Please say out loud what you are thinking. You can stop at any
   time."
2. **Warm-up, not scored (3 min).** "Without opening anything, tell me what you think this site is for."
   Then: "Open any guide and move through it however you like." This is so the participant knows what the
   player is. Run `__saClear()` again afterwards.
3. **Tasks (30 min).** Give each task from the list below, one at a time, on a card, read aloud once. Start
   the stopwatch when the participant says they are ready. They start from the home page every time. Stay
   quiet. See **Moderator rules**.
4. **Close (5 min).** Ask: "Was there a step you had to read more than once?" and "Was there anything you
   expected that was not there?" Write the answers down in their words. Do not defend the guides.
5. **Export (2 min).** Run `__saExport()`, save the file as `<code>.events.json` in `_sessions/round<N>/`,
   and write the moderator's sheet as `<code>.moderator.json` beside it (format below).

## Tasks

Six scored tasks, each tied to one guide. The task card names the goal, not the guide, so finding the guide
is part of the task. The participant is told they may use the guides however they like and nothing else.

| Task | Goal on the card | Guide key | Steps | Success: all of |
|---|---|---|---|---|
| T1 | "Your site needs a minimum threshold of 12% in Spatial Adjust. Anything below it should go to Lynx as zero, and stations already at zero should stay there. Set that up and show me where you would check that it took." | `minimum-threshold` | 8 | Opened the Settings dialog; chose the Minimum Threshold tab; entered 12; chose the option that sets values to zero; ticked Exclude Zeros; saved; opened Push Changes and pointed at the threshold banner. |
| T2 | "There is a saved target profile you want to use on the stations. Apply it." | `target-profiles` | 7 | Opened Target Profiles in Settings; chose a profile with Apply Profile; confirmed in the dialog; saved; looked at Target VWC in the table. |
| T3 | "A station in the table is suggesting 0%, and the superintendent wants to know why. Work it out." | `station-zero` | 5 | Compared Avg. VWC with Target VWC; checked the threshold in Settings; checked the Enable switch; read the scan date; named the cause the moderator set up for the demo station. |
| T4 | "You have reviewed the suggested changes and want to send them to Lynx. Get as far as you safely can, and say what you would check afterwards." | `push-to-lynx` | 6 | Read the pending count on Push Changes; opened the dialog; found the threshold banner; unticked a named station; reached the footer button; said where the result line appears. |
| T5 | "One hole should stop receiving adjustments, along with all its stations. Do that." | `enable-disable-stations` | 6 | Found the Enable switch; shift-clicked the hole's switch; continued on the confirmation; confirmed the stations beneath it switched off. |
| T6 | "The scan dates look old. Get fresh scan data." | `request-scan-data` | 5 | Read the scan dates; selected Request latest scan data; saw Request Queued; knew to select Reload Data when the banner appears. |

Notes on running them:

- T1 and T4 are `/demo`: the final Save Changes or push button may be selected, because Demo Mode blocks
  the write and shows an unsupported message. Tell the participant that message is expected.
- T3 needs a prepared station. Choose one in `/demo` whose suggestion is 0, and write down beforehand which
  cause is the answer.
- The order is T3, T1, T2, T6, T5, T4 for the first participant and rotates by one position for each
  following participant, so no task always comes last when people are tired.
- A participant who finds the right guide and follows every step has completed the task even if the
  prepared answer in T3 turns out to be unreachable in `/demo`. Record that in the sheet, and see
  **Definitions** for how it is scored.

## Moderator rules

Give the task, then stay quiet. The instinct to help is the thing to resist: where they get stuck *is* the
finding.

- Do not say a step number, point at the screen, read a step aloud or confirm that something is right.
- If asked a question, answer: "What would you do if I were not here?"
- Allow up to **8 minutes** per task. If a participant is stuck on one step for 3 minutes, say: "Would a
  hint help?" If they say yes, give the smallest one that gets them moving, and record it as a hint at that
  step. That attempt is **aided**. If they say no, carry on until the 8 minutes are up.
- At 8 minutes, end the task: **failed**. Move on without comment.
- Never tell a participant they completed or failed a task.

## Observation sheet

One row per task per participant, filled in live or from the recording. This is also how the Thursday
walkthrough should be noted (see `docs/review-agenda.md`).

| Field | Content |
|---|---|
| Code | `R1P03` |
| Task and guide key | `T2 target-profiles` |
| Outcome | `unaided`, `aided` or `failed` |
| Used the step player | yes or no |
| Stopwatch seconds | only needed when the player was not used |
| Per step: hint | the step number where the moderator gave a hint |
| Per step: wrong action | step number and what they did (wrong control, wrong value, wrong tab) |
| Per step: confusion | step number and the words they used: "I do not see ...", "where is ..." |
| Per step: off task | step number, when a long pause was a phone call or a story rather than reading |
| Verbatim | quotes, with no names, no course names and no customer values |

Anything the participant said about the product itself, rather than the guide, goes in a separate list. The
Known limitation at the end of this document explains why.

### Moderator file format

`_sessions/round<N>/<code>.moderator.json`. The readout script reads exactly these fields and prints counts
and step numbers only, never the text.

```json
{
  "participant": "R1P01",
  "round": 1,
  "group": "superintendent",
  "experience": "new",
  "device": "desktop",
  "tasks": [
    {
      "task": "T2",
      "guide": "target-profiles",
      "outcome": "aided",
      "usedPlayer": true,
      "seconds": 214,
      "notes": [
        { "step": 4, "kind": "hint", "text": "needed to be told which icon" },
        { "step": 3, "kind": "confusion", "text": "which column is the profile" },
        { "step": 6, "kind": "off-task", "text": "phone call" }
      ]
    }
  ]
}
```

`group` is `superintendent`, `assistant` or `support`. `experience` is `new` or `experienced`. `device` is
`desktop`, `tablet` or `phone`. `kind` is `hint`, `wrong-action`, `confusion` or `off-task`. `seconds` is
optional and used only when the participant never used the player.

## Definitions

These are exact. The readout script applies them to the files; nobody re-judges a number by eye.

**Task attempt.** One participant, one task. It is identified by the participant's code and the task's guide
key. Events are matched on `props.key`. Events for other guides are ignored for that attempt, so a
participant who opens a wrong guide first costs nothing in the attempt but is counted separately as
*other guides opened*.

**Event times.** The analytics layer (`src/analytics.js`) records each event with an ISO time `t`. Opening a
guide from the home page records `guide_opened` with `key`. Moving the step player records `step_advanced`
with `key`, `step` (1-based) and `total`. Step 1 has no `step_advanced`: it is entered by `guide_opened`.
`guide_completed` records arrival at the last step, whether by Next or by jumping on the chapter strip, and
repeats if the last step is selected again, so only the first one counts.

**Completed unaided.** An attempt is completed unaided when all three hold:

1. the moderator's outcome is `unaided`: the participant met the task's success criteria and nobody gave a
   hint or any other help;
2. the events show a `guide_completed` for the guide, **or** the moderator recorded `usedPlayer: false`
   (the participant read the article and never moved the player, so there are no step events);
3. the attempt took at most 8 minutes.

Where the moderator file is missing, the attempt is shown as *events only* and is not counted as unaided.
A `guide_completed` alone is never enough: it also fires when someone jumps straight to the last step
without reading the ones before it, so the script also reports how many steps in the attempt were skipped
(a step with no `step_advanced`, other than step 1) and an attempt with a skipped step is flagged.

**Completion rate.** Attempts completed unaided divided by attempts, for the task, in the round. The
target is at least 80%, so 4 of 5 or 5 of 6.

**Time on task.** Seconds from the first `guide_opened` for the guide to the first `guide_completed` for
the guide. Where the participant never used the player, it is the moderator's stopwatch `seconds` and the
readout marks it with an asterisk. The table reports the **median** over attempts completed unaided, with the
count it was taken over, because one slow person should not decide the number and an aided attempt's time
says nothing about the text. An attempt that was not completed unaided has no time in the table.

**Dwell.** Seconds from arriving at a step to the next `step_advanced` or `guide_completed` for the same
guide. The last step has no dwell, because nothing follows it.

**Stuck point.** A stuck point is a participant, a task and a step where at least one of the following
happened. It counts once however many triggers fire.

1. **Long dwell.** Dwell on the step is more than 60 seconds, unless the moderator marked that step
   `off-task` for that participant.
2. **Back-step.** A `step_advanced` to a lower step number than the one before it. The stuck step is the
   step they went **back to**: it is the one they felt they had to read again.
3. **Exit.** The participant left the guide (opened another guide, or the events stop) on a step without a
   `guide_completed`, and the moderator's outcome for the attempt is not `unaided`. The stuck step is the
   last one reached. (The analytics layer lists `returned_home` but nothing emits it today, so the script
   infers exits from the sequence rather than reading that event.)
4. **Moderator-observed.** The moderator sheet has a `hint`, `wrong-action` or `confusion` for the step.

**Stuck steps (per task).** Steps that are a stuck point for at least two participants in the round, plus
any step with a stuck point from a `hint` or an exit by someone whose outcome was `failed`. These are the
steps to fix, one change per step.

**Stuck points per participant.** The number of stuck points in the round divided by the number of
participants. Round 2 passes when this is lower than round 1 and no task's count of stuck points is higher
than it was in round 1.

**Pass.** A round 2 task passes when its completion rate is at least 80%. The round 2 comparison passes
when every tested task passes and stuck points per participant fell. If any target is missed,
`docs/followability-readout.md` records the shortfall and the next fix, and a decision is logged.

## What counts as a fix

A stuck point is fixed in the transform layer, never in the exported `.dc.html` files: `src/rewrite/*.mjs`,
anchored on the exact text with an asserted match count. A fix names the guide key and step, keeps every
`#/<key>` URL, and goes through the full check and translation procedure in `README.md` (Localisation status >
How translation is applied) and `docs/writing-guide.md`: `npm run test:shape`, `test:readability`,
`test:validate`, `test:i18n`, `test:prose` and `test:cursor-target`.

## After each session

- Save the two files as above and check the event file has fewer than 500 events. `src/analytics.js` keeps
  a ring of 500 and drops the oldest, so an overlong session loses its start. The readout warns.
- Run `node scripts/session-readout.mjs _sessions/round<N>` to see the participant's numbers at once.
- Note verbatim quotes for anything surprising. Paraphrase loses the finding.

## Synthesis

Produce `docs/followability-readout.md` with:

1. **Per round**: the cohort (codes, group, experience, device), and the table from
   `scripts/session-readout.mjs`: tasks, attempts, completion rate, median time on task and stuck steps.
2. **Stuck steps in words**: for each, the guide key, the step, what people did, and the fix chosen.
3. **The comparison** of round 2 against round 1 against the targets above, pass or shortfall.
4. **Findings for the triage.** Each finding is written as a *Guide feedback* row (page, step, kind, locale,
   comment), because that is the format the post-review triage reads.
5. **Product findings** that are about IntelliDash and not the guides, kept separate.

## A note on the data

Events stay in the browser's `localStorage`. Nothing is transmitted, which is what keeps the site making
zero external requests. That is sufficient for moderated sessions, where you have the device. It is **not**
sufficient for passive collection from remote users; see README > Instrumentation and feedback.

Raw files never enter the repository. `_sessions/` is in `.gitignore` and holds the exported events and the
moderator files, on the moderator's own machine. The readout contains participant codes and counts. A
verbatim quote goes into it only after names, course names, coordinates and customer values are taken out.
Delete the raw files once the post-review triage that used them is done, and delete a participant's files
at once if they ask.

## Known limitation to test around

Eleven contrast failures inside the app reproduction are intentional: it faithfully mirrors the real
IntelliDash screen. If a participant struggles to read the app's own grey-on-white text, that is a finding
about **IntelliDash**, not about the guides. Log it separately and route it to that team.
