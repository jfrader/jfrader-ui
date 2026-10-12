// Geometry ported from trucoshi-client-private, packages/core/src/match/handFan.ts
// and packages/core/src/board/hiddenHand.ts. Object proportions, not theme scales.
export const HAND_CARD_OVERLAP_SPACING = -1.32;
export const HAND_FAN_DROP_PX = 2;
export const OPPONENT_SEAT_METRICS = { avatarSizePx: 56, nameBlockPx: 28 } as const;
export const getHandFanRotations = (count: number) =>
  count === 3 ? [-10, 0, 10] : count === 2 ? [-7, 7] : [0];

export interface HandPolarVector {
  cos: number;
  sin: number;
  sideStrength: number;
}

export interface HiddenHandRules {
  tableInsetPx: number;
  axialInsetReductionPx: number;
  distanceScale: number;
  verticalLiftPx: number;
  fanSpacingPx: number;
  fanArcDepthPx: number;
  fanSpreadDeg: number;
  minClearancePx: number;
  handOrigin: string;
}

export const DEFAULT_HIDDEN_HAND_RULES: HiddenHandRules = {
  tableInsetPx: 62,
  axialInsetReductionPx: 22,
  distanceScale: 0.82,
  verticalLiftPx: 1.5,
  fanSpacingPx: 11,
  fanArcDepthPx: 1.9,
  fanSpreadDeg: 6.3,
  minClearancePx: 9,
  handOrigin: '50% 114%',
};

export function buildOpponentHiddenHandLayout({
  geometry, profileRules, hiddenCardCount, avatarSizePx, nameBlockPx, scale = 1,
}: {
  geometry: HandPolarVector;
  profileRules: HiddenHandRules;
  hiddenCardCount: number;
  avatarSizePx: number;
  nameBlockPx: number;
  scale?: number;
}) {
  const count = Number.isFinite(hiddenCardCount) ? Math.max(0, Math.min(3, Math.floor(hiddenCardCount))) : 0;
  const inward = { x: -geometry.cos, y: -geometry.sin };
  const ruleScale = scale * profileRules.distanceScale;
  const axialInsetPx = profileRules.axialInsetReductionPx * (1 - geometry.sideStrength);
  const tableInsetPx = Math.max(0, profileRules.tableInsetPx - axialInsetPx) * ruleScale;
  const clearancePx = avatarSizePx * 0.5 + nameBlockPx * 0.32 + profileRules.minClearancePx * ruleScale;
  const anchorDistance = Math.max(tableInsetPx, clearancePx) + profileRules.verticalLiftPx * ruleScale;
  const anchor = {
    x: inward.x * anchorDistance,
    y: inward.y * anchorDistance,
    rotateDeg: Math.atan2(inward.y, inward.x) * 180 / Math.PI + 90,
    origin: profileRules.handOrigin,
  };
  const slots = count <= 1 ? [0] : count === 2 ? [-0.5, 0.5] : [-1, 0, 1];
  const outerSlot = Math.max(...slots.map(Math.abs));
  const cards = count ? slots.map((slot, index) => ({
    x: slot * profileRules.fanSpacingPx * scale,
    y: (Math.abs(slot) - outerSlot) * profileRules.fanArcDepthPx * scale,
    rotateDeg: slot * profileRules.fanSpreadDeg,
    zIndex: 100 + index,
  })) : [];
  return { anchor, cards };
}

export function getOpponentSeatHandTransform({
  polar, hiddenHandScale = 1, hiddenHandRules = DEFAULT_HIDDEN_HAND_RULES,
}: { polar: HandPolarVector; hiddenHandScale?: number; hiddenHandRules?: HiddenHandRules }) {
  const { anchor } = buildOpponentHiddenHandLayout({
    geometry: polar, profileRules: hiddenHandRules, hiddenCardCount: 3,
    ...OPPONENT_SEAT_METRICS, scale: hiddenHandScale,
  });
  return { x: anchor.x, y: anchor.y, rotate: anchor.rotateDeg, origin: anchor.origin };
}
