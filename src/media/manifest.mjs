// The media manifest: which video ships with which guide, and the exact bytes it must be.
//
// What it is. src/media/manifest.json maps a catalogue guide key (its Double Click episode) or
// "showcase" (the site-level video) to a file published as a GitHub Release asset. Videos never
// enter git. The manifest pins each asset by byte count and SHA-256, so the build can prove that
// what it copies into dist/media/ is exactly what was encoded and reviewed:
//
//   {
//     "repo": "toroadam/spatial-adjust-guide",
//     "release": "media-v1",                      default release tag for every item
//     "items": {
//       "dashboard-overview": {
//         "kind": "episode",                      "showcase" for the showcase, "episode" otherwise
//         "file": "dashboard-overview.mp4",
//         "bytes": 18234567,
//         "sha256": "<64 lowercase hex>",
//         "duration": 94.2,                       seconds, more than 0 and at most 900
//         "poster": "dashboard-overview.jpg",
//         "posterBytes": 201234,
//         "posterSha256": "<64 lowercase hex>",
//         "captions": "src/media/captions/dashboard-overview.en-us.vtt",
//         "captionLocales": ["en-us"],            optional; the locales that get a caption track, which
//                                                 defaults to all eleven. An episode whose cues have
//                                                 no translation yet lists only "en-us"; the page then
//                                                 offers its English track to every reader, labelled
//                                                 English, rather than a track in a language it is not in
//         "release": "media-v2"                   optional; overrides the top-level tag
//       }
//     }
//   }
//
// Who uses it. build.mjs validates the manifest against the catalogue, verifies every staged asset
// in .media/ and copies the verified ones into dist/media/. scripts/media-budget.mjs holds the size
// caps. The fetch and add scripts and the unit tests reuse these helpers too, which is why this
// module imports nothing from build.mjs or scripts/.
//
// A replaced asset gets a new file name or release tag. Bytes under a pinned hash are never swapped
// in place, so a cached copy can always be trusted once its hash matches.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { CAPTION_LOCALES, SOURCE_LOCALE } from './captions.mjs';

export const SHOWCASE_KEY = 'showcase';
export const DEFAULT_MANIFEST = 'src/media/manifest.json';
export const DEFAULT_MEDIA_DIR = '.media';
export const MAX_DURATION_SECONDS = 900;

const KEY = /^[a-z0-9-]+$/;
const SHA256 = /^[0-9a-f]{64}$/;
// A GitHub release tag that needs no escaping in a download URL.
const TAG = /^[A-Za-z0-9._-]+$/;
// Repo-relative: no leading slash, no backslash, no "." or ".." segment.
const RELATIVE_VTT = /^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[A-Za-z0-9._/-]+\.vtt$/;

// Field order for writeManifest, so a regenerated manifest diffs only where something changed.
const ITEM_FIELDS = ['kind', 'file', 'bytes', 'sha256', 'duration', 'poster', 'posterBytes', 'posterSha256', 'captions', 'captionLocales', 'release'];

const sha = (what) => z.string().regex(SHA256, `${what} must be 64 lowercase hex characters`);
const byteCount = (what) => z.number().int(`${what} must be a whole number`).positive(`${what} must be more than 0`);

const itemSchema = z.strictObject({
  kind: z.enum(['episode', 'showcase']),
  file: z.string().regex(/^[a-z0-9-]+\.mp4$/, 'file must be a lowercase kebab-case name ending in .mp4'),
  bytes: byteCount('bytes'),
  sha256: sha('sha256'),
  duration: z.number()
    .gt(0, 'duration must be more than 0 seconds')
    .lte(MAX_DURATION_SECONDS, `duration must be at most ${MAX_DURATION_SECONDS} seconds`),
  poster: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp)$/, 'poster must be a lowercase kebab-case name ending in .jpg, .png or .webp'),
  posterBytes: byteCount('posterBytes'),
  posterSha256: sha('posterSha256'),
  captions: z.string().regex(RELATIVE_VTT, 'captions must be a repo-relative path to a .vtt file'),
  captionLocales: z.array(z.enum(CAPTION_LOCALES))
    .min(1, 'captionLocales must name at least one locale')
    .refine((list) => new Set(list).size === list.length, 'captionLocales must not repeat a locale')
    .refine((list) => list.includes(SOURCE_LOCALE), `captionLocales must include ${SOURCE_LOCALE}, the source of every track`)
    .optional(),
  release: z.string().regex(TAG, 'release must be a tag of letters, digits, ".", "_" or "-"').optional(),
});

const manifestSchema = z.strictObject({
  repo: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, 'repo must be "owner/name"'),
  release: z.string().regex(TAG, 'release must be a tag of letters, digits, ".", "_" or "-"'),
  items: z.record(z.string(), z.unknown()),
});

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** zod issues as "field: message" lines; the field is omitted for whole-object issues. */
function describeIssues(error) {
  return error.issues.map((issue) => {
    if (issue.code === 'unrecognized_keys') return `unknown field${issue.keys.length === 1 ? '' : 's'} ${issue.keys.map((k) => `"${k}"`).join(', ')}`;
    const field = issue.path.map(String).join('.');
    return field ? `${field}: ${issue.message}` : issue.message;
  });
}

/** Problems with one item on its own: its key, its kind and its fields. No catalogue needed. */
function itemProblems(key, item) {
  const problems = [];
  if (!KEY.test(key)) problems.push('key must be lowercase letters, digits and "-"');
  if (!isObject(item)) return [...problems, 'must be an object'];
  if (key === SHOWCASE_KEY && item.kind !== 'showcase') problems.push(`kind must be "showcase" for the "${SHOWCASE_KEY}" key`);
  if (key !== SHOWCASE_KEY && item.kind === 'showcase') problems.push(`kind "showcase" is only allowed on the "${SHOWCASE_KEY}" key`);
  const parsed = itemSchema.safeParse(item);
  if (!parsed.success) problems.push(...describeIssues(parsed.error));
  return problems;
}

function fail(what, problems) {
  const err = new Error(`${what} (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n- ${problems.join('\n- ')}`);
  err.problems = problems;
  return err;
}

/** Read and parse a manifest file. Throws, naming the path, when it is unreadable or not JSON. */
export async function loadManifest(path = DEFAULT_MANIFEST) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`media manifest ${path} cannot be read: ${err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`media manifest ${path} is not valid JSON: ${err.message}`);
  }
}

/**
 * Check a manifest against the schema and the catalogue. `guideKeys` lists every catalogue guide
 * key (see guideKeysFrom). Every key must be one of them or "showcase". Throws one Error listing
 * every problem, each prefixed with its item key; the list is also on `error.problems`. Returns the
 * manifest unchanged when it is valid.
 */
export function validateManifest(manifest, { guideKeys } = {}) {
  if (!guideKeys || typeof guideKeys[Symbol.iterator] !== 'function') {
    throw new Error('validateManifest needs { guideKeys }: the catalogue guide keys, from guideKeysFrom()');
  }
  const known = new Set(guideKeys);
  const problems = [];
  const parsed = manifestSchema.safeParse(manifest);
  if (!parsed.success) problems.push(...describeIssues(parsed.error).map((p) => `manifest: ${p}`));

  const items = isObject(manifest) && isObject(manifest.items) ? manifest.items : {};
  const owners = new Map(); // asset file name -> the key that claimed it first
  for (const [key, item] of Object.entries(items)) {
    const own = itemProblems(key, item);
    if (key !== SHOWCASE_KEY && KEY.test(key) && !known.has(key)) {
      own.unshift(`not a catalogue guide key or "${SHOWCASE_KEY}"`);
    }
    // Every asset lands flat in dist/media/, so two items naming one file would overwrite each other.
    if (isObject(item)) {
      for (const name of [item.file, item.poster]) {
        if (typeof name !== 'string') continue;
        if (owners.has(name)) own.push(`${name} is already used by "${owners.get(name)}"`);
        else owners.set(name, key);
      }
    }
    problems.push(...own.map((p) => `${key}: ${p}`));
  }
  if (problems.length) throw fail('media manifest is invalid', problems);
  return manifest;
}

/** SHA-256 of a file as 64 lowercase hex characters, streamed so memory stays flat for large videos. */
export async function sha256File(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/** The two assets an item publishes: the video, then the poster, each with its pinned size and hash. */
export function assetsOf(item) {
  return [
    { role: 'video', name: item.file, bytes: item.bytes, sha256: item.sha256 },
    { role: 'poster', name: item.poster, bytes: item.posterBytes, sha256: item.posterSha256 },
  ];
}

/**
 * Check an item's staged video and poster in `mediaDir`. Byte count first, because it is free;
 * the hash only when the size matches. Returns { ok, missing, mismatched }:
 *   missing     file names that are absent (or are not regular files)
 *   mismatched  [{ name, role, field: 'bytes' | 'sha256', expected, actual }]
 */
export async function verifyItem(item, mediaDir = DEFAULT_MEDIA_DIR) {
  const missing = [];
  const mismatched = [];
  for (const asset of assetsOf(item)) {
    const path = join(mediaDir, asset.name);
    let info;
    try {
      info = await stat(path);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    if (!info || !info.isFile()) { missing.push(asset.name); continue; }
    if (info.size !== asset.bytes) {
      mismatched.push({ name: asset.name, role: asset.role, field: 'bytes', expected: asset.bytes, actual: info.size });
      continue;
    }
    const actual = await sha256File(path);
    if (actual !== asset.sha256) {
      mismatched.push({ name: asset.name, role: asset.role, field: 'sha256', expected: asset.sha256, actual });
    }
  }
  return { ok: missing.length === 0 && mismatched.length === 0, missing, mismatched };
}

/** Public download URL of one of an item's assets. The item's own release tag wins over the default. */
export function assetUrl(manifest, item, name) {
  return `https://github.com/${manifest.repo}/releases/download/${item.release || manifest.release}/${name}`;
}

/** An item with its fields in the canonical order; fields outside it follow, as they came. */
function ordered(item) {
  if (!isObject(item)) return item;
  const out = {};
  for (const field of ITEM_FIELDS) if (item[field] !== undefined) out[field] = item[field];
  for (const [field, value] of Object.entries(item)) if (!(field in out)) out[field] = value;
  return out;
}

/** Write a manifest with its items sorted by key, 2-space JSON and a trailing newline. */
export async function writeManifest(path, manifest) {
  const items = {};
  for (const key of Object.keys(manifest.items || {}).sort()) items[key] = ordered(manifest.items[key]);
  const { repo, release, items: _items, ...rest } = manifest;
  await writeFile(path, JSON.stringify({ repo, release, ...rest, items }, null, 2) + '\n');
}

/**
 * Add or replace one item, in place, and return the manifest. Checks the key and the item's own
 * fields (not catalogue membership, which needs the built export) and throws on any problem, so a
 * bad entry never reaches the file.
 */
export function upsertItem(manifest, key, item) {
  if (!isObject(manifest)) throw new Error('upsertItem needs a manifest object');
  const problems = itemProblems(key, item);
  if (problems.length) throw fail(`media item "${key}" is invalid`, problems.map((p) => `${key}: ${p}`));
  if (!isObject(manifest.items)) manifest.items = {};
  manifest.items[key] = ordered(item);
  return manifest;
}

/**
 * The catalogue guide keys in the transformed guide export, in catalogue order. A tile literal opens
 * `{ key: '<key>', title: ...`; transforms may insert boolean or numeric flags between the two (the
 * "new in IntelliDash" flag does), so those are allowed. Throws when nothing matches, which means
 * the export changed shape and every manifest key would otherwise look unknown.
 */
export function guideKeysFrom(html) {
  const keys = [];
  for (const [, key] of String(html).matchAll(/\{ key: '([a-z0-9-]+)',(?: \w+: (?:true|false|-?\d+(?:\.\d+)?),)* title:/g)) {
    if (!keys.includes(key)) keys.push(key);
  }
  if (!keys.length) {
    throw new Error("no catalogue entries of the form { key: '...', title: ... } in the guide export; check it against src/media/manifest.mjs#guideKeysFrom");
  }
  return keys;
}
