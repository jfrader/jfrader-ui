'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import {
  findByValue,
  moveRovingFocus,
  queryOwnedItems,
  type OwnedItemsQuery,
} from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';

export type SegmentedControlSize = 'sm' | 'md' | 'lg';
export type SegmentedControlVariant = 'solid' | 'soft';
type SlotProps<Element extends 'div' | 'span'> = ComponentPropsWithoutRef<Element> & {
  css?: Interpolation<Theme>;
};

export interface SegmentedControlProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  size?: SegmentedControlSize;
  variant?: SegmentedControlVariant;
  label?: string;
  onOptionIntent?: (value: string) => void;
  slotProps?: { track?: SlotProps<'div'>; selection?: SlotProps<'span'> };
}

export interface SegmentedControlItemProps extends Omit<ComponentPropsWithRef<'button'>, 'value'>, SxProps {
  value: string;
  accessory?: ReactNode;
}

interface ControlContext {
  value: string | undefined;
  requestChange: (value: string) => void;
  setFocused: (value: string) => void;
  tabStop: string | undefined;
  disabled: boolean;
  size: SegmentedControlSize;
  variant: SegmentedControlVariant;
  onOptionIntent: SegmentedControlProps['onOptionIntent'];
  selection: SlotProps<'span'> | undefined;
  reducedMotion: boolean | null;
}

const Context = createContext<ControlContext | null>(null);
const ITEM_QUERY: OwnedItemsQuery = {
  itemSelector: '[data-ui="segmented-control-item"]:not([disabled])',
  ownerSelector: '[data-ui="segmented-control"]',
};
const ALL_ITEMS_QUERY = { ...ITEM_QUERY, itemSelector: '[data-ui="segmented-control-item"]' };
const SELECTION_SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const;

const rootStyle = css({
  display: 'inline-flex',
  minInlineSize: 0,
  maxInlineSize: '100%',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceInset,
  fontFamily: vars.font.sans,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const trackStyle = css({
  display: 'flex',
  position: 'relative',
  minInlineSize: 0,
  overflowX: 'auto',
  padding: vars.space[1],
  gap: vars.space[1],
  borderRadius: 'inherit',
  borderInlineStart: '1px solid transparent',
  borderInlineEnd: '1px solid transparent',
  '&[data-overflow-start="true"]': { borderInlineStartColor: vars.color.borderControl },
  '&[data-overflow-end="true"]': { borderInlineEndColor: vars.color.borderControl },
  [FORCED_COLORS]: {
    '&[data-overflow-start="true"]': { borderInlineStartColor: 'CanvasText' },
    '&[data-overflow-end="true"]': { borderInlineEndColor: 'CanvasText' },
  },
});
const itemStyle = css({
  appearance: 'none',
  position: 'relative',
  isolation: 'isolate',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  boxSizing: 'border-box',
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  paddingBlock: vars.space[1],
  paddingInline: vars.space[3],
  background: 'transparent',
  color: vars.color.textMuted,
  fontFamily: 'inherit',
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.base,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transitionProperty: 'color, background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled):not([aria-checked="true"])': {
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.text,
  },
  '&[aria-checked="true"]': { borderColor: vars.color.borderControl, color: vars.color.text },
  '&:focus-visible': { ...focusRingOutset },
  '&:disabled': { opacity: 0.55, cursor: 'not-allowed' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    '&[aria-checked="true"]': { borderColor: 'Highlight', color: 'CanvasText' },
  },
});
const sizeStyles: Record<SegmentedControlSize, SerializedStyles> = {
  sm: css({ minBlockSize: vars.space[8], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: vars.space[10], fontSize: vars.textSize.sm }),
  lg: css({ minBlockSize: vars.space[12], fontSize: vars.textSize.md }),
};
const solidItemStyle = css({
  '&[aria-checked="true"]': { color: vars.color.accentContrast, borderColor: vars.color.accentContrast },
  [FORCED_COLORS]: { '&[aria-checked="true"]': { color: 'CanvasText', borderColor: 'Highlight' } },
});
const selectionStyle = css({
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  borderRadius: 'inherit',
  pointerEvents: 'none',
  [FORCED_COLORS]: { backgroundColor: 'Canvas', boxShadow: 'none' },
});
const selectionVariants: Record<SegmentedControlVariant, SerializedStyles> = {
  soft: css({ backgroundColor: vars.color.surfaceRaised, boxShadow: vars.shadow.raised }),
  solid: css({ backgroundColor: vars.color.accent }),
};

function SelectionSurface({
  ref,
  variant,
  slotProps,
  style,
  ...rest
}: ComponentPropsWithRef<'span'> & {
  variant: SegmentedControlVariant;
  slotProps?: SlotProps<'span'>;
}) {
  return (
    <span
      {...slotProps}
      {...rest}
      ref={ref}
      aria-hidden="true"
      hidden={false}
      role={undefined}
      tabIndex={undefined}
      data-ui="segmented-control-selection"
      children={undefined}
      style={{
        ...slotProps?.style,
        ...style,
        position: 'absolute',
        inset: 0,
        inlineSize: 'auto',
        blockSize: 'auto',
        pointerEvents: 'none',
      }}
      css={[selectionVariants[variant], selectionStyle, slotProps?.css]}
    />
  );
}
const MotionSelection = motion.create(SelectionSurface);

function SegmentedControlRoot({
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  size = 'md',
  variant = 'soft',
  label,
  onOptionIntent,
  slotProps,
  className,
  sx,
  children,
  onKeyDown,
  ...rest
}: SegmentedControlProps) {
  const [value, requestChange] = useControlledState(valueProp, defaultValue, onValueChange);
  const [focused, setFocused] = useState<string | null>(null);
  const [tabStop, setTabStop] = useState<string>();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement, []);
  const instanceId = useId();
  const reducedMotion = useReducedMotion();
  const initiallyScrolled = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const recover = () => {
      const items = queryOwnedItems(root, ITEM_QUERY);
      setTabStop((findByValue(items, focused) ?? findByValue(items, value) ?? items[0])?.dataset.value);
    };
    recover();
    const observer = new MutationObserver(recover);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled', 'data-value'],
    });
    return () => observer.disconnect();
  });

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    const updateEdges = () => {
      const items = queryOwnedItems(root, ALL_ITEMS_QUERY);
      const bounds = track.getBoundingClientRect();
      const first = items[0]?.getBoundingClientRect();
      const last = items.at(-1)?.getBoundingClientRect();
      const rtl = getComputedStyle(root).direction === 'rtl';
      track.dataset.overflowStart = String(
        Boolean(first && (rtl ? first.right > bounds.right : first.left < bounds.left)),
      );
      track.dataset.overflowEnd = String(
        Boolean(last && (rtl ? last.left < bounds.left : last.right > bounds.right)),
      );
    };
    const observer = new ResizeObserver(updateEdges);
    observer.observe(track);
    queryOwnedItems(root, ALL_ITEMS_QUERY).forEach((item) => observer.observe(item));
    track.addEventListener('scroll', updateEdges, { passive: true });
    updateEdges();
    return () => {
      observer.disconnect();
      track.removeEventListener('scroll', updateEdges);
    };
  });

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    const items = queryOwnedItems(root, ALL_ITEMS_QUERY);
    const active = root.ownerDocument.activeElement;
    const target = items.includes(active as HTMLElement)
      ? (active as HTMLElement)
      : findByValue(items, value);
    if (target) {
      const bounds = track.getBoundingClientRect();
      const item = target.getBoundingClientRect();
      const gutter = parseFloat(getComputedStyle(track).paddingInlineStart);
      const left = bounds.left + gutter;
      const right = bounds.right - gutter;
      const delta = item.left < left ? item.left - left : item.right > right ? item.right - right : 0;
      if (delta)
        track.scrollBy({
          left: delta,
          behavior: reducedMotion || !initiallyScrolled.current ? 'instant' : 'smooth',
        });
    }
    initiallyScrolled.current = true;
  }, [focused, value, reducedMotion]);

  const context = useMemo(
    () => ({
      value,
      requestChange,
      setFocused,
      tabStop,
      disabled,
      size,
      variant,
      onOptionIntent,
      selection: slotProps?.selection,
      reducedMotion,
    }),
    [
      value,
      requestChange,
      tabStop,
      disabled,
      size,
      variant,
      onOptionIntent,
      slotProps?.selection,
      reducedMotion,
    ],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (event.defaultPrevented || !root || disabled) return;
    moveRovingFocus(
      event,
      root,
      event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'vertical' : 'horizontal',
      ITEM_QUERY,
    );
    if (event.defaultPrevented) {
      const target = root.ownerDocument.activeElement as HTMLElement;
      if (queryOwnedItems(root, ITEM_QUERY).includes(target) && target.dataset.value !== undefined)
        requestChange(target.dataset.value);
    }
  };

  return (
    <Context.Provider value={context}>
      <MotionConfig reducedMotion="user">
        <LayoutGroup id={instanceId}>
          <WithSx className={className} styles={rootStyle} sx={sx}>
            {(className) => (
              <div
                {...rest}
                ref={rootRef}
                role="radiogroup"
                aria-label={label ?? rest['aria-label']}
                aria-disabled={disabled || rest['aria-disabled']}
                data-ui="segmented-control"
                onKeyDown={handleKeyDown}
                className={className}
              >
                <div
                  {...slotProps?.track}
                  ref={trackRef}
                  aria-hidden={undefined}
                  hidden={false}
                  role={undefined}
                  tabIndex={undefined}
                  data-ui="segmented-control-track"
                  css={[trackStyle, slotProps?.track?.css]}
                >
                  {children}
                </div>
              </div>
            )}
          </WithSx>
        </LayoutGroup>
      </MotionConfig>
    </Context.Provider>
  );
}
SegmentedControlRoot.displayName = 'SegmentedControl';

function SegmentedControlItem({
  ref,
  value,
  accessory,
  children,
  disabled: itemDisabled,
  className,
  sx,
  onClick,
  onFocus,
  onPointerEnter,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: SegmentedControlItemProps) {
  const context = useContext(Context);
  if (!context) throw new Error('SegmentedControl.Item must be rendered inside <SegmentedControl>.');
  const id = useId();
  const disabled = context.disabled || itemDisabled;
  const selected = context.value === value;
  const hasLabel = isRenderable(children);
  const hasAccessory = isRenderable(accessory);
  return (
    <WithSx
      className={className}
      styles={[itemStyle, sizeStyles[context.size], context.variant === 'solid' && solidItemStyle]}
      sx={sx}
    >
      {(className) => (
        <button
          {...rest}
          ref={ref}
          type="button"
          role="radio"
          data-ui="segmented-control-item"
          data-value={value}
          aria-checked={selected}
          disabled={disabled}
          tabIndex={!disabled && context.tabStop === value ? 0 : -1}
          aria-labelledby={[labelledBy, hasLabel && `${id}-label`].filter(Boolean).join(' ') || undefined}
          aria-describedby={
            [describedBy, hasAccessory && `${id}-accessory`].filter(Boolean).join(' ') || undefined
          }
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented && !disabled) context.requestChange(value);
          }}
          onFocus={(event) => {
            onFocus?.(event);
            if (!disabled) {
              context.setFocused(value);
              context.onOptionIntent?.(value);
            }
          }}
          onPointerEnter={(event) => {
            onPointerEnter?.(event);
            if (!disabled) context.onOptionIntent?.(value);
          }}
          className={className}
        >
          {selected && (
            <MotionSelection
              variant={context.variant}
              slotProps={context.selection}
              layoutId="selection"
              initial={false}
              transition={context.reducedMotion ? { duration: 0 } : SELECTION_SPRING}
            />
          )}
          {hasLabel && <span id={`${id}-label`}>{children}</span>}
          {hasAccessory && <span id={`${id}-accessory`}>{accessory}</span>}
        </button>
      )}
    </WithSx>
  );
}
SegmentedControlItem.displayName = 'SegmentedControl.Item';

export const SegmentedControl = Object.assign(SegmentedControlRoot, { Item: SegmentedControlItem });
