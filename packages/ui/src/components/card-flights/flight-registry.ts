'use client';

import { createContext, useContext } from 'react';
import { measureCardBox, type CardBox } from './geometry';

export interface FlightSeat { key: string; isMe?: boolean }
export interface FlightNode { node: HTMLElement; box?: CardBox }
export interface FlightTable { node: HTMLElement; seats: readonly FlightSeat[] }

export function createFlightRegistry() {
  return {
    hand: new Map<string, FlightNode>(),
    hidden: new Map<string, Map<number, FlightNode>>(),
    played: new Map<string, FlightNode>(),
    tables: new Map<HTMLElement, FlightTable>(),
  };
}
export type FlightRegistry = ReturnType<typeof createFlightRegistry>;
export const FlightRegistryContext = createContext<FlightRegistry | null>(null);
export const useFlightRegistry = () => useContext(FlightRegistryContext);
const entries = new WeakMap<HTMLElement, FlightNode>();

export function registerFlightNode<K>(nodes: Map<K, FlightNode> | undefined, key: K, node: HTMLElement | null) {
  if (!nodes || !node) return;
  const entry = entries.get(node) ?? { node };
  entries.set(node, entry);
  nodes.set(key, entry);
  return () => {
    entry.box = measureCardBox(node);
    if (nodes.get(key) === entry) nodes.delete(key);
  };
}

export function registerHiddenFlightNode(registry: FlightRegistry | null, playerKey: string | undefined, index: number, node: HTMLElement | null) {
  if (!registry || playerKey === undefined || !node) return;
  let nodes = registry.hidden.get(playerKey);
  if (!nodes) { nodes = new Map(); registry.hidden.set(playerKey, nodes); }
  const cleanup = registerFlightNode(nodes, index, node);
  return () => {
    cleanup?.();
    if (!nodes.size && registry.hidden.get(playerKey) === nodes) registry.hidden.delete(playerKey);
  };
}
