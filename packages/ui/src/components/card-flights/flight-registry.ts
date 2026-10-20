'use client';

import { createContext, useContext } from 'react';
import { measureCardBox, type CardBox } from './geometry';
import type { GameCardValue } from '../game-card';
import type { ReactNode } from 'react';

declare const process: { env: { NODE_ENV?: string } };
export function warnFlight(message: string) {
  if (process.env.NODE_ENV !== 'production') console.warn(message);
}
export function assertLegacyFlightEngine(treeOwned: boolean | undefined) {
  if (treeOwned && process.env.NODE_ENV !== 'production') throw new Error('Do not mix legacy flight hooks with CardFlights. Render the card tree instead.');
}

/** Stable card identity shared by hands and play destinations. */
export interface PlayingCard { id: string; label: string; value?: GameCardValue }
export interface TreeFlightNode {
  node: HTMLElement;
  role: 'hand' | 'seat' | 'play' | 'deck';
  card: PlayingCard;
  cardId: string;
  seatKey?: string;
  face: 'up' | 'down' | 'reveal';
  faceOverride?: 'up' | 'down' | 'reveal';
  front?: ReactNode;
  back?: ReactNode;
}

export interface FlightSeat { key: string; isMe?: boolean }
export interface FlightNode { node: HTMLElement; box?: CardBox }
export interface FlightTable { node: HTMLElement; seats: readonly FlightSeat[] }

export function createFlightRegistry() {
  const listeners = new Set<() => void>();
  return {
    treeOwned: false,
    tree: new Map<HTMLElement, TreeFlightNode>(),
    notify: () => listeners.forEach((listener) => listener()),
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
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
