type Point = [number, number];
const TAU = 2 * Math.PI;
const epsilon = 1e-9;

function roots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < epsilon) return Math.abs(b) < epsilon ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  return discriminant < 0 ? [] : [(-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a)];
}

function bezier(points: Point[]): Point[] {
  const times = new Set([0, 1]);
  for (const axis of [0, 1] as const) {
    const [a, b, c, d] = points.map((point) => point[axis]) as [number, number, number, number?];
    const extrema = d === undefined
      ? roots(0, a - 2 * b + c, b - a)
      : roots(-a + 3 * b - 3 * c + d, 2 * (a - 2 * b + c), b - a);
    for (const t of extrema) if (t > 0 && t < 1) times.add(t);
  }
  return [...times].map((t) => {
    let level = points;
    while (level.length > 1) level = level.slice(1).map((point, index) => [
      level[index]![0] * (1 - t) + point[0] * t,
      level[index]![1] * (1 - t) + point[1] * t,
    ]);
    return level[0]!;
  });
}

function arc(start: Point, values: number[], end: Point): Point[] {
  let [rx, ry, rotation, large, sweep] = values as [number, number, number, number, number];
  if (rx < 0 || ry < 0 || ![0, 1].includes(large) || ![0, 1].includes(sweep)) throw new Error('invalid arc');
  if (!rx || !ry || (start[0] === end[0] && start[1] === end[1])) return [start, end];
  const phi = rotation * Math.PI / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (start[0] - end[0]) / 2, dy = (start[1] - end[1]) / 2;
  const x = cos * dx + sin * dy, y = -sin * dx + cos * dy;
  const scale = Math.max(1, Math.sqrt((x / rx) ** 2 + (y / ry) ** 2));
  rx *= scale;
  ry *= scale;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0,
    (rx * rx * ry * ry - rx * rx * y * y - ry * ry * x * x) / (rx * rx * y * y + ry * ry * x * x),
  ));
  const cx = factor * rx * y / ry, cy = -factor * ry * x / rx;
  const center: Point = [cos * cx - sin * cy + (start[0] + end[0]) / 2, sin * cx + cos * cy + (start[1] + end[1]) / 2];
  const from = Math.atan2((y - cy) / ry, (x - cx) / rx);
  const to = Math.atan2((-y - cy) / ry, (-x - cx) / rx);
  const normalize = (angle: number) => (angle % TAU + TAU) % TAU;
  const span = sweep ? normalize(to - from) : normalize(from - to);
  const angles = [Math.atan2(-ry * sin, rx * cos), Math.atan2(ry * cos, rx * sin)];
  return [start, end, ...angles.flatMap((angle) => [angle, angle + Math.PI])
    .filter((angle) => (sweep ? normalize(angle - from) : normalize(from - angle)) <= span + epsilon)
    .map((angle): Point => [center[0] + rx * cos * Math.cos(angle) - ry * sin * Math.sin(angle), center[1] + rx * sin * Math.cos(angle) + ry * cos * Math.sin(angle)])];
}

const arities: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };

export function pathPoints(data: string): Point[] {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  if (data.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, '')) throw new Error('invalid path syntax');
  let index = 0, command = '', previous = '';
  let current: Point = [0, 0], start: Point = [0, 0], control: Point = [0, 0];
  const points: Point[] = [];
  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index]!)) command = tokens[index++]!;
    const kind = command.toUpperCase();
    if (index === 1 && kind !== 'M') throw new Error('path must begin with moveto');
    if (kind === 'Z') {
      points.push(current, start);
      current = start;
      previous = kind;
      command = '';
      continue;
    }
    const arity = arities[kind];
    if (!arity) throw new Error(`unsupported path command ${command}`);
    const raw = tokens.slice(index, index + arity);
    if (raw.length !== arity || raw.some((token) => /^[a-z]$/i.test(token))) throw new Error(`incomplete ${command} command`);
    const values = raw.map(Number);
    index += arity;
    const relative = command !== kind;
    const point = (offset: number): Point => [values[offset]! + (relative ? current[0] : 0), values[offset + 1]! + (relative ? current[1] : 0)];
    const reflected: Point = [2 * current[0] - control[0], 2 * current[1] - control[1]];
    let end: Point;
    if (kind === 'H' || kind === 'V') {
      end = kind === 'H' ? [values[0]! + (relative ? current[0] : 0), current[1]] : [current[0], values[0]! + (relative ? current[1] : 0)];
      points.push(current, end);
    } else if (kind === 'C' || kind === 'S') {
      const first = kind === 'C' ? point(0) : ['C', 'S'].includes(previous) ? reflected : current;
      control = point(kind === 'C' ? 2 : 0);
      end = point(kind === 'C' ? 4 : 2);
      points.push(...bezier([current, first, control, end]));
    } else if (kind === 'Q' || kind === 'T') {
      control = kind === 'Q' ? point(0) : ['Q', 'T'].includes(previous) ? reflected : current;
      end = point(kind === 'Q' ? 2 : 0);
      points.push(...bezier([current, control, end]));
    } else if (kind === 'A') {
      end = point(5);
      points.push(...arc(current, values, end));
    } else {
      end = point(0);
      points.push(current, end);
      if (kind === 'M') {
        start = end;
        points.pop();
        points.pop();
        points.push(end);
        command = relative ? 'l' : 'L';
      }
    }
    current = end;
    previous = kind;
  }
  if (!points.length) throw new Error('empty path');
  return points;
}

export function geometryPoints(tag: string, attrs: Record<string, string>): Point[] {
  if (tag === 'path') return pathPoints(attrs.d ?? '');
  const value = (key: string) => {
    const number = Number(attrs[key] ?? 0);
    if (!Number.isFinite(number)) throw new Error(`invalid ${key}`);
    return number;
  };
  if (tag === 'circle') {
    const x = value('cx'), y = value('cy'), r = value('r');
    if (r <= 0) throw new Error('circle radius must be positive');
    return [[x - r, y - r], [x + r, y + r]];
  }
  const x = value('x'), y = value('y'), width = value('width'), height = value('height');
  if (width <= 0 || height <= 0 || value('rx') < 0) throw new Error('invalid rectangle dimensions');
  return [[x, y], [x + width, y + height]];
}
