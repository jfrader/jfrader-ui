'use client';

import { WithSx, withoutSx } from '../../styling/sx';

import { useId, type ComponentPropsWithRef, type ComponentType, type Key, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { GamePanel, type GamePanelProps, type GamePanelCustomization, type GamePanelSlotProps } from '../game-panel/game-panel';
import { cardPartIdentity } from '../game-card/card-parts';
import { GameScoreTable } from './game-score-table';

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
  root?: GamePanelSlotProps;
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
  root?: ComponentType<GamePanelProps>;
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

export interface GameScoreProps extends Omit<GamePanelProps, 'children'>, Omit<GamePanelCustomization, 'slots'>, SxProps {
  /** Shows the visible label that names the score group. */
  label: string;
  /** Defines player names, scores and optional stages in display order. */
  rows: readonly GameScoreRow[];
  /** Number locale; defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Passes props and styles to the score group and its parts. */
  slotProps?: GameScoreSlotProps;
  /** Replaces the score group and its parts. */
  slots?: GameScoreSlots;
}
const rootStyle = css({ label: 'game-score', display: 'grid', gap: vars.space[3], color: vars.color.text, fontFamily: vars.font.sans, lineHeight: vars.lineHeight.tight,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const labelStyle = css({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold, color: vars.color.textMuted,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const listStyle = css({ display: 'grid', margin: 0 });
const rowStyle = css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: vars.space[6], paddingBlock: vars.space[2],
  '& + &': { borderBlockStart: `1px solid ${vars.color.borderSubtle}` },
  [FORCED_COLORS]: { '& + &': { borderColor: 'CanvasText' } },
});
const nameStyle = css({ fontSize: vars.textSize.md, fontWeight: vars.fontWeight.semibold });
const valueStyle = css({ margin: 0, fontVariantNumeric: 'tabular-nums', fontSize: vars.textSize.xl, fontWeight: vars.fontWeight.bold, letterSpacing: vars.editorial.tracking.secondary });
const stageStyle = css({ marginInlineStart: vars.space[2], fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold, letterSpacing: 'normal', color: vars.color.textMuted, verticalAlign: 'middle',
  [FORCED_COLORS]: { color: 'CanvasText' },
});

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

  return <GamePanel {...props} component={component} slots={slots} marker="game-score" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' ') }}>
    <WithSx styles={[labelStyle, slotProps?.label?.sx]} className={slotProps?.label?.className}>{(classes) =>
      <Label {...withoutSx(slotProps?.label)} id={labelId} data-ui={labelIdentity} className={classes}>{label}</Label>}
    </WithSx>
    <WithSx styles={[listStyle, slotProps?.list?.sx]} className={slotProps?.list?.className}>{(classes) =>
    <List {...withoutSx(slotProps?.list)} data-ui={listIdentity} className={classes}>
      {rows.map((row) => (
        <WithSx key={row.key} styles={[rowStyle, slotProps?.row?.sx]} className={slotProps?.row?.className}>{(classes) => <Row
          {...withoutSx(slotProps?.row)}
          data-stage={row.stage}
          data-ui={rowIdentity}
          className={classes}
        >
          <WithSx styles={[nameStyle, slotProps?.name?.sx]} className={slotProps?.name?.className}>{(classes) =>
            <Name {...withoutSx(slotProps?.name)} data-ui={nameIdentity} className={classes}>{row.label}</Name>}
          </WithSx>
          <WithSx styles={[valueStyle, slotProps?.value?.sx]} className={slotProps?.value?.className}>{(classes) =>
          <Value {...withoutSx(slotProps?.value)} data-ui={valueIdentity} className={classes}>
            {formatter.format(row.value)}
            {row.stage !== undefined && <WithSx styles={[stageStyle, slotProps?.stage?.sx]} className={slotProps?.stage?.className}>{(classes) =>
              <Stage {...withoutSx(slotProps?.stage)} data-ui={stageIdentity} className={classes}>{row.stage}</Stage>}
            </WithSx>}
          </Value>}
          </WithSx>
        </Row>}</WithSx>
      ))}
    </List>}
    </WithSx>
  </GamePanel>;
}
GameScore.displayName = 'GameScore';
GameScore.Table = GameScoreTable;
