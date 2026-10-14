'use client';

import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { BUILTIN_DECKS, type Deck } from './deck';

interface DeckContextValue {
  decks: Record<string, Deck>;
  defaultDeckId?: string;
}

const DeckContext = createContext<DeckContextValue | null>(null);

export interface DeckProviderProps {
  /**
   * Client-side deck definitions made available to descendant `<GameCard>` components.
   * Merges with the built-in decks (`spanish`, `french`) and any parent `<DeckProvider>`.
   */
  decks?: readonly Deck[];
  /**
   * Default deck id used when `<GameCard>` omits `value.deck`.
   * When omitted across all providers, defaults to `'french'`.
   */
  default?: string;
  children: ReactNode;
}

/**
 * Supplies client-side deck definitions to descendant `<GameCard>` components.
 *
 * Card props stay serializable across client/server boundaries by referencing decks through
 * string ids (`value.deck`). Consumer applications define their decks (which may carry `ReactNode`
 * artwork) in client modules and register them here.
 *
 * The built-in Spanish (`spanishDeck`) and French (`frenchDeck`) decks are registered automatically.
 */
export function DeckProvider({
  decks,
  default: defaultDeckId,
  children,
}: DeckProviderProps): ReactElement {
  const parent = useContext(DeckContext);

  const value = useMemo<DeckContextValue>(() => {
    const merged: Record<string, Deck> = {
      ...BUILTIN_DECKS,
      ...(parent?.decks),
    };
    if (decks) {
      for (const deck of decks) {
        merged[deck.id] = deck;
      }
    }
    return {
      decks: merged,
      defaultDeckId: defaultDeckId ?? parent?.defaultDeckId,
    };
  }, [parent, decks, defaultDeckId]);

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

DeckProvider.displayName = 'DeckProvider';

export class UnknownDeckError extends Error {
  constructor(deckId: string) {
    super(
      `Unknown deck: "${deckId}". Register it in DeckProvider or use a built-in deck ("spanish", "french").`,
    );
    this.name = 'UnknownDeckError';
  }
}

/**
 * Resolves a deck by id or from the nearest `<DeckProvider>`.
 *
 * Resolution order:
 * 1. Explicit `id` parameter (resolved against registered decks or built-ins).
 * 2. The nearest `<DeckProvider default="...">` setting.
 * 3. The built-in French deck (`frenchDeck`).
 *
 * An unknown deck id throws a clear error naming the missing deck, never rendering a blank card.
 */
export function useDeck(id?: string): Deck {
  const context = useContext(DeckContext);
  const targetId = id ?? context?.defaultDeckId ?? 'french';
  const resolved = context?.decks[targetId] ?? BUILTIN_DECKS[targetId];

  if (!resolved) {
    throw new UnknownDeckError(targetId);
  }

  return resolved;
}
