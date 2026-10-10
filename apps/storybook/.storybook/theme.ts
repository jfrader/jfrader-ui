import { create } from 'storybook/theming';
import { base as tokens, light as lightTokens, type ThemeOverrides } from '@jfrader/tokens';

const { font, radius } = tokens;

// Storybook's theme takes radii as pixel numbers; the tokens are px strings.
const toPixels = (value: string) => Number.parseFloat(value);

// Storybook's theming runs color values through polished, which cannot parse modern
// CSS color syntax — the light tokens use oklch() for most roles (and would crash the
// docs renderer). Convert OKLCH -> sRGB hex: OKLab -> linear sRGB matrix plus the sRGB
// transfer curve; out-of-gamut channels clip.
const oklchToHex = (value: string): string => {
  const match = value.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/i);
  if (!match) return value;
  const lightness = Number(match[1]) / 100;
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = Number(match[2]) * Math.cos(hue);
  const b = Number(match[2]) * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channel = (x: number) => {
    const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  const alpha = match[4] === undefined ? '' : channel(Number(match[4]));
  return `#${channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)}${channel(
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
  )}${channel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)}${alpha}`;
};

const safe = (value: string) => (value.startsWith('oklch(') ? oklchToHex(value) : value);

const buildTheme = ({ color }: Pick<ThemeOverrides, 'color'>, base: 'dark' | 'light') =>
  create({
    base,
    brandTitle: 'jfrader ui',
    // Relative, so the brand link stays inside Storybook when hosted under a subpath.
    brandUrl: '.',
    brandTarget: '_self',
    colorPrimary: safe(color.accent),
    colorSecondary: safe(color.accent),
    appBg: safe(color.bg),
    appContentBg: safe(color.surface),
    appPreviewBg: safe(color.bg),
    appHoverBg: safe(color.surfaceHover),
    appBorderColor: safe(color.border),
    appBorderRadius: toPixels(radius.sm),
    fontBase: font.sans,
    fontCode: font.mono,
    textColor: safe(color.text),
    textMutedColor: safe(color.textMuted),
    textInverseColor: safe(color.accentContrast),
    barBg: safe(color.surfaceRaised),
    barTextColor: safe(color.textMuted),
    barHoverColor: safe(color.accentHover),
    barSelectedColor: safe(color.accentText),
    buttonBg: safe(color.surfaceRaised),
    buttonBorder: safe(color.border),
    booleanBg: safe(color.surfaceInset),
    booleanSelectedBg: safe(color.surfaceRaised),
    inputBg: safe(color.surfaceInset),
    inputBorder: safe(color.borderControl),
    inputTextColor: safe(color.text),
    inputBorderRadius: toPixels(radius.sm),
  });

export const theme = buildTheme(tokens, 'dark');
export const lightTheme = buildTheme(lightTokens, 'light');
