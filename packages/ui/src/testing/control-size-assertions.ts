import { expect } from 'storybook/test';
import { base } from '@jfrader/tokens';

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

export async function expectControlMinimums(elements: Iterable<Element>, heights: readonly number[] = [64, 80, 96]) {
  const controls = Array.from(elements);
  await expect(controls).toHaveLength(heights.length);
  for (const [index, control] of controls.entries()) {
    await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(heights[index]!);
  }
}
