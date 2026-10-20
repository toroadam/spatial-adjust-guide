// Which reproduced screen labels a string of prose names, and whether a translation names them
// with the label's own words. scripts/validate-locales.mjs gates on this (screenLabelDrift) and
// scripts/retranslate-drift.mjs builds its re-translation queue from it, so both import it from
// here: the queue must hold exactly the strings the gate fails, no more and no fewer.

// Shorter labels are ignored: too short to quote unambiguously. "Save", "Over" and "Area" are
// ordinary words as well as labels, and prose using the word is not necessarily naming the control.
export const MIN_SCREEN_LABEL = 8;

// Spaces adjacent to CJK characters are dropped before comparing. Chinese, Japanese and Thai do
// not use the space as a word separator, so "平均 VWC" and "平均VWC" are the same label to a
// reader, and the product ships one form while the prose uses the other. Treating them as
// different reported seven Chinese findings that no reader could perceive.
const stripCjkSpaces = (s) => s.replace(/(?<=[　-鿿＀-￯฀-๿])\s+|\s+(?=[　-鿿＀-￯฀-๿])/g, '');

/**
 * Whether `needle` appears in `haystack`, allowing for case and whitespace. Both differences are
 * things the reader's eye passes over and correct prose legitimately introduces: Dutch lowercases
 * and inflects an adjective mid-sentence ("de voorgestelde percentages" for a label reading
 * "Voorgesteld"), and IntelliDash's own es-es AVG_VWC ships a double space ("Promedio de  CVA")
 * that prose can only match by reproducing the typo. Demanding a verbatim match reported 49
 * findings whose "fix" would have been to write worse prose.
 */
export const present = (haystack, needle) => {
  const flat = (s) => stripCjkSpaces(String(s).toLowerCase().replace(/[\s ]+/g, ' '));
  return flat(haystack).includes(flat(needle));
};

/**
 * The reproduced labels the English string `en` names, for which the locale has a shipped
 * product rendering to be faithful to.
 *   - The label is in `screen` (en-us.json _screenStrings) and at least MIN_SCREEN_LABEL long.
 *   - The label is in `glossary` (IntelliDash's catalogue for this locale). A label absent from it,
 *     such as "Calculation" or "Soil Factor Editor", exists only in the reproduction, so its
 *     "translation" is one this pipeline invented, and prose cannot be wrong against it.
 *   - The label is not in `hardcoded`: the product paints those in English in every locale.
 *   - Longest match wins. "Suggested" is a substring of "Suggested Percent Adjust Calculation", so
 *     prose naming the FIELD would also be required to name the COLUMN, two different controls
 *     that merely share a word.
 */
export function namedScreenLabels(en, { screen, glossary = {}, hardcoded = new Set() }) {
  const all = [...screen].filter((label) => label.length >= MIN_SCREEN_LABEL
    && en.includes(label) && (label in glossary) && !hardcoded.has(label));
  return all.filter((label) => !all.some((other) => other !== label && other.includes(label)));
}

/**
 * The labels `en` names that the translation `tr` does not name with the locale's own words,
 * `t[label]`. `screen` is a Set; a string that is itself a screen label is the label, not prose
 * about it, and names nothing.
 */
export function driftedScreenLabels(en, tr, { t, ...ctx }) {
  if (ctx.screen.has(en)) return [];
  return namedScreenLabels(en, ctx).filter((label) => !present(tr, t[label]));
}
