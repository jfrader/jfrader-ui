export const paymentPhases = ['authorize', 'approve', 'clear', 'fee', 'payout'] as const;
export type PaymentFlowPhase = (typeof paymentPhases)[number];
export const PAYMENT_CYCLE_MS = 15_000;
export const PAYMENT_PHASE_MS = PAYMENT_CYCLE_MS / paymentPhases.length;
export const paymentNodeKeys = ['terminal', 'processor', 'network', 'issuer', 'merchant'] as const;
export type PaymentFlowNodeKey = (typeof paymentNodeKeys)[number];
export const paymentPhaseActor: Record<PaymentFlowPhase, PaymentFlowNodeKey> = {
  authorize: 'terminal',
  approve: 'issuer',
  clear: 'processor',
  fee: 'processor',
  payout: 'merchant',
};
const currencies = new Set(Intl.supportedValuesOf('currency'));

export function paymentAmounts(
  amount: number,
  fee: number,
  balance: number,
  currency: string,
  locale?: Intl.LocalesArgument,
) {
  try {
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    if (!currencies.has(formatter.resolvedOptions().currency!)) return null;
    const factor = 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
    const minor = [amount, fee, balance].map((value) => Math.round(value * factor));
    if (
      ![amount, fee, balance].every((value) => Number.isFinite(value) && value >= 0) ||
      fee > amount ||
      !minor.every(Number.isSafeInteger)
    )
      return null;
    const [charge, deduction, initial] = minor;
    const net = charge! - deduction!;
    const final = initial! + net;
    if (!Number.isSafeInteger(final)) return null;
    return {
      gross: formatter.format(charge! / factor),
      fee: formatter.format(deduction! / factor),
      net: formatter.format(net / factor),
      initial: formatter.format(initial! / factor),
      final: formatter.format(final / factor),
    };
  } catch {
    return null;
  }
}
