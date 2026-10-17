'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { useControlledState } from '../../utils/use-controlled-state';
import {
  FieldSlot,
  type FieldParts,
  type FieldSlots,
} from '../field/field-slot';
import { PasswordField, type PasswordFieldProps } from '../password-field';

export interface PasswordRule {
  id: string;
  label: ReactNode;
  test: (password: string) => boolean;
  remaining?: (password: string) => number;
}
export interface PasswordStrengthResult {
  level: 0 | 1 | 2 | 3 | 4;
  short: boolean;
  met: readonly string[];
  total: number;
}
export interface PasswordStrengthOptions {
  shortLength?: number;
  countCharacters?: (password: string) => number;
}
export interface PasswordStrengthMessages {
  levels: {
    tooShort: string;
    weak: string;
    fair: string;
    good: string;
    strong: string;
  };
  meterLabel: string;
  empty: string;
  rulesLabel: string;
  ruleMet: string;
  ruleNotMet: string;
  remaining: (counts: { count: number; formattedCount: string }) => string;
  summary: (counts: {
    label: string;
    met: number;
    total: number;
    formattedMet: string;
    formattedTotal: string;
  }) => string;
}
export type PasswordStrengthMessagesInput = Partial<
  Omit<PasswordStrengthMessages, 'levels'>
> & {
  levels?: Partial<PasswordStrengthMessages['levels']>;
};
const DEFAULT_MESSAGES: PasswordStrengthMessages = {
  levels: {
    tooShort: 'Too short',
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
  },
  meterLabel: 'Password policy compliance',
  empty: 'Enter a password',
  rulesLabel: 'Password requirements',
  ruleMet: 'Met',
  ruleNotMet: 'Not met',
  remaining: ({ formattedCount }) => `${formattedCount} remaining`,
  summary: ({ label, formattedMet, formattedTotal }) =>
    `${label}. ${formattedMet} of ${formattedTotal} requirements met.`,
};
type Anatomy = {
  root: 'div';
  meterRow: 'div';
  meter: 'div';
  segment: 'span';
  strengthLabel: 'span';
  rules: 'ul';
  rule: 'li';
  mark: 'span';
  remaining: 'span';
};
export type PasswordStrengthSlotProps = FieldParts<Anatomy>;
export type PasswordStrengthSlots = FieldSlots<Anatomy>;
export interface PasswordStrengthProps
  extends
    Omit<
      PasswordFieldProps,
      'onValueChange' | 'slotProps' | 'slots' | 'component' | 'messages'
    >,
    PasswordStrengthOptions {
  rules: readonly PasswordRule[];
  onValueChange?: (password: string, result: PasswordStrengthResult) => void;
  locale?: Intl.LocalesArgument;
  messages?: PasswordStrengthMessagesInput;
  fieldMessages?: PasswordFieldProps['messages'];
  fieldSlotProps?: PasswordFieldProps['slotProps'];
  fieldSlots?: PasswordFieldProps['slots'];
  component?: PasswordStrengthSlots['root'];
  slots?: PasswordStrengthSlots;
  slotProps?: PasswordStrengthSlotProps;
}

const countCodePoints = (password: string) => Array.from(password).length;
export function estimatePasswordStrength(
  password: string,
  rules: readonly PasswordRule[],
  {
    shortLength = 0,
    countCharacters = countCodePoints,
  }: PasswordStrengthOptions = {},
): PasswordStrengthResult {
  if (!Number.isInteger(shortLength) || shortLength < 0)
    throw new Error('shortLength must be a nonnegative integer');
  const ids = rules.map((rule) => rule.id);
  if (
    !ids.length ||
    ids.some((id) => !id.trim()) ||
    new Set(ids).size !== ids.length
  )
    throw new Error(
      'Password rules require unique, nonempty IDs and at least one rule',
    );
  const met =
    password === ''
      ? []
      : rules.filter((rule) => rule.test(password)).map((rule) => rule.id);
  const short = password !== '' && countCharacters(password) < shortLength;
  const level =
    password === ''
      ? 0
      : short
        ? 1
        : Math.max(1, Math.min(4, Math.round((met.length / rules.length) * 4)));
  return {
    level: level as PasswordStrengthResult['level'],
    short,
    met,
    total: rules.length,
  };
}

const rootStyle = css({
  display: 'grid',
  gap: vars.space[3],
  inlineSize: '100%',
  minInlineSize: 0,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
});
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: vars.space[2],
});
const meterStyle = css({
  display: 'flex',
  gap: vars.space[1],
  flex: '1 1 50%',
  minInlineSize: 0,
});
const segmentStyle = css({
  flex: 1,
  blockSize: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceInset,
  transition: `background-color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '&[data-filled="true"]': { backgroundColor: vars.color.accent },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    '&[data-filled="true"]': { backgroundColor: 'Highlight' },
  },
});
const listStyle = css({
  display: 'grid',
  gap: vars.space[2],
  margin: 0,
  padding: 0,
  listStyle: 'none',
});
const ruleStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: vars.space[2],
  overflowWrap: 'anywhere',
});
const markStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  inlineSize: vars.space[4],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
});
const mutedStyle = css({ color: vars.color.textMuted });

export function PasswordStrength({
  ref,
  rules,
  shortLength = 0,
  countCharacters,
  value,
  defaultValue = '',
  onValueChange,
  locale,
  messages: overrides,
  fieldMessages,
  fieldSlotProps,
  fieldSlots,
  slots,
  slotProps,
  component,
  className,
  sx,
  dir,
  form,
  'aria-describedby': describedBy,
  autoComplete = 'new-password',
  // PasswordField already owns autoCapitalize/spellCheck; overriding them here duplicated its wiring.
  ...fieldProps
}: PasswordStrengthProps) {
  const initialValue = useRef(defaultValue).current;
  const [current = '', request, reset] = useControlledState(
    value,
    initialValue,
    (next) =>
      onValueChange?.(
        next,
        estimatePasswordStrength(next, rules, { shortLength, countCharacters }),
      ),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergeRefs([inputRef, ref]);
  const rulesId = useId();
  const result = estimatePasswordStrength(current, rules, {
    shortLength,
    countCharacters,
  });
  const messages = {
    ...DEFAULT_MESSAGES,
    ...overrides,
    levels: { ...DEFAULT_MESSAGES.levels, ...overrides?.levels },
  };
  const labels = [
    messages.empty,
    messages.levels.weak,
    messages.levels.fair,
    messages.levels.good,
    messages.levels.strong,
  ];
  const label = result.short ? messages.levels.tooShort : labels[result.level]!;
  const numbers = new Intl.NumberFormat(locale);
  const summary = messages.summary({
    label,
    met: result.met.length,
    total: result.total,
    formattedMet: numbers.format(result.met.length),
    formattedTotal: numbers.format(result.total),
  });
  useEffect(() => {
    const owner = inputRef.current?.form;
    if (!owner) return;
    const onReset = (event: Event) =>
      queueMicrotask(() => {
        if (!event.defaultPrevented) reset();
      });
    owner.addEventListener('reset', onReset);
    return () => owner.removeEventListener('reset', onReset);
  }, [form, reset]);
  return (
    <FieldSlot
      element="div"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      root
      styles={rootStyle}
      sx={sx}
      className={className}
      dir={dir}
      data-ui="password-strength"
      data-level={result.level}
    >
      <PasswordField
        {...fieldProps}
        form={form}
        dir={dir}
        ref={mergedRef}
        value={current}
        onValueChange={request}
        autoComplete={autoComplete}
        messages={fieldMessages}
        slots={fieldSlots}
        slotProps={fieldSlotProps}
        aria-describedby={[describedBy, rulesId].filter(Boolean).join(' ')}
      />
      <FieldSlot
        element="div"
        component={slots?.meterRow}
        slotProps={slotProps?.meterRow}
        styles={rowStyle}
      >
        <FieldSlot
          element="div"
          component={slots?.meter}
          slotProps={slotProps?.meter}
          styles={meterStyle}
          role="meter"
          aria-label={messages.meterLabel}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={result.level}
          aria-valuetext={label}
        >
          {[1, 2, 3, 4].map((segment) => (
            <FieldSlot
              key={segment}
              element="span"
              component={slots?.segment}
              slotProps={slotProps?.segment}
              styles={segmentStyle}
              aria-hidden="true"
              data-filled={segment <= result.level}
            />
          ))}
        </FieldSlot>
        <FieldSlot
          element="span"
          component={slots?.strengthLabel}
          slotProps={slotProps?.strengthLabel}
        >
          {label}
        </FieldSlot>
      </FieldSlot>
      <FieldSlot
        element="ul"
        component={slots?.rules}
        slotProps={slotProps?.rules}
        styles={listStyle}
        id={rulesId}
        aria-label={messages.rulesLabel}
      >
        {rules.map((rule) => {
          const met = result.met.includes(rule.id);
          const remaining = rule.remaining?.(current);
          return (
            <FieldSlot
              key={rule.id}
              element="li"
              component={slots?.rule}
              slotProps={slotProps?.rule}
              styles={ruleStyle}
              data-met={met}
            >
              <FieldSlot
                element="span"
                component={slots?.mark}
                slotProps={slotProps?.mark}
                styles={markStyle}
                aria-hidden="true"
              >
                {met ? '✓' : '−'}
              </FieldSlot>
              <span>{rule.label}</span>
              <span>{met ? messages.ruleMet : messages.ruleNotMet}</span>
              {remaining !== undefined && remaining > 0 && (
                <FieldSlot
                  element="span"
                  component={slots?.remaining}
                  slotProps={slotProps?.remaining}
                  styles={mutedStyle}
                >
                  {messages.remaining({
                    count: remaining,
                    formattedCount: numbers.format(remaining),
                  })}
                </FieldSlot>
              )}
            </FieldSlot>
          );
        })}
      </FieldSlot>
      <span role="status" aria-atomic="true">
        {summary}
      </span>
    </FieldSlot>
  );
}
PasswordStrength.displayName = 'PasswordStrength';
