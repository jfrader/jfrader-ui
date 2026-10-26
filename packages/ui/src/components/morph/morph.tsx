'use client';

import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  FloatingFocusManager,
  useClick,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { LayerContent, MenuLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useExitPresence } from '../../overlay/exit-motion';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { css } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { REDUCED_MOTION } from '../../styling/media';
import { enterTransition, exitTransition } from '../../styling/overlay-motion';
import { listboxSurfaceStyle } from '../../styling/listbox-style';
import { focusRingInset } from '../../styling/focus-ring';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';
import { consumerHandlersFirst, restoreTriggerFocus } from '../menu/menu';

export interface MorphRootProps {
  /** Controls whether the floating surface is open. */
  open?: boolean;
  /** Opens the uncontrolled surface initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receives requests to open or close the surface. */
  onOpenChange?: (open: boolean) => void;
  /** Controls the active step id. */
  step?: string;
  /** Selects the initial uncontrolled step. Defaults to the first step. */
  defaultStep?: string;
  /** Receives requests to change the active step. */
  onStepChange?: (step: string) => void;
  /** Aligns the surface above the trigger's logical edge. Defaults to `"end"`. */
  corner?: 'start' | 'end';
  /** Composes the trigger and floating surface. */
  children: ReactNode;
}
export interface MorphTriggerProps extends ButtonProps {
  /** Adds a marker to the trigger button. */
  'data-ui'?: string;
  /** Replaces the trigger with an adapter that forwards Button props and ref. */
  component?: ComponentType<ButtonProps>;
}
export interface MorphSurfaceProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Adds a marker to the floating surface. */
  'data-ui'?: string;
  /** Names the floating surface. */
  label: string;
  /** Sets every step's width or maps step ids to widths. Defaults to `"16rem"`. */
  width?: string | Record<string, string>;
  /** Replaces the surface div with an adapter that forwards props and ref. */
  component?: ComponentType<ComponentPropsWithRef<'div'> & SxProps>;
}
export interface MorphStepProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Adds a marker to the step container. */
  'data-ui'?: string;
  /** Identifies this step within the root. */
  id: string;
  /** Overrides the surface width for this step. */
  width?: string;
  /** Returns to the previously active step on Escape instead of closing. Defaults to `false`. */
  back?: boolean;
}

const DEFAULT_WIDTH = '16rem';
const COLLAPSED_SCALE = '0.2';
const surfaceStyle = css({
  transitionProperty: 'opacity, scale, inline-size',
  ...enterTransition,
  '@starting-style': { opacity: 0, scale: COLLAPSED_SCALE },
  '&[data-state="closing"]': {
    opacity: 0,
    scale: COLLAPSED_SCALE,
    pointerEvents: 'none',
    ...exitTransition,
  },
  [REDUCED_MOTION]: {
    '&, &[data-state="closing"]': { transitionDuration: '0s', scale: 'none' },
    '@starting-style': { scale: 'none' },
  },
  maxInlineSize: `calc(100vw - 2 * ${vars.space[4]})`,
  padding: vars.space[3],
  borderRadius: vars.radius.lg,
  maxBlockSize: 'var(--morph-available-height)',
  overflowY: 'auto',
});
const stepStyle = css({ minInlineSize: 0, '&:focus-visible': focusRingInset });

function stepsIn(children: ReactNode): ReactElement<MorphStepProps>[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === MorphStep) return [child as ReactElement<MorphStepProps>];
    if (child.type === Fragment || child.type === MorphSurface)
      return stepsIn(child.props.children);
    return [];
  });
}

type Floating = ReturnType<typeof useOverlayFloating>;
interface MorphContextValue {
  open: boolean;
  step: string | undefined;
  requestOpen: (open: boolean) => void;
  requestStep: (step: string) => void;
  floating: Floating;
  nodeId: string | undefined;
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps'];
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps'];
  backEnabled: { current: boolean };
  presence: ReturnType<typeof useExitPresence<HTMLDivElement>>;
}
const MorphContext = createContext<MorphContextValue | null>(null);

export function useMorphContext() {
  const context = useContext(MorphContext);
  if (!context) throw new Error('Morph parts must be rendered inside <Morph.Root>.');
  return context;
}

function MorphControl({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  step: stepProp,
  defaultStep,
  onStepChange,
  corner = 'end',
  children,
  nodeId,
}: MorphRootProps & { nodeId: string | undefined }) {
  const first = stepsIn(children)[0]?.props.id;
  const [open = false, setOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const presence = useExitPresence<HTMLDivElement>(open);
  const [step, requestStep] = useControlledState(stepProp, defaultStep ?? first, onStepChange);
  const backEnabled = useRef(false);
  const history = useRef<string[]>([]);
  const previousStep = useRef(step);
  const previousOpen = useRef(open);
  const returnFocus = useRef<boolean | undefined>(undefined);
  function requestOpen(next: boolean) {
    returnFocus.current = next ? undefined : true;
    setOpen(next);
  }
  const floating = useOverlayFloating({
    open,
    nodeId,
    transform: false,
    placement: corner === 'start' ? 'top-start' : 'top-end',
    onAvailableSize: ({ height }) => {
      floating.refs.floating.current?.style.setProperty(
        '--morph-available-height',
        `${Math.max(0, height)}px`,
      );
    },
    onOpenChange(next, _event, reason) {
      if (next === open) return;
      if (!next && reason === 'escape-key' && backEnabled.current && history.current.length) {
        requestStep(history.current.at(-1)!);
        return;
      }
      returnFocus.current = next ? undefined : reason !== 'outside-press' && reason !== 'focus-out';
      setOpen(next);
    },
  });
  const click = useClick(floating.context);
  const role = useRole(floating.context, { role: 'dialog' });
  const dismiss = useLayerDismiss(floating.context, 'container');
  const { getReferenceProps, getFloatingProps } = useInteractions([click, role, ...dismiss]);
  useLayoutEffect(() => {
    if (previousStep.current !== step) {
      if (history.current.at(-1) === step) history.current.pop();
      else if (previousStep.current !== undefined) history.current.push(previousStep.current);
      previousStep.current = step;
    }
  }, [step]);
  useLayoutEffect(() => {
    if (!open && previousOpen.current && returnFocus.current !== false) {
      const surface = floating.refs.floating.current;
      const active = surface?.ownerDocument.activeElement;
      if (
        active &&
        surface?.contains(active) &&
        'blur' in active &&
        typeof active.blur === 'function'
      )
        active.blur();
      restoreTriggerFocus(floating.refs.domReference.current);
    }
    previousOpen.current = open;
    if (!open) returnFocus.current = undefined;
  }, [open, floating.refs]);
  const value = useMemo(
    () => ({
      open,
      step,
      requestOpen,
      requestStep,
      floating,
      nodeId,
      getReferenceProps,
      getFloatingProps,
      backEnabled,
      presence,
    }),
    [open, step, requestStep, floating, nodeId, getReferenceProps, getFloatingProps, presence],
  );
  return <MorphContext.Provider value={value}>{children}</MorphContext.Provider>;
}

function MorphRoot(props: MorphRootProps) {
  return <MenuLayer>{(nodeId) => <MorphControl {...props} nodeId={nodeId} />}</MenuLayer>;
}

function MorphTrigger({
  component: Trigger = Button,
  ref,
  size,
  tone,
  variant,
  ...props
}: MorphTriggerProps) {
  const { floating, getReferenceProps } = useMorphContext();
  const mergedRef = useMergeRefs([ref, floating.refs.setReference]);
  return (
    <Trigger
      {...consumerHandlersFirst(props, getReferenceProps)}
      size={size}
      tone={tone}
      variant={variant}
      ref={mergedRef}
      data-ui={props['data-ui'] ?? 'morph-trigger'}
    />
  );
}

function MorphSurface({
  label,
  width,
  component,
  children,
  ref,
  className,
  sx,
  style,
  ...props
}: MorphSurfaceProps) {
  const Surface = component ?? 'div';
  const { open, step, floating, nodeId, getFloatingProps, backEnabled, presence } =
    useMorphContext();
  const mergedRef = useMergeRefs([ref, floating.refs.setFloating, presence.ref]);
  const steps = stepsIn(children);
  const active = steps.find((item) => item.props.id === (step ?? steps[0]?.props.id));
  const inlineSize =
    active?.props.width ??
    (typeof width === 'string' ? width : width?.[active?.props.id ?? '']) ??
    DEFAULT_WIDTH;
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  useLayoutEffect(() => {
    backEnabled.current = active?.props.back ?? false;
  }, [active?.props.back, backEnabled]);
  useLayoutEffect(() => {
    const node = floating.refs.domReference.current;
    if (node)
      setDirection(
        node.ownerDocument.defaultView?.getComputedStyle(node).direction === 'rtl' ? 'rtl' : 'ltr',
      );
  }, [open, props.dir, floating.refs]);
  const [side, alignment] = floating.placement.split('-');
  const edge = alignment === 'start' ? 0 : alignment === 'end' ? 1 : 0.5;
  const inline = direction === 'rtl' ? 1 - edge : edge;
  const transformOrigin =
    side === 'top' || side === 'bottom'
      ? `${inline * 100}% ${side === 'top' ? 100 : 0}%`
      : `${side === 'left' ? 100 : 0}% ${edge * 100}%`;
  if (!presence.present) return null;
  return (
    <OverlayPortal>
      <FloatingFocusManager
        context={floating.context}
        disabled={!open}
        modal={false}
        initialFocus={-1}
        returnFocus={false}
        restoreFocus
      >
        <WithSx className={className} styles={[listboxSurfaceStyle, surfaceStyle]} sx={sx}>
          {(resolved) => (
            <Surface
              {...getFloatingProps(props)}
              ref={mergedRef}
              className={resolved}
              style={{ ...style, ...floating.floatingStyles, inlineSize, transformOrigin }}
              role={props.role ?? 'dialog'}
              aria-label={props['aria-label'] ?? label}
              dir={direction}
              data-placement={floating.placement}
              data-state={presence.closing ? 'closing' : 'open'}
              data-ui={props['data-ui'] ?? 'morph-surface'}
              inert={presence.closing || undefined}
              aria-hidden={presence.closing || undefined}
            >
              <LayerContent nodeId={nodeId}>{active}</LayerContent>
            </Surface>
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

function MorphStep({
  id,
  width: _width,
  back: _back,
  ref,
  className,
  sx,
  ...props
}: MorphStepProps) {
  const { open, step } = useMorphContext();
  const localRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([ref, localRef]);
  useLayoutEffect(() => {
    const node = localRef.current;
    if (!open || !node) return;
    let canceled = false;
    queueMicrotask(() => {
      if (canceled) return;
      const candidates = node.querySelectorAll<HTMLElement>(
        '[data-autofocus], button, input, textarea, select, a[href], area[href], summary, iframe, object, embed, audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable="false"])',
      );
      const available = Array.from(candidates).filter(
        (item) =>
          !item.matches(':disabled, [aria-disabled="true"]') &&
          !item.closest('[hidden], [inert]') &&
          item.getClientRects().length > 0,
      );
      const preferred = available.find((item) => item.hasAttribute('data-autofocus'));
      for (const target of preferred ? [preferred, ...available] : available) {
        target.focus();
        if (node.ownerDocument.activeElement === target) return;
      }
      if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
      node.focus();
    });
    return () => {
      canceled = true;
    };
  }, [open, step, id]);
  return (
    <WithSx className={className} styles={[stepStyle]} sx={sx}>
      {(resolved) => (
        <div
          {...props}
          ref={mergedRef}
          className={resolved}
          data-step={id}
          data-ui={props['data-ui'] ?? 'morph-step'}
        />
      )}
    </WithSx>
  );
}

MorphRoot.displayName = 'Morph.Root';
MorphTrigger.displayName = 'Morph.Trigger';
MorphSurface.displayName = 'Morph.Surface';
MorphStep.displayName = 'Morph.Step';
export const Morph = {
  Root: MorphRoot,
  Trigger: MorphTrigger,
  Surface: MorphSurface,
  Step: MorphStep,
};
