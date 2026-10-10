import type { ReactNode } from 'react';

/** True when a ReactNode actually renders content — null, undefined and booleans render nothing. */
export function isRenderable(node: ReactNode): boolean {
  return node != null && typeof node !== 'boolean';
}
