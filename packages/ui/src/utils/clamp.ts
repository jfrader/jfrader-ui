/**
 * Clamps `value` into `[min, max]`. Pass a minimum no greater than the maximum; an inverted range
 * collapses to the minimum, so a caller that computes its bounds dynamically cannot invert them.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
