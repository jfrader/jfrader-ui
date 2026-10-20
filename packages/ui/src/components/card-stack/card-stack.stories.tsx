import { useState, type ReactNode, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Card } from '../card';
import { Surface } from '../surface';
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
const Fixture = styled.div({
  boxSizing: 'border-box',
  padding: vars.space[4],
  inlineSize: '36rem',
  maxInlineSize: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: vars.space[4],
  '& > [data-story-theme-scope]': {
    minInlineSize: 0,
    gridTemplateColumns: 'inherit',
  },
});
const NarrowFixture = styled.div({ inlineSize: '14rem', maxInlineSize: '100%' });
const ShrinkWrap = styled.div({ display: 'inline-flex', maxInlineSize: '100%' });
const PassContent = styled.div({
  display: 'grid',
  alignContent: 'space-between',
  blockSize: '100%',
  gap: vars.space[3],
});
const PassTitle = styled.h3({ margin: 0, fontSize: vars.textSize.xl });
const PassDetail = styled.p({ margin: 0, fontSize: vars.textSize.sm });
const PassCode = styled.span({ fontFamily: vars.font.mono, fontSize: vars.textSize.sm });
const WalletPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 15)`,
  maxInlineSize: '100%',
  padding: vars.space[6],
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: vars.space[6],
});
const WalletLabel = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
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
      <Fixture>
        <Story />
      </Fixture>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      source: { code: SOURCE },
      description: {
        component: `Review a queue using physical left/right decisions. This is a labelled group with native buttons, not an invented ARIA widget. The stage handles Left/Right, Backspace and Control/Command+Z; embedded controls keep native editing and undo. Held keys do not review multiple cards.

Accepted history is the only authority. \`value\` controls that history; \`defaultValue\` seeds it. The active card is the first item whose stable key is not recorded. Unknown history keys remain available for audit and undo. Notifications describe interaction requests, not successful persistence, and run once in order: onValueChange, then onDecide/onUndo/onReset. Rejected controlled requests return home silently.

The default display window is four cards (configurable from one to eight). Inactive and outgoing cards are inert. Buttons remain focusable at exhaustion; undo restores the final history entry and reset requests an empty history. Use Carousel for browsing rather than decisions.

Use \`variant="wallet"\` for compact translucent cards with stitched edges and decision stamps. It keeps the same decision history and keyboard map; it does not select accounts or open activity panels. Supply card content with \`renderCard\` and use only masked payment details.

Drag horizontally from noninteractive content. Default thresholds: 35% of stage width capped at 140px, or a 12px minimum flick at 500px/s. Vertical intent scrolls; cancellation and lost capture always revert. Motion v14 uses velocity-carrying springs. Reduced motion completes immediately without travel or tilt. RTL mirrors presentation, not physical left/right outcomes.

Names, action labels, past-tense outcomes and announcements are localizable. Number formatting uses Intl. The ReducedMotion and ForcedColors stories are structural fixtures; actual media emulation is a separate browser QA gate.

Use slots to replace internal elements and slotProps to customize their props. Each key targets one element per rendered item; emptyResetButton customizes the completed-state reset independently of resetButton in the persistent controls.`,
      },
    },
  },
} satisfies Meta<typeof CardStack<City>>;
export default meta;
type Story = StoryObj<typeof meta>;

function ReplacementDiv(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="div" />;
}
function ReplacementCard(props: ComponentPropsWithRef<typeof Card>) {
  return <Card {...props} data-replacement="card" />;
}
function ReplacementButton(props: ComponentPropsWithRef<typeof Button>) {
  return <Button {...props} data-replacement="button" />;
}

export const SlotReplacements: Story = {
  args: {
    items: cities.slice(0, 1),
    slots: {
      stage: ReplacementDiv,
      card: ReplacementCard,
      content: ReplacementDiv,
      leftStamp: ReplacementDiv,
      rightStamp: ReplacementDiv,
      controls: ReplacementDiv,
      leftButton: ReplacementButton,
      undoButton: ReplacementButton,
      rightButton: ReplacementButton,
      resetButton: ReplacementButton,
      emptyResetButton: ReplacementButton,
      empty: ReplacementDiv,
      hint: ReplacementDiv,
      status: ReplacementDiv,
    },
    slotProps: {
      resetButton: { 'aria-label': 'Reset queue' },
      emptyResetButton: { 'aria-label': 'Review again' },
    },
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { CardStack, Card, Button } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
];

function CustomPanel(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}
function CustomCard(props: ComponentPropsWithRef<typeof Card>) {
  return <Card {...props} />;
}
function CustomButton(props: ComponentPropsWithRef<typeof Button>) {
  return <Button {...props} />;
}

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  slots={{
    stage: CustomPanel,
    card: CustomCard,
    content: CustomPanel,
    leftStamp: CustomPanel,
    rightStamp: CustomPanel,
    controls: CustomPanel,
    leftButton: CustomButton,
    undoButton: CustomButton,
    rightButton: CustomButton,
    resetButton: CustomButton,
    emptyResetButton: CustomButton,
    empty: CustomPanel,
    hint: CustomPanel,
    status: CustomPanel,
  }}
  slotProps={{
    resetButton: { 'aria-label': 'Reset queue' },
    emptyResetButton: { 'aria-label': 'Review again' },
  }}
/>`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const part of ['stage', 'content', 'left-stamp', 'right-stamp', 'controls', 'hint', 'status']) {
      await expect(canvasElement.querySelector(`[data-ui="card-stack-${part}"]`)).toHaveAttribute('data-replacement', 'div');
    }
    await expect(canvasElement.querySelector('[data-replacement="card"]')).toBeInTheDocument();
    for (const name of ['Pass', 'Keep', 'Undo', 'Reset queue']) {
      await expect(canvas.getByRole('button', { name })).toHaveAttribute('data-replacement', 'button');
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Review again' })).toHaveAttribute('data-replacement', 'button');
      await expect(canvasElement.querySelector('[data-ui="card-stack-empty"]')).toHaveAttribute('data-replacement', 'div');
    });
    await waitFor(async () => {
      await expect(canvas.getByRole('group', { name: /Cards/ })).toHaveAttribute('data-state', 'settled');
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Review again' }));
    await waitFor(async () => {
      await expect(canvasElement.querySelector('[data-ui="card-stack-content"]')).toHaveTextContent('Oslo');
    });
  },
};
const part = (root: Element, name: string) =>
  root.querySelector<HTMLElement>(`[data-ui~="card-stack-${name}"]`)!;
const top = (root: Element) =>
  root.querySelector<HTMLElement>('[data-ui="card-stack-card"][data-state="active"]')!;
async function once(callback: unknown, ...args: unknown[]) {
  await expect(callback).toHaveBeenCalledTimes(1);
  await expect(callback).toHaveBeenCalledWith(...args);
}
async function settled(root: Element) {
  // Generous window: cancel-driven home springs can complete late under CI load.
  await waitFor(
    async () => {
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
    },
    { timeout: 4000 },
  );
}
async function focusRing(node: HTMLElement) {
  await expect(node.ownerDocument.activeElement).toBe(node);
  await expect(getComputedStyle(node).outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(getComputedStyle(node).outlineWidth) - 2)).toBeLessThan(
    1.1,
  );
}
async function containedGeometry(root: Element) {
  const stage = part(root, 'stage').getBoundingClientRect();
  const controls = part(root, 'controls').getBoundingClientRect();
  const viewport = root.ownerDocument.documentElement;
  await expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await expect(stage.left).toBeGreaterThanOrEqual(0);
  await expect(stage.right).toBeLessThanOrEqual(viewport.clientWidth);
  for (const card of root.querySelectorAll('[data-ui="card-stack-card"]')) {
    await expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(controls.top);
  }
  for (const button of root.querySelectorAll('button')) {
    const box = button.getBoundingClientRect();
    await expect(box.width).toBeGreaterThanOrEqual(24);
    await expect(box.height).toBeGreaterThanOrEqual(32);
    await expect(box.right).toBeLessThanOrEqual(viewport.clientWidth);
  }
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
    await containedGeometry(canvasElement);
    await expect(part(canvasElement, 'stage').parentElement).not.toHaveAttribute('data-variant');
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
/** Review travel passes in a compact wallet stack. Pass and Keep still record decisions. */
export const Wallet: Story = {
  render: (args) => (
    <WalletPanel>
      <WalletLabel>Weekend passes · Shortlist</WalletLabel>
      <CardStack {...args} />
    </WalletPanel>
  ),
  args: {
    variant: 'wallet',
    label: 'Travel passes',
    renderCard: (city) => (
      <PassContent>
        <div>
          <PassDetail>Weekend pass</PassDetail>
          <PassTitle>{city.name}</PassTitle>
        </div>
        <PassDetail>{city.description}</PassDetail>
        <PassCode>TRAVEL / {city.id.toUpperCase()}</PassCode>
      </PassContent>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Use variant="wallet" for compact cards with translucent material and stitched edges. Content comes from renderCard. This remains a review queue: arrows decide, Backspace undoes; it does not select accounts or open activity panels. Use a list or Carousel to browse accounts. Put only masked card details in examples and application content.',
      },
      source: {
        code: `<CardStack
  variant="wallet"
  items={cities}
  getKey={city => city.id}
  getLabel={city => city.name}
  renderCard={city => (
    <PassContent>
      <div>
        <PassDetail>Weekend pass</PassDetail>
        <PassTitle>{city.name}</PassTitle>
      </div>
      <PassDetail>{city.description}</PassDetail>
      <PassCode>TRAVEL / {city.id.toUpperCase()}</PassCode>
    </PassContent>
  )}
  label="Travel passes"
/>`,
      },
    },
  },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await expect(part(canvasElement, 'stage').parentElement).toHaveAttribute(
      'data-variant',
      'wallet',
    );
    const surface = top(canvasElement).querySelector<HTMLElement>('[data-ui~="card"]')!;
    await expect(getComputedStyle(surface, '::before').borderStyle).toBe('dashed');
    await expect(getComputedStyle(surface).backdropFilter).not.toBe('none');
    await expect(getComputedStyle(part(top(canvasElement), 'right-stamp')).borderStyle).toBe('dashed');
    const rem = Number.parseFloat(getComputedStyle(surface.ownerDocument.documentElement).fontSize);
    await expect(surface.getBoundingClientRect().height).toBeCloseTo(12 * rem, 0);
    await expect(getComputedStyle(surface).borderColor).toBe(
      getComputedStyle(surface, '::before').borderColor,
    );
    await expect(canvasElement.querySelectorAll('[data-state="inactive"]')).toHaveLength(3);
    await userEvent.tab();
    await focusRing(part(canvasElement, 'stage'));
    await userEvent.keyboard('{ArrowRight}');
    await settled(canvasElement);
    await once(args.onDecide, cities[0], 'right');
    await expect(top(canvasElement)).toHaveTextContent('Porto');
    await userEvent.keyboard('{Backspace}');
    await settled(canvasElement);
    await expect(top(canvasElement)).toHaveTextContent('Oslo');
    await expect(canvas.getByRole('status')).toHaveTextContent('Oslo restored');
    await containedGeometry(canvasElement);
    const stack = part(canvasElement, 'stage').parentElement!;
    await expect(stack.getBoundingClientRect().right).toBeLessThanOrEqual(
      stack.parentElement!.getBoundingClientRect().right,
    );
  },
};
export const WalletLight: Story = {
  ...Wallet,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const WalletRTL: Story = {
  ...Wallet,
  args: { ...Wallet.args, dir: 'rtl' },
  play: async (context) => {
    await Wallet.play?.(context);
    await expect(getComputedStyle(part(context.canvasElement, 'controls')).direction).toBe('rtl');
    await expect(
      part(context.canvasElement, 'left-button').getBoundingClientRect().left,
    ).toBeGreaterThan(part(context.canvasElement, 'reset-button').getBoundingClientRect().left);
  },
};
export const WalletReducedMotion: Story = {
  ...Wallet,
  name: 'Wallet Reduced Motion',
  play: async (context) => {
    await Wallet.play?.(context);
    await expect(
      context.canvasElement.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)')
        .matches,
    ).toBe(true);
    for (const layer of context.canvasElement.querySelectorAll<HTMLElement>(
      '[data-ui="card-stack-card"]',
    )) {
      await expect(getComputedStyle(layer).transform).toBe('none');
    }
    await expect(context.canvasElement.querySelector('[data-state="outgoing"]')).toBeNull();
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
export const SingleCard: Story = {
  args: { items: cities.slice(0, 1), visibleCount: 1 },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
];

<CardStack
  items={cities}
  visibleCount={1}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="card-stack-card"]')).toHaveLength(1);
    await containedGeometry(canvasElement);
  },
};
export const CustomActions: Story = {
  args: {
    labels: { left: 'Skip for now', right: 'Add to shortlist' },
    outcomes: { left: 'Skipped', right: 'Shortlisted' },
    icons: { undo: icon },
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

const undoIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M8 6 3 11l5 5M3 11h10a6 6 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  labels={{ left: 'Skip for now', right: 'Add to shortlist' }}
  outcomes={{ left: 'Skipped', right: 'Shortlisted' }}
  icons={{ undo: undoIcon }}
/>`,
      },
    },
  },
};
export const InitiallyEmpty: Story = {
  args: { items: [] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

<CardStack
  items={[] as City[]}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
/>`,
      },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText('No cards')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const LongEmptyLabel: Story = {
  args: {
    items: [],
    labels: { empty: 'No_destinations_available_in_the_current_travel_shortlist' },
  },
  decorators: [(Story) => <NarrowFixture><Story /></NarrowFixture>],
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack, styled } from '@jfrader/ui';

const NarrowFrame = styled.div({ inlineSize: '14rem', maxInlineSize: '100%' });

interface City {
  id: string;
  name: string;
  description: string;
}

<NarrowFrame>
<CardStack
  items={[] as City[]}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  labels={{
    empty: 'No_destinations_available_in_the_current_travel_shortlist',
  }}
/>
</NarrowFrame>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const empty = part(canvasElement, 'empty');
    await expect(empty.scrollWidth).toBeLessThanOrEqual(empty.clientWidth);
    await containedGeometry(canvasElement);
  },
};
const completedHistory: CardStackDecision[] = cities.map((city) => ({
  key: city.id,
  decision: 'right',
}));
export const Completed: Story = {
  args: { defaultValue: completedHistory },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack, type CardStackDecision } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

const completedHistory: CardStackDecision[] = cities.map((city) => ({
  key: city.id,
  decision: 'right',
}));

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  defaultValue={completedHistory}
/>`,
      },
    },
  },
};
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack, Button, type CardStackDecision } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

const completedHistory: CardStackDecision[] = cities.map((city) => ({
  key: city.id,
  decision: 'right',
}));

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  defaultValue={completedHistory}
  renderEmpty={({ reset, completed }) => (
    <>
      <h3>{completed ? 'Shortlist finished' : 'Nothing to review'}</h3>
      <Button onClick={reset}>Review again</Button>
    </>
  )}
/>`,
      },
    },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  disabled
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  defaultValue={[{ key: 'removed', decision: 'left' }]}
/>`,
      },
    },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { CardStack, type CardStackDecision } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

function ControlledDeck() {
  const [history] = useState<readonly CardStackDecision[]>([]);

  return (
    <CardStack
      items={cities}
      getKey={(city) => city.id}
      getLabel={(city) => city.name}
      renderCard={(city) => (
        <>
          <h3>{city.name}</h3>
          <p>{city.description}</p>
        </>
      )}
      value={history}
    />
  );
}`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  defaultValue={[{ key: 'oslo', decision: 'left' }]}
/>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack, type CardStackDecision } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

const completedHistory: CardStackDecision[] = cities.map((city) => ({
  key: city.id,
  decision: 'right',
}));

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  defaultValue={completedHistory}
/>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
/>`,
      },
    },
  },
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
    await expect(canvas.getByRole('status')).toHaveTextContent('Porto: Kept. All cards reviewed.');
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack, Button } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <label>
        Notes <input aria-label="Notes" />
      </label>
      <Button>View details</Button>
    </>
  )}
/>`,
      },
    },
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
    // A pointerup after capture loss must not decide (first finish wins on the session).
    send('pointerup', -180);
    await waitFor(async () => {
      await expect(captures.size).toBe(0);
    });
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
export const ThrowStamp: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Keep' }));
    const outgoing = () =>
      canvasElement.querySelector<HTMLElement>('[data-ui="card-stack-card"][data-state="outgoing"]');
    await waitFor(async () => {
      const card = outgoing()!;
      await expect(card).toHaveTextContent('Oslo');
      await expect(part(card, 'right-stamp')).toHaveTextContent('Keep');
      await expect(Number(getComputedStyle(part(card, 'right-stamp')).opacity)).toBeGreaterThan(
        0.5,
      );
      await expect(Number(getComputedStyle(part(card, 'left-stamp')).opacity)).toBeLessThan(0.01);
    });
    await settled(canvasElement);
    await expect(outgoing()).toBeNull();
  },
};
export const RejectedGesture: Story = {
  args: { value: [] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  value={[]}
/>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  defaultValue={[{ key: 'missing', decision: 'right' }]}
/>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      {Array.from({ length: 12 }, (_, index) => (
        <p key={index}>{city.description}</p>
      ))}
    </>
  )}
/>`,
      },
    },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const content = top(canvasElement).querySelector<HTMLElement>(
      '[data-ui="card-stack-content"]',
    )!;
    await expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    await expect(getComputedStyle(content).overflowY).toBe('auto');
    await userEvent.tab();
    await userEvent.tab();
    const button = canvas.getByRole('button', { name: 'Read more' });
    await expect(button.ownerDocument.activeElement).toBe(button);
    const box = button.getBoundingClientRect();
    const bounds = content.getBoundingClientRect();
    await expect(box.top).toBeGreaterThanOrEqual(bounds.top);
    await expect(box.bottom).toBeLessThanOrEqual(bounds.bottom);
    await containedGeometry(canvasElement);
  },
};
export const Narrow: Story = {
  args: {
    icons: { undo: icon },
    labels: { right: 'Add this destination to the shortlist' },
  },
  decorators: [
    (Story) => (
      <NarrowFixture>
        <Story />
      </NarrowFixture>
    ),
  ],
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack, styled } from '@jfrader/ui';

const NarrowFrame = styled.div({
  inlineSize: '14rem',
  maxInlineSize: '100%',
});

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

const undoIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M8 6 3 11l5 5M3 11h10a6 6 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

<NarrowFrame>
  <CardStack
    items={cities}
    getKey={(city) => city.id}
    getLabel={(city) => city.name}
    renderCard={(city) => (
      <>
        <h3>{city.name}</h3>
        <p>{city.description}</p>
      </>
    )}
    icons={{ undo: undoIcon }}
    labels={{ right: 'Add this destination to the shortlist' }}
  />
</NarrowFrame>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  dir="rtl"
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
/>`,
      },
    },
  },
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
      stage: { sx: overrideStyle },
      content: { sx: overrideStyle },
      controls: { sx: overrideStyle },
      rightButton: { sx: overrideStyle },
    },
    sx: { gap: vars.space[6] },
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const StyledDeck = styled(CardStack<City>)({
  gap: vars.space[6],
  '& [data-ui="card-stack-stage"], & [data-ui="card-stack-content"], & [data-ui="card-stack-controls"], & [data-ui="card-stack-right-button"]': {
    paddingInline: vars.space[6],
    borderRadius: vars.radius.sm,
  },
});

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<StyledDeck
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
/>`,
      },
    },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <label>
        Notes <input aria-label="Notes" />
      </label>
    </>
  )}
/>`,
      },
    },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useRef } from 'react';
import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

function ReviewDeck() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <CardStack
        ref={rootRef}
        items={cities}
        getKey={(city) => city.id}
        getLabel={(city) => city.name}
        renderCard={(city) => (
          <>
            <h3>{city.name}</h3>
            <p>{city.description}</p>
          </>
        )}
        slotProps={{
          stage: {
            ref: stageRef,
            'aria-label': 'Named deck',
            'aria-labelledby': 'unresolved-title',
            'aria-describedby': 'unresolved-description',
          },
        }}
      />
    </>
  );
}`,
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
    parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
  gesture={{
    flickVelocity: 500,
  }}
/>`,
      },
    },
  },
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
    parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { CardStack, type CardStackDecision } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

function ControlledDeck() {
  const [history] = useState<readonly CardStackDecision[]>([
    { key: 'oslo', decision: 'right' },
  ]);

  return (
    <CardStack
      items={cities}
      getKey={(city) => city.id}
      getLabel={(city) => city.name}
      renderCard={(city) => (
        <>
          <h3>{city.name}</h3>
          <p>{city.description}</p>
        </>
      )}
      value={history}
    />
  );
}`,
      },
    },
  },
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
    parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { CardStack } from '@jfrader/ui';

interface City {
  id: string;
  name: string;
  description: string;
}

const cities: City[] = [
  { id: 'oslo', name: 'Oslo', description: 'A waterfront weekend with trails into the forest.' },
  { id: 'porto', name: 'Porto', description: 'River walks, tiled streets and a slow lunch.' },
  { id: 'kyoto', name: 'Kyoto', description: 'Quiet gardens and an early morning market.' },
  { id: 'lima', name: 'Lima', description: 'Coastal paths and an evening in the old town.' },
  { id: 'tallinn', name: 'Tallinn', description: 'A compact old town and a ferry across the bay.' },
];

<CardStack
  items={cities}
  getKey={(city) => city.id}
  getLabel={(city) => city.name}
  renderCard={(city) => (
    <>
      <h3>{city.name}</h3>
      <p>{city.description}</p>
    </>
  )}
/>`,
      },
    },
  },
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
    <ShrinkWrap>
      <CardStack {...args} />
    </ShrinkWrap>
  ),
  play: async ({ canvasElement }) => {
    const stage = part(canvasElement, 'stage');
    await expect(stage.getBoundingClientRect().width).toBeGreaterThan(200);
    await expect(stage.getBoundingClientRect().width).toBeLessThanOrEqual(321);
    await expect(stage.parentElement!.getBoundingClientRect().width).toBeGreaterThan(200);
  },
};
