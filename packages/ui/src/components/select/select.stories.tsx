import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, mocked, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
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

export const NestedDismissal: StoryObj = {
  tags: ['!autodocs'],
  render: () => (
    <>
      <Popover defaultOpen>
        <Popover.Trigger>Parent</Popover.Trigger>
        <Popover.Content aria-label="Parent">
          <Select label="Nested fruit" options={FRUITS} />
        </Popover.Content>
      </Popover>
      <Button>Outside</Button>
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    const parent = body.getByRole('dialog', { name: 'Parent' });
    const trigger = within(parent).getByRole('combobox', { name: 'Nested fruit' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    const list = await body.findByRole('listbox');
    await userEvent.keyboard('{End}');
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-activedescendant', within(list).getByRole('option', { name: 'Cherry' }).id),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('listbox')).toBeNull());
    await expect(parent).toBeVisible();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('listbox');
    const outside = body.getByRole('button', { name: 'Outside' });
    await userEvent.click(outside);
    await waitFor(() => expect(body.queryByRole('listbox')).toBeNull());
    await expect(parent).toBeVisible();
    await expect(outside).toHaveFocus();
  },
};

const FRUITS: readonly SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

const morphSnippet = `<Select variant="morph" label="Fruit" defaultValue="apple"
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]} />`;

/** Open the pill to choose a fruit. */
export const Morph: EasyStory = {
  args: { variant: 'morph', label: LABEL, options: FRUITS, defaultValue: 'apple', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <Select {...args} />,
  parameters: { docs: { source: { language: 'tsx', code: morphSnippet } } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowDown}');
    const list = within(canvasElement.ownerDocument.body).getByRole('listbox');
    await expect(list).toHaveAttribute('data-variant', 'morph');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expect(trigger).toHaveTextContent('Cherry');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(within(canvasElement.ownerDocument.body).queryByRole('listbox')).toBeNull();
    await waitFor(async () => { await expect(list).not.toBeVisible(); });
    await userEvent.keyboard('{ArrowDown}{Home}{Escape}');
    await expect(trigger).toHaveTextContent('Cherry');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const MorphLight: EasyStory = {
  ...Morph,
  parameters: { docs: { source: { language: 'tsx', code: `<ThemeRoot theme="light">
  <Select variant="morph" label="Fruit" defaultValue="apple" options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]} />
</ThemeRoot>` } } },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
/** Enable reduced motion to open and close without geometric animation. */
export const MorphReducedMotion: EasyStory = {
  ...Morph,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    const panel = within(canvasElement.ownerDocument.body).getByRole('listbox');
    await expect(panel.style.transform).toBe('');
    await userEvent.keyboard('{Escape}');
    await expect(panel).not.toBeVisible();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
  },
};
export const MorphRTL: EasyStory = {
  ...Morph,
  parameters: { docs: { source: { language: 'tsx', code: `<div dir="rtl">
  <Select variant="morph" label="Fruit" defaultValue="apple" options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]} />
</div>` } } },
  render: (args) => <div dir="rtl"><Select {...args} /></div>,
};
export const MorphOpen: EasyStory = {
  args: { variant: 'morph', label: LABEL, options: FRUITS, defaultValue: 'apple', open: true },
  render: (args) => <Select {...args} />,
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: morphSnippet } } },
};
export const MorphOpenLight: EasyStory = {
  ...MorphOpen,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const MorphControlledRejects: EasyStory = {
  args: { variant: 'morph', label: LABEL, options: FRUITS, value: 'apple', open: true,
    name: 'fruit', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <form><Select {...args} /></form>,
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: '<Select variant="morph" label="Fruit" options={fruits}\n  value={fruit} onValueChange={setFruit} open={open} onOpenChange={setOpen} />' } } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.tab();
    await userEvent.keyboard('{End}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('cherry');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(trigger).toHaveTextContent('Apple');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(new FormData(canvasElement.querySelector('form')!).get('fruit')).toBe('apple');
    await expect(within(canvasElement.ownerDocument.body).getByRole('listbox')).toBeVisible();
  },
};

const PLAN_LABEL = 'Billing plan';
const PLANS: readonly SelectOption[] = [
  { value: 'free', label: 'Free' },
  { value: 'enterprise', label: 'Enterprise', disabled: true },
  { value: 'pro', label: 'Pro' },
];

const snippet = `import { Button, Select, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PlanActions = styled.div({
  display: 'flex',
  alignItems: 'flex-end',
  gap: vars.space[3],
});

<PlanActions>
  <Select
    label="Billing plan"
    placeholder="Pick a plan"
    options={[
      { value: 'free', label: 'Free' },
      { value: 'enterprise', label: 'Enterprise', disabled: true },
      { value: 'pro', label: 'Pro' },
    ]}
    defaultValue="free"
  />
  <Button>Upgrade</Button>
</PlanActions>`;

const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
});

// A labeled field is taller than its control; an action beside it aligns to the control's bottom.
const FieldRow = styled.div({
  display: 'flex',
  alignItems: 'flex-end',
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
- Set \`initialActiveValue\` to highlight an enabled option when the value has no matching option. Opening by typeahead uses the match instead. Highlighting does not select an option.
- Long lists scroll inside the popup. Use CSS \`scroll-padding\` on Content to reserve space for sticky content.
- The list stays mounted and hidden when closed so labels remain available; positioning runs only when open.
- name adds a hidden form input. Native required validation is not supported.

### Morph presentation
- Set \`variant="morph"\` for a pill trigger and a measured trigger-to-panel spring. The same option collection, keyboard map and form value apply in easy and compound mode.
- Reduced motion skips the spring. Closing removes the list from interaction immediately, before its visual collapse finishes.
- Use item children for icons or trailing details. For typed search use Combobox; this variant does not add search, groups or a second selection model.`,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;
type EasyStory = StoryObj<(props: SelectEasyProps) => ReactNode>;

const LONG_OPTIONS = Array.from({ length: 1440 }, (_, index) => ({
  value: String(index), label: `Option ${index}`,
}));
const ScrollHost = styled.div({ blockSize: 240, overflow: 'auto' });
const ScrollSpace = styled.div({ blockSize: 600 });

/** Open a long list inside a scrolling region. */
export const LongList: EasyStory = {
  args: { label: 'Option', options: LONG_OPTIONS, initialActiveValue: '720', onValueChange: fn() },
  tags: ['!autodocs'],
  render: (args) => (
    <>
      <ScrollHost data-testid="scroll-host">
        <Select {...args} />
        <ScrollSpace />
      </ScrollHost>
      <ScrollSpace />
      <ScrollSpace />
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    const host = canvas.getByTestId('scroll-host');
    const view = canvasElement.ownerDocument.defaultView!;
    trigger.focus({ preventScroll: true });
    const pageScroll = [view.scrollX, view.scrollY];
    const hostScroll = host.scrollTop;
    const start = performance.now();
    await userEvent.keyboard('{ArrowDown}');
    const popup = await within(canvasElement.ownerDocument.body).findByRole('listbox');
    const options = within(popup).getAllByRole('option');
    await expect(options.length).toBe(1440);
    await expect(options.every((option) => !Object.hasOwn(option, 'scrollIntoView'))).toBe(true);
    const expectActiveVisible = async (index: number) => {
      const option = options[index]!;
      await waitFor(async () => {
        await expect(trigger).toHaveAttribute('aria-activedescendant', option.id);
        await expect(option).toHaveAttribute('data-active');
        const panelRect = popup.getBoundingClientRect();
        const optionRect = option.getBoundingClientRect();
        await expect(optionRect.top).toBeGreaterThanOrEqual(panelRect.top);
        await expect(optionRect.bottom).toBeLessThanOrEqual(panelRect.bottom);
      });
      await expect([view.scrollX, view.scrollY]).toEqual(pageScroll);
      await expect(host.scrollTop).toBe(hostScroll);
      await expect(trigger).toHaveFocus();
    };
    await expectActiveVisible(720);
    await expect(performance.now() - start).toBeLessThan(10_000);
    await expect(popup.scrollTop).toBeGreaterThan(0);
    await expect(popup.querySelector('[aria-selected="true"]')).toBeNull();
    await userEvent.keyboard('{End}');
    await expectActiveVisible(1439);
    await userEvent.keyboard('{ArrowDown}');
    await expectActiveVisible(0);
    await userEvent.keyboard('{ArrowUp}');
    await expectActiveVisible(1439);
    await userEvent.keyboard('{Home}');
    await expectActiveVisible(0);
    await userEvent.keyboard('{Escape}{ArrowDown}');
    await expectActiveVisible(720);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
  },
};

/** Seed a highlight without selecting an option. */
export const InitialActive: EasyStory = {
  args: { label: LABEL, options: FRUITS, initialActiveValue: 'cherry', onValueChange: fn() },
  render: (args) => <Select {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    const cherry = within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Cherry' });
    await waitFor(() => expect(trigger).toHaveAttribute('aria-activedescendant', cherry.id));
    await expect(cherry).toHaveAttribute('aria-selected', 'false');
    await userEvent.keyboard('{Escape}a');
    const apple = within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Apple' });
    await waitFor(() => expect(trigger).toHaveAttribute('aria-activedescendant', apple.id));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
  },
};

export const InitialActiveDisabled: EasyStory = {
  ...InitialActive,
  args: { label: LABEL, options: FRUITS, initialActiveValue: 'banana' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    const apple = within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Apple' });
    await waitFor(() => expect(canvas.getByRole('combobox')).toHaveAttribute('aria-activedescendant', apple.id));
    await userEvent.keyboard('{Escape}');
  },
};

export const InitialActiveSelected: EasyStory = {
  ...InitialActiveDisabled,
  args: { label: LABEL, options: FRUITS, initialActiveValue: 'cherry', defaultValue: 'apple' },
};

export const InitialActiveOpen: EasyStory = {
  ...InitialActive,
  args: { label: LABEL, options: FRUITS, initialActiveValue: 'cherry', defaultOpen: true },
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement }) => {
    const cherry = within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Cherry' });
    await waitFor(() => expect(canvas.getByRole('combobox')).toHaveAttribute('aria-activedescendant', cherry.id));
    await expect(cherry).toHaveAttribute('data-active');
  },
};

export const UnselectedOpen: EasyStory = {
  ...InitialActiveOpen,
  args: { label: LABEL, options: FRUITS, defaultOpen: true },
  play: async ({ canvas, canvasElement }) => {
    const apple = within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Apple' });
    await waitFor(() => expect(canvas.getByRole('combobox')).toHaveAttribute('aria-activedescendant', apple.id));
  },
};

const StickyHeader = styled.div({
  position: 'sticky', insetBlockStart: 0, blockSize: vars.space[12], flexShrink: 0,
  background: vars.color.surfaceRaised, zIndex: 1,
});
const HeaderContent = styled(Select.Content)({ scrollPaddingBlockStart: vars.space[12] });

/** Keep the highlighted option below a sticky header. */
export const StickyList: Story = {
  render: () => (
    <Select initialActiveValue="720">
      <Select.Trigger aria-label="Option"><Select.Value placeholder="Choose an option" /></Select.Trigger>
      <HeaderContent>
        <StickyHeader aria-hidden>Options</StickyHeader>
        {LONG_OPTIONS.map((option) => <Select.Item key={option.value} value={option.value}>{option.label}</Select.Item>)}
      </HeaderContent>
    </Select>
  ),
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    const popup = within(canvasElement.ownerDocument.body).getByRole('listbox');
    const expectVisible = async () => {
      await waitFor(async () => {
        const option = canvasElement.ownerDocument.getElementById(trigger.getAttribute('aria-activedescendant')!)!;
        const panelRect = popup.getBoundingClientRect();
        const optionRect = option.getBoundingClientRect();
        await expect(optionRect.top).toBeGreaterThanOrEqual(panelRect.top + parseFloat(getComputedStyle(popup).scrollPaddingTop));
        await expect(optionRect.bottom).toBeLessThanOrEqual(panelRect.bottom);
      });
    };
    await expectVisible();
    await userEvent.keyboard('{End}{ArrowUp}{Home}');
    await expectVisible();
    await userEvent.keyboard('{Escape}');
  },
};
// @ts-expect-error Generated-part slot keys are closed.
type UnknownSlot = NonNullable<SelectEasyProps['slotProps']>['unknown'];
// @ts-expect-error Replacement slot keys are closed.
type UnknownReplacement = NonNullable<SelectEasyProps['slots']>['unknown'];

/** Restyle the generated label and every option with slotProps. */
export const SlotProps: EasyStory = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Select } from '@jfrader/ui';

function FruitField(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<Select label="Fruit" defaultValue="apple" component={FruitField}
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]}
  slotProps={{ label: { css: { fontStyle: 'italic' } }, item: { className: 'fruit-option' } }}
/>` } } },
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

function getTrigger(canvasElement: HTMLElement, name = LABEL) {
  return within(canvasElement).getByRole('combobox', { name });
}

function getOption(canvasElement: HTMLElement, name: string) {
  return bodyOf(canvasElement).getByRole('option', { name });
}

/** Virtual focus: the option is referenced by aria-activedescendant while DOM focus stays on the trigger. */
async function expectActive(canvasElement: HTMLElement, name: string, label = LABEL) {
  const trigger = getTrigger(canvasElement, label);
  await waitFor(() => expect(trigger).toHaveAttribute('aria-activedescendant', getOption(canvasElement, name).id));
  await expect(getOption(canvasElement, name)).toHaveAttribute('data-active');
  await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
}

async function expectClosed(canvasElement: HTMLElement, label = LABEL) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('listbox')).toBeNull());
  const trigger = getTrigger(canvasElement, label);
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
    label: PLAN_LABEL,
    placeholder: 'Pick a plan',
    options: PLANS,
    defaultValue: 'free',
    onValueChange: fn(),
  },
  render: (args) => (
    <FieldRow>
      <Select {...args} />
      <Button>Upgrade</Button>
    </FieldRow>
  ),
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: snippet,
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement, PLAN_LABEL);
    await expect(trigger.tagName).toBe('BUTTON');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');
    await waitFor(() => expect(trigger).toHaveTextContent('Free'));

    await userEvent.click(trigger);
    const listbox = await bodyOf(canvasElement).findByRole('listbox', { name: PLAN_LABEL });
    await expect(canvasElement.contains(listbox)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    await expect(within(listbox).getAllByRole('option')).toHaveLength(3);
    await expect(getOption(canvasElement, 'Free')).toHaveAttribute('aria-selected', 'true');
    await expect(getOption(canvasElement, 'Pro')).toHaveAttribute('aria-selected', 'false');
    // Pointer open highlights the selected option.
    await expectActive(canvasElement, 'Free', PLAN_LABEL);

    await userEvent.click(getOption(canvasElement, 'Pro'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pro');
    await expectClosed(canvasElement, PLAN_LABEL);
    await expect(trigger).toHaveTextContent('Pro');
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const Compound: Story = {
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <SelectExample {...args} />,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useId } from 'react';
import { Select } from '@jfrader/ui';

function FruitPicker() {
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
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Select, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const FruitLabel = styled(Select.Label)({ fontStyle: 'italic' });
const FruitTrigger = styled(Select.Trigger)({ fontWeight: 600 });
function FruitField(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<Select label="Fruit" defaultValue="apple"
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]}
  slots={{ root: FruitField, label: FruitLabel, trigger: FruitTrigger }}
  slotProps={{ root: { sx: { border: '1px solid ' + vars.color.danger } } }}
/>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<form aria-label="Fruit form">
  <Select label="Fruit" name="fruit" defaultValue="apple" options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]} />
  <Button type="reset">Reset</Button>
</form>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select>
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="banana" disabled>Banana</Select.Item>
    <Select.Item value="cherry">Cherry</Select.Item>
  </Select.Content>
</Select>` } } },
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
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <Select defaultValue="apple">
    <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
    <Select.Content>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Item value="banana" disabled>Banana</Select.Item>
      <Select.Item value="cherry">Cherry</Select.Item>
    </Select.Content>
  </Select>
  <Button>Continue</Button>
</>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select>
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="banana" disabled>Banana</Select.Item>
    <Select.Item value="cherry">Cherry</Select.Item>
  </Select.Content>
</Select>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select defaultValue="apple">
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="banana" disabled>Banana</Select.Item>
    <Select.Item value="cherry">Cherry</Select.Item>
  </Select.Content>
</Select>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select>
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="apricot">Apricot</Select.Item>
    <Select.Item value="peach">Peach</Select.Item>
  </Select.Content>
</Select>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <Select defaultValue="apple">
    <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
    <Select.Content>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Item value="banana" disabled>Banana</Select.Item>
      <Select.Item value="cherry">Cherry</Select.Item>
    </Select.Content>
  </Select>
  <Button>Continue</Button>
</>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select defaultValue="apple">
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="banana" disabled>Banana</Select.Item>
    <Select.Item value="cherry">Cherry</Select.Item>
  </Select.Content>
</Select>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select disabled defaultValue="apple">
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="banana" disabled>Banana</Select.Item>
    <Select.Item value="cherry">Cherry</Select.Item>
  </Select.Content>
</Select>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<form aria-label="Order">
  <Select name="fruit">
    <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
    <Select.Content>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Item value="banana" disabled>Banana</Select.Item>
      <Select.Item value="cherry">Cherry</Select.Item>
    </Select.Content>
  </Select>
</form>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select value="apple">
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="banana" disabled>Banana</Select.Item>
    <Select.Item value="cherry">Cherry</Select.Item>
  </Select.Content>
</Select>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `<Select open={false}>
  <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="apple">Apple</Select.Item>
    <Select.Item value="banana" disabled>Banana</Select.Item>
    <Select.Item value="cherry">Cherry</Select.Item>
  </Select.Content>
</Select>` } } },
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
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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
  parameters: { docs: { source: { language: 'tsx', code: `<ThemeRoot theme="light">
  <Select defaultValue="apple">
    <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
    <Select.Content>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Item value="banana" disabled>Banana</Select.Item>
      <Select.Item value="cherry">Cherry</Select.Item>
    </Select.Content>
  </Select>
</ThemeRoot>` } } },
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
