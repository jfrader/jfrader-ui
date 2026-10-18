import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Skeleton } from './index';

const linesStyle = {
  display: 'grid',
  gap: vars.space[2],
  inlineSize: '20rem',
} satisfies CSSProperties;

const cardStyle = {
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '20rem',
  padding: vars.space[4],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
} satisfies CSSProperties;

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
} satisfies CSSProperties;

const headerTextStyle = {
  display: 'grid',
  flex: 1,
  gap: vars.space[2],
} satisfies CSSProperties;

function skeletonsIn(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="skeleton"]'));
}

const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  parameters: {
    docs: {
      description: { component: 'Reserve space for content while it loads.' },
      usage: `- The placeholder is aria-hidden and has no role. Announce loading elsewhere with a Spinner or aria-busy on the region.
- Numeric dimensions are pixels; strings are CSS lengths.
- With circle, height follows width unless height is supplied.
- Compose \`Skeleton.Morph\` and \`Skeleton.Block\` to replace placeholders with ready content. Pass \`value="loading" | "ready"\` and a localized \`loadingLabel\`; optional \`readyLabel\` announces completion. \`defaultValue\` seeds a static presentation and emits no state requests.
- Ready content is mounted immediately; loading unmounts it. Reload parks focus on the shell only when a removed content control owned focus. Reduced motion swaps immediately. See the Morph Profile example for the complete composition.`,
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { width: 240, height: 16 },
  play: async ({ canvasElement }) => {
    const [skeleton] = skeletonsIn(canvasElement);
    await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    const rect = skeleton?.getBoundingClientRect();
    await expect(rect?.width).toBe(240);
    await expect(rect?.height).toBe(16);
  },
};

export const Text: Story = {
  render: (args) => (
    <div style={linesStyle}>
      <Skeleton {...args} />
      <Skeleton {...args} />
      <Skeleton {...args} width="60%" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [first, , last] = skeletonsIn(canvasElement);
    const fullWidth = first?.getBoundingClientRect().width ?? 0;
    await expect(last?.getBoundingClientRect().width).toBeCloseTo(fullWidth * 0.6);
  },
};

export const Circle: Story = {
  args: { circle: true, width: 48 },
  play: async ({ canvasElement }) => {
    const [skeleton] = skeletonsIn(canvasElement);
    const rect = skeleton?.getBoundingClientRect();
    await expect(rect?.width).toBe(48);
    await expect(rect?.height).toBe(48);
    await expect(getComputedStyle(skeleton as HTMLElement).borderRadius).not.toBe('0px');
  },
};

export const CustomRadius: Story = {
  args: { width: 120, height: 32, radius: 0 },
  play: async ({ canvasElement }) => {
    const [skeleton] = skeletonsIn(canvasElement);
    await expect(getComputedStyle(skeleton as HTMLElement).borderRadius).toBe('0px');
  },
};

export const Card: Story = {
  render: (args) => (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <Skeleton {...args} circle />
        <div style={headerTextStyle}>
          <Skeleton {...args} width="50%" />
          <Skeleton {...args} width="30%" height={12} />
        </div>
      </div>
      <Skeleton {...args} height={120} radius={vars.radius.md} />
      <Skeleton {...args} />
      <Skeleton {...args} width="80%" />
    </div>
  ),
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: Card.render,
};
