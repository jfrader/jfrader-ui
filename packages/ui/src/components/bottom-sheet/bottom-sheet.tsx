'use client';

// Modal dialog with an expanded-state button: Up/Down select adjacent detents, Home/End
// select tallest/smallest, and Enter/Space toggle the extremes. Body PageDown/Space expands
// before reading. Escape cancels a drag first, then dismisses the topmost shared overlay.
// The panel rises from below the viewport to the selected detent after showModal() and sinks
// back before the native close (the sheet stays modal until then); reduced motion is instant.
// The shell clips instead of hiding overflow, so showModal()'s focus scroll cannot pull the
// offscreen panel into view. Detents are stable fractions and each state axis has one owner.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
  type PointerEvent,
  type RefObject,
  type SyntheticEvent,
  type KeyboardEvent,
} from 'react';
import { useFloating, useFloatingTree, useInteractions, useMergeRefs } from '@floating-ui/react';
import { getDeepestNode } from '@floating-ui/react/utils';
import {
  animate,
  MotionConfig,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { modalShellReset } from '../../styling/surface';
import type { DrawerPanelProps } from '../drawer';
import { SurfaceRoot } from '../surface/surface-root';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import {
  omitNativeOpen,
  useNativeDialog,
  useNativeDialogRoot,
  type NativeDialogController,
  type NativeDialogTransition,
} from '../../overlay/use-native-dialog';
import { PRESENCE_SPRING } from '../../overlay/presence-spring';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export interface BottomSheetBaseProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Nonempty ascending unique fractions in (0, 1]. Numeric contents require remount to change. */
  detents?: readonly number[];
  value?: number;
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  locale?: Intl.LocalesArgument;
  getValueText?: (fraction: number, index: number) => string;
}
export interface BottomSheetTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface BottomSheetContentProps
  extends Omit<ComponentPropsWithRef<'dialog'>, 'open'>, SxProps {
  /** Set false to keep structured content out of the bottom sheet's accessible description. */
  withDescription?: boolean;
}
export interface BottomSheetPanelProps extends DrawerPanelProps {
  /** Inherit appearance by default; `contrast` establishes fixed charcoal. */
  appearance?: DrawerPanelProps['appearance'];
}
export interface BottomSheetHeaderProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface BottomSheetBodyProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface BottomSheetFooterProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface BottomSheetTitleProps extends ComponentPropsWithRef<'h2'>, SxProps {}
export interface BottomSheetDescriptionProps extends ComponentPropsWithRef<'p'>, SxProps {}
export interface BottomSheetHandleProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface BottomSheetCloseProps extends ComponentPropsWithRef<'button'>, SxProps {}

type GeneratedPartProps<Props> = Omit<Props, 'children'> & Pick<DrawerPanelProps, `data-${string}`>;

export interface BottomSheetSlotProps {
  trigger?: GeneratedPartProps<BottomSheetTriggerProps>;
  content?: GeneratedPartProps<BottomSheetContentProps>;
  panel?: GeneratedPartProps<BottomSheetPanelProps>;
  header?: GeneratedPartProps<BottomSheetHeaderProps>;
  handle?: GeneratedPartProps<BottomSheetHandleProps>;
  title?: GeneratedPartProps<BottomSheetTitleProps>;
  description?: GeneratedPartProps<BottomSheetDescriptionProps>;
  close?: GeneratedPartProps<BottomSheetCloseProps>;
  body?: GeneratedPartProps<BottomSheetBodyProps>;
}

export interface BottomSheetCompoundProps extends BottomSheetBaseProps {
  children?: ReactNode;
  triggerLabel?: never;
  title?: never;
  description?: never;
  content?: never;
  closeLabel?: never;
  slotProps?: never;
}

export interface BottomSheetEasyProps extends BottomSheetBaseProps {
  /** Name the button that opens the bottom sheet. */
  triggerLabel: ReactNode;
  /** Name the bottom sheet with a visible heading. */
  title: ReactNode;
  /** Describe the bottom sheet below its heading. */
  description?: ReactNode;
  /** Place content inside the bottom sheet body. */
  content: ReactNode;
  /** Name the close button. */
  closeLabel: ReactNode;
  children?: never;
  slotProps?: BottomSheetSlotProps;
}

export type BottomSheetProps = BottomSheetCompoundProps | BottomSheetEasyProps;

const DEFAULT_DETENTS = [0.45, 0.92] as const;
const INLINE_CAP = '36rem';
const SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 40,
  mass: 1,
} as const;
const PROJECTION_SECONDS = 0.2;
const FLICK_VELOCITY = 320;
const SAMPLE_WINDOW_MS = 80;
const STRETCH_LIMIT = 120;
const TOUCH_SLOP = 8;
const NO_DRAG = [
  'button:not([data-ui="bottom-sheet-handle"])',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[data-ui="bottom-sheet-title"]',
  '[data-ui="bottom-sheet-description"]',
].join(', ');
const NO_TOUCH_HANDOFF =
  'button, a[href], input, select, textarea, [contenteditable]:not([contenteditable="false"])';

const shellStyle = css({
  ...modalShellReset,
  position: 'fixed',
  inset: 0,
  margin: 0,
  inlineSize: '100%',
  blockSize: '100dvh',
  maxInlineSize: 'none',
  maxBlockSize: 'none',
  overflow: 'clip',
  '&::backdrop': { backgroundColor: 'transparent' },
});
const scrimStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundColor: vars.color.scrim,
  pointerEvents: 'none',
  opacity: 'var(--sheet-scrim, 1)',
});
const panelStyle = css({
  position: 'absolute',
  insetBlockStart: 0,
  insetInline: 0,
  marginInline: 'auto',
  inlineSize: '100%',
  maxInlineSize: INLINE_CAP,
  blockSize: 'var(--sheet-height, 45dvh)',
  display: 'flex',
  flexDirection: 'column',
  minBlockSize: 0,
  borderRadius: 0,
  borderStartStartRadius: vars.radius.lg,
  borderStartEndRadius: vars.radius.lg,
  paddingBlockEnd: 'env(safe-area-inset-bottom, 0px)',
  '&:focus-visible': focusRingOutset,
});
const PANEL_MOTION_STYLE_KEYS = ['transform', '--sheet-height'] as const;
const headerStyle = css({
  flexShrink: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: vars.space[2],
  paddingInline: vars.space[6],
  paddingBlock: vars.space[2],
  '&[data-dragging]': { userSelect: 'none' },
  '& > [data-ui="bottom-sheet-handle"]': {
    gridColumn: '1 / -1',
    justifySelf: 'center',
    touchAction: 'none',
  },
  '& > [data-ui="bottom-sheet-close"]': { gridColumn: 2, gridRow: 2 },
});
const bodyStyle = css({
  flex: '1 1 auto',
  minBlockSize: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  paddingInline: vars.space[6],
  paddingBlock: vars.space[4],
  fontSize: vars.textSize.sm,
  '&:focus-visible': focusRingOutset,
});
const footerStyle = css({
  flexShrink: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  paddingInline: vars.space[6],
  paddingBlock: vars.space[4],
  borderBlockStart: `1px solid ${vars.color.border}`,
});
const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  lineHeight: vars.lineHeight.tight,
  fontWeight: vars.fontWeight.semibold,
});
const descriptionStyle = css({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
});
const controlStyle = css({
  appearance: 'none',
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[8],
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingInline: vars.space[3],
  paddingBlock: vars.space[1],
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  color: vars.color.textMuted,
  backgroundColor: 'transparent',
  font: 'inherit',
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:disabled': { cursor: 'not-allowed' },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
  [REDUCED_MOTION]: { transition: 'none' },
});
const handleStyle = css({
  '&::after': {
    content: '""',
    inlineSize: vars.space[10],
    blockSize: vars.space[1],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.borderControl,
  },
  [FORCED_COLORS]: {
    '&::after': {
      backgroundColor: 'ButtonText',
      outline: '1px solid ButtonText',
    },
  },
});
const hiddenStyle = visuallyHiddenStyle;

interface SheetContext extends NativeDialogController {
  detents: readonly number[];
  value: number;
  requestValue: (index: number) => void;
  valueText: string;
  panelId: string;
  valueTextId: string;
  titleId: string;
  descriptionId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  setHasTitle: (present: boolean) => void;
  setHasDescription: (present: boolean) => void;
  floating: ReturnType<typeof useFloating>;
  interactions: ReturnType<typeof useInteractions>;
}
interface Sample {
  position: number;
  time: number;
}
interface Drag {
  id: number;
  start: number;
  origin: number;
  samples: Sample[];
  moved: boolean;
  capture: HTMLDivElement | null;
}
type Gesture = Pick<
  ComponentPropsWithRef<'div'>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture'
>;
interface SheetSurfaceValue {
  panelRef: RefObject<HTMLDivElement | null>;
  dialogRef: RefObject<HTMLDialogElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  gesture: Gesture;
  cancelDrag: () => boolean;
  suppressClick: RefObject<boolean>;
  transition: NativeDialogTransition;
  /** The native dialog closed: park the panel below the viewport for the next entrance. */
  reset: () => void;
}
const Context = createContext<SheetContext | null>(null);
const SheetSurfaceContext = createContext<SheetSurfaceValue | null>(null);
function useSheet(part: string) {
  const context = useContext(Context);
  if (!context) throw new Error(`BottomSheet.${part} must be rendered inside <BottomSheet>.`);
  return context;
}
function validateDetents(detents: readonly number[]) {
  if (
    !detents.length ||
    detents.some(
      (n, i) => !Number.isFinite(n) || n <= 0 || n > 1 || (i > 0 && n <= detents[i - 1]!),
    )
  ) {
    throw new Error(
      'BottomSheet.detents must be nonempty, finite, strictly ascending unique fractions in (0, 1].',
    );
  }
}
function SheetRoot(props: BottomSheetProps & { nodeId?: string }) {
  const {
    nodeId,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    detents = DEFAULT_DETENTS,
    value: valueProp,
    defaultValue = 0,
    onValueChange,
    locale,
    getValueText,
  } = props;
  validateDetents(detents);
  const originalDetents = useRef([...detents]);
  if (
    detents.length !== originalDetents.current.length ||
    detents.some((n, i) => n !== originalDetents.current[i])
  )
    throw new Error('BottomSheet.detents numeric contents require remount to change.');
  const [value = 0, requestValue] = useControlledState(valueProp, defaultValue, onValueChange);
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value >= detents.length ||
    !Number.isInteger(defaultValue) ||
    defaultValue < 0 ||
    defaultValue >= detents.length
  )
    throw new Error('BottomSheet value/defaultValue must be valid detent indices.');
  const [open = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const native = useNativeDialogRoot(open, requestOpen);
  const [dialogElement, setNativeElement] = useState<HTMLDialogElement | null>(null);
  const [nativeOpen, setNativeOpen] = useState(false);
  const registerDialog = useCallback(
    (element: HTMLDialogElement | null) => {
      native.setDialogElement(element);
      setNativeElement(element);
    },
    [native.setDialogElement],
  );
  useEffect(() => {
    const update = () => setNativeOpen(dialogElement?.open ?? false);
    update();
    if (!dialogElement) return;
    const Observer = dialogElement.ownerDocument.defaultView?.MutationObserver;
    if (!Observer) return;
    const observer = new Observer(update);
    observer.observe(dialogElement, { attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, [dialogElement]);
  const floating = useFloating({
    nodeId,
    open: open && nativeOpen,
    onOpenChange: (next) => (next ? native.setOpen(true) : native.requestClose()),
  });
  const dismiss = useLayerDismiss(floating.context, 'container');
  const interactions = useInteractions(dismiss);
  const id = useId();
  const [hasTitle, setHasTitle] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);
  const valueText = useMemo(() => {
    const fraction = originalDetents.current[value]!;
    return (
      getValueText?.(fraction, value) ??
      new Intl.NumberFormat(locale, { style: 'percent' }).format(fraction)
    );
  }, [getValueText, locale, value]);
  const context = useMemo(
    () => ({
      ...native,
      setDialogElement: registerDialog,
      open,
      detents: originalDetents.current,
      value,
      requestValue,
      valueText,
      panelId: `${id}-panel`,
      valueTextId: `${id}-value`,
      titleId: `${id}-title`,
      descriptionId: `${id}-description`,
      hasTitle,
      hasDescription,
      setHasTitle,
      setHasDescription,
      floating,
      interactions,
    }),
    [
      native.setOpen,
      native.requestClose,
      native.repairToken,
      registerDialog,
      open,
      value,
      requestValue,
      valueText,
      id,
      hasTitle,
      hasDescription,
      floating,
      interactions,
    ],
  );
  return (
    <Context.Provider value={context}>
      {'content' in props ? (
        <>
          <BottomSheetTrigger {...props.slotProps?.trigger}>{props.triggerLabel}</BottomSheetTrigger>
          <BottomSheetContent {...props.slotProps?.content}>
            <BottomSheetPanel {...props.slotProps?.panel}>
              <BottomSheetHeader {...props.slotProps?.header}>
                <BottomSheetHandle
                  aria-labelledby={props.slotProps?.handle?.['aria-label'] === undefined ? context.titleId : undefined}
                  {...props.slotProps?.handle}
                />
                <BottomSheetTitle {...props.slotProps?.title}>{props.title}</BottomSheetTitle>
                {isRenderable(props.description) && (
                  <BottomSheetDescription {...props.slotProps?.description}>
                    {props.description}
                  </BottomSheetDescription>
                )}
                <BottomSheetClose {...props.slotProps?.close}>{props.closeLabel}</BottomSheetClose>
              </BottomSheetHeader>
              <BottomSheetBody {...props.slotProps?.body}>{props.content}</BottomSheetBody>
            </BottomSheetPanel>
          </BottomSheetContent>
        </>
      ) : (
        props.children
      )}
    </Context.Provider>
  );
}
function BottomSheetRoot(props: BottomSheetProps) {
  return (
    <MotionConfig reducedMotion="user">
      <OverlayLayer>{(nodeId) => <SheetRoot {...props} nodeId={nodeId} />}</OverlayLayer>
    </MotionConfig>
  );
}
BottomSheetRoot.displayName = 'BottomSheet';

function BottomSheetTrigger({ ref, onClick, className, sx, ...props }: BottomSheetTriggerProps) {
  const context = useSheet('Trigger');
  const mergedRef = useMergeRefs([ref, context.floating.refs.setReference]);
  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...props}
          ref={mergedRef}
          data-ui="bottom-sheet-trigger"
          aria-haspopup="dialog"
          aria-expanded={context.open}
          className={className}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) context.setOpen(true);
          }}
        />
      )}
    </WithSx>
  );
}
BottomSheetTrigger.displayName = 'BottomSheet.Trigger';

function useSheetSurface(context: SheetContext, dialogRef: RefObject<HTMLDialogElement | null>) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useRef(0);
  const safeInset = useRef(0);
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const reduced = useReducedMotion();
  const latest = useRef({ context, reduced });
  latest.current = { context, reduced };
  // The exit owns `y` until the native close; detent changes and drags wait for the next open.
  const exiting = useRef(false);
  const acceptedY = () =>
    height.current * (1 - latest.current.context.detents[latest.current.context.value]!);
  // Shown: the accepted detent. Closed: just below the viewport, where the entrance starts.
  const restingY = () => (dialogRef.current?.open ? acceptedY() : height.current);
  const settle = useCallback(
    (spring: typeof SPRING | typeof PRESENCE_SPRING = SPRING) => {
      if (exiting.current) return;
      animation.current?.stop();
      if (latest.current.reduced || !dialogRef.current?.open) y.set(restingY());
      else animation.current = animate(y, acceptedY(), spring);
    },
    [y, dialogRef],
  );
  const cancelDrag = useCallback(() => {
    const session = drag.current;
    if (!session) return false;
    drag.current = null;
    session.capture?.removeAttribute('data-dragging');
    if (session.capture?.hasPointerCapture(session.id))
      session.capture.releasePointerCapture(session.id);
    suppressClick.current = true;
    settle();
    return true;
  }, [settle]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const win = dialog?.ownerDocument.defaultView;
    if (!dialog || !panel || !win) return;
    const draw = (position: number) => {
      panel.style.transform = `translateY(${position}px)`;
      panel.style.setProperty(
        '--sheet-height',
        `${Math.max(0, height.current - position) + safeInset.current}px`,
      );
      dialog.style.setProperty(
        '--sheet-scrim',
        String(Math.min(1, Math.max(0, (height.current - position) / Math.max(1, height.current)))),
      );
    };
    const measure = () => {
      const viewport = win.visualViewport;
      cancelDrag();
      const viewportHeight = viewport?.height ?? win.innerHeight;
      safeInset.current = Number.parseFloat(win.getComputedStyle(panel).paddingBottom) || 0;
      height.current = Math.max(1, viewportHeight - safeInset.current);
      dialog.style.blockSize = `${viewportHeight}px`;
      dialog.style.insetBlockStart = `${viewport?.offsetTop ?? 0}px`;
      if (!exiting.current) {
        animation.current?.stop();
        drag.current = null;
        y.set(restingY());
      }
      draw(y.get());
    };
    measure();
    const off = y.on('change', draw);
    const anotherPointer = (event: globalThis.PointerEvent) => {
      if (drag.current && drag.current.id !== event.pointerId) cancelDrag();
    };
    win.addEventListener('pointerdown', anotherPointer, true);
    win.addEventListener('resize', measure);
    win.visualViewport?.addEventListener('resize', measure);
    win.visualViewport?.addEventListener('scroll', measure);
    return () => {
      off();
      animation.current?.stop();
      const session = drag.current;
      drag.current = null;
      session?.capture?.removeAttribute('data-dragging');
      if (session?.capture?.hasPointerCapture(session.id))
        session.capture.releasePointerCapture(session.id);
      win.removeEventListener('pointerdown', anotherPointer, true);
      win.removeEventListener('resize', measure);
      win.visualViewport?.removeEventListener('resize', measure);
      win.visualViewport?.removeEventListener('scroll', measure);
    };
  }, [dialogRef, y, cancelDrag]);
  useEffect(() => {
    cancelDrag();
    settle();
  }, [context.value, settle, reduced, cancelDrag]);
  const transition = useMemo(
    (): NativeDialogTransition => ({
      enter: () => {
        exiting.current = false;
        settle(PRESENCE_SPRING);
      },
      exit: () => {
        cancelDrag();
        if (latest.current.reduced) return undefined;
        exiting.current = true;
        animation.current?.stop();
        animation.current = animate(y, height.current, PRESENCE_SPRING);
        return animation.current.finished;
      },
    }),
    [settle, cancelDrag, y],
  );
  const reset = useCallback(() => {
    exiting.current = false;
    animation.current?.stop();
    animation.current = null;
    y.set(height.current);
  }, [y]);
  const begin = (
    id: number,
    position: number,
    time: number,
    capture: HTMLDivElement | null = null,
  ) => {
    if (exiting.current) return;
    animation.current?.stop();
    suppressClick.current = false;
    capture?.setAttribute('data-dragging', '');
    drag.current = {
      id,
      start: position,
      origin: y.get(),
      samples: [{ position, time }],
      moved: false,
      capture,
    };
  };
  const move = (position: number, time: number) => {
    const session = drag.current;
    if (!session) return;
    const travel = position - session.start;
    session.moved ||= Math.abs(travel) > TOUCH_SLOP;
    const raw = session.origin + travel;
    const top = height.current * (1 - latest.current.context.detents.at(-1)!);
    const over = top - raw;
    y.set(
      raw < top
        ? latest.current.reduced
          ? top
          : top - (STRETCH_LIMIT * over) / (STRETCH_LIMIT + over)
        : raw,
    );
    session.samples = [...session.samples, { position, time }].filter(
      (sample) => time - sample.time <= SAMPLE_WINDOW_MS,
    );
  };
  const release = (position: number, time: number) => {
    const session = drag.current;
    if (!session) return;
    drag.current = null;
    session.capture?.removeAttribute('data-dragging');
    suppressClick.current = session.moved;
    const samples = [...session.samples, { position, time }].filter(
      (sample) => time - sample.time <= SAMPLE_WINDOW_MS,
    );
    const first = samples[0];
    const elapsed = first ? (time - first.time) / 1000 : 0;
    const velocity = first && elapsed > 0 ? (position - first.position) / elapsed : 0;
    const projected = y.get() + velocity * PROJECTION_SECONDS;
    const { detents, requestClose, requestValue } = latest.current.context;
    const smallestHeight = height.current * detents[0]!;
    const closeBoundary = height.current - smallestHeight / 2;
    if (
      session.moved &&
      (projected > closeBoundary ||
        (velocity >= FLICK_VELOCITY && y.get() > height.current * (1 - detents[0]!)))
    )
      requestClose();
    else if (session.moved) {
      const nearest = detents.reduce(
        (best, fraction, index) =>
          Math.abs(height.current * (1 - fraction) - projected) <
          Math.abs(height.current * (1 - detents[best]!) - projected)
            ? index
            : best,
        0,
      );
      requestValue(nearest);
    }
    settle();
  };
  const gesture: Gesture = {
    onPointerDown: (event) => {
      if (drag.current || !event.isPrimary) {
        cancelDrag();
        return;
      }
      if (
        event.button !== 0 ||
        event.defaultPrevented ||
        (event.target as Element).closest(NO_DRAG)
      )
        return;
      begin(event.pointerId, event.clientY, event.timeStamp, event.currentTarget);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      if (drag.current?.id === event.pointerId) move(event.clientY, event.timeStamp);
    },
    onPointerUp: (event) => {
      if (drag.current?.id !== event.pointerId) return;
      release(event.clientY, event.timeStamp);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: (event) => {
      if (drag.current?.id === event.pointerId) cancelDrag();
    },
    onLostPointerCapture: (event) => {
      if (drag.current?.id === event.pointerId) cancelDrag();
    },
  };
  useEffect(() => {
    const body = bodyRef.current;
    const win = body?.ownerDocument.defaultView;
    if (!body || !win) return;
    let start: { x: number; y: number; id: number; target: Element } | null = null;
    let active = false;
    const cleanupMove = () => {
      body.removeEventListener('touchmove', handoff);
      active = false;
    };
    const handoff = (event: TouchEvent) => {
      if (!start || event.touches.length !== 1) {
        cancelDrag();
        cleanupMove();
        return;
      }
      const touch = event.touches[0]!;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        cleanupMove();
        start = null;
        return;
      }
      if (Math.abs(dy) < TOUCH_SLOP) return;
      if (drag.current) {
        if (event.cancelable) event.preventDefault();
        move(touch.clientY, event.timeStamp);
        return;
      }
      const c = latest.current.context;
      if (c.value < c.detents.length - 1) {
        c.requestValue(c.detents.length - 1);
        cleanupMove();
        return;
      }
      if (dy > 0 && body.scrollTop <= 0) {
        begin(start.id, start.y, event.timeStamp);
        if (event.cancelable) event.preventDefault();
        move(touch.clientY, event.timeStamp);
      }
    };
    const startTouch = (event: TouchEvent) => {
      cleanupMove();
      if (event.touches.length !== 1) {
        cancelDrag();
        return;
      }
      const target = event.target as Element;
      if (target.closest(NO_TOUCH_HANDOFF) || win.getSelection()?.toString()) return;
      for (let node = target; node && node !== body; node = node.parentElement!) {
        const style = win.getComputedStyle(node);
        if (
          (node.scrollWidth > node.clientWidth && /auto|scroll/.test(style.overflowX)) ||
          (node.scrollHeight > node.clientHeight && /auto|scroll/.test(style.overflowY))
        )
          return;
      }
      const touch = event.touches[0]!;
      start = {
        x: touch.clientX,
        y: touch.clientY,
        id: touch.identifier,
        target,
      };
      body.addEventListener('touchmove', handoff, { passive: false });
      active = true;
    };
    const end = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (drag.current && touch) release(touch.clientY, event.timeStamp);
      cleanupMove();
      start = null;
    };
    const cancel = () => {
      cancelDrag();
      cleanupMove();
      start = null;
    };
    body.addEventListener('touchstart', startTouch, { passive: true });
    body.addEventListener('touchend', end);
    body.addEventListener('touchcancel', cancel);
    return () => {
      if (active) cleanupMove();
      body.removeEventListener('touchstart', startTouch);
      body.removeEventListener('touchend', end);
      body.removeEventListener('touchcancel', cancel);
    };
  }, [cancelDrag]);
  return { panelRef, dialogRef, bodyRef, gesture, cancelDrag, suppressClick, transition, reset };
}

function BottomSheetContent({ ref, sx, className, ...props }: BottomSheetContentProps) {
  const {
    children,
    withDescription = true,
    onCancel,
    onClose,
    onClick,
    onKeyDownCapture,
    onPointerDownCapture,
    'aria-labelledby': labelled,
    'aria-describedby': described,
    ...rest
  } = omitNativeOpen(props);
  const context = useSheet('Content');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const surface = useSheetSurface(context, dialogRef);
  const tree = useFloatingTree();
  const childPress = useRef(false);
  const native = useNativeDialog(
    context,
    {
      onCancel,
      onClick: (event) => {
        onClick?.(event);
        if (childPress.current) {
          childPress.current = false;
          event.preventDefault();
        }
      },
      onClose: (event) => {
        surface.reset();
        onClose?.(event);
      },
    },
    ref,
    dialogRef,
    surface.transition,
  );
  const mergedRef = useMergeRefs([native.ref, context.floating.refs.setFloating]);
  const previousValue = useRef(context.value);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (previousValue.current !== context.value) {
      previousValue.current = context.value;
      setAnnouncement(context.valueText);
    }
  }, [context.value, context.valueText]);
  const dialogProps = {
    ...rest,
    ...native,
    onCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) native.onCancel(event);
      else onCancel?.(event);
    },
    onClose: (event: SyntheticEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) native.onClose(event);
      else onClose?.(event);
    },
    onPointerDownCapture: (event: PointerEvent<HTMLDialogElement>) => {
      onPointerDownCapture?.(event);
      const deepest =
        tree && getDeepestNode(tree.nodesRef.current, context.floating.context.nodeId);
      childPress.current = Boolean(deepest && deepest.id !== context.floating.context.nodeId);
    },
    // Escape never reaches the native cancel key path: capture prevents it and the floating
    // useDismiss routes it to requestClose(), whose native cancelable `cancel` still lets a
    // consumer veto. Only the topmost layer reacts, and an active drag consumes Escape first.
    onKeyDownCapture: (event: KeyboardEvent<HTMLDialogElement>) => {
      onKeyDownCapture?.(event);
      if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
      event.preventDefault();
      const deepest =
        tree && getDeepestNode(tree.nodesRef.current, context.floating.context.nodeId);
      if ((!deepest || deepest.id === context.floating.context.nodeId) && surface.cancelDrag())
        event.stopPropagation();
    },
  };
  const floatingProps = context.interactions.getFloatingProps(dialogProps);
  return (
    <WithSx className={className} styles={shellStyle} sx={sx}>
      {(className) => (
        <dialog
          {...floatingProps}
          ref={mergedRef}
          className={className}
          data-ui="bottom-sheet"
          aria-modal="true"
          aria-labelledby={
            [labelled, context.hasTitle && context.titleId].filter(Boolean).join(' ') || undefined
          }
          aria-describedby={
            [described, withDescription && context.hasDescription && context.descriptionId]
              .filter(Boolean)
              .join(' ') || undefined
          }
        >
          <div css={scrimStyle} aria-hidden="true" />
          <SheetSurfaceContext.Provider value={surface}>{children}</SheetSurfaceContext.Provider>
          <span css={hiddenStyle} role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </span>
          <span css={hiddenStyle} id={context.valueTextId}>
            {context.valueText}
          </span>
        </dialog>
      )}
    </WithSx>
  );
}
BottomSheetContent.displayName = 'BottomSheet.Content';

function BottomSheetPanel({
  autoFocus = true,
  ...props
}: BottomSheetPanelProps) {
  const context = useSheet('Panel');
  const surface = useContext(SheetSurfaceContext);
  if (!surface) throw new Error('BottomSheet.Panel must be rendered inside <BottomSheet.Content>.');
  const selectedAutoFocus = props.slotProps?.root?.autoFocus ?? autoFocus;
  const autofocusRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (selectedAutoFocus && node && !node.querySelector('[autofocus]'))
        node.setAttribute('autofocus', '');
    },
    [selectedAutoFocus],
  );
  const merged = useMergeRefs([surface.panelRef, autofocusRef]);
  return (
    <SurfaceRoot
      tabIndex={-1}
      {...props}
      owner="BottomSheet.Panel"
      marker="bottom-sheet-panel"
      variant="floating"
      structure={panelStyle}
      internalRef={merged}
      containerRef={surface.dialogRef}
      reservedStyleKeys={PANEL_MOTION_STYLE_KEYS}
      attributes={{ id: context.panelId }}
    />
  );
}
BottomSheetPanel.displayName = 'BottomSheet.Panel';

function BottomSheetHeader({ ref, sx, className, ...props }: BottomSheetHeaderProps) {
  useSheet('Header');
  const surface = useContext(SheetSurfaceContext);
  const gesture = Object.fromEntries(
    Object.entries(surface?.gesture ?? {}).map(([key, handler]) => [
      key,
      (event: PointerEvent<HTMLDivElement>) => {
        props[key as keyof Gesture]?.(event);
        if (!event.defaultPrevented) handler?.(event);
      },
    ]),
  ) as Gesture;
  return (
    <WithSx className={className} styles={headerStyle} sx={sx}>
      {(className) => (
        <div
          {...props}
          {...gesture}
          ref={ref}
          data-ui="bottom-sheet-header"
          className={className}
        />
      )}
    </WithSx>
  );
}
BottomSheetHeader.displayName = 'BottomSheet.Header';

function BottomSheetBody({
  ref,
  sx,
  className,
  onKeyDown,
  onFocusCapture,
  ...props
}: BottomSheetBodyProps) {
  const context = useSheet('Body');
  const surface = useContext(SheetSurfaceContext);
  const merged = useMergeRefs([ref, surface?.bodyRef]);
  const focusFrame = useRef<{ window: Window; id: number } | null>(null);
  useEffect(
    () => () => {
      const frame = focusFrame.current;
      if (frame) frame.window.cancelAnimationFrame(frame.id);
    },
    [],
  );
  return (
    <WithSx className={className} styles={bodyStyle} sx={sx}>
      {(className) => (
        <div
          {...props}
          ref={merged}
          data-ui="bottom-sheet-body"
          className={className}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (
              !event.defaultPrevented &&
              event.target === event.currentTarget &&
              (event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) &&
              context.value < context.detents.length - 1
            ) {
              event.preventDefault();
              context.requestValue(context.detents.length - 1);
            }
          }}
          onFocusCapture={(event) => {
            onFocusCapture?.(event);
            if (event.defaultPrevented || event.target === event.currentTarget) return;
            context.requestValue(context.detents.length - 1);
            const target = event.target;
            const body = event.currentTarget;
            const win = body.ownerDocument.defaultView;
            if (!win) return;
            const previous = focusFrame.current;
            if (previous) previous.window.cancelAnimationFrame(previous.id);
            focusFrame.current = {
              window: win,
              id: win.requestAnimationFrame(() => {
                focusFrame.current = null;
                if (!target.isConnected) return;
                const bounds = body.getBoundingClientRect();
                const focused = target.getBoundingClientRect();
                if (focused.top < bounds.top) body.scrollTop += focused.top - bounds.top;
                else if (focused.bottom > bounds.bottom)
                  body.scrollTop += focused.bottom - bounds.bottom;
              }),
            };
          }}
        />
      )}
    </WithSx>
  );
}
BottomSheetBody.displayName = 'BottomSheet.Body';

function BottomSheetFooter({ ref, sx, className, ...props }: BottomSheetFooterProps) {
  useSheet('Footer');
  return (
    <WithSx className={className} styles={footerStyle} sx={sx}>
      {(className) => (
        <div {...props} ref={ref} data-ui="bottom-sheet-footer" className={className} />
      )}
    </WithSx>
  );
}
BottomSheetFooter.displayName = 'BottomSheet.Footer';
function BottomSheetTitle({ ref, sx, className, children, ...props }: BottomSheetTitleProps) {
  const { titleId, setHasTitle } = useSheet('Title');
  const present = isRenderable(children) && children !== '';
  useEffect(() => {
    if (!present) return;
    setHasTitle(true);
    return () => setHasTitle(false);
  }, [present, setHasTitle]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={titleStyle} sx={sx}>
      {(className) => (
        <h2 {...props} ref={ref} id={titleId} data-ui="bottom-sheet-title" className={className}>
          {children}
        </h2>
      )}
    </WithSx>
  );
}
BottomSheetTitle.displayName = 'BottomSheet.Title';
function BottomSheetDescription({
  ref,
  sx,
  className,
  children,
  ...props
}: BottomSheetDescriptionProps) {
  const { descriptionId, setHasDescription } = useSheet('Description');
  const present = isRenderable(children) && children !== '';
  useEffect(() => {
    if (!present) return;
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [present, setHasDescription]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={descriptionStyle} sx={sx}>
      {(className) => (
        <p
          {...props}
          ref={ref}
          id={descriptionId}
          data-ui="bottom-sheet-description"
          className={className}
        >
          {children}
        </p>
      )}
    </WithSx>
  );
}
BottomSheetDescription.displayName = 'BottomSheet.Description';

function BottomSheetHandle({
  ref,
  sx,
  className,
  onClick,
  onKeyDown,
  'aria-describedby': described,
  ...props
}: BottomSheetHandleProps) {
  const context = useSheet('Handle');
  const surface = useContext(SheetSurfaceContext);
  const last = context.detents.length - 1;
  return (
    <WithSx className={className} styles={[controlStyle, handleStyle]} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...props}
          ref={ref}
          disabled={props.disabled || last === 0}
          className={className}
          data-ui="bottom-sheet-handle"
          aria-controls={context.panelId}
          aria-expanded={context.value === last}
          aria-describedby={[described, context.valueTextId].filter(Boolean).join(' ')}
          onClick={(event) => {
            onClick?.(event);
            if (surface?.suppressClick.current) {
              surface.suppressClick.current = false;
              return;
            }
            if (!event.defaultPrevented) context.requestValue(context.value === last ? 0 : last);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            if ((event.key === 'Enter' || event.key === ' ') && surface)
              surface.suppressClick.current = false;
            const destinations: Record<string, number> = {
              ArrowUp: Math.min(last, context.value + 1),
              ArrowDown: Math.max(0, context.value - 1),
              Home: last,
              End: 0,
            };
            const destination = destinations[event.key];
            if (destination !== undefined) {
              event.preventDefault();
              context.requestValue(destination);
            }
          }}
        />
      )}
    </WithSx>
  );
}
BottomSheetHandle.displayName = 'BottomSheet.Handle';
function BottomSheetClose({ ref, sx, className, onClick, ...props }: BottomSheetCloseProps) {
  const context = useSheet('Close');
  return (
    <WithSx className={className} styles={controlStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...props}
          ref={ref}
          data-ui="bottom-sheet-close"
          className={className}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) context.requestClose();
          }}
        />
      )}
    </WithSx>
  );
}
BottomSheetClose.displayName = 'BottomSheet.Close';

export const BottomSheet = Object.assign(BottomSheetRoot, {
  Trigger: BottomSheetTrigger,
  Content: BottomSheetContent,
  Panel: BottomSheetPanel,
  Header: BottomSheetHeader,
  Body: BottomSheetBody,
  Footer: BottomSheetFooter,
  Title: BottomSheetTitle,
  Description: BottomSheetDescription,
  Handle: BottomSheetHandle,
  Close: BottomSheetClose,
});
