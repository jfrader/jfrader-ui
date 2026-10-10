import { css } from './css';

// Wrapper that sizes a decorative icon to the surrounding font size.
export const iconWrapperStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  '& svg': { inlineSize: '1em', blockSize: '1em' },
});
