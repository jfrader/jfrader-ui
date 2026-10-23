import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { GameChip } from './game-chip';
import { Flex } from '../flex';
import { withLightTheme } from '../../testing/story-decorators';

const meta = {
  title: 'Games/GameChip', component: GameChip, tags: ['autodocs'],
  args: { value: 1000, locale: 'en-US' },
  parameters: { docs: {
    description: { component: 'Show a casino chip with a printed denomination.' },
    usage: 'The chip is a noninteractive image. Supply a label for custom artwork, and use the same locale on server and client. Values are nonnegative major units.',
    sections: [{ title: 'Denominations', stories: ['Default'] }, { title: 'Material and scale', stories: ['Sizes', 'Finishes', 'Dimmed', 'Monogram', 'Light'] }],
  } },
} satisfies Meta<typeof GameChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Flex gap="md" wrap align="center">
    <GameChip value={1} size="xl" /><GameChip value={5} size="xl" /><GameChip value={25} size="xl" />
    <GameChip value={100} size="xl" /><GameChip value={500} size="xl" /><GameChip value={1000} size="xl" locale="en-US" />
  </Flex>,
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="md" wrap align="center">
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
    for (const [index, diameter] of [24, 32, 48, 64].entries()) {
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
};
export const Dimmed: Story = {
  args: { dimmed: true, size: 'lg', label: 'Small blind' },
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';

<GameChip value={1000} size="lg" dimmed label="Small blind" locale="en-US" />` } } },
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
  ...Default, globals: { theme: 'light' }, decorators: [withLightTheme],
  parameters: { docs: { source: { code: `import { GameChip } from '@jfrader/ui/game-chip';
import { Flex } from '@jfrader/ui/flex';

<Flex gap="md" wrap align="center">
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
  tags: ['!autodocs'], args: { value: 1250, currency: 'EUR', locale: 'de-DE' },
  play: async ({ canvas }) => {
    const full = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1250);
    const compact = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(1250);
    await expect(canvas.getByRole('img', { name: full }).textContent).toBe(compact);
  },
};
export const ZeroContent: Story = {
  tags: ['!autodocs'], args: { value: 25, children: 0 },
  play: async ({ canvas }) => { await expect(canvas.getByRole('img', { name: '25' })).toHaveTextContent(/^0$/); },
};
