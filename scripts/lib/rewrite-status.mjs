// The rewrite ratchet. Lists the guides whose steps have not yet been rewritten to the standard in
// docs/writing-guide.md.
//
// scripts/step-shape.mjs and scripts/readability.mjs report every guide, but only a guide that is
// NOT in PENDING can fail them. That makes each check blocking for the guides already rewritten and
// advisory for the rest, with no single day on which all 26 have to pass at once.
//
// Each rewrite removes its guides' keys from PENDING in the same change that lands the rewrite.
// A `<key>-part-N` guide follows its parent key. When the set is empty, this module is deleted,
// the checks become unconditional and the shape check moves into build.mjs.
import { partOf } from './load-guides.mjs';

export const PENDING = new Set([
  // The 24 guides of the export, in catalogue order.
]);

/** True when `key`, or the guide a `<key>-part-N` continues, is still waiting for its rewrite. */
export function isPending(key, pending = PENDING) {
  return pending.has(key) || pending.has(partOf(key)?.base);
}
