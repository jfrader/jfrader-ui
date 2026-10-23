'use client';

import type { ComponentPropsWithRef, ComponentType, CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';

export type GameChipTone = 'white' | 'red' | 'green' | 'black' | 'purple' | 'gold';
export type GameChipSize = 'sm' | 'md' | 'lg' | 'xl';
export type GameChipPartProps = ComponentPropsWithRef<'span'> & SxProps & { 'data-ui'?: string };
export interface GameChipSlots {
  /** Replaces the outer span; forward all supplied props and ref. */
  root?: ComponentType<GameChipPartProps>;
  /** Replaces the printed face span. */
  face?: ComponentType<GameChipPartProps>;
}
export interface GameChipSlotProps {
  /** Adds attributes and styles to the outer span. */
  root?: GameChipPartProps;
  /** Adds attributes and styles to the printed face. */
  face?: GameChipPartProps;
}
export interface GameChipProps extends Omit<GameChipPartProps, 'color'> {
  /** Sets the denomination in major units. Must be finite and nonnegative. */
  value: number;
  /** Names the chip. Defaults to the full formatted value. */
  label?: string;
  /** Formats the printed and accessible values. Use the same locale on server and client. */
  locale?: Intl.LocalesArgument;
  /** Formats major units as an ISO 4217 currency. */
  currency?: string;
  /** Sets the material color. Defaults to the denomination ladder. */
  tone?: GameChipTone;
  /** Sets the diameter: sm 24px, md 32px, lg 48px, xl 64px. Defaults to md. */
  size?: GameChipSize;
  /** Adds specular bands for metal. Defaults to clay. */
  finish?: 'clay' | 'metal';
  /** Mutes the material while retaining readable ink. Defaults to false. */
  dimmed?: boolean;
  /** Replaces the printed value with decorative content. */
  children?: ComponentPropsWithRef<'span'>['children'];
  /** Replaces the root and face spans. */
  slots?: GameChipSlots;
  /** Passes native props and sx to the root and face. */
  slotProps?: GameChipSlotProps;
  /** Replaces the root span; slots.root takes precedence. */
  component?: ComponentType<GameChipPartProps>;
}

export const GAME_CHIP_SIZES: Readonly<Record<GameChipSize, number>> = { sm: 24, md: 32, lg: 48, xl: 64 };
const tones: Record<GameChipTone, string> = {
  white: vars.color.chipWhite, red: vars.color.chipRed, green: vars.color.chipGreen,
  black: vars.color.chipBlack, purple: vars.color.chipPurple, gold: vars.color.chipGold,
};
const ladder: readonly [number, GameChipTone][] = [[1, 'white'], [5, 'red'], [25, 'green'], [100, 'black'], [500, 'purple'], [1000, 'gold']];
function denominationTone(value: number): GameChipTone {
  const scaled = value > 1000 ? value / 1000 ** Math.floor(Math.log10(value / 5) / 3) : value;
  return ladder.findLast(([threshold]) => scaled >= threshold)?.[1] ?? 'white';
}
const rootStyle = css({
  '--chip-tone': 'var(--chip-material)',
  label: 'game-chip', display: 'inline-grid', placeItems: 'center', position: 'relative',
  inlineSize: 'var(--game-chip-size)', blockSize: 'var(--game-chip-size)', flexShrink: 0,
  boxSizing: 'border-box', borderRadius: '50%', isolation: 'isolate', verticalAlign: 'middle',
  color: vars.color.chipInk, fontFamily: vars.font.sans, fontWeight: vars.fontWeight.bold,
  lineHeight: 1, userSelect: 'none',
  background: `radial-gradient(circle at 35% 22%, color-mix(in srgb, ${vars.color.chipSpot} 24%, transparent), transparent 65%), radial-gradient(circle, var(--chip-tone) 60%, color-mix(in srgb, var(--chip-tone) 68%, ${vars.color.chipInk}) 100%)`,
  boxShadow: `inset 0 0 0 1px ${vars.color.chipSpot}, inset 0 -2px 2px ${vars.color.chipInk}, 0 2px 3px color-mix(in srgb, ${vars.color.chipInk} 45%, transparent)`,
  '&::before': { content: '""', position: 'absolute', inset: '5%', borderRadius: '50%',
    background: 'repeating-conic-gradient(from -8deg, var(--chip-spot) 0deg 16deg, transparent 16deg 45deg)',
    maskImage: `radial-gradient(circle, transparent 55%, ${vars.color.chipInk} 57%)` },
  '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
    background: `linear-gradient(155deg, color-mix(in srgb, ${vars.color.chipSpot} 18%, transparent), transparent 44%, color-mix(in srgb, ${vars.color.chipInk} 16%, transparent))`,
    boxShadow: `inset 0 1px 0 ${vars.color.chipSpot}` },
  '&[data-finish="metal"]::after': { background: `linear-gradient(125deg, transparent 15%, color-mix(in srgb, ${vars.color.chipSpot} 70%, transparent) 24%, transparent 32% 48%, color-mix(in srgb, ${vars.color.chipSpot} 42%, transparent) 53%, transparent 61%)` },
  '&[data-dimmed="true"]': { '--chip-tone': `color-mix(in srgb, var(--chip-material) 55%, ${vars.color.chipSpot})` },
  [FORCED_COLORS]: { background: 'Canvas', color: 'CanvasText', border: '1px solid CanvasText', boxShadow: 'none',
    '&::before, &::after': { display: 'none' } },
});
const faceStyle = css({
  display: 'grid', placeItems: 'center', inlineSize: '62%', blockSize: '62%', boxSizing: 'border-box',
  borderRadius: '50%', backgroundColor: vars.color.chipSpot, color: vars.color.chipInk,
  fontSize: 'calc(var(--game-chip-size) * var(--chip-font-scale))', fontVariantNumeric: 'tabular-nums',
  boxShadow: `0 1px 1px ${vars.color.chipInk}, inset 0 1px 1px ${vars.color.chipWhite}, inset 0 0 0 1px color-mix(in srgb, ${vars.color.chipInk} 20%, transparent)`,
  [FORCED_COLORS]: { background: 'Canvas', color: 'CanvasText', border: '1px solid CanvasText', boxShadow: 'none' },
});

export function GameChip({ value, label, locale, currency, tone = denominationTone(value), size = 'md', finish = 'clay',
  dimmed = false, children, slots, slotProps, component, className, style, sx, ref, ...rest }: GameChipProps) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('GameChip value must be finite and nonnegative');
  const format: Intl.NumberFormatOptions = currency ? { style: 'currency', currency } : {};
  const printed = new Intl.NumberFormat(locale, { ...format, notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const full = new Intl.NumberFormat(locale, format).format(value);
  const Root = slots?.root ?? component ?? 'span';
  const Face = slots?.face ?? 'span';
  const root = slotProps?.root;
  const rootIdentity = [...new Set(`game-chip ${root?.['data-ui'] ?? rest['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  const faceIdentity = [...new Set(`game-chip-face ${slotProps?.face?.['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  return <WithSx styles={[rootStyle, root?.sx]} sx={sx} className={[className, root?.className].filter(Boolean).join(' ')}>{(classes) =>
    <Root {...rest} {...withoutSx(root)} ref={ref ?? root?.ref} role="img" aria-label={label ?? full}
      data-ui={rootIdentity} data-tone={tone} data-size={size} data-finish={finish} data-dimmed={String(dimmed)} className={classes}
      style={{ '--game-chip-size': `${GAME_CHIP_SIZES[size]}px`, '--chip-material': tones[tone],
        '--chip-spot': tone === 'white' ? vars.color.chipRed : vars.color.chipSpot,
        '--chip-font-scale': Math.min(0.28, 0.9 / Math.max(1, printed.length)), ...style, ...root?.style } as CSSProperties}>
      <WithSx styles={[faceStyle, slotProps?.face?.sx]} className={slotProps?.face?.className}>{(faceClasses) =>
        <Face {...withoutSx(slotProps?.face)} data-ui={faceIdentity} aria-hidden="true" className={faceClasses}>{children !== undefined ? children : printed}</Face>}
      </WithSx>
    </Root>}
  </WithSx>;
}
GameChip.displayName = 'GameChip';
