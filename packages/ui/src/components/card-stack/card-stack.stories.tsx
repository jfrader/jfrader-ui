import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { CardStack, type CardStackDecision, type CardStackProps } from './index';

interface City {
  id: string;
  name: string;
  description: string;
}
const FALSY_NODES: readonly ReactNode[] = [false, null, 0, ''];
const cities: readonly City[] = [
  {
    id: 'oslo',
    name: 'Oslo',
    description: 'A waterfront weekend with trails into the forest.',
  },
  {
    id: 'porto',
    name: 'Porto',
    description: 'River walks, tiled streets and a slow lunch.',
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    description: 'Quiet gardens and an early morning market.',
  },
  {
    id: 'lima',
    name: 'Lima',
    description: 'Coastal paths and an evening in the old town.',
  },
  {
    id: 'tallinn',
    name: 'Tallinn',
    description: 'A compact old town and a ferry across the bay.',
  },
];
const fixtureStyle = css({
  padding: vars.space[4],
  inlineSize: '36rem',
  maxInlineSize: '100%',
  display: 'grid',
  gap: vars.space[4],
});
const narrowStyle = css({ inlineSize: '14rem', maxInlineSize: '100%' });
const shrinkWrapStyle = css({ display: 'inline-flex', maxInlineSize: '100%' });
const overrideStyle = css({
  paddingInline: vars.space[6],
  borderRadius: vars.radius.sm,
});
const icon = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M8 6 3 11l5 5M3 11h10a6 6 0 0 1 0 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);
const SOURCE = `<CardStack
  items={cities}
  getKey={city => city.id}
  getLabel={city => city.name}
  renderCard={city => <h3>{city.name}</h3>}
  labels={{ right: 'Shortlist' }}
/>`;
const meta = {
  title: 'Data display/CardStack',
  component: CardStack<City>,
  tags: ['autodocs'],
  args: {
    items: cities,
    getKey: (city: City) => city.id,
    getLabel: (city: City) => city.name,
    renderCard: (city: City) => (
      <>
        <h3>{city.name}</h3>
        <p>{city.description}</p>
      </>
    ),
    locale: 'en-GB',
    onValueChange: fn(),
    onDecide: fn(),
    onUndo: fn(),
    onReset: fn(),
  },
  decorators: [
    (Story) => (
      <div css={fixtureStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: { code: SOURCE },
      description: {
        component: [
          'Review a queue using physical left/right decisions. This is a labelled group with native buttons, not an invented ARIA widget. The stage handles Left/Right, Backspace and Control/Command+Z; embedded controls keep native editing and undo. Held keys do not review multiple cards.',
          'Accepted history is the only authority. `value` controls that history; `defaultValue` seeds it. The active card is the first item whose stable key is not recorded. Unknown history keys remain available for audit and undo. Notifications describe interaction requests, not successful persistence, and run once in order: onValueChange, then onDecide/onUndo/onReset. Rejected controlled requests return home silently.',
          'The default display window is four cards (configurable from one to eight). Inactive and outgoing cards are inert. Buttons remain focusable at exhaustion; undo restores the final history entry and reset requests an empty history. Use Carousel for browsing rather than decisions.',
          'Drag horizontally from noninteractive content. Default thresholds: 35% of stage width capped at 140px, or a 12px minimum flick at 500px/s. Vertical intent scrolls; cancellation and lost capture always revert. Motion v14 uses velocity-carrying springs. Reduced motion completes immediately without travel or tilt. RTL mirrors presentation, not physical left/right outcomes.',
          'Names, action labels, past-tense outcomes and announcements are localizable. Number formatting uses Intl. The ReducedMotion and ForcedColors stories are structural fixtures; actual media emulation is a separate browser QA gate.',
        ].join('\n\n'),
      },
    },
  },
} satisfies Meta<typeof CardStack<City>>;
export default meta;
type Story = StoryObj<typeof meta>;
const part = (root: Element, name: string) =>
  root.querySelector<HTMLElement>(`[data-ui~="card-stack-${name}"]`)!;
const top = (root: Element) =>
  root.querySelector<HTMLElement>('[data-ui="card-stack-card"][data-state="active"]')!;
async function once(callback: unknown, ...args: unknown[]) {
  await expect(callback).toHaveBeenCalledTimes(1);
  await expect(callback).toHaveBeenCalledWith(...args);
}
async function settled(root: Element) {
  await waitFor(async () => {
    await expect(part(root, 'stage')).toHaveAttribute('data-state', 'settled');
    const card = top(root);
    if (card) {
      const transform = getComputedStyle(card).transform;
      const translation = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
      await expect(Math.abs(translation)).toBeLessThan(0.1);
      for (const stamp of card.querySelectorAll<HTMLElement>('[data-ui$="-stamp"]')) {
        await expect(Number(getComputedStyle(stamp).opacity)).toBe(0);
      }
    }
  });
}
async function focusRing(node: HTMLElement) {
  await expect(node.ownerDocument.activeElement).toBe(node);
  await expect(getComputedStyle(node).outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(getComputedStyle(node).outlineWidth) - 2)).toBeLessThan(
    1.1,
  );
}
function pointer(stage: HTMLElement) {
  const captures = new Set<number>();
  spyOn(stage, 'setPointerCapture').mockImplementation((id) => {
    captures.add(id);
  });
  spyOn(stage, 'hasPointerCapture').mockImplementation((id) => captures.has(id));
  spyOn(stage, 'releasePointerCapture').mockImplementation((id) => {
    captures.delete(id);
  });
  const box = stage.getBoundingClientRect();
  const send = (
    type: string,
    dx: number,
    dy = 0,
    extra: PointerEventInit = {},
    target: Element = stage,
  ) =>
    fireEvent(
      target,
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientX: box.left + box.width / 2 + dx,
        clientY: box.top + box.height / 2 + dy,
        ...extra,
      }),
    );
  return { send, captures };
}

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('group', { name: 'Cards' })).toHaveAttribute(
      'aria-roledescription',
      'card stack',
    );
    await expect(canvas.getByRole('group', { name: 'Oslo, Card 1 of 5' })).toBeInTheDocument();
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await expect(canvasElement.querySelectorAll('[data-ui="card-stack-card"]')).toHaveLength(4);
    for (const layer of canvasElement.querySelectorAll('[data-state="inactive"]')) {
      await expect(layer).toHaveAttribute('inert');
      await expect(layer).toHaveAttribute('aria-hidden', 'true');
    }
    for (const name of ['Pass', 'Undo', 'Keep', 'Reset']) {
      const button = canvas.getByRole('button', { name });
      await expect(button.getAttribute('data-ui')?.split(' ')).toContain('button');
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    }
  },
};
export const Sizes: Story = {
  render: (args) => (
    <>
      <CardStack {...args} size="sm" />
      <CardStack {...args} size="md" />
    </>
  ),
};
export const CustomActions: Story = {
  args: {
    labels: { left: 'Skip for now', right: 'Add to shortlist' },
    outcomes: { left: 'Skipped', right: 'Shortlisted' },
    icons: { undo: icon },
  },
};
export const InitiallyEmpty: Story = {
  args: { items: [] },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText('No cards')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
const completedHistory: CardStackDecision[] = cities.map((city) => ({
  key: city.id,
  decision: 'right',
}));
export const Completed: Story = { args: { defaultValue: completedHistory } };
export const CustomEmpty: Story = {
  args: {
    defaultValue: completedHistory,
    renderEmpty: ({ reset, completed }) => (
      <>
        <h3>{completed ? 'Shortlist finished' : 'Nothing to review'}</h3>
        <Button onClick={reset}>Review again</Button>
      </>
    ),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Review again' }));
    await settled(canvasElement);
    await expect(args.onReset).toHaveBeenCalledTimes(1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(part(canvasElement, 'stage'));
  },
};
export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: [{ key: 'removed', decision: 'left' }],
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{Backspace}{Control>}z{/Control}');
    for (const name of ['Pass', 'Undo', 'Keep', 'Reset'])
      await userEvent.click(canvas.getByRole('button', { name }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
function ControlledFixture(args: CardStackProps<City>) {
  const [value, setValue] = useState<readonly CardStackDecision[]>(args.defaultValue ?? []);
  return (
    <>
      <CardStack
        {...args}
        value={value}
        onValueChange={(next, event) => {
          args.onValueChange?.(next, event);
          setValue(next);
        }}
      />
      <Button
        onClick={() =>
          setValue([
            { key: 'oslo', decision: 'right' },
            { key: 'porto', decision: 'left' },
          ])
        }
      >
        Apply saved history
      </Button>
    </>
  );
}
export const Controlled: Story = {
  render: (args) => <ControlledFixture {...args} />,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    await settled(canvasElement);
    await once(args.onDecide, cities[0], 'right');
    await expect(top(canvasElement)).toHaveTextContent('Porto');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply saved history' }));
    await settled(canvasElement);
    await expect(top(canvasElement)).toHaveTextContent('Kyoto');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onDecide).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await settled(canvasElement);
    await once(args.onUndo, {
      key: 'porto',
      item: cities[1],
      decision: 'left',
    });
    await expect(top(canvasElement)).toHaveTextContent('Porto');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await settled(canvasElement);
    await expect(args.onReset).toHaveBeenCalledTimes(1);
    await expect(top(canvasElement)).toHaveTextContent('Oslo');
  },
};
export const RejectedControlled: Story = {
  args: { value: [] },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const keep = canvas.getByRole('button', { name: 'Keep' });
    await userEvent.click(keep);
    await settled(canvasElement);
    await expect(top(canvasElement)).toHaveTextContent('Oslo');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await expect(keep.ownerDocument.activeElement).toBe(keep);
    await once(args.onValueChange, [{ key: 'oslo', decision: 'right' }], {
      type: 'decide',
      key: 'oslo',
      item: cities[0],
      decision: 'right',
    });
    await once(args.onDecide, cities[0], 'right');
  },
};
export const Undo: Story = {
  args: { defaultValue: [{ key: 'oslo', decision: 'left' }] },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Undo' });
    await userEvent.click(button);
    await settled(canvasElement);
    await once(args.onUndo, { key: 'oslo', item: cities[0], decision: 'left' });
    await expect(top(canvasElement)).toHaveTextContent('Oslo');
    await expect(button.ownerDocument.activeElement).toBe(button);
    await userEvent.click(button);
    await expect(args.onUndo).toHaveBeenCalledTimes(1);
  },
};
export const Reset: Story = {
  args: { defaultValue: completedHistory },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const reset = part(canvasElement, 'reset-button');
    await userEvent.click(reset);
    await settled(canvasElement);
    await once(args.onValueChange, [], { type: 'reset' });
    await expect(args.onReset).toHaveBeenCalledTimes(1);
    await expect(reset.ownerDocument.activeElement).toBe(reset);
    await expect(top(canvasElement)).toHaveTextContent('Oslo');
    await userEvent.click(reset);
    await expect(args.onReset).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('status')).toHaveTextContent('5 cards reset');
  },
};
export const KeyboardDeck: Story = {
  args: { items: cities.slice(0, 2) },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const stage = part(canvasElement, 'stage');
    await userEvent.tab();
    await focusRing(stage);
    await userEvent.keyboard('{ArrowLeft}');
    await settled(canvasElement);
    await expect(args.onDecide).toHaveBeenNthCalledWith(1, cities[0], 'left');
    await userEvent.keyboard('{Backspace}');
    await settled(canvasElement);
    await expect(args.onUndo).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowRight}');
    await settled(canvasElement);
    await userEvent.keyboard('{Control>}z{/Control}');
    await settled(canvasElement);
    await userEvent.keyboard('{ArrowLeft}');
    await settled(canvasElement);
    await userEvent.keyboard('{Meta>}z{/Meta}');
    await settled(canvasElement);
    await expect(args.onUndo).toHaveBeenCalledTimes(3);
    await userEvent.tab();
    const pass = canvas.getByRole('button', { name: 'Pass' });
    await focusRing(pass);
    await userEvent.tab({ shift: true });
    await focusRing(stage);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await settled(canvasElement);
    await expect(args.onDecide).toHaveBeenCalledTimes(4);
    await userEvent.tab();
    await focusRing(canvas.getByRole('button', { name: 'Undo' }));
    await userEvent.tab();
    const keep = canvas.getByRole('button', { name: 'Keep' });
    await userEvent.keyboard(' ');
    await settled(canvasElement);
    await expect(args.onDecide).toHaveBeenCalledTimes(5);
    await expect(keep.ownerDocument.activeElement).toBe(keep);
    await expect(canvas.getByText('All cards reviewed')).toBeInTheDocument();
    await userEvent.keyboard(' ');
    await expect(args.onDecide).toHaveBeenCalledTimes(5);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await settled(canvasElement);
    await expect(args.onReset).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange!.mock.invocationCallOrder[0]).toBeLessThan(
      args.onDecide!.mock.invocationCallOrder[0]!,
    );
  },
};
export const InteractiveCardContent: Story = {
  args: {
    renderCard: (city) => (
      <>
        <h3>{city.name}</h3>
        <label>
          Notes <input aria-label="Notes" />
        </label>
        <Button>View details</Button>
      </>
    ),
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.tab();
    await userEvent.tab();
    const input = canvas.getByRole('textbox', { name: 'Notes' });
    await expect(input.ownerDocument.activeElement).toBe(input);
    await userEvent.keyboard('{ArrowRight}{Backspace}{Control>}z{/Control}');
    await expect(args.onDecide).not.toHaveBeenCalled();
    await userEvent.tab();
    await focusRing(canvas.getByRole('button', { name: 'View details' }));
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await focusRing(part(canvasElement, 'stage'));
  },
};
export const GestureDeck: Story = {
  play: async ({ canvasElement, args }) => {
    const stage = part(canvasElement, 'stage');
    const { send, captures } = pointer(stage);
    send('pointerdown', 0);
    send('pointermove', 3);
    send('pointerup', 3);
    await expect(args.onDecide).not.toHaveBeenCalled();
    send('pointerdown', 0);
    send('pointermove', 180);
    send('pointercancel', 180);
    await settled(canvasElement);
    await expect(args.onDecide).not.toHaveBeenCalled();
    await expect(captures.size).toBe(0);
    send('pointerdown', 0);
    send('pointermove', -180);
    send('lostpointercapture', -180);
    await settled(canvasElement);
    await expect(args.onDecide).not.toHaveBeenCalled();
    send('pointerdown', 0);
    send('pointermove', 10, 60);
    send('pointerup', 160, 60);
    await expect(args.onDecide).not.toHaveBeenCalled();
    send('pointerdown', 0, 0, { isPrimary: false });
    send('pointermove', 180);
    send('pointerup', 180);
    await expect(args.onDecide).not.toHaveBeenCalled();
    send('pointerdown', 0);
    send('pointerup', 0, 0, {}, stage.ownerDocument.body);
    send('pointermove', 180);
    send('pointerup', 180);
    await expect(args.onDecide).not.toHaveBeenCalled();
    send('pointerdown', 0);
    send('pointermove', 180);
    send('pointerup', 180);
    await settled(canvasElement);
    await once(args.onDecide, cities[0], 'right');
    await expect(top(canvasElement)).toHaveTextContent('Porto');
  },
};
export const RejectedGesture: Story = {
  args: { value: [] },
  play: async ({ canvasElement, canvas, args }) => {
    const { send } = pointer(part(canvasElement, 'stage'));
    send('pointerdown', 0);
    send('pointermove', -180);
    send('pointerup', -180);
    await settled(canvasElement);
    await expect(top(canvasElement)).toHaveTextContent('Oslo');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await once(args.onDecide, cities[0], 'left');
  },
};
export const UnknownHistoryUndo: Story = {
  args: { defaultValue: [{ key: 'missing', decision: 'right' }] },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await settled(canvasElement);
    await once(args.onUndo, {
      key: 'missing',
      item: undefined,
      decision: 'right',
    });
    await expect(top(canvasElement)).toHaveTextContent('Oslo');
  },
};
function DynamicFixture(args: CardStackProps<City>) {
  const [items, setItems] = useState(args.items);
  return (
    <>
      <CardStack {...args} items={items} />
      <Button onClick={() => setItems([cities[2]!, cities[0]!, cities[1]!, cities[4]!])}>
        Reorder and append
      </Button>
      <Button onClick={() => setItems((current) => current.filter((city) => city.id !== 'kyoto'))}>
        Remove active item
      </Button>
    </>
  );
}
export const DynamicItems: Story = {
  args: { items: cities.slice(0, 2) },
  render: (args) => <DynamicFixture {...args} />,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    await settled(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Reorder and append' }));
    await expect(top(canvasElement)).toHaveTextContent('Kyoto');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove active item' }));
    await expect(top(canvasElement)).toHaveTextContent('Porto');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const LongContent: Story = {
  args: {
    renderCard: (city) => (
      <>
        <h3>{city.name}</h3>
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>{city.description}</p>
        ))}
        <Button>Read more</Button>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const content = top(canvasElement).querySelector<HTMLElement>(
      '[data-ui="card-stack-content"]',
    )!;
    await expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    await expect(getComputedStyle(content).overflowY).toBe('auto');
  },
};
export const Narrow: Story = {
  args: {
    icons: { undo: icon },
    labels: { right: 'Add this destination to the shortlist' },
  },
  decorators: [
    (Story) => (
      <div css={narrowStyle}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const undo = canvas.getByRole('button', { name: 'Undo' });
    await expect(undo.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    await expect(part(canvasElement, 'controls').getBoundingClientRect().width).toBeLessThanOrEqual(
      225,
    );
    await expect(
      canvas
        .getByRole('button', { name: 'Add this destination to the shortlist' })
        .getBoundingClientRect().width,
    ).toBeLessThanOrEqual(225);
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await expect(getComputedStyle(part(canvasElement, 'controls')).direction).toBe('rtl');
    await expect(part(canvasElement, 'left-button').getBoundingClientRect().left).toBeGreaterThan(
      part(canvasElement, 'reset-button').getBoundingClientRect().left,
    );
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await settled(canvasElement);
    await once(args.onDecide, cities[0], 'left');
    await expect(canvas.getByRole('group', { name: 'Cards' })).toBeInTheDocument();
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture. Enable prefers-reduced-motion in the browser to verify immediate settlement and zero travel.',
      },
    },
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture. Enable forced colors in the browser to inspect system-colored boundaries and focus.',
      },
    },
  },
};
export const AriaComposition: Story = {
  args: {
    slotProps: {
      stage: {
        'aria-label': 'Fallback deck name',
        'aria-labelledby': 'deck-title missing-title',
        'aria-describedby': 'deck-description',
      },
      card: {
        'aria-label': 'Fallback card name',
        'aria-labelledby': 'card-extra',
      },
    },
  },
  render: (args) => (
    <>
      <h2 id="deck-title">Holiday review</h2>
      <p id="deck-description">Choose the next destination.</p>
      <span id="card-extra">Destination</span>
      <CardStack {...args} />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const stage = canvas.getByRole('group', { name: 'Holiday review' });
    await expect(stage).toHaveAttribute('aria-label', 'Fallback deck name');
    await expect(stage).toHaveAttribute('aria-labelledby', 'deck-title missing-title');
    await expect(stage.getAttribute('aria-describedby')).toContain('deck-description');
    await expect(stage.getAttribute('aria-describedby')).toContain(part(canvasElement, 'hint').id);
    await expect(
      canvas.getByRole('group', { name: 'Destination Oslo, Card 1 of 5' }),
    ).toHaveAttribute('aria-label', 'Fallback card name');
  },
};
export const FalsyContent: Story = {
  render: () => (
    <>
      {FALSY_NODES.map((node, index) => (
        <CardStack
          key={index}
          items={[0, false]}
          getKey={(item) => String(item)}
          getLabel={(item) => `Item ${String(item)}`}
          renderCard={() => node}
          icons={{ left: node, right: node, undo: node, reset: node }}
          label={`Deck ${index}`}
        />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('group', { name: 'Item 0, Card 1 of 2' })).toHaveLength(4);
    await expect(canvas.getAllByRole('button', { name: 'Keep' })).toHaveLength(4);
  },
};
export const SlotStyling: Story = {
  args: {
    slotProps: {
      stage: { css: overrideStyle },
      content: { css: overrideStyle },
      controls: { css: overrideStyle },
      rightButton: { css: overrideStyle },
    },
    sx: { gap: vars.space[6] },
  },
  play: async ({ canvasElement }) => {
    for (const name of ['stage', 'content', 'controls', 'right-button'])
      await expect(
        Math.abs(
          Number.parseFloat(getComputedStyle(part(canvasElement, name)).paddingInlineStart) - 24,
        ),
      ).toBeLessThan(1.1);
    await expect(
      Math.abs(
        Number.parseFloat(getComputedStyle(part(canvasElement, 'stage').parentElement!).gap) - 24,
      ),
    ).toBeLessThan(1.1);
  },
};
export const RepeatAndModifiers: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.tab();
    const stage = part(canvasElement, 'stage');
    fireEvent.keyDown(stage, { key: 'ArrowRight', repeat: true });
    fireEvent.keyDown(stage, { key: 'ArrowLeft', isComposing: true });
    await userEvent.keyboard('{Control>}{ArrowRight}{/Control}{Alt>}{ArrowLeft}{/Alt}');
    await expect(args.onDecide).not.toHaveBeenCalled();
  },
};
export const FocusedChildDecision: Story = {
  args: {
    renderCard: (city) => (
      <>
        <h3>{city.name}</h3>
        <label>
          Notes <input aria-label="Notes" />
        </label>
      </>
    ),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    const input = canvas.getByRole('textbox', { name: 'Notes' });
    await expect(input.ownerDocument.activeElement).toBe(input);
    fireEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    await settled(canvasElement);
    await expect(input.ownerDocument.activeElement).toBe(part(canvasElement, 'stage'));
    await once(args.onDecide, cities[0], 'right');
  },
};
export const RefAndUnresolvedAria: Story = {
  args: {
    ref: fn(),
    slotProps: {
      stage: {
        ref: fn(),
        'aria-label': 'Named deck',
        'aria-labelledby': 'unresolved-title',
        'aria-describedby': 'unresolved-description',
      },
    },
  },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(part(canvasElement, 'stage').parentElement);
    await expect(args.slotProps?.stage?.ref).toHaveBeenCalledWith(part(canvasElement, 'stage'));
    const stage = canvas.getByRole('group', { name: 'Named deck' });
    await expect(stage).toHaveAttribute('aria-labelledby', 'unresolved-title');
    await expect(stage.getAttribute('aria-describedby')).toContain('unresolved-description');
  },
};
export const FlickAndReverse: Story = {
  args: { gesture: { flickVelocity: 500 } },
  play: async ({ canvasElement, args }) => {
    const { send } = pointer(part(canvasElement, 'stage'));
    const timed = (type: string, dx: number, time: number) => {
      const stage = part(canvasElement, 'stage');
      const box = stage.getBoundingClientRect();
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        pointerType: 'mouse',
        clientX: box.left + box.width / 2 + dx,
        clientY: box.top + box.height / 2,
      });
      Object.defineProperty(event, 'timeStamp', { value: time });
      fireEvent(stage, event);
    };
    timed('pointerdown', 0, 100);
    timed('pointermove', 60, 120);
    timed('pointermove', 20, 130);
    timed('pointerup', 20, 140);
    await settled(canvasElement);
    await expect(args.onDecide).not.toHaveBeenCalled();
    timed('pointerdown', 0, 200);
    timed('pointermove', 20, 220);
    timed('pointerup', 20, 225);
    await settled(canvasElement);
    await once(args.onDecide, cities[0], 'right');
    send('pointerdown', 0);
    send('pointercancel', 0);
  },
};
export const FalsyItems: Story = {
  render: (args) => (
    <CardStack
      items={[0, false]}
      getKey={String}
      getLabel={(item) => `Item ${String(item)}`}
      renderCard={(item) => <p>{String(item)}</p>}
      onDecide={args.onDecide}
      onValueChange={args.onValueChange}
    />
  ),
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    await settled(canvasElement);
    await expect(args.onDecide).toHaveBeenNthCalledWith(1, 0, 'right');
    await userEvent.click(canvas.getByRole('button', { name: 'Pass' }));
    await settled(canvasElement);
    await expect(args.onDecide).toHaveBeenNthCalledWith(2, false, 'left');
  },
};
export const RejectedUndoAndReset: Story = {
  args: { value: [{ key: 'oslo', decision: 'right' }] },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await settled(canvasElement);
    await once(args.onUndo, { key: 'oslo', item: cities[0], decision: 'right' });
    await expect(top(canvasElement)).toHaveTextContent('Porto');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await settled(canvasElement);
    await expect(args.onReset).toHaveBeenCalledTimes(1);
    await expect(top(canvasElement)).toHaveTextContent('Porto');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const FalsyEmptyAndIcons: Story = {
  render: () => (
    <>
      {FALSY_NODES.map((node, index) => (
        <CardStack
          key={index}
          items={[]}
          getKey={String}
          getLabel={String}
          renderCard={() => node}
          renderEmpty={() => node}
          icons={{ left: node, right: node, undo: node, reset: node }}
          label={`Empty deck ${index}`}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const decks = canvasElement.querySelectorAll('[data-ui="card-stack"]');
    for (const [index, deck] of [...decks].entries()) {
      const empty = part(deck, 'empty');
      await expect(empty).toHaveTextContent(index === 2 ? '0' : '');
      await expect(empty.childElementCount).toBe(0);
      await expect(part(deck, 'left-button').querySelectorAll('[aria-hidden]')).toHaveLength(
        index === 2 ? 1 : 0,
      );
    }
  },
};
const budgetRender = fn((city: City) => <h3>{city.name}</h3>);
export const DragRenderBudget: Story = {
  args: { renderCard: budgetRender },
  play: async ({ canvasElement, args }) => {
    const stage = part(canvasElement, 'stage');
    const rendered = budgetRender.mock.calls.length;
    const classes = [...stage.querySelectorAll('[class]')].map((node) => node.className);
    const { send } = pointer(stage);
    send('pointerdown', 0);
    for (let dx = 10; dx <= 60; dx += 10) send('pointermove', dx);
    await expect(args.renderCard).toHaveBeenCalledTimes(rendered);
    await expect([...stage.querySelectorAll('[class]')].map((node) => node.className)).toEqual(
      classes,
    );
    send('pointercancel', 60);
    await settled(canvasElement);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ShrinkToFit: Story = {
  render: (args) => (
    <div css={shrinkWrapStyle}>
      <CardStack {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const stage = part(canvasElement, 'stage');
    await expect(stage.getBoundingClientRect().width).toBeGreaterThan(200);
    await expect(stage.getBoundingClientRect().width).toBeLessThanOrEqual(321);
    await expect(stage.parentElement!.getBoundingClientRect().width).toBeGreaterThan(200);
  },
};
