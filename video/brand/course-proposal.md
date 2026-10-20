# Fictional course identity and map approach: proposal v1

**Gates:** G1 (fictional course) and G2 (map approach) in [`../approvals.md`](../approvals.md) · **Feature:** PI-ICNT-SW-1079 · **Date:** 2026-10-19

The videos are captured from IntelliDash `/demo`. Its demo data carries a real course name (called "the demo course name" here; it is never written in this repository) and real people's names, and its map shows satellite tiles of a real place. Every frame of a published video must instead show one fictional course. This proposal settles two questions:

1. **G1, fictional course:** which fictional identity replaces the demo data on screen.
2. **G2, map approach:** what the map shows instead of satellite imagery of a real course.

Under the owner's direction of 2026-10-19 ("There's no gates to review them right now") the executor decides both and records the decision in `approvals.md`; the owner and the experts review it in person on 2026-10-22. The decision is at the end of this file.

## G1: fictional course

### Recommendation: Riverbend National

Reuse **Riverbend National**, the fictional course the guides already show. The guides' app header, breadcrumbs and every translated catalogue (`src/i18n/*.json`) use it, and the guides' scripts already treat it as allowed sample data (`scripts/import-export.mjs:52`, `scripts/product-provenance.mjs:46` and `:208`, `scripts/repro-inventory.mjs:28`, `scripts/app-strings.mjs:41`; the course id prefix `riverbend-` at `scripts/import-export.mjs:36` and `scripts/fidelity.mjs:271`). A reader who watches a video and then opens the guide sees the same course in both. No new name has to be checked, translated or allowlisted.

| Field | Value |
|---|---|
| Course name | Riverbend National |
| Short name | Riverbend |
| Course id prefix | `riverbend` (ids such as `riverbend-742`, as the guides' sanitizer already writes) |
| Location | Marrowby Valley, United States (an invented region; no place of that name exists in OpenStreetMap) |
| Holes | 18, named by number, `Hole 1` to `Hole 18`, as Lynx names them |
| Stations | `<hole>AP<n>`, for example `3AP1`, `6AP2`, `11AP3`, the pattern the guides use (`SpatialAdjustApp.dc.html:169-186`) and Lynx uses. Station names carry no identity, so they stay as the demo data has them |
| Superintendent | Morgan Ellery |
| Other people (first names only) | Morgan, Harper, Reese, Emery, Jules, Hollis, Sloane, Kendall |
| Customer number | `RVB-000742` |

**People.** First names only, gender-neutral, and of mixed lengths (five to seven letters) so each real name in the demo data can be paired with a fictional one of similar length and the layout does not reflow. None of these names appears anywhere in the iCentral MarCom material, so the Spatial Adjust videos cannot be confused with the iCentral series.

**Customer number.** Letters, a hyphen and six digits. Toro customer numbers are, as far as this project knows, digits only, so a lettered value cannot collide with a real one; the `742` matches the guides' course id `riverbend-742`. This is an assumption for the review to confirm (see the review agenda).

### Alternatives

Both alternatives are invented names. Each gets the same structure: same hole count, same station pattern and people, its own prefix and customer number.

| | Fernwick Heath | Brackenvale Links |
|---|---|---|
| Short name | Fernwick | Brackenvale |
| Course id prefix | `fernwick` | `brackenvale` |
| Location | Ellesby Valley, United Kingdom (invented region) | Thornmere Coast, Ireland (invented region) |
| Holes and stations | 18 holes by number; stations `<hole>AP<n>` | 18 holes by number; stations `<hole>AP<n>` |
| Superintendent | Morgan Ellery | Morgan Ellery |
| Customer number | `FWH-000742` | `BVL-000742` |
| Cost of choosing it | A second course name: the guides keep Riverbend National, so the guides and the videos would differ, and every allowlist site above would need the new name added | The same cost as Fernwick Heath, and the longest name of the three |

### Real-course check, 2026-10-19

Each name was searched on 2026-10-19 as a quoted phrase on Bing web search and as a place name in OpenStreetMap (Nominatim), and checked for appearances in the iCentral MarCom material and in the local name maps (`sanitize.local.json`, `video/capture/overlay.local.json`; counts only, nothing printed). A name that matched a real golf course would have been rejected.

| Name | Bing, quoted phrase | OpenStreetMap | iCentral MarCom | Local name maps | Result |
|---|---|---|---|---|---|
| Riverbend National | No course of that name. Results are unrelated businesses, and "Riverbend Golf Complex" (Western Washington), a real course with a different full name | No golf course of that name | Not present | No match | **Kept.** The full name is not a real course. Real courses called "Riverbend Golf …" exist (Western Washington; Ottawa, Ontario; New Brunswick), so the short name is shared; raised as a review question |
| Fernwick Heath | No results for the phrase | No place of that name | Not present | No match | Usable |
| Brackenvale Links | No results for the phrase | No place of that name ("Brackenvale" alone names a house in Jersey and a bus stop in County Down; neither is a golf course) | Not present | No match | Usable |

The people names, the superintendent name and the invented regions were checked against the iCentral MarCom material (no match) and the local name maps (no match). Any invented personal name will also be some real person's name; first names alone do not identify anyone.

### What changes on screen

`video/capture/course-overlay.js` rewrites, in the live page and in anything the page adds later:

- the course name beside the globe icon in the toolbar and the first breadcrumb segment;
- the table: area, hole and station rows, wherever a row or tooltip names the course;
- the map's DOM labels (station labels and the legend); the map imagery itself is canvas or image pixels, which text replacement cannot reach, and is handled by the map approach below;
- dialogs (confirmations, warnings, the "unsupported in Demo Mode" message) and the push lists ("Pushing Percent Adjustments to Lynx", "Available to Push", "Pushed Today");
- user and account display names, for example in the account menu, as first names from the list above;
- the customer number, wherever it is shown;
- the same names in `title`, `aria-label`, `placeholder`, `alt` and `value` attributes, so tooltips and accessible names match.

Station names in the `<hole>AP<n>` pattern, moisture readings and dates stay as the demo data shows them. Golf framing (holes, greens, fairways, a superintendent) is allowed for Spatial Adjust.

## G2: map approach

### The licensing question

The dashboard map in IntelliDash draws OpenStreetMap street tiles with Google satellite tiles on top (`~/IntelliDash/site/src/app/spatial-adjust/components/sa-dashboard/sa-dash-map/sa-dash-map.component.ts:237-253`). Google's terms require visible attribution wherever its imagery is shown and limit use of the imagery outside Google's own map experiences. A marketing video is a reproduction of that imagery outside the product. Nobody on this project has established that Toro's use of Google satellite tiles inside IntelliDash also covers showing them in marketing footage. Until Toro's legal team says it does, the videos should not depend on it. The satellite imagery is also of a real place, the demo course, which the videos must not identify.

### Blur

Apply a Gaussian blur (CSS `filter: blur()`) to the map's tile layer only (`.leaflet-tile-pane`), so station circles and labels stay sharp on top. **Pros:** the smallest change (one CSS rule in the page); the map still reads as aerial imagery, so the shot looks like the real product. **Cons:** it is still Google imagery, so the licensing question above stays open and the attribution must stay on screen; the course geometry (fairways, bunkers, water) survives a blur as recognisable shapes, so someone who knows the demo course could still recognise it. **Effort:** small.

### Restyle (recommended)

Replace every map tile, both the satellite and the street layer, with a locally generated tile in the guides' own map palette: the dark turf green `#2E3D2A` with lighter mowing stripes, the colours the guides' recreated map already uses (`SpatialAdjustApp.dc.html:78-79`). The capture script substitutes the tiles in the browser with Playwright `page.route`, for `GET` requests only; it never alters, creates or fulfils any other request. **Pros:** no Google or OpenStreetMap imagery appears in any frame, so the licensing question does not arise; no real place is shown; the map matches the guides' map, so guide and video look like one product; station circles keep their moisture colours and stand out more against a flat field. **Cons:** the map looks stylised rather than photographic, so it no longer shows the product's selling point of seeing stations on the real course; the station layout still follows the demo course's real station positions (dots on a flat field, which on their own do not identify a course). **Effort:** medium (tile generator, route, tests).

### Owned imagery

Substitute tiles cut from a Toro-owned or licensed aerial photograph of a real Toro site, through the same `GET`-only route. **Pros:** photographic, and fully licensed. **Cons:** needs a licence reference for the imagery; the image must be georeferenced and cut into tiles; the demo data's stations sit at the demo course's coordinates, so owned imagery of another site would put stations in the wrong places unless the demo coordinates are remapped too; it shows a real site, so that site must agree to appear. **Effort:** large, and blocked on sourcing imagery.

### Frame-out

Compose every shot so the map is never the subject: crop to the table, panels and dialogs, and keep the map out of frame or under a graphic. **Pros:** no imagery question at all; no engineering beyond knowing where the map is on screen. **Cons:** the Dashboard Overview and several guides are about the map, so whole episodes would lose their subject; every shot list carries the constraint forever; one careless frame shows the satellite imagery. **Effort:** small in code, large in editorial cost.

### Recommendation

**Restyle.** It is the only approach that removes both the licensing question and the real place from every frame without losing the map as a subject, and it makes the videos match the guides. Blur and frame-out stay available per episode (`mapPolicy` in `episode.json`): frame-out for episodes that never need the map, blur only if the review decides photographic imagery matters and legal clears it. Owned imagery is the long-term upgrade if a licensed aerial of a Toro site becomes available.

## Decision

Decided by the executor under owner direction 2026-10-19; for review in person 2026-10-22.

- **G1:** Riverbend National, with the identity in the table above. The machine-readable identity is `video/brand/course.json`, the only place the video pipeline defines the name.
- **G2:** Restyle, as the default `mapPolicy` for episodes; blur and frame-out remain available per episode.

Both are recorded in [`../approvals.md`](../approvals.md), and the questions for the experts are on the review agenda, [`../../docs/review-agenda.md`](../../docs/review-agenda.md).
