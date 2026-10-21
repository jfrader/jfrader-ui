'use client';

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
import { css } from '../../styling/css';
import { withoutSx, type SxProps } from '../../styling/sx';
import { inputControlStyle } from '../../styling/input-control';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useControlledState } from '../../utils/use-controlled-state';
import { useFormReset } from '../../utils/use-form-reset';
import { isRenderable } from '../../utils/renderable';
import {
  FieldRoot,
  FieldLabel,
  FieldDescription,
  FieldError,
  useFieldAnatomy,
} from '../field/field-anatomy';
import type { FieldParts } from '../field/field-slot';
import { Select } from '../select';
import { addMinor, assertDecimals, assertMinor, currencyChoices, moneyFormat, MONEY_LIMIT } from './money-math';

export interface MoneyInputDetails<C extends string = string> {
  currency: C;
  /** Display amount in major units; store the callback's integer minor units instead. */
  major: number | null;
  formatted: string;
}

export interface MoneyInputMessages {
  currencyName: (name: string) => string;
  empty: string;
  range: (min: string, max: string) => string;
  min: (min: string) => string;
  max: (max: string) => string;
  invalid: string;
  add: (amount: string) => string;
  quickAdd: string;
  changed: (amount: string) => string;
}

const defaultMessages: MoneyInputMessages = {
  currencyName: (name) => `Currency: ${name}`,
  empty: 'Enter an amount.',
  range: (min, max) => `Amount from ${min} to ${max}.`,
  min: (min) => `Enter at least ${min}.`,
  max: (max) => `Enter no more than ${max}.`,
  invalid: 'Enter a valid amount in this currency and locale.',
  add: (amount) => `Add ${amount}`,
  quickAdd: 'Quick add',
  changed: (amount) => `Amount: ${amount}`,
};

type MoneyInputAnatomy = {
  root: 'div'; label: 'label'; shell: 'div'; control: 'input'; currency: 'span';
  quickAdd: 'div'; quickAddButton: 'button'; range: 'span'; description: 'span'; error: 'span'; status: 'span';
};

export type MoneyInputSlotProps = FieldParts<MoneyInputAnatomy>;

export interface MoneyInputProps<C extends string = string>
  extends
    Omit<
      ComponentPropsWithRef<'input'>,
      'type' | 'size' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'children'
    >,
    SxProps {
  /** Integer minor units; `null` is controlled empty. */
  value?: number | null;
  /** Sets the initial amount in integer minor units. Defaults to `null` (empty). */
  defaultValue?: number | null;
  /** Receives the amount in integer minor units, or `null`, with currency and display details. */
  onValueChange?: (value: number | null, details: MoneyInputDetails<C>) => void;
  /** Controls the selected currency. Must be included in `currencies`. */
  currency?: NoInfer<C>;
  /** Sets the initial currency. Defaults to the first entry in `currencies`. */
  defaultCurrency?: NoInfer<C>;
  /** Receives the selected currency code. Changing currency preserves minor units. */
  onCurrencyChange?: (currency: C) => void;
  /** Controls whether the currency selector is open. */
  currencyOpen?: boolean;
  /** Opens the uncontrolled currency selector initially. Defaults to `false`. */
  defaultCurrencyOpen?: boolean;
  /** Receives changes to the currency selector's open state. */
  onCurrencyOpenChange?: (open: boolean) => void;
  /** Unique ISO currency codes, or free-form asset codes when `decimals` is set. Changing currency preserves minor units. */
  currencies: readonly C[];
  /** Use non-ISO base units with this precision. Must be an integer from 0 to 18. */
  decimals?: number;
  /** Prefix for non-ISO amounts; defaults to the currency code. */
  symbol?: string;
  /** Inclusive integer minor-unit lower bound. @default 0 */
  min?: number;
  /** Inclusive integer minor-unit upper bound. @default 999999999999 */
  max?: number;
  /** Positive integer minor-unit increment; defaults to one major unit for ISO currencies, one base unit for non-ISO assets. */
  step?: number;
  /** Positive integer minor-unit increments. */
  quickAdd?: readonly number[];
  /** Selects amount formatting, parsing and currency-name locale. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Chooses the ISO currency's display notation. Defaults to `symbol`. */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  /** Names the amount field with a linked label. */
  label?: ReactNode;
  /** Adds supporting text associated with the amount field. */
  description?: ReactNode;
  /** Displays an error instead of the generated validation message. */
  error?: ReactNode;
  /** Visually hides the label while retaining its accessible name. Defaults to `false`. */
  hideLabel?: boolean;
  /** Chooses the standard or enlarged amount presentation. Defaults to `standard`. */
  variant?: 'standard' | 'prominent';
  /** Sets the control height and text size. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Overrides validation, currency and quick-add messages. Defaults to English. */
  messages?: Partial<MoneyInputMessages>;
  /** Passes props and style overrides to named field parts. */
  slotProps?: MoneyInputSlotProps;
}

const rootStyle = css({ minInlineSize: 0, fontFamily: vars.font.sans });
const shellStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  minInlineSize: 0,
  paddingInline: vars.space[3],
  '&[data-variant="prominent"]': { blockSize: `calc(${vars.space[10]} * 2)` },
});
const controlStyle = css({
  minInlineSize: 0,
  flex: 1,
  inlineSize: 0,
  blockSize: '100%',
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  lineHeight: vars.lineHeight.base,
  fontVariantNumeric: 'tabular-nums',
  '&:focus-visible': { outline: 'none' },
  '&[data-variant="prominent"]': {
    fontSize: vars.textSize['2xl'],
    borderRadius: vars.radius.md,
  },
  '@media (pointer: coarse)': { fontSize: vars.textSize.md },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});
const sizes = {
  sm: css({ blockSize: vars.space[8], fontSize: vars.textSize.sm }),
  md: css({ blockSize: vars.space[10], fontSize: vars.textSize.md }),
  lg: css({ blockSize: vars.space[12], fontSize: vars.textSize.xl }),
};
const currencyStyle = css({
  color: vars.color.text,
  fontSize: vars.textSize.sm,
  unicodeBidi: 'isolate',
  flexShrink: 0,
  minInlineSize: 0,
  maxInlineSize: '45%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const currencyTriggerStyle = {
  minInlineSize: 0,
  maxInlineSize: '100%',
  alignSelf: 'stretch',
  border: 0,
  borderRadius: 0,
  backgroundColor: 'transparent',
  borderInlineStart: `1px solid ${vars.color.borderControl}`,
  paddingInline: vars.space[3],
  gap: vars.space[1],
  '&:focus-visible': { outline: 'none' },
} as const;
const currencyCodeStyle = css({ minInlineSize: 0, overflow: 'hidden', textOverflow: 'ellipsis' });
const stepDirections: Readonly<Record<string, number>> = {
  ArrowUp: 1,
  ArrowDown: -1,
  PageUp: 10,
  PageDown: -10,
};
const quickAddStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });
const chipStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
  minBlockSize: vars.space[8],
  paddingInline: vars.space[3],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not([aria-disabled="true"])': { backgroundColor: vars.color.surfaceHover },
  '&:focus-visible': focusRingOutset,
  '&[aria-disabled="true"]': { cursor: 'not-allowed' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});
const rangeStyle = css({ fontSize: vars.textSize.sm, color: vars.color.textMuted, overflowWrap: 'anywhere' });

export function MoneyInput<C extends string = string>({
  ref,
  value,
  defaultValue = null,
  onValueChange,
  currency,
  defaultCurrency,
  onCurrencyChange,
  currencyOpen,
  defaultCurrencyOpen = false,
  onCurrencyOpenChange,
  currencies,
  decimals,
  symbol,
  min = 0,
  max = MONEY_LIMIT,
  step,
  quickAdd = [],
  locale,
  currencyDisplay = 'symbol',
  label,
  description,
  error,
  hideLabel = false,
  variant = 'standard',
  size = 'md',
  messages: messageOverrides,
  slotProps,
  className,
  sx,
  dir,
  id,
  name,
  form,
  disabled,
  readOnly,
  required,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  'aria-describedby': describedBy,
  'aria-labelledby': labelledBy,
  'aria-invalid': ariaInvalid,
  style,
  title,
  ...native
}: MoneyInputProps<C>) {
  assertDecimals(decimals);
  useMemo(() => currencyChoices(currencies, decimals), [currencies, decimals]);
  const [code, requestCurrency, resetCurrency] = useControlledState(
    currency,
    defaultCurrency ?? currencies[0],
    onCurrencyChange,
  );
  if (!code || !currencies.includes(code))
    throw new RangeError('MoneyInput: currency must be in currencies.');
  const money = useMemo(() => moneyFormat(locale, code, currencyDisplay, decimals, symbol), [locale, code, currencyDisplay, decimals, symbol]);
  const messages = { ...defaultMessages, ...messageOverrides };
  const [amount, requestAmount, resetAmount] = useControlledState<number | null>(
    value,
    defaultValue,
    (next) => {
      onValueChange?.(next, {
        currency: code,
        major: next === null ? null : money.major(next),
        formatted: next === null ? '' : money.format(next),
      });
    },
  );
  const current = amount ?? null;
  const increment = step ?? (decimals === undefined ? money.factor : 1);
  assertMinor(min, 'min');
  assertMinor(max, 'max');
  if (min > max) throw new RangeError('MoneyInput: min must not exceed max.');
  assertMinor(increment, 'step', true);
  quickAdd.forEach((add) => assertMinor(add, 'quickAdd', true));
  if (current !== null) assertMinor(current, 'value');
  if (defaultValue !== null) assertMinor(defaultValue, 'defaultValue');
  const [edit, setEdit] = useState<{ currency: string; text: string } | null>(null);
  const draft = edit?.currency === code ? edit.text : null;
  const [failure, setFailure] = useState<{ currency: string; message: string } | null>(null);
  const [status, setStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inputRef = useMergeRefs([input, ref]);
  const composing = useRef(false);
  const previousCode = useRef(code);
  useEffect(() => {
    if (previousCode.current !== code) {
      previousCode.current = code;
      setEdit(null);
      setFailure(null);
      setStatus(messages.currencyName(names?.of(code) ?? code));
    }
  });
  const selection = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  const rangeId = useId();
  const labelId = useId();
  const ownError = failure?.currency === code ? failure.message : undefined;
  const requiredError = required && current === null && draft === null ? messages.empty : undefined;
  const rangeError =
    current !== null && (current < min || current > max) && draft === null
      ? current < min
        ? messages.min(money.format(min))
        : messages.max(money.format(max))
      : undefined;
  const validation = ownError ?? requiredError ?? rangeError;
  const fieldError = isRenderable(error) ? error : validation;
  const field = useFieldAnatomy({
    id,
    description,
    error: fieldError,
    'aria-describedby': [describedBy, rangeId].filter(Boolean).join(' '),
    'aria-invalid': ariaInvalid,
  });
  useEffect(() => {
    input.current?.setCustomValidity(validation ?? (isRenderable(error) ? String(error) : ''));
  }, [validation, error]);
  useFormReset(
    input,
    () => {
      resetAmount();
      resetCurrency();
      setEdit(null);
      setFailure(null);
      setStatus('');
    },
    form,
  );
  const names = useMemo(
    () =>
      decimals === undefined && typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames(money.locale, { type: 'currency' })
        : null,
    [money.locale, decimals],
  );
  const fail = (message: string) => setFailure({ currency: code, message });
  const settle = () => {
    if (composing.current) return;
    if (draft !== null) {
      const parsed = money.parse(draft);
      if (parsed.kind === 'partial' || parsed.kind === 'invalid') {
        fail(messages.invalid);
        return;
      }
      if (parsed.kind === 'value' && parsed.value < min) {
        fail(messages.min(money.format(min)));
        return;
      }
    }
    setEdit(null);
    setFailure(null);
  };
  const adjust = (delta: number) => {
    if (disabled || readOnly || composing.current) return;
    const parsed = draft === null ? null : money.parse(draft);
    if (parsed?.kind === 'invalid' || parsed?.kind === 'partial') {
      fail(messages.invalid);
      return;
    }
    const base = parsed?.kind === 'value' ? parsed.value : (current ?? 0);
    const next = addMinor(base, delta, min, max);
    requestAmount(next);
    setEdit(null);
    setFailure(null);
    setStatus(
      next === current
        ? delta > 0
          ? messages.max(money.format(max))
          : messages.min(money.format(min))
        : messages.changed(money.format(next)),
    );
  };
  const numericAria: Record<`aria-${string}`, string | number | undefined> = {
    'aria-valuenow': current === null ? undefined : decimals === undefined ? money.major(current) : money.serialize(current),
    'aria-valuemin': decimals === undefined ? money.major(min) : money.serialize(min),
    'aria-valuemax': decimals === undefined ? money.major(max) : money.serialize(max),
  };
  return (
    <FieldRoot
      data-ui="money-input"
      dir={dir}
      className={className}
      sx={sx}
      style={style}
      title={title}
      part={{ ...slotProps?.root, sx: [rootStyle, slotProps?.root?.sx] }}
    >
      <FieldLabel
        id={labelId}
        htmlFor={field.id}
        required={required}
        hidden={hideLabel}
        part={slotProps?.label}
      >
        {label}
      </FieldLabel>
      <div {...withoutSx(slotProps?.shell)} data-variant={variant} data-disabled={disabled ? '' : undefined} data-invalid={field.ariaInvalid === true ? '' : undefined} css={[inputControlStyle, shellStyle, sizes[size], slotProps?.shell?.sx]}>
        <input
          {...native}
          {...withoutSx(slotProps?.control)}
          ref={inputRef}
          id={field.id}
          form={form}
          type="text"
          role="spinbutton"
          inputMode="decimal"
          required={required}
          readOnly={readOnly}
          disabled={disabled}
          data-variant={variant}
          css={[controlStyle, slotProps?.control?.sx]}
          value={draft ?? (current === null ? '' : money.format(current))}
          {...numericAria}
          aria-valuetext={current === null ? messages.empty : money.format(current)}
          aria-invalid={field.ariaInvalid}
          aria-describedby={field.describedBy}
          aria-labelledby={
            [labelledBy, isRenderable(label) && labelId].filter(Boolean).join(' ') || undefined
          }
          onSelect={(event) => {
            selection.current = {
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            };
            native.onSelect?.(event);
          }}
          onFocus={(event) => {
            if (!readOnly && !disabled)
              setEdit({ currency: code, text: current === null ? '' : money.draft(current) });
            onFocus?.(event);
          }}
          onBlur={(event) => {
            if (!readOnly && !disabled) settle();
            onBlur?.(event);
          }}
          onChange={(event) => {
            onChange?.(event);
            if (disabled || readOnly) return;
            const text = event.currentTarget.value;
            if (composing.current) {
              setEdit({ currency: code, text });
              return;
            }
            const parsed = money.parse(text);
            if (
              parsed.kind === 'invalid' ||
              (parsed.kind === 'value' && (parsed.value > max || (parsed.value < 0 && min >= 0)))
            ) {
              fail(
                parsed.kind === 'value' && parsed.value > max
                  ? messages.max(money.format(max))
                  : messages.invalid,
              );
              event.currentTarget.value = draft ?? (current === null ? '' : money.draft(current));
              event.currentTarget.setSelectionRange(selection.current.start, selection.current.end);
              return;
            }
            setEdit({ currency: code, text });
            setFailure(null);
            if (parsed.kind === 'empty') requestAmount(null);
            if (parsed.kind === 'value' && parsed.value >= min) requestAmount(parsed.value);
          }}
          onCompositionStart={(event) => {
            composing.current = true;
            onCompositionStart?.(event);
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            const parsed = money.parse(event.currentTarget.value);
            if (parsed.kind === 'value' && parsed.value >= min && parsed.value <= max) {
              requestAmount(parsed.value);
              setFailure(null);
            } else if (parsed.kind === 'empty') requestAmount(null);
            else if (parsed.kind !== 'partial') fail(messages.invalid);
            onCompositionEnd?.(event);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (
              event.defaultPrevented ||
              event.nativeEvent.isComposing ||
              composing.current ||
              disabled ||
              readOnly
            )
              return;
            const direction = stepDirections[event.key];
            if (direction) {
              event.preventDefault();
              adjust(direction * increment * (event.shiftKey && Math.abs(direction) === 1 ? 10 : 1));
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              settle();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setEdit(null);
              setFailure(null);
            }
          }}
        />
        <span {...withoutSx(slotProps?.currency)} css={[currencyStyle, slotProps?.currency?.sx]}>
          {currencies.length === 1 ? (
            code
          ) : (
            <Select
              value={code}
              onValueChange={(next) => {
                // The Select options are exactly `currencies` (C), so an emitted string is a C.
                if (!readOnly && !disabled) requestCurrency(next as C);
              }}
              open={currencyOpen}
              defaultOpen={defaultCurrencyOpen}
              onOpenChange={onCurrencyOpenChange}
              disabled={disabled || readOnly}
            >
              <Select.Trigger
                size={size}
                sx={currencyTriggerStyle}
                aria-label={messages.currencyName(names?.of(code) ?? code)}
              >
                <span css={currencyCodeStyle}>{code}</span>
              </Select.Trigger>
              <Select.Content>
                {currencies.map((choice) => (
                  <Select.Item key={choice} value={choice} textValue={names?.of(choice) ?? choice}>
                    {names?.of(choice) ?? choice} ({choice})
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          )}
        </span>
      </div>
      {quickAdd.length > 0 && (
        <div
          {...withoutSx(slotProps?.quickAdd)}
          role="group"
          aria-label={messages.quickAdd}
          css={[quickAddStyle, slotProps?.quickAdd?.sx]}
        >
          {quickAdd.map((add, index) => (
            <button
              {...withoutSx(slotProps?.quickAddButton)}
              key={`${add}-${index}`}
              type="button"
              disabled={disabled}
              aria-disabled={readOnly || (current !== null && current >= max)}
              aria-label={messages.add(money.format(add))}
              aria-controls={field.id}
              css={[chipStyle, slotProps?.quickAddButton?.sx]}
              onClick={() => {
                if (disabled || readOnly || composing.current) return;
                if (current !== null && current >= max) setStatus(messages.max(money.format(max)));
                else adjust(add);
              }}
            >
              {messages.add(money.format(add))}
            </button>
          ))}
        </div>
      )}
      <span {...withoutSx(slotProps?.range)} id={rangeId} css={[rangeStyle, slotProps?.range?.sx]}>
        {messages.range(money.format(min), money.format(max))}
      </span>
      <FieldDescription id={field.descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError id={field.errorId} part={slotProps?.error}>
        {fieldError}
      </FieldError>
      <span
        {...withoutSx(slotProps?.status)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        css={[visuallyHiddenStyle, slotProps?.status?.sx]}
      >
        {status}
      </span>
      <input type="hidden" name={name} form={form} disabled={disabled} value={current ?? ''} />
    </FieldRoot>
  );
}

MoneyInput.displayName = 'MoneyInput';
