import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Spinner, type SpinnerSize } from './index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly SpinnerSize[];
const SIZE_PX: Record<SpinnerSize, number> = { sm: 16, md: 20, lg: 24 };

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[4],
} satisfies CSSProperties;

const accentStyle = {
  color: vars.color.accentText,
} satisfies CSSProperties;

const meta = {
  title: 'Feedback/Spinner',
  component: Spinner,
  parameters: {
    docs: {
      description: { component: 'Show that an action is loading.' },
    },
  },
  tags: ['autodocs'],
  args: { size: 'md', label: 'Loading' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveTextContent('Loading');
    await expect(status).toHaveAttribute('data-ui', 'spinner');
  },
};

export const CustomLabel: Story = {
  args: { label: 'Saving changes' },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveTextContent('Saving changes');
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={rowStyle}>
      {SIZES.map((size) => (
        <Spinner {...args} key={size} size={size} label={`Loading ${size}`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const size of SIZES) {
      const ring = canvas
        .getByText(`Loading ${size}`)
        .parentElement?.querySelector<HTMLElement>('[data-ui="spinner-indicator"]');
      // Layout size, not getBoundingClientRect: the rotation transform inflates the bounding box.
      await expect(ring?.offsetWidth).toBe(SIZE_PX[size]);
      await expect(ring?.offsetHeight).toBe(SIZE_PX[size]);
    }
  },
};

export const InheritsColor: Story = {
  render: (args) => (
    <div style={accentStyle}>
      <Spinner {...args} />
    </div>
  ),
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading');
  },
};
