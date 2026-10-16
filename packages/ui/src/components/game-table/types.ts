export type BoardSurface = 'match' | 'lobby';
/** @deprecated Use `number`; seat counts are any integer >= 2. Retained for compatibility. */
export type BoardPlayerCount = number;

export interface BoardSeatGeometryConfig {
  /** Derived from measured content and available space. */
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
/** Measured seat coordinates. Children own avatar, hand, point and card-pile presentation. */
export interface BoardLayoutModel {
  surface: BoardSurface;
  playerCount: number;
  seatConfig: BoardSeatGeometryConfig;
  fit: 'measuring' | 'fitted' | 'insufficient-space';
  seatGeometries: BoardSeatGeometry[];
}
