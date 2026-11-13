// The recreation's map in the product's look, page side. Installed by video/capture/recreation-map.mjs as an init script
// (after the config), for a recreation take whose episode sets "recreationMap". Capture only: the guide site keeps its drawn
// aerial, and the imagery never enters the repository (the Node side serves it from the media root).
//
//   window.__saRecMap = { backdrop, view: { x0, y0, w, h }, zoom, diameter, pins: [{ x, y, name }] }
//
//   backdrop   URL the Node side answers with the satellite image (z19 pixels)
//   view       the window of that image the card shows, in image pixels (aspect is kept; the card covers)
//   zoom       the map zoom the window stands for; station labels scale by 2^(zoom - 19) like the product's circle labels
//   diameter   station circle diameter in CSS px at that zoom (the product's circles are real-world radii, so they scale)
//   pins       the 24 pins of the app's map, in the order the app draws them: a position hint (percent of the card) and station name;
//              each is snapped to the nearest spot of the station field below
//   total      how many circles the map shows (the table header's 148 All Stations); the 24 app pins plus generated ones
//   seed       seeds the field (mulberry32), so every run draws the same map
//   spots      [[x, y, region], ...] circle centres, percent of the card, computed from the backdrop's own fairway mask by
//              video/capture/recreation-map-field.py: every centre is on mowed turf. When present, chains and greens are not used
//   chains     fairway centre lines [{ id, hole, mean, pts: [[x, y], ...] }], percent of the card; circles are strung along them
//              at an even spacing of about one diameter, with a little jitter, never scattered
//   greens     [{ x, y, n, r }] rings of n circles of radius r px round a green
//
// What it changes, and only by styling (the app's own elements stay the targets, so every selector the episode uses still
// resolves): the card's ground becomes the aerial; each pin becomes a Leaflet circle (2 px white outline at 0.4, the band
// colour at fill opacity 0.5) with the percent and the station name inside, scaled like the product's labels; the legend gets
// the product's compact chips and thin bar with grey handles; the Leaflet zoom buttons and the "Leaflet | (c) OpenStreetMap
// contributors, (c) Google Maps" attribution are drawn. No timers and no animation frames: a MutationObserver (microtasks)
// re-applies the styling when the app re-renders, so the recorder's virtual clock is not involved.
(() => {
  const cfg = window.__saRecMap;
  if (!cfg || window.__saRecMapInstalled) return;
  window.__saRecMapInstalled = true;
  const done = new WeakSet();
  const STYLE = `
    .sa-rm-sat{position:absolute;inset:0;background-repeat:no-repeat;background-color:#1F2B1C}
    .sa-rm-card [data-sa-rm-hide]{display:none!important}
    .sa-rm-pin{box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
      border:2px solid rgba(255,255,255,.4)!important;opacity:1!important;color:#fff!important;font-weight:700!important;line-height:1!important;text-align:center!important}
    .sa-rm-pin::after{content:attr(data-sa-name);display:block;font-weight:400;white-space:nowrap;font-size:var(--sa-name-size,5px);margin-top:1px}
    .sa-rm-decoys{position:absolute;inset:0;pointer-events:none}
    .sa-rm-dec{position:absolute;box-sizing:border-box;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,.4);border-radius:50%;display:flex;flex-direction:column;
      align-items:center;justify-content:center;color:#fff;font-weight:700;line-height:1;text-align:center}
    .sa-rm-dec::before{content:attr(data-pct)}
    .sa-rm-dec::after{content:attr(data-sa-name);display:block;font-weight:400;white-space:nowrap;font-size:var(--sa-name-size,5px);margin-top:1px}
    .sa-rm-legend{padding:8px 18px 10px!important;border-radius:4px!important;box-shadow:0 1px 5px rgba(0,0,0,.65)!important}
    .sa-rm-legend [data-sa-rm-chip]{min-width:56px!important;padding:5px 12px!important;border-radius:2px!important;font-size:11px!important;margin-right:6px!important}
    .sa-rm-legend [data-sa-rm-bar]{height:6px!important;margin-top:7px!important}
    .sa-rm-legend [data-sa-rm-bar]>div:first-child{border-radius:3px!important}
    .sa-rm-legend [data-sa-handle]{width:13px!important;height:13px!important;top:-4px!important;margin-left:3.5px!important;background:#A8A8A8!important;border:1px solid #fff!important;box-shadow:0 0 2px rgba(0,0,0,.55)!important}
    .sa-rm-zoom{position:absolute;left:10px;top:10px;z-index:460;border:2px solid rgba(0,0,0,.2);border-radius:5px;background-clip:padding-box;pointer-events:none}
    .sa-rm-zoom div{width:30px;height:30px;line-height:30px;text-align:center;background:#fff;color:#000;font:bold 22px 'Lucida Console',Monaco,monospace;border-bottom:1px solid #ccc}
    .sa-rm-zoom div:first-child{border-radius:3px 3px 0 0}.sa-rm-zoom div:last-child{border-radius:0 0 3px 3px;border-bottom:0}
    .sa-rm-attr{position:absolute;right:0;bottom:0;z-index:460;padding:0 5px;background:rgba(255,255,255,.8);color:#333;font:11px/1.6 'Helvetica Neue',Arial,Helvetica,sans-serif;pointer-events:none;white-space:nowrap}
    .sa-rm-attr a{color:#0078A8;text-decoration:none}.sa-rm-attr svg{display:inline-block;vertical-align:baseline;width:12px;height:8px;margin-right:4px}`;

  const rgba = (c, a) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || '');
    if (!m) return null;
    return m[4] !== undefined && +m[4] === 0 ? 'rgba(0,0,0,0)' : `rgba(${m[1]},${m[2]},${m[3]},${a})`;
  };


  // ---- the station field: chains of circles along the fairways, rings round the greens -----------------------------------
  const rng = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function layout(w, h) {
    const rnd = rng(cfg.seed || 1), D = cfg.diameter, ring = cfg.greens || [];
    if (cfg.spots) {                                   // precomputed from the backdrop's own fairway mask (recreation-map-field.py): centres already on turf
      const means = {};
      const out = cfg.spots.map(([x, y, ri]) => { if (means[ri] === undefined) means[ri] = 25 + Math.floor(rnd() * 9); return { x: x * w / 100, y: y * h / 100, chain: 'r' + ri, hole: (ri % 16) + 3, mean: means[ri] }; });
      while (out.length > cfg.total) out.splice(Math.floor(rnd() * out.length), 1);
      return { spots: out, spacing: 0 };
    }
    const chains = cfg.chains.map((c) => {
      const pts = c.pts.map(([x, y]) => [x * w / 100, y * h / 100]);
      const seg = []; let len = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); len += l; }
      return { ...c, pts, seg, len };
    });
    const inRings = ring.reduce((a, g) => a + g.n, 0), onChains = Math.max(1, cfg.total - inRings);
    const sp = chains.reduce((a, c) => a + c.len, 0) / onChains;       // even spacing along every chain, so the count lands on `total`
    const out = [];
    chains.forEach((c) => {
      const n = Math.max(1, Math.round(c.len / sp));
      for (let k = 0; k < n; k++) {
        let d = (k + 0.5) * c.len / n + (rnd() - 0.5) * 0.24 * sp, i = 0;
        d = Math.min(Math.max(d, 0), c.len);
        while (i < c.seg.length - 1 && d > c.seg[i]) { d -= c.seg[i]; i++; }
        const a = c.pts[i], b = c.pts[i + 1], f = c.seg[i] ? d / c.seg[i] : 0, nx = (a[1] - b[1]) / (c.seg[i] || 1), ny = (b[0] - a[0]) / (c.seg[i] || 1), off = (rnd() - 0.5) * 0.2 * D;
        out.push({ x: a[0] + (b[0] - a[0]) * f + nx * off, y: a[1] + (b[1] - a[1]) * f + ny * off, chain: c.id, hole: c.hole, mean: c.mean, k, n });
      }
    });
    ring.forEach((g, gi) => {
      const cx = g.x * w / 100, cy = g.y * h / 100, rot = rnd() * 6.28;
      for (let k = 0; k < g.n; k++) {
        const th = rot + (k / g.n) * 6.283 + (rnd() - 0.5) * 0.3, r = g.r * (0.9 + rnd() * 0.25);
        out.push({ x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r, chain: 'g' + gi, hole: g.hole || 9, mean: g.mean || 27, k, n: g.n });
      }
    });
    while (out.length > cfg.total) out.splice(Math.floor(rnd() * out.length), 1);     // rounding can leave one over
    return { spots: out, spacing: sp };
  }
  // value, target and scan state of each generated station: a random walk along its chain (so neighbours read alike), a few
  // low dips (yellow, red) and a few short runs that were not scanned today. Ranges stay inside 0 to 50.
  function populate(spots, taken) {
    const rnd = rng((cfg.seed || 1) * 7919 + 13), names = new Set(taken), last = {};
    const clear = new Set();
    for (let r = 0; r < 6; r++) { const s0 = Math.floor(rnd() * spots.length); for (let j = 0; j < 1 + Math.floor(rnd() * 2); j++) clear.add((s0 + j) % spots.length); }
    spots.forEach((s, i) => {
      let v = last[s.chain] === undefined ? s.mean : last[s.chain] + (rnd() - 0.5) * 9 + (s.mean - last[s.chain]) * 0.15;
      v = Math.min(48, Math.max(1, v)); last[s.chain] = v;
      const dip = rnd();
      s.v = Math.round((dip < 0.025 ? rnd() * 5 : dip < 0.075 ? 6 + rnd() * 13 : v) * 10) / 10;
      s.t = Math.min(50, Math.max(5, Math.round(s.v + (rnd() - 0.5) * 22)));
      s.clear = clear.has(i);
      let n = 1, nm; do { nm = `${s.hole}AP${n++}`; } while (names.has(nm)); names.add(nm); s.name = nm;
    });
  }
  function bands(ov) {
    const row = ov.querySelector('.sa-ps'); if (!row) return null;
    const chips = [...row.parentElement.children], variance = chips.length < 4;
    if (chips.length < 3) return null;
    const nums = (c) => (c.textContent.match(variance ? /-?\d+(?:\.\d+)?/g : /\d+(?:\.\d+)?/g) || []).map(Number);     // "0-5%" is 0 and 5; "< -11%" is -11
    return { variance, colours: chips.map((c) => getComputedStyle(c).backgroundColor), n: chips.map(nums) };
  }
  function bandOf(b, v, t) {
    if (b.variance) { const d = v - t; return d <= b.n[0][0] ? 0 : d > b.n[2][b.n[2].length - 1] ? 2 : 1; }
    return v <= b.n[0][b.n[0].length - 1] ? 0 : v <= b.n[1][b.n[1].length - 1] ? 1 : v <= b.n[2][b.n[2].length - 1] ? 2 : 3;
  }
  function paint(field, ov) {
    const b = bands(ov); if (!b) return;
    field.forEach(({ el, s }) => {
      const colour = s.clear ? 'rgba(0,0,0,0)' : rgba(b.colours[bandOf(b, s.v, s.t)], 0.5) || 'rgba(0,0,0,0)';
      if (el.style.backgroundColor !== colour) el.style.backgroundColor = colour;
      const txt = String(b.variance ? Math.round(s.v - s.t) : Math.round(s.v));
      if (el.getAttribute('data-pct') !== txt) el.setAttribute('data-pct', txt);
    });
  }

  function pins(card, wrap, place) {
    const k = Math.pow(2, cfg.zoom - 19), D = cfg.diameter;
    [...wrap.children].forEach((el, i) => {
      const p = place[i]; if (!p) return;
      el.classList.add('sa-rm-pin');
      el.setAttribute('data-sa-name', cfg.pins[i].name);
      const base = el.getAttribute('data-sa-base');
      let colour = el.style.backgroundColor;
      if (colour && !/^rgba\(.*,\s*0?\.5\)$/.test(colour)) { el.setAttribute('data-sa-base', colour); } else if (base) colour = base;
      const fill = rgba(colour, 0.5) || 'rgba(0,0,0,0)';
      const set = (prop, v) => { if (el.style.getPropertyValue(prop) !== v) el.style.setProperty(prop, v); };
      set('left', p.x + 'px'); set('top', p.y + 'px'); set('width', D + 'px'); set('height', D + 'px');
      set('background-color', fill); set('font-size', (16 * k).toFixed(2) + 'px');
      el.style.setProperty('--sa-name-size', (10 * k).toFixed(2) + 'px');
    });
  }

  function legend(ov) {
    ov.classList.add('sa-rm-legend');
    const row = ov.querySelector('.sa-ps');
    if (row) {
      [...row.parentElement.children].forEach((c) => c.setAttribute('data-sa-rm-chip', ''));
      const bar = row.parentElement.nextElementSibling; if (bar) bar.setAttribute('data-sa-rm-bar', '');
    }
  }

  function setup(ov) {
    const card = ov.parentElement && ov.parentElement.parentElement;
    if (!card || done.has(card)) return;
    const r = { width: card.offsetWidth, height: card.offsetHeight };   // layout size: the guide page scales its figures with a transform
    if (r.width < 300) return;                                   // not laid out yet
    if (!card.closest('[data-sa-frame]')) return;                // only the figure the take lifted: the page's other copies stay as they are (their own 4K layers would cost memory)
    done.add(card);
    card.classList.add('sa-rm-card');
    const kids = [...card.children];
    const wrap = kids.find((c) => c.children.length === cfg.pins.length);
    kids.forEach((c) => { if (c !== wrap && !c.contains(ov) && c !== ov.parentElement) c.setAttribute('data-sa-rm-hide', ''); });
    const v = cfg.view, sc = Math.max(r.width / v.w, r.height / v.h);
    const sat = document.createElement('div');
    sat.className = 'sa-rm-sat';
    sat.setAttribute('aria-hidden', 'true');
    sat.style.cssText = `background-image:url(${cfg.backdrop});background-size:${(cfg.imageWidth * sc).toFixed(2)}px ${(cfg.imageHeight * sc).toFixed(2)}px;background-position:${(-v.x0 * sc).toFixed(2)}px ${(-v.y0 * sc).toFixed(2)}px`;
    card.insertBefore(sat, card.firstChild);
    const zoom = document.createElement('div'); zoom.className = 'sa-rm-zoom'; zoom.setAttribute('aria-hidden', 'true');
    zoom.innerHTML = '<div>+</div><div>−</div>';
    const attr = document.createElement('div'); attr.className = 'sa-rm-attr';
    attr.innerHTML = '<a><svg viewBox="0 0 12 8"><rect width="12" height="4" fill="#0057B7"/><rect y="4" width="12" height="4" fill="#FFD500"/></svg>Leaflet</a> | © OpenStreetMap contributors, © <a>Google Maps</a>';
    card.append(zoom, attr);
    legend(ov);
    // The field: every spot, then the app's 24 pins take the spot nearest their hint; the rest become generated circles.
    const L = layout(r.width, r.height), spots = L.spots, place = [];
    cfg.pins.forEach((p) => {
      let bi = -1, bd = 1e9; const hx = p.x * r.width / 100, hy = p.y * r.height / 100;
      spots.forEach((q, j) => { if (q.used) return; const d = Math.hypot(q.x - hx, q.y - hy); if (d < bd) { bd = d; bi = j; } });
      if (bi < 0) { place.push({ x: hx, y: hy }); return; }
      spots[bi].used = true; place.push({ x: spots[bi].x, y: spots[bi].y });
    });
    const rest = spots.filter((q) => !q.used);
    populate(rest, cfg.pins.map((p) => p.name));
    const layer = document.createElement('div'); layer.className = 'sa-rm-decoys'; layer.setAttribute('aria-hidden', 'true');
    const k = Math.pow(2, cfg.zoom - 19), D = cfg.diameter;
    const field = rest.map((s) => {
      const el = document.createElement('div'); el.className = 'sa-rm-dec';
      el.style.cssText = `left:${s.x.toFixed(1)}px;top:${s.y.toFixed(1)}px;width:${D}px;height:${D}px;font-size:${(16 * k).toFixed(2)}px;--sa-name-size:${(10 * k).toFixed(2)}px`;
      el.setAttribute('data-sa-name', s.name); layer.appendChild(el); return { el, s };
    });
    card.insertBefore(layer, sat.nextSibling);
    window.__saRecMapField = { count: field.length + cfg.pins.length, spacing: L.spacing };
    paint(field, ov);
    if (wrap) { pins(card, wrap, place); }
    // The app re-renders the pins (a legend drag, the variance toggle) and the legend: restyle in the same microtask turn.
    const mo = new MutationObserver(() => { mo.disconnect(); try { if (wrap) pins(card, wrap, place); legend(ov); paint(field, ov); } finally { mo.observe(card, opts); } });
    const opts = { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['style', 'class'] };
    mo.observe(card, opts);
  }

  function scan() {
    document.querySelectorAll('div').forEach((d) => { if (d.style && d.style.zIndex === '450' && d.textContent.includes('LAYERS')) setup(d.firstElementChild || d); });
  }
  // setup() takes the legend card (the overlay's child); the overlay wrapper is its parent, the map card the wrapper's parent.
  const boot = () => {
    if (!document.getElementById('sa-rm-style')) { const s = document.createElement('style'); s.id = 'sa-rm-style'; s.textContent = STYLE; document.head.appendChild(s); }
    scan();
  };
  const start = () => { boot(); new MutationObserver(() => { boot(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sa-frame'] }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
