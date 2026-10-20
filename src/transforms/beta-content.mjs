// Beta content: steps and guides written against develop and the beta environment.
//
// Owner: the beta release epic (see the module map in docs/claims/README.md). No other feature
// edits this file.
//
// What belongs here. Behaviour that exists on develop and the beta environment but not yet in
// production (docs/claims/beta-surfaces.md lists it). A whole new guide is added as a GUIDES entry,
// a TARGETS row and a CATEGORIES tile; a beta step in a GA guide is added next to its neighbours.
// Every addition must also be recorded in src/release.json, as a beta guide or as a beta section of
// a GA guide, so the release gate can remove it from a build with SA_SHOW_BETA=false.
//
// Runs after corrections, changed-surfaces, operational-contract and review-fixes, so it may anchor
// on text any of them produced, and before release-gate, which must see every beta step this module
// adds.
//
// Every edit() is anchored on the exact text it extends and asserts how many times that text
// occurs. A Core Design re-export that moves the anchor then fails the build rather than silently
// dropping the content. The guide catalogues are keyed on exact English, so every new sentence
// needs its translations in all ten locales before it ships.
import { edit } from './edit.mjs';

export function apply(s) {
  return s;
}
