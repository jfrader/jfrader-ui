'use client';

// APG pattern: dialog (modal), one modal surface hosting a stack of drill-down panels. Only the
// top panel is operable; parents stay mounted (keeping their form state) behind it, inert and
// hidden from assistive technology, peeking above it.
// Keyboard map: Enter/Space on a Trigger pushes its panel (an open key truncates back to it);
// Tab/Shift+Tab stay inside the top panel; Escape closes the topmost child overlay first,
// otherwise requests one pop (never close-all; a nondismissible top refuses it); Enter/Space on
// Back pops once and on Close clears the stack.
//
// One modality authority per layer:
// - Viewport (default): one persistent native <dialog> shell opened with showModal() while the
//   stack is nonempty. The top layer makes the page inert and locks scroll; the shell takes the
//   top panel's name and description, and the active panel is a plain div inside it. Lifecycle
//   (native form/ref closes reconcile to a clear request, rejected native closes repair on the
//   next explicit open request, scroll locks only after showModal() succeeds): see
//   `overlay/use-native-dialog.ts`.
// - Contained: the layer is drawn inside the nearest positioned ancestor, but modality stays
//   document-wide: the active panel is role="dialog" aria-modal="true" while everything outside
//   the layer is inert (restored on close) and focus is held in the layer. The page keeps its
//   scroll; there is no scroll lock.
//
// State: `value` is the bottom-first list of open keys. Requests compare ordered keys before
// notifying, so an unchanged stack never calls back; unknown or duplicate keys are dropped with a
// development warning. Popped panels unmount; focus returns to the exact invoker inside the
// retained parent, falling back to its heading, then Back, then the panel.
//
// Layout follows the layer's measured inline size (`variant="auto"`): a bottom sheet below
// `breakpoint`, a centered dialog at or above it. The switch changes attributes only — never the
// DOM, focus or value. Depth is drawn with peeks and a modest parent scale through CSS
// transitions; the optional handle drag (top panel, pointer only) springs home with motion when it
// does not dismiss. Reduced motion removes depth motion, entry animation and the drag; Back and
// Close always work. Closing is immediate: there is no top-layer exit animation.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { GeneratedRoot, type GeneratedRootSlotProps } from '../../utils/generated-root';
import { createPortal } from 'react-dom';
import { FloatingFocusManager, useFloating, useMergeRefs } from '@floating-ui/react';
import { animate, type AnimationPlaybackControls } from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { modalShellReset } from '../../styling/surface';
import { ThemeBoundary } from '../../styling/theme-scope';
import type { DrawerPanelProps } from '../drawer';
import { SurfaceRoot } from '../surface/surface-root';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { useNativeDialog, useNativeDialogRoot } from '../../overlay/use-native-dialog';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

export type DialogStackVariant = 'auto' | 'sheet' | 'dialog';
type ResolvedVariant = Exclude<DialogStackVariant, 'auto'>;
export type DialogStackHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface DialogStackPageRecord {
  /** Identifies this panel. Keep the key stable and unique within the stack. */
  value: string;
  /** Heading for this panel. */
  title: ReactNode;
  /** Main content of this panel. */
  content: ReactNode;
  /** Description below the title. */
  description?: ReactNode;
  /** Footer content placed at the bottom of the panel. */
  footer?: ReactNode;
  /** Back button label or content. */
  back?: string;
  /** Close button label or content. */
  close?: string;
  /** Allows Escape, backdrop, and drag dismissal. Defaults to `true`. When `false`, Back and Close still work. */
  dismissible?: boolean;
  /** Receives Escape, backdrop, or drag dismissal requests while this panel is on top. Call `preventDefault()` to keep it open. */
  onCancel?: (event: Event) => void;
  /** Inherit appearance by default; `contrast` establishes fixed charcoal. */
  appearance?: DrawerPanelProps['appearance'];
  /** Includes `Description` in the accessible description. Defaults to `true`. Use `false` for structured content. */
  withDescription?: boolean;
  /** Optional page-specific slotProps overrides. */
  slotProps?: DialogStackSlotProps;
}

export interface DialogStackSlots {
  /** Replaces the content panel's adopted div; renders a `div` by default. */
  root?: NonNullable<DialogStackContentProps['slots']>['root'];
  /** Replaces the generated header wrapper around title and description. */
  header?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the generated body wrapper around the page content. */
  body?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the button that opens a dialog panel. */
  trigger?: ComponentType<DialogStackTriggerProps>;
  /** Replaces the stacked page panel container. */
  content?: ComponentType<DialogStackContentProps>;
  /** Replaces the heading element that names the page. */
  title?: ComponentType<DialogStackTitleProps>;
  /** Replaces the text element that describes the page. */
  description?: ComponentType<DialogStackDescriptionProps>;
  /** Replaces the bottom container for action buttons. */
  footer?: ComponentType<DialogStackFooterProps>;
  /** Replaces the button that navigates back to the parent panel. */
  back?: ComponentType<DialogStackBackProps>;
  /** Replaces the button that dismisses the entire dialog stack. */
  close?: ComponentType<DialogStackCloseProps>;
}

export interface DialogStackSlotProps {
  /** Customize the panel's adopted div, not the native dialog shell. */
  root?: NonNullable<DialogStackContentProps['slotProps']>['root'];
  /** Generated header wrapper around title and description. */
  header?: GeneratedRootSlotProps;
  /** Generated body wrapper around the page content. */
  body?: GeneratedRootSlotProps;
  /** Button that opens a dialog panel. */
  trigger?: Partial<Omit<DialogStackTriggerProps, 'value' | 'children'>>;
  /** Stacked page panel container. */
  content?: Partial<Omit<DialogStackContentProps, 'value' | 'children'>>;
  /** Heading element that names the page. */
  title?: Partial<DialogStackTitleProps>;
  /** Text element that describes the page. */
  description?: Partial<DialogStackDescriptionProps>;
  /** Bottom container for action buttons. */
  footer?: Partial<DialogStackFooterProps>;
  /** Button that navigates back to the parent panel. */
  back?: Partial<DialogStackBackProps>;
  /** Button that dismisses the entire dialog stack. */
  close?: Partial<DialogStackCloseProps>;
}

export interface DialogStackBaseProps {
  /** Controls the open panel keys, bottom first. */
  value?: readonly string[];
  /** Sets the initial uncontrolled stack, bottom first. Defaults to `[]`. */
  defaultValue?: readonly string[];
  /** Requests a changed ordered stack. Controlled panels change only when `value` updates. */
  onValueChange?: (value: string[]) => void;
  /** Sets the layout. Defaults to `'auto'`: a sheet below `breakpoint`, a centered dialog at or above it. */
  variant?: DialogStackVariant;
  /** Sets the layer width in CSS pixels where `'auto'` switches to a dialog. Defaults to the `dialogStackBreakpoint` token. */
  breakpoint?: number;
  /** Draws inside the nearest positioned ancestor. Modality stays document-wide, without a page scroll lock. Defaults to `false`. */
  contained?: boolean;
}

export interface DialogStackCompoundProps extends DialogStackBaseProps {
  children?: ReactNode;
  pages?: never;
  triggerLabel?: never;
  initialPage?: never;
  slots?: never;
  slotProps?: never;
  component?: never;
}

export interface DialogStackEasyProps extends DialogStackBaseProps {
  /** Name the button that opens the stack. */
  triggerLabel?: ReactNode;
  /** The panel key opened by the trigger button. Defaults to the first page's value. */
  initialPage?: string;
  /** Page specifications for the stack. */
  pages: readonly DialogStackPageRecord[];
  children?: never;
  slots?: DialogStackSlots;
  slotProps?: DialogStackSlotProps;
  component?: DialogStackSlots['root'];
}

export type DialogStackProps = DialogStackCompoundProps | DialogStackEasyProps;

export interface DialogStackTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {
  /** Opens this panel key. An open key removes the panels above it. */
  value: string;
}

export interface DialogStackContentProps extends Omit<DrawerPanelProps, 'onCancel'> {
  /** Inherit appearance by default; `contrast` establishes fixed charcoal. */
  appearance?: DrawerPanelProps['appearance'];
  /** Identifies this panel. Keep the key stable and unique within the stack. */
  value: string;
  /** Allows Escape, backdrop, and drag dismissal. Defaults to `true`. When `false`, Back and Close still work. */
  dismissible?: boolean;
  /** Receives Escape, backdrop, or drag dismissal requests while this panel is on top. Call `preventDefault()` to keep it open. */
  onCancel?: (event: Event) => void;
  /** Includes `Description` in the accessible description. Defaults to `true`. Use `false` for structured content. */
  withDescription?: boolean;
}

export interface DialogStackTitleProps extends ComponentPropsWithRef<'h2'>, SxProps {
  /** Sets the heading level. Defaults to `2`. */
  level?: DialogStackHeadingLevel;
}
export interface DialogStackDescriptionProps extends ComponentPropsWithRef<'p'>, SxProps {}
export interface DialogStackFooterProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface DialogStackBackProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'>, SxProps {
  /** Names the Back button for assistive technology. Supply a localized name, such as "Back to Settings". */
  label: string;
}
export interface DialogStackCloseProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'>, SxProps {
  /** Names the Close button for assistive technology. Supply a localized name, such as "Close all". */
  label: string;
}

export interface DialogStackActions {
  /** The open keys, bottom first. */
  value: readonly string[];
  /** Requests opening `key` on top. An open key removes the panels above it. */
  push: (key: string) => void;
  /** Requests closing the top panel. Does nothing on an empty stack. */
  pop: () => void;
  /** Requests removing the panels above an open `key`. A closed key is ignored with a development warning. */
  popTo: (key: string) => void;
  /** Requests closing every panel. Does nothing on an empty stack. */
  close: () => void;
}

interface Naming {
  label: string | undefined;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

/** What the Root knows about one declared sheet; written by its Content. */
interface SheetEntry {
  dismissible: boolean;
  onCancel: ((event: Event) => void) | undefined;
  panel: HTMLDivElement | null;
}

interface DialogStackContextValue extends DialogStackActions {
  contained: boolean;
  variant: ResolvedVariant;
  stage: HTMLDivElement | null;
  setStage: (element: HTMLDivElement | null) => void;
  setLayer: (element: HTMLElement | null) => void;
  register: (key: string, entry: SheetEntry) => void;
  unregister: (key: string, entry: SheetEntry) => void;
  setNaming: (naming: Naming) => void;
  dismissTop: () => void;
  /** Escape keydowns that a child overlay inside the top panel owns. */
  escapeOwnedByChildRef: RefObject<boolean>;
}

interface SheetContentContextValue {
  titleId: string;
  descriptionId: string;
  setHasTitle: (present: boolean) => void;
  setHasDescription: (present: boolean) => void;
}

const DialogStackContext = createContext<DialogStackContextValue | null>(null);
const SheetContentContext = createContext<SheetContentContextValue | null>(null);

function useDialogStackContext(part: string): DialogStackContextValue {
  const context = useContext(DialogStackContext);
  if (!context) throw new Error(`DialogStack.${part} must be rendered inside <DialogStack>.`);
  return context;
}

function useSheetContentContext(part: string): SheetContentContextValue {
  const context = useContext(SheetContentContext);
  if (!context) throw new Error(`DialogStack.${part} must be rendered inside <DialogStack.Content>.`);
  return context;
}

/** Returns the stack's state and actions. Throws outside `<DialogStack>`. */
export function useDialogStack(): DialogStackActions {
  const { value, push, pop, popTo, close } = useDialogStackContext('useDialogStack');
  return useMemo(() => ({ value, push, pop, popTo, close }), [value, push, pop, popTo, close]);
}

// Gesture contract (handle drag on the top panel).
const GESTURE = {
  /** Share of the panel's block size past which a release dismisses. */
  distanceRatio: 0.35,
  /** Downward release velocity, CSS px/s, that dismisses regardless of distance. */
  velocity: 450,
  /** Share of upward travel the panel follows; upward drags never change state. */
  opposingResistance: 0.2,
  velocityWindowMs: 100,
  releaseSpring: { type: 'spring', stiffness: 400, damping: 40, mass: 1 },
} as const;

// Read when a drag starts, not at render: the markup stays identical on server and client.
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const NO_DRAG_SELECTOR = '[data-sheet-no-drag]';
// Child overlays that own an Escape: open floating portals and native dialogs inside the panel.
const CHILD_LAYER_SELECTOR = '[data-floating-ui-portal]:not(:empty), dialog[open]';

const DEFAULT_BREAKPOINT = Number.parseFloat(base.size.dialogStackBreakpoint);
const EMPTY_STACK: readonly string[] = [];

// Structural sizes.
const LAYER_GUTTER = vars.space[4];
const SHEET_TOP_GAP = `calc(${vars.space[6]} + env(safe-area-inset-top, 0px))`;
const DIALOG_INLINE_CAP = '32rem';
// No depth shrinks a panel below this, so its header and actions stay reachable.
const PANEL_MIN_BLOCK = '12rem';
const DEPTH_SCALE_STEP = 0.05;
const DEPTH = 'var(--dialog-stack-depth, 0)';
const INDEX = 'var(--dialog-stack-index, 0)';
const ACTIVE_SIZE = 'var(--dialog-stack-active-size, 0px)';
const PANEL_MOTION_STYLE_KEYS = ['translate'] as const;

const sheetEntry = keyframes({ from: { opacity: 0, transform: 'translateY(100%)' } });
const dialogEntry = keyframes({ from: { opacity: 0, transform: 'scale(0.96)' } });

const shellStyle = css({
  ...modalShellReset,
  position: 'fixed',
  inset: 0,
  margin: 0,
  inlineSize: '100%',
  blockSize: '100%',
  maxInlineSize: 'none',
  maxBlockSize: 'none',
  overflow: 'hidden',
  '&[open]': { display: 'block' },
});

const containedLayerStyle = css({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  borderRadius: 'inherit',
});

const scrimStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundColor: vars.color.scrim,
});

// Panels opt back into pointer events, so a press beside them reaches the backdrop.
const stageStyle = css({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
});

const panelStyle = css({
  boxSizing: 'border-box',
  position: 'absolute',
  zIndex: INDEX,
  display: 'flex',
  flexDirection: 'column',
  minBlockSize: 0,
  pointerEvents: 'auto',
  overflow: 'hidden',
  '&:focus-visible': { ...focusRingInset },
  transformOrigin: 'top center',
  transitionProperty: 'transform, min-block-size',
  transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  animationDuration: vars.motion.duration.slow,
  animationTimingFunction: vars.motion.easeStandard,
  animationFillMode: 'backwards',
  [REDUCED_MOTION]: { animation: 'none', transitionDuration: '0s' },
});

/** Each level down the stack leaves one more peek of room, never below the panel minimum. */
function depthCappedBlockSize(gap: string, peek: string) {
  return `min(100%, max(${PANEL_MIN_BLOCK}, calc(100% - ${gap} - ${INDEX} * ${peek})))`;
}

// Layout per variant and the parents' peek. Separate top-level styles (no attribute selectors),
// so a consumer `sx` merged after them overrides them.
const panelVariantStyles: Record<ResolvedVariant, SerializedStyles> = {
  sheet: css({
    borderRadius: 0,
    insetInline: 0,
    insetBlockEnd: 0,
    marginInline: 'auto',
    inlineSize: '100%',
    maxInlineSize: vars.size.dialogStackBreakpoint,
    maxBlockSize: depthCappedBlockSize(SHEET_TOP_GAP, vars.size.dialogStackSheetPeek),
    borderBlockEndWidth: 0,
    borderStartStartRadius: vars.radius.xl,
    borderStartEndRadius: vars.radius.xl,
    paddingBlockEnd: 'env(safe-area-inset-bottom, 0px)',
    animationName: sheetEntry,
    [FORCED_COLORS]: { borderBlockEndWidth: '1px' },
  }),
  dialog: css({
    inset: 0,
    margin: 'auto',
    inlineSize: `min(${DIALOG_INLINE_CAP}, calc(100% - 2 * ${LAYER_GUTTER}))`,
    blockSize: 'fit-content',
    maxBlockSize: depthCappedBlockSize(`2 * ${LAYER_GUTTER}`, `2 * ${vars.size.dialogStackDialogPeek}`),
    borderRadius: vars.radius.lg,
    animationName: dialogEntry,
  }),
};

// Parents peek above the active panel: at least its size plus one peek per level, scaled from the top edge.
const parentScale = `scale(calc(1 - ${DEPTH} * ${DEPTH_SCALE_STEP}))`;
const parentStyles: Record<ResolvedVariant, SerializedStyles> = {
  sheet: css({
    animationName: 'none',
    minBlockSize: `calc(${ACTIVE_SIZE} + ${DEPTH} * ${vars.size.dialogStackSheetPeek})`,
    transform: parentScale,
  }),
  dialog: css({
    animationName: 'none',
    blockSize: ACTIVE_SIZE,
    transform: `translateY(calc(-1 * ${DEPTH} * ${vars.size.dialogStackDialogPeek})) ${parentScale}`,
  }),
};

const handleStyle = css({
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  blockSize: vars.space[8],
  cursor: 'grab',
  touchAction: 'none',
  '&::before': {
    content: '""',
    inlineSize: vars.space[10],
    blockSize: vars.space[1],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.borderControl,
  },
  '&[data-dragging]': { cursor: 'grabbing' },
  '[data-variant="dialog"] > &': { display: 'none' },
  '[data-sheet-no-drag] > &': { cursor: 'auto', touchAction: 'auto' },
  [REDUCED_MOTION]: { cursor: 'auto', touchAction: 'auto' },
  [FORCED_COLORS]: { '&::before': { backgroundColor: 'CanvasText' } },
});

const scrollerStyle = css({
  flex: '1 1 auto',
  minBlockSize: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[2],
  paddingInline: vars.space[5],
  paddingBlockStart: vars.space[4],
  fontSize: vars.textSize.sm,
  // Below the handle: just enough room for a focus ring.
  '[data-variant="sheet"] > &': { paddingBlockStart: vars.space[1] },
  // Without a Footer the content keeps its bottom padding; the Footer brings its own.
  '&:not(:has(> [data-ui~="dialog-stack-footer"]))': { paddingBlockEnd: vars.space[5] },
});

const footerStyle = css({
  position: 'sticky',
  insetBlockEnd: 0,
  marginBlockStart: 'auto',
  marginInline: `calc(-1 * ${vars.space[5]})`,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: vars.space[3],
  paddingInline: vars.space[5],
  paddingBlock: vars.space[4],
  backgroundColor: vars.color.surfaceRaised,
  borderBlockStart: `1px solid ${vars.color.border}`,
});

const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  borderRadius: vars.radius.sm,
  '&:focus': { outline: 'none' },
  '&:focus-visible': { ...focusRingOutset },
  [FORCED_COLORS]: { '&:focus-visible': { outlineColor: 'Highlight' } },
});

const descriptionStyle = css({
  margin: 0,
  color: vars.color.textMuted,
});

const actionStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[1],
  alignSelf: 'flex-start',
  boxSizing: 'border-box',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '& > svg': { inlineSize: '1em', blockSize: '1em', flexShrink: 0 },
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceHover, color: vars.color.text },
  '&:focus-visible': { ...focusRingOutset },
  '&:disabled': { opacity: 0.55, cursor: 'not-allowed' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'ButtonBorder',
    '&:focus-visible': { outlineColor: 'Highlight' },
  },
});

// Back and Close share one top bar: Back at the inline start, Close at the end. Rendering them as
// scroller children would stack them in the content column.
const topBarStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  minBlockSize: vars.space[8],
});
const topBarEndStyle = css({ marginInlineStart: 'auto' });

// The back chevron points toward the inline start in either direction.
const backIconStyle = css({ '&:dir(rtl)': { transform: 'scaleX(-1)' } });

/** Title/Description only exist (and name/describe the sheet) with content: `0` counts, `''` does not. */
function hasText(children: ReactNode) {
  return isRenderable(children) && children !== '';
}

function sameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function joinIds(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}

function warn(message: string) {
  if (process.env.NODE_ENV !== 'production') console.warn(`DialogStack: ${message}`);
}

/** Known keys only, first occurrence wins. */
function normalize(raw: readonly string[], entries: Map<string, SheetEntry>) {
  const seen = new Set<string>();
  return raw.filter((key) => {
    if (!entries.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function focusable(element: HTMLElement | null | undefined): element is HTMLElement {
  return Boolean(element?.isConnected && typeof element.focus === 'function');
}

/** The layer's inline size. A closed viewport shell is not laid out; it spans the viewport once open. */
function layerWidth(layer: HTMLElement) {
  const width = layer.getBoundingClientRect().width;
  return width > 0 || !(layer instanceof HTMLDialogElement) ? width : layer.ownerDocument.documentElement.clientWidth;
}

/**
 * Resolved layout: `auto` follows the layer's measured inline size. It is measured before paint
 * when the stack opens and observed while it stays open; unmeasured layers render as a sheet.
 */
function useResolvedVariant(
  layer: HTMLElement | null,
  open: boolean,
  variant: DialogStackVariant,
  breakpoint: number,
): ResolvedVariant {
  const [wide, setWide] = useState(false);

  useLayoutEffect(() => {
    if (variant !== 'auto' || !layer || !open) return;
    const update = (width: number) => {
      if (width > 0) setWide(width >= breakpoint);
    };
    update(layerWidth(layer));
    const view = layer.ownerDocument.defaultView;
    if (!view || typeof view.ResizeObserver === 'undefined') return;
    const observer = new view.ResizeObserver(([entry]) => update(entry?.contentRect.width ?? 0));
    observer.observe(layer);
    return () => observer.disconnect();
  }, [layer, open, variant, breakpoint]);

  return variant === 'auto' ? (wide ? 'dialog' : 'sheet') : variant;
}

function DialogStackRoot(props: DialogStackProps) {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    variant = 'auto',
    breakpoint = DEFAULT_BREAKPOINT,
    contained = false,
  } = props;
  const [raw = EMPTY_STACK, requestValue] = useControlledState<readonly string[]>(
    valueProp,
    defaultValue ?? EMPTY_STACK,
    onValueChange as ((value: readonly string[]) => void) | undefined,
  );
  const entriesRef = useRef(new Map<string, SheetEntry>());
  const [registryVersion, setRegistryVersion] = useState(0);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const [naming, setNamingState] = useState<Naming>({ label: undefined, labelledBy: undefined, describedBy: undefined });
  const escapeOwnedByChildRef = useRef(false);

  // The registry lives in a ref (Contents register in layout effects); the version re-derives the stack.
  const stack = useMemo(() => normalize(raw, entriesRef.current), [raw, registryVersion]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const open = stack.length > 0;
  const resolvedVariant = useResolvedVariant(layer, open, variant, breakpoint);

  const lastWarningRef = useRef('');
  useEffect(() => {
    const entries = entriesRef.current;
    const unknown = raw.filter((key) => !entries.has(key));
    const problems = [
      unknown.length > 0 && `unknown sheet keys ${JSON.stringify(unknown)}`,
      new Set(raw).size !== raw.length && `duplicate sheet keys in ${JSON.stringify(raw)}`,
    ].filter(Boolean);
    const warning = problems.length > 0 ? `ignoring ${problems.join(' and ')}.` : '';
    if (warning && warning !== lastWarningRef.current) warn(warning);
    lastWarningRef.current = warning;
  }, [raw, registryVersion]);

  const register = useCallback((key: string, entry: SheetEntry) => {
    const entries = entriesRef.current;
    if (entries.has(key) && entries.get(key) !== entry) warn(`more than one Content declares "${key}".`);
    entries.set(key, entry);
    setRegistryVersion((version) => version + 1);
  }, []);

  const unregister = useCallback((key: string, entry: SheetEntry) => {
    if (entriesRef.current.get(key) !== entry) return;
    entriesRef.current.delete(key);
    setRegistryVersion((version) => version + 1);
  }, []);

  const setNaming = useCallback((next: Naming) => {
    setNamingState((prev) =>
      prev.label === next.label && prev.labelledBy === next.labelledBy && prev.describedBy === next.describedBy
        ? prev
        : next,
    );
  }, []);

  // The native shell only ever closes as a whole: a completed platform close requests a clear.
  const requestOpenChange = useCallback(
    (next: boolean) => {
      if (!next) requestValue([]);
    },
    [requestValue],
  );
  const native = useNativeDialogRoot(open, requestOpenChange);
  const { setOpen: setNativeOpen } = native;

  // Element focused when the latest accepted request was made: the invoker of the panels it opens.
  const pendingInvokerRef = useRef<HTMLElement | null>(null);

  const request = useCallback(
    (next: readonly string[]) => {
      const current = stackRef.current;
      // A shell closed by the platform while the stack stayed open reopens on the next open request.
      if (next.length > 0 && !contained) setNativeOpen(true);
      if (sameOrder(next, current)) return;
      const doc = layer?.ownerDocument ?? (typeof document === 'undefined' ? undefined : document);
      pendingInvokerRef.current = (doc?.activeElement as HTMLElement | null) ?? null;
      requestValue([...next]);
    },
    [contained, setNativeOpen, layer, requestValue],
  );

  const push = useCallback(
    (key: string) => {
      if (!entriesRef.current.has(key)) {
        warn(`push("${key}") ignored: no Content declares it.`);
        return;
      }
      const current = stackRef.current;
      const index = current.indexOf(key);
      request(index === -1 ? [...current, key] : current.slice(0, index + 1));
    },
    [request],
  );

  const popTo = useCallback(
    (key: string) => {
      const index = stackRef.current.indexOf(key);
      if (index === -1) {
        warn(`popTo("${key}") ignored: the sheet is not open.`);
        return;
      }
      request(stackRef.current.slice(0, index + 1));
    },
    [request],
  );

  const pop = useCallback(() => {
    if (stackRef.current.length > 0) request(stackRef.current.slice(0, -1));
  }, [request]);

  const close = useCallback(() => {
    if (stackRef.current.length > 0) request(EMPTY_STACK);
  }, [request]);

  /** Escape, backdrop and drag: a cancelable request to pop the top sheet. */
  const dismissTop = useCallback(() => {
    const top = stackRef.current.at(-1);
    const entry = top === undefined ? undefined : entriesRef.current.get(top);
    if (!entry?.dismissible) return;
    const event = new Event('cancel', { cancelable: true });
    entry.onCancel?.(event);
    if (!event.defaultPrevented) pop();
  }, [pop]);

  useSheetFocus(stack, entriesRef, pendingInvokerRef, contained);

  const context = useMemo(
    (): DialogStackContextValue => ({
      value: stack,
      push,
      pop,
      popTo,
      close,
      contained,
      variant: resolvedVariant,
      stage,
      setStage,
      setLayer,
      register,
      unregister,
      setNaming,
      dismissTop,
      escapeOwnedByChildRef,
    }),
    [stack, push, pop, popTo, close, contained, resolvedVariant, stage, register, unregister, setNaming, dismissTop],
  );

  let renderedContent: ReactNode;
  if ('pages' in props && props.pages !== undefined) {
    const {
      pages,
      triggerLabel,
      initialPage,
      slots,
      slotProps,
      component,
    } = props;

    const TriggerPart = slots?.trigger ?? DialogStackTrigger;
    const ContentPart = slots?.content ?? DialogStackContent;
    const TitlePart = slots?.title ?? DialogStackTitle;
    const DescriptionPart = slots?.description ?? DialogStackDescription;
    const FooterPart = slots?.footer ?? DialogStackFooter;
    const BackPart = slots?.back ?? DialogStackBack;
    const ClosePart = slots?.close ?? DialogStackClose;

    const initialKey = initialPage ?? pages[0]?.value;
    const pageValues = new Set(pages.map((page) => page.value));
    if (pages.some((page) => !page.value) || pageValues.size !== pages.length)
      throw new Error('DialogStack page values must be nonempty and unique.');
    if (initialKey !== undefined && !pageValues.has(initialKey))
      throw new Error('DialogStack initialPage must reference a page value.');

    renderedContent = (
      <>
        {isRenderable(triggerLabel) && initialKey !== undefined && (
          <TriggerPart {...slotProps?.trigger} value={initialKey}>
            {triggerLabel}
          </TriggerPart>
        )}
        {pages.map((page) => {
          const {
            value: pageValue,
            title: pageTitle,
            content: pageContent,
            description: pageDescription,
            footer: pageFooter,
            back: pageBack,
            close: pageClose,
            dismissible: pageDismissible,
            onCancel: pageOnCancel,
            appearance: pageAppearance,
            withDescription: pageWithDescription,
            slotProps: pageSlotProps,
          } = page;

          const mergedSlotProps: DialogStackSlotProps = {
            ...slotProps,
            ...pageSlotProps,
          };

          return (
            <ContentPart
              key={pageValue}
              value={pageValue}
              dismissible={pageDismissible}
              onCancel={pageOnCancel}
              appearance={pageAppearance}
              withDescription={pageWithDescription}
              {...mergedSlotProps.content}
              component={component ?? mergedSlotProps.content?.component}
              slots={{ ...mergedSlotProps.content?.slots, root: slots?.root ?? mergedSlotProps.content?.slots?.root }}
              slotProps={{ root: mergedSlotProps.root ?? mergedSlotProps.content?.slotProps?.root }}
            >
              {(pageBack !== undefined || pageClose !== undefined) && (
                <div data-ui="dialog-stack-top-bar" css={topBarStyle}>
                  {pageBack !== undefined && <BackPart label={pageBack} {...mergedSlotProps.back} />}
                  {pageClose !== undefined && (
                    <div css={topBarEndStyle}>
                      <ClosePart label={pageClose} {...mergedSlotProps.close} />
                    </div>
                  )}
                </div>
              )}
              <GeneratedRoot component={slots?.header} rootSlot={mergedSlotProps.header} marker="dialog-stack-header">
                <TitlePart {...mergedSlotProps.title}>{pageTitle}</TitlePart>
                {isRenderable(pageDescription) && (
                  <DescriptionPart {...mergedSlotProps.description}>{pageDescription}</DescriptionPart>
                )}
              </GeneratedRoot>
              <GeneratedRoot component={slots?.body} rootSlot={mergedSlotProps.body} marker="dialog-stack-body">
                {pageContent}
              </GeneratedRoot>
              {isRenderable(pageFooter) && (
                <FooterPart {...mergedSlotProps.footer}>{pageFooter}</FooterPart>
              )}
            </ContentPart>
          );
        })}
      </>
    );
  } else {
    renderedContent = props.children;
  }

  return (
    <DialogStackContext.Provider value={context}>
      {renderedContent}
      {contained ? (
        <ContainedLayer open={open} variant={resolvedVariant} />
      ) : (
        <ViewportLayer native={{ ...native, open }} naming={naming} variant={resolvedVariant} />
      )}
    </DialogStackContext.Provider>
  );
}

DialogStackRoot.displayName = 'DialogStack';

/**
 * Focus follows accepted stack changes. A push focuses the new top (an autoFocus element, else
 * its heading, else the panel); a pop returns to the exact invoker inside the retained parent;
 * a clear returns to the outer invoker. Runs after the shell's showModal(), so it wins over the
 * dialog's own initial focus.
 */
function useSheetFocus(
  stack: readonly string[],
  entriesRef: RefObject<Map<string, SheetEntry>>,
  pendingInvokerRef: RefObject<HTMLElement | null>,
  contained: boolean,
) {
  const previousRef = useRef<readonly string[]>(EMPTY_STACK);
  const invokersRef = useRef(new Map<string, HTMLElement | null>());
  const autoFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const previous = previousRef.current;
    if (sameOrder(previous, stack)) return;
    const top = stack.at(-1);
    const panel = top === undefined ? null : (entriesRef.current.get(top)?.panel ?? null);
    const active = panel?.ownerDocument.activeElement as HTMLElement | null | undefined;
    // React focuses an autoFocus element while committing a pushed panel, before this effect.
    autoFocusRef.current = panel && active && panel.contains(active) && active !== panel ? active : null;
    const invoker = pendingInvokerRef.current ?? (autoFocusRef.current ? null : (active ?? null));
    pendingInvokerRef.current = null;
    for (const key of stack) {
      if (!previous.includes(key)) invokersRef.current.set(key, invoker);
    }
  }, [stack, entriesRef, pendingInvokerRef]);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = stack;
    if (sameOrder(previous, stack)) return;
    const invokers = invokersRef.current;
    const top = stack.at(-1);

    if (top === undefined) {
      const invoker = previous[0] === undefined ? undefined : invokers.get(previous[0]);
      if (focusable(invoker)) invoker.focus();
    } else {
      const entry = entriesRef.current.get(top);
      const panel = entry?.panel;
      if (panel) {
        const wasOpen = previous.includes(top);
        const child = wasOpen ? previous[previous.indexOf(top) + 1] : undefined;
        const invoker = child === undefined ? undefined : invokers.get(child);
        const target = wasOpen
          ? focusable(invoker) && panel.contains(invoker)
            ? invoker
            : fallbackTarget(panel)
          : (autoFocusRef.current ?? panel.querySelector<HTMLElement>('[autofocus]') ?? fallbackTarget(panel));
        target.focus();
      }
    }
    autoFocusRef.current = null;
    for (const key of invokers.keys()) {
      if (!stack.includes(key)) invokers.delete(key);
    }
  }, [stack, entriesRef]);

  // Unmounting a contained layer returns focus like a close; the native shell does this itself.
  useEffect(
    () => () => {
      if (!contained) return;
      const first = previousRef.current[0];
      const invoker = first === undefined ? undefined : invokersRef.current.get(first);
      if (focusable(invoker)) invoker.focus();
    },
    [contained],
  );
}

function fallbackTarget(panel: HTMLElement): HTMLElement {
  return (
    panel.querySelector<HTMLElement>('[data-ui~="dialog-stack-title"]') ??
    panel.querySelector<HTMLElement>('[data-ui~="dialog-stack-back"]:not(:disabled)') ??
    panel
  );
}

interface ViewportLayerProps {
  native: ReturnType<typeof useNativeDialogRoot> & { open: boolean };
  naming: Naming;
  variant: ResolvedVariant;
}

function ViewportLayer({ native, naming, variant }: ViewportLayerProps) {
  const { setStage, setLayer, dismissTop, escapeOwnedByChildRef } = useDialogStackContext('Layer');
  const shellRef = useRef<HTMLDialogElement | null>(null);

  // Escape arrives as the shell's native cancel. It never reaches the shared close path: an
  // accepted request pops one sheet; a noncancelable platform cancel is left to the `close`
  // reconciliation (a clear request).
  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (event.target !== shellRef.current) return;
    event.preventDefault();
    if (escapeOwnedByChildRef.current) {
      escapeOwnedByChildRef.current = false;
      return;
    }
    if (event.nativeEvent.cancelable) dismissTop();
  };

  const dialogProps = useNativeDialog(
    { ...native, requestClose: dismissTop },
    { onCancel: handleCancel },
    undefined,
    shellRef,
  );
  const ref = useMergeRefs([dialogProps.ref, setLayer]);

  return (
    <dialog
      {...dialogProps}
      ref={ref}
      data-ui="dialog-stack-layer"
      data-variant={variant}
      aria-modal="true"
      aria-label={naming.label}
      aria-labelledby={naming.labelledBy}
      aria-describedby={naming.describedBy}
      css={shellStyle}
    >
      <div ref={setStage} data-ui="dialog-stack-stage" css={stageStyle} />
    </dialog>
  );
}

ViewportLayer.displayName = 'DialogStack.Layer';

function ContainedLayer({ open, variant }: { open: boolean; variant: ResolvedVariant }) {
  const { setStage, setLayer, dismissTop } = useDialogStackContext('Layer');
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const { context } = useFloating({ open, elements: { floating: element } });
  const ref = useMergeRefs<HTMLDivElement>([setElement, setLayer]);

  const layer = (
    <div
      ref={ref}
      data-ui="dialog-stack-layer"
      data-contained=""
      data-variant={variant}
      hidden={!open}
      css={containedLayerStyle}
    >
      <div data-ui="dialog-stack-scrim" aria-hidden="true" css={scrimStyle} onClick={dismissTop} />
      <div ref={setStage} data-ui="dialog-stack-stage" css={stageStyle} />
    </div>
  );

  // Floating UI holds focus in the layer and makes everything outside it inert, restoring
  // each element's previous state on close. Focus moves and returns through useSheetFocus.
  return (
    <FloatingFocusManager
      context={context}
      disabled={!open || !element}
      modal
      outsideElementsInert
      initialFocus={-1}
      returnFocus={false}
      closeOnFocusOut={false}
    >
      {layer}
    </FloatingFocusManager>
  );
}

ContainedLayer.displayName = 'DialogStack.Layer';

function DialogStackTrigger({ ref, value, onClick, className, sx, ...rest }: DialogStackTriggerProps) {
  const { value: stack, push } = useDialogStackContext('Trigger');

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) push(value);
  };

  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...rest}
          ref={ref}
          data-ui="dialog-stack-trigger"
          aria-haspopup="dialog"
          aria-expanded={stack.includes(value)}
          onClick={handleClick}
          className={className}
        />
      )}
    </WithSx>
  );
}

DialogStackTrigger.displayName = 'DialogStack.Trigger';

interface DragSession {
  pointerId: number;
  start: number;
  extent: number;
  offset: number;
  samples: { position: number; time: number }[];
}

/** Handle drag on the top panel; null (no listeners) on parents, nondismissible or opted-out panels. */
function useHandleDrag(enabled: boolean, panelRef: RefObject<HTMLDivElement | null>, dismissTop: () => void) {
  const sessionRef = useRef<DragSession | null>(null);
  const springRef = useRef<AnimationPlaybackControls | null>(null);
  // Current offset, so grabbing a panel mid-spring continues from there.
  const offsetRef = useRef(0);

  const reset = useCallback(() => {
    springRef.current?.stop();
    springRef.current = null;
    sessionRef.current = null;
    offsetRef.current = 0;
    if (panelRef.current) panelRef.current.style.translate = '';
  }, [panelRef]);

  useEffect(() => reset, [reset]);

  return useMemo(() => {
    if (!enabled) return null;

    const moveTo = (panel: HTMLElement, offset: number) => {
      offsetRef.current = offset;
      panel.style.translate = offset === 0 ? '' : `0 ${offset}px`;
    };

    const finish = (event: PointerEvent<HTMLDivElement>, release: boolean) => {
      const session = sessionRef.current;
      const panel = panelRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      sessionRef.current = null;
      event.currentTarget.removeAttribute('data-dragging');
      // Velocity over the last moments before release: a drag that paused before letting go is not a fling.
      const samples = [...session.samples, { position: event.clientY, time: event.timeStamp }].filter(
        (sample) => event.timeStamp - sample.time <= GESTURE.velocityWindowMs,
      );
      const first = samples[0];
      const last = samples.at(-1);
      const elapsed = first && last ? (last.time - first.time) / 1000 : 0;
      const velocity = first && last && elapsed > 0 ? (last.position - first.position) / elapsed : 0;
      // An accepted pop unmounts the panel at once; otherwise it springs home.
      if (release && (session.offset >= session.extent * GESTURE.distanceRatio || velocity >= GESTURE.velocity)) {
        dismissTop();
      }
      if (!panel || !panel.isConnected || session.offset === 0) return;
      springRef.current = animate(session.offset, 0, {
        ...GESTURE.releaseSpring,
        velocity,
        onUpdate: (offset) => moveTo(panel, offset),
      });
    };

    return {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        const panel = panelRef.current;
        if (!event.isPrimary || event.button !== 0 || !panel) return;
        if (event.target instanceof Element && event.target.closest(NO_DRAG_SELECTOR)) return;
        if (panel.ownerDocument.defaultView?.matchMedia(REDUCED_MOTION_QUERY).matches) return;
        springRef.current?.stop();
        const offset = offsetRef.current;
        sessionRef.current = {
          pointerId: event.pointerId,
          start: event.clientY - offset,
          extent: panel.getBoundingClientRect().height,
          offset,
          samples: [{ position: event.clientY, time: event.timeStamp }],
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.setAttribute('data-dragging', '');
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const session = sessionRef.current;
        const panel = panelRef.current;
        if (!session || session.pointerId !== event.pointerId || !panel) return;
        const travel = event.clientY - session.start;
        session.offset = travel >= 0 ? travel : travel * GESTURE.opposingResistance;
        session.samples = [...session.samples, { position: event.clientY, time: event.timeStamp }].filter(
          (sample) => event.timeStamp - sample.time <= GESTURE.velocityWindowMs,
        );
        moveTo(panel, session.offset);
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finish(event, false),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => finish(event, false),
    };
  }, [enabled, panelRef, dismissTop]);
}

function DialogStackContent({
  ref, value, className, sx, component, slots, slotProps, appearance,
  dismissible = true, onCancel, withDescription = true, ...props
}: DialogStackContentProps) {
  const selected = { ...props, ...slotProps?.root };
  const {
    children,
    onKeyDown,
    onKeyDownCapture,
    onKeyUp,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = selected;
  const root = useDialogStackContext('Content');
  const { contained, variant, stage, register, unregister, setNaming, dismissTop, escapeOwnedByChildRef } = root;
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const [hasTitle, setHasTitle] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const index = root.value.indexOf(value);
  const inStack = index !== -1;
  const depth = root.value.length - 1 - index;
  const isTop = inStack && depth === 0;

  // One stable entry per declaration; its fields follow the latest props.
  const [entry] = useState<SheetEntry>(() => ({ dismissible, onCancel, panel: null }));
  useLayoutEffect(() => {
    entry.dismissible = dismissible;
    entry.onCancel = onCancel;
  });
  useLayoutEffect(() => {
    register(value, entry);
    return () => unregister(value, entry);
  }, [value, entry, register, unregister]);

  const labelledBy = joinIds(ariaLabelledBy, hasTitle && titleId);
  const describedBy = joinIds(ariaDescribedBy, withDescription && hasDescription && descriptionId);

  // The viewport shell carries the top sheet's name and description.
  useLayoutEffect(() => {
    if (isTop && !contained) setNaming({ label: ariaLabel, labelledBy, describedBy });
  }, [isTop, contained, ariaLabel, labelledBy, describedBy, setNaming]);

  // The active size lets parents peek above the top panel whatever their own content height.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const view = panel?.ownerDocument.defaultView;
    if (!isTop || !panel || !stage || !view || typeof view.ResizeObserver === 'undefined') return;
    const observer = new view.ResizeObserver(() => {
      stage.style.setProperty('--dialog-stack-active-size', `${panel.offsetHeight}px`);
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [isTop, stage]);

  const setPanel = useCallback(
    (element: HTMLDivElement | null) => {
      entry.panel = element;
    },
    [entry],
  );
  const panelRefs = useMergeRefs([panelRef, setPanel]);
  const stageRef = useRef<HTMLElement | null>(stage);
  stageRef.current = stage;

  const gesture = useHandleDrag(isTop && dismissible && !('data-sheet-no-drag' in rest), panelRef, dismissTop);

  const contentContext = useMemo(
    () => ({ titleId, descriptionId, setHasTitle, setHasDescription }),
    [titleId, descriptionId],
  );

  // Capture phase: a child overlay's own Escape handler may stop propagation before bubbling.
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDownCapture?.(event);
    if (event.key === 'Escape') {
      escapeOwnedByChildRef.current = Boolean(panelRef.current?.querySelector(CHILD_LAYER_SELECTOR));
    }
  };
  // Contained layers have no native cancel: Escape is handled here, once, by the top panel.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!contained || !isTop || event.key !== 'Escape' || event.nativeEvent.isComposing) return;
    if (event.defaultPrevented || escapeOwnedByChildRef.current) return;
    event.preventDefault();
    dismissTop();
  };
  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyUp?.(event);
    if (event.key === 'Escape') escapeOwnedByChildRef.current = false;
  };

  if (!inStack || !stage) return null;

  const dialogRole = contained && isTop;
  const panelStyleVars = {
    '--dialog-stack-index': index,
    '--dialog-stack-depth': depth,
  } as CSSProperties;

  return createPortal(
    <ThemeBoundary>
      <SheetContentContext.Provider value={contentContext}>
        <SurfaceRoot
          {...rest}
          ref={ref}
          component={component}
          slots={slots}
          slotProps={slotProps}
          appearance={appearance}
          owner="DialogStack.Content"
          marker="dialog-stack"
          variant="floating"
          className={className}
          structure={[panelStyle, panelVariantStyles[variant], !isTop && parentStyles[variant]]}
          sx={sx}
          internalRef={panelRefs}
          containerRef={stageRef}
          style={props.style}
          reservedStyle={panelStyleVars}
          reservedStyleKeys={PANEL_MOTION_STYLE_KEYS}
          attributes={{
            'data-state': isTop ? 'active' : 'parent',
            'data-variant': variant,
            'data-depth': depth,
            role: dialogRole ? 'dialog' : undefined,
            'aria-modal': dialogRole ? 'true' : undefined,
            'aria-label': dialogRole ? ariaLabel : undefined,
            'aria-labelledby': dialogRole ? labelledBy : undefined,
            'aria-describedby': dialogRole ? describedBy : undefined,
            'aria-hidden': isTop ? undefined : 'true',
            inert: !isTop,
            tabIndex: -1,
            onKeyDownCapture: handleKeyDownCapture,
            onKeyDown: handleKeyDown,
            onKeyUp: handleKeyUp,
          }}
          wrapChildren={(body) => (
            <>
              <div
                {...gesture}
                data-ui="dialog-stack-handle"
                data-draggable={gesture ? '' : undefined}
                aria-hidden="true"
                css={handleStyle}
              />
              <div data-ui="dialog-stack-body" css={scrollerStyle}>
                {body}
              </div>
            </>
          )}
        >
          {children}
        </SurfaceRoot>
      </SheetContentContext.Provider>
    </ThemeBoundary>,
    stage,
  );
}

DialogStackContent.displayName = 'DialogStack.Content';

function DialogStackTitle({ ref, level = 2, className, sx, children, ...props }: DialogStackTitleProps) {
  const { titleId, setHasTitle } = useSheetContentContext('Title');
  const present = hasText(children);

  useEffect(() => {
    if (!present) return;
    setHasTitle(true);
    return () => setHasTitle(false);
  }, [present, setHasTitle]);

  if (!present) return null;
  const Heading = `h${level}` as const;

  return (
    <WithSx className={className} styles={titleStyle} sx={sx}>
      {(className) => (
        <Heading
          tabIndex={-1}
          {...props}
          ref={ref}
          id={titleId}
          data-ui="dialog-stack-title"
          className={className}
        >
          {children}
        </Heading>
      )}
    </WithSx>
  );
}

DialogStackTitle.displayName = 'DialogStack.Title';

function DialogStackDescription({ ref, className, sx, children, ...props }: DialogStackDescriptionProps) {
  const { descriptionId, setHasDescription } = useSheetContentContext('Description');
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
        <p {...props} ref={ref} id={descriptionId} data-ui="dialog-stack-description" className={className}>
          {children}
        </p>
      )}
    </WithSx>
  );
}

DialogStackDescription.displayName = 'DialogStack.Description';

function DialogStackFooter({ ref, className, sx, ...props }: DialogStackFooterProps) {
  useSheetContentContext('Footer');
  return (
    <WithSx className={className} styles={footerStyle} sx={sx}>
      {(className) => <div {...props} ref={ref} data-ui="dialog-stack-footer" className={className} />}
    </WithSx>
  );
}

DialogStackFooter.displayName = 'DialogStack.Footer';

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" css={backIconStyle}>
      <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  );
}

function DialogStackBack({ ref, label, onClick, className, sx, children, ...rest }: DialogStackBackProps) {
  const { pop } = useDialogStackContext('Back');
  useSheetContentContext('Back');

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) pop();
  };

  return (
    <WithSx className={className} styles={actionStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...rest}
          ref={ref}
          aria-label={label}
          data-ui="dialog-stack-back"
          onClick={handleClick}
          className={className}
        >
          <BackIcon />
          {children}
        </button>
      )}
    </WithSx>
  );
}

DialogStackBack.displayName = 'DialogStack.Back';

function DialogStackClose({ ref, label, onClick, className, sx, children, ...rest }: DialogStackCloseProps) {
  const { close } = useDialogStackContext('Close');

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) close();
  };

  return (
    <WithSx className={className} styles={actionStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...rest}
          ref={ref}
          aria-label={label}
          data-ui="dialog-stack-close"
          onClick={handleClick}
          className={className}
        >
          {isRenderable(children) ? children : <CloseIcon />}
        </button>
      )}
    </WithSx>
  );
}

DialogStackClose.displayName = 'DialogStack.Close';

export const DialogStack = Object.assign(DialogStackRoot, {
  Trigger: DialogStackTrigger,
  Content: DialogStackContent,
  Title: DialogStackTitle,
  Description: DialogStackDescription,
  Footer: DialogStackFooter,
  Back: DialogStackBack,
  Close: DialogStackClose,
});
