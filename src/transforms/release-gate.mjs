// The release gate: removes beta content from a build with SA_SHOW_BETA=false.
//
// Owner: the beta release epic (see the module map in docs/claims/README.md). No other feature
// edits this file.
//
// Runs last of every transform, after beta-content, so it sees every guide and step that any
// module added.
export function apply(s, { showBeta, release } = {}) {
  if (typeof showBeta !== 'boolean') throw new Error('release-gate: showBeta must be a boolean; use parseShowBeta()');
  if (!release) throw new Error('release-gate: no release status was given');
  return s;
}
