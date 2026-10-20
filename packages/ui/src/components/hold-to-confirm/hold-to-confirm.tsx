'use client';

import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { MotionConfig, motion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { motionDurationMs } from '../../styling/motion-timings';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { useReducedMotion } from '../../utils/use-reduced-motion';

export type HoldToConfirmTone = 'neutral' | 'accent' | 'danger';
export type HoldToConfirmSize = 'sm' | 'md' | 'lg';
export type HoldToConfirmVariant = 'default' | 'morph';
export interface HoldToConfirmPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}
export interface HoldToConfirmSlots {
  /** Replaces the native button. */
  root?: ComponentType<ComponentPropsWithRef<'button'>>;
  /** Displays the button face. */
  face?: ComponentType<HoldToConfirmPartProps>;
  /** Clips the progress face over the button. */
  fill?: ComponentType<HoldToConfirmPartProps>;
  /** Displays the idle or confirmed glyph. */
  icon?: ComponentType<HoldToConfirmPartProps>;
  /** Displays the progress face glyph. */
  fillIcon?: ComponentType<HoldToConfirmPartProps>;
  /** Displays the button state label. */
  label?: ComponentType<HoldToConfirmPartProps>;
  /** Displays the progress face label. */
  fillLabel?: ComponentType<HoldToConfirmPartProps>;
  /** Describes the hold duration. */
  hint?: ComponentType<HoldToConfirmPartProps>;
  /** Announces completion. */
  status?: ComponentType<HoldToConfirmPartProps>;
}

export interface HoldToConfirmProps
  extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'value' | 'defaultValue'>, SxProps {
  /** Displays the button text before confirmation. */
  label: ReactNode;
  /** Adds root identity tokens alongside `hold-to-confirm`. */
  'data-ui'?: string;
  /** Displays the button text after confirmation. */
  confirmedLabel: ReactNode;
  /** Announces completion when confirmation is accepted on the next render. */
  confirmationAnnouncement: string;
  /** Builds the hold hint from the locale-formatted duration in seconds. */
  getHoldDescription: (formattedDuration: string) => string;
  /** Formats the hold duration using this locale; defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Sets the required hold time in milliseconds. Must be finite and positive; defaults to 1200. */
  duration?: number;
  /** Controls confirmation state; confirmed buttons cannot start another hold. */
  value?: boolean;
  /** Sets initial uncontrolled confirmation state. Defaults to false. */
  defaultValue?: boolean;
  /** Requests confirmation state after a completed hold. */
  onValueChange?: (confirmed: boolean) => void;
  /** Runs after the hold completes, even if controlled confirmation is rejected. */
  onConfirm: () => void;
  /** Reports when a hold starts, completes or is cancelled. */
  onHoldChange?: (holding: boolean) => void;
  /** Sets the progress fill color. Defaults to `accent`. */
  tone?: HoldToConfirmTone;
  /** Sets button height, padding and text size. Defaults to `md`. */
  size?: HoldToConfirmSize;
  /** Morphs the pill-shaped button between its idle and confirmed faces. */
  variant?: HoldToConfirmVariant;
  /** Displays a glyph before confirmation. */
  icon?: ReactNode;
  /** Displays a glyph after confirmation. Defaults to a checkmark. */
  confirmedIcon?: ReactNode;
  /** Replaces the button and its presentation parts. */
  slots?: HoldToConfirmSlots;
  /** Shorthand for slots.root; slots.root takes precedence. */
  component?: HoldToConfirmSlots['root'];
  /** Passes props to the button and its presentation parts. */
  slotProps?: Partial<
    Record<
      | /** Face layer displaying the button icon and label. */
        'face'
      | /** Icon element displaying the idle or confirmed glyph. */
        'icon'
      | /** Icon in the clipped progress face. */
        'fillIcon'
      | /** Text label displaying the button state. */
        'label'
      | /** Label in the clipped progress face. */
        'fillLabel'
      | /** Progress fill layer clipping over the button face. */
        'fill'
      | /** Screen-reader hint describing the required hold duration. */
        'hint'
      | /** Screen-reader live region announcing completion status. */
        'status',
      HoldToConfirmPartProps
    >
  > & { root?: Omit<PresentationProps<'button'>, 'children' | 'value' | 'defaultValue'> };
}

const DEFAULT_DURATION = 1200;
const POINTER_SLACK = 24;
const MILLISECONDS_PER_SECOND = 1000;
const MAX_TIMER_DELAY = 2 ** 31 - 1;
const PROGRESS_PROPERTY = '--hold-progress';

const rootStyle = css({
  label: 'hold-to-confirm',
  position: 'relative',
  display: 'inline-grid',
  boxSizing: 'border-box',
  maxInlineSize: '100%',
  overflow: 'hidden',
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.base,
  cursor: 'pointer',
  touchAction: 'none',
  userSelect: 'none',
  '&:hover:not(:disabled):not([aria-disabled="true"])': { backgroundColor: vars.color.surfaceHover },
  '&:focus-visible': focusRingOutset,
  '&:disabled': { cursor: 'not-allowed', opacity: 0.55 },
  '&[aria-disabled="true"]': { cursor: 'default' },
  '&[data-state="holding"] > [data-ui="hold-to-confirm-fill"]': {
    visibility: 'visible',
    transitionDuration: '0s',
  },
  '&[data-state="confirmed"] > [data-ui="hold-to-confirm-fill"]': {
    visibility: 'visible',
    clipPath: 'inset(0)',
  },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
    '&:focus-visible': { outlineColor: 'Highlight' },
    '&[data-state="holding"]': { borderStyle: 'double' },
  },
});
const sizeStyles: Record<HoldToConfirmSize, SerializedStyles> = {
  sm: css({ minBlockSize: vars.space[8], fontSize: vars.textSize.sm, '--hold-padding': vars.space[3] }),
  md: css({ minBlockSize: vars.space[10], fontSize: vars.textSize.sm, '--hold-padding': vars.space[4] }),
  lg: css({ minBlockSize: vars.space[12], fontSize: vars.textSize.md, '--hold-padding': vars.space[5] }),
};
const toneStyles: Record<HoldToConfirmTone, SerializedStyles> = {
  accent: css({ '--hold-fill': vars.color.accent, '--hold-ink': vars.color.accentContrast }),
  danger: css({
    color: vars.color.dangerText,
    '--hold-fill': vars.color.danger,
    '--hold-ink': vars.color.dangerContrast,
  }),
  neutral: css({ '--hold-fill': vars.color.text, '--hold-ink': vars.color.bg }),
};
const faceStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  paddingInline: 'var(--hold-padding)',
  paddingBlock: vars.space[2],
  overflowWrap: 'anywhere',
});
const reveal = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const swapStyle = css({
  animation: `${reveal} ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});
const fillStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundColor: 'var(--hold-fill)',
  color: 'var(--hold-ink)',
  pointerEvents: 'none',
  visibility: 'hidden',
  clipPath: 'inset(0 calc(100% - var(--hold-progress, 0%)) 0 0)',
  transitionProperty: 'clip-path, visibility',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:dir(rtl)': { clipPath: 'inset(0 0 0 calc(100% - var(--hold-progress, 0%)))' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { forcedColorAdjust: 'none', backgroundColor: 'Highlight', color: 'HighlightText' },
});
const hintStyle = css([
  visuallyHiddenStyle,
  {
    [FORCED_COLORS]: {
      '&[data-holding="true"]': {
        position: 'static',
        inlineSize: 'auto',
        blockSize: 'auto',
        overflow: 'visible',
        clip: 'auto',
        clipPath: 'none',
        whiteSpace: 'normal',
        marginInlineStart: vars.space[2],
      },
    },
  },
]);

const morphStyle = css({ borderRadius: vars.radius.full });
function ButtonElement({
  nativeProps,
  rootComponent,
  rootIdentity,
  ...props
}: ComponentPropsWithRef<'button'> & { nativeProps: ComponentPropsWithRef<'button'>; rootComponent?: HoldToConfirmSlots['root']; rootIdentity?: unknown }) {
  return <PresentationSlot element="button" component={rootComponent} marker="hold-to-confirm" slotProps={{ 'data-ui': typeof rootIdentity === 'string' ? rootIdentity : undefined }} {...nativeProps} {...props} style={{ ...nativeProps.style, ...props.style }} />;
}
const MotionButton = motion.create(ButtonElement);
const morphTransition = { duration: motionDurationMs.base / 1000 };

type Origin = { pointerId: number } | { key: string };
interface Attempt {
  origin: Origin;
  button: HTMLButtonElement;
  completed: boolean;
  stop: () => void;
}

/** Hold Space or Enter to confirm. Provide an untimed confirmation in a Dialog too. */
function HoldToConfirmRoot({
  ref,
  label,
  confirmedLabel,
  confirmationAnnouncement,
  getHoldDescription,
  locale,
  duration = DEFAULT_DURATION,
  value,
  defaultValue = false,
  onValueChange,
  onConfirm,
  onHoldChange,
  tone = 'accent',
  size = 'md',
  variant = 'default',
  icon,
  confirmedIcon = '✓',
  disabled = false,
  slotProps,
  slots,
  component,
  className,
  sx,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
  onKeyUp,
  onBlur,
  onClick,
  onContextMenu,
  'aria-describedby': describedBy,
  ...rest
}: HoldToConfirmProps) {
  const reducedMotion = useReducedMotion();
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error('HoldToConfirm: duration must be a finite positive number of milliseconds.');
  const hintId = `${useId()}-hint`;
  const [confirmed, requestConfirmation] = useControlledState(value, defaultValue, onValueChange);
  const [holding, setHolding] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Note: the confirmation announcement is consumed on the first render after completion;
  // a controlled parent that accepts asynchronously (a later render) will not announce. Documented behavior.
  const pendingAnnouncement = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const mergedRef = useMergeRefs([ref]);
  const notifyHold = useLatestCallback(onHoldChange);
  const notifyConfirm = useLatestCallback(onConfirm);
  const ariaInactive = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const finish = (notify = true) => {
    const active = attempt.current;
    if (!active) return;
    attempt.current = null;
    active.stop();
    active.button.style.setProperty(PROGRESS_PROPERTY, '0%');
    setHolding(false);
    if (!active.completed && notify) notifyHold(false);
    if ('pointerId' in active.origin && active.button.hasPointerCapture(active.origin.pointerId)) {
      active.button.releasePointerCapture(active.origin.pointerId);
    }
  };
  const cancel = useLatestCallback(finish);
  useEffect(() => {
    if (pendingAnnouncement.current) {
      pendingAnnouncement.current = false;
      if (confirmed) setAnnouncement(confirmationAnnouncement);
    }
    if (!confirmed) setAnnouncement('');
  }, [confirmed, holding, confirmationAnnouncement]);
  useEffect(() => {
    cancel();
  }, [duration, disabled, ariaInactive, cancel]);
  useEffect(() => {
    if (confirmed && attempt.current && !attempt.current.completed) cancel();
  }, [confirmed, cancel]);
  useEffect(() => () => cancel(false), [cancel]);

  const inactive = disabled || confirmed || ariaInactive;
  const start = (button: HTMLButtonElement, origin: Origin) => {
    const doc = button.ownerDocument;
    const view = doc.defaultView;
    if (inactive || attempt.current || !view || doc.hidden) return;
    const started = view.performance.now();
    let timer = 0;
    let frame = 0;
    const active: Attempt = { origin, button, completed: false, stop: () => {} };
    const abort = () => cancel();
    const visibility = () => {
      if (doc.hidden) abort();
    };
    const outsideEnd = (event: globalThis.PointerEvent) => {
      if (
        'pointerId' in origin &&
        event.pointerId === origin.pointerId &&
        !button.contains(event.target as Node)
      )
        abort();
    };
    const move = (event: globalThis.PointerEvent) => {
      if (!('pointerId' in origin) || origin.pointerId !== event.pointerId) return;
      const rect = button.getBoundingClientRect();
      if (
        event.clientX < rect.left - POINTER_SLACK ||
        event.clientX > rect.right + POINTER_SLACK ||
        event.clientY < rect.top - POINTER_SLACK ||
        event.clientY > rect.bottom + POINTER_SLACK
      )
        abort();
    };
    const stopTiming = () => {
      view.clearTimeout(timer);
      view.cancelAnimationFrame(frame);
    };
    active.stop = () => {
      stopTiming();
      doc.removeEventListener('visibilitychange', visibility);
      doc.removeEventListener('pointerup', outsideEnd, true);
      doc.removeEventListener('pointercancel', outsideEnd, true);
      doc.removeEventListener('pointermove', move);
      view.removeEventListener('blur', abort);
    };
    const complete = () => {
      if (attempt.current !== active || active.completed) return;
      if (
        doc.hidden ||
        !button.isConnected ||
        button.disabled ||
        button.getAttribute('aria-disabled') === 'true'
      ) {
        abort();
        return;
      }
      const remaining = duration - (view.performance.now() - started);
      if (remaining > 0) {
        timer = view.setTimeout(complete, Math.min(remaining, MAX_TIMER_DELAY));
        return;
      }
      active.completed = true;
      stopTiming();
      button.style.setProperty(PROGRESS_PROPERTY, '0%');
      pendingAnnouncement.current = true;
      setHolding(false);
      notifyHold(false);
      requestConfirmation(true);
      notifyConfirm();
    };
    const tick = () => {
      if (attempt.current !== active || active.completed) return;
      button.style.setProperty(
        PROGRESS_PROPERTY,
        `${Math.min(100, ((view.performance.now() - started) / duration) * 100)}%`,
      );
      frame = view.requestAnimationFrame(tick);
    };
    attempt.current = active;
    button.style.setProperty(PROGRESS_PROPERTY, '0%');
    setHolding(true);
    setAnnouncement('');
    doc.addEventListener('visibilitychange', visibility);
    doc.addEventListener('pointerup', outsideEnd, true);
    doc.addEventListener('pointercancel', outsideEnd, true);
    doc.addEventListener('pointermove', move);
    view.addEventListener('blur', abort);
    timer = view.setTimeout(complete, Math.min(duration, MAX_TIMER_DELAY));
    frame = view.requestAnimationFrame(tick);
    notifyHold(true);
  };
  const endPointer = (pointerId: number) => {
    const origin = attempt.current?.origin;
    if (origin && 'pointerId' in origin && origin.pointerId === pointerId) finish();
  };
  const visibleLabel = confirmed ? confirmedLabel : label;
  const Icon = slots?.icon ?? 'span';
  const Label = slots?.label ?? 'span';
  const FillIcon = slots?.fillIcon ?? 'span';
  const FillLabel = slots?.fillLabel ?? 'span';
  const Face = slots?.face ?? 'span';
  const Fill = slots?.fill ?? 'span';
  const Hint = slots?.hint ?? 'span';
  const Status = slots?.status ?? 'span';
  const visibleIcon = confirmed ? confirmedIcon : icon;
  const renderFace = (filled: boolean) => {
    const FaceIcon = filled ? FillIcon : Icon;
    const FaceLabel = filled ? FillLabel : Label;
    const iconProps = filled ? slotProps?.fillIcon : slotProps?.icon;
    const labelProps = filled ? slotProps?.fillLabel : slotProps?.label;
    return (
      <>
        {isRenderable(visibleIcon) && (
          <FaceIcon
            {...withoutSx(iconProps)}
            key={`icon-${confirmed}`}
            aria-hidden="true"
            className={iconProps?.className}
            css={[iconWrapperStyle, swapStyle, iconProps?.sx]}
          >
            {visibleIcon}
          </FaceIcon>
        )}
        {isRenderable(visibleLabel) && (
          <FaceLabel
            {...withoutSx(labelProps)}
            key={`label-${confirmed}`}
            className={labelProps?.className}
            css={[swapStyle, labelProps?.sx]}
          >
            {visibleLabel}
          </FaceLabel>
        )}
      </>
    );
  };
  const formatted = numberFormatter(locale, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'long',
    maximumFractionDigits: 3,
    ...(duration < 1 ? { maximumSignificantDigits: 3 } : undefined),
  }).format(duration / MILLISECONDS_PER_SECOND);

  return (
    <>
      <WithSx className={className} styles={[rootStyle, sizeStyles[size], toneStyles[tone], variant === 'morph' && morphStyle, slotProps?.root?.sx]} sx={sx}>
        {(rootClassName) => (
          <MotionButton
            rootComponent={slots?.root ?? component}
            rootIdentity={slotProps?.root?.['data-ui']}
            nativeProps={rest}
            ref={mergedRef}
            className={rootClassName}
            type="button"
            disabled={disabled}
            data-ui={rest['data-ui'] ?? 'hold-to-confirm'}
            data-variant={variant}
            layout={variant === 'morph' && !reducedMotion}
            transition={morphTransition}
            data-state={confirmed ? 'confirmed' : holding ? 'holding' : 'idle'}
            aria-disabled={confirmed ? true : rest['aria-disabled']}
            aria-describedby={[describedBy, hintId].filter(Boolean).join(' ')}
            onPointerDown={(event) => {
              onPointerDown?.(event);
              if (
                event.defaultPrevented ||
                !event.isPrimary ||
                event.button !== 0 ||
                inactive ||
                attempt.current
              )
                return;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              start(event.currentTarget, { pointerId: event.pointerId });
              if (attempt.current) {
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  /* Owner-document listeners handle uncaptured pointers. */
                }
              }
            }}
            onPointerMove={(event) => {
              onPointerMove?.(event);
            }}
            onPointerUp={(event) => {
              onPointerUp?.(event);
              endPointer(event.pointerId);
            }}
            onPointerCancel={(event) => {
              onPointerCancel?.(event);
              endPointer(event.pointerId);
            }}
            onLostPointerCapture={(event) => {
              onLostPointerCapture?.(event);
              endPointer(event.pointerId);
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.key === 'Escape' || event.key === 'Tab') {
                finish();
                return;
              }
              if (event.key !== ' ' && event.key !== 'Enter') return;
              if (event.defaultPrevented) return;
              event.preventDefault();
              if (!event.repeat) start(event.currentTarget, { key: event.key });
            }}
            onKeyUp={(event) => {
              onKeyUp?.(event);
              const origin = attempt.current?.origin;
              if (origin && 'key' in origin && event.key === origin.key) finish();
              if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
            }}
            onBlur={(event) => {
              onBlur?.(event);
              finish();
            }}
            onClick={(event) => {
              onClick?.(event);
              event.preventDefault();
            }}
            onContextMenu={(event) => {
              onContextMenu?.(event);
              if (attempt.current && 'pointerId' in attempt.current.origin && !attempt.current.completed)
                event.preventDefault();
            }}
          >
            <Face {...withoutSx(slotProps?.face)} className={slotProps?.face?.className} css={[faceStyle, slotProps?.face?.sx]}>
              {renderFace(false)}
            </Face>
            <Fill
              {...withoutSx(slotProps?.fill)}
              data-ui="hold-to-confirm-fill"
              aria-hidden="true"
              className={slotProps?.fill?.className}
              css={[faceStyle, fillStyle, slotProps?.fill?.sx]}
            >
              {renderFace(true)}
            </Fill>
          </MotionButton>
        )}
      </WithSx>
      <Hint
        {...withoutSx(slotProps?.hint)}
        id={hintId}
        data-holding={holding || undefined}
        className={slotProps?.hint?.className}
        css={[hintStyle, slotProps?.hint?.sx]}
      >
        {getHoldDescription(formatted)}
      </Hint>
      <Status
        {...withoutSx(slotProps?.status)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-ui="hold-to-confirm-status"
        className={slotProps?.status?.className}
        css={[visuallyHiddenStyle, slotProps?.status?.sx]}
      >
        {announcement}
      </Status>
    </>
  );
}

export function HoldToConfirm({ ref, className, style, ...props }: HoldToConfirmProps) {
  const root = props.slotProps?.root;
  const rootRef = useMergeRefs([ref, root?.ref]);
  const { sx: _css, ...rootProps } = root ?? {};
  return (
    <MotionConfig reducedMotion="user">
      <HoldToConfirmRoot {...props} {...rootProps} ref={rootRef}
        className={[className, root?.className].filter(Boolean).join(' ') || undefined}
        style={{ ...style, ...root?.style }}
        data-ui={props['data-ui']} />
    </MotionConfig>
  );
}

HoldToConfirm.displayName = 'HoldToConfirm';
