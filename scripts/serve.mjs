// Serve a directory over HTTP for local checks: npm run serve (dist/ on port 8124).
// MIME types and HTTP Range handling live in scripts/lib/static-server.mjs, shared with scripts/test.mjs.
//   node scripts/serve.mjs [root] [port]
import { createServer } from 'node:http';
import { staticHandler } from './lib/static-server.mjs';

const root = process.argv[2] || '.';
const port = Number(process.argv[3] || 8123);
createServer(staticHandler(root)).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
