// Mechanical grammar checks on the translated catalogues.
//
// scripts/validate-locales.mjs checks that a translation kept its numbers, product names and
// structure. None of that notices bad grammar, and bulk term replacement produces exactly that:
// swapping one noun for another silently breaks agreement with whatever surrounds it.
//
// Three real breaks shipped into the working tree during the VWC ruling and were caught only by
// reading samples:
//   ko  "평균 체적 수분 함량는" — 함량 ends in a consonant, so it takes 은. 17 sentences.
//   fr  "Une erreur d'réglage en lot" — elision is correct before the vowel in "ajustement",
//       wrong before "réglage".
//   zh  "得出的最大“建议的”为 333%" — 建议的 is an adjective; the noun is 建议值.
//
// Sampling found those three. Sampling is not proof, so the checkable classes are checked here
// over every string in every locale.
//
// WHAT THIS DOES NOT CHECK, deliberately. Rules that cannot distinguish correct prose from broken
// prose were removed rather than tuned, because a linter that cries wolf is one people learn to
// ignore — the same failure as the 308 advisory findings nobody actioned. Chinese
// adjective-versus-noun needs a reader. General Korean particle agreement needs morphology.
// French article contraction needs a parser. Of the three breaks above, this catches the Korean
// and the French; the Chinese one is only caught by someone reading it.
//
// Usage: node scripts/prose-lint.mjs [locale ...]
import { readFile, readdir } from 'node:fs/promises';

const dir = 'src/i18n';
const only = process.argv.slice(2);

// ---- Korean ------------------------------------------------------------------------------------
// A Hangul syllable carries a final consonant (batchim) when (code - 0xAC00) % 28 is non-zero.
// Particle choice is a pure function of that, so a mismatch is unambiguous rather than stylistic.
const hasBatchim = (ch) => {
  const c = ch.codePointAt(0);
  if (c < 0xac00 || c > 0xd7a3) return null;      // not Hangul: no opinion
  return (c - 0xac00) % 28 !== 0;
};
// [consonant-final form, vowel-final form]
const KO_PARTICLES = [['은', '는'], ['이', '가'], ['을', '를'], ['과', '와']];

// Checked ONLY after nouns this project introduced by term replacement. A general rule is not
// possible without morphological analysis: 이/가/은/는 appear constantly inside ordinary words and
// verb endings — 페이지 ("page"), 없는 (a form of 없다) — and flagging every one produced 434
// findings, none of them real. A linter nobody can trust is worse than no linter, which is the
// same lesson as the 308 advisory findings nobody actioned.
//
// This list is the honest scope: the terms the VWC ruling substituted, whose final consonant is
// known. Extend it when a term swap introduces another noun.
const KO_CHECKED_NOUNS = ['체적 수분 함량', '함량'];

function koreanParticles(text) {
  const out = [];
  for (const noun of KO_CHECKED_NOUNS) {
    let i = text.indexOf(noun);
    while (i !== -1) {
      const p = text[i + noun.length];
      const b = hasBatchim(noun[noun.length - 1]);
      if (p && b !== null) {
        for (const [cons, vow] of KO_PARTICLES) {
          if (p === cons && b === false) out.push(`"${noun}${p}" should take "${vow}"`);
          if (p === vow && b === true) out.push(`"${noun}${p}" should take "${cons}" (${noun} ends in a consonant)`);
        }
      }
      i = text.indexOf(noun, i + 1);
    }
  }
  return [...new Set(out)];
}

// ---- French ------------------------------------------------------------------------------------
// Elided forms attach only before a vowel or mute h. Anything else is a broken contraction, which
// is what a term swap produces when the replacement starts with a consonant.
const FR_ELISION = /\b([dlnmtsjc]|qu)['’](?=[bcdfgjklmnpqrstvwxzBCDFGJKLMNPQRSTVWXZ])/g;
// NO contraction rule. "de le"/"de les" contract only before an ARTICLE; before a pronoun they
// are correct French — "au lieu de les relever", "C'est à vous de le définir". Telling those
// apart needs a parser, and the naive rule produced four findings, all of them correct prose.
// It also matched "à le" inside "déjà le", because \b does not behave around non-ASCII.

// ---- any language ------------------------------------------------------------------------------
const DOUBLE_SPACE = /\S {2,}\S/;
// NO repeated-word rule either. Doubling is legitimate in several of these languages — German
// "die Zahl, die die Berechnung bevorzugt", Dutch "een scan die die dag is uitgevoerd", French
// reflexive "où vous vous trouvez" — and \b matched "esta esta" inside Portuguese "esta estação"
// because ç is not a word character. Every finding it produced was correct prose.
// A replacement that ate its neighbour leaves these. NOT a space before punctuation in general:
// French sets a space before : ; ! ? by rule, and flagging it produced 223 findings against
// correct typography.
const ORPHAN_PUNCT = /\s+[,.]|\(\s*\)|«\s*»|„\s*“/;

const screen = new Set(
  (JSON.parse(await readFile(`${dir}/en-us.json`, 'utf8'))._screenStrings) || []);

const locales = (await readdir(dir))
  .filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f) && f !== 'en-us.json')
  .map((f) => f.replace('.json', ''))
  .filter((l) => !only.length || only.includes(l));

let total = 0;
const report = {};

for (const locale of locales) {
  const strings = JSON.parse(await readFile(`${dir}/${locale}.json`, 'utf8')).strings;
  const findings = [];
  for (const [en, tr] of Object.entries(strings)) {
    // Reproduced product labels are the product's own words, typos included: IntelliDash ships
    // "Promedio de  CVA" with a double space, and matching it is correct behaviour here.
    if (screen.has(en)) continue;
    const where = en.slice(0, 44);
    if (locale === 'ko-ko') {
      for (const m of koreanParticles(tr)) findings.push({ rule: 'ko-particle', where, detail: m });
    }
    if (locale === 'fr-fr') {
      for (const m of tr.match(FR_ELISION) || []) {
        findings.push({ rule: 'fr-elision', where, detail: `"${m}" precedes a consonant` });
      }
    }
    if (DOUBLE_SPACE.test(tr)) findings.push({ rule: 'double-space', where, detail: tr.match(/\S {2,}\S/)[0] });
    const orp = tr.match(ORPHAN_PUNCT);
    if (orp) findings.push({ rule: 'orphan-punctuation', where, detail: JSON.stringify(orp[0]) });
  }
  report[locale] = findings;
  total += findings.length;
}

for (const [locale, findings] of Object.entries(report)) {
  if (!findings.length) continue;
  console.log(`\n${locale}  ${findings.length} finding(s)`);
  const byRule = {};
  for (const f of findings) (byRule[f.rule] ||= []).push(f);
  for (const [rule, list] of Object.entries(byRule)) {
    console.log(`  ${rule}  (${list.length})`);
    for (const f of list.slice(0, 8)) console.log(`    ${f.detail}\n        in: ${f.where}`);
    if (list.length > 8) console.log(`    … ${list.length - 8} more`);
  }
}

console.log(`\nPROSE LINT: ${total === 0 ? 'PASS' : `${total} finding(s)`}`);
process.exit(total === 0 ? 0 : 1);
