export type BoardSurface = 'match' | 'lobby';
export type BoardViewportProfile = 'phoneCompact' | 'phoneTall' | 'phoneWide' | 'tablet' | 'tabletWide' | 'desktop';
export type BoardPlayerCount = 2 | 4 | 6;
export type BoardViewport = { width: number; height: number; aspectRatio: number };

export interface BoardSeatGeometryConfig {
  radiusXMultiplier: number;
  radiusYMultiplier: number;
  sideWeightedYMultiplier: boolean;
  outwardOffsetX: number;
  outwardOffsetY: number;
  sideInset: number;
  sideVerticalOffset: number;
  angleOffsetDeg: number;
  sideAngleOffsetDeg: number;
  topGroupShiftYPx: number;
  bottomGroupShiftYPx: number;
}

export interface BoardSeatGeometry {
  index: number;
  totalSeats: number;
  angleDeg: number;
  angleRad: number;
  cos: number;
  sin: number;
  sideStrength: number;
  leftPercent: number;
  topPercent: number;
  groupShiftY: number;
  seatShiftX: number;
  seatShiftY: number;
}

export interface BoardSurfaceFrameConfig {
  boardWidth: string;
  boardMaxWidth: string;
  boardHeight: string;
  boardMaxHeight: string;
  boardAspectRatio: string;
  boardBorderRadius: string;
  boardInnerBorderRadius: string;
  boardBorderWidth: string;
  boardOutlineWidth: string;
  centerSize: string;
  seatWidth: string;
  seatMaxWidth: string;
}

export interface HiddenHandRadialRules {
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

export type TablePointsSeatRole = 'bottom' | 'front' | 'neutral';
export interface TablePointsPlacementRules {
  sideOffsetDesktopPx: number;
  sideOffsetMobilePx: number;
  sideOffsetMobileByPlayerCount: Record<BoardPlayerCount, number>;
  inwardNudgeByPlayerCount: Record<BoardPlayerCount, number>;
  radialInsetDesktopPx: number;
  radialInsetMobilePx: number;
  tangentialOffsetDesktopPx: number;
  tangentialOffsetMobilePx: number;
  seatAdjustments: Record<TablePointsSeatRole, {
    radialDesktopPx: number;
    radialMobilePx: number;
    tangentialDesktopPx: number;
    tangentialMobilePx: number;
  }>;
  tiltDesktopDeg: number;
  tiltMobileDeg: number;
  imageHeightDesktop: string;
  imageHeightMobile: string;
  pileGap: string;
}

export interface MatchSeatPresentation {
  avatarFrameSizePx: number;
  translateY: number;
  avatarNudgeY: number;
  hiddenHandCardWidth: string;
  hiddenHandScale: number;
  hiddenHandRules: HiddenHandRadialRules;
  tablePoints: TablePointsPlacementRules;
}

export interface MatchSeatPresentationRules {
  avatarFrameSizePx: number;
  meTranslateY: number;
  lowerSideTranslateY: number;
  topSeatAvatarNudgeY: number;
  hideTopSeatAvatarNudgeOnProfiles: readonly BoardViewportProfile[];
  hiddenHandCardWidth: string;
  hiddenHandScale: number;
  hiddenHandRules: HiddenHandRadialRules;
  tablePoints?: Partial<TablePointsPlacementRules>;
}

/** Table geometry only; hand, card-pile and command layouts belong to their consumers. */
export interface BoardLayoutModel {
  surface: BoardSurface;
  profile: BoardViewportProfile;
  playerCount: BoardPlayerCount;
  viewport: BoardViewport;
  frame: BoardSurfaceFrameConfig;
  seatConfig: BoardSeatGeometryConfig;
  seatGeometries: BoardSeatGeometry[];
  match: { seatPresentation: MatchSeatPresentationRules } | null;
}
