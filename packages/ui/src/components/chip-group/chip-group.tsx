'use client';

import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { animate, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { moveRovingFocus, queryOwnedItems, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';

export interface ChipGroupOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

type StyledSlot<T extends 'div' | 'span' | 'button'> = Omit<
  ComponentPropsWithRef<T>,
  'children' | 'role' | 'tabIndex' | 'disabled' | 'aria-disabled' | 'aria-pressed' | 'aria-expanded' | 'aria-controls'
> & {
  css?: Interpolation<Theme>;
};

export interface ChipGroupSlotProps {
  frame?: StyledSlot<'div'>;
  row?: StyledSlot<'div'>;
  chip?: StyledSlot<'button'> | ((option: ChipGroupOption) => StyledSlot<'button'>);
  label?: StyledSlot<'span'>;
  check?: StyledSlot<'span'>;
  overflow?: StyledSlot<'button'>;
}

interface ChipGroupBaseProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  options: readonly ChipGroupOption[];
  label?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  maxVisible?: number;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  locale?: Intl.LocalesArgument;
  moreLabel?: (formattedCount: string, count: number) => string;
  lessLabel?: string;
  slotProps?: ChipGroupSlotProps;
}

export interface ChipGroupSingleProps extends ChipGroupBaseProps {
  type: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export interface ChipGroupMultipleProps extends ChipGroupBaseProps {
  type?: 'multiple';
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
}

export type ChipGroupProps = ChipGroupSingleProps | ChipGroupMultipleProps;
type Value = string | readonly string[];
const EMPTY: readonly string[] = [];
const OVERFLOW = Symbol('overflow');
const LAYOUT_SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const;
const MAX_REVEAL_STAGGER_MS = Number.parseFloat(base.motion.duration.slow);
const REVEAL_STEP_MS = Number.parseFloat(base.motion.duration.fast) / 4;
const ITEM_QUERY: OwnedItemsQuery = {
  ownerSelector: '[data-ui="chip-group"]',
  itemSelector: '[data-ui="chip-group-chip"]:not(:disabled), [data-ui="chip-group-overflow"]:not(:disabled)',
};
const rootStyle = css({ minInlineSize: 0 });
const rowStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[2], minInlineSize: 0 });
const chipStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minInlineSize: vars.space[8],
  maxInlineSize: '100%',
  paddingInline: vars.space[3],
  paddingBlock: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.base,
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceHover },
  '&[aria-pressed="true"]': {
    backgroundColor: vars.color.accentSoft,
    borderColor: vars.color.accent,
    color: vars.color.accentText,
  },
  '&[aria-pressed="true"]:hover:not(:disabled)': { backgroundColor: vars.color.accentSoftHover },
  '&:disabled': { opacity: 0.55, cursor: 'not-allowed', borderStyle: 'dashed' },
  '&:focus-visible': focusRingOutset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    '&[aria-pressed="true"]': { borderColor: 'Highlight', color: 'Highlight' },
  },
});
const sizeStyles = {
  sm: css({ minBlockSize: vars.space[8], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: vars.space[10], fontSize: vars.textSize.md }),
};
const labelStyle = css({ minInlineSize: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const checkStyle = css({ display: 'inline-flex', flexShrink: 0, overflow: 'hidden', alignItems: 'center' });
const itemFrameStyle = css({ display: 'inline-flex', minInlineSize: 0, maxInlineSize: '100%' });
const reveal = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const revealStyle = css({
  animationName: reveal,
  animationDuration: vars.motion.duration.fast,
  animationTimingFunction: vars.motion.easeStandard,
  animationFillMode: 'backwards',
  [REDUCED_MOTION]: { animation: 'none' },
});
const checkGlyphStyle = css({ inlineSize: vars.space[4], blockSize: vars.space[4], flexShrink: 0 });

/** Choose and clear filters. Arrows and Home/End move focus; horizontal arrows reverse in RTL.
 * Enter/Space toggle selection. Multiple values are reported in option order. */
export function ChipGroup({
  ref,
  options,
  type = 'multiple',
  value: valueProp,
  defaultValue,
  onValueChange,
  label,
  allowEmpty = true,
  disabled = false,
  size = 'md',
  maxVisible,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  locale,
  moreLabel,
  lessLabel,
  slotProps,
  className,
  sx,
  onKeyDown,
  onBlur,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...rest
}: ChipGroupProps) {
  if (
    maxVisible !== undefined &&
    (!Number.isInteger(maxVisible) || maxVisible < 1 || !moreLabel || lessLabel === undefined)
  ) {
    throw new Error('ChipGroup maxVisible requires a positive integer, moreLabel and lessLabel.');
  }
  const [value, requestValue] = useControlledState<Value>(
    valueProp,
    defaultValue ?? (type === 'single' ? '' : EMPTY),
    onValueChange as ((next: Value) => void) | undefined,
  );
  const [expandedValue, requestExpanded] = useControlledState(expandedProp, defaultExpanded, onExpandedChange);
  const expanded = expandedValue ?? false;
  const selected = typeof value === 'string' ? (value === '' ? EMPTY : [value]) : (value ?? EMPTY);
  const [pins, setPins] = useState<readonly string[]>(selected);
  const [previousExpanded, setPreviousExpanded] = useState(expanded);
  if (previousExpanded !== expanded) {
    setPreviousExpanded(expanded);
    if (!expanded) setPins(selected);
  }
  const visible = options.filter(
    (option, index) =>
      expanded ||
      maxVisible === undefined ||
      index < maxVisible ||
      selected.includes(option.value) ||
      pins.includes(option.value),
  );
  /** Options past the cutoff that a collapsed view hides; equals the hidden count while collapsed. */
  const hiddenCount = options.filter(
    (option, index) =>
      maxVisible !== undefined &&
      index >= maxVisible &&
      !selected.includes(option.value) &&
      (expanded || !pins.includes(option.value)),
  ).length;
  const hasOverflow = hiddenCount > 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const focusInside = useRef(false);
  const [focused, setFocused] = useState<string | typeof OVERFLOW | null>(null);
  const rowId = useId();
  useImperativeHandle(ref, () => rootRef.current!, []);
  useImperativeHandle(slotProps?.row?.ref, () => rowRef.current!, []);
  const enabledValues = visible.filter((option) => !disabled && !option.disabled).map((option) => option.value);
  const validFocus = typeof focused === 'string' && enabledValues.includes(focused);
  const tabValue = validFocus ? focused : (enabledValues.find((entry) => selected.includes(entry)) ?? enabledValues[0]);
  const overflowStop = !disabled && hasOverflow && (focused === OVERFLOW || !tabValue);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const previous = lastFocused.current;
    if (!root || !previous || !focusInside.current) return;
    const items = queryOwnedItems(root, ITEM_QUERY);
    if (items.includes(previous)) return;
    const active = root.ownerDocument.activeElement;
    if (active !== root.ownerDocument.body && active !== previous) return;
    const fallback = items.find((item) => item.dataset.ui === 'chip-group-overflow') ?? items[0];
    fallback?.focus();
  });

  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClassName) => (
          <div
            {...rest}
            ref={rootRef}
            role="group"
            aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : label)}
            aria-labelledby={ariaLabelledBy}
            aria-disabled={disabled || undefined}
            data-ui="chip-group"
            className={rootClassName}
            onBlur={(event) => {
              onBlur?.(event);
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) focusInside.current = false;
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.defaultPrevented) return;
              moveRovingFocus(
                event,
                event.currentTarget,
                event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'vertical' : 'horizontal',
                ITEM_QUERY,
              );
            }}
          >
            <HeightFrame
              frameRef={frameRef}
              rowRef={rowRef}
              frameProps={slotProps?.frame}
              signature={JSON.stringify([expanded, selected])}
            >
              <div {...slotProps?.row} ref={rowRef} id={rowId} css={[rowStyle, slotProps?.row?.css]}>
                {visible.map((option, index) => {
                  const chip = typeof slotProps?.chip === 'function' ? slotProps.chip(option) : slotProps?.chip;
                  const pressed = selected.includes(option.value);
                  return (
                    <motion.div
                      key={option.value}
                      layout
                      transition={LAYOUT_SPRING}
                      css={[
                        itemFrameStyle,
                        expanded &&
                          maxVisible !== undefined &&
                          index >= maxVisible &&
                          !pins.includes(option.value) &&
                          !pressed &&
                          revealStyle,
                      ]}
                      style={{ animationDelay: `${Math.min(index * REVEAL_STEP_MS, MAX_REVEAL_STAGGER_MS)}ms` }}
                    >
                      <button
                        {...chip}
                        type="button"
                        disabled={disabled || option.disabled}
                        aria-pressed={pressed}
                        data-ui="chip-group-chip"
                        data-value={option.value}
                        tabIndex={!disabled && !option.disabled && !overflowStop && tabValue === option.value ? 0 : -1}
                        css={[chipStyle, sizeStyles[size], chip?.css]}
                        onFocus={(event) => {
                          chip?.onFocus?.(event);
                          lastFocused.current = event.currentTarget;
                          focusInside.current = true;
                          setFocused(option.value);
                        }}
                        onClick={(event) => {
                          chip?.onClick?.(event);
                          if (event.defaultPrevented) return;
                          if (type === 'single') {
                            if (!pressed) requestValue(option.value);
                            else if (allowEmpty) requestValue('');
                          } else {
                            /** Rebuilt from options, so unknown controlled values stay in the prop but are not emitted. */
                            const next = options
                              .filter((entry) =>
                                entry.value === option.value ? !pressed : selected.includes(entry.value),
                              )
                              .map((entry) => entry.value);
                            if (
                              next.length !== selected.length ||
                              next.some((entry, index) => entry !== selected[index])
                            )
                              requestValue(next);
                          }
                        }}
                      >
                        <Check pressed={pressed} slot={slotProps?.check} />
                        {isRenderable(option.label) && (
                          <span {...slotProps?.label} css={[labelStyle, slotProps?.label?.css]}>
                            {option.label}
                          </span>
                        )}
                      </button>
                    </motion.div>
                  );
                })}
                {hasOverflow && (
                  <motion.div layout="position" transition={LAYOUT_SPRING} css={itemFrameStyle}>
                    <button
                      {...slotProps?.overflow}
                      type="button"
                      disabled={disabled}
                      aria-expanded={expanded}
                      aria-controls={rowId}
                      data-ui="chip-group-overflow"
                      tabIndex={overflowStop ? 0 : -1}
                      css={[chipStyle, sizeStyles[size], slotProps?.overflow?.css]}
                      onFocus={(event) => {
                        slotProps?.overflow?.onFocus?.(event);
                        lastFocused.current = event.currentTarget;
                        focusInside.current = true;
                        setFocused(OVERFLOW);
                      }}
                      onClick={(event) => {
                        slotProps?.overflow?.onClick?.(event);
                        if (!event.defaultPrevented) requestExpanded(!expanded);
                      }}
                    >
                      {expanded
                        ? lessLabel
                        : moreLabel!(numberFormatter(locale).format(hiddenCount), hiddenCount)}
                    </button>
                  </motion.div>
                )}
              </div>
            </HeightFrame>
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}
ChipGroup.displayName = 'ChipGroup';

function Check({ pressed, slot }: { pressed: boolean; slot?: StyledSlot<'span'> }) {
  return (
    <span {...slot} aria-hidden="true" css={[checkStyle, slot?.css]}>
      <motion.span
        css={checkStyle}
        layout
        style={{ width: pressed ? vars.space[4] : 0, marginInlineEnd: pressed ? vars.space[2] : 0 }}
        transition={LAYOUT_SPRING}
      >
        <svg css={checkGlyphStyle} viewBox="0 0 16 16" fill="none">
          <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" />
        </svg>
      </motion.span>
    </span>
  );
}

function HeightFrame({
  frameRef,
  rowRef,
  frameProps,
  signature,
  children,
}: {
  frameRef: { current: HTMLDivElement | null };
  rowRef: { current: HTMLDivElement | null };
  frameProps?: StyledSlot<'div'>;
  signature: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  useImperativeHandle(frameProps?.ref, () => frameRef.current!, [frameRef]);
  const previousHeight = useRef<number | null>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const row = rowRef.current;
    if (!frame || !row) return;
    const next = row.getBoundingClientRect().height;
    const previous = previousHeight.current;
    previousHeight.current = next;
    const controls =
      previous !== null && previous !== next && !reduced
        ? animate(previous, next, {
            ...LAYOUT_SPRING,
            onUpdate: (height) => {
              frame.style.height = `${height}px`;
            },
          })
        : undefined;
    let active = true;
    void controls?.then(() => {
      if (active) frame.style.height = 'auto';
    });
    const observer = new ResizeObserver(() => {
      const measured = row.getBoundingClientRect().height;
      previousHeight.current = measured;
      if (measured !== next) {
        controls?.stop();
        frame.style.height = 'auto';
      }
    });
    observer.observe(row);
    return () => {
      active = false;
      controls?.stop();
      observer.disconnect();
      frame.style.height = 'auto';
    };
  }, [signature, reduced, frameRef, rowRef]);
  return (
    <div {...frameProps} ref={frameRef} css={frameProps?.css}>
      {children}
    </div>
  );
}
