// APG pattern: dialog (modal), built on native <dialog> + showModal(). The top layer makes
// the rest of the page inert and traps focus; close() returns focus to the element that was
// focused before opening (normally the Trigger).
// Keyboard map: Tab/Shift+Tab cycle inside the dialog; Escape closes it.
//
// Close requests are the single dismissal authority: Escape (native cancel), the Close
// button and backdrop clicks all route through `requestClose()`, so a consumer
// preventDefault on `cancel` vetoes every request consistently. `closedby` is NOT Baseline
// (Safari preview) — keep manual backdrop handling.
// Synthetic key events in tests do not trigger native cancel; dispatch a cancel event.
//
// Lifecycle contract (Root owns logical `open`, Content owns native state): see
// `overlay/use-native-dialog.ts`.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type DialogHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { triggerStyle } from '../../styling/trigger-style';
import {
  omitNativeOpen,
  requestNativeDialogClose,
  useNativeDialog,
  useNativeDialogRoot,
  type NativeDialogController,
} from '../../overlay/use-native-dialog';
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

interface DialogContextValue extends NativeDialogController {
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
      titleId: `${baseId}-title`,
      descriptionId: `${baseId}-description`,
      hasTitle,
      hasDescription,
      setHasTitle,
      setHasDescription,
    }),
    [open, setOpen, requestClose, repairToken, setDialogElement, baseId, hasTitle, hasDescription],
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
  const {
    children,
    onCancel,
    onClick,
    onClose,
    'aria-labelledby': ariaLabelledByProp,
    'aria-describedby': ariaDescribedByProp,
    withDescription = true,
    ...rest
  } = omitNativeOpen(props);

  const context = useDialogContext('Content');
  const { setOpen, titleId, descriptionId, hasTitle, hasDescription } = context;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const requestClose = useCallback(() => {
    requestNativeDialogClose(dialogRef.current, setOpen);
  }, [setOpen]);
  const dialogProps = useNativeDialog({ ...context, requestClose }, { onCancel, onClick, onClose }, ref, dialogRef);

  const labelledBy = [ariaLabelledByProp, hasTitle && titleId].filter(Boolean).join(' ') || undefined;
  const describedBy = [ariaDescribedByProp, withDescription && hasDescription && descriptionId]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <dialog
      {...rest}
      {...dialogProps}
      data-ui="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
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
