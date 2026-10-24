import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsf, metaObjectPath } from 'storybook/internal/csf-tools';

const DESCRIPTION_PATH = ['parameters', 'docs', 'description', 'component'];
const SNIPPET_COMPONENTS = new Set(['game-card', 'flip-game-card', 'game-hand', 'game-card-stack', 'game-chip', 'game-chip-stack', 'deck', 'pattern', 'card-flights', 'flights']);
const GAME_COMPONENTS = new Set([...SNIPPET_COMPONENTS, 'game-table', 'game-seat']);
const gameSymbols = new Set([...GAME_COMPONENTS].flatMap((component) => {
  const file = path.resolve(import.meta.dirname, '../../../packages/ui/src/components', component, 'index.ts');
  const ast = loadCsf(readFileSync(file, 'utf8'), { fileName: file, makeTitle: () => component })._ast;
  return ast.program.body.flatMap((node) => node.type === 'ExportNamedDeclaration'
    ? node.specifiers.map((specifier) => specifier.exported.name ?? specifier.exported.value) : []);
}));

function walk(node, visit, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, seen));
    else if (value && typeof value === 'object') walk(value, visit, seen);
  }
}

export function checkGameStories(source, fileName, component) {
  const csf = loadCsf(source, { fileName, makeTitle: (title) => title ?? fileName }).parse();
  const bindings = new Map();
  for (const statement of csf._ast.program.body) {
    const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (node?.type === 'VariableDeclaration') {
      for (const declaration of node.declarations) bindings.set(declaration.id.name, declaration.init);
    }
    if (node?.type === 'FunctionDeclaration') bindings.set(node.id.name, node);
  }
  function resolve(node, seen = new Set()) {
    if (!node || seen.has(node)) return undefined;
    seen = new Set(seen).add(node);
    if (node.type === 'Identifier') return resolve(bindings.get(node.name), seen) ?? { type: 'UnresolvedMetadata' };
    if (['TSAsExpression', 'TSSatisfiesExpression', 'ParenthesizedExpression'].includes(node.type)) return resolve(node.expression, seen);
    if (node.type === 'MemberExpression' && !node.computed) return resolve(property(node.object, node.property.name, seen), seen);
    if (node.type === 'CallExpression') {
      const fn = resolve(node.callee, seen);
      const returns = fn?.body?.body?.filter((entry) => entry.type === 'ReturnStatement');
      if (returns?.length === 1) return resolve(returns[0].argument, seen);
      if (fn?.type === 'ArrowFunctionExpression') return resolve(fn.body, seen);
      return { type: 'UnresolvedMetadata' };
    }
    return node;
  }
  function property(node, name, seen = new Set()) {
    node = resolve(node, seen);
    if (node?.type === 'UnresolvedMetadata') return node;
    let found;
    for (const entry of node?.properties ?? []) {
      if (entry.type === 'SpreadElement') found = property(entry.argument, name, new Set(seen).add(node)) ?? found;
      else if (!entry.computed && (entry.key?.name ?? entry.key?.value) === name) found = entry.value ?? entry;
    }
    return found;
  }
  const at = (node, names) => names.reduce((value, name) => property(value, name), node);
  const tags = (node) => resolve(property(node, 'tags'))?.elements?.map((tag) => tag.value) ?? [];
  const meta = metaObjectPath(csf)?.node;
  const errors = [];
  for (const [name, declaration] of Object.entries(csf._storyExports)) {
    const story = declaration.init ?? declaration;
    const included = new Set();
    for (const tag of [...tags(meta), ...tags(story)]) {
      if (tag.startsWith('!')) included.delete(tag.slice(1));
      else included.add(tag);
    }
    if (!included.has('autodocs')) continue;
    if (!resolve(story) || resolve(story).type === 'UnresolvedMetadata') {
      errors.push(`${name}: docs metadata must be statically inspectable.`);
      continue;
    }
    if (SNIPPET_COMPONENTS.has(component)) {
      const code = resolve(at(story, ['parameters', 'docs', 'source', 'code']) ?? at(meta, ['parameters', 'docs', 'source', 'code']));
      const text = code?.type === 'StringLiteral' ? code.value : code?.type === 'TemplateLiteral' && code.expressions.length === 0 ? code.quasis[0].value.cooked : null;
      if (!text?.trim()) errors.push(`${name}: published docs require authored parameters.docs.source.code.`);
    }
    for (const key of ['beforeEach', 'loaders']) {
      if (property(meta, key) || property(story, key)) errors.push(`${name}: published docs cannot declare ${key}. Use !autodocs for runtime-only tests.`);
    }
    if (at(meta, ['parameters', 'viewport']) || at(story, ['parameters', 'viewport'])) {
      errors.push(`${name}: published docs cannot declare parameters.viewport. Use !autodocs for viewport tests.`);
    }
  }
  walk(csf._ast, (node) => {
    if (node.type !== 'ObjectExpression') return;
    const code = at(node, ['source', 'code']);
    const text = code?.type === 'StringLiteral' ? code.value : code?.type === 'TemplateLiteral' && code.expressions.length === 0 ? code.quasis[0].value.cooked : null;
    if (!text) return;
    let snippet;
    try { snippet = loadCsf(text, { fileName: 'snippet.tsx', makeTitle: () => 'Snippet' })._ast; }
    catch { return; } // checkSnippets reports syntax errors.
    walk(snippet, (entry) => {
      if (entry.type !== 'ImportDeclaration' || entry.source.value !== '@jfrader/ui') return;
      if (entry.specifiers.some((specifier) => specifier.type !== 'ImportSpecifier' || gameSymbols.has(specifier.imported.name ?? specifier.imported.value))) {
        errors.push(`source.code at line ${code.loc.start.line}: import Games symbols from their @jfrader/ui/<component> subpath, not the barrel.`);
      }
    });
  });
  return errors;
}

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

export function checkDuplicateDocsTitles(componentsDir) {
  const filesByTitle = new Map();
  const errors = [];
  for (const dir of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const folder = path.join(componentsDir, dir.name);
    for (const story of readdirSync(folder).filter((file) => /\.stories\.tsx?$/.test(file))) {
      const fileName = path.join(folder, story);
      try {
        const csf = loadCsf(readFileSync(fileName, 'utf8'), { fileName, makeTitle: (title) => title ?? fileName }).parse();
        if (!csf.meta.title || csf.meta.tags?.includes('!autodocs')) continue;
        if (!Object.values(csf._stories).some((entry) => !entry.tags?.includes('!autodocs'))) continue;
        const files = filesByTitle.get(csf.meta.title) ?? [];
        files.push(`${dir.name}/${story}`);
        filesByTitle.set(csf.meta.title, files);
      } catch (error) {
        errors.push(`${dir.name}/${story}: cannot check docs title: ${error.message}`);
      }
    }
  }
  for (const [title, files] of filesByTitle) {
    if (files.length > 1) {
      errors.push(`Duplicate docs title "${title}" creates ${files.length} pages with the same name. Give each published file its own title:\n${files.map((file) => `      ${file}`).join('\n')}`);
    }
  }
  return errors;
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
        if (GAME_COMPONENTS.has(dir.name)) {
          errors.push(...checkSnippets(readFileSync(fileName, 'utf8'), fileName)
            .map((error) => `${dir.name}/${story}: ${error}`));
          errors.push(...checkGameStories(readFileSync(fileName, 'utf8'), fileName, dir.name)
            .map((error) => `${dir.name}/${story}: ${error}`));
        }
      } catch (error) {
        errors.push(`${dir.name}/${story}: ${error.message}`);
      }
      checked += 1;
    }
  }
  if (checked === 0) errors.push('No component stories found.');
  errors.push(...checkDuplicateDocsTitles(componentsDir));
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
