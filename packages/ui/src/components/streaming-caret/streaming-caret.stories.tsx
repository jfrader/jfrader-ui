import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { StreamingCaret } from './index';

const meta = {
  title: 'Feedback/StreamingCaret', component: StreamingCaret, tags: ['autodocs'],
  parameters: { docs: {
    sections: [
      { title: 'Streaming text', stories: ['Default'] },
      { title: 'Size', stories: ['Small', 'Large'] },
    ],
    description: { component: 'Mark the end of text as it appears.' },
    usage: `### Accessibility
The caret is decorative. It is \`aria-hidden\` by default. Provide status text or a live region separately. It has no APG pattern and never moves focus.

### Motion

The caret blinks normally and stays visible with reduced motion. Color inherits from the surrounding text. Handle transport, text buffering and timers in your app.`,
  } },
  render: (args) => <p>Writing<StreamingCaret {...args} /></p>,
} satisfies Meta<typeof StreamingCaret>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  name: 'Writing indicator',
  parameters: { docs: { description: { story: 'Place a decorative caret after text while a response is arriving.' }, source: { language: 'tsx', code: `import { StreamingCaret } from '@jfrader/ui';

<p>Writing<StreamingCaret /></p>` } } },
  play: async ({ canvasElement }) => {
    const caret = canvasElement.querySelector('[data-ui="streaming-caret"]')!;
    await expect(caret).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(caret).animationName).not.toBe('none');
    await expect(parseFloat(getComputedStyle(caret).animationDuration)).toBeGreaterThan(0);
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
export const Small: Story = {
  name: 'Small caret',
  args: { size: 'sm' },
  parameters: { docs: { description: { story: 'Use a smaller caret after a compact label.' }, source: { language: 'tsx', code: `import { StreamingCaret } from '@jfrader/ui';

<p>Writing<StreamingCaret size="sm" /></p>` } } },
};
export const Large: Story = {
  name: 'Large caret',
  args: { size: 'lg' },
  parameters: { docs: { description: { story: 'Use a larger caret after the writing label.' }, source: { language: 'tsx', code: `import { StreamingCaret } from '@jfrader/ui';

<p>Writing<StreamingCaret size="lg" /></p>` } } },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  parameters: { docs: { source: { language: 'tsx', code: `import { StreamingCaret, ThemeRoot } from '@jfrader/ui';

<ThemeRoot theme="light">
  <p>Writing<StreamingCaret /></p>
</ThemeRoot>` } } },
};
