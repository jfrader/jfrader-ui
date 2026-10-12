import { expect } from 'storybook/test';
import { settleMotion } from './motion-assertions';

type Options = { tolerancePx?: number };
type Edge = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';
type Axis = 'horizontal' | 'vertical';
const DEFAULT_TOLERANCE_PX = 1;

function toleranceOf({ tolerancePx = DEFAULT_TOLERANCE_PX }: Options) {
  if (!Number.isFinite(tolerancePx) || tolerancePx < 0) throw new Error(`Invalid tolerance: ${tolerancePx}px`);
  return tolerancePx;
}

function boxOf(element: Element) {
  const box = element.getBoundingClientRect();
  if (!element.isConnected || box.width <= 0 || box.height <= 0) {
    throw new Error(`Cannot measure disconnected/empty element: ${box.width}×${box.height}px at (${box.x}, ${box.y})`);
  }
  return box;
}

async function withinTolerance(label: string, deltas: Record<string, number>, tolerance: number) {
  for (const [name, delta] of Object.entries(deltas)) {
    await expect(Math.abs(delta), `${label}: ${name} delta=${delta.toFixed(3)}px; tolerance=${tolerance}px`)
      .toBeLessThanOrEqual(tolerance);
  }
}

/**
 * Story-only: transformed viewport-aligned border boxes (not ink, shadow or a curved silhouette).
 * Each element edge must lie inside the surface border box, inset by insetPercent (0–50) of
 * its corresponding dimension. Defaults: insetPercent=0, tolerancePx=1. Settle motion first.
 */
export async function expectInside(element: Element, surface: Element, options: Options & { insetPercent?: number } = {}) {
  const tolerance = toleranceOf(options);
  const { insetPercent = 0 } = options;
  if (!Number.isFinite(insetPercent) || insetPercent < 0 || insetPercent > 50) {
    throw new Error(`Invalid insetPercent: ${insetPercent}; expected 0–50`);
  }
  const box = boxOf(element);
  const frame = boxOf(surface);
  const x = frame.width * insetPercent / 100;
  const y = frame.height * insetPercent / 100;
  const distances = {
    left: box.left - frame.left - x, right: frame.right - box.right - x,
    top: box.top - frame.top - y, bottom: frame.bottom - box.bottom - y,
  };
  for (const [edge, distance] of Object.entries(distances)) {
    await expect(distance, `Inside ${edge}: clearance=${distance.toFixed(3)}px after ${insetPercent}% inset; tolerance=${tolerance}px`)
      .toBeGreaterThanOrEqual(-tolerance);
  }
}

/** Story-only: spread of viewport border-box edges/centers across at least two elements; tolerancePx=1. */
export async function expectAligned(elements: Iterable<Element>, edge: Edge, options: Options = {}) {
  const tolerance = toleranceOf(options);
  const boxes = Array.from(elements, boxOf);
  if (boxes.length < 2) throw new Error(`Alignment requires at least 2 elements; received ${boxes.length}`);
  const values = boxes.map((box) => ({
    left: box.left, right: box.right, top: box.top, bottom: box.bottom,
    'center-x': box.left + box.width / 2, 'center-y': box.top + box.height / 2,
  })[edge]);
  const spread = Math.max(...values) - Math.min(...values);
  await expect(spread, `Aligned ${edge}: coordinates=[${values.map((value) => value.toFixed(3)).join(', ')}]px; spread=${spread.toFixed(3)}px; tolerance=${tolerance}px`)
    .toBeLessThanOrEqual(tolerance);
}

/**
 * Story-only: reflect the entire viewport border box of a onto b about the surface's center line.
 * vertical = left/right reflection; horizontal = top/bottom reflection. Checks size and both
 * coordinates, not only center sums. All three boxes use getBoundingClientRect; tolerancePx=1.
 */
export async function expectMirrored(a: Element, b: Element, surface: Element, axis: Axis, options: Options = {}) {
  const tolerance = toleranceOf(options);
  const first = boxOf(a);
  const second = boxOf(b);
  const frame = boxOf(surface);
  await withinTolerance(`Mirrored ${axis}`, {
    x: second.left - (axis === 'vertical' ? frame.left + frame.right - first.right : first.left),
    y: second.top - (axis === 'horizontal' ? frame.top + frame.bottom - first.bottom : first.top),
    width: second.width - first.width, height: second.height - first.height,
  }, tolerance);
}

/**
 * Story-only: intersection of transformed viewport border boxes, not painted/clipped shapes.
 * Touching edges pass; penetration <= tolerancePx (default 1) on either axis passes.
 */
export async function expectNoOverlap(a: Element, b: Element, options: Options = {}) {
  const tolerance = toleranceOf(options);
  const first = boxOf(a);
  const second = boxOf(b);
  const x = Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const y = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
  await expect(Math.min(x, y), `No overlap: intersection=${x.toFixed(3)}×${y.toFixed(3)}px (negative = gap); tolerance=${tolerance}px`)
    .toBeLessThanOrEqual(tolerance);
}

/**
 * Story-only: temporarily sets container dir=ltr then rtl, settles finite motion and compares
 * each selected descendant's border box relative to the container border box. DOM order is
 * identity; descendants must inherit direction. Checks horizontal reflection, y and size with
 * 1px tolerance. Restores the original dir (including absence) even on failure; does not clone DOM.
 */
export async function expectMirroredDirection(container: HTMLElement, selector: string) {
  const original = container.getAttribute('dir');
  const elements = Array.from(container.querySelectorAll(selector));
  if (!elements.length) throw new Error(`Direction mirror: selector ${selector} matched 0 elements`);
  const snapshot = () => {
    const frame = boxOf(container);
    return { frame, boxes: elements.map((element) => {
      const box = boxOf(element);
      return { x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height };
    }) };
  };
  const settle = async () => {
    await new Promise<void>((resolve) => container.ownerDocument.defaultView!.requestAnimationFrame(() => resolve()));
    await settleMotion(container);
  };
  try {
    container.setAttribute('dir', 'ltr');
    await settle();
    const ltr = snapshot();
    container.setAttribute('dir', 'rtl');
    await settle();
    const rtl = snapshot();
    await withinTolerance('Direction container', {
      width: rtl.frame.width - ltr.frame.width, height: rtl.frame.height - ltr.frame.height,
    }, DEFAULT_TOLERANCE_PX);
    for (const [index, first] of ltr.boxes.entries()) {
      const second = rtl.boxes[index]!;
      await withinTolerance(`Direction ${selector}[${index}]`, {
        x: second.x - (ltr.frame.width - first.x - first.width), y: second.y - first.y,
        width: second.width - first.width, height: second.height - first.height,
      }, DEFAULT_TOLERANCE_PX);
    }
  } finally {
    if (original === null) container.removeAttribute('dir');
    else container.setAttribute('dir', original);
    await settle();
  }
}
