import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';

const space = (scale: number) => `calc(${vars.space[4]} * ${scale})`;

// Container-query frames: the wrapper is the size container; the frame div (its direct
// child) receives the vars. Board shape and caps are one continuous formula for every
// aspect ratio — no profile bands, no threshold jumps. Bands below only tune the shell
// paddings, which are decorative; unset vars intentionally fall through to the wrapper
// defaults.
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
  '& > [data-ui~="game-table-frame"]': {
    // The surface fills the shell (border-radius 50% makes the ellipse follow the
    // container). A constant inline inset keeps outside-placement seats clear of the
    // shell edge on narrow containers (on wider ones the 50rem cap binds instead);
    // the block cap lives on the surface below (it reads the shell's outside-placement
    // reserve, which the frame cannot see). Every term is continuous in the container
    // size: no band jumps.
    '--game-table-width': `calc(100% - ${space(0.75)})`,
    '--game-table-max-width': `min(${space(50)}, calc(100cqi - clamp(${space(0.9)}, 1.2cqi, ${space(2.2)})))`,
    '--game-table-border': `clamp(${space(0.72)}, 1cqi, ${space(0.9)})`,
  },
  '& > [data-ui~="game-table-frame"] [data-ui~="game-table-surface"]': {
    // Never above min(56cqb, 1.14 × felt width, 38rem-scale): the 1.14 factor keeps
    // portrait boards from turning into towers and follows the felt's content width
    // so outside-placement reserves shrink the felt proportionally; 56cqb keeps
    // wide containers short.
    '--game-table-max-height': `clamp(${space(8)}, min(56cqb, calc((100cqi - 2 * var(--game-table-reserve-inline, 0px) - 2 * var(--game-table-padding-inline)) * 1.14)), ${space(38)})`,
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
      '&[data-surface="lobby"] [data-ui~="game-table-surface"]': {
        '--game-table-max-height': `clamp(${space(18)}, 56cqb, ${space(38)})`,
        inlineSize: 'auto',
        aspectRatio: '1',
      },
    },
  },
});
