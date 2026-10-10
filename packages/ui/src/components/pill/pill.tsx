// Static status label. Plain inline text with no role: the pill's meaning lives in its
// children, so tone color is never the only cue. Not interactive.
import type { ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface PillProps extends ComponentPropsWithRef<'span'> {
  tone?: PillTone;
}

const rootStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  blockSize: vars.space[5],
  paddingInline: vars.space[2],
  borderRadius: vars.radius.full,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
});

/*
 * Text contrast (WCAG 2 relative luminance; translucent soft fills composited in sRGB over `bg`,
 * oklch converted via OKLab → linear sRGB, out-of-gamut channels clipped). AA needs 4.5:1.
 *
 *   tone     text on fill                    dark    light
 *   neutral  textMuted  on surfaceHover      5.4     6.6
 *   accent   accentText on accentSoft        6.2     6.0
 *   success  success    on successSoft       6.9     6.11
 *   warning  warning    on warningSoft       7.6     6.15
 *   danger   dangerText on dangerSoft        5.38    5.4
 */
const toneStyles: Record<PillTone, SerializedStyles> = {
  neutral: css({ backgroundColor: vars.color.surfaceHover, color: vars.color.textMuted }),
  accent: css({ backgroundColor: vars.color.accentSoft, color: vars.color.accentText }),
  success: css({ backgroundColor: vars.color.successSoft, color: vars.color.success }),
  warning: css({ backgroundColor: vars.color.warningSoft, color: vars.color.warning }),
  danger: css({ backgroundColor: vars.color.dangerSoft, color: vars.color.dangerText }),
};

export function Pill({ ref, tone = 'neutral', ...rest }: PillProps) {
  return <span {...rest} ref={ref} data-ui="pill" data-tone={tone} css={[rootStyle, toneStyles[tone]]} />;
}

Pill.displayName = 'Pill';
