import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript-compiler';

export function componentDirectory(directory, seen = new Set()) {
  const index = path.join(directory, 'index.ts');
  if (!existsSync(index)) return directory;
  if (seen.has(index)) throw new Error(`Circular component re-export: ${index}`);
  seen.add(index);
  const file = ts.createSourceFile(index, readFileSync(index, 'utf8'), ts.ScriptTarget.Latest);
  const modules = file.statements.map((statement) =>
    ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text : undefined);
  if (!modules.length || modules.some((name) => !name?.startsWith('@jfrader/')) || new Set(modules).size !== 1) return directory;
  const resolved = ts.resolveModuleName(modules[0], index, {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
  }, ts.sys).resolvedModule;
  if (!resolved) throw new Error(`Cannot resolve component re-export: ${index}`);
  return componentDirectory(path.dirname(resolved.resolvedFileName), seen);
}
