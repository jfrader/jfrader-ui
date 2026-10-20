'use client';

import type { ComponentPropsWithRef, ComponentType } from 'react';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { SurfaceRoot } from '../surface/surface-root';

export interface GamePanelProps extends ComponentPropsWithRef<'div'> {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}
export type GamePanelSlotProps = Partial<GamePanelProps> & SxProps;
export interface GamePanelCustomization {
  component?: ComponentType<GamePanelProps>;
  slots?: { root?: ComponentType<GamePanelProps> };
}
const neutralMaterial = css({ background: 'transparent', border: 0, borderRadius: 0, boxShadow: 'none', minInlineSize: 0 });

function relationships(...values: (string | undefined)[]) {
  return [...new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ') || undefined;
}

export function GamePanel({ marker, structure, rootSlot, attributes, ...props }: GamePanelProps & GamePanelCustomization & SxProps & {
  marker: string;
  structure: Interpolation<Theme>;
  rootSlot?: GamePanelSlotProps;
  attributes?: GamePanelProps;
}) {
  return <SurfaceRoot {...props} owner={marker} marker={marker} variant="flat" structure={structure} attributes={{ ...attributes,
    'aria-labelledby': relationships(attributes?.['aria-labelledby'], props['aria-labelledby'], rootSlot?.['aria-labelledby']),
    'aria-describedby': relationships(attributes?.['aria-describedby'], props['aria-describedby'], rootSlot?.['aria-describedby']),
  }}
    materialStyle={neutralMaterial} slotProps={{ root: rootSlot }} />;
}
