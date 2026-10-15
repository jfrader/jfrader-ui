import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn } from 'storybook/test';
import { Button } from '../button';
import { FlipGameCard } from './flip-game-card';

const meta = {
  title: 'Games/FlipGameCard', component: FlipGameCard, tags: ['!autodocs'],
  args: { label: 'Ace of spades', backLabel: 'Card back', value: { suit: 'spades', rank: 'A' } },
  parameters: { docs: { description: { component: 'Flip without rotation when reduced motion is enabled.' } } },
  beforeEach: () => {
    const original = window.matchMedia.bind(window);
    const media = original('(prefers-reduced-motion)');
    Object.defineProperty(media, 'matches', { value: true });
    const spy = spyOn(window, 'matchMedia').mockImplementation((query) => query.includes('prefers-reduced-motion') ? media : original(query));
    return () => spy.mockRestore();
  },
} satisfies Meta<typeof FlipGameCard>;
export default meta;
type Story = StoryObj<typeof meta>;

function ReducedFlip() {
  const [flipped, setFlipped] = useState(false);
  return <>
    <Button onClick={() => setFlipped(!flipped)}>Flip card</Button>
    <FlipGameCard flipped={flipped} label="Ace of spades" backLabel="Card back" value={{ suit: 'spades', rank: 'A' }} />
  </>;
}

export const ReducedMotion: Story = {
  render: () => <ReducedFlip />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const rotator = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-rotator"]');
    if (!rotator) throw new Error('Missing rotator');
    await expect(getComputedStyle(rotator).transform).toBe('none');
    await userEvent.click(canvas.getByRole('button', { name: 'Flip card' }));
    await expect(rotator).toHaveAttribute('data-state', 'back');
    await expect(getComputedStyle(rotator).transitionDuration).toBe('0s');
    await expect(getComputedStyle(rotator).transform).toBe('none');
    await expect(canvas.getByRole('img', { name: 'Card back' })).toBeVisible();
    await expect(canvas.queryByRole('img', { name: 'Ace of spades' })).toBeNull();
  },
};
