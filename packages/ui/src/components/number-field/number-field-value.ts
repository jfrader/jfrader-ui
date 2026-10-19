import { NumberParser } from '@internationalized/number';
import Decimal from 'decimal.js';

const Exact = Decimal.clone({ precision: 48, rounding: Decimal.ROUND_HALF_CEIL });
const MAX_FRACTION_DIGITS = 12;
const PARSER_FRACTION_DIGITS = 20;
const LARGE_STEP_MULTIPLIER = 10;

export type NumberFieldFormatOptions = Pick<
  Intl.NumberFormatOptions,
  'useGrouping' | 'minimumIntegerDigits' | 'minimumFractionDigits' | 'maximumFractionDigits' | 'unit' | 'unitDisplay' | 'signDisplay' | 'numberingSystem'
> & { style?: 'decimal' | 'unit' };

export class NumberFieldConfigError extends Error {
  constructor(message: string) {
    super(`NumberField: ${message}`);
    this.name = 'NumberFieldConfigError';
  }
}

function validateNumber(name: string, value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
    throw new NumberFieldConfigError(`${name} must be finite with magnitude at most Number.MAX_SAFE_INTEGER.`);
  if (new Exact(value).decimalPlaces() > MAX_FRACTION_DIGITS)
    throw new NumberFieldConfigError(`${name} supports at most ${MAX_FRACTION_DIGITS} fraction digits.`);
}

export function createNumberFieldValue({
  min, max, step, largeStep: configuredLargeStep, value, defaultValue, locale, formatOptions,
}: {
  min: number;
  max: number;
  step: number;
  largeStep?: number;
  value: number | null | undefined;
  defaultValue: number | null;
  locale?: Intl.LocalesArgument;
  formatOptions?: NumberFieldFormatOptions;
}) {
  const largeStep = configuredLargeStep ?? new Exact(step).mul(LARGE_STEP_MULTIPLIER).toNumber();
  for (const [name, number] of Object.entries({ min, max, step, largeStep, value, defaultValue })) {
    if (number !== null && number !== undefined) validateNumber(name, number);
  }
  if (min > max) throw new NumberFieldConfigError('min must not exceed max.');
  if (step <= 0 || largeStep <= 0) throw new NumberFieldConfigError('step and largeStep must be positive.');
  const precision = Math.max(...[step, min, max].map((number) => new Exact(number).decimalPlaces()));
  const options: Intl.NumberFormatOptions = {
    maximumFractionDigits: Math.max(precision, value == null ? 0 : new Exact(value).decimalPlaces()),
    ...formatOptions,
  };
  if (options.style && options.style !== 'decimal' && options.style !== 'unit')
    throw new NumberFieldConfigError('formatOptions.style must be decimal or unit.');
  for (const key of ['currency', 'notation', 'minimumSignificantDigits', 'maximumSignificantDigits']) {
    if (formatOptions && Reflect.has(formatOptions, key))
      throw new NumberFieldConfigError(`formatOptions.${key} is not supported.`);
  }
  for (const digits of [options.minimumFractionDigits, options.maximumFractionDigits]) {
    if (digits !== undefined && (!Number.isInteger(digits) || digits < 0 || digits > MAX_FRACTION_DIGITS))
      throw new NumberFieldConfigError(`formatOptions supports at most ${MAX_FRACTION_DIGITS} fraction digits.`);
  }
  if (options.minimumFractionDigits !== undefined && formatOptions?.maximumFractionDigits === undefined)
    options.maximumFractionDigits = Math.max(options.maximumFractionDigits ?? 0, options.minimumFractionDigits);
  try {
    const formatter = new Intl.NumberFormat(locale, options);
    const parser = new NumberParser(formatter.resolvedOptions().locale, {
      ...options, minimumFractionDigits: 0, maximumFractionDigits: PARSER_FRACTION_DIGITS,
    });
    const clamp = (number: Decimal) => Exact.min(max, Exact.max(min, number));
    const snap = (number: number) => clamp(
      new Exact(number).minus(min).div(step).toDecimalPlaces(0, Exact.ROUND_HALF_CEIL).mul(step).plus(min),
    ).toNumber();
    return {
      largeStep,
      serialize: (number: number) => new Exact(number).toFixed(),
      format: (number: number | null) => number === null ? '' : formatter.format(number),
      parse(text: string) {
        if (!parser.isValidPartialNumber(text)) return NaN;
        return parser.parse(text);
      },
      isPartial: (text: string) => parser.isValidPartialNumber(text),
      snap,
      move(number: number | null, direction: 1 | -1, distance: number) {
        const start = number === null ? Exact.min(max, Exact.max(min, 0)) : new Exact(number);
        const position = start.minus(min).div(step);
        const onGrid = position.isInteger();
        const next = onGrid
          ? start.plus(new Exact(distance).mul(direction))
          : position.toDecimalPlaces(0, direction === 1 ? Exact.ROUND_CEIL : Exact.ROUND_FLOOR).mul(step).plus(min)
            .plus(Exact.max(0, new Exact(distance).minus(step)).mul(direction));
        return clamp(next).toNumber();
      },
    };
  } catch (error) {
    throw new NumberFieldConfigError(error instanceof Error ? error.message : 'Invalid locale or format options.');
  }
}
