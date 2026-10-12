import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { base, light } from '../src/tokens';

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

const css = [
  HEADER,
  cssBlock(":root, [data-theme='dark']", base),
  cssBlock("[data-theme='light']", light),
].join('\n\n');

const vars = `${HEADER}\n\nexport const vars = ${JSON.stringify(toVarTree(base), null, 2)} as const;\n`;

write(cssOutput, `${css}\n`);
write(varsOutput, vars);

console.log(`Generated ${flatten(base).length} tokens → dist/tokens.css, src/generated/vars.ts`);
