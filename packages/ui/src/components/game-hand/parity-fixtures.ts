// Expected values evaluated directly from read-only trucoshi-client-private sources.
// Source commits verified with git log --follow; git show content matches current SHA-256:
// packages/core/src/match/handFan.ts: ee4f7a0cfb06f42203417812184fb2c0b03a996b
// SHA-256: 8c9dd58f64fd8ca7ba92acdffda710762f4cd35377e562bcf309f9825a90439f
// packages/core/src/board/hiddenHand.ts: f3c8d4ee0d140985df133161a8276f1404f087f3
// SHA-256: d2878e9549cc674c516c101824d0d4330ca40de6369a9c3f9d2bf229eda6375b
// packages/core/src/board/config/defaults.ts: f3c8d4ee0d140985df133161a8276f1404f087f3
// SHA-256: 18d2b6ec9984d10ee58f18ed0689ba9ea432978b295d2122bf98c5bb1466d70d
// Seat adapter: src/components/game/seatHandLayout.ts at f3c8d4ee (polar -> geometry,
// unchanged vector). Hardcoded across repos to keep expected values independent of
// the library's implementation and avoid a runtime dependency on the private repo.
// Seat coordinates are rounded to two decimals; parity tests use toBeCloseTo.
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
  { polar: { cos: 1, sin: 0, sideStrength: 1 }, transform: { x: -52.07, y: 0, rotate: -90, origin: '50% 114%' } },
  { polar: { cos: -1, sin: 0, sideStrength: 1 }, transform: { x: 52.07, y: 0, rotate: 90, origin: '50% 114%' } },
];
