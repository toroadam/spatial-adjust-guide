// Make the placeholder clip and its manifest, for checking the player, the hosting and the captions
// before any real episode exists. Everything goes into .media-fixture/, which is gitignored: the
// placeholder never enters the committed manifest or the published site.
//
//   npm run media:placeholder               needs ffmpeg and ffprobe (brew install ffmpeg)
//   npm run media:placeholder -- --dummy    no ffmpeg: deterministic bytes that decode as nothing
//
// Writes:
//   .media-fixture/placeholder.mp4          8 s of ffmpeg testsrc2 at 1920x1080 with a 440 Hz tone,
//                                           encoded with exactly the settings npm run media:add uses
//                                           (two-pass 1080p H.264 High, AAC-LC 128 kb/s 48 kHz
//                                           stereo, +faststart), and checked the same way
//   .media-fixture/placeholder.jpg          its poster, the frame at 10% of the duration
//   .media-fixture/placeholder-showcase.*   the same bytes again for the showcase item: every asset
//                                           lands flat in dist/media/, so the manifest refuses two
//                                           items that name one file
//   .media-fixture/manifest.json            items "dashboard-overview" and "showcase", pinned by byte
//                                           count and SHA-256, captions from
//                                           scripts/fixtures/media/placeholder.en-us.vtt
//
// Then build and serve the site with it:
//
//   SA_MEDIA_MANIFEST=.media-fixture/manifest.json SA_MEDIA_DIR=.media-fixture \
//     SA_MEDIA_CAPTIONS_DIR=scripts/fixtures/media/captions npm run build && npm run serve
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { sha256File, upsertItem, verifyItem, writeManifest } from '../src/media/manifest.mjs';
import { checkEncode, encodeArgs, videoBitrate } from './media-add.mjs';
import { EPISODE_MAX_BYTES } from './media-budget.mjs';
import { PLACEHOLDER_CAPTIONS, dummyVideoBytes } from './lib/media-fixture.mjs';

const ROOT = join(import.meta.dirname, '..');
export const FIXTURE_DIR = join(ROOT, '.media-fixture');
const SECONDS = 8;

// A tiny valid JPEG for --dummy, so the poster still paints without ffmpeg.
const DUMMY_POSTER = Buffer.from(
  '/9j/4AAQSkZJRgABAgAAAQABAAD/2wBDAAgGBgcGBwgICAgICAkJCQoKCgkJCQkKCgoKCgoMDAwKCgoKCgoKDAwMDA0ODQ0NDA0ODg8PDxISEREVFRUZGR//'
  + 'xABLAAEBAAAAAAAAAAAAAAAAAAAABgEBAAAAAAAAAAAAAAAAAAAABhABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAAkAEAMBIgAC'
  + 'EQADEQD/2gAMAwEAAhEDEQA/AJEA+GH/2Q==',
  'base64',
);

// The two fixture items: the key, its asset names and its kind.
const ITEMS = [
  { key: 'dashboard-overview', kind: 'episode', file: 'placeholder.mp4', poster: 'placeholder.jpg' },
  { key: 'showcase', kind: 'showcase', file: 'placeholder-showcase.mp4', poster: 'placeholder-showcase.jpg' },
];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`);
}

function haveTools() {
  return ['ffmpeg', 'ffprobe'].every((tool) => {
    const r = spawnSync(tool, ['-version'], { stdio: 'ignore' });
    return !r.error && r.status === 0;
  });
}

/** Encode the placeholder into `video` and `poster`. Returns its duration in seconds. */
async function encode(work, video, poster) {
  // A lossless source with both streams, so the encode below is media-add's, argument for argument.
  const source = join(work, 'source.mkv');
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `testsrc2=size=1920x1080:rate=30:duration=${SECONDS}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${SECONDS}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', '-c:a', 'pcm_s16le', '-shortest', source,
  ]);
  const rate = videoBitrate(EPISODE_MAX_BYTES, SECONDS);
  const passlog = join(work, 'ffmpeg2pass');
  console.log('media-placeholder: pass 1 of 2');
  run('ffmpeg', encodeArgs({ source, rate, pass: 1, passlog }));
  console.log('media-placeholder: pass 2 of 2');
  run('ffmpeg', encodeArgs({ source, rate, pass: 2, passlog, output: video }));
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-ss', (SECONDS * 0.1).toFixed(3), '-i', source,
    '-frames:v', '1', '-vf', 'scale=1920:-2', '-q:v', '3', '-map_metadata', '-1', poster,
  ]);
  const { problems, info } = await checkEncode(video);
  if (problems.length) throw new Error(`the placeholder is not what the site ships:\n- ${problems.join('\n- ')}`);
  return Math.max(0.1, Math.round(Number(info.format.duration) * 10) / 10);
}

async function main(argv) {
  const { values } = parseArgs({ args: argv, options: { dummy: { type: 'boolean', default: false } } });
  if (!values.dummy && !haveTools()) {
    throw new Error('ffmpeg and ffprobe not found on PATH. Install them (brew install ffmpeg), or pass --dummy '
      + 'for bytes that build and serve but do not play.');
  }

  await mkdir(FIXTURE_DIR, { recursive: true });
  const work = join(FIXTURE_DIR, `.work-${process.pid}`);
  await rm(work, { recursive: true, force: true });
  await mkdir(work);
  try {
    const [first, second] = ITEMS;
    const video = join(FIXTURE_DIR, first.file);
    const poster = join(FIXTURE_DIR, first.poster);
    let duration = SECONDS;
    if (values.dummy) {
      await writeFile(video, dummyVideoBytes());
      await writeFile(poster, DUMMY_POSTER);
    } else {
      const encoded = join(work, first.file);
      const still = join(work, first.poster);
      duration = await encode(work, encoded, still);
      await copyFile(encoded, video);
      await copyFile(still, poster);
    }
    await copyFile(video, join(FIXTURE_DIR, second.file));
    await copyFile(poster, join(FIXTURE_DIR, second.poster));

    const manifest = { repo: 'toroadam/spatial-adjust-guide', release: 'placeholder', items: {} };
    for (const it of ITEMS) {
      const v = join(FIXTURE_DIR, it.file);
      const p = join(FIXTURE_DIR, it.poster);
      upsertItem(manifest, it.key, {
        kind: it.kind,
        file: it.file,
        bytes: (await stat(v)).size,
        sha256: await sha256File(v),
        duration,
        poster: it.poster,
        posterBytes: (await stat(p)).size,
        posterSha256: await sha256File(p),
        captions: PLACEHOLDER_CAPTIONS,
      });
    }
    const manifestPath = join(FIXTURE_DIR, 'manifest.json');
    await writeManifest(manifestPath, manifest);

    // Prove the pins, exactly as build.mjs will.
    for (const it of ITEMS) {
      const { ok, missing, mismatched } = await verifyItem(manifest.items[it.key], FIXTURE_DIR);
      if (!ok) throw new Error(`${it.key}: the files do not match the manifest just written (${JSON.stringify({ missing, mismatched })})`);
    }

    const rel = (p) => relative(process.cwd(), p) || '.';
    const kind = values.dummy ? 'dummy bytes, which do not play' : `${duration} s, ${(await stat(video)).size.toLocaleString('en-US')} bytes`;
    console.log(`media-placeholder: wrote ${rel(video)} (${kind}), ${rel(poster)} and ${rel(manifestPath)}`);
    console.log('\nBuild and serve the site with it:\n');
    console.log('  SA_MEDIA_MANIFEST=.media-fixture/manifest.json SA_MEDIA_DIR=.media-fixture \\');
    console.log('    SA_MEDIA_CAPTIONS_DIR=scripts/fixtures/media/captions npm run build && npm run serve');
    return 0;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(`media-placeholder: ${err.message}`);
    process.exitCode = 1;
  }
}
