'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { Button } from '../button';
import { Countdown, type CountdownProps } from '../countdown';

export interface Announcement {
  id: string;
  message: ReactNode;
  action?: {
    label: ReactNode;
    href?: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  };
  countdown?: Pick<CountdownProps, 'target' | 'label' | 'completeLabel' | 'units' | 'clock'>;
}
export type AnnouncementBarVariant = 'subtle' | 'inverted';
export type AnnouncementBarTone = 'neutral' | 'info' | 'warning' | 'danger';
export interface AnnouncementBarLabels {
  previous: string;
  next: string;
  pause: string;
  resume: string;
  dismiss: string;
  slide: string;
  carousel: string;
}
type Slot<E extends 'section' | 'div' | 'span' | 'button' | 'a'> = Omit<
  ComponentPropsWithRef<E>,
  'ref' | 'children' | 'dangerouslySetInnerHTML'
> & { css?: Interpolation<Theme> };
export interface AnnouncementBarProps
  extends Omit<ComponentPropsWithRef<'section'>, 'children' | 'dangerouslySetInnerHTML'>, SxProps {
  messages: readonly Announcement[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  value?: number;
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  autoPlay?: boolean;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  interval?: number;
  controls?: boolean;
  dismissible?: boolean;
  variant?: AnnouncementBarVariant;
  tone?: AnnouncementBarTone;
  label?: string;
  live?: 'off' | 'polite';
  locale?: Intl.LocalesArgument;
  labels?: Partial<AnnouncementBarLabels>;
  getMessageLabel?: (index: number, total: number) => string;
  onAction?: (announcement: Announcement) => void;
  onCountdownEnd?: (announcement: Announcement) => void;
  dismissFocusRef?: RefObject<HTMLElement | null>;
  slotProps?: {
    root?: Slot<'section'>;
    content?: Slot<'div'>;
    message?: Slot<'span'>;
    action?: Omit<Slot<'a'> & Slot<'button'>, 'onClick'> & {
      onClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
    };
    previous?: Slot<'button'>;
    next?: Slot<'button'>;
    rotation?: Slot<'button'>;
    dismiss?: Slot<'button'>;
    countdown?: Omit<Slot<'div'>, 'onClick'>;
  };
}

const DEFAULT_INTERVAL = 6000;
const WIDE_MIN = '35rem';
const TONE_RULE = '3px';
const MAX_TIMEOUT = 2147483647;
const DEFAULT_LABELS: AnnouncementBarLabels = {
  previous: 'Previous announcement',
  next: 'Next announcement',
  pause: 'Pause announcements',
  resume: 'Resume announcements',
  dismiss: 'Dismiss announcement',
  slide: 'slide',
  carousel: 'carousel',
};
const normalize = (index: number, count: number) =>
  count && Number.isFinite(index) ? ((Math.trunc(index) % count) + count) % count : 0;
const hasContent = (node: ReactNode) => isRenderable(node) && node !== '';
const swap = keyframes({
  from: { opacity: 0, transform: `translateY(${vars.space[2]})` },
  to: { opacity: 1, transform: 'translateY(0)' },
});
const progress = keyframes({
  from: { strokeDashoffset: 0 },
  to: { strokeDashoffset: 100 },
});
const rootStyle = css({
  display: 'grid',
  gridTemplateRows: '1fr',
  opacity: 1,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  borderBlock: `1px solid ${vars.color.borderControl}`,
  borderInlineStart: `${TONE_RULE} solid var(--announcement-tone)`,
  transitionProperty: 'grid-template-rows, opacity',
  transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-state="closed"]': { gridTemplateRows: '0fr', opacity: 0 },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    backgroundColor: 'Canvas',
    color: 'CanvasText',
    borderColor: 'ButtonText',
  },
});
const invertedStyle = css({
  backgroundColor: vars.color.text,
  color: vars.color.bg,
  '--announcement-tone': 'currentColor',
  borderColor: 'currentColor',
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText' },
});
const toneStyles = {
  neutral: css({ '--announcement-tone': vars.color.borderControl }),
  info: css({ '--announcement-tone': vars.color.info }),
  warning: css({ '--announcement-tone': vars.color.warning }),
  danger: css({ '--announcement-tone': vars.color.dangerText }),
};
const shellStyle = css({
  minBlockSize: 0,
  '&[data-closing="true"]': { overflow: 'hidden' },
});
// Wide/narrow switch from the bar's own width, without size containment (which would drop the
// bar's intrinsic width in shrink-to-fit parents). Flex percentages resolve against the layout's
// content box, so the threshold is WIDE_MIN minus the tone rule and padding. Wide: the side groups
// share free space equally around the max-content copy. Narrow: the side caps collapse to their
// fit-content and the copy claims a full line, giving start-aligned rows in DOM order (rotation,
// copy, navigation/dismiss) rather than copy first. An empty group stays as the wide mirror spacer;
// its basis and margins cancel the gap, so when narrow it shares the copy's line instead of a row.
const layoutGap = vars.space[3];
const layoutInner = `(${WIDE_MIN} - ${TONE_RULE} - 2 * ${vars.space[4]})`;
const layoutStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: layoutGap,
  alignItems: 'center',
  padding: vars.space[4],
});
const contentStyle = css({
  flex: '0 1 auto',
  minInlineSize: `min(100%, calc((${layoutInner} - 100%) * 999))`,
});
const slideStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
  minInlineSize: 0,
  animation: `${swap} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});
const messageStyle = css({ overflowWrap: 'anywhere', minInlineSize: 0 });
const directionalStyle = css({
  display: 'inline-block',
  '&:dir(rtl)': { transform: 'scaleX(-1)' },
});
const controlsStyle = css({
  flex: '1 1 0',
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  justifyContent: 'end',
  minInlineSize: 'fit-content',
  maxInlineSize: `calc((100% - ${layoutInner}) * 999)`,
  '&:empty': { flexBasis: layoutGap, marginInline: `calc(-0.5 * ${layoutGap})` },
});
const controlStyle = css({
  minBlockSize: vars.space[8],
  blockSize: 'auto',
  minInlineSize: vars.space[8],
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  whiteSpace: 'normal',
  color: 'inherit',
  backgroundColor: 'transparent',
  borderColor: 'currentColor',
  borderRadius: vars.radius.sm,
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    backgroundColor: 'transparent',
    color: 'inherit',
  },
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const actionStyle = css({
  ...focusRingOutset,
  outline: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: 'inherit',
  fontWeight: vars.fontWeight.medium,
  overflowWrap: 'anywhere',
  '&:focus-visible': focusRingOutset,
});
const ringStyle = css({
  inlineSize: '1em',
  blockSize: '1em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  animationName: `${progress}`,
  animationDuration: 'var(--announcement-interval)',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
  [REDUCED_MOTION]: { display: 'none' },
  [FORCED_COLORS]: { display: 'none' },
});

/** APG basic carousel: native Tab/Enter/Space; focus stops rotation until Resume. No custom arrow/Escape keys.
 * State modes must not change during an instance. The app owns persistence and keyboard dismissal destinations.
 */
export function AnnouncementBar({
  ref,
  messages,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  value,
  defaultValue = 0,
  onValueChange,
  autoPlay = false,
  paused: pausedProp,
  defaultPaused = false,
  onPausedChange,
  interval = DEFAULT_INTERVAL,
  controls = true,
  dismissible = true,
  variant = 'subtle',
  tone = 'neutral',
  label = 'Announcements',
  live = 'off',
  locale,
  labels: labelsProp,
  getMessageLabel,
  onAction,
  onCountdownEnd,
  dismissFocusRef,
  slotProps,
  className,
  sx,
  ...rest
}: AnnouncementBarProps) {
  const [open, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [current, requestValue] = useControlledState(
    value === undefined ? undefined : normalize(value, messages.length),
    normalize(defaultValue, messages.length),
    onValueChange,
  );
  const [paused, requestPaused] = useControlledState(pausedProp, defaultPaused, onPausedChange);
  const index = normalize(current ?? 0, messages.length);
  const duration = Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_INTERVAL;
  const root = useRef<HTMLElement>(null);
  const mergedRef = useMergeRefs([root, ref]);
  const [hover, setHover] = useState(false);
  const [safetyStop, setSafetyStop] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [present, setPresent] = useState(!!open);
  const focusAfterDismiss = useRef(false);
  const completed = useRef(new Map<string, Set<number>>());
  const contentId = useId();
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const multiple = messages.length > 1;
  const running =
    autoPlay && multiple && !!open && !paused && !hover && !safetyStop && !hidden && !reducedMotion;
  const stopped = !!paused || safetyStop || reducedMotion;
  const clock = useRef({ remaining: duration });
  const [cycle, setCycle] = useState(0);
  const [manualReset, setManualReset] = useState(0);
  const advance = useLatestCallback(() => requestValue(normalize(index + 1, messages.length)));
  const notifyEnd = useLatestCallback(onCountdownEnd);

  useEffect(() => {
    if (!open) return;
    const doc = root.current?.ownerDocument;
    const view = doc?.defaultView;
    if (!doc || !view) return;
    const media = view.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setHidden(doc.visibilityState === 'hidden');
    motion();
    visibility();
    media.addEventListener('change', motion);
    doc.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', motion);
      doc.removeEventListener('visibilitychange', visibility);
    };
  }, [open, present, messages.length === 0]);

  useEffect(() => {
    clock.current.remaining = duration;
    setCycle((n) => n + 1);
  }, [index, duration, messages[index]?.id, manualReset]);
  useEffect(() => {
    if (!running) return;
    let deadline = Date.now() + clock.current.remaining;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      if (remaining > 0) {
        timeout = setTimeout(tick, Math.min(remaining, MAX_TIMEOUT));
        return;
      }
      clock.current.remaining = duration;
      deadline = Date.now() + duration;
      advance();
      setCycle((n) => n + 1);
      timeout = setTimeout(tick, Math.min(duration, MAX_TIMEOUT));
    };
    timeout = setTimeout(tick, Math.min(clock.current.remaining, MAX_TIMEOUT));
    return () => {
      clearTimeout(timeout);
      clock.current.remaining = Math.max(0, deadline - Date.now());
    };
  }, [running, index, duration, advance, messages[index]?.id, manualReset]);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const element = root.current;
    if (focusAfterDismiss.current && element) {
      const destination = dismissFocusRef?.current;
      if (destination?.isConnected && destination.ownerDocument === element.ownerDocument)
        destination.focus();
    }
    focusAfterDismiss.current = false;
    if (!element || reducedMotion) {
      setPresent(false);
      return;
    }
    const ms =
      parseFloat(element.ownerDocument.defaultView!.getComputedStyle(element).transitionDuration) *
      1000;
    const timeout = setTimeout(() => setPresent(false), ms);
    return () => clearTimeout(timeout);
  }, [open, reducedMotion, dismissFocusRef]);

  if (!messages.length || (!open && !present)) return null;
  const announcement = messages[index]!;
  const { css: _rootCss, ...rootProps } = slotProps?.root ?? {};
  const number = numberFormatter(locale);
  const position =
    getMessageLabel?.(index, messages.length) ??
    `${number.format(index + 1)} of ${number.format(messages.length)}`;
  const clickAction = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    slotProps?.action?.onClick?.(event);
    if (!event.defaultPrevented) announcement.action?.onClick?.(event);
    if (!event.defaultPrevented) onAction?.(announcement);
  };
  const navigate = (offset: number) => {
    setManualReset((n) => n + 1);
    requestValue(normalize(index + offset, messages.length));
  };
  const control = (
    part: 'previous' | 'next' | 'rotation' | 'dismiss',
    name: string,
    glyph: ReactNode,
    handler: () => void,
  ) => {
    const props = slotProps?.[part];
    return (
      <Button
        {...props}
        type="button"
        render={(buttonProps) => <button {...buttonProps} data-ui={`announcement-bar-${part}`} />}
        size="sm"
        css={[controlStyle, props?.css]}
        aria-label={props?.['aria-label'] ?? name}
        aria-controls={part === 'previous' || part === 'next' ? contentId : undefined}
        aria-pressed={undefined}
        onClick={(event) => {
          props?.onClick?.(event);
          if (!event.defaultPrevented) handler();
        }}
      >
        {glyph}
      </Button>
    );
  };
  return (
    <WithSx
      className={[className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined}
      styles={[
        rootStyle,
        toneStyles[tone],
        variant === 'inverted' && invertedStyle,
        slotProps?.root?.css,
      ]}
      sx={sx}
    >
      {(rootClass) => (
        <section
          {...rootProps}
          {...rest}
          ref={mergedRef}
          className={rootClass}
          data-ui="announcement-bar"
          data-state={open ? 'open' : 'closed'}
          data-running={running}
          data-variant={variant}
          data-tone={tone}
          role="region"
          inert={!open || undefined}
          aria-label={
            rest['aria-label'] ??
            slotProps?.root?.['aria-label'] ??
            (!(rest['aria-labelledby'] ?? slotProps?.root?.['aria-labelledby']) ? label : undefined)
          }
          aria-labelledby={
            [slotProps?.root?.['aria-labelledby'], rest['aria-labelledby']]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-describedby={
            [slotProps?.root?.['aria-describedby'], rest['aria-describedby']]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-roledescription={multiple ? labels.carousel : undefined}
          onMouseEnter={(event) => {
            slotProps?.root?.onMouseEnter?.(event);
            rest.onMouseEnter?.(event);
            setHover(true);
          }}
          onMouseLeave={(event) => {
            slotProps?.root?.onMouseLeave?.(event);
            rest.onMouseLeave?.(event);
            setHover(false);
          }}
          onFocusCapture={(event) => {
            slotProps?.root?.onFocusCapture?.(event);
            rest.onFocusCapture?.(event);
            if (autoPlay && multiple && !safetyStop) {
              const fromOutside = !event.currentTarget.contains(event.relatedTarget as Node | null);
              // Rotation must never move focus: if focus lands inside the rotating content
              // (an action or any interactive node) while running, re-engage the safety stop —
              // otherwise the next swap unmounts the focused element and focus falls to body.
              const landsInRotatingContent =
                running &&
                (event.target as Element | null)?.closest?.('[data-ui="announcement-bar-content"]') !=
                  null;
              if (fromOutside || landsInRotatingContent) {
                setSafetyStop(true);
                requestPaused(true);
              }
            }
          }}
        >
          <div css={shellStyle} data-closing={!open}>
            <div css={layoutStyle}>
              <div css={controlsStyle}>
                {autoPlay &&
                  multiple &&
                  control(
                    'rotation',
                    stopped ? labels.resume : labels.pause,
                    <>
                      {stopped ? labels.resume : labels.pause}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 36 36"
                        css={ringStyle}
                        key={`${index}-${cycle}`}
                        style={
                          {
                            '--announcement-interval': `${duration}ms`,
                            animationPlayState: running ? 'running' : 'paused',
                          } as CSSProperties
                        }
                      >
                        <circle cx="18" cy="18" r="15" pathLength="100" strokeDasharray="100" />
                      </svg>
                    </>,
                    () => {
                      if (stopped) {
                        setSafetyStop(false);
                        requestPaused(false);
                      } else requestPaused(true);
                    },
                  )}
              </div>
              <div
                {...slotProps?.content}
                id={contentId}
                data-ui="announcement-bar-content"
                css={[contentStyle, slotProps?.content?.css]}
                aria-live="off"
              >
                <div
                  key={announcement.id}
                  role="group"
                  aria-roledescription={multiple ? labels.slide : undefined}
                  aria-label={multiple ? position : undefined}
                  css={slideStyle}
                >
                  {hasContent(announcement.message) && (
                    <span
                      {...slotProps?.message}
                      data-ui="announcement-bar-message"
                      css={[messageStyle, slotProps?.message?.css]}
                      aria-live={running ? 'off' : live}
                      aria-atomic="true"
                    >
                      {announcement.message}
                    </span>
                  )}
                  {open && announcement.countdown && (
                    <Countdown
                      {...slotProps?.countdown}
                      css={slotProps?.countdown?.css}
                      {...announcement.countdown}
                      variant="compact"
                      locale={locale}
                      announceCompletion={false}
                      onComplete={(epoch) => {
                        const epochs = completed.current.get(announcement.id) ?? new Set<number>();
                        if (epochs.has(epoch)) return;
                        epochs.add(epoch);
                        completed.current.set(announcement.id, epochs);
                        notifyEnd(announcement);
                      }}
                    />
                  )}
                  {announcement.action &&
                    hasContent(announcement.action.label) &&
                    (announcement.action.href !== undefined ? (
                      <a
                        {...slotProps?.action}
                        href={announcement.action.href}
                        data-ui="announcement-bar-action"
                        css={[actionStyle, slotProps?.action?.css]}
                        onClick={clickAction}
                      >
                        {announcement.action.label}
                      </a>
                    ) : (
                      <Button
                        {...slotProps?.action}
                        type="button"
                        render={(buttonProps) => (
                          <button {...buttonProps} data-ui="announcement-bar-action" />
                        )}
                        css={[controlStyle, slotProps?.action?.css]}
                        onClick={clickAction}
                      >
                        {announcement.action.label}
                      </Button>
                    ))}
                </div>
              </div>
              <div css={controlsStyle}>
                {multiple && (controls || autoPlay) && (
                  <>
                    {control(
                      'previous',
                      labels.previous,
                      <span aria-hidden="true" css={directionalStyle}>
                        ‹
                      </span>,
                      () => navigate(-1),
                    )}
                    {control(
                      'next',
                      labels.next,
                      <span aria-hidden="true" css={directionalStyle}>
                        ›
                      </span>,
                      () => navigate(1),
                    )}
                  </>
                )}
                {dismissible &&
                  control('dismiss', labels.dismiss, <span aria-hidden="true">×</span>, () => {
                    focusAfterDismiss.current =
                      root.current?.contains(root.current.ownerDocument.activeElement) ?? false;
                    requestOpen(false);
                  })}
              </div>
            </div>
          </div>
        </section>
      )}
    </WithSx>
  );
}
AnnouncementBar.displayName = 'AnnouncementBar';
