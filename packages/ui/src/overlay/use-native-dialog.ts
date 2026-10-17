// Shared native <dialog> lifecycle for Dialog and CommandPalette.
//
// Lifecycle contract — the Root owns logical `open`, Content owns native state:
// - Every dismissal path requests `onOpenChange(false)`; native closure caused by
//   <form method="dialog"> or a forwarded ref .close() reconciles through the `close` event.
// - Close requests prefer `dialog.requestClose()` (Baseline since May 2025; older Safari falls
//   back to a synthetic cancel request) so a consumer can veto cancelable requests.
//   Platform close requests can be noncancelable under CloseWatcher safeguards; the `close`
//   reconciliation covers those.
// - If a controlled parent rejects a request while the native dialog already closed, scroll
//   is released and the next open request repairs the native state without notifying again
//   (the Root bumps a repair token).
// - Scroll lock follows the native (actual) dialog state, only after showModal() succeeds.
// - Content does not accept a native `open` prop.
// - An optional transition animates the surface in after showModal() and out before the native
//   close: a logical close keeps the dialog open (modal, scroll-locked) until `exit` settles.
//   Reopening during the exit re-enters from where the surface is; a native close ends it.
// - While the exit runs the dialog renders `data-state="closing"` (styles key their exit on it)
//   and absorbs further close requests: the accepted one is in progress.
// - A `close` event that arrives after the dialog reopened is stale and ignored.
// - If Content unmounts while open (removal is not a close), focus returns to the invoking
//   element when it is still connected.
// - Own events only: React bubbles `cancel` and `close` through the component tree, unlike the
//   DOM, so a dialog nested inside this one (in the React tree, portaled or not) delivers its
//   events here with `event.target` set to the nested <dialog>. Those reach the consumer's
//   handler untouched and never drive this dialog's lifecycle: no preventDefault on the nested
//   request, no close request and no native-state reconciliation here.
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
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

/** Surface motion around the native lifecycle. */
export interface NativeDialogTransition {
  /** Runs after showModal() succeeds, and when a reopen interrupts a running exit. */
  enter: (dialog: HTMLDialogElement) => void;
  /** Runs on a logical close; the native close waits for the promise. Return nothing to close at once. */
  exit: (dialog: HTMLDialogElement) => Promise<unknown> | undefined;
}

export type NativeDialogState = 'open' | 'closing' | 'closed';

export function requestNativeDialogClose(dialog: HTMLDialogElement | null, setOpen: (open: boolean) => void) {
  if (dialog && dialog.open && typeof dialog.requestClose === 'function') {
    dialog.requestClose();
    return;
  }
  if (dialog?.open) {
    const EventConstructor = dialog.ownerDocument.defaultView?.Event ?? Event;
    if (!dialog.dispatchEvent(new EventConstructor('cancel', { cancelable: true }))) return;
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
  // applies; dispatch an equivalent cancel request on engines without requestClose.
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
  transition?: NativeDialogTransition,
) {
  const internalDialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogRef = contentRef ?? internalDialogRef;
  useImperativeHandle(forwardedRef, () => dialogRef.current as HTMLDialogElement, []);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [isNativeOpen, setIsNativeOpen] = useState(false);
  // Opens happen post-paint (showModal must run after commit). The lock still has to engage
  // before the first painted frame, so an `opening` window set in a layout effect bridges the
  // gap; a native close or a refused showModal ends it, keeping the lock tied to the native state.
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const transitionRef = useRef(transition);
  transitionRef.current = transition;
  // Identity of the running exit; a reopen, a native close or unmount replaces it.
  const exitRef = useRef<object | null>(null);

  const ref = useCallback(
    (element: HTMLDialogElement | null) => {
      dialogRef.current = element;
      setDialogElement(element);
    },
    [setDialogElement],
  );

  useLayoutEffect(() => {
    if (open) setOpening(true);
    else setOpening(false);
  }, [open]);
  useLayoutEffect(() => {
    if (isNativeOpen) setOpening(false);
  }, [isNativeOpen]);
  // Lock before the opening frame; keep it while the dialog is natively open; release it when
  // the platform refuses to open or the native dialog closes (a rejected close unlocks).
  useScrollLock((opening && !openFailed) || isNativeOpen, () => dialogRef.current?.ownerDocument);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) setOpenFailed(false);
    const closeNative = () => {
      dialog.close();
      wasOpenRef.current = false;
      setIsNativeOpen(false);
    };
    if (open) {
      const interrupted = exitRef.current !== null;
      exitRef.current = null;
      if (!dialog.open) {
        restoreFocusRef.current = (dialog.ownerDocument.activeElement as HTMLElement | null) ?? null;
        wasOpenRef.current = true;
        try {
          dialog.showModal();
        } catch {
          // Disconnected element or conflicting state (already open nonmodally): nothing to do.
          setOpenFailed(true);
        }
        setIsNativeOpen(dialog.open);
        if (dialog.open) transitionRef.current?.enter(dialog);
      } else if (interrupted) {
        transitionRef.current?.enter(dialog);
      }
    } else if (dialog.open && exitRef.current === null) {
      const exit = transitionRef.current?.exit(dialog);
      if (!exit) {
        closeNative();
        return;
      }
      const run = {};
      exitRef.current = run;
      const settled = () => {
        if (exitRef.current !== run) return;
        exitRef.current = null;
        if (dialog.open) closeNative();
      };
      exit.then(settled, settled);
    }
  }, [open, repairToken]);

  // If Content unmounts while open, removal bypasses the native focus return: do it ourselves.
  useEffect(
    () => () => {
      exitRef.current = null;
      const invoker = restoreFocusRef.current;
      if (wasOpenRef.current && invoker && invoker.isConnected && typeof invoker.focus === 'function') {
        invoker.focus();
      }
    },
    [],
  );

  // `target` is the dialog the event was fired on; anything else bubbled up from a nested dialog.
  const isOwnEvent = (event: SyntheticEvent<HTMLDialogElement>) => event.target === dialogRef.current;

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (!isOwnEvent(event)) {
      onCancel?.(event);
      return;
    }
    // Already closing: the accepted request is in progress.
    if (!open) {
      event.preventDefault();
      return;
    }
    onCancel?.(event);
    if (!event.cancelable) return;
    const vetoed = event.defaultPrevented;
    // We own closure: block the browser's own close and route through the Root, unless the
    // consumer vetoed the cancellation. Noncancelable platform requests reconcile on `close`.
    event.preventDefault();
    if (!vetoed) setOpen(false);
  };

  // Backdrop clicks target the dialog element itself; clicks inside the panel do not.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    onClick?.(event);
    if (open && event.target === dialogRef.current && !event.defaultPrevented) requestClose();
  };

  const handleClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (!isOwnEvent(event)) {
      // Another dialog's bubbled close must not tear down this controller's state.
      onClose?.(event);
      return;
    }
    // `close` is dispatched from a queued task: a reopen that landed first already superseded it.
    if (dialogRef.current?.open) return;
    exitRef.current = null;
    wasOpenRef.current = false;
    onClose?.(event);
    setIsNativeOpen(false);
    // Native closure that bypassed our paths: <form method="dialog"> or a forwarded ref.
    if (open) setOpen(false);
  };

  const state: NativeDialogState = open ? 'open' : isNativeOpen ? 'closing' : 'closed';

  return { ref, onCancel: handleCancel, onClick: handleClick, onClose: handleClose, 'data-state': state };
}
