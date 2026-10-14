import { StrictMode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Button } from '../components/button';
import { useControlledState } from './use-controlled-state';

function StateFixture({ controlled = false, onChange }: { controlled?: boolean; onChange: (value: string) => void }) {
  const [value, requestChange, reset] = useControlledState<string>(controlled ? 'initial' : undefined, 'initial', onChange);
  return (
    <>
      <output aria-label="Current value">{value}</output>
      <Button onClick={() => {
        requestChange('next');
        requestChange('next');
      }}>Repeat request</Button>
      <Button onClick={() => {
        requestChange('other');
        requestChange('initial');
      }}>Reverse request</Button>
      <Button onClick={() => {
        reset();
        requestChange('initial');
      }}>Reset and request</Button>
    </>
  );
}

const meta = {
  title: 'Internal/Controlled State',
  component: StateFixture,
  args: { onChange: fn() },
  decorators: [(Story) => <StrictMode><Story /></StrictMode>],
} satisfies Meta<typeof StateFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UncontrolledBatch: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reverse request' }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('initial');
    await expect(args.onChange).toHaveBeenCalledTimes(2);
    await expect(args.onChange).toHaveBeenNthCalledWith(1, 'other');
    await expect(args.onChange).toHaveBeenNthCalledWith(2, 'initial');
    await userEvent.click(canvas.getByRole('button', { name: 'Repeat request' }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('next');
    await expect(args.onChange).toHaveBeenCalledTimes(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Reverse request' }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('initial');
    await expect(args.onChange).toHaveBeenCalledTimes(5);
    await userEvent.click(canvas.getByRole('button', { name: 'Repeat request' }));
    await expect(args.onChange).toHaveBeenCalledTimes(6);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset and request' }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('initial');
    await expect(args.onChange).toHaveBeenCalledTimes(6);
  },
};

export const ControlledBatch: Story = {
  args: { controlled: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Repeat request' }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('initial');
    await expect(args.onChange).toHaveBeenCalledTimes(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Reverse request' }));
    await expect(canvas.getByLabelText('Current value')).toHaveTextContent('initial');
    await expect(args.onChange).toHaveBeenCalledTimes(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset and request' }));
    await expect(args.onChange).toHaveBeenCalledTimes(3);
  },
};
