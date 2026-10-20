'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { SurfaceRoot } from '../surface/surface-root';

export interface GamePanelProps extends ComponentPropsWithRef<'div'> {
  /** Use the neutral game surface by default; transparent removes its material, retaining layout. */
  surface?: 'default' | 'transparent';
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}
export type GamePanelSlotProps = Partial<Omit<GamePanelProps, 'surface'>> & SxProps;
export interface GamePanelCustomization {
  component?: ComponentType<GamePanelProps>;
  slots?: { root?: ComponentType<GamePanelProps> };
}
const materials = {
  chip: css({ backgroundColor: vars.color.surfaceRaised, border: `1px solid ${vars.color.borderStrong}`, borderRadius: vars.radius.full, boxShadow: vars.shadow.raised }),
  panel: css({ backgroundColor: vars.color.surface, border: `1px solid ${vars.color.borderStrong}`, borderRadius: vars.radius.lg, boxShadow: 'none' }),
};
const spacing = {
  chip: css({ paddingBlock: vars.space[2], paddingInline: vars.space[3] }),
  panel: css({ padding: vars.space[4] }),
};
const structureStyle = css({ minInlineSize: 0, maxInlineSize: '100%', boxSizing: 'border-box' });
const transparentMaterial = css({ background: 'transparent', border: 0, borderRadius: 0, boxShadow: 'none' });

function relationships(...values: (string | undefined)[]) {
  return [...new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ') || undefined;
}

export function GamePanel({ marker, structure, rootSlot, attributes, variant = 'panel', surface = 'default', ...props }: GamePanelProps & GamePanelCustomization & SxProps & {
  marker: string;
  structure: Interpolation<Theme>;
  rootSlot?: GamePanelSlotProps;
  attributes?: GamePanelProps;
  variant?: 'chip' | 'panel';
}) {
  return <SurfaceRoot {...props} owner={marker} marker={marker} variant="flat" structure={[structureStyle, spacing[variant], structure]} attributes={{ ...attributes,
    'data-game-material': surface === 'transparent' ? 'transparent' : variant,
    'aria-labelledby': relationships(attributes?.['aria-labelledby'], props['aria-labelledby'], rootSlot?.['aria-labelledby']),
    'aria-describedby': relationships(attributes?.['aria-describedby'], props['aria-describedby'], rootSlot?.['aria-describedby']),
  }}
    materialStyle={surface === 'transparent' ? transparentMaterial : materials[variant]} slotProps={{ root: rootSlot }} />;
}
