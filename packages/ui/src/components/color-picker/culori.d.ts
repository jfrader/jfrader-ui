declare module 'culori' {
  export interface Color {
    mode: string;
    alpha?: number;
    [channel: string]: number | string | undefined;
  }
  export function parse(value: string): Color | undefined;
  export function converter(
    mode: string,
  ): (value: Color | string) => Color | undefined;
  export function toGamut(mode: string, space: string): (value: Color) => Color;
  export function displayable(value: Color): boolean;
  export function formatHex(value: Color): string;
  export function formatHex8(value: Color): string;
  export function formatRgb(value: Color): string;
  export function formatHsl(value: Color): string;
  export function formatCss(value: Color): string;
  export function blend(values: Color[]): Color;
  export function wcagContrast(a: Color, b: Color): number;
}
