import { spyOn } from 'storybook/test';

const preference: { matches: boolean; media?: MediaQueryList } = { matches: false };

/**
 * Story-only: makes `prefers-reduced-motion` queries report `reduced` and notifies subscribers.
 * Install it from a meta `beforeEach` so the first render already reads the mocked list; the
 * returned function restores `matchMedia`. CSS media queries keep the real preference.
 */
export function mockReducedMotion(reduced: boolean) {
  const original = window.matchMedia.bind(window);
  if (!preference.media) {
    preference.media = original('(prefers-reduced-motion: reduce)');
    Object.defineProperty(preference.media, 'matches', { get: () => preference.matches });
  }
  preference.matches = reduced;
  preference.media.dispatchEvent(new MediaQueryListEvent('change', { matches: reduced, media: preference.media.media }));
  const spy = spyOn(window, 'matchMedia').mockImplementation((query) =>
    query.includes('prefers-reduced-motion') ? preference.media! : original(query),
  );
  return () => spy.mockRestore();
}
