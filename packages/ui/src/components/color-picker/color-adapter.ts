/// <reference path="./culori.d.ts" />
import {
  blend,
  converter,
  displayable,
  formatCss,
  formatHex,
  formatHex8,
  formatHsl,
  formatRgb,
  parse,
  toGamut,
  wcagContrast,
  type Color,
} from 'culori';

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';
export type ContrastGrade = 'aaa' | 'aa' | 'large' | 'fail';
export interface PickerColor {
  hex: string;
  h: number;
  s: number;
  v: number;
  a: number;
  mapped: boolean;
}
const rgb = converter('rgb');
const hsv = converter('hsv');
const oklch = converter('oklch');
const map = toGamut('rgb', 'oklch');
export const clamp = (value: number, max = 1) =>
  Math.max(0, Math.min(max, value));

function adapt(value: Color): PickerColor | undefined {
  const converted = rgb(value);
  if (!converted) return;
  if (
    Object.values(converted).some(
      (channel) => typeof channel === 'number' && !Number.isFinite(channel),
    )
  )
    return;
  const mapped = !displayable(converted);
  const color = mapped ? map(converted) : converted;
  const channels = hsv(color);
  if (!channels) return;
  if (
    Object.values(channels).some(
      (channel) => typeof channel === 'number' && !Number.isFinite(channel),
    )
  )
    return;
  const a = clamp(Number(color.alpha ?? 1));
  return {
    hex: (a === 1 ? formatHex(color) : formatHex8(color)).toUpperCase(),
    h: Number(channels.h ?? 0),
    s: Number(channels.s ?? 0),
    v: Number(channels.v ?? 0),
    a,
    mapped,
  };
}

export function parseColor(input: string): PickerColor | undefined {
  const text = input.trim();
  if (
    !/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|(?:rgba?|hsla?|oklch)\([\d\s.,%+eE/−-]*(?:deg|grad|rad|turn)?[\d\s.,%+eE/−-]*\))$/i.test(
      text,
    )
  )
    return;
  const value = parse(text);
  if (!value || !['rgb', 'hsl', 'oklch'].includes(value.mode)) return;
  if (
    Object.values(value).some(
      (channel) => typeof channel === 'number' && !Number.isFinite(channel),
    )
  )
    return;
  return adapt(value);
}

export function fromChannels({
  h,
  s,
  v,
  a,
}: Pick<PickerColor, 'h' | 's' | 'v' | 'a'>): PickerColor {
  const color = adapt({
    mode: 'hsv',
    h,
    s: clamp(s),
    v: clamp(v),
    alpha: clamp(a),
  })!;
  return { ...color, h, s: clamp(s), v: clamp(v), a: clamp(a) };
}

const serializers = {
  hex: (value: Color) =>
    (value.alpha === undefined || value.alpha === 1
      ? formatHex(value)
      : formatHex8(value)
    ).toUpperCase(),
  rgb: formatRgb,
  hsl: formatHsl,
  oklch: (value: Color) => formatCss(oklch(value)!),
};
export function serializeColor(
  color: PickerColor,
  format: ColorFormat,
): string {
  return serializers[format]({
    mode: 'hsv',
    h: color.h,
    s: color.s,
    v: color.v,
    alpha: color.a,
  });
}
export function contrastGrade(ratio: number): ContrastGrade {
  return ratio >= 7
    ? 'aaa'
    : ratio >= 4.5
      ? 'aa'
      : ratio >= 3
        ? 'large'
        : 'fail';
}
export function contrastColor(foreground: string, background: string) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg || bg.a !== 1) return;
  const ratio = wcagContrast(blend([rgb(bg.hex)!, rgb(fg.hex)!]), rgb(bg.hex)!);
  return { ratio, grade: contrastGrade(ratio) };
}
