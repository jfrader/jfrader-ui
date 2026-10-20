export interface BoardContentSize { width: number; height: number; minimumScale?: number }

/** Clearance is expendable. Only interactive controls impose a scale floor. */
export const GAME_TABLE_LIMITS = { minimumClearancePx: 0 } as const;

/** Local CSS pixels, before ancestor transforms and before the table's content scale. */
export interface BoardMeasurements {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  seats: readonly BoardContentSize[];
  plays?: readonly BoardContentSize[];
  seatPlacement?: 'inside' | 'edge' | 'outside';
  /** Available shell padding box relative to the surface centre, in local pixels. */
  available?: { left: number; right: number; top: number; bottom: number };
  surfaceBorderBox?: BoardContentSize;
  direction?: 'ltr' | 'rtl';
  center: BoardContentSize;
  gap: number;
  minimumScale: number;
  clearance?: { requestedStart: number; requestedEnd: number; start: number; end: number };
}

// One shape policy for every viewport and seat count, not reference-profile corrections.
export const BOARD_CURVE = { nearSquareRatio: 1.15, maxAxisRatio: 1.5 } as const;
const AXIS_EPSILON = 1e-10;
const SCALE_SEARCH_STEPS = 28;
const FIT_TOLERANCE_PX = 0.02;

const along = (distance: number, direction: number) =>
  Math.abs(direction) < AXIS_EPSILON ? Infinity : distance / Math.abs(direction);

export function fitBoardContent(measurement: BoardMeasurements) {
  const { width, height, centerX, centerY, seats, center, gap } = measurement;
  const placement = measurement.seatPlacement ?? 'inside';
  const available = measurement.available ?? { left: centerX, right: width - centerX, top: centerY, bottom: height - centerY };
  const halfWidth = Math.max(0, Math.min(centerX, width - centerX));
  const halfHeight = Math.max(0, Math.min(centerY, height - centerY));
  const shorter = Math.min(halfWidth, halfHeight);
  const ratio = shorter > 0 ? Math.max(halfWidth, halfHeight) / shorter : 1;
  const stretch = Math.min(BOARD_CURVE.maxAxisRatio, Math.max(1, ratio - BOARD_CURVE.nearSquareRatio + 1));
  const surfaceWidth = measurement.surfaceBorderBox?.width ?? width;
  const surfaceHeight = measurement.surfaceBorderBox?.height ?? height;
  const surfaceShorter = Math.min(surfaceWidth, surfaceHeight);
  const axisX = placement !== 'inside' ? surfaceWidth / surfaceShorter : halfWidth > halfHeight ? stretch : 1;
  const axisY = placement !== 'inside' ? surfaceHeight / surfaceShorter : halfHeight > halfWidth ? stretch : 1;
  const positions = seats.map((size, index) => {
    const theta = Math.PI / 2 + 2 * Math.PI * index / seats.length;
    const x = axisX * Math.cos(theta);
    const y = axisY * Math.sin(theta);
    return {
      x, y, theta, rotation: 0,
      minimumScale: Math.max(measurement.minimumScale, size.minimumScale ?? 0),
      width: size.width,
      height: size.height,
      play: measurement.plays?.[index] ?? { width: 0, height: 0, minimumScale: 0 },
    };
  });

  // Preferred content sizes yield independently to each region's control floor.
  const atScale = (preferredScale: number) => {
    const scaled = positions.map((seat) => {
      const scale = Math.max(preferredScale, seat.minimumScale);
      const playScale = Math.max(preferredScale, measurement.minimumScale, seat.play.minimumScale ?? 0);
      return { ...seat, scale, width: seat.width * scale, height: seat.height * scale,
        playScale, playWidth: seat.play.width * playScale, playHeight: seat.play.height * playScale };
    });
    const centerScale = Math.max(preferredScale, measurement.minimumScale, center.minimumScale ?? 0);
    const centerWidth = center.width * centerScale;
    const centerHeight = center.height * centerScale;
    let lower = 0;
    let upper = Infinity;
    let contained = centerWidth / 2 + gap <= halfWidth && centerHeight / 2 + gap <= halfHeight;
    for (const [index, seat] of scaled.entries()) {
      const length = Math.hypot(seat.x, seat.y);
      const ux = seat.x / length;
      const uy = seat.y / length;
      const extent = (Math.abs(ux) * seat.width + Math.abs(uy) * seat.height) / 2;
      const outwardOffset = placement === 'outside' ? extent : 0;
      const surfaceRadius = 1 / Math.hypot(ux / (measurement.surfaceBorderBox?.width ? measurement.surfaceBorderBox.width / 2 : halfWidth),
        uy / (measurement.surfaceBorderBox?.height ? measurement.surfaceBorderBox.height / 2 : halfHeight));
      // Trucoshi puts content at the felt edge; the old port contained it.
      // The measured surface ellipse deliberately replaces reference offsets
      // and the containment-only default, preserving floors and root bounds.
      if (placement !== 'inside') {
        const placementRadius = surfaceRadius / length;
        upper = Math.min(upper, placementRadius);
        lower = Math.max(lower, placementRadius);
      }
      upper = Math.min(upper,
        along((seat.x < 0 ? available.left : available.right) - seat.width / 2 - Math.abs(ux) * outwardOffset, seat.x),
        along((seat.y < 0 ? available.top : available.bottom) - seat.height / 2 - Math.abs(uy) * outwardOffset, seat.y));
      if (placement === 'inside') upper = Math.min(upper,
        along(halfWidth - seat.width / 2 - gap, seat.x), along(halfHeight - seat.height / 2 - gap, seat.y));
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
    const radius = Math.max(0, upper);
    const regions = scaled.map((seat) => {
      const length = Math.hypot(seat.x, seat.y);
      const ux = seat.x / length;
      const uy = seat.y / length;
      const extent = (Math.abs(ux) * seat.width + Math.abs(uy) * seat.height) / 2;
      const offset = placement === 'outside' ? extent : 0;
      const region = { x: radius * seat.x + ux * offset, y: radius * seat.y + uy * offset, width: seat.width, height: seat.height };
      contained &&= region.x - region.width / 2 >= -available.left - FIT_TOLERANCE_PX &&
        region.x + region.width / 2 <= available.right + FIT_TOLERANCE_PX &&
        region.y - region.height / 2 >= -available.top - FIT_TOLERANCE_PX &&
        region.y + region.height / 2 <= available.bottom + FIT_TOLERANCE_PX;
      if (placement === 'inside') contained &&= Math.abs(region.x) + region.width / 2 + gap <= halfWidth + FIT_TOLERANCE_PX &&
        Math.abs(region.y) + region.height / 2 + gap <= halfHeight + FIT_TOLERANCE_PX;
      return region;
    });
    const plays = scaled.map((seat, index) => {
      const length = Math.hypot(seat.x, seat.y);
      const ux = seat.x / length;
      const uy = seat.y / length;
      const active = seat.playWidth > 0 && seat.playHeight > 0;
      const seatDistance = Math.hypot(regions[index]!.x, regions[index]!.y);
      const separation = Math.min(along((seat.width + seat.playWidth) / 2 + gap, ux),
        along((seat.height + seat.playHeight) / 2 + gap, uy));
      const distance = Math.min(seatDistance - separation,
        along(halfWidth - seat.playWidth / 2 - gap, ux), along(halfHeight - seat.playHeight / 2 - gap, uy));
      const play = { x: ux * distance, y: uy * distance, width: seat.playWidth, height: seat.playHeight };
      if (active) {
        contained &&= distance >= 0 && Math.abs(play.x) + play.width / 2 <= halfWidth && Math.abs(play.y) + play.height / 2 <= halfHeight;
      }
      return { ...play, scale: seat.playScale, active, index };
    });
    const occupied = [...regions, ...plays.filter((play) => play.active), { x: 0, y: 0, width: centerWidth, height: centerHeight }].filter((region) => region.width > 0 && region.height > 0);
    for (const [index, region] of occupied.entries()) for (const other of occupied.slice(index + 1)) {
      contained &&= Math.abs(region.x - other.x) + AXIS_EPSILON >= (region.width + other.width) / 2 + gap ||
        Math.abs(region.y - other.y) + AXIS_EPSILON >= (region.height + other.height) / 2 + gap;
    }
    return { scaled, regions, plays, centerScale, radius, fits: contained && upper + FIT_TOLERANCE_PX >= lower && shorter > 0 };
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
  const { scaled, regions, plays, centerScale, radius, fits } = atScale(scale);
  return {
    scale, fits, gap, centerScale,
    radiusX: axisX * radius, radiusY: axisY * radius,
    playRadiusX: Math.max(0, ...plays.filter((play) => play.active).map((play) => Math.abs(play.x))),
    playRadiusY: Math.max(0, ...plays.filter((play) => play.active).map((play) => Math.abs(play.y))),
    positions: scaled.map((seat, index) => ({
      scale: seat.scale,
      x: regions[index]!.x, y: regions[index]!.y,
      angleRad: seat.theta, rotationDeg: 0,
      playX: plays[index]!.x, playY: plays[index]!.y, playScale: plays[index]!.scale,
    })),
  };
}
