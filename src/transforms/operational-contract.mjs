// The push window and the Lynx prerequisites, added to every guide that ends in a push.
//
// Owner: feature 5 (add the push window and the Lynx prerequisites to every guide that ends in a
// push). No other feature edits this file. See the module map in docs/claims/README.md.
//
// Runs third, after corrections and changed-surfaces. Additions here anchor on step titles and
// existing before[] and verify[] items, never on body sentences, so they compose with the two
// modules before it.
//
// Every edit() is anchored on the exact text it replaces and asserts how many times that text
// occurs. A Core Design re-export that moves the anchor then fails the build rather than silently
// dropping the change. The guide catalogues are keyed on exact English, so any new or changed
// sentence needs translating into all ten locales.
import { edit } from './edit.mjs';

export function apply(s) {
  return s;
}
