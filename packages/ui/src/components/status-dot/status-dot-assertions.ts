import { expect } from 'storybook/test';

/** Checks the pulse ring is the dot's own box: positioned against the dot, its size, centered on it. */
export async function expectPulseFromDot(dot: HTMLElement) {
  const view = dot.ownerDocument.defaultView!;
  const box = dot.getBoundingClientRect();
  const ring = view.getComputedStyle(dot, '::after');
  // A positioned dot is the ring's containing block, so inset 0 resolves against the dot.
  await expect(view.getComputedStyle(dot).position).not.toBe('static');
  await expect(ring.position).toBe('absolute');
  await expect(ring.top).toBe('0px');
  await expect(ring.left).toBe('0px');
  await expect(ring.boxSizing).toBe('border-box');
  await expect(Number.parseFloat(ring.width)).toBeCloseTo(box.width, 3);
  await expect(Number.parseFloat(ring.height)).toBeCloseTo(box.height, 3);
  const [originX, originY] = ring.transformOrigin.split(' ').map(Number.parseFloat);
  await expect(originX).toBeCloseTo(box.width / 2, 3);
  await expect(originY).toBeCloseTo(box.height / 2, 3);
  await expect(ring.animationName).not.toBe('none');
  await expect(ring.animationIterationCount).toBe('infinite');
  await expect(ring.animationDuration).toBe('1.2s');
  await expect(ring.pointerEvents).toBe('none');
}

/** Steps the ring through one cycle: it starts inside the dot and fades out at 2.4 times its size. */
export async function expectPulseCycle(dot: HTMLElement) {
  const view = dot.ownerDocument.defaultView!;
  // Pseudo-element animations are only listed with `subtree`.
  const animation = dot.getAnimations({ subtree: true }).find((item) =>
    item.effect instanceof KeyframeEffect && item.effect.pseudoElement === '::after');
  if (!animation) throw new Error('Missing pulse ring animation');
  const previousTime = animation.currentTime;
  animation.pause();
  await animation.ready;
  try {
    for (const [time, scale, opacity] of [[0, 0.8, 1], [600, 1.6, 0.5], [1199, 2.4, 0], [1200, 0.8, 1]] as const) {
      animation.currentTime = time;
      await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
      const ring = view.getComputedStyle(dot, '::after');
      await expect(new DOMMatrixReadOnly(ring.transform).a).toBeCloseTo(scale, 2);
      await expect(Number(ring.opacity)).toBeCloseTo(opacity, 2);
    }
  } finally {
    animation.currentTime = previousTime;
    animation.play();
  }
}

export function mediaRules(document: Document, condition: string) {
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText === `(${condition})`)
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
}

/** Checks a media query hides the ring and that no rule in it hides the dot itself. */
export async function expectPulseHiddenForMedia(dot: HTMLElement, condition: string) {
  const rules = mediaRules(dot.ownerDocument, condition);
  const selectors = Array.from(dot.classList, (name) => `.${name}`);
  const ringRule = rules.find((rule) => selectors.some((selector) => rule.selectorText === `${selector}[data-pulse]::after`));
  await expect(ringRule).toBeDefined();
  await expect(ringRule?.style.content).toBe('none');
  await expect(ringRule?.style.display).toBe('none');
  await expect(ringRule?.style.animationName).toBe('none');
  for (const rule of rules.filter((item) => selectors.includes(item.selectorText))) {
    await expect(rule.style.display).not.toBe('none');
    await expect(rule.style.visibility).not.toBe('hidden');
    await expect(rule.style.opacity).not.toBe('0');
  }
}
