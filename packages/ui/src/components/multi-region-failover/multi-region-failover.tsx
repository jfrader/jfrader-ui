'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { focusRingOutset } from '../../styling/focus-ring';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import {
  FieldSlot,
  type FieldSlots,
  type FieldParts,
} from '../field/field-slot';
import { Button } from '../button';

const STAGE_IDS = [
  'balanced',
  'degraded',
  'failover',
  'rerouted',
  'recovery',
  'rebalanced',
] as const;
const REGIONS = ['primary', 'secondary'] as const;
const ACTORS = ['users', 'balancer', ...REGIONS] as const;
const INSTANCE_COUNT = 6;
const PARTICLE_COUNT = 12;
const ROUTE_DURATION_MS = 1800;
const COMPACT_BREAKPOINT = 640;
const GEOMETRY = {
  landscape: {
    users: [30, 60],
    balancer: [100, 60],
    primary: [170, 25],
    secondary: [170, 95],
    route: 'M30 60H100L170 25M100 60L170 95',
  },
  portrait: {
    users: [100, 15],
    balancer: [100, 55],
    primary: [50, 100],
    secondary: [150, 100],
    route: 'M100 15V55L50 100M100 55L150 100',
  },
} as const;
function particlePosition(
  progress: number,
  portrait: boolean,
  primary: boolean,
) {
  const geometry = GEOMETRY[portrait ? 'portrait' : 'landscape'];
  const firstLeg = progress < 0.4;
  const fraction = firstLeg ? progress / 0.4 : (progress - 0.4) / 0.6;
  const start = firstLeg ? geometry.users : geometry.balancer;
  const end = firstLeg
    ? geometry.balancer
    : geometry[primary ? 'primary' : 'secondary'];
  return `translate(${start[0] + (end[0] - start[0]) * fraction} ${start[1] + (end[1] - start[1]) * fraction})`;
}
export type FailoverStageId = (typeof STAGE_IDS)[number];
export interface RegionSnapshot {
  weight: number;
  requestsPerSecond: number;
  latencyMs: number;
  errorRate: number;
  healthyInstances: number;
  failedChecks: number;
  passedChecks: number;
  statusLabel: string;
}
export interface FailoverStage {
  id: FailoverStageId;
  title: string;
  description: ReactNode;
  durationMs: number;
  primary: RegionSnapshot;
  secondary: RegionSnapshot;
}
export interface FailoverNode {
  label: string;
  meta?: string;
  detail?: string;
  icon?: ReactNode;
}
export interface FailoverControlLabels {
  group: string;
  pause: string;
  resume: string;
  previous: string;
  next: string;
  replay: string;
}
export interface FailoverMetricLabels {
  requestsPerSecond: string;
  latency: string;
  errorRate: string;
  weight: string;
  failedChecks: string;
  passedChecks: string;
}
type Anatomy = {
  /** Renders a `figure` by default. */
  root: 'figure';
  scene: 'div';
  node: 'div';
  summary: 'ol';
  controls: 'div';
  stageButton: 'button';
  /** Renders a `figcaption` by default. */
  caption: 'figcaption';
  previous: 'button';
  next: 'button';
  pause: 'button';
  replay: 'button';
};
export type MultiRegionFailoverSlots = FieldSlots<Anatomy>;
export type MultiRegionFailoverSlotProps = FieldParts<Anatomy>;
export interface MultiRegionFailoverProps
  extends Omit<ComponentPropsWithRef<'figure'>, 'children'>, SxProps {
  /** Supplies labels and artwork for users, the balancer and both regions. */
  nodes: Record<(typeof ACTORS)[number], FailoverNode>;
  /** Displays the service hostname in the scene. */
  hostname: string;
  /** Supplies all six stages in order: `balanced`, `degraded`, `failover`, `rerouted`, `recovery`, `rebalanced`. */
  stages: readonly FailoverStage[];
  /** Controls the displayed failover stage. */
  value?: FailoverStageId;
  /** Sets the initial stage. Defaults to `balanced`. */
  defaultValue?: FailoverStageId;
  /** Requests a stage change from playback or navigation. */
  onValueChange?: (value: FailoverStageId) => void;
  /** Controls whether automatic stage playback is paused. */
  paused?: boolean;
  /** Starts automatic playback paused. Defaults to `false`. */
  defaultPaused?: boolean;
  /** Requests a playback pause or resume. */
  onPausedChange?: (paused: boolean) => void;
  /** Multiplies playback speed from 0 to 3. Defaults to 1; 0 stops automatic advancement. */
  speed?: number;
  /** Restarts after the final stage. Defaults to `false`. */
  loop?: boolean;
  /** Arranges the scene; `auto` switches to portrait below 640px. Defaults to `auto`. */
  orientation?: 'auto' | 'landscape' | 'portrait';
  /** Names the failover figure for assistive technology. */
  label: string;
  /** Adds content before the current stage's caption. */
  caption?: ReactNode;
  /** Displays the current stage title and description. Defaults to `true`. */
  showStageCaption?: boolean;
  /** Names playback controls and their group. */
  controlLabels: FailoverControlLabels;
  /** Names the displayed regional metrics. */
  metricLabels: FailoverMetricLabels;
  /** Selects number, percentage and latency formatting. */
  locale?: Intl.LocalesArgument;
  /** Replaces the scene when stages, snapshots, speed or the selected stage are invalid. */
  invalidContent: ReactNode;
  /** Replaces the figure root; `slots.root` takes precedence. */
  component?: MultiRegionFailoverSlots['root'];
  /** Replaces scene, caption and control elements. */
  slots?: MultiRegionFailoverSlots;
  /** Passes props and styles to the figure's parts. */
  slotProps?: MultiRegionFailoverSlotProps;
}
function validStages(stages: readonly FailoverStage[]) {
  return (
    stages.length === STAGE_IDS.length &&
    stages.every((stage, index) => {
      if (
        stage.id !== STAGE_IDS[index] ||
        !Number.isFinite(stage.durationMs) ||
        stage.durationMs <= 0
      )
        return false;
      if (
        !REGIONS.every((region) => {
          const snapshot = stage[region];
          return (
            snapshot &&
            [
              'weight',
              'requestsPerSecond',
              'latencyMs',
              'errorRate',
              'healthyInstances',
              'failedChecks',
              'passedChecks',
            ].every((key) => {
              const number = snapshot[key as keyof RegionSnapshot];
              return (
                typeof number === 'number' &&
                Number.isFinite(number) &&
                number >= 0
              );
            }) &&
            snapshot.weight <= 1 &&
            snapshot.errorRate <= 1 &&
            snapshot.healthyInstances <= INSTANCE_COUNT &&
            [
              snapshot.healthyInstances,
              snapshot.failedChecks,
              snapshot.passedChecks,
            ].every(Number.isInteger)
          );
        })
      )
        return false;
      return Math.abs(stage.primary.weight + stage.secondary.weight - 1) < 1e-9;
    })
  );
}
const rootStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '100%',
  minInlineSize: 0,
  boxSizing: 'border-box',
  margin: 0,
  padding: vars.space[4],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
});
const sceneStyle = css({
  display: 'grid',
  gap: vars.space[4],
  containerType: 'inline-size',
  minInlineSize: 0,
  backgroundColor: vars.color.surfaceInset,
  borderRadius: vars.radius.md,
  padding: vars.space[3],
});
const hostnameStyle = css({
  fontFamily: vars.font.mono,
  overflowWrap: 'anywhere',
});
const drawingStyle = css({
  inlineSize: '100%',
  blockSize: 'auto',
  maxBlockSize: '15rem',
  color: vars.color.borderControl,
  ':dir(rtl)': { transform: 'scaleX(-1)' },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const routeStyle = css({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  vectorEffect: 'non-scaling-stroke',
});
const particleStyle = css({
  fill: `var(--multi-region-failover-accent, ${vars.color.accent})`,
  [FORCED_COLORS]: { fill: 'Highlight' },
});
const cardsStyle = css({
  display: 'grid',
  gap: vars.space[3],
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gridTemplateAreas: '"users balancer primary secondary"',
  '&[data-portrait="true"]': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridTemplateAreas: '"users users" "balancer balancer" "primary secondary"',
  },
});
const nodeStyle = css({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  padding: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  '&[data-failed="true"]': { borderStyle: 'dashed' },
});
const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  alignItems: 'center',
});
const mutedStyle = css({ color: vars.color.textMuted });
const instancesStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[1],
});
const instanceStyle = css({
  inlineSize: vars.space[2],
  blockSize: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.accent,
  '&[data-healthy="false"]': {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const summaryStyle = css({
  display: 'grid',
  gap: vars.space[3],
  paddingInlineStart: vars.space[6],
  margin: 0,
});
const stageStyle = css({
  padding: vars.space[2],
  borderInlineStart: '2px solid transparent',
  '&[data-current="true"]': {
    borderInlineStartColor: vars.color.borderControl,
    backgroundColor: vars.color.surfaceRaised,
  },
});
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  alignItems: 'center',
});
const buttonStyle = css({
  minBlockSize: vars.space[8],
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  font: 'inherit',
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
  '&[aria-current="step"]': {
    backgroundColor: vars.color.accent,
    color: vars.color.accentContrast,
    textDecoration: 'underline',
  },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
  [REDUCED_MOTION]: { transition: 'none' },
});
const barStyle = css({
  display: 'flex',
  blockSize: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  overflow: 'hidden',
  backgroundColor: vars.color.surfaceRaised,
});
const fillStyle = css({
  backgroundColor: vars.color.accent,
  borderInlineEnd: `1px solid ${vars.color.borderControl}`,
  [FORCED_COLORS]: { backgroundColor: 'Highlight' },
});
const captionStyle = css({
  display: 'grid',
  gap: vars.space[2],
  color: vars.color.textMuted,
});

/** Visualize traffic moving between regions through failover and recovery. */
export function MultiRegionFailover({
  nodes,
  hostname,
  stages,
  value,
  defaultValue = 'balanced',
  onValueChange,
  paused,
  defaultPaused = false,
  onPausedChange,
  speed = 1,
  loop = false,
  orientation = 'auto',
  label,
  caption,
  showStageCaption = true,
  controlLabels,
  metricLabels,
  locale,
  invalidContent,
  slots,
  slotProps,
  component,
  className,
  sx,
  ref,
  ...rest
}: MultiRegionFailoverProps) {
  const rootRef = useRef<HTMLElement>(null);
  const mergedRef = useMergeRefs([ref, rootRef]);
  const summaryId = useId();
  const captionId = useId();
  const [selected = 'balanced', requestStage] = useControlledState(
    value,
    defaultValue,
    onValueChange,
  );
  const [isPaused = false, requestPause] = useControlledState(
    paused,
    defaultPaused,
    onPausedChange,
  );
  const reduced = useReducedMotion();
  const [compact, setCompact] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const particles = useRef<(SVGCircleElement | null)[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const elapsed = useRef(0);
  const boundarySent = useRef(false);
  const lastStage = useRef(selected);
  const valid =
    validStages(stages) &&
    Number.isFinite(speed) &&
    speed >= 0 &&
    speed <= 3 &&
    stages.some((stage) => stage.id === selected);
  const index = stages.findIndex((stage) => stage.id === selected);
  const current = stages[index];
  const portrait =
    orientation === 'portrait' || (orientation === 'auto' && compact);
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const latency = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'millisecond',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  });
  const hasCaption = isRenderable(caption) || showStageCaption;
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const doc = element.ownerDocument;
    const visibility = () => setPageVisible(doc.visibilityState !== 'hidden');
    visibility();
    doc.addEventListener('visibilitychange', visibility);
    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) =>
            setVisible(entry?.isIntersecting ?? false),
          );
    intersection?.observe(element);
    if (!intersection) setVisible(true);
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(([entry]) =>
            setCompact(
              (entry?.contentRect.width ?? COMPACT_BREAKPOINT) <
                COMPACT_BREAKPOINT,
            ),
          );
    resize?.observe(element);
    return () => {
      doc.removeEventListener('visibilitychange', visibility);
      intersection?.disconnect();
      resize?.disconnect();
    };
  }, []);
  useEffect(() => {
    if (lastStage.current !== selected) {
      elapsed.current = 0;
      boundarySent.current = false;
      lastStage.current = selected;
    }
    if (
      !valid ||
      !current ||
      isPaused ||
      reduced ||
      speed === 0 ||
      !visible ||
      !pageVisible ||
      boundarySent.current
    )
      return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined) elapsed.current += (now - previous) * speed;
      previous = now;
      for (let particle = 0; particle < PARTICLE_COUNT; particle++) {
        const progress =
          (elapsed.current / ROUTE_DURATION_MS + particle / PARTICLE_COUNT) % 1;
        const sample =
          ((particle * 7 +
            Math.floor(
              elapsed.current / ROUTE_DURATION_MS + particle / PARTICLE_COUNT,
            ) *
              11) %
            97) /
          97;
        const primary = sample < current.primary.weight;
        particles.current[particle]?.setAttribute(
          'transform',
          particlePosition(progress, portrait, primary),
        );
      }
      if (elapsed.current >= current.durationMs) {
        boundarySent.current = true;
        const next = stages[index + 1] ?? (loop ? stages[0] : undefined);
        if (next) requestStage(next.id);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    selected,
    current,
    valid,
    isPaused,
    reduced,
    speed,
    visible,
    pageVisible,
    index,
    // stages is read through refs/closures keyed by index; the raw array identity must not restart the loop.
    stages.length,
    loop,
    replayKey,
    requestStage,
    portrait,
  ]);
  function seek(target: FailoverStageId) {
    if (!isPaused) {
      requestPause(true);
      if (paused !== undefined) return;
    }
    requestStage(target);
  }
  function replay() {
    if (selected === STAGE_IDS[0]) {
      elapsed.current = 0;
      boundarySent.current = false;
      setReplayKey((key) => key + 1);
    } else requestStage(STAGE_IDS[0]);
  }
  function metrics(snapshot: RegionSnapshot) {
    return [
      [metricLabels.weight, percent.format(snapshot.weight)],
      [
        metricLabels.requestsPerSecond,
        number.format(snapshot.requestsPerSecond),
      ],
      [metricLabels.latency, latency.format(snapshot.latencyMs)],
      [metricLabels.errorRate, percent.format(snapshot.errorRate)],
      [metricLabels.passedChecks, number.format(snapshot.passedChecks)],
      [metricLabels.failedChecks, number.format(snapshot.failedChecks)],
    ];
  }
  function regionSummary(
    stage: FailoverStage,
    region: (typeof REGIONS)[number],
  ) {
    return (
      <span>
        {nodes[region].label}: {stage[region].statusLabel}.{' '}
        {metrics(stage[region])
          .map(([name, text]) => `${name}: ${text}`)
          .join(' · ')}
      </span>
    );
  }
  return (
    <FieldSlot
      element="figure"
      root
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      {...rest}
      ref={mergedRef}
      className={className}
      styles={rootStyle}
      sx={sx}
      data-ui="multi-region-failover"
      aria-label={label}
      aria-describedby={
        valid
          ? [rest['aria-describedby'], summaryId, hasCaption && captionId]
              .filter(Boolean)
              .join(' ')
          : rest['aria-describedby']
      }
    >
      {!valid || !current ? (
        invalidContent
      ) : (
        <>
          <FieldSlot
            element="div"
            component={slots?.scene}
            slotProps={slotProps?.scene}
            data-ui="multi-region-failover-scene"
            aria-hidden="true"
            styles={sceneStyle}
          >
            <span css={hostnameStyle}>{hostname}</span>
            <svg viewBox="0 0 200 120" css={drawingStyle} aria-hidden="true">
              <path
                d={GEOMETRY[portrait ? 'portrait' : 'landscape'].route}
                css={routeStyle}
              />
              {ACTORS.map((actor) => {
                const [x, y] =
                  GEOMETRY[portrait ? 'portrait' : 'landscape'][actor];
                return (
                  <rect
                    key={actor}
                    x={x - 10}
                    y={y - 10}
                    width={20}
                    height={20}
                    rx={3}
                    fill={vars.color.surfaceRaised}
                    stroke={vars.color.borderControl}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {Array.from({ length: PARTICLE_COUNT }, (_, particle) => (
                <circle
                  key={particle}
                  ref={(element) => {
                    particles.current[particle] = element;
                  }}
                  r={2}
                  transform={particlePosition(
                    particle / PARTICLE_COUNT,
                    portrait,
                    particle / PARTICLE_COUNT < current.primary.weight,
                  )}
                  css={particleStyle}
                />
              ))}
            </svg>
            <div css={barStyle}>
              <span
                css={fillStyle}
                style={{ inlineSize: `${current.primary.weight * 100}%` }}
              />
            </div>
            <div css={rowStyle}>
              <span>
                {nodes.primary.label}: {percent.format(current.primary.weight)}
              </span>
              <span>
                {nodes.secondary.label}:{' '}
                {percent.format(current.secondary.weight)}
              </span>
            </div>
            <div css={cardsStyle} data-portrait={portrait}>
              {ACTORS.map((actor) => {
                const snapshot =
                  actor === 'primary' || actor === 'secondary'
                    ? current[actor]
                    : undefined;
                return (
                  <FieldSlot
                    key={actor}
                    element="div"
                    component={slots?.node}
                    slotProps={slotProps?.node}
                    styles={nodeStyle}
                    style={{ gridArea: actor }}
                    data-failed={snapshot?.healthyInstances === 0}
                  >
                    <strong css={rowStyle}>
                      {nodes[actor].icon}
                      {nodes[actor].label}
                    </strong>
                    {nodes[actor].meta && (
                      <span css={mutedStyle}>{nodes[actor].meta}</span>
                    )}
                    {nodes[actor].detail && (
                      <span css={mutedStyle}>{nodes[actor].detail}</span>
                    )}
                    {snapshot && (
                      <>
                        <span>{snapshot.statusLabel}</span>
                        <div css={instancesStyle}>
                          {Array.from(
                            { length: INSTANCE_COUNT },
                            (_, instance) => (
                              <span
                                key={instance}
                                css={instanceStyle}
                                data-healthy={
                                  instance < snapshot.healthyInstances
                                }
                              />
                            ),
                          )}
                        </div>
                        {metrics(snapshot).map(([name, text], metric) => (
                          <span key={metric}>
                            {name}: {text}
                          </span>
                        ))}
                      </>
                    )}
                  </FieldSlot>
                );
              })}
            </div>
          </FieldSlot>
          <FieldSlot
            element="ol"
            component={slots?.summary}
            slotProps={slotProps?.summary}
            styles={summaryStyle}
            id={summaryId}
            data-ui="multi-region-failover-summary"
          >
            {stages.map((stage) => (
              <li
                key={stage.id}
                css={stageStyle}
                data-current={stage.id === selected}
              >
                <strong>{stage.title}</strong>
                <div>{stage.description}</div>
                <div>{regionSummary(stage, 'primary')}</div>
                <div>{regionSummary(stage, 'secondary')}</div>
              </li>
            ))}
          </FieldSlot>
          <FieldSlot
            element="div"
            component={slots?.controls}
            slotProps={slotProps?.controls}
            styles={controlsStyle}
            role="group"
            aria-label={controlLabels.group}
            data-ui="multi-region-failover-controls"
          >
            <FieldSlot
              element="button"
              component={slots?.pause ?? Button}
              slotProps={slotProps?.pause}
              styles={buttonStyle}
              type="button"
              behavior={{
                onClick: (event) => {
                  if (!event.defaultPrevented) requestPause(!isPaused);
                },
              }}
            >
              {isPaused ? controlLabels.resume : controlLabels.pause}
            </FieldSlot>
            <FieldSlot
              element="button"
              component={slots?.previous ?? Button}
              slotProps={slotProps?.previous}
              styles={buttonStyle}
              type="button"
              disabled={index === 0}
              behavior={{
                onClick: (event) => {
                  if (!event.defaultPrevented && index > 0)
                    seek(stages[index - 1]!.id);
                },
              }}
            >
              {controlLabels.previous}
            </FieldSlot>
            <FieldSlot
              element="button"
              component={slots?.next ?? Button}
              slotProps={slotProps?.next}
              styles={buttonStyle}
              type="button"
              disabled={index === stages.length - 1}
              behavior={{
                onClick: (event) => {
                  if (!event.defaultPrevented && index < stages.length - 1)
                    seek(stages[index + 1]!.id);
                },
              }}
            >
              {controlLabels.next}
            </FieldSlot>
            <FieldSlot
              element="button"
              component={slots?.replay ?? Button}
              slotProps={slotProps?.replay}
              styles={buttonStyle}
              type="button"
              behavior={{
                onClick: (event) => {
                  if (!event.defaultPrevented) replay();
                },
              }}
            >
              {controlLabels.replay}
            </FieldSlot>
            {stages.map((stage, stageIndex) => (
              <FieldSlot
                key={stage.id}
                element="button"
                component={slots?.stageButton ?? Button}
                slotProps={slotProps?.stageButton}
                styles={buttonStyle}
                type="button"
                ref={(element) => {
                  buttons.current[stageIndex] = element;
                }}
                aria-current={stage.id === selected ? 'step' : undefined}
                behavior={{
                  onClick: (event) => {
                    if (!event.defaultPrevented) seek(stage.id);
                  },
                  onKeyDown: (event) => {
                    if (event.defaultPrevented) return;
                    const rtl =
                      getComputedStyle(event.currentTarget).direction === 'rtl';
                    const targets: Record<string, number> = {
                      Home: 0,
                      End: stages.length - 1,
                      ArrowRight: stageIndex + (rtl ? -1 : 1),
                      ArrowLeft: stageIndex + (rtl ? 1 : -1),
                    };
                    const target = targets[event.key];
                    if (target === undefined) return;
                    event.preventDefault();
                    buttons.current[
                      Math.max(0, Math.min(stages.length - 1, target))
                    ]?.focus();
                  },
                }}
              >
                {stage.title}
              </FieldSlot>
            ))}
          </FieldSlot>
          {hasCaption && (
            <FieldSlot
              element="figcaption"
              component={slots?.caption}
              slotProps={slotProps?.caption}
              id={captionId}
              styles={captionStyle}
            >
              {caption}
              {showStageCaption && (
                <>
                  <strong>{current.title}</strong>
                  <div>{current.description}</div>
                </>
              )}
            </FieldSlot>
          )}
        </>
      )}
    </FieldSlot>
  );
}
MultiRegionFailover.displayName = 'MultiRegionFailover';
