# Capture safety: IntelliDash Demo Mode audit and director rules

The videos are captured from a real IntelliDash running in Demo Mode. On a live course, Push Changes sends percent adjustments to Lynx and waters a golf course, so capture has to be safe by construction rather than by care. This page records what a read-only audit of the IntelliDash source found about Demo Mode, and the rules the capture director (`video/capture/director.mjs`) enforces as a result.

The audit is documentation only. Nothing in IntelliDash was changed, and nothing here proposes a change to it: the hazards below are reported to the owner, and the director is built to stay safe even if they are never fixed.

## Sources and line numbers

- **Audited:** IntelliDash `origin/develop` at `bd39f465` (2026-10-15), fetched 2026-10-19, read with `git show` without checking it out. That is the same commit the claims ledger is verified against (`docs/claims/README.md`). Paths below are relative to `site/src/app/` unless they start with `site/src/`.
- **Plan lines:** the plan for this feature quoted line numbers from an older local checkout of `develop` (`4d8aa61e`). Where a line moved on `origin/develop`, the tables give the current line and the plan's line side by side, so the correction is visible rather than silently copied.
- **No code is quoted.** The IntelliDash source is internal and this repository is public. This page cites `file:line` and describes behaviour in prose only.
- **Re-verify before a capture session** whenever `develop` has moved: the director cannot read IntelliDash source, so it enforces the rules below whatever the source says, but this page is what tells a person whether those rules are still the right ones.

## Entering Demo Mode

Demo Mode is decided once, when the app boots, from the address the document was loaded with. There is no server flag.

| Step | Where | What happens |
|---|---|---|
| Demo Mode is allowed on dev | `site/src/environments/environment.toro-dev.ts:20-21` (plan :19-20) | Static Demo Mode is off and dynamic Demo Mode is allowed, so the `/demo` path turns Demo Mode on. |
| ...and on prod | `site/src/environments/environment.toro-prod.ts:16-17` (plan :16) | Prod allows dynamic Demo Mode too. Capture is only ever pointed at the dev host; the director refuses any host that is not in the local capture config. |
| Bootstrap | `common/services/app-initializer.service.ts:50-59` (plan :50-58) | When dynamic Demo Mode is allowed and the full address ends `/demo`, the app sets Demo Mode on, turns analytics off and does not start the normal sign-in. Otherwise it starts the normal sign-in. |
| App component | `app.component.ts:194-200` | The same check again: an address ending `/demo` sets Demo Mode on and analytics off. |
| Sign-in skipped | `app.component.ts:204-207`, `api/auth/auth-manager.service.ts:149-152` | The app starts the Toro SSO redirect only when no SSO user is signed in, and in Demo Mode the auth manager reports an SSO user as signed in. **Correction to the plan:** Toro SSO with MFA is *not* required on the Demo Mode path. See "The demo sign-in form" below. |
| Demo Mode is only ever turned on | `api/auth/auth-manager.service.ts:49`, `:249-252`; `app.component.ts:197-198`; `common/services/app-initializer.service.ts:54`, `:58` | Every assignment in the app sets the flag to true. Nothing turns it off within a document; only a new document load can. |
| Routes | `app-routing.module.ts:18` and `:19-23` (plan :18-23) | `/demo` and `/spatialadjust` are root routes. `/spatialadjust` is guarded by the Spatial Adjust guard, which lets Demo Mode through (`common/guards/spatial-adjust-guard.service.ts:28-31`). |
| Spatial Adjust demo route | `spatial-adjust/spatial-adjust-routing.module.ts:16` | `/spatialadjust/demo` is a child of the Spatial Adjust shell, which is guarded by the auth guard (`:12`). The auth guard passes because Demo Mode reports an SSO user and installs an empty dash user (`api/auth/auth-manager.service.ts:249-252`, `common/guards/auth-guard.service.ts:23-25`). |
| The demo component | `root-components/demo/demo.component.ts:31-45` | For `/spatialadjust/demo` it remembers `/spatialadjust` as the place to go after sign-in. Any other address sends the user to the error page. |
| The demo sign-in | `root-components/demo/demo.component.ts:51-73` | Signing in on the demo form sends one POST, `demoLogin` (`api/auth/auth-api.service.ts:53-55`, to the API's `auth/demo` path, `:71`). On success it marks the demo user signed in (`:60`) and navigates **inside the app** to `/spatialadjust` (`:63`). This in-app hop is a history change, not a document load. |

### The entry URL

The only address that boots Spatial Adjust in Demo Mode is `https://<dev host>/spatialadjust/demo`, exactly: no query string and no fragment, because the bootstrap check is on the whole address and `.../spatialadjust/demo?x=1` does not end `/demo`. The dev host lives only in the gitignored `video/capture/capture.local.json`, never in this repository.

### The demo sign-in form

The `/spatialadjust/demo` page is a sign-in form with an email field, a password field and a Sign In button (`root-components/demo/demo.component.html`). It wants the demo account's credentials, not the owner's SSO identity. The director never types them, never stores them and never clicks Sign In: the owner signs in by hand in the director's tab, and the director waits for the in-app hop to `/spatialadjust`. The demo user's sign-in state also decides how much of the toolbar shows: Demo Mode without a demo sign-in hides the site name, the readings and the Push Changes button (`spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts:391-393`, template lines 7, 21 and 33).

### The browser and its profile

The director drives the owner's own Chrome over the DevTools protocol. The owner starts Chrome with `--remote-debugging-port=9222 --user-data-dir=<media root>/auth/chrome-profile` (the director prints the exact command when no Chrome is listening), so the capture profile lives in the media root's private `auth/` folder (mode 0700) and never in the repository. The pipeline writes no storage state, cookie file or session file anywhere; earlier plans that mentioned `<media root>/auth/state.json` are superseded.

## How Demo Mode is lost

Demo Mode lives in memory for one document. Any new document load after the hop boots the app from `/spatialadjust`, an address that does not end `/demo`, so it boots **live**: the app starts the normal sign-in (`common/services/app-initializer.service.ts:50-52`), and in a profile that is also signed in to live IntelliDash it lands on a live course.

Things that load a new document:

- a reload, or any `page.goto`, after the hop;
- signing out in Demo Mode, which sends the window to the site root (`api/auth/auth-manager.service.ts:161-165`);
- following any full-page link.

This is why the director's most important rule is that, after the hop, it never reloads or navigates again, and why it treats any new document as the end of the take.

## Write guards

Every Spatial Adjust write found in the audit, and what stops it in Demo Mode. "Short-circuits" means the method shows the "unsupported in Demo Mode" message (`showUnsupportedMsg`) and returns before any request is built.

### Manager guards

All in `api/spatial-adjust/spatial-adjust-manager.service.ts`. `showUnsupportedMsg` is at `:270-275` (plan :250-254); it only shows an informational message.

| Action | Guard (develop) | Plan line | Behaviour in Demo Mode |
|---|---|---|---|
| Recalculate adjustments | `:114` | :112 | Short-circuits; returns nothing. |
| Update target VWC | `:123` | :121 | Short-circuits; returns nothing. |
| Bulk update target VWC | `:132` | :130 | Short-circuits; returns nothing. |
| Update user percent adjust | `:141` | :139 | Short-circuits; returns nothing. |
| Update auto adjust | `:150` | :148 | Short-circuits; returns nothing. |
| Set entity enabled state | `:159` | :157 | Short-circuits; returns nothing. |
| Update chart selection | `:168` | :166 | Short-circuits; returns nothing. |
| Toggle row selection | `:177` | :175 | Short-circuits; returns success. |
| Update last push date | `:192` | :190 | Short-circuits; returns nothing. |
| Update soil factors | `:217` | :215 | Short-circuits; returns an empty result. |
| Request scan data refresh | `:227` | :225 | Short-circuits; returns an empty result. The toolbar then skips its "request queued" message (`sa-main-toolbar.component.ts:333`). |

Several guards return nothing at all, so a caller that subscribes to the result throws in the page console after the message shows. That is harmless for safety, but a declared demo-mode click on one of them may leave a spinner running in the take.

### Push Changes

Push Changes is the control that writes to Lynx. All lines in `spatial-adjust/components/sa-dashboard/sa-main-toolbar/sa-main-toolbar.component.ts`.

| Step | Where (develop) | Plan line | Behaviour in Demo Mode |
|---|---|---|---|
| Toolbar button | template `:35-36`, handler `:251-253` | — | Opens the confirmation dialog only. Nothing is sent. |
| Confirm | template `:93-98` calls `onPushChanges` at `:255` | :252 | Returns at `:256` if nothing is pending. |
| Demo guard | `:259-262` | :256-259 | Shows the unsupported message and returns before the push starts. |
| The push itself | `:269` calls the push-changes service, which calls the Lynx proxy (`spatial-adjust/services/sa-push-changes.service.ts:208`) and records the push date (`:175`) | :266 | Never reached in Demo Mode. |

The Lynx proxy's push method has no Demo Mode guard of its own (`api/lynx-proxy/lynx-proxy.service.ts:148-150`): the toolbar guard is the only check in the code path. In Demo Mode the proxy never creates its Lynx service (`api/lynx-proxy/lynx-proxy.service.ts:48-51`), so a push that got past the toolbar would throw before sending, but that is an accident, not a guard. For Lynx Cloud courses the push is an MQTT publish over a WebSocket (`api/lynx-cloud/lynx-cloud.service.ts:80-95`), which an HTTP request filter cannot see; for Lynx Drive it is an HTTP POST (`api/lynx-drive/lynx-drive-api.service.ts:48-49`). The director blocks both (see "Director rules").

### Component guards

All under `spatial-adjust/components/`.

| Action | Guard (develop) | Plan line | Behaviour in Demo Mode |
|---|---|---|---|
| Settings dialog: Save | `sa-settings-dlg/sa-settings-dlg.component.ts:186-190` | :122-125 | Shows the unsupported message and returns before any save request is built. This one guard covers the Spatial Adjust settings save, the user preferences save and the Target Profiles upsert (`:482-503`, upsert at `:494`). |
| User preferences: Save | `sa-dashboard/sa-user-preferences-dlg/sa-user-preferences-dlg.component.ts:79-84` | :79-82 | Shows the unsupported message and returns. |
| Over/Under threshold: Save | `sa-dashboard/sa-dash-table/sa-cfg-threshold-dlg/sa-cfg-threshold-dlg.component.ts:71-76` | :70-73 | Shows the unsupported message and returns. |
| Bulk Adjust: Save | `sa-dashboard/sa-dash-table/sa-bulk-adjust-dlg/sa-bulk-adjust-dlg.component.ts:123-127` | :124-127 | Shows the unsupported message and returns. |
| Table card: target VWC edit | `sa-dashboard/sa-dash-table/sa-table-card/sa-table-card.component.ts:119` | :119 | Returns silently before the debounced update. |
| Table card: Enable toggle | `sa-dashboard/sa-dash-table/sa-table-card/sa-table-card.component.ts:490` | :489 | Returns silently before the auto-adjust update. |
| Dashboard: Lynx data | `sa-dashboard/sa-dashboard.component.ts:686` | :665 | **Not a write guard.** Skips waiting for the Lynx connection; the course list then comes from mock data (`api/lynx-proxy/lynx-proxy.service.ts:118-121`). |
| Dashboard: Lynx ping | `sa-dashboard/sa-dashboard.component.ts:731` | :710 | **Not a write guard.** Skips the periodic Lynx ping. |

The plan listed the two dashboard lines as write guards. They are network guards: they keep Demo Mode from talking to Lynx at all, which matters, but they guard reads.

## Correction to ER-1618

ER-1618 says that save, push and threshold actions in Demo Mode route to `demo-mode-mock-data.service.ts`. They do not. Writes are short-circuited where they start: the manager guards and component guards above call `showUnsupportedMsg` and return (for example `api/spatial-adjust/spatial-adjust-manager.service.ts:114-117`, `sa-main-toolbar.component.ts:259-262`, `sa-cfg-threshold-dlg.component.ts:73-76`). Nothing is mocked, nothing is stored and nothing reaches the network.

The mock data service only answers **reads**: its Spatial Adjust getters are at `demo/demo-mode-mock-data.service.ts:1580-1626` (unchanged on `develop`), and its Spatial Adjust data comes from the demo data module it imports at `:79`. The manager's read methods return those getters in Demo Mode (`api/spatial-adjust/spatial-adjust-manager.service.ts:78`, `:85`, `:92`, `:100`, `:108`, `:201`, `:211`, `:249`, `:256`).

## Every Spatial Adjust HTTP write call

The Spatial Adjust module makes its HTTP calls through one API service, `api/spatial-adjust/spatial-adjust-api.service.ts`. A grep of `site/src/app/spatial-adjust/` and `site/src/app/api/spatial-adjust/` for POST, PUT, PATCH and DELETE (the app's `apiRequest` with a write method, and any direct `HttpClient` call) finds these, and no other:

| API call | Method | API line | Manager line | Status in Demo Mode |
|---|---|---|---|---|
| VWC history (a read sent as POST) | POST | `:64` | `:100` | Guarded: answered from mock data. |
| Recalculate adjustments | PUT | `:74` | `:114` | Guarded. |
| Update target VWC | PUT | `:79` | `:123` | Guarded. |
| Bulk update target VWC | PUT | `:91` | `:132` | Guarded. |
| Update user percent adjust | PUT | `:100` | `:141` | Guarded. |
| Update auto adjust | PUT | `:109` | `:150` | Guarded. |
| Set entity enabled state | PUT | `:120` | `:159` | Guarded. |
| Update chart selection | PUT | `:127` | `:168` | Guarded. |
| Toggle row selection | PUT | `:131` | `:177` | Guarded. |
| Update last push date | PUT | `:141` | `:192` | Guarded. |
| **Update course name** | PUT | `:149` | `:206-208` | **Hazard: no Demo Mode guard.** Its only caller (`sa-dashboard/sa-dashboard.component.ts:718-725`) renames a Spatial Adjust course whose name differs from its Lynx course. In Demo Mode the Spatial Adjust course list is empty (`spatial-adjust-manager.service.ts:78`), so today nothing calls it; a change to the demo data would. |
| Update soil factors | PUT | `:157` | `:217` | Guarded. |
| Request scan data refresh | POST | `:163` | `:227` | Guarded. |
| **Upsert Target Profiles** | POST | `:189` | `:261-263` | **Hazard: no Demo Mode guard in the manager.** Its only caller is the settings dialog save, which is guarded at `sa-settings-dlg.component.ts:186-190`, so it is guarded one level up only. |

Writes outside the module that Spatial Adjust screens can reach: the settings dialog also saves site settings and user preferences (`sa-settings-dlg.component.ts:486`, `:490`), both behind the same Save guard, and the dash user manager keeps preference changes in memory in Demo Mode (`api/dash-user/dash-user-manager.service.ts:73-79`). The app-wide feedback form sends without a Demo Mode check (`api/dash-user/dash-user-manager.service.ts:69-71`); its controls match the write guard ("send", "submit") and are never clicked.

Both hazards, and the single-guard push path, are reported to the owner. The director does not depend on any of them being fixed: its request tripwire aborts every write after arming, guarded or not.

## What still talks to the network in Demo Mode

- **The app itself:** scripts, styles, translations and images from the dev host (GET).
- **The demo sign-in:** one POST to the API's `auth/demo` path, before the hop.
- **Map tiles:** the dashboard map is Leaflet with two tile layers, OpenStreetMap (`spatial-adjust/components/sa-dashboard/sa-dash-map/sa-dash-map.component.ts:237-239`) and Google satellite imagery on top (`:247-253`). Both are third-party GETs. In Demo Mode the map is built once (`:97-98`).
- **The announcements widget:** a third-party script injected once a dash user exists (`app.component.ts:212`, `:364-390`). Demo Mode's empty dash user counts, so it loads in Demo Mode. If it ever sends a POST after arming, the take ends with exit 3; list its host under `blockHosts` in `capture.local.json` to stop it loading at all.
- **Diagnostics dialog reads:** the diagnostics dialog calls three reads that have no Demo Mode branch (`spatial-adjust/components/sa-diagnostics-dlg/sa-diagnostics-dlg.component.ts:64-72`, manager `:235-245`), so they go to the real API with the demo session. They are GETs, but an episode should not open that dialog.
- **Not in Demo Mode:** analytics (off at bootstrap), the SignalR notification connection (`app.component.ts:171-176`), the Lynx course list and station data (mock, `api/lynx-proxy/lynx-proxy.service.ts:118-132`), the dash user and its preferences (`api/dash-user/dash-user-manager.service.ts:57-61`).

## What is on screen

- **The demo course name and the names of people** come from the demo data, the module imported at `demo/demo-mode-mock-data.service.ts:79` and the files beside it under `site/src/app/demo/spatial-adjust/`. Its file and class names carry the demo course name. In this repository it is only ever called **the demo course name, see `overlay.local.json`**: `video/capture/overlay.local.json` (gitignored) holds the real-to-fictional pairs and the denylist, and `video/lib/local-maps.mjs` reads it without printing it.
- **Station names, readings and dates** come from the same demo data. The toolbar and table card shift the demo dates forward to today (`sa-main-toolbar.component.ts:153-157`, `sa-table-card.component.ts:219-224`).
- **The map** shows satellite imagery of a real place. It is never shown untreated: the episode's `mapPolicy` (blur, restyle, owned imagery or frame-out) decides, and the treatment is applied at capture time by the course overlay and map routes (PI-ICNT-SW-1079).
- **Site name and toolbar readings** are visible once the demo user has signed in (`sa-main-toolbar.component.ts:391-393`).

## Director rules

The director runs an episode's actions on one page under three independent safety layers. Each layer is enough on its own to stop a write; they are stacked so that a mistake in one is caught by the next.

### Before anything: the browser

- The director connects with `chromium.connectOverCDP` to a loopback endpoint only (`http://127.0.0.1:<port>` or `http://localhost:<port>`); any other host is refused with exit 2.
- It opens **one new page** in the owner's browser context, sets the page's device metrics to 1920x1080 at device scale factor 2 (Emulation.setDeviceMetricsOverride; frames are 3840x2160 and show the page viewport only, no browser chrome), and installs its init scripts, bindings and request routes **on that page only**. The owner's other tabs are never touched.
- At the end it closes only the page it opened, never the owner's browser: the DevTools connection is dropped when the director exits. Ctrl-C ends the take the same way and still writes the safety report.
- `--launch` starts Playwright's own Chromium instead. It is refused unless every allowed host is loopback (the test fixtures). A take from the local recreation (`--source recreation`) always uses it: the recreation is this repository's own guide site, served from `dist/` on loopback by `video/capture/recreation.mjs`, with no Demo Mode and nothing of the owner's to use.
- A recreation episode may set `recreationFigure` to the start of one figure caption on its guide page. After arming, `liftFigure` (`video/capture/recreation.mjs`) adds a stylesheet that lifts that one SpatialAdjustApp figure out of the page to fill the 1920x1080 viewport unscaled, and marks it `data-sa-frame`, so the episode's targets are scoped with `[data-sa-frame] >> ...`. It adds a style element and two attributes and nothing else: no navigation, no click, no request. A caption that matches no figure, or more than one, or a lift that does not fill the viewport exactly, ends the take with exit 1, and the safety report records the figure and its box under `frame`. A Demo Mode episode that sets `recreationFigure` is refused with exit 65: the director never rearranges IntelliDash's page.

### Layer 1: the entry gate

- The only `page.goto` in the director is to the configured entry URL, after `checkEntryUrl` has passed: `https`, a host listed in `allowedHosts`, a path ending `/spatialadjust/demo`, no query, no fragment, no credentials. Plain `http` is accepted only for a loopback host. For `--source recreation` the only accepted host is the local recreation server, `localhost:8124` or `127.0.0.1:8124`.
- The director then waits for the owner to sign in to the demo form and for the in-app hop to `/spatialadjust`.
- **Arming.** The director arms only when the page is still the document it loaded (a sentinel set right after the entry load is still there), that document's boot address was the entry URL, and the address now ends `/spatialadjust`. If that does not happen within the sign-in timeout, the take ends with exit 2.
- **Demo Mode verified** additionally requires that a demo sign-in POST was answered with a success status before the hop. Without it the take continues read-only, and every declared demo-mode click is refused.
- After arming the director never navigates again. `video/capture/director.mjs` has exactly one `page.goto` and no reload at all.

### Layer 2: guarded actions

- Every click is checked in Node by `guardedClick` (`scripts/lib/guarded-click.mjs`, shared with the fidelity harvest) before it reaches the page: the element's accessible name must match the episode action's name and appear in the episode's `allowClicks`; a name matching the write guard `WRITES` (`scripts/lib/writes.mjs`) is refused unless the episode declares it in `demoWriteClicks` **and** Demo Mode was verified at arming; an icon that does not match the expected icon is refused.
- The in-page runtime (`video/capture/director-runtime.js`) checks the element's accessible name and icon again, against the same `WRITES` pattern, immediately before it dispatches the click.
- Targets never reach the page as selectors. The in-page plan names each target by index, the runtime asks the director for it, and the director resolves the selector, checks the element and hands the page that one element. A click target that matches more than one element is refused. Hover and focus targets must carry the action's name too, so a drifted selector cannot even be pointed at.
- A refusal ends the take with exit 6, before anything is dispatched. So does a target that is not on the page within 8 seconds of the step that needs it.
- The episode schema (`video/lib/episode-schema.mjs`) has already rejected any undeclared write-like click before a browser starts.

### Layer 3: the network and navigation tripwire

- Every request from the director's page goes through a page route. After arming, any request whose method is not GET, HEAD or OPTIONS is aborted inside the browser and ends the take with exit 3. The only exception is a POST to a configured SSO host (`authHosts`), for token refresh; Demo Mode does not use one today. Before arming, the demo sign-in POST and SSO-host POSTs are let through and any other write is aborted the same way.
- In-page, the runtime also refuses non-GET `fetch`, `XMLHttpRequest` and `sendBeacon` calls once armed, so a write is stopped before it is even handed to the network.
- A new window is outside the page route's reach, so once armed the runtime refuses `window.open` and any form that would submit into a new window with a method other than GET, and the director closes any popup that opens anyway. Either ends the take with exit 4. A form that submits into the page or one of its frames is left to the route, which aborts a POST with exit 3.
- A JavaScript dialog (alert, confirm, prompt) is dismissed at once. Dismissing a confirm is its Cancel button.
- Every WebSocket on the director's page is closed before it connects to a server (this is what covers the Lynx Cloud MQTT path), and one opened after arming ends the take with exit 3. The page bypasses any service worker so that every request is visible to the route.
- After arming, any main-frame document request is aborted and ends the take with exit 4, and a lost arming sentinel or a new `domcontentloaded` does the same. A new document would boot live.
- Layer 3 applies to declared demo-mode clicks too, so even a mis-detected live session cannot send a write.

### The overlay and the denylist

- After arming the director installs the course overlay (`window.__saOverlayInstall`, PI-ICNT-SW-1079) with the pairs from the local maps and the identity from `video/brand/course.json`, then scans the page against the denylist. For a Demo Mode take the overlay must be present and the denylist must not be empty. The map treatment for the episode's `mapPolicy` (`video/capture/map-routes.mjs`) is installed before the page loads; if it cannot be (for example owned imagery without a licence reference), the take ends with exit 5.
- The page is re-scanned every 15 frames during the take. Hits are reported by denylist index only, never by name.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Take recorded (or dry run printed) |
| 1 | Unexpected error, the plan failed in the page, or it did not finish inside the take (the partial take is deleted) |
| 2 | Entry gate refused, capture config missing or invalid, `--source` does not match the episode, no CDP endpoint or `--launch` refused, or arming did not happen in time (including a new document before arming) |
| 3 | A write request (or WebSocket) was aborted |
| 4 | A new document loaded, or was about to load, after arming, or a new window was opened |
| 5 | Overlay or map treatment incomplete, empty denylist for a Demo Mode take, or denylisted text on screen |
| 6 | A guarded action was refused, or its target was not found in time |
| 64 | Usage error, or the take already exists |
| 65 | The episode file is not a valid episode |

Each run writes `take<N>-safety.json` (`take<N>-recreation-safety.json` for the recreation) under `<media root>/episodes/<id>/capture/raw/`, also when it ends early or with `--no-record`: aborted requests (method, host and path only, never the query string), WebSockets, document loads, popups, dialogs, refusals, in-page trips, denylist scan counts and hit indices, the overlay's counts, the lifted figure for a recreation (`frame`), the exit code and its reason. A recorded take also writes `take<N>-log.json` (cue times), `take<N>-track.json` (cursor, ripple and focus box per frame, and click times) and `take<N>_sheet.jpg` (contact sheet). An existing take is never overwritten.

## Residual risks

- **One guard on the push path.** Push Changes is stopped in Demo Mode by one component guard (`sa-main-toolbar.component.ts:259-262`); the proxy below it has none. The director's layers 2 and 3 do not depend on it.
- **Two unguarded manager writes.** Update course name and Upsert Target Profiles have no Demo Mode guard in the manager (see the table above). Neither is reachable from a Demo Mode screen today. Layer 3 aborts them if that changes.
- **Channels a page route cannot see.** Requests made by a dedicated web worker, or by a browser extension in the owner's profile, may not pass the page route. IntelliDash registers no service worker and starts no web worker for Spatial Adjust today. Use a capture profile with no extensions.
- **The owner's profile may also be signed in to live IntelliDash.** That is exactly what makes a reload after the hop dangerous. Layer 3 aborts the reload's document request before it reaches the server.
- **A third-party script can end a take.** The announcements widget or a tile provider sending a POST after arming ends the take with exit 3. That fails closed: the take is lost, nothing is written.
- **Demo data and source drift.** The demo course data, the toolbar layout and every line number above can change with `develop`. Re-run this audit when `develop` moves before a capture session, and update the tables.
- **Recreation footage is not Demo Mode footage.** Takes from the local recreation are named `take<N>-recreation.mp4` and the episode declares `source: recreation`, so they can never be passed off as captured from IntelliDash.
