// Progressive enhancement: geometry comes only from the Viewport Segments API.
// Never infer a physical fold (or a device model) from width or aspect ratio.
export function readViewportLayout(win = typeof window === 'undefined' ? null : window) {
  const segments = win?.viewport?.segments;
  if (!Array.isArray(segments) || segments.length !== 2) return null;
  const visible = win.visualViewport;
  // Keyboard/pinch zoom can leave segment reports describing the old layout
  // viewport. Prefer one scrollable sheet until the whole viewport is usable.
  if (visible && (visible.scale !== 1 || visible.offsetTop !== 0 || visible.offsetLeft !== 0
    || visible.height < win.innerHeight - 1 || visible.width < win.innerWidth - 1)) return null;
  // Content minima, not device dimensions. Stale reports during a window
  // transition must not place controls beyond the currently usable viewport.
  if (!segments.every(s => s && ['left', 'top', 'right', 'bottom', 'width', 'height'].every(k => Number.isFinite(s[k]))
    && s.width >= 260 && s.height >= 200 && s.left >= 0 && s.top >= 0
    && s.right === s.left + s.width && s.bottom === s.top + s.height
    && s.right <= win.innerWidth && s.bottom <= win.innerHeight)) return null;
  const [first, second] = [...segments].sort((a, b) => a.top - b.top || a.left - b.left);
  if (first.right <= second.left && first.top === second.top && first.height === second.height) {
    return { axis: 'horizontal', segments: [first, second] };
  }
  if (first.bottom <= second.top && first.left === second.left && first.width === second.width) {
    return { axis: 'vertical', segments: [first, second] };
  }
  return null;
}

export function observeViewportLayout(win, onChange) {
  const update = () => onChange(readViewportLayout(win), readVisualBounds(win));
  const posture = win.navigator?.devicePosture;
  const visible = win.visualViewport;
  win.addEventListener('resize', update);
  posture?.addEventListener('change', update);
  visible?.addEventListener('resize', update);
  visible?.addEventListener('scroll', update);
  update();
  return () => {
    win.removeEventListener('resize', update);
    posture?.removeEventListener('change', update);
    visible?.removeEventListener('resize', update);
    visible?.removeEventListener('scroll', update);
  };
}

export function readVisualBounds(win = typeof window === 'undefined' ? null : window) {
  const visible = win?.visualViewport;
  // Do not fight the browser's native panning when the user pinch-zooms.
  if (!visible || visible.scale !== 1) return null;
  return { top: visible.offsetTop, left: visible.offsetLeft, width: visible.width, height: visible.height };
}

export function segmentStyles(layout) {
  if (!layout) return undefined;
  return Object.fromEntries(layout.segments.flatMap((segment, i) =>
    ['left', 'top', 'width', 'height'].map(key => [`--segment-${i}-${key}`, `${segment[key]}px`])));
}
