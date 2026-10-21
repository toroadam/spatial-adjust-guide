// Turn a finished render into the web encode the site ships, pin it in the manifest, and print the
// commands that publish it. A local helper for the owner: it needs ffmpeg and ffprobe
// (brew install ffmpeg) and never runs in CI.
//
//   node scripts/media-add.mjs --key <guide key | showcase> --source <render>
//                              [--poster <image>] [--release media-vN] [--replace]
//                              [--bitrate <bits per second>] [--manifest <path>] [--dir .media]
//
// What it does, in order:
//   1. ffprobe the render's duration. The cap is SHOWCASE_MAX_BYTES for "showcase" and
//      EPISODE_MAX_BYTES otherwise (scripts/media-budget.mjs). The video bitrate is sized from the
//      duration so the file lands under the cap with headroom for the container and for two-pass
//      overshoot: min(4 Mb/s, floor(cap x 0.92 x 8 / seconds) - 128 kb/s for the audio).
//   2. Two-pass encode to 1080p H.264 High + AAC-LC 128 kb/s 48 kHz stereo, with +faststart so
//      playback starts before the whole file arrives. x264 has no screen-content tune; -tune
//      stillimage with two-pass ABR keeps UI text sharp under the cap where CRF could not promise a
//      byte ceiling. Source metadata is stripped, so no file path or tool name ends up in the asset.
//   3. A poster JPEG: the supplied image scaled to 1920 wide, or the frame at 10% of the duration.
//   4. Checks the result (codec, profile, height, audio, moov before mdat), its byte count against
//      the cap and its SHA-256, then moves both files into .media/ and upserts the manifest entry
//      with its captions path, src/media/captions/<key>.en-us.vtt.
//   5. PRINTS the gh commands that create the release (when the tag is new) and upload both assets.
//      It never runs them: creating releases needs contents: write, which CI must not have.
//
// Bytes under a pinned hash are never swapped in place. When the manifest already pins this key to
// different bytes the script refuses, unless --replace is passed together with a --release tag that
// differs from the one the key uses now; the upload command has no --clobber for the same reason.
// Everything is encoded into a scratch directory first, so a failed or over-cap encode leaves the
// staged files and the manifest untouched.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  DEFAULT_MANIFEST, DEFAULT_MEDIA_DIR, MAX_DURATION_SECONDS, SHOWCASE_KEY,
  guideKeysFrom, loadManifest, sha256File, upsertItem, writeManifest,
} from '../src/media/manifest.mjs';
import { EPISODE_MAX_BYTES, SHOWCASE_MAX_BYTES } from './media-budget.mjs';
import { loadRelease } from '../src/release.mjs';
import { transformGuide } from '../src/transform-export.mjs';

const ROOT = join(import.meta.dirname, '..');
const ENTRY = 'Learn Spatial Adjust.dc.html';
const REPO = 'toroadam/spatial-adjust-guide';
const KEY = /^[a-z0-9-]+$/;
const TAG = /^[A-Za-z0-9._-]+$/;
export const MAX_VIDEO_BITRATE = 4_000_000;
export const AUDIO_BITRATE = 128_000;
const MIN_VIDEO_BITRATE = 150_000; // below this x264 output is unwatchable; the render is too long
const POSTER_WIDTH = 1920;
const fmt = (n) => n.toLocaleString('en-US');

/**
 * The catalogue guide keys as the build sees them: the raw Core Design export run through the same
 * transforms as build.mjs, with beta shown. The raw export alone lists only the guides Core Design
 * knew about; transforms add the rest (filter-adjustments and request-scan-data), so reading the
 * raw file made those two keys look unknown.
 */
export async function catalogueKeys(root = ROOT) {
  const raw = await readFile(join(root, ENTRY), 'utf8');
  const { release } = loadRelease();
  const keys = guideKeysFrom(transformGuide(raw, { showBeta: true, release }));
  for (const key of Object.keys((release && release.guides) || {})) if (!keys.includes(key)) keys.push(key);
  return keys;
}

/** The byte cap for a key: the showcase has its own, every guide episode shares the other. */
export function capForKey(key) {
  return key === SHOWCASE_KEY ? SHOWCASE_MAX_BYTES : EPISODE_MAX_BYTES;
}

/** Video bitrate in bits per second that keeps `seconds` of video plus 128 kb/s audio under `cap`. */
export function videoBitrate(cap, seconds) {
  return Math.min(MAX_VIDEO_BITRATE, Math.floor((cap * 0.92 * 8) / seconds) - AUDIO_BITRATE);
}

/** ffmpeg arguments for one pass of the two-pass encode. Pass 1 analyses only and writes no file. */
export function encodeArgs({ source, rate, pass, passlog, output }) {
  const video = [
    '-map', '0:v:0', '-vf', 'scale=-2:1080',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'stillimage', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-b:v', String(rate), '-pass', String(pass), '-passlogfile', passlog,
  ];
  const head = ['-hide_banner', '-loglevel', 'error', '-stats', '-y', '-i', source];
  if (pass === 1) return [...head, ...video, '-an', '-f', 'null', '-'];
  return [
    ...head, ...video,
    '-map', '0:a:0', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-map_metadata', '-1', '-map_chapters', '-1',
    '-movflags', '+faststart', output,
  ];
}

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'] });
    let out = '';
    let err = '';
    if (capture) {
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { err += d; });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(out);
      else reject(new Error(`${cmd} exited ${code}${err ? `: ${err.trim()}` : ''}`));
    });
  });
}

async function probe(path) {
  const json = await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], { capture: true });
  return JSON.parse(json);
}

/** Fail clearly when ffmpeg or ffprobe is not installed, before any work starts. */
function requireTools() {
  const missing = ['ffmpeg', 'ffprobe'].filter((tool) => {
    const r = spawnSync(tool, ['-version'], { stdio: 'ignore' });
    return r.error || r.status !== 0;
  });
  if (missing.length) {
    throw new Error(`${missing.join(' and ')} not found on PATH. This helper encodes locally and never runs in CI; install them with: brew install ffmpeg`);
  }
}

/**
 * Top-level MP4 box types from the start of the file, up to and including the first mdat. With
 * +faststart, moov comes before mdat, which is what lets a browser start playing a partial download.
 */
export async function topLevelBoxes(path) {
  const handle = await open(path, 'r');
  const types = [];
  try {
    const { size } = await handle.stat();
    const header = Buffer.alloc(16);
    let at = 0;
    while (at + 8 <= size && types.length < 64) {
      await handle.read(header, 0, 16, at);
      let length = header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      if (length === 1) length = Number(header.readBigUInt64BE(8));
      else if (length === 0) length = size - at;
      types.push(type);
      if (type === 'mdat' || length < 8) break;
      at += length;
    }
  } finally {
    await handle.close();
  }
  return types;
}

/** Problems with an encode: anything that is not 1080p H.264 High + AAC stereo 48 kHz with moov first. */
export async function checkEncode(path) {
  const info = await probe(path);
  const problems = [];
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  if (!v) problems.push('no video stream');
  else {
    if (v.codec_name !== 'h264') problems.push(`video codec is ${v.codec_name}, not h264`);
    if (v.profile !== 'High') problems.push(`H.264 profile is ${v.profile}, not High`);
    if (v.height !== 1080) problems.push(`video height is ${v.height}, not 1080`);
    if (v.pix_fmt !== 'yuv420p') problems.push(`pixel format is ${v.pix_fmt}, not yuv420p`);
  }
  if (!a) problems.push('no audio stream');
  else {
    if (a.codec_name !== 'aac') problems.push(`audio codec is ${a.codec_name}, not aac`);
    if (a.channels !== 2) problems.push(`audio has ${a.channels} channels, not 2`);
    if (a.sample_rate !== '48000') problems.push(`audio sample rate is ${a.sample_rate}, not 48000`);
  }
  const boxes = await topLevelBoxes(path);
  if (boxes.indexOf('moov') < 0 || boxes.indexOf('moov') > boxes.indexOf('mdat')) {
    problems.push(`moov is not before mdat (top-level boxes: ${boxes.join(', ')}); +faststart did not apply`);
  }
  return { problems, info, video: v, audio: a };
}

/** Is `tag` already a published release? Asks the public API; null when the answer is unknown. */
async function releaseExists(tag) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

const shell = (path) => {
  const rel = relative(process.cwd(), path);
  const shown = rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : path;
  return /^[A-Za-z0-9._/-]+$/.test(shown) ? shown : `'${shown.replaceAll("'", "'\\''")}'`;
};

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      key: { type: 'string' },
      source: { type: 'string' },
      poster: { type: 'string' },
      release: { type: 'string' },
      replace: { type: 'boolean', default: false },
      bitrate: { type: 'string' },
      manifest: { type: 'string', default: DEFAULT_MANIFEST },
      dir: { type: 'string', default: DEFAULT_MEDIA_DIR },
    },
  });
  const { key, release } = values;
  if (!key || !values.source) throw new Error('usage: node scripts/media-add.mjs --key <guide key | showcase> --source <render> [--poster <image>] [--release media-vN] [--replace]');
  if (!KEY.test(key)) throw new Error(`--key must be lowercase letters, digits and "-"; received ${JSON.stringify(key)}`);
  if (release !== undefined && !TAG.test(release)) throw new Error(`--release must be a tag of letters, digits, ".", "_" or "-"; received ${JSON.stringify(release)}`);
  const source = resolve(values.source);
  const posterSource = values.poster ? resolve(values.poster) : null;
  for (const [flag, path] of [['--source', source], ['--poster', posterSource]]) {
    if (path && !(existsSync(path) && (await stat(path)).isFile())) throw new Error(`${flag} ${path} is not a file`);
  }
  requireTools();

  const manifestPath = resolve(ROOT, values.manifest);
  const mediaDir = resolve(ROOT, values.dir);
  const manifest = await loadManifest(manifestPath);
  const existing = manifest.items && manifest.items[key];
  const currentTag = existing ? existing.release || manifest.release : null;
  const tag = release || (existing ? currentTag : manifest.release);
  if (values.replace) {
    if (!existing) throw new Error(`--replace given, but the manifest has no "${key}" item to replace`);
    if (!release || release === currentTag) {
      throw new Error(`--replace needs a new --release tag: "${key}" is published under ${currentTag}, and bytes under a pinned hash are never swapped in place`);
    }
  }

  // The catalogue check proper happens in the build, against the transformed export. Checking the
  // same transformed catalogue here catches a typo before a long encode; it warns rather than fails.
  let unknownKey = false;
  if (key !== SHOWCASE_KEY) {
    try {
      unknownKey = !(await catalogueKeys()).includes(key);
    } catch { /* export unreadable: the build will say so */ }
    if (unknownKey) console.warn(`warning: "${key}" is not a catalogue guide key in ${ENTRY} after the build's transforms; the build will reject it`);
  }

  // Duration and stream check on the render.
  const src = await probe(source);
  const seconds = Number(src.format && src.format.duration);
  if (!src.streams.some((s) => s.codec_type === 'video')) throw new Error(`${values.source} has no video stream`);
  if (!src.streams.some((s) => s.codec_type === 'audio')) {
    throw new Error(`${values.source} has no audio stream. Every episode and the showcase ship with sound; re-export the render with its narration or music`);
  }
  if (!(seconds > 0)) throw new Error(`ffprobe reports no duration for ${values.source}`);
  if (seconds > MAX_DURATION_SECONDS) throw new Error(`${values.source} runs ${seconds.toFixed(1)} s, over the ${MAX_DURATION_SECONDS} s the manifest allows`);

  const kind = key === SHOWCASE_KEY ? 'showcase' : 'episode';
  const cap = capForKey(key);
  let rate = videoBitrate(cap, seconds);
  if (values.bitrate !== undefined) {
    const asked = Number(values.bitrate);
    if (!Number.isInteger(asked) || asked <= 0) throw new Error(`--bitrate must be a whole number of bits per second; received ${JSON.stringify(values.bitrate)}`);
    if (asked > rate) throw new Error(`--bitrate ${fmt(asked)} is above the ${fmt(rate)} b/s that ${seconds.toFixed(1)} s can afford under the ${fmt(cap)}-byte cap`);
    rate = asked;
  }
  if (rate < MIN_VIDEO_BITRATE) {
    throw new Error(`${seconds.toFixed(1)} s leaves only ${fmt(rate)} b/s of video under the ${fmt(cap)}-byte ${kind} cap; shorten the render`);
  }
  console.log(`media-add: ${key} (${kind}), ${seconds.toFixed(1)} s, cap ${fmt(cap)} bytes, video ${fmt(rate)} b/s + audio ${fmt(AUDIO_BITRATE)} b/s`);

  // Encode into a scratch directory beside .media/, so the move into place is a same-disk rename and
  // nothing staged is touched until every check has passed.
  await mkdir(mediaDir, { recursive: true });
  const work = join(mediaDir, `.add-${key}-${process.pid}`);
  await rm(work, { recursive: true, force: true });
  await mkdir(work);
  try {
    const video = join(work, `${key}.mp4`);
    const poster = join(work, `${key}.jpg`);
    const passlog = join(work, 'ffmpeg2pass');
    console.log('media-add: pass 1 of 2');
    await run('ffmpeg', encodeArgs({ source, rate, pass: 1, passlog }));
    console.log('media-add: pass 2 of 2');
    await run('ffmpeg', encodeArgs({ source, rate, pass: 2, passlog, output: video }));

    const posterArgs = posterSource
      ? ['-i', posterSource]
      : ['-ss', (seconds * 0.1).toFixed(3), '-i', source];
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', ...posterArgs,
      '-frames:v', '1', '-vf', `scale=${POSTER_WIDTH}:-2`, '-q:v', '3', '-map_metadata', '-1', poster,
    ]);

    const { problems, info } = await checkEncode(video);
    if (problems.length) throw new Error(`the encode is not what the site ships:\n- ${problems.join('\n- ')}`);
    const bytes = (await stat(video)).size;
    if (bytes > cap) {
      throw new Error(`the encode is ${fmt(bytes)} bytes, over the ${fmt(cap)}-byte ${kind} cap by ${fmt(bytes - cap)}; `
        + `retry with --bitrate ${Math.floor((rate * cap * 0.97) / bytes)}`);
    }
    const duration = Math.max(0.1, Math.round(Number(info.format.duration) * 10) / 10);
    const item = {
      kind,
      file: `${key}.mp4`,
      bytes,
      sha256: await sha256File(video),
      duration,
      poster: `${key}.jpg`,
      posterBytes: (await stat(poster)).size,
      posterSha256: await sha256File(poster),
      captions: `src/media/captions/${key}.en-us.vtt`,
      ...(tag !== manifest.release ? { release: tag } : {}),
    };

    const sameBytes = existing && existing.sha256 === item.sha256 && existing.posterSha256 === item.posterSha256;
    if (existing && !sameBytes && !values.replace) {
      throw new Error(`the manifest already pins "${key}" to other bytes under ${currentTag}. Bytes under a pinned hash are never swapped in place: `
        + `pass --replace --release <new tag> to publish this encode under a new release`);
    }

    // Every check passed: move the encode into place and pin it.
    await rename(video, join(mediaDir, item.file));
    await rename(poster, join(mediaDir, item.poster));
    upsertItem(manifest, key, item);
    await writeManifest(manifestPath, manifest);
    console.log(`media-add: ${item.file} ${fmt(bytes)} bytes (${((bytes / cap) * 100).toFixed(1)}% of cap), sha256 ${item.sha256}`);
    console.log(`media-add: ${item.poster} ${fmt(item.posterBytes)} bytes, sha256 ${item.posterSha256}`);
    console.log(`media-add: ${sameBytes ? 'manifest already pinned these bytes' : `pinned "${key}" in ${shell(manifestPath)}`} (release ${tag})`);
    if (!existsSync(resolve(ROOT, item.captions))) {
      console.warn(`warning: ${item.captions} does not exist yet; write the English captions before this video ships`);
    }
    if (unknownKey) console.warn(`warning: "${key}" is not a catalogue guide key in ${ENTRY}`);

    // The owner publishes. Creating a release and uploading assets need contents: write.
    const exists = await releaseExists(tag);
    const usedByOthers = Object.entries(manifest.items).some(([k, it]) => k !== key && (it.release || manifest.release) === tag);
    const commands = [];
    if (exists === false || (exists === null && !usedByOthers)) {
      commands.push(`gh release create ${tag} --repo ${REPO} --title 'Guide media ${tag}' --notes 'Web encodes for the guides site; see README > Video'`);
    }
    commands.push(`gh release upload ${tag} ${shell(join(mediaDir, item.file))} ${shell(join(mediaDir, item.poster))} --repo ${REPO}`);
    console.log(`\nTo publish, run${exists === null ? ` (could not reach GitHub to check whether ${tag} exists${usedByOthers ? '; another item already uses it, so it is assumed to' : ''})` : ''}:\n`);
    for (const c of commands) console.log(`  ${c}`);
    console.log('\nThen commit the manifest change. The deploy downloads both assets and checks their SHA-256 before shipping them.');
    return 0;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(`media-add: ${err.message}`);
    process.exitCode = 1;
  }
}
