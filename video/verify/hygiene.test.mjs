// Tests for video/verify/hygiene.mjs and video/lib/elevenlabs-key.mjs.
//
// Every test builds a throwaway git repository in a fresh directory under the OS temp dir and
// deletes it afterwards. It holds no media (the ".wav" is a few bytes of text) and no real
// secret: the key is random per run and handed over through SA_HYGIENE_TEST_KEY, and the
// denylisted name is invented and loaded from a temporary sanitize file through
// SA_SANITIZE_PATH. The real ~/.claude.json, sanitize.local.json and overlay.local.json are
// never opened. Assertions never put the key or the name into a failure message.
//
// CODE REVIEW NOTE (argv): hygiene.mjs spawns only git, with fixed arguments and repository
// paths. The key and denylist terms are matched in Node against git's stdout and never appear
// in a child's argv (ps shows argv to every user) or environment: the git children get
// process.env minus SA_HYGIENE_TEST_KEY. The last test below enforces this by reading the
// source. This file follows the same rule: commit messages that carry the key go to git on
// stdin (commit -F -), never as -m arguments.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readElevenLabsKey, readElevenLabsKeys } from '../lib/elevenlabs-key.mjs';
import { ATTRIBUTION, DENY_MIN_LENGTH, denylistMatcher } from './hygiene.mjs';

const HERE = import.meta.dirname;
const HYGIENE = path.join(HERE, 'hygiene.mjs');
const DISPATCHER = path.join(HERE, '..', 'bin', 'sa-video');

const TMP = mkdtempSync(path.join(os.tmpdir(), 'sa-hygiene-test-'));
after(() => rmSync(TMP, { recursive: true, force: true }));

const TEST_KEY = `sk_test_${randomBytes(16).toString('hex')}`;
const FIXTURE_NAME = 'Ovelgrin Marsh'; // invented
const SANITIZE = path.join(TMP, 'sanitize.fixture.local.json');
writeFileSync(SANITIZE, JSON.stringify({ [FIXTURE_NAME]: 'Riverbend National' }));
const GITCONFIG = path.join(TMP, 'gitconfig');
writeFileSync(GITCONFIG, '');

// The test repos must not see the user's git config (hooks, signing, templates).
const ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: GITCONFIG,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Hygiene Test',
  GIT_AUTHOR_EMAIL: 'hygiene@example.invalid',
  GIT_COMMITTER_NAME: 'Hygiene Test',
  GIT_COMMITTER_EMAIL: 'hygiene@example.invalid',
  SA_HYGIENE_TEST_KEY: TEST_KEY,
  SA_SANITIZE_PATH: SANITIZE,
  SA_OVERLAY_PATH: path.join(TMP, 'no-overlay.local.json'),
};

let counter = 0;
function repo() {
  const dir = path.join(TMP, `repo-${++counter}`);
  mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  return dir;
}

function git(dir, ...args) {
  const res = spawnSync('git', ['-C', dir, ...args], { env: ENV, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args[0]} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function write(dir, file, content) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), content);
}

// Commits everything; the message goes on stdin so it never sits in argv. Returns the sha.
function commit(dir, message) {
  git(dir, 'add', '-A');
  const res = spawnSync('git', ['-C', dir, 'commit', '-q', '--allow-empty', '-F', '-'], { env: ENV, input: message, encoding: 'utf8' });
  assert.equal(res.status, 0, `git commit failed: ${res.stderr}`);
  return git(dir, 'rev-parse', 'HEAD');
}

function run(dir, ...extra) {
  const res = spawnSync(process.execPath, [HYGIENE, '--repo', dir, ...extra], { env: ENV, encoding: 'utf8' });
  return { code: res.status, out: res.stdout, err: res.stderr, all: `${res.stdout}\n${res.stderr}` };
}

// Secret checks that never echo the secret: a boolean goes into the assertion, not the text.
function assertNoSecrets(all) {
  assert.equal(all.includes(TEST_KEY), false, 'output contains the test key');
  assert.equal(all.toLowerCase().includes(FIXTURE_NAME.toLowerCase()), false, 'output contains the fixture name');
}

function cleanRepo() {
  const dir = repo();
  write(dir, 'README.md', '# A clean repository\n');
  commit(dir, 'Start a clean repository');
  return dir;
}

test('a clean repository passes with exit 0', () => {
  const r = run(cleanRepo());
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /^ok {4}media:/m);
  assert.match(r.out, /^ok {4}key:/m);
  assert.match(r.out, /^ok {4}denylist:/m);
  assert.match(r.out, /^ok {4}attribution: .*\(the last 200 commits \(origin\/main not found\)\)/m);
  assert.match(r.out, /^hygiene: clean$/m);
});

test('a media file anywhere in history fails, and its path is reported', () => {
  const dir = cleanRepo();
  write(dir, 'clips/take.wav', 'not really audio');
  const sha = commit(dir, 'Add a take');
  git(dir, 'rm', '-q', 'clips/take.wav');
  commit(dir, 'Remove the take');
  const r = run(dir);
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^FAIL {2}media: 1 finding/m);
  assert.ok(r.out.includes(`media file in history: clips/take.wav | commit ${sha}`), r.out);
  assertNoSecrets(r.all);
});

test('a tracked media file fails even before it is committed', () => {
  const dir = cleanRepo();
  write(dir, 'clip.MP4', 'not really video');
  git(dir, 'add', 'clip.MP4');
  const r = run(dir);
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /media file tracked: clip\.MP4/);
});

test('the key in a tracked file, in history and in a commit message fails without being printed', () => {
  const dir = cleanRepo();
  write(dir, 'config/voice.env', `ELEVENLABS_API_KEY=${TEST_KEY}\n`);
  const added = commit(dir, 'Add voice settings');
  write(dir, 'notes.md', 'nothing to see\n');
  const msg = commit(dir, `Add notes\n\nkey was ${TEST_KEY}\n`);
  const r = run(dir);
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^FAIL {2}key: 3 findings/m);
  assert.ok(r.out.includes('ElevenLabs key found in config/voice.env | working tree'), r.out);
  assert.ok(r.out.includes(`ElevenLabs key found in config/voice.env | commit ${added}`), r.out);
  assert.ok(r.out.includes(`ElevenLabs key found in commit message | commit ${msg}`), r.out);
  assertNoSecrets(r.all);
});

test('the key is still found after the file that held it is deleted', () => {
  const dir = cleanRepo();
  write(dir, 'Learn Spatial Adjust.txt', `key ${TEST_KEY}\n`);
  const added = commit(dir, 'Add a file with a space in its name');
  git(dir, 'rm', '-q', 'Learn Spatial Adjust.txt');
  commit(dir, 'Remove it');
  const r = run(dir);
  assert.equal(r.code, 1, r.all);
  assert.ok(r.out.includes(`ElevenLabs key found in Learn Spatial Adjust.txt | commit ${added}`), r.out);
  assert.equal(r.out.includes('| working tree'), false, r.out);
  assertNoSecrets(r.all);
});

test('a denylisted name fails as [denylisted #N] without being printed', () => {
  const dir = cleanRepo();
  write(dir, 'docs/guide.md', `Welcome to ${FIXTURE_NAME.toUpperCase()}, our course.\n`);
  const sha = commit(dir, 'Add the guide');
  const r = run(dir);
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^FAIL {2}denylist: 2 findings/m);
  assert.ok(r.out.includes('[denylisted #1] found in docs/guide.md | working tree'), r.out);
  assert.ok(r.out.includes(`[denylisted #1] found in docs/guide.md | commit ${sha}`), r.out);
  assertNoSecrets(r.all);
});

test('a Claude-Session trailer fails', () => {
  const dir = cleanRepo();
  const sha = commit(dir, 'Add notes\n\nClaude-Session: https://claude.ai/code/session_0123456789\n');
  const r = run(dir);
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^FAIL {2}attribution: 2 findings/m);
  assert.ok(r.out.includes(`Claude attribution in commit ${sha}: Claude-Session trailer`), r.out);
  assert.ok(r.out.includes(`Claude attribution in commit ${sha}: claude.ai session link`), r.out);
});

test('every attribution form is recognised, and ordinary messages are not', () => {
  const hits = (body) => ATTRIBUTION.filter(([, re]) => re.test(body)).map(([label]) => label);
  assert.deepEqual(hits('x\n\nCo-Authored-By: Claude <noreply@anthropic.com>'), ['Co-Authored-By: Claude']);
  assert.deepEqual(hits('x\n\nco-authored-by: Claude Opus <noreply@anthropic.com>'), ['Co-Authored-By: Claude']);
  assert.deepEqual(hits('x\n\nGenerated with [Claude Code](https://claude.com/claude-code)'), ['Generated with Claude']);
  assert.deepEqual(hits('x\n\nclaude-session: abc'), ['Claude-Session trailer']);
  assert.deepEqual(hits('Fix the session timeout\n\nCo-Authored-By: Jo Bloggs <jo@example.invalid>'), []);
});

test('only origin/main..HEAD is checked for attribution when origin/main exists', () => {
  const dir = repo();
  write(dir, 'a.txt', 'a\n');
  const pushed = commit(dir, 'Old commit\n\nClaude-Session: https://claude.ai/code/session_old\n');
  git(dir, 'update-ref', 'refs/remotes/origin/main', pushed);
  write(dir, 'b.txt', 'b\n');
  commit(dir, 'New commit, no attribution');
  const clean = run(dir);
  assert.equal(clean.code, 0, clean.all);
  assert.match(clean.out, /attribution: .*\(origin\/main\.\.HEAD\)/);
  // --range widens the check on request.
  const wide = run(dir, '--range', 'HEAD');
  assert.equal(wide.code, 1, wide.all);
});

test('all four findings at once: exit 1, each check fails, neither secret is printed', () => {
  const dir = cleanRepo();
  write(dir, 'take.wav', 'not really audio');
  write(dir, 'settings.json', JSON.stringify({ key: TEST_KEY }));
  write(dir, 'about.md', `${FIXTURE_NAME} course notes\n`);
  commit(dir, 'Add everything\n\nClaude-Session: https://claude.ai/code/session_x\n');
  const r = run(dir);
  assert.equal(r.code, 1, r.all);
  for (const check of ['media', 'key', 'denylist', 'attribution']) {
    assert.match(r.out, new RegExp(`^FAIL {2}${check}: `, 'm'), `${check} did not fail`);
  }
  assert.match(r.out, /^hygiene: \d+ findings; do not push$/m);
  assertNoSecrets(r.all);
});

test('a directory that is not a git repository is an internal error (exit 2)', () => {
  const dir = path.join(TMP, 'not-a-repo');
  mkdirSync(dir);
  const r = run(dir);
  assert.equal(r.code, 2, r.all);
  assert.match(r.err, /is not a git repository/);
});

test('an unknown argument is a usage error (exit 64)', () => {
  const r = run(cleanRepo(), '--bogus');
  assert.equal(r.code, 64, r.all);
});

test('npm run video -- hygiene reaches the check through the dispatcher', () => {
  const res = spawnSync(process.execPath, [DISPATCHER, 'hygiene', '--repo', cleanRepo()], { env: ENV, encoding: 'utf8' });
  assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /^hygiene: clean$/m);
  const pkg = JSON.parse(readFileSync(path.join(HERE, '..', '..', 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.video, 'node video/bin/sa-video');
});

test('denylist terms: short ones are skipped, short-ish ones match whole words, long ones anywhere', () => {
  const maps = { denylist: ['123', 'Ovel', FIXTURE_NAME] };
  const m = denylistMatcher(maps);
  assert.equal(DENY_MIN_LENGTH, 4);
  assert.deepEqual(m.skipped, [1]);
  assert.equal(m.scanned, 2);
  assert.deepEqual(m.find('line 1234 and 123'), [], 'a three-character term is not scanned');
  assert.deepEqual(m.find('Ovelton'), [], 'a four-character term does not match inside a word');
  assert.deepEqual(m.find('see OVEL.'), [2]);
  assert.deepEqual(m.find(`www.${FIXTURE_NAME.toLowerCase()}golf.example`), [3], 'a long term matches inside a word');
});

test('readElevenLabsKey: test override, top level before projects, any project, null when absent', () => {
  const file = path.join(TMP, 'claude.fixture.json');
  const projectKey = `sk_project_${randomBytes(8).toString('hex')}`;
  const topKey = `sk_top_${randomBytes(8).toString('hex')}`;
  const entry = (k) => ({ mcpServers: { elevenlabs: { command: 'x', env: { ELEVENLABS_API_KEY: k } } } });
  const noEnv = { SA_HYGIENE_TEST_KEY: '' };

  writeFileSync(file, JSON.stringify({ projects: { '/a': { mcpServers: {} }, '/b': entry(projectKey) } }));
  assert.equal(readElevenLabsKey({ file, env: noEnv }) === projectKey, true, 'project-scoped key not found');

  writeFileSync(file, JSON.stringify({ ...entry(topKey), projects: { '/b': entry(projectKey) } }));
  assert.equal(readElevenLabsKey({ file, env: noEnv }) === topKey, true, 'top-level key should win');
  assert.equal(readElevenLabsKeys({ file, env: noEnv }).length, 2);

  assert.equal(readElevenLabsKey({ file, env: { SA_HYGIENE_TEST_KEY: TEST_KEY } }) === TEST_KEY, true, 'override ignored');

  writeFileSync(file, JSON.stringify({ projects: { '/a': { mcpServers: {} } } }));
  assert.equal(readElevenLabsKey({ file, env: noEnv }), null);
  assert.equal(readElevenLabsKey({ file: path.join(TMP, 'missing.json'), env: noEnv }), null);
});

test('an unparseable ~/.claude.json is reported without quoting its content', () => {
  const file = path.join(TMP, 'broken.fixture.json');
  writeFileSync(file, `{"mcpServers": {"elevenlabs": {"env": {"ELEVENLABS_API_KEY": "${TEST_KEY}"`);
  let message = '';
  try {
    readElevenLabsKey({ file, env: { SA_HYGIENE_TEST_KEY: '' } });
  } catch (err) {
    message = err.message;
  }
  assert.match(message, /is not valid JSON/);
  assert.equal(message.includes(TEST_KEY), false, 'error message quotes the key');
});

test('no child process is spawned with the key or a denylist term in its argv', () => {
  // Static review of every spawn site: arguments may name git, fixed flags and the repo path,
  // never anything holding a key or a term.
  const src = readFileSync(HYGIENE, 'utf8');
  const calls = [...src.matchAll(/\b(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\(([^;]*?)\);?$/gm)];
  assert.ok(calls.length >= 3, 'expected the git spawn sites');
  for (const [, fn, args] of calls) {
    assert.equal(/\b(keys?|kb|keyBufs|terms?|denylist|deny|maps|TEST_KEY)\b/.test(args), false, `${fn}(...) passes a secret-bearing value`);
    assert.match(args, /^'git'/, `${fn}(...) spawns something other than git`);
  }
  assert.match(src, /env: GIT_ENV/, 'git children must get the scrubbed environment');
  const keySrc = readFileSync(path.join(HERE, '..', 'lib', 'elevenlabs-key.mjs'), 'utf8');
  assert.equal(/child_process/.test(keySrc), false, 'the key resolver must not spawn anything');
});
