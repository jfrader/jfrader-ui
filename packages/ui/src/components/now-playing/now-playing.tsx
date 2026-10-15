'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { MotionConfig, motion, useInView, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';
import { Card } from '../card';
import { Progress } from '../progress';
import { Slider, type SliderProps } from '../slider';

export interface NowPlayingTrack {
  id: string;
  title: string;
  artist: string;
  duration: number | null;
  artwork?: string;
  artworkAlt?: string;
}
type Part<T extends 'div' | 'span' | 'img'> = ComponentPropsWithRef<T> & {
  css?: Interpolation<Theme>;
};
export interface NowPlayingSlotProps {
  /** Collapsed mini-player container element. */
  mini?: Part<'div'>;
  /** Expanded full-player container element. */
  full?: Part<'div'>;
  /** Image element displaying track album artwork. */
  artwork?: Part<'img'>;
  /** Text element displaying the active track title. */
  title?: Part<'span'>;
  /** Text element displaying the active track artist. */
  artist?: Part<'span'>;
  /** Button element expanding the player to full view; renders `Button`. */
  expand?: Omit<ButtonProps, 'sx' | 'render'>;
  /** Button element collapsing the player to mini view; renders `Button`. */
  collapse?: Omit<ButtonProps, 'sx' | 'render'>;
  /** Timeline scrubber slider element; renders `Slider`. */
  seek?: Omit<
    Extract<SliderProps, { type?: 'single' }>,
    | 'sx'
    | 'type'
    | 'value'
    | 'defaultValue'
    | 'onValueChange'
    | 'label'
    | 'dir'
    | 'min'
    | 'max'
    | 'step'
    | 'largeStep'
    | 'locale'
    | 'formatValue'
    | 'formatOptions'
    | 'showValue'
  >;
  /** Container holding the animated audio level bars. */
  waveform?: Part<'div'>;
  /** Container element wrapping playback control buttons. */
  controls?: Part<'div'>;
  /** Text element displaying playback status or duration. */
  status?: Part<'span'>;
  /** Container element displaying playback error messages. */
  error?: Part<'div'>;
}
export interface NowPlayingLabels {
  play: string;
  pause: string;
  previous: string;
  next: string;
  expand: string;
  collapse: string;
  seek: string;
  empty: string;
  unavailable: string;
  busy: string;
  playing: string;
  paused: string;
  position: (elapsed: string, duration: string) => string;
}
export interface NowPlayingSlots {
  /** Replaces the mini-player container. */
  mini?: ComponentType<Part<'div'>>;
  /** Replaces the full-player container. */
  full?: ComponentType<Part<'div'>>;
  /** Replaces the artwork image. */
  artwork?: ComponentType<Part<'img'>>;
  /** Replaces the track title. */
  title?: ComponentType<Part<'span'>>;
  /** Replaces the artist name. */
  artist?: ComponentType<Part<'span'>>;
  /** Replaces the expand button. */
  expand?: ComponentType<NonNullable<NowPlayingSlotProps['expand']>>;
  /** Replaces the collapse button. */
  collapse?: ComponentType<NonNullable<NowPlayingSlotProps['collapse']>>;
  /** Replaces the timeline slider. */
  seek?: ComponentType<NonNullable<NowPlayingSlotProps['seek']> & Extract<SliderProps, { type?: 'single' }>>;
  /** Replaces the waveform container. */
  waveform?: ComponentType<Part<'div'>>;
  /** Replaces the playback controls container. */
  controls?: ComponentType<Part<'div'>>;
  /** Replaces the playback status. */
  status?: ComponentType<Part<'span'>>;
  /** Replaces the error container. */
  error?: ComponentType<Part<'div'>>;
}

export interface NowPlayingProps
  extends
    Omit<ComponentPropsWithRef<'section'>, 'defaultValue' | 'children' | 'onChange'>,
    SxProps {
  tracks: readonly NowPlayingTrack[];
  value?: number;
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  playing?: boolean;
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  position?: number;
  defaultPosition?: number;
  onPositionChange?: (seconds: number) => void;
  busy?: boolean;
  error?: ReactNode;
  waveform?: readonly number[];
  label?: string;
  labels?: Partial<NowPlayingLabels>;
  locale?: Intl.LocalesArgument;
  /**
   * Seconds per arrow step. Duration must be a whole number of steps.
   * A step that does not divide it is rounded to the nearest one that does (180s with 7 → 180/26).
   * Defaults to the largest step of at most one second that divides the duration.
   */
  seekStep?: number;
  seekLargeStep?: number;
  slots?: NowPlayingSlots;
  slotProps?: NowPlayingSlotProps;
}
export interface NowPlayingLevelsProps extends ComponentPropsWithRef<'span'>, SxProps {
  playing?: boolean;
}

const RESTART_SECONDS = 3;
const COLLAPSE_DISTANCE = 70;
const COLLAPSE_VELOCITY = 700;
const ARTWORK_TRAVEL = 12;
const LEVEL_HEIGHTS = [0.6, 1, 0.75, 0.9, 0.5];
const SHELL_WIDTH = '21rem';
const SHELL_SPRING = { type: 'spring', stiffness: 360, damping: 32 } as const;
const WAVEFORM_PATTERN = [0.2, 0.4, 0.7, 0.45, 0.9, 0.6, 0.35, 0.8, 0.5];
const FALLBACK_WAVEFORM = Array.from(
  { length: 54 },
  (_, index) => WAVEFORM_PATTERN[index % WAVEFORM_PATTERN.length]!,
);
const DEFAULT_LABELS: NowPlayingLabels = {
  play: 'Play',
  pause: 'Pause',
  previous: 'Previous',
  next: 'Next',
  expand: 'Expand',
  collapse: 'Collapse',
  seek: 'Seek',
  empty: 'No track selected',
  unavailable: 'Duration unavailable',
  busy: 'Loading',
  playing: 'Playing',
  paused: 'Paused',
  position: (elapsed, duration) => `${elapsed} / ${duration}`,
};
const PlayingContext = createContext(false);
const pulse = keyframes({ from: { transform: 'scaleY(0.35)' }, to: { transform: 'scaleY(1)' } });
const rootStyle = css({
  inlineSize: `min(100%, ${SHELL_WIDTH})`,
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  color: vars.color.text,
});
const surfaceStyle = css({ padding: vars.space[4], overflowWrap: 'anywhere' });
const miniStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  '&[hidden]': { display: 'none' },
});
const fullStyle = css({ display: 'grid', gap: vars.space[4], '&[hidden]': { display: 'none' } });
const metadataStyle = css({
  display: 'grid',
  gap: vars.space[1],
  flex: '1 1 6rem',
  minInlineSize: 0,
});
const titleStyle = css({ fontSize: vars.textSize.md, fontWeight: vars.fontWeight.medium });
const artistStyle = css({ fontSize: vars.textSize.sm, color: vars.color.textMuted });
const artworkStyle = css({
  display: 'block',
  inlineSize: '100%',
  aspectRatio: '1',
  objectFit: 'cover',
  borderRadius: vars.radius.lg,
  background: vars.color.surfaceInset,
});
const miniArtworkStyle = css({ inlineSize: vars.space[12], flexShrink: 0 });
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: vars.space[2],
});
const timesStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: vars.space[2],
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
});
const waveformStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1px',
  blockSize: vars.space[8],
  pointerEvents: 'none',
  [FORCED_COLORS]: { display: 'none' },
});
const barStyle = css({
  flex: '1 1 0',
  minInlineSize: 0,
  background: vars.color.accentText,
  borderRadius: vars.radius.full,
});
const errorStyle = css({
  marginBlockStart: vars.space[3],
  color: vars.color.dangerText,
  fontSize: vars.textSize.sm,
});
const levelsStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  blockSize: vars.space[6],
  [FORCED_COLORS]: { display: 'none' },
});
const levelStyle = css({
  inlineSize: vars.space[1],
  blockSize: '100%',
  background: vars.color.accentText,
  transformOrigin: 'bottom',
  animation: `${pulse} ${vars.motion.duration.slow} ease-in-out infinite alternate`,
  animationPlayState: 'paused',
  '[data-playing] > &': { animationPlayState: 'running' },
  [REDUCED_MOTION]: { animation: 'none' },
});

type DurationFormatter = new (
  locale?: Intl.LocalesArgument,
  options?: { style: 'digital' },
) => { format(value: { hours: number; minutes: number; seconds: number }): string };
function formatDuration(value: number, locale?: Intl.LocalesArgument) {
  const seconds = Math.floor(value);
  const duration = {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
  const DurationFormat = (Intl as typeof Intl & { DurationFormat?: DurationFormatter })
    .DurationFormat;
  if (typeof DurationFormat === 'function')
    return new DurationFormat(locale, { style: 'digital' }).format(duration);
  return new Intl.ListFormat(locale, { style: 'short', type: 'unit' }).format(
    Object.entries(duration)
      .filter(([unit, n]) => n > 0 || unit === 'seconds')
      .map(([unit, n]) =>
        numberFormatter(locale, {
          style: 'unit',
          unit: unit.slice(0, -1),
          unitDisplay: 'short',
        }).format(n),
      ),
  );
}
function seekLattice(duration: number, step?: number) {
  if (step === undefined || !Number.isFinite(step) || step <= 0)
    return duration / Math.ceil(duration);
  const count = Math.max(1, Math.round(duration / step));
  return count * step === duration ? step : duration / count;
}
function joinIds(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}
function Artwork({ track, slot, component }: { track: NowPlayingTrack; slot?: Part<'img'>; component?: NonNullable<NowPlayingProps['slots']>['artwork'] }) {
  const [failed, setFailed] = useState(false);
  const Image = component ?? 'img';
  // The no-artwork and failed-load branch is never the consumer's replacement: an img-shaped
  // component there would render an empty image.
  const Placeholder = 'span';
  return failed || !track.artwork ? (
    <Placeholder
      className={slot?.className}
      style={slot?.style}
      css={[artworkStyle, slot?.css]}
      aria-hidden={!track.artworkAlt || undefined}
      role={track.artworkAlt ? 'img' : undefined}
      aria-label={track.artworkAlt}
    />
  ) : (
    <Image
      {...slot}
      draggable={false}
      data-ui="now-playing-artwork-image"
      css={[artworkStyle, slot?.css]}
      src={track.artwork}
      alt={track.artworkAlt ?? ''}
      onError={(e) => {
        setFailed(true);
        slot?.onError?.(e);
      }}
    />
  );
}
export function NowPlayingLevels({
  ref,
  playing: playingProp,
  className,
  sx,
  ...rest
}: NowPlayingLevelsProps) {
  const contextPlaying = useContext(PlayingContext);
  const node = useRef<HTMLSpanElement>(null);
  const mergedRef = useMergeRefs([node, ref]);
  const inView = useInView(node);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const doc = node.current?.ownerDocument;
    if (!doc) return;
    const update = () => setVisible(doc.visibilityState !== 'hidden');
    update();
    doc.addEventListener('visibilitychange', update);
    return () => doc.removeEventListener('visibilitychange', update);
  }, []);
  return (
    <WithSx className={className} styles={levelsStyle} sx={sx}>
      {(rootClass) => (
        <span
          {...rest}
          ref={mergedRef}
          className={rootClass}
          data-ui="now-playing-levels"
          aria-hidden="true"
          data-playing={
            ((playingProp ?? contextPlaying) && inView && visible && !reduced) || undefined
          }
        >
          {LEVEL_HEIGHTS.map((height, index) => (
            <span
              key={index}
              css={levelStyle}
              style={{
                blockSize: `${height * 100}%`,
                animationDelay: `calc(${vars.motion.duration.base} * ${index / -2})`,
              }}
            />
          ))}
        </span>
      )}
    </WithSx>
  );
}
NowPlayingLevels.displayName = 'NowPlaying.Levels';

function NowPlayingRoot({
  ref,
  tracks,
  value,
  defaultValue = 0,
  onValueChange,
  playing,
  defaultPlaying = false,
  onPlayingChange,
  open,
  defaultOpen = false,
  onOpenChange,
  position,
  defaultPosition = 0,
  onPositionChange,
  busy = false,
  error,
  waveform,
  label = 'Now playing',
  labels: labelsProp,
  locale,
  seekStep,
  seekLargeStep = 30,
  slots,
  slotProps,
  className,
  sx,
  onKeyDown,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: NowPlayingProps) {
  const [selected, requestIndex] = useControlledState(value, defaultValue, onValueChange);
  const [acceptedPlaying, requestPlaying] = useControlledState(
    playing,
    defaultPlaying,
    onPlayingChange,
  );
  const [acceptedOpen, requestOpen] = useControlledState(open, defaultOpen, onOpenChange);
  const [acceptedPosition, requestPosition] = useControlledState(
    position,
    defaultPosition,
    onPositionChange,
  );
  const index = selected ?? 0;
  const isPlaying = acceptedPlaying ?? false;
  const isOpen = acceptedOpen ?? false;
  const elapsed = acceptedPosition ?? 0;
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const track = Number.isInteger(index) ? tracks[index] : undefined;
  const duration =
    track?.duration != null && Number.isFinite(track.duration) && track.duration > 0
      ? track.duration
      : null;
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const bounded = duration === null ? safeElapsed : Math.min(duration, safeElapsed);
  const errorVisible = isRenderable(error) && error !== '';
  const id = useId();
  const expand = useRef<HTMLButtonElement>(null);
  const collapse = useRef<HTMLButtonElement>(null);
  const full = useRef<HTMLDivElement>(null);
  const expandRef = useMergeRefs([expand, slotProps?.expand?.ref]);
  const collapseRef = useMergeRefs([collapse, slotProps?.collapse?.ref]);
  const fullRef = useMergeRefs([full, slotProps?.full?.ref]);
  const keyboardOpen = useRef(false);
  const focusInFull = useRef(false);
  const reduced = useReducedMotion();
  const pendingDirection = useRef(0);
  const dragCancelled = useRef(false);
  const previousIndex = useRef(index);
  const direction = previousIndex.current === index ? 0 : pendingDirection.current;
  useEffect(() => {
    if (previousIndex.current !== index) {
      pendingDirection.current = 0;
      previousIndex.current = index;
    }
  }, [index]);
  useLayoutEffect(() => {
    if (isOpen && keyboardOpen.current) {
      collapse.current?.focus();
      keyboardOpen.current = false;
    }
    if (!isOpen && focusInFull.current) {
      expand.current?.focus();
      focusInFull.current = false;
    }
  }, [isOpen]);
  const skip = (delta: number) => {
    if (!track || busy) return;
    if (delta > 0 || bounded <= RESTART_SECONDS) {
      pendingDirection.current = delta;
      requestIndex((index + delta + tracks.length) % tracks.length);
    }
    requestPosition(0);
  };
  const close = () => requestOpen(false);
  const Mini = slots?.mini ?? 'div';
  const Full = slots?.full ?? 'div';
  const Title = slots?.title ?? 'span';
  const Artist = slots?.artist ?? 'span';
  const Expand = slots?.expand ?? Button;
  const Collapse = slots?.collapse ?? Button;
  const Seek = slots?.seek ?? Slider;
  const Waveform = slots?.waveform ?? 'div';
  const Controls = slots?.controls ?? 'div';
  const Status = slots?.status ?? 'span';
  const Error = slots?.error ?? 'div';
  const metadata = (
    <div css={metadataStyle}>
      <Title {...slotProps?.title} css={[titleStyle, slotProps?.title?.css]}>
        {track?.title ?? labels.empty}
      </Title>
      {track && (
        <Artist {...slotProps?.artist} css={[artistStyle, slotProps?.artist?.css]}>
          {track.artist}
        </Artist>
      )}
    </div>
  );
  const playButton = (
    <Button disabled={!track} loading={busy} onClick={() => requestPlaying(!isPlaying)}>
      {isPlaying ? labels.pause : labels.play}
    </Button>
  );
  const artwork = (mini: boolean) =>
    track && (
      <motion.div
        css={mini && miniArtworkStyle}
        layoutId={`${id}-artwork`}
        data-ui="now-playing-artwork"
        layout={!reduced}
        drag={!mini && !reduced ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onPointerDownCapture={() => {
          dragCancelled.current = false;
        }}
        onPointerCancel={() => {
          dragCancelled.current = true;
        }}
        onDragEnd={(_, info) => {
          if (
            !dragCancelled.current &&
            (info.offset.y > COLLAPSE_DISTANCE ||
              (info.offset.y > 0 && info.velocity.y > COLLAPSE_VELOCITY))
          )
            close();
        }}
        transition={reduced ? { duration: 0 } : SHELL_SPRING}
      >
        <motion.div
          key={track.id}
          initial={reduced ? false : { x: direction * ARTWORK_TRAVEL, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <Artwork key={track.artwork} track={track} slot={slotProps?.artwork} component={slots?.artwork} />
        </motion.div>
      </motion.div>
    );
  return (
    <MotionConfig reducedMotion="user">
      <PlayingContext.Provider value={isPlaying && !busy && !!track}>
        <WithSx className={className} styles={rootStyle} sx={sx}>
          {(rootClass) => (
            <section
              {...rest}
              ref={ref}
              data-ui="now-playing"
              className={rootClass}
              aria-label={ariaLabel ?? (!ariaLabelledBy ? label : undefined)}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={joinIds(ariaDescribedBy, errorVisible && `${id}-error`)}
              aria-busy={busy || undefined}
              onKeyDown={(e) => {
                onKeyDown?.(e);
                if (
                  !e.defaultPrevented &&
                  e.key === 'Escape' &&
                  isOpen &&
                  full.current?.contains(e.target as Node)
                ) {
                  e.preventDefault();
                  close();
                }
              }}
            >
              <motion.div layout={!reduced} transition={reduced ? { duration: 0 } : SHELL_SPRING}>
                <Card css={surfaceStyle}>
                  <Mini {...slotProps?.mini} css={[miniStyle, slotProps?.mini?.css]} hidden={isOpen}>
                    {!isOpen && artwork(true)}
                    {!isOpen && metadata}
                    <NowPlayingLevels />
                    {playButton}
                    <Button disabled={!track || busy} onClick={() => skip(1)}>
                      {labels.next}
                    </Button>
                    <Expand
                      {...slotProps?.expand}
                      ref={expandRef}
                      aria-expanded={isOpen}
                      aria-controls={id}
                      onClick={(e) => {
                        slotProps?.expand?.onClick?.(e);
                        if (!e.defaultPrevented) {
                          keyboardOpen.current = e.detail === 0;
                          requestOpen(true);
                        }
                      }}
                    >
                      {labels.expand}
                    </Expand>
                  </Mini>
                  <Full
                    {...slotProps?.full}
                    ref={fullRef}
                    id={id}
                    hidden={!isOpen}
                    inert={!isOpen}
                    css={[fullStyle, slotProps?.full?.css]}
                    onFocusCapture={(e) => {
                      focusInFull.current = true;
                      slotProps?.full?.onFocusCapture?.(e);
                    }}
                    onBlurCapture={(e) => {
                      if (
                        !e.currentTarget.hidden &&
                        !e.currentTarget.contains(e.relatedTarget as Node | null)
                      )
                        focusInFull.current = false;
                      slotProps?.full?.onBlurCapture?.(e);
                    }}
                  >
                    <Collapse
                      {...slotProps?.collapse}
                      ref={collapseRef}
                      aria-expanded={isOpen}
                      aria-controls={id}
                      onClick={(e) => {
                        slotProps?.collapse?.onClick?.(e);
                        if (!e.defaultPrevented) close();
                      }}
                    >
                      {labels.collapse}
                    </Collapse>
                    {isOpen && artwork(false)}
                    {isOpen && metadata}
                    <Waveform
                      {...slotProps?.waveform}
                      data-ui="now-playing-waveform"
                      aria-hidden="true"
                      css={[waveformStyle, slotProps?.waveform?.css]}
                    >
                      {(waveform?.length ? waveform : FALLBACK_WAVEFORM).map((level, i) => (
                        <span
                          key={i}
                          css={barStyle}
                          style={{
                            blockSize: `${Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0)) * 100}%`,
                          }}
                        />
                      ))}
                    </Waveform>
                    <Seek
                      {...slotProps?.seek}
                      dir="ltr"
                      label={
                        slotProps?.seek?.['aria-label'] || slotProps?.seek?.['aria-labelledby']
                          ? null
                          : labels.seek
                      }
                      min={0}
                      max={duration ?? 1}
                      step={duration === null ? 1 : seekLattice(duration, seekStep)}
                      largeStep={seekLargeStep}
                      value={duration === null ? 0 : bounded}
                      disabled={busy || duration === null || slotProps?.seek?.disabled}
                      showValue={false}
                      locale={locale}
                      formatValue={(n) =>
                        duration === null
                          ? labels.unavailable
                          : labels.position(
                              formatDuration(n, locale),
                              formatDuration(duration, locale),
                            )
                      }
                      onValueChange={(n) => {
                        if (!busy && duration !== null && Number.isFinite(n) && n !== bounded)
                          requestPosition(Math.max(0, Math.min(duration, n)));
                      }}
                    />
                    <div css={timesStyle}>
                      <output aria-live="off">{formatDuration(bounded, locale)}</output>
                      <output aria-live="off">
                        {duration === null
                          ? labels.unavailable
                          : formatDuration(duration - bounded, locale)}
                      </output>
                    </div>
                    <Controls {...slotProps?.controls} css={[controlsStyle, slotProps?.controls?.css]}>
                      <Button disabled={!track || busy} onClick={() => skip(-1)}>
                        {labels.previous}
                      </Button>
                      {playButton}
                      <Button disabled={!track || busy} onClick={() => skip(1)}>
                        {labels.next}
                      </Button>
                    </Controls>
                    <NowPlayingLevels />
                  </Full>
                  {busy && <Progress label={labels.busy} />}
                  <Status
                    {...slotProps?.status}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    css={[visuallyHiddenStyle, slotProps?.status?.css]}
                  >
                    {track
                      ? `${track.title} — ${isPlaying ? labels.playing : labels.paused}`
                      : labels.empty}
                  </Status>
                  {errorVisible && (
                    <Error
                      {...slotProps?.error}
                      id={`${id}-error`}
                      role="alert"
                      css={[errorStyle, slotProps?.error?.css]}
                    >
                      {error}
                    </Error>
                  )}
                </Card>
              </motion.div>
            </section>
          )}
        </WithSx>
      </PlayingContext.Provider>
    </MotionConfig>
  );
}
NowPlayingRoot.displayName = 'NowPlaying';
export const NowPlaying = Object.assign(NowPlayingRoot, { Levels: NowPlayingLevels });
