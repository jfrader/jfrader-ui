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

const LABEL = 'Labels';
const OPTIONS: readonly MultiSelectOption[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'locked', label: 'Locked', disabled: true },
  { value: 'feature', label: 'Feature' },
  { value: 'docs', label: 'Documentation' },
];

const snippet = `<MultiSelect
  label="Labels"
  placeholder="Select labels"
  options={[
    { value: 'bug', label: 'Bug' },
    { value: 'feature', label: 'Feature' },
    { value: 'docs', label: 'Documentation' },
  ]}
  defaultValue={['bug']}
  clearable
  name="labels"
/>`;

type CheckedMultiSelect<Props extends MultiSelectProps> = Props;
const compoundSnippet = `<MultiSelect defaultValue={['bug']} name="labels">
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: vars.space[2],
        maxInlineSize: '100%',
      }}
    >
      <MultiSelect {...props}>
        <MultiSelect.Label>{LABEL}</MultiSelect.Label>
        <div style={{ display: 'flex', gap: vars.space[2], maxInlineSize: '100%' }}>
          <MultiSelect.Trigger size={size}>
            <MultiSelect.Value placeholder="Select labels" maxVisible={maxVisible} />
          </MultiSelect.Trigger>
          <MultiSelect.Clear />
        </div>
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
    </div>
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
      usage: `- MultiSelect is a select-only combobox with a listbox. It uses virtual focus: DOM focus stays on the trigger while an option is highlighted. Toggling an option leaves the list open.
- Arrows and Home/End move the highlight. Prefix typeahead keeps a 500ms buffer.
- Enter and Space toggle the highlighted option. Escape and Tab close without changing selection.
- Clear keeps disabled selections.
- Named fields submit repeated form entries. A separate native input validates required selection.`,
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
  args: {
    label: 'Labels', options: OPTIONS,
    component: MultiSelectRootAdapter,
    slotProps: { label: { css: { fontStyle: 'italic' } }, item: { className: 'label-option' } },
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
  args: {
    label: LABEL,
    placeholder: 'Select labels',
    options: OPTIONS,
    clearable: true,
    defaultValue: ['bug'],
  },
  render: (args) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: vars.space[2],
        maxInlineSize: '100%',
      }}
    >
      <MultiSelect {...args} />
      <Button>After</Button>
    </div>
  ),
  parameters: {
    docs: {
      source: { code: snippet },
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
  args: { open: true },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(triggerOf(canvasElement));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-expanded', 'true');
  },
};
export const Sizes: Story = {
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
export const Empty: Story = { render: (args) => <Example {...args} empty /> };
export const Selected: Story = { args: { defaultValue: ['bug', 'feature'] } };
export const Overflow: Story = {
  args: { defaultValue: ['bug', 'feature', 'docs'] },
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement)).toHaveTextContent('+1');
    await expect(triggerOf(canvasElement)).toHaveAccessibleDescription(
      '3 options selected: Bug, Feature, and Documentation',
    );
  },
};
export const OverflowOnly: Story = {
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
export const DisabledItems: Story = { args: { defaultOpen: true } };
export const DisabledSelectedClear: Story = {
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
  args: { value: ['missing'] },
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement)).toHaveTextContent('missing');
    await expect(triggerOf(canvasElement)).toHaveAccessibleDescription('1 option selected: missing');
  },
};
export const LongLabels: Story = {
  args: { defaultValue: ['long'], defaultOpen: true },
  render: (args) => (
    <div style={{ inlineSize: '220px' }}>
      <Example {...args}>
        <MultiSelect.Item value="long">
          A lengthy label that should remain available in the spoken selection summary
        </MultiSelect.Item>
      </Example>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement).getBoundingClientRect().width).toBeLessThanOrEqual(221);
  },
};
export const Required: Story = {
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
  render: (args) => <Example {...args} error="Choose a label" description="Project labels" />,
  play: async ({ canvasElement }) => {
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(triggerOf(canvasElement)).toHaveAccessibleDescription(
      '0 options selected Project labels Choose a label',
    );
  },
};
export const ExternalAria: Story = {
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
export const PersistentOpen: Story = { args: { open: true } };
export const PersistentOpenSelected: Story = {
  args: { open: true, defaultValue: ['bug', 'locked'] },
};
// Deliberately leaves an open listbox with zero options for the axe gate; the empty status is
// announced outside the listbox, so the listbox holds no non-option semantics.
export const PersistentOpenEmpty: Story = {
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
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
export const ScopedThemePortal: Story = {
  ...PersistentOpenSelected,
  render: (args) => (
    <ThemeRoot theme="light" style={{ backgroundColor: vars.color.bg, padding: vars.space[4] }}>
      <Example {...args} />
    </ThemeRoot>
  ),
};
export const RTL: Story = {
  ...PersistentOpenSelected,
  render: (args) => (
    <div dir="rtl">
      <Example {...args} />
    </div>
  ),
};
export const ReducedMotion: Story = {
  ...PersistentOpenSelected,
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
