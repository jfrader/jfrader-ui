'use client';

// APG pattern: dialog (modal), built on native <dialog> + showModal() and anchored to one
// viewport edge. The top layer makes the rest of the page inert and contains focus; closing
// returns focus to the element that was focused before opening (normally the Trigger).
// Keyboard map: Tab/Shift+Tab cycle inside the drawer; Escape requests close (native cancel);
// Enter/Space on Trigger opens and on Close requests close.
//
// Lifecycle contract (Root owns logical `open`, Content owns native state; native form/ref
// closes reconcile, rejected requests repair on the next open, scroll locks only after
// showModal() succeeds): see `overlay/use-native-dialog.ts`. Close, backdrop and drag share
// one close request, so a consumer preventDefault on `cancel` vetoes all of them.
//
// Modal only: the native top layer cannot be clipped to a container, so there is no
// contained or nonmodal mode. Exit is immediate — the native dialog closes without an exit
// animation; the Panel animates in only after a successful open.
//
// Optional header drag (`draggable`): the primary pointer pulls the Panel toward its edge 1:1,
// opposing travel is resisted, and release either requests close (past a third of the panel or
// a fling) or springs home. Controls, links, editable content and Title/Description text never
// start a drag. Reduced motion disables the gesture; Close and Escape always remain.

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
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { animate, type AnimationPlaybackControls } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { contrastSurfaceStyle, modalShellReset, raisedSurface } from '../../styling/surface';
import { WithSx, type SxProps } from '../../styling/sx';
import { AppearanceScope, useSurfaceAppearance, type AppearanceName } from '../../styling/theme-scope';
import { triggerStyle } from '../../styling/trigger-style';
import {
  omitNativeOpen,
  requestNativeDialogClose,
  useNativeDialog,
  useNativeDialogRoot,
  type NativeDialogController,
} from '../../overlay/use-native-dialog';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type DrawerSide = 'inline-start' | 'inline-end' | 'top' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg';

export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Viewport edge the panel attaches to. Inline sides follow the drawer's effective direction. */
  side?: DrawerSide;
  /** Inline size cap for inline sides. Top/bottom panels span the viewport and ignore it. */
  size?: DrawerSize;
  /** Lets the header drag the panel toward its edge to dismiss. Ignored under reduced motion. */
  draggable?: boolean;
  children?: ReactNode;
}

export interface DrawerTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface DrawerContentProps extends Omit<ComponentPropsWithRef<'dialog'>, 'open'>, SxProps {
  /** Set false to keep structured content out of the drawer's accessible description. */
  withDescription?: boolean;
}
export interface DrawerPanelProps extends ComponentPropsWithRef<'div'>, SxProps {
  /**
   * `contrast` (default) paints the dark family for the edge surface on any page theme;
   * `default` returns to the theme's own palette.
   */
  appearance?: AppearanceName;
}
export interface DrawerHeaderProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface DrawerBodyProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface DrawerFooterProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface DrawerTitleProps extends ComponentPropsWithRef<'h2'>, SxProps {}
export interface DrawerDescriptionProps extends ComponentPropsWithRef<'p'>, SxProps {}
/** Needs visible children or a localized `aria-label`; the library ships no default label. */
export interface DrawerCloseProps extends ComponentPropsWithRef<'button'>, SxProps {}

interface DrawerContextValue extends NativeDialogController {
  side: DrawerSide;
  size: DrawerSize;
  draggable: boolean;
  titleId: string;
  descriptionId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  setHasTitle: (present: boolean) => void;
  setHasDescription: (present: boolean) => void;
}

type HeaderGestureHandlers = Pick<
  ComponentPropsWithRef<'div'>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture'
>;

/** Provided by Content: the shared close request, the panel registration and the header gesture. */
interface DrawerSurfaceValue {
  requestClose: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  headerGesture: HeaderGestureHandlers | null;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);
const DrawerSurfaceContext = createContext<DrawerSurfaceValue | null>(null);

function useDrawerContext(part: string): DrawerContextValue {
  const context = useContext(DrawerContext);
  if (!context) throw new Error(`Drawer.${part} must be rendered inside <Drawer>.`);
  return context;
}

// Gesture contract.
const DISMISS_FRACTION = 1 / 3;
const FLING_VELOCITY = 500; // px/s toward the edge
const OPPOSING_RESISTANCE = 0.2; // share of travel away from the edge that the panel follows
const VELOCITY_WINDOW_MS = 100;
const RELEASE_SPRING = { type: 'spring', stiffness: 400, damping: 40, mass: 1 } as const;
// Starting a drag here would steal a click, an edit or a text selection.
const NO_DRAG_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[data-ui~="drawer-title"]',
  '[data-ui~="drawer-description"]',
].join(', ');
// An open overlay portaled into the drawer (OverlayPortal → FloatingPortal) handles Escape first.
const NESTED_LAYER_SELECTOR = '[data-floating-ui-portal]:not(:empty)';

// Structural sizes.
const INLINE_SIZE_CAP: Record<DrawerSize, string> = { sm: '22rem', md: '30rem', lg: '38rem' };
const BLOCK_SIZE_CAP = '32rem';
const VIEWPORT_GUTTER = vars.space[3];
const COMPACT_VIEWPORT = '@media (max-width: 40rem)';
const PART_PADDING = vars.space[6];
const COMPACT_PART_PADDING = vars.space[5];
const SAFE_AREA = {
  top: 'env(safe-area-inset-top, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
} as const;

const entry = keyframes({
  from: {
    opacity: 0,
    transform: 'translate(var(--drawer-entry-x, 0), var(--drawer-entry-y, 0))',
  },
});

const dialogStyle = css({
  ...modalShellReset,
  position: 'fixed',
  inset: 0,
  margin: 0,
  inlineSize: '100%',
  blockSize: '100%',
  maxInlineSize: 'none',
  maxBlockSize: 'none',
  overflow: 'hidden',
  // The UA hides a closed dialog with display:none; only the open shell lays out.
  '&[open]': { display: 'flex' },
});

const dialogSideStyles: Record<DrawerSide, SerializedStyles> = {
  'inline-start': css({ flexDirection: 'row', justifyContent: 'flex-start' }),
  'inline-end': css({ flexDirection: 'row', justifyContent: 'flex-end' }),
  top: css({ flexDirection: 'column', justifyContent: 'flex-start' }),
  bottom: css({ flexDirection: 'column', justifyContent: 'flex-end' }),
};

const panelStyle = css({
  ...raisedSurface,
  display: 'flex',
  flexDirection: 'column',
  minBlockSize: 0,
  borderWidth: 0,
  boxShadow: vars.shadow.floating,
  animationName: entry,
  animationDuration: vars.motion.duration.base,
  animationTimingFunction: vars.motion.easeStandard,
  animationFillMode: 'backwards',
  [REDUCED_MOTION]: { animation: 'none' },
  [FORCED_COLORS]: { boxShadow: 'none', borderColor: 'CanvasText' },
});

const inlinePanel = {
  blockSize: '100%',
  paddingBlockStart: SAFE_AREA.top,
} as const;

const panelSideStyles: Record<DrawerSide, SerializedStyles> = {
  'inline-start': css({
    ...inlinePanel,
    borderInlineEndWidth: '1px',
    borderStartEndRadius: vars.radius.lg,
    borderEndEndRadius: vars.radius.lg,
    '--drawer-entry-x': '-100%',
    '&:dir(rtl)': { '--drawer-entry-x': '100%' },
    [FORCED_COLORS]: { borderInlineEndWidth: '2px' },
  }),
  'inline-end': css({
    ...inlinePanel,
    borderInlineStartWidth: '1px',
    borderStartStartRadius: vars.radius.lg,
    borderEndStartRadius: vars.radius.lg,
    '--drawer-entry-x': '100%',
    '&:dir(rtl)': { '--drawer-entry-x': '-100%' },
    [FORCED_COLORS]: { borderInlineStartWidth: '2px' },
  }),
  top: css({
    inlineSize: '100%',
    maxBlockSize: `min(${BLOCK_SIZE_CAP}, 100dvh)`,
    paddingBlockStart: SAFE_AREA.top,
    borderBlockEndWidth: '1px',
    borderEndStartRadius: vars.radius.lg,
    borderEndEndRadius: vars.radius.lg,
    '--drawer-entry-y': '-100%',
    [FORCED_COLORS]: { borderBlockEndWidth: '2px' },
  }),
  bottom: css({
    inlineSize: '100%',
    maxBlockSize: `min(${BLOCK_SIZE_CAP}, 100dvh)`,
    borderBlockStartWidth: '1px',
    borderStartStartRadius: vars.radius.lg,
    borderStartEndRadius: vars.radius.lg,
    '--drawer-entry-y': '100%',
    [FORCED_COLORS]: { borderBlockStartWidth: '2px' },
  }),
};

// Inline sides: cap per size, never wider than the viewport minus a gutter.
const panelSizeStyles: Record<DrawerSize, SerializedStyles> = Object.fromEntries(
  Object.entries(INLINE_SIZE_CAP).map(([size, cap]) => [
    size,
    css({
      inlineSize: `min(${cap}, calc(100% - ${VIEWPORT_GUTTER}))`,
      [COMPACT_VIEWPORT]: { inlineSize: `calc(100% - ${VIEWPORT_GUTTER})` },
    }),
  ]),
) as Record<DrawerSize, SerializedStyles>;

const partInlinePadding = {
  paddingInline: PART_PADDING,
  [COMPACT_VIEWPORT]: { paddingInline: COMPACT_PART_PADDING },
} as const;

const headerStyle = css({
  ...partInlinePadding,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'start',
  columnGap: vars.space[4],
  flexShrink: 0,
  paddingBlock: PART_PADDING,
  borderBlockEnd: `1px solid ${vars.color.border}`,
  '& > *': { gridColumn: 1 },
  '& > [data-ui~="drawer-close"]': { gridColumn: 2, gridRow: 1 },
  [COMPACT_VIEWPORT]: { paddingBlock: COMPACT_PART_PADDING },
});

const draggableHeaderStyle = css({
  cursor: 'grab',
  touchAction: 'none',
  '&[data-dragging]': { cursor: 'grabbing' },
  [REDUCED_MOTION]: { cursor: 'auto', touchAction: 'auto' },
});

// The last part keeps its content clear of the bottom safe area.
const lastPartSafeArea = {
  '&:last-child': {
    paddingBlockEnd: `calc(${PART_PADDING} + ${SAFE_AREA.bottom})`,
    [COMPACT_VIEWPORT]: { paddingBlockEnd: `calc(${COMPACT_PART_PADDING} + ${SAFE_AREA.bottom})` },
  },
} as const;

const bodyStyle = css({
  ...partInlinePadding,
  flex: '1 1 auto',
  minBlockSize: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  paddingBlock: vars.space[5],
  fontSize: vars.textSize.sm,
  ...lastPartSafeArea,
});

const footerStyle = css({
  ...partInlinePadding,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: vars.space[3],
  flexShrink: 0,
  paddingBlock: vars.space[4],
  borderBlockStart: `1px solid ${vars.color.border}`,
  ...lastPartSafeArea,
});

const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
});

const descriptionStyle = css({
  margin: 0,
  marginBlockStart: vars.space[2],
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const closeStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  boxSizing: 'border-box',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[3],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': {
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.text,
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
    '&:focus-visible': { outlineColor: 'Highlight' },
  },
});

/** Title/Description only exist (and name/describe the drawer) with content: `0` counts, `''` does not. */
function hasText(children: ReactNode) {
  return isRenderable(children) && children !== '';
}

function DrawerRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = 'inline-end',
  size = 'md',
  draggable = false,
  children,
}: DrawerProps) {
  const baseId = useId();
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const { setDialogElement, setOpen, requestClose, repairToken } = useNativeDialogRoot(open, requestOpenChange);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);

  const context = useMemo(
    () => ({
      open,
      setOpen,
      requestClose,
      repairToken,
      setDialogElement,
      side,
      size,
      draggable,
      titleId: `${baseId}-title`,
      descriptionId: `${baseId}-description`,
      hasTitle,
      hasDescription,
      setHasTitle,
      setHasDescription,
    }),
    [open, setOpen, requestClose, repairToken, setDialogElement, side, size, draggable, baseId, hasTitle, hasDescription],
  );

  return <DrawerContext.Provider value={context}>{children}</DrawerContext.Provider>;
}

DrawerRoot.displayName = 'Drawer';

function DrawerTrigger({ ref, onClick, className, sx, ...rest }: DrawerTriggerProps) {
  const { open, setOpen } = useDrawerContext('Trigger');

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) setOpen(true);
  };

  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...rest}
          ref={ref}
          data-ui="drawer-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={handleClick}
          className={className}
        />
      )}
    </WithSx>
  );
}

DrawerTrigger.displayName = 'Drawer.Trigger';

interface DragSession {
  pointerId: number;
  axis: 'x' | 'y';
  /** +1 when positive client travel moves toward the panel's edge. */
  sign: 1 | -1;
  start: number;
  extent: number;
  offset: number;
  samples: { position: number; time: number }[];
}

// Read when a drag starts, not at render: the header markup stays identical on server and client.
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const DRAG_AXIS: Record<DrawerSide, 'x' | 'y'> = { 'inline-start': 'x', 'inline-end': 'x', top: 'y', bottom: 'y' };

function edgeSign(side: DrawerSide, rtl: boolean): 1 | -1 {
  if (side === 'top') return -1;
  if (side === 'bottom') return 1;
  return (side === 'inline-end') !== rtl ? 1 : -1;
}

function translateFor(session: Pick<DragSession, 'axis' | 'sign'>, offset: number) {
  const distance = offset * session.sign;
  return offset === 0 ? '' : session.axis === 'x' ? `${distance}px` : `0 ${distance}px`;
}

/** Header drag-to-dismiss. Handlers are null (no listeners) unless enabled; reduced motion ignores presses. */
function useHeaderDrag(
  enabled: boolean,
  side: DrawerSide,
  panelRef: RefObject<HTMLDivElement | null>,
  requestClose: () => void,
) {
  const sessionRef = useRef<DragSession | null>(null);
  const springRef = useRef<AnimationPlaybackControls | null>(null);
  // Current panel offset toward the edge, so grabbing a panel mid-spring continues from there.
  const offsetRef = useRef(0);

  const reset = useCallback(() => {
    springRef.current?.stop();
    springRef.current = null;
    sessionRef.current = null;
    offsetRef.current = 0;
    if (panelRef.current) panelRef.current.style.translate = '';
  }, [panelRef]);

  // Unmount: stop a running spring and clear the inline offset.
  useEffect(() => reset, [reset]);

  const headerGesture = useMemo((): HeaderGestureHandlers | null => {
    if (!enabled) return null;

    const moveTo = (panel: HTMLElement, session: DragSession, offset: number) => {
      offsetRef.current = offset;
      panel.style.translate = translateFor(session, offset);
    };

    const finish = (event: PointerEvent<HTMLDivElement>, release: boolean) => {
      const session = sessionRef.current;
      const panel = panelRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      sessionRef.current = null;
      event.currentTarget.removeAttribute('data-dragging');
      // Velocity over the last moments before release: a drag that paused before letting go is not a fling.
      const position = session.axis === 'x' ? event.clientX : event.clientY;
      const samples = [...session.samples, { position, time: event.timeStamp }].filter(
        (sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW_MS,
      );
      const first = samples[0];
      const last = samples.at(-1);
      const elapsed = first && last ? (last.time - first.time) / 1000 : 0;
      const velocity =
        first && last && elapsed > 0 ? ((last.position - first.position) * session.sign) / elapsed : 0;
      // Accepted: the native close hides the panel at once and Content resets the offset.
      // Rejected (or not a dismissal): the drawer stays open and the panel springs home.
      if (release && (session.offset >= session.extent * DISMISS_FRACTION || velocity >= FLING_VELOCITY)) {
        requestClose();
      }
      if (!panel || session.offset === 0) return;
      springRef.current = animate(session.offset, 0, {
        ...RELEASE_SPRING,
        velocity,
        onUpdate: (offset) => moveTo(panel, session, offset),
      });
    };

    return {
      onPointerDown: (event) => {
        const panel = panelRef.current;
        if (!event.isPrimary || event.button !== 0 || !panel) return;
        if (event.target instanceof Element && event.target.closest(NO_DRAG_SELECTOR)) return;
        if (panel.ownerDocument.defaultView?.matchMedia(REDUCED_MOTION_QUERY).matches) return;
        springRef.current?.stop();
        const axis = DRAG_AXIS[side];
        const sign = edgeSign(side, getComputedStyle(panel).direction === 'rtl');
        const rect = panel.getBoundingClientRect();
        const position = axis === 'x' ? event.clientX : event.clientY;
        const offset = offsetRef.current;
        sessionRef.current = {
          pointerId: event.pointerId,
          axis,
          sign,
          start: position - offset * sign,
          extent: axis === 'x' ? rect.width : rect.height,
          offset,
          samples: [{ position, time: event.timeStamp }],
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.setAttribute('data-dragging', '');
      },
      onPointerMove: (event) => {
        const session = sessionRef.current;
        const panel = panelRef.current;
        if (!session || session.pointerId !== event.pointerId || !panel) return;
        const position = session.axis === 'x' ? event.clientX : event.clientY;
        const travel = (position - session.start) * session.sign;
        session.offset = travel >= 0 ? travel : travel * OPPOSING_RESISTANCE;
        session.samples = [...session.samples, { position, time: event.timeStamp }].filter(
          (sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW_MS,
        );
        moveTo(panel, session, session.offset);
      },
      onPointerUp: (event) => finish(event, true),
      onPointerCancel: (event) => finish(event, false),
      onLostPointerCapture: (event) => finish(event, false),
    };
  }, [enabled, side, panelRef, requestClose]);

  return { headerGesture, reset };
}

function DrawerContent({ ref, className, sx, ...props }: DrawerContentProps) {
  const {
    children,
    onCancel,
    onClick,
    onClose,
    onKeyDownCapture,
    onKeyUp,
    'aria-labelledby': ariaLabelledByProp,
    'aria-describedby': ariaDescribedByProp,
    withDescription = true,
    ...rest
  } = omitNativeOpen(props);

  const context = useDrawerContext('Content');
  const { setOpen, titleId, descriptionId, hasTitle, hasDescription, side, draggable } = context;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const escapeHandledByLayerRef = useRef(false);
  const requestClose = useCallback(() => {
    requestNativeDialogClose(dialogRef.current, setOpen);
  }, [setOpen]);
  const { headerGesture, reset } = useHeaderDrag(draggable, side, panelRef, requestClose);

  // The browser turns an Escape keydown into a native cancel even when a floating layer nested in
  // this drawer closes on it: that keystroke belongs to the layer, so its cancel is dropped.
  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (escapeHandledByLayerRef.current) {
      escapeHandledByLayerRef.current = false;
      event.preventDefault();
      return;
    }
    onCancel?.(event);
  };
  const handleClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    reset();
    onClose?.(event);
  };
  const nativeDialog = useNativeDialog(
    { ...context, requestClose },
    { onCancel: handleCancel, onClick, onClose: handleClose },
    ref,
    dialogRef,
  );
  // React bubbles cancel/close from nested native dialogs; only this drawer's own events drive it.
  const ownEvent =
    (own: (event: SyntheticEvent<HTMLDialogElement>) => void, consumer: typeof onClose) =>
    (event: SyntheticEvent<HTMLDialogElement>) =>
      event.target === dialogRef.current ? own(event) : consumer?.(event);
  const dialogProps = {
    ...nativeDialog,
    onCancel: ownEvent(nativeDialog.onCancel, onCancel),
    onClose: ownEvent(nativeDialog.onClose, onClose),
    // Capture phase: a nested layer's own Escape handler may stop propagation before bubbling.
    onKeyDownCapture: (event: KeyboardEvent<HTMLDialogElement>) => {
      onKeyDownCapture?.(event);
      if (event.key === 'Escape') {
        escapeHandledByLayerRef.current = Boolean(dialogRef.current?.querySelector(NESTED_LAYER_SELECTOR));
      }
    },
    onKeyUp: (event: KeyboardEvent<HTMLDialogElement>) => {
      onKeyUp?.(event);
      if (event.key === 'Escape') escapeHandledByLayerRef.current = false;
    },
  };

  const surface = useMemo(() => ({ requestClose, panelRef, headerGesture }), [requestClose, headerGesture]);

  const labelledBy = [ariaLabelledByProp, hasTitle && titleId].filter(Boolean).join(' ') || undefined;
  const describedBy =
    [ariaDescribedByProp, withDescription && hasDescription && descriptionId].filter(Boolean).join(' ') ||
    undefined;

  return (
    <WithSx className={className} styles={[dialogStyle, dialogSideStyles[side]]} sx={sx}>
      {(className) => (
        <dialog
          {...rest}
          {...dialogProps}
          data-ui="drawer"
          data-side={side}
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          className={className}
        >
          <DrawerSurfaceContext.Provider value={surface}>{children}</DrawerSurfaceContext.Provider>
        </dialog>
      )}
    </WithSx>
  );
}

DrawerContent.displayName = 'Drawer.Content';

function DrawerPanel({ ref, className, appearance = 'contrast', sx, ...props }: DrawerPanelProps) {
  const { side, size } = useDrawerContext('Panel');
  const panelRef = useContext(DrawerSurfaceContext)?.panelRef;
  const mergedRef = useMergeRefs([panelRef, ref]);
  const inline = side === 'inline-start' || side === 'inline-end';
  const surfaceAppearance = useSurfaceAppearance(appearance);

  return (
    <AppearanceScope appearance={surfaceAppearance}>
      <WithSx
        className={className}
        styles={[panelStyle, panelSideStyles[side], inline && panelSizeStyles[size], contrastSurfaceStyle]}
        sx={sx}
      >
        {(className) => (
          <div
            {...props}
            ref={mergedRef}
            data-ui="drawer-panel"
            data-appearance={surfaceAppearance}
            className={className}
          />
        )}
      </WithSx>
    </AppearanceScope>
  );
}

DrawerPanel.displayName = 'Drawer.Panel';

function DrawerHeader({ ref, className, sx, ...props }: DrawerHeaderProps) {
  useDrawerContext('Header');
  const gesture = useContext(DrawerSurfaceContext)?.headerGesture ?? null;
  // Consumer pointer handlers run first and keep working alongside the gesture.
  const gestureProps =
    gesture &&
    (Object.fromEntries(
      (Object.keys(gesture) as (keyof HeaderGestureHandlers)[]).map((name) => [
        name,
        (event: PointerEvent<HTMLDivElement>) => {
          props[name]?.(event);
          gesture[name]?.(event);
        },
      ]),
    ) as HeaderGestureHandlers);

  return (
    <WithSx className={className} styles={[headerStyle, gesture && draggableHeaderStyle]} sx={sx}>
      {(className) => (
        <div
          {...props}
          {...gestureProps}
          ref={ref}
          data-ui="drawer-header"
          data-draggable={gesture ? '' : undefined}
          className={className}
        />
      )}
    </WithSx>
  );
}

DrawerHeader.displayName = 'Drawer.Header';

function DrawerBody({ ref, className, sx, ...props }: DrawerBodyProps) {
  useDrawerContext('Body');
  return (
    <WithSx className={className} styles={bodyStyle} sx={sx}>
      {(className) => <div {...props} ref={ref} data-ui="drawer-body" className={className} />}
    </WithSx>
  );
}

DrawerBody.displayName = 'Drawer.Body';

function DrawerFooter({ ref, className, sx, ...props }: DrawerFooterProps) {
  useDrawerContext('Footer');
  return (
    <WithSx className={className} styles={footerStyle} sx={sx}>
      {(className) => <div {...props} ref={ref} data-ui="drawer-footer" className={className} />}
    </WithSx>
  );
}

DrawerFooter.displayName = 'Drawer.Footer';

function DrawerTitle({ ref, className, sx, children, ...props }: DrawerTitleProps) {
  const { titleId, setHasTitle } = useDrawerContext('Title');
  const present = hasText(children);

  useEffect(() => {
    if (!present) return;
    setHasTitle(true);
    return () => setHasTitle(false);
  }, [present, setHasTitle]);

  if (!present) return null;

  return (
    <WithSx className={className} styles={titleStyle} sx={sx}>
      {(className) => (
        <h2 {...props} ref={ref} id={titleId} data-ui="drawer-title" className={className}>
          {children}
        </h2>
      )}
    </WithSx>
  );
}

DrawerTitle.displayName = 'Drawer.Title';

function DrawerDescription({ ref, className, sx, children, ...props }: DrawerDescriptionProps) {
  const { descriptionId, setHasDescription } = useDrawerContext('Description');
  const present = hasText(children);

  useEffect(() => {
    if (!present) return;
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [present, setHasDescription]);

  if (!present) return null;

  return (
    <WithSx className={className} styles={descriptionStyle} sx={sx}>
      {(className) => (
        <p {...props} ref={ref} id={descriptionId} data-ui="drawer-description" className={className}>
          {children}
        </p>
      )}
    </WithSx>
  );
}

DrawerDescription.displayName = 'Drawer.Description';

function DrawerClose({ ref, onClick, className, sx, ...rest }: DrawerCloseProps) {
  const { setOpen } = useDrawerContext('Close');
  const requestClose = useContext(DrawerSurfaceContext)?.requestClose;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (requestClose) requestClose();
    else setOpen(false);
  };

  return (
    <WithSx className={className} styles={closeStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...rest}
          ref={ref}
          data-ui="drawer-close"
          onClick={handleClick}
          className={className}
        />
      )}
    </WithSx>
  );
}

DrawerClose.displayName = 'Drawer.Close';

export const Drawer = Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Content: DrawerContent,
  Panel: DrawerPanel,
  Header: DrawerHeader,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerClose,
});
