import { vars } from '@jfrader/tokens/vars';
import { css } from '../../../styling/css';
import { FORCED_COLORS } from '../../../styling/media';
import { TokenPanel } from './primitives';
import { OVERRIDE_COUNT, OVERRIDE_GROUPS } from './overrides-model';

/**
 * `ThemeRoot tokens`, group by group: the paths a map may set and the value each one holds.
 * One row per group, chips wrapping underneath, so a family of 62 keys reads as a block instead
 * of a column and no chip is ever truncated to fit.
 */

const introStyle = css({
  margin: 0,
  marginBlockEnd: vars.space[6],
  maxInlineSize: '72ch',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.relaxed,
  unicodeBidi: 'plaintext',
});

const groupStyle = css({
  '& + &': {
    marginBlockStart: vars.space[6],
    paddingBlockStart: vars.space[6],
    borderBlockStart: `1px solid ${vars.color.border}`,
    [FORCED_COLORS]: { borderColor: 'CanvasText' },
  },
});

const headStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: vars.space[2],
  marginBlockEnd: vars.space[1],
});

const pathStyle = css({
  margin: 0,
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  letterSpacing: vars.editorial.tracking.standard,
});

const countStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontVariantNumeric: 'tabular-nums',
});

const summaryStyle = css({
  margin: 0,
  marginBlockEnd: vars.space[3],
  maxInlineSize: '68ch',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.relaxed,
  unicodeBidi: 'plaintext',
});

const keysStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${vars.space[1]} ${vars.space[2]}`,
});

const keyStyle = css({
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: vars.space[2],
  maxInlineSize: '100%',
  paddingInline: vars.space[2],
  paddingBlock: '0.1875rem',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.borderSubtle}`,
  backgroundColor: vars.color.surfaceInset,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const keyNameStyle = css({
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  color: vars.color.text,
  unicodeBidi: 'plaintext',
});

const valueStyle = css({
  fontFamily: vars.font.mono,
  fontSize: '0.6875rem',
  color: vars.color.textMuted,
  unicodeBidi: 'plaintext',
});

const sameValueStyle = css({ color: vars.color.textSubtle });

/** Both palettes where they differ, one value where they do not. */
function valueLabel(dark: string, lightValue?: string): string {
  return lightValue ? `${dark} · ${lightValue}` : dark;
}

export function TokenOverrides() {
  return (
    <TokenPanel>
      <p css={introStyle}>
        {`${OVERRIDE_COUNT} paths across ${OVERRIDE_GROUPS.length} groups. Each entry is a CSS string; every path a map leaves out keeps the base theme's value. Values read dark · light where the palettes differ.`}
      </p>
      {OVERRIDE_GROUPS.map((group) => (
        <section css={groupStyle} key={group.name} data-group={group.name}>
          <div css={headStyle}>
            <h3 css={pathStyle}>{`theme.${group.name}`}</h3>
            <span css={countStyle}>{group.keys.length === 1 ? '1 key' : `${group.keys.length} keys`}</span>
          </div>
          <p css={summaryStyle}>{group.summary}</p>
          <ul role="list" css={keysStyle}>
            {group.keys.map((key) => (
              <li css={keyStyle} key={key.key}>
                <code css={keyNameStyle}>{key.key}</code>
                <span css={[valueStyle, key.lightValue ? undefined : sameValueStyle]}>
                  {valueLabel(key.value, key.lightValue)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </TokenPanel>
  );
}
