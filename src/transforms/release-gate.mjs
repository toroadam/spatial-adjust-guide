// The release gate: removes beta content from a build with SA_SHOW_BETA=false.
//
// Owner: the beta release epic (see the module map in docs/claims/README.md). No other feature
// edits this file.
//
// Runs last of every transform, after beta-content, so it sees every guide and step that any
// module added. src/release.json says which guides are beta and which steps of a GA guide are beta
// (src/release.mjs reads and validates it). With showBeta true this module only validates the
// release file against the guides and returns the export unchanged. With showBeta false it deletes,
// from the guide data in the export:
//
//   - each beta guide's entry in GUIDES (`const GUIDES = {` and every `Object.assign(GUIDES, {`),
//   - each beta guide's cursor-target row in TARGETS (`const TARGETS = {` and `Object.assign(TARGETS, {`),
//   - each beta guide's tile in CATEGORIES, and any category left with no tiles,
//   - each beta step of a GA guide, with the TARGETS cell at the same index,
//   - every beta key in the `next` list of the guides that remain.
//
// How. The export holds the guide data as a JavaScript object literal inside an inline script, so
// the work is text surgery on that literal. The data is first evaluated in node:vm to decide what
// to remove. Each removal then finds its target by walking the literal's brackets (skipping strings
// and comments), asserts it found exactly one, and cuts it out together with its separating comma.
// Finally the data is evaluated again, and the result is compared with what was expected. A build
// with SA_SHOW_BETA=false is what customers get, so every check fails closed: anything unexpected
// stops the build with a message that names the string and where it is.
//
// No third-party imports, and nothing from scripts/: src/ must build on its own.
import vm from 'node:vm';
import { validateRelease, betaSteps } from '../release.mjs';

const fail = (message) => { throw new Error(`release-gate: ${message}`); };

// ---- reading JavaScript source --------------------------------------------------------------------

const CLOSE = { '{': '}', '[': ']', '(': ')' };

/** Index just past the string literal that opens at `i` (a quote or a backtick). */
function skipQuoted(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { j++; continue; }
    if (q === '`' && c === '$' && src[j + 1] === '{') { j = closeBracket(src, j + 1) - 1; continue; }
    if (c === q) return j + 1;
    if (q !== '`' && c === '\n') fail(`unterminated string literal at offset ${i}`);
  }
  return fail(`unterminated string literal at offset ${i}`);
}

/** Index just past the comment that opens at `i`, or -1 when no comment opens there. */
function skipComment(src, i) {
  if (src[i] !== '/') return -1;
  if (src[i + 1] === '/') { const n = src.indexOf('\n', i); return n < 0 ? src.length : n + 1; }
  if (src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); if (n < 0) fail(`unterminated comment at offset ${i}`); return n + 2; }
  return -1;
}

/** Index of the next character at or after `i` that is neither whitespace nor inside a comment. */
function skipSpace(src, i) {
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    const k = skipComment(src, i);
    if (k < 0) return i;
    i = k;
  }
  return i;
}

/** Index just past the bracket that closes the one at `open`, skipping strings and comments. */
function closeBracket(src, open) {
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipQuoted(src, i) - 1; continue; }
    const k = skipComment(src, i);
    if (k >= 0) { i = k - 1; continue; }
    if (CLOSE[c]) stack.push(CLOSE[c]);
    else if (c === '}' || c === ']' || c === ')') {
      if (stack.pop() !== c) fail(`unbalanced "${c}" at offset ${i}`);
      if (!stack.length) return i + 1;
    }
  }
  return fail(`unterminated bracket at offset ${open}`);
}

/**
 * The top-level items of the object or array literal whose bracket is at `open`. Each item is
 * { start, end, next }: `start` and `end` bound the item's text without surrounding whitespace, and
 * `next` is where the following token starts after the item's comma (null when it has none).
 */
function itemsOf(src, open) {
  const closer = CLOSE[src[open]];
  if (closer !== '}' && closer !== ']') fail(`expected an object or array literal at offset ${open}`);
  const items = [];
  let i = open + 1;
  for (;;) {
    i = skipSpace(src, i);
    if (i >= src.length) fail(`unterminated literal at offset ${open}`);
    if (src[i] === closer) return { items, close: i + 1 };
    const start = i;
    let end = i;
    for (;;) {
      if (i >= src.length) fail(`unterminated literal at offset ${open}`);
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') { i = skipQuoted(src, i); end = i; continue; }
      const k = skipComment(src, i);
      if (k >= 0) { i = k; continue; }
      if (CLOSE[c]) { i = closeBracket(src, i); end = i; continue; }
      if (c === ',' || c === closer) break;
      if (c === '}' || c === ']' || c === ')') fail(`unbalanced "${c}" at offset ${i}`);
      if (!/\s/.test(c)) end = i + 1;
      i++;
    }
    const item = { start, end, next: null };
    items.push(item);
    if (src[i] === ',') { i++; item.next = skipSpace(src, i); }
  }
}

/** Remove item `j` of `items` from `src`, with the comma that separates it from its neighbour. */
function cutItem(src, items, j) {
  const it = items[j];
  if (j < items.length - 1) return src.slice(0, it.start) + src.slice(items[j + 1].start);
  if (j > 0) return src.slice(0, items[j - 1].end) + src.slice(it.end);
  // The only item. Its trailing comma, if any, goes with it.
  return src.slice(0, it.start) + src.slice(it.next !== null ? it.next : it.end);
}

const KEY_RE = /^(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|([A-Za-z_$][\w$]*))\s*:\s*/;
const STRING_RE = /^(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")$/;

/** The value of a single- or double-quoted string literal, evaluated rather than unescaped by hand. */
function decodeString(literal) {
  if (!STRING_RE.test(literal)) fail(`expected a plain string literal, found ${literal.slice(0, 80)}`);
  return vm.runInNewContext(literal, {}, { timeout: 1000 });
}

/** Parse an object item `key: value`. Returns { key, valueStart } or null for a spread or method. */
function memberOf(src, item) {
  const m = KEY_RE.exec(src.slice(item.start, item.end));
  if (!m) return null;
  const key = m[3] !== undefined ? m[3] : decodeString(m[1] !== undefined ? `'${m[1]}'` : `"${m[2]}"`);
  return { key, valueStart: item.start + m[0].length };
}

/** The object literal's member called `name`, as { item, index, valueStart }, or null. */
function memberNamed(src, open, name) {
  const { items } = itemsOf(src, open);
  const found = [];
  items.forEach((item, index) => {
    const m = memberOf(src, item);
    if (m && m.key === name) found.push({ item, index, valueStart: m.valueStart });
  });
  if (found.length > 1) fail(`the object at offset ${open} names "${name}" ${found.length} times`);
  return found[0] || null;
}

/** Offset of the only occurrence of `needle` in `src`; fails on none or several. */
function only(src, needle, what) {
  const at = src.indexOf(needle);
  if (at < 0 || src.indexOf(needle, at + 1) >= 0) {
    fail(`expected exactly one ${what} (${JSON.stringify(needle)}) in the guide data script, found ${at < 0 ? 0 : 'several'}`);
  }
  return at;
}

/** Offset of every occurrence of `needle` in `src`. */
function every(src, needle) {
  const out = [];
  for (let at = src.indexOf(needle); at >= 0; at = src.indexOf(needle, at + 1)) out.push(at);
  return out;
}

// ---- the guide data -------------------------------------------------------------------------------

/** The inline script that holds the guide data, as { start, end } offsets of its body in `s`. */
function dataScript(s) {
  const found = [];
  for (const m of s.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)) {
    if (m[2].includes('const GUIDES = {')) found.push({ start: m.index + m[1].length, end: m.index + m[1].length + m[2].length });
  }
  if (found.length !== 1) fail(`expected one inline script holding "const GUIDES = {", found ${found.length}`);
  return found[0];
}

/**
 * Evaluate the guide data in the export `s`. Returns plain copies of GUIDES, TARGETS and CATEGORIES,
 * built by running the export's own data block in node:vm, the way scripts/claims-extract.mjs does.
 */
export function evaluateGuideData(s) {
  const { start, end } = dataScript(s);
  const script = s.slice(start, end);
  const from = only(script, 'const P = {', 'P declaration');
  const catAt = only(script, 'const CATEGORIES = [', 'CATEGORIES declaration');
  let to = closeBracket(script, catAt + 'const CATEGORIES = '.length);
  if (script[to] === ';') to++;
  // The block references one helper declared above `const P`. cell() builds cursor coordinates;
  // a stub that keeps its arguments is enough to compare TARGETS rows before and after.
  const sandbox = { cell: (column, row) => ['cell', column, row] };
  let out;
  try {
    out = vm.runInNewContext(`${script.slice(from, to)}\n;({ GUIDES, TARGETS, CATEGORIES })`, sandbox,
      { filename: 'guide-data', timeout: 5000 });
  } catch (err) {
    fail(`the guide data does not evaluate: ${err.message}`);
  }
  return JSON.parse(JSON.stringify(out));
}

/** Offsets of the `{` of `const NAME = {` and of every `Object.assign(NAME, {`. */
function objectOpenings(script, name) {
  const declared = `const ${name} = {`;
  const assigned = `Object.assign(${name}, {`;
  return [only(script, declared, `${name} declaration`) + declared.length - 1]
    .concat(every(script, assigned).map((at) => at + assigned.length - 1));
}

/** Every `key: value` entry of GUIDES or TARGETS whose key is `key`, across all its literals. */
function entriesNamed(script, name, key) {
  const out = [];
  for (const open of objectOpenings(script, name)) {
    const { items } = itemsOf(script, open);
    items.forEach((item, index) => {
      const m = memberOf(script, item);
      if (m && m.key === key) out.push({ items, index, valueStart: m.valueStart });
    });
  }
  return out;
}

/** The one GUIDES entry for `key`: an object literal with a `category:` member. */
function guideEntry(script, key) {
  const found = entriesNamed(script, 'GUIDES', key);
  if (found.length !== 1) fail(`expected one GUIDES entry for "${key}", found ${found.length}`);
  const entry = found[0];
  if (script[entry.valueStart] !== '{' || !memberNamed(script, entry.valueStart, 'category')) {
    fail(`the GUIDES entry for "${key}" is not an object literal with a category: member`);
  }
  return entry;
}

/** The TARGETS row for `key` (an array literal), or null when the guide has none. */
function targetsRow(script, key) {
  const found = entriesNamed(script, 'TARGETS', key);
  if (found.length > 1) fail(`expected at most one TARGETS row for "${key}", found ${found.length}`);
  if (!found.length) return null;
  if (script[found[0].valueStart] !== '[') fail(`the TARGETS row for "${key}" is not an array literal`);
  return found[0];
}

/** The `[` of the array member `name` of the object literal at `open`, or null when absent. */
function arrayMember(script, open, name, what) {
  const m = memberNamed(script, open, name);
  if (!m) return null;
  if (script[m.valueStart] !== '[') fail(`${what} "${name}" is not an array literal`);
  return m.valueStart;
}

// ---- the removals ---------------------------------------------------------------------------------

function removeGuideEntry(script, key) {
  const { items, index } = guideEntry(script, key);
  return cutItem(script, items, index);
}

function removeTargetsRow(script, key) {
  const row = targetsRow(script, key);
  return row ? cutItem(script, row.items, row.index) : script;
}

/** Remove the tiles whose key is in `keys`, then any category left with no tiles. */
function removeTiles(script, keys) {
  const catOpen = only(script, 'const CATEGORIES = [', 'CATEGORIES declaration') + 'const CATEGORIES = '.length;
  const tilesAt = () => {
    const out = [];
    itemsOf(script, catOpen).items.forEach((category, ci) => {
      if (script[category.start] !== '{') fail(`category ${ci + 1} in CATEGORIES is not an object literal`);
      const tasks = arrayMember(script, category.start, 'tasks', `category ${ci + 1}`);
      if (tasks === null) fail(`category ${ci + 1} in CATEGORIES has no tasks array`);
      const { items } = itemsOf(script, tasks);
      items.forEach((tile, ti) => {
        if (script[tile.start] !== '{') fail(`tile ${ti + 1} of category ${ci + 1} is not an object literal`);
        const k = memberNamed(script, tile.start, 'key');
        if (!k) fail(`tile ${ti + 1} of category ${ci + 1} has no key`);
        out.push({ key: decodeString(script.slice(k.valueStart, k.item.end)), items, index: ti });
      });
    });
    return out;
  };
  for (const key of keys) {
    const found = tilesAt().filter((t) => t.key === key);
    if (found.length !== 1) fail(`expected one CATEGORIES tile for "${key}", found ${found.length}`);
    script = cutItem(script, found[0].items, found[0].index);
  }
  // Drop each category whose tasks array is now empty, last first so earlier offsets hold.
  for (;;) {
    const { items } = itemsOf(script, catOpen);
    const empty = items.findLastIndex((category) => {
      const tasks = arrayMember(script, category.start, 'tasks', 'category');
      return itemsOf(script, tasks).items.length === 0;
    });
    if (empty < 0) return script;
    script = cutItem(script, items, empty);
  }
}

/**
 * Remove the steps at `indexes` from guide `key`, and the TARGETS cells at the same indexes.
 * `titles` are the evaluated titles of every step, which the source items must match one for one.
 */
function removeSteps(script, key, indexes, titles) {
  const { valueStart } = guideEntry(script, key);
  const stepsOpen = arrayMember(script, valueStart, 'steps', `guide "${key}"`);
  if (stepsOpen === null) fail(`guide "${key}" has no steps array`);
  const steps = itemsOf(script, stepsOpen).items;
  if (steps.length !== titles.length) {
    fail(`guide "${key}" has ${steps.length} step literals but evaluates to ${titles.length} steps; `
      + 'its steps are built some other way, so they cannot be removed by position');
  }
  const row = targetsRow(script, key);
  if (row) {
    const cells = itemsOf(script, row.valueStart).items.length;
    if (cells !== titles.length) {
      fail(`TARGETS["${key}"] has ${cells} cells but GUIDES["${key}"].steps has ${titles.length} steps; `
        + 'line them up before marking one of its steps beta, so each cursor target leaves with its step');
    }
  }
  for (const i of indexes) {
    const step = steps[i];
    if (script[step.start] !== '{') fail(`step ${i + 1} of guide "${key}" is not an object literal`);
    const t = memberNamed(script, step.start, 'title');
    if (!t || decodeString(script.slice(t.valueStart, t.item.end)) !== titles[i]) {
      fail(`step ${i + 1} of guide "${key}" in the source is not the step titled ${JSON.stringify(titles[i])}`);
    }
  }
  const descending = [...indexes].sort((a, b) => b - a);
  for (const i of descending) {
    const { valueStart: v } = guideEntry(script, key);
    const open = arrayMember(script, v, 'steps', `guide "${key}"`);
    script = cutItem(script, itemsOf(script, open).items, i);
  }
  if (row) {
    for (const i of descending) {
      const r = targetsRow(script, key);
      script = cutItem(script, itemsOf(script, r.valueStart).items, i);
    }
  }
  return script;
}

/** Remove every key in `keys` from the `next` list of every guide that remains. */
function removeNextReferences(script, keys) {
  const drop = new Set(keys);
  // Literals, guides and references are all visited last first, so a cut never moves anything
  // still to be visited.
  for (const open of objectOpenings(script, 'GUIDES').sort((a, b) => b - a)) {
    const guides = itemsOf(script, open).items;
    for (let g = guides.length - 1; g >= 0; g--) {
      const m = memberOf(script, guides[g]);
      if (!m || script[m.valueStart] !== '{') continue;
      const next = arrayMember(script, m.valueStart, 'next', `guide "${m.key}"`);
      if (next === null) continue;
      const refs = itemsOf(script, next).items;
      for (let r = refs.length - 1; r >= 0; r--) {
        const key = decodeString(script.slice(refs[r].start, refs[r].end));
        if (drop.has(key)) script = cutItem(script, refs, r);
      }
    }
  }
  return script;
}

// ---- what is beta ---------------------------------------------------------------------------------

/**
 * Decide what a build with SA_SHOW_BETA=false removes. Returns { betaGuides, betaStepsByGuide }:
 * the beta guide keys in catalogue order, and for each GA guide that holds beta steps, the step
 * titles and their indexes. A GA guide must keep at least one step.
 */
export function planRemoval(release, data) {
  const keys = Object.keys(data.GUIDES);
  const betaGuides = keys.filter((k) => release.guides[k].status === 'beta');
  const betaStepsByGuide = {};
  for (const key of keys) {
    if (release.guides[key].status !== 'ga') continue;
    const titles = betaSteps(release, key);
    if (!titles.length) continue;
    const all = data.GUIDES[key].steps.map((s) => s.title);
    const indexes = titles.map((t) => all.indexOf(t)).sort((a, b) => a - b);
    if (indexes.length === all.length) {
      fail(`every step of GA guide "${key}" is beta; mark the guide beta instead`);
    }
    betaStepsByGuide[key] = { titles, indexes };
  }
  return { betaGuides, betaStepsByGuide };
}

// ---- proving the result ---------------------------------------------------------------------------

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tilesOf = (data) => data.CATEGORIES.flatMap((c) => c.tasks);

/** The ways a string can be written in the export: as is, \u-escaped, and with ' escaped. */
function spellings(text) {
  const esc = (t, upper) => t.replace(/[^\x00-\x7f]/g, (c) => {
    const hex = c.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${upper ? hex.toUpperCase() : hex}`;
  });
  const out = new Set();
  for (const t of [text, esc(text, false), esc(text, true)]) {
    out.add(t);
    out.add(t.replace(/'/g, "\\'"));
  }
  return [...out];
}

/** Every offset where `needle` occurs in `s` and is not part of a longer guide key. */
function keyHits(s, needle) {
  return every(s, needle).filter((at) => !/[a-z0-9-]/.test(s[at + needle.length] || ''));
}

/** Fail on any beta key, beta title or beta step title still anywhere in the export. */
function assertNothingLeft(s, { keys, titles }) {
  const found = [];
  const context = (at, n) => JSON.stringify(s.slice(Math.max(0, at - 40), at + n + 40));
  for (const key of keys) {
    for (const needle of [`'${key}'`, `"${key}"`]) {
      for (const at of every(s, needle)) found.push(`guide key ${needle} at offset ${at}: ${context(at, needle.length)}`);
    }
    for (const at of keyHits(s, `#/${key}`)) found.push(`guide link #/${key} at offset ${at}: ${context(at, key.length + 2)}`);
  }
  for (const title of titles) {
    for (const needle of spellings(title)) {
      for (const at of every(s, needle)) found.push(`beta title ${JSON.stringify(title)} at offset ${at}: ${context(at, needle.length)}`);
    }
  }
  if (found.length) {
    fail(`beta content is still in the export after removal (${found.length}). Add a targeted removal `
      + `for each, for example in the hard-coded showProfilesTab key list in renderVals:\n- ${found.join('\n- ')}`);
  }
}

/** Compare the guide data after removal with what removing exactly the planned items should give. */
function assertRemoved(before, after, plan) {
  const beta = new Set(plan.betaGuides);
  const problems = [];
  const expectKeys = (what, b, a) => {
    const want = b.filter((k) => !beta.has(k));
    if (!same(a, want)) problems.push(`${what} keys are ${JSON.stringify(a)}; expected ${JSON.stringify(want)}`);
  };
  expectKeys('GUIDES', Object.keys(before.GUIDES), Object.keys(after.GUIDES));
  expectKeys('TARGETS', Object.keys(before.TARGETS), Object.keys(after.TARGETS));
  expectKeys('tile', tilesOf(before).map((t) => t.key), tilesOf(after).map((t) => t.key));

  const guideKeys = Object.keys(after.GUIDES);
  const tiles = tilesOf(after);
  if (tiles.length !== guideKeys.length) problems.push(`${tiles.length} tiles for ${guideKeys.length} GA guides`);
  for (const k of guideKeys) if (!tiles.some((t) => t.key === k)) problems.push(`GA guide "${k}" has no tile`);
  for (const c of after.CATEGORIES) if (!c.tasks.length) problems.push(`category "${c.title}" has no tiles`);
  const keptCategories = before.CATEGORIES.filter((c) => c.tasks.some((t) => !beta.has(t.key))).map((c) => c.title);
  if (!same(after.CATEGORIES.map((c) => c.title), keptCategories)) {
    problems.push(`categories are ${JSON.stringify(after.CATEGORIES.map((c) => c.title))}; expected ${JSON.stringify(keptCategories)}`);
  }
  for (const t of tiles) {
    const was = tilesOf(before).find((b) => b.key === t.key);
    if (!same(t, was)) problems.push(`tile "${t.key}" changed`);
  }

  for (const k of guideKeys) {
    const b = before.GUIDES[k];
    const a = after.GUIDES[k];
    const removed = new Set((plan.betaStepsByGuide[k] || { indexes: [] }).indexes);
    const wantSteps = b.steps.filter((_, i) => !removed.has(i));
    if (!same(a.steps, wantSteps)) {
      problems.push(`guide "${k}" steps are ${JSON.stringify(a.steps.map((s) => s.title))}; `
        + `expected ${JSON.stringify(wantSteps.map((s) => s.title))}`);
    }
    if (Object.hasOwn(before.TARGETS, k)) {
      const wantRow = before.TARGETS[k].filter((_, i) => !removed.has(i));
      if (!same(after.TARGETS[k], wantRow)) problems.push(`TARGETS["${k}"] is not its old row less the removed cells`);
      if (after.TARGETS[k].length !== a.steps.length) {
        problems.push(`TARGETS["${k}"] has ${after.TARGETS[k].length} cells for ${a.steps.length} steps`);
      }
    }
    const wantNext = b.next === undefined ? undefined : b.next.filter((n) => !beta.has(n));
    if (!same(a.next, wantNext)) problems.push(`guide "${k}" next is ${JSON.stringify(a.next)}; expected ${JSON.stringify(wantNext)}`);
    for (const n of a.next || []) if (!after.GUIDES[n]) problems.push(`guide "${k}" next names "${n}", which is not a guide`);
    const rest = (g) => ({ ...g, steps: undefined, next: undefined });
    if (!same(rest(a), rest(b))) problems.push(`guide "${k}" changed outside its steps and next list`);
  }
  if (problems.length) fail(`the export after removal is not what was planned:\n- ${problems.join('\n- ')}`);
}

// ---- the transform --------------------------------------------------------------------------------

export function apply(s, { showBeta, release } = {}) {
  if (typeof showBeta !== 'boolean') fail('showBeta must be a boolean; use parseShowBeta()');
  if (!release) fail('no release status was given');

  const before = evaluateGuideData(s);
  validateRelease(release, before.GUIDES);
  // Presentation of beta content (badges, banners) belongs to a later feature. Until then a build
  // that shows beta content is the export unchanged.
  if (showBeta) return s;

  const plan = planRemoval(release, before);
  const { start, end } = dataScript(s);
  let script = s.slice(start, end);

  for (const key of plan.betaGuides) {
    script = removeGuideEntry(script, key);
    script = removeTargetsRow(script, key);
  }
  script = removeTiles(script, plan.betaGuides);
  for (const [key, { indexes }] of Object.entries(plan.betaStepsByGuide)) {
    script = removeSteps(script, key, indexes, before.GUIDES[key].steps.map((st) => st.title));
  }
  script = removeNextReferences(script, plan.betaGuides);

  const out = s.slice(0, start) + script + s.slice(end);
  const after = evaluateGuideData(out);
  assertRemoved(before, after, plan);
  assertNothingLeft(out, {
    keys: plan.betaGuides,
    titles: [
      ...plan.betaGuides.flatMap((k) => [before.GUIDES[k].title, tilesOf(before).find((t) => t.key === k).title]),
      ...Object.values(plan.betaStepsByGuide).flatMap((b) => b.titles),
    ],
  });
  return out;
}
