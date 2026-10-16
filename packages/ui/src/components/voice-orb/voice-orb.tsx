'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { MotionConfig, motion, useReducedMotion, useSpring, type MotionValue } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { isRenderable } from '../../utils/renderable';
import { Button, type ButtonProps } from '../button';

export type VoiceOrbState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
export type VoiceOrbSize = 'sm' | 'md' | 'lg';
export interface VoiceOrbLabels {
  group: string;
  start: string;
  mute: string;
  end: string;
  state: Record<VoiceOrbState, string>;
  muted?: string;
  speaker?: Record<'user' | 'assistant' | 'system', string>;
}
export interface VoiceOrbProps extends ComponentPropsWithRef<'div'>, SxProps {
  state: VoiceOrbState;
  active?: boolean;
  defaultActive?: boolean;
  onActiveChange?: (active: boolean) => void;
  muted?: boolean;
  defaultMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  inputLevel?: number | MotionValue<number>;
  outputLevel?: number | MotionValue<number>;
  elapsed?: number;
  error?: ReactNode;
  labels?: VoiceOrbLabels;
  locale?: Intl.LocalesArgument;
}
type NativeSlot<T extends 'canvas' | 'span'> = ComponentPropsWithRef<T> & {
  css?: Interpolation<Theme>;
};
export interface VoiceOrbVisualProps extends ComponentPropsWithRef<'div'>, SxProps {
  size?: VoiceOrbSize;
  label?: string;
  slots?: {
    canvas?: ComponentType<NativeSlot<'canvas'>>;
  };
  slotProps?: { canvas?: NativeSlot<'canvas'> };
}
export interface VoiceOrbStatusProps extends ComponentPropsWithRef<'p'>, SxProps {}
export interface VoiceOrbTranscriptProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  text: string;
  turn?: string | number;
  speaker?: 'user' | 'assistant' | 'system';
  complete?: boolean;
  maxLines?: number;
}
export interface VoiceOrbControlsProps extends ComponentPropsWithRef<'div'>, SxProps {
  startLabel?: ReactNode;
  slots?: {
    start?: ComponentType<Omit<ButtonProps, 'sx'>>;
    mute?: ComponentType<Omit<ButtonProps, 'sx'>>;
    end?: ComponentType<Omit<ButtonProps, 'sx'>>;
    timer?: ComponentType<NativeSlot<'span'>>;
  };
  slotProps?: {
    start?: Omit<ButtonProps, 'sx'>;
    mute?: Omit<ButtonProps, 'sx'>;
    end?: Omit<ButtonProps, 'sx'>;
    timer?: NativeSlot<'span'>;
  };
}
const DEFAULT_LABELS: VoiceOrbLabels = {
  group: 'Voice session',
  start: 'Start voice session',
  mute: 'Mute microphone',
  end: 'End voice session',
  muted: 'Microphone muted',
  state: {
    idle: 'Ready',
    connecting: 'Connecting',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    error: 'Voice session error',
  },
  speaker: { user: 'You', assistant: 'Assistant', system: 'System' },
};
const GEOMETRY = { sm: '9rem', md: '13rem', lg: '17rem' };
const MAX_DPR = 2;
const SPRING = { stiffness: 170, damping: 26 };
const SECOND_MS = 1000;
const ELAPSED_UNITS = { hours: 'hour', minutes: 'minute', seconds: 'second' } as const;
type ElapsedDuration = Record<keyof typeof ELAPSED_UNITS, number>;
type DurationFormatter = new (
  locale?: Intl.LocalesArgument,
  options?: { style: 'digital' | 'long' },
) => { format(duration: ElapsedDuration): string };
const STATE_ENERGY: Record<VoiceOrbState, number> = {
  idle: 0,
  connecting: 0.2,
  listening: 0.35,
  thinking: 0.55,
  speaking: 0.75,
  error: 0,
};
const rootStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'center',
  gap: vars.space[4],
  minInlineSize: 0,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
});
const visualStyle = css({
  position: 'relative',
  inlineSize: 'var(--voice-orb-size)',
  maxInlineSize: '100%',
  aspectRatio: '1',
  borderRadius: vars.radius.full,
  color: vars.color.accent,
  backgroundColor: vars.color.surfaceRaised,
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: '18%',
    borderRadius: vars.radius.full,
    border: `1px solid ${vars.color.borderControl}`,
    pointerEvents: 'none',
  },
  [FORCED_COLORS]: {
    '& canvas': { visibility: 'hidden' },
    '&::after': { border: '2px solid CanvasText' },
  },
});
const canvasStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  borderRadius: vars.radius.full,
});
const statusStyle = css({ margin: 0, fontSize: vars.textSize.md });
const transcriptStyle = css({
  position: 'relative',
  minInlineSize: 0,
  inlineSize: '100%',
  fontSize: vars.textSize.md,
  overflowWrap: 'anywhere',
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const turnEntrance = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const turnStyle = css({
  animation: `${turnEntrance} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});
const clippedStyle = css({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 'var(--voice-orb-lines)',
  overflow: 'hidden',
});
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[3],
  minInlineSize: 0,
});
const layoutStyle = css({
  display: 'flex',
  flexWrap: 'inherit',
  alignItems: 'inherit',
  justifyContent: 'inherit',
  gap: 'inherit',
  minInlineSize: 0,
});
const controlStyle = css({
  minBlockSize: vars.space[10],
  blockSize: 'auto',
  whiteSpace: 'normal',
  paddingBlock: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
const timerStyle = css({
  fontVariantNumeric: 'tabular-nums',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
});
const errorStyle = css({
  margin: 0,
  color: vars.color.dangerText,
  overflowWrap: 'anywhere',
});
interface OrbContext {
  state: VoiceOrbState;
  active: boolean;
  muted: boolean;
  labels: VoiceOrbLabels;
  inputLevel: number | MotionValue<number>;
  outputLevel: number | MotionValue<number>;
  elapsed: number;
  locale?: Intl.LocalesArgument;
  start: () => void;
  end: () => void;
  mute: () => void;
}
const Context = createContext<OrbContext | null>(null);
function useOrb() {
  const context = useContext(Context);
  if (!context) throw new Error('VoiceOrb parts require VoiceOrb');
  return context;
}
function stateLabel(context: OrbContext) {
  return context.state === 'listening' && context.muted
    ? (context.labels.muted ?? DEFAULT_LABELS.muted!)
    : context.labels.state[context.state];
}
/**
 * Digital and long elapsed-time formatters. Without `Intl.DurationFormat`, the digital form
 * takes its separators and digits from `Intl.DateTimeFormat` parts (hours from `NumberFormat`
 * so they can pass 23) and the long form joins `NumberFormat` units with a `ListFormat`
 * conjunction.
 */
function elapsedFormatters(locale: Intl.LocalesArgument | undefined) {
  const DurationFormat = (Intl as typeof Intl & { DurationFormat?: DurationFormatter }).DurationFormat;
  if (typeof DurationFormat === 'function') {
    const digital = new DurationFormat(locale, { style: 'digital' });
    const spoken = new DurationFormat(locale, { style: 'long' });
    return {
      digital: (duration: ElapsedDuration) => digital.format(duration),
      spoken: (duration: ElapsedDuration) => spoken.format(duration),
    };
  }
  const clock = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });
  const hours = new Intl.NumberFormat(locale, { useGrouping: false });
  const units = (Object.keys(ELAPSED_UNITS) as (keyof ElapsedDuration)[]).map((key) => ({
    key,
    format: new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: ELAPSED_UNITS[key],
      unitDisplay: 'long',
    }),
  }));
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  return {
    digital: (duration: ElapsedDuration) =>
      clock
        .formatToParts((duration.minutes * 60 + duration.seconds) * SECOND_MS)
        .map((part) => (part.type === 'hour' ? hours.format(duration.hours) : part.value))
        .join(''),
    spoken: (duration: ElapsedDuration) =>
      list.format(
        units.filter(({ key }) => duration[key] > 0).map(({ key, format }) => format.format(duration[key])),
      ),
  };
}
function normalize(value: number | MotionValue<number>) {
  const number = typeof value === 'number' ? value : value.get();
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function VoiceOrbRoot({
  state,
  active: activeProp,
  defaultActive = false,
  onActiveChange,
  muted: mutedProp,
  defaultMuted = false,
  onMutedChange,
  onStart,
  onEnd,
  inputLevel = 0,
  outputLevel = 0,
  elapsed = 0,
  error,
  labels = DEFAULT_LABELS,
  locale,
  children,
  ref,
  className,
  sx,
  ...rest
}: VoiceOrbProps) {
  const [active = false, requestActive] = useControlledState(activeProp, defaultActive, onActiveChange);
  const [muted = false, requestMuted] = useControlledState(mutedProp, defaultMuted, onMutedChange);
  const errorId = useId();
  const hasError = isRenderable(error);
  const notifyStart = useLatestCallback(onStart);
  const notifyEnd = useLatestCallback(onEnd);
  const context = useMemo<OrbContext>(
    () => ({
      state,
      active,
      muted,
      labels,
      inputLevel,
      outputLevel,
      elapsed,
      locale,
      start: () => {
        if (active || state === 'connecting') return;
        requestActive(true);
        notifyStart();
      },
      end: () => {
        if (!active) return;
        requestActive(false);
        notifyEnd();
      },
      mute: () => {
        if (state !== 'connecting') requestMuted(!muted);
      },
    }),
    [
      state,
      active,
      muted,
      labels,
      inputLevel,
      outputLevel,
      elapsed,
      locale,
      requestActive,
      requestMuted,
      notifyStart,
      notifyEnd,
    ],
  );
  return (
    <Context.Provider value={context}>
      <MotionConfig reducedMotion="user">
        <WithSx className={className} styles={rootStyle} sx={sx}>
          {(className) => (
            <div
              {...rest}
              ref={ref}
              className={className}
              data-ui="voice-orb"
              data-state={state}
              data-muted={muted}
              aria-describedby={
                [rest['aria-describedby'], hasError ? errorId : undefined].filter(Boolean).join(' ') ||
                undefined
              }
            >
              {children}
              {hasError && (
                <p id={errorId} role="alert" css={errorStyle}>
                  {error}
                </p>
              )}
            </div>
          )}
        </WithSx>
      </MotionConfig>
    </Context.Provider>
  );
}
VoiceOrbRoot.displayName = 'VoiceOrb';

function VoiceOrbVisual({
  size = 'md',
  label,
  slots,
  slotProps,
  ref,
  className,
  sx,
  style,
  ...rest
}: VoiceOrbVisualProps) {
  const Canvas = slots?.canvas ?? 'canvas';
  const context = useOrb();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mergedRef = useMergeRefs([canvasRef, slotProps?.canvas?.ref]);
  const reducedMotion = useReducedMotion();
  const latest = useRef(context);
  useLayoutEffect(() => {
    latest.current = context;
  });
  const energy = useSpring(STATE_ENERGY[context.state], SPRING);
  const level = useSpring(0, SPRING);
  useEffect(() => {
    if (reducedMotion) energy.jump(STATE_ENERGY[context.state]);
    else energy.set(STATE_ENERGY[context.state]);
  }, [context.state, energy, reducedMotion]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const drawing = canvas.getContext('2d');
    const view = canvas.ownerDocument.defaultView;
    if (!drawing || !view) return;
    const document = canvas.ownerDocument;
    const forced = view.matchMedia('(forced-colors: active)');
    let frame = 0;
    let visible = true;
    let disposed = false;
    let phase = 0;
    let previousTime = 0;
    const draw = (time: number) => {
      if (disposed) return;
      const current = latest.current;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(view.devicePixelRatio || 1, MAX_DPR);
      const pixels = Math.round(rect.width * dpr);
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = pixels;
        canvas.height = pixels;
      }
      if (!pixels) return;
      const styles = view.getComputedStyle(canvas);
      const accent = styles.getPropertyValue('--ui-color-accent').trim();
      const surface = styles.getPropertyValue('--ui-color-surface-raised').trim();
      const text = styles.getPropertyValue('--ui-color-text').trim();
      const source =
        current.state === 'speaking'
          ? current.outputLevel
          : current.state === 'listening' && !current.muted
            ? current.inputLevel
            : 0;
      if (!reducedMotion) level.set(normalize(source));
      const amplitude = reducedMotion || (current.state === 'listening' && current.muted) ? 0 : level.get();
      if (!reducedMotion && previousTime)
        phase +=
          (Math.min(time - previousTime, 64) /
            Math.max(1, parseFloat(styles.getPropertyValue('--ui-motion-duration-slow')))) *
          0.1;
      previousTime = time;
      const activity = reducedMotion ? STATE_ENERGY[current.state] : energy.get();
      const center = pixels / 2;
      const radius = pixels * (0.28 + amplitude * 0.06);
      drawing.clearRect(0, 0, pixels, pixels);
      const gradient = drawing.createRadialGradient(
        center - radius * 0.35,
        center - radius * 0.35,
        0,
        center,
        center,
        radius,
      );
      gradient.addColorStop(0, text);
      gradient.addColorStop(0.35, accent);
      gradient.addColorStop(1, surface);
      drawing.fillStyle = gradient;
      drawing.beginPath();
      drawing.arc(center, center, radius, 0, Math.PI * 2);
      drawing.fill();
      drawing.strokeStyle = accent;
      drawing.lineWidth = dpr;
      for (let ripple = 0; ripple < 3; ripple++) {
        drawing.globalAlpha = (0.2 + activity * 0.35) / (ripple + 1);
        drawing.beginPath();
        drawing.ellipse(
          center,
          center,
          radius * (1.12 + ripple * 0.15),
          radius * (0.7 + activity * 0.3),
          phase + ripple,
          0,
          Math.PI * 2,
        );
        drawing.stroke();
      }
      drawing.globalAlpha = 1;
    };
    const tick = (time: number) => {
      frame = 0;
      draw(time);
      if (!disposed && visible && !document.hidden && !reducedMotion && !forced.matches)
        frame = view.requestAnimationFrame(tick);
    };
    const refresh = () => {
      view.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      if (visible && !document.hidden) {
        draw(view.performance.now());
        if (!reducedMotion && !forced.matches) frame = view.requestAnimationFrame(tick);
      }
    };
    const resize = new ResizeObserver(refresh);
    resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      refresh();
    });
    intersection.observe(canvas);
    const theme = new MutationObserver(refresh);
    for (let ancestor: Element | null = canvas; ancestor; ancestor = ancestor.parentElement)
      theme.observe(ancestor, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-appearance', 'class', 'style'],
      });
    document.addEventListener('visibilitychange', refresh);
    forced.addEventListener('change', refresh);
    refresh();
    return () => {
      disposed = true;
      view.cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      theme.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      forced.removeEventListener('change', refresh);
    };
  }, [reducedMotion, context.state, context.muted, size, energy, level]);
  return (
    <WithSx className={className} styles={visualStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role="img"
          aria-label={
            rest['aria-label'] ??
            (rest['aria-labelledby'] ? undefined : (label ?? stateLabel(context)))
          }
          data-ui="voice-orb-visual"
          data-state={context.state}
          className={className}
          style={
            {
              '--voice-orb-size': GEOMETRY[size],
              ...style,
            } as CSSProperties
          }
        >
          <Canvas
            {...slotProps?.canvas}
            ref={mergedRef}
            aria-hidden="true"
            css={[canvasStyle, slotProps?.canvas?.css]}
          />
        </div>
      )}
    </WithSx>
  );
}
VoiceOrbVisual.displayName = 'VoiceOrb.Visual';
function VoiceOrbStatus({ ref, className, sx, children, ...rest }: VoiceOrbStatusProps) {
  const context = useOrb();
  return (
    <WithSx className={className} styles={statusStyle} sx={sx}>
      {(className) => (
        <p {...rest} ref={ref} data-ui="voice-orb-status" className={className}>
          {children ?? stateLabel(context)}
        </p>
      )}
    </WithSx>
  );
}
VoiceOrbStatus.displayName = 'VoiceOrb.Status';
function VoiceOrbTranscript({
  text,
  turn = 0,
  speaker = 'assistant',
  complete = false,
  maxLines,
  ref,
  className,
  sx,
  style,
  ...rest
}: VoiceOrbTranscriptProps) {
  const { labels } = useOrb();
  const speakerLabel = (labels.speaker ?? DEFAULT_LABELS.speaker!)[speaker];
  const seen = useRef(new Set<string>());
  const [announcement, setAnnouncement] = useState({ key: '', text: '' });
  useEffect(() => {
    const key = JSON.stringify([turn, text, speaker]);
    if (complete && text && !seen.current.has(key)) {
      seen.current.add(key);
      setAnnouncement({ key, text: `${speakerLabel}: ${text}` });
    }
  }, [complete, turn, text, speaker, speakerLabel]);
  const clipped = maxLines !== undefined && Number.isFinite(maxLines) && maxLines > 0;
  return (
    <WithSx className={className} styles={transcriptStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          data-ui="voice-orb-transcript"
          data-speaker={speaker}
          data-turn={turn}
          className={className}
          style={
            {
              '--voice-orb-lines': clipped ? Math.floor(maxLines) : undefined,
              ...style,
            } as CSSProperties
          }
        >
          <span key={turn} css={[turnStyle, clipped ? clippedStyle : undefined]}>
            {speakerLabel}: {text}
          </span>
          <span aria-live="polite" aria-atomic="true" css={visuallyHiddenStyle}>
            <span key={announcement.key}>{announcement.text}</span>
          </span>
        </div>
      )}
    </WithSx>
  );
}
VoiceOrbTranscript.displayName = 'VoiceOrb.Transcript';
function VoiceOrbControls({
  startLabel,
  slots,
  slotProps,
  ref,
  className,
  sx,
  children,
  ...rest
}: VoiceOrbControlsProps) {
  const Start = slots?.start ?? Button;
  const Mute = slots?.mute ?? Button;
  const End = slots?.end ?? Button;
  const Timer = slots?.timer ?? 'span';
  const context = useOrb();
  const startRef = useRef<HTMLButtonElement>(null);
  const muteRef = useRef<HTMLButtonElement>(null);
  const focused = useRef<'start' | 'live' | null>(null);
  const showLive = context.active || context.state === 'connecting';
  const previousLive = useRef(showLive);
  useLayoutEffect(() => {
    if (previousLive.current !== showLive && focused.current) {
      (showLive ? muteRef : startRef).current?.focus();
    }
    previousLive.current = showLive;
  }, [showLive]);
  const startMerged = useMergeRefs([startRef, slotProps?.start?.ref]);
  const muteMerged = useMergeRefs([muteRef, slotProps?.mute?.ref]);
  const seconds = Number.isFinite(context.elapsed) ? Math.max(0, Math.floor(context.elapsed)) : 0;
  const duration = {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
  const formatters = useMemo(() => elapsedFormatters(context.locale), [context.locale]);
  return (
    <WithSx className={className} styles={controlsStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role="group"
          aria-label={rest['aria-label'] ?? context.labels.group}
          data-ui="voice-orb-controls"
          className={className}
          onBlurCapture={(event) => {
            rest.onBlurCapture?.(event);
            if (!event.currentTarget.contains(event.relatedTarget)) focused.current = null;
          }}
          onFocusCapture={(event) => {
            rest.onFocusCapture?.(event);
            const target: EventTarget = event.target;
            focused.current =
              target === startRef.current ? 'start' : target instanceof HTMLButtonElement ? 'live' : null;
          }}
        >
          <motion.div layout transition={SPRING} css={layoutStyle}>
            {showLive ? (
              <>
                <Mute
                  variant="outline"
                  {...slotProps?.mute}
                  ref={muteMerged}
                  css={[controlStyle, slotProps?.mute?.css]}
                  aria-label={slotProps?.mute?.['aria-label'] ?? context.labels.mute}
                  aria-pressed={context.muted}
                  aria-disabled={context.state === 'connecting' || slotProps?.mute?.['aria-disabled']}
                  onClick={(event) => {
                    slotProps?.mute?.onClick?.(event);
                    if (!event.defaultPrevented) context.mute();
                  }}
                >
                  {context.labels.mute}
                </Mute>
                <Timer
                  {...slotProps?.timer}
                  role="timer"
                  aria-live="off"
                  aria-label={slotProps?.timer?.['aria-label'] ?? formatters.spoken(duration)}
                  css={[timerStyle, slotProps?.timer?.css]}
                >
                  {formatters.digital(duration)}
                </Timer>
                <End
                  variant="outline"
                  {...slotProps?.end}
                  css={[controlStyle, slotProps?.end?.css]}
                  onClick={(event) => {
                    slotProps?.end?.onClick?.(event);
                    if (!event.defaultPrevented) context.end();
                  }}
                >
                  {context.labels.end}
                </End>
              </>
            ) : (
              <Start
                variant="outline"
                {...slotProps?.start}
                ref={startMerged}
                css={[controlStyle, slotProps?.start?.css]}
                aria-label={
                  slotProps?.start?.['aria-label'] ??
                  (!isRenderable(startLabel) || startLabel === '' ? context.labels.start : undefined)
                }
                onClick={(event) => {
                  slotProps?.start?.onClick?.(event);
                  if (!event.defaultPrevented) context.start();
                }}
              >
                {startLabel === undefined
                  ? context.labels.start
                  : isRenderable(startLabel)
                    ? startLabel
                    : null}
              </Start>
            )}
          </motion.div>
          {children}
        </div>
      )}
    </WithSx>
  );
}
VoiceOrbControls.displayName = 'VoiceOrb.Controls';
export const VoiceOrb = Object.assign(VoiceOrbRoot, {
  Visual: VoiceOrbVisual,
  Status: VoiceOrbStatus,
  Transcript: VoiceOrbTranscript,
  Controls: VoiceOrbControls,
});
