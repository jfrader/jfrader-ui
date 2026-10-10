// APG pattern: button. Enter and Space activate it once; disabled buttons drop out of the tab
// order. Loading keeps focus via aria-disabled + aria-busy instead of the disabled attribute.
// `type` defaults to "button" so buttons inside forms never submit accidentally.
//
// `render` swaps the native <button> for the returned element (e.g. an <a href>). That element
// cannot be assumed to support `disabled` or `type`: disabled folds into aria-disabled, and
// `type` is only forwarded when passed explicitly.
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type RefCallback,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';

export type ButtonVariant = 'solid' | 'soft' | 'outline' | 'ghost';
export type ButtonTone = 'neutral' | 'accent' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Props a `render` callback spreads onto the element it returns. */
export interface ButtonRenderProps extends Omit<ButtonHTMLAttributes<HTMLElement>, 'color' | 'disabled'> {
  ref: RefCallback<HTMLElement> | null;
  css: Interpolation<Theme>;
  'data-ui': string;
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** Consumer style overrides, merged after the component's own styles. */
  css?: Interpolation<Theme>;
  /**
   * Replaces the native button. Spread ALL supplied props onto the operative element and attach
   * the supplied ref. Both that ref and the forwarded ref refer to the rendered element, which
   * need not be a button; the public forwarded-ref type remains HTMLButtonElement for compatibility.
   * Overridden handlers, className and style win; compose behavior manually to retain both:
   * `onClick={(e) => { p.onClick?.(e); mine(e); }}`.
   * Only this render path joins data-ui markers into a token list; library selectors should use
   * `[data-ui~="button"]`. The default button always has data-ui="button".
   * Disabled anchors receive aria-disabled and remain focusable. Primary click/Enter activation
   * is blocked by the supplied handler; auxiliary/middle-click navigation is NOT covered.
   */
  render?: (props: ButtonRenderProps) => ReactNode;
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
      color: vars.color.accentText,
      [HOVER]: { backgroundColor: vars.color.accentSoftHover },
    }),
    danger: css({
      backgroundColor: vars.color.dangerSoft,
      color: vars.color.dangerText,
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
      color: vars.color.accentText,
      [HOVER]: { backgroundColor: vars.color.accentSoft },
    }),
    danger: css({
      backgroundColor: 'transparent',
      borderColor: vars.color.dangerBorder,
      color: vars.color.dangerText,
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
      color: vars.color.accentText,
      [HOVER]: { backgroundColor: vars.color.accentSoft },
    }),
    danger: css({
      backgroundColor: 'transparent',
      color: vars.color.dangerText,
      [HOVER]: { backgroundColor: vars.color.dangerSoft },
    }),
    neutral: css({
      backgroundColor: 'transparent',
      color: vars.color.textMuted,
      [HOVER]: { backgroundColor: vars.color.surfaceHover, color: vars.color.text },
    }),
  },
};

// Rendered elements (e.g. <a>) lack the native button's box model and plain text.
const renderedStyle = css({
  boxSizing: 'border-box',
  textDecoration: 'none',
});

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
    type,
    children,
    onClick,
    css: cssProp,
    render,
    ...props
  },
  ref,
) {
  // Only the render path preserves a composing part's marker alongside the Button marker.
  const { 'data-ui': partMarker, ...rest } = props as typeof props & { 'data-ui'?: string };
  const marker = render && partMarker !== undefined ? `${partMarker} button` : 'button';
  const renderRef = useMergeRefs<HTMLElement>([ref]);
  const ariaDisabled = rest['aria-disabled'];
  const isInactive =
    loading || ariaDisabled === true || ariaDisabled === 'true' || (render !== undefined && rest.disabled === true);

  const consumerClick: MouseEventHandler<HTMLElement> | undefined = onClick;
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (isInactive) {
      event.preventDefault();
      return;
    }
    consumerClick?.(event);
  };

  const leading = loading ? <span css={spinnerStyle} /> : startIcon;
  const content = (
    <>
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
    </>
  );

  if (render) {
    const { disabled: _disabled, ...attributes } = rest;
    return render({
      ...attributes,
      ref: renderRef,
      type,
      'data-ui': marker,
      'aria-busy': loading ? true : rest['aria-busy'],
      'aria-disabled': isInactive ? true : ariaDisabled,
      onClick: handleClick,
      css: [baseStyle, renderedStyle, sizeStyles[size], variantStyles[variant][tone], cssProp],
      children: content,
    });
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      data-ui={marker}
      aria-busy={loading ? true : rest['aria-busy']}
      aria-disabled={isInactive ? true : ariaDisabled}
      onClick={handleClick}
      css={[baseStyle, sizeStyles[size], variantStyles[variant][tone], cssProp]}
    >
      {content}
    </button>
  );
});
