// The anchored edit() helper every build-time transform is written with.
//
// It lives in its own module so that src/transform-export.mjs and each per-concern module under
// src/transforms/ can share it without importing one another. Its behaviour is unchanged from when
// it was defined inline in src/transform-export.mjs: the anchor must match exactly `expected`
// times or the build fails, so a re-export that moves the text cannot silently drop a transform.
//
// Owner: feature 1. Do not change what it does; every other transform depends on it.

/** Apply the replacement, asserting the pattern matched `expected` times.
 *
 *  Counting uses a global copy of the pattern on purpose: String.match() with a
 *  non-global regex returns the match *and its capture groups*, so any pattern with a
 *  group would report an inflated count. The replace itself stays non-global so it only
 *  touches the first occurrence, which is what `expected: 1` means. */
export function edit(src, { name, pattern, replace, expected = 1, __DISABLED__ = false }) {
  if (__DISABLED__) return src;   // A/B harness only; never committed enabled
  const counter = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const found = [...src.matchAll(counter)].length;
  if (found !== expected) {
    throw new Error(
      `Transform "${name}" expected ${expected} match(es) but found ${found}.\n` +
      `  The Core Design export's structure has changed. Update the anchor in\n` +
      `  src/transform-export.mjs — do not skip the transform.`,
    );
  }
  return src.replace(pattern, replace);
}
