import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { RadioGroup, type RadioGroupOrientation, type RadioGroupProps } from './index';

const OPTIONS = [
  { value: 'free', label: 'Free', description: 'Up to 3 projects.' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects.' },
  { value: 'team', label: 'Team', description: 'Shared billing and roles.' },
] as const;

const ORIENTATIONS = ['vertical', 'horizontal'] as const satisfies readonly RadioGroupOrientation[];

const fieldStyle = css({
  display: 'grid',
  gap: vars.space[2],
});

const groupLabelStyle = css({
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
});

const stackStyle = css({
  display: 'grid',
  gap: vars.space[6],
});

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  argTypes: {
    orientation: { control: 'radio', options: ORIENTATIONS },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

function RadioExample({
  groupLabel = 'Plan',
  disabledValue,
  ...props
}: RadioGroupProps & { groupLabel?: string; disabledValue?: string }) {
  const labelId = useId();
  return (
    <div css={fieldStyle}>
      <span id={labelId} css={groupLabelStyle}>
        {groupLabel}
      </span>
      <RadioGroup {...props} aria-labelledby={labelId}>
        {OPTIONS.map((option) => (
          <RadioGroup.Radio
            key={option.value}
            value={option.value}
            label={option.label}
            description={option.description}
            disabled={option.value === disabledValue}
          />
        ))}
      </RadioGroup>
    </div>
  );
}

function ControlledRadioGroup(props: RadioGroupProps) {
  const [value, setValue] = useState('free');
  return (
    <RadioExample
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
    />
  );
}

const getGroup = (canvasElement: HTMLElement, name = 'Plan') =>
  within(within(canvasElement).getByRole('radiogroup', { name }));

export const Default: Story = {
  render: (args) => <RadioExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup', { name: 'Plan' });
    await expect(group).toHaveAttribute('aria-orientation', 'vertical');
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    await expect(radios).toHaveLength(OPTIONS.length);
    // One shared, generated name makes the inputs a single native group.
    await expect(radios[0]!.name).not.toBe('');
    radios.forEach((radio) => expect(radio.name).toBe(radios[0]!.name));
    radios.forEach((radio) => expect(radio).not.toBeChecked());
    const pro = canvas.getByRole('radio', { name: 'Pro' });
    await expect(pro).toHaveAccessibleDescription('Unlimited projects.');
    await userEvent.click(pro);
    await expect(pro).toBeChecked();
  },
};

export const WithoutDescriptions: Story = {
  render: (args) => (
    <RadioGroup {...args} aria-label="Plan">
      {OPTIONS.map((option) => (
        <RadioGroup.Radio key={option.value} value={option.value} label={option.label} />
      ))}
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const radios = getGroup(canvasElement).getAllByRole('radio');
    await expect(radios).toHaveLength(OPTIONS.length);
    for (const radio of radios) {
      await expect(radio).not.toHaveAttribute('aria-describedby');
      await expect(radio.parentElement!.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
  },
};

export const Controlled: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <div css={stackStyle}>
      <ControlledRadioGroup {...args} />
      <RadioExample groupLabel="Locked plan" value="free" onValueChange={args.onValueChange} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const plan = getGroup(canvasElement);
    await userEvent.click(plan.getByRole('radio', { name: 'Pro' }));
    await expect(plan.getByRole('radio', { name: 'Pro' })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'pro');
    // Re-activating the checked radio is not a change.
    await userEvent.click(plan.getByRole('radio', { name: 'Pro' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowDown}');
    await expect(plan.getByRole('radio', { name: 'Team' })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'team');

    // The locked group's parent never honors requests: each activation issues exactly one
    // request and the checked radio stays on "free".
    const locked = getGroup(canvasElement, 'Locked plan');
    const lockedPro = locked.getByRole('radio', { name: 'Pro' });
    await userEvent.click(lockedPro);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 'pro');
    await expect(lockedPro).not.toBeChecked();
    await expect(locked.getByRole('radio', { name: 'Free' })).toBeChecked();
    await userEvent.click(lockedPro);
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(lockedPro).not.toBeChecked();
    await userEvent.click(locked.getByRole('radio', { name: 'Free' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
  },
};

export const DisabledOption: Story = {
  args: { defaultValue: 'free', onValueChange: fn() },
  render: (args) => <RadioExample {...args} disabledValue="pro" />,
  play: async ({ args, canvasElement }) => {
    const plan = getGroup(canvasElement);
    const [free, pro, team] = plan.getAllByRole('radio');
    await expect(pro).toBeDisabled();
    await userEvent.tab();
    await expect(free).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(team).toHaveFocus();
    await expect(team).toBeChecked();
    await expect(pro).not.toBeChecked();
    await userEvent.keyboard('{ArrowUp}');
    await expect(free).toHaveFocus();
    await expect(free).toBeChecked();
    await userEvent.click(pro!);
    await expect(pro).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'team');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'free');
  },
};

export const Horizontal: Story = {
  args: { defaultValue: 'free', orientation: 'horizontal' },
  render: (args) => <RadioExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'horizontal');
    const [free, pro, team] = canvas.getAllByRole('radio');
    await userEvent.tab();
    await expect(free).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(pro).toHaveFocus();
    await expect(pro).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    await expect(team).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    await expect(free).toHaveFocus();
    await expect(free).toBeChecked();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(team).toHaveFocus();
    await expect(team).toBeChecked();
  },
};

export const Keyboard: Story = {
  args: { defaultValue: 'pro', onValueChange: fn() },
  render: (args) => <RadioExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const group = within(canvasElement).getByRole('radiogroup');
    const [, pro, team] = within(group).getAllByRole('radio');
    // The group is one tab stop that enters on the checked radio.
    await userEvent.tab();
    await expect(pro).toHaveFocus();
    await expect(pro!.ownerDocument.activeElement).toBe(pro);
    const circle = pro!.nextElementSibling as HTMLElement;
    await expect(getComputedStyle(circle).outlineStyle).not.toBe('none');
    await expect(getComputedStyle(circle).outlineWidth).not.toBe('0px');
    // Arrows move the selection, not only focus.
    await userEvent.keyboard('{ArrowDown}');
    await expect(team).toHaveFocus();
    await expect(team).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('team');
    await userEvent.keyboard('{ArrowUp}');
    await expect(pro).toHaveFocus();
    await expect(pro).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    // Space on the checked radio is not a change.
    await userEvent.keyboard('[Space]');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    // Tab leaves the group; Shift+Tab returns to the checked radio.
    await userEvent.tab();
    await expect(group.contains(group.ownerDocument.activeElement)).toBe(false);
    await userEvent.tab({ shift: true });
    await expect(pro).toHaveFocus();
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { defaultValue: 'pro' },
  render: (args) => <RadioExample {...args} disabledValue="team" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: 'Pro' })).toBeChecked();
  },
};
