'use client';

import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';

export type HoldToConfirmTone = 'neutral' | 'accent' | 'danger';
export type HoldToConfirmSize = 'sm' | 'md' | 'lg';
export interface HoldToConfirmPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}
export interface HoldToConfirmProps
  extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'value' | 'defaultValue'>, SxProps {
  label: ReactNode;
  confirmedLabel: ReactNode;
  confirmationAnnouncement: string;
  getHoldDescription: (formattedDuration: string) => string;
  locale?: Intl.LocalesArgument;
  duration?: number;
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (confirmed: boolean) => void;
  onConfirm: () => void;
  onHoldChange?: (holding: boolean) => void;
  tone?: HoldToConfirmTone;
  size?: HoldToConfirmSize;
  icon?: ReactNode;
  confirmedIcon?: ReactNode;
  slotProps?: Partial<Record<'face' | 'icon' | 'label' | 'fill' | 'hint' | 'status', HoldToConfirmPartProps>>;
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

type Origin = { pointerId: number } | { key: string };
interface Attempt {
  origin: Origin;
  button: HTMLButtonElement;
  completed: boolean;
  stop: () => void;
}

/** Native button with timed Space/Enter activation. Provide an untimed Dialog alternative in the application. */
export function HoldToConfirm({
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
  icon,
  confirmedIcon = '✓',
  disabled = false,
  slotProps,
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
  const visibleIcon = confirmed ? confirmedIcon : icon;
  const face = (
    <>
      {isRenderable(visibleIcon) && (
        <span
          key={`icon-${confirmed}`}
          aria-hidden="true"
          className={slotProps?.icon?.className}
          css={[iconWrapperStyle, swapStyle, slotProps?.icon?.css]}
        >
          {visibleIcon}
        </span>
      )}
      {isRenderable(visibleLabel) && (
        <span
          key={`label-${confirmed}`}
          className={slotProps?.label?.className}
          css={[swapStyle, slotProps?.label?.css]}
        >
          {visibleLabel}
        </span>
      )}
    </>
  );
  const formatted = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'long',
    maximumFractionDigits: 3,
    ...(duration < 1 ? { maximumSignificantDigits: 3 } : undefined),
  }).format(duration / MILLISECONDS_PER_SECOND);

  return (
    <>
      <WithSx className={className} styles={[rootStyle, sizeStyles[size], toneStyles[tone]]} sx={sx}>
        {(rootClassName) => (
          <button
            {...rest}
            ref={mergedRef}
            className={rootClassName}
            type="button"
            disabled={disabled}
            data-ui="hold-to-confirm"
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
            <span className={slotProps?.face?.className} css={[faceStyle, slotProps?.face?.css]}>
              {face}
            </span>
            <span
              data-ui="hold-to-confirm-fill"
              aria-hidden="true"
              className={
                [slotProps?.face?.className, slotProps?.fill?.className].filter(Boolean).join(' ') ||
                undefined
              }
              css={[faceStyle, slotProps?.face?.css, fillStyle, slotProps?.fill?.css]}
            >
              {face}
            </span>
          </button>
        )}
      </WithSx>
      <span
        id={hintId}
        data-holding={holding || undefined}
        className={slotProps?.hint?.className}
        css={[hintStyle, slotProps?.hint?.css]}
      >
        {getHoldDescription(formatted)}
      </span>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={slotProps?.status?.className}
        css={[visuallyHiddenStyle, slotProps?.status?.css]}
      >
        {announcement}
      </span>
    </>
  );
}

HoldToConfirm.displayName = 'HoldToConfirm';
