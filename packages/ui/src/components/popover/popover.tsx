// Non-modal popover with dialog semantics (role="dialog", no aria-modal), positioned by
// @floating-ui/react and portaled to the body (or the ThemeRoot's `portalContainer`).
// Keyboard map: Enter/Space on the trigger toggles; Escape closes; Tab moves through the
// content and out without closing it (non-modal).
// Focus contract: non-modal focus management (FloatingFocusManager modal={false},
// initialFocus={-1}, returnFocus={false}, closeOnFocusOut={false}) preserves the page's tab
// order across the portal — there is no initial focus and no trap. Escape returns focus to
// the trigger only after the close is actually accepted (a rejected controlled dismissal
// keeps focus where it was); an outside press closes without moving focus.
// Nesting: the popover is an overlay layer; while a nested layer (e.g. a HoverCard inside the
// content) is open, Escape and outside presses dismiss that layer first.
// Naming: role="dialog" needs an accessible name — prefer `aria-labelledby` pointing at a
// visible heading inside the content; use `aria-label` only when no visible label exists.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  FloatingFocusManager,
  useClick,
  useDismiss,
  useInteractions,
  useMergeRefs,
  useRole,
  type Placement,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { raisedSurface } from '../../styling/surface';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { CONTAINER_LAYER_DISMISS, OverlayLayer } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useControlledState } from '../../utils/use-controlled-state';

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  children?: ReactNode;
}

export interface PopoverTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface PopoverContentProps extends ComponentPropsWithRef<'div'>, SxProps {}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface PopoverContextValue {
  open: boolean;
  refs: OverlayFloating['refs'];
  floatingContext: OverlayFloating['context'];
  floatingStyles: CSSProperties;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(part: string): PopoverContextValue {
  const context = useContext(PopoverContext);
  if (!context) throw new Error(`Popover.${part} must be rendered inside <Popover>.`);
  return context;
}

const contentStyle = css({
  ...raisedSurface,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.overlay,
  padding: vars.space[4],
  minInlineSize: '200px',
  maxInlineSize: 'min(360px, calc(100vw - 32px))',
  fontSize: vars.textSize.sm,
});

function PopoverLayer({
  nodeId,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom',
  children,
}: PopoverProps & { nodeId: string | undefined }) {
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const pendingFocusRestoreRef = useRef(false);

  const { refs, floatingStyles, context } = useOverlayFloating({
    open,
    placement,
    nodeId,
    onOpenChange: (next, _event, reason) => {
      // Escape requests a close; focus is restored only once the close is actually applied.
      if (!next) pendingFocusRestoreRef.current = reason === 'escape-key';
      requestOpenChange(next);
    },
  });

  // A rejected controlled dismissal keeps the popover open, so focus stays inside it.
  useEffect(() => {
    if (!open && pendingFocusRestoreRef.current) {
      pendingFocusRestoreRef.current = false;
      refs.domReference.current?.focus();
    }
  }, [open, refs]);

  const click = useClick(context);
  const dismiss = useDismiss(context, CONTAINER_LAYER_DISMISS);
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const value = useMemo(
    () => ({ open, refs, floatingContext: context, floatingStyles, getReferenceProps, getFloatingProps }),
    [open, refs, context, floatingStyles, getReferenceProps, getFloatingProps],
  );

  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

function PopoverRoot(props: PopoverProps) {
  return <OverlayLayer>{(nodeId) => <PopoverLayer {...props} nodeId={nodeId} />}</OverlayLayer>;
}

PopoverRoot.displayName = 'Popover';

function PopoverTrigger({ ref, className, sx, ...props }: PopoverTriggerProps) {
  const { refs, getReferenceProps } = usePopoverContext('Trigger');
  const mergedRef = useMergeRefs([refs.setReference, ref]);

  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...getReferenceProps(props)}
          ref={mergedRef}
          data-ui="popover-trigger"
          className={className}
        />
      )}
    </WithSx>
  );
}

PopoverTrigger.displayName = 'Popover.Trigger';

function PopoverContent({ ref, style, className, sx, ...rest }: PopoverContentProps) {
  const { open, refs, floatingContext, floatingStyles, getFloatingProps } = usePopoverContext('Content');
  const mergedRef = useMergeRefs([refs.setFloating, ref]);

  if (!open) return null;

  return (
    <OverlayPortal>
      {/* Non-modal: keeps the page's tab order across the portal (Tab reaches the content),
          while suppressing initial focus, the trap and automatic focus return. */}
      <FloatingFocusManager
        context={floatingContext}
        modal={false}
        initialFocus={-1}
        returnFocus={false}
        closeOnFocusOut={false}
      >
        <WithSx className={className} styles={contentStyle} sx={sx}>
          {(className) => (
            <div
              {...getFloatingProps(rest)}
              ref={mergedRef}
              data-ui="popover"
              style={{ ...style, ...floatingStyles }}
              className={className}
            />
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

PopoverContent.displayName = 'Popover.Content';

export const Popover = Object.assign(PopoverRoot, { Trigger: PopoverTrigger, Content: PopoverContent });
