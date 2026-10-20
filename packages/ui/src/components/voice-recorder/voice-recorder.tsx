'use client';

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { MotionConfig } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { createDurationFormatters } from '../../utils/duration-format';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';
import { buttonBlockSizes } from '../button/button';
import { Avatar } from '../avatar';
import { VoiceOrb } from '../voice-orb';

export type VoiceRecorderState = 'idle' | 'recording' | 'review' | 'pending' | 'error';

export type VoiceRecorderValue =
  | { state: 'idle' }
  | { state: 'recording'; sessionId: string }
  | { state: 'review'; takeId: string }
  | { state: 'pending'; takeId: string }
  | { state: 'error'; takeId?: string; error: ReactNode };

export type VoiceRecorderSize = 'sm' | 'md';

export interface VoiceMessage {
  id: string;
  sender?: string;
  avatar?: string;
  duration: number;
  peaks?: readonly number[];
  metadata?: ReactNode;
  timestamp?: string | number | Date;
}

export interface VoiceRecorderLabels {
  root: string;
  messages: string;
  record: string;
  stop: string;
  play: string;
  pause: string;
  discard: string;
  send: string;
  sending: string;
  seek: string;
  status: {
    idle: string;
    recording: string;
    review: string;
    pending: string;
    sent: string;
    discarded: string;
    error: string;
  };
  formatDuration?: (seconds: number) => string;
  formatDurationSpoken?: (seconds: number) => string;
  formatSeekValueText?: (currentTime: number, duration: number) => string;
}

export interface VoiceRecorderSlots {
  root?: ComponentType<ComponentPropsWithRef<'section'>>;
  messageList?: ComponentType<ComponentPropsWithRef<'ol'>>;
  composer?: ComponentType<ComponentPropsWithRef<'div'>>;
  waveform?: ComponentType<ComponentPropsWithRef<'div'>>;
  seek?: ComponentType<ComponentPropsWithRef<'input'>>;
  record?: ComponentType<Omit<ButtonProps, 'sx'>>;
  stop?: ComponentType<Omit<ButtonProps, 'sx'>>;
  play?: ComponentType<Omit<ButtonProps, 'sx'>>;
  discard?: ComponentType<Omit<ButtonProps, 'sx'>>;
  send?: ComponentType<Omit<ButtonProps, 'sx'>>;
  status?: ComponentType<ComponentPropsWithRef<'span'>>;
  error?: ComponentType<ComponentPropsWithRef<'p'>>;
}

export interface VoiceRecorderSlotProps {
  root?: ComponentPropsWithRef<'section'> & SxProps;
  messageList?: ComponentPropsWithRef<'ol'> & SxProps;
  composer?: ComponentPropsWithRef<'div'> & SxProps;
  waveform?: ComponentPropsWithRef<'div'> & SxProps;
  seek?: ComponentPropsWithRef<'input'> & SxProps;
  record?: Partial<ButtonProps> & SxProps;
  stop?: Partial<ButtonProps> & SxProps;
  play?: Partial<ButtonProps> & SxProps;
  discard?: Partial<ButtonProps> & SxProps;
  send?: Partial<ButtonProps> & SxProps;
  status?: ComponentPropsWithRef<'span'> & SxProps;
  error?: ComponentPropsWithRef<'p'> & SxProps;
}

export interface VoiceRecorderProps
  extends Omit<ComponentPropsWithRef<'section'>, 'children' | 'defaultValue' | 'onChange'>,
    SxProps {
  /** Control the recording workflow state and active session or take. */
  value?: VoiceRecorderValue;
  /** Seed the uncontrolled workflow. Defaults to `{ state: 'idle' }`. */
  defaultValue?: VoiceRecorderValue;
  /** Receive requests to transition the recording workflow. */
  onValueChange?: (next: VoiceRecorderValue) => void;
  /** Start consumer-owned audio capture for the generated session id. Rejection enters the error state. */
  onRecordRequest: (sessionId: string) => void | Promise<void>;
  /** Stop consumer-owned capture and return the take id to review. Rejection enters the error state. */
  onStopRequest: (sessionId: string) => { takeId: string } | Promise<{ takeId: string }>;
  /** Send the reviewed take. Resolution returns to idle; rejection preserves the take for retry. */
  onSend: (takeId: string) => void | Promise<void>;
  /** Release the discarded session or take using its id. */
  onDiscard?: (id: string) => void;
  /** Update the recording's elapsed time in seconds. Defaults to 0. */
  elapsed?: number;
  /** Set the reviewed take's duration in seconds. Defaults to 0. */
  duration?: number;
  /** Supply waveform amplitudes, clamped to 0–1. Omit for placeholder bars. */
  peaks?: readonly number[];
  /** Request a stop when `elapsed` reaches this many seconds. Defaults to 60. */
  maxDuration?: number;
  /** Control the review playback position in seconds. */
  currentTime?: number;
  /** Seed the uncontrolled review position in seconds. Defaults to 0. */
  defaultCurrentTime?: number;
  /** Receive review seek requests in seconds. */
  onCurrentTimeChange?: (seconds: number) => void;
  /** Control the review's playing state; audio playback is consumer-owned. */
  playing?: boolean;
  /** Seed the uncontrolled review playing state. Defaults to `false`. */
  defaultPlaying?: boolean;
  /** Receive requests to start or pause consumer-owned review playback. */
  onPlayingChange?: (playing: boolean) => void;
  /** Display previously sent voice messages. Defaults to an empty list. */
  messages?: readonly VoiceMessage[];
  /** Receive a message id and its requested playing state. */
  onMessagePlay?: (id: string, playing: boolean) => void;
  /** Receive a message id and its requested seek position in seconds. */
  onMessageSeek?: (id: string, time: number) => void;
  /** Reflect the active message's playback state and position in seconds. Defaults to `null`. */
  messagePlayback?: { id: string; playing: boolean; currentTime: number } | null;
  /** Choose the locale for durations and message timestamps. */
  locale?: string;
  /** Replace action labels, announcements, and optional duration formatters. Defaults to English labels. */
  labels?: VoiceRecorderLabels;
  /** Prevent recording and playback actions. Defaults to `false`. */
  disabled?: boolean;
  /** Set composer control dimensions. Defaults to `md`. */
  size?: VoiceRecorderSize;
  /** Replace the outer section; `slots.root` takes precedence. */
  component?: VoiceRecorderSlots['root'];
  /** Replace composer, waveform, message list, and action elements. */
  slots?: VoiceRecorderSlots;
  /** Pass props to composer, waveform, message list, and action elements. */
  slotProps?: VoiceRecorderSlotProps;
}

const DEFAULT_VALUE: VoiceRecorderValue = { state: 'idle' };

const DEFAULT_LABELS: VoiceRecorderLabels = {
  root: 'Voice recorder',
  messages: 'Voice messages',
  record: 'Record voice note',
  stop: 'Stop recording',
  play: 'Play recording',
  pause: 'Pause playback',
  discard: 'Discard recording',
  send: 'Send voice note',
  sending: 'Sending voice note…',
  seek: 'Review position',
  status: {
    idle: 'Ready to record',
    recording: 'Recording voice note',
    review: 'Reviewing voice note',
    pending: 'Sending voice note',
    sent: 'Voice note sent',
    discarded: 'Voice note discarded',
    error: 'Voice recording error',
  },
};

function stateKey(value: VoiceRecorderValue) {
  const id = value.state === 'recording' ? value.sessionId : 'takeId' in value ? value.takeId : '';
  return `${value.state}:${id ?? ''}`;
}

function sameValue(left: VoiceRecorderValue, right: VoiceRecorderValue) {
  return stateKey(left) === stateKey(right) &&
    (left.state !== 'error' || right.state !== 'error' || left.error === right.error);
}

function normalizePeak(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function renderReviewBars(
  peaks: readonly number[],
  currentTime: number,
  duration: number,
  barCount = 32,
) {
  const safeDuration = duration > 0 && Number.isFinite(duration) ? duration : 1;
  const progressRatio = Math.max(0, Math.min(1, currentTime / safeDuration));

  const normalizedPeaks: number[] = [];
  if (peaks.length === 0) {
    for (let i = 0; i < barCount; i++) normalizedPeaks.push(0.25);
  } else {
    for (let i = 0; i < barCount; i++) {
      const index = Math.floor((i / barCount) * peaks.length);
      normalizedPeaks.push(normalizePeak(peaks[index] ?? 0));
    }
  }

  const svgWidth = 320;
  const svgHeight = 40;
  const totalGap = (barCount - 1) * 3;
  const barWidth = Math.max(2, (svgWidth - totalGap) / barCount);

  return normalizedPeaks.map((peak, i) => {
    const x = i * (barWidth + 3);
    const minHeight = 4;
    const barHeight = Math.max(minHeight, peak * (svgHeight - 8));
    const y = (svgHeight - barHeight) / 2;
    const isPlayed = i / (barCount - 1) <= progressRatio;

    return (
      <rect
        key={i}
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        rx={1.5}
        fill={isPlayed ? 'var(--ui-color-accent)' : 'var(--ui-color-border-control)'}
        data-played={isPlayed}
      />
    );
  });
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true">
      <path d="M8 1a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 8 1z" />
      <path d="M4 7.5a.75.75 0 0 0-1.5 0 5.5 5.5 0 0 0 5 5.47V14.5H6a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5H8.5v-1.53A5.5 5.5 0 0 0 13.5 7.5a.75.75 0 0 0-1.5 0 4 4 0 1 1-8 0z" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true">
      <path d="M4.5 3.2v9.6l7.8-4.8z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true">
      <rect x="3.5" y="3" width="3" height="10" rx="1" />
      <rect x="9.5" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}

function DiscardGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M3 4.5h10M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5m2 0V13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V4.5m3 3v4.5m4-4.5v4.5" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M14 2L7 9M14 2l-4 12-3-5-5-3 12-4z" />
    </svg>
  );
}

const rootStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[4],
  minInlineSize: 0,
  inlineSize: '100%',
  fontFamily: vars.font.sans,
  color: vars.color.text,
  lineHeight: vars.lineHeight.base,
});

const sizeStyles: Record<VoiceRecorderSize, SerializedStyles> = {
  sm: css({
    '--voice-recorder-control-size': buttonBlockSizes.sm,
    fontSize: vars.textSize.sm,
    '& [data-ui="voice-recorder-composer"]': {
      padding: vars.space[3],
      gap: vars.space[2],
    },
  }),
  md: css({
    '--voice-recorder-control-size': buttonBlockSizes.md,
    fontSize: vars.textSize.md,
    '& [data-ui="voice-recorder-composer"]': {
      padding: vars.space[4],
      gap: vars.space[3],
    },
  }),
};

const composerStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderControl}`,
  backgroundColor: vars.color.surfaceRaised,
  boxShadow: vars.shadow.raised,
  minInlineSize: 0,
  inlineSize: '100%',
  position: 'relative',
  transition: `border-color ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { transition: 'none' },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});

const waveformContainerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  inlineSize: '100%',
  minInlineSize: 0,
});

const voiceOrbWrapperStyle = css({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  inlineSize: '100%',
  paddingBlock: vars.space[2],
});

const reviewBarsSvgStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '2.5rem',
  overflow: 'visible',
  '&:dir(rtl)': { transform: 'scaleX(-1)' },
  [FORCED_COLORS]: {
    '& rect[data-played="true"]': {
      fill: 'Highlight',
    },
    '& rect[data-played="false"]': {
      fill: 'CanvasText',
    },
  },
});

const controlsRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: vars.space[2],
  inlineSize: '100%',
});

const controlStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  blockSize: 'auto',
  minBlockSize: 'var(--voice-recorder-control-size)',
  paddingBlock: vars.space[1],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});

const timerStyle = css({
  direction: 'ltr',
  unicodeBidi: 'isolate',
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});

const seekInputStyle = css({
  minInlineSize: 0,
  font: 'inherit',
  color: vars.color.text,
  inlineSize: '100%',
  blockSize: vars.space[8],
  appearance: 'none',
  background: 'transparent',
  cursor: 'pointer',
  margin: 0,
  padding: 0,
  '&:disabled': {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&::-webkit-slider-runnable-track': {
    blockSize: vars.space[1],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.borderControl,
  },
  '&::-webkit-slider-thumb': {
    appearance: 'none',
    blockSize: vars.space[4],
    inlineSize: vars.space[4],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.accent,
    marginTop: `calc((${vars.space[1]} - ${vars.space[4]}) / 2)`,
    transition: `transform ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
    '&:hover': {
      transform: 'scale(1.15)',
    },
  },
  '&:focus-visible::-webkit-slider-thumb': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&::-moz-range-track': {
    blockSize: vars.space[1],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.borderControl,
  },
  '&::-moz-range-thumb': {
    blockSize: vars.space[4],
    inlineSize: vars.space[4],
    borderRadius: vars.radius.full,
    border: 'none',
    backgroundColor: vars.color.accent,
  },
  '&:focus-visible::-moz-range-thumb': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  [REDUCED_MOTION]: {
    '&::-webkit-slider-thumb': { transition: 'none', transform: 'none' },
  },
  [FORCED_COLORS]: {
    '&::-webkit-slider-runnable-track': {
      backgroundColor: 'CanvasText',
    },
    '&::-webkit-slider-thumb': {
      backgroundColor: 'Highlight',
    },
    '&::-moz-range-track': {
      backgroundColor: 'CanvasText',
    },
    '&::-moz-range-thumb': {
      backgroundColor: 'Highlight',
    },
  },
});

const errorStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.dangerText,
  overflowWrap: 'anywhere',
});

const messageListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[2],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  inlineSize: '100%',
});

const messageItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  padding: vars.space[3],
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceInset,
  border: `1px solid ${vars.color.borderControl}`,
  minInlineSize: 0,
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
  },
});

const messageContentStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[1],
  flex: '1 1 auto',
  minInlineSize: 0,
});

const messageSenderStyle = css({
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const messageControlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  inlineSize: '100%',
  minInlineSize: 0,
});

const messageMetadataStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});

/** Record, review and send voice messages using app-owned audio. */
export function VoiceRecorder({
  value: valueProp,
  defaultValue: defaultValueProp,
  onValueChange,
  onRecordRequest,
  onStopRequest,
  onSend,
  onDiscard,
  elapsed = 0,
  duration = 0,
  peaks = [],
  maxDuration = 60,
  currentTime: currentTimeProp,
  defaultCurrentTime: defaultCurrentTimeProp,
  onCurrentTimeChange,
  playing: playingProp,
  defaultPlaying: defaultPlayingProp,
  onPlayingChange,
  messages = [],
  onMessagePlay,
  onMessageSeek,
  messagePlayback = null,
  locale,
  labels = DEFAULT_LABELS,
  disabled = false,
  size = 'md',
  component,
  slots,
  slotProps,
  ref,
  className,
  style,
  sx,
  ...rest
}: VoiceRecorderProps) {
  const [value = DEFAULT_VALUE, requestValue] = useControlledState(
    valueProp,
    defaultValueProp ?? DEFAULT_VALUE,
    onValueChange,
  );
  const [currentTime = 0, requestCurrentTime] = useControlledState(
    currentTimeProp,
    defaultCurrentTimeProp ?? 0,
    onCurrentTimeChange,
  );
  const [playing = false, requestPlaying] = useControlledState(
    playingProp,
    defaultPlayingProp ?? false,
    onPlayingChange,
  );

  const formatters = useMemo(() => createDurationFormatters(locale), [locale]);
  const formatDigital = labels.formatDuration ?? formatters.digital;
  const formatSpoken = labels.formatDurationSpoken ?? formatters.spoken;

  const instanceId = useId();
  const errorId = `${instanceId}-error`;
  const statusId = `${instanceId}-status`;
  const hasError = value.state === 'error' && isRenderable(value.error);

  const [statusText, setStatusText] = useState('');

  const activeOperationTokenRef = useRef(0);
  const committedValueRef = useRef(value);
  const requestedTransitionRef = useRef<{ value: VoiceRecorderValue; announcement: string } | null>(null);
  const isStoppingRef = useRef(false);
  const isSendingRef = useRef(false);
  const hasStoppedSessionRef = useRef<string | null>(null);

  const composerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  const transitionFocusRef = useRef<'stop' | 'send' | 'record' | null>(null);

  const recordRequestRef = useRef(onRecordRequest);
  const stopRequestRef = useRef(onStopRequest);
  const sendRef = useRef(onSend);
  const discardRef = useRef(onDiscard);
  useLayoutEffect(() => {
    recordRequestRef.current = onRecordRequest;
    stopRequestRef.current = onStopRequest;
    sendRef.current = onSend;
    discardRef.current = onDiscard;
  });

  const transition = (next: VoiceRecorderValue, announcement: string) => {
    requestedTransitionRef.current = { value: next, announcement };
    requestValue(next);
  };

  useLayoutEffect(() => {
    const requested = requestedTransitionRef.current;
    if (sameValue(value, committedValueRef.current)) return;
    committedValueRef.current = value;
    if (requested && sameValue(requested.value, value)) {
      setStatusText(requested.announcement);
    } else {
      activeOperationTokenRef.current++;
      isStoppingRef.current = false;
      isSendingRef.current = false;
      transitionFocusRef.current = null;
      setStatusText(labels.status[value.state]);
    }
    requestedTransitionRef.current = null;
  }, [value, labels]);

  useLayoutEffect(() => {
    const target = transitionFocusRef.current;
    if (!target) return;
    const document = rootRef.current?.ownerDocument;
    const active = document?.activeElement;
    if (active && active !== document?.body && !composerRef.current?.contains(active)) {
      transitionFocusRef.current = null;
      return;
    }
    if (target === 'stop' && value.state === 'recording') {
      transitionFocusRef.current = null;
      stopButtonRef.current?.focus();
    } else if (target === 'send' && value.state === 'review') {
      transitionFocusRef.current = null;
      sendButtonRef.current?.focus();
    } else if (target === 'record' && value.state === 'idle') {
      transitionFocusRef.current = null;
      recordButtonRef.current?.focus();
    }
  }, [value.state]);

  const handleRecord = async () => {
    if (disabled) return;
    const token = ++activeOperationTokenRef.current;
    const sessionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (composerRef.current?.contains(composerRef.current.ownerDocument.activeElement)) {
      transitionFocusRef.current = 'stop';
    } else {
      transitionFocusRef.current = null;
    }

    transition({ state: 'recording', sessionId }, labels.status.recording);

    try {
      const result = recordRequestRef.current(sessionId);
      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (err) {
      if (token !== activeOperationTokenRef.current) return;
      transitionFocusRef.current = null;
      transition({
        state: 'error',
        error: err instanceof Error ? err.message : String(err),
      }, labels.status.error);
    }
  };

  const handleStop = async () => {
    if (disabled || isStoppingRef.current) return;
    if (value.state !== 'recording') return;
    const sessionId = value.sessionId;

    isStoppingRef.current = true;
    const token = ++activeOperationTokenRef.current;

    if (composerRef.current?.contains(composerRef.current.ownerDocument.activeElement)) {
      transitionFocusRef.current = 'send';
    } else {
      transitionFocusRef.current = null;
    }

    try {
      const result = await stopRequestRef.current(sessionId);
      if (token !== activeOperationTokenRef.current) return;
      if (!result || typeof result.takeId !== 'string') {
        throw new Error('Stop request must return a takeId');
      }
      transition({ state: 'review', takeId: result.takeId }, labels.status.review);
    } catch (err) {
      if (token !== activeOperationTokenRef.current) return;
      transitionFocusRef.current = null;
      transition({
        state: 'error',
        error: err instanceof Error ? err.message : String(err),
      }, labels.status.error);
    } finally {
      if (token === activeOperationTokenRef.current) isStoppingRef.current = false;
    }
  };

  const handleSend = async () => {
    if (disabled || isSendingRef.current) return;
    const takeId =
      value.state === 'review'
        ? value.takeId
        : value.state === 'error'
          ? value.takeId
          : undefined;
    if (!takeId) return;

    isSendingRef.current = true;
    const token = ++activeOperationTokenRef.current;

    if (composerRef.current?.contains(composerRef.current.ownerDocument.activeElement)) {
      transitionFocusRef.current = 'record';
    } else {
      transitionFocusRef.current = null;
    }

    transition({ state: 'pending', takeId }, labels.status.pending);

    try {
      const result = sendRef.current(takeId);
      if (result && typeof result.then === 'function') {
        await result;
      }
      if (token !== activeOperationTokenRef.current) return;
      transition({ state: 'idle' }, labels.status.sent);
      requestPlaying(false);
      requestCurrentTime(0);
    } catch (err) {
      if (token !== activeOperationTokenRef.current) return;
      transitionFocusRef.current = null;
      transition({
        state: 'error',
        takeId,
        error: err instanceof Error ? err.message : String(err),
      }, labels.status.error);
    } finally {
      if (token === activeOperationTokenRef.current) isSendingRef.current = false;
    }
  };

  const handleDiscard = () => {
    if (disabled) return;
    activeOperationTokenRef.current++;
    isStoppingRef.current = false;
    isSendingRef.current = false;
    if (composerRef.current?.contains(composerRef.current.ownerDocument.activeElement)) {
      transitionFocusRef.current = 'record';
    } else {
      transitionFocusRef.current = null;
    }

    const currentId =
      value.state === 'recording'
        ? value.sessionId
        : value.state === 'review' || value.state === 'pending' || value.state === 'error'
          ? value.takeId
          : undefined;

    if (currentId) {
      discardRef.current?.(currentId);
    }

    transition({ state: 'idle' }, labels.status.discarded);
    requestPlaying(false);
    requestCurrentTime(0);
  };

  // Max duration threshold check: triggers stop once per session
  useEffect(() => {
    if (value.state === 'recording' && typeof value.sessionId === 'string') {
      const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
      if (safeElapsed >= maxDuration && hasStoppedSessionRef.current !== value.sessionId) {
        hasStoppedSessionRef.current = value.sessionId;
        handleStop();
      }
    }
  }, [value, elapsed, maxDuration]);

  // Clean up ongoing operations on unmount
  useEffect(() => {
    return () => {
      activeOperationTokenRef.current++;
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    (slotProps?.root?.onKeyDown ?? rest.onKeyDown)?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      if (value.state === 'recording' || value.state === 'review') {
        event.preventDefault();
        handleDiscard();
      }
    }
  };

  const safeDuration = duration > 0 && Number.isFinite(duration) ? duration : 0;
  const clampedCurrentTime = Math.max(0, Math.min(currentTime, safeDuration));
  const seekValueText = labels.formatSeekValueText
    ? labels.formatSeekValueText(clampedCurrentTime, safeDuration)
    : `${formatSpoken(clampedCurrentTime)} of ${formatSpoken(safeDuration)}`;

  const handleSeekChange = (event: ChangeEvent<HTMLInputElement>) => {
    slotProps?.seek?.onChange?.(event);
    if (event.defaultPrevented) return;
    const nextSeconds = Number(event.target.value);
    requestCurrentTime(Math.max(0, Math.min(nextSeconds, safeDuration)));
  };

  const latestPeak = peaks.length > 0 ? normalizePeak(peaks[peaks.length - 1] ?? 0) : 0;

  // Resolve replaceable slots
  const Root = slots?.root ?? component ?? 'section';
  const MessageList = slots?.messageList ?? 'ol';
  const Composer = slots?.composer ?? 'div';
  const Waveform = slots?.waveform ?? 'div';
  const Seek = slots?.seek ?? 'input';
  const RecordButton = slots?.record ?? Button;
  const StopButton = slots?.stop ?? Button;
  const PlayButton = slots?.play ?? Button;
  const DiscardButton = slots?.discard ?? Button;
  const SendButton = slots?.send ?? Button;
  const Status = slots?.status ?? 'span';
  const ErrorPart = slots?.error ?? 'p';

  const mergedRecordRef = useMergeRefs([recordButtonRef, slotProps?.record?.ref]);
  const mergedStopRef = useMergeRefs([stopButtonRef, slotProps?.stop?.ref]);
  const mergedSendRef = useMergeRefs([sendButtonRef, slotProps?.send?.ref]);
  const mergedRootRef = useMergeRefs([rootRef, ref, slotProps?.root?.ref]);
  const mergedComposerRef = useMergeRefs([composerRef, slotProps?.composer?.ref]);
  const { sx: rootCss, className: rootClassName, style: rootStyleProp, ...rootProps } = slotProps?.root ?? {};

  const describedBy = [
    rest['aria-describedby'],
    slotProps?.root?.['aria-describedby'],
    hasError ? errorId : undefined,
    statusText ? statusId : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <MotionConfig reducedMotion="user">
      <WithSx
        className={[rootClassName, className].filter(Boolean).join(' ')}
        styles={[rootStyle, sizeStyles[size], rootCss]}
        sx={sx}
      >
        {(resolvedClassName) => (
          <Root
            {...rest}
            {...rootProps}
            ref={mergedRootRef}
            style={{ ...style, ...rootStyleProp }}
            className={resolvedClassName}
            data-ui="voice-recorder"
            data-state={value.state}
            aria-label={slotProps?.root?.['aria-label'] ?? rest['aria-label'] ?? labels.root}
            aria-describedby={describedBy}
            onKeyDown={handleKeyDown}
          >
            {messages && messages.length > 0 && (
              <MessageList
                {...withoutSx(slotProps?.messageList)}
                role="list"
                aria-label={labels.messages}
                data-ui="voice-recorder-messages"
                css={[messageListStyle, slotProps?.messageList?.sx]}
              >
                {messages.map((msg) => {
                  const isPlayingMsg =
                    messagePlayback?.id === msg.id && messagePlayback.playing;
                  const msgTime =
                    messagePlayback?.id === msg.id ? messagePlayback.currentTime : 0;
                  const msgDuration = Math.max(0, msg.duration);
                  const msgSeekText = `${formatSpoken(msgTime)} of ${formatSpoken(msgDuration)}`;

                  return (
                    <li
                      key={msg.id}
                      data-ui="voice-recorder-message"
                      css={messageItemStyle}
                    >
                      {isRenderable(msg.avatar) || msg.sender ? (
                        <Avatar
                          name={msg.sender ?? ''}
                          src={typeof msg.avatar === 'string' ? msg.avatar : undefined}
                          size="sm"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div css={messageContentStyle}>
                        {msg.sender ? (
                          <span
                            data-ui="voice-recorder-message-sender"
                            css={messageSenderStyle}
                          >
                            {msg.sender}
                          </span>
                        ) : null}
                        <div css={messageControlsStyle}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={isPlayingMsg ? labels.pause : labels.play}
                            onClick={() => onMessagePlay?.(msg.id, !isPlayingMsg)}
                          >
                            {isPlayingMsg ? <PauseGlyph /> : <PlayGlyph />}
                          </Button>
                          <input
                            type="range"
                            min={0}
                            max={msgDuration}
                            step={1}
                            value={msgTime}
                            disabled={msgDuration <= 0}
                            aria-label={`${labels.seek} - ${msg.sender ?? msg.id}`}
                            aria-valuetext={msgSeekText}
                            onChange={(e) => onMessageSeek?.(msg.id, Number(e.target.value))}
                            css={seekInputStyle}
                          />
                          <span css={timerStyle}>{formatDigital(msgDuration)}</span>
                        </div>
                        {isRenderable(msg.metadata) ? (
                          <span
                            data-ui="voice-recorder-message-metadata"
                            css={messageMetadataStyle}
                          >
                            {msg.metadata}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </MessageList>
            )}

            <Composer
              {...withoutSx(slotProps?.composer)}
              ref={mergedComposerRef}
              data-ui="voice-recorder-composer"
              css={[composerStyle, slotProps?.composer?.sx]}
            >
              {value.state === 'recording' && (
                <Waveform
                  {...withoutSx(slotProps?.waveform)}
                  data-ui="voice-recorder-waveform"
                  css={[waveformContainerStyle, slotProps?.waveform?.sx]}
                >
                  <VoiceOrb
                    state="listening"
                    inputLevel={latestPeak}
                    elapsed={elapsed}
                    locale={locale}
                    css={voiceOrbWrapperStyle}
                  >
                    <VoiceOrb.Visual size={size} />
                  </VoiceOrb>
                  <span data-ui="voice-recorder-timer" css={timerStyle}>
                    {formatDigital(elapsed)}
                  </span>
                </Waveform>
              )}

              {value.state === 'review' && (
                <Waveform
                  {...withoutSx(slotProps?.waveform)}
                  data-ui="voice-recorder-waveform"
                  css={[waveformContainerStyle, slotProps?.waveform?.sx]}
                >
                  <svg
                    viewBox="0 0 320 40"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    css={reviewBarsSvgStyle}
                  >
                    {renderReviewBars(peaks, clampedCurrentTime, safeDuration)}
                  </svg>
                  <Seek
                    {...withoutSx(slotProps?.seek)}
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={1}
                    value={clampedCurrentTime}
                    disabled={disabled || safeDuration <= 0}
                    aria-label={labels.seek}
                    aria-valuetext={seekValueText}
                    onChange={handleSeekChange}
                    data-ui="voice-recorder-seek"
                    css={[seekInputStyle, slotProps?.seek?.sx]}
                  />
                  <span data-ui="voice-recorder-timer" css={timerStyle}>
                    {formatDigital(clampedCurrentTime)} / {formatDigital(safeDuration)}
                  </span>
                </Waveform>
              )}

              <div css={controlsRowStyle}>
                {value.state === 'idle' && (
                  <RecordButton
                    variant="solid"
                    tone="accent"
                    size={size}
                    disabled={disabled}
                    {...withoutSx(slotProps?.record)}
                    css={[controlStyle, slotProps?.record?.sx]}
                    ref={mergedRecordRef}
                    onClick={(e) => {
                      slotProps?.record?.onClick?.(e);
                      if (!e.defaultPrevented) handleRecord();
                    }}
                    startIcon={<MicGlyph />}
                    aria-label={labels.record}
                  >
                    {labels.record}
                  </RecordButton>
                )}

                {value.state === 'recording' && (
                  <>
                    <StopButton
                      variant="solid"
                      tone="accent"
                      size={size}
                      disabled={disabled}
                      {...withoutSx(slotProps?.stop)}
                      css={[controlStyle, slotProps?.stop?.sx]}
                      ref={mergedStopRef}
                      onClick={(e) => {
                        slotProps?.stop?.onClick?.(e);
                        if (!e.defaultPrevented) handleStop();
                      }}
                      startIcon={<StopGlyph />}
                      aria-label={labels.stop}
                    >
                      {labels.stop}
                    </StopButton>
                    <DiscardButton
                      variant="outline"
                      size={size}
                      disabled={disabled}
                      {...withoutSx(slotProps?.discard)}
                      css={[controlStyle, slotProps?.discard?.sx]}
                      onClick={(e) => {
                        slotProps?.discard?.onClick?.(e);
                        if (!e.defaultPrevented) handleDiscard();
                      }}
                      startIcon={<DiscardGlyph />}
                      aria-label={labels.discard}
                    >
                      {labels.discard}
                    </DiscardButton>
                  </>
                )}

                {(value.state === 'review' || value.state === 'pending') && (
                  <>
                    <PlayButton
                      variant="outline"
                      size={size}
                      {...withoutSx(slotProps?.play)}
                      css={[controlStyle, slotProps?.play?.sx]}
                      disabled={disabled || value.state === 'pending' || slotProps?.play?.disabled}
                      onClick={(e) => {
                        slotProps?.play?.onClick?.(e);
                        if (!e.defaultPrevented && !disabled && value.state !== 'pending') requestPlaying(!playing);
                      }}
                      startIcon={playing ? <PauseGlyph /> : <PlayGlyph />}
                      aria-label={playing ? labels.pause : labels.play}
                    >
                      {playing ? labels.pause : labels.play}
                    </PlayButton>
                    <DiscardButton
                      variant="outline"
                      size={size}
                      disabled={disabled || value.state === 'pending'}
                      {...withoutSx(slotProps?.discard)}
                      css={[controlStyle, slotProps?.discard?.sx]}
                      onClick={(e) => {
                        slotProps?.discard?.onClick?.(e);
                        if (!e.defaultPrevented) handleDiscard();
                      }}
                      startIcon={<DiscardGlyph />}
                      aria-label={labels.discard}
                    >
                      {labels.discard}
                    </DiscardButton>
                    <SendButton
                      variant="solid"
                      tone="accent"
                      size={size}
                      {...withoutSx(slotProps?.send)}
                      css={[controlStyle, slotProps?.send?.sx]}
                      disabled={disabled}
                      loading={value.state === 'pending'}
                      aria-busy={value.state === 'pending'}
                      aria-disabled={value.state === 'pending' || disabled}
                      ref={mergedSendRef}
                      onClick={(e) => {
                        slotProps?.send?.onClick?.(e);
                        if (!e.defaultPrevented && value.state !== 'pending') handleSend();
                      }}
                      startIcon={value.state !== 'pending' ? <SendGlyph /> : undefined}
                      aria-label={value.state === 'pending' ? labels.sending : labels.send}
                    >
                      {value.state === 'pending' ? labels.sending : labels.send}
                    </SendButton>
                  </>
                )}

                {value.state === 'error' && (
                  <>
                    {value.takeId ? (
                      <>
                        <DiscardButton
                          variant="outline"
                          size={size}
                          disabled={disabled}
                          {...withoutSx(slotProps?.discard)}
                          css={[controlStyle, slotProps?.discard?.sx]}
                          onClick={(e) => {
                            slotProps?.discard?.onClick?.(e);
                            if (!e.defaultPrevented) handleDiscard();
                          }}
                          startIcon={<DiscardGlyph />}
                          aria-label={labels.discard}
                        >
                          {labels.discard}
                        </DiscardButton>
                        <SendButton
                          variant="solid"
                          tone="accent"
                          size={size}
                          disabled={disabled}
                          {...withoutSx(slotProps?.send)}
                          css={[controlStyle, slotProps?.send?.sx]}
                          ref={mergedSendRef}
                          onClick={(e) => {
                            slotProps?.send?.onClick?.(e);
                            if (!e.defaultPrevented) handleSend();
                          }}
                          startIcon={<SendGlyph />}
                          aria-label={labels.send}
                        >
                          {labels.send}
                        </SendButton>
                      </>
                    ) : (
                      <RecordButton
                        variant="solid"
                        tone="accent"
                        size={size}
                        disabled={disabled}
                        {...withoutSx(slotProps?.record)}
                        css={[controlStyle, slotProps?.record?.sx]}
                        ref={mergedRecordRef}
                        onClick={(e) => {
                          slotProps?.record?.onClick?.(e);
                          if (!e.defaultPrevented) handleRecord();
                        }}
                        startIcon={<MicGlyph />}
                        aria-label={labels.record}
                      >
                        {labels.record}
                      </RecordButton>
                    )}
                  </>
                )}
              </div>
            </Composer>

            <Status
              {...withoutSx(slotProps?.status)}
              id={statusId}
              role="status"
              aria-atomic="true"
              data-ui="voice-recorder-status"
              css={[visuallyHiddenStyle, slotProps?.status?.sx]}
            >
              {statusText}
            </Status>

            {hasError && (
              <ErrorPart
                {...withoutSx(slotProps?.error)}
                id={errorId}
                role="alert"
                data-ui="voice-recorder-error"
                css={[errorStyle, slotProps?.error?.sx]}
              >
                {value.error}
              </ErrorPart>
            )}
          </Root>
        )}
      </WithSx>
    </MotionConfig>
  );
}

VoiceRecorder.displayName = 'VoiceRecorder';
