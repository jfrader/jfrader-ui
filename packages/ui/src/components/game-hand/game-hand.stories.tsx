import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { GameHand, type GameHandCard, type GameHandProps } from './game-hand';
import { Button } from '../button';
import { ThemeRoot } from '../theme-root';
import { expectInside, expectMirrored, expectMirroredDirection, expectNoOverlap } from '../../testing/geometry-assertions';
import { buildOpponentHiddenHandLayout, DEFAULT_HIDDEN_HAND_RULES, getHandFanRotations, getOpponentSeatHandTransform } from './hand-layout';
import { HIDDEN_PARITY, PLAYER_PARITY, SEAT_PARITY } from './parity-fixtures';

const Controls = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });
const Row = styled.div({ display: 'flex', flexWrap: 'wrap', maxInlineSize: '100%', overflowX: 'auto', gap: vars.space[8] });
const Hands = styled.div({ display: 'flex', flexWrap: 'wrap', maxInlineSize: '100%', boxSizing: 'border-box', gap: vars.space[12], padding: vars.space[8] });
const SpaciousHands = styled(Hands)({ flexWrap: 'nowrap', maxInlineSize: 'none', flexShrink: 0,
  padding: `calc(4 * ${vars.space[12]})`, gap: `calc(4 * ${vars.space[12]})` });
const NarrowExample = styled.div({ inlineSize: 280, maxInlineSize: '100%' });
const ExampleViewport = styled.div({
  inlineSize: `min(100%, calc(100vw - 2 * ${vars.space[4]}))`, maxInlineSize: '100%',
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'safe center', overflowX: 'auto',
});

function ReplacedHandRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="hand-root" />;
}

const CARDS: GameHandCard[] = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
  { id: 'jack-diamonds', label: 'Jack of diamonds', value: { deck: 'french', suit: 'diamonds', rank: 'J' } },
  { id: 'ten-spades', label: 'Ten of spades', value: { deck: 'french', suit: 'spades', rank: 10 } },
];

const meta = {
  title: 'Games/GameHand', component: GameHand, tags: ['autodocs'],
  decorators: [(Story) => <ExampleViewport><Story /></ExampleViewport>],
  args: { cards: CARDS.slice(0, 3), playLabel: 'Play card', onValueChange: fn(), onPlayIntent: fn() },
  parameters: { docs: {
    description: { component: 'Choose a card from your hand and confirm to play it. Show opponents’ hands as card backs with GameHand.Hidden.' },
    sections: [
      { title: 'Basic', stories: ['Default'] },
      { title: 'Hidden hand', stories: ['HiddenHands'] },
      { title: 'Layout', stories: ['Sizes'] },
      { title: 'Interactions', stories: ['Controlled', 'AcceptedPlay', 'StableIdentity', 'SelectOnly'] },
      { title: 'States', stories: ['Selected', 'Disabled', 'Empty', 'DisabledCards'] },
      { title: 'Composition', stories: ['HiddenCardSlots', 'ConfirmPart'] },
    ],
    source: {
      language: 'tsx',
      code: `import { GameHand } from '@jfrader/ui/game-hand';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

<GameHand cards={cards}>
  <GameHand.Confirm onPlay={(card) => console.log(card)}>Play card</GameHand.Confirm>
</GameHand>`,
    },
    usage: `### When to use
Let a player select a card and confirm a play. Your application accepts the play and updates the hand; selection alone does not play or remove a card. There is no drag gesture.

### Card identity and hidden hands

Keep each card's id unique and stable when reordering or removing cards so selection follows the same card. Use count-only hidden hands for opponents; never include secret values or revealing labels. Reserve enough space for the fan and its confirmation control. Radial hidden hands need a caller-positioned seat.

Use value and onValueChange for controlled selection, or defaultValue for an initial selection. Compose GameHand.Confirm through children; its onPlay takes precedence over the root's onPlayIntent. Without children or legacy props, the hand is select-only. The legacy playLabel and onPlayIntent pair is deprecated for one release; explicit children replace its built-in confirmation.

Per-card disabled blocks selection and play for that card; disabledReason supplies an accessible description. dimmed changes appearance without disabling selection. Confirmation captures the CardFlights origin before calling back. Active flights block both selection and confirmation.

### Keyboard and accessibility

Tab and Shift+Tab follow card order, then confirmation. Enter or Space selects or clears a card; activate confirmation to request a play. Name cards and confirmation in the player's language. Disabled cards and confirmation remain focusable but do not act. After removing a selected card, confirmation stays focused and unavailable until another card is selected. Hands have no opening animation.`,
  } },
} satisfies Meta<typeof GameHand>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Replace the hand container while retaining selection and confirmation. */
export const ReplacedRootKeepsSelection: Story = {
  tags: ['!autodocs'],
  args: {
    component: ReplacedHandRoot,
    slotProps: { root: { className: 'custom-hand', ref: fn(), title: 'Your cards' } },
  },
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    const root = canvasElement.querySelector('[data-replacement="hand-root"]')!;
    await expect(root).toHaveAttribute('data-ui', 'game-hand');
    await expect(root).toHaveClass('custom-hand');
    await expect(root).toHaveAttribute('title', 'Your cards');
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(getComputedStyle(root).display).toBe('flex');
    await userEvent.click(canvas.getByRole('button', { name: 'Ace of spades' }));
    await expect(canvas.getByRole('button', { name: 'Ace of spades' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Play card' }));
    await expect(args.onPlayIntent).toHaveBeenCalledWith(CARDS[0]);
  },
};

async function checkFan(element: HTMLElement, count: number) {
  const parity = PLAYER_PARITY.find((item) => item.count === count)!;
  const fixture = count === 5 ? { ...parity, rotations: [-10, -5, 0, 5, 10] } : parity;
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
  const confirm = element.querySelector('[data-ui~="game-hand-confirm"]')!;
  await expectNoOverlap(fan, confirm);
  await expectMirroredDirection(fan, '[data-ui="game-hand-card"]');
}

/** Three cards held in hand with an unselected play button. */
export const Default: Story = {
  name: 'Choose a card',
  render: (args) => <GameHand {...args} onPlayIntent={undefined}>
    <GameHand.Confirm onPlay={args.onPlayIntent}>Play card</GameHand.Confirm>
  </GameHand>,
  parameters: {
    docs: {
      description: { story: 'Select one of three cards, then confirm to request a play.' },
      source: {
        language: 'tsx',
        code: `import { GameHand } from '@jfrader/ui/game-hand';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

<GameHand cards={cards}>
  <GameHand.Confirm onPlay={(card) => console.log(card)}>Play card</GameHand.Confirm>
</GameHand>`,
      },
    },
  },
  play: async ({ canvasElement }) => checkFan(canvasElement, 3),
};
export const OneCard: Story = { tags: ['!autodocs'], args: { cards: CARDS.slice(0, 1) }, play: async ({ canvasElement }) => checkFan(canvasElement, 1) };
export const TwoCards: Story = { tags: ['!autodocs'], args: { cards: CARDS.slice(0, 2) }, play: async ({ canvasElement }) => checkFan(canvasElement, 2) };
export const FiveCards: Story = { tags: ['!autodocs'], args: { cards: CARDS }, play: async ({ canvasElement }) => checkFan(canvasElement, 5) };

/** The second card is selected and raised above the fan. */
export const Selected: Story = {
  name: 'Selected card',
  args: { defaultValue: CARDS[1]!.id },
  parameters: { docs: { description: { story: 'Start with the king selected and raised above the fan.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];
<GameHand cards={cards} defaultValue="king-hearts" playLabel="Play card" onPlayIntent={console.log} />` } } },
};

/** Hand rendered with the light theme palette. */
export const LightTheme: Story = {
  name: 'Light theme',
  decorators: [(Story) => <ThemeRoot theme="light"><Story /></ThemeRoot>],
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { ThemeRoot } from '@jfrader/ui/theme-root';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

<ThemeRoot theme="light">
  <GameHand cards={cards} playLabel="Play card" onPlayIntent={console.log} />
</ThemeRoot>` } } },
};

/** A selected card raised above the fan in the light theme. */
export const SelectedLightTheme: Story = {
  ...Selected,
  name: 'Selected card · light',
  decorators: LightTheme.decorators,
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { ThemeRoot } from '@jfrader/ui/theme-root';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];
<ThemeRoot theme="light"><GameHand cards={cards} defaultValue="king-hearts" playLabel="Play card" onPlayIntent={console.log} /></ThemeRoot>` } } },
};

/** Cards fanned out from right to left in right-to-left layout. */
export const RTL: Story = {
  name: 'RTL',
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];
<GameHand dir="rtl" cards={cards} playLabel="Play card" onPlayIntent={console.log} />` } } },
  args: { dir: 'rtl' }, play: async ({ canvasElement }) => {
  const fan = canvasElement.querySelector<HTMLElement>('[data-ui="game-hand-fan"]')!;
  const cards = fan.querySelectorAll('[data-ui="game-hand-card"]');
  await expectMirrored(cards[0]!, cards[2]!, fan, 'vertical');
  await expectMirroredDirection(fan, '[data-ui="game-hand-card"]');
} };

/** Tab navigates across cards and the play button, with active outline on the focused card. */
export const KeyboardSelection: Story = {
  name: 'Keyboard selection',
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { Button } from '@jfrader/ui/button';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];
<><GameHand cards={cards} playLabel="Play card" onPlayIntent={console.log} /><Button>Continue</Button></>` } } },
  render: (args) => <><GameHand {...args} /><Button>Continue</Button></>,
  play: async ({ canvas, userEvent, args }) => {
    const cards = CARDS.slice(0, 3).map((card) => canvas.getByRole('button', { name: card.label }));
    const confirm = canvas.getByRole('button', { name: 'Play card' });
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
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
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
  },
};

/** Cards and confirmation button dimmed with aria-disabled while remaining focusable. */
export const Disabled: Story = {
  name: 'Disabled hand',
  parameters: { docs: { description: { story: 'Keep a selected hand focusable while blocking selection and play.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { Button } from '@jfrader/ui/button';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

<>
  <GameHand cards={cards} playLabel="Play card" disabled defaultValue="king-hearts" onPlayIntent={console.log} />
  <Button>Continue</Button>
</>` } } },
  args: { disabled: true, defaultValue: CARDS[1]!.id },
  render: KeyboardSelection.render,
  play: async ({ canvas, userEvent, args }) => {
    for (const card of CARDS.slice(0, 3)) {
      const button = canvas.getByRole('button', { name: card.label });
      await expect(button).toHaveAttribute('aria-disabled', 'true');
      await expect(button).not.toHaveAttribute('disabled');
      await userEvent.tab();
      await expect(button).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard(' ');
    }
    const confirm = canvas.getByRole('button', { name: 'Play card' });
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await expect(confirm).not.toHaveAttribute('disabled');
    await userEvent.tab();
    await expect(confirm).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
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
function AcceptedHand(args: GameHandProps) {
  const [cards, setCards] = useState(args.cards);
  return <GameHand {...args} cards={cards} onPlayIntent={(card) => {
    setCards((current) => current.filter((item) => item.id !== card.id));
    args.onPlayIntent?.(card);
  }} />;
}

/** Playing the selected card removes it from the hand and disables confirmation. */
export const AcceptedPlay: Story = {
  name: 'Playing a card removes it',
  parameters: { docs: { description: { story: 'Confirm a play to remove the selected card from application state.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { GameHand } from '@jfrader/ui/game-hand';

const initialCards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

export function AcceptedPlay() {
  const [cards, setCards] = useState(initialCards);
  return <GameHand cards={cards} playLabel="Play card"
    onPlayIntent={(played) => setCards((hand) => hand.filter((card) => card.id !== played.id))} />;
}` } } },
  render: (args) => <AcceptedHand {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    const confirm = canvas.getByRole('button', { name: 'Play card' });
    await expect(confirm).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByRole('button', { name: CARDS[0]!.label })).toBeNull();
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body);
    await expect(confirm).toHaveFocus();
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await expect(getComputedStyle(confirm).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(confirm);
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: CARDS[2]!.label })).toHaveFocus();
  },
};

/** Selected card state driven by a parent component value. */
export const Controlled: Story = {
  name: 'Controlled selection',
  parameters: { docs: { description: { story: 'Keep the selected card id in parent state.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { GameHand } from '@jfrader/ui/game-hand';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

export function ControlledHand() {
  const [value, setValue] = useState<string | null>(null);
  return <GameHand cards={cards} playLabel="Play card" value={value} onValueChange={setValue} onPlayIntent={console.log} />;
}` } } },
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
  tags: ['!autodocs'],
  args: { value: null },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: CARDS[0]!.label }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(CARDS[0]!.id);
    await expect(canvas.getByRole('button', { name: CARDS[0]!.label })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByRole('button', { name: 'Play card' })).toHaveAttribute('aria-disabled', 'true');
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
  },
};

function MutableHand(args: GameHandProps) {
  const [cards, setCards] = useState(args.cards);
  return <Controls>
    <Button onClick={() => setCards(cards.slice(1))}>Remove first card</Button>
    <Button onClick={() => setCards([...cards].reverse())}>Reverse cards</Button>
    <GameHand {...args} cards={cards} />
  </Controls>;
}
/** Selection stays on the chosen card when neighboring cards are removed or reversed. */
export const StableIdentity: Story = {
  name: 'Selection follows the card',
  parameters: { docs: { description: { story: 'Remove or reverse cards while keeping selection attached to a stable id.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { GameHand } from '@jfrader/ui/game-hand';
import { Button } from '@jfrader/ui/button';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '@jfrader/ui';

const Controls = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });

const initialCards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];
export function MutableHand() {
  const [cards, setCards] = useState(initialCards);
  return <Controls>
    <Button onClick={() => setCards(cards.slice(1))}>Remove first card</Button>
    <Button onClick={() => setCards([...cards].reverse())}>Reverse cards</Button>
    <GameHand cards={cards} playLabel="Play card" onPlayIntent={console.log} />
  </Controls>;
}` } } },
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
    await expect(canvas.getByRole('button', { name: 'Play card' })).toHaveAttribute('aria-disabled', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

/** An empty hand with no cards and a disabled play button. */
export const Empty: Story = {
  name: 'Empty hand',
  args: { cards: [] },
  parameters: { docs: { description: { story: 'Show an empty hand with confirmation unavailable.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';

<GameHand cards={[]} playLabel="Play card" onPlayIntent={console.log} />` } } },
};

function ReorderedControlledHand(args: GameHandProps) {
  const [cards, setCards] = useState(args.cards);
  return <>
    <Button onClick={() => setCards([...cards].reverse())}>Reverse controlled cards</Button>
    <GameHand {...args} cards={cards} value={args.cards[0]!.id} />
  </>;
}

/** Reversing cards in a controlled hand preserves the selected card state. */
export const ControlledReorder: Story = {
  name: 'Reordered controlled hand',
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { GameHand } from '@jfrader/ui/game-hand';
import { Button } from '@jfrader/ui/button';

const initialCards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];
export function ReorderedControlledHand() {
  const [cards, setCards] = useState(initialCards);
  return <>
    <Button onClick={() => setCards([...cards].reverse())}>Reverse controlled cards</Button>
    <GameHand cards={cards} value="ace-spades" playLabel="Play card" onPlayIntent={console.log} />
  </>;
}` } } },
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

/** Small, medium, and large card hands displayed side by side. */
export const Sizes: Story = {
  name: 'Sizes',
  parameters: { docs: { description: { story: 'Compare three-card fans at small, medium and large sizes.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '@jfrader/ui';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', maxInlineSize: '100%', overflowX: 'auto', gap: vars.space[8] });

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

<Row>
  {(['sm', 'md', 'lg'] as const).map((size) =>
    <GameHand key={size} size={size} cards={cards} playLabel="Play card" onPlayIntent={console.log} />)}
</Row>` } } },
  render: (args) => <Row>
  {(['sm', 'md', 'lg'] as const).map((size) => <GameHand {...args} key={size} size={size} />)}
</Row>, play: async ({ canvasElement }) => {
  const hands = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand"]'));
  for (const [index, hand] of hands.entries()) {
    const fan = hand.querySelector('[data-ui="game-hand-fan"]')!;
    const buttons = Array.from(hand.querySelectorAll<HTMLElement>('[data-ui="game-hand-card"]'));
    await expectMirrored(buttons[0]!, buttons[2]!, fan, 'vertical');
    await expect(Number.parseFloat(getComputedStyle(buttons[1]!).marginInlineStart)).toBeCloseTo(index === 0 ? 0 : -10.56, 3);
    await expectMirroredDirection(hand, '[data-ui="game-hand-card"]');
  }
} };

export const NarrowSizes: Story = {
  tags: ['!autodocs'],
  render: (args) => <NarrowExample><Row>
    {(['sm', 'md', 'lg'] as const).map((size) => <GameHand {...args} key={size} size={size} />)}
  </Row></NarrowExample>,
  play: async ({ canvasElement, userEvent }) => {
    const hands = [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand"]')];
    const row = hands[0]!.parentElement!;
    const bounds = row.getBoundingClientRect();
    await expect(bounds.width).toBeLessThanOrEqual(280);
    await expect(hands[0]!.getBoundingClientRect().left).toBeGreaterThanOrEqual(bounds.left);
    await expect(hands[1]!.getBoundingClientRect().top).toBeGreaterThan(hands[0]!.getBoundingClientRect().top);
    const buttons = [...row.querySelectorAll<HTMLButtonElement>('button')];
    for (const button of buttons) {
      await userEvent.tab();
      await expect(canvasElement.ownerDocument.activeElement).toBe(button);
      await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
      const target = button.getBoundingClientRect();
      await expect(target.right).toBeGreaterThan(bounds.left);
      await expect(target.left).toBeLessThan(bounds.right);
      await expect(target.width).toBeGreaterThanOrEqual(32);
      await expect(target.height).toBeGreaterThanOrEqual(24);
    }
  },
};

/** Opponent hands showing one, two, and three facedown cards. */
export const HiddenHands: Story = {
  name: 'Opponent hands',
  render: () => <Hands>
    {[1, 2, 3].map((count) => <GameHand.Hidden key={count} count={count} label="Opponent hand" />)}
  </Hands>,
  parameters: { docs: { description: { story: 'Show opponents holding one, two and three cards without passing card values.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '@jfrader/ui';

const Hands = styled.div({ display: 'flex', flexWrap: 'wrap', maxInlineSize: '100%', boxSizing: 'border-box', gap: vars.space[12], padding: vars.space[8] });

<Hands>
  {[1, 2, 3].map((count) => <GameHand.Hidden key={count} count={count} label="Opponent hand" />)}
</Hands>` } } },
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
        rules: DEFAULT_HIDDEN_HAND_RULES, hiddenCardCount: fixture.count, avatarSizePx: 56, nameBlockPx: 28 });
      if (fixture.count <= 3) await expect(layout.cards).toEqual(fixture.cards);
      else {
        await expect(layout.cards).toHaveLength(Math.floor(fixture.count));
        await expect(layout.cards[0]!.x).toBe(-layout.cards.at(-1)!.x);
      }
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

/** Opponent hands showing facedown cards in the light theme. */
export const HiddenHandsLightTheme: Story = {
  ...HiddenHands,
  name: 'Opponent hands · light',
  decorators: LightTheme.decorators,
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { ThemeRoot } from '@jfrader/ui/theme-root';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '@jfrader/ui';

const Hands = styled.div({ display: 'flex', flexWrap: 'wrap', maxInlineSize: '100%', boxSizing: 'border-box', gap: vars.space[12], padding: vars.space[8] });

<ThemeRoot theme="light">
  <Hands>
    {[1, 2, 3].map((count) => <GameHand.Hidden key={count} count={count} label="Opponent hand" />)}
  </Hands>
</ThemeRoot>` } } },
};

/** Hidden opponent cards styled with custom rounded corners via slot props. */
export const HiddenCardSlots: Story = {
  name: 'Style hidden card corners',
  render: () => <GameHand.Hidden count={3} label="Opponent hand"
    slotProps={{ card: { className: 'custom-hidden-card', sx: { borderRadius: vars.radius.lg } } }} />,
  parameters: { docs: { description: { story: 'Round each hidden card wrapper through its sx styling slot.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { vars } from '@jfrader/tokens/vars';

<GameHand.Hidden count={3} label="Opponent hand"
  slotProps={{ card: { className: 'custom-hidden-card', sx: { borderRadius: vars.radius.lg } } }} />` } } },
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand-hidden-card"]');
    await expect(cards).toHaveLength(3);
    for (const card of cards) {
      await expect(card).toHaveClass('custom-hidden-card');
      await expect(getComputedStyle(card).borderRadius).toBe(getComputedStyle(card).getPropertyValue('--ui-radius-lg').trim());
    }
  },
};

/** Opponent hands fanning facedown cards from right to left in RTL layout. */
export const HiddenHandsRTL: Story = {
  ...HiddenHands,
  name: 'Opponent hands · RTL',
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
  parameters: { docs: { source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '@jfrader/ui';

const Hands = styled.div({ display: 'flex', flexWrap: 'wrap', maxInlineSize: '100%', boxSizing: 'border-box', gap: vars.space[12], padding: vars.space[8] });

<div dir="rtl"><Hands>
  {[1, 2, 3].map((count) => <GameHand.Hidden key={count} count={count} label="Opponent hand" />)}
</Hands></div>` } } },
};
export const RadialHiddenHands: Story = {
  tags: ['!autodocs'],
  render: () => <Row role="region" aria-label="Radial hands" tabIndex={0}><SpaciousHands>
    {SEAT_PARITY.map((seat, index) => <GameHand.Hidden key={index} count={3} label="Opponent hand" polar={seat.polar} />)}
  </SpaciousHands></Row>,
  play: async ({ canvasElement }) => {
    const hands = [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-hand-hidden"]')];
    for (const [index, hand] of hands.entries()) {
      for (const other of hands.slice(index + 1)) await expectNoOverlap(hand, other);
      for (const card of hand.querySelectorAll('[data-ui="game-hand-hidden-card"]')) await expectInside(card, hand.parentElement!);
    }
  },
};

/** Pick a card without adding a play action. */
export const SelectOnly: Story = {
  name: 'Select without confirming',
  args: { playLabel: undefined, onPlayIntent: undefined },
  parameters: { docs: { description: { story: 'Select a card without rendering a play action.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

<GameHand cards={cards} onValueChange={console.log} />` } } },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(3);
    await userEvent.tab();
    const first = canvas.getByRole('button', { name: CARDS[0]!.label });
    await expect(first).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).toHaveBeenCalledWith(CARDS[0]!.id);
  },
};

/** Compose a confirmation action with a separate play handler. */
export const ConfirmPart: Story = {
  name: 'Compose confirmation',
  render: (args) => <GameHand {...args} onPlayIntent={undefined}>
    <GameHand.Confirm onPlay={args.onPlayIntent}>Confirm card</GameHand.Confirm>
  </GameHand>,
  parameters: { docs: { description: { story: 'Add a confirmation part with its own play callback.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';

const cards = [
  { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
  { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
  { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' } },
];

<GameHand cards={cards}>
  <GameHand.Confirm onPlay={console.log}>Confirm card</GameHand.Confirm>
</GameHand>` } } },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.queryByRole('button', { name: 'Play card' })).toBeNull();
    const confirm = canvas.getByRole('button', { name: 'Confirm card' });
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
    await userEvent.tab(); await userEvent.tab(); await userEvent.tab();
    await expect(confirm).toHaveFocus();
    await expect(getComputedStyle(confirm).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(args.onPlayIntent).toHaveBeenCalledWith(CARDS[0]);
  },
};

export const ConfirmRootFallback: Story = {
  tags: ['!autodocs'],
  render: (args) => <GameHand {...args}><GameHand.Confirm>Confirm card</GameHand.Confirm></GameHand>,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: CARDS[1]!.label }));
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm card' }));
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(args.onPlayIntent).toHaveBeenCalledWith(CARDS[1]);
  },
};

export const ConfirmCallbackPrecedence: Story = {
  tags: ['!autodocs'], args: { defaultValue: CARDS[0]!.id },
  render: (args) => <GameHand {...args}>
    <GameHand.Confirm onPlay={(card) => args.onValueChange?.(card.id)}>Confirm card</GameHand.Confirm>
  </GameHand>,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm card' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(CARDS[0]!.id);
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
  },
};

export const LegacyConfirmation: Story = {
  tags: ['!autodocs'], ...KeyboardSelection,
  name: 'Legacy playLabel and onPlayIntent',
};

/** One unavailable card remains focusable while the other cards can be selected. */
export const DisabledCards: Story = {
  name: 'Unavailable and dimmed cards',
  args: {
    cards: CARDS.slice(0, 3).map((card, index) => ({ ...card,
      disabled: index === 0, disabledReason: index === 0 ? 'Follow the leading suit' : undefined, dimmed: index === 2 })),
    defaultValue: CARDS[0]!.id,
    slotProps: { card: { 'aria-describedby': 'hand-description' } },
  },
  render: (args) => <><p id="hand-description">Choose one card</p><GameHand {...args} /></>,
  parameters: { docs: { description: { story: 'Block an unavailable card with an accessible reason while a dimmed card remains playable.' }, source: { language: 'tsx', code: `import { GameHand } from '@jfrader/ui/game-hand';

<>
  <p id="hand-description">Choose one card</p>
  <GameHand defaultValue="ace-spades" slotProps={{ card: { 'aria-describedby': 'hand-description' } }} cards={[
    { id: 'ace-spades', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' }, disabled: true, disabledReason: 'Follow the leading suit' },
    { id: 'king-hearts', label: 'King of hearts', value: { deck: 'french', suit: 'hearts', rank: 'K' } },
    { id: 'queen-clubs', label: 'Queen of clubs', value: { deck: 'french', suit: 'clubs', rank: 'Q' }, dimmed: true },
  ]} playLabel="Play card" onPlayIntent={console.log} />
</>` } } },
  play: async ({ canvas, userEvent, args }) => {
    const first = canvas.getByRole('button', { name: CARDS[0]!.label });
    const confirm = canvas.getByRole('button', { name: 'Play card' });
    await expect(first).toHaveAttribute('aria-disabled', 'true');
    await expect(first).toHaveAttribute('data-disabled', 'true');
    await expect(first).not.toHaveAttribute('disabled');
    await expect(first).toHaveAccessibleDescription('Choose one card Follow the leading suit');
    await userEvent.tab();
    await expect(first).toHaveFocus();
    await expect(getComputedStyle(first).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}'); await userEvent.keyboard(' ');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(confirm);
    await expect(args.onPlayIntent).not.toHaveBeenCalled();
    const third = canvas.getByRole('button', { name: CARDS[2]!.label });
    await expect(third).not.toHaveAttribute('aria-disabled', 'true');
    await expect(getComputedStyle(third.querySelector('[data-ui="game-card"]')!).opacity).toBe('0.55');
    await userEvent.click(third);
    await userEvent.click(confirm);
    await expect(args.onPlayIntent).toHaveBeenCalledTimes(1);
    await expect(args.onPlayIntent).toHaveBeenCalledWith(args.cards[2]);
  },
};
