'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { REDUCED_MOTION, FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { GameHand } from '../game-hand';
import { useOptionalGameTableSeat } from '../game-table/game-table';

export type GameSeatTurnMilestone = 'half' | 'quarter' | 'extended' | 'ending';
export interface GameSeatTurn {
  /** End of the turn, in epoch milliseconds. */
  deadline: number;
  /** Full turn length in milliseconds; must be positive. */
  durationMs: number;
  /** Current epoch milliseconds. Omit to sample the clock when deadline or duration changes. */
  now?: number;
}
export type GameSeatPartProps = ComponentPropsWithRef<'div'> & { css?: Interpolation<Theme> };
export interface GameSeatSlotProps {
  root?: GameCardRootSlotProps;
  avatar?: GameSeatPartProps;
  name?: ComponentPropsWithRef<'span'> & { css?: Interpolation<Theme> };
  badges?: GameSeatPartProps;
  points?: GameSeatPartProps;
  hand?: GameSeatPartProps;
  timer?: ComponentPropsWithRef<'svg'> & { css?: Interpolation<Theme> };
  chat?: GameSeatPartProps;
}
export interface GameSeatProps extends Omit<GameCardRootProps, 'children'>, GameCardRootCustomization, SxProps {
  /** Player name, used to name this seat. */
  name: string;
  avatar?: ReactNode;
  badges?: ReactNode;
  points?: ReactNode;
  chat?: ReactNode;
  /** Replace the hidden-hand shorthand with your own content. */
  hand?: ReactNode;
  /** Render a decorative GameHand.Hidden when `hand` is absent. */
  handCount?: number;
  turn?: GameSeatTurn;
  /** Notify once at each remaining-time threshold: 50%, 25%, and zero. Increasing a live deadline emits `extended`. */
  onTurnMilestone?: (milestone: GameSeatTurnMilestone) => void;
  turned?: boolean;
  offline?: boolean;
  dimmed?: boolean;
  slotProps?: GameSeatSlotProps;
}

const rootStyle = css({
  label: 'game-seat', display: 'grid', justifyItems: 'center', gap: vars.space[1],
  color: vars.color.text, fontSize: vars.textSize.sm,
  '&[data-dimmed="true"]': { color: vars.color.textMuted },
  '&[data-offline="true"]': { outline: `1px dashed ${vars.color.borderControl}`, outlineOffset: vars.space[1] },
});
const avatarStyle = css({ position: 'relative', display: 'grid', placeItems: 'center' });
const nameStyle = css({ fontWeight: vars.fontWeight.semibold });
const badgesStyle = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: vars.space[1] });
const timerStyle = css({
  position: 'absolute', inset: `calc(-1 * ${vars.space[1]})`,
  inlineSize: `calc(100% + 2 * ${vars.space[1]})`, blockSize: `calc(100% + 2 * ${vars.space[1]})`,
  overflow: 'visible', pointerEvents: 'none', fill: 'none', stroke: vars.color.accent,
  transform: 'rotate(-90deg)',
  '& > circle': { transitionProperty: 'stroke-dashoffset', transitionTimingFunction: 'linear' },
  [REDUCED_MOTION]: { '& > circle': { transitionProperty: 'none' } },
  [FORCED_COLORS]: { stroke: 'Highlight' },
});
const emptyStyle = css({});

function SeatPart({ marker, styles = emptyStyle, children, css: slotCss, ...props }: GameSeatPartProps & {
  marker: string; styles?: Interpolation<Theme>;
}) {
  return <div {...props} data-ui={`game-seat-${marker}`} css={[styles, slotCss]}>{children}</div>;
}

function TurnRing({ turn, onMilestone, ...props }: { turn: GameSeatTurn; onMilestone?: GameSeatProps['onTurnMilestone'] } & NonNullable<GameSeatSlotProps['timer']>) {
  const circle = useRef<SVGCircleElement>(null);
  const [sample, setSample] = useState<{ deadline: number; durationMs: number; now: number }>();
  useLayoutEffect(() => {
    if (turn.now === undefined) setSample({ deadline: turn.deadline, durationMs: turn.durationMs, now: Date.now() });
  }, [turn.deadline, turn.durationMs, turn.now]);
  const synchronized = turn.now !== undefined || (sample?.deadline === turn.deadline && sample?.durationMs === turn.durationMs);
  const now = turn.now ?? sample?.now ?? turn.deadline;
  const remaining = Math.max(0, turn.deadline - now);
  const fraction = turn.durationMs > 0 ? Math.min(1, remaining / turn.durationMs) : 0;
  const offset = (1 - fraction) * 100;
  const callback = useRef(onMilestone);
  callback.current = onMilestone;
  const previousDeadline = useRef(turn.deadline);
  const emitted = useRef(new Set<GameSeatTurnMilestone>());
  useLayoutEffect(() => {
    const node = circle.current;
    if (!node || !synchronized) return;
    node.style.transitionDuration = '0ms';
    node.style.strokeDashoffset = String(offset);
    node.getBoundingClientRect();
    node.style.transitionDuration = `${remaining}ms`;
    if (!node.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.style.strokeDashoffset = '100';
    }
  }, [turn.deadline, turn.durationMs, now, offset, remaining, synchronized]);
  useEffect(() => {
    if (!synchronized) return;
    const currentNow = turn.now ?? (onMilestone ? Date.now() : now);
    if (previousDeadline.current !== turn.deadline) {
      if (turn.deadline > previousDeadline.current && previousDeadline.current > currentNow) callback.current?.('extended');
      previousDeadline.current = turn.deadline;
      emitted.current.clear();
    }
    if (!onMilestone || turn.durationMs <= 0) return;
    const thresholds = [{ milestone: 'half', fraction: 0.5 }, { milestone: 'quarter', fraction: 0.25 }, { milestone: 'ending', fraction: 0 }] as const;
    const timers = thresholds.flatMap(({ milestone, fraction: threshold }) => {
      const delay = turn.deadline - turn.durationMs * threshold - currentNow;
      if (delay < 0 || emitted.current.has(milestone)) return [];
      return [setTimeout(() => {
        emitted.current.add(milestone);
        callback.current?.(milestone);
      }, delay)];
    });
    return () => timers.forEach(clearTimeout);
  }, [turn.deadline, turn.durationMs, now, !!onMilestone, synchronized]);
  const { css: slotCss, ...native } = props;
  return <svg {...native} data-ui="game-seat-timer" aria-hidden="true" focusable="false" viewBox="0 0 100 100" css={[timerStyle, slotCss]}>
    <circle ref={circle} cx="50" cy="50" r="48" pathLength="100" strokeWidth="3" strokeDasharray="100"
      strokeDashoffset={offset} data-turn-remaining={remaining} />
  </svg>;
}

export function GameSeat({ name, avatar, badges, points, hand, handCount, chat, turn, onTurnMilestone,
  turned = turn !== undefined, offline = false, dimmed = false, slotProps, ...props }: GameSeatProps) {
  const nameId = useId();
  const seat = useOptionalGameTableSeat();
  const labelId = slotProps?.name?.id ?? nameId;
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];
  const handContent = hand !== undefined ? hand : handCount !== undefined
    ? <GameHand.Hidden playerKey={seat?.player?.key} count={handCount} label="" aria-hidden="true" /> : undefined;
  return <CardRoot {...props} marker="game-seat" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' '),
      'data-turned': String(turned), 'data-offline': String(offline), 'data-dimmed': String(dimmed) }}>
    {(isRenderable(avatar) || turn) && <SeatPart {...slotProps?.avatar} marker="avatar" styles={avatarStyle}>
      {avatar}
      {turn && <TurnRing {...slotProps?.timer} turn={turn} onMilestone={onTurnMilestone} />}
    </SeatPart>}
    <span {...slotProps?.name} id={labelId} data-ui="game-seat-name" css={[nameStyle, slotProps?.name?.css]}>{name}</span>
    {isRenderable(badges) && <SeatPart {...slotProps?.badges} marker="badges" styles={badgesStyle}>{badges}</SeatPart>}
    {isRenderable(points) && <SeatPart {...slotProps?.points} marker="points">{points}</SeatPart>}
    {isRenderable(handContent) && <SeatPart {...slotProps?.hand} marker="hand">{handContent}</SeatPart>}
    {isRenderable(chat) && <SeatPart {...slotProps?.chat} marker="chat">{chat}</SeatPart>}
  </CardRoot>;
}
GameSeat.displayName = 'GameSeat';
