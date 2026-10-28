'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { focusRingOutset } from '../../styling/focus-ring';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import {
  FieldSlot,
  type FieldElementProps,
} from '../field/field-slot';
import { Button } from '../button';
import {
  createHorizontalPath,
  isEmissionEligible,
  samplePath,
  type PathSampleTable,
  type Point,
} from './data-flow-geometry';
import { flowNodeDetailStyle, flowNodeHeaderStyle, flowNodeIconStyle, flowNodeStyle } from './flow-node';

export interface DataFlowNode {
  /** Unique stable identifier for the node. */
  id: string;
  /** Primary label of the node. */
  label: string;
  /** Optional secondary metadata string. */
  meta?: string;
  /** Optional detailed description string. */
  detail?: string;
  /** Optional custom icon element. */
  icon?: ReactNode;
}

export interface DataFlowDestinationNode extends DataFlowNode {
  /**
   * Routing share illustration between 0 and 1.
   * Defaults to 1 (every emission routed).
   */
  share?: number;
}

export interface DataFlowCore {
  /** Unique stable identifier for the core. */
  id: string;
  /** Primary label of the core. */
  label: string;
  /** Optional detail description string. */
  detail?: string;
  /** Starting count for illustrative pipeline counter. Defaults to 0. */
  countStart?: number;
  /** Label for the illustrative count, not a measured rate. */
  countLabel: string;
  /** Optional custom icon element. */
  icon?: ReactNode;
}

export interface DataFlowSummaryStep {
  /** Unique identifier for the summary step. */
  id: string;
  /** Readable narrative content explaining this stage or routing. */
  content: ReactNode;
}

export interface DataFlowControlLabels {
  /** Label for pause button when playback is active. */
  pause: string;
  /** Label for resume button when playback is paused. */
  resume: string;
  /** Label for step button to advance snapshots. */
  step: string;
  /** Label for replay button to reset cycle and count. */
  replay: string;
  /** Accessible group name for the controls container. */
  group: string;
}

export type DataFlowOrientation = 'auto' | 'horizontal' | 'vertical';

export type DataFlowSlots = {
  root?: ComponentType<ComponentPropsWithRef<'figure'>>;
  scene?: ComponentType<ComponentPropsWithRef<'div'>>;
  node?: ComponentType<ComponentPropsWithRef<'div'>>;
  summary?: ComponentType<ComponentPropsWithRef<'ol'>>;
  controls?: ComponentType<ComponentPropsWithRef<'div'>>;
  caption?: ComponentType<ComponentPropsWithRef<'figcaption'>>;
  pauseButton?: ComponentType<ComponentPropsWithRef<'button'>>;
  stepButton?: ComponentType<ComponentPropsWithRef<'button'>>;
  replayButton?: ComponentType<ComponentPropsWithRef<'button'>>;
};

export type DataFlowSlotProps = {
  root?: FieldElementProps<'figure'>;
  scene?: FieldElementProps<'div'>;
  node?: FieldElementProps<'div'>;
  summary?: FieldElementProps<'ol'>;
  controls?: FieldElementProps<'div'>;
  caption?: FieldElementProps<'figcaption'>;
  pauseButton?: FieldElementProps<'button'>;
  stepButton?: FieldElementProps<'button'>;
  replayButton?: FieldElementProps<'button'>;
};

export interface DataFlowProps
  extends Omit<ComponentPropsWithRef<'figure'>, 'children'>,
    SxProps {
  /** 1 to 8 source nodes supplying data to the core. */
  sources: readonly DataFlowNode[];
  /** 1 to 8 destination nodes receiving processed data from the core. */
  destinations: readonly DataFlowDestinationNode[];
  /** Central processing core node. */
  core: DataFlowCore;
  /** Ordered list of 3 or more narrative steps describing the pipeline. */
  summary: readonly DataFlowSummaryStep[];
  /** Accessible name for the diagram figure. */
  label: string;
  /** Optional visible caption below the diagram. */
  caption?: ReactNode;
  /** Layout orientation: 'auto' stacks under 600px container width. Defaults to 'auto'. */
  orientation?: DataFlowOrientation;
  /** Playback speed factor (0 to 3). Defaults to 1. */
  speed?: number;
  /** Controlled paused state. */
  paused?: boolean;
  /** Initial paused state when uncontrolled. Defaults to false. */
  defaultPaused?: boolean;
  /** Callback fired when pause state is requested by user interaction. */
  onPausedChange?: (paused: boolean) => void;
  /** Localized copy for playback transport controls. */
  controlLabels: DataFlowControlLabels;
  /** Optional locale for formatting counter and percentage numbers. */
  locale?: Intl.LocalesArgument;
  /** Content rendered when source or destination arrays are empty. */
  emptyContent: ReactNode;
  /** Content rendered when props fail structural or numerical validation. */
  invalidContent: ReactNode;
  /** Component replacement for the root figure element. */
  component?: DataFlowSlots['root'];
  /** Structural replacement components for individual parts. */
  slots?: DataFlowSlots;
  /** Styling and native property overrides for individual parts. */
  slotProps?: DataFlowSlotProps;
}

const CYCLE_DURATION_MS = 6600;
const EMISSION_INTERVAL_MS = CYCLE_DURATION_MS / 6;
const INGEST_DURATION_MS = 1200;
const TRANSFORM_DURATION_MS = 300;
const ROUTE_DURATION_MS = 1200;
const TOTAL_FLIGHT_MS = INGEST_DURATION_MS + TRANSFORM_DURATION_MS + ROUTE_DURATION_MS; // 2700ms
const MAX_SOURCES = 8;
const MAX_DESTINATIONS = 8;
const NARROW_BREAKPOINT = 600;

type SnapshotStage = 'ingest' | 'transform' | 'route';

interface NodeGeometry {
  sourcePoints: Point[];
  coreInputPoint: Point;
  coreOutputPoint: Point;
  destPoints: Point[];
  sourcePaths: PathSampleTable[];
  destPaths: PathSampleTable[];
}

function validateProps(props: DataFlowProps): { isValid: boolean; isEmpty: boolean } {
  const { sources, destinations, core, summary, label, speed = 1, controlLabels } = props;

  if (!Array.isArray(sources) || !Array.isArray(destinations)) {
    return { isValid: false, isEmpty: false };
  }

  if (sources.length === 0 || destinations.length === 0) {
    if (!summary || summary.length < 3 || !label || typeof label !== 'string' || !label.trim()) {
      return { isValid: false, isEmpty: false };
    }
    return { isValid: true, isEmpty: true };
  }

  if (sources.length > MAX_SOURCES || destinations.length > MAX_DESTINATIONS) {
    return { isValid: false, isEmpty: false };
  }

  if (typeof label !== 'string' || !label.trim()) {
    return { isValid: false, isEmpty: false };
  }

  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0 || speed > 3) {
    return { isValid: false, isEmpty: false };
  }

  if (
    !core ||
    typeof core.id !== 'string' ||
    !core.id.trim() ||
    typeof core.label !== 'string' ||
    typeof core.countLabel !== 'string'
  ) {
    return { isValid: false, isEmpty: false };
  }

  if (
    core.countStart !== undefined &&
    (typeof core.countStart !== 'number' ||
      !Number.isInteger(core.countStart) ||
      core.countStart < 0 ||
      !Number.isFinite(core.countStart))
  ) {
    return { isValid: false, isEmpty: false };
  }

  if (!controlLabels || typeof controlLabels !== 'object') {
    return { isValid: false, isEmpty: false };
  }
  for (const key of ['pause', 'resume', 'step', 'replay', 'group'] as const) {
    if (typeof controlLabels[key] !== 'string' || !controlLabels[key].trim()) {
      return { isValid: false, isEmpty: false };
    }
  }

  if (!Array.isArray(summary) || summary.length < 3) {
    return { isValid: false, isEmpty: false };
  }
  const summaryIds = new Set<string>();
  for (const step of summary) {
    if (!step || typeof step.id !== 'string' || !step.id.trim() || !isRenderable(step.content)) {
      return { isValid: false, isEmpty: false };
    }
    if (summaryIds.has(step.id)) return { isValid: false, isEmpty: false };
    summaryIds.add(step.id);
  }

  const allNodeIds = new Set<string>();
  allNodeIds.add(core.id);

  for (const source of sources) {
    if (!source || typeof source.id !== 'string' || !source.id.trim() || typeof source.label !== 'string') {
      return { isValid: false, isEmpty: false };
    }
    if (allNodeIds.has(source.id)) return { isValid: false, isEmpty: false };
    allNodeIds.add(source.id);
  }

  for (const dest of destinations) {
    if (!dest || typeof dest.id !== 'string' || !dest.id.trim() || typeof dest.label !== 'string') {
      return { isValid: false, isEmpty: false };
    }
    if (allNodeIds.has(dest.id)) return { isValid: false, isEmpty: false };
    allNodeIds.add(dest.id);

    if (dest.share !== undefined) {
      if (typeof dest.share !== 'number' || !Number.isFinite(dest.share) || dest.share < 0 || dest.share > 1) {
        return { isValid: false, isEmpty: false };
      }
    }
  }

  return { isValid: true, isEmpty: false };
}

const rootStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '100%',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
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
  position: 'relative',
  display: 'grid',
  gap: vars.space[4],
  minInlineSize: 0,
  overflow: 'auto',
  backgroundColor: vars.color.surfaceInset,
  borderRadius: vars.radius.md,
  padding: vars.space[4],
});

const svgStyle = css({
  position: 'absolute',
  inset: 0,
  inlineSize: '100%',
  blockSize: '100%',
  pointerEvents: 'none',
  overflow: 'visible',
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
  },
});

const routePathStyle = css({
  fill: 'none',
  stroke: vars.color.borderControl,
  strokeWidth: 2,
  vectorEffect: 'non-scaling-stroke',
  [FORCED_COLORS]: {
    stroke: 'CanvasText',
  },
});

const inputParticleStyle = css({
  color: `var(--data-flow-accent, ${vars.color.accent})`,
  [FORCED_COLORS]: {
    color: 'Highlight',
  },
});

const outputParticleStyle = css({
  color: `var(--data-flow-accent, ${vars.color.accent})`,
  [FORCED_COLORS]: {
    color: 'Highlight',
  },
});

const layoutStyle = css({
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: vars.space[6],
  minInlineSize: 0,
  '&[data-orientation="horizontal"]': {
    minInlineSize: NARROW_BREAKPOINT,
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    alignItems: 'center',
  },
  '&[data-orientation="vertical"]': {
    gridTemplateRows: 'auto auto auto',
    '& [data-ui="data-flow-node"]': {
      inlineSize: '100%',
      boxSizing: 'border-box',
    },
  },
});

const nodeGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
  justifyContent: 'center',
  minInlineSize: 0,
});

const coreContainerStyle = css({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minInlineSize: 0,
});

const nodeStyle = css(flowNodeStyle, {
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  zIndex: 1,
  transition: `border-color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '&:hover': {
    borderColor: `var(--data-flow-accent, ${vars.color.accent})`,
  },
  [REDUCED_MOTION]: {
    transition: 'none',
  },
});

// Labels wrap here, so nodes and their headers may shrink below their content.
const nodeHeaderStyle = css(flowNodeHeaderStyle, { minInlineSize: 0 });

const coreNodeStyle = css({
  display: 'grid',
  gap: vars.space[2],
  alignContent: 'center',
  justifyItems: 'center',
  textAlign: 'center',
  padding: vars.space[4],
  border: `1px solid var(--data-flow-accent, ${vars.color.accent})`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  position: 'relative',
  zIndex: 1,
  [FORCED_COLORS]: {
    borderColor: 'Highlight',
  },
});

const counterStyle = css({
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.sm,
  fontWeight: '500',
  color: `var(--data-flow-accent, ${vars.color.accent})`,
  [FORCED_COLORS]: {
    color: 'Highlight',
  },
});

const shareBadgeStyle = css({
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});

const summaryStyle = css({
  display: 'grid',
  gap: vars.space[2],
  margin: 0,
  paddingInlineStart: vars.space[6],
  color: vars.color.text,
  fontSize: vars.textSize.sm,
});

const stepStyle = css({
  color: vars.color.text,
});

const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  alignItems: 'center',
});

const buttonStyle = css({
  minBlockSize: vars.space[8],
  minInlineSize: 0,
  maxInlineSize: '100%',
  whiteSpace: 'normal',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  font: 'inherit',
  fontSize: vars.textSize.sm,
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
  [REDUCED_MOTION]: {
    transition: 'none',
  },
});

const captionStyle = css({
  display: 'block',
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.textSize.xs,
});

export function DataFlow({
  sources,
  destinations,
  core,
  summary,
  label,
  caption,
  orientation = 'auto',
  speed = 1,
  paused,
  defaultPaused = false,
  onPausedChange,
  controlLabels,
  locale,
  emptyContent,
  invalidContent,
  component,
  slots,
  slotProps,
  className,
  sx,
  ref,
  ...rest
}: DataFlowProps) {
  const rootRef = useRef<HTMLElement>(null);
  const mergedRef = useMergeRefs([ref, rootRef]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  const sourceNodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const destNodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coreNodeRef = useRef<HTMLDivElement>(null);

  const inputParticleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const outputParticleRefs = useRef<(SVGRectElement | null)[]>([]);

  const summaryId = useId();
  const captionId = useId();
  const labelId = useId();

  const [isPaused = false, requestPause] = useControlledState(
    paused,
    defaultPaused,
    onPausedChange,
  );
  const reduced = useReducedMotion();

  const [containerWidth, setContainerWidth] = useState(1000);
  const [pageVisible, setPageVisible] = useState(true);
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [geometry, setGeometry] = useState<NodeGeometry | null>(null);

  const [snapshot, setSnapshot] = useState<SnapshotStage>(reduced ? 'route' : 'ingest');
  const [isStepped, setIsStepped] = useState(reduced);

  const elapsed = useRef(0);
  const lastCount = useRef(core?.countStart ?? 0);
  const geometryRef = useRef<NodeGeometry | null>(null);

  const { isValid, isEmpty } = validateProps({
    sources,
    destinations,
    core,
    summary,
    label,
    caption,
    orientation,
    speed,
    controlLabels,
    locale,
    emptyContent,
    invalidContent,
  });

  const isVertical = orientation === 'vertical' || (orientation === 'auto' && containerWidth < NARROW_BREAKPOINT);
  const effectiveOrientation: 'horizontal' | 'vertical' = isVertical ? 'vertical' : 'horizontal';

  const formatNumber = useMemo(() => new Intl.NumberFormat(locale).format, [locale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }), [locale]);

  const hasCaption = isRenderable(caption);
  const consumerLabelledBy = rest['aria-labelledby'];
  const hasConsumerLabelledBy = Boolean(consumerLabelledBy?.trim() || slotProps?.root?.['aria-labelledby']?.trim());
  const mergedLabelledBy = hasConsumerLabelledBy ? [consumerLabelledBy, labelId].filter(Boolean).join(' ') : undefined;
  const resolvedAriaLabel = hasConsumerLabelledBy ? undefined : (rest['aria-label'] || label);

  // Recompute node attachment coordinates and cached cubic bezier sample tables
  const recomputeGeometry = () => {
    const sceneEl = sceneRef.current;
    const coreEl = coreNodeRef.current;
    if (!sceneEl || !coreEl) return;

    const sceneRect = sceneEl.getBoundingClientRect();
    const originLeft = sceneRect.left - sceneEl.scrollLeft;
    if (sceneRect.width === 0 || sceneRect.height === 0) {
      geometryRef.current = null;
      setGeometry(null);
      return;
    }

    const isRtl = getComputedStyle(sceneEl).direction === 'rtl';
    const cRect = coreEl.getBoundingClientRect();

    const coreIn: Point = {
      x: (isRtl ? cRect.right : cRect.left) - originLeft,
      y: cRect.top + cRect.height * 0.5 - sceneRect.top,
    };
    const coreOut: Point = {
      x: (isRtl ? cRect.left : cRect.right) - originLeft,
      y: coreIn.y,
    };

    const sourcePoints: Point[] = [];
    const sourcePaths: PathSampleTable[] = [];

    for (let i = 0; i < sources.length; i++) {
      const el = sourceNodeRefs.current[i];
      if (!el) continue;
      const sRect = el.getBoundingClientRect();
      let start: Point;
      if (effectiveOrientation === 'horizontal') {
        start = !isRtl
          ? { x: sRect.right - originLeft, y: sRect.top + sRect.height * 0.5 - sceneRect.top }
          : { x: sRect.left - originLeft, y: sRect.top + sRect.height * 0.5 - sceneRect.top };
        sourcePoints.push(start);
        sourcePaths.push(createHorizontalPath(start, coreIn));
      } else {
        start = { x: (isRtl ? sRect.right : sRect.left) - originLeft, y: sRect.top + sRect.height * 0.5 - sceneRect.top };
        sourcePoints.push(start);
        sourcePaths.push(createHorizontalPath(start, coreIn, (coreIn.x + (isRtl ? sceneRect.width : 0)) * 0.5));
      }
    }

    const destPoints: Point[] = [];
    const destPaths: PathSampleTable[] = [];

    for (let i = 0; i < destinations.length; i++) {
      const el = destNodeRefs.current[i];
      if (!el) continue;
      const dRect = el.getBoundingClientRect();
      let end: Point;
      if (effectiveOrientation === 'horizontal') {
        end = !isRtl
          ? { x: dRect.left - originLeft, y: dRect.top + dRect.height * 0.5 - sceneRect.top }
          : { x: dRect.right - originLeft, y: dRect.top + dRect.height * 0.5 - sceneRect.top };
        destPoints.push(end);
        destPaths.push(createHorizontalPath(coreOut, end));
      } else {
        end = { x: (isRtl ? dRect.left : dRect.right) - originLeft, y: dRect.top + dRect.height * 0.5 - sceneRect.top };
        destPoints.push(end);
        destPaths.push(createHorizontalPath(coreOut, end, (coreOut.x + (isRtl ? 0 : sceneRect.width)) * 0.5));
      }
    }

    const calculated: NodeGeometry = {
      sourcePoints,
      coreInputPoint: coreIn,
      coreOutputPoint: coreOut,
      destPoints,
      sourcePaths,
      destPaths,
    };
    geometryRef.current = calculated;
    setGeometry(calculated);
  };

  // Reset cycle illustrative clock when core/sources/destinations change
  useEffect(() => {
    elapsed.current = 0;
    setSnapshot('ingest');
    setIsStepped(false);
    lastCount.current = core?.countStart ?? 0;
    if (counterRef.current && core) {
      counterRef.current.textContent = `${formatNumber(core.countStart ?? 0)} ${core.countLabel}`;
    }
  }, [sources, core, destinations, locale]);

  // Page visibility & IntersectionObserver
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const doc = rootEl.ownerDocument;
    const onVisibility = () => setPageVisible(doc.visibilityState !== 'hidden');
    onVisibility();
    doc.addEventListener('visibilitychange', onVisibility);

    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            setIsIntersecting(entry?.isIntersecting ?? false);
          });
    intersection?.observe(rootEl);
    if (!intersection) setIsIntersecting(true);

    return () => {
      doc.removeEventListener('visibilitychange', onVisibility);
      intersection?.disconnect();
    };
  }, []);

  // ResizeObserver for scene width and geometry calculation
  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) return;
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            const sceneEntry = entries.find(entry => entry.target === sceneEl);
            if (sceneEntry) setContainerWidth(sceneEntry.contentRect.width);
            recomputeGeometry();
          });
    resize?.observe(sceneEl);
    for (const node of [...sourceNodeRefs.current, coreNodeRef.current, ...destNodeRefs.current]) {
      if (node) resize?.observe(node);
    }
    const directionObserver = new MutationObserver(recomputeGeometry);
    for (let ancestor: HTMLElement | null = sceneEl; ancestor; ancestor = ancestor.parentElement) {
      directionObserver.observe(ancestor, { attributes: true, attributeFilter: ['dir'] });
    }
    recomputeGeometry();

    return () => {
      resize?.disconnect();
      directionObserver.disconnect();
    };
  }, [sources, destinations, core, effectiveOrientation, isValid, isEmpty]);

  // Apply static snapshot
  const applySnapshot = (currentSnapshot: SnapshotStage, geom: NodeGeometry) => {
    const S = sources.length;
    const D = destinations.length;

    if (currentSnapshot === 'ingest') {
      for (let s = 0; s < MAX_SOURCES * 3; s++) {
        const circle = inputParticleRefs.current[s];
        if (!circle) continue;
        if (s < S && geom.sourcePaths[s]) {
          const pt = samplePath(geom.sourcePaths[s]!, 0.5);
          circle.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
          circle.setAttribute('opacity', '1');
        } else {
          circle.setAttribute('opacity', '0');
        }
      }
      for (let d = 0; d < MAX_DESTINATIONS * 3; d++) {
        const rect = outputParticleRefs.current[d];
        if (rect) rect.setAttribute('opacity', '0');
      }
      if (counterRef.current && core) {
        counterRef.current.textContent = `${formatNumber(core.countStart ?? 0)} ${core.countLabel}`;
      }
    } else if (currentSnapshot === 'transform') {
      for (let s = 0; s < MAX_SOURCES * 3; s++) {
        const circle = inputParticleRefs.current[s];
        if (!circle) continue;
        if (s < S && geom.sourcePaths[s]) {
          const pt = samplePath(geom.sourcePaths[s]!, 1.0);
          circle.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
          circle.setAttribute('opacity', '1');
        } else {
          circle.setAttribute('opacity', '0');
        }
      }
      for (let d = 0; d < MAX_DESTINATIONS * 3; d++) {
        const rect = outputParticleRefs.current[d];
        if (rect) rect.setAttribute('opacity', '0');
      }
      if (counterRef.current && core) {
        counterRef.current.textContent = `${formatNumber(core.countStart ?? 0)} ${core.countLabel}`;
      }
    } else if (currentSnapshot === 'route') {
      for (let s = 0; s < MAX_SOURCES * 3; s++) {
        const circle = inputParticleRefs.current[s];
        if (circle) circle.setAttribute('opacity', '0');
      }
      for (let d = 0; d < MAX_DESTINATIONS * 3; d++) {
        const rect = outputParticleRefs.current[d];
        if (!rect) continue;
        const eligible = d < D && (destinations[d]?.share ?? 1) > 0;
        if (eligible && geom.destPaths[d]) {
          const pt = samplePath(geom.destPaths[d]!, 0.5);
          rect.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
          rect.setAttribute('opacity', '1');
        } else {
          rect.setAttribute('opacity', '0');
        }
      }
      if (counterRef.current && core) {
        counterRef.current.textContent = `${formatNumber((core.countStart ?? 0) + 1)} ${core.countLabel}`;
      }
    }
  };

  // Stepping advances fixed snapshots
  const stepSnapshot = () => {
    setIsStepped(true);
    const next: SnapshotStage = snapshot === 'ingest' ? 'transform' : snapshot === 'transform' ? 'route' : 'ingest';
    setSnapshot(next);
    if (geometryRef.current) applySnapshot(next, geometryRef.current);
  };

  // Replay resets cycle clock and count without affecting paused state
  const replay = () => {
    elapsed.current = 0;
    lastCount.current = core?.countStart ?? 0;
    setSnapshot('ingest');
    setIsStepped(true);
    if (geometryRef.current) {
      applySnapshot('ingest', geometryRef.current);
    }
    if (counterRef.current && core) {
      counterRef.current.textContent = `${formatNumber(core.countStart ?? 0)} ${core.countLabel}`;
    }
  };

  // Animation frame loop
  useEffect(() => {
    if (
      !isValid ||
      isEmpty ||
      isPaused ||
      reduced ||
      speed === 0 ||
      !geometry ||
      !pageVisible ||
      !isIntersecting
    ) {
      if (reduced || isStepped || elapsed.current === 0) {
        if (geometryRef.current) applySnapshot(reduced && !isStepped ? 'route' : snapshot, geometryRef.current);
      }
      return;
    }

    let frame = 0;
    setIsStepped(false);
    let previousTime: number | undefined;

    const tick = (now: number) => {
      const geom = geometryRef.current;
      if (!geom) {
        return;
      }

      if (previousTime !== undefined) {
        const delta = (now - previousTime) * speed;
        if (delta > 0 && delta < 500) {
          elapsed.current += delta;
        }
      }
      previousTime = now;

      const T = elapsed.current;
      const S = sources.length;
      const D = destinations.length;
      const currentGlobalEmission = Math.floor(T / EMISSION_INTERVAL_MS);

      // Active emissions in flight: check current and previous two
      for (let emissionIdx = currentGlobalEmission - 2; emissionIdx <= currentGlobalEmission; emissionIdx++) {
        const slot = ((emissionIdx % 3) + 3) % 3;

        if (emissionIdx < 0) {
          // Future slot not started yet
          for (let s = 0; s < MAX_SOURCES; s++) {
            inputParticleRefs.current[slot * MAX_SOURCES + s]?.setAttribute('opacity', '0');
          }
          for (let d = 0; d < MAX_DESTINATIONS; d++) {
            outputParticleRefs.current[slot * MAX_DESTINATIONS + d]?.setAttribute('opacity', '0');
          }
          continue;
        }

        const timeSinceEmission = T - emissionIdx * EMISSION_INTERVAL_MS;

        // Phase 1: Ingest (Source -> Core)
        if (timeSinceEmission >= 0 && timeSinceEmission < INGEST_DURATION_MS) {
          const progress = timeSinceEmission / INGEST_DURATION_MS;
          for (let s = 0; s < MAX_SOURCES; s++) {
            const circle = inputParticleRefs.current[slot * MAX_SOURCES + s];
            if (!circle) continue;
            if (s < S && geom.sourcePaths[s]) {
              const pt = samplePath(geom.sourcePaths[s]!, progress);
              circle.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
              circle.setAttribute('opacity', '1');
            } else {
              circle.setAttribute('opacity', '0');
            }
          }
          for (let d = 0; d < MAX_DESTINATIONS; d++) {
            outputParticleRefs.current[slot * MAX_DESTINATIONS + d]?.setAttribute('opacity', '0');
          }
        }
        // Phase 2: Transform at Core
        else if (
          timeSinceEmission >= INGEST_DURATION_MS &&
          timeSinceEmission < INGEST_DURATION_MS + TRANSFORM_DURATION_MS
        ) {
          const transformProgress =
            (timeSinceEmission - INGEST_DURATION_MS) / TRANSFORM_DURATION_MS;
          for (let s = 0; s < MAX_SOURCES; s++) {
            const circle = inputParticleRefs.current[slot * MAX_SOURCES + s];
            if (!circle) continue;
            if (s < S && geom.sourcePaths[s]) {
              const pt = samplePath(geom.sourcePaths[s]!, 1.0);
              circle.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
              circle.setAttribute('opacity', `${Math.max(0, 1 - transformProgress * 2).toFixed(2)}`);
            } else {
              circle.setAttribute('opacity', '0');
            }
          }
          for (let d = 0; d < MAX_DESTINATIONS; d++) {
            const rect = outputParticleRefs.current[slot * MAX_DESTINATIONS + d];
            if (!rect) continue;
            const eligible = d < D && isEmissionEligible(emissionIdx, destinations[d]?.share ?? 1);
            if (eligible && geom.destPaths[d]) {
              const pt = samplePath(geom.destPaths[d]!, 0.0);
              rect.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
              rect.setAttribute('opacity', `${Math.min(1, transformProgress * 2).toFixed(2)}`);
            } else {
              rect.setAttribute('opacity', '0');
            }
          }
        }
        // Phase 3: Route (Core -> Destination)
        else if (timeSinceEmission >= INGEST_DURATION_MS + TRANSFORM_DURATION_MS && timeSinceEmission < TOTAL_FLIGHT_MS) {
          const progress = (timeSinceEmission - (INGEST_DURATION_MS + TRANSFORM_DURATION_MS)) / ROUTE_DURATION_MS;
          for (let s = 0; s < MAX_SOURCES; s++) {
            inputParticleRefs.current[slot * MAX_SOURCES + s]?.setAttribute('opacity', '0');
          }
          for (let d = 0; d < MAX_DESTINATIONS; d++) {
            const rect = outputParticleRefs.current[slot * MAX_DESTINATIONS + d];
            if (!rect) continue;
            const eligible = d < D && isEmissionEligible(emissionIdx, destinations[d]?.share ?? 1);
            if (eligible && geom.destPaths[d]) {
              const pt = samplePath(geom.destPaths[d]!, progress);
              rect.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
              rect.setAttribute('opacity', '1');
            } else {
              rect.setAttribute('opacity', '0');
            }
          }
        } else {
          // Flight finished
          for (let s = 0; s < MAX_SOURCES; s++) {
            inputParticleRefs.current[slot * MAX_SOURCES + s]?.setAttribute('opacity', '0');
          }
          for (let d = 0; d < MAX_DESTINATIONS; d++) {
            outputParticleRefs.current[slot * MAX_DESTINATIONS + d]?.setAttribute('opacity', '0');
          }
        }
      }

      // Update visual counter derived from completed local emissions
      const completedEmissions = Math.max(
        0,
        Math.floor((T - TOTAL_FLIGHT_MS) / EMISSION_INTERVAL_MS) + 1,
      );
      const currentCount = (core.countStart ?? 0) + completedEmissions;
      if (currentCount !== lastCount.current) {
        lastCount.current = currentCount;
        if (counterRef.current) {
          counterRef.current.textContent = `${formatNumber(currentCount)} ${core.countLabel}`;
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    isValid,
    isEmpty,
    isPaused,
    reduced,
    isStepped,
    speed,
    pageVisible,
    isIntersecting,
    snapshot,
    sources,
    destinations,
    geometry,
    core,
    locale,
  ]);

  if (!isValid) {
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
        data-ui="data-flow"
        aria-label={label}
        aria-describedby={rest['aria-describedby']}
      >
        {invalidContent}
      </FieldSlot>
    );
  }

  if (isEmpty) {
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
        data-ui="data-flow"
        aria-label={resolvedAriaLabel}
        aria-labelledby={mergedLabelledBy}
        aria-describedby={
          [rest['aria-describedby'], summaryId, hasCaption ? captionId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        {hasConsumerLabelledBy && (
          <span id={labelId} css={visuallyHiddenStyle}>
            {label}
          </span>
        )}
        <FieldSlot
          element="div"
          component={slots?.scene}
          slotProps={slotProps?.scene}
          data-ui="data-flow-scene"
          styles={sceneStyle}
        >
          {emptyContent}
        </FieldSlot>
        <FieldSlot
          element="ol"
          component={slots?.summary}
          slotProps={slotProps?.summary}
          styles={summaryStyle}
          id={summaryId}
          data-ui="data-flow-summary"
        >
          {summary.map((step) => (
            <li key={step.id} css={stepStyle}>
              {step.content}
            </li>
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
          </FieldSlot>
        )}
      </FieldSlot>
    );
  }

  const isStepEnabled = isPaused || speed === 0 || reduced;

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
      data-ui="data-flow"
      aria-label={resolvedAriaLabel}
      aria-labelledby={mergedLabelledBy}
      aria-describedby={
        [rest['aria-describedby'], summaryId, hasCaption ? captionId : undefined]
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      {hasConsumerLabelledBy && (
        <span id={labelId} css={visuallyHiddenStyle}>
          {label}
        </span>
      )}
      <FieldSlot
        element="div"
        component={slots?.scene}
        slotProps={slotProps?.scene}
        data-ui="data-flow-scene"
        aria-hidden="true"
        tabIndex={-1}
        styles={sceneStyle}
        ref={sceneRef}
      >
        <svg ref={svgRef} css={svgStyle} aria-hidden="true" focusable="false">
          {geometry?.sourcePaths.map((path, i) => (
            <path key={`sp-${i}`} d={path.d} css={routePathStyle} />
          ))}
          {geometry?.destPaths.map((path, i) => (
            <path key={`dp-${i}`} d={path.d} css={routePathStyle} />
          ))}
          {/* Pool of 24 input particle circles (3 slots x 8 sources) */}
          {Array.from({ length: MAX_SOURCES * 3 }, (_, idx) => (
            <circle
              key={`ip-${idx}`}
              ref={(el) => {
                inputParticleRefs.current[idx] = el;
              }}
              r={4}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              css={inputParticleStyle}
              opacity={0}
            />
          ))}
          {/* Pool of 24 output particle rects (3 slots x 8 destinations) */}
          {Array.from({ length: MAX_DESTINATIONS * 3 }, (_, idx) => (
            <rect
              key={`op-${idx}`}
              ref={(el) => {
                outputParticleRefs.current[idx] = el;
              }}
              x={-4}
              y={-4}
              width={8}
              height={8}
              rx={1}
              fill="currentColor"
              css={outputParticleStyle}
              opacity={0}
            />
          ))}
        </svg>

        <div css={layoutStyle} data-orientation={effectiveOrientation}>
          {/* Sources Column */}
          <div
            css={nodeGroupStyle}
            data-orientation={effectiveOrientation}
            data-ui="data-flow-sources"
          >
            {sources.map((source, idx) => (
              <FieldSlot
                key={source.id}
                element="div"
                component={slots?.node}
                slotProps={slotProps?.node}
                styles={nodeStyle}
                data-ui="data-flow-node"
                ref={(el) => {
                  sourceNodeRefs.current[idx] = el;
                }}
              >
                <div css={nodeHeaderStyle}>
                  {isRenderable(source.icon) && (
                    <span css={flowNodeIconStyle} aria-hidden="true">
                      {source.icon}
                    </span>
                  )}
                  <strong>{source.label}</strong>
                </div>
                {source.meta && <span css={flowNodeDetailStyle}>{source.meta}</span>}
                {source.detail && <span css={flowNodeDetailStyle}>{source.detail}</span>}
              </FieldSlot>
            ))}
          </div>

          {/* Core Node */}
          <div css={coreContainerStyle} data-ui="data-flow-core">
            <FieldSlot
              element="div"
              component={slots?.node}
              slotProps={slotProps?.node}
              styles={coreNodeStyle}
              data-ui="data-flow-node"
              ref={coreNodeRef}
            >
              <div css={nodeHeaderStyle}>
                {isRenderable(core.icon) && (
                  <span css={flowNodeIconStyle} aria-hidden="true">
                    {core.icon}
                  </span>
                )}
                <strong>{core.label}</strong>
              </div>
              {core.detail && <span css={flowNodeDetailStyle}>{core.detail}</span>}
              <span ref={counterRef} css={counterStyle}>
                {formatNumber(core.countStart ?? 0)} {core.countLabel}
              </span>
            </FieldSlot>
          </div>

          {/* Destinations Column */}
          <div
            css={nodeGroupStyle}
            data-orientation={effectiveOrientation}
            data-ui="data-flow-destinations"
          >
            {destinations.map((dest, idx) => (
              <FieldSlot
                key={dest.id}
                element="div"
                component={slots?.node}
                slotProps={slotProps?.node}
                styles={nodeStyle}
                data-ui="data-flow-node"
                ref={(el) => {
                  destNodeRefs.current[idx] = el;
                }}
              >
                <div css={nodeHeaderStyle}>
                  {isRenderable(dest.icon) && (
                    <span css={flowNodeIconStyle} aria-hidden="true">
                      {dest.icon}
                    </span>
                  )}
                  <strong>{dest.label}</strong>
                </div>
                {dest.meta && <span css={flowNodeDetailStyle}>{dest.meta}</span>}
                {dest.detail && <span css={flowNodeDetailStyle}>{dest.detail}</span>}
                {dest.share !== undefined && (
                  <span css={shareBadgeStyle}>{percentFormat.format(dest.share)}</span>
                )}
              </FieldSlot>
            ))}
          </div>
        </div>
      </FieldSlot>

      <FieldSlot
        element="ol"
        component={slots?.summary}
        slotProps={slotProps?.summary}
        styles={summaryStyle}
        id={summaryId}
        data-ui="data-flow-summary"
      >
        {summary.map((step) => (
          <li key={step.id} css={stepStyle}>
            {step.content}
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
        data-ui="data-flow-controls"
      >
        <FieldSlot
          element="button"
          component={slots?.pauseButton ?? Button}
          slotProps={slotProps?.pauseButton}
          styles={buttonStyle}
          type="button"
          behavior={{
            onClick: (event) => {
              if (!event.defaultPrevented) {
                setIsStepped(false);
                requestPause(!isPaused);
              }
            },
          }}
        >
          {isPaused ? controlLabels.resume : controlLabels.pause}
        </FieldSlot>
        <FieldSlot
          element="button"
          component={slots?.stepButton ?? Button}
          slotProps={slotProps?.stepButton}
          styles={buttonStyle}
          type="button"
          disabled={!isStepEnabled}
          behavior={{
            onClick: (event) => {
              if (!event.defaultPrevented) stepSnapshot();
            },
          }}
        >
          {controlLabels.step}
        </FieldSlot>
        <FieldSlot
          element="button"
          component={slots?.replayButton ?? Button}
          slotProps={slotProps?.replayButton}
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
        </FieldSlot>
      )}
    </FieldSlot>
  );
}

DataFlow.displayName = 'DataFlow';
