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
import { vars } from '@jfrader/tokens/vars';
import { useMergeRefs } from '@floating-ui/react';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { FORCED_COLORS } from '../../styling/media';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { isRenderable } from '../../utils/renderable';
import { Card } from '../card';
import { Stepper, type StepperProps, type StepperStaticProps } from '../stepper';
import { Button, type ButtonProps } from '../button';
import { FieldSlot, type FieldParts, type FieldSlots } from '../field/field-slot';
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
  root: 'figure';
  scene: 'div';
  node: 'div';
  summary: 'ol';
  summaryItem: 'li';
  controls: 'div';
  caption: 'figcaption';
};
export interface PaymentFlowSlots extends FieldSlots<Anatomy> {
  journey?: ComponentType<StepperProps>;
  pauseButton?: ComponentType<ButtonProps>;
  stepButton?: ComponentType<ButtonProps>;
  replayButton?: ComponentType<ButtonProps>;
}
type ButtonSlotProps = Omit<ButtonProps, 'sx'> & { css?: Interpolation<Theme> };
export interface PaymentFlowSlotProps extends FieldParts<Anatomy> {
  journey?: Partial<Omit<StepperStaticProps, 'sx'>> & { css?: Interpolation<Theme> };
  pauseButton?: ButtonSlotProps;
  stepButton?: ButtonSlotProps;
  replayButton?: ButtonSlotProps;
}
export interface PaymentFlowProps
  extends Omit<ComponentPropsWithRef<'figure'>, 'children'>,
    SxProps {
  nodes: Record<PaymentFlowNodeKey, PaymentFlowNode>;
  amount: number;
  fee: number;
  balance: number;
  currency: string;
  locale?: Intl.LocalesArgument;
  authorizationMs: number;
  labels: PaymentFlowLabels;
  summary: readonly { id: string; content: ReactNode }[];
  summaryVisibility?: 'visible' | 'sr-only';
  label: string;
  caption?: ReactNode;
  orientation?: 'auto' | 'horizontal' | 'vertical';
  speed?: number;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  controlLabels: { group: string; pause: string; resume: string; step: string; replay: string };
  emptyContent: ReactNode;
  invalidContent: ReactNode;
  slots?: PaymentFlowSlots;
  slotProps?: PaymentFlowSlotProps;
  component?: PaymentFlowSlots['root'];
}
const rootStyle = css({
  margin: 0,
  display: 'grid',
  gap: vars.space[4],
  color: vars.color.text,
  fontFamily: vars.font.sans,
  minInlineSize: 0,
  containerType: 'inline-size',
  containerName: 'payment-flow',
});
const sceneStyle = css({
  '--payment-flow-accent': vars.color.accent,
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: vars.space[2],
  minInlineSize: 0,
  '&[data-orientation="vertical"]': { gridTemplateColumns: 'minmax(0, 1fr)' },
  '@container payment-flow (max-width: 700px)': {
    '&[data-orientation="auto"]': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
});
const nodeStyle = css({
  padding: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  '&[data-active="true"]': {
    outline: `2px solid var(--payment-flow-accent)`,
    outlineOffset: '-2px',
  },
  [FORCED_COLORS]: { '&[data-active="true"]': { outlineColor: 'Highlight' } },
});
const controlsStyle = css({ display: 'flex', gap: vars.space[2], flexWrap: 'wrap' });
const summaryStyle = css({
  margin: 0,
  paddingInlineStart: vars.space[6],
  lineHeight: vars.lineHeight.base,
});
const captionStyle = css({ fontSize: vars.textSize.sm, overflowWrap: 'anywhere' });

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
  const mergedRef = useMergeRefs([rootRef, native.ref]);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useControlledState(pausedProp, defaultPaused, onPausedChange);
  const [phase, setPhase] = useState(0);
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
    speed > 3 ||
    summary.length < paymentPhases.length;
  const frozen = paused || speed === 0 || !!reduced;
  const [stepped, setStepped] = useState(false);
  const shownPhase = reduced && !stepped ? paymentPhases.length - 1 : phase;
  useEffect(() => {
    elapsed.current = 0;
    setPhase(0);
    setStepped(false);
  }, [nodes, amount, fee, balance, currency, authorizationMs]);
  useEffect(() => {
    if (missing || invalid || frozen) return;
    const element = rootRef.current;
    if (!element) return;
    const doc = element.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;
    let visible = false;
    let sized = false;
    let frame = 0;
    let previous: number | undefined;
    let lastPhase = Math.min(
      paymentPhases.length - 1,
      Math.floor(elapsed.current / PAYMENT_PHASE_MS),
    );
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
      const next = Math.min(
        paymentPhases.length - 1,
        Math.floor(elapsed.current / PAYMENT_PHASE_MS),
      );
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
  }, [frozen, invalid, missing, speed]);
  const Pause = slots?.pauseButton ?? Button;
  const Step = slots?.stepButton ?? Button;
  const Replay = slots?.replayButton ?? Button;
  const Journey = slots?.journey ?? Stepper;
  const hasCaption = isRenderable(caption);
  const phaseKey = paymentPhases[shownPhase]!;
  const elapsedLabel = invalid
    ? ''
    : new Intl.NumberFormat(locale, { style: 'unit', unit: 'millisecond' }).format(
        Math.min(authorizationMs, PAYMENT_PHASE_MS),
      );
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
        [
          native['aria-describedby'],
          !missing && !invalid ? summaryId : null,
          hasCaption ? captionId : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      data-ui={['payment-flow', Reflect.get(native, 'data-ui')].filter(Boolean).join(' ')}
      data-phase={phaseKey}
    >
      {missing ? (
        emptyContent
      ) : invalid ? (
        invalidContent
      ) : (
        <>
          <Card
            content={
              <>
                <FieldSlot
                  element="div"
                  component={slots?.scene}
                  slotProps={slotProps?.scene}
                  styles={sceneStyle}
                  aria-hidden="true"
                  data-ui="payment-flow-scene"
                  data-orientation={orientation}
                >
                  {paymentNodeKeys.map((key) => (
                    <FieldSlot
                      key={key}
                      element="div"
                      component={slots?.node}
                      slotProps={slotProps?.node}
                      styles={nodeStyle}
                      data-ui="payment-flow-node"
                      data-active={paymentPhaseActor[phaseKey] === key}
                    >
                      {nodes[key].icon}
                      <div>{nodes[key].label}</div>
                      <div>{nodes[key].detail}</div>
                      <bdi>
                        {key === 'merchant'
                          ? shownPhase === 4
                            ? amounts!.final
                            : amounts!.initial
                          : key === 'processor' && shownPhase >= 3
                            ? amounts!.net
                            : amounts!.gross}
                      </bdi>
                    </FieldSlot>
                  ))}
                </FieldSlot>
                <Journey
                  {...slotProps?.journey}
                  steps={paymentPhases.map((key) => ({ id: key, label: labels[key] }))}
                  value={shownPhase}
                  label={label}
                  orientation={orientation === 'horizontal' ? 'horizontal' : 'vertical'}
                  interactive={false}
                  announceChanges={false}
                  getStepLabel={(step) => step.label}
                  data-ui="payment-flow-journey"
                  aria-hidden="true"
                />
                <div aria-hidden="true">
                  {labels[phaseKey]} {phaseKey === 'approve' ? labels.approval : null}{' '}
                  <bdi>
                    {phaseKey === 'fee'
                      ? amounts!.fee
                      : phaseKey === 'payout'
                        ? amounts!.final
                        : amounts!.gross}
                  </bdi>{' '}
                  {elapsedLabel} {labels.settlementTime}
                </div>
              </>
            }
          />
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
                if (event.defaultPrevented || !frozen) return;
                const next = (shownPhase + 1) % paymentPhases.length;
                elapsed.current = next * PAYMENT_PHASE_MS;
                setStepped(true);
                setPhase(next);
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
                if (event.defaultPrevented) return;
                elapsed.current = 0;
                setStepped(true);
                setPhase(0);
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
