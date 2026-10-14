'use client';
import { numberFormatter } from '../../utils/intl';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from 'react';
import { animate, MotionConfig, useMotionValue, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Spinner } from '../spinner';

export type TerminalTone = 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'accent';
export interface TerminalLine {
  text: string;
  tone?: TerminalTone;
  delayMs?: number;
  href?: string;
}
export interface TerminalProgress {
  kind: 'progress';
  label: string;
  durationMs?: number;
}
export interface TerminalTask {
  kind: 'task';
  label: string;
  durationMs?: number;
  doneLabel?: string;
}
export type TerminalOutput = string | TerminalLine | TerminalProgress | TerminalTask;
export interface TerminalStep {
  command: string;
  output?: readonly TerminalOutput[];
  cwd?: string;
  pauseMs?: number;
}
export interface TypewriterTerminalLabels {
  play: string;
  pause: string;
  replay: string;
  copy: string;
  seek: string;
  copied: string;
  copyError: string;
  playing: string;
  paused: string;
  replayed: string;
  step: (step: number, command: string) => string;
  tones: Record<TerminalTone, string>;
  completed: string;
}
type Slot<E extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<E> & {
  css?: Interpolation<Theme>;
};
export interface TypewriterTerminalSlotProps {
  header?: Slot<'header'>;
  screen?: Slot<'div'>;
  transcript?: Slot<'ol'>;
  controls?: Slot<'div'>;
  scrubber?: Slot<'input'>;
  playButton?: Slot<'button'>;
  replayButton?: Slot<'button'>;
  copyButton?: Slot<'button'>;
  caption?: Slot<'figcaption'>;
  status?: Slot<'div'>;
}
export interface TypewriterTerminalProps
  extends Omit<ComponentPropsWithRef<'figure'>, 'children' | 'onChange'>, SxProps {
  steps: readonly TerminalStep[];
  title?: string;
  cwd?: string;
  symbol?: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  speed?: number;
  loop?: boolean;
  rows?: number;
  copyable?: boolean;
  caption?: ReactNode;
  label?: string;
  labels?: Partial<Omit<TypewriterTerminalLabels, 'tones'>> & {
    tones?: Partial<Record<TerminalTone, string>>;
  };
  locale?: Intl.LocalesArgument;
  slotProps?: TypewriterTerminalSlotProps;
}

/** Commands advance one grapheme every 40ms; output pauses default to 160ms, tasks to 1200ms. */
const GRAPHEME_MS = 40;
const OUTPUT_DELAY_MS = 160;
const ACTIVITY_MS = 1200;
const STEP_PAUSE_MS = 240;
const DEFAULT_ROWS = 11;
const PROGRESS_STEPS = 10;
const FOLLOW_SPRING = {
  type: 'spring',
  stiffness: 180,
  damping: 28,
  mass: 1,
} as const;
const DEFAULT_LABELS: TypewriterTerminalLabels = {
  play: 'Play',
  pause: 'Pause',
  replay: 'Replay',
  copy: 'Copy commands',
  seek: 'Seek session',
  copied: 'Commands copied',
  copyError: 'Could not copy commands',
  playing: 'Playing',
  paused: 'Paused',
  replayed: 'Replayed',
  step: (step, command) => `Step ${step}: ${command}`,
  completed: 'Complete',
  tones: {
    neutral: 'Output',
    muted: 'Note',
    success: 'Success',
    warning: 'Warning',
    danger: 'Error',
    accent: 'Output',
  },
};
const blink = keyframes({
  '0%, 49%': { opacity: 1 },
  '50%, 100%': { opacity: 0 },
});
const rootStyle = css({
  label: 'typewriter-terminal',
  margin: 0,
  minInlineSize: 0,
  maxInlineSize: '100%',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.raised,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  overflow: 'hidden',
  [FORCED_COLORS]: { borderColor: 'CanvasText', boxShadow: 'none' },
});
const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: vars.space[2],
  padding: vars.space[3],
  fontWeight: vars.fontWeight.medium,
  overflowWrap: 'anywhere',
});
const screenStyle = css({
  direction: 'ltr',
  blockSize: `calc(var(--terminal-rows) * 1em * ${vars.lineHeight.base} + ${vars.space[6]})`,
  boxSizing: 'border-box',
  overflow: 'auto',
  padding: vars.space[3],
  backgroundColor: vars.color.surfaceInset,
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  scrollbarWidth: 'thin',
});
const lineStyle = css({
  margin: 0,
  minBlockSize: `calc(1em * ${vars.lineHeight.base})`,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  font: 'inherit',
  '&[data-tone="accent"]': { color: vars.color.accentText },
});
const promptStyle = css({ color: vars.color.textMuted });
const commandStyle = css({ color: vars.color.accentText });
const caretStyle = css({
  display: 'inline-block',
  inlineSize: '0.6ch',
  blockSize: '1em',
  verticalAlign: 'text-bottom',
  backgroundColor: 'currentColor',
  animation: `${blink} calc(${vars.motion.duration.slow} * 4) step-end infinite`,
  '&[data-static]': { animation: 'none' },
  [REDUCED_MOTION]: { animation: 'none' },
  [FORCED_COLORS]: { backgroundColor: 'CanvasText' },
});
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  padding: vars.space[3],
});
const buttonStyle = css({
  minBlockSize: vars.space[12],
  blockSize: 'auto',
  minInlineSize: vars.space[12],
  paddingBlock: vars.space[2],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});
const rangeStyle = css({
  flex: '1 1 auto',
  minInlineSize: vars.space[12],
  inlineSize: '100%',
  minBlockSize: vars.space[12],
  accentColor: vars.color.accent,
  '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: { border: '1px solid ButtonText' },
});
const rangeWrapStyle = css({ flex: '1 1 10em', minInlineSize: 0 });
const timeStyle = css({
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});
const captionStyle = css({
  padding: vars.space[3],
  overflowWrap: 'anywhere',
  color: vars.color.textMuted,
});
const statusStyle = css({
  paddingInline: vars.space[3],
  paddingBlockEnd: vars.space[3],
  minBlockSize: `calc(1em * ${vars.lineHeight.base})`,
  overflowWrap: 'anywhere',
});
const transcriptStyle = css({
  ...visuallyHiddenStyle,
  '&:focus-within': {
    position: 'static',
    inlineSize: 'auto',
    blockSize: 'auto',
    clip: 'auto',
    clipPath: 'none',
    overflow: 'visible',
    whiteSpace: 'normal',
    margin: vars.space[3],
    paddingInlineStart: vars.space[6],
  },
});
const linkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minBlockSize: vars.space[12],
  color: vars.color.accentText,
  overflowWrap: 'anywhere',
  '&:focus-visible': focusRingOutset,
});
const activityStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
});
const progressStyle = css({
  display: 'inline-block',
  inlineSize: '8ch',
  blockSize: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  overflow: 'hidden',
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const fillStyle = css({
  display: 'block',
  blockSize: '100%',
  inlineSize: 'var(--terminal-progress)',
  backgroundColor: vars.color.accentText,
  [FORCED_COLORS]: { forcedColorAdjust: 'none', backgroundColor: 'Highlight' },
});
const toneMarks: Record<TerminalTone, string> = {
  neutral: '·',
  muted: '·',
  success: '✓',
  warning: '△',
  danger: '×',
  accent: '◆',
};
const toneStyles = {
  neutral: css({ color: vars.color.text }),
  muted: css({ color: vars.color.textMuted }),
  success: css({ color: vars.color.success }),
  warning: css({ color: vars.color.warning }),
  danger: css({ color: vars.color.dangerText }),
  accent: css({ color: vars.color.accentText }),
};

interface CompiledCommand {
  step: TerminalStep;
  cwd: string;
  start: number;
  typedEnd: number;
  end: number;
  graphemes: string[];
  outputs: { output: TerminalOutput; start: number; end: number }[];
}
function nonnegative(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function clamp(value: number, duration: number) {
  return Math.min(duration, Math.max(0, Number.isFinite(value) ? value : 0));
}
function compile(steps: readonly TerminalStep[], cwd: string, locale: Intl.LocalesArgument) {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  let time = 0;
  let directory = cwd;
  const ticks = new Set<number>();
  const commands = steps.map((step): CompiledCommand => {
    directory = step.cwd ?? directory;
    const start = time;
    const graphemes = Array.from(segmenter.segment(step.command), ({ segment }) => segment);
    for (const _ of graphemes) {
      time += GRAPHEME_MS;
      ticks.add(time);
    }
    const typedEnd = time;
    const outputs = (step.output ?? []).map((output) => {
      const delay =
        typeof output === 'string'
          ? OUTPUT_DELAY_MS
          : 'kind' in output
            ? 0
            : nonnegative(output.delayMs, OUTPUT_DELAY_MS);
      time += delay;
      const outputStart = time;
      ticks.add(time);
      if (typeof output !== 'string' && 'kind' in output) {
        const duration = nonnegative(output.durationMs, ACTIVITY_MS);
        for (let index = 1; index <= PROGRESS_STEPS; index++)
          ticks.add(time + (duration * index) / PROGRESS_STEPS);
        time += duration;
      }
      return { output, start: outputStart, end: time };
    });
    time += nonnegative(step.pauseMs, STEP_PAUSE_MS);
    ticks.add(time);
    return {
      step,
      cwd: directory,
      start,
      typedEnd,
      end: time,
      graphemes,
      outputs,
    };
  });
  return { commands, ticks: [...ticks].sort((a, b) => a - b), duration: time };
}
function safeHref(href: string | undefined) {
  if (href === undefined) return undefined;
  try {
    const url = new URL(href, 'https://terminal.invalid/');
    return ['http:', 'https:'].includes(url.protocol) ? href : undefined;
  } catch {
    return undefined;
  }
}
/** A deliberate request's announcement, spoken only once the requested state is accepted. */
interface Announcement {
  message: string;
  position?: number;
  paused?: boolean;
}
function joined(...ids: (string | undefined)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}

/** Scripted playback only. Native buttons; slider arrows/Page keys jump command boundaries. */
export function TypewriterTerminal({
  ref,
  steps,
  title = 'Terminal',
  cwd = '~',
  symbol = '$',
  value,
  defaultValue = 0,
  onValueChange,
  paused,
  defaultPaused = false,
  onPausedChange,
  speed = 1,
  loop = false,
  rows = DEFAULT_ROWS,
  copyable = true,
  caption,
  label = 'Terminal session',
  labels: labelsProp,
  locale,
  slotProps,
  className,
  sx,
  style,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: TypewriterTerminalProps) {
  const labels = {
    ...DEFAULT_LABELS,
    ...labelsProp,
    tones: { ...DEFAULT_LABELS.tones, ...labelsProp?.tones },
  };
  const session = useMemo(() => compile(steps, cwd, locale), [steps, cwd, locale]);
  const [position, requestPosition] = useControlledState(
    value === undefined ? undefined : clamp(value, session.duration),
    clamp(defaultValue, session.duration),
    onValueChange,
  );
  const [isPaused, requestPaused] = useControlledState(paused, defaultPaused, onPausedChange);
  const current = clamp(position ?? 0, session.duration);
  const motionReduced = useReducedMotion();
  const [mediaReduced, setMediaReduced] = useState<boolean | null>(null);
  const reduced = mediaReduced ?? motionReduced;
  const [snapshot, setSnapshot] = useState<{ active: boolean; target: number | null }>({
    active: false,
    target: null,
  });
  const [status, setStatus] = useState('');
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [copying, setCopying] = useState(false);
  const screen = useRef<HTMLDivElement>(null);
  const copyGuard = useRef(0);
  const pendingCopy = useRef(false);
  const completionPending = useRef<typeof session | null>(null);
  const [visible, setVisible] = useState(true);
  const [foreground, setForeground] = useState(true);
  const scroll = useMotionValue(0);
  const id = useId();
  const captionId = slotProps?.caption?.id ?? `${id}-caption`;
  const captionPresent = isRenderable(caption);
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const normalizedRows = Number.isInteger(rows) && rows > 0 ? rows : DEFAULT_ROWS;
  const seconds = useMemo(
    () => numberFormatter(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const percentage = useMemo(
    () =>
      numberFormatter(locale, {
        style: 'percent',
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const activeIndex = Math.max(
    0,
    session.commands.findLastIndex((command) => command.start <= current),
  );
  const active = session.commands[activeIndex];
  const valueText = `${active ? labels.step(activeIndex + 1, active.step.command) : labels.completed}; ${seconds.format(current / 1000)} / ${seconds.format(session.duration / 1000)} s`;
  const snapshotActive = snapshot.active || snapshot.target === current;
  const displayPosition = reduced
    ? !snapshotActive
      ? session.duration
      : (session.commands[
          Math.max(
            0,
            session.commands.findLastIndex((command) => command.start <= current),
          )
        ]?.end ?? 0)
    : current;

  useEffect(() => {
    copyGuard.current++;
    pendingCopy.current = false;
    setCopying(false);
    setSnapshot({ active: false, target: null });
    return () => {
      copyGuard.current++;
      pendingCopy.current = false;
    };
  }, [session]);

  useEffect(() => {
    const element = screen.current;
    if (!element) return;
    const document = element.ownerDocument;
    const media = document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      if (!media) return;
      setMediaReduced(media.matches);
      if (media.matches) setSnapshot({ active: false, target: null });
    };
    updateMotion();
    media?.addEventListener('change', updateMotion);
    const update = () => setForeground(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    const Observer = document.defaultView?.IntersectionObserver;
    const observer = Observer
      ? new Observer(([entry]) => {
          if (entry) setVisible(entry.isIntersecting);
        })
      : null;
    observer?.observe(element);
    return () => {
      document.removeEventListener('visibilitychange', update);
      media?.removeEventListener('change', updateMotion);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isPaused || reduced || !visible || !foreground || session.duration === 0) return;
    const next = session.ticks.find((tick) => tick > current);
    if (next === undefined && completionPending.current !== session) return;
    const timer = setTimeout(
      function advancePlayback() {
        if (next === undefined) {
          completionPending.current = null;
          if (loop) requestPosition(0);
          else requestPaused(true);
        } else {
          if (next === session.duration) completionPending.current = session;
          requestPosition(next);
        }
      },
      next === undefined ? 0 : (next - current) / rate,
    );
    return () => clearTimeout(timer);
  }, [
    current,
    isPaused,
    reduced,
    visible,
    foreground,
    rate,
    loop,
    session,
    requestPosition,
    requestPaused,
  ]);

  useEffect(() => {
    if (!announcement) return;
    setAnnouncement(null);
    const accepted =
      (announcement.position === undefined || announcement.position === current) &&
      (announcement.paused === undefined || announcement.paused === isPaused);
    if (accepted) setStatus(announcement.message);
  }, [announcement, current, isPaused]);

  useLayoutEffect(() => {
    const element = screen.current;
    if (!element || isPaused || !visible || !foreground) return;
    const target = Math.max(0, element.scrollHeight - element.clientHeight);
    if (reduced) {
      element.scrollTop = target;
      scroll.set(target);
      return;
    }
    scroll.set(element.scrollTop);
    const unsubscribe = scroll.on('change', (value) => {
      element.scrollTop = value;
    });
    const animation = animate(scroll, target, FOLLOW_SPRING);
    return () => {
      animation.stop();
      unsubscribe();
    };
  }, [displayPosition, isPaused, reduced, visible, foreground, scroll]);

  function seek(next: number) {
    const accepted = clamp(next, session.duration);
    if (reduced) setSnapshot({ active: snapshotActive, target: accepted });
    if (accepted === current) return;
    requestPosition(accepted);
    setAnnouncement({
      message: `${labels.seek}: ${seconds.format(accepted / 1000)} s`,
      position: accepted,
    });
  }
  function togglePaused() {
    requestPaused(!isPaused);
    setAnnouncement({ message: isPaused ? labels.playing : labels.paused, paused: !isPaused });
  }
  async function copy() {
    if (pendingCopy.current) return;
    pendingCopy.current = true;
    setCopying(true);
    const generation = ++copyGuard.current;
    try {
      const clipboard = screen.current?.ownerDocument.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(steps.map(({ command }) => command).join('\n'));
      if (generation === copyGuard.current) setStatus(labels.copied);
    } catch {
      if (generation === copyGuard.current) setStatus(labels.copyError);
    } finally {
      if (generation === copyGuard.current) {
        pendingCopy.current = false;
        setCopying(false);
      }
    }
  }
  function outputText(output: TerminalOutput) {
    return typeof output === 'string' ? output : 'kind' in output ? output.label : output.text;
  }
  function visualOutput(output: TerminalOutput, start: number, end: number) {
    if (typeof output === 'string') return output;
    if (!('kind' in output))
      return (
        <>
          <span css={toneStyles[output.tone ?? 'neutral']}>
            {toneMarks[output.tone ?? 'neutral']}{' '}
          </span>
          {output.text}
        </>
      );
    const complete = displayPosition >= end;
    const progress = end === start ? 1 : Math.min(1, (displayPosition - start) / (end - start));
    return (
      <span css={activityStyle}>
        {output.kind === 'task' ? (
          complete ? (
            '✓'
          ) : (
            <Spinner size="sm" label={output.label} />
          )
        ) : (
          <span css={progressStyle}>
            <span
              css={fillStyle}
              style={{ '--terminal-progress': `${progress * 100}%` } as CSSProperties}
            />
          </span>
        )}
        {complete && output.kind === 'task' ? (output.doneLabel ?? output.label) : output.label}{' '}
        {output.kind === 'progress'
          ? percentage.format(progress)
          : complete
            ? labels.completed
            : ''}
      </span>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClass) => (
          <figure
            {...rest}
            ref={ref}
            className={rootClass}
            data-ui="typewriter-terminal"
            aria-label={rest['aria-label'] ?? (labelledBy ? undefined : label)}
            aria-labelledby={labelledBy}
            aria-describedby={joined(describedBy, captionPresent ? captionId : undefined)}
            style={{ ...style, '--terminal-rows': normalizedRows } as CSSProperties}
          >
            <header {...slotProps?.header} role="group" css={[headerStyle, slotProps?.header?.css]}>
              <span>{title}</span>
              {copyable && (
                <Button
                  {...slotProps?.copyButton}
                  css={[buttonStyle, slotProps?.copyButton?.css]}
                  variant="ghost"
                  aria-disabled={copying || slotProps?.copyButton?.['aria-disabled']}
                  onClick={(event) => {
                    slotProps?.copyButton?.onClick?.(event);
                    if (!event.defaultPrevented) void copy();
                  }}
                >
                  {labels.copy}
                </Button>
              )}
            </header>
            <div
              {...slotProps?.screen}
              ref={screen}
              css={[screenStyle, slotProps?.screen?.css]}
              data-ui="typewriter-terminal-screen"
              aria-hidden="true"
              inert
            >
              {session.commands
                .filter(
                  (command, index) =>
                    command.start <= displayPosition &&
                    (!reduced || !snapshotActive || index <= activeIndex),
                )
                .map((command, index) => {
                  const count = reduced
                    ? command.graphemes.length
                    : Math.min(
                        command.graphemes.length,
                        Math.floor((displayPosition - command.start) / GRAPHEME_MS),
                      );
                  return (
                    <div key={index}>
                      <pre css={lineStyle}>
                        <span css={promptStyle}>
                          {command.cwd} {symbol}{' '}
                        </span>
                        <span css={commandStyle}>{command.graphemes.slice(0, count).join('')}</span>
                        {displayPosition < command.typedEnd && (
                          <span
                            css={caretStyle}
                            data-static={isPaused || reduced ? '' : undefined}
                          />
                        )}
                      </pre>
                      {command.outputs
                        .filter((output) => output.start <= displayPosition)
                        .map(({ output, start, end }, outputIndex) => (
                          <pre
                            key={outputIndex}
                            css={lineStyle}
                            data-tone={
                              typeof output === 'object' && !('kind' in output)
                                ? output.tone
                                : undefined
                            }
                          >
                            {visualOutput(output, start, end)}
                          </pre>
                        ))}
                    </div>
                  );
                })}
            </div>
            <div {...slotProps?.controls} css={[controlsStyle, slotProps?.controls?.css]}>
              <Button
                {...slotProps?.playButton}
                css={[buttonStyle, slotProps?.playButton?.css]}
                variant="outline"
                disabled={session.duration === 0 || slotProps?.playButton?.disabled}
                onClick={(event) => {
                  slotProps?.playButton?.onClick?.(event);
                  if (!event.defaultPrevented) togglePaused();
                }}
              >
                {isPaused ? labels.play : labels.pause}
              </Button>
              <Button
                {...slotProps?.replayButton}
                css={[buttonStyle, slotProps?.replayButton?.css]}
                variant="ghost"
                disabled={session.duration === 0 || slotProps?.replayButton?.disabled}
                onClick={(event) => {
                  slotProps?.replayButton?.onClick?.(event);
                  if (event.defaultPrevented) return;
                  requestPosition(0);
                  requestPaused(false);
                  completionPending.current = null;
                  setSnapshot({ active: false, target: null });
                  setAnnouncement({ message: labels.replayed, position: 0, paused: false });
                }}
              >
                {labels.replay}
              </Button>
              <div css={rangeWrapStyle}>
                <input
                  {...slotProps?.scrubber}
                  css={[rangeStyle, slotProps?.scrubber?.css]}
                  type="range"
                  min={0}
                  max={session.duration}
                  step="any"
                  value={current}
                  disabled={session.duration === 0 || slotProps?.scrubber?.disabled}
                  aria-label={slotProps?.scrubber?.['aria-label'] ?? labels.seek}
                  aria-valuetext={valueText}
                  onChange={(event) => {
                    slotProps?.scrubber?.onChange?.(event);
                    if (!event.defaultPrevented) seek(Number(event.currentTarget.value));
                  }}
                  onKeyDown={(event) => {
                    slotProps?.scrubber?.onKeyDown?.(event);
                    if (event.defaultPrevented) return;
                    const boundaries = [
                      ...session.commands.map(({ start }) => start),
                      session.duration,
                    ];
                    const moves: Record<string, () => void> = {
                      ArrowRight: () =>
                        seek(boundaries.find((boundary) => boundary > current) ?? session.duration),
                      ArrowUp: () =>
                        seek(boundaries.find((boundary) => boundary > current) ?? session.duration),
                      PageUp: () =>
                        seek(boundaries.find((boundary) => boundary > current) ?? session.duration),
                      ArrowLeft: () =>
                        seek(boundaries.findLast((boundary) => boundary < current) ?? 0),
                      ArrowDown: () =>
                        seek(boundaries.findLast((boundary) => boundary < current) ?? 0),
                      PageDown: () =>
                        seek(boundaries.findLast((boundary) => boundary < current) ?? 0),
                      Home: () => seek(0),
                      End: () => seek(session.duration),
                      ' ': togglePaused,
                      k: togglePaused,
                      K: togglePaused,
                    };
                    const move = moves[event.key];
                    if (move) {
                      event.preventDefault();
                      move();
                    }
                  }}
                />
              </div>
              <span css={timeStyle}>
                {seconds.format(current / 1000)} / {seconds.format(session.duration / 1000)} s
              </span>
            </div>
            <ol
              {...slotProps?.transcript}
              css={[transcriptStyle, slotProps?.transcript?.css]}
              data-ui="typewriter-terminal-transcript"
              aria-hidden={undefined}
              inert={false}
            >
              {session.commands.map((command, index) => (
                <li key={index}>
                  <span>
                    {command.cwd} {symbol} {command.step.command}
                  </span>
                  {command.outputs.map(({ output }, outputIndex) => {
                    const href =
                      typeof output === 'object' && !('kind' in output)
                        ? safeHref(output.href)
                        : undefined;
                    const text = outputText(output);
                    return (
                      <div key={outputIndex}>
                        {typeof output === 'object' && !('kind' in output) && output.tone
                          ? `${labels.tones[output.tone]}: `
                          : ''}
                        {href !== undefined ? (
                          <a css={linkStyle} href={href}>
                            {text}
                          </a>
                        ) : (
                          text
                        )}
                        {typeof output === 'object' && 'kind' in output
                          ? ` — ${output.kind === 'task' ? (output.doneLabel ?? labels.completed) : percentage.format(1)}`
                          : ''}
                      </div>
                    );
                  })}
                </li>
              ))}
            </ol>
            <div
              {...slotProps?.status}
              css={[statusStyle, slotProps?.status?.css]}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {status}
            </div>
            {captionPresent && (
              <figcaption
                {...slotProps?.caption}
                id={captionId}
                css={[captionStyle, slotProps?.caption?.css]}
              >
                {caption}
              </figcaption>
            )}
          </figure>
        )}
      </WithSx>
    </MotionConfig>
  );
}
TypewriterTerminal.displayName = 'TypewriterTerminal';
