// Durations for APIs that take a number (Motion's `duration`, timers, tests). The CSS side reads the
// generated custom properties; these numbers come from the same token object, so changing a token
// moves both and no component writes its own literal.
import { base } from '@jfrader/tokens';

/** Parses a `120ms` token, and says so loudly if a duration stops being milliseconds. */
const milliseconds = (value: string) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || !value.trim().endsWith('ms')) {
    throw new Error(`Motion timings need a duration token in ms, received "${value}".`);
  }
  return parsed;
};

export const motionDurationMs = {
  fast: milliseconds(base.motion.duration.fast),
  base: milliseconds(base.motion.duration.base),
  slow: milliseconds(base.motion.duration.slow),
} as const;
