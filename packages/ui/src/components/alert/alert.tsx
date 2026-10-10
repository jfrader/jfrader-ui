// Status message, not an APG widget: a live region with optional title, body and dismiss button.
// Role choice: `danger` renders role="alert" (assertive, interrupts the user); every other tone
// renders role="status", which is polite — announced when the user is idle. Both live regions
// announce content *changes*: an alert mounted with its content already present may not be
// announced by every screen reader, so mount the region first and update it when announcing.
// The spec maps danger to alert only for genuinely urgent content; consumers own that judgment.
// Keyboard map: the dismiss button is a native button (Tab to reach, Enter/Space to activate).
// Dismissal is a request: `onDismiss` fires and the parent removes the alert.
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { isRenderable } from '../../utils/renderable';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  tone?: AlertTone;
  /** Announced tone word. Put visible meaning in the title text. */
  toneLabel?: string;
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  slotProps?: {
    root?: AlertPartProps;
    title?: AlertPartProps;
    body?: AlertPartProps;
    dismiss?: AlertPartProps;
  };
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const TONE_LABELS: Record<AlertTone, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

const visuallyHiddenStyle = css({
  position: 'absolute',
  inlineSize: '1px',
  blockSize: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
});

const rootStyle = css({
  display: 'grid',
  gap: vars.space[1],
  boxSizing: 'border-box',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderInlineStartWidth: '3px',
  borderInlineStartStyle: 'solid',
  borderRadius: vars.radius.md,
  paddingBlock: vars.space[3],
  paddingInline: vars.space[4],
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
});

// The message stays in the first column; the dismiss button sits in the top inline-end cell.
const dismissibleStyle = css({
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  columnGap: vars.space[3],
});

const messageStyle = css({
  display: 'grid',
  gap: vars.space[1],
  minInlineSize: 0,
  gridColumn: 1,
  gridRow: 1,
});

const toneStyles: Record<AlertTone, SerializedStyles> = {
  info: css({ borderInlineStartColor: vars.color.info }),
  success: css({ borderInlineStartColor: vars.color.success }),
  warning: css({ borderInlineStartColor: vars.color.warning }),
  danger: css({ borderInlineStartColor: vars.color.dangerText }),
};

const titleStyle = css({
  gridColumn: 1,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
});

const bodyStyle = css({
  gridColumn: 1,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const dismissStyle = css({
  gridColumn: 2,
  gridRow: 1,
  alignSelf: 'start',
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minInlineSize: '24px',
  minBlockSize: '24px',
  margin: 0,
  padding: 0,
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  fontFamily: 'inherit',
  fontSize: vars.textSize.md,
  lineHeight: 1,
  color: vars.color.textMuted,
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': {
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.text,
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    tone = 'info',
    toneLabel = TONE_LABELS[tone],
    title,
    children,
    onDismiss,
    dismissLabel = 'Dismiss',
    slotProps,
    className,
    ...rest
  },
  ref,
) {
  const dismissible = onDismiss !== undefined;

  return (
    <div
      {...rest}
      ref={ref}
      data-ui="alert"
      data-tone={tone}
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined}
      css={[rootStyle, toneStyles[tone], dismissible && dismissibleStyle, slotProps?.root?.css]}
    >
      <div role={tone === 'danger' ? 'alert' : 'status'} aria-atomic="true" css={messageStyle}>
        <span css={visuallyHiddenStyle}>{toneLabel}</span>
        {isRenderable(title) && (
          <div className={slotProps?.title?.className} css={[titleStyle, slotProps?.title?.css]}>
            {title}
          </div>
        )}
        {isRenderable(children) && (
          <div className={slotProps?.body?.className} css={[bodyStyle, slotProps?.body?.css]}>
            {children}
          </div>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          data-ui="alert-dismiss"
          aria-label={dismissLabel}
          onClick={() => onDismiss?.()}
          className={slotProps?.dismiss?.className}
          css={[dismissStyle, slotProps?.dismiss?.css]}
        >
          <span aria-hidden>×</span>
        </button>
      )}
    </div>
  );
});
