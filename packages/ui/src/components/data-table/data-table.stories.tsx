import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { EmptyState } from '../empty-state';
import { SearchField } from '../search-field';
import { DataTable, type DataColumn, type DataTableProps, type SortState } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const SizeGrid = styled.div({ display: 'grid', gap: vars.space[4] });
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });

const NarrowFrame = styled.div({ inlineSize: 'min(100%, 280px)' });

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
const manyRows: readonly Project[] = Array.from({ length: 40 }, (_, index) => ({
  ...rows[index % rows.length]!,
  id: `project-${index}`,
  name: `Project ${index + 1}`,
}));
const getRowId = (row: Project) => row.id;
const getRowLabel = (row: Project) => row.name;
function checkConsumerTypes() {
  type Person = { id: 'alice' | 'bob'; name: string; age: number };
  const people: readonly Person[] = [{ id: 'alice', name: 'Alice', age: 30 }];
  const personColumns = [
    { id: 'name', header: 'Name', accessor: (person: Person) => person.name },
    { id: 'age', header: 'Age', accessor: (person: Person) => person.age },
  ] as const satisfies readonly DataColumn<Person, 'name' | 'age'>[];
  const base = { rows: people, columns: personColumns, getRowId: (person: Person) => person.id, caption: 'People' };
  const acceptSort = (_sort: SortState<'name' | 'age'> | null) => {};
  const acceptSortOrder = (_sort: readonly SortState<'name' | 'age'>[]) => {};
  const acceptKeys = (_keys: readonly Person['id'][]) => {};

  <DataTable {...base} defaultValue={{ columnId: 'age', direction: 'asc' }}
    onValueChange={sort => acceptSort(sort)} onSelectionChange={keys => acceptKeys(keys)} />;
  <DataTable {...base} columns={[
    { id: 'name', header: 'Name', accessor: person => person.name },
    { id: 'age', header: 'Age', accessor: person => person.age },
  ]} onValueChange={sort => acceptSort(sort)} />;
  <DataTable<Person, 'name' | 'age', string> {...base} value={{ columnId: 'name', direction: 'asc' }} />;
  // @ts-expect-error Explicit column ids reject unknown sort columns.
  <DataTable<Person, 'name' | 'age', string> {...base} value={{ columnId: 'unknown', direction: 'asc' }} />;
  // @ts-expect-error Controlled values cannot widen ids inferred from columns.
  <DataTable {...base} value={{ columnId: 'unknown', direction: 'asc' }} />;
  // @ts-expect-error Default values cannot widen ids inferred from columns.
  <DataTable {...base} defaultValue={{ columnId: 'unknown', direction: 'asc' }} />;
  // @ts-expect-error Selected keys must come from the getRowId return type.
  <DataTable {...base} selectedKeys={['unknown']} />;
  // @ts-expect-error Initial keys cannot widen the getRowId return type.
  <DataTable {...base} defaultSelectedKeys={['unknown']} />;
  // @ts-expect-error Manual sorting still requires a controlled value.
  <DataTable {...base} sortMode="manual" />;
  // @ts-expect-error Selection still requires row labels.
  <DataTable {...base} selectable />;
  <DataTable {...base} sortMode="manual" value={null} selectable getRowLabel={person => person.name} />;

  <DataTable {...base} multiSort defaultSort={[{ columnId: 'age', direction: 'desc' }, { columnId: 'name', direction: 'asc' }]}
    onSortChange={sort => acceptSortOrder(sort)} />;
  <DataTable {...base} sortMode="manual" sort={[]} selectionMode="single" getRowLabel={person => person.name} />;
  <DataTable {...base} density="comfortable" toolbar={<Button size="sm">Export</Button>} maxTableHeight={320} />;
  // @ts-expect-error Sort entries cannot widen ids inferred from columns.
  <DataTable {...base} sort={[{ columnId: 'unknown', direction: 'asc' }]} />;
  // @ts-expect-error Default sort entries cannot widen ids inferred from columns.
  <DataTable {...base} defaultSort={[{ columnId: 'unknown', direction: 'asc' }]} />;
  // @ts-expect-error Selection modes still require row labels.
  <DataTable {...base} selectionMode="multiple" />;
  // @ts-expect-error Density is a closed set.
  <DataTable {...base} density="dense" />;
  // @ts-expect-error Column alignment is a closed set.
  <DataTable {...base} columns={[{ id: 'name', header: 'Name', align: 'left' }]} />;

  const computedColumns = [
    { id: 'nameLength', header: 'Name length', accessor: (person: Person) => person.name.length },
    { id: 'adult', header: 'Adult', cell: (person: Person) => String(person.age >= 18),
      compare: (a: Person, b: Person) => a.age - b.age },
  ] as const satisfies readonly DataColumn<Person>[];
  <DataTable {...base} columns={computedColumns} defaultValue={{ columnId: 'nameLength', direction: 'asc' }} />;

  const dynamicId: string = 'remote-column';
  const dynamicColumns: readonly DataColumn<Person>[] = [{ id: dynamicId, header: 'Remote' }];
  <DataTable {...base} columns={dynamicColumns} value={{ columnId: dynamicId, direction: 'desc' }}
    onValueChange={sort => { const broad: SortState | null = sort; void broad; }} />;
  <DataTable<Person> {...base} value={{ columnId: dynamicId, direction: 'asc' }} selectedKeys={['off-page']} />;
  const legacyProps: DataTableProps<Person> = { ...base, value: { columnId: dynamicId, direction: 'asc' } };
  <DataTable {...legacyProps} />;
  const wrapperProps: DataTableProps<Person> = { ...base, sort: [{ columnId: dynamicId, direction: 'asc' }] };
  <DataTable {...wrapperProps} value={null} selectable getRowLabel={person => person.name} />;
}
void checkConsumerTypes;
const Table = (props: DataTableProps<Project>) => <DataTable {...props} />;
Table.displayName = 'DataTable';

const projectSetup = `interface Project {
  id: string;
  name: string;
  budget: number | null;
}

const projects: Project[] = [
  { id: 'c', name: 'Cedar', budget: 40 },
  { id: 'a', name: 'Atlas', budget: 0 },
  { id: 'b', name: 'Birch', budget: 40 },
  { id: 'd', name: 'Delta', budget: null },
];

const columns: DataColumn<Project>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name },
  { id: 'budget', header: 'Budget', accessor: (row) => row.budget, numeric: true },
];`;
// Docs parameters for a story: the authored snippet and, for listed examples, a description.
const docs = (code: string, story?: string) => ({
  docs: { ...(story ? { description: { story } } : {}), source: { language: 'tsx', code } },
});
// A standalone projects example around one DataTable element.
const projectExample = (props: string, imports = '') => `${imports}import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

<DataTable
  caption="Projects"
  locale="en-US"
  timeZone="UTC"
  rows={projects}
  columns={columns}
  getRowId={(row) => row.id}${props}
/>`;

const meta = {
  title: 'Data/DataTable',
  component: Table,
  tags: ['autodocs'],
  args: { rows, columns, getRowId, caption: 'Projects', locale: 'en-US', timeZone: 'UTC' },
  parameters: {
    docs: {
      description: {
        component: 'Sort, select, and scan records in a table.',
      },
      sections: [
        { title: 'Basic', stories: ['Default', 'Density', 'MinimumTableWidth'] },
        { title: 'Sorting', stories: ['Ascending', 'MultiColumnSort', 'CustomComparator'] },
        { title: 'Row selection', stories: ['Selection', 'SingleSelection', 'MixedSelection'] },
        { title: 'Columns and layout', stories: ['ColumnLayout', 'Toolbar', 'StickyHeader'] },
        { title: 'Formatting', stories: ['CustomCells', 'LocaleNumbersAndDates'] },
        { title: 'States', stories: ['Loading', 'Empty', 'EmptyWithAction'] },
      ],
      usage: `### Sorting and data
- Activating a sort button alternates its column between ascending and descending. Set a controlled \`sort\` to \`[]\` to return to input order.
- With \`multiSort\`, each activation cycles a column through ascending, descending, and removed. A newly sorted column joins at the lowest priority, and a number beside each sorted heading shows its priority.
- Manual sorting leaves row ordering to you and requires a controlled \`sort\`.
- Columns with non-text headings need a \`sortLabel\`. Columns returning mixed accessor types need a \`compare\` function.
- Selection, focus, and rendering follow \`getRowId\`, so a selected row stays selected when rows reorder or reload.
- Set an explicit locale and time zone for deterministic date and number formatting across SSR and hydration.
- Use bounded collections and add Pagination outside the table. Grid navigation, editing, and virtualization are not supported.

### Row selection
- \`selectionMode="single"\` keeps at most one row selected. Checking another row replaces it.
- \`selectionMode="multiple"\` adds Shift range selection and a header checkbox that selects or clears every visible row.

### Keyboard and accessibility
- Tab moves through the toolbar controls, the scroller, the sort buttons, and the row checkboxes.
- Press Enter or Space on a sort button to change its column's sort. The primary sorted heading carries \`aria-sort\`; the other sort buttons name their direction and priority.
- Press Space on a row checkbox to toggle the row. Selectable rows expose \`aria-selected\`.
- Sort, selection, loading, and empty results are announced in a polite live region. Focus stays where it is.`,
    },
  },
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;
// The last tbody holds the records; a loading row renders in its own tbody before it.
const bodyRows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody:last-of-type tr'));
const names = (element: HTMLElement) =>
  bodyRows(element).map((row) => row.querySelectorAll('td')[row.querySelector('input') ? 1 : 0]?.textContent);
const sortedHeader = (element: HTMLElement) => element.querySelector('th[aria-sort]');
const statusRegion = (element: HTMLElement) => element.querySelector<HTMLElement>('[role="status"]')!;

export const Default: Story = {
  name: 'Projects table',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function ProjectsTable() {
  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
    />
  );
}`, 'Display tabular data with column sorting and a table caption.'),
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Projects' }).tagName).toBe('TABLE');
    await expect(canvasElement.querySelector('thead')?.tagName).toBe('THEAD');
    await expect(canvasElement.querySelector('tbody')?.tagName).toBe('TBODY');
    for (const header of canvas.getAllByRole('columnheader')) await expect(header).toHaveAttribute('scope', 'col');
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    for (const row of bodyRows(canvasElement)) await expect(row).not.toHaveAttribute('aria-selected');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await expect(canvasElement.querySelector('[data-ui="data-table-toolbar"]')).toBeNull();
    for (const button of canvas.getAllByRole('button')) {
      const style = getComputedStyle(button);
      await expect(style.borderStyle).toBe('none');
      await expect(style.borderRadius).toBe('0px');
      await expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      await expect(style.paddingInlineStart).toBe('0px');
      const indicator = button.querySelector('svg')!;
      await expect(indicator).toHaveAttribute('aria-hidden', 'true');
      await expect(indicator).not.toHaveAttribute('data-direction');
      for (const chevron of indicator.children) await expect(getComputedStyle(chevron).visibility).toBe('visible');
    }
  },
};
export const Unsorted: Story = {
  parameters: docs(projectExample(`
  sort={[]}`)),
  args: { sort: [] },
};
export const Ascending: Story = {
  name: 'Initial sort order',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function InitialSortTable() {
  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
      defaultSort={[{ columnId: 'name', direction: 'asc' }]}
    />
  );
}`, 'Set an initial sort column and direction with defaultSort.'),
  args: { defaultSort: [{ columnId: 'name', direction: 'asc' }] },
  play: async ({ canvasElement }) => {
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Cedar', 'Delta']);
    await expect(sortedHeader(canvasElement)).toHaveAttribute('aria-sort', 'ascending');
  },
};
export const Descending: Story = {
  parameters: docs(projectExample(`
  defaultSort={[{ columnId: 'name', direction: 'desc' }]}`)),
  args: { defaultSort: [{ columnId: 'name', direction: 'desc' }] },
};
export const MultiColumnSort: Story = {
  name: 'Multi-column sort',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function MultiSortTable() {
  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
      multiSort
      defaultSort={[
        { columnId: 'budget', direction: 'desc' },
        { columnId: 'name', direction: 'asc' },
      ]}
    />
  );
}`, 'Sort by budget, then by name. Activate a heading to cycle it through ascending, descending, and removed.'),
  args: {
    multiSort: true,
    defaultSort: [{ columnId: 'budget', direction: 'desc' }, { columnId: 'name', direction: 'asc' }],
    onSortChange: fn(),
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const [nameHeader, budgetHeader] = Array.from(canvasElement.querySelectorAll('th'));
    const priorities = () => Array.from(canvasElement.querySelectorAll('[data-ui="data-table-sort-priority"]'));
    await expect(names(canvasElement)).toEqual(['Birch', 'Cedar', 'Atlas', 'Delta']);
    // ARIA allows aria-sort on one header: the primary column.
    await expect(budgetHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(nameHeader).not.toHaveAttribute('aria-sort');
    await expect(priorities().map((marker) => marker.textContent)).toEqual(['2', '1']);
    for (const marker of priorities()) {
      await expect(marker).toBeVisible();
      await expect(marker).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(canvas.getByRole('button', { name: 'Budget, descending, priority 1: remove sort' })).toBeVisible();
    for (const marker of priorities()) await expect(marker.closest('button')).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Name, ascending, priority 2: sort descending' }));
    await expect(args.onSortChange).toHaveBeenLastCalledWith([
      { columnId: 'budget', direction: 'desc' },
      { columnId: 'name', direction: 'desc' },
    ]);
    await expect(names(canvasElement)).toEqual(['Cedar', 'Birch', 'Atlas', 'Delta']);
    await expect(statusRegion(canvasElement)).toHaveTextContent('Budget, descending and Name, descending');

    await userEvent.click(canvas.getByRole('button', { name: 'Name, descending, priority 2: remove sort' }));
    await expect(args.onSortChange).toHaveBeenLastCalledWith([{ columnId: 'budget', direction: 'desc' }]);
    await expect(names(canvasElement)).toEqual(['Cedar', 'Birch', 'Atlas', 'Delta']);
    await expect(priorities()).toHaveLength(0);
    await expect(statusRegion(canvasElement)).toHaveTextContent('Budget, descending');

    // Focus stays on the activated button; leave for the scroller and Tab back in from the keyboard.
    const nameSort = canvas.getByRole('button', { name: 'Name: sort ascending' });
    await expect(nameSort.ownerDocument.activeElement).toBe(nameSort);
    await userEvent.tab({ shift: true });
    await expect(nameSort.ownerDocument.activeElement).toBe(canvas.getByRole('region'));
    await userEvent.tab();
    await expect(nameSort.ownerDocument.activeElement).toBe(nameSort);
    await expect(getComputedStyle(nameSort).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSortChange).toHaveBeenLastCalledWith([
      { columnId: 'budget', direction: 'desc' },
      { columnId: 'name', direction: 'asc' },
    ]);
    await expect(names(canvasElement)).toEqual(['Birch', 'Cedar', 'Atlas', 'Delta']);
    await expect(nameSort.ownerDocument.activeElement).toBe(nameSort);
    await expect(statusRegion(canvasElement)).toHaveTextContent('Budget, descending and Name, ascending');
    await expect(args.onSortChange).toHaveBeenCalledTimes(3);
  },
};
export const Density: Story = {
  name: 'Row density',
  parameters: docs(`import { DataTable, type DataColumn, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

${projectSetup}

const Stack = styled.div({
  display: 'grid',
  gap: vars.space[4],
});

export function TableDensities() {
  return (
    <Stack>
      {(['compact', 'standard', 'comfortable'] as const).map((density) => (
        <DataTable
          key={density}
          density={density}
          caption={\`\${density} projects\`}
          locale="en-US"
          timeZone="UTC"
          rows={projects}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          selectionMode="multiple"
        />
      ))}
    </Stack>
  );
}`, 'Set row height with density: compact, standard, or comfortable.'),
  args: { selectionMode: 'multiple', getRowLabel },
  render: (args) => (
    <SizeGrid>
      <Table {...args} density="compact" caption="Compact projects" messages={{ scrollLabel: 'Compact projects scroller' }} />
      <Table {...args} density="standard" caption="Standard projects" messages={{ scrollLabel: 'Standard projects scroller' }} />
      <Table {...args} density="comfortable" caption="Comfortable projects" messages={{ scrollLabel: 'Comfortable projects scroller' }} />
    </SizeGrid>
  ),
  play: async ({ canvas }) => {
    // Content height from the space scale plus the 1px row divider.
    for (const [caption, content] of [['Compact projects', 32], ['Standard projects', 40], ['Comfortable projects', 48]] as const) {
      const table = canvas.getByRole('table', { name: caption });
      await expect(table.querySelectorAll('thead tr')).toHaveLength(1);
      const bodyRows = table.querySelectorAll('tbody tr');
      await expect(bodyRows).toHaveLength(rows.length);
      for (const row of table.querySelectorAll('tr')) await expect(row.getBoundingClientRect().height).toBe(content + 1);
    }
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(31.5);
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(31.5);
    }
  },
};
export const StableNumericSorting: Story = {
  parameters: docs(projectExample(`
  onSortChange={(sort) => console.log('Sort changed:', sort)}`)),
  args: { onSortChange: fn() },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['Atlas', 'Cedar', 'Birch', 'Delta']);
    await expect(sortedHeader(canvasElement)).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort descending' }));
    await expect(names(canvasElement)).toEqual(['Cedar', 'Birch', 'Atlas', 'Delta']);
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['Atlas', 'Cedar', 'Birch', 'Delta']);
    await expect(args.onSortChange).toHaveBeenCalledTimes(3);
    await expect(args.onSortChange).toHaveBeenNthCalledWith(1, [{ columnId: 'budget', direction: 'asc' }]);
    await expect(args.onSortChange).toHaveBeenNthCalledWith(2, [{ columnId: 'budget', direction: 'desc' }]);
    await expect(args.onSortChange).toHaveBeenNthCalledWith(3, [{ columnId: 'budget', direction: 'asc' }]);
    await expect(rows.map((row) => row.id)).toEqual(['c', 'a', 'b', 'd']);
    await expect(canvasElement.querySelectorAll('th[aria-sort]')).toHaveLength(1);
    await expect(canvasElement.querySelector('[data-ui="data-table-sort-priority"]')).toBeNull();
    // Numeric headers align with their end-aligned cells: the inline-flex sort control is pushed to the end.
    const numericHeader = canvasElement.querySelector<HTMLElement>('th[data-numeric]')!;
    await expect(getComputedStyle(numericHeader.querySelector('button')!).justifyContent).toBe('flex-end');
  },
};
function Controlled({ onSortChange, onSelectionChange, ...args }: DataTableProps<Project>) {
  const [sort, setSort] = useState<readonly SortState[]>([]);
  const [selectedKeys, setKeys] = useState<readonly string[]>([]);
  return (
    <div>
      <Button
        size="sm"
        onClick={() => {
          setSort([]);
          setKeys([]);
        }}
      >
        Reset
      </Button>
      <Table
        {...args}
        sort={sort}
        selectedKeys={selectedKeys}
        onSortChange={(next) => {
          onSortChange?.(next);
          setSort(next);
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
  args: { onSortChange: fn() },
  render: (args) => <Controlled {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Cedar', 'Delta']);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await expect(statusRegion(canvasElement)).toHaveTextContent('Original order');
    await expect(args.onSortChange).toHaveBeenCalledTimes(1);
  },
};
export const RejectedSort: Story = {
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function LockedSortTable() {
  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
      sort={[]}
      onSortChange={(next) => console.log('Requested sort:', next)}
    />
  );
}`),
  args: { sort: [], multiSort: true, onSortChange: fn() },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await expect(args.onSortChange).toHaveBeenCalledTimes(1);
    await expect(args.onSortChange).toHaveBeenCalledWith([{ columnId: 'name', direction: 'asc' }]);
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Name: sort ascending' })).toBeVisible();
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const ManualServerSort: Story = {
  args: { sortMode: 'manual', sort: [], onSortChange: fn() },
  render: (args) => <Controlled {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await expect(args.onSortChange).toHaveBeenCalledTimes(1);
    await expect(args.onSortChange).toHaveBeenCalledWith([{ columnId: 'name', direction: 'asc' }]);
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await expect(sortedHeader(canvasElement)).toHaveAttribute('aria-sort', 'ascending');
  },
};
export const Selection: Story = {
  name: 'Row selection',
  parameters: docs(`import { useState } from 'react';
import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function SelectableTable() {
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);

  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
    />
  );
}`, 'Enable row checkboxes and a select-all header control for batch actions.'),
  args: { selectionMode: 'multiple', getRowLabel, onSelectionChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    const cedar = canvas.getByRole('checkbox', { name: 'Select Cedar' });
    await userEvent.click(cedar);
    await expect(cedar.closest('tr')).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('checkbox', { name: 'Select Atlas' }).closest('tr')).toHaveAttribute('aria-selected', 'false');
    const all = canvas.getByRole('checkbox', { name: 'Select all visible rows' });
    await expect(all).toHaveAttribute('aria-checked', 'mixed');
    await expect((all as HTMLInputElement).indeterminate).toBe(true);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['c']);
    await userEvent.click(all);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(2);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['c', 'a', 'b', 'd']);
    await expect(all).toBeChecked();
    await expect(all).not.toHaveAttribute('aria-checked');
    await expect((all as HTMLInputElement).indeterminate).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Clear selection' }));
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(3);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith([]);
    await expect(all.ownerDocument.activeElement).toBe(all);
    await expect(all).not.toBeChecked();
  },
};
export const SingleSelection: Story = {
  name: 'Single row selection',
  parameters: docs(`import { useState } from 'react';
import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function SingleSelectTable() {
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);

  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      selectionMode="single"
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
    />
  );
}`, 'Select one row at a time. Checking another row replaces the selection.'),
  args: { selectionMode: 'single', getRowLabel, onSelectionChange: fn() },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(canvas.queryByRole('checkbox', { name: 'Select all visible rows' })).toBeNull();
    await expect(canvas.getAllByRole('columnheader')[0]).toHaveTextContent('Select');
    const cedar = canvas.getByRole('checkbox', { name: 'Select Cedar' });
    const atlas = canvas.getByRole('checkbox', { name: 'Select Atlas' });
    await userEvent.click(cedar);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['c']);
    await expect(cedar.closest('tr')).toHaveAttribute('aria-selected', 'true');
    await userEvent.tab();
    await expect(atlas.ownerDocument.activeElement).toBe(atlas);
    await expect(getComputedStyle(atlas.nextElementSibling!).outlineStyle).not.toBe('none');
    await userEvent.keyboard(' ');
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['a']);
    await expect(cedar).not.toBeChecked();
    await expect(cedar.closest('tr')).toHaveAttribute('aria-selected', 'false');
    await expect(atlas.closest('tr')).toHaveAttribute('aria-selected', 'true');
    await expect(canvasElement.querySelectorAll('tbody tr[aria-selected="true"]')).toHaveLength(1);
    await userEvent.keyboard(' ');
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith([]);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(3);
    await expect(canvasElement.querySelectorAll('tbody tr[aria-selected="true"]')).toHaveLength(0);
  },
};
export const MixedSelection: Story = {
  name: 'Pre-selected rows',
  parameters: docs(projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  defaultSelectedKeys={['a']}`), 'Initialize row selections with an indeterminate state on the select-all checkbox.'),
  args: { selectionMode: 'multiple', getRowLabel, defaultSelectedKeys: ['a'] },
};
export const RejectedSelection: Story = {
  parameters: docs(projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  selectedKeys={['a']}
  onSelectionChange={(next) => console.log('Requested selection:', next)}`)),
  args: { selectionMode: 'multiple', getRowLabel, selectedKeys: ['a'], onSelectionChange: fn() },
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
  parameters: docs(projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  defaultSort={[{ columnId: 'name', direction: 'asc' }]}`)),
  args: {
    selectionMode: 'multiple',
    getRowLabel,
    onSelectionChange: fn(),
    defaultSort: [{ columnId: 'name', direction: 'asc' }],
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
  parameters: docs(projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  defaultSelectedKeys={['off-page']}`)),
  args: { selectionMode: 'multiple', getRowLabel, defaultSelectedKeys: ['off-page', 'off-page'], onSelectionChange: fn() },
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
function Reloading(args: DataTableProps<Project>) {
  const [currentRows, setRows] = useState(rows);
  return (
    <SizeGrid>
      <Controls>
        <Button size="sm" onClick={() => setRows(rows.slice(1).reverse().map((row) => ({ ...row })))}>
          Reload projects
        </Button>
      </Controls>
      <Table {...args} rows={currentRows} />
    </SizeGrid>
  );
}
export const SelectionFollowsRowId: Story = {
  args: { selectionMode: 'multiple', getRowLabel, defaultSelectedKeys: ['a'], onSelectionChange: fn() },
  render: (args) => <Reloading {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Birch' }));
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['a', 'b']);
    // Fresh objects in a new order, with the first record gone: selection stays on the same ids.
    await userEvent.click(canvas.getByRole('button', { name: 'Reload projects' }));
    await expect(names(canvasElement)).toEqual(['Delta', 'Birch', 'Atlas']);
    for (const name of ['Atlas', 'Birch']) {
      const checkbox = canvas.getByRole('checkbox', { name: `Select ${name}` });
      await expect(checkbox).toBeChecked();
      await expect(checkbox.closest('tr')).toHaveAttribute('aria-selected', 'true');
    }
    await expect(canvas.getByRole('checkbox', { name: 'Select Delta' })).not.toBeChecked();
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    const all = canvas.getByRole('checkbox', { name: 'Select all visible rows' });
    await expect(all).toHaveAttribute('aria-checked', 'mixed');
    await userEvent.click(all);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'd']);
    await expect(all).toBeChecked();
  },
};
export const Empty: Story = {
  name: 'Empty records',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

<DataTable
  caption="Projects"
  locale="en-US"
  timeZone="UTC"
  rows={[]}
  columns={columns}
  getRowId={(row: Project) => row.id}
  getRowLabel={(row: Project) => row.name}
  selectionMode="multiple"
/>`, 'Show an empty state message across all table columns when rows is empty.'),
  args: { rows: [], selectionMode: 'multiple', getRowLabel },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('cell', { name: 'No records' })).toHaveAttribute('colspan', '3');
    await expect(canvas.getByRole('checkbox')).toBeDisabled();
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const EmptyWithAction: Story = {
  name: 'Custom empty state',
  parameters: docs(`import { Button, EmptyState, DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

<DataTable
  caption="Projects"
  locale="en-US"
  timeZone="UTC"
  rows={[]}
  columns={columns}
  getRowId={(row: Project) => row.id}
  empty={<EmptyState variant="inline" title="No projects" action={<Button size="sm">New project</Button>} />}
/>`, 'Render your own empty content, such as an EmptyState with an action.'),
  args: {
    rows: [],
    empty: <EmptyState variant="inline" title="No projects" action={<Button size="sm">New project</Button>} />,
  },
  play: async ({ canvas }) => {
    const cell = canvas.getByRole('heading', { name: 'No projects' }).closest('td')!;
    await expect(cell).toHaveAttribute('colspan', '2');
    await expect(canvas.getByRole('button', { name: 'New project' })).toBeVisible();
  },
};
export const Loading: Story = {
  name: 'Loading state',
  parameters: docs(projectExample(`
  loading`), 'Show a loading row, mark the table busy, and announce the load while rows stay in place.'),
  args: { loading: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    const loadingRow = canvasElement.querySelector('[data-ui="data-table-loading"]')!;
    await expect(loadingRow).toHaveTextContent('Loading records');
    await expect(loadingRow.querySelector('td')).toHaveAttribute('colspan', '2');
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Loading records'));
  },
};
function LoadingCycle(args: DataTableProps<Project>) {
  const [state, setState] = useState<{ loading: boolean; rows: readonly Project[] }>({ loading: false, rows });
  return (
    <SizeGrid>
      <Controls>
        <Button size="sm" onClick={() => setState((current) => ({ ...current, loading: true }))}>Refresh</Button>
        <Button size="sm" onClick={() => setState({ loading: false, rows })}>Finish</Button>
        <Button size="sm" onClick={() => setState({ loading: false, rows: [] })}>Finish empty</Button>
      </Controls>
      <Table {...args} rows={state.rows} loading={state.loading} />
    </SizeGrid>
  );
}
export const LoadingAnnouncements: Story = {
  render: (args) => <LoadingCycle {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const table = canvas.getByRole('table');
    const status = statusRegion(canvasElement);
    const refresh = canvas.getByRole('button', { name: 'Refresh' });
    await expect(status).toBeEmptyDOMElement();
    await userEvent.click(refresh);
    await expect(status).toHaveTextContent('Loading records');
    await expect(table).toHaveAttribute('aria-busy', 'true');
    await expect(refresh.ownerDocument.activeElement).toBe(refresh);
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await userEvent.click(canvas.getByRole('button', { name: 'Finish' }));
    await expect(status).toHaveTextContent('Records loaded');
    await expect(table).not.toHaveAttribute('aria-busy');
    await expect(canvasElement.querySelector('[data-ui="data-table-loading"]')).toBeNull();
    await userEvent.click(refresh);
    const finishEmpty = canvas.getByRole('button', { name: 'Finish empty' });
    await userEvent.click(finishEmpty);
    await expect(status).toHaveTextContent('No records');
    await expect(canvas.getByRole('cell', { name: 'No records' })).toBeVisible();
    await expect(finishEmpty.ownerDocument.activeElement).toBe(finishEmpty);
  },
};
export const CustomCells: Story = {
  name: 'Custom cell content',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

interface Project {
  id: string;
  name: string;
  budget: number | null;
}

const projects: Project[] = [
  { id: 'c', name: 'Cedar', budget: 40 },
  { id: 'a', name: 'Atlas', budget: 0 },
  { id: 'b', name: 'Birch', budget: 40 },
  { id: 'd', name: 'Delta', budget: null },
];

const columns: DataColumn<Project>[] = [
  {
    id: 'name',
    header: 'Name',
    accessor: (row) => row.name,
    cell: (row) => <strong>{row.name}</strong>,
  },
  {
    id: 'budget',
    header: 'Budget',
    accessor: (row) => row.budget,
    numeric: true,
    cell: (row) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.budget ?? 0),
  },
];

export function CustomCellTable() {
  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
    />
  );
}`, 'Format cell values with custom components, formatted typography, and currency symbols.'),
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
  name: 'Custom comparator',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

interface Project {
  id: string;
  name: string;
  budget: number | null;
}

const projects: Project[] = [
  { id: 'c', name: 'Cedar gardens', budget: 40 },
  { id: 'a', name: 'Atlas', budget: 0 },
  { id: 'b', name: 'Birch', budget: 40 },
  { id: 'd', name: 'Delta', budget: null },
];

const columns: DataColumn<Project>[] = [
  {
    id: 'name',
    header: <span>Project length</span>,
    sortLabel: 'Project length',
    compare: (a, b) => a.name.length - b.name.length,
    cell: (row) => row.name,
  },
];

export function CustomComparatorTable() {
  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
      defaultSort={[{ columnId: 'name', direction: 'asc' }]}
    />
  );
}`, 'Sort rows using a custom comparison function for complex or computed criteria.'),
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
    defaultSort: [{ columnId: 'name', direction: 'asc' }],
  },
  play: async ({ canvasElement }) => {
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Delta', 'Cedar gardens']);
  },
};
export const LocaleNumbersAndDates: Story = {
  name: 'Locale date and number formatting',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

interface Project {
  id: string;
  name: string;
  budget: number | null;
  date: Date;
}

const projects: Project[] = [
  { id: 'c', name: 'Cedar', budget: 40, date: new Date('2026-03-03T12:00:00Z') },
  { id: 'a', name: 'Atlas', budget: 0, date: new Date('2026-01-01T12:00:00Z') },
  { id: 'b', name: 'Birch', budget: 40, date: new Date('2026-02-02T12:00:00Z') },
  { id: 'd', name: 'Delta', budget: null, date: new Date('2026-04-04T12:00:00Z') },
];

const columns: DataColumn<Project>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name },
  { id: 'budget', header: 'Budget', accessor: (row) => row.budget, numeric: true },
  { id: 'date', header: 'Date', accessor: (row) => row.date },
];

export function LocalizedTable() {
  return (
    <DataTable
      caption="Projects"
      locale="de-DE"
      timeZone="UTC"
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
      defaultSort={[{ columnId: 'date', direction: 'asc' }]}
    />
  );
}`, 'Format dates and numbers automatically according to the specified locale.'),
  args: {
    locale: 'de-DE',
    columns: [...columns, { id: 'date', header: 'Date', accessor: (row) => row.date }],
    defaultSort: [{ columnId: 'date', direction: 'asc' }],
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Cedar', 'Delta']);
    await expect(
      canvas.getByRole('cell', { name: new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' }).format(rows[1]!.date) }),
    ).toBeVisible();
  },
};
export const ColumnLayout: Story = {
  name: 'Column alignment and widths',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

interface Project {
  id: string;
  name: string;
  budget: number | null;
  date: Date;
}

const projects: Project[] = [
  { id: 'c', name: 'Cedar', budget: 40, date: new Date('2026-03-03T12:00:00Z') },
  { id: 'a', name: 'Atlas', budget: 0, date: new Date('2026-01-01T12:00:00Z') },
  { id: 'b', name: 'Birch', budget: 40, date: new Date('2026-02-02T12:00:00Z') },
  { id: 'd', name: 'Delta', budget: null, date: new Date('2026-04-04T12:00:00Z') },
];

const columns: DataColumn<Project>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name, width: '40%' },
  { id: 'date', header: 'Started', accessor: (row) => row.date, align: 'center', minWidth: 160 },
  { id: 'budget', header: 'Budget', accessor: (row) => row.budget, numeric: true },
];

<DataTable
  caption="Projects"
  locale="en-US"
  timeZone="UTC"
  rows={projects}
  columns={columns}
  getRowId={(row) => row.id}
/>`, 'Align each column and give it a width or a minimum width. Numeric columns align to the end.'),
  args: {
    columns: [
      { id: 'name', header: 'Name', accessor: (row) => row.name, width: '40%' },
      { id: 'date', header: 'Started', accessor: (row) => row.date, align: 'center', minWidth: 160 },
      { id: 'budget', header: 'Budget', accessor: (row) => row.budget, numeric: true },
    ],
  },
  play: async ({ canvasElement }) => {
    const [name, date, budget] = Array.from(canvasElement.querySelectorAll('th'));
    const firstRow = bodyRows(canvasElement)[0]!.querySelectorAll('td');
    await expect(getComputedStyle(name!).textAlign).toBe('start');
    await expect(getComputedStyle(date!).textAlign).toBe('center');
    await expect(getComputedStyle(date!.querySelector('button')!).justifyContent).toBe('center');
    await expect(getComputedStyle(firstRow[1]!).textAlign).toBe('center');
    await expect(getComputedStyle(date!).minInlineSize).toBe('160px');
    await expect(date!.getBoundingClientRect().width).toBeGreaterThanOrEqual(160);
    await expect(getComputedStyle(budget!).textAlign).toBe('end');
    await expect(getComputedStyle(firstRow[2]!).textAlign).toBe('end');
    await expect(getComputedStyle(firstRow[2]!).fontVariantNumeric).toBe('tabular-nums');
    await expect(canvasElement.querySelector('col')!.style.width).toBe('40%');
  },
};
function ToolbarExample(args: DataTableProps<Project>) {
  const [projects, setProjects] = useState(rows);
  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const visible = projects.filter((project) => project.name.toLocaleLowerCase('en-US').includes(query.toLocaleLowerCase('en-US')));
  return (
    <Table
      {...args}
      rows={visible}
      selectionMode="multiple"
      getRowLabel={getRowLabel}
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
      toolbar={
        <>
          <SearchField label="Filter projects" labelPlacement="hidden" size="sm" value={query} onValueChange={setQuery} />
          <Button
            size="sm"
            disabled={selectedKeys.length === 0}
            onClick={() => {
              setProjects((current) => current.filter((project) => !selectedKeys.includes(project.id)));
              setSelectedKeys([]);
            }}
          >
            Archive selected
          </Button>
        </>
      }
    />
  );
}
export const Toolbar: Story = {
  name: 'Toolbar',
  parameters: docs(`import { useState } from 'react';
import { Button, SearchField, DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function ProjectsWithToolbar() {
  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const visible = projects.filter((project) =>
    project.name.toLocaleLowerCase('en-US').includes(query.toLocaleLowerCase('en-US')),
  );

  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={visible}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
      toolbar={
        <>
          <SearchField label="Filter projects" labelPlacement="hidden" size="sm" value={query} onValueChange={setQuery} />
          <Button size="sm" disabled={selectedKeys.length === 0}>
            Archive selected
          </Button>
        </>
      }
    />
  );
}`, 'Put filters and bulk actions above the table with toolbar.'),
  render: (args) => <ToolbarExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>('[data-ui="data-table-toolbar"]')!;
    const scroller = canvas.getByRole('region');
    await expect(toolbar.getBoundingClientRect().bottom).toBeLessThanOrEqual(scroller.getBoundingClientRect().top);
    const search = canvas.getByRole('searchbox', { name: 'Filter projects' });
    await expect(toolbar).toContainElement(search);
    const archive = canvas.getByRole('button', { name: 'Archive selected' });
    await expect(archive).toBeDisabled();
    await userEvent.type(search, 'zz');
    await expect(canvas.getByRole('cell', { name: 'No records' })).toBeVisible();
    await expect(statusRegion(canvasElement)).toHaveTextContent('No records');
    await expect(search.ownerDocument.activeElement).toBe(search);
    await userEvent.clear(search);
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Atlas' }));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Birch' }));
    await userEvent.click(archive);
    await expect(names(canvasElement)).toEqual(['Cedar', 'Delta']);
    await expect(archive).toBeDisabled();
  },
};
export const StickyHeader: Story = {
  name: 'Sticky header',
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

interface Project {
  id: string;
  name: string;
  budget: number;
}

const projects: Project[] = Array.from({ length: 40 }, (_, index) => ({
  id: \`project-\${index}\`,
  name: \`Project \${index + 1}\`,
  budget: (index % 5) * 10,
}));

const columns: DataColumn<Project>[] = [
  { id: 'name', header: 'Name', accessor: (row) => row.name },
  { id: 'budget', header: 'Budget', accessor: (row) => row.budget, numeric: true },
];

<DataTable
  caption="Projects"
  locale="en-US"
  timeZone="UTC"
  rows={projects}
  columns={columns}
  getRowId={(row) => row.id}
  maxTableHeight={280}
/>`, 'Limit the height with maxTableHeight. Rows scroll under the header, which gains a divider and shadow once content is under it.'),
  args: { rows: manyRows, maxTableHeight: 280 },
  play: async ({ canvas, canvasElement }) => {
    const scroller = canvas.getByRole('region');
    const headers = Array.from(canvasElement.querySelectorAll('th'));
    await expect(getComputedStyle(scroller).maxBlockSize).toBe('280px');
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    for (const header of headers) await expect(header).not.toHaveAttribute('data-scrolled');
    const restingBorder = getComputedStyle(headers[0]!).borderBlockEndColor;
    await expect(getComputedStyle(headers[0]!).boxShadow).toBe('none');
    scroller.scrollTop = 200;
    await waitFor(() => expect(headers[0]).toHaveAttribute('data-scrolled'));
    for (const header of headers) await expect(header).toHaveAttribute('data-scrolled');
    await waitFor(() => expect(getComputedStyle(headers[0]!).borderBlockEndColor).not.toBe(restingBorder));
    await expect(getComputedStyle(headers[0]!).boxShadow).not.toBe('none');
    await expect(headers[0]!.getBoundingClientRect().top)
      .toBeCloseTo(scroller.getBoundingClientRect().top + scroller.clientTop, 0);
    scroller.scrollTop = 0;
    await waitFor(() => expect(headers[0]).not.toHaveAttribute('data-scrolled'));
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
    <NarrowFrame>
      <Table {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvas, canvasElement }) => {
    const scroller = canvas.getByRole('region');
    const root = canvasElement.querySelector('[data-ui="data-table"]')!;
    await expect(scroller.getBoundingClientRect().width).toBeLessThanOrEqual(root.getBoundingClientRect().width + 1);
    await expect(getComputedStyle(canvas.getAllByRole('cell')[0]!).overflowWrap).toBe('anywhere');
    await expect(getComputedStyle(canvas.getAllByRole('cell')[1]!).textAlign).toBe('end');
    await expect(canvas.getAllByRole('cell')[0]!.getBoundingClientRect().height).toBeGreaterThan(60);
  },
};
export const LongHeaders: Story = {
  args: {
    columns: [
      { ...columns[0]!, header: 'Project_identifier_with_a_long_unbroken_heading' },
      { ...columns[1]!, header: 'Allocated project budget' },
    ],
  },
  render: (args) => (
    <NarrowFrame>
      <Table {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvas }) => {
    const scroller = canvas.getByRole('region');
    const headerRow = canvas.getByRole('table').querySelector('thead')!;
    // Scroll padding clears the header plus space[2] for a focused control's ring.
    const ringClearance = 8;
    await waitFor(async () => {
      await expect(parseFloat(getComputedStyle(scroller).scrollPaddingBlockStart))
        .toBeCloseTo(headerRow.getBoundingClientRect().height + ringClearance, 0);
    });
    const frame = scroller.parentElement!.parentElement!;
    frame.style.inlineSize = '180px';
    await waitFor(async () => {
      await expect(parseFloat(getComputedStyle(scroller).scrollPaddingBlockStart))
        .toBeCloseTo(headerRow.getBoundingClientRect().height + ringClearance, 0);
    });
    frame.style.removeProperty('inline-size');
    for (const header of canvas.getAllByRole('columnheader')) {
      const button = header.querySelector('button')!;
      const indicator = button.querySelector('svg')!;
      await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + 1);
      await expect(indicator.getBoundingClientRect().right).toBeLessThanOrEqual(header.getBoundingClientRect().right);
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
  },
};
export const ScrollableRows: Story = {
  args: {
    rows: manyRows,
    selectionMode: 'multiple',
    getRowLabel,
    slotProps: { scroller: { sx: { maxBlockSize: 280 } }, table: { sx: { minInlineSize: 560 } } },
  },
  render: (args) => (
    <NarrowFrame>
      <Table {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvas, userEvent }) => {
    const scroller = canvas.getByRole('region');
    const table = canvas.getByRole('table');
    const target = canvas.getByRole('checkbox', { name: 'Select Project 21' });
    target.focus();
    for (let index = 20; index >= 15; index--) {
      await userEvent.tab({ shift: true });
      const checkbox = canvas.getByRole('checkbox', { name: `Select Project ${index}` });
      await expect(checkbox.ownerDocument.activeElement).toBe(checkbox);
      const header = table.querySelector('th')!.getBoundingClientRect();
      await expect(checkbox.getBoundingClientRect().top).toBeGreaterThanOrEqual(header.bottom);
    }
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    await expect(table.querySelector('th')!.getBoundingClientRect().top)
      .toBeCloseTo(scroller.getBoundingClientRect().top + scroller.clientTop, 0);
    const headers = table.querySelectorAll('th');
    const cells = table.querySelectorAll('tbody tr:first-child td');
    for (let index = 0; index < headers.length; index++) {
      await expect(headers[index]!.getBoundingClientRect().left)
        .toBeCloseTo(cells[index]!.getBoundingClientRect().left, 0);
      await expect(headers[index]!.getBoundingClientRect().width)
        .toBeCloseTo(cells[index]!.getBoundingClientRect().width, 0);
    }
    scroller.scrollLeft = 100;
    await expect(scroller.scrollLeft).toBeGreaterThan(0);
  },
};
export const ScrollableRowsRTL: Story = {
  ...ScrollableRows,
  args: { ...ScrollableRows.args, dir: 'rtl' },
  play: async ({ canvas }) => {
    const scroller = canvas.getByRole('region');
    await expect(getComputedStyle(scroller).direction).toBe('rtl');
    scroller.scrollLeft = -100;
    await expect(scroller.scrollLeft).toBeLessThan(0);
    const checkbox = canvas.getByRole('checkbox', { name: 'Select Project 21' });
    checkbox.focus();
    await expect(checkbox.getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(canvas.getByRole('table').querySelector('th')!.getBoundingClientRect().bottom);
  },
};
export const Error: Story = {
  args: { rows: [], empty: <span role="alert">Projects could not be loaded.</span> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toBeVisible();
    await expect(canvas.getByRole('cell')).toHaveAttribute('colspan', '2');
  },
};
export const LinksAndButtons: Story = {
  parameters: docs(`import { Button, DataTable } from '@jfrader/ui';

interface Project {
  id: string;
  name: string;
}

const rows: Project[] = [
  { id: 'c', name: 'Cedar' },
  { id: 'a', name: 'Atlas' },
  { id: 'b', name: 'Birch' },
  { id: 'd', name: 'Delta' },
];

export function ProjectTable() {
  const columns = [
    {
      id: 'name',
      header: 'Name',
      cell: (row: Project) => (
        <a href="#projects" onClick={(event) => event.preventDefault()}>
          {row.name}
        </a>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row: Project) => (
        <Button size="sm">
          Open {row.name}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      caption="Projects"
      locale="en-US"
      timeZone="UTC"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      selectionMode="multiple"
    />
  );
}`),
  args: {
    selectionMode: 'multiple',
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
function Removal(args: DataTableProps<Project>) {
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
    const root = canvasElement.querySelector('[data-ui="data-table"]')!;
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
// Registered classes land before consumer sx; slot css still reaches interior parts.
const StyledTable = styled(Table)({ borderRadius: vars.radius.sm });
export const ConsumerStylePrecedence: Story = {
  args: {
    toolbar: <Button size="sm">Export</Button>,
    slotProps: {
      cell: { sx: { paddingInlineStart: vars.space[6] } },
      sortButton: { sx: { borderRadius: vars.radius.sm } },
      toolbar: { sx: { justifyContent: 'flex-end' }, 'aria-label': 'Project actions' },
    },
    sx: { borderRadius: vars.radius.lg },
  },
  render: (args) => <StyledTable {...args} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(parseFloat(getComputedStyle(canvas.getAllByRole('cell')[0]!).paddingInlineStart)).toBeCloseTo(24, 0);
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Name: sort ascending' })).borderRadius).toBe('8px');
    await expect(getComputedStyle(canvasElement.querySelector('[data-ui="data-table"]')!).borderRadius).toBe(
      '18px',
    );
    const toolbar = canvasElement.querySelector('[data-ui="data-table-toolbar"]')!;
    await expect(getComputedStyle(toolbar).justifyContent).toBe('flex-end');
    await expect(toolbar).toHaveAttribute('aria-label', 'Project actions');
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  parameters: docs(projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  multiSort
  defaultSort={[{ columnId: 'budget', direction: 'desc' }, { columnId: 'name', direction: 'asc' }]}
  defaultSelectedKeys={['a']}`)),
  args: {
    selectionMode: 'multiple',
    getRowLabel,
    defaultSelectedKeys: ['a'],
    multiSort: true,
    defaultSort: [{ columnId: 'budget', direction: 'desc' }, { columnId: 'name', direction: 'asc' }],
  },
};
export const RTL: Story = {
  parameters: docs(projectExample(`
  dir="rtl"
  getRowLabel={(row) => row.name}
  selectionMode="multiple"`)),
  args: { dir: 'rtl', selectionMode: 'multiple', getRowLabel },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('table')).direction).toBe('rtl');
    await expect(getComputedStyle(canvas.getAllByRole('cell')[2]!).textAlign).toBe('end');
  },
};
export const ForcedColors: Story = {
  args: { selectionMode: 'multiple', getRowLabel, defaultSelectedKeys: ['a'] },
  parameters: {
    docs: {
      description: {
        story: 'Enable forced colors in the browser to check rendering. This story checks structure only.',
      },
      source: {
        language: 'tsx',
        code: projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  defaultSelectedKeys={['a']}`),
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
  args: { defaultSort: [{ columnId: 'name', direction: 'asc' }] },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser to check the override. This story checks structure only; rows always reorder immediately.',
      },
      source: {
        language: 'tsx',
        code: projectExample(`
  defaultSort={[{ columnId: 'name', direction: 'asc' }]}`),
      },
    },
  },
};
export const KeyboardSortingAndSelection: Story = {
  parameters: docs(projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  onSortChange={(sort) => console.log('Sort:', sort)}
  onSelectionChange={(keys) => console.log('Selected:', keys)}`)),
  args: { selectionMode: 'multiple', getRowLabel, onSortChange: fn(), onSelectionChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.tab();
    const region = canvas.getByRole('region');
    await expect(region.ownerDocument.activeElement).toBe(region);
    await expect(getComputedStyle(region).outlineStyle).not.toBe('none');
    await userEvent.tab();
    const all = canvas.getByRole('checkbox', { name: 'Select all visible rows' });
    await expect(all.ownerDocument.activeElement).toBe(all);
    await expect(getComputedStyle(all.nextElementSibling!).outlineStyle).not.toBe('none');
    await userEvent.tab();
    const sort = canvas.getByRole('button', { name: 'Name: sort ascending' });
    await expect(sort.ownerDocument.activeElement).toBe(sort);
    await expect(getComputedStyle(sort).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSortChange).toHaveBeenCalledTimes(1);
    await expect(args.onSortChange).toHaveBeenNthCalledWith(1, [{ columnId: 'name', direction: 'asc' }]);
    await expect(sort.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    const indicator = () => sort.querySelector('svg')!;
    await expect(indicator()).toHaveAttribute('data-direction', 'asc');
    await expect(indicator()).toHaveAttribute('data-sort-glyph', 'asc');
    await expect(indicator().querySelectorAll('path')).toHaveLength(1);
    await userEvent.keyboard(' ');
    await expect(args.onSortChange).toHaveBeenCalledTimes(2);
    await expect(args.onSortChange).toHaveBeenNthCalledWith(2, [{ columnId: 'name', direction: 'desc' }]);
    await expect(sort.closest('th')).toHaveAttribute('aria-sort', 'descending');
    // The indicator swaps its glyph, so the element is new after each change: re-query it.
    await expect(indicator()).toHaveAttribute('data-direction', 'desc');
    await expect(indicator()).toHaveAttribute('data-sort-glyph', 'desc');
    await expect(indicator().querySelectorAll('path')).toHaveLength(1);
    await expect(sort.ownerDocument.activeElement).toBe(sort);
    await expect(canvas.getByRole('status')).toHaveTextContent('Name, descending');
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
  parameters: docs(`import { DataTable } from '@jfrader/ui';

interface Project {
  id: string;
  name: string;
  budget: number;
  date: Date;
}

const rows: Project[] = [
  { id: '10', name: 'Project 10', budget: Number.NaN, date: new Date('invalid') },
  { id: '2', name: 'Project 2', budget: 2, date: new Date('2026-01-02T00:00:00Z') },
  { id: 'empty', name: '', budget: Number.POSITIVE_INFINITY, date: new Date('invalid') },
  { id: '1', name: 'project 1', budget: 1, date: new Date('2026-01-01T00:00:00Z') },
];

const columns = [
  { id: 'name', header: 'Name', accessor: (row: Project) => row.name },
  { id: 'budget', header: 'Budget', accessor: (row: Project) => row.budget, numeric: true },
  { id: 'date', header: 'Date', accessor: (row: Project) => row.date },
];

<DataTable
  caption="Projects"
  locale="en-US"
  timeZone="UTC"
  rows={rows}
  columns={columns}
  getRowId={(row) => row.id}
  onSortChange={(sort) => console.log('Sort:', sort)}
/>`),
  args: {
    rows: [
      { id: '10', name: 'Project 10', budget: Number.NaN, date: new Date('invalid') },
      { id: '2', name: 'Project 2', budget: 2, date: new Date('2026-01-02T00:00:00Z') },
      { id: 'empty', name: '', budget: Number.POSITIVE_INFINITY, date: new Date('invalid') },
      { id: '1', name: 'project 1', budget: 1, date: new Date('2026-01-01T00:00:00Z') },
    ],
    columns: [...columns, { id: 'date', header: 'Date', accessor: (row) => row.date }],
    onSortChange: fn(),
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
    await expect(args.onSortChange).toHaveBeenCalledTimes(6);
  },
};

export const InvalidAndDisabledSort: Story = {
  parameters: docs(`import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

<DataTable
  caption="Projects"
  locale="en-US"
  timeZone="UTC"
  rows={projects}
  columns={[{ ...columns[0], sortable: false }, columns[1]]}
  getRowId={(row) => row.id}
  sort={[{ columnId: 'absent', direction: 'asc' }]}
/>`),
  args: {
    sort: [{ columnId: 'absent', direction: 'asc' }],
    columns: [{ ...columns[0]!, sortable: false }, columns[1]!],
    onSortChange: fn(),
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(sortedHeader(canvasElement)).toBeNull();
    await expect(canvas.queryByRole('button', { name: /Name/ })).toBeNull();
    await userEvent.click(canvas.getByRole('columnheader', { name: 'Name' }));
    await expect(args.onSortChange).not.toHaveBeenCalled();
    await expect(names(canvasElement)).toEqual(['Cedar', 'Atlas', 'Birch', 'Delta']);
  },
};

export const ControlledSelection: Story = {
  args: { selectionMode: 'multiple', getRowLabel, onSelectionChange: fn() },
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

function PageChanges(args: DataTableProps<Project>) {
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
  args: { selectionMode: 'multiple', getRowLabel, onSelectionChange: fn() },
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
  parameters: docs(projectExample(`
  getRowLabel={(row) => row.name}
  selectionMode="multiple"
  onClickCapture={(event) => {
    // Intercept clicks before table handlers run
    event.preventDefault();
  }}`)),
  args: {
    selectionMode: 'multiple',
    getRowLabel,
    onSortChange: fn(),
    onSelectionChange: fn(),
    onClickCapture: (event) => event.preventDefault(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort ascending' }));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Cedar' }));
    await expect(args.onSortChange).not.toHaveBeenCalled();
    await expect(args.onSelectionChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('checkbox', { name: 'Select Cedar' })).not.toBeChecked();
  },
};

// Deprecated aliases keep working until the rename removes them.
export const LegacyProps: Story = {
  tags: ['!autodocs'],
  args: {
    defaultValue: { columnId: 'name', direction: 'asc' },
    onValueChange: fn(),
    selectable: true,
    getRowLabel,
    size: 'sm',
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(names(canvasElement)).toEqual(['Atlas', 'Birch', 'Cedar', 'Delta']);
    await userEvent.click(canvas.getByRole('button', { name: 'Name: sort descending' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
    await expect(names(canvasElement)).toEqual(['Delta', 'Cedar', 'Birch', 'Atlas']);
    await expect(canvas.getByRole('checkbox', { name: 'Select all visible rows' })).toBeInTheDocument();
    for (const row of canvas.getByRole('table').querySelectorAll('tr')) await expect(row.getBoundingClientRect().height).toBe(33);
    await expect(canvasElement.querySelector('[data-ui="data-table"]')).toHaveAttribute('data-density', 'compact');
  },
};
export const LegacyControlledValue: Story = {
  tags: ['!autodocs'],
  args: { value: { columnId: 'budget', direction: 'desc' }, onValueChange: fn() },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(names(canvasElement)).toEqual(['Cedar', 'Birch', 'Atlas', 'Delta']);
    await userEvent.click(canvas.getByRole('button', { name: 'Budget: sort ascending' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({ columnId: 'budget', direction: 'asc' });
    await expect(names(canvasElement)).toEqual(['Cedar', 'Birch', 'Atlas', 'Delta']);
    await expect(sortedHeader(canvasElement)).toHaveAttribute('aria-sort', 'descending');
  },
};

export const MinimumTableWidth: Story = {
  args: { minTableWidth: '68em' },
  render: args => <NarrowFrame><Table {...args} /></NarrowFrame>,
  parameters: docs(`import { DataTable } from '@jfrader/ui';

const rows = [{ id: 'atlas', name: 'Atlas', budget: 40 }];
const columns = [
  { id: 'name', header: 'Name', accessor: (row: (typeof rows)[number]) => row.name },
  { id: 'budget', header: 'Budget', accessor: (row: (typeof rows)[number]) => row.budget, numeric: true },
];

<DataTable caption="Projects" rows={rows} columns={columns}
  getRowId={row => row.id} minTableWidth="68em" />`),
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table');
    const scroller = canvas.getByRole('region');
    await expect(table.getBoundingClientRect().width).toBeGreaterThanOrEqual(952);
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  },
};

export const MinimumTableWidthOverride: Story = {
  tags: ['!autodocs'],
  args: { minTableWidth: 960, slotProps: { table: { sx: { minInlineSize: 640 } } } },
  render: args => <NarrowFrame><Table {...args} /></NarrowFrame>,
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('table')).minInlineSize).toBe('640px');
    await expect(canvas.getByRole('table').style.getPropertyValue('--ui-data-table-min-width')).toBe('960px');
  },
};

export const RefsAndHiddenCaption: Story = {
  name: 'DOM refs and hidden caption',
  parameters: docs(`import { useRef } from 'react';
import { DataTable, type DataColumn } from '@jfrader/ui';

${projectSetup}

export function TableRefsExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  return (
    <DataTable
      ref={containerRef}
      tableRef={tableRef}
      caption="Projects"
      captionHidden
      rows={projects}
      columns={columns}
      getRowId={(row) => row.id}
    />
  );
}`, 'Forward refs to the container and table elements while visually hiding the caption.'),
  args: { ref: fn(), tableRef: fn(), captionHidden: true },
  play: async ({ args, canvas, canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="data-table"]');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.tableRef).toHaveBeenCalledWith(canvas.getByRole('table', { name: 'Projects' }));
    await expect(canvas.getByRole('table')).toHaveAccessibleName('Projects');
    const caption = canvasElement.querySelector('caption')!;
    await expect(getComputedStyle(caption).position).toBe('absolute');
    await expect(getComputedStyle(caption).display).not.toBe('none');
  },
};
