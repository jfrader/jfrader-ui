import type { RefCallback } from 'react';
import { expect } from 'storybook/test';

export interface RefCleanupTracker<T = HTMLElement> {
  ref: RefCallback<T>;
  getNode: () => T | null;
  isCleanedUp: () => boolean;
  getAttachCount: () => number;
  getCleanupCount: () => number;
}

/**
 * Creates a callback ref that tracks node attachment and verifies
 * callback-ref cleanup function execution on unmount/detach.
 */
export function createRefCleanupTracker<T = HTMLElement>(): RefCleanupTracker<T> {
  let mountedNode: T | null = null;
  let cleanupCalled = false;
  let attachCount = 0;
  let cleanupCount = 0;

  const ref: RefCallback<T> = (node: T | null) => {
    if (node) {
      mountedNode = node;
      cleanupCalled = false;
      attachCount++;
      return () => {
        cleanupCalled = true;
        cleanupCount++;
        mountedNode = null;
      };
    }
    if (node === null) {
      mountedNode = null;
    }
    return undefined;
  };

  return {
    ref,
    getNode: () => mountedNode,
    isCleanedUp: () => cleanupCalled,
    getAttachCount: () => attachCount,
    getCleanupCount: () => cleanupCount,
  };
}

/**
 * Verifies that slots.root wins precedence over component.
 */
export async function expectRootPrecedence(
  container: ParentNode,
  winnerSelector: string,
  loserSelector: string,
) {
  const winner = container.querySelector(winnerSelector);
  const loser = container.querySelector(loserSelector);
  await expect(winner).not.toBeNull();
  await expect(loser).toBeNull();
  return winner as HTMLElement;
}

/**
 * Verifies that all expected classes are present on the element.
 */
export async function expectMergedClasses(
  element: HTMLElement,
  ...expectedClasses: string[]
) {
  for (const cls of expectedClasses) {
    await expect(element).toHaveClass(cls);
  }
}

/**
 * Verifies that the mounted DOM node identity is preserved across rerenders.
 */
export async function expectSameDomIdentity(
  before: Element | null,
  after: Element | null,
) {
  await expect(before).not.toBeNull();
  await expect(after).not.toBeNull();
  await expect(after).toBe(before);
}
