// Ported from iCentral MarCom 06-edit/compositor/gfx/render_gfx.mjs (75 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
// Renders every type / logo asset for a deliverable as a transparent PNG at final output pixels, with word and glyph boxes,
// using headless Chromium (the repository's Playwright dev dependency) and Golos UI (OFL) from the repository's _ds fonts.
// Offline: every non-file request is aborted.
//
//   node render_gfx.mjs <spec.json> <outDir>
//   spec: { assets: [{ id, html, css, words?, chars?, pad? }], fonts?: { family, dir, weights: { '400': file, ... },
//           weight_map?: { '600': 500 } }, logo_dir? }                  -> outDir/<id>.png + outDir/metrics.json
// fonts default to THEME's (video/edit/lib/theme.py): Golos UI 400/500/700 from _ds. Golos UI has no 600: an element whose
// computed weight is in weight_map is drawn at the mapped weight, with a one-line warning per asset on stderr. Every weight
// must load or the script exits 1, so a render never silently falls back to another face.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const DEFAULT_FONTS = {
  family: 'Golos UI',
  dir: path.join(REPO, '_ds', 'toro-oasis-design-system-53d56d79-256b-40ad-b179-70e176d485a8', 'assets', 'fonts'),
  weights: { 400: 'golos-ui_regular.ttf', 500: 'golos-ui_medium.ttf', 700: 'golos-ui_bold.ttf' },
  weight_map: { 600: 500 },
};
const [specFile, outDir] = process.argv.slice(2);
if (!specFile || !outDir) { console.error('usage: node render_gfx.mjs <spec.json> <outDir>'); process.exit(64); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const fonts = { ...DEFAULT_FONTS, ...(spec.fonts || {}) };
const weights = Object.keys(fonts.weights).map(Number).sort((a, b) => a - b);
for (const w of weights) {
  const f = path.join(fonts.dir, fonts.weights[w]);
  if (!fs.existsSync(f)) { console.error(`gfx: font file missing for weight ${w}: ${f}`); process.exit(1); }
}
const font = (f) => pathToFileURL(path.join(fonts.dir, f)).href;
const logo = (f) => pathToFileURL(path.isAbsolute(f) ? f : path.join(spec.logo_dir ?? path.join(HERE, 'logos'), f)).href;
const faces = weights.map((w) => `@font-face { font-family: '${fonts.family}'; src: url('${font(fonts.weights[w])}') format('truetype'); font-weight: ${w}; font-style: normal; }`).join('\n');
const page0 = `<!doctype html><html><head><meta charset="utf-8"><style>
${faces}
html, body { margin: 0; background: transparent; }
body { font-family: '${fonts.family}', sans-serif; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; font-kerning: normal; }
#box { position: absolute; left: 0; top: 0; display: inline-block; white-space: nowrap; }
</style></head><body><div id="box"></div></body></html>`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 4000, height: 2400 }, deviceScaleFactor: 1 });
await ctx.route((u) => !u.href.startsWith('file:') && !u.href.startsWith('data:'), (r) => r.abort());
const page = await ctx.newPage();
const tmp = path.join(outDir, '_page.html'); fs.writeFileSync(tmp, page0);
await page.goto(pathToFileURL(tmp).href);
const loaded = await page.evaluate(async ({ family, weights }) => {
  for (const w of weights) await document.fonts.load(`${w} 40px '${family}'`);
  await document.fonts.ready;
  return Object.fromEntries(weights.map((w) => [w, [...document.fonts].some((f) => f.family.replace(/['"]/g, '') === family && String(f.weight) === String(w) && f.status === 'loaded')]));
}, { family: fonts.family, weights });
const missing = weights.filter((w) => !loaded[w]);
if (missing.length) { console.error(`gfx: ${fonts.family} failed to load at weight ${missing.join(', ')} from ${fonts.dir}`); await browser.close(); fs.unlinkSync(tmp); process.exit(1); }

const metrics = {};
for (const a of spec.assets) {
  const html = a.html.replaceAll('{{LOGO:', '').replace(/LOGO\(([^)]+)\)/g, (_, f) => logo(f));
  const m = await page.evaluate(async ({ html, css, words, chars, pad, weightMap, shipped }) => {
    const box = document.getElementById('box');
    box.style.cssText = css || ''; box.style.position = 'absolute'; box.style.left = '0'; box.style.top = '0'; box.style.padding = `${pad}px`;
    box.innerHTML = html;
    // wrap words / chars of text nodes in spans for metrics
    if (words || chars) {
      const walk = (n) => {
        for (const c of [...n.childNodes]) {
          if (c.nodeType === 3) {
            const frag = document.createDocumentFragment();
            for (const part of c.textContent.split(/(\s+)/)) {
              if (!part) continue;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
              const w = document.createElement('span'); w.className = '__w';
              if (chars) for (const ch of part) { const s = document.createElement('span'); s.className = '__c'; s.textContent = ch; w.appendChild(s); }
              else w.textContent = part;
              frag.appendChild(w);
            }
            c.replaceWith(frag);
          } else if (c.nodeType === 1 && !c.classList.contains('__w')) walk(c);
        }
      };
      walk(box);
    }
    // weights the family does not ship: mapped ones are redrawn at the mapped weight, others are reported
    const remapped = new Set(); const unshipped = new Set();
    for (const el of [box, ...box.querySelectorAll('*')]) {
      const w = getComputedStyle(el).fontWeight;
      if (weightMap[w] !== undefined) { el.style.fontWeight = String(weightMap[w]); remapped.add(`${w}->${weightMap[w]}`); }
      else if (!shipped.includes(Number(w)) && el.textContent.trim()) unshipped.add(w);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const img of box.querySelectorAll('img')) if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r; });
    const R = box.getBoundingClientRect();
    const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height, text: el.textContent }; };
    return { w: Math.ceil(R.width), h: Math.ceil(R.height), words: [...box.querySelectorAll('.__w')].map(rel), chars: [...box.querySelectorAll('.__c')].map(rel),
      parts: Object.fromEntries([...box.querySelectorAll('[data-part]')].map((e) => [e.dataset.part, rel(e)])),
      remapped: [...remapped], unshipped: [...unshipped] };
  }, { html, css: a.css, words: !!a.words, chars: !!a.chars, pad: a.pad ?? 0, weightMap: fonts.weight_map || {}, shipped: weights });
  if (m.remapped.length) console.warn(`gfx: ${a.id}: ${fonts.family} has no ${m.remapped.map((r) => r.split('->')[0]).join('/')} weight; drawn at ${m.remapped.map((r) => r.split('->')[1]).join('/')}`);
  if (m.unshipped.length) console.warn(`gfx: ${a.id}: ${fonts.family} does not ship weight ${m.unshipped.join('/')}; Chromium picks the nearest shipped face`);
  delete m.remapped; delete m.unshipped;
  await page.screenshot({ path: path.join(outDir, `${a.id}.png`), clip: { x: 0, y: 0, width: m.w, height: m.h }, omitBackground: true });
  metrics[a.id] = m;
}
fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 1));
fs.unlinkSync(tmp);
await browser.close();
console.log(`gfx: ${spec.assets.length} assets -> ${outDir}`);
