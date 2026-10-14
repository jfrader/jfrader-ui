import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsf, metaObjectPath } from 'storybook/internal/csf-tools';

const DESCRIPTION_PATH = ['parameters', 'docs', 'description', 'component'];
const SNIPPET_COMPONENTS = new Set(['game-card', 'flip-game-card', 'game-hand', 'game-card-stack', 'deck', 'pattern']);

export function checkSnippets(source, fileName = 'component.stories.tsx') {
  const csf = loadCsf(source, { fileName, makeTitle: () => fileName });
  const errors = [];
  const visited = new WeakSet();
  const property = (node, name) => node?.properties?.find((entry) =>
    entry.type === 'ObjectProperty' && !entry.computed &&
    (entry.key?.name ?? entry.key?.value) === name)?.value;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);
    if (node.type === 'ObjectExpression') {
      const code = property(property(node, 'source'), 'code');
      if (code) {
        const text = code.type === 'StringLiteral' ? code.value :
          code.type === 'TemplateLiteral' && code.expressions.length === 0 ? code.quasis[0].value.cooked : null;
        if (text === null || !text.trim()) {
          errors.push(`source.code at line ${code.loc.start.line}: expected a nonempty literal TSX snippet.`);
        } else {
          try {
            loadCsf(text, { fileName: 'snippet.tsx', makeTitle: () => 'Snippet' });
          } catch (error) {
            errors.push(`source.code at line ${code.loc.start.line}: ${error.message}`);
          }
        }
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(csf._ast);
  return errors;
}

export function checkIntroduction(source, fileName) {
  const csf = loadCsf(source, { fileName, makeTitle: (title) => title ?? fileName ?? 'Component' }).parse();
  let node = metaObjectPath(csf)?.node;
  for (const name of DESCRIPTION_PATH) {
    const properties = node?.type === 'ObjectExpression' ? node.properties : [];
    const matches = properties.filter((property) =>
      !property.computed && (property.key?.name ?? property.key?.value) === name);
    if (matches.length !== 1 || matches[0].type !== 'ObjectProperty') {
      return ['Add a string literal at parameters.docs.description.component. Keep its metadata explicit.'];
    }
    const later = properties.slice(properties.indexOf(matches[0]) + 1);
    if (later.some((property) => property.type === 'SpreadElement' || property.computed)) {
      return ['A spread or computed key after documentation metadata can override the introduction.'];
    }
    node = matches[0].value;
  }
  let text;
  if (node?.type === 'StringLiteral') text = node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) text = node.quasis[0].value.cooked;

  if (typeof text !== 'string' || !text.trim()) {
    return ['Add a string literal at parameters.docs.description.component.'];
  }

  return [];
}

export function checkComponentDocs(componentsDir) {
  const errors = [];
  let checked = 0;
  for (const dir of readdirSync(componentsDir, { withFileTypes: true })) {
    const folder = path.join(componentsDir, dir.name);
    if (!dir.isDirectory() || !existsSync(path.join(folder, 'index.ts'))) continue;
    const stories = readdirSync(folder).filter((file) => /\.stories\.tsx?$/.test(file));
    if (stories.length === 0) errors.push(`${dir.name}: missing component stories.`);
    for (const story of stories) {
      const fileName = path.join(folder, story);
      try {
        errors.push(...checkIntroduction(readFileSync(fileName, 'utf8'), fileName)
          .map((error) => `${dir.name}/${story}: ${error}`));
        if (SNIPPET_COMPONENTS.has(dir.name)) {
          errors.push(...checkSnippets(readFileSync(fileName, 'utf8'), fileName)
            .map((error) => `${dir.name}/${story}: ${error}`));
        }
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
  const componentsDir = path.resolve(import.meta.dirname, '../../../packages/ui/src/components');
  const { errors, checked } = checkComponentDocs(componentsDir);
  if (errors.length) {
    console.error(`verify-docs: ${errors.length} problem(s)\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`verify-docs: documentation coverage OK for ${checked} component story files`);
  }
}
