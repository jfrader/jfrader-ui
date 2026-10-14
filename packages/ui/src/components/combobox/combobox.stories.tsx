import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Combobox, type ComboboxInputProps, type ComboboxProps } from './index';

const LABEL = 'Fruit';
const DESCRIPTION = 'Type to search';
const EMPTY_LABEL = 'No results';

const stackStyle = {
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
} satisfies CSSProperties;

const meta = {
  title: 'Inputs/Combobox',
  component: Combobox,
  parameters: { docs: { description: { component: 'Type to filter a list and choose an option.' } } },
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

interface ComboboxExampleProps extends ComboboxProps {
  inputProps?: ComboboxInputProps;
  listId?: string;
}

function ComboboxExample({ inputProps, listId, ...props }: ComboboxExampleProps) {
  return (
    <div style={stackStyle}>
      <Combobox {...props}>
        <Combobox.Input label={LABEL} {...inputProps} />
        <Combobox.List id={listId}>
          <Combobox.Item value="apple">Apple</Combobox.Item>
          <Combobox.Item value="apricot">Apricot</Combobox.Item>
          <Combobox.Item value="banana" disabled>
            Banana
          </Combobox.Item>
          <Combobox.Item value="cherry">Cherry</Combobox.Item>
          <Combobox.Empty />
        </Combobox.List>
      </Combobox>
      <Button>After</Button>
    </div>
  );
}
ComboboxExample.displayName = 'ComboboxExample';

function DisabledWhileOpenCombobox(props: ComboboxProps) {
  const [disabled, setDisabled] = useState(false);
  return (
    <>
      <ComboboxExample {...props} open inputProps={{ disabled }} />
      <Button onClick={() => setDisabled(true)}>Disable</Button>
    </>
  );
}

export const DisabledWhileOpen: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn(), onInputChange: fn(), onOpenChange: fn() },
  render: (args) => <DisabledWhileOpenCombobox {...args} />,
  play: async ({ args, canvasElement }) => {
    const option = await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' });
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Disable' }));
    args.onOpenChange.mockClear();
    await fireEvent.click(option);
    await fireEvent.keyDown(getInput(canvasElement), { key: 'ArrowDown' });
    await fireEvent.keyDown(getInput(canvasElement), { key: 'Enter' });
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onInputChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expectClosed(canvasElement);
  },
};

export const ReadOnlySelection: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn(), onInputChange: fn(), onOpenChange: fn() },
  render: (args) => <ComboboxExample {...args} open defaultValue="apple" inputProps={{ readOnly: true }} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    const option = bodyOf(canvasElement).getByRole('option', { name: 'Cherry', hidden: true });
    await fireEvent.click(option);
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(input).toHaveValue('Apple');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onInputChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

function getInput(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('combobox', { name: LABEL }) as HTMLInputElement;
}

function getOption(canvasElement: HTMLElement, name: string) {
  return bodyOf(canvasElement).getByRole('option', { name });
}

/** Virtual focus: the option is referenced by aria-activedescendant while DOM focus stays on the input. */
async function expectActive(canvasElement: HTMLElement, name: string) {
  const input = getInput(canvasElement);
  await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', getOption(canvasElement, name).id));
  await expect(getOption(canvasElement, name)).toHaveAttribute('data-active');
  await expect(canvasElement.ownerDocument.activeElement).toBe(input);
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('listbox')).toBeNull());
  const input = getInput(canvasElement);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).not.toHaveAttribute('aria-activedescendant');
}

async function focusInput(canvasElement: HTMLElement) {
  const input = getInput(canvasElement);
  await userEvent.tab();
  await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  return input;
}

export const Default: Story = {
  args: { onValueChange: fn(), onInputChange: fn() },
  render: (args) => <ComboboxExample {...args} inputProps={{ description: DESCRIPTION }} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await expect(input.tagName).toBe('INPUT');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-controls');
    await expect(input).toHaveAccessibleDescription(DESCRIPTION);

    await focusInput(canvasElement);
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');

    // Typing filters and opens on the first enabled match.
    await userEvent.keyboard('ap');
    const listbox = await bodyOf(canvasElement).findByRole('listbox', { name: LABEL });
    await expect(canvasElement.contains(listbox)).toBe(false);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).toHaveAttribute('aria-controls', listbox.id);
    await expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Apple',
      'Apricot',
    ]);
    await expectActive(canvasElement, 'Apple');
    await expect(input).toHaveAccessibleDescription(DESCRIPTION);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('ap');

    // Arrows wrap within the matches; Home/End jump.
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apricot');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apple');
    await userEvent.keyboard('{ArrowUp}');
    await expectActive(canvasElement, 'Apricot');
    await userEvent.keyboard('{Home}');
    await expectActive(canvasElement, 'Apple');
    await userEvent.keyboard('{End}');
    await expectActive(canvasElement, 'Apricot');
    await expect(getComputedStyle(getOption(canvasElement, 'Apricot')).outlineStyle).not.toBe('none');

    // Enter selects once, writes the label and closes; focus never left the input.
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('apricot');
    await expect(args.onInputChange).toHaveBeenLastCalledWith('Apricot');
    await expect(input).toHaveValue('Apricot');
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);

    // After a selection the list opens unfiltered.
    await userEvent.keyboard('{ArrowDown}');
    await expect(within(await bodyOf(canvasElement).findByRole('listbox')).getAllByRole('option')).toHaveLength(4);
    await expect(getOption(canvasElement, 'Apricot')).toHaveAttribute('aria-selected', 'true');

    // Tab closes without selecting and moves on.
    await userEvent.tab();
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(within(canvasElement).getByRole('button', { name: 'After' }));
  },
};

export const NativeFormReset: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn(), onInputChange: fn() },
  render: (args) => (
    <form aria-label="Fruit form">
      <ComboboxExample {...args} name="fruit" defaultValue="apple" inputProps={{ defaultInputValue: 'ap' }} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole('form', { name: 'Fruit form' }) as HTMLFormElement;
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'ch');
    await userEvent.click(getOption(canvasElement, 'Cherry'));
    await expect(new FormData(form).get('fruit')).toBe('cherry');
    const valueCalls = args.onValueChange.mock.calls.length;
    const textCalls = args.onInputChange.mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(new FormData(form).get('fruit')).toBe('apple'));
    await expect(input).toHaveValue('ap');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}');
    await expect(getOption(canvasElement, 'Apple')).toBeVisible();
    await expect(bodyOf(canvasElement).queryByRole('option', { name: 'Cherry' })).toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(valueCalls);
    await expect(args.onInputChange).toHaveBeenCalledTimes(textCalls);
  },
};

export const Clear: Story = {
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <ComboboxExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue('Apple'));

    // Editing without clearing only filters; the value is kept.
    await userEvent.click(input);
    await userEvent.keyboard('{End}{Backspace}');
    await expect(input).toHaveValue('Appl');
    await expectActive(canvasElement, 'Apple');
    await expect(args.onValueChange).not.toHaveBeenCalled();

    // Clearing the text clears the value and closes.
    await userEvent.clear(input);
    await expect(input).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(null);
    await expectClosed(canvasElement);
  },
};

export const Composition: Story = {
  args: { onValueChange: fn(), onInputChange: fn() },
  render: (args) => <ComboboxExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = await focusInput(canvasElement);
    await userEvent.keyboard('ap');
    await expectActive(canvasElement, 'Apple');
    await fireEvent.compositionStart(input);
    for (const key of ['Enter', 'ArrowDown', 'End', 'Escape']) {
      await fireEvent.keyDown(input, { key, isComposing: true });
      await expectActive(canvasElement, 'Apple');
      await expect(input).toHaveValue('ap');
    }
    await fireEvent.compositionEnd(input);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('apple');
    await expectClosed(canvasElement);
  },
};

export const ExternalForm: Story = {
  render: (args) => (
    <>
      <form id="combobox-order" aria-label="Order" />
      <ComboboxExample {...args} name="fruit" defaultValue="apple" inputProps={{ form: 'combobox-order' }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Order' }) as HTMLFormElement;
    await expect(new FormData(form).get('fruit')).toBe('apple');
    await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    await expect(new FormData(form).get('fruit')).toBe('cherry');
  },
};

export const EscapeRestores: Story = {
  args: { defaultValue: 'cherry', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ComboboxExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue('Cherry'));

    await userEvent.click(input);
    await userEvent.keyboard('{End}{Backspace}{Backspace}');
    await expect(input).toHaveValue('Cher');
    await expectActive(canvasElement, 'Cherry');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(input).toHaveValue('Cherry');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  },
};

export const DisabledItem: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ComboboxExample {...args} />,
  play: async ({ args, canvasElement }) => {
    await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('listbox');
    await expectActive(canvasElement, 'Apple');

    const banana = getOption(canvasElement, 'Banana');
    await expect(banana).toBeVisible();
    await expect(banana).toHaveAttribute('aria-disabled', 'true');

    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apricot');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');

    await userEvent.click(banana);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).getByRole('listbox')).toBeVisible();
    await expect(getInput(canvasElement)).toHaveValue('');

    // Clicking an enabled option selects it.
    await userEvent.click(getOption(canvasElement, 'Cherry'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expect(getInput(canvasElement)).toHaveValue('Cherry');
    await expect(canvasElement.ownerDocument.activeElement).toBe(getInput(canvasElement));
  },
};

export const Empty: Story = {
  render: (args) => <ComboboxExample {...args} />,
  play: async ({ canvasElement }) => {
    const input = await focusInput(canvasElement);

    // No matches does not open a closed list.
    await userEvent.keyboard('zz');
    await expectClosed(canvasElement);

    await userEvent.clear(input);
    await userEvent.keyboard('a');
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await userEvent.keyboard('zz');
    await expect(within(listbox).queryAllByRole('option')).toHaveLength(0);
    await expect(within(listbox).getByText(EMPTY_LABEL)).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).not.toHaveAttribute('aria-activedescendant');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const FormValue: Story = {
  render: (args) => (
    <form aria-label="Order" onSubmit={(event) => event.preventDefault()}>
      <ComboboxExample {...args} name="fruit" />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Order' }) as HTMLFormElement;
    await expect(new FormData(form).get('fruit')).toBe('');

    await focusInput(canvasElement);
    await userEvent.keyboard('ch');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(new FormData(form).get('fruit')).toBe('cherry');

    await userEvent.clear(getInput(canvasElement));
    await expect(new FormData(form).get('fruit')).toBe('');
  },
};

export const RejectedControlled: Story = {
  args: { value: 'apple', onValueChange: fn() },
  render: (args) => <ComboboxExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue('Apple'));

    // Replaces the text without passing through '' (which would request a clear).
    await userEvent.type(input, 'ch', { initialSelectionStart: 0, initialSelectionEnd: input.value.length });
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    // The value is not committed: the input shows the still-selected option's label.
    await expectClosed(canvasElement);
    await expect(input).toHaveValue('Apple');

    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('listbox');
    await expect(getOption(canvasElement, 'Apple')).toHaveAttribute('aria-selected', 'true');
    await expect(getOption(canvasElement, 'Cherry')).toHaveAttribute('aria-selected', 'false');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const RejectedControlledText: Story = {
  args: { onInputChange: fn() },
  render: (args) => <ComboboxExample {...args} inputProps={{ inputValue: 'ap' }} />,
  play: async ({ args, canvasElement }) => {
    const input = await focusInput(canvasElement);
    await userEvent.keyboard('{End}z');
    await expect(args.onInputChange).toHaveBeenCalledTimes(1);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('apz');
    await expect(input).toHaveValue('ap');
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await expect(within(listbox).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Apple',
      'Apricot',
    ]);
    await expectActive(canvasElement, 'Apple');
  },
};

export const SameOptionReselection: Story = {
  args: { defaultValue: 'apple', onInputChange: fn(), onValueChange: fn() },
  render: (args) => <ComboboxExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue('Apple'));
    await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(getOption(canvasElement, 'Apple'));
    await expectClosed(canvasElement);
    await expect(input).toHaveValue('Apple');
    await expect(args.onInputChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function RejectFirstSelectionExample({ onValueChange, ...props }: ComboboxProps) {
  const [value, setValue] = useState<string | null>('apple');
  const [reject, setReject] = useState(true);
  return (
    <ComboboxExample
      {...props}
      value={value}
      onValueChange={(next) => {
        onValueChange?.(next);
        if (reject) setReject(false);
        else setValue(next);
      }}
    />
  );
}
RejectFirstSelectionExample.displayName = 'RejectFirstSelectionExample';

export const RejectedThenAcceptedSelection: Story = {
  args: { onInputChange: fn(), onValueChange: fn() },
  render: (args) => <RejectFirstSelectionExample {...args} />,
  parameters: {
    docs: {
      source: {
        code: `function FruitPicker() {
  const [value, setValue] = useState<string | null>('apple');
  const [reject, setReject] = useState(true);

  return (
    <Combobox
      value={value}
      onValueChange={(next) => {
        if (reject) setReject(false);
        else setValue(next);
      }}
    >
      <Combobox.Input label="Fruit" />
      <Combobox.List>
        <Combobox.Item value="apple">Apple</Combobox.Item>
        <Combobox.Item value="apricot">Apricot</Combobox.Item>
        <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
        <Combobox.Item value="cherry">Cherry</Combobox.Item>
        <Combobox.Empty />
      </Combobox.List>
    </Combobox>
  );
}`,
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue('Apple'));
    await userEvent.type(input, 'ch', { initialSelectionStart: 0, initialSelectionEnd: input.value.length });
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(input).toHaveValue('Apple');
    await expect(args.onInputChange).toHaveBeenCalledTimes(3);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('Cherry');

    await userEvent.type(input, 'ch', { initialSelectionStart: 0, initialSelectionEnd: input.value.length });
    await expectActive(canvasElement, 'Cherry');
    await expect(args.onInputChange).toHaveBeenCalledTimes(5);
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(input).toHaveValue('Cherry');
    await expect(args.onInputChange).toHaveBeenCalledTimes(6);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('Cherry');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};

const CUSTOM_LIST_ID = 'combobox-custom-listbox';

export const CustomListId: Story = {
  args: { defaultOpen: true },
  render: (args) => <ComboboxExample {...args} listId={CUSTOM_LIST_ID} />,
  play: async ({ canvasElement }) => {
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await expect(listbox).toHaveAttribute('id', CUSTOM_LIST_ID);
    await expect(getInput(canvasElement).getAttribute('aria-controls')).toBe(CUSTOM_LIST_ID);
  },
};

export const DisabledFormValue: Story = {
  args: { defaultValue: 'apple', name: 'fruit' },
  render: (args) => (
    <form aria-label="Order" onSubmit={(event) => event.preventDefault()}>
      <ComboboxExample {...args} inputProps={{ disabled: true }} />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Order' }) as HTMLFormElement;
    await expect(getInput(canvasElement)).toBeDisabled();
    await expect(new FormData(form).has('fruit')).toBe(false);
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => <ComboboxExample {...args} inputProps={{ defaultInputValue: 'ap' }} />,
  play: async ({ canvasElement }) => {
    // Persistent open state with a preset query so the axe gate sees the filtered listbox.
    const listbox = await bodyOf(canvasElement).findByRole('listbox', { name: LABEL });
    await expect(within(listbox).getAllByRole('option')).toHaveLength(2);
    await expect(getInput(canvasElement)).toHaveValue('ap');
    await expect(getInput(canvasElement)).toHaveAttribute('aria-expanded', 'true');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultValue: 'apple', defaultOpen: true },
  render: (args) => (
    <ComboboxExample {...args} inputProps={{ description: DESCRIPTION, error: 'Pick a fruit from the list' }} />
  ),
  play: async ({ canvasElement }) => {
    const input = getInput(canvasElement);
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await expect(listbox).toBeVisible();
    // Left open so the axe gate checks the portaled listbox in the light theme.
    await expectThemedSurface(listbox, 'light');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
  },
};
