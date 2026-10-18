'use client';

import type { ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';

export type ProseSize = 'sm' | 'md' | 'lg';
export interface ProseProps extends ComponentPropsWithRef<'div'>, SxProps {
  size?: ProseSize;
}
const style = css({
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.relaxed,
  overflowWrap: 'anywhere',
  minInlineSize: 0,
  '& :where(h1, h2, h3, h4, h5, h6)': {
    fontWeight: vars.fontWeight.semibold,
    lineHeight: vars.lineHeight.tight,
    marginBlockStart: '1.5em',
    marginBlockEnd: '0.5em',
  },
  '& :where(h1)': { fontSize: '2em' },
  '& :where(h2)': { fontSize: '1.5em' },
  '& :where(h3)': { fontSize: '1.25em' },
  '& :where(h4, h5, h6)': { fontSize: '1em' },
  '& :where(p, ul, ol, blockquote, pre, table)': { marginBlock: '1em' },
  '& :where(ul, ol)': { paddingInlineStart: '1.5em' },
  '& :where(ul)': { listStyleType: 'disc' },
  '& :where(ol)': { listStyleType: 'decimal' },
  '& :where(li + li)': { marginBlockStart: vars.space[1] },
  '& :where(blockquote)': {
    borderInlineStart: `3px solid ${vars.color.borderStrong}`,
    paddingInlineStart: vars.space[4],
    marginInline: 0,
    color: vars.color.textMuted,
  },
  '& :where(code, pre)': {
    fontFamily: vars.font.mono,
    backgroundColor: vars.color.surfaceRaised,
    borderRadius: vars.radius.sm,
  },
  '& :where(code)': { fontSize: '0.875em', paddingInline: vars.space[1] },
  '& :where(pre)': { padding: vars.space[4], overflowX: 'auto', overflowWrap: 'normal' },
  '& :where(pre code)': { padding: 0, fontSize: 'inherit', background: 'transparent' },
  '& :where(table)': {
    display: 'block',
    maxInlineSize: '100%',
    overflowX: 'auto',
    borderCollapse: 'collapse',
  },
  '& :where(th, td)': {
    border: `1px solid ${vars.color.borderSubtle}`,
    paddingBlock: vars.space[2],
    paddingInline: vars.space[3],
    textAlign: 'start',
  },
  '& :where(th)': { fontWeight: vars.fontWeight.semibold, backgroundColor: vars.color.surfaceRaised },
  '& :where(a)': { color: vars.color.accentText, textDecoration: 'underline', textUnderlineOffset: '0.15em' },
  '& :where(a:focus-visible)': { outline: `2px solid ${vars.color.focusRing}`, outlineOffset: '2px' },
  '& > :first-child': { marginBlockStart: 0 },
  '& > :last-child': { marginBlockEnd: 0 },
});
const sizes = {
  sm: css({ fontSize: vars.textSize.sm }),
  md: css({ fontSize: vars.textSize.md }),
  lg: css({ fontSize: vars.textSize.lg }),
};
export function Prose({ size = 'md', ref, className, sx, ...props }: ProseProps) {
  return (
    <WithSx styles={[style, sizes[size]]} className={className} sx={sx}>
      {(className) => <div {...props} ref={ref} data-ui="prose" className={className} />}
    </WithSx>
  );
}
Prose.displayName = 'Prose';
