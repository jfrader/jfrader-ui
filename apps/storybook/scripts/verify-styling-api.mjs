import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-compiler';

export function checkStylingApi(source, filename = 'component.tsx', { snippet = false } = {}) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [];
  const bindings = new Map();
  const name = (node) => node?.getText(file).replace(/^['"]|['"]$/g, '');
  const report = (node, message) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    errors.push(`${filename}:${line + 1}: ${message}`);
  };
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      bindings.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  }
  collect(file);
  function slot(node, seen = new Set()) {
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      if (seen.has(node.text)) return;
      const next = new Set(seen).add(node.text);
      slot(bindings.get(node.text), next);
      return;
    }
    if (ts.isPropertyAssignment(node) && name(node.name) === 'css')
      report(node, 'slotProps styling uses sx, not css');
    ts.forEachChild(node, (child) => slot(child, seen));
  }
  function visit(node) {
    if (!snippet && ts.isIdentifier(node) && node.text === 'SlotCss')
      report(node, 'SlotCss is retired; use SxProps');
    if (!snippet && ts.isPropertySignature(node) && name(node.name) === 'css')
      report(node, 'component and slot prop types expose sx, not css');
    if ((ts.isPropertyAssignment(node) || ts.isJsxAttribute(node)) && name(node.name) === 'slotProps' && node.initializer)
      slot(node.initializer);
    if (!snippet && ts.isPropertyAssignment(node) && name(node.name) === 'code') {
      const value = node.initializer;
      let code;
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) code = value.text;
      if (ts.isTemplateExpression(value))
        code = value.head.text + value.templateSpans.map((span) => `placeholder${span.literal.text}`).join('');
      if (code) errors.push(...checkStylingApi(code, `${filename} source.code`, { snippet: true }));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...new Set(errors)];
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (['node_modules', 'dist', 'storybook-static', '.git'].includes(entry.name)) return [];
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const errors = ['packages/ui/src', 'apps/storybook', 'apps/pilot'].flatMap((directory) =>
    files(path.join(root, directory)).flatMap((file) => checkStylingApi(readFileSync(file, 'utf8'), path.relative(root, file))),
  );
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Styling API: sx-only component types, slot props and authored examples.');
}
