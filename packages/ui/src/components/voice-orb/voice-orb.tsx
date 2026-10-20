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
import { MotionConfig, motion, useSpring, type MotionValue } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { isRenderable } from '../../utils/renderable';
import { createDurationFormatters } from '../../utils/duration-format';
import { Button, type ButtonProps } from '../button';
import { motionDurationMs } from '../../styling/motion-timings';
import { paintOrb, type OrbPalette } from './orb-painter';

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
  /** Sets the session state shown by the orb and status text. */
  state: VoiceOrbState;
  /** Controls whether session controls show an active session. */
  active?: boolean;
  /** Sets the initial uncontrolled active state. Defaults to `false`. */
  defaultActive?: boolean;
  /** Receives active-state requests from the Start and End controls. */
  onActiveChange?: (active: boolean) => void;
  /** Controls the displayed mute state without changing microphone access. */
  muted?: boolean;
  /** Sets the initial uncontrolled mute state. Defaults to `false`. */
  defaultMuted?: boolean;
  /** Receives mute-state requests. The consumer must apply them to its audio session. */
  onMutedChange?: (muted: boolean) => void;
  /** Runs after Start requests an active session, even if a controlled request is rejected. */
  onStart?: () => void;
  /** Runs after End requests an inactive session, even if a controlled request is rejected. */
  onEnd?: () => void;
  /** Drives input activity from 0 to 1. Defaults to 0, clamps out-of-range values and treats nonfinite values as 0. */
  inputLevel?: number | MotionValue<number>;
  /** Drives output activity from 0 to 1. Defaults to 0, clamps out-of-range values and treats nonfinite values as 0. */
  outputLevel?: number | MotionValue<number>;
  /** Sets elapsed session time in seconds. Defaults to 0 and does not advance automatically. */
  elapsed?: number;
  /** Shows an alert associated with the session container. */
  error?: ReactNode;
  /** Replaces session, control and speaker labels. Defaults to English labels. */
  labels?: VoiceOrbLabels;
  /** Sets the elapsed-time formatting locale. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
}
type NativeSlot<T extends 'canvas' | 'span'> = ComponentPropsWithRef<T> & {
  sx?: Interpolation<Theme>;
};
export interface VoiceOrbVisualProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Sets the orb's visual size. Defaults to `md`. */
  size?: VoiceOrbSize;
  /** Overrides the orb's accessible label. */
  label?: string;
  /** Replaces the canvas element drawing the orb. */
  slots?: {
    canvas?: ComponentType<NativeSlot<'canvas'>>;
  };
  /** Passes props and `sx` to the orb canvas. */
  slotProps?: { canvas?: NativeSlot<'canvas'> };
}
export interface VoiceOrbStatusProps extends ComponentPropsWithRef<'p'>, SxProps {}
export interface VoiceOrbTranscriptProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Shows transcript text after the speaker label. */
  text: string;
  /** Identifies a transcript turn for transitions and announcement deduplication. Defaults to 0. */
  turn?: string | number;
  /** Selects the speaker label. Defaults to `assistant`. */
  speaker?: 'user' | 'assistant' | 'system';
  /** Announces a completed turn once per turn, text and speaker combination. Defaults to `false`. */
  complete?: boolean;
  /** Clips visible text to this many lines, rounded down. Omitted, nonfinite or nonpositive values leave text unclipped. */
  maxLines?: number;
}
export interface VoiceOrbControlsProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Replaces the Start button's visible content. Defaults to the session's start label. */
  startLabel?: ReactNode;
  /** Replaces the Start, Mute, End and timer elements. */
  slots?: {
    start?: ComponentType<Omit<ButtonProps, 'sx'>>;
    mute?: ComponentType<Omit<ButtonProps, 'sx'>>;
    end?: ComponentType<Omit<ButtonProps, 'sx'>>;
    timer?: ComponentType<NativeSlot<'span'>>;
  };
  /** Passes props and `sx` to the Start, Mute, End and timer elements. */
  slotProps?: {
    start?: Omit<ButtonProps, 'sx'> & SxProps;
    mute?: Omit<ButtonProps, 'sx'> & SxProps;
    end?: Omit<ButtonProps, 'sx'> & SxProps;
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
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: '18%',
    borderRadius: vars.radius.full,
    border: '2px solid transparent',
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

/** Visualize voice activity and session state as an animated orb. */
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
  const repaint = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    latest.current = context;
  });
  useEffect(() => {
    if (reducedMotion) repaint.current?.();
  }, [context.state, context.muted, reducedMotion]);
  const energy = useSpring(STATE_ENERGY[context.state], SPRING);
  const level = useSpring(0, SPRING);
  useEffect(() => {
    const source =
      context.state === 'speaking'
        ? context.outputLevel
        : context.state === 'listening' && !context.muted
          ? context.inputLevel
          : 0;
    const update = () => {
      if (reducedMotion) level.jump(0);
      else level.set(normalize(source));
    };
    update();
    if (typeof source !== 'number') return source.on('change', update);
  }, [context.state, context.muted, context.inputLevel, context.outputLevel, level, reducedMotion]);
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
    let pixels = 0;
    let palette: OrbPalette;
    const draw = (time: number) => {
      if (disposed || !pixels || forced.matches) return;
      const current = latest.current;
      const amplitude = reducedMotion ? 0 : level.get();
      if (!reducedMotion && previousTime)
        phase +=
          (Math.min(time - previousTime, 64) / Math.max(1, motionDurationMs.slow)) *
          (0.09 + energy.get() * 0.16 + amplitude * 0.08);
      previousTime = time;
      const activity = reducedMotion ? STATE_ENERGY[current.state] : energy.get();
      paintOrb(drawing, pixels, phase, activity, amplitude, palette);
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
        const dpr = Math.min(view.devicePixelRatio || 1, MAX_DPR);
        pixels = Math.round(canvas.getBoundingClientRect().width * dpr);
        if (canvas.width !== pixels || canvas.height !== pixels) {
          canvas.width = pixels;
          canvas.height = pixels;
        }
        const styles = view.getComputedStyle(canvas);
        palette = {
          accent: styles.getPropertyValue('--ui-color-accent').trim(),
          highlight: styles.getPropertyValue('--ui-color-accent-hover').trim(),
          shadow: styles.getPropertyValue('--ui-color-surface-raised').trim(),
          light: styles.getPropertyValue('--ui-color-color-picker-white').trim(),
        };
        draw(view.performance.now());
        if (!reducedMotion && !forced.matches) frame = view.requestAnimationFrame(tick);
      }
    };
    const resize = new ResizeObserver(refresh);
    repaint.current = refresh;
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
    view.addEventListener('resize', refresh);
    forced.addEventListener('change', refresh);
    refresh();
    return () => {
      disposed = true;
      repaint.current = undefined;
      view.cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      theme.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      view.removeEventListener('resize', refresh);
      forced.removeEventListener('change', refresh);
    };
  }, [Canvas, reducedMotion, energy, level]);
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
            {...withoutSx(slotProps?.canvas)}
            ref={mergedRef}
            aria-hidden="true"
            css={[canvasStyle, slotProps?.canvas?.sx]}
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
/** Show a speaker's transcript and announce completed turns. */
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
/** Start, mute or end a voice session and show elapsed time. */
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
  const seconds = context.elapsed;
  const formatters = useMemo(() => createDurationFormatters(context.locale), [context.locale]);
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
                  {...withoutSx(slotProps?.mute)}
                  ref={muteMerged}
                  css={[controlStyle, slotProps?.mute?.sx]}
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
                  {...withoutSx(slotProps?.timer)}
                  role="timer"
                  aria-live="off"
                  aria-label={slotProps?.timer?.['aria-label'] ?? formatters.spoken(seconds)}
                  css={[timerStyle, slotProps?.timer?.sx]}
                >
                  {formatters.digital(seconds)}
                </Timer>
                <End
                  variant="outline"
                  {...withoutSx(slotProps?.end)}
                  css={[controlStyle, slotProps?.end?.sx]}
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
                {...withoutSx(slotProps?.start)}
                ref={startMerged}
                css={[controlStyle, slotProps?.start?.sx]}
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
/** Compose a voice session's activity visual, transcript and controls. */
export const VoiceOrb = Object.assign(VoiceOrbRoot, {
  Visual: VoiceOrbVisual,
  Status: VoiceOrbStatus,
  Transcript: VoiceOrbTranscript,
  Controls: VoiceOrbControls,
});
