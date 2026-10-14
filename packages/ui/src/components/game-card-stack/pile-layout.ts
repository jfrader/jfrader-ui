import type { GameCardValue } from '../game-card';

export interface PlayedCard {
  /** Unique identity of this play, also used by card-flight destinations. */
  id: string;
  label: string;
  value?: GameCardValue;
  /** Closed-pile layer; defaults to the card's position in the pile. */
  order?: number;
}

export interface PlayedCardEntry extends PlayedCard {
  player: { key: string };
}

export interface SeatVector {
  cos: number;
  sin: number;
  sideStrength: number;
  angleDeg?: number;
}

export const PLAYED_PILE = {
  openScale: 1.45,
  openSpreadRatio: 0.52,
  // The reference caps played and revealed cards at three, independently of viewport.
  maxCards: 3,
  zIndex: { closed: 40, open: 240, card: 20, openCard: 280 },
} as const;

// Preserve reference card mathematics, but deliberately replace preset placement with GameTable
// play slots (the same deviation policy as GameTable's circular seat layout).
export const DEFAULT_PILE_LAYOUT = {
  maxJitterPx: 4,
  maxRotationOffsetDeg: 6,
  facePlayerRotation: false,
};

export type PileLayout = typeof DEFAULT_PILE_LAYOUT;

export function getStableRotation({ seed, maxRotationOffsetDeg }: { seed: string; maxRotationOffsetDeg: number }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const normalized = (((hash % 1000) + 1000) % 1000) / 1000;
  return normalized * (maxRotationOffsetDeg * 2) - maxRotationOffsetDeg;
}

export function getStableJitter({ seed, spread }: { seed: string; spread: number }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 33 + seed.charCodeAt(i)) | 0;
  const xNorm = (((hash % 1000) + 1000) % 1000) / 1000;
  const yNorm = (((((hash / 1000) | 0) % 1000) + 1000) % 1000) / 1000;
  return { x: xNorm * spread * 2 - spread, y: yNorm * spread * 2 - spread };
}

export function getPileOffset({ index, total, open, openSpreadRatio }: {
  index: number; total: number; open: boolean; openSpreadRatio: number;
}) {
  const center = (total - 1) / 2;
  const delta = index - center;
  // Reference card math: open delta × 0.52 widths / −|delta| × 4px;
  // closed delta × 4px / |delta| × 1.5px. Placement presets are intentionally not retained.
  if (open) return { xCardWidths: delta * openSpreadRatio, xPx: 0, y: -Math.abs(delta) * 4 };
  return { xCardWidths: 0, xPx: delta * 4, y: Math.abs(delta) * 1.5 };
}

/** Map a caller-owned normalized vector onto the containing stage, without viewport presets. */
export function getPilePosition({ geometry }: { geometry: SeatVector }) {
  return { x: (1 + geometry.cos) * 50, y: (1 + geometry.sin) * 50 };
}

/** Derive an id when the application has no play id. Segments are encoded independently. */
export const getPlayedCardKey = (roundIdx: number, played: { player: { key: string }; card: string }) =>
  JSON.stringify([roundIdx, played.player.key, played.card]);

export function buildPlayedCardOrder(rounds: readonly (readonly PlayedCardEntry[])[]) {
  return Object.fromEntries(rounds.flat().map((played, index) => [played.id, index + 1]));
}

/** Groups up to three cards per player; revealed cards come from the caller, not a match. */
export function getPlayerTableCards(
  rounds: readonly (readonly PlayedCardEntry[])[],
  revealedCards: Readonly<Record<string, readonly PlayedCard[]>> = {},
) {
  const cardsByPlayerKey: Record<string, PlayedCard[]> = Object.create(null);
  let order = 0;
  rounds.forEach((round) => {
    round.forEach((played) => {
      const cards = cardsByPlayerKey[played.player.key] ??= [];
      if (cards.length < PLAYED_PILE.maxCards) cards.push({ ...played, order: played.order ?? order });
      order += 1;
    });
  });
  const revealedPlayerKeys = new Set<string>();
  Object.entries(revealedCards).forEach(([playerKey, revealed]) => {
    revealedPlayerKeys.add(playerKey);
    const cards = cardsByPlayerKey[playerKey] ??= [];
    const visibleCards = new Set(cards.map(({ id }) => id));
    revealed.forEach((card) => {
      if (visibleCards.has(card.id) || cards.length >= PLAYED_PILE.maxCards) return;
      visibleCards.add(card.id);
      cards.push(card);
    });
  });
  return { cardsByPlayerKey, revealedPlayerKeys };
}
