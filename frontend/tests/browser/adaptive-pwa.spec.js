import { test, expect } from '@playwright/test';
import { syntheticApp } from './app-fixture.js';

test.beforeEach(async ({ page, baseURL }) => {
  // Never send fixture identifiers, image requests or fonts to external hosts.
  await page.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  page.on('pageerror', error => { throw error; });
});

// These are SIMULATED API reports, not native folding-device emulation.
const book = [{ x: 0, y: 0, width: 450, height: 620 }, { x: 478, y: 0, width: 473, height: 620 }];
async function simulateSegments(page, segments) {
  await page.addInitScript(segments => {
    const posture = new EventTarget();
    posture.type = 'folded';
    Object.defineProperty(navigator, 'devicePosture', { configurable: true, value: posture });
    Object.defineProperty(window, 'viewport', { configurable: true, value: { segments: segments.map(s => new DOMRect(s.x, s.y, s.width, s.height)) } });
  }, segments);
}
async function updateSegments(page, segments, event = 'change', posture = 'folded') {
  await page.evaluate(({ segments, event, posture }) => {
    window.viewport.segments = segments.map(s => new DOMRect(s.x, s.y, s.width, s.height));
    navigator.devicePosture.type = posture;
    (event === 'change' ? navigator.devicePosture : window).dispatchEvent(new Event(event));
  }, { segments, event, posture });
}
async function insideSegment(locator, segment) {
  // resize/posture dispatch and React's render are asynchronous in both engines.
  await expect(async () => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(segment.x);
    expect(box.y).toBeGreaterThanOrEqual(segment.y);
    expect(box.x + box.width).toBeLessThanOrEqual(segment.x + segment.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(segment.y + segment.height + 1);
  }).toPass({ timeout: 5000 });
}

test('touch navigation adapts to available width with safe edges, preserving collection selection', async ({ page }, testInfo) => {
  await syntheticApp(page);
  await page.setViewportSize({ width: 951, height: 585 });
  await page.goto('/');
  await expect(page.locator('[data-collection-entry-id="synthetic-entry"]')).toBeVisible();
  await expect(page.locator('.nav-tabs')).toHaveCSS('position', 'fixed');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.locator('[data-collection-entry-id="synthetic-entry"]').click();
  await expect(page.locator('.coll-check.on')).toHaveCount(1);
  await page.evaluate(() => {
    for (const [key, value] of Object.entries({ '--sat': '24px', '--sar': '28px', '--sab': '20px', '--sal': '22px' })) document.documentElement.style.setProperty(key, value);
  });
  for (const [width, height] of [...safariSizes, [382, 280], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.nav-tab.active')).toHaveText('Collection');
    await expect(page.locator('.coll-check.on')).toHaveCount(1);
    for (const button of await page.locator('.nav-tab').all()) {
      await insideSegment(button, { x: 22, y: 24, width: width - 50, height: height - 44 });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('synthetic-collection-desktop.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('[data-collection-entry-id="synthetic-entry"]').click();
  await expect(page.locator('.card-inspector')).toBeVisible();
  await page.setViewportSize({ width: 382, height: 580 });
  await expect(page.locator('.ci-info-col h3')).toHaveText('Synthetic Test Card');
  await page.screenshot({ path: testInfo.outputPath('synthetic-collection-inspector.png') });
});

test('split inspector in the real app clears safe areas and covers navigation', async ({ page }, testInfo) => {
  await syntheticApp(page);
  await page.setViewportSize({ width: 951, height: 620 });
  await simulateSegments(page, book);
  await page.goto('/');
  await page.locator('[data-collection-entry-id="synthetic-entry"]').click();
  await page.locator('.zoom-action-edit').click();
  await expect(page.locator('.ci-edit-form')).toBeVisible();
  expect(await page.evaluate(() => document.elementFromPoint(20, innerHeight - 10)?.closest('.ci-overlay') !== null)).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '125%';
    for (const [key, value] of Object.entries({ '--sat': '24px', '--sar': '28px', '--sab': '20px', '--sal': '22px' })) document.documentElement.style.setProperty(key, value);
  });
  await insideSegment(page.locator('.modal-close'), { x: 478, y: 24, width: 445, height: 576 });
  for (const pane of await page.locator('.ci-image-col, .ci-info-col').all()) {
    const insets = await pane.evaluate(el => { const s = getComputedStyle(el); return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat); });
    expect(insets[0]).toBeGreaterThanOrEqual(24);
    expect(insets[1]).toBeGreaterThanOrEqual(28);
    expect(insets[2]).toBeGreaterThanOrEqual(20);
    expect(insets[3]).toBeGreaterThanOrEqual(22);
    expect(await pane.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.getByRole('button', { name: 'Save Changes' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('simulated-book-safe-areas-large-text.png') });
});

test('PWA keeps its install contract without disabling page zoom or adding an offline worker', async ({ page }) => {
  await syntheticApp(page);
  await page.goto('/');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1(?:\.0)?(?:,|$)/);
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', orientation: 'any' });
  expect(manifest.icons).toHaveLength(9);
  for (const icon of manifest.icons) {
    const decoded = await page.evaluate(async icon => {
      const img = new Image();
      img.src = icon.src;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, icon);
    expect(decoded).toBe(icon.sizes);
    const asset = await page.request.get(icon.src);
    expect(asset.headers()['content-type']).toContain('image/png');
  }
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});

test('inspector touch fields stay readable without focus zoom and have 44px targets', async ({ page }) => {
  await page.setViewportSize({ width: 382, height: 580 });
  await page.goto('/tests/browser/inspector.html');
  const fields = page.locator('.ci-edit-form input, .ci-edit-form select, .ci-foil-chip');
  await expect(fields).toHaveCount(4);
  for (const field of await fields.all()) {
    expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
});

// Characterization: these existing screens keep their current responsive layout.
test('decks, lists and settings remain reachable without horizontal overflow', async ({ page }, testInfo) => {
  await syntheticApp(page);
  await page.setViewportSize({ width: 382, height: 580 });
  await page.goto('/');
  await expect(page.locator('[data-collection-entry-id="synthetic-entry"]')).toBeVisible();
  for (const screen of ['decks', 'lists', 'settings']) {
    if (screen === 'settings') await page.getByRole('button', { name: 'Settings', exact: true }).click();
    else await page.locator('.nav-tab').nth(screen === 'decks' ? 3 : 4).click();
    await expect(page.getByRole('heading', { name: { decks: 'Decks', lists: 'Lists', settings: 'Account Settings' }[screen], exact: true })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Something went wrong');
    for (const [width, height] of [[382, 580], [594, 368], [669, 867], [951, 585], [385, 571], [382, 280], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await expect(async () => {
        const box = await page.locator('main').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
        expect(box.scroll, `${screen} at ${width}x${height}`).toBeLessThanOrEqual(box.width + 1);
      }).toPass({ timeout: 5000 });
    }
    await page.setViewportSize({ width: 382, height: 580 });
    await page.screenshot({ path: testInfo.outputPath(`synthetic-${screen}.png`) });
  }
});

const safariSizes = [
  [382, 580], [382, 618], [594, 368], [594, 406],
  [669, 867], [669, 902], [951, 585], [951, 620], [385, 571], [385, 609],
];

test('flags-off inspector uses available width and stays inside four safe edges on resize', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 669, height: 867 });
  await page.goto('/tests/browser/inspector.html');
  const quantity = page.locator('.ci-edit-form input').first();
  await quantity.fill('9');
  expect((await page.locator('.card-inspector').boundingBox()).width).toBeGreaterThan(580);
  // Simulate nonzero native insets; engine emulation has no physical notch.
  await page.evaluate(() => {
    for (const [key, value] of Object.entries({ '--sat': '24px', '--sar': '28px', '--sab': '20px', '--sal': '22px' })) document.documentElement.style.setProperty(key, value);
  });
  for (const [width, height] of [...safariSizes, [382, 280], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.ci-overlay')).not.toHaveAttribute('data-segments');
    await insideSegment(page.locator('.card-inspector'), { x: 22, y: 24, width: width - 50, height: height - 44 });
    await expect(quantity).toHaveValue('9');
    const close = await page.locator('.modal-close').boundingBox();
    expect(close.width).toBeGreaterThanOrEqual(44);
    expect(close.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Save Changes' }).scrollIntoViewIfNeeded();
    await insideSegment(page.getByRole('button', { name: 'Save Changes' }), { x: 22, y: 24, width: width - 50, height: height - 44 });
    const overflow = await page.locator('.card-inspector').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, offenders: [...el.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > el.getBoundingClientRect().right).map(e => ({ tag: e.tagName, class: e.className, width: e.getBoundingClientRect().width })) }));
    expect(overflow.scroll, JSON.stringify({ width, height, overflow })).toBeLessThanOrEqual(overflow.width + 1);
  }
  await page.screenshot({ path: testInfo.outputPath('flags-off-desktop-editor.png') });
});

test('simulated book segments keep inspector image and editable details clear of the fold', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 951, height: 620 });
  await simulateSegments(page, book);
  await page.goto('/tests/browser/inspector.html');
  await expect(page.locator('.ci-edit-form')).toBeVisible();
  await insideSegment(page.locator('.ci-image-col'), book[0]);
  await insideSegment(page.locator('.ci-info-col'), book[1]);
  await insideSegment(page.locator('.modal-close'), book[1]);
  const quantity = page.locator('.ci-edit-form input').first();
  await quantity.fill('7');
  await expect(quantity).toHaveValue('7');
  await page.screenshot({ path: testInfo.outputPath('simulated-book.png') });
});

test('simulated fold and rotation events preserve the same unsaved editor', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 951, height: 620 });
  await simulateSegments(page, []);
  await page.goto('/tests/browser/inspector.html');
  const quantity = page.locator('.ci-edit-form input').first();
  await quantity.fill('7');
  const input = await quantity.elementHandle();
  await updateSegments(page, book);
  await expect(page.locator('.ci-overlay')).toHaveAttribute('data-segments', 'horizontal');
  await insideSegment(page.locator('.ci-info-col'), book[1]);
  await page.setViewportSize({ width: 669, height: 902 });
  const laptop = [{ x: 0, y: 0, width: 669, height: 430 }, { x: 0, y: 450, width: 669, height: 452 }];
  await updateSegments(page, laptop, 'resize');
  await expect(page.locator('.ci-overlay')).toHaveAttribute('data-segments', 'vertical');
  await insideSegment(page.locator('.ci-image-col'), laptop[0]);
  await insideSegment(page.locator('.ci-info-col'), laptop[1]);
  await insideSegment(page.locator('.modal-close'), laptop[1]);
  await expect(quantity).toHaveValue('7');
  expect(await input.evaluate(el => el === document.querySelector('.ci-edit-form input'))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('simulated-laptop.png') });
  // continuous means fully OPEN as well as fully closed, not "small phone".
  await updateSegments(page, [], 'change', 'continuous');
  await expect(page.locator('.ci-overlay')).not.toHaveAttribute('data-segments');
  await expect(quantity).toHaveValue('7');
  await page.locator('.modal-close').click();
  await expect(page.locator('body')).toHaveAttribute('data-closed', 'true');
});

test('simulated keyboard visual viewport suspends stale segments without losing edits', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 951, height: 620 });
  await simulateSegments(page, book);
  await page.addInitScript(() => {
    const visible = Object.assign(new EventTarget(), { width: 951, height: 620, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visible });
  });
  await page.goto('/tests/browser/inspector.html');
  const quantity = page.locator('.ci-edit-form input').first();
  await quantity.fill('8');
  await page.evaluate(() => {
    Object.assign(visualViewport, { height: 260, offsetTop: 50 });
    visualViewport.dispatchEvent(new Event('resize'));
    visualViewport.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('.ci-overlay')).not.toHaveAttribute('data-segments');
  await insideSegment(page.locator('.card-inspector'), { x: 0, y: 50, width: 951, height: 260 });
  await expect(quantity).toHaveValue('8');
  const save = page.getByRole('button', { name: 'Save Changes' });
  await save.scrollIntoViewIfNeeded();
  await insideSegment(save, { x: 0, y: 50, width: 951, height: 260 });
  await page.screenshot({ path: testInfo.outputPath('simulated-keyboard.png') });
  await page.evaluate(() => {
    Object.assign(visualViewport, { height: 620, offsetTop: 0 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.ci-overlay')).toHaveAttribute('data-segments', 'horizontal');
  await expect(quantity).toHaveValue('8');
});
