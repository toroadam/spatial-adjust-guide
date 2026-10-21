// Shared by the rewrite modules that add steps to a guide (calculations.mjs, station-management.mjs).
// The helpers are anchored: insertSteps() fails the build, naming the transform, when its anchor does
// not match exactly once.

/** Serialises a value as guide source: single-quoted strings, numbers, arrays and plain objects. */
export function lit(v) {
  if (typeof v === 'string') {
    return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
  return '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${lit(x)}`).join(', ') + ' }';
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Inserts new step literals in front of the step whose source opens with `{ title: '<before>'`
 *  (the title exactly as the source writes it, escapes included). The anchor must occur once. */
export function insertSteps(src, h, { name, before, steps }) {
  const anchor = `{ title: '${before}'`;
  return h.edit(src, {
    name,
    pattern: new RegExp(escapeRe(anchor)),
    replace: () => steps.map((s) => lit(s) + ',\n      ').join('') + anchor,
  });
}
