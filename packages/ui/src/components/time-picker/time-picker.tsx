'use client';

// Select-only combobox: Select owns virtual focus, wrapping arrows, Home/End, typeahead,
// Enter/Space selection, Escape and Tab dismissal. Values are civil HH:mm, not timestamps.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useFieldAnatomy } from '../field/field-anatomy';
import { Select } from '../select';

export type TimePickerSize = 'sm' | 'md' | 'lg';
export type TimePickerMinuteStep = 1 | 5 | 10 | 15 | 30;
export type TimePickerHourCycle = 'h12' | 'h23';
type Slot<Tag extends 'div' | 'span' | 'label' | 'button'> = Omit<ComponentPropsWithRef<Tag>, 'children'> & {
  css?: Interpolation<Theme>;
};
export interface TimePickerSlotProps {
  root?: Slot<'div'>;
  label?: Slot<'label'>;
  control?: Slot<'button'>;
  content?: Slot<'div'>;
  option?: Slot<'div'>;
  description?: Slot<'span'>;
  error?: Slot<'span'>;
  icon?: Slot<'span'>;
}
export interface TimePickerProps
  extends
    Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'onChange' | 'size' | 'children'>,
    SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (time: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  minuteStep?: TimePickerMinuteStep;
  min?: string;
  max?: string;
  /** Supply a locale so server and client text match. */
  locale?: string;
  hourCycle?: TimePickerHourCycle;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  placeholder?: ReactNode;
  size?: TimePickerSize;
  readOnly?: boolean;
  /** Announces required state; the hidden form field does not enforce browser validation. */
  required?: boolean;
  icon?: ReactNode;
  slotProps?: TimePickerSlotProps;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MILLISECONDS_PER_MINUTE = 60_000;
const POPUP_BLOCK_LIMIT = '250px';
const DEFAULT_VALUE = '09:00';
const VIEWPORT_PADDING = 8;
const ANCHOR_GAP = 8;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const defaultLocale = () => (typeof navigator === 'undefined' ? undefined : navigator.language);
function minutes(time: string | undefined): number | undefined {
  if (time === undefined || !TIME_PATTERN.test(time)) return undefined;
  return Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3));
}
function canonical(time: number): string {
  return `${String(Math.floor(time / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(time % MINUTES_PER_HOUR).padStart(2, '0')}`;
}
function keepOptionVisible(option: HTMLElement, popup: HTMLElement) {
  if (option.offsetTop < popup.scrollTop) popup.scrollTop = option.offsetTop;
  else if (option.offsetTop + option.offsetHeight > popup.scrollTop + popup.clientHeight)
    popup.scrollTop = option.offsetTop + option.offsetHeight - popup.clientHeight;
}
const rootStyle = css({
  display: 'grid',
  gap: vars.space[1],
  inlineSize: '100%',
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

export function TimePicker({
  ref,
  value: valueProp,
  defaultValue = DEFAULT_VALUE,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  minuteStep = 15,
  min,
  max,
  locale,
  hourCycle,
  label,
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [popupNode, setPopupNode] = useState<HTMLDivElement | null>(null);
  const openedByTypeaheadRef = useRef(false);
  const mergedRef = useMergeRefs([triggerRef, ref, slotProps?.control?.ref]);
  const mergedContentRef = useMergeRefs([contentRef, setPopupNode, slotProps?.content?.ref]);
  const labelId = `${useId()}-label`;
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale ?? defaultLocale(), {
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
    let centered = false;
    const scrollActive = () => {
      const active = popup.querySelector<HTMLElement>('[data-active]');
      if (!active) return;
      const top = active.offsetTop;
      if (!centered) {
        popup.scrollTop = top - (popup.clientHeight - active.offsetHeight) / 2;
        centered = true;
      } else keepOptionVisible(active, popup);
    };
    const observer = new MutationObserver(scrollActive);
    observer.observe(popup, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-active'],
    });
    // Select's public option hover interaction seeds virtual focus for a valid non-option value.
    // This does not commit or alter aria-selected; subsequent navigation belongs to Select.
    const frame = view.requestAnimationFrame(() => {
      if (
        !openedByTypeaheadRef.current &&
        selectedMinutes !== undefined &&
        !times.some((time) => time.value === value)
      ) {
        const following = times.find((time) => time.time >= selectedMinutes) ?? times.at(-1);
        const option = following && popup.querySelector<HTMLElement>(`[data-time="${following.value}"]`);
        option?.dispatchEvent(new view.MouseEvent('mousemove', { bubbles: true }));
      }
      scrollActive();
    });
    return () => {
      resize.disconnect();
      observer.disconnect();
      view.removeEventListener('resize', measure);
      view.cancelAnimationFrame(frame);
    };
  }, [open, popupNode, selectedMinutes, times, value, dir, control?.dir, slotProps?.root?.dir]);

  return (
    <WithSx
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ')}
      styles={[rootStyle, slotProps?.root?.css]}
      sx={sx}
    >
      {(rootClassName) => (
        <div
          {...slotProps?.root}
          css={undefined}
          className={rootClassName}
          dir={dir ?? slotProps?.root?.dir}
          data-ui="time-picker"
        >
          {isRenderable(label) && (
            <label
              {...slotProps?.label}
              id={labelId}
              htmlFor={field.id}
              css={[labelStyle, slotProps?.label?.css]}
            >
              {label}
              {required && (
                <span aria-hidden css={errorStyle}>
                  {' '}
                  *
                </span>
              )}
            </label>
          )}
          <Select
            value={value}
            onValueChange={requestValue}
            open={open}
            onOpenChange={(next) => {
              if (!locked && (times.length > 0 || !next)) requestOpen(next);
            }}
            disabled={effectiveDisabled}
          >
            <Select.Trigger
              {...control}
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
              css={[controlStyle, sizeStyles[size], control?.css]}
              onClick={undefined}
              onKeyDown={undefined}
              // Capture evaluates consumer vetoes before Select's interaction prop getters.
              onClickCapture={(event) => {
                control?.onClickCapture?.(event);
                rest.onClickCapture?.(event);
                control?.onClick?.(event);
                onClick?.(event);
                if (!open) openedByTypeaheadRef.current = false;
                if (locked || times.length === 0) event.preventDefault();
                if (event.defaultPrevented) event.stopPropagation();
              }}
              onKeyDownCapture={(event) => {
                control?.onKeyDownCapture?.(event);
                rest.onKeyDownCapture?.(event);
                control?.onKeyDown?.(event);
                onKeyDown?.(event);
                if (!open)
                  openedByTypeaheadRef.current =
                    event.key.length === 1 &&
                    event.key !== ' ' &&
                    !event.ctrlKey &&
                    !event.altKey &&
                    !event.metaKey;
                if ((locked || times.length === 0) && event.key !== 'Tab') event.preventDefault();
                if (event.defaultPrevented) event.stopPropagation();
              }}
              onBlur={(event) => {
                control?.onBlur?.(event);
                onBlur?.(event);
              }}
            >
              {isRenderable(icon) && (
                <span {...slotProps?.icon} aria-hidden css={[iconWrapperStyle, slotProps?.icon?.css]}>
                  {icon}
                </span>
              )}
              <span css={valueStyle} data-placeholder={selectedMinutes === undefined || undefined}>
                {display}
              </span>
              <span aria-hidden>▾</span>
            </Select.Trigger>
            <Select.Content
              {...slotProps?.content}
              ref={mergedContentRef}
              dir={dir}
              css={[contentStyle, slotProps?.content?.css]}
            >
              {times.map((time) => (
                <Select.Item
                  {...slotProps?.option}
                  key={time.value}
                  value={time.value}
                  data-time={time.value}
                  css={[optionStyle, slotProps?.option?.css]}
                  ref={(node) => {
                    const consumerRef = slotProps?.option?.ref;
                    const cleanup = typeof consumerRef === 'function' ? consumerRef(node) : undefined;
                    if (consumerRef && typeof consumerRef !== 'function') consumerRef.current = node;
                    if (!node) return cleanup;
                    const original = node.scrollIntoView;
                    // Limit Select's navigation scrolling to this list; never move the page.
                    node.scrollIntoView = () => {
                      const popup = contentRef.current;
                      if (!popup) return;
                      keepOptionVisible(node, popup);
                    };
                    return () => {
                      node.scrollIntoView = original;
                      if (typeof cleanup === 'function') cleanup();
                      else if (typeof consumerRef === 'function') consumerRef(null);
                      else if (consumerRef) consumerRef.current = null;
                    };
                  }}
                >
                  {time.label}
                </Select.Item>
              ))}
            </Select.Content>
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
            <span
              {...slotProps?.description}
              id={field.descriptionId}
              css={[descriptionStyle, slotProps?.description?.css]}
            >
              {description}
            </span>
          )}
          {isRenderable(error) && (
            <span
              {...slotProps?.error}
              id={field.errorId}
              role="alert"
              css={[errorStyle, slotProps?.error?.css]}
            >
              {error}
            </span>
          )}
        </div>
      )}
    </WithSx>
  );
}
TimePicker.displayName = 'TimePicker';
