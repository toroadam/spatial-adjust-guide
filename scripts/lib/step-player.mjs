// Whether the build under test shows the middle step player. build.mjs writes the answer into the
// page as <meta name="sa-step-player" content="shown|hidden"> (SA_SHOW_STEP_PLAYER, see
// parseShowStepPlayer in src/transform-export.mjs), so the scripts that test the served site read
// it from dist/index.html, the build they are testing, rather than from the source default. A dist
// built before the meta existed falls back to the default.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HIDE_STEP_PLAYER as DEFAULT_HIDDEN } from '../../src/transform-export.mjs';

// The same dist build.mjs writes: SA_DIST_DIR when set, else dist/ at the repository root.
const DIST = join(process.env.SA_DIST_DIR ? resolve(process.env.SA_DIST_DIR) : join(import.meta.dirname, '..', '..', 'dist'), 'index.html');

function builtMode() {
  try {
    const m = readFileSync(DIST, 'utf8').match(/<meta name="sa-step-player" content="(shown|hidden)">/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const mode = builtMode();
export const HIDE_STEP_PLAYER = mode ? mode === 'hidden' : DEFAULT_HIDDEN;

/** For a script that steps through the player: exits with a message naming the switch when the
 *  build has it hidden, instead of finding no controls and stopping without a word. */
export function requireStepPlayer(script) {
  if (!HIDE_STEP_PLAYER) return;
  console.error(`${script}: the step player is hidden in this build, so there is nothing to step through.\n`
    + 'Rebuild with it shown and run again:  SA_SHOW_STEP_PLAYER=1 npm run build');
  process.exit(2);
}
