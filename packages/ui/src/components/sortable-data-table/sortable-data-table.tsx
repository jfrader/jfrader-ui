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
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Checkbox } from '../checkbox';

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  columnId: string;
  direction: SortDirection;
}
export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: (row: T) => string | number | Date | null | undefined;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  sortLabel?: string;
  compare?: (a: T, b: T) => number;
  numeric?: boolean;
  width?: CSSProperties['width'];
}
export interface DataTableMessages {
  empty: string;
  missing: string;
  clear: string;
  scrollLabel: string;
  sortButton: (header: string, direction: SortDirection | null) => string;
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
  css?: Interpolation<Theme>;
}
export type DataTableSlotProps = Partial<
  Record<
    | /** Scrollable container wrapping the table. */
      'scroller'
    | /** Table element rendering the tabular dataset. */
      'table'
    | /** Caption element describing the table. */
      'caption'
    | /** Header cell element in the table head row. */
      'headerCell'
    | /** Button element inside a header cell triggering column sort. */
      'sortButton'
    | /** Table row element representing an individual data record. */
      'row'
    | /** Table body data cell element. */
      'cell'
    | /** Table footer container element. */
      'footer'
    | /** Status element announcing sorting and selection updates. */
      'status',
    DataTablePartProps
  >
>;
export type SortableDataTableProps<T> = Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'> &
  SxProps & {
    rows: readonly T[];
    columns: readonly DataColumn<T>[];
    getRowId: (row: T) => string;
    caption: ReactNode;
    captionHidden?: boolean;
    defaultValue?: SortState | null;
    onValueChange?: (sort: SortState | null) => void;
    selectedKeys?: readonly string[];
    defaultSelectedKeys?: readonly string[];
    onSelectionChange?: (keys: readonly string[]) => void;
    locale?: Intl.LocalesArgument;
    dateFormatOptions?: Intl.DateTimeFormatOptions;
    timeZone?: string;
    messages?: Partial<DataTableMessages>;
    empty?: ReactNode;
    loading?: boolean;
    size?: 'sm' | 'md';
    tableRef?: Ref<HTMLTableElement>;
    slotProps?: DataTableSlotProps;
  } & ({ sortMode: 'manual'; value: SortState | null } | { sortMode?: 'client'; value?: SortState | null }) &
  ({ selectable: true; getRowLabel: (row: T) => string } | { selectable?: false; getRowLabel?: (row: T) => string });

const defaultMessages: DataTableMessages = {
  empty: 'No records',
  missing: '—',
  clear: 'Clear selection',
  scrollLabel: 'Scrollable table',
  sortButton: (header, direction) => `${header}: sort ${direction === 'asc' ? 'descending' : 'ascending'}`,
  sortStatus: (header, direction) => `${header}, ${direction === 'asc' ? 'ascending' : 'descending'}`,
  selectRow: (label) => `Select ${label}`,
  selectAll: 'Select all visible rows',
  selectionStatus: (_visible, _total, _rows, formatted) =>
    `${formatted.visibleSelected} of ${formatted.visibleRows} visible selected; ${formatted.totalSelected} selected in total`,
};
const rootStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});
const scrollerStyle = css({
  overflowX: 'auto',
  maxInlineSize: '100%',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  '&:focus-visible': focusRingInset,
});
const tableStyle = css({ inlineSize: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' });
const captionStyle = css({ textAlign: 'start', padding: vars.space[4], fontWeight: vars.fontWeight.medium });
const cellStyle = css({
  paddingInline: vars.space[3],
  textAlign: 'start',
  verticalAlign: 'middle',
  overflowWrap: 'anywhere',
  borderBlockEnd: `1px solid ${vars.color.borderSubtle}`,
  '&[data-numeric]': {
    textAlign: 'end',
    fontVariantNumeric: 'tabular-nums',
    // The sort control is an inline-flex button, so textAlign never reaches its label:
    // push its content to the end so numeric headers align with their end-aligned cells.
    '& button': { justifyContent: 'flex-end' },
  },
});
const densityStyles = { sm: css({ paddingBlock: vars.space[2] }), md: css({ paddingBlock: vars.space[3] }) };
const headerStyle = css({
  position: 'sticky',
  insetBlockStart: 0,
  zIndex: 1,
  backgroundColor: vars.color.surfaceRaised,
  fontWeight: vars.fontWeight.medium,
});
const sortStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[2],
  inlineSize: '100%',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'inherit',
  cursor: 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  '&:focus-visible': focusRingInset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const rowStyle = css({
  '&[data-selected]': { backgroundColor: vars.color.accentSoft },
  [FORCED_COLORS]: { '&[data-selected]': { outline: '1px solid Highlight', outlineOffset: '-1px' } },
});
const footerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
  padding: vars.space[3],
});
const checkboxStyle = css({ minBlockSize: vars.space[8], minInlineSize: vars.space[8], justifyContent: 'center' });
const emptyKeys: readonly string[] = [];
const sortable = <T,>(column: DataColumn<T>) => column.sortable !== false && Boolean(column.accessor || column.compare);
const columnLabel = <T,>(column: DataColumn<T>) =>
  column.sortLabel ?? (typeof column.header === 'string' ? column.header : '');
const missing = (value: unknown) =>
  value == null ||
  value === '' ||
  (typeof value === 'number' && !Number.isFinite(value)) ||
  (value instanceof Date && !Number.isFinite(value.getTime()));
const normalizeKeys = (keys: readonly string[]) => [...new Set(keys)];
const sameKeys = (a: readonly string[], b: readonly string[]) => {
  const other = new Set(b);
  return a.length === other.size && a.every((key) => other.has(key));
};
function compareValues(a: unknown, b: unknown, collator: Intl.Collator) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b);
  return 0;
}

// Native table: Tab/Shift+Tab visit controls; Enter/Space sort through native buttons.
// Bounded collections only; compose Pagination externally, without grid navigation or virtualization.
export function SortableDataTable<T>({
  ref,
  rows,
  columns,
  getRowId,
  caption,
  captionHidden = false,
  value,
  defaultValue = null,
  onValueChange,
  sortMode = 'client',
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
  size = 'md',
  tableRef,
  slotProps,
  className,
  sx,
  ...rest
}: SortableDataTableProps<T>) {
  const messages = { ...defaultMessages, ...messageOverrides };
  const captionId = useId();
  const [rawSort, requestSort] = useControlledState(value, defaultValue, onValueChange);
  const [rawKeys, requestKeys] = useControlledState(selectedKeys, defaultSelectedKeys, onSelectionChange);
  const keys = normalizeKeys(rawKeys ?? emptyKeys);
  const keySet = new Set(keys);
  const activeColumn = columns.find((column) => column.id === rawSort?.columnId && sortable(column));
  const sort = activeColumn && rawSort ? rawSort : null;
  const numberFormat = useMemo(() => numberFormatter(locale), [locale]);
  const dateFormat = useMemo(
    () => dateTimeFormatter(locale, { ...dateFormatOptions, ...(timeZone ? { timeZone } : {}) }),
    [locale, dateFormatOptions, timeZone],
  );
  const collator = useMemo(() => new Intl.Collator(locale, { numeric: true, sensitivity: 'base' }), [locale]);
  const displayed = useMemo(() => {
    if (sortMode === 'manual' || !sort || !activeColumn) return rows;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const av = activeColumn.accessor?.(a.row);
        const bv = activeColumn.accessor?.(b.row);
        if (activeColumn.accessor && (missing(av) || missing(bv)))
          return Number(missing(av)) - Number(missing(bv)) || a.index - b.index;
        const compared = activeColumn.compare ? activeColumn.compare(a.row, b.row) : compareValues(av, bv, collator);
        return (Number.isFinite(compared) ? compared : 0) * (sort.direction === 'asc' ? 1 : -1) || a.index - b.index;
      })
      .map(({ row }) => row);
  }, [rows, sort?.columnId, sort?.direction, sortMode, activeColumn, collator]);
  const visibleKeys = displayed.map(getRowId);
  const visibleSelected = visibleKeys.filter((key) => keySet.has(key)).length;
  const allSelected = visibleKeys.length > 0 && visibleSelected === visibleKeys.length;
  const mixed = visibleSelected > 0 && !allSelected;
  const summary = messages.selectionStatus(visibleSelected, keys.length, visibleKeys.length, {
    visibleSelected: numberFormat.format(visibleSelected),
    totalSelected: numberFormat.format(keys.length),
    visibleRows: numberFormat.format(visibleKeys.length),
  });
  const anchor = useRef<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const clearing = useRef(false);
  const focusedRow = useRef<{ key: string; index: number; control: number } | null>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sortSignature = sort ? `${sort.columnId}:${sort.direction}` : '';
  const selectionSignature = JSON.stringify([...keys].sort());
  const previous = useRef({ sort: sortSignature, selection: selectionSignature });
  const [status, setStatus] = useState('');
  useEffect(() => {
    const changed = previous.current.sort !== sortSignature || previous.current.selection !== selectionSignature;
    const announcements: string[] = [];
    if (previous.current.sort !== sortSignature && sort && activeColumn)
      announcements.push(messages.sortStatus(columnLabel(activeColumn), sort.direction));
    if (previous.current.selection !== selectionSignature && selectable) announcements.push(summary);
    previous.current = { sort: sortSignature, selection: selectionSignature };
    if (changed) setStatus(announcements.join('. '));
  }, [sortSignature, selectionSignature, selectable, summary, activeColumn, messages.sortStatus, sort?.direction]);
  useLayoutEffect(() => {
    if (clearing.current && keys.length === 0) {
      clearing.current = false;
      const document = selectAllRef.current?.ownerDocument;
      if (document?.activeElement === document?.body) selectAllRef.current?.focus();
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
  const updateSelection = (next: readonly string[]) => {
    const normalized = normalizeKeys(next);
    if (!sameKeys(keys, normalized)) requestKeys(normalized);
  };
  const toggleRows = (targets: readonly string[], checked: boolean) =>
    updateSelection(checked ? [...keys, ...targets] : keys.filter((key) => !targets.includes(key)));
  const formatCell = (column: DataColumn<T>, row: T) => {
    if (column.cell) return column.cell(row);
    const cell = column.accessor?.(row);
    if (missing(cell)) return messages.missing;
    if (typeof cell === 'number') return numberFormat.format(cell);
    if (cell instanceof Date) return dateFormat.format(cell);
    return cell;
  };
  const selectionCheckbox = (row: T, key: string) => (
    <Checkbox
      aria-label={messages.selectRow(getRowLabel!(row))}
      checked={keySet.has(key)}
      slotProps={{ root: { css: checkboxStyle } }}
      onChange={(event) => {
        if (event.defaultPrevented || event.nativeEvent.defaultPrevented) return;
        const native = event.nativeEvent as MouseEvent;
        const start = anchor.current === null ? -1 : visibleKeys.indexOf(anchor.current);
        const end = visibleKeys.indexOf(key);
        const targets =
          native.shiftKey && start >= 0 ? visibleKeys.slice(Math.min(start, end), Math.max(start, end) + 1) : [key];
        toggleRows(targets, event.currentTarget.checked);
        anchor.current = key;
      }}
    />
  );
  return (
    <WithSx className={className} styles={[rootStyle]} sx={sx}>
      {(rootClass) => (
        <div {...rest} ref={ref} className={rootClass} data-ui="sortable-data-table">
          <div
            ref={scrollerRef}
            role="region"
            aria-label={messages.scrollLabel}
            aria-describedby={rest['aria-describedby']}
            tabIndex={0}
            data-ui="sortable-data-table-scroller"
            className={slotProps?.scroller?.className}
            css={[scrollerStyle, slotProps?.scroller?.css]}
          >
            <table
              ref={tableRef}
              aria-busy={loading || undefined}
              className={slotProps?.table?.className}
              css={[tableStyle, slotProps?.table?.css]}
            >
              {isRenderable(caption) && (
                <caption
                  id={captionId}
                  className={slotProps?.caption?.className}
                  css={[captionStyle, captionHidden && visuallyHiddenStyle, slotProps?.caption?.css]}
                >
                  {caption}
                </caption>
              )}
              <colgroup>
                {selectable && <col />}
                {columns.map((column) => (
                  <col key={column.id} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {selectable && (
                    <th scope="col" css={[cellStyle, densityStyles[size], headerStyle]}>
                      <Checkbox
                        ref={selectAllRef}
                        aria-label={messages.selectAll}
                        checked={allSelected}
                        indeterminate={mixed}
                        disabled={!visibleKeys.length}
                        slotProps={{ root: { css: checkboxStyle } }}
                        onChange={(event) => {
                          if (!event.defaultPrevented && !event.nativeEvent.defaultPrevented)
                            toggleRows(visibleKeys, event.currentTarget.checked);
                        }}
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      data-numeric={column.numeric || undefined}
                      aria-sort={
                        sort?.columnId === column.id
                          ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                      className={slotProps?.headerCell?.className}
                      css={[cellStyle, densityStyles[size], headerStyle, slotProps?.headerCell?.css]}
                    >
                      {sortable(column) ? (
                        <button
                          type="button"
                          aria-label={messages.sortButton(
                            columnLabel(column),
                            sort?.columnId === column.id ? sort.direction : null,
                          )}
                          className={slotProps?.sortButton?.className}
                          css={[sortStyle, slotProps?.sortButton?.css]}
                          onClick={(event) => {
                            if (!event.defaultPrevented)
                              requestSort({
                                columnId: column.id,
                                direction: sort?.columnId === column.id && sort.direction === 'asc' ? 'desc' : 'asc',
                              });
                          }}
                        >
                          {isRenderable(column.header) && column.header}
                          <span aria-hidden="true">
                            {sort?.columnId === column.id ? (sort.direction === 'asc' ? '▲' : '▼') : '♢'}
                          </span>
                        </button>
                      ) : (
                        isRenderable(column.header) && column.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={bodyRef}>
                {displayed.length ? (
                  displayed.map((row, index) => {
                    const key = getRowId(row);
                    return (
                      <tr
                        key={key}
                        data-selected={(selectable && keySet.has(key)) || undefined}
                        className={slotProps?.row?.className}
                        css={[rowStyle, slotProps?.row?.css]}
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
                        {selectable && <td css={[cellStyle, densityStyles[size]]}>{selectionCheckbox(row, key)}</td>}
                        {columns.map((column) => (
                          <td
                            key={column.id}
                            data-numeric={column.numeric || undefined}
                            className={slotProps?.cell?.className}
                            css={[cellStyle, densityStyles[size], slotProps?.cell?.css]}
                          >
                            {formatCell(column, row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length + Number(selectable)}
                      className={slotProps?.cell?.className}
                      css={[cellStyle, densityStyles[size], slotProps?.cell?.css]}
                    >
                      {empty === undefined ? messages.empty : isRenderable(empty) && empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {selectable && (
            <div className={slotProps?.footer?.className} css={[footerStyle, slotProps?.footer?.css]}>
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
            </div>
          )}
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={slotProps?.status?.className}
            css={[visuallyHiddenStyle, slotProps?.status?.css]}
          >
            {status}
          </p>
        </div>
      )}
    </WithSx>
  );
}
SortableDataTable.displayName = 'SortableDataTable';
