// Asserts the fidelity gate reaches the SAME verdict with and without an IntelliDash checkout.
//
// Why this exists. The gate derived "is this tab in flight" by reading the IntelliDash source at
// run time. That made its verdict a function of what else was on the disk: green on a machine
// with IntelliDash cloned, red in CI, which has no checkout and so excused nothing. The first
// deploy it guarded failed on the six Target Profiles labels the gate is specifically designed to
// forgive — and it failed AFTER a full local suite came back green, which is the worst way to
// find out. The comment in the source said "gate unaffected"; it was affected.
//
// A gate that only holds on the maintainer's laptop is not a gate. The fixture is now the sole
// authority and the checkout only reports drift, so parity holds by construction — this test is
// what keeps it that way.
//
// The advisory sections below FULL INVENTORY legitimately degrade without a checkout (resolving a
// label to an i18n key needs the product's catalogue). Only the GATING surface must match.
//
// Usage: node scripts/fidelity-parity.mjs
import { spawnSync } from 'node:child_process';

const run = (args) => {
  const r = spawnSync('node', ['scripts/fidelity.mjs', ...args], { encoding: 'utf8' });
  const out = (r.stdout || '');
  // Everything up to FULL INVENTORY is the gating surface: the GATE list, the drill-level
  // exclusions, the in-flight exclusions and the structural findings.
  const cut = out.indexOf('FULL INVENTORY');
  return {
    code: r.status,
    gating: (cut === -1 ? out : out.slice(0, cut)).trim(),
    verdict: (out.match(/^FIDELITY: .*$/m) || [''])[0],
  };
};

const withCheckout = run([]);
const without = run(['--id', '/nonexistent/no-checkout-here']);

const problems = [];
if (withCheckout.code !== without.code) {
  problems.push(`exit code differs: ${withCheckout.code} with a checkout, ${without.code} without`);
}
if (withCheckout.verdict !== without.verdict) {
  problems.push(`verdict differs: "${withCheckout.verdict}" vs "${without.verdict}"`);
}
if (withCheckout.gating !== without.gating) {
  const a = withCheckout.gating.split('\n');
  const b = without.gating.split('\n');
  const diff = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diff.push(`    line ${i + 1}\n      with:    ${a[i] ?? '(none)'}\n      without: ${b[i] ?? '(none)'}`);
    if (diff.length >= 5) break;
  }
  problems.push(`gating output differs:\n${diff.join('\n')}`);
}

if (problems.length) {
  console.log('FIDELITY PARITY: FAIL');
  for (const p of problems) console.log(`  ${p}`);
  console.log('\n  The gate is reading something CI does not have. Record the fact in');
  console.log('  src/i18n/product-labels.json at harvest time instead of deriving it at run time.');
  process.exit(1);
}

console.log(`FIDELITY PARITY: PASS — same verdict with and without a checkout (${withCheckout.verdict})`);
