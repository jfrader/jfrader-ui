import { Flex } from '../flex';
import { Divider } from '../divider';
import { Button } from '../button';
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
  maxInlineSize: '100%',
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
      sections: [
        { title: 'Spacing', stories: ['Default', 'GapSteps'] },
        { title: 'Direction', stories: ['NestedLayouts'] },
        { title: 'Dividers', stories: ['WithDividers'] },
        { title: 'Composition', stories: ['Align'] },
      ],
      description: {
        component: 'Arrange items in a column and set the space between them.',
      },
      usage: `### When to use
Space content vertically without adding margins to individual children. Use Flex for horizontal or inline groups.

### Layout

Spacing applies between children, not outside the group. Insert separators as children when content needs a visible boundary.

### Keyboard and accessibility

Stack adds no landmark or heading semantics. Keep content in reading order and choose semantic elements for each section.`,
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
  name: 'Vertical spacing',
  parameters: {
    docs: {
      description: {
        story: 'Arrange three items in a column with the default spacing.',
      },
      source: {
        language: 'tsx',
        code: `import { Stack, styled } from '@jfrader/ui';
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

<Stack>
  <LayoutItems />
</Stack>;`,
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story: 'Compare children that stretch with children aligned to an edge or the center.',
      },
      source: {
        language: 'tsx',
        code: `import { Stack, styled } from '@jfrader/ui';
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
  {(['start', 'center', 'end', 'stretch'] as const).map((align) => (
    <Stack key={align} align={align}>
      <LayoutItems count={2} />
    </Stack>
  ))}
</>;`,
      },
    },
  },
  name: 'Content alignment',
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
  parameters: {
    docs: {
      description: { story: 'Compare the available gaps between two items.' },
      source: {
        language: 'tsx',
        code: `import { Stack, styled } from '@jfrader/ui';
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
    <Stack key={gap} gap={gap}>
      <LayoutItems count={2} />
    </Stack>
  ))}
</>;`,
      },
    },
  },
  name: 'Spacing steps',
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

export const NestedLayouts: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Group horizontal actions inside a vertical layout.',
      },
      source: {
        language: 'tsx',
        code: `import { Stack, Flex, Button, styled } from '@jfrader/ui';
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

<Stack>
  <ItemSurface>Workspace</ItemSurface>
  <Flex gap="sm">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </Flex>
</Stack>;`,
      },
    },
  },
  name: 'Rows within a column',
  render: () => (
    <Stack>
      <Box>Workspace</Box>
      <Flex gap="sm">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </Flex>
    </Stack>
  ),
};

export const WithDividers: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Insert a divider between two vertically spaced sections.',
      },
      source: {
        language: 'tsx',
        code: `import { Stack, Divider, styled } from '@jfrader/ui';
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

<Stack>
  <ItemSurface>Account</ItemSurface>
  <Divider />
  <ItemSurface>Sessions</ItemSurface>
</Stack>;`,
      },
    },
  },
  name: 'Separated content',
  render: () => (
    <Stack>
      <Box>Account</Box>
      <Divider />
      <Box>Sessions</Box>
    </Stack>
  ),
};
