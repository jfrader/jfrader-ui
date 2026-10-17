'use client';
import { useSyncExternalStore } from 'react';
import { useReducedMotion as useMotionReducedMotion } from 'motion/react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let media: MediaQueryList | undefined;
const preference = () => media ??= window.matchMedia(REDUCED_MOTION_QUERY);
const subscribe = (notify: () => void) => {
  const query = preference();
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const snapshot = () => preference().matches;
const serverSnapshot = () => null;

export function useReducedMotion() {
  const initial = useMotionReducedMotion();
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot) ?? initial;
}
