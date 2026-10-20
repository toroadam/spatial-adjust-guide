// Transforms applied to the SpatialAdjustApp reproduction at build time.
//
// The reproduction shipped without two controls the real product has: the Over/Under filter's
// configuration dialog, and the banner that appears when requested scan data arrives. Their absence
// was not cosmetic — it is why four real features had no guides. A guide drives a figure into this
// component, and a figure pointing at a panel that does not exist is worse than no guide.
//
// Same contract as src/transform-export.mjs: every edit asserts its anchor, so a re-export that
// changes shape fails the build loudly rather than silently dropping the controls again.
//
// IntelliDash is cited by path and line only, never quoted: this repository is public. Line
// numbers are at the production pin recorded in docs/claims/sources.json
// (1aa4f28622cc3cc9637f0d61a438bf16bcf01924), with paths under site/src/app/spatial-adjust/.
// Quotations of SpatialAdjustApp.dc.html are of this repository's own export.

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

// The replacement markup for the Target Profiles pane, kept out of the transform above so the
// anchor stays readable. `numInput` is reused for the name field: it renders a bordered box
// containing the value, which is what pInputText looks like at this scale.
const TP_COLS = "'2.1fr 1.2fr 0.8fr 1.5fr 1.1fr'";

const TARGET_PROFILES_TABLE = [
  "h('div', { style: { border: '1px solid #080D121A', borderRadius: '4px', background: '#fff', marginTop: '16px', overflow: 'hidden' } },",
  `  h('div', { style: { display: 'grid', gridTemplateColumns: ${TP_COLS}, alignItems: 'center', padding: '10px 14px', background: '#F5F7F8', borderBottom: '1px solid #080D121A', fontWeight: 'bold', color: '#080D12', fontSize: '13px' } },`,
  "    h('div', null, 'Target Profile'), h('div', null, 'Last Updated'), h('div', null, 'Stations'),",
  "    h('div', null, 'Update from Current'), h('div', null, 'Apply Profile')),",
  "  [['Spring', '--', '--'], ['Summer Baseline', '14 Jun 2026', '148'], ['Fall', '--', '--'], ['Winter', '--', '--'], ['Tournament Week', '02 May 2026', '148']].map(p =>",
  `    h('div', { key: p[0], style: { display: 'grid', gridTemplateColumns: ${TP_COLS}, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #080D121A' } },`,
  "      h('div', null, this.numInput(p[0], '170px')),",
  "      h('div', { style: { fontSize: '13px', color: '#080D12' } }, p[1]),",
  "      h('div', { style: { fontSize: '13px', color: '#080D12' } }, p[2]),",
  "      h('div', null, h('div', { style: { width: '22px', height: '22px', borderRadius: '3px', border: '1px solid #a6a6a6', background: '#fff' } })),",
  "      h('div', null, h('div', { style: { width: '22px', height: '22px', borderRadius: '3px', border: '1px solid #a6a6a6', background: '#fff', opacity: p[2] === '--' ? 0.45 : 1 } })))))",
].join('\n        ');

// Drawn aerial for the map figure. See the transform that installs it for why this is drawn
// rather than captured.
const MAP_AERIAL = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true" focusable="false"><defs><filter id="sa-turf" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="7" result="n"/><feColorMatrix in="n" type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer></filter><filter id="sa-canopy" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="4" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="sa-edge" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.25"/></filter><pattern id="sa-mow" width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="4.5" height="4.5" fill="#000" fill-opacity="0"/><rect width="2.25" height="4.5" fill="#fff" fill-opacity="0.038"/></pattern><radialGradient id="sa-vig" cx="50%" cy="46%" r="72%"><stop offset="62%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.34"/></radialGradient><clipPath id="sa-turfclip"><path d="M8 26 C14 14 30 9 44 12 C56 14 62 20 60 27 C58 35 44 38 30 37 C18 36 6 34 8 26Z"/><path d="M54 24 C62 17 78 18 84 26 C90 34 86 46 76 49 C64 52 54 46 52 38 C51 32 51 27 54 24Z"/><path d="M20 58 C32 51 56 50 72 55 C82 58 84 66 76 70 C62 76 34 76 22 70 C15 66 15 61 20 58Z"/><path d="M6 68 C16 62 32 64 37 72 C42 81 36 92 24 94 C12 96 3 89 3 80 C3 74 3 71 6 68Z"/><path d="M66 60 C78 56 92 62 93 72 C94 84 84 92 74 90 C64 88 60 78 61 70 C62 65 63 62 66 60Z"/></clipPath></defs><rect width="100" height="100" fill="#1F2B1C"/><g filter="url(#sa-canopy)" opacity="0.9"><path d="M0 0 H100 V13 C82 19 60 8 40 15 C24 21 10 18 0 22Z" fill="#16200F"/><path d="M0 84 C12 79 22 88 34 92 C48 97 70 94 86 97 C93 98 97 99 100 100 H0Z" fill="#16200F"/><path d="M92 20 C98 24 99 40 96 54 C94 64 99 74 100 80 V14Z" fill="#16200F"/></g><g filter="url(#sa-edge)"><path d="M8 26 C14 14 30 9 44 12 C56 14 62 20 60 27 C58 35 44 38 30 37 C18 36 6 34 8 26Z" fill="#4E6A38"/><path d="M54 24 C62 17 78 18 84 26 C90 34 86 46 76 49 C64 52 54 46 52 38 C51 32 51 27 54 24Z" fill="#52703B"/><path d="M20 58 C32 51 56 50 72 55 C82 58 84 66 76 70 C62 76 34 76 22 70 C15 66 15 61 20 58Z" fill="#4E6A38"/><path d="M6 68 C16 62 32 64 37 72 C42 81 36 92 24 94 C12 96 3 89 3 80 C3 74 3 71 6 68Z" fill="#476133"/><path d="M66 60 C78 56 92 62 93 72 C94 84 84 92 74 90 C64 88 60 78 61 70 C62 65 63 62 66 60Z" fill="#476133"/></g><g clip-path="url(#sa-turfclip)"><rect width="100" height="100" fill="url(#sa-mow)"/></g><g filter="url(#sa-edge)"><ellipse cx="31" cy="21" rx="7" ry="4.6" fill="#688747"/><ellipse cx="70" cy="33" rx="6" ry="5" fill="#688747"/><ellipse cx="47" cy="62" rx="7.5" ry="4.2" fill="#688747"/><ellipse cx="22" cy="78" rx="5.6" ry="4.6" fill="#688747"/><ellipse cx="79" cy="74" rx="5.2" ry="5" fill="#688747"/></g><g filter="url(#sa-edge)"><path d="M14 38 C17 35 22 36 23 39 C24 43 19 45 16 44 C13 43 12 40 14 38Z" fill="#C8B68E"/><path d="M71 20 C74 17 79 18 80 21 C81 24 77 26 74 25 C71 24 70 22 71 20Z" fill="#C8B68E"/><path d="M60 52 C63 50 67 51 67 54 C67 57 63 58 61 56 C59 55 58 53 60 52Z" fill="#C8B68E"/></g><path d="M55 82 C62 78 72 79 74 84 C76 90 68 94 60 92 C53 90 50 85 55 82Z" fill="#33566E" filter="url(#sa-edge)"/><path d="M55 82 C62 78 72 79 74 84" fill="none" stroke="#7FA8B8" stroke-opacity="0.35" stroke-width="0.5"/><path d="M2 14 C18 24 30 30 44 34 C58 38 62 48 58 58 C54 68 40 74 30 84 C24 90 20 96 18 100" fill="none" stroke="#D8D2C4" stroke-opacity="0.22" stroke-width="0.7"/><rect width="100" height="100" filter="url(#sa-turf)" opacity="0.3" style="mix-blend-mode:overlay"/><rect width="100" height="100" fill="url(#sa-vig)"/></svg>';

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

  // The reproduced Target Profiles pane carried a footnote of its own, "Concept — this tab is not
  // in the shipping build." An earlier pass reworded it to "In development — not in the shipping
  // build yet", and the claims audit found that wrong too: at the production pin the settings
  // dialog lists Target Profiles unconditionally (sa-settings-dlg.component.ts:55). The product's
  // pane has no footnote at all (sa-settings-dlg.component.html:177-226), so the figure loses it
  // rather than gaining a different one. What the reader needs to know about the release lives in
  // the guide's banner, outside the figure. docs/text-corrections.md section 30.
  s = edit(s, {
    name: 'target profiles pane footnote removed',
    pattern: /,\n\s*h\('div', \{ style: \{ marginTop: '12px', fontSize: '12px', color: '#A2ADB2' \} \}, 'Concept — this tab is not in the shipping build\.'\)/,
    replace: '',
  });

  // The Target Profiles pane depicted a concept, not the product.
  //
  // It drew three cards, each with a bold name, an "Applied 14 Jun 2026 · 148 stations" subtitle
  // and an ACTIVE or APPLY badge. None of that exists. The shipped pane is a table of five fixed
  // slots per Lynx course (sa-settings-dlg.component.ts:103-109, :383-392) with the columns
  // Target Profile, Last Updated, Stations, Update from Current and Apply Profile
  // (sa-settings-dlg.component.html:195-199). The name is an editable text input, and the last two
  // columns are separate icon actions, one writing current targets into the slot and one applying
  // the slot to the stations; the card design collapsed them into one badge. An empty slot shows
  // "--" for Last Updated and Stations, and its Apply action is disabled (:205-214).
  //
  // The five rows are the product's default slot names, Spring, Summer, Fall, Winter and
  // Tournament, with two renamed for their condition, which is what "Capturing profiles" teaches.
  // The icons carry no text on purpose: anything written here would enter the label inventory as
  // a product string the product does not have.
  //
  // The pane's intro was written for the guide, not taken from the product. The tab renders
  // SPATIAL_ADJUST.SETTINGS_TARGET_PROFILES_HEADER, whose English is the sentence below. It was
  // one of the six product labels the fidelity gate listed as never shown by the guides.
  s = edit(s, {
    name: 'target profiles pane intro matches the product header key',
    pattern: /Save a full set of station Target VWC values as a named profile, then apply it whenever the season or the event calls for it\./,
    replace: 'Save, manage, and apply target profiles for seasonal and event-based irrigation strategies.',
  });

  s = edit(s, {
    name: 'target profiles: card list becomes the real five-column table',
    pattern: /h\('div', \{ style: \{ border: '1px solid #080D121A', borderRadius: '4px', background: '#F5F7F8', marginTop: '16px', overflow: 'hidden' \} \},[\s\S]*?'ACTIVE' : 'APPLY'\)\)\)\)/,
    replace: TARGET_PROFILES_TABLE,
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
  // "6-16%" during "Move the band boundaries" is what surfaced it. The map falls back to 19 for the
  // middle boundary when a user has no saved preference (sa-dash-map.component.ts:49), so 19 is
  // the default.
  s = edit(s, {
    name: 'map legend band 2 default',
    pattern: /6-16%/,
    replace: '6-19%',
  });

  // The map read as flat shapes on a flat field: a solid #2E3D2A rectangle under eight
  // radial-gradient ellipses at 0.55 opacity. The product's map is Leaflet over Google satellite
  // imagery, so the figure was not stylised — it was a different kind of picture entirely, and the
  // first thing a reader compares against their own screen is the map.
  //
  // What it is NOT: a screenshot. The real map is a customer's course — their layout, their
  // station coordinates, their readings — and this repository is public. It is also Google's
  // imagery, which may not be redistributed, and the build asserts zero external origins so live
  // tiles are not an option either. Drawing an aerial rather than capturing one satisfies all
  // three without asking anyone's permission.
  //
  // Everything here is deterministic SVG with a fixed turbulence seed: organic turf outlines
  // instead of ellipses, fractal noise for grass mottling, mown stripes clipped to the turf,
  // tree canopy pushed to the frame edges, soft bunker and water shapes, a cart path, and a
  // vignette. No text nodes anywhere in it — a label here would enter the screen inventory as a
  // product string the product does not have.
  //
  // The fairway centres are kept where they were, so the 24 pins still sit on turf.
  s = edit(s, {
    name: 'map ground: flat gradient ellipses become a drawn aerial',
    pattern: /<div style="position:absolute;inset:0;opacity:0\.55;background:radial-gradient\([^"]*"><\/div>/,
    replace: MAP_AERIAL,
  });

  s = edit(s, {
    name: 'map base colour under the drawn aerial',
    pattern: /<div style="position:absolute;inset:0;background:#2E3D2A"><\/div>/,
    replace: '<div style="position:absolute;inset:0;background:#1F2B1C"></div>',
  });

  s = edit(s, {
    name: 'map legend band 3 default',
    pattern: /17-30%/,
    replace: '20-30%',
  });

  // The legend was corrected above; the PIN COLOURING was not, and the two then disagreed with
  // each other inside the same figure. rangeColor switched yellow to green at 16, so a station
  // reading 17, 18 or 19 painted green while the legend directly beneath it said 6-19% is yellow.
  // The product's boundary is range2Boundary, which falls back to 19 — the same 19 the legend
  // already claims.
  s = edit(s, {
    name: 'map pins: yellow/green boundary matches the legend and the product',
    pattern: /if \(v <= 16\) return '#F3D43B';/,
    replace: "if (v <= 19) return '#F3D43B';",
  });

  // Variance had no palette of its own. The figure reused the MOISTURE colours and invented the
  // boundaries, so the variance view was wrong three times over: wrong colours, wrong numbers,
  // and — worst — the pins did not change at all when the mode switched, because renderMarkers
  // always called rangeColor on the raw reading.
  //
  // That last one matters because it contradicts the step it illustrates. "Switch to variance"
  // tells the reader that variance "colours each pin by how far it sits from its own target
  // instead of by its raw reading", and then shows them a map where nothing recolours.
  //
  // The product's own values: the variance colours (site/src/app/common/enumerations/toro.enums.ts:464),
  // and the -11 and 10 boundaries the map falls back to when a user has saved none
  // (sa-dash-map.component.ts:66-67):
  //     < -11   #FDB034 orange     -10 to 10   #009EB2 teal     > 10   #D64E9A pink
  s = edit(s, {
    name: 'map: variance gets the product palette',
    pattern: /function rangeColor\(v\) \{/,
    replace: '// Variance is a reading measured against its own target, so it needs the sample data to carry\n'
      + '// a target. The reproduction uses a nominal 30% for every station: it is invented, exactly as\n'
      + '// the readings themselves are, and it spreads the sample across all three bands so the\n'
      + '// recolouring is visible rather than theoretical.\n'
      + 'const NOMINAL_TARGET = 30;\n'
      + 'function varianceColor(v) {\n'
      + "  if (v <= -11) return '#FDB034';\n"   // inclusive: the product's lowest band runs from -100 up to and including -11
      + "  if (v <= 10) return '#009EB2';\n"
      + "  return '#D64E9A';\n"
      + '}\n\n'
      + 'function rangeColor(v) {',
  });

  s = edit(s, {
    name: 'map pins: recolour when the mode switches to variance',
    pattern: /background: rangeColor\(m\[2\]\), opacity: 0\.9/,
    replace: "background: this.props.mapMode === 'variance' ? varianceColor(m[2] - NOMINAL_TARGET) : rangeColor(m[2]), opacity: 0.9",
  });

  // The number in the pin has to follow the colour. Colouring by variance while printing the raw
  // reading would leave a pin labelled 50 painted for +20, which is unreadable.
  s = edit(s, {
    name: 'map pins: label shows the variance figure in variance mode',
    pattern: /\}, m\[2\]\.toFixed\(0\)\)\);/,
    replace: "}, this.props.mapMode === 'variance'\n"
      + "      ? (m[2] - NOMINAL_TARGET > 0 ? '+' : '') + (m[2] - NOMINAL_TARGET).toFixed(0)\n"
      + '      : m[2].toFixed(0)));',
  });

  s = edit(s, {
    name: 'map legend: variance bands use the product palette and boundaries',
    pattern: /band\('< -5%', '#E11837', 'a'\), band\('-5 to 5%', '#42CE11', 'b'\), band\('> 5%', '#3079F0', 'c'\)/,
    replace: "band('< -11%', '#FDB034', 'a'), band('-10 to 10%', '#009EB2', 'b'), band('> 10%', '#D64E9A', 'c')",
  });

  s = edit(s, {
    name: 'map legend: variance gradient bar matches its bands',
    pattern: /h\('div', \{ style: \{ width: '33%', background: '#E11837' \} \}\), h\('div', \{ style: \{ width: '34%', background: '#42CE11' \} \}\), h\('div', \{ style: \{ width: '33%', background: '#3079F0' \} \}\)/,
    replace: "h('div', { style: { width: '33%', background: '#FDB034' } }), h('div', { style: { width: '34%', background: '#009EB2' } }), h('div', { style: { width: '33%', background: '#D64E9A' } })",
  });

  // The estimated-value marker was half-drawn: the reproduction dims and italicises the number
  // but never draws the icon that sits beside it, in any of the three places the table renders
  // one. The audit's acceptance criterion read "calculator icons replace the mock's grey italics"
  // and that is not what the product does — GREY ITALICS ARE CORRECT, the icon is additional. The
  // estimated class greys and italicises the reading (sa-table-card.component.less:107-110), and
  // the same cell draws the calculator icon (sa-table-card.component.html:29-31).
  //
  // Both are applied to the same cell, so nothing is being replaced and the existing styling is
  // left alone. What matters is that the icon is the only marker carried into the push dialog
  // (sa-confirm-push-dlg.component.html:81 and :117), where there is no dimming at all — so a
  // reader who has only ever seen italics has not been shown the thing they must recognise at
  // the one moment it decides whether they push an estimate to the course.
  //
  // PARENT ROWS DIFFER FROM STATION ROWS, and the reproduction had them the same. The two classes
  // are applied on different conditions (sa-table-card.component.html:29): the estimated class when
  // the row's own reading is modelled, the parent class when a child's is (a hole or area with a
  // modelled station, or a paired station with a modelled sprinkler), and the parent class styles
  // only the icon (less:112-116), never the number. An Area or Hole row is an
  // aggregate — its own reading cannot be estimated, only its children's — so it shows a normal
  // number with a grey icon, not a grey italic number. areaAgg() hardcodes est: true, so the
  // reproduction was dimming a figure the product prints plainly.
  //
  // The glyph is drawn rather than borrowed. FontAwesome is not bundled, the build asserts zero
  // external origins, and copying a Font Awesome Free path carries a CC BY attribution
  // requirement this repository has nowhere sensible to honour. It is a shape, not a likeness.
  s = edit(s, {
    name: 'estimated marker: a drawn calculator glyph',
    pattern: /(\n  aggRows\(items\) \{)/,
    replace: `
  // Marks a reading the algorithm modelled rather than measured. The product draws it orange
  // (sa-table-card.component.less:97-104, :121-128). \`dim\` is the sa-parent case, a row whose
  // estimate is in a child rather than its own reading: the icon greys (:112-116).
  calcIcon(dim) {
    return h('svg', { viewBox: '0 0 12 16', width: '9', height: '12', 'aria-hidden': 'true', focusable: 'false',
      style: { flex: 'none', color: dim ? 'darkgray' : 'orange' } },
      h('rect', { x: 0.6, y: 0.6, width: 10.8, height: 14.8, rx: 1.6, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
      h('rect', { x: 2.6, y: 2.6, width: 6.8, height: 3, rx: 0.6, fill: 'currentColor' }),
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => h('circle', { key: i, cx: 3 + (i % 3) * 3, cy: 8.4 + Math.floor(i / 3) * 2.6, r: 0.85, fill: 'currentColor' })));
  }
$1`,
  });

  // Area and Hole rows: aggregates, so the number is printed plainly and only the icon greys.
  s = edit(s, {
    name: 'estimated marker: aggregate rows get the icon, not the italics',
    pattern: /gap: '4px', color: it\.est \? 'darkgray' : 'inherit' \} \},\n(\s*)h\('span', \{ style: \{ fontStyle: it\.est \? 'italic' : 'normal' \} \}, it\.vwc\.toFixed\(1\) \+ '%'\)\)/,
    replace: (_m, i) =>
      `gap: '4px' } },\n${i}it.est ? this.calcIcon(true) : null, h('span', null, it.vwc.toFixed(1) + '%'))`,
  });

  // Sprinkler rows: the product prints a modelled sprinkler reading in the normal style and marks
  // it only with an orange icon (sa-table-card.component.html:86-92; the child cell has no
  // estimated class, less:121-130). The reproduction greyed and italicised it, which is the
  // station-row style; docs/text-corrections.md section 25.
  s = edit(s, {
    name: 'estimated marker: sprinkler rows',
    pattern: /color: k\[2\] \? 'darkgray' : 'inherit', fontStyle: k\[2\] \? 'italic' : 'normal' \} \},\n\s*k\[0\]\.toFixed\(1\) \+ '%'\)/,
    replace: "color: 'inherit', fontStyle: 'normal' } }, k[2] ? this.calcIcon(false) : null, k[0].toFixed(1) + '%')",
  });

  // Station rows. A station whose own newest scan is not from today is greyed and italicised and
  // carries the orange icon (html:29-31, less:97-110). A paired station whose newest scan IS from
  // today but one of whose sprinklers is modelled keeps a plain number and gets the grey icon,
  // because the product sets sa-parent on someStationPairIsEstimated
  // (sa-table-card.component.ts:398-400). 6AP1 is that case: its second sprinkler is two days old.
  s = edit(s, {
    name: 'estimated marker: station rows',
    pattern: /alignItems: 'center', color: s\.est \? 'darkgray' : 'inherit', fontStyle: s\.est \? 'italic' : 'normal' \} \}, s\.vwc\.toFixed\(1\) \+ '%'\)/,
    replace: "alignItems: 'center', gap: '4px', color: s.est ? 'darkgray' : 'inherit', fontStyle: s.est ? 'italic' : 'normal' } }, "
      + "(s.est || (s.kids && s.kids.some(k => k[2]))) ? this.calcIcon(!!(s.kids && s.kids.some(k => k[2]))) : null, s.vwc.toFixed(1) + '%')",
  });

  // A hole is marked when any sprinkler record beneath it is modelled, not only a single-sprinkler
  // station: the hole's hasEstimatedChildren tests every station record, and a paired station is
  // two records (spatial-adjust-course.model.ts:102). Hole 6 holds 6AP1, so it gains the icon.
  s = edit(s, {
    name: 'estimated marker: a hole counts a modelled sprinkler',
    pattern: /if \(s\.est\) g\.est = true;/,
    replace: 'if (s.est || (s.kids && s.kids.some(k => k[2]))) g.est = true;',
  });

  // The push icon was drawn on every station row. The product draws it only on an enabled station,
  // and also hides it when the show-current-only flag is on and the station's scan is neither
  // current nor modelled (sa-table-card.component.html:51).
  //
  // The reproduction's `on` is that enabled state — it is what the row's toggle renders — and
  // 5AP1 ships disabled, so exactly one row was claiming a disabled station had something
  // waiting to go to Lynx. That is the row "Enable and disable stations" exists to talk about.
  //
  // Only the enabled clause is reproduced. The third clause turns on the show-current-only flag and
  // swaps the whole adjust input for a "--" placeholder. The flag is on in production
  // (environments/environment.toro-prod.ts:87, under site/src/), but the branch needs a station
  // whose scan is neither current nor modelled, which only Option 1 produces; every figure here
  // uses Option 2, where the one stale station, 7AP1, is modelled. docs/text-corrections.md §10, §30.
  s = edit(s, {
    name: 'push icon follows the station enabled state',
    pattern: /h\('img', \{ src: 'assets\/sa\/' \+ \(s\.pushed \? 'pushed_ico\.png' : 'push_ico\.png'\), alt: '', style: \{ position: 'absolute', right: '20px', top: '9px', height: '15px', zIndex: 1 \} \}\)/,
    replace: "s.on ? h('img', { src: 'assets/sa/' + (s.pushed ? 'pushed_ico.png' : 'push_ico.png'), alt: '', style: { position: 'absolute', right: '20px', top: '9px', height: '15px', zIndex: 1 } }) : null",
  });

  // Every row in Push Changes was drawn ticked, including the six under "6 Pushed Today" — and
  // the dialog carries a banner, three lines above the table, that says they are not:
  //
  //   SpatialAdjustApp.dc.html:486
  //     'Stations pushed today appear unselected in a separate list to prevent double
  //      adjustments. To adjust one again, simply select it.'
  //
  // So the figure contradicted a sentence printed inside the same figure. The product is on the
  // banner's side: the dialog unticks every Pushed Today row when it opens
  // (sa-confirm-push-dlg.component.ts:24), and draws a tick only on a selected row
  // (sa-confirm-push-dlg.component.html:95, :132), so the Pushed Today rows render empty.
  // This is not cosmetic: the guard against adjusting the same head twice in a day is the
  // whole reason that section is split out, and a reader who has been shown twelve ticked rows
  // has been taught that pushing again sends all twelve. "Re-push only the failures" in
  // push-failures tells them to "untick anything that already went out", which reads as
  // busywork beside a figure where everything is ticked and as the point beside a correct one.
  //
  // row() gains the state as a parameter rather than deriving it, because the two sections are
  // rendered by the same function and only the call site knows which list it is walking.
  s = edit(s, {
    name: 'push dialog: Pushed Today rows are not preselected',
    pattern: /const row = \(r, key\) => h\('tr', \{ key \},/,
    replace: "const row = (r, key, checked) => h('tr', { key },",
  });

  s = edit(s, {
    name: 'push dialog: row tick follows its section',
    pattern: /this\.checkbox\(true\)\)\)\);/,
    replace: 'this.checkbox(checked))));',
  });

  s = edit(s, {
    name: 'push dialog: available-to-push rows stay ticked',
    pattern: /newRows\.map\(\(r, i\) => row\(r, 'n' \+ i\)\)/,
    replace: "newRows.map((r, i) => row(r, 'n' + i, true))",
  });

  s = edit(s, {
    name: 'push dialog: pushed-today rows render unticked',
    pattern: /oldRows\.map\(\(r, i\) => row\(r, 'o' \+ i\)\)/,
    replace: "oldRows.map((r, i) => row(r, 'o' + i, false))",
  });

  // The push progress bar showed four percentages, and all four were invented. They are not
  // decoration: "Verify results" is a five-step guide whose entire subject is the four phases,
  // and the bar is the only thing in the figure that changes between its steps.
  //
  // IntelliDash computes the number, it does not choose it. The percentage is the steps done over
  // the total steps, rounded, and held at 99 until the push ends (services/sa-push-changes.service.ts:197-201).
  // The total is the station count plus verification steps (5% of the stations, at least one)
  // plus retry steps (2%, at least one) (:213-222).
  //
  // The reproduction's scenario is six stations ("Push 6 Changes", "4 of 6", "2 station(s)"), so
  // n=6 gives stepsForVerification=1, stepsForRetry=1 and totalProcessSteps=8. Every phase falls
  // out of that:
  //
  //   pushing, 4 of 6   currentStepCount 4          round(4/8*100)  = 50   (was 64)
  //   retrieving        6 + round(1/2) = 7          round(7/8*100)  = 88   (was 12)
  //   verifying         7 + round(1/2) = 8          100, clamped    = 99   (was 82)
  //   retrying          reset to 0 (see below)                      = 0    (was 46)
  //
  // THE 12 IS THE INTERESTING ONE, because it is not a typo — it encodes a wrong mental model of
  // the push, and the guide prose encodes the same one. "It reads Lynx first / Before writing
  // anything" is how "Verify results" opens, and 12% is what you would draw if you believed it.
  // The product does the opposite: the push button hands the changes straight to the write loop
  // with no prior read (components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts:255-269),
  // the first progress state is the pushing step (services/sa-push-changes.service.ts:136-137),
  // and the only read of Lynx in the push path is requested when the write loop completes
  // (:162-170) — AFTER every station is written. Retrieving is phase two of four, not phase one, which is exactly why it sits at 88.
  // The prose is corrected alongside this as transform 12 in src/transform-export.mjs; correcting
  // one without the other would leave a figure contradicting its own caption.
  //
  // The 0 is the second finding. On a retry the bar does not resume — it RESETS: the step count
  // goes back to zero and the total is recomputed for the failed stations alone before the
  // retrying step is reported (services/sa-push-changes.service.ts:93-97).
  //
  // A superintendent watching a push reach 99% and drop to 0% will read that as the whole run
  // collapsing, when the product is retrying two stations out of six and the guide correctly
  // says a retry "is information rather than an error". Drawing it at 46% hid the one moment in
  // the sequence a reader most needs to have been warned about.
  s = edit(s, {
    name: 'push progress: invented phase percentages become the computed ones',
    pattern: /fetching: \[12, ('Retrieving latest Percent Adjustments from Lynx for comparison')\],\n(\s*)running: \[64, ('Pushing Percent Adjustments to Lynx \(4 of 6\)')\],\n\s*verifying: \[82, ('Verifying adjustments sent to Lynx')\],\n\s*retry: \[46, ('Push Changes failed for 2 station\(s\)\. Retrying')\]/,
    replace: (_m, retrieving, indent, pushing, verifying, retrying) =>
      `fetching: [88, ${retrieving}],\n${indent}running: [50, ${pushing}],\n${indent}verifying: [99, ${verifying}],\n${indent}retry: [0, ${retrying}]`,
  });

  // The settings rail listed Target Profiles only on the Target Profiles tab itself, or when the
  // guide page set showProfilesTab. The product lists it unconditionally, third of four
  // (sa-settings-dlg.component.ts:52-57), so every other settings figure was missing a rail entry
  // the reader sees. Preferences moves down one place as a result; its cursor target moves with it
  // in src/transform-export.mjs ("settings rail: Preferences cursor below Target Profiles").
  s = edit(s, {
    name: 'settings rail always lists Target Profiles',
    pattern: /if \(tab === 'profiles' \|\| this\.props\.showProfilesTab\) items\.push\(\['profiles'/,
    replace: "items.push(['profiles'",
  });

  // Option 1 disables Crop Coefficient along with the two amounts
  // (sa-settings-dlg.component.html:113-122). The reproduction dimmed only the amounts, so the
  // Option 1 figure in "Calculation methods" showed an editable Crop Coefficient.
  s = edit(s, {
    name: 'crop coefficient dims under Option 1',
    pattern: /field\('Crop Coefficient \(%\)', this\.numInput\('100', '140px'\)\)/,
    replace: "field('Crop Coefficient (%)', dim(this.numInput('100', '140px')))",
  });

  // The map drew every pin filled, including a disabled station and a station last scanned two days
  // ago, and its Layers panel showed All Stations selected. On production:
  //   - Layers defaults to Enabled Stations (environment.toro-prod.ts:88, read at
  //     sa-dashboard.component.ts:504), and that layer skips any station that fails the enabled
  //     test (sa-dash-map.component.ts:312). 5AP1 is disabled, so its pin is not drawn.
  //   - A pin whose latest scan is not from today is filled transparent (:315, with
  //     saShowCurrentOnly true at environment.toro-prod.ts:87), keeping only its white outline
  //     (:322-329). 7AP1 and 6AP1's second sprinkler were last scanned two days ago.
  //   - Pins are drawn per sprinkler record (sa-dashboard.component.ts:517-519), so 6AP1, which has
  //     two sprinklers, has two pins, each labelled with its own reading (31.4 and 30.4) rather than
  //     the station's average.
  // Each MARKERS entry gains an optional fourth element: 'off' for a disabled station, 'old' for a
  // scan from an earlier day. docs/text-corrections.md section 23.
  s = edit(s, {
    name: 'map markers: 5AP1 is disabled',
    pattern: /\[58,21,27\.9\]/,
    replace: "[58,21,27.9,'off']",
  });
  s = edit(s, {
    name: 'map markers: 7AP1 was scanned two days ago',
    pattern: /\[63,47,50\.0\]/,
    replace: "[63,47,50.0,'old']",
  });
  s = edit(s, {
    name: 'map markers: 6AP1 has a pin per sprinkler',
    pattern: /\[68,30,30\.9\]/,
    replace: "[68,30,31.4],[63,27,30.4,'old']",
  });
  s = edit(s, {
    name: 'map markers: the default layer hides disabled stations',
    pattern: /return MARKERS\.map\(\(m, i\) => h\('div', \{/,
    replace: "return MARKERS.filter(m => m[3] !== 'off').map((m, i) => h('div', {",
  });
  s = edit(s, {
    name: 'map markers: a pin scanned before today is drawn clear',
    pattern: /background: this\.props\.mapMode === 'variance' \? varianceColor\(m\[2\] - NOMINAL_TARGET\) : rangeColor\(m\[2\]\), opacity: 0\.9, border: '1px solid rgba\(255,255,255,\.5\)'/,
    replace: "background: m[3] === 'old' ? 'transparent' : this.props.mapMode === 'variance' ? varianceColor(m[2] - NOMINAL_TARGET) : rangeColor(m[2]), "
      + "opacity: 0.9, border: m[3] === 'old' ? '2px solid rgba(255,255,255,.4)' : '1px solid rgba(255,255,255,.5)'",
  });
  s = edit(s, {
    name: 'map layers: Enabled Stations is the default selection',
    pattern: /layerOpt\('All Stations', true, 'l1'\),\n(\s*)layerOpt\('Enabled Stations', false, 'l2'\)/,
    replace: "layerOpt('All Stations', false, 'l1'),\n$1layerOpt('Enabled Stations', true, 'l2')",
  });

  // The reproduced algorithm dropdown still rendered the ENUM NAME. Transform 1 in
  // src/transform-export.mjs fixed this in the prose — "the guide calls the two methods Simple
  // and the default method, which are the enum names; a reader hunting the dropdown for Simple
  // finds nothing" — but the dropdown in the figure went on saying it:
  //
  //   SpatialAdjustApp.dc.html:424
  //     field('Suggested Percent Adjust Calculation', this.select(simple ? 'Simple' : 'Option 2'))
  //
  // IntelliDash renders SPATIAL_ADJUST.ALGO_SIMPLE as "Option 1"; the Option 2 branch was already
  // right, so only one side of the ternary was ever wrong. It surfaces in "Calculation methods",
  // the guide whose whole subject is choosing between the two — text saying Option 1 beside a
  // figure saying Simple is the worst place for this to survive.
  //
  // Found by scripts/repro-inventory.mjs: "Simple" appeared in the rendered inventory with no
  // product backing. The curated _screenStrings list never contained it, so nothing was looking.
  s = edit(s, {
    name: 'algorithm dropdown enum name in the reproduction',
    pattern: /this\.select\(simple \? 'Simple' : 'Option 2'\)/,
    replace: "this.select(simple ? 'Option 1' : 'Option 2')",
  });

  // The Preferences language dropdown showed "English (US)". IntelliDash's own language list is
  // LANGUAGE.ENGLISH = "English" — the product does qualify some entries ("Dutch
  // (Netherlands/Belgium)", "Chinese - Simplified") but English is not one of them, so the
  // parenthetical is invented. Small, but it is a value a reader compares against their own
  // dropdown while following the Preferences guide.
  s = edit(s, {
    name: 'preferences language option',
    pattern: /this\.select\('English \(US\)'\)/,
    replace: "this.select('English')",
  });

  return s;
}
