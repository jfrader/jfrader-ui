// Status message, not an APG widget: a live region with optional title, body and dismiss button.
// Role choice: `danger` renders role="alert" (assertive, interrupts the user); every other tone
// renders role="status", which is polite — announced when the user is idle. Both live regions
// announce content *changes*: an alert mounted with its content already present may not be
// announced by every screen reader, so mount the region first and update it when announcing.
// The spec maps danger to alert only for genuinely urgent content; consumers own that judgment.
// Keyboard map: the dismiss button is a native button (Tab to reach, Enter/Space to activate).
// Dismissal is a request: `onDismiss` fires and the parent removes the alert.
import type { ComponentPropsWithRef, ComponentType, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface AlertSlots {
  /** Outer container element holding the alert message and dismiss button. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Line naming the alert, rendered above the body. */
  title?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Body container holding the alert message content. */
  body?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Button element that dismisses the alert. */
  dismiss?: ComponentType<ComponentPropsWithRef<'button'>>;
}

export interface AlertProps extends Omit<ComponentPropsWithRef<'div'>, 'title' | 'role'>, SxProps {
  tone?: AlertTone;
  /** Announced tone word. Put visible meaning in the title text. */
  toneLabel?: string;
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  slots?: AlertSlots;
  slotProps?: {
    /** Outer container element holding the alert message and dismiss button. */
    root?: AlertPartProps;
    /** Title heading element rendered above the alert body. */
    title?: AlertPartProps;
    /** Body container holding the alert message content. */
    body?: AlertPartProps;
    /** Button element that dismisses the alert. */
    dismiss?: AlertPartProps;
  };
}

const TONE_LABELS: Record<AlertTone, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

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
    ...focusRingOutset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

export function Alert({
  ref,
  tone = 'info',
  toneLabel = TONE_LABELS[tone],
  title,
  children,
  onDismiss,
  dismissLabel = 'Dismiss',
  slots,
  slotProps,
  className,
  sx,
  ...rest
}: AlertProps) {
  const dismissible = onDismiss !== undefined;
  const Root = slots?.root ?? 'div';
  const Title = slots?.title ?? 'div';
  const Body = slots?.body ?? 'div';
  const Dismiss = slots?.dismiss ?? 'button';

  return (
    <WithSx
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined}
      styles={[rootStyle, toneStyles[tone], dismissible && dismissibleStyle, slotProps?.root?.css]}
      sx={sx}
    >
      {(className) => (
        <Root {...rest} ref={ref} data-ui="alert" data-tone={tone} className={className}>
          <div role={tone === 'danger' ? 'alert' : 'status'} aria-atomic="true" css={messageStyle}>
            <span css={visuallyHiddenStyle}>{toneLabel}</span>
            {isRenderable(title) && (
              <Title className={slotProps?.title?.className} css={[titleStyle, slotProps?.title?.css]}>
                {title}
              </Title>
            )}
            {isRenderable(children) && (
              <Body className={slotProps?.body?.className} css={[bodyStyle, slotProps?.body?.css]}>
                {children}
              </Body>
            )}
          </div>
          {dismissible && (
            <Dismiss
              type="button"
              data-ui="alert-dismiss"
              aria-label={dismissLabel}
              onClick={() => onDismiss?.()}
              className={slotProps?.dismiss?.className}
              css={[dismissStyle, slotProps?.dismiss?.css]}
            >
              <span aria-hidden>×</span>
            </Dismiss>
          )}
        </Root>
      )}
    </WithSx>
  );
}

Alert.displayName = 'Alert';
