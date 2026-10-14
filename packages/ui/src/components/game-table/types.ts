export type BoardSurface = 'match' | 'lobby';
export type BoardViewportProfile = 'phoneCompact' | 'phoneTall' | 'phoneWide' | 'tablet' | 'tabletWide' | 'desktop';
/** @deprecated Use `number`; seat counts are any integer >= 2. Retained for compatibility. */
export type BoardPlayerCount = number;
export type BoardViewport = { width: number; height: number; aspectRatio: number };

export interface BoardSeatGeometryConfig {
  /** Derived from measured content and space; no per-profile position overrides. */
  radiusX: number;
  radiusY: number;
  playRadiusX: number;
  playRadiusY: number;
  scale: number;
  centerScale: number;
  gap: number;
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
  playLeftPercent: number;
  playTopPercent: number;
  playScale: number;
  rotationDeg: number;
  /** Already applied by the table. Do not apply again inside Seat. */
  scale: number;
  /** @deprecated Preset translations were removed. Always zero. */
  groupShiftY: number;
  /** @deprecated Preset translations were removed. Always zero. */
  seatShiftX: number;
  /** @deprecated Preset translations were removed. Always zero. */
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
  playerCount: number;
  viewport: BoardViewport;
  frame: BoardSurfaceFrameConfig;
  boardTranslateY: string;
  seatConfig: BoardSeatGeometryConfig;
  fit: 'measuring' | 'fitted' | 'insufficient-space';
  seatGeometries: BoardSeatGeometry[];
}
