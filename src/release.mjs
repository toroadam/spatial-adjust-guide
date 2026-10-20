// Release status for every guide: which guides and steps are GA and which are beta.
//
// What this is for. The guides describe IntelliDash as it runs in production. Some Spatial Adjust
// behaviour exists only on develop and the beta environment. docs/claims/beta-surfaces.md lists
// that behaviour, and src/release.json records one status per guide: "ga" or "beta". A GA guide
// can also hold beta sections, which are steps addressed by their exact title. Everything that
// decides whether beta content is published reads it through this module, so the rule lives in
// one place.
//
// Cross-references. A sentence in a GA guide that names or links a beta guide or a beta step must
// leave with it. A beta guide entry or a beta section lists those sentences under
// "crossReferences": [{ "guide": "<ga key>", "field": "<field>", "text": "<exact sentence>" }],
// where field is one of CROSS_REFERENCE_FIELDS and the text occurs exactly once in that field of
// that guide. A build with SA_SHOW_BETA=false deletes each one, with the space that joins it to its
// neighbour, and fails on any mention of a beta guide that is not registered this way
// (src/transforms/release-gate.mjs).
//
// The switch. SA_SHOW_BETA is read from process.env in two places only: build.mjs, which passes the
// raw value to parseShowBeta() and logs it, and showBetaFromEnv() here, for any other caller.
// parseShowBeta() decides what the value means:
//   unset or empty  -> true   (the internal and expert-review default: beta content is shown)
//   true, 1         -> true   (any letter case)
//   false, 0        -> false  (any letter case)
//   anything else   -> throws, so a typo in a pipeline fails the build instead of guessing
// When the switch is false, the build must leave beta content out of dist/ altogether. Hiding it
// with CSS or a URL parameter does not count. Nothing here depends on GitHub or any other host.
//
// What a build with SA_SHOW_BETA=false leaves out (src/transforms/release-gate.mjs and build.mjs):
// each beta guide's entry, cursor targets and tile, each beta step of a GA guide, Next links and
// registered cross-references to them, and, from every dist/i18n/<locale>.json, each catalogue key
// that only beta content uses. That set is computed at build time from this file, so releasing a
// beta guide is a one-line status change. Neither src/release.json nor this module is copied into
// dist/; build.mjs fails if either turns up there.
//
// Media contract. Any per-guide media published beside the guides follows the same rule through
// isGuideShipped(). The video media manifest includes a guide's episode, its captions and its
// transcript only when isGuideShipped(release, key, showBeta) is true, with showBeta from
// parseShowBeta(). When showBeta is false, an episode of a GA guide that shows or narrates a step
// listed by betaSteps(release, key) is beta content as well: leave it out, or ship a cut without
// that step. Captions and transcripts carry the same beta-only strings the catalogues drop, so they
// go wherever their episode goes.
//
// SA_RELEASE_FILE is for tests only. It points loadRelease() at a fixture instead of
// src/release.json. Production and preview deploys never set it. An empty value counts as unset.
//
// No third-party imports. build.mjs and any CI pipeline that runs `npm ci` can load this file
// without installing anything new. src/ must not import scripts/, so validateRelease() takes the
// evaluated GUIDES object as an argument. scripts/claims-extract.mjs#extractGuides builds it.
import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

export const DEFAULT_RELEASE_FILE = 'src/release.json';
export const STATUSES = ['ga', 'beta'];

// Reader-facing strings. They are English catalogue keys, so each one must also be in
// src/i18n/en-us.json and translated before a build shows it.
export const BETA_BADGE_LABEL = 'Beta';
export const BETA_BANNER_LABEL = 'Beta.';
export const BETA_BANNER_TEXT = 'This feature is in testing and may change before it reaches your IntelliDash.';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENTRY_FIELDS = ['status', 'basis', 'sections', 'crossReferences'];
const SECTION_FIELDS = ['id', 'status', 'basis', 'steps', 'crossReferences'];
const CROSS_REFERENCE_KEYS = ['guide', 'field', 'text'];

/** The guide fields a cross-reference may sit in. title, body, caption and tip include the steps'. */
export const CROSS_REFERENCE_FIELDS = ['title', 'summary', 'where', 'note', 'before', 'body', 'caption', 'tip', 'verify'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

// ---- the switch ---------------------------------------------------------------------------------

/**
 * Decide what an SA_SHOW_BETA value means. Unset or empty means show beta (true). "true" or "1"
 * means true, and "false" or "0" means false, in any letter case. Any other value throws.
 */
export function parseShowBeta(value) {
  if (value === undefined || value === null) return true;
  const text = String(value).trim();
  if (text === '') return true;
  const lower = text.toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  throw new Error(`SA_SHOW_BETA must be unset, empty, true, 1, false or 0 (any letter case); received ${JSON.stringify(value)}`);
}

/** The one place that reads SA_SHOW_BETA. Pass `env` only from tests. */
export function showBetaFromEnv(env = process.env) {
  return parseShowBeta(env.SA_SHOW_BETA);
}

// ---- loading ------------------------------------------------------------------------------------

/**
 * Report every object key that appears twice in the same object of a JSON text. JSON.parse keeps
 * the last value and drops the rest without a word, so a guide pasted twice would pass
 * validation. Returns paths such as "guides.preferences".
 */
export function findDuplicateKeys(text) {
  const duplicates = [];
  const stack = []; // { type: 'object' | 'array', keys: Set, path: string, pendingKey: string|null }
  let expectKey = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      let raw = '';
      for (; j < text.length && text[j] !== '"'; j++) {
        if (text[j] === '\\') { raw += text[j] + text[j + 1]; j++; } else raw += text[j];
      }
      const top = stack[stack.length - 1];
      if (top && top.type === 'object' && expectKey) {
        const key = JSON.parse(`"${raw}"`);
        if (top.keys.has(key)) duplicates.push(top.path ? `${top.path}.${key}` : key);
        top.keys.add(key);
        top.pendingKey = key;
        expectKey = false;
      }
      i = j;
    } else if (c === '{' || c === '[') {
      const parent = stack[stack.length - 1];
      let path = '';
      if (parent) {
        const segment = parent.type === 'object' ? parent.pendingKey : `[${parent.index}]`;
        path = parent.path ? `${parent.path}.${segment}` : segment;
      }
      stack.push({ type: c === '{' ? 'object' : 'array', keys: new Set(), path, pendingKey: null, index: 0 });
      expectKey = c === '{';
    } else if (c === '}' || c === ']') {
      stack.pop();
      expectKey = false;
    } else if (c === ',') {
      const top = stack[stack.length - 1];
      if (top && top.type === 'object') expectKey = true;
      else if (top) top.index++;
    }
  }
  return duplicates;
}

/** Resolve which release file to read: `file`, then SA_RELEASE_FILE, then src/release.json. */
export function releaseFilePath({ file } = {}) {
  const chosen = (file ?? '').trim() || (process.env.SA_RELEASE_FILE || '').trim() || DEFAULT_RELEASE_FILE;
  return isAbsolute(chosen) ? chosen : resolve(ROOT, chosen);
}

/**
 * Read and parse the release file. Returns { release, file }, where `file` is the absolute path
 * that was read. Throws on unreadable or malformed JSON, and on any key that appears twice in one
 * object.
 */
export function loadRelease({ file } = {}) {
  const path = releaseFilePath({ file });
  const text = readFileSync(path, 'utf8');
  let release;
  try {
    release = JSON.parse(text);
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err.message}`);
  }
  const duplicates = findDuplicateKeys(text);
  if (duplicates.length) {
    throw new Error(`${path} names a key more than once: ${duplicates.join(', ')}`);
  }
  return { release, file: path };
}

// ---- cross-references ---------------------------------------------------------------------------

/**
 * Every value of `field` in an evaluated guide, as [{ path, text }]. Guide-level fields give one
 * value, before and verify one per item, and body, caption and tip one per step that has it. title
 * gives the guide's title and then each step's.
 */
export function fieldValues(guide, field) {
  const steps = Array.isArray(guide.steps) ? guide.steps : [];
  const fromSteps = (name) => steps.flatMap((s, i) => (s && typeof s[name] === 'string' ? [{ path: `steps[${i}].${name}`, text: s[name] }] : []));
  switch (field) {
    case 'title': return [{ path: 'title', text: guide.title }].filter((v) => typeof v.text === 'string').concat(fromSteps('title'));
    case 'summary': case 'where': case 'note':
      return typeof guide[field] === 'string' ? [{ path: field, text: guide[field] }] : [];
    case 'before': case 'verify':
      return (Array.isArray(guide[field]) ? guide[field] : []).map((text, i) => ({ path: `${field}[${i}]`, text }));
    case 'body': case 'caption': case 'tip': return fromSteps(field);
    default: throw new Error(`"${field}" is not a cross-reference field; expected one of ${CROSS_REFERENCE_FIELDS.join(', ')}`);
  }
}

/** How many times `needle` occurs in `hay`. */
export function occurrences(hay, needle) {
  let n = 0;
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) n++;
  return n;
}

/**
 * Every registered cross-reference, as { guide, field, text, from }, where `from` names the beta
 * guide or beta section that registered it.
 */
export function crossReferencesOf(release) {
  const out = [];
  for (const [key, entry] of Object.entries((release && release.guides) || {})) {
    for (const ref of entry.crossReferences || []) out.push({ ...ref, from: `guide "${key}"` });
    for (const section of entry.sections || []) {
      for (const ref of section.crossReferences || []) out.push({ ...ref, from: `guide "${key}" section "${section.id}"` });
    }
  }
  return out;
}

function checkCrossReferences(list, at, owner, entries, guides, problems) {
  if (list === undefined) return;
  if (owner !== 'beta') { problems.push(`${at} has crossReferences but is not beta; only beta content registers them`); return; }
  if (!Array.isArray(list) || list.length === 0) {
    problems.push(`${at} "crossReferences" must be a non-empty array of { guide, field, text } objects`);
    return;
  }
  list.forEach((ref, n) => {
    const where = `${at} cross-reference #${n + 1}`;
    if (!isObject(ref)) { problems.push(`${where} must be an object with guide, field and text`); return; }
    for (const k of Object.keys(ref)) if (!CROSS_REFERENCE_KEYS.includes(k)) problems.push(`${where} has an unknown field "${k}"`);
    if (!isText(ref.guide) || !Object.hasOwn(guides, ref.guide)) {
      problems.push(`${where} names guide ${JSON.stringify(ref.guide)}, which is not a guide in GUIDES`);
      return;
    }
    if (!isObject(entries[ref.guide]) || entries[ref.guide].status !== 'ga') {
      problems.push(`${where} names guide "${ref.guide}", which is not ga; a beta guide leaves whole, with its sentences`);
    }
    if (!CROSS_REFERENCE_FIELDS.includes(ref.field)) {
      problems.push(`${where} has field ${JSON.stringify(ref.field)}; expected one of ${CROSS_REFERENCE_FIELDS.join(', ')}`);
      return;
    }
    if (!isText(ref.text)) { problems.push(`${where} needs a non-empty "text"`); return; }
    const found = fieldValues(guides[ref.guide], ref.field).reduce((sum, v) => sum + occurrences(v.text, ref.text), 0);
    if (found !== 1) {
      problems.push(`${where} text ${JSON.stringify(ref.text)} occurs ${found} times in the ${ref.field} of guide "${ref.guide}"; expected exactly once`);
    }
  });
}

// ---- validation ---------------------------------------------------------------------------------

/**
 * Check a release object against the evaluated GUIDES object (guide key -> guide with steps[].title).
 * Throws one Error that lists every problem. The list is also on `error.problems`. Returns the
 * release unchanged when it is valid.
 */
export function validateRelease(release, guides) {
  const problems = [];
  if (!isObject(guides)) throw new Error('validateRelease needs the evaluated GUIDES object as its second argument');
  if (!isObject(release)) {
    problems.push('the release file must be a JSON object');
  } else if (!isObject(release.guides)) {
    problems.push('"guides" must be an object keyed by guide key');
  } else {
    const entries = release.guides;
    for (const key of Object.keys(guides)) {
      if (!Object.hasOwn(entries, key)) problems.push(`guide "${key}" has no entry`);
    }
    for (const [key, entry] of Object.entries(entries)) {
      const where = `guide "${key}"`;
      if (!Object.hasOwn(guides, key)) { problems.push(`${where} is not a guide in GUIDES`); continue; }
      if (!isObject(entry)) { problems.push(`${where} must be an object`); continue; }
      for (const field of Object.keys(entry)) {
        if (!ENTRY_FIELDS.includes(field)) problems.push(`${where} has an unknown field "${field}"`);
      }
      if (!STATUSES.includes(entry.status)) {
        problems.push(`${where} has status ${JSON.stringify(entry.status)}; expected "ga" or "beta"`);
      }
      if (!isText(entry.basis)) problems.push(`${where} needs a non-empty "basis"`);
      checkCrossReferences(entry.crossReferences, where, entry.status, entries, guides, problems);
      if (entry.sections === undefined) continue;
      if (!Array.isArray(entry.sections)) { problems.push(`${where} "sections" must be an array`); continue; }

      const titles = (guides[key].steps || []).map((s) => s && s.title);
      const ids = new Set();
      const claimed = new Map(); // step title -> section id
      entry.sections.forEach((section, n) => {
        const at = `${where} section ${isObject(section) && isText(section.id) ? `"${section.id}"` : `#${n + 1}`}`;
        if (!isObject(section)) { problems.push(`${at} must be an object`); return; }
        for (const field of Object.keys(section)) {
          if (!SECTION_FIELDS.includes(field)) problems.push(`${at} has an unknown field "${field}"`);
        }
        if (!isText(section.id) || !KEBAB.test(section.id)) {
          problems.push(`${at} needs a kebab-case "id"`);
        } else if (ids.has(section.id)) {
          problems.push(`${where} uses section id "${section.id}" more than once`);
        } else {
          ids.add(section.id);
        }
        if (!STATUSES.includes(section.status)) {
          problems.push(`${at} has status ${JSON.stringify(section.status)}; expected "ga" or "beta"`);
        } else if (entry.status === 'beta' && section.status === 'ga') {
          problems.push(`${at} is ga inside a beta guide; a beta guide holds no ga section`);
        }
        if (section.basis !== undefined && !isText(section.basis)) problems.push(`${at} "basis" must be a non-empty string`);
        if (!Array.isArray(section.steps) || section.steps.length === 0) {
          problems.push(`${at} needs a non-empty "steps" array of step titles`);
        } else {
          for (const title of section.steps) {
            const matches = titles.filter((t) => t === title).length;
            if (matches !== 1) {
              problems.push(`${at} step ${JSON.stringify(title)} matches ${matches} step titles in the guide; expected exactly one`);
            } else if (claimed.has(title)) {
              problems.push(`${at} step ${JSON.stringify(title)} is already in section "${claimed.get(title)}"`);
            } else {
              claimed.set(title, section.id);
            }
          }
        }
        checkCrossReferences(section.crossReferences, at, section.status, entries, guides, problems);
      });
    }
  }
  if (problems.length) {
    const err = new Error(`release status is invalid (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n- ${problems.join('\n- ')}`);
    err.problems = problems;
    throw err;
  }
  return release;
}

// ---- shipping helpers ---------------------------------------------------------------------------

function entryOf(release, key) {
  const entry = release && release.guides && release.guides[key];
  if (!isObject(entry)) throw new Error(`release status has no entry for guide "${key}"`);
  return entry;
}

/**
 * Whether a guide is published in a build. GA guides always are; beta guides only when showBeta is
 * true. This is also the media-manifest contract: an episode, its captions and its transcript ship
 * only when this returns true for their guide (see "Media contract" at the top of this file).
 */
export function isGuideShipped(release, key, showBeta) {
  if (typeof showBeta !== 'boolean') throw new Error('isGuideShipped needs showBeta as a boolean; use parseShowBeta()');
  return entryOf(release, key).status === 'ga' || showBeta;
}

/**
 * Step titles in the beta sections of a GA guide, in section order. These are the steps a build
 * with SA_SHOW_BETA=false leaves out. A beta guide returns [], because the whole guide is beta and
 * isGuideShipped() decides it.
 */
export function betaSteps(release, key) {
  const entry = entryOf(release, key);
  if (entry.status !== 'ga') return [];
  return (entry.sections || []).filter((s) => s.status === 'beta').flatMap((s) => s.steps);
}

/**
 * The status of a guide, or of one of its steps when stepTitle is given. A step in a beta guide is
 * beta. A step in a GA guide takes its section's status, or ga when no section names it.
 */
export function statusOf(release, key, stepTitle) {
  const entry = entryOf(release, key);
  if (stepTitle === undefined || entry.status === 'beta') return entry.status;
  const section = (entry.sections || []).find((s) => Array.isArray(s.steps) && s.steps.includes(stepTitle));
  return section ? section.status : 'ga';
}
