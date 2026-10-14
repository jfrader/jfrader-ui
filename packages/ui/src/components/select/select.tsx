// APG pattern: select-only combobox. The trigger is a <button role="combobox"> with
// aria-haspopup="listbox", aria-expanded and (while open) aria-controls; the popup is a
// role="listbox" of role="option" items.
// Virtual focus: DOM focus never leaves the trigger. The active option is exposed through
// aria-activedescendant (useListNavigation with `virtual: true`), so there is no focus manager.
// Keyboard map, closed: Enter/Space/ArrowDown open on the selected option (first enabled when
// nothing is selected); ArrowUp opens on the selected option (last enabled when nothing is
// selected); printable characters open on the next prefix-matching enabled option without
// changing the value. Select owns the 500ms buffer, which persists across opening.
// Keyboard map, open: ArrowDown/ArrowUp move and wrap, skipping disabled options; Home/End jump;
// printable characters extend that same case-insensitive prefix buffer; Enter/Space select
// the active option and close; Escape closes without selecting; Tab closes without selecting
// and lets focus move on.
// Pointer: clicking an option selects it and closes; disabled options stay listed with
// aria-disabled="true" and ignore clicks. Pressing inside the listbox never takes focus from
// the trigger.
// The listbox stays mounted (hidden) while closed so Select.Value and closed-state typeahead
// can read option labels; it is only positioned while open.
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
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  FloatingList,
  useClick,
  useDismiss,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  type Placement,
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
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import {
  collectionItemId,
  useCollectionItem,
  useCollectionRegistry,
  type CollectionRegistration,
} from '../../utils/collection-registry';
import { useControlledState } from '../../utils/use-controlled-state';
import { useFormReset } from '../../utils/use-form-reset';

const TYPEAHEAD_RESET_MS = 500;
const TYPEAHEAD_COLLATOR = new Intl.Collator(undefined, { usage: 'search', sensitivity: 'base' });
const SELECTED_GLYPH = '✓';

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  /** Fires once per accepted selection with the option's `value`. */
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  disabled?: boolean;
  /** Adds a hidden input to submit the value with a native form. */
  name?: string;
  children?: ReactNode;
}

export interface SelectTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {
  id?: string;
}
export interface SelectValueProps extends ComponentPropsWithRef<'span'>, SxProps {
  /** Shown when no option matches the selected value. */
  placeholder?: ReactNode;
}
export interface SelectContentProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface SelectItemProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Unique within the select. */
  value: string;
  disabled?: boolean;
}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface OptionRecord {
  index: number;
  label: string;
  disabled: boolean;
}

interface TriggerLabelling {
  id: string;
  labelledBy?: string;
  label?: string;
}

interface SelectContextValue {
  baseId: string;
  open: boolean;
  disabled: boolean;
  selectedValue: string | undefined;
  activeIndex: number | null;
  options: ReadonlyMap<string, OptionRecord>;
  triggerLabelling: TriggerLabelling | null;
  refs: OverlayFloating['refs'];
  floatingStyles: CSSProperties;
  elementsRef: MutableRefObject<Array<HTMLElement | null>>;
  labelsRef: MutableRefObject<Array<string | null>>;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  getItemProps: UseInteractionsReturn['getItemProps'];
  selectValue: (value: string) => void;
  resetValue: () => void;
  selectIndex: (index: number) => void;
  matchTypeahead: (search: string) => void;
  requestOpenChange: (open: boolean) => void;
  registration: CollectionRegistration<OptionRecord>;
  setTriggerLabelling: (labelling: TriggerLabelling | null) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);
// Set by Select.Content: items may only render inside it (they register with its FloatingList).
const SelectContentContext = createContext(false);

function useSelectContext(part: string): SelectContextValue {
  const context = useContext(SelectContext);
  if (!context) throw new Error(`Select.${part} must be rendered inside <Select>.`);
  return context;
}

function useSelectItemContext(): SelectContextValue {
  const context = useSelectContext('Item');
  if (!useContext(SelectContentContext)) throw new Error('Select.Item must be rendered inside <Select.Content>.');
  return context;
}

const selectTriggerStyle = css({
  justifyContent: 'flex-start',
  minInlineSize: '180px',
  maxInlineSize: '100%',
  '&[aria-expanded="true"]': {
    backgroundColor: vars.color.surfaceHover,
  },
});

const valueStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '&[data-placeholder]': {
    color: vars.color.textMuted,
  },
});

function SelectOverlay({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  disabled = false,
  name,
  children,
}: SelectProps) {
  const baseId = useId();
  const [selectedValue, requestValueChange, resetValue] = useControlledState<string>(valueProp, defaultValue, onValueChange);
  const [openState = false, requestOpen] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const open = openState && !disabled;
  const requestOpenChange = useCallback((next: boolean) => {
    if (next && disabled) return;
    requestOpen(next);
  }, [disabled, requestOpen]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Typeahead on the closed trigger opens on the match, not on the selected option.
  const [openedByTypeahead, setOpenedByTypeahead] = useState(false);
  const [options, registration] = useCollectionRegistry<OptionRecord>();
  const [triggerLabelling, setTriggerLabelling] = useState<TriggerLabelling | null>(null);
  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const labelsRef = useRef<Array<string | null>>([]);
  const virtualItemRef = useRef<HTMLElement | null>(null);

  // Closed (including a rejected typeahead open): drop the pending typeahead navigation.
  if (!open && openedByTypeahead) {
    setOpenedByTypeahead(false);
    setActiveIndex(null);
  }

  const { valuesByIndex, disabledIndices } = useMemo(() => {
    const values: Array<string | undefined> = [];
    const disabledSet = new Set<number>();
    options.forEach((record, value) => {
      if (record.index === -1) return;
      values[record.index] = value;
      if (record.disabled) disabledSet.add(record.index);
    });
    return { valuesByIndex: values, disabledIndices: disabledSet };
  }, [options]);

  const selectedRecord = selectedValue === undefined ? undefined : options.get(selectedValue);
  const selectedIndex = selectedRecord && selectedRecord.index !== -1 ? selectedRecord.index : null;

  const { refs, floatingStyles, context } = useOverlayFloating({
    open,
    placement,
    onOpenChange: (next) => requestOpenChange(next),
  });

  const click = useClick(context, { enabled: !disabled });
  const role = useRole(context, { role: 'listbox' });
  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const listNavigation = useListNavigation(context, {
    enabled: !disabled,
    listRef: elementsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    virtualItemRef,
    loop: true,
    // Pointer opens also highlight the selected option (or the first enabled one).
    focusItemOnOpen: true,
    selectedIndex: openedByTypeahead ? null : selectedIndex,
    disabledIndices: (index) => disabledIndices.has(index),
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    role,
    dismiss,
    listNavigation,
  ]);

  const value = useMemo<SelectContextValue>(() => {
    const selectValue = (next: string) => {
      if (disabled) return;
      // Value and open are independent requests: selection closes an uncontrolled list.
      // A controlled parent decides each axis; rejecting the value does not cancel the close.
      requestValueChange(next);
      requestOpenChange(false);
    };
    return {
      baseId,
      open,
      disabled,
      selectedValue,
      activeIndex: disabled ? null : activeIndex,
      options,
      triggerLabelling,
      refs,
      floatingStyles,
      elementsRef,
      labelsRef,
      getReferenceProps,
      getFloatingProps,
      getItemProps,
      selectValue,
      resetValue,
      matchTypeahead: (search) => {
        if (disabled) return;
        const labels = labelsRef.current;
        const start = activeIndex ?? -1;
        for (let offset = 1; offset <= labels.length; offset += 1) {
          const index = (start + offset) % labels.length;
          const label = labels[index];
          if (label === null || label === undefined || disabledIndices.has(index)) continue;
          if (TYPEAHEAD_COLLATOR.compare(label.slice(0, search.length), search) !== 0) continue;
          setActiveIndex(index);
          if (!open) {
            setOpenedByTypeahead(true);
            requestOpenChange(true);
          }
          return;
        }
      },
      selectIndex: (index) => {
        const next = valuesByIndex[index];
        if (next === undefined || disabledIndices.has(index)) return;
        selectValue(next);
      },
      requestOpenChange,
      registration,
      setTriggerLabelling,
    };
  }, [
    baseId,
    open,
    disabled,
    selectedValue,
    activeIndex,
    options,
    triggerLabelling,
    refs,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    getItemProps,
    valuesByIndex,
    disabledIndices,
    requestValueChange,
    resetValue,
    requestOpenChange,
    registration,
  ]);

  return (
    <SelectContext.Provider value={value}>
      {children}
      {name !== undefined && <input type="hidden" name={name} value={selectedValue ?? ''} disabled={disabled} />}
    </SelectContext.Provider>
  );
}

function SelectRoot(props: SelectProps) {
  return (
    <IsolatedOverlay>
      <SelectOverlay {...props} />
    </IsolatedOverlay>
  );
}

SelectRoot.displayName = 'Select';

function SelectTrigger({
  ref,
  id: idProp,
  disabled: disabledProp,
  onKeyDown,
  className,
  sx,
  ...rest
}: SelectTriggerProps) {
  const {
    baseId,
    open,
    disabled,
    activeIndex,
    refs,
    getReferenceProps,
    selectIndex,
    resetValue,
    matchTypeahead,
    requestOpenChange,
    setTriggerLabelling,
  } = useSelectContext('Trigger');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMergeRefs([triggerRef, refs.setReference, ref]);
  useFormReset(triggerRef, resetValue, rest.form);
  const typeaheadRef = useRef({ search: '', lastKeyAt: 0 });
  const id = idProp ?? `${baseId}-trigger`;
  const labelledBy = rest['aria-labelledby'];
  const label = rest['aria-label'];

  // The listbox reuses the trigger's label so both share one accessible name.
  useLayoutEffect(() => {
    setTriggerLabelling({ id, labelledBy, label });
    return () => setTriggerLabelling(null);
  }, [id, labelledBy, label, setTriggerLabelling]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || disabledProp) return;
    if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const now = performance.now();
      const previous = typeaheadRef.current;
      const search = (now - previous.lastKeyAt > TYPEAHEAD_RESET_MS ? '' : previous.search) + event.key;
      typeaheadRef.current = { search, lastKeyAt: now };
      matchTypeahead(search);
      return;
    }
    if (!open) return;
    if (event.key === 'Tab') {
      requestOpenChange(false);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && activeIndex !== null) {
      // Prevents the native button click, which would toggle the listbox again.
      event.preventDefault();
      selectIndex(activeIndex);
    }
  };

  return (
    <WithSx className={className} styles={[triggerStyle, selectTriggerStyle]} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...getReferenceProps({ ...rest, id, disabled: disabled || disabledProp, onKeyDown: handleKeyDown })}
          ref={mergedRef}
          data-state={open ? 'open' : 'closed'}
          data-ui="select-trigger"
          className={className}
        />
      )}
    </WithSx>
  );
}

SelectTrigger.displayName = 'Select.Trigger';

function SelectValue({ ref, placeholder, className, sx, ...rest }: SelectValueProps) {
  const { selectedValue, options } = useSelectContext('Value');
  const label = selectedValue === undefined ? undefined : options.get(selectedValue)?.label;
  const isPlaceholder = label === undefined;

  return (
    <WithSx className={className} styles={valueStyle} sx={sx}>
      {(className) => (
        <span
          {...rest}
          ref={ref}
          data-placeholder={isPlaceholder || undefined}
          data-ui="select-value"
          className={className}
        >
          {isPlaceholder ? placeholder : label}
        </span>
      )}
    </WithSx>
  );
}

SelectValue.displayName = 'Select.Value';

function SelectContent({ ref, style, onMouseDown, children, className, sx, ...rest }: SelectContentProps) {
  const { open, triggerLabelling, refs, floatingStyles, elementsRef, getFloatingProps } = useSelectContext('Content');
  // Only an open listbox is the floating element, so a closed one does no positioning work.
  const mergedRef = useMergeRefs([open ? refs.setFloating : null, ref]);

  const labelling =
    rest['aria-labelledby'] !== undefined || rest['aria-label'] !== undefined
      ? {}
      : triggerLabelling?.labelledBy !== undefined
        ? { 'aria-labelledby': triggerLabelling.labelledBy }
        : triggerLabelling?.label !== undefined
          ? { 'aria-label': triggerLabelling.label }
          : { 'aria-labelledby': triggerLabelling?.id };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    // Keeps DOM focus on the trigger: the active option is virtual.
    event.preventDefault();
  };

  return (
    <OverlayPortal>
      <WithSx className={className} styles={[listboxSurfaceStyle, listboxScrollStyle]} sx={sx}>
        {(className) => (
          <div
            {...getFloatingProps({ ...labelling, ...rest, onMouseDown: handleMouseDown })}
            ref={mergedRef}
            hidden={!open}
            data-state={open ? 'open' : 'closed'}
            data-ui="select-listbox"
            style={{ ...style, ...floatingStyles }}
            className={className}
          >
            <FloatingList elementsRef={elementsRef}>
              <SelectContentContext.Provider value>{children}</SelectContentContext.Provider>
            </FloatingList>
          </div>
        )}
      </WithSx>
    </OverlayPortal>
  );
}

SelectContent.displayName = 'Select.Content';

function SelectItem({ ref, value, disabled = false, onClick, children, className, sx, ...rest }: SelectItemProps) {
  const { baseId, selectedValue, activeIndex, labelsRef, getItemProps, selectValue, registration } =
    useSelectItemContext();
  const textRef = useRef<HTMLSpanElement>(null);
  // Disabled options stay out of typeahead.
  const { ref: listItemRef, index } = useCollectionItem(
    value,
    registration,
    textRef,
    (itemIndex, label) => ({ index: itemIndex, label, disabled }),
    { labelsRef, include: !disabled },
  );
  const mergedRef = useMergeRefs([listItemRef, ref]);
  const isActive = index !== -1 && activeIndex === index;
  const isSelected = selectedValue === value;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (disabled || event.defaultPrevented) return;
    selectValue(value);
  };

  return (
    <WithSx className={className} styles={[listboxItemStyle, listboxItemStateStyle, listboxOptionStyle]} sx={sx}>
      {(className) => (
        <div
          {...getItemProps({ id: collectionItemId(baseId, value), ...rest, onClick: handleClick })}
          ref={mergedRef}
          role="option"
          aria-selected={isSelected}
          aria-disabled={disabled || undefined}
          data-active={isActive || undefined}
          data-ui="select-item"
          className={className}
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
      )}
    </WithSx>
  );
}

SelectItem.displayName = 'Select.Item';

export const Select = Object.assign(SelectRoot, {
  Trigger: SelectTrigger,
  Value: SelectValue,
  Content: SelectContent,
  Item: SelectItem,
});
