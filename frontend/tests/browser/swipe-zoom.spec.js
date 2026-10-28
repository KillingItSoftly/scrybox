import { test, expect } from '@playwright/test';

// Synthetic touch events exercise the app gesture recognizer in both engines;
// native Chromium page scaling is covered separately below.
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.setViewportSize({ width: 382, height: 580 });
  await page.goto('/tests/browser/inspector.html');
  await page.locator('.ci-edit-form input').first().fill('9');
});

async function touch(page, type, xs) {
  return page.evaluate(({ type, xs }) => {
    const target = document.querySelector('.ci-info-col h3');
    const touches = xs.map((clientX, identifier) => ({ identifier, target, clientX, clientY: 150 }));
    // WebKit exposes Touch but does not allow constructing it. These are
    // explicitly synthetic event reports; the separate CDP test is trusted input.
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(e, {
      touches: { value: touches }, targetTouches: { value: touches }, changedTouches: { value: touches },
    });
    target.dispatchEvent(e);
    return e.defaultPrevented;
  }, { type, xs });
}
async function zoom(page, scale) {
  await page.evaluate(scale => {
    Object.defineProperty(window.visualViewport, 'scale', { configurable: true, value: scale });
    window.visualViewport.dispatchEvent(new Event('resize'));
  }, scale);
}
async function intact(page) {
  await expect(page.locator('body')).not.toHaveAttribute('data-closed', 'true');
  await expect(page.locator('.ci-edit-form input').first()).toHaveValue('9');
  await expect(page.locator('.ci-overlay')).not.toHaveClass(/swipe-back-card/);
}

test('zoomed panning does not prevent native touch moves or dismiss unsaved inspector', async ({ page }) => {
  await zoom(page, 2);
  await touch(page, 'touchstart', [60]);
  expect(await touch(page, 'touchmove', [90])).toBe(false);
  expect(await touch(page, 'touchmove', [300])).toBe(false);
  await touch(page, 'touchend', []);
  await intact(page);
});

test('adding a second finger cancels an active swipe without closing the editor', async ({ page }) => {
  await touch(page, 'touchstart', [60]);
  await touch(page, 'touchmove', [90]);
  await touch(page, 'touchmove', [180]);
  await expect(page.locator('.ci-overlay')).toHaveClass(/swipe-back-card/);
  await touch(page, 'touchstart', [180, 220]);
  expect(await touch(page, 'touchmove', [190, 240])).toBe(false);
  await touch(page, 'touchend', [190]);
  await touch(page, 'touchend', []);
  await intact(page);
});

test('zoom beginning during an active swipe clears the transform without losing edits', async ({ page }) => {
  await touch(page, 'touchstart', [60]);
  await touch(page, 'touchmove', [90]);
  await touch(page, 'touchmove', [180]);
  await zoom(page, 2);
  await intact(page);
  expect(await touch(page, 'touchmove', [300])).toBe(false);
  await touch(page, 'touchend', []);
  await intact(page);
});

test('cancelled touch never commits back navigation, normal unzoomed swipe still does', async ({ page }) => {
  await touch(page, 'touchstart', [60]);
  await touch(page, 'touchmove', [90]);
  await touch(page, 'touchmove', [330]);
  await touch(page, 'touchcancel', []);
  await intact(page);
  await touch(page, 'touchstart', [60]);
  await touch(page, 'touchmove', [90]);
  await touch(page, 'touchmove', [330]);
  await touch(page, 'touchend', []);
  await expect(page.locator('body')).toHaveAttribute('data-closed', 'true');
});

test('native Chromium zoom and trusted pan preserve unsaved editor', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP page-scale emulation is Chromium-only, not iOS pinch acceptance');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(2);
  await page.evaluate(() => {
    window.preventedMoves = 0;
    document.addEventListener('touchmove', e => { if (e.defaultPrevented) window.preventedMoves++; });
  });
  for (const [type, x] of [['touchStart', 60], ['touchMove', 90], ['touchMove', 180], ['touchMove', 300], ['touchEnd', null]]) {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === null ? [] : [{ x, y: 200 }] });
  }
  expect(await page.evaluate(() => window.preventedMoves)).toBe(0);
  await intact(page);
  await cdp.detach();
});
