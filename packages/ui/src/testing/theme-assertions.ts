import { expect, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import type { ThemeName } from '../styling/theme-scope';

const OTHER_THEME: Record<ThemeName, ThemeName> = { dark: 'light', light: 'dark' };

export async function expectNativeScrollbar(element: HTMLElement) {
  const probe = element.ownerDocument.createElement('div');
  probe.style.scrollbarColor = `${vars.color.borderControl} transparent`;
  element.append(probe);
  try {
    const expected = getComputedStyle(probe).scrollbarColor;
    if (!element.ownerDocument.defaultView?.matchMedia('(forced-colors: active)').matches) {
      await expect(expected).not.toBe('auto');
    }
    await expect(getComputedStyle(element).scrollbarColor).toBe(expected);
    await expect(getComputedStyle(element).scrollbarWidth).toBe('auto');
  } finally {
    probe.remove();
  }
}

/** Story-only: the computed background `color` resolves to under `theme`, measured on a throwaway probe. */
function probeBackground(document: Document, theme: ThemeName, color: string): string {
  const probe = document.createElement('div');
  probe.dataset.theme = theme;
  probe.style.backgroundColor = color;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
}

/** Story-only: the computed background under a contrast surface's attributes, on a throwaway probe. */
function probeContrast(document: Document, color: string): string {
  const probe = document.createElement('div');
  probe.dataset.theme = 'dark';
  probe.dataset.appearance = 'contrast';
  probe.style.backgroundColor = color;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
}

/**
 * Story-only: asserts `element` paints `surface` from `theme`'s tokens (portaled overlays included),
 * and that the other theme's value differs, so the check can fail.
 */
export async function expectThemedSurface(
  element: HTMLElement,
  theme: ThemeName,
  surface: string = vars.color.surfaceRaised,
) {
  const { ownerDocument } = element;
  const expected = probeBackground(ownerDocument, theme, surface);
  await expect(probeBackground(ownerDocument, OTHER_THEME[theme], surface)).not.toBe(expected);
  await waitFor(() => expect(getComputedStyle(element).backgroundColor).toBe(expected));
}

/**
 * Story-only: asserts `element` paints `surface` from the contrast appearance whatever the page theme
 * is, and that the page theme's own value differs, so the check can fail.
 */
export async function expectContrastSurface(
  element: HTMLElement,
  theme: ThemeName,
  surface: string = vars.color.surfaceRaised,
) {
  const { ownerDocument } = element;
  const expected = probeContrast(ownerDocument, surface);
  await expect(probeBackground(ownerDocument, theme, surface)).not.toBe(expected);
  await waitFor(() => expect(getComputedStyle(element).backgroundColor).toBe(expected));
}
