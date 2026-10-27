import { expect } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { COARSE_POINTER } from '../styling/media';

export async function expectControlHeights(elements: Iterable<Element>, heights: readonly [number, number, number] = [32, 40, 48]) {
  const controls = Array.from(elements);
  await expect(controls).toHaveLength(heights.length);
  const textSizes = [base.textSize.sm, base.textSize.sm, base.textSize.md];
  for (const [index, control] of controls.entries()) {
    await expect(control.getBoundingClientRect().height).toBe(heights[index]);
    await expect(getComputedStyle(control).boxSizing).toBe('border-box');
    const rootFontSize = parseFloat(getComputedStyle(control.ownerDocument.documentElement).fontSize);
    await expect(parseFloat(getComputedStyle(control).fontSize)).toBe(parseFloat(textSizes[index]!) * rootFontSize);
  }
}

export function doubleRootText({ canvasElement }: { canvasElement: HTMLElement }) {
  const root = canvasElement.ownerDocument.documentElement;
  const previous = root.style.fontSize;
  root.style.fontSize = '200%';
  return () => { root.style.fontSize = previous; };
}

/**
 * Under a coarse pointer every target reaches `size.touch` on both axes. Under a fine pointer each
 * target keeps the block size listed beside it.
 */
export async function expectPointerTargets(targets: readonly (readonly [Element, number])[]) {
  await expect(targets.length).toBeGreaterThan(0);
  const view = targets[0]![0].ownerDocument.defaultView!;
  const coarse = view.matchMedia(COARSE_POINTER.replace('@media ', '')).matches;
  const touch = parseFloat(base.size.touch);
  for (const [target, fineHeight] of targets) {
    const { width, height } = target.getBoundingClientRect();
    const label = `${target.getAttribute('data-ui')} ${coarse ? 'coarse' : 'fine'}`;
    if (coarse) {
      await expect(width, `${label} width`).toBeGreaterThanOrEqual(touch);
      await expect(height, `${label} height`).toBeGreaterThanOrEqual(touch);
    } else {
      await expect(height, `${label} height`).toBe(fineHeight);
    }
  }
}

export async function expectControlMinimums(elements: Iterable<Element>, heights: readonly number[] = [64, 80, 96]) {
  const controls = Array.from(elements);
  await expect(controls).toHaveLength(heights.length);
  for (const [index, control] of controls.entries()) {
    await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(heights[index]!);
  }
}
