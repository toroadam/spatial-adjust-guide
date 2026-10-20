# End-card URL options (gate G4)

**Feature:** PI-ICNT-SW-1081-3 · **Gate:** G4, end-card URL, in [`../approvals.md`](../approvals.md) · **Version:** v1 · **Data:** [`end-card.json`](end-card.json) · **Code:** `end_card` in [`../edit/lib/cards.py`](../edit/lib/cards.py)

Every Spatial Adjust video ends on the end card: the Spatial Adjust lockup, one line of call to action, a URL pill and the legal line, held as the last frame (see [`motion-system.md`](motion-system.md)). The iCentral series pointed at its own product site; the Spatial Adjust series needs its own destination, and that is a business decision, hence this gate. Three options:

| | (a) The guides site | (b) A toro.com product page | (c) No URL, lockup only |
|---|---|---|---|
| **Address** | https://toroadam.github.io/spatial-adjust-guide/, shown as `toroadam.github.io/spatial-adjust-guide` | A Spatial Adjust or IntelliDash page on toro.com. None is confirmed: no such address appears in this repository, so Toro marketing would supply it | None. The call to action and the URL pill are dropped; the lockup and the legal line stay |
| **Who it serves** | Superintendents and Toro staff who want to do what the video showed: the guides teach the same Spatial Adjust tasks step by step on a reproduction of the app, so the end card hands the viewer to the next step | Prospects and customers browsing Toro products: it sells Spatial Adjust rather than teaching it | Any audience; suits a video played inside a page that already is the destination (the guides site itself, an LMS, a sales deck) |
| **Stability of the URL** | Good today, but it will change: the site is GitHub Pages under a personal account, and the owner plans to move it to Azure web services behind Toro SSO. When it moves, every published video still shows the old address until it is re-rendered. Re-rendering is cheap (the URL is data in `end-card.json`), but copies already posted elsewhere keep the old address | High, if marketing commits to the address; product pages are renamed in site redesigns, outside this team's control | Nothing can go stale |
| **Public?** | Yes today: anyone can open it (checked 2026-10-19, HTTP 200). Behind Toro SSO later, only people with a Toro sign-in can open it, which may exclude customers | Yes | Not applicable |
| **Fit with the series** | Strong: the guides site is also where the videos will be delivered (ER-1621), so a viewer moves between video and guide on one site | Weak for a how-to series: it sends a viewer who wants to learn away from the guides | Neutral: no dead link ever, but no next step either |

## Decision

Recorded in [`../approvals.md`](../approvals.md), row G4: **(a), the guides site**, `https://toroadam.github.io/spatial-adjust-guide/`. Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22. The owner's direction names the live guides site URL as the default for the end card, and option (a) is the one destination that continues what the video teaches.

What the end card shows, from `end-card.json`:

- Call to action: "Explore the Spatial Adjust Guides" (5 words, held 3.9 s; the hold rule needs 3.0 s).
- URL pill: `toroadam.github.io/spatial-adjust-guide` (no `https://`, no trailing slash), with the blue arrow dot.
- Legal line: "© 2026 The Toro Company. All rights reserved."

While G4 has no recorded decision, `end_card` refuses to draw a final, and a draft (a style frame) shows `URL PENDING APPROVAL` in a pill with a grey dot instead of the address.

## If the decision changes

1. Add a new G4 row to `approvals.md` (never edit the decided one) naming the new address or option.
2. Update `url` and `display` in `end-card.json`. For option (c), the end card would need a lockup-only layout in `cards.py` first; that variant is not built.
3. Re-render the end-card still (`python3 video/edit/style_frame.py --version <next>`) and every episode already rendered.

`video/edit/tests/test_end_card.py` fails while `end-card.json` and the latest G4 row name different addresses.
