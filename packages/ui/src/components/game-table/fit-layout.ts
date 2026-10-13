export interface BoardContentSize { width: number; height: number; minimumScale?: number }

/** Card width matches GameCard sm. Clearance is expendable; card/target floors are not. */
export const GAME_TABLE_LIMITS = { minimumCardWidthPx: 32, minimumClearancePx: 0 } as const;

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
  clearance?: { requestedStart: number; requestedEnd: number; start: number; end: number };
}

// One shape policy for every viewport and seat count, not reference-profile corrections.
export const BOARD_CURVE = { nearSquareRatio: 1.15, maxAxisRatio: 1.5 } as const;
const AXIS_EPSILON = 1e-10;
const SCALE_SEARCH_STEPS = 28;

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
    return {
      x, y, theta, rotation: 0,
      minimumScale: Math.max(measurement.minimumScale, size.minimumScale ?? 0),
      width: size.width,
      height: size.height,
    };
  });

  // Each region has its own floor: lg seat cards can shrink while sm community
  // cards remain at their minimum. A single global scale cannot honor both.
  const atScale = (preferredScale: number) => {
    const scaled = positions.map((seat) => {
      const scale = Math.max(preferredScale, seat.minimumScale);
      return { ...seat, scale, width: seat.width * scale, height: seat.height * scale };
    });
    const centerScale = Math.max(preferredScale, measurement.minimumScale, center.minimumScale ?? 0);
    const centerWidth = center.width * centerScale;
    const centerHeight = center.height * centerScale;
    let lower = 0;
    let upper = Math.min(halfWidth / axisX, halfHeight / axisY);
    let contained = centerWidth / 2 + gap <= halfWidth && centerHeight / 2 + gap <= halfHeight;
    for (const [index, seat] of scaled.entries()) {
      contained &&= seat.width / 2 + gap <= halfWidth && seat.height / 2 + gap <= halfHeight;
      upper = Math.min(upper,
        along(halfWidth - seat.width / 2 - gap, seat.x),
        along(halfHeight - seat.height / 2 - gap, seat.y));
      if (centerWidth > 0 && centerHeight > 0) {
        lower = Math.max(lower, Math.min(
          along((seat.width + centerWidth) / 2 + gap, seat.x),
          along((seat.height + centerHeight) / 2 + gap, seat.y)));
      }
      for (const other of scaled.slice(index + 1)) {
        lower = Math.max(lower, Math.min(
          along((seat.width + other.width) / 2 + gap, seat.x - other.x),
          along((seat.height + other.height) / 2 + gap, seat.y - other.y)));
      }
    }
    return { scaled, centerScale, radius: Math.max(0, upper), fits: contained && upper >= lower && shorter > 0 };
  };
  const floor = atScale(0);
  let scale = 0;
  if (floor.fits) {
    let low = 0;
    let high = 1;
    if (atScale(high).fits) low = high;
    else for (let step = 0; step < SCALE_SEARCH_STEPS; step++) {
      const candidate = (low + high) / 2;
      if (atScale(candidate).fits) low = candidate;
      else high = candidate;
    }
    scale = low;
  }
  const { scaled, centerScale, radius, fits } = atScale(scale);
  return {
    scale, fits, gap, centerScale,
    radiusX: axisX * radius, radiusY: axisY * radius,
    positions: scaled.map((seat) => ({
      scale: seat.scale,
      x: radius * seat.x, y: radius * seat.y,
      angleRad: seat.theta, rotationDeg: 0,
    })),
  };
}
