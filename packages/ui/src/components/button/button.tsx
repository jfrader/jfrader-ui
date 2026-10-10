import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';

export type ButtonVariant = 'solid' | 'soft' | 'outline' | 'ghost';
export type ButtonTone = 'neutral' | 'accent' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** Consumer style overrides, merged after the component's own styles. */
  css?: Interpolation<Theme>;
}

const HOVER = '&:hover:not(:disabled):not([aria-disabled="true"])';
const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const baseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  fontFamily: vars.font.sans,
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.tight,
  letterSpacing: '-0.011em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const sizeStyles: Record<ButtonSize, SerializedStyles> = {
  sm: css({ blockSize: '32px', paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ blockSize: '40px', paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ blockSize: '48px', paddingInline: vars.space[5], fontSize: vars.textSize.md }),
};

const variantStyles: Record<ButtonVariant, Record<ButtonTone, SerializedStyles>> = {
  solid: {
    accent: css({
      backgroundColor: vars.color.accent,
      color: vars.color.accentContrast,
      [HOVER]: { backgroundColor: vars.color.accentHover },
    }),
    danger: css({
      backgroundColor: vars.color.danger,
      color: vars.color.dangerContrast,
      [HOVER]: { backgroundColor: vars.color.dangerHover },
    }),
    neutral: css({
      backgroundColor: vars.color.surfaceRaised,
      color: vars.color.text,
      borderColor: vars.color.border,
      [HOVER]: { backgroundColor: vars.color.surfaceHover },
    }),
  },
  soft: {
    accent: css({
      backgroundColor: vars.color.accentSoft,
      color: vars.color.accent,
      [HOVER]: { backgroundColor: vars.color.accentSoftHover },
    }),
    danger: css({
      backgroundColor: vars.color.dangerSoft,
      color: vars.color.danger,
      [HOVER]: { backgroundColor: vars.color.dangerSoftHover },
    }),
    neutral: css({
      backgroundColor: vars.color.surfaceHover,
      color: vars.color.text,
      [HOVER]: { backgroundColor: vars.color.surfaceRaised },
    }),
  },
  outline: {
    accent: css({
      backgroundColor: 'transparent',
      borderColor: vars.color.accentBorder,
      color: vars.color.accent,
      [HOVER]: { backgroundColor: vars.color.accentSoft },
    }),
    danger: css({
      backgroundColor: 'transparent',
      borderColor: vars.color.dangerBorder,
      color: vars.color.danger,
      [HOVER]: { backgroundColor: vars.color.dangerSoft },
    }),
    neutral: css({
      backgroundColor: 'transparent',
      borderColor: vars.color.borderStrong,
      color: vars.color.text,
      [HOVER]: { backgroundColor: vars.color.surfaceHover },
    }),
  },
  ghost: {
    accent: css({
      backgroundColor: 'transparent',
      color: vars.color.accent,
      [HOVER]: { backgroundColor: vars.color.accentSoft },
    }),
    danger: css({
      backgroundColor: 'transparent',
      color: vars.color.danger,
      [HOVER]: { backgroundColor: vars.color.dangerSoft },
    }),
    neutral: css({
      backgroundColor: 'transparent',
      color: vars.color.textMuted,
      [HOVER]: { backgroundColor: vars.color.surfaceHover, color: vars.color.text },
    }),
  },
};

const iconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  '& svg': { inlineSize: '1em', blockSize: '1em' },
});

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

const pulse = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0.35 },
});

const spinnerStyle = css({
  display: 'inline-block',
  inlineSize: '1em',
  blockSize: '1em',
  border: '2px solid currentColor',
  borderInlineEndColor: 'transparent',
  borderRadius: vars.radius.full,
  animation: `${spin} 0.7s linear infinite`,
  [REDUCED_MOTION]: {
    animation: `${pulse} 1.2s ease-in-out infinite alternate`,
  },
});

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'solid',
    tone = 'neutral',
    size = 'md',
    loading = false,
    startIcon,
    endIcon,
    type = 'button',
    children,
    onClick,
    css: cssProp,
    ...rest
  },
  ref,
) {
  const ariaDisabled = rest['aria-disabled'];
  const isInactive = loading || ariaDisabled === true || ariaDisabled === 'true';

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isInactive) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const leading = loading ? <span css={spinnerStyle} /> : startIcon;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      data-ui="button"
      aria-busy={loading ? true : rest['aria-busy']}
      aria-disabled={isInactive ? true : ariaDisabled}
      onClick={handleClick}
      css={[baseStyle, sizeStyles[size], variantStyles[variant][tone], cssProp]}
    >
      {leading != null && (
        <span css={iconStyle} aria-hidden>
          {leading}
        </span>
      )}
      {children}
      {endIcon != null && (
        <span css={iconStyle} aria-hidden>
          {endIcon}
        </span>
      )}
    </button>
  );
});
