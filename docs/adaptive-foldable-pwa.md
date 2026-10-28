# Adaptive and fold-aware PWA layout

## Platform support and limits

Safari 27.1 on iPhone Duo exposes **Device Posture API** and **Viewport Segments API** as developer previews **behind feature flags**. Enable both under **Settings → Apps → Safari → Advanced → Feature Flags** for device testing. They are not a prerequisite for using Scrybox.[1]

Safari 27.2's release notes do not announce these APIs becoming unflagged. Treat them as optional enhancements, not a generally available device integration.[2]

`navigator.devicePosture.type` is `folded` for a partially folded book/laptop pose and `continuous` for **both fully open and fully closed** displays. It is not an open/closed detector. Geometry is provided by **`window.viewport.segments`**, an array of DOMRects, and should be reread on posture `change` and window `resize`.[1]

Safari's reserved system/Safari-control column is not web-content space. The existing `viewport-fit=cover` is retained for safe-area handling, **not** as a way to draw controls underneath that column. No guessed status-column offsets, user-agent checks or device-model detection are used.[1]

## Implementation

- `src/utils/phoneLayout.js` and the matching CSS queries choose compact navigation by available width and pointer type. Touch navigation now stays compact until the existing 1024px desktop-sidebar breakpoint. This is a **content breakpoint**, not a fold detector. The former guessed Duo dimensions have been removed from comments.
- `src/utils/viewportLayout.js` feature-detects the Segments API, normalizes the segment order and validates geometry. Exactly two aligned, nonoverlapping rectangles within the layout viewport are supported. Each needs at least 260px width and 200px height; these are conservative content minima. Missing, malformed, unsupported or stale reports select the normal responsive sheet instead.
- `CardInspectorModal` uses the **same image, details, form elements and React state** before and after transitions. No resize-triggered navigation, reload or component key changes. Book geometry places artwork and details in separate side-by-side segments; laptop geometry stacks them in the reported segments. The rest of the app still uses the whole available viewport.
- Both panes scroll independently. The fold/gap is not used for interactive content. The close button stays in the details segment. Four-edge safe-area insets also honor the app's existing Capacitor `--sat/--sar/--sab/--sal` fallback values.
- Device Posture is used as an optional **change notification** to reread geometry, not as a gate on `type`: two actual segments can be useful even when the posture API is absent or reports `continuous`. Window resize is always observed. All listeners are removed on unmount, including React StrictMode cleanup.
- CSS receives the validated DOMRect coordinates as custom properties. We intentionally have one geometry path rather than an additional CSS-only split that could bypass validation. The platform also offers `horizontal-viewport-segments` / `vertical-viewport-segments` media queries and indexed `env(viewport-segment-*)` values (column, then row), should other surfaces need them later.[1]
- `visualViewport` is used **only for visible bounds**, never for `.segments`. A keyboard-sized visual viewport temporarily returns to one scrollable sheet; resize/scroll updates keep that sheet inside visible bounds. Native pinch-zoom panning is left to the browser and disables the split. Dynamic viewport height is the CSS fallback when Visual Viewport is absent.
- With flags off, narrow screens get a scrollable single-column inspector; at 640px there is room for artwork alongside editable details. Form controls remain shrinkable, at least 44px tall and at least 16px text. Page zoom is no longer disabled by the viewport meta tag.

No authentication, persistence, manifest, offline caching or service-worker changes are part of this feature. Network access is still required. This is not an offline-PWA implementation.

## Automated verification

```sh
npm ci --prefix frontend
npm ci --prefix backend
cd frontend
npx playwright install webkit chromium
npm test
npm run lint
npm run build
npm run test:browser
# Optional isolated port / evidence folder:
PWA_TEST_PORT=4317 PWA_TEST_OUTPUT="$TMPDIR/scrybox-browser-results" npm run test:browser
```

The browser runner builds the real application plus a synthetic inspector harness into a unique temporary directory, then serves it on loopback. It refuses to reuse an existing server. It has **no API proxy or backend connection**. Browser-only synthetic API fixtures are read-only and external browser requests are blocked. No real login, user credentials or collection database is used. The production bundle has no test-harness entry point.

The build-based runner is deliberate: the existing frontend imports a CommonJS shared query parser, which Vite's production bundler handles but the plain dev server does not. It tests real bundled code rather than mocking that parser.

### Matrix

The following sizes come from Apple's **Safari tab** table, not measured standalone/Home Screen windows. Both its small and large viewport heights are exercised. Do not present these as standalone PWA dimensions.[1]

| Safari view | CSS width | Small height | Large height |
| --- | ---: | ---: | ---: |
| Outer portrait | 382 | 580 | 618 |
| Outer landscape | 594 | 368 | 406 |
| Inner portrait | 669 | 867 | 902 |
| Inner landscape | 951 | 585 | 620 |
| Inner split window | 385 | 571 | 609 |

Additional representative tests use a 382×280 short window and a 1280×800 desktop window. Browser projects explicitly run **WebKit and Chromium**, not merely an iPhone-named Chromium preset.

Coverage includes:
- Same-page resize preserving collection selection, current tab, inspector card and unsaved quantity.
- Flags-off inspector geometry, four nonzero simulated safe edges, horizontal overflow, reachable Save and close controls, editable control dimensions.
- Explicitly **simulated** book/laptop DOMRects (including unequal widths and a gap), posture and resize events, return to continuous, and keyboard-like Visual Viewport resize/scroll.
- Split-pane safe areas with enlarged text, and ordinary deck/list/settings screen geometry using empty synthetic data.
- Manifest route/MIME, identity, start URL, scope, standalone display and no orientation lock; all declared icons fetched/decoded; no registered service worker.
- Node unit coverage for malformed/out-of-bounds/overlapping/small/missing reports, optional APIs, event cleanup and native zoom fallback.

Feature tests were run failing before implementation. Tests added to protect already-working state/other screens are explicitly characterization coverage, not claimed RED examples. Logs and screenshots from the implementation run are listed in `adaptive-foldable-pwa-verification.md`.

## Required real-device acceptance (not established by browser tests)

1. Install from Safari using Add to Home Screen, sign in to a **test account**, and verify browser and standalone modes separately with flags off.
2. On iPhone Duo, enable the two feature flags; confirm API availability separately in browser and standalone mode. Record actual `innerWidth/innerHeight`, `visualViewport` bounds, posture and segment rectangles.
3. While selecting collection cards and editing an inspector, close/open, partially fold, rotate and enter/exit a split window. Confirm the selected card, unsaved fields and current tab remain intact.
4. Test book and laptop poses, keyboard opening/closing, native pinch zoom, larger accessibility text, safe edges and system-control-column boundaries. Verify scrolling, Save, Cancel and Close remain reachable.
5. Repeat with flags disabled. The API-free layout must remain usable, without synthetic segment overrides.

A Playwright WebKit pass is browser-engine evidence, **not** proof of native iPhone Duo hardware behavior, Xcode simulator behavior, Home Screen installation or cross-display handoff. Live scanner/camera behavior and populated deck/list editing were not changed or fully exercised by this work.

## Sources

[1] https://webkit.org/blog/18486/webkit-features-for-safari-27-1
[2] https://webkit.org/blog/18515/webkit-features-for-safari-27-2
