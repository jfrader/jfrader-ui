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
  maxInlineSize: '100%',
} satisfies CSSProperties;

const cardStyle = {
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '20rem',
  maxInlineSize: '100%',
  boxSizing: 'border-box',
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
      sections: [
        { title: 'Shapes', stories: ['Text', 'Circle', 'Media'] },
        { title: 'Composition', stories: ['Card'] },
        { title: 'Loading and ready', stories: ['ContentStates'] },
      ],
      usage: `### When to use
Reserve the shape of content whose layout is known while it loads. Match the eventual content to reduce layout shifts. Use a Spinner for an operation without a known content layout.

### Keyboard and accessibility

Placeholders are hidden from assistive technology. Announce loading separately and mark the affected region busy. Loading morph content is unmounted, so do not keep unsaved form state inside it. On reload, focus moves to the shell only when a removed control held focus. Reduced motion swaps content immediately.`,
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Skeleton } from '@jfrader/ui';

<Skeleton width={240} height={16} />` } } },
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
  name: 'Text lines',
  parameters: { docs: { description: { story: 'Reserve three lines of text with a shorter final line.' }, source: { language: 'tsx', code: `import { Skeleton, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const TextPlaceholder = styled.div({ display: 'grid', gap: vars.space[2], inlineSize: '20rem', maxInlineSize: '100%' });

<TextPlaceholder>
  <Skeleton />
  <Skeleton />
  <Skeleton width="60%" />
</TextPlaceholder>` } } },
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
  name: 'Avatar placeholder',
  parameters: { docs: { description: { story: 'Reserve a circular space for an avatar.' }, source: { language: 'tsx', code: `import { Skeleton } from '@jfrader/ui';

<Skeleton circle width={48} />` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Skeleton } from '@jfrader/ui';

<Skeleton width={120} height={32} radius={0} />` } } },
  args: { width: 120, height: 32, radius: 0 },
  play: async ({ canvasElement }) => {
    const [skeleton] = skeletonsIn(canvasElement);
    await expect(getComputedStyle(skeleton as HTMLElement).borderRadius).toBe('0px');
  },
};

export const Card: Story = {
  name: 'Profile card placeholder',
  parameters: { docs: { description: { story: 'Combine an avatar, text, and media into a profile loading layout.' }, source: { language: 'tsx', code: `import { Skeleton, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ProfilePlaceholder = styled.div({
  display: 'grid', gap: vars.space[4], inlineSize: '20rem', maxInlineSize: '100%',
  boxSizing: 'border-box', padding: vars.space[4],
  border: \`1px solid \${vars.color.border}\`, borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
});
const Header = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[3] });
const HeaderText = styled.div({ display: 'grid', flex: 1, gap: vars.space[2] });

<ProfilePlaceholder>
  <Header>
    <Skeleton circle />
    <HeaderText>
      <Skeleton width="50%" />
      <Skeleton width="30%" height={12} />
    </HeaderText>
  </Header>
  <Skeleton height={120} radius={vars.radius.md} />
  <Skeleton />
  <Skeleton width="80%" />
</ProfilePlaceholder>` } } },
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
  parameters: Card.parameters,
  decorators: [withLightTheme],
  render: Card.render,
};

export const Media: Story = {
  name: 'Media placeholder',
  parameters: { docs: { description: { story: 'Reserve a rounded rectangle for an image or video.' }, source: { language: 'tsx', code: `import { Skeleton } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

<Skeleton width={240} height={120} radius={vars.radius.md} />` } } },
  args: { width: 240, height: 120, radius: vars.radius.md },
};

export const ContentStates: Story = {
  name: 'Loading and ready content',
  parameters: { docs: { description: { story: 'Compare reserved text blocks with the content that replaces them.' }, source: { language: 'tsx', code: `import { Skeleton } from '@jfrader/ui';

<>
  <Skeleton.Morph value="loading" loadingLabel="Loading profile">
    <Skeleton.Block lines={2}>Morgan Lee</Skeleton.Block>
  </Skeleton.Morph>
  <Skeleton.Morph value="ready" loadingLabel="Loading profile">
    <Skeleton.Block lines={2}>Morgan Lee</Skeleton.Block>
  </Skeleton.Morph>
</>` } } },
  render: () => (
    <>
      <Skeleton.Morph value="loading" loadingLabel="Loading profile">
        <Skeleton.Block lines={2}>Morgan Lee</Skeleton.Block>
      </Skeleton.Morph>
      <Skeleton.Morph value="ready" loadingLabel="Loading profile">
        <Skeleton.Block lines={2}>Morgan Lee</Skeleton.Block>
      </Skeleton.Morph>
    </>
  ),
};
