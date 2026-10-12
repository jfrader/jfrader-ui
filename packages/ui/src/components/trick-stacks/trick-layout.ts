import type { GameCardValue } from '../game-card';

export interface TrickCard {
  /** Stable identity of the card, independent of its rendered face. */
  card: string;
  roundIdx: number;
  value?: GameCardValue;
}

export interface TrickPlay extends Omit<TrickCard, 'roundIdx'> {
  player: { key: string };
}

export interface TrickSeatGeometry {
  cos: number;
  sin: number;
  sideStrength: number;
  angleDeg: number;
}

export const TRICK_STACK = {
  openScale: 1.45,
  openSpreadRatio: 0.52,
  // trickLayout.ts/getPlayerTableCards caps played and revealed cards at three (not a viewport preset).
  maxCards: 3,
  zIndex: { closed: 40, open: 240, card: 20, openCard: 280 },
} as const;

// Manual-placement compatibility only. Automatic placement does not consume board presets.
// Base fields: trucoshi-client-private/packages/core/src/board/config/defaults.ts/DEFAULT_MATCH_CENTER_BASE.
export const DEFAULT_TRICK_LAYOUT = {
  centerShiftXPercent: -1.2,
  centerShiftYPercent: 1.8,
  playerSpreadXPercent: 42,
  playerSpreadYPercent: 39,
  // Neutral adapter value, not a complete match profile: layoutModel.ts supplies this from each profile.
  spreadBoost: 0,
  // Base is zero; MATCH_CENTER_OVERRIDES_BY_PLAYER_COUNT[6] is 7, desktop overrides it to 20.
  sideVerticalSpreadBoost: 0,
  maxJitterPx: 4,
  maxRotationOffsetDeg: 6,
  facePlayerRotation: false,
};

export type TrickLayout = typeof DEFAULT_TRICK_LAYOUT;

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

export function getStackOffset({ index, total, open, openSpreadRatio }: {
  index: number; total: number; open: boolean; openSpreadRatio: number;
}) {
  const center = (total - 1) / 2;
  const delta = index - center;
  if (open) return { xCardWidths: delta * openSpreadRatio, xPx: 0, y: -Math.abs(delta) * 4 };
  return { xCardWidths: 0, xPx: delta * 4, y: Math.abs(delta) * 1.5 };
}

export function getPlayerStackPosition({ geometry, centerShiftXPercent, centerShiftYPercent,
  playerSpreadXPercent, playerSpreadYPercent, spreadBoost, sideVerticalSpreadBoost,
}: Pick<TrickLayout, 'centerShiftXPercent' | 'centerShiftYPercent' | 'playerSpreadXPercent' |
  'playerSpreadYPercent' | 'spreadBoost' | 'sideVerticalSpreadBoost'> & { geometry: TrickSeatGeometry }) {
  return {
    x: 50 + centerShiftXPercent + geometry.cos * (playerSpreadXPercent + spreadBoost),
    y: 50 + centerShiftYPercent + geometry.sin *
      (playerSpreadYPercent + spreadBoost + geometry.sideStrength * sideVerticalSpreadBoost),
  };
}

export const getTrickCardKey = (roundIdx: number, played: Pick<TrickPlay, 'player' | 'card'>) =>
  `${roundIdx}-${played.player.key}-${played.card}`;

export function buildTrickPlayOrder(rounds: readonly (readonly TrickPlay[])[]) {
  const playOrder: Record<string, number> = {};
  let nextPlayOrder = 1;
  rounds.forEach((round, roundIdx) => {
    round.forEach((played) => {
      playOrder[getTrickCardKey(roundIdx, played)] = nextPlayOrder;
      nextPlayOrder += 1;
    });
  });
  return playOrder;
}

/** Groups up to three cards per player; revealed cards come from the caller, not a match. */
export function getPlayerTableCards(
  rounds: readonly (readonly TrickPlay[])[],
  revealedCards: Readonly<Record<string, readonly Omit<TrickCard, 'roundIdx'>[]>> = {},
) {
  const cardsByPlayerKey: Record<string, TrickCard[]> = Object.create(null);
  rounds.forEach((round, roundIdx) => {
    round.forEach((played) => {
      const cards = cardsByPlayerKey[played.player.key] ??= [];
      if (cards.length < TRICK_STACK.maxCards) cards.push({ ...played, roundIdx });
    });
  });
  const revealedPlayerKeys = new Set<string>();
  Object.entries(revealedCards).forEach(([playerKey, revealed]) => {
    revealedPlayerKeys.add(playerKey);
    const cards = cardsByPlayerKey[playerKey] ??= [];
    const visibleCards = new Set(cards.map(({ card }) => card));
    revealed.forEach((card, revealIdx) => {
      if (visibleCards.has(card.card) || cards.length >= TRICK_STACK.maxCards) return;
      visibleCards.add(card.card);
      cards.push({ ...card, roundIdx: rounds.length + revealIdx });
    });
  });
  return { cardsByPlayerKey, revealedPlayerKeys };
}
