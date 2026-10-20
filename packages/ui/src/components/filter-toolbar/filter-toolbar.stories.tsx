import { StrictMode, useId, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { ChipGroup } from '../chip-group';
import { Select } from '../select';
import { TextField } from '../text-field';
import { ThemeRoot } from '../theme-root';
import {
  FilterToolbar,
  type FilterToolbarCompoundProps,
  type FilterToolbarDefinition,
  type FilterToolbarEasyProps,
  type FilterToolbarMultiSelectOption,
  type FilterToolbarProps,
  type FilterToolbarSlots,
  type FilterToolbarSlotProps,
  type FilterValue,
} from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: 280, maxInlineSize: '100%' });

const OPEN: FilterValue = { id: 'status', label: 'Status', value: 'open', valueLabel: 'Open' };
const CLOSED: FilterValue = { ...OPEN, value: 'closed', valueLabel: 'Closed' };
const OWNER: FilterValue = { id: 'owner', label: 'Owner', value: 'me', valueLabel: 'Me' };
const FILTERS = [OPEN, OWNER];
const OWNER_CHIP: FilterValue = { ...OWNER, id: 'owner-me' };
const EASY_FILTERS = [OPEN, OWNER_CHIP];

const DEFINITIONS: readonly FilterToolbarDefinition[] = [
  {
    type: 'select',
    id: 'status',
    label: 'Status',
    placeholder: 'Any status',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  {
    type: 'multiselect',
    id: 'owner',
    label: 'Owner',
    placeholder: 'Any owner',
    options: [
      { id: 'owner-me', value: 'me', label: 'Me' },
      { id: 'owner-team', value: 'team', label: 'Team' },
    ],
  },
];

const ISSUE_FILTERS: readonly FilterToolbarDefinition[] = [
  {
    type: 'select',
    id: 'status',
    label: 'Status',
    placeholder: 'Any status',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'in-review', label: 'In review' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  {
    type: 'multiselect',
    id: 'assignee',
    label: 'Assignee',
    placeholder: 'Anyone',
    options: [
      { id: 'assignee-ada', value: 'ada', label: 'Ada Lovelace' },
      { id: 'assignee-grace', value: 'grace', label: 'Grace Hopper' },
      { id: 'assignee-alan', value: 'alan', label: 'Alan Turing' },
    ],
  },
];

const ISSUE_DEFAULT: readonly FilterValue[] = [
  { id: 'status', label: 'Status', value: 'open', valueLabel: 'Open' },
  { id: 'assignee-ada', label: 'Assignee', value: 'ada', valueLabel: 'Ada Lovelace' },
];

const SOURCE = `import { FilterToolbar } from '@jfrader/ui';

<FilterToolbar
  filters={[
    {
      type: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'Any status',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'in-review', label: 'In review' },
        { value: 'closed', label: 'Closed' },
      ],
    },
    {
      type: 'multiselect',
      id: 'assignee',
      label: 'Assignee',
      placeholder: 'Anyone',
      options: [
        { id: 'assignee-ada', value: 'ada', label: 'Ada Lovelace' },
        { id: 'assignee-grace', value: 'grace', label: 'Grace Hopper' },
        { id: 'assignee-alan', value: 'alan', label: 'Alan Turing' },
      ],
    },
  ]}
  defaultValue={[
    { id: 'status', label: 'Status', value: 'open', valueLabel: 'Open' },
    { id: 'assignee-ada', label: 'Assignee', value: 'ada', valueLabel: 'Ada Lovelace' },
  ]}
  resultCount={12}
/>`;

const definitionsSource = `const filters: FilterToolbarDefinition[] = [
  { type: 'select', id: 'status', label: 'Status', placeholder: 'Any status', options: [
    { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' },
  ] },
  { type: 'multiselect', id: 'owner', label: 'Owner', placeholder: 'Any owner', options: [
    { id: 'owner-me', value: 'me', label: 'Me' },
    { id: 'owner-team', value: 'team', label: 'Team' },
  ] },
];`;
const valuesSource = `const activeFilters: FilterValue[] = [
  { id: 'status', label: 'Status', value: 'open', valueLabel: 'Open' },
  { id: 'owner', label: 'Owner', value: 'me', valueLabel: 'Me' },
];`;
const compoundSource = `import { Button, FilterToolbar, type FilterValue } from '@jfrader/ui';

${valuesSource}

<FilterToolbar defaultValue={activeFilters}>
  <FilterToolbar.Controls>
    {({ value, disabled, onValueChange }) => (
      <Button disabled={disabled} onClick={() => onValueChange([
        ...value.filter((filter) => filter.id !== 'status'),
        { id: 'status', label: 'Status', value: 'closed', valueLabel: 'Closed' },
      ])}>Closed</Button>
    )}
  </FilterToolbar.Controls>
  <FilterToolbar.ActiveFilters empty="No filters" />
  <FilterToolbar.Clear />
  <FilterToolbar.ResultCount count={12} locale="en-US" />
</FilterToolbar>`;

type CheckedFilterToolbar<Props extends FilterToolbarProps> = Props;
type CheckedMultiOption<Option extends FilterToolbarMultiSelectOption> = Option;
export type FilterToolbarTypeRegression = {
  // @ts-expect-error MultiSelect chip identity must be supplied explicitly.
  missingOptionId: CheckedMultiOption<{ value: 'me'; label: 'Me' }>;
  // @ts-expect-error Filters and children are mutually exclusive.
  filtersWithChildren: CheckedFilterToolbar<{ filters: typeof DEFINITIONS; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects resultCount.
  childrenWithResultCount: CheckedFilterToolbar<{ resultCount: number; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slots.
  childrenWithSlots: CheckedFilterToolbar<{ slots: FilterToolbarSlots; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slotProps.
  childrenWithSlotProps: CheckedFilterToolbar<{ slotProps: FilterToolbarSlotProps; children: ReactNode }>;
};

function Example(args: FilterToolbarCompoundProps) {
  return (
    <FilterToolbar {...args}>
      <FilterToolbar.Controls>
        {({ value, disabled, onValueChange }) => (
          <>
            <Button
              disabled={disabled}
              onClick={() => onValueChange([...value.filter((filter) => filter.id !== 'status'), CLOSED])}
            >
              Closed
            </Button>
          </>
        )}
      </FilterToolbar.Controls>
      <FilterToolbar.ActiveFilters empty="No filters" />
      <FilterToolbar.Clear />
      <FilterToolbar.ResultCount count={12} locale="en-US" />
    </FilterToolbar>
  );
}

const meta = {
  title: 'Data/FilterToolbar',
  component: FilterToolbar,
  tags: ['autodocs'],
  args: { defaultValue: FILTERS },
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      description: {
        component: 'Choose filters for a collection, remove them one at a time, or clear them all.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Filters and controls', stories: ['EasyActivation', 'SearchTextField', 'Compound'] },
        { title: 'Result counts', stories: ['ZeroResults', 'CommittedResultCount'] },
        { title: 'Clear', stories: ['EasyKeyboardRemoveAndClear'] },
        { title: 'Layout and overflow', stories: ['LongChips'] },
        { title: 'States', stories: ['Empty', 'LoadingResults', 'EasyDisabled'] },
      ],
      usage: `### When to use
Use a filter toolbar above a collection to edit criteria, review active filters and clear them. Keep the collection and its filtering logic in your application.

### Constraints
Result counts describe the results your application has committed; changing filters does not calculate a count. Keep the previous count while loading and announce the replacement when the request finishes. Translate the count and control labels for your audience.

Keep multiselect chip IDs stable and unique across the toolbar. Do not switch between controlled and uncontrolled values. Use custom controls for free-text, date or range criteria.

### Keyboard and accessibility
Tab and Shift+Tab follow control order. Enter and Space activate remove and clear buttons. Each control keeps its own editing and selection keys. Removing a chip moves focus to a neighboring chip, then an available control, or the toolbar when none remain.`,
    },
  },
} satisfies Meta<FilterToolbarCompoundProps>;

export default meta;
type Story = StoryObj<Meta<FilterToolbarCompoundProps>>;

async function focus(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
}

export const Default: Story = {
  name: 'Filter project issues',
  parameters: { docs: {
    description: { story: 'Choose issue status and assignees, review active filters and see the result count.' },
    source: { language: 'tsx', code: SOURCE },
  } },
  render: () => (
    <FilterToolbar
      filters={ISSUE_FILTERS}
      defaultValue={ISSUE_DEFAULT}
      resultCount={12}
    />
  ),
};

export const EasyActivation: Story = {
  name: 'Single and multiple selection',
  parameters: { docs: {
    description: { story: 'Choose a status and one or more owners to add active filter chips.' },
    source: { language: 'tsx', code: `import { FilterToolbar, type FilterToolbarDefinition } from '@jfrader/ui';

${definitionsSource}

<FilterToolbar filters={filters} defaultValue={[]} resultCount={12} />` },
  } },
  args: { onValueChange: fn() },
  render: (args) => (
    <FilterToolbar
      filters={DEFINITIONS}
      defaultValue={[]}
      resultCount={12}
      onValueChange={args.onValueChange}
    />
  ),
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const statusTrigger = canvas.getByRole('combobox', { name: 'Status' });
    await userEvent.tab();
    await focus(statusTrigger);
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, [CLOSED]);
    const activeFilters = canvasElement.querySelector<HTMLElement>('[data-ui="filter-toolbar-active-filters"]');
    if (!activeFilters) throw new Error('Missing active filters.');
    await expect(within(activeFilters).getByText('Status:')).toBeInTheDocument();
    await expect(within(activeFilters).getByText('Closed')).toBeInTheDocument();

    const ownerTrigger = canvas.getByRole('combobox', { name: 'Owner' });
    await userEvent.tab();
    await focus(ownerTrigger);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, [
      CLOSED,
      OWNER_CHIP,
    ]);
    await expect(within(activeFilters).getByText('Owner:')).toBeInTheDocument();
    await expect(within(activeFilters).getByText('Me')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="filter-toolbar-result-count"]')).toHaveTextContent('12 results');
  },
};

export const EasyKeyboardRemoveAndClear: Story = {
  name: 'Remove a filter or clear all',
  parameters: { docs: {
    description: { story: 'Remove individual chips with Enter, or use Clear all to reset both controls.' },
    source: { language: 'tsx', code: `import { FilterToolbar, type FilterToolbarDefinition } from '@jfrader/ui';

${definitionsSource}

<FilterToolbar filters={filters} resultCount={12} defaultValue={[
  { id: 'status', label: 'Status', value: 'open', valueLabel: 'Open' },
  { id: 'owner-me', label: 'Owner', value: 'me', valueLabel: 'Me' },
]} />` },
  } },
  args: { onValueChange: fn() },
  render: (args) => (
    <FilterToolbar
      filters={DEFINITIONS}
      defaultValue={EASY_FILTERS}
      resultCount={12}
      onValueChange={args.onValueChange}
    />
  ),
  play: async ({ canvas, args, userEvent }) => {
    const removeStatus = canvas.getByRole('button', { name: 'Remove Status: Open' });
    const removeOwner = canvas.getByRole('button', { name: 'Remove Owner: Me' });
    const clear = canvas.getByRole('button', { name: 'Clear all' });

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await focus(removeStatus);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, [OWNER_CHIP]);
    await focus(removeOwner);

    await userEvent.tab();
    await focus(clear);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
  },
};

export const EasyDisabled: Story = {
  name: 'Disabled filters',
  parameters: { docs: {
    description: { story: 'Keep the active filters and count visible while disabling all editing controls.' },
    source: { language: 'tsx', code: `import { FilterToolbar, type FilterToolbarDefinition } from '@jfrader/ui';

${definitionsSource}

<FilterToolbar filters={filters} disabled resultCount={12} defaultValue={[
  { id: 'status', label: 'Status', value: 'open', valueLabel: 'Open' },
  { id: 'owner-me', label: 'Owner', value: 'me', valueLabel: 'Me' },
]} />` },
  } },
  args: { onValueChange: fn() },
  render: (args) => (
    <FilterToolbar
      filters={DEFINITIONS}
      defaultValue={EASY_FILTERS}
      disabled
      slotProps={{ select: { disabled: false }, multiSelect: { disabled: false } }}
      resultCount={12}
      onValueChange={args.onValueChange}
    />
  ),
  play: async ({ canvas, args, userEvent }) => {
    const statusTrigger = canvas.getByRole('combobox', { name: 'Status' });
    const ownerTrigger = canvas.getByRole('combobox', { name: 'Owner' });
    const removeStatus = canvas.getByRole('button', { name: 'Remove Status: Open' });
    const clear = canvas.getByRole('button', { name: 'Clear all' });

    await expect(statusTrigger).toBeDisabled();
    await expect(ownerTrigger).toBeDisabled();
    await expect(removeStatus).toBeDisabled();
    await expect(clear).toBeDisabled();

    await userEvent.click(removeStatus);
    await userEvent.click(clear);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function EasyControlledExample({ onValueChange }: { onValueChange?: (filters: readonly FilterValue[]) => void }) {
  const [value, setValue] = useState<readonly FilterValue[]>(EASY_FILTERS);
  return (
    <>
      <FilterToolbar
        filters={DEFINITIONS}
        resultCount={12}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
      />
      <Button onClick={() => setValue([])}>Reset externally</Button>
    </>
  );
}

export const EasyControlled: Story = {
  args: { onValueChange: fn() },
  render: (args) => <EasyControlledExample onValueChange={args.onValueChange} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Status: Open' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([OWNER_CHIP]);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset externally' }));
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
    await expect(canvas.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
    await expect(canvas.getByRole('combobox', { name: 'Owner' })).toHaveTextContent('Any owner');
  },
};

export const EasyUncontrolled: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <FilterToolbar
      filters={DEFINITIONS}
      defaultValue={[]}
      resultCount={12}
      onValueChange={args.onValueChange}
    />
  ),
  play: async ({ canvas, args, userEvent }) => {
    const statusTrigger = canvas.getByRole('combobox', { name: 'Status' });
    await userEvent.tab();
    await focus(statusTrigger);
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, [CLOSED]);
    await expect(canvas.getByText('Status:')).toBeInTheDocument();

    const removeStatus = canvas.getByRole('button', { name: 'Remove Status: Closed' });
    await userEvent.click(removeStatus);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
    await expect(statusTrigger).toHaveTextContent('Any status');
  },
};

function CustomRoot({ children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div data-testid="custom-easy-root" {...props}>
      {children}
    </div>
  );
}

// This story tests native inline style merging through the slot API.
export const EasySlotPropsOverride: Story = {
  render: () => (
    <FilterToolbar
      filters={DEFINITIONS}
      defaultValue={EASY_FILTERS}
      resultCount={12}
      component={CustomRoot}
      className="consumer-root"
      data-ui="app-filters"
      title="Consumer title"
      style={{ opacity: 0.9, zIndex: 1 }}
      slotProps={{
        root: {
          'data-testid': 'custom-root-props',
          className: 'slot-root-override',
          'data-ui': 'slot-filters',
          title: 'Slot title',
          style: { zIndex: 2 },
        },
        controls: {
          className: 'slot-controls-override',
        },
        clear: {
          className: 'slot-clear-override',
        },
        resultCount: {
          className: 'slot-count-override',
        },
      }}
    />
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const customRoot = canvas.getByTestId('custom-root-props');
    await expect(customRoot).toBeInTheDocument();
    await expect(customRoot).toHaveClass('slot-root-override');
    await expect(customRoot).toHaveClass('consumer-root');
    await expect(customRoot).toHaveAttribute('title', 'Slot title');
    await expect(customRoot).toHaveAttribute('data-ui', 'filter-toolbar app-filters slot-filters');
    await expect(customRoot.style.opacity).toBe('0.9');
    await expect(customRoot.style.zIndex).toBe('2');

    const controls = canvasElement.querySelector('[data-ui="filter-toolbar-controls"]');
    await expect(controls).toHaveClass('slot-controls-override');

    const clearButton = canvas.getByRole('button', { name: 'Clear all' });
    await expect(clearButton).toHaveClass('slot-clear-override');

    const resultCount = canvasElement.querySelector('[data-ui="filter-toolbar-result-count"]');
    await expect(resultCount).toHaveClass('slot-count-override');
    const remove = canvas.getByRole('button', { name: 'Remove Status: Open' });
    remove.focus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', { name: 'Remove Owner: Me' })).toHaveFocus();
    await expect(canvas.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
  },
};

export const Compound: Story = {
  name: 'Compose a custom filter action',
  parameters: { docs: {
    description: { story: 'Add a Closed action that replaces the status filter without removing the owner.' },
    source: { language: 'tsx', code: compoundSource },
  } },
  render: (args) => <Example {...args} />,
};

const IDENTITY_DEFINITIONS: readonly FilterToolbarDefinition[] = [
  { type: 'multiselect', id: 'a', label: 'First facet', options: [{ id: 'first-chip', value: 'b:c', label: 'First option' }] },
  { type: 'multiselect', id: 'a:b', label: 'Second facet', options: [{ id: 'second-chip', value: 'c', label: 'Second option' }] },
];
export const ExplicitChipIdentity: Story = {
  args: { onValueChange: fn() },
  render: (args) => <FilterToolbar filters={IDENTITY_DEFINITIONS} onValueChange={args.onValueChange} />,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('combobox', { name: 'First facet' }));
    await userEvent.click(await body.findByRole('option', { name: 'First option' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(canvas.getByRole('combobox', { name: 'Second facet' }));
    await userEvent.click(await body.findByRole('option', { name: 'Second option' }));
    await userEvent.keyboard('{Escape}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith([
      { id: 'first-chip', label: 'First facet', value: 'b:c', valueLabel: 'First option' },
      { id: 'second-chip', label: 'Second facet', value: 'c', valueLabel: 'Second option' },
    ]);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove First facet: First option' }));
    await expect(canvas.getByRole('button', { name: 'Remove Second facet: Second option' })).toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'No active filters',
  parameters: { docs: {
    description: { story: 'Show an empty-filter message while keeping the custom filter action available.' },
    source: { language: 'tsx', code: compoundSource.replace('defaultValue={activeFilters}', 'defaultValue={[]}') },
  } },
  args: { defaultValue: [] },
  render: (args) => <Example {...args} />,
};

export const ActiveFilters: Story = {
  args: { defaultValue: FILTERS },
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.ActiveFilters />
    </FilterToolbar>
  ),
};

export const ClearAll: Story = {
  args: { onValueChange: fn() },
  render: (args) => <Example {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear all' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  },
};

function FacetExample({ persistent = false, ...args }: FilterToolbarCompoundProps & { persistent?: boolean }) {
  return (
    <FilterToolbar {...args}>
      <FilterToolbar.Controls>
        {({ value, disabled, onValueChange }) => (
          <Select
            disabled={disabled}
            value={value.find((filter) => filter.id === 'status')?.value ?? ''}
            open={persistent ? true : undefined}
            onValueChange={(raw) =>
              onValueChange([
                ...value.filter((filter) => filter.id !== 'status'),
                raw === 'open' ? OPEN : CLOSED,
              ])
            }
          >
            <Select.Trigger aria-label="Status">
              <Select.Value placeholder="Any status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="open">Open</Select.Item>
              <Select.Item value="closed">Closed</Select.Item>
            </Select.Content>
          </Select>
        )}
      </FilterToolbar.Controls>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear />
      <FilterToolbar.ResultCount count={12} />
    </FilterToolbar>
  );
}

export const FacetSelect: Story = {
  args: { onValueChange: fn() },
  render: (args) => <FacetExample {...args} />,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Status' });
    await userEvent.tab();
    await focus(trigger);
    await userEvent.keyboard('{ArrowDown}{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([OWNER, CLOSED]);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await userEvent.keyboard('{ArrowDown}{Tab}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await focus(canvas.getByRole('button', { name: 'Remove Owner: Me' }));
  },
};

export const PersistentSelect: Story = {
  render: (args) => (
    <ThemeRoot theme="light">
      <FacetExample {...args} persistent />
    </ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    const list = await within(canvasElement.ownerDocument.body).findByRole('listbox', { name: 'Status' });
    await expect(list.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
    await expect(within(list).getAllByRole('option')).toHaveLength(2);
  },
};

function SearchExample(args: FilterToolbarCompoundProps) {
  return (
    <FilterToolbar {...args}>
      <FilterToolbar.Controls>
        {({ value, disabled, onValueChange }) => (
          <TextField
            label="Search"
            disabled={disabled}
            value={value.find((filter) => filter.id === 'query')?.value ?? ''}
            onValueChange={(query) =>
              onValueChange([
                ...value.filter((filter) => filter.id !== 'query'),
                ...(query === '' ? [] : [{ id: 'query', label: 'Search', value: query }]),
              ])
            }
          />
        )}
      </FilterToolbar.Controls>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear />
      <FilterToolbar.ResultCount count={12} />
    </FilterToolbar>
  );
}

export const SearchTextField: Story = {
  name: 'Search text as a filter',
  args: { defaultValue: [], onValueChange: fn() },
  render: (args) => <SearchExample {...args} />,
  parameters: {
    docs: {
      description: { story: 'Keep search text in the filter value and remove its chip to clear the input.' },
      source: {
        language: 'tsx',
        code: `import { FilterToolbar, TextField } from '@jfrader/ui';

<FilterToolbar defaultValue={[]}>
  <FilterToolbar.Controls>
    {({ value, disabled, onValueChange }) => (
      <TextField label="Search" disabled={disabled}
        value={value.find((filter) => filter.id === 'query')?.value ?? ''}
        onValueChange={(query) => onValueChange([
          ...value.filter((filter) => filter.id !== 'query'),
          ...(query === '' ? [] : [{ id: 'query', label: 'Search', value: query }]),
        ])} />
    )}
  </FilterToolbar.Controls>
  <FilterToolbar.ActiveFilters />
  <FilterToolbar.Clear />
  <FilterToolbar.ResultCount count={12} />
</FilterToolbar>`,
      },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Search' });
    await userEvent.tab();
    await focus(input);
    await userEvent.type(input, 'ab');
    await userEvent.keyboard('{Home}{ArrowRight}{End}{ArrowLeft}{Escape}');
    await expect(input).toHaveValue('ab');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, [{ id: 'query', label: 'Search', value: 'a' }]);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, [{ id: 'query', label: 'Search', value: 'ab' }]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};

export const EmptyFilterOptions: Story = {
  render: () => (
    <NarrowFrame>
      <FilterToolbar
        defaultValue={[]}
        filters={[
          { type: 'select', id: 'status', label: 'Status', options: [], empty: 'No statuses available' },
          { type: 'multiselect', id: 'owner', label: 'Owner', options: [], empty: 'No owners available' },
        ]}
        resultCount={0}
      />
    </NarrowFrame>
  ),
  parameters: { docs: {
    description: { story: 'Show each filter’s empty message when no options are available.' },
    source: { language: 'tsx', code: `import { FilterToolbar } from '@jfrader/ui';

<FilterToolbar
  filters={[
    { type: 'select', id: 'status', label: 'Status', options: [], empty: 'No statuses available' },
    { type: 'multiselect', id: 'owner', label: 'Owner', options: [], empty: 'No owners available' },
  ]}
  resultCount={0}
/>` },
  } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvas.getByRole('group', { name: 'Filters' });
    const body = within(canvasElement.ownerDocument.body);
    const triggers = canvas.getAllByRole('combobox');
    await expect(triggers[1]!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      triggers[0]!.getBoundingClientRect().bottom,
    );
    for (const [index, message] of ['No statuses available', 'No owners available'].entries()) {
      await userEvent.click(triggers[index]!);
      const listbox = body.getByRole('listbox');
      await waitFor(() => expect(within(listbox).getByText(message)).toBeVisible());
      const box = listbox.getBoundingClientRect();
      await expect(box.left).toBeGreaterThanOrEqual(0);
      await expect(box.right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth);
      await userEvent.keyboard('{Escape}');
      await expect(triggers[index]).toHaveFocus();
    }
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};

export const MultipleControls: Story = {
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.Controls>
        {({ value, disabled, onValueChange }) => (
          <>
            <TextField label="Search" disabled={disabled} />
            <ChipGroup
              label="Owners"
              disabled={disabled}
              options={[{ value: 'me', label: 'Me' }]}
              value={value.filter((filter) => filter.id === 'owner').map((filter) => filter.value)}
              onValueChange={(owners) =>
                onValueChange([
                  ...value.filter((filter) => filter.id !== 'owner'),
                  ...(owners.length ? [OWNER] : []),
                ])
              }
            />
          </>
        )}
      </FilterToolbar.Controls>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear />
    </FilterToolbar>
  ),
};

export const RawVsDisplayValue: Story = {
  args: { defaultValue: [{ ...OPEN, valueLabel: 'Abierto' }], onValueChange: fn() },
  render: (args) => <Example {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Closed' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([CLOSED]);
  },
};

function ControlledExample(args: FilterToolbarCompoundProps) {
  const [value, setValue] = useState<readonly FilterValue[]>(FILTERS);
  return (
    <>
      <Example
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
      />
      <Button onClick={() => setValue([])}>Reset externally</Button>
    </>
  );
}

export const Controlled: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Closed' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([OWNER, CLOSED]);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset externally' }));
    await expect(canvas.getByRole('button', { name: 'Reset externally' }).ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Reset externally' }),
    );
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const Uncontrolled: Story = {
  args: { defaultValue: [], onValueChange: fn() },
  render: (args) => <Example {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Closed' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Closed' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([CLOSED]);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Status: Closed' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};

export const RejectedRemove: Story = {
  args: { value: FILTERS, onValueChange: fn() },
  render: (args) => <Example {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab();
    await userEvent.tab();
    const remove = canvas.getByRole('button', { name: 'Remove Status: Open' });
    await userEvent.keyboard('{Enter}');
    await focus(remove);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([OWNER]);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const RejectedClear: Story = {
  args: { value: FILTERS, onValueChange: fn() },
  render: (args) => <Example {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    for (let index = 0; index < 4; index++) await userEvent.tab();
    const clear = canvas.getByRole('button', { name: 'Clear all' });
    await userEvent.keyboard(' ');
    await focus(clear);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const Disabled: Story = {
  args: { disabled: true, onValueChange: fn() },
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.Controls>
        {({ onValueChange }) => <Button onClick={() => onValueChange([])}>Request clear</Button>}
      </FilterToolbar.Controls>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear />
    </FilterToolbar>
  ),
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Request clear' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Clear all' }));
    await expect(canvas.getByRole('button', { name: 'Remove Status: Open' })).toBeDisabled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ClearVetoAndDisabled: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear onClick={(event) => event.preventDefault()}>Veto clear</FilterToolbar.Clear>
      <FilterToolbar.Clear disabled>Disabled clear</FilterToolbar.Clear>
    </FilterToolbar>
  ),
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Veto clear' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Disabled clear' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const KeyboardRemoveAndClear: Story = {
  args: { onValueChange: fn() },
  render: (args) => <Example {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    const control = canvas.getByRole('button', { name: 'Closed' });
    const first = canvas.getByRole('button', { name: 'Remove Status: Open' });
    const second = canvas.getByRole('button', { name: 'Remove Owner: Me' });
    const clear = canvas.getByRole('button', { name: 'Clear all' });
    for (const stop of [control, first, second, clear]) {
      await userEvent.tab();
      await focus(stop);
    }
    for (const stop of [second, first, control]) {
      await userEvent.tab({ shift: true });
      await focus(stop);
    }
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await focus(second);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, [OWNER]);
    await userEvent.keyboard(' ');
    await focus(control);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, [CLOSED]);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await focus(control);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(4, []);
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await focus(control);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(5, [CLOSED]);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(6, []);
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
  },
};

export const PreviousAndRootFocus: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear />
    </FilterToolbar>
  ),
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await focus(canvas.getByRole('button', { name: 'Remove Status: Open' }));
    await userEvent.keyboard(' ');
    await focus(canvas.getByRole('group', { name: 'Filters' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, [OPEN]);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};

export const ClearRootFocus: Story = {
  ...PreviousAndRootFocus,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await focus(canvas.getByRole('group', { name: 'Filters' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
  },
};

export const EmptyStringValue: Story = {
  args: { defaultValue: [{ ...OPEN, value: '', valueLabel: '' }], onValueChange: fn() },
  render: (args) => <Example {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('listitem')).toHaveTextContent('Status:');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Status:' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
  },
};

export const DuplicateIds: Story = {
  args: { defaultValue: [OPEN, OWNER, CLOSED], onValueChange: fn() },
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.Controls>
        {({ onValueChange }) => (
          <Button onClick={() => onValueChange([CLOSED, OWNER, CLOSED])}>Same normalized filters</Button>
        )}
      </FilterToolbar.Controls>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear />
    </FilterToolbar>
  ),
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Status: Closed×',
      'Owner: Me×',
    ]);
    await userEvent.click(canvas.getByRole('button', { name: 'Same normalized filters' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Status: Closed' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([OWNER]);
  },
};

function AriaExample(args: FilterToolbarCompoundProps) {
  const name = useId();
  const description = useId();
  const unresolved = useId();
  return (
    <>
      <span id={name}>Collection filters</span>
      <span id={description}>Project list</span>
      <FilterToolbar
        {...args}
        aria-label="Explicit filters"
        aria-labelledby={name}
        aria-describedby={description}
      >
        <FilterToolbar.ActiveFilters />
        <FilterToolbar.Clear />
        <FilterToolbar.ResultCount count={0} aria-live="off" aria-describedby={description} />
      </FilterToolbar>
      <FilterToolbar aria-label="Unresolved filters" aria-labelledby={unresolved}>
        <FilterToolbar.ActiveFilters empty={false} />
      </FilterToolbar>
    </>
  );
}

export const ExternalAria: Story = {
  render: (args) => <AriaExample {...args} />,
  play: async ({ canvas }) => {
    const groups = canvas.getAllByRole('group');
    await expect(groups[0]).toHaveAccessibleName('Collection filters');
    await expect(groups[0]).toHaveAttribute('aria-label', 'Explicit filters');
    await expect(groups[0]).toHaveAccessibleDescription('Project list');
    await expect(groups[1]).toHaveAccessibleName('Unresolved filters');
    await expect(groups[1]).toHaveAttribute('aria-labelledby');
    await expect(canvas.getByRole('status')).toHaveAttribute('aria-live', 'off');
  },
};

export const ZeroEmptyNode: Story = {
  render: (args) => (
    <div>
      {[false, null, 0, ''].map((empty, index) => (
        <FilterToolbar {...args} defaultValue={[]} key={index}>
          <FilterToolbar.ActiveFilters empty={empty} />
        </FilterToolbar>
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    const groups = canvas.getAllByRole('group');
    await expect(groups.map((group) => group.textContent)).toEqual(['', '', '0', '']);
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
    for (const group of groups) await expect(group).not.toHaveAttribute('aria-describedby');
  },
};

export const FalsyControlsAndClear: Story = {
  render: (args) => (
    <div>
      {[false, null, 0, ''].map((children, index) => (
        <FilterToolbar {...args} key={index}>
          <FilterToolbar.Controls>{children}</FilterToolbar.Controls>
          <FilterToolbar.Clear aria-label={children === 0 ? 'Clear filters 0' : 'Clear filters'}>
            {children}
          </FilterToolbar.Clear>
        </FilterToolbar>
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    const groups = canvas.getAllByRole('group');
    await expect(
      groups.map((group) => group.querySelector('[data-ui="filter-toolbar-controls"]')?.textContent),
    ).toEqual(['', '', '0', '']);
    await expect(canvas.getAllByRole('button').map((button) => button.textContent)).toEqual(['', '', '0', '']);
  },
};

export const LoadingResults: Story = {
  name: 'Loading results',
  parameters: { docs: {
    description: { story: 'Announce that results are loading while the current filter chips remain visible.' },
    source: { language: 'tsx', code: `import { FilterToolbar, type FilterValue } from '@jfrader/ui';

${valuesSource}

<FilterToolbar defaultValue={activeFilters}>
  <FilterToolbar.ActiveFilters />
  <FilterToolbar.ResultCount count={12} loading />
</FilterToolbar>` },
  } },
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.ResultCount count={12} loading />
    </FilterToolbar>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading results');
  },
};

export const ZeroResults: Story = {
  name: 'Zero results',
  parameters: { docs: {
    description: { story: 'Announce a completed search with no matching results.' },
    source: { language: 'tsx', code: `import { FilterToolbar, type FilterValue } from '@jfrader/ui';

${valuesSource}

<FilterToolbar defaultValue={activeFilters}>
  <FilterToolbar.ResultCount count={0} locale="en-US" />
</FilterToolbar>` },
  } },
  render: (args) => (
    <FilterToolbar {...args}>
      <FilterToolbar.ResultCount count={0} locale="en-US" />
    </FilterToolbar>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('0 results');
    await expect(canvas.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await expect(canvas.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  },
};

export const UnknownResults: Story = {
  render: (args) => (
    <FilterToolbar {...args}>
      {[null, NaN, Infinity, -1, 1.5].map((count, index) => (
        <FilterToolbar.ResultCount key={index} count={count} />
      ))}
    </FilterToolbar>
  ),
  play: async ({ canvas }) => {
    for (const status of canvas.getAllByRole('status'))
      await expect(status).toHaveTextContent('Results unavailable');
  },
};

function CommittedCountExample(args: FilterToolbarCompoundProps) {
  const [count, setCount] = useState(12);
  return (
    <FilterToolbar {...args}>
      <FilterToolbar.Controls>
        <Button onClick={() => setCount(0)}>Commit results</Button>
      </FilterToolbar.Controls>
      <FilterToolbar.ActiveFilters />
      <FilterToolbar.Clear />
      <FilterToolbar.ResultCount count={count} locale="en-US" />
    </FilterToolbar>
  );
}

export const CommittedResultCount: Story = {
  name: 'Commit a new result count',
  parameters: { docs: {
    description: { story: 'Clear the filters, then commit the next count separately from the filter change.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, FilterToolbar, type FilterValue } from '@jfrader/ui';

${valuesSource}

function CollectionFilters() {
  const [count, setCount] = useState(12);
  return <FilterToolbar defaultValue={activeFilters}>
    <FilterToolbar.Controls>
      <Button onClick={() => setCount(0)}>Commit results</Button>
    </FilterToolbar.Controls>
    <FilterToolbar.ActiveFilters />
    <FilterToolbar.Clear />
    <FilterToolbar.ResultCount count={count} locale="en-US" />
  </FilterToolbar>;
}` },
  } },
  args: { onValueChange: fn() },
  render: (args) => <CommittedCountExample {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear all' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('12 results');
    await userEvent.click(canvas.getByRole('button', { name: 'Commit results' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('0 results');
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
  },
};

export const LongChips: Story = {
  name: 'Long filters in a narrow layout',
  parameters: { docs: {
    description: { story: 'Truncate long chip text while preserving its full accessible remove label.' },
    source: { language: 'tsx', code: `import { FilterToolbar, styled } from '@jfrader/ui';

const Frame = styled.div({ inlineSize: 280, maxInlineSize: '100%' });

<Frame>
  <FilterToolbar defaultValue={[
    { id: 'status', label: 'Delivery responsibility', value: 'open',
      valueLabel: 'International collection review and publication'.repeat(3) },
    { id: 'owner', label: 'Owner', value: 'me', valueLabel: 'Me' },
  ]}>
    <FilterToolbar.ActiveFilters />
    <FilterToolbar.Clear>Clear all collection filters</FilterToolbar.Clear>
    <FilterToolbar.ResultCount count={123456789} locale="ar-EG"
      formatCount={(_count, formatted) => \`\${formatted} matching collection entries\`} />
  </FilterToolbar>
</Frame>` },
  } },
  args: {
    defaultValue: [
      {
        ...OPEN,
        label: 'Delivery responsibility',
        valueLabel: 'International collection review and publication'.repeat(3),
      },
      OWNER,
    ],
  },
  render: (args) => (
    <NarrowFrame>
      <FilterToolbar {...args}>
        <FilterToolbar.ActiveFilters />
        <FilterToolbar.Clear>Clear all collection filters</FilterToolbar.Clear>
        <FilterToolbar.ResultCount
          count={123456789}
          locale="ar-EG"
          formatCount={(_count, formatted) => `${formatted} matching collection entries`}
        />
      </FilterToolbar>
    </NarrowFrame>
  ),
  play: async ({ canvas }) => {
    const root = canvas.getByRole('group');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    const chip = canvas.getAllByRole('listitem')[0]!;
    const label = chip.querySelector('span')!;
    await expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
    await expect(getComputedStyle(label).whiteSpace).toBe('nowrap');
    await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
    await expect(chip.getBoundingClientRect().height).toBeLessThanOrEqual(34);
    await expect(canvas.getAllByRole('button')[0]).toHaveAccessibleName(
      `Remove Delivery responsibility: ${'International collection review and publication'.repeat(3)}`,
    );
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(31);
    }
    const status = canvas.getByRole('status');
    await expect(status.scrollWidth).toBeLessThanOrEqual(status.clientWidth + 1);
  },
};

const StyledFilterToolbar = styled(FilterToolbar)({ padding: vars.space[2] });
const StyledFilterControls = styled(FilterToolbar.Controls)({ gap: vars.space[1] });
const StyledActiveFilters = styled(FilterToolbar.ActiveFilters)({ padding: vars.space[1] });
const StyledFilterClear = styled(FilterToolbar.Clear)({ paddingInline: vars.space[1] });
const StyledResultCount = styled(FilterToolbar.ResultCount)({ margin: vars.space[1] });
export const ConsumerStylePrecedence: Story = {
  render: (args) => (
    <StyledFilterToolbar
      {...args}
      sx={{ padding: vars.space[6] }}
    >
      <StyledFilterControls sx={{ gap: vars.space[4] }}>
        <Button>Control</Button>
      </StyledFilterControls>
      <StyledActiveFilters
        sx={{ padding: vars.space[3] }}
        slotProps={{
          list: { sx: { gap: vars.space[4] } },
          chip: { sx: { borderRadius: 0 } },
          label: { sx: { fontWeight: vars.fontWeight.semibold } },
          remove: { sx: { minInlineSize: vars.space[10] } },
        }}
      />
      <StyledFilterClear sx={{ paddingInline: vars.space[6] }} />
      <StyledResultCount count={1} sx={{ margin: vars.space[3] }} />
    </StyledFilterToolbar>
  ),
  play: async ({ canvas, canvasElement }) => {
    const root = canvas.getByRole('group');
    await expect(parseFloat(getComputedStyle(root).paddingTop)).toBeCloseTo(24, 0);
    await expect(
      parseFloat(getComputedStyle(canvasElement.querySelector('[data-ui="filter-toolbar-controls"]')!).gap),
    ).toBeCloseTo(16, 0);
    await expect(
      parseFloat(
        getComputedStyle(canvasElement.querySelector('[data-ui="filter-toolbar-active-filters"]')!).paddingTop,
      ),
    ).toBeCloseTo(12, 0);
    await expect(parseFloat(getComputedStyle(canvas.getByRole('list')).gap)).toBeCloseTo(16, 0);
    await expect(getComputedStyle(canvas.getAllByRole('listitem')[0]!).borderRadius).toBe('0px');
    await expect(
      getComputedStyle(canvasElement.querySelector('[data-ui="filter-toolbar-active-filters"] li > span')!)
        .fontWeight,
    ).toBe('600');
    await expect(
      canvas.getByRole('button', { name: 'Remove Status: Open' }).getBoundingClientRect().width,
    ).toBeGreaterThanOrEqual(39);
    await expect(
      parseFloat(getComputedStyle(canvas.getByRole('button', { name: 'Clear all' })).paddingInlineStart),
    ).toBeCloseTo(24, 0);
    await expect(parseFloat(getComputedStyle(canvas.getByRole('status')).marginTop)).toBeCloseTo(12, 0);
  },
};

const cleanup = { root: fn(), controls: fn(), active: fn(), clear: fn(), status: fn() };
const refs = {
  root: fn((node: HTMLDivElement | null) => (node ? cleanup.root : undefined)),
  controls: fn((node: HTMLDivElement | null) => (node ? cleanup.controls : undefined)),
  active: fn((node: HTMLDivElement | null) => (node ? cleanup.active : undefined)),
  clear: fn((node: HTMLButtonElement | null) => (node ? cleanup.clear : undefined)),
  status: fn((node: HTMLParagraphElement | null) => (node ? cleanup.status : undefined)),
};

export const RefsAndMarkers: Story = {
  args: { ref: refs.root },
  render: (args) => <RefFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const markers = {
      root: 'filter-toolbar',
      controls: 'filter-toolbar-controls',
      active: 'filter-toolbar-active-filters',
      clear: 'filter-toolbar-clear',
      status: 'filter-toolbar-result-count',
    };
    for (const key of Object.keys(refs) as (keyof typeof refs)[]) {
      const element = canvasElement.querySelector(`[data-ui~="${markers[key]}"]`);
      await expect(refs[key]).toHaveBeenCalledWith(element);
      await expect(element?.tagName).toBe(key === 'clear' ? 'BUTTON' : key === 'status' ? 'P' : 'DIV');
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount toolbar' }));
    for (const key of Object.keys(refs) as (keyof typeof refs)[]) await expect(cleanup[key]).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Mount toolbar' }));
    for (const key of Object.keys(refs) as (keyof typeof refs)[]) {
      const element = canvasElement.querySelector(`[data-ui~="${markers[key]}"]`);
      await expect(refs[key]).toHaveBeenLastCalledWith(element);
    }
    await expect(FilterToolbar.displayName).toBe('FilterToolbar');
    for (const [key, part] of Object.entries({
      Controls: FilterToolbar.Controls,
      ActiveFilters: FilterToolbar.ActiveFilters,
      Clear: FilterToolbar.Clear,
      ResultCount: FilterToolbar.ResultCount,
    }))
      await expect(part.displayName).toBe(`FilterToolbar.${key}`);
  },
};

function RefFixture(args: FilterToolbarCompoundProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <StrictMode>
      {mounted && (
        <FilterToolbar {...args}>
          <FilterToolbar.Controls ref={refs.controls}>
            <Button>Control</Button>
          </FilterToolbar.Controls>
          <FilterToolbar.ActiveFilters ref={refs.active} />
          <FilterToolbar.Clear ref={refs.clear} />
          <FilterToolbar.ResultCount ref={refs.status} count={1} />
        </FilterToolbar>
      )}
      <Button onClick={() => setMounted((value) => !value)}>
        {mounted ? 'Unmount toolbar' : 'Mount toolbar'}
      </Button>
    </StrictMode>
  );
}

export const LightTheme: Story = {
  render: (args) => <Example {...args} />,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};

export const RTL: Story = {
  args: { dir: 'rtl' },
  render: (args) => <Example {...args} />,
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('group')).direction).toBe('rtl');
  },
};

export const ForcedColors: Story = {
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for browser QA with forced colors enabled; this story does not emulate the media query.',
      },
    },
  },
};

export const ReducedMotion: Story = {
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for browser QA with reduced motion enabled; chips reflow without animation and Button owns its feedback transitions.',
      },
    },
  },
};

function ActiveList(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} data-slot="active-list" />;
}
function ActiveChip(props: ComponentPropsWithRef<'li'>) {
  return <li {...props} data-slot="active-chip" />;
}
function ActiveLabel(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="active-label" />;
}
function ActiveRemove(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-slot="active-remove" />;
}

export const ActiveFilterSlots: Story = {
  args: { defaultValue: [OPEN] },
  render: (args) => <FilterToolbar {...args}><FilterToolbar.ActiveFilters slots={{ list: ActiveList, chip: ActiveChip, label: ActiveLabel, remove: ActiveRemove }} /></FilterToolbar>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const part of ['list', 'chip', 'label', 'remove']) {
      await expect(canvasElement.querySelector(`[data-slot="active-${part}"]`)).toBeVisible();
    }
    const remove = canvas.getByRole('button');
    await expect(remove).toHaveAttribute('data-ui', expect.stringContaining('filter-toolbar-remove'));
    await expect(remove).toHaveAttribute('data-filter-id', OPEN.id);
    await userEvent.click(remove);
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
  },
};
