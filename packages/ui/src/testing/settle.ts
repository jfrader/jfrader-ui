/**
 * Waits until the document has finished its finite animations and settled its layout.
 *
 * A play function can end while a CSS transition is still running (an exit fade, a disclosure
 * height, a color change). The accessibility gate and the design audit run after play, so they
 * can sample a half-finished frame: a color-contrast check reads a translucent foreground, a
 * geometry check reads a moving box. CI under load makes that window wider.
 *
 * Both helpers wait on observable signals (animation completion, fonts, frames), never on a
 * sleep. Infinite animations (spinners, shimmers) are left alone: they never settle by design.
 */

/** Waits for fonts to load and for two animation frames, so layout reads are stable. */
export async function settleLayout(doc: Document = document): Promise<void> {
  await doc.fonts.ready;
  const view = doc.defaultView;
  if (!view) return;
  await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
}

/**
 * Finishes every finite transition or animation in the document, then settles layout. Finishing a
 * transition fires its `transitionend`, so a component that unmounts on exit completes its removal
 * before the caller samples the DOM.
 */
export async function settleAnimations(doc: Document = document): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    const running = doc.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      if (!timing) return false;
      return timing.iterations !== Infinity && Number.isFinite(timing.endTime ?? Infinity);
    });
    if (running.length === 0) break;
    for (const animation of running) {
      try {
        animation.finish();
      } catch {
        // An idle or infinite animation cannot finish; leave it running.
      }
    }
    await settleLayout(doc);
  }
  await settleLayout(doc);
}
