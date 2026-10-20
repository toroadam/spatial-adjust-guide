// A still of the guide site's own Spatial Adjust recreation, for the style frame's window shot (video/edit/style_frame.py):
// no IntelliDash, no Demo Mode, nothing of the owner's. The recreation is the built guide site (dist/), served on loopback
// by video/capture/recreation.mjs; Playwright's own headless Chromium loads one guide page, lifts the first full-size
// SpatialAdjustApp figure out of the page to fill the 1920x1080 viewport, draws the capture director's focus box and
// arrow cursor over it from the values the spec carries (brand.py focus_box and cursor_spec), and screenshots it at
// device scale `scale` (2: a 3840x2160 PNG, the size a capture records).
//
//   node video/edit/gfx/recreation_still.mjs <spec.json>
//   spec: { out, path: '/#/<guide>', scale: 2, highlightText: ['0-5%', '> 30%'], pad: 6,
//           cursorAt: [dx, dy] (fraction of the highlighted element), focusBox: {...}, cursor: {...} }
//   prints { out, focusBox: [x0, y0, x1, y1], cursor: [x, y] } in CSS px of the 1920x1080 frame
//
// The PNG must resolve under the media root (video/lib/media-root.mjs). Every request outside the recreation server is
// aborted. SA_RECREATION_PORT moves the server off 8124, as for the capture tests.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureRecreationServer } from '../../capture/recreation.mjs';
import { isInside, mediaRoot, refusalReason, resolveReal } from '../../lib/media-root.mjs';

const [specFile] = process.argv.slice(2);
if (!specFile) { console.error('usage: node video/edit/gfx/recreation_still.mjs <spec.json>'); process.exit(64); }
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const out = resolveReal(spec.out ?? '');
// The folder is checked, not the file: refusalReason's git lookup cannot step through an existing file (ENOTDIR).
const why = spec.out ? refusalReason(path.dirname(out)) ?? (isInside(out, mediaRoot()) ? null : `it is not under the media root ${mediaRoot()}`) : 'no out given';
if (why) { console.error(`recreation_still: refusing ${spec.out}: ${why}`); process.exit(2); }

const srv = await ensureRecreationServer({ log: (m) => console.error(`recreation_still: ${m}`) });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: spec.scale ?? 2 });
  await page.route((u) => !u.href.startsWith(srv.origin) && !u.href.startsWith('data:'), (r) => r.abort());
  await page.goto(new URL(spec.path ?? '/', srv.origin).href);
  await page.waitForSelector('.sa-app');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(spec.settleMs ?? 1200);
  const res = await page.evaluate(async ({ highlightText, pad, cursorAt, fb, cu }) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // lift the first app figure that fills the viewport exactly once its wrapper's transform is removed
    let app = null;
    for (const cand of document.querySelectorAll('.sa-app')) {
      const wrap = cand.parentElement?.parentElement;
      if (!wrap) continue;
      const old = wrap.style.cssText;
      wrap.style.cssText += ';position:fixed;left:0;top:0;transform:none;margin:0;width:1920px;height:1080px;z-index:2147483000';
      window.scrollTo(0, 0);
      await frame();
      const b = cand.getBoundingClientRect();
      if (Math.abs(b.left) < 0.5 && Math.abs(b.top) < 0.5 && Math.abs(b.width - 1920) < 0.5 && Math.abs(b.height - 1080) < 0.5) { app = cand; break; }
      wrap.style.cssText = old;
    }
    if (!app) return { error: 'no SpatialAdjustApp figure fills 1920x1080 when lifted' };
    // the smallest element in the app whose text holds every highlightText string
    let target = null;
    for (const el of app.querySelectorAll('*')) {
      const t = el.textContent || '';
      if (!highlightText.every((s) => t.includes(s))) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (!target || b.width * b.height < target.getBoundingClientRect().width * target.getBoundingClientRect().height) target = el;
    }
    if (!target) return { error: `no element holds ${highlightText.join(', ')}` };
    const b = target.getBoundingClientRect();
    const box = [b.left - pad, b.top - pad, b.right + pad, b.bottom + pad];
    const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
    const hl = document.createElement('div');
    hl.style.cssText = `position:fixed;left:${box[0]}px;top:${box[1]}px;width:${box[2] - box[0]}px;height:${box[3] - box[1]}px;`
      + `border:${fb.border}px solid ${fb.color};border-radius:${fb.radius}px;box-sizing:border-box;`
      + `box-shadow:0 0 0 ${fb.ring}px ${rgba(fb.color, fb.ring_alpha)},0 0 ${fb.glow}px ${rgba(fb.color, fb.glow_alpha)}`;
    const [vw, vh] = cu.view_box, [cw, ch] = cu.css_size;
    const cur = [b.left + b.width * cursorAt[0], b.top + b.height * cursorAt[1]];
    const svg = `<svg viewBox="0 0 ${vw} ${vh}" style="position:fixed;left:${cur[0] - 1.1}px;top:${cur[1] - 1.1}px;width:${cw}px;height:${ch}px;`
      + `filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))"><path d="M1 1 L1 16 L4.6 12.6 L7.2 18.6 L9.6 17.6 L7 11.8 L12 11.8 Z" `
      + `fill="${cu.fill}" stroke="${cu.stroke}" stroke-width="1" stroke-linejoin="round"/></svg>`;
    layer.appendChild(hl);
    layer.insertAdjacentHTML('beforeend', svg);
    document.body.appendChild(layer);
    await frame();
    return { focusBox: box.map((v) => Math.round(v * 100) / 100), cursor: cur.map((v) => Math.round(v * 100) / 100) };
  }, { highlightText: spec.highlightText ?? [], pad: spec.pad ?? 6, cursorAt: spec.cursorAt ?? [0.5, 0.5], fb: spec.focusBox, cu: spec.cursor });
  if (res.error) { console.error(`recreation_still: ${res.error}`); process.exitCode = 1; }
  else {
    await page.screenshot({ path: out });
    process.stdout.write(JSON.stringify({ out: path.resolve(out), ...res }) + '\n');
  }
} finally {
  await browser.close();
  await srv.close();
}
