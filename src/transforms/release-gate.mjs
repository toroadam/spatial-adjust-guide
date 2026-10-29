// The release gate: labels beta content in a build that shows it, and removes it from a build with
// SA_SHOW_BETA=false.
//
// Owner: the beta release epic (see the module map in docs/claims/README.md). No other feature
// edits this file.
//
// Runs last of every transform, after beta-content, so it sees every guide and step that any
// module added. src/release.json says which guides are beta and which steps of a GA guide are beta
// (src/release.mjs reads and validates it). Either way the release file is first validated against
// the guides.
//
// With showBeta true the beta content stays and is labelled (see "presentation" below): each beta
// guide's GUIDES entry and tile, and each beta step of a GA guide, gain `beta: true`, and anchored
// edits render a Beta text badge on the tile (also in its accessible name), a role="note" banner at
// the top of the guide, and an inline Beta marker in the heading of a beta step. The markup edits are
// made in every build that shows beta content, even when nothing is beta, so an export that moves
// an anchor fails the build today rather than on the day the first beta guide lands. src/release.css
// styles them; build.mjs injects it only into a build that shows beta content.
//
// With showBeta false none of that markup is added, and the gate deletes, from the guide data in the
// export:
//
//   - each beta guide's entry in GUIDES (`const GUIDES = {` and every `Object.assign(GUIDES, {`),
//   - each beta guide's cursor-target row in TARGETS (`const TARGETS = {` and `Object.assign(TARGETS, {`),
//   - each beta guide's tile in CATEGORIES, and any category left with no tiles,
//   - each beta step of a GA guide, with the TARGETS cell at the same index,
//   - every beta key in the `next` list of the guides that remain,
//   - every registered cross-reference: a sentence in a GA guide that names a beta guide or step,
//     listed under crossReferences in src/release.json, cut with the space that joins it.
//
// It then fails the build on a mention of a beta guide or beta step that is not registered, on GA
// prose that cites a step number the removal took away or moved, and on a player that no longer
// numbers its steps from steps.length.
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
import { edit } from './edit.mjs';
import {
  validateRelease, betaSteps, crossReferencesOf, fieldValues, occurrences,
  BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT,
} from '../release.mjs';

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

/** Offset of the `[` of `const CATEGORIES = [`. */
function categoriesOpen(script) {
  return only(script, 'const CATEGORIES = [', 'CATEGORIES declaration') + 'const CATEGORIES = '.length;
}

/**
 * Every tile literal in CATEGORIES, as { key, items, index, start }: `items` is its category's
 * tasks array, `index` its place there, and `start` the offset of its `{`.
 */
function tileLiterals(script) {
  const out = [];
  itemsOf(script, categoriesOpen(script)).items.forEach((category, ci) => {
    if (script[category.start] !== '{') fail(`category ${ci + 1} in CATEGORIES is not an object literal`);
    const tasks = arrayMember(script, category.start, 'tasks', `category ${ci + 1}`);
    if (tasks === null) fail(`category ${ci + 1} in CATEGORIES has no tasks array`);
    const { items } = itemsOf(script, tasks);
    items.forEach((tile, ti) => {
      if (script[tile.start] !== '{') fail(`tile ${ti + 1} of category ${ci + 1} is not an object literal`);
      const k = memberNamed(script, tile.start, 'key');
      if (!k) fail(`tile ${ti + 1} of category ${ci + 1} has no key`);
      out.push({ key: decodeString(script.slice(k.valueStart, k.item.end)), items, index: ti, start: tile.start });
    });
  });
  return out;
}

/** Remove the tiles whose key is in `keys`, then any category left with no tiles. */
function removeTiles(script, keys) {
  const catOpen = categoriesOpen(script);
  const tilesAt = () => tileLiterals(script);
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

// ---- cross-references -----------------------------------------------------------------------------

/**
 * `value` without `text` and the space that joins it to its neighbour: the space after it when one
 * follows, otherwise the space before it.
 */
export function cutSentence(value, text) {
  const at = value.indexOf(text);
  if (at < 0) fail(`${JSON.stringify(text)} is not in ${JSON.stringify(value)}`);
  if (value[at + text.length] === ' ') return value.slice(0, at) + value.slice(at + text.length + 1);
  if (at > 0 && value[at - 1] === ' ') return value.slice(0, at - 1) + value.slice(at + text.length);
  return value.slice(0, at) + value.slice(at + text.length);
}

/** A single-quoted JavaScript string literal for `value`, safe inside an inline <script>. */
function encodeString(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029').replace(/<\/(script)/gi, '<\\/$1')}'`;
}

/** A field that may be left as an empty string: the guide renders nothing for it. */
const MAY_BE_EMPTY = (path) => path === 'note' || /^steps\[\d+\]\.tip$/.test(path);

/**
 * The string literals of `field` in guide `key`, with the same paths fieldValues() gives the
 * evaluated guide. Items of before and verify also carry their array, so an emptied item can go.
 */
function fieldLiterals(script, key, field) {
  const { valueStart } = guideEntry(script, key);
  const member = (open, name, path) => {
    const m = memberNamed(script, open, name);
    return m ? [{ start: m.valueStart, end: m.item.end, path }] : [];
  };
  const steps = () => {
    const open = arrayMember(script, valueStart, 'steps', `guide "${key}"`);
    return open === null ? [] : itemsOf(script, open).items;
  };
  const fromSteps = (name) => steps().flatMap((step, i) => member(step.start, name, `steps[${i}].${name}`));
  switch (field) {
    case 'title': return member(valueStart, 'title', 'title').concat(fromSteps('title'));
    case 'summary': case 'where': case 'note': return member(valueStart, field, field);
    case 'before': case 'verify': {
      const open = arrayMember(script, valueStart, field, `guide "${key}"`);
      if (open === null) return [];
      const { items } = itemsOf(script, open);
      return items.map((it, index) => ({ start: it.start, end: it.end, path: `${field}[${index}]`, items, index }));
    }
    case 'body': case 'caption': case 'tip': return fromSteps(field);
    default: return fail(`"${field}" is not a cross-reference field`);
  }
}

/** Delete one registered cross-reference sentence from the guide data source. */
function removeCrossReference(script, ref) {
  const where = `the cross-reference ${JSON.stringify(ref.text)} in the ${ref.field} of guide "${ref.guide}" (registered by ${ref.from})`;
  const literals = fieldLiterals(script, ref.guide, ref.field).map((l) => {
    const raw = script.slice(l.start, l.end);
    if (!STRING_RE.test(raw)) fail(`${where}: ${l.path} is not a plain string literal, so the sentence cannot be cut from it`);
    return { ...l, value: decodeString(raw) };
  });
  const hits = literals.filter((l) => l.value.includes(ref.text));
  const count = hits.reduce((n, l) => n + occurrences(l.value, ref.text), 0);
  if (count !== 1) fail(`${where} occurs ${count} times in the source; expected exactly once`);
  const lit = hits[0];
  const value = cutSentence(lit.value, ref.text);
  if (value.trim() === '') {
    if (lit.items) return cutItem(script, lit.items, lit.index);
    if (!MAY_BE_EMPTY(lit.path)) fail(`${where} is all of ${lit.path}; removing it would leave it empty, so rewrite the text instead`);
    return script.slice(0, lit.start) + "''" + script.slice(lit.end);
  }
  return script.slice(0, lit.start) + encodeString(value) + script.slice(lit.end);
}

/** The same deletions applied to evaluated data, to know what the export should say afterwards. */
function applyCrossReferences(data, refs) {
  const out = JSON.parse(JSON.stringify(data));
  for (const ref of refs) {
    const guide = out.GUIDES[ref.guide];
    const hits = fieldValues(guide, ref.field).filter((v) => v.text.includes(ref.text));
    if (hits.length !== 1) fail(`the cross-reference ${JSON.stringify(ref.text)} is in ${hits.length} ${ref.field} values of guide "${ref.guide}"; expected one`);
    const { path, text } = hits[0];
    const value = cutSentence(text, ref.text);
    const item = /^(before|verify)\[(\d+)\]$/.exec(path);
    const step = /^steps\[(\d+)\]\.(\w+)$/.exec(path);
    if (item && value.trim() === '') guide[item[1]].splice(Number(item[2]), 1);
    else if (item) guide[item[1]][Number(item[2])] = value;
    else if (step) guide.steps[Number(step[1])][step[2]] = value.trim() === '' ? '' : value;
    else guide[path] = value.trim() === '' ? '' : value;
  }
  return out;
}

// ---- mentions and step numbers --------------------------------------------------------------------

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

/** The sentence of `text` that holds offset `at`. */
function sentenceAt(text, at) {
  for (const { segment, index } of segmenter.segment(text)) {
    if (at >= index && at < index + segment.length) return segment.trim();
  }
  return text;
}

/** Every prose value of an evaluated guide, as { path, field, text }; field is the crossReferences field, or null. */
function proseOf(guide) {
  const out = [];
  const add = (path, field, text) => { if (typeof text === 'string' && text) out.push({ path, field, text }); };
  add('title', 'title', guide.title);
  for (const f of ['summary', 'where', 'note']) add(f, f, guide[f]);
  for (const f of ['before', 'verify']) (guide[f] || []).forEach((t, i) => add(`${f}[${i}]`, f, t));
  (guide.steps || []).forEach((st, i) => {
    for (const f of ['title', 'body', 'caption', 'tip']) add(`steps[${i}].${f}`, f, st[f]);
    add(`steps[${i}].tipLabel`, null, st.tipLabel);
  });
  return out;
}

/** Offsets of `needle` in `text`; a #/ link must not run on into a longer key. */
function hitsIn(text, needle) {
  const out = [];
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
    if (needle.startsWith('#/') && /[a-z0-9-]/.test(text[at + needle.length] || '')) continue;
    out.push(at);
  }
  return out;
}

/**
 * Fail on any remaining GA guide field or tile that names a beta guide (its title, its tile title,
 * or a #/key link) or a beta step, naming the guide, field and sentence and where to register it.
 */
function assertNoMentions(after, before, plan, release) {
  const needles = [];
  for (const k of plan.betaGuides) {
    const owner = `guides."${k}".crossReferences`;
    needles.push({ needle: before.GUIDES[k].title, what: `the title of beta guide "${k}"`, owner });
    const tile = tilesOf(before).find((t) => t.key === k);
    if (tile.title !== before.GUIDES[k].title) needles.push({ needle: tile.title, what: `the tile title of beta guide "${k}"`, owner });
    needles.push({ needle: `#/${k}`, what: `a link to beta guide "${k}"`, owner });
  }
  for (const [key, { titles }] of Object.entries(plan.betaStepsByGuide)) {
    for (const title of titles) {
      const section = release.guides[key].sections.find((sec) => sec.status === 'beta' && sec.steps.includes(title));
      needles.push({ needle: title, what: `beta step ${JSON.stringify(title)} of guide "${key}"`, owner: `guides."${key}" section "${section.id}" crossReferences` });
    }
  }
  const problems = [];
  const scan = (place, field, path, text) => {
    for (const { needle, what, owner } of needles) {
      for (const at of hitsIn(text, needle)) {
        const sentence = sentenceAt(text, at);
        problems.push(`${place} ${path}: ${JSON.stringify(sentence)} names ${what}. `
          + (field
            ? `Register it in src/release.json under ${owner} as ${JSON.stringify({ guide: place.replace(/^guide "(.*)"$/, '$1'), field, text: sentence })}, or rewrite it.`
            : 'Rewrite it: this field cannot hold a registered cross-reference.'));
      }
    }
  };
  for (const [key, guide] of Object.entries(after.GUIDES)) {
    for (const { path, field, text } of proseOf(guide)) scan(`guide "${key}"`, field, path, text);
  }
  for (const tile of tilesOf(after)) {
    for (const f of ['title', 'summary']) if (typeof tile[f] === 'string') scan(`tile "${tile.key}"`, null, f, tile[f]);
  }
  if (problems.length) {
    fail(`GA content still mentions beta content that a build without it removes (${problems.length}):\n- ${problems.join('\n- ')}`);
  }
}

/**
 * In each GA guide that lost steps, fail on prose that cites a step number which was removed, is
 * past the new last step, or now names a different step because an earlier one was removed.
 */
function assertStepNumbers(after, plan) {
  const problems = [];
  for (const [key, { indexes }] of Object.entries(plan.betaStepsByGuide)) {
    const removed = indexes.map((i) => i + 1);
    const total = after.GUIDES[key].steps.length;
    for (const { path, text } of proseOf(after.GUIDES[key])) {
      for (const m of text.matchAll(/\b[Ss]teps? (\d+)\b/g)) {
        const n = Number(m[1]);
        let why = null;
        if (removed.includes(n)) why = `cites step ${n}, which a build without beta content removes`;
        else if (n > total) why = `cites step ${n}, but the guide has ${total} steps without beta content`;
        else if (n > removed[0]) why = `cites step ${n}, which becomes step ${n - removed.filter((r) => r < n).length} once beta step ${removed.join(', ')} is removed`;
        if (why) problems.push(`guide "${key}" ${path}: ${JSON.stringify(sentenceAt(text, m.index))} ${why}`);
      }
    }
  }
  if (problems.length) {
    fail(`GA prose cites a step number that does not hold without beta content (${problems.length}). Rewrite each `
      + `sentence, or register it under the beta section's crossReferences in src/release.json:\n- ${problems.join('\n- ')}`);
  }
}

/** The code that numbers steps from steps.length, so a guide that loses a step renumbers itself. */
const COUNTER_ANCHORS = [
  ["counter: 'Step ' + (pi + 1) + ' of ' + steps.length", 'the player counter, Step N of M'],
  ["announcement: 'Step ' + (pi + 1) + ' of ' + steps.length + ': ' + (steps[pi] ? steps[pi].title : '')",
    'the live-region announcement added by the "player announcement" edit in src/transform-export.mjs'],
  ['n: i + 1,', 'the step numbers in the step rail and the contents'],
];

function assertCounterAnchors(s) {
  for (const [anchor, what] of COUNTER_ANCHORS) {
    const n = every(s, anchor).length;
    if (n !== 1) {
      fail(`${what} must number steps from steps.length, but its code ${JSON.stringify(anchor)} occurs ${n} times. `
        + 'Without it a guide that loses a beta step would number its steps wrongly.');
    }
  }
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

// ---- the catalogues -------------------------------------------------------------------------------

// Catalogue keys are the English the page renders, with runs of whitespace collapsed
// (scripts/extract-strings.mjs), so strings from the data are compared in that form.
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

/** Every reader-facing string in evaluated guide data: guides, their steps, tiles and categories. */
function dataStrings(data) {
  const out = new Set();
  const add = (t) => { if (typeof t === 'string' && norm(t)) out.add(norm(t)); };
  for (const g of Object.values(data.GUIDES)) {
    for (const f of ['category', 'title', 'minutes', 'where', 'summary', 'note']) add(g[f]);
    for (const f of ['before', 'verify']) (g[f] || []).forEach(add);
    for (const st of g.steps || []) for (const f of ['title', 'body', 'caption', 'tipLabel', 'tip']) add(st[f]);
  }
  for (const c of data.CATEGORIES) {
    add(c.title);
    add(c.blurb);
    for (const t of c.tasks) { add(t.title); add(t.summary); add(t.minutes); }
  }
  return out;
}

/**
 * The strings only beta content uses, which a build with SA_SHOW_BETA=false leaves out of the
 * shipped catalogues. `allData` and `shippedData` are evaluateGuideData() of the export built with
 * beta shown and with it removed. The set holds every string of the removed guides, tiles and
 * steps, the blurb of a category left with no tiles, the GA text as it read before a registered cross-reference was cut, each
 * registered cross-reference sentence, the beta badge and banner strings, and each
 * `catalogueKeys` entry "Step N of M: <title>" whose title is a removed step's. A string that
 * shipped content still uses stays, and so does every string in `keep`.
 */
export function betaOnlyStrings({ allData, shippedData, release, catalogueKeys = [], keep = [] }) {
  const shipped = dataStrings(shippedData);
  for (const g of Object.values(shippedData.GUIDES)) {
    g.steps.forEach((st, i) => shipped.add(norm(`Step ${i + 1} of ${g.steps.length}: ${st.title}`)));
  }
  const out = dataStrings(allData);
  for (const ref of crossReferencesOf(release)) out.add(norm(ref.text));
  for (const label of [BETA_BADGE_LABEL, BETA_BANNER_LABEL, BETA_BANNER_TEXT]) out.add(norm(label));
  const removedSteps = new Set();
  for (const [key, g] of Object.entries(allData.GUIDES)) {
    const kept = new Set(((shippedData.GUIDES[key] || {}).steps || []).map((st) => st.title));
    for (const st of g.steps) if (!kept.has(st.title)) removedSteps.add(norm(st.title));
  }
  for (const key of catalogueKeys) {
    const m = /^Step \d+ of \d+: (.+)$/.exec(key);
    if (m && removedSteps.has(norm(m[1]))) out.add(key);
  }
  // Category headings stay even when a category empties: src/contact.js lists them in the footer
  // of every page, so they are still on screen.
  for (const c of allData.CATEGORIES) out.delete(norm(c.title));
  for (const t of shipped) out.delete(t);
  for (const t of keep) out.delete(norm(t));
  return out;
}

/**
 * The keys a build with SA_SHOW_BETA=false leaves out of every shipped catalogue. `catalogue` is
 * src/i18n/en-us.json. Returns { omit, betaTitles }: `omit` holds each catalogue key that is a
 * beta-only string, or that contains the title or tile title of a removed guide (the accessible
 * names harvested from tiles, such as "<title> — 3 MIN, difficulty 2 of 3"). The reproduction's
 * screen labels (_screenStrings) and every string shipped content uses are never left out.
 */
export function catalogueOmissions({ allData, shippedData, release, catalogue }) {
  const keys = Object.keys(catalogue.strings || {});
  const keep = Object.values(catalogue._screenStrings || {});
  const betaOnly = betaOnlyStrings({ allData, shippedData, release, catalogueKeys: keys, keep });
  const betaTitles = [];
  for (const [key, g] of Object.entries(allData.GUIDES)) {
    if (Object.hasOwn(shippedData.GUIDES, key)) continue;
    betaTitles.push(norm(g.title));
    const tile = tilesOf(allData).find((t) => t.key === key);
    if (tile && norm(tile.title) !== norm(g.title)) betaTitles.push(norm(tile.title));
  }
  const used = new Set([...dataStrings(shippedData), ...keep.map(norm)]);
  const omit = new Set(keys.filter((k) => betaOnly.has(k) || (!used.has(k) && betaTitles.some((t) => k.includes(t)))));
  return { omit, betaTitles };
}

// ---- presentation: labelling beta content in a build that shows it ---------------------------------
//
// Three treatments, each a text label rather than colour alone, styled by src/release.css:
//
//   - the catalogue tile of a beta guide carries a Beta badge above its title, ahead of any New in
//     IntelliDash badge, and its accessible name gains "Beta, " (the card's aria-label replaces its
//     content for a screen reader, so a badge outside the label would never be heard);
//   - a beta guide opens with a role="note" banner, "Beta." and one sentence, ahead of the note
//     callout, so a guide that is both new and beta reads Beta first;
//   - a beta step of a GA guide carries an inline Beta marker in its written heading and in the
//     player's step heading. Every step of a beta guide is beta, and the banner already says so,
//     so those steps carry no marker.
//
// The strings are BETA_BADGE_LABEL, BETA_BANNER_LABEL and BETA_BANNER_TEXT from src/release.mjs.
// Each sits in a text node of its own, so its catalogue key is the exact constant. The marker sits
// after the step title in a node of its own, so step title strings, and the catalogue keys built
// from them such as "Step N of M: <title>", do not change.

/** An HTML text node for one of the constants. They hold no markup, but escape them anyway. */
const htmlText = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A `<sc-if>` that renders the Beta badge when `value` is true. `lead` goes before the badge. */
const badgeIf = (value, modifier, lead = '') => `<sc-if value="{{ ${value} }}" hint-placeholder-val="{{ false }}">`
  + `${lead}<span class="lsa-beta-badge lsa-beta-badge-${modifier}">${htmlText(BETA_BADGE_LABEL)}</span></sc-if>`;

/** Give the object literal at `open` a leading `beta: true,` member. */
function flagLiteral(script, open, what) {
  if (script[open] !== '{') fail(`${what} is not an object literal`);
  if (memberNamed(script, open, 'beta')) {
    fail(`${what} already has a beta member; beta status comes from src/release.json, not from the guide data`);
  }
  const { items } = itemsOf(script, open);
  const at = items.length ? items[0].start : open + 1;
  return script.slice(0, at) + 'beta: true, ' + script.slice(at);
}

/** Flag each beta guide's GUIDES entry and tile, and each beta step of a GA guide, with `beta: true`. */
function flagBetaContent(script, plan, data) {
  for (const key of plan.betaGuides) {
    script = flagLiteral(script, guideEntry(script, key).valueStart, `the GUIDES entry for "${key}"`);
    const tiles = tileLiterals(script).filter((t) => t.key === key);
    if (tiles.length !== 1) fail(`expected one CATEGORIES tile for beta guide "${key}", found ${tiles.length}`);
    script = flagLiteral(script, tiles[0].start, `the tile for "${key}"`);
  }
  for (const [key, { indexes }] of Object.entries(plan.betaStepsByGuide)) {
    const titles = data.GUIDES[key].steps.map((st) => st.title);
    for (const i of indexes) {
      const open = arrayMember(script, guideEntry(script, key).valueStart, 'steps', `guide "${key}"`);
      if (open === null) fail(`guide "${key}" has no steps array`);
      const steps = itemsOf(script, open).items;
      if (steps.length !== titles.length) {
        fail(`guide "${key}" has ${steps.length} step literals but evaluates to ${titles.length} steps; `
          + 'its steps are built some other way, so a beta step cannot be found by position');
      }
      const step = steps[i];
      if (script[step.start] !== '{') fail(`step ${i + 1} of guide "${key}" is not an object literal`);
      const t = memberNamed(script, step.start, 'title');
      if (!t || decodeString(script.slice(t.valueStart, t.item.end)) !== titles[i]) {
        fail(`step ${i + 1} of guide "${key}" in the source is not the step titled ${JSON.stringify(titles[i])}`);
      }
      script = flagLiteral(script, step.start, `step ${i + 1} of guide "${key}"`);
    }
  }
  return script;
}

/** Fail unless `after` is `before` with `beta: true` on exactly the planned guides, tiles and steps. */
function assertFlagged(before, after, plan) {
  const beta = new Set(plan.betaGuides);
  const problems = [];
  const check = (what, value, want) => {
    if (want ? value !== true : value !== undefined) {
      problems.push(`${what} has beta ${JSON.stringify(value)}; expected ${want ? 'true' : 'no beta member'}`);
    }
  };
  for (const [k, g] of Object.entries(after.GUIDES)) {
    check(`guide "${k}"`, g.beta, beta.has(k));
    const steps = new Set((plan.betaStepsByGuide[k] || { indexes: [] }).indexes);
    (g.steps || []).forEach((st, i) => check(`step ${i + 1} of guide "${k}"`, st.beta, steps.has(i)));
  }
  for (const t of tilesOf(after)) check(`tile "${t.key}"`, t.beta, beta.has(t.key));
  const strip = (o) => { const { beta: _, ...rest } = o; return rest; };
  const unflagged = {
    GUIDES: Object.fromEntries(Object.entries(after.GUIDES)
      .map(([k, g]) => [k, { ...strip(g), ...(g.steps ? { steps: g.steps.map(strip) } : {}) }])),
    TARGETS: after.TARGETS,
    CATEGORIES: after.CATEGORIES.map((c) => ({ ...c, tasks: c.tasks.map(strip) })),
  };
  if (!same(unflagged, before)) problems.push('the guide data changed other than by its beta flags');
  if (problems.length) fail(`flagging beta content did not give what was planned:\n- ${problems.join('\n- ')}`);
}

/** The anchored markup and view-model edits that render the flags. Made whether or not anything is beta. */
function presentBeta(s) {
  // The catalogue tile: the badge above the title, ahead of the New in Spatial Adjust badge when that
  // is there. The title div is the anchor, so the badge survives that badge being retired.
  s = edit(s, {
    name: 'beta presentation: tile badge',
    pattern: /(<sc-if value="\{\{ task\.isNew \}\}"[^\n]*?<\/sc-if>\s*)?(<div style="font-size:17px;font-weight:700;line-height:1\.25;letter-spacing:-0\.2px;margin-bottom:8px;text-wrap:pretty">\{\{ task\.title \}\}<\/div>)/,
    replace: (m) => badgeIf('task.isBeta', 'tile') + m,
  });
  s = edit(s, {
    name: 'beta presentation: tile accessible name',
    pattern: /(const _saLabel = live\s*\?\s*t\.title \+ ' — ' \+ )/,
    replace: (m) => `${m}(t.beta ? ${encodeString(`${BETA_BADGE_LABEL}, `)} : '') + `,
  });
  s = edit(s, {
    name: 'beta presentation: tile view-model',
    pattern: /(\n\s*)(ariaLabel: _saLabel,)/,
    replace: (m, nl, field) => `${nl}${field}${nl}isBeta: !!t.beta,`,
  });

  // The guide banner, ahead of the note callout.
  s = edit(s, {
    name: 'beta presentation: guide banner',
    pattern: /(\n(\s*))(<sc-if value="\{\{ guide\.hasNote \}\}" hint-placeholder-val="\{\{ false \}\}">)/,
    replace: (m, nl, indent, noteIf) => `${nl}<sc-if value="{{ guide.isBeta }}" hint-placeholder-val="{{ false }}">`
      + `${nl}  <div role="note" class="lsa-beta-banner"><span class="lsa-beta-banner-label">${htmlText(BETA_BANNER_LABEL)}</span> `
      + `${htmlText(BETA_BANNER_TEXT)}</div>${nl}</sc-if>${nl}${noteIf}`,
  });
  s = edit(s, {
    name: 'beta presentation: guide view-model',
    pattern: /hasNote: !!g\.note,/,
    replace: (m) => `isBeta: !!g.beta, ${m}`,
  });

  // The inline marker on a beta step: the step view-model, the written heading and the player's.
  s = edit(s, {
    name: 'beta presentation: step view-model',
    pattern: /(\n\s*)(title: s\.title,)(\n\s*body: s\.body,)/,
    replace: (m, nl, title, body) => `${nl}${title}${nl}isBeta: !!s.beta,${body}`,
  });
  s = edit(s, {
    name: 'beta presentation: written step heading marker',
    pattern: /(<h2 style="margin:0 0 14px;font-size:26px;font-weight:700;letter-spacing:-0\.5px;text-wrap:pretty">\{\{ step\.title \}\})(<\/h2>)/,
    replace: (m, open, close) => open + badgeIf('step.isBeta', 'step', ' ') + close,
  });
  s = edit(s, {
    name: 'beta presentation: player step heading marker',
    pattern: /(<div style="font-size:20px;font-weight:700;letter-spacing:-0\.4px;line-height:1\.25;margin-bottom:10px;text-wrap:pretty">\{\{ guide\.player\.step\.title \}\})(<\/div>)/,
    replace: (m, open, close) => open + badgeIf('guide.player.step.isBeta', 'step', ' ') + close,
  });
  return s;
}

/**
 * The export with beta content labelled: the flags on the guide data, then the markup that renders
 * them. `before` is evaluateGuideData(s). The flags are checked against the plan before returning.
 */
export function presentBetaContent(s, release, before = evaluateGuideData(s)) {
  const plan = planRemoval(release, before);
  const { start, end } = dataScript(s);
  const script = flagBetaContent(s.slice(start, end), plan, before);
  const out = presentBeta(s.slice(0, start) + script + s.slice(end));
  assertFlagged(before, evaluateGuideData(out), plan);
  return out;
}

// ---- the transform --------------------------------------------------------------------------------

export function apply(s, { showBeta, release } = {}) {
  if (typeof showBeta !== 'boolean') fail('showBeta must be a boolean; use parseShowBeta()');
  if (!release) fail('no release status was given');

  const before = evaluateGuideData(s);
  validateRelease(release, before.GUIDES);
  // A build that shows beta content keeps it and labels it.
  if (showBeta) return presentBetaContent(s, release, before);

  const plan = planRemoval(release, before);
  const refs = crossReferencesOf(release);
  const { start, end } = dataScript(s);
  let script = s.slice(start, end);

  // Sentences first, while every guide and step they may sit in is still where validation found it.
  for (const ref of refs) script = removeCrossReference(script, ref);
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
  assertNoMentions(after, before, plan, release);
  assertStepNumbers(after, plan);
  assertCounterAnchors(out);
  assertRemoved(applyCrossReferences(before, refs), after, plan);
  assertNothingLeft(out, {
    keys: plan.betaGuides,
    titles: [
      ...plan.betaGuides.flatMap((k) => [before.GUIDES[k].title, tilesOf(before).find((t) => t.key === k).title]),
      ...Object.values(plan.betaStepsByGuide).flatMap((b) => b.titles),
    ],
  });
  return out;
}
