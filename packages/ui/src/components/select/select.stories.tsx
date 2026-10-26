import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, mocked, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { doubleRootText, expectControlHeights } from '../../testing/control-size-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import {
  Select,
  type SelectComposedProps,
  type SelectShorthandProps,
  type SelectItemProps,
  type SelectOption,
  type SelectProps,
  type SelectLabelProps,
  type SelectTriggerProps,
} from './index';

// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: 240 });
export const ControlSizeContract: Story = {
  name: 'Control size contract',
  render: () => <>{(['sm', 'md', 'lg'] as const).map(size => <Select key={size} size={size} options={[{ value: 'draft', label: 'Draft' }]} defaultValue="draft" slotProps={{ trigger: { 'aria-label': `${size} status` } }} />)}</>,
  play: async ({ canvas }) => { await expectControlHeights(canvas.getAllByRole('combobox')); },
};
export const RootRelativeSizes: Story = {
  ...ControlSizeContract,
  name: 'Root-relative control sizes',
  beforeEach: doubleRootText,
  play: async ({ canvas }) => { await expectControlHeights(canvas.getAllByRole('combobox'), [64, 80, 96]); },
};
const VisualGrid = styled.div({
  display: 'grid',
  gap: vars.space[6],
  inlineSize: `min(640px, calc(100vw - ${vars.space[8]}))`,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
});
const EdgeFrame = styled.div({
  position: 'fixed',
  insetInlineEnd: vars.space[4],
  insetBlockEnd: vars.space[4],
  inlineSize: `min(240px, calc(100% - ${vars.space[8]}))`,
});
const LABEL = 'Fruit';
const PLACEHOLDER = 'Pick a fruit';
const TYPEAHEAD_PAUSE_MS = 550;

const LayerFrame = styled.div({
  inlineSize: `min(320px, calc(100vw - ${vars.space[8]}))`,
  minBlockSize: '320px',
});
const StickySibling = styled.div({
  position: 'sticky',
  top: 0,
  zIndex: 1,
  blockSize: '160px',
  backgroundColor: vars.color.surfaceRaised,
});

export const AboveStickyContent: StoryObj = {
  name: 'Above sticky content',
  tags: ['!autodocs'],
  render: () => (
    <LayerFrame>
      <div><Select label={LABEL} options={FRUITS} /></div>
      <StickySibling data-testid="sticky-sibling">Sticky content</StickySibling>
    </LayerFrame>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox', { name: LABEL });
    await userEvent.click(trigger);
    const list = await within(doc.body).findByRole('listbox', { name: LABEL });
    await expect(getComputedStyle(list).zIndex).toBe('100');
    await settleMotion(list);
    const option = within(list).getByRole('option', { name: 'Apple' });
    await waitFor(() => {
      const rect = option.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const sticky = canvas.getByTestId('sticky-sibling');
      const covered = sticky.getBoundingClientRect();
      expect(getComputedStyle(sticky).position).toBe('sticky');
      expect(getComputedStyle(sticky).zIndex).toBe('1');
      expect(x).toBeGreaterThan(covered.left);
      expect(x).toBeLessThan(covered.right);
      expect(y).toBeGreaterThan(covered.top);
      expect(y).toBeLessThan(covered.bottom);
      expect(option.contains(doc.elementFromPoint(x, y))).toBe(true);
    });
    await userEvent.click(option);
    await expect(trigger).toHaveTextContent('Apple');
    await waitFor(() => expect(within(doc.body).queryByRole('listbox')).toBeNull());
  },
};

export const LayerOverride: StoryObj = {
  name: 'Layer override',
  tags: ['!autodocs'],
  render: () => (
    <LayerFrame>
      <Select label={LABEL} options={FRUITS} slotProps={{ content: { sx: { zIndex: vars.zIndex.toast } } }} />
      <Select>
        <Select.Trigger aria-label="CSS layer"><Select.Value placeholder={PLACEHOLDER} /></Select.Trigger>
        <Select.Content css={{ zIndex: vars.zIndex.modal }}>
          <Select.Item value="apple">Apple</Select.Item>
        </Select.Content>
      </Select>
    </LayerFrame>
  ),
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: LABEL }));
    const list = await within(canvasElement.ownerDocument.body).findByRole('listbox', { name: LABEL });
    await expect(getComputedStyle(list).zIndex).toBe('300');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'CSS layer' }));
    const cssList = await within(canvasElement.ownerDocument.body).findByRole('listbox', { name: 'CSS layer' });
    await expect(getComputedStyle(cssList).zIndex).toBe('200');
  },
};

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

const morphSnippet = `import { Select } from '@jfrader/ui';

<Select variant="morph" label="Fruit" defaultValue="apple"
  options={[
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
  ]} />`;

/** Open the pill to choose a fruit. */
export const Morph: ShorthandStory = {
  args: { variant: 'morph', label: LABEL, options: FRUITS, defaultValue: 'apple', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <Select {...args} />,
  parameters: { docs: { description: { story: 'Choose a fruit from a pill trigger with an animated popup.' }, source: { language: 'tsx', code: morphSnippet } } },
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
export const MorphLight: ShorthandStory = {
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
export const MorphReducedMotion: ShorthandStory = {
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
export const MorphRTL: ShorthandStory = {
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
export const MorphOpen: ShorthandStory = {
  args: { variant: 'morph', label: LABEL, options: FRUITS, defaultValue: 'apple', open: true },
  render: (args) => <Select {...args} />,
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: morphSnippet } } },
};
export const MorphOpenLight: ShorthandStory = {
  ...MorphOpen,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const MorphControlledRejects: ShorthandStory = {
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

const meta: Meta<SelectComposedProps> = {
  title: 'Inputs/Select',
  component: Select,
  parameters: {
    docs: {
      description: {
        component:
          'Choose one option from a dropdown list.',
      },
      sections: [
        { title: 'Choose an option', stories: ['Default', 'Placeholder', 'Morph'] },
        { title: 'Compose the field', stories: ['Composed'] },
        { title: 'Unavailable choices', stories: ['DisabledSelect'] },
        { title: 'Forms', stories: ['ShorthandFormReset'] },
        { title: 'Keyboard and dismissal', stories: ['Keyboard', 'TypeaheadAcrossOpening', 'OutsidePress', 'InitialActive'] },
      ],
      usage: `### When to use
- Use Select for one choice from a fixed list. Use MultiSelect for several choices or Combobox for typed search.

### Keyboard and accessibility

- The trigger is a select-only combobox with a listbox. DOM focus stays on the trigger; aria-activedescendant identifies the highlighted option.
- Enter/Space/ArrowDown opens on the selected or first enabled option. ArrowUp opens on the selected or last enabled option.
- Arrows wrap and skip disabled options; Home/End reach the ends. Enter/Space selects and closes; Escape/Tab closes without selecting. Tab lets focus move on.
- Printable characters match enabled options by case-insensitive prefix. The 500ms buffer continues across opening; closed-state typeahead opens without changing the value.
- Pointer selection closes the list. Disabled options remain visible and ignore clicks; pressing inside the list never takes focus from the trigger.

### Constraints and forms

- Option values must be unique. Highlighting an option does not select it.
- Long lists scroll inside the popup.
- Named fields submit a single value. Native required validation is not supported.

### Motion

- Reduced motion skips the pill presentation's spring. Closing removes the list from interaction immediately, before its visual collapse finishes.`,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;
type ShorthandStory = StoryObj<(props: SelectShorthandProps) => ReactNode>;

const LONG_LABEL = 'InternationalEnterpriseWorkspaceWithoutWordSeparators';

export const FieldStates: ShorthandStory = {
  tags: ['!autodocs'],
  render: () => (
    <VisualGrid>
      <Select label="Small" size="sm" options={FRUITS} defaultValue="apple" />
      <Select label="Large" size="lg" options={FRUITS} defaultValue="cherry" />
      <Select label="Unavailable" disabled options={FRUITS} defaultValue="apple" description="Contact the workspace owner." />
      <Select label="Workspace" options={FRUITS} placeholder="Choose a workspace" description="Choose where to publish." error="Choose a workspace to continue." />
      <Select label="Empty" options={[]} empty="No workspaces" placeholder="Choose a workspace" />
      <Select label="Long workspace name" options={[{ value: 'long', label: LONG_LABEL }]} defaultValue="long" />
    </VisualGrid>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const trigger of canvas.getAllByRole('combobox')) {
      await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
      await expect(trigger.getBoundingClientRect().right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth);
      await expect(Number.parseFloat(getComputedStyle(trigger).columnGap)).toBeGreaterThanOrEqual(8);
    }
    const invalid = canvas.getByRole('combobox', { name: 'Workspace' });
    await expect(invalid).toHaveAttribute('aria-invalid', 'true');
    await expect(invalid).toHaveAccessibleDescription('Choose where to publish. Choose a workspace to continue.');
    await userEvent.click(canvas.getByRole('combobox', { name: 'Empty' }));
    await expect(bodyOf(canvasElement).getByText('No workspaces')).toBeVisible();
    await userEvent.keyboard('{Escape}');
  },
};

export const Grouped: Story = {
  tags: ['!autodocs'],
  render: () => (
    <Select>
      <Select.Trigger aria-label="Destination"><Select.Value placeholder="Choose a destination" /></Select.Trigger>
      <Select.Content>
        <div role="group" aria-label="Europe">
          <Select.Item value="madrid">Madrid</Select.Item>
          <Select.Item value="paris" disabled>Paris</Select.Item>
        </div>
        <div role="group" aria-label="Americas">
          <Select.Item value="lima">Lima</Select.Item>
          <Select.Item value="quito">Quito</Select.Item>
        </div>
      </Select.Content>
    </Select>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Lima', 'Destination');
  },
};

export const ViewportEdge: ShorthandStory = {
  tags: ['!autodocs'],
  args: { label: 'Workspace', options: Array.from({ length: 30 }, (_, i) => ({ value: String(i), label: `${LONG_LABEL} ${i}` })), defaultValue: '0' },
  render: (args) => <EdgeFrame><Select {...args} /></EdgeFrame>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    const panel = await bodyOf(canvasElement).findByRole('listbox');
    await waitFor(async () => {
      const anchor = trigger.getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      await expect(Math.abs(anchor.top - rect.bottom - 8)).toBeLessThanOrEqual(1);
      await expect(rect.left).toBeGreaterThanOrEqual(8);
      await expect(rect.right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth - 8);
      await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    });
    await userEvent.keyboard('{End}');
    await waitFor(async () => {
      const active = canvasElement.ownerDocument.getElementById(trigger.getAttribute('aria-activedescendant')!)!;
      await expect(active.getBoundingClientRect().bottom).toBeLessThanOrEqual(panel.getBoundingClientRect().bottom);
      await expect(active.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    });
  },
};

export const MorphViewportEdge: ShorthandStory = {
  ...ViewportEdge,
  args: { ...ViewportEdge.args, variant: 'morph' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    const panel = await bodyOf(canvasElement).findByRole('listbox');
    await waitFor(async () => {
      const anchor = canvas.getByRole('combobox').getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      await expect(Math.abs(anchor.top - rect.bottom)).toBeLessThanOrEqual(1);
      await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    });
  },
};

const LONG_OPTIONS = Array.from({ length: 1440 }, (_, index) => ({
  value: String(index), label: `Option ${index}`,
}));
const ScrollHost = styled.div({ blockSize: 240, overflow: 'auto' });
const ScrollSpace = styled.div({ blockSize: 600 });

/** Open a long list inside a scrolling region. */
export const LongList: ShorthandStory = {
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
export const InitialActive: ShorthandStory = {
  parameters: { docs: {
    description: { story: 'Open with Cherry highlighted without selecting it, or type a prefix to highlight another option.' },
    source: { language: 'tsx', code: `import { Select } from '@jfrader/ui';

<Select label="Fruit" initialActiveValue="cherry" options={[
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
]} />` },
  } },
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

export const InitialActiveDisabled: ShorthandStory = {
  ...InitialActive,
  args: { label: LABEL, options: FRUITS, initialActiveValue: 'banana' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    const apple = within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Apple' });
    await waitFor(() => expect(canvas.getByRole('combobox')).toHaveAttribute('aria-activedescendant', apple.id));
    await userEvent.keyboard('{Escape}');
  },
};

export const InitialActiveSelected: ShorthandStory = {
  ...InitialActiveDisabled,
  args: { label: LABEL, options: FRUITS, initialActiveValue: 'cherry', defaultValue: 'apple' },
};

export const InitialActiveOpen: ShorthandStory = {
  ...InitialActive,
  args: { label: LABEL, options: FRUITS, initialActiveValue: 'cherry', defaultOpen: true },
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement }) => {
    const cherry = within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Cherry' });
    await waitFor(() => expect(canvas.getByRole('combobox')).toHaveAttribute('aria-activedescendant', cherry.id));
    await expect(cherry).toHaveAttribute('data-active');
  },
};

export const UnselectedOpen: ShorthandStory = {
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
type UnknownSlot = NonNullable<SelectShorthandProps['slotProps']>['unknown'];
// @ts-expect-error Replacement slot keys are closed.
type UnknownReplacement = NonNullable<SelectShorthandProps['slots']>['unknown'];

/** Restyle the generated label and every option with slotProps. */
export const SlotProps: ShorthandStory = {
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
  slotProps={{ label: { sx: { fontStyle: 'italic' } }, item: { className: 'fruit-option' } }}
/>` } } },
  args: {
    label: 'Fruit', options: FRUITS, defaultValue: 'apple',
    component: CustomSelectRoot,
    slotProps: { label: { sx: { fontStyle: 'italic' } }, item: { className: 'fruit-option' } },
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
  // @ts-expect-error Presentation props are rejected in composed mode without options.
  childrenWithLabel: CheckedSelect<{ label: string; children: ReactNode }>;
  // @ts-expect-error Presentation props are rejected in composed mode without options.
  childrenWithPlaceholder: CheckedSelect<{ placeholder: string; children: ReactNode }>;
  // @ts-expect-error Composed mode rejects slots and slotProps.
  childrenWithSlots: CheckedSelect<{ slots: { root?: () => null }; children: ReactNode }>;
};

type Status = 'draft' | 'live';
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'live', label: 'Live' },
] as const satisfies readonly SelectOption<Status>[];

/** Compile-time consumer checks; never rendered. */
function SelectFromProps(props: SelectProps<Status>) {
  return <Select {...props} />;
}

function SelectGenericChecks() {
  const saveStatus = (status: Status) => status;
  return (
    <>
      <Select<Status> options={STATUS_OPTIONS} value="draft" onValueChange={saveStatus} />
      <Select options={STATUS_OPTIONS as readonly SelectOption<Status>[]} onValueChange={(next) => saveStatus(next)} />
      {/* @ts-expect-error value must be one of the options */}
      <Select<Status> options={STATUS_OPTIONS} value="paused" />
      {/* @ts-expect-error the callback must accept every option value */}
      <Select<Status> options={STATUS_OPTIONS} onValueChange={(next: 'paused') => next} />
    </>
  );
}

function SelectExample(props: SelectComposedProps) {
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

export const Default: ShorthandStory = {
  name: 'Choose a billing plan',
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
      description: { story: 'Choose a billing plan beside an upgrade action; Enterprise is unavailable.' },
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

export const Composed: Story = {
  name: 'Compose a fruit picker',
  args: { defaultValue: 'apple', onValueChange: fn() },
  render: (args) => <SelectExample {...args} />,
  parameters: {
    docs: {
      description: { story: 'Connect an external label to the trigger and display the selected fruit.' },
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

export const CustomSlots: ShorthandStory = {
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

function ShorthandControlledSelect(props: SelectShorthandProps) {
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

export const ShorthandControlled: ShorthandStory = {
  tags: ['!autodocs'],
  args: { label: LABEL, options: FRUITS, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ShorthandControlledSelect {...args} />,
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

export const ShorthandRejectedControlled: ShorthandStory = {
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

export const ShorthandDisabledOption: ShorthandStory = {
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

export const ShorthandKeyboard: ShorthandStory = {
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

export const ShorthandOptionIdsAndTextValue: ShorthandStory = {
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

function DisabledWhileOpenSelect(props: SelectComposedProps) {
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

function AssociatedFormResetSelect(props: SelectComposedProps) {
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

function ControlledSelect(props: SelectComposedProps) {
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

export const ShorthandFormReset: ShorthandStory = {
  name: 'Reset a form',
  parameters: { docs: { description: { story: 'Choose another fruit, then reset the form to restore Apple.' }, source: { language: 'tsx', code: `import { Button, Select } from '@jfrader/ui';

<form aria-label="Fruit form">
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
  name: 'Start without a selection',
  parameters: { docs: { description: { story: 'Show a prompt until a fruit is selected.' }, source: { language: 'tsx', code: `import { Select } from '@jfrader/ui';

<Select>
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
  name: 'Keyboard navigation',
  parameters: { docs: { description: { story: 'Focus the field, use arrows to skip Banana, and press Enter to select or Escape to cancel.' }, source: { language: 'tsx', code: `import { Button, Select } from '@jfrader/ui';

<>
  <Select defaultValue="apple">
    <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
    <Select.Content>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Item value="banana" disabled>Banana</Select.Item>
      <Select.Item value="cherry">Cherry</Select.Item>
    </Select.Content>
  </Select>
  <Button>After</Button>
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
  name: 'Find by typing',
  parameters: { docs: { description: { story: 'Type a fruit prefix on the closed field to open the list without selecting a value.' }, source: { language: 'tsx', code: `import { Select } from '@jfrader/ui';

<Select>
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
  name: 'Dismiss outside the list',
  parameters: { docs: { description: { story: 'Open the list, then press After to close it without changing the selection.' }, source: { language: 'tsx', code: `import { Button, Select } from '@jfrader/ui';

<>
  <Select defaultValue="apple">
    <Select.Trigger aria-label="Fruit"><Select.Value placeholder="Pick a fruit" /></Select.Trigger>
    <Select.Content>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Item value="banana" disabled>Banana</Select.Item>
      <Select.Item value="cherry">Cherry</Select.Item>
    </Select.Content>
  </Select>
  <Button>After</Button>
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
  name: 'Disabled field',
  parameters: { docs: { description: { story: 'Keep the selected fruit visible while preventing interaction with the field.' }, source: { language: 'tsx', code: `import { Select } from '@jfrader/ui';

<Select disabled defaultValue="apple">
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
