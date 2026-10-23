// APG pattern: button. Enter and Space activate it once; disabled buttons drop out of the tab
// order. Loading keeps focus via aria-disabled + aria-busy instead of the disabled attribute.
// `type` defaults to "button" so buttons inside forms never submit accidentally.
//
// `render` swaps the native <button> for the returned element (e.g. an <a href>). That element
// cannot be assumed to support `disabled` or `type`: disabled folds into aria-disabled, and
// `type` is only forwarded when passed explicitly.
import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type RefCallback,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { loadingRing, loadingRingPulse } from '../../styling/loading-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { touchTargetStyle } from '../../styling/touch-target';

export type ButtonVariant = 'solid' | 'soft' | 'outline' | 'ghost';
export type ButtonTone = 'neutral' | 'accent' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Props a `render` callback spreads onto the element it returns. */
export interface ButtonRenderProps extends Omit<ButtonHTMLAttributes<HTMLElement>, 'color' | 'disabled'> {
  ref: RefCallback<HTMLElement> | null;
  'data-ui': string;
}

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'color'>, SxProps {
  /** Choose the action's fill and border treatment. Defaults to `solid`. */
  variant?: ButtonVariant;
  /** Set the action's semantic colour. Defaults to `neutral`. */
  tone?: ButtonTone;
  /** Set the control height, padding, and text size. Defaults to `md`. */
  size?: ButtonSize;
  /** Show a leading spinner, announce busy state, and block activation without removing focus. */
  loading?: boolean;
  /** Place a decorative icon before the label; loading replaces it with the spinner. */
  startIcon?: ReactNode;
  /** Place a decorative icon after the label. */
  endIcon?: ReactNode;
  /**
   * Replaces the native button. Spread all supplied props onto the element and attach the supplied
   * ref. Both refs target that element, even when it is not a button. The public ref type remains
   * HTMLButtonElement for compatibility.
   * Your handlers, className, and style override the supplied ones. Compose handlers to keep both:
   * `onClick={(e) => { p.onClick?.(e); mine(e); }}`.
   * This render path joins data-ui markers into a token list. Library selectors should use
   * `[data-ui~="button"]`. The default button always has data-ui="button".
   * Disabled anchors receive aria-disabled and stay focusable. The supplied handler blocks primary
   * click and Enter activation; it does not block auxiliary or middle-click navigation.
   */
  render?: (props: ButtonRenderProps) => ReactNode;
}

const HOVER = '&:hover:not(:disabled):not([aria-disabled="true"])';

const baseStyle = css(touchTargetStyle, {
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
    ...focusRingOutset,
  },
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

export const buttonBlockSizes = {
  sm: vars.space[8],
  md: vars.space[10],
  lg: vars.space[12],
} satisfies Record<ButtonSize, string>;

const sizeStyles: Record<ButtonSize, SerializedStyles> = {
  sm: css({ blockSize: buttonBlockSizes.sm, paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ blockSize: buttonBlockSizes.md, paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ blockSize: buttonBlockSizes.lg, paddingInline: vars.space[5], fontSize: vars.textSize.md }),
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
      borderColor: vars.color.borderControl,
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
      borderColor: vars.color.borderControl,
      color: vars.color.accentText,
      [HOVER]: { backgroundColor: vars.color.accentSoft },
    }),
    danger: css({
      backgroundColor: 'transparent',
      borderColor: vars.color.borderControl,
      color: vars.color.dangerText,
      [HOVER]: { backgroundColor: vars.color.dangerSoft },
    }),
    neutral: css({
      backgroundColor: 'transparent',
      borderColor: vars.color.borderControl,
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

const spinnerStyle = css({
  ...loadingRing,
  inlineSize: '1em',
  blockSize: '1em',
  [REDUCED_MOTION]: {
    animation: `${loadingRingPulse} 1.2s ease-in-out infinite alternate`,
  },
});

export function Button({
  ref,
  variant = 'solid',
  tone = 'neutral',
  size = 'md',
  loading = false,
  startIcon,
  endIcon,
  type,
  children,
  onClick,
  className,
  sx,
  render,
  ...props
}: ButtonProps) {
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
        <span css={iconWrapperStyle} aria-hidden>
          {leading}
        </span>
      )}
      {children}
      {endIcon != null && (
        <span css={iconWrapperStyle} aria-hidden>
          {endIcon}
        </span>
      )}
    </>
  );

  if (render) {
    const { disabled: _disabled, ...attributes } = rest;
    return (
      <WithSx className={className} styles={[baseStyle, renderedStyle, sizeStyles[size], variantStyles[variant][tone]]} sx={sx}>
        {(className) =>
          render({
            ...attributes,
            className,
            ref: renderRef,
            type,
            'data-ui': marker,
            'aria-busy': loading ? true : rest['aria-busy'],
            'aria-disabled': isInactive ? true : ariaDisabled,
            onClick: handleClick,
            children: content,
          })
        }
      </WithSx>
    );
  }

  return (
    <WithSx
      className={className}
      styles={[baseStyle, sizeStyles[size], variantStyles[variant][tone]]}
      sx={sx}
    >
      {(className) => (
        <button
          {...rest}
          ref={ref}
          type={type ?? 'button'}
          data-ui={marker}
          aria-busy={loading ? true : rest['aria-busy']}
          aria-disabled={isInactive ? true : ariaDisabled}
          onClick={handleClick}
          className={className}
        >
          {content}
        </button>
      )}
    </WithSx>
  );
}

Button.displayName = 'Button';
