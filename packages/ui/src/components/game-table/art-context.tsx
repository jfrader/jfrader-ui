'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface GameTableArtOptions {
  artSet?: string;
  cardArtSets?: Readonly<Record<string, string>>;
}

const ArtContext = createContext<GameTableArtOptions>({});

export function useGameTableArt(): GameTableArtOptions {
  return useContext(ArtContext);
}

export function GameTableArtProvider({ artSet, cardArtSets, children }: GameTableArtOptions & { children: ReactNode }) {
  const parent = useGameTableArt();
  const value = useMemo(() => ({
    artSet: artSet ?? parent.artSet,
    cardArtSets: cardArtSets ? { ...parent.cardArtSets, ...cardArtSets } : parent.cardArtSets,
  }), [artSet, cardArtSets, parent]);
  return <ArtContext value={value}>{children}</ArtContext>;
}
