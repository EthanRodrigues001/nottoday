import type { SharedValue } from 'react-native-reanimated';

/** Gap between task rows; the drag maths needs it to place rows. */
export const ROW_GAP = 6;

/** Which bottom target the finger is over while dragging. */
export const ZONE_NONE = 0;
export const ZONE_NOT_TODAY = 1;
export const ZONE_DELETE = 2;

/** Shared drag state for one list. Every field lives on the UI thread so a drag never re-renders React. */
export type DragState = {
  /** Index of the row being dragged, or -1. */
  active: SharedValue<number>;
  /** Index the dragged row would take if dropped now. */
  hover: SharedValue<number>;
  /** Finger travel on Y since the drag began. */
  offsetY: SharedValue<number>;
  /** Measured height of each row. */
  heights: SharedValue<number[]>;
  /** Bottom target under the finger (ZONE_*). */
  zone: SharedValue<number>;
};

/** Top edge of row `i` when rows are stacked with ROW_GAP. */
export function topOf(heights: number[], i: number): number {
  'worklet';
  let y = 0;
  for (let k = 0; k < i; k++) y += (heights[k] ?? 0) + ROW_GAP;
  return y;
}

/** Index of the row whose band contains `y`, clamped to the list. */
export function indexAt(heights: number[], y: number): number {
  'worklet';
  let top = 0;
  for (let k = 0; k < heights.length; k++) {
    const bottom = top + heights[k] + ROW_GAP;
    if (y < bottom) return k;
    top = bottom;
  }
  return Math.max(0, heights.length - 1);
}
