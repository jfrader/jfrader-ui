import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { GameHand, type GameHandCard, type GameHandProps } from './game-hand';
import { Button } from '../button';
import { ThemeRoot } from '../theme-root';
import { expectInside, expectMirrored, expectMirroredDirection, expectNoOverlap } from '../../testing/geometry-assertions';
import { buildOpponentHiddenHandLayout, DEFAULT_HIDDEN_HAND_RULES, getHandFanRotations, getOpponentSeatHandTransform } from './hand-layout';
import { HIDDEN_PARITY, PLAYER_PARITY, SEAT_PARITY } from './parity-fixtures';

const CARDS: GameHandCard[] = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
  { id: 'jack-diamonds', label: 'Jack of diamonds', value: { deck: 'french', suit: 'diamonds', rank: 'J' } },
  { id: 'ten-spades', label: 'Ten of spades', value: { deck: 'french', suit: 'spades', rank: 10 } },
];

const meta = {
  title: 'Games/GameHand', component: GameHand, tags: ['autodocs'],
  args: { cards: CARDS.slice(0, 3), playLabel: 'Play card', onValueChange: fn(), onPlayIntent: fn() },
  parameters: { docs: {
    description: { component: 'Choose a card from your hand and confirm to play it. Show opponents’ hands as card backs with GameHand.Hidden.' },
    source: {
      language: 'tsx',
      code: `import { GameHand } from '@jfrader/ui/game-hand';

<GameHand
  cards={cards}
  playLabel="Play card"
  onPlayIntent={handlePlay}
/>`,
    },
    usage: `### Setup
- Import from \`@jfrader/ui/game-hand\`. GameHand is an opt-in subpath and is not re-exported by the package root.

### Selection and keyboard
Each card is a native toggle button (APG Button pattern, aria-pressed). Tab and Shift+Tab follow card order, then the enabled confirmation action; Enter or Space selects or clears a card. Only confirmation calls onPlayIntent; there is no drag gesture.

### Values
Pass plain cards with unique stable id, value and a label in your page’s language. Keep id when reordering or removing cards; selection follows the card id in both controlled and uncontrolled hands. value/onValueChange control selection; defaultValue seeds uncontrolled selection. null clears selection. Removing the selected card disables confirmation. onPlayIntent receives the selected card, without an index.

### Geometry
size uses the GameCard scale. The reference fan turns 3 cards by −10/0/10° and 2 by −7/7°; other counts stay straight, including the five-card example. Cards overlap by 1.32 spacing steps (10.56px) at md and lg. At sm, cards do not overlap, leaving a 32px strip for pointer selection. No opening animation runs, including with reduced motion. Roots accept ref, css and sx; slotProps styles the fan, card buttons and confirmation.

### Hidden hands
GameHand.Hidden takes count, never card values; it renders 0–3 backs and needs a label naming the hand. Omit polar for a standalone fan. With polar, the root moves inward from a caller-positioned seat using the reference’s 56px avatar and 28px name block. rules and scale configure radial geometry; size controls the card width. Seat positioning belongs to the caller. slotProps.card styles each hidden-card wrapper; root styles use css and sx.`,
  } },
} satisfies Meta<typeof GameHand>;
export default meta;
type Story = StoryObj<typeof meta>;

async function checkFan(element: HTMLElement, count: number) {
  const fixture = PLAYER_PARITY.find((item) => item.count === count)!;
  await expect(getHandFanRotations(count)).toEqual(fixture.rotations);
  const fan = element.querySelector<HTMLElement>('[data-ui="game-hand-fan"]')!;
  const buttons = Array.from(fan.querySelectorAll<HTMLElement>('[data-ui="game-hand-card"]'));
  await expect(buttons).toHaveLength(count);
  for (const [index, button] of buttons.entries()) {
    const style = getComputedStyle(button);
    const faceStyle = getComputedStyle(button.querySelector('[data-ui="game-card"]')!);
    await expect(faceStyle.width).toBe(style.getPropertyValue('--game-card-width').trim());
    await expect(faceStyle.borderRadius).toBe(style.borderRadius);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const angle = fixture.rotations[index] ?? 0;
    const radians = angle * Math.PI / 180;
    const drop = angle ? fixture.dropPx : 0;
    await expect(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI).toBeCloseTo(angle, 3);
    await expect(matrix.e).toBeCloseTo(-Math.sin(radians) * drop, 3);
    await expect(matrix.f).toBeCloseTo(Math.cos(radians) * drop, 3);
    await expect(Number.parseFloat(style.marginInlineStart)).toBeCloseTo(index ? fixture.overlapPx : 0, 3);
    await expect(style.transitionDuration).toBe('0s');
    await expect(button.getAnimations()).toHaveLength(0);
    await expectInside(button, fan);
    if (index) {
      const previous = buttons[index - 1]!;
      await expect(Math.abs(button.offsetLeft - previous.offsetLeft - button.offsetWidth - fixture.overlapPx)).toBeLessThanOrEqual(1);
      await expect(previous.getBoundingClientRect().right - button.getBoundingClientRect().left).toBeGreaterThan(0);
    }
    if (index < Math.floor(count / 2)) await expectMirrored(button, buttons[count - index - 1]!, fan, 'vertical');
  }
  const confirm = element.querySelector('[data-ui="game-hand-confirm"]')!;
  await expectNoOverlap(fan, confirm);
  await expectMirroredDirection(fan, '[data-ui="game-hand-card"]');
}

export const Default: Story = { play: async ({ canvasElement }) => checkFan(canvasElement, 3) };
export const OneCard: Story = { args: { cards: CARDS.slice(0, 1) }, play: async ({ canvasElement }) => checkFan(canvasElement, 1) };
export const TwoCards: Story = { args: { cards: CARDS.slice(0, 2) }, play: async ({ canvasElement }) => checkFan(canvasElement, 2) };
export const FiveCards: Story = { args: { cards: CARDS }, play: async ({ canvasElement }) => checkFan(canvasElement, 5) };
export const Selected: Story = { args: { defaultValue: CARDS[1]!.id } };
export const LightTheme: Story = { decorators: [(Story) => <ThemeRoot theme="light"><Story /></ThemeRoot>] };
export const SelectedLightTheme: Story = { ...Selected, decorators: LightTheme.decorators };
export const RTL: Story = { args: { dir: 'rtl' }, play: async ({ canvasElement }) => {
  const fan = canvasElement.querySelector<HTMLElement>('[data-ui="game-hand-fan"]')!;
  const cards = fan.querySelectorAll('[data-ui="game-hand-card"]');
  await expectMirrored(cards[0]!, cards[2]!, fan, 'vertical');
  await expectMirroredDirection(fan, '[data-ui="game-hand-card"]');
} };

export const KeyboardSelection: Story = {
  render: (args) => <><GameHand {...args} /><Button>Continue</Button></>,
  play: async ({ canvas, userEvent, args }) => {
    const cards = CARDS.slice(0, 3).map((card) => canvas.getByRole('button', { name: card.label }));
    const confirm = canvas.getByRole('button', { name: 'Play card' });
    await expect(confirm).toBeDisabled();
    await userEvent.tab();
    await expect(cards[0]!.ownerDocument.activeElement).toBe(cards[0]);
    await expect(getComputedStyle(cards[0]!).outlineStyle).not.toBe('none');
    await expect(getComputedStyle(cards[0]!).zIndex).toBe('1000');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, CARDS[0]!.id);
    await expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(cards[1]).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, CARDS[1]!.id);
    await expect(cards[1]).toHaveAttribute('aria-pressed', 'true');
    await expect(cards[0]).toHaveAttribute('aria-pressed', 'false');
    await userEvent.tab();
    await expect(cards[2]).toHaveFocus();
    await userEvent.tab();
    await expect(confirm).toHaveFocus();
    await expect(getComputedStyle(confirm).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(args.onPlayIntent).toHaveBeenCalledWith(CARDS[1]);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(confirm).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(cards[2]).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(cards[1]).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, null);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(confirm).toBeDisabled();
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: CARDS[1]!.id },
  render: KeyboardSelection.render,
  play: async ({ canvas, userEvent, args }) => {
    for (const card of CARDS.slice(0, 3)) await expect(canvas.getByRole('button', { name: card.label })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Play card' })).toBeDisabled();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
  },
};

function ControlledHand(args: GameHandProps) {
  const [value, setValue] = useState<string | null>(null);
  return <GameHand {...args} value={value} onValueChange={(id) => { setValue(id); args.onValueChange?.(id); }} />;
}
export const Controlled: Story = {
  render: (args) => <ControlledHand {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: CARDS[2]!.label }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(CARDS[2]!.id);
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(args.onPlayIntent).toHaveBeenCalledWith(CARDS[2]);
  },
};
export const RejectedSelection: Story = {
  args: { value: null },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: CARDS[0]!.label }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(CARDS[0]!.id);
    await expect(canvas.getByRole('button', { name: CARDS[0]!.label })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByRole('button', { name: 'Play card' })).toBeDisabled();
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
  },
};

function MutableHand(args: GameHandProps) {
  const [cards, setCards] = useState(args.cards);
  return <div style={{ display: 'grid', justifyItems: 'start', gap: vars.space[4] }}>
    <Button onClick={() => setCards(cards.slice(1))}>Remove first card</Button>
    <Button onClick={() => setCards([...cards].reverse())}>Reverse cards</Button>
    <GameHand {...args} cards={cards} />
  </div>;
}
export const StableIdentity: Story = {
  render: (args) => <MutableHand {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const card = canvas.getByRole('button', { name: CARDS[1]!.label });
    const paper = card.querySelector('[data-ui="game-card"]');
    await userEvent.click(card);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove first card' }));
    await expect(canvas.getByRole('button', { name: CARDS[1]!.label })).toBe(card);
    await expect(card.querySelector('[data-ui="game-card"]')).toBe(paper);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await expect(args.onPlayIntent).toHaveBeenNthCalledWith(1, CARDS[1]);
    await userEvent.click(canvas.getByRole('button', { name: 'Reverse cards' }));
    await expect(canvas.getByRole('button', { name: CARDS[1]!.label })).toBe(card);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await expect(args.onPlayIntent).toHaveBeenNthCalledWith(2, CARDS[1]);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove first card' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Remove first card' }));
    await expect(canvas.getByRole('button', { name: 'Play card' })).toBeDisabled();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const Empty: Story = { args: { cards: [] } };
function ReorderedControlledHand(args: GameHandProps) {
  const [cards, setCards] = useState(args.cards);
  return <>
    <Button onClick={() => setCards([...cards].reverse())}>Reverse controlled cards</Button>
    <GameHand {...args} cards={cards} value={args.cards[0]!.id} />
  </>;
}
export const ControlledReorder: Story = {
  render: (args) => <ReorderedControlledHand {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const selected = canvas.getByRole('button', { name: CARDS[0]!.label });
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Reverse controlled cards' }));
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: CARDS[2]!.label })).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(args.onPlayIntent).toHaveBeenCalledWith(CARDS[0]);
  },
};
export const Sizes: Story = { render: (args) => <div style={{ display: 'flex', gap: vars.space[8] }}>
  {(['sm', 'md', 'lg'] as const).map((size) => <GameHand {...args} key={size} size={size} />)}
</div>, play: async ({ canvasElement }) => {
  const hands = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand"]'));
  for (const [index, hand] of hands.entries()) {
    const fan = hand.querySelector('[data-ui="game-hand-fan"]')!;
    const buttons = Array.from(hand.querySelectorAll<HTMLElement>('[data-ui="game-hand-card"]'));
    await expectMirrored(buttons[0]!, buttons[2]!, fan, 'vertical');
    await expect(Number.parseFloat(getComputedStyle(buttons[1]!).marginInlineStart)).toBeCloseTo(index === 0 ? 0 : -10.56, 3);
    await expectMirroredDirection(hand, '[data-ui="game-hand-card"]');
  }
} };

export const HiddenHands: Story = {
  render: () => <div style={{ display: 'flex', gap: vars.space[12], padding: vars.space[8] }}>
    {[1, 2, 3].map((count) => <GameHand.Hidden key={count} count={count} label="Opponent hand" />)}
  </div>,
  parameters: { docs: { source: { code: '<GameHand.Hidden count={3} label="Opponent hand" />' } } },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getAllByRole('img', { name: 'Opponent hand' })).toHaveLength(3);
    const hands = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand-hidden"]'));
    for (const [index, hand] of hands.entries()) {
      const fixture = HIDDEN_PARITY.find((item) => item.count === index + 1)!;
      const cards = Array.from(hand.querySelectorAll<HTMLElement>('[data-ui="game-hand-hidden-card"]'));
      await expect(cards).toHaveLength(fixture.count);
      await expect(hand.querySelector('[data-deck], [data-rank], [data-suit], [data-ui="game-card-print"]')).toBeNull();
      await expect(hand.textContent).toBe('');
      for (const [cardIndex, card] of cards.entries()) {
        const expected = fixture.cards[cardIndex]!;
        const matrix = new DOMMatrixReadOnly(getComputedStyle(card).transform);
        const direction = getComputedStyle(hand).direction === 'rtl' ? -1 : 1;
        await expect(matrix.e).toBeCloseTo(expected.x * direction, 3);
        await expect(matrix.f).toBeCloseTo(expected.y, 3);
        await expect(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI).toBeCloseTo(expected.rotateDeg * direction, 3);
      }
      if (cards.length > 1) await expectMirrored(cards[0]!, cards[cards.length - 1]!, hand, 'vertical');
      await expectMirroredDirection(hand, '[data-ui="game-hand-hidden-card"]');
    }
    for (const fixture of HIDDEN_PARITY) {
      const layout = buildOpponentHiddenHandLayout({ geometry: SEAT_PARITY[0]!.polar,
        profileRules: DEFAULT_HIDDEN_HAND_RULES, hiddenCardCount: fixture.count, avatarSizePx: 56, nameBlockPx: 28 });
      await expect(layout.cards).toEqual(fixture.cards);
      await expect(layout.anchor.y).toBeCloseTo(SEAT_PARITY[0]!.transform.y, 6);
    }
    for (const fixture of SEAT_PARITY) {
      const transform = getOpponentSeatHandTransform({ polar: fixture.polar });
      await expect(transform.x).toBeCloseTo(fixture.transform.x, 6);
      await expect(transform.y).toBeCloseTo(fixture.transform.y, 6);
      await expect(transform.rotate).toBe(fixture.transform.rotate);
      await expect(transform.origin).toBe(fixture.transform.origin);
    }
  },
};
export const HiddenHandsLightTheme: Story = { ...HiddenHands, decorators: LightTheme.decorators };
export const HiddenCardSlots: Story = {
  render: () => <GameHand.Hidden count={3} label="Opponent hand"
    slotProps={{ card: { className: 'custom-hidden-card', css: { borderRadius: vars.radius.lg } } }} />,
  parameters: { docs: { source: { code: '<GameHand.Hidden count={3} label="Opponent hand" slotProps={{ card: { css: { borderRadius: vars.radius.lg } } }} />' } } },
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand-hidden-card"]');
    await expect(cards).toHaveLength(3);
    for (const card of cards) {
      await expect(card).toHaveClass('custom-hidden-card');
      await expect(getComputedStyle(card).borderRadius).toBe(getComputedStyle(card).getPropertyValue('--ui-radius-lg').trim());
    }
  },
};
export const HiddenHandsRTL: Story = { ...HiddenHands, decorators: [(Story) => <div dir="rtl"><Story /></div>] };
export const RadialHiddenHands: Story = {
  render: () => <div style={{ display: 'flex', gap: vars.space[12], padding: vars.space[12] }}>
    {SEAT_PARITY.map((seat, index) => <GameHand.Hidden key={index} count={3} label="Opponent hand" polar={seat.polar} />)}
  </div>,
};
