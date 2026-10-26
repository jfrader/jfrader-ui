import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { categories, type IconMetadata, type IconVariant } from '../src/types';
import { componentName } from '../src/name';
import { geometryPoints } from './geometry';

export type MetadataSource = Record<string, Omit<IconMetadata, 'variants' | 'category'> & { category?: IconMetadata['category'] }>;

/** Read every `src/metadata/*.json` batch and merge it. One name may live in exactly one file. */
export function readMetadata(root: string): MetadataSource {
  const directory = join(root, 'src/metadata');
  const merged: MetadataSource = {};
  const owner = new Map<string, string>();
  if (!existsSync(directory)) throw new Error('src/metadata is missing');
  for (const entry of readdirSync(directory).filter((file) => file.endsWith('.json')).sort((a, b) => a.localeCompare(b, 'en'))) {
    const batch = JSON.parse(readFileSync(join(directory, entry), 'utf8')) as MetadataSource;
    for (const [name, value] of Object.entries(batch)) {
      const previous = owner.get(name);
      if (previous) throw new Error(`metadata for ${name} is declared in both ${previous} and ${entry}`);
      owner.set(name, entry);
      merged[name] = value;
    }
  }
  return merged;
}
export interface Source { name: string; file: string; variant: IconVariant; svg: string }
export interface Element { tag: string; attrs: Record<string, string> }

const lineStyle = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const solidStyle = { fill: 'currentColor', stroke: 'none' };
const elementAttributes: Record<string, string[]> = {
  path: ['d'], circle: ['cx', 'cy', 'r'], rect: ['x', 'y', 'width', 'height', 'rx'],
};
const styleAttributes = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'];

function attributes(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const remaining = text.replace(/\s+([\w:-]+)="([^"<>]*)"/g, (_, key: string, value: string) => {
    if (Object.hasOwn(result, key)) throw new Error(`duplicate attribute ${key}`);
    result[key] = value;
    return '';
  });
  if (remaining.trim()) throw new Error('malformed attributes');
  return result;
}

export function parseSvg(svg: string, variant: IconVariant): Element[] {
  const root = /^\s*<svg(\s[^<>]*?)>([\s\S]*)<\/svg>\s*$/.exec(svg);
  if (!root) throw new Error('root must be svg');
  const attrs = attributes(root[1]!);
  const expected = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', ...(variant === 'line' ? lineStyle : solidStyle) };
  if (Object.keys(attrs).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => attrs[key] !== value)) {
    throw new Error('root attributes must exactly match the canvas and variant style');
  }
  const elements: Element[] = [];
  const remaining = root[2]!.replace(/<(\w+)(\s[^<>]*?)?\s*\/\s*>/g, (_, tag: string, text: string = '') => {
    const allowed = elementAttributes[tag];
    if (!allowed) throw new Error(`forbidden element ${tag}`);
    const child = attributes(text);
    for (const [key, value] of Object.entries(child)) {
      if (![...allowed, ...styleAttributes].includes(key)) throw new Error(`forbidden attribute ${key}`);
      if (/&|#|rgba?\(/i.test(value)) throw new Error(`forbidden value for ${key}`);
      if (/[-+]?(?:\d*\.\d{3,})(?:[eE][-+]?\d+)?/.test(value) || /\d[eE][-+]?\d/.test(value)) throw new Error('coordinates must have at most two decimals (no exponents)');
      if (key === 'fill' && value !== 'none' && !(tag === 'circle' && Number(child.r) <= 3 && value === 'currentColor' && child.stroke === 'none') && variant === 'line') throw new Error('painted fill on line icon');
      if (['fill', 'stroke'].includes(key) && !['none', 'currentColor'].includes(value)) throw new Error(`forbidden ${key}`);
      if (key === 'fill-rule' && !['evenodd', 'nonzero'].includes(value)) throw new Error('invalid fill-rule');
      if (variant === 'solid' && key.startsWith('stroke')) throw new Error('solid geometry must not carry stroke attributes');
      if (key.startsWith('stroke-') && value !== lineStyle[key as keyof typeof lineStyle]) throw new Error(`invalid ${key}`);
      if (variant === 'line' && key === 'stroke' && !(tag === 'circle' && Number(child.r) <= 3 && child.fill === 'currentColor' && value === 'none') && value !== 'currentColor') throw new Error('line geometry must retain its stroke');
    }
    const points = geometryPoints(tag, child);
    if (points.some((point) => point.some((coordinate) => !Number.isFinite(coordinate) || coordinate < 2 - 1e-9 || coordinate > 22 + 1e-9))) throw new Error('geometry outside 2..22');
    elements.push({ tag, attrs: child });
    return '';
  });
  if (remaining.trim() || !elements.length) throw new Error('only self-closing path, circle, and rect elements are allowed');
  return elements;
}

export function readSources(root: string): Source[] {
  return (['line', 'solid'] as const).flatMap((variant) => {
    const directory = join(root, 'src/icons', variant === 'solid' ? 'solid' : '');
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).sort((a, b) => a.name.localeCompare(b.name, 'en')).map((entry) => {
      const file = join(directory, entry.name);
      return { name: entry.name.replace(/\.svg$/, ''), file, variant, svg: readFileSync(file, 'utf8') };
    });
  });
}

export function collect(sources: Source[], metadata: MetadataSource) {
  const errors = new Map<string, string[]>();
  const parsed = new Map<Source, Element[]>();
  const fingerprints = new Map<string, string>();
  const fail = (file: string, message: string) => errors.set(file, [...(errors.get(file) ?? []), message]);
  for (const source of sources) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(source.name) || !source.file.endsWith('.svg')) fail(source.file, 'filename must be kebab-case.svg');
    const entry = metadata[source.name];
    if (!entry) fail(source.file, 'missing metadata entry');
    else if (entry.name !== source.name) fail(source.file, 'metadata name must equal filename');
    try {
      const elements = parseSvg(source.svg, source.variant);
      parsed.set(source, elements);
      const fingerprint = `${source.variant}:${elements.map(({ tag, attrs }) =>
        tag === 'path'
          ? `path:${(attrs.d ?? '').match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)/g)?.join(' ')}`
          : `${tag}:${JSON.stringify(attrs)}`,
      ).join('|')}`;
      const duplicate = fingerprints.get(fingerprint);
      if (duplicate) fail(source.file, `duplicate path data from ${duplicate}`);
      else fingerprints.set(fingerprint, source.file);
    } catch (error) { fail(source.file, error instanceof Error ? error.message : String(error)); }
  }
  const table: IconMetadata[] = [];
  for (const [name, entry] of Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const variants = (['line', 'solid'] as const).filter((variant) => sources.some((source) => source.name === name && source.variant === variant));
    if (!variants.length) fail(`metadata:${name}`, 'orphaned metadata entry');
    if (!variants.includes('line')) fail(`metadata:${name}`, 'missing line source');
    if (!categories.includes(entry.category ?? 'action') || !Array.isArray(entry.tags) || !Array.isArray(entry.aliases) || [...entry.tags, ...entry.aliases].some((value) => typeof value !== 'string') || typeof entry.expressive !== 'boolean' || !/^\d+\.\d+\.\d+$/.test(entry.since)) fail(`metadata:${name}`, 'invalid metadata');
    table.push({ name: entry.name, category: entry.category ?? 'action', tags: entry.tags, aliases: entry.aliases, variants, expressive: entry.expressive, since: entry.since });
  }
  if (!sources.length) fail('src/icons', 'no SVG sources');
  return { errors, parsed, table, fail };
}

export function artifacts(sources: Source[], metadata: MetadataSource): Map<string, string> {
  const { errors, parsed, table } = collect(sources, metadata);
  if (errors.size) throw new Error([...errors].map(([file, messages]) => `${file}: ${messages.join('; ')}`).join('\n'));
  const files = new Map<string, string>();
  const header = '/* Generated from src/icons and src/metadata.ts. Do not edit. Run pnpm generate. */\n';
  for (const entry of table) {
    const components = entry.variants.map((variant) => {
      const source = sources.find((item) => item.name === entry.name && item.variant === variant)!;
      const name = componentName(entry.name) + (variant === 'solid' ? 'Solid' : '');
      // Generated without JSX: this package is compiled under consumers' JSX settings, and a
      // story importing it must not drag that consumer's JSX runtime into the icon sources.
      const children = parsed.get(source)!.map(({ tag, attrs }) =>
        `h('${tag}', { ${Object.entries(attrs).map(([key, value]) => `${/^[a-z]+$/.test(key) ? key : JSON.stringify(key)}: '${value}'`).join(', ')} })`,
      ).join(', ');
      const defaults = variant === 'solid' ? ", { variant: 'solid' }" : '';
      return `export const ${name} = createSvgIcon(h(Fragment, null, ${children}), 'Icons.${name}'${defaults});\n`;
    });
    files.set(`src/generated/${entry.name}.tsx`, `${header}import { createElement as h, Fragment } from 'react';\nimport { createSvgIcon } from '../svg-icon';\n\n${components.join('\n')}`);
  }
  files.set('src/generated/index.ts', header + table.map((entry) => `export { ${entry.variants.map((variant) => componentName(entry.name) + (variant === 'solid' ? 'Solid' : '')).join(', ')} } from './${entry.name}';`).join('\n') + '\n');
  files.set('icons.json', JSON.stringify(table, null, 2) + '\n');
  return files;
}
