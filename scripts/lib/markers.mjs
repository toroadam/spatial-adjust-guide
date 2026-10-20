// The [[Exact Label]] marker, as the translation tooling sees it.
//
// A rewritten step names each on-screen control as [[Exact Label]] (docs/writing-guide.md > Label
// markers). The renderer draws the label bold, and in every other locale the text inside the
// brackets has to be the label the reader's own screen shows. This module is the one place that
// decides what that label is, so scripts/translate.mjs (which asks for it) and
// scripts/validate-locales.mjs (which gates on it) cannot disagree.
//
// The expected inner text of [[X]] in a locale, in this order:
//   1. X itself, when IntelliDash hardcodes X in English. The Settings dialog builds its left rail
//      from string literals (sa-settings-dlg.component.ts, the SaDlgMenuItem list) and paints them
//      without the translate pipe, so Calculation, Minimum Threshold, Target Profiles and
//      Preferences, and their one-line descriptions, are English in every locale of the product.
//   2. The locale catalogue's translation of X, when X is a reproduced screen label
//      (en-us.json _screenStrings). That is the label the figure beside the step shows, and for
//      the labels IntelliDash ships translated it is the product's own rendering
//      (scripts/app-strings.mjs takes those from IntelliDash's catalogues).
//   3. IntelliDash's shipped translation of X from src/i18n/glossary.json.
//   Otherwise nothing is expected beyond keeping the marker: the label is not one the product
//   or the reproduction renders, so there is no screen to be faithful to.
//
// The hardcoded list comes from the committed fixture src/i18n/product-labels.json
// (surfaces.settings.menu), because CI has no IntelliDash checkout and must reach the same verdict
// as a laptop that has one. A local checkout is read as an addition, never as a replacement.
import { readFileSync } from 'node:fs';

/** One marker: [[ then at least one character that is not a bracket, then ]]. */
export const MARKER = /\[\[([^[\]]+)\]\]/g;

/** The inner texts of every marker in `s`, in order. */
export function markersOf(s) {
  return [...String(s || '').matchAll(MARKER)].map((m) => m[1]);
}

const DIALOG = '/Users/adammunir/IntelliDash/site/src/app/spatial-adjust/components/sa-settings-dlg/sa-settings-dlg.component.ts';

/** Labels IntelliDash renders from hardcoded English literals. `root` is the repository root. */
export function hardcodedLabels(root = '.') {
  const out = new Set();
  const fixture = JSON.parse(readFileSync(`${root}/src/i18n/product-labels.json`, 'utf8'));
  const menu = fixture?.surfaces?.settings?.menu;
  if (!Array.isArray(menu) || !menu.length) {
    throw new Error('src/i18n/product-labels.json has no surfaces.settings.menu; the hardcoded-label list would be empty');
  }
  for (const item of menu) {
    if (item.title) out.add(item.title);
    if (item.description) out.add(item.description);
  }
  try {
    const dlg = readFileSync(DIALOG, 'utf8');
    for (const m of dlg.matchAll(/new SaDlgMenuItem\('([^']+)',\s*'([^']+)'/g)) {
      out.add(m[1]);
      out.add(m[2]);
    }
  } catch { /* no checkout: the fixture alone */ }
  return out;
}

/** What [[label]] must read in `locale`, or undefined when only the marker itself is required.
 *  `t` is the locale's catalogue strings, `screen` the set of reproduced screen labels,
 *  `glossary` the locale's slice of src/i18n/glossary.json, `hardcoded` from hardcodedLabels(). */
export function expectedLabel(label, { t, screen, glossary, hardcoded }) {
  if (hardcoded.has(label)) return label;
  if (screen.has(label) && typeof t?.[label] === 'string' && t[label].trim()) return t[label];
  if (typeof glossary?.[label] === 'string' && glossary[label].trim()) return glossary[label];
  return undefined;
}

/** Problems with the markers of `tr`, the translation of `en`. Empty when they are right.
 *  The order of markers may change, because word order does; their number and labels may not. */
export function markerProblems(en, tr, ctx) {
  const want = markersOf(en);
  const opens = (s) => String(s).split('[[').length - 1;
  const closes = (s) => String(s).split(']]').length - 1;
  if (!want.length && !opens(tr) && !closes(tr)) return [];
  const got = markersOf(tr);
  const problems = [];
  if (opens(tr) !== closes(tr) || opens(tr) !== got.length) problems.push('malformed [[ ]] in the translation');
  if (got.length !== want.length) problems.push(`${want.length} marker(s) in English, ${got.length} in the translation`);
  const pool = [...got];
  for (const label of want) {
    const exp = expectedLabel(label, ctx);
    if (exp === undefined) continue;
    const i = pool.indexOf(exp);
    if (i === -1) problems.push(`expected [[${exp}]] for [[${label}]]`);
    else pool.splice(i, 1);
  }
  return problems;
}
