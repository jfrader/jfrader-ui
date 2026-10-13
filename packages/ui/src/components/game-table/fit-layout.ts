export interface BoardContentSize { width: number; height: number }

/** Local CSS pixels, before ancestor transforms and before the table's content scale. */
export interface BoardMeasurements {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  seats: readonly BoardContentSize[];
  center: BoardContentSize;
  gap: number;
  minimumScale: number;
}

// One shape policy for every viewport and seat count, not reference-profile corrections.
export const BOARD_CURVE = { nearSquareRatio: 1.15, maxAxisRatio: 1.5 } as const;
const AXIS_EPSILON = 1e-10;

const along = (distance: number, direction: number) =>
  Math.abs(direction) < AXIS_EPSILON ? Infinity : distance / Math.abs(direction);

export function fitBoardContent(measurement: BoardMeasurements) {
  const { width, height, centerX, centerY, seats, center, gap } = measurement;
  const halfWidth = Math.max(0, Math.min(centerX, width - centerX));
  const halfHeight = Math.max(0, Math.min(centerY, height - centerY));
  const shorter = Math.min(halfWidth, halfHeight);
  const ratio = shorter > 0 ? Math.max(halfWidth, halfHeight) / shorter : 1;
  const stretch = Math.min(BOARD_CURVE.maxAxisRatio, Math.max(1, ratio - BOARD_CURVE.nearSquareRatio + 1));
  const axisX = halfWidth > halfHeight ? stretch : 1;
  const axisY = halfHeight > halfWidth ? stretch : 1;
  const positions = seats.map((size, index) => {
    const theta = Math.PI / 2 + 2 * Math.PI * index / seats.length;
    const x = axisX * Math.cos(theta);
    const y = axisY * Math.sin(theta);
    const rotation = Math.atan2(y, x) - Math.PI / 2;
    return {
      x, y, theta, rotation,
      width: Math.abs(Math.cos(rotation)) * size.width + Math.abs(Math.sin(rotation)) * size.height,
      height: Math.abs(Math.sin(rotation)) * size.width + Math.abs(Math.cos(rotation)) * size.height,
    };
  });

  // At scale s, separation requires r >= s*lower. AABB separation needs either
  // axis clear, so each pair contributes min(x bound, y bound), not their max.
  let lower = 0;
  for (const [index, seat] of positions.entries()) {
    if (center.width > 0 && center.height > 0) {
      lower = Math.max(lower, Math.min(
        along((seat.width + center.width) / 2 + gap, seat.x),
        along((seat.height + center.height) / 2 + gap, seat.y),
      ));
    }
    for (const other of positions.slice(index + 1)) {
      lower = Math.max(lower, Math.min(
        along((seat.width + other.width) / 2 + gap, seat.x - other.x),
        along((seat.height + other.height) / 2 + gap, seat.y - other.y),
      ));
    }
  }

  // Combining r >= s*lower with containment gives a closed-form maximum scale.
  // Cards, text, chrome and their internal spacing keep their intrinsic proportions.
  const limits = [1];
  if (center.width > 0) limits.push(halfWidth / (center.width / 2 + gap));
  if (center.height > 0) limits.push(halfHeight / (center.height / 2 + gap));
  for (const seat of positions) {
    limits.push(
      halfWidth / (lower * Math.abs(seat.x) + seat.width / 2 + gap),
      halfHeight / (lower * Math.abs(seat.y) + seat.height / 2 + gap),
    );
  }
  const fittingScale = Math.max(0, Math.min(...limits));
  const scale = Math.max(fittingScale, measurement.minimumScale);
  const fits = fittingScale >= measurement.minimumScale && shorter > 0;
  let radius = Math.min(halfWidth / axisX, halfHeight / axisY);
  for (const seat of positions) {
    radius = Math.min(radius,
      along(halfWidth - scale * (seat.width / 2 + gap), seat.x),
      along(halfHeight - scale * (seat.height / 2 + gap), seat.y),
    );
  }
  radius = Math.max(0, radius);
  return {
    scale, fittingScale, fits, gap: gap * scale,
    radiusX: axisX * radius, radiusY: axisY * radius,
    positions: positions.map((seat) => ({
      x: radius * seat.x, y: radius * seat.y,
      angleRad: seat.theta, rotationDeg: seat.rotation * 180 / Math.PI,
    })),
  };
}
