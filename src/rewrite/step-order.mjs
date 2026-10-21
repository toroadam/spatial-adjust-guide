// Adding and moving whole steps, for the rewrites that need a step the export does not have.
//
// h.editStep rewrites the fields of one step in place, which covers almost every rewrite. A few
// guides need a step that is not there at all, because the export never told the reader to press
// the button that saves what they just changed (Save in the Soil Factor Editor, Save Changes in
// Over/Under Options and in Settings), or a step that sits after the one it depends on. These two
// helpers do that through h.edit, so they keep its guarantee: the exact text they anchor on must
// occur exactly once in the page, or the build fails naming the transform.
//
// A step is found by its opening `{ title: '<Title>'`, which must be unique in the whole page, not
// only in its guide. An inserted step starts as a bare literal (title and figure fields only) and
// is filled in afterwards with h.editStep, so its strings go through the same escaping as every
// other rewrite. Whenever a guide gains or reorders a step, its TARGETS entry is re-authored in the
// same module with h.editTargets (docs/writing-guide.md > Cursor targets).

/** The text as a pattern that matches it exactly. */
const exactly = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/** Index just past the object or array literal that opens at `open`, skipping quoted strings. */
function literalEnd(src, open, name) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error(`Transform "${name}": the step literal never closes.`);
}

/** The exact source text of the step titled `title`, which must open exactly once in the page. */
function stepText(src, title, name) {
  const needle = `{ title: '${title}'`;
  const open = src.indexOf(needle);
  if (open === -1 || src.indexOf(needle, open + 1) !== -1) {
    throw new Error(`Transform "${name}": expected the step "${title}" exactly once in the page.`);
  }
  return src.slice(open, literalEnd(src, open, name));
}

/** Inserts `literal`, the source text of a new step, straight after the step titled `after`. */
export function insertStepAfter(src, h, { name, after, literal }) {
  const anchor = stepText(src, after, name);
  return h.edit(src, { name, pattern: exactly(anchor), replace: () => `${anchor},\n      ${literal}` });
}

/** Moves the step titled `title` so that it sits straight before the step titled `before`. */
export function moveStepBefore(src, h, { name, title, before }) {
  const moved = stepText(src, title, name);
  // Out of its old place, with the separator in front of it, which every step but the first has.
  let s = h.edit(src, { name, pattern: new RegExp(`,\\s*${exactly(moved).source}`), replace: () => '' });
  const target = `{ title: '${before}'`;
  s = h.edit(s, { name, pattern: exactly(target), replace: () => `${moved},\n      ${target}` });
  return s;
}
