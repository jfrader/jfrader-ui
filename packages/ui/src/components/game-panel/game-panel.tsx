'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
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
// A raised plaque: opaque fill, a subtle hairline and an inset top lip instead of a heavy border.
const plaque = { border: `1px solid ${vars.color.borderSubtle}`, boxShadow: `inset 0 1px 0 ${vars.color.surfaceHighlight}, ${vars.shadow.raised}`,
  [FORCED_COLORS]: { boxShadow: 'none', borderColor: 'CanvasText' } };
const transparentMaterial = css({ background: 'transparent', border: 0, borderRadius: 0, boxShadow: 'none' });
// The chip root reserves its box without painting it: the plaque is a `::before` the owner's
// structure places as a grid item, so it hugs the content instead of filling the footprint.
const materials = {
  chip: css([transparentMaterial, { '&::before': { ...plaque, content: '""', boxSizing: 'border-box', backgroundColor: vars.color.surfaceRaised, borderRadius: vars.radius.md } }]),
  panel: css({ ...plaque, backgroundColor: vars.color.surface, borderRadius: vars.radius.lg }),
};
const spacing = {
  chip: css({ paddingBlock: 0, paddingInline: vars.space[2] }),
  panel: css({ padding: vars.space[4] }),
};
const structureStyle = css({ minInlineSize: 0, maxInlineSize: '100%', boxSizing: 'border-box' });

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
