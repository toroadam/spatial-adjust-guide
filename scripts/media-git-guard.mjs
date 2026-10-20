// Videos never enter git. They are GitHub Release assets pinned by src/media/manifest.json (see
// README > Video); a video committed by mistake would sit in every clone forever, and Git LFS is no
// way out, because LFS bandwidth on a public repo is metered and Pages does not serve LFS objects.
//
//   node scripts/media-git-guard.mjs        (npm run test:media-git)
//
// Fails, listing every offender, when:
//   - a tracked path (git ls-files, which includes `git add -N` intents) ends in .mp4, .m4v, .mov,
//     .webm, .mkv or .avi, in any letter case;
//   - any .gitattributes file in the tree configures filter=lfs;
//   - the clone has full history and any commit on any ref ever added such a path.
// CI checks out at depth 1, so there it sees the tracked tree only; a full local clone scans history
// as well. The first line of output says which mode ran.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;
const LFS = /(^|\s)filter=lfs(\s|$)/;
const ROOT = join(import.meta.dirname, '..');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

const split = (out) => out.split('\0').map((s) => s.replace(/^\n+|\n+$/g, '')).filter(Boolean);

/** Lines of a .gitattributes text that turn on the LFS filter, comments ignored. */
export function lfsLines(text) {
  return text.split(/\r?\n/).filter((line) => !line.trimStart().startsWith('#') && LFS.test(line));
}

/** Every problem in the repository at `cwd`. Returns { mode, problems }. */
export function scan(cwd = ROOT) {
  const problems = [];
  const tracked = split(git(['ls-files', '-z'], cwd));
  for (const path of tracked.filter((p) => VIDEO.test(p))) problems.push(`tracked video file: ${path}`);

  const attributes = new Set(tracked.filter((p) => p === '.gitattributes' || p.endsWith('/.gitattributes')));
  if (existsSync(join(cwd, '.gitattributes'))) attributes.add('.gitattributes'); // untracked counts too
  for (const path of [...attributes].sort()) {
    const full = join(cwd, path);
    if (!existsSync(full)) continue;
    for (const line of lfsLines(readFileSync(full, 'utf8'))) problems.push(`Git LFS filter in ${path}: ${line.trim()}`);
  }

  const shallow = git(['rev-parse', '--is-shallow-repository'], cwd).trim() !== 'false';
  if (!shallow) {
    const added = new Set(split(git(['log', '--all', '--diff-filter=A', '--name-only', '-z', '--pretty=format:'], cwd)));
    for (const path of [...added].filter((p) => VIDEO.test(p)).sort()) {
      const commits = git(['log', '--all', '--diff-filter=A', '--format=%h', '--', path], cwd).trim().split('\n').join(', ');
      problems.push(`video file in history: ${path} (added in ${commits})`);
    }
  }
  return { mode: shallow ? 'tracked tree only (shallow clone, history not scanned)' : 'tracked tree and full history', problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { mode, problems } = scan();
    console.log(`media git guard: ${mode}`);
    if (problems.length) {
      console.error(`media git guard: videos belong in GitHub Release assets, never in git (see README > Video). ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n- ${problems.join('\n- ')}`);
      process.exitCode = 1;
    } else {
      console.log('media git guard: no video files or LFS filters');
    }
  } catch (err) {
    console.error(`media git guard: ${err.message}`);
    process.exitCode = 1;
  }
}
