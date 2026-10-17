export interface ControlCenterValue {
  focus: { mode: string; minutes: number; until: string; allowedPeople: string[] } | null;
  notifications: boolean;
  presenting: boolean;
  channels: Record<string, boolean>;
  volume: number;
  textSize: number;
}

export const controlCenterLimits = {
  minutes: { min: 5, max: 120, step: 5, largeStep: 15 },
  volume: { min: 0, max: 100, step: 1, largeStep: 4 },
  textSize: { min: 85, max: 130, step: 5, largeStep: 20 },
} as const;

export function focusSession(draft: Omit<NonNullable<ControlCenterValue['focus']>, 'until'>) {
  const MINUTE_MS = 60_000;
  return { ...draft, until: new Date(Date.now() + draft.minutes * MINUTE_MS).toISOString() };
}

export function bounded(value: number, axis: keyof typeof controlCenterLimits, fallback: number) {
  const { min, max, step } = controlCenterLimits[axis];
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, min + Math.round((value - min) / step) * step))
    : fallback;
}

export function normalizeSettings(
  input: Partial<ControlCenterValue> | undefined,
  modes: readonly { value: string }[],
  channels: readonly { value: string; defaultChecked?: boolean }[],
  people: readonly { value: string }[],
): ControlCenterValue {
  const focus = input?.focus;
  return {
    focus:
      focus && modes.some((mode) => mode.value === focus.mode) && toEpoch(focus.until) !== null
        ? {
            ...focus,
            minutes: bounded(focus.minutes, 'minutes', 25),
            allowedPeople: (focus.allowedPeople ?? []).filter((id) =>
              people.some((person) => person.value === id),
            ),
          }
        : null,
    notifications: input?.notifications ?? true,
    presenting: input?.presenting ?? false,
    channels: Object.fromEntries(
      channels.map((channel) => [
        channel.value,
        input?.channels?.[channel.value] ??
          (input === undefined && channel.defaultChecked === true),
      ]),
    ),
    volume: bounded(input?.volume ?? 60, 'volume', 60),
    textSize: bounded(input?.textSize ?? 100, 'textSize', 100),
  };
}
import { toEpoch } from '../../utils/intl';
