// Import a Core Design export into the repo, sanitizing customer data on the way in.
//
// WHY IMPORT-TIME AND NOT BUILD-TIME: this repo publishes to a public site. If a raw
// export were copied into the working tree and only cleaned during `npm run build`, the
// real data would sit in a tracked directory in the meantime and one `git add -A` would
// publish it. Sanitizing here means the repo never holds it at any point.
//
// The real -> fictional mapping lives in sanitize.local.json, which is gitignored: it
// contains the real values by definition. This file is committed and therefore contains
// none of them — the rules below are expressed generically so they can be reviewed in
// public without disclosing what they protect against.
//
// Usage: node scripts/import-export.mjs "/path/to/Core Design export folder"

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = import.meta.dirname + '/..';
const FILES = ['Learn Spatial Adjust.dc.html', 'SpatialAdjustApp.dc.html'];
const MAP_PATH = join(ROOT, 'sanitize.local.json');

// Generic invariants the sanitized output must satisfy. These encode the *shape* of
// sensitive data rather than its content, so they still catch values nobody has seen yet
// — which is the failure mode that mattered: the first sanitization pass searched for
// known terms and missed an identifier that differed only in letter case.
const RULES = [
  {
    name: 'high-precision coordinates',
    // Real site coordinates arrive with 6-7 decimal places. Anything that precise is a
    // real location, so require coarse values.
    test: (s) => s.match(/'-?\d{1,3}\.\d{5,}'/g),
    hint: 'Reduce coordinate precision; a 5+ decimal coordinate identifies a real site.',
  },
  {
    name: 'unexpected TurfRad ID prefix',
    test: (s) => (s.match(/'([a-z]+)-\d+'/g) || []).filter((v) => !/^'(riverbend|demo|sample)-/.test(v)),
    hint: 'Site ID strings must use an approved fictional prefix.',
  },
  {
    name: 'site name not on the fictional allowlist',
    // Targets the three places the app actually renders a site name, rather than scanning
    // every capitalised string — an earlier broad version flagged the product name itself.
    //   1. beside the globe icon in the header
    //   2. as the first breadcrumb segment, followed by a separator
    // A third context — any span followed by a chevron — was tried and removed: it matched
    // ordinary dropdowns such as a hole-count selector, not site names.
    test: (s) => {
      const contexts = [
        /globe\.png"[^>]*>\s*<\/span>\s*([^<]{2,60})</g,
        /<span>([^<]{2,60})<\/span><span[^>]*>\/<\/span>/g,
      ];
      const allow = new Set(['Riverbend National']);
      const found = [];
      for (const re of contexts) {
        for (const m of s.matchAll(re)) {
          const name = m[1].trim();
          if (name && !allow.has(name)) found.push(name);
        }
      }
      return found;
    },
    hint: 'A site name outside the fictional allowlist reached the header, selector or breadcrumb.',
  },
];

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  const srcDir = process.argv[2];
  if (!srcDir) throw new Error('Usage: node scripts/import-export.mjs "<export folder>"');

  if (!(await exists(MAP_PATH))) {
    throw new Error(
      `Missing ${MAP_PATH}.\n` +
      `  It maps real customer values to fictional ones and is gitignored on purpose.\n` +
      `  Create it as a flat {"real":"fictional"} JSON object before importing.`,
    );
  }
  const map = JSON.parse(await readFile(MAP_PATH, 'utf8'));
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length); // longest first

  // Sanitize and validate EVERY file before writing ANY of them. An earlier version wrote
  // each file as it went and left the repo half-imported when a later file failed a rule.
  let totalReplacements = 0;
  const cleaned = [];

  for (const file of FILES) {
    const srcPath = join(srcDir, file);
    if (!(await exists(srcPath))) throw new Error(`Export is missing ${file}`);
    let src = await readFile(srcPath, 'utf8');

    for (const [real, fake] of entries) {
      // Case-insensitive: the identifier that escaped the first pass differed only in case.
      const re = new RegExp(real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const hits = (src.match(re) || []).length;
      if (hits) { src = src.replace(re, fake); totalReplacements += hits; }
    }

    for (const rule of RULES) {
      const found = rule.test(src);
      if (found && found.length) {
        throw new Error(
          `Sanitization failed on ${file} — ${rule.name}\n` +
          `  ${found.length} occurrence(s) survived.\n` +
          `  ${rule.hint}\n` +
          `  Nothing was written; the repo is unchanged.\n` +
          `  Add the value to sanitize.local.json and re-run. Do not paste it into a commit or ticket.`,
        );
      }
    }

    cleaned.push([file, src]);
  }

  for (const [file, src] of cleaned) {
    await writeFile(join(ROOT, file), src);
    console.log(`  imported ${file} (${src.length.toLocaleString()} chars)`);
  }

  console.log(`sanitized: ${totalReplacements} replacement(s) across ${FILES.length} file(s); all rules pass`);
  console.log('Next: npm test');
}

await main();
