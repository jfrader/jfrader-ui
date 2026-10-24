'use client';
import { dateTimeFormatter, numberFormatter } from '../../utils/intl';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { touchTargetStyle } from '../../styling/touch-target';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Spinner } from '../spinner';

export type SortDirection = 'asc' | 'desc';
export interface SortState<Id extends string = string> {
  /** Column being sorted. */
  columnId: Id;
  /** Sort direction for the column. */
  direction: SortDirection;
}
export type DataColumnAlign = 'start' | 'center' | 'end';
export type DataTableDensity = 'compact' | 'standard' | 'comfortable';
export type DataTableSelectionMode = 'none' | 'single' | 'multiple';
export interface DataColumn<T, Id extends string = string> {
  /** Identifies the column in sort state; must be unique among columns. */
  id: Id;
  /** Renders the column heading. */
  header: ReactNode;
  /** Reads the value used for default formatting and client sorting. */
  accessor?: (row: T) => string | number | Date | null | undefined;
  /** Renders the cell instead of the formatted `accessor` value. */
  cell?: (row: T) => ReactNode;
  /** Turns sorting off when `false`. Columns sort when they have an `accessor` or `compare`. */
  sortable?: boolean;
  /** Names the column in sort labels and announcements. Required when `header` is not a string. */
  sortLabel?: string;
  /** Orders two rows ascending; replaces the `accessor` comparison. */
  compare?: (a: T, b: T) => number;
  /** Uses tabular numerals and end alignment unless `align` is set. */
  numeric?: boolean;
  /** Aligns the heading and cells. Defaults to `end` for `numeric` columns and `start` otherwise. */
  align?: DataColumnAlign;
  /** Sets the column width. Numbers are pixels. */
  width?: CSSProperties['width'];
  /** Sets the column's minimum width. Numbers are pixels. */
  minWidth?: CSSProperties['minInlineSize'];
}
export interface DataTableSortButtonDetails {
  /** Direction the next activation requests, or `null` when it removes the column from the sort. */
  next: SortDirection | null;
  /** One-based position in the sort order, or `null` when the column is not sorted. */
  priority: number | null;
  /** Number of columns in the sort order. */
  count: number;
  /** `priority` formatted for the table locale; empty when the column is not sorted. */
  formattedPriority: string;
}
export interface DataTableMessages {
  empty: string;
  missing: string;
  clear: string;
  scrollLabel: string;
  loading: string;
  loaded: string;
  unsorted: string;
  selectionHeader: string;
  sortButton: (header: string, direction: SortDirection | null, details: DataTableSortButtonDetails) => string;
  sortStatus: (header: string, direction: SortDirection) => string;
  selectRow: (rowLabel: string) => string;
  selectAll: string;
  selectionStatus: (
    visibleSelected: number,
    totalSelected: number,
    visibleRows: number,
    formatted: { visibleSelected: string; totalSelected: string; visibleRows: string },
  ) => string;
}
export interface DataTablePartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}
export interface SortableDataTableSlots {
  /** Container above the table holding the `toolbar` content. */
  toolbar?: ComponentType<ComponentPropsWithRef<'div'> & DataTablePartProps>;
  /** Scrollable container wrapping the table. */
  scroller?: ComponentType<ComponentPropsWithRef<'div'> & DataTablePartProps>;
  /** Table displaying the records. */
  table?: ComponentType<ComponentPropsWithRef<'table'> & DataTablePartProps>;
  /** Caption naming the table. */
  caption?: ComponentType<ComponentPropsWithRef<'caption'> & DataTablePartProps>;
  /** Column heading cell. */
  headerCell?: ComponentType<ComponentPropsWithRef<'th'> & DataTablePartProps>;
  /** Button changing the sort order. */
  sortButton?: ComponentType<ComponentPropsWithRef<'button'> & DataTablePartProps>;
  /** Row displaying one record. */
  row?: ComponentType<ComponentPropsWithRef<'tr'> & DataTablePartProps>;
  /** Cell displaying a value, the empty state or the loading state. */
  cell?: ComponentType<ComponentPropsWithRef<'td'> & DataTablePartProps>;
  /** Footer containing selection controls. */
  footer?: ComponentType<ComponentPropsWithRef<'div'> & DataTablePartProps>;
  /** Live region announcing table updates. */
  status?: ComponentType<ComponentPropsWithRef<'p'> & DataTablePartProps>;
}
export type DataTableSlotProps = {
  [Part in keyof SortableDataTableSlots]?: ComponentProps<NonNullable<SortableDataTableSlots[Part]>>;
};
interface DataTableSortValueProps<Id extends string> {
  /** Controls the sort order, primary column first. Use `[]` for input order. Takes precedence over `value`. */
  sort?: readonly SortState<NoInfer<Id>>[];
  /** @deprecated Use `sort`. Controls a single-column sort; `null` means input order. */
  value?: SortState<NoInfer<Id>> | null;
}
type DataTableSortProps<Id extends string> =
  | (DataTableSortValueProps<Id> & {
      /** Leaves row ordering to you and requires a controlled `sort` or `value`. */
      sortMode: 'manual';
      sort: readonly SortState<NoInfer<Id>>[];
    })
  | (DataTableSortValueProps<Id> & {
      /** Leaves row ordering to you and requires a controlled `sort` or `value`. */
      sortMode: 'manual';
      value: SortState<NoInfer<Id>> | null;
    })
  | (DataTableSortValueProps<Id> & {
      /** Sorts supplied rows locally. Defaults to `client`. */
      sortMode?: 'client';
    });
type DataTableSelectionProps<T> =
  | {
      /** Shows a checkbox per row: `single` keeps at most one row selected, `multiple` adds select-all. Takes precedence over `selectable`. */
      selectionMode: 'single' | 'multiple';
      /** Names each row in its selection checkbox label. Required when rows are selectable. */
      getRowLabel: (row: T) => string;
      /** @deprecated Use `selectionMode="multiple"`. */
      selectable?: boolean;
    }
  | {
      /** @deprecated Use `selectionMode="multiple"`. */
      selectable: true;
      /** Names each row in its selection checkbox label. Required when rows are selectable. */
      getRowLabel: (row: T) => string;
      /** Shows a checkbox per row: `single` keeps at most one row selected, `multiple` adds select-all. Takes precedence over `selectable`. */
      selectionMode?: DataTableSelectionMode;
    }
  | {
      /** Hides row selection controls. Defaults to `none`. */
      selectionMode?: 'none';
      /** @deprecated Use `selectionMode`. */
      selectable?: false;
      /** Names each row in its selection checkbox label. Required when rows are selectable. */
      getRowLabel?: (row: T) => string;
    };
export type SortableDataTableProps<T, Id extends string = string, Key extends string = string> = Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'> &
  SxProps & {
    /** Supplies the records displayed and, in client mode, sorted by the table. */
    rows: readonly T[];
    /** Defines column headings, cell content, alignment, widths and sorting behavior. */
    columns: readonly DataColumn<T, Id>[];
    /** Returns a stable, unique key for each row; selection, focus and React keys follow it, never the array index. */
    getRowId: (row: T) => Key;
    /** Names the table through its caption. */
    caption: ReactNode;
    /** Visually hides the caption while preserving its accessible name. Defaults to `false`. */
    captionHidden?: boolean;
    /** Sets the initial uncontrolled sort order, primary column first. Defaults to `[]` for input order. */
    defaultSort?: readonly SortState<NoInfer<Id>>[];
    /** Receives the requested sort order when a sort button is activated. */
    onSortChange?: (sort: readonly SortState<NoInfer<Id>>[]) => void;
    /** Lets several columns sort at once: each activation cycles a column through ascending, descending and removed, and a new column joins at the lowest priority. Without it only the first entry applies. Defaults to `false`. */
    multiSort?: boolean;
    /** @deprecated Use `defaultSort`. Sets the initial uncontrolled single-column sort. */
    defaultValue?: SortState<NoInfer<Id>> | null;
    /** @deprecated Use `onSortChange`. Receives the primary sort column when it changes. */
    onValueChange?: (sort: SortState<NoInfer<Id>> | null) => void;
    /** Controls selected row keys, including keys outside the displayed rows. */
    selectedKeys?: readonly NoInfer<Key>[];
    /** Sets initially selected keys when uncontrolled. Defaults to an empty list. */
    defaultSelectedKeys?: readonly NoInfer<Key>[];
    /** Receives selected keys after row, select-all or clear actions. */
    onSelectionChange?: (keys: readonly NoInfer<Key>[]) => void;
    /** Sets string sorting, list, number and date formatting locales. */
    locale?: Intl.LocalesArgument;
    /** Configures formatting for date values without a custom cell renderer. */
    dateFormatOptions?: Intl.DateTimeFormatOptions;
    /** Sets the date display time zone, overriding `dateFormatOptions.timeZone`. */
    timeZone?: string;
    /** Overrides empty text, control labels and live announcements. */
    messages?: Partial<DataTableMessages>;
    /** Replaces the content shown across all columns when there are no rows. Defaults to `messages.empty`. */
    empty?: ReactNode;
    /** Marks the table busy, shows a loading row and announces `messages.loading`. Defaults to `false`. */
    loading?: boolean;
    /** Sets the minimum row content height (`compact` 32px, `standard` 40px, `comfortable` 48px), plus a 1px divider. Defaults to `standard`. */
    density?: DataTableDensity;
    /** @deprecated Use `density`: `sm` is `compact` and `md` is `standard`. */
    size?: 'sm' | 'md';
    /** Renders your controls above the table, for example filters, search or bulk actions. */
    toolbar?: ReactNode;
    /** Sets the table's CSS minimum inline size. Numbers are pixels. Defaults to `auto`. */
    minTableWidth?: CSSProperties['minInlineSize'];
    /** Limits the scroller's height so rows scroll under the sticky header. Numbers are pixels. Defaults to `none`. */
    maxTableHeight?: CSSProperties['maxBlockSize'];
    /** Receives the table element rather than the outer container. */
    tableRef?: Ref<HTMLTableElement>;
    /** Passes props to toolbar, table, scrolling and selection parts. */
    slotProps?: DataTableSlotProps;
    /** Replaces toolbar, table, scrolling and selection parts. */
    slots?: SortableDataTableSlots;
  } & DataTableSortProps<Id> &
  DataTableSelectionProps<T>;

const directionWords: Record<SortDirection, string> = { asc: 'ascending', desc: 'descending' };
const ariaSort: Record<SortDirection, 'ascending' | 'descending'> = { asc: 'ascending', desc: 'descending' };
const directionSign: Record<SortDirection, number> = { asc: 1, desc: -1 };
const sizeDensity: Record<'sm' | 'md', DataTableDensity> = {
  sm: 'compact',
  md: 'standard',
};
const defaultMessages: DataTableMessages = {
  empty: 'No records',
  missing: '—',
  clear: 'Clear selection',
  scrollLabel: 'Scrollable table',
  loading: 'Loading records',
  loaded: 'Records loaded',
  unsorted: 'Original order',
  selectionHeader: 'Select',
  sortButton: (header, direction, { next, count, formattedPriority }) => {
    const action = next === null ? 'remove sort' : `sort ${directionWords[next]}`;
    return direction && count > 1
      ? `${header}, ${directionWords[direction]}, priority ${formattedPriority}: ${action}`
      : `${header}: ${action}`;
  },
  sortStatus: (header, direction) => `${header}, ${directionWords[direction]}`,
  selectRow: (label) => `Select ${label}`,
  selectAll: 'Select all visible rows',
  selectionStatus: (_visible, _total, _rows, formatted) =>
    `${formatted.visibleSelected} of ${formatted.visibleRows} visible selected; ${formatted.totalSelected} selected in total`,
};
const DIVIDER_WIDTH = '1px';
const rootStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});
const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  marginBlockEnd: vars.space[3],
});
const scrollerStyle = css({
  isolation: 'isolate',
  overflowX: 'auto',
  maxBlockSize: 'var(--ui-sortable-data-table-max-height, none)',
  // Clears the sticky header plus the focus ring drawn outside a focused row control.
  scrollPaddingBlockStart: `calc(var(--ui-sortable-data-table-header-size, 0px) + ${vars.space[2]})`,
  maxInlineSize: '100%',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  '&:focus-visible': focusRingInset,
});
const tableStyle = css({ minInlineSize: 'var(--ui-sortable-data-table-min-width, auto)', inlineSize: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' });
const captionStyle = css({ textAlign: 'start', padding: vars.space[4], fontWeight: vars.fontWeight.medium });
const cellStyle = css({
  paddingInline: vars.space[3],
  textAlign: 'start',
  verticalAlign: 'middle',
  overflowWrap: 'anywhere',
  borderBlockEnd: `${DIVIDER_WIDTH} solid ${vars.color.borderSubtle}`,
  '&[data-numeric]': { fontVariantNumeric: 'tabular-nums' },
  // The sort control is an inline-flex button, so textAlign never reaches its label:
  // justify its content too so headers align with their cells.
  '&[data-align="center"]': { textAlign: 'center', '& > button': { justifyContent: 'center' } },
  '&[data-align="end"]': { textAlign: 'end', '& > button': { justifyContent: 'flex-end' } },
});
// Each row is a space-scale content height plus its divider, so a 32px control fills a compact
// row exactly and centers on whole pixels; padding keeps wrapped text off the dividers.
const rowBlockSize = (content: string) => css({ blockSize: `calc(${content} + ${DIVIDER_WIDTH})` });
const densityRowStyles: Record<DataTableDensity, SerializedStyles> = {
  compact: rowBlockSize(vars.space[8]),
  standard: rowBlockSize(vars.space[10]),
  comfortable: rowBlockSize(vars.space[12]),
};
const densityCellStyles: Record<DataTableDensity, SerializedStyles> = {
  compact: css({ paddingBlock: vars.space[1] }),
  standard: css({ paddingBlock: vars.space[2] }),
  comfortable: css({ paddingBlock: vars.space[3] }),
};
// Cells holding a 32px control rely on the row height alone, so compact rows stay 32px.
const controlCellStyle = css({ paddingBlock: 0 });
const headerStyle = css({
  whiteSpace: 'nowrap',
  position: 'sticky',
  insetBlockStart: 0,
  zIndex: 1,
  paddingBlock: 0,
  backgroundColor: vars.color.surfaceRaised,
  fontWeight: vars.fontWeight.medium,
  transitionProperty: 'border-color, box-shadow',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-scrolled]': { borderBlockEndColor: vars.color.borderControl, boxShadow: vars.shadow.raised },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const sortStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: vars.space[2],
  inlineSize: 'max-content',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingInline: 0,
  paddingBlock: vars.space[1],
  border: 0,
  borderRadius: 0,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  font: 'inherit',
  textAlign: 'inherit',
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': { backgroundColor: vars.color.surfaceHover, color: vars.color.text },
  '&:focus-visible': focusRingInset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { color: 'ButtonText' },
}, touchTargetStyle);
const sortIndicatorStyle = css({
  flexShrink: 0,
  inlineSize: vars.space[3],
  blockSize: vars.space[3],
  color: vars.color.textMuted,
  '&[data-direction]': { color: vars.color.accentText },
  '&[data-direction="asc"] > [data-chevron="down"], &[data-direction="desc"] > [data-chevron="up"]': {
    visibility: 'hidden',
  },
  [FORCED_COLORS]: { color: 'ButtonText', '&[data-direction]': { color: 'ButtonText' } },
});
const sortPriorityStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  minInlineSize: vars.space[5],
  blockSize: vars.space[5],
  marginInlineStart: vars.space[1],
  paddingInline: vars.space[1],
  verticalAlign: 'middle',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  color: vars.color.text,
  fontSize: vars.textSize.xs,
  lineHeight: vars.lineHeight.tight,
  fontVariantNumeric: 'tabular-nums',
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const rowStyle = css({
  '&[data-selected]': { backgroundColor: vars.color.accentSoft },
  [FORCED_COLORS]: { '&[data-selected]': { outline: '1px solid Highlight', outlineOffset: '-1px' } },
});
const statusCellStyle = css({ color: vars.color.textMuted });
const loadingContentStyle = css({ display: 'inline-flex', alignItems: 'center', gap: vars.space[2] });
const footerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
  padding: vars.space[3],
});
const checkboxStyle = css({ minBlockSize: vars.space[8], minInlineSize: vars.space[8], justifyContent: 'center' });
const emptyKeys: readonly never[] = [];
const emptySort: readonly never[] = [];
const sortable = <T,>(column: DataColumn<T>) => column.sortable !== false && Boolean(column.accessor || column.compare);
const columnLabel = <T,>(column: DataColumn<T>) =>
  column.sortLabel ?? (typeof column.header === 'string' ? column.header : '');
const columnAlign = <T,>(column: DataColumn<T>): DataColumnAlign => column.align ?? (column.numeric ? 'end' : 'start');
const missing = (value: unknown) =>
  value == null ||
  value === '' ||
  (typeof value === 'number' && !Number.isFinite(value)) ||
  (value instanceof Date && !Number.isFinite(value.getTime()));
const normalizeKeys = <Key extends string,>(keys: readonly Key[]) => [...new Set(keys)];
const sameKeys = <Key extends string,>(a: readonly Key[], b: readonly Key[]) => {
  const other = new Set(b);
  return a.length === other.size && a.every((key) => other.has(key));
};
const sameSortEntry = (a: SortState | undefined, b: SortState | undefined) =>
  a?.columnId === b?.columnId && a?.direction === b?.direction;
const sameSort = (a: readonly SortState[], b: readonly SortState[]) =>
  a.length === b.length && a.every((entry, index) => sameSortEntry(entry, b[index]));
function compareValues(a: unknown, b: unknown, collator: Intl.Collator) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b);
  return 0;
}
interface SortKey<T> {
  column: DataColumn<T>;
  direction: SortDirection;
}
// Missing values sort last in either direction; ties fall through to the next key, then input order.
function sortRows<T>(rows: readonly T[], keys: readonly SortKey<T>[], collator: Intl.Collator) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { column, direction } of keys) {
        const av = column.accessor?.(a.row);
        const bv = column.accessor?.(b.row);
        if (column.accessor && (missing(av) || missing(bv))) {
          const placed = Number(missing(av)) - Number(missing(bv));
          if (placed) return placed;
          continue;
        }
        const compared = column.compare ? column.compare(a.row, b.row) : compareValues(av, bv, collator);
        if (Number.isFinite(compared) && compared !== 0) return compared * directionSign[direction];
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

// Native table: Tab/Shift+Tab visit controls; Enter/Space sort through native buttons.
// Bounded collections only; compose Pagination externally, without grid navigation or virtualization.
export function SortableDataTable<T, const Id extends string = string, Key extends string = string>({
  ref,
  rows,
  columns,
  getRowId,
  caption,
  captionHidden = false,
  sort: sortProp,
  defaultSort,
  onSortChange,
  multiSort = false,
  value,
  defaultValue = null,
  onValueChange,
  sortMode = 'client',
  selectionMode: selectionModeProp,
  selectable = false,
  getRowLabel,
  selectedKeys,
  defaultSelectedKeys = emptyKeys,
  onSelectionChange,
  locale,
  dateFormatOptions,
  timeZone,
  messages: messageOverrides,
  empty,
  loading = false,
  density: densityProp,
  size,
  toolbar,
  minTableWidth,
  maxTableHeight,
  tableRef,
  slotProps,
  slots,
  className,
  sx,
  ...rest
}: SortableDataTableProps<T, Id, Key>) {
  const Toolbar = slots?.toolbar ?? 'div';
  const Scroller = slots?.scroller ?? 'div';
  const Table = slots?.table ?? 'table';
  const Caption = slots?.caption ?? 'caption';
  const HeaderCell = slots?.headerCell ?? 'th';
  const SortButton = slots?.sortButton ?? 'button';
  const Row = slots?.row ?? 'tr';
  const Cell = slots?.cell ?? 'td';
  const Footer = slots?.footer ?? 'div';
  const Status = slots?.status ?? 'p';
  const messages = { ...defaultMessages, ...messageOverrides };
  const density = densityProp ?? sizeDensity[size ?? 'md'];
  const selectionMode: DataTableSelectionMode = selectionModeProp ?? (selectable ? 'multiple' : 'none');
  const selecting = selectionMode !== 'none';
  const captionId = useId();
  const controlledSort = sortProp ?? (value === undefined ? undefined : value === null ? emptySort : [value]);
  const [rawSort, requestSort] = useControlledState<readonly SortState<Id>[]>(
    controlledSort,
    defaultSort ?? (defaultValue ? [defaultValue] : emptySort),
    (next) => {
      onSortChange?.(next);
      if (!sameSortEntry(sortOrder[0], next[0])) onValueChange?.(next[0] ?? null);
    },
  );
  const [rawKeys, requestKeys] = useControlledState(selectedKeys, defaultSelectedKeys, onSelectionChange);
  const keys = normalizeKeys(rawKeys ?? emptyKeys);
  const keySet = new Set(keys);
  const sortColumns = new Map(columns.filter(sortable).map((column) => [column.id, column]));
  // Unknown, unsortable and repeated columns are ignored; without multiSort only the primary applies.
  const sortKeys = (rawSort ?? emptySort)
    .flatMap(({ columnId, direction }) => {
      const column = sortColumns.get(columnId);
      return column ? [{ column, direction }] : [];
    })
    .filter((key, index, list) => list.findIndex((other) => other.column === key.column) === index)
    .slice(0, multiSort ? undefined : 1);
  const sortOrder: readonly SortState<Id>[] = sortKeys.map(({ column, direction }) => ({ columnId: column.id, direction }));
  const sortSignature = JSON.stringify(sortOrder);
  const numberFormat = useMemo(() => numberFormatter(locale), [locale]);
  const listFormat = useMemo(() => new Intl.ListFormat(locale, { type: 'conjunction' }), [locale]);
  const dateFormat = useMemo(
    () => dateTimeFormatter(locale, { ...dateFormatOptions, ...(timeZone ? { timeZone } : {}) }),
    [locale, dateFormatOptions, timeZone],
  );
  const collator = useMemo(() => new Intl.Collator(locale, { numeric: true, sensitivity: 'base' }), [locale]);
  const displayed = useMemo(() => {
    if (sortMode === 'manual' || sortOrder.length === 0) return rows;
    return sortRows(rows, sortKeys, collator);
  }, [rows, sortSignature, sortMode, columns, collator]);
  const visibleKeys = displayed.map(getRowId);
  const visibleSelected = visibleKeys.filter((key) => keySet.has(key)).length;
  const allSelected = visibleKeys.length > 0 && visibleSelected === visibleKeys.length;
  const mixed = visibleSelected > 0 && !allSelected;
  const summary = messages.selectionStatus(visibleSelected, keys.length, visibleKeys.length, {
    visibleSelected: numberFormat.format(visibleSelected),
    totalSelected: numberFormat.format(keys.length),
    visibleRows: numberFormat.format(visibleKeys.length),
  });
  const columnSpan = columns.length + Number(selecting);
  const isEmpty = displayed.length === 0;
  const anchor = useRef<Key | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const clearing = useRef(false);
  const focusedRow = useRef<{ key: Key; index: number; control: number } | null>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mergedScrollerRef = useMergeRefs([scrollerRef, slotProps?.scroller?.ref]);
  const mergedTableRef = useMergeRefs([tableRef, slotProps?.table?.ref]);
  const selectionSignature = JSON.stringify([...keys].sort());
  // Loading starts as false so a table mounted while loading still announces it once mounted.
  const previous = useRef({ sort: sortSignature, selection: selectionSignature, loading: false, empty: isEmpty });
  const [status, setStatus] = useState('');
  const [scrolled, setScrolled] = useState(false);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const scroller = scrollerRef.current;
    if (!header || !scroller) return;
    const update = () => {
      scroller.style.setProperty('--ui-sortable-data-table-header-size', `${header.getBoundingClientRect().height}px`);
    };
    update();
    setScrolled(scroller.scrollTop > 0);
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, [slots?.scroller, slots?.table]);
  useEffect(() => {
    const before = previous.current;
    const announcements: string[] = [];
    if (before.sort !== sortSignature)
      announcements.push(
        sortOrder.length
          ? listFormat.format(sortKeys.map(({ column, direction }) => messages.sortStatus(columnLabel(column), direction)))
          : messages.unsorted,
      );
    if (before.selection !== selectionSignature && selecting) announcements.push(summary);
    if (before.loading !== loading) announcements.push(loading ? messages.loading : isEmpty ? messages.empty : messages.loaded);
    else if (!loading && isEmpty && !before.empty) announcements.push(messages.empty);
    const changed =
      before.sort !== sortSignature ||
      before.selection !== selectionSignature ||
      before.loading !== loading ||
      before.empty !== isEmpty;
    previous.current = { sort: sortSignature, selection: selectionSignature, loading, empty: isEmpty };
    if (changed) setStatus(announcements.join('. '));
  });
  useLayoutEffect(() => {
    if (clearing.current && keys.length === 0) {
      clearing.current = false;
      const document = scrollerRef.current?.ownerDocument;
      if (document?.activeElement === document?.body) (selectAllRef.current ?? scrollerRef.current)?.focus();
    }
    const focused = focusedRow.current;
    if (!focused) return;
    const currentIndex = visibleKeys.indexOf(focused.key);
    if (currentIndex >= 0) {
      focused.index = currentIndex;
      return;
    }
    const body = bodyRef.current;
    if (body && body.ownerDocument.activeElement === body.ownerDocument.body) {
      const row = body.rows[Math.min(focused.index, body.rows.length - 1)];
      const controls = row?.querySelectorAll<HTMLElement>('input, button, a[href], select, textarea, [tabindex="0"]');
      (
        controls?.[Math.min(focused.control, controls.length - 1)] ??
        selectAllRef.current ??
        scrollerRef.current
      )?.focus();
    }
    focusedRow.current = null;
  });
  const nextDirection = (current: SortDirection | undefined): SortDirection | null =>
    current === 'asc' ? 'desc' : current === 'desc' && multiSort ? null : 'asc';
  const requestColumnSort = (columnId: Id) => {
    const current = sortOrder.find((entry) => entry.columnId === columnId);
    const direction = nextDirection(current?.direction);
    let next: readonly SortState<Id>[];
    if (direction === null) next = sortOrder.filter((entry) => entry !== current);
    else if (!multiSort) next = [{ columnId, direction }];
    else if (current) next = sortOrder.map((entry) => (entry === current ? { columnId, direction } : entry));
    else next = [...sortOrder, { columnId, direction }];
    if (!sameSort(sortOrder, next)) requestSort(next);
  };
  const updateSelection = (next: readonly Key[]) => {
    const normalized = normalizeKeys(next);
    if (!sameKeys(keys, normalized)) requestKeys(normalized);
  };
  const toggleRows = (targets: readonly Key[], checked: boolean) =>
    updateSelection(checked ? [...keys, ...targets] : keys.filter((key) => !targets.includes(key)));
  const formatCell = (column: DataColumn<T>, row: T) => {
    if (column.cell) return column.cell(row);
    const cell = column.accessor?.(row);
    if (missing(cell)) return messages.missing;
    if (typeof cell === 'number') return numberFormat.format(cell);
    if (cell instanceof Date) return dateFormat.format(cell);
    return cell;
  };
  const selectionCheckbox = (row: T, key: Key) => (
    <Checkbox
      aria-label={messages.selectRow(getRowLabel?.(row) ?? key)}
      checked={keySet.has(key)}
      slotProps={{ root: { sx: checkboxStyle } }}
      onChange={(event) => {
        if (event.defaultPrevented || event.nativeEvent.defaultPrevented) return;
        const checked = event.currentTarget.checked;
        if (selectionMode === 'single') {
          updateSelection(checked ? [key] : []);
          return;
        }
        const native = event.nativeEvent as MouseEvent;
        const start = anchor.current === null ? -1 : visibleKeys.indexOf(anchor.current);
        const end = visibleKeys.indexOf(key);
        const targets =
          native.shiftKey && start >= 0 ? visibleKeys.slice(Math.min(start, end), Math.max(start, end) + 1) : [key];
        toggleRows(targets, checked);
        anchor.current = key;
      }}
    />
  );
  const statusRow = (content: ReactNode) => (
    <tr css={densityRowStyles[density]}>
      <Cell
        {...withoutSx(slotProps?.cell)}
        colSpan={columnSpan}
        className={slotProps?.cell?.className}
        css={[cellStyle, densityCellStyles[density], statusCellStyle, slotProps?.cell?.sx]}
      >
        {content}
      </Cell>
    </tr>
  );
  return (
    <WithSx className={className} styles={[rootStyle]} sx={sx}>
      {(rootClass) => (
        <div {...rest} ref={ref} className={rootClass} data-ui="sortable-data-table" data-density={density}>
          {isRenderable(toolbar) && (
            <Toolbar
              {...withoutSx(slotProps?.toolbar)}
              data-ui="sortable-data-table-toolbar"
              className={slotProps?.toolbar?.className}
              css={[toolbarStyle, slotProps?.toolbar?.sx]}
            >
              {toolbar}
            </Toolbar>
          )}
          <Scroller
            {...withoutSx(slotProps?.scroller)}
            ref={mergedScrollerRef}
            role="region"
            aria-label={messages.scrollLabel}
            aria-describedby={rest['aria-describedby']}
            tabIndex={0}
            data-ui="sortable-data-table-scroller"
            className={slotProps?.scroller?.className}
            css={[scrollerStyle, slotProps?.scroller?.sx]}
            style={{
              '--ui-sortable-data-table-max-height': typeof maxTableHeight === 'number' ? `${maxTableHeight}px` : maxTableHeight ?? 'none',
              ...slotProps?.scroller?.style,
            } as CSSProperties}
            onScroll={(event) => {
              slotProps?.scroller?.onScroll?.(event);
              setScrolled(event.currentTarget.scrollTop > 0);
            }}
          >
            <Table
              {...withoutSx(slotProps?.table)}
              ref={mergedTableRef}
              aria-busy={loading || undefined}
              className={slotProps?.table?.className}
              css={[tableStyle, slotProps?.table?.sx]}
              style={{
                '--ui-sortable-data-table-min-width': typeof minTableWidth === 'number' ? `${minTableWidth}px` : minTableWidth ?? 'auto',
                ...slotProps?.table?.style,
              } as CSSProperties}
            >
              {isRenderable(caption) && (
                <Caption
                  {...withoutSx(slotProps?.caption)}
                  id={captionId}
                  className={slotProps?.caption?.className}
                  css={[captionStyle, captionHidden && visuallyHiddenStyle, slotProps?.caption?.sx]}
                >
                  {caption}
                </Caption>
              )}
              <colgroup>
                {selecting && <col />}
                {columns.map((column) => (
                  <col key={column.id} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead ref={headerRef}>
                <tr css={densityRowStyles[density]}>
                  {selecting && (
                    <th
                      scope="col"
                      data-scrolled={scrolled || undefined}
                      css={[cellStyle, densityCellStyles[density], headerStyle]}
                    >
                      {selectionMode === 'multiple' ? (
                        <Checkbox
                          ref={selectAllRef}
                          aria-label={messages.selectAll}
                          checked={allSelected}
                          indeterminate={mixed}
                          disabled={!visibleKeys.length}
                          slotProps={{ root: { sx: checkboxStyle } }}
                          onChange={(event) => {
                            if (!event.defaultPrevented && !event.nativeEvent.defaultPrevented)
                              toggleRows(visibleKeys, event.currentTarget.checked);
                          }}
                        />
                      ) : (
                        <span css={visuallyHiddenStyle}>{messages.selectionHeader}</span>
                      )}
                    </th>
                  )}
                  {columns.map((column) => {
                    const position = sortOrder.findIndex((entry) => entry.columnId === column.id);
                    const direction = sortOrder[position]?.direction ?? null;
                    const priority = position >= 0 ? position + 1 : null;
                    return (
                      <HeaderCell
                        {...withoutSx(slotProps?.headerCell)}
                        key={column.id}
                        scope="col"
                        data-numeric={column.numeric || undefined}
                        data-align={columnAlign(column)}
                        data-scrolled={scrolled || undefined}
                        // ARIA allows aria-sort on one header at a time: the primary column. The
                        // sort buttons name the other columns' direction and priority.
                        aria-sort={priority === 1 && direction ? ariaSort[direction] : undefined}
                        className={slotProps?.headerCell?.className}
                        css={[cellStyle, densityCellStyles[density], headerStyle, slotProps?.headerCell?.sx]}
                        style={{ minInlineSize: column.minWidth, ...slotProps?.headerCell?.style }}
                      >
                        {sortable(column) ? (
                          <SortButton
                            {...withoutSx(slotProps?.sortButton)}
                            type="button"
                            aria-label={messages.sortButton(columnLabel(column), direction, {
                              next: nextDirection(direction ?? undefined),
                              priority,
                              count: sortOrder.length,
                              formattedPriority: priority === null ? '' : numberFormat.format(priority),
                            })}
                            className={slotProps?.sortButton?.className}
                            css={[sortStyle, slotProps?.sortButton?.sx]}
                            onClick={(event) => {
                              if (!event.defaultPrevented) requestColumnSort(column.id);
                            }}
                          >
                            {isRenderable(column.header) && column.header}
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              data-direction={direction ?? undefined}
                              css={sortIndicatorStyle}
                            >
                              <path data-chevron="up" d="m3 4 3-3 3 3" />
                              <path data-chevron="down" d="m3 8 3 3 3-3" />
                            </svg>
                          </SortButton>
                        ) : (
                          isRenderable(column.header) && column.header
                        )}
                        {/* Beside the button, not inside it, so the button's visible text stays within its name. */}
                        {priority !== null && sortOrder.length > 1 && (
                          <span aria-hidden="true" data-ui="sortable-data-table-sort-priority" css={sortPriorityStyle}>
                            {numberFormat.format(priority)}
                          </span>
                        )}
                      </HeaderCell>
                    );
                  })}
                </tr>
              </thead>
              {loading && (
                <tbody data-ui="sortable-data-table-loading">
                  {statusRow(
                    <span css={loadingContentStyle}>
                      <Spinner size="sm" decorative />
                      {messages.loading}
                    </span>,
                  )}
                </tbody>
              )}
              <tbody ref={bodyRef}>
                {displayed.map((row, index) => {
                  const key = getRowId(row);
                  const selected = keySet.has(key);
                  return (
                    <Row
                      {...withoutSx(slotProps?.row)}
                      key={key}
                      aria-selected={selecting ? selected : undefined}
                      data-selected={(selecting && selected) || undefined}
                      className={slotProps?.row?.className}
                      css={[rowStyle, densityRowStyles[density], slotProps?.row?.sx]}
                      onFocusCapture={(event) => {
                        const controls = Array.from(
                          event.currentTarget.querySelectorAll<HTMLElement>(
                            'input, button, a[href], select, textarea, [tabindex="0"]',
                          ),
                        );
                        focusedRow.current = { key, index, control: controls.indexOf(event.target as HTMLElement) };
                      }}
                      onBlurCapture={(event) => {
                        if (event.relatedTarget && !bodyRef.current?.contains(event.relatedTarget as Node))
                          focusedRow.current = null;
                      }}
                    >
                      {selecting && (
                        <td css={[cellStyle, densityCellStyles[density], controlCellStyle]}>{selectionCheckbox(row, key)}</td>
                      )}
                      {columns.map((column) => (
                        <Cell
                          {...withoutSx(slotProps?.cell)}
                          key={column.id}
                          data-numeric={column.numeric || undefined}
                          data-align={columnAlign(column)}
                          className={slotProps?.cell?.className}
                          css={[cellStyle, densityCellStyles[density], slotProps?.cell?.sx]}
                        >
                          {formatCell(column, row)}
                        </Cell>
                      ))}
                    </Row>
                  );
                })}
                {isEmpty && !loading && statusRow(empty === undefined ? messages.empty : isRenderable(empty) && empty)}
              </tbody>
            </Table>
          </Scroller>
          {selecting && (
            <Footer {...withoutSx(slotProps?.footer)} className={slotProps?.footer?.className} css={[footerStyle, slotProps?.footer?.sx]}>
              <span>{summary}</span>
              {keys.length > 0 && (
                <Button
                  ref={clearRef}
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    if (event.defaultPrevented) return;
                    clearing.current = clearRef.current?.ownerDocument.activeElement === clearRef.current;
                    updateSelection([]);
                  }}
                  onBlur={(event) => {
                    if (event.relatedTarget) clearing.current = false;
                  }}
                >
                  {messages.clear}
                </Button>
              )}
            </Footer>
          )}
          <Status
            {...withoutSx(slotProps?.status)}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={slotProps?.status?.className}
            css={[visuallyHiddenStyle, slotProps?.status?.sx]}
          >
            {status}
          </Status>
        </div>
      )}
    </WithSx>
  );
}
SortableDataTable.displayName = 'SortableDataTable';
