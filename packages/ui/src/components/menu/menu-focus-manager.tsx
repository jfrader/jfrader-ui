'use client';

import type { ReactElement } from 'react';
import { FloatingFocusManager, type FloatingContext } from '@floating-ui/react';
import { useFloatingTabOrder } from '../../overlay/use-floating-tab-order';
import { OverlayPortal } from '../../overlay/overlay-portal';

export function MenuFocusManager({ context, children }: { context: FloatingContext; children: ReactElement }) {
  useFloatingTabOrder(context);

  return (
    <OverlayPortal preserveTabOrder={false}>
      <FloatingFocusManager context={context} modal={false} guards={false} initialFocus={-1} returnFocus={false} restoreFocus>
        {children}
      </FloatingFocusManager>
    </OverlayPortal>
  );
}
