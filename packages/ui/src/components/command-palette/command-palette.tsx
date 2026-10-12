// APG pattern: combobox (list autocomplete) inside a modal dialog. The Input is a
// role="combobox" text input with aria-autocomplete="list", aria-controls and (while an option
// is active) aria-activedescendant; the List is a role="listbox" of role="option" items,
// optionally inside role="group" sections labelled by their heading.
// Virtual focus: DOM focus stays on the Input. useListNavigation (`virtual: true`) exposes the
// active option through aria-activedescendant.
// Keyboard map: typing filters; ArrowDown/ArrowUp move and wrap; Home/End jump to the first/last
// match (the hook leaves Home/End to typeable comboboxes, so the Input handles them); Enter
// selects the active item and closes; Escape closes.
// Filtering: every Item stays mounted and registers its label (read from its rendered text) and
// keywords; non-matching items and empty groups are `hidden` and skipped by navigation. A query
// change resets the active option to the first match, and a polite live region announces the
// result count.
//
// Dialog lifecycle is shared with Dialog (`overlay/use-native-dialog.ts`): Root owns logical
// `open` and the dismissal path, Content owns native state. Escape on the Input routes through
// `requestClose()` so a consumer `cancel` veto applies; accepted closes return focus natively.
// The Trigger is optional: consumers usually drive `open` themselves (e.g. Cmd+K).
// Motion: same retained exit as Dialog, entering from a slightly smaller scale.
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  FloatingList,
  useFloatingRootContext,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { listboxItemStateStyle, listboxItemStyle } from '../../styling/listbox-style';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import {
  omitNativeOpen,
  useNativeDialog,
  useNativeDialogRoot,
  type NativeDialogController,
} from '../../overlay/use-native-dialog';
import {
  collectionItemId,
  useCollectionItem,
  useCollectionRegistry,
  type CollectionRegistration,
} from '../../utils/collection-registry';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import {
  dialogStyle,
  emptyStyle,
  groupHeadingStyle,
  groupStyle,
  inputStyle,
  itemStyle,
  listStyle,
  panelStyle,
} from './command-palette.styles';

const DEFAULT_LABEL = 'Command palette';
const DEFAULT_EMPTY_MESSAGE = 'No results';
const RESULT_PLURALS = new Intl.PluralRules('en');

const defaultFilter = (text: string, query: string) => text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
const defaultFormatResultCount = (count: number) =>
  `${count} ${RESULT_PLURALS.select(count) === 'one' ? 'result' : 'results'}`;

export interface CommandPaletteProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accessible name of the dialog, input and listbox. */
  label?: string;
  /** Decides whether an item's label (or keywords) matches the query. Case-insensitive substring by default. */
  filter?: (text: string, query: string) => boolean;
  /** Rendered by CommandPalette.Empty when nothing matches. */
  emptyMessage?: ReactNode;
  /** Live region text announced after the query changes. */
  formatResultCount?: (count: number) => string;
  children?: ReactNode;
}

export interface CommandPaletteTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface CommandPaletteContentProps extends Omit<ComponentPropsWithRef<'dialog'>, 'open'>, SxProps {}
export interface CommandPaletteInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'defaultValue' | 'type'>,
    SxProps {}
export interface CommandPaletteListProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface CommandPaletteEmptyProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface CommandPaletteGroupProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  label: ReactNode;
  children?: ReactNode;
}
export interface CommandPaletteItemProps extends Omit<ComponentPropsWithRef<'div'>, 'onSelect'>, SxProps {
  /** Unique within the palette. */
  value: string;
  onSelect?: () => void;
  /** Extra text the filter matches against (synonyms, aliases). */
  keywords?: string;
}

interface ItemRecord {
  index: number;
  label: string;
  disabled: boolean;
  keywords: string | undefined;
  groupId: string | null;
}

interface CommandPaletteContextValue extends NativeDialogController {
  toggleOpen: () => void;
  label: string;
  emptyMessage: ReactNode;
  baseId: string;
  listId: string;
  query: string;
  announcement: string;
  matchCount: number;
  matchedValues: ReadonlySet<string>;
  visibleGroupIds: ReadonlySet<string>;
  activeIndex: number | null;
  elementsRef: MutableRefObject<Array<HTMLElement | null>>;
  setInputElement: (element: HTMLInputElement | null) => void;
  setListElement: (element: HTMLDivElement | null) => void;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  getItemProps: UseInteractionsReturn['getItemProps'];
  changeQuery: (query: string) => void;
  moveToEdge: (edge: 'first' | 'last') => void;
  registration: CollectionRegistration<ItemRecord>;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);
const CommandPaletteGroupContext = createContext<string | null>(null);

function useCommandPaletteContext(part: string): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error(`CommandPalette.${part} must be rendered inside <CommandPalette>.`);
  return context;
}

// React does not render `autofocus` on the client (it calls focus() on mount, while the dialog
// is still closed). The native attribute lets showModal() focus the Input.
const setNativeAutofocus = (element: HTMLInputElement | null) => {
  element?.setAttribute('autofocus', '');
};

function CommandPaletteOverlay({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  label = DEFAULT_LABEL,
  filter = defaultFilter,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  formatResultCount = defaultFormatResultCount,
  children,
}: CommandPaletteProps) {
  const baseId = useId();
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const { dialogElementRef, setDialogElement, setOpen, requestClose, repairToken } = useNativeDialogRoot(
    open,
    requestOpenChange,
  );
  const [query, setQuery] = useState('');
  const [queryChanged, setQueryChanged] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [items, registration] = useCollectionRegistry<ItemRecord>();
  const [inputElement, setInputElement] = useState<HTMLInputElement | null>(null);
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const elementsRef = useRef<Array<HTMLElement | null>>([]);

  // Every opening starts from an empty query.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setQueryChanged(false);
      setActiveIndex(null);
    }
  }

  // Native-aware toggle: a logically open palette whose native dialog diverged reopens (repair).
  const toggleOpen = useCallback(() => {
    setOpen(!(open && dialogElementRef.current?.open));
  }, [open, setOpen, dialogElementRef]);

  const { matchedValues, matchedIndices, visibleGroupIds } = useMemo(() => {
    const values = new Set<string>();
    const indices: number[] = [];
    const groups = new Set<string>();
    items.forEach((record, value) => {
      if (record.index === -1) return;
      const matches =
        query === '' ||
        filter(record.label, query) ||
        (record.keywords !== undefined && filter(record.keywords, query));
      if (!matches) return;
      values.add(value);
      if (!record.disabled) indices.push(record.index);
      if (record.groupId !== null) groups.add(record.groupId);
    });
    indices.sort((a, b) => a - b);
    return { matchedValues: values, matchedIndices: indices, visibleGroupIds: groups };
  }, [items, query, filter]);

  const matchedIndexSet = useMemo(() => new Set(matchedIndices), [matchedIndices]);
  // No explicit highlight (fresh open, new query) or a filtered-out one: the first match is active.
  const resolvedActiveIndex =
    activeIndex !== null && matchedIndexSet.has(activeIndex) ? activeIndex : (matchedIndices[0] ?? null);

  const floatingContext = useFloatingRootContext({
    open,
    onOpenChange: (next) => setOpen(next),
    elements: { reference: inputElement, floating: listElement },
  });
  const listNavigation = useListNavigation(floatingContext, {
    listRef: elementsRef,
    activeIndex: resolvedActiveIndex,
    // Null (pointer leaving the list, closing) keeps the current highlight.
    onNavigate: (index) => {
      if (index !== null) setActiveIndex(index);
    },
    virtual: true,
    loop: true,
    focusItemOnOpen: false,
    disabledIndices: (index) => !matchedIndexSet.has(index),
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([listNavigation]);

  const matchCount = matchedValues.size;
  const announcement = queryChanged ? formatResultCount(matchCount) : '';

  const context = useMemo<CommandPaletteContextValue>(
    () => ({
      open,
      setOpen,
      toggleOpen,
      requestClose,
      repairToken,
      setDialogElement,
      label,
      emptyMessage,
      baseId,
      listId: `${baseId}-list`,
      query,
      announcement,
      matchCount,
      matchedValues,
      visibleGroupIds,
      activeIndex: resolvedActiveIndex,
      elementsRef,
      setInputElement,
      setListElement,
      getReferenceProps,
      getFloatingProps,
      getItemProps,
      changeQuery: (next) => {
        setQuery(next);
        setQueryChanged(true);
        setActiveIndex(null);
      },
      moveToEdge: (edge) => {
        const index = edge === 'first' ? matchedIndices[0] : matchedIndices[matchedIndices.length - 1];
        if (index !== undefined) setActiveIndex(index);
      },
      registration,
    }),
    [
      open,
      setOpen,
      toggleOpen,
      requestClose,
      repairToken,
      setDialogElement,
      label,
      emptyMessage,
      baseId,
      query,
      announcement,
      matchCount,
      matchedValues,
      matchedIndices,
      visibleGroupIds,
      resolvedActiveIndex,
      getReferenceProps,
      getFloatingProps,
      getItemProps,
      registration,
    ],
  );

  return <CommandPaletteContext.Provider value={context}>{children}</CommandPaletteContext.Provider>;
}

function CommandPaletteRoot(props: CommandPaletteProps) {
  return (
    <IsolatedOverlay>
      <CommandPaletteOverlay {...props} />
    </IsolatedOverlay>
  );
}

CommandPaletteRoot.displayName = 'CommandPalette';

function CommandPaletteTrigger({ ref, onClick, className, sx, ...rest }: CommandPaletteTriggerProps) {
  const { open, toggleOpen } = useCommandPaletteContext('Trigger');

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) toggleOpen();
  };

  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...rest}
          ref={ref}
          data-ui="command-palette-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={handleClick}
          className={className}
        />
      )}
    </WithSx>
  );
}

CommandPaletteTrigger.displayName = 'CommandPalette.Trigger';

function CommandPaletteContent({ ref, className, sx, ...props }: CommandPaletteContentProps) {
  const { children, onCancel, onClick, onClose, ...rest } = omitNativeOpen(props);

  const context = useCommandPaletteContext('Content');
  const { label, announcement } = context;
  const dialogProps = useNativeDialog(context, { onCancel, onClick, onClose }, ref, undefined, { retainExit: true });

  return (
    <WithSx className={className} styles={dialogStyle} sx={sx}>
      {(className) => (
        <dialog
          aria-label={label}
          {...rest}
          {...dialogProps}
          data-ui="command-palette"
          aria-modal="true"
          className={className}
        >
          <div css={panelStyle}>
            {children}
            <div role="status" aria-live="polite" aria-atomic="true" css={visuallyHiddenStyle}>
              {announcement}
            </div>
          </div>
        </dialog>
      )}
    </WithSx>
  );
}

CommandPaletteContent.displayName = 'CommandPalette.Content';

function CommandPaletteInput({ ref, onChange, onKeyDown, className, sx, ...rest }: CommandPaletteInputProps) {
  const {
    label,
    listId,
    query,
    matchCount,
    activeIndex,
    elementsRef,
    requestClose,
    setInputElement,
    getReferenceProps,
    changeQuery,
    moveToEdge,
  } = useCommandPaletteContext('Input');
  const mergedRef = useMergeRefs([setInputElement, setNativeAutofocus, ref]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    changeQuery(event.currentTarget.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      // Handled here (not left to the native close request) so it shares the Root's single
      // dismissal path; preventing the keydown stops the browser's own close request.
      event.preventDefault();
      requestClose();
    } else if (
      (event.key === 'Home' || event.key === 'End') &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      moveToEdge(event.key === 'Home' ? 'first' : 'last');
    } else if (event.key === 'Enter' && activeIndex !== null) {
      event.preventDefault();
      // One activation path for pointer and keyboard: the item's click handler selects.
      elementsRef.current[activeIndex]?.click();
    }
  };

  return (
    <WithSx className={className} styles={inputStyle} sx={sx}>
      {(className) => (
        <input
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          {...getReferenceProps({ ...rest, onChange: handleChange, onKeyDown: handleKeyDown })}
          ref={mergedRef}
          type="text"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={matchCount > 0}
          aria-controls={listId}
          data-ui="command-palette-input"
          className={className}
        />
      )}
    </WithSx>
  );
}

CommandPaletteInput.displayName = 'CommandPalette.Input';

function CommandPaletteList({ ref, onMouseDown, children, className, sx, ...rest }: CommandPaletteListProps) {
  const { label, listId, matchCount, elementsRef, setListElement, getFloatingProps } =
    useCommandPaletteContext('List');
  const mergedRef = useMergeRefs([setListElement, ref]);

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    // Keeps DOM focus on the Input: the active option is virtual.
    event.preventDefault();
  };

  return (
    <WithSx className={className} styles={listStyle} sx={sx}>
      {(className) => (
        <div
          aria-label={label}
          {...getFloatingProps({ ...rest, onMouseDown: handleMouseDown })}
          ref={mergedRef}
          id={listId}
          role="listbox"
          hidden={matchCount === 0}
          data-ui="command-palette-list"
          className={className}
        >
          <FloatingList elementsRef={elementsRef}>{children}</FloatingList>
        </div>
      )}
    </WithSx>
  );
}

CommandPaletteList.displayName = 'CommandPalette.List';

function CommandPaletteEmpty({ ref, children, className, sx, ...rest }: CommandPaletteEmptyProps) {
  const { matchCount, emptyMessage } = useCommandPaletteContext('Empty');
  if (matchCount > 0) return null;

  return (
    <WithSx className={className} styles={emptyStyle} sx={sx}>
      {(className) => (
        <div {...rest} ref={ref} data-ui="command-palette-empty" className={className}>
          {isRenderable(children) ? children : emptyMessage}
        </div>
      )}
    </WithSx>
  );
}

CommandPaletteEmpty.displayName = 'CommandPalette.Empty';

function CommandPaletteGroup({
  ref,
  label,
  children,
  'aria-labelledby': externalLabelledBy,
  className,
  sx,
  ...rest
}: CommandPaletteGroupProps) {
  const { visibleGroupIds } = useCommandPaletteContext('Group');
  const groupId = useId();
  const headingId = `${groupId}-heading`;

  return (
    <WithSx className={className} styles={groupStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role="group"
          aria-labelledby={[externalLabelledBy, headingId].filter(Boolean).join(' ')}
          hidden={!visibleGroupIds.has(groupId)}
          data-ui="command-palette-group"
          className={className}
        >
          <div id={headingId} css={groupHeadingStyle}>
            {label}
          </div>
          <CommandPaletteGroupContext.Provider value={groupId}>{children}</CommandPaletteGroupContext.Provider>
        </div>
      )}
    </WithSx>
  );
}

CommandPaletteGroup.displayName = 'CommandPalette.Group';

function CommandPaletteItem({
  ref,
  value,
  onSelect,
  keywords,
  'aria-disabled': ariaDisabled,
  onClick,
  children,
  className,
  sx,
  ...rest
}: CommandPaletteItemProps) {
  const { baseId, activeIndex, matchedValues, getItemProps, setOpen, registration } =
    useCommandPaletteContext('Item');
  const groupId = useContext(CommandPaletteGroupContext);
  const disabled = ariaDisabled === true || ariaDisabled === 'true';
  const elementRef = useRef<HTMLDivElement | null>(null);
  const { ref: listItemRef, index } = useCollectionItem(value, registration, elementRef, (itemIndex, label) => ({
    index: itemIndex,
    label,
    disabled,
    keywords,
    groupId,
  }));
  const mergedRef = useMergeRefs([listItemRef, elementRef, ref]);
  const isActive = index !== -1 && activeIndex === index;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    onSelect?.();
    setOpen(false);
  };

  return (
    <WithSx className={className} styles={[listboxItemStyle, listboxItemStateStyle, itemStyle]} sx={sx}>
      {(className) => (
        <div
          {...getItemProps({ id: collectionItemId(baseId, value), ...rest, onClick: handleClick })}
          ref={mergedRef}
          role="option"
          aria-disabled={ariaDisabled}
          aria-selected={isActive}
          hidden={!matchedValues.has(value)}
          data-active={isActive || undefined}
          data-ui="command-palette-item"
          className={className}
        >
          {children}
        </div>
      )}
    </WithSx>
  );
}

CommandPaletteItem.displayName = 'CommandPalette.Item';

export const CommandPalette = Object.assign(CommandPaletteRoot, {
  Trigger: CommandPaletteTrigger,
  Content: CommandPaletteContent,
  Input: CommandPaletteInput,
  List: CommandPaletteList,
  Empty: CommandPaletteEmpty,
  Group: CommandPaletteGroup,
  Item: CommandPaletteItem,
});
