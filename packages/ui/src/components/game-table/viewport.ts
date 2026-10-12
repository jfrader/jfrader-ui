import type { BoardPlayerCount, BoardViewportProfile } from './types';

export const normalizeBoardPlayerCount = (totalSeats: number): BoardPlayerCount => {
  if (totalSeats >= 6) return 6;
  if (totalSeats >= 4) return 4;
  return 2;
};

export const resolveBoardViewportProfile = ({ width, height }: { width: number; height: number }): BoardViewportProfile => {
  const aspectRatio = width / Math.max(height, 1);
  const shortHeight = height <= 520;
  const compactPortrait = width <= 430 && aspectRatio >= 0.49 && aspectRatio < 1;
  if (width >= 1200) return 'desktop';
  if (width >= 900) return aspectRatio >= 1.25 ? 'desktop' : 'tabletWide';
  if (width >= 600) {
    if (shortHeight && aspectRatio >= 1.45) return 'phoneWide';
    return aspectRatio >= 1.25 ? 'tabletWide' : 'tablet';
  }
  if (compactPortrait) return 'phoneCompact';
  if (shortHeight || aspectRatio >= 1.3) return 'phoneWide';
  return 'phoneTall';
};
