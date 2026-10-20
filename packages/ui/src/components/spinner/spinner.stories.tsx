import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Spinner, type SpinnerSize } from './index';
import { Button } from '../button';

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
      sections: [
        { title: 'Sizes', stories: ['Sizes'] },
        { title: 'Labels', stories: ['CustomLabel'] },
        { title: 'Tones', stories: ['InheritsColor', 'ResultTones'] },
        { title: 'Composition', stories: ['BusyButton'] },
      ],
      usage: `### When to use
Show activity while an operation has no measurable completion. Use Progress when completion can be measured, or Skeleton when reserving a known content layout.

### Accessibility
Name the operation, such as “Saving changes”. Mounting a status region does not guarantee an announcement; update an already-mounted live region when an announcement is required. Mark the actual control or content region busy yourself. Inside a named button, keep the indicator decorative to avoid duplicate announcements. Reduced motion keeps morph shapes still and replaces ring rotation with a pulse.`,
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
  name: 'Operation label',
  parameters: { docs: { description: { story: 'Give the loading status a name that describes the operation.' }, source: { language: 'tsx', code: `import { Spinner } from '@jfrader/ui';

<Spinner label="Saving changes" />` } } },
  args: { label: 'Saving changes' },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveTextContent('Saving changes');
  },
};

export const Sizes: Story = {
  name: 'Indicator sizes',
  parameters: { docs: { description: { story: 'Compare small, medium, large, and extra-large loading indicators.' }, source: { language: 'tsx', code: `import { Spinner } from '@jfrader/ui';

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
  name: 'Inherited color',
  parameters: { docs: { description: { story: 'Use the surrounding text color for the loading ring.' }, source: { language: 'tsx', code: `import { Spinner, styled } from '@jfrader/ui';
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

export const ResultTones: Story = {
  name: 'Success and error tones',
  parameters: { docs: { description: { story: 'Pair result colors with a check or cross and an accessible result label.' }, source: { language: 'tsx', code: `import { Spinner } from '@jfrader/ui';

<>
  <Spinner value="success" tone="status" successLabel="Saved" />
  <Spinner value="error" tone="status" errorLabel="Save failed" />
</>` } } },
  render: () => (
    <>
      <Spinner value="success" tone="status" successLabel="Saved" />
      <Spinner value="error" tone="status" errorLabel="Save failed" />
    </>
  ),
};

export const BusyButton: Story = {
  name: 'Busy action',
  parameters: { docs: { description: { story: 'Keep the spinner decorative inside a button that already names the operation.' }, source: { language: 'tsx', code: `import { Button, Spinner } from '@jfrader/ui';

<Button aria-busy="true" disabled>
  <Spinner decorative label="Saving changes" />
  Saving changes
</Button>` } } },
  render: () => (
    <Button aria-busy="true" disabled>
      <Spinner decorative label="Saving changes" />
      Saving changes
    </Button>
  ),
};
