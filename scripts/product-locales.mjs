// Do IntelliDash's own catalogues hold up for the labels these guides reproduce?
//
// The guides ship in eleven languages and their fidelity claim is per-locale: a Dutch reader is
// told the button says something, and their screen has to agree. That claim can fail for a
// reason the guides cannot fix — the PRODUCT's catalogue is missing the key, or ships it
// untranslated, or ships it with a typo. Five such bugs were found by hand this session;
// this finds that whole class repeatably.
//
// SCOPED TO THE LABELS THE GUIDES ACTUALLY USE, and that scoping is the point. IntelliDash
// ships 1,014 keys; the reproduction resolves about fifty. Auditing all 1,014 produces a flood
// that is not these guides' problem and that nobody will read. Auditing the fifty a reader of
// THIS guide will hunt for on their own screen is directly actionable.
//
// ADVISORY, ALWAYS. Every finding here is a product bug in a repository this one cannot change.
// It exits zero so it can run in CI as a report, and the audience is IntelliDash Software.
//
// Usage:
//   node scripts/product-locales.mjs [--id <path>] [--all]
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_ID_SRC, norm } from './product-provenance.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const ID = arg('id', DEFAULT_ID_SRC);
const auditAll = argv.includes('--all');

const LOCALES = ['de-de', 'es-es', 'fr-fr', 'it-it', 'ja-jp', 'ko-ko', 'nl-nl', 'pt-pt', 'th-th', 'zh-cn'];

const flatten = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flatten(v, `${p}${k}.`, out);
    else out[`${p}${k}`] = String(v);
  }
  return out;
};

// Strings that are legitimately identical in every language. "Identical to English" is a weak
// signal on its own, and without this filter it fired 14 times on things that are all correct:
// the single-letter EZ Locator abbreviation "F" in all ten locales, and the copyright line in
// two. Fourteen correct entries hide the one real finding, so the check earns its place only
// once they are excluded.
const NOT_TRANSLATABLE = [
  /^(ET|VWC|RH|AP|Lynx|IntelliDash|GDD|NDVI|%|in|mm|°F|°C)$/i,  // units, acronyms, product names
  /^.{1,2}$/,                                                    // one- and two-character abbreviations
  /copyright|all rights reserved/i,                              // legal boilerplate, deliberately not localised
];

const isNotTranslatable = (s) => NOT_TRANSLATABLE.some((re) => re.test(s));

const i18nDir = join(ID, 'assets/i18n');
let en;
try {
  en = flatten(JSON.parse(await readFile(join(i18nDir, 'en-us.json'), 'utf8')));
} catch {
  console.error(`No IntelliDash checkout at ${ID} — cannot audit product catalogues.`);
  console.error('This check is advisory; pass --id <path> to point at a checkout.');
  process.exit(0);
}

// The keys the reproduction depends on: English label -> key, first writer wins (same rule as
// scripts/app-strings.mjs, so the two agree on which key a label resolves to).
const keyOf = new Map();
for (const [k, v] of Object.entries(en)) {
  const n = norm(v);
  if (n && !keyOf.has(n)) keyOf.set(n, k);
}

let scope;
if (auditAll) {
  scope = [...new Set(Object.keys(en))].sort();
} else {
  const cat = JSON.parse(await readFile('src/i18n/en-us.json', 'utf8'));
  const screen = [...new Set(cat._screenStrings || [])];
  scope = [...new Set(screen.map((s) => keyOf.get(norm(s))).filter(Boolean))].sort();
}

const findings = { missing: [], untranslated: [], whitespace: [] };

for (const locale of LOCALES) {
  let cat;
  try {
    cat = flatten(JSON.parse(await readFile(join(i18nDir, `${locale}.json`), 'utf8')));
  } catch {
    findings.missing.push({ locale, key: '(entire catalogue)', english: '' });
    continue;
  }

  for (const key of scope) {
    const english = en[key] ?? '';
    const value = cat[key];

    // Absent or blank: the reader sees English, or the raw key.
    if (value === undefined || value.trim() === '') {
      findings.missing.push({ locale, key, english });
      continue;
    }

    // A doubled or edge space is a product typo. Worth reporting because the guides normalise
    // whitespace to compare labels, so this is invisible to the fidelity gate by design —
    // es-es SPATIAL_ADJUST.AVG_VWC ships "Promedio de  CVA".
    if (/ {2,}/.test(value) || value !== value.trim()) {
      findings.whitespace.push({ locale, key, value });
    }

    // Identical to English. A weak signal on its own, which is why units and product names are
    // excluded — otherwise ET, VWC and Lynx fire in all ten locales and bury everything else.
    if (value.trim() === english.trim() && !isNotTranslatable(english.trim())) {
      findings.untranslated.push({ locale, key, english });
    }
  }
}

const scopeLabel = auditAll ? `all ${scope.length} product keys` : `${scope.length} key(s) the guides reproduce`;
console.log(`PRODUCT LOCALES  ${scopeLabel} across ${LOCALES.length} locale(s)   (advisory — product bugs, not guide bugs)`);
console.log(`                 IntelliDash checkout: ${ID}`);

const section = (title, rows, render) => {
  console.log(`\n${title}  ${rows.length}`);
  if (!rows.length) { console.log('  none'); return; }
  const byLocale = new Map();
  for (const r of rows) {
    if (!byLocale.has(r.locale)) byLocale.set(r.locale, []);
    byLocale.get(r.locale).push(r);
  }
  for (const [locale, list] of [...byLocale].sort()) {
    console.log(`  ${locale}  (${list.length})`);
    for (const r of list) console.log(`    ${render(r)}`);
  }
};

section('MISSING  the reader sees English or a raw key', findings.missing,
  (r) => `${r.key}${r.english ? `   en: ${JSON.stringify(r.english)}` : ''}`);

section('UNTRANSLATED  shipped identical to English', findings.untranslated,
  (r) => `${r.key}   ${JSON.stringify(r.english)}`);

section('WHITESPACE  doubled or edge spaces in the product string', findings.whitespace,
  (r) => `${r.key}   ${JSON.stringify(r.value)}`);

const total = findings.missing.length + findings.untranslated.length + findings.whitespace.length;
console.log(`\nPRODUCT LOCALES: ${total} finding(s) across ${LOCALES.length} locale(s). Advisory — never gates.`);
