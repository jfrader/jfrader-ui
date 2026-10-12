import { expect } from 'storybook/test';

/** Frames sampled at most per entrance or exit (about two seconds at 60 Hz). */
const MAX_FRAMES = 120;

const nextFrame = (element: Element) =>
  new Promise<void>((resolve) => (element.ownerDocument.defaultView ?? window).requestAnimationFrame(() => resolve()));

const opacityOf = (element: Element) => Number(getComputedStyle(element).opacity);

/** Story-only: resolves once the finite animations under `element` (pseudo-elements included) finish. */
export async function settleMotion(element: Element) {
  await Promise.allSettled(
    element
      .getAnimations({ subtree: true })
      .filter((animation) => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
      .map((animation) => animation.finished),
  );
}

/**
 * Story-only: samples `element`'s opacity once per frame from now until it is fully opaque and
 * asserts a real entrance — it starts below 1, passes through an intermediate frame and never
 * goes backwards.
 */
export async function expectEntranceMotion(element: Element) {
  const samples: number[] = [];
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    samples.push(opacityOf(element));
    if (samples.at(-1) === 1) break;
    await nextFrame(element);
  }
  await expect(samples[0]).toBeLessThan(1);
  await expect(samples.at(-1)).toBe(1);
  await expect(samples.some((value) => value > 0 && value < 1)).toBe(true);
  await expect(samples.every((value, index) => index === 0 || value >= samples[index - 1]!)).toBe(true);
}

/**
 * Story-only: call right after an accepted close. Samples `element`'s opacity once per frame
 * until `gone()` reports the surface hidden, and asserts the exit was retained — at least one
 * frame still shows the surface at an intermediate opacity — and only ever fades.
 */
export async function expectRetainedExit(element: Element, gone: () => boolean) {
  const samples: number[] = [];
  for (let frame = 0; frame < MAX_FRAMES && !gone(); frame += 1) {
    samples.push(opacityOf(element));
    await nextFrame(element);
  }
  await expect(gone()).toBe(true);
  await expect(samples.some((value) => value > 0 && value < 1)).toBe(true);
  await expect(samples.every((value, index) => index === 0 || value <= samples[index - 1]!)).toBe(true);
}
