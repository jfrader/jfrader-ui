import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsf, metaObjectPath } from 'storybook/internal/csf-tools';
import { componentDirectory } from '../../../scripts/component-directory.mjs';

function property(node, name) {
  return node?.properties?.find((entry) =>
    entry.type === 'ObjectProperty' && !entry.computed &&
    (entry.key.name ?? entry.key.value) === name)?.value;
}

function literal(node) {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return '';
}

function authoredSource(meta) {
  let node = meta;
  for (const name of ['parameters', 'docs', 'source', 'code']) {
    const properties = node?.properties ?? [];
    const matches = properties.filter((entry) => !entry.computed &&
      (entry.key?.name ?? entry.key?.value) === name);
    if (matches.length !== 1 || matches[0].type !== 'ObjectProperty') return '';
    const later = properties.slice(properties.indexOf(matches[0]) + 1);
    if (later.some((entry) => entry.type === 'SpreadElement' || entry.computed)) return '';
    node = matches[0].value;
  }
  return literal(node);
}

export function checkUsage(source, fileName = 'component.stories.tsx') {
  const csf = loadCsf(source, { fileName, makeTitle: (title) => title ?? fileName }).parse();
  const meta = metaObjectPath(csf)?.node;
  const tags = property(meta, 'tags')?.elements?.map(literal) ?? [];
  // Autodocs is inherited from .storybook/preview.tsx unless explicitly disabled.
  if (tags.includes('!autodocs')) return [];
  const component = property(meta, 'component');
  const name = component?.name ?? component?.property?.name ?? '';
  const provider = /Provider$/.test(name) || name === 'ThemeRoot';
  const nullChildren = property(property(meta, 'args'), 'children')?.type === 'NullLiteral';
  if (!provider && !nullChildren) return [];
  const code = authoredSource(meta);
  if (code.trim()) return [];
  return [`${provider ? `Provider ${name}` : 'args.children: null'} requires a nonempty literal parameters.docs.source.code with real usage.`];
}

export function checkUsageFiles(componentsDir) {
  const errors = [];
  let checked = 0;
  for (const dir of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const folder = componentDirectory(path.join(componentsDir, dir.name));
    for (const story of readdirSync(folder).filter((name) => /\.stories\.tsx?$/.test(name))) {
      const file = path.join(folder, story);
      try {
        errors.push(...checkUsage(readFileSync(file, 'utf8'), file)
          .map((error) => `${dir.name}/${story}: ${error}`));
      } catch (error) {
        errors.push(`${dir.name}/${story}: ${error.message}`);
      }
      checked += 1;
    }
  }
  if (checked === 0) errors.push('No component stories found.');
  return { errors, checked };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, checked } = checkUsageFiles(path.resolve(import.meta.dirname, '../../../packages/ui/src/components'));
  if (errors.length) {
    console.error(`verify-docs-usage: ${errors.length} problem(s)\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`verify-docs-usage: authored Usage policy OK for ${checked} story files`);
  }
}
