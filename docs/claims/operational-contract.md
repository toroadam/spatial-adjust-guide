# Operational contract: the push window and the Lynx prerequisites

This file records the rules a superintendent has to follow outside the Spatial Adjust screen for
a push to do what the dashboard says. There are two kinds: when to push, and how Lynx has to be
set up. Both come from Toro's own user guide. Wherever that guide is silent, the rule is left as
a question for an expert.

`src/transforms/operational-contract.mjs` holds the guide wording built from these rules. It is
published. On 2026-10-19 the guides owner decided to put all of it on the live site before the
open questions below are answered, and to settle them with the experts at the in-person review of
the live site on 2026-10-22 (see [Publishing](#publishing)).

Owner: feature 5. See the module map in [`README.md`](README.md).

## Source

**Toro, *Spatial Adjust User Guide*, part number 373-1135, Revision 02.** © 2026 The Toro
Company, 16 pages. The PDF was produced on 2026-09-03. The revision is printed in the footer of the
last page.

- It is an internal Toro publication and is not public. The PDF, and any extract of it, stays out of
  this repository. The requester holds the copy that was read.
- The document has no numbered sections, so citations name the section heading as printed and the
  page number in the PDF: `373-1135 rev 02 §<heading>, p.<page>`.
- Rules are paraphrased here. Short phrases are quoted only where the exact words decide what a
  rule means.

The IntelliDash citations are to the production SHA pinned in [`sources.json`](sources.json),
`1aa4f28622cc3cc9637f0d61a438bf16bcf01924`. They are corroboration only. 373-1135 is the source
for every rule.

## Rules

Status is **Sourced** when 373-1135 rev 02 states the rule, or **Needs expert** when the document
does not settle it. Each Needs-expert rule names its question in [Questions](#questions-for-the-expert-review).

### The push window

| ID | Rule | Source | Status |
|---|---|---|---|
| OC-1 | The window opens at 11 AM. | 373-1135 rev 02 §Push Changes Dialog Box, p.10 (the NOTE under the dialog description) | Sourced |
| OC-2 | Time basis of that 11 AM: course-local time or Eastern Time. | Not stated. See [below](#the-time-basis-of-11-am). | **Needs expert**: Q1 |
| OC-3 | The window closes at the synchronisation time set in Toro Lynx Central Control and Lynx Drive. | 373-1135 rev 02 §Push Changes Dialog Box, p.10 | Sourced |
| OC-4 | Order: push first, then synchronise. The document's words are "synchronization needs to be done after the push". | 373-1135 rev 02 §Push Changes Dialog Box, p.10 | Sourced. Whether the scheduled synchronisation is enough or a manual one is needed: **Needs expert**, Q2 |
| OC-5 | Outside the window, nothing reaches the course and no error is shown. | Not stated. The document gives the window but never says what happens outside it. | **Needs expert**: Q3, Q4 |

#### The time basis of 11 AM

The document does not give a time zone for the 11 AM in OC-1. Specifically:

- §Push Changes Dialog Box, p.10 says only "between 11 AM and Synchronization time". It names no
  zone.
- §Calculation ET, p.2 says daily calculations use "the 11:00 AM ET value". Here **ET means
  evapotranspiration**, not Eastern Time. The section's own subheading is "Calculations ET
  (Evapotranspiration)", and the sentence before it says Calculation ET (Evapotranspiration) is
  updated hourly. An earlier review read "11:00 AM ET" as possibly Eastern. The document does not support
  that reading, and it never mentions Eastern Time anywhere.
- §Header, p.2 says the weather data comes from DTN for the site's geographic location.

The production code agrees with a course-local reading of the ET time. It does not cover the push
window itself:

- `api/Services/SpatialAdjustService.cs:2838-2861`: today's ET is fetched again from the weather
  service on every run until a configured hour of the site's local day. After that hour it is
  frozen for the rest of the day.
- `api/appsettings.json:149`: that hour is configured as 11.
- `api/Services/SpatialAdjustService.cs:2497-2502`: "site local" is the site's configured time
  zone. A site with no time zone falls back to UTC.

So the 11:00 ET value is 11:00 course-local time (UTC for a site with no time zone set). The likely
reason the push window opens at 11 AM is that suggestions stop moving once the day's ET is frozen.
That would make the window course-local too, but the document does not say so, and the product
contains no push-window logic to confirm it. The guide wording therefore says "11 AM" with no
zone, as the document does, and the zone stays open as Q1. The answer matters most for courses
east of US Eastern Time. If the basis were Eastern, those courses would be pushing before the
window opened while following the guide exactly.

### The Lynx prerequisites

Set in Lynx (Toro Lynx Central Control and Lynx Drive), not in Spatial Adjust. The example the
document uses is the Fairways program.

| ID | Setting and where it is set | Required value | Consequence of any other value | Source | Status |
|---|---|---|---|---|---|
| OC-6 | **Site Adjust** and **Course Adjust**, in Lynx. The document's screenshot shows them as the site "Adjust" field and the "Course : Course 1" "Adjust" field. | 100% | Not stated in the document. | 373-1135 rev 02 §Settings Configuration, p.1 | Value: Sourced. Consequence, and which course(s): **Needs expert**, Q5 |
| OC-7 | **Pct. Adjust** in the Lynx watering plan, on the program and on every hole under it that is enabled in Spatial Adjust (for example Fairways and 2-Fairways) | 100 | Not stated in the document. | 373-1135 rev 02 §Settings Configuration, p.1 | Value: Sourced. Consequence: **Needs expert**, Q6 |
| OC-8 | **Next Amt.** of the program in the Lynx watering plan, against **Lynx Reference Amount** in Spatial Adjust Settings › Calculation | Equal, in the same units | Partly stated. Every suggestion is a percentage of the Lynx Reference Amount: §Settings Configuration p.1 works the Daily Max example as 10 mm ÷ 5 mm = 200%, and `api/Services/SpatialAdjustLogic.cs:81` and `:125-130` divide the applied amount by the reference amount for both methods. What Lynx then does with that percentage is not stated. | 373-1135 rev 02 §Settings Configuration (Lynx Reference), p.1. §Imperial Units, p.12 says to set both amounts in the chosen units. | Value: Sourced. Consequence: **Needs expert**, Q7 |

## Questions for the expert review

One line each, phrased so a Lynx specialist or agronomist can confirm or correct them. Feature 9
puts these in the review pack. The wording that rests on them is already live, so they are agenda
items for the in-person review on 2026-10-22, and the claims ledger records each open sentence as
Needs expert with its question.

| Q | Rule | Question |
|---|---|---|
| Q1 | OC-2 | 373-1135 rev 02 p.10 says to push "between 11 AM and Synchronization time". Is that 11 AM in the course's local time or US Eastern Time? |
| Q2 | OC-4 | Does the synchronisation Lynx runs at its scheduled time pick up a push made earlier that day, or must the superintendent synchronise Lynx by hand after every push? What is the setting called on the Lynx screen? |
| Q3 | OC-5 | If someone pushes after the Lynx synchronisation time, does the change reach the course before the next day's synchronisation? Does anything in Spatial Adjust or Lynx tell them it did not? (The push dialog would still verify the values against Lynx and report success.) |
| Q4 | OC-5 | If someone pushes before 11 AM, what goes wrong? Is the change lost or overwritten, or is it only based on an ET value that can still change before 11 AM? Is anything reported? |
| Q5 | OC-6 | If Site Adjust or Course Adjust is not 100%, does Lynx multiply it into every station percentage Spatial Adjust pushes? For example, does a Course Adjust of 80% turn a pushed 120% into 96%? With more than one Lynx course, must Course Adjust be 100% on every course Spatial Adjust pushes to? |
| Q6 | OC-7 | If the program's or a hole's Pct. Adjust is not 100, does Lynx multiply it into the pushed percentage of every station under it in the same way? |
| Q7 | OC-8 | Does Lynx apply a station's percentage to the program's Next Amt.? If so, a Next Amt. that differs from the Lynx Reference Amount scales what every station receives by Next Amt. ÷ Lynx Reference Amount. |

## Guide wording (published 2026-10-19)

Each callout and list item is made of sentences. A sentence is **settled** when 373-1135 rev 02
states it, and **open** while any question it depends on is unanswered. The module records each
sentence's 373-1135 `source` and its `open` questions, and it refuses to publish while any
sentence has no source or is still open, unless `PUBLISH_UNSETTLED` is true. It is true now, so
every row below is live, including the open ones.

| ID | Where | Sentence | Rests on | State |
|---|---|---|---|---|
| W1 | Push-step callout, label `Push window.` | Push between 11 AM and the synchronisation time set in Lynx, and synchronise Lynx after the push. | OC-1, OC-3, OC-4 | Open: Q1 (zone), Q2 (how to synchronise) |
| | | Outside that window the push does not reach the course, and no error tells you so. | OC-5 | Open: Q3, Q4 |
| W2 | Push changes to Lynx, Before you start | In Lynx, Site Adjust and Course Adjust must both be 100%. | OC-6 | Settled |
| | | Any other value is applied on top of every percentage you push, so the whole course waters more or less than the dashboard shows, and nothing reports an error. | OC-6 | Open: Q5 |
| W3 | Push changes to Lynx, Before you start | In the Lynx watering plan, Pct. Adjust must be 100 on the program and on every hole under it that you have enabled in Spatial Adjust, for example Fairways and 2-Fairways. | OC-7 | Settled |
| | | Any other value is applied on top of the percentages you push to the stations under it, again without an error. | OC-7 | Open: Q6 |
| W4 | Push changes to Lynx, Before you start | In the same program, Next Amt. must equal the Lynx Reference Amount under Settings › Calculation, in the same units. | OC-8 | Settled |
| | | Every suggestion is a percentage of that reference amount, so a mismatch scales what each station receives by the ratio between the two, again without an error. | OC-8 | Open: Q7 |
| W5 | Cross-reference in each gated guide, Before you start | Lynx itself must be set up to match Spatial Adjust. | OC-6, OC-7, OC-8 | Settled |
| | | Push changes to Lynx lists the settings under Before you start. | the W2-W4 list | Settled |

Once Q1 is answered, W1 names the zone, for example "11 AM course time". Every repeat of W1 and
W5 is the same string, so each locale translates it once. "Push changes to Lynx" in W5 is that
guide's title, so its translation must match the translated title.

### Where W1 goes: the guides that end in a push

At the step where the reader presses Push Changes or its footer button. Titles are as published,
that is after `transformGuide()`'s earlier edits.

| Guide | Step | Why |
|---|---|---|
| `push-to-lynx` | 5 "Send and watch the progress" | The send itself |
| `reviewing-changes` | 5 "Trust the footer count" | The last step before the footer button sends |
| `minimum-threshold` | 5 "Save and confirm at push time" | The threshold only takes effect when you push, and this step opens Push Changes to do it |
| `push-failures` | 4 "Re-push only the failures" | A re-push is a push. A retry made after the synchronisation time is the likeliest silent miss. |
| `verify-results` | 1 "It writes first, station by station" | The guide follows one push from the moment it is sent, and its success message is exactly what an out-of-window push would also show. The raw export titles this step "It reads Lynx first". `src/transform-export.mjs` reorders it. |
| `seasonal-profiles` | 4 "Push once you agree with them" | Target Profiles ships in production, and this step is an ordinary push |

Considered and rejected:

- `threshold-questions` step 2 "The push dialog shows what will be sent". This step opens the
  dialog only to compare values. The guide ends in Settings, not in a push.
- `target-profiles` step 3 "Apply and confirm". Its tip says "then push", but the guide does not
  include a push step.

None of the six steps has a tip today, so no callout has to be combined. If another module ever
gives one of them a tip, the module fails the build rather than let one callout overwrite the
other.

### Where W5 goes: the gated guides

Each W5 item is appended after the guide's last existing Before you start item. These are the
guides whose numbers only mean what they say if Lynx is set up as W2-W4 describe.

| Guide | Appended after |
|---|---|
| `reviewing-changes` | "Everything in the dialog is still reversible. …" |
| `minimum-threshold` | "Setting the percentage to 0 disables the feature entirely." |
| `push-failures` | "By the time you see a failure, …" |
| `verify-results` | "Verification is automatic. …" |
| `seasonal-profiles` | "Applying a profile is a course-wide recalculation, …" |
| `calculation-settings` | "Changing any of them recalculates every suggestion and reloads the dashboard." |
| `suggested-adjustments` | "A station with no current scan and no model estimate shows a dash rather than a number." |

`push-to-lynx` carries W2-W4 itself, appended after "Stations already pushed today are listed
separately …".

## Publishing

`PUBLISH` and `PUBLISH_UNSETTLED` in `src/transforms/operational-contract.mjs` are both `true`, so
every sentence in the table above is on the live site in all eleven languages. With `PUBLISH`
false, `apply()` would still run every anchored edit on a copy, so a moved anchor fails the build,
and return the page unchanged.

**Decision (2026-10-19).** OC-5 and the consequences in OC-6 to OC-8 are Lynx-side behaviour, and
373-1135 rev 02 does not cover them, so under the original rule (publish only sentences that cite
a 373-1135 section) they could never ship. The guides owner decided to publish all of the wording
now, the open sentences included, and to review it with the experts in person, page by page on the
live site, on 2026-10-22. The open sentences carry the silent-failure warning and the
consequences, which this feature exists to add. Until the review, they rest on Q1-Q7 alone.

The claims ledger records every published sentence. The settled ones are `prerequisite` or
`navigation` claims, Verified and cited as `{ "source": "doc", "ref": "373-1135 rev 02 §…" }`.
The open ones are Needs expert, each with the question it rests on.

After the review:

1. Record each expert answer against its question here, with the reviewer's role and the date, not
   a name. Then reword any sentence the answer changes, clear the sentence's `open` list in the
   module, and give it a `source`: the 373-1135 section, or the recorded answer.
2. Once no sentence has an open question or lacks a source, set `PUBLISH_UNSETTLED = false`, so
   the module throws again if a later edit adds an unsettled sentence.
3. Translate any reworded string into all ten locales, re-extract the claims ledger, and move each
   answered claim from Needs expert to Verified or Wrong.

## Superseded notes

Two earlier work items were blocked from 2026-09-09 waiting for this document. This work absorbs
both. 373-1135 rev 02 settles the window's start and end, the push-then-synchronise order and the
required Lynx values. It also shows that the "ET" in "11:00 AM ET" is evapotranspiration. It does
not settle anything listed under Q1-Q7.
