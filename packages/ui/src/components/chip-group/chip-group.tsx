'use client';

import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { animate, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { base } from '@jfrader/tokens';
import { Check as CheckIcon } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { controlSizeStyles, controlTouchTargetStyles } from '../../styling/control-size';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
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
  sx?: Interpolation<Theme>;
};

export interface ChipGroupSlotProps {
  /** Animated container frame clipping expanding chip rows. */
  frame?: StyledSlot<'div'>;
  /** Flex container holding the chip buttons and overflow toggle. */
  row?: StyledSlot<'div'>;
  /** Toggle button representing an individual chip option. */
  chip?: StyledSlot<'button'> | ((option: ChipGroupOption) => StyledSlot<'button'>);
  /** Text label displayed inside a chip. */
  label?: StyledSlot<'span'>;
  /** Checkmark glyph displayed when a chip is selected. */
  check?: StyledSlot<'span'>;
  /** Button that expands or collapses hidden overflow chips. */
  overflow?: StyledSlot<'button'>;
}

export interface ChipGroupSlots {
  /** Container frame clipping expanding chip rows. */
  frame?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Container holding the chip buttons and overflow toggle. */
  row?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Toggle button representing an individual chip option. */
  chip?: ComponentType<ComponentPropsWithRef<'button'>>;
  /** Text label displayed inside a chip. */
  label?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Checkmark glyph displayed when a chip is selected. */
  check?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Button that expands or collapses hidden overflow chips. */
  overflow?: ComponentType<ComponentPropsWithRef<'button'>>;
}

interface ChipGroupBaseProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  /** Supplies the chips in display and multiple-selection callback order. */
  options: readonly ChipGroupOption[];
  /** Names the group when no ARIA naming prop is supplied. */
  label?: string;
  /** Allows clearing the selected chip in `single` mode. Defaults to true; ignored in `multiple` mode. */
  allowEmpty?: boolean;
  /** Disables all chips and the overflow button. Defaults to false. */
  disabled?: boolean;
  /** Sets chip height and text size. Defaults to `md`. */
  size?: 'sm' | 'md';
  /** Limits collapsed chips to this positive integer, retaining selected chips; requires `moreLabel` and `lessLabel`. */
  maxVisible?: number;
  /** Controls whether overflow chips are visible. */
  expanded?: boolean;
  /** Shows overflow chips initially when uncontrolled. Defaults to false. */
  defaultExpanded?: boolean;
  /** Requests expansion or collapse when the overflow button is pressed. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Formats the overflow count; defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Builds the expand button label from the formatted and raw hidden-chip count. */
  moreLabel?: (formattedCount: string, count: number) => string;
  /** Labels the button that collapses overflow chips. */
  lessLabel?: string;
  /** Replaces the frame, chip row and chip presentation parts. */
  slots?: ChipGroupSlots;
  /** Passes props to the frame, chip row and chip presentation parts. */
  slotProps?: ChipGroupSlotProps;
}

export interface ChipGroupSingleProps extends ChipGroupBaseProps {
  /** Restricts selection to one chip. */
  type: 'single';
  /** Controls the selected chip; an empty string clears selection. */
  value?: string;
  /** Sets the initial uncontrolled selection. Defaults to an empty string. */
  defaultValue?: string;
  /** Reports the requested chip value, or an empty string when cleared. */
  onValueChange?: (value: string) => void;
}

export interface ChipGroupMultipleProps extends ChipGroupBaseProps {
  /** Allows selecting several chips. Defaults to `multiple`. */
  type?: 'multiple';
  /** Controls the selected chips; an empty array clears selection. */
  value?: readonly string[];
  /** Sets the initial uncontrolled selections. Defaults to an empty array. */
  defaultValue?: readonly string[];
  /** Reports requested selections in option order. */
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
  overflowWrap: 'anywhere',
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
  sm: css(controlSizeStyles.sm, controlTouchTargetStyles.sm),
  md: css(controlSizeStyles.md, controlTouchTargetStyles.md),
};
const labelStyle = css({ minInlineSize: 0, whiteSpace: 'normal' });
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
  slots,
  slotProps,
  className,
  sx,
  onKeyDown,
  onBlur,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...rest
}: ChipGroupProps) {
  const Row = slots?.row ?? 'div';
  const Chip = slots?.chip ?? 'button';
  const Label = slots?.label ?? 'span';
  const Overflow = slots?.overflow ?? 'button';
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
              component={slots?.frame}
              frameRef={frameRef}
              rowRef={rowRef}
              frameProps={slotProps?.frame}
              signature={JSON.stringify([expanded, selected])}
            >
              <Row {...withoutSx(slotProps?.row)} ref={rowRef} id={rowId} css={[rowStyle, slotProps?.row?.sx]}>
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
                      <Chip
                        {...withoutSx(chip)}
                        type="button"
                        disabled={disabled || option.disabled}
                        aria-pressed={pressed}
                        data-ui="chip-group-chip"
                        data-value={option.value}
                        tabIndex={!disabled && !option.disabled && !overflowStop && tabValue === option.value ? 0 : -1}
                        css={[chipStyle, sizeStyles[size], chip?.sx]}
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
                        <Check pressed={pressed} slot={slotProps?.check} component={slots?.check} />
                        {isRenderable(option.label) && (
                          <Label {...withoutSx(slotProps?.label)} css={[labelStyle, slotProps?.label?.sx]}>
                            {option.label}
                          </Label>
                        )}
                      </Chip>
                    </motion.div>
                  );
                })}
                {hasOverflow && (
                  <motion.div layout="position" transition={LAYOUT_SPRING} css={itemFrameStyle}>
                    <Overflow
                      {...withoutSx(slotProps?.overflow)}
                      type="button"
                      disabled={disabled}
                      aria-expanded={expanded}
                      aria-controls={rowId}
                      data-ui="chip-group-overflow"
                      tabIndex={overflowStop ? 0 : -1}
                      css={[chipStyle, sizeStyles[size], slotProps?.overflow?.sx]}
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
                    </Overflow>
                  </motion.div>
                )}
              </Row>
            </HeightFrame>
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}
ChipGroup.displayName = 'ChipGroup';

function Check({ pressed, slot, component }: {
  pressed: boolean;
  slot?: StyledSlot<'span'>;
  component?: ComponentType<ComponentPropsWithRef<'span'>>;
}) {
  const Component = component ?? 'span';
  return (
    <Component {...withoutSx(slot)} aria-hidden="true" css={[checkStyle, slot?.sx]}>
      <motion.span
        css={checkStyle}
        layout
        style={{ width: pressed ? vars.space[4] : 0, marginInlineEnd: pressed ? vars.space[2] : 0 }}
        transition={LAYOUT_SPRING}
      >
        <CheckIcon size={16} sx={checkGlyphStyle} decorative />
      </motion.span>
    </Component>
  );
}

function HeightFrame({
  component,
  frameRef,
  rowRef,
  frameProps,
  signature,
  children,
}: {
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  frameRef: { current: HTMLDivElement | null };
  rowRef: { current: HTMLDivElement | null };
  frameProps?: StyledSlot<'div'>;
  signature: string;
  children: ReactNode;
}) {
  const Component = component ?? 'div';
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
    <Component {...withoutSx(frameProps)} ref={frameRef} css={frameProps?.sx}>
      {children}
    </Component>
  );
}
