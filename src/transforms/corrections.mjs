// Corrections for guide claims that the claims ledger marks Wrong.
//
// Owner: feature 8 (correct every Wrong claim, align the reproduction, label Target Profiles
// honestly). No other feature edits this file. See the module map in docs/claims/README.md.
//
// Runs first of the four modules called from transformGuide(). Corrections replace whole
// sentences, and the additive modules that run after this one anchor only on step titles and
// existing list items, so they still find their anchors once a body sentence has been rewritten.
//
// Every edit() is anchored on the exact text it replaces and asserts how many times that text
// occurs. A Core Design re-export that moves the sentence then fails the build rather than
// silently dropping the correction. The guide catalogues are keyed on exact English, so changing
// any sentence orphans that string's translation in all ten locales.
import { edit } from './edit.mjs';

export function apply(s) {
  return s;
}
