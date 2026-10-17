export interface Point {
  x: number;
  y: number;
}

export interface PathSampleTable {
  d: string;
  samples: readonly Point[];
}

/** Evaluates a cubic bezier curve at parameter t in [0, 1]. */
export function evalCubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Precomputes an arc-length normalized lookup table for uniform sampling. */
export function createSampleTable(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  d: string,
  sampleCount: number = 50,
): PathSampleTable {
  const steps = 100;
  const points: Point[] = [];
  const dists: number[] = [0];
  let totalLength = 0;
  let prev = p0;
  points.push(prev);

  for (let i = 1; i <= steps; i++) {
    const curr = evalCubic(p0, p1, p2, p3, i / steps);
    const segDist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    totalLength += segDist;
    dists.push(totalLength);
    points.push(curr);
    prev = curr;
  }

  const samples: Point[] = [];
  if (totalLength === 0) {
    for (let i = 0; i < sampleCount; i++) samples.push(p0);
    return { d, samples };
  }

  let searchIdx = 0;
  for (let i = 0; i < sampleCount; i++) {
    const targetDist = (i / (sampleCount - 1)) * totalLength;
    while (searchIdx < steps && dists[searchIdx + 1]! < targetDist) {
      searchIdx++;
    }
    const d0 = dists[searchIdx]!;
    const d1 = dists[searchIdx + 1] ?? d0;
    const span = d1 - d0;
    const fraction = span > 0 ? (targetDist - d0) / span : 0;
    const pt0 = points[searchIdx]!;
    const pt1 = points[searchIdx + 1] ?? pt0;
    samples.push({
      x: pt0.x + (pt1.x - pt0.x) * fraction,
      y: pt0.y + (pt1.y - pt0.y) * fraction,
    });
  }

  return { d, samples };
}

/** Samples a point along the precomputed curve at progress in [0, 1]. */
export function samplePath(table: PathSampleTable, progress: number): Point {
  const clamped = Math.max(0, Math.min(1, progress));
  const maxIdx = table.samples.length - 1;
  const index = Math.min(maxIdx, Math.max(0, Math.round(clamped * maxIdx)));
  return table.samples[index] ?? table.samples[0]!;
}

/** Builds a horizontal S-curve connecting start to end. */
export function createHorizontalPath(start: Point, end: Point): PathSampleTable {
  const dx = end.x - start.x;
  const c1 = { x: start.x + dx * 0.5, y: start.y };
  const c2 = { x: start.x + dx * 0.5, y: end.y };
  const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  return createSampleTable(start, c1, c2, end, d);
}

/** Builds a vertical S-curve connecting start to end. */
export function createVerticalPath(start: Point, end: Point): PathSampleTable {
  const dy = end.y - start.y;
  const c1 = { x: start.x, y: start.y + dy * 0.5 };
  const c2 = { x: end.x, y: start.y + dy * 0.5 };
  const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  return createSampleTable(start, c1, c2, end, d);
}

/**
 * Deterministic rate accumulator for fractional destination routing.
 * Across the 6 emissions of a 6600ms cycle:
 * - share=0 receives 0 emissions
 * - share=1 receives all 6 emissions
 * - fractional share distributes emissions evenly
 */
export function isEmissionEligible(emissionIndex: number, share: number = 1): boolean {
  if (share <= 0) return false;
  if (share >= 1) return true;
  return Math.floor((emissionIndex + 1) * share + 1e-9) > Math.floor(emissionIndex * share + 1e-9);
}
