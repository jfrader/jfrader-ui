// The one portal for floating overlays (Select, Combobox, Menu, Popover, Tooltip, DatePicker).
// Inside a ThemeRoot it targets the scope's `portalContainer` (FloatingPortal's `root`: `null`
// waits for the host) and re-applies the scope's theme around the content; outside one it is a
// plain FloatingPortal. Set the container once: pass it at first render (or `null` until the host
// is ready). Swapping elements recreates the portal, remounting children and losing uncontrolled
// state; setting it to `null` after mount does not remove an existing portal.
import type { ReactNode } from 'react';
import { FloatingPortal } from '@floating-ui/react';
import { ThemeBoundary, useThemeScope } from '../styling/theme-scope';

export function OverlayPortal({ children }: { children?: ReactNode }) {
  const scope = useThemeScope();
  return (
    <FloatingPortal root={scope?.portalContainer}>
      <ThemeBoundary>{children}</ThemeBoundary>
    </FloatingPortal>
  );
}

OverlayPortal.displayName = 'OverlayPortal';
