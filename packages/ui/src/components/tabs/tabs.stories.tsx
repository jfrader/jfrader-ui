import { Suspense, startTransition, useState, type ComponentPropsWithRef, type ComponentProps, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Tabs, type TabsCompoundProps, type TabsEasyProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { Card } from '../card';
import { expectAligned, expectInside } from '../../testing/geometry-assertions';

const tabsSource = `import { Tabs } from '@jfrader/ui';

const sections = [
  { value: 'one', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'two', label: 'Security', panel: 'Password and two-factor sign-in.' },
  { value: 'three', label: 'Billing', panel: 'Plan, invoices and payment method.' },
];`;

const ITEMS = [
  { value: 'one', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'two', label: 'Security', panel: 'Password and two-factor sign-in.' },
  { value: 'three', label: 'Billing', panel: 'Plan, invoices and payment method.' },
] as const;

const Frame = styled.div({
  inlineSize: `min(360px, calc(100vw - ${vars.space[8]}))`,
  maxInlineSize: '100%',
  minBlockSize: '120px',
  fontSize: vars.textSize.sm,
});

const meta = {
  title: 'Navigation/Tabs',
  component: Tabs,
  parameters: {
    docs: {
      description: { component: 'Switch between panels by choosing a tab.' },
      sections: [
        { title: 'Basic', stories: ['Compound'] },
        { title: 'Variants', stories: ['Glass', 'Liquid', 'Vertical'] },
        { title: 'Icons and labels', stories: ['IconLabels', 'LineIcons'] },
        { title: 'Controlled selection', stories: ['Controlled'] },
        { title: 'States', stories: ['DisabledTab', 'ManualActivation'] },
        { title: 'Overflow', stories: ['Overflow', 'LineOverflow', 'LongPanel'] },
        { title: 'Composition', stories: ['PanelComposition'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
      ],
      usage: `### When to use
Use tabs for related views within the same page. Use links for navigation to another page, or an accordion when readers need to compare several sections at once.

### Content constraints
Start with a matching selection so a panel is visible. Hidden panels stay mounted and preserve their child state. Use manual activation when panel content takes time to load so moving focus does not start each load.

### Keyboard
- Use Left and Right horizontally, or Up and Down vertically, to move between enabled tabs with wrapping. Horizontal keys reverse in RTL. Home and End reach the ends.
- Automatic activation selects the focused tab; manual activation waits for Enter or Space.
- The focused tab is the list's Tab stop even when it is not selected. Press Tab to leave the list for the active panel.

### Accessibility and layout
Name the tab list and keep a text name for each tab, including icon-only tabs. Translate badge descriptions as well as labels. Reduced transparency and forced colors use an opaque material fallback.

Use line tabs for vertical layouts. Horizontal overflow preserves target sizes. If your app positions a floating list, reserve its height and the device safe-area inset in the content below it.`,
    },
  },
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    activation: { control: 'radio', options: ['auto', 'manual'] },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<(props: TabsCompoundProps) => ReactNode>;
type EasyStory = StoryObj<(props: TabsEasyProps) => ReactNode>;
// @ts-expect-error Generated-part slot keys are closed.
type UnknownSlot = NonNullable<TabsEasyProps['slotProps']>['unknown'];
// @ts-expect-error Replacement slot keys are closed.
type UnknownReplacement = NonNullable<TabsEasyProps['slots']>['unknown'];

function TabsRootAdapter(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="custom-tabs-root" />;
}
function TabsTabAdapter(props: ComponentProps<typeof Tabs.Tab>) {
  return <Tabs.Tab {...props} className={[props.className, 'custom-tab'].filter(Boolean).join(' ')} />;
}
function UnusedTabsRoot() { return null; }

/** Restyle every generated tab and pass props to the root and panels. */
// This story tests the documented css/slot API and native style merging.
export const SlotProps: EasyStory = {
  args: {
    label: 'Settings', items: ITEMS, defaultValue: 'one',
    component: UnusedTabsRoot,
    slots: { root: TabsRootAdapter, tab: TabsTabAdapter },
    className: 'consumer-tabs', style: { paddingBlock: vars.space[1] },
    slotProps: {
      root: { className: 'custom-tabs', 'data-ui': 'tabs-root custom', style: { paddingInline: vars.space[2] }, sx: { borderRadius: vars.radius.md } },
      list: { className: 'custom-list' },
      tab: { sx: { fontStyle: 'italic' } },
      panel: { className: 'custom-panel' },
    },
  },
  render: (args) => <Tabs {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('tablist', { name: 'Settings' });
    await expect(canvas.getByTestId('custom-tabs-root')).toHaveAttribute('data-ui', 'tabs-root custom');
    await expect(list).toHaveClass('custom-list');
    await expect(list.parentElement).toHaveClass('consumer-tabs', 'custom-tabs');
    await expect(list.parentElement?.style.paddingBlock).toBe(vars.space[1]);
    await expect(list.parentElement?.style.paddingInline).toBe(vars.space[2]);
    const tab = canvas.getByRole('tab', { name: 'Billing' });
    await expect(tab).toHaveClass('custom-tab');
    await expect(tab).toHaveStyle({ fontStyle: 'italic' });
    await userEvent.click(tab);
    await expect(canvas.getByRole('tabpanel', { name: 'Billing' })).toHaveClass('custom-panel');
  },
};

export const Default: EasyStory = {
  name: 'Easy mode',
  args: {
    label: 'Settings',
    items: ITEMS.map((item) => ({ ...item, disabled: item.value === 'two' })),
    defaultValue: 'one',
    onValueChange: fn(),
    slotProps: { list: { className: 'easy-tabs-list' } },
  },
  parameters: { docs: { source: { language: 'tsx', code: `const sections = [
  { value: 'one', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'two', label: 'Security', panel: 'Password and two-factor sign-in.', disabled: true },
  { value: 'three', label: 'Billing', panel: 'Plan, invoices and payment method.' },
];

<Tabs label="Settings" items={sections} defaultValue="one" />` } } },
  render: (args) => <Tabs {...args} />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await expect(canvas.getByRole('tablist', { name: 'Settings' })).toHaveClass('easy-tabs-list');
    await expectSelected(canvasElement, 0);
    await expect(canvas.getByRole('tab', { name: 'Security' })).toBeDisabled();
    await userEvent.tab();
    await expect(canvas.getByRole('tab', { name: 'Account' })).toHaveFocus();
    await expect(getComputedStyle(canvasElement.ownerDocument.activeElement!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Billing' })).toHaveFocus();
    await expectSelected(canvasElement, 2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('three');
    await userEvent.keyboard('{Home}{End}{ArrowRight}');
    await expectSelected(canvasElement, 0);
    await userEvent.tab();
    await expect(canvas.getByRole('tabpanel')).toHaveFocus();
  },
};

export const EasyModeManual: EasyStory = {
  ...Default,
  name: 'Easy mode manual',
  args: { ...Default.args, activation: 'manual' },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Billing' })).toHaveFocus();
    await expectSelected(canvasElement, 0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');
    await expectSelected(canvasElement, 2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const EasyModeLight: EasyStory = { ...Default, name: 'Easy mode light', decorators: [withLightTheme], globals: { theme: 'light' } };

export const EasyModeRejectedSelection: EasyStory = {
  ...Default,
  name: 'Easy mode rejected selection',
  args: { ...Default.args, value: 'one' },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Billing' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('three');
    await expectSelected(canvasElement, 0);
  },
};

function easyModeTypeContracts() {
  // @ts-expect-error Collection mode rejects compound children.
  <Tabs label="Settings" items={ITEMS}>Compound</Tabs>;
  // @ts-expect-error Collection mode requires a tablist label.
  <Tabs items={ITEMS} />;
  // @ts-expect-error Every section pairs a tab with its panel.
  <Tabs label="Settings" items={[{ value: 'one', label: 'Account' }]} />;
}
void easyModeTypeContracts;

const suspendedTabRender = fn();
const pendingTab = new Promise<never>(() => {});

function PendingTab({ value }: { value: string }) {
  if (value === 'two') {
    suspendedTabRender();
    throw pendingTab;
  }
  return null;
}

function SuspendedControlledTabs(props: TabsCompoundProps) {
  const [value, setValue] = useState('one');
  return <>
    <button onClick={() => startTransition(() => setValue('two'))}>Load security</button>
    <Suspense fallback={<p>Loading</p>}>
      <Tabs {...props} value={value} activation="manual">
        <Tabs.List aria-label="Pending settings">
          <Tabs.Tab value="one">Account</Tabs.Tab>
          <Tabs.Tab value="two">Security</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Account settings</Tabs.Panel>
        <Tabs.Panel value="two">Security settings</Tabs.Panel>
        <PendingTab value={value} />
      </Tabs>
    </Suspense>
  </>;
}

export const SuspendedControlledRequest: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn() },
  render: (args) => <SuspendedControlledTabs {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    suspendedTabRender.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Load security' }));
    await waitFor(() => expect(suspendedTabRender).toHaveBeenCalled());
    await expect(canvas.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(canvas.getByRole('tab', { name: 'Security' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('two');
    await expect(canvas.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
  },
};

function TabsExample({ disabledValue, ...props }: TabsCompoundProps & { disabledValue?: string }) {
  return (
    <Tabs {...props}>
      <Tabs.List aria-label="Settings">
        {ITEMS.map((item) => (
          <Tabs.Tab key={item.value} value={item.value} disabled={item.value === disabledValue}>
            {item.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {ITEMS.map((item) => (
        <Tabs.Panel key={item.value} value={item.value}>
          {item.panel}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
TabsExample.displayName = 'TabsExample';

function ControlledTabs(props: TabsCompoundProps) {
  const [value, setValue] = useState('one');
  return (
    <TabsExample
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
    />
  );
}
ControlledTabs.displayName = 'ControlledTabs';

function RemovableTabs() {
  const [items, setItems] = useState<readonly (typeof ITEMS)[number][]>(ITEMS);
  return (
    <>
      <Tabs defaultValue="two" activation="manual">
        <Tabs.List aria-label="Settings">
          {items.map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {items.map((item) => (
          <Tabs.Panel key={item.value} value={item.value}>
            {item.panel}
          </Tabs.Panel>
        ))}
      </Tabs>
      <button type="button" onClick={() => setItems((prev) => prev.filter((item) => item.value !== 'three'))}>
        Remove billing
      </button>
    </>
  );
}
RemovableTabs.displayName = 'RemovableTabs';

/** Selection and ARIA relationships for the selected panel (roving tabindex is asserted separately). */
async function expectSelected(canvasElement: HTMLElement, selectedIndex: number) {
  const canvas = within(canvasElement);
  const tabs = canvas.getAllByRole('tab');
  tabs.forEach((tab, index) => {
    expect(tab).toHaveAttribute('aria-selected', String(index === selectedIndex));
  });
  const panel = canvas.getByRole('tabpanel');
  await expect(panel).toHaveAttribute('aria-labelledby', tabs[selectedIndex]!.id);
  await expect(tabs[selectedIndex]).toHaveAttribute('aria-controls', panel.id);
  await expect(panel).toHaveTextContent(ITEMS[selectedIndex]!.panel);
}

export const Compound: Story = {
  name: 'Settings panels',
  parameters: { docs: { description: { story: 'Switch between Account, Security and Billing without leaving the page.' }, source: { language: 'tsx', code: `import { Tabs } from '@jfrader/ui';

<Tabs defaultValue="one">
  <Tabs.List aria-label="Settings">
    <Tabs.Tab value="one">Account</Tabs.Tab>
    <Tabs.Tab value="two">Security</Tabs.Tab>
    <Tabs.Tab value="three">Billing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="one">Name, email and avatar.</Tabs.Panel>
  <Tabs.Panel value="two">Password and two-factor sign-in.</Tabs.Panel>
  <Tabs.Panel value="three">Plan, invoices and payment method.</Tabs.Panel>
</Tabs>` } } },
  args: { defaultValue: 'one' },
  render: (args) => <TabsExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tablist = canvas.getByRole('tablist', { name: 'Settings' });
    await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(canvas.getAllByRole('tab')).toHaveLength(ITEMS.length);
    await expectSelected(canvasElement, 0);
    await userEvent.click(canvas.getByRole('tab', { name: 'Billing' }));
    await expect(canvas.getByRole('tab', { name: 'Billing' })).toHaveFocus();
    await expectSelected(canvasElement, 2);
  },
};

export const Controlled: Story = {
  name: 'Parent-owned selection',
  parameters: { docs: { description: { story: 'Keep the selected settings panel in application state.' }, source: { language: 'tsx', code: `import { useState } from 'react';
${tabsSource}

function SettingsTabs() {
  const [value, setValue] = useState('one');
  return <Tabs label="Settings" items={sections} value={value} onValueChange={setValue} />;
}` } } },
  args: { onValueChange: fn() },
  render: (args) => <ControlledTabs {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expectSelected(canvasElement, 0);
    const second = canvas.getByRole('tab', { name: 'Security' });
    await userEvent.click(second);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('two');
    await expect(second).toHaveFocus();
    await expectSelected(canvasElement, 1);
  },
};

export const ManualActivation: Story = {
  name: 'Select after moving focus',
  parameters: { docs: { description: { story: 'Move focus with arrows, then press Enter or Space to show the focused panel.' }, source: { language: 'tsx', code: `${tabsSource}

<Tabs label="Settings" items={sections} defaultValue="one" activation="manual" />` } } },
  args: { defaultValue: 'one', activation: 'manual', onValueChange: fn() },
  render: (args) => <TabsExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await userEvent.tab();
    await expect(tabs[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[1]).toHaveFocus();
    await expectSelected(canvasElement, 0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Roving tabindex follows focus, not selection: the focused tab is the tab stop.
    expect(tabs[1]!.tabIndex).toBe(0);
    expect(tabs[0]!.tabIndex).toBe(-1);
    // Backward exit in manual mode: Tab leaves the tablist into the ACTIVE panel.
    await userEvent.tab();
    await expect(canvas.getByRole('tabpanel')).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(tabs[1]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(tabs[1]).toHaveFocus();
    await expectSelected(canvasElement, 1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('two');
  },
};

export const RejectedControlled: Story = {
  args: { onValueChange: fn() },
  render: (args) => <TabsExample {...args} value="one" />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const billing = canvas.getByRole('tab', { name: 'Billing' });
    // The parent never honors the request: selection stays on "one" and each activation
    // issues exactly ONE request, never two.
    await userEvent.click(billing);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expectSelected(canvasElement, 0);
    // A repeat click on the already-focused tab issues one more request.
    await userEvent.click(billing);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    // And Enter on the focused tab retries once more, still one request per activation.
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('three');
  },
};

export const RejectedKeyboardRetry: Story = {
  args: { onValueChange: fn() },
  render: (args) => <TabsExample {...args} value="one" />,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    const security = canvas.getByRole('tab', { name: 'Security' });
    await expect(security).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await userEvent.click(canvas.getByRole('tab', { name: 'Billing' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await expect(canvas.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
  },
};

export const Vertical: Story = {
  name: 'Vertical tab list',
  parameters: { docs: { description: { story: 'Arrange settings vertically and move between tabs with Up and Down.' }, source: { language: 'tsx', code: `${tabsSource}

<Tabs label="Settings" items={sections} defaultValue="one" orientation="vertical" />` } } },
  args: { defaultValue: 'one', orientation: 'vertical' },
  render: (args) => <TabsExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await expect(canvas.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    await userEvent.tab();
    await expect(tabs[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(tabs[1]).toHaveFocus();
    await expectSelected(canvasElement, 1);
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[1]).toHaveFocus();
    await expectSelected(canvasElement, 1);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await expect(tabs[2]).toHaveFocus();
    await expectSelected(canvasElement, 2);
  },
};

export const DisabledTab: Story = {
  name: 'Unavailable settings panel',
  parameters: { docs: { description: { story: 'Skip the disabled Security tab when moving between settings.' }, source: { language: 'tsx', code: `${tabsSource}

<Tabs label="Settings" defaultValue="one" items={sections.map((section) => ({
  ...section, disabled: section.value === 'two',
}))} />` } } },
  args: { defaultValue: 'one' },
  render: (args) => <TabsExample {...args} disabledValue="two" />,
  play: async ({ canvasElement }) => {
    const tabs = within(canvasElement).getAllByRole('tab');
    await expect(tabs[1]).toBeDisabled();
    await expect(tabs[1]!.tabIndex).toBe(-1);
    await userEvent.tab();
    await expect(tabs[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[2]).toHaveFocus();
    await expectSelected(canvasElement, 2);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(tabs[0]).toHaveFocus();
    await expectSelected(canvasElement, 0);
  },
};

export const DisabledSelectedFallback: Story = {
  args: { defaultValue: 'two' },
  render: (args) => <TabsExample {...args} disabledValue="two" />,
  play: async ({ canvasElement }) => {
    // The selected tab is disabled: selection survives, and the roving tab stop falls
    // back to the first enabled tab so the tablist stays keyboard reachable.
    const tabs = within(canvasElement).getAllByRole('tab');
    await expect(tabs[1]).toBeDisabled();
    await userEvent.tab();
    await expect(tabs[0]).toHaveFocus();
    expect(tabs[0]!.tabIndex).toBe(0);
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[2]).toHaveFocus();
  },
};

export const RemovedFocusedFallback: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Tabs defaultValue="two" activation="manual">
  <Tabs.List aria-label="Settings">
    {items.map((item) => <Tabs.Tab key={item.value} value={item.value}>{item.label}</Tabs.Tab>)}
  </Tabs.List>
  {items.map((item) => <Tabs.Panel key={item.value} value={item.value}>{item.panel}</Tabs.Panel>)}
</Tabs>`,
      },
    },
  },
  render: () => <RemovableTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    // The selected tab ("Security") is the initial tab stop; move focus to "Billing"
    // without selecting it (manual activation).
    await expect(canvas.getByRole('tab', { name: 'Security' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Billing' })).toHaveFocus();
    // Manual mode: "Billing" is focused but NOT selected ("Security" is).
    await userEvent.click(canvas.getByRole('button', { name: 'Remove billing' }));
    await expect(canvas.getAllByRole('tab')).toHaveLength(2);
    // Fallback priority: the SELECTED tab becomes the tab stop, not the first tab.
    const security = canvas.getByRole('tab', { name: 'Security' });
    await waitFor(() => expect(security.tabIndex).toBe(0));
  },
};

export const Keyboard: Story = {
  name: 'Navigate tabs by keyboard',
  parameters: { docs: { description: { story: 'Use arrows, Home and End to select tabs, then Tab into the active panel.' }, source: { language: 'tsx', code: `${tabsSource}

<Tabs label="Settings" items={sections} defaultValue="one" />` } } },
  args: { defaultValue: 'one' },
  render: (args) => <TabsExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await userEvent.tab();
    await expect(tabs[0]).toHaveFocus();
    await expect(getComputedStyle(tabs[0]!).outlineWidth).not.toBe('0px');
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[1]).toHaveFocus();
    await expectSelected(canvasElement, 1);
    await userEvent.keyboard('{End}');
    await expect(tabs[2]).toHaveFocus();
    await expectSelected(canvasElement, 2);
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[0]).toHaveFocus();
    await expectSelected(canvasElement, 0);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(tabs[2]).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(tabs[0]).toHaveFocus();
    await expectSelected(canvasElement, 0);
    await userEvent.tab();
    await expect(canvas.getByRole('tabpanel')).toHaveFocus();
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultValue: 'two' },
  render: (args) => <TabsExample {...args} />,
  play: async ({ canvasElement }) => {
    await expectSelected(canvasElement, 1);
  },
};

export const RTL: Story = {
  args: { defaultValue: 'one', dir: 'rtl' },
  render: (args) => <TabsExample {...args} />,
  play: async ({ canvas, userEvent }) => {
    const tabs = canvas.getAllByRole('tab');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(tabs[1]).toHaveFocus();
    await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[0]).toHaveFocus();
    await expect(getComputedStyle(tabs[0]!).direction).toBe('rtl');
  },
};

/** Use a rounded glass bar for short, in-page section labels. */
export const IconLabels: EasyStory = {
  name: 'Icons with active labels',
  args: {
    label: 'Library', variant: 'glass', labels: 'active', defaultValue: 'home',
    items: [
      { value: 'home', label: 'Home', panel: 'Recent activity', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m3 10 9-7 9 7v11H3Z" /></svg> },
      { value: 'saved', label: 'Saved', panel: 'Your saved items', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3h12v18l-6-4-6 4Z" /></svg> },
    ],
  },
  render: (args) => <Tabs {...args} />,
  parameters: { docs: {
    description: { story: 'Show the active label beside its icon while keeping every tab named.' },
    source: { language: 'tsx', code: `import { Tabs } from '@jfrader/ui';

<Tabs label="Library" variant="glass" labels="active" defaultValue="home" items={[
  { value: 'home', label: 'Home', panel: 'Recent activity', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m3 10 9-7 9 7v11H3Z" /></svg> },
  { value: 'saved', label: 'Saved', panel: 'Your saved items', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3h12v18l-6-4-6 4Z" /></svg> },
]} />` },
  } },
};

export const Overflow: EasyStory = {
  name: 'Scrollable tab labels',
  args: {
    label: 'Project settings', defaultValue: 'general', variant: 'glass', sx: { inlineSize: '16rem', maxInlineSize: '100%' },
    items: [
      { value: 'general', label: 'General settings', panel: 'Project name and visibility.' },
      { value: 'members', label: 'Team members', panel: 'Members and permissions.' },
      { value: 'notifications', label: 'Notification preferences', panel: 'Email and activity notifications.' },
    ],
  },
  render: (args) => <Tabs {...args} />,
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('tablist')).touchAction).toBe('auto');
  },
  parameters: { docs: {
    description: { story: 'Scroll a narrow bar to reach long labels without shrinking tab targets.' },
    source: { language: 'tsx', code: `import { Tabs } from '@jfrader/ui';

<Tabs label="Project settings" defaultValue="general" variant="glass"
  sx={{ inlineSize: '16rem', maxInlineSize: '100%' }} items={[
    { value: 'general', label: 'General settings', panel: 'Project name and visibility.' },
    { value: 'members', label: 'Team members', panel: 'Members and permissions.' },
    { value: 'notifications', label: 'Notification preferences', panel: 'Email and activity notifications.' },
  ]} />` },
  } },
};

export const PanelComposition: Story = {
  name: 'Cards inside tab panels',
  render: () => (
    <Tabs defaultValue="account">
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="account">Account</Tabs.Tab>
        <Tabs.Tab value="billing">Billing</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="account"><Card title="Account" content="Name, email and avatar." /></Tabs.Panel>
      <Tabs.Panel value="billing"><Card title="Billing" content="Plan, invoices and payment method." /></Tabs.Panel>
    </Tabs>
  ),
  parameters: { docs: {
    description: { story: 'Compose each settings view from a card inside its matching panel.' },
    source: { language: 'tsx', code: `import { Card, Tabs } from '@jfrader/ui';

<Tabs defaultValue="account">
  <Tabs.List aria-label="Settings">
    <Tabs.Tab value="account">Account</Tabs.Tab>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="account"><Card title="Account" content="Name, email and avatar." /></Tabs.Panel>
  <Tabs.Panel value="billing"><Card title="Billing" content="Plan, invoices and payment method." /></Tabs.Panel>
</Tabs>` },
  } },
};

export const Glass: EasyStory = {
  name: 'Glass tab bar',
  args: { label: 'Settings', items: ITEMS, defaultValue: 'one', variant: 'glass' },
  render: (args) => <Tabs {...args} />,
  parameters: { docs: { description: { story: 'Show settings in a rounded glass bar with a pill indicator.' }, source: { language: 'tsx', code: `${tabsSource}

<Tabs variant="glass" label="Settings" defaultValue="one" items={sections} />` } } },
};

/** Move a shared lens between tabs while keeping panels mounted. */
export const Liquid: EasyStory = {
  ...Glass,
  name: 'Liquid tab bar',
  args: { ...Glass.args, variant: 'liquid' },
  parameters: { docs: { description: { story: 'Move a lens indicator between settings in a rounded liquid bar.' }, source: { language: 'tsx', code: `${tabsSource}

<Tabs variant="liquid" label="Settings" defaultValue="one" items={sections} />` } } },
};

export const LineOverflow: EasyStory = {
  ...Overflow,
  name: 'Scrollable line tabs',
  parameters: { docs: {
    description: { story: 'Scroll line tabs in a narrow container and keep keyboard focus visible.' },
    source: { language: 'tsx', code: `${tabsSource}

<Tabs label="Project settings" items={sections} defaultValue="one"
  sx={{ inlineSize: '16rem', maxInlineSize: '100%' }} />` },
  } },
  args: { ...Overflow.args, variant: 'line' },
  play: async ({ canvas, userEvent }) => {
    const list = canvas.getByRole('tablist');
    const root = list.parentElement!;
    await expectInside(list, root);
    for (const tab of canvas.getAllByRole('tab')) {
      await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
    canvas.getAllByRole('tab')[0]!.focus();
    await userEvent.keyboard('{End}');
    const last = canvas.getAllByRole('tab').at(-1)!;
    await expect(last).toHaveFocus();
    await expectInside(last, list);
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
  },
};

export const LineIcons: EasyStory = {
  ...IconLabels,
  name: 'Line tabs with icons',
  args: { ...IconLabels.args, variant: 'line', labels: 'always' },
  parameters: { docs: { description: { story: 'Align icons beside each label in a line tab list.' } } },
  play: async ({ canvasElement }) => {
    const icons = canvasElement.querySelectorAll<HTMLElement>('[data-ui="tabs-icon"]');
    await expect(icons).toHaveLength(2);
    for (const icon of icons) {
      await expectAligned([icon, icon.parentElement!], 'center-y');
    }
  },
};

export const LongPanel: EasyStory = {
  args: {
    label: 'References', defaultValue: 'reference', orientation: 'vertical',
    items: [
      { value: 'reference', label: 'Reference', panel: 'SubscriptionRenewalAndBillingPreferences'.repeat(8) },
      { value: 'history', label: 'History', panel: 'Previous billing periods.' },
    ],
  },
  render: (args) => <Tabs {...args} />,
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('tabpanel');
    const root = panel.parentElement!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
  },
};
