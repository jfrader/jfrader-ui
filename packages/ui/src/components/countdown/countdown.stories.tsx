import { StrictMode, useRef, useState, type ComponentPropsWithRef } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { Button } from '../button';
import { Countdown, type CountdownProps, type CountdownUnit } from './index';

const Stack = styled.div({
  display: 'grid',
  gap: vars.space[4],
  maxInlineSize: '100%',
});

const ActionsRow = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
});

const NarrowFrame = styled.div({
  inlineSize: '320px',
  maxInlineSize: '100%',
});

// The slot API takes `css` values, so this story keeps the documented spelling.
const slotLabelStyle = css({ fontSize: vars.textSize['2xl'] });
const slotNumberStyle = css({ fontSize: vars.textSize.md });
const slotContentStyle = css({ gap: vars.space[3] });
const slotUnitStyle = css({ fontSize: vars.textSize.sm });

const NOW = Date.parse('2026-12-01T12:00:00Z');
const SECOND = 1000;
const MAX_TIMEOUT = 2147483647;
const fixedClock = () => NOW;
const queryPart = (root: HTMLElement, part: string) =>
  root.querySelector<HTMLElement>(`[data-ui="countdown-${part}"]`)!;
const formatted = (
  value: number,
  unit: string,
  locale = 'en',
  unitDisplay: 'long' | 'narrow' = 'long',
) =>
  new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay,
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(value);

const meta = {
  title: 'Data/Countdown',
  component: Countdown,
  tags: ['autodocs'],
  args: {
    target: NOW + 90061000,
    initialNow: NOW,
    clock: fixedClock,
    locale: 'en',
    onComplete: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Show the time remaining until a date and time.',
      },
      usage: '- The timer has no controls or editable state. Tab and other keys pass through. Set the target in the parent; the clock supplies the current time.\n- Updates are not announced. Completion announcements are opt-in.\n- In the background, completion runs when the browser can next execute a callback, which may be after the target time.\n- Pass `locale` and `initialNow` for server rendering.',
    },
  },
  decorators: [
    (Story) => (
      <Stack>
        <Story />
      </Stack>
    ),
  ],
} satisfies Meta<typeof Countdown>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return <Countdown target={NOW + 90061000} initialNow={NOW} clock={fixedClock} locale="en" />;
}`,
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const timer = within(canvasElement).getByRole('timer', {
      name: 'Time remaining',
    });
    await expect(timer).toHaveAttribute('aria-live', 'off');
    await expect(timer).toHaveAttribute('data-state', 'running');
    await expect(queryPart(timer, 'content')).toHaveAttribute('aria-hidden', 'true');
    await expect(queryPart(timer, 'unit')).toHaveTextContent(formatted(1, 'day'));
    await expect(args.onComplete).not.toHaveBeenCalled();
  },
};
export const Display: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW + 90061000}
      initialNow={NOW}
      clock={fixedClock}
      locale="en"
      variant="display"
    />
  );
}`,
      },
    },
  }, args: { variant: 'display' } };
export const Compact: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW + 90061000}
      initialNow={NOW}
      clock={fixedClock}
      locale="en"
      variant="compact"
    />
  );
}`,
      },
    },
  },
  args: { variant: 'compact' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('timer').getBoundingClientRect().height,
    ).toBeGreaterThanOrEqual(31);
  },
};
export const HoursMinutes: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW + 90061000}
      initialNow={NOW}
      clock={fixedClock}
      locale="en"
      units={['hours', 'minutes']}
    />
  );
}`,
      },
    },
  },
  args: { units: ['hours', 'minutes'], target: NOW + 90061000 },
  play: async ({ canvasElement }) => {
    await expect(queryPart(within(canvasElement).getByRole('timer'), 'content')).toHaveTextContent(
      formatted(25, 'hour'),
    );
  },
};
export const SecondsOnly: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW + 60000}
      initialNow={NOW}
      clock={fixedClock}
      locale="en"
      units={['seconds']}
    />
  );
}`,
      },
    },
  },
  args: { units: ['seconds'], target: NOW + 60000 },
  play: async ({ canvasElement }) => {
    await expect(
      queryPart(within(canvasElement).getByRole('timer'), 'description'),
    ).toHaveTextContent(
      new Intl.NumberFormat('en', {
        style: 'unit',
        unit: 'second',
        unitDisplay: 'long',
      }).format(60),
    );
  },
};
export const SparseUnits: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW + 90061000}
      initialNow={NOW}
      clock={fixedClock}
      locale="en"
      units={['seconds', 'days', 'seconds']}
    />
  );
}`,
      },
    },
  },
  args: { units: ['seconds', 'days', 'seconds'], target: NOW + 90061000 },
  play: async ({ canvasElement }) => {
    const groups = within(canvasElement)
      .getByRole('timer')
      .querySelectorAll('[data-ui="countdown-unit"]');
    await expect(groups).toHaveLength(2);
    await expect(groups[0]).toHaveTextContent(formatted(1, 'day'));
    await expect(groups[1]).toHaveTextContent(formatted(3661, 'second'));
  },
};
export const MoreThan99Days: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown target={NOW + 1000 * 86400000} initialNow={NOW} clock={fixedClock} locale="en" />
  );
}`,
      },
    },
  },
  args: { target: NOW + 1000 * 86400000 },
};
export const Complete: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW}
      initialNow={NOW}
      clock={fixedClock}
      locale="en"
      completeLabel="Registration open"
    />
  );
}`,
      },
    },
  },
  args: { target: NOW, completeLabel: 'Registration open' },
};
export const InitiallyPast: Story = {
  args: { target: NOW - SECOND, announceCompletion: true },
  render: (args) => (
    <StrictMode>
      <Countdown {...args} />
    </StrictMode>
  ),
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByRole('timer')).toHaveAttribute(
      'data-state',
      'complete',
    );
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Live now');
    await expect(within(canvasElement).getAllByText('Live now')).toHaveLength(1);
    await expect(args.onComplete).toHaveBeenCalledTimes(1);
    await expect(args.onComplete).toHaveBeenCalledWith(NOW - SECOND);
    window.dispatchEvent(new Event('pageshow'));
    await expect(args.onComplete).toHaveBeenCalledTimes(1);
  },
};

export const PendingSSR: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown target={NOW + 90061000} initialNow={undefined} clock={fixedClock} locale="en" />
  );
}`,
      },
    },
  },
  args: { initialNow: undefined },
  play: async () => {
    const html = renderToString(
      <Countdown target={NOW + SECOND} clock={fixedClock} pendingLabel="Awaiting clock" />,
    );
    await expect(html).toContain('data-state="pending"');
    await expect(html).toContain('Awaiting clock');
    await expect(html).not.toContain('Live now');
  },
};

const invalidTargets = [
  new Date(NaN),
  NaN,
  Infinity,
  MAX_TIMEOUT * MAX_TIMEOUT,
  '2026-12-01',
  '2026-12-01T18:00:00',
  '12/01/2026',
  '2026-02-30T12:00:00Z',
  '2026-13-01T12:00:00Z',
];
export const InvalidDate: Story = {
  render: (args) => (
    <>
      {invalidTargets.map((target, index) => (
        <Countdown {...args} key={index} target={target} label={`Invalid ${index}`} />
      ))}
    </>
  ),
  play: async ({ canvasElement, args }) => {
    for (const timer of within(canvasElement).getAllByRole('timer')) {
      await expect(timer).toHaveAttribute('data-state', 'invalid');
      await expect(timer).toHaveAccessibleDescription('Unavailable');
      await expect(timer).not.toHaveTextContent(/NaN|Infinity|Live now/);
    }
    await expect(args.onComplete).not.toHaveBeenCalled();
  },
};
export const InvalidClock: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

export function Example() {
  return <Countdown target={NOW + 90061000} initialNow={NOW} clock={() => Infinity} locale="en" />;
}`,
      },
    },
  },
  args: { clock: () => Infinity },
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByRole('timer')).toHaveAttribute('data-state', 'invalid');
    await expect(args.onComplete).not.toHaveBeenCalled();
  },
};
export const ExactInstants: Story = {
  render: (args) => (
    <>
      {[
        NOW + 60000,
        new Date(NOW + 60000),
        '2026-12-01T12:01:00Z',
        '2026-12-01T13:01:00+01:00',
      ].map((target, index) => (
        <Countdown {...args} target={target} key={index} label={`Instant ${index}`} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const timers = within(canvasElement).getAllByRole('timer');
    for (const timer of timers)
      await expect(queryPart(timer, 'content').textContent).toBe(
        queryPart(timers[0]!, 'content').textContent,
      );
  },
};

const boundaries: {
  seconds: number;
  units: readonly CountdownUnit[];
  values: number[];
}[] = [
  { seconds: 0.001, units: ['seconds'], values: [1] },
  { seconds: 59, units: ['minutes', 'seconds'], values: [0, 59] },
  { seconds: 60, units: ['minutes', 'seconds'], values: [1, 0] },
  { seconds: 3600, units: ['hours', 'minutes', 'seconds'], values: [1, 0, 0] },
  { seconds: 86400, units: ['hours'], values: [24] },
  { seconds: 86400, units: [], values: [1, 0, 0, 0] },
  { seconds: 59, units: ['minutes'], values: [0] },
];
export const UnitBoundaries: Story = {
  render: (args) => (
    <>
      {boundaries.map(({ seconds, units }, index) => (
        <Countdown
          {...args}
          target={NOW + seconds * SECOND}
          units={units}
          key={index}
          label={`Boundary ${index}`}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const [index, test] of boundaries.entries()) {
      const values = within(canvasElement)
        .getByRole('timer', { name: `Boundary ${index}` })
        .querySelectorAll('[data-ui="countdown-number"]');
      await expect([...values].map((value) => value.textContent)).toEqual(
        test.values.map((value) =>
          new Intl.NumberFormat('en', {
            minimumIntegerDigits: 2,
            useGrouping: false,
          }).format(value),
        ),
      );
    }
    await expect(
      queryPart(within(canvasElement).getByRole('timer', { name: 'Boundary 6' }), 'description')
        .textContent,
    ).toBe(
      new Intl.NumberFormat('en', { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(0),
    );
  },
};

function ClockFixture(args: CountdownProps) {
  const current = useRef(NOW);
  const [clock] = useState(() => () => current.current);
  const [target, setTarget] = useState<CountdownProps['target']>(NOW + 1501);
  const [mounted, setMounted] = useState(true);
  const [handler, setHandler] = useState(() => args.onComplete);
  const wake = (now: number) => {
    current.current = now;
    window.dispatchEvent(new Event('pageshow'));
  };
  return (
    <>
      {mounted && (
        <Countdown
          {...args}
          target={target}
          clock={clock}
          onComplete={handler}
          announceCompletion
        />
      )}
      <ActionsRow>
        <Button onClick={() => wake(NOW + 502)}>Advance clock</Button>
        <Button onClick={() => wake(NOW + 1501)}>Reach deadline</Button>
        <Button onClick={() => setTarget(new Date(NOW + 1501))}>Same instant</Button>
        <Button onClick={() => setTarget(NOW + 2501)}>Replace target</Button>
        <Button onClick={() => wake(NOW + 2501)}>Reach replacement</Button>
        <Button onClick={() => setHandler(() => (epoch: number) => args.onComplete?.(epoch + 1))}>
          Change callback
        </Button>
        <Button onClick={() => setMounted(false)}>Unmount</Button>
      </ActionsRow>
    </>
  );
}
const fixtureSource = {
  docs: {
    source: {
      code: '<Countdown target={deadline} clock={serverClock} initialNow={serverSnapshot} onComplete={handleComplete} announceCompletion />',
    },
  },
};
export const ServerSyncedClock: Story = {
  render: (args) => <ClockFixture {...args} />,
  parameters: fixtureSource,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await expect(queryPart(canvas.getByRole('timer'), 'number')).toHaveTextContent('00');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await userEvent.click(canvas.getByRole('button', { name: 'Advance clock' }));
    await expect(
      canvas.getByRole('timer').querySelectorAll('[data-ui="countdown-number"]')[3],
    ).toHaveTextContent('01');
    await userEvent.click(canvas.getByRole('button', { name: 'Reach deadline' }));
    await expect(canvas.getByRole('timer')).toHaveAttribute('data-state', 'complete');
    await expect(canvas.getByRole('status')).toHaveTextContent('Live now');
    await expect(args.onComplete).toHaveBeenCalledTimes(1);
    await expect(args.onComplete).toHaveBeenCalledWith(NOW + 1501);
    await userEvent.click(canvas.getByRole('button', { name: 'Same instant' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reach deadline' }));
    await expect(args.onComplete).toHaveBeenCalledTimes(1);
  },
};
export const TargetReplacement: Story = {
  render: (args) => (
    <StrictMode>
      <ClockFixture {...args} />
    </StrictMode>
  ),
  parameters: fixtureSource,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Replace target' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reach deadline' }));
    await expect(args.onComplete).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Change callback' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reach replacement' }));
    await expect(args.onComplete).toHaveBeenCalledTimes(1);
    await expect(args.onComplete).toHaveBeenCalledWith(NOW + 2502);
    await userEvent.click(canvas.getByRole('button', { name: 'Same instant' }));
    await expect(args.onComplete).toHaveBeenCalledTimes(2);
    await expect(args.onComplete).toHaveBeenLastCalledWith(NOW + 1502);
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reach replacement' }));
    await expect(args.onComplete).toHaveBeenCalledTimes(2);
  },
};

export const NonTextCompletion: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW}
      initialNow={NOW}
      clock={fixedClock}
      locale="en"
      completeLabel={<strong aria-label="Registration open">✓</strong>}
      completeText="Registration open"
      completionIcon={<span>●</span>}
    />
  );
}`,
      },
    },
  },
  args: {
    target: NOW,
    completeLabel: <strong aria-label="Registration open">✓</strong>,
    completeText: 'Registration open',
    completionIcon: <span>●</span>,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('timer')).toHaveAccessibleDescription(
      'Registration open',
    );
  },
};
const falsy = [false, null, 0, ''] as const;
export const FalsyLabels: Story = {
  render: (args) => (
    <>
      {falsy.map((value, index) => (
        <Countdown
          {...args}
          key={index}
          target={NOW}
          label={value}
          completeLabel={value}
          completionIcon={value}
          aria-label={`Timer ${index}`}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const timers = within(canvasElement).getAllByRole('timer');
    for (const [index, timer] of timers.entries()) {
      const present = index === 2;
      await expect(!!queryPart(timer, 'label')).toBe(present);
      await expect(!!queryPart(timer, 'icon')).toBe(present);
      if (present) await expect(timer).toHaveTextContent('0');
      else await expect(timer).toHaveAccessibleDescription('Complete');
    }
  },
};
export const FalsyPlaceholders: Story = {
  render: (args) => (
    <>
      {falsy.map((value, index) => (
        <Countdown
          {...args}
          key={index}
          target={NaN}
          invalidLabel={value}
          label={`Invalid ${index}`}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const [index, timer] of within(canvasElement).getAllByRole('timer').entries())
      await expect(!!queryPart(timer, 'invalid')).toBe(index === 2);
    for (const value of falsy) {
      const html = renderToString(<Countdown target={NOW} pendingLabel={value} />);
      await expect(html.includes('data-ui="countdown-pending"')).toBe(value === 0);
    }
  },
};

export const IntlLocales: Story = {
  render: (args) => (
    <>
      {['es', 'en', 'ar-u-nu-arab'].map((locale) => (
        <Countdown {...args} key={locale} locale={locale} label={locale} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const locale of ['es', 'en', 'ar-u-nu-arab'])
      await expect(
        queryPart(within(canvasElement).getByRole('timer', { name: locale }), 'unit').textContent,
      ).toBe(formatted(1, 'day', locale));
  },
};
export const DurationFormatMissing: Story = {
  tags: ['!autodocs'],
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'DurationFormat');
    Object.defineProperty(Intl, 'DurationFormat', {
      value: undefined,
      configurable: true,
    });
    return () => {
      if (descriptor) Object.defineProperty(Intl, 'DurationFormat', descriptor);
      else Reflect.deleteProperty(Intl, 'DurationFormat');
    };
  },
  play: async ({ canvasElement }) => {
    const expected = new Intl.ListFormat('en', {
      style: 'long',
      type: 'conjunction',
    }).format(
      ['day', 'hour', 'minute'].map((unit) =>
        new Intl.NumberFormat('en', {
          style: 'unit',
          unit,
          unitDisplay: 'long',
        }).format(1),
      ),
    );
    await expect(
      queryPart(within(canvasElement).getByRole('timer'), 'description').textContent,
    ).toBe(expected);
  },
};
export const LightTheme: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return <Countdown target={NOW + 90061000} initialNow={NOW} clock={fixedClock} locale="en" />;
}`,
      },
    },
  },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const RTL: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown
      target={NOW + 90061000}
      initialNow={NOW}
      clock={fixedClock}
      locale="ar-u-nu-arab"
      dir="rtl"
    />
  );
}`,
      },
    },
  },
  args: { dir: 'rtl', locale: 'ar-u-nu-arab' },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(within(canvasElement).getByRole('timer')).direction).toBe('rtl');
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture. Enable reduced motion in your browser to inspect static replacements; this play does not emulate media preferences.',
      },
    },
  },
  render: (args) => <ClockFixture {...args} />,
};
export const ForcedColors: Story = {
  args: { variant: 'compact', target: NOW },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Countdown } from '@jfrader/ui';

const NOW = Date.parse('2026-12-01T12:00:00Z');

const fixedClock = () => NOW;

export function Example() {
  return (
    <Countdown target={NOW} initialNow={NOW} clock={fixedClock} locale="en" variant="compact" />
  );
}`,
      },
      description: {
        story:
          'Structural fixture. Enable forced colors in your browser to inspect system-color boundaries; this play does not emulate forced colors.',
      },
    },
  },
};
export const Narrow320: Story = {
  args: {
    target: NOW + 1000000 * 86400000,
    locale: 'de',
    units: ['seconds'],
    variant: 'compact',
  },
  render: (args) => (
    <NarrowFrame>
      <Countdown {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvasElement }) => {
    const timer = within(canvasElement).getByRole('timer');
    await expect(timer.scrollWidth).toBeLessThanOrEqual(timer.clientWidth + 1);
    const bounds = timer.getBoundingClientRect();
    for (const group of timer.querySelectorAll('[data-ui="countdown-unit"]')) {
      const range = timer.ownerDocument.createRange();
      range.selectNodeContents(group);
      for (const rect of range.getClientRects()) {
        await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
        await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      }
    }
  },
};

export const KeyboardPassThrough: Story = {
  render: (args) => (
    <>
      <Button>Before</Button>
      <Countdown {...args} />
      <Button>After</Button>
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const before = canvas.getByRole('button', { name: 'Before' });
    const after = canvas.getByRole('button', { name: 'After' });
    await userEvent.tab();
    await expect(before.ownerDocument.activeElement).toBe(before);
    await expect(getComputedStyle(before).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}{Escape}');
    await expect(before.ownerDocument.activeElement).toBe(before);
    await userEvent.tab();
    await expect(after.ownerDocument.activeElement).toBe(after);
    await userEvent.tab({ shift: true });
    await expect(before.ownerDocument.activeElement).toBe(before);
    await expect(canvas.getByRole('timer')).not.toHaveAttribute('tabindex');
  },
};
export const ExternalAria: Story = {
  args: { ref: fn(), 'aria-label': 'Consumer name' },
  render: (args) => (
    <>
      <span id="countdown-external-label">Launch</span>
      <span id="countdown-external-description">Event deadline</span>
      <Countdown
        {...args}
        aria-labelledby="countdown-external-label unresolved-id"
        aria-describedby="countdown-external-description"
      />
    </>
  ),
  play: async ({ canvasElement, args }) => {
    const timer = within(canvasElement).getByRole('timer');
    await expect(timer).toHaveAttribute('aria-label', 'Consumer name');
    await expect(timer).toHaveAccessibleName('Launch Time remaining');
    await expect(timer.getAttribute('aria-labelledby')).toContain('unresolved-id');
    await expect(timer.getAttribute('aria-describedby')).toContain(
      'countdown-external-description',
    );
    const internal = queryPart(timer, 'description');
    await expect(timer.getAttribute('aria-describedby')).toContain(internal.id);
    await expect(args.ref).toHaveBeenCalledWith(timer);
  },
};
function ReplacementContent(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="countdown-content" />;
}

export const SlotStyling: Story = {
  render: (args) => <Countdown {...args} slots={{ content: ReplacementContent }} />,
  args: {
    sx: { paddingInline: vars.space[4] },
    slotProps: {
      label: { sx: slotLabelStyle },
      number: { sx: slotNumberStyle },
      content: { sx: slotContentStyle },
      unit: { sx: slotUnitStyle },
    },
  },
  play: async ({ canvasElement }) => {
    const timer = within(canvasElement).getByRole('timer');
    const content = timer.querySelector('[data-slot="countdown-content"]');
    await expect(content).toBeInTheDocument();
    await expect(content).toHaveAttribute('data-ui', 'countdown-content');
    await expect(content).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(content!).display).toBe('flex');
    await expect(timer.querySelector('[data-ui="countdown-content"]:not([data-slot])')).toBeNull();
    await expect(parseFloat(getComputedStyle(timer).paddingInlineStart)).toBeCloseTo(16, 0);
    await expect(parseFloat(getComputedStyle(queryPart(timer, 'label')).fontSize)).toBeCloseTo(
      28,
      0,
    );
    await expect(parseFloat(getComputedStyle(queryPart(timer, 'number')).fontSize)).toBeCloseTo(
      16,
      0,
    );
    await expect(parseFloat(getComputedStyle(queryPart(timer, 'content')).gap)).toBeCloseTo(12, 0);
  },
};

export const DeadlineAcrossHiddenTab: Story = {
  render: (args) => <ClockFixture {...args} />,
  parameters: fixtureSource,
  play: async ({ canvasElement, userEvent, args }) => {
    const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    try {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reach deadline' }));
      await expect(args.onComplete).toHaveBeenCalledTimes(1);
      await expect(args.onComplete).toHaveBeenCalledWith(NOW + 1501);
      await expect(within(canvasElement).getByRole('timer')).toHaveAttribute(
        'data-state',
        'complete',
      );
    } finally {
      if (original) Object.defineProperty(document, 'visibilityState', original);
      else Reflect.deleteProperty(document, 'visibilityState');
      document.dispatchEvent(new Event('visibilitychange'));
    }
  },
};

function LongClockFixture(args: CountdownProps) {
  const current = useRef(NOW);
  const [clock] = useState(() => () => current.current);
  return (
    <>
      <Countdown {...args} clock={clock} />
      <Button
        onClick={() => {
          current.current = NOW + MAX_TIMEOUT;
          window.dispatchEvent(new Event('pageshow'));
        }}
      >
        First cap
      </Button>
      <Button
        onClick={() => {
          current.current = NOW + MAX_TIMEOUT * 2;
        }}
      >
        Second cap
      </Button>
      <Button
        onClick={() => {
          current.current = NOW + MAX_TIMEOUT * 2 + SECOND;
        }}
      >
        Finish clock
      </Button>
    </>
  );
}
export const LongDeadlineRearm: Story = {
  args: { target: NOW + MAX_TIMEOUT * 2 + SECOND },
  render: (args) => <LongClockFixture {...args} />,
  parameters: fixtureSource,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const scheduled: { callback: () => void; delay: number }[] = [];
    const originalTimeout = window.setTimeout.bind(window);
    const timeoutSpy = spyOn(window, 'setTimeout').mockImplementation(
      (handler, delay, ...arguments_) => {
        if (typeof handler === 'function' && handler.name === 'sample') {
          scheduled.push({
            callback: handler as () => void,
            delay: delay ?? 0,
          });
          return -1 as unknown as ReturnType<typeof window.setTimeout>;
        }
        return originalTimeout(handler, delay, ...arguments_) as unknown as ReturnType<
          typeof window.setTimeout
        >;
      },
    );
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'First cap' }));
      await waitFor(() => expect(scheduled.length).toBeGreaterThan(0));
      const firstWake = scheduled.find(({ delay }) => delay === MAX_TIMEOUT)!;
      await expect(firstWake).toBeDefined();
      await userEvent.click(canvas.getByRole('button', { name: 'Second cap' }));
      firstWake.callback();
      await waitFor(() => expect(scheduled.some(({ delay }) => delay === SECOND)).toBe(true));
      await expect(args.onComplete).not.toHaveBeenCalled();
      await userEvent.click(canvas.getByRole('button', { name: 'Finish clock' }));
      scheduled.find(({ delay }) => delay === SECOND)!.callback();
      await waitFor(() => expect(args.onComplete).toHaveBeenCalledTimes(1));
      await expect(args.onComplete).toHaveBeenCalledWith(NOW + MAX_TIMEOUT * 2 + SECOND);
      await expect(canvas.getByRole('timer')).toHaveAttribute('data-state', 'complete');
      await expect(scheduled.every(({ delay }) => delay <= MAX_TIMEOUT)).toBe(true);
    } finally {
      timeoutSpy.mockRestore();
    }
  },
};
