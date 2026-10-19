import { act, StrictMode, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { expect, fn } from 'storybook/test';

export async function expectArticleHydration(element: ReactElement, canvas: HTMLElement) {
  const host = canvas.ownerDocument.createElement('div');
  canvas.append(host);
  const errors = fn();
  const content = <StrictMode>{element}</StrictMode>;
  const html = renderToString(content);
  host.innerHTML = html;
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(host, content, { onRecoverableError: errors }); });
    await expect(errors).not.toHaveBeenCalled();
    await expect(host.textContent).not.toBe('');
    await expect(host.querySelector('a a')).toBeNull();
  } finally {
    await act(async () => root?.unmount());
    host.remove();
  }
}
