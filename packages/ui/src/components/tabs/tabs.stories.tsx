import { Suspense, startTransition, useState, type ComponentPropsWithRef, type ComponentProps, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Tabs, type TabsCompoundProps, type TabsEasyProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const ITEMS = [
  { value: 'one', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'two', label: 'Security', panel: 'Password and two-factor sign-in.' },
  { value: 'three', label: 'Billing', panel: 'Plan, invoices and payment method.' },
] as const;

const Frame = styled.div({
  inlineSize: '360px',
  minBlockSize: '120px',
  fontSize: vars.textSize.sm,
});

const meta = {
  title: 'Navigation/Tabs',
  component: Tabs,
  parameters: {
    docs: {
      description: { component: 'Switch between panels by choosing a tab.' },
      usage: `### Values
- Pass \`label\` and \`items\` to pair tabs with panels. Each item needs a unique \`value\`, \`label\`, \`panel\` and optional \`disabled\`. For custom anatomy, use \`children\` with \`Tabs.List\`, \`Tabs.Tab\` and \`Tabs.Panel\` instead, matching tab and panel values and naming the list.
- Use \`defaultValue\` to select a panel initially. Without a matching value, all panels start hidden. Pair \`value\` with \`onValueChange\` to control selection; update \`value\` to accept a request.
- Hidden panels stay mounted, so their child state persists when you switch tabs.

### Keyboard
- \`orientation\` defaults to \`horizontal\`. Use Left and Right horizontally, or Up and Down vertically, to move between enabled tabs with wrapping. Horizontal keys reverse in RTL. Home and End reach the ends.
- \`activation\` defaults to \`auto\`, so focusing a tab requests selection. If your panel needs time to load, use \`activation="manual"\` and press Enter or Space to select the focused tab.
- The focused tab is the list's Tab stop even when it is not selected. Press Tab to leave the list for the active panel; panels default to \`tabIndex={0}\`.

### Customization
- Glass and liquid share the same bar material; their default indicators differ (pill for glass, lens for liquid).
- Use \`variant="glass"\` or \`variant="liquid"\` for a rounded mobile bar with 48px targets and a solid selected boundary. \`indicator\` accepts \`line\`, \`pill\` or \`lens\`; material names do not change tab semantics. Materials use an opaque fallback for reduced transparency and forced colors.
- Add decorative \`icon\` / \`activeIcon\` and \`badge\` / \`badgeLabel\` per item. Numeric badges use \`locale\`; zero and empty badges are omitted. Supply translated badge descriptions with \`badgeLabel\`.
- \`labels="active"\`, \`labels="none"\` and \`compact\` hide visual labels only when an icon is present. Names remain available to assistive technology. Pair controlled \`compact\` with \`onCompactChange\`; focus requests expansion. Optional \`collapseOnScroll\` uses the owning window or \`scrollRef\` and pauses while the bar contains focus.
- \`draggableIndicator\` enables release-only nearest-tab selection on material bars. Pointer cancellation and Escape discard the preview. Click and keyboard work without dragging. There is no momentum or refraction effect.
- Position a floating list in application code and reserve its height plus the device safe-area inset in your content. Horizontal overflow preserves target sizes; use standard line tabs for vertical layouts.
- In \`items\` mode, use \`slotProps\` for root, list, tab and panel props. Use \`slots\` to replace generated parts; \`slots.root\` takes precedence over \`component\`.
- Declare replacements outside render. Forward received props and ref to the root element, or to the corresponding \`Tabs\` part for list, tab and panel adapters, to keep keyboard handling and ARIA relationships.`,
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
  name: 'Compound',
  parameters: { docs: { source: { language: 'tsx', code: `import { Tabs } from '@jfrader/ui';

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
export const Glass: EasyStory = {
  args: { label: 'Settings', items: ITEMS, defaultValue: 'one', variant: 'glass' },
  render: (args) => <Tabs {...args} />,
  parameters: { docs: { source: { language: 'tsx', code: `<Tabs variant="glass" label="Settings" defaultValue="account" items={[
  { value: 'account', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'security', label: 'Security', panel: 'Password and two-factor sign-in.' },
  { value: 'billing', label: 'Billing', panel: 'Plan and invoices.' },
]} />` } } },
};

/** Move a shared lens between tabs while keeping panels mounted. */
export const Liquid: EasyStory = {
  ...Glass,
  args: { ...Glass.args, variant: 'liquid' },
  parameters: { docs: { source: { language: 'tsx', code: `<Tabs variant="liquid" label="Settings" defaultValue="account" items={[
  { value: 'account', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'security', label: 'Security', panel: 'Password and two-factor sign-in.' },
  { value: 'billing', label: 'Billing', panel: 'Plan, invoices and payment method.' },
]} />` } } },
};
