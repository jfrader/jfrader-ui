import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, mocked, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import {
  Select,
  type SelectCompoundProps,
  type SelectEasyProps,
  type SelectItemProps,
  type SelectOption,
  type SelectProps,
  type SelectLabelProps,
  type SelectTriggerProps,
} from './index';

// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: 240 });
const LABEL = 'Fruit';
const PLACEHOLDER = 'Pick a fruit';
const TYPEAHEAD_PAUSE_MS = 550;

const FRUITS: readonly SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

const snippet = `<Select
  label="Fruit"
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]}
  defaultValue="apple"
/>`;

const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
});

const meta: Meta<SelectCompoundProps> = {
  title: 'Inputs/Select',
  component: Select,
  parameters: {
    docs: {
      description: {
        component:
          'Choose one option from a dropdown list using either a single element with options or compound parts for custom anatomy.',
      },
      usage: `### Keyboard and focus
- The trigger is a select-only combobox with a listbox. DOM focus stays on the trigger; aria-activedescendant identifies the highlighted option.
- Enter/Space/ArrowDown opens on the selected or first enabled option. ArrowUp opens on the selected or last enabled option.
- Arrows wrap and skip disabled options; Home/End reach the ends. Enter/Space selects and closes; Escape/Tab closes without selecting. Tab lets focus move on.
- Printable characters match enabled options by case-insensitive prefix. The 500ms buffer continues across opening; closed-state typeahead opens without changing the value.
- Pointer selection closes the list. Disabled options remain visible and ignore clicks; pressing inside the list never takes focus from the trigger.

### Values and forms
- value and open support controlled state independently. Option values must be unique.
- The list stays mounted and hidden when closed so labels remain available; positioning runs only when open.
- name adds a hidden form input. Native required validation is not supported.`,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;
type EasyStory = StoryObj<(props: SelectEasyProps) => ReactNode>;
// @ts-expect-error Generated-part slot keys are closed.
type UnknownSlot = NonNullable<SelectEasyProps['slotProps']>['unknown'];
// @ts-expect-error Replacement slot keys are closed.
type UnknownReplacement = NonNullable<SelectEasyProps['slots']>['unknown'];

/** Restyle the generated label and every option with slotProps. */
export const SlotProps: EasyStory = {
  args: {
    label: 'Fruit', options: FRUITS, defaultValue: 'apple',
    component: CustomSelectRoot,
    slotProps: { label: { css: { fontStyle: 'italic' } }, item: { className: 'fruit-option' } },
  },
  render: (args) => <Select {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Fruit')).toHaveStyle({ fontStyle: 'italic' });
    await expect(canvas.getByTestId('custom-root')).toHaveAttribute('data-ui', 'select');
    await userEvent.click(canvas.getByRole('combobox'));
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('option', { name: 'Cherry' })).toHaveClass('fruit-option');
    await userEvent.click(body.getByRole('option', { name: 'Cherry' }));
    await expect(canvas.getByRole('combobox')).toHaveTextContent('Cherry');
  },
};

type CheckedSelect<Props extends SelectProps> = Props;
export type SelectTypeRegression = {
  // @ts-expect-error Options and children are mutually exclusive.
  optionsWithChildren: CheckedSelect<{ options: readonly SelectOption[]; children: ReactNode }>;
  // @ts-expect-error Presentation props are rejected in compound mode without options.
  childrenWithLabel: CheckedSelect<{ label: string; children: ReactNode }>;
  // @ts-expect-error Presentation props are rejected in compound mode without options.
  childrenWithPlaceholder: CheckedSelect<{ placeholder: string; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slots and slotProps.
  childrenWithSlots: CheckedSelect<{ slots: { root?: () => null }; children: ReactNode }>;
};

function SelectExample(props: SelectCompoundProps) {
  const labelId = useId();
  return (
    <Row>
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
    </Row>
  );
}
SelectExample.displayName = 'SelectExample';

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

export const Default: EasyStory = {
  args: {
    label: LABEL,
    placeholder: PLACEHOLDER,
    options: FRUITS,
    defaultValue: 'apple',
    onValueChange: fn(),
  },
  render: (args) => (
    <Row>
      <Select {...args} />
      <Button>After</Button>
    </Row>
  ),
  parameters: {
    docs: {
      source: {
        code: snippet,
      },
    },
  },
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

export const Compound: Story = {
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <SelectExample {...args} />,
  parameters: {
    docs: {
      source: {
        code: `function FruitPicker() {
  const labelId = useId();

  return (
    <>
      <span id={labelId}>Fruit</span>
      <Select defaultValue="apple">
        <Select.Trigger aria-labelledby={labelId}>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana" disabled>Banana</Select.Item>
          <Select.Item value="cherry">Cherry</Select.Item>
        </Select.Content>
      </Select>
    </>
  );
}`,
      },
    },
  },
};

function CustomSelectRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="custom-root" />;
}
function CustomSelectLabel(props: SelectLabelProps) {
  return <Select.Label {...props} data-testid="custom-label" />;
}
function CustomSelectTrigger(props: SelectTriggerProps) {
  return <Select.Trigger {...props} data-testid="custom-trigger" />;
}

export const CustomSlots: EasyStory = {
  render: () => (
    <Select
      label="Fruit"
      options={FRUITS}
      defaultValue="apple"
      slots={{
        root: CustomSelectRoot,
        label: CustomSelectLabel,
        trigger: CustomSelectTrigger,
      }}
      slotProps={{
        root: { sx: { border: `1px solid ${vars.color.danger}` } },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('custom-root');
    await expect(root).toBeInTheDocument();
    await expect(root).toHaveAttribute('data-ui', 'select');
    await expect(canvas.getByTestId('custom-label')).toBeInTheDocument();
    await expect(canvas.getByTestId('custom-trigger')).toBeInTheDocument();
  },
};

function EasyControlledSelect(props: SelectEasyProps) {
  const [value, setValue] = useState('apple');
  const [open, setOpen] = useState(false);
  return (
    <Select
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}

export const EasyControlled: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <EasyControlledSelect {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await waitFor(() => expect(trigger).toHaveTextContent('Apple'));
    await userEvent.click(trigger);
    await userEvent.click(await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' }));
    await expect(args.onValueChange).toHaveBeenCalledWith('cherry');
    await expect(trigger).toHaveTextContent('Cherry');
    await expectClosed(canvasElement);
  },
};

export const EasyRejectedControlled: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, value: 'apple', onValueChange: fn() },
  render: (args) => <Select {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await userEvent.click(await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' }));
    await expect(args.onValueChange).toHaveBeenCalledWith('cherry');
    await expect(trigger).toHaveTextContent('Apple');
    await expectClosed(canvasElement);
  },
};

export const EasyDisabledOption: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <Select {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    const disabled = await bodyOf(canvasElement).findByRole('option', { name: 'Banana' });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await fireEvent.click(disabled);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(trigger).toHaveTextContent('Apple');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  },
};

export const EasyKeyboard: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <Select {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Apple');
    // Arrow down skips disabled Banana to Cherry
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Cherry');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledWith('cherry');
    await expect(trigger).toHaveTextContent('Cherry');
    await expectClosed(canvasElement);
  },
};

const CUSTOM_SELECT_OPTIONS: readonly SelectOption[] = [
  { value: 'apple', label: 'Apple', id: 'custom-apple-opt' },
  { value: 'cherry', label: 'Cherry', id: 'custom-cherry-opt', textValue: 'Zucchini' },
];

export const EasyOptionIdsAndTextValue: EasyStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: CUSTOM_SELECT_OPTIONS, defaultValue: 'apple' },
  render: (args) => <Select {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await userEvent.click(trigger);
    const apple = getOption(canvasElement, 'Apple');
    const cherry = getOption(canvasElement, 'Cherry');
    await expect(apple).toHaveAttribute('id', 'custom-apple-opt');
    await expect(cherry).toHaveAttribute('id', 'custom-cherry-opt');
    await userEvent.keyboard('z');
    await expectActive(canvasElement, 'Cherry');
  },
};

function DisabledWhileOpenSelect(props: SelectCompoundProps) {
  const [disabled, setDisabled] = useState(false);
  return (
    <>
      <SelectExample {...props} open disabled={disabled} />
      <Button onClick={() => setDisabled(true)}>Disable</Button>
    </>
  );
}

export const DisabledWhileOpen: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DisabledWhileOpenSelect {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox', { name: LABEL });
    const option = await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' });
    await userEvent.click(canvas.getByRole('button', { name: 'Disable' }));
    mocked(args.onOpenChange!).mockClear();
    await fireEvent.click(option);
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await fireEvent.keyDown(trigger, { key: 'c' });
    await fireEvent.click(trigger);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('listbox')).toBeNull());
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-activedescendant');
  },
};

export const NativeFormReset: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn() },
  render: (args) => (
    <form aria-label="Fruit form">
      <SelectExample {...args} name="fruit" defaultValue="apple" />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole('form', { name: 'Fruit form' }) as HTMLFormElement;
    const trigger = canvas.getByRole('combobox', { name: LABEL });
    await userEvent.click(trigger);
    await userEvent.click(await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' }));
    await expect(new FormData(form).get('fruit')).toBe('cherry');
    const calls = mocked(args.onValueChange!).mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(new FormData(form).get('fruit')).toBe('apple'));
    await expect(trigger).toHaveTextContent('Apple');
    await expect(args.onValueChange).toHaveBeenCalledTimes(calls);
  },
};

function AssociatedFormResetSelect(props: SelectCompoundProps) {
  const formId = useId();
  const [cancelReset, setCancelReset] = useState(true);
  return (
    <>
      <form id={formId} onReset={event => { if (cancelReset) event.preventDefault(); }}>
        <Button type="reset">Reset</Button>
      </form>
      <Button onClick={() => setCancelReset(false)}>Allow reset</Button>
      <Select {...props} defaultValue="apple">
        <Select.Trigger form={formId} aria-label={LABEL}><Select.Value /></Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="cherry">Cherry</Select.Item>
        </Select.Content>
      </Select>
      <Select {...props} value="cherry">
        <Select.Trigger form={formId} aria-label="Controlled fruit"><Select.Value /></Select.Trigger>
        <Select.Content><Select.Item value="cherry">Cherry</Select.Item></Select.Content>
      </Select>
    </>
  );
}

export const AssociatedFormReset: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn() },
  render: args => <AssociatedFormResetSelect {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox', { name: LABEL });
    await userEvent.click(trigger);
    await userEvent.click(await bodyOf(canvasElement).findByRole('option', { name: 'Cherry' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(trigger).toHaveTextContent('Cherry');
    await userEvent.click(canvas.getByRole('button', { name: 'Allow reset' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(trigger).toHaveTextContent('Apple'));
    await expect(canvas.getByRole('combobox', { name: 'Controlled fruit' })).toHaveTextContent('Cherry');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

function ControlledSelect(props: SelectCompoundProps) {
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
ControlledSelect.displayName = 'ControlledSelect';

export const EasyFormReset: EasyStory = {
  render: () => (
    <form aria-label="Fruit form">
      <Select
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
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await userEvent.click(getOption(canvasElement, 'Cherry'));
    await expect(new FormData(form).get('fruit')).toBe('cherry');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(new FormData(form).get('fruit')).toBe('apple'));
    await expect(trigger).toHaveTextContent('Apple');
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

export const ScrollableRtl: Story = {
  args: { defaultOpen: true, defaultValue: 'project-0' },
  render: (args) => (
    <NarrowFrame>
      <Select {...args}>
        <Select.Trigger dir="rtl" aria-label={LABEL}>
          <Select.Value placeholder={PLACEHOLDER} />
        </Select.Trigger>
        <Select.Content dir="rtl">
          {Array.from({ length: 20 }, (_, index) => (
            <Select.Item key={index} value={`project-${index}`} disabled={index === 1}>
              {`Project ${index + 1}: review the latest changes before publishing`}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </NarrowFrame>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger.getBoundingClientRect().width).toBeLessThanOrEqual(240);
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}{End}');
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await expect(getComputedStyle(listbox).direction).toBe('rtl');
    await expect(listbox.scrollHeight).toBeGreaterThan(listbox.clientHeight);
    await expect(listbox.getBoundingClientRect().height).toBeLessThanOrEqual(280);
    await expectActive(canvasElement, 'Project 20: review the latest changes before publishing');
    const last = getOption(canvasElement, 'Project 20: review the latest changes before publishing');
    await expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(listbox.getBoundingClientRect().bottom);
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

export const LightThemeOpen: Story = {
  decorators: [withLightTheme],
  args: { defaultOpen: true, defaultValue: 'apple' },
  render: (args) => <SelectExample {...args} />,
  play: async ({ canvasElement }) => {
    const listbox = await bodyOf(canvasElement).findByRole('listbox', { name: LABEL });
    await expect(listbox).toBeVisible();
    await expect(canvasElement.contains(listbox)).toBe(false);
    await expectThemedSurface(listbox, 'light');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultValue: 'apple' },
  render: (args) => <SelectExample {...args} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(getTrigger(canvasElement));
    const listbox = await bodyOf(canvasElement).findByRole('listbox');
    await expect(listbox).toBeVisible();
    // The listbox is portaled out of the light ThemeRoot yet paints the light surface.
    await expect(canvasElement.contains(listbox)).toBe(false);
    await expectThemedSurface(listbox, 'light');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};
