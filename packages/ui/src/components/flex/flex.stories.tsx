import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { LAYOUT_SPACES, LAYOUT_SPACE_TOKEN, type LayoutSpace } from '../../styling/layout-style';
import { withLightTheme } from '../../testing/story-decorators';
import { Flex, type FlexAlign, type FlexJustify } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

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

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
  maxInlineSize: '100%',
});

const Narrow = styled.div({ inlineSize: '160px' });

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

const Prose = styled.div({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const meta = {
  title: 'Layout/Flex',
  component: Flex,
  parameters: {
    docs: {
      sections: [
        { title: 'Direction', stories: ['Direction'] },
        { title: 'Wrap', stories: ['Wrap'] },
        {
          title: 'Alignment and gap',
          stories: ['AlignAndJustify', 'GapSteps'],
        },
        { title: 'Responsive', stories: ['Responsive'] },
        { title: 'Composition', stories: ['Inline'] },
      ],
      description: {
        component: 'Arrange items in a row or column and set their spacing and alignment.',
      },
      usage: `### When to use
Arrange content along one axis, or wrap a row when it runs out of room. Use Stack for a column with standard spacing.

### Responsive layout

Use media queries for changes at a breakpoint. Keep the source order meaningful: visual layout must not change the reading or keyboard order. Rows follow the inherited writing direction.`,
    },
  },
  args: { gap: 'sm' },
  argTypes: {
    direction: { control: 'radio', options: ['row', 'column'] },
    align: { control: 'select', options: Object.keys(ALIGNS) },
    justify: { control: 'select', options: Object.keys(JUSTIFIES) },
    gap: { control: 'select', options: LAYOUT_SPACES },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof Flex>;

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

function getFlexes(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="flex"]'));
}

function getBoxes(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-box]'));
}

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { Flex } from '@jfrader/ui';

const boxStyle = {
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
} satisfies CSSProperties;

<Flex>
  <div style={boxStyle}>Item 1</div>
  <div style={boxStyle}>Item 2</div>
  <div style={boxStyle}>Item 3</div>
</Flex>`,
      },
    },
  },
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
  parameters: {
    docs: {
      description: { story: 'Compare the same items along each axis.' },
      source: {
        language: 'tsx',
        code: `import { Flex, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ItemSurface = styled.div({
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

function LayoutItems({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <ItemSurface key={index}>Item {index + 1}</ItemSurface>
      ))}
    </>
  );
}

<>
  <Flex gap="sm" direction="row">
    <LayoutItems />
  </Flex>
  <Flex gap="sm" direction="column">
    <LayoutItems />
  </Flex>
</>;`,
      },
    },
  },
  name: 'Rows and columns',
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
  parameters: {
    docs: {
      description: {
        story: 'Compare cross-axis alignment and distribution along the row.',
      },
      source: {
        language: 'tsx',
        code: `import { Flex, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ItemSurface = styled.div({
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

function LayoutItems({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <ItemSurface key={index}>Item {index + 1}</ItemSurface>
      ))}
    </>
  );
}

<>
  {(['start', 'center', 'end', 'baseline', 'stretch'] as const).map((align) => (
    <Flex gap="sm" key={align} align={align}>
      <LayoutItems count={2} />
    </Flex>
  ))}
  {(['start', 'center', 'end', 'between', 'around', 'evenly'] as const).map((justify) => (
    <Flex gap="sm" key={justify} justify={justify}>
      <LayoutItems count={2} />
    </Flex>
  ))}
</>;`,
      },
    },
  },
  name: 'Item alignment',
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
  parameters: {
    docs: {
      description: {
        story: 'Let items continue on a new line inside a narrow parent.',
      },
      source: {
        language: 'tsx',
        code: `import { Flex, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Narrow = styled.div({ inlineSize: '160px' });

const ItemSurface = styled.div({
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

function LayoutItems({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <ItemSurface key={index}>Item {index + 1}</ItemSurface>
      ))}
    </>
  );
}

<Narrow>
  <Flex gap="sm" wrap>
    <LayoutItems count={4} />
  </Flex>
</Narrow>;`,
      },
    },
  },
  name: 'Wrapping rows',
  render: (args) => (
    <Narrow>
      <Flex {...args} wrap>
        <Boxes count={4} />
      </Flex>
    </Narrow>
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
  parameters: {
    docs: {
      description: { story: 'Compare the available gaps between two items.' },
      source: {
        language: 'tsx',
        code: `import { Flex, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ItemSurface = styled.div({
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

function LayoutItems({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <ItemSurface key={index}>Item {index + 1}</ItemSurface>
      ))}
    </>
  );
}

<>
  {(['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const).map((gap) => (
    <Flex key={gap} gap={gap}>
      <LayoutItems count={2} />
    </Flex>
  ))}
</>;`,
      },
    },
  },
  name: 'Spacing steps',
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
  parameters: {
    docs: {
      description: {
        story: 'Keep a group of names together within a sentence.',
      },
      source: {
        language: 'tsx',
        code: `import { Flex, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Prose = styled.div({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

<Prose>
  Assigned to{' '}
  <Flex gap="sm" inline align="baseline">
    <span>Ana</span>
    <span>Leo</span>
  </Flex>{' '}
  this week.
</Prose>;`,
      },
    },
  },
  name: 'Inline assignment',
  args: { gap: 'xs' },
  render: (args) => (
    <Prose>
      Assigned to{' '}
      <Flex {...args} inline align="baseline">
        <span>Ana</span>
        <span>Leo</span>
      </Flex>{' '}
      this week.
    </Prose>
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

export const Responsive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Switch from a column to a row when the viewport has room.',
      },
      source: {
        language: 'tsx',
        code: `import { Flex, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ItemSurface = styled.div({
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  backgroundColor: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

<Flex
  gap="sm"
  sx={{ flexDirection: 'column', '@media (min-width: 48rem)': { flexDirection: 'row' } }}
>
  <ItemSurface>Item 1</ItemSurface>
  <ItemSurface>Item 2</ItemSurface>
  <ItemSurface>Item 3</ItemSurface>
</Flex>;`,
      },
    },
  },
  name: 'Responsive direction',
  render: () => (
    <Flex
      gap="sm"
      sx={{
        flexDirection: 'column',
        '@media (min-width: 48rem)': { flexDirection: 'row' },
      }}
    >
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Flex>
  ),
};
