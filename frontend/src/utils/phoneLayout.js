// Mirrors index.css: compact navigation until there is room for the desktop
// sidebar on touch screens. This is a content breakpoint, NOT posture detection.
export const PHONE_QUERY = '(max-width: 768px), (pointer: coarse) and (max-width: 1023px)';

export function isPhoneLayout(win = typeof window !== 'undefined' ? window : null) {
  return !!win?.matchMedia?.(PHONE_QUERY).matches;
}

// Width to feed width-threshold layout math (e.g. collection grid gaps, which
// switch at 769px): a phone-layout viewport counts as at most 768px wide.
export function layoutViewportWidth(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return 0;
  return isPhoneLayout(win) ? Math.min(win.innerWidth, 768) : win.innerWidth;
}
