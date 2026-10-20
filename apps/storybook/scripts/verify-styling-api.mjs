import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-compiler';

function styleReferences(node) {
  if (!node) return [];
  if (ts.isJsxExpression(node)) return styleReferences(node.expression);
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
    return styleReferences(node.expression);
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(styleReferences);
  if (ts.isConditionalExpression(node))
    return [...styleReferences(node.whenTrue), ...styleReferences(node.whenFalse)];
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return styleReferences(node.right);
    if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind))
      return [...styleReferences(node.left), ...styleReferences(node.right)];
  }
  if (ts.isIdentifier(node)) return node.text === 'undefined' ? [] : [node.text];
  if (ts.isPropertyAccessExpression(node))
    return styleReferences(node.expression).map((base) => `${base}.${node.name.text}`);
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression))
    return styleReferences(node.expression).map((base) => `${base}.${node.argumentExpression.text}`);
  return [];
}

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
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const sx = attributes.find((attribute) => name(attribute.name) === 'sx');
      const consumer = new Set(styleReferences(sx?.initializer));
      for (const attribute of attributes.filter((attribute) => ['styles', 'css'].includes(name(attribute.name)))) {
        const duplicate = styleReferences(attribute.initializer).find((value) => consumer.has(value));
        if (duplicate) report(attribute, `style value ${duplicate} is applied in both ${name(attribute.name)} and sx`);
      }
    }
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
    if (!snippet && /\.stories\.tsx$/.test(filename) && (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && ['usage', 'description'].includes(name(node.name))) {
      let ancestor = node.parent;
      while (ancestor && !(ts.isPropertyAssignment(ancestor) && name(ancestor.name) === 'docs')) ancestor = ancestor.parent;
      function prose(value, seen = new Set()) {
        if (ts.isIdentifier(value) && bindings.has(value.text)) {
          if (!seen.has(value.text)) prose(bindings.get(value.text), new Set(seen).add(value.text));
          return;
        }
        const text = ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) ? value.text
          : ts.isTemplateExpression(value) ? value.head.text + value.templateSpans.map((span) => span.literal.text).join('') : undefined;
        if (text !== undefined) {
          if (/\bslotProps\b/.test(text) && /\bcss\b/.test(text))
            report(value, 'published slotProps prose documents css; use sx');
        } else ts.forEachChild(value, (child) => prose(child, seen));
      }
      if (ancestor) prose(ts.isShorthandPropertyAssignment(node) ? node.name : node.initializer);
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
