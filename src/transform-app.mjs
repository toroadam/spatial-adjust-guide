// Transforms applied to the SpatialAdjustApp reproduction at build time.
//
// The reproduction shipped without two controls the real product has: the Over/Under filter's
// configuration dialog, and the banner that appears when requested scan data arrives. Their absence
// was not cosmetic — it is why four real features had no guides. A guide drives a figure into this
// component, and a figure pointing at a panel that does not exist is worse than no guide.
//
// Same contract as src/transform-export.mjs: every edit asserts its anchor, so a re-export that
// changes shape fails the build loudly rather than silently dropping the controls again.

function edit(src, { name, pattern, replace, expected = 1 }) {
  const counter = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const found = [...src.matchAll(counter)].length;
  if (found !== expected) {
    throw new Error(
      `App transform "${name}" expected ${expected} match(es) but found ${found}.\n` +
      `  The SpatialAdjustApp export's structure has changed. Update the anchor in\n` +
      `  src/transform-app.mjs — do not skip the transform.`,
    );
  }
  return src.replace(pattern, replace);
}

// The prop schema lives in an HTML-escaped JSON attribute, so additions have to be escaped to match.
const Q = '&quot;';

export function transformApp(src) {
  let s = src;

  // --- new prop values ---------------------------------------------------------
  // 'filter' is the Over/Under Options dialog (sa-cfg-threshold-dlg); 'dataready' is the banner
  // raised when a requested scan arrives. Both ride this enum because it is already bound.
  s = edit(s, {
    name: 'dialog enum gains filter',
    pattern: new RegExp(`(${Q}dialog${Q}:\\{${Q}editor${Q}:${Q}enum${Q},${Q}options${Q}:\\[[^\\]]*?)(\\])`),
    replace: `$1,${Q}filter${Q},${Q}dataready${Q}$2`,
  });

  // --- the two new renderers ---------------------------------------------------
  s = edit(s, {
    name: 'filterDialog and scanReadyBanner methods',
    pattern: /\n  renderVals\(\) \{/,
    replace: `
  // Over/Under Options — sa-cfg-threshold-dlg. Bounds and defaults are the product's:
  // Over 0-300 default 200, Under 0-100 default 10, and Exclude Zeros disabled unless Under is on,
  // because a zero is below any under-threshold and the option is meaningless without it.
  filterDialog() {
    const row = (label, checked, value, dim) => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', opacity: dim ? 0.45 : 1 },
    },
      h('span', { style: {
        width: '16px', height: '16px', borderRadius: '3px', flex: '0 0 auto',
        border: '1px solid ' + (checked ? '#3079F0' : '#B4BCC0'),
        background: checked ? '#3079F0' : '#fff',
        color: '#fff', fontSize: '11px', lineHeight: '14px', textAlign: 'center',
      } }, checked ? '\\u2713' : ''),
      h('span', { style: { minWidth: '52px' } }, label),
      h('span', { style: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
        width: '132px', border: '1px solid #B4BCC0', borderRadius: '4px', overflow: 'hidden',
      } },
        h('span', { style: { padding: '5px 9px', borderRight: '1px solid #B4BCC0', color: '#646E73' } }, '\\u2212'),
        h('span', { style: { flex: 1, textAlign: 'center', padding: '5px 0' } }, value + ' %'),
        h('span', { style: { padding: '5px 9px', borderLeft: '1px solid #B4BCC0', color: '#646E73' } }, '+')));

    return this.shell('Over/Under Options', '400px',
      h('div', null,
        h('div', { style: { marginBottom: '16px', color: '#646E73' } },
          'Filter % Adj. by setting an Over and/or Under threshold.'),
        row('Over', true, 200, false),
        row('Under', true, 10, false),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '2px' } },
          h('span', { style: {
            width: '16px', height: '16px', borderRadius: '3px',
            border: '1px solid #B4BCC0', background: '#fff', flex: '0 0 auto',
          } }),
          h('span', null, 'Exclude Zeros'))),
      this.darkFooter('Save Changes', 'Cancel'));
  }

  // Rendered through the existing 'dialog' prop rather than a prop of its own. A new prop is not
  // forwarded: <dc-import> only passes attributes matching the component's ORIGINAL schema, so a
  // transform-added prop arrives undefined however correctly it is declared and bound. Adding a
  // new VALUE to an existing enum prop works, because the runtime passes the string straight
  // through — which is exactly how dialog: 'filter' above works.
  //
  // The banner the product raises when a requested scan lands. Reload Data brings the data in;
  // Dismiss closes the banner and leaves the dashboard on the data it already had.
  scanReadyBanner() {
    const btn = (label, primary) => h('span', { style: {
      padding: '7px 14px', borderRadius: '4px', fontSize: '13px',
      border: '1px solid ' + (primary ? '#0F7B3E' : '#ffffff66'),
      background: primary ? '#0F7B3E' : 'transparent', color: '#fff',
    } }, label);
    return h('div', { style: {
      position: 'absolute', top: '76px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 850, display: 'flex', alignItems: 'center', gap: '14px',
      padding: '10px 16px', borderRadius: '6px', background: '#1B7F4B', color: '#fff',
      fontSize: '14px', boxShadow: '0 6px 20px rgba(0,0,0,.25)',
    } },
      h('span', { style: { fontSize: '16px' } }, '\\u2713'),
      h('span', null, 'The requested scan data is ready.'),
      btn('Reload Data', true),
      btn('Dismiss', false));
  }

  renderVals() {`,
  });

  // --- dispatch ----------------------------------------------------------------
  s = edit(s, {
    name: 'filter dialog dispatch',
    pattern: /(else if \(dlg === 'diagnostics'\) dialog = this\.diagDialog\(\);)/,
    replace: `$1\n    else if (dlg === 'filter') dialog = this.filterDialog();`
      + `\n    else if (dlg === 'dataready') dialog = this.scanReadyBanner();`,
  });

  // The reproduced Target Profiles pane carries its own footnote, and it said "Concept". Same
  // correction as transform 8 in src/transform-export.mjs, and the same reason: the tab is
  // implemented on a feature branch, not a concept. Kept short because it sits inside the
  // figure rather than in the prose around it.
  s = edit(s, {
    name: 'target profiles pane footnote',
    pattern: /Concept — this tab is not in the shipping build\./,
    replace: 'In development — not in the shipping build yet.',
  });

  // The reproduced map legend still carried the OLD band boundaries. Transform 3 in
  // src/transform-export.mjs corrected the PROSE — "Bands default to 0-5, 6-19, 20-30 and above
  // 30 percent" — after the guide quoted one course's saved preference as the product default,
  // but the figure beside that sentence went on rendering 6-16% and 17-30%. The guide contradicted
  // itself, and both figures contradicted the product: a live harvest of the real map legend
  // shows 0-5%, 6-19%, 20-30%, > 30%.
  //
  // Found by scripts/cursor-target.mjs, not by the label gate. The map legend chips are not in
  // _screenStrings, so the label diff never looked at them — the animated cursor landing on
  // "6-16%" during "Move the band boundaries" is what surfaced it. sa-dash-map falls back to
  // `value?.range2Boundary || 19` when a user has no saved preference, so 19 is the default.
  s = edit(s, {
    name: 'map legend band 2 default',
    pattern: /6-16%/,
    replace: '6-19%',
  });

  s = edit(s, {
    name: 'map legend band 3 default',
    pattern: /17-30%/,
    replace: '20-30%',
  });

  return s;
}
