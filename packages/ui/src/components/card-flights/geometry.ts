import { CARD_PERSPECTIVE } from '../game-card/card-frame';

export interface CardBox {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotate: number;
}

/** Measures the painted center, unrotated size and accumulated ancestor rotation/scale. */
export function measureCardBox(element: HTMLElement): CardBox {
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  let rotate = 0;
  let scale = 1;
  for (let node: HTMLElement | null = element; node && node !== element.ownerDocument.body; node = node.parentElement) {
    const transform = view?.getComputedStyle(node).transform;
    if (transform && transform !== 'none' && view?.DOMMatrixReadOnly) {
      const matrix = new view.DOMMatrixReadOnly(transform);
      rotate += Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      scale *= Math.hypot(matrix.a, matrix.b);
    }
  }
  return {
    cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2,
    width: (element.offsetWidth || rect.width) * scale,
    height: (element.offsetHeight || rect.height) * scale, rotate,
  };
}

// GameTable supplies the surface; GameHand emits card IDs, Hidden emits playerKey + index; GameCardStack owns data-played-key.
export const CARD_FLIGHT_ATTRIBUTES = {
  surface: 'data-game-surface', handCard: 'data-hand-card', hiddenCard: 'data-seat-hidden-card',
  hiddenCardIndex: 'data-seat-hidden-card-index', playedCard: 'data-played-key',
} as const;

export const flightTarget = {
  hand: (cardKey: string) => `hand:${cardKey}`,
  seatCard: (playerKey: string, cardIdx: number) => `seat:${playerKey}:${cardIdx}`,
  played: (playedKey: string) => `played:${playedKey}`,
};

export function findMarker(root: HTMLElement, attribute: string, value: string) {
  return root.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(value)}"]`);
}

export const FLIGHT_GEOMETRY = {
  maxLiftPx: 120, liftRatio: 0.32, peakScale: 1.14, perspectivePx: CARD_PERSPECTIVE.flightPx,
  shadowFadeRatio: 1.5,
  spinDeg: -20,
  flipDurationRatio: 0.7, flipDelayRatio: 0.15, deckWidthRatio: 0.085,
  originTtlMs: 4000,
  easing: [0.22, 1, 0.36, 1] as const,
  offsets: [0, 0.45, 1],
};

export function dealSequence(players: readonly { key: string; idx: number; handSize: number }[], forehandIdx: number) {
  const seated = [...players].sort((a, b) => a.idx - b.idx);
  const start = Math.max(0, seated.findIndex((player) => player.idx === forehandIdx));
  const order = [...seated.slice(start), ...seated.slice(0, start)];
  const handSize = players.reduce((size, player) => Math.max(size, player.handSize), 0);
  return Array.from({ length: handSize }, (_, cardIdx) => order
    .filter((player) => cardIdx < player.handSize)
    .map((player) => ({ playerKey: player.key, cardIdx }))).flat();
}
