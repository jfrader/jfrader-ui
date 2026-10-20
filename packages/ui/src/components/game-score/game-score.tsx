import { withoutSx } from '../../styling/sx';
'use client';

import { useId, type ComponentPropsWithRef, type ComponentType, type Key, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { cardPartIdentity } from '../game-card/card-parts';

export interface GameScoreRow {
  key: Key;
  label: ReactNode;
  value: number;
  /** Visible stage label supplied by your game. */
  stage?: string;
}
export type GameScorePartProps<T extends 'div' | 'span' | 'dl' | 'dt' | 'dd'> = ComponentPropsWithRef<T> & {
  'data-ui'?: string;
  sx?: Interpolation<Theme>;
};

export interface GameScoreSlotProps {
  /** Group wrapping the label and the score rows. */
  root?: GameCardRootSlotProps;
  /** Text naming the score list. */
  label?: GameScorePartProps<'span'>;
  /** Definition list holding every row. */
  list?: GameScorePartProps<'dl'>;
  /** One player's row. */
  row?: GameScorePartProps<'div'>;
  /** Term holding the player or side name. */
  name?: GameScorePartProps<'dt'>;
  /** Description holding the formatted score. */
  value?: GameScorePartProps<'dd'>;
  /** Stage or period shown after the score. */
  stage?: GameScorePartProps<'span'>;
}

export interface GameScoreSlots {
  /** Group wrapping the label and the score rows. */
  root?: ComponentType<GameCardRootProps>;
  /** Text naming the score list. */
  label?: ComponentType<GameScorePartProps<'span'>>;
  /** Definition list holding every row. */
  list?: ComponentType<GameScorePartProps<'dl'>>;
  /** One player's row. */
  row?: ComponentType<GameScorePartProps<'div'>>;
  /** Term holding the player or side name. */
  name?: ComponentType<GameScorePartProps<'dt'>>;
  /** Description holding the formatted score. */
  value?: ComponentType<GameScorePartProps<'dd'>>;
  /** Stage or period shown after the score. */
  stage?: ComponentType<GameScorePartProps<'span'>>;
}

export interface GameScoreProps extends Omit<GameCardRootProps, 'children'>, Omit<GameCardRootCustomization, 'slots'>, SxProps {
  label: string;
  rows: readonly GameScoreRow[];
  /** Number locale; defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  slotProps?: GameScoreSlotProps;
  slots?: GameScoreSlots;
}
const rootStyle = css({ label: 'game-score', display: 'grid', gap: vars.space[2], color: vars.color.text, fontFamily: vars.font.sans,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const listStyle = css({ display: 'grid', gap: vars.space[2], margin: 0 });
const rowStyle = css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: vars.space[4] });
const valueStyle = css({ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: vars.fontWeight.semibold });
const stageStyle = css({ marginInlineStart: vars.space[2], fontSize: vars.textSize.sm });

export function GameScore({ label, rows, locale, slotProps, slots, component, ...props }: GameScoreProps) {
  const id = useId();
  const labelId = slotProps?.label?.id ?? id;
  const formatter = new Intl.NumberFormat(locale);
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];

  const Label = slots?.label ?? 'span';
  const List = slots?.list ?? 'dl';
  const Row = slots?.row ?? 'div';
  const Name = slots?.name ?? 'dt';
  const Value = slots?.value ?? 'dd';
  const Stage = slots?.stage ?? 'span';

  const labelIdentity = cardPartIdentity('game-score-label', slotProps?.label?.['data-ui']);
  const listIdentity = cardPartIdentity('game-score-list', slotProps?.list?.['data-ui']);
  const rowIdentity = cardPartIdentity('game-score-row', slotProps?.row?.['data-ui']);
  const nameIdentity = cardPartIdentity('game-score-name', slotProps?.name?.['data-ui']);
  const valueIdentity = cardPartIdentity('game-score-value', slotProps?.value?.['data-ui']);
  const stageIdentity = cardPartIdentity('game-score-stage', slotProps?.stage?.['data-ui']);

  return <CardRoot {...props} component={component} slots={slots} marker="game-score" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' ') }}>
    <Label {...withoutSx(slotProps?.label)} id={labelId} data-ui={labelIdentity} className={slotProps?.label?.className} css={slotProps?.label?.sx}>{label}</Label>
    <List {...withoutSx(slotProps?.list)} data-ui={listIdentity} className={slotProps?.list?.className} css={[listStyle, slotProps?.list?.sx]}>
      {rows.map((row) => (
        <Row
          {...withoutSx(slotProps?.row)}
          key={row.key}
          data-stage={row.stage}
          data-ui={rowIdentity}
          className={slotProps?.row?.className}
          css={[rowStyle, slotProps?.row?.sx]}
        >
          <Name {...withoutSx(slotProps?.name)} data-ui={nameIdentity} className={slotProps?.name?.className} css={slotProps?.name?.sx}>{row.label}</Name>
          <Value {...withoutSx(slotProps?.value)} data-ui={valueIdentity} className={slotProps?.value?.className} css={[valueStyle, slotProps?.value?.sx]}>
            {formatter.format(row.value)}
            {row.stage !== undefined && <Stage {...withoutSx(slotProps?.stage)} data-ui={stageIdentity} className={slotProps?.stage?.className} css={[stageStyle, slotProps?.stage?.sx]}>{row.stage}</Stage>}
          </Value>
        </Row>
      ))}
    </List>
  </CardRoot>;
}
GameScore.displayName = 'GameScore';
