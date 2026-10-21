import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { FORCED_COLORS } from './media';

export const nativeScrollbarStyle = css({
  scrollbarColor: `${vars.color.borderControl} transparent`,
  [FORCED_COLORS]: { scrollbarColor: 'auto' },
});
