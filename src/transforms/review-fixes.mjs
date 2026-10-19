// Fixes that come out of the expert review.
//
// Owner: feature 10 (triage expert feedback, record sign-off and make the accuracy checks
// blocking). No other feature edits this file. See the module map in docs/claims/README.md.
//
// Runs last of the four modules, so a review fix may anchor on text that any of the earlier
// modules (corrections, changed-surfaces, operational-contract) produced.
//
// Every edit() is anchored on the exact text it replaces and asserts how many times that text
// occurs. A Core Design re-export that moves the anchor then fails the build rather than silently
// dropping the fix. The guide catalogues are keyed on exact English, so any changed sentence
// orphans that string's translation in all ten locales.
import { edit } from './edit.mjs';

export function apply(s) {
  return s;
}
