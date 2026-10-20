'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import type { Interpolation, Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import type { SurfaceAppearance } from '../../styling/surface';
import { SurfaceRoot, resolveSurfaceValue } from './surface-root';

export type { SurfaceAppearance } from '../../styling/surface';
export type SurfaceVariant = 'flat' | 'raised' | 'floating';

export interface SurfacePartProps extends ComponentPropsWithRef<'div'> {
  'data-ui'?: string;
  'data-theme'?: 'dark' | 'light';
  'data-appearance'?: SurfaceAppearance;
  'data-surface-variant'?: SurfaceVariant;
  'data-state'?: string;
  'data-variant'?: string;
  'data-depth'?: number;
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}

export type SurfaceRootSlotProps = Partial<SurfacePartProps> & { sx?: Interpolation<Theme> };

export interface SurfaceRootCustomization {
  /** Replace the root. Exactly sugar for `slots.root`; declare the component outside render. */
  component?: ComponentType<SurfacePartProps>;
  /** Replace adopted parts. Only `root` is supported. */
  slots?: {
    /** Replaces the outer panel element; renders a `div` by default. */
    root?: ComponentType<SurfacePartProps>;
  };
  /** Root props override matching component props; className and style merge. */
  slotProps?: {
    /** Outer panel element rendering the surface material. Renders a `div` by default. */
    root?: SurfaceRootSlotProps;
  };
}

export interface SurfaceProps extends SurfacePartProps, SxProps, SurfaceRootCustomization {
  /** Use fixed charcoal with `contrast`; `default` inherits the parent appearance. */
  appearance?: SurfaceAppearance;
  /** Shadow treatment. Defaults to `flat`; all variants keep a raised background and border. */
  variant?: SurfaceVariant;
}

const variants = ['flat', 'raised', 'floating'] as const;

export function Surface({ variant: variantProp, ...props }: SurfaceProps) {
  const variant = resolveSurfaceValue('Surface', 'variant', variantProp, variants, 'flat');
  return (
    <SurfaceRoot
      {...props}
      owner="Surface"
      marker="surface"
      variant={variant}
      attributes={{ 'data-surface-variant': props['data-surface-variant'] ?? variant }}
    />
  );
}

Surface.displayName = 'Surface';
