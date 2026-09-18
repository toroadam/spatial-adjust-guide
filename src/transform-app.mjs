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

// The replacement markup for the Target Profiles pane, kept out of the transform above so the
// anchor stays readable. `numInput` is reused for the name field: it renders a bordered box
// containing the value, which is what pInputText looks like at this scale.
const TP_COLS = "'2.1fr 1.2fr 0.8fr 1.5fr 1.1fr'";

const TARGET_PROFILES_TABLE = [
  "h('div', { style: { border: '1px solid #080D121A', borderRadius: '4px', background: '#fff', marginTop: '16px', overflow: 'hidden' } },",
  `  h('div', { style: { display: 'grid', gridTemplateColumns: ${TP_COLS}, alignItems: 'center', padding: '10px 14px', background: '#F5F7F8', borderBottom: '1px solid #080D121A', fontWeight: 'bold', color: '#080D12', fontSize: '13px' } },`,
  "    h('div', null, 'Target Profile'), h('div', null, 'Last Updated'), h('div', null, 'Stations'),",
  "    h('div', null, 'Update from Current'), h('div', null, 'Apply Profile')),",
  "  [['Summer Baseline', '14 Jun 2026', '148'], ['Tournament Week', '02 May 2026', '148'], ['Overseed Recovery', '--', '--']].map(p =>",
  `    h('div', { key: p[0], style: { display: 'grid', gridTemplateColumns: ${TP_COLS}, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #080D121A' } },`,
  "      h('div', null, this.numInput(p[0], '170px')),",
  "      h('div', { style: { fontSize: '13px', color: '#080D12' } }, p[1]),",
  "      h('div', { style: { fontSize: '13px', color: '#080D12' } }, p[2]),",
  "      h('div', null, h('div', { style: { width: '22px', height: '22px', borderRadius: '3px', border: '1px solid #a6a6a6', background: '#fff' } })),",
  "      h('div', null, h('div', { style: { width: '22px', height: '22px', borderRadius: '3px', border: '1px solid #a6a6a6', background: '#fff', opacity: p[2] === '--' ? 0.45 : 1 } }))))),",
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

  // The reproduced Target Profiles pane carries its own footnote, and it said "Concept". Same
  // correction as transform 8 in src/transform-export.mjs, and the same reason: the tab is
  // implemented on a feature branch, not a concept. Kept short because it sits inside the
  // figure rather than in the prose around it.
  s = edit(s, {
    name: 'target profiles pane footnote',
    pattern: /Concept — this tab is not in the shipping build\./,
    replace: 'In development — not in the shipping build yet.',
  });

  // The Target Profiles pane depicted a concept, not the product.
  //
  // It drew three cards — a bold name, an "Applied 14 Jun 2026 · 148 stations" subtitle, and an
  // ACTIVE or APPLY badge on the right. None of that exists. The implementation on the feature
  // branch renders a five-column TABLE:
  //
  //   Target Profile | Last Updated | Stations | Update from Current | Apply Profile
  //
  // with the name in an editable text input, and the last two columns as icon buttons rather
  // than a single badge. Those are two separate actions — write current values INTO a profile,
  // and push a profile OUT to the stations — and the card design collapsed them into one, which
  // is the part a reader would get wrong. The product also renders '--' rather than prose when a
  // profile has never been populated: `stationCount < 1 ? '--' : stationCount`, and Last Updated
  // is blanked to '--' on the same condition, so "Never applied · 148 stations" was impossible.
  //
  // Read from the branch template rather than guessed, and verified identical on the newer
  // queue branch, so this is the design as it stands and not a snapshot of an older iteration.
  // The tab is still commented out on the shipping branch — the footnote above says so — but
  // depicting the real table is strictly better than depicting an invention, and the pilot's
  // stated expectation is that these features reach production before the guides do.
  //
  // Apply is disabled when a profile holds no stations, matching [ngClass] "disabled" on the
  // branch. The icons carry no text on purpose: anything written here would enter the label
  // inventory as a product string the product does not have.
  // The pane's intro was written for the guide, not taken from the product. The tab renders
  // SPATIAL_ADJUST.SETTINGS_TARGET_PROFILES_HEADER, and that key resolves — on the feature
  // branch's own catalogue — to the sentence below. It was one of the six product labels the
  // fidelity gate listed as never shown by the guides.
  s = edit(s, {
    name: 'target profiles pane intro matches the product header key',
    pattern: /Save a full set of station Target VWC values as a named profile, then apply it whenever the season or the event calls for it\./,
    replace: 'Save, manage, and apply target profiles for seasonal and event-based irrigation strategies.',
  });

  s = edit(s, {
    name: 'target profiles: card list becomes the real five-column table',
    pattern: /h\('div', \{ style: \{ border: '1px solid #080D121A', borderRadius: '4px', background: '#F5F7F8', marginTop: '16px', overflow: 'hidden' \} \},[\s\S]*?'ACTIVE' : 'APPLY'\)\)\)\),/,
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
  // "6-16%" during "Move the band boundaries" is what surfaced it. sa-dash-map falls back to
  // `value?.range2Boundary || 19` when a user has no saved preference, so 19 is the default.
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
  // The product's own values (ToroEnums.SaVarianceColor, and the -11 / 10 fallbacks in
  // sa-dash-map.component.ts):
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
      + "  if (v <= -11) return '#FDB034';\n"   // inclusive: the product band is `from: -100, to: -11`
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
