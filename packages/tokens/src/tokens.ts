export const base = {
  color: {
    bg: '#08090a',
    bgSoft: '#0b0c0d',
    surface: '#0f1011',
    surfaceRaised: '#141516',
    surfaceHover: '#18191a',
    surfaceInset: '#050506',
    border: '#23252a',
    borderSubtle: '#1d1e22',
    borderStrong: '#3e3e44',
    // Boundary for form controls (>=3:1 against page and control interiors, WCAG 1.4.11).
    borderControl: '#62666d',
    text: '#f7f8f8',
    textMuted: '#8a8f98',
    textSubtle: '#757982',
    accent: '#a78bff',
    accentHover: '#c7b7ff',
    accentContrast: '#141414',
    accentText: '#a78bff',
    accentSoft: 'rgb(119 71 255 / 0.22)',
    accentSoftHover: 'rgb(119 71 255 / 0.3)',
    accentBorder: 'rgb(119 71 255 / 0.5)',
    danger: '#cf3f3f',
    dangerHover: '#c23b3b',
    dangerContrast: '#ffffff',
    dangerText: '#eb5757',
    dangerSoft: 'rgba(235, 87, 87, 0.08)',
    dangerSoftHover: 'rgba(235, 87, 87, 0.12)',
    dangerBorder: 'rgba(235, 87, 87, 0.45)',
    warning: '#f2994a',
    warningSoft: 'rgba(242, 153, 74, 0.12)',
    success: '#4cb782',
    successSoft: 'rgba(76, 183, 130, 0.12)',
    info: '#4ea7fc',
    infoSoft: 'rgba(78, 167, 252, 0.12)',
    focusRing: '#a78bff',
    signatureInkBlack: '#171717',
    signatureInkBlue: '#1746a2',
    signatureInkViolet: '#6230a3',
    // Playing-card paper and ink: a card is an object with its own material, so these read the same
    // in both themes (>= 14:1 between them).
    cardFace: '#f4f4f5',
    cardInk: 'rgba(0, 0, 0, 0.87)',
    // A card's red for the French deck's two-colour suits (5.35:1 on cardFace).
    cardRed: '#c8102e',
    scrim: 'rgba(1, 2, 3, 0.72)',
    // Syntax highlighting roles (>=4.5:1 against surfaceInset and surfaceRaised).
    syntaxKeyword: '#c4adff',
    syntaxString: '#8fd4a4',
    syntaxConstant: '#f2b380',
    syntaxFunction: '#82b6ff',
    syntaxType: '#6fd0cc',
    syntaxTag: '#ff9b8f',
    syntaxProperty: '#e5c27f',
    syntaxComment: '#8a8f98',
    syntaxPunctuation: '#a4a9b1',
  },
  shadow: {
    raised: '0 1px 2px rgba(0, 0, 0, 0.4)',
    overlay: '0 8px 24px rgba(0, 0, 0, 0.5)',
    floating: '0 16px 48px rgba(0, 0, 0, 0.55)',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '26px',
    full: '999px',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },
  textSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    '2xl': '1.75rem',
    '3xl': '2.25rem',
  },
  lineHeight: {
    tight: '1.2',
    base: '1.5',
    relaxed: '1.65',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
  },
  font: {
    sans: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  },
  motion: {
    duration: {
      fast: '120ms',
      base: '160ms',
      slow: '240ms',
      presence: '1200ms',
    easeStandard: 'cubic-bezier(0.2, 0.6, 0.2, 1)',
    easePresence: 'ease-in-out',
      cardFlip: '300ms',
    easeCardFlip: 'ease',
  },
  // Component structural sizes; theme-independent, so light shares them.
  size: {
    // Emblem plate: the square side for circle, squircle and hexagon; the shield is 8:7 on top of it.
    emblemSm: '24px',
    emblemMd: '32px',
    emblemLg: '40px',
    emblemXl: '56px',
    // Game card width. The frame keeps the 1.48 height ratio and a width/13 corner it came with.
    gameCardSm: '32px',
    gameCardMd: '72px',
    gameCardLg: '112px',
    gameCardPerspective: '28rem',
    // Layer inline size at which SheetStack's auto variant switches from sheet to centered dialog.
    sheetStackBreakpoint: '640px',
    // How much of each parent panel shows above the active one.
    sheetStackSheetPeek: '10px',
    sheetStackDialogPeek: '14px',
  },
} as const;

export type Tokens = typeof base;

export type ThemeOverrides = {
  readonly color: Record<keyof Tokens['color'], string>;
  readonly shadow: Record<keyof Tokens['shadow'], string>;
};

/** Sparse palette overrides: only the roles that differ, no full restatement of a theme. */
export type AppearanceOverrides = {
  readonly color: Partial<Record<keyof Tokens['color'], string>>;
};

/*
 * Light theme pairs with the dark default: white/gray structure with the
 * same violet accent family (fill #7747ff with white text; violet-as-text #5f2ee0).
 * All text pairs AA-checked (>=4.5:1).
 */
export const light = {
  color: {
    bg: 'oklch(100% 0 0)',
    bgSoft: 'oklch(98.4% 0 0)',
    surface: 'oklch(100% 0 0)',
    surfaceRaised: 'oklch(100% 0 0)',
    surfaceHover: 'oklch(97.2% 0 0)',
    surfaceInset: 'oklch(96% 0 0)',
    border: 'oklch(93.5% 0 0)',
    borderSubtle: 'oklch(96.5% 0 0)',
    borderStrong: 'oklch(82% 0 0)',
    borderControl: 'oklch(60% 0 0)',
    text: 'oklch(15% 0 0)',
    textMuted: 'oklch(46% 0 0)',
    textSubtle: 'oklch(50% 0 0)',
    accent: '#7747ff',
    accentHover: '#6539f0',
    accentContrast: '#ffffff',
    accentText: '#5f2ee0',
    accentSoft: 'rgba(119, 71, 255, 0.12)',
    accentSoftHover: 'rgba(119, 71, 255, 0.18)',
    accentBorder: 'rgba(119, 71, 255, 0.4)',
    danger: 'oklch(50% 0.21 25)',
    dangerHover: 'oklch(44% 0.2 25)',
    dangerContrast: '#ffffff',
    dangerText: 'oklch(50% 0.21 25)',
    dangerSoft: 'oklch(50% 0.21 25 / 0.1)',
    dangerSoftHover: 'oklch(50% 0.21 25 / 0.14)',
    dangerBorder: 'oklch(50% 0.21 25 / 0.32)',
    warning: 'oklch(46% 0.17 75)',
    warningSoft: 'oklch(52% 0.17 75 / 0.12)',
    success: 'oklch(42% 0.19 150)',
    successSoft: 'oklch(49% 0.19 150 / 0.12)',
    info: 'oklch(50% 0.2 260)',
    infoSoft: 'oklch(50% 0.2 260 / 0.12)',
    focusRing: '#7747ff',
    signatureInkBlack: '#171717',
    signatureInkBlue: '#1746a2',
    signatureInkViolet: '#6230a3',
    cardFace: '#f4f4f5',
    cardInk: 'rgba(0, 0, 0, 0.87)',
    cardRed: '#c8102e',
    scrim: 'oklch(20% 0 0 / 0.4)',
    syntaxKeyword: 'oklch(48% 0.2 290)',
    syntaxString: 'oklch(47% 0.12 150)',
    syntaxConstant: 'oklch(50% 0.13 55)',
    syntaxFunction: 'oklch(48% 0.16 255)',
    syntaxType: 'oklch(48% 0.09 195)',
    syntaxTag: 'oklch(50% 0.17 25)',
    syntaxProperty: 'oklch(49% 0.1 80)',
    syntaxComment: 'oklch(50% 0.01 260)',
    syntaxPunctuation: 'oklch(42% 0 0)',
  },
  shadow: {
    raised: '0 1px 2px oklch(0% 0 0 / 0.05)',
    overlay: '0 6px 18px oklch(0% 0 0 / 0.08), 0 1px 3px oklch(0% 0 0 / 0.04)',
    floating: '0 20px 48px oklch(0% 0 0 / 0.12), 0 3px 10px oklch(0% 0 0 / 0.05)',
  },
} as const satisfies ThemeOverrides;

/*
 * Contrast surface: the eight roles the elevated charcoal panel changes on top of the dark theme,
 * which supplies every other value. Sparse by design - no `...base.color`, so nothing is restated and
 * no per-theme copy is needed. Measured on the #202226 fill (sRGB script): textSubtle #9a9ea7 5.93,
 * borderControl #7d808a 4.04 on the panel and 4.37 on a well. The dark theme's own #757982 (4.19 on
 * #141516) and #62666d fail there, which is why both move.
 */
export const contrast = {
  color: {
    surfaceRaised: '#202226',
    surfaceHover: '#30323b',
    surfaceInset: '#191b20',
    border: '#3b3e47',
    borderSubtle: '#31333a',
    borderStrong: '#4c4f59',
    borderControl: '#7d808a',
    textSubtle: '#9a9ea7',
  },
} as const satisfies AppearanceOverrides;
