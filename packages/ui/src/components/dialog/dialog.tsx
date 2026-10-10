// APG pattern: dialog (modal), built on native <dialog> + showModal(). The top layer makes
// the rest of the page inert and traps focus; close() returns focus to the element that was
// focused before opening (normally the Trigger).
// Keyboard map: Tab/Shift+Tab cycle inside the dialog; Escape closes it.
//
// Close requests are the single dismissal authority: Escape (native cancel), the Close
// button and backdrop clicks all route through `requestClose()` when the browser supports it
// (Baseline since May 2025; older Safari falls back to the state close), so a consumer
// preventDefault on `cancel` vetoes every request consistently. Note: platform close
// requests are noncancelable under CloseWatcher activation safeguards; `close` reconciliation
// handles those. `closedby` is NOT Baseline (Safari preview) — keep manual backdrop handling.
// Synthetic key events in tests do not trigger native cancel; dispatch a cancel event.
//
// Lifecycle contract — the Root owns logical `open`, Content owns native state:
// - Every dismissal path requests `onOpenChange(false)`; native closure caused by
//   <form method="dialog"> or a forwarded ref .close() reconciles through the `close` event.
// - If a controlled parent rejects a request while the native dialog already closed, scroll
//   is released and the next open request repairs the native state without notifying again
//   (Root bumps a repair token).
// - Content does not accept a native `open` prop.
// - If Content unmounts while open (removal is not a close), focus returns to the invoking
//   element when it is still connected.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type DialogHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { useScrollLock } from '../../overlay/use-scroll-lock';
import { useControlledState } from '../../utils/use-controlled-state';

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export interface DialogTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {}
export interface DialogContentProps extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open'> {
  /** Set false to keep structured content out of the dialog's accessible description. */
  withDescription?: boolean;
}
export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {}
export interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}
export interface DialogCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  repairToken: number;
  setDialogElement: (element: HTMLDialogElement | null) => void;
  titleId: string;
  descriptionId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  setHasTitle: (present: boolean) => void;
  setHasDescription: (present: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);
// Provided by Content so Close/backdrop share one dismissal path.
const DialogRequestCloseContext = createContext<(() => void) | null>(null);

function useDialogContext(part: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error(`Dialog.${part} must be rendered inside <Dialog>.`);
  return context;
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const dialogStyle = css({
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'inherit',
  '&::backdrop': {
    backgroundColor: vars.color.scrim,
  },
});

const panelStyle = css({
  boxSizing: 'border-box',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.floating,
  padding: vars.space[5],
  minInlineSize: '320px',
  maxInlineSize: 'min(560px, calc(100vw - 32px))',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
});

const titleStyle = css({
  margin: 0,
  marginBlockEnd: vars.space[2],
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
});

const descriptionStyle = css({
  margin: 0,
  marginBlockEnd: vars.space[4],
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const triggerStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  minBlockSize: '40px',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[4],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const closeStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
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
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

function DialogRoot({ open: openProp, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const baseId = useId();
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const [repairToken, setRepairToken] = useState(0);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);
  const dialogElementRef = useRef<HTMLDialogElement | null>(null);

  const setDialogElement = useCallback((element: HTMLDialogElement | null) => {
    dialogElementRef.current = element;
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      const element = dialogElementRef.current;
      const nativeOpen = element?.open ?? false;
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

  const context = useMemo(
    () => ({
      open,
      setOpen,
      repairToken,
      setDialogElement,
      titleId: `${baseId}-title`,
      descriptionId: `${baseId}-description`,
      hasTitle,
      hasDescription,
      setHasTitle,
      setHasDescription,
    }),
    [open, setOpen, repairToken, setDialogElement, baseId, hasTitle, hasDescription],
  );

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
}

const Trigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(function DialogTrigger({ onClick, ...rest }, ref) {
  const { open, setOpen } = useDialogContext('Trigger');

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) setOpen(true);
  };

  return (
    <button
      type="button"
      {...rest}
      ref={ref}
      data-ui="dialog-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={handleClick}
      css={triggerStyle}
    />
  );
});

const Content = forwardRef<HTMLDialogElement, DialogContentProps>(function DialogContent(props, ref) {
  // Root owns logical openness: a native `open` prop passed here is deliberately ignored.
  const { open: ignoredNativeOpen, ...propsWithoutOpen } = props as DialogContentProps & { open?: unknown };
  void ignoredNativeOpen;
  const {
    children,
    onCancel,
    onClick,
    onClose,
    'aria-labelledby': ariaLabelledByProp,
    'aria-describedby': ariaDescribedByProp,
    withDescription = true,
    ...rest
  } = propsWithoutOpen;

  const { open, setOpen, repairToken, setDialogElement, titleId, descriptionId, hasTitle, hasDescription } =
    useDialogContext('Content');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useImperativeHandle(ref, () => dialogRef.current as HTMLDialogElement, []);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [isNativeOpen, setIsNativeOpen] = useState(false);

  const setDialogRefs = useCallback(
    (element: HTMLDialogElement | null) => {
      dialogRef.current = element;
      setDialogElement(element);
    },
    [setDialogElement],
  );

  // Scroll lock follows the native (actual) dialog state, not the logical prop, so a rejected
  // controlled dismissal can never leave the page stuck.
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

  // One dismissal path for Close/backdrop: prefer the native close request so `cancel` (and
  // any consumer veto) applies; fall back to the state close on engines without requestClose.
  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open && typeof dialog.requestClose === 'function') {
      dialog.requestClose();
      return;
    }
    setOpen(false);
  }, [setOpen]);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    onCancel?.(event);
    const vetoed = event.defaultPrevented;
    // We own closure: block the browser's own close and route through the Root, unless the
    // consumer vetoed the cancellation. (Platform close requests can be noncancelable under
    // CloseWatcher safeguards; the `close` reconciliation covers those.)
    event.preventDefault();
    if (!vetoed) setOpen(false);
  };

  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    onClick?.(event);
    if (event.target === dialogRef.current && !event.defaultPrevented) requestClose();
  };

  const handleClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    onClose?.(event);
    setIsNativeOpen(false);
    // Native closure that bypassed our paths: <form method="dialog"> or a forwarded ref.
    if (open) setOpen(false);
  };

  const labelledBy = [ariaLabelledByProp, hasTitle && titleId].filter(Boolean).join(' ') || undefined;
  const describedBy = [ariaDescribedByProp, withDescription && hasDescription && descriptionId]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <dialog
      {...rest}
      ref={setDialogRefs}
      data-ui="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={handleCancel}
      onClick={handleClick}
      onClose={handleClose}
      css={dialogStyle}
    >
      <DialogRequestCloseContext.Provider value={requestClose}>
        <div css={panelStyle}>{children}</div>
      </DialogRequestCloseContext.Provider>
    </dialog>
  );
});

const Title = forwardRef<HTMLHeadingElement, DialogTitleProps>(function DialogTitle(props, ref) {
  const { titleId, setHasTitle } = useDialogContext('Title');

  useEffect(() => {
    setHasTitle(true);
    return () => setHasTitle(false);
  }, [setHasTitle]);

  return <h2 {...props} ref={ref} id={titleId} data-ui="dialog-title" css={titleStyle} />;
});

const Description = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(function DialogDescription(props, ref) {
  const { descriptionId, setHasDescription } = useDialogContext('Description');

  useEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return <p {...props} ref={ref} id={descriptionId} data-ui="dialog-description" css={descriptionStyle} />;
});

const Close = forwardRef<HTMLButtonElement, DialogCloseProps>(function DialogClose({ onClick, ...rest }, ref) {
  const { setOpen } = useDialogContext('Close');
  const requestClose = useContext(DialogRequestCloseContext);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (requestClose) requestClose();
    else setOpen(false);
  };

  return <button type="button" {...rest} ref={ref} data-ui="dialog-close" onClick={handleClick} css={closeStyle} />;
});

export const Dialog = Object.assign(DialogRoot, { Trigger, Content, Title, Description, Close });
