import { parse, wcagContrast } from 'culori';
import { base, light, type Tokens } from '@jfrader/tokens';

/**
 * Data for the Theme documentation pages.
 *
 * The rows are the token source itself: `dark` and `light` read the same objects the stylesheet
 * generator reads, so a documented value cannot drift from the value a component uses. Only the
 * prose is authored here.
 */

export type TokenMode = keyof typeof PALETTES;

const PALETTES = { dark: base, light } as const;

export const TOKEN_MODES = ['dark', 'light'] as const satisfies readonly TokenMode[];

export type ColorRole = keyof Tokens['color'];

/** What a foreground role has to reach to be legible where it is used. */
export interface ContrastRule {
  /** The color role the foreground sits on. */
  readonly against: ColorRole;
  /** Minimum ratio the usage requires: 4.5 for text, 3 for boundaries and focus rings. */
  readonly min: number;
}

export interface ColorRoleDoc {
  readonly role: ColorRole;
  readonly summary: string;
  readonly contrast?: ContrastRule;
  /** Translucent fills are painted over a checkerboard so the alpha stays visible. */
  readonly translucent?: boolean;
}

export interface ColorFamily {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly roles: readonly ColorRoleDoc[];
}

const SURFACES: ColorRoleDoc[] = [
  { role: 'bg', summary: 'Page background, behind every surface.' },
  { role: 'bgSoft', summary: 'Page background for large flat areas that need a little separation.' },
  { role: 'surface', summary: 'Default panel fill: cards, menus, fields.' },
  { role: 'surfaceRaised', summary: 'Panels above the page: popovers, dialogs, sticky headers.' },
  { role: 'surfaceHover', summary: 'Hovered rows, list options and menu items.' },
  { role: 'surfaceInset', summary: 'Wells that read further back than the surface: inputs, code, tracks.' },
];

const TEXT: ColorRoleDoc[] = [
  { role: 'text', summary: 'Primary copy, headings and values.', contrast: { against: 'surface', min: 4.5 } },
  { role: 'textMuted', summary: 'Supporting copy: descriptions, labels, metadata.', contrast: { against: 'surface', min: 4.5 } },
  { role: 'textSubtle', summary: 'Lowest emphasis that still has to pass AA.', contrast: { against: 'surface', min: 4.5 } },
];

const BORDERS: ColorRoleDoc[] = [
  { role: 'border', summary: 'Default card and panel outline.' },
  { role: 'borderSubtle', summary: 'Hairlines inside a panel: row separators and section rules.' },
  { role: 'borderStrong', summary: 'Emphasised outline: selected items and stronger dividers.' },
  {
    role: 'borderControl',
    summary: 'Form control boundary. Holds 3:1 against the page and the control fill.',
    contrast: { against: 'surface', min: 3 },
  },
];

const ACCENT: ColorRoleDoc[] = [
  { role: 'accent', summary: 'Primary action fill: accent buttons, switches, selected indicators.' },
  { role: 'accentHover', summary: 'The accent fill while hovered.' },
  {
    role: 'accentText',
    summary: 'Accent-colored text and links; darkens on the light palette to stay legible.',
    contrast: { against: 'surface', min: 4.5 },
  },
  { role: 'accentSoft', summary: 'Tinted background behind accent content: chips, selected rows.', translucent: true },
  { role: 'accentSoftHover', summary: 'That tint on hover.', translucent: true },
  { role: 'accentBorder', summary: 'Outline around accent-tinted content.', translucent: true },
  {
    role: 'accentContrast',
    summary: 'Text and icons on an accent fill. Derived so it contrasts with your accent.',
    contrast: { against: 'accent', min: 4.5 },
  },
];

const FEEDBACK: ColorRoleDoc[] = [
  { role: 'danger', summary: 'Destructive action fill.' },
  { role: 'dangerHover', summary: 'The destructive fill while hovered.' },
  { role: 'dangerText', summary: 'Error copy and destructive labels.', contrast: { against: 'surface', min: 4.5 } },
  { role: 'dangerContrast', summary: 'Text on a destructive fill.', contrast: { against: 'danger', min: 4.5 } },
  { role: 'dangerSoft', summary: 'Error banner and field background.', translucent: true },
  { role: 'dangerSoftHover', summary: 'That background on hover.', translucent: true },
  { role: 'dangerBorder', summary: 'Outline for error surfaces and invalid fields.', translucent: true },
  { role: 'warning', summary: 'Warning icon and accent; a solid fill where one is needed.' },
  { role: 'warningSoft', summary: 'Warning banner background.', translucent: true },
  { role: 'success', summary: 'Success icon and accent; a solid fill where one is needed.' },
  { role: 'successSoft', summary: 'Success banner background.', translucent: true },
  { role: 'info', summary: 'Informational icon and accent; a solid fill where one is needed.' },
  { role: 'infoSoft', summary: 'Informational banner background.', translucent: true },
];

const FOCUS: ColorRoleDoc[] = [
  {
    role: 'focusRing',
    summary: 'Focus outline on every interactive element. Follows a custom accent.',
    contrast: { against: 'surface', min: 3 },
  },
];

const SYNTAX: ColorRoleDoc[] = (
  [
    ['keyword', 'Language keyword.'],
    ['string', 'String literal.'],
    ['constant', 'Number, boolean or constant.'],
    ['function', 'Function and method name.'],
    ['type', 'Type, class and interface name.'],
    ['tag', 'Markup or JSX tag.'],
    ['property', 'Object key, attribute or CSS property.'],
    ['comment', 'Comment.'],
    ['punctuation', 'Bracket, comma and operator.'],
  ] as const
).map(([role, summary]) => ({ role: `syntax${role[0]!.toUpperCase()}${role.slice(1)}` as ColorRole, summary, contrast: { against: 'surfaceInset', min: 4.5 } }));

const PLAYING_CARD: ColorRoleDoc[] = [
  { role: 'cardFace', summary: 'Card paper. Reads the same on both palettes: a card is an object, not chrome.' },
  { role: 'cardInk', summary: 'Printed card ink.', contrast: { against: 'cardFace', min: 4.5 } },
  { role: 'cardRed', summary: 'Hearts and diamonds on a French deck.', contrast: { against: 'cardFace', min: 4.5 } },
];

const SIGNATURE_INK: ColorRoleDoc[] = [
  { role: 'signatureInkBlack', summary: 'Signature pad, black pen.' },
  { role: 'signatureInkBlue', summary: 'Signature pad, blue pen.' },
  { role: 'signatureInkViolet', summary: 'Signature pad, violet pen.' },
];

const MATERIALS: ColorRoleDoc[] = [
  { role: 'surfaceGlass', summary: 'Translucent panel fill, used behind a backdrop blur.', translucent: true },
  { role: 'surfaceHighlight', summary: 'Top-edge highlight on a glass panel.', translucent: true },
  { role: 'surfaceSheen', summary: 'Faint accent sheen across a glass panel.', translucent: true },
  { role: 'surfaceHoloCyan', summary: 'Holographic tint, cyan end.', translucent: true },
  { role: 'surfaceHoloRose', summary: 'Holographic tint, rose end.', translucent: true },
  { role: 'scrim', summary: 'Backdrop behind dialogs, drawers and sheets.', translucent: true },
];

const COLOR_PICKER: ColorRoleDoc[] = [
  { role: 'colorPickerCheckerA', summary: 'Alpha checkerboard, dark square.' },
  { role: 'colorPickerCheckerB', summary: 'Alpha checkerboard, light square.' },
  { role: 'colorPickerWhite', summary: 'The white swatch; identical on both palettes.' },
  { role: 'colorPickerBlack', summary: 'The black swatch; identical on both palettes.' },
];

export const COLOR_FAMILIES: readonly ColorFamily[] = [
  { id: 'surfaces', title: 'Surfaces', blurb: 'Page and panel backgrounds, from furthest back to front.', roles: SURFACES },
  { id: 'text', title: 'Text', blurb: 'Three levels of emphasis. Each one holds AA against the surface.', roles: TEXT },
  { id: 'borders', title: 'Borders', blurb: 'Outlines and separators, plus the boundary every form control needs.', roles: BORDERS },
  { id: 'accent', title: 'Accent', blurb: 'The action family. Every value derives from one accent color.', roles: ACCENT },
  { id: 'feedback', title: 'Feedback', blurb: 'Danger, warning, success and info: a fill, a soft background and text.', roles: FEEDBACK },
  { id: 'focus', title: 'Focus', blurb: 'The ring every interactive element shows on :focus-visible.', roles: FOCUS },
  { id: 'syntax', title: 'Code syntax', blurb: 'Code roles, measured against the code block well.', roles: SYNTAX },
  { id: 'card', title: 'Playing card', blurb: 'Card material. Identical on both palettes by design.', roles: PLAYING_CARD },
  { id: 'signature', title: 'Signature ink', blurb: 'Pen colors for the signature pad.', roles: SIGNATURE_INK },
  { id: 'materials', title: 'Materials', blurb: 'Translucent fills, highlights and the scrim behind overlays.', roles: MATERIALS },
  { id: 'picker', title: 'Color picker', blurb: 'Fixed swatches the picker needs on any palette.', roles: COLOR_PICKER },
];

/** The authored CSS value of a color role on one palette. */
export function colorValue(mode: TokenMode, role: ColorRole): string {
  return PALETTES[mode].color[role];
}

/** The CSS custom property a role resolves to at runtime. */
export function customProperty(...path: readonly string[]): string {
  return ['--ui', ...path.map((key) => key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`))].join('-');
}

/** The typed reference a consumer writes in TSX. */
export function tokenPath(group: string, ...path: readonly string[]): string {
  return [`theme.${group}`, ...path].join('.');
}

export interface Contrast {
  readonly ratio: number;
  /** The ratio judged against the requirement the usage states, not an absolute WCAG grade:
   * text roles report `AAA`/`AA`, boundaries report `Pass`/`Fail`. */
  readonly grade: 'AAA' | 'AA' | 'Pass' | 'Fail';
}

/**
 * Contrast of one palette against another, measured in sRGB the way WCAG 1.4.3 does.
 * `null` when either value cannot be parsed or carries alpha: a translucent fill is a surface,
 * not a foreground, and its ratio depends on what it is painted over.
 */
export function contrastBetween(foreground: string, background: string, min: number): Contrast | null {
  const front = parse(foreground);
  const back = parse(background);
  if (!front || !back || (front.alpha ?? 1) < 1) return null;
  const ratio = wcagContrast(front, back);
  if (!Number.isFinite(ratio)) return null;
  const value = Math.round(ratio * 100) / 100;
  const grade = ratio < min ? 'Fail' : min < 4.5 ? 'Pass' : ratio >= 7 ? 'AAA' : 'AA';
  return { ratio: value, grade };
}
