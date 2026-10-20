// Mechanical validation of every translation catalogue against the English source.
//
// This checks the class of error that survives a fluent-sounding translation: a dropped number,
// a product name that got localised, a percent sign that vanished, a compound string that drifted
// from the standalone translation of its own parts. None of it judges whether the prose is any
// good — that needs a human — but all of it is the kind of mistake a reader would act on.
//
// It also checks the English side of the label rule once, whatever locales are named:
// labelProvenance, a GATE, requires every [[Exact Label]] marker in the published guides to be a
// label IntelliDash renders (src/i18n/labels.en-us.json) and to be named by a Verified claim in the
// claims ledger (docs/claims/claims.json).
//
// Usage: node scripts/validate-locales.mjs [locale ...] [--all]
//   --all   print every finding instead of the first four of each kind
import { readFile, readdir } from 'node:fs/promises';
import { hardcodedLabels, englishInProduct, markerProblems, markersOf } from './lib/markers.mjs';
import { loadGuides } from './lib/load-guides.mjs';

const dir = 'src/i18n';
const sourceCat = JSON.parse(await readFile(`${dir}/en-us.json`, 'utf8'));
const source = sourceCat.strings;
// Labels reproduced from the IntelliDash screen. For these the product's own shipped catalogue is
// the source of truth, not the English: if IntelliDash renders "Avg. VWC" as "Humedad media" in
// Spanish, the reproduction showing anything else would be the wrong one. So the protected-token
// and identical-to-English rules do not apply to them — a station ID, a timestamp and the
// fictional site name are all supposed to come through untouched.
const SCREEN = new Set(sourceCat._screenStrings || []);
// IntelliDash's own shipped catalogues, harvested by scripts/build-glossary.mjs. This is what
// gives a screen label PROVENANCE: a label present here has a product translation to be
// faithful to. A label absent from it — "Calculation", "Soil Factor Editor" — exists only in
// the reproduction, so its "translation" is one this pipeline invented. Checking prose against
// an invented rendering asserts a source of truth that does not exist, and reported 34 defects
// that no reader could act on.
const glossary = JSON.parse(await readFile(`${dir}/glossary.json`, 'utf8'));

// Labels the product renders from HARDCODED LITERALS rather than its catalogue. The Settings
// dialog builds its menu as `new SaDlgMenuItem('Calculation', ...)` and paints it with
// {{ item.title }} — no translate pipe — so those words are English on every reader's screen in
// all eleven locales, whatever the catalogue happens to contain for the same string.
//
// Trusting the glossary here actively misleads. STRINGS.PREFERENCES is "อ้างอิง" in Thai, which
// means "reference" and is a product mistranslation; demanding the guides match it would have
// told Thai readers to look for a tab labelled "reference" when their screen says "Preferences".
// Seven findings said exactly that.
//
// The list comes from the committed fixture src/i18n/product-labels.json (surfaces.settings.menu),
// with a local IntelliDash checkout read as an addition (scripts/lib/markers.mjs). It used to come
// from the checkout alone, so CI, which has none, knew of no hardcoded label and reached a
// different verdict from a laptop. The markerDrift gate below depends on it, so it cannot differ.
const hardcoded = hardcodedLabels();
// Labels IntelliDash leaves English in a locale (src/i18n/product-untranslated.json); markerDrift only.
const english = englishInProduct();
const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const only = argv.filter((a) => !a.startsWith('--'));
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
// [[ and ]] delimit an on-screen label in a rewritten step (docs/writing-guide.md > Label markers);
// markerDrift below checks the labels themselves.
const STRUCTURAL = ['←', '→', '…', '›', '÷', '×', '[[', ']]'];

// Legitimately identical across languages — a URL, a trademark line, a duration code. Short strings
// are exempt too: "Concept.", "START" and "2 minutes" are real words in several target languages,
// and a long string coming back identical is the suspicious case, not a short one.
// Also covers the contact details, which entered the catalogue when scripts/extract-strings.mjs
// began driving the contact modal. A support address and a portal URL are supposed to come
// back byte-identical, and both are long enough to clear the SHORT exemption — so without
// this they would fail the untranslated GATE for doing exactly the right thing.
const MAY_MATCH = /^(\/spatialadjust|intellidash\.toro\.com\/spatialadjust|[2-5] MIN|Spatial Adjust\. Copyright .*|[^\s@]+@[^\s@]+\.[a-z]{2,}|https?:\/\/\S+)$/;
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
  // Ruled 2026-09-12: when prose NAMES a control it uses the product's shipped label; when it
  // discusses the CONCEPT it keeps VWC. These four locales ship a Target/Avg. VWC label with no
  // acronym in it — "CVA objetivo", "Teneur en eau volumétrique cible", "목표 체적 수분 함량",
  // "平均体積含水率" — so prose that names the control correctly cannot contain the token, and the
  // droppedToken GATE would fail it for being right. The guides exist so a reader can find the
  // control on their own screen; a findable label beats a preserved acronym.
  //
  // Bare VWC as a concept is untouched and still guarded: only the compound control names were
  // changed, so a translation that drops the acronym everywhere still fails.
  'es-es': (en, tr, tok) => tok === 'VWC' && /CVA/.test(tr),
  'fr-fr': (en, tr, tok) => tok === 'VWC' && /Teneur en eau volumétrique|Hv\b/.test(tr),
  'ko-ko': (en, tr, tok) => tok === 'VWC' && /체적 수분 함량/.test(tr),
  'ja-jp': (en, tr, tok) => tok === 'VWC' && /体積含水率/.test(tr),
};

const numbersOf = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || [])
  // Compare numerically so a decimal comma is not read as a changed value.
  .map((n) => n.replace(',', '.'));

// A named control is "present" if it appears allowing for case and whitespace. Both differences
// are things the reader's eye passes over and correct prose legitimately introduces: Dutch
// lowercases and inflects an adjective mid-sentence ("de voorgestelde percentages" for a label
// reading "Voorgesteld"), and IntelliDash's own es-es AVG_VWC ships a double space
// ("Promedio de  CVA") that prose can only match by reproducing the typo. Demanding a verbatim
// match reported 49 findings whose "fix" would have been to write worse prose.
// Spaces adjacent to CJK characters are dropped before comparing. Chinese, Japanese and Thai do
// not use the space as a word separator, so "平均 VWC" and "平均VWC" are the same label to a
// reader — and the product ships one form while the prose uses the other. Treating them as
// different reported seven Chinese findings that no reader could perceive.
const stripCjkSpaces = (s) => s.replace(/(?<=[\u3000-\u9fff\uff00-\uffef\u0e00-\u0e7f])\s+|\s+(?=[\u3000-\u9fff\uff00-\uffef\u0e00-\u0e7f])/g, '');
const present = (haystack, needle) => {
  const flat = (s) => stripCjkSpaces(s.toLowerCase().replace(/[\s\u00a0]+/g, ' '));
  return flat(haystack).includes(flat(needle));
};

// Longest match wins. "Suggested" is a substring of "Suggested Percent Adjust Calculation", so
// prose naming the FIELD was also being required to name the COLUMN — two different controls that
// merely share a word. Requiring both forces a sentence to quote a label it is not about, which is
// how a findability check starts producing worse prose than it found.
const shadowed = (label, named) => named.some((other) => other !== label && other.includes(label));

const report = {};
let totalIssues = 0;
let advisory = 0;
const shown = (v) => (ALL ? v : v.slice(0, 4));

// labelProvenance, a GATE, on the English. A rewritten step names each control as [[Exact Label]],
// and the renderer draws it bold as the words to look for on screen, so the words must exist there.
// Two sources, both committed so the verdict is the same with and without an IntelliDash checkout:
//   - src/i18n/labels.en-us.json, written by scripts/build-label-fixture.mjs from IntelliDash's
//     en-us.json and the hardcoded Settings rail at the production pin. The label must be a key,
//     exactly: same case, spacing and punctuation (docs/writing-guide.md > Label markers).
//   - the claims ledger, docs/claims/claims.json. Some Verified claim must name the label in its
//     text or its verifier's note, matched exactly and not as part of a longer word. A label that
//     only an Unverified or Needs-expert sentence mentions has not been checked against the product.
// Every marker in the guide data counts, wherever it sits (do, see, ifNot, why, start, ...), and in
// every guide, pending or not: a marker exists only once someone has written it as a label.
{
  const fixture = JSON.parse(await readFile(`${dir}/labels.en-us.json`, 'utf8')).labels || {};
  const verified = JSON.parse(await readFile('docs/claims/claims.json', 'utf8')).claims
    .filter((c) => c.status === 'Verified');
  const ledgerHit = new Map();
  const inLedger = (label) => {
    if (!ledgerHit.has(label)) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u');
      ledgerHit.set(label, verified.find((c) => re.test(c.text) || re.test(c.note || ''))?.id);
    }
    return ledgerHit.get(label);
  };
  // Every string in a guide, with the path that reaches it ("steps[1].do", "start.needs").
  const stringsOf = (v, path, out = []) => {
    if (typeof v === 'string') out.push([path, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => stringsOf(x, `${path}[${i}]`, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) stringsOf(x, path ? `${path}.${k}` : k, out);
    return out;
  };
  const where = (path) => path.replace(/^steps\[(\d+)\]\./, (_, i) => `step ${Number(i) + 1} `);

  const { GUIDES, keys } = loadGuides();
  const labelProvenance = [];
  let markers = 0;
  for (const key of keys) {
    for (const [path, text] of stringsOf(GUIDES[key], '')) {
      for (const label of markersOf(text)) {
        markers++;
        const at = `${key} ${where(path)}: [[${label}]]`;
        if (!Object.hasOwn(fixture, label)) {
          labelProvenance.push(`${at} is not a label IntelliDash renders (src/i18n/labels.en-us.json); copy the catalogue value exactly`);
        } else if (!inLedger(label)) {
          labelProvenance.push(`${at} is named by no Verified claim in docs/claims/claims.json`);
        }
      }
    }
  }
  totalIssues += labelProvenance.length;
  report['en-us'] = { total: labelProvenance.length, markers, labelProvenance: labelProvenance.length,
    samples: labelProvenance.length ? { labelProvenance: shown(labelProvenance) } : {} };
}

for (const locale of locales) {
  const data = JSON.parse(await readFile(`${dir}/${locale}.json`, 'utf8'));
  const t = data.strings;
  const issues = { missingNumber: [], droppedToken: [], structuralDrift: [], untranslated: [], empty: [], compoundDrift: [], markerDrift: [], screenLabelDrift: [] };

  for (const [en, tr] of Object.entries(t)) {
    if (!tr || !String(tr).trim()) { issues.empty.push(en.slice(0, 50)); continue; }

    // Where the translation IS IntelliDash's own shipped rendering, the product decides and this
    // file does not get a vote. The help line is the case: TORO.HELP_LINE is a different number in
    // every region, so "1-800-ASK-TORO" becomes "00-800-8040-8040" in German and the digits of the
    // English are legitimately absent. Same principle as the _screenStrings exemption above.
    const productOwned = (glossary[locale] || {})[en] === tr;
    const want = productOwned ? [] : numbersOf(en), got = numbersOf(tr);
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

  // Prose that names a reproduced screen label must use the label's own translation. A guide
  // saying "open Toutes les stations" while the tab reads "Toutes les voies" sends the reader
  // hunting for a control that is not there — which is the exact failure the guides exist to
  // prevent, and it happened in four locales before this check existed.
  for (const [en, tr] of Object.entries(t)) {
    if (SCREEN.has(en)) continue;                       // the label itself, not prose about it
    const named = [...SCREEN].filter((label) => label.length >= 8
      && en.includes(label) && (label in (glossary[locale] || {}))
      && !hardcoded.has(label));
    for (const label of named) {
      if (shadowed(label, named)) continue;             // a longer label covers this one
      if (!present(tr, t[label])) {
        issues.screenLabelDrift.push(`${en.slice(0, 40)} :: should name "${t[label]}"`);
      }
    }
  }

  // markerDrift, a GATE. A rewritten step names each control as [[Exact Label]], and the renderer
  // shows whatever is inside the brackets in bold, as the thing to find on screen. So a translation
  // must keep every marker, and each marker must hold the label the reader's screen shows in this
  // locale: English for a label IntelliDash hardcodes or ships untranslated here, otherwise the
  // locale's translation of the screen label (scripts/lib/markers.mjs > expectedLabel). A marker that drifts is worse than
  // prose that drifts, because it is drawn as the exact label.
  const markerCtx = { t, screen: SCREEN, glossary: glossary[locale] || {}, hardcoded, english, locale };
  for (const [en, tr] of Object.entries(t)) {
    if (!en.includes('[[') && !String(tr).includes('[[')) continue;
    for (const p of markerProblems(en, String(tr), markerCtx)) {
      issues.markerDrift.push(`${en.slice(0, 50)} :: ${p}`);
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
  // screenLabelDrift is ADVISORY, not a gate. It reports prose that names a reproduced control
  // using different words from the control itself — real signal, but there are hundreds of them:
  // the guide prose was written independently of IntelliDash's shipped labels, so "Bulk Adjust"
  // is "Sammelanpassung" in the prose and "Massenanpassung" on screen. Worth a dedicated pass;
  // failing the build on it would just mean nobody runs the validator.
  const n = Object.entries(counts)
    .filter(([k]) => k !== 'screenLabelDrift')
    .reduce((a, [, v]) => a + v, 0);
  totalIssues += n;
  advisory += counts.screenLabelDrift;
  report[locale] = { total: n, ...counts, samples: Object.fromEntries(
    Object.entries(issues).filter(([, v]) => v.length).map(([k, v]) => [k, shown(v)])) };
}

console.log(JSON.stringify(report, null, 2));
console.log(totalIssues === 0 ? '\nVALIDATE: PASS' : `\nVALIDATE: ${totalIssues} issue(s) across ${locales.length} locale(s)`);
if (advisory) console.log(`VALIDATE: ${advisory} advisory screen-label mismatch(es) — prose naming a control differently from the control. Not a gate; see README > Known gaps.`);
process.exit(totalIssues === 0 ? 0 : 1);
