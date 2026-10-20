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
// Motion: the shell scales and fades in; an accepted close fades it out before the native close
// (`data-state="closing"`), and reduced motion makes both instant.
//
// Lifecycle contract (Root owns logical `open`, Content owns native state): see
// `overlay/use-native-dialog.ts`.
'use client';

import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type ComponentType,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { MODAL_ENTER_SCALE, modalBackdropMotion, modalSurfaceMotion } from '../../styling/overlay-motion';
import { modalShellReset } from '../../styling/surface';
import type { DrawerPanelProps } from '../drawer';
import { SurfaceRoot } from '../surface/surface-root';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { styledDialogTransition } from '../../overlay/exit-motion';
import {
  omitNativeOpen,
  requestNativeDialogClose,
  useNativeDialog,
  useNativeDialogRoot,
  type NativeDialogController,
} from '../../overlay/use-native-dialog';
import { useControlledState } from '../../utils/use-controlled-state';
import { isRenderable } from '../../utils/renderable';

interface DialogStateProps {
  /** Control whether the dialog is open. */
  open?: boolean;
  /** Open the uncontrolled dialog on mount; defaults to false. */
  defaultOpen?: boolean;
  /** Receive open and close requests, including native form closure. */
  onOpenChange?: (open: boolean) => void;
}

/** Compose a modal dialog from its trigger and content parts. */
export interface DialogCompoundProps extends DialogStateProps {
  children?: ReactNode;
  triggerLabel?: never;
  title?: never;
  description?: never;
  content?: never;
  closeLabel?: never;
  slotProps?: never;
  slots?: never;
  component?: never;
}

/** Open a modal dialog with generated heading, content, and close controls. */
export interface DialogEasyProps extends DialogStateProps, Omit<DialogPanelProps, 'children' | 'title' | 'content' | 'slots' | 'slotProps'> {
  /** Name the button that opens the dialog. */
  triggerLabel: ReactNode;
  /** Name the dialog with a visible heading. */
  title: ReactNode;
  /** Describe the dialog below its heading. */
  description?: ReactNode;
  /** Place content inside the default panel. */
  content: ReactNode;
  /** Name the close button. */
  closeLabel: ReactNode;
  children?: never;
  /** Replace generated elements while retaining their supplied props and refs. */
  slots?: DialogSlots;
  /** Replace the panel root; `slots.root` takes precedence. */
  component?: DialogPanelProps['component'];
  /** Pass props to the generated dialog elements. */
  slotProps?: DialogSlotProps;
}

/** Props for the generated elements in easy mode. */
export interface DialogSlotProps {
  /** Customize the panel's adopted div, not the native dialog shell. */
  root?: NonNullable<DialogPanelProps['slotProps']>['root'];
  /** Button that opens the dialog. */
  trigger?: Omit<DialogTriggerProps, 'children'>;
  /** Native `<dialog>` shell that manages backdrop and focus trapping. */
  content?: Omit<DialogContentProps, 'children'>;
  /** Adopted panel container that renders the dialog surface material. Uses `Dialog.Panel` by default. */
  panel?: Omit<DialogPanelProps, 'children'>;
  /** Container grouping the title and optional description. */
  header?: Omit<ComponentPropsWithRef<'div'>, 'children'> & { sx?: Interpolation<Theme> };
  /** Accessible heading element naming the dialog. */
  title?: Omit<DialogTitleProps, 'children'>;
  /** Accessible text element describing the dialog purpose. */
  description?: Omit<DialogDescriptionProps, 'children'>;
  /** Button that dismisses the dialog. */
  close?: Omit<DialogCloseProps, 'children'>;
}

/** Replacement elements for easy mode; forward all supplied props and refs. */
export interface DialogSlots {
  /** Replaces the panel's adopted div; renders a `div` by default. */
  root?: NonNullable<DialogPanelProps['slots']>['root'];
  /** Replaces the shell with one native dialog, forwarding every prop and its dialog ref. */
  content?: ComponentType<ComponentPropsWithRef<'dialog'>>;
  /** Replaces the panel div through the Surface root seam; slots.root wins. Renders a `div` by default. */
  panel?: NonNullable<DialogPanelProps['slots']>['root'];
  /** Replaces the container grouping the title and optional description. */
  header?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the accessible heading element naming the dialog. */
  title?: ComponentType<DialogTitleProps>;
  /** Replaces the accessible text element describing the dialog purpose. */
  description?: ComponentType<DialogDescriptionProps>;
  /** Replaces the button that opens the dialog. */
  trigger?: ComponentType<DialogTriggerProps>;
  /** Replaces the button that dismisses the dialog. */
  close?: ComponentType<DialogCloseProps>;
}

/** Choose generated content or compound children for a modal dialog. */
export type DialogProps = DialogCompoundProps | DialogEasyProps;

/** Props a part's `render` callback spreads onto the element it returns (e.g. a `Button`). */
export interface DialogPartRenderProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref: Ref<HTMLButtonElement>;
  'data-ui': string;
}

/** Button that opens the dialog and exposes its expanded state. */
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
/** Native dialog shell owning focus, backdrop dismissal, and size limits. */
export interface DialogContentProps extends Omit<ComponentPropsWithRef<'dialog'>, 'open'>, SxProps {
  /** Set false to keep structured content out of the dialog's accessible description. */
  withDescription?: boolean;
}
/** Surface inside Content; use one direct Panel child, optionally inside fragments, without substantive siblings. */
export interface DialogPanelProps extends DrawerPanelProps {
  /** Inherit appearance by default; `contrast` establishes fixed charcoal. */
  appearance?: DrawerPanelProps['appearance'];
}
/** Visible heading used as the dialog's accessible name. */
export interface DialogTitleProps extends ComponentPropsWithRef<'h2'>, SxProps {}
/** Text used as the dialog's accessible description unless Content disables it. */
export interface DialogDescriptionProps extends ComponentPropsWithRef<'p'>, SxProps {}
/** Button requesting closure through the shell's cancelable dismissal path. */
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
  shell?: DialogSlots['content'];
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
const DialogPanelContext = createContext<{
  dialogRef: RefObject<HTMLDialogElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
} | null>(null);

declare const process: { env: { NODE_ENV?: string } };

function useDialogContext(part: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error(`Dialog.${part} must be rendered inside <Dialog>.`);
  return context;
}

const dialogStyle = css(modalShellReset, modalBackdropMotion, {
  ...modalSurfaceMotion(MODAL_ENTER_SCALE, '&[data-state="closing"]'),
  minInlineSize: 'min(320px, calc(100vw - 32px))',
  maxInlineSize: 'min(560px, calc(100vw - 32px))',
});

const panelStyle = css({
  padding: vars.space[5],
  inlineSize: '100%',
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

/** Open a modal dialog with generated content or compound parts. */
function DialogRoot(props: DialogProps) {
  const {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    children,
    triggerLabel,
    title,
    description,
    content,
    closeLabel,
    slotProps,
    slots,
    component,
    ...rootProps
  } = props;
  const Header = slots?.header ?? 'div';
  const Title = slots?.title ?? DialogTitle;
  const Description = slots?.description ?? DialogDescription;
  const Trigger = slots?.trigger ?? DialogTrigger;
  const Close = slots?.close ?? DialogClose;
  const shell = slots?.content;
  const baseId = useId();
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const { setDialogElement, setOpen, requestClose, repairToken } = useNativeDialogRoot(open, requestOpenChange);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);

  const context = useMemo(
    () => ({
      shell,
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
    [shell, open, setOpen, requestClose, repairToken, setDialogElement, baseId, hasTitle, hasDescription],
  );

  return (
    <DialogContext.Provider value={context}>
      {'content' in props ? (
        <>
          <Trigger {...slotProps?.trigger}>{triggerLabel}</Trigger>
          <DialogContent {...slotProps?.content}>
            <DialogPanel
              {...rootProps}
              {...slotProps?.panel}
              component={component ?? slotProps?.panel?.component}
              slots={{ ...slotProps?.panel?.slots, root: slots?.root ?? slots?.panel ?? slotProps?.panel?.slots?.root }}
              slotProps={{ root: slotProps?.root ?? slotProps?.panel?.slotProps?.root }}
            >
              <WithSx className={slotProps?.header?.className} sx={slotProps?.header?.sx}>
                {(className) => (
                  <Header {...withoutSx(slotProps?.header)} data-ui="dialog-header" className={className}>
                    <Title {...slotProps?.title}>{title}</Title>
                    {isRenderable(description) && <Description {...slotProps?.description}>{description}</Description>}
                  </Header>
                )}
              </WithSx>
              {content}
              <Close {...slotProps?.close}>{closeLabel}</Close>
            </DialogPanel>
          </DialogContent>
        </>
      ) : children}
    </DialogContext.Provider>
  );
}

DialogRoot.displayName = 'Dialog';

/** Open the dialog from a button or a rendered control. */
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

/** Render the native modal shell with a default panel or one direct Dialog.Panel. */
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
  const Shell = context.shell ?? 'dialog';
  const { setOpen, titleId, descriptionId, hasTitle, hasDescription } = context;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelContext = useMemo(() => ({ dialogRef, panelRef }), []);
  const requestClose = useCallback(() => {
    requestNativeDialogClose(dialogRef.current, setOpen);
  }, [setOpen]);
  const dialogProps = useNativeDialog(
    { ...context, requestClose },
    { onCancel, onClick, onClose },
    ref,
    dialogRef,
    styledDialogTransition,
  );

  const labelledBy = [ariaLabelledByProp, hasTitle && titleId].filter(Boolean).join(' ') || undefined;
  const describedBy = [ariaDescribedByProp, withDescription && hasDescription && descriptionId]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <WithSx className={className} styles={dialogStyle} sx={sx}>
      {(className) => (
        <Shell
          {...rest}
          {...dialogProps}
          data-ui="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          className={className}
        >
          <DialogRequestCloseContext.Provider value={requestClose}>
            <DialogPanelContext.Provider value={panelContext}>
              {dialogPanelChildren(children)}
            </DialogPanelContext.Provider>
          </DialogRequestCloseContext.Provider>
        </Shell>
      )}
    </WithSx>
  );
}

DialogContent.displayName = 'Dialog.Content';

function directChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? directChildren(child.props.children)
      : [child],
  ).filter((child) => typeof child !== 'string' || child.trim() !== '');
}

function dialogPanelChildren(children: ReactNode) {
  const direct = directChildren(children);
  const panels = direct.filter((child) => isValidElement(child) && child.type === DialogPanel);
  if (panels.length === 0) return <DialogPanel>{children}</DialogPanel>;
  if (process.env.NODE_ENV !== 'production' && (panels.length !== 1 || direct.length !== 1)) {
    console.warn('Dialog.Content: use one direct Dialog.Panel child, optionally inside fragments, without substantive siblings.');
  }
  return children;
}

/** Render the dialog's surface and padding inside Dialog.Content. */
function DialogPanel(props: DialogPanelProps) {
  const context = useContext(DialogPanelContext);
  if (!context) throw new Error('Dialog.Panel must be rendered inside <Dialog.Content>.');
  return (
    <SurfaceRoot
      {...props}
      owner="Dialog.Panel"
      marker="dialog-panel"
      variant="floating"
      structure={panelStyle}
      internalRef={context.panelRef}
      containerRef={context.dialogRef}
    />
  );
}

DialogPanel.displayName = 'Dialog.Panel';

/** Name the dialog with a visible heading. */
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

/** Describe the dialog below its heading. */
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

/** Request closure; the shell's onCancel handler can veto it. */
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

/** Show a modal task or decision with generated content or compound parts. */
export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Panel: DialogPanel,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});
