// Geometry ported from trucoshi-client-private, packages/core/src/match/handFan.ts
// and packages/core/src/board/hiddenHand.ts. Object proportions, not theme scales.
export const HAND_CARD_OVERLAP_SPACING = -1.32;
export const HAND_FAN_DROP_PX = 2;
// SKILL.md §7 (Target size): library controls keep a 32px+ main-axis target.
// Clamp overlap to leave this strip exposed: sm cannot use the reference's
// 10.56px overlap without reducing its selectable width below that policy.
export const HAND_SELECTION_TARGET_PX = 32;
export const OPPONENT_SEAT_METRICS = { avatarSizePx: 56, nameBlockPx: 28 } as const;
export const HAND_FAN_MAX_ROTATION_DEG = 10;
export const getHandFanRotations = (count: number) =>
  Array.from({ length: count }, (_, index) => count <= 1 ? 0 : (index / (count - 1) * 2 - 1) * (count === 2 ? 7 : HAND_FAN_MAX_ROTATION_DEG));

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
  geometry, rules, hiddenCardCount, avatarSizePx, nameBlockPx, scale = 1,
}: {
  geometry: HandPolarVector;
  rules: HiddenHandRules;
  hiddenCardCount: number;
  avatarSizePx: number;
  nameBlockPx: number;
  scale?: number;
}) {
  const count = Number.isFinite(hiddenCardCount) ? Math.max(0, Math.floor(hiddenCardCount)) : 0;
  const inward = { x: -geometry.cos, y: -geometry.sin };
  const ruleScale = scale * rules.distanceScale;
  const axialInsetPx = rules.axialInsetReductionPx * (1 - geometry.sideStrength);
  const tableInsetPx = Math.max(0, rules.tableInsetPx - axialInsetPx) * ruleScale;
  const clearancePx = avatarSizePx * 0.5 + nameBlockPx * 0.32 + rules.minClearancePx * ruleScale;
  const anchorDistance = Math.max(tableInsetPx, clearancePx) + rules.verticalLiftPx * ruleScale;
  const anchor = {
    x: inward.x * anchorDistance,
    y: inward.y * anchorDistance,
    rotateDeg: Math.atan2(inward.y, inward.x) * 180 / Math.PI + 90,
    origin: rules.handOrigin,
  };
  const slots = Array.from({ length: count }, (_, index) => index - (count - 1) / 2);
  const outerSlot = Math.max(0, (count - 1) / 2);
  const cards = count ? slots.map((slot, index) => ({
    x: slot * rules.fanSpacingPx * scale,
    y: (Math.abs(slot) - outerSlot) * rules.fanArcDepthPx * scale,
    rotateDeg: slot * rules.fanSpreadDeg,
    zIndex: 100 + index,
  })) : [];
  return { anchor, cards };
}

export function getOpponentSeatHandTransform({
  polar, hiddenHandScale = 1, hiddenHandRules = DEFAULT_HIDDEN_HAND_RULES,
}: { polar: HandPolarVector; hiddenHandScale?: number; hiddenHandRules?: HiddenHandRules }) {
  const { anchor } = buildOpponentHiddenHandLayout({
    geometry: polar, rules: hiddenHandRules, hiddenCardCount: 0,
    ...OPPONENT_SEAT_METRICS, scale: hiddenHandScale,
  });
  return { x: anchor.x, y: anchor.y, rotate: anchor.rotateDeg, origin: anchor.origin };
}
