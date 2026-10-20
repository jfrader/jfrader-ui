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
  type ComponentType,
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
import { type Theme } from '../../styling/css';
import { listboxItemStateStyle, listboxItemStyle } from '../../styling/listbox-style';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { styledDialogTransition } from '../../overlay/exit-motion';
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

declare const process: { env: { NODE_ENV?: string } };
const DEFAULT_LABEL = 'Command palette';
const DEFAULT_EMPTY_MESSAGE = 'No results';
const RESULT_PLURALS = new Intl.PluralRules('en');

const defaultFilter = (text: string, query: string) => text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
const defaultFormatResultCount = (count: number) =>
  `${count} ${RESULT_PLURALS.select(count) === 'one' ? 'result' : 'results'}`;

export interface CommandPaletteItemRecord {
  /** Unique within the palette. */
  value: string;
  /** Display label for the item. */
  label: ReactNode;
  /** Extra text the filter matches against (synonyms, aliases). */
  keywords?: string;
  /** Disables the item. */
  disabled?: boolean;
  /** Group name this item belongs to. */
  group?: string;
  /** Called when this specific item is activated. */
  onSelect?: () => void;
}

export interface CommandPaletteSlots {
  /** Replaces the root wrapper element; renders a `div` by default. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the button that opens the command palette. */
  trigger?: ComponentType<CommandPaletteTriggerProps>;
  /** Replaces the dialog surface that contains the input and list. */
  content?: ComponentType<CommandPaletteContentProps>;
  /** Replaces the search text input element. */
  input?: ComponentType<CommandPaletteInputProps>;
  /** Replaces the listbox container for search result items. */
  list?: ComponentType<CommandPaletteListProps>;
  /** Replaces the group container for categorized items. */
  group?: ComponentType<CommandPaletteGroupProps>;
  /** Replaces each selectable command option in the list. */
  item?: ComponentType<CommandPaletteItemProps>;
  /** Replaces the message container shown when no items match. */
  empty?: ComponentType<CommandPaletteEmptyProps>;
}

type GeneratedPartProps<Props> = Partial<Props> & { [attribute: `data-${string}`]: unknown };

export interface CommandPaletteSlotProps {
  /** Root wrapper element around the trigger and dialog. */
  root?: ComponentPropsWithRef<'div'> &
    SxProps & {

      [attribute: `data-${string}`]: unknown;
    };
  /** Button that opens the command palette. */
  trigger?: GeneratedPartProps<CommandPaletteTriggerProps>;
  /** Dialog surface that contains the input and list. */
  content?: GeneratedPartProps<CommandPaletteContentProps>;
  /** Search text input element. */
  input?: GeneratedPartProps<CommandPaletteInputProps>;
  /** Listbox container for search result items. */
  list?: GeneratedPartProps<CommandPaletteListProps>;
  /** Group container for categorized items. */
  group?: GeneratedPartProps<Omit<CommandPaletteGroupProps, 'label' | 'children'>>;
  /** Each selectable command option in the list. */
  item?: GeneratedPartProps<Omit<CommandPaletteItemProps, 'value' | 'id' | 'children' | 'keywords' | 'disabled' | 'onSelect'>>;
  /** Message container shown when no items match. */
  empty?: GeneratedPartProps<CommandPaletteEmptyProps>;
}

export interface CommandPaletteBaseProps {
  /** Control whether the command dialog is open. */
  open?: boolean;
  /** Open the uncontrolled dialog initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receive requests to open or close the dialog. */
  onOpenChange?: (open: boolean) => void;
  /** Accessible name of the dialog, input and listbox. */
  label?: string;
  /** Matches an item's label or keywords to the query. Defaults to a case-insensitive substring match. */
  filter?: (text: string, query: string) => boolean;
  /** Rendered by CommandPalette.Empty when nothing matches. */
  emptyMessage?: ReactNode;
  /** Live region text announced after the query changes. */
  formatResultCount?: (count: number) => string;
}

export interface CommandPaletteCompoundProps extends CommandPaletteBaseProps {
  /** Compose the palette trigger, dialog and command list. */
  children?: ReactNode;
  items?: never;
  triggerLabel?: never;
  placeholder?: never;
  empty?: never;
  onSelect?: never;
  slots?: never;
  slotProps?: never;
  component?: never;
  className?: never;
  sx?: never;
  style?: never;
}

export interface CommandPaletteEasyProps<T extends CommandPaletteItemRecord = CommandPaletteItemRecord>
  extends CommandPaletteBaseProps,
    Omit<ComponentPropsWithRef<'div'>, keyof CommandPaletteBaseProps | 'children' | 'onSelect'>,
    SxProps {

  [attribute: `data-${string}`]: unknown;
  /** Items to search and run. */
  items: readonly T[];
  /** Called when an item is selected. */
  onSelect?: (item: T) => void;
  /** Name the trigger button that opens the palette. When omitted, no trigger is rendered. */
  triggerLabel?: ReactNode;
  /** Placeholder text for the command input. */
  placeholder?: string;
  /** Content to display when no commands match. Defaults to `emptyMessage` or 'No results'. */
  empty?: ReactNode;
  children?: never;
  /** Replace the root container. Exactly sugar for `slots.root`. */
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replace the generated wrapper, trigger or dialog parts. */
  slots?: CommandPaletteSlots;
  /** Pass props and `sx` to the generated palette parts. */
  slotProps?: CommandPaletteSlotProps;
}

export type CommandPaletteProps<T extends CommandPaletteItemRecord = CommandPaletteItemRecord> =
  | CommandPaletteCompoundProps
  | CommandPaletteEasyProps<T>;

export interface CommandPaletteTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface CommandPaletteContentProps extends Omit<ComponentPropsWithRef<'dialog'>, 'open'>, SxProps {}
export interface CommandPaletteInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'defaultValue' | 'type'>,
    SxProps {}
export interface CommandPaletteListProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface CommandPaletteEmptyProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface CommandPaletteGroupProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Name the group and show its heading above the commands. */
  label: ReactNode;
  /** Render the commands belonging to this group. */
  children?: ReactNode;
}
export interface CommandPaletteItemProps extends Omit<ComponentPropsWithRef<'div'>, 'onSelect'>, SxProps {
  /** Unique within the palette. */
  value: string;
  /** Run when this command is activated; the palette then closes. */
  onSelect?: () => void;
  /** Extra text the filter matches against (synonyms, aliases). */
  keywords?: string;
  /** Disables the item. */
  disabled?: boolean;
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

const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

function CommandPaletteOverlay<T extends CommandPaletteItemRecord = CommandPaletteItemRecord>(
  props: CommandPaletteProps<T>,
) {
  const {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    label = DEFAULT_LABEL,
    filter = defaultFilter,
    emptyMessage = DEFAULT_EMPTY_MESSAGE,
    formatResultCount = defaultFormatResultCount,
    children,
  } = props;
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

  let renderedContent: ReactNode = children;
  if ('items' in props && props.items !== undefined) {
    const {
      items,
      onSelect,
      triggerLabel,
      placeholder,
      empty,
      slots,
      slotProps,
      component,
      className,
      sx,
      style,
      open: _open,
      defaultOpen: _defaultOpen,
      onOpenChange: _onOpenChange,
      label: _label,
      filter: _filter,
      emptyMessage: _emptyMessage,
      formatResultCount: _formatResultCount,
      children: _children,
      ...hostRest
    } = props;

    if (process.env.NODE_ENV !== 'production') {
      if (component && slots?.root && component !== slots.root) {
        console.warn('CommandPalette: component is redundant when slots.root is supplied; slots.root wins.');
      }
    }

    const TriggerPart = slots?.trigger ?? CommandPaletteTrigger;
    const ContentPart = slots?.content ?? CommandPaletteContent;
    const InputPart = slots?.input ?? CommandPaletteInput;
    const ListPart = slots?.list ?? CommandPaletteList;
    const GroupPart = slots?.group ?? CommandPaletteGroup;
    const ItemPart = slots?.item ?? CommandPaletteItem;
    const EmptyPart = slots?.empty ?? CommandPaletteEmpty;
    const RootPart = slots?.root ?? component ?? 'div';

    const rootSlot = slotProps?.root;
    const {
      className: rootSlotClassName,
      sx: rootSlotSx,
      style: rootSlotStyle,
      'data-ui': rootSlotDataUi,
      ...rootSlotRest
    } = rootSlot ?? {};

    const sections: Array<{ group?: string; items: T[] }> = [];
    const groupMap = new Map<string, { group?: string; items: T[] }>();
    let currentUngrouped: { group?: string; items: T[] } | null = null;

    for (const item of items) {
      if (item.group !== undefined) {
        currentUngrouped = null;
        let entry = groupMap.get(item.group);
        if (!entry) {
          entry = { group: item.group, items: [] };
          groupMap.set(item.group, entry);
          sections.push(entry);
        }
        entry.items.push(item);
      } else {
        if (!currentUngrouped) {
          currentUngrouped = { items: [] };
          sections.push(currentUngrouped);
        }
        currentUngrouped.items.push(item);
      }
    }

    const renderItem = (item: T) => (
      <ItemPart key={item.value} {...slotProps?.item} value={item.value}
        keywords={item.keywords} disabled={item.disabled}
        onSelect={() => {
          item.onSelect?.();
          onSelect?.(item);
        }}>
        {item.label}
      </ItemPart>
    );
    const renderedList = sections.map((section) =>
      section.group !== undefined ? (
        <GroupPart key={section.group} label={section.group} {...slotProps?.group}>
          {section.items.map(renderItem)}
        </GroupPart>
      ) : (
        section.items.map(renderItem)
      ),
    );

    const rendered = (
      <>
        {isRenderable(triggerLabel) && (
          <TriggerPart {...slotProps?.trigger}>{triggerLabel}</TriggerPart>
        )}
        <ContentPart {...slotProps?.content}>
          <InputPart placeholder={placeholder} {...slotProps?.input} />
          <ListPart {...slotProps?.list}>{renderedList}</ListPart>
          <EmptyPart {...slotProps?.empty}>{empty ?? emptyMessage}</EmptyPart>
        </ContentPart>
      </>
    );

    renderedContent = (
      <WithSx styles={[rootSlotSx]} className={rootSlotClassName}>
        {(slotClasses) => (
          <WithSx className={className} sx={sx}>
            {(consumerClasses) => (
              <WithSx styles={[]} className={[slotClasses, consumerClasses].filter(Boolean).join(' ')}>
                {(classes) => (
                  <RootPart
                    {...hostRest}
                    {...rootSlotRest}
                    className={classes}
                    style={{ ...style, ...rootSlotStyle }}
                    data-ui={tokens('command-palette', hostRest['data-ui'], rootSlotDataUi)}
                  >
                    {rendered}
                  </RootPart>
                )}
              </WithSx>
            )}
          </WithSx>
        )}
      </WithSx>
    );
  }

  return <CommandPaletteContext.Provider value={context}>{renderedContent}</CommandPaletteContext.Provider>;
}

function CommandPaletteRoot<T extends CommandPaletteItemRecord = CommandPaletteItemRecord>(
  props: CommandPaletteProps<T>,
) {
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
  const dialogProps = useNativeDialog(context, { onCancel, onClick, onClose }, ref, undefined, styledDialogTransition);

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

/** Group matching commands under a visible heading. */
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
  disabled: disabledProp,
  onClick,
  children,
  className,
  sx,
  ...rest
}: CommandPaletteItemProps) {
  const { baseId, activeIndex, matchedValues, getItemProps, setOpen, registration } =
    useCommandPaletteContext('Item');
  const groupId = useContext(CommandPaletteGroupContext);
  const disabled = disabledProp === true || ariaDisabled === true || ariaDisabled === 'true';
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
          aria-disabled={disabled ? 'true' : undefined}
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
