# Double Click #1: Dashboard overview

**Episode:** 1 of 26 · **Wave:** 1 (Getting Started) · **Guide:** `#/dashboard-overview` · **Script version:** v2 (polish pass after the 2026-10-22 review; the recipe is [`../POLISH.md`](../POLISH.md))
**Voice:** ElevenLabs Brian · **Music:** the corporate bed `sa-bed-v3-corporate` (`video/brand/music-v3.json`, take 6; the calm bed `sa-bed-v2-calm` in `music-calm.json` stays an option) as a candidate; `episode.json` keeps the series bed id `sa-bed-v1` until the owner decides
**Source:** the guide site's recreation (`"source": "recreation"`), one lifted figure for the whole episode ("Toolbar, left: site, course selector"), starting at the course-level table (`recreationState`). The drill-down, the legend drag and the variance toggle are real interactions of the recreation under the capture director; no click is a write.

## Script

One row per VO line; each line is one beat group in `episode.json`, timed to its spoken words (`video/vo/word_times.py`). Spoken order is on-screen order.

| Line | Chapter | Picture | VO | Claim IDs |
|---|---|---|---|---|
| V0 | (title card) | Title card: Double Click, Dashboard overview | "The whole feature lives on one screen. Here are its four regions." | `dashboard-overview/summary/1`, `dashboard-overview/tile/2` |
| V1 | Start with the toolbar | Cursor on the site name, then the weather strip, then the average, high and low moisture; each spotlit, the camera cropped to the toolbar strip so the toolbar fills the width | "Start at the toolbar. It shows your site name, the weather strip, and the average, high, and low moisture for the course." | `dashboard-overview/1/1`, `dashboard-overview/1/3`, `dashboard-overview/1/5`, `dashboard-overview/1/7` |
| V2a | Read the map | Cursor on a red station (filled), then a clear station (drawn clear) | "On the map, stations scanned today are filled with a color. Stations from an earlier scan are drawn clear." | `dashboard-overview/2/3`, `dashboard-overview/2/6` |
| V2b | Read the map | Camera centered on the legend; cursor on the lowest band, then the highest band, then back | "The legend gives four bands, from 0 to 5 percent up to above 30. Each station takes its band's color, so you can see which stations are dry." | `dashboard-overview/2/8`, `dashboard-overview/2/3` |
| V2c | Read the map | Cursor on legend handle 1, then handle 3 | "These bands are only the starting point. The band boundaries are yours to change." | `dashboard-overview/2/8`, `map-navigation/2/6` |
| V2d | Read the map | Handle 3 is dragged right and released; the map recolors | "Drag a handle, then let go, and the map recolors." | `map-navigation/2/2`, `map-navigation/2/3` |
| V2e | Read the map | Cursor lands on the variance button and clicks it; the map shows variance; a silent click returns to moisture | "This button switches to variance, which shows how far each station is from its target." | `map-navigation/3/2`, `map-navigation/3/3` |
| V3a | Use the chart for one area at a time | Cursor on the chart list ("4 holes selected") | "This list picks the areas, holes, or stations the chart plots." | `dashboard-overview/3/2`, `dashboard-overview/3/3` |
| V3b | Use the chart for one area at a time | Cursor on the chart header | "The header shows your selection and its average moisture." | `dashboard-overview/3/8`, `dashboard-overview/3/6` |
| V4a | Work in the table | Cursor on the course in the trail, then the area row AP | "The table is a drill-down. It starts at the course, with a row for each area." | `dashboard-overview/4/2`, `dashboard-overview/4/7` |
| V4b | Work in the table | Click area AP: the hole rows appear | "Click an area to see its holes." | `dashboard-overview/4/7`, `dashboard-overview/4/8` |
| V4c | Work in the table | Click hole 3: the station rows appear | "Click a hole to see its stations." | `dashboard-overview/4/2`, `dashboard-overview/4/3` |
| V4d | Work in the table | Click the 3AP1 row (its name, never the check box): the row highlights and the chart header changes to 3AP1; the spotlight holds the row and the header together | "Click a station's row, and the chart header follows." | `dashboard-overview/4/8`, `dashboard-overview/3/6` |
| V4d2 | Work in the table | Cursor on the 3AP1 row's check box, which stays unticked through the whole drill-down; spotlight on the check box | "The check box is separate. It picks stations for a bulk change." | `bulk-adjustments/1/2`, `bulk-adjustments/summary/1` |
| V4e | Work in the table | Cursor on the Target VWC value, the percent adjustment value, the Enable switch of 3AP1 | "Three columns are yours to edit: Target VWC, the percent adjustment, and the Enable switch." | `dashboard-overview/4/4` |
| V4f | Work in the table | Cursor on the Current, then the Suggested adjustment of 3AP1 | "You can't edit Current or Suggested adjustment." | `dashboard-overview/4/4` |
| V4g | Work in the table | Click area AP in the trail: back up to the hole rows | "To go back up, click a name in the trail." | `dashboard-overview/4/5` |
| V5a | Check the counts before you leave | Cursor on Push Changes (never clicked) | "Before you leave, read the number on Push Changes. That is how many changes are pending." | `dashboard-overview/5/2`, `dashboard-overview/5/3` |
| V5b | Check the counts before you leave | Cursor on the green counter | "The green counter beside it shows how many went out today." | `dashboard-overview/5/3` |

## Notes

- Measured (take 10, final): 138.4 s (2:18.4), 78.5 s of speech in 19 lines; -14.3 LUFS, -1.3 dBTP after the cap encode; 23.2 MB (the CRF 14 master is 186 MB, kept as `dashboard-overview-take10-master.mp4`). Take 10 draws 148 circles on the satellite map, every centre on mowed turf: the centres come from a fairway and green mask built from the backdrop itself (`video/capture/recreation-map-field.py`), and the 24 app pins snap to them, dims the spotlight to 50 % with a 10 px feather, and crops the chart chapter to the right column and the table chapter to its top 570 px. Captions: 25 cues.
- Every claim cited is Verified in `docs/claims/claims.json`. The ledger has no claim for the drill order "course, then areas, then holes, then stations" as such; V4a to V4d rest on `4/2`, `4/3`, `4/7`, `4/8` (hole and area rows and what clicking one shows).
- "Colors" of the bands: the guide's claim (`map-navigation/2/6`) covers the band boundaries; V2c says boundaries only.
- Editable columns (V4e, V4f): `dashboard-overview/4/4` (only Target VWC, % Adj. and Enable can be edited; Current and Suggested cannot).
- Wording rule: rows, names, areas, holes and trail links are clicked; only check boxes are ticked. The row check box is the bulk-change pick (V4d2), not the selection that drives the chart header.
- Terms: station, modeled, average; American English. No soil factor.

## Never on camera

- Real course names, real people's names or emails, customer numbers.
- The IntelliDash dev URL, or any browser chrome.
- Any push, save or apply: Push Changes is hovered, never clicked.
