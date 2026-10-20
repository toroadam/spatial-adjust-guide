// Beta content: steps and guides written against develop and the beta environment.
//
// Owner: the beta release epic (see the module map in docs/claims/README.md). No other feature
// edits this file.
//
// What belongs here. Behaviour that exists on develop and the beta environment but not yet in
// production (docs/claims/beta-surfaces.md lists it). A whole new guide is added as a GUIDES entry,
// a TARGETS row and a CATEGORIES tile; a beta step in a GA guide is added next to its neighbours.
// Every addition must also be recorded in src/release.json, as a beta guide or as a beta section of
// a GA guide, so the release gate can remove it from a build with SA_SHOW_BETA=false.
//
// Runs after corrections, changed-surfaces, operational-contract and review-fixes, so it may anchor
// on text any of them produced, and before release-gate, which must see every beta step this module
// adds.
//
// Every edit() is anchored on the exact text it extends and asserts how many times that text
// occurs. A Core Design re-export that moves the anchor then fails the build rather than silently
// dropping the content. The guide catalogues are keyed on exact English, so every new sentence
// needs its translations in all ten locales before it ships.
//
// WHAT IS HERE. One beta step, for the one surface in docs/claims/beta-surfaces.md that the
// reproduction can draw:
//
//   stale-scans-kept -> calculation-questions, a new last step after "If the whole course is stale,
//   check the source". Its figure is the existing map state ('map', default props), whose clear pin
//   for 7AP1 (a station last scanned two days before the others, src/transform-app.mjs 'map markers:
//   a pin scanned before today is drawn clear') is what a beta reader sees for every station of a
//   course that TurfRad has stopped updating. Its cursor target is that pin, measured in the app's
//   1920 x 1080 design space. No new reproduction state is drawn.
//
// The two other beta surfaces, suggestion-held-without-new-scan and scan-day-from-load-time, need a
// figure the reproduction cannot draw (a value that changes over the day; a scan's load time). They
// are beta guide candidates, listed in README.md under Known gaps, and have no guide text here.
//
// WHY THE LAST STEP. Appending after the guide's last step moves no step title and no step number
// that another module or GA sentence anchors on, and a build with SA_SHOW_BETA=false removes it
// without renumbering anything. The prose describes what the reader sees and never says "beta": the
// release gate adds the Beta marker, so releasing the step later is a one-line status change in
// src/release.json and the shipped strings do not change.
//
// Every sentence is checked against develop at bd39f465cf5a7ae0356a59825250b36044085714 in
// docs/claims/guides/calculation-questions.json (claims calculation-questions/6/*). Citations, as
// path:line on develop, with "SAS" for api/Services/SpatialAdjustService.cs and "TRS" for
// api/Services/TerraRadService.cs:
//   - nothing new keeps the scans: SAS:2139-2152 (no deletion, today's adjustments instead),
//     SAS:2575, TRS:104-134 (the "anything new?" question); production deletes them instead
//     (production SAS:2134-2146, :2510, :2817-2836).
//   - stations stay in the table and on the map: SAS:205-208 (only stations with stored scans are
//     listed), sa-dash-map.component.ts:315 and environment.toro-beta.ts:89 (a pin not scanned today
//     is filled transparent), spatial-adjust-course.model.ts:173-188 (current and modelled).
//   - a modelled value and a suggestion every day under Option 2: SAS:3266-3326 (writes today's
//     adjustment once, from the station's last two), sa-algorithm.service.ts:48-49, :62-65.
//   - Request latest scan data looks back two days: SAS:978-992, TRS:114-117, :206-210.
import { edit } from './edit.mjs';

// ---- the steps ----------------------------------------------------------------------------------
//
// `after` is the title of the step the new one follows, as it appears in the export's source,
// escapes included. `surface` is the heading id in docs/claims/beta-surfaces.md, and the id of the
// section in src/release.json that records the step as beta. `target` is the step's cursor target.

export const STEPS = [
  {
    name: 'beta-content: calculation-questions, a stale course keeps its last scans',
    surface: 'stale-scans-kept',
    guide: 'calculation-questions',
    after: 'If the whole course is stale, check the source',
    target: [668, 522],
    step: {
      title: 'A stale course keeps its last scans',
      fig: 'map',
      body: 'When TurfRad has loaded nothing new for a course, Spatial Adjust keeps the course’s last '
        + 'scans, even once they are more than seven days old. The stations stay in the table with their '
        + 'last scan date and on the map as clear pins, and under Option 2 each one still gets a modelled '
        + 'value and a suggestion every day. Request latest scan data looks back only two days, so the '
        + 'scans stay as they are unless TurfRad has loaded new scan data in that time.',
      caption: 'A pin last scanned on an earlier day is drawn clear.',
    },
  },
];

// ---- helpers ------------------------------------------------------------------------------------

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A JS single-quoted string literal, as the export writes them: non-ASCII as \u escapes. */
const literal = (t) => `'${t
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}'`;

/** Index just past the bracket that closes the one at `open`, skipping quoted strings. */
function closeBracket(src, open) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if (pairs[c]) stack.push(pairs[c]);
    else if (c === '}' || c === ']' || c === ')') {
      if (stack.pop() !== c) throw new Error(`beta-content: mismatched "${c}" at offset ${i}`);
      if (stack.length === 0) return i + 1;
    }
  }
  throw new Error('beta-content: unterminated literal');
}

/** Start offsets of the top-level items of the array literal whose `[` is at `open`. */
function itemStarts(src, open) {
  const end = closeBracket(src, open) - 1;
  const starts = [];
  let i = open + 1;
  while (i < end) {
    while (i < end && /[\s,]/.test(src[i])) i++;
    if (i >= end) break;
    starts.push(i);
    if (src[i] === '{' || src[i] === '[') i = closeBracket(src, i);
    else {
      // A call such as cell('vwc', 6) or a member such as P.diagBox: run to the next top-level comma.
      while (i < end && src[i] !== ',') i = '([{'.includes(src[i]) ? closeBracket(src, i) : i + 1;
    }
  }
  return starts;
}

/** The guide key whose block holds offset `at`: the nearest `'<key>': {` line above it. */
function guideAt(src, at) {
  const keys = [...src.slice(0, at).matchAll(/^ {2}'([a-z0-9-]+)': \{$/gm)];
  return keys.length ? keys[keys.length - 1][1] : null;
}

/** The steps array of `guide`: the offset of its `[` and the start offset of each step. */
function stepsOf(src, guide) {
  const opening = `\n  '${guide}': {\n`;
  const at = src.indexOf(opening);
  if (at < 0 || src.indexOf(opening, at + 1) >= 0) {
    throw new Error(`beta-content: expected one GUIDES entry for "${guide}"`);
  }
  const block = at + opening.length - 2;
  const stepsAt = src.indexOf('steps: [', block);
  if (stepsAt < 0 || stepsAt > closeBracket(src, block)) throw new Error(`beta-content: guide "${guide}" has no steps array`);
  const open = stepsAt + 'steps: '.length;
  return { open, starts: itemStarts(src, open) };
}

/**
 * Insert `step` after the step titled `after` in `guide`, and its cursor target at the same index of
 * the guide's TARGETS row. Both insertions are made with edit() against the exact text they extend:
 * the whole neighbouring step literal and the whole TARGETS row, each asserted to occur once.
 */
function insertStep(src, { name, guide, after, step, target }) {
  const opening = `{ title: '${after}',`;
  const at = src.indexOf(opening);
  if (at < 0 || src.indexOf(opening, at + 1) >= 0) {
    throw new Error(`Transform "${name}": expected one step titled "${after}".`);
  }
  if (guideAt(src, at) !== guide) {
    throw new Error(`Transform "${name}": the step "${after}" is in ${guideAt(src, at)}, not ${guide}.`);
  }
  if (src.includes(`{ title: ${literal(step.title)},`)) {
    throw new Error(`Transform "${name}": a step titled "${step.title}" already exists.`);
  }

  // Which step it follows, counted in the guide's own steps array, and that array's length.
  const { starts } = stepsOf(src, guide);
  const index = starts.indexOf(at);
  if (index < 0) throw new Error(`Transform "${name}": "${after}" is not a step of ${guide}.`);

  // The TARGETS row must line up with the steps before the insertion, so the new cell lands at the
  // new step's index and leaves with it in a build without beta content.
  const rowOpening = `'${guide}': [`;
  const rowAt = src.indexOf(rowOpening);
  if (rowAt < 0 || src.indexOf(rowOpening, rowAt + 1) >= 0) {
    throw new Error(`Transform "${name}": expected one TARGETS row for "${guide}".`);
  }
  const rowOpen = rowAt + rowOpening.length - 1;
  const rowEnd = closeBracket(src, rowOpen);
  const cells = itemStarts(src, rowOpen);
  if (cells.length !== starts.length) {
    throw new Error(`Transform "${name}": TARGETS["${guide}"] has ${cells.length} cells for ${starts.length} steps.`);
  }

  // Edit the later text first, so the earlier offsets still hold. Every guide's TARGETS row sits
  // after GUIDES in the export, but nothing here relies on that.
  const stepText = src.slice(at, closeBracket(src, at));
  const stepLiteral = `{ title: ${literal(step.title)}, fig: ${literal(step.fig)},\n`
    + `        body: ${literal(step.body)},\n`
    + `        caption: ${literal(step.caption)} }`;
  const rowText = src.slice(rowAt, rowEnd);
  const cellEnd = index + 1 < cells.length
    ? src.lastIndexOf(',', cells[index + 1]) // the comma that ends the cell the new one follows
    : rowEnd - 1;                            // the closing ]
  const rowWithCell = src.slice(rowAt, cellEnd) + `, [${target.join(', ')}]` + src.slice(cellEnd, rowEnd);

  const edits = [
    { at: rowAt, apply: (s) => edit(s, { name: `${name} (cursor target)`, pattern: new RegExp(escapeRe(rowText)), replace: () => rowWithCell }) },
    { at, apply: (s) => edit(s, { name, pattern: new RegExp(escapeRe(stepText)), replace: () => `${stepText},\n      ${stepLiteral}` }) },
  ].sort((a, b) => b.at - a.at);
  for (const e of edits) src = e.apply(src);
  return src;
}

// ---- the edits ----------------------------------------------------------------------------------

export function apply(s) {
  for (const step of STEPS) s = insertStep(s, step);
  return s;
}
