// The known-drift ledger for the episode lint (scripts/episode-lint.mjs).
//
// An episode is filmed against the guide as it was written that day. When a guide's steps are
// rewritten afterwards, the episode's chapter cards and highlight labels, which are baked into the
// picture, no longer match the rendered steps, and the film is not re-shot for a wording change.
// Those findings are real, so the lint neither hides them nor lets them block everything else:
// video/episodes/guide-drift.json records each one verbatim, with a reason, and the lint then
//
//   - reports a recorded finding as known drift (counted and listed with --show-drift, not failing);
//   - fails on any finding that is not recorded, so a new regression is never absorbed;
//   - fails on a recorded finding that no longer occurs ("stale"), so the ledger shrinks as the
//     drift is fixed and can never describe a state the guides are no longer in.
//
// Only the three step-structure findings may be recorded: the chapter count against the rendered
// step count, a chapter label against its step title, and a highlight label against the step's bold
// labels. A schema, claim, loudness, title-card or any other finding can never be put in the ledger.
//
// Pure functions, no I/O, so the lint, the tests and the writer share one definition.

const KEY = '[a-z0-9-]+';
const RECORDABLE = new RegExp(
  `^(${KEY})(?:: \\d+ chapters != \\d+ rendered steps`
  + '| chapter \\d+: (?:label .+ != step title .+|highlight\\.label .+ is not a bold label of step \\d+ .+))$',
);

/** The episode key a recordable finding belongs to, or null when the finding may not be recorded. */
export function recordableKey(finding) {
  const m = RECORDABLE.exec(String(finding));
  return m ? m[1] : null;
}

/**
 * Check a parsed ledger. Returns { ledger: Map<key, { reason, findings: Set<string> }>, problems }.
 * Every entry needs a reason and a list of recordable findings that belong to its own key.
 */
export function parseDriftLedger(json) {
  const problems = [];
  const ledger = new Map();
  if (json === null || json === undefined) return { ledger, problems };
  if (typeof json !== 'object' || Array.isArray(json) || typeof json.episodes !== 'object' || json.episodes === null) {
    return { ledger, problems: ['guide-drift.json: needs an "episodes" object'] };
  }
  for (const [key, entry] of Object.entries(json.episodes)) {
    const where = `guide-drift.json: ${key}`;
    if (!entry || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      problems.push(`${where}: needs a reason`);
      continue;
    }
    if (!Array.isArray(entry.findings) || !entry.findings.length) {
      problems.push(`${where}: needs a non-empty findings list`);
      continue;
    }
    const set = new Set();
    for (const finding of entry.findings) {
      const owner = recordableKey(finding);
      if (owner === null) problems.push(`${where}: "${finding}" is not a finding the ledger may record (only chapter count, chapter label and highlight label drift)`);
      else if (owner !== key) problems.push(`${where}: "${finding}" belongs to ${owner}`);
      else set.add(finding);
    }
    ledger.set(key, { reason: entry.reason, findings: set });
  }
  return { ledger, problems };
}

/**
 * Split findings against the ledger. `keys` limits the stale check to the episodes that were linted
 * (null: every episode). Returns { open, known, stale }: findings to fail on, findings recorded as
 * drift, and ledger lines that no longer occur (each already phrased as a finding).
 */
export function applyKnownDrift(findings, ledger, { keys = null } = {}) {
  const open = [];
  const known = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = recordableKey(finding);
    const entry = key === null ? null : ledger.get(key);
    if (entry && entry.findings.has(finding)) {
      known.push(finding);
      seen.add(finding);
    } else {
      open.push(finding);
    }
  }
  const stale = [];
  for (const [key, entry] of ledger) {
    if (keys && !keys.includes(key)) continue;
    for (const finding of entry.findings) {
      if (!seen.has(finding)) stale.push(`${key}: guide-drift.json records "${finding}", which no longer occurs; remove it`);
    }
  }
  return { open, known, stale };
}

/** The ledger JSON text for these recordable findings, grouped by episode key, in the order given. */
export function renderDriftLedger(findings, { reason, previous = new Map() }) {
  const episodes = {};
  for (const finding of findings) {
    const key = recordableKey(finding);
    if (key === null) continue;
    (episodes[key] ??= { reason: previous.get(key)?.reason ?? reason, findings: [] }).findings.push(finding);
  }
  return JSON.stringify({
    $comment: 'Known step-structure drift between the filmed episodes and the rewritten guides, one verbatim lint finding per line. Written by node scripts/episode-lint.mjs <url> --write-drift; read by the lint (video/lib/guide-drift.mjs). A finding listed here is reported as known drift, not failed; any finding not listed fails, and a listed finding that no longer occurs fails as stale, so the list only shrinks. The same drift is on the review agenda (docs/review-agenda.md).',
    episodes,
  }, null, 2) + '\n';
}
