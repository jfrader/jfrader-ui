import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { base, contrast, light } from '../src/tokens';

type TokenTree = { readonly [key: string]: string | TokenTree };
type VarTree = { [key: string]: string | VarTree };

const VAR_PREFIX = '--ui';
const HEADER = '/* Generated from src/tokens.ts — do not edit. Run pnpm generate. */';

const cssOutput = fileURLToPath(new URL('../dist/tokens.css', import.meta.url));
const varsOutput = fileURLToPath(new URL('../src/generated/vars.ts', import.meta.url));

const toKebab = (key: string) => key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const varName = (path: readonly string[]) => [VAR_PREFIX, ...path.map(toKebab)].join('-');

function flatten(tree: TokenTree, path: readonly string[] = []): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] =>
    typeof value === 'string' ? [[varName([...path, key]), value]] : flatten(value, [...path, key]),
  );
}

function toVarTree(tree: TokenTree, path: readonly string[] = []): VarTree {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string' ? `var(${varName([...path, key])})` : toVarTree(value, [...path, key]),
    ]),
  );
}

function cssBlock(selector: string, tree: TokenTree) {
  const declarations = flatten(tree).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${declarations.join('\n')}\n}`;
}

function write(file: string, contents: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

/** Fails fast on flattened-name collisions (fooBar vs foo-bar) so vars never silently overwrite. */
function assertUniqueNames(tree: TokenTree, label: string) {
  const seen = new Set<string>();
  for (const [name] of flatten(tree)) {
    if (seen.has(name)) throw new Error(`${label}: duplicate token name ${name}`);
    seen.add(name);
  }
  return seen;
}

const baseNames = assertUniqueNames(base, 'base');
for (const [name] of flatten(light)) {
  if (!baseNames.has(name)) throw new Error(`light: token ${name} has no counterpart in base`);
}
for (const [name] of flatten(contrast)) {
  if (!baseNames.has(name)) throw new Error(`contrast: token ${name} has no counterpart in base`);
}

/** Roles the contrast palette repaints, purely for documentation of what the direction touches. */
const contrastRoles = (Object.keys(base.color) as (keyof typeof base.color)[]).filter(
  (role) => contrast.color[role] !== base.color[role],
);

/**
 * The theme's own palette under the `theme` namespace: what an explicit `data-appearance="default"`
 * surface points back at. It copies the whole palette, because against the other page theme the
 * contrast block repaints every role, not only the deltas inside the dark family.
 */
function themeMirror(palette: { readonly color: Record<string, string>; readonly shadow: Record<string, string> }): TokenTree {
  return { theme: palette };
}

/** Points every mirrored role at the enclosing theme's own value, whatever the contrast palette repainted. */
function appearanceReset(tree: TokenTree, path: readonly string[] = []): TokenTree {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string' ? `var(${varName(['theme', ...path, key])})` : appearanceReset(value, [...path, key]),
    ]),
  );
}

const css = [
  HEADER,
  cssBlock(":root, [data-theme='dark']", base),
  cssBlock(":root, [data-theme='dark']", themeMirror(base)),
  cssBlock("[data-theme='light']", light),
  cssBlock("[data-theme='light']", themeMirror(light)),
  // Last on purpose: the contrast palette is theme-independent, so it wins over both theme blocks by
  // source order wherever an element carries `data-appearance="contrast"`, and the reset after it
  // points those roles back at the theme the surface sits in.
  cssBlock("[data-appearance='contrast']", contrast),
  cssBlock("[data-appearance='default']", appearanceReset({ color: base.color, shadow: base.shadow })),
].join('\n\n');

const vars = `${HEADER}\n\nexport const vars = ${JSON.stringify(toVarTree(base), null, 2)} as const;\n`;

write(cssOutput, `${css}\n`);
write(varsOutput, vars);

console.log(`Generated ${flatten(base).length} tokens → dist/tokens.css, src/generated/vars.ts`);
