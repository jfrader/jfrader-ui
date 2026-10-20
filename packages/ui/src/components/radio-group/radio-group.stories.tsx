import type { ComponentPropsWithRef } from 'react';
import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { RadioGroup, type RadioGroupOrientation, type RadioGroupCompoundProps as RadioGroupProps, type RadioGroupEasyProps } from './index';

function ReplacementRadioLabel(props: ComponentPropsWithRef<'label'>) {
  return <label {...props} data-replaced="root" />;
}
function ReplacementRadioPart(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replaced="part" />;
}
export const ReplaceRadioParts: Story = {
  render: () => (
    <RadioGroup defaultValue="free" aria-label="Plan">
      <RadioGroup.Radio value="free" label="Free" description="Three projects"
        slots={{ root: ReplacementRadioLabel, label: ReplacementRadioPart, control: ReplacementRadioPart, description: ReplacementRadioPart }}
        slotProps={{ control: { title: 'Selection' } }} />
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelectorAll('[data-replaced]')).toHaveLength(4);
    await expect(canvas.getByRole('radio', { name: 'Free' })).toBeChecked();
    await expect(canvas.getByRole('radio')).toHaveAccessibleDescription('Three projects');
    await expect(canvasElement.querySelector('[title="Selection"]')?.className).not.toBe('');
  },
};

// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const OPTIONS = [
  { value: 'free', label: 'Free', description: 'Up to 3 projects.' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects.' },
  { value: 'team', label: 'Team', description: 'Shared billing and roles.' },
] as const;

const ORIENTATIONS = ['vertical', 'horizontal'] as const satisfies readonly RadioGroupOrientation[];

const Field = styled.div({
  display: 'grid',
  gap: vars.space[2],
});

const GroupLabel = styled.span({
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
});

const Stack = styled.div({
  display: 'grid',
  gap: vars.space[6],
});

const meta = {
  title: 'Inputs/RadioGroup',
  component: RadioGroup,
  parameters: {
    docs: {
      sections: [
        { title: 'Basic', stories: ['Easy'] },
        { title: 'Labels', stories: ['Default', 'WithoutDescriptions'] },
        { title: 'States', stories: ['DisabledOption', 'DisabledGroup'] },
        { title: 'Required and invalid', stories: ['RequiredField'] },
        { title: 'Orientation and forms', stories: ['Horizontal'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
      ],
      description: { component: 'Choose one option from a group of radio buttons.' },
      usage: `### When to use
Use a radio group for one choice from a short, visible list. Use checkboxes when choices are independent.

### Forms
Give form fields a stable name. Only the selected, enabled radio contributes a value. Put native required validation on the radio inputs; an invalid announcement alone does not enforce a selection.

### Keyboard and accessibility
Name the group and each option. Tab enters on the checked radio; with no selection, the entry depends on the Tab direction. Arrow keys move focus and selection, wrapping and skipping disabled radios. Space selects the focused option.

Both arrow pairs work in either layout. Selecting the checked radio leaves it selected. Supply either options or compound children, not both.`,
    },
  },
  argTypes: {
    orientation: { control: 'radio', options: ORIENTATIONS },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<RadioGroupProps>;

export default meta;

type Story = StoryObj<Omit<RadioGroupProps, 'component'>>;
type EasyStory = StoryObj<Omit<RadioGroupEasyProps, 'component'>>;

export const Easy: EasyStory = {
  name: 'Choose a plan',
  parameters: { docs: { description: { story: 'Choose a plan from labeled options with supporting descriptions.' }, source: { language: 'tsx', code: `import { RadioGroup } from '@jfrader/ui';

const plans = [
  { value: 'free', label: 'Free', description: 'Up to 3 projects.' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects.' },
  { value: 'team', label: 'Team', description: 'Shared billing and roles.' },
];

<RadioGroup label="Plan" options={plans} name="plan" defaultValue="free" />` } } },
  args: { label: 'Plan', options: OPTIONS, name: 'plan', defaultValue: 'free', onValueChange: fn() },
  render: (args) => <RadioGroup {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const group = canvas.getByRole('radiogroup', { name: 'Plan' });
    const free = canvas.getByRole('radio', { name: 'Free' });
    const pro = canvas.getByRole('radio', { name: 'Pro' });
    await expect(group).toHaveAttribute('aria-labelledby');
    await expect(free).toHaveAttribute('name', 'plan');
    await expect(free).toBeChecked();
    await expect(pro).toHaveAccessibleDescription('Unlimited projects.');
    await userEvent.click(pro);
    await expect(pro).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pro');
  },
};

function EasyControlledExample(args: RadioGroupEasyProps) {
  const [value, setValue] = useState('free');
  return (
    <RadioGroup {...args} value={value} onValueChange={(next) => {
      setValue(next);
      args.onValueChange?.(next);
    }} />
  );
}
export const EasyControlled: EasyStory = { ...Easy, name: 'Controlled options', render: (args) => <EasyControlledExample {...args} /> };
export const EasyRejected: EasyStory = {
  ...Easy,
  name: 'Rejected option change',
  args: { ...Easy.args, value: 'free' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Pro' }));
    await expect(canvas.getByRole('radio', { name: 'Free' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pro');
  },
};
export const EasyKeyboard: EasyStory = {
  ...Easy,
  name: 'Options keyboard navigation',
  args: { ...Easy.args, options: OPTIONS.map((option) => ({ ...option, disabled: option.value === 'pro' })) },
  play: async ({ canvas, userEvent, args }) => {
    const free = canvas.getByRole('radio', { name: 'Free' });
    const team = canvas.getByRole('radio', { name: 'Team' });
    await expect(canvas.getByRole('radio', { name: 'Pro' })).toBeDisabled();
    await userEvent.tab();
    await expect(free.ownerDocument.activeElement).toBe(free);
    await userEvent.keyboard('{ArrowDown}');
    await expect(team.ownerDocument.activeElement).toBe(team);
    await expect(team).toBeChecked();
    await expect(getComputedStyle(team.nextElementSibling!).outlineStyle).not.toBe('none');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('team');
  },
};
function EasyRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="radio-group" />;
}
const StyledRadioGroup = styled(RadioGroup)({ borderRadius: vars.radius.sm });
export const EasyCustomization: EasyStory = {
  ...Easy,
  name: 'Options customization',
  parameters: { docs: { source: { code: `<RadioGroup label="Plan" options={plans} defaultValue="free"
  sx={{ borderRadius: 0 }}
  slotProps={{ label: { title: 'Plan label' }, radio: { slotProps: { control: { sx: { borderRadius: theme.radius.sm } } } } }}
/>` } } },
  args: {
    ...Easy.args,
    ref: fn(),
    className: 'consumer-root',
    style: { padding: 4 },
    sx: { borderRadius: 0 },
    slotProps: {
      root: {
        className: 'slot-root',
        style: { padding: 8 },
        sx: { borderRadius: vars.radius.md },
        'data-custom-root': 'slot-root',
      },
      label: { title: 'Plan label' },
      radio: { slotProps: { control: { sx: { borderRadius: vars.radius.sm } } } },
    },
  },
  render: (args) => <StyledRadioGroup {...args} data-custom-root="consumer-root" component={EasyRoot} />,
  play: async (context) => {
    await Easy.play?.(context);
    const group = context.canvas.getByRole('radiogroup', { name: 'Plan' });
    await expect(group).toHaveAttribute('data-replacement', 'radio-group');
    await expect(group).toHaveAttribute('data-custom-root', 'slot-root');
    await expect(context.args.ref).toHaveBeenCalledWith(group);
    await expect(group).toHaveClass('consumer-root', 'slot-root');
    await expect(group).toHaveStyle({ padding: '8px' });
    await expect(group).toHaveStyle({ borderRadius: '0px' });
    await expect(context.canvas.getByTitle('Plan label')).toHaveTextContent('Plan');
  },
};

type AssertRadioGroupProps<T extends import('./index').RadioGroupProps> = T;
export type RadioGroupEasyTypeRegression = {
  // @ts-expect-error Options and children are mutually exclusive.
  mixed: AssertRadioGroupProps<{ options: typeof OPTIONS; children: string }>;
};

function RadioExample({
  groupLabel = 'Plan',
  disabledValue,
  ...props
}: RadioGroupProps & { groupLabel?: string; disabledValue?: string }) {
  const labelId = useId();
  return (
    <Field>
      <GroupLabel id={labelId}>
        {groupLabel}
      </GroupLabel>
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
    </Field>
  );
}
RadioExample.displayName = 'RadioExample';

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
ControlledRadioGroup.displayName = 'ControlledRadioGroup';

const getGroup = (canvasElement: HTMLElement, name = 'Plan') =>
  within(within(canvasElement).getByRole('radiogroup', { name }));

export const Default: Story = {
  name: 'Compound field label',
  parameters: { docs: { description: { story: 'Name a compound group with a visible field label.' }, source: { language: 'tsx', code: `import { useId } from 'react';
import { RadioGroup } from '@jfrader/ui';

function PlanField() {
  const labelId = useId();
  return (
    <div>
      <span id={labelId}>Plan</span>
      <RadioGroup aria-labelledby={labelId}>
        <RadioGroup.Radio value="free" label="Free" description="Up to 3 projects." />
        <RadioGroup.Radio value="pro" label="Pro" description="Unlimited projects." />
        <RadioGroup.Radio value="team" label="Team" description="Shared billing and roles." />
      </RadioGroup>
    </div>
  );
}` } } },
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
  name: 'Labels only',
  parameters: { docs: { description: { story: 'Keep short choices compact when they need no supporting text.' }, source: { language: 'tsx', code: `import { RadioGroup } from '@jfrader/ui';

<RadioGroup aria-label="Plan">
  <RadioGroup.Radio value="free" label="Free" />
  <RadioGroup.Radio value="pro" label="Pro" />
  <RadioGroup.Radio value="team" label="Team" />
</RadioGroup>` } } },
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
    <Stack>
      <ControlledRadioGroup {...args} />
      <RadioExample groupLabel="Locked plan" value="free" onValueChange={args.onValueChange} />
    </Stack>
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
  name: 'Unavailable option',
  parameters: { docs: { description: { story: 'Keep Pro visible while keyboard navigation skips it.' }, source: { language: 'tsx', code: `import { RadioGroup } from '@jfrader/ui';

<RadioGroup label="Plan" defaultValue="free" options={[
  { value: 'free', label: 'Free', description: 'Up to 3 projects.' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects.', disabled: true },
  { value: 'team', label: 'Team', description: 'Shared billing and roles.' },
]} />` } } },
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
  name: 'Horizontal choices',
  parameters: { docs: { description: { story: 'Arrange plans horizontally without changing native radio keyboard behavior.' }, source: { language: 'tsx', code: `import { RadioGroup } from '@jfrader/ui';

<RadioGroup label="Plan" orientation="horizontal" defaultValue="free" options={[
  { value: 'free', label: 'Free', description: 'Up to 3 projects.' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects.' },
  { value: 'team', label: 'Team', description: 'Shared billing and roles.' },
]} />` } } },
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
  name: 'Keyboard navigation',
  parameters: { docs: { description: { story: 'Tab into Pro, then use arrows to change both focus and selection.' }, source: { language: 'tsx', code: `import { RadioGroup } from '@jfrader/ui';

<RadioGroup label="Plan" defaultValue="pro" options={[
  { value: 'free', label: 'Free', description: 'Up to 3 projects.' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects.' },
  { value: 'team', label: 'Team', description: 'Shared billing and roles.' },
]} />` } } },
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
  decorators: [withLightTheme],
  args: { defaultValue: 'pro' },
  render: (args) => <RadioExample {...args} disabledValue="team" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: 'Pro' })).toBeChecked();
  },
};

export const DisabledGroup: Story = {
  name: 'Unavailable group',
  parameters: { docs: { description: { story: 'Disable every plan while retaining the current selection.' }, source: { language: 'tsx', code: `import { RadioGroup } from '@jfrader/ui';

<RadioGroup label="Plan" disabled defaultValue="free" options={[
  { value: 'free', label: 'Free', description: 'Up to 3 projects.' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects.' },
  { value: 'team', label: 'Team', description: 'Shared billing and roles.' },
]} />` } } },
  args: { defaultValue: 'free', disabled: true },
  render: (args) => <RadioExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup', { name: 'Plan' });
    await expect(group).toHaveAttribute('aria-disabled', 'true');
    const radios = within(group).getAllByRole('radio');
    for (const radio of radios) {
      await expect(radio).toBeDisabled();
    }
    await userEvent.tab();
    expect(radios).not.toContain(canvasElement.ownerDocument.activeElement);
  },
};

export const RequiredField: Story = {
  name: 'Required plan in a form',
  parameters: { docs: { description: { story: 'Connect a missing-selection message to a required plan field.' }, source: { language: 'tsx', code: `import { useId } from 'react';
import { Button, RadioGroup } from '@jfrader/ui';

function PlanForm() {
  const errorId = useId();
  return (
    <form>
      <RadioGroup name="plan" aria-label="Plan" aria-required="true" aria-invalid="true" aria-describedby={errorId}>
        <RadioGroup.Radio value="free" label="Free" required />
        <RadioGroup.Radio value="pro" label="Pro" required />
      </RadioGroup>
      <p id={errorId}>Choose a plan.</p>
      <Button type="submit">Continue</Button>
    </form>
  );
}` } } },
  render: function RequiredPlan() {
    const errorId = useId();
    return (
      <form>
        <RadioGroup name="plan" aria-label="Plan" aria-required="true" aria-invalid="true" aria-describedby={errorId}>
          <RadioGroup.Radio value="free" label="Free" required />
          <RadioGroup.Radio value="pro" label="Pro" required />
        </RadioGroup>
        <p id={errorId}>Choose a plan.</p>
        <Button type="submit">Continue</Button>
      </form>
    );
  },
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form')!;
    await expect(form.checkValidity()).toBe(false);
    await userEvent.click(within(canvasElement).getByRole('radio', { name: 'Pro' }));
    await expect(form.checkValidity()).toBe(true);
    await expect(new FormData(form).get('plan')).toBe('pro');
  },
};

export const Rtl: Story = {
  args: { defaultValue: 'free', dir: 'rtl' },
  render: (args) => (
    <div dir="rtl">
      <RadioExample {...args} />
      <RadioGroup aria-label="Individual RTL">
        <RadioGroup.Radio value="custom" label="Custom" description="Custom RTL description" dir="rtl" />
      </RadioGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('radiogroup', { name: 'Plan' });
    await expect(group).toHaveAttribute('dir', 'rtl');
    const [free, pro] = within(group).getAllByRole('radio');
    const freeLabel = free!.closest('label');
    await expect(freeLabel).toHaveAttribute('data-ui', 'radio-group-radio');

    // Verify logical property marginInlineStart resolves to physical marginRight under RTL
    const freeDescId = free!.getAttribute('aria-describedby');
    const freeDescription = canvasElement.querySelector('#' + CSS.escape(freeDescId!)) as HTMLElement;
    const computed = getComputedStyle(freeDescription);
    expect(parseFloat(computed.marginRight)).toBeGreaterThan(0);
    expect(parseFloat(computed.marginLeft)).toBe(0);

    // Verify individual RadioGroup.Radio dir forwarding to its label root
    const customRadio = within(canvasElement).getByRole('radio', { name: 'Custom' });
    const customLabel = customRadio.closest('label');
    await expect(customLabel).toHaveAttribute('dir', 'rtl');
    const customDescId = customRadio.getAttribute('aria-describedby');
    const customDescription = canvasElement.querySelector('#' + CSS.escape(customDescId!)) as HTMLElement;
    const customComputed = getComputedStyle(customDescription);
    expect(parseFloat(customComputed.marginRight)).toBeGreaterThan(0);
    expect(parseFloat(customComputed.marginLeft)).toBe(0);

    // Keyboard navigation in RTL: tab to first, ArrowDown
    await userEvent.tab();
    await expect(free).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(pro).toHaveFocus();
    await expect(pro).toBeChecked();
  },
};
