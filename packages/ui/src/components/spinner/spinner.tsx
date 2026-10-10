// Loading indicator: a role="status" (polite live region) named by a visually hidden label; the
// ring is decorative. Not focusable, no keyboard map. Screen readers announce live-region text
// reliably only when it changes inside a region that was already mounted, so render the spinner
// where the busy region already exists rather than relying on the mount itself being announced.
import { forwardRef, type HTMLAttributes } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { loadingRing, loadingRingPulse } from '../../styling/loading-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: SpinnerSize;
  /** Accessible text announced for the status region. */
  label?: string;
}

const rootStyle = css({
  position: 'relative',
  display: 'inline-flex',
  verticalAlign: 'middle',
});

const ringStyle = css({
  ...loadingRing,
  flexShrink: 0,
  boxSizing: 'border-box',
  [REDUCED_MOTION]: {
    animation: `${loadingRingPulse} 1.6s ease-in-out infinite alternate`,
  },
});

const sizeStyles: Record<SpinnerSize, SerializedStyles> = {
  sm: css({ inlineSize: vars.space[4], blockSize: vars.space[4] }),
  md: css({ inlineSize: vars.space[5], blockSize: vars.space[5] }),
  lg: css({ inlineSize: vars.space[6], blockSize: vars.space[6] }),
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = 'md', label = 'Loading', ...rest },
  ref,
) {
  return (
    <span {...rest} ref={ref} role="status" data-ui="spinner" css={rootStyle}>
      <span aria-hidden="true" data-ui="spinner-indicator" css={[ringStyle, sizeStyles[size]]} />
      <span css={visuallyHiddenStyle}>{label}</span>
    </span>
  );
});
