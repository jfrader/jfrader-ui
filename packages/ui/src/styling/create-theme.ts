// Custom palettes for ThemeRoot's `tokens`. `createTheme` derives the accent family from one hex
// accent, deep-merges explicit overrides on top, and ThemeRoot declares the result as inline custom
// properties over the named theme's palette, so every token it leaves out keeps that theme's value.
//
// The derivation runs here, not in CSS relative color syntax (`oklch(from <accent> …)`): that syntax
// is Baseline 2024 (Chrome 119, Firefox 128, Safari 18; as of 2026-10-12), past the package floor
// (Chrome 111, Firefox 114, Safari 16.4, see README), where any declaration reading it would be
// invalid at computed-value time. The output only uses `oklch()` and `color-mix()`, which the floor
// supports. No dependency: the math is the published OKLab matrices and WCAG 2 relative luminance.
import type { CSSProperties } from 'react';
import { base as darkPalette, light as lightPalette } from '@jfrader/tokens';
import { theme, type JfraderTheme } from './theme';
import type { ThemeName } from './theme-scope';

type TokenOverrides<T> = { readonly [K in keyof T]?: T[K] extends string ? string : TokenOverrides<T[K]> };

/** Sparse token overrides for a ThemeRoot scope, typed from the palette: any path, any depth. */
export type ThemeTokens = TokenOverrides<JfraderTheme>;

export interface CreateThemeOptions {
  /** The named theme the scope wears; picks the dark or light accent derivation. */
  base?: ThemeName;
  /** Accent fill as `#rgb` or `#rrggbb`; the accent family is derived from it. */
  accent?: string;
  /** Explicit overrides; they win over the derived accent family. */
  tokens?: ThemeTokens;
}

type Rgb = readonly [number, number, number];

// Per-theme accent rules. Hover moves the fill away from the page (lighter on dark, darker on
// light). On light, accent-as-text caps its OKLCH lightness so it stays AA (4.5:1) on the white
// surface; on dark the accent is the text color as given.
const ACCENT_DERIVATION = {
  dark: { hoverLightness: 0.08, textMaxLightness: null },
  light: { hoverLightness: -0.06, textMaxLightness: 0.5 },
} as const satisfies Record<ThemeName, { hoverLightness: number; textMaxLightness: number | null }>;

/** Accent share (percent) of each translucent role, mixed with transparent in OKLab. */
const ACCENT_MIX = { accentSoft: 22, accentSoftHover: 30, accentBorder: 50 } as const;

// Text candidates on the accent fill: the stock dark and light themes' own accent-contrast colors.
const CONTRAST_CANDIDATES = [darkPalette.color.accentContrast, lightPalette.color.accentContrast];

/** Below this OKLCH chroma the hue is noise; it is written as 0. */
const ACHROMATIC_CHROMA = 1e-4;

// Björn Ottosson's OKLab: linear sRGB → LMS, then cube-rooted LMS → Lab.
const LINEAR_SRGB_TO_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
] as const;
const LMS_TO_OKLAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
] as const;

// WCAG 2 relative luminance weights for linear sRGB.
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

const dot = (row: Rgb, vector: Rgb) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** `#rgb` / `#rrggbb` → linear sRGB channels in [0, 1]. */
function linearRgb(hex: string): Rgb {
  if (!HEX_COLOR.test(hex)) throw new Error(`createTheme: accent must be a #rgb or #rrggbb color, got "${hex}".`);
  const digits = hex.length === 4 ? [...hex.slice(1)].map((digit) => digit + digit) : hex.slice(1).match(/../g)!;
  const [r, g, b] = digits.map((pair) => {
    const channel = Number.parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return [r!, g!, b!];
}

function relativeLuminance(rgb: Rgb) {
  return dot(LUMINANCE_WEIGHTS, rgb);
}

function contrastRatio(first: number, second: number) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** The candidate text color with the higher WCAG contrast on `fill`. */
function contrastText(fill: Rgb) {
  const fillLuminance = relativeLuminance(fill);
  const ratio = (candidate: string) => contrastRatio(fillLuminance, relativeLuminance(linearRgb(candidate)));
  return CONTRAST_CANDIDATES.reduce((best, candidate) => (ratio(candidate) > ratio(best) ? candidate : best));
}

function toOklch(rgb: Rgb) {
  const [l, m, s] = LINEAR_SRGB_TO_LMS.map((row) => Math.cbrt(dot(row, rgb)));
  const lms = [l!, m!, s!] as const;
  const [lightness, a, b] = LMS_TO_OKLAB.map((row) => dot(row, lms));
  const chroma = Math.hypot(a!, b!);
  const hue = chroma < ACHROMATIC_CHROMA ? 0 : ((Math.atan2(b!, a!) * 180) / Math.PI + 360) % 360;
  return { lightness: lightness!, chroma, hue };
}

// Lightness as a percentage, the form every `oklch()` engine at the package floor parses.
function oklch(lightness: number, chroma: number, hue: number) {
  return `oklch(${round(clamp01(lightness) * 100, 2)}% ${round(chroma, 4)} ${round(hue, 2)})`;
}

function accentFamily(accent: string, base: ThemeName) {
  const rgb = linearRgb(accent);
  const { lightness, chroma, hue } = toOklch(rgb);
  const { hoverLightness, textMaxLightness } = ACCENT_DERIVATION[base];
  const mix = (percent: number) => `color-mix(in oklab, ${accent} ${percent}%, transparent)`;
  return {
    accent,
    accentHover: oklch(lightness + hoverLightness, chroma, hue),
    accentText: textMaxLightness === null ? accent : oklch(Math.min(lightness, textMaxLightness), chroma, hue),
    accentSoft: mix(ACCENT_MIX.accentSoft),
    accentSoftHover: mix(ACCENT_MIX.accentSoftHover),
    accentBorder: mix(ACCENT_MIX.accentBorder),
    accentContrast: contrastText(rgb),
    // The stock themes set the focus ring to their accent, so the ring follows yours.
    focusRing: accent,
  };
}

type TokenTree = { readonly [key: string]: string | TokenTree | undefined };

function mergeTokens(target: TokenTree, source: TokenTree): TokenTree {
  return Object.fromEntries(
    [...new Set([...Object.keys(target), ...Object.keys(source)])].map((key) => {
      const [own, override] = [target[key], source[key]];
      const merged =
        typeof own === 'object' && typeof override === 'object' ? mergeTokens(own, override) : (override ?? own);
      return [key, merged];
    }),
  );
}

/**
 * A ThemeRoot `tokens` map: the named theme's palette, then the accent family derived for `base`,
 * then `tokens` (explicit wins per token path). Pass the same `base` as the ThemeRoot's `theme`.
 */
export function createTheme({ base = 'dark', accent, tokens = {} }: CreateThemeOptions = {}): ThemeTokens {
  const derived = accent === undefined ? {} : { color: accentFamily(accent, base) };
  return mergeTokens(derived, tokens) as ThemeTokens;
}

/** `var(--ui-color-accent)` → `--ui-color-accent`. */
const VAR_REFERENCE = /^var\((--[\w-]+)\)$/;

function declarations(tokens: TokenTree, references: TokenTree): [string, string][] {
  return Object.entries(tokens).flatMap(([key, value]): [string, string][] => {
    const reference = references[key];
    if (typeof value === 'object' && typeof reference === 'object') return declarations(value, reference);
    const name = typeof reference === 'string' ? VAR_REFERENCE.exec(reference)?.[1] : undefined;
    return typeof value === 'string' && name ? [[name, value]] : [];
  });
}

/** `tokens` as inline custom-property declarations, named after the generated `var()` references. */
export function themeTokenStyle(tokens: ThemeTokens): CSSProperties {
  return Object.fromEntries(declarations(tokens, theme)) as CSSProperties;
}
