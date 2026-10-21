// Self-contained test entry point: serve dist/ on an ephemeral port, run the smoke test
// against it twice, and tear the server down. No externally-started server required, so this
// works from a clean clone and in CI.
//
//   1. plain           the build as it is: no media panel anywhere when it shipped no videos, and
//                      every shipped video's panel, with its eleven tracks, when it did (CI builds
//                      with SA_MEDIA_REQUIRED=1, so there the real media is covered here).
//   2. --media-fixture the panel against fixture media (scripts/lib/media-fixture.mjs), so it is
//                      covered on every run, including clean clones with no videos staged.
//
// Both always run, so one failure does not hide the other; the exit code fails if either does.
//
// MIME types and HTTP Range handling (which video needs) are shared with scripts/serve.mjs through
// scripts/lib/static-server.mjs, so the test server behaves exactly like npm run serve.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { staticHandler } from './lib/static-server.mjs';

const server = createServer(staticHandler('dist'));

await new Promise((r) => server.listen(0, r));
const { port } = server.address();

const smoke = (...extra) => new Promise((resolve) => {
  const child = spawn(
    process.execPath,
    ['scripts/smoke.mjs', `http://localhost:${port}/`, '--offline', ...extra],
    { stdio: 'inherit' },
  );
  child.on('exit', (code) => resolve(code ?? 1));
  child.on('error', () => resolve(1));
});

const runs = [
  ['smoke', await smoke()],
  ['smoke --media-fixture', await smoke('--media-fixture')],
];
server.close();

const failed = runs.filter(([, code]) => code !== 0).map(([name]) => name);
console.log(`\n${runs.map(([name, code]) => `${name}: ${code === 0 ? 'PASS' : 'FAIL'}`).join('\n')}`);
process.exit(failed.length ? 1 : 0);
