import type { KeyboardEvent } from 'react';

// Shared keyboard plumbing for composite widgets (Tabs, ToggleGroup, Accordion).
// Each widget keeps its own tab-stop fallback and activation policy; only movement and
// owner-scoped item lookup live here.

export type RovingOrientation = 'horizontal' | 'vertical';

type Move = (current: number, count: number) => number;

const NEXT: Move = (current, count) => (current + 1) % count;
const PREVIOUS: Move = (current, count) => (current - 1 + count) % count;
const FIRST: Move = () => 0;
const LAST: Move = (_current, count) => count - 1;

const KEY_MOVES: Record<RovingOrientation | 'horizontalRtl', Partial<Record<string, Move>>> = {
  horizontal: { ArrowRight: NEXT, ArrowLeft: PREVIOUS, Home: FIRST, End: LAST },
  horizontalRtl: { ArrowRight: PREVIOUS, ArrowLeft: NEXT, Home: FIRST, End: LAST },
  vertical: { ArrowDown: NEXT, ArrowUp: PREVIOUS, Home: FIRST, End: LAST },
};

export interface OwnedItemsQuery {
  /** Matches the enabled items, e.g. `'[role="tab"]:not([disabled])'`. */
  itemSelector: string;
  /** Matches the owning container, so items of a nested instance are excluded. */
  ownerSelector: string;
}

/** Enabled items inside `container` whose nearest owner is `container` itself. */
export function queryOwnedItems(
  container: HTMLElement,
  { itemSelector, ownerSelector }: OwnedItemsQuery,
): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(itemSelector)).filter(
    (item) => item.closest(ownerSelector) === container,
  );
}

/** The item whose `data-value` equals `value`; never matches a missing value. */
export function findByValue(items: readonly HTMLElement[], value: string | null | undefined) {
  if (value == null) return undefined;
  return items.find((item) => item.dataset.value === value);
}

/**
 * Moves focus among `container`'s owned items for arrow/Home/End keys, wrapping at the ends.
 * Horizontal arrows swap under RTL (the container's computed direction). Keys that do not
 * move, or events from outside the owned items, are left untouched.
 */
export function moveRovingFocus(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement,
  orientation: RovingOrientation,
  query: OwnedItemsQuery,
) {
  const isRtl = orientation === 'horizontal' && getComputedStyle(container).direction === 'rtl';
  const move = KEY_MOVES[isRtl ? 'horizontalRtl' : orientation][event.key];
  if (!move) return;

  const items = queryOwnedItems(container, query);
  const current = items.indexOf(event.target as HTMLElement);
  if (current === -1) return;

  event.preventDefault();
  items[move(current, items.length)]?.focus();
}
