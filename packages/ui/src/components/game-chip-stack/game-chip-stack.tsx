'use client';

import { useId, type ComponentPropsWithRef, type ComponentType, type CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { GameChip, GAME_CHIP_SIZES, chipMaterialStyle, type GameChipSize, type GameChipTone } from '../game-chip/game-chip';

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
const PROJECTION = 0.58;
const THICKNESS = 0.18;
const SHADOW_PADDING = 0.08;
const HORIZONTAL_PADDING = 0.08;
const jitter = [
  { x: -0.012, y: 0, angle: -3 }, { x: 0.015, y: 0.003, angle: 4 },
  { x: -0.008, y: -0.002, angle: -2 }, { x: 0.006, y: 0.002, angle: 1 },
  { x: 0, y: 0, angle: -4 }, { x: 0.01, y: -0.003, angle: 3 },
] as const;
const bandStyle = css({ position: 'absolute', insetInlineStart: 'var(--band-x)', insetBlockStart: 'var(--band-y)',
  inlineSize: 'var(--tower-diameter)', blockSize: 'var(--band-height)',
  '& > svg': { display: 'block', overflow: 'visible', inlineSize: '100%', blockSize: 'var(--band-drawing-height)' },
  [FORCED_COLORS]: { color: 'CanvasText' },
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
  display: 'inline-grid', transformOrigin: '50% 0', zIndex: 1,
  transform: 'scaleY(var(--tower-projection))',
  '[data-flat="true"] > &': { transform: 'translateX(var(--chip-jitter)) rotate(var(--chip-tilt))' },
});

function SideBand({ value, tone, dimmed, index, diameter }: GameChipStackChip & { dimmed: boolean; index: number; diameter: number }) {
  const id = useId();
  const curve = PROJECTION * 50;
  const band = THICKNESS * 100;
  const top = `M0 0 A50 ${curve} 0 0 0 100 0`;
  const bottom = `M0 ${band} A50 ${curve} 0 0 0 100 ${band}`;
  const shape = `${top} L100 ${band} A50 ${curve} 0 0 1 0 ${band} Z`;
  const offset = index === 0 ? 0 : jitter[index % jitter.length]!.angle * 2;
  return <span css={bandStyle} data-ui="game-chip-stack-band" style={{
    ...chipMaterialStyle(value, tone, dimmed), '--band-x': `calc(var(--tower-padding) + ${jitter[index % jitter.length]!.x * diameter * 0.4}px)`,
    '--band-y': `calc(var(--tower-padding) + ${diameter * PROJECTION / 2 + index * diameter * THICKNESS}px)`,
  } as CSSProperties}>
    <svg viewBox={`0 0 100 ${curve + band}`} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}><path d={shape} /></clipPath>
        <linearGradient id={`${id}-shade`}><stop stopColor={vars.color.chipInk} stopOpacity=".45" /><stop offset=".35" stopColor={vars.color.chipSpot} stopOpacity=".06" /><stop offset="1" stopColor={vars.color.chipInk} stopOpacity=".5" /></linearGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <path d={shape} fill="var(--chip-tone)" />
        {[10, 43, 78].map(x => <rect key={x} x={x + offset} y="0" width="14" height={curve + band} fill="var(--chip-spot)" />)}
        <path d={shape} fill={`url(#${id}-shade)`} />
        <path d={top} fill="none" stroke={vars.color.chipSpot} strokeOpacity=".5" strokeWidth="1.4" />
        <path d={bottom} fill="none" stroke={vars.color.chipInk} strokeOpacity=".85" strokeWidth="2" />
      </g>
    </svg>
  </span>;
}

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
  const rootIdentity = [...new Set(`game-chip-stack ${root?.['data-ui'] ?? rest['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  const stackIdentity = [...new Set(`game-chip-stack-stack ${slotProps?.stack?.['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
  return <WithSx styles={[rootStyle, root?.sx]} sx={sx} className={[className, root?.className].filter(Boolean).join(' ')}>{(classes) =>
    <Root {...rest} {...withoutSx(root)} ref={ref ?? root?.ref} data-ui={rootIdentity} role={accessibleLabel !== undefined ? 'img' : undefined}
      aria-label={accessibleLabel} aria-hidden={accessibleLabel === undefined ? true : undefined} data-dimmed={String(dimmed)} className={classes}
      style={{ ...style, ...root?.style }}>
      {towers.map((chip, towerIndex) => {
        const visible = Math.min(chip.count, maxVisible);
        const height = flat ? diameter + (visible - 1) * thickness : diameter * PROJECTION + visible * thickness;
        return <WithSx key={towerIndex} styles={[stackStyle, slotProps?.stack?.sx]} className={slotProps?.stack?.className}>{(stackClasses) =>
          <Stack {...withoutSx(slotProps?.stack)} data-ui={stackIdentity} data-value={chip.value} data-count={chip.count}
            data-flat={String(flat)} data-visible={visible} aria-hidden="true" className={stackClasses}
            style={{ '--tower-width': `${diameter * (1 + HORIZONTAL_PADDING * 2)}px`, '--tower-height': `${height + padding * 2}px`,
              '--tower-padding': `${diameter * HORIZONTAL_PADDING}px`, '--tower-diameter': `${diameter}px`, '--tower-projection': PROJECTION,
              '--band-height': `${thickness}px`, '--band-drawing-height': `${diameter * PROJECTION / 2 + thickness}px`,
              '--tower-shadow-height': `${diameter * 0.14}px`, '--tower-shadow-blur': `${diameter * 0.035}px`,
              ...slotProps?.stack?.style } as CSSProperties}>
            {!flat && Array.from({ length: visible }, (_, index) => <SideBand key={index} {...chip} dimmed={dimmed} index={visible - index - 1} diameter={diameter} />)}
            {Array.from({ length: flat ? visible : 1 }, (_, index) => <span key={index} css={positionStyle} data-ui="game-chip-stack-position"
              style={{ '--chip-top': `${padding + (flat ? (visible - index - 1) * thickness : 0)}px`,
                '--chip-jitter': `${jitter[index % jitter.length]!.x * diameter}px`,
                '--chip-tilt': `${jitter[index % jitter.length]!.angle}deg` } as CSSProperties}>
              <GameChip value={chip.value} tone={chip.tone} size={size} locale={locale} currency={currency} dimmed={dimmed} aria-hidden="true" />
            </span>)}
          </Stack>}
        </WithSx>;
      })}
    </Root>}
  </WithSx>;
}
GameChipStack.displayName = 'GameChipStack';
