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
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CSSProperties,
  type Dispatch,
  type FocusEvent,
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
  useListNavigation,
  useMergeRefs,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import {
  listboxItemStateStyle,
  listboxItemStyle,
  listboxOptionCheckStyle,
  listboxOptionStyle,
  listboxOptionTextStyle,
  listboxScrollStyle,
  listboxSurfaceStyle,
} from '../../styling/listbox-style';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import {
  collectionItemId,
  useCollectionItem,
  useCollectionRegistry,
  type CollectionRegistration,
} from '../../utils/collection-registry';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
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
export interface ComboboxListProps extends ComponentPropsWithRef<'div'> {}
export interface ComboboxItemProps extends ComponentPropsWithRef<'div'> {
  /** Unique within the combobox. */
  value: string;
  disabled?: boolean;
}
export interface ComboboxEmptyProps extends ComponentPropsWithRef<'div'> {}

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
  registration: CollectionRegistration<OptionRecord>;
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

const itemStyle = css({
  '&[hidden]': {
    display: 'none',
  },
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
  const [options, registration] = useCollectionRegistry<OptionRecord>();
  const [inputLabelling, setInputLabelling] = useState<InputLabelling | null>(null);
  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const inputHandleRef = useRef<InputHandle | null>(null);
  // A pure event callback: forwarding the latest one keeps an inline handler out of the context deps.
  const handleInputChange = useLatestCallback(onInputChange);

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
      onInputChange: handleInputChange,
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
      registration,
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
    handleInputChange,
    matchesQuery,
    valuesByIndex,
    skippedIndices,
    requestValueChange,
    requestOpenChange,
    registration,
  ]);

  return (
    <ComboboxContext.Provider value={value}>
      {children}
      {name !== undefined && <input type="hidden" name={name} value={selectedValue ?? ''} disabled={inputDisabled} />}
    </ComboboxContext.Provider>
  );
}

ComboboxRoot.displayName = 'Combobox';

function ComboboxInput({
  ref,
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
}: ComboboxInputProps) {
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
}

ComboboxInput.displayName = 'Combobox.Input';

function ComboboxList({ ref, id: idProp, style, onMouseDown, children, ...rest }: ComboboxListProps) {
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
        css={[listboxSurfaceStyle, listboxScrollStyle]}
      >
        <FloatingList elementsRef={elementsRef}>
          <ComboboxListContext.Provider value>{children}</ComboboxListContext.Provider>
        </FloatingList>
      </div>
    </FloatingPortal>
  );
}

ComboboxList.displayName = 'Combobox.List';

function ComboboxItem({ ref, value, disabled = false, onClick, children, ...rest }: ComboboxItemProps) {
  const { baseId, selectedValue, activeIndex, options, isVisible, getItemProps, selectValue, registration } =
    useComboboxListContext('Item');
  const textRef = useRef<HTMLSpanElement>(null);
  const { ref: listItemRef, index } = useCollectionItem(value, registration, textRef, (itemIndex, itemLabel) => ({
    index: itemIndex,
    label: itemLabel,
    disabled,
  }));
  const mergedRef = useMergeRefs([listItemRef, ref]);
  const label = options.get(value)?.label;
  const hidden = label !== undefined && !isVisible(label);
  const isActive = index !== -1 && activeIndex === index;
  const isSelected = selectedValue === value;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (disabled || event.defaultPrevented) return;
    selectValue(value);
  };

  return (
    <div
      {...getItemProps({ id: collectionItemId(baseId, value), ...rest, onClick: handleClick })}
      ref={mergedRef}
      role="option"
      hidden={hidden}
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      data-active={isActive || undefined}
      data-ui="combobox-item"
      css={[listboxItemStyle, listboxItemStateStyle, listboxOptionStyle, itemStyle]}
    >
      <span ref={textRef} css={listboxOptionTextStyle}>
        {children}
      </span>
      {isSelected && (
        <span aria-hidden="true" css={listboxOptionCheckStyle}>
          {SELECTED_GLYPH}
        </span>
      )}
    </div>
  );
}

ComboboxItem.displayName = 'Combobox.Item';

function ComboboxEmpty({ ref, children, ...rest }: ComboboxEmptyProps) {
  const { matchCount } = useComboboxListContext('Empty');
  if (matchCount > 0) return null;
  return (
    <div {...rest} ref={ref} data-ui="combobox-empty" css={emptyStyle}>
      {isRenderable(children) ? children : DEFAULT_EMPTY_LABEL}
    </div>
  );
}

ComboboxEmpty.displayName = 'Combobox.Empty';

export const Combobox = Object.assign(ComboboxRoot, {
  Input: ComboboxInput,
  List: ComboboxList,
  Item: ComboboxItem,
  Empty: ComboboxEmpty,
});
