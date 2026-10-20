// Release status for every guide: which guides and steps are GA and which are beta.
//
// What this is for. The guides describe IntelliDash as it runs in production. Some Spatial Adjust
// behaviour exists only on develop and the beta environment. docs/claims/beta-surfaces.md lists
// that behaviour, and src/release.json records one status per guide: "ga" or "beta". A GA guide
// can also hold beta sections, which are steps addressed by their exact title. Everything that
// decides whether beta content is published reads it through this module, so the rule lives in
// one place.
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
const ENTRY_FIELDS = ['status', 'basis', 'sections'];
const SECTION_FIELDS = ['id', 'status', 'basis', 'steps', 'crossReferences'];

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
        if (section.crossReferences !== undefined
          && (!Array.isArray(section.crossReferences) || !section.crossReferences.every(isText))) {
          problems.push(`${at} "crossReferences" must be an array of non-empty strings`);
        }
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

/** Whether a guide is published in a build. GA guides always are; beta guides only when showBeta is true. */
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
