// Durations for APIs that take a number (Motion's `duration`, timers, tests). The CSS side reads the
// generated custom properties; these numbers come from the same token object, so changing a token
// moves both and no component writes its own literal.
import { base } from '@jfrader/tokens';

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

/**
 * Parses a `120ms` token into a number. A token that is missing or stops being milliseconds resolves
 * to `0` — no animation, and the state still completes — because a design system cannot take the page
 * down over a configuration mistake. Exported for the Foundations/Motion page to prove the fallback;
 * the report is loud in development and silent in production.
 */
export function resolveMotionDurationMs(name: string, value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  if (Number.isFinite(parsed) && typeof value === 'string' && value.trim().endsWith('ms')) return parsed;

  if (process.env.NODE_ENV !== 'production') {
    console.error(
      `@jfrader/ui: motion duration "${name}" must be a token in ms, received ${JSON.stringify(value)}; using 0.`,
    );
  }
  return 0;
}

export const motionDurationMs = {
  fast: resolveMotionDurationMs('duration.fast', base.motion.duration.fast),
  base: resolveMotionDurationMs('duration.base', base.motion.duration.base),
  slow: resolveMotionDurationMs('duration.slow', base.motion.duration.slow),
  cardFlip: resolveMotionDurationMs('duration.cardFlip', base.motion.duration.cardFlip),
  cardDeal: resolveMotionDurationMs('duration.cardDeal', base.motion.duration.cardDeal),
  cardDealStagger: resolveMotionDurationMs('duration.cardDealStagger', base.motion.duration.cardDealStagger),
  cardPlayOwn: resolveMotionDurationMs('duration.cardPlayOwn', base.motion.duration.cardPlayOwn),
  cardPlay: resolveMotionDurationMs('duration.cardPlay', base.motion.duration.cardPlay),
  trickStack: resolveMotionDurationMs('duration.trickStack', base.motion.duration.trickStack),
} as const;
