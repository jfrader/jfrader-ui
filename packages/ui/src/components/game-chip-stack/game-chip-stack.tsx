'use client';

import type { ComponentPropsWithRef, ComponentType, CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { GameChip, GAME_CHIP_SIZES, type GameChipSize, type GameChipTone } from '../game-chip/game-chip';

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
  /** Names the image. Omitted or empty labels make the entire stack decorative. Include the real total when chips are capped. */
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
const TILT = 48;
const TILT_RADIANS = TILT * Math.PI / 180;
const THICKNESS = 0.18;
const PERSPECTIVE = 4;
const SHADOW_PADDING = 0.08;
const HORIZONTAL_PADDING = 0.12;
const jitter = [
  { x: -0.012, y: 0, angle: -3 }, { x: 0.015, y: 0.003, angle: 4 },
  { x: -0.008, y: -0.002, angle: -2 }, { x: 0.006, y: 0.002, angle: 1 },
  { x: 0, y: 0, angle: -4 }, { x: 0.01, y: -0.003, angle: 3 },
] as const;
const sideStyle = css({
  boxShadow: Array.from({ length: 12 }, (_, index) =>
    `0 calc(var(--chip-thickness) * ${(index + 1) / 12}) 0 color-mix(in srgb, var(--chip-tone) ${index === 11 ? 40 : 68}%, ${vars.color.chipInk})`).join(', '),
  [FORCED_COLORS]: { boxShadow: 'none' },
});
const rootStyle = css({ label: 'game-chip-stack', display: 'inline-flex', alignItems: 'end', flexWrap: 'wrap',
  gap: vars.space[2], verticalAlign: 'middle', maxInlineSize: '100%', boxSizing: 'border-box' });
const stackStyle = css({ position: 'relative', display: 'inline-block', flexShrink: 0,
  inlineSize: 'var(--tower-width)', blockSize: 'var(--tower-height)', isolation: 'isolate',
  '&::before': { content: '""', position: 'absolute', insetInlineStart: '5%', insetBlockEnd: 0,
    inlineSize: '90%', blockSize: 'var(--tower-shadow-height)', borderRadius: '50%',
    background: vars.color.chipInk, opacity: 0.35, filter: 'blur(var(--tower-shadow-blur))', zIndex: -1 },
});
const positionStyle = css({ position: 'absolute', insetInlineStart: 'var(--tower-padding)', insetBlockStart: 'var(--chip-top)',
  display: 'inline-grid', transformStyle: 'preserve-3d',
  transform: `translateX(var(--chip-jitter)) perspective(var(--tower-perspective)) rotateX(${TILT}deg) rotate(var(--chip-tilt))`,
  '[data-flat="true"] > &': { transform: 'translateX(var(--chip-jitter)) rotate(var(--chip-tilt))' },
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
  const accessibleLabel = label || undefined;
  const diameter = GAME_CHIP_SIZES[size];
  const thickness = diameter * THICKNESS;
  const padding = diameter * SHADOW_PADDING;
  const cosine = flat ? 1 : Math.cos(TILT_RADIANS);
  const sine = flat ? 0 : Math.sin(TILT_RADIANS);
  const topExtent = diameter * 0.5 * cosine / (1 + 0.5 * sine / PERSPECTIVE);
  const bottomExtent = diameter * (0.5 + (flat ? 0 : THICKNESS)) * cosine / (1 - (0.5 + THICKNESS) * sine / PERSPECTIVE);
  const rootIdentity = [...new Set(`game-chip-stack ${root?.['data-ui'] ?? rest['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  const stackIdentity = [...new Set(`game-chip-stack-stack ${slotProps?.stack?.['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  return <WithSx styles={[rootStyle, root?.sx]} sx={sx} className={[className, root?.className].filter(Boolean).join(' ')}>{(classes) =>
    <Root {...rest} {...withoutSx(root)} ref={ref ?? root?.ref} data-ui={rootIdentity} role={accessibleLabel !== undefined ? 'img' : undefined}
      aria-label={accessibleLabel} aria-hidden={accessibleLabel === undefined ? true : undefined} data-dimmed={String(dimmed)} className={classes}
      style={{ ...style, ...root?.style }}>
      {towers.map((chip, towerIndex) => {
        const visible = Math.min(chip.count, maxVisible);
        const rise = (visible - 1) * thickness * cosine;
        return <WithSx key={towerIndex} styles={[stackStyle, slotProps?.stack?.sx]} className={slotProps?.stack?.className}>{(stackClasses) =>
          <Stack {...withoutSx(slotProps?.stack)} data-ui={stackIdentity} data-value={chip.value} data-count={chip.count}
            data-flat={String(flat)} aria-hidden="true" className={stackClasses}
            style={{ '--tower-width': `${diameter * (1 + HORIZONTAL_PADDING * 2)}px`, '--tower-height': `${topExtent + bottomExtent + rise + padding * 2}px`,
              '--tower-padding': `${diameter * HORIZONTAL_PADDING}px`, '--tower-perspective': `${diameter * PERSPECTIVE}px`,
              '--tower-shadow-height': `${diameter * 0.14}px`, '--tower-shadow-blur': `${diameter * 0.035}px`,
              '--chip-thickness': `${flat ? 0 : thickness}px`,
              '--chip-edge-display': flat ? 'none' : 'block',
              ...slotProps?.stack?.style } as CSSProperties}>
            {Array.from({ length: visible }, (_, index) => <span key={index} css={positionStyle} data-ui="game-chip-stack-position"
              style={{ '--chip-top': `${padding + topExtent - diameter / 2 + rise - index * thickness * cosine + jitter[index % jitter.length]!.y * diameter}px`,
                '--chip-jitter': `${jitter[index % jitter.length]!.x * diameter}px`,
                '--chip-tilt': `${jitter[index % jitter.length]!.angle}deg` } as CSSProperties}>
              <GameChip value={chip.value} tone={chip.tone} size={size} locale={locale} currency={currency} dimmed={dimmed} aria-hidden="true" sx={flat ? undefined : sideStyle} />
            </span>)}
          </Stack>}
        </WithSx>;
      })}
    </Root>}
  </WithSx>;
}
GameChipStack.displayName = 'GameChipStack';
