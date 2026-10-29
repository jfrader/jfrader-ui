import { base, light, type Tokens } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';

/**
 * The override surface of `createTheme`, `ThemeRoot tokens`, and `themeTokenStyle`: one entry per
 * token group, with every path a map may set, the custom property it writes, and its defaults.
 * Paths, properties, and values come from the token source, so the reference cannot drift.
 */

type TokenTree = { readonly [key: string]: string | TokenTree };

export type OverrideGroupName = keyof Tokens;

export interface OverrideToken {
  /** Dotted path inside the group, e.g. `duration.fast`. */
  readonly key: string;
  /** The custom property an override of this path sets. */
  readonly variable: string;
  /** The dark palette's value. */
  readonly value: string;
  /** The light palette's value, for groups the light palette restates. */
  readonly lightValue?: string;
}

export interface OverrideGroup {
  readonly name: OverrideGroupName;
  readonly title: string;
  readonly summary: string;
  readonly tokens: readonly OverrideToken[];
}

const GROUP_DOCS: Record<OverrideGroupName, { title: string; summary: string }> = {
  color: { title: 'Color', summary: 'Palette roles: surfaces, text, borders, accent, feedback, syntax, and materials.' },
  radius: { title: 'Radius', summary: 'Corner radii, from tight controls to pills.' },
  space: { title: 'Space', summary: 'The spacing scale used for gaps and padding.' },
  textSize: { title: 'Text size', summary: 'Text sizes, from labels to headings.' },
  lineHeight: { title: 'Line height', summary: 'Leading ratios for compact, body, and relaxed copy.' },
  fontWeight: { title: 'Font weight', summary: 'Weights for emphasis.' },
  font: { title: 'Font', summary: 'Font stacks for interface and code.' },
  shadow: { title: 'Shadow', summary: 'Elevation for raised surfaces, overlays, and floating panels.' },
  motion: { title: 'Motion', summary: 'Durations and easing curves.' },
  editorial: { title: 'Editorial', summary: 'Long-form type scale, measures, tracking, rules, and breakpoints.' },
  size: { title: 'Size', summary: 'Fixed component sizes.' },
  zIndex: { title: 'Z-index', summary: 'Stacking levels outside the layout flow.' },
  cardMaterial: { title: 'Card material', summary: 'Playing-card surface physics.' },
};

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
] as const satisfies readonly OverrideGroupName[];

/** `var(--ui-color-accent)` → `--ui-color-accent`. */
const VAR_REFERENCE = /^var\((--[\w-]+)\)$/;

function isTree(value: string | TokenTree | undefined): value is TokenTree {
  return typeof value === 'object';
}

function variableOf(reference: string): string {
  const match = VAR_REFERENCE.exec(reference);
  if (!match?.[1]) throw new Error(`Not a token reference: ${reference}`);
  return match[1];
}

/** Every string path in a group, read alongside its typed reference and the light palette. */
function flatten(tree: TokenTree, references: TokenTree, lightTree: TokenTree | undefined, prefix = ''): OverrideToken[] {
  return Object.entries(tree).flatMap(([key, value]): OverrideToken[] => {
    const path = prefix ? `${prefix}.${key}` : key;
    const reference = references[key];
    const lightValue = lightTree?.[key];
    if (isTree(value)) {
      if (!isTree(reference)) throw new Error(`No token reference group for ${path}`);
      return flatten(value, reference, isTree(lightValue) ? lightValue : undefined, path);
    }
    if (typeof reference !== 'string') throw new Error(`No token reference for ${path}`);
    const token = { key: path, variable: variableOf(reference), value };
    return [typeof lightValue === 'string' ? { ...token, lightValue } : token];
  });
}

/** Every group, in reading order, each with its paths and per-palette values. */
export const OVERRIDE_GROUPS: readonly OverrideGroup[] = ORDER.map((name) => ({
  name,
  ...GROUP_DOCS[name],
  tokens: flatten(
    base[name] as unknown as TokenTree,
    vars[name] as unknown as TokenTree,
    (light as Partial<Record<OverrideGroupName, TokenTree>>)[name],
  ),
}));

// A token group added to the palette must be listed above; `pnpm typecheck` fails otherwise.
type MissingGroups = Exclude<OverrideGroupName, (typeof ORDER)[number]>;
const groupsAreComplete: MissingGroups extends never ? true : ['missing group', MissingGroups] = true;
