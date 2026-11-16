import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { COARSE_POINTER } from './media';

export const touchTargetMinInlineSize = '--ui-touch-target-min-inline-size';

export const touchTargetStyle = css({
  [COARSE_POINTER]: {
    minBlockSize: vars.size.touch,
    minInlineSize: `max(${vars.size.touch}, var(${touchTargetMinInlineSize}, 0px))`,
  },
});
