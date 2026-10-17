const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = MINUTE_SECONDS * MINUTE_SECONDS;
const UNITS = { hours: 'hour', minutes: 'minute', seconds: 'second' } as const;
type Duration = Record<keyof typeof UNITS, number>;
type DurationFormatter = new (
  locale?: Intl.LocalesArgument,
  options?: { style: 'digital' | 'long' },
) => { format(duration: Duration): string };

function toDuration(totalSeconds: number): Duration {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  return {
    hours: Math.floor(safe / HOUR_SECONDS),
    minutes: Math.floor((safe % HOUR_SECONDS) / MINUTE_SECONDS),
    seconds: safe % MINUTE_SECONDS,
  };
}

export function createDurationFormatters(locale?: Intl.LocalesArgument) {
  const DurationFormat = (Intl as typeof Intl & { DurationFormat?: DurationFormatter }).DurationFormat;
  if (typeof DurationFormat === 'function') {
    const digital = new DurationFormat(locale, { style: 'digital' });
    const spoken = new DurationFormat(locale, { style: 'long' });
    return {
      digital: (seconds: number) => digital.format(toDuration(seconds)),
      spoken: (seconds: number) => spoken.format(toDuration(seconds)),
    };
  }
  const clock = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });
  const hours = new Intl.NumberFormat(locale, { useGrouping: false });
  const units = (Object.keys(UNITS) as (keyof Duration)[]).map((key) => ({
    key,
    format: new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: UNITS[key],
      unitDisplay: 'long',
    }),
  }));
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  return {
    digital: (seconds: number) => {
      const duration = toDuration(seconds);
      return clock
        .formatToParts((duration.minutes * MINUTE_SECONDS + duration.seconds) * SECOND_MS)
        .map((part) => part.type === 'hour' ? hours.format(duration.hours) : part.value)
        .join('');
    },
    spoken: (seconds: number) => {
      const duration = toDuration(seconds);
      const values = units
        .filter(({ key }) => duration[key] > 0)
        .map(({ key, format }) => format.format(duration[key]));
      return list.format(values.length ? values : [units.find(({ key }) => key === 'seconds')!.format.format(0)]);
    },
  };
}
