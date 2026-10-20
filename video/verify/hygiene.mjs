#!/usr/bin/env node
// Repository hygiene: the check that runs before every push of the public guides repository.
//
//   npm run video -- hygiene [--repo <dir>] [--range <rev-range>]
//
// It fails when
//   media        a media file (.mp4 .mov .wav .mp3 .m4a .aac .flac .webm) is tracked now or
//                appears anywhere in git history (every ref, merges included);
//   key          the ElevenLabs API key (video/lib/elevenlabs-key.mjs) appears in a tracked
//                file, in any commit's diff or in any commit message;
//   denylist     a denylisted real name (video/lib/local-maps.mjs) appears in the same places;
//   tracker      a tracked text file in the working tree holds an internal tracker ID (a
//                work-item, feature or epic number; TRACKER_ID below). The repository is
//                public, so work is described in words, never by its tracker number;
//   attribution  a commit message in origin/main..HEAD (the last 200 commits when origin/main
//                does not exist) carries Claude attribution.
//
// It reports locations only. Media file names and paths are printed; the key and denylisted
// terms never are: a key hit reads "ElevenLabs key found in <file> | commit <sha>", a denylist
// hit "[denylisted #N] found in <file> | commit <sha>", a tracker hit "tracker ID found in
// <file>:<line>", without the line's text (which could hold a denylisted name).
//
// Secrets never leave this process. git is spawned only with fixed arguments and paths; the key
// and the denylist terms are searched for in Node, in git's stdout, and never placed in a child
// process's argv or environment (ps would expose argv to every user on the machine).
//
// Exit codes: 0 clean, 1 findings, 2 internal error (not a git repository, git failed, a local
// map or ~/.claude.json unreadable), 64 usage.

import { spawn, spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { TEST_KEY_ENV, readElevenLabsKeys } from '../lib/elevenlabs-key.mjs';
import { loadLocalMaps } from '../lib/local-maps.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const MEDIA = /\.(mp4|mov|wav|mp3|m4a|aac|flac|webm)$/i;
export const ATTRIBUTION_FALLBACK_COMMITS = 200;
// Denylist matching by term length. A term is matched case-insensitively; how strictly depends on
// how distinctive it is:
//   shorter than DENY_MIN_LENGTH   not scanned. A two- or three-character term (a short code,
//                                  say) matches line numbers, coordinates and font data all
//                                  over an ordinary repository, so every run would fail.
//                                  Skipped terms are listed by index in the report.
//   shorter than DENY_SUBSTRING    whole words only: not inside a longer word or number.
//   longer                         anywhere, so "name" is caught inside "namegolfclub.com".
export const DENY_MIN_LENGTH = 4;
export const DENY_SUBSTRING = 6;
// Internal tracker identifiers: the private trackers' feature and epic numbers, enhancement
// requests, personal work items and user stories. Case-sensitive, as the trackers write them.
export const TRACKER_ID = /(PI-ICNT-SW-[0-9E]+|ER-1[0-9]{3}|PERS-[0-9]+|US-[0-9]{4,})/;
// git's own test for binary content: a NUL byte in the first 8000 bytes.
const BINARY_PROBE = 8000;
export const ATTRIBUTION = [
  ['Co-Authored-By: Claude', /co-authored-by:[^\n]*\b(claude|anthropic)\b/i],
  ['Claude-Session trailer', /claude-session:/i],
  ['claude.ai session link', /claude\.ai\/code\/session/i],
  ['Generated with Claude', /generated with \[?claude/i],
];

export class HygieneError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HygieneError';
  }
}

// git runs without the test-key override in its environment: a child never holds a secret.
const { [TEST_KEY_ENV]: _testKey, ...GIT_ENV } = process.env;

// git with fixed arguments; stdout as a string. Never pass a secret in args.
function git(repo, args) {
  const res = spawnSync('git', ['-C', repo, '-c', 'core.quotePath=false', ...args], {
    env: GIT_ENV,
    encoding: 'utf8',
    maxBuffer: 1 << 30,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.error) throw new HygieneError(`could not run git: ${res.error.message}`);
  if (res.status !== 0) throw new HygieneError(`git ${args[0]} failed: ${res.stderr.trim()}`);
  return res.stdout;
}

function gitOk(repo, args) {
  const res = spawnSync('git', ['-C', repo, ...args], { env: GIT_ENV, stdio: 'ignore' });
  return res.status === 0;
}

// Streams `git <args>` stdout line by line into onLine. Never pass a secret in args.
function gitLines(repo, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', repo, '-c', 'core.quotePath=false', ...args], { env: GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => reject(new HygieneError(`could not run git: ${err.message}`)));
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on('line', onLine);
    const closed = new Promise((r) => rl.on('close', r));
    child.on('close', async (code) => {
      await closed;
      if (code === 0) resolve();
      else reject(new HygieneError(`git ${args[0]} failed: ${stderr.trim()}`));
    });
  });
}

export function assertRepo(repo) {
  if (!gitOk(repo, ['rev-parse', '--git-dir'])) throw new HygieneError(`${repo} is not a git repository`);
}

const hasCommits = (repo) => gitOk(repo, ['rev-parse', '--verify', '-q', 'HEAD']);

// --- media -------------------------------------------------------------------------------------

export function checkMedia(repo) {
  const findings = [];
  const seen = new Set();
  for (const file of git(repo, ['ls-files', '-z']).split('\0')) {
    if (file && MEDIA.test(file)) {
      findings.push(`media file tracked: ${file}`);
      seen.add(file);
    }
  }
  if (hasCommits(repo)) {
    // \x01<sha> starts each commit; -m lists files for merge commits too. Deletions are left
    // out (--diff-filter=d), so a file is reported at the commits that added or changed it.
    let commit = '';
    for (const line of git(repo, ['log', '--all', '-m', '--diff-filter=d', '--name-only', '--pretty=format:%x01%H']).split('\n')) {
      if (line.startsWith('\x01')) commit = line.slice(1);
      else if (line && MEDIA.test(line) && !seen.has(`${line}@${commit}`)) {
        seen.add(`${line}@${commit}`);
        findings.push(`media file in history: ${line} | commit ${commit}`);
      }
    }
  }
  return findings;
}

// --- key and denylist --------------------------------------------------------------------------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Matcher over the denylist using the length rules above. Hits report the term's 1-based index
// in maps.denylist (the same N that local-maps redact() uses), never the term.
export function denylistMatcher(maps) {
  const terms = maps ? maps.denylist.map((term, i) => [term, i + 1]) : [];
  const skipped = terms.filter(([t]) => t.trim().length < DENY_MIN_LENGTH).map(([, n]) => n);
  const used = terms.filter(([t]) => t.trim().length >= DENY_MIN_LENGTH).sort((a, b) => b[0].length - a[0].length);
  const index = new Map(used.map(([t, n]) => [t.toLowerCase(), n]));
  const alt = used.map(([t]) => (t.length < DENY_SUBSTRING
    ? `(?<![\\p{L}\\p{N}])${escapeRe(t)}(?![\\p{L}\\p{N}])`
    : escapeRe(t)));
  const re = alt.length ? new RegExp(alt.join('|'), 'giu') : null;
  const lookup = (hit) => index.get(hit.toLowerCase())
    ?? used.find(([t]) => new RegExp(`^${escapeRe(t)}$`, 'iu').test(hit))?.[1] ?? 0;
  const find = (text) => {
    if (!re || !text) return [];
    const out = [];
    for (const m of String(text).matchAll(re)) out.push(lookup(m[0]));
    return out;
  };
  return { find, skipped, scanned: used.length };
}

// One scanner for both secret kinds. Each hit is recorded once per (what, where).
function makeScanner(keys, maps) {
  const deny = denylistMatcher(maps);
  const keyBufs = keys.map((k) => Buffer.from(k, 'utf8'));
  const keyHits = [];
  const denyHits = [];
  const seen = new Set();
  const record = (list, label, where) => {
    const id = `${label}|${where}`;
    if (seen.has(id)) return;
    seen.add(id);
    list.push(`${label} found in ${where}`);
  };
  const scanText = (text, where) => {
    for (const key of keys) if (text.indexOf(key) !== -1) record(keyHits, 'ElevenLabs key', where);
    for (const n of deny.find(text)) record(denyHits, `[denylisted #${n}]`, where);
  };
  const scanBuffer = (buf, where) => {
    for (const kb of keyBufs) if (buf.indexOf(kb) !== -1) record(keyHits, 'ElevenLabs key', where);
    if (deny.scanned) for (const n of deny.find(buf.toString('utf8'))) record(denyHits, `[denylisted #${n}]`, where);
  };
  return { keyHits, denyHits, scanText, scanBuffer };
}

function scanTrackedFiles(repo, scanner) {
  const top = git(repo, ['rev-parse', '--show-toplevel']).trim();
  for (const file of git(repo, ['ls-files', '-z']).split('\0')) {
    if (!file) continue;
    const abs = path.join(top, file);
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      continue; // tracked but deleted in the working tree; history covers its content
    }
    const where = `${file} | working tree`;
    if (st.isSymbolicLink()) scanner.scanText(readlinkSync(abs), where);
    else if (st.isFile()) scanner.scanBuffer(readFileSync(abs), where);
  }
}

// Streams every commit of every ref as a patch (binary files as text, merges against each
// parent) and scans each line, tracking which commit and file it belongs to.
async function scanHistory(repo, scanner) {
  if (!hasCommits(repo)) return;
  let commit = '';
  let file = null;
  let inHeader = false;
  const fromDiffLine = (line) => {
    const i = line.lastIndexOf(' b/');
    return i === -1 ? line.slice('diff --git '.length) : line.slice(i + 3);
  };
  await gitLines(repo, ['log', '--all', '-m', '-p', '--text', '--no-color', '--no-ext-diff', '--no-textconv', '--pretty=format:commit %H%n%B'], (line) => {
    if (line.startsWith('commit ') && /^commit [0-9a-f]{40,64}$/.test(line)) {
      commit = line.slice(7);
      file = null;
      inHeader = false;
      return;
    }
    if (line.startsWith('diff --git ')) {
      file = fromDiffLine(line);
      inHeader = true;
      return;
    }
    if (inHeader) {
      if (line.startsWith('@@')) inHeader = false;
      // git appends a tab to these lines when the path contains a space.
      else if (line.startsWith('+++ b/')) file = line.slice(6).replace(/\t$/, '');
    }
    const where = file === null ? `commit message | commit ${commit}` : `${file} | commit ${commit}`;
    scanner.scanText(line, where);
  });
}

export async function checkSecrets(repo, { keys, maps }) {
  const scanner = makeScanner(keys, maps);
  if (!keys.length && !denylistMatcher(maps).scanned) return { key: [], denylist: [] };
  scanTrackedFiles(repo, scanner);
  await scanHistory(repo, scanner);
  return { key: scanner.keyHits, denylist: scanner.denyHits };
}

// --- tracker IDs -------------------------------------------------------------------------------

// Every tracked text file as it stands in the working tree, line by line. History is not
// scanned: published commits cannot be rewritten, and the rule is that nothing new carries an ID.
// Findings name the file and line only, never the matched text or the rest of the line.
export function checkTrackerIds(repo) {
  const top = git(repo, ['rev-parse', '--show-toplevel']).trim();
  const findings = [];
  for (const file of git(repo, ['ls-files', '-z']).split('\0')) {
    if (!file) continue;
    let buf;
    try {
      const abs = path.join(top, file);
      if (!lstatSync(abs).isFile()) continue; // symlinks and submodules hold no text of their own
      buf = readFileSync(abs);
    } catch {
      continue; // tracked but deleted in the working tree
    }
    if (buf.subarray(0, BINARY_PROBE).includes(0)) continue;
    buf.toString('utf8').split('\n').forEach((line, i) => {
      if (TRACKER_ID.test(line)) findings.push(`tracker ID found in ${file}:${i + 1}`);
    });
  }
  return findings;
}

// --- attribution -------------------------------------------------------------------------------

export function attributionRange(repo) {
  if (gitOk(repo, ['rev-parse', '--verify', '-q', 'refs/remotes/origin/main'])) {
    return { args: ['origin/main..HEAD'], label: 'origin/main..HEAD' };
  }
  return {
    args: ['-n', String(ATTRIBUTION_FALLBACK_COMMITS), 'HEAD'],
    label: `the last ${ATTRIBUTION_FALLBACK_COMMITS} commits (origin/main not found)`,
  };
}

export function checkAttribution(repo, range) {
  if (!hasCommits(repo)) return { findings: [], label: 'no commits' };
  const r = range ? { args: [range], label: range } : attributionRange(repo);
  const findings = [];
  const out = git(repo, ['log', '--format=%H%x00%B%x01', ...r.args]);
  for (const record of out.split('\x01')) {
    const [sha, body = ''] = record.replace(/^\n+/, '').split('\0');
    if (!sha) continue;
    for (const [label, re] of ATTRIBUTION) {
      if (re.test(body)) findings.push(`Claude attribution in commit ${sha}: ${label}`);
    }
  }
  return { findings, label: r.label };
}

// --- runner ------------------------------------------------------------------------------------

// Runs every check. keys and maps default to the real sources; tests inject them through
// SA_HYGIENE_TEST_KEY, SA_SANITIZE_PATH and SA_OVERLAY_PATH instead.
export async function runHygiene({ repo = REPO_ROOT, range, keys, maps, warn = () => {} } = {}) {
  assertRepo(repo);
  const notes = [];
  const k = keys ?? readElevenLabsKeys();
  if (!k.length) notes.push('key: no ElevenLabs key configured in ~/.claude.json; key scan skipped');
  const m = maps === undefined ? loadLocalMaps({ warn }) : maps;
  if (!m || !m.denylist.length) {
    notes.push('denylist: no denylisted names loaded (sanitize.local.json and video/capture/overlay.local.json missing or empty); denylist scan skipped');
  } else {
    const { skipped } = denylistMatcher(m);
    if (skipped.length) {
      notes.push(`denylist: ${skipped.map((n) => `[denylisted #${n}]`).join(', ')} not scanned: shorter than ${DENY_MIN_LENGTH} characters, too generic for a text scan`);
    }
  }

  const media = checkMedia(repo);
  const secrets = await checkSecrets(repo, { keys: k, maps: m });
  const tracker = checkTrackerIds(repo);
  const attribution = checkAttribution(repo, range);
  return {
    findings: { media, key: secrets.key, denylist: secrets.denylist, tracker, attribution: attribution.findings },
    notes,
    attributionRange: attribution.label,
  };
}

const DESCRIBE = {
  media: 'no media files tracked or in git history',
  key: 'ElevenLabs key not in tracked files, history or commit messages',
  denylist: 'no denylisted names in tracked files, history or commit messages',
  tracker: 'no internal tracker IDs in tracked text files',
  attribution: 'no Claude attribution in commit messages',
};

export function report(result, out = process.stdout) {
  let total = 0;
  for (const [check, list] of Object.entries(result.findings)) {
    total += list.length;
    const scope = check === 'attribution' ? ` (${result.attributionRange})` : '';
    if (!list.length) {
      out.write(`ok    ${check}: ${DESCRIBE[check]}${scope}\n`);
    } else {
      out.write(`FAIL  ${check}: ${list.length} finding${list.length === 1 ? '' : 's'}${scope}\n`);
      for (const f of list) out.write(`      ${f}\n`);
    }
  }
  for (const n of result.notes) out.write(`note  ${n}\n`);
  out.write(total ? `hygiene: ${total} finding${total === 1 ? '' : 's'}; do not push\n` : 'hygiene: clean\n');
  return total;
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo' || a === '--range') {
      if (i + 1 >= argv.length) return { error: `${a} needs a value` };
      opts[a.slice(2)] = argv[++i];
    } else if (a === '-h' || a === '--help') {
      opts.help = true;
    } else {
      return { error: `unknown argument "${a}"` };
    }
  }
  return opts;
}

const USAGE = `Usage: npm run video -- hygiene [--repo <dir>] [--range <rev-range>]
  --repo   repository to check (default: this repository)
  --range  commits whose messages are checked for attribution
           (default: origin/main..HEAD, or the last ${ATTRIBUTION_FALLBACK_COMMITS} commits without origin/main)
Exit codes: 0 clean, 1 findings, 2 internal error, 64 usage.
`;

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.error) {
    process.stderr.write(`hygiene: ${opts.error}\n${USAGE}`);
    process.exit(64);
  }
  if (opts.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  try {
    const result = await runHygiene({
      repo: path.resolve(opts.repo ?? REPO_ROOT),
      range: opts.range,
      warn: (msg) => process.stderr.write(`hygiene: ${msg}\n`),
    });
    process.exitCode = report(result) ? 1 : 0;
  } catch (err) {
    // Error messages here come from git, the key resolver or the local maps loader, none of
    // which quote a secret.
    process.stderr.write(`hygiene: error: ${err.message}\n`);
    process.exitCode = 2;
  }
}
