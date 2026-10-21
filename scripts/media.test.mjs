// Unit tests for the media layer's Node side: the manifest, checksum verification, the size budget,
// WebVTT handling, caption localization, locale parity with the site, and the two repository guards.
//
//   node --test scripts/media.test.mjs        (npm run test:media, and the last step of npm test)
//
// Every temporary file lives under os.tmpdir() and is removed in an after() hook; nothing here
// writes into the repository. The browser side of the panel is covered by smoke.mjs and the other
// Playwright scripts, driven by scripts/lib/media-fixture.mjs.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SHOWCASE_KEY, assetsOf, guideKeysFrom, loadManifest, sha256File, upsertItem, validateManifest, verifyItem } from '../src/media/manifest.mjs';
import { parseVtt, serializeVtt } from '../src/media/vtt.mjs';
import {
  CAPTION_LOCALES, TRANSLATED_LOCALES, captionTracks, loadCaptionCatalogues, localizeCues, writeCaptionTracks,
} from '../src/media/captions.mjs';
import { catalogueKeys } from './media-add.mjs';
import {
  EPISODE_MAX_BYTES, SHOWCASE_MAX_BYTES, SITE_MAX_BYTES, capFor, checkItems, checkSite, dirBytes,
} from './media-budget.mjs';
import { VIDEO, lfsLines } from './media-git-guard.mjs';
import { FIXTURE_CATALOGUES, PLACEHOLDER_CAPTIONS } from './lib/media-fixture.mjs';

const ROOT = join(import.meta.dirname, '..');
const HEX_A = 'a'.repeat(64);
const HEX_B = 'b'.repeat(64);
const GUIDE_KEYS = ['dashboard-overview', 'target-profiles', 'minimum-threshold'];

/** A complete, valid episode item. Tests copy it and break one thing at a time. */
function goodEpisode(overrides = {}) {
  return {
    kind: 'episode',
    file: 'dashboard-overview.mp4',
    bytes: 18_234_567,
    sha256: HEX_A,
    duration: 94.2,
    poster: 'dashboard-overview.jpg',
    posterBytes: 201_234,
    posterSha256: HEX_B,
    captions: 'src/media/captions/dashboard-overview.en-us.vtt',
    ...overrides,
  };
}

function goodShowcase(overrides = {}) {
  return goodEpisode({
    kind: 'showcase',
    file: 'showcase.mp4',
    bytes: 38_000_000,
    poster: 'showcase.jpg',
    captions: 'src/media/captions/showcase.en-us.vtt',
    ...overrides,
  });
}

const manifestOf = (items) => ({ repo: 'toroadam/spatial-adjust-guide', release: 'media-v1', items });

/** The problems validateManifest reports, or [] when it accepts the manifest. */
function problemsOf(manifest) {
  try {
    validateManifest(manifest, { guideKeys: GUIDE_KEYS });
    return [];
  } catch (err) {
    assert.ok(Array.isArray(err.problems), `validateManifest threw without a problems list: ${err.message}`);
    return err.problems;
  }
}

// ---- manifest ------------------------------------------------------------------------------------

describe('media manifest validation', () => {
  test('a good episode and a good showcase pass', () => {
    const manifest = manifestOf({ 'dashboard-overview': goodEpisode(), [SHOWCASE_KEY]: goodShowcase() });
    assert.equal(validateManifest(manifest, { guideKeys: GUIDE_KEYS }), manifest);
  });

  test('the committed manifest is valid against an empty catalogue when it has no items', async () => {
    const committed = JSON.parse(await readFile(join(ROOT, 'src/media/manifest.json'), 'utf8'));
    if (Object.keys(committed.items || {}).length === 0) {
      assert.doesNotThrow(() => validateManifest(committed, { guideKeys: [] }));
    } else {
      // Items need the real catalogue keys, which come from the built export; build.mjs checks those.
      assert.equal(typeof committed.items, 'object');
    }
  });

  test('a key that is not a catalogue guide or "showcase" fails', () => {
    const problems = problemsOf(manifestOf({ 'no-such-guide': goodEpisode({ file: 'no-such-guide.mp4', poster: 'no-such-guide.jpg' }) }));
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0], /^no-such-guide: not a catalogue guide key or "showcase"$/);
  });

  test('a key that is not lowercase kebab-case fails', () => {
    const problems = problemsOf(manifestOf({ Dashboard_Overview: goodEpisode() }));
    assert.ok(problems.some((p) => /Dashboard_Overview: key must be lowercase/.test(p)), problems.join('\n'));
  });

  test('a bad sha256 fails, for the video and for the poster', () => {
    for (const [field, value] of [['sha256', 'A'.repeat(64)], ['sha256', 'a'.repeat(63)], ['posterSha256', 'not-a-hash']]) {
      const problems = problemsOf(manifestOf({ 'dashboard-overview': goodEpisode({ [field]: value }) }));
      assert.ok(
        problems.some((p) => p.startsWith(`dashboard-overview: ${field}:`) && /64 lowercase hex/.test(p)),
        `${field}=${value}: ${problems.join('\n')}`,
      );
    }
  });

  test('kind "episode" on the showcase key fails', () => {
    const problems = problemsOf(manifestOf({ [SHOWCASE_KEY]: goodShowcase({ kind: 'episode' }) }));
    assert.ok(problems.some((p) => /showcase: kind must be "showcase" for the "showcase" key/.test(p)), problems.join('\n'));
  });

  test('kind "showcase" on a guide key fails', () => {
    const problems = problemsOf(manifestOf({ 'dashboard-overview': goodEpisode({ kind: 'showcase' }) }));
    assert.ok(problems.some((p) => /dashboard-overview: kind "showcase" is only allowed on the "showcase" key/.test(p)), problems.join('\n'));
  });

  test('an unknown item field, a non-positive byte count and an over-long duration fail', () => {
    const problems = problemsOf(manifestOf({
      'dashboard-overview': goodEpisode({ url: 'https://example.invalid/x.mp4' }),
      'target-profiles': goodEpisode({ file: 'target-profiles.mp4', poster: 'target-profiles.jpg', bytes: 0, duration: 901 }),
    }));
    assert.ok(problems.some((p) => /dashboard-overview: unknown field "url"/.test(p)), problems.join('\n'));
    assert.ok(problems.some((p) => /target-profiles: bytes: bytes must be more than 0/.test(p)), problems.join('\n'));
    assert.ok(problems.some((p) => /target-profiles: duration: duration must be at most 900 seconds/.test(p)), problems.join('\n'));
  });

  test('two items naming the same asset fail', () => {
    const problems = problemsOf(manifestOf({
      'dashboard-overview': goodEpisode(),
      'target-profiles': goodEpisode(),
    }));
    assert.ok(problems.some((p) => /target-profiles: dashboard-overview\.mp4 is already used by "dashboard-overview"/.test(p)), problems.join('\n'));
  });

  test('validateManifest refuses to run without the catalogue keys', () => {
    assert.throws(() => validateManifest(manifestOf({})), /needs \{ guideKeys \}/);
  });

  test('upsertItem refuses an invalid item and leaves the manifest unchanged', () => {
    const manifest = manifestOf({});
    assert.throws(() => upsertItem(manifest, 'dashboard-overview', goodEpisode({ sha256: 'x' })), /media item "dashboard-overview" is invalid/);
    assert.deepEqual(manifest.items, {});
    upsertItem(manifest, 'dashboard-overview', goodEpisode());
    assert.deepEqual(Object.keys(manifest.items), ['dashboard-overview']);
  });
});

// ---- checksums -----------------------------------------------------------------------------------

describe('verifyItem', () => {
  let dir;
  const video = Buffer.from('fake video bytes for the media unit tests\n'.repeat(64));
  const poster = Buffer.from('fake poster bytes\n');
  const sha = (buf) => createHash('sha256').update(buf).digest('hex');
  const pinned = (overrides = {}) => goodEpisode({
    bytes: video.length, sha256: sha(video), posterBytes: poster.length, posterSha256: sha(poster), ...overrides,
  });

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sa-media-verify-'));
    await writeFile(join(dir, 'dashboard-overview.mp4'), video);
    await writeFile(join(dir, 'dashboard-overview.jpg'), poster);
  });
  after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  test('sha256File hashes a file exactly as crypto does', async () => {
    assert.equal(await sha256File(join(dir, 'dashboard-overview.mp4')), sha(video));
  });

  test('assets matching their pinned size and hash verify', async () => {
    assert.deepEqual(await verifyItem(pinned(), dir), { ok: true, missing: [], mismatched: [] });
  });

  test('a byte-count mismatch is reported, without hashing', async () => {
    const r = await verifyItem(pinned({ bytes: video.length + 1 }), dir);
    assert.equal(r.ok, false);
    assert.deepEqual(r.mismatched, [{
      name: 'dashboard-overview.mp4', role: 'video', field: 'bytes', expected: video.length + 1, actual: video.length,
    }]);
  });

  test('a hash mismatch at the right size is reported', async () => {
    const r = await verifyItem(pinned({ posterSha256: HEX_A }), dir);
    assert.equal(r.ok, false);
    assert.deepEqual(r.mismatched, [{
      name: 'dashboard-overview.jpg', role: 'poster', field: 'sha256', expected: HEX_A, actual: sha(poster),
    }]);
  });

  test('same size, one byte changed, is a hash mismatch', async () => {
    const altered = Buffer.from(video);
    altered[10] ^= 0xff;
    await writeFile(join(dir, 'altered.mp4'), altered);
    const r = await verifyItem(pinned({ file: 'altered.mp4' }), dir);
    assert.equal(r.ok, false);
    assert.equal(r.mismatched.length, 1);
    assert.equal(r.mismatched[0].field, 'sha256');
    assert.equal(r.mismatched[0].actual, sha(altered));
  });

  test('a missing asset is reported as missing', async () => {
    const r = await verifyItem(pinned({ file: 'absent.mp4' }), dir);
    assert.deepEqual(r, { ok: false, missing: ['absent.mp4'], mismatched: [] });
  });

  test('assetsOf lists the video then the poster with their pins', () => {
    assert.deepEqual(assetsOf(goodEpisode()).map((a) => [a.role, a.name, a.bytes, a.sha256]), [
      ['video', 'dashboard-overview.mp4', 18_234_567, HEX_A],
      ['poster', 'dashboard-overview.jpg', 201_234, HEX_B],
    ]);
  });
});

// ---- budget --------------------------------------------------------------------------------------

describe('media budget', () => {
  let dir;
  before(async () => { dir = await mkdtemp(join(tmpdir(), 'sa-media-budget-')); });
  after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  test('the caps are decimal byte counts', () => {
    assert.equal(EPISODE_MAX_BYTES, 25_000_000);
    assert.equal(SHOWCASE_MAX_BYTES, 40_000_000);
    assert.equal(SITE_MAX_BYTES, 900_000_000);
  });

  test('an episode at exactly 25,000,000 bytes passes and at 25,000,001 fails', () => {
    assert.deepEqual(checkItems(manifestOf({ 'dashboard-overview': goodEpisode({ bytes: 25_000_000 }) })), []);
    const problems = checkItems(manifestOf({ 'dashboard-overview': goodEpisode({ bytes: 25_000_001 }) }));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^dashboard-overview: .*25,000,001 bytes, over the 25,000,000-byte episode cap by 1$/);
  });

  test('the showcase at exactly 40,000,000 bytes passes and at 40,000,001 fails', () => {
    assert.deepEqual(checkItems(manifestOf({ [SHOWCASE_KEY]: goodShowcase({ bytes: 40_000_000 }) })), []);
    const problems = checkItems(manifestOf({ [SHOWCASE_KEY]: goodShowcase({ bytes: 40_000_001 }) }));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^showcase: .*40,000,001 bytes, over the 40,000,000-byte showcase cap by 1$/);
  });

  test('the showcase cap needs both the key and the kind', () => {
    assert.equal(capFor(SHOWCASE_KEY, { kind: 'showcase' }), SHOWCASE_MAX_BYTES);
    assert.equal(capFor(SHOWCASE_KEY, { kind: 'episode' }), EPISODE_MAX_BYTES);
    assert.equal(capFor('dashboard-overview', { kind: 'showcase' }), EPISODE_MAX_BYTES);
  });

  test('an item with no byte count fails', () => {
    const problems = checkItems(manifestOf({ 'dashboard-overview': goodEpisode({ bytes: undefined }) }));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /declares no byte count/);
  });

  test('a dist/ over 900,000,000 bytes fails and one at the cap passes', async () => {
    // A sparse file: lstat reports the full length, the disk holds almost nothing.
    const site = join(dir, 'dist');
    await mkdir(join(site, 'media'), { recursive: true });
    await writeFile(join(site, 'index.html'), 'x'.repeat(1000));
    const big = await open(join(site, 'media', 'sparse.mp4'), 'w');
    try {
      await big.truncate(SITE_MAX_BYTES - 1000);
    } finally {
      await big.close();
    }
    assert.equal(await dirBytes(site), SITE_MAX_BYTES);
    assert.deepEqual((await checkSite(site)).problems, []);

    await writeFile(join(site, 'media', 'one-more.txt'), 'y');
    const over = await checkSite(site);
    assert.equal(over.bytes, SITE_MAX_BYTES + 1);
    assert.equal(over.problems.length, 1);
    assert.match(over.problems[0], /totals 900,000,001 bytes, over the 900,000,000-byte site cap by 1$/);
  });
});

// ---- WebVTT --------------------------------------------------------------------------------------

describe('WebVTT parse and serialize', () => {
  let source;
  before(async () => { source = await readFile(join(ROOT, PLACEHOLDER_CAPTIONS), 'utf8'); });

  test('the placeholder fixture parses into its three cues, NOTE skipped, id and settings kept', () => {
    const { cues } = parseVtt(source);
    assert.deepEqual(cues, [
      { id: 'intro', start: '00:00:00.500', end: '00:00:02.500', settings: '', text: 'Spatial Adjust pushes a 5% adjustment to Lynx.' },
      { id: '', start: '00:00:03.000', end: '00:00:05.000', settings: 'line:85%', text: 'Next: Select the stations.' },
      { id: '', start: '00:00:05.500', end: '00:00:07.500', settings: '', text: 'Watch the map as the colours settle.' },
    ]);
  });

  test('serialize then parse round-trips the cues, and serializing is stable', () => {
    const { cues } = parseVtt(source);
    const written = serializeVtt(cues);
    assert.match(written, /^WEBVTT\n\n/);
    assert.deepEqual(parseVtt(written).cues, cues);
    assert.equal(serializeVtt(parseVtt(written).cues), written);
  });

  test('short timestamps, multi-line cues and character references normalize', () => {
    const { cues } = parseVtt('WEBVTT\n\n01:02.500 --> 01:04.000\nFairways &amp;\n  greens\n');
    assert.deepEqual(cues, [{ id: '', start: '00:01:02.500', end: '00:01:04.000', settings: '', text: 'Fairways & greens' }]);
    assert.equal(serializeVtt(cues), 'WEBVTT\n\n00:01:02.500 --> 00:01:04.000\nFairways &amp; greens\n\n');
  });

  test('markup, STYLE blocks, a missing header and backwards timing are refused', () => {
    assert.throws(() => parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<i>Hi</i>\n'), /markup/);
    assert.throws(() => parseVtt('WEBVTT\n\nSTYLE\n::cue { color: red }\n'), /STYLE blocks are not supported/);
    assert.throws(() => parseVtt('00:00:01.000 --> 00:00:02.000\nHi\n'), /not a WebVTT file/);
    assert.throws(() => parseVtt('WEBVTT\n\n00:00:02.000 --> 00:00:01.000\nHi\n'), /not after its start/);
  });
});

// ---- caption localization ------------------------------------------------------------------------

describe('caption localization', () => {
  let source, catalogues;
  before(async () => {
    source = await readFile(join(ROOT, PLACEHOLDER_CAPTIONS), 'utf8');
    ({ catalogues } = await loadCaptionCatalogues(join(ROOT, FIXTURE_CATALOGUES)));
  });

  test('localizeCues swaps the text and keeps ids, timings and settings', () => {
    const { cues } = parseVtt(source);
    const fr = localizeCues(cues, catalogues['fr-fr'], 'fr-fr');
    assert.equal(fr.length, cues.length);
    fr.forEach((cue, i) => {
      assert.equal(cue.id, cues[i].id);
      assert.equal(cue.start, cues[i].start);
      assert.equal(cue.end, cues[i].end);
      assert.equal(cue.settings, cues[i].settings);
      assert.equal(cue.text, catalogues['fr-fr'][cues[i].text]);
    });
  });

  test('localizeCues throws on a missing or empty translation, naming the locale and the cue', () => {
    const { cues } = parseVtt(source);
    const partial = { ...catalogues['de-de'] };
    delete partial['Next: Select the stations.'];
    assert.throws(() => localizeCues(cues, partial, 'de-de'), (err) => {
      assert.match(err.message, /^captions de-de: 1 cue\(s\) untranslated:/);
      assert.match(err.message, /00:00:03\.000 "Next: Select the stations\."/);
      return true;
    });
    const blank = { ...catalogues['de-de'], 'Next: Select the stations.': '  ' };
    assert.throws(() => localizeCues(cues, blank, 'de-de'), /1 cue\(s\) untranslated/);
    assert.throws(() => localizeCues(cues, undefined, 'ja-jp'), /captions ja-jp: 3 cue\(s\) untranslated/);
  });

  test('captionTracks writes all eleven tracks from the fixture catalogues', () => {
    const tracks = captionTracks(source, catalogues);
    assert.deepEqual(Object.keys(tracks).sort(), [...CAPTION_LOCALES].sort());
    for (const locale of CAPTION_LOCALES) assert.equal(parseVtt(tracks[locale]).cues.length, 3, locale);
  });

  test('captionTracks lists every locale with an untranslated cue', () => {
    const { 'th-th': _th, 'zh-cn': _zh, ...rest } = catalogues;
    assert.throws(() => captionTracks(source, rest), (err) => {
      assert.deepEqual(err.problems.map((p) => p.split(':')[0]), ['captions th-th', 'captions zh-cn']);
      return true;
    });
  });

  test('CAPTION_LOCALES equals CONTENT_LOCALES in src/i18n.js, in order', async () => {
    const i18n = await readFile(join(ROOT, 'src/i18n.js'), 'utf8');
    const m = /var CONTENT_LOCALES = \[([^\]]*)\]/.exec(i18n);
    assert.ok(m, 'CONTENT_LOCALES not found in src/i18n.js');
    const content = [...m[1].matchAll(/'([a-z]{2}-[a-z]{2})'/g)].map((x) => x[1]);
    assert.deepEqual(CAPTION_LOCALES, content);
    assert.equal(CAPTION_LOCALES.length, 11);
    assert.deepEqual(TRANSLATED_LOCALES, content.filter((l) => l !== 'en-us'));
  });
});

// ---- English-only captions -------------------------------------------------------------------------

describe('English-only caption items', () => {
  const english = 'WEBVTT\n\nc1\n00:00:01.000 --> 00:00:03.000\nOpen Settings.\n';

  test('captionLocales is optional and accepts a list that includes en-us', () => {
    assert.deepEqual(problemsOf(manifestOf({ 'dashboard-overview': goodEpisode({ captionLocales: ['en-us'] }) })), []);
    assert.deepEqual(problemsOf(manifestOf({ 'dashboard-overview': goodEpisode({ captionLocales: ['en-us', 'de-de'] }) })), []);
  });

  test('captionLocales rejects an empty list, a list without en-us, a repeat and an unknown locale', () => {
    const bad = (captionLocales) => problemsOf(manifestOf({ 'dashboard-overview': goodEpisode({ captionLocales }) }));
    assert.match(bad([]).join('\n'), /at least one locale/);
    assert.match(bad(['de-de']).join('\n'), /must include en-us/);
    assert.match(bad(['en-us', 'en-us']).join('\n'), /must not repeat/);
    assert.ok(bad(['en-us', 'xx-xx']).length > 0);
  });

  test('captionTracks with locales ["en-us"] needs no catalogue and writes English alone', () => {
    const tracks = captionTracks(english, {}, ['en-us']);
    assert.deepEqual(Object.keys(tracks), ['en-us']);
    assert.equal(parseVtt(tracks['en-us']).cues[0].text, 'Open Settings.');
    // The default is still all eleven, and untranslated cues in a listed locale still fail.
    assert.throws(() => captionTracks(english, {}), /captions de-de: 1 cue\(s\) untranslated/);
    assert.throws(() => captionTracks(english, {}, ['en-us', 'de-de']), /captions de-de: 1 cue\(s\) untranslated/);
  });

  test('writeCaptionTracks writes one file for an English-only item and eleven for the other', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sa-captions-'));
    try {
      await mkdir(join(root, 'src/media/captions'), { recursive: true });
      const fixture = await readFile(join(ROOT, PLACEHOLDER_CAPTIONS), 'utf8');
      await writeFile(join(root, 'src/media/captions/ep.en-us.vtt'), english);
      await writeFile(join(root, 'src/media/captions/film.en-us.vtt'), fixture);
      const items = {
        ep: goodEpisode({ captions: 'src/media/captions/ep.en-us.vtt', captionLocales: ['en-us'] }),
        film: goodEpisode({ captions: 'src/media/captions/film.en-us.vtt' }),
      };
      const dist = join(root, 'dist');
      const map = await writeCaptionTracks({ items, captionsDir: join(ROOT, FIXTURE_CATALOGUES), distDir: dist, root });
      assert.deepEqual(Object.keys(map.ep), ['en-us']);
      assert.deepEqual(Object.keys(map.film), CAPTION_LOCALES);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('the catalogue keys media:add checks against', () => {
  test('include the guides a transform adds to the export, so every series episode key is known', async () => {
    const keys = await catalogueKeys();
    assert.ok(keys.includes('filter-adjustments'), 'filter-adjustments');
    assert.ok(keys.includes('request-scan-data'), 'request-scan-data');
    const series = JSON.parse(await readFile(join(ROOT, 'video/episodes/series.json'), 'utf8'));
    const missing = series.episodes.map((e) => e.key).filter((k) => !keys.includes(k));
    assert.deepEqual(missing, []);
  });

  test('the raw export alone lists fewer: reading it was the cause of the two rejected keys', async () => {
    const raw = guideKeysFrom(await readFile(join(ROOT, 'Learn Spatial Adjust.dc.html'), 'utf8'));
    const keys = await catalogueKeys();
    assert.ok(raw.length < keys.length);
    assert.deepEqual(keys.filter((k) => !raw.includes(k)).sort(), ['filter-adjustments', 'request-scan-data']);
  });
});

describe('the shipped manifest', () => {
  test('pins every episode of the series, each with its English captions file', async () => {
    const manifest = await loadManifest(join(ROOT, 'src/media/manifest.json'));
    const series = JSON.parse(await readFile(join(ROOT, 'video/episodes/series.json'), 'utf8'));
    const published = series.episodes.filter((e) => e.status === 'approved');
    assert.ok(published.length >= 26 || published.length === series.episodes.length);
    for (const e of published) {
      const item = manifest.items[e.key];
      assert.ok(item, `${e.key} is approved but not in the manifest`);
      assert.equal(item.kind, 'episode');
      assert.equal(item.captions, `src/media/captions/${e.key}.en-us.vtt`);
      assert.ok(existsSync(join(ROOT, item.captions)), `${item.captions} is missing`);
    }
  });

  test('every manifest item validates against the catalogue as the build sees it', async () => {
    const manifest = await loadManifest(join(ROOT, 'src/media/manifest.json'));
    validateManifest(manifest, { guideKeys: await catalogueKeys() });
  });
});

// ---- repository guards ---------------------------------------------------------------------------

const run = (script, args = []) => spawnSync(process.execPath, [join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8' });

describe('repository guards', () => {
  test('node scripts/media-cues.mjs --check exits 0: the caption source catalogue is current', () => {
    const r = run('scripts/media-cues.mjs', ['--check']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  test('node scripts/media-git-guard.mjs exits 0: no videos or LFS filters in git', () => {
    const r = run('scripts/media-git-guard.mjs');
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /no video files or LFS filters/);
  });

  test('the guard recognises video extensions in any case and LFS filter lines', () => {
    for (const p of ['a.mp4', 'b/c.MOV', 'd.webm', 'e.M4V', 'f.mkv', 'g.avi']) assert.ok(VIDEO.test(p), p);
    for (const p of ['a.mp4.txt', 'poster.jpg', 'captions.vtt']) assert.ok(!VIDEO.test(p), p);
    assert.deepEqual(lfsLines('*.mp4 filter=lfs diff=lfs merge=lfs -text\n# *.mov filter=lfs\n*.txt text\n'), [
      '*.mp4 filter=lfs diff=lfs merge=lfs -text',
    ]);
  });
});
