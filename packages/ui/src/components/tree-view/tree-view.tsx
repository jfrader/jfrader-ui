'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export interface TreeNode {
  id: string;
  label: string;
  children?: readonly TreeNode[];
  hasChildren?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface TreeViewMessages {
  loading: (label: string) => string;
  error: (label: string) => string;
  empty: string;
}
export interface TreeViewPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}
export interface TreeViewSlotProps {
  /** Root list containing the tree nodes. */
  tree?: ComponentPropsWithRef<'ul'> & TreeViewPartProps;
  /** Row containing one node's disclosure, icon and label. */
  row?: ComponentPropsWithRef<'div'> & TreeViewPartProps;
  /** Text naming a tree node. */
  label?: ComponentPropsWithRef<'span'> & TreeViewPartProps;
  /** Icon beside a node label. */
  icon?: ComponentPropsWithRef<'span'> & TreeViewPartProps;
  /** Decorative branch disclosure. */
  disclosure?: ComponentPropsWithRef<'span'> & TreeViewPartProps;
  /** Nested list containing child nodes. */
  group?: ComponentPropsWithRef<'ul'> & TreeViewPartProps;
  /** Live region announcing tree updates. */
  status?: ComponentPropsWithRef<'div'> & TreeViewPartProps;
}
export interface TreeViewSlots {
  /** Root list containing the tree nodes. */
  tree?: ComponentType<NonNullable<TreeViewSlotProps['tree']>>;
  /** Row containing one node's disclosure, icon and label. */
  row?: ComponentType<NonNullable<TreeViewSlotProps['row']>>;
  /** Text naming a tree node. */
  label?: ComponentType<NonNullable<TreeViewSlotProps['label']>>;
  /** Icon beside a node label. */
  icon?: ComponentType<NonNullable<TreeViewSlotProps['icon']>>;
  /** Decorative branch disclosure. */
  disclosure?: ComponentType<NonNullable<TreeViewSlotProps['disclosure']>>;
  /** Nested list containing child nodes. */
  group?: ComponentType<NonNullable<TreeViewSlotProps['group']>>;
  /** Live region announcing tree updates. */
  status?: ComponentType<NonNullable<TreeViewSlotProps['status']>>;
}
export interface TreeViewProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'>, SxProps {
  /** Render these root nodes and their descendants in order. */
  nodes: readonly TreeNode[];
  /** Control the selected node id. `null` clears selection. */
  value?: string | null;
  /** Set the initial uncontrolled selection. Defaults to `null`. */
  defaultValue?: string | null;
  /** Receive the requested selected node id. */
  onValueChange?: (id: string | null) => void;
  /** Control which branch ids are expanded. */
  open?: readonly string[];
  /** Set the initially expanded uncontrolled branches. Defaults to none. */
  defaultOpen?: readonly string[];
  /** Receive the requested expanded branch ids. */
  onOpenChange?: (ids: readonly string[]) => void;
  /** Load missing children when a branch opens. Results are cached until remount. Honor the abort signal. */
  loadChildren?: (node: TreeNode, options: { signal: AbortSignal }) => Promise<readonly TreeNode[]>;
  /** Receive a failed child load and the branch whose children were requested. */
  onLoadError?: (error: unknown, node: TreeNode) => void;
  /** Name the tree when no `aria-label` or `aria-labelledby` is supplied. Defaults to `Tree`. */
  label?: string;
  /** Override the loading, load-error and empty messages. Defaults to English. */
  messages?: Partial<TreeViewMessages>;
  /** Replace the empty-root content. Defaults to `messages.empty`. */
  empty?: ReactNode;
  /** Access the inner tree list rather than the outer container. */
  treeRef?: Ref<HTMLUListElement>;
  /** Set the locale for typeahead matching. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Pass props and styles to tree parts. */
  slotProps?: TreeViewSlotProps;
  /** Replace tree parts with custom components. */
  slots?: TreeViewSlots;
}
interface Entry {
  node: TreeNode;
  parent?: string;
  level: number;
  position: number;
  size: number;
  children?: readonly TreeNode[];
  branch: boolean;
}
interface Request {
  controller: AbortController;
}
const TYPEAHEAD_MS = 500;
const DEFAULT_MESSAGES: TreeViewMessages = {
  loading: (label) => `Loading ${label}…`,
  error: (label) => `Could not load ${label}. Press Enter to retry.`,
  empty: 'No items',
};
const rootStyle = css({
  minInlineSize: 0,
  background: vars.color.surface,
  color: vars.color.text,
  borderRadius: vars.radius.md,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});
const treeStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: vars.space[1],
  overflowX: 'auto',
  '&:focus-visible': focusRingInset,
});
const itemStyle = css({
  outline: 'none',
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  minInlineSize: `calc(${vars.space[12]} * 2)`,
  minBlockSize: vars.space[8],
});
const rowStyle = css({
  display: 'flex',
  minInlineSize: 'min-content',
  alignItems: 'center',
  gap: vars.space[2],
  minBlockSize: vars.space[8],
  paddingInline: vars.space[2],
  paddingInlineStart: `calc(var(--tree-level) * ${vars.space[4]} + ${vars.space[2]})`,
  borderInlineStart: '2px solid transparent',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': { background: vars.color.surfaceHover },
  '&:has(> [aria-selected="true"])': {
    borderInlineStartColor: vars.color.accentText,
    background: vars.color.surfaceHover,
  },
  '&:has(> [aria-disabled="true"])': {
    color: vars.color.textMuted,
    cursor: 'default',
  },
  '&:has(> [role="treeitem"]:focus-visible)': focusRingInset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    color: 'CanvasText',
    borderInlineStartColor: 'Canvas',
    '&:has(> [aria-selected="true"])': {
      borderInlineStartColor: 'Highlight',
      background: 'Highlight',
      color: 'HighlightText',
      outlineColor: 'HighlightText',
      forcedColorAdjust: 'none',
    },
    '&:has(> [aria-disabled="true"])': { color: 'GrayText' },
  },
});
const labelStyle = css({ minInlineSize: 0, overflowWrap: 'anywhere' });
const iconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
});
const disclosureStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  inlineSize: vars.space[8],
  blockSize: vars.space[8],
  alignItems: 'center',
  justifyContent: 'center',
  color: 'currentColor',
  '&[data-branch="true"]::after': {
    ...disclosureCaret,
    transitionDuration: vars.motion.duration.fast,
  },
  '&[data-open="true"]::after': { transform: 'rotate(90deg)' },
  '&:dir(rtl)[data-open="true"]::after': { transform: 'rotate(-90deg)' },
  [REDUCED_MOTION]: { '&[data-branch="true"]::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: {
    '&[data-branch="true"]::after': {
      forcedColorAdjust: 'none',
      color: 'currentColor',
    },
  },
});
const groupStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlock: 0,
    insetInlineStart: `calc(var(--tree-level) * ${vars.space[4]})`,
    borderInlineStart: `1px solid ${vars.color.border}`,
    pointerEvents: 'none',
  },
});
const statusStyle = css({
  margin: 0,
  paddingInline: vars.space[2],
  '&:empty': { padding: 0 },
});

/** APG tree with one selection and roving focus.
 * Right expands or enters; Left collapses or moves to the parent, including in RTL.
 * Up/Down stop at the ends; Home/End jump; Enter/Space select. Typeahead resets after 500ms.
 * Loaded children are cached per instance. Remount with a new key to replace the cache. */
export function TreeView({
  nodes,
  value,
  defaultValue = null,
  onValueChange,
  open,
  defaultOpen = [],
  onOpenChange,
  loadChildren,
  onLoadError,
  label = 'Tree',
  messages: messageProps,
  empty,
  treeRef,
  locale,
  slotProps,
  slots,
  ref,
  className,
  sx,
  onKeyDown,
  onClick,
  onBlur,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: TreeViewProps) {
  const Tree = slots?.tree ?? 'ul';
  const Row = slots?.row ?? 'div';
  const Label = slots?.label ?? 'span';
  const Icon = slots?.icon ?? 'span';
  const Disclosure = slots?.disclosure ?? 'span';
  const Group = slots?.group ?? 'ul';
  const Status = slots?.status ?? 'div';
  const baseId = useId();
  const treeElement = useRef<HTMLUListElement | null>(null);
  const mergedTreeRef = useMergeRefs([treeElement, treeRef, slotProps?.tree?.ref]);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const lastFocus = useRef<HTMLDivElement | null>(null);
  const previousEntries = useRef(new Map<string, Entry>());
  const requests = useRef(new Map<string, Request>());
  const [cache, setCache] = useState(new Map<string, readonly TreeNode[]>());
  const [failures, setFailures] = useState(new Set<string>());
  const [busy, setBusy] = useState(new Set<string>());
  const [selected, requestSelected] = useControlledState(value, defaultValue, onValueChange);
  const [expanded = [], requestExpanded] = useControlledState(open, defaultOpen, onOpenChange);
  const [focused, setFocused] = useState<string | null>(value ?? defaultValue);
  const typeahead = useRef({ text: '', time: 0 });
  const collator = useMemo(
    () => new Intl.Collator(locale, { usage: 'search', sensitivity: 'base' }),
    [locale],
  );
  const messages = { ...DEFAULT_MESSAGES, ...messageProps };
  const entries = new Map<string, Entry>();
  const visible: Entry[] = [];
  const openSet = new Set(expanded);
  const visit = (siblings: readonly TreeNode[], parent?: string, level = 1, shown = true) => {
    siblings.forEach((node, index) => {
      const children = node.children ?? cache.get(node.id);
      const entry: Entry = {
        node,
        children,
        parent,
        level,
        position: index + 1,
        size: siblings.length,
        branch: children !== undefined ? children.length > 0 : node.hasChildren === true,
      };
      entries.set(node.id, entry);
      if (shown) visible.push(entry);
      if (children) visit(children, node.id, level + 1, shown && openSet.has(node.id));
    });
  };
  visit(nodes);
  const enabled = visible.filter((entry) => !entry.node.disabled);
  const nearest = (id: string | null | undefined): string | null => {
    const seen = new Set<string>();
    while (id != null && !seen.has(id)) {
      seen.add(id);
      if (enabled.some((entry) => entry.node.id === id)) return id;
      id = entries.get(id)?.parent ?? previousEntries.current.get(id)?.parent;
    }
    return enabled[0]?.node.id ?? null;
  };
  const tabStop = nearest(focused ?? selected);
  const move = (id: string | null) => {
    setFocused(id);
    const target = id === null ? treeElement.current : elements.current.get(id);
    target?.focus();
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  useLayoutEffect(() => {
    if (focused !== tabStop) {
      const prior = lastFocus.current;
      const document = treeElement.current?.ownerDocument;
      const owned =
        prior &&
        document &&
        (document.activeElement === prior ||
          (!prior.isConnected && document.activeElement === document.body));
      setFocused(tabStop);
      if (owned) move(tabStop);
    }
    previousEntries.current = entries;
  });
  useEffect(
    () => () => {
      for (const request of requests.current.values()) request.controller.abort();
      requests.current.clear();
    },
    [],
  );
  useEffect(() => {
    const eligible = new Map(
      visible
        .filter(
          (entry) =>
            openSet.has(entry.node.id) &&
            entry.branch &&
            !entry.node.disabled &&
            entry.children === undefined,
        )
        .map((entry) => [entry.node.id, entry.node]),
    );
    for (const [id, request] of requests.current) {
      if (!eligible.has(id) || !loadChildren) {
        request.controller.abort();
        requests.current.delete(id);
        setBusy((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
    if (!loadChildren) return;
    for (const [id, node] of eligible) {
      if (requests.current.has(id) || failures.has(id)) continue;
      const request = { controller: new AbortController() };
      requests.current.set(id, request);
      setBusy((current) => new Set(current).add(id));
      Promise.resolve()
        .then(() => {
          if (request.controller.signal.aborted) return undefined;
          return loadChildren(node, { signal: request.controller.signal });
        })
        .then(
          (children) => {
            if (
              request.controller.signal.aborted ||
              requests.current.get(id) !== request ||
              children === undefined
            )
              return;
            requests.current.delete(id);
            setCache((current) => new Map(current).set(id, children));
            setBusy((current) => {
              const next = new Set(current);
              next.delete(id);
              return next;
            });
          },
          (error: unknown) => {
            if (request.controller.signal.aborted || requests.current.get(id) !== request) return;
            requests.current.delete(id);
            setFailures((current) => new Set(current).add(id));
            setBusy((current) => {
              const next = new Set(current);
              next.delete(id);
              return next;
            });
            onLoadError?.(error, node);
          },
        );
    }
  });
  const retry = (id: string) =>
    setFailures((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  const toggle = (entry: Entry) => {
    const id = entry.node.id;
    if (!entry.branch || entry.node.disabled) return;
    if (openSet.has(id) && failures.has(id)) {
      retry(id);
      return;
    }
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size !== openSet.size || [...next].some((item) => !openSet.has(item)))
      requestExpanded([...next]);
  };
  const activate = (entry: Entry) => {
    if (entry.node.disabled) return;
    requestSelected(entry.node.id);
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>, entry: Entry) => {
    if (
      entry.node.disabled ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const id = entry.node.id;
    const index = enabled.findIndex((item) => item.node.id === id);
    const handlers: Record<string, () => void> = {
      ArrowDown: () => move(enabled[Math.min(index + 1, enabled.length - 1)]?.node.id ?? null),
      ArrowUp: () => move(enabled[Math.max(index - 1, 0)]?.node.id ?? null),
      Home: () => move(enabled[0]?.node.id ?? null),
      End: () => move(enabled.at(-1)?.node.id ?? null),
      ArrowRight: () => {
        if (!entry.branch || busy.has(id)) return;
        if (!openSet.has(id)) toggle(entry);
        else if (failures.has(id)) retry(id);
        else {
          const child = entry.children?.find((node) => !node.disabled);
          if (child) move(child.id);
        }
      },
      ArrowLeft: () => {
        if (entry.branch && openSet.has(id))
          requestExpanded([...openSet].filter((item) => item !== id));
        else if (entry.parent) move(nearest(entry.parent));
      },
      Enter: () => (openSet.has(id) && failures.has(id) ? retry(id) : activate(entry)),
      ' ': () => activate(entry),
    };
    if (handlers[event.key]) {
      event.preventDefault();
      handlers[event.key]!();
      return;
    }
    if (event.key.length !== 1 || event.key === '*') return;
    const time = Date.now();
    const text =
      time - typeahead.current.time < TYPEAHEAD_MS ? typeahead.current.text + event.key : event.key;
    typeahead.current = { text, time };
    const needle = [...text].every((character) => collator.compare(character, text[0]!) === 0)
      ? text[0]!
      : text;
    for (let offset = needle.length === 1 ? 1 : 0; offset < enabled.length + 1; offset++) {
      const candidate = enabled[(index + offset) % enabled.length]!;
      if (collator.compare(candidate.node.label.slice(0, needle.length), needle) === 0) {
        event.preventDefault();
        move(candidate.node.id);
        break;
      }
    }
  };
  const nodeId = (id: string) =>
    `${baseId}-${Array.from(id, (character) => character.codePointAt(0)!.toString(16)).join('-')}`;
  const renderNodes = (siblings: readonly TreeNode[]) =>
    siblings.map((node) => {
      const entry = entries.get(node.id)!;
      const errorId = `${nodeId(node.id)}-error`;
      const labelId = `${nodeId(node.id)}-label`;
      const opened = entry.branch && openSet.has(node.id);
      return (
        <li key={node.id} role="none">
          <Row
            {...withoutSx(slotProps?.row)}
            data-ui="tree-view-row"
            className={slotProps?.row?.className}
            css={[rowStyle, slotProps?.row?.sx]}
            style={{ ...slotProps?.row?.style, '--tree-level': entry.level - 1 } as CSSProperties}
          >
            <Disclosure
              {...withoutSx(slotProps?.disclosure)}
              data-ui="tree-view-disclosure"
              aria-hidden="true"
              data-branch={entry.branch}
              data-open={opened}
              className={slotProps?.disclosure?.className}
              css={[disclosureStyle, slotProps?.disclosure?.sx]}
            />
            {isRenderable(node.icon) && (
              <Icon
                {...withoutSx(slotProps?.icon)}
                data-ui="tree-view-icon"
                aria-hidden="true"
                className={slotProps?.icon?.className}
                css={[iconStyle, slotProps?.icon?.sx]}
              >
                {node.icon}
              </Icon>
            )}
            <div
              ref={(element) => {
                if (element) elements.current.set(node.id, element);
                else elements.current.delete(node.id);
              }}
              role="treeitem"
              css={itemStyle}
              tabIndex={!node.disabled && tabStop === node.id ? 0 : -1}
              aria-labelledby={labelId}
              aria-level={entry.level}
              aria-posinset={entry.position}
              aria-setsize={entry.size}
              aria-expanded={entry.branch ? opened : undefined}
              aria-selected={node.disabled ? undefined : selected === node.id}
              aria-disabled={node.disabled || undefined}
              aria-busy={busy.has(node.id) || undefined}
              aria-describedby={failures.has(node.id) && opened ? errorId : undefined}
              aria-owns={
                opened && entry.children && entry.children.length > 0
                  ? `${nodeId(node.id)}-group`
                  : undefined
              }
              onFocus={(event) => {
                if (event.target === event.currentTarget) {
                  lastFocus.current = event.currentTarget;
                  setFocused(node.id);
                }
              }}
            >
              <Label
                {...withoutSx(slotProps?.label)}
                id={labelId}
                data-ui="tree-view-label"
                className={slotProps?.label?.className}
                css={[labelStyle, slotProps?.label?.sx]}
              >
                {node.label}
              </Label>
            </div>
          </Row>
          {opened && entry.children && entry.children.length > 0 && (
            <Group
              {...withoutSx(slotProps?.group)}
              id={`${nodeId(node.id)}-group`}
              role="group"
              data-ui="tree-view-group"
              className={slotProps?.group?.className}
              css={[groupStyle, slotProps?.group?.sx]}
              style={{ ...slotProps?.group?.style, '--tree-level': entry.level } as CSSProperties}
            >
              {renderNodes(entry.children)}
            </Group>
          )}
        </li>
      );
    });
  const emptyContent = empty === undefined ? messages.empty : empty;
  return (
    <WithSx className={className} styles={[rootStyle]} sx={sx}>
      {(merged) => (
        <div
          {...rest}
          ref={ref}
          className={merged}
          data-ui="tree-view"
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            const target = event.target as HTMLElement;
            const row = target.closest('[data-ui="tree-view-row"]');
            const entry = enabled.find(
              (item) => elements.current.get(item.node.id)?.parentElement === row,
            );
            if (!entry) return;
            move(entry.node.id);
            if (target.closest('[data-ui="tree-view-disclosure"]')) toggle(entry);
            else activate(entry);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            const entry = enabled.find(
              (item) => elements.current.get(item.node.id) === event.target,
            );
            if (entry) handleKey(event, entry);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(nearest(selected));
          }}
        >
          <Tree
            {...withoutSx(slotProps?.tree)}
            role="tree"
            data-ui="tree-view-tree"
            ref={mergedTreeRef}
            className={slotProps?.tree?.className}
            css={[treeStyle, slotProps?.tree?.sx]}
            tabIndex={enabled.length ? undefined : 0}
            aria-label={ariaLabel ?? (labelledBy ? undefined : label)}
            aria-labelledby={labelledBy}
            aria-describedby={
              [describedBy, !enabled.length ? `${baseId}-empty` : undefined]
                .filter(Boolean)
                .join(' ') || undefined
            }
          >
            {renderNodes(nodes)}
          </Tree>
          {!enabled.length && (
            <p id={`${baseId}-empty`} css={statusStyle}>
              {nodes.length ? messages.empty : isRenderable(emptyContent) ? emptyContent : null}
            </p>
          )}
          <Status
            {...withoutSx(slotProps?.status)}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-ui="tree-view-status"
            className={slotProps?.status?.className}
            css={[statusStyle, slotProps?.status?.sx]}
          >
            {visible
              .filter((entry) => openSet.has(entry.node.id))
              .map(({ node }) =>
                busy.has(node.id) ? (
                  <p key={node.id}>{messages.loading(node.label)}</p>
                ) : failures.has(node.id) ? (
                  <p key={node.id} id={`${nodeId(node.id)}-error`}>
                    {messages.error(node.label)}
                  </p>
                ) : null,
              )}
          </Status>
        </div>
      )}
    </WithSx>
  );
}
TreeView.displayName = 'TreeView';
