import { vars } from '@jfrader/tokens/vars';
import { css } from './css';
import { COARSE_POINTER } from './media';
import { touchTargetStyle } from './touch-target';

export const controlBlockSize = {
  sm: vars.size.controlSm,
  md: vars.size.controlMd,
  lg: vars.size.controlLg,
} as const;

export const controlTextSize = {
  sm: vars.textSize.sm,
  md: vars.textSize.sm,
  lg: vars.textSize.md,
} as const;

export const controlSizeStyles = {
  sm: css({ boxSizing: 'border-box', minBlockSize: controlBlockSize.sm, fontSize: controlTextSize.sm }),
  md: css({ boxSizing: 'border-box', minBlockSize: controlBlockSize.md, fontSize: controlTextSize.md }),
  lg: css({ boxSizing: 'border-box', minBlockSize: controlBlockSize.lg, fontSize: controlTextSize.lg }),
};

function controlTouchTargetStyle(size: keyof typeof controlBlockSize) {
  return css(touchTargetStyle, {
    [COARSE_POINTER]: { minBlockSize: `max(${controlBlockSize[size]}, ${vars.size.touch})` },
  });
}

export const controlTouchTargetStyles = {
  sm: controlTouchTargetStyle('sm'),
  md: controlTouchTargetStyle('md'),
  lg: controlTouchTargetStyle('lg'),
};
