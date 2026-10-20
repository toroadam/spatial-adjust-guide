// Mechanical validation of every translation catalogue against the English source.
//
// This checks the class of error that survives a fluent-sounding translation: a dropped number,
// a product name that got localised, a percent sign that vanished, a compound string that drifted
// from the standalone translation of its own parts. None of it judges whether the prose is any
// good — that needs a human — but all of it is the kind of mistake a reader would act on.
//
// Two catalogues are checked. The page catalogue (src/i18n/<locale>.json) comes first, with results
// reported under the locale code. The video caption catalogues (src/i18n/captions/<locale>.json, see
// scripts/media-cues.mjs) follow, reported under "captions:<locale>": the same per-string checks, plus
// a cue with no translation (missingCue) and a cue that quotes a guide step heading in different words
// from the heading itself (stepLabelDrift).
//
// Usage: node scripts/validate-locales.mjs [locale ...]
import { readFile, readdir } from 'node:fs/promises';
import { stepLabelMatcher, stepLabelsFrom } from '../src/media/captions.mjs';

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
const hardcoded = new Set();
try {
  const dlg = await readFile(
    '/Users/adammunir/IntelliDash/site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts',
    'utf8');
  for (const m of dlg.matchAll(/new SaDlgMenuItem\('([^']+)',\s*'([^']+)'/g)) {
    hardcoded.add(m[1]);
    hardcoded.add(m[2]);
  }
} catch { /* no checkout: nothing known to be hardcoded */ }
const only = process.argv.slice(2);
const locales = (await readdir(dir))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .map((f) => f.replace('.json', ''))
  .filter((l) => !only.length || only.includes(l));

// Names the product does not translate, plus the identifiers a reader types or reads off a screen.
// Double Click is the name of the video series, kept untranslated like a product name.
const PROTECTED = ['Toro', 'IntelliDash', 'Spatial Adjust', 'Lynx', 'TurfRad', 'VWC', 'ET',
  '3AP1', '11AP2', '9AP1', '5AP1', '6AP1', '7AP1', '10AP1', '/spatialadjust', 'MIN', 'Double Click'];
// Characters that carry structure rather than language. A missing arrow is a broken instruction,
// and a lost ÷ or × breaks a formula. Deliberately excludes — and %: Romance languages routinely
// render an em dash as a colon, and Chinese spells "% Adj." out as 调整百分比 rather than using the
// glyph. Both are correct, and flagging them buries the real defects.
const STRUCTURAL = ['←', '→', '…', '›', '÷', '×'];

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

/**
 * The checks every translated string gets, whichever catalogue it is in: numbers, protected tokens,
 * structural characters, untranslated and empty values. `screen` is the set of reproduced screen
 * labels exempt from the token and untranslated rules (the page catalogue's _screenStrings; none for
 * captions). Appends to `issues`.
 */
function checkStrings(locale, t, issues, screen) {
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
      if (bounded.test(en) && !bounded.test(tr) && !screen.has(en) && !(EXEMPT[locale]?.(en, tr, tok))) {
        issues.droppedToken.push(`${en.slice(0, 45)} :: lost "${tok}"`);
      }
    }
    for (const ch of STRUCTURAL) {
      const a = (en.split(ch).length - 1), b = (tr.split(ch).length - 1);
      if (a !== b) issues.structuralDrift.push(`${en.slice(0, 40)} :: ${ch} ${a}→${b}`);
    }
    if (en === tr && !MAY_MATCH.test(en) && en.length > SHORT && !screen.has(en)) {
      issues.untranslated.push(en.slice(0, 55));
    }
  }
}

/**
 * Fold one catalogue's issues into the report under `name`. Every issue type gates except the ones
 * listed in `advisoryTypes`, which are counted separately and never fail the run.
 */
function record(name, issues, advisoryTypes = [], extra = {}) {
  const counts = Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length]));
  const n = Object.entries(counts)
    .filter(([k]) => !advisoryTypes.includes(k))
    .reduce((a, [, v]) => a + v, 0);
  totalIssues += n;
  for (const k of advisoryTypes) advisory += counts[k] || 0;
  report[name] = { total: n, ...extra, ...counts, samples: Object.fromEntries(
    Object.entries(issues).filter(([, v]) => v.length).map(([k, v]) => [k, v.slice(0, 4)])) };
}

// ---- the page catalogue --------------------------------------------------------------------------

const page = {}; // locale -> its page catalogue's strings, for the caption step-label check

for (const locale of locales) {
  const data = JSON.parse(await readFile(`${dir}/${locale}.json`, 'utf8'));
  const t = data.strings;
  page[locale] = t;
  const issues = { missingNumber: [], droppedToken: [], structuralDrift: [], untranslated: [], empty: [], compoundDrift: [], screenLabelDrift: [] };

  checkStrings(locale, t, issues, SCREEN);

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

  // screenLabelDrift is ADVISORY, not a gate. It reports prose that names a reproduced control
  // using different words from the control itself — real signal, but there are hundreds of them:
  // the guide prose was written independently of IntelliDash's shipped labels, so "Bulk Adjust"
  // is "Sammelanpassung" in the prose and "Massenanpassung" on screen. Worth a dedicated pass;
  // failing the build on it would just mean nobody runs the validator.
  record(locale, issues, ['screenLabelDrift']);
}

// ---- the caption catalogues ----------------------------------------------------------------------
//
// One per locale, translating the cue text of every English caption track. build.mjs refuses to
// write a track with an untranslated cue, so a missing cue is a gate here too; a locale with no
// caption catalogue at all is only a problem once there are cues to translate.
const captionsSource = JSON.parse(await readFile(`${dir}/captions/en-us.json`, 'utf8')).strings;
const cueCount = Object.keys(captionsSource).length;
// The guide's step headings, from the same "Step N of M: <label>" keys compoundDrift checks above.
const labelsIn = stepLabelMatcher(stepLabelsFrom(source));

for (const locale of locales) {
  let t;
  try {
    t = JSON.parse(await readFile(`${dir}/captions/${locale}.json`, 'utf8')).strings;
    if (!t || typeof t !== 'object') throw new Error(`${dir}/captions/${locale}.json has no "strings" map — regenerate it`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    if (!cueCount) continue;                            // nothing to caption yet
    t = null;
  }
  const issues = { missingNumber: [], droppedToken: [], structuralDrift: [], untranslated: [], empty: [], missingCue: [], stepLabelDrift: [] };
  const strings = t || {};

  // Keys outside the source are not checked here: assemble-locale.mjs refuses them, and a stale
  // translation of a cue nobody speaks any more cannot reach a track.
  const current = Object.fromEntries(Object.entries(strings).filter(([en]) => en in captionsSource));
  checkStrings(locale, current, issues, new Set());

  for (const en of Object.keys(captionsSource)) {
    if (!(en in strings)) issues.missingCue.push(en.slice(0, 55));
  }

  // A cue that quotes a step heading must use the heading's own translation, or the video names the
  // step one way and the guide another. Same tolerance as screenLabelDrift: case, whitespace and
  // spaces next to CJK characters do not count as a difference.
  for (const [en, tr] of Object.entries(current)) {
    if (!tr || !String(tr).trim()) continue;            // already reported as empty
    for (const label of labelsIn(en)) {
      const heading = page[locale][label];
      if (heading && !present(tr, heading)) {
        issues.stepLabelDrift.push(`${en.slice(0, 40)} :: should name "${heading}"`);
      }
    }
  }

  record(`captions:${locale}`, issues, [], t ? {} : { catalogue: `missing: ${dir}/captions/${locale}.json` });
}

console.log(JSON.stringify(report, null, 2));
console.log(totalIssues === 0 ? '\nVALIDATE: PASS' : `\nVALIDATE: ${totalIssues} issue(s) across ${locales.length} locale(s)`);
if (advisory) console.log(`VALIDATE: ${advisory} advisory screen-label mismatch(es) — prose naming a control differently from the control. Not a gate; see README > Known gaps.`);
process.exit(totalIssues === 0 ? 0 : 1);
