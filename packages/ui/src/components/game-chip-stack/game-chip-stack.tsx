'use client';

import type { ComponentPropsWithRef, ComponentType, CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { GameChip, type GameChipSize, type GameChipTone } from '../game-chip';
import { GAME_CHIP_SIZES } from '../game-chip/game-chip';

export interface GameChipStackChip {
  /** Sets the denomination in major units. */
  value: number;
  /** Sets the real number of chips. Must be a nonnegative safe integer. */
  count: number;
  /** Overrides the denomination's material color. */
  tone?: GameChipTone;
}
export type GameChipStackPartProps = ComponentPropsWithRef<'span'> & SxProps & { 'data-ui'?: string };
export interface GameChipStackSlots {
  /** Replaces the root span; forward supplied props and ref. */
  root?: ComponentType<GameChipStackPartProps>;
  /** Replaces each tower span. */
  stack?: ComponentType<GameChipStackPartProps>;
}
export interface GameChipStackSlotProps {
  /** Adds native attributes and styles to the root. */
  root?: GameChipStackPartProps;
  /** Adds native attributes and styles to each tower. */
  stack?: GameChipStackPartProps;
}
export interface GameChipStackProps extends Omit<GameChipStackPartProps, 'children'> {
  /** Renders one tower per nonzero entry, largest denomination first. */
  chips: ReadonlyArray<GameChipStackChip>;
  /** Sets chip diameter. Defaults to md. */
  size?: GameChipSize;
  /** Shows offset, top-down chips instead of perspective towers. Defaults to false. */
  flat?: boolean;
  /** Caps rendered chips per tower, not the real total. Positive safe integer. Defaults to 10. */
  maxVisible?: number;
  /** Names the image. Without a label, the entire stack is decorative. Include the real total when chips are capped. */
  label?: string;
  /** Formats chip values. Use the same locale on server and client. */
  locale?: Intl.LocalesArgument;
  /** Formats chip values as an ISO 4217 currency. */
  currency?: string;
  /** Mutes every chip's material. Defaults to false. */
  dimmed?: boolean;
  /** Replaces root and tower spans. */
  slots?: GameChipStackSlots;
  /** Passes native props and sx to root and tower spans. */
  slotProps?: GameChipStackSlotProps;
  /** Replaces the root span; slots.root takes precedence. */
  component?: ComponentType<GameChipStackPartProps>;
}
const geometry = Object.fromEntries(Object.entries(GAME_CHIP_SIZES).map(([size, diameter]) => [size, {
  diameter, thickness: diameter * 0.12, padding: diameter * 0.2, width: diameter * 1.4,
}])) as Record<GameChipSize, { diameter: number; thickness: number; padding: number; width: number }>;
const jitter = [-0.012, 0.018, -0.02, 0.008, 0, 0.022, -0.008];
const rootStyle = css({ label: 'game-chip-stack', display: 'inline-flex', alignItems: 'end', flexWrap: 'wrap',
  gap: vars.space[2], verticalAlign: 'middle', maxInlineSize: '100%', boxSizing: 'border-box' });
const stackStyle = css({ position: 'relative', display: 'inline-block', flexShrink: 0,
  inlineSize: 'var(--tower-width)', blockSize: 'var(--tower-height)', perspective: 'var(--tower-perspective)',
  transformStyle: 'preserve-3d' });
const positionStyle = css({ position: 'absolute', insetInlineStart: 'var(--tower-padding)', insetBlockEnd: 'var(--tower-padding)',
  display: 'inline-grid', transformStyle: 'preserve-3d',
  transform: 'rotateX(56deg) translateZ(var(--chip-rise)) translateX(var(--chip-jitter)) rotate(var(--chip-tilt))',
  '[data-flat="true"] > &': { transform: 'translateY(calc(-1 * var(--chip-rise))) translateX(var(--chip-jitter)) rotate(var(--chip-tilt))' },
});

export function GameChipStack({ chips, size = 'md', flat = false, maxVisible = 10, label, locale, currency,
  dimmed = false, slots, slotProps, component, className, style, sx, ref, ...rest }: GameChipStackProps) {
  if (!Number.isSafeInteger(maxVisible) || maxVisible < 1) throw new RangeError('GameChipStack maxVisible must be a positive safe integer');
  for (const chip of chips) {
    if (!Number.isSafeInteger(chip.count) || chip.count < 0) throw new RangeError('GameChipStack count must be a nonnegative safe integer');
    if (!Number.isFinite(chip.value) || chip.value < 0) throw new RangeError('GameChipStack value must be finite and nonnegative');
  }
  const towers = chips.filter(({ count }) => count > 0).sort((a, b) => b.value - a.value);
  if (!towers.length) return null;
  const Root = slots?.root ?? component ?? 'span';
  const Stack = slots?.stack ?? 'span';
  const root = slotProps?.root;
  const frame = geometry[size];
  const rootIdentity = [...new Set(`game-chip-stack ${root?.['data-ui'] ?? rest['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  const stackIdentity = [...new Set(`game-chip-stack-stack ${slotProps?.stack?.['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  return <WithSx styles={[rootStyle, root?.sx]} sx={sx} className={[className, root?.className].filter(Boolean).join(' ')}>{(classes) =>
    <Root {...rest} {...withoutSx(root)} ref={ref ?? root?.ref} data-ui={rootIdentity} role={label !== undefined ? 'img' : undefined}
      aria-label={label} aria-hidden={label === undefined ? true : undefined} data-dimmed={String(dimmed)} className={classes}
      style={{ ...style, ...root?.style }}>
      {towers.map((chip, towerIndex) => {
        const visible = Math.min(chip.count, maxVisible);
        const rise = (visible - 1) * frame.thickness;
        return <WithSx key={towerIndex} styles={[stackStyle, slotProps?.stack?.sx]} className={slotProps?.stack?.className}>{(stackClasses) =>
          <Stack {...withoutSx(slotProps?.stack)} data-ui={stackIdentity} data-value={chip.value} data-count={chip.count}
            data-flat={String(flat)} aria-hidden="true" className={stackClasses}
            style={{ '--tower-width': `${frame.width}px`, '--tower-height': `${frame.diameter + rise + frame.padding * 2}px`,
              '--tower-padding': `${frame.padding}px`, '--tower-perspective': `${(frame.diameter + rise) * 20}px`,
              ...slotProps?.stack?.style } as CSSProperties}>
            {Array.from({ length: visible }, (_, index) => <span key={index} css={positionStyle} data-ui="game-chip-stack-position"
              style={{ '--chip-rise': `${index * frame.thickness}px`, '--chip-jitter': `${jitter[index % jitter.length]! * frame.diameter}px`,
                '--chip-tilt': `${jitter[(index + 2) % jitter.length]! * 60}deg` } as CSSProperties}>
              <GameChip value={chip.value} tone={chip.tone} size={size} locale={locale} currency={currency} dimmed={dimmed} aria-hidden="true" />
            </span>)}
          </Stack>}
        </WithSx>;
      })}
    </Root>}
  </WithSx>;
}
GameChipStack.displayName = 'GameChipStack';
