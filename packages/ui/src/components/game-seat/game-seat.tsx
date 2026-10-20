'use client';

import { useEffect, useId, useRef, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { GameHand } from '../game-hand';
import { useOptionalGameTableSeat } from '../game-table/game-table';
import { DeckArtProvider, type DeckArtOptions } from '../deck/art-context';

export type GameSeatTurnMilestone = 'half' | 'quarter' | 'extended' | 'ending';
export interface GameSeatTurn {
  /** Caller-owned remaining time, in milliseconds. */
  remainingMs: number;
  /** Full turn length in milliseconds; must be positive. */
  durationMs: number;
}
type SeatPartStyling = { sx?: Interpolation<Theme>; 'data-ui'?: string };
export type GameSeatPartProps = ComponentPropsWithRef<'div'> & SeatPartStyling;
export interface GameSeatSlotProps {
  /** Outer card container wrapping the player seat elements. */
  root?: GameCardRootSlotProps;
  /** Avatar container holding the player picture and turn timer ring. */
  avatar?: GameSeatPartProps;
  /** Text element displaying the player name. */
  name?: ComponentPropsWithRef<'span'> & SeatPartStyling;
  /** Container element holding player badges. */
  badges?: GameSeatPartProps;
  /** Container element displaying player points or score. */
  points?: GameSeatPartProps;
  /** Container element holding player cards or hidden hand indicator. */
  hand?: GameSeatPartProps;
  /** SVG element displaying the remaining turn time. */
  timer?: ComponentPropsWithRef<'svg'> & SeatPartStyling;
  /** Container element holding speech bubbles or chat messages. */
  chat?: GameSeatPartProps;
}
export interface GameSeatSlots {
  root?: ComponentType<GameCardRootProps>;
  avatar?: ComponentType<GameSeatPartProps>;
  name?: ComponentType<NonNullable<GameSeatSlotProps['name']>>;
  badges?: ComponentType<GameSeatPartProps>;
  points?: ComponentType<GameSeatPartProps>;
  hand?: ComponentType<GameSeatPartProps>;
  timer?: ComponentType<NonNullable<GameSeatSlotProps['timer']>>;
  chat?: ComponentType<GameSeatPartProps>;
}
export interface GameSeatProps extends Omit<GameCardRootProps, 'children'>, Omit<GameCardRootCustomization, 'slots'>, DeckArtOptions, SxProps {
  /** Player name, used to name this seat. */
  name: string;
  /** Show player artwork inside the turn timer ring. */
  avatar?: ReactNode;
  /** Show badges below the player name. */
  badges?: ReactNode;
  /** Show a score below the badges. */
  points?: ReactNode;
  /** Show a message below the player's hand. */
  chat?: ReactNode;
  /** Replace the hidden-hand shorthand with your own content. */
  hand?: ReactNode;
  /** Render a decorative GameHand.Hidden when `hand` is absent. */
  handCount?: number;
  /** Show a timer ring using caller-owned remaining time and full turn duration. */
  turn?: GameSeatTurn;
  /** Notify on crossings of 50%, 25%, and zero. Increasing remainingMs emits extended and rearms thresholds. */
  onTurnMilestone?: (milestone: GameSeatTurnMilestone) => void;
  /** Set the `data-turned` state independently of `turn`. Defaults to `false`. */
  turned?: boolean;
  /** Outline the seat with a dashed border. Defaults to `false`. */
  offline?: boolean;
  /** Mute the seat's text colour. Defaults to `false`. */
  dimmed?: boolean;
  /** Pass props and `sx` to the seat's rendered parts. */
  slotProps?: GameSeatSlotProps;
  /** Replace the card root or individual seat parts. */
  slots?: GameSeatSlots;
}

const rootStyle = css({
  label: 'game-seat', display: 'grid', justifyItems: 'center', gap: vars.space[1],
  color: vars.color.text, fontSize: vars.textSize.sm,
  '&[data-dimmed="true"]': { color: vars.color.textMuted },
  '&[data-offline="true"]': { outline: `1px dashed ${vars.color.borderControl}`, outlineOffset: vars.space[1] },
});
const avatarStyle = css({ position: 'relative', display: 'grid', placeItems: 'center',
  '&[data-timer-only="true"]': { inlineSize: vars.space[10], blockSize: vars.space[10] },
});
const nameStyle = css({ fontWeight: vars.fontWeight.semibold });
const badgesStyle = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: vars.space[1] });
const timerStyle = css({
  position: 'absolute', inset: `calc(-1 * ${vars.space[1]})`,
  inlineSize: `calc(100% + 2 * ${vars.space[1]})`, blockSize: `calc(100% + 2 * ${vars.space[1]})`,
  overflow: 'visible', pointerEvents: 'none', fill: 'none', stroke: vars.color.accent,
  transform: 'rotate(-90deg)',
  [FORCED_COLORS]: { stroke: 'Highlight' },
});
const emptyStyle = css({});

function SeatPart({ marker, component, styles = emptyStyle, children, sx: slotCss, className, ...props }: GameSeatPartProps & {
  marker: string; styles?: Interpolation<Theme>; component?: ComponentType<GameSeatPartProps>;
}) {
  const Part = component ?? 'div';
  const identity = [...new Set([`game-seat-${marker}`, props['data-ui']].flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ');
  return <WithSx styles={[styles, slotCss]} className={className}>
    {(classes) => <Part {...props} data-ui={identity} className={classes}>{children}</Part>}
  </WithSx>;
}

function TurnRing({ turn, onMilestone, component, ...props }: { turn: GameSeatTurn; onMilestone?: GameSeatProps['onTurnMilestone']; component?: GameSeatSlots['timer'] } & NonNullable<GameSeatSlotProps['timer']>) {
  const Timer = component ?? 'svg';
  const remaining = Math.max(0, turn.remainingMs);
  const fraction = turn.durationMs > 0 ? Math.min(1, remaining / turn.durationMs) : 0;
  const offset = (1 - fraction) * 100;
  const previous = useRef({ remaining, fraction });
  const previousDuration = useRef(turn.durationMs);
  const fired = useRef(new Set<GameSeatTurnMilestone>());
  useEffect(() => {
    const before = previous.current;
    previous.current = { remaining, fraction };
    if (previousDuration.current !== turn.durationMs) {
      previousDuration.current = turn.durationMs;
      fired.current.clear();
    }
    if (remaining > before.remaining) {
      fired.current.clear();
      onMilestone?.('extended');
      return;
    }
    if (turn.durationMs <= 0) return;
    const thresholds = [{ milestone: 'half', fraction: 0.5 }, { milestone: 'quarter', fraction: 0.25 }, { milestone: 'ending', fraction: 0 }] as const;
    for (const { milestone, fraction: threshold } of thresholds) {
      const crossed = (before.fraction > threshold || (before.fraction === threshold && fraction < threshold)) &&
        fraction <= threshold && !fired.current.has(milestone);
      if (crossed) {
        fired.current.add(milestone);
        onMilestone?.(milestone);
      }
    }
  }, [remaining, fraction, turn.durationMs, onMilestone]);
  const { sx: slotCss, className, ...native } = props;
  const identity = [...new Set(['game-seat-timer', native['data-ui']].flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ');
  return <WithSx styles={[timerStyle, slotCss]} className={className}>{(classes) => <Timer {...native} data-ui={identity} aria-hidden="true" focusable="false" viewBox="0 0 100 100" className={classes}>
    <circle cx="50" cy="50" r="48" pathLength="100" strokeWidth="3" strokeDasharray="100"
      strokeDashoffset={offset} data-turn-remaining={remaining} />
  </Timer>}</WithSx>;
}

export function GameSeat({ name, avatar, badges, points, hand, handCount, chat, turn, onTurnMilestone,
  turned = false, offline = false, dimmed = false, slotProps, slots, artSet, cardArtSets, ...props }: GameSeatProps) {
  const nameId = useId();
  const seat = useOptionalGameTableSeat();
  const labelId = slotProps?.name?.id ?? nameId;
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];
  const handContent = hand !== undefined ? hand : handCount !== undefined
    ? <GameHand.Hidden playerKey={seat?.player?.key} count={handCount} label="" aria-hidden="true" artSet={artSet} cardArtSets={cardArtSets} /> : undefined;
  const Name = slots?.name ?? 'span';
  const nameIdentity = [...new Set(['game-seat-name', slotProps?.name?.['data-ui']].flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ');
  return <DeckArtProvider artSet={artSet} cardArtSets={cardArtSets}><CardRoot {...props} slots={slots} marker="game-seat" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' '),
      'data-turned': String(turned), 'data-offline': String(offline), 'data-dimmed': String(dimmed) }}>
    {(isRenderable(avatar) || turn) && <SeatPart {...slotProps?.avatar} component={slots?.avatar} marker="avatar" styles={avatarStyle} data-timer-only={!isRenderable(avatar) && turn ? 'true' : undefined}>
      {avatar}
      {turn && <TurnRing {...slotProps?.timer} component={slots?.timer} turn={turn} onMilestone={onTurnMilestone} />}
    </SeatPart>}
    <WithSx styles={[nameStyle, slotProps?.name?.sx]} className={slotProps?.name?.className}>
      {(classes) => <Name {...withoutSx(slotProps?.name)} css={undefined} id={labelId} data-ui={nameIdentity} className={classes}>{name}</Name>}
    </WithSx>
    {isRenderable(badges) && <SeatPart {...slotProps?.badges} component={slots?.badges} marker="badges" styles={badgesStyle}>{badges}</SeatPart>}
    {isRenderable(points) && <SeatPart {...slotProps?.points} component={slots?.points} marker="points">{points}</SeatPart>}
    {isRenderable(handContent) && <SeatPart {...slotProps?.hand} component={slots?.hand} marker="hand">{handContent}</SeatPart>}
    {isRenderable(chat) && <SeatPart {...slotProps?.chat} component={slots?.chat} marker="chat">{chat}</SeatPart>}
  </CardRoot></DeckArtProvider>;
}
GameSeat.displayName = 'GameSeat';
