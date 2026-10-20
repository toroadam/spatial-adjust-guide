// Scores every step on the Flesch-Kincaid grade scale and fails a rewritten guide with a step above
// grade 8 (docs/writing-guide.md > Readability). Reads the published guide data through
// scripts/lib/load-guides.mjs, so no browser is needed.
//
// What is scored. Per step: do, see, ifNot and why, plus body while a step still has one, joined
// with spaces. The [[ and ]] of a label marker are removed and the label's words are kept, since
// the reader has to read them. Only English is scored: Flesch-Kincaid is an English measure.
//
// The formula:
//   grade = 0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59
//
// The counting rules are deliberately simple and need no dependency:
//   - Sentences end at . ! or ? (optionally followed by a closing quote or bracket) that is
//     followed by whitespace or the end of the text. Text with no end mark is one sentence.
//     An abbreviation such as "% Adj." therefore ends a sentence, which lowers the score a little.
//   - Words are whitespace-separated tokens that contain a letter or a digit. "%" and "—" on their
//     own are not words.
//   - Syllables: the groups of consecutive vowels (a e i o u y), less one for a silent final "e"
//     (but not "-le"), with at least 1 per word. A hyphenated token is counted part by part.
//     An all-capitals token of 2 to 5 letters is spoken as letters, so it counts one syllable per
//     letter and 3 for W: "ET" is 2 and "VWC" is 5. A number or percentage ("10", "12%", "0–50")
//     is one word of one syllable.
// The heuristic miscounts some words ("dialog" 2, "calculates" 4). --selftest checks it against
// four reference texts whose syllables were counted by hand.
//
// The ratchet. A guide in PENDING (scripts/lib/rewrite-status.mjs) has not been rewritten yet: its
// steps are scored and reported as advisory, never failed. The command exits 1 only when a step
// of a guide that is not pending scores above 8.0.
//
// Usage:
//   node scripts/readability.mjs              the 10 hardest steps; exit 1 on a failing rewritten step
//   node scripts/readability.mjs --selftest   check the scorer against the reference texts
//   node scripts/readability.mjs --json       print every step's score
import { pathToFileURL } from 'node:url';

export const MAX_GRADE = 8.0;
const SCORED_FIELDS = ['do', 'see', 'ifNot', 'why', 'body'];

/** The text of one step that is scored, with label markers stripped. */
export function stepText(step) {
  return SCORED_FIELDS
    .map((f) => step[f])
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ')
    .replace(/\[\[|\]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const hasWordChar = (t) => /[\p{L}\p{N}]/u.test(t);
const trimPunct = (t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

/** Syllables in one part of a word, with no hyphen in it. */
function partSyllables(part) {
  const core = trimPunct(part.replace(/[’']/g, ''));
  if (!/\p{L}/u.test(core)) return 1; // a number or a percentage
  if (core.length >= 2 && core.length <= 5 && /^[A-Z]+$/.test(core)) {
    return [...core].reduce((n, ch) => n + (ch === 'W' ? 3 : 1), 0);
  }
  const word = core.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 1;
  let n = (word.match(/[aeiouy]+/g) || []).length;
  if (word.endsWith('e') && !word.endsWith('le')) n -= 1;
  return Math.max(1, n);
}

/** Syllables in one word token. */
export function syllables(token) {
  return token.split(/[-‐–—/]/).filter(hasWordChar).reduce((n, p) => n + partSyllables(p), 0) || 1;
}

/** { words, sentences, syllables, grade } for a text. grade is null when there are no words. */
export function score(text) {
  const words = text.split(/\s+/).filter(hasWordChar);
  if (!words.length) return { words: 0, sentences: 0, syllables: 0, grade: null };
  const sentences = Math.max(1, text.split(/[.!?]+["'”’)\]]*(?=\s|$)/).filter(hasWordChar).length);
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
  return { words: words.length, sentences, syllables: syl, grade };
}

/** Scores every step of every guide in `data` (as returned by loadGuides). */
export function scoreGuides(data, { pending = new Set(), isPending = (k, p) => p.has(k) } = {}) {
  const keys = data.keys || Object.keys(data.GUIDES);
  const steps = [];
  for (const key of keys) {
    const pend = isPending(key, pending);
    (data.GUIDES[key].steps || []).forEach((step, i) => {
      const s = score(stepText(step));
      steps.push({ guide: key, step: i + 1, pending: pend, ...s,
        fails: !pend && s.grade !== null && s.grade > MAX_GRADE });
    });
  }
  return steps;
}

// ---- self-test --------------------------------------------------------------------------------
// Each reference carries its hand count: words, sentences and syllables as a dictionary splits
// them, with the two conventions above (a number is one syllable, VWC is five). The expected grade
// is the formula applied to the hand count; the scorer passes when it lands within 0.6 of it.
const REFERENCES = [
  { text: 'The cat sat on the mat.', words: 6, sentences: 1, syllables: 6 },
  { text: 'Select Save Changes. The window closes and the table shows the new number.',
    words: 13, sentences: 2, syllables: 19 },
  { text: 'Spatial Adjust uses the moisture reading from each station to work out a suggested '
      + 'adjustment, and it sends the result to Lynx when you push.',
    words: 25, sentences: 1, syllables: 36 },
  { text: 'Type 10 in the box. A station at 12% VWC is lower than its target.',
    words: 15, sentences: 2, syllables: 22 },
];
const TOLERANCE = 0.6;

export function selftest() {
  let ok = true;
  for (const ref of REFERENCES) {
    const expected = 0.39 * (ref.words / ref.sentences) + 11.8 * (ref.syllables / ref.words) - 15.59;
    const got = score(ref.text);
    const pass = Math.abs(got.grade - expected) <= TOLERANCE;
    ok &&= pass;
    console.log(`${pass ? 'PASS' : 'FAIL'}  expected ${expected.toFixed(2)}, scored ${got.grade.toFixed(2)} `
      + `(${got.words} words, ${got.sentences} sentences, ${got.syllables} syllables)  ${ref.text}`);
  }
  console.log(ok ? '\nSelf-test passed.' : `\nSelf-test FAILED: a reference is more than ${TOLERANCE} from its expected grade.`);
  return ok;
}

// ---- CLI --------------------------------------------------------------------------------------

function report(steps) {
  const scored = steps.filter((s) => s.grade !== null);
  const hardest = [...scored].sort((a, b) => b.grade - a.grade).slice(0, 10);
  console.log('Flesch-Kincaid grade per step (do, see, ifNot, why and any remaining body; English only).');
  console.log(`\nThe 10 hardest steps:\n  Grade  Step  Guide`);
  for (const s of hardest) {
    console.log(`  ${s.grade.toFixed(1).padStart(5)}  ${String(s.step).padStart(4)}  ${s.guide}${s.pending ? ' (pending)' : ''}`);
  }

  const rewritten = scored.filter((s) => !s.pending);
  const failing = rewritten.filter((s) => s.fails);
  const pend = scored.filter((s) => s.pending);
  const pendOver = pend.filter((s) => s.grade > MAX_GRADE);
  if (failing.length) {
    console.log(`\nAbove grade ${MAX_GRADE.toFixed(1)} in rewritten guides:`);
    for (const s of failing) console.log(`  FAIL  ${s.guide} step ${s.step}: grade ${s.grade.toFixed(1)}`);
  }
  console.log(`\nRewritten guides: ${rewritten.length} step(s) scored, ${failing.length} above grade ${MAX_GRADE.toFixed(1)}.`);
  console.log(`Pending guides (advisory): ${pendOver.length} of ${pend.length} step(s) above grade ${MAX_GRADE.toFixed(1)}.`);
  const unscored = steps.length - scored.length;
  if (unscored) console.log(`warning: ${unscored} step(s) have no text to score.`);
  return failing.length === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    process.exitCode = selftest() ? 0 : 1;
  } else {
    // Imported here rather than at the top, so --selftest runs without the export or the transform.
    const { loadGuides } = await import('./lib/load-guides.mjs');
    const { PENDING, isPending } = await import('./lib/rewrite-status.mjs');
    const steps = scoreGuides(loadGuides(), { pending: PENDING, isPending });
    if (args.includes('--json')) {
      console.log(JSON.stringify(steps, null, 2));
      process.exitCode = steps.some((s) => s.fails) ? 1 : 0;
    } else {
      process.exitCode = report(steps) ? 0 : 1;
    }
  }
}
