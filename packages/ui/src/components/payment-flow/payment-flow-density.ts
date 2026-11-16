import { vars } from '@jfrader/tokens/vars';

export type PaymentFlowDensity = 'spacious' | 'compact' | 'split' | 'stacked';
export type PaymentFlowLayout = 'row' | 'split' | 'stack';
export type PaymentFlowOrientationPreference = 'auto' | 'horizontal' | 'vertical';

interface DensityStep {
  /** `row` puts actors over phases, `split` puts them side by side as columns, `stack` stacks them. */
  layout: PaymentFlowLayout;
  /** Gap between consecutive actors or phases; every connector spans at least this. */
  track: string;
  /** Gap between the actor group and the phase group. */
  group: string;
  inset: string;
  detailFont: string;
  amountFont: string;
  markerSize: string;
  markerFont: string;
}

/**
 * The density scale, roomiest first. A figure tries each step in order and keeps the first whose
 * scene fits its inline size without wrapping a label, so the layout changes before a word does.
 */
export const paymentFlowDensityScale = {
  spacious: {
    layout: 'row',
    track: vars.space[8],
    group: vars.space[6],
    inset: vars.space[3],
    detailFont: vars.textSize.sm,
    amountFont: vars.textSize.sm,
    markerSize: vars.space[8],
    markerFont: vars.textSize.sm,
  },
  compact: {
    layout: 'row',
    track: vars.space[6],
    group: vars.space[4],
    inset: vars.space[2],
    detailFont: vars.textSize.xs,
    amountFont: vars.textSize.xs,
    markerSize: vars.space[6],
    markerFont: vars.textSize.xs,
  },
  split: {
    layout: 'split',
    track: vars.space[4],
    group: vars.space[6],
    inset: vars.space[2],
    detailFont: vars.textSize.xs,
    amountFont: vars.textSize.sm,
    markerSize: vars.space[6],
    markerFont: vars.textSize.xs,
  },
  stacked: {
    layout: 'stack',
    track: vars.space[6],
    group: vars.space[6],
    inset: vars.space[3],
    detailFont: vars.textSize.xs,
    amountFont: vars.textSize.sm,
    markerSize: vars.space[6],
    markerFont: vars.textSize.xs,
  },
} as const satisfies Record<PaymentFlowDensity, DensityStep>;

export const paymentFlowDensities = Object.keys(paymentFlowDensityScale) as PaymentFlowDensity[];

export const densityOrientation = (density: PaymentFlowDensity) =>
  paymentFlowDensityScale[density].layout === 'row' ? 'horizontal' : 'vertical';

/** Densities each `orientation` value may choose from, roomiest first. */
export const densityCandidates: Record<PaymentFlowOrientationPreference, readonly PaymentFlowDensity[]> = {
  auto: paymentFlowDensities,
  horizontal: paymentFlowDensities,
  vertical: paymentFlowDensities.filter((density) => densityOrientation(density) === 'vertical'),
};

/** Densities that use one layout, for building that layout's selectors. */
export const densitiesWithLayout = (layout: PaymentFlowLayout) =>
  paymentFlowDensities.filter((density) => paymentFlowDensityScale[density].layout === layout);

/**
 * Applies each candidate to the scene and returns the first whose content fits its inline size.
 * Labels and amounts never wrap outside `stacked`, so an overflowing scene means a label would not
 * fit. The last candidate is the fallback and stays applied when nothing fits.
 */
export function fitDensity(scene: HTMLElement, candidates: readonly PaymentFlowDensity[]) {
  for (const density of candidates) {
    scene.setAttribute('data-density', density);
    if (scene.scrollWidth <= scene.clientWidth) return density;
  }
  return candidates.at(-1)!;
}
