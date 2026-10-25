'use client';
import { numberFormatter } from '../../utils/intl';

// Pattern: native text input plus a named list of committed tokens, each with a native remove
// button. No listbox, combobox or roving tabindex: DOM focus stays on the input while a token is
// picked, the pick is conveyed by an outline, `aria-describedby` and a polite status message.
// Keyboard: Enter/comma commit the draft; Backspace at caret 0 picks the last token and a second
// press removes it; ArrowLeft/ArrowRight move the pick in list order (past the last token returns
// to the input); Escape drops the pick; Tab follows DOM order: remove buttons, input, page. Composition
// bypasses every shortcut and the field-exit commit. The committed list and the draft are independent
// controlled axes; a native form reset restores the uncontrolled ones without callbacks.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CompositionEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { controlSizeStyles, controlTouchTargetStyles } from '../../styling/control-size';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { inputControlStyle } from '../../styling/input-control';
import { COARSE_POINTER, FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  useFieldAnatomy,
  type FieldLabelPlacement,
  type FieldPartProps,
} from '../field/field-anatomy';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';

export type TagInputSize = 'sm' | 'md' | 'lg';
export type TagInputSeparator = 'Enter' | ',';

export interface TagInputMessages {
  /** Accessible name of the token list. */
  listLabel: string;
  /** Accessible name of a token's remove button. */
  remove: (token: string) => string;
  added: (token: string) => string;
  removed: (token: string) => string;
  picked: (token: string) => string;
  /** Receives the committed token the draft matched. */
  duplicate: (token: string) => string;
  /** Receives `maxTokens`. */
  limit: (count: number) => string;
  /** Validation message while `required` and no token is committed. */
  required: string;
}

export interface TagInputPartProps extends FieldPartProps {}

export type TagInputSlotProps = FieldParts<TagInputAnatomy>;

type TagInputAnatomy = {
  /** Outer container wrapping the tag input field. */
  root: 'div';
  /** Label element associated with the tag input. */
  label: 'label';
  /** Container enclosing the token list and text input. */
  control: 'div';
  /** Native text input receiving new tag values. */
  input: 'input';
  /** Unordered list containing committed tag tokens. */
  list: 'ul';
  /** List item representing an individual committed tag. */
  token: 'li';
  /** Button that removes an individual tag token. */
  remove: 'button';
  /** Helper text element displayed below the tag input. */
  description: 'span';
  /** Validation error message displayed when invalid. */
  error: 'span';
  /** Screen-reader live region announcing token additions and removals. */
  status: 'span';
};
export type TagInputSlots = FieldSlots<TagInputAnatomy>;

export interface TagInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'value' | 'defaultValue' | 'type' | 'children'>, SxProps {
  /**
   * Tokens in order. Entries must be unique, nonempty and normalized. The list renders as supplied.
   */
  value?: readonly string[];
  /** Set the initial uncontrolled tokens and their form-reset value. Defaults to an empty list. */
  defaultValue?: readonly string[];
  /** Receive the committed token list after an addition or removal request. */
  onValueChange?: (value: string[]) => void;
  /** Draft text in the input, independent from the committed tokens. */
  inputValue?: string;
  /** Set the initial uncontrolled draft and its form-reset value. Defaults to an empty string. */
  defaultInputValue?: string;
  /** Receive draft changes, including clearing the draft after a successful commit. */
  onInputChange?: (value: string) => void;
  /** Name the text input with a label. */
  label?: ReactNode;
  /** Label placement. `hidden` keeps the accessible name without taking layout space. */
  labelPlacement?: FieldLabelPlacement;
  /** Show supporting text linked to the input's accessible description. */
  description?: ReactNode;
  /** Show an error linked to the input and mark the field invalid. */
  error?: ReactNode;
  /** Set the control and token sizing. Defaults to `md`. */
  size?: TagInputSize;
  /** Keys that commit the draft. Without `','`, commas are ordinary token text. */
  separators?: readonly TagInputSeparator[];
  /** Commit the draft when focus leaves the whole field. */
  commitOnBlur?: boolean;
  /** Turns the draft into a token before comparison. Defaults to trimming whitespace. */
  normalize?: (draft: string) => string;
  /** Returns a rejection message, or `null` to accept the token. */
  validateToken?: (token: string) => string | null;
  /** Maximum token count for additions. Initial and controlled lists beyond this count are kept. */
  maxTokens?: number;
  /** Locale for duplicate comparison and default number formatting. */
  locale?: Intl.LocalesArgument;
  /** Override the English accessible labels, announcements, and validation messages. */
  messages?: Partial<TagInputMessages>;
  /** Replaces the remove glyph; rendered decoratively inside each remove button. */
  removeIcon?: ReactNode;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: TagInputSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: TagInputSlots;
  /** Pass props and `sx` to generated field parts. */
  slotProps?: TagInputSlotProps;
}

const DEFAULT_SEPARATORS: readonly TagInputSeparator[] = ['Enter', ','];
const EMPTY_TOKENS: readonly string[] = [];
// The draft keeps room for a few characters before it wraps below the tokens.
const DRAFT_MIN_INLINE_SIZE = '8ch';

const trim = (draft: string) => draft.trim();

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

/** Entries that break the list contract: empty, not normalized, or a duplicate of an earlier entry. */
const invalidTokens = (tokens: readonly string[], normalize: (draft: string) => string, collator: Intl.Collator) =>
  tokens.filter(
    (token, index) =>
      token === '' ||
      normalize(token) !== token ||
      tokens.findIndex((other) => collator.compare(other, token) === 0) !== index,
  );

function defaultMessages(locale: Intl.LocalesArgument): TagInputMessages {
  const count = numberFormatter(locale);
  return {
    listLabel: 'Tags',
    remove: (token) => `Remove ${token}`,
    added: (token) => `Added ${token}`,
    removed: (token) => `Removed ${token}`,
    picked: (token) => `${token} selected. Press Backspace to remove it.`,
    duplicate: (token) => `${token} is already added`,
    limit: (max) => `Tag limit reached: ${count.format(max)}`,
    required: 'Add at least one tag.',
  };
}

const sameTokens = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((token, index) => token === b[index]);

const rootLayoutStyle = css({ boxSizing: 'border-box' });

const shellStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[1],
  minInlineSize: 0,
  borderRadius: vars.radius.sm,
  cursor: 'text',
  '&[data-invalid]:not(:has(> input:focus-visible))': { borderColor: vars.color.dangerBorder },
  '&[data-disabled]': { opacity: 0.55, cursor: 'not-allowed' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const shellSizeStyles: Record<TagInputSize, SerializedStyles> = {
  sm: css(controlSizeStyles.sm, controlTouchTargetStyles.sm, {
    paddingBlock: `calc(${vars.space[1]} / 2)`,
    paddingInline: vars.space[1],
  }),
  md: css(controlSizeStyles.md, controlTouchTargetStyles.md, {
    paddingBlock: vars.space[1],
    paddingInline: vars.space[2],
  }),
  lg: css(controlSizeStyles.lg, controlTouchTargetStyles.lg, {
    paddingBlock: vars.space[2],
    paddingInline: vars.space[2],
  }),
};

// The list box is skipped by layout so tokens and the draft wrap as one row; the explicit
// `role="list"` keeps its semantics in engines that drop them for `display: contents`.
const listStyle = css({
  display: 'contents',
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

const tokenStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  maxInlineSize: '100%',
  minInlineSize: 0,
  minBlockSize: vars.space[6],
  paddingInlineStart: vars.space[2],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceHover,
  color: vars.color.text,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.base,
  cursor: 'default',
  transitionProperty: 'opacity, background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-enter]': { '@starting-style': { opacity: 0 } },
  '&[data-duplicate]': { borderColor: vars.color.accentText, backgroundColor: vars.color.accentSoft },
  '&[data-picked]': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '1px',
    backgroundColor: vars.color.accentSoft,
  },
  '&[data-readonly]': { paddingInlineEnd: vars.space[2] },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
    '&[data-enter]': { '@starting-style': { opacity: 1 } },
  },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    '&[data-picked]': { outlineColor: 'Highlight' },
    '&[data-duplicate]': { borderStyle: 'dashed' },
  },
});

const tokenSizeStyles: Record<TagInputSize, SerializedStyles> = {
  sm: css({ fontSize: vars.textSize.xs }),
  md: css({ fontSize: vars.textSize.sm }),
  lg: css({ fontSize: vars.textSize.sm }),
};

const tokenTextStyle = css({
  minInlineSize: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const removeStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  flexShrink: 0,
  inlineSize: vars.space[8],
  blockSize: vars.space[6],
  padding: 0,
  border: 0,
  borderRadius: vars.radius.full,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceInset, color: vars.color.text },
  '&:focus-visible': focusRingInset,
  '&:disabled': { cursor: 'not-allowed' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { color: 'ButtonText' },
});

const inputStyle = css({
  boxSizing: 'border-box',
  flex: '1 1 0%',
  minInlineSize: `min(${DRAFT_MIN_INLINE_SIZE}, 100%)`,
  maxInlineSize: '100%',
  blockSize: vars.space[6],
  margin: 0,
  paddingBlock: 0,
  paddingInline: vars.space[1],
  border: 0,
  outline: 'none',
  backgroundColor: 'transparent',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: 'inherit',
  lineHeight: vars.lineHeight.base,
  '&::placeholder': { color: vars.color.textMuted },
  '&:disabled': { cursor: 'not-allowed' },
  [COARSE_POINTER]: { fontSize: vars.textSize.md },
});

const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const removeGlyph = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="m7 7 10 10M17 7 7 17" />
  </svg>
);

type Notice = { text: string; rejection: boolean };
type PendingNotice = { kind: 'added' | 'removed'; token: string };

const isComposing = (event: KeyboardEvent<HTMLInputElement>) =>
  event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;

export function TagInput({
  ref,
  value,
  defaultValue,
  onValueChange,
  inputValue,
  defaultInputValue,
  onInputChange,
  label,
  labelPlacement = 'above',
  description,
  error,
  size = 'md',
  separators = DEFAULT_SEPARATORS,
  commitOnBlur = true,
  normalize = trim,
  validateToken,
  maxTokens,
  locale,
  messages: messagesProp,
  removeIcon = removeGlyph,
  component,
  slots,
  slotProps,
  className,
  sx,
  dir,
  name,
  form,
  disabled = false,
  readOnly = false,
  required = false,
  onChange,
  onKeyDown,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  id: idProp,
  'aria-labelledby': ariaLabelledByProp,
  'aria-describedby': ariaDescribedByProp,
  'aria-invalid': ariaInvalidProp,
  ...rest
}: TagInputProps) {
  const field = useFieldAnatomy({
    id: idProp,
    description,
    error,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
  });
  const labelId = `${field.id}-label`;
  const pickedId = `${field.id}-picked`;
  const messages = useMemo(() => defaultMessages(locale), [locale]);
  const text: TagInputMessages = { ...messages, ...messagesProp };
  const collator = useMemo(() => new Intl.Collator(locale, { usage: 'search', sensitivity: 'accent' }), [locale]);

  const initialTokens = useRef(defaultValue ?? EMPTY_TOKENS);
  const initialDraft = useRef(defaultInputValue ?? '');
  const [tokensState, requestTokensRaw, resetTokens] = useControlledState<readonly string[]>(
    value,
    initialTokens.current,
    (next) => onValueChange?.([...next]),
  );
  const tokens = tokensState ?? EMPTY_TOKENS;
  const [draftState, requestDraft, resetDraft] = useControlledState(inputValue, initialDraft.current, onInputChange);
  const draft = draftState ?? '';

  const [picked, setPicked] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  // A token that leaves the accepted list drops its pick and duplicate emphasis for good, so a
  // later list that contains the same string again starts unpicked.
  if (picked !== null && !tokens.includes(picked)) setPicked(null);
  if (duplicateOf !== null && !tokens.includes(duplicateOf)) setDuplicateOf(null);
  const [notice, setNotice] = useState<Notice>({ text: '', rejection: false });
  const [pending, setPending] = useState<PendingNotice | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergeRefs([inputRef, ref]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const composing = useRef(false);

  const warnedTokens = useRef<string | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const invalid = invalidTokens(tokens, normalize, collator);
    const warning =
      invalid.length > 0
        ? `TagInput: tokens must be unique, nonempty and normalized; invalid entries: ${JSON.stringify(invalid)}`
        : null;
    if (warning !== null && warning !== warnedTokens.current) console.warn(warning);
    warnedTokens.current = warning;
  }, [tokens, normalize, collator]);

  const requestTokens = (next: readonly string[]) => {
    if (!sameTokens(next, tokens)) requestTokensRaw(next);
  };

  // A repeated message gets a trailing no-break space so the live region announces it again.
  const announce = (message: string, rejection = false) =>
    setNotice((previous) => ({
      text: previous.text === message ? `${message} ` : message,
      rejection,
    }));

  // Added/Removed are announced once the accepted list shows the change. The request waits for a
  // delayed controlled acceptance until the next add/remove request or a form reset supersedes it,
  // so a rejected request is never announced as success.
  useEffect(() => {
    if (!pending) return;
    const present = tokens.includes(pending.token);
    if (pending.kind === 'added' ? !present : present) return;
    announce(pending.kind === 'added' ? text.added(pending.token) : text.removed(pending.token));
    setPending(null);
  }, [pending, tokens]);

  const missingTokens = required && tokens.length === 0;
  useEffect(() => {
    inputRef.current?.setCustomValidity(missingTokens ? text.required : '');
  }, [missingTokens, text.required]);

  const draftRef = useRef({ inputValue, draft });
  draftRef.current = { inputValue, draft };
  useEffect(() => {
    const input = inputRef.current;
    const owner = input?.form;
    if (!input || !owner) return;
    let active = true;
    const handleReset = (event: Event) => {
      queueMicrotask(() => {
        if (!active || event.defaultPrevented) return;
        const current = draftRef.current;
        resetTokens();
        resetDraft();
        setPicked(null);
        setDuplicateOf(null);
        setPending(null);
        setNotice({ text: '', rejection: false });
        input.value = current.inputValue === undefined ? initialDraft.current : current.draft;
      });
    };
    owner.addEventListener('reset', handleReset);
    return () => {
      active = false;
      owner.removeEventListener('reset', handleReset);
    };
  }, [form, resetTokens, resetDraft]);

  const editable = !disabled && !readOnly;

  const clearRejection = () => {
    setDuplicateOf(null);
    if (notice.rejection) setNotice({ text: '', rejection: false });
  };

  const commit = () => {
    const token = normalize(draft);
    if (token === '') return;
    const existing = tokens.find((item) => collator.compare(item, token) === 0);
    if (existing !== undefined) {
      setDuplicateOf(existing);
      announce(text.duplicate(existing), true);
      return;
    }
    if (maxTokens !== undefined && tokens.length >= maxTokens) {
      announce(text.limit(maxTokens), true);
      return;
    }
    const rejection = validateToken?.(token) ?? null;
    if (rejection !== null) {
      announce(rejection, true);
      return;
    }
    setPicked(null);
    setDuplicateOf(null);
    requestTokens([...tokens, token]);
    requestDraft('');
    setPending({ kind: 'added', token });
  };

  const remove = (token: string) => {
    setPicked(null);
    clearRejection();
    requestTokens(tokens.filter((item) => item !== token));
    setPending({ kind: 'removed', token });
  };

  const pick = (token: string | null) => {
    setPicked(token);
    if (token !== null) announce(text.picked(token));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    if (!editable) return;
    setPicked(null);
    clearRejection();
    requestDraft(event.currentTarget.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || composing.current || isComposing(event) || !editable) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const { key, currentTarget: input } = event;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const index = picked === null ? -1 : tokens.indexOf(picked);

    if (separators.includes(key as TagInputSeparator)) {
      // An empty draft keeps native behavior (Enter submits the form, comma types).
      if (draft === '') return;
      event.preventDefault();
      commit();
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      if (picked !== null) {
        event.preventDefault();
        if (!event.repeat) remove(picked);
      } else if (key === 'Backspace' && atStart && tokens.length > 0) {
        event.preventDefault();
        if (!event.repeat) pick(tokens[tokens.length - 1]!);
      }
      return;
    }
    if (event.shiftKey) return;
    if (key === 'ArrowLeft' && (picked !== null || (atStart && tokens.length > 0))) {
      event.preventDefault();
      const previous = picked === null ? tokens[tokens.length - 1]! : tokens[Math.max(index - 1, 0)]!;
      if (previous !== picked) pick(previous);
    } else if (key === 'ArrowRight' && picked !== null) {
      event.preventDefault();
      const next = tokens[index + 1];
      if (next === undefined) {
        setPicked(null);
        input.setSelectionRange(0, 0);
      } else pick(next);
    } else if (key === 'Escape' && picked !== null) {
      event.preventDefault();
      setPicked(null);
      input.setSelectionRange(0, 0);
    }
  };

  // Only leaving the whole field commits: moving between the input and remove buttons does not.
  // Leaving mid-composition keeps the provisional text as the draft instead of committing it.
  const handleFieldBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setPicked(null);
    if (commitOnBlur && editable && !composing.current) commit();
  };

  const handleCompositionStart = (event: CompositionEvent<HTMLInputElement>) => {
    composing.current = true;
    onCompositionStart?.(event);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composing.current = false;
    onCompositionEnd?.(event);
  };

  const handleRemoveClick = (token: string) => {
    // Focus moves first so the removed button never drops focus to the page.
    inputRef.current?.focus();
    remove(token);
  };

  const ariaLabelledBy =
    ariaLabelledByProp === undefined
      ? undefined
      : [isRenderable(label) && labelId, ariaLabelledByProp].filter(Boolean).join(' ');
  const describedBy = [field.describedBy, picked !== null && pickedId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldRoot
      style={rest.style}
      title={rest.title}
      component={slots?.root ?? component}
      data-ui="tag-input"
      dir={dir}
      className={className}
      sx={sx}
      part={{ ...slotProps?.root, sx: [rootLayoutStyle, slotProps?.root?.sx] }}
    >
      <FieldLabel
        component={slots?.label}
        id={labelId}
        htmlFor={field.id}
        required={required}
        hidden={labelPlacement === 'hidden'}
        part={slotProps?.label}
      >
        {label}
      </FieldLabel>
      <FieldSlot
        element="div"
        component={slots?.control}
        slotProps={slotProps?.control}
        data-invalid={field.ariaInvalid === true || field.ariaInvalid === 'true' ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        onBlur={handleFieldBlur}
        onMouseDown={(event) => {
          // Pointer presses inside the shell keep focus in the field: the input stays focused
          // (no blur commit) and remove buttons refocus it on click.
          if (disabled || event.target === inputRef.current) return;
          event.preventDefault();
          if (!(event.target as Element).closest('button')) inputRef.current?.focus();
        }}
        styles={[inputControlStyle, shellStyle, shellSizeStyles[size]]}
      >
        {tokens.length > 0 && (
          <FieldSlot
            element="ul"
            component={slots?.list}
            slotProps={slotProps?.list}
            role="list"
            aria-label={text.listLabel}
            styles={[listStyle]}
          >
            {tokens.map((token) => (
              <FieldSlot
                element="li"
                component={slots?.token}
                slotProps={slotProps?.token}
                key={token}
                data-picked={token === picked ? '' : undefined}
                data-duplicate={token === duplicateOf ? '' : undefined}
                data-readonly={readOnly ? '' : undefined}
                data-enter={mounted.current ? '' : undefined}
                styles={[tokenStyle, tokenSizeStyles[size]]}
              >
                <span id={token === picked ? pickedId : undefined} css={tokenTextStyle}>
                  {token}
                </span>
                {!readOnly && (
                  <FieldSlot
                    element="button"
                    component={slots?.remove}
                    slotProps={slotProps?.remove}
                    type="button"
                    disabled={disabled}
                    aria-label={text.remove(token)}
                    onClick={() => handleRemoveClick(token)}
                    styles={[removeStyle]}
                  >
                    <span aria-hidden css={iconWrapperStyle}>
                      {removeIcon}
                    </span>
                  </FieldSlot>
                )}
              </FieldSlot>
            ))}
          </FieldSlot>
        )}
        <FieldSlot
          element="input"
          component={slots?.input}
          slotProps={slotProps?.input}
          autoComplete="off"
          {...rest}
          ref={mergedRef}
          type="text"
          id={field.id}
          dir={dir}
          form={form}
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          aria-required={required || undefined}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={describedBy}
          aria-invalid={field.ariaInvalid}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={onBlur}
          styles={[inputStyle]}
        />
      </FieldSlot>
      <FieldDescription component={slots?.description} id={field.descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError component={slots?.error} id={field.errorId} part={slotProps?.error}>
        {error}
      </FieldError>
      <FieldSlot
        element="span"
        component={slots?.status}
        slotProps={slotProps?.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-rejection={notice.rejection ? '' : undefined}
        styles={[notice.rejection ? statusStyle : visuallyHiddenStyle]}
      >
        {notice.text}
      </FieldSlot>
      {name !== undefined &&
        !disabled &&
        tokens.map((token) => <input key={token} type="hidden" name={name} form={form} value={token} />)}
    </FieldRoot>
  );
}

TagInput.displayName = 'TagInput';
