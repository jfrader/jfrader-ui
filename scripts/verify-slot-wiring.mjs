/**
 * Every key a family declares in its `slots` map must be rendered by that family.
 *
 * A family that types eleven replacement keys and consumes none of them is invisible to the
 * typechecker, to the story suite and to the generated inventory: the prop simply falls into the
 * root element's spread. That is how one family shipped with a dead seam, so the check lives in
 * the repo rather than in someone's shell history.
 *
 * Rules, matching the contract in AGENTS.md:
 * - A family is a folder under `packages/ui/src/components`; its own sources are every `.tsx`
 *   file in that folder except stories and tests, because a part may render in a sibling file.
 * - A declared key counts as rendered when the family reads `slots?.key`, or when it resolves
 *   parts dynamically (`slots?.[part]`) and names the key as a literal or property somewhere.
 * - Keys that are not parts are exempt: `root` (the Surface seam, consumed by SurfaceRoot) and
 *   `component` / `components` (the internal customization-bag names).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/ui/src/components', import.meta.url));
const EXEMPT = new Set(['root', 'component', 'components']);

export function findUnwiredKeys(componentsRoot = root) {
  const findings = [];
  for (const family of readdirSync(componentsRoot).sort()) {
    const directory = path.join(componentsRoot, family);
    if (!statSync(directory).isDirectory()) continue;
    const sources = readdirSync(directory)
      .filter((name) => name.endsWith('.tsx') && !name.includes('.stories.') && !name.includes('.test.'))
      .map((name) => path.join(directory, name));
    if (sources.length === 0) continue;

    const text = sources.map((file) => readFileSync(file, 'utf8')).join('\n');
    // Only keys inside a slot map count: a `slots?: { … }` prop or a `*Slots` interface. A private
    // `ComponentType` prop with another name is not part of the contract and must not be flagged.
    const blocks = [
      ...text.matchAll(/slots\?:\s*\{([\s\S]*?)\n {2}\};/g),
      ...text.matchAll(/(?:interface|type)\s+\w*Slots\b[^{]*\{([\s\S]*?)\n\}/g),
    ].map((match) => match[1]);
    const declared = new Set(blocks.flatMap((block) => [...block.matchAll(/^\s{2,}(\w+)\?: ComponentType</gm)].map((match) => match[1])));
    if (declared.size === 0) continue;

    // A part may be resolved through a local alias of the map (`contentSlots?.presets`), so any
    // identifier that ends in `slot`/`slots` counts, not just `slots?.`.
    const rendered = new Set([...text.matchAll(/[A-Za-z_$]*[Ss]lots?\?\.(\w+)/g)].map((match) => match[1]));
    if (/[Ss]lots?\?\.\[/.test(text)) {
      for (const key of declared) {
        if (text.includes(`'${key}'`) || text.includes(`"${key}"`) || text.includes(`.${key}`)) rendered.add(key);
      }
    }

    const unwired = [...declared].filter((key) => !rendered.has(key) && !EXEMPT.has(key)).sort();
    if (unwired.length > 0) findings.push({ family, unwired });
  }
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = findUnwiredKeys();
  if (findings.length === 0) {
    console.log('slot wiring: every declared replacement key is rendered');
    process.exit(0);
  }
  console.error('slot wiring: declared keys that nothing renders');
  for (const { family, unwired } of findings) console.error(`  ${family}: ${unwired.join(', ')}`);
  process.exit(1);
}
