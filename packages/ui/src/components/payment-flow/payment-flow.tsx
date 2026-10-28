'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { Check } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { Button, type ButtonProps } from '../button';
import { Card } from '../card';
import {
  FLOW_NODE_BORDER,
  FLOW_NODE_DETAIL_FONT,
  FLOW_NODE_INSET,
  flowNodeDetailStyle,
  flowNodeHeaderStyle,
  flowNodeIconStyle,
  flowNodeStyle,
} from '../data-flow/flow-node';
import { FieldSlot, type FieldParts, type FieldSlots } from '../field/field-slot';
import {
  CONNECTOR_THICKNESS,
  STEP_MARKER_FONT,
  STEP_MARKER_SIZE,
  stepMarker,
  stepMarkerStyle,
} from '../stepper/step-marker';
import {
  densitiesWithLayout,
  densityCandidates,
  densityOrientation,
  fitDensity,
  paymentFlowDensityScale,
  type PaymentFlowDensity,
  type PaymentFlowLayout,
} from './payment-flow-density';
import {
  PAYMENT_CYCLE_MS,
  PAYMENT_PHASE_MS,
  paymentAmounts,
  paymentNodeKeys,
  paymentPhaseActor,
  paymentPhases,
  type PaymentFlowNodeKey,
} from './payment-flow-model';

export type { PaymentFlowNodeKey } from './payment-flow-model';
export type { PaymentFlowDensity } from './payment-flow-density';
const MAX_PLAYBACK_SPEED = 3;
// Server markup and the first client render use the density that fits any width.
const INITIAL_DENSITY: PaymentFlowDensity = 'stacked';

export interface PaymentFlowNode {
  label: string;
  detail?: ReactNode;
  icon?: ReactNode;
}
export interface PaymentFlowLabels {
  authorize: string;
  approve: string;
  clear: string;
  fee: string;
  payout: string;
  approval: string;
  settlementTime: string;
}
type Anatomy = {
  /** Renders a `figure` by default. */
  root: 'figure';
  scene: 'div';
  node: 'div';
  phase: 'div';
  summary: 'ol';
  summaryItem: 'li';
  controls: 'div';
  /** Renders a `figcaption` by default. */
  caption: 'figcaption';
};
export interface PaymentFlowSlots extends FieldSlots<Anatomy> {
  pauseButton?: ComponentType<ButtonProps>;
  stepButton?: ComponentType<ButtonProps>;
  replayButton?: ComponentType<ButtonProps>;
}
type ButtonSlotProps = Omit<ButtonProps, 'sx'> & { sx?: Interpolation<Theme> };
export interface PaymentFlowSlotProps extends FieldParts<Anatomy> {
  pauseButton?: ButtonSlotProps;
  stepButton?: ButtonSlotProps;
  replayButton?: ButtonSlotProps;
}
export interface PaymentFlowProps
  extends Omit<ComponentPropsWithRef<'figure'>, 'children'>,
    SxProps {
  /** Supplies each payment participant. A missing participant label shows `emptyContent`. */
  nodes: Record<PaymentFlowNodeKey, PaymentFlowNode>;
  /** Sets the illustrative gross charge in major currency units. Must be finite and nonnegative. */
  amount: number;
  /** Sets the deduction in major currency units. Must be nonnegative and no greater than `amount`. */
  fee: number;
  /** Sets the initial merchant balance in major currency units. Must be finite and nonnegative. */
  balance: number;
  /** Sets the currency code used to format amounts. Unsupported currencies show `invalidContent`. */
  currency: string;
  /** Sets the locale for currency amounts. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Sets the illustrative authorization time in milliseconds, not the animation duration. Must be finite and nonnegative. */
  authorizationMs: number;
  /** Supplies phase names and labels for fees, approval and settlement time. */
  labels: PaymentFlowLabels;
  /** Supplies the ordered text summary, one entry per phase. Fewer than five entries shows `invalidContent`. */
  summary: readonly { id: string; content: ReactNode }[];
  /** Shows the text summary or limits it to assistive technology. Defaults to `visible`. */
  summaryVisibility?: 'visible' | 'sr-only';
  /** Names the payment illustration for assistive technology. */
  label: string;
  /** Adds a caption associated with the illustration. */
  caption?: ReactNode;
  /**
   * Limits the layout. Defaults to `auto`, which uses the roomiest density whose labels fit the
   * figure: actors over phases, then the same rows tighter, then actors beside phases, then
   * stacked. `vertical` keeps the two side-by-side or stacked layouts. `horizontal` is deprecated
   * and behaves as `auto`; it will be removed in the next minor release.
   */
  orientation?: 'auto' | 'horizontal' | 'vertical';
  /** Playback multiplier from 0 (static) to 3. Defaults to 1. */
  speed?: number;
  /** Controls whether automatic playback is paused. Reduced motion and `speed={0}` also stop playback. */
  paused?: boolean;
  /** Pauses uncontrolled playback initially. Defaults to `false`. */
  defaultPaused?: boolean;
  /** Receives playback pause requests from the controls. */
  onPausedChange?: (paused: boolean) => void;
  /** Names the control group and its pause, resume, step and replay actions. */
  controlLabels: { group: string; pause: string; resume: string; step: string; replay: string };
  /** Replaces the scene when a participant label is missing. */
  emptyContent: ReactNode;
  /** Replaces the scene when amounts, currency, timing, speed or summary entries are invalid. */
  invalidContent: ReactNode;
  /** Replaces illustration elements with custom components. */
  slots?: PaymentFlowSlots;
  /** Passes props to the illustration elements. */
  slotProps?: PaymentFlowSlotProps;
  /** Replaces the root figure. Shorthand for `slots.root`. */
  component?: PaymentFlowSlots['root'];
}

const TRACK = '--payment-flow-track';
const GROUP = '--payment-flow-group';
const AMOUNT_FONT = '--payment-flow-amount-font';
const track = `var(${TRACK})`;
const group = `var(${GROUP})`;
const LABEL_GAP = vars.space[2];

/**
 * Styles for a scene descendant while one of the layout's densities is applied. The selector names
 * the scene, because the root also reports `data-density` and keeps the committed value while a
 * fit tries the others.
 */
const inLayout = (layout: PaymentFlowLayout, styles: object) => ({
  [densitiesWithLayout(layout).map((density) => `[data-ui~="payment-flow-scene"][data-density="${density}"] &`).join(', ')]: styles,
});
const vertical = (styles: object) => ({ ...inLayout('split', styles), ...inLayout('stack', styles) });

const rootStyle = css({
  margin: 0,
  display: 'grid',
  gap: vars.space[6],
  color: vars.color.text,
  fontFamily: vars.font.sans,
  minInlineSize: 0,
});
const stageSlotProps = {
  content: { sx: css({ display: 'grid', gap: vars.space[4], minInlineSize: 0 }) },
};
// Both groups are subgrids of one scene grid, so the actor row and the phase row share their
// tracks and always read the same `data-density`.
const sceneLayouts: Record<PaymentFlowLayout, object> = {
  row: {
    gridTemplateColumns: `repeat(${paymentNodeKeys.length}, minmax(min-content, 1fr))`,
    columnGap: track,
    rowGap: group,
  },
  split: {
    gridTemplateColumns: 'repeat(2, minmax(min-content, 1fr))',
    gridTemplateRows: `repeat(${paymentNodeKeys.length}, auto)`,
    columnGap: group,
    rowGap: track,
  },
  stack: { gridTemplateColumns: 'minmax(0, 1fr)', rowGap: group },
};
const sceneStyle = css({
  display: 'grid',
  minInlineSize: 0,
  fontSize: vars.textSize.sm,
  ...Object.fromEntries(
    Object.entries(paymentFlowDensityScale).map(([density, step]) => [
      `&[data-density="${density}"]`,
      {
        [TRACK]: step.track,
        [GROUP]: step.group,
        [FLOW_NODE_INSET]: step.inset,
        [FLOW_NODE_DETAIL_FONT]: step.detailFont,
        [AMOUNT_FONT]: step.amountFont,
        [STEP_MARKER_SIZE]: step.markerSize,
        [STEP_MARKER_FONT]: step.markerFont,
        ...sceneLayouts[step.layout],
      },
    ]),
  ),
});
const groupStyle = css({
  display: 'grid',
  ...inLayout('row', { gridColumn: '1 / -1', gridTemplateColumns: 'subgrid' }),
  ...inLayout('split', { gridRow: '1 / -1', gridTemplateRows: 'subgrid' }),
  ...inLayout('stack', { rowGap: track }),
});
// One connector look for both groups: a line across the track gap to the next item.
const connector = {
  content: '""',
  backgroundColor: vars.color.borderControl,
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { backgroundColor: 'CanvasText' },
};
// Labels and amounts keep one line until the stacked fallback; the density fit relies on it.
const singleLine = { whiteSpace: 'nowrap', ...inLayout('stack', { whiteSpace: 'normal' }) };
const nodeStyle = css(flowNodeStyle, {
  fontVariantNumeric: 'tabular-nums',
  '&[data-active="true"]': {
    outline: `${CONNECTOR_THICKNESS} solid ${vars.color.accent}`,
    outlineOffset: `-${CONNECTOR_THICKNESS}`,
  },
  '&:not(:last-child)::after': {
    ...connector,
    position: 'absolute',
    ...inLayout('row', {
      insetInlineStart: `calc(100% + ${FLOW_NODE_BORDER})`,
      insetBlockStart: `calc(50% - ${CONNECTOR_THICKNESS} / 2)`,
      inlineSize: track,
      blockSize: CONNECTOR_THICKNESS,
    }),
    ...vertical({
      insetBlockStart: `calc(100% + ${FLOW_NODE_BORDER})`,
      insetInlineStart: `calc(50% - ${CONNECTOR_THICKNESS} / 2)`,
      blockSize: track,
      inlineSize: CONNECTOR_THICKNESS,
    }),
  },
  [FORCED_COLORS]: { '&[data-active="true"]': { outlineColor: 'Highlight' } },
});
const nodeLabelStyle = css({ fontWeight: vars.fontWeight.semibold, ...singleLine });
// Every value an amount can show shares one cell, so a node keeps its width across phases.
const amountStyle = css({
  display: 'grid',
  fontSize: `var(${AMOUNT_FONT})`,
  ...singleLine,
  '& > *': { gridArea: '1 / 1' },
  '& > [data-shown="false"]': { visibility: 'hidden' },
});
const phaseStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: LABEL_GAP,
  color: vars.color.textMuted,
  '&[data-state="current"], &[data-state="complete"]': { color: vars.color.text },
  ...vertical({ alignItems: 'flex-start' }),
  // In a row the line is a filler after the label plus a bridge across the track gap, so it
  // reaches the next marker without lowering the phase's min-content width.
  '&::after': {
    ...connector,
    ...inLayout('row', { flex: '1 0 0', blockSize: CONNECTOR_THICKNESS }),
    ...vertical({
      position: 'absolute',
      insetInlineStart: `calc(${stepMarker} / 2 - ${CONNECTOR_THICKNESS} / 2)`,
      insetBlockStart: `calc(${stepMarker} + ${vars.space[1]})`,
      blockSize: `calc(100% - ${stepMarker} - 2 * ${vars.space[1]} + ${track})`,
      inlineSize: CONNECTOR_THICKNESS,
    }),
  },
  '&::before': { ...connector, content: 'none' },
  ...inLayout('row', {
    '&:not(:last-child)::before': {
      content: '""',
      position: 'absolute',
      insetInlineStart: '100%',
      insetBlockStart: `calc(50% - ${CONNECTOR_THICKNESS} / 2)`,
      inlineSize: `calc(${track} - ${LABEL_GAP})`,
      blockSize: CONNECTOR_THICKNESS,
    },
  }),
  '&:last-child::after': { content: 'none' },
  '&[data-state="complete"]::before, &[data-state="complete"]::after': {
    backgroundColor: vars.color.accent,
    [FORCED_COLORS]: { backgroundColor: 'Highlight' },
  },
});
const phaseLabelStyle = css({
  display: 'flex',
  alignItems: 'center',
  minBlockSize: stepMarker,
  fontWeight: vars.fontWeight.medium,
  ...singleLine,
});
const readoutStyle = css({ margin: 0, fontSize: vars.textSize.sm, fontVariantNumeric: 'tabular-nums' });
const mutedStyle = css({ color: vars.color.textMuted });
const controlsStyle = css({ display: 'flex', gap: vars.space[2], flexWrap: 'wrap' });
const summaryStyle = css({
  margin: 0,
  paddingInlineStart: vars.space[6],
  lineHeight: vars.lineHeight.base,
});
const captionStyle = css({ fontSize: vars.textSize.sm });

function phaseState(index: number, current: number) {
  if (index < current) return 'complete';
  return index === current ? 'current' : 'upcoming';
}

/** Explain a payment journey with illustrative values, not actual transaction status. */
export function PaymentFlow({
  nodes,
  amount,
  fee,
  balance,
  currency,
  locale,
  authorizationMs,
  labels,
  summary,
  summaryVisibility = 'visible',
  label,
  caption,
  orientation = 'auto',
  speed = 1,
  paused: pausedProp,
  defaultPaused = false,
  onPausedChange,
  controlLabels,
  emptyContent,
  invalidContent,
  slots,
  slotProps,
  component,
  ...rootProps
}: PaymentFlowProps) {
  const { sx, ...native } = rootProps;
  const summaryId = useId();
  const captionId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergeRefs([rootRef, native.ref]);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useControlledState(pausedProp, defaultPaused, onPausedChange);
  const [phase, setPhase] = useState(0);
  const [stepped, setStepped] = useState(false);
  const [announced, setAnnounced] = useState<number | null>(null);
  const [density, setDensity] = useState<PaymentFlowDensity>(INITIAL_DENSITY);
  const candidates = densityCandidates[orientation] ?? densityCandidates.auto;
  const elapsed = useRef(0);
  const amounts = useMemo(
    () => paymentAmounts(amount, fee, balance, currency, locale),
    [amount, fee, balance, currency, locale],
  );
  const missing = paymentNodeKeys.some((key) => !nodes?.[key]?.label);
  const invalid =
    !amounts ||
    !Number.isFinite(authorizationMs) ||
    authorizationMs < 0 ||
    !Number.isFinite(speed) ||
    speed < 0 ||
    speed > MAX_PLAYBACK_SPEED ||
    summary.length < paymentPhases.length;
  const showScene = !missing && !invalid;
  const frozen = paused || speed === 0 || !!reduced;
  const shownPhase = reduced && !stepped ? paymentPhases.length - 1 : phase;
  const phaseKey = paymentPhases[shownPhase]!;
  const resetKey = [...paymentNodeKeys.map((key) => nodes?.[key]?.label), amount, fee, balance, currency, authorizationMs].join('\u0000');

  // Every commit re-fits before paint: labels, amounts and locale all change the content width.
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (scene) setDensity(fitDensity(scene, candidates));
  });
  // Width and font changes re-fit on the next frame, outside the observer's delivery.
  useEffect(() => {
    const scene = sceneRef.current;
    const view = scene?.ownerDocument.defaultView;
    if (!scene || !view) return;
    let frame = 0;
    let width: number | undefined;
    const refit = () => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(() => setDensity(fitDensity(scene, candidates)));
    };
    const resize = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width;
      if (next === width) return;
      width = next;
      refit();
    });
    resize.observe(scene);
    const fonts = scene.ownerDocument.fonts;
    fonts?.addEventListener('loadingdone', refit);
    return () => {
      view.cancelAnimationFrame(frame);
      resize.disconnect();
      fonts?.removeEventListener('loadingdone', refit);
    };
  }, [candidates, showScene]);
  useEffect(() => {
    elapsed.current = 0;
    setPhase(0);
    setStepped(false);
    setAnnounced(null);
  }, [resetKey]);
  useEffect(() => {
    if (!showScene || frozen) return;
    const element = rootRef.current;
    if (!element) return;
    const doc = element.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;
    let visible = false;
    let sized = false;
    let frame = 0;
    let previous: number | undefined;
    let lastPhase = Math.min(paymentPhases.length - 1, Math.floor(elapsed.current / PAYMENT_PHASE_MS));
    function stop() {
      view!.cancelAnimationFrame(frame);
      frame = 0;
      previous = undefined;
    }
    function run(time: number) {
      frame = 0;
      if (previous !== undefined)
        elapsed.current = (elapsed.current + (time - previous) * speed) % PAYMENT_CYCLE_MS;
      previous = time;
      const next = Math.min(paymentPhases.length - 1, Math.floor(elapsed.current / PAYMENT_PHASE_MS));
      if (next !== lastPhase) {
        lastPhase = next;
        setPhase(next);
      }
      frame = view!.requestAnimationFrame(run);
    }
    function gate() {
      if (!visible || !sized || doc.hidden) stop();
      else if (!frame) frame = view!.requestAnimationFrame(run);
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      gate();
    });
    const resize = new ResizeObserver(([entry]) => {
      sized = !!entry && entry.contentRect.width > 0 && entry.contentRect.height > 0;
      gate();
    });
    intersection.observe(element);
    resize.observe(element);
    doc.addEventListener('visibilitychange', gate);
    return () => {
      stop();
      intersection.disconnect();
      resize.disconnect();
      doc.removeEventListener('visibilitychange', gate);
    };
  }, [frozen, showScene, speed]);

  const selectPhase = (next: number) => {
    elapsed.current = next * PAYMENT_PHASE_MS;
    setStepped(true);
    setPhase(next);
    setAnnounced(next);
  };
  const Pause = slots?.pauseButton ?? Button;
  const Step = slots?.stepButton ?? Button;
  const Replay = slots?.replayButton ?? Button;
  const hasCaption = isRenderable(caption);
  const numerals = numberFormatter(locale);
  const elapsedLabel = invalid
    ? ''
    : numberFormatter(locale, { style: 'unit', unit: 'millisecond' }).format(authorizationMs);
  const nodeAmounts = (key: PaymentFlowNodeKey) => {
    if (key === 'merchant') return [amounts!.initial, amounts!.final];
    if (key === 'processor') return [amounts!.gross, amounts!.net];
    return [amounts!.gross];
  };
  const shownAmount = (key: PaymentFlowNodeKey) => {
    if (key === 'merchant') return shownPhase === paymentPhases.indexOf('payout') ? 1 : 0;
    if (key === 'processor') return shownPhase >= paymentPhases.indexOf('fee') ? 1 : 0;
    return 0;
  };
  const readoutAmount =
    phaseKey === 'fee' ? amounts?.fee : phaseKey === 'payout' ? amounts?.final : amounts?.gross;

  return (
    <FieldSlot
      element="figure"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      root
      {...native}
      ref={mergedRef}
      styles={rootStyle}
      sx={sx}
      aria-label={native['aria-label'] ?? label}
      aria-describedby={
        [native['aria-describedby'], showScene ? summaryId : null, hasCaption ? captionId : null]
          .filter(Boolean)
          .join(' ') || undefined
      }
      data-ui={['payment-flow', Reflect.get(native, 'data-ui')].filter(Boolean).join(' ')}
      data-phase={phaseKey}
      data-density={showScene ? density : undefined}
    >
      {missing ? (
        emptyContent
      ) : invalid ? (
        invalidContent
      ) : (
        <>
          <Card
            slotProps={stageSlotProps}
            content={
              <>
                <FieldSlot
                  element="div"
                  component={slots?.scene}
                  slotProps={slotProps?.scene}
                  ref={sceneRef}
                  styles={sceneStyle}
                  aria-hidden="true"
                  data-ui="payment-flow-scene"
                  data-density={density}
                  data-orientation={densityOrientation(density)}
                >
                  <div css={groupStyle} data-ui="payment-flow-actors">
                    {paymentNodeKeys.map((key) => (
                      <FieldSlot
                        key={key}
                        element="div"
                        component={slots?.node}
                        slotProps={slotProps?.node}
                        styles={nodeStyle}
                        data-ui="payment-flow-node"
                        data-node={key}
                        data-active={paymentPhaseActor[phaseKey] === key}
                      >
                        <span css={flowNodeHeaderStyle}>
                          {isRenderable(nodes[key].icon) ? <span css={flowNodeIconStyle}>{nodes[key].icon}</span> : null}
                          <span css={nodeLabelStyle} data-ui="payment-flow-node-label">
                            {nodes[key].label}
                          </span>
                        </span>
                        {isRenderable(nodes[key].detail) ? (
                          <span css={flowNodeDetailStyle}>{nodes[key].detail}</span>
                        ) : null}
                        <span css={amountStyle} data-ui="payment-flow-amount">
                          {nodeAmounts(key).map((value, index) => (
                            <bdi key={index} data-shown={index === shownAmount(key)}>
                              {value}
                            </bdi>
                          ))}
                        </span>
                      </FieldSlot>
                    ))}
                  </div>
                  <div css={groupStyle} data-ui="payment-flow-phases">
                    {paymentPhases.map((key, index) => {
                      const state = phaseState(index, shownPhase);
                      return (
                        <FieldSlot
                          key={key}
                          element="div"
                          component={slots?.phase}
                          slotProps={slotProps?.phase}
                          styles={phaseStyle}
                          data-ui="payment-flow-phase"
                          data-state={state}
                        >
                          <span
                            css={stepMarkerStyle}
                            data-state={state}
                            data-numeral={state === 'complete' ? undefined : numerals.format(index + 1)}
                          >
                            {state === 'complete' ? <Check size="inherit" decorative /> : null}
                          </span>
                          <span css={phaseLabelStyle} data-ui="payment-flow-phase-label">
                            {labels[key]}
                          </span>
                        </FieldSlot>
                      );
                    })}
                  </div>
                </FieldSlot>
                <p css={readoutStyle} aria-hidden="true" data-ui="payment-flow-readout">
                  <strong>{labels[phaseKey]}</strong>
                  {phaseKey === 'approve' ? <> {labels.approval}</> : null} <bdi>{readoutAmount}</bdi>{' '}
                  <span css={mutedStyle}>
                    {elapsedLabel} {labels.settlementTime}
                  </span>
                </p>
              </>
            }
          />
          <p css={visuallyHiddenStyle} aria-live="polite" aria-atomic="true" data-ui="payment-flow-live">
            {announced === null ? null : (
              <>
                {labels[paymentPhases[announced]!]}: {summary[announced]?.content}
              </>
            )}
          </p>
          <FieldSlot
            element="ol"
            component={slots?.summary}
            slotProps={slotProps?.summary}
            id={summaryId}
            styles={summaryVisibility === 'sr-only' ? visuallyHiddenStyle : summaryStyle}
            data-ui="payment-flow-summary"
          >
            {summary.map((step) => (
              <FieldSlot
                key={step.id}
                element="li"
                component={slots?.summaryItem}
                slotProps={slotProps?.summaryItem}
                data-ui="payment-flow-summary-item"
              >
                {step.content}
              </FieldSlot>
            ))}
          </FieldSlot>
          <FieldSlot
            element="div"
            component={slots?.controls}
            slotProps={slotProps?.controls}
            styles={controlsStyle}
            role="group"
            aria-label={controlLabels.group}
            data-ui="payment-flow-controls"
          >
            <Pause
              {...slotProps?.pauseButton}
              type="button"
              data-ui="payment-flow-pause-button"
              onClick={(event) => {
                slotProps?.pauseButton?.onClick?.(event);
                if (!event.defaultPrevented) setPaused(!paused);
              }}
            >
              {paused ? controlLabels.resume : controlLabels.pause}
            </Pause>
            <Step
              {...slotProps?.stepButton}
              type="button"
              disabled={!frozen}
              data-ui="payment-flow-step-button"
              onClick={(event) => {
                slotProps?.stepButton?.onClick?.(event);
                if (!event.defaultPrevented && frozen) selectPhase((shownPhase + 1) % paymentPhases.length);
              }}
            >
              {controlLabels.step}
            </Step>
            <Replay
              {...slotProps?.replayButton}
              type="button"
              data-ui="payment-flow-replay-button"
              onClick={(event) => {
                slotProps?.replayButton?.onClick?.(event);
                if (!event.defaultPrevented) selectPhase(0);
              }}
            >
              {controlLabels.replay}
            </Replay>
          </FieldSlot>
        </>
      )}
      {hasCaption ? (
        <FieldSlot
          element="figcaption"
          component={slots?.caption}
          slotProps={slotProps?.caption}
          styles={captionStyle}
          id={captionId}
          data-ui="payment-flow-caption"
        >
          {caption}
        </FieldSlot>
      ) : null}
    </FieldSlot>
  );
}
PaymentFlow.displayName = 'PaymentFlow';
