import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Tabs, type TabsProps } from './index';

const ITEMS = [
  { value: 'one', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'two', label: 'Security', panel: 'Password and two-factor sign-in.' },
  { value: 'three', label: 'Billing', panel: 'Plan, invoices and payment method.' },
] as const;

const frameStyle = css({
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
    },
  },
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    activation: { control: 'radio', options: ['auto', 'manual'] },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

function TabsExample({ disabledValue, ...props }: TabsProps & { disabledValue?: string }) {
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

function ControlledTabs(props: TabsProps) {
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

export const Default: Story = {
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
