import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, mocked, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { Button } from '../button';
import {
  MultiSelect,
  type MultiSelectCompoundProps,
  type MultiSelectEasyProps,
  type MultiSelectOption,
  type MultiSelectProps,
  type MultiSelectLabelProps,
  type MultiSelectTriggerProps,
} from './index';

// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const ExampleFrame = styled.div({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: vars.space[2], maxInlineSize: '100%' });
const TriggerRow = styled.div({ display: 'flex', gap: vars.space[2], maxInlineSize: '100%' });
const NarrowFrame = styled.div({ inlineSize: '220px' });
// ThemeRoot takes the styling itself: `styled(ThemeRoot)` would collide with Emotion's own
// `theme` prop on the wrapped component.
const scopedThemeStyle = { backgroundColor: vars.color.bg, padding: vars.space[4] } as const;
const LABEL = 'Labels';
const OPTIONS: readonly MultiSelectOption[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'locked', label: 'Locked', disabled: true },
  { value: 'feature', label: 'Feature' },
  { value: 'docs', label: 'Documentation' },
];

const snippet = `import { MultiSelect } from '@jfrader/ui';

<MultiSelect
  label="Labels"
  placeholder="Select labels"
  options={[
    { value: 'bug', label: 'Bug' },
    { value: 'locked', label: 'Locked', disabled: true },
    { value: 'feature', label: 'Feature' },
    { value: 'docs', label: 'Documentation' },
  ]}
  defaultValue={['bug']}
  clearable
/>`;

type CheckedMultiSelect<Props extends MultiSelectProps> = Props;
const compoundSnippet = `<MultiSelect defaultValue={['bug']}>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
    <MultiSelect.Empty />
  </MultiSelect.Content>
</MultiSelect>`;
export type MultiSelectTypeRegression = {
  // @ts-expect-error Options and children are mutually exclusive.
  optionsWithChildren: CheckedMultiSelect<{ options: typeof OPTIONS; children: ReactNode }>;
  // @ts-expect-error Presentation props are rejected in compound mode without options.
  childrenWithLabel: CheckedMultiSelect<{ label: string; children: ReactNode }>;
  // @ts-expect-error Presentation props are rejected in compound mode without options.
  childrenWithClearable: CheckedMultiSelect<{ clearable: true; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slots and slotProps.
  childrenWithSlots: CheckedMultiSelect<{ slots: { root?: () => null }; children: ReactNode }>;
};

type ExampleProps = Omit<
  MultiSelectCompoundProps,
  'size' | 'empty' | 'maxVisible' | 'error' | 'description'
> & {
  empty?: boolean;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  error?: ReactNode;
  description?: ReactNode;
  forced?: boolean;
};
function Example({ empty, maxVisible, size, error, description, forced, children, ...props }: ExampleProps) {
  return (
    <ExampleFrame>
      <MultiSelect {...props}>
        <MultiSelect.Label>{LABEL}</MultiSelect.Label>
        <TriggerRow>
          <MultiSelect.Trigger size={size}>
            <MultiSelect.Value placeholder="Select labels" maxVisible={maxVisible} />
          </MultiSelect.Trigger>
          <MultiSelect.Clear />
        </TriggerRow>
        <MultiSelect.Description>{description}</MultiSelect.Description>
        <MultiSelect.Error>{error}</MultiSelect.Error>
        <MultiSelect.Content>
          {!empty && (
            <>
              <MultiSelect.Item value="bug" disabled={forced}>
                Bug
              </MultiSelect.Item>
              <MultiSelect.Item value="locked" disabled>
                Locked
              </MultiSelect.Item>
              <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
              <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
            </>
          )}
          {children}
          <MultiSelect.Empty />
        </MultiSelect.Content>
      </MultiSelect>
      <Button>After</Button>
    </ExampleFrame>
  );
}
const meta: Meta<MultiSelectCompoundProps> = {
  title: 'Inputs/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs'],
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      description: {
        component:
          'Choose more than one option from a list without closing it after each choice.',
      },
      sections: [
        { title: 'Choose options', stories: ['Default'] },
        { title: 'Selection summaries', stories: ['Overflow', 'OverflowOnly'] },
        { title: 'Field size and feedback', stories: ['Sizes', 'Empty', 'Error'] },
        { title: 'Controlled state and forms', stories: ['EasyControlled', 'Required', 'EasyFormReset'] },
        { title: 'Keyboard', stories: ['Keyboard', 'Typeahead'] },
      ],
      usage: `### When to use
- Use MultiSelect for several choices from a fixed list. Use Select for one choice or Combobox for typed search.

### Keyboard and accessibility

- DOM focus stays on the trigger while an option is highlighted. Toggling an option leaves the list open.
- Arrows wrap and skip disabled options; Home/End reach the ends. Prefix typeahead keeps a 500ms buffer and highlights matches without filtering the list.
- Enter and Space toggle the highlighted option. Escape and Tab close without changing selection; Tab moves focus to the next control.

### Forms

- Clearing the selection keeps disabled selections.
- The spoken selection summary includes options hidden by the visible count limit.
- Named fields submit repeated form entries. Required fields need at least one selection before submission.`,
    },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
type EasyStory = StoryObj<(props: MultiSelectEasyProps) => ReactNode>;
// @ts-expect-error Generated-part slot keys are closed.
type UnknownSlot = NonNullable<MultiSelectEasyProps['slotProps']>['unknown'];
// @ts-expect-error Replacement slot keys are closed.
type UnknownReplacement = NonNullable<MultiSelectEasyProps['slots']>['unknown'];

function MultiSelectRootAdapter(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="custom-multi-select-root" />;
}

/** Restyle the generated label and every option with slotProps. */
export const SlotProps: EasyStory = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { MultiSelect } from '@jfrader/ui';

function LabelsField(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<MultiSelect label="Labels" component={LabelsField}
  options={[
    { value: 'bug', label: 'Bug' },
    { value: 'locked', label: 'Locked', disabled: true },
    { value: 'feature', label: 'Feature' },
    { value: 'docs', label: 'Documentation' },
  ]}
  slotProps={{ label: { sx: { fontStyle: 'italic' } }, item: { className: 'label-option' } }}
/>` } } },
  args: {
    label: 'Labels', options: OPTIONS,
    component: MultiSelectRootAdapter,
    slotProps: { label: { sx: { fontStyle: 'italic' } }, item: { className: 'label-option' } },
  },
  render: (args) => <MultiSelect {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Labels')).toHaveStyle({ fontStyle: 'italic' });
    await expect(canvas.getByTestId('custom-multi-select-root')).toHaveAttribute('data-ui', 'multi-select');
    await userEvent.click(canvas.getByRole('combobox'));
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveClass('label-option');
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Bug' }));
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
  },
};
const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const triggerOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('combobox', { name: LABEL });
async function active(canvasElement: HTMLElement, name: string) {
  const option = body(canvasElement).getByRole('option', { name });
  await waitFor(async () => {
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-activedescendant', option.id);
  });
  await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
}
export const Default: EasyStory = {
  name: 'Choose project labels',
  args: {
    label: LABEL,
    placeholder: 'Select labels',
    options: OPTIONS,
    clearable: true,
    defaultValue: ['bug'],
  },
  render: (args) => (
    <ExampleFrame>
      <MultiSelect {...args} />
      <Button>After</Button>
    </ExampleFrame>
  ),
  parameters: {
    docs: {
      description: { story: 'Select several labels without closing the list, or clear the selection.' },
      source: { language: 'tsx', code: snippet },
    },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const trigger = triggerOf(canvasElement);
    await userEvent.click(trigger);
    await expect(body(canvasElement).getByRole('listbox', { name: LABEL })).toHaveAttribute(
      'aria-multiselectable',
      'true',
    );
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug', 'feature']);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(body(canvasElement).getByRole('option', { name: 'Feature' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const Compound: Story = {
  render: (args) => <Example {...args} defaultValue={['bug']} />,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: compoundSnippet,
      },
    },
  },
};

function CustomLabel(props: MultiSelectLabelProps) {
  return <MultiSelect.Label {...props} data-testid="custom-label" />;
}
function CustomTrigger(props: MultiSelectTriggerProps) {
  return <MultiSelect.Trigger {...props} data-testid="custom-trigger" />;
}

export const CustomSlots: EasyStory = {
  parameters: { docs: { source: { language: 'tsx', code: `import { MultiSelect, styled } from '@jfrader/ui';

const LabelsLabel = styled(MultiSelect.Label)({ fontStyle: 'italic' });
const LabelsTrigger = styled(MultiSelect.Trigger)({ fontWeight: 600 });

<MultiSelect label="Labels" defaultValue={['bug']} clearable
  options={[
    { value: 'bug', label: 'Bug' },
    { value: 'locked', label: 'Locked', disabled: true },
    { value: 'feature', label: 'Feature' },
    { value: 'docs', label: 'Documentation' },
  ]}
  slots={{ label: LabelsLabel, trigger: LabelsTrigger }}
  slotProps={{ root: { className: 'labels-field' } }}
/>` } } },
  render: () => (
    <MultiSelect
      label="Labels"
      options={OPTIONS}
      defaultValue={['bug']}
      clearable
      slots={{
        label: CustomLabel,
        trigger: CustomTrigger,
      }}
      slotProps={{
        root: { 'data-testid': 'custom-root' },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('custom-root')).toBeInTheDocument();
    await expect(canvas.getByTestId('custom-label')).toBeInTheDocument();
    await expect(canvas.getByTestId('custom-trigger')).toBeInTheDocument();
  },
};

export const EasyClearable: EasyStory = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect label="Labels" defaultValue={['bug']} clearable options={[
  { value: 'bug', label: 'Bug' },
  { value: 'locked', label: 'Locked', disabled: true },
  { value: 'feature', label: 'Feature' },
  { value: 'docs', label: 'Documentation' },
]} />` } } },
  render: () => (
    <MultiSelect
      label="Labels"
      options={OPTIONS}
      defaultValue={['bug']}
      clearable
    />
  ),
  play: async ({ canvas, userEvent }) => {
    const clearBtn = canvas.getByRole('button', { name: 'Clear selection' });
    await expect(clearBtn).toBeEnabled();
    await userEvent.click(clearBtn);
    await expect(clearBtn).toBeDisabled();
  },
};

export const EasyFormReset: EasyStory = {
  name: 'Reset a form',
  parameters: { docs: { description: { story: 'Select more labels, then reset the form to restore Bug.' }, source: { language: 'tsx', code: `import { Button, MultiSelect } from '@jfrader/ui';

<form aria-label="Easy multi-select form">
  <MultiSelect label="Labels" name="labels" defaultValue={['bug']} options={[
    { value: 'bug', label: 'Bug' },
    { value: 'locked', label: 'Locked', disabled: true },
    { value: 'feature', label: 'Feature' },
    { value: 'docs', label: 'Documentation' },
  ]} />
  <Button type="reset">Reset</Button>
</form>` } } },
  render: () => (
    <form aria-label="Easy multi-select form">
      <MultiSelect
        label={LABEL}
        name="labels"
        options={OPTIONS}
        defaultValue={['bug']}
      />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvasElement, canvas, userEvent }) => {
    const form = canvasElement.querySelector('form')!;
    const trigger = triggerOf(canvasElement);
    await userEvent.click(trigger);
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    await expect(new FormData(form).getAll('labels')).toEqual(['bug', 'feature']);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(new FormData(form).getAll('labels')).toEqual(['bug']);
    });
  },
};

function EasyControlledExample(props: MultiSelectEasyProps) {
  const [value, setValue] = useState<readonly string[]>(['bug']);
  const [open, setOpen] = useState(false);
  return <MultiSelect {...props} value={value} open={open}
    onValueChange={(next) => { setValue(next); props.onValueChange?.(next); }}
    onOpenChange={(next) => { setOpen(next); props.onOpenChange?.(next); }} />;
}

export const EasyControlled: EasyStory = {
  name: 'Control selection and visibility',
  parameters: { docs: { description: { story: 'Keep the selected labels and popup visibility in React state.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { MultiSelect } from '@jfrader/ui';

function LabelsPicker() {
  const [value, setValue] = useState<readonly string[]>(['bug']);
  const [open, setOpen] = useState(false);
  return <MultiSelect label="Labels" value={value} onValueChange={setValue}
    open={open} onOpenChange={setOpen} options={[
      { value: 'bug', label: 'Bug' },
      { value: 'locked', label: 'Locked', disabled: true },
      { value: 'feature', label: 'Feature' },
      { value: 'docs', label: 'Documentation' },
    ]} />;
}` } } },
  args: { label: LABEL, options: OPTIONS, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <EasyControlledExample {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug', 'feature']);
    await expect(triggerOf(canvasElement)).toHaveTextContent('Feature');
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'false');
  },
};

export const EasyRejectedControlled: EasyStory = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect label="Labels" value={['bug']} options={[
  { value: 'bug', label: 'Bug' },
  { value: 'locked', label: 'Locked', disabled: true },
  { value: 'feature', label: 'Feature' },
  { value: 'docs', label: 'Documentation' },
]} />` } } },
  args: { label: LABEL, options: OPTIONS, value: ['bug'], onValueChange: fn() },
  render: (args) => <MultiSelect {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug', 'feature']);
    await expect(body(canvasElement).getByRole('option', { name: 'Feature' })).toHaveAttribute('aria-selected', 'false');
    await expect(triggerOf(canvasElement)).not.toHaveTextContent('Feature');
  },
};

export const EasyKeyboard: EasyStory = {
  args: { label: LABEL, options: OPTIONS, onValueChange: fn() },
  render: (args) => <MultiSelect {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
    await userEvent.keyboard('{ArrowDown}');
    await active(canvasElement, 'Bug');
    await expect(body(canvasElement).getByRole('option', { name: 'Locked' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Locked' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['feature']);
    await userEvent.keyboard('{End}');
    await active(canvasElement, 'Documentation');
    await userEvent.keyboard('{Home}');
    await active(canvasElement, 'Bug');
    await userEvent.keyboard('{Escape}');
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'false');
  },
};

export const EasyOptionMetadata: EasyStory = {
  args: { label: LABEL, options: [{ value: 'bug', label: 'Bug', textValue: 'Issue', id: 'easy-multi-issue' }], onValueChange: fn() },
  render: (args) => <MultiSelect {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveAttribute('id', 'easy-multi-issue');
    await userEvent.keyboard('i{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
  },
};

function ControlledExample(props: MultiSelectCompoundProps) {
  const [value, setValue] = useState<readonly string[]>(['bug']);
  const [open, setOpen] = useState(false);
  return (
    <Example
      {...props}
      value={value}
      open={open}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}
export const Controlled: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { MultiSelect } from '@jfrader/ui';

function LabelsPicker() {
  const [value, setValue] = useState<readonly string[]>(['bug']);
  const [open, setOpen] = useState(false);
  return (
    <MultiSelect value={value} onValueChange={setValue} open={open} onOpenChange={setOpen}>
      <MultiSelect.Label>Labels</MultiSelect.Label>
      <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
      <MultiSelect.Clear />
      <MultiSelect.Content>
        <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
        <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
        <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
        <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
      </MultiSelect.Content>
    </MultiSelect>
  );
}` } } },
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug', 'feature']);
    await expect(triggerOf(canvasElement)).toHaveTextContent('Feature');
  },
};
export const ControlledOpen: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'true');
  },
};
export const Sizes: Story = {
  name: 'Field sizes',
  parameters: { docs: { description: { story: 'Compare small, medium, and large label pickers.' }, source: { language: 'tsx', code: `import { MultiSelect } from '@jfrader/ui';

<>
  {(['sm', 'md', 'lg'] as const).map((size) => (
    <MultiSelect key={size}>
      <MultiSelect.Label>Labels ({size})</MultiSelect.Label>
      <MultiSelect.Trigger size={size}><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
      <MultiSelect.Clear />
      <MultiSelect.Content>
        <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
        <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
        <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
        <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
      </MultiSelect.Content>
    </MultiSelect>
  ))}
</>` } } },
  render: (args) => (
    <>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Example key={size} {...args} size={size} />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    const controls = canvas.getAllByRole('combobox');
    for (const [index, control] of controls.entries())
      await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual([32, 40, 48][index]! - 1);
  },
};
export const Empty: Story = {
  name: 'No available options',
  parameters: { docs: { description: { story: 'Open the field to see the empty-list message.' }, source: { language: 'tsx', code: `import { MultiSelect } from '@jfrader/ui';

<MultiSelect>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Content><MultiSelect.Empty /></MultiSelect.Content>
</MultiSelect>` } } },
  render: (args) => <Example {...args} empty />,
};
export const Selected: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect defaultValue={['bug', 'feature']}>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  args: { defaultValue: ['bug', 'feature'] },
};
export const Overflow: Story = {
  name: 'Summarize additional selections',
  parameters: { docs: { description: { story: 'Show two selected labels and a count for the remaining selection.' }, source: { language: 'tsx', code: `import { MultiSelect } from '@jfrader/ui';

<MultiSelect defaultValue={['bug', 'feature', 'docs']}>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" maxVisible={2} /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  args: { defaultValue: ['bug', 'feature', 'docs'] },
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement)).toHaveTextContent('+1');
    await expect(triggerOf(canvasElement)).toHaveAccessibleDescription(
      '3 options selected: Bug, Feature, and Documentation',
    );
  },
};
export const OverflowOnly: Story = {
  name: 'Show only the selection count',
  parameters: { docs: { description: { story: 'Replace visible label chips with a count while retaining the spoken selection summary.' }, source: { language: 'tsx', code: `import { MultiSelect } from '@jfrader/ui';

<MultiSelect defaultValue={['bug', 'feature', 'docs']}>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value maxVisible={0} /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  args: Overflow.args,
  render: (args) => <Example {...args} maxVisible={0} />,
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement)).toHaveTextContent('+3');
    await expect(triggerOf(canvasElement)).toHaveAccessibleDescription(
      '3 options selected: Bug, Feature, and Documentation',
    );
  },
};
export const Disabled: Story = {
  tags: ['!autodocs'],
  args: { disabled: true, defaultValue: ['bug'], open: true },
  play: async ({ canvasElement, userEvent, args }) => {
    await expect(triggerOf(canvasElement)).toBeDisabled();
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    const list = body(canvasElement).getByRole('listbox', { name: LABEL });
    await waitFor(async () => {
      await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    });
  },
};
export const DisabledItems: Story = { tags: ['!autodocs'], args: { defaultOpen: true } };
export const DisabledSelectedClear: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect defaultValue={['locked', 'bug', 'unknown']}>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  args: { defaultValue: ['locked', 'bug', 'unknown'] },
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear selection' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['locked']);
    await expect(canvas.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
    await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
  },
};
export const UnknownValue: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect value={['missing']}>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  args: { value: ['missing'] },
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement)).toHaveTextContent('missing');
    await expect(triggerOf(canvasElement)).toHaveAccessibleDescription('1 option selected: missing');
  },
};
export const LongLabels: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['long'], defaultOpen: true },
  render: (args) => (
    <NarrowFrame>
      <Example {...args}>
        <MultiSelect.Item value="long">
          A lengthy label that should remain available in the spoken selection summary
        </MultiSelect.Item>
      </Example>
    </NarrowFrame>
  ),
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement).getBoundingClientRect().width).toBeLessThanOrEqual(221);
  },
};
const LONG_OPTIONS: readonly MultiSelectOption[] = Array.from({ length: 30 }, (_, index) => ({
  value: `label-${index}`,
  label: `Label ${index + 1}: Documentation and international accessibility requirements`,
}));

export const NarrowSelection: EasyStory = {
  tags: ['!autodocs'],
  args: {
    label: 'Project labels',
    description: 'Choose project labels.',
    error: 'Review the selected labels.',
    options: LONG_OPTIONS,
    defaultValue: LONG_OPTIONS.slice(0, 8).map((option) => option.value),
    defaultOpen: true,
    clearable: true,
  },
  render: (args) => <NarrowFrame><MultiSelect {...args} /></NarrowFrame>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    const clear = canvas.getByRole('button', { name: 'Clear selection' });
    const value = trigger.querySelector('[data-ui="multi-select-value"]')!;
    const counter = value.lastElementChild!;
    await expect(counter).toHaveTextContent('+6');
    await expect(counter.clientWidth).toBeGreaterThanOrEqual(counter.scrollWidth);
    await expect(clear.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
    await expect(clear.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await expect(clear.getBoundingClientRect().right).toBeLessThanOrEqual(
      canvas.getByText('Project labels').parentElement!.getBoundingClientRect().right + 1,
    );
    const panel = body(canvasElement).getByRole('listbox');
    await waitFor(async () => {
      const anchor = trigger.getBoundingClientRect();
      const popup = panel.getBoundingClientRect();
      const rtl = getComputedStyle(trigger).direction === 'rtl';
      await expect(Math.abs(rtl ? popup.right - anchor.right : popup.left - anchor.left)).toBeLessThanOrEqual(8);
      await expect(popup.width).toBeCloseTo(Math.max(180, anchor.width), 0);
      await expect(popup.height).toBeLessThanOrEqual(280);
      await expect(popup.top >= anchor.bottom || popup.bottom <= anchor.top).toBe(true);
      await expect(Math.min(Math.abs(popup.top - anchor.bottom), Math.abs(anchor.top - popup.bottom))).toBeLessThanOrEqual(9);
    });
    await expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}{End}');
    await waitFor(async () => {
      const last = body(canvasElement).getAllByRole('option').at(-1)!;
      await expect(trigger).toHaveAttribute('aria-activedescendant', last.id);
      await expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(panel.getBoundingClientRect().bottom);
    });
  },
};

export const GroupedOptions: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <ExampleFrame>
      <MultiSelect {...args} defaultOpen>
        <MultiSelect.Label>Project labels</MultiSelect.Label>
        <MultiSelect.Trigger><MultiSelect.Value placeholder="Choose labels" /></MultiSelect.Trigger>
        <MultiSelect.Content>
          <div role="group" aria-label="Issues">
            <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
            <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
          </div>
          <div role="group" aria-label="Resources">
            <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
            <MultiSelect.Item value="archive" disabled>Archive</MultiSelect.Item>
          </div>
        </MultiSelect.Content>
      </MultiSelect>
    </ExampleFrame>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    const option = body(canvasElement).getByRole('option', { name: 'Documentation' });
    await expect(trigger).toHaveAttribute('aria-activedescendant', option.id);
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(body(canvasElement).getByRole('group', { name: 'Resources' })).toContainElement(option);
  },
};
export const Required: Story = {
  name: 'Require a selection',
  parameters: { docs: { description: { story: 'Submit the form with no labels to focus the field, then select a label to satisfy validation.' }, source: { language: 'tsx', code: `import { Button, MultiSelect } from '@jfrader/ui';

<form>
  <MultiSelect name="labels" required>
    <MultiSelect.Label>Labels</MultiSelect.Label>
    <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
    <MultiSelect.Clear />
    <MultiSelect.Content>
      <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
      <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
      <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
      <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
    </MultiSelect.Content>
  </MultiSelect>
  <Button type="submit">Submit</Button>
</form>` } } },
  args: { required: true, name: 'labels' },
  render: (args) => (
    <form>
      <Example {...args} />
      <Button type="submit">Submit</Button>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const form = canvasElement.querySelector('form')!;
    const trigger = triggerOf(canvasElement);
    await expect(trigger).toHaveAttribute('aria-required', 'true');
    await expect(trigger).not.toHaveAttribute('aria-invalid');
    await expect(form.reportValidity()).toBe(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });
    await userEvent.click(trigger);
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Bug' }));
    await expect(trigger).not.toHaveAttribute('aria-invalid');
    await expect(form.reportValidity()).toBe(true);
    await expect(new FormData(form).getAll('labels')).toEqual(['bug']);
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('button', { name: 'Submit' })).toBeEnabled();
  },
};
export const RequiredSatisfied: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<form>
  <MultiSelect name="labels" required defaultValue={['bug']}>
    <MultiSelect.Label>Labels</MultiSelect.Label>
    <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
    <MultiSelect.Clear />
    <MultiSelect.Content>
      <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
      <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
      <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
      <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
    </MultiSelect.Content>
  </MultiSelect>
  <Button type="submit">Submit</Button>
</form>` } } },
  args: { required: true, name: 'labels', defaultValue: ['bug'] },
  render: Required.render,
  play: async ({ canvas, canvasElement }) => {
    const form = canvasElement.querySelector('form')!;
    const submit = canvas.getByRole('button', { name: 'Submit' });
    submit.focus();
    await expect(form.reportValidity()).toBe(true);
    await expect(canvasElement.ownerDocument.activeElement).toBe(submit);
    await expect(triggerOf(canvasElement)).not.toHaveAttribute('aria-invalid');
    await expect(new FormData(form).getAll('labels')).toEqual(['bug']);
  },
};
export const Error: Story = {
  name: 'Invalid field',
  parameters: { docs: { description: { story: 'Display a validation message alongside the field description.' }, source: { language: 'tsx', code: `import { MultiSelect } from '@jfrader/ui';

<MultiSelect>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Description>Project labels</MultiSelect.Description>
  <MultiSelect.Error>Choose a label</MultiSelect.Error>
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  render: (args) => <Example {...args} error="Choose a label" description="Project labels" />,
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(triggerOf(canvasElement)).toHaveAccessibleDescription(
      '0 options selected Project labels Choose a label',
    );
  },
};
export const ExternalAria: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { MultiSelect } from '@jfrader/ui';

function LabelsPicker() {
  const nameId = useId();
  const descriptionId = useId();
  return <>
    <span id={nameId}>Project</span>
    <span id={descriptionId}>Choose project labels</span>
    <MultiSelect>
      <MultiSelect.Label>Labels</MultiSelect.Label>
      <MultiSelect.Trigger aria-labelledby={nameId} aria-describedby={descriptionId}>
        <MultiSelect.Value placeholder="Select labels" />
      </MultiSelect.Trigger>
      <MultiSelect.Description>Multiple selections allowed</MultiSelect.Description>
      <MultiSelect.Content><MultiSelect.Item value="bug">Bug</MultiSelect.Item></MultiSelect.Content>
    </MultiSelect>
  </>;
}` } } },
  render: (args) => (
    <>
      <span id="external-name">External</span>
      <span id="external-description">Description</span>
      <MultiSelect {...args}>
        <MultiSelect.Label>Labels</MultiSelect.Label>
        <MultiSelect.Trigger
          aria-label="Fallback"
          aria-labelledby="external-name unresolved"
          aria-describedby="external-description"
        >
          <MultiSelect.Value placeholder="Select labels" />
        </MultiSelect.Trigger>
        <MultiSelect.Description>Internal description</MultiSelect.Description>
        <MultiSelect.Content>
          <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
        </MultiSelect.Content>
      </MultiSelect>
    </>
  ),
  play: async ({ canvas, userEvent, canvasElement }) => {
    const trigger = canvas.getByRole('combobox', { name: 'External Labels' });
    await expect(trigger).toHaveAttribute('aria-label', 'Fallback');
    await expect(trigger.getAttribute('aria-labelledby')).toContain('unresolved');
    await expect(trigger).toHaveAccessibleDescription('Description 0 options selected Internal description');
    await userEvent.click(trigger);
    await waitFor(async () => {
      await expect(body(canvasElement).getByRole('listbox', { name: 'External Labels' })).toBeVisible();
    });
  },
};
export const BooleanAndZeroNodes: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<>
  {([false, null, 0, ''] as const).map((message, index) => (
    <MultiSelect key={index}>
      <MultiSelect.Label>Labels</MultiSelect.Label>
      <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
      <MultiSelect.Description>{message}</MultiSelect.Description>
      <MultiSelect.Error>{message}</MultiSelect.Error>
      <MultiSelect.Content>
        <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
        <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
      </MultiSelect.Content>
    </MultiSelect>
  ))}
</>` } } },
  render: (args) => (
    <>
      {([false, null, 0, ''] as const).map((node, index) => (
        <Example key={index} {...args} error={node} description={node} />
      ))}
    </>
  ),
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
    await expect(canvas.getAllByRole('alert')[0]).toHaveTextContent('0');
    await expect(canvasElement.querySelectorAll('[data-ui="multi-select-description"]')).toHaveLength(2);
  },
};
export const FormReset: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<form>
  <MultiSelect name="labels" defaultValue={['bug']}>
    <MultiSelect.Label>Labels</MultiSelect.Label>
    <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
    <MultiSelect.Clear />
    <MultiSelect.Content>
      <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
      <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
      <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
      <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
    </MultiSelect.Content>
  </MultiSelect>
  <Button type="reset">Reset</Button>
</form>` } } },
  args: { defaultValue: ['bug'], name: 'labels' },
  render: (args) => (
    <form>
      <Example {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    const form = canvasElement.querySelector('form')!;
    await expect(new FormData(form).getAll('labels')).toEqual(['bug', 'feature']);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(new FormData(form).getAll('labels')).toEqual(['bug']);
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
  },
};
export const ControlledReject: Story = {
  tags: ['!autodocs'],
  args: { value: [], open: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const trigger = triggerOf(canvasElement);
    await userEvent.click(trigger);
    await userEvent.keyboard('{Home}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(trigger).toHaveAccessibleDescription('0 options selected');
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};
export const ControlledValueUncontrolledOpen: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect value={[]}>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  args: { value: [] },
  play: async ({ canvasElement, userEvent, args }) => {
    const trigger = triggerOf(canvasElement);
    await userEvent.click(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Bug' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(trigger).toHaveAccessibleDescription('0 options selected');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const ControlledOpenUncontrolledValue: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const trigger = triggerOf(canvasElement);
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Bug' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(trigger).toHaveAccessibleDescription('1 option selected: Bug');
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};
function ExternalUpdatesExample(props: MultiSelectCompoundProps) {
  const [value, setValue] = useState<readonly string[]>(['bug']);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Example {...props} value={value} open={open} />
      <Button onClick={() => setValue(['docs', 'feature'])}>Set value</Button>
      <Button onClick={() => setOpen(true)}>Open list</Button>
    </>
  );
}
export const ExternalUpdates: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, MultiSelect } from '@jfrader/ui';

function LabelsPicker() {
  const [value, setValue] = useState<readonly string[]>(['bug']);
  const [open, setOpen] = useState(false);
  return <>
    <MultiSelect value={value} open={open}>
      <MultiSelect.Label>Labels</MultiSelect.Label>
      <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
      <MultiSelect.Clear />
      <MultiSelect.Content>
        <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
        <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
        <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
        <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
      </MultiSelect.Content>
    </MultiSelect>
    <Button onClick={() => setValue(['docs', 'feature'])}>Set value</Button>
    <Button onClick={() => setOpen(true)}>Open list</Button>
  </>;
}` } } },
  render: (args) => <ExternalUpdatesExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = triggerOf(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Set value' }));
    await expect(trigger).toHaveAccessibleDescription('2 options selected: Documentation and Feature');
    await userEvent.click(canvas.getByRole('button', { name: 'Open list' }));
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
const duplicatedValue = Object.freeze(['bug', 'feature', 'bug']);
export const DuplicateValues: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<form>
  <MultiSelect name="labels" value={['bug', 'feature', 'bug']}>
    <MultiSelect.Label>Labels</MultiSelect.Label>
    <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
    <MultiSelect.Clear />
    <MultiSelect.Content>
      <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
      <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
      <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
      <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
    </MultiSelect.Content>
  </MultiSelect>
  <Button type="submit">Submit</Button>
</form>` } } },
  args: { value: duplicatedValue, name: 'labels' },
  render: Required.render,
  play: async ({ canvasElement, userEvent, args }) => {
    const form = canvasElement.querySelector('form')!;
    const trigger = triggerOf(canvasElement);
    await expect(trigger).toHaveAccessibleDescription('2 options selected: Bug and Feature');
    await expect(new FormData(form).getAll('labels')).toEqual(['bug', 'feature']);
    await userEvent.click(trigger);
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Documentation' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug', 'feature', 'docs']);
    await expect(mocked(args.onValueChange!).mock.calls[0]![0]).not.toBe(duplicatedValue);
    await expect(duplicatedValue).toEqual(['bug', 'feature', 'bug']);
    await userEvent.keyboard('{Escape}');
  },
};
export const TwoInstances: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <>
      <Example {...args} />
      <Example {...args} />
    </>
  ),
  play: async ({ canvasElement, canvas }) => {
    const document = canvasElement.ownerDocument;
    const triggers = canvas.getAllByRole('combobox', { name: LABEL });
    await expect(triggers).toHaveLength(2);
    const [first, second] = triggers as [HTMLElement, HTMLElement];
    await expect(first.id).not.toBe(second.id);
    await expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'));
    for (const trigger of triggers) {
      const list = document.getElementById(trigger.getAttribute('aria-controls')!)!;
      await expect(list).toHaveAttribute('role', 'listbox');
      await expect(within(list).getAllByRole('option')).toHaveLength(4);
      const label = document.querySelector(`label[for="${CSS.escape(trigger.id)}"]`);
      await expect(label).toHaveTextContent(LABEL);
    }
    const ids = [...document.querySelectorAll('[data-ui^="multi-select"][id]')].map((element) => element.id);
    await expect(new Set(ids).size).toBe(ids.length);
  },
};
export const PersistentOpen: Story = { tags: ['!autodocs'], args: { open: true } };
export const PersistentOpenSelected: Story = {
  tags: ['!autodocs'],
  args: { open: true, defaultValue: ['bug', 'locked'] },
};
// Deliberately leaves an open listbox with zero options for the axe gate; the empty status is
// announced outside the listbox, so the listbox holds no non-option semantics.
export const PersistentOpenEmpty: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  render: (args) => <Example {...args} empty />,
  play: async ({ canvasElement }) => {
    const list = body(canvasElement).getByRole('listbox', { name: LABEL });
    await waitFor(async () => {
      await expect(list).toBeVisible();
    });
    await expect(within(list).queryAllByRole('option')).toHaveLength(0);
    const status = body(canvasElement)
      .getAllByRole('status')
      .find((element) => element.textContent === 'No options');
    await expect(status).toBeDefined();
    await expect(list.contains(status!)).toBe(false);
  },
};
export const Keyboard: Story = {
  name: 'Keyboard navigation',
  parameters: { docs: { description: { story: 'Use arrows to highlight labels, Enter or Space to toggle them, and Escape to close the list.' }, source: { language: 'tsx', code: `import { MultiSelect } from '@jfrader/ui';

<MultiSelect>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
    <MultiSelect.Empty />
  </MultiSelect.Content>
</MultiSelect>` } } },
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    const trigger = triggerOf(canvasElement);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await active(canvasElement, 'Bug');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
    await userEvent.keyboard('{ArrowDown}');
    await active(canvasElement, 'Feature');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug', 'feature']);
    await userEvent.keyboard('{End}');
    await active(canvasElement, 'Documentation');
    await userEvent.keyboard('{ArrowDown}');
    await active(canvasElement, 'Bug');
    await userEvent.keyboard('{ArrowUp}');
    await active(canvasElement, 'Documentation');
    await userEvent.keyboard('{Home}');
    await active(canvasElement, 'Bug');
    await userEvent.keyboard('{Backspace}{Delete}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowUp}');
    await active(canvasElement, 'Bug');
    await userEvent.tab();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Clear selection' }),
    );
    await userEvent.tab({ shift: true });
    await userEvent.keyboard(' ');
    await active(canvasElement, 'Bug');
    await userEvent.tab({ shift: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const Typeahead: Story = {
  name: 'Find by typing',
  parameters: { docs: { description: { story: 'Type a label prefix to highlight a match without filtering or selecting it.' }, source: { language: 'tsx', code: `import { MultiSelect } from '@jfrader/ui';

<MultiSelect>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('fe');
    await active(canvasElement, 'Feature');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['feature']);
    await userEvent.keyboard('{Escape}');
  },
};
export const LightTheme: Story = {
  ...PersistentOpenSelected,
  tags: ['!autodocs'],
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
export const ScopedThemePortal: Story = {
  ...PersistentOpenSelected,
  tags: ['!autodocs'],
  render: (args) => (
    <ThemeRoot theme="light" sx={scopedThemeStyle}>
      <Example {...args} />
    </ThemeRoot>
  ),
};
export const RTL: Story = {
  ...PersistentOpenSelected,
  tags: ['!autodocs'],
  render: (args) => (
    <div dir="rtl">
      <Example {...args} />
    </div>
  ),
};
export const ReducedMotion: Story = {
  ...PersistentOpenSelected,
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in the browser to check that animation is removed.',
      },
    },
  },
};
export const ForcedColors: Story = {
  ...PersistentOpenSelected,
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in the browser to check borders, check marks and the highlight outline.',
      },
    },
  },
};

export const ClearKeyboard: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['bug'], defaultOpen: true },
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Clear selection' }),
    );
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'false');
  },
};
export const ClearRejected: Story = {
  tags: ['!autodocs'],
  args: { value: ['bug'], open: true },
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear selection' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Clear selection' }),
    );
    await expect(triggerOf(canvasElement)).toHaveTextContent('Bug');
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'true');
  },
};
export const DisabledForm: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<form>
  <MultiSelect name="labels" disabled required defaultValue={['bug', 'bug', 'locked']}>
    <MultiSelect.Label>Labels</MultiSelect.Label>
    <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
    <MultiSelect.Clear />
    <MultiSelect.Content>
      <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
      <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
      <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
      <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
    </MultiSelect.Content>
  </MultiSelect>
</form>` } } },
  args: { name: 'labels', disabled: true, required: true, defaultValue: ['bug', 'bug', 'locked'] },
  render: (args) => (
    <form>
      <Example {...args} />
    </form>
  ),
  play: async ({ canvasElement, args }) => {
    const form = canvasElement.querySelector('form')!;
    await expect(new FormData(form).getAll('labels')).toEqual([]);
    await expect(form.checkValidity()).toBe(true);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ItemUpdates: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, MultiSelect } from '@jfrader/ui';

function LabelsPicker() {
  const [updated, setUpdated] = useState(false);
  return <>
    <MultiSelect defaultValue={['bug']}>
      <MultiSelect.Label>Labels</MultiSelect.Label>
      <MultiSelect.Trigger><MultiSelect.Value /></MultiSelect.Trigger>
      <MultiSelect.Content>
        <MultiSelect.Item value="bug">{updated ? 'Renamed bug' : 'Bug'}</MultiSelect.Item>
        {!updated && <MultiSelect.Item value="gone">Temporary</MultiSelect.Item>}
      </MultiSelect.Content>
    </MultiSelect>
    <Button onClick={() => setUpdated(true)}>Update options</Button>
  </>;
}` } } },
  render: (args) => <DynamicItems {...args} />,
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.keyboard('{End}');
    const removedId = triggerOf(canvasElement).getAttribute('aria-activedescendant');
    await userEvent.click(canvas.getByRole('button', { name: 'Update options' }));
    await expect(triggerOf(canvasElement)).toHaveTextContent('Renamed bug');
    await expect(canvasElement.ownerDocument.getElementById(removedId!)).toBeNull();
    await expect(triggerOf(canvasElement)).not.toHaveAttribute('aria-activedescendant', removedId!);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
function DynamicItems(props: MultiSelectCompoundProps) {
  const [updated, setUpdated] = useState(false);
  return (
    <>
      <MultiSelect {...props} defaultValue={['bug']}>
        <MultiSelect.Label>{LABEL}</MultiSelect.Label>
        <MultiSelect.Trigger>
          <MultiSelect.Value />
        </MultiSelect.Trigger>
        <MultiSelect.Content>
          <MultiSelect.Item value="bug">{updated ? 'Renamed bug' : 'Bug'}</MultiSelect.Item>
          {!updated && <MultiSelect.Item value="gone">Temporary</MultiSelect.Item>}
        </MultiSelect.Content>
      </MultiSelect>
      <Button onClick={() => setUpdated(true)}>Update options</Button>
    </>
  );
}
export const RefAndStyling: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <MultiSelect {...args}>
      <MultiSelect.Trigger
        ref={captureTrigger}
        aria-label="Styled labels"
        sx={{ outlineColor: vars.color.dangerText, minBlockSize: vars.space[12] }}
      >
        <MultiSelect.Value placeholder="Select labels" />
      </MultiSelect.Trigger>
      <MultiSelect.Content id="custom-list">
        <MultiSelect.Item id="custom-option" value="bug" sx={{ paddingInline: vars.space[4] }}>
          Bug
        </MultiSelect.Item>
      </MultiSelect.Content>
    </MultiSelect>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await expect(capturedTrigger).toBe(trigger);
    await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(47);
    await expect(trigger).toHaveAttribute('aria-controls', 'custom-list');
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}');
    await expect(trigger).toHaveAttribute('aria-activedescendant', 'custom-option');
    const option = body(canvasElement).getByRole('option');
    await expect(parseFloat(getComputedStyle(option).paddingInlineStart)).toBeGreaterThan(15);
  },
};
let capturedTrigger: HTMLButtonElement | null = null;
const captureTrigger = (element: HTMLButtonElement | null) => {
  capturedTrigger = element;
};

export const ConsumerVeto: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect>
  <MultiSelect.Trigger aria-label="Labels"
    onKeyDown={(event) => event.preventDefault()}
    onClick={(event) => event.preventDefault()}>
    <MultiSelect.Value placeholder="Select labels" />
  </MultiSelect.Trigger>
  <MultiSelect.Content><MultiSelect.Item value="bug">Bug</MultiSelect.Item></MultiSelect.Content>
</MultiSelect>` } } },
  render: (args) => (
    <MultiSelect {...args}>
      <MultiSelect.Trigger
        aria-label={LABEL}
        onKeyDown={(event) => event.preventDefault()}
        onClick={(event) => event.preventDefault()}
      >
        <MultiSelect.Value placeholder="Select labels" />
      </MultiSelect.Trigger>
      <MultiSelect.Content>
        <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
      </MultiSelect.Content>
    </MultiSelect>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.keyboard('{Enter} {ArrowDown}b');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'false');
  },
};
export const ToggleTwiceAndRepeat: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<MultiSelect>
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="locked" disabled>Locked</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
    <MultiSelect.Item value="docs">Documentation</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>` } } },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
    await userEvent.keyboard('{Enter>3/}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await userEvent.keyboard(',{Backspace}{Delete}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'true');
  },
};

export const ClearPointerOrder: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['bug'], defaultOpen: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear selection' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(mocked(args.onValueChange!).mock.invocationCallOrder[0]).toBeLessThan(
      mocked(args.onOpenChange!).mock.invocationCallOrder[0]!,
    );
    await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
  },
};

export const ExternalForm: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { Button, MultiSelect } from '@jfrader/ui';

function LabelsForm() {
  const formId = useId();
  return <>
    <form id={formId}><Button type="reset">Reset</Button></form>
    <MultiSelect name="labels" required defaultValue={['bug']}>
      <MultiSelect.Trigger form={formId} aria-label="Labels">
        <MultiSelect.Value placeholder="Select labels" />
      </MultiSelect.Trigger>
      <MultiSelect.Clear />
      <MultiSelect.Content>
        <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
        <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
      </MultiSelect.Content>
    </MultiSelect>
  </>;
}` } } },
  args: { name: 'labels', required: true, defaultValue: ['bug'] },
  render: (args) => (
    <>
      <form id="labels-form">
        <Button type="reset">Reset</Button>
      </form>
      <MultiSelect {...args}>
        <MultiSelect.Trigger form="labels-form" aria-label={LABEL}>
          <MultiSelect.Value placeholder="Select labels" />
        </MultiSelect.Trigger>
        <MultiSelect.Clear />
        <MultiSelect.Content>
          <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
          <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
        </MultiSelect.Content>
      </MultiSelect>
    </>
  ),
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    const form = canvasElement.querySelector('form')!;
    await expect(new FormData(form).getAll('labels')).toEqual(['bug']);
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Feature' }));
    await expect(new FormData(form).getAll('labels')).toEqual(['bug', 'feature']);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(new FormData(form).getAll('labels')).toEqual(['bug']);
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Clear selection' }));
    await expect(form.reportValidity()).toBe(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-invalid', 'true');
  },
};
