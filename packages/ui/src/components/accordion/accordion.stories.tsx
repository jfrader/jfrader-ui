import { useState, type ReactNode } from 'react';
import type { Meta, StoryContext, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Accordion, type AccordionProps } from './index';

const ITEMS = [
  { value: 'one', label: 'Account', panel: 'Name, email and avatar.' },
  { value: 'two', label: 'Security', panel: 'Password and two-factor sign-in.' },
  { value: 'three', label: 'Billing', panel: 'Plan, invoices and payment method.' },
] as const;

type ItemLabel = (typeof ITEMS)[number]['label'];

const REJECTED_VALUE = 'three';

const frameStyle = css({
  inlineSize: '360px',
  fontSize: vars.textSize.sm,
});

const meta = {
  title: 'Components/Accordion',
  component: Accordion,
  argTypes: {
    type: { control: 'radio', options: ['single', 'multiple'] },
    collapsible: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = Omit<StoryObj<AccordionProps>, 'render' | 'play'> & {
  render?: (args: AccordionProps) => ReactNode;
  play?: (context: StoryContext<AccordionProps>) => Promise<void>;
};

type CheckedAccordionArgs<Args extends NonNullable<Story['args']>> = Args;

export type AccordionTypeRegression = {
  // @ts-expect-error An array value in single mode is a type error.
  singleArrayValue: CheckedAccordionArgs<{ type: 'single'; value: string[] }>;
  // @ts-expect-error An array callback in single mode is a type error.
  singleArrayCallback: CheckedAccordionArgs<{ type: 'single'; onValueChange: (value: string[]) => void }>;
  // @ts-expect-error A string value in multiple mode is a type error.
  multipleStringValue: CheckedAccordionArgs<{ type: 'multiple'; value: string }>;
  // @ts-expect-error A string callback in multiple mode is a type error.
  multipleStringCallback: CheckedAccordionArgs<{ type: 'multiple'; onValueChange: (value: string) => void }>;
  narrowing: typeof narrowAccordionProps;
};

function narrowAccordionProps(props: AccordionProps) {
  if (props.type === 'multiple') {
    const value: string[] | undefined = props.value;
    const onValueChange: ((value: string[]) => void) | undefined = props.onValueChange;
    return { value, onValueChange };
  }
  const value: string | undefined = props.value;
  const onValueChange: ((value: string) => void) | undefined = props.onValueChange;
  return { value, onValueChange };
}

function AccordionExample({
  count = ITEMS.length,
  disabledValue,
  disabledTriggerValue,
  ...props
}: AccordionProps & { count?: number; disabledValue?: string; disabledTriggerValue?: string }) {
  return (
    <Accordion {...props}>
      {ITEMS.slice(0, count).map((item) => (
        <Accordion.Item key={item.value} value={item.value} disabled={item.value === disabledValue}>
          <Accordion.Trigger disabled={item.value === disabledTriggerValue}>{item.label}</Accordion.Trigger>
          <Accordion.Panel>{item.panel}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

/** Accepts every request except opening Billing, which the parent rejects. */
function ControlledAccordion(props: AccordionProps) {
  const [singleValue, setSingleValue] = useState('one');
  const [multipleValue, setMultipleValue] = useState(['one']);
  if (props.type === 'multiple') {
    const { onValueChange, ...rest } = props;
    return (
      <AccordionExample
        {...rest}
        value={multipleValue}
        onValueChange={(next: string[]) => {
          onValueChange?.(next);
          if (!next.includes(REJECTED_VALUE)) setMultipleValue(next);
        }}
      />
    );
  }
  const { onValueChange, ...rest } = props;
  return (
    <AccordionExample
      {...rest}
      value={singleValue}
      onValueChange={(next: string) => {
        onValueChange?.(next);
        if (next !== REJECTED_VALUE) setSingleValue(next);
      }}
    />
  );
}

/** Expansion state and ARIA relationships for every rendered item. */
async function expectExpanded(canvasElement: HTMLElement, openLabels: readonly ItemLabel[]) {
  const canvas = within(canvasElement);
  for (const item of ITEMS) {
    const trigger = canvas.queryByRole('button', { name: item.label });
    if (!trigger) continue;
    const isOpen = openLabels.includes(item.label);
    const panel = canvasElement.ownerDocument.getElementById(trigger.getAttribute('aria-controls') ?? '');
    await expect(trigger).toHaveAttribute('aria-expanded', String(isOpen));
    await expect(panel).toHaveAttribute('role', 'region');
    await expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
    if (isOpen) await expect(panel).toBeVisible();
    else await expect(panel).not.toBeVisible();
  }
  await expect(canvas.queryAllByRole('region')).toHaveLength(openLabels.length);
}

export const Default: Story = {
  args: { defaultValue: 'one' },
  render: (args) => <AccordionExample {...args} count={2} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    await expect(canvas.getByRole('region', { name: 'Account' })).toHaveTextContent(ITEMS[0].panel);
    await expectExpanded(canvasElement, ['Account']);
    await userEvent.click(canvas.getByRole('button', { name: 'Security' }));
    await expect(canvas.getByRole('button', { name: 'Security' })).toHaveFocus();
    await expectExpanded(canvasElement, ['Security']);
    await userEvent.click(canvas.getByRole('button', { name: 'Security' }));
    await expectExpanded(canvasElement, []);
  },
};

export const Multiple: Story = {
  args: { type: 'multiple', defaultValue: ['one'], onValueChange: fn() },
  render: (args) => <AccordionExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expectExpanded(canvasElement, ['Account']);
    await userEvent.click(canvas.getByRole('button', { name: 'Security' }));
    await expectExpanded(canvasElement, ['Account', 'Security']);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['one', 'two']);
    await userEvent.click(canvas.getByRole('button', { name: 'Account' }));
    await expectExpanded(canvasElement, ['Security']);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['two']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};

export const Controlled: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ControlledAccordion {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const security = canvas.getByRole('button', { name: 'Security' });
    await expectExpanded(canvasElement, ['Account']);
    await userEvent.click(security);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('two');
    await expectExpanded(canvasElement, ['Security']);
    // The parent rejects Billing: one request, nothing commits visually.
    await userEvent.click(canvas.getByRole('button', { name: 'Billing' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('three');
    await expectExpanded(canvasElement, ['Security']);
    // Collapsing the open item in single mode requests the empty value.
    await userEvent.click(security);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
    await expectExpanded(canvasElement, []);
  },
};

export const ControlledMultiple: Story = {
  args: { type: 'multiple', onValueChange: fn() },
  render: (args) => <ControlledAccordion {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const account = canvas.getByRole('button', { name: 'Account' });
    const security = canvas.getByRole('button', { name: 'Security' });
    await expectExpanded(canvasElement, ['Account']);
    await userEvent.click(security);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, ['one', 'two']);
    await expectExpanded(canvasElement, ['Account', 'Security']);
    await userEvent.click(canvas.getByRole('button', { name: 'Billing' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, ['one', 'two', 'three']);
    await expectExpanded(canvasElement, ['Account', 'Security']);
    await userEvent.click(account);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, ['two']);
    await expectExpanded(canvasElement, ['Security']);
    await userEvent.click(security);
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(4, []);
    await expectExpanded(canvasElement, []);
  },
};

export const NotCollapsible: Story = {
  args: { defaultValue: 'one', collapsible: false, onValueChange: fn() },
  render: (args) => <AccordionExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const account = canvas.getByRole('button', { name: 'Account' });
    const security = canvas.getByRole('button', { name: 'Security' });
    await expect(account).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(account);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expectExpanded(canvasElement, ['Account']);
    await userEvent.click(security);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('two');
    await expect(account).not.toHaveAttribute('aria-disabled');
    await expect(security).toHaveAttribute('aria-disabled', 'true');
    await expectExpanded(canvasElement, ['Security']);
  },
};

export const Keyboard: Story = {
  args: { onValueChange: fn() },
  render: (args) => <AccordionExample {...args} disabledValue="two" />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [account, security, billing] = canvas.getAllByRole('button');
    await expect(security).toBeDisabled();
    await userEvent.tab();
    await expect(account).toHaveFocus();
    await expect(getComputedStyle(account!).outlineStyle).not.toBe('none');
    // Arrows skip the disabled trigger and wrap in both directions.
    await userEvent.keyboard('{ArrowDown}');
    await expect(billing).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(account).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect(billing).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(account).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(billing).toHaveFocus();
    // Moving focus never toggles.
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expectExpanded(canvasElement, ['Billing']);
    await expect(billing).toHaveFocus();
    await userEvent.keyboard('[Space]');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expectExpanded(canvasElement, []);
  },
};

export const DisabledTrigger: Story = {
  args: { onValueChange: fn() },
  render: (args) => <AccordionExample {...args} disabledTriggerValue="two" />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const account = canvas.getByRole('button', { name: 'Account' });
    const security = canvas.getByRole('button', { name: 'Security' });
    const billing = canvas.getByRole('button', { name: 'Billing' });
    await expect(security).toBeDisabled();
    await userEvent.click(security);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    account.focus();
    account.blur();
    security.focus();
    await expect(security).not.toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('[Space]');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expectExpanded(canvasElement, []);
    account.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(billing).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect(account).toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const StatePreserved: Story = {
  args: { defaultValue: 'one' },
  render: (args) => (
    <Accordion {...args}>
      <Accordion.Item value="one">
        <Accordion.Trigger>Notes</Accordion.Trigger>
        <Accordion.Panel>
          <label>
            Note <input type="text" />
          </label>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Notes' });
    const input = canvas.getByLabelText('Note');
    await userEvent.type(input, 'Draft');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toBeVisible();
    await userEvent.click(trigger);
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('Draft');
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { defaultValue: 'two' },
  render: (args) => <AccordionExample {...args} />,
  play: async ({ canvasElement }) => {
    await expectExpanded(canvasElement, ['Security']);
  },
};
