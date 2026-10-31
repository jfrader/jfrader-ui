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
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
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
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useControlledState } from '../../utils/use-controlled-state';

const DEFAULT_OPEN_DELAY_MS = 300;
const DEFAULT_CLOSE_DELAY_MS = 100;

export interface TooltipBaseProps {
  /** Control whether the tooltip is shown. */
  open?: boolean;
  /** Show the tooltip initially when uncontrolled. Defaults to false. */
  defaultOpen?: boolean;
  /** Receive visibility requests from hover, focus, and dismissal. */
  onOpenChange?: (open: boolean) => void;
  /** Prefer this side of the trigger; may flip to fit the viewport. Defaults to `top`. */
  placement?: Placement;
  /** Hover delay before opening, in ms. Keyboard focus opens immediately. */
  openDelay?: number;
  /** Delay before closing after the pointer leaves trigger and content, in ms. */
  closeDelay?: number;
  /** Compose `Tooltip.Trigger` and `Tooltip.Content` instead of using generated parts. */
  children?: ReactNode;
}

export interface TooltipComposedProps extends TooltipBaseProps {
  triggerLabel?: never;
  content?: never;
  slots?: never;
  slotProps?: never;
}

type TooltipGeneratedPartProps<Props> = Omit<Props, 'children'> & { sx?: Interpolation<Theme> };

export interface TooltipShorthandProps extends Omit<TooltipBaseProps, 'children'> {
  /** Name the generated trigger button. */
  triggerLabel: ReactNode;
  /** Show non-interactive help on hover or focus. */
  content: ReactNode;
  children?: never;
  /** Replace native roots with components that forward all supplied props and ref. */
  slots?: {
    /** Replaces the button that opens the tooltip. */
    trigger?: ComponentType<ComponentPropsWithRef<'button'>>;
    /** Replaces the floating tooltip overlay container. */
    content?: ComponentType<ComponentPropsWithRef<'div'>>;
  };
  /** Pass props and `sx` to the generated trigger and tooltip content. */
  slotProps?: {
    /** Button element that triggers the tooltip on hover or focus. */
    trigger?: TooltipGeneratedPartProps<TooltipTriggerProps>;
    /** Floating tooltip overlay container displaying the help content. */
    content?: TooltipGeneratedPartProps<TooltipContentProps>;
  };
}

export type TooltipProps = TooltipComposedProps | TooltipShorthandProps;

export type TooltipTriggerProps<Host extends 'button' | 'span' = 'button'> = ComponentPropsWithRef<Host> & SxProps & {
  /** Render a native span with `as="span"`, without button styling. Native props and ref follow the selected host. Defaults to `button`. */
  as?: Host;
  /** Describe the trigger with the tooltip. Set false when it repeats the trigger's readable text. Defaults to true. */
  describe?: boolean;
  /** Add markers alongside `tooltip-trigger`. */
  'data-ui'?: string;
};
export interface TooltipContentProps extends ComponentPropsWithRef<'div'>, SxProps {}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface TooltipContextValue {
  slots: TooltipShorthandProps['slots'];
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
  zIndex: vars.zIndex.popover,
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
    focusVisibleOnly = false,
  }: {
    enabled?: boolean;
    openDelay?: number;
    closeDelay?: number;
    /** Only keyboard focus (:focus-visible) opens the tooltip, so a programmatic focus cannot flash it. */
    focusVisibleOnly?: boolean;
  } = {},
): UseInteractionsReturn {
  // `move: false` keeps moving the pointer onto the content from re-triggering hover logic on
  // the reference; useHover still keeps the tooltip open while the pointer rests on it, and
  // the close delay covers the offset gap (WCAG 1.4.13 hoverable + persistent).
  const hover = useHover(context, { enabled, delay: { open: openDelay, close: closeDelay }, move: false });
  const focus = useFocus(context, { enabled, visibleOnly: focusVisibleOnly });
  const dismiss = useLayerDismiss(context, 'leaf');
  const role = useRole(context, { role: 'tooltip' });
  return useInteractions([hover, focus, ...dismiss, role]);
}

function TooltipOverlay({
  nodeId,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'top',
  openDelay = DEFAULT_OPEN_DELAY_MS,
  closeDelay = DEFAULT_CLOSE_DELAY_MS,
  children,
  slots,
}: TooltipBaseProps & Pick<TooltipShorthandProps, 'slots'> & { nodeId: string | undefined }) {
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const { refs, floatingStyles, context } = useOverlayFloating({ open, placement, nodeId, onOpenChange: requestOpenChange });
  const { getReferenceProps, getFloatingProps } = useTooltipInteractions(context, { openDelay, closeDelay });

  const value = useMemo(
    () => ({ open, refs, floatingStyles, getReferenceProps, getFloatingProps, slots }),
    [open, refs, floatingStyles, getReferenceProps, getFloatingProps, slots],
  );

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
}

function TooltipRoot(props: TooltipProps) {
  const children = props.triggerLabel !== undefined ? (
    <>
      <TooltipTrigger {...props.slotProps?.trigger}>{props.triggerLabel}</TooltipTrigger>
      <TooltipContent {...props.slotProps?.content}>{props.content}</TooltipContent>
    </>
  ) : props.children;
  return (
    <OverlayLayer>
      {(nodeId) => <TooltipOverlay {...props} nodeId={nodeId}>{children}</TooltipOverlay>}
    </OverlayLayer>
  );
}

TooltipRoot.displayName = 'Tooltip';

function TooltipTrigger<Host extends 'button' | 'span' = 'button'>({ as, describe = true, ref, 'aria-describedby': ariaDescribedByProp, className, sx, ...rest }: TooltipTriggerProps<Host>) {
  const { refs, getReferenceProps, slots } = useTooltipContext('Trigger');
  const Root = as === 'span' ? 'span' : slots?.trigger ?? 'button';
  const mergedRef = useMergeRefs<HTMLElement>([refs.setReference, ref]);
  const referenceProps = getReferenceProps(rest);
  // Preserve external descriptions even when the tooltip repeats the trigger's readable text.
  const describedBy =
    [ariaDescribedByProp, describe && referenceProps['aria-describedby'] as string | undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <WithSx className={className} styles={as === 'span' ? undefined : triggerStyle} sx={sx}>
      {(className) => (
        <Root
          type={as === 'span' ? undefined : 'button'}
          {...referenceProps}
          ref={mergedRef}
          aria-describedby={describedBy}
          data-ui={[...new Set(['tooltip-trigger', rest['data-ui']].flatMap((value) => typeof value === 'string' ? value.split(/\s+/) : []).filter(Boolean))].join(' ')}
          className={className}
        />
      )}
    </WithSx>
  );
}

TooltipTrigger.displayName = 'Tooltip.Trigger';

function TooltipSurface({ ref, style, className, sx, dir, ...rest }: TooltipContentProps) {
  const { refs, floatingStyles, getFloatingProps, slots } = useTooltipContext('Content');
  const Root = slots?.content ?? 'div';
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
        <Root
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
