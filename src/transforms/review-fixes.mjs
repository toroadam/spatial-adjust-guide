// Fixes that come out of the expert review.
//
// Owner: feature 10 (triage expert feedback, record sign-off and make the accuracy checks
// blocking). No other feature edits this file. See the module map in docs/claims/README.md.
//
// Runs last of the four modules, so a review fix may anchor on text that any of the earlier
// modules (corrections, changed-surfaces, operational-contract) produced.
//
// Every edit() is anchored on the exact text it replaces and asserts how many times that text
// occurs. A Core Design re-export that moves the anchor then fails the build rather than silently
// dropping the fix. The guide catalogues are keyed on exact English, so any changed sentence
// orphans that string's translation in all ten locales.
import { edit } from './edit.mjs';

/** Exact text as a pattern for edit(). */
const exact = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/** The 2026-10-22 walkthrough, applied to guide text the Core Design export carries. Terminology
 *  decisions: say station rather than pin or head, modeled rather than fallback, average rather than
 *  mean, and American spellings. Every edit asserts how many times its anchor occurs. Text a later
 *  rewrite in src/rewrite/ anchors on (its `expect` blocks) is not touched here; the rewrite sets
 *  the new wording itself. */
const FIXES = [
  // T1: station, never pin or head.
  { name: 'map navigation summary: stations, not pins',
    from: 'Read the pins, move the moisture bands, switch to variance, and filter what the map shows.',
    to: 'Read station colors on the map, move the moisture bands, switch to variance, and filter what the map shows.' },
  { name: 'push list prerequisite: same station, not same head',
    from: 'Stations already pushed today are listed separately and arrive unselected, so you do not adjust the same head twice.',
    to: 'Stations already pushed today are listed separately and arrive unselected, so you do not adjust the same station twice.' },
  { name: 'station details summary: sprinkler, not head',
    from: 'Expand the row to see what each head actually measured.',
    to: 'Expand the row to see what each sprinkler actually measured.' },
  { name: 'station details tile: no multi-head',
    from: 'Per-sprinkler readings under a multi-head station.',
    to: 'Per-sprinkler readings under a station with more than one sprinkler.' },

  // C5: drop the early black-text caption in Understanding VWC; the gray-italic explanation stays.
  { name: 'understanding vwc: drop the black text caption', pattern: /,\s*caption: 'A current scan: black text, today\\u2019s date\.'/, to: '' },

  // T2 and T4: modeled, gray, color, behavior, centered, recognize.
  { name: 'station zero caption: gray switch',
    from: 'Station 5AP1 is disabled; the switch on its row is grey.',
    to: 'Station 5AP1 is disabled; the switch on its row is gray.' },
  { name: 'station zero caption: modeled value',
    from: 'A modelled value: grey, italic, and dated two days ago.',
    to: 'A modeled value: gray, italic, and dated two days ago.' },
  { name: 'calculation questions caption: modeled value',
    from: 'A modelled value: grey and italic.',
    to: 'A modeled value: gray and italic.' },
  { name: 'map navigation caption: colored',
    from: 'The course, coloured by measured moisture.',
    to: 'The course, colored by measured moisture.' },
  { name: 'map navigation caption: centered',
    from: 'Variance view: three bands, centred on target.',
    to: 'Variance view: three bands, centered on target.' },
  { name: 'map navigation verify: recolor',
    from: 'You can recolour the map by moving a band handle.',
    to: 'You can recolor the map by moving a band handle.' },
  { name: 'understanding vwc caption: modeled',
    from: 'Station 7AP1 has no current scan; the value shown is modelled.',
    to: 'Station 7AP1 has no current scan; the value shown is modeled.' },
  { name: 'understanding vwc verify: modeled',
    from: 'You can tell a measured value from a modelled one without checking the date.',
    to: 'You can tell a measured value from a modeled one without checking the date.' },
  { name: 'understanding vwc tile: modeled',
    from: 'Measured, modelled and target volumetric water content.',
    to: 'Measured, modeled and target volumetric water content.' },
  { name: 'creating profiles summary: recognize',
    from: 'under a name you will recognise next season.',
    to: 'under a name you will recognize next season.' },
  { name: 'station details verify: modeled',
    from: 'You can tell which child readings are modelled.',
    to: 'You can tell which child readings are modeled.' },
];

export function apply(s) {
  let out = s;
  for (const { name, from, pattern, to, expected = 1 } of FIXES) {
    out = edit(out, {
      name: `review fix: ${name}`,
      pattern: pattern ?? exact(from),
      replace: () => to,
      expected,
    });
  }
  return out;
}
