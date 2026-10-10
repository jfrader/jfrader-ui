import { create } from 'storybook/theming';
import { base as tokens, light as lightTokens, type ThemeOverrides } from '@jfrader/tokens';

const { font, radius } = tokens;

// Storybook's theme takes radii as pixel numbers; the tokens are px strings.
const toPixels = (value: string) => Number.parseFloat(value);

const buildTheme = ({ color }: Pick<ThemeOverrides, 'color'>, base: 'dark' | 'light') =>
  create({
    base,
    brandTitle: 'jfrader ui',
    // Relative, so the brand link stays inside Storybook when hosted under a subpath.
    brandUrl: '.',
    brandTarget: '_self',
    colorPrimary: color.accent,
    colorSecondary: color.accent,
    appBg: color.bg,
    appContentBg: color.surface,
    appPreviewBg: color.bg,
    appHoverBg: color.surfaceHover,
    appBorderColor: color.border,
    appBorderRadius: toPixels(radius.sm),
    fontBase: font.sans,
    fontCode: font.mono,
    textColor: color.text,
    textMutedColor: color.textMuted,
    textInverseColor: color.accentContrast,
    barBg: color.surfaceRaised,
    barTextColor: color.textMuted,
    barHoverColor: color.accentHover,
    barSelectedColor: color.accentText,
    buttonBg: color.surfaceRaised,
    buttonBorder: color.border,
    booleanBg: color.surfaceInset,
    booleanSelectedBg: color.surfaceRaised,
    inputBg: color.surfaceInset,
    inputBorder: color.borderControl,
    inputTextColor: color.text,
    inputBorderRadius: toPixels(radius.sm),
  });

export const theme = buildTheme(tokens, 'dark');
export const lightTheme = buildTheme(lightTokens, 'light');
