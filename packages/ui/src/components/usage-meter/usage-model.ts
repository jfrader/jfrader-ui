// Amount-against-allowance model shared by UsageMeter and ActivityRings: one place decides
// validity, state thresholds and Intl formatting for "value of max".

export type UsageMeterState = 'normal' | 'near-limit' | 'over-limit' | 'unavailable';
export interface UsageMeterSummary {
  total: number;
  limit: number;
  free: number;
  over: number;
  ratio: number;
  state: UsageMeterState;
  formattedTotal: string;
  formattedLimit: string;
  formattedPercent: string;
}

export const DEFAULT_WARN_AT = 0.9;

export interface UsageFormats {
  amount: Intl.NumberFormat;
  percent: Intl.NumberFormat;
  index: Intl.NumberFormat;
}

export function createUsageFormats(
  locale: Intl.LocalesArgument,
  numberFormatOptions?: Intl.NumberFormatOptions,
): UsageFormats {
  return {
    amount: new Intl.NumberFormat(locale, { maximumFractionDigits: 1, ...numberFormatOptions }),
    percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    index: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
  };
}

interface SummarizeOptions {
  warnAt?: number;
  formats: UsageFormats;
  /** Text for amounts that cannot be computed. */
  unavailable: string;
  /** Formats amounts instead of `formats.amount` (consumer unit formatters). */
  formatAmount?: (amount: number) => string;
}

/** Summarizes `total` against `limit`; nonpositive or nonfinite limits are `unavailable`. */
export function summarizeUsage(
  total: number,
  limit: number,
  { warnAt = DEFAULT_WARN_AT, formats, unavailable, formatAmount }: SummarizeOptions,
): UsageMeterSummary {
  const format = formatAmount ?? ((amount: number) => formats.amount.format(amount));
  const valid =
    Number.isFinite(limit) && limit > 0 && Number.isFinite(total) && Number.isFinite(total / limit);
  const threshold = Number.isFinite(warnAt) ? Math.min(1, Math.max(0, warnAt)) : DEFAULT_WARN_AT;
  const state: UsageMeterState = !valid
    ? 'unavailable'
    : total > limit
      ? 'over-limit'
      : total >= threshold * limit
        ? 'near-limit'
        : 'normal';
  return {
    total,
    limit,
    free: valid ? Math.max(0, limit - total) : 0,
    over: valid ? Math.max(0, total - limit) : 0,
    ratio: valid ? total / limit : 0,
    state,
    formattedTotal: Number.isFinite(total) ? format(total) : unavailable,
    formattedLimit: valid ? format(limit) : unavailable,
    formattedPercent: valid ? formats.percent.format(total / limit) : unavailable,
  };
}
