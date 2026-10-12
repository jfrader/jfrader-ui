// APG pattern: tooltip. The trigger is described by the tooltip (`aria-describedby`, wired by
// useRole while open). Opens on hover after `openDelay` and immediately on keyboard focus
// (focus-visible); closes on unhover after `closeDelay`, on blur, and on Escape.
// Keyboard map: Tab onto the trigger opens; Escape closes and keeps focus on the trigger.
// Contract: tooltip content is never focusable and never interactive (put actions in a
// Popover). It IS pointer-hoverable per WCAG 1.4.13 — the pointer may rest on the tooltip
// without it disappearing, across the offset gap and while reading. No focus manager is used.
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  useDismiss,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  type FloatingRootContext,
  type Placement,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useControlledState } from '../../utils/use-controlled-state';

const DEFAULT_OPEN_DELAY_MS = 300;
const DEFAULT_CLOSE_DELAY_MS = 100;

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** Hover delay before opening, in ms. Keyboard focus opens immediately. */
  openDelay?: number;
  /** Delay before closing after the pointer leaves trigger and content, in ms. */
  closeDelay?: number;
  children?: ReactNode;
}

export interface TooltipTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface TooltipContentProps extends ComponentPropsWithRef<'div'>, SxProps {}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface TooltipContextValue {
  open: boolean;
  refs: OverlayFloating['refs'];
  floatingStyles: CSSProperties;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltipContext(part: string): TooltipContextValue {
  const context = useContext(TooltipContext);
  if (!context) throw new Error(`Tooltip.${part} must be rendered inside <Tooltip>.`);
  return context;
}

export const tooltipContentStyle = css({
  boxSizing: 'border-box',
  backgroundColor: vars.color.bgSoft,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  boxShadow: vars.shadow.raised,
  padding: `${vars.space[1]} ${vars.space[2]}`,
  maxInlineSize: `min(260px, calc(100vw - 2 * ${vars.space[4]}))`,
  overflowWrap: 'anywhere',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});

/** The tooltip interaction chain, shared with parts whose operative element cannot be a Tooltip.Trigger. */
export function useTooltipInteractions(
  context: FloatingRootContext,
  {
    enabled = true,
    openDelay = DEFAULT_OPEN_DELAY_MS,
    closeDelay = DEFAULT_CLOSE_DELAY_MS,
  }: { enabled?: boolean; openDelay?: number; closeDelay?: number } = {},
): UseInteractionsReturn {
  // `move: false` keeps moving the pointer onto the content from re-triggering hover logic on
  // the reference; useHover still keeps the tooltip open while the pointer rests on it, and
  // the close delay covers the offset gap (WCAG 1.4.13 hoverable + persistent).
  const hover = useHover(context, { enabled, delay: { open: openDelay, close: closeDelay }, move: false });
  const focus = useFocus(context, { enabled });
  const dismiss = useDismiss(context, { escapeKey: true });
  const role = useRole(context, { role: 'tooltip' });
  return useInteractions([hover, focus, dismiss, role]);
}

function TooltipOverlay({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'top',
  openDelay = DEFAULT_OPEN_DELAY_MS,
  closeDelay = DEFAULT_CLOSE_DELAY_MS,
  children,
}: TooltipProps) {
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const { refs, floatingStyles, context } = useOverlayFloating({ open, placement, onOpenChange: requestOpenChange });
  const { getReferenceProps, getFloatingProps } = useTooltipInteractions(context, { openDelay, closeDelay });

  const value = useMemo(
    () => ({ open, refs, floatingStyles, getReferenceProps, getFloatingProps }),
    [open, refs, floatingStyles, getReferenceProps, getFloatingProps],
  );

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
}

function TooltipRoot(props: TooltipProps) {
  return (
    <IsolatedOverlay>
      <TooltipOverlay {...props} />
    </IsolatedOverlay>
  );
}

TooltipRoot.displayName = 'Tooltip';

function TooltipTrigger({ ref, 'aria-describedby': ariaDescribedByProp, className, sx, ...rest }: TooltipTriggerProps) {
  const { refs, getReferenceProps } = useTooltipContext('Trigger');
  const mergedRef = useMergeRefs([refs.setReference, ref]);
  const referenceProps = getReferenceProps(rest);
  // useRole sets aria-describedby on the reference; merge it with the consumer's ids.
  const describedBy =
    [ariaDescribedByProp, referenceProps['aria-describedby'] as string | undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...referenceProps}
          ref={mergedRef}
          aria-describedby={describedBy}
          data-ui="tooltip-trigger"
          className={className}
        />
      )}
    </WithSx>
  );
}

TooltipTrigger.displayName = 'Tooltip.Trigger';

function TooltipSurface({ ref, style, className, sx, dir, ...rest }: TooltipContentProps) {
  const { refs, floatingStyles, getFloatingProps } = useTooltipContext('Content');
  const mergedRef = useMergeRefs([refs.setFloating, ref]);
  const [direction] = useState(() => {
    const reference = refs.domReference.current;
    return reference?.ownerDocument.defaultView?.getComputedStyle(reference).direction;
  });

  // getFloatingProps adds tabIndex={-1}; drop it so the tooltip is never focusable. Do NOT
  // set pointer-events: none — hoverability is part of the WCAG 1.4.13 contract.
  const { tabIndex: ignoredTabIndex, ...floatingProps } = getFloatingProps(rest);
  void ignoredTabIndex;

  return (
    <WithSx className={className} styles={tooltipContentStyle} sx={sx}>
      {(className) => (
        <div
          {...floatingProps}
          ref={mergedRef}
          dir={dir ?? direction}
          data-ui="tooltip"
          style={{ ...style, ...floatingStyles }}
          className={className}
        />
      )}
    </WithSx>
  );
}

function TooltipContent(props: TooltipContentProps) {
  const { open } = useTooltipContext('Content');
  if (!open) return null;
  return (
    <OverlayPortal>
      <TooltipSurface {...props} />
    </OverlayPortal>
  );
}

TooltipContent.displayName = 'Tooltip.Content';

export const Tooltip = Object.assign(TooltipRoot, { Trigger: TooltipTrigger, Content: TooltipContent });
