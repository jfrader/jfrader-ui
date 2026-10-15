'use client';

import { useEffect, useMemo, type RefCallback } from 'react';
import { registerFlightNode, registerHiddenFlightNode, useFlightRegistry } from '../card-flights/flight-registry';

export function cardPartIdentity(marker: string, identity?: string) {
  return [...new Set(`${marker} ${identity ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
}

export function useCardRegistrationRefs(kind: 'hand' | 'played' | 'hidden', keys: readonly string[], playerKey?: string) {
  const registry = useFlightRegistry();
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
