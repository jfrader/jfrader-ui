import { NumberParser } from '@internationalized/number';
import Decimal from 'decimal.js';

export const MONEY_LIMIT = 999_999_999_999;
const Exact = Decimal.clone({ precision: 40 });

export function assertMinor(value: number, name: string, positive = false) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MONEY_LIMIT || (positive && value <= 0)) {
    throw new RangeError(
      `MoneyInput: ${name} must be ${positive ? 'a positive' : 'an'} integer minor-unit amount within ±${MONEY_LIMIT}.`,
    );
  }
}

export function assertDecimals(decimals: number | undefined) {
  if (decimals !== undefined && (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)) {
    throw new RangeError('MoneyInput: decimals must be an integer from 0 to 18.');
  }
}

export function currencyChoices(currencies: readonly string[], decimals?: number) {
  assertDecimals(decimals);
  if (decimals !== undefined) {
    if (!currencies.length || currencies.some((code) => !code.trim()) || new Set(currencies).size !== currencies.length)
      throw new RangeError('MoneyInput: currencies must contain at least one unique currency code.');
    return;
  }
  if (typeof Intl.supportedValuesOf !== 'function') {
    throw new Error('MoneyInput requires Intl.supportedValuesOf currency support.');
  }
  const supported = new Set(Intl.supportedValuesOf('currency'));
  if (!currencies.length || new Set(currencies).size !== currencies.length) {
    throw new RangeError('MoneyInput: currencies must contain at least one unique currency code.');
  }
  for (const code of currencies) {
    if (!supported.has(code)) throw new RangeError(`MoneyInput: unsupported currency ${code}.`);
  }
}

const normalize = (text: string) =>
  text
    .replace(/[\u061c\u200e\u200f]/g, '')
    .replace(/\s/g, ' ')
    .trim();

export function moneyFormat(
  locale: Intl.LocalesArgument | undefined,
  currency: string,
  currencyDisplay: Intl.NumberFormatOptions['currencyDisplay'],
  decimals?: number,
  symbol = currency,
) {
  assertDecimals(decimals);
  const formatOptions: Intl.NumberFormatOptions = decimals === undefined
    ? { style: 'currency', currency, currencyDisplay }
    : { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: decimals, useGrouping: true };
  const formatter = new Intl.NumberFormat(locale, formatOptions);
  const resolved = formatter.resolvedOptions();
  const digits = resolved.maximumFractionDigits ?? 0;
  if (decimals === undefined && digits > 3) throw new RangeError('MoneyInput supports currencies with zero to three fraction digits.');
  const factor = 10 ** digits;
  const parser = new NumberParser(resolved.locale, {
    ...formatOptions,
    maximumFractionDigits: 20,
  });
  const decimal = new Intl.NumberFormat(resolved.locale, { useGrouping: false, maximumFractionDigits: 20 });
  const decimalMark = decimal.formatToParts(1.1).find((part) => part.type === 'decimal')?.value;
  const group = new Intl.NumberFormat(resolved.locale)
    .formatToParts(10000)
    .find((part) => part.type === 'group')?.value;
  const withSymbol = (text: string) => decimals === undefined ? text : `${symbol}${text}`;
  const format = (minor: number) => withSymbol(formatter.format(new Exact(minor).div(factor).toNumber()));
  const major = (minor: number) => new Exact(minor).div(factor).toNumber();
  const parse = (
    text: string,
  ): { kind: 'empty' | 'partial' | 'invalid' } | { kind: 'value'; value: number } => {
    if (!text.trim()) return { kind: 'empty' };
    if (decimals !== undefined) {
      text = text.trim();
      if (symbol && text.startsWith(symbol)) text = text.slice(symbol.length).trim();
    }
    const parsed = parser.parse(text);
    if (
      parser.isValidPartialNumber(text) &&
      (!Number.isFinite(parsed) || (decimalMark && text.endsWith(decimalMark)))
    )
      return { kind: 'partial' };
    if (!Number.isFinite(parsed) || /[()]/.test(text)) return { kind: 'invalid' };
    if (group && text.includes(group)) {
      const numberingSystem = parser.getNumberingSystem(text);
      const options = { numberingSystem, maximumFractionDigits: 20 };
      const grouped = new Intl.NumberFormat(resolved.locale, options).format(parsed);
      const groupedCurrency = new Intl.NumberFormat(resolved.locale, {
        ...formatOptions,
        ...options,
      }).format(parsed);
      if (![grouped, groupedCurrency].some((candidate) => normalize(candidate) === normalize(text)))
        return { kind: 'invalid' };
    }
    const minor = new Exact(String(parsed)).times(factor);
    if (!minor.isInteger() || minor.abs().gt(MONEY_LIMIT)) return { kind: 'invalid' };
    return { kind: 'value', value: minor.toNumber() };
  };
  return {
    format,
    major,
    serialize: (minor: number) => new Exact(minor).div(factor).toFixed(),
    parse,
    draft: (minor: number) => decimal.format(major(minor)),
    factor,
    locale: resolved.locale,
  };
}

export function addMinor(value: number, delta: number, min: number, max: number) {
  return Exact.min(max, Exact.max(min, new Exact(value).plus(delta))).toNumber();
}
