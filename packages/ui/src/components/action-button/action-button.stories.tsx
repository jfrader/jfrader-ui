import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { ActionButton, type ActionButtonValue } from './index';
import { Button } from '../button';

const snippet = `<ActionButton label="Publish" pendingLabel="Publishing" successLabel="Published"
  errorLabel="Publish failed" onAction={publish} />`;
const meta = {
  title: 'Actions/ActionButton',
  component: ActionButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Run an action and show its pending, success or error result in the same button.',
      },
      source: { code: snippet, language: 'tsx' },
      usage: `### Actions
Return the real promise from \`onAction\`. Use \`Button loading\` when you do not need a result label. Use a confirmation dialog for destructive work.

### State
\`value\` controls the displayed face; \`defaultValue\` seeds an uncontrolled face. A rejected controlled request does not cancel the action. Concurrent activations are blocked until its promise settles. Errors remain until retry or an external update. \`resetAfterMs\` defaults to 2400ms and resets success only; 0 keeps success.

### Keyboard and accessibility
Tab reaches the native button. Enter and Space activate once. Pending keeps focus and sets \`aria-busy\` and \`aria-disabled\`. The default accessible name starts with the idle label and appends the visible pending or result label. A persistent sibling status announces results. Consumer names and descriptions are preserved; a custom name must include the visible label in every state. Reduced motion makes width and pending feedback static.

### Customization
\`component\` is sugar for \`slots.root\`. Root replacements forward button props and ref; icon, label and status replacements forward span props. \`slotProps.root\` wins native conflicts; className and style merge. \`sx\` applies last.`,
    },
  },
  args: {
    label: 'Publish',
    pendingLabel: 'Publishing',
    successLabel: 'Published',
    errorLabel: 'Publish failed',
    onAction: fn(async () => {}),
    onValueChange: fn(),
    onActionError: fn(),
    resetAfterMs: 0,
  },
  afterEach: async ({ canvasElement }) => {
    await waitFor(() => {
      for (const face of canvasElement.querySelectorAll('[data-action-face]'))
        expect(getComputedStyle(face).opacity).toBe('1');
    });
  },
} satisfies Meta<typeof ActionButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Light: Story = { globals: { theme: 'light' } };
export const Pending: Story = { args: { value: 'pending' } };
export const Success: Story = { args: { value: 'success', successIcon: '✓' } };
export const Error: Story = { args: { value: 'error', errorIcon: '×' } };
export const Disabled: Story = { args: { disabled: true } };
export const Variants: Story = {
  render: (args) => (
    <>
      <ActionButton {...args} variant="solid" />
      <ActionButton {...args} variant="soft" />
      <ActionButton {...args} variant="outline" />
      <ActionButton {...args} variant="ghost" />
    </>
  ),
};
export const Sizes: Story = {
  render: (args) => (
    <>
      <ActionButton {...args} size="sm" label="Small" />
      <ActionButton {...args} size="md" label="Medium" />
      <ActionButton {...args} size="lg" label="Large" />
    </>
  ),
  play: async ({ canvas }) => {
    for (const [name, height] of [
      ['Small', 32],
      ['Medium', 40],
      ['Large', 48],
    ] as const)
      await expect(
        canvas.getByRole('button', { name }).getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual(height);
  },
};
export const KeyboardAndPending: Story = {
  play: async ({ args, canvas, userEvent }) => {
    let finish = () => {};
    args.onAction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const button = canvas.getByRole('button', { name: 'Publish' });
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(button).toHaveAttribute('data-state', 'pending');
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAccessibleName('Publish: Publishing');
    await userEvent.keyboard(' ');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(button).toHaveAttribute('data-state', 'success'));
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(button).toHaveAccessibleName('Publish: Published');
    await expect(canvas.getByRole('status')).toHaveTextContent('Published');
    await userEvent.keyboard(' ');
    await waitFor(() => expect(args.onAction).toHaveBeenCalledTimes(2));
  },
};
export const ErrorRetry: Story = {
  play: async ({ args, canvas, userEvent }) => {
    args.onAction.mockRejectedValueOnce(new globalThis.Error('Offline'));
    const button = canvas.getByRole('button', { name: 'Publish' });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('data-state', 'error'));
    await expect(button).toHaveAccessibleName('Publish: Publish failed');
    await expect(args.onActionError).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('status')).toHaveTextContent('Publish failed');
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('data-state', 'success'));
  },
};
export const ControlledReject: Story = {
  args: { value: 'idle' },
  play: async ({ args, canvas, userEvent }) => {
    let finish = () => {};
    args.onAction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const button = canvas.getByRole('button', { name: 'Publish' });
    await userEvent.dblClick(button);
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute('data-state', 'idle');
    await expect(button).not.toHaveAttribute('aria-busy');
    finish();
    await waitFor(() => expect(args.onValueChange).toHaveBeenLastCalledWith('success'));
    await expect(button).toHaveAttribute('data-state', 'idle');
  },
};
export const ControlledAccept: Story = {
  render: function Controlled(args) {
    const [value, setValue] = useState<ActionButtonValue>('idle');
    return <ActionButton {...args} value={value} onValueChange={setValue} />;
  },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Publish' });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('data-state', 'success'));
  },
};
export const Prevented: Story = {
  args: { onClick: (event) => event.preventDefault() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onAction).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Reset: Story = {
  args: { resetAfterMs: 120 },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(args.onValueChange).toHaveBeenLastCalledWith('idle'));
    await expect(args.onValueChange?.mock.calls.map(([value]) => value)).toEqual([
      'pending',
      'success',
      'idle',
    ]);
  },
};
function Root(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-custom-root />;
}
function Part(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-custom-part />;
}
export const Customization: Story = {
  render: (args) => (
    <>
      <span id="action-description">Publish the draft</span>
      <ActionButton
        {...args}
        component={Root}
        slots={{ icon: Part, label: Part, status: Part }}
        startIcon={0}
        aria-label="0Publish"
        aria-describedby="action-description"
        data-ui="consumer action-button"
        slotProps={{
          root: {
            title: 'Root props',
            css: { borderRadius: vars.radius.full },
          },
          icon: { title: 'Icon props' },
          label: { title: 'Label props' },
          status: { title: 'Status props' },
        }}
        sx={{ borderRadius: vars.radius.sm }}
      />
    </>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: '0Publish' });
    await expect(button).toHaveAttribute('data-custom-root');
    await expect(button).toHaveAttribute('data-ui', 'action-button consumer button');
    await expect(button).toHaveAttribute('aria-describedby', 'action-description');
    await expect(canvas.getByTitle('Icon props')).toHaveTextContent('0');
    await expect(canvas.getByTitle('Label props')).toHaveAttribute('data-custom-part');
  },
};
export const LongLabelsRTL: Story = {
  args: { label: 'نشر التغييرات المحفوظة', dir: 'rtl' },
};
export const ReducedMotion: Story = {
  name: 'Action Button Reduced Motion',
  args: { value: 'pending' },
  play: async ({ canvas }) => {
    const svg = canvas.getByRole('button').querySelector('svg');
    await expect(
      svg
        ?.getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity),
    ).toHaveLength(0);
  },
};
export const NaturalWidth: Story = {
  args: { label: 'Save', successLabel: 'All changes have been saved' },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Save' });
    const before = button.getBoundingClientRect().width;
    await userEvent.click(button);
    await waitFor(() => expect(button.getBoundingClientRect().width).toBeGreaterThan(before + 40));
  },
};
export const UnmountDuringAction: Story = {
  render: function Unmount(args) {
    const [shown, setShown] = useState(true);
    return (
      <>
        {shown && <ActionButton {...args} />}
        <Button onClick={() => setShown(false)}>Remove action</Button>
      </>
    );
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    let finish = () => {};
    args.onAction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Publish' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Remove action' }));
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(within(canvasElement).queryByRole('status')).toBeNull();
  },
};
