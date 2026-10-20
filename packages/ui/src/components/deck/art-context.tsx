'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface DeckArtOptions {
  /** Selects a named art set for descendant cards, overriding the parent selection. */
  artSet?: string;
  /** Selects art sets by card art id. Entries override matching parent entries and `artSet`. */
  cardArtSets?: Readonly<Record<string, string>>;
}

const ArtContext = createContext<DeckArtOptions>({});

export function useDeckArt({ artSet, cardArtSets }: DeckArtOptions = {}): DeckArtOptions {
  const parent = useContext(ArtContext);
  return useMemo(() => ({
    artSet: artSet ?? parent.artSet,
    cardArtSets: cardArtSets ? { ...parent.cardArtSets, ...cardArtSets } : parent.cardArtSets,
  }), [artSet, cardArtSets, parent]);
}

/** Share deck artwork choices with descendant cards. */
export function DeckArtProvider({ children, ...options }: DeckArtOptions & {
  /** Receives the shared artwork selections. */
  children: ReactNode;
}) {
  const value = useDeckArt(options);
  return <ArtContext value={value}>{children}</ArtContext>;
}

DeckArtProvider.displayName = 'DeckArtProvider';
