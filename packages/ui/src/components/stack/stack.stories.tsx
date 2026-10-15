import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { LAYOUT_SPACES, LAYOUT_SPACE_TOKEN, type LayoutSpace } from '../../styling/layout-style';
import { withLightTheme } from '../../testing/story-decorators';
import { Stack, type StackAlign } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const ALIGNS = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
} as const satisfies Record<StackAlign, string>;

const gapPx = (space: LayoutSpace) => (space === 'none' ? '0px' : base.space[LAYOUT_SPACE_TOKEN[space]]);

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[6],
  inlineSize: '360px',
});

const Box = styled.div({
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const meta = {
  title: 'Layout/Stack',
  component: Stack,
  parameters: {
    docs: {
      description: { component: 'Arrange items in a column and set the space between them.' },
    },
  },
  argTypes: {
    align: { control: 'select', options: Object.keys(ALIGNS) },
    gap: { control: 'select', options: LAYOUT_SPACES },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof Stack>;

export default meta;

type Story = StoryObj<typeof meta>;

function Boxes({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} data-box>
          Item {index + 1}
        </Box>
      ))}
    </>
  );
}
Boxes.displayName = 'Boxes';

function getStacks(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="stack"]'));
}

function getBoxes(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-box]'));
}

export const Default: Story = {
  render: (args) => (
    <Stack {...args}>
      <Boxes />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const [stack] = getStacks(canvasElement);
    const style = getComputedStyle(stack!);
    await expect(style.display).toBe('flex');
    await expect(style.flexDirection).toBe('column');
    await expect(style.alignItems).toBe('stretch');
    await expect(style.rowGap).toBe(gapPx('md'));
    await expect(stack).not.toHaveAttribute('role');

    const stackWidth = stack!.getBoundingClientRect().width;
    const [first, second] = getBoxes(stack!);
    await expect(first!.getBoundingClientRect().width).toBe(stackWidth);
    const distance = second!.getBoundingClientRect().top - first!.getBoundingClientRect().bottom;
    await expect(distance).toBeCloseTo(parseFloat(gapPx('md')), 0);
  },
};

export const Align: Story = {
  render: (args) => (
    <>
      {(Object.keys(ALIGNS) as StackAlign[]).map((align) => (
        <Stack {...args} key={align} align={align} data-align={align}>
          <Boxes count={2} />
        </Stack>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const [align, expected] of Object.entries(ALIGNS)) {
      const stack = canvasElement.querySelector<HTMLElement>(`[data-align="${align}"]`)!;
      await expect(getComputedStyle(stack).alignItems).toBe(expected);
      const [first] = getBoxes(stack);
      const fills = first!.getBoundingClientRect().width === stack.getBoundingClientRect().width;
      await expect(fills).toBe(align === 'stretch');
    }
  },
};

export const GapSteps: Story = {
  render: (args) => (
    <>
      {LAYOUT_SPACES.map((gap) => (
        <Stack {...args} key={gap} gap={gap} data-gap={gap}>
          <Boxes count={2} />
        </Stack>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const gap of LAYOUT_SPACES) {
      const stack = canvasElement.querySelector<HTMLElement>(`[data-gap="${gap}"]`)!;
      await expect(getComputedStyle(stack).rowGap).toBe(gapPx(gap));
      const [first, second] = getBoxes(stack);
      const distance = second!.getBoundingClientRect().top - first!.getBoundingClientRect().bottom;
      await expect(distance).toBeCloseTo(parseFloat(gapPx(gap)), 0);
    }
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <>
      <Stack {...args}>
        <Boxes />
      </Stack>
      <Stack {...args} align="start" gap="sm">
        <Boxes />
      </Stack>
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(getStacks(canvasElement)).toHaveLength(2);
  },
};
