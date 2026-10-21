'use client';

import { useEffect, useId, useRef, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { GamePanel, type GamePanelProps, type GamePanelCustomization, type GamePanelSlotProps } from '../game-panel/game-panel';
import { GameHand } from '../game-hand';
import { DEFAULT_HIDDEN_HAND_RULES } from '../game-hand/hand-layout';
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
  /** Neutral container wrapping the player seat elements. */
  root?: GamePanelSlotProps;
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
  root?: ComponentType<GamePanelProps>;
  avatar?: ComponentType<GameSeatPartProps>;
  name?: ComponentType<NonNullable<GameSeatSlotProps['name']>>;
  badges?: ComponentType<GameSeatPartProps>;
  points?: ComponentType<GameSeatPartProps>;
  hand?: ComponentType<GameSeatPartProps>;
  timer?: ComponentType<NonNullable<GameSeatSlotProps['timer']>>;
  chat?: ComponentType<GameSeatPartProps>;
}
export interface GameSeatProps extends Omit<GamePanelProps, 'children'>, Omit<GamePanelCustomization, 'slots'>, DeckArtOptions, SxProps {
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
  /** Hidden hand count; the decorative fan shows at most three backs. */
  handCount?: number;
  /** Compact plaque for a table edge; panel is a larger standalone plaque that includes chat. Defaults to chip. */
  variant?: 'chip' | 'panel';
  /** Decorative avatar fan (at most three backs), localized count, or no shorthand hand. */
  handDisplay?: 'fan' | 'count' | 'none';
  locale?: Intl.LocalesArgument;
  /** Localize the hand count, including its unit. Defaults to the formatted number. */
  formatHandCount?: (count: number, formatted: string) => ReactNode;
  state?: 'idle' | 'active' | 'winner';
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

// Seat anatomy: an opaque medallion with three card backs as shoulders behind it, a nameplate
// plaque that hugs the name and starts under the medallion, and the points on a card-stock coin.
// Turn and winner light a ring around the medallion. The chip root is a fixed, unpainted box, so
// state and hand changes never resize it; text clips inside it while the fan never does.
const MEDALLION = vars.space[12];
const PANEL_MEDALLION = `calc(${vars.space[12]} + ${vars.space[2]})`;
const RING = `calc(${vars.space[1]} - 1px)`;
const COIN = vars.space[8];
const PANEL_COIN = vars.space[10];
const ring = (color: string) => `0 0 0 ${RING} ${color}`;
const glow = (color: string) => `0 0 ${vars.space[3]} ${color}`;
const winnerSettle = keyframes({ from: { boxShadow: `${ring(vars.color.success)}, 0 0 ${vars.space[8]} ${vars.color.success}` } });
const fanReveal = keyframes({ from: { clipPath: 'inset(100% -100% -100% -100%)' }, to: { clipPath: 'inset(-100% -100% -100% -100%)' } });
const rootStyle = css({
  label: 'game-seat', display: 'grid', gridTemplateColumns: `${MEDALLION} minmax(0, max-content) auto`, justifyContent: 'start',
  gridTemplateRows: `minmax(0, 1fr) auto auto auto ${vars.space[3]}`,
  gridTemplateAreas: '"avatar . ." "avatar name points" "avatar badges points" "avatar hand points" "avatar . ."',
  alignItems: 'center', columnGap: vars.space[2], rowGap: 0,
  inlineSize: `calc(4 * ${vars.space[12]})`, blockSize: `calc(${vars.space[12]} + ${vars.space[8]})`, boxSizing: 'border-box',
  maxInlineSize: '100%', position: 'relative', isolation: 'isolate',
  color: vars.color.text, fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.tight,
  fontFamily: vars.font.sans,
  // The chip material paints this pseudo-element: it starts at the medallion's center and hugs the text and coin.
  '&::before': { gridColumn: '1 / -1', gridRow: '2 / 5', alignSelf: 'stretch', zIndex: -1, pointerEvents: 'none',
    marginInlineStart: `calc(${MEDALLION} / 2)`, marginInlineEnd: `calc(-1 * ${vars.space[2]})`, marginBlock: `calc(-1 * ${vars.space[2]})` },
  '&[data-variant="panel"]': {
    gridTemplateColumns: `${PANEL_MEDALLION} minmax(0, 1fr) auto`, gridTemplateRows: 'auto auto', justifyContent: 'stretch',
    gridTemplateAreas: '"avatar name points" "avatar badges points" "hand hand hand" "chat chat chat"',
    columnGap: vars.space[3], rowGap: 0, paddingBlockStart: vars.space[8], inlineSize: `calc(5 * ${vars.space[12]})`, blockSize: 'auto',
  },
  '&[data-turned="true"], &[data-state="active"]': { '--seat-ring-color': vars.color.accent },
  '&[data-state="winner"]': { '--seat-ring-color': vars.color.success },
  '&[data-dimmed="true"]': { color: vars.color.textMuted },
  [FORCED_COLORS]: { color: 'CanvasText', '&[data-turned="true"], &[data-state="active"], &[data-state="winner"]': { '--seat-ring-color': 'Highlight' } },
});
const avatarStyle = css({ position: 'relative', isolation: 'isolate', display: 'grid', placeItems: 'center', gridArea: 'avatar', alignSelf: 'end', justifySelf: 'center',
  inlineSize: MEDALLION, blockSize: MEDALLION, marginBlockEnd: vars.space[1], borderRadius: '50%',
  '[data-variant="panel"] > &': { inlineSize: PANEL_MEDALLION, blockSize: PANEL_MEDALLION, alignSelf: 'start', marginBlockEnd: 0 },
  // A lit seat gets a full ring; with a timer the ring becomes a quiet track under the timer arc.
  '[data-turned="true"] > &, [data-state="active"] > &, [data-state="winner"] > &': { '--seat-ring': ring('var(--seat-ring-color)') },
  '&:has(> [data-ui~="game-seat-timer"])': { '--seat-ring': ring(vars.color.borderSubtle) },
  '[data-state="winner"] > &': { '--seat-glow': glow(vars.color.success) },
});
const avatarContentStyle = css({ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', inlineSize: '100%', blockSize: '100%', boxSizing: 'border-box', borderRadius: '50%',
  border: `1px solid ${vars.color.borderSubtle}`, overflow: 'hidden', backgroundColor: vars.color.surfaceInset,
  boxShadow: `var(--seat-ring, 0 0 0 0 transparent), var(--seat-glow, 0 0 0 0 transparent), ${vars.shadow.raised}`,
  transition: `box-shadow ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  '[data-state="winner"] &': { animation: `${winnerSettle} ${vars.motion.duration.presence} ${vars.motion.easePresence}` },
  '[data-offline="true"] &, [data-dimmed="true"] &': { filter: 'grayscale(1)' },
  [REDUCED_MOTION]: { transition: 'none', '[data-state="winner"] &': { animation: 'none' } },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', borderColor: 'CanvasText', boxShadow: 'none', '[data-state="winner"] &': { animation: 'none' },
    '[data-turned="true"] &, [data-state="active"] &, [data-state="winner"] &': { borderWidth: RING, borderColor: 'Highlight' } },
});
const nameStyle = css({ gridArea: 'name', minInlineSize: 0, maxInlineSize: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  fontSize: vars.textSize.md, fontWeight: vars.fontWeight.semibold, letterSpacing: vars.editorial.tracking.standard,
  '[data-variant="panel"] > &': { alignSelf: 'end', fontSize: vars.textSize.lg },
});
const badgesStyle = css({ gridArea: 'badges', display: 'flex', alignItems: 'center', gap: vars.space[1], minInlineSize: 0, maxInlineSize: '100%', overflow: 'hidden', whiteSpace: 'nowrap',
  marginBlockStart: vars.space[1], color: vars.color.textMuted, fontSize: vars.textSize.xs,
  '[data-variant="panel"] > &': { alignSelf: 'start', flexWrap: 'wrap' },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const pointsStyle = css({ gridArea: 'points', display: 'grid', placeItems: 'center', boxSizing: 'border-box',
  minInlineSize: COIN, blockSize: COIN, paddingInline: vars.space[1], borderRadius: `calc(${COIN} / 2)`, overflow: 'hidden', whiteSpace: 'nowrap',
  border: `1px solid ${vars.color.warning}`, backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
  boxShadow: `inset 0 -1px 0 ${vars.color.borderControl}, ${vars.shadow.raised}`,
  fontSize: vars.textSize.lg, fontWeight: vars.fontWeight.bold, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
  '[data-state="winner"] > &': { boxShadow: `inset 0 -1px 0 ${vars.color.borderControl}, 0 0 0 1px ${vars.color.success}, ${glow(vars.color.successSoft)}` },
  '[data-variant="panel"] > &': { alignSelf: 'center', minInlineSize: PANEL_COIN, blockSize: PANEL_COIN, borderRadius: `calc(${PANEL_COIN} / 2)`, fontSize: vars.textSize.xl },
  [FORCED_COLORS]: { borderColor: 'CanvasText', backgroundColor: 'Canvas', color: 'CanvasText', boxShadow: 'none', '[data-state="winner"] > &': { borderColor: 'Highlight' } },
});
const handStyle = css({ gridArea: 'hand', color: vars.color.textMuted, fontSize: vars.textSize.xs, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  '[data-variant="panel"] > &': { marginBlockStart: vars.space[3] },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const handCountStyle = css({ minInlineSize: 0, maxInlineSize: '100%', overflow: 'hidden', textOverflow: 'ellipsis' });
const chatStyle = css({ gridArea: 'chat', boxSizing: 'border-box', marginBlockStart: vars.space[3], paddingBlock: vars.space[2], paddingInline: vars.space[3],
  display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
  borderRadius: vars.radius.sm, backgroundColor: vars.color.surfaceInset, boxShadow: `inset 0 1px 0 ${vars.color.borderSubtle}`,
  color: vars.color.textMuted, fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.base,
  [FORCED_COLORS]: { border: '1px solid CanvasText', color: 'CanvasText' },
});
// Three backs as shoulders: rotated about their bottom edge, anchored just above the medallion's
// center so the backs clear its rim while their bottoms stay hidden behind it.
const avatarFanRules = { ...DEFAULT_HIDDEN_HAND_RULES, fanSpacingPx: 4, fanArcDepthPx: 2, fanSpreadDeg: 32 };
const FAN_SCALE = 0.7;
const PANEL_FAN_SCALE = 0.85;
const fanSlotProps = { card: { sx: css({ transformOrigin: '50% 100%' }) } };
const fanStyle = css({ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
  animation: `${fanReveal} ${vars.motion.duration.cardDeal} ${vars.motion.easeStandard} both`,
  '& > [data-ui~="game-hand-hidden"]': { position: 'absolute', insetBlockStart: `calc(50% - ${vars.space[3]})`, insetInlineStart: '50%',
    transform: `translate(-50%, -100%) scale(var(--seat-fan-scale, ${FAN_SCALE}))`, transformOrigin: '50% 100%' },
  '&:dir(rtl) > [data-ui~="game-hand-hidden"]': { transform: `translate(50%, -100%) scale(var(--seat-fan-scale, ${FAN_SCALE}))` },
  '[data-variant="panel"] > * > &': { '--seat-fan-scale': PANEL_FAN_SCALE },
  [REDUCED_MOTION]: { animation: 'none' },
  [FORCED_COLORS]: { animation: 'none' },
});
// The timer arc sits on the same band as the ring track, just outside the medallion edge.
const timerStyle = css({
  position: 'absolute', inset: `calc(-1 * ${RING})`, inlineSize: `calc(100% + 2 * ${RING})`, blockSize: `calc(100% + 2 * ${RING})`,
  overflow: 'visible', pointerEvents: 'none', fill: 'none', stroke: `var(--seat-ring-color, ${vars.color.accent})`,
  transform: 'rotate(-90deg)',
  zIndex: 2,
  '& > circle': { r: `calc(50% - ${RING} / 2)`, strokeWidth: RING, strokeLinecap: 'round' },
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
  return <WithSx styles={[timerStyle, slotCss]} className={className}>{(classes) => <Timer {...native} data-ui={identity} aria-hidden="true" focusable="false" className={classes}>
    <circle cx="50%" cy="50%" pathLength="100" strokeDasharray="100"
      strokeDashoffset={offset} data-turn-remaining={remaining} />
  </Timer>}</WithSx>;
}

export function GameSeat({ name, avatar, badges, points, hand, handCount, chat, turn, onTurnMilestone,
  variant = 'chip', handDisplay = 'fan', locale, formatHandCount, state,
  turned = false, offline = false, dimmed = false, slotProps, slots, artSet, cardArtSets, ...props }: GameSeatProps) {
  const nameId = useId();
  const seat = useOptionalGameTableSeat();
  const labelId = slotProps?.name?.id ?? nameId;
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];
  const count = Math.max(0, Math.floor(handCount ?? 0));
  const fan = hand === undefined && handDisplay === 'fan' && count > 0;
  const formattedCount = new Intl.NumberFormat(locale).format(count);
  const handContent = hand !== undefined ? hand : handDisplay === 'count' && handCount !== undefined
    ? formatHandCount ? formatHandCount(count, formattedCount) : formattedCount : undefined;
  const Name = slots?.name ?? 'span';
  const nameIdentity = [...new Set(['game-seat-name', slotProps?.name?.['data-ui']].flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ');
  return <DeckArtProvider artSet={artSet} cardArtSets={cardArtSets}><GamePanel {...props} variant={variant} slots={slots} marker="game-seat" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' '),
      'data-variant': variant, 'data-state': state ?? slotProps?.root?.['data-state'] ?? props['data-state'] ?? 'idle', 'data-turned': String(turned), 'data-offline': String(offline), 'data-dimmed': String(dimmed) }}>
    <SeatPart {...slotProps?.avatar} component={slots?.avatar} marker="avatar" styles={avatarStyle} data-timer-only={!isRenderable(avatar) && turn ? 'true' : undefined}>
      {fan && <SeatPart {...slotProps?.hand} component={slots?.hand} marker="hand" styles={fanStyle} aria-hidden="true">
        <GameHand.Hidden playerKey={seat?.player?.key} count={Math.min(count, 3)} size="sm" rules={avatarFanRules} label="" aria-hidden="true" artSet={artSet} cardArtSets={cardArtSets} slotProps={fanSlotProps} />
      </SeatPart>}
      <span data-ui="game-seat-avatar-content" css={avatarContentStyle}>{avatar}</span>
      {turn && <TurnRing {...slotProps?.timer} component={slots?.timer} turn={turn} onMilestone={onTurnMilestone} />}
    </SeatPart>
    <WithSx styles={[nameStyle, slotProps?.name?.sx]} className={slotProps?.name?.className}>
      {(classes) => <Name {...withoutSx(slotProps?.name)} id={labelId} data-ui={nameIdentity} className={classes}>{name}</Name>}
    </WithSx>
    {isRenderable(badges) && <SeatPart {...slotProps?.badges} component={slots?.badges} marker="badges" styles={badgesStyle}>{badges}</SeatPart>}
    {isRenderable(points) && <SeatPart {...slotProps?.points} component={slots?.points} marker="points" styles={pointsStyle}>{points}</SeatPart>}
    {isRenderable(handContent) && <SeatPart {...slotProps?.hand} component={slots?.hand} marker="hand" styles={[handStyle, hand === undefined && handCountStyle]}>{handContent}</SeatPart>}
    {variant === 'panel' && isRenderable(chat) && <SeatPart {...slotProps?.chat} component={slots?.chat} marker="chat" styles={chatStyle}>{chat}</SeatPart>}
  </GamePanel></DeckArtProvider>;
}
GameSeat.displayName = 'GameSeat';
