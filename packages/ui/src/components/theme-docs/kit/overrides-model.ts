import { base, light, type Tokens } from '@jfrader/tokens';

/**
 * The override surface of `ThemeRoot tokens`: one entry per top-level token group, with every path
 * a map may set and the value it takes on each palette.
 *
 * A reader writes `{ radius: { md: '0.25rem' } }`; this model answers "which keys exist, and what do
 * they hold". Values come from the token source, so a documented default cannot drift.
 */

type TokenTree = { readonly [key: string]: string | TokenTree };

export interface OverrideKey {
  /** Dotted path inside the group, e.g. `duration.fast`. */
  readonly key: string;
  /** The dark palette's value. */
  readonly value: string;
  /** The light palette's value, only where the two palettes differ. */
  readonly lightValue?: string;
}

export interface OverrideGroup {
  readonly name: keyof Tokens;
  /** One line on what the group changes. */
  readonly summary: string;
  readonly keys: readonly OverrideKey[];
}

const SUMMARIES: Record<keyof Tokens, string> = {
  color: 'Palette roles: surfaces, text, borders, accent, feedback, syntax, and materials.',
  shadow: 'Elevation for raised surfaces, overlays, and floating panels.',
  radius: 'Corner radii, from tight controls to pills.',
  space: 'The spacing scale used for gaps and padding.',
  textSize: 'Text sizes, from labels to headings.',
  lineHeight: 'Leading ratios for compact, body, and relaxed copy.',
  fontWeight: 'Weights for emphasis.',
  font: 'Font stacks for interface and code.',
  motion: 'Durations and easing curves.',
  editorial: 'Long-form type scale, measures, tracking, rules, and breakpoints.',
  size: 'Fixed component sizes.',
  zIndex: 'Stacking levels outside the layout flow.',
  cardMaterial: 'Playing-card surface physics.',
};

function isTree(value: string | TokenTree): value is TokenTree {
  return typeof value === 'object';
}

/** Every string path in a group, with the value the other palette gives it. */
function flatten(tree: TokenTree, other: TokenTree | undefined, prefix = ''): OverrideKey[] {
  return Object.entries(tree).flatMap(([key, value]): OverrideKey[] => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTree(value)) {
      const sibling = other?.[key];
      return flatten(value, sibling && isTree(sibling) ? sibling : undefined, path);
    }
    const sibling = other?.[key];
    const lightValue = typeof sibling === 'string' && sibling !== value ? sibling : undefined;
    return [lightValue ? { key: path, value, lightValue } : { key: path, value }];
  });
}

/** Reading order: the groups a theme usually reaches for first, then the rest. */
const ORDER = [
  'color',
  'radius',
  'space',
  'textSize',
  'lineHeight',
  'fontWeight',
  'font',
  'shadow',
  'motion',
  'editorial',
  'size',
  'zIndex',
  'cardMaterial',
] as const satisfies readonly (keyof Tokens)[];

/** Every group, in reading order, each with its keys and per-palette values. */
export const OVERRIDE_GROUPS: readonly OverrideGroup[] = ORDER.map((name) => {
  const darkTree = base[name] as unknown as TokenTree;
  const lightTree = (light as Record<string, unknown>)[name] as TokenTree | undefined;
  return { name, summary: SUMMARIES[name], keys: flatten(darkTree, lightTree) };
});

// A token group added to the palette must be listed above; `pnpm typecheck` fails otherwise.
type MissingGroups = Exclude<keyof Tokens, (typeof ORDER)[number]>;
const groupsAreComplete: MissingGroups extends never ? true : ['missing group', MissingGroups] = true;

export const OVERRIDE_COUNT = OVERRIDE_GROUPS.reduce((total, group) => total + group.keys.length, 0);
