export const HOME_CAROUSEL_INTERVAL_MS = 4600;
export const HOME_CAROUSEL_TRANSITION_MS = 1000;
export const OPENER_ENTRY_DELAY_MS = 2000;

export const HOME_CAROUSEL_POSITION_CLASSES = Object.freeze([
  "is-active",
  "is-prev",
  "is-next",
  "is-far-prev",
  "is-far-next",
]);

const OFFSET_CLASS = new Map([
  [0, "is-active"],
  [-1, "is-prev"],
  [1, "is-next"],
  [-2, "is-far-prev"],
  [2, "is-far-next"],
]);

export function wrapCarouselIndex(index, count) {
  if (!Number.isInteger(count) || count <= 0) return 0;
  return ((index % count) + count) % count;
}

export function carouselPositionClass(index, activeIndex, count) {
  if (!Number.isInteger(count) || count <= 0) return "";
  const forward = wrapCarouselIndex(index - activeIndex, count);
  const backward = forward - count;
  const offset = Math.abs(backward) < Math.abs(forward) ? backward : forward;
  return OFFSET_CLASS.get(offset) ?? "";
}
