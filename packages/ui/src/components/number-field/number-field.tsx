'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentPropsWithRef, type PointerEvent, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { FieldDescription, FieldError, FieldLabel, fieldColumnStyle, useFieldAnatomy } from '../field/field-anatomy';
import { FieldSlot, type FieldParts, type FieldSlots } from '../field/field-slot';
import { createNumberFieldValue, NumberFieldConfigError, type NumberFieldFormatOptions } from './number-field-value';

export type NumberFieldSize = 'sm' | 'md' | 'lg';
export interface NumberFieldMessages {
  increment: (label: string) => string;
  decrement: (label: string) => string;
  empty: string;
  minimum: (value: string) => string;
  maximum: (value: string) => string;
  range: (min: string, max: string) => string;
  invalid: string;
  required: string;
}
type Anatomy = {
  root: 'div'; label: 'label'; shell: 'div'; control: 'input'; decrement: 'button'; increment: 'button';
  prefix: 'span'; suffix: 'span'; range: 'span'; description: 'span'; error: 'span'; status: 'span';
};
export type NumberFieldSlots = FieldSlots<Anatomy>;
export type NumberFieldSlotProps = FieldParts<Anatomy>;
export interface NumberFieldProps extends Omit<ComponentPropsWithRef<'input'>,
  'type' | 'size' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'children' | 'prefix'>, SxProps {
  /** Committed amount. `null` is empty; `undefined` selects uncontrolled state. */
  value?: number | null;
  /** Initial uncontrolled amount. Defaults to `0`. */
  defaultValue?: number | null;
  /** Receives changed commit requests, not partial typing. */
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: NumberFieldSize;
  locale?: Intl.LocalesArgument;
  formatOptions?: NumberFieldFormatOptions;
  prefix?: ReactNode | ((value: number | null) => ReactNode);
  suffix?: ReactNode | ((value: number | null) => ReactNode);
  formatValueText?: (value: number | null, formatted: string) => string;
  repeat?: boolean;
  messages?: Partial<NumberFieldMessages>;
  incrementLabel?: string;
  decrementLabel?: string;
  incrementIcon?: ReactNode;
  decrementIcon?: ReactNode;
  component?: NumberFieldSlots['root'];
  slots?: NumberFieldSlots;
  slotProps?: NumberFieldSlotProps;
}

const DEFAULT_MESSAGES: NumberFieldMessages = {
  increment: (label) => label ? `Increase ${label}` : 'Increase value',
  decrement: (label) => label ? `Decrease ${label}` : 'Decrease value',
  empty: 'Empty',
  minimum: (value) => `Minimum: ${value}`,
  maximum: (value) => `Maximum: ${value}`,
  range: (min, max) => `Range: ${min} to ${max}`,
  invalid: 'Enter a valid number. The draft has not been accepted.',
  required: 'Enter a number.',
};
const HOLD = { delay: 400, interval: 150, acceleration: 20, floor: 40 } as const;
const rootStyles: Record<NumberFieldSize, SerializedStyles> = {
  sm: css({ inlineSize: `calc(${vars.space[10]} * 4)` }),
  md: css({ inlineSize: `calc(${vars.space[12]} * 4)` }),
  lg: css({ inlineSize: `calc(${vars.space[8]} * 7)` }),
};
const shellSizes: Record<NumberFieldSize, SerializedStyles> = {
  sm: css({ minBlockSize: vars.space[8], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: vars.space[10], fontSize: vars.textSize.sm }),
  lg: css({ minBlockSize: vars.space[12], fontSize: vars.textSize.md }),
};
const shellStyle = css({
  display: 'flex', alignItems: 'center', flexWrap: 'wrap', borderRadius: vars.radius.sm,
  gap: vars.space[1], paddingInline: vars.space[1],
  '&[data-invalid]': { borderColor: vars.color.dangerText },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
const controlStyle = css({
  flex: '1 1 0', minInlineSize: vars.space[8], inlineSize: 0, minBlockSize: `calc(${vars.space[8]} - 2px)`,
  padding: 0, border: 0, borderRadius: 0, background: 'transparent', color: 'inherit',
  font: 'inherit', lineHeight: vars.lineHeight.base, fontVariantNumeric: 'tabular-nums', textAlign: 'center',
  '&:focus-visible': focusRingInset,
  '@media (pointer: coarse)': { fontSize: vars.textSize.md },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const stepperStyle = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  inlineSize: vars.space[6], minBlockSize: vars.space[6], padding: 0, border: 0,
  borderRadius: vars.radius.sm, background: 'transparent', color: vars.color.text,
  fontFamily: vars.font.sans, fontSize: vars.textSize.md, cursor: 'pointer', touchAction: 'none',
  transitionProperty: 'background-color, color', transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not([aria-disabled="true"])': { backgroundColor: vars.color.surfaceHover },
  '&[aria-disabled="true"]': { color: vars.color.textMuted, cursor: 'not-allowed' },
  '&:focus-visible': focusRingInset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { color: 'ButtonText', '&[aria-disabled="true"]': { color: 'GrayText' } },
});
const largeStepperStyle = css({ inlineSize: vars.space[8], minBlockSize: vars.space[8] });
const affixStyle = css({ color: vars.color.textMuted, fontSize: 'inherit', overflowWrap: 'anywhere' });
const messageStyle = css({ fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.base, color: vars.color.textMuted });
const statusStyle = css({ fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.base, color: vars.color.warning });
const glyphStyle = css({ inlineSize: vars.space[4], blockSize: vars.space[4] });

function StepIcon({ increment }: { increment: boolean }) {
  return <svg css={glyphStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10" />{increment && <path d="M8 3v10" />}</svg>;
}

/** Enter an exact quantity, or change it with the arrow keys and stepper buttons. */
export function NumberField({
  value: valueProp, defaultValue = 0, onValueChange, min = 0, max = Number.MAX_SAFE_INTEGER,
  step = 1, largeStep, label, description, error, size = 'md', locale,
  formatOptions, prefix, suffix, formatValueText, repeat = true, messages: messageOverrides,
  incrementLabel, decrementLabel, incrementIcon, decrementIcon, component, slots, slotProps,
  className, sx, ref, dir, name, form, required, disabled, readOnly, id, onChange, onBlur, onKeyDown,
  onCompositionStart, onCompositionEnd, 'aria-describedby': externalDescription,
  'aria-labelledby': externalLabel, 'aria-invalid': externalInvalid, ...native
}: NumberFieldProps) {
  const initialDefault = useRef(defaultValue);
  const [state, requestChange, reset] = useControlledState(valueProp, initialDefault.current, onValueChange);
  const current = state ?? null;
  const model = useMemo(() => createNumberFieldValue({ min, max, step, largeStep, value: current, defaultValue, locale, formatOptions }),
    [min, max, step, largeStep, current, defaultValue, locale, formatOptions]);
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides };
  const [draft, setDraft] = useState<string | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [status, setStatus] = useState('');
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const mergedRef = useMergeRefs([input, ref]);
  const hold = useRef<{ window: Window; timer: number; target: HTMLButtonElement; pointerId: number } | null>(null);
  const suppressClick = useRef(false);
  const outOfBounds = current !== null && (current < min || current > max);
  const internalError = draftError ? (draft === '' && required ? messages.required : messages.invalid)
    : outOfBounds ? messages.range(model.format(min), model.format(max)) : null;
  const displayedError = internalError ?? error;
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const rangeId = `${generatedId}-range`;
  const field = useFieldAnatomy({ id, description, error: displayedError,
    'aria-describedby': [externalDescription, rangeId].filter(Boolean).join(' '), 'aria-invalid': externalInvalid });
  const labelText = typeof label === 'string' || typeof label === 'number' ? String(label) : native['aria-label'] ?? '';
  if (isRenderable(label) && typeof label !== 'string' && typeof label !== 'number' && (!incrementLabel || !decrementLabel))
    throw new NumberFieldConfigError('Non-text labels require incrementLabel and decrementLabel.');
  const unavailable = disabled || readOnly;
  const stopHold = useCallback(() => {
    const active = hold.current;
    hold.current = null;
    if (!active) return;
    active.window.clearTimeout(active.timer);
    if (active.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
  }, []);

  useEffect(() => stopHold, [stopHold]);
  useEffect(() => {
    const ownerWindow = input.current?.ownerDocument.defaultView;
    ownerWindow?.addEventListener('blur', stopHold);
    return () => ownerWindow?.removeEventListener('blur', stopHold);
  }, [stopHold]);
  useEffect(() => { if (unavailable || !repeat) stopHold(); }, [unavailable, repeat, stopHold]);
  useEffect(() => {
    input.current?.setCustomValidity(internalError ?? (isRenderable(error)
      ? typeof error === 'string' || typeof error === 'number' ? String(error) : messages.invalid : ''));
  }, [internalError, error, messages.invalid]);
  useEffect(() => {
    const element = input.current;
    const ownerForm = element?.form;
    if (!ownerForm) return;
    const onReset = (event: Event) => {
      element.ownerDocument.defaultView?.queueMicrotask(() => {
        if (event.defaultPrevented) return;
        stopHold();
        if (valueProp !== undefined) return;
        reset();
        setDraft(null);
        setDraftError(false);
        setStatus('');
      });
    };
    ownerForm.addEventListener('reset', onReset);
    return () => ownerForm.removeEventListener('reset', onReset);
  }, [form, valueProp, reset, stopHold]);

  const resolveDraft = (): { valid: true; value: number | null } | { valid: false } => {
    if (draft === null) {
      if (current === null && required) {
        setDraft('');
        setDraftError(true);
        return { valid: false };
      }
      return { valid: true, value: current };
    }
    if (draft.trim() === '') {
      if (!required) return { valid: true, value: null };
    } else {
      const parsed = model.parse(draft);
      if (Number.isFinite(parsed))
        return { valid: true, value: model.snap(parsed) };
    }
    setDraftError(true);
    return { valid: false };
  };
  const acceptRequest = (next: number | null) => {
    requestChange(next);
    setDraft(null);
    setDraftError(false);
    setStatus('');
  };
  const commit = () => {
    if (unavailable || composing.current) return;
    const resolved = resolveDraft();
    if (resolved.valid) acceptRequest(resolved.value);
  };
  const move = (direction: 1 | -1, distance = step) => {
    if (unavailable || composing.current) return false;
    const resolved = resolveDraft();
    if (!resolved.valid) return false;
    const next = model.move(resolved.value, direction, distance);
    acceptRequest(next);
    const atLimit = direction === 1 ? next >= max : next <= min;
    if (atLimit) setStatus(direction === 1 ? messages.maximum(model.format(max)) : messages.minimum(model.format(min)));
    return !atLimit;
  };
  const atBound = (direction: 1 | -1) => current !== null && (direction === 1 ? current >= max : current <= min);
  const stepButton = (direction: 1 | -1) => {
    if (unavailable || composing.current) return false;
    if (!atBound(direction)) return move(direction);
    setStatus(direction === 1 ? messages.maximum(model.format(max)) : messages.minimum(model.format(min)));
    return false;
  };
  const repeatMove = useLatestCallback((direction: 1 | -1) => {
    if (!move(direction)) stopHold();
  });
  const beginHold = (event: PointerEvent<HTMLButtonElement>, direction: 1 | -1) => {
    if (event.defaultPrevented || event.button !== 0 || unavailable || composing.current) return;
    event.preventDefault();
    stopHold();
    suppressClick.current = true;
    const keepGoing = stepButton(direction);
    if (!repeat || !keepGoing) return;
    const target = event.currentTarget;
    const ownerWindow = target.ownerDocument.defaultView;
    if (!ownerWindow) return;
    target.setPointerCapture(event.pointerId);
    let interval: number = HOLD.interval;
    const tick = () => {
      repeatMove(direction);
      if (!hold.current) return;
      hold.current.timer = ownerWindow.setTimeout(tick, interval);
      interval = Math.max(HOLD.floor, interval - HOLD.acceleration);
    };
    hold.current = { window: ownerWindow, target, pointerId: event.pointerId, timer: ownerWindow.setTimeout(tick, HOLD.delay) };
  };

  const affix = (content: NumberFieldProps['prefix']) => typeof content === 'function' ? content(current) : content;
  const prefixNode = affix(prefix);
  const suffixNode = affix(suffix);
  const numericAria: Record<`aria-${string}`, string | undefined> = {
    'aria-valuemin': model.serialize(min),
    'aria-valuemax': model.serialize(max),
    'aria-valuenow': current === null ? undefined : model.serialize(current),
  };
  const renderStepper = (part: 'increment' | 'decrement', direction: 1 | -1, icon: ReactNode, text: string) => (
    <FieldSlot element="button" component={slots?.[part]} slotProps={slotProps?.[part]} styles={[stepperStyle, size !== 'sm' && largeStepperStyle]}
      type="button" disabled={disabled} aria-disabled={unavailable || atBound(direction) || undefined}
      aria-label={text} aria-controls={field.id}
      onPointerDown={(event) => beginHold(event, direction)} onPointerUp={stopHold} onPointerCancel={stopHold} onLostPointerCapture={stopHold}
      onBlur={stopHold} onKeyDown={() => { suppressClick.current = false; }}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        if (suppressClick.current) { suppressClick.current = false; return; }
        stepButton(direction);
      }}
    ><span aria-hidden="true">{icon}</span></FieldSlot>
  );

  return (
    <FieldSlot element="div" root component={slots?.root ?? component} slotProps={slotProps?.root}
      styles={[fieldColumnStyle, rootStyles[size]]} className={className} sx={sx} dir={dir} data-ui="number-field"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) stopHold(); }}>
      <FieldLabel component={slots?.label} id={labelId} htmlFor={field.id} required={required} part={slotProps?.label}>{label}</FieldLabel>
      <FieldSlot element="div" component={slots?.shell} slotProps={slotProps?.shell}
        styles={[inputControlStyle, shellStyle, shellSizes[size]]} data-disabled={disabled ? '' : undefined} data-invalid={isRenderable(displayedError) ? '' : undefined}>
        {renderStepper('decrement', -1, decrementIcon ?? <StepIcon increment={false} />, decrementLabel ?? messages.decrement(labelText))}
        {isRenderable(prefixNode) && <FieldSlot element="span" component={slots?.prefix} slotProps={slotProps?.prefix} styles={affixStyle} aria-hidden="true">{prefixNode}</FieldSlot>}
        <FieldSlot element="input" component={slots?.control} slotProps={slotProps?.control} {...native}
          styles={controlStyle} ref={mergedRef} type="text" role="spinbutton" inputMode="decimal" id={field.id} dir={dir}
          name={undefined} form={form} required={required} disabled={disabled} readOnly={readOnly}
          value={draft ?? model.format(current)} {...numericAria}
          aria-valuetext={formatValueText?.(current, model.format(current)) ?? (current === null ? messages.empty : model.format(current))}
          aria-labelledby={[externalLabel, isRenderable(label) && labelId].filter(Boolean).join(' ') || undefined}
          aria-describedby={field.describedBy} aria-invalid={field.ariaInvalid}
          onChange={(event) => {
            onChange?.(event);
            if (unavailable) return;
            setDraft(event.currentTarget.value);
            if (!composing.current && !model.isPartial(event.currentTarget.value)) setDraftError(true);
            else setDraftError(false);
            setStatus('');
          }}
          onBlur={(event) => { onBlur?.(event); stopHold(); if (!event.defaultPrevented) commit(); }}
          onCompositionStart={(event) => { composing.current = true; onCompositionStart?.(event); }}
          onCompositionEnd={(event) => { composing.current = false; onCompositionEnd?.(event); }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || composing.current || event.nativeEvent.isComposing || unavailable) return;
            const directions: Record<string, 1 | -1> = { ArrowUp: 1, ArrowDown: -1, PageUp: 1, PageDown: -1 };
            const direction = directions[event.key];
            if (direction) {
              event.preventDefault();
              move(direction, event.shiftKey || event.key.startsWith('Page') ? model.largeStep : step);
            } else if ((event.key === 'Home' || event.key === 'End') && draft === null) {
              event.preventDefault(); acceptRequest(event.key === 'Home' ? min : max);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (draft === null) event.currentTarget.select(); else commit();
            } else if (event.key === 'Escape' && draft !== null) {
              event.preventDefault(); setDraft(null); setDraftError(false); setStatus('');
            }
          }} />
        {isRenderable(suffixNode) && <FieldSlot element="span" component={slots?.suffix} slotProps={slotProps?.suffix} styles={affixStyle} aria-hidden="true">{suffixNode}</FieldSlot>}
        {renderStepper('increment', 1, incrementIcon ?? <StepIcon increment />, incrementLabel ?? messages.increment(labelText))}
      </FieldSlot>
      <FieldSlot element="span" component={slots?.range} slotProps={slotProps?.range} styles={messageStyle} id={rangeId}>{messages.range(model.format(min), model.format(max))}</FieldSlot>
      <FieldDescription component={slots?.description} part={slotProps?.description} id={field.descriptionId}>{description}</FieldDescription>
      <FieldError component={slots?.error} part={slotProps?.error} id={field.errorId}>{displayedError}</FieldError>
      <FieldSlot element="span" component={slots?.status} slotProps={slotProps?.status} styles={statusStyle} role="status" aria-live="polite" aria-atomic="true">{status}</FieldSlot>
      {name !== undefined && <input type="hidden" name={name} form={form} disabled={disabled} value={current === null ? '' : model.serialize(current)} />}
    </FieldSlot>
  );
}

NumberField.displayName = 'NumberField';
