export type BoardSurface = 'match' | 'lobby';

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
}
/** Measured seat coordinates. Children own avatar, hand, point and card-pile presentation. */
export interface BoardLayoutModel {
  surface: BoardSurface;
  playerCount: number;
  seatConfig: BoardSeatGeometryConfig;
  fit: 'measuring' | 'fitted' | 'scaled' | 'insufficient-space';
  seatGeometries: BoardSeatGeometry[];
}
