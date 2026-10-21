import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';
import { expect, fireEvent, fn, mocked, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import {
  Combobox,
  type ComboboxCompoundProps,
  type ComboboxEasyProps,
  type ComboboxInputProps,
  type ComboboxListProps,
  type ComboboxOption,
  type ComboboxProps,
} from './index';

const LABEL = 'Fruit';
const DESCRIPTION = 'Type to search';
const EMPTY_LABEL = 'No results';

export const NestedDismissal: StoryObj = {
  tags: ['!autodocs'],
  render: () => (
    <>
      <Popover defaultOpen>
        <Popover.Trigger>Parent</Popover.Trigger>
        <Popover.Content aria-label="Parent">
          <Combobox label="Nested fruit" options={FRUITS} />
        </Popover.Content>
      </Popover>
      <Button>Outside</Button>
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    const parent = body.getByRole('dialog', { name: 'Parent' });
    const input = within(parent).getByRole('combobox', { name: 'Nested fruit' });
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    const list = await body.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(input).toHaveAttribute('aria-activedescendant', within(list).getByRole('option', { name: 'Apricot' }).id),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('listbox')).toBeNull());
    await expect(parent).toBeVisible();
    await expect(input).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('listbox');
    const outside = body.getByRole('button', { name: 'Outside' });
    await userEvent.click(outside);
    await waitFor(() => expect(body.queryByRole('listbox')).toBeNull());
    await expect(parent).toBeVisible();
    await expect(outside).toHaveFocus();
  },
};

const FRUITS: readonly ComboboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

const snippet = `import { Combobox } from '@jfrader/ui';

<Combobox
  label="Fruit"
  description="Type to search"
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]}
/>`;

const stackStyle = {
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
  maxInlineSize: '100%',
} satisfies CSSProperties;

const meta: Meta<ComboboxCompoundProps> = {
  title: 'Inputs/Combobox',
  component: Combobox,
  parameters: {
    docs: {
      description: {
        component:
          'Type to filter a list and choose an option.',
      },
      sections: [
        { title: 'Basic', stories: ['Default', 'Compound'] },
        { title: 'Filtering and empty results', stories: ['Empty'] },
        { title: 'Free text', stories: ['UncommittedText'] },
        { title: 'Grouped options', stories: ['Destinations'] },
        { title: 'States', stories: ['DisabledItem', 'UnavailableField'] },
        { title: 'Forms and controlled selection', stories: ['EasyFormReset', 'ControlledSelection'] },
        { title: 'Slots', stories: ['SlotProps'] },
      ],
      usage: `### When to use
Use a combobox to choose one item from a searchable list. Typed text is a search query, not a committed selection; use a text field when arbitrary text is the answer.

### Values and constraints

- Editing text keeps the selected value until you clear the input or choose another option.
- Matching is case-insensitive and uses substrings by default. Application-ranked results need application-owned retrieval, debouncing and stale-response cancellation.
- Forms submit the selected value, not the query. Native required validation does not validate the selection; check it in your form.

### Keyboard and accessibility

- Give the field a visible label. Focus stays in the input while the list highlight moves.
- Up/Down opens the list and moves through enabled matches, wrapping at the ends. Home/End moves to the first/last enabled match while open.
- Enter selects the highlighted option. Escape closes and restores the selected label. Tab or an outside press closes without selecting.
- No matches leaves a closed list closed; an already open list shows its empty message.`,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;
type EasyStory = StoryObj<(props: ComboboxEasyProps) => ReactNode>;
// @ts-expect-error Generated-part slot keys are closed.
type UnknownSlot = NonNullable<ComboboxEasyProps['slotProps']>['unknown'];
// @ts-expect-error Replacement slot keys are closed.
type UnknownReplacement = NonNullable<ComboboxEasyProps['slots']>['unknown'];

/** Restyle the generated field label without nesting input slotProps. */
export const SlotProps: EasyStory = {
  name: 'Style field parts',
  parameters: { docs: { description: { story: 'Style the label and pass classes to the description, input and options.' }, source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Combobox } from '@jfrader/ui';

function FruitField(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<Combobox label="Fruit" description="Type to search" component={FruitField}
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]}
  slotProps={{
    label: { sx: { fontStyle: 'italic' } },
    description: { className: 'fruit-description' },
    input: { slotProps: { label: { sx: { fontStyle: 'normal' } }, control: { className: 'fruit-input' } } },
    item: { className: 'fruit-option' },
  }}
/>` } } },
  args: {
    label: 'Fruit', description: 'Type to search', options: FRUITS,
    component: CustomComboboxRoot,
    slotProps: {
      label: { sx: { fontStyle: 'italic' } },
      description: { className: 'fruit-description' },
      input: { slotProps: { label: { sx: { fontStyle: 'normal' } }, control: { className: 'fruit-input' } } },
      item: { className: 'fruit-option' },
    },
  },
  render: (args) => <Combobox {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Fruit')).toHaveStyle({ fontStyle: 'italic' });
    await expect(canvas.getByTestId('custom-root')).toHaveAttribute('data-ui', 'combobox');
    await expect(canvas.getByText('Type to search')).toHaveClass('fruit-description');
    const input = canvas.getByRole('combobox');
    await expect(input).toHaveClass('fruit-input');
    await userEvent.click(input);
    await userEvent.type(input, 'Ch');
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('option', { name: 'Cherry' })).toHaveClass('fruit-option');
    await userEvent.click(body.getByRole('option', { name: 'Cherry' }));
    await expect(input).toHaveValue('Cherry');
  },
};

type CheckedCombobox<Props extends ComboboxProps> = Props;
export type ComboboxTypeRegression = {
  // @ts-expect-error Options and children are mutually exclusive.
  optionsWithChildren: CheckedCombobox<{ options: typeof FRUITS; children: ReactNode }>;
  // @ts-expect-error Presentation props are rejected in compound mode without options.
  childrenWithLabel: CheckedCombobox<{ label: string; children: ReactNode }>;
  // @ts-expect-error Presentation props are rejected in compound mode without options.
  childrenWithPlaceholder: CheckedCombobox<{ placeholder: string; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slots and slotProps.
  childrenWithSlots: CheckedCombobox<{ slots: { root?: () => null }; children: ReactNode }>;
};

interface ComboboxExampleProps extends ComboboxCompoundProps {
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

export const Default: EasyStory = {
  name: 'Choose a fruit',
  args: {
    label: LABEL,
    description: DESCRIPTION,
    options: FRUITS,
    onValueChange: fn(),
    onInputChange: fn(),
  },
  render: (args) => (
    <div style={stackStyle}>
      <Combobox {...args} />
      <Button>After</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: { story: 'Type a fruit name, then choose a matching option.' },
      source: { language: 'tsx', code: snippet },
    },
  },
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

export const Compound: Story = {
  name: 'Compose a fruit picker',
  render: (args) => <ComboboxExample {...args} inputProps={{ description: DESCRIPTION }} />,
  parameters: {
    docs: {
      description: { story: 'Compose the labelled input, options and empty message.' },
      source: {
        language: 'tsx',
        code: `import { Combobox } from '@jfrader/ui';

function FruitPicker() {
  return (
    <Combobox>
      <Combobox.Input label="Fruit" description="Type to search" />
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
};

function CustomComboboxInput(props: ComboboxInputProps) {
  return <Combobox.Input {...props} data-testid="custom-input" />;
}

function CustomComboboxList(props: ComboboxListProps) {
  return <Combobox.List {...props} data-testid="custom-list" />;
}

function CustomComboboxRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="custom-root" />;
}

function CustomComboboxLabel(props: ComponentPropsWithRef<'label'>) {
  return <label {...props} data-testid="custom-label" />;
}

function CustomComboboxDescription(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-testid="custom-description" />;
}

function CustomComboboxError(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-testid="custom-error" />;
}

export const CustomSlots: EasyStory = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Combobox, styled } from '@jfrader/ui';

function FruitField(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}
const FruitInput = styled(Combobox.Input)({ fontWeight: 600 });
const FruitList = styled(Combobox.List)({ fontStyle: 'italic' });
const FruitLabel = styled.label({ fontWeight: 600 });
const FruitDescription = styled.span({ fontStyle: 'italic' });
const FruitError = styled.span({ fontWeight: 600 });

<Combobox label="Fruit" description="Pick a fruit" error="Required" defaultValue="apple"
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]}
  slots={{ root: FruitField, input: FruitInput, list: FruitList,
    label: FruitLabel, description: FruitDescription, error: FruitError }}
  slotProps={{ root: { className: 'fruit-field' } }}
/>` } } },
  render: () => (
    <Combobox
      label="Fruit"
      description="Pick a fruit"
      error="Required"
      options={FRUITS}
      defaultValue="apple"
      slots={{
        root: CustomComboboxRoot,
        input: CustomComboboxInput,
        list: CustomComboboxList,
        label: CustomComboboxLabel,
        description: CustomComboboxDescription,
        error: CustomComboboxError,
      }}
      slotProps={{
        root: { 'data-testid': 'custom-root' },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('custom-root');
    await expect(root).toBeInTheDocument();
    await expect(root).toHaveAttribute('data-ui', 'combobox');
    await expect(canvas.getByTestId('custom-input')).toBeInTheDocument();
    for (const name of ['label', 'description', 'error']) {
      const element = canvas.getByTestId(`custom-${name}`);
      await expect(element.className).not.toBe('');
      await expect(element.tagName).toBe(name === 'label' ? 'LABEL' : 'SPAN');
    }
  },
};

function EasyControlledCombobox(props: ComboboxEasyProps) {
  const [value, setValue] = useState<string | null>('apple');
  return (
    <div style={stackStyle}>
      <Combobox
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          props.onValueChange?.(next);
        }}
      />
    </div>
  );
}

export const EasyControlled: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, onValueChange: fn() },
  render: (args) => <EasyControlledCombobox {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue('Apple'));
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'ch');
    await userEvent.click(getOption(canvasElement, 'Cherry'));
    await expect(args.onValueChange).toHaveBeenCalledWith('cherry');
    await expect(input).toHaveValue('Cherry');
    await expectClosed(canvasElement);
  },
};

export const EasyRejectedControlled: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, value: 'apple', onValueChange: fn() },
  render: (args) => (
    <div style={stackStyle}>
      <Combobox {...args} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue('Apple'));
    await userEvent.type(input, 'ch', { initialSelectionStart: 0, initialSelectionEnd: input.value.length });
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expectClosed(canvasElement);
    await expect(input).toHaveValue('Apple');
  },
};

export const EasyDisabledOption: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, defaultValue: 'apple', onValueChange: fn() },
  render: (args) => (
    <div style={stackStyle}>
      <Combobox {...args} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('listbox');
    const banana = getOption(canvasElement, 'Banana');
    await expect(banana).toHaveAttribute('aria-disabled', 'true');
    await fireEvent.click(banana);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(getInput(canvasElement)).toHaveValue('Apple');
  },
};

export const EasyKeyboard: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, defaultValue: 'apple', onValueChange: fn() },
  render: (args) => (
    <div style={stackStyle}>
      <Combobox {...args} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const input = await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apple');
    // Arrow down navigates to Apricot, then skips disabled Banana to Cherry
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apricot');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledWith('cherry');
    await expect(input).toHaveValue('Cherry');
    await expectClosed(canvasElement);
  },
};

const CUSTOM_COMBOBOX_OPTIONS: readonly ComboboxOption[] = [
  { value: 'apple', label: 'Apple', id: 'custom-apple-cb-opt' },
  { value: 'cherry', label: 'Cherry', id: 'custom-cherry-cb-opt', textValue: 'Zucchini' },
];

export const EasyOptionIdsAndTextValue: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: CUSTOM_COMBOBOX_OPTIONS, defaultValue: 'apple' },
  render: (args) => (
    <div style={stackStyle}>
      <Combobox {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('listbox');
    const apple = getOption(canvasElement, 'Apple');
    const cherry = getOption(canvasElement, 'Cherry');
    await expect(apple).toHaveAttribute('id', 'custom-apple-cb-opt');
    await expect(cherry).toHaveAttribute('id', 'custom-cherry-cb-opt');
    await userEvent.clear(input);
    await userEvent.type(input, 'zu');
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    await expect(getOption(canvasElement, 'Cherry')).toBeVisible();
  },
};

function DisabledWhileOpenCombobox(props: ComboboxCompoundProps) {
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
    mocked(args.onOpenChange!).mockClear();
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

export const EasyFormReset: EasyStory = {
  name: 'Reset a form selection',
  parameters: { docs: { description: { story: 'Choose another fruit, then reset the form to Apple.' }, source: { language: 'tsx', code: `import { Button, Combobox } from '@jfrader/ui';

<form aria-label="Fruit form">
  <Combobox label="Fruit" name="fruit" defaultValue="apple" options={[
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]} />
  <Button type="reset">Reset</Button>
</form>` } } },
  render: () => (
    <form aria-label="Fruit form">
      <Combobox
        label={LABEL}
        name="fruit"
        options={FRUITS}
        defaultValue="apple"
      />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole('form', { name: 'Fruit form' }) as HTMLFormElement;
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'ch');
    await userEvent.click(getOption(canvasElement, 'Cherry'));
    await expect(new FormData(form).get('fruit')).toBe('cherry');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(new FormData(form).get('fruit')).toBe('apple'));
    await expect(input).toHaveValue('Apple');
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
    const valueCalls = mocked(args.onValueChange!).mock.calls.length;
    const textCalls = mocked(args.onInputChange!).mock.calls.length;
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

function AssociatedFormResetCombobox(props: ComboboxCompoundProps) {
  const formId = useId();
  const [cancelReset, setCancelReset] = useState(true);
  return (
    <>
      <form id={formId} onReset={event => { if (cancelReset) event.preventDefault(); }}>
        <Button type="reset">Reset</Button>
      </form>
      <Button onClick={() => setCancelReset(false)}>Allow reset</Button>
      <ComboboxExample {...props} defaultValue="apple" inputProps={{ form: formId }} />
      <ComboboxExample {...props} value="cherry" inputProps={{ form: formId, label: 'Controlled fruit', inputValue: 'Controlled query' }} />
    </>
  );
}

export const AssociatedFormReset: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn(), onInputChange: fn() },
  render: args => <AssociatedFormResetCombobox {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await userEvent.type(input, ' edited');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(input).toHaveValue('Apple edited');
    const valueCalls = mocked(args.onValueChange!).mock.calls.length;
    const textCalls = mocked(args.onInputChange!).mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Allow reset' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(input).toHaveValue('Apple'));
    await expect(canvas.getByRole('combobox', { name: 'Controlled fruit' })).toHaveValue('Controlled query');
    await expect(args.onValueChange).toHaveBeenCalledTimes(valueCalls);
    await expect(args.onInputChange).toHaveBeenCalledTimes(textCalls);
  },
};

export const Clear: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<Combobox defaultValue="apple">
  <Combobox.Input label="Fruit" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Combobox>
  <Combobox.Input label="Fruit" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { Combobox } from '@jfrader/ui';

function FruitForm() {
  const formId = useId();
  return <>
    <form id={formId} aria-label="Order" />
    <Combobox name="fruit" defaultValue="apple">
      <Combobox.Input label="Fruit" form={formId} />
      <Combobox.List>
        <Combobox.Item value="apple">Apple</Combobox.Item>
        <Combobox.Item value="apricot">Apricot</Combobox.Item>
        <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
        <Combobox.Item value="cherry">Cherry</Combobox.Item>
        <Combobox.Empty />
      </Combobox.List>
    </Combobox>
  </>;
}` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Combobox defaultValue="cherry">
  <Combobox.Input label="Fruit" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` } } },
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
  name: 'Unavailable option',
  parameters: { docs: { description: { story: 'Open the list to see Banana disabled while other fruits remain selectable.' }, source: { language: 'tsx', code: `import { Combobox } from '@jfrader/ui';

<Combobox>
  <Combobox.Input label="Fruit" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` } } },
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
  name: 'No matching fruits',
  parameters: { docs: { description: { story: 'Type “a” to open the list, then “zz” to see the empty message.' }, source: { language: 'tsx', code: `import { Combobox } from '@jfrader/ui';

<Combobox>
  <Combobox.Input label="Fruit" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty>No results</Combobox.Empty>
  </Combobox.List>
</Combobox>` } } },
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
    await expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    await expect(within(listbox).getByRole('option', { name: EMPTY_LABEL })).toHaveAttribute('aria-disabled', 'true');
    await expect(within(listbox).getByText(EMPTY_LABEL)).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).not.toHaveAttribute('aria-activedescendant');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const FormValue: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<form aria-label="Order">
  <Combobox name="fruit">
    <Combobox.Input label="Fruit" />
    <Combobox.List>
      <Combobox.Item value="apple">Apple</Combobox.Item>
      <Combobox.Item value="apricot">Apricot</Combobox.Item>
      <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
      <Combobox.Item value="cherry">Cherry</Combobox.Item>
      <Combobox.Empty />
    </Combobox.List>
  </Combobox>
</form>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Combobox value="apple">
  <Combobox.Input label="Fruit" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Combobox>
  <Combobox.Input label="Fruit" inputValue="ap" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Combobox defaultValue="apple">
  <Combobox.Input label="Fruit" />
  <Combobox.List>
    <Combobox.Item value="apple">Apple</Combobox.Item>
    <Combobox.Item value="apricot">Apricot</Combobox.Item>
    <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
    <Combobox.Item value="cherry">Cherry</Combobox.Item>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` } } },
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

function RejectFirstSelectionExample({ onValueChange, ...props }: ComboboxCompoundProps) {
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
        language: 'tsx',
        code: `import { useState } from 'react';
import { Combobox } from '@jfrader/ui';

function FruitPicker() {
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
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <ComboboxExample {...args} listId={CUSTOM_LIST_ID} />,
  play: async ({ canvasElement }) => {
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await expect(listbox).toHaveAttribute('id', CUSTOM_LIST_ID);
    await expect(getInput(canvasElement).getAttribute('aria-controls')).toBe(CUSTOM_LIST_ID);
  },
};

export const DisabledFormValue: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<form aria-label="Order">
  <Combobox name="fruit" defaultValue="apple">
    <Combobox.Input label="Fruit" disabled />
    <Combobox.List>
      <Combobox.Item value="apple">Apple</Combobox.Item>
      <Combobox.Item value="apricot">Apricot</Combobox.Item>
      <Combobox.Item value="banana" disabled>Banana</Combobox.Item>
      <Combobox.Item value="cherry">Cherry</Combobox.Item>
      <Combobox.Empty />
    </Combobox.List>
  </Combobox>
</form>` } } },
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
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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

const LONG_LABEL = 'InternationalEnterpriseWorkspaceWithoutWordSeparators';
const LONG_OPTIONS = Array.from({ length: 40 }, (_, index) => ({
  value: String(index), label: `${LONG_LABEL} ${index}`,
}));

export const ViewportEdge: EasyStory = {
  tags: ['!autodocs'],
  args: { label: 'Workspace', options: LONG_OPTIONS },
  render: (args) => (
    <div style={{
      position: 'fixed',
      insetInlineEnd: vars.space[4],
      insetBlockEnd: vars.space[8],
      inlineSize: `min(320px, calc(100vw - ${vars.space[8]}))`,
    }}>
      <Combobox {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}');
    const list = await bodyOf(canvasElement).findByRole('listbox');
    await waitFor(async () => {
      const anchor = input.getBoundingClientRect();
      const panel = list.getBoundingClientRect();
      await expect(Math.abs(anchor.top - panel.bottom - 8)).toBeLessThanOrEqual(1);
      await expect(panel.left).toBeGreaterThanOrEqual(8);
      await expect(panel.right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth - 8);
      await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    });
    await userEvent.keyboard('{End}');
    await waitFor(async () => {
      const active = canvasElement.ownerDocument.getElementById(input.getAttribute('aria-activedescendant')!)!;
      await expect(active.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom);
      await expect(active.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    });
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue(LONG_OPTIONS.at(-1)!.label);
  },
};

export const FieldStates: EasyStory = {
  tags: ['!autodocs'],
  render: () => (
    <div style={stackStyle}>
      <Combobox label="Small" size="sm" options={FRUITS} />
      <Combobox label="Large" size="lg" options={FRUITS} />
      <Combobox label="Unavailable" disabled options={FRUITS} description="Contact the workspace owner." />
      <Combobox label="Workspace" options={FRUITS} description="Choose where to publish." error="Choose a workspace to continue." />
      <Combobox label="Free text" options={FRUITS} defaultInputValue="New workspace" />
    </div>
  ),
  play: async ({ canvas }) => {
    for (const input of canvas.getAllByRole('combobox')) {
      await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
    await expect(canvas.getByRole('combobox', { name: 'Unavailable' })).toBeDisabled();
    await expect(canvas.getByRole('combobox', { name: 'Workspace' })).toHaveAccessibleDescription('Choose where to publish. Choose a workspace to continue.');
    await expect(canvas.getByRole('combobox', { name: 'Free text' })).toHaveValue('New workspace');
  },
};

export const Grouped: Story = {
  tags: ['!autodocs'],
  render: () => (
    <div style={stackStyle}>
      <Combobox defaultOpen>
        <Combobox.Input label="Destination" />
        <Combobox.List>
          <div role="group" aria-label="Europe">
            <Combobox.Item value="madrid">Madrid</Combobox.Item>
            <Combobox.Item value="paris" disabled>Paris</Combobox.Item>
          </div>
          <div role="group" aria-label="Americas">
            <Combobox.Item value="lima">Lima</Combobox.Item>
            <Combobox.Item value="quito">Quito</Combobox.Item>
          </div>
          <Combobox.Empty />
        </Combobox.List>
      </Combobox>
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{Home}{ArrowDown}');
    await expect(input).toHaveAttribute('aria-activedescendant', bodyOf(canvasElement).getByRole('option', { name: 'Lima' }).id);
  },
};

export const UncommittedText: EasyStory = {
  name: 'Text without a selection',
  parameters: { docs: {
    description: { story: 'Start with a draft query; it is not submitted as a selected fruit.' },
    source: { language: 'tsx', code: `import { Combobox } from '@jfrader/ui';

<Combobox label="Fruit" defaultInputValue="New fruit"
  options={[{ value: 'apple', label: 'Apple' }]} />` },
  } },
  render: () => <Combobox label="Fruit" defaultInputValue="New fruit" options={[{ value: 'apple', label: 'Apple' }]} />,
};

export const Destinations: Story = {
  name: 'Destinations by region',
  parameters: { docs: {
    description: { story: 'Open the destination list to browse named groups and skip unavailable cities.' },
    source: { language: 'tsx', code: `import { Combobox } from '@jfrader/ui';

<Combobox>
  <Combobox.Input label="Destination" />
  <Combobox.List>
    <div role="group" aria-label="Europe">
      <Combobox.Item value="madrid">Madrid</Combobox.Item>
      <Combobox.Item value="paris" disabled>Paris</Combobox.Item>
    </div>
    <div role="group" aria-label="Americas">
      <Combobox.Item value="lima">Lima</Combobox.Item>
      <Combobox.Item value="quito">Quito</Combobox.Item>
    </div>
    <Combobox.Empty />
  </Combobox.List>
</Combobox>` },
  } },
  render: () => (
    <Combobox>
      <Combobox.Input label="Destination" />
      <Combobox.List>
        <div role="group" aria-label="Europe">
          <Combobox.Item value="madrid">Madrid</Combobox.Item>
          <Combobox.Item value="paris" disabled>Paris</Combobox.Item>
        </div>
        <div role="group" aria-label="Americas">
          <Combobox.Item value="lima">Lima</Combobox.Item>
          <Combobox.Item value="quito">Quito</Combobox.Item>
        </div>
        <Combobox.Empty />
      </Combobox.List>
    </Combobox>
  ),
};

export const UnavailableField: EasyStory = {
  name: 'Disabled field',
  parameters: { docs: {
    description: { story: 'Show a selected fruit in a field that cannot be edited.' },
    source: { language: 'tsx', code: `import { Combobox } from '@jfrader/ui';

<Combobox label="Fruit" disabled defaultValue="apple"
  options={[{ value: 'apple', label: 'Apple' }]} />` },
  } },
  render: () => <Combobox label="Fruit" disabled defaultValue="apple" options={[{ value: 'apple', label: 'Apple' }]} />,
};

export const ControlledSelection: EasyStory = {
  name: 'Controlled fruit selection',
  parameters: { docs: {
    description: { story: 'Keep the selected fruit in application state while the input manages its query.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Combobox } from '@jfrader/ui';

function FruitPicker() {
  const [value, setValue] = useState<string | null>('apple');
  return <Combobox label="Fruit" value={value} onValueChange={setValue}
    options={[
      { value: 'apple', label: 'Apple' },
      { value: 'apricot', label: 'Apricot' },
      { value: 'banana', label: 'Banana', disabled: true },
      { value: 'cherry', label: 'Cherry' },
    ]} />;
}` },
  } },
  render: () => <EasyControlledCombobox label="Fruit" options={FRUITS} />,
};
