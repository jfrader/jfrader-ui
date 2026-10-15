'use client';

import { useId, type ComponentPropsWithRef, type Key, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';
import { CardRoot, type GameCardRootProps, type GameCardRootCustomization, type GameCardRootSlotProps } from '../game-card/game-card-root';

export interface GameScoreRow {
  key: Key;
  label: ReactNode;
  value: number;
  /** Visible stage label supplied by your game. */
  stage?: string;
}
type PartProps<T extends 'div' | 'span' | 'dl' | 'dt' | 'dd'> = ComponentPropsWithRef<T> & { css?: Interpolation<Theme> };
export interface GameScoreProps extends Omit<GameCardRootProps, 'children'>, GameCardRootCustomization, SxProps {
  label: string;
  rows: readonly GameScoreRow[];
  /** Number locale; defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  slotProps?: {
    root?: GameCardRootSlotProps;
    label?: PartProps<'span'>;
    list?: PartProps<'dl'>;
    row?: PartProps<'div'>;
    name?: PartProps<'dt'>;
    value?: PartProps<'dd'>;
    stage?: PartProps<'span'>;
  };
}
const rootStyle = css({ label: 'game-score', display: 'grid', gap: vars.space[2], color: vars.color.text, fontFamily: vars.font.sans,
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const listStyle = css({ display: 'grid', gap: vars.space[2], margin: 0 });
const rowStyle = css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: vars.space[4] });
const valueStyle = css({ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: vars.fontWeight.semibold });
const stageStyle = css({ marginInlineStart: vars.space[2], fontSize: vars.textSize.sm });

export function GameScore({ label, rows, locale, slotProps, ...props }: GameScoreProps) {
  const id = useId();
  const labelId = slotProps?.label?.id ?? id;
  const formatter = new Intl.NumberFormat(locale);
  const externalLabel = slotProps?.root?.['aria-labelledby'] ?? props['aria-labelledby'];
  return <CardRoot {...props} marker="game-score" structure={rootStyle} rootSlot={slotProps?.root}
    attributes={{ role: 'group', 'aria-labelledby': [labelId, externalLabel].filter(Boolean).join(' ') }}>
    <span {...slotProps?.label} id={labelId}>{label}</span>
    <dl {...slotProps?.list} css={[listStyle, slotProps?.list?.css]}>
      {rows.map((row) => <div {...slotProps?.row} key={row.key} data-stage={row.stage} css={[rowStyle, slotProps?.row?.css]}>
        <dt {...slotProps?.name}>{row.label}</dt>
        <dd {...slotProps?.value} css={[valueStyle, slotProps?.value?.css]}>
          {formatter.format(row.value)}
          {row.stage !== undefined && <span {...slotProps?.stage} css={[stageStyle, slotProps?.stage?.css]}>{row.stage}</span>}
        </dd>
      </div>)}
    </dl>
  </CardRoot>;
}
GameScore.displayName = 'GameScore';
