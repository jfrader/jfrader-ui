'use client';

import {
  Children,
  Fragment,
  createContext,
  cloneElement,
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
  useFloatingTree,
} from '@floating-ui/react';
import { getDeepestNode } from '@floating-ui/react/utils';
import { vars } from '@jfrader/tokens/vars';
import { MotionConfig, motion } from 'motion/react';
import { LayerContent, MenuLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useExitPresence } from '../../overlay/exit-motion';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { requestNativeDialogClose } from '../../overlay/use-native-dialog';
import { css } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { REDUCED_MOTION } from '../../styling/media';
import { enterTransition, exitTransition } from '../../styling/overlay-motion';
import { listboxSurfaceStyle } from '../../styling/listbox-style';
import { focusRingInset } from '../../styling/focus-ring';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { Button, type ButtonProps } from '../button';
import { BottomSheet, type BottomSheetContentProps } from '../bottom-sheet';
import { consumerHandlersFirst, restoreTriggerFocus } from '../menu/menu';

export interface MorphRootProps {
  /** Chooses an anchored popover or modal bottom sheet. Defaults to `"popover"`. */
  variant?: 'popover' | 'sheet';
  /** Controls whether the surface is open. */
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
  /** Composes the trigger and surface. */
  children: ReactNode;
}
export interface MorphTriggerProps extends ButtonProps {
  /** Adds a marker to the trigger button. */
  'data-ui'?: string;
  /** Replaces the trigger with an adapter that forwards Button props and ref. */
  component?: ComponentType<ButtonProps>;
}
export interface MorphSurfaceProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Adds a marker to the surface. */
  'data-ui'?: string;
  /** Names the surface. */
  label: string;
  /** Sets popover widths for every step or by step id. Defaults to `"16rem"`. */
  width?: string | Record<string, string>;
  /** Replaces the surface div with an adapter that forwards props and ref. */
  component?: ComponentType<ComponentPropsWithRef<'div'> & SxProps>;
}
export interface MorphStepProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Adds a marker to the step container. */
  'data-ui'?: string;
  /** Identifies this step within the root. */
  id: string;
  /** Overrides the popover width for this step. */
  width?: string;
  /** Sets the sheet height as a visual viewport fraction in (0, 1]. Defaults to `1`. */
  detent?: number;
  /** Returns to the previously active step on Escape instead of closing. Defaults to `false`. */
  back?: boolean;
}

const DEFAULT_WIDTH = '16rem';
const COLLAPSED_SCALE = '0.2';
const SHAPE_SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const;
const surfaceStyle = css({
  transitionProperty: 'opacity, scale',
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
const sheetSurfaceStyle = css({ minBlockSize: 0, overflowY: 'auto', padding: vars.space[3] });

function MorphElement({
  component: Component = 'div',
  nativeProps,
  ...props
}: ComponentPropsWithRef<'div'> & {
  component?: MorphSurfaceProps['component'] | 'div';
  nativeProps: ComponentPropsWithRef<'div'>;
}) {
  return <Component {...nativeProps} {...props} style={{ ...nativeProps.style, ...props.style }} />;
}
const MotionElement = motion.create(MorphElement);

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
  variant: 'popover' | 'sheet';
  open: boolean;
  step: string | undefined;
  requestOpen: (open: boolean) => void;
  requestStep: (step: string) => void;
  floating: Floating;
  nodeId: string | undefined;
  getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps'];
  getFloatingProps: ReturnType<typeof useInteractions>['getFloatingProps'];
  backEnabled: { current: boolean };
  requestBack: () => boolean;
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
  variant = 'popover',
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
  function requestBack() {
    if (!backEnabled.current || !history.current.length) return false;
    requestStep(history.current.at(-1)!);
    return true;
  }
  const floating = useOverlayFloating({
    open: variant === 'popover' && open,
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
      if (!next && reason === 'escape-key' && requestBack()) return;
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
    if (variant === 'sheet') return;
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
  }, [open, floating.refs, variant]);
  const value = useMemo(
    () => ({
      open,
      variant,
      step,
      requestOpen,
      requestStep,
      floating,
      nodeId,
      getReferenceProps,
      getFloatingProps,
      backEnabled,
      requestBack,
      presence,
    }),
    [open, variant, step, requestStep, floating, nodeId, getReferenceProps, getFloatingProps, presence],
  );
  return (
    <MorphContext.Provider value={value}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </MorphContext.Provider>
  );
}

function MorphRoot(props: MorphRootProps) {
  if (props.variant === 'sheet') return <MorphControl {...props} nodeId={undefined} />;
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
  const { floating, getReferenceProps, variant: shell, open, requestOpen } = useMorphContext();
  const mergedRef = useMergeRefs([ref, floating.refs.setReference]);
  return (
    <Trigger
      {...(shell === 'popover' ? consumerHandlersFirst(props, getReferenceProps) : props)}
      {...(shell === 'sheet'
        ? {
            'aria-haspopup': 'dialog' as const,
            'aria-expanded': open,
            onClick: (event: Parameters<NonNullable<ButtonProps['onClick']>>[0]) => {
              props.onClick?.(event);
              if (!event.defaultPrevented) requestOpen(!open);
            },
          }
        : {})}
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
  const reduce = useReducedMotion();
  const { open, step, floating, nodeId, getFloatingProps, backEnabled, presence, variant } =
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
  const vertical = side === 'top' || side === 'bottom';
  const originX = vertical ? inline : side === 'left' ? 1 : 0;
  const originY = vertical ? (side === 'top' ? 1 : 0) : edge;
  if (variant === 'sheet')
    return (
      <MorphSheetSurface
        {...props}
        label={label}
        component={component}
        ref={ref}
        className={className}
        sx={sx}
        style={style}
        direction={direction}
        steps={steps}
        active={active}
      />
    );
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
            <MotionElement
              component={component}
              nativeProps={getFloatingProps(props)}
              layout={reduce ? false : 'size'}
              initial={false}
              transition={SHAPE_SPRING}
              ref={mergedRef}
              className={resolved}
              style={{ ...style, ...floating.floatingStyles, inlineSize, originX, originY }}
              role={props.role ?? 'dialog'}
              aria-label={props['aria-label'] ?? label}
              dir={direction}
              data-placement={floating.placement}
              data-state={presence.closing ? 'closing' : 'open'}
              data-ui={props['data-ui'] ?? 'morph-surface'}
              inert={presence.closing || undefined}
              aria-hidden={presence.closing || undefined}
            >
              <LayerContent nodeId={nodeId}>
                {active && cloneElement(active, { key: 'active' })}
              </LayerContent>
            </MotionElement>
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

function MorphSheetSurface({
  label, component, className, sx, style, ref, steps, active, direction, ...props
}: Omit<MorphSurfaceProps, 'children'> & {
  steps: ReactElement<MorphStepProps>[];
  active: ReactElement<MorphStepProps> | undefined;
  direction: 'ltr' | 'rtl';
}) {
  const { open, requestOpen, floating } = useMorphContext();
  const detents = [...new Set(steps.map((item) => item.props.detent ?? 1))].sort((a, b) => a - b);
  if (!detents.length) detents.push(1);
  const selected = Math.max(0, detents.indexOf(active?.props.detent ?? 1));
  const [selection, setSelection] = useState({ step: active?.props.id, index: selected });
  if (selection.step !== active?.props.id) setSelection({ step: active?.props.id, index: selected });
  const index = selection.step === active?.props.id ? selection.index : selected;
  return (
    <BottomSheet
      key={detents.join(',')}
      open={open}
      onOpenChange={requestOpen}
      detents={detents}
      value={index}
      onValueChange={(next) => setSelection({ step: active?.props.id, index: next })}
    >
      <MorphSheetContent
        aria-label={props['aria-label'] ?? label}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={props['aria-describedby']}
        withDescription={false}
        onClose={(event) => {
          if (event.target === event.currentTarget)
            restoreTriggerFocus(floating.refs.domReference.current);
        }}
      >
        <BottomSheet.Panel autoFocus={false}>
          <BottomSheet.Header>
            <BottomSheet.Handle aria-label={label} />
          </BottomSheet.Header>
          <WithSx className={className} styles={sheetSurfaceStyle} sx={sx}>
            {(resolved) => {
              const Surface = component ?? 'div';
              return (
                <Surface
                  {...props}
                  ref={ref}
                  className={resolved}
                  style={style}
                  dir={direction}
                  data-ui={props['data-ui'] ?? 'morph-surface'}
                  data-variant="sheet"
                >
                  {active}
                </Surface>
              );
            }}
          </WithSx>
        </BottomSheet.Panel>
      </MorphSheetContent>
    </BottomSheet>
  );
}

function MorphSheetContent(props: BottomSheetContentProps) {
  const { requestBack } = useMorphContext();
  const tree = useFloatingTree();
  return (
    <BottomSheet.Content
      {...props}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
        const dialog = (event.target as Element).closest('dialog');
        if (dialog && dialog !== event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          requestNativeDialogClose(dialog, () => dialog.close());
          return;
        }
        const own = tree?.nodesRef.current.find(
          (node) => node.context?.refs.floating.current === event.currentTarget,
        );
        const deepest = own && tree && getDeepestNode(tree.nodesRef.current, own.id);
        if ((!deepest || deepest.id === own?.id) && requestBack()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    />
  );
}

function MorphStep({
  id,
  width: _width,
  detent: _detent,
  back: _back,
  ref,
  className,
  sx,
  children,
  ...props
}: MorphStepProps) {
  const { open, step, variant } = useMorphContext();
  const reduce = useReducedMotion();
  const localRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([ref, localRef]);
  useLayoutEffect(() => {
    const node = localRef.current;
    if (!open || !node) return;
    let canceled = false;
    const focus = () => queueMicrotask(() => {
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
    const dialog = variant === 'sheet' ? node.closest('dialog') : null;
    const observer = dialog
      ? new MutationObserver(() => { if (dialog.open) focus(); })
      : undefined;
    if (dialog) observer?.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    if (!dialog || dialog.open) focus();
    return () => {
      canceled = true;
      observer?.disconnect();
    };
  }, [open, step, id, variant]);
  return (
    <WithSx className={className} styles={[stepStyle]} sx={sx}>
      {(resolved) => (
        <MotionElement
          nativeProps={props}
          layout={variant === 'popover' && !reduce ? 'size' : false}
          transition={SHAPE_SPRING}
          ref={mergedRef}
          className={resolved}
          data-step={id}
          data-ui={props['data-ui'] ?? 'morph-step'}
        >
          <Fragment key={id}>{children}</Fragment>
        </MotionElement>
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
