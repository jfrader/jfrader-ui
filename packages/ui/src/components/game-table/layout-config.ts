import type {
  BoardPlayerCount, BoardSeatGeometryConfig, BoardSurfaceFrameConfig, BoardViewportProfile,
  HiddenHandRadialRules, MatchSeatPresentationRules, TablePointsPlacementRules,
} from './types';

export const DEFAULT_SEAT_CONFIG: BoardSeatGeometryConfig = {
  radiusXMultiplier: 1, radiusYMultiplier: 1, sideWeightedYMultiplier: false,
  outwardOffsetX: 0, outwardOffsetY: 0, sideInset: 0, sideVerticalOffset: 0,
  angleOffsetDeg: 0, sideAngleOffsetDeg: 0, topGroupShiftYPx: 0, bottomGroupShiftYPx: 0,
};

export const MATCH_SEAT_OVERRIDES: Partial<Record<BoardPlayerCount, Partial<BoardSeatGeometryConfig>>> = {
  2: { angleOffsetDeg: -14, sideAngleOffsetDeg: -14 },
  4: { angleOffsetDeg: -16, sideAngleOffsetDeg: -22 },
};

const PHONE_TALL_FRAME: BoardSurfaceFrameConfig = {
  boardWidth: 'min(calc(100% - 0.45rem), 56rem)', boardMaxWidth: 'calc(100% - 0.45rem)',
  boardHeight: 'min(88%, 41rem)', boardMaxHeight: '54vh', boardAspectRatio: 'auto',
  boardBorderRadius: '50% / 48%', boardInnerBorderRadius: '50% / 48%',
  boardBorderWidth: '0.72rem', boardOutlineWidth: '0.22rem', centerSize: '53%',
  seatWidth: '34%', seatMaxWidth: '11.5rem',
};

export const FRAMES: Record<BoardViewportProfile, BoardSurfaceFrameConfig> = {
  phoneTall: PHONE_TALL_FRAME,
  phoneCompact: { ...PHONE_TALL_FRAME, boardHeight: 'auto', boardMaxHeight: '62vh', boardAspectRatio: '1 / 1.14' },
  phoneWide: {
    boardWidth: 'auto', boardMaxWidth: 'calc(100% - 1.5rem)', boardHeight: 'min(100%, 18rem)',
    boardMaxHeight: '18rem', boardAspectRatio: '2.15 / 1', boardBorderRadius: '50% / 48%',
    boardInnerBorderRadius: '50% / 48%', boardBorderWidth: '0.72rem', boardOutlineWidth: '0.22rem',
    centerSize: '52%', seatWidth: '33%', seatMaxWidth: '11.2rem',
  },
  tablet: {
    boardWidth: '108%', boardMaxWidth: '46rem', boardHeight: 'auto', boardMaxHeight: '34rem',
    boardAspectRatio: '1 / 1', boardBorderRadius: '50%', boardInnerBorderRadius: '50%',
    boardBorderWidth: '0.9rem', boardOutlineWidth: '0.24rem', centerSize: '55%', seatWidth: '35%', seatMaxWidth: '11.8rem',
  },
  tabletWide: {
    boardWidth: 'min(calc(100% - 2.2rem), 47rem)', boardMaxWidth: 'calc(100% - 2.2rem)',
    boardHeight: 'min(60vh, 39.5rem)', boardMaxHeight: '41rem', boardAspectRatio: '1.2 / 1',
    boardBorderRadius: '50% / 48.6%', boardInnerBorderRadius: '50% / 48.6%',
    boardBorderWidth: '0.86rem', boardOutlineWidth: '0.23rem', centerSize: '53%', seatWidth: '34%', seatMaxWidth: '11.5rem',
  },
  desktop: {
    boardWidth: 'min(calc(100% - 1.5rem), 50rem)', boardMaxWidth: 'calc(100% - 1.5rem)',
    boardHeight: 'min(56vh, 38rem)', boardMaxHeight: '56vh', boardAspectRatio: '1.38 / 1',
    boardBorderRadius: '50% / 48.6%', boardInnerBorderRadius: '50% / 48.6%',
    boardBorderWidth: '0.9rem', boardOutlineWidth: '0.24rem', centerSize: '54%', seatWidth: '33%', seatMaxWidth: '11.8rem',
  },
};

const PHONE_TALL_SEAT: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, outwardOffsetX: 3, outwardOffsetY: 6, sideInset: 3.4,
  sideVerticalOffset: 1.8, topGroupShiftYPx: 28, bottomGroupShiftYPx: 24,
};
export const MATCH_SEATS: Record<BoardViewportProfile, BoardSeatGeometryConfig> = {
  phoneTall: PHONE_TALL_SEAT,
  phoneCompact: { ...PHONE_TALL_SEAT, outwardOffsetY: 3, topGroupShiftYPx: 0, bottomGroupShiftYPx: 8 },
  phoneWide: {
    ...DEFAULT_SEAT_CONFIG, radiusYMultiplier: 0.96, outwardOffsetX: 2, outwardOffsetY: 4,
    sideInset: 2.8, sideVerticalOffset: 1.2, topGroupShiftYPx: 20, bottomGroupShiftYPx: 18,
  },
  tablet: {
    ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.07, radiusYMultiplier: 1.08,
    outwardOffsetX: 6, outwardOffsetY: 12, sideInset: 5.1, sideVerticalOffset: 3.2,
  },
  tabletWide: {
    ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.09, radiusYMultiplier: 1.08,
    outwardOffsetX: 5, outwardOffsetY: 11, sideInset: 4.9, sideVerticalOffset: 3,
  },
  desktop: {
    ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.1, radiusYMultiplier: 1.12,
    outwardOffsetX: 4, outwardOffsetY: 10, sideInset: 4.5, sideVerticalOffset: 2.8,
  },
};

const PHONE_LOBBY_SIX: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 0.94, radiusYMultiplier: 1.1, sideWeightedYMultiplier: true,
  sideInset: 3.8, sideVerticalOffset: 14, topGroupShiftYPx: 34, bottomGroupShiftYPx: 34,
};
const PHONE_LOBBY_FOUR: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.03, radiusYMultiplier: 1.08,
  outwardOffsetX: 2, outwardOffsetY: 6.5, sideInset: 2.8, angleOffsetDeg: -45,
  topGroupShiftYPx: 54, bottomGroupShiftYPx: 48,
};
const WIDE_LOBBY_FOUR: BoardSeatGeometryConfig = {
  ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 1.02, radiusYMultiplier: 1.04,
  outwardOffsetX: 1.5, outwardOffsetY: 4.5, sideInset: 2.4, angleOffsetDeg: -45,
  topGroupShiftYPx: 44, bottomGroupShiftYPx: 40,
};
const DESKTOP_SPARSE_LOBBY_SEAT = { ...DEFAULT_SEAT_CONFIG, outwardOffsetY: 32 };
export const LOBBY_SEATS: Record<BoardViewportProfile, Partial<Record<BoardPlayerCount, BoardSeatGeometryConfig>>> = {
  phoneCompact: { 4: PHONE_LOBBY_FOUR, 6: PHONE_LOBBY_SIX },
  phoneTall: { 4: PHONE_LOBBY_FOUR, 6: PHONE_LOBBY_SIX },
  phoneWide: { 4: WIDE_LOBBY_FOUR, 6: PHONE_LOBBY_SIX },
  tablet: {
    4: PHONE_LOBBY_FOUR,
    6: { ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 0.96, radiusYMultiplier: 1.05,
      sideWeightedYMultiplier: true, sideInset: 3.3, sideVerticalOffset: 2.4, topGroupShiftYPx: 34, bottomGroupShiftYPx: 34 },
  },
  tabletWide: {
    4: WIDE_LOBBY_FOUR,
    6: { ...DEFAULT_SEAT_CONFIG, radiusXMultiplier: 0.98, radiusYMultiplier: 1.03,
      sideWeightedYMultiplier: true, sideInset: 2.8, sideVerticalOffset: 2, topGroupShiftYPx: 24, bottomGroupShiftYPx: 24 },
  },
  desktop: {
    2: DESKTOP_SPARSE_LOBBY_SEAT, 4: DESKTOP_SPARSE_LOBBY_SEAT,
    6: { ...DEFAULT_SEAT_CONFIG, radiusYMultiplier: 1.02, sideWeightedYMultiplier: true,
      outwardOffsetY: 44, sideInset: 2.6, sideVerticalOffset: 1.8, topGroupShiftYPx: -22, bottomGroupShiftYPx: -22 },
  },
};

export const DEFAULT_HIDDEN_HAND_RADIAL_RULES: HiddenHandRadialRules = {
  tableInsetPx: 62, axialInsetReductionPx: 22, distanceScale: 0.82, verticalLiftPx: 1.5,
  fanSpacingPx: 11, fanArcDepthPx: 1.9, fanSpreadDeg: 6.3, minClearancePx: 9, handOrigin: '50% 114%',
};
export const DEFAULT_TABLE_POINTS_PLACEMENT_RULES: TablePointsPlacementRules = {
  sideOffsetDesktopPx: 92, sideOffsetMobilePx: 64, sideOffsetMobileByPlayerCount: { 2: 80, 4: 64, 6: 52 },
  inwardNudgeByPlayerCount: { 2: -34, 4: -10, 6: -24 },
  radialInsetDesktopPx: 80, radialInsetMobilePx: 56, tangentialOffsetDesktopPx: 40, tangentialOffsetMobilePx: 28,
  seatAdjustments: {
    bottom: { radialDesktopPx: 0, radialMobilePx: 0, tangentialDesktopPx: 16, tangentialMobilePx: 20 },
    front: { radialDesktopPx: 20, radialMobilePx: 28, tangentialDesktopPx: 20, tangentialMobilePx: -8 },
    neutral: { radialDesktopPx: 0, radialMobilePx: 0, tangentialDesktopPx: 0, tangentialMobilePx: 0 },
  },
  tiltDesktopDeg: 10, tiltMobileDeg: 24, imageHeightDesktop: '1.35rem', imageHeightMobile: '1.1rem', pileGap: '0.24rem',
};

const PHONE_TALL_PRESENTATION: MatchSeatPresentationRules = {
  avatarFrameSizePx: 58, meTranslateY: 20, lowerSideTranslateY: 24, topSeatAvatarNudgeY: 0,
  hideTopSeatAvatarNudgeOnProfiles: ['phoneTall'], hiddenHandCardWidth: 'clamp(1.9rem, 5.35vw, 2.1rem)',
  hiddenHandScale: 1,
  hiddenHandRules: { ...DEFAULT_HIDDEN_HAND_RADIAL_RULES, tableInsetPx: 42, distanceScale: 0.7 },
  tablePoints: { imageHeightMobile: '1.16rem' },
};
const BASE_PRESENTATION: MatchSeatPresentationRules = {
  avatarFrameSizePx: 56, meTranslateY: 22, lowerSideTranslateY: 24, topSeatAvatarNudgeY: 0,
  hideTopSeatAvatarNudgeOnProfiles: [], hiddenHandCardWidth: 'clamp(1.82rem, 5.1vw, 2.02rem)',
  hiddenHandScale: 1, hiddenHandRules: DEFAULT_HIDDEN_HAND_RADIAL_RULES,
};
export const MATCH_PRESENTATIONS: Record<BoardViewportProfile, MatchSeatPresentationRules> = {
  phoneTall: PHONE_TALL_PRESENTATION,
  phoneCompact: { ...PHONE_TALL_PRESENTATION, topSeatAvatarNudgeY: -28 },
  phoneWide: {
    ...BASE_PRESENTATION, meTranslateY: 16, lowerSideTranslateY: 18,
    hiddenHandCardWidth: 'clamp(0.68rem, 2vw, 0.8rem)',
    hiddenHandRules: { tableInsetPx: 32, axialInsetReductionPx: 20, distanceScale: 0.73, verticalLiftPx: 1.4,
      fanSpacingPx: 10.3, fanArcDepthPx: 1.8, fanSpreadDeg: 6, minClearancePx: 8.5, handOrigin: '50% 112%' },
    tablePoints: { imageHeightMobile: '0.64rem', inwardNudgeByPlayerCount: { 2: -34, 4: -10, 6: -10 } },
  },
  tablet: {
    ...BASE_PRESENTATION, meTranslateY: 20,
    hiddenHandRules: { tableInsetPx: 64, axialInsetReductionPx: 23, distanceScale: 0.93, verticalLiftPx: 1.8,
      fanSpacingPx: 11.4, fanArcDepthPx: 2, fanSpreadDeg: 6.6, minClearancePx: 9.5, handOrigin: '50% 116%' },
  },
  tabletWide: {
    ...BASE_PRESENTATION,
    hiddenHandRules: { tableInsetPx: 68, axialInsetReductionPx: 29, distanceScale: 0.96, verticalLiftPx: 0,
      fanSpacingPx: 12, fanArcDepthPx: 2.2, fanSpreadDeg: 7, minClearancePx: 10, handOrigin: '50% 117%' },
  },
  desktop: {
    ...BASE_PRESENTATION,
    hiddenHandRules: { tableInsetPx: 72, axialInsetReductionPx: 36, distanceScale: 1, verticalLiftPx: 2.2,
      fanSpacingPx: 12.6, fanArcDepthPx: 2.3, fanSpreadDeg: 7.4, minClearancePx: 10.5, handOrigin: '50% 118%' },
  },
};
