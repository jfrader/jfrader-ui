import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { StreamingCaret } from './index';

const meta = {
  title: 'Feedback/StreamingCaret', component: StreamingCaret, tags: ['autodocs'],
  parameters: { docs: {
    description: { component: 'Mark the end of text as it appears.' },
    usage: `### Accessibility
The span is decorative (aria-hidden by default). Provide any status text or live region separately. It has no APG pattern or keyboard interactions and never moves focus.

### Motion
The caret blinks in the normal motion setting and stays visible when prefers-reduced-motion is reduce. Size sets its font size; color inherits from the surrounding text. No transport, text buffering or timers are owned by this component.`,
  } },
  render: (args) => <p>Writing<StreamingCaret {...args} /></p>,
} satisfies Meta<typeof StreamingCaret>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const caret = canvasElement.querySelector('[data-ui="streaming-caret"]')!;
    await expect(caret).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(caret).animationName).not.toBe('none');
    await expect(caret).not.toHaveAttribute('tabindex');
  },
};
export const CaretReducedMotion: Story = {
  name: 'Caret Reduced Motion',
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    await expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const caret = canvasElement.querySelector('[data-ui="streaming-caret"]')!;
    await expect(getComputedStyle(caret).animationName).toBe('none');
    await expect(getComputedStyle(caret).opacity).toBe('1');
  },
};
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
export const LightTheme: Story = { decorators: [withLightTheme] };
