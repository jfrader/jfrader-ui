import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { GameHand, type GameHandProps } from './game-hand';

const meta = {
  title: 'Games/GameHand',
  component: GameHand,
  tags: ['!autodocs'],
  parameters: {
    docs: { description: { component: 'Keep keyboard focus while a hand is temporarily unavailable.' } },
  },
  args: {
    cards: [
      { id: 'ace', label: 'Ace of spades', value: { suit: 'spades', rank: 'A' } },
      { id: 'king', label: 'King of hearts', value: { suit: 'hearts', rank: 'K' } },
      { id: 'queen', label: 'Queen of clubs', value: { suit: 'clubs', rank: 'Q' } },
    ],
    playLabel: 'Play selected',
    onValueChange: fn(),
    onPlayIntent: fn(),
  },
} satisfies Meta<typeof GameHand>;
export default meta;
type Story = StoryObj<typeof meta>;

function TemporarilyDisabledHand({ disableOnSelection = false, ...args }: GameHandProps & { disableOnSelection?: boolean }) {
  const [disabled, setDisabled] = useState(false);
  return (
    <div onKeyDown={(event) => { if (event.key === 'Escape') setDisabled(false); }}>
      <GameHand {...args} disabled={disabled}
        onValueChange={(value) => {
          args.onValueChange?.(value);
          if (disableOnSelection) setDisabled(true);
        }}
        onPlayIntent={(card) => {
          args.onPlayIntent?.(card);
          setDisabled(true);
        }} />
    </div>
  );
}

export const ConfirmFocusDuringPlay: Story = {
  render: (args) => <TemporarilyDisabledHand {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const confirm = canvas.getByRole('button', { name: 'Play selected' });
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await expect(confirm).not.toHaveAttribute('disabled');
    await userEvent.click(confirm);
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Ace of spades' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect(confirm).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body);
    await expect(confirm).toHaveFocus();
    await expect(confirm).not.toHaveAttribute('disabled');
    await expect(getComputedStyle(confirm).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(confirm);
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    await expect(confirm).toHaveFocus();
    await expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
  },
};

export const CardFocusDuringDisable: Story = {
  render: (args) => <TemporarilyDisabledHand {...args} disableOnSelection />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const card = canvas.getByRole('button', { name: 'Ace of spades' });
    await userEvent.tab();
    await expect(card).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body);
    await expect(card).toHaveFocus();
    await expect(card).not.toHaveAttribute('disabled');
    await expect(getComputedStyle(card).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(card);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await expect(card).toHaveFocus();
    await expect(card).not.toHaveAttribute('aria-disabled', 'true');
  },
};
