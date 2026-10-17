'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useMergeRefs, type Placement } from '@floating-ui/react';
import { MotionConfig, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { listboxSurfaceStyle, listboxScrollStyle } from '../../styling/listbox-style';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { moveRovingFocus, queryOwnedItems } from '../../utils/roving-focus';
import { Button, type ButtonProps, type ButtonSize, type ButtonTone, type ButtonVariant } from '../button';
import {
  Menu,
  MenuContentPart,
  MenuItemPart,
  MenuSeparatorPart,
  MenuTriggerPart,
  consumerHandlersFirst,
  menuItemStyles,
  menuItemToneStyles,
  menuSeparatorStyles,
  type MenuContentProps,
  type MenuItemProps,
  type MenuSeparatorProps,
  type MenuItemTone,
} from '../menu/menu';
import { tooltipContentStyle, useTooltipInteractions } from '../tooltip/tooltip';

const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupPresentation = 'joined' | 'floating' | 'expanding';

export type ButtonGroupItemRecord =
  | Readonly<Omit<ButtonGroupItemProps, 'children' | 'label'> & {
      label: ReactNode;
      href?: never;
    }>
  | Readonly<Omit<ButtonGroupLinkProps, 'children' | 'label'> & {
      label: ReactNode;
    }>;

export interface ButtonGroupSlots {
  /** Container element wrapping the grouped buttons. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Action button inside the group. Default: `Button`. */
  item?: ComponentType<ButtonGroupItemProps>;
  /** Navigation link button inside the group. */
  link?: ComponentType<ButtonGroupLinkProps>;
}

export interface ButtonGroupSlotProps {
  /** Container element wrapping the grouped buttons. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children'> &
    SxProps & {
      css?: Interpolation<Theme>;
      [attribute: `data-${string}`]: unknown;
    };
  /** Action button inside the group. Default: `Button`. */
  item?: Partial<Omit<ButtonGroupItemProps, 'children' | 'label' | 'onClick' | 'disabled'>> & { css?: Interpolation<Theme> };
  /** Navigation link button inside the group. */
  link?: Partial<Omit<ButtonGroupLinkProps, 'children' | 'label' | 'href' | 'onClick' | 'disabled'>> & { css?: Interpolation<Theme> };
}

export interface ButtonGroupBaseProps extends Omit<ComponentPropsWithRef<'div'>, 'role' | 'children' | 'defaultValue'>, SxProps {
  /** Arrange joined segments, a floating pill tray, or icon actions with one revealed label. */
  presentation?: ButtonGroupPresentation;
  /** Expanded action id in the expanding presentation; not a selected value. */
  value?: string;
  /** Initially expanded action id. */
  defaultValue?: string;
  /** Request a different expanded action id on pointer movement or focus. */
  onValueChange?: (value: string) => void;
  /** Action id shown at rest; defaults to the first enabled icon-bearing action. */
  restValue?: string;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  orientation?: ButtonGroupOrientation;
  collapseLabels?: boolean;
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
}

export interface ButtonGroupCompoundProps extends ButtonGroupBaseProps {
  children?: ReactNode;
  label?: never;
  items?: never;
  component?: never;
  slots?: never;
  slotProps?: never;
}

export interface ButtonGroupEasyProps extends ButtonGroupBaseProps {
  /** Accessible name for the group landmark/widget. */
  label?: string;
  /** Action items or links rendered in order. */
  items: readonly ButtonGroupItemRecord[];
  children?: never;
  component?: ButtonGroupSlots['root'];
  slots?: ButtonGroupSlots;
  slotProps?: ButtonGroupSlotProps;
}

export type ButtonGroupProps = ButtonGroupCompoundProps | ButtonGroupEasyProps;
export interface ButtonGroupItemProps extends Omit<ButtonProps, 'render'> {
  iconOnly?: boolean;
  label?: string;
  reserveLabels?: readonly string[];
}
export interface ButtonGroupLinkProps extends Omit<ComponentPropsWithRef<'a'>, 'color'>, SxProps {
  href: string;
  disabled?: boolean;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  iconOnly?: boolean;
  label?: string;
  startIcon?: ReactNode;
  reserveLabels?: readonly string[];
}
export interface ButtonGroupLabelProps
  extends Omit<ComponentPropsWithRef<'span'>, 'role' | 'tabIndex'>, SxProps {}
export type ButtonGroupTriggerProps = Omit<ButtonGroupItemProps, 'loading' | 'reserveLabels' | 'iconOnly'> &
  ({ 'aria-label': string } | { 'aria-labelledby': string });
export interface ButtonGroupContentProps extends Omit<MenuContentProps, 'role'> {}
export interface ButtonGroupMenuItemProps extends MenuItemProps {
  tone?: MenuItemTone;
}
export interface ButtonGroupSeparatorProps extends MenuSeparatorProps {
  /** Use vertical between horizontal tray actions; horizontal remains the menu default. */
  orientation?: ButtonGroupOrientation;
}

interface GroupContext {
  presentation: ButtonGroupPresentation;
  expandedValue: string | undefined;
  variant: ButtonVariant;
  tone: ButtonTone;
  size: ButtonSize;
  disabled: boolean;
  compact: boolean;
  direction: 'ltr' | 'rtl' | undefined;
  triggerLabelledBy: string | undefined;
  setTriggerLabelledBy: (ids: string | undefined) => void;
}
const Context = createContext<GroupContext | null>(null);
function useGroup(part: string) {
  const context = useContext(Context);
  if (!context) throw new Error(`ButtonGroup.${part} must be rendered inside <ButtonGroup>.`);
  return context;
}
const OWNER = '[data-ui~="button-group"]';
const OWNED_ACTIONS = {
  ownerSelector: OWNER,
  itemSelector: '[data-button-group-action]:not(:disabled):not([aria-disabled="true"])',
};
const SPRING = {
  type: 'spring',
  stiffness: 360,
  damping: 36,
  mass: 1,
} as const;
const COMPACT_HYSTERESIS = 8;
const rootStyle = css({
  '--button-group-start-start-radius': vars.radius.md,
  '--button-group-end-start-radius': vars.radius.md,
  '--button-group-start-end-radius': vars.radius.md,
  '--button-group-end-end-radius': vars.radius.md,
  '--button-group-inline-start-width': '1px',
  '--button-group-block-start-width': '1px',
  label: 'button-group',
  display: 'inline-flex',
  position: 'relative',
  isolation: 'isolate',
  alignItems: 'stretch',
  inlineSize: 'max-content',
  maxInlineSize: '100%',
  verticalAlign: 'middle',
  borderRadius: vars.radius.md,
  whiteSpace: 'nowrap',
  textAlign: 'center',
  overflowX: 'auto',
  overflowY: 'hidden',
  '&[data-compact]': { inlineSize: '100%' },
  '&[data-orientation="vertical"]': { flexDirection: 'column', whiteSpace: 'normal', textAlign: 'start' },
});
const segmentStyle = css({
  label: 'button-group-segment',
  position: 'relative',
  flexShrink: 0,
  blockSize: 'auto',
  paddingBlock: vars.space[1],
  borderColor: vars.color.borderControl,
  borderStartStartRadius: 'var(--button-group-start-start-radius)',
  borderEndStartRadius: 'var(--button-group-end-start-radius)',
  borderStartEndRadius: 'var(--button-group-start-end-radius)',
  borderEndEndRadius: 'var(--button-group-end-end-radius)',
  borderInlineStartWidth: 'var(--button-group-inline-start-width)',
  borderBlockStartWidth: 'var(--button-group-block-start-width)',
  whiteSpace: 'inherit',
  textAlign: 'inherit',
  '&:focus-visible': { zIndex: 1, outlineOffset: '-2px' },
  '&:where([data-orientation="horizontal"] > [data-button-group-segment] ~ [data-button-group-segment])': {
    '--button-group-start-start-radius': '0px',
    '--button-group-end-start-radius': '0px',
    '--button-group-inline-start-width': '0px',
  },
  '&:where([data-orientation="horizontal"] > :has(~ [data-button-group-segment]))': {
    '--button-group-start-end-radius': '0px',
    '--button-group-end-end-radius': '0px',
  },
  '&:where([data-orientation="vertical"] > [data-button-group-segment] ~ [data-button-group-segment])': {
    '--button-group-start-start-radius': '0px',
    '--button-group-start-end-radius': '0px',
    '--button-group-block-start-width': '0px',
  },
  '&:where([data-orientation="vertical"] > :has(~ [data-button-group-segment]))': {
    '--button-group-end-start-radius': '0px',
    '--button-group-end-end-radius': '0px',
  },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
const sizeStyles: Record<ButtonSize, SerializedStyles> = {
  sm: css({ minBlockSize: vars.space[8], minInlineSize: vars.space[8] }),
  md: css({ minBlockSize: vars.space[10], minInlineSize: vars.space[10] }),
  lg: css({ minBlockSize: vars.space[12], minInlineSize: vars.space[12] }),
};
const iconOnlyStyle = css({ paddingInline: vars.space[2] });
const trayStyle = css({
  boxSizing: 'border-box',
  padding: vars.space[1],
  gap: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceRaised,
  boxShadow: vars.shadow.floating,
  '--button-group-start-start-radius': vars.radius.full,
  '--button-group-end-start-radius': vars.radius.full,
  '--button-group-start-end-radius': vars.radius.full,
  '--button-group-end-end-radius': vars.radius.full,
  '& > [data-button-group-segment]': {
    '--button-group-start-start-radius': vars.radius.full,
    '--button-group-end-start-radius': vars.radius.full,
    '--button-group-start-end-radius': vars.radius.full,
    '--button-group-end-end-radius': vars.radius.full,
    '--button-group-inline-start-width': '1px',
    '--button-group-block-start-width': '1px',
  },
  '& > [data-button-group-highlight]': { borderRadius: vars.radius.full },
  [FORCED_COLORS]: { borderColor: 'ButtonText', boxShadow: 'none' },
});
const expandingActionStyle = css({
  columnGap: 0,
  paddingInline: vars.space[2],
});
const expandingLabelsStyle = css({
  display: 'inline-block',
  overflow: 'clip',
  whiteSpace: 'nowrap',
  '& > span': {
    display: 'inline-grid',
    inlineSize: 'max-content',
    paddingInlineStart: vars.space[2],
  },
});
const verticalSeparatorStyle = css({
  alignSelf: 'stretch',
  inlineSize: '1px',
  blockSize: 'auto',
  marginBlock: vars.space[2],
  marginInline: vars.space[1],
});
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const labelsStyle = css({
  display: 'inline-grid',
  '& > *': { gridArea: '1 / 1' },
  '&[data-collapsed]': {
    inlineSize: 0,
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
  },
  '& > [data-reservation]': { visibility: 'hidden' },
  '& > [data-live]': {
    animation: `${fade} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  },
  [REDUCED_MOTION]: { '& > [data-live]': { animation: 'none' } },
});
const labelStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  paddingInline: vars.space[4],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  fontVariantNumeric: 'tabular-nums',
});
const highlightStyle = css({
  position: 'absolute',
  // Motion x/y use physical DOMRect deltas from the group's top-left, including in RTL.
  top: 0,
  left: 0,
  zIndex: -1,
  pointerEvents: 'none',
  backgroundColor: vars.color.surfaceHover,
  '[data-ui~="button-group"]:has(> [data-button-group-action]:active) > &': {
    backgroundColor: vars.color.surfaceRaised,
  },
  borderRadius: vars.radius.md,
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.fast,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { display: 'none' },
});
const caretStyle = css({
  display: 'inline-flex',
  '& svg': { inlineSize: '1em', blockSize: '1em' },
});
const caret = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m4 6 4 4 4-4" />
  </svg>
);

function Labels({
  children,
  reserveLabels,
  collapsed,
}: {
  children: ReactNode;
  reserveLabels?: readonly string[];
  collapsed: boolean;
}) {
  if (!isRenderable(children) || children === '') return children;
  return (
    <span
      css={labelsStyle}
      data-button-group-labels
      data-collapsed={collapsed || undefined}
      aria-hidden={collapsed || undefined}
    >
      {[...new Set(reserveLabels)].map((text) => (
        <span key={`reserve-${text}`} data-reservation aria-hidden>
          {text}
        </span>
      ))}
      <span
        key={typeof children === 'string' || typeof children === 'number' ? `live-${children}` : undefined}
        data-live
      >
        {children}
      </span>
    </span>
  );
}

function ExpandingLabels({ expanded, children, reserveLabels }: {
  expanded: boolean;
  children: ReactNode;
  reserveLabels?: readonly string[];
}) {
  const contentRef = useRef<HTMLSpanElement>(null);
  const width = useMotionValue(0);
  const [measured, setMeasured] = useState(false);
  const reduced = useReducedMotion();
  const initialized = useRef(false);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const update = () => {
      const next = expanded ? content.offsetWidth : 0;
      width.stop();
      if (initialized.current && !reduced) animate(width, next, SPRING);
      else width.set(next);
      initialized.current = true;
      setMeasured(true);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => {
      observer.disconnect();
      width.stop();
    };
  }, [expanded, reduced, width]);
  return (
    <motion.span css={expandingLabelsStyle} aria-hidden style={{ width: measured ? width : undefined }}>
      <span ref={contentRef}>
        <Labels collapsed={false} reserveLabels={reserveLabels}>
          {children}
        </Labels>
      </span>
    </motion.span>
  );
}

function Highlight({ root, target }: { root: HTMLDivElement | null; target: HTMLElement | null }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0),
    y = useMotionValue(0),
    width = useMotionValue(0),
    height = useMotionValue(0);
  const appeared = useRef(false);
  useLayoutEffect(() => {
    if (!root || !target) {
      appeared.current = false;
      return;
    }
    let previousGeometry: number[] = [];
    const update = (travel = false) => {
      const group = root.getBoundingClientRect(),
        item = target.getBoundingClientRect();
      const scaleX = group.width / root.offsetWidth || 1,
        scaleY = group.height / root.offsetHeight || 1;
      const values = [x, y, width, height];
      const next = [
        (item.left - group.left) / scaleX + root.scrollLeft - root.clientLeft,
        (item.top - group.top) / scaleY + root.scrollTop - root.clientTop,
        item.width / scaleX,
        item.height / scaleY,
      ];
      if (!travel && next.every((value, index) => Math.abs(value - (previousGeometry[index] ?? NaN)) < 0.01))
        return;
      previousGeometry = next;
      values.forEach((value, index) => {
        value.stop();
        if (((travel && appeared.current) || value.isAnimating()) && !reduced)
          animate(value, next[index]!, SPRING);
        else value.set(next[index]!);
      });
      appeared.current = true;
    };
    update(true);
    const observer = new ResizeObserver(() => update());
    observer.observe(root);
    observer.observe(target);
    const onScroll = () => update();
    root.addEventListener('scroll', onScroll);
    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', onScroll);
      [x, y, width, height].forEach((value) => value.stop());
    };
  }, [root, target, reduced, x, y, width, height]);
  return (
    <motion.span
      aria-hidden
      css={highlightStyle}
      data-button-group-highlight
      style={{ x, y, width, height, opacity: target ? 1 : 0 }}
    />
  );
}

function ButtonGroupRoot({
  ref,
  presentation = 'joined',
  value,
  defaultValue,
  onValueChange,
  restValue,
  variant = presentation === 'joined' ? 'outline' : 'ghost',
  tone = 'neutral',
  size = 'md',
  orientation = 'horizontal',
  collapseLabels = true,
  disabled = false,
  open,
  defaultOpen,
  onOpenChange,
  placement,
  className,
  sx,
  style,
  onKeyDown,
  onPointerOver,
  onPointerLeave,
  onPointerCancel,
  onPointerMove,
  onFocus,
  onBlur,
  label,
  items,
  children,
  component,
  slots,
  slotProps,
  ...rest
}: ButtonGroupProps) {
  const Root = component ?? slots?.root ?? 'div';
  const Item = slots?.item ?? ButtonGroupItem;
  const Link = slots?.link ?? ButtonGroupLink;

  const {
    className: rootSlotClassName,
    style: rootSlotStyle,
    css: rootSlotCss,
    sx: rootSlotSx,
    ref: rootSlotRef,
    'data-ui': rootSlotDataUi,
    onKeyDown: rootSlotOnKeyDown,
    onPointerOver: rootSlotOnPointerOver,
    onPointerLeave: rootSlotOnPointerLeave,
    onPointerCancel: rootSlotOnPointerCancel,
    onPointerMove: rootSlotOnPointerMove,
    onFocus: rootSlotOnFocus,
    onBlur: rootSlotOnBlur,
    ...rootSlotRest
  } = slotProps?.root ?? {};

  const mergedClassName = [rootSlotClassName, className].filter(Boolean).join(' ') || undefined;
  const mergedStyle = { ...style, ...rootSlotStyle };

  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([rootRef, ref, rootSlotRef]);
  const [compact, setCompact] = useState(false);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>();
  const [triggerLabelledBy, setTriggerLabelledBy] = useState<string>();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [expanded, requestExpanded] = useControlledState(value, defaultValue, onValueChange);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const restingValue = actionIds.includes(restValue ?? '') ? restValue : actionIds[0];
  const expandedValue = actionIds.includes(expanded ?? '') ? expanded : restingValue;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || presentation !== 'expanding') return;
    const update = () => {
      const ids = queryOwnedItems(root, {
        ...OWNED_ACTIONS,
        itemSelector: `${OWNED_ACTIONS.itemSelector}[data-expandable][id]`,
      }).map((item) => item.id);
      setActionIds((previous) =>
        previous.length === ids.length && previous.every((id, index) => id === ids[index]) ? previous : ids,
      );
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['id', 'disabled', 'aria-disabled', 'data-expandable'],
    });
    return () => observer.disconnect();
  }, [presentation]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setDirection(getComputedStyle(root).direction === 'rtl' ? 'rtl' : 'ltr');
    if (presentation !== 'joined' || !collapseLabels || orientation === 'vertical') {
      setCompact(false);
      return;
    }
    const measure = () => {
      const segments = queryOwnedItems(root, {
        ownerSelector: OWNER,
        itemSelector: '[data-button-group-segment]',
      });
      const fullWidth = segments.reduce((sum, node) => {
        const labelEl = node.querySelector<HTMLElement>('[data-button-group-labels][data-collapsed]');
        return (
          sum +
          node.getBoundingClientRect().width / (root.getBoundingClientRect().width / root.offsetWidth || 1) +
          (labelEl ? labelEl.scrollWidth + parseFloat(getComputedStyle(node).columnGap || '0') : 0)
        );
      }, 0);
      setCompact((current) =>
        current ? fullWidth > root.clientWidth - COMPACT_HYSTERESIS : fullWidth > root.clientWidth + 1,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    queryOwnedItems(root, {
      ownerSelector: OWNER,
      itemSelector: '[data-button-group-segment], [data-button-group-labels]',
    }).forEach((node) => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [presentation, collapseLabels, orientation, children, items, rest.dir]);
  useEffect(() => {
    if (
      disabled ||
      (target && (!target.matches(OWNED_ACTIONS.itemSelector) || target.closest(OWNER) !== rootRef.current))
    )
      setTarget(null);
  }, [disabled, children, items, target]);
  const context = useMemo(
    () => ({
      presentation,
      expandedValue,
      variant,
      tone: variant === 'solid' ? 'neutral' : tone,
      size,
      disabled,
      compact,
      direction,
      triggerLabelledBy,
      setTriggerLabelledBy,
    }),
    [presentation, expandedValue, variant, tone, size, disabled, compact, direction, triggerLabelledBy],
  );
  const owned = (node: EventTarget | null) => {
    const item = node instanceof Element ? node.closest<HTMLElement>(OWNED_ACTIONS.itemSelector) : null;
    return item?.closest(OWNER) === rootRef.current ? item : null;
  };
  const reveal = (item: HTMLElement | null) => {
    const next = item && actionIds.includes(item.id) ? item.id : restingValue;
    if (presentation === 'expanding' && next !== undefined && next !== expandedValue)
      requestExpanded(next);
  };
  return (
    <Menu
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => {
        if (!next || !disabled) onOpenChange?.(next);
      }}
      placement={placement ?? (orientation === 'vertical' ? 'bottom-start' : 'bottom-end')}
    >
      <Context.Provider value={context}>
        <MotionConfig reducedMotion="user">
          <WithSx className={mergedClassName} styles={[rootStyle, presentation !== 'joined' && trayStyle, rootSlotCss, rootSlotSx]} sx={sx}>
            {(resolvedClassName) => (
              <Root
                {...rest}
                {...rootSlotRest}
                ref={mergedRef}
                role="group"
                aria-label={rootSlotRest['aria-label'] ?? rest['aria-label'] ?? label}
                data-ui={tokens('button-group', rootSlotDataUi) ?? 'button-group'}
                data-orientation={orientation}
                data-presentation={presentation}
                data-compact={compact || undefined}
                style={mergedStyle}
                className={resolvedClassName}
                onKeyDown={(event) => {
                  (rootSlotOnKeyDown ?? onKeyDown)?.(event);
                  if (!event.defaultPrevented && rootRef.current)
                    moveRovingFocus(event, rootRef.current, orientation, OWNED_ACTIONS);
                }}
                onPointerOver={(event) => {
                  (rootSlotOnPointerOver ?? onPointerOver)?.(event);
                  if (!event.defaultPrevented && !disabled) setTarget(owned(event.target));
                }}
                onPointerMove={(event) => {
                  (rootSlotOnPointerMove ?? onPointerMove)?.(event);
                  if (event.defaultPrevented || disabled || event.pointerType === 'touch') return;
                  const previous = pointer.current;
                  pointer.current = { x: event.clientX, y: event.clientY };
                  if (!previous || previous.x !== event.clientX || previous.y !== event.clientY)
                    reveal(owned(event.target));
                }}
                onPointerLeave={(event) => {
                  (rootSlotOnPointerLeave ?? onPointerLeave)?.(event);
                  if (!event.defaultPrevented) {
                    pointer.current = null;
                    setTarget(owned(rootRef.current?.ownerDocument.activeElement ?? null));
                    reveal(owned(rootRef.current?.ownerDocument.activeElement ?? null));
                  }
                }}
                onPointerCancel={(event) => {
                  (rootSlotOnPointerCancel ?? onPointerCancel)?.(event);
                  if (!event.defaultPrevented) {
                    pointer.current = null;
                    setTarget(null);
                    reveal(owned(rootRef.current?.ownerDocument.activeElement ?? null));
                  }
                }}
                onFocus={(event) => {
                  (rootSlotOnFocus ?? onFocus)?.(event);
                  const item = owned(event.target);
                  if (!event.defaultPrevented && item) {
                    setTarget(item);
                    reveal(item);
                    item.scrollIntoView({
                      block: 'nearest',
                      inline: 'nearest',
                    });
                  }
                }}
                onBlur={(event) => {
                  (rootSlotOnBlur ?? onBlur)?.(event);
                  if (!event.defaultPrevented) {
                    const next = owned(event.relatedTarget);
                    setTarget(next);
                    if (!next) reveal(null);
                  }
                }}
              >
                <Highlight root={rootRef.current} target={target} />
                {items !== undefined ? (
                  items.map((item, index) => {
                    const itemKey = item.key ?? (typeof item.label === 'string' ? item.label : index);
                    const isItemDisabled = item.disabled;
                    if (item.href !== undefined) {
                      const {
                        className: linkSlotClassName,
                        css: linkSlotCss,
                        sx: linkSlotSx,
                        style: linkSlotStyle,
                        ...linkSlotRest
                      } = slotProps?.link ?? {};
                      const {
                        label: itemLabel,
                        href,
                        disabled: _d,
                        key: _k,
                        className: itemClassName,
                        style: itemStyleProp,
                        sx: itemSxProp,
                        ...itemRest
                      } = item;
                      const mergedLinkClassName = [linkSlotClassName, itemClassName].filter(Boolean).join(' ') || undefined;
                      const mergedLinkStyle = { ...linkSlotStyle, ...itemStyleProp };
                      return (
                        <Link
                          key={itemKey}
                          {...linkSlotRest}
                          {...itemRest}
                          href={href}
                          disabled={isItemDisabled}
                          label={typeof itemLabel === 'string' ? itemLabel : undefined}
                          className={mergedLinkClassName}
                          style={mergedLinkStyle}
                          css={[linkSlotCss, linkSlotSx]}
                          sx={itemSxProp}
                        >
                          {itemLabel}
                        </Link>
                      );
                    }
                    const {
                      className: itemSlotClassName,
                      css: itemSlotCss,
                      sx: itemSlotSx,
                      style: itemSlotStyle,
                      ...itemSlotRest
                    } = slotProps?.item ?? {};
                    const {
                      label: itemLabel,
                      disabled: _d,
                      key: _k,
                      className: itemClassName,
                      style: itemStyleProp,
                      sx: itemSxProp,
                      ...itemRest
                    } = item;
                    const mergedItemClassName = [itemSlotClassName, itemClassName].filter(Boolean).join(' ') || undefined;
                    const mergedItemStyle = { ...itemSlotStyle, ...itemStyleProp };
                    return (
                      <Item
                        key={itemKey}
                        {...itemSlotRest}
                        {...itemRest}
                        disabled={isItemDisabled}
                        label={typeof itemLabel === 'string' ? itemLabel : undefined}
                        className={mergedItemClassName}
                        style={mergedItemStyle}
                        css={[itemSlotCss, itemSlotSx]}
                        sx={itemSxProp}
                      >
                        {itemLabel}
                      </Item>
                    );
                  })
                ) : (
                  children
                )}
              </Root>
            )}
          </WithSx>
        </MotionConfig>
      </Context.Provider>
    </Menu>
  );
}
ButtonGroupRoot.displayName = 'ButtonGroup';

// Tooltip.Trigger renders its own button, and segments render through Button's render seam, so
// the segment element itself is the reference; behavior and surface come from Tooltip's seam.
function ActionTooltip({
  name,
  labelledBy,
  enabled,
  children,
}: {
  name?: string;
  labelledBy?: string;
  enabled: boolean;
  children: (
    props: Record<string, unknown>,
    ref: ReturnType<typeof useOverlayFloating>['refs']['setReference'],
  ) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [referencedName, setReferencedName] = useState<string>();
  const resolvedName = name ?? referencedName;
  const available = enabled && Boolean(resolvedName);
  const { refs, floatingStyles, context } = useOverlayFloating({
    open: available && open,
    placement: 'top',
    onOpenChange: setOpen,
  });
  useLayoutEffect(() => {
    const document = refs.domReference.current?.ownerDocument;
    setReferencedName(
      labelledBy
        ?.split(/\s+/)
        .map((id) => document?.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim() || undefined,
    );
  }, [refs, labelledBy]);
  useEffect(() => {
    if (!available) setOpen(false);
  }, [available]);
  const { getReferenceProps, getFloatingProps } = useTooltipInteractions(context, { enabled: available });
  const { tabIndex: _tabIndex, ...floatingProps } = getFloatingProps();
  return (
    <>
      {children(getReferenceProps(), refs.setReference)}
      {available && open && (
        <OverlayPortal>
          <div {...floatingProps} ref={refs.setFloating} css={tooltipContentStyle} style={floatingStyles}>
            {resolvedName}
          </div>
        </OverlayPortal>
      )}
    </>
  );
}

function actionPresentation(
  compact: boolean,
  props: Pick<
    ButtonGroupItemProps,
    'iconOnly' | 'label' | 'startIcon' | 'children' | 'aria-label' | 'aria-labelledby'
  >,
) {
  const name =
    props.label ?? props['aria-label'] ?? (typeof props.children === 'string' ? props.children : undefined);
  const collapsed =
    props.iconOnly ||
    (compact &&
      isRenderable(props.startIcon) &&
      props.startIcon !== '' &&
      (name !== undefined || props['aria-labelledby'] !== undefined));
  return { name, collapsed: Boolean(collapsed) };
}

function ButtonGroupItem({
  ref,
  variant,
  tone,
  size,
  disabled = false,
  iconOnly = false,
  label,
  reserveLabels,
  children,
  startIcon,
  endIcon,
  sx,
  ...rest
}: ButtonGroupItemProps) {
  const group = useGroup('Item');
  const { collapsed, name } = actionPresentation(group.compact, {
    ...rest,
    iconOnly,
    label,
    startIcon,
    children,
  });
  const isDisabled = disabled || group.disabled;
  const inactive =
    isDisabled || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true' || rest.loading;
  const resolvedSize = size ?? group.size;
  const expandable =
    group.presentation === 'expanding' &&
    Boolean(rest.id) &&
    isRenderable(startIcon) &&
    startIcon !== '' &&
    !iconOnly &&
    Boolean(name);
  const expanded = !expandable || group.expandedValue === undefined || rest.id === group.expandedValue;
  return (
    <IsolatedOverlay>
      <ActionTooltip
        name={name}
        labelledBy={rest['aria-labelledby']}
        enabled={(collapsed || (expandable && !expanded)) && !inactive}
      >
        {(tooltipProps, tooltipRef) => (
          <Button
            {...rest}
            ref={ref}
            variant={variant ?? group.variant}
            tone={tone ?? group.tone}
            size={resolvedSize}
            disabled={isDisabled}
            startIcon={isRenderable(startIcon) && startIcon !== '' ? startIcon : undefined}
            endIcon={isRenderable(endIcon) && endIcon !== '' ? endIcon : undefined}
            aria-label={
              rest['aria-label'] ??
              ((collapsed || expandable) && rest['aria-labelledby'] === undefined ? name : undefined)
            }
            data-expandable={expandable || undefined}
            data-expanded={expandable ? expanded : undefined}
            data-ui="button-group-item"
            css={[segmentStyle, sizeStyles[resolvedSize], iconOnly && iconOnlyStyle, expandable && expandingActionStyle]}
            sx={sx}
            render={(props) => (
              <TooltipButton
                props={props}
                tooltipProps={tooltipProps}
                tooltipRef={tooltipRef}
                disabled={isDisabled}
              />
            )}
          >
            {expandable ? (
              <ExpandingLabels expanded={expanded} reserveLabels={reserveLabels}>
                {isRenderable(children) ? children : name}
              </ExpandingLabels>
            ) : (
              <Labels reserveLabels={reserveLabels} collapsed={collapsed}>
                {children}
              </Labels>
            )}
          </Button>
        )}
      </ActionTooltip>
    </IsolatedOverlay>
  );
}
ButtonGroupItem.displayName = 'ButtonGroup.Item';

function TooltipButton({
  props,
  tooltipProps,
  tooltipRef,
  disabled,
}: {
  props: Parameters<NonNullable<ButtonProps['render']>>[0];
  tooltipProps: Record<string, unknown>;
  tooltipRef: ReturnType<typeof useOverlayFloating>['refs']['setReference'];
  disabled: boolean;
}) {
  const ref = useMergeRefs([props.ref, tooltipRef]);
  const describedBy =
    [props['aria-describedby'], tooltipProps['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return (
    <button
      {...consumerHandlersFirst(props, (attributes) => ({
        ...attributes,
        ...tooltipProps,
      }))}
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled}
      aria-describedby={describedBy}
      data-button-group-segment
      data-button-group-action
    />
  );
}

function ButtonGroupLink({
  ref,
  href,
  disabled = false,
  variant,
  tone,
  size,
  iconOnly = false,
  label,
  startIcon,
  reserveLabels,
  children,
  className,
  sx,
  onClick,
  onAuxClick,
  onKeyDown,
  ...rest
}: ButtonGroupLinkProps) {
  const group = useGroup('Link');
  const inactive =
    disabled || group.disabled || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const resolvedSize = size ?? group.size;
  const { collapsed, name } = actionPresentation(group.compact, {
    ...rest,
    iconOnly,
    label,
    startIcon,
    children,
  });
  return (
    <IsolatedOverlay>
      <ActionTooltip name={name} labelledBy={rest['aria-labelledby']} enabled={collapsed && !inactive}>
        {(tooltipProps, tooltipRef) => (
          <Button
            variant={variant ?? group.variant}
            tone={tone ?? group.tone}
            size={resolvedSize}
            startIcon={isRenderable(startIcon) && startIcon !== '' ? startIcon : undefined}
            css={[segmentStyle, sizeStyles[resolvedSize], iconOnly && iconOnlyStyle]}
            className={className}
            sx={sx}
            data-ui="button-group-link"
            render={({ ref: _buttonRef, type: _type, ...props }) => (
              <TooltipAnchor
                tooltipProps={tooltipProps}
                tooltipRef={tooltipRef}
                {...rest}
                {...props}
                ref={ref}
                href={inactive ? undefined : href}
                role={rest.role ?? (inactive ? 'link' : undefined)}
                aria-busy={rest['aria-busy']}
                aria-disabled={inactive || rest['aria-disabled']}
                aria-label={
                  rest['aria-label'] ??
                  (collapsed && rest['aria-labelledby'] === undefined ? name : undefined)
                }
                tabIndex={inactive ? -1 : rest.tabIndex}
                data-button-group-segment
                data-button-group-action
                onClick={(event) => {
                  if (inactive) event.preventDefault();
                  else onClick?.(event);
                }}
                onAuxClick={(event) => {
                  if (inactive) event.preventDefault();
                  else onAuxClick?.(event);
                }}
                onKeyDown={(event) => {
                  if (inactive && event.key === 'Enter') event.preventDefault();
                  else onKeyDown?.(event);
                }}
              />
            )}
          >
            <Labels reserveLabels={reserveLabels} collapsed={collapsed}>
              {children}
            </Labels>
          </Button>
        )}
      </ActionTooltip>
    </IsolatedOverlay>
  );
}
ButtonGroupLink.displayName = 'ButtonGroup.Link';

function TooltipAnchor({
  tooltipProps,
  tooltipRef,
  ref: consumerRef,
  ...props
}: ComponentPropsWithRef<'a'> & {
  tooltipProps: Record<string, unknown>;
  tooltipRef: ReturnType<typeof useOverlayFloating>['refs']['setReference'];
}) {
  const ref = useMergeRefs([consumerRef, tooltipRef]);
  const describedBy =
    [props['aria-describedby'], tooltipProps['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return (
    <a
      {...consumerHandlersFirst(props, (attributes) => ({
        ...attributes,
        ...tooltipProps,
      }))}
      ref={ref}
      aria-describedby={describedBy}
    />
  );
}

function ButtonGroupLabel({ className, sx, ...props }: ButtonGroupLabelProps) {
  const { size } = useGroup('Label');
  return (
    <WithSx className={className} styles={[labelStyle, segmentStyle, sizeStyles[size]]} sx={sx}>
      {(className) => (
        <span {...props} data-ui="button-group-label" data-button-group-segment className={className} />
      )}
    </WithSx>
  );
}
ButtonGroupLabel.displayName = 'ButtonGroup.Label';

function ButtonGroupTrigger({
  ref,
  variant,
  tone,
  size,
  disabled = false,
  children = caret,
  startIcon,
  endIcon,
  sx,
  ...rest
}: ButtonGroupTriggerProps) {
  const group = useGroup('Trigger');
  const labelledBy = rest['aria-labelledby'];
  const { setTriggerLabelledBy } = group;
  useLayoutEffect(() => {
    setTriggerLabelledBy(labelledBy);
    return () => setTriggerLabelledBy(undefined);
  }, [labelledBy, setTriggerLabelledBy]);
  const resolvedSize = size ?? group.size,
    inactive = disabled || group.disabled;
  const ariaInactive = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  return (
    <Button
      {...rest}
      ref={ref}
      variant={variant ?? group.variant}
      tone={tone ?? group.tone}
      size={resolvedSize}
      disabled={inactive}
      startIcon={isRenderable(startIcon) && startIcon !== '' ? startIcon : undefined}
      endIcon={isRenderable(endIcon) && endIcon !== '' ? endIcon : undefined}
      data-ui="button-group-trigger"
      css={[segmentStyle, sizeStyles[resolvedSize]]}
      sx={sx}
      render={({ ref: renderRef, 'data-ui': marker, ...props }) => (
        <MenuTriggerPart
          {...props}
          ref={renderRef}
          disabled={inactive}
          onKeyDown={(event) => {
            if (ariaInactive) event.preventDefault();
            else props.onKeyDown?.(event);
          }}
          family="ButtonGroup"
          marker={marker}
          data-button-group-segment
          data-button-group-action
        />
      )}
    >
      {isRenderable(children) && children !== '' && (
        <span css={caretStyle} aria-hidden>
          {children}
        </span>
      )}
    </Button>
  );
}
ButtonGroupTrigger.displayName = 'ButtonGroup.Trigger';
function ButtonGroupContent({ dir, 'aria-labelledby': labelledBy, ...props }: ButtonGroupContentProps) {
  const group = useGroup('Content');
  return (
    <MenuContentPart
      {...props}
      dir={dir ?? group.direction}
      aria-labelledby={
        [labelledBy, props['aria-label'] === undefined ? group.triggerLabelledBy : undefined]
          .filter(Boolean)
          .join(' ') || undefined
      }
      family="ButtonGroup"
      marker="button-group-content"
      styles={[listboxSurfaceStyle, listboxScrollStyle]}
    />
  );
}
ButtonGroupContent.displayName = 'ButtonGroup.Content';
function ButtonGroupMenuItem({
  tone = 'neutral',
  disabled = false,
  onClick,
  onSelect,
  ...props
}: ButtonGroupMenuItemProps) {
  const group = useGroup('MenuItem');
  return (
    <MenuItemPart
      {...props}
      disabled={
        disabled || group.disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true'
      }
      family="ButtonGroup"
      part="MenuItem"
      marker="button-group-menu-item"
      styles={[menuItemStyles, menuItemToneStyles[tone]]}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelect?.();
      }}
    />
  );
}
ButtonGroupMenuItem.displayName = 'ButtonGroup.MenuItem';
function ButtonGroupSeparator({ orientation = 'horizontal', ...props }: ButtonGroupSeparatorProps) {
  useGroup('Separator');
  return (
    <MenuSeparatorPart
      {...props}
      aria-orientation={orientation}
      marker="button-group-separator"
      styles={[menuSeparatorStyles, orientation === 'vertical' && verticalSeparatorStyle]}
    />
  );
}
ButtonGroupSeparator.displayName = 'ButtonGroup.Separator';
export const ButtonGroup = Object.assign(ButtonGroupRoot, {
  Item: ButtonGroupItem,
  Link: ButtonGroupLink,
  Label: ButtonGroupLabel,
  Trigger: ButtonGroupTrigger,
  Content: ButtonGroupContent,
  MenuItem: ButtonGroupMenuItem,
  Separator: ButtonGroupSeparator,
});
