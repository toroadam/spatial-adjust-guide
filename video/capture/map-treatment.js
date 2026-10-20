// Map treatment for captures, page side (gate G2). Added as an init script by installMapRoutes
// (video/capture/map-routes.mjs), which applies it on DOMContentLoaded:
//
//   window.__saMapTreatment(policy, { palette, credit, blurPx })
//     blur           CSS blur on the Leaflet tile layer only (.leaflet-tile-pane). Station circles
//                    (overlay pane) and labels (marker pane) stay sharp. The imagery is still
//                    the provider's, so its attribution stays on screen.
//     restyle        the tiles are replaced by map-routes.mjs; here the map background takes the
//                    turf colour (no grey flash before a tile arrives) and the OpenStreetMap and
//                    Google attribution is hidden, since none of their imagery is shown.
//     owned-imagery  as restyle, with the attribution replaced by options.credit when given.
//     frame-out      nothing visual; the director keeps window.__saMap.bounds() out of frame.
//
//   window.__saMap
//     policy           the applied policy
//     bounds()         { x, y, width, height } of the map in CSS pixels of the viewport, or null
//     markerColours()  fill colours of the station circles, upper-case #RRGGBB (or 'TRANSPARENT')
//     bands            the moisture bands the colours must come from
//
// Station colours are never touched: the treatment filters the tile pane only. They stay in the
// moisture bands of SpatialAdjustApp.dc.html:315 (#E11837 0-5%, #F3D43B 6-16%, #42CE11 17-30%,
// #3079F0 over 30%); IntelliDash draws an out-of-date station as transparent.
//
// Uses no timers or animation frames (the recorder's virtual clock owns those) and holds no names.
(() => {
  const POLICIES = ['blur', 'restyle', 'owned-imagery', 'frame-out'];
  const STYLE_ID = 'sa-map-treatment';
  const BANDS = [
    { from: 0, to: 5, colour: '#E11837' },
    { from: 6, to: 16, colour: '#F3D43B' },
    { from: 17, to: 30, colour: '#42CE11' },
    { from: 31, to: Infinity, colour: '#3079F0' },
  ];
  const HEX = /^#[0-9a-f]{6}$/i;

  function normalise(colour) {
    if (!colour) return null;
    const c = colour.trim();
    if (HEX.test(c)) return c.toUpperCase();
    if (c === 'transparent') return 'TRANSPARENT';
    const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!m) return c.toUpperCase();
    if (m[4] !== undefined && Number(m[4]) === 0) return 'TRANSPARENT';
    return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }

  function container() {
    return document.querySelector('.leaflet-container') || document.getElementById('map');
  }

  function apply(policy, options = {}) {
    if (!POLICIES.includes(policy)) throw new Error(`map-treatment: unknown policy (expected ${POLICIES.join(', ')})`);
    const palette = options.palette || {};
    const turf = HEX.test(palette.turf || '') ? palette.turf : '#2E3D2A';
    const blurPx = Number.isFinite(options.blurPx) ? options.blurPx : 14;

    let css = '';
    if (policy === 'blur') {
      css = `.leaflet-tile-pane { filter: blur(${blurPx}px) !important; }`;
    } else if (policy === 'restyle' || policy === 'owned-imagery') {
      css = `.leaflet-container { background: ${turf} !important; }`;
      if (policy === 'restyle' || !options.credit) css += '\n.leaflet-control-attribution { display: none !important; }';
    }
    const root = document.head || document.documentElement;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      root.appendChild(style);
    }
    style.textContent = css;

    if (policy === 'owned-imagery' && options.credit) {
      document.querySelectorAll('.leaflet-control-attribution').forEach((el) => { el.textContent = String(options.credit); });
    }

    window.__saMap = {
      policy,
      bands: BANDS.map((b) => ({ ...b })),
      bounds() {
        const el = container();
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      },
      markerColours() {
        const paths = document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-overlay-pane circle');
        return [...paths].map((p) => normalise(p.getAttribute('fill') || getComputedStyle(p).fill));
      },
    };
    return policy;
  }

  Object.defineProperty(window, '__saMapTreatment', { value: apply, configurable: true, writable: false });
})();
