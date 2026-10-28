# Adaptive PWA verification record

Implementation checkout: `/Users/thomaslorenz/projects/scrybox`, branch `feat/adaptive-foldable-pwa`, base `d239113`. No production-checkout changes, push or deployment were performed.

Run environment: macOS 27.0.1, Node v26.12.1, npm 11.20.0, Playwright 1.64.1. Launched engines reported WebKit **27.2** and Chromium **156.0.8078.4**. Final verification completed 2026-10-28 UTC. Browser-engine versions are not evidence of iPhone hardware support or installed-PWA behavior.

## Results

| Command | Observed result | Evidence log |
| --- | --- | --- |
| `npm test --prefix frontend` | **244 passed**, 0 failed; locale validation passed | `final-frontend-tests.log` |
| `npm run test:browser --prefix frontend` | **18 passed**: 9 WebKit, 9 Chromium | `final-browser.log` |
| `npm run lint --prefix frontend` | Exit 0, no warnings/errors | `final-lint.log` |
| `npm run build --prefix frontend` | Exit 0, production `frontend/dist` generated | `final-build.log` |
| `cd backend && node test/e2e/run.js` | **14/14 suites**, **79/79 cases** passed | `backend-e2e.log` |
| Root `npm test` | **Not green**: backend unit runner reports 63/64 files accepted, including two sidecar-only skips; stops before frontend/E2E | `all-tests.log` |
| Pristine `d239113` reproduction of the failing backend test | Same failure, exit 1 | `baseline-rawquerylocal.log` |
| `git diff --check` | Exit 0 | Verified locally |

The existing `backend/test/rawquerylocal.test.js:126` compares two asynchronous `jsMatches()` return values using `deepStrictEqual` **without awaiting them**. Under this Node version, that fails while both promises contain the same card names. Reproduced from a pristine archive of the base commit. Backend/shared source was not modified. Other suites were run separately so this unrelated failure did not hide frontend or API E2E coverage.

The two sidecar-only skips require a Scryfall sidecar at `127.0.0.1:8420`; none was started. Browser tests use a frontend-only loopback server with synthetic fixtures, no API proxy/database, no real credentials, no writes and blocked external browser requests.

`npm audit` reports **19** frontend vulnerabilities (2 moderate, 13 high, 4 critical). A pristine-base lockfile audit has the same counts and affected package names; no new affected packages were introduced. Dependency remediation is outside this layout change.

## TDD evidence

These targeted tests failed before their corresponding implementation, then passed:

| Slice | RED log | Initial failure |
| --- | --- | --- |
| Reported book segment geometry | `red-book.log` | Image pane extended across the first segment boundary |
| Posture/rotation with unsaved state | `red-events.log` | Posture change did not activate the split |
| Invalid/stale/small report fallback | `red-validation.log` | Negative/out-of-bounds geometry was accepted |
| Responsive sheet width/safe bounds | `red-fallback.log` | 669px viewport still restricted the sheet to 440px |
| Keyboard visible bounds | `red-keyboard.log` | Keyboard-like resize left stale segments active |
| Wide-touch navigation | `red-navigation.log` | 951px touch viewport used static navigation |
| Split-pane safe edges | `red-split-safe.log` | Close control intruded into simulated top inset |
| Page zoom | `red-zoom.log` | HTML explicitly disabled zoom |
| Editable touch fields | `red-fields.log` | Field text was below 16px |

Corresponding `green-*.log` files and final reruns are retained. Already-passing state preservation, optional-API/event-cleanup checks and other-screen layouts are labeled characterization tests. Two issues exposed during iteration were fixed: a retained outer-modal scroll offset in Chromium (use a non-scrollable clipping box), and intrinsic form-control widths overflowing the narrow sheet.

## Evidence artifacts

Unpacked working evidence:

`/Users/thomaslorenz/.hermes/profiles/thomas/cache/scratch/scrybox-fold-evidence/`

Durable local archive (ignored by Git; **not** included in the commit):

`/Users/thomaslorenz/projects/scrybox/logs/adaptive-foldable-pwa-evidence.tar.gz`

SHA-256:

```text
b5cca3a714888b7cbbd7c973b3df7d8e75f262eab8269dd3ce27494992557e98
```

The archive contains RED/GREEN/final logs, failed-test traces, audit comparisons, engine-version output and synthetic screenshots. Final screenshots are under `scrybox-fold-evidence/final-browser/`, including `simulated-book.png`, `simulated-laptop.png`, `simulated-keyboard.png`, `simulated-book-safe-areas-large-text.png`, collection/inspector views and deck/list/settings views. Final WebKit book/keyboard screenshots and earlier laptop/narrow-inspector screenshots were visually inspected; browser tests also assert geometry and state, not merely screenshots. The production `dist` was checked for test-harness paths and synthetic fixture identifiers: none were present.

## Parent verification and review follow-up

After the initial implementation, the parent independently reran the frontend suite (244 passed), browser suite (18 passed), lint, and backend E2E (14 suites / 79 cases passed). A read-only independent review then reproduced a blocker: native zoomed panning could trigger the existing swipe-to-close recognizer and lose unsaved edits.

The gesture fix bypasses swipe navigation while zoomed, cancels an active swipe when a second finger/zoom begins, and treats `touchcancel` as cancellation rather than committing navigation. Native page zoom remains enabled. A new `swipe-zoom.spec.js` covers these paths and preserves normal unzoomed swipe-to-close.

- RED: all five Chromium gesture tests failed before the fix (including trusted CDP touch input at native page scale 2); the initial WebKit attempt hit its unsupported Touch constructor, which was corrected to explicitly synthetic event reports. Constructor errors are not counted as behavioral RED evidence.
- Final browser run: **27 passed / 1 expected skip**. The CDP-only native-scale test is skipped in WebKit; four synthetic gesture tests pass in each engine.
- Final frontend unit run: **244 passed**, no failures; locale validation passed. Lint and production build exit 0. Backend/shared code remains unchanged.
- Parent inspected a real iOS 27.1 iPhone Duo Simulator screenshot of the synthetic inspector in Safari on the inner landscape display. This is a rendering smoke check, not a full application or fold-handoff acceptance pass. Device Hub was not accessible through the computer-control capture backend, so further interaction and Home Screen installation were not established. The loopback fixture server was stopped.
- Parent follow-up logs: `scrybox-zoom-red.log`, `scrybox-final-browser.log`, `scrybox-final-unit.log`, `scrybox-final-build.log`, and `scrybox-parent-backend-e2e.log` under the active Hermes profile's scratch directory. Follow-up evidence is also archived separately in ignored `logs/adaptive-foldable-pwa-review-evidence.tar.gz`.

## Acceptance limits

- All posture/segment and keyboard reports are **explicit mocks** exercising real app code in actual browser engines. They do not emulate hardware or an actual software keyboard.
- Real Duo fold/unfold handoff, Safari feature-flag activation, Xcode/device-simulator behavior, physical safe areas, pinch gestures and Home Screen installation are **not established** by this run.
- Apple's listed dimensions are Safari-tab CSS sizes; standalone sizes remain unmeasured.
- Only the card inspector has a dedicated fold-segment layout. Scanner/camera capture, populated deck/list editors and all accessibility modes were not fully exercised.
- No offline worker/cache or authentication behavior was added or changed. Nothing was pushed or deployed.

See [the implementation guide](adaptive-foldable-pwa.md) for official WebKit sources, design boundaries, repeatable commands and the real-device acceptance checklist.
