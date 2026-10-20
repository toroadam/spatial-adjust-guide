// The push window and the Lynx prerequisites, added to every guide that ends in a push.
//
// Owner: feature 5 (add the push window and the Lynx prerequisites to every guide that ends in a
// push). No other feature edits this file. See the module map in docs/claims/README.md.
//
// Runs third, after corrections and changed-surfaces. Additions here anchor on step titles and
// existing before[] and verify[] items, never on body sentences, so they compose with the two
// modules before it.
//
// Every edit() is anchored on the exact text it replaces and asserts how many times that text
// occurs. A Core Design re-export that moves the anchor then fails the build rather than silently
// dropping the change. The guide catalogues are keyed on exact English, so any new or changed
// sentence needs translating into all ten locales.
//
// SOURCE AND GATE. Every rule here comes from Toro user guide 373-1135 rev 02, and
// docs/claims/operational-contract.md records each rule with its section citation. Where the
// document is silent, the rule is a Needs-expert question there. A wrong number here makes a
// superintendent water wrongly while following the guide exactly, so nothing is published from
// memory, the epic request or the PERS notes.
//
// Each published sentence below names its 373-1135 source and the open questions it still
// depends on. apply() publishes only when PUBLISH is true, and it refuses to publish while any
// sentence lacks a source or still has an open question. With PUBLISH false, every edit still runs
// on a throwaway copy, so a moved anchor fails the build now rather than on the day the wording
// is switched on. The page itself is returned unchanged.
import { edit } from './edit.mjs';

/** Switched on only once every sentence below is settled. See operational-contract.md § Publishing. */
export const PUBLISH = false;

// ---- sources ------------------------------------------------------------------------------------

const DOC = '373-1135 rev 02';
const SRC = {
  pushDialog: `${DOC} §Push Changes Dialog Box, p.10`,
  settings: `${DOC} §Settings Configuration, p.1`,
};

/** One published sentence. `rules` and `open` are IDs in docs/claims/operational-contract.md. */
const sentence = (text, { source = null, rules, open = [] }) => ({ text, source, rules, open });
const prose = (sentences) => sentences.map((x) => x.text).join(' ');

// ---- W1: the push window, at the step where the reader presses Push Changes -------------------

export const PUSH_WINDOW = {
  label: 'Push window.',
  sentences: [
    sentence('Push between 11 AM and the synchronisation time set in Lynx, and synchronise Lynx after the push.',
      { source: SRC.pushDialog, rules: ['OC-1', 'OC-3', 'OC-4'], open: ['Q1', 'Q2'] }),
    // 373-1135 gives the window but never says what happens outside it.
    sentence('Outside that window the push does not reach the course, and no error tells you so.',
      { rules: ['OC-5'], open: ['Q3', 'Q4'] }),
  ],
};

// The guides that end in a push, and the step in each where the reader sends. A guide is listed
// when the reader's last action in it is pressing Push Changes or the dialog's footer button.
// Titles are as published, after the edits in src/transform-export.mjs. operational-contract.md
// gives the reason for each entry and for the two candidates that were rejected
// (threshold-questions step 2, target-profiles step 3).
export const PUSH_STEPS = [
  { guide: 'push-to-lynx', step: 5, title: 'Send and watch the progress' },
  { guide: 'reviewing-changes', step: 5, title: 'Trust the footer count' },
  { guide: 'minimum-threshold', step: 5, title: 'Save and confirm at push time' },
  { guide: 'push-failures', step: 4, title: 'Re-push only the failures' },
  // The export titles this step 'It reads Lynx first'. src/transform-export.mjs reorders it.
  { guide: 'verify-results', step: 1, title: 'It writes first, station by station' },
  // Target Profiles ships in production (its guides are labelled New in IntelliDash), and this
  // step is an ordinary push.
  { guide: 'seasonal-profiles', step: 4, title: 'Push once you agree with them' },
];

// ---- W2-W4: the Lynx prerequisites, in Push changes to Lynx under Before you start -------------
//
// Lynx-side settings with no reproduced screen, so they are prose items, not a step or a figure.
// Each gives the setting, where it is set, the required value and what goes wrong otherwise. The
// required values are in 373-1135. The consequences are not, so each consequence is open.

export const PREREQUISITES_AFTER =
  'Stations already pushed today are listed separately and arrive unselected, so you do not adjust the same head twice.';

export const PREREQUISITES = [
  { id: 'W2', sentences: [
    sentence('In Lynx, Site Adjust and Course Adjust must both be 100%.',
      { source: SRC.settings, rules: ['OC-6'] }),
    sentence('Any other value is applied on top of every percentage you push, so the whole course waters more or less than the dashboard shows, and nothing reports an error.',
      { rules: ['OC-6'], open: ['Q5'] }),
  ] },
  { id: 'W3', sentences: [
    sentence('In the Lynx watering plan, Pct. Adjust must be 100 on the program and on every hole under it that you have enabled in Spatial Adjust, for example Fairways and 2-Fairways.',
      { source: SRC.settings, rules: ['OC-7'] }),
    sentence('Any other value is applied on top of the percentages you push to the stations under it, again without an error.',
      { rules: ['OC-7'], open: ['Q6'] }),
  ] },
  { id: 'W4', sentences: [
    sentence('In the same program, Next Amt. must equal the Lynx Reference Amount under Settings › Calculation, in the same units.',
      { source: SRC.settings, rules: ['OC-8'] }),
    // The first clause is in 373-1135 (the Daily Max worked example) and in the product. What
    // Lynx does with a mismatch is not.
    sentence('Every suggestion is a percentage of that reference amount, so a mismatch scales what each station receives by the ratio between the two, again without an error.',
      { rules: ['OC-8'], open: ['Q7'] }),
  ] },
];

// ---- W5: one cross-reference in every guide the prerequisites gate -----------------------------
//
// A pointer, not a copy, so the prerequisites live in one place. The same string in every guide,
// so each locale translates it once. "Push changes to Lynx" is that guide's title, and its
// translation has to match the translated title.

export const CROSS_REFERENCE = {
  id: 'W5',
  sentences: [
    sentence('Lynx itself must be set up to match Spatial Adjust.',
      { source: SRC.settings, rules: ['OC-6', 'OC-7', 'OC-8'] }),
    sentence('Push changes to Lynx lists the settings under Before you start.',
      { source: SRC.settings, rules: ['OC-6', 'OC-7', 'OC-8'] }),
  ],
};

// The guides that end in a push, plus the two whose numbers mean nothing if Lynx is set up wrongly.
// Each item is appended after the guide's last existing before[] item, named here exactly.
export const GATED_GUIDES = [
  { guide: 'reviewing-changes',
    after: 'Everything in the dialog is still reversible. Nothing is written until you use the footer button.' },
  { guide: 'minimum-threshold', after: 'Setting the percentage to 0 disables the feature entirely.' },
  { guide: 'push-failures',
    after: 'By the time you see a failure, Spatial Adjust has already retried the affected stations twice.' },
  { guide: 'verify-results',
    after: 'Verification is automatic. You do not have to check Lynx by hand to know whether a push landed.' },
  { guide: 'seasonal-profiles',
    after: 'Applying a profile is a course-wide recalculation, so treat it as a planned change rather than a quick switch.' },
  { guide: 'calculation-settings', after: 'Changing any of them recalculates every suggestion and reloads the dashboard.' },
  { guide: 'suggested-adjustments',
    after: 'A station with no current scan and no model estimate shows a dash rather than a number.' },
];

// ---- helpers ------------------------------------------------------------------------------------

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A JS single-quoted string literal, as the export writes them. */
const literal = (t) => `'${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Index just past the brace that closes the one at `open`, skipping quoted strings. */
function closeBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  throw new Error('unterminated step object');
}

/** Fail if a step ends up with two callouts, which would silently drop one of them. */
function assertOneCallout(s, title) {
  const open = s.lastIndexOf('{', s.indexOf(`title: ${literal(title)}`));
  const step = s.slice(open, closeBrace(s, open));
  const tips = (step.match(/\btip:\s*['"`]/g) || []).length;
  const labels = (step.match(/\btipLabel:\s*['"`]/g) || []).length;
  if (tips !== 1 || labels !== 1) {
    throw new Error(
      `operational-contract: step "${title}" has ${tips} tip(s) and ${labels} tipLabel(s) after the\n` +
      `  push-window callout was added. Another module has given this step its own tip. Combine the\n` +
      `  two into one callout here, keeping the other tip's meaning, rather than letting one overwrite\n` +
      `  the other.`,
    );
  }
}

// ---- the edits ----------------------------------------------------------------------------------

/** Every edit, applied whatever PUBLISH says. apply() decides whether the result ships. */
export function draft(src) {
  let s = src;
  const tip = prose(PUSH_WINDOW.sentences);
  for (const { guide, step, title } of PUSH_STEPS) {
    s = edit(s, {
      name: `push window: ${guide} step ${step}`,
      pattern: new RegExp(escapeRe(`title: ${literal(title)}`)),
      replace: (m) => `${m}, tipLabel: ${literal(PUSH_WINDOW.label)}, tip: ${literal(tip)}`,
    });
    assertOneCallout(s, title);
  }

  // Appending right after the anchor's closing quote works whether the anchor ends its list or
  // another module (changed-surfaces runs earlier) has already appended an item after it.
  const appendAfter = (name, after, items) => edit(s, {
    name,
    pattern: new RegExp(escapeRe(literal(after))),
    replace: (m) => [m, ...items.map(literal)].join(', '),
  });
  s = appendAfter('Lynx prerequisites: push-to-lynx before', PREREQUISITES_AFTER,
    PREREQUISITES.map((p) => prose(p.sentences)));
  for (const { guide, after } of GATED_GUIDES) {
    s = appendAfter(`Lynx prerequisites cross-reference: ${guide} before`, after,
      [prose(CROSS_REFERENCE.sentences)]);
  }
  return s;
}

/** Sentences that may not be published yet: no 373-1135 source, or an open expert question. */
export function unsettled() {
  return [PUSH_WINDOW, ...PREREQUISITES, CROSS_REFERENCE]
    .flatMap((part) => part.sentences)
    .filter((x) => !x.source || x.open.length);
}

export function apply(s) {
  const drafted = draft(s);
  if (!PUBLISH) return s;
  const pending = unsettled();
  if (pending.length) {
    throw new Error(
      `operational-contract: PUBLISH is true but ${pending.length} sentence(s) are not settled:\n` +
      pending.map((x) => `  - ${x.text}\n    source: ${x.source ?? 'none'}; open: ${x.open.join(', ') || 'none'}`).join('\n') +
      `\n  Record the answers in docs/claims/operational-contract.md first.`,
    );
  }
  return drafted;
}
