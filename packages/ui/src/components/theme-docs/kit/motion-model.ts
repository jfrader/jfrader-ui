import { base, light } from '@jfrader/tokens';

export const SHADOW_TOKENS = Object.entries(base.shadow).map(([role, value]) => ({
  role,
  values: [
    { label: 'Dark', value },
    { label: 'Light', value: light.shadow[role as keyof typeof base.shadow] },
  ],
}));

type DurationRole = keyof typeof base.motion.duration;

interface DurationFamily {
  readonly title: string;
  readonly blurb: string;
  readonly roles: readonly DurationRole[];
}

export const DURATION_FAMILIES = [
  {
    title: 'Interface durations',
    blurb: 'Short interface transitions and the longer presence cycle.',
    roles: ['fast', 'base', 'slow', 'presence'],
  },
  {
    title: 'Card durations',
    blurb: 'Flips, deals, stagger intervals, and moves to the played pile.',
    roles: ['cardFlip', 'cardDeal', 'cardDealStagger', 'cardPlayOwn', 'cardPlay', 'playedPile'],
  },
  {
    title: 'Call durations',
    blurb: 'Call fades, slams, shakes, and the delay before a shake.',
    roles: ['callFade', 'callSlam', 'callShake', 'callShakeDelay'],
  },
] as const satisfies readonly DurationFamily[];

export const EASING_TOKENS = Object.entries(base.motion)
  .flatMap(([role, value]) => typeof value === 'string' ? [{ role, value }] : []);

export const CARD_MATERIAL_TOKENS = Object.entries(base.cardMaterial).map(([role, value]) => ({ role, value }));

export const LAYER_TOKENS = Object.entries(base.zIndex).map(([role, value]) => ({ role, value }));
