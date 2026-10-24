import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { renderToString } from 'react-dom/server';
import { GameChipStack, ChipFlights, useChipFlights, useChipFlight } from '@jfrader/ui/game-chip-stack';
import { Flex } from '@jfrader/ui/flex';
import { expectInside } from '../../testing/geometry-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { withChipStage } from '../game-chip/chip-showcase';
import { Button } from '@jfrader/ui/button';

const meta = {
  title: 'Games/GameChipStack', component: GameChipStack, tags: ['autodocs'],
  decorators: [withChipStage],
  args: { chips: [{ value: 5, count: 5 }], locale: 'en-US', size: 'xl' },
  parameters: { docs: {
    description: { component: 'Show blinds, bets, and pots as towers of casino chips.' },
    usage: 'The stack is decorative unless you supply a label. Put the real total in the surrounding pot or seat text, or in the image label, even when the visible chips are capped. Counts are nonnegative safe integers. Empty stacks render nothing.\n\nWrap your endpoints and controls in `ChipFlights`, then call `send` from `useChipFlights()` with the element refs. The provider owns the flight layer. The promise resolves with a landed, cancelled, or skipped status. Use the table queue for serial transfers and pot holds. See the [Flights guide](https://ui.jfrader.com/#/components/flights) for the queue and low-level hook contracts.',
    sections: [{ title: 'Chips in motion', stories: ['SendChipsToThePot'] }, { title: 'Hooks', stories: ['ChipFlightHook'] }, { title: 'Bets and pots', stories: ['Pot', 'BetLine', 'StackHeights', 'Capped'] }, { title: 'View and scale', stories: ['Flat', 'Sizes', 'Light'] }],
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

const flightResolved = fn();
const flightBusy = fn();
function FlightDemo() {
  const from = useRef<HTMLSpanElement>(null);
  const to = useRef<HTMLSpanElement>(null);
  const { send, cancel, busy } = useChipFlights();
  const [status, setStatus] = useState('Ready');
  const chips = [{ value: 25, count: 4 }];
  return <Flex direction="column" gap="lg" align="center">
    <Flex gap="xl" align="end">
      <Flex direction="column" gap="sm" align="center"><GameChipStack ref={from} chips={chips} size="xl" label="Source 100" /><span>Source</span></Flex>
      <Flex direction="column" gap="sm" align="center"><GameChipStack ref={to} chips={[{ value: 25, count: 1 }]} size="xl" label="Pot 25" /><span>Pot</span></Flex>
    </Flex>
    <Flex gap="md">
      <Button disabled={busy} onClick={() => { if (from.current && to.current) void send({ from: from.current, to: to.current, chips, size: 'xl' }).then(result => { setStatus(result.status); flightResolved(result); }); }}>Send chips</Button>
      <Button disabled={!busy} onClick={cancel}>Cancel flight</Button>
    </Flex>
    <span role="status">{busy ? 'In flight' : status}</span>
  </Flex>;
}
function FlightFixture() {
  const [visible, setVisible] = useState(true);
  return <Flex direction="column" gap="lg" align="center">
    {visible && <ChipFlights onBusyChange={flightBusy}><FlightDemo /></ChipFlights>}
    <Button onClick={() => setVisible(false)}>Unmount flight demo</Button>
  </Flex>;
}
export const SendChipsToThePot: Story = {
  name: 'Send chips to the pot', render: () => <ChipFlights><FlightDemo /></ChipFlights>,
  parameters: { docs: { source: { code: `import { useRef, useState } from 'react';
import { ChipFlights, GameChipStack, useChipFlights } from '@jfrader/ui/game-chip-stack';
import { Button } from '@jfrader/ui/button';
import { Flex } from '@jfrader/ui/flex';

function Transfer() {
  const from = useRef<HTMLSpanElement>(null), to = useRef<HTMLSpanElement>(null);
  const { send, cancel, busy } = useChipFlights();
  const [status, setStatus] = useState('Ready');
  const chips = [{ value: 25, count: 4 }];
  return <Flex direction="column" gap="lg" align="center">
    <Flex gap="xl" align="end">
      <Flex direction="column" gap="sm" align="center"><GameChipStack ref={from} chips={chips} size="xl" label="Source 100" /><span>Source</span></Flex>
      <Flex direction="column" gap="sm" align="center"><GameChipStack ref={to} chips={[{ value: 25, count: 1 }]} size="xl" label="Pot 25" /><span>Pot</span></Flex>
    </Flex>
    <Flex gap="md">
      <Button disabled={busy} onClick={async () => {
        if (from.current && to.current) setStatus((await send({ from: from.current, to: to.current, chips, size: 'xl' })).status);
      }}>Send chips</Button>
      <Button disabled={!busy} onClick={cancel}>Cancel flight</Button>
    </Flex>
    <span role="status">{busy ? 'In flight' : status}</span>
  </Flex>;
}
<ChipFlights><Transfer /></ChipFlights>` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const document = canvasElement.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: 'Send chips' }));
    await waitFor(() => expect(document.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull());
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('landed'), { timeout: 4000 });
    await expect(flightResolved).toHaveBeenLastCalledWith({ status: 'landed' });
    await userEvent.click(canvas.getByRole('button', { name: 'Send chips' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel flight' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('cancelled');
  },
};
function HookDemo() {
  const from = useRef<HTMLSpanElement>(null);
  const to = useRef<HTMLSpanElement>(null);
  const { send, busy } = useChipFlights();
  const [outcome, setOutcome] = useState('Ready');
  return <Flex direction="column" gap="md" align="center">
    <Flex gap="lg" align="end">
      <GameChipStack ref={from} chips={[{ value: 25, count: 1 }]} size="md" label="Source 25" />
      <GameChipStack ref={to} chips={[{ value: 5, count: 1 }]} size="md" label="Pot 5" />
    </Flex>
    <Button disabled={busy} onClick={async () => {
      if (!from.current || !to.current) return;
      const result = await send({ from: from.current, to: to.current, chips: [{ value: 5, count: 1 }], size: 'md' });
      setOutcome(result.reason ? `${result.status} (${result.reason})` : result.status);
    }}>Send 5</Button>
    <span role="status">{busy ? 'In flight' : outcome}</span>
  </Flex>;
}
export const ChipFlightHook: Story = {
  name: 'Read the send result',
  render: () => <ChipFlights><HookDemo /></ChipFlights>,
  parameters: { docs: { source: { code: `import { useRef, useState } from 'react';
import { ChipFlights, GameChipStack, useChipFlights } from '@jfrader/ui/game-chip-stack';
import { Button } from '@jfrader/ui/button';
import { Flex } from '@jfrader/ui/flex';

function SendFive() {
  const from = useRef<HTMLSpanElement>(null), to = useRef<HTMLSpanElement>(null);
  const { send, busy } = useChipFlights();
  const [outcome, setOutcome] = useState('Ready');
  return <Flex direction="column" gap="md" align="center">
    <Flex gap="lg" align="end">
      <GameChipStack ref={from} chips={[{ value: 25, count: 1 }]} size="md" label="Source 25" />
      <GameChipStack ref={to} chips={[{ value: 5, count: 1 }]} size="md" label="Pot 5" />
    </Flex>
    <Button disabled={busy} onClick={async () => {
      if (!from.current || !to.current) return;
      const result = await send({ from: from.current, to: to.current, chips: [{ value: 5, count: 1 }], size: 'md' });
      setOutcome(result.reason ? \`\${result.status} (\${result.reason})\` : result.status);
    }}>Send 5</Button>
    <span role="status">{busy ? 'In flight' : outcome}</span>
  </Flex>;
}
<ChipFlights><SendFive /></ChipFlights>` } } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Send 5' }));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('landed'), { timeout: 4000 });
  },
};
export const ProviderUnmount: Story = {
  tags: ['!autodocs'], render: () => <FlightFixture />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const document = canvasElement.ownerDocument;
    const initial = flightResolved.mock.calls.length;
    await expect(renderToString(<ChipFlights><FlightDemo /></ChipFlights>)).not.toContain('chip-flight-layer');
    await userEvent.click(canvas.getByRole('button', { name: 'Send chips' }));
    await waitFor(() => expect(document.querySelector('[data-ui="chip-flight-layer"]')).not.toBeNull());
    await expect(flightBusy).toHaveBeenLastCalledWith(true);
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount flight demo' }));
    await waitFor(() => expect(flightResolved).toHaveBeenCalledTimes(initial + 1));
    await expect(document.querySelector('[data-ui="chip-flight-layer"]')).toBeNull();
    await expect(flightResolved).toHaveBeenLastCalledWith({ status: 'cancelled' });
    await expect(flightBusy).toHaveBeenLastCalledWith(false);
  },
};

function MissingGeometryDemo({ omitLayer = false }: { omitLayer?: boolean }) {
  const from = useRef<HTMLSpanElement>(null);
  const { send, busy } = useChipFlights();
  const raw = useChipFlight();
  const [status, setStatus] = useState('Ready');
  return <Flex direction="column" gap="md">
    <GameChipStack ref={from} chips={[{ value: 25, count: 4 }]} size="xl" />
    <Button onClick={async () => {
      if (!from.current) return;
      const result = await (omitLayer ? raw.fly : send)({ from: from.current, to: omitLayer ? from.current : from.current.ownerDocument.createElement('span'), chips: [{ value: 25, count: 1 }] });
      setStatus(`${result.status}: ${result.reason}`);
    }}>Send chips</Button>
    <span role="status">{busy || raw.busy ? 'In flight' : status}</span>
  </Flex>;
}
export const MissingGeometry: Story = {
  tags: ['!autodocs'], render: () => <ChipFlights><MissingGeometryDemo /></ChipFlights>,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Send chips' }));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('skipped: missing-geometry'));
  },
};
export const OmittedEscapeHatchLayer: Story = {
  ...MissingGeometry, render: () => <ChipFlights><MissingGeometryDemo omitLayer /></ChipFlights>,
};
export const ProviderReducedMotion: Story = {
  tags: ['!autodocs'], render: () => <ChipFlights><FlightDemo /></ChipFlights>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const matchMedia = view.matchMedia;
    view.matchMedia = query => {
      const media = matchMedia.call(view, query);
      if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(media, 'matches', { value: true });
      return media;
    };
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Send chips' }));
      await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('skipped'));
      await expect(flightResolved).toHaveBeenLastCalledWith({ status: 'skipped', reason: 'reduced-motion' });
      await expect(canvasElement.ownerDocument.querySelector('[data-ui="chip-flight-layer"]')).toBeNull();
    } finally { view.matchMedia = matchMedia; }
  },
};
