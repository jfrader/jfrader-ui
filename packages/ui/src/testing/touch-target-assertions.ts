import { base } from '@jfrader/tokens';
import { expect } from 'storybook/test';

const MINIMUM_TOUCH_TARGET_PX = Number.parseFloat(base.size.touch);

export async function expectTouchTargets(elements: Iterable<HTMLElement>) {
  const targets = Array.from(elements);
  await expect(targets.length).toBeGreaterThan(0);
  for (const target of targets) {
    const window = target.ownerDocument.defaultView!;
    await expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
    const bounds = target.getBoundingClientRect();
    const name = target.getAttribute('aria-label') ?? target.dataset.ui ?? target.tagName;
    await expect(bounds.width, `${name} touch width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_PX);
    await expect(bounds.height, `${name} touch height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_PX);
  }
}
