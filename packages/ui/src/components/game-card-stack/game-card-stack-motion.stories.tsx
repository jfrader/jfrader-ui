import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn } from 'storybook/test';
import { GameCardStack } from './game-card-stack';

const meta = {
  title: 'Games/GameCardStack', component: GameCardStack, tags: ['!autodocs'],
  parameters: { docs: { description: { component: 'Inspect piles without motion when reduced motion is enabled.' } } },
  args: { piles: [{ playerKey: 'North', label: "North's played cards", cards: [
    { id: 'ace', label: 'Ace of spades', value: { suit: 'spades', rank: 'A' } },
    { id: 'queen', label: 'Queen of hearts', value: { suit: 'hearts', rank: 'Q' } },
    { id: 'king', label: 'King of clubs', value: { suit: 'clubs', rank: 'K' } },
  ] }] },
  decorators: [(Story) => <div style={{ inlineSize: 900, blockSize: 432 }}><Story /></div>],
  beforeEach: () => {
    const original = window.matchMedia.bind(window);
    const media = original('(prefers-reduced-motion)');
    Object.defineProperty(media, 'matches', { value: true });
    const spy = spyOn(window, 'matchMedia').mockImplementation((query) => query.includes('prefers-reduced-motion') ? media : original(query));
    return () => spy.mockRestore();
  },
} satisfies Meta<typeof GameCardStack>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReducedMotion: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-played-key]')!;
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await expect(card).toHaveAttribute('data-reduced-motion', 'true');
    await userEvent.click(trigger);
    await expect(getComputedStyle(card).transitionDuration).toBe('0s');
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
  },
};
