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
  rootPadding: string;
  shellMaxWidth: string;
  topStripGap: string;
  topStripMarginBottom: string;
  bottomStripMarginTop: string;
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
/** Surface framing and seat coordinates only. Children own avatar, hand, point and card-pile presentation. */
export interface BoardLayoutModel {
  surface: BoardSurface;
  profile: BoardViewportProfile;
  playerCount: BoardPlayerCount;
  viewport: BoardViewport;
  frame: BoardSurfaceFrameConfig;
  boardTranslateY: string;
  seatConfig: BoardSeatGeometryConfig;
  seatGeometries: BoardSeatGeometry[];
}
