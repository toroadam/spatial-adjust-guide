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
//
// WHAT IS HERE. Each fold-in is a callout (tipLabel + tip) added to a step that has none, anchored
// on that step's title. A callout needs no figure of its own, and every one below was checked
// against the figure of the step it sits on, so the reproduction does not contradict it. Changes
// that need a figure the reproduction cannot draw are not here: they are new-guide candidates,
// listed in README.md › Known gaps. docs/claims/changed-surfaces.md gives every row's final
// disposition and the production citation behind each sentence below. Production is
// origin/Deployments/release/261014_phase_3a at 1aa4f28622cc3cc9637f0d61a438bf16bcf01924.
//
// WHY THESE STEPS. operational-contract.mjs (feature 5) gives minimum-threshold step 5 its own
// push-window callout and fails if that step ends up with two, so the Settings callout for
// minimum-threshold sits on step 4, the last step inside the dialog. A step holds one callout,
// and addTip() below fails the build if its step already has one, rather than let either
// callout overwrite the other.
import { edit } from './edit.mjs';

// ---- the callouts -------------------------------------------------------------------------------
//
// A callout used in several guides is written once, so the catalogues hold one entry for it and
// the ten locales translate it once.

/** US-21207. One Save Changes for the whole dialog, and the Discard changes confirmation.
 *  sa-settings-dlg.component.ts:186-215 (save), :482-503 (one request per changed group: site
 *  settings, user preferences, Target Profiles), :217-229 (Cancel checks for edits),
 *  :235-242 (the two answers); sa-settings-dlg.component.html:261-270 (the confirmation, keys
 *  SETTINGS_CONFIRM_DISCARD_CHANGES_PRIMARY, CONTINUE_EDITING, DISCARD_CHANGES). */
export const SAVE_AND_CANCEL = {
  label: 'One save for every tab.',
  text: 'Save Changes saves the edits on every tab of Settings together. With unsaved edits, '
    + 'Cancel asks whether you want to exit without saving: Continue Editing takes you back, and '
    + 'Discard Changes closes the dialog and drops every edit.',
};

/** PERS-348 localisation. The ten non-English catalogues carry 50 to 54 of the 126
 *  SPATIAL_ADJUST keys, and a missing key falls back to English (app-initializer.service.ts:38).
 *  The rail's tab names are English literals with no catalogue key (sa-settings-dlg.component.ts:52-57,
 *  painted untranslated at sa-settings-dlg.component.html:27-28). No non-English catalogue has
 *  DISCARD_CHANGES, CONTINUE_EDITING or SETTINGS_CONFIRM_DISCARD_CHANGES_PRIMARY, nor
 *  REQUESTED_SCAN_DATA_READY, RELOAD_DATA or DISMISS (the scan-data banner). */
export const PARTLY_TRANSLATED = {
  label: 'Partly translated.',
  text: 'Anything Spatial Adjust has no translation for stays in English, and every language other '
    + 'than English has gaps. The tab names in the settings rail, the Discard changes confirmation '
    + 'and the scan-data banner are in English whatever you choose.',
};

/** PERS-348 Crop Coefficient up to 200%. The 0 to 200 range is already in the step. The field is
 *  disabled under Option 1, like the two amounts (sa-settings-dlg.component.html:83-85, :98-100,
 *  :113-115). The step's figure is drawn under Option 2, so it does not contradict this. */
export const CROP_UNDER_OPTION_1 = {
  label: 'Greyed out under Option 1.',
  text: 'Option 1 uses no ET, so the dialog disables Crop Coefficient while it is selected, along '
    + 'with Daily Max Amount and Lynx Reference Amount.',
};

/** PERS-348 Enabled Stations filter. The choice is saved to the user's preferences
 *  (sa-map-overlay.component.ts:50-52). With nothing saved the map uses the environment default
 *  (sa-dashboard.component.ts:504), which is Enabled Stations in production
 *  (environment.toro-prod.ts:88). The step's figure shows Enabled Stations chosen, the production
 *  default (src/transform-app.mjs, 'map layers: Enabled Stations is the default selection'), so it
 *  agrees with this. */
export const LAYERS_REMEMBERED = {
  label: 'Remembered.',
  text: 'Layers saves your choice to your user preferences. Until you have made one, the map shows '
    + 'Enabled Stations only, so it can draw fewer pins than the All Stations tab counts.',
};

// ---- the steps that receive them ----------------------------------------------------------------
//
// `title` is the step title as it appears in the export's source, escapes included.
// `rows` names the docs/claims/changed-surfaces.md rows the callout settles.

export const TIPS = [
  {
    name: 'changed-surfaces: calculation-settings step 5, one save for every tab',
    guide: 'calculation-settings', title: 'Saving recalculates the whole course', ...SAVE_AND_CANCEL,
    rows: ['Settings dialog with a left rail of tabs', 'Discard Changes confirmation'],
  },
  {
    name: 'changed-surfaces: calculation-methods step 5, one save for every tab',
    guide: 'calculation-methods', title: 'Switching is a course-wide change', ...SAVE_AND_CANCEL,
    rows: ['Settings dialog with a left rail of tabs', 'Discard Changes confirmation'],
  },
  {
    name: 'changed-surfaces: minimum-threshold step 4, one save for every tab',
    guide: 'minimum-threshold', title: 'Decide what happens below the line', ...SAVE_AND_CANCEL,
    rows: ['Minimum Threshold rebuilt on the Settings dialog', 'Discard Changes confirmation'],
  },
  {
    name: 'changed-surfaces: preferences step 1, one save for every tab',
    guide: 'preferences', title: 'Open the Preferences tab', ...SAVE_AND_CANCEL,
    rows: ['SA User Preferences moved into Settings › Preferences', 'Discard Changes confirmation'],
  },
  {
    name: 'changed-surfaces: preferences step 3, partly translated',
    guide: 'preferences', title: 'Language applies immediately', ...PARTLY_TRANSLATED,
    rows: ['Localisation'],
  },
  {
    name: 'changed-surfaces: calculation-settings step 4, Crop Coefficient under Option 1',
    guide: 'calculation-settings', title: 'Crop Coefficient scales today\\u2019s ET', ...CROP_UNDER_OPTION_1,
    rows: ['Crop Coefficient up to 200%'],
  },
  {
    name: 'changed-surfaces: map-navigation step 4, Layers remembered',
    guide: 'map-navigation', title: 'Filter with Layers', ...LAYERS_REMEMBERED,
    rows: ['Enabled Stations map filter'],
  },
];

// ---- helpers ------------------------------------------------------------------------------------

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A JS single-quoted string literal, as the export writes them. */
const literal = (t) => `'${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Index just past the brace that closes the one at `open`, skipping quoted strings. */
function closeBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  throw new Error('changed-surfaces: unterminated step object');
}

/** The guide key whose block holds offset `at`: the nearest `'<key>': {` line above it. */
function guideAt(src, at) {
  const keys = [...src.slice(0, at).matchAll(/^ {2}'([a-z0-9-]+)': \{$/gm)];
  return keys.length ? keys[keys.length - 1][1] : null;
}

/**
 * Give the step titled `title` in `guide` a callout. The anchor is the step's opening
 * `{ title: '…',` and nothing else, so a correction to the step's body, caption or figure does
 * not move it. Fails if the title is not unique, if it is in another guide, or if the step
 * already has a callout.
 */
function addTip(src, { name, guide, title, label, text }) {
  const opening = `{ title: '${title}',`;
  const at = src.indexOf(opening);
  if (at >= 0) {
    const owner = guideAt(src, at);
    if (owner !== guide) {
      throw new Error(`Transform "${name}": the step "${title}" is in ${owner}, not ${guide}.`);
    }
    const step = src.slice(at, closeBrace(src, at));
    if (/\btip(Label)?:\s*['"`]/.test(step)) {
      throw new Error(
        `Transform "${name}": the step "${title}" already has a callout. Another module has given\n` +
        `  it one. Combine the two into one callout rather than letting one overwrite the other.`,
      );
    }
  }
  return edit(src, {
    name,
    pattern: new RegExp(`(\\{ title: ${escapeRe(`'${title}'`)},)`),
    replace: (_, open) => `${open} tipLabel: ${literal(label)}, tip: ${literal(text)},`,
  });
}

// ---- the edits ----------------------------------------------------------------------------------

export function apply(s) {
  for (const tip of TIPS) s = addTip(s, tip);
  return s;
}
