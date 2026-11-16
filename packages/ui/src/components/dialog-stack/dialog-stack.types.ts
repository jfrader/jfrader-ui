import {
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { useNativeDialogRoot } from '../../overlay/use-native-dialog';
import type { SxProps } from '../../styling/sx';
import type { GeneratedRootSlotProps } from '../../utils/generated-root';
import type { DrawerPanelProps } from '../drawer';

export type DialogStackVariant = 'auto' | 'sheet' | 'dialog';
export type ResolvedVariant = Exclude<DialogStackVariant, 'auto'>;
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

export interface DialogStackComposedProps extends DialogStackBaseProps {
  /** Supplies stack triggers and panels in composed mode. */
  children?: ReactNode;
  pages?: never;
  triggerLabel?: never;
  initialPage?: never;
  slots?: never;
  slotProps?: never;
  component?: never;
}

export interface DialogStackShorthandProps extends DialogStackBaseProps {
  /** Name the button that opens the stack. */
  triggerLabel?: ReactNode;
  /** The panel key opened by the trigger button. Defaults to the first page's value. */
  initialPage?: string;
  /** Page specifications for the stack. */
  pages: readonly DialogStackPageRecord[];
  children?: never;
  /** Replaces the panels and controls generated from `pages`. */
  slots?: DialogStackSlots;
  /** Passes props and styles to the generated panels and controls. Page overrides take precedence. */
  slotProps?: DialogStackSlotProps;
  /** Replaces each panel's adopted div, not the dialog shell. `slots.root` takes precedence. */
  component?: DialogStackSlots['root'];
}

export type DialogStackProps = DialogStackComposedProps | DialogStackShorthandProps;

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

export interface Naming {
  label: string | undefined;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

/** What the Root knows about one declared sheet; written by its Content. */
export interface SheetEntry {
  dismissible: boolean;
  onCancel: ((event: Event) => void) | undefined;
  panel: HTMLDivElement | null;
}

export interface DialogStackContextValue extends DialogStackActions {
  contained: boolean;
  variant: ResolvedVariant;
  stage: HTMLDivElement | null;
  setStage: (element: HTMLDivElement | null) => void;
  setLayer: (element: HTMLElement | null) => void;
  register: (key: string, entry: SheetEntry) => void;
  unregister: (key: string, entry: SheetEntry) => void;
  setNaming: (naming: Naming) => void;
  dismissTop: () => void;
}

export interface SheetContentContextValue {
  titleId: string;
  descriptionId: string;
  setHasTitle: (present: boolean) => void;
  setHasDescription: (present: boolean) => void;
}

export interface ViewportLayerProps {
  native: ReturnType<typeof useNativeDialogRoot> & { open: boolean };
  naming: Naming;
  variant: ResolvedVariant;
}

export interface DragSession {
  pointerId: number;
  start: number;
  extent: number;
  offset: number;
  samples: { position: number; time: number }[];
}

