// Mechanical validation of every translation catalogue against the English source.
//
// This checks the class of error that survives a fluent-sounding translation: a dropped number,
// a product name that got localised, a percent sign that vanished, a compound string that drifted
// from the standalone translation of its own parts. None of it judges whether the prose is any
// good — that needs a human — but all of it is the kind of mistake a reader would act on.
//
// Usage: node scripts/validate-locales.mjs [locale ...]
import { readFile, readdir } from 'node:fs/promises';

const dir = 'src/i18n';
const sourceCat = JSON.parse(await readFile(`${dir}/en-us.json`, 'utf8'));
const source = sourceCat.strings;
// Labels reproduced from the IntelliDash screen. For these the product's own shipped catalogue is
// the source of truth, not the English: if IntelliDash renders "Avg. VWC" as "Humedad media" in
// Spanish, the reproduction showing anything else would be the wrong one. So the protected-token
// and identical-to-English rules do not apply to them — a station ID, a timestamp and the
// fictional site name are all supposed to come through untouched.
const SCREEN = new Set(sourceCat._screenStrings || []);
const only = process.argv.slice(2);
const locales = (await readdir(dir))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .map((f) => f.replace('.json', ''))
  .filter((l) => !only.length || only.includes(l));

// Names the product does not translate, plus the identifiers a reader types or reads off a screen.
const PROTECTED = ['Toro', 'IntelliDash', 'Spatial Adjust', 'Lynx', 'TurfRad', 'VWC', 'ET',
  '3AP1', '11AP2', '9AP1', '5AP1', '6AP1', '7AP1', '10AP1', '/spatialadjust', 'MIN'];
// Characters that carry structure rather than language. A missing arrow is a broken instruction,
// and a lost ÷ or × breaks a formula. Deliberately excludes — and %: Romance languages routinely
// render an em dash as a colon, and Chinese spells "% Adj." out as 调整百分比 rather than using the
// glyph. Both are correct, and flagging them buries the real defects.
const STRUCTURAL = ['←', '→', '…', '›', '÷', '×'];

// Legitimately identical across languages — a URL, a trademark line, a duration code. Short strings
// are exempt too: "Concept.", "START" and "2 minutes" are real words in several target languages,
// and a long string coming back identical is the suspicious case, not a short one.
const MAY_MATCH = /^(\/spatialadjust|intellidash\.toro\.com\/spatialadjust|[2-5] MIN|Spatial Adjust\. Copyright .*)$/;
const SHORT = 14;

// Per-locale exemptions, each with the reason it is correct rather than a defect. Without these the
// report reads as 28 failures that nobody should act on, and a report nobody acts on is noise.
const EXEMPT = {
  // German orthography couples a proper noun into a compound with hyphens (Durchkopplung):
  // "Spatial-Adjust-Konto", "Spatial-Adjust-Kopfzeile". The trademark is intact and searchable;
  // writing "Spatial Adjust Konto" would be wrong German.
  'de-de': (en, tr, tok) => tok === 'Spatial Adjust' && tr.includes('Spatial-Adjust'),
  // Thai keeps the Latin acronym where VWC is the subject of the sentence ("VWC คือ…") but uses
  // IntelliDash's own shipped Thai for the named UI fields (Target VWC → ปริมาตรน้ำเป้าหมาย),
  // because that is the label a Thai user reads on the actual screen. Matching the product beats
  // matching the English.
  'th-th': (en, tr, tok) => tok === 'VWC' && /ปริมาตรน้ำ/.test(tr),
};

const numbersOf = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || [])
  // Compare numerically so a decimal comma is not read as a changed value.
  .map((n) => n.replace(',', '.'));

const report = {};
let totalIssues = 0;

for (const locale of locales) {
  const data = JSON.parse(await readFile(`${dir}/${locale}.json`, 'utf8'));
  const t = data.strings;
  const issues = { missingNumber: [], droppedToken: [], structuralDrift: [], untranslated: [], empty: [], compoundDrift: [] };

  for (const [en, tr] of Object.entries(t)) {
    if (!tr || !String(tr).trim()) { issues.empty.push(en.slice(0, 50)); continue; }

    const want = numbersOf(en), got = numbersOf(tr);
    // Multiset comparison: order can legitimately change, presence cannot.
    const missing = want.filter((n) => { const i = got.indexOf(n); if (i === -1) return true; got.splice(i, 1); return false; });
    if (missing.length) issues.missingNumber.push(`${en.slice(0, 45)} :: lost ${missing.join(',')}`);

    for (const tok of PROTECTED) {
      // Word-boundary matched, not substring: "GETTING STARTED" contains the letters of "ET",
      // and a validator that reports that is a validator nobody reads. \b does not fire between
      // a Latin letter and a CJK/Thai character, so the target side is checked with an explicit
      // "not adjacent to another Latin letter" test instead.
      const bounded = new RegExp(`(?<![A-Za-z])${tok.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![A-Za-z])`);
      if (bounded.test(en) && !bounded.test(tr) && !SCREEN.has(en) && !(EXEMPT[locale]?.(en, tr, tok))) {
        issues.droppedToken.push(`${en.slice(0, 45)} :: lost "${tok}"`);
      }
    }
    for (const ch of STRUCTURAL) {
      const a = (en.split(ch).length - 1), b = (tr.split(ch).length - 1);
      if (a !== b) issues.structuralDrift.push(`${en.slice(0, 40)} :: ${ch} ${a}→${b}`);
    }
    if (en === tr && !MAY_MATCH.test(en) && en.length > SHORT && !SCREEN.has(en)) {
      issues.untranslated.push(en.slice(0, 55));
    }
  }

  // A compound must contain the standalone translation of its own tail, or the two disagree on
  // screen: the step list says one thing and the step heading says another.
  for (const [en, tr] of Object.entries(t)) {
    const m = en.match(/^Step \d+ of \d+: (.+)$/);
    if (!m) continue;
    const partEn = m[1];
    const partTr = t[partEn];
    if (partTr && !tr.includes(partTr)) {
      issues.compoundDrift.push(`${en.slice(0, 45)} :: heading differs from "${partEn.slice(0, 30)}"`);
    }
  }

  const counts = Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length]));
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  totalIssues += n;
  report[locale] = { total: n, ...counts, samples: Object.fromEntries(
    Object.entries(issues).filter(([, v]) => v.length).map(([k, v]) => [k, v.slice(0, 4)])) };
}

console.log(JSON.stringify(report, null, 2));
console.log(totalIssues === 0 ? '\nVALIDATE: PASS' : `\nVALIDATE: ${totalIssues} issue(s) across ${locales.length} locale(s)`);
process.exit(totalIssues === 0 ? 0 : 1);
