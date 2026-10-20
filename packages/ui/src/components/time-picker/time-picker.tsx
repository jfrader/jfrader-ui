'use client';
import { dateTimeFormatter } from '../../utils/intl';

// Select-only combobox: Select owns virtual focus, wrapping arrows, Home/End, typeahead,
// Enter/Space selection, Escape and Tab dismissal. Values are civil HH:mm, not timestamps.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { animate, motion, MotionConfig, useMotionValue } from 'motion/react';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useFieldAnatomy, type FieldLabelPlacement } from '../field/field-anatomy';
import { Select, type SelectTriggerProps, type SelectContentProps, type SelectItemProps } from '../select';

export type TimePickerSize = 'sm' | 'md' | 'lg';
export type TimePickerMinuteStep = 1 | 5 | 10 | 15 | 30;
export type TimePickerHourCycle = 'h12' | 'h23';
type Slot<Tag extends 'div' | 'span' | 'label' | 'button'> = ComponentPropsWithRef<Tag> & {
  sx?: Interpolation<Theme>;
};
export interface TimePickerSlotProps {
  /** Field container wrapping the label, control and messages. */
  root?: Slot<'div'>;
  /** Text naming the field. */
  label?: Slot<'label'>;
  /** Button showing the current time and opening the list. */
  control?: Slot<'button'>;
  /** Floating list holding the selectable times. */
  content?: Slot<'div'>;
  /** One selectable time in the list. */
  option?: Slot<'div'>;
  /** Helper text displayed below the control. */
  description?: Slot<'span'>;
  /** Validation error message displayed when invalid. */
  error?: Slot<'span'>;
  /** Clock glyph shown inside the control. */
  icon?: Slot<'span'>;
}
export interface TimePickerSlots {
  /** Container wrapping the field. */
  root?: ComponentType<Slot<'div'>>;
  /** Label naming the field. */
  label?: ComponentType<Slot<'label'>>;
  /** Select trigger showing the current time. */
  control?: ComponentType<SelectTriggerProps>;
  /** Select popup containing the times. */
  content?: ComponentType<SelectContentProps>;
  /** Select item representing a time. */
  option?: ComponentType<SelectItemProps>;
  /** Helper text below the control. */
  description?: ComponentType<Slot<'span'>>;
  /** Validation message below the control. */
  error?: ComponentType<Slot<'span'>>;
  /** Clock glyph beside the value. */
  icon?: ComponentType<Slot<'span'>>;
}
export interface TimePickerProps
  extends
    Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'onChange' | 'size' | 'children'>,
    SxProps {
  /** Controls the selected time in `HH:mm` format; an empty string clears it. */
  value?: string;
  /** Sets the initial uncontrolled time in `HH:mm` format. Defaults to `09:00`. */
  defaultValue?: string;
  /** Receives the selected time in `HH:mm` format. */
  onValueChange?: (time: string) => void;
  /** Controls popup visibility; disabled and read-only fields stay closed. */
  open?: boolean;
  /** Opens the uncontrolled popup initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receives requests to open or close the popup. */
  onOpenChange?: (open: boolean) => void;
  /** Sets the interval between selectable times in minutes. Defaults to `15`. */
  minuteStep?: TimePickerMinuteStep;
  /** Add a draggable 24-hour face above the time options. Default: `list`. */
  presentation?: 'list' | 'dial';
  /** Sets the earliest selectable time in `HH:mm` format, inclusive. Invalid or reversed bounds leave no options. */
  min?: string;
  /** Sets the latest selectable time in `HH:mm` format, inclusive. Invalid or reversed bounds leave no options. */
  max?: string;
  /** Supply a locale so server and client text match. */
  locale?: string;
  /** Chooses 12- or 24-hour display. Defaults to the locale's hour cycle. */
  hourCycle?: TimePickerHourCycle;
  /** Names the time field. */
  label?: ReactNode;
  /** Label placement. `hidden` keeps the accessible name without taking layout space. */
  labelPlacement?: FieldLabelPlacement;
  /** Displays supporting text below the control. */
  description?: ReactNode;
  /** Displays a validation message and marks the field invalid. */
  error?: ReactNode;
  /** Displays content in the control when no time is selected. */
  placeholder?: ReactNode;
  /** Sets control spacing and text size. Defaults to `md`. */
  size?: TimePickerSize;
  /** Prevents opening the popup or changing the time. Defaults to `false`. */
  readOnly?: boolean;
  /** Announces required state; the hidden form field does not enforce browser validation. */
  required?: boolean;
  /** Replaces the clock glyph inside the control. */
  icon?: ReactNode;
  /** Passes props and `sx` to the field's parts. */
  slotProps?: TimePickerSlotProps;
  /** Replaces the elements rendering the field's parts. */
  slots?: TimePickerSlots;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MILLISECONDS_PER_MINUTE = 60_000;
const POPUP_BLOCK_LIMIT = '250px';
const DIAL_POPUP_BLOCK_LIMIT = '480px';
const DIAL_POPUP_INLINE_SIZE = '240px';
const DIAL_SIZE = 192;
const DEFAULT_VALUE = '09:00';
const VIEWPORT_PADDING = 8;
const ANCHOR_GAP = 8;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function minutes(time: string | undefined): number | undefined {
  if (time === undefined || !TIME_PATTERN.test(time)) return undefined;
  return Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3));
}
function canonical(time: number): string {
  return `${String(Math.floor(time / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(time % MINUTES_PER_HOUR).padStart(2, '0')}`;
}
const rootStyle = css({
  display: 'grid',
  gap: vars.space[1],
  inlineSize: '100%',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
});
const labelStyle = css({
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
});
const descriptionStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const errorStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.dangerText,
});
const controlStyle = css({
  minInlineSize: vars.space[12],
  inlineSize: '100%',
  gap: vars.space[2],
  '&[aria-invalid="true"]': { borderColor: vars.color.dangerText },
  [FORCED_COLORS]: {
    backgroundColor: 'Canvas',
    color: 'CanvasText',
    borderColor: 'CanvasText',
    '&:focus-visible': { outlineColor: 'Highlight' },
  },
});
const sizeStyles: Record<TimePickerSize, SerializedStyles> = {
  sm: css({
    minBlockSize: vars.space[8],
    paddingInline: vars.space[3],
    fontSize: vars.textSize.sm,
  }),
  md: css({
    minBlockSize: vars.space[10],
    paddingInline: vars.space[4],
    fontSize: vars.textSize.sm,
  }),
  lg: css({
    minBlockSize: vars.space[12],
    paddingInline: vars.space[4],
    fontSize: vars.textSize.md,
  }),
};
const valueStyle = css({
  flex: 1,
  minInlineSize: 0,
  textAlign: 'start',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '&[data-placeholder]': { color: vars.color.textMuted },
});
const contentStyle = css({
  inlineSize: 'var(--time-picker-inline-size)',
  minInlineSize: 0,
  maxInlineSize: 'calc(100vw - 16px)',
  maxBlockSize: `min(${POPUP_BLOCK_LIMIT}, var(--time-picker-available-height, ${POPUP_BLOCK_LIMIT}))`,
  overscrollBehavior: 'contain',
  [FORCED_COLORS]: {
    backgroundColor: 'Canvas',
    color: 'CanvasText',
    borderColor: 'CanvasText',
  },
});
const optionStyle = css({
  minBlockSize: vars.space[8],
  [FORCED_COLORS]: {
    '&[data-active]': { outlineColor: 'Highlight' },
    '&[aria-selected="true"]': { border: '1px solid Highlight' },
  },
});
const dialContentStyle = css({
  inlineSize: `max(${DIAL_POPUP_INLINE_SIZE}, var(--time-picker-inline-size))`,
  maxBlockSize: `min(${DIAL_POPUP_BLOCK_LIMIT}, var(--time-picker-available-height, ${DIAL_POPUP_BLOCK_LIMIT}))`,
  scrollPaddingBlockStart: `calc(${DIAL_SIZE}px + ${vars.space[3]} * 2)`,
});
const dialFrameStyle = css({
  position: 'sticky',
  insetBlockStart: 0,
  zIndex: 1,
  background: vars.color.surfaceRaised,
  paddingBlock: vars.space[3],
  [FORCED_COLORS]: { background: 'Canvas', color: 'CanvasText' },
});

const DIAL_LABEL_RADIUS = 76;
const DIAL_HAND_LENGTH = 60;
const FULL_TURN = 360;
const DIAL_SPRING = { type: 'spring', stiffness: 320, damping: 32 } as const;
const dialStyle = css({
  position: 'relative',
  inlineSize: DIAL_SIZE,
  blockSize: DIAL_SIZE,
  marginInline: 'auto',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceInset,
  color: vars.color.text,
  touchAction: 'none',
  userSelect: 'none',
  cursor: 'grab',
  flexShrink: 0,
  [FORCED_COLORS]: {
    background: 'Canvas',
    color: 'CanvasText',
    borderColor: 'CanvasText',
  },
});
const dialLabelStyle = css({
  position: 'absolute',
  top: '50%',
  left: '50%',
  fontSize: vars.textSize.xs,
  pointerEvents: 'none',
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const dialHandStyle = css({
  position: 'absolute',
  top: '50%',
  left: '50%',
  inlineSize: 2,
  blockSize: DIAL_HAND_LENGTH,
  marginBlockStart: -DIAL_HAND_LENGTH,
  background: vars.color.accentText,
  transformOrigin: '50% 100%',
  pointerEvents: 'none',
  [FORCED_COLORS]: {
    background: 'Highlight',
    forcedColorAdjust: 'none',
  },
});
const dialReadoutStyle = css({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: vars.color.surfaceInset,
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  [FORCED_COLORS]: { background: 'Canvas', color: 'CanvasText' },
});

type TimeOption = { time: number; value: string; label: string };
interface DialFaceProps {
  times: readonly TimeOption[];
  value: number | undefined;
  formatter: Intl.DateTimeFormat;
  onCommit: (value: string) => void;
  open: boolean;
}
function DialFace({ times, value, formatter, onCommit, open }: DialFaceProps) {
  const reduced = useReducedMotion();
  const [preview, setPreview] = useState<number>();
  const readout = preview ?? value;
  const rotation = useMotionValue((value ?? 0) / MINUTES_PER_DAY * FULL_TURN);
  const gesture = useRef<{ pointer: number; node: HTMLDivElement; destination?: string } | null>(null);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const restore = () => {
    setPreview(undefined);
    animation.current?.stop();
    const target = ((value ?? 0) / MINUTES_PER_DAY) * FULL_TURN;
    const nearestTurn = target + Math.round((rotation.get() - target) / FULL_TURN) * FULL_TURN;
    if (reduced) rotation.set(nearestTurn);
    else animation.current = animate(rotation, nearestTurn, DIAL_SPRING);
  };
  useEffect(() => {
    const active = gesture.current;
    gesture.current = null;
    if (active?.node.hasPointerCapture(active.pointer)) active.node.releasePointerCapture(active.pointer);
    restore();
    return () => {
      animation.current?.stop();
      const active = gesture.current;
      gesture.current = null;
      if (active?.node.hasPointerCapture(active.pointer)) active.node.releasePointerCapture(active.pointer);
    };
  }, [value, open, reduced]);
  const sample = (node: HTMLDivElement, x: number, y: number) => {
    const rect = node.getBoundingClientRect();
    const radians = Math.atan2(x - rect.left - rect.width / 2, -(y - rect.top - rect.height / 2));
    const angle = ((radians * 180) / Math.PI + FULL_TURN) % FULL_TURN;
    const time = (angle / FULL_TURN) * MINUTES_PER_DAY;
    const distance = (candidate: TimeOption) => {
      const difference = Math.abs(candidate.time - time);
      return Math.min(difference, MINUTES_PER_DAY - difference);
    };
    const destination = times.reduce<TimeOption | undefined>(
      (best, candidate) => !best || distance(candidate) < distance(best) ? candidate : best,
      undefined,
    );
    rotation.set(angle + Math.round((rotation.get() - angle) / FULL_TURN) * FULL_TURN);
    if (gesture.current) gesture.current.destination = destination?.value;
    setPreview(destination?.time);
  };
  const cancel = () => {
    gesture.current = null;
    restore();
  };
  return (
    <MotionConfig reducedMotion="user">
      <div
        aria-hidden="true"
        data-ui="time-picker-dial"
        css={dialStyle}
        onPointerDown={(event) => {
          if (event.button !== 0 || gesture.current || times.length === 0) return;
          event.preventDefault();
          animation.current?.stop();
          gesture.current = { pointer: event.pointerId, node: event.currentTarget };
          event.currentTarget.setPointerCapture(event.pointerId);
          sample(event.currentTarget, event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (gesture.current?.pointer === event.pointerId) sample(event.currentTarget, event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (gesture.current?.pointer !== event.pointerId) return;
          sample(event.currentTarget, event.clientX, event.clientY);
          const destination = gesture.current.destination;
          gesture.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          restore();
          if (destination !== undefined) onCommit(destination);
        }}
        onPointerCancel={(event) => { if (gesture.current?.pointer === event.pointerId) cancel(); }}
        onLostPointerCapture={(event) => { if (gesture.current?.pointer === event.pointerId) cancel(); }}
      >
        {[0, 6, 12, 18].map((hour) => {
          const radians = hour / 24 * Math.PI * 2;
          return (
            <span key={hour} css={dialLabelStyle}
              style={{ transform: `translate(-50%, -50%) translate(${Math.sin(radians) * DIAL_LABEL_RADIUS}px, ${-Math.cos(radians) * DIAL_LABEL_RADIUS}px)` }}>
              {formatter.format(new Date(hour * MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE))}
            </span>
          );
        })}
        <motion.span css={dialHandStyle} style={{ rotate: rotation }} />
        <span data-ui="time-picker-dial-readout" css={dialReadoutStyle}>
          {readout === undefined ? '' : formatter.format(new Date(readout * MILLISECONDS_PER_MINUTE))}
        </span>
      </div>
    </MotionConfig>
  );
}

export function TimePicker({
  ref,
  value: valueProp,
  defaultValue = DEFAULT_VALUE,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  minuteStep = 15,
  presentation = 'list',
  min,
  max,
  locale,
  hourCycle,
  label,
  labelPlacement = 'above',
  description,
  error,
  placeholder,
  size = 'md',
  disabled = false,
  readOnly = false,
  required = false,
  name,
  icon,
  slotProps,
  slots,
  className,
  sx,
  dir,
  id: idProp,
  onClick,
  onKeyDown,
  onBlur,
  ...rest
}: TimePickerProps) {
  const seed = useRef(defaultValue).current;
  const [value = '', requestValue, resetValue] = useControlledState(valueProp, seed, onValueChange);
  const [requestedOpen = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const effectiveDisabled = disabled || slotProps?.control?.disabled === true;
  const locked = effectiveDisabled || readOnly;
  const open = requestedOpen && !locked;
  const Root = slots?.root ?? 'div';
  const Label = slots?.label ?? 'label';
  const Control = slots?.control ?? Select.Trigger;
  const Content = slots?.content ?? Select.Content;
  const Option = slots?.option ?? Select.Item;
  const Description = slots?.description ?? 'span';
  const Error = slots?.error ?? 'span';
  const Icon = slots?.icon ?? 'span';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupNode, setPopupNode] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergeRefs([triggerRef, ref, slotProps?.control?.ref]);
  const mergedContentRef = useMergeRefs([setPopupNode, slotProps?.content?.ref]);
  const labelId = `${useId()}-label`;
  const formatter = useMemo(
    () =>
      dateTimeFormatter(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
        ...(hourCycle === undefined ? {} : { hourCycle }),
      }),
    [locale, hourCycle],
  );
  const lower = minutes(min);
  const upper = minutes(max);
  const invalidBounds =
    (min !== undefined && lower === undefined) ||
    (max !== undefined && upper === undefined) ||
    (lower !== undefined && upper !== undefined && lower > upper);
  const times = useMemo(
    () =>
      invalidBounds
        ? []
        : Array.from({ length: MINUTES_PER_DAY / minuteStep }, (_, index) => index * minuteStep)
            .filter((time) => time >= (lower ?? 0) && time <= (upper ?? MINUTES_PER_DAY - 1))
            .map((time) => ({
              time,
              value: canonical(time),
              label: formatter.format(new Date(time * MILLISECONDS_PER_MINUTE)),
            })),
    [minuteStep, lower, upper, invalidBounds, formatter],
  );
  const selectedMinutes = minutes(value);
  const initialActiveValue = selectedMinutes === undefined
    ? undefined
    : (times.find((time) => time.time >= selectedMinutes) ?? times.at(-1))?.value;
  const invalid = invalidBounds || (value !== '' && selectedMinutes === undefined);
  const control = slotProps?.control;
  const field = useFieldAnatomy({
    id: idProp ?? control?.id,
    description,
    error,
    'aria-describedby':
      [rest['aria-describedby'], control?.['aria-describedby']].filter(Boolean).join(' ') || undefined,
    'aria-invalid': invalid ? true : (rest['aria-invalid'] ?? control?.['aria-invalid']),
  });
  const labelledBy =
    [rest['aria-labelledby'], control?.['aria-labelledby'], isRenderable(label) && labelId]
      .filter(Boolean)
      .join(' ') || undefined;
  const display =
    selectedMinutes === undefined
      ? placeholder
      : formatter.format(new Date(selectedMinutes * MILLISECONDS_PER_MINUTE));

  useEffect(() => {
    const form = triggerRef.current?.form;
    if (!form) return;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        if (valueProp === undefined) resetValue();
        else requestValue(seed);
      });
    };
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [valueProp, requestValue, resetValue, seed, rest.form, control?.form]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const popup = popupNode;
    const view = trigger?.ownerDocument.defaultView;
    if (!trigger || !popup || !view) return;
    const measure = () => {
      const bounds = trigger.getBoundingClientRect();
      const available = Math.max(
        bounds.top - ANCHOR_GAP - VIEWPORT_PADDING,
        view.innerHeight - bounds.bottom - ANCHOR_GAP - VIEWPORT_PADDING,
      );
      popup.dir = view.getComputedStyle(trigger).direction;
      popup.style.setProperty('--time-picker-inline-size', `${bounds.width}px`);
      popup.style.setProperty(
        '--time-picker-available-height',
        `${Math.max(0, Math.min(available, view.innerHeight - 2 * VIEWPORT_PADDING))}px`,
      );
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(trigger);
    view.addEventListener('resize', measure);
    return () => {
      resize.disconnect();
      view.removeEventListener('resize', measure);
    };
  }, [open, popupNode, dir, control?.dir, slotProps?.root?.dir]);

  return (
    <WithSx
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ')}
      styles={[rootStyle, slotProps?.root?.sx]}
      sx={sx}
    >
      {(rootClassName) => (
        <Root
          {...withoutSx(slotProps?.root)}
          css={undefined}
          className={rootClassName}
          dir={dir ?? slotProps?.root?.dir}
          data-ui="time-picker"
        >
          {isRenderable(label) && (
            <Label
              {...withoutSx(slotProps?.label)}
              id={labelId}
              htmlFor={field.id}
              css={[labelStyle, labelPlacement === 'hidden' && visuallyHiddenStyle, slotProps?.label?.sx]}
            >
              {label}
              {required && (
                <span aria-hidden css={errorStyle}>
                  {' '}
                  *
                </span>
              )}
            </Label>
          )}
          <Select
            value={value}
            initialActiveValue={initialActiveValue}
            onValueChange={requestValue}
            open={open}
            onOpenChange={(next) => {
              if (!locked && (times.length > 0 || !next)) requestOpen(next);
            }}
            disabled={effectiveDisabled}
          >
            <Control
              {...withoutSx(control)}
              {...rest}
              ref={mergedRef}
              id={field.id}
              disabled={effectiveDisabled}
              dir={dir ?? control?.dir}
              aria-label={rest['aria-label'] ?? control?.['aria-label']}
              aria-labelledby={labelledBy}
              aria-describedby={field.describedBy}
              aria-invalid={field.ariaInvalid}
              aria-readonly={readOnly || rest['aria-readonly'] || control?.['aria-readonly']}
              aria-required={required || rest['aria-required'] || control?.['aria-required']}
              css={[controlStyle, sizeStyles[size], control?.sx]}
              onClick={undefined}
              onKeyDown={undefined}
              // Capture evaluates consumer vetoes before Select's interaction prop getters.
              onClickCapture={(event) => {
                control?.onClickCapture?.(event);
                rest.onClickCapture?.(event);
                control?.onClick?.(event);
                onClick?.(event);
                if (locked || times.length === 0) event.preventDefault();
                if (event.defaultPrevented) event.stopPropagation();
              }}
              onKeyDownCapture={(event) => {
                control?.onKeyDownCapture?.(event);
                rest.onKeyDownCapture?.(event);
                control?.onKeyDown?.(event);
                onKeyDown?.(event);
                if ((locked || times.length === 0) && event.key !== 'Tab') event.preventDefault();
                if (event.defaultPrevented) event.stopPropagation();
              }}
              onBlur={(event) => {
                control?.onBlur?.(event);
                onBlur?.(event);
              }}
            >
              {isRenderable(icon) && (
                <Icon {...withoutSx(slotProps?.icon)} aria-hidden css={[iconWrapperStyle, slotProps?.icon?.sx]}>
                  {icon}
                </Icon>
              )}
              <span css={valueStyle} data-placeholder={selectedMinutes === undefined || undefined}>
                {display}
              </span>
            </Control>
            <Content
              {...withoutSx(slotProps?.content)}
              ref={mergedContentRef}
              dir={dir}
              css={[contentStyle, presentation === 'dial' && dialContentStyle, slotProps?.content?.sx]}
            >
              {presentation === 'dial' && (
                <div data-time-dial-frame css={dialFrameStyle}>
                  <DialFace
                    times={times}
                    value={selectedMinutes}
                    formatter={formatter}
                    open={open}
                    onCommit={(next) => {
                      requestValue(next);
                      requestOpen(false);
                    }}
                  />
                </div>
              )}
              {times.map((time) => (
                <Option
                  {...withoutSx(slotProps?.option)}
                  key={time.value}
                  value={time.value}
                  data-time={time.value}
                  css={[optionStyle, slotProps?.option?.sx]}
                >
                  {time.label}
                </Option>
              ))}
            </Content>
          </Select>
          {name !== undefined && (
            <input
              type="hidden"
              name={name}
              value={value}
              disabled={effectiveDisabled}
              form={rest.form ?? control?.form}
            />
          )}
          {isRenderable(description) && (
            <Description
              {...withoutSx(slotProps?.description)}
              id={field.descriptionId}
              css={[descriptionStyle, slotProps?.description?.sx]}
            >
              {description}
            </Description>
          )}
          {isRenderable(error) && (
            <Error
              {...withoutSx(slotProps?.error)}
              id={field.errorId}
              role="alert"
              css={[errorStyle, slotProps?.error?.sx]}
            >
              {error}
            </Error>
          )}
        </Root>
      )}
    </WithSx>
  );
}
TimePicker.displayName = 'TimePicker';
