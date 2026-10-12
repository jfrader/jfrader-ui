// Expected values evaluated directly from the read-only reference at commit
// 0e7991ce09be3ea26a6db16b59030ffb84fd4709 in trucoshi-client-private:
// packages/core/src/match/handFan.ts; packages/core/src/board/hiddenHand.ts;
// packages/core/src/board/config/defaults.ts. The seat adapter is
// src/components/game/seatHandLayout.ts (polar -> geometry, unchanged vector).
// Inputs: default rules, scale=1, avatarSizePx=56, nameBlockPx=28, MUI spacing=8px.
// Five cards deliberately keep the reference's [0] fallback; missing angles are 0.
export const PLAYER_PARITY = [
  { count: 1, rotations: [0], dropPx: 2, overlapSpacing: -1.32, overlapPx: -10.56 },
  { count: 2, rotations: [-7, 7], dropPx: 2, overlapSpacing: -1.32, overlapPx: -10.56 },
  { count: 3, rotations: [-10, 0, 10], dropPx: 2, overlapSpacing: -1.32, overlapPx: -10.56 },
  { count: 5, rotations: [0], dropPx: 2, overlapSpacing: -1.32, overlapPx: -10.56 },
];

const ONE_BACK = [{ x: 0, y: 0, rotateDeg: 0, zIndex: 100 }];
const TWO_BACKS = [
  { x: -5.5, y: 0, rotateDeg: -3.15, zIndex: 100 },
  { x: 5.5, y: 0, rotateDeg: 3.15, zIndex: 101 },
];
const THREE_BACKS = [
  { x: -11, y: 0, rotateDeg: -6.3, zIndex: 100 },
  { x: 0, y: -1.9, rotateDeg: 0, zIndex: 101 },
  { x: 11, y: 0, rotateDeg: 6.3, zIndex: 102 },
];
export const HIDDEN_PARITY = [
  { count: 0, cards: [] }, { count: 1, cards: ONE_BACK }, { count: 2, cards: TWO_BACKS },
  { count: 3, cards: THREE_BACKS }, { count: 4, cards: THREE_BACKS },
  { count: 2.9, cards: TWO_BACKS }, { count: -1, cards: [] },
];
export const SEAT_PARITY = [
  { polar: { cos: 0, sin: -1, sideStrength: 0 }, transform: { x: 0, y: 45.57, rotate: 180, origin: '50% 114%' } },
  { polar: { cos: 1, sin: 0, sideStrength: 1 }, transform: { x: -52.06999999999999, y: 0, rotate: -90, origin: '50% 114%' } },
  { polar: { cos: -1, sin: 0, sideStrength: 1 }, transform: { x: 52.06999999999999, y: 0, rotate: 90, origin: '50% 114%' } },
];
