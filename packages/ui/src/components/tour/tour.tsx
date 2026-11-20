'use client';

// Non-modal guided tour. Each step anchors a small dialog to a control outside the tour's
// own DOM, so a host can point at its toolbar without wrapping every target. The target
// stays interactive: outside presses do not dismiss, Escape does.
//
// Keyboard map: Escape closes (unless `closeOnEscape` is false); Tab follows page order into
// the panel; Next and Back are ordinary buttons. Focus moves to the step title when
// `autoFocus` is true (the default) so keyboard users land inside the panel.
//
// Positioning: the step uses the shared floating seam with an explicit reference element.
// A highlight ring tracks the target's viewport rectangle while the panel is open. If a
// selector target never appears, the panel centers in the viewport and `onTargetMissing`
// fires once for that step.
import {
  useCallback,
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
import { FloatingFocusManager, useInteractions, useRole, type Placement } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { Close } from '@jfrader/icons/close';
import { Button } from '../button';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import { raisedSurface } from '../../styling/surface';
import { WithSx, withoutSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { isRenderable } from '../../utils/renderable';

/** A selector, an element, or a function that returns either. */
export type TourTarget = string | Element | (() => Element | null);

export interface TourStep {
  /** Stable identifier for the step, used by hosts for analytics and persistence. */
  id: string;
  /** The control this step points at. */
  target: TourTarget;
  /** The step heading. It names the non-modal dialog. */
  title: ReactNode;
  /** Body copy below the heading. */
  description?: ReactNode;
  /** Additional content rendered below the description. */
  content?: ReactNode;
  /** Preferred side of the target. Defaults to `bottom`; flips to fit. */
  placement?: Placement;
}

export interface TourLabels {
  /** Advance to the next step. */
  next: ReactNode;
  /** Return to the previous step. */
  back: ReactNode;
  /** End the tour early. */
  skip: ReactNode;
  /** Finish the last step. */
  done: ReactNode;
  /** Name the close button. */
  close: string;
  /** Progress text. Receives the one-based step and the total. */
  step: (index: number, total: number) => ReactNode;
  /** Fallback name for the live announcement when the title is not text. */
  dialog: string;
}

export const DEFAULT_TOUR_LABELS: TourLabels = {
  next: 'Next',
  back: 'Back',
  skip: 'Skip',
  done: 'Done',
  close: 'Close',
  step: (index, total) => `Step ${index} of ${total}`,
  dialog: 'Guided tour',
};

export interface TourProps extends SxProps {
  /** The steps in order. An empty list renders nothing. */
  steps: readonly TourStep[];
  /** Control whether the tour is open. */
  open?: boolean;
  /** Open the uncontrolled tour initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receive requests to open or close the tour. */
  onOpenChange?: (open: boolean) => void;
  /** Control the active step. */
  step?: number;
  /** Start at this step when uncontrolled. Defaults to `0`. */
  defaultStep?: number;
  /** Receive the requested step. */
  onStepChange?: (step: number) => void;
  /** Called after the last step's primary action. */
  onComplete?: () => void;
  /** Called by Skip or the close button. */
  onSkip?: () => void;
  /** Replace any visible label. */
  labels?: Partial<TourLabels>;
  /** Show the progress line. Defaults to `true`. */
  showProgress?: boolean;
  /** Draw a ring around the target. Defaults to `true`. */
  highlight?: boolean;
  /** Close on Escape. Defaults to `true`. */
  closeOnEscape?: boolean;
  /** Scroll the target into view when a step opens. Defaults to `true`. */
  scrollIntoView?: boolean;
  /** Focus the step title when a step opens. Defaults to `true`. */
  autoFocus?: boolean;
  /** How long to wait for a selector target before centering, in milliseconds. Defaults to `1500`. */
  targetTimeout?: number;
  /** Choose what to render when a target never appears. Defaults to `center`. */
  fallback?: 'center' | 'hide';
  /** Called once for a step whose target never appears. */
  onTargetMissing?: (step: TourStep, index: number) => void;
  /** Style the step panel. */
  className?: string;
  /** Replace the step panel root. */
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replace the step panel root. `slots.popover` takes precedence. */
  slots?: {
    popover?: ComponentType<ComponentPropsWithRef<'div'>>;
  };
  /** Pass props and `sx` to the step panel. */
  slotProps?: {
    popover?: ComponentPropsWithRef<'div'> & SxProps;
  };
}

const panelStyle = css({
  zIndex: vars.zIndex.popover,
  ...raisedSurface,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.overlay,
  padding: vars.space[4],
  inlineSize: 'min(360px, calc(100vw - 32px))',
  maxInlineSize: '100%',
  maxBlockSize: 'calc(100vh - 32px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  fontSize: vars.textSize.sm,
});

const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[2],
  marginBlockEnd: vars.space[1],
});

const progressStyle = css({
  color: vars.color.textMuted,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.semibold,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const titleStyle = css({
  display: 'inline-block',
  maxInlineSize: '100%',
  margin: 0,
  marginBlockStart: vars.space[1],
  borderRadius: vars.radius.sm,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  letterSpacing: '-0.011em',
  lineHeight: vars.lineHeight.tight,
  '&:focus-visible': { ...focusRingOutset, outlineOffset: '3px' },
});

const descriptionStyle = css({
  margin: 0,
  marginBlockStart: vars.space[2],
  color: vars.color.textMuted,
  lineHeight: vars.lineHeight.base,
});

const contentStyle = css({
  marginBlockStart: vars.space[3],
});

const actionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: vars.space[2],
  marginBlockStart: vars.space[4],
});

const spacerStyle = css({ flex: '1 1 auto' });

const highlightStyle = css({
  position: 'fixed',
  zIndex: vars.zIndex.popover,
  pointerEvents: 'none',
  borderRadius: vars.radius.sm,
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: '2px',
  [FORCED_COLORS]: { outlineColor: 'Highlight' },
});

const fallbackStyle = css({
  position: 'fixed',
  inset: 0,
  zIndex: vars.zIndex.popover,
  display: 'grid',
  placeItems: 'center',
  padding: vars.space[4],
  pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
});

interface TourPanelProps {
  current: TourStep;
  index: number;
  count: number;
  labels: TourLabels;
  showProgress: boolean;
  autoFocus: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
  rootRef?: ComponentPropsWithRef<'div'>['ref'];
  rootProps?: ComponentPropsWithRef<'div'>;
  className?: string;
  sx?: SxProps['sx'];
  style?: CSSProperties;
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  slots?: TourProps['slots'];
  slotProps?: TourProps['slotProps'];
}

function TourPanel({
  current,
  index,
  count,
  labels,
  showProgress,
  autoFocus,
  isLast,
  onBack,
  onNext,
  onSkip,
  onClose,
  rootRef,
  rootProps,
  className,
  sx,
  style,
  component,
  slots,
  slotProps,
}: TourPanelProps) {
  const titleId = useId();
  const descriptionId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const Root = slots?.popover ?? component ?? 'div';
  const popoverProps = withoutSx(slotProps?.popover);
  const mergedClassName = [className, popoverProps?.className].filter(Boolean).join(' ') || undefined;
  const mergedStyle = { ...popoverProps?.style, ...style };
  const progress = labels.step(index + 1, count);
  const announcement =
    typeof progress === 'string' && typeof current.title === 'string' ? `${progress}: ${current.title}` : progress;

  useEffect(() => {
    if (!autoFocus) return;
    titleRef.current?.focus({ preventScroll: true });
  }, [autoFocus, current.id]);

  return (
    <WithSx className={mergedClassName} styles={panelStyle} sx={slotProps?.popover?.sx ?? sx}>
      {(className) => (
        <Root
          {...rootProps}
          {...popoverProps}
          ref={rootRef}
          data-ui="tour"
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={isRenderable(current.description) ? descriptionId : undefined}
          className={className}
          style={mergedStyle}
        >
          <span css={visuallyHiddenStyle} role="status" aria-live="polite">
            {announcement}
          </span>
          <div css={headerStyle}>
            {showProgress ? (
              <span css={progressStyle} aria-hidden="true">
                {progress}
              </span>
            ) : (
              <span />
            )}
            <Button variant="ghost" size="sm" aria-label={labels.close} onClick={onClose}>
              <Close decorative />
            </Button>
          </div>
          <h2 id={titleId} ref={titleRef} tabIndex={-1} css={titleStyle}>
            {current.title}
          </h2>
          {isRenderable(current.description) && (
            <p id={descriptionId} css={descriptionStyle}>
              {current.description}
            </p>
          )}
          {isRenderable(current.content) && <div css={contentStyle}>{current.content}</div>}
          <div css={actionsStyle}>
            <Button variant="ghost" size="sm" onClick={onBack} disabled={index === 0}>
              {labels.back}
            </Button>
            <span css={spacerStyle} />
            <Button variant="ghost" size="sm" onClick={onSkip}>
              {labels.skip}
            </Button>
            <Button size="sm" onClick={onNext}>
              {isLast ? labels.done : labels.next}
            </Button>
          </div>
        </Root>
      )}
    </WithSx>
  );
}

interface TourLayerProps {
  nodeId: string | undefined;
  current: TourStep;
  index: number;
  count: number;
  labels: TourLabels;
  showProgress: boolean;
  highlight: boolean;
  autoFocus: boolean;
  closeOnEscape: boolean;
  scrollIntoView: boolean;
  targetTimeout: number;
  fallback: 'center' | 'hide';
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
  onTargetMissing?: (step: TourStep, index: number) => void;
  className?: string;
  sx?: SxProps['sx'];
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  slots?: TourProps['slots'];
  slotProps?: TourProps['slotProps'];
}

function resolveTarget(target: TourTarget): Element | null {
  if (typeof target === 'string') return typeof document === 'undefined' ? null : document.querySelector(target);
  if (typeof target === 'function') return target();
  return target;
}

/** Resolves a step target and waits briefly for one that mounts after the step opens. */
function useTourTarget(target: TourTarget, timeout: number) {
  const [element, setElement] = useState<Element | null>(() => resolveTarget(target));
  const [resolved, setResolved] = useState(() => resolveTarget(target) !== null);

  useEffect(() => {
    const immediate = resolveTarget(target);
    if (immediate) {
      setElement(immediate);
      setResolved(true);
      return;
    }
    setElement(null);
    setResolved(false);
    if (typeof document === 'undefined') {
      setResolved(true);
      return;
    }
    let settled = false;
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      const next = resolveTarget(target);
      if (!next) return;
      settled = true;
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      setElement(next);
      setResolved(true);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timer = window.setTimeout(() => {
      observer.disconnect();
      if (settled) return;
      settled = true;
      setElement(resolveTarget(target));
      setResolved(true);
    }, timeout);
    return () => {
      settled = true;
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [target, timeout]);

  return { element, resolved };
}

interface TourSurfaceProps extends TourLayerProps {
  target: Element;
}

function AnchoredTour({
  target,
  nodeId,
  current,
  index,
  count,
  labels,
  showProgress,
  highlight,
  autoFocus,
  closeOnEscape,
  onBack,
  onNext,
  onSkip,
  onClose,
  className,
  sx,
  component,
  slots,
  slotProps,
}: TourSurfaceProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const syncRect = useCallback(() => {
    const next = target.getBoundingClientRect();
    const previous = rectRef.current;
    if (
      previous &&
      Math.abs(previous.top - next.top) < 0.5 &&
      Math.abs(previous.left - next.left) < 0.5 &&
      Math.abs(previous.width - next.width) < 0.5 &&
      Math.abs(previous.height - next.height) < 0.5
    ) {
      return;
    }
    rectRef.current = next;
    setRect(next);
  }, [target]);

  const { refs, floatingStyles, context } = useOverlayFloating({
    open: true,
    reference: target,
    placement: current.placement ?? 'bottom',
    nodeId,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
    onUpdate: syncRect,
  });
  const dismiss = useLayerDismiss(context, 'container', {
    enabled: closeOnEscape,
    outsidePress: false,
  });
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps } = useInteractions([...dismiss, role]);

  useLayoutEffect(() => {
    syncRect();
  }, [syncRect]);

  return (
    <OverlayPortal>
      {highlight && rect && (
        <div
          css={highlightStyle}
          data-ui="tour-highlight"
          aria-hidden="true"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus={false} closeOnFocusOut={false}>
        <TourPanel
          current={current}
          index={index}
          count={count}
          labels={labels}
          showProgress={showProgress}
          autoFocus={autoFocus}
          isLast={index >= count - 1}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          onClose={onClose}
          rootRef={refs.setFloating}
          rootProps={getFloatingProps(withoutSx(slotProps?.popover))}
          className={className}
          sx={sx}
          style={floatingStyles}
          component={component}
          slots={slots}
          slotProps={slotProps}
        />
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

function FallbackTour({
  current,
  index,
  count,
  labels,
  showProgress,
  autoFocus,
  closeOnEscape,
  onBack,
  onNext,
  onSkip,
  onClose,
  className,
  sx,
  component,
  slots,
  slotProps,
}: TourLayerProps) {
  const close = useLatestCallback(onClose);
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeOnEscape, close]);

  return (
    <OverlayPortal>
      <div css={fallbackStyle} data-ui="tour-fallback">
        <TourPanel
          current={current}
          index={index}
          count={count}
          labels={labels}
          showProgress={showProgress}
          autoFocus={autoFocus}
          isLast={index >= count - 1}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          onClose={onClose}
          className={className}
          sx={sx}
          component={component}
          slots={slots}
          slotProps={slotProps}
        />
      </div>
    </OverlayPortal>
  );
}

function TourLayer(props: TourLayerProps) {
  const { current, index, targetTimeout, fallback, onTargetMissing, scrollIntoView, ...rest } = props;
  const { element: target, resolved } = useTourTarget(current.target, targetTimeout);
  const missing = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    missing.current = false;
  }, [current.id]);

  useEffect(() => {
    if (!resolved || target || missing.current) return;
    missing.current = true;
    onTargetMissing?.(current, index);
  }, [resolved, target, current, index, onTargetMissing]);

  useEffect(() => {
    if (!target || !scrollIntoView) return;
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [target, current.id, scrollIntoView, reducedMotion]);

  if (!resolved) return null;
  if (!target) {
    if (fallback === 'hide') return null;
    return <FallbackTour current={current} index={index} targetTimeout={targetTimeout} fallback={fallback} onTargetMissing={onTargetMissing} scrollIntoView={scrollIntoView} {...rest} />;
  }
  return <AnchoredTour target={target} current={current} index={index} targetTimeout={targetTimeout} fallback={fallback} onTargetMissing={onTargetMissing} scrollIntoView={scrollIntoView} {...rest} />;
}

function mergeLabels(labels: Partial<TourLabels> | undefined): TourLabels {
  return {
    next: labels?.next ?? DEFAULT_TOUR_LABELS.next,
    back: labels?.back ?? DEFAULT_TOUR_LABELS.back,
    skip: labels?.skip ?? DEFAULT_TOUR_LABELS.skip,
    done: labels?.done ?? DEFAULT_TOUR_LABELS.done,
    close: labels?.close ?? DEFAULT_TOUR_LABELS.close,
    step: labels?.step ?? DEFAULT_TOUR_LABELS.step,
    dialog: labels?.dialog ?? DEFAULT_TOUR_LABELS.dialog,
  };
}

export function Tour({
  steps,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  step: stepProp,
  defaultStep = 0,
  onStepChange,
  onComplete,
  onSkip,
  labels,
  showProgress = true,
  highlight = true,
  closeOnEscape = true,
  scrollIntoView = true,
  autoFocus = true,
  targetTimeout = 1500,
  fallback = 'center',
  onTargetMissing,
  className,
  sx,
  component,
  slots,
  slotProps,
}: TourProps) {
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const [step = 0, requestStepChange] = useControlledState<number>(stepProp, defaultStep, onStepChange);
  const count = steps.length;
  const index = count === 0 ? 0 : Math.min(Math.max(step, 0), count - 1);
  const current = count > 0 ? steps[index] : undefined;
  const copy = useMemo(() => mergeLabels(labels), [labels]);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current && stepProp === undefined) requestStepChange(defaultStep);
    wasOpen.current = open;
  }, [open, stepProp, defaultStep, requestStepChange]);

  useEffect(() => {
    if (open) {
      const target = current ? resolveTarget(current.target) : null;
      restoreFocus.current = target instanceof HTMLElement
        ? target
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      return;
    }
    const restore = restoreFocus.current;
    restoreFocus.current = null;
    if (restore?.isConnected) restore.focus({ preventScroll: true });
    // The target is captured when the tour opens; step changes must not move focus back to the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => requestOpenChange(false), [requestOpenChange]);
  const next = useCallback(() => {
    if (!current) return;
    if (index >= count - 1) {
      onComplete?.();
      requestOpenChange(false);
      return;
    }
    requestStepChange(index + 1);
  }, [current, index, count, onComplete, requestOpenChange, requestStepChange]);
  const back = useCallback(() => {
    if (index > 0) requestStepChange(index - 1);
  }, [index, requestStepChange]);
  const skip = useCallback(() => {
    onSkip?.();
    requestOpenChange(false);
  }, [onSkip, requestOpenChange]);

  if (!open || !current) return null;
  return (
    <OverlayLayer>
      {(nodeId) => (
        <TourLayer
          nodeId={nodeId}
          current={current}
          index={index}
          count={count}
          labels={copy}
          showProgress={showProgress}
          highlight={highlight}
          autoFocus={autoFocus}
          closeOnEscape={closeOnEscape}
          scrollIntoView={scrollIntoView}
          targetTimeout={targetTimeout}
          fallback={fallback}
          onBack={back}
          onNext={next}
          onSkip={skip}
          onClose={close}
          onTargetMissing={onTargetMissing}
          className={className}
          sx={sx}
          component={component}
          slots={slots}
          slotProps={slotProps}
        />
      )}
    </OverlayLayer>
  );
}

Tour.displayName = 'Tour';
