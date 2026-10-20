// The click guard: the one place that decides whether an automated click may happen.
//
// Shared by the fidelity harvest (scripts/fidelity-harvest.mjs) and the video capture director
// (video/capture/director.mjs). Live Spatial Adjust pushes percent adjustments to Lynx, so a
// stray click waters a golf course. Do not copy this logic; import it.
//
// refuseReason(...)        pure: why a click must not happen, or null when it may.
// guardedClick(page, ...)  resolves the element's accessible name and icon, asks refuseReason,
//                          throws GuardRefusal on a refusal, and only then clicks.
// describeElement(loc)     the accessible name and icon identity the guard checks.
//
// The rules, in order:
//   1. Icon identity. When an expected icon is given, the element's icon must be that icon. Icon
//      buttons often carry no accessible name, so the name check cannot see them at all; a
//      selector that drifts onto the wrong icon button is caught only here. (A positional
//      selector in the harvest once resolved to refresh-scan-data instead of the settings gear.)
//   2. Name identity. When an expected name is given, the element's accessible name must be that
//      name (case and whitespace aside). A selector that drifted onto another control is refused.
//   3. Writes. A name matching WRITES (scripts/lib/writes.mjs) is refused. The one exception is a
//      click an episode declares for Demo Mode: it is allowed only when the name is listed in
//      allowWrites AND demoVerified is true, which only the capture director sets, and only after
//      it has verified the Demo Mode entry. Listing a write-like name in allow never allows it.
//   4. Allowlist. When allow is given, the name must be in it. An empty name is never in it.
//
// No side effects at import: this module opens no connection and launches nothing. The harvest
// connects over CDP itself; the director owns its own browser.

import { WRITES } from './writes.mjs';

export class GuardRefusal extends Error {
  constructor(message, { name = '', iconId = null, reason = 'refused' } = {}) {
    super(message);
    this.name = 'GuardRefusal';
    this.refusedName = name;
    this.iconId = iconId;
    this.reason = reason;
  }
}

export const normaliseName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const sameName = (a, b) => normaliseName(a).toLowerCase() === normaliseName(b).toLowerCase();
// Entries may be names or { name } objects (episode.demoWriteClicks has { name, target, reason }).
const listHas = (list, name) => (list ?? []).some((entry) => sameName(typeof entry === 'string' ? entry : entry?.name, name));

// Why the click must be refused, or null when it may happen. Pure; safe to call anywhere.
//   name            the element's resolved accessible name
//   iconId          the element's resolved icon identity (see describeElement), or null
//   expectedIconId  refuse unless iconId equals it (when given)
//   expectedName    refuse unless name equals it (when given)
//   allow           allowlist of read-only names (when given, the name must be in it)
//   allowWrites     declared demo-mode write clicks (names or { name } objects)
//   demoVerified    true only when the capture director verified the Demo Mode entry
export function refuseReason({ name, iconId = null, expectedIconId, expectedName, allow, allowWrites, demoVerified = false } = {}) {
  const shown = normaliseName(name);
  if (expectedIconId != null && iconId !== expectedIconId) {
    return `resolved to icon "${iconId ?? 'none'}", expected "${expectedIconId}"`;
  }
  if (expectedName != null && !sameName(shown, expectedName)) {
    return `resolved to "${shown}", expected "${normaliseName(expectedName)}"`;
  }
  const writeLike = WRITES.test(shown) || (expectedName != null && WRITES.test(normaliseName(expectedName)));
  if (writeLike) {
    if (!listHas(allowWrites, shown)) return `"${shown}" matches the write guard and is not a declared demo-mode click; it may write to Lynx`;
    if (demoVerified !== true) return `"${shown}" is a declared demo-mode click, but Demo Mode was not verified`;
    return null;
  }
  if (allow !== undefined && !listHas(allow, shown)) {
    return shown ? `"${shown}" is not in the allowlist` : 'the element has no accessible name, so it cannot be in the allowlist';
  }
  return null;
}

// The element's accessible name and icon identity, resolved in the page.
//   name    aria-label, else the aria-labelledby text, else innerText, else title, else the value
//           of a button-type input, else the alt text of an image inside it
//   iconId  the icon attribute of the first fa-icon (itself or inside), else the data-icon of the
//           first svg, else the file name (no extension) of the first img
export async function describeElement(locator) {
  return locator.evaluate((node) => {
    const text = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    const byIds = (ids) => text(String(ids ?? '').split(/\s+/).filter(Boolean)
      .map((id) => document.getElementById(id)?.innerText ?? '').join(' '));
    const buttonValue = node.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(node.type) ? node.value : '';
    const name = text(node.getAttribute('aria-label')) || byIds(node.getAttribute('aria-labelledby'))
      || text(node.innerText) || text(node.getAttribute('title')) || text(buttonValue)
      || text(node.querySelector('img[alt]')?.getAttribute('alt'));
    const pick = (sel) => (node.matches(sel) ? node : node.querySelector(sel));
    const fa = pick('fa-icon[icon]')?.getAttribute('icon');
    const svg = pick('svg[data-icon]')?.getAttribute('data-icon');
    const src = pick('img[src]')?.getAttribute('src');
    const img = src ? src.split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '') : null;
    return { name, iconId: fa || svg || img || null };
  });
}

// Resolve, check, then click. Throws GuardRefusal (before any click) when refuseReason refuses
// or the target does not resolve.
//   target     a selector string (first match is used) or a Playwright Locator
//   why        what the click is for, used in messages
//   name       the expected accessible name (expectedName above)
//   dispatch   optional (locator, info) => Promise that performs the click instead of
//              locator.click(); the capture director uses it to hand the click to its in-page
//              runtime, which checks the element again before dispatching
//   settleMs   wait after the click (the harvest waits for dialogs to open)
// Returns { name, iconId } of the clicked element.
export async function guardedClick(page, target, {
  why = 'click', name: expectedName, expectedIconId, allow, allowWrites, demoVerified = false,
  timeout = 8000, settleMs = 0, dispatch, describe = describeElement,
} = {}) {
  const el = typeof target === 'string' ? page.locator(target).first() : target;
  if (!(await el.count())) {
    throw new GuardRefusal(`${why}: selector not found${typeof target === 'string' ? ` — ${target}` : ''}`, { reason: 'not found' });
  }
  const info = await describe(el);
  const reason = refuseReason({ name: info.name, iconId: info.iconId, expectedIconId, expectedName, allow, allowWrites, demoVerified });
  if (reason) throw new GuardRefusal(`refusing to click (${why}): ${reason}`, { name: info.name, iconId: info.iconId, reason });
  if (dispatch) await dispatch(el, info);
  else await el.click({ timeout });
  if (settleMs) await page.waitForTimeout(settleMs);
  return info;
}
