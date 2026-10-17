import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { HoldToConfirm } from './index';

const meta = {
  title: 'Actions/HoldToConfirm',
  component: HoldToConfirm,
  tags: ['!autodocs'],
  args: { variant: 'morph', label: 'Hold to revoke access', confirmedLabel: 'Revoked', confirmationAnnouncement: 'Access revoked',
    getHoldDescription: (duration: string) => `Hold Space, Enter, or the primary pointer for ${duration}.`, onConfirm: fn(), onValueChange: fn(), duration: 240 },
  parameters: { docs: { source: { language: 'tsx', code: `<HoldToConfirm variant="morph" label="Hold to revoke access" confirmedLabel="Revoked"
  confirmationAnnouncement="Access revoked" getHoldDescription={describeHold}
  onConfirm={revokeAccess} />` }, description: { component: 'Hold to confirm, then morph the button into its completed face.' },
    usage: 'The morph variant keeps the same native button, hold duration and keyboard contract. Hold Space or Enter to complete; release early, blur, Tab or Escape cancels. Provide an untimed Button in a Dialog for click-only assistive technology. onConfirm reports the hold interaction, not an async outcome; pending, retries and Undo remain application-owned.' } },
} satisfies Meta<typeof HoldToConfirm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MorphConfirm: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter>}');
    await waitFor(async () => { await expect(button).toHaveAttribute('data-state', 'confirmed'); });
    await userEvent.keyboard('{/Enter}');
    await expect(canvas.getByRole('button', { name: 'Revoked' })).toBe(button);
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(true);
    await expect(canvas.getByRole('status')).toHaveTextContent('Access revoked');
    await userEvent.keyboard(' ');
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};
export const MorphLight: Story = { ...MorphConfirm, globals: { theme: 'light' } };
export const MorphCompleted: Story = { args: { defaultValue: true } };
export const MorphCancelled: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ >}{/ }');
    await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'idle');
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter>}{Escape}{/Enter}');
    await expect(canvas.getByRole('button')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const MorphControlledReject: Story = {
  args: { value: false },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button');
    await userEvent.tab();
    await userEvent.keyboard('{ >}');
    await waitFor(async () => { await expect(args.onConfirm).toHaveBeenCalledTimes(1); });
    await userEvent.keyboard('{/ }');
    await expect(button).toHaveAttribute('data-state', 'idle');
    await expect(button).toHaveTextContent('Hold to revoke access');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await expect(button.ownerDocument.activeElement).toBe(button);
  },
};
export const MorphReducedMotion: Story = {
  ...MorphConfirm,
  play: async (context) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    await MorphConfirm.play!(context);
    await expect(context.canvas.getByRole('button').style.transform).toBe('');
  },
};
