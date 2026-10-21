import type { ComponentPropsWithoutRef, ComponentPropsWithRef } from 'react';
import type { UseInteractionsReturn } from '@floating-ui/react';

export function getInputReferenceProps(
  getReferenceProps: UseInteractionsReturn['getReferenceProps'],
  { ref, ...props }: ComponentPropsWithRef<'input'>,
): ComponentPropsWithRef<'input'> {
  // Floating UI preserves native props and composes their handlers, but declares only a record.
  // Keep the input ref outside its element-wide HTMLProps boundary.
  return { ...(getReferenceProps(props) as ComponentPropsWithoutRef<'input'>), ref };
}
