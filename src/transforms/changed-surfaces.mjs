// IntelliDash changes since 2026-08-13, folded into the guides they affect.
//
// Owner: feature 6 (fold IntelliDash changes since 2026-08-13 into the guides, or log them as
// new-guide candidates). No other feature edits this file. See the module map in
// docs/claims/README.md, and docs/claims/changed-surfaces.md for what to fold in and where.
//
// Runs second, after corrections. Additions here anchor on step titles and existing list items,
// never on body sentences, so they compose with whatever the corrections module rewrote.
//
// Every edit() is anchored on the exact text it replaces and asserts how many times that text
// occurs. A Core Design re-export that moves the anchor then fails the build rather than silently
// dropping the change. The guide catalogues are keyed on exact English, so any new or changed
// sentence needs translating into all ten locales.
import { edit } from './edit.mjs';

export function apply(s) {
  return s;
}
