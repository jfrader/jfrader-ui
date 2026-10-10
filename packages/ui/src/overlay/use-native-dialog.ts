// Shared native <dialog> lifecycle for Dialog and CommandPalette.
//
// Lifecycle contract — the Root owns logical `open`, Content owns native state:
// - Every dismissal path requests `onOpenChange(false)`; native closure caused by
//   <form method="dialog"> or a forwarded ref .close() reconciles through the `close` event.
// - Close requests prefer `dialog.requestClose()` (Baseline since May 2025; older Safari falls
//   back to the state close) so a consumer preventDefault on `cancel` vetoes every request.
//   Platform close requests can be noncancelable under CloseWatcher safeguards; the `close`
//   reconciliation covers those.
// - If a controlled parent rejects a request while the native dialog already closed, scroll
//   is released and the next open request repairs the native state without notifying again
//   (the Root bumps a repair token).
// - Scroll lock follows the native (actual) dialog state, only after showModal() succeeds.
// - Content does not accept a native `open` prop.
// - If Content unmounts while open (removal is not a close), focus returns to the invoking
//   element when it is still connected.
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type MouseEventHandler,
  type MutableRefObject,
  type ReactEventHandler,
  type Ref,
  type SyntheticEvent,
} from 'react';
import { useScrollLock } from './use-scroll-lock';

/** What Content needs from its Root; both Roots expose it through their context. */
export interface NativeDialogController {
  open: boolean;
  setOpen: (open: boolean) => void;
  requestClose: () => void;
  repairToken: number;
  setDialogElement: (element: HTMLDialogElement | null) => void;
}

export interface NativeDialogHandlers {
  onCancel?: ReactEventHandler<HTMLDialogElement>;
  onClick?: MouseEventHandler<HTMLDialogElement>;
  onClose?: ReactEventHandler<HTMLDialogElement>;
}

export function requestNativeDialogClose(dialog: HTMLDialogElement | null, setOpen: (open: boolean) => void) {
  if (dialog && dialog.open && typeof dialog.requestClose === 'function') {
    dialog.requestClose();
    return;
  }
  setOpen(false);
}

/** Root half: logical open requests, the repair token and the registered dialog element. */
export function useNativeDialogRoot(open: boolean, requestOpenChange: (open: boolean) => void) {
  const [repairToken, setRepairToken] = useState(0);
  const dialogElementRef = useRef<HTMLDialogElement | null>(null);

  const setDialogElement = useCallback((element: HTMLDialogElement | null) => {
    dialogElementRef.current = element;
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      const nativeOpen = dialogElementRef.current?.open ?? false;
      if (next === open && nativeOpen === open) return;
      if (next === open) {
        // A controlled parent rejected an earlier request and the native dialog diverged:
        // ask Content to re-sync native state from the prop, without notifying again.
        setRepairToken((token) => token + 1);
        return;
      }
      requestOpenChange(next);
    },
    [open, requestOpenChange],
  );

  // One dismissal path: prefer the native close request so `cancel` (and any consumer veto)
  // applies; fall back to the state close on engines without requestClose.
  const requestClose = useCallback(() => {
    requestNativeDialogClose(dialogElementRef.current, setOpen);
  }, [setOpen]);

  return { dialogElementRef, setDialogElement, setOpen, requestClose, repairToken };
}

/** Root owns logical openness: a native `open` prop passed to Content is deliberately ignored. */
export function omitNativeOpen<P extends object>(props: P & { open?: unknown }) {
  const { open: ignoredNativeOpen, ...rest } = props;
  void ignoredNativeOpen;
  return rest;
}

/**
 * Content half: syncs the native dialog to the logical `open`, and returns the `ref` and
 * event handlers to spread on the <dialog> (after the consumer's props).
 */
export function useNativeDialog(
  { open, setOpen, requestClose, repairToken, setDialogElement }: NativeDialogController,
  { onCancel, onClick, onClose }: NativeDialogHandlers,
  forwardedRef: Ref<HTMLDialogElement> | undefined,
  contentRef?: MutableRefObject<HTMLDialogElement | null>,
) {
  const internalDialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogRef = contentRef ?? internalDialogRef;
  useImperativeHandle(forwardedRef, () => dialogRef.current as HTMLDialogElement, []);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [isNativeOpen, setIsNativeOpen] = useState(false);

  const ref = useCallback(
    (element: HTMLDialogElement | null) => {
      dialogRef.current = element;
      setDialogElement(element);
    },
    [setDialogElement],
  );

  // A rejected controlled dismissal can never leave the page stuck.
  useScrollLock(isNativeOpen, () => dialogRef.current?.ownerDocument);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      restoreFocusRef.current = (dialog.ownerDocument.activeElement as HTMLElement | null) ?? null;
      wasOpenRef.current = true;
      try {
        dialog.showModal();
      } catch {
        // Disconnected element or conflicting state (already open nonmodally): nothing to do.
      }
      setIsNativeOpen(dialog.open);
    } else if (!open && dialog.open) {
      dialog.close();
      wasOpenRef.current = false;
      setIsNativeOpen(false);
    }
  }, [open, repairToken]);

  // If Content unmounts while open, removal bypasses the native focus return: do it ourselves.
  useEffect(
    () => () => {
      const invoker = restoreFocusRef.current;
      if (wasOpenRef.current && invoker && invoker.isConnected && typeof invoker.focus === 'function') {
        invoker.focus();
      }
    },
    [],
  );

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    onCancel?.(event);
    const vetoed = event.defaultPrevented;
    // We own closure: block the browser's own close and route through the Root, unless the
    // consumer vetoed the cancellation. Noncancelable platform requests reconcile on `close`.
    event.preventDefault();
    if (!vetoed) setOpen(false);
  };

  // Backdrop clicks target the dialog element itself; clicks inside the panel do not.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    onClick?.(event);
    if (event.target === dialogRef.current && !event.defaultPrevented) requestClose();
  };

  const handleClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    wasOpenRef.current = false;
    onClose?.(event);
    setIsNativeOpen(false);
    // Native closure that bypassed our paths: <form method="dialog"> or a forwarded ref.
    if (open) setOpen(false);
  };

  return { ref, onCancel: handleCancel, onClick: handleClick, onClose: handleClose };
}
