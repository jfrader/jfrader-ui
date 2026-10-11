import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { SortableDataTable, type DataColumn, type SortableDataTableProps, type SortState } from './index';

interface Project {
  id: string;
  name: string;
  budget: number | null;
  date: Date;
}
const rows: readonly Project[] = Object.freeze([
  { id: 'c', name: 'Cedar', budget: 40, date: new Date('2026-03-03T12:00:00Z') },
  { id: 'a', name: 'Atlas', budget: 0, date: new Date('2026-01-01T12:00:00Z') },
  { id: 'b', name: 'Birch', budget: 40, date: new Date('2026-02-02T12:00:00Z') },
  { id: 'd', name: 'Delta', budget: null, date: new Date('2026-04-04T12:00:00Z') },
]);
const columns: readonly DataColumn<Project>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name },
  { id: 'budget', header: 'Budget', accessor: (row) => row.budget, numeric: true },
];
const getRowId = (row: Project) => row.id;
const getRowLabel = (row: Project) => row.name;
const Table = (props: SortableDataTableProps<Project>) => <SortableDataTable {...props} />;
Table.displayName = 'SortableDataTable';
const meta = {
  title: 'Data/SortableDataTable',
  component: Table,
  tags: ['autodocs'],
  args: { rows, columns, getRowId, caption: 'Projects', locale: 'en-US', timeZone: 'UTC' },
  parameters: {
    docs: {
      description: {
        component:
          'Native sortable table for bounded collections. Tab/Shift+Tab visit the scroller and controls; Enter/Space activate sorting, and Space toggles selection. Sort alternates ascending/descending; a controlled null value resets sorting. Compose Pagination outside the table. No grid navigation, editing or virtualization. Manual mode requires a controlled sort value. Mixed-type accessors require a comparator; non-text sortable headings require sortLabel. Pin locale and timeZone for server rendering.',
      },
      source: {
        code: `<SortableDataTable rows={projects} getRowId={row => row.id} caption="Projects" columns={[{ id: 'name', header: 'Name', accessor: row => row.name }, { id: 'budget', header: 'Budget', accessor: row => row.budget, numeric: true }]} />`,
      },
    },
  },
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;
const names = (element: HTMLElement) =>
  Array.from(
    element.querySelectorAll('tbody tr'),
    (row) => row.querySelectorAll('td')[row.querySelector('input') ? 1 : 0]?.textContent,
  );
const sortedHeader = (element: HTMLElement) => element.querySelector('th[aria-sort]');

export const Default: Story = {
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Projects' }).tagName).toBe('TABLE');
    await expect(canvasElement.querySelector('thead')?.tagName).toBe('THEAD');
    await expect(canvasElement.querySelector('tbody')?.tagName).toBe('TBODY');
    for (const header of canvas.getAllByRole('columnheader')) await expect(header).toHaveAttribute('scope', 'col');
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const Unsorted: Story = { args: { value: null } };
export const Ascending: Story = { args: { defaultValue: { columnId: 'name', direction: 'asc' } } };
export const Descending: Story = { args: { defaultValue: { columnId: 'name', direction: 'desc' } } };
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: vars.space[4] }}>
      <Table {...args} size="sm" caption="Compact projects" messages={{ scrollLabel: 'Compact projects scroller' }} />
      <Table {...args} size="md" />
    </div>
  ),
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(31.5);
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(31.5);
    }
  },
};
export const StableNumericSorting: Story = {
  args: { onValueChange: fn() },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['Atlas', 'Cedar', 'Birch', 'Delta']);
    await expect(sortedHeader(canvasElement)).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort descending' }));
    await expect(names(canvasElement)).toEqual(['Cedar', 'Birch', 'Atlas', 'Delta']);
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['Atlas', 'Cedar', 'Birch', 'Delta']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, { columnId: 'budget', direction: 'asc' });
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, { columnId: 'budget', direction: 'desc' });
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, { columnId: 'budget', direction: 'asc' });
    await expect(rows.map((row) => row.id)).toEqual(['c', 'a', 'b', 'd']);
    await expect(canvasElement.querySelectorAll('th[aria-sort]')).toHaveLength(1);
    // Numeric headers align with their end-aligned cells: the inline-flex sort control is pushed to the end.
    const numericHeader = canvasElement.querySelector<HTMLElement>('th[data-numeric]')!;
    await expect(getComputedStyle(numericHeader.querySelector('button')!).justifyContent).toBe('flex-end');
  },
};
function Controlled({ onValueChange, onSelectionChange, ...args }: SortableDataTableProps<Project>) {
  const [value, setValue] = useState<SortState | null>(null);
  const [selectedKeys, setKeys] = useState<readonly string[]>([]);
  return (
    <div>
      <Button
        size="sm"
        onClick={() => {
          setValue(null);
          setKeys([]);
        }}
      >
        Reset
      </Button>
      <Table
        {...args}
        value={value}
        selectedKeys={selectedKeys}
        onValueChange={(next) => {
          onValueChange?.(next);
          setValue(next);
        }}
        onSelectionChange={(next) => {
          onSelectionChange?.(next);
          setKeys(next);
        }}
      />
    </div>
  );
}
export const ControlledSort: Story = {
  args: { onValueChange: fn() },
  render: (args) => <Controlled {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Cedar', 'Delta']);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const RejectedSort: Story = {
  args: { value: null, onValueChange: fn() },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({ columnId: 'name', direction: 'asc' });
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const ManualServerSort: Story = {
  args: { sortMode: 'manual', value: null, onValueChange: fn() },
  render: (args) => <Controlled {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({ columnId: 'name', direction: 'asc' });
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await expect(sortedHeader(canvasElement)).toHaveAttribute('aria-sort', 'ascending');
  },
};
export const Selection: Story = {
  args: { selectable: true, getRowLabel, onSelectionChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Cedar' }));
    const all = canvas.getByRole('checkbox', { name: 'Select all visible rows' });
    await expect(all).toHaveAttribute('aria-checked', 'mixed');
    await expect((all as HTMLInputElement).indeterminate).toBe(true);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['c']);
    await userEvent.click(all);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(2);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['c', 'a', 'b', 'd']);
    await expect(all).toBeChecked();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear selection' }));
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(3);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith([]);
    await expect(all.ownerDocument.activeElement).toBe(all);
    await expect(all).not.toBeChecked();
  },
};
export const MixedSelection: Story = { args: { selectable: true, getRowLabel, defaultSelectedKeys: ['a'] } };
export const RejectedSelection: Story = {
  args: { selectable: true, getRowLabel, selectedKeys: ['a'], onSelectionChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    const all = canvas.getByRole('checkbox', { name: 'Select all visible rows' });
    await userEvent.click(all);
    await expect((all as HTMLInputElement).indeterminate).toBe(true);
    await expect(all).toHaveAttribute('aria-checked', 'mixed');
    await expect(canvas.getByRole('checkbox', { name: 'Select Cedar' })).not.toBeChecked();
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['a', 'c', 'b', 'd']);
    const clear = canvas.getByRole('button', { name: 'Clear selection' });
    await userEvent.click(clear);
    await expect(clear.ownerDocument.activeElement).toBe(clear);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(2);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith([]);
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const RangeSelection: Story = {
  args: {
    selectable: true,
    getRowLabel,
    onSelectionChange: fn(),
    defaultValue: { columnId: 'name', direction: 'asc' },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Atlas' }));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Cedar' }));
    await userEvent.keyboard('{/Shift}');
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(2);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);
    await expect(canvas.getByRole('checkbox', { name: 'Select Birch' })).toBeChecked();
  },
};
export const CrossPageSelection: Story = {
  args: { selectable: true, getRowLabel, defaultSelectedKeys: ['off-page', 'off-page'], onSelectionChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    const all = canvas.getByRole('checkbox', { name: 'Select all visible rows' });
    await userEvent.click(all);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['off-page', 'c', 'a', 'b', 'd']);
    await userEvent.click(all);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(2);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['off-page']);
    await expect(canvas.getAllByText('0 of 4 visible selected; 1 selected in total')[0]!).toBeVisible();
  },
};
export const Empty: Story = {
  args: { rows: [], selectable: true, getRowLabel },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('cell', { name: 'No records' })).toHaveAttribute('colspan', '3');
    await expect(canvas.getByRole('checkbox')).toBeDisabled();
  },
};
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  },
};
export const CustomCells: Story = {
  args: {
    columns: [
      { id: 'name', header: 'Name', accessor: (row) => row.name, cell: (row) => <strong>{row.name}</strong> },
      {
        id: 'budget',
        header: 'Budget',
        accessor: (row) => row.budget,
        numeric: true,
        cell: (row) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.budget ?? 0),
      },
    ],
  },
};
export const CustomComparator: Story = {
  args: {
    rows: rows.map((row) => (row.id === 'c' ? { ...row, name: 'Cedar gardens' } : row)),
    columns: [
      {
        id: 'name',
        header: <span>Project length</span>,
        sortLabel: 'Project length',
        compare: (a, b) => a.name.length - b.name.length,
        cell: (row) => row.name,
      },
    ],
    defaultValue: { columnId: 'name', direction: 'asc' },
  },
  play: async ({ canvasElement }) => {
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Delta', 'Cedar gardens']);
  },
};
export const LocaleNumbersAndDates: Story = {
  args: {
    locale: 'de-DE',
    columns: [...columns, { id: 'date', header: 'Date', accessor: (row) => row.date }],
    defaultValue: { columnId: 'date', direction: 'asc' },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Cedar', 'Delta']);
    await expect(
      canvas.getByRole('cell', { name: new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' }).format(rows[1]!.date) }),
    ).toBeVisible();
  },
};
export const LongCells: Story = {
  args: {
    rows: [
      {
        ...rows[0]!,
        name: 'A long project description with multiple words and an_unbroken_identifier_that_must_wrap_without_clipping_or_losing_any_of_its_content',
      },
    ],
    columns: [{ ...columns[0]!, width: '65%' }, columns[1]!],
  },
  render: (args) => (
    <div style={{ inlineSize: 'min(100%, 280px)' }}>
      <Table {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const scroller = canvas.getByRole('region');
    const root = canvasElement.querySelector('[data-ui="sortable-data-table"]')!;
    await expect(scroller.getBoundingClientRect().width).toBeLessThanOrEqual(root.getBoundingClientRect().width + 1);
    await expect(getComputedStyle(canvas.getAllByRole('cell')[0]!).overflowWrap).toBe('anywhere');
    await expect(getComputedStyle(canvas.getAllByRole('cell')[1]!).textAlign).toBe('end');
    await expect(canvas.getAllByRole('cell')[0]!.getBoundingClientRect().height).toBeGreaterThan(60);
  },
};
export const LinksAndButtons: Story = {
  args: {
    selectable: true,
    getRowLabel,
    onSelectionChange: fn(),
    columns: [
      {
        id: 'name',
        header: 'Name',
        cell: (row) => (
          <a href="#projects" onClick={(event) => event.preventDefault()}>
            {row.name}
          </a>
        ),
      },
      { id: 'action', header: 'Action', cell: (row) => <Button size="sm">Open {row.name}</Button> },
    ],
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('link', { name: 'Cedar' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Open Cedar' }));
    await expect(args.onSelectionChange).not.toHaveBeenCalled();
  },
};
function Removal(args: SortableDataTableProps<Project>) {
  const [currentRows, setRows] = useState(rows);
  return (
    <Table
      {...args}
      rows={currentRows}
      columns={[
        {
          id: 'name',
          header: 'Name',
          cell: (row) => (
            <Button size="sm" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>
              Remove {row.name}
            </Button>
          ),
        },
      ]}
    />
  );
}
export const RowRemovalFocus: Story = {
  render: (args) => <Removal {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Cedar' }));
    const next = canvas.getByRole('button', { name: 'Remove Atlas' });
    await expect(next.ownerDocument.activeElement).toBe(next);
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Project records',
    'aria-labelledby': 'external-label unresolved-label',
    'aria-describedby': 'external-description unresolved-description',
  },
  render: (args) => (
    <div>
      <span id="external-label">Records</span>
      <p id="external-description">Quarterly projects</p>
      <Table {...args} />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const root = canvasElement.querySelector('[data-ui="sortable-data-table"]')!;
    await expect(root).toHaveAttribute('aria-label', 'Project records');
    await expect(root).toHaveAttribute('aria-labelledby', 'external-label unresolved-label');
    await expect(root).toHaveAttribute('aria-describedby', 'external-description unresolved-description');
    await expect(canvas.getByRole('region')).toHaveAttribute(
      'aria-describedby',
      'external-description unresolved-description',
    );
    await expect(canvas.getByRole('table')).toHaveAccessibleName('Projects');
  },
};
export const ZeroCells: Story = {
  render: (args) => (
    <div>
      {([false, null, 0, ''] satisfies ReactNode[]).map((value, index) => (
        <Table
          {...args}
          key={index}
          caption={value}
          rows={[]}
          empty={value}
          messages={{ scrollLabel: `Content fixture ${index + 1}` }}
        />
      ))}
      <Table
        {...args}
        columns={([false, null, 0, ''] satisfies ReactNode[]).map((value, index) => ({
          id: `value-${index}`,
          header: `Value ${index + 1}`,
          cell: () => value,
        }))}
      />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement.querySelectorAll('caption')).toHaveLength(3);
    await expect(canvasElement.querySelector('caption')?.textContent).toBe('0');
    await expect(canvas.getAllByRole('cell', { name: '0' })).toHaveLength(5);
  },
};
export const ConsumerStylePrecedence: Story = {
  args: {
    slotProps: { cell: { css: { paddingInlineStart: vars.space[6] } }, sortButton: { css: { borderRadius: 0 } } },
    sx: { borderRadius: vars.radius.lg },
  },
  render: (args) => <Table {...args} css={{ borderRadius: vars.radius.sm }} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(parseFloat(getComputedStyle(canvas.getAllByRole('cell')[0]!).paddingInlineStart)).toBeCloseTo(24, 0);
    await expect(getComputedStyle(canvas.getAllByRole('button')[0]!).borderRadius).toBe('0px');
    await expect(getComputedStyle(canvasElement.querySelector('[data-ui="sortable-data-table"]')!).borderRadius).toBe(
      '18px',
    );
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { selectable: true, getRowLabel, defaultSelectedKeys: ['a'] },
};
export const RTL: Story = {
  args: { dir: 'rtl', selectable: true, getRowLabel },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('table')).direction).toBe('rtl');
    await expect(getComputedStyle(canvas.getAllByRole('cell')[2]!).textAlign).toBe('end');
  },
};
export const ForcedColors: Story = {
  args: { selectable: true, getRowLabel, defaultSelectedKeys: ['a'] },
  parameters: {
    docs: {
      description: {
        story: 'Structural high-contrast fixture. Browser media emulation is needed to verify forced-colors rendering.',
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox', { name: 'Select Atlas' })).toBeChecked();
    await expect(canvas.getByRole('checkbox', { name: 'Select all visible rows' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  },
};
export const ReducedMotion: Story = {
  args: { defaultValue: { columnId: 'name', direction: 'asc' } },
  parameters: {
    docs: {
      description: {
        story:
          'Structural reduced-motion fixture. Browser media emulation is needed to verify the media-query override; reordering is always immediate.',
      },
    },
  },
};
export const KeyboardSortingAndSelection: Story = {
  args: { selectable: true, getRowLabel, onValueChange: fn(), onSelectionChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.tab();
    const region = canvas.getByRole('region');
    await expect(region.ownerDocument.activeElement).toBe(region);
    await expect(getComputedStyle(region).outlineStyle).not.toBe('none');
    await userEvent.tab();
    const all = canvas.getByRole('checkbox', { name: 'Select all visible rows' });
    await expect(all.ownerDocument.activeElement).toBe(all);
    await userEvent.tab();
    const sort = canvas.getByRole('button', { name: 'Name: sort ascending' });
    await expect(sort.ownerDocument.activeElement).toBe(sort);
    await expect(getComputedStyle(sort).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, { columnId: 'name', direction: 'asc' });
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, { columnId: 'name', direction: 'desc' });
    await expect(sort.ownerDocument.activeElement).toBe(sort);
    await userEvent.tab({ shift: true });
    await expect(all.ownerDocument.activeElement).toBe(all);
    await userEvent.keyboard(' ');
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectionChange).toHaveBeenCalledWith(['d', 'c', 'b', 'a']);
    await userEvent.keyboard('{Escape}');
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(all).toBeChecked();
  },
};

export const CollationAndMissingValues: Story = {
  args: {
    rows: [
      { id: '10', name: 'Project 10', budget: Number.NaN, date: new Date('invalid') },
      { id: '2', name: 'Project 2', budget: 2, date: new Date('2026-01-02T00:00:00Z') },
      { id: 'empty', name: '', budget: Number.POSITIVE_INFINITY, date: new Date('invalid') },
      { id: '1', name: 'project 1', budget: 1, date: new Date('2026-01-01T00:00:00Z') },
    ],
    columns: [...columns, { id: 'date', header: 'Date', accessor: (row) => row.date }],
    onValueChange: fn(),
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['project 1', 'Project 2', 'Project 10', '—']);
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort descending' }));
    await expect(names(canvasElement)).toEqual(['Project 10', 'Project 2', 'project 1', '—']);
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['project 1', 'Project 2', 'Project 10', '—']);
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort descending' }));
    await expect(names(canvasElement)).toEqual(['Project 2', 'project 1', 'Project 10', '—']);
    await userEvent.click(canvas.getByRole('button', { name: 'Date: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['project 1', 'Project 2', 'Project 10', '—']);
    await userEvent.click(canvas.getByRole('button', { name: 'Date: sort descending' }));
    await expect(names(canvasElement)).toEqual(['Project 2', 'project 1', 'Project 10', '—']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
  },
};

export const InvalidAndDisabledSort: Story = {
  args: {
    value: { columnId: 'absent', direction: 'asc' },
    columns: [{ ...columns[0]!, sortable: false }, columns[1]!],
    onValueChange: fn(),
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(canvas.queryByRole('button', { name: /Name/ })).toBeNull();
    await userEvent.click(canvas.getByRole('columnheader', { name: 'Name' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
  },
};

export const ControlledSelection: Story = {
  args: { selectable: true, getRowLabel, onSelectionChange: fn() },
  render: (args) => <Controlled {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    const cedar = canvas.getByRole('checkbox', { name: 'Select Cedar' });
    await userEvent.click(cedar);
    await expect(cedar).toBeChecked();
    await expect(canvas.getByRole('status')).toHaveTextContent('1 of 4 visible selected; 1 selected in total');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(cedar).not.toBeChecked();
    const reset = canvas.getByRole('button', { name: 'Reset' });
    await expect(reset.ownerDocument.activeElement).toBe(reset);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectionChange).toHaveBeenCalledWith(['c']);
  },
};

function PageChanges(args: SortableDataTableProps<Project>) {
  const [pageRows, setRows] = useState(rows);
  return (
    <div>
      <Button size="sm" onClick={() => setRows(rows.slice(1))}>
        Remove first record
      </Button>
      <Table {...args} rows={pageRows} />
    </div>
  );
}
export const RangeAfterSortAndRemoval: Story = {
  args: { selectable: true, getRowLabel, onSelectionChange: fn() },
  render: (args) => <PageChanges {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Atlas' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Cedar' }));
    await userEvent.keyboard('{/Shift}');
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove first record' }));
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Delta' }));
    await userEvent.keyboard('{/Shift}');
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(3);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c', 'd']);
    await expect(canvas.getByRole('checkbox', { name: 'Select all visible rows' })).toBeChecked();
  },
};

export const NativeHandlerVeto: Story = {
  args: {
    selectable: true,
    getRowLabel,
    onValueChange: fn(),
    onSelectionChange: fn(),
    onClickCapture: (event) => event.preventDefault(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Cedar' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onSelectionChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('checkbox', { name: 'Select Cedar' })).not.toBeChecked();
  },
};

export const RefsAndHiddenCaption: Story = {
  args: { ref: fn(), tableRef: fn(), captionHidden: true },
  play: async ({ args, canvas, canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="sortable-data-table"]');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.tableRef).toHaveBeenCalledWith(canvas.getByRole('table', { name: 'Projects' }));
    await expect(canvas.getByRole('table')).toHaveAccessibleName('Projects');
    const caption = canvasElement.querySelector('caption')!;
    await expect(getComputedStyle(caption).position).toBe('absolute');
    await expect(getComputedStyle(caption).display).not.toBe('none');
  },
};
