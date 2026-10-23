import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { FilterToolbar } from '../filter-toolbar';
import { Popover } from '../popover';
import { Select } from '../select';
import { SortableDataTable, type DataColumn } from './index';

const Frame = styled.div({ display: 'grid', gap: vars.space[4], minInlineSize: 0 });
const Controls = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });
const PopoverBody = styled.div({ minBlockSize: vars.space[12], padding: vars.space[4] });
const records = Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `Project ${index + 1}` }));
type RecordRow = (typeof records)[number];
const columns: readonly DataColumn<RecordRow>[] = [
  { id: 'name', header: 'Project name', accessor: row => row.name, width: '50%' },
  { id: 'reference', header: 'Customer reference number', accessor: row => row.id },
  { id: 'actions', header: 'Actions', cell: row => (
    <Popover placement="top-start">
      <Popover.Trigger>Open {row.name}</Popover.Trigger>
      <Popover.Content aria-label={`Actions for ${row.name}`}>
        <PopoverBody><Button size="sm">Edit {row.name}</Button></PopoverBody>
      </Popover.Content>
    </Popover>
  ) },
];

const meta = {
  title: 'Data/SortableDataTable',
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Sort rows by column and select rows in a table.' } } },
  tags: ['!autodocs'],
  render: () => (
    <Frame>
      <Controls>
        <Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button>
        <Button size="sm" aria-label="Add">+</Button>
      </Controls>
      <Select label="Status" size="sm" defaultValue="active" options={[
        { value: 'active', label: 'Active projects with a long status label' },
        { value: 'archived', label: 'Archived' },
      ]} />
      <FilterToolbar label="Filters" defaultValue={[{ id: 'status', label: 'Status', value: 'Active' }]}>
        <FilterToolbar.ActiveFilters /><FilterToolbar.Clear />
      </FilterToolbar>
      <SortableDataTable caption="Projects" captionHidden rows={records} columns={columns}
        getRowId={row => row.id} minTableWidth="68em"
        slotProps={{ scroller: { sx: { maxBlockSize: '18rem' } } }} />
    </Frame>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const play: NonNullable<Story['play']> = async ({ canvas, canvasElement, userEvent, name, parameters }) => {
  const doc = canvasElement.ownerDocument;
  const body = within(doc.body);
  const touch = doc.defaultView!.matchMedia('(pointer: coarse)').matches;
  await expect(touch).toBe(name.startsWith('Touch'));
  await expect(doc.defaultView!.innerWidth).toBe(Number.parseInt(parameters.viewport.options.table.styles.width));
  await expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(doc.documentElement.clientWidth);
  const small = canvas.getByRole('button', { name: 'Small' });
  const medium = canvas.getByRole('button', { name: 'Medium' });
  const large = canvas.getByRole('button', { name: 'Large' });
  await expect(small.getBoundingClientRect().height).toBe(touch ? 44 : 32);
  await expect(medium.getBoundingClientRect().height).toBe(touch ? 44 : 40);
  await expect(large.getBoundingClientRect().height).toBe(48);
  const select = canvas.getByRole('combobox', { name: 'Status' });
  await expect(select.getBoundingClientRect().height).toBe(touch ? 44 : 37);
  const sort = canvas.getByRole('button', { name: 'Project name: sort ascending' });
  await expect(sort.getBoundingClientRect().height).toBe(touch ? 44 : 32);
  if (touch) {
    for (const target of [small, medium, large, sort, canvas.getByRole('button', { name: 'Add' }),
      canvas.getByRole('button', { name: 'Remove Status: Active' }), canvas.getByRole('button', { name: 'Clear all' })]) {
      await expect(target.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
      await expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  }
  const table = canvas.getByRole('table');
  const scroller = canvas.getByRole('region', { name: 'Scrollable table' });
  await expect(getComputedStyle(table).minInlineSize).toBe('952px');
  await expect(table.getBoundingClientRect().width).toBeGreaterThanOrEqual(952);
  await expect(sort.getBoundingClientRect().width).toBeLessThan(canvas.getAllByRole('columnheader')[0]!.getBoundingClientRect().width);
  for (const header of canvas.getAllByRole('columnheader')) await expect(getComputedStyle(header).whiteSpace).toBe('nowrap');
  await expect(getComputedStyle(scroller).isolation).toBe('isolate');
  if (touch) await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  await userEvent.click(select);
  const options = await body.findAllByRole('option');
  for (const option of options) await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(touch ? 44 : 32);
  await userEvent.keyboard('{Escape}');
  scroller.scrollLeft = scroller.scrollWidth;
  const rowElements = table.querySelectorAll('tbody tr');
  scroller.scrollTop = rowElements[2]!.getBoundingClientRect().top - rowElements[0]!.getBoundingClientRect().top;
  await expect(scroller.scrollTop).toBeGreaterThan(0);
  await userEvent.click(canvas.getByRole('button', { name: 'Open Project 3' }));
  const popover = await body.findByRole('dialog', { name: 'Actions for Project 3' });
  const header = canvas.getAllByRole('columnheader')[2]!;
  await waitFor(() => {
    const p = popover.getBoundingClientRect();
    const h = header.getBoundingClientRect();
    const left = Math.max(p.left, h.left);
    const right = Math.min(p.right, h.right);
    const top = Math.max(p.top, h.top);
    const bottom = Math.min(p.bottom, h.bottom);
    expect(right).toBeGreaterThan(left);
    expect(bottom).toBeGreaterThan(top);
    expect(popover.contains(doc.elementFromPoint((left + right) / 2, (top + bottom) / 2))).toBe(true);
  });
};

const viewport = (width: number) => ({ viewport: {
  defaultViewport: 'table',
  options: { table: { name: 'Table', styles: { width: `${width}px`, height: '900px' } } },
} });
export const TouchTable320: Story = { name: 'Touch table 320', parameters: viewport(320), play };
export const TouchTable390: Story = { name: 'Touch table 390', parameters: viewport(390), play };
export const TouchTable768: Story = { name: 'Touch table 768', parameters: viewport(768), play };
export const DesktopTableControls: Story = { name: 'Desktop table controls', parameters: viewport(1440), play };
