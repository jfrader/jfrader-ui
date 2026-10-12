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
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { modalShellReset, raisedSurface } from '../../styling/surface';
import { WithSx, type SxProps } from '../../styling/sx';
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

/** Props a part's `render` callback spreads onto the element it returns (e.g. a `Button`). */
export interface DialogPartRenderProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref: Ref<HTMLButtonElement>;
  'data-ui': string;
}

export interface DialogTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {
  /**
   * Replace the button. Spread all supplied props onto the element and attach the supplied ref,
   * including through Button. Refs point to that element, even when it is not a button;
   * the public ref type remains HTMLButtonElement for compatibility.
   * Handler, className and style overrides replace the supplied values. Compose handlers to keep both:
   * `onClick={(e) => { p.onClick?.(e); mine(e); }}`.
   * The render path joins data-ui markers into a token list; use `[data-ui~="dialog-trigger"]`.
   * The default button has data-ui="dialog-trigger".
   * For disabled anchors, compose through Button's render path. aria-disabled keeps them focusable;
   * its handler blocks primary click/Enter, but not auxiliary/middle-click navigation.
   * This part supplies native button semantics only.
   */
  render?: (props: DialogPartRenderProps) => ReactNode;
}
export interface DialogContentProps extends Omit<ComponentPropsWithRef<'dialog'>, 'open'>, SxProps {
  /** Set false to keep structured content out of the dialog's accessible description. */
  withDescription?: boolean;
}
export interface DialogTitleProps extends ComponentPropsWithRef<'h2'>, SxProps {}
export interface DialogDescriptionProps extends ComponentPropsWithRef<'p'>, SxProps {}
export interface DialogCloseProps extends ComponentPropsWithRef<'button'>, SxProps {
  /**
   * Replace the button. Spread all supplied props onto the element and attach the supplied ref,
   * including through Button. Refs point to that element, even when it is not a button;
   * the public ref type remains HTMLButtonElement for compatibility.
   * Handler, className and style overrides replace the supplied values. Compose handlers to keep both:
   * `onClick={(e) => { p.onClick?.(e); mine(e); }}`.
   * The render path joins data-ui markers into a token list; use `[data-ui~="dialog-close"]`.
   * The default button has data-ui="dialog-close".
   * For disabled anchors, compose through Button's render path. aria-disabled keeps them focusable;
   * its handler blocks primary click/Enter, but not auxiliary/middle-click navigation.
   * This part supplies native button semantics only.
   */
  render?: (props: DialogPartRenderProps) => ReactNode;
}

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

const dialogStyle = css(modalShellReset);

const panelStyle = css({
  ...raisedSurface,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.floating,
  padding: vars.space[5],
  minInlineSize: 'min(320px, 100%)',
  maxInlineSize: 'min(560px, calc(100vw - 32px))',
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
  minBlockSize: '32px',
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

DialogRoot.displayName = 'Dialog';

function DialogTrigger({ ref = null, onClick, render, className, sx, ...rest }: DialogTriggerProps) {
  const { open, setOpen } = useDialogContext('Trigger');
  const { 'data-ui': partMarker, ...attributes } = rest as typeof rest & { 'data-ui'?: string };

  const consumerClick: MouseEventHandler<HTMLElement> | undefined = onClick;
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    consumerClick?.(event);
    if (!event.defaultPrevented) setOpen(true);
  };

  const triggerProps: DialogPartRenderProps = {
    type: 'button',
    ...attributes,
    ref,
    'data-ui': render && partMarker !== undefined ? `${partMarker} dialog-trigger` : 'dialog-trigger',
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    onClick: handleClick,
  };

  // The render path has no own styles: the rendered element (e.g. a Button) supplies them.
  return (
    <WithSx className={className} styles={render ? undefined : triggerStyle} sx={sx}>
      {(className) =>
        render ? render({ ...triggerProps, className }) : <button {...triggerProps} className={className} />
      }
    </WithSx>
  );
}

DialogTrigger.displayName = 'Dialog.Trigger';

function DialogContent({ ref, className, sx, ...props }: DialogContentProps) {
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
    <WithSx className={className} styles={dialogStyle} sx={sx}>
      {(className) => (
        <dialog
          {...rest}
          {...dialogProps}
          data-ui="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          className={className}
        >
          <DialogRequestCloseContext.Provider value={requestClose}>
            <div css={panelStyle}>{children}</div>
          </DialogRequestCloseContext.Provider>
        </dialog>
      )}
    </WithSx>
  );
}

DialogContent.displayName = 'Dialog.Content';

function DialogTitle({ ref, className, sx, ...props }: DialogTitleProps) {
  const { titleId, setHasTitle } = useDialogContext('Title');

  useEffect(() => {
    setHasTitle(true);
    return () => setHasTitle(false);
  }, [setHasTitle]);

  return (
    <WithSx className={className} styles={titleStyle} sx={sx}>
      {(className) => <h2 {...props} ref={ref} id={titleId} data-ui="dialog-title" className={className} />}
    </WithSx>
  );
}

DialogTitle.displayName = 'Dialog.Title';

function DialogDescription({ ref, className, sx, ...props }: DialogDescriptionProps) {
  const { descriptionId, setHasDescription } = useDialogContext('Description');

  useEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return (
    <WithSx className={className} styles={descriptionStyle} sx={sx}>
      {(className) => (
        <p {...props} ref={ref} id={descriptionId} data-ui="dialog-description" className={className} />
      )}
    </WithSx>
  );
}

DialogDescription.displayName = 'Dialog.Description';

function DialogClose({ ref = null, onClick, render, className, sx, ...rest }: DialogCloseProps) {
  const { setOpen } = useDialogContext('Close');
  const requestClose = useContext(DialogRequestCloseContext);
  const { 'data-ui': partMarker, ...attributes } = rest as typeof rest & { 'data-ui'?: string };

  const consumerClick: MouseEventHandler<HTMLElement> | undefined = onClick;
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    consumerClick?.(event);
    if (event.defaultPrevented) return;
    if (requestClose) requestClose();
    else setOpen(false);
  };

  const closeProps: DialogPartRenderProps = {
    type: 'button',
    ...attributes,
    ref,
    'data-ui': render && partMarker !== undefined ? `${partMarker} dialog-close` : 'dialog-close',
    onClick: handleClick,
  };

  return (
    <WithSx className={className} styles={render ? undefined : closeStyle} sx={sx}>
      {(className) =>
        render ? render({ ...closeProps, className }) : <button {...closeProps} className={className} />
      }
    </WithSx>
  );
}

DialogClose.displayName = 'Dialog.Close';

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});
