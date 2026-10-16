import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';

const space = (scale: number) => `calc(${vars.space[4]} * ${scale})`;

export const frameContainerStyle = css({
  containerType: 'size',
  inlineSize: '100%',
  blockSize: '100%',
  '--game-table-padding-top': space(0.5),
  '--game-table-padding-inline': space(0.25),
  '--game-table-padding-bottom': space(0.8),
  '--game-table-shell-max-width': space(56),
  '--game-table-top-gap': space(0.8),
  '--game-table-top-margin': space(0.5),
  '--game-table-bottom-margin': space(0.5),
  '--game-table-width': '100%',
  '--game-table-max-width': space(50),
  '--game-table-height': '100%',
  '--game-table-max-height': space(38),
  '--game-table-border': space(0.72),
  '--game-table-outline': space(0.22),
  // Bands intentionally inherit wrapper defaults for variables they do not set.
  '@container (max-aspect-ratio: 1.04)': {
    '& > [data-ui~="game-table-frame"]': {
      '--game-table-padding-top': `clamp(${space(0.5)}, 1cqb, ${space(0.86)})`,
      '--game-table-padding-inline': `clamp(${space(0.22)}, 0.5cqi, ${space(0.35)})`,
      '--game-table-padding-bottom': `clamp(${space(0.78)}, 1.5cqb, ${space(1.12)})`,
      '--game-table-width': `calc(100% - ${space(0.75)})`,
      '--game-table-max-width': `min(${space(46)}, calc(100cqi - ${space(0.9)}))`,
      '& [data-ui~="game-table-surface"]': {
        '--game-table-max-height': `min(${space(41)}, max(0px, calc((100cqi - 2 * var(--game-table-reserve-inline, 0px) - 2 * var(--game-table-padding-inline)) * 1.14)))`,
      },
    },
  },
  '@container (min-aspect-ratio: 1.04) and (max-aspect-ratio: 1.3)': {
    '& > [data-ui~="game-table-frame"]': {
      '--game-table-padding-top': `clamp(${space(0.55)}, 1cqb, ${space(1)})`,
      '--game-table-padding-bottom': `clamp(${space(0.95)}, 1.5cqb, ${space(1.2)})`,
      '--game-table-max-width': `min(${space(50)}, calc(100cqi - ${space(2.2)}))`,
      '--game-table-max-height': `clamp(${space(18)}, 60cqb, ${space(39.5)})`,
      '--game-table-border': `clamp(${space(0.72)}, 1cqi, ${space(0.9)})`,
    },
  },
  '@container (min-aspect-ratio: 1.3)': {
    '& > [data-ui~="game-table-frame"]': {
      '--game-table-padding-top': `clamp(${space(0.55)}, 1cqb, ${space(1)})`,
      '--game-table-padding-inline': `clamp(${space(0.25)}, 0.5cqi, ${space(0.6)})`,
      '--game-table-padding-bottom': `clamp(${space(0.95)}, 1.5cqb, ${space(1.35)})`,
      '--game-table-max-width': `min(${space(50)}, calc(100cqi - ${space(1.5)}))`,
      '--game-table-max-height': `min(56cqb, clamp(${space(8)}, calc(70cqb - ${space(7)}), ${space(38)}))`,
      '--game-table-border': `clamp(${space(0.72)}, 1cqb, ${space(0.9)})`,
      '&[data-surface="lobby"] [data-ui~="game-table-surface"]': {
        '--game-table-max-height': `clamp(${space(18)}, 56cqb, ${space(38)})`,
        inlineSize: 'auto',
        aspectRatio: '1',
      },
    },
  },
});
