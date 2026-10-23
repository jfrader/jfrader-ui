import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { COARSE_POINTER } from './media';

export const touchTargetStyle = css({
  [COARSE_POINTER]: { minBlockSize: vars.size.touch, minInlineSize: vars.size.touch },
});
