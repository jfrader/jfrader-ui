import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { LAYOUT_SPACES, LAYOUT_SPACE_TOKEN, type LayoutSpace } from '../../styling/layout-style';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Flex } from '../flex';
import { Stack } from '../stack';
import { CONTAINER_MAX_INLINE_SIZE } from './container';
import { Container, type ContainerSize } from './index';

const SIZES = Object.keys(CONTAINER_MAX_INLINE_SIZE) as ContainerSize[];

const spacePx = (space: LayoutSpace) => (space === 'none' ? '0px' : base.space[LAYOUT_SPACE_TOKEN[space]]);

const frameStyle = css({
  display: 'grid',
  gap: vars.space[4],
  paddingBlock: vars.space[6],
});

const centeringFrameStyle = { inlineSize: '900px' } satisfies CSSProperties;

const pageStyle = {
  minBlockSize: '100vh',
  paddingBlock: vars.space[10],
  backgroundColor: vars.color.bg,
} satisfies CSSProperties;

const boxStyle = {
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
} satisfies CSSProperties;

const headingStyle = {
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize['2xl'],
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  color: vars.color.text,
} satisfies CSSProperties;

const proseStyle = {
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.md,
  lineHeight: vars.lineHeight.base,
  color: vars.color.textMuted,
} satisfies CSSProperties;

const meta = {
  title: 'Layout/Container',
  component: Container,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    paddingInline: { control: 'select', options: LAYOUT_SPACES },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Container>;

export default meta;

type Story = StoryObj<typeof meta>;

function getContainers(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="container"]'));
}

async function expectCentred(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const parent = element.parentElement!.getBoundingClientRect();
  await expect(Math.abs(rect.left - parent.left - (parent.right - rect.right))).toBeLessThanOrEqual(1);
}

export const Sizes: Story = {
  render: (args) => (
    <>
      {SIZES.map((size) => (
        <Container {...args} key={size} size={size}>
          <div style={boxStyle}>Container {size}</div>
        </Container>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const containers = getContainers(canvasElement);
    await expect(containers).toHaveLength(SIZES.length);
    for (const [index, size] of SIZES.entries()) {
      const container = containers[index]!;
      const maxInlineSize = CONTAINER_MAX_INLINE_SIZE[size];
      await expect(container).toHaveAttribute('data-size', size);
      await expect(getComputedStyle(container).maxInlineSize).toBe(maxInlineSize);
      const parentWidth = container.parentElement!.getBoundingClientRect().width;
      await expect(container.getBoundingClientRect().width).toBeCloseTo(
        Math.min(parentWidth, parseFloat(maxInlineSize)),
        0,
      );
      await expectCentred(container);
    }
  },
};

export const Centering: Story = {
  render: (args) => (
    <div style={centeringFrameStyle}>
      <Container {...args} size="sm">
        <div style={boxStyle}>Centered container</div>
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [container] = getContainers(canvasElement);
    const style = getComputedStyle(container!);
    await expect(style.maxInlineSize).toBe(CONTAINER_MAX_INLINE_SIZE.sm);
    await expect(parseFloat(style.marginInlineStart)).toBeGreaterThan(0);
    await expect(parseFloat(style.marginInlineEnd)).toBeGreaterThan(0);
    await expect(style.marginInlineStart).toBe(style.marginInlineEnd);
  },
};

export const Padding: Story = {
  render: (args) => (
    <>
      <Container {...args} data-padding="default">
        <div style={boxStyle}>Default padding</div>
      </Container>
      {LAYOUT_SPACES.map((space) => (
        <Container {...args} key={space} paddingInline={space} data-padding={space}>
          <div style={boxStyle}>Padding {space}</div>
        </Container>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const expectPaddingInline = async (key: string, space: LayoutSpace) => {
      const style = getComputedStyle(canvasElement.querySelector<HTMLElement>(`[data-padding="${key}"]`)!);
      await expect(style.paddingInlineStart).toBe(spacePx(space));
      await expect(style.paddingInlineEnd).toBe(spacePx(space));
    };
    await expectPaddingInline('default', 'md');
    for (const space of LAYOUT_SPACES) {
      await expectPaddingInline(space, space);
    }
  },
};

function Page() {
  return (
    <div style={pageStyle}>
      <Container size="sm">
        <Stack gap="lg">
          <h2 style={headingStyle}>Workspace settings</h2>
          <p style={proseStyle}>Rename the workspace or move it to another team.</p>
          <Flex gap="sm" justify="end">
            <Button variant="outline">Cancel</Button>
            <Button tone="accent">Save</Button>
          </Flex>
        </Stack>
      </Container>
    </div>
  );
}
Page.displayName = 'Page';

export const CenteredPage: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Container size="sm">
  <Stack gap="lg">
    <h2>Workspace settings</h2>
    <p>Rename the workspace or move it to another team.</p>
    <Flex gap="sm" justify="end">
      <Button variant="outline">Cancel</Button>
      <Button tone="accent">Save</Button>
    </Flex>
  </Stack>
</Container>`,
      },
    },
  },
  render: () => <Page />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [container] = getContainers(canvasElement);
    await expectCentred(container!);
    const stack = container!.querySelector<HTMLElement>('[data-ui="stack"]')!;
    await expect(stack.parentElement).toBe(container);
    await expect(getComputedStyle(stack).rowGap).toBe(spacePx('lg'));
    await expect(canvas.getByRole('heading', { level: 2, name: 'Workspace settings' })).toBeVisible();

    const save = canvas.getByRole('button', { name: 'Save' });
    const cancel = canvas.getByRole('button', { name: 'Cancel' });
    // justify="end" pushes the actions to the inline end (the right edge in LTR).
    await expect(save.getBoundingClientRect().right).toBeCloseTo(stack.getBoundingClientRect().right, 0);
    await expect(save.getBoundingClientRect().left).toBeGreaterThan(cancel.getBoundingClientRect().right);
  },
};

export const RTL: Story = {
  render: (args) => (
    <div dir="rtl">
      <Container {...args} size="sm" paddingInline="lg">
        <Flex gap="md">
          <div style={boxStyle} data-box>
            Item 1
          </div>
          <div style={boxStyle} data-box>
            Item 2
          </div>
        </Flex>
      </Container>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [container] = getContainers(canvasElement);
    const style = getComputedStyle(container!);
    await expect(style.direction).toBe('rtl');
    await expect(style.paddingInlineStart).toBe(spacePx('lg'));
    await expect(style.paddingInlineEnd).toBe(spacePx('lg'));
    await expect(style.paddingLeft).toBe(style.paddingRight);
    await expectCentred(container!);

    const flex = container!.querySelector<HTMLElement>('[data-ui="flex"]')!;
    await expect(getComputedStyle(flex).columnGap).toBe(spacePx('md'));
    // A row follows the writing direction: the first item sits on the right.
    const [first, second] = Array.from(flex.querySelectorAll<HTMLElement>('[data-box]'));
    const distance = first!.getBoundingClientRect().left - second!.getBoundingClientRect().right;
    await expect(distance).toBeCloseTo(parseFloat(spacePx('md')), 0);
  },
};

export const LightTheme: Story = {
  parameters: {
    docs: {
      source: {
        code: `<ThemeRoot theme="light">
<Container size="sm">
  <Stack gap="lg">
    <h2>Workspace settings</h2>
    <p>Rename the workspace or move it to another team.</p>
    <Flex gap="sm" justify="end">
      <Button variant="outline">Cancel</Button>
      <Button tone="accent">Save</Button>
    </Flex>
  </Stack>
</Container>
</ThemeRoot>`,
      },
    },
  },
  decorators: [withLightTheme],
  render: () => <Page />,
  play: async ({ canvasElement }) => {
    await expect(getContainers(canvasElement)).toHaveLength(1);
  },
};
