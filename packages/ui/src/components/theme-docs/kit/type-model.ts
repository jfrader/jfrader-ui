import { base } from '@jfrader/tokens';
import { tokenPath } from './model';

export interface TypeTokenDoc {
  readonly path: readonly string[];
  readonly value: string;
  readonly description?: string;
  readonly specimen: 'family' | 'size' | 'weight' | 'leading' | 'tracking' | 'rule' | 'none';
}

export interface TypeFamilyDoc {
  readonly title: string;
  readonly blurb: string;
  readonly tokens: readonly TypeTokenDoc[];
}

export function typeTokenPath([group = '', ...path]: readonly string[]): string {
  return tokenPath(group, ...path).replace(/\.(\d\w*)/g, "['$1']");
}

function entries(group: string, source: Readonly<Record<string, string>>, specimen: TypeTokenDoc['specimen']): TypeTokenDoc[] {
  return Object.entries(source).map(([key, value]) => ({ path: [group, key], value, specimen }));
}

const FONT_DESCRIPTIONS: Record<keyof typeof base.font, string> = {
  sans: 'Interface text, headings, and body copy.',
  mono: 'Code, token references, and tabular values.',
};

const EDITORIAL_SIZES = ['dek', 'summary', 'lede', 'body', 'meta', 'kicker'] as const;
const EDITORIAL_DIMENSIONS = ['measure', 'centeredMeasure', 'dropCap', 'hit'] as const;

const editorial: TypeTokenDoc[] = [
  ...Object.entries(base.editorial.headline).map(([key, value]): TypeTokenDoc => ({
    path: ['editorial', 'headline', key], value, specimen: 'size',
  })),
  ...EDITORIAL_SIZES.map((key): TypeTokenDoc => ({ path: ['editorial', key], value: base.editorial[key], specimen: 'size' })),
  ...EDITORIAL_DIMENSIONS.map((key): TypeTokenDoc => ({ path: ['editorial', key], value: base.editorial[key], specimen: 'none' })),
  ...(['lineHeight', 'tracking', 'rule', 'breakpoint'] as const).flatMap((group) =>
    Object.entries(base.editorial[group]).map(([key, value]): TypeTokenDoc => ({
      path: ['editorial', group, key],
      value,
      specimen: group === 'tracking' ? 'tracking' : group === 'rule' ? 'rule' : 'none',
    })),
  ),
];

export const TYPE_FAMILIES: readonly TypeFamilyDoc[] = [
  {
    title: 'Families',
    blurb: 'Sans for interface and reading text; monospace for code and values.',
    tokens: Object.entries(base.font).map(([key, value]) => ({
      path: ['font', key], value, specimen: 'family', description: FONT_DESCRIPTIONS[key as keyof typeof base.font],
    })),
  },
  { title: 'Size scale', blurb: 'Text sizes for labels, controls, body copy, and headings.', tokens: entries('textSize', base.textSize, 'size') },
  { title: 'Weights', blurb: 'Four weights for text emphasis.', tokens: entries('fontWeight', base.fontWeight, 'weight') },
  { title: 'Line heights', blurb: 'Unitless leading ratios for compact text, body copy, and longer passages.', tokens: entries('lineHeight', base.lineHeight, 'leading') },
  { title: 'Editorial scale', blurb: 'Responsive headlines, reading sizes, measures, tracking, and rules.', tokens: editorial },
];
