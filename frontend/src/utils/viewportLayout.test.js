import test from 'node:test';
import assert from 'node:assert/strict';
import { readViewportLayout, readVisualBounds, observeViewportLayout, segmentStyles } from './viewportLayout.js';

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const book = [rect(0, 0, 450, 620), rect(478, 0, 473, 620)];
const win = segments => ({ innerWidth: 951, innerHeight: 620, viewport: { segments } });

test('invalid, stale or unreadably small segments never activate a split inspector', () => {
  for (const segments of [
    [rect(-20, 0, 470, 620), book[1]],
    [book[0], rect(478, 0, 500, 620)],
    [rect(0, 0, 100, 620), book[1]],
    [rect(0, 0, 450, 100), rect(478, 0, 473, 100)],
    [rect(0, 0, 450, Infinity), rect(478, 0, 473, Infinity)],
    [null, book[1]],
    [book[0], { ...book[1], right: NaN }],
    [book[0], rect(400, 0, 551, 620)],
    [book[0], rect(478, 1, 473, 619)],
    [], [book[0]], [...book, book[0]], undefined,
  ]) assert.equal(readViewportLayout(win(segments)), null, JSON.stringify(segments));
  assert.equal(readViewportLayout(null), null);
  assert.equal(readViewportLayout({ innerWidth: 951, innerHeight: 620, navigator: { devicePosture: { type: 'folded' } } }), null);
  assert.equal(readViewportLayout({ innerWidth: 951, innerHeight: 620, visualViewport: { segments: book } }), null);
});

// Characterization of the browser-tested keyboard handling.
test('visual bounds follow the keyboard but leave native pinch panning alone', () => {
  const viewport = { width: 951, height: 260, offsetTop: 50, offsetLeft: 0, scale: 1 };
  const target = { ...win(book), visualViewport: viewport };
  assert.equal(readViewportLayout(target), null);
  assert.deepEqual(readVisualBounds(target), { width: 951, height: 260, top: 50, left: 0 });
  viewport.scale = 2;
  assert.equal(readVisualBounds(target), null);
  assert.equal(readViewportLayout(target), null);
  assert.equal(readVisualBounds(null), null);
  assert.equal(readVisualBounds(win(book)), null);
});

// Characterization of the browser-tested slice: API order and optional posture.
test('uses reported geometry, not posture or segment array order', () => {
  assert.equal(readViewportLayout(win([...book].reverse())).segments[0], book[0]);
  assert.equal(readViewportLayout({ ...win(book), navigator: { devicePosture: { type: 'continuous' } } }).axis, 'horizontal');
  const laptop = [rect(0, 0, 669, 280), rect(0, 300, 669, 320)];
  assert.equal(readViewportLayout(win(laptop)).axis, 'vertical');
  assert.equal(segmentStyles(readViewportLayout(win(book)))['--segment-1-left'], '478px');
  assert.equal(segmentStyles(null), undefined);
});

test('observer rereads reports and removes all listeners when disposed', () => {
  const target = Object.assign(new EventTarget(), win(book));
  target.navigator = { devicePosture: new EventTarget() };
  target.visualViewport = Object.assign(new EventTarget(), { width: 951, height: 620, offsetTop: 0, offsetLeft: 0, scale: 1 });
  const seen = [];
  const dispose = observeViewportLayout(target, value => seen.push(value));
  assert.equal(seen.length, 1);
  target.viewport.segments = [];
  target.navigator.devicePosture.dispatchEvent(new Event('change'));
  assert.equal(seen.at(-1), null);
  target.viewport.segments = book;
  target.dispatchEvent(new Event('resize'));
  assert.equal(seen.at(-1).axis, 'horizontal');
  target.visualViewport.dispatchEvent(new Event('resize'));
  target.visualViewport.dispatchEvent(new Event('scroll'));
  assert.equal(seen.length, 5);
  dispose();
  target.visualViewport.dispatchEvent(new Event('resize'));
  target.visualViewport.dispatchEvent(new Event('scroll'));
  target.dispatchEvent(new Event('resize'));
  target.navigator.devicePosture.dispatchEvent(new Event('change'));
  assert.equal(seen.length, 5);
  const noAPI = Object.assign(new EventTarget(), { innerWidth: 382, innerHeight: 580 });
  assert.doesNotThrow(() => observeViewportLayout(noAPI, () => {})());
});
