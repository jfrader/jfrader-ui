import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { renderToString } from 'react-dom/server';
import { GameChipStack } from './game-chip-stack';
import { Flex } from '../flex';
import { expectInside } from '../../testing/geometry-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { withChipStage } from '../game-chip/chip-showcase';

const meta = {
  title: 'Games/GameChipStack', component: GameChipStack, tags: ['autodocs'],
  decorators: [withChipStage],
  args: { chips: [{ value: 5, count: 5 }], locale: 'en-US', size: 'xl' },
  parameters: { docs: {
    description: { component: 'Show blinds, bets, and pots as towers of casino chips.' },
    usage: 'The stack is decorative unless you supply a label. Put the real total in the surrounding pot or seat text, or in the image label, even when the visible chips are capped. Counts are nonnegative safe integers. Empty stacks render nothing.',
    sections: [{ title: 'Bets and pots', stories: ['Pot', 'BetLine', 'StackHeights', 'Capped'] }, { title: 'View and scale', stories: ['Flat', 'Sizes', 'Light'] }],
  } },
} satisfies Meta<typeof GameChipStack>;
export default meta;
type Story = StoryObj<typeof meta>;
async function geometryCheck(root: Element) {
  for (const tower of root.querySelectorAll('[data-ui="game-chip-stack-stack"]')) {
    await expectInside(tower, root);
    for (const chip of tower.querySelectorAll('[data-ui="game-chip"]')) await expectInside(chip, tower);
    const bands = tower.querySelectorAll<HTMLElement>('[data-ui="game-chip-stack-band"]');
    if (tower.getAttribute('data-flat') !== 'true') {
      await expect(bands).toHaveLength(Number(tower.getAttribute('data-visible')));
      await expect(tower.querySelectorAll('[data-ui="game-chip"]')).toHaveLength(1);
      const chip = tower.querySelector<HTMLElement>('[data-ui="game-chip"]')!;
      await expect(getComputedStyle(chip).overflow).toBe('visible');
      await expect(getComputedStyle(chip.querySelector('[data-ui="game-chip-face"]')!).overflow).toBe('visible');
      await expect(chip.getBoundingClientRect().height).toBeCloseTo(chip.getBoundingClientRect().width * 0.58, 0);
    }
    for (const band of bands) {
      await expectInside(band.querySelector('svg')!, tower);
      await expect(band.getBoundingClientRect().height).toBeCloseTo(Number.parseFloat(getComputedStyle(tower).getPropertyValue('--tower-diameter')) * 0.18, 1);
    }
  }
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
}
export const Pot: Story = {
  args: { chips: [{ value: 5, count: 3 }, { value: 100, count: 2 }, { value: 25, count: 4 }, { value: 500, count: 0 }], label: 'Pot 315' },
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import type { GameChipStackChip } from '@jfrader/ui/game-chip-stack';
import type { GameChipTone } from '@jfrader/ui/game-chip';

const tone: GameChipTone = 'black';
const chips: GameChipStackChip[] = [{ value: 100, count: 2, tone }, { value: 25, count: 4 }, { value: 5, count: 3 }];
<GameChipStack chips={chips} size="xl" label="Pot 315" locale="en-US" />` } } },
  play: async ({ canvas }) => {
    const root = canvas.getByRole('img', { name: 'Pot 315' });
    await expect(canvas.getAllByRole('img')).toHaveLength(1);
    const towers = root.querySelectorAll('[data-ui="game-chip-stack-stack"]');
    await expect(towers).toHaveLength(3);
    await expect([...towers].map((tower) => tower.getAttribute('data-value'))).toEqual(['100', '25', '5']);
    await geometryCheck(root);
  },
};
export const Capped: Story = {
  args: { chips: [{ value: 100, count: 50 }], maxVisible: 6, label: 'Pot 5,000', size: 'xl' },
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import type { GameChipSize } from '@jfrader/ui/game-chip';

const size: GameChipSize = 'xl';
<GameChipStack chips={[{ value: 100, count: 50 }]} maxVisible={6} label="Pot 5,000" size={size} locale="en-US" />` } } },
  play: async ({ canvas }) => {
    const root = canvas.getByRole('img', { name: 'Pot 5,000' });
    await expect(root.querySelectorAll('[data-ui="game-chip"]')).toHaveLength(1);
    await expect(root.querySelectorAll('[data-ui="game-chip-stack-band"]')).toHaveLength(6);
    await expect(root.firstElementChild).toHaveAttribute('data-count', '50');
    await geometryCheck(root);
  },
};
export const Flat: Story = {
  args: { flat: true },
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import type { GameChipSize } from '@jfrader/ui/game-chip';

const size: GameChipSize = 'xl';
<GameChipStack chips={[{ value: 5, count: 5 }]} flat size={size} locale="en-US" />` } } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="game-chip-stack"]')!;
    await geometryCheck(root);
    for (const position of root.querySelectorAll('[data-ui="game-chip-stack-position"]')) {
      await expect(getComputedStyle(position).transform).toMatch(/^matrix\(/);
    }
  },
};
export const Sizes: Story = {
  render: (args) => <Flex gap="lg" align="end" justify="center" wrap><GameChipStack {...args} size="sm" /><GameChipStack {...args} size="md" /><GameChipStack {...args} size="lg" /><GameChipStack {...args} size="xl" /></Flex>,
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import type { GameChipSize } from '@jfrader/ui/game-chip';
import { Flex } from '@jfrader/ui/flex';

const sizes: GameChipSize[] = ['sm', 'md', 'lg', 'xl'];
<Flex gap="lg" align="end" justify="center" wrap>
  {sizes.map(size => <GameChipStack key={size} chips={[{ value: 5, count: 5 }]} size={size} locale="en-US" />)}
</Flex>` } } },
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll('[data-ui="game-chip-stack"]')) await geometryCheck(root);
  },
};
export const Light: Story = {
  ...Pot, globals: { theme: 'light' }, decorators: [withLightTheme],
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import type { GameChipTone } from '@jfrader/ui/game-chip';

const tone: GameChipTone = 'black';
<GameChipStack chips={[{ value: 100, count: 2, tone }, { value: 25, count: 4 }, { value: 5, count: 3 }]} size="xl" label="Pot 315" locale="en-US" />` } } },
};
export const BetLine: Story = {
  render: () => <Flex gap="xl" align="end" justify="center" wrap>
    <GameChipStack chips={[{ value: 5, count: 2 }]} size="xl" label="Small blind 10" locale="en-US" />
    <GameChipStack chips={[{ value: 5, count: 4 }]} size="xl" label="Big blind 20" locale="en-US" />
    <GameChipStack chips={[{ value: 5, count: 12 }]} maxVisible={12} size="xl" label="Call 60" locale="en-US" />
  </Flex>,
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="xl" align="end" justify="center" wrap>
  <GameChipStack chips={[{ value: 5, count: 2 }]} size="xl" label="Small blind 10" locale="en-US" />
  <GameChipStack chips={[{ value: 5, count: 4 }]} size="xl" label="Big blind 20" locale="en-US" />
  <GameChipStack chips={[{ value: 5, count: 12 }]} maxVisible={12} size="xl" label="Call 60" locale="en-US" />
</Flex>` } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('img')).toHaveLength(3);
    for (const root of canvasElement.querySelectorAll('[data-ui="game-chip-stack"]')) await geometryCheck(root);
  },
};
export const StackHeights: Story = {
  render: () => <Flex gap="lg" align="end" justify="center" wrap>
    {[1, 2, 5, 10, 25].map(count => <GameChipStack key={count} chips={[{ value: 25, count }]} size="xl" maxVisible={25} locale="en-US" />)}
  </Flex>,
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="lg" align="end" justify="center" wrap>
  {[1, 2, 5, 10, 25].map(count => (
    <GameChipStack key={count} chips={[{ value: 25, count }]} size="xl" maxVisible={25} locale="en-US" />
  ))}
</Flex>` } } },
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll('[data-ui="game-chip-stack"]')) await geometryCheck(root);
  },
};
export const Empty: Story = {
  tags: ['!autodocs'], args: { chips: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="game-chip-stack"]')).toBeNull();
    await expect(renderToString(<GameChipStack chips={[]} />)).toBe('');
    await expect(renderToString(<GameChipStack chips={[{ value: 5, count: 0 }]} />)).toBe('');
    for (const count of [-1, 1.5, NaN, Infinity]) {
      await expect(() => renderToString(<GameChipStack chips={[{ value: 5, count }]} />)).toThrow(RangeError);
    }
    for (const maxVisible of [0, -1, 1.5, Infinity]) {
      await expect(() => renderToString(<GameChipStack chips={[{ value: 5, count: 1 }]} maxVisible={maxVisible} />)).toThrow(RangeError);
    }
  },
};
export const Default: Story = {
  tags: ['!autodocs'],
  parameters: { docs: { source: { code: `import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import type { GameChipSize } from '@jfrader/ui/game-chip';

const size: GameChipSize = 'xl';
<GameChipStack chips={[{ value: 5, count: 5 }]} size={size} locale="en-US" />` } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole('img')).toBeNull();
    const root = canvasElement.querySelector('[data-ui="game-chip-stack"]')!;
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    await geometryCheck(root);
  },
};
export const EmptyLabel: Story = {
  tags: ['!autodocs'], args: { label: '' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole('img')).toBeNull();
    const root = canvasElement.querySelector('[data-ui="game-chip-stack"]')!;
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    await expect(root).not.toHaveAttribute('aria-label');
    await expect(root).not.toHaveAttribute('role');
  },
};
export const ThickStacks: Story = {
  tags: ['!autodocs'],
  render: () => <Flex gap="xl" align="end" wrap>
    {(['md', 'xl'] as const).flatMap(size => [2, 10].map(count => <GameChipStack key={`${size}-${count}`}
      chips={[{ value: 100, count }]} size={size} data-chip-demo={`${size}-${count}`} />))}
  </Flex>,
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll('[data-ui="game-chip-stack"]')) await geometryCheck(root);
  },
};
