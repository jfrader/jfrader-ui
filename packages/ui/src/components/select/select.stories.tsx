import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Button } from '../button';
import { Select, type SelectProps } from './index';

const LABEL = 'Fruit';
const PLACEHOLDER = 'Pick a fruit';
const TYPEAHEAD_PAUSE_MS = 550;

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
});

const meta = {
  title: 'Inputs/Select',
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

function SelectExample(props: SelectProps) {
  const labelId = useId();
  return (
    <div css={rowStyle}>
      <span id={labelId}>{LABEL}</span>
      <Select {...props}>
        <Select.Trigger aria-labelledby={labelId}>
          <Select.Value placeholder={PLACEHOLDER} />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana" disabled>
            Banana
          </Select.Item>
          <Select.Item value="cherry">Cherry</Select.Item>
          {props.children}
        </Select.Content>
      </Select>
      <Button>After</Button>
    </div>
  );
}

function ControlledSelect(props: SelectProps) {
  const [value, setValue] = useState('apple');
  const [open, setOpen] = useState(false);
  const [callbackOrder, setCallbackOrder] = useState<string[]>([]);
  return (
    <>
      <SelectExample
        {...props}
        value={value}
        onValueChange={(next) => {
          setCallbackOrder((order) => [...order, `value:${next}`]);
          setValue(next);
          props.onValueChange?.(next);
        }}
        open={open}
        onOpenChange={(next) => {
          setCallbackOrder((order) => [...order, `open:${next}`]);
          setOpen(next);
          props.onOpenChange?.(next);
        }}
      />
      <output aria-label="Callback order">{callbackOrder.join(',')}</output>
    </>
  );
}

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

function getTrigger(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('combobox', { name: LABEL });
}

function getOption(canvasElement: HTMLElement, name: string) {
  return bodyOf(canvasElement).getByRole('option', { name });
}

/** Virtual focus: the option is referenced by aria-activedescendant while DOM focus stays on the trigger. */
async function expectActive(canvasElement: HTMLElement, name: string) {
  const trigger = getTrigger(canvasElement);
  await waitFor(() => expect(trigger).toHaveAttribute('aria-activedescendant', getOption(canvasElement, name).id));
  await expect(getOption(canvasElement, name)).toHaveAttribute('data-active');
  await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('listbox')).toBeNull());
  const trigger = getTrigger(canvasElement);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).not.toHaveAttribute('aria-activedescendant');
}

async function focusTrigger(canvasElement: HTMLElement) {
  const trigger = getTrigger(canvasElement);
  await userEvent.tab();
  await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  return trigger;
}

export const Default: Story = {
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <SelectExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger.tagName).toBe('BUTTON');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');
    await waitFor(() => expect(trigger).toHaveTextContent('Apple'));

    await userEvent.click(trigger);
    const listbox = await bodyOf(canvasElement).findByRole('listbox', { name: LABEL });
    await expect(canvasElement.contains(listbox)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    await expect(within(listbox).getAllByRole('option')).toHaveLength(3);
    await expect(getOption(canvasElement, 'Apple')).toHaveAttribute('aria-selected', 'true');
    await expect(getOption(canvasElement, 'Cherry')).toHaveAttribute('aria-selected', 'false');
    // Pointer open highlights the selected option.
    await expectActive(canvasElement, 'Apple');

    await userEvent.click(getOption(canvasElement, 'Cherry'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expectClosed(canvasElement);
    await expect(trigger).toHaveTextContent('Cherry');
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const Placeholder: Story = {
  render: (args) => <SelectExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveTextContent(PLACEHOLDER);

    // Without a selection, opening highlights the first enabled option.
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Apple');
  },
};

export const Controlled: Story = {
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ControlledSelect {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await waitFor(() => expect(trigger).toHaveTextContent('Apple'));

    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('listbox');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(getOption(canvasElement, 'Cherry'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(trigger).toHaveTextContent('Cherry');

    await expect(within(canvasElement).getByLabelText('Callback order')).toHaveTextContent(
      'open:true,value:cherry,open:false',
    );
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Cherry');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    // Re-selecting the current value closes without a value notification.
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const Keyboard: Story = {
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <SelectExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const trigger = await focusTrigger(canvasElement);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');

    // Enter opens on the selected option; DOM focus stays on the trigger.
    await userEvent.keyboard('{Enter}');
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Apple');
    await expect(getComputedStyle(getOption(canvasElement, 'Apple')).outlineStyle).not.toBe('none');

    // The disabled option stays listed but arrows skip it, and arrows wrap.
    await expect(getOption(canvasElement, 'Banana')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apple');
    await userEvent.keyboard('{ArrowUp}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{End}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Home}');
    await expectActive(canvasElement, 'Apple');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');

    // Enter selects once and closes; focus never left the trigger.
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expect(trigger).toHaveTextContent('Cherry');
    await expect(ownerDocument.activeElement).toBe(trigger);

    // Space opens on the new selection; Escape closes without changing the value.
    await userEvent.keyboard(' ');
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{ArrowUp}');
    await expectActive(canvasElement, 'Apple');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(trigger).toHaveTextContent('Cherry');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(ownerDocument.activeElement).toBe(trigger);

    // Space selects too.
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apple');
    await userEvent.keyboard(' ');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('apple');

    // Tab closes without selecting and moves on to the next control.
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apple');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.tab();
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(trigger).toHaveTextContent('Apple');
    await expect(ownerDocument.activeElement).toBe(within(canvasElement).getByRole('button', { name: 'After' }));
  },
};

export const ArrowUpOpensLast: Story = {
  render: (args) => <SelectExample {...args} />,
  play: async ({ canvasElement }) => {
    // Without a selection, ArrowUp opens on the last enabled option.
    await focusTrigger(canvasElement);
    await userEvent.keyboard('{ArrowUp}');
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Cherry');
  },
};

export const KeyboardClosed: Story = {
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <SelectExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await waitFor(() => expect(trigger).toHaveTextContent('Apple'));

    // APG select-only: a printable character on the closed trigger opens the listbox on the
    // match without changing the value.
    await userEvent.keyboard('c');
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Cherry');
    await expect(trigger).toHaveTextContent('Apple');
    await expect(args.onValueChange).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expect(trigger).toHaveTextContent('Cherry');

    // Typeahead skips the disabled option ("b" matches only Banana, so nothing moves).
    await userEvent.keyboard('{Enter}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('b');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const TypeaheadAcrossOpening: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <Select {...args}>
      <Select.Trigger aria-label={LABEL}>
        <Select.Value placeholder={PLACEHOLDER} />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="apricot">Apricot</Select.Item>
        <Select.Item value="peach">Peach</Select.Item>
      </Select.Content>
    </Select>
  ),
  play: async ({ args, canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await expectClosed(canvasElement);
    await userEvent.keyboard('ap');
    await expectActive(canvasElement, 'Apricot');

    await new Promise((resolve) => setTimeout(resolve, TYPEAHEAD_PAUSE_MS));
    await userEvent.keyboard('pe');
    await expectActive(canvasElement, 'Peach');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await new Promise((resolve) => setTimeout(resolve, TYPEAHEAD_PAUSE_MS));
    await userEvent.keyboard('A');
    await expectActive(canvasElement, 'Apple');
    await expect(trigger).toHaveTextContent(PLACEHOLDER);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const OutsidePress: Story = {
  args: { defaultValue: 'apple', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <SelectExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await expectActive(canvasElement, 'Apple');
    const outside = within(canvasElement).getByRole('button', { name: 'After' });
    await userEvent.click(outside);
    await expectClosed(canvasElement);
    await expect(outside).toHaveFocus();
    await expect(trigger).not.toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const DisabledItem: Story = {
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <SelectExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Apple');

    const banana = getOption(canvasElement, 'Banana');
    await expect(banana).toBeVisible();
    await expect(banana).toHaveAttribute('aria-disabled', 'true');

    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');

    await userEvent.click(banana);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).getByRole('listbox')).toBeVisible();
    await expect(trigger).toHaveTextContent('Apple');
  },
};

export const DisabledSelect: Story = {
  args: { defaultValue: 'apple', disabled: true },
  render: (args) => <SelectExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toBeDisabled();
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(within(canvasElement).getByRole('button', { name: 'After' }));
  },
};

export const FormValue: Story = {
  render: (args) => (
    <form aria-label="Order" onSubmit={(event) => event.preventDefault()}>
      <SelectExample {...args} name="fruit" />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Order' }) as HTMLFormElement;
    await expect(new FormData(form).get('fruit')).toBe('');

    await userEvent.click(getTrigger(canvasElement));
    await userEvent.click(await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' }));
    await expectClosed(canvasElement);
    await expect(new FormData(form).get('fruit')).toBe('cherry');
  },
};

export const RejectedControlled: Story = {
  args: { value: 'apple', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <SelectExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await waitFor(() => expect(trigger).toHaveTextContent('Apple'));

    await userEvent.click(trigger);
    await userEvent.click(await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    // The value is not committed; the (uncontrolled) open axis still applies its close.
    await expect(trigger).toHaveTextContent('Apple');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('listbox');
    await expect(getOption(canvasElement, 'Apple')).toHaveAttribute('aria-selected', 'true');
    await expect(getOption(canvasElement, 'Cherry')).toHaveAttribute('aria-selected', 'false');
  },
};

export const RejectedControlledOpen: Story = {
  args: { open: false, onOpenChange: fn() },
  render: (args) => <SelectExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
  },
};

export const Open: Story = {
  args: { defaultOpen: true, defaultValue: 'cherry' },
  render: (args) => (
    <SelectExample {...args}>
      <Select.Item value="reserved-fui-option">Reserved suffix</Select.Item>
    </SelectExample>
  ),
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled listbox.
    const listbox = await bodyOf(canvasElement).findByRole('listbox', { name: LABEL });
    await expect(within(listbox).getAllByRole('option')).toHaveLength(4);
    await expect(getOption(canvasElement, 'Cherry')).toHaveAttribute('aria-selected', 'true');
    await expect(getOption(canvasElement, 'Banana')).toHaveAttribute('aria-disabled', 'true');
    await expect(getTrigger(canvasElement)).toHaveAttribute('aria-expanded', 'true');
    const reservedOption = getOption(canvasElement, 'Reserved suffix');
    const originalId = reservedOption.id;
    await expect(originalId).toMatch(/-opt-reserved-fui-option-item$/);
    await userEvent.click(getTrigger(canvasElement));
    await expectClosed(canvasElement);
    await userEvent.keyboard('{ArrowDown}{End}');
    await expectActive(canvasElement, 'Reserved suffix');
    await expect(reservedOption.id).toBe(originalId);
    await expect(reservedOption.id.endsWith('-fui-option')).toBe(false);
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { defaultValue: 'apple' },
  render: (args) => <SelectExample {...args} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(getTrigger(canvasElement));
    await expect(await bodyOf(canvasElement).findByRole('listbox')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};
