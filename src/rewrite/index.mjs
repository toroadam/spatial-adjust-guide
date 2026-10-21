// The followability rewrite registry, applied by transformGuide() in src/transform-export.mjs as
// its last step before src/transforms/beta-content.mjs and the release gate, after every
// accessibility, routing and factual-correction transform.
//
// Each entry is a function (src, h) => src. `h` carries the anchored helpers, all of which fail
// the build naming the transform when their anchor does not match exactly once:
//
//   h.edit(src, { name, pattern, replace, expected })            any exact-text replacement
//   h.editStep(src, { name, guide, title, expect, set, drop })   one step of one guide
//   h.editGuide(src, { name, guide, expect, set, drop })         a guide's own fields (start, ...)
//   h.editTargets(src, { name, guide, expect, replace })         a guide's TARGETS entry
//
// There is one module per catalogue category (calculations.mjs, ...), so the features that
// rewrite different categories never edit the same file. A module exports a single function
// that applies its rewrites in order; register it here.
//
// The step data contract is shared by the whole rewrite and must not be renamed:
//   do      one imperative sentence; every on-screen control written as [[Exact Label]]
//   see     one sentence: what the reader should see when it worked
//   ifNot   the likely cause and the way back
//   why     optional: one sentence of concept
//   region  optional: true when Do names a screen region rather than a labelled control
//   start   guide-level { page, open, needs }, shown first under Before you start
// A rewritten step drops `body`. A step without `do` still renders its body unchanged.
//
// Every rewritten sentence is a new catalogue key in ten locales. The harvest, seed, translate and
// assemble sequence in README > Localisation status > How translation is applied has to follow
// any change here.

import { apply as gettingStarted } from './getting-started.mjs';
import { apply as calculations } from './calculations.mjs';
import { apply as targets } from './targets.mjs';
import { apply as stationManagement } from './station-management.mjs';
import { apply as reviewApply } from './review-apply.mjs';
import { apply as troubleshooting } from './troubleshooting.mjs';

export const REWRITES = [
  gettingStarted,
  calculations,
  targets,
  stationManagement,
  reviewApply,
  troubleshooting,
];
