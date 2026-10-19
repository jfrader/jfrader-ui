import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Spinner, type SpinnerSize } from './index';

const SIZES = ['sm', 'md', 'lg', 'xl'] as const satisfies readonly SpinnerSize[];
const SIZE_PX: Record<SpinnerSize, number> = { sm: 16, md: 20, lg: 24, xl: 48 };

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
      usage: `### Loading
- \`label\` supplies hidden text in a \`status\` region and defaults to \`Loading\`. Set it to the operation, such as \`Saving changes\`; the spinner does not show progress or mark other content busy.
- Mounting a status region does not guarantee an announcement. If an announcement is required, update text in a live region that was already mounted.

### Appearance
- \`size\` is \`sm\` (16px), \`md\` (20px, the default) or \`lg\` (24px). The ring inherits text color. Reduced motion replaces rotation with an opacity pulse.`,
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Spinner } from '@jfrader/ui';

<>
  <Spinner size="sm" label="Loading sm" />
  <Spinner size="md" label="Loading md" />
  <Spinner size="lg" label="Loading lg" />
  <Spinner size="xl" label="Loading xl" />
</>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Spinner, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const LoadingStatus = styled.div({ color: vars.color.accentText });

<LoadingStatus><Spinner label="Loading" /></LoadingStatus>` } } },
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
