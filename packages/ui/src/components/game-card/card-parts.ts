'use client';

import { useEffect, useLayoutEffect, useMemo, type ReactNode, type RefCallback } from 'react';
import { registerFlightNode, registerHiddenFlightNode, useFlightRegistry } from '../card-flights/flight-registry';
import type { PlayingCard, TreeFlightNode } from '../card-flights/flight-registry';

export function cardPartIdentity(marker: string, identity?: string) {
  return [...new Set(`${marker} ${identity ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
}

export function useCardRegistrationRefs(kind: 'hand' | 'played' | 'hidden', cards: readonly (PlayingCard & { cardId?: string })[], playerKey?: string,
  artwork?: (card: PlayingCard, face: 'front' | 'back') => ReactNode) {
  const registry = useFlightRegistry();
  const keys = cards.map((card) => card.id);
  useLayoutEffect(() => {
    if (!registry) return;
    const registered: HTMLElement[] = [];
    cards.forEach((card) => {
      const entry = kind === 'hidden' ? registry.hidden.get(playerKey ?? '')?.get(Number(card.id)) : registry[kind].get(card.id);
      if (!entry) return;
      const role = { hand: 'hand', hidden: 'seat', played: 'play' } as const;
      const metadata: TreeFlightNode = { node: entry.node, role: role[kind], card,
        cardId: card.cardId ?? card.id, seatKey: playerKey, face: kind === 'hidden' ? 'down' : 'up',
        front: artwork?.(card, 'front'), back: artwork?.(card, 'back') };
      registry.tree.set(entry.node, metadata);
      registered.push(entry.node);
    });
    registry.notify();
    return () => { registered.forEach((node) => registry.tree.delete(node)); registry.notify(); };
  });
  const refs = useMemo(() => new Map<string, RefCallback<HTMLElement>>(), [registry, kind, playerKey]);
  useEffect(() => {
    const live = new Set(keys);
    for (const key of refs.keys()) if (!live.has(key)) refs.delete(key);
  }, [refs, keys]);
  return (key: string) => {
    let ref = refs.get(key);
    if (!ref) {
      ref = (node) => kind === 'hidden'
        ? registerHiddenFlightNode(registry, playerKey, Number(key), node)
        : registerFlightNode(registry?.[kind], key, node);
      refs.set(key, ref);
    }
    return ref;
  };
}
