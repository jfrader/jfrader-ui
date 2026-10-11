'use client';

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { raisedSurface } from '../../styling/surface';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { TextField } from '../text-field';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
export interface JsonViewerLabels {
  tree: string;
  search: string;
  expandAll: string;
  collapseAll: string;
  previousMatch: string;
  nextMatch: string;
  copyValue: string;
  copyPath: string;
  copied: string;
  copyFailed: string;
  invalidData: string;
  /** Child count chip; `type` tells objects (keys) from arrays (items). */
  count: (count: number, type: 'object' | 'array') => string;
  match: (current: number, total: number, truncated: boolean) => string;
  showMore: (remaining: number) => string;
}
export interface JsonViewerPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}
export type JsonViewerSlotProps = Partial<
  Record<
    'toolbar' | 'search' | 'tree' | 'row' | 'group' | 'value' | 'pathBar' | 'status' | 'action',
    JsonViewerPartProps
  >
>;
export interface JsonViewerProps
  extends Omit<ComponentPropsWithRef<'div'>, 'onSelect' | 'onCopy' | 'defaultValue' | 'children'>, SxProps {
  data: JsonValue;
  rootName?: string;
  expandedValue?: readonly string[];
  defaultExpandedValue?: readonly string[];
  onExpandedValueChange?: (paths: string[]) => void;
  defaultExpandDepth?: number;
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  value?: string;
  defaultValue?: string;
  onValueChange?: (path: string) => void;
  onNodeActivate?: (detail: { path: string; value: JsonValue; type: JsonValueType }) => void;
  searchable?: boolean;
  copyable?: boolean;
  showPath?: boolean;
  pageSize?: number;
  maxMatches?: number;
  maxHeight?: CSSProperties['maxHeight'];
  size?: 'sm' | 'md';
  locale?: Intl.LocalesArgument;
  labels?: Partial<JsonViewerLabels>;
  onCopy?: (detail: { kind: 'value' | 'path'; path: string; text: string }) => void;
  onCopyError?: (detail: { kind: 'value' | 'path'; path: string; error: unknown }) => void;
  slotProps?: JsonViewerSlotProps;
}

interface DataNode {
  path: string;
  key: string;
  parent?: string;
  value: JsonValue;
  type: JsonValueType;
  children: string[];
  level: number;
  index: number;
}
interface VisibleNode {
  path: string;
  parent?: string;
  level: number;
  position: number;
  setSize: number;
  more?: number;
}
const TYPEAHEAD_MS = 500;
const COUNT_NOUNS = {
  object: { one: 'key', other: 'keys' },
  array: { one: 'item', other: 'items' },
} as const;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_MATCHES = 2000;
const positiveInteger = (value: number, fallback: number) =>
  Number.isInteger(value) && value > 0 ? value : fallback;
const isBranch = (node: DataNode) => node.children.length > 0;
const childPath = (path: string, key: string, array: boolean) =>
  array
    ? `${path}[${key}]`
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;
const primitiveText = (node: DataNode) => (node.type === 'null' ? 'null' : String(node.value));

function inspect(data: JsonValue, rootName: string): Map<string, DataNode> | null {
  const nodes = new Map<string, DataNode>();
  const ancestors = new Set<object>();
  const stack: (
    | { value: unknown; path: string; key: string; parent?: string; level: number; index: number }
    | { exit: object }
  )[] = [{ value: data, path: rootName, key: rootName, level: 1, index: 0 }];
  try {
    while (stack.length) {
      const entry = stack.pop()!;
      if ('exit' in entry) {
        ancestors.delete(entry.exit);
        continue;
      }
      const { value } = entry;
      const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      if (
        !['null', 'array', 'object', 'string', 'number', 'boolean'].includes(type) ||
        (type === 'number' && !Number.isFinite(value))
      )
        return null;
      const node: DataNode = {
        ...entry,
        value: value as JsonValue,
        type: type as JsonValueType,
        children: [],
      };
      nodes.set(node.path, node);
      if (value === null || typeof value !== 'object') continue;
      if (ancestors.has(value) || Object.getOwnPropertySymbols(value).length) return null;
      const array = Array.isArray(value);
      if (array && Object.getPrototypeOf(value) !== Array.prototype) return null;
      if (
        !array &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      )
        return null;
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Object.keys(descriptors).filter((key) => !array || key !== 'length');
      if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index))))
        return null;
      if (keys.some((key) => !('value' in descriptors[key]!) || !descriptors[key]!.enumerable)) return null;
      ancestors.add(value);
      stack.push({ exit: value });
      node.children = keys.map((key) => childPath(node.path, key, array));
      for (let index = keys.length - 1; index >= 0; index--) {
        const key = keys[index]!;
        stack.push({
          value: descriptors[key]!.value,
          path: node.children[index]!,
          key,
          parent: node.path,
          level: node.level + 1,
          index,
        });
      }
    }
    return nodes;
  } catch {
    return null;
  }
}

const SELECTION_BAR = '2px';
const thinScrollbar = {
  scrollbarWidth: 'thin',
  scrollbarColor: `${vars.color.borderStrong} transparent`,
} as const;
const rootStyle = css({
  ...raisedSurface,
  minInlineSize: 0,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.raised,
  fontSize: vars.textSize.sm,
  overflow: 'hidden',
});
const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[1],
  padding: vars.space[2],
  borderBlockEnd: `1px solid ${vars.color.border}`,
});
const searchWrapStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flex: '1 1 12rem',
  minInlineSize: 0,
});
const searchIconStyle = css({
  position: 'absolute',
  insetInlineStart: vars.space[3],
  display: 'inline-flex',
  color: vars.color.textMuted,
  pointerEvents: 'none',
  '& svg': { inlineSize: vars.space[4], blockSize: vars.space[4] },
});
const searchStyle = css({ flex: 1, minInlineSize: 0 });
const searchControlStyle = css({
  paddingInlineStart: `calc(${vars.space[3]} + ${vars.space[4]} + ${vars.space[2]})`,
});
const matchStatusStyle = css({
  color: vars.color.textMuted,
  fontSize: vars.textSize.xs,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  paddingInline: vars.space[1],
  '&:empty': { paddingInline: 0 },
});
const actionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[1],
  marginInlineStart: 'auto',
});
const separatorStyle = css({
  alignSelf: 'center',
  inlineSize: '1px',
  blockSize: vars.space[4],
  marginInline: vars.space[1],
  background: vars.color.border,
});
const actionStyle = css({
  inlineSize: vars.space[8],
  paddingInline: 0,
  color: vars.color.textMuted,
  '&:hover:not(:disabled)': { color: vars.color.text },
  '& svg': { inlineSize: vars.space[4], blockSize: vars.space[4] },
});
const treeStyle = css({
  ...thinScrollbar,
  overflow: 'auto',
  maxBlockSize: 'var(--json-max-height)',
  padding: vars.space[2],
  fontFamily: vars.font.mono,
  '--json-indent': vars.space[5],
  '--json-caret': vars.space[4],
  '@media (max-width: 40rem)': { '--json-indent': vars.space[4] },
});
const itemStyle = css({ outline: 'none', '&:focus-visible > [data-ui="json-viewer-row"]': focusRingInset });
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[1],
  minBlockSize: 'var(--json-row-height)',
  paddingInlineEnd: vars.space[3],
  paddingInlineStart: `calc(var(--json-depth) * var(--json-indent) + ${vars.space[1]})`,
  borderInlineStart: `${SELECTION_BAR} solid transparent`,
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  whiteSpace: 'pre',
  minInlineSize: 'max-content',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': { background: vars.color.surfaceHover },
  '[aria-selected="true"] > &': {
    borderInlineStartColor: vars.color.accent,
    background: vars.color.accentSoft,
  },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    color: 'CanvasText',
    '[aria-selected="true"] > &': { borderInlineStartColor: 'Highlight' },
  },
});
// Indent guide: a hairline under the owning row's caret, spanning the group's rows.
const groupStyle = css({
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlock: 0,
    insetInlineStart: `calc(var(--json-depth) * var(--json-indent) + ${vars.space[1]} + ${SELECTION_BAR} + var(--json-caret) / 2)`,
    inlineSize: '1px',
    background: vars.color.border,
    pointerEvents: 'none',
  },
  [FORCED_COLORS]: { '&::before': { background: 'GrayText' } },
});
const caretStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  inlineSize: 'var(--json-caret)',
  color: vars.color.textMuted,
  '&[data-state]::after': disclosureCaret,
  '&[data-state="open"]::after': { transform: 'rotate(90deg)' },
  '&[data-state="open"]:dir(rtl)::after': { transform: 'rotate(-90deg)' },
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
});
// JSON text runs resolve their own direction so RTL layouts keep keys, values and counts readable.
const ownDirection = { unicodeBidi: 'plaintext' } as const;
const keyStyle = css({ ...ownDirection, color: vars.color.text });
const punctuationStyle = css({ color: vars.color.textMuted });
const valueStyle = css({
  ...ownDirection,
  '&[data-type="string"]': { color: vars.color.accentText },
  '&[data-type="number"]': { color: vars.color.textMuted, fontVariantNumeric: 'tabular-nums' },
  '&[data-type="boolean"]': { color: vars.color.warning },
  '&[data-type="null"]': { color: vars.color.textMuted, fontStyle: 'italic' },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const chipStyle = css({
  ...ownDirection,
  display: 'inline-flex',
  alignItems: 'center',
  paddingInline: vars.space[2],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.full,
  color: vars.color.textMuted,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.xs,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: vars.lineHeight.base,
});
const moreStyle = css({ color: vars.color.accentText, fontFamily: vars.font.sans });
const markStyle = css({
  color: vars.color.text,
  background: vars.color.accentSoft,
  borderRadius: `calc(${vars.radius.sm} / 2)`,
  textDecoration: 'underline',
  textDecorationColor: vars.color.accentText,
  textUnderlineOffset: '0.2em',
  [FORCED_COLORS]: { color: 'Highlight', background: 'Canvas' },
});
const pathStyle = css({
  display: 'grid',
  gap: vars.space[2],
  padding: vars.space[3],
  borderBlockStart: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  minInlineSize: 0,
});
const pathHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  minInlineSize: 0,
});
const pathCodeStyle = css({
  ...ownDirection,
  fontFamily: vars.font.mono,
  fontWeight: vars.fontWeight.medium,
  overflowWrap: 'anywhere',
  minInlineSize: 0,
});
const detailsStyle = css({
  ...thinScrollbar,
  margin: 0,
  padding: vars.space[3],
  border: `1px solid ${vars.color.borderSubtle}`,
  borderRadius: vars.radius.md,
  background: vars.color.surfaceInset,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  maxBlockSize: 'var(--json-max-height)',
  overflow: 'auto',
  '&:focus-visible': focusRingInset,
});
const statusStyle = css({
  paddingInline: vars.space[3],
  paddingBlock: vars.space[2],
  borderBlockStart: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
  fontSize: vars.textSize.xs,
  '&:empty': { padding: 0, borderBlockStart: 0 },
});
const invalidStyle = css({ padding: vars.space[4], color: vars.color.textMuted });

const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);
const searchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
const previousIcon = icon(<path d="m18 15-6-6-6 6" />);
const nextIcon = icon(<path d="m6 9 6 6 6-6" />);
const expandIcon = icon(<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />);
const collapseIcon = icon(<path d="m7 20 5-5 5 5M7 4l5 5 5-5" />);
const copyIcon = icon(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </>,
);
const pathIcon = icon(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </>,
);

/** Read-only JSON tree. Search overlays expansion/pages; clearing restores base state.
 * Each expanded treeitem OWNS its child role=group via aria-owns; the group is a DOM sibling
 * (flattened out of the treeitem) so the author name stays scoped to the label — nesting it in
 * the DOM would fold the whole subtree into the treeitem's visible text and break the
 * label-content-name-mismatch axe gate. Roving DOM focus follows the TreeView
 * navigation contract. Right opens, Left closes/moves to parent even in RTL. Up/Down clamp;
 * Home/End move; Enter/Space activate; 500ms typeahead; / searches; Ctrl/Cmd+C copies JSON
 * (+Shift copies path).
 * Strict JSON only, no getters/cycles/nonfinite numbers. Paged, not virtualized.
 */
export function JsonViewer({
  data,
  rootName = 'root',
  expandedValue,
  defaultExpandedValue,
  onExpandedValueChange,
  defaultExpandDepth = 1,
  query: queryProp,
  defaultQuery = '',
  onQueryChange,
  value: valueProp,
  defaultValue,
  onValueChange,
  onNodeActivate,
  searchable = true,
  copyable = true,
  showPath = true,
  pageSize: pageSizeProp = DEFAULT_PAGE_SIZE,
  maxMatches: maxMatchesProp = DEFAULT_MAX_MATCHES,
  maxHeight = '26rem',
  size = 'md',
  locale,
  labels: labelProps,
  onCopy,
  onCopyError,
  slotProps,
  ref,
  className,
  sx,
  style,
  onKeyDown,
  onClick,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: JsonViewerProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const lastFocus = useRef<HTMLDivElement | null>(null);
  const suppressFocusSelection = useRef(false);
  const typeahead = useRef({ text: '', time: 0 });
  const labelIdBase = useId();
  const nodes = useMemo(() => inspect(data, rootName), [data, rootName]);
  const format = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const labels: JsonViewerLabels = {
    tree: 'JSON',
    search: 'Search JSON',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    previousMatch: 'Previous match',
    nextMatch: 'Next match',
    copyValue: 'Copy value',
    copyPath: 'Copy path',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    invalidData: 'Invalid JSON data',
    count: (count, type) =>
      `${format.format(count)} ${COUNT_NOUNS[type][plural.select(count) === 'one' ? 'one' : 'other']}`,
    match: (current, total, truncated) =>
      `${format.format(current)} / ${format.format(total)}${truncated ? '+' : ''}`,
    showMore: (remaining) => `Show more (${format.format(remaining)} remaining)`,
    ...labelProps,
  };
  const pageSize = positiveInteger(pageSizeProp, DEFAULT_PAGE_SIZE);
  const maxMatches = positiveInteger(maxMatchesProp, DEFAULT_MAX_MATCHES);
  const [seed] = useState(
    () =>
      defaultExpandedValue ??
      [...(nodes?.values() ?? [])]
        .filter((node) => isBranch(node) && node.level <= Math.max(0, Math.floor(defaultExpandDepth)))
        .map((node) => node.path),
  );
  const [expanded = [], requestExpanded] = useControlledState<readonly string[]>(
    expandedValue,
    seed,
    (paths) => onExpandedValueChange?.([...paths]),
  );
  const [query = '', requestQuery] = useControlledState(queryProp, defaultQuery, onQueryChange);
  const [selected = rootName, requestSelected] = useControlledState(
    valueProp,
    defaultValue ?? rootName,
    onValueChange,
  );
  const [focused, setFocused] = useState(valueProp ?? defaultValue ?? rootName);
  const [paging, setPaging] = useState<{ data: JsonValue; pages: Map<string, number> }>({
    data,
    pages: new Map(),
  });
  const [overlay, setOverlay] = useState<{
    query: string;
    closed: Set<string>;
    opened: Set<string>;
    pages: Map<string, number>;
  }>({ query, closed: new Set(), opened: new Set(), pages: new Map() });
  const [status, setStatus] = useState('');
  const pages = Object.is(paging.data, data) ? paging.pages : new Map<string, number>();
  const searchOverlay =
    overlay.query === query
      ? overlay
      : { query, closed: new Set<string>(), opened: new Set<string>(), pages: new Map<string, number>() };
  const search = useMemo(() => {
    const matches: string[] = [];
    const ancestors = new Set<string>();
    const limits = new Map<string, number>();
    const needle = query.toLowerCase();
    let truncated = false;
    if (query && nodes)
      for (const node of nodes.values()) {
        if (
          !node.key.toLowerCase().includes(needle) &&
          (node.type === 'object' ||
            node.type === 'array' ||
            !primitiveText(node).toLowerCase().includes(needle))
        )
          continue;
        if (matches.length === maxMatches) {
          truncated = true;
          break;
        }
        matches.push(node.path);
        let child = node;
        while (child.parent !== undefined) {
          ancestors.add(child.parent);
          limits.set(child.parent, Math.max(limits.get(child.parent) ?? 0, child.index + 1));
          child = nodes.get(child.parent)!;
        }
      }
    return { matches, ancestors, limits, truncated };
  }, [nodes, query, maxMatches]);
  const isOpen = (path: string) =>
    !searchOverlay.closed.has(path) &&
    (expanded.includes(path) || search.ancestors.has(path) || searchOverlay.opened.has(path));
  const visible: VisibleNode[] = [];
  const childrenByPath = new Map<string, VisibleNode[]>();
  if (nodes) {
    const stack: VisibleNode[] = [{ path: rootName, level: 1, position: 1, setSize: 1 }];
    while (stack.length) {
      const row = stack.pop()!;
      visible.push(row);
      if (row.more !== undefined) continue;
      const node = nodes.get(row.path)!;
      if (!isOpen(row.path) || !isBranch(node)) continue;
      const loaded = Math.min(
        node.children.length,
        Math.max(
          pages.get(row.path) ?? pageSize,
          search.limits.get(row.path) ?? 0,
          query ? (searchOverlay.pages.get(row.path) ?? 0) : 0,
        ),
      );
      const more = node.children.length - loaded;
      const setSize = loaded + (more ? 1 : 0);
      const children: VisibleNode[] = node.children.slice(0, loaded).map((path, index) => ({
        path,
        parent: row.path,
        level: row.level + 1,
        position: index + 1,
        setSize,
      }));
      if (more)
        children.push({
          path: `${row.path}\u0000more`,
          parent: row.path,
          level: row.level + 1,
          position: setSize,
          setSize,
          more,
        });
      childrenByPath.set(row.path, children);
      stack.push(...children.toReversed());
    }
  }
  // Paths removed by a data change resolve through the prior data's parents; a vanished selection
  // keeps resolving from its last recovered path, so recovery survives repeated data changes.
  const [recovery, setRecovery] = useState({ nodes, previousNodes: nodes, selected, path: selected });
  const previousNodes = Object.is(recovery.nodes, nodes) ? recovery.previousNodes : recovery.nodes;
  const visiblePaths = new Set(visible.map((row) => row.path));
  const nearestVisible = (path: string): string => {
    let current: string | undefined = path;
    while (current !== undefined) {
      if (visiblePaths.has(current)) return current;
      current = nodes?.get(current)?.parent ?? previousNodes?.get(current)?.parent;
    }
    return rootName;
  };
  const tabStop = nearestVisible(focused);
  const current =
    nodes?.get(selected) ??
    nodes?.get(nearestVisible(recovery.selected === selected ? recovery.path : selected));
  const recoveredPath = current?.path ?? rootName;
  if (
    !Object.is(recovery.nodes, nodes) ||
    recovery.selected !== selected ||
    recovery.path !== recoveredPath
  )
    setRecovery({ nodes, previousNodes, selected, path: recoveredPath });
  useLayoutEffect(() => {
    if (!Object.is(paging.data, data)) {
      setPaging({ data, pages: new Map() });
      setOverlay({ query, closed: new Set(), opened: new Set(), pages: new Map() });
    }
    if (focused === tabStop) return;
    const previous = lastFocus.current;
    const document = treeRef.current?.ownerDocument;
    const ownedFocus =
      previous &&
      document &&
      (document.activeElement === previous ||
        (!previous.isConnected && document.activeElement === document.body));
    setFocused(tabStop);
    if (ownedFocus) {
      suppressFocusSelection.current = true;
      rowRefs.current.get(tabStop)?.focus();
      suppressFocusSelection.current = false;
    }
  });
  const moveFocus = (path: string) => {
    const target = rowRefs.current.get(path);
    setFocused(path);
    target?.focus();
    target
      ?.querySelector(':scope > [data-ui="json-viewer-row"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  };
  const changeExpansion = (paths: readonly string[]) => {
    const unique = [...new Set(paths)];
    if (unique.length !== new Set(expanded).size || unique.some((path) => !expanded.includes(path)))
      requestExpanded(unique);
  };
  const toggle = (path: string) => {
    if (query) {
      const closed = new Set(searchOverlay.closed);
      const opened = new Set(searchOverlay.opened);
      if (isOpen(path)) {
        closed.add(path);
        opened.delete(path);
      } else {
        closed.delete(path);
        opened.add(path);
      }
      setOverlay({ ...searchOverlay, closed, opened });
    } else changeExpansion(isOpen(path) ? expanded.filter((item) => item !== path) : [...expanded, path]);
  };
  const loadPage = (row: VisibleNode) => {
    const parent = row.parent!;
    const children = childrenByPath.get(parent)!;
    const loaded = children.length - 1;
    const next = Math.min(nodes!.get(parent)!.children.length, loaded + pageSize);
    if (query) setOverlay({ ...searchOverlay, pages: new Map(searchOverlay.pages).set(parent, next) });
    else setPaging({ data, pages: new Map(pages).set(parent, next) });
    const firstNew = nodes!.get(parent)!.children[loaded]!;
    requestSelected(firstNew);
    setFocused(firstNew);
    lastFocus.current = rowRefs.current.get(row.path) ?? null;
    pendingFocus.current = firstNew;
  };
  const pendingFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (pendingFocus.current !== null) {
      suppressFocusSelection.current = true;
      rowRefs.current.get(pendingFocus.current)?.focus();
      suppressFocusSelection.current = false;
      pendingFocus.current = null;
    }
  });
  const activate = (row: VisibleNode) => {
    if (row.more !== undefined) {
      loadPage(row);
      return;
    }
    const node = nodes!.get(row.path)!;
    if (isBranch(node)) toggle(row.path);
    else onNodeActivate?.({ path: node.path, value: node.value, type: node.type });
  };
  const copy = async (kind: 'value' | 'path', path = current?.path) => {
    if (!copyable || path === undefined || !nodes?.has(path)) return;
    try {
      const text = kind === 'path' ? path : JSON.stringify(nodes.get(path)!.value, null, 2);
      const clipboard = treeRef.current?.ownerDocument.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error('Clipboard API unavailable');
      await clipboard.writeText(text);
      setStatus(labels.copied);
      onCopy?.({ kind, path, text });
    } catch (error) {
      setStatus(labels.copyFailed);
      onCopyError?.({ kind, path, error });
    }
  };
  const navigateMatch = (direction: number, focus: boolean) => {
    if (!search.matches.length) return;
    const index = search.matches.indexOf(selected);
    const nextIndex =
      index < 0
        ? direction > 0
          ? 0
          : search.matches.length - 1
        : (index + direction + search.matches.length) % search.matches.length;
    const next = search.matches[nextIndex]!;
    setOverlay({ ...searchOverlay, closed: new Set() });
    requestSelected(next);
    if (focus) {
      setFocused(next);
      pendingFocus.current = next;
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.target === searchRef.current) {
      if (event.key === 'Enter') {
        event.preventDefault();
        navigateMatch(event.shiftKey ? -1 : 1, false);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        requestQuery('');
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocus(tabStop);
      }
      return;
    }
    const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    if (!item || !treeRef.current?.contains(item) || event.target !== item) return;
    const index = visible.findIndex((row) => rowRefs.current.get(row.path) === item);
    const row = visible[index];
    if (!row) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'c') {
      if (copyable && row.more === undefined && !item.ownerDocument.getSelection()?.toString()) {
        event.preventDefault();
        void copy(event.shiftKey ? 'path' : 'value', row.path);
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
    const node = nodes?.get(row.path);
    const actions: Record<string, () => void> = {
      ArrowDown: () => moveFocus(visible[Math.min(index + 1, visible.length - 1)]!.path),
      ArrowUp: () => moveFocus(visible[Math.max(index - 1, 0)]!.path),
      Home: () => moveFocus(visible[0]!.path),
      End: () => moveFocus(visible[visible.length - 1]!.path),
      ArrowRight: () => {
        if (node && isBranch(node)) {
          if (!isOpen(row.path)) toggle(row.path);
          else moveFocus(childrenByPath.get(row.path)![0]!.path);
        }
      },
      ArrowLeft: () => {
        if (node && isBranch(node) && isOpen(row.path)) toggle(row.path);
        else if (row.parent) moveFocus(row.parent);
      },
      Enter: () => activate(row),
      ' ': () => activate(row),
      '/': () => {
        if (searchable) searchRef.current?.focus();
      },
    };
    if (actions[event.key] && (event.key !== '/' || searchable)) {
      event.preventDefault();
      actions[event.key]!();
      return;
    }
    if ([...event.key].length === 1) {
      const now = Date.now();
      const buffered =
        now - typeahead.current.time < TYPEAHEAD_MS ? typeahead.current.text + event.key : event.key;
      typeahead.current = { text: buffered, time: now };
      const text = [...buffered].every((letter) => letter === buffered[0]) ? buffered[0]! : buffered;
      const candidate = [...visible.slice(index + 1), ...visible.slice(0, index + 1)].find((candidate) =>
        nodes?.get(candidate.path)?.key.toLocaleLowerCase(locale).startsWith(text.toLocaleLowerCase(locale)),
      );
      if (candidate) {
        event.preventDefault();
        moveFocus(candidate.path);
      }
    }
  };
  const highlight = (text: string, quoted = false): ReactNode => {
    const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    const encode = (value: string) => (quoted ? JSON.stringify(value).slice(1, -1) : value);
    return index < 0 ? (
      quoted ? (
        JSON.stringify(text)
      ) : (
        text
      )
    ) : (
      <>
        {quoted && '"'}
        {encode(text.slice(0, index))}
        <mark data-ui="json-viewer-match" css={markStyle}>
          {encode(text.slice(index, index + query.length))}
        </mark>
        {encode(text.slice(index + query.length))}
        {quoted && '"'}
      </>
    );
  };
  const rendered = new Map<string, ReactNode>();
  for (const [index, row] of visible.toReversed().entries()) {
    const node = nodes?.get(row.path);
    const children = childrenByPath.get(row.path);
    const labelId = `${labelIdBase}-label-${index}`;
    const groupId = children ? `${labelIdBase}-group-${index}` : undefined;
    rendered.set(
      row.path,
      <div key={row.path} data-ui="json-viewer-node" role="none">
        <div
          id={`${labelIdBase}-item-${index}`}
          role="treeitem"
          data-ui="json-viewer-item"
          aria-labelledby={labelId}
          aria-owns={groupId}
          aria-level={row.level}
        aria-posinset={row.position}
        aria-setsize={row.setSize}
        aria-expanded={node && isBranch(node) ? isOpen(row.path) : undefined}
        aria-selected={node ? selected === row.path : undefined}
        tabIndex={tabStop === row.path ? 0 : -1}
        css={itemStyle}
        ref={(element) => {
          if (element) rowRefs.current.set(row.path, element);
          else rowRefs.current.delete(row.path);
        }}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          lastFocus.current = event.currentTarget;
          setFocused(row.path);
          if (node && !suppressFocusSelection.current) requestSelected(row.path);
        }}
        onBlur={(event) => {
          if (!event.relatedTarget || !treeRef.current?.contains(event.relatedTarget as Node)) {
            lastFocus.current = null;
          }
        }}
      >
        <div
          data-ui="json-viewer-row"
          className={slotProps?.row?.className}
          css={[rowStyle, slotProps?.row?.css]}
          style={{ '--json-depth': row.level - 1 } as CSSProperties}
        >
          <span
            data-ui="json-viewer-caret"
            data-state={node && isBranch(node) ? (isOpen(row.path) ? 'open' : 'closed') : undefined}
            aria-hidden="true"
            css={caretStyle}
          />
          <span data-ui="json-viewer-label" id={labelId}>
            {row.more !== undefined ? (
              <span css={moreStyle}>{labels.showMore(row.more)}</span>
            ) : (
              <>
                <span data-ui="json-viewer-key" css={keyStyle}>
                  {highlight(node!.key)}
                </span>
                <span css={punctuationStyle}>:</span>{' '}
                {node!.type === 'object' || node!.type === 'array' ? (
                  <span
                    data-ui="json-viewer-type"
                    className={slotProps?.value?.className}
                    css={[chipStyle, slotProps?.value?.css]}
                  >
                    {labels.count(node!.children.length, node!.type)}
                  </span>
                ) : (
                  <span
                    data-ui="json-viewer-value"
                    data-type={node!.type}
                    className={slotProps?.value?.className}
                    css={[valueStyle, slotProps?.value?.css]}
                  >
                    {node!.type === 'string'
                      ? highlight(String(node!.value), true)
                      : highlight(JSON.stringify(node!.value))}
                  </span>
                )}
              </>
            )}
          </span>
        </div>
        </div>
        {children && (
          <div
            id={groupId}
            role="group"
            data-ui="json-viewer-group"
            className={slotProps?.group?.className}
            css={[groupStyle, slotProps?.group?.css]}
            style={{ '--json-depth': row.level - 1 } as CSSProperties}
          >
            {children.map((child) => rendered.get(child.path))}
          </div>
        )}
      </div>,
    );
  }
  const action = (label: string, icon: ReactNode, run: () => void, disabled = false) => (
    <Button
      data-ui="json-viewer-action"
      size="sm"
      variant="ghost"
      aria-label={label}
      title={label}
      className={slotProps?.action?.className}
      css={[actionStyle, slotProps?.action?.css]}
      disabled={disabled}
      onClick={run}
      render={(props) => <button {...props} type="button" disabled={disabled} />}
    >
      {icon}
    </Button>
  );
  const separator = <span aria-hidden="true" css={separatorStyle} />;
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          data-ui="json-viewer"
          className={className}
          style={
            {
              '--json-max-height': typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
              '--json-row-height': size === 'sm' ? vars.space[6] : vars.space[8],
              ...style,
            } as CSSProperties
          }
          onKeyDown={handleKeyDown}
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
            if (!item || !treeRef.current?.contains(item)) return;
            const row = visible.find((row) => rowRefs.current.get(row.path) === item);
            if (row) {
              moveFocus(row.path);
              activate(row);
            }
          }}
        >
          {!nodes ? (
            <div
              role="group"
              data-ui="json-viewer-invalid"
              aria-label={ariaLabel ?? labels.tree}
              aria-labelledby={labelledBy}
              aria-describedby={describedBy}
              css={invalidStyle}
            >
              {labels.invalidData}
            </div>
          ) : (
            <>
              <div
                data-ui="json-viewer-toolbar"
                className={slotProps?.toolbar?.className}
                css={[toolbarStyle, slotProps?.toolbar?.css]}
              >
                {searchable && (
                  <span css={searchWrapStyle}>
                    <span css={searchIconStyle} aria-hidden="true">
                      {searchIcon}
                    </span>
                    <TextField
                      data-ui="json-viewer-search"
                      ref={searchRef}
                      aria-label={labels.search}
                      placeholder={labels.search}
                      value={query}
                      onValueChange={requestQuery}
                      size="sm"
                      className={slotProps?.search?.className}
                      sx={[searchStyle, slotProps?.search?.css]}
                      slotProps={{ control: { css: searchControlStyle } }}
                    />
                  </span>
                )}
                <span css={actionsStyle}>
                  {searchable && (
                    <>
                      <span
                        data-ui="json-viewer-match-status"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        css={matchStatusStyle}
                      >
                        {query
                          ? labels.match(
                              Math.max(0, search.matches.indexOf(selected) + 1),
                              search.matches.length,
                              search.truncated,
                            )
                          : ''}
                      </span>
                      {action(labels.previousMatch, previousIcon, () => navigateMatch(-1, true), !search.matches.length)}
                      {action(labels.nextMatch, nextIcon, () => navigateMatch(1, true), !search.matches.length)}
                      {separator}
                    </>
                  )}
                  {action(labels.expandAll, expandIcon, () => {
                    setOverlay({ ...searchOverlay, closed: new Set() });
                    changeExpansion([...nodes.values()].filter(isBranch).map((node) => node.path));
                  })}
                  {action(labels.collapseAll, collapseIcon, () => {
                    setOverlay({ ...searchOverlay, closed: new Set(search.ancestors) });
                    changeExpansion(isBranch(nodes.get(rootName)!) ? [rootName] : []);
                  })}
                  {copyable && (
                    <>
                      {separator}
                      {action(labels.copyValue, copyIcon, () => {
                        void copy('value');
                      })}
                      {action(labels.copyPath, pathIcon, () => {
                        void copy('path');
                      })}
                    </>
                  )}
                </span>
              </div>
              <div
                ref={treeRef}
                role="tree"
                data-ui="json-viewer-tree"
                aria-label={ariaLabel ?? (labelledBy ? undefined : labels.tree)}
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                className={slotProps?.tree?.className}
                css={[treeStyle, slotProps?.tree?.css]}
              >
                {rendered.get(rootName)}
              </div>
              {showPath && current && (
                <div
                  data-ui="json-viewer-path-bar"
                  className={slotProps?.pathBar?.className}
                  css={[pathStyle, slotProps?.pathBar?.css]}
                >
                  <span css={pathHeaderStyle}>
                    <code data-ui="json-viewer-path" css={pathCodeStyle}>
                      {current.path}
                    </code>
                    <span data-ui="json-viewer-current-type" css={chipStyle}>
                      {current.type}
                    </span>
                  </span>
                  <pre data-ui="json-viewer-details" dir="ltr" tabIndex={0} css={detailsStyle}>
                    {serializeDetails(current.value)}
                  </pre>
                </div>
              )}
            </>
          )}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-ui="json-viewer-status"
            className={slotProps?.status?.className}
            css={[statusStyle, slotProps?.status?.css]}
          >
            {status}
          </div>
        </div>
      )}
    </WithSx>
  );
}
JsonViewer.displayName = 'JsonViewer';

function serializeDetails(value: JsonValue) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '…';
  }
}
