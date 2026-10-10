import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { LAYOUT_SPACES, LAYOUT_SPACE_TOKEN, type LayoutSpace } from '../../styling/layout-style';
import { withLightTheme } from '../../testing/story-decorators';
import { Flex, type FlexAlign, type FlexJustify } from './index';

const ALIGNS = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  baseline: 'baseline',
  stretch: 'stretch',
} as const satisfies Record<FlexAlign, string>;

const JUSTIFIES = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
} as const satisfies Record<FlexJustify, string>;

const gapPx = (space: LayoutSpace) => (space === 'none' ? '0px' : base.space[LAYOUT_SPACE_TOKEN[space]]);

const frameStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
});

const narrowStyle = { inlineSize: '160px' } satisfies CSSProperties;

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

const proseStyle = {
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
} satisfies CSSProperties;

const meta = {
  title: 'Layout/Flex',
  component: Flex,
  args: { gap: 'sm' },
  argTypes: {
    direction: { control: 'radio', options: ['row', 'column'] },
    align: { control: 'select', options: Object.keys(ALIGNS) },
    justify: { control: 'select', options: Object.keys(JUSTIFIES) },
    gap: { control: 'select', options: LAYOUT_SPACES },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Flex>;

export default meta;

type Story = StoryObj<typeof meta>;

function Boxes({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={boxStyle} data-box>
          Item {index + 1}
        </div>
      ))}
    </>
  );
}
Boxes.displayName = 'Boxes';

function getFlexes(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="flex"]'));
}

function getBoxes(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-box]'));
}

export const Default: Story = {
  args: { gap: undefined },
  render: (args) => (
    <Flex {...args}>
      <Boxes />
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const [flex] = getFlexes(canvasElement);
    const style = getComputedStyle(flex!);
    await expect(style.display).toBe('flex');
    await expect(style.flexDirection).toBe('row');
    await expect(style.flexWrap).toBe('nowrap');
    await expect(style.alignItems).toBe('stretch');
    await expect(style.justifyContent).toBe('flex-start');
    await expect(style.gap).toBe('0px');
    await expect(flex).not.toHaveAttribute('role');
    const [first, second] = getBoxes(flex!);
    await expect(second!.getBoundingClientRect().left).toBeCloseTo(first!.getBoundingClientRect().right, 0);
  },
};

export const Direction: Story = {
  render: (args) => (
    <>
      <Flex {...args} direction="row">
        <Boxes />
      </Flex>
      <Flex {...args} direction="column">
        <Boxes />
      </Flex>
    </>
  ),
  play: async ({ canvasElement }) => {
    const [row, column] = getFlexes(canvasElement);
    await expect(getComputedStyle(row!).flexDirection).toBe('row');
    await expect(getComputedStyle(column!).flexDirection).toBe('column');
    const [first, second] = getBoxes(column!);
    await expect(second!.getBoundingClientRect().top).toBeGreaterThan(first!.getBoundingClientRect().bottom);
  },
};

export const AlignAndJustify: Story = {
  render: (args) => (
    <>
      {(Object.keys(ALIGNS) as FlexAlign[]).map((align) => (
        <Flex {...args} key={align} align={align} data-align={align}>
          <Boxes count={2} />
        </Flex>
      ))}
      {(Object.keys(JUSTIFIES) as FlexJustify[]).map((justify) => (
        <Flex {...args} key={justify} justify={justify} data-justify={justify}>
          <Boxes count={2} />
        </Flex>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const [align, expected] of Object.entries(ALIGNS)) {
      const flex = canvasElement.querySelector<HTMLElement>(`[data-align="${align}"]`)!;
      await expect(getComputedStyle(flex).alignItems).toBe(expected);
    }
    for (const [justify, expected] of Object.entries(JUSTIFIES)) {
      const flex = canvasElement.querySelector<HTMLElement>(`[data-justify="${justify}"]`)!;
      await expect(getComputedStyle(flex).justifyContent).toBe(expected);
    }
  },
};

export const Wrap: Story = {
  render: (args) => (
    <div style={narrowStyle}>
      <Flex {...args} wrap>
        <Boxes count={4} />
      </Flex>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [flex] = getFlexes(canvasElement);
    await expect(getComputedStyle(flex!).flexWrap).toBe('wrap');
    const boxes = getBoxes(flex!);
    const firstTop = boxes[0]!.getBoundingClientRect().top;
    await expect(boxes[boxes.length - 1]!.getBoundingClientRect().top).toBeGreaterThan(firstTop);
  },
};

export const GapSteps: Story = {
  render: (args) => (
    <>
      {LAYOUT_SPACES.map((gap) => (
        <Flex {...args} key={gap} gap={gap} data-gap={gap}>
          <Boxes count={2} />
        </Flex>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const gap of LAYOUT_SPACES) {
      const flex = canvasElement.querySelector<HTMLElement>(`[data-gap="${gap}"]`)!;
      const style = getComputedStyle(flex);
      await expect(style.columnGap).toBe(gapPx(gap));
      await expect(style.rowGap).toBe(gapPx(gap));
      const [first, second] = getBoxes(flex);
      const distance = second!.getBoundingClientRect().left - first!.getBoundingClientRect().right;
      await expect(distance).toBeCloseTo(parseFloat(gapPx(gap)), 0);
    }
  },
};

export const Inline: Story = {
  args: { gap: 'xs' },
  render: (args) => (
    <div style={proseStyle}>
      Assigned to{' '}
      <Flex {...args} inline align="baseline">
        <span>Ana</span>
        <span>Leo</span>
      </Flex>{' '}
      this week.
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [flex] = getFlexes(canvasElement);
    await expect(getComputedStyle(flex!).display).toBe('inline-flex');
    const line = flex!.parentElement!;
    await expect(flex!.getBoundingClientRect().width).toBeLessThan(line.getBoundingClientRect().width);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <>
      <Flex {...args}>
        <Boxes />
      </Flex>
      <Flex {...args} direction="column" align="start">
        <Boxes />
      </Flex>
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(getFlexes(canvasElement)).toHaveLength(2);
  },
};
