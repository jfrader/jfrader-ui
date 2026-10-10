// APG pattern: editable combobox with listbox popup and explicit-commit list autocomplete.
// Highlighting does not commit a value; aria-selected tracks the committed value only.
// Combobox.Input is a TextField whose <input> carries role="combobox",
// aria-autocomplete="list", aria-expanded and (while open) aria-controls; the popup is a
// role="listbox" of role="option" items.
// Virtual focus: DOM focus never leaves the input. The highlighted option is exposed through
// aria-activedescendant (useListNavigation with `virtual: true`).
// Keyboard map: typing filters the options and opens the listbox when something matches,
// highlighting the first enabled match; ArrowDown/ArrowUp open (closed) or move and wrap
// (open), skipping disabled options; Home/End jump to the first/last enabled match while
// open (text-editing Home/End while closed); Enter selects the highlighted option, writes its
// label into the input and closes; Escape closes and restores the selected option's label;
// Tab (any blur) and outside press close without selecting.
// Pointer: clicking an option selects it; disabled options stay listed with
// aria-disabled="true" and ignore clicks. Pressing inside the listbox never takes focus from
// the input.
// Selection vs input text:
// - Selecting an option sets `value` and replaces the input text with the option's label.
// - Editing the text afterwards only filters; `value` is kept. Clearing the text to an empty
//   string is the one edit that clears the selection (onValueChange(null)).
// - While the text is untouched since the last selection (or Escape), the input shows the
//   selected option's label, so a parent-driven `value` change updates it.
// - onInputChange fires for typing and for label commits on selection/Escape.
// The listbox stays mounted (hidden) while closed so the input can read option labels; it is
// only positioned while open. Options that do not match the query stay mounted but hidden.
// Forms: `name` renders a hidden input carrying the selected value. Native constraint
// validation (`required`) is not wired in this version.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  FloatingList,
  FloatingPortal,
  useDismiss,
  useInteractions,
  useListItem,
  useListNavigation,
  useMergeRefs,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { TextField, type TextFieldProps } from '../text-field';

const PLACEMENT = 'bottom-start';
const SELECTED_GLYPH = '✓';
const DEFAULT_EMPTY_LABEL = 'No results';

/** Case-insensitive substring match. */
const defaultFilter = (label: string, query: string) =>
  label.toLocaleLowerCase().includes(query.toLocaleLowerCase());

export interface ComboboxProps {
  /** `null` is the controlled "nothing selected" state. */
  value?: string | null;
  defaultValue?: string;
  /** Fires once per accepted selection with the option's `value`, or `null` when the text is cleared. */
  onValueChange?: (value: string | null) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Renders a hidden input so the value takes part in native form submission. */
  name?: string;
  /** Decides whether an option label matches the typed query. Defaults to a case-insensitive substring match. */
  filter?: (label: string, query: string) => boolean;
  /** Fires with the new input text when the user types and when a selection or Escape writes a label. */
  onInputChange?: (query: string) => void;
  children?: ReactNode;
}

export interface ComboboxInputProps extends Omit<TextFieldProps, 'value' | 'defaultValue' | 'onValueChange'> {
  /** Root `name` is the canonical form name; an Input `name` submits an extra text entry. */
  name?: string;
  /** Controlled input text. */
  inputValue?: string;
  /** Initial input text; when set, it filters the options from the first render. */
  defaultInputValue?: string;
}
export interface ComboboxListProps extends HTMLAttributes<HTMLDivElement> {}
export interface ComboboxItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Unique within the combobox. */
  value: string;
  disabled?: boolean;
}
export interface ComboboxEmptyProps extends HTMLAttributes<HTMLDivElement> {}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface OptionRecord {
  index: number;
  label: string;
  disabled: boolean;
}

interface InputLabelling {
  labelledBy?: string;
  label?: string;
}

interface InputHandle {
  commitLabel: (label: string) => void;
}

interface QueryMatches {
  count: number;
  first: number | null;
  last: number | null;
}

interface ComboboxContextValue {
  baseId: string;
  listId: string;
  setListId: Dispatch<SetStateAction<string>>;
  setInputDisabled: Dispatch<SetStateAction<boolean>>;
  open: boolean;
  selectedValue: string | null;
  activeIndex: number | null;
  options: ReadonlyMap<string, OptionRecord>;
  matchCount: number;
  inputLabelling: InputLabelling | null;
  inputHandleRef: MutableRefObject<InputHandle | null>;
  refs: OverlayFloating['refs'];
  floatingStyles: CSSProperties;
  elementsRef: MutableRefObject<Array<HTMLElement | null>>;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  getItemProps: UseInteractionsReturn['getItemProps'];
  onInputChange?: (query: string) => void;
  isVisible: (label: string) => boolean;
  findMatches: (query: string) => QueryMatches;
  setQuery: Dispatch<SetStateAction<string>>;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  selectValue: (value: string) => void;
  selectIndex: (index: number) => void;
  clearValue: () => void;
  requestOpenChange: (open: boolean) => void;
  registerOption: (value: string, record: OptionRecord) => void;
  unregisterOption: (value: string) => void;
  setInputLabelling: (labelling: InputLabelling | null) => void;
}

const ComboboxContext = createContext<ComboboxContextValue | null>(null);
// Set by Combobox.List: items may only render inside it (they register with its FloatingList).
const ComboboxListContext = createContext(false);

function useComboboxContext(part: string): ComboboxContextValue {
  const context = useContext(ComboboxContext);
  if (!context) throw new Error(`Combobox.${part} must be rendered inside <Combobox>.`);
  return context;
}

function useComboboxListContext(part: string): ComboboxContextValue {
  const context = useComboboxContext(part);
  if (!useContext(ComboboxListContext)) throw new Error(`Combobox.${part} must be rendered inside <Combobox.List>.`);
  return context;
}

const optionId = (baseId: string, value: string) => `${baseId}-opt-${encodeURIComponent(value)}-item`;

const isSameOption = (a: OptionRecord | undefined, b: OptionRecord) =>
  a !== undefined && a.index === b.index && a.label === b.label && a.disabled === b.disabled;

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const listStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.overlay,
  padding: vars.space[1],
  minInlineSize: '180px',
  maxInlineSize: 'min(320px, calc(100vw - 32px))',
  maxBlockSize: '280px',
  overflow: 'auto',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  '&[hidden]': {
    display: 'none',
  },
});

const itemStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  inlineSize: '100%',
  minBlockSize: '32px',
  flexShrink: 0,
  borderRadius: vars.radius.sm,
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  fontSize: vars.textSize.sm,
  color: vars.color.text,
  cursor: 'pointer',
  userSelect: 'none',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[hidden]': {
    display: 'none',
  },
  '&:hover:not([aria-disabled="true"]), &[data-active]:not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  // The highlighted option is the virtual focus target: it carries the focus ring.
  '&[data-active]': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '-2px',
  },
  '&[aria-selected="true"]': {
    fontWeight: vars.fontWeight.medium,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const itemTextStyle = css({
  flex: 1,
  minInlineSize: 0,
});

const checkStyle = css({
  color: vars.color.accentText,
});

const emptyStyle = css({
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

function ComboboxRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  name,
  filter = defaultFilter,
  onInputChange,
  children,
}: ComboboxProps) {
  const baseId = useId();
  const [listId, setListId] = useState(`${baseId}-listbox`);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [selectedValue = null, requestValueChange] = useControlledState<string | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange,
  );
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // The text that filters the options: what the user typed, or '' right after a selection.
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ReadonlyMap<string, OptionRecord>>(() => new Map());
  const [inputLabelling, setInputLabelling] = useState<InputLabelling | null>(null);
  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const inputHandleRef = useRef<InputHandle | null>(null);

  const matchesQuery = useCallback(
    (label: string, text: string) => text === '' || filter(label, text),
    [filter],
  );

  const { valuesByIndex, skippedIndices, matchCount } = useMemo(() => {
    const values: Array<string | undefined> = [];
    // Navigation skips disabled options and options hidden by the query.
    const skipped = new Set<number>();
    let count = 0;
    options.forEach((record, optionValue) => {
      if (record.index === -1) return;
      values[record.index] = optionValue;
      const visible = matchesQuery(record.label, query);
      if (visible) count += 1;
      if (record.disabled || !visible) skipped.add(record.index);
    });
    return { valuesByIndex: values, skippedIndices: skipped, matchCount: count };
  }, [options, query, matchesQuery]);

  // Stable so items' registration effects do not re-run when the registry changes.
  const registerOption = useCallback(
    (optionValue: string, record: OptionRecord) =>
      setOptions((prev) =>
        isSameOption(prev.get(optionValue), record) ? prev : new Map(prev).set(optionValue, record),
      ),
    [],
  );
  const unregisterOption = useCallback(
    (optionValue: string) =>
      setOptions((prev) => {
        if (!prev.has(optionValue)) return prev;
        const next = new Map(prev);
        next.delete(optionValue);
        return next;
      }),
    [],
  );

  const { refs, floatingStyles, context } = useOverlayFloating({
    open,
    placement: PLACEMENT,
    onOpenChange: (next) => requestOpenChange(next),
  });

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const listNavigation = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    loop: true,
    disabledIndices: (index) => skippedIndices.has(index),
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([dismiss, listNavigation]);

  const value = useMemo<ComboboxContextValue>(() => {
    const selectValue = (next: string) => {
      // Value, open and input text are independent requests: a controlled parent decides
      // each axis; rejecting the value does not cancel the close or the label commit.
      requestValueChange(next);
      requestOpenChange(false);
      inputHandleRef.current?.commitLabel(options.get(next)?.label ?? '');
    };
    return {
      baseId,
      listId,
      setListId,
      setInputDisabled,
      open,
      selectedValue,
      activeIndex,
      options,
      matchCount,
      inputLabelling,
      inputHandleRef,
      refs,
      floatingStyles,
      elementsRef,
      getReferenceProps,
      getFloatingProps,
      getItemProps,
      onInputChange,
      isVisible: (label) => matchesQuery(label, query),
      findMatches: (text) => {
        let count = 0;
        let first: number | null = null;
        let last: number | null = null;
        options.forEach((record) => {
          if (record.index === -1 || !matchesQuery(record.label, text)) return;
          count += 1;
          if (record.disabled) return;
          if (first === null || record.index < first) first = record.index;
          if (last === null || record.index > last) last = record.index;
        });
        return { count, first, last };
      },
      setQuery,
      setActiveIndex,
      selectValue,
      selectIndex: (index) => {
        const next = valuesByIndex[index];
        if (next === undefined || skippedIndices.has(index)) return;
        selectValue(next);
      },
      clearValue: () => requestValueChange(null),
      requestOpenChange,
      registerOption,
      unregisterOption,
      setInputLabelling,
    };
  }, [
    baseId,
    listId,
    open,
    selectedValue,
    activeIndex,
    options,
    query,
    matchCount,
    inputLabelling,
    refs,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    getItemProps,
    onInputChange,
    matchesQuery,
    valuesByIndex,
    skippedIndices,
    requestValueChange,
    requestOpenChange,
    registerOption,
    unregisterOption,
  ]);

  return (
    <ComboboxContext.Provider value={value}>
      {children}
      {name !== undefined && <input type="hidden" name={name} value={selectedValue ?? ''} disabled={inputDisabled} />}
    </ComboboxContext.Provider>
  );
}

const Input = forwardRef<HTMLInputElement, ComboboxInputProps>(function ComboboxInput(
  {
    inputValue,
    defaultInputValue,
    label,
    description,
    error,
    size,
    slotProps,
    className,
    id: idProp,
    onChange,
    onKeyDown,
    onBlur,
    disabled = false,
    ...rest
  },
  ref,
) {
  const {
    listId,
    open,
    selectedValue,
    activeIndex,
    options,
    inputHandleRef,
    refs,
    getReferenceProps,
    onInputChange,
    findMatches,
    setQuery,
    setActiveIndex,
    selectIndex,
    clearValue,
    requestOpenChange,
    setInputLabelling,
    setInputDisabled,
  } = useComboboxContext('Input');
  // The floating reference is typed for button triggers; any element positions the same.
  const mergedRef = useMergeRefs([refs.setReference as (node: Element | null) => void, ref]);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const labelId = `${id}-label`;
  const hasLabel = isRenderable(label);
  const labelledBy = rest['aria-labelledby'];
  const ariaLabel = rest['aria-label'];

  const [textState, setTextState] = useState(defaultInputValue);
  // True while the text holds the user's own query rather than the selected option's label.
  const [editing, setEditing] = useState(() => (inputValue ?? defaultInputValue) !== undefined);
  const selectedLabel = selectedValue === null ? undefined : options.get(selectedValue)?.label;
  const text = inputValue ?? (editing ? textState ?? '' : selectedLabel ?? textState ?? '');
  // The hook deduplicates against the displayed text, including selected-label formatting.
  const [, requestDisplayedText] = useControlledState<string>(text, undefined, onInputChange);
  const requestText = (next: string) => {
    requestDisplayedText(next);
    if (inputValue === undefined) setTextState(next);
  };
  const query = inputValue !== undefined || editing ? text : '';

  const commitLabel = (nextLabel: string) => {
    setEditing(false);
    requestText(nextLabel);
  };

  // Filtering follows displayed text, never an unaccepted controlled request.
  useLayoutEffect(() => {
    setQuery(query);
  }, [query, setQuery]);

  useLayoutEffect(() => {
    setInputDisabled(disabled);
    return () => setInputDisabled(false);
  }, [disabled, setInputDisabled]);

  // Selections made from the list (pointer) write the label through this handle.
  useLayoutEffect(() => {
    inputHandleRef.current = { commitLabel };
    return () => {
      inputHandleRef.current = null;
    };
  });

  // The listbox reuses the input's label so both share one accessible name.
  useLayoutEffect(() => {
    setInputLabelling(
      labelledBy !== undefined || !hasLabel ? { labelledBy, label: ariaLabel } : { labelledBy: labelId },
    );
    return () => setInputLabelling(null);
  }, [labelledBy, ariaLabel, hasLabel, labelId, setInputLabelling]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    const next = event.currentTarget.value;
    setEditing(true);
    requestText(next);
    if (next === '') clearValue();
    const displayedText = inputValue ?? next;
    if (displayedText === '') {
      setActiveIndex(null);
      requestOpenChange(false);
      return;
    }
    const matches = findMatches(displayedText);
    setActiveIndex(matches.first);
    if (matches.count > 0) requestOpenChange(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      if (editing && selectedLabel !== undefined) commitLabel(selectedLabel);
      return;
    }
    if (!open) return;
    if (event.key === 'Enter' && activeIndex !== null) {
      // Keeps Enter from submitting the form while it picks an option.
      event.preventDefault();
      selectIndex(activeIndex);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      const matches = findMatches(query);
      const edge = event.key === 'Home' ? matches.first : matches.last;
      if (edge === null) return;
      event.preventDefault();
      setActiveIndex(edge);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
    if (open) requestOpenChange(false);
  };

  return (
    <TextField
      {...getReferenceProps({ ...rest, onKeyDown: handleKeyDown, onBlur: handleBlur })}
      ref={mergedRef}
      id={id}
      label={hasLabel ? <span id={labelId}>{label}</span> : label}
      description={description}
      error={error}
      size={size}
      slotProps={slotProps}
      className={className}
      value={text}
      disabled={disabled}
      onChange={handleChange}
      role="combobox"
      autoComplete="off"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      data-state={open ? 'open' : 'closed'}
      data-ui="combobox-input"
    />
  );
});

const List = forwardRef<HTMLDivElement, ComboboxListProps>(function ComboboxList(
  { id: idProp, style, onMouseDown, children, ...rest },
  ref,
) {
  const { baseId, setListId, open, inputLabelling, refs, floatingStyles, elementsRef, getFloatingProps } =
    useComboboxContext('List');
  const listId = idProp ?? `${baseId}-listbox`;
  useLayoutEffect(() => {
    setListId(listId);
    return () => setListId(`${baseId}-listbox`);
  }, [baseId, listId, setListId]);
  // Only an open listbox is the floating element, so a closed one does no positioning work.
  const mergedRef = useMergeRefs([open ? refs.setFloating : null, ref]);

  const labelling =
    rest['aria-labelledby'] !== undefined || rest['aria-label'] !== undefined
      ? {}
      : inputLabelling?.labelledBy !== undefined
        ? { 'aria-labelledby': inputLabelling.labelledBy }
        : { 'aria-label': inputLabelling?.label };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    // Keeps DOM focus on the input: the highlighted option is virtual.
    event.preventDefault();
  };

  return (
    <FloatingPortal>
      <div
        {...getFloatingProps({ id: listId, ...labelling, ...rest, onMouseDown: handleMouseDown })}
        ref={mergedRef}
        role="listbox"
        hidden={!open}
        data-state={open ? 'open' : 'closed'}
        data-ui="combobox-list"
        style={{ ...style, ...floatingStyles }}
        css={listStyle}
      >
        <FloatingList elementsRef={elementsRef}>
          <ComboboxListContext.Provider value>{children}</ComboboxListContext.Provider>
        </FloatingList>
      </div>
    </FloatingPortal>
  );
});

const Item = forwardRef<HTMLDivElement, ComboboxItemProps>(function ComboboxItem(
  { value, disabled = false, onClick, children, ...rest },
  ref,
) {
  const {
    baseId,
    selectedValue,
    activeIndex,
    options,
    isVisible,
    getItemProps,
    selectValue,
    registerOption,
    unregisterOption,
  } = useComboboxListContext('Item');
  const { ref: listItemRef, index } = useListItem();
  const mergedRef = useMergeRefs([listItemRef, ref]);
  const textRef = useRef<HTMLSpanElement>(null);
  const label = options.get(value)?.label;
  const hidden = label !== undefined && !isVisible(label);
  const isActive = index !== -1 && activeIndex === index;
  const isSelected = selectedValue === value;

  // Every commit: keep the label (read from the rendered text) and index current. Layout
  // effect so the input and list navigation see them before paint. Registration is a no-op
  // when nothing changed.
  useLayoutEffect(() => {
    registerOption(value, { index, label: textRef.current?.textContent ?? '', disabled });
  });

  useLayoutEffect(() => () => unregisterOption(value), [value, unregisterOption]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (disabled || event.defaultPrevented) return;
    selectValue(value);
  };

  return (
    <div
      {...getItemProps({ id: optionId(baseId, value), ...rest, onClick: handleClick })}
      ref={mergedRef}
      role="option"
      hidden={hidden}
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      data-active={isActive || undefined}
      data-ui="combobox-item"
      css={itemStyle}
    >
      <span ref={textRef} css={itemTextStyle}>
        {children}
      </span>
      {isSelected && (
        <span aria-hidden="true" css={checkStyle}>
          {SELECTED_GLYPH}
        </span>
      )}
    </div>
  );
});

const Empty = forwardRef<HTMLDivElement, ComboboxEmptyProps>(function ComboboxEmpty({ children, ...rest }, ref) {
  const { matchCount } = useComboboxListContext('Empty');
  if (matchCount > 0) return null;
  return (
    <div {...rest} ref={ref} data-ui="combobox-empty" css={emptyStyle}>
      {isRenderable(children) ? children : DEFAULT_EMPTY_LABEL}
    </div>
  );
});

export const Combobox = Object.assign(ComboboxRoot, { Input, List, Item, Empty });
