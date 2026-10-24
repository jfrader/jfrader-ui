'use client';

// Pattern: a native button that shows a persisted value and swaps to a native input (or
// textarea) for editing; no dedicated APG pattern exists, so each part keeps its native
// semantics (APG button for the trigger and the Save/Cancel/Retry actions).
// Keyboard: Enter/Space on the trigger opens the editor with the text selected; Enter saves
// (Shift+Enter is a newline when multiline); Escape cancels; Tab and Shift+Tab move natively
// through editor, Save, Cancel and the page. Leaving the whole widget saves when `saveOnBlur`.
// Composition bypasses Enter, Escape and the leave save.
//
// Persistence comes before commitment: a changed draft goes through `onSave`, and only a
// resolved save requests `onValueChange(next)` and then `onOpenChange(false)`. The trigger
// always shows the persisted value (the controlled prop), never the draft. A failed save keeps
// the draft open and reports through the error part, like validation; one closed by the parent
// mid-save offers Retry. An external value update or unmount while a save is pending drops that
// save's settlement, unless the update is the value being saved (an optimistic parent).
//
// Geometry: one block size per `size`, Button's. The resting value, the single-line editor and
// the Save/Cancel Buttons all take it, so opening never shifts the row and the actions line up
// with the field.
// Keyboard and button saves/cancels return focus to the trigger once the close is accepted, even
// later, unless focus has moved elsewhere meanwhile; leaving saves never move focus.
import type { ComponentType } from 'react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CompositionEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { inputControlStyle } from '../../styling/input-control';
import { loadingRing } from '../../styling/loading-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, type SxProps } from '../../styling/sx';
import { touchTargetStyle } from '../../styling/touch-target';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, buttonBlockSizes, type ButtonProps } from '../button/button';
import { FieldDescription, FieldError } from '../field/field-anatomy';
import { FieldSlot, type FieldSlots, type FieldParts, type FieldElementProps } from '../field/field-slot';

export type InlineEditVariant = 'title' | 'body';
export type InlineEditSize = 'sm' | 'md' | 'lg';
export type InlineEditPhase = 'idle' | 'saving' | 'saved' | 'failed';

type ControlElement = HTMLInputElement | HTMLTextAreaElement;

export interface InlineEditMessages {
  /**
   * Accessible name of the value button; `value` is the saved value. When empty,
   * the visible placeholder follows this text in the name.
   */
  edit: (context: { label: string; value: string }) => string;
  save: string;
  cancel: string;
  retry: string;
  /** Keyboard instructions read with the editor. */
  instructions: (context: { multiline: boolean }) => string;
  saving: string;
  saved: string;
  /** Error shown and announced when `onSave` throws or rejects. */
  failed: string;
}

type ActionPart = 'save' | 'cancel' | 'retry';

export type InlineEditSlotProps = Omit<FieldParts<InlineEditAnatomy>, 'control' | ActionPart> & {
  /** Input or textarea control receiving draft edits. Renders an `input` by default, or a `textarea` when `multiline` is true. */
  control?: FieldElementProps<'input'> | FieldElementProps<'textarea'>;
  /** Save Button. Size, variant and the accessible name stay component-owned. */
  save?: ButtonProps;
  /** Cancel Button. Size, variant and the accessible name stay component-owned. */
  cancel?: ButtonProps;
  /** Retry Button shown after a save fails with the editor closed. */
  retry?: ButtonProps;
};

/** Native editor attributes and handlers. The component sets value, editability and placeholder. */
export interface InlineEditControlProps extends Omit<
  TextareaHTMLAttributes<ControlElement>,
  'value' | 'defaultValue' | 'children' | 'disabled' | 'readOnly' | 'placeholder' | 'cols' | 'dangerouslySetInnerHTML'
> {}

type InlineEditAnatomy = {
  /** Outer container wrapping the inline edit field. */
  root: 'div';
  /** Label element associated with the editor. */
  label: 'label';
  /** Screen-reader instruction text describing keyboard interaction. */
  instructions: 'span';
  /** Editor container holding the active control and action buttons. */
  editor: 'div';
  /** Read-only button trigger activating edit mode on click. */
  trigger: 'button';
  /** Input or textarea control receiving draft edits. Renders an `input` by default, or a `textarea` when `multiline` is true. */
  control: 'input';
  /** Action container holding the Save and Cancel Buttons. */
  actions: 'div';
  /** Button saving the edited value. */
  save: 'button';
  /** Button discarding draft changes. */
  cancel: 'button';
  /** Button re-attempting a failed save after the editor closed. */
  retry: 'button';
  /** Helper text element displayed below the field. */
  description: 'span';
  /** Validation, external or failed-save error displayed when invalid. */
  error: 'span';
  /** Screen-reader live region announcing save status. */
  status: 'span';
};
export type InlineEditSlots = Omit<FieldSlots<InlineEditAnatomy>, 'control' | ActionPart> & {
  /** Input or textarea control receiving draft edits. Renders an `input` by default, or a `textarea` when `multiline` is true. */
  control?: ComponentType<ComponentPropsWithRef<'input'> | ComponentPropsWithRef<'textarea'>>;
  /** Replaces the Save Button; forwards the Button props and ref it receives. */
  save?: ComponentType<ButtonProps>;
  /** Replaces the Cancel Button; forwards the Button props and ref it receives. */
  cancel?: ComponentType<ButtonProps>;
  /** Replaces the Retry Button; forwards the Button props and ref it receives. */
  retry?: ComponentType<ButtonProps>;
};

export interface InlineEditProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'>, SxProps {
  /** Saved value shown by the trigger, not the draft. */
  value?: string;
  /** Initial uncontrolled saved text. Defaults to an empty string. */
  defaultValue?: string;
  /** Requested once per resolved save, before the close request. */
  onValueChange?: (value: string) => void;
  /** Editing mode, independent from the value. */
  open?: boolean;
  /** Starts uncontrolled editing on mount. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Requests entering or leaving editing mode. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Persists a changed value. A returned promise keeps the editor pending until it settles; throw or
   * reject to keep the editor open with `messages.failed` as its error.
   */
  onSave: (next: string) => void | Promise<unknown>;
  /** Accessible name of the editor and part of the trigger's name. */
  label: string;
  /** Returns a nonempty message to block the save and keep the editor open. */
  validate?: (next: string) => string | null | undefined;
  /** Turns the draft into the saved value. Defaults to the draft as typed. */
  normalize?: (draft: string) => string;
  /** Edits in a textarea; Shift+Enter inserts a newline. */
  multiline?: boolean;
  /** Chooses title or body typography. Defaults to `title`. */
  variant?: InlineEditVariant;
  /** Sets one block size, Button's, for the value, the single-line editor and its actions. Defaults to `md`. */
  size?: InlineEditSize;
  /** Disables editing and saving. Defaults to `false`. */
  disabled?: boolean;
  /** Prevents editing while keeping the value trigger focusable. Defaults to `false`. */
  readOnly?: boolean;
  /** Saves when focus leaves the whole widget. */
  saveOnBlur?: boolean;
  /** Content shown while the saved value is empty. */
  placeholder?: ReactNode;
  /** Native placeholder of the editor. */
  inputPlaceholder?: string;
  /** Helper content associated with the trigger and editor. */
  description?: ReactNode;
  /** External error; while present it marks the editor invalid and blocks saving. */
  error?: ReactNode;
  /** Adds native editor attributes and handlers; value, editability and placeholder stay component-owned. */
  controlProps?: InlineEditControlProps;
  /** The editor element, or null when not editing. */
  controlRef?: Ref<ControlElement>;
  /** Overrides English action labels, keyboard instructions and save announcements. */
  messages?: Partial<InlineEditMessages>;
  /** Replaces the trigger's decorative pencil icon. */
  editIcon?: ReactNode;
  /** Replaces the Save Button's decorative check icon. */
  saveIcon?: ReactNode;
  /** Replaces the Cancel Button's decorative cross icon. */
  cancelIcon?: ReactNode;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: InlineEditSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: InlineEditSlots;
  /** Supplies attributes, refs and `sx` to generated parts. */
  slotProps?: InlineEditSlotProps;
}

type FocusIntent = 'select' | 'end' | 'trigger';

const DEFAULT_MESSAGES: InlineEditMessages = {
  edit: ({ label, value }) => (value === '' ? `Edit ${label}` : `Edit ${label}: ${value}`),
  save: 'Save',
  cancel: 'Cancel',
  retry: 'Retry save',
  instructions: ({ multiline }) =>
    multiline
      ? 'Press Enter to save, Shift+Enter for a new line, Escape to cancel.'
      : 'Press Enter to save, Escape to cancel.',
  saving: 'Saving…',
  saved: 'Saved',
  failed: 'Could not save. Try again.',
};

type AnnouncedPhase = Extract<InlineEditPhase, 'saving' | 'saved'>;
const isAnnounced = (phase: InlineEditPhase): phase is AnnouncedPhase => phase === 'saving' || phase === 'saved';

const identity = (draft: string) => draft;

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && typeof (value as PromiseLike<unknown>).then === 'function';

const isComposing = (event: KeyboardEvent<HTMLElement>) =>
  event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;

// Pointer presses on the actions keep focus in the editor, so pressing Save never blurs it first.
const keepFocus = (event: MouseEvent) => event.preventDefault();

const rootStyle = css({
  label: 'inline-edit',
  position: 'relative',
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[1],
  minInlineSize: 0,
  maxInlineSize: '100%',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  textAlign: 'start',
});

const variantStyles: Record<InlineEditVariant, SerializedStyles> = {
  title: css({ fontSize: vars.textSize.xl, fontWeight: vars.fontWeight.medium }),
  body: css({ fontSize: vars.textSize.md, fontWeight: vars.fontWeight.regular }),
};

// Shared box so text sits at the same spot resting and editing.
const fieldBox = {
  boxSizing: 'border-box',
  margin: 0,
  paddingInline: vars.space[2],
  borderRadius: vars.radius.md,
  fontFamily: 'inherit',
} as const;

// A single line centers in the size's block with tight leading, so a title fits the smallest size.
// Multiline text keeps body leading and pads its first line instead.
const lineStyles = {
  single: css({ paddingBlock: 0, lineHeight: vars.lineHeight.tight }),
  multi: css({ paddingBlock: vars.space[1], lineHeight: 'inherit' }),
} as const;

const minBlockStyles: Record<InlineEditSize, SerializedStyles> = {
  sm: css({ minBlockSize: buttonBlockSizes.sm }),
  md: css({ minBlockSize: buttonBlockSizes.md }),
  lg: css({ minBlockSize: buttonBlockSizes.lg }),
};

const blockStyles: Record<InlineEditSize, SerializedStyles> = {
  sm: css({ blockSize: buttonBlockSizes.sm }),
  md: css({ blockSize: buttonBlockSizes.md }),
  lg: css({ blockSize: buttonBlockSizes.lg }),
};

// Empty triggers and icon actions are square at the size's block.
const squareStyles: Record<InlineEditSize, SerializedStyles> = {
  sm: css({ minInlineSize: buttonBlockSizes.sm }),
  md: css({ minInlineSize: buttonBlockSizes.md }),
  lg: css({ minInlineSize: buttonBlockSizes.lg }),
};

const triggerStyle = css({
  ...fieldBox,
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  maxInlineSize: '100%',
  minInlineSize: 0,
  border: '1px solid transparent',
  backgroundColor: 'transparent',
  color: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
    borderColor: vars.color.borderControl,
  },
  '&:focus-visible': focusRingOutset,
  '&:disabled, &[aria-disabled="true"]': { cursor: 'not-allowed' },
  '&:disabled': { opacity: 0.55 },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    color: 'ButtonText',
    '&:hover:not(:disabled):not([aria-disabled="true"])': { borderColor: 'ButtonText' },
  },
});

const valueStyle = css({
  minInlineSize: 0,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});

const placeholderStyle = css({ color: vars.color.textMuted });

const editIconStyle = css({
  color: vars.color.textMuted,
  fontSize: vars.textSize.md,
  [FORCED_COLORS]: { color: 'ButtonText' },
});

const editorStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: vars.space[1],
  justifySelf: 'stretch',
  minInlineSize: 0,
});

const controlStyle = css({
  ...fieldBox,
  // The editor wants room for a short title before the actions wrap below it.
  flex: `1 1 calc(${vars.space[12]} * 4)`,
  minInlineSize: 0,
  inlineSize: 'auto',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  '&[readonly]': { cursor: 'progress' },
});

// field-sizing grows the textarea with its content; engines without it keep `rows`.
const multilineStyle = css({ fieldSizing: 'content', resize: 'none' });

const actionsStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  flexShrink: 0,
});

// Save and Cancel are icon-only Buttons of the editor's size, square at its block.
const iconActionStyle = css({ flexShrink: 0, paddingInline: 0 });
const iconActionSizeStyles: Record<InlineEditSize, SerializedStyles> = {
  sm: css({ inlineSize: buttonBlockSizes.sm }),
  md: css({ inlineSize: buttonBlockSizes.md }),
  lg: css({ inlineSize: buttonBlockSizes.lg }),
};

const statusStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.regular,
  color: vars.color.textMuted,
  // An idle live region stays in the accessibility tree but leaves the grid, so the widget is
  // exactly its value's height.
  '&:empty': { position: 'absolute' },
});

const glyphStyle = css({
  display: 'inline-flex',
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '@starting-style': { opacity: 0 },
  '& svg': { inlineSize: '1em', blockSize: '1em' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});

const savedGlyphStyle = css({ color: vars.color.success, [FORCED_COLORS]: { color: 'CanvasText' } });

const ringStyle = css({
  ...loadingRing,
  boxSizing: 'border-box',
  inlineSize: '0.875em',
  blockSize: '0.875em',
  [REDUCED_MOTION]: { animation: 'none' },
});

const glyphProps = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const pencilGlyph = (
  <svg {...glyphProps}>
    <path d="M10.5 3.5l2 2M3 13l.5-2.5 7.25-7.25a1.4 1.4 0 0 1 2 2L5.5 12.5 3 13z" />
  </svg>
);
const checkGlyph = (
  <svg {...glyphProps}>
    <path d="M3 8.5l3.25 3.25L13 5" />
  </svg>
);
const crossGlyph = (
  <svg {...glyphProps}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </svg>
);

const statusGlyphs: Record<AnnouncedPhase, ReactNode> = {
  saving: <span css={ringStyle} />,
  saved: <span css={savedGlyphStyle}>{checkGlyph}</span>,
};

interface ActionProps extends ButtonProps {
  component?: ComponentType<ButtonProps>;
  partProps?: ButtonProps;
}

// Generated actions are Buttons. As in FieldSlot, own props win over `slotProps`, handlers from
// both run (the part's first), and styles stack own, then the part's `sx`.
function InlineEditAction({ component: Action = Button, partProps: part, className, sx, ...own }: ActionProps) {
  const merged: ButtonProps = { ...withoutSx(part), ...own };
  for (const key of Object.keys(part ?? {})) {
    if (!/^on[A-Z]/.test(key)) continue;
    const ownHandler = Reflect.get(own, key);
    const partHandler = Reflect.get(part!, key);
    if (typeof partHandler !== 'function') continue;
    Reflect.set(merged, key, (event: unknown) => {
      partHandler(event);
      if (typeof ownHandler === 'function') ownHandler(event);
    });
  }
  return (
    <Action
      {...merged}
      className={[part?.className, className].filter(Boolean).join(' ') || undefined}
      sx={[sx, part?.sx]}
    />
  );
}

export function InlineEdit({
  ref,
  value,
  defaultValue = '',
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  onSave,
  label,
  validate,
  normalize = identity,
  multiline = false,
  variant = 'title',
  size = 'md',
  disabled = false,
  readOnly = false,
  saveOnBlur = true,
  placeholder,
  inputPlaceholder,
  description,
  error,
  controlProps,
  controlRef,
  messages: messagesProp,
  editIcon = pencilGlyph,
  saveIcon = checkGlyph,
  cancelIcon = crossGlyph,
  component,
  slots,
  slotProps,
  className,
  sx,
  onBlur,
  ...rest
}: InlineEditProps) {
  const text: InlineEditMessages = { ...DEFAULT_MESSAGES, ...messagesProp };
  const [committedState, requestValue] = useControlledState(value, defaultValue, onValueChange);
  const committed = committedState ?? '';
  const [openState, requestOpen] = useControlledState(open, defaultOpen, onOpenChange);
  const isOpen = openState ?? false;

  const [draft, setDraft] = useState(committed);
  const [phase, setPhase] = useState<InlineEditPhase>('idle');
  // The draft of the last failed save; '' is a real draft, so absence is null.
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [focusIntent, setFocusIntent] = useState<FocusIntent | null>(null);
  const [refreshDraft, setRefreshDraft] = useState(false);

  // An accepted open starts a fresh draft from the persisted value.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraft(committed);
      setInvalid(null);
      if (phase !== 'saving') {
        setPhase('idle');
        setFailedDraft(null);
      }
    }
  }
  // After a resolved save the draft shows what the parent actually persisted, so a rejected
  // close never leaves the saved-but-rejected text looking committed.
  if (refreshDraft) {
    setRefreshDraft(false);
    setDraft(committed);
  }

  const baseId = useId();
  const controlId = controlProps?.id ?? `${baseId}-control`;
  const labelId = `${baseId}-label`;
  const instructionsId = `${baseId}-instructions`;
  const descriptionId = `${baseId}-description`;
  const errorId = `${baseId}-error`;

  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRootRef = useMergeRefs([rootRef, ref]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const controlElement = useRef<ControlElement>(null);
  const mergedControlRef = useMergeRefs([controlElement, controlRef]);
  const pointerOpen = useRef(false);
  const composing = useRef(false);
  const runRef = useRef<{ next: string } | null>(null);
  const mounted = useRef(false);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  const committedRef = useRef(committed);

  const focusInside = () => {
    const root = rootRef.current;
    const active = root?.ownerDocument.activeElement;
    return root != null && active != null && root.contains(active);
  };

  const focusUnclaimed = () => {
    const root = rootRef.current;
    if (!root) return false;
    const { activeElement, body } = root.ownerDocument;
    return activeElement === null || activeElement === body || root.contains(activeElement);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      runRef.current = null;
    };
  }, []);

  // A persisted value that changes while a save is pending came from outside: that save's
  // settlement is stale and must not overwrite it. The value being saved is that save landing
  // early (an optimistic parent), so the save keeps settling.
  useLayoutEffect(() => {
    if (committedRef.current === committed) return;
    committedRef.current = committed;
    if (runRef.current === null || runRef.current.next === committed) return;
    runRef.current = null;
    setPhase('idle');
  }, [committed]);

  // An intent waits for its transition: the parent may accept the open or close request later.
  // It applies only if the user has not departed (below) and focus is still unclaimed (inside the
  // widget or dropped with a removed part), so a late acceptance never pulls focus back.
  useLayoutEffect(() => {
    if (focusIntent === null || (focusIntent === 'trigger') === isOpen) return;
    setFocusIntent(null);
    if (!focusUnclaimed()) return;
    if (focusIntent === 'trigger') {
      triggerRef.current?.focus();
      return;
    }
    const control = controlElement.current;
    if (!control) return;
    control.focus();
    if (focusIntent === 'select') control.select();
    else control.setSelectionRange(control.value.length, control.value.length);
  }, [focusIntent, isOpen]);

  // Departing the widget drops a pending intent: focus landing outside, or a press outside that
  // may move focus, even onto plain content. A blur to nothing is caught by handleBlur. A part
  // removed by the accepted transition drops focus without any of these, so it keeps the intent.
  useEffect(() => {
    const root = rootRef.current;
    if (focusIntent === null || !root) return;
    const { ownerDocument } = root;
    const handleDeparture = (event: Event) => {
      if (event.defaultPrevented || event.composedPath().includes(root)) return;
      setFocusIntent(null);
    };
    ownerDocument.addEventListener('mousedown', handleDeparture);
    ownerDocument.addEventListener('focusin', handleDeparture);
    return () => {
      ownerDocument.removeEventListener('mousedown', handleDeparture);
      ownerDocument.removeEventListener('focusin', handleDeparture);
    };
  }, [focusIntent]);

  // A native reset of the editor's form discards the draft; it never saves.
  useEffect(() => {
    const control = controlElement.current;
    const owner = control?.form;
    if (!control || !owner) return;
    let active = true;
    const handleReset = (event: Event) => {
      queueMicrotask(() => {
        if (!active || event.defaultPrevented) return;
        control.value = committedRef.current;
        setDraft(committedRef.current);
        setInvalid(null);
      });
    };
    owner.addEventListener('reset', handleReset);
    return () => {
      active = false;
      owner.removeEventListener('reset', handleReset);
    };
  }, [isOpen, multiline, controlProps?.form]);

  const editable = !disabled && !readOnly;
  const saving = phase === 'saving';
  const hasExternalError = isRenderable(error);
  const errorContent = hasExternalError ? error : (invalid ?? (phase === 'failed' ? text.failed : null));
  const hasError = isRenderable(errorContent);
  const hasDescription = isRenderable(description);

  const persist = (next: string, returnFocus: boolean) => {
    const run = { next };
    runRef.current = run;
    setPhase('saving');
    const settle = (ok: boolean) => {
      if (!mounted.current || runRef.current !== run) return;
      runRef.current = null;
      if (!ok) {
        setPhase('failed');
        setFailedDraft(next);
        return;
      }
      setPhase('saved');
      setFailedDraft(null);
      setRefreshDraft(true);
      requestValue(next);
      if (returnFocus && focusInside()) setFocusIntent('trigger');
      if (openRef.current) requestOpen(false);
    };
    let result: unknown;
    try {
      result = onSave(next);
    } catch {
      settle(false);
      return;
    }
    if (isThenable(result))
      result.then(
        () => settle(true),
        () => settle(false),
      );
    else settle(true);
  };

  const close = (returnFocus: boolean) => {
    if (returnFocus && focusInside()) setFocusIntent('trigger');
    requestOpen(false);
  };

  // The one gate for every persistence attempt: editor saves and Retry. `prepare` runs past the
  // gate only, so a blocked attempt never reaches consumer code.
  const submit = (prepare: () => string, returnFocus: boolean) => {
    if (!editable || saving || runRef.current !== null) return;
    const next = prepare();
    if (next === committed) {
      setInvalid(null);
      setPhase('idle');
      setFailedDraft(null);
      close(returnFocus);
      return;
    }
    if (hasExternalError) return;
    const message = validate?.(next);
    if (typeof message === 'string' && message !== '') {
      setInvalid(message);
      return;
    }
    setInvalid(null);
    persist(next, returnFocus);
  };

  const save = (returnFocus: boolean) => submit(() => normalize(draft), returnFocus);

  /** Returns whether the cancel was handled. */
  const cancel = () => {
    if (!editable || saving) return false;
    setDraft(committed);
    setInvalid(null);
    if (phase === 'failed') setPhase('idle');
    setFailedDraft(null);
    close(true);
    return true;
  };

  // The failed draft was normalized when it was first saved.
  const retry = () => {
    if (failedDraft !== null) submit(() => failedDraft, true);
  };

  const handleTriggerClick = () => {
    const pointer = pointerOpen.current;
    pointerOpen.current = false;
    if (!editable || saving) return;
    setFocusIntent(pointer ? 'end' : 'select');
    requestOpen(true);
  };

  const handleChange = (event: ChangeEvent<ControlElement>) => {
    controlProps?.onChange?.(event as ChangeEvent<ControlElement, HTMLTextAreaElement>);
    if (!editable || saving) return;
    setDraft(event.currentTarget.value);
    setInvalid(null);
    // Editing past a failure starts over: the error clears and Retry no longer targets the old draft.
    if (phase === 'failed') {
      setPhase('idle');
      setFailedDraft(null);
    }
  };

  const handleControlKeyDown = (event: KeyboardEvent<ControlElement>) => {
    controlProps?.onKeyDown?.(event);
    if (event.key !== 'Enter' || (multiline && event.shiftKey)) return;
    if (event.defaultPrevented || composing.current || isComposing(event)) return;
    // Enter never submits a surrounding form.
    event.preventDefault();
    if (!event.repeat) save(true);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented || composing.current || isComposing(event)) return;
    if (!cancel()) return;
    // A handled Escape belongs to the editor; an enclosing overlay must not dismiss with it.
    event.preventDefault();
    event.stopPropagation();
  };

  const handleCompositionStart = (event: CompositionEvent<ControlElement>) => {
    composing.current = true;
    controlProps?.onCompositionStart?.(event);
  };

  const handleCompositionEnd = (event: CompositionEvent<ControlElement>) => {
    composing.current = false;
    controlProps?.onCompositionEnd?.(event);
  };

  // Only focus leaving the whole widget is a leave: it drops a pending focus intent and saves. A
  // window blur leaves the element focused in its document, so it is not a leave.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    // contains() works across documents, unlike an instanceof check against this window's Node.
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (event.currentTarget.ownerDocument.activeElement === event.target) return;
    setFocusIntent(null);
    // openRef: an editor removed by a close must not save from its stale handler.
    if (!openRef.current || !saveOnBlur || composing.current) return;
    save(false);
  };

  const triggerDescribedBy =
    [hasDescription && descriptionId, hasError && errorId].filter(Boolean).join(' ') || undefined;
  const controlDescribedBy = [
    controlProps?.['aria-describedby'],
    instructionsId,
    hasDescription && descriptionId,
    hasError && errorId,
  ]
    .filter(Boolean)
    .join(' ');
  const consumerLabelledBy = controlProps?.['aria-labelledby'];
  const isEmpty = committed === '';

  const controlAttributes = {
    ...controlProps,
    ref: mergedControlRef,
    id: controlId,
    value: draft,
    placeholder: inputPlaceholder,
    disabled,
    readOnly: readOnly || saving,
    'aria-labelledby': consumerLabelledBy === undefined ? undefined : `${labelId} ${consumerLabelledBy}`,
    'aria-describedby': controlDescribedBy,
    'aria-invalid': hasError ? true : controlProps?.['aria-invalid'],
    onChange: handleChange,
    onKeyDown: handleControlKeyDown,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  };
  const { rows: _rows, wrap: _wrap, ...inputAttributes } = controlAttributes;
  const line = multiline ? lineStyles.multi : lineStyles.single;
  const controlCss = [
    inputControlStyle,
    controlStyle,
    variantStyles[variant],
    line,
    multiline ? minBlockStyles[size] : blockStyles[size],
    touchTargetStyle,
  ];
  const iconActionCss = [iconActionStyle, iconActionSizeStyles[size]];

  return (
    <FieldSlot
      behavior={{ onBlur: handleBlur }}
      element="div"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      root
      styles={rootStyle}
      sx={sx}
      {...rest}
      ref={mergedRootRef}
      data-ui="inline-edit"
      data-state={isOpen ? 'open' : 'closed'}
      data-phase={phase}
      stateProps={{ 'aria-busy': saving ? true : (slotProps?.root?.['aria-busy'] ?? rest['aria-busy']) }}
      onBlur={onBlur}
      className={className}
    >
      {isOpen ? (
        <>
          <FieldSlot
            element="label"
            component={slots?.label}
            slotProps={slotProps?.label}
            id={labelId}
            htmlFor={controlId}
            styles={visuallyHiddenStyle}
          >
            {label}
          </FieldSlot>
          <FieldSlot
            element="span"
            component={slots?.instructions}
            slotProps={slotProps?.instructions}
            id={instructionsId}
            styles={visuallyHiddenStyle}
          >
            {text.instructions({ multiline })}
          </FieldSlot>
          <FieldSlot
            element="div"
            component={slots?.editor}
            slotProps={slotProps?.editor}
            styles={editorStyle}
            onKeyDown={handleEditorKeyDown}
          >
            {multiline ? (
              <FieldSlot
                element="textarea"
                component={slots?.control}
                slotProps={slotProps?.control as FieldElementProps<'textarea'>}
                rows={3}
                {...controlAttributes}
                styles={[...controlCss, multilineStyle]}
              />
            ) : (
              <FieldSlot
                element="input"
                component={slots?.control}
                slotProps={slotProps?.control as FieldElementProps<'input'>}
                type="text"
                {...inputAttributes}
                styles={controlCss}
              />
            )}
            <FieldSlot element="div" component={slots?.actions} slotProps={slotProps?.actions} styles={actionsStyle}>
              <InlineEditAction
                component={slots?.save}
                partProps={slotProps?.save}
                variant="soft"
                tone="accent"
                size={size}
                loading={saving}
                aria-label={text.save}
                aria-disabled={readOnly || undefined}
                disabled={disabled}
                startIcon={isRenderable(saveIcon) ? saveIcon : undefined}
                onMouseDown={keepFocus}
                onClick={() => save(true)}
                sx={iconActionCss}
              />
              <InlineEditAction
                component={slots?.cancel}
                partProps={slotProps?.cancel}
                variant="ghost"
                size={size}
                aria-label={text.cancel}
                aria-disabled={saving || readOnly || undefined}
                disabled={disabled}
                startIcon={isRenderable(cancelIcon) ? cancelIcon : undefined}
                onMouseDown={keepFocus}
                onClick={cancel}
                sx={iconActionCss}
              />
            </FieldSlot>
          </FieldSlot>
        </>
      ) : (
        <FieldSlot
          element="button"
          component={slots?.trigger}
          slotProps={slotProps?.trigger}
          ref={triggerRef}
          type="button"
          aria-label={isEmpty ? undefined : text.edit({ label, value: committed })}
          aria-describedby={triggerDescribedBy}
          aria-disabled={readOnly || saving || undefined}
          disabled={disabled}
          onPointerDown={() => {
            pointerOpen.current = true;
          }}
          onKeyDown={() => {
            pointerOpen.current = false;
          }}
          onClick={handleTriggerClick}
          styles={[triggerStyle, variantStyles[variant], line, minBlockStyles[size], squareStyles[size], touchTargetStyle]}
        >
          {isEmpty ? (
            // Named by its content, so a visible placeholder is always part of the name.
            <span css={[valueStyle, placeholderStyle]}>
              <span css={visuallyHiddenStyle}>{`${text.edit({ label, value: committed })} `}</span>
              {placeholder}
            </span>
          ) : (
            <span css={valueStyle}>{committed}</span>
          )}
          {isRenderable(editIcon) && (
            <span aria-hidden css={[iconWrapperStyle, editIconStyle]}>
              {editIcon}
            </span>
          )}
        </FieldSlot>
      )}
      <FieldDescription component={slots?.description} id={descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError component={slots?.error} id={errorId} part={slotProps?.error}>
        {errorContent}
      </FieldError>
      {!isOpen && failedDraft !== null && (
        <InlineEditAction
          component={slots?.retry}
          partProps={slotProps?.retry}
          variant="outline"
          size={size}
          loading={saving}
          aria-disabled={!editable || undefined}
          disabled={disabled}
          onClick={retry}
        >
          {text.retry}
        </InlineEditAction>
      )}
      <FieldSlot
        element="span"
        component={slots?.status}
        slotProps={slotProps?.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        styles={statusStyle}
      >
        {isAnnounced(phase) && (
          <>
            <span key={phase} aria-hidden css={glyphStyle}>
              {statusGlyphs[phase]}
            </span>
            {text[phase]}
          </>
        )}
      </FieldSlot>
    </FieldSlot>
  );
}

InlineEdit.displayName = 'InlineEdit';
