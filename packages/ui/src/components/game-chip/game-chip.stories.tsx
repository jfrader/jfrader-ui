import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { GameChip } from '@jfrader/ui/game-chip';
import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import { GameCard } from '@jfrader/ui/game-card';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Flex } from '@jfrader/ui/flex';
import { withLightTheme } from '../../testing/story-decorators';
import { withChipStage } from './chip-showcase';

const meta = {
  title: 'Games/GameChip', component: GameChip, tags: ['autodocs'],
  decorators: [withChipStage],
  args: { value: 1000, locale: 'en-US' },
  parameters: { docs: {
    description: { component: 'Show a casino chip with a printed denomination.' },
    usage: 'The chip is a noninteractive image. Supply a label for custom artwork, and use the same locale on server and client. Values are nonnegative major units.',
    sections: [{ title: 'Chips and cards', stories: ['ChipStackCard'] }, { title: 'Denominations', stories: ['Default'] }, { title: 'Material and scale', stories: ['Sizes', 'Finishes', 'Monogram', 'Dimmed', 'Currency', 'Light'] }],
  } },
} satisfies Meta<typeof GameChip>;
export default meta;
type Story = StoryObj<typeof meta>;

const ScaleRows = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[8], color: vars.color.chipWhite });
const ScaleRow = styled.div({ display: 'flex', gap: vars.space[2], alignItems: 'center', '&[data-closeup]': { transform: 'scale(3)', transformOrigin: 'center', marginBlock: vars.space[12] }, '@media (max-width: 360px)': { gap: 0 } });
export const ChipStackCard: Story = {
  name: 'Chip, stack, card',
  render: () => <ScaleRows>
    <span>Table scale</span>
    <ScaleRow><GameChip value={25} size="sm" /><GameChipStack chips={[{ value: 25, count: 4 }]} size="sm" /><GameCard size="sm" value={{ suit: 'spades', rank: 'A' }} label="Ace of spades" /></ScaleRow>
    <span>3x</span>
    <ScaleRow data-closeup><GameChip value={25} size="sm" /><GameChipStack chips={[{ value: 25, count: 4 }]} size="sm" /><GameCard size="sm" value={{ suit: 'spades', rank: 'A' }} label="Ace of spades" /></ScaleRow>
  </ScaleRows>,
  parameters: { docs: { source: { code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameChip } from '@jfrader/ui/game-chip';
import { GameChipStack } from '@jfrader/ui/game-chip-stack';
import { GameCard } from '@jfrader/ui/game-card';

const Rows = styled.div({ display: 'grid', justifyItems: 'center', gap: vars.space[8], color: vars.color.chipWhite });
const Row = styled.div({ display: 'flex', gap: vars.space[2], alignItems: 'center', '&[data-closeup]': { transform: 'scale(3)', transformOrigin: 'center', marginBlock: vars.space[12] }, '@media (max-width: 360px)': { gap: 0 } });
<Rows>
  <span>Table scale</span>
  <Row><GameChip value={25} size="sm" /><GameChipStack chips={[{ value: 25, count: 4 }]} size="sm" /><GameCard size="sm" value={{ suit: 'spades', rank: 'A' }} label="Ace of spades" /></Row>
  <span>3x</span>
  <Row data-closeup><GameChip value={25} size="sm" /><GameChipStack chips={[{ value: 25, count: 4 }]} size="sm" /><GameCard size="sm" value={{ suit: 'spades', rank: 'A' }} label="Ace of spades" /></Row>
</Rows>` } } },
};

export const Default: Story = {
  name: 'Denominations',
  render: () => <Flex gap="lg" wrap align="center" justify="center">
    <GameChip value={1} size="xl" /><GameChip value={5} size="xl" /><GameChip value={25} size="xl" />
    <GameChip value={100} size="xl" /><GameChip value={500} size="xl" /><GameChip value={1000} size="xl" locale="en-US" />
  </Flex>,
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="lg" wrap align="center" justify="center">
  <GameChip value={1} size="xl" />
  <GameChip value={5} size="xl" />
  <GameChip value={25} size="xl" />
  <GameChip value={100} size="xl" />
  <GameChip value={500} size="xl" />
  <GameChip value={1000} size="xl" locale="en-US" />
</Flex>` } } },
  play: async ({ canvas }) => {
    const chip = canvas.getByRole('img', { name: '1,000' });
    await expect(chip).toHaveTextContent('1K');
    await expect(canvas.getAllByRole('img')).toHaveLength(6);
    for (const [index, tone] of ['white', 'red', 'green', 'black', 'purple', 'gold'].entries()) {
      await expect(canvas.getAllByRole('img')[index]).toHaveAttribute('data-tone', tone);
    }
  },
};
export const Sizes: Story = {
  render: (args) => <Flex gap="md" align="center"><GameChip {...args} size="sm" /><GameChip {...args} size="md" /><GameChip {...args} size="lg" /><GameChip {...args} size="xl" /></Flex>,
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="md" align="center">
  <GameChip value={1000} size="sm" locale="en-US" />
  <GameChip value={1000} size="md" locale="en-US" />
  <GameChip value={1000} size="lg" locale="en-US" />
  <GameChip value={1000} size="xl" locale="en-US" />
</Flex>` } } },
  play: async ({ canvas }) => {
    for (const [index, diameter] of [20, 32, 48, 64].entries()) {
      const box = canvas.getAllByRole('img')[index]!.getBoundingClientRect();
      await expect(box.width).toBe(diameter);
      await expect(box.height).toBe(diameter);
    }
  },
};
export const Finishes: Story = {
  render: (args) => <Flex gap="md"><GameChip {...args} size="xl" finish="clay" /><GameChip {...args} size="xl" finish="metal" /></Flex>,
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="md">
  <GameChip value={1000} size="xl" finish="clay" locale="en-US" />
  <GameChip value={1000} size="xl" finish="metal" locale="en-US" />
</Flex>` } } },
  play: async ({ canvas }) => {
    const chips = canvas.getAllByRole('img');
    await expect(chips[0]).toHaveAttribute('data-finish', 'clay');
    await expect(chips[1]).toHaveAttribute('data-finish', 'metal');
    await expect(getComputedStyle(chips[0]!, '::after').backgroundImage).not.toBe(getComputedStyle(chips[1]!, '::after').backgroundImage);
  },
};
export const Dimmed: Story = {
  args: { dimmed: true, size: 'xl', label: 'Small blind' },
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';

<GameChip value={1000} size="xl" dimmed label="Small blind" locale="en-US" />` } } },
  play: async ({ canvas }) => { await expect(canvas.getByRole('img', { name: 'Small blind' })).toHaveAttribute('data-dimmed', 'true'); },
};
export const Monogram: Story = {
  args: { children: 'JF', label: 'House chip', size: 'xl' },
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';

<GameChip value={1000} size="xl" label="House chip">JF</GameChip>` } } },
  play: async ({ canvas }) => {
    const chip = canvas.getByRole('img', { name: 'House chip' });
    await expect(chip).toHaveTextContent('JF');
    await expect(chip).not.toHaveTextContent('1K');
  },
};
export const Light: Story = {
  ...Default, name: 'Light', globals: { theme: 'light' }, decorators: [withLightTheme],
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="lg" wrap align="center" justify="center">
  <GameChip value={1} size="xl" />
  <GameChip value={5} size="xl" />
  <GameChip value={25} size="xl" />
  <GameChip value={100} size="xl" />
  <GameChip value={500} size="xl" />
  <GameChip value={1000} size="xl" locale="en-US" />
</Flex>` } } },
};
function Replacement(props: ComponentPropsWithRef<'span'>) { return <span {...props} data-replacement="true" />; }
export const ReplacementSlots: Story = {
  tags: ['!autodocs'], args: { slots: { root: Replacement, face: Replacement },
    ref: (node) => { node?.setAttribute('data-ref-target', 'root'); },
    slotProps: { face: { ref: (node) => { node?.setAttribute('data-ref-target', 'face'); } } } },
  play: async ({ canvas }) => {
    const chip = canvas.getByRole('img', { name: '1,000' });
    await expect(chip.tagName).toBe('SPAN');
    await expect(chip).toHaveAttribute('data-replacement', 'true');
    await expect(chip).toHaveAttribute('data-ref-target', 'root');
    await expect(chip.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    await expect(chip.firstElementChild).toHaveAttribute('data-replacement', 'true');
    await expect(chip.firstElementChild).toHaveAttribute('data-ref-target', 'face');
    await expect(chip.getBoundingClientRect().width).toBe(32);
  },
};
export const Currency: Story = {
  args: { value: 1250, currency: 'USD', locale: 'en-US', size: 'xl' },
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';

<GameChip value={1250} size="xl" locale="en-US" currency="USD" />` } } },
  play: async ({ canvas }) => {
    const full = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(1250);
    const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(1250);
    await expect(canvas.getByRole('img', { name: full }).textContent).toBe(compact);
  },
};
export const ZeroContent: Story = {
  tags: ['!autodocs'], args: { value: 25, children: 0 },
  play: async ({ canvas }) => { await expect(canvas.getByRole('img', { name: '25' })).toHaveTextContent(/^0$/); },
};
export const EmptyLabel: Story = {
  tags: ['!autodocs'], args: { label: '' },
  play: async ({ canvas }) => { await expect(canvas.getByRole('img', { name: '1,000' })).toBeVisible(); },
};
export const TextZoom: Story = {
  tags: ['!autodocs'],
  render: () => <Flex gap="lg" align="center" wrap>
    <GameChip value={100} size="md" locale="en-US" />
    <GameChip value={1250} size="xl" currency="USD" locale="en-US" />
  </Flex>,
  play: async ({ canvasElement }) => {
    await canvasElement.ownerDocument.fonts.ready;
    for (const chip of canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-chip"]')) {
      const face = chip.querySelector<HTMLElement>('[data-ui="game-chip-face"]')!;
      const range = chip.ownerDocument.createRange();
      range.selectNodeContents(face);
      const normalInk = range.getBoundingClientRect();
      const faceBox = face.getBoundingClientRect();
      await expect(normalInk.width).toBeLessThanOrEqual(faceBox.width);
      await expect(normalInk.height).toBeLessThanOrEqual(faceBox.height);
      const normalFont = Number.parseFloat(getComputedStyle(chip).fontSize);
      chip.style.fontSize = `${normalFont * 2}px`;
      await expect(Number.parseFloat(getComputedStyle(face).fontSize)).toBeCloseTo(normalFont * 2);
      await expect(getComputedStyle(face).overflowX).toBe('visible');
      await expect(getComputedStyle(face).overflowY).toBe('visible');
      await expect(getComputedStyle(chip).overflowX).toBe('visible');
      await expect(getComputedStyle(chip).overflowY).toBe('visible');
      await expect(range.getBoundingClientRect().width).toBeGreaterThan(faceBox.width);
      await expect(range.getBoundingClientRect().width).toBeCloseTo(normalInk.width * 2, 0);
      const enlargedInk = range.getBoundingClientRect();
      await expect((enlargedInk.left + enlargedInk.right) / 2).toBeCloseTo((faceBox.left + faceBox.right) / 2, 0);
    }
  },
};
