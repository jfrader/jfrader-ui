import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';

const space = (scale: number) => `calc(${vars.space[4]} * ${scale})`;

// The parent owns both dimensions. Container bands only tune decorative padding.
export const frameContainerStyle = css({
  containerType: 'size',
  inlineSize: '100%',
  blockSize: '100%',
  '--game-table-padding-top': space(0.5),
  '--game-table-padding-inline': space(0.25),
  '--game-table-padding-bottom': space(0.8),
  '--game-table-top-gap': space(0.8),
  '--game-table-top-margin': space(0.5),
  '--game-table-bottom-margin': space(0.5),
  '--game-table-width': '100%',
  '--game-table-height': '100%',
  '--game-table-border': space(0.72),
  '--game-table-outline': space(0.22),
  '& > [data-ui~="game-table-frame"]': {
    '--game-table-width': `calc(100% - ${space(0.75)})`,
    '--game-table-border': `clamp(${space(0.72)}, 1cqi, ${space(0.9)})`,
  },
  '@container (max-aspect-ratio: 1.04)': {
    '& > [data-ui~="game-table-frame"]': {
      '--game-table-padding-top': `clamp(${space(0.5)}, 1cqb, ${space(0.86)})`,
      '--game-table-padding-inline': `clamp(${space(0.22)}, 0.5cqi, ${space(0.35)})`,
      '--game-table-padding-bottom': `clamp(${space(0.78)}, 1.5cqb, ${space(1.12)})`,
    },
  },
  '@container (min-aspect-ratio: 1.04) and (max-aspect-ratio: 1.3)': {
    '& > [data-ui~="game-table-frame"]': {
      '--game-table-padding-top': `clamp(${space(0.55)}, 1cqb, ${space(1)})`,
      '--game-table-padding-bottom': `clamp(${space(0.95)}, 1.5cqb, ${space(1.2)})`,
    },
  },
  '@container (min-aspect-ratio: 1.3)': {
    '& > [data-ui~="game-table-frame"]': {
      '--game-table-padding-top': `clamp(${space(0.55)}, 1cqb, ${space(1)})`,
      '--game-table-padding-inline': `clamp(${space(0.25)}, 0.5cqi, ${space(0.6)})`,
      '--game-table-padding-bottom': `clamp(${space(0.95)}, 1.5cqb, ${space(1.35)})`,
    },
  },
});
