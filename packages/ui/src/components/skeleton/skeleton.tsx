'use client';

import { Skeleton as SkeletonPlaceholder } from './skeleton-placeholder';
import { SkeletonMorph, SkeletonBlock } from './skeleton-morph';

export const Skeleton = Object.assign(SkeletonPlaceholder, {
  Morph: SkeletonMorph,
  Block: SkeletonBlock,
});

export type { SkeletonProps } from './skeleton-placeholder';
