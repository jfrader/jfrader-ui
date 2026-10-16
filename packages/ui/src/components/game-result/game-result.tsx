'use client';

// Presentational end-of-match panel. Exposes `outcome` (`'won' | 'lost' | 'draw'`) as data.
// Sets `data-outcome` and `data-tone` (success | danger | neutral) for styling; consumers own
// labels ("victoria", "derrota", "empate"), copy, and actions. Ships the panel surface and
// named slots; celebration effect is consumer-owned (see documented recipe in usage notes).
// Semantics: status region for the terminal state. No focus steal; consumer focuses if modal.
// Reduced motion, forced-colors, RTL and attribute state per house rules.
import type { ComponentPropsWithRef, ComponentType, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { cardPartIdentity } from '../game-card/card-parts';

export type GameResultOutcome = 'won' | 'lost' | 'draw';

export interface GameResultPartProps extends ComponentPropsWithRef<'div'> {
  'data-ui'?: string;
  css?: Interpolation<Theme>;
}


export interface GameResultSlotProps {
  /** Outer card container wrapping the game result panel. */
  root?: GameCardRootSlotProps;
  /** Small label above the title, such as the match stage. */
  eyebrow?: GameResultPartProps;
  /** Headline naming the outcome. */
  title?: GameResultPartProps;
  /** Supporting line below the title. */
  summary?: GameResultPartProps;
  /** Panel holding the reward summary. */
  reward?: GameResultPartProps;
  /** Row holding the buttons that continue or replay. */
  actions?: GameResultPartProps;
  /** Panel holding the celebration artwork. */
  celebration?: GameResultPartProps;
}

export interface GameResultSlots {
  /** Outer card container wrapping the game result panel. */
  root?: ComponentType<GameCardRootProps>;
  /** Small label above the title, such as the match stage. */
  eyebrow?: ComponentType<ComponentPropsWithRef<'div'> & GameResultPartProps>;
  /** Headline naming the outcome. */
  title?: ComponentType<ComponentPropsWithRef<'div'> & GameResultPartProps>;
  /** Supporting line below the title. */
  summary?: ComponentType<ComponentPropsWithRef<'div'> & GameResultPartProps>;
  /** Panel holding the reward summary. */
  reward?: ComponentType<ComponentPropsWithRef<'div'> & GameResultPartProps>;
  /** Row holding the buttons that continue or replay. */
  actions?: ComponentType<ComponentPropsWithRef<'div'> & GameResultPartProps>;
  /** Panel holding the celebration artwork. */
  celebration?: ComponentType<ComponentPropsWithRef<'div'> & GameResultPartProps>;
}

export interface GameResultProps
  extends Omit<GameCardRootProps, 'title' | 'children'>,
    Omit<GameCardRootCustomization, 'slots'>,
    SxProps {
  /** Drives data-outcome + derived tone. Consumer maps to their labels. */
  outcome: GameResultOutcome;
  /** Small label above title (consumer copy, e.g. "Partida finalizada"). */
  eyebrow?: ReactNode;
  /** Main result heading (consumer copy). */
  title?: ReactNode;
  /** Short explanation or score line. */
  summary?: ReactNode;
  /** Optional reward/trophy area (consumer content). */
  reward?: ReactNode;
  /** Caller-owned actions (Button etc). Rendered as given. */
  actions?: ReactNode;
  /** Consumer celebration effect (e.g. deterministic particles). Positioned to overlay. */
  celebration?: ReactNode;
  slotProps?: GameResultSlotProps;
  slots?: GameResultSlots;
}

const rootStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[3],
  paddingBlock: vars.space[6],
  paddingInline: vars.space[5],
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  textAlign: 'center',
  overflow: 'clip',
  // ensure state visible in forced colors too
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
  },
});

const accentStyle = css({
  position: 'absolute',
  insetInline: 0,
  insetBlockStart: 0,
  blockSize: vars.space[1],
  backgroundColor: vars.color.borderSubtle,
  pointerEvents: 'none',
  [FORCED_COLORS]: {
    backgroundColor: 'CanvasText',
  },
});

const accentOutcomeStyles: Record<GameResultOutcome, SerializedStyles> = {
  won: css({ backgroundColor: vars.color.success }),
  lost: css({ backgroundColor: vars.color.danger }),
  draw: css({ backgroundColor: vars.color.borderSubtle }),
};

const eyebrowStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.xl,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  color: vars.color.text,
  textWrap: 'balance',
});

const summaryStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  maxInlineSize: '30ch',
  textWrap: 'pretty',
});

const rewardStyle = css({
  marginBlock: vars.space[2],
  paddingBlock: vars.space[3],
  paddingInline: vars.space[4],
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.borderSubtle}`,
  fontSize: vars.textSize.sm,
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
  },
});

const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  justifyContent: 'center',
  marginBlockStart: vars.space[2],
});

const celebrationStyle = css({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 1,
  // celebration content is consumer owned; keep transparent to layout
});

function outcomeToTone(outcome: GameResultOutcome): 'success' | 'danger' | 'neutral' {
  if (outcome === 'won') return 'success';
  if (outcome === 'lost') return 'danger';
  return 'neutral';
}

export function GameResult({
  outcome,
  eyebrow,
  title,
  summary,
  reward,
  actions,
  celebration,
  slotProps,
  slots,
  component,
  ...props
}: GameResultProps) {
  const tone = outcomeToTone(outcome);
  const hasEyebrow = isRenderable(eyebrow);
  const hasTitle = isRenderable(title);
  const hasSummary = isRenderable(summary);
  const hasReward = isRenderable(reward);
  const hasActions = isRenderable(actions);
  const hasCelebration = isRenderable(celebration);

  const Eyebrow = slots?.eyebrow ?? 'div';
  const Title = slots?.title ?? 'div';
  const Summary = slots?.summary ?? 'div';
  const Reward = slots?.reward ?? 'div';
  const Actions = slots?.actions ?? 'div';
  const Celebration = slots?.celebration ?? 'div';

  const eyebrowIdentity = cardPartIdentity('game-result-eyebrow', slotProps?.eyebrow?.['data-ui']);
  const titleIdentity = cardPartIdentity('game-result-title', slotProps?.title?.['data-ui']);
  const summaryIdentity = cardPartIdentity('game-result-summary', slotProps?.summary?.['data-ui']);
  const rewardIdentity = cardPartIdentity('game-result-reward', slotProps?.reward?.['data-ui']);
  const actionsIdentity = cardPartIdentity('game-result-actions', slotProps?.actions?.['data-ui']);
  const celebrationIdentity = cardPartIdentity('game-result-celebration', slotProps?.celebration?.['data-ui']);

  return (
    <CardRoot
      {...props}
      component={component}
      slots={slots}
      marker="game-result"
      structure={rootStyle}
      rootSlot={slotProps?.root}
      attributes={{
        role: 'status',
        'aria-atomic': 'true',
        'data-outcome': outcome,
        'data-tone': tone,
      }}
    >
      <div
        data-ui="game-result-accent"
        aria-hidden="true"
        css={[accentStyle, accentOutcomeStyles[outcome]]}
      />
      {hasEyebrow && (
        <Eyebrow
          {...slotProps?.eyebrow}
          data-ui={eyebrowIdentity}
          className={slotProps?.eyebrow?.className}
          css={[eyebrowStyle, slotProps?.eyebrow?.css]}
        >
          {eyebrow}
        </Eyebrow>
      )}
      {hasTitle && (
        <Title
          {...slotProps?.title}
          data-ui={titleIdentity}
          className={slotProps?.title?.className}
          css={[titleStyle, slotProps?.title?.css]}
        >
          {title}
        </Title>
      )}
      {hasSummary && (
        <Summary
          {...slotProps?.summary}
          data-ui={summaryIdentity}
          className={slotProps?.summary?.className}
          css={[summaryStyle, slotProps?.summary?.css]}
        >
          {summary}
        </Summary>
      )}
      {hasReward && (
        <Reward
          {...slotProps?.reward}
          data-ui={rewardIdentity}
          className={slotProps?.reward?.className}
          css={[rewardStyle, slotProps?.reward?.css]}
        >
          {reward}
        </Reward>
      )}
      {hasActions && (
        <Actions
          {...slotProps?.actions}
          data-ui={actionsIdentity}
          className={slotProps?.actions?.className}
          css={[actionsStyle, slotProps?.actions?.css]}
        >
          {actions}
        </Actions>
      )}
      {hasCelebration && (
        <Celebration
          {...slotProps?.celebration}
          data-ui={celebrationIdentity}
          className={slotProps?.celebration?.className}
          css={[celebrationStyle, slotProps?.celebration?.css]}
        >
          {celebration}
        </Celebration>
      )}
    </CardRoot>
  );
}

GameResult.displayName = 'GameResult';
