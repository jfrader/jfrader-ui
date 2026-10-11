import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { Button } from '../button';
import { MultiSelect, type MultiSelectProps } from './index';

const LABEL = 'Labels';
const snippet = `<MultiSelect defaultValue={['bug']} name="labels">
  <MultiSelect.Label>Labels</MultiSelect.Label>
  <MultiSelect.Trigger><MultiSelect.Value placeholder="Select labels" /></MultiSelect.Trigger>
  <MultiSelect.Clear />
  <MultiSelect.Content>
    <MultiSelect.Item value="bug">Bug</MultiSelect.Item>
    <MultiSelect.Item value="feature">Feature</MultiSelect.Item>
  </MultiSelect.Content>
</MultiSelect>`;
type ExampleProps = MultiSelectProps & {
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
const meta = {
  title: 'Inputs/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs'],
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      source: { code: snippet },
      description: {
        component:
          'A select-only combobox with a persistent multiple-selection listbox. Enter and Space toggle the highlighted option; Escape and Tab close without changing selection. Clear preserves disabled selections. Named fields submit repeated form entries, with a separate native validation input for required selection.',
      },
    },
  },
} satisfies Meta<typeof MultiSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
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
export const Default: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const trigger = triggerOf(canvasElement);
    await userEvent.click(trigger);
    await expect(body(canvasElement).getByRole('listbox', { name: LABEL })).toHaveAttribute(
      'aria-multiselectable',
      'true',
    );
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Bug' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bug']);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(body(canvasElement).getByRole('option', { name: 'Bug' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};
function ControlledExample(props: MultiSelectProps) {
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
    await expect(triggerOf(canvasElement)).toHaveAttribute('aria-required', 'true');
    await expect(form.checkValidity()).toBe(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
    await userEvent.click(triggerOf(canvasElement));
    await userEvent.click(body(canvasElement).getByRole('option', { name: 'Bug' }));
    await expect(form.checkValidity()).toBe(true);
    await expect(new FormData(form).getAll('labels')).toEqual(['bug']);
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('button', { name: 'Submit' })).toBeEnabled();
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
export const PersistentOpen: Story = { args: { open: true } };
export const PersistentOpenSelected: Story = {
  args: { open: true, defaultValue: ['bug', 'locked'] },
};
export const PersistentOpenEmpty: Story = {
  args: { open: true },
  render: (args) => <Example {...args} empty />,
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
        story: 'Structural fixture. Enable reduced motion in the browser to inspect the animation override.',
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
          'Structural fixture. Enable forced colors in the browser to inspect borders, checks, and the active outline.',
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
function DynamicItems(props: MultiSelectProps) {
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
    await expect(args.onValueChange!.mock.invocationCallOrder[0]).toBeLessThan(
      args.onOpenChange!.mock.invocationCallOrder[0]!,
    );
    await expect(canvasElement.ownerDocument.activeElement).toBe(triggerOf(canvasElement));
  },
};
