// Self-contained test entry point: serve dist/ on an ephemeral port, run the smoke test
// against it, and tear the server down. No externally-started server required, so this
// works from a clean clone and in CI.
//
// MIME types and HTTP Range handling (which video needs) are shared with scripts/serve.mjs through
// scripts/lib/static-server.mjs, so the test server behaves exactly like npm run serve.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { staticHandler } from './lib/static-server.mjs';

const server = createServer(staticHandler('dist'));

await new Promise((r) => server.listen(0, r));
const { port } = server.address();

const child = spawn(
  process.execPath,
  ['scripts/smoke.mjs', `http://localhost:${port}/`, '--offline'],
  { stdio: 'inherit' },
);
const code = await new Promise((r) => child.on('exit', r));
server.close();
process.exit(code ?? 1);
